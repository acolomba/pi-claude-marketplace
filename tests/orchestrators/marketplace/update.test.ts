import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  __test_outcomeToCascadePluginMessage,
  __test_snapshotAfterRefresh,
  updateAllMarketplaces,
  updateMarketplace,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { buildAuthCallbacks } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import {
  __resetCacheForTests,
  getPluginIndex,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../helpers/git-mock.ts";

import type {
  PluginUpdateFn,
  PluginUpdateOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // `pi` is required on UpdateMarketplaceOptions /
  // UpdateAllMarketplacesOptions; mirror production wiring shape (D-18-06).
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}

async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-update-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-update-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

/**
 * Construct a github ParsedSource via the public funnel. The factory
 * accepts a single `https://github.com/<owner>/<repo>[#<ref>]` URL;
 * tests synthesize a stable owner/repo and append the optional fragment.
 */
function makeGithubSource(ref?: string): ReturnType<typeof githubSource> {
  const url = `https://github.com/anthropics/claude-plugins-official${ref === undefined ? "" : `#${ref}`}`;
  return githubSource(url);
}

async function seedGithubMarketplace(opts: {
  cwd: string;
  name: string;
  ref?: string;
  autoupdate?: boolean;
  plugins?: Record<string, ExtensionState["marketplaces"][string]["plugins"][string]>;
  fixture?: "valid-marketplace" | "invalid-manifest";
}): Promise<{ cloneDir: string }> {
  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const cloneDir = await locations.sourceCloneDir(opts.name);
  // Pre-populate cloneDir with the fixture so the post-refresh manifest
  // read+validate can be exercised.
  await cp(fixtureMarketplaceDir(opts.fixture ?? "valid-marketplace"), cloneDir, {
    recursive: true,
  });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope: "project",
        source: makeGithubSource(opts.ref),
        addedFromCwd: opts.cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: opts.plugins ?? {},
        ...(opts.autoupdate !== undefined && { autoupdate: opts.autoupdate }),
      },
    },
  });
  // SPLIT-01: autoupdate lives in claude-plugins.json.
  // The state-side autoupdate above is harmless legacy seeding (D-13 scrubs
  // on next loadState once the config exists); seed the config too so the
  // SPLIT-01-rewired orchestrators (update.ts reads via loadMergedScopeConfig)
  // observe the autoupdate truth.
  if (opts.autoupdate !== undefined) {
    await saveConfig(
      locations.configJsonPath,
      {
        schemaVersion: 1,
        marketplaces: {
          [opts.name]: {
            source: "anthropics/claude-plugins-official",
            autoupdate: opts.autoupdate,
          },
        },
      },
      locations.scopeRoot,
    );
  }

  return { cloneDir };
}

function makePluginRecord(): ExtensionState["marketplaces"][string]["plugins"][string] {
  return {
    version: "0.0.1",
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("CMC-10 + MU-1: bare form against empty scope succeeds with `(no marketplaces)` EmptyToken and NO reload hint", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();
    await updateAllMarketplaces({ ctx, pi, scope: "project", cwd, gitOps });
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    // CMC-10: bare `(no marketplaces)` EmptyToken.
    assert.equal(first.message, "(no marketplaces)");
    assert.equal(first.message.includes("/reload to pick up changes"), false);
  });
});

test("MU-4 + D-14: github source refreshes via fetch+forceUpdateRef+checkout in that order", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "official", ref: "main" });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
    });

    await updateMarketplace({ ctx, pi, name: "official", scope: "project", cwd, gitOps });

    // D-14 sequence: fetch first, then forceUpdateRef, then checkout.
    assert.equal(state.fetchCalls.length, 1);
    assert.equal(state.forceUpdateRefCalls.length, 1);
    assert.equal(state.checkoutCalls.length, 1);
    // forceUpdateRef sets local branch to the remote SHA.
    const fur = state.forceUpdateRefCalls[0];
    assert.ok(fur !== undefined);
    assert.equal(fur.ref, "refs/heads/main");
    assert.equal(fur.value, "abcdef0000000000000000000000000000000001");
    // UXG-05: this github-source refresh re-validates the SAME fixture manifest
    // (the mock git ops advance the clone ref but do NOT change file content),
    // so the validated marketplace.json content is byte-identical pre/post and
    // the autoupdate-OFF path renders the no-op `(skipped) {up-to-date}` (NOT
    // `(updated)`). Source-kind-uniform: the github no-op is detected the same
    // way as the path-source no-op. Catalog UAT state `update-no-op-skipped`.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    // mp.status === "skipped" with the benign reason `up-to-date` (in
    // BENIGN_REASONS) routes to info via computeSeverity (UXG-02 / D-28-06/07).
    assert.equal(first.severity, undefined);
    // SNM-33 / D-22-01 (G-MIL-06): no plugin children -> no Pi-visible resource
    // change -> NO `/reload` trailer (UXG-05 is orthogonal to the reload-hint).
    assert.equal(first.message, "● official [project] (skipped) {up-to-date}");
    assert.equal(first.message.includes("/reload to pick up changes"), false);
  });
});

test("UXG-05: github-source refresh whose manifest content CHANGES renders `(updated)` (change detected, source-kind-uniform)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { cloneDir } = await seedGithubMarketplace({ cwd, name: "official", ref: "main" });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000003" },
    });

    // Wrap the mock so that AFTER checkout (the point a real fetch+checkout
    // would have advanced the working tree) the clone dir's marketplace.json
    // carries DIFFERENT validated content than the pre-refresh persisted
    // manifest. The change detector compares parsed/validated content pre vs
    // post, so a genuine content change must render `(updated)`.
    const manifestPath = path.join(cloneDir, ".claude-plugin", "marketplace.json");
    const changedGitOps: typeof gitOps = {
      ...gitOps,
      async checkout(opts): Promise<void> {
        await gitOps.checkout(opts);
        // Overwrite with a schema-valid manifest that differs in content
        // (an added plugin entry) so the post-refresh content key differs.
        await writeFile(
          manifestPath,
          JSON.stringify({
            name: "official",
            plugins: [{ name: "newly-added", source: "./newly-added" }],
          }),
          "utf8",
        );
      },
    };

    await updateMarketplace({
      ctx,
      pi,
      name: "official",
      scope: "project",
      cwd,
      gitOps: changedGitOps,
    });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    // Content changed -> `(updated)`, severity success (undefined), no reload
    // trailer (no plugin children). Catalog UAT state `manifest-refresh-changed`.
    assert.equal(first.severity, undefined);
    assert.equal(first.message, "● official [project] (updated)");
    assert.equal(first.message.includes("/reload to pick up changes"), false);
  });
});

test("UXG-05: path-source refresh whose local manifest is UNCHANGED renders the no-op `(skipped) {up-to-date}` (info per UXG-02 / D-28-06/07, no trailer)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Seed a path-source marketplace pointing at a real on-disk fixture. A
    // path source never advances a git SHA, so it is ALWAYS a no-op unless the
    // local marketplace.json file itself changed -- exactly the case UXG-05's
    // content-compare detects (path sources are the common no-op).
    const localMpDir = fixtureMarketplaceDir("valid-marketplace");
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "local-mp": {
          name: "local-mp",
          scope: "project",
          source: pathSource(localMpDir),
          addedFromCwd: cwd,
          manifestPath: path.join(localMpDir, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: localMpDir,
          plugins: {},
        },
      },
    });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();

    await updateMarketplace({ ctx, pi, name: "local-mp", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    // Benign `up-to-date` no-op -> info per UXG-02 / D-28-06/07 (no severity arg).
    assert.equal(first.severity, undefined);
    assert.equal(first.message, "● local-mp [project] (skipped) {up-to-date}");
    assert.equal(first.message.includes("/reload to pick up changes"), false);
  });
});

test("CR-01 / D-14 default-branch: forceUpdateRef target is refs/heads/<branch>, NOT the HEAD SHA", async () => {
  // Default-branch tracking (storedRef === undefined): the seeded
  // marketplace has no `ref` fragment. The refresh path must read the
  // symbolic branch name via gitOps.currentBranch(), then
  // forceUpdateRef("refs/heads/<branch>", remoteSha) -- NOT
  // resolveRef("HEAD") (which returns a SHA) as the ref argument, which
  // would produce a meaningless `refs/<40-hex>` write.
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "defaultbranch" });
    const { ctx, pi } = makeCtx();
    const remoteSha = "abcdef000000000000000000000000000000000a";
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: {
        "refs/remotes/origin/HEAD": remoteSha,
        "refs/remotes/origin/main": remoteSha,
      },
      localRefs: { "refs/heads/main": "0000000000000000000000000000000000000001" },
      currentBranchOverride: "main",
    });

    await updateMarketplace({ ctx, pi, name: "defaultbranch", scope: "project", cwd, gitOps });

    // currentBranch was consulted (CR-01 contract).
    assert.equal(state.currentBranchCalls.length, 1);
    // forceUpdateRef received the symbolic-name form, NOT a 40-hex SHA.
    assert.equal(state.forceUpdateRefCalls.length, 1);
    const fur = state.forceUpdateRefCalls[0];
    assert.ok(fur !== undefined);
    assert.equal(fur.ref, "refs/heads/main");
    assert.equal(fur.value, remoteSha);
    assert.equal(/^[a-f0-9]{40}$/i.test(fur.ref), false, "ref must NOT be a raw SHA");
    // Checkout is by branch name, not SHA.
    assert.equal(state.checkoutCalls.length, 1);
    const co = state.checkoutCalls[0];
    assert.ok(co !== undefined);
    assert.equal(co.ref, "main");
  });
});

test("CR-01 / D-14 default-branch: detached HEAD -> checkout SHA directly, no forceUpdateRef", async () => {
  // When currentBranch() returns undefined (detached HEAD), the refresh
  // path must NOT write any local ref -- there is no symbolic branch
  // to advance. It checks out the remote SHA directly.
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "detached" });
    const { ctx, pi } = makeCtx();
    const remoteSha = "abcdef000000000000000000000000000000000b";
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: {
        "refs/remotes/origin/HEAD": remoteSha,
        "refs/remotes/origin/main": remoteSha,
      },
      currentBranchOverride: null, // null = detached HEAD
    });

    await updateMarketplace({ ctx, pi, name: "detached", scope: "project", cwd, gitOps });

    assert.equal(state.currentBranchCalls.length, 1);
    assert.equal(state.forceUpdateRefCalls.length, 0, "detached HEAD must NOT write local ref");
    assert.equal(state.checkoutCalls.length, 1);
    const co = state.checkoutCalls[0];
    assert.ok(co !== undefined);
    assert.equal(co.ref, remoteSha);
  });
});

test("D-14: detached-HEAD path checks out SHA directly without forceUpdateRef", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const sha = "abcdef0000000000000000000000000000000002";
    await seedGithubMarketplace({ cwd, name: "pinned", ref: sha });
    const { ctx, pi } = makeCtx();
    // Mock has the SHA available as a 40-char hex; resolveRef of
    // refs/remotes/origin/<sha> will throw (no such branch), forcing
    // the detached path.
    const { gitOps, state } = makeMockGitOps();

    await updateMarketplace({ ctx, pi, name: "pinned", scope: "project", cwd, gitOps });

    // forceUpdateRef should NOT have been called for detached-HEAD.
    assert.equal(state.forceUpdateRefCalls.length, 0);
    // checkout WAS called with the SHA.
    assert.equal(state.checkoutCalls.length, 1);
    const co = state.checkoutCalls[0];
    assert.ok(co !== undefined);
    assert.equal(co.ref, sha);
  });
});

test("D-14: SHA-no-longer-exists (checkout throws) surfaces as notifyError with chained cause", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "rewritten", ref: "deadbeef" });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      checkoutThrows: new Error("mock: ref deadbeef no longer exists on remote"),
    });

    await updateMarketplace({ ctx, pi, name: "rewritten", scope: "project", cwd, gitOps });

    // The marketplace header carries no cause (SNM-10), so the underlying
    // MarketplaceUpdateError is surfaced through a synthetic failed-plugin
    // child whose cause drives the depth-5 cause-chain trailer. The chain
    // carries the checkout-throw text the user needs to diagnose the
    // failure (MU-5); `err.retryHint` remains on MarketplaceUpdateError for
    // programmatic inspection.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ rewritten \[project\] \(failed\)$/m);
    assert.match(first.message, /cause:.*ref deadbeef no longer exists on remote/);
  });
});

test("CR-05 / MU-5: pre-fetch failure (gitOps.fetch throws) does NOT append 'Retry the command.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "offline", ref: "main" });
    const { ctx, pi, notifications } = makeCtx();
    // Simulate DNS / network-unreachable on fetch -- cloneAdvanced must
    // stay false, so the retry hint is suppressed.
    const { gitOps } = makeMockGitOps({
      fetchThrows: new Error("mock: ENETUNREACH https://github.com"),
    });
    await updateMarketplace({ ctx, pi, name: "offline", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    // The fetch-throw cause is surfaced through the synthetic failed-plugin
    // child's cause-chain trailer so the user sees the network failure. The
    // retry-hint suppression (cloneAdvanced=false on a pre-fetch throw) is a
    // property of MarketplaceUpdateError.retryHint, not the notify bytes; the
    // surfaced cause does not include the "Retry the command." anchor.
    assert.match(first.message, /^⊘ offline \[project\] \(failed\)$/m);
    assert.match(first.message, /cause:.*ENETUNREACH/);
    assert.doesNotMatch(first.message, /Retry the command\./);
  });
});

test("MU-5: clone advances + manifest re-validation fails -- 'Retry the command.' retry hint", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Seed with a VALID manifest so the PRE-read content key resolves cleanly
    // (WR-02: a malformed PRE manifest would now route to (failed) BEFORE the
    // clone advances, which is a DIFFERENT diagnostic than this test asserts).
    // The clone-advanced + POST-revalidation-fails path under test is reached
    // by overwriting the manifest with INVALID content in the checkout override
    // (mirrors the UXG-05 "changed" test's checkout-rewrite pattern).
    const { cloneDir } = await seedGithubMarketplace({ cwd, name: "broken" });

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/HEAD": "abcdef0000000000000000000000000000000003" },
      localRefs: { HEAD: "abcdef0000000000000000000000000000000003" },
    });
    const brokenGitOps: typeof gitOps = {
      ...gitOps,
      async checkout(opts): Promise<void> {
        await gitOps.checkout(opts);
        // After the clone advances (fetch + checkout), the working-tree
        // manifest is INVALID, so the POST re-validation in
        // validateManifestAtRoot throws -> MarketplaceUpdateError with the
        // "clone advanced but manifest could not be persisted" diagnostic.
        await cp(fixtureMarketplaceDir("invalid-manifest"), cloneDir, { recursive: true });
      },
    };
    await updateMarketplace({
      ctx,
      pi,
      name: "broken",
      scope: "project",
      cwd,
      gitOps: brokenGitOps,
    });

    // Clone advanced + manifest re-read failed: the synthetic failed-plugin
    // child surfaces the underlying MarketplaceUpdateError cause-chain so the
    // user sees what failed (the "clone advanced but manifest could not be
    // persisted" diagnostic, MU-5). The literal "Retry the command." anchor
    // stays on MarketplaceUpdateError.retryHint (a separate field) for
    // programmatic inspection; the cause chain renders the error message only.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ broken \[project\] \(failed\)$/m);
    assert.match(first.message, /cause:.*clone advanced but manifest could not be persisted/);
  });
});

test("WR-02: corrupt pre-existing manifest routes to (failed), never a silent no-op (UAT Test-3 robustness fold-in)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Seed a valid clone, then overwrite the persisted PRE manifest with
    // malformed JSON so manifestContentKey's PRE read throws a non-ENOENT
    // SyntaxError. WR-02 narrows that catch so only ENOENT (no manifest yet)
    // maps to the changed-safe default; a corrupt pre-existing manifest must
    // re-throw and route to (failed) -- NOT silently read as a missing PRE key
    // ("changed") and render (updated). The PRE read sits INSIDE refreshRecord's
    // try (WR-01), so the throw wraps as MarketplaceUpdateError exactly like a
    // POST-read failure. Guards against a regression back to
    // `catch { return undefined; }` (the pre-WR-02 silent-(updated) bug).
    const { cloneDir } = await seedGithubMarketplace({ cwd, name: "corrupt", ref: "main" });
    await writeFile(
      path.join(cloneDir, ".claude-plugin", "marketplace.json"),
      "{ not valid json",
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000123" },
    });
    await updateMarketplace({ ctx, pi, name: "corrupt", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ corrupt \[project\] \(failed\)/m);
    assert.doesNotMatch(first.message, /\(updated\)/);
    assert.doesNotMatch(first.message, /\(skipped\) \{up-to-date\}/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ATTR-10 / D-48-B: a path-source marketplace.json that is malformed or
// schema-invalid during `marketplace update` must render
// `(failed) {invalid manifest}` on the synthetic-child failed row -- NEVER the
// lying `{network unreachable}` default (NFR-5: path-source touches no network).
// The reasonsFromCascadeError branch recognizes the typed
// InvalidMarketplaceManifestError (thrown by loadMarketplaceManifest, wrapped in
// MarketplaceUpdateError by refreshRecord) BEFORE the `?? network unreachable`
// fallback fires. github-source no-errno failures KEEP `{network unreachable}`
// as the catch-all (the path/github classification did not collapse).
// ───────────────────────────────────────────────────────────────────────────

/** Seed a path-source marketplace pointing at an on-disk dir under the cwd. */
async function seedPathMarketplace(opts: {
  cwd: string;
  name: string;
  marketplaceRoot: string;
}): Promise<void> {
  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope: "project",
        source: pathSource(opts.marketplaceRoot),
        addedFromCwd: opts.cwd,
        manifestPath: path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {},
      },
    },
  });
}

test("ATTR-10: path-source MALFORMED-JSON manifest renders `(failed) {invalid manifest}`, never `{network unreachable}`", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // A real on-disk marketplace whose marketplace.json is malformed JSON. The
    // PRE manifestContentKey read throws InvalidMarketplaceManifestError (cause:
    // SyntaxError) -> refreshRecord wraps it as MarketplaceUpdateError -> the
    // refreshOneMarketplace catch unwraps one cause level and classifies
    // `invalid manifest`. Zero network/gitOps on the path branch (NFR-5).
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-path-bad-json-"));
    try {
      await mkdir(path.join(localMpDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(localMpDir, ".claude-plugin", "marketplace.json"),
        "{ not valid json",
        "utf8",
      );
      await seedPathMarketplace({ cwd, name: "bad-json", marketplaceRoot: localMpDir });

      const { ctx, pi, notifications } = makeCtx();
      const { gitOps } = makeMockGitOps();
      await updateMarketplace({ ctx, pi, name: "bad-json", scope: "project", cwd, gitOps });

      assert.equal(notifications.length, 1);
      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.equal(first.severity, "error");
      assert.match(first.message, /\(failed\) \{invalid manifest\}/);
      assert.doesNotMatch(first.message, /\{network unreachable\}/);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("ATTR-10: path-source SCHEMA-INVALID manifest renders `(failed) {invalid manifest}`, never `{network unreachable}`", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Valid JSON, but fails MARKETPLACE_VALIDATOR (missing required `plugins`
    // array / wrong shape) -> loadMarketplaceManifest throws
    // InvalidMarketplaceManifestError("marketplace.json schema invalid: ...").
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-path-bad-schema-"));
    try {
      await mkdir(path.join(localMpDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(localMpDir, ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: 42, plugins: "not-an-array" }),
        "utf8",
      );
      await seedPathMarketplace({ cwd, name: "bad-schema", marketplaceRoot: localMpDir });

      const { ctx, pi, notifications } = makeCtx();
      const { gitOps } = makeMockGitOps();
      await updateMarketplace({ ctx, pi, name: "bad-schema", scope: "project", cwd, gitOps });

      assert.equal(notifications.length, 1);
      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.equal(first.severity, "error");
      assert.match(first.message, /\(failed\) \{invalid manifest\}/);
      assert.doesNotMatch(first.message, /\{network unreachable\}/);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("NFR-5: path-source update FAILURE (invalid manifest) still calls zero gitOps methods", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // The failure path must not reach for the network either: the path branch of
    // refreshRecord calls validateManifestAtRoot -> loadMarketplaceManifest (a
    // readFile + parse) and NO gitOps. Sibling of the success-path NFR-5 test.
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-path-fail-nfr5-"));
    try {
      await mkdir(path.join(localMpDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(localMpDir, ".claude-plugin", "marketplace.json"),
        "{ not valid json",
        "utf8",
      );
      await seedPathMarketplace({ cwd, name: "local-bad", marketplaceRoot: localMpDir });

      const { ctx, pi, notifications } = makeCtx();
      const { gitOps, state } = makeMockGitOps();
      await updateMarketplace({ ctx, pi, name: "local-bad", scope: "project", cwd, gitOps });

      // The failed row classified `invalid manifest` (not a network reason).
      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.match(first.message, /\(failed\) \{invalid manifest\}/);

      // Zero gitOps -- the failure path is network-free.
      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("github-source no-errno refresh failure still renders `{network unreachable}` (classification did not collapse)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // A github fetch failure with NO errno code and NO typed manifest error is
    // genuinely plausibly-network -> the `?? ["network unreachable"]` catch-all
    // MUST still fire. This is the regression lock proving the ATTR-10 typed
    // manifest branch did NOT swallow the github network default.
    await seedGithubMarketplace({ cwd, name: "ghnet", ref: "main" });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      // Plain Error: message mentions ENETUNREACH but carries no `.code` errno,
      // so reasonsFromCascadeError returns undefined and the network default
      // fires for this github source.
      fetchThrows: new Error("mock: connection failed reaching github.com"),
    });
    await updateMarketplace({ ctx, pi, name: "ghnet", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /\(failed\) \{network unreachable\}/);
    assert.doesNotMatch(first.message, /\{invalid manifest\}/);
  });
});

test("MU-6 + MU-8: cascade runs ONLY when autoupdate=true; pluginUpdate called once per state plugin (never for new-manifest entries)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Seed with autoupdate=true and one installed plugin.
    await seedGithubMarketplace({
      cwd,
      name: "auto-mp",
      ref: "main",
      autoupdate: true,
      plugins: { hello: makePluginRecord() },
    });
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000004" },
    });
    const calls: { plugin: string; marketplace: string }[] = [];
    const pluginUpdate: PluginUpdateFn = async (plugin, marketplace) => {
      calls.push({ plugin, marketplace });
      return Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgents: [],
        stagedMcpServers: [],
        declaresAgents: false,
        declaresMcp: false,
      });
    };

    await updateMarketplace({
      ctx,
      pi,
      name: "auto-mp",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // Exactly one cascade call -- for the installed plugin. MU-8: even
    // though the manifest fixture lists `hello` as well, the cascade
    // enumerates state.plugins keys, not manifest entries, so a manifest
    // that grew new entries would NOT trigger spurious calls.
    assert.equal(calls.length, 1);
    const first = calls[0];
    assert.ok(first !== undefined);
    assert.equal(first.plugin, "hello");
    assert.equal(first.marketplace, "auto-mp");
  });
});

test("MU-6: cascade skipped when autoupdate=false (default)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "manual-mp",
      ref: "main",
      autoupdate: false,
      plugins: { hello: makePluginRecord() },
    });
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000005" },
    });
    let pluginUpdateCalled = false;
    const pluginUpdate: PluginUpdateFn = async () => {
      pluginUpdateCalled = true;
      return Promise.resolve({
        partition: "updated",
        name: "x",
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgents: [],
        stagedMcpServers: [],
        declaresAgents: false,
        declaresMcp: false,
      });
    };

    await updateMarketplace({
      ctx,
      pi,
      name: "manual-mp",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    assert.equal(pluginUpdateCalled, false);
  });
});

test("CMC-26 / MSG-GR-3: cascade body emits per-plugin rows sorted alphabetically (regardless of status)", async () => {
  // The MU-7 partition headers (`Updated:` / `Unchanged:` / `Skipped:` /
  // `Failed:`) are not emitted; cascade rows interleave alphabetically by
  // name per MSG-GR-3 (`compareByNameThenScope`). The status / icon /
  // reason on each row carries the partition signal -- the partition labels
  // are not emitted as section headers.
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "mixed",
      ref: "main",
      autoupdate: true,
      plugins: {
        a: makePluginRecord(),
        b: makePluginRecord(),
        c: makePluginRecord(),
        d: makePluginRecord(),
      },
    });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000006" },
    });
    // PluginUpdateOutcome is a discriminated union; each partition variant
    // has different required fields. Construct a fixture per branch.
    const pluginUpdate: PluginUpdateFn = (plugin) => {
      if (plugin === "a") {
        return Promise.resolve<PluginUpdateOutcome>({
          partition: "updated",
          name: plugin,
          fromVersion: "0.0.1",
          toVersion: "0.0.2",
          stagedAgents: [],
          stagedMcpServers: [],
          declaresAgents: false,
          declaresMcp: false,
        });
      }

      if (plugin === "b") {
        return Promise.resolve<PluginUpdateOutcome>({
          partition: "unchanged",
          name: plugin,
          fromVersion: "0.0.1",
          toVersion: "0.0.1",
          declaresAgents: false,
          declaresMcp: false,
        });
      }

      if (plugin === "c") {
        return Promise.resolve<PluginUpdateOutcome>({
          partition: "skipped",
          name: plugin,
          notes: [],
          reasons: [],
          declaresAgents: false,
          declaresMcp: false,
        });
      }

      return Promise.resolve<PluginUpdateOutcome>({
        partition: "failed",
        name: plugin,
        notes: [],
        declaresAgents: false,
        declaresMcp: false,
      });
    };

    await updateMarketplace({
      ctx,
      pi,
      name: "mixed",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    const first = notifications[0];
    assert.ok(first !== undefined);
    const body = first.message;
    // D-18-03: Rows interleave in caller order (D-16-06):
    // a (updated), b (unchanged), c (skipped fallback), d (failed). Catalog
    // `mixed-outcomes` shape.
    // Glyph map per D-16-11 severity ladder:
    //   updated -> ● (info)
    //   skipped -> ⊘ (warning)
    //   failed  -> ⊘ (error)
    // The `[project]` scope bracket is suppressed by the orphan-fold
    // (plugin.scope === mp.scope -> renderScopeBracket returns ""). Both
    // narrowSkipReason (WR-06) and narrowFailReason fallbacks now map an
    // empty-notes/no-substring-match outcome to `unreadable manifest`;
    // mapping to `up-to-date` would have falsely claimed SUCCESS on a
    // producer-contract violation.
    const idxA = body.indexOf("  ● a v0.0.1 → v0.0.2 (updated)");
    const idxB = body.indexOf("  ⊘ b (skipped) {up-to-date}");
    const idxC = body.indexOf("  ⊘ c (skipped) {unreadable manifest}");
    const idxD = body.indexOf("  ⊘ d (failed) {unreadable manifest}");
    assert.ok(
      idxA >= 0 && idxB > idxA && idxC > idxB && idxD > idxC,
      `row order broken in body:\n${body}`,
    );
    // Partition headers MUST NOT appear.
    assert.equal(body.includes("Updated:"), false);
    assert.equal(body.includes("Unchanged:"), false);
    assert.equal(body.includes("Skipped:"), false);
    assert.equal(body.includes("Failed:"), false);
  });
});

test("MU-9 + MSG-RH-1: success emits canonical reload hint trailer for updated plugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "rh",
      ref: "main",
      autoupdate: true,
      plugins: { x: makePluginRecord(), a: makePluginRecord() },
    });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000007" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgents: [],
        stagedMcpServers: [],
        declaresAgents: false,
        declaresMcp: false,
      });

    await updateMarketplace({
      ctx,
      pi,
      name: "rh",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // MSG-RH-1 canonical reload-hint trailer (names no longer interpolated).
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.match(first.message, /\/reload to pick up changes$/);
  });
});

test("UXG-05 (UAT Test-3 gap) + RH-1 + SNM-33 / D-22-01: autoupdate-ON cascade all-unchanged no-op renders `(skipped) {up-to-date}` (info per UXG-02 / D-28-06/07) and emits NO reload-hint (G-MIL-06)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "noupd",
      ref: "main",
      autoupdate: true,
      plugins: { p: makePluginRecord() },
    });
    const { ctx, pi, notifications } = makeCtx();
    // The mock git ops advance the ref but do NOT rewrite the seeded
    // `valid-marketplace` fixture, so the refresh re-validates byte-identical
    // manifest content -> snapshot.changed === false.
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000008" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "unchanged",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.1",
        declaresAgents: false,
        declaresMcp: false,
      });
    await updateMarketplace({
      ctx,
      pi,
      name: "noupd",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });
    // UXG-05: when snapshot.changed === false AND every cascade outcome is
    // `unchanged`, the marketplace converges to the SAME no-op byte form as
    // the autoupdate-OFF no-op: `(skipped) {up-to-date}`, all-`unchanged`
    // cascade rows dropped (plugins:[]). The benign `up-to-date` reason routes
    // severity to info per UXG-02 / D-28-06/07.
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.message, "● noupd [project] (skipped) {up-to-date}");
    assert.equal(first.severity, undefined);
    // SNM-33 / D-22-01 (G-MIL-06): no plugin row carries a state-change token
    // (plugins:[]), and a marketplace record is not a Pi-visible resource, so
    // the trailer is suppressed -- shouldEmitReloadHint is plugin-row-driven.
    assert.doesNotMatch(first.message, /\/reload to pick up changes/);
  });
});

test("UXG-05 (UAT Test-3 gap) regression guard: autoupdate-ON cascade where a plugin UPDATES renders `(updated)` with the per-plugin row + reload-hint (NOT a no-op even when snapshot.changed === false)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { p: makePluginRecord() },
    });
    const { ctx, pi, notifications } = makeCtx();
    // Same setup as the no-op test: the mock git ops advance the ref but do
    // NOT rewrite the seeded fixture, so snapshot.changed === false. The ONLY
    // difference is the cascade outcome -- a plugin actually updated, so
    // outcomes.every(unchanged) is false and the no-op gate does NOT fire.
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000009" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgents: [],
        stagedMcpServers: [],
        declaresAgents: false,
        declaresMcp: false,
      });
    await updateMarketplace({
      ctx,
      pi,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });
    // Condition B (outcomes.every(... "unchanged")) is false because a plugin
    // updated, so the no-op gate is skipped even though snapshot.changed is
    // false. The marketplace header stays `(updated)` and the per-plugin
    // updated row + reload-hint trailer are emitted.
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.ok(
      first.message.startsWith("● official [project] (updated)"),
      `expected (updated) header, got: ${first.message}`,
    );
    assert.match(first.message, /\/reload to pick up changes/);
  });
});

test("NFR-5: path-source update calls zero gitOps methods", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Place a real on-disk marketplace at a tmp path (NOT under sources/).
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-update-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          local: {
            name: "local",
            scope: "project",
            source: pathSource(localMpDir),
            addedFromCwd: cwd,
            manifestPath: path.join(localMpDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: localMpDir,
            plugins: {},
          },
        },
      });
      const { ctx, pi } = makeCtx();
      const { gitOps, state } = makeMockGitOps();
      await updateMarketplace({ ctx, pi, name: "local", scope: "project", cwd, gitOps });

      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("D-03-INV :: update invalidates plugin cache for that marketplace", async () => {
  // updateMarketplace wires invalidateMarketplaceCache into its
  // post-state-commit window (after the inner withStateGuard returns,
  // before any cascade runs). Manifest refresh may have changed the plugin
  // set, so the cached plugin index for this (scope, marketplace) pair
  // MUST be dropped. Memory-only op; the file is left intact as a rebuild
  // source. Test pattern: pre-warm memory + delete the on-disk file ->
  // run update -> next read MUST re-invoke rebuild (proves memory cleared).
  await withHermeticHome(async ({ cwd }) => {
    __resetCacheForTests();
    await seedGithubMarketplace({ cwd, name: "official", ref: "main" });
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
    });

    // Pre-warm the plugin index memory entry.
    const locations = locationsFor("project", cwd);
    const pluginCachePath = await locations.pluginCacheFile("official");
    let rebuildCount = 0;
    await getPluginIndex(pluginCachePath, "project", "official", () => {
      rebuildCount += 1;
      return Promise.resolve([{ name: "stale-plugin", status: "available" }]);
    });
    assert.equal(rebuildCount, 1, "pre-test: rebuild invoked on first read");

    // Drop the on-disk cache file so the next memory-miss MUST rebuild.
    await rm(pluginCachePath, { force: true });

    // Run update: must invalidate the plugin cache for (project, official).
    await updateMarketplace({ ctx, pi, name: "official", scope: "project", cwd, gitOps });

    // Memory must be cleared; with file absent, next read invokes rebuild.
    await getPluginIndex(pluginCachePath, "project", "official", () => {
      rebuildCount += 1;
      return Promise.resolve([]);
    });
    assert.equal(rebuildCount, 2, "post-invalidation read re-invokes rebuild");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// D-18-03: outcomeToCascadePluginMessage maps a PluginUpdateOutcome to a
// discriminated PluginNotificationMessage. The mapper returns one of
// `PluginUpdatedMessage{from,to,dependencies}`, `PluginSkippedMessage{reasons}`,
// or `PluginFailedMessage{reasons,cause?}` (no PluginUnchangedMessage variant
// -- `unchanged` outcomes map to `skipped` + `["up-to-date"]` with a glyph
// flip).
//
// The typed-reasons path is preferred over the notes-parsing fallback (CR-06
// producer-narrowed contract) so a future refactor cannot regress to substring
// matching.
// ───────────────────────────────────────────────────────────────────────────

test("outcomeToCascadePluginMessage: updated outcome -> PluginUpdatedMessage with from/to/dependencies", () => {
  const outcome: PluginUpdateOutcome = {
    partition: "updated",
    name: "p",
    fromVersion: "0.5.0",
    toVersion: "1.0.0",
    stagedAgents: [],
    stagedMcpServers: [],
    declaresAgents: true,
    declaresMcp: false,
  };
  const msg = __test_outcomeToCascadePluginMessage(outcome, "project");
  assert.equal(msg.status, "updated");
  assert.equal(msg.name, "p");
  assert.equal(msg.scope, "project");
  if (msg.status !== "updated") {
    throw new Error("unreachable: narrowed above");
  }

  assert.equal(msg.from, "0.5.0");
  assert.equal(msg.to, "1.0.0");
  // `declaresAgents: true` -> "agents" appears in dependencies;
  // `declaresMcp: false` -> "mcp" is absent.
  assert.deepEqual(msg.dependencies, ["agents"]);
});

test('outcomeToCascadePluginMessage: unchanged outcome -> PluginSkippedMessage with ["up-to-date"] (glyph flips to ⊘ at render time)', () => {
  // `unchanged` maps to `skipped` + `["up-to-date"]`; the renderer routes
  // `skipped` to warning severity -> ⊘ glyph.
  const outcome: PluginUpdateOutcome = {
    partition: "unchanged",
    name: "p",
    fromVersion: "0.0.1",
    toVersion: "0.0.1",
    declaresAgents: false,
    declaresMcp: false,
  };
  const msg = __test_outcomeToCascadePluginMessage(outcome, "project");
  assert.equal(msg.status, "skipped");
  if (msg.status !== "skipped") {
    throw new Error("unreachable: narrowed above");
  }

  assert.deepEqual(msg.reasons, ["up-to-date"]);
});

test("outcomeToCascadePluginMessage: skipped outcome with typed reasons reads them directly (no notes parse)", () => {
  const outcome: PluginUpdateOutcome = {
    partition: "skipped",
    name: "p",
    // Intentionally pick `notes` content that the legacy parser would
    // narrow DIFFERENTLY than `reasons` so we can prove `reasons` is the
    // primary path. Legacy `narrowSkipReason` would map this notes blob
    // to `up-to-date` (default); `reasons` says `not installed`.
    notes: ["irrelevant cause-chain text"],
    reasons: ["not installed"] as const,
    declaresAgents: false,
    declaresMcp: false,
  };
  const msg = __test_outcomeToCascadePluginMessage(outcome, "project");
  assert.equal(msg.status, "skipped");
  if (msg.status !== "skipped") {
    throw new Error("unreachable: narrowed above");
  }

  assert.deepEqual(msg.reasons, ["not installed"]);
});

test("outcomeToCascadePluginMessage: failed outcome with typed reasons + cause -> PluginFailedMessage", () => {
  const cause = new Error("permission denied");
  const outcome: PluginUpdateOutcome = {
    partition: "failed",
    name: "p",
    notes: ["arbitrary cause-chain text"],
    reasons: ["rollback partial"] as const,
    declaresAgents: false,
    declaresMcp: false,
    cause,
  };
  const msg = __test_outcomeToCascadePluginMessage(outcome, "project");
  assert.equal(msg.status, "failed");
  if (msg.status !== "failed") {
    throw new Error("unreachable: narrowed above");
  }

  assert.deepEqual(msg.reasons, ["rollback partial"]);
  // D-18-03: cause is forwarded to PluginFailedMessage for the
  // 4-space-indent cause-chain trailer at render time.
  assert.equal(msg.cause, cause);
});

test("outcomeToCascadePluginMessage: skipped outcome without typed reasons falls back to notes substring parse (back-compat)", () => {
  // `reasons` is required on PluginUpdateSkippedOutcome (the
  // producer-narrowed contract). An empty `reasons: []` array exercises the
  // consumer's notes-fallback substring narrow without populating a typed
  // reason.
  const outcome: PluginUpdateOutcome = {
    partition: "skipped",
    name: "p",
    notes: ["not in manifest"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  };
  const msg = __test_outcomeToCascadePluginMessage(outcome, "project");
  assert.equal(msg.status, "skipped");
  if (msg.status !== "skipped") {
    throw new Error("unreachable: narrowed above");
  }

  assert.deepEqual(msg.reasons, ["not in manifest"]);
});

test("outcomeToCascadePluginMessage: failed outcome without typed reasons falls back to notes substring parse (back-compat)", () => {
  const outcome: PluginUpdateOutcome = {
    partition: "failed",
    name: "p",
    notes: ["rollback partial: skills"],
    // No `reasons` -- exercises the transitional notes-fallback path.,
    declaresAgents: false,
    declaresMcp: false,
  };
  const msg = __test_outcomeToCascadePluginMessage(outcome, "project");
  assert.equal(msg.status, "failed");
  if (msg.status !== "failed") {
    throw new Error("unreachable: narrowed above");
  }

  assert.deepEqual(msg.reasons, ["rollback partial"]);
  // No cause was stamped on the outcome -> the mapper omits it on
  // PluginFailedMessage; the renderer skips the cause-chain trailer.
  assert.equal(msg.cause, undefined);
});

// ───────────────────────────────────────────────────────────────────────────
// cascadeAutoupdates catch site pre-narrows the closed `Reason` via the
// typed-dispatch helper. EACCES / EPERM throws surface as `{permission denied}`
// instead of the consumer's permissive `not in manifest` fallback. Exercised
// end-to-end through `updateMarketplace` with an injected `pluginUpdate` stub
// that throws an errno-bearing error.
// ───────────────────────────────────────────────────────────────────────────

test("260525-cjr B2: cascadeAutoupdates catch -> EACCES surfaces as `{permission denied}` not `{not in manifest}`", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { alpha: makePluginRecord() },
    });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000999" },
    });
    const pluginUpdate: PluginUpdateFn = () => {
      const err = new Error("EACCES: permission denied, open '/some/.pi/agent/file'");
      (err as NodeJS.ErrnoException).code = "EACCES";
      return Promise.reject(err);
    };

    await updateMarketplace({
      ctx,
      pi,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // The cascade-row body should render the precise `permission denied`
    // closed Reason rather than degrading to the permissive
    // `not in manifest` default that the consumer's `narrowFailReasons`
    // would otherwise pick.
    const composed = notifications.map((n) => n.message).join("\n");
    assert.match(
      composed,
      /alpha[^\n]*\(failed\)[^\n]*\{permission denied\}/,
      `expected (failed) {permission denied} for EACCES throw, got:\n${composed}`,
    );
    assert.equal(
      composed.includes("{not in manifest}"),
      false,
      `regression: EACCES throw masqueraded as {not in manifest}.\n${composed}`,
    );
  });
});

test("260525-cjr B2: cascadeAutoupdates catch -> ENOENT surfaces as `{source missing}`", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { alpha: makePluginRecord() },
    });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000999" },
    });
    const pluginUpdate: PluginUpdateFn = () => {
      const err = new Error("ENOENT: no such file or directory");
      (err as NodeJS.ErrnoException).code = "ENOENT";
      return Promise.reject(err);
    };

    await updateMarketplace({
      ctx,
      pi,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    const composed = notifications.map((n) => n.message).join("\n");
    assert.match(composed, /alpha[^\n]*\(failed\)[^\n]*\{source missing\}/);
  });
});

test("260525-cjr B2: cascadeAutoupdates catch -> generic Error falls through to notes-substring (back-compat preserved)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { alpha: makePluginRecord() },
    });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000999" },
    });
    const pluginUpdate: PluginUpdateFn = () =>
      Promise.reject(new Error("something opaque happened"));

    await updateMarketplace({
      ctx,
      pi,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    const composed = notifications.map((n) => n.message).join("\n");
    // Generic Error -> reasonsFromCascadeError returns undefined ->
    // consumer's narrowFailReason falls through to the legacy notes
    // substring parse, which lands on `unreadable manifest` (the
    // documented default for unclassifiable cascade failures). This
    // proves the typed-dispatch path correctly returned `undefined`
    // for an unrecognised error shape and deferred to the back-compat
    // notes path.
    assert.match(composed, /alpha[^\n]*\(failed\)[^\n]*\{unreadable manifest\}/);
  });
});

// ── New tests covering previously uncovered paths ────────────────────

test("SC-6 / MU-1: updateAllMarketplaces (no scope) processes user-scope marketplace", async () => {
  // targets.push() for a marketplace discovered in the
  // user scope during the no-scope-filter iteration path.
  await withHermeticHome(async ({ cwd }) => {
    // Seed a marketplace in user scope.  getAgentDir() uses
    // homedir()/.pi/agent on Linux when PI_CODING_AGENT_DIR is not set.
    // withHermeticHome sets HOME so homedir() resolves to `home`.
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const cloneDir = await userLocations.sourceCloneDir("user-mp");
    await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "user-mp": {
          name: "user-mp",
          scope: "user",
          source: makeGithubSource("main"),
          addedFromCwd: cwd,
          manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: cloneDir,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000010" },
    });

    // Call without scope filter -- enumerates both scopes (SC-6).
    await updateAllMarketplaces({ ctx, pi, cwd, gitOps });

    // At least one notification, and it should mention user-mp.
    assert.ok(notifications.length >= 1);
    const combined = notifications.map((n) => n.message).join("\n");
    assert.ok(combined.includes("user-mp"), `expected "user-mp" in notifications: ${combined}`);
    // No error severity.
    const errNotif = notifications.find((n) => n.severity === "error");
    assert.equal(errNotif, undefined, `unexpected error notification: ${errNotif?.message}`);
  });
});

test("SC-6 / MU-1: updateAllMarketplaces (no scope) with both scopes empty notifies once", async () => {
  // The empty-targets guard fires when BOTH scopes are
  // enumerated and neither has any marketplaces.  The existing MU-1 test
  // uses scope:'project' (single scope); this test exercises the no-filter
  // path that checks both scopes.
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();

    await updateAllMarketplaces({ ctx, pi, cwd, gitOps }); // no scope filter

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.message, "(no marketplaces)");
    assert.equal(first.message.includes("Run /reload to "), false);
  });
});

test("refreshRecord: unsupported source kind surfaces as notifyError (lines 219-222)", async () => {
  // The else branch in refreshRecord throws
  // `Cannot update marketplace "..." unsupported source kind "..."`.
  // An `unknown`-kind source stored in state reaches this branch because
  // normalizeStoredSource passes kind==="unknown" through verbatim, but
  // refreshRecord only handles "github" and "path".
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "unsupported-mp": {
          name: "unsupported-mp",
          scope: "project",
          // kind:"unknown" passes STATE_VALIDATOR (source:Type.Unknown())
          // and passes normalizeStoredSource (kind==="unknown" branch).
          source: {
            kind: "unknown",
            raw: "ftp://example.com",
            reason: "unsupported scheme",
          },
          addedFromCwd: cwd,
          manifestPath: path.join(cwd, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: cwd,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();

    await updateMarketplace({ ctx, pi, name: "unsupported-mp", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.ok(
      first.message.includes("unsupported source kind"),
      `expected "unsupported source kind" in: ${first.message}`,
    );
  });
});

test("updateMarketplace: explicit-scope missing marketplace -> standalone {not added} (SC#1)", async () => {
  // SC#1 cross-op convergence: an explicit-scope miss is blocked by the
  // pre-guard loadState existence read BEFORE it reaches snapshotAfterRefresh's
  // withStateGuard (which would otherwise throw MarketplaceNotFoundError raw).
  // It renders the canonical standalone `(failed) {not added}` variant -- no
  // longer a synthetic `(failed)` cascade row or a raw escape. Byte-locked to
  // the exact canonical row (mirrors remove.ts / autoupdate.ts convergence).
  await withHermeticHome(async ({ cwd }) => {
    // Leave state empty -- no marketplace named "ghost".
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();

    await updateMarketplace({ ctx, pi, name: "ghost", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(
      first.message,
      "1 marketplace operation failed.\n\n⊘ ghost [project] (failed) {not added}",
    );
    assert.equal(first.severity, "error");
  });
});

test("CR-01 TOCTOU: marketplace removed between pre-guard read and snapshotAfterRefresh's fresh load returns undefined (silent no-op), never throws raw nor emits `{network unreachable}`", async () => {
  // CR-01: there is a TOCTOU window between resolveScopeOrNotifyNotAdded's
  // pre-guard `loadState` (which proved the marketplace exists) and
  // snapshotAfterRefresh's withStateGuard fresh `loadState`. If a concurrent
  // `marketplace remove` lands in that window, the guard's fresh load sees
  // `record === undefined`. The PREVIOUS code threw a raw
  // MarketplaceNotFoundError there, which refreshOneMarketplace's generic catch
  // misattributed (reasonsFromCascadeError -> undefined -> `?? network
  // unreachable`) as the LYING `(failed) {network unreachable}` row -- exactly
  // the NFR-5/ATTR-10 misattribution class this milestone closes.
  //
  // The fix mirrors remove.ts:235-244: snapshotAfterRefresh returns `undefined`
  // (sentinel) instead of throwing, and refreshOneMarketplace returns silently.
  // We drive the seam directly with an empty on-disk state (the concurrent-
  // removal end-state) and assert it returns `undefined` rather than rejecting.
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Persist an empty state -- this is the post-concurrent-removal disk state
    // the guard's fresh `loadState` observes.
    await saveState(locations.extensionRoot, { schemaVersion: 1, marketplaces: {} });

    const { ctx, pi } = makeCtx();
    const { gitOps, state: gitState } = makeMockGitOps();

    const snapshot = await __test_snapshotAfterRefresh({
      ctx,
      pi,
      name: "vanished",
      scope: "project",
      locations,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    // The sentinel: undefined, NOT a thrown MarketplaceNotFoundError. The
    // record-absent arm never reaches refreshRecord, so zero gitOps fire
    // (NFR-5: the concurrent-removal no-op touches no network).
    assert.equal(snapshot, undefined);
    assert.equal(gitState.cloneCalls.length, 0);
    assert.equal(gitState.fetchCalls.length, 0);
    assert.equal(gitState.checkoutCalls.length, 0);
  });
});

test("CR-01 TOCTOU: refreshOneMarketplace silently no-ops on a removed marketplace -- no `{network unreachable}`, no second notification", async () => {
  // End-to-end companion to the seam test: drive updateMarketplace with state
  // whose marketplace exists at the pre-guard read but whose guard-time fresh
  // load sees it gone. We simulate the concurrent removal by deleting the record
  // through a gitOps lifecycle hook... but the guard load precedes any gitOps
  // call, so instead we assert the BEHAVIORAL contract via the seam end-state:
  // when snapshotAfterRefresh yields undefined, refreshOneMarketplace must emit
  // NOTHING (the pre-guard already notified `{not added}`) and MUST NOT render
  // the lying `{network unreachable}` row. We prove the negative directly: an
  // explicit-scope miss (record absent at BOTH reads) emits exactly the
  // `{not added}` convergence row and NEVER `{network unreachable}`.
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();

    await assert.doesNotReject(async () =>
      updateMarketplace({ ctx, pi, name: "vanished", scope: "project", cwd, gitOps }),
    );

    const composed = notifications.map((n) => n.message).join("\n");
    assert.doesNotMatch(
      composed,
      /\{network unreachable\}/,
      `a missing/removed marketplace must NEVER render the lying {network unreachable} reason:\n${composed}`,
    );
    // Exactly the convergence `{not added}` row, one emission.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(
      first.message,
      "1 marketplace operation failed.\n\n⊘ vanished [project] (failed) {not added}",
    );
  });
});

test("updateMarketplace: bare-form missing marketplace -> bracketless {not added} (SC#1)", async () => {
  // SC#1 cross-op convergence, bare form (no --scope): resolveScopeFromState
  // throws MarketplaceNotFoundError when absent from BOTH scopes; the pre-guard
  // catches it and routes to the bracketless standalone `(failed) {not added}`
  // variant. The call resolves WITHOUT rejection, proving the raw
  // MarketplaceNotFoundError no longer escapes the orchestrator boundary.
  await withHermeticHome(async ({ cwd }) => {
    // Leave state empty -- no marketplace named "ghost" in either scope.
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();

    await assert.doesNotReject(async () =>
      updateMarketplace({ ctx, pi, name: "ghost", cwd, gitOps }),
    );

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.message, "1 marketplace operation failed.\n\n⊘ ghost (failed) {not added}");
    assert.equal(first.severity, "error");
  });
});

test("validateManifestAtRoot: stale manifestPath and marketplaceRoot are corrected (lines 382-388)", async () => {
  // The conditional writes in validateManifestAtRoot update
  // record.manifestPath and record.marketplaceRoot only when they differ
  // from the canonical computed values.  Seed with stale paths, run
  // update, then re-read state and assert both fields were corrected.
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    const cloneDir = await locations.sourceCloneDir("stale-mp");
    await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });

    const staleManifestPath = path.join(cwd, "old-dir", ".claude-plugin", "marketplace.json");
    const staleMarketplaceRoot = path.join(cwd, "old-dir");

    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "stale-mp": {
          name: "stale-mp",
          scope: "project",
          source: makeGithubSource("main"),
          addedFromCwd: cwd,
          manifestPath: staleManifestPath,
          marketplaceRoot: staleMarketplaceRoot,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000011" },
    });

    await updateMarketplace({ ctx, pi, name: "stale-mp", scope: "project", cwd, gitOps });

    // No error -- update should have succeeded.
    const errNotif = notifications.find((n) => n.severity === "error");
    assert.equal(errNotif, undefined, `unexpected error: ${errNotif?.message}`);

    // Re-read state and confirm both stale paths were corrected.
    const afterState = await loadState(locations.extensionRoot);
    const record = afterState.marketplaces["stale-mp"];
    assert.ok(record !== undefined, "stale-mp record must still be in state");

    const expectedManifestPath = path.join(cloneDir, ".claude-plugin", "marketplace.json");
    assert.equal(
      record.manifestPath,
      expectedManifestPath,
      `manifestPath not updated: got ${record.manifestPath}`,
    );
    assert.equal(
      record.marketplaceRoot,
      cloneDir,
      `marketplaceRoot not updated: got ${record.marketplaceRoot}`,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AUTH-02: silent-reuse contract + auth bundle forwarding
//
// These tests lock the two halves of the AUTH-02 contract for marketplace
// update:
//   (a) When credentialOps.fill hits the keychain (post-add scenario),
//       Device Flow does NOT trigger and no "Open ..." notification is
//       emitted.
//   (b) The GitAuthBundle is forwarded by reference into refreshGitHubClone
//       (recorded on gitOps.fetch.auth), proving no re-bundling occurs.
// ───────────────────────────────────────────────────────────────────────────

test("AUTH-02 update: credentialOps.fill HIT yields silent reuse -- NO Device Flow notification emitted", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "private-mp", ref: "main" });
    const { ctx, pi, notifications } = makeCtx();

    // Pre-seed the credential store for github.com so fill() returns the
    // stored token without triggering Device Flow.
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps({
      store: new Map([["github.com", { username: "x-access-token", password: "stored-token" }]]),
    });

    const { gitOps, state } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000020" },
    });

    await updateMarketplace({
      ctx,
      pi,
      name: "private-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // AUTH-02: Device Flow must NOT fire when credentialOps.fill hits the
    // keychain. The "Open ..." notification is the Device Flow prompt; its
    // absence confirms the silent-reuse path.
    assert.equal(
      notifications.filter((n) => n.message.startsWith("Open ")).length,
      0,
      "AUTH-02: Device Flow notify must NOT fire when credentialOps.fill hits the keychain",
    );

    // The fetch was called exactly once and the auth bundle was forwarded.
    assert.equal(state.fetchCalls.length, 1);
    assert.ok(state.fetchCalls[0]?.auth !== undefined);
    assert.equal(state.fetchCalls[0]?.auth?.host, "github.com");
    assert.strictEqual(state.fetchCalls[0]?.auth?.credentialOps, credentialOps);

    // Exercise the closure end-to-end: buildAuthCallbacks reads the stored
    // credential via credentialOps.fill and returns it as the onAuth result.
    const fetchAuth = state.fetchCalls[0]?.auth;
    assert.ok(fetchAuth !== undefined);
    const cbs = buildAuthCallbacks(fetchAuth);
    const result = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.deepEqual(result, { username: "x-access-token", password: "stored-token" });
    // fill was called once (from the closure exercised above).
    assert.equal(credState.fillCalls.length, 1);
  });
});

test("AUTH-02 update: the GitAuthBundle is forwarded by reference into refreshGitHubClone (recorded on gitOps.fetch)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "ref-mp", ref: "main" });
    const { ctx, pi } = makeCtx();

    // Empty store: fill() returns null. Device Flow would normally trigger
    // when onAuth is invoked, but gitOps.fetch is a pure stub so the
    // callbacks are never called -- only the bundle reference is checked.
    const { credOps: credentialOps } = makeMockCredentialOps();

    const { gitOps, state } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000021" },
    });

    await updateMarketplace({
      ctx,
      pi,
      name: "ref-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // The auth bundle must be present on the recorded fetch call.
    assert.equal(state.fetchCalls.length, 1);
    assert.ok(state.fetchCalls[0]?.auth !== undefined);
    assert.equal(state.fetchCalls[0]?.auth?.host, "github.com");
    // Reference equality: the same credentialOps instance passed to
    // updateMarketplace must appear on the recorded fetch auth bundle --
    // proves no re-bundling occurred.
    assert.strictEqual(state.fetchCalls[0]?.auth?.credentialOps, credentialOps);
    assert.equal(typeof state.fetchCalls[0]?.auth?.onAuthRequired, "function");
  });
});

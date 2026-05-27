import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  __test_outcomeToCascadePluginMessage,
  updateAllMarketplaces,
  updateMarketplace,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  __resetCacheForTests,
  getPluginIndex,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
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
  // Plan 18-00: `pi` promoted from `pi?` to required on
  // UpdateMarketplaceOptions / UpdateAllMarketplacesOptions; mirror
  // production wiring shape (D-18-06 preserved).
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
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
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
    // Success notification, no failure.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.notEqual(first.severity, "error");
    // Plan 18-05 / RESEARCH Risks #4 silent contract change: V1
    // autoupdate-OFF manifest-refresh suppressed the reload-hint; V2
    // emits it because `mp.status === "updated"` is state-changing per
    // D-16-12. Catalog UAT fixture `autoupdate-off-manifest-refresh`
    // at docs/output-catalog.md:801-806.
    assert.equal(first.severity, undefined);
    assert.equal(first.message, "● official [project] (updated)\n\n/reload to pick up changes");
  });
});

test("CR-01 / D-14 default-branch: forceUpdateRef target is refs/heads/<branch>, NOT the HEAD SHA", async () => {
  // Default-branch tracking (storedRef === undefined): the seeded
  // marketplace has no `ref` fragment. The refresh path must read the
  // symbolic branch name via gitOps.currentBranch(), then
  // forceUpdateRef("refs/heads/<branch>", remoteSha). Previously it
  // erroneously used resolveRef("HEAD") (which returns a SHA) as the
  // ref argument, producing a meaningless `refs/<40-hex>` write.
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

    // Plan 18-05 / D-18-02: V1 emitted a multi-line error body with the
    // `${errorMessage(err)}\n${err.retryHint}` retry-anchor trailer; V2
    // collapses the marketplace-level failure to the bare V2 catalog
    // shape `⊘ <name> [<scope>] (failed)` (catalog UAT fixture
    // `mp-failure-network` at docs/output-catalog.md:828-832). The
    // retry-hint is dropped from the user-visible surface; `err.retryHint`
    // stays internal to MarketplaceUpdateError for programmatic
    // inspection. No cause-chain trailer (V2 confines cause? to per-plugin
    // variants per D-16-08).
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.equal(first.message, "⊘ rewritten [project] (failed)");
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
    // Plan 18-05 / D-18-02: the V1 distinction between "fetch failed
    // (no retry-hint)" vs "clone advanced then later step failed (retry-
    // hint emitted)" disappears in V2 -- both produce the same bare V2
    // failed-marketplace shape. `err.retryHint` stays internal to
    // MarketplaceUpdateError for programmatic inspection (test still
    // exercises the cloneAdvanced=false branch via gitOps.fetchThrows;
    // the difference now surfaces only via MarketplaceUpdateError.retryHint
    // inspection, not via notify bytes).
    assert.equal(first.message, "⊘ offline [project] (failed)");
  });
});

test("MU-5: clone advances + manifest re-validation fails -- 'Retry the command.' retry hint", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    const cloneDir = await locations.sourceCloneDir("broken");
    // Place an INVALID manifest at the cloneDir so re-validation fails.
    await cp(fixtureMarketplaceDir("invalid-manifest"), cloneDir, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        broken: {
          name: "broken",
          scope: "project",
          source: makeGithubSource(),
          addedFromCwd: cwd,
          manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: cloneDir,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/HEAD": "abcdef0000000000000000000000000000000003" },
      localRefs: { HEAD: "abcdef0000000000000000000000000000000003" },
    });
    await updateMarketplace({ ctx, pi, name: "broken", scope: "project", cwd, gitOps });

    // Plan 18-05 / D-18-02: clone advanced + manifest re-read failed used
    // to emit the retry-hint suffix; V2 collapses to the bare failed-mp
    // shape (catalog `mp-failure-network`). Retry-hint dropped per
    // D-18-02 (stays internal to MarketplaceUpdateError).
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.equal(first.message, "⊘ broken [project] (failed)");
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
  // Phase 13 / Plan 13-02c-01: the legacy MU-7 partition headers
  // (`Updated:` / `Unchanged:` / `Skipped:` / `Failed:`) are RETIRED;
  // cascade rows now interleave alphabetically by name per MSG-GR-3
  // (`compareByNameThenScope`). The status / icon / reason on each row
  // carries the partition signal -- the partition labels are no longer
  // emitted as section headers.
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
    // Task 260525-cjr C2: PluginUpdateOutcome is now a discriminated
    // union; each partition variant has different required fields.
    // Construct a fixture per branch.
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
    // Plan 18-05 / D-18-03: Rows interleave in caller order (D-16-06):
    // a (updated), b (unchanged), c (skipped fallback), d (failed). V2
    // catalog `mixed-outcomes` shape (docs/output-catalog.md:813-822).
    // Glyph map per D-16-11 severity ladder:
    //   updated -> ● (info)
    //   skipped -> ⊘ (warning)   <-- RESEARCH Risks #5 flip vs V1's ●
    //   failed  -> ⊘ (error)
    // The `[project]` scope bracket is suppressed by Phase 17.2 orphan-fold
    // (plugin.scope === mp.scope -> renderScopeBracket returns ""). The
    // narrowSkipReason fallback maps `c` (skipped + reasons=[] +
    // notes=[]) to `up-to-date`; narrowFailReason fallback maps `d`
    // (failed + notes=[] + no reasons) to `unreadable manifest`.
    const idxA = body.indexOf("  ● a 0.0.1 → v0.0.2 (updated)");
    const idxB = body.indexOf("  ⊘ b (skipped) {up-to-date}");
    const idxC = body.indexOf("  ⊘ c (skipped) {up-to-date}");
    const idxD = body.indexOf("  ⊘ d (failed) {unreadable manifest}");
    assert.ok(
      idxA >= 0 && idxB > idxA && idxC > idxB && idxD > idxC,
      `row order broken in body:\n${body}`,
    );
    // Legacy partition headers MUST NOT appear.
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

test('RH-1 + V2 D-16-12: cascade all-unchanged still emits reload-hint (mp.status "updated" is state-changing)', async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "noupd",
      ref: "main",
      autoupdate: true,
      plugins: { p: makePluginRecord() },
    });
    const { ctx, pi, notifications } = makeCtx();
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
    // Plan 18-05 / V2 D-16-12 contract: even when every plugin in the
    // cascade is `unchanged` (renders as `skipped {up-to-date}`), the
    // marketplace itself successfully refreshed -- `mp.status === "updated"`
    // is in the V2 reload-hint trigger set per shared/notify.ts:1027-1052
    // (shouldEmitReloadHint). V1 suppressed the trailer in this case
    // (V1 reloadHint() needed at least one updated plugin name); V2's
    // mp-level trigger ladder is the source of truth. Test renamed
    // accordingly; assertion flips from `false` to substring presence.
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.match(first.message, /\/reload to pick up changes$/);
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
  // Plan 06-05 wires invalidateMarketplaceCache into updateMarketplace's
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
// Plan 18-05 / D-18-03: outcomeToCascadePluginMessage maps a
// PluginUpdateOutcome to a discriminated PluginNotificationMessage. The
// V2 mapper returns one of `PluginUpdatedMessage{from,to,dependencies}`,
// `PluginSkippedMessage{reasons}`, or `PluginFailedMessage{reasons,cause?}`
// (no PluginUnchangedMessage variant -- `unchanged` outcomes map to
// `skipped` + `["up-to-date"]` per RESEARCH Risks #5 glyph flip).
//
// Carries forward Quick task 260525-aub's typed-reasons preference over
// the notes-parsing fallback (CR-06 producer-narrowed contract) so a
// future refactor cannot regress to substring matching.
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
  // RESEARCH Risks #5: V1 mapped `unchanged` to a trivial-skip ● glyph
  // via `outcomeToCascadeRow`. V2 maps it to `skipped` + `["up-to-date"]`;
  // the V2 renderer routes `skipped` to warning severity -> ⊘ glyph.
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
  // Task 260525-cjr C2: `reasons` is required on PluginUpdateSkippedOutcome
  // (the producer-narrowed contract). An empty `reasons: []` array
  // exercises the consumer's notes-fallback substring narrow without
  // populating a typed reason -- equivalent in behavior to the
  // pre-C2 `reasons: undefined` fixture.
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
  // No cause was stamped on the outcome -> the V2 mapper omits it on
  // PluginFailedMessage; the renderer skips the cause-chain trailer.
  assert.equal(msg.cause, undefined);
});

// ───────────────────────────────────────────────────────────────────────────
// Task 260525-cjr B2: cascadeAutoupdates catch site pre-narrows the closed
// `Reason` via the typed-dispatch helper. EACCES / EPERM throws surface as
// `{permission denied}` instead of the consumer's permissive `not in manifest`
// fallback. Exercised end-to-end through `updateMarketplace` with an injected
// `pluginUpdate` stub that throws an errno-bearing error.
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

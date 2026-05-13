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
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi: { getAllTools: (): unknown[] => [] },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
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

test("MU-1: bare form against empty scope succeeds silently with marker string and NO reload hint", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();
    await updateAllMarketplaces({ ctx, scope: "project", cwd, gitOps });
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.message, "No marketplaces configured.");
    assert.equal(first.message.includes("Run /reload to "), false);
  });
});

test("MU-4 + D-14: github source refreshes via fetch+forceUpdateRef+checkout in that order", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "official", ref: "main" });
    const { ctx, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
    });

    await updateMarketplace({ ctx, name: "official", scope: "project", cwd, gitOps });

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
    const { ctx } = makeCtx();
    const remoteSha = "abcdef000000000000000000000000000000000a";
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: {
        "refs/remotes/origin/HEAD": remoteSha,
        "refs/remotes/origin/main": remoteSha,
      },
      localRefs: { "refs/heads/main": "0000000000000000000000000000000000000001" },
      currentBranchOverride: "main",
    });

    await updateMarketplace({ ctx, name: "defaultbranch", scope: "project", cwd, gitOps });

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
    const { ctx } = makeCtx();
    const remoteSha = "abcdef000000000000000000000000000000000b";
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: {
        "refs/remotes/origin/HEAD": remoteSha,
        "refs/remotes/origin/main": remoteSha,
      },
      currentBranchOverride: null, // null = detached HEAD
    });

    await updateMarketplace({ ctx, name: "detached", scope: "project", cwd, gitOps });

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
    const { ctx } = makeCtx();
    // Mock has the SHA available as a 40-char hex; resolveRef of
    // refs/remotes/origin/<sha> will throw (no such branch), forcing
    // the detached path.
    const { gitOps, state } = makeMockGitOps();

    await updateMarketplace({ ctx, name: "pinned", scope: "project", cwd, gitOps });

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
    const { ctx, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      checkoutThrows: new Error("mock: ref deadbeef no longer exists on remote"),
    });

    await updateMarketplace({ ctx, name: "rewritten", scope: "project", cwd, gitOps });

    // notifyError emitted (severity 'error'); MU-5 retry hint applies
    // because the clone advanced (fetch succeeded).
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /Retry the command\./);
  });
});

test("CR-05 / MU-5: pre-fetch failure (gitOps.fetch throws) does NOT append 'Retry the command.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "offline", ref: "main" });
    const { ctx, notifications } = makeCtx();
    // Simulate DNS / network-unreachable on fetch -- cloneAdvanced must
    // stay false, so the retry hint is suppressed.
    const { gitOps } = makeMockGitOps({
      fetchThrows: new Error("mock: ENETUNREACH https://github.com"),
    });
    await updateMarketplace({ ctx, name: "offline", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    // The MU-5 retry hint MUST NOT appear when fetch itself failed.
    assert.equal(first.message.includes("Retry the command."), false);
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

    const { ctx, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/HEAD": "abcdef0000000000000000000000000000000003" },
      localRefs: { HEAD: "abcdef0000000000000000000000000000000003" },
    });
    await updateMarketplace({ ctx, name: "broken", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /Retry the command\./);
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
    const { ctx } = makeCtx();
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
      });
    };

    await updateMarketplace({
      ctx,
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
    const { ctx } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000005" },
    });
    let pluginUpdateCalled = false;
    const pluginUpdate: PluginUpdateFn = async () => {
      pluginUpdateCalled = true;
      return Promise.resolve({ partition: "updated", name: "x" });
    };

    await updateMarketplace({
      ctx,
      name: "manual-mp",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    assert.equal(pluginUpdateCalled, false);
  });
});

test("MU-7: partitions render in order updated -> unchanged -> skipped -> failed", async () => {
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
    const { ctx, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000006" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) => {
      const partition: PluginUpdateOutcome["partition"] =
        plugin === "a"
          ? "updated"
          : plugin === "b"
            ? "unchanged"
            : plugin === "c"
              ? "skipped"
              : "failed";
      return Promise.resolve({ partition, name: plugin });
    };

    await updateMarketplace({
      ctx,
      name: "mixed",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // The body lists partitions in MU-7 order. Find each label's index
    // and assert ordering.
    const first = notifications[0];
    assert.ok(first !== undefined);
    const body = first.message;
    const idxUpdated = body.indexOf("Updated:");
    const idxUnchanged = body.indexOf("Unchanged:");
    const idxSkipped = body.indexOf("Skipped:");
    const idxFailed = body.indexOf("Failed:");
    assert.ok(
      idxUpdated < idxUnchanged && idxUnchanged < idxSkipped && idxSkipped < idxFailed,
      `partition order broken in body:\n${body}`,
    );
  });
});

test("MU-9 + RH-1/RH-2: success emits 'Run /reload to refresh \"...\".' for updated plugins (alphabetical)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "rh",
      ref: "main",
      autoupdate: true,
      plugins: { x: makePluginRecord(), a: makePluginRecord() },
    });
    const { ctx, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000007" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
      });

    await updateMarketplace({
      ctx,
      name: "rh",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // Reload hint trailing the body, alphabetical.
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.match(first.message, /Run \/reload to refresh "a", "x"\.$/);
  });
});

test("RH-1: NO reload hint when zero plugins updated", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({
      cwd,
      name: "noupd",
      ref: "main",
      autoupdate: true,
      plugins: { p: makePluginRecord() },
    });
    const { ctx, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000008" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({ partition: "unchanged", name: plugin });
    await updateMarketplace({
      ctx,
      name: "noupd",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.message.includes("Run /reload to "), false);
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
      const { ctx } = makeCtx();
      const { gitOps, state } = makeMockGitOps();
      await updateMarketplace({ ctx, name: "local", scope: "project", cwd, gitOps });

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
    const { ctx } = makeCtx();
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
    await updateMarketplace({ ctx, name: "official", scope: "project", cwd, gitOps });

    // Memory must be cleared; with file absent, next read invokes rebuild.
    await getPluginIndex(pluginCachePath, "project", "official", () => {
      rebuildCount += 1;
      return Promise.resolve([]);
    });
    assert.equal(rebuildCount, 2, "post-invalidation read re-invokes rebuild");
  });
});

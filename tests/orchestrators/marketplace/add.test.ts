import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { addMarketplace } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  __resetCacheForTests,
  getMarketplaceNames,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../helpers/git-mock.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // Plan 18-00: `pi` is required on every marketplace orchestrator's
  // `*Options` interface. Mirror the production wiring shape so tests
  // can pass the same value the edge layer would. The empty
  // `getAllTools()` mirrors the existing makeCtx pattern (D-18-06).
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (msg: string, sev?: string): void => {
        notifications.push(sev === undefined ? { message: msg } : { message: msg, severity: sev });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}

async function withTmpScope<T>(
  fn: (env: { cwd: string; locations: ScopedLocations }) => Promise<T>,
): Promise<T> {
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-add-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  try {
    return await fn({ cwd, locations });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("MA-5: github source clones, validates, renames, mutates state, emits V2 success message with NO reload-hint trailer (SNM-33 / D-22-01)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // gitOps.clone called exactly once with correct URL.
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.equal(cloneCall.url, "https://github.com/anthropics/claude-plugins-official.git");

    // State has the recorded marketplace under the manifest's `name` field
    // (the fixture's `name` is "valid-marketplace").
    const persisted = await loadState(locations.extensionRoot);
    assert.ok("valid-marketplace" in persisted.marketplaces);
    const recorded = persisted.marketplaces["valid-marketplace"];
    assert.ok(recorded);
    assert.equal(recorded.scope, "project");

    // Exactly one notification, V2 byte-for-byte; default severity (info; no
    // 2nd arg per D-16-11).
    assert.equal(notifications.length, 1);
    const note = notifications[0];
    assert.ok(note);
    // SNM-33 / D-22-01: V2 catalog `<!-- catalog-state: github-source -->`
    // collapses github + path source onto one `(added)` shape. A marketplace
    // record is not a Pi-visible resource, so NO `/reload` trailer. The V1
    // `<autoupdate>` marker has moved off this surface onto the list header.
    assert.equal(note.message, "● valid-marketplace [project] (added)");
    assert.equal(note.severity, undefined);
    // SNM-33 / D-22-01: empty-plugins add never triggers the reload-hint.
    assert.equal(note.message.includes("/reload to pick up changes"), false);
  });
});

test("MA-5: github HTTPS source with #ref clones the canonical repo URL at that ref", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://github.com/anthropics/claude-plugins-official#main",
      gitOps,
    });

    assert.equal(state.cloneCalls.length, 1);
    assert.deepEqual(
      {
        url: state.cloneCalls[0]?.url,
        ref: state.cloneCalls[0]?.ref,
        singleBranch: state.cloneCalls[0]?.singleBranch,
      },
      {
        url: "https://github.com/anthropics/claude-plugins-official.git",
        ref: "main",
        singleBranch: true,
      },
    );
  });
});

test("MA-6: pre-existing non-empty sources/<name>/ throws StaleSourceCloneError", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    // Pre-create the final dir with a marker file so pathExists returns true.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    await mkdir(finalDir, { recursive: true });
    await writeFile(path.join(finalDir, ".stale"), "x");

    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await assert.rejects(
      addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      }),
      (err: unknown): err is StaleSourceCloneError => err instanceof StaleSourceCloneError,
    );
  });
});

test("MA-8: duplicate name in same scope throws MarketplaceDuplicateNameError", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps: gitOps1 } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // First add succeeds.
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps1,
    });

    const { gitOps: gitOps2 } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // Second add for same name throws.
    await assert.rejects(
      addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps: gitOps2,
      }),
      (err: unknown): err is MarketplaceDuplicateNameError =>
        err instanceof MarketplaceDuplicateNameError,
    );
  });
});

test("MA-9: invalid manifest after clone triggers cleanupStaging + appendLeakToError", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("invalid-manifest"),
    });

    let caught: unknown;
    try {
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });
    } catch (e) {
      caught = e;
    }

    // (1) Threw a manifest-related error.
    assert.ok(caught instanceof Error, "addMarketplace should throw on invalid manifest");

    // (2) The clone DID happen (NFR-5 not violated for github source).
    assert.equal(state.cloneCalls.length, 1);

    // (3) State rollback: no marketplace recorded (guard rolled back).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(
      Object.keys(persisted.marketplaces).length,
      0,
      "state must NOT contain the partial marketplace",
    );

    // (4) appendLeakToError ran: staging dir cleanup attempted, leak chain present.
    //     If cleanupStaging succeeded, the parent sources-staging/ dir is gone
    //     or contains no leftover uuid subdirs (this run's staging dir was removed).
    //     If cleanupStaging itself failed, err.message contains the canonical
    //     leak phrase from appendLeakToError.
    // MA-9 contract: either staging dir empty (cleanup succeeded) OR err.message reports leak.
    const sourcesStagingRoot = path.join(locations.extensionRoot, "sources-staging");
    const stagingExists = await pathExists(sourcesStagingRoot);
    if (stagingExists) {
      const remaining = await readdir(sourcesStagingRoot);
      const cleanupSucceeded = remaining.length === 0;
      const errMsg = caught instanceof Error ? caught.message : "";
      const leakReported = /staging.*leak|leak.*staging|orphan|leaked|additionally/i.test(errMsg);
      assert.ok(
        cleanupSucceeded || leakReported,
        `MA-9 contract: either staging dir empty (cleanup succeeded) or err.message reports leak. ` +
          `Got: stagingExists=${String(stagingExists)}, remaining=${JSON.stringify(remaining)}, msg=${errMsg}`,
      );
    }
    // If sources-staging dir doesn't exist at all, cleanup succeeded fully (acceptable).
  });
});

test("MA-10: unknown source kind throws with parser's reason", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps();

    await assert.rejects(
      addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "git@github.com:foo/bar.git",
        gitOps,
      }),
      (err: unknown): err is Error =>
        err instanceof Error && err.message.includes("Cannot add marketplace from"),
    );

    // NFR-5: unknown source NEVER reached gitOps.clone.
    assert.equal(state.cloneCalls.length, 0);
  });
});

test("NFR-5: path-source add never calls gitOps", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi, notifications } = makeCtx();
    // Set up a local marketplace fixture by copying the valid-marketplace fixture
    // into a non-pi-claude-marketplace location and pointing rawSource at it.
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-"));
    try {
      const fixtureSrc = fixtureMarketplaceDir("valid-marketplace");
      await cp(fixtureSrc, localMpDir, { recursive: true });

      const { gitOps, state } = makeMockGitOps();

      // Use absolute path so domain/source.ts classifies as path source.
      await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: localMpDir, gitOps });

      // Zero gitOps calls (NFR-5).
      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);

      // State updated; success notification emitted.
      const persisted = await loadState(locations.extensionRoot);
      assert.ok("valid-marketplace" in persisted.marketplaces);
      const note = notifications[0];
      assert.ok(note);
      // SNM-33 / D-22-01: V2 catalog `<!-- catalog-state: path-source -->`
      // emits the same `(added)` shape as github-source, with NO
      // `/reload` trailer (a marketplace record is not a Pi-visible
      // resource). The `<autoupdate>` marker is irrelevant here -- it no
      // longer appears on the (added) arm at all in V2.
      assert.equal(note.message, "● valid-marketplace [project] (added)");
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("MA-3: path source accepts a direct path to marketplace.json (not just the directory)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });
      const directManifestPath = path.join(localMpDir, ".claude-plugin", "marketplace.json");
      const { gitOps } = makeMockGitOps();

      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: directManifestPath,
        gitOps,
      });

      const persisted = await loadState(locations.extensionRoot);
      assert.ok("valid-marketplace" in persisted.marketplaces);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("MA-4: tilde paths are preserved verbatim in stored source.raw", async () => {
  // We don't actually resolve the tilde to a real homedir -- just verify
  // the parser's source.raw is preserved (the actual disk read happens
  // through ParsedSource.resolved, which expandTilde already handled).
  // This test documents the contract; the parser test in
  // tests/domain/source.test.ts is the deeper coverage.
  const { pathSource } = await import("../../../extensions/pi-claude-marketplace/domain/source.ts");
  const source = pathSource("~/projects/local-mp");
  assert.equal(source.raw, "~/projects/local-mp"); // verbatim
});

test("CR-02 / MA-4: ~/path is expanded against $HOME for the on-disk probe; source.raw stays verbatim", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi, notifications } = makeCtx();
    // Stand up a hermetic HOME containing the fixture so that
    // "~/projects/local-mp" resolves to a real directory.
    const originalHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), "mp-add-home-"));
    process.env.HOME = home;
    try {
      const tildeRelDir = path.join("projects", "local-mp");
      const localMpDir = path.join(home, tildeRelDir);
      await mkdir(path.dirname(localMpDir), { recursive: true });
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps, state } = makeMockGitOps();
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: `~/${tildeRelDir}`,
        gitOps,
      });

      // NFR-5: path source MUST NOT touch gitOps.
      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);

      // State updated; success notification emitted.
      const persisted = await loadState(locations.extensionRoot);
      assert.ok("valid-marketplace" in persisted.marketplaces);
      const recorded = persisted.marketplaces["valid-marketplace"];
      assert.ok(recorded);
      // SP-7 / MA-4: source.raw must keep the verbatim "~" form.
      const src = recorded.source as { kind: string; raw: string };
      assert.equal(src.raw, `~/${tildeRelDir}`);
      // marketplaceRoot is the EXPANDED on-disk path so update/list can read it.
      assert.equal(recorded.marketplaceRoot, localMpDir);

      const note = notifications[0];
      assert.ok(note);
      // SNM-33 / D-22-01: V2 collapses path-source onto the canonical
      // `(added)` shape; empty-plugins add never emits the reload-hint.
      assert.equal(note.message, "● valid-marketplace [project] (added)");
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      await rm(home, { recursive: true, force: true });
    }
  });
});

test("MA-2 / SC-5 / CMC-30: orchestrator accepts scope='project'; success row carries `[project]` scope bracket", async () => {
  // The edge layer (Phase 6) defaults --scope to "user". This test
  // confirms the orchestrator threads the value through verbatim.
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // Use project scope so we get a real tmp scope root; the assertion
    // is just that the scope is reflected in the success row's
    // `[<scope>]` token per the compact-line grammar (MSG-GR-1).
    await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: "owner/repo", gitOps });
    const note = notifications[0];
    assert.ok(note);
    assert.ok(note.message.includes("[project]"));
  });
});

test("D-03-INV :: add invalidates marketplace-names cache for the new scope", async () => {
  // Plan 06-05 wires invalidateMarketplaceNames + invalidateMarketplaceCache
  // into addMarketplace's post-state-commit window. To prove the invalidation
  // fires, we:
  //   1. __resetCacheForTests() to isolate from prior test pollution.
  //   2. Warm the in-memory marketplace-names map by calling
  //      getMarketplaceNames(...) once with a sentinel rebuild that returns
  //      a deliberately stale shape and writes the cache file.
  //   3. Run addMarketplace -- this MUST clear the in-memory entry and unlink
  //      the stale on-disk cache file.
  //   4. Call getMarketplaceNames again with a different rebuild that
  //      increments a counter; the increment proves memory was cleared
  //      and the file was removed, i.e. the orchestrator routed through the
  //      invalidation call site rather than rehydrating stale disk data.
  await withTmpScope(async ({ cwd, locations }) => {
    __resetCacheForTests();
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // Pre-warm: rebuild returns a stale shape so we can detect "served from
    // memory" vs. "rebuild ran again".
    let rebuildCount = 0;
    const cachePath = locations.marketplaceNamesCacheFile;
    await getMarketplaceNames(cachePath, "project", () => {
      rebuildCount += 1;
      return Promise.resolve(["stale-mp"]);
    });
    assert.equal(rebuildCount, 1, "initial warm-up triggers rebuild exactly once");

    // Sanity: second call served from memory (no rebuild).
    await getMarketplaceNames(cachePath, "project", () => {
      rebuildCount += 1;
      return Promise.resolve(["never-invoked"]);
    });
    assert.equal(rebuildCount, 1, "memory hit on second call -- no rebuild");

    // Run addMarketplace -- D-03-INV must fire invalidateMarketplaceNames.
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // Post-add: memory is dropped AND file is absent. The next read MUST
    // re-invoke the rebuild closure. Without disk invalidation, stale
    // marketplace-names.json would serve "stale-mp" and counter would stay 1.
    await getMarketplaceNames(cachePath, "project", () => {
      rebuildCount += 1;
      return Promise.resolve(["valid-marketplace"]);
    });
    assert.equal(rebuildCount, 2, "post-invalidation read re-invokes rebuild");
  });
});

// Lines 295-296: addPathInGuard throws when stat() reports neither file nor directory.
test("addPathInGuard: Unix domain socket path throws 'neither a file nor a directory'", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const socketPath = path.join(tmpdir(), `mp-add-sock-${process.pid}.sock`);
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.on("error", reject);
      server.listen(socketPath, resolve);
    });
    try {
      const { gitOps } = makeMockGitOps();
      await assert.rejects(
        addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: socketPath, gitOps }),
        (err: unknown): err is Error =>
          err instanceof Error && err.message.includes("neither a file nor a directory"),
      );
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      await unlink(socketPath).catch(() => {
        /* already gone */
      });
    }
  });
});

// Lines 305-306: addPathInGuard throws MarketplaceDuplicateNameError on second path-source add.
test("MA-8 (path source): duplicate name in same scope throws MarketplaceDuplicateNameError", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx: ctx1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-dup-path-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = makeMockGitOps();
      await addMarketplace({
        ctx: ctx1,
        pi: makeCtx().pi,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps();
      await assert.rejects(
        addMarketplace({
          ctx: ctx2,
          pi: makeCtx().pi,
          scope: "project",
          cwd,
          rawSource: localMpDir,
          gitOps: gitOps2,
        }),
        (err: unknown): err is MarketplaceDuplicateNameError =>
          err instanceof MarketplaceDuplicateNameError,
      );
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

// Lines 326-327: expandTildePath returns os.homedir() exactly when rawSource is bare '~'.
test("CR-02 / expandTildePath: bare '~' resolves to os.homedir() exactly", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    const originalHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), "mp-add-baretilde-"));
    process.env.HOME = home;
    try {
      // Copy valid-marketplace fixture directly into the hermetic HOME
      // so '~' (which resolves to home) is the marketplace root.
      await cp(fixtureMarketplaceDir("valid-marketplace"), home, { recursive: true });

      const { gitOps } = makeMockGitOps();
      await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: "~", gitOps });

      const persisted = await loadState(locations.extensionRoot);
      assert.ok("valid-marketplace" in persisted.marketplaces);
      const recorded = persisted.marketplaces["valid-marketplace"];
      assert.ok(recorded);
      // marketplaceRoot must be the hermetic HOME (os.homedir() at call time).
      assert.equal(recorded.marketplaceRoot, home);
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      await rm(home, { recursive: true, force: true });
    }
  });
});

// CMP-1: same marketplace name may exist independently in user and project scopes.
// The duplicate-name guard (MA-8) is scope-local only.
test("CMP-1: same marketplace name in user scope and project scope are independent (cross-scope add succeeds)", async () => {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "mp-add-cmp1-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    await withTmpScope(async ({ cwd }) => {
      const { ctx: ctx1, pi: pi1, notifications: n1 } = makeCtx();
      const { gitOps: gitOps1 } = makeMockGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      });
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps: gitOps1,
      });
      assert.equal(n1[0]?.severity, undefined, "project-scope add emits no error");

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      });
      // Same marketplace name but user scope -- MUST NOT throw MarketplaceDuplicateNameError.
      await addMarketplace({
        ctx: ctx2,
        pi: pi2,
        scope: "user",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps: gitOps2,
      });
      assert.equal(n2[0]?.severity, undefined, "user-scope add of same name emits no error");

      const projectState = await loadState(locationsFor("project", cwd).extensionRoot);
      const userState = await loadState(locationsFor("user", cwd).extensionRoot);
      assert.ok(
        projectState.marketplaces["valid-marketplace"] !== undefined,
        "project scope has record",
      );
      assert.ok(
        userState.marketplaces["valid-marketplace"] !== undefined,
        "user scope has independent record",
      );
    });
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
});

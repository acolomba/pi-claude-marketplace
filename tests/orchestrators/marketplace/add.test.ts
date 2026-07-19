import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { addMarketplace } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { buildAuthCallbacks } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import {
  __resetCacheForTests,
  getMarketplaceNames,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { MarketplaceDuplicateNameError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../../helpers/device-flow-mock.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../helpers/git-mock.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // `pi` is required on every marketplace orchestrator's
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

    // Exactly one notification, byte-for-byte; default severity (info; no
    // 2nd arg per D-16-11).
    assert.equal(notifications.length, 1);
    const note = notifications[0];
    assert.ok(note);
    // SNM-33 / D-22-01: the catalog collapses github + path source onto one
    // `(added)` shape. A marketplace record is not a Pi-visible resource, so
    // NO `/reload` trailer.
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

test("MA-6 / ATTR-07: pre-existing non-empty sources/<name>/ renders (failed) {stale clone} on the marketplace subject", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi, notifications } = makeCtx();
    // Pre-create the final dir with a marker file so pathExists returns true.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    await mkdir(finalDir, { recursive: true });
    await writeFile(path.join(finalDir, ".stale"), "x");

    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // ATTR-07: no raw throw -- the precondition routes through notify.
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    const note = notifications[0];
    assert.ok(note);
    // Post-manifest failure: subject is the derived marketplace name (A2).
    // notify() prepends the UXG-07 summary line for error severity.
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}",
    );
    assert.equal(note.severity, "error");
  });
});

test("MA-8 / ATTR-07: duplicate name in same scope renders (failed) {duplicate name}", async () => {
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

    const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
    const { gitOps: gitOps2 } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // ATTR-07: second add for same name routes through notify, no raw throw.
    await addMarketplace({
      ctx: ctx2,
      pi: pi2,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps2,
    });

    const note = n2[0];
    assert.ok(note);
    // Post-manifest failure: subject is the derived marketplace name (A2).
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {duplicate name}",
    );
    assert.equal(note.severity, "error");
  });
});

test("MA-9 / ATTR-07: invalid manifest after clone renders (failed) {invalid manifest}; cleanupStaging still runs", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("invalid-manifest"),
    });

    // ATTR-07: no raw throw escapes -- the precondition routes through notify.
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // (1) Routed through notify as a structured (failed) {invalid manifest} row.
    //     Pre-name failure (manifest unreadable, so no derived name) -> subject
    //     is the raw source string (A2).
    const note = notifications[0];
    assert.ok(note, "addMarketplace should notify on invalid manifest");
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n" +
        "⊘ anthropics/claude-plugins-official [project] (failed) {invalid manifest}",
    );
    assert.equal(note.severity, "error");

    // (2) The clone DID happen (NFR-5 not violated for github source).
    assert.equal(state.cloneCalls.length, 1);

    // (3) State rollback: no marketplace recorded (guard rolled back).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(
      Object.keys(persisted.marketplaces).length,
      0,
      "state must NOT contain the partial marketplace",
    );

    // (4) cleanupStaging from addGithubInGuard's catch STILL ran
    //     before the failed row was emitted -- no staging-dir leak. If
    //     cleanupStaging succeeded, the parent sources-staging/ dir is gone or
    //     contains no leftover uuid subdirs.
    const sourcesStagingRoot = path.join(locations.extensionRoot, "sources-staging");
    const stagingExists = await pathExists(sourcesStagingRoot);
    if (stagingExists) {
      const remaining = await readdir(sourcesStagingRoot);
      assert.equal(
        remaining.length,
        0,
        `MA-9: cleanupStaging must run before the failed row -- no staging leak. ` +
          `Got remaining=${JSON.stringify(remaining)}`,
      );
    }
    // If sources-staging dir doesn't exist at all, cleanup succeeded fully (acceptable).
  });
});

test("MA-10 / ATTR-07: unknown source kind renders (failed) {unsupported source}", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps();

    // ATTR-07: no raw throw -- the unsupported-source precondition routes
    // through notify on the raw source subject (pre-clone, pre-name -> A2).
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "git@github.com:foo/bar.git",
      gitOps,
    });

    const note = notifications[0];
    assert.ok(note);
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n" +
        "⊘ git@github.com:foo/bar.git [project] (failed) {unsupported source}",
    );
    assert.equal(note.severity, "error");

    // NFR-5: unsupported source NEVER reached gitOps.clone.
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
      // SNM-33 / D-22-01: a path-source add emits the same `(added)` shape
      // as github-source, with NO `/reload` trailer (a marketplace record is
      // not a Pi-visible resource). The `<autoupdate>` marker is irrelevant
      // here -- it does not appear on the (added) arm.
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
      // SNM-33 / D-22-01: path-source collapses onto the canonical
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
  // The edge layer defaults --scope to "user". This test
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
  // addMarketplace wires invalidateMarketplaceNames + invalidateMarketplaceCache
  // into its post-state-commit window. To prove the invalidation
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

// ATTR-07 (S5e): a path that exists but is neither a file nor a directory
// (a Unix domain socket) is an unusable source -> (failed) {source missing}.
test("ATTR-07: a Unix domain socket path renders (failed) {source missing}", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const socketPath = path.join(tmpdir(), `mp-add-sock-${process.pid}.sock`);
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.on("error", reject);
      server.listen(socketPath, resolve);
    });
    try {
      const { gitOps } = makeMockGitOps();
      await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: socketPath, gitOps });

      const note = notifications[0];
      assert.ok(note);
      // Pre-name failure (no readable manifest) -> subject is the raw source.
      assert.equal(
        note.message,
        `A marketplace operation has failed.\n\n⊘ ${socketPath} [project] (failed) {source missing}`,
      );
      assert.equal(note.severity, "error");
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

// ATTR-07 (S5e): a path source that does not exist (ENOENT) renders
// (failed) {source missing} on the raw source subject (pre-name).
test("ATTR-07: a missing path source (ENOENT) renders (failed) {source missing}", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const missingDir = path.join(tmpdir(), `mp-add-absent-${process.pid}-${Date.now()}`, "nope");
    const { gitOps, state } = makeMockGitOps();

    await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: missingDir, gitOps });

    const note = notifications[0];
    assert.ok(note);
    assert.equal(
      note.message,
      `A marketplace operation has failed.\n\n⊘ ${missingDir} [project] (failed) {source missing}`,
    );
    assert.equal(note.severity, "error");
    // NFR-5: a path source never touches gitOps.
    assert.equal(state.cloneCalls.length, 0);
  });
});

// ATTR-07 (path source): second path-source add of the same name renders the
// structured (failed) {duplicate name} row, not a raw throw.
test("MA-8 (path source) / ATTR-07: duplicate name in same scope renders (failed) {duplicate name}", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx: ctx1, pi: pi1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-dup-path-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = makeMockGitOps();
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps();
      await addMarketplace({
        ctx: ctx2,
        pi: pi2,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps2,
      });

      const note = n2[0];
      assert.ok(note);
      // Post-manifest failure -> subject is the derived marketplace name (A2).
      assert.equal(
        note.message,
        "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {duplicate name}",
      );
      assert.equal(note.severity, "error");
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

// expandTildePath returns os.homedir() exactly when rawSource is bare '~'.
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

// -----------------------------------------------------------------------
// AUTH-01 auth-wiring tests
// -----------------------------------------------------------------------

test("AUTH-01 add: credentialOps.fill HIT bypasses Device Flow and clones with the auth bundle", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();

    // Pre-seed a stored credential for github.com so fill returns a HIT.
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps({
      store: new Map([["github.com", { username: "x-access-token", password: "stored-token" }]]),
    });

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
      credentialOps,
    });

    // auth bundle must be forwarded to gitOps.clone.
    assert.equal(state.cloneCalls.length, 1);
    assert.ok(state.cloneCalls[0]?.auth !== undefined, "auth bundle must be present on clone call");

    // Verify bundle shape.
    const recordedAuth = state.cloneCalls[0].auth;
    assert.equal(recordedAuth.host, "github.com");
    assert.equal(
      recordedAuth.credentialOps,
      credentialOps,
      "credentialOps should be reference-equal",
    );

    // Exercise the recorded auth bundle: fill HIT returns the stored credential.
    const cbs = buildAuthCallbacks(recordedAuth);
    const result = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.deepEqual(result, { username: "x-access-token", password: "stored-token" });

    // fill consulted exactly once via the onAuth call above.
    assert.equal(credState.fillCalls.length, 1);
    assert.equal(credState.fillCalls[0]?.host, "github.com");

    // No Device Flow prompt emitted: only the post-add success notification.
    assert.equal(
      notifications.filter((n) => n.message.startsWith("Open ")).length,
      0,
      "Device Flow notifyFn must NOT fire on a fill HIT",
    );
  });
});

test("AUTH-01 add: credentialOps.fill MISS triggers Device Flow which produces a token via initiateDeviceFlow", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();

    // Empty store -> fill returns null (MISS).
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();

    // Device Flow http mock: immediate success poll.
    const { http: deviceFlowHttp } = makeMockDeviceFlowHttp({
      deviceCode: {
        device_code: "MOCK_DEVICE_CODE",
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0,
      },
      pollQueue: [
        {
          kind: "success",
          accessToken: "gho_test_token_AUTH01",
          tokenType: "bearer",
          scope: "repo",
        },
      ],
    });

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
      credentialOps,
      deviceFlowHttp,
    });

    // auth bundle must be forwarded.
    assert.equal(state.cloneCalls.length, 1);
    const recordedAuth = state.cloneCalls[0]?.auth;
    assert.ok(recordedAuth !== undefined, "auth bundle must be forwarded to gitOps.clone");

    // Exercise the miss path: buildAuthCallbacks -> fill miss -> onAuthRequired
    // -> initiateDeviceFlow (with the injected http mock) -> success.
    const cbs = buildAuthCallbacks(recordedAuth);
    const result = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.equal(
      result.password,
      "gho_test_token_AUTH01",
      "Device Flow must produce the mocked token",
    );

    // Device Flow notifyFn must have emitted the byte-exact catalog prompt.
    assert.ok(
      notifications.some(
        (n) =>
          n.message === "Open https://github.com/login/device and enter: ABCD-1234" &&
          n.severity === "info",
      ),
      "Device Flow must emit the exact catalog byte-form prompt with info severity",
    );

    // approve called once by initiateDeviceFlow on success.
    assert.equal(
      credState.approveCalls.length,
      1,
      "credentialOps.approve must be called on success",
    );

    // fill called once (the onAuth miss that triggered Device Flow).
    assert.equal(credState.fillCalls.length, 1, "fill called once on the onAuth miss");
    assert.equal(credState.fillCalls[0]?.host, "github.com");
  });
});

test("AUTH-01 add: the GitAuthBundle is forwarded by reference into gitOps.clone (no re-bundling)", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();

    const { credOps: credentialOps } = makeMockCredentialOps();

    const { http: deviceFlowHttp } = makeMockDeviceFlowHttp();

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
      credentialOps,
      deviceFlowHttp,
    });

    assert.equal(state.cloneCalls.length, 1);
    assert.equal(state.cloneCalls[0]?.auth?.host, "github.com");
    assert.equal(
      state.cloneCalls[0]?.auth?.credentialOps,
      credentialOps,
      "credentialOps must be reference-equal (no re-bundling)",
    );
    assert.equal(
      typeof state.cloneCalls[0]?.auth?.onAuthRequired,
      "function",
      "onAuthRequired must be a function",
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// RECON-03: orchestrated-mode coverage
// ───────────────────────────────────────────────────────────────────────────

test("RECON-03 orchestrated mode -- github source success returns { status: 'added' } with ZERO notify calls", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.ok(outcome, "orchestrated mode must return an outcome");
    assert.equal(outcome.status, "added");
    if (outcome.status === "added") {
      assert.equal(outcome.name, "valid-marketplace");
    }
  });
});

test("RECON-03 orchestrated mode -- unsupported source returns { status: 'failed', reason: 'unsupported source' } with ZERO notify calls", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps();

    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "git@github.com:foo/bar.git",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.equal(state.cloneCalls.length, 0, "NFR-5: unsupported source never touches gitOps");
    assert.ok(outcome);
    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
      assert.equal(outcome.reason, "unsupported source");
      assert.ok(outcome.error instanceof Error);
      assert.ok(typeof outcome.cause === "string" && outcome.cause.length > 0);
    }
  });
});

test("RECON-03 orchestrated mode -- duplicate-name (path source) returns typed MarketplaceDuplicateNameError, no notifications", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx: ctx1, pi: pi1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-dup-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = makeMockGitOps();
      // Seed the duplicate via a standalone add.
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps();
      const outcome = await addMarketplace({
        ctx: ctx2,
        pi: pi2,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps2,
        notifications: { mode: "orchestrated" },
      });

      assert.equal(n2.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(outcome.status, "failed");
      if (outcome.status === "failed") {
        assert.equal(outcome.reason, "duplicate name");
        assert.ok(outcome.error instanceof MarketplaceDuplicateNameError);
      }
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("RECON-03 orchestrated mode -- rethrowPreconditionErrors still rethrows typed precondition (bootstrap contract preserved)", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx: ctx1, pi: pi1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-rethrow-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = makeMockGitOps();
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps();

      await assert.rejects(
        addMarketplace({
          ctx: ctx2,
          pi: pi2,
          scope: "project",
          cwd,
          rawSource: localMpDir,
          gitOps: gitOps2,
          rethrowPreconditionErrors: true,
          notifications: { mode: "orchestrated" },
        }),
        (err: unknown) => err instanceof MarketplaceDuplicateNameError,
      );

      assert.equal(n2.length, 0, "orchestrated mode must not fire notifications");
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("RECON-03 standalone-default mode -- omitted notifications option remains byte-identical to today (regression guard)", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // The same call without `notifications` -- must return void and fire one
    // byte-identical notify, matching the standalone test at line 60.
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    assert.equal(outcome, undefined, "standalone (omitted) returns void");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.message, "● valid-marketplace [project] (added)");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WB-01 write-back, --local, WR-09, CFG-03
// ──────────────────────────────────────────────────────────────────────────

test("WB-01: standalone add writes the marketplace entry to claude-plugins.json (source verbatim)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
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

    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    const cfg = await loadConfig(locations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // PATTERNS §"Verbatim rawSource": source field MUST equal opts.rawSource
    // verbatim so the reconcile planner's `samePlannedSource` stays
    // a no-op on the next load.
    assert.equal(
      cfg.config.marketplaces?.["valid-marketplace"]?.source,
      "anthropics/claude-plugins-official",
    );

    // The local file MUST NOT have been touched on the base-target path.
    const localCfg = await loadConfig(locations.configLocalJsonPath);
    assert.equal(localCfg.status, "absent");
  });
});

test("WB-01: --local routes the write to claude-plugins.local.json and never touches the base file", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      local: true,
    });

    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    const localCfg = await loadConfig(locations.configLocalJsonPath);
    assert.equal(localCfg.status, "valid");
    if (localCfg.status === "valid") {
      assert.equal(
        localCfg.config.marketplaces?.["valid-marketplace"]?.source,
        "anthropics/claude-plugins-official",
      );
    }

    // The base file MUST be untouched.
    const baseCfg = await loadConfig(locations.configJsonPath);
    assert.equal(baseCfg.status, "absent");
  });
});

test("WR-09 / T-56-02-01: orchestrated-mode add SKIPS config write-back (neither base nor local file is created)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    assert.deepEqual(outcome, { status: "added", name: "valid-marketplace" });
    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
    assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
  });
});

test("CFG-03 / T-56-02-05: --local path with an invalid config aborts the add; basename-only cause; state untouched", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Seed an invalid claude-plugins.local.json (malformed JSON).
    const { writeFile } = await import("node:fs/promises");
    await writeFile(locations.configLocalJsonPath, "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      local: true,
    });

    // ATTR-07: classifyAddError routes ConfigInvalidError -> {invalid manifest}.
    assert.equal(notifications.length, 1);
    const note = notifications[0]!;
    assert.ok(
      note.message.includes("(failed) {invalid manifest}"),
      `expected (failed) {invalid manifest} row, got: ${note.message}`,
    );
    // T-56-02-05: the absolute path MUST NOT be leaked in the rendered cause.
    assert.ok(
      !note.message.includes(locations.configLocalJsonPath),
      `must NOT leak absolute configLocalJsonPath, got: ${note.message}`,
    );

    // State was NOT mutated (the marketplace record was never recorded).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(Object.keys(persisted.marketplaces).length, 0);
  });
});

test("WR-07: config write failure after the clone rename cleans up the final clone (retry never hits {stale clone})", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // Valid pre-existing config so the CFG-03 pre-check passes -- the
    // failure must land AFTER addGithubInGuard renamed the clone into its
    // final sources/<name>/ path.
    await writeFile(locations.configJsonPath, JSON.stringify({ schemaVersion: 1 }), "utf8");
    // Read-only scope root: saveConfig's tmp+rename write into scopeRoot
    // fails with EACCES, while everything under extensionRoot (state lock,
    // sources/, sources-staging/) stays writable.
    await chmod(locations.scopeRoot, 0o555);

    let threw = false;
    try {
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });
    } catch {
      threw = true;
    } finally {
      await chmod(locations.scopeRoot, 0o755);
    }

    // The command failed (either a classified failure row or a rethrow).
    assert.ok(
      threw || notifications.some((n) => n.severity === "error"),
      "config write failure must surface as a failure",
    );

    // WR-07: the committed final clone was cleaned up -- a retry must NOT
    // fail MA-6 {stale clone}.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    assert.equal(await pathExists(finalDir), false, "final clone must be removed on write failure");

    // State was NOT persisted (no tx.save() ran).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(Object.keys(persisted.marketplaces).length, 0);
  });
});

test("MURL-01: url source clones source.url VERBATIM with NO auth key in the clone options", async () => {
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
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
    });

    // D-76-06: the clone URL is source.url verbatim -- no github.com
    // reconstruction, and the parser canonicalized the trailing `.git` off.
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.equal(cloneCall.url, "https://gitlab.example.com/team/mp");
    // D-76-07: public-only -- the clone options object carries NO `auth` key.
    assert.equal(Object.hasOwn(cloneCall, "auth"), false);
    assert.equal(cloneCall.auth, undefined);
  });
});

test("MURL-01: url source with a #ref clones at that ref with singleBranch and still no auth", async () => {
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
      rawSource: "https://gitlab.example.com/team/mp#v1.0",
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
        url: "https://gitlab.example.com/team/mp",
        ref: "v1.0",
        singleBranch: true,
      },
    );
    // D-76-07: still no auth key even with a ref.
    assert.equal(Object.hasOwn(state.cloneCalls[0] ?? {}, "auth"), false);
  });
});

test("MURL-01: after a successful url add, state records source.kind === 'url' and the clone lands at sources/<name>/", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
    });

    const persisted = await loadState(locations.extensionRoot);
    const recorded = persisted.marketplaces["valid-marketplace"];
    assert.ok(recorded);
    assert.equal((recorded.source as { kind: string }).kind, "url");

    // The clone was renamed into its final sources/<derivedName>/ path.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    assert.ok(await pathExists(finalDir), "clone must land at sources/<derivedName>/");
  });
});

test("D-76-08: a url clone throwing an HttpError with statusCode 401 renders (failed) {authentication required}", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    // Duck-typed isomorphic-git HttpError shape: code === "HttpError",
    // data.statusCode carries the HTTP status.
    const httpErr = Object.assign(new Error("HTTP 401 from clone"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/private-mp",
      gitOps,
    });

    const note = notifications.find((n) => n.severity === "error");
    assert.ok(note, "401 clone challenge must render an error");
    assert.ok(
      note.message.includes("(failed) {authentication required}"),
      `expected authentication-required row, got: ${note.message}`,
    );
    // Must NOT misclassify as unparseable or network unreachable.
    assert.equal(note.message.includes("{unparseable}"), false);
    assert.equal(note.message.includes("{network unreachable}"), false);
  });
});

test("D-76-08: a url clone HttpError with statusCode 403 also renders (failed) {authentication required}", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const httpErr = Object.assign(new Error("HTTP 403 from clone"), {
      code: "HttpError",
      data: { statusCode: 403 },
    });
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/private-mp",
      gitOps,
    });

    const note = notifications.find((n) => n.severity === "error");
    assert.ok(note);
    assert.ok(note.message.includes("(failed) {authentication required}"));
  });
});

test("MURL-01 regression: github source is byte-identical -- Device Flow auth still constructed, cloneUrl still reconstructed", async () => {
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
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    // github: URL reconstructed to the canonical https://github.com/.git form.
    assert.equal(cloneCall.url, "https://github.com/anthropics/claude-plugins-official.git");
    // github: the Device Flow auth bundle IS constructed and passed through.
    assert.ok(cloneCall.auth, "github clone must carry an auth bundle");
    assert.equal(cloneCall.auth.host, "github.com");
    // Its callbacks are wired (buildAuthCallbacks-compatible shape).
    assert.equal(typeof cloneCall.auth.onAuthRequired, "function");
    assert.ok(
      buildAuthCallbacks({
        credentialOps: cloneCall.auth.credentialOps,
        host: cloneCall.auth.host,
        onAuthRequired: cloneCall.auth.onAuthRequired,
      }),
      "github auth bundle must be buildAuthCallbacks-compatible",
    );
  });
});

test("PROV-04 / D-79-03: a no-provider url add that 401s renders the bare (failed) {authentication required} row with NO cause line", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    // D-79-03: marketplace add keeps its no-child-rows invariant (D-01/D-10),
    // so the no-provider cause line renders ONLY on the update path's
    // cause-carrying child row -- the add row stays the bare closed-set token.
    const { credOps: credentialOps } = makeMockCredentialOps();
    const httpErr = Object.assign(new Error("HTTP 401 from clone"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/private-mp",
      gitOps,
      credentialOps,
    });

    const note = notifications.find((n) => n.severity === "error");
    assert.ok(note, "401 clone challenge must render an error");
    assert.ok(
      note.message.includes("(failed) {authentication required}"),
      `expected authentication-required row, got: ${note.message}`,
    );
    // NO cause trailer and NO no-provider line on the add surface (D-79-03).
    assert.equal(note.message.includes("no auth provider is registered"), false);
    assert.equal(note.message.includes("cause:"), false);
  });
});

test("PROV-02: a public no-provider url add clones authless -- no auth key, no credential interaction, no Device Flow prompt", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { http: deviceFlowHttp, state: httpState } = makeMockDeviceFlowHttp();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
      credentialOps,
      deviceFlowHttp,
    });

    // No provider for gitlab.example.com -> buildAuthForHost yields undefined
    // -> the clone call carries NO auth key at all (PROV-02).
    assert.equal(state.cloneCalls.length, 1);
    assert.equal(Object.hasOwn(state.cloneCalls[0] ?? {}, "auth"), false);
    // The public clone never touched the credential seam or the flow.
    assert.equal(credState.fillCalls.length, 0);
    assert.equal(httpState.requestCodeCalls.length, 0);
    assert.equal(
      notifications.filter((n) => n.message.startsWith("Open ")).length,
      0,
      "Device Flow prompt must NOT fire for a public no-provider url add",
    );
  });
});

test("PROV-01: a url add whose host case-folds to github.com carries the provider auth bundle on the clone", async () => {
  await withTmpScope(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const { credOps: credentialOps } = makeMockCredentialOps();

    // The case-sensitive github.com prefix check leaves this a `url` source,
    // but URL host parsing lowercases to github.com -- a provider-registered
    // host, so the url clone must thread the github auth bundle (unlike the
    // no-provider gitlab.example.com adds above).
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://GitHub.com/acme/mp",
      gitOps,
      credentialOps,
    });

    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.equal(cloneCall.url, "https://GitHub.com/acme/mp");
    assert.ok(cloneCall.auth, "provider-registered host must attach an auth bundle");
    assert.equal(cloneCall.auth.host, "github.com");
  });
});

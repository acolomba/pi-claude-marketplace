import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  __test_narrowCascadeFailure,
  removeMarketplace,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { atomicWriteJson } from "../../../extensions/pi-claude-marketplace/shared/atomic-json.ts";
import {
  __resetCacheForTests,
  getMarketplaceNames,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { MarketplaceNotFoundError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  const pi = {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function makePluginRecord(resources: Partial<PluginRecord["resources"]> = {}): PluginRecord {
  return {
    version: "0.0.1",
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: resources.skills ?? [],
      prompts: resources.prompts ?? [],
      agents: resources.agents ?? [],
      mcpServers: resources.mcpServers ?? [],
      hooks: resources.hooks ?? [],
    },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function seedState(extensionRoot: string, state: ExtensionState): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await saveState(extensionRoot, state);
}

/**
 * Hermetic home: override process.env.HOME for the duration of `fn`, then
 * restore. Lets us isolate user-scope state.json under a tmp root so the
 * test never reads or writes the developer's real ~/.pi/.
 */
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "mp-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

// MR-1 not-found ----------------------------------------------------

test("ATTR-06 (S4): --scope omitted + name not in either scope renders standalone `(failed) {not added}` with NO bracket (no raw throw)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-"));
    try {
      // No state seeded in either scope; the name will be absent.
      // ATTR-06 / D-48-C Shape 1: the bare-form resolveScopeFromState
      // MarketplaceNotFoundError is caught at the entrypoint and routed to the
      // standalone MarketplaceNotAddedMessage variant -- NOT thrown raw.
      const { ctx, pi, notifications } = makeCtx();
      await removeMarketplace({ ctx, pi, name: "absent-mp-zzz-9999", cwd });
      assert.equal(notifications.length, 1);
      // Bare form, absent from both scopes -> NO scope bracket. The standalone
      // not-added variant routes via isInfoKind -> error severity, no summary
      // prefix.
      assert.equal(
        notifications[0]!.message,
        "A marketplace operation has failed.\n\n⊘ absent-mp-zzz-9999 (failed) {not added}",
      );
      assert.equal(notifications[0]!.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-06 (S3): explicit --scope + name absent in that scope renders standalone `(failed) {not added}` WITH the scope bracket (no raw throw)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-s3-"));
    try {
      // No state seeded in the project scope; request an explicit project-scope
      // remove of a name not present there.
      const { ctx, pi, notifications } = makeCtx();
      await removeMarketplace({ ctx, pi, name: "ghost", scope: "project", cwd });
      assert.equal(notifications.length, 1);
      // Explicit scope -> the standalone variant carries the `[project]`
      // bracket. No raw MarketplaceNotFoundError escapes; state untouched.
      assert.equal(
        notifications[0]!.message,
        "A marketplace operation has failed.\n\n⊘ ghost [project] (failed) {not added}",
      );
      assert.equal(notifications[0]!.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// MR-1 ambiguous (dual-scope seed) ----------------------------------

test("MR-1: same name in both scopes without --scope removes project-scope record (CMP-5 precedence)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-mr1-"));
    try {
      const { ctx, pi, notifications } = makeCtx();

      const userLoc = locationsFor("user", cwd);
      const projLoc = locationsFor("project", cwd);

      const seed = {
        source: pathSource("./src"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: cwd,
        plugins: {},
      };
      await seedState(userLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: { "dup-name": { name: "dup-name", scope: "user", ...seed } },
      });
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: { "dup-name": { name: "dup-name", scope: "project", ...seed } },
      });

      // No --scope -> project-scope takes precedence (CMP-5).
      await removeMarketplace({ ctx, pi, name: "dup-name", cwd });

      const userAfter = await loadState(userLoc.extensionRoot);
      const projAfter = await loadState(projLoc.extensionRoot);
      assert.ok("dup-name" in userAfter.marketplaces, "user-scope record untouched");
      assert.ok(!("dup-name" in projAfter.marketplaces), "project-scope record removed");
      // SNM-33 / D-22-01 / D-22-02: an EMPTY marketplace remove (no plugins
      // staged) carries no `(uninstalled)` rows, so the body is header-only
      // with NO `/reload` trailer (G-MIL-02). The trailer fires only when at
      // least one plugin row carries a state-change token.
      assert.equal(notifications[0]?.message, "● dup-name [project] (removed)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MR-1: name only in user scope without --scope removes user-scope record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-mr1-user-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const userLoc = locationsFor("user", cwd);
      const projLoc = locationsFor("project", cwd);

      const seed = {
        source: pathSource("./src"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: cwd,
        plugins: {},
      };
      await seedState(userLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: { "user-only": { name: "user-only", scope: "user", ...seed } },
      });
      await seedState(projLoc.extensionRoot, { schemaVersion: 1, marketplaces: {} });

      await removeMarketplace({ ctx, pi, name: "user-only", cwd });

      const userAfter = await loadState(userLoc.extensionRoot);
      assert.ok(!("user-only" in userAfter.marketplaces), "user-scope record removed");
      // SNM-33 / D-22-01: empty remove (no plugins) is header-only, no trailer.
      assert.equal(notifications[0]?.message, "● user-only [user] (removed)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MR-1: same name in both scopes WITH --scope=user removes only user-scope record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-mr1b-"));
    try {
      const { ctx, pi } = makeCtx();
      const userLoc = locationsFor("user", cwd);
      const projLoc = locationsFor("project", cwd);

      const seed = {
        source: pathSource("./src"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: cwd,
        plugins: {},
      };
      await seedState(userLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: { "dup-name": { name: "dup-name", scope: "user", ...seed } },
      });
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: { "dup-name": { name: "dup-name", scope: "project", ...seed } },
      });

      await removeMarketplace({ ctx, pi, name: "dup-name", scope: "user", cwd });

      const userAfter = await loadState(userLoc.extensionRoot);
      const projAfter = await loadState(projLoc.extensionRoot);
      assert.equal("dup-name" in userAfter.marketplaces, false, "user-scope record removed");
      assert.ok("dup-name" in projAfter.marketplaces, "project-scope record retained");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// MR-2 + MR-8 (RH-1) -----------------------------------------------

test("MR-2 + SNM-33 / D-22-02: empty marketplace removed cleanly emits success with NO reload-hint (G-MIL-02)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          empty: {
            name: "empty",
            scope: "project",
            source: pathSource("./empty-source"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await removeMarketplace({ ctx, pi, name: "empty", scope: "project", cwd });

      const after = await loadState(locations.extensionRoot);
      assert.equal("empty" in after.marketplaces, false);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]!.severity, undefined); // success, default severity
      // SNM-33 / D-22-02 (G-MIL-02): an empty marketplace remove carries no
      // `(uninstalled)` rows, so the body is header-only with NO trailer. The
      // trailer is reserved for true Pi-visible state changes (plugin rows).
      assert.equal(notifications[0]!.message.includes("/reload to pick up changes"), false);
      // SNM-33 / D-22-02 clean form: bare `● <mp> [<scope>] (removed)` header.
      assert.equal(notifications[0]!.message, "● empty [project] (removed)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// MR-8 + MSG-RH-1 ---------------------------------------------------

test("MR-8 + MSG-RH-1: plugin whose skill is staged emits the canonical reload hint trailer", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-"));
    try {
      const locations = locationsFor("project", cwd);
      // Pre-stage a real skill at the bridge's expected location.
      const skillDir = path.join(locations.skillsTargetDir, "hello-greet");
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: hello-greet\n---\nbody\n");
      // Pre-stage another plugin's skill so we can confirm alphabetical order.
      const skill2Dir = path.join(locations.skillsTargetDir, "alpha-do");
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(path.join(skill2Dir, "SKILL.md"), "---\nname: alpha-do\n---\nbody\n");

      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              hello: makePluginRecord({ skills: ["hello-greet"] }),
              alpha: makePluginRecord({ skills: ["alpha-do"] }),
            },
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await removeMarketplace({ ctx, pi, name: "mp", scope: "project", cwd });

      assert.equal(notifications.length, 1);
      // MSG-RH-1: the canonical trailer no longer interpolates names.
      assert.match(notifications[0]!.message, /\/reload to pick up changes$/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// NFR-5 -------------------------------------------------------------

test("NFR-5: remove for a path-source marketplace makes no network calls", async () => {
  // The orchestrator does not even take a gitOps parameter -- remove
  // never touches network by construction. This test asserts the
  // contract by reading the source file and confirming no
  // import of platform/git or DEFAULT_GIT_OPS appears.
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts",
    "utf8",
  );
  assert.equal(src.includes("platform/git"), false);
  assert.equal(src.includes("DEFAULT_GIT_OPS"), false);
  assert.equal(src.includes("gitOps"), false);
});

// MR-4 (single cascade notification, severity=error) ------------

test("MR-4: cascade failure produces ONE V2 notification with severity=error (D-16-11)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "remove-mr4-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const locations = locationsFor("user", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // Seed a marketplace with two plugins.
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          "acme-mp": {
            name: "acme-mp",
            scope: "user",
            source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              "plugin-a": makePluginRecord(),
              "plugin-b": makePluginRecord(),
            },
          },
        },
      });

      // Inject a cascade stub: plugin-a deterministically fails;
      // plugin-b succeeds with empty dropped.
      const stubCascade: typeof cascadeUnstagePlugin = (pluginName) => {
        if (pluginName === "plugin-a") {
          return Promise.resolve({
            ok: false,
            dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
            cause: new Error("forced cascade failure for plugin-a"),
          });
        }

        return Promise.resolve({
          ok: true,
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
        });
      };

      await removeMarketplace({
        ctx,
        pi,
        name: "acme-mp",
        scope: "user",
        cwd,
        cascade: stubCascade,
      });

      // Exactly ONE notification, severity=error (any plugin/mp failed
      // routes to error per D-16-11; there is no free-text retry-anchor per
      // D-17-09 / D-18-03 -- it has no catalog representation).
      assert.equal(notifications.length, 1, "exactly one V2 notification");
      assert.equal(notifications[0]!.severity, "error", "severity must be error");

      // MR-7: record retained when any plugin failed.
      const after = await loadState(locations.extensionRoot);
      assert.ok("acme-mp" in after.marketplaces, "record retained when any plugin failed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// MR-7 retention + inverse -----------------------------------------

test("MR-7: github-source clone dir retained when any plugin failed in cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "remove-mr7-"));
    try {
      const { ctx, pi } = makeCtx();
      const locations = locationsFor("user", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // Seed: github-source marketplace + clone dir on disk + sentinel file inside.
      const cloneDir = await locations.sourceCloneDir("acme-mp");
      await mkdir(cloneDir, { recursive: true });
      await writeFile(path.join(cloneDir, "SENTINEL.txt"), "must not be deleted");

      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          "acme-mp": {
            name: "acme-mp",
            scope: "user",
            source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: { "plugin-a": makePluginRecord() },
          },
        },
      });

      // Stub cascade: force failure.
      const stubCascade: typeof cascadeUnstagePlugin = () =>
        Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
          cause: new Error("forced"),
        });

      await removeMarketplace({
        ctx,
        pi,
        name: "acme-mp",
        scope: "user",
        cwd,
        cascade: stubCascade,
      });

      // MR-7 behavioral assertion: clone dir AND sentinel still on disk.
      assert.ok(await pathExists(cloneDir), "clone dir must be retained when any plugin failed");
      assert.ok(
        await pathExists(path.join(cloneDir, "SENTINEL.txt")),
        "sentinel inside clone dir must still exist",
      );

      // Marketplace record also retained.
      const after = await loadState(locations.extensionRoot);
      assert.ok("acme-mp" in after.marketplaces, "record retained on failure");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MR-7 inverse: github-source clone dir REMOVED on full cascade success", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "remove-mr7b-"));
    try {
      const { ctx, pi } = makeCtx();
      const locations = locationsFor("user", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      const cloneDir = await locations.sourceCloneDir("acme-mp");
      await mkdir(cloneDir, { recursive: true });
      await writeFile(path.join(cloneDir, "SENTINEL.txt"), "should be deleted");

      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          "acme-mp": {
            name: "acme-mp",
            scope: "user",
            source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: { "plugin-a": makePluginRecord() },
          },
        },
      });

      const stubCascade: typeof cascadeUnstagePlugin = () =>
        Promise.resolve({
          ok: true,
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
        });

      await removeMarketplace({
        ctx,
        pi,
        name: "acme-mp",
        scope: "user",
        cwd,
        cascade: stubCascade,
      });

      // Inverse: full success -> clone dir cleaned up.
      assert.equal(await pathExists(cloneDir), false, "clone dir removed on full success");
      const after = await loadState(locations.extensionRoot);
      assert.equal("acme-mp" in after.marketplaces, false, "record removed on full success");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-03-INV :: remove unlinks the plugin cache file and invalidates marketplace-names", async () => {
  // removeMarketplace wires dropMarketplaceCache + invalidateMarketplaceNames
  // into its post-state-commit window. The plugin cache file
  // MUST be unlinked because the marketplace is gone (no rebuild path
  // can recover it); the marketplace-names cache file MUST also be unlinked
  // because the marketplace set changed. This test verifies BOTH limbs: the
  // on-disk plugin cache file disappears, AND marketplace-names does not
  // rehydrate stale disk data after memory is cleared.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "remove-d03inv-"));
    try {
      __resetCacheForTests();
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          "to-go": {
            name: "to-go",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });

      // Pre-create the plugin cache file via atomicWriteJson so the
      // dropMarketplaceCache call has something to unlink. The shape
      // matches PLUGIN_INDEX_CACHE_SCHEMA so a stray read+validate would
      // succeed; the test does NOT depend on the content surviving.
      const pluginCachePath = await locations.pluginCacheFile("to-go");
      await atomicWriteJson(pluginCachePath, {
        schemaVersion: 2,
        lastRefreshedAt: "2026-01-01T00:00:00.000Z",
        plugins: [],
      });
      assert.equal(
        await pathExists(pluginCachePath),
        true,
        "pre-test: cache file seeded successfully",
      );

      // Pre-warm the marketplace-names memory entry and disk file. Remove must
      // unlink this stale file; otherwise the post-invalidation read below
      // would serve ["to-go"] from disk without invoking the rebuild closure.
      const namesCachePath = locations.marketplaceNamesCacheFile;
      let namesRebuildCount = 0;
      await getMarketplaceNames(namesCachePath, "project", () => {
        namesRebuildCount += 1;
        return Promise.resolve(["to-go"]);
      });
      assert.equal(namesRebuildCount, 1, "pre-test: names cache warmed");

      const { ctx, pi } = makeCtx();
      await removeMarketplace({ ctx, pi, name: "to-go", scope: "project", cwd });

      // Plugin cache file MUST be absent (dropMarketplaceCache executed).
      assert.equal(
        await pathExists(pluginCachePath),
        false,
        "plugin cache file unlinked by dropMarketplaceCache",
      );

      assert.equal(
        await pathExists(namesCachePath),
        false,
        "marketplace-names cache file unlinked by invalidateMarketplaceNames",
      );

      // Marketplace-names memory and file cleared: next read forces rebuild.
      await getMarketplaceNames(namesCachePath, "project", () => {
        namesRebuildCount += 1;
        return Promise.resolve([]);
      });
      assert.equal(
        namesRebuildCount,
        2,
        "marketplace-names memory invalidated -- next read rebuilds",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Discriminated-dispatch regression guards on the per-plugin
// cascade-failure narrowing. Locks in the typed dispatch
// (`instanceof AgentsUnstageFailureError` + `NodeJS.ErrnoException.code`)
// so a future refactor cannot regress to message-text substring matching.
// ───────────────────────────────────────────────────────────────────────────

test("narrowCascadeFailure: NodeJS.ErrnoException code=EACCES -> {permission denied}", () => {
  // `permission denied` is in the closed REASONS set; this typed dispatch
  // produces it without substring matching English error text (which varies
  // across Node versions per NFR-4).
  const errnoLike = Object.assign(new Error("permission denied: /agents/foo.md"), {
    code: "EACCES",
  });
  assert.equal(__test_narrowCascadeFailure(errnoLike), "permission denied");
});

test("narrowCascadeFailure: NodeJS.ErrnoException code=ENOENT -> {source missing}", () => {
  const errnoLike = Object.assign(new Error("no such file"), { code: "ENOENT" });
  assert.equal(__test_narrowCascadeFailure(errnoLike), "source missing");
});

test("narrowCascadeFailure: AgentsUnstageFailureError -> {source mismatch} (ATTR-09 / D-NCF align with uninstall.ts)", () => {
  // D-NCF: foreign content owned by another process is a content/ownership
  // mismatch, not a manifest absence. Aligned with uninstall.ts's ATTR-09
  // mapping (`AgentsUnstageFailureError` -> `"source mismatch"`).
  const err = new AgentsUnstageFailureError("agents leak", [
    { generatedName: "foo", targetPath: "/agents/foo.md", reason: "EACCES" },
  ]);
  assert.equal(__test_narrowCascadeFailure(err), "source mismatch");
});

test("narrowCascadeFailure: arbitrary bare Error with 'unreadable' substring -> {unreadable} (defensive textual fallback)", () => {
  // The textual fallback is retained ONLY as a defense-in-depth last
  // resort for bridges that throw bare `Error`. Documented as transitional
  // in the implementation comment.
  const err = new Error("manifest file is unreadable");
  assert.equal(__test_narrowCascadeFailure(err), "unreadable");
});

test("narrowCascadeFailure: arbitrary bare Error with no recognizable text -> {not in manifest} (permissive default)", () => {
  const err = new Error("something else");
  assert.equal(__test_narrowCascadeFailure(err), "not in manifest");
});

// ───────────────────────────────────────────────────────────────────────────
// TR-03: cascade ghost-record correctness in the multi-plugin
// per-loop arm of removeMarketplace.
//
// Two regression tests cover the per-plugin partial-cascade-failure surface:
//   (a) non-AG-5 partial failure on one plugin while another succeeds:
//       the failed plugin's resources.* MUST be shrunken by outcome.dropped.*
//       and the record retained; the successful plugin MUST be deleted.
//   (b) AG-5 cause: the failed plugin's row MUST be preserved INTACT --
//       foreign content owned by another process must not cause data loss.
//
// Both tests stub the cascade and re-load state from disk after the
// orchestrator call to verify the mutation persisted.
// ───────────────────────────────────────────────────────────────────────────

test("TR-03 (non-AG-5 partial): failed plugin row filtered by outcome.dropped.*; successful plugin deleted", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "remove-tr03-partial-"));
    try {
      const { ctx, pi } = makeCtx();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // Seed two plugins; the FAILED plugin has 2 of each resource so the
      // filter is unambiguously observable, the SUCCESSFUL plugin has none.
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              "plugin-fail": makePluginRecord({
                skills: ["skill1", "skill2"],
                prompts: ["cmd1", "cmd2"],
                agents: ["agent1", "agent2"],
                mcpServers: ["mcp1", "mcp2"],
              }),
              "plugin-ok": makePluginRecord(),
            },
          },
        },
      });

      // Stub: plugin-fail drops {skill1} + {cmd1} then throws a non-AG-5
      // EACCES cause; plugin-ok succeeds with empty dropped.
      const stubCascade: typeof cascadeUnstagePlugin = (pluginName) => {
        if (pluginName === "plugin-fail") {
          const err = Object.assign(new Error("EACCES on agent unlink"), { code: "EACCES" });
          return Promise.resolve({
            ok: false,
            dropped: {
              skills: ["skill1"],
              commands: ["cmd1"],
              agents: [],
              hooks: [],
              mcpServers: [],
            },
            cause: err,
          });
        }

        return Promise.resolve({
          ok: true,
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
        });
      };

      await removeMarketplace({
        ctx,
        pi,
        name: "mp",
        scope: "project",
        cwd,
        cascade: stubCascade,
      });

      // (1) Re-load state from disk -- the marketplace record is RETAINED
      // (MR-7: any plugin failed -> marketplace stays). plugin-ok deleted;
      // plugin-fail kept as a SHRUNKEN row.
      const after = await loadState(locations.extensionRoot);
      const mp = after.marketplaces["mp"];
      assert.ok(mp !== undefined, "marketplace record retained when any plugin failed (MR-7)");
      assert.equal(
        "plugin-ok" in mp.plugins,
        false,
        "successful plugin deleted from record.plugins",
      );
      const failed = mp.plugins["plugin-fail"];
      assert.ok(failed !== undefined, "failed plugin row retained (shrunken)");
      // (2) Filtered axes -- dropped artifact names removed.
      assert.deepEqual(
        failed.resources.skills,
        ["skill2"],
        "resources.skills filtered: skill1 dropped, skill2 retained",
      );
      assert.deepEqual(
        failed.resources.prompts,
        ["cmd2"],
        "resources.prompts filtered via dropped.commands -> resources.prompts mapping",
      );
      // (3) Un-advanced axes -- nothing in outcome.dropped, nothing filtered.
      assert.deepEqual(
        failed.resources.agents,
        ["agent1", "agent2"],
        "resources.agents untouched (cascade did not advance past commands)",
      );
      assert.deepEqual(
        failed.resources.mcpServers,
        ["mcp1", "mcp2"],
        "resources.mcpServers untouched (cascade did not advance past commands)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("TR-03 (AG-5 cause): failed plugin row preserved INTACT in remove.ts per-plugin loop", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "remove-tr03-ag5-"));
    try {
      const { ctx, pi } = makeCtx();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // Seed: same shape as the partial test so the AG-5 preservation is
      // unambiguously visible vs. the partial-filter test above.
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              "plugin-fail": makePluginRecord({
                skills: ["skill1", "skill2"],
                prompts: ["cmd1", "cmd2"],
                agents: ["agent1", "agent2"],
                mcpServers: ["mcp1", "mcp2"],
              }),
            },
          },
        },
      });

      // Stub: cascade reports dropped {skill1, cmd1} but throws AG-5 --
      // the orchestrator MUST discard the filter and preserve the full
      // row (data-loss carve-out for foreign content).
      const stubCascade: typeof cascadeUnstagePlugin = () => {
        const err = new AgentsUnstageFailureError("foreign content at agent1", [
          { generatedName: "agent1", targetPath: "/agents/agent1.md", reason: "missing marker" },
        ]);
        return Promise.resolve({
          ok: false,
          dropped: {
            skills: ["skill1"],
            commands: ["cmd1"],
            agents: [],
            hooks: [],
            mcpServers: [],
          },
          cause: err,
        });
      };

      await removeMarketplace({
        ctx,
        pi,
        name: "mp",
        scope: "project",
        cwd,
        cascade: stubCascade,
      });

      // (1) Re-load state from disk. AG-5 must preserve the FULL row.
      const after = await loadState(locations.extensionRoot);
      const mp = after.marketplaces["mp"];
      assert.ok(mp !== undefined, "marketplace record retained when any plugin failed (MR-7)");
      const failed = mp.plugins["plugin-fail"];
      assert.ok(failed !== undefined, "plugin row retained (AG-5 preserves row)");
      // (2) Every axis untouched -- the cascade reported dropped.skills
      // + dropped.commands, but the orchestrator MUST discard the filter
      // on the AG-5 path (the row must be a faithful pre-cascade snapshot
      // so a retry has the complete resources.* history).
      assert.deepEqual(
        failed.resources.skills,
        ["skill1", "skill2"],
        "AG-5: resources.skills UNCHANGED (filter discarded on AG-5 cause)",
      );
      assert.deepEqual(
        failed.resources.prompts,
        ["cmd1", "cmd2"],
        "AG-5: resources.prompts UNCHANGED (filter discarded on AG-5 cause)",
      );
      assert.deepEqual(
        failed.resources.agents,
        ["agent1", "agent2"],
        "AG-5: resources.agents UNCHANGED",
      );
      assert.deepEqual(
        failed.resources.mcpServers,
        ["mcp1", "mcp2"],
        "AG-5: resources.mcpServers UNCHANGED",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// RECON-03: orchestrated-mode coverage
// ───────────────────────────────────────────────────────────────────────────

test("RECON-03 remove orchestrated mode -- clean success returns { status: 'removed', name, unstaged: [] } with ZERO notify calls", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-orch-ok-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const projLoc = locationsFor("project", cwd);
      const seed = {
        source: pathSource("./src"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: cwd,
        plugins: {},
      };
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: { "orch-mp": { name: "orch-mp", scope: "project", ...seed } },
      });

      const outcome = await removeMarketplace({
        ctx,
        pi,
        name: "orch-mp",
        scope: "project",
        cwd,
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(outcome.status, "removed");
      if (outcome.status === "removed") {
        assert.equal(outcome.name, "orch-mp");
        assert.deepEqual(outcome.unstaged, []);
      }

      const after = await loadState(projLoc.extensionRoot);
      assert.ok(!("orch-mp" in after.marketplaces), "state record removed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-03 remove orchestrated mode -- missing marketplace returns { status: 'failed', reason: 'not added', error: MarketplaceNotFoundError } no notifications", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-orch-na-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const outcome = await removeMarketplace({
        ctx,
        pi,
        name: "absent-xx",
        cwd,
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(outcome.status, "failed");
      if (outcome.status === "failed") {
        assert.equal(outcome.reason, "not added");
        assert.ok(outcome.error instanceof MarketplaceNotFoundError);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-03 remove orchestrated mode -- explicit --scope miss returns failed with MarketplaceNotFoundError (no notify)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-orch-na-scope-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const outcome = await removeMarketplace({
        ctx,
        pi,
        name: "ghost",
        scope: "project",
        cwd,
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(outcome.status, "failed");
      if (outcome.status === "failed") {
        assert.equal(outcome.reason, "not added");
        assert.ok(outcome.error instanceof MarketplaceNotFoundError);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("I1 / PR #51: orchestrated partial remove returns { status: 'partial' } carrying unstaged + per-plugin failures (one row per plugin, never a 1-of-N collapse)", async () => {
  // Pre-fix the orchestrated arm collapsed any per-plugin cascade failure to a
  // single { status: 'failed', reason } outcome -- losing both the
  // successfully-unstaged plugins (rendered nowhere) AND failures 2..N. After
  // the fix the orchestrated outcome carries `unstaged: readonly string[]`
  // AND `failed: readonly { name, reason }[]` so the reconcile cascade can
  // render N rows for N plugins.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-orch-partial-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const locations = locationsFor("user", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          "acme-mp": {
            name: "acme-mp",
            scope: "user",
            source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              "plugin-ok": makePluginRecord(),
              "plugin-fail-a": makePluginRecord(),
              "plugin-fail-b": makePluginRecord(),
            },
          },
        },
      });

      // Stub: plugin-ok succeeds, plugin-fail-a fails (EACCES), plugin-fail-b
      // fails (ENOENT). Caller-iteration order maps to plugins object order.
      const stubCascade: typeof cascadeUnstagePlugin = (pluginName) => {
        if (pluginName === "plugin-ok") {
          return Promise.resolve({
            ok: true,
            dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
          });
        }

        const code = pluginName === "plugin-fail-a" ? "EACCES" : "ENOENT";
        return Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
          cause: Object.assign(new Error(`forced ${code}`), { code }),
        });
      };

      const outcome = await removeMarketplace({
        ctx,
        pi,
        name: "acme-mp",
        scope: "user",
        cwd,
        cascade: stubCascade,
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(outcome.status, "partial", "orchestrated partial-cascade arm");
      if (outcome.status === "partial") {
        // Every successfully-unstaged plugin is carried.
        assert.deepEqual([...outcome.unstaged], ["plugin-ok"]);
        // Every failed plugin is carried with its closed-set reason.
        assert.equal(outcome.failed.length, 2);
        const failedByName: Record<string, string> = Object.fromEntries(
          outcome.failed.map((f) => [f.name, f.reason]),
        );
        assert.equal(failedByName["plugin-fail-a"], "permission denied");
        assert.equal(failedByName["plugin-fail-b"], "source missing");
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-03 remove standalone-default mode -- omitted notifications option remains byte-identical to today (regression guard)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-orch-default-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const projLoc = locationsFor("project", cwd);
      const seed = {
        source: pathSource("./src"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: cwd,
        plugins: {},
      };
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: { "byte-mp": { name: "byte-mp", scope: "project", ...seed } },
      });

      // No `notifications` option -- must behave EXACTLY as today.
      const outcome = await removeMarketplace({ ctx, pi, name: "byte-mp", scope: "project", cwd });
      assert.equal(outcome, undefined, "standalone (omitted) returns void");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● byte-mp [project] (removed)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// cascade write-back, --local, WR-09, CFG-03
// ──────────────────────────────────────────────────────────────────────────

test("WB-01: cascade removes the marketplace entry AND every plugin entry ending in @<mp>", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-cascade-"));
    try {
      const projLoc = locationsFor("project", cwd);
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp1: {
            name: "mp1",
            scope: "project",
            source: pathSource("./src1"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "m1.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });

      // Seed the config with: mp1 marketplace, mp2 marketplace (intact),
      // foo@mp1 plugin (must cascade away), bar@mp2 plugin (must SURVIVE).
      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        projLoc.configJsonPath,
        {
          schemaVersion: 1,
          marketplaces: { mp1: { source: "./src1" }, mp2: { source: "./src2" } },
          plugins: { "foo@mp1": { enabled: true }, "bar@mp2": { enabled: true } },
        },
        projLoc.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      await removeMarketplace({ ctx, pi, name: "mp1", scope: "project", cwd });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cfg = await loadConfig(projLoc.configJsonPath);
      assert.equal(cfg.status, "valid");
      if (cfg.status !== "valid") {
        return;
      }

      // mp1 removed; mp2 retained.
      assert.equal(cfg.config.marketplaces?.["mp1"], undefined);
      assert.deepEqual(cfg.config.marketplaces?.["mp2"], { source: "./src2" });

      // Plugin cascade: foo@mp1 removed; bar@mp2 retained.
      assert.equal(cfg.config.plugins?.["foo@mp1"], undefined);
      assert.deepEqual(cfg.config.plugins?.["bar@mp2"], { enabled: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01: --local routes the cascade to claude-plugins.local.json; base file untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-local-"));
    try {
      const projLoc = locationsFor("project", cwd);
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp1: {
            name: "mp1",
            scope: "project",
            source: pathSource("./src1"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "m1.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      // Base file retains mp1; the local file is the override carrying mp1.
      await saveConfig(
        projLoc.configJsonPath,
        { schemaVersion: 1, marketplaces: { mp1: { source: "./src1" } } },
        projLoc.scopeRoot,
      );
      await saveConfig(
        projLoc.configLocalJsonPath,
        { schemaVersion: 1, marketplaces: { mp1: { source: "./src1", autoupdate: true } } },
        projLoc.scopeRoot,
      );

      const { readFile, stat } = await import("node:fs/promises");
      const baseBytesBefore = await readFile(projLoc.configJsonPath, "utf8");
      const baseStatBefore = await stat(projLoc.configJsonPath);

      const { ctx, pi } = makeCtx();
      await removeMarketplace({ ctx, pi, name: "mp1", scope: "project", cwd, local: true });

      // Base file MUST be byte-identical.
      const baseBytesAfter = await readFile(projLoc.configJsonPath, "utf8");
      const baseStatAfter = await stat(projLoc.configJsonPath);
      assert.equal(baseBytesAfter, baseBytesBefore);
      assert.equal(baseStatAfter.mtimeMs, baseStatBefore.mtimeMs);

      // Local file has mp1 removed.
      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const localCfg = await loadConfig(projLoc.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.equal(localCfg.config.marketplaces?.["mp1"], undefined);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-09 / T-56-02-01: orchestrated remove SKIPS the cascade write-back; config untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-orch-"));
    try {
      const projLoc = locationsFor("project", cwd);
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp1: {
            name: "mp1",
            scope: "project",
            source: pathSource("./src1"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "m1.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        projLoc.configJsonPath,
        {
          schemaVersion: 1,
          marketplaces: { mp1: { source: "./src1" } },
          plugins: { "foo@mp1": { enabled: true } },
        },
        projLoc.scopeRoot,
      );

      const { readFile, stat } = await import("node:fs/promises");
      const bytesBefore = await readFile(projLoc.configJsonPath, "utf8");
      const statBefore = await stat(projLoc.configJsonPath);

      const { ctx, pi } = makeCtx();
      const outcome = await removeMarketplace({
        ctx,
        pi,
        name: "mp1",
        scope: "project",
        cwd,
        notifications: { mode: "orchestrated" },
      });
      assert.equal((outcome as { status: string }).status, "removed");

      // Config file byte-identical (no cascade fired).
      const bytesAfter = await readFile(projLoc.configJsonPath, "utf8");
      const statAfter = await stat(projLoc.configJsonPath);
      assert.equal(bytesAfter, bytesBefore);
      assert.equal(statAfter.mtimeMs, statBefore.mtimeMs);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CFG-03 / T-56-02-05: invalid local config aborts the remove; basename-only cause; state untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-cfg03-"));
    try {
      const projLoc = locationsFor("project", cwd);
      await seedState(projLoc.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp1: {
            name: "mp1",
            scope: "project",
            source: pathSource("./src1"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "m1.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });

      await writeFile(projLoc.configLocalJsonPath, "{ malformed json", "utf8");

      const { ctx, pi, notifications } = makeCtx();
      await removeMarketplace({
        ctx,
        pi,
        name: "mp1",
        scope: "project",
        cwd,
        local: true,
      });

      // CFG-03: failed row with `{invalid manifest}` reason; basename only.
      assert.ok(notifications.length >= 1);
      const note = notifications[0]!;
      assert.match(note.message, /\(failed\) \{invalid manifest\}/);
      // T-56-02-05: must NOT leak the absolute local config path.
      assert.ok(
        !note.message.includes(projLoc.configLocalJsonPath),
        `must NOT leak absolute path, got: ${note.message}`,
      );

      // State was NOT mutated: mp1 still recorded.
      const after = await loadState(projLoc.extensionRoot);
      assert.ok("mp1" in after.marketplaces);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

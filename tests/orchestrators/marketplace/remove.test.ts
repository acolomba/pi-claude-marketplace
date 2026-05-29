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
    },
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

test("MR-1: --scope omitted + name not in either scope throws MarketplaceNotFoundError", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-"));
    try {
      // No state seeded in either scope; the name will be absent.
      const { ctx, pi } = makeCtx();
      await assert.rejects(
        removeMarketplace({ ctx, pi, name: "absent-mp-zzz-9999", cwd }),
        (err: unknown) => err instanceof MarketplaceNotFoundError,
      );
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

// MR-4 (single V2 cascade notification, severity=error) ------------

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
            dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
            cause: new Error("forced cascade failure for plugin-a"),
          });
        }

        return Promise.resolve({
          ok: true,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
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

      // Exactly ONE V2 notification, severity=error (any plugin/mp failed
      // routes to error per D-16-11; the V1 free-text retry-anchor
      // ("Fix the underlying issue and retry.") is DROPPED per D-17-09 /
      // D-18-03 -- it has no V2 catalog representation).
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
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
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
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
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
  // Plan 06-05 wires dropMarketplaceCache + invalidateMarketplaceNames into
  // removeMarketplace's post-state-commit window. The plugin cache file
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
        schemaVersion: 1,
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
// Quick task 260525-aub: discriminated-dispatch regression guards on the
// per-plugin cascade-failure narrowing. Locks in the typed dispatch
// (`instanceof AgentsUnstageFailureError` + `NodeJS.ErrnoException.code`)
// so a future refactor cannot regress to message-text substring matching.
// ───────────────────────────────────────────────────────────────────────────

test("narrowCascadeFailure: NodeJS.ErrnoException code=EACCES -> {permission denied}", () => {
  // Phase 13 Wave 3 plan 13-03-01 added `permission denied` to the closed
  // REASONS set; this typed dispatch produces it without substring matching
  // English error text (which varies across Node versions per NFR-4).
  const errnoLike = Object.assign(new Error("permission denied: /agents/foo.md"), {
    code: "EACCES",
  });
  assert.equal(__test_narrowCascadeFailure(errnoLike), "permission denied");
});

test("narrowCascadeFailure: NodeJS.ErrnoException code=ENOENT -> {source missing}", () => {
  const errnoLike = Object.assign(new Error("no such file"), { code: "ENOENT" });
  assert.equal(__test_narrowCascadeFailure(errnoLike), "source missing");
});

test("narrowCascadeFailure: AgentsUnstageFailureError -> {not in manifest} (documented fallback)", () => {
  const err = new AgentsUnstageFailureError("agents leak", [
    { generatedName: "foo", targetPath: "/agents/foo.md", reason: "EACCES" },
  ]);
  assert.equal(__test_narrowCascadeFailure(err), "not in manifest");
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

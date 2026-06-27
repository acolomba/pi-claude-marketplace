// tests/orchestrators/edge-deps.test.ts
//
// Coverage suite for `orchestrators/edge-deps.ts::makeLocationsResolver`,
// the D-04 registration-glue helper that gives `edge/completions/` a
// scope-aware reader without crossing BLOCK C (edge -> persistence /
// edge -> domain). The resolver's four methods are exercised against a
// hermetic temp scope so all four call-site contracts (cache-path
// derivation, state projection, manifest read, ManifestSoftFailError
// soft-fail) are pinned end-to-end.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadMarketplaceManifest } from "../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { resolveStrict } from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
import { makeLocationsResolver } from "../../extensions/pi-claude-marketplace/orchestrators/edge-deps.ts";
import {
  classifyInstalledRecord,
  classifyManifestEntry,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { ManifestSoftFailError } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { PluginIndexRow } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

interface HermeticScope {
  readonly cwd: string;
  readonly cleanup: () => Promise<void>;
}

async function withHermeticProjectScope<T>(fn: (env: HermeticScope) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "edge-deps-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "edge-deps-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({
      cwd,
      cleanup: () => Promise.resolve(),
    });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }
  }
}

test("makeLocationsResolver: marketplaceNamesCachePath delegates to locationsFor for the requested scope", async () => {
  await withHermeticProjectScope(({ cwd }) => {
    const resolver = makeLocationsResolver(cwd);
    const projectPath = resolver.marketplaceNamesCachePath("project");
    const userPath = resolver.marketplaceNamesCachePath("user");

    assert.equal(projectPath, locationsFor("project", cwd).marketplaceNamesCacheFile);
    assert.equal(userPath, locationsFor("user", cwd).marketplaceNamesCacheFile);
    assert.notEqual(projectPath, userPath);
    return Promise.resolve();
  });
});

test("makeLocationsResolver: pluginCachePath returns the per-marketplace cache file for the requested scope", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    const resolver = makeLocationsResolver(cwd);
    const projectPath = await resolver.pluginCachePath("project", "my-mp");
    const userPath = await resolver.pluginCachePath("user", "my-mp");

    assert.equal(projectPath, await locationsFor("project", cwd).pluginCacheFile("my-mp"));
    assert.equal(userPath, await locationsFor("user", cwd).pluginCacheFile("my-mp"));
    assert.notEqual(projectPath, userPath);
  });
});

test("makeLocationsResolver: loadStateForScope projects state.json into marketplaces map", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    const projectLoc = locationsFor("project", cwd);
    await mkdir(projectLoc.extensionRoot, { recursive: true });

    const state: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        "test-mp": {
          name: "test-mp",
          scope: "project",
          source: { kind: "path", raw: "/tmp/test-src" },
          addedFromCwd: "/tmp",
          manifestPath: "/tmp/test-src/.claude-plugin/marketplace.json",
          marketplaceRoot: "/tmp/test-src",
          plugins: {
            p1: {
              version: "1.0.0",
              resolvedSource: "/tmp/test-src/plugins/p1",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
              enabled: true,
              installedAt: "2026-06-17T00:00:00Z",
              updatedAt: "2026-06-17T00:00:00Z",
            },
          },
        },
      },
    };
    await saveState(projectLoc.extensionRoot, state);

    const resolver = makeLocationsResolver(cwd);
    const loaded = await resolver.loadStateForScope("project");

    assert.deepEqual(Object.keys(loaded.marketplaces), ["test-mp"]);
    const mp = loaded.marketplaces["test-mp"];
    assert.ok(mp);
    assert.equal(mp.manifestPath, "/tmp/test-src/.claude-plugin/marketplace.json");
    assert.ok(mp.plugins);
    assert.ok("p1" in mp.plugins);
  });
});

test("makeLocationsResolver: loadStateForScope returns empty marketplaces when state.json is missing (ENOENT)", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    const resolver = makeLocationsResolver(cwd);
    const loaded = await resolver.loadStateForScope("project");
    assert.deepEqual(loaded.marketplaces, {});
  });
});

test("makeLocationsResolver: loadManifestForMarketplace throws ManifestSoftFailError when marketplace has no state record", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    const resolver = makeLocationsResolver(cwd);
    await assert.rejects(
      () => resolver.loadManifestForMarketplace("project", "not-recorded"),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSoftFailError);
        assert.ok(err.cause instanceof Error);
        assert.match(err.cause.message, /no state record/i);
        return true;
      },
    );
  });
});

test("makeLocationsResolver: loadManifestForMarketplace returns installed + available rows from manifest", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    // Lay out a path-source marketplace with one installable plugin tree.
    const srcRoot = await mkdtemp(path.join(tmpdir(), "edge-deps-src-"));
    const manifestDir = path.join(srcRoot, ".claude-plugin");
    await mkdir(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "fixture-mp",
        plugins: [
          { name: "installed-plug", source: "./plugins/installed-plug" },
          { name: "available-plug", source: "./plugins/available-plug" },
        ],
      }),
      "utf8",
    );

    // Stage the on-disk plugin tree for `available-plug` so resolveStrict
    // can find a plugin.json and report installable: true.
    const availPluginRoot = path.join(srcRoot, "plugins", "available-plug");
    await mkdir(path.join(availPluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(availPluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "available-plug", version: "2.0.0" }),
      "utf8",
    );

    // Seed state.json with the marketplace + one already-installed plugin.
    const projectLoc = locationsFor("project", cwd);
    await mkdir(projectLoc.extensionRoot, { recursive: true });
    const state: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        "fixture-mp": {
          name: "fixture-mp",
          scope: "project",
          source: { kind: "path", raw: srcRoot },
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: srcRoot,
          plugins: {
            "installed-plug": {
              version: "1.0.0",
              resolvedSource: path.join(srcRoot, "plugins", "installed-plug"),
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
              enabled: true,
              installedAt: "2026-06-17T00:00:00Z",
              updatedAt: "2026-06-17T00:00:00Z",
            },
          },
        },
      },
    };
    await saveState(projectLoc.extensionRoot, state);

    const resolver = makeLocationsResolver(cwd);
    const rows = await resolver.loadManifestForMarketplace("project", "fixture-mp");

    const rowsByName = new Map(rows.map((r) => [r.name, r]));
    assert.equal(rowsByName.size, 2);

    const installed = rowsByName.get("installed-plug");
    assert.ok(installed);
    assert.equal(installed.status, "installed");
    assert.equal(installed.version, "1.0.0");

    const available = rowsByName.get("available-plug");
    assert.ok(available);
    // `resolveStrict` against a freshly-staged plugin.json with no
    // compatibility flags resolves to `installable: true` -> "available".
    assert.equal(available.status, "available");
  });
});

test("makeLocationsResolver: loadManifestForMarketplace classifies a plugin without an on-disk tree as `unavailable`", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    // Manifest declares a plugin whose source directory does NOT exist;
    // resolveStrict throws -> resolver catches -> row is `unavailable`.
    const srcRoot = await mkdtemp(path.join(tmpdir(), "edge-deps-noplug-"));
    const manifestDir = path.join(srcRoot, ".claude-plugin");
    await mkdir(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "unav-mp",
        plugins: [{ name: "ghost-plug", source: "./plugins/ghost-plug" }],
      }),
      "utf8",
    );

    const projectLoc = locationsFor("project", cwd);
    await mkdir(projectLoc.extensionRoot, { recursive: true });
    const state: ExtensionState = {
      schemaVersion: 1,
      marketplaces: {
        "unav-mp": {
          name: "unav-mp",
          scope: "project",
          source: { kind: "path", raw: srcRoot },
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: srcRoot,
          plugins: {},
        },
      },
    };
    await saveState(projectLoc.extensionRoot, state);

    const resolver = makeLocationsResolver(cwd);
    const rows = await resolver.loadManifestForMarketplace("project", "unav-mp");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, "ghost-plug");
    assert.equal(rows[0]?.status, "unavailable");
  });
});

test("makeLocationsResolver: loadManifestForMarketplace wraps manifest-read failure as ManifestSoftFailError", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    // State references a manifest path that does NOT exist -> manifest
    // load throws ENOENT -> outer catch wraps as ManifestSoftFailError.
    const projectLoc = locationsFor("project", cwd);
    await mkdir(projectLoc.extensionRoot, { recursive: true });
    const state: ExtensionState = {
      schemaVersion: 1,
      marketplaces: {
        "missing-mp": {
          name: "missing-mp",
          scope: "project",
          source: { kind: "path", raw: "/tmp/never-existed" },
          addedFromCwd: cwd,
          manifestPath: "/tmp/never-existed/.claude-plugin/marketplace.json",
          marketplaceRoot: "/tmp/never-existed",
          plugins: {},
        },
      },
    };
    await saveState(projectLoc.extensionRoot, state);

    const resolver = makeLocationsResolver(cwd);
    await assert.rejects(
      () => resolver.loadManifestForMarketplace("project", "missing-mp"),
      (err: unknown) => err instanceof ManifestSoftFailError,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// LIST-02 / D-67-02: the bucketizer emits the FINER derived statuses via the
// SHARED classifier (installed | upgradable | force-installed |
// force-upgradable | available | unsupported | unavailable). The
// force-upgradable candidate resolve stays no-network (resolveStrict, NFR-5).
// ──────────────────────────────────────────────────────────────────────────

interface FixturePlugin {
  readonly name: string;
  /** Manifest entry (upgrade-candidate) version. */
  readonly manifestVersion?: string;
  /** Declare an unsupported component kind (lspServers) on the manifest entry. */
  readonly declaresUnsupported?: boolean;
  /** Create the on-disk plugin source tree (default true). `false` -> structural unavailable. */
  readonly onDisk?: boolean;
  /** Installed record (state-present). `compatUnsupported` non-empty -> force-installed. */
  readonly installed?: { readonly version: string; readonly compatUnsupported?: readonly string[] };
}

/**
 * Lay out a path-source marketplace (manifest + on-disk plugin trees + state)
 * in the hermetic project scope and return its roots. Mirrors the inline
 * fixtures above but parametrized over the finer-status shapes.
 */
async function layoutFixtureMarketplace(
  cwd: string,
  mpName: string,
  plugins: readonly FixturePlugin[],
): Promise<void> {
  const srcRoot = await mkdtemp(path.join(tmpdir(), `edge-deps-fix-${mpName}-`));
  const manifestDir = path.join(srcRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "marketplace.json");

  const manifestPlugins = plugins.map((p) => ({
    name: p.name,
    source: `./plugins/${p.name}`,
    ...(p.manifestVersion !== undefined && { version: p.manifestVersion }),
    ...(p.declaresUnsupported === true && { lspServers: { ls: {} } }),
  }));
  await writeFile(manifestPath, JSON.stringify({ name: mpName, plugins: manifestPlugins }), "utf8");

  for (const p of plugins) {
    if (p.onDisk === false) {
      continue;
    }

    const pluginRoot = path.join(srcRoot, "plugins", p.name);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: p.name,
        ...(p.manifestVersion !== undefined && { version: p.manifestVersion }),
      }),
      "utf8",
    );
  }

  const statePlugins: ExtensionState["marketplaces"][string]["plugins"] = {};
  for (const p of plugins) {
    if (p.installed === undefined) {
      continue;
    }

    const compatUnsupported = p.installed.compatUnsupported ?? [];
    statePlugins[p.name] = {
      version: p.installed.version,
      resolvedSource: path.join(srcRoot, "plugins", p.name),
      compatibility: {
        installable: compatUnsupported.length === 0,
        notes: [],
        supported: [],
        unsupported: [...compatUnsupported],
      },
      resources: {
        skills: [`${p.name}-skill`],
        prompts: [],
        agents: [],
        mcpServers: [],
        hooks: [],
      },
      enabled: true,
      installedAt: "2026-06-17T00:00:00Z",
      updatedAt: "2026-06-17T00:00:00Z",
    };
  }

  const projectLoc = locationsFor("project", cwd);
  await mkdir(projectLoc.extensionRoot, { recursive: true });
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      [mpName]: {
        name: mpName,
        scope: "project",
        source: { kind: "path", raw: srcRoot },
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: srcRoot,
        plugins: statePlugins,
      },
    },
  };
  await saveState(projectLoc.extensionRoot, state);
}

const FINER_STATUS_FIXTURE: readonly FixturePlugin[] = [
  // Clean installed at HEAD -> installed.
  { name: "inst", manifestVersion: "1.0.0", installed: { version: "1.0.0" } },
  // Clean record, newer clean candidate -> upgradable.
  { name: "upg", manifestVersion: "2.0.0", installed: { version: "1.0.0" } },
  // Clean record, newer candidate that resolves unsupported -> force-upgradable.
  {
    name: "fup",
    manifestVersion: "2.0.0",
    declaresUnsupported: true,
    installed: { version: "1.0.0" },
  },
  // Degraded record (persisted compatibility.unsupported) -> force-installed.
  {
    name: "forced",
    manifestVersion: "1.0.0",
    installed: { version: "1.0.0", compatUnsupported: ["lspServers"] },
  },
  // Not-installed, clean on-disk -> available.
  { name: "avail", manifestVersion: "3.0.0" },
  // Not-installed, declares unsupported -> unsupported (distinct from unavailable).
  { name: "unsup", manifestVersion: "3.0.0", declaresUnsupported: true },
  // Not-installed, no on-disk tree -> structural unavailable.
  { name: "gone", manifestVersion: "3.0.0", onDisk: false },
];

test("loadManifestForMarketplace: bucketizer emits the finer derived statuses via the shared classifier (D-67-02)", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    await layoutFixtureMarketplace(cwd, "finer-mp", FINER_STATUS_FIXTURE);

    const resolver = makeLocationsResolver(cwd);
    const rows = await resolver.loadManifestForMarketplace("project", "finer-mp");
    const statusByName = new Map(rows.map((r) => [r.name, r.status]));

    assert.equal(statusByName.get("inst"), "installed");
    assert.equal(statusByName.get("upg"), "upgradable");
    assert.equal(statusByName.get("fup"), "force-upgradable");
    assert.equal(statusByName.get("forced"), "force-installed");
    assert.equal(statusByName.get("avail"), "available");
    // The old `installable ? available : unavailable` collapse is gone:
    // `unsupported` is now emitted DISTINCTLY from structural `unavailable`.
    assert.equal(statusByName.get("unsup"), "unsupported");
    assert.equal(statusByName.get("gone"), "unavailable");
  });
});

test("D-67-02 / T-67-08 parity: the bucketizer rows equal the shared classifier on the SAME fixture (no provider-local reclassification)", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    await layoutFixtureMarketplace(cwd, "parity-mp", FINER_STATUS_FIXTURE);

    const resolver = makeLocationsResolver(cwd);
    const actual = await resolver.loadManifestForMarketplace("project", "parity-mp");
    const actualByName = new Map(actual.map((r) => [r.name, r.status]));

    // Independently re-derive the expected status for every manifest entry by
    // calling the SAME shared classifier `list` consumes against the same
    // no-network `resolveStrict` inputs. Any divergence between the completion
    // bucketizer and the shared classifier (== a divergence from `list`) fails
    // here -- the drift guard D-67-02 / T-67-08 requires.
    const state = await loadState(locationsFor("project", cwd).extensionRoot);
    const mp = state.marketplaces["parity-mp"];
    assert.ok(mp);
    const manifest = await loadMarketplaceManifest(mp.manifestPath);
    const installedNames = new Set(Object.keys(mp.plugins));

    const expectedByName = new Map<string, PluginIndexRow["status"]>();
    for (const [name, installed] of Object.entries(mp.plugins)) {
      const entry = manifest.plugins.find((p) => p.name === name);
      const upgradable = entry?.version !== undefined && entry.version !== installed.version;
      let resolved: Awaited<ReturnType<typeof resolveStrict>> | undefined;
      if (upgradable) {
        resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
      }

      expectedByName.set(
        name,
        classifyInstalledRecord(
          installed,
          upgradable ? { upgradable: true, resolved } : { upgradable: false },
        ),
      );
    }

    for (const entry of manifest.plugins) {
      if (installedNames.has(entry.name)) {
        continue;
      }

      let status: PluginIndexRow["status"];
      try {
        status = classifyManifestEntry(
          await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot }),
        );
      } catch {
        status = "unavailable";
      }

      expectedByName.set(entry.name, status);
    }

    assert.deepEqual(
      [...actualByName.entries()].sort(),
      [...expectedByName.entries()].sort(),
      "bucketizer must emit exactly what the shared classifier derives",
    );
  });
});

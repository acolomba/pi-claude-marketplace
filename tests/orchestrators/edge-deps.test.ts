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
import { __test_availableRowMessage } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import {
  classifyInstalledRecord,
  classifyManifestEntry,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts";
import { isRecordedButDisabled } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
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

test("makeLocationsResolver: an unsafe-named not-installed entry degrades to `unavailable` (resolveStrict throws, classifyNotInstalledPluginRow catch)", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    // A plugin name containing a path separator passes the string-typed
    // manifest schema but makes resolveStrict's `assertSafeName` throw with
    // no I/O. `classifyNotInstalledPluginRow`'s catch degrades the row to
    // `unavailable` -- the defensive path distinct from a structural
    // (missing-dir) `unavailable` resolution, which returns without throwing.
    const srcRoot = await mkdtemp(path.join(tmpdir(), "edge-deps-badname-"));
    const manifestDir = path.join(srcRoot, ".claude-plugin");
    await mkdir(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "bad-mp",
        plugins: [{ name: "bad/name", source: "./bad" }],
      }),
      "utf8",
    );

    const projectLoc = locationsFor("project", cwd);
    await mkdir(projectLoc.extensionRoot, { recursive: true });
    const state: ExtensionState = {
      schemaVersion: 1,
      marketplaces: {
        "bad-mp": {
          name: "bad-mp",
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
    const rows = await resolver.loadManifestForMarketplace("project", "bad-mp");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, "bad/name");
    assert.equal(rows[0]?.status, "unavailable");
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
  /**
   * Mark the installed record recorded-but-disabled (ENBL-02): `enabled: false`
   * with `installable: true`. The canonical `isRecordedButDisabled` marker.
   */
  readonly disabled?: boolean;
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
      enabled: p.disabled !== true,
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
  // WR-01: recorded-but-disabled (enabled:false, installable:true) record whose
  // manifest version drifted (1.0.0 installed vs 2.0.0 manifest). The version
  // pin is frozen while disabled (ENBL-02), so the shared classifier collapses
  // it to `installed` -- NOT `upgradable` -- so it never leaks into the
  // `update --force` candidate set while `list` renders it `(disabled)`.
  {
    name: "disabled-drift",
    manifestVersion: "2.0.0",
    disabled: true,
    installed: { version: "1.0.0" },
  },
  // WR-02: degraded record (partially-installed) with a newer candidate that
  // resolves CLEAN -> force-installed-upgradable (a supported upgrade promotes
  // it back to installed; offerable under `update --force`).
  {
    name: "forced-upg",
    manifestVersion: "2.0.0",
    installed: { version: "1.0.0", compatUnsupported: ["lspServers"] },
  },
  // WR-02: degraded record with a newer candidate that ALSO resolves
  // unsupported -> force-installed-upgradable (force re-applied at the newer
  // version; still offerable under `update --force`).
  {
    name: "forced-upg-unsup",
    manifestVersion: "2.0.0",
    declaresUnsupported: true,
    installed: { version: "1.0.0", compatUnsupported: ["lspServers"] },
  },
  // WR-02: degraded record whose newer candidate has no on-disk tree
  // (structural unavailable) -> stays plain force-installed (nothing
  // installable to move to; NOT offered under `update --force`).
  {
    name: "forced-upg-gone",
    manifestVersion: "2.0.0",
    onDisk: false,
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
    assert.equal(statusByName.get("fup"), "partially-upgradable");
    assert.equal(statusByName.get("forced"), "partially-installed");
    // WR-01: a disabled + version-drifted record classifies `installed` (the
    // frozen-pin collapse), never `upgradable` -- so it cannot leak into the
    // `update --force` candidate set while `list` renders it `(disabled)`.
    assert.equal(statusByName.get("disabled-drift"), "installed");
    // WR-02: a force-installed record with a newer, non-unavailable candidate
    // derives the distinct `force-installed-upgradable` (offered under
    // `update --force`); a structural-unavailable candidate keeps it plain
    // `force-installed`.
    assert.equal(statusByName.get("forced-upg"), "partially-installed-upgradable");
    assert.equal(statusByName.get("forced-upg-unsup"), "partially-installed-upgradable");
    assert.equal(statusByName.get("forced-upg-gone"), "partially-installed");
    assert.equal(statusByName.get("avail"), "available");
    // The old `installable ? available : unavailable` collapse is gone:
    // `unsupported` is now emitted DISTINCTLY from structural `unavailable`.
    assert.equal(statusByName.get("unsup"), "partially-available");
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
    // calling the SAME shared classifier against the same no-network
    // `resolveStrict` inputs. This proves the bucketizer holds NO provider-local
    // reclassification -- it emits exactly what the shared classifier derives.
    // (List parity for the disabled-record case -- where `list` applies
    // `isRecordedButDisabled` ahead of the classifier -- is proven separately in
    // the WR-01 test below, since `bucketizer == classifier` alone does not
    // exercise that pre-classifier guard.)
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

// ──────────────────────────────────────────────────────────────────────────
// PURL-08 / D-78-03: git-source parity fixtures. The path-source fixtures above
// never exercised the git-source short-circuit -- which is exactly why the
// completion bucketizer's `unavailable` misclassification went undetected. A
// not-fetched git-source entry has nothing on disk to validate, so it must
// classify `remote` (RSTA-01) on BOTH surfaces.
// ──────────────────────────────────────────────────────────────────────────

interface GitSourcePlugin {
  readonly name: string;
  /** A git source string (url / git-subdir / github shorthand). */
  readonly source: string;
  readonly version?: string;
}

/**
 * Lay out a marketplace whose manifest carries git-source entries with NO
 * on-disk plugin trees and NO installed records. Returns the marketplace root so
 * a caller (the list-surface parity check) can re-read the manifest.
 */
async function layoutGitSourceMarketplace(
  cwd: string,
  mpName: string,
  plugins: readonly GitSourcePlugin[],
): Promise<{ readonly marketplaceRoot: string; readonly manifestPath: string }> {
  const srcRoot = await mkdtemp(path.join(tmpdir(), `edge-deps-git-${mpName}-`));
  const manifestDir = path.join(srcRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "marketplace.json");

  const manifestPlugins = plugins.map((p) => ({
    name: p.name,
    source: p.source,
    ...(p.version !== undefined && { version: p.version }),
  }));
  await writeFile(manifestPath, JSON.stringify({ name: mpName, plugins: manifestPlugins }), "utf8");

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
        plugins: {},
      },
    },
  };
  await saveState(projectLoc.extensionRoot, state);
  return { marketplaceRoot: srcRoot, manifestPath };
}

const GIT_SOURCE_FIXTURE: readonly GitSourcePlugin[] = [
  { name: "url-plug", source: "https://example.com/plugin.git", version: "1.0.0" },
  {
    name: "subdir-plug",
    source: "https://example.com/repo.git#main:packages/plug",
    version: "1.0.0",
  },
  { name: "gh-plug", source: "owner/repo", version: "1.0.0" },
  { name: "path-plug", source: "./plugins/path-plug", version: "1.0.0" },
];

test("RSTA-01: a not-fetched url/git-subdir/github manifest entry is emitted `remote` by the completion bucketizer (install completion still offers it -- install performs the fetch)", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    await layoutGitSourceMarketplace(cwd, "git-mp", GIT_SOURCE_FIXTURE);

    const resolver = makeLocationsResolver(cwd);
    const rows = await resolver.loadManifestForMarketplace("project", "git-mp");
    const statusByName = new Map(rows.map((r) => [r.name, r.status]));

    // RSTA-01: a not-fetched git source with nothing materialized locally
    // classifies `remote` (no over-claimed `available`). Install completion
    // still offers `remote` (INSTALL_STATUSES), since install performs the fetch.
    assert.equal(statusByName.get("url-plug"), "remote");
    assert.equal(statusByName.get("subdir-plug"), "remote");
    assert.equal(statusByName.get("gh-plug"), "remote");
    // The path entry has no on-disk tree -> structural unavailable (control).
    assert.equal(statusByName.get("path-plug"), "unavailable");
  });
});

test("RSTA-01 output-parity: the completion bucketizer emits `remote` for not-fetched git sources; the non-git buckets stay at parity with the list row builder", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    const { marketplaceRoot } = await layoutGitSourceMarketplace(
      cwd,
      "parity-git-mp",
      GIT_SOURCE_FIXTURE,
    );

    // Surface 1: the completion bucketizer (routes through the shared
    // presence-derived `probeManifestEntry`).
    const resolver = makeLocationsResolver(cwd);
    const bucketizerRows = await resolver.loadManifestForMarketplace("project", "parity-git-mp");
    const bucketizerByName = new Map(bucketizerRows.map((r) => [r.name, r.status]));

    // Surface 2: the list row builder. `availableRowMessage` emits `message.status`
    // in the not-installed status vocabulary the bucketizer uses.
    const manifest = await loadMarketplaceManifest(
      path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    );
    const listLocations = locationsFor("project", cwd);
    const listByName = new Map<string, PluginIndexRow["status"]>();
    for (const entry of manifest.plugins) {
      const { message } = await __test_availableRowMessage(entry, marketplaceRoot, listLocations);
      listByName.set(entry.name, message.status);
    }

    // The path control stays `unavailable` everywhere.
    assert.equal(listByName.get("path-plug"), "unavailable");
    assert.equal(bucketizerByName.get("path-plug"), "unavailable");

    // RSTA-03 output-parity drift-guard extended to the `remote` bucket: BOTH
    // the list row builder and the completion bucketizer classify a not-fetched
    // git source `remote` -- the consolidation onto the shared presence-derived
    // classification makes this parity structural, not incidental.
    for (const name of ["url-plug", "subdir-plug", "gh-plug"]) {
      assert.equal(bucketizerByName.get(name), "remote", `completion must classify ${name} remote`);
      assert.equal(listByName.get(name), "remote", `list must classify ${name} remote`);
    }
  });
});

test("WR-01: a disabled + version-drifted plugin -- `list` renders `(disabled)`, the bucketizer classifies `installed` (not offered under update --force)", async () => {
  await withHermeticProjectScope(async ({ cwd }) => {
    await layoutFixtureMarketplace(cwd, "wr01-mp", FINER_STATUS_FIXTURE);

    // The completion bucketizer routes the disabled guard through the shared
    // classifier, so a disabled record (version pin frozen, ENBL-02) lands in
    // `installed` -- NEVER `upgradable`/`force-upgradable`, the only statuses the
    // `update --force` candidate set (FORCE_UPDATE_STATUSES) admits.
    const resolver = makeLocationsResolver(cwd);
    const rows = await resolver.loadManifestForMarketplace("project", "wr01-mp");
    const disabledRow = rows.find((r) => r.name === "disabled-drift");
    assert.ok(disabledRow);
    assert.equal(disabledRow.status, "installed");
    assert.notEqual(disabledRow.status, "upgradable");
    assert.notEqual(disabledRow.status, "partially-upgradable");

    // The SAME record satisfies the pre-classifier guard `list` applies, so
    // `list` renders the distinct `(disabled)` token. The two surfaces agree:
    // disabled on `list`, frozen-`installed` in completion -- never a candidate
    // for `update --force`. This is the parity `bucketizer == classifier` alone
    // cannot prove (the reviewer's WR-01 finding).
    const state = await loadState(locationsFor("project", cwd).extensionRoot);
    const record = state.marketplaces["wr01-mp"]?.plugins["disabled-drift"];
    assert.ok(record);
    assert.equal(isRecordedButDisabled(record), true);
  });
});

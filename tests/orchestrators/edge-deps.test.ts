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

import { makeLocationsResolver } from "../../extensions/pi-claude-marketplace/orchestrators/edge-deps.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { ManifestSoftFailError } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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

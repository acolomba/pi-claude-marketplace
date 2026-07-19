// tests/orchestrators/plugin/clone-gc-errors.test.ts
//
// PURL-05 / D-78-01 error and edge arms of the clone GC, complementing
// clone-gc.test.ts:
//   - a NON-ENOENT readdir failure must rethrow (only a missing cache dir is
//     the benign empty sweep);
//   - a degenerate record whose resolvedSource is the plugin-clones root
//     itself derives an empty first path segment and protects nothing.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { garbageCollectPluginClones } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

async function freshLocations(): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "clone-gc-errors-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

function makeRecord(resolvedSource: string, sha?: string): PluginRecord {
  const record: PluginRecord = {
    version: "0.0.1",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  if (sha !== undefined) {
    record.resolvedSha = sha;
  }

  return record;
}

async function seedState(
  locations: ScopedLocations,
  plugins: Record<string, PluginRecord>,
): Promise<void> {
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: locations.scope,
        source: { kind: "path", raw: "./src" },
        addedFromCwd: "/tmp",
        manifestPath: "/tmp/marketplace.json",
        marketplaceRoot: "/tmp",
        plugins,
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

void test("a non-ENOENT readdir failure (plugin-clones path is a FILE) rethrows instead of masquerading as an empty sweep", async () => {
  const locations = await freshLocations();
  await seedState(locations, {});
  // A regular FILE at the plugin-clones path makes readdir fail ENOTDIR --
  // NOT the benign missing-dir arm, so the error must propagate to the
  // caller (whose D-19-01 belt-and-braces catch owns the swallow decision).
  await writeFile(locations.pluginClonesDir, "not a directory");

  await assert.rejects(
    () => garbageCollectPluginClones(locations),
    (err: NodeJS.ErrnoException) => err.code === "ENOTDIR",
  );
});

void test("a record whose resolvedSource IS the plugin-clones dir itself protects nothing (empty first segment)", async () => {
  const locations = await freshLocations();
  // Degenerate record: resolvedSource points at the cache ROOT, not a keyed
  // subdirectory -- the first-path-segment derivation yields "" and the
  // record must not protect every clone in the cache.
  await seedState(locations, {
    alpha: makeRecord(locations.pluginClonesDir, "1111111111111111111111111111111111111111"),
  });
  await mkdir(path.join(locations.pluginClonesDir, "keyOrphan"), { recursive: true });

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  assert.deepEqual(await readdir(locations.pluginClonesDir), []);
});

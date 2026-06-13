import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadMergedScopeConfig,
  mergeScopeConfigs,
} from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";

/**
 * CFG-02 / D-01 / D-09 / D-10 / D-16 / D-18 -- entry-level
 * base+local merge + `loadMergedScopeConfig` per-file return shape.
 *
 * The pure-reducer matrix builds `ScopeConfig` literals inline (no disk).
 * Only the `loadMergedScopeConfig` cases need tmp scopeRoot scaffolding to
 * materialize base/local files.
 */

async function tmpScopeRoot(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-merge-test-"));
  // Cleanup retries with a short sleep -- mirrors the state-io.test.ts pattern
  // even though loadMergedScopeConfig itself does not fire-and-forget.
  const cleanup = async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await rm(dir, { recursive: true, force: true });
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOTEMPTY" && attempt < 9) {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          continue;
        }

        throw err;
      }
    }
  };

  return { root: dir, cleanup };
}

// ===================================================================
// A. mergeScopeConfigs pure-reducer matrix (CFG-02 + D-01 + D-16)
// ===================================================================

test("mergeScopeConfigs on empty base + empty local returns empty MergedConfig", () => {
  const base: ScopeConfig = {};
  const local: ScopeConfig = {};
  const merged = mergeScopeConfigs(base, local);
  assert.deepEqual(merged.marketplaces, {});
  assert.deepEqual(merged.plugins, {});
});

test("mergeScopeConfigs base-only marketplace entry -> source: 'base'", () => {
  const base: ScopeConfig = {
    marketplaces: { alpha: { source: "alpha/repo" } },
  };
  const local: ScopeConfig = {};
  const merged = mergeScopeConfigs(base, local);
  assert.equal(merged.marketplaces["alpha"]?.source, "base");
  assert.equal(merged.marketplaces["alpha"]?.entry.source, "alpha/repo");
});

test("mergeScopeConfigs local-only marketplace entry -> source: 'local'", () => {
  const base: ScopeConfig = {};
  const local: ScopeConfig = {
    marketplaces: { beta: { source: "beta/repo" } },
  };
  const merged = mergeScopeConfigs(base, local);
  assert.equal(merged.marketplaces["beta"]?.source, "local");
  assert.equal(merged.marketplaces["beta"]?.entry.source, "beta/repo");
});

test("mergeScopeConfigs both present -> local wins, base entry discarded (D-01 entry-level)", () => {
  const base: ScopeConfig = {
    marketplaces: { gamma: { source: "base-source", autoupdate: true } },
  };
  const local: ScopeConfig = {
    marketplaces: { gamma: { source: "local-source" } },
  };
  const merged = mergeScopeConfigs(base, local);
  // Local wins
  assert.equal(merged.marketplaces["gamma"]?.source, "local");
  // Entry reference is the local entry (not the base entry)
  assert.equal(merged.marketplaces["gamma"]?.entry, local.marketplaces!["gamma"]);
  assert.equal(merged.marketplaces["gamma"]?.entry.source, "local-source");
  // ANTI-DEEPMERGE ANCHOR: base's autoupdate is NOT carried forward into the
  // local entry. D-01 entry-level wholesale replacement, NOT field-merge.
  assert.equal(merged.marketplaces["gamma"]?.entry.autoupdate, undefined);
});

test("mergeScopeConfigs disjoint marketplaces -> both appear with respective provenance", () => {
  const base: ScopeConfig = {
    marketplaces: { alpha: { source: "alpha/repo" } },
  };
  const local: ScopeConfig = {
    marketplaces: { beta: { source: "beta/repo" } },
  };
  const merged = mergeScopeConfigs(base, local);
  assert.equal(Object.keys(merged.marketplaces).length, 2);
  assert.equal(merged.marketplaces["alpha"]?.source, "base");
  assert.equal(merged.marketplaces["beta"]?.source, "local");
});

test("mergeScopeConfigs plugins matrix mirrors marketplaces (flat keys per D-01)", () => {
  const base: ScopeConfig = {
    plugins: {
      "p1@alpha": { enabled: true },
      "p3@gamma": { enabled: false },
    },
  };
  const local: ScopeConfig = {
    plugins: {
      "p2@beta": {},
      "p3@gamma": { enabled: true },
    },
  };
  const merged = mergeScopeConfigs(base, local);
  // Base-only
  assert.equal(merged.plugins["p1@alpha"]?.source, "base");
  assert.equal(merged.plugins["p1@alpha"]?.entry.enabled, true);
  // Local-only
  assert.equal(merged.plugins["p2@beta"]?.source, "local");
  // Both present -> local wins
  assert.equal(merged.plugins["p3@gamma"]?.source, "local");
  assert.equal(merged.plugins["p3@gamma"]?.entry.enabled, true);
});

test("mergeScopeConfigs dangling plugin reference is a VALID merged result (D-16)", () => {
  // A plugin entry whose marketplace name does NOT appear in either
  // marketplaces map. The merge does NOT abort or filter.
  const base: ScopeConfig = {
    plugins: { "orphan@missing-mp": { enabled: true } },
  };
  const local: ScopeConfig = {};
  const merged = mergeScopeConfigs(base, local);
  assert.equal(merged.plugins["orphan@missing-mp"]?.source, "base");
  assert.equal(merged.plugins["orphan@missing-mp"]?.entry.enabled, true);
  // marketplaces map is empty -- reconcile will soft-fail per-entry.
  assert.deepEqual(merged.marketplaces, {});
});

test("mergeScopeConfigs field-replacement strictness (anti-deepmerge for plugins)", () => {
  // Plugin variant of the same anti-deepmerge anchor: a base plugin with
  // enabled:true is fully replaced by a local plugin that omits the field;
  // the merged entry's enabled is undefined, NOT inherited from base.
  const base: ScopeConfig = {
    plugins: { "p@m": { enabled: true } },
  };
  const local: ScopeConfig = {
    plugins: { "p@m": {} },
  };
  const merged = mergeScopeConfigs(base, local);
  assert.equal(merged.plugins["p@m"]?.source, "local");
  assert.equal(merged.plugins["p@m"]?.entry.enabled, undefined);
});

// ===================================================================
// B. loadMergedScopeConfig shape (D-18)
// ===================================================================

test("loadMergedScopeConfig both files absent -> empty merged + absent statuses", async () => {
  const { root, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("user", root);
    // Override scopeRoot for the test: locationsFor user scope ignores cwd
    // and uses PI_CODING_AGENT_DIR / ~/.pi/agent. Use project scope instead
    // so cwd determines scopeRoot deterministically.
    const projLoc = locationsFor("project", root);
    const outcome = await loadMergedScopeConfig(projLoc);
    assert.equal(outcome.base.status, "absent");
    assert.equal(outcome.local.status, "absent");
    assert.deepEqual(outcome.merged.marketplaces, {});
    assert.deepEqual(outcome.merged.plugins, {});
    // Reference user-scope loc to keep unused-binding lint quiet.
    assert.equal(typeof loc.scopeRoot, "string");
  } finally {
    await cleanup();
  }
});

test("loadMergedScopeConfig only base valid -> merged mirrors base with source: 'base'", async () => {
  const { root, cleanup } = await tmpScopeRoot();
  try {
    const projLoc = locationsFor("project", root);
    await mkdir(path.dirname(projLoc.configJsonPath), { recursive: true });
    await writeFile(
      projLoc.configJsonPath,
      JSON.stringify({
        marketplaces: { alpha: { source: "alpha/repo" } },
        plugins: { "p1@alpha": { enabled: true } },
      }),
      "utf8",
    );
    const outcome = await loadMergedScopeConfig(projLoc);
    assert.equal(outcome.base.status, "valid");
    assert.equal(outcome.local.status, "absent");
    assert.equal(outcome.merged.marketplaces["alpha"]?.source, "base");
    assert.equal(outcome.merged.plugins["p1@alpha"]?.source, "base");
  } finally {
    await cleanup();
  }
});

test("loadMergedScopeConfig both valid -> merged per matrix + both per-file results exposed", async () => {
  const { root, cleanup } = await tmpScopeRoot();
  try {
    const projLoc = locationsFor("project", root);
    await mkdir(path.dirname(projLoc.configJsonPath), { recursive: true });
    await writeFile(
      projLoc.configJsonPath,
      JSON.stringify({
        marketplaces: {
          alpha: { source: "alpha/base", autoupdate: true },
          beta: { source: "beta/base" },
        },
      }),
      "utf8",
    );
    await writeFile(
      projLoc.configLocalJsonPath,
      JSON.stringify({
        marketplaces: {
          alpha: { source: "alpha/local" },
        },
      }),
      "utf8",
    );
    const outcome = await loadMergedScopeConfig(projLoc);
    assert.equal(outcome.base.status, "valid");
    assert.equal(outcome.local.status, "valid");
    // Local overrides base for alpha (entry-level)
    assert.equal(outcome.merged.marketplaces["alpha"]?.source, "local");
    assert.equal(outcome.merged.marketplaces["alpha"]?.entry.source, "alpha/local");
    // Anti-deepmerge: base's autoupdate is NOT carried over
    assert.equal(outcome.merged.marketplaces["alpha"]?.entry.autoupdate, undefined);
    // Beta only in base
    assert.equal(outcome.merged.marketplaces["beta"]?.source, "base");
    // Per-file results are returned alongside the merged view
    if (outcome.base.status === "valid") {
      assert.equal(outcome.base.filePath, projLoc.configJsonPath);
    }

    if (outcome.local.status === "valid") {
      assert.equal(outcome.local.filePath, projLoc.configLocalJsonPath);
    }
  } finally {
    await cleanup();
  }
});

test("loadMergedScopeConfig base invalid + local absent -> still returns ScopeLoadOutcome (does NOT throw)", async () => {
  const { root, cleanup } = await tmpScopeRoot();
  try {
    const projLoc = locationsFor("project", root);
    await mkdir(path.dirname(projLoc.configJsonPath), { recursive: true });
    // 0-byte file: JSON.parse fails -> invalid
    await writeFile(projLoc.configJsonPath, "", "utf8");
    const outcome = await loadMergedScopeConfig(projLoc);
    assert.equal(outcome.base.status, "invalid");
    assert.equal(outcome.local.status, "absent");
    // Merged view treats invalid arm as empty for the merge computation
    // (D-18 fallback shape; user-visible messaging lives in downstream layers).
    assert.deepEqual(outcome.merged.marketplaces, {});
    assert.deepEqual(outcome.merged.plugins, {});
  } finally {
    await cleanup();
  }
});

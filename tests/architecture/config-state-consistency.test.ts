// Phase 56 Plan 01 Task 3 -- Wave 0 architecture test gate for WB-01 SC#4
// (round-trip integrity + reconcile no-op after a mutating command).
//
// The full proof requires Plan 04 to wire the write-back orchestrator
// surfaces; this file lands the GATING SCAFFOLD now so Plans 02/03/04 flip
// each `test.skip` to a live test as their respective orchestrators wire up.
//
// Two test classes:
//
// 1. LIVE SMOKE (this plan): writeMarketplaceConfigEntry on an empty config
//    produces a file that reads back as a planned `marketplacesToAdd` of
//    exactly one entry (because state is empty); no other plan buckets are
//    populated. This proves the helper integrates with the planner reading
//    side -- the FULL post-mutation no-op requires the orchestrator-level
//    state mutation to land too, deferred to Plan 04.
//
// 2. SKIP PLACEHOLDER (this plan): the eventual WB-01 SC#4 proof --
//    addMarketplace under standalone mode produces post-state where
//    planReconcile is a no-op AND unknown forward-compat keys survive.
//    The skipped test imports addMarketplace so the import-chain validates
//    under `npm run check`; Plan 02/04 turn the skip into a live test.
//
// Structural shape: mirrors tests/architecture/config-state-write-seams.test.ts
// (top-of-file rationale + per-test naming + node:test + node:assert/strict).

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { planReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import {
  loadConfig,
  saveConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { writeMarketplaceConfigEntry } from "../../extensions/pi-claude-marketplace/persistence/config-write-back.ts";
import { DEFAULT_STATE } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";

// Phase 56-02: the addMarketplace path is now wired (write-back lands the
// marketplace entry into claude-plugins.json under the locked transaction).
// `saveConfig` is exercised transitively through the write-back helper; the
// direct import is retained for symmetry with the other plans.
void saveConfig;

async function tmpScopeRoot(): Promise<{ scopeRoot: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-consistency-test-"));
  const scopeRoot = path.join(dir, ".pi");
  await mkdir(scopeRoot, { recursive: true });
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

  return { scopeRoot, cleanup };
}

// ──────────────────────────────────────────────────────────────────────────
// LIVE smoke: helper + planner integration (Plan 01 land)
// ──────────────────────────────────────────────────────────────────────────

test("config-state-consistency: writeMarketplaceConfigEntry + planReconcile reads back the one declared marketplace", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");

    // 1. Empty starting config (status === "absent" on the load arm).
    const empty: ScopeConfig = { schemaVersion: 1 };

    // 2. Write one marketplace via the helper.
    await writeMarketplaceConfigEntry(empty, filePath, scopeRoot, "mp1", {
      source: "owner/repo",
      autoupdate: true,
    });

    // 3. Read it back -- prove the file is on-disk and parses cleanly.
    const cfg = await loadConfig(filePath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // 4. Run the planner against the read-back config and empty state.
    //    Because state is empty, the one declared marketplace lands in
    //    marketplacesToAdd; every other bucket is empty.
    const merged = mergeScopeConfigs(cfg.config, {});
    const plan = planReconcile(merged, DEFAULT_STATE, "user");

    assert.equal(plan.marketplacesToAdd.length, 1);
    assert.equal(plan.marketplacesToAdd[0]!.marketplace, "mp1");
    assert.equal(plan.marketplacesToAdd[0]!.source, "owner/repo");
    assert.equal(plan.marketplacesToRemove.length, 0);
    assert.equal(plan.pluginsToInstall.length, 0);
    assert.equal(plan.pluginsToUninstall.length, 0);
    assert.equal(plan.pluginsToEnable.length, 0);
    assert.equal(plan.pluginsToDisable.length, 0);
    assert.equal(plan.sourceMismatches.length, 0);
    assert.equal(plan.scope, "user");

    // Sanity check: a freshly emptyReconcilePlan and our 1-bucket plan are
    // not deepEqual (the asymmetry is the point -- the FULL no-op proof
    // requires orchestrator-level state mutation, deferred to Plan 04).
    assert.notDeepEqual(plan, emptyReconcilePlan("user"));
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// SKIP placeholders: Plan 02 / 04 turns these into live tests
// ──────────────────────────────────────────────────────────────────────────

test("WB-01 SC#4 (add path): after addMarketplace, reconcile is a no-op AND state ⊆ config (round-trip integrity)", async () => {
  // Wire-up: invoke the real `addMarketplace` (standalone mode) against a
  // mock GitOps + valid fixture. Read back the config + the post-mutation
  // state. Plan and assert: planReconcile produces emptyReconcilePlan.
  const { fixtureMarketplaceDir, makeMockGitOps } = await import("../helpers/git-mock.ts");
  const { locationsFor } =
    await import("../../extensions/pi-claude-marketplace/persistence/locations.ts");
  const { loadState } =
    await import("../../extensions/pi-claude-marketplace/persistence/state-io.ts");

  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const cwd = scopeRoot.replace(/\/\.pi$/, "");
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });

    const ctx = { ui: { notify: (): void => undefined } } as never;
    const pi = { getAllTools: (): unknown[] => [] } as never;
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

    // 1. The config file was written under the locked transaction.
    const cfg = await loadConfig(locations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // 2. State was committed with the marketplace recorded.
    const state = await loadState(locations.extensionRoot);
    assert.ok("valid-marketplace" in state.marketplaces);

    // 3. planReconcile against (merged config, post-mutation state) is a
    //    NO-OP -- every bucket empty (WB-01 SC#4 round-trip integrity).
    const merged = mergeScopeConfigs(cfg.config, {});
    const plan = planReconcile(merged, state, "project");
    assert.deepEqual(plan, emptyReconcilePlan("project"));
  } finally {
    await cleanup();
  }
});

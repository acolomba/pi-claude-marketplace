// WB-01 SC#4 architecture test gate.
//
// Locks the round-trip integrity contract: after any mutating command lands,
// reading the post-mutation config + state and running planReconcile against
// the merged view yields an empty plan (WB-01 SC#4). Unknown forward-compat
// keys at both entry-level and top-level survive any write-back (D-09 lenient
// schema).
//
// The reconcile no-op proof complements RECON-05 byte-stability: a fixed
// point in the reconcile-then-mutate-then-reconcile dynamic is the goal-
// backward criterion for the config/state split GREEN gate. The orchestrated-
// mode SKIP discipline (WR-09) is also structurally guarded here: when an
// orchestrator is called from a reconciler-driven caller (notifications:
// {mode: "orchestrated"}), the per-entry write-back SKIPS so the parent
// reconcile owns the single write.
//
// Structural shape: mirrors tests/architecture/config-state-write-seams.test.ts
// (top-of-file rationale + per-test naming + node:test + node:assert/strict).

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { setMarketplaceAutoupdate } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { removeMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
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

// The addMarketplace path is wired so write-back lands the marketplace
// entry into claude-plugins.json under the locked transaction. `saveConfig`
// is exercised transitively through the write-back helper; the direct
// import is retained for symmetry with sibling tests.
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
// LIVE smoke: helper + planner integration
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
    // requires orchestrator-level state mutation, exercised by sibling tests).
    assert.notDeepEqual(plan, emptyReconcilePlan("user"));
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Live coverage of the orchestrator write-back paths
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

test("WB-01 SC#4 (add + autoupdate enable): post-flip reconcile is a no-op AND unknown forward-compat keys survive", async () => {
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

    // 1. Seed the config with a marketplace + unknown forward-compat keys.
    //    futureField at the entry level (D-09); futureTopLevel at the top.
    //    saveConfig is the SOLE sanctioned writer (SPLIT-02); validated
    //    against the lenient schema, unknown keys survive the round trip.
    await saveConfig(
      locations.configJsonPath,
      {
        schemaVersion: 1,
        marketplaces: {
          // Pre-existing entry: the next addMarketplace targets a NEW name;
          // this entry must remain untouched with its futureField intact.
          legacy: {
            source: "owner/legacy",
            ...({ futureField: "preserve me" } as Record<string, unknown>),
          },
        },
        ...({ futureTopLevel: "preserve me too" } as Record<string, unknown>),
      },
      locations.scopeRoot,
    );

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // 2. Flip autoupdate ON via the orchestrator.
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "valid-marketplace",
      enable: true,
      scope: "project",
      cwd,
    });

    // 3. Read back the config; unknown keys at BOTH entry and top level
    //    survived every write-back (add, then autoupdate flip).
    const cfg = await loadConfig(locations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    const cfgRecord = cfg.config as unknown as Record<string, unknown>;
    const legacyEntry = (cfg.config.marketplaces?.legacy ?? {}) as Record<string, unknown>;
    assert.equal(legacyEntry.futureField, "preserve me");
    assert.equal(cfgRecord.futureTopLevel, "preserve me too");
    // The new marketplace's autoupdate flip landed.
    assert.equal(cfg.config.marketplaces?.["valid-marketplace"]?.autoupdate, true);

    // 4. Post-mutation reconcile is a no-op (the legacy entry is recorded
    //    in config but not in state, so reconcile would plan it as
    //    'to add'; we therefore prune it before reconciling to focus on
    //    the WB-01 SC#4 invariant for the actually-mutated marketplace).
    const stateAfter = await loadState(locations.extensionRoot);
    const cfgForReconcile = {
      ...cfg.config,
      marketplaces: Object.fromEntries(
        Object.entries(cfg.config.marketplaces ?? {}).filter(([name]) => name !== "legacy"),
      ),
    };
    const merged = mergeScopeConfigs(cfgForReconcile, {});
    const plan = planReconcile(merged, stateAfter, "project");
    assert.deepEqual(plan, emptyReconcilePlan("project"));
  } finally {
    await cleanup();
  }
});

test("WB-01 SC#4 (add + autoupdate disable): post-flip reconcile is a no-op", async () => {
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
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "valid-marketplace",
      enable: true,
      scope: "project",
      cwd,
    });
    // Now flip back OFF.
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "valid-marketplace",
      enable: false,
      scope: "project",
      cwd,
    });

    const cfg = await loadConfig(locations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    assert.equal(cfg.config.marketplaces?.["valid-marketplace"]?.autoupdate, false);

    const stateAfter = await loadState(locations.extensionRoot);
    const merged = mergeScopeConfigs(cfg.config, {});
    const plan = planReconcile(merged, stateAfter, "project");
    assert.deepEqual(plan, emptyReconcilePlan("project"));
  } finally {
    await cleanup();
  }
});

test("WB-01 SC#4 (add + remove cascade): post-remove reconcile is a no-op and config no longer carries the marketplace entry", async () => {
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

    // Add then remove the same marketplace -- the round-trip should leave
    // config + state in their original empty shape.
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });
    await removeMarketplace({
      ctx,
      pi,
      name: "valid-marketplace",
      scope: "project",
      cwd,
    });

    const cfg = await loadConfig(locations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // remove cleared the entry (cascade: no orphaned plugin keys).
    assert.equal("valid-marketplace" in (cfg.config.marketplaces ?? {}), false);

    const stateAfter = await loadState(locations.extensionRoot);
    assert.equal("valid-marketplace" in stateAfter.marketplaces, false);

    const merged = mergeScopeConfigs(cfg.config, {});
    const plan = planReconcile(merged, stateAfter, "project");
    assert.deepEqual(plan, emptyReconcilePlan("project"));
  } finally {
    await cleanup();
  }
});

test("WB-01 SC#4 (bare-form autoupdate flip, 2 marketplaces): BOTH config entries survive the batched write-back", async () => {
  // CR-01 regression: the per-name sequential
  // writeMarketplaceConfigEntry loop rebuilt the file from the SAME stale
  // snapshot on each iteration, so a bare-form flip over N marketplaces
  // persisted only the LAST marketplace's entry. The batched write-back must
  // land every fresh-flipped entry in one atomic save.
  const { pathSource } = await import("../../extensions/pi-claude-marketplace/domain/source.ts");
  const { locationsFor } =
    await import("../../extensions/pi-claude-marketplace/persistence/locations.ts");
  const { saveState } =
    await import("../../extensions/pi-claude-marketplace/persistence/state-io.ts");

  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const cwd = scopeRoot.replace(/\/\.pi$/, "");
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });

    const ctx = { ui: { notify: (): void => undefined } } as never;
    const pi = { getAllTools: (): unknown[] => [] } as never;

    const mpRecord = (name: string): Record<string, unknown> => ({
      name,
      scope: "project",
      source: pathSource(`./${name}-src`),
      addedFromCwd: cwd,
      manifestPath: path.join(cwd, `${name}-src`, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: path.join(cwd, `${name}-src`),
      plugins: {},
    });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp1: mpRecord("mp1"), mp2: mpRecord("mp2") },
    } as never);

    // Bare form: NO name -- every marketplace in the scope flips.
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      enable: true,
      scope: "project",
      cwd,
    });

    const cfg = await loadConfig(locations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // BOTH entries carry the flip + the synthesized verbatim source -- the
    // last-write-wins clobber would have dropped mp1.
    assert.equal(cfg.config.marketplaces?.mp1?.autoupdate, true);
    assert.equal(cfg.config.marketplaces?.mp1?.source, "./mp1-src");
    assert.equal(cfg.config.marketplaces?.mp2?.autoupdate, true);
    assert.equal(cfg.config.marketplaces?.mp2?.source, "./mp2-src");
  } finally {
    await cleanup();
  }
});

test("WB-01 SC#4 (cross-scope CMP-3 install): project-scope install via user-scope marketplace fallback declares the adopted marketplace -- reconcile is a no-op", async () => {
  // CR-02 regression: a project-scope install resolving
  // the marketplace via the CMP-3 user-scope fallback clones the record into
  // PROJECT state. The write-back must declare BOTH the plugin key AND the
  // adopted marketplace entry in the project config -- a bare plugin key is
  // a dangling declaration the planner converts into a marketplace removal
  // plus a perpetual `<marketplace not declared>` failed row.
  const { pathSource } = await import("../../extensions/pi-claude-marketplace/domain/source.ts");
  const { installPlugin } =
    await import("../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts");
  const { locationsFor } =
    await import("../../extensions/pi-claude-marketplace/persistence/locations.ts");
  const { loadState, saveState } =
    await import("../../extensions/pi-claude-marketplace/persistence/state-io.ts");
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir: osTmpdir } = await import("node:os");

  // Hermetic HOME so the user-scope marketplace lives under a tmp root.
  const hermeticHome = await mkdtemp(path.join(osTmpdir(), "pi-cm-cr02-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;

  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const cwd = scopeRoot.replace(/\/\.pi$/, "");
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await mkdir(userLocations.extensionRoot, { recursive: true });

    // Seed a USER-scope path marketplace with one single-skill plugin.
    const marketplaceRoot = path.join(hermeticHome, "mp-src");
    const pluginRoot = path.join(marketplaceRoot, "plugins", "tool");
    await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    const skillDir = path.join(pluginRoot, "skills", "helper");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: helper\n---\n\nBody.\n");
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "tool", version: "0.0.1" }),
    );
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({ name: "mp", plugins: [{ name: "tool", source: "./plugins/tool" }] }),
    );
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: pathSource(marketplaceRoot),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot,
          plugins: {},
        },
      },
    } as never);

    const ctx = { ui: { notify: (): void => undefined } } as never;
    const pi = { getAllTools: (): unknown[] => [] } as never;

    // Project-scope install: marketplace "mp" is NOT in project state, so
    // resolveInstallMarketplaceSource falls back to the user-scope record
    // (CMP-3) and clones it into project state.
    await installPlugin({
      ctx,
      pi,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "tool",
    });

    const cfg = await loadConfig(projectLocations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // The adopted marketplace is DECLARED alongside the plugin key, with the
    // cloned record's verbatim source.raw.
    assert.equal(cfg.config.marketplaces?.mp?.source, marketplaceRoot);
    assert.ok(cfg.config.plugins?.["tool@mp"] !== undefined);

    // Post-command reconcile against (merged project config, project state)
    // is the EMPTY plan: no marketplacesToRemove, no dangling failed row.
    const stateAfter = await loadState(projectLocations.extensionRoot);
    const merged = mergeScopeConfigs(cfg.config, {});
    const plan = planReconcile(merged, stateAfter, "project");
    assert.deepEqual(plan, emptyReconcilePlan("project"));
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
    await cleanup();
  }
});

test("WR-09 orchestrated-mode SKIP: addMarketplace with notifications.mode 'orchestrated' does NOT touch the config file", async () => {
  const { fixtureMarketplaceDir, makeMockGitOps } = await import("../helpers/git-mock.ts");
  const { locationsFor } =
    await import("../../extensions/pi-claude-marketplace/persistence/locations.ts");
  const { readFile, stat, writeFile } = await import("node:fs/promises");

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

    // Pre-seed config with a known fixture so we can prove byte-stability.
    await mkdir(locations.scopeRoot, { recursive: true });
    const initialBytes = JSON.stringify({ schemaVersion: 1 });
    await writeFile(locations.configJsonPath, initialBytes, "utf8");
    const beforeStat = await stat(locations.configJsonPath);

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // Config file bytes + mtime UNCHANGED: orchestrated mode skipped the
    // write-back. State MAY have changed (the orchestrator still recorded
    // the marketplace in state.json); only the config side is asserted here.
    const afterBytes = await readFile(locations.configJsonPath, "utf8");
    const afterStat = await stat(locations.configJsonPath);
    assert.equal(afterBytes, initialBytes);
    assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs);
  } finally {
    await cleanup();
  }
});

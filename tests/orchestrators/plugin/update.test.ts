import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GENERATED_AGENT_PREFIX } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  updatePlugins,
  updateSinglePlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../helpers/git-mock.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// PUP-1..9 + AS-3 (3-phase) + AS-7 + WR-04 + NFR-2 + NFR-3 coverage:
//
//   PUP-1: three forms (bare / @mp / pl@mp); empty-target silent success.
//   PUP-2: syncCloneOnce memoization (gitOps call counts ASSERT once per mp).
//   PUP-3: unchanged (version equality; NO I/O on bridges).
//   PUP-4: skipped (no longer installable).
//   PUP-5: skipped (entry missing from refreshed manifest).
//   PUP-6: happy 3-phase + phase-3 failure recovery hint (RECOVERY_PLUGIN_REINSTALL_PREFIX).
//   PUP-7: phase-3 abort cleans staging, no mask of original error.
//   PUP-8: reload hint when >=1 plugin updated; suppressed when 0 updated.
//   PUP-9: cascade vs direct routing (updateSinglePlugin never throws;
//          updatePlugins fires notifyError on phase-2-or-earlier throws).

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(piOverrides?: { getAllTools?: () => unknown[] }): {
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
    getAllTools: piOverrides?.getAllTools ?? ((): unknown[] => []),
  } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "update-home-"));
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

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function makePluginRecord(
  version: string,
  resources: Partial<PluginRecord["resources"]> = {},
): PluginRecord {
  return {
    version,
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

interface SeededPathMp {
  marketplaceRoot: string;
  manifestPath: string;
}

/**
 * Build a marketplace tree on disk and seed a path-source state record.
 * The plugins map carries entries we control; tests then mutate the
 * on-disk manifest between calls to simulate version bumps / removals.
 */
async function seedPathMarketplace(opts: {
  cwd: string;
  marketplaceRoot: string;
  marketplaceName: string;
  /** Map of plugin name -> { version, hasSkill?, hasCommand?, hasAgent?, hasMcp? } */
  manifestPlugins: Record<
    string,
    {
      version: string;
      rawSourceOverride?: unknown;
      hasSkill?: boolean;
      hasCommand?: boolean;
      hasAgent?: boolean;
      hasMcp?: boolean;
    }
  >;
  /** Map of plugin name -> existing state record version. Absent -> no prior install. */
  installedVersions?: Record<string, string>;
}): Promise<SeededPathMp> {
  const { cwd, marketplaceRoot, marketplaceName, manifestPlugins } = opts;

  await mkdir(marketplaceRoot, { recursive: true });
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });

  for (const [pluginName, spec] of Object.entries(manifestPlugins)) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
    await mkdir(pluginRoot, { recursive: true });
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: pluginName, version: spec.version }),
    );

    if (spec.hasSkill !== false) {
      const skillDir = path.join(pluginRoot, "skills", "tool");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: tool\n---\n\nBody for ${pluginName} ${spec.version}.\n`,
      );
    }

    if (spec.hasCommand === true) {
      const cmdDir = path.join(pluginRoot, "commands");
      await mkdir(cmdDir, { recursive: true });
      await writeFile(path.join(cmdDir, "deploy.md"), `# deploy for ${pluginName}\n\nBody.\n`);
    }

    if (spec.hasAgent === true) {
      const agentDir = path.join(pluginRoot, "agents");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, "bot.md"),
        `---\nname: bot\ntools: Read,Grep\n---\n\nBody.\n`,
      );
    }

    if (spec.hasMcp === true) {
      await writeFile(
        path.join(pluginRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { server1: { command: "node", args: ["s.js"] } } }),
      );
    }
  }

  const entries = Object.entries(manifestPlugins).map(([name, spec]) => ({
    name,
    source: spec.rawSourceOverride ?? `./plugins/${name}`,
    version: spec.version,
  }));
  const manifest = { name: marketplaceName, plugins: entries };
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify(manifest));

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const installedPlugins: Record<string, PluginRecord> = {};
  for (const [pluginName, installedVersion] of Object.entries(opts.installedVersions ?? {})) {
    installedPlugins[pluginName] = makePluginRecord(installedVersion);
  }

  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [marketplaceName]: {
        name: marketplaceName,
        scope: "project",
        source: pathSource(`./${path.basename(marketplaceRoot)}`),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: installedPlugins,
      },
    },
  });

  return { marketplaceRoot, manifestPath };
}

/**
 * Rewrite the on-disk manifest to a new shape. Used to simulate a
 * marketplace update where entry.version changed or entries were removed.
 */
async function rewriteManifest(
  manifestPath: string,
  name: string,
  plugins: Record<string, { version?: string; rawSourceOverride?: unknown }>,
): Promise<void> {
  const entries = Object.entries(plugins).map(([n, spec]) => ({
    name: n,
    source: spec.rawSourceOverride ?? `./plugins/${n}`,
    ...(spec.version !== undefined && { version: spec.version }),
  }));
  await writeFile(manifestPath, JSON.stringify({ name, plugins: entries }));
}

// ─── PUP-1: empty target ───────────────────────────────────────────────────────

test("PUP-1: bare form against empty state -> 'No plugins installed.' silent success", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup1-empty-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({ ctx, pi, scope: "project", cwd, target: { kind: "all" } });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(notifications[0]?.message, "No plugins installed.");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-3: unchanged path -- string version equality, no I/O ──────────────────

test("PUP-3: version equality -> outcome.partition='unchanged'; no bridge state mutation", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup3-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Capture state mtime before; assert state.json is NOT rewritten.
      const stateJsonPath = path.join(locations.extensionRoot, "state.json");
      const before = await readFile(stateJsonPath, "utf8");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const after = await readFile(stateJsonPath, "utf8");
      assert.equal(before, after, "state.json must NOT be rewritten on unchanged path");

      // No "Updated:" rendering; "Unchanged:" present.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      const body = notifications[0]?.message ?? "";
      assert.match(body, /Unchanged:/);
      assert.equal(body.includes("Run /reload to "), false, "no reload hint when 0 updated");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-4: skipped, no longer installable ─────────────────────────────────────

test("PUP-4: source overridden to github-flavored URL -> outcome.partition='skipped' with 'is no longer installable'", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup4-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // MM-3 / PR-2: github-source plugin entry is not installable in V1.
        manifestPlugins: {
          hello: { version: "1.1.0", hasSkill: true, rawSourceOverride: "github:owner/repo" },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      assert.match(body, /Skipped:/);
      assert.match(body, /is no longer installable/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-5: skipped, entry not in refreshed manifest ───────────────────────────

test("PUP-5: refreshed manifest no longer lists entry -> outcome.partition='skipped' with 'not in manifest'", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup5-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Simulate the marketplace dropping the entry after install.
      await rewriteManifest(seeded.manifestPath, "mp", {});

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      assert.match(body, /Skipped:/);
      assert.match(body, /not in manifest/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-6: happy 3-phase path -- updated outcome + state record swap + reload hint ─

test("PUP-6 happy: version bump triggers 3-phase swap; state reflects new version + reload hint emitted", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup6-happy-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // State.json reflects the swap.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.0.1");
      assert.deepEqual([...record.resources.skills], ["hello-tool"]);
      assert.deepEqual([...record.resources.prompts], ["hello:deploy"]);
      assert.deepEqual([...record.resources.agents], [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual([...record.resources.mcpServers], ["server1"]);

      // Disk state: skill SKILL.md exists at target.
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md");
      assert.ok((await readFile(skillTarget, "utf8")).length > 0, "skill must exist on disk");

      // RH-1 + RH-2 reload hint with verb 'refresh'.
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);
      const body = notifications[0]?.message ?? "";
      assert.match(body, /Updated:/);
      assert.match(body, /hello \(1\.0\.0 → 1\.0\.1\)/);
      assert.match(body, /Run \/reload to refresh it\.$/);

      // Ensure we referenced the seeded marketplaceRoot (compile-time use of `seeded`).
      assert.ok(seeded.marketplaceRoot.length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-2: syncCloneOnce memoization (github-source, gitOps mocked) ───────────

test("PUP-2: two plugins in SAME github marketplace -> syncCloneOnce calls fetch/forceUpdateRef/checkout exactly once", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup2-"));
    try {
      // Seed a github marketplace with two installed plugins. The fixture
      // provides a valid marketplace.json under the cloneDir; the resolver
      // will later mark plugin entries as not-installable (no on-disk
      // plugin tree), causing them to land in the 'skipped' partition.
      // PUP-2 cares only about gitOps call counts -- the per-plugin outcome
      // shape is irrelevant here.
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const cloneDir = await locations.sourceCloneDir("official");
      await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });

      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          official: {
            name: "official",
            scope: "project",
            source: githubSource("https://github.com/anthropics/test#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              a: makePluginRecord("0.0.1"),
              b: makePluginRecord("0.0.1"),
            },
          },
        },
      });

      const { ctx, pi } = makeCtx();
      const { gitOps, state } = makeMockGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });

      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
      });

      // PUP-2: syncCloneOnce memoizes per (scope, marketplace). Even though
      // two plugins live in `official`, each gitOps primitive fires exactly
      // once for the marketplace refresh -- not twice.
      assert.equal(state.fetchCalls.length, 1, "fetch should fire exactly once");
      assert.equal(state.forceUpdateRefCalls.length, 1, "forceUpdateRef should fire exactly once");
      assert.equal(state.checkoutCalls.length, 1, "checkout should fire exactly once");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── NFR-5: path-source update -> zero gitOps calls ────────────────────────────

test("NFR-5: path-source marketplace update calls zero gitOps primitives", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-nfr5-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, pi } = makeCtx();
      const { gitOps, state } = makeMockGitOps();

      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        gitOps,
      });

      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 partitioning across @mp form ────────────────────────────────────────

test("PUP-1 @mp form: enumerates all installed plugins in the marketplace, partitions accordingly", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup1-mp-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // Bumped: one plugin updated; one unchanged.
          alpha: { version: "1.0.1", hasSkill: true },
          beta: { version: "1.0.0", hasSkill: true },
        },
        installedVersions: { alpha: "1.0.0", beta: "1.0.0" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      // MU-7 ordering: Updated first, then Unchanged.
      const idxUpdated = body.indexOf("Updated:");
      const idxUnchanged = body.indexOf("Unchanged:");
      assert.ok(idxUpdated >= 0 && idxUnchanged > idxUpdated, `partition order broken:\n${body}`);
      assert.match(body, /alpha \(1\.0\.0 → 1\.0\.1\)/);
      // PUP-8: hint emitted for the one updated plugin.
      assert.match(body, /Run \/reload to refresh it\.$/);
      assert.ok(seeded.marketplaceRoot.length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-8: reload hint suppressed when 0 updated ──────────────────────────────

test("PUP-8: no plugin updated -> no reload hint", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup8-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      assert.equal(body.includes("Run /reload to "), false, "no reload hint when 0 updated");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-9 cascade: updateSinglePlugin NEVER throws ────────────────────────────

test("PUP-9 cascade: updateSinglePlugin on missing marketplace returns partition='skipped' (does NOT throw)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup9-casc-"));
    try {
      // No state seeded -- marketplace absent. The cascade-safe contract
      // says: capture into partition='failed' OR 'skipped' depending on
      // failure shape, but NEVER throw.
      // Run from inside cwd to align process.cwd() with the scope root.
      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("ghost", "ghost-mp", "project");
        // Marketplace-absent is a 'skipped' outcome (pre-phase short-circuit).
        assert.equal(outcome.partition, "skipped");
        assert.equal(outcome.name, "ghost");
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-9 cascade vs direct: catastrophic resolver failure routes differently", async () => {
  // Cascade path: catastrophic phase-2-or-earlier throw (e.g. corrupt
  // manifest at the marketplaceRoot) returns partition='failed' instead
  // of throwing. Direct path on the same input fires notifyError.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup9-route-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // Corrupt the manifest so loadCachedMarketplaceManifest throws.
      await writeFile(seeded.manifestPath, "{ this is not json");

      // Cascade: must NOT throw; returns failed outcome.
      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const cascadeOutcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(cascadeOutcome.partition, "failed");
        assert.equal(cascadeOutcome.name, "hello");
        assert.ok((cascadeOutcome.notes ?? []).length > 0);
      } finally {
        process.chdir(prevCwd);
      }

      // Direct: fires notifyError with the chained cause.
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const errs = notifications.filter((n) => n.severity === "error");
      assert.ok(errs.length >= 1, "direct path must fire notifyError on phase-2-or-earlier throw");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-6: phase-3 failure -- RECOVERY_PLUGIN_REINSTALL_PREFIX in body ───────

test("PUP-6 phase-3 failure: bridge commit throws -> aggregate error carries 'plugin-uninstall + plugin-install for \"<plugin>\".'", async () => {
  // The cleanest way to force a phase-3a failure deterministically is to
  // pre-create an UNWRITEABLE file at the target path where the skills
  // bridge would `rename(staging -> target)`. On most filesystems that
  // succeeds (rename overwrites a file with a dir), so instead we force
  // a target-dir collision by pre-creating the skill TARGET as a FILE
  // (rename(dir -> file) returns ENOTDIR on Linux/macOS).
  //
  // NOTE: this is a defensive test -- the actual phase-3a aggregation
  // contract is that ANY commit-time throw lands in failures[]. We use
  // the file-vs-dir filesystem collision as one reliable trigger.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup6-fail-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-create the skills target as a file (NOT a dir). The bridge's
      // commitPreparedSkills calls `rm` then `mkdir(..., {recursive:true})`
      // on the target ROOT, but the per-skill rename overwrites the target
      // path. Place the obstacle one level deeper to force EEXIST/ENOTDIR
      // at rename time: a *FILE* at the path the bridge wants to rename
      // *into*. The bridge skills target shape is
      // `<skillsTargetDir>/<generatedName>/` -- so we pre-create
      // `<skillsTargetDir>/hello-tool` as a FILE.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // Look for the recovery hint marker anywhere in the notifications.
      // Either notifyError fired (phase-3a aggregate) or the body's
      // Failed: section names the recovery hint.
      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(
        allText,
        /plugin-uninstall \+ plugin-install for "hello"\./,
        `expected RECOVERY_PLUGIN_REINSTALL_PREFIX hint somewhere in:\n${allText}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-7 / WR-04: success populates stagedAgents + stagedMcpServers ─────────

test("WR-04: successful update populates stagedAgents + stagedMcpServers on outcome", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr04-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasAgent: true, hasMcp: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        assert.equal(outcome.fromVersion, "1.0.0");
        assert.equal(outcome.toVersion, "1.0.1");
        assert.ok(outcome.stagedAgents !== undefined);
        assert.ok(outcome.stagedAgents.length > 0, "stagedAgents must be populated");
        assert.ok(outcome.stagedMcpServers !== undefined);
        assert.ok(outcome.stagedMcpServers.length > 0, "stagedMcpServers must be populated");
      } finally {
        process.chdir(prevCwd);
      }

      assert.ok(seeded.marketplaceRoot.length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 pl@mp form: not-installed plugin -> partition='skipped' ─────────────

test("PUP-1 pl@mp: targeting a plugin not in state -> partition='skipped' (not installed)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup1-pl-noinstall-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        // No installedVersions -> hello not in state.
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      assert.match(body, /Skipped:/);
      assert.match(body, /not installed/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 missing marketplace -> notifyError (direct path) ────────────────────

test("PUP-1: targeting an unknown marketplace -> notifyError 'not found in <scope> scope'", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup1-nomp-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "ghost-mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /not found in project scope/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

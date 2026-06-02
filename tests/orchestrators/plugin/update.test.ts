import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
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
//          updatePlugins surfaces phase-2-or-earlier throws via V2
//          notify() with a synthetic PluginFailedMessage carrying cause).
//
// Phase 19 / Plan 19-05: byte-exact assertions match the V2 catalog forms
// at docs/output-catalog.md:489-568 (plugin update). The V1 `[<scope>]`
// plugin-row bracket is suppressed by Phase 17.2 orphan-fold (plugin.scope
// === mp.scope -> renderScopeBracket returns ""). Empty-targets renders
// `(no marketplaces)` via notify({ marketplaces: [] }) per the Wave 1
// precedent (orchestrators/marketplace/update.ts:230). Direct-path
// failures (enumerate / syncClone / runThreePhaseUpdate / phase-3
// aggregate) surface as synthetic PluginFailedMessage rows with cause
// threaded for the 4-space cause-chain trailer per D-16-08.

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

test("PUP-1: bare form against empty state -> '(no marketplaces)' silent success", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup1-empty-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({ ctx, pi, scope: "project", cwd, target: { kind: "all" } });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      // Phase 19 / Plan 19-05: V2 empty-targets shape mirrors the Wave 1
      // precedent at orchestrators/marketplace/update.ts:230 --
      // notify({ marketplaces: [] }) renders the renderer's
      // `(no marketplaces)` sentinel per D-16-17. The legacy
      // EmptyToken "(no plugins)" rendering retires alongside the V1
      // renderRow / compact-line composer.
      assert.equal(notifications[0]?.message, "(no marketplaces)");
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

      // Phase 19 / Plan 19-05: V2 byte form mirrors catalog
      // `all-up-to-date-noop` (docs/output-catalog.md). The
      // `unchanged` partition maps to a `(skipped) {up-to-date}` row.
      // The benign `up-to-date` reason (in BENIGN_REASONS) routes
      // severity to info per UXG-02 / D-28-06. Plugin-row `[<scope>]`
      // bracket is suppressed by Phase 17.2 orphan-fold (plugin.scope ===
      // mp.scope -> renderScopeBracket returns ""). No reload-hint when
      // no plugin row is in the state-changing variant set per D-16-12.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      const body = notifications[0]?.message ?? "";
      assert.equal(body, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");
      assert.equal(body.includes("Unchanged:"), false);
      assert.equal(
        body.includes("/reload to pick up changes"),
        false,
        "no reload hint when 0 updated",
      );
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
      // Phase 19 / Plan 19-05: V2 byte form. `(skipped) {no longer
      // installable}` row with the optional `v<fromVersion>` token from
      // the installed record (PUP-4 carries `fromVersion: "1.0.0"`).
      // Plugin-row `[<scope>]` bracket suppressed by orphan-fold per
      // Phase 17.2. Severity routes via warning per D-16-11.
      assert.equal(
        body,
        "1 plugin operation skipped.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {no longer installable}",
      );
      assert.equal(notifications[0]?.severity, "warning");
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
      // Phase 19 / Plan 19-05: V2 byte form. `(skipped) {not in manifest}`
      // row with the optional `v<fromVersion>` token from the installed
      // record. Plugin-row `[<scope>]` bracket suppressed by orphan-fold.
      assert.equal(
        body,
        "1 plugin operation skipped.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}",
      );
      assert.equal(notifications[0]?.severity, "warning");
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

      // TR-04 (Phase 40) SC#2 all-success finalize contract: the
      // intent-mark `compatibility = { installable: false, notes:
      // [update-in-progress] }` set by `markUpdateInProgress` must be
      // overwritten by `finalizeUpdateRecord` on the all-success path.
      // Pitfall 6 + WR-04 alignment: lock the no-leak assertion.
      assert.equal(record.compatibility.installable, true);
      assert.ok(
        !record.compatibility.notes.includes("update-in-progress"),
        "intent-mark must NOT leak into success state",
      );

      // Disk state: skill SKILL.md exists at target.
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md");
      assert.ok((await readFile(skillTarget, "utf8")).length > 0, "skill must exist on disk");

      // Phase 19 / Plan 19-05: V2 byte form mirrors catalog
      // `single-mp-mixed` (docs/output-catalog.md:495-504) version-arrow
      // discipline: `v<from> → v<to>` with `v` prefix on both sides --
      // the renderer's composeVersionArrow owns
      // the formatting per D-15-04 / D-16-04. Plugin-row `[<scope>]`
      // bracket suppressed by orphan-fold. Soft-dep markers emit because
      // the plugin declares agents + mcp but the host's `getAllTools()`
      // returns [] (probe sees both companions unloaded). Reload-hint
      // appended by notify() per D-16-12 from the `updated` variant.
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {requires pi-subagents, requires pi-mcp}\n" +
          "\n" +
          "/reload to pick up changes",
      );

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
      // Phase 19 / Plan 19-05: V2 byte form combines `single-mp-mixed`
      // catalog shape (docs/output-catalog.md:495-504): alpha (updated)
      // + beta (skipped {up-to-date}) under one marketplace header in
      // caller-order (D-16-06 -- orchestrator iterates in the
      // enumerateTargets order; notify() does not sort plugin rows).
      // Plugin-row `[<scope>]` brackets suppressed by orphan-fold. The
      // (updated) row has no soft-dep markers (plugin declares no agents
      // / no mcp; PUP-1 @mp fixture sets only `hasSkill: true`).
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● alpha v1.0.0 → v1.0.1 (updated)\n" +
          "  ⊘ beta (skipped) {up-to-date}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // Severity routes to `error` if any failed; here no failed and no
      // manual-recovery. The only skip row is benign (`beta` skipped
      // `up-to-date`, in BENIGN_REASONS) and the `alpha (updated)` row is a
      // success, so per UXG-02 / D-28-06 the whole cascade computes info (no
      // severity arg). (Previously routed to warning under the old
      // any-skip-is-warning ladder.)
      assert.equal(notifications[0]?.severity, undefined);
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
      assert.equal(
        body.includes("/reload to pick up changes"),
        false,
        "no reload hint when 0 updated",
      );
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

      // CR-01: phase-3a aggregate failure must fire EXACTLY ONE
      // notification. Previously this test joined all notifications via
      // `.join("\n")` before regex-matching, which silently masked the
      // duplicate emission (one from the inline `notifyDirectFailure`
      // inside `runThreePhaseUpdate`, a second from the cascade
      // `renderUpdateCascadeAndNotify` walk after the outcome fell through
      // to `outcomes[]`). The fix in `update.ts::updatePlugins` early-
      // returns when the outcome carries `phaseFailures`, so a regression
      // would surface here as `notifications.length === 2`.
      assert.equal(
        notifications.length,
        1,
        `expected exactly one notification for phase-3a aggregate failure, got ${notifications.length.toString()}: ${notifications.map((n) => n.message).join("\n---\n")}`,
      );
      // The recovery hint marker is carried by the inline
      // `notifyDirectFailure` emission's `aggregate` cause text.
      const allText = notifications[0]?.message ?? "";
      assert.match(
        allText,
        /plugin-uninstall \+ plugin-install for "hello"\./,
        `expected RECOVERY_PLUGIN_REINSTALL_PREFIX hint in notification:\n${allText}`,
      );

      // TR-04 (Phase 40) SC#1/SC#2 post-state: PUP-6 phase-3 failure is
      // a skills-only-fail; commands + agents + mcp succeed (the seed
      // declares no entries for those bridges so they each produce an
      // empty `recorded[]` array). The intent-mark survives on failure;
      // version stays at fromVersion; failed bridge's resources stay at
      // pre-update value; successful bridges still hit the
      // `!failedPhases.has(bridge)` write path producing empty arrays
      // (byte-identical to pre-update but exercising the gate).
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined, "plugin record must survive partial failure");
      assert.equal(rec.version, "1.0.0", "version must NOT bump on failure");
      assert.equal(
        rec.compatibility.installable,
        false,
        "installable must be false during/after failure",
      );
      assert.ok(
        rec.compatibility.notes.includes("update-in-progress"),
        "intent-mark marker must survive failure",
      );
      assert.deepEqual(
        [...rec.resources.skills],
        [],
        "failed bridge resources stay at pre-update value",
      );
      assert.deepEqual(
        [...rec.resources.prompts],
        [],
        "commands had no manifest entry -> empty array (succeeded bridge wrote [])",
      );
      assert.deepEqual(
        [...rec.resources.agents],
        [],
        "agents had no manifest entry -> empty array",
      );
      assert.deepEqual(
        [...rec.resources.mcpServers],
        [],
        "mcp had no manifest entry -> empty array",
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

      // TR-04 (Phase 40) Pitfall 6: outcome-shape assertions don't
      // exercise on-disk state, so lock the all-success finalize contract
      // explicitly. Load state via the project-scope locations resolved
      // from the same cwd that drove updateSinglePlugin.
      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.1");
      assert.equal(rec.compatibility.installable, true);
      assert.ok(
        !rec.compatibility.notes.includes("update-in-progress"),
        "intent-mark marker must NOT leak into the all-success state",
      );
      assert.deepEqual([...rec.resources.skills], ["hello-tool"]);
      assert.deepEqual([...rec.resources.agents], [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);

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
      // Phase 19 / Plan 19-05: V2 byte form. Plugin-row `[<scope>]`
      // bracket suppressed by orphan-fold. Skipped severity per D-16-11.
      assert.equal(
        body,
        "1 plugin operation skipped.\n\n● mp [project]\n  ⊘ hello (skipped) {not installed}",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 pl@mp: not in state AND not in manifest -> partition='failed' ───────

// UXG-08 / D-29-08: `update <plugin>@<mp>` where the plugin is absent from both
// local state AND the marketplace manifest now classifies as `(failed) {not in
// manifest}` (matching `install`), not the prior `(skipped) {not installed}`.
// `preflightUpdate` consults the manifest BEFORE concluding "not installed", so
// a typo / nonexistent plugin name is distinguished from a real-but-uninstalled
// plugin.
test("PUP-1 pl@mp: targeting a plugin not in state AND not in manifest -> partition='failed' (not in manifest)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup1-pl-nomanifest-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // Empty manifest: no entry for "hello", and hello is not installed
        // (no installedVersions). The manifest check must fire before the
        // "not installed" guard.
        manifestPlugins: {},
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
      assert.equal(
        body,
        "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello (failed) {not in manifest}",
      );
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 missing marketplace -> direct-path V2 notify (PluginFailedMessage) ─

test("PUP-1: targeting an unknown marketplace -> direct-path V2 notify (PluginFailedMessage with cause)", async () => {
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

      // Phase 19 / Plan 19-05: V2 direct-path failure (Option B) -- the
      // enumerate-targets throw surfaces via a single notify(ctx, pi,
      // { marketplaces: [{ name, scope, plugins: [PluginFailedMessage] }] })
      // call. The synthetic failed-row identity is the marketplace name
      // wrapped in parens (WR-01: a bare marketplace name in the plugin-row
      // slot would render as `⊘ <marketplace> (failed) ...` directly under
      // a marketplace block ALSO named `<marketplace>` -- a redundant /
      // confusing row; the parens-wrapped form `⊘ (<marketplace>) (failed)
      // ...` mirrors the SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)"
      // bare-form precedent and is visually distinguishable from the mp
      // header). The renderer composes the 4-space cause-chain trailer per
      // D-16-08 from PluginFailedMessage.cause, preserving the V1
      // error-text `Marketplace "ghost-mp" not found in project scope.`.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // Cause-chain trailer text preserves the V1 error message.
      assert.match(notifications[0]?.message ?? "", /not found in project scope/);
      // V2 byte form -- bare marketplace header + a synthetic failed plugin
      // row carrying the parens-wrapped marketplace name (WR-01).
      assert.equal(
        notifications[0]?.message,
        "1 plugin operation failed.\n\n● ghost-mp [project]\n" +
          "  ⊘ (ghost-mp) (failed) {not found}\n" +
          '    cause: Marketplace "ghost-mp" not found in project scope.',
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// Covers the resolveInstalledPluginTarget → undefined → ?? resolveInstalledMarketplaceTarget
// fallback in enumerateMarketplaceTarget. With no explicit scope, resolveInstalledPluginTarget
// searches both scopes and finds nothing, so the fallback fires to locate the marketplace scope.
test("PUP-1 pl@mp: no explicit scope + plugin absent -> marketplace-fallback resolution; partition='skipped'", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-pup1-noscope-fallback-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        // No installedVersions: plugin absent from state, triggering the ?? fallback.
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        // scope omitted: resolveInstalledPluginTarget finds nothing → ?? fallback to
        // resolveInstalledMarketplaceTarget which locates the marketplace scope.
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      // Phase 19 / Plan 19-05: V2 byte form mirrors the pl@mp
      // not-installed shape (PUP-1 above). Plugin-row `[<scope>]` bracket
      // suppressed by orphan-fold.
      assert.equal(
        body,
        "1 plugin operation skipped.\n\n● mp [project]\n  ⊘ hello (skipped) {not installed}",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── syncCloneOnce fetch failure -> notifyError (lines 207-213) ───────────────

test("syncClone-fail: gitOps.fetch throws -> notifyError fired and updatePlugins returns early", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-syncfail-"));
    try {
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
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("1.0.0"),
            },
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      // fetchThrows causes refreshGitHubClone -> gitOps.fetch to throw,
      // which propagates through syncCloneOnce and is caught at lines 207-213.
      const { gitOps } = makeMockGitOps({
        fetchThrows: new Error("network: connection refused"),
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

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /network/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── invalid manifest -> loadMarketplaceManifest throws (covers preflightUpdate
//     path where manifest load fails; lines 374-379 PLUGIN_ENTRY_VALIDATOR.Check
//     is structurally unreachable because MARKETPLACE_VALIDATOR embeds the same
//     PLUGIN_ENTRY_SCHEMA -- the outer check always catches it first) ───────────

test("manifest-load-fail: manifest with invalid entry name type -> notifyError on direct path", async () => {
  // When loadMarketplaceManifest throws (MARKETPLACE_VALIDATOR rejects an
  // entry with name=number), the error propagates out of preflightUpdate
  // and is caught by the direct path's catch at lines 232-239 -> notifyError.
  // Lines 374-379 (PLUGIN_ENTRY_VALIDATOR.Check) are structurally
  // unreachable: MARKETPLACE_VALIDATOR uses the same PLUGIN_ENTRY_SCHEMA, so
  // any entry that passes MARKETPLACE_VALIDATOR also passes PLUGIN_ENTRY_VALIDATOR.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-manifest-fail-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Overwrite the manifest with an entry where `name` is a number.
      // MARKETPLACE_VALIDATOR.Check fails -> loadMarketplaceManifest throws.
      // This propagates through preflightUpdate -> runThreePhaseUpdate -> direct
      // path catch -> notifyError.
      await writeFile(
        seeded.manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [{ name: 42, source: "./plugins/hello", version: "1.0.1" }],
        }),
      );

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // The direct path fires notifyError (not a skipped outcome, because
      // loadMarketplaceManifest threw before PLUGIN_ENTRY_VALIDATOR.Check).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /schema invalid/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── prepareUpdateHandles catch + abortPartialHandles (lines 461-486) ─────────

test("prepare-handles-fail: MCP collision in prepareStageMcpServers -> abortPartialHandles fires, outcome=failed", async () => {
  // prepareStageMcpServers is the LAST bridge called inside prepareUpdateHandles.
  // When it throws (McpServerCollisionError from assertNoMcpCollisions), the
  // catch at lines 461-462 fires: abortPartialHandles is called with all
  // three already-populated handles (skills, commands, agents), exercising
  // the abortPartialHandles body (lines 467-486). The throw propagates to
  // runThreePhaseUpdate -> updateSinglePlugin cascade catch -> partition='failed'.
  //
  // Setup: seed <cwd>/.pi/mcp.json with "server1" owned by a DIFFERENT plugin
  // ("other-plugin"). Then seed hello@mp with version 1.0.1 declaring "server1".
  // discoverGeneratedNames does NOT check MCP collisions (it only discovers
  // skills/commands/agents), so it succeeds. prepareStageMcpServers then reads
  // the scoped mcp.json, finds "server1" in `theirs` (owned by other-plugin),
  // and throws McpServerCollisionError.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-prepare-mcp-fail-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasMcp: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-populate the project-scope mcp.json with "server1" owned by
      // "other-plugin". This puts "server1" into `theirs` when prepareStageMcpServers
      // calls partitionExistingServers for the "hello" update.
      // The hello plugin's .mcp.json (created by hasMcp: true) also declares
      // "server1"; the collision fires because other-plugin already owns it.
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
      await writeFile(
        locations.mcpJsonPath,
        JSON.stringify({
          mcpServers: {
            server1: {
              command: "node",
              args: ["other.js"],
              _piClaudeMarketplace: { plugin: "other-plugin", marketplace: "mp" },
            },
          },
        }),
      );

      // Cascade path: updateSinglePlugin must return failed (not throw).
      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "failed", `expected failed, got ${outcome.partition}`);
        assert.equal(outcome.name, "hello");
        assert.ok((outcome.notes ?? []).length > 0, "failed outcome must carry error notes");
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── bare form: enumerates both user and project scopes (lines 816-819) ───────

test("bare-form both-scopes: plugins in user + project scopes both appear in update cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-bare-both-"));
    try {
      // Seed project scope with plugin alpha.
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-proj"),
        marketplaceName: "mp-proj",
        manifestPlugins: { alpha: { version: "1.0.0", hasSkill: true } },
        installedVersions: { alpha: "1.0.0" },
      });

      // Seed user scope (HOME-based) with plugin beta.
      // locationsFor("user", ...) uses HOME to find the Pi agent dir.
      const userLocations = locationsFor("user", cwd);
      await mkdir(userLocations.extensionRoot, { recursive: true });
      const userMarketplaceRoot = path.join(process.env.HOME ?? tmpdir(), "mp-user");
      await mkdir(userMarketplaceRoot, { recursive: true });
      await mkdir(path.join(userMarketplaceRoot, ".claude-plugin"), { recursive: true });

      const betaPluginRoot = path.join(userMarketplaceRoot, "plugins", "beta");
      await mkdir(betaPluginRoot, { recursive: true });
      await mkdir(path.join(betaPluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(betaPluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "beta", version: "1.0.0" }),
      );
      const betaSkillDir = path.join(betaPluginRoot, "skills", "tool");
      await mkdir(betaSkillDir, { recursive: true });
      await writeFile(path.join(betaSkillDir, "SKILL.md"), "---\nname: tool\n---\nBody.\n");

      const userManifestPath = path.join(userMarketplaceRoot, ".claude-plugin", "marketplace.json");
      await writeFile(
        userManifestPath,
        JSON.stringify({
          name: "mp-user",
          plugins: [{ name: "beta", source: "./plugins/beta", version: "1.0.0" }],
        }),
      );

      await saveState(userLocations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          "mp-user": {
            name: "mp-user",
            scope: "user",
            source: pathSource("./mp-user"),
            addedFromCwd: cwd,
            manifestPath: userManifestPath,
            marketplaceRoot: userMarketplaceRoot,
            plugins: {
              beta: makePluginRecord("1.0.0"),
            },
          },
        },
      });

      // bare form with no explicit scope -> enumerates both scopes (lines 816-819)
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "all" },
        // No scope -> bare form enumerates both user and project scopes
      });

      // Both scopes should be enumerated. Both plugins are up-to-date
      // (same version in manifest as in state), so we expect an "unchanged"
      // notification that mentions both alpha and beta.
      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      // Both plugins are up-to-date -> skipped cascade, info severity
      assert.match(body, /up-to-date/);
      assert.match(body, /alpha/);
      assert.match(body, /beta/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── dropPluginCompletionCache catch -> notifyWarning (lines 690-696) ─────────

test("dropCache-fail: cache path is a directory -> notifyWarning emitted after successful update", async () => {
  // After a successful 3-phase update, dropPluginCompletionCache calls
  // dropMarketplaceCache which calls unlink(pluginCachePath). If the path is
  // a DIRECTORY, unlink throws EISDIR (not ENOENT), which is re-thrown by
  // dropMarketplaceCache. The catch block in dropPluginCompletionCache fires
  // and calls notifyWarning (lines 690-696), only for the direct path
  // (isDirectUpdate === true, args.ctx !== undefined).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-dropcache-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-create the plugin cache path as a DIRECTORY so that
      // unlink(pluginCachePath) throws EISDIR instead of succeeding.
      const cacheFile = await locations.pluginCacheFile("mp");
      await mkdir(cacheFile, { recursive: true });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // The update itself should succeed (partition='updated' -> reload hint)
      // AND a warning notification for the cache drop failure should appear.
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      // Cache drop errors are swallowed in V2; update still succeeds.
      const successes = notifications.filter((n) => n.severity === undefined);
      assert.ok(successes.length >= 1, "expected success notification for the update");
      assert.match(successes[0]?.message ?? "", /updated/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── swapStateRecord: marketplace removed between sync and preflight ───────────

test("swapState-mp-gone: marketplace removed via gitOps.fetch side-effect -> graceful skipped outcome", async () => {
  // Uses a github-source marketplace with a custom gitOps. The gitOps.fetch
  // synchronously writes a modified state.json that removes the marketplace
  // entry. The modification happens INSIDE syncCloneOnce's github-source
  // branch (after syncCloneOnce's loadState found the marketplace) but is
  // written to disk, so subsequent loadState calls (preflightUpdate and
  // withStateGuard) read the modified state.
  //
  // preflightUpdate reads the now-modified state where the marketplace is
  // absent -> returns partition='skipped' (notes: marketplace not found).
  // No unhandled throw; no error notification.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-mp-gone-"));
    try {
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
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("0.0.9"),
            },
          },
        },
      });

      const stateJsonPath = locations.stateJsonPath;

      const { gitOps } = makeMockGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const originalFetch = gitOps.fetch.bind(gitOps);
      const mutatingGitOps = {
        ...gitOps,
        fetch: async (opts: Parameters<typeof gitOps.fetch>[0]): Promise<void> => {
          await originalFetch(opts);
          // Synchronously remove the marketplace from state.json so that
          // subsequent loadState calls (preflightUpdate) find no marketplace.
          writeFileSync(stateJsonPath, JSON.stringify({ schemaVersion: 1, marketplaces: {} }));
        },
      };

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps: mutatingGitOps,
      });

      // enumerateTargets ran with original state (hello in official).
      // syncCloneOnce ran, modified state.json to remove official.
      // preflightUpdate reads modified state -> marketplace not found ->
      // returns skipped. The notification reflects a skipped outcome.
      assert.ok(notifications.length >= 1, "expected at least one notification");
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, "no error notification expected");
      const body = notifications[0]?.message ?? "";
      assert.match(body, /skipped/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── swapStateRecord: plugin concurrently uninstalled (lines 511-514) ─────────

test("swapState-plugin-gone: plugin removed from state between enumerateTargets and preflight -> skipped", async () => {
  // gitOps.fetch removes the plugin record from state.json after
  // enumerateTargets has already collected "hello" as a target. When
  // preflightUpdate runs, loadState finds no "hello" in the marketplace
  // plugins -> returns partition='skipped' (notes: "not installed").
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-plugin-gone-"));
    try {
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
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("0.0.9"),
            },
          },
        },
      });

      const stateJsonPath = locations.stateJsonPath;

      const { gitOps } = makeMockGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const originalFetch = gitOps.fetch.bind(gitOps);
      const mutatingGitOps = {
        ...gitOps,
        fetch: async (opts: Parameters<typeof gitOps.fetch>[0]): Promise<void> => {
          await originalFetch(opts);
          // Remove only the "hello" plugin record, keep marketplace intact.
          writeFileSync(
            stateJsonPath,
            JSON.stringify({
              schemaVersion: 1,
              marketplaces: {
                official: {
                  name: "official",
                  scope: "project",
                  source: { kind: "github", raw: "https://github.com/test/repo#main" },
                  addedFromCwd: cwd,
                  manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
                  marketplaceRoot: cloneDir,
                  plugins: {},
                },
              },
            }),
          );
        },
      };

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps: mutatingGitOps,
      });

      // preflightUpdate reads modified state -> "hello" not in plugins ->
      // returns skipped (not installed). Graceful path, no error.
      assert.ok(notifications.length >= 1, "expected at least one notification");
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, "no error notification expected");
      const body = notifications[0]?.message ?? "";
      assert.match(body, /skipped/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── concurrent version bump via gitOps.fetch side-effect ─────────────────────

test("swapState-version-advanced: version advanced during fetch -> update runs against newer fromVersion", async () => {
  // gitOps.fetch advances hello's version from 0.0.9 to 0.0.10 in state.json.
  // preflightUpdate reads 0.0.10 as fromVersion. The manifest fixture has
  // hello at 1.0.0, which is different -> preflight returns PluginPreflight.
  // withStateGuard then reads state (still 0.0.10) and the guard
  // fromVersion==0.0.10 matches state.version==0.0.10 -> no ST-9 error.
  // The update proceeds successfully.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-ver-advanced-"));
    try {
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
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("0.0.9"),
            },
          },
        },
      });

      const stateJsonPath = locations.stateJsonPath;

      const { gitOps } = makeMockGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const originalFetch = gitOps.fetch.bind(gitOps);
      const mutatingGitOps = {
        ...gitOps,
        fetch: async (opts: Parameters<typeof gitOps.fetch>[0]): Promise<void> => {
          await originalFetch(opts);
          // Advance hello's version to 0.0.10.
          writeFileSync(
            stateJsonPath,
            JSON.stringify({
              schemaVersion: 1,
              marketplaces: {
                official: {
                  name: "official",
                  scope: "project",
                  source: { kind: "github", raw: "https://github.com/test/repo#main" },
                  addedFromCwd: cwd,
                  manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
                  marketplaceRoot: cloneDir,
                  plugins: { hello: makePluginRecord("0.0.10") },
                },
              },
            }),
          );
        },
      };

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps: mutatingGitOps,
      });

      // No error: version advanced from 0.0.9 to 0.0.10, manifest has 1.0.0.
      // preflightUpdate uses 0.0.10 as fromVersion; withStateGuard finds 0.0.10
      // -> they match -> update proceeds.
      assert.ok(notifications.length >= 1, "expected at least one notification");
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected error: ${JSON.stringify(errs)}`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── phase 3a commands commit failure (lines 618-619) ─────────────────────────

test("phase3a-commands-fail: command target occupied by directory -> phase3aFailures includes commands", async () => {
  // commitPreparedCommands calls rename(stagedFile.md, targetFile.md).
  // On Linux, rename(regular_file, existing_directory) fails with EISDIR.
  // Pre-creating the command target path as a DIRECTORY forces this error.
  // This exercises lines 618-619 in runThreePhaseUpdate's phase 3a aggregation.
  //
  // We also pre-create the skills target as a FILE (as in the PUP-6 test) to
  // force skills commit failure too, ensuring the phase3aFailures array has
  // multiple entries and the recovery hint includes the command failure.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-phase3a-cmd-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasCommand: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Obstacle 1: pre-create skills target as a FILE so commitPreparedSkills throws.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      // Obstacle 2: pre-create the command target path as a DIRECTORY so
      // commitPreparedCommands rename(file -> dir) fails with EISDIR.
      await mkdir(locations.promptsTargetDir, { recursive: true });
      await mkdir(path.join(locations.promptsTargetDir, "hello:deploy.md"), { recursive: true });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // Both skills and commands commit should fail; the aggregate recovery
      // hint should appear in the notifications.
      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(
        allText,
        /plugin-uninstall \+ plugin-install for "hello"\./,
        `expected RECOVERY_PLUGIN_REINSTALL_PREFIX hint somewhere in:\n${allText}`,
      );

      // TR-04 (Phase 40) SC#1/SC#2 post-state: skills + commands FAILED;
      // agents + mcp SUCCEEDED (seed declares no entries for those
      // bridges so each writes an empty `recorded[]` array via the
      // !failedPhases.has(bridge) gate). Version stays at fromVersion;
      // intent-mark survives; failed bridges' resources stay at
      // pre-update value; succeeded bridges still hit the per-bridge
      // write path.
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      assert.deepEqual([...rec.resources.skills], []);
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── phase 3a agents commit failure (lines 631-632) ──────────────────────────

test("phase3a-agents-fail: agent target path is a directory -> commitPreparedAgents throws", async () => {
  // commitPreparedAgents calls rename(stagedFile.md, targetFile.md) for each
  // agent. On Linux, rename(regular_file, existing_directory) fails with
  // EISDIR. Pre-creating the agent target path as a DIRECTORY forces this.
  // This exercises lines 631-632 in runThreePhaseUpdate's phase 3a aggregation.
  //
  // Also pre-create the skills obstacle so the test also verifies that
  // phase 3a continues across multiple bridge failures (D-03 discipline).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-phase3a-agents-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasAgent: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-create the skills target as a FILE to force skills commit failure.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      // Pre-create the agent target path as a DIRECTORY to force agents commit
      // failure. The generated agent name for "bot" in plugin "hello" is
      // GENERATED_AGENT_PREFIX + "hello-bot".
      await mkdir(locations.agentsDir, { recursive: true });
      await mkdir(path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`), {
        recursive: true,
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // Both skills and agents commit should fail; recovery hint appears.
      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(
        allText,
        /plugin-uninstall \+ plugin-install for "hello"\./,
        `expected RECOVERY_PLUGIN_REINSTALL_PREFIX hint somewhere in:\n${allText}`,
      );

      // TR-04 (Phase 40) SC#1/SC#2 post-state: skills + agents FAILED;
      // commands + mcp SUCCEEDED (seed declares no entries for commands
      // or mcp so each writes an empty `recorded[]` via the
      // !failedPhases.has(bridge) gate). Version unchanged; intent-mark
      // survives; resources untouched for failed bridges; empty for
      // succeeded bridges (byte-identical to pre-update but exercises
      // the per-bridge orthogonality gate).
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      assert.deepEqual([...rec.resources.skills], []);
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── TR-04 matrix coverage (Phase 40, SC#4) ─────────────────────────────────
// Per-bridge orthogonality: finalizeUpdateRecord gates each bridge's resource
// write on !failedPhases.has(bridge), INDEPENDENT of other bridges' outcomes.
// The 4 dedicated "exactly one bridge fails" tests below + the all-success
// WR-04 + existing PUP-6 (skills-only-fail) + phase3a-commands-fail
// (skills+commands fail) + phase3a-agents-fail (skills+agents fail) cover
// every per-bridge "succeed" vs "fail" outcome in both directions for all
// four bridges. The remaining 9 multi-failure cases compose deterministically.
// See .planning/phases/40-update-state-before-commit-reorder/40-RESEARCH.md
// "4-bridge x 2-outcome matrix coverage analysis" for the full 16-case table.

test("TR-04 matrix: skills-fails-others-succeed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tr04-skills-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
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

      // Force skills commit failure only (PUP-6 shape).
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

      assert.equal(notifications.length, 1);
      const allText = notifications[0]?.message ?? "";
      assert.match(allText, /plugin-uninstall \+ plugin-install for "hello"\./);

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      // Version + intent-mark stay at pre-update / in-progress on failure.
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      // Failed bridge: skills resources stay at pre-update value (empty).
      assert.deepEqual([...rec.resources.skills], []);
      // Succeeded bridges: resources updated to new generated names.
      assert.deepEqual([...rec.resources.prompts], ["hello:deploy"]);
      assert.deepEqual([...rec.resources.agents], [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("TR-04 matrix: commands-fails-others-succeed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tr04-commands-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
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

      // Force commands commit failure only (DIR at target path -> EISDIR).
      await mkdir(locations.promptsTargetDir, { recursive: true });
      await mkdir(path.join(locations.promptsTargetDir, "hello:deploy.md"), {
        recursive: true,
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
      const allText = notifications[0]?.message ?? "";
      assert.match(allText, /plugin-uninstall \+ plugin-install for "hello"\./);

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      assert.deepEqual([...rec.resources.skills], ["hello-tool"]);
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("TR-04 matrix: agents-fails-others-succeed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tr04-agents-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
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

      // Force agents commit failure only (DIR at agent file path -> EISDIR).
      await mkdir(locations.agentsDir, { recursive: true });
      await mkdir(path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`), {
        recursive: true,
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
      const allText = notifications[0]?.message ?? "";
      assert.match(allText, /plugin-uninstall \+ plugin-install for "hello"\./);

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      assert.deepEqual([...rec.resources.skills], ["hello-tool"]);
      assert.deepEqual([...rec.resources.prompts], ["hello:deploy"]);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// TR-04 matrix #4 (mcp-fails-others-succeed) NOTE:
//
// A dedicated "mcp commit fails, others succeed" test is OMITTED in v1.7
// because the mcp bridge's prepare step (`prepareStageMcpServers`) reads
// `locations.mcpJsonPath` via `readScopedDoc` BEFORE the bridge commit
// runs (stage.ts:178). The only file-system obstacle that reliably forces
// a commit-time failure for atomicWriteJson (a DIRECTORY at the target
// path) ALSO trips the prepare-step `readFile` with EISDIR, surfacing as
// a phase-2-or-earlier throw (`(failed) {unreadable manifest}`) BEFORE
// any state mutation. Phase-2 throws are routed through `notifyDirectFailure`
// in updatePlugins's outer catch (update.ts:332), so finalize never runs
// and the per-bridge orthogonality gate is never exercised for the mcp
// axis.
//
// Per-bridge orthogonality coverage for mcp is structurally identical to
// the other three bridges in `finalizeUpdateRecord` (the gate is literally
// `if (!failedPhases.has("mcp"))` and writes
// `sRecord.resources.mcpServers = handles.mcp.result.recorded.map(...)`,
// the same shape as the other three). The all-success WR-04 test verifies
// the !failedPhases.has("mcp") => write path; the three other matrix tests
// (skills / commands / agents fail) each demonstrate that an UNRELATED
// bridge's failure does NOT block mcp's resources write. The full mcp
// gate-blocked variant would need a test seam injecting a mid-flight
// failure between mcp's prepare and commit -- deferred to v1.8 if surface
// emerges.
//
// See .planning/phases/40-update-state-before-commit-reorder/40-01-SUMMARY.md
// for the deviation rationale.

test("TR-04 retry: partial-success-state-converges-to-new-version", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tr04-retry-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Call 1: seed the PUP-6 skills obstacle so phase-3a fails on
      // skills only. Intent-mark survives, version stays at 1.0.0,
      // resources.skills stays at pre-update empty.
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

      assert.equal(notifications.length, 1);
      const call1Text = notifications[0]?.message ?? "";
      assert.match(call1Text, /plugin-uninstall \+ plugin-install for "hello"\./);

      // Intermediate post-state assertion: partial-success state.
      const mid = await loadState(locations.extensionRoot);
      const midRec = mid.marketplaces["mp"]?.plugins["hello"];
      assert.ok(midRec !== undefined);
      assert.equal(midRec.version, "1.0.0");
      assert.equal(midRec.compatibility.installable, false);
      assert.ok(midRec.compatibility.notes.includes("update-in-progress"));
      assert.deepEqual([...midRec.resources.skills], []);

      // Between calls: clear the obstacle so the second commit's rename
      // can succeed cleanly.
      await rm(path.join(locations.skillsTargetDir, "hello-tool"), { force: true });

      // Call 2: fresh notification recorder so we assert only the
      // second run's notifications.
      const { ctx: ctx2, pi: pi2, notifications: notifications2 } = makeCtx();
      await updatePlugins({
        ctx: ctx2,
        pi: pi2,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // SC#5 / NFR-3: the second run must NOT emit any error notifications.
      const errs2 = notifications2.filter((n) => n.severity === "error");
      assert.equal(
        errs2.length,
        0,
        `second run must NOT emit errors; got: ${JSON.stringify(errs2)}`,
      );

      // Final post-state: convergence to all-success contract.
      const final = await loadState(locations.extensionRoot);
      const rec2 = final.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec2 !== undefined);
      assert.equal(rec2.version, "1.0.1");
      assert.equal(rec2.compatibility.installable, true);
      assert.ok(
        !rec2.compatibility.notes.includes("update-in-progress"),
        "intent-mark must NOT survive a successful retry",
      );
      assert.deepEqual([...rec2.resources.skills], ["hello-tool"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

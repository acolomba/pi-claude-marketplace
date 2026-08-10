import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

import { GENERATED_AGENT_PREFIX } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import {
  updatePlugins,
  updateSinglePlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { UpdateCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
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
// Byte-exact assertions match the catalog forms at
// docs/output-catalog.md:489-568 (plugin update). The `[<scope>]`
// plugin-row bracket is suppressed by orphan-fold (plugin.scope
// === mp.scope -> renderScopeBracket returns ""). Empty-targets renders
// `(no marketplaces)` via notify({ marketplaces: [] }), mirroring
// orchestrators/marketplace/update.ts. Direct-path
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
  overrides: Partial<PluginRecord["resources"]> & { enabled?: boolean } = {},
): PluginRecord {
  const { enabled = true, ...resources } = overrides;
  return {
    version,
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    // Default to a populated skill so the update flow exercises the
    // enabled-update path, not the disabled-record short-circuit (ENBL-02).
    resources: {
      skills: resources.skills ?? ["seeded-skill"],
      prompts: resources.prompts ?? [],
      agents: resources.agents ?? [],
      mcpServers: resources.mcpServers ?? [],
      hooks: resources.hooks ?? [],
    },
    enabled,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * D-UPD test helper: seeded record with `enabled: false` -- the ENBL-02
 * disabled marker that `isRecordedButDisabled` reads. The `update`
 * orchestrator must refresh the version/source pin but keep the record
 * disabled (artifacts re-materialize on the next `enable`).
 */
function makeDisabledPluginRecord(version: string): PluginRecord {
  return makePluginRecord(version, {
    enabled: false,
    skills: [],
    prompts: [],
    agents: [],
    mcpServers: [],
    hooks: [],
  });
}

/**
 * ENBL-09 test helper: the disabled PARTIAL shape. Disabled-ness (`enabled`)
 * and availability (`compatibility.installable`) are orthogonal axes, so this
 * record carries `enabled: false` beside a FALSE availability discriminant and
 * a non-empty unsupported list -- the two fields that must stay in agreement
 * after `update` refreshes the block.
 */
function makeDisabledPartialPluginRecord(version: string): PluginRecord {
  return {
    ...makeDisabledPluginRecord(version),
    compatibility: {
      installable: false,
      notes: [],
      supported: ["skills"],
      unsupported: ["themes"],
    },
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
  /** Map of plugin name -> { version, hasSkill?, hasCommand?, hasAgent?, hasMcp?, hooksJson? } */
  manifestPlugins: Record<
    string,
    {
      version: string;
      rawSourceOverride?: unknown;
      hasSkill?: boolean;
      hasCommand?: boolean;
      hasAgent?: boolean;
      hasMcp?: boolean;
      /** WR-03: seed `<pluginRoot>/hooks/hooks.json` with this payload. */
      hooksJson?: object;
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

    // WR-03: seed hooks payload so the resolver advertises hooksConfigPath
    // and the update ledger exercises the cache+rebuild path.
    if (spec.hooksJson !== undefined) {
      const hooksDir = path.join(pluginRoot, "hooks");
      await mkdir(hooksDir, { recursive: true });
      await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(spec.hooksJson));
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
      // Empty-targets shape mirrors orchestrators/marketplace/update.ts --
      // notify({ marketplaces: [] }) renders the renderer's
      // `(no marketplaces)` sentinel per D-16-17.
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

      // V2 byte form mirrors catalog
      // `all-up-to-date-noop` (docs/output-catalog.md). The
      // `unchanged` partition maps to a `(skipped) {up-to-date}` row.
      // The benign `up-to-date` reason (in BENIGN_REASONS) routes
      // severity to info per UXG-02 / D-28-06. Plugin-row `[<scope>]`
      // bracket is suppressed by orphan-fold (plugin.scope ===
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
        // MM-3 / PR-2: github-source plugin entry is not installable.
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
      // V2 byte form. `(skipped) {no longer
      // installable}` row with the optional `v<fromVersion>` token from
      // the installed record (PUP-4 carries `fromVersion: "1.0.0"`).
      // Plugin-row `[<scope>]` bracket suppressed by orphan-fold.
      // Severity routes via warning per D-16-11.
      assert.equal(
        body,
        "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {no longer installable}",
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
      // V2 byte form. `(skipped) {not in manifest}`
      // row with the optional `v<fromVersion>` token from the installed
      // record. Plugin-row `[<scope>]` bracket suppressed by orphan-fold.
      assert.equal(
        body,
        "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── LIFE-05 / D-98-13: the manifest-absent skip on all three enumeration paths ─
//
// `UpdatePluginsTarget` has three shapes -- targeted (`plugin` + `marketplace`),
// marketplace-bulk (`marketplace`), and global-bulk (`all`) -- and all three
// converge on the SAME `preflightUpdate` arm that returns `partition: "skipped"`
// with `reasons: ["not in manifest"]` when the refreshed manifest no longer
// lists the installed entry. PUP-5 above pins the targeted shape; the two cases
// below pin the remaining two, byte for byte, so a future change to
// `enumerateTargets` cannot silently drop the skip on a bulk path.
//
// Both bulk shapes render the SAME row bytes as the targeted shape: the
// `[project]` bracket rides the marketplace header, and the plugin-row bracket
// is suppressed by orphan-fold (plugin.scope === mp.scope). The bulk bodies
// carry ONE extra line the targeted body does not: the OUT-03 / D-04 tally,
// which renders on `cardinality: "plural"` operations only. The tally is an
// orthogonal contract -- the skip row itself is unchanged across all three
// paths, which is what these cases pin.

/**
 * The byte form the targeted case (PUP-5) pins, reused verbatim by both bulk
 * cases. Copied rather than referenced so PUP-5 stays an independent pin: two
 * assertions of the same literal catch a drift that one shared constant would
 * hide on both sides at once.
 */
const MANIFEST_ABSENT_UPDATE_BODY =
  "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}";

/** The bulk-form body: the targeted row bytes plus the plural-cardinality tally. */
const MANIFEST_ABSENT_BULK_BODY = `${MANIFEST_ABSENT_UPDATE_BODY}\n\nPlugin update: 1 warning`;

test("LIFE-05: marketplace-bulk target renders `(skipped) {not in manifest}`, and a repeated update is byte-identical", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-life05-mp-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // The marketplace drops the entry after install.
      await rewriteManifest(seeded.manifestPath, "mp", {});

      const firstRun = makeCtx();
      await updatePlugins({
        ctx: firstRun.ctx,
        pi: firstRun.pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(firstRun.notifications.length, 1);
      assert.equal(firstRun.notifications[0]?.message, MANIFEST_ABSENT_BULK_BODY);
      assert.equal(firstRun.notifications[0]?.severity, "warning");

      // NFR-3: the skip arm is idempotent. Re-running the same update over the
      // same state must render the same bytes -- a drifting second run would
      // mean the first run mutated something the row reads.
      const secondRun = makeCtx();
      await updatePlugins({
        ctx: secondRun.ctx,
        pi: secondRun.pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(secondRun.notifications.length, 1);
      assert.equal(secondRun.notifications[0]?.message, firstRun.notifications[0]?.message);
      assert.equal(secondRun.notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-05: global-bulk target renders `(skipped) {not in manifest}` and writes NO state", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-life05-all-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      await rewriteManifest(seeded.manifestPath, "mp", {});

      const readRecord = async (): Promise<PluginRecord | undefined> => {
        const state = await loadState(locations.extensionRoot);
        return state.marketplaces["mp"]?.plugins["hello"];
      };

      const before = await readRecord();
      assert.ok(before !== undefined);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({ ctx, pi, scope: "project", cwd, target: { kind: "all" } });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, MANIFEST_ABSENT_BULK_BODY);
      assert.equal(notifications[0]?.severity, "warning");

      // NFR-1 / NFR-3: the skip returns BEFORE any state mutation, so an
      // interrupted run cannot leave a half-written record behind. Deep
      // equality over the whole record covers the version pin, the resolved
      // source, the compatibility block, and the resource lists at once.
      assert.deepEqual(await readRecord(), before);
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

      // TR-04 SC#2 all-success finalize contract: the
      // intent-mark `compatibility = { installable: false, notes:
      // [update-in-progress] }` set by `markUpdateInProgress` must be
      // overwritten by `finalizeUpdateRecord` on the all-success path.
      // WR-04 alignment: lock the no-leak assertion.
      assert.equal(record.compatibility.installable, true);
      assert.ok(
        !record.compatibility.notes.includes("update-in-progress"),
        "intent-mark must NOT leak into success state",
      );

      // Disk state: skill SKILL.md exists at target.
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md");
      assert.ok((await readFile(skillTarget, "utf8")).length > 0, "skill must exist on disk");

      // V2 byte form mirrors catalog
      // `single-mp-mixed` (docs/output-catalog.md:495-504) version-arrow
      // discipline: `v<from> → v<to>` with `v` prefix on both sides --
      // the renderer's composeVersionArrow owns
      // the formatting per D-15-04 / D-16-04. Plugin-row `[<scope>]`
      // bracket suppressed by orphan-fold. Soft-dep markers emit because
      // the plugin declares agents + mcp but the host's `getAllTools()`
      // returns [] (probe sees both companions unloaded). Reload-hint
      // appended by notify() per D-16-12 from the `updated` variant.
      // SEV-01: the update declares agents + mcp while both companions are
      // unloaded, so the success row stamps warning (symmetric with the install
      // success arm) -- the cascade gains the `needs attention` summary line.
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "A plugin operation needs attention.\n" +
          "\n" +
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
      // Catalog `single-mp-mixed` shape: alpha (updated) under one marketplace
      // header. UGRM-01: the `beta (skipped) {up-to-date}` row is suppressed for
      // the bulk (`@mp`, plural) form -- only the realized transition renders.
      // Plugin-row `[<scope>]` brackets suppressed by orphan-fold. The (updated)
      // row has no soft-dep markers (plugin declares no agents / no mcp; the
      // @mp fixture sets only `hasSkill: true`). UGRM-02: the trailing tally
      // counts realized transitions only -- one `updated` row -> `1 updated`
      // (the verb has no plural-s); the suppressed up-to-date row no longer
      // inflates the count.
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● alpha v1.0.0 → v1.0.1 (updated)\n" +
          "\n" +
          "Plugin update: 1 updated\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // Severity routes to `error` if any failed; here no failed and no
      // manual-recovery. The only skip row is benign (`beta` skipped
      // `up-to-date`, in BENIGN_REASONS) and the `alpha (updated)` row is a
      // success, so per UXG-02 / D-28-06 the whole cascade computes info (no
      // severity arg).
      assert.equal(notifications[0]?.severity, undefined);
      assert.ok(seeded.marketplaceRoot.length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── UGRM-02: plural tally counts every realized transition ───────────────────

test("UGRM-02: bulk @mp update with TWO realized transitions tallies `2 updated` (verb invariant, no plural-s)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tally-2updated-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // Both bumped -> two realized `updated` transitions, no obstacles.
          alpha: { version: "1.0.1", hasSkill: true },
          beta: { version: "1.0.1", hasSkill: true },
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

      // UGRM-02: the trailing tally counts realized transitions -- two `updated`
      // rows -> `2 updated`. The verb has no plural-s (the count carries the
      // plurality). The realized-transition cascade appends the reload trailer.
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● alpha v1.0.0 → v1.0.1 (updated)\n" +
          "  ● beta v1.0.0 → v1.0.1 (updated)\n" +
          "\n" +
          "Plugin update: 2 updated\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // Two benign success rows, no failures/warnings -> info (severity unset).
      assert.equal(notifications[0]?.severity, undefined);
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
      // notification. A duplicate emission would be one from the inline
      // `notifyDirectFailure` inside `runThreePhaseUpdate`, a second from
      // the cascade `renderUpdateCascadeAndNotify` walk after the outcome
      // fell through to `outcomes[]`. `update.ts::updatePlugins`
      // early-returns when the outcome carries `phaseFailures`, so a
      // regression would surface here as `notifications.length === 2`.
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

      // TR-04 SC#1/SC#2 post-state: PUP-6 phase-3 failure is
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
        ["seeded-skill"],
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

// ─── WR-01: phase-3a abort with up-to-date predecessors -> no spurious no-op ──

test("WR-01: bulk update where an up-to-date plugin precedes a phase-3a failure does NOT emit 'nothing to update'", async () => {
  // A bulk (`@mp`, plural) update enumerates `aaa` (up-to-date, partition
  // `unchanged`) BEFORE `zzz` (bumped, but phase-3a-fails on a skill-target
  // collision). State insertion order (`Object.keys(mp.plugins)`) is the
  // `installedVersions` key order, so `aaa` is accumulated into `outcomes`
  // (then bulk-suppressed) before `zzz` aborts the batch.
  //
  // The failing plugin fires its own `notifyDirectFailure` and is withheld from
  // `outcomes`, so the abort path renders a cascade for the already-accumulated
  // `aaa` outcome. Pre-fix, that all-`unchanged` accumulator passed the no-op
  // gate (0 updated, 0 error/warning rows in the cascade) and emitted a SECOND
  // notification reading `Plugin update: nothing to update` -- contradictory,
  // directly after a failure for the same invocation. The `abortedByFailure`
  // flag now suppresses that headline.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr01-abort-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // aaa: manifest version == installed version -> unchanged.
          aaa: { version: "1.0.0", hasSkill: true },
          // zzz: bumped -> realized transition attempted, but phase-3a fails.
          zzz: { version: "1.0.1", hasSkill: true },
        },
        // Insertion order seeds state.plugins as [aaa, zzz] so enumeration
        // accumulates the unchanged `aaa` outcome before `zzz` aborts.
        installedVersions: { aaa: "1.0.0", zzz: "1.0.0" },
      });

      // Force the phase-3a failure for `zzz` only: pre-create its skill TARGET
      // as a FILE so the bridge's `rename(stagingDir -> target)` returns ENOTDIR
      // (the PUP-6 mechanism). The generated skill name is `<plugin>-<skillDir>`
      // = `zzz-tool`. `aaa` has no obstacle, so it cleanly partitions unchanged.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "zzz-tool"), "obstacle");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // Exactly one notification: the `zzz` phase-3a failure. The spurious
      // `nothing to update` headline must NOT be emitted on the abort path.
      assert.equal(
        notifications.length,
        1,
        `expected exactly one (failure) notification, got ${notifications.length.toString()}: ${notifications.map((n) => n.message).join("\n---\n")}`,
      );
      const allText = notifications.map((n) => n.message).join("\n");
      assert.equal(
        allText.includes("Plugin update: nothing to update"),
        false,
        `must NOT emit the no-op headline after a phase-3a abort:\n${allText}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: a CLEANLY-UPDATED predecessor before a phase-3a abort stays visible -- the failure notification AND the committed `(updated)` cascade both render", async () => {
  // Companion of the up-to-date-predecessor WR-01 case above: there `aaa` was
  // `unchanged` (bulk-suppressed -> empty cascade -> nothing rendered). Here
  // `aaa` is a REALIZED transition (bumped, commits cleanly) accumulated BEFORE
  // `zzz` aborts on a skill-target collision. The abort path must still render
  // the committed `aaa (updated)` row so a successful predecessor update never
  // vanishes behind the failure.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr01-abort-committed-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // aaa: bumped, no obstacle -> commits cleanly (realized `updated`).
          aaa: { version: "1.0.1", hasSkill: true },
          // zzz: bumped, but phase-3a fails on the pre-created skill-target file.
          zzz: { version: "1.0.1", hasSkill: true },
        },
        // Insertion order seeds state.plugins as [aaa, zzz] so `aaa` is committed
        // and accumulated into `outcomes` before `zzz` aborts the batch.
        installedVersions: { aaa: "1.0.0", zzz: "1.0.0" },
      });

      // Force the phase-3a failure for `zzz` only: pre-create its skill TARGET
      // (`zzz-tool`) as a FILE so the bridge's `rename(staging -> target)`
      // returns ENOTDIR. `aaa`'s target (`aaa-tool`) is unobstructed.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "zzz-tool"), "obstacle");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // Exactly two notifications: the `zzz` phase-3a failure (inline
      // notifyDirectFailure) AND the abort cascade for the committed `aaa`.
      assert.equal(
        notifications.length,
        2,
        `expected 2 notifications, got ${notifications.length.toString()}: ${notifications.map((n) => n.message).join("\n---\n")}`,
      );
      const failure = notifications.find((n) =>
        n.message.includes('plugin-uninstall + plugin-install for "zzz".'),
      );
      assert.ok(failure !== undefined, "the zzz phase-3a failure notification must be present");
      const cascade = notifications.find((n) =>
        n.message.includes("● aaa v1.0.0 → v1.0.1 (updated)"),
      );
      assert.ok(cascade !== undefined, "the committed aaa (updated) cascade must be present");
      // The committed predecessor still tallies as a realized transition.
      assert.match(cascade.message, /Plugin update: 1 updated/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-7 / WR-04: success populates stagedAgentNames + stagedMcpServerNames ─────────

test("WR-04: successful update populates stagedAgentNames + stagedMcpServerNames on outcome", async () => {
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
        assert.ok(outcome.stagedAgentNames !== undefined);
        assert.ok(outcome.stagedAgentNames.length > 0, "stagedAgentNames must be populated");
        assert.ok(outcome.stagedMcpServerNames !== undefined);
        assert.ok(
          outcome.stagedMcpServerNames.length > 0,
          "stagedMcpServerNames must be populated",
        );
      } finally {
        process.chdir(prevCwd);
      }

      // TR-04: outcome-shape assertions don't
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

// ─── SEV-03 / D-69-01: autoupdate cascade TAKES the force path ────────────────

test("SEV-03 / D-69-01: autoupdate cascade (updateSinglePlugin) TAKES the force path -- an `unsupported` candidate degrades to partition='updated' carrying unsupportedKinds (NOT skipped)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-sev03-force-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // Make the candidate re-resolve `unsupported`: an `lspServers` component
      // (the `.lsp.json` convention) is a known-but-unsupported kind. The skill
      // stays supported, so the candidate DEGRADES rather than going
      // structurally `unavailable` -- the force path can materialize it.
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        if (outcome.partition !== "updated") {
          throw new Error("unreachable: narrowed above");
        }

        // The dropped kind rides the outcome so the cascade mapper renders
        // `(partially-installed) {lsp}`.
        assert.deepEqual([...(outcome.partialDegrade?.kinds ?? [])], ["lspServers"]);
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SEV-03 / FORCE-05: autoupdate cascade does NOT bypass a hard failure -- a github-source (`unavailable`) candidate still returns partition='skipped' {no longer installable}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-sev03-unavail-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // MM-3 / PR-2: a github-source entry from a path marketplace is
        // structurally `unavailable` -- `requireForceInstallable` blocks it even
        // on the force path (force degrades `unsupported`, never `unavailable`).
        manifestPlugins: {
          hello: { version: "1.1.0", hasSkill: true, rawSourceOverride: "github:owner/repo" },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "skipped");
        if (outcome.partition !== "skipped") {
          throw new Error("unreachable: narrowed above");
        }

        assert.deepEqual([...outcome.reasons], ["no longer installable"]);
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("XSURF-03 / SEV-04: the manual `update` path (no --force) of a force-upgradable candidate declines with `(partially-upgradable) {lsp}` + the --force trailer at warning", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-sev03-manual-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // XSURF-03: the manual no-`--force` decline of a force-upgradable
      // candidate flips to the resolver-state-driven `(partially-upgradable)` token
      // (consistent with how `list` describes the same plugin) carrying the
      // list-consistent `{lsp}` degrade reason + the update-worded `--force`
      // trailer. SEV-04: a targeted decline stays warning.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (partially-upgradable) {lsp}\n    Re-run with --partial to update with the supported components.",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SEV-03 / D-69-01: prior-state read -- a previously-CLEAN plugin (persisted unsupported empty) degraded by the autoupdate cascade carries newlyDegraded=true", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-sev03-newly-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        // seedPathMarketplace seeds compatibility.unsupported = [] -> the prior
        // record is CLEAN, so the degrade is NEWLY introduced.
        installedVersions: { hello: "1.0.0" },
      });
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        if (outcome.partition !== "updated") {
          throw new Error("unreachable: narrowed above");
        }

        assert.equal(outcome.partialDegrade?.newlyDegraded, true);
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SEV-03 / D-69-01: prior-state read -- an ALREADY force-installed plugin (persisted unsupported non-empty) degraded again carries newlyDegraded=false", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-sev03-already-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      // Pre-stamp the persisted record as ALREADY force-installed: a non-empty
      // `compatibility.unsupported` is the prior-state the auto-update reads.
      const locations = locationsFor("project", cwd);
      const before = await loadState(locations.extensionRoot);
      const rec = before.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      rec.compatibility.unsupported = ["lspServers"];
      await saveState(locations.extensionRoot, before);

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        if (outcome.partition !== "updated") {
          throw new Error("unreachable: narrowed above");
        }

        assert.equal(outcome.partialDegrade?.newlyDegraded, false);
      } finally {
        process.chdir(prevCwd);
      }
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
      // V2 byte form. Plugin-row `[<scope>]` bracket suppressed by orphan-fold.
      // D-01: an absent-target update (not installed) is error, severity-only
      // flip; the `(skipped) {not installed}` per-row grammar is preserved.
      assert.equal(
        body,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (skipped) {not installed}",
      );
      assert.equal(notifications[0]?.severity, "error");
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
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {not in manifest}",
      );
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── ATTR-02 missing marketplace -> standalone {not added} (both forms) ───────

// ATTR-02 / SCOPE-01: `@<mp>` form against an absent marketplace with an
// explicit `--scope` emits the standalone `MarketplaceNotAddedMessage`
// (`{not added}` on the marketplace subject) carrying the requested-scope
// bracket -- NOT the former `(failed) {not found}` synthetic plugin row (M10/M11
// misattribution). No raw MarketplaceNotFoundError/Error escapes the
// orchestrator.
test("ATTR-02 @<mp>: unknown marketplace with explicit scope -> standalone {not added} [scope] bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-attr02-nomp-mp-"));
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
      // Standalone marketplace-subject row; bracket carries the REQUESTED scope
      // (SCOPE-01); no summary line, no cause-chain trailer.
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp [project] (failed) {not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ATTR-02: `<plugin>@<mp>` form against an absent marketplace with an explicit
// scope converges on the SAME standalone `{not added}` emission as the `@<mp>`
// form (both flow through enumerateMarketplaceTarget).
test("ATTR-02 <plugin>@<mp>: unknown marketplace with explicit scope -> standalone {not added} [scope] bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-attr02-nomp-pl-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "user",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "ghost-mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp [user] (failed) {not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ATTR-02: bare `@<mp>` form (no `--scope`) against a marketplace absent in BOTH
// scopes -> standalone `{not added}` with NO `[scope]` bracket (absent-from-both
// form; no requested scope to report).
test("ATTR-02 @<mp> bare: unknown marketplace absent from both scopes -> standalone {not added}, no bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-attr02-nomp-bare-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        // scope omitted -> bare form searches both scopes, misses both.
        cwd,
        target: { kind: "marketplace", marketplace: "ghost-mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp (failed) {not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// SCOPE-01: explicit-scope `@<mp>` against a marketplace present ONLY in the
// other scope -> standalone `{not added}` carrying the REQUESTED scope bracket
// ("not added in the scope you asked for"; the operator infers the other scope).
test("SCOPE-01 @<mp>: marketplace present only in other scope -> standalone {not added} [requestedScope]", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-scope01-other-"));
    try {
      // Seed the marketplace in PROJECT (seedPathMarketplace uses project).
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
        // Ask for USER explicitly; the marketplace lives only in project.
        scope: "user",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ mp [user] (failed) {not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// SCOPE-01: explicit-scope `<plugin>@<mp>` against a marketplace present ONLY in
// the other scope -> standalone `{not added}` carrying the REQUESTED scope
// bracket. The plugin form reaches this via `resolveInstalledPluginTarget`
// returning the explicit scope blindly, then `enumerateMarketplaceTarget`
// finding `mp === undefined` for that scope and raising the signal -- the
// companion of the `@<mp>` form test above (WR-01 gap closure).
test("SCOPE-01 <plugin>@<mp>: marketplace present only in other scope -> standalone {not added} [requestedScope]", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-scope01-plugin-other-"));
    try {
      // Seed the marketplace in PROJECT; ask for USER explicitly.
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
        scope: "user", // project has it; user doesn't
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ mp [user] (failed) {not added}",
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
      // V2 byte form mirrors the pl@mp not-installed shape (PUP-1 above).
      // Plugin-row `[<scope>]` bracket suppressed by orphan-fold. D-01:
      // absent-target update (not installed) is error, severity-only flip.
      assert.equal(
        body,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (skipped) {not installed}",
      );
      assert.equal(notifications[0]?.severity, "error");
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

      // Both scopes are enumerated and both plugins are up-to-date (same version
      // in manifest as in state). UGRM-01: a bulk (bare-form, plural) update
      // suppresses every per-plugin `(skipped) {up-to-date}` row and drops the
      // now-empty marketplace headers, so the cascade body is empty. UGRM-02:
      // rather than zero output, the orchestrator emits the never-silent no-op
      // headline `Plugin update: nothing to update` at info severity.
      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      assert.equal(body, "Plugin update: nothing to update");
      assert.equal(notifications[0]?.severity, undefined);
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

      // Cache drop errors are swallowed; update still succeeds.
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

test("swapState-plugin-gone: plugin removed from state between enumerateTargets and preflight -> error (not installed)", async () => {
  // gitOps.fetch removes the plugin record from state.json after
  // enumerateTargets has already collected "hello" as a target. When
  // preflightUpdate runs, loadState finds no "hello" in the marketplace
  // plugins -> returns partition='skipped' (notes: "not installed"). D-01:
  // the absent target flips that skip to an error row (severity-only).
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
      // returns skipped (not installed). D-01: absent target -> error row
      // (severity-only flip; the `(skipped) {not installed}` token is kept).
      assert.ok(notifications.length >= 1, "expected at least one notification");
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 1, "absent-target update is now an error (D-01)");
      const body = notifications[0]?.message ?? "";
      assert.match(body, /\(skipped\) \{not installed\}/);
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

      // TR-04 SC#1/SC#2 post-state: skills + commands FAILED;
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
      // Failed bridges retain pre-update resources; succeeded bridges write
      // empty arrays (seed declares no entries for agents/mcp).
      assert.deepEqual([...rec.resources.skills], ["seeded-skill"]);
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

      // TR-04 SC#1/SC#2 post-state: skills + agents FAILED;
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
      // Failed bridges retain pre-update skills; agents failed too (no entry
      // in seed so previously [] and stays []); commands/mcp succeeded with
      // empty recorded[].
      assert.deepEqual([...rec.resources.skills], ["seeded-skill"]);
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── TR-04 matrix coverage (SC#4) ─────────────────────────────────
// Per-bridge orthogonality: finalizeUpdateRecord gates each bridge's resource
// write on !failedPhases.has(bridge), INDEPENDENT of other bridges' outcomes.
// The 4 dedicated "exactly one bridge fails" tests below + the all-success
// WR-04 + existing PUP-6 (skills-only-fail) + phase3a-commands-fail
// (skills+commands fail) + phase3a-agents-fail (skills+agents fail) cover
// every per-bridge "succeed" vs "fail" outcome in both directions for all
// four bridges. The remaining 9 multi-failure cases compose deterministically.

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
      // Failed bridge: skills resources stay at pre-update value.
      assert.deepEqual([...rec.resources.skills], ["seeded-skill"]);
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
// A dedicated "mcp commit fails, others succeed" test is OMITTED
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
// failure between mcp's prepare and commit.

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
      // Failed skills bridge: pre-update value retained.
      assert.deepEqual([...midRec.resources.skills], ["seeded-skill"]);

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

// ──────────────────────────────────────────────────────────────────────────
// WB-01/WB-02 deep-equal short-circuit + --local
// ──────────────────────────────────────────────────────────────────────────

test("WB-01 / A7: CHANGED update with ABSENT entry writes the implicit declaration", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wb01-write-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-existing config has NO entry for hello@mp -> write-back fires
      // to add the implicit declaration.
      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cfg = await loadConfig(locations.configJsonPath);
      assert.equal(cfg.status, "valid");
      if (cfg.status === "valid") {
        assert.deepEqual(cfg.config.plugins?.["hello@mp"], {});
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01 / A7: changed update with a DIFFERENT existing entry writes back (preserves D-09 unknown keys)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wb01-diff-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Seed the config with an existing entry that carries a forward-compat
      // key. The patched shape `{...existing, ...{}} === existing`, so the
      // deep-equal short-circuit fires and the file stays byte-stable.
      const { saveConfig, loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        {
          schemaVersion: 1,
          plugins: { "hello@mp": { enabled: false, futureKey: "x" } as never },
        },
        locations.scopeRoot,
      );
      const bytesBefore = await readFile(locations.configJsonPath);

      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const bytesAfter = await readFile(locations.configJsonPath);
      assert.deepEqual(bytesAfter, bytesBefore, "RECON-05: no-op patch -> byte-stable config");

      // Unknown forward-compat key preserved.
      const after = await loadConfig(locations.configJsonPath);
      assert.equal(after.status, "valid");
      if (after.status === "valid") {
        const entry = after.config.plugins?.["hello@mp"] as Record<string, unknown> | undefined;
        assert.equal(entry?.enabled, false);
        assert.equal(entry?.futureKey, "x");
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01: up-to-date update does NOT write the config (RECON-05 fixed-point preserved)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wb01-uptodate-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Seed config with the entry so we can assert it's untouched.
      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );
      const bytesBefore = await readFile(locations.configJsonPath);

      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // Up-to-date short-circuits BEFORE the 3-phase swap; finalizeUpdateRecord
      // never runs, so no write-back fires.
      const bytesAfter = await readFile(locations.configJsonPath);
      assert.deepEqual(bytesAfter, bytesBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01: --local update targets the local file; base file untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wb01-local-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Seed BASE config with a forward-compat key; --local update MUST NOT
      // touch it. Local file starts absent; the no-op patch keeps it absent.
      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": { futureKey: "x" } as never } },
        locations.scopeRoot,
      );
      const baseBytesBefore = await readFile(locations.configJsonPath);

      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        local: true,
      });

      // Base bytes UNCHANGED (--local NEVER touches the base file).
      const baseBytesAfter = await readFile(locations.configJsonPath);
      assert.deepEqual(baseBytesAfter, baseBytesBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── D-UPD: update vs disabled plugin ──────────────────────────────────────

test("WR-02 / NFR-3: an already-current disabled record does not take the scope lock", async () => {
  // The disabled record now falls THROUGH the unchanged-version short-circuit
  // so a moved source or a changed compatibility block still refreshes. That
  // put a `retries: 0` lock acquisition on a path that had been lock-free, so a
  // scope where nothing moved started throwing StateLockHeldError under
  // contention -- and the bare-form batch aborts on that throw, taking every
  // target after the disabled plugin with it.
  //
  // The first update settles the record; the second one has nothing to write,
  // so it must complete against a HELD lock.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr02-lockfree-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
      });

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      // Pass one: settles resolvedSource and the compatibility block.
      const first = makeCtx();
      await updatePlugins({
        ctx: first.ctx,
        pi: first.pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const release = await lockfile.lock(locations.extensionRoot, {
        lockfilePath: locations.stateLockFile,
        realpath: false,
      });
      try {
        const { ctx, pi, notifications } = makeCtx();
        await updatePlugins({
          ctx,
          pi,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });

        // D-99-05a row contract: an unchanged version reports the ARTIFACT
        // state, which genuinely is unchanged. The point of the assertion is
        // the row it is NOT -- the `(failed) {lock held}` the unconditional
        // acquisition produced.
        assert.equal(notifications.length, 1);
        assert.match(notifications[0]!.message, /\(skipped\) \{up-to-date\}/);
        assert.doesNotMatch(notifications[0]!.message, /lock held|\(failed\)/);
      } finally {
        await release();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-08 / NFR-3: the lock-free skip survives multi-element compatibility lists", async () => {
  // The WR-02 skip compares a projection of the PERSISTED compatibility block
  // against a projection of a FRESHLY RESOLVED one. `disabledPinProjection`
  // stringifies `notes` / `supported` / `unsupported` positionally, so the skip
  // holds only while the resolver emits those lists in the same order on every
  // resolution of the same input. That contingency is invisible: if any list
  // ever became set-derived, `readdir`-ordered, or `Promise.all`-ordered, the
  // projections would differ on every run of every disabled plugin, the
  // `retries: 0` lock would be acquired unconditionally again, and the
  // batch-abort regression WR-02 exists to prevent would come back silently.
  //
  // The fixture above cannot see that: its lists are one element long at most,
  // and a one-element list has no order to lose. This one seeds two supported
  // kinds, two unsupported kinds and their notes, so a re-ordering resolver
  // fails HERE -- as a `(failed) {lock held}` row -- instead of in production.
  //
  // Deliberately NOT fixed by sorting inside the projection: a sort would make
  // the test pass while hiding the dependency, and the round trip through
  // state.json is the property that actually has to hold.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr08-order-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true, hasCommand: true } },
      });
      // Declares `themes` AND `monitors` -- two unsupported kinds, each with its
      // own `contains <kind>` note.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.0.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      // Pass one settles the record with resolver-derived lists, in resolver
      // order. `partial` because a CLEAN disabled record has consented to
      // nothing (WR-01).
      const first = makeCtx();
      await updatePlugins({
        ctx: first.ctx,
        pi: first.pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // Fixture-rot guard: if the seeds stop producing multi-element lists this
      // test silently degrades into a duplicate of the WR-02 one above.
      const settled = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(settled !== undefined);
      assert.ok(
        settled.compatibility.supported.length >= 2,
        `supported must carry >=2 entries for order to be observable: ${JSON.stringify(settled.compatibility.supported)}`,
      );
      assert.ok(
        settled.compatibility.unsupported.length >= 2,
        `unsupported must carry >=2 entries for order to be observable: ${JSON.stringify(settled.compatibility.unsupported)}`,
      );
      assert.ok(
        settled.compatibility.notes.length >= 2,
        `notes must carry >=2 entries for order to be observable: ${JSON.stringify(settled.compatibility.notes)}`,
      );

      const release = await lockfile.lock(locations.extensionRoot, {
        lockfilePath: locations.stateLockFile,
        realpath: false,
      });
      try {
        const { ctx, pi, notifications } = makeCtx();
        await updatePlugins({
          ctx,
          pi,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
          partial: true,
        });

        assert.equal(notifications.length, 1);
        assert.doesNotMatch(
          notifications[0]!.message,
          /lock held|\(failed\)/,
          "the re-derived lists compared equal to the persisted ones, so no lock was needed -- a `lock held` row here means the resolver's emit order stopped being stable across resolutions",
        );
      } finally {
        await release();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-UPD: update on a disabled plugin refreshes version pin BUT keeps resources empty (no re-materialization)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-d-upd-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        // No installedVersions -- we override the record below.
      });

      // Overwrite the seeded record with a DISABLED-shaped record:
      // empty resources.* + installable:true (the isRecordedButDisabled marker).
      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // D-UPD / WR-02: the rendered status is the inherited `(skipped)` token
      // naming the reason nothing was materialized -- NOT `{up-to-date}`, which
      // would claim the version is settled in the very call that moved it.
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]!.message, /\(skipped\) \{already disabled\}/);

      // State: record's version + resolvedSource refreshed (the next `enable`
      // re-materializes from the now-current pin); resources.* stay empty
      // (the plugin remains disabled).
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "version refreshed to manifest pin");
      // resolvedSource refreshed to the current pluginRoot.
      assert.ok(
        rec.resolvedSource.includes("hello"),
        `resolvedSource refreshed to current pluginRoot: ${rec.resolvedSource}`,
      );
      assert.deepEqual(
        [...rec.resources.skills],
        [],
        "resources.skills stay empty (still disabled)",
      );
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── ENBL-09: update vs a DISABLED PARTIAL ──────────────────────────────────
//
// WR-04 / D-98-04: the disabled-record short-circuit is reachable BOTH ways.
// `preflightUpdate` derives the candidate gate's partial argument from the
// record as well as the caller flag, so a disabled record admits a
// partially-available candidate with no flag typed -- `update` is the only
// command that can re-pin such a record, and a disabled record stages nothing.
// The flagged cases below stay valid: `partial: true` remains admissible and
// reaches the same short-circuit. The flagless case is the one that proves
// reachability without the flag.

/** Assert every one of the five resource slots is empty on a disabled record. */
function assertResourcesEmpty(record: PluginRecord, why: string): void {
  assert.deepEqual([...record.resources.skills], [], `skills ${why}`);
  assert.deepEqual([...record.resources.prompts], [], `prompts ${why}`);
  assert.deepEqual([...record.resources.agents], [], `agents ${why}`);
  assert.deepEqual([...record.resources.mcpServers], [], `mcpServers ${why}`);
  assert.deepEqual([...record.resources.hooks], [], `hooks ${why}`);
}

test("WR-04: a targeted update with NO partial flag reaches the disabled-record short-circuit and refreshes the pin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr04-noflag-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The candidate resolves `partially-available`, which the STRICT gate
      // rejects -- the record's disabled-ness is what widens the gate here.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // The re-pin skip row -- NOT the partially-upgradable decline row with its
      // remediation trailer, which is what the strict gate produced before the
      // record-derived widening. WR-02: the reason names why nothing was
      // materialized; `{up-to-date}` would deny the pin move asserted below.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" + "  ⊘ hello (skipped) {already disabled}",
      );

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the version pin refreshes without the flag");
      assert.equal(
        rec.compatibility.installable,
        false,
        "availability stays derived from the partially-available resolution",
      );
      assert.ok(
        rec.compatibility.unsupported.length > 0,
        `unsupported list stays non-empty: ${JSON.stringify(rec.compatibility.unsupported)}`,
      );
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (the refresh stages nothing)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: a CLEAN disabled record whose candidate would newly degrade keeps the decline row and its record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr01-clean-disabled-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The candidate resolves `partially-available`, so admitting it would
      // flip the record's availability discriminant to false.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      // Disabled but CLEAN: the user consented to disabling this plugin, never
      // to degrading it. `makeDisabledPluginRecord` keeps the default
      // `installable: true` compatibility block.
      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // The XSURF-03 decline row with its remediation trailer -- the consent
      // ask. NOT the `(skipped) {up-to-date}` refresh row, which would rewrite
      // the record with no flag typed and no row naming the new degradation.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (partially-upgradable) {unsupported component}\n    Re-run with --partial to update with the supported components.",
      );
      assert.equal(notifications[0]?.severity, "warning");

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0", "the pin does NOT move on a declined update");
      assert.equal(
        rec.compatibility.installable,
        true,
        "availability does NOT flip without an explicit --partial",
      );
      assert.deepEqual([...rec.compatibility.unsupported], [], "no dropped kinds are recorded");
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (nothing was staged)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: an explicit --partial on the same clean disabled record consents to the degrade and re-pins it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr01-consented-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the flagged path still re-pins the record");
      assert.equal(rec.compatibility.installable, false, "the consented degrade is recorded");
      assert.ok(rec.compatibility.unsupported.length > 0, "the dropped kinds are recorded");
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (a disabled record stages nothing)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09: the disabled-record refresh derives compatibility.installable from the resolution -- degraded stays degraded", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-enbl09-degraded-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The candidate still resolves `partially-available`.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      // The invariant: the availability discriminant and the unsupported list
      // must agree. `installable: true` beside a non-empty unsupported list is
      // the self-contradictory record ENBL-09 forbids.
      assert.equal(
        rec.compatibility.installable,
        false,
        "availability derived from the partially-available resolution",
      );
      assert.ok(
        rec.compatibility.unsupported.length > 0,
        `unsupported list stays non-empty: ${JSON.stringify(rec.compatibility.unsupported)}`,
      );
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09 counter-case: a candidate that resolves fully supported promotes the refreshed record's availability", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-enbl09-promoted-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // Same fixture as the degraded case MINUS the unsupported marker, so
        // the candidate resolves `installable`.
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      // Paired with the degraded case above, this proves the value is DERIVED
      // rather than pinned to either constant.
      assert.equal(rec.compatibility.installable, true, "promoted to full availability");
      assert.deepEqual([...rec.compatibility.unsupported], []);
      assert.equal(rec.enabled, false, "promotion of the availability axis never enables");
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09: update --partial on a disabled PARTIAL refreshes the pin and stages nothing (--partial is required to reach the short-circuit)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-enbl09-shortcircuit-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // Reuses the existing `unchanged` byte form -- the artifact state really
      // IS unchanged, so no new catalog token appears. No `/reload` trailer:
      // nothing was updated.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" + "  ⊘ hello (skipped) {already disabled}",
      );

      // The defect this guards is re-staging on disk, so assert on disk: the
      // supported `skills/tool` component would materialize as `hello-tool`
      // had the three-phase body run.
      assert.equal(
        await pathExists(path.join(locations.skillsTargetDir, "hello-tool")),
        false,
        "no skill staged for a disabled record",
      );

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "version pin refreshed for a future enable");
      assert.ok(
        rec.resolvedSource.includes("hello"),
        `resolvedSource refreshed to the current pluginRoot: ${rec.resolvedSource}`,
      );
      assert.equal(rec.enabled, false);
      assertResourcesEmpty(rec, "stay empty (no re-materialization)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09: update --partial on a disabled PARTIAL is idempotent -- two identical calls leave the record unchanged", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-enbl09-idempotent-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      // Compare on the fields the operation owns; `updatedAt` is a wall-clock
      // stamp and would make the equality flaky.
      const settledFields = async (): Promise<unknown> => {
        const s = await loadState(locations.extensionRoot);
        const r = s.marketplaces["mp"]?.plugins["hello"];
        assert.ok(r !== undefined);
        return {
          version: r.version,
          resolvedSource: r.resolvedSource,
          installable: r.compatibility.installable,
          unsupported: [...r.compatibility.unsupported],
          enabled: r.enabled,
          resources: {
            skills: [...r.resources.skills],
            prompts: [...r.resources.prompts],
            agents: [...r.resources.agents],
            mcpServers: [...r.resources.mcpServers],
            hooks: [...r.resources.hooks],
          },
        };
      };

      const runOnce = async (): Promise<NotifyRecord[]> => {
        const { ctx, pi, notifications } = makeCtx();
        await updatePlugins({
          ctx,
          pi,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
          partial: true,
        });
        return notifications;
      };

      const firstNotifications = await runOnce();
      const firstRecord = await settledFields();
      // WR-05 / RECON-05: a second identical call must not write state.json at
      // all. The second call DOES reach the refresh -- D-99-05a lets a disabled
      // record past the `toVersion === fromVersion` short-circuit, because its
      // source and compatibility block move independently of the pin. What
      // keeps the record from being rewritten is the refresh's own deep-equal
      // guard: it compares the projection it would write against the persisted
      // one and skips the save when they match.
      // Comparing settled fields alone cannot see a rewrite that lands the same
      // values; the mtime and the wall-clock `updatedAt` can, so read both
      // BEFORE the second call.
      const firstStat = await stat(locations.stateJsonPath);
      const firstUpdatedAt = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ]?.updatedAt;

      const secondNotifications = await runOnce();
      const secondRecord = await settledFields();

      assert.equal(secondNotifications.length, 1);
      // WR-02: the two calls did DIFFERENT things, so their rows differ. The
      // first moved the pin and says so with the skip reason that names why
      // nothing was materialized; the second wrote nothing at all, and
      // `{up-to-date}` is a true statement only there. Both rows are derived
      // from the same version equality, one arm of the refresh each.
      assert.equal(
        firstNotifications[0]?.message,
        "● mp [project]\n  ⊘ hello (skipped) {already disabled}",
      );
      assert.equal(
        secondNotifications[0]?.message,
        "● mp [project]\n  ⊘ hello (skipped) {up-to-date}",
      );
      assert.deepEqual(secondRecord, firstRecord, "the refresh is a fixed point");

      const secondStat = await stat(locations.stateJsonPath);
      assert.equal(
        secondStat.mtimeMs,
        firstStat.mtimeMs,
        "a no-op refresh must not touch state.json (RECON-05 mtime stability)",
      );
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.updatedAt,
        firstUpdatedAt,
        "a no-op refresh must not bump updatedAt while rendering (skipped) {up-to-date}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── D-99-05a: a disabled record refreshes under an UNCHANGED version ────────
//
// `refreshDisabledRecord` owns three independently-moving facts: the version
// pin, `resolvedSource`, and the `compatibility` block. Only the first is what
// `toVersion === fromVersion` compares, so a disabled record now falls THROUGH
// that short-circuit and the refresh decides for itself whether anything moved.
//
// The enabled-plugin control for this reordering is the existing PUP-3 case
// above: an enabled record at an equal version still reaches the `unchanged`
// partition with state.json not rewritten. It is asserted there and unedited.

test("D-99-05a: a disabled record whose source moved under an unchanged version is refreshed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-d9905a-moved-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });

      // The pin the record carries points somewhere the manifest no longer
      // resolves -- the shape a path-source marketplace re-added from another
      // directory leaves behind. The VERSION is identical to the manifest's, so
      // nothing about the version says the record is stale.
      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.1.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // D-99-05a row contract: the artifact state genuinely IS unchanged -- the
      // refresh materializes nothing -- so the byte-pinned up-to-date skip row
      // stays right even though the pin moved. No new catalog state.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(
        rec.resolvedSource,
        path.join(seeded.marketplaceRoot, "plugins", "hello"),
        "a later enable re-materializes from the CURRENT pluginRoot",
      );
      assert.equal(rec.version, "1.1.0", "the version pin was already current");
      assert.equal(rec.enabled, false, "a refresh never enables");
      assertResourcesEmpty(rec, "stay empty (nothing is materialized)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-99-05a: a disabled record with nothing to move performs NO write", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-d9905a-noop-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.1.0");
      await saveState(locations.extensionRoot, state);

      // Settle the record first: one update moves the seeded placeholder source
      // onto the current pluginRoot, so the call under test faces a record that
      // already holds exactly what the refresh derives.
      const settling = makeCtx();
      await updatePlugins({
        ctx: settling.ctx,
        pi: settling.pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const settledBytes = await readFile(locations.stateJsonPath, "utf8");
      const settledStat = await stat(locations.stateJsonPath);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // Assert the WRITE, not the row. The row renders the same bytes whether
      // the refresh no-ops or rewrites the record with identical values, so a
      // row assertion cannot tell a guarded no-op from an unguarded rewrite --
      // which is exactly how the guard came to look like dead code. The bytes
      // catch a rewrite (`updatedAt` would move); the mtime catches even a
      // byte-identical one.
      assert.equal(
        await readFile(locations.stateJsonPath, "utf8"),
        settledBytes,
        "a refresh with nothing to move must leave state.json byte-identical",
      );
      assert.equal(
        (await stat(locations.stateJsonPath)).mtimeMs,
        settledStat.mtimeMs,
        "RECON-05: state.json must not be rewritten at all",
      );
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-99-05a: an unsupported kind gained under an unchanged version degrades the refreshed record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-d9905a-drift-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The entry gains an unsupported kind at the SAME version -- the
      // compatibility block moves while the pin does not.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      const record = makeDisabledPluginRecord("1.1.0");
      // Pre-seed the current source so the compatibility block is the ONLY
      // fact that moves.
      record.resolvedSource = path.join(seeded.marketplaceRoot, "plugins", "hello");
      state.marketplaces["mp"]!.plugins["hello"] = record;
      await saveState(locations.extensionRoot, state);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        // WR-01: a CLEAN disabled record has consented to nothing, so its
        // degrade still needs the flag typed.
        partial: true,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the version pin never moved");
      assert.equal(
        rec.compatibility.installable,
        false,
        "a later enable gates on the CURRENT availability discriminant",
      );
      assert.ok(
        rec.compatibility.unsupported.length > 0,
        `the dropped kinds are recorded: ${JSON.stringify(rec.compatibility.unsupported)}`,
      );
      assert.equal(rec.enabled, false);
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-99-05a counter-case: an unsupported kind LOST under an unchanged version promotes the refreshed record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-d9905a-promote-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // No `makeCandidateUnsupported` here: the entry the record remembers as
      // partial now resolves fully supported at the same version.

      const state = await loadState(locations.extensionRoot);
      const record = makeDisabledPartialPluginRecord("1.1.0");
      record.resolvedSource = path.join(seeded.marketplaceRoot, "plugins", "hello");
      state.marketplaces["mp"]!.plugins["hello"] = record;
      await saveState(locations.extensionRoot, state);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");

      // The counter-case half: the degrade above is satisfied by writing a
      // constant `false`, and this one by a constant `true`. Only the pair
      // shows the discriminant is DERIVED from the resolution.
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the version pin never moved");
      assert.equal(rec.compatibility.installable, true, "availability follows the resolution up");
      assert.deepEqual([...rec.compatibility.unsupported], [], "the stale dropped kind is cleared");
      assert.equal(rec.enabled, false, "promotion of the availability axis never enables");
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── S5: invalid config write-back no longer silently skips ─────────────────

test("S5: update success + invalid config write-back surfaces a warning row (no longer silently skipped)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-s5-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // Corrupt claude-plugins.json so the post-success write-back's loadConfig
      // returns `invalid`. Pre-S5 this was a silent skip while the success
      // notify proceeded; post-S5 a warning row must surface.
      await writeFile(locations.configJsonPath, "{ not json ", "utf8");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // Two notify calls: the success row + a warning failed row pinned to
      // the basename-only invalid-manifest cause.
      assert.ok(
        notifications.length >= 2,
        `expected >= 2 notifications (success + S5 warning); got ${notifications.length}: ${notifications
          .map((n) => n.message)
          .join("\n---\n")}`,
      );
      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(allText, /\(updated\)/, "success row still emitted");
      assert.match(allText, /\(failed\) \{invalid manifest\}/, "S5 warning row emitted");
      assert.match(allText, /claude-plugins\.json/, "basename mentioned in S5 cause");
      assert.ok(
        !allText.includes(locations.configJsonPath),
        `absolute config path must not leak: ${allText}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after updatePlugins succeeds, the hooks-bridge routing
// table reflects the NEW (post-update) hooks config. Update does NOT
// delegate to install/uninstall, so the cache lifecycle is wired explicitly
// inside the per-plugin lock and verified end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: updatePlugins refreshes the plugin's routing-table entries to the new hooks config without /reload", async () => {
  const { _resetForTest, addPluginConfigToCache, getRoutingBucket } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  const { compileIfPredicate } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts");
  const { parseHooksConfig } =
    await import("../../../extensions/pi-claude-marketplace/domain/components/hooks.ts");

  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr03-"));
    try {
      _resetForTest();
      const locations = locationsFor("project", cwd);

      const oldHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo OLD" }] }],
      };
      const newHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo NEW" }] }],
      };

      // Seed marketplace with version A and a state record pre-populated to
      // simulate the post-install state (hooks slug present, cache
      // populated, routing table populated).
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true, hooksJson: oldHooksJson },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Patch the seeded plugin record's `resources.hooks` so the
      // rebuildRoutingTables walk includes it. The default
      // `makePluginRecord` leaves hooks empty.
      const seededState = await loadState(locations.extensionRoot);
      const mpRecord = seededState.marketplaces["mp"];
      assert.ok(mpRecord !== undefined);
      const helloRecord = mpRecord.plugins["hello"];
      assert.ok(helloRecord !== undefined);
      helloRecord.resources.hooks = ["hello"];
      await saveState(locations.extensionRoot, seededState);

      const TEST_IF_CTX = { homedir: "/home/u", cwd, projectRoot: cwd } as const;
      const parsedOld = parseHooksConfig(
        JSON.stringify(oldHooksJson),
        TEST_IF_CTX,
        compileIfPredicate,
      );
      assert.ok(parsedOld.ok);
      addPluginConfigToCache(
        "project",
        "mp",
        "hello",
        asAbsolutePluginRoot("/test/project/mp/hello"),
        parsedOld.value,
        parsedOld.ifPredicates,
      );

      // Rewrite the on-disk plugin tree to v2.0.0 with NEW hooks config.
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(newHooksJson));

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)"),
        `expected clean update notification; got: ${summary}`,
      );

      // Post-condition: the routing-table entry reflects the NEW hooks
      // config (command `echo NEW`), not the old one. This proves WR-03's
      // remove+add+rebuild fired inside `finalizeUpdateRecord`'s
      // withStateGuard closure on the all-success arm.
      const postBucket = getRoutingBucket("PreToolUse");
      assert.equal(postBucket.length, 1);
      assert.equal(postBucket[0]?.pluginId, "hello");
      assert.equal(postBucket[0]?.handlerDecl["command"], "echo NEW");
      // resolvedSource must propagate from the resolver -> cache -> routing
      // table after update. CLAUDE_PLUGIN_ROOT export at dispatch depends
      // on it.
      const updateLoc = locationsFor("project", cwd);
      const postState = await loadState(updateLoc.extensionRoot);
      assert.equal(
        postBucket[0]?.resolvedSource,
        postState.marketplaces["mp"]?.plugins["hello"]?.resolvedSource,
        "RoutingEntry.resolvedSource must mirror state.json's resolvedSource after update",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01: 5th cascade slot in update.ts -- Phase 3a commit loop writes /
// removes <hooksDir>/<plugin>/hooks.json between agents and mcp commits.
// ─────────────────────────────────────────────────────────────────────────────

test("LIFE-01 (update): version A->B (both ship hooks) overwrites <hooksDir>/<plugin>/hooks.json atomically with version B's content", async () => {
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-life01-overwrite-"));
    try {
      _resetForTest();
      const locations = locationsFor("project", cwd);

      const oldHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo OLD" }] }],
      };
      const newHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo NEW" }] }],
      };

      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true, hooksJson: oldHooksJson },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-seed the hooks slug so finalize updates it; the bridge file
      // is not present (the install slot did not exist when this fixture
      // was first written) -- the update commit slot writes it.
      const seededState = await loadState(locations.extensionRoot);
      const mpRecord = seededState.marketplaces["mp"];
      assert.ok(mpRecord !== undefined);
      const helloRecord = mpRecord.plugins["hello"];
      assert.ok(helloRecord !== undefined);
      helloRecord.resources.hooks = ["hello"];
      await saveState(locations.extensionRoot, seededState);

      // Bump to v2.0.0 with NEW hooks payload on disk.
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(newHooksJson));

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean update; got: ${summary}`);

      const written = await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      assert.deepEqual(
        JSON.parse(written),
        newHooksJson,
        "update Phase 3a commit slot must write version B's hooks.json",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-01 (update): version A (with hooks) -> version B (no hooks) removes the stale hooks file", async () => {
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-life01-remove-"));
    try {
      _resetForTest();
      const locations = locationsFor("project", cwd);

      const oldHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo OLD" }] }],
      };

      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true, hooksJson: oldHooksJson },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-place the stale hooks file at the destination so we can assert
      // the update commit removed it.
      await mkdir(path.join(locations.hooksDir, "hello"), { recursive: true });
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify(oldHooksJson),
      );

      const seededState = await loadState(locations.extensionRoot);
      const mpRecord = seededState.marketplaces["mp"];
      assert.ok(mpRecord !== undefined);
      const helloRecord = mpRecord.plugins["hello"];
      assert.ok(helloRecord !== undefined);
      helloRecord.resources.hooks = ["hello"];
      await saveState(locations.extensionRoot, seededState);

      // Bump to v2.0.0 with NO hooks (delete the on-disk hooks tree).
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await rm(path.join(pluginRoot, "hooks"), { recursive: true, force: true });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean update; got: ${summary}`);

      // The stale hooks dir must be gone.
      let stillThere = true;
      try {
        await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      } catch {
        stillThere = false;
      }

      assert.equal(
        stillThere,
        false,
        "update Phase 3a commit slot must removeHookConfig when version B has no hooks",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-01 (update): version A (no hooks) -> version B (with hooks) writes the new hooks.json", async () => {
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-life01-add-"));
    try {
      _resetForTest();
      const locations = locationsFor("project", cwd);

      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const newHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo NEW" }] }],
      };

      // Bump to v2.0.0 WITH a hooks payload.
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
      await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(newHooksJson));

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean update; got: ${summary}`);

      const written = await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      assert.deepEqual(JSON.parse(written), newHooksJson);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── FORCE-02/03/04/05: --force degrades an unsupported CANDIDATE ──────────────
//
// D-65-04: `update --force` is gated on the RESOLVED CANDIDATE (the synced
// clone's current entry), not the installed version. An `experimental
// themes/monitors` declaration on the candidate plugin.json resolves the
// force-degradable `unsupported` arm (no structural defect) while the
// supported `skills/` component still materializes.

/**
 * Overwrite the candidate plugin.json so the resolver resolves the
 * force-degradable `unsupported` arm: an `experimental` themes/monitors
 * declaration is an unsupported component kind with no structural defect.
 * The supported `skills/` dir is left intact so the degraded update still
 * materializes the skill.
 */
async function makeCandidateUnsupported(
  marketplaceRoot: string,
  plugin: string,
  version: string,
): Promise<void> {
  const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: plugin,
      version,
      experimental: { themes: "./themes", monitors: "./monitors.json" },
    }),
  );
}

test("FORCE-02: --force on a candidate that became unsupported degrades (skill materializes, version bumps)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-force02-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // The degraded update committed: state reflects the new version and the
      // supported skill materialized; the unsupported kinds are simply absent.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.1.0");
      assert.deepEqual([...record.resources.skills], ["hello-tool"]);
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md");
      assert.ok(
        (await readFile(skillTarget, "utf8")).length > 0,
        "supported skill must materialize",
      );

      // FSTAT-07 / D-66-04: a `--force` update whose candidate re-resolved
      // `unsupported` reports `(partially-installed)` with the ◉ glyph + the
      // dropped-component detail (the same derived signal the list deriver
      // reads), not `(updated)`. force-installed is a realized transition --
      // info severity + reload-hint.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined, "force-installed is info, not error");
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" +
          "  ◉ hello v1.1.0 (partially-installed) {unsupported component}\n" +
          "\n" +
          "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("XSURF-03 / FORCE-03: without --force the force-upgradable candidate declines `(partially-upgradable)` + the --force trailer at warning", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-force03-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        // No `force` -> the candidate gate stays `requireInstallable`.
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      // XSURF-03: the targeted no-`--force` decline of a force-upgradable
      // candidate renders the `(partially-upgradable)` token + the update-worded
      // `--force` trailer; SEV-04 keeps the targeted decline at warning.
      assert.match(body, /\(partially-upgradable\)/);
      assert.match(body, /Re-run with --partial to update with the supported components\./);
      assert.doesNotMatch(body, /\{no longer installable\}/);
      assert.equal(notifications[0]?.severity, "warning");

      // State untouched -- the block left the installed version in place.
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// SEV-04 / D-69-02 / XSURF-03: a BULK (`@marketplace`) update that skips a
// force-upgradable candidate the user did not target is benign -> info (contrast
// FORCE-03, the TARGETED decline that stays warning). Same `(partially-upgradable)`
// per-row token + `--force` trailer; only the severity (and the summary tally)
// move. The SEV-04 split is now keyed on the force-upgradable STATUS arm, NOT
// the reason string -- this pair (warning here vs FORCE-03) proves it holds.
test("XSURF-03 / SEV-04: bulk update skipping a force-upgradable candidate -> info (untargeted decline)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-sev04-bulk-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        // Bulk `@mp` form -> cardinality "plural" -> the decline is benign info.
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      // UGRM-01/UGRM-02: full-body lock. A bulk update whose only non-`updated`
      // row is a benign info `(partially-upgradable)` decline (0 updated, 0
      // failures/warnings) renders the cascade BODY (the Phase-73 row +
      // `--force` trailer) AND the never-silent `Plugin update: nothing to
      // update` headline below it -- the summary line does NOT vanish. The
      // degrade reason `{unsupported component}` is the `makeCandidateUnsupported`
      // (experimental manifest) form sourced through `narrowUnsupportedKinds`
      // (D-90-05: a non-carve-out component kind renders `unsupported component`).
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● hello v1.0.0 (partially-upgradable) {unsupported component}\n" +
          "    Re-run with --partial to update with the supported components.\n" +
          "\n" +
          "Plugin update: nothing to update",
      );
      assert.doesNotMatch(body, /\{no longer installable\}/);
      // SEV-04: a bulk (untargeted) decline is benign -> info (severity unset).
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-04: the force-degrade update path emits no warning severity and no `Warning:` summary", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-force04-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const warnings = notifications.filter((n) => n.severity === "warning");
      assert.equal(warnings.length, 0, `unexpected warning rows: ${JSON.stringify(warnings)}`);
      for (const n of notifications) {
        assert.equal(
          n.message.startsWith("Warning:"),
          false,
          `unexpected Warning: summary: ${n.message}`,
        );
      }

      // The success row stays info-level (severity unset == info).
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-05: --force cannot bypass an unavailable (non-path source) candidate", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-force05-unavail-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // A github-flavored source resolves `unavailable` (non-path source),
        // which `requireForceInstallable` still rejects.
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
        partial: true,
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      assert.match(body, /\(skipped\) \{no longer installable\}/);
      assert.equal(notifications[0]?.severity, "warning");
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-05: --force cannot bypass a missing marketplace", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-force05-nomp-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "ghost-mp" },
        partial: true,
      });

      // The missing-marketplace short-circuit fires BEFORE the candidate gate,
      // so `--force` is inert here.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp [project] (failed) {not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── UGRM-02: tally-override interaction with the warnings + force categories ──

test("UGRM-02 / SEV-01: bulk @mp update of a plugin with an UNLOADED declared companion tallies `1 warning, 1 updated` -> needs attention", async () => {
  // The realized `(updated)` row raises to WARNING because the plugin declares
  // an agents companion (`hasAgent: true`) the probe reports unloaded
  // (`getAllTools() -> []`). The tally-override still counts the realized
  // transition as `1 updated`, AND the warning-severity row counts as `1
  // warning` in the INDEPENDENT warnings category -> `1 warning, 1 updated`.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tally-warn-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasAgent: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Default makeCtx probe (`getAllTools() -> []`) reports pi-subagents
      // UNLOADED, so the declared-agents companion is absent -> the success row
      // raises to warning (SEV-01).
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      // Warning envelope -> the degraded summary line prepends `needs attention`.
      assert.match(body, /A plugin operation needs attention\./);
      // Tally: the warnings category (row severity) AND the updated override
      // (realized transition) both count the single row.
      assert.match(body, /Plugin update: 1 warning, 1 updated/);
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("UGRM-02 / FSTAT-07: bulk @mp --force counts a force-installed degrade as a realized transition -> `2 updated`, no `nothing to update` headline", async () => {
  // One clean bump + one force-degrading candidate. Both land in partition
  // `updated` (the force-installed arm is emitted from the `updated` case), so
  // the realized-transition count is 2. The never-silent `nothing to update`
  // headline must be ABSENT -- a force-installed degrade IS a realized update.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tally-force-2updated-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // clean: bumps cleanly (installable candidate).
          clean: { version: "1.0.1", hasSkill: true },
          // degrade: candidate re-resolves `unsupported` -> `--force`
          // degrade-updates it (partially-installed), still a realized transition.
          degrade: { version: "1.1.0", hasSkill: true },
        },
        installedVersions: { clean: "1.0.0", degrade: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "degrade", "1.1.0");

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        partial: true,
      });

      const body = notifications[0]?.message ?? "";
      // Both partitions are `updated` -> the tally counts 2 realized transitions.
      assert.match(body, /Plugin update: 2 updated/);
      // A force-installed degrade is a realized update, so the no-op headline
      // must NOT fire.
      assert.doesNotMatch(body, /nothing to update/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PURL-06 / D-78-05 / D-78-01 -- git-source (url / git-subdir / github) update:
// pin re-resolution, materialize-before-swap, GC-after-swap. update.ts is
// gitOps-exempt (it imports GitOps for marketplace sync) so it may resolveRemoteRef
// for unpinned entries and materialize the new clone inline. The mock gitOps
// copies a real plugin fixture tree into the clone staging dir; the seam renames
// it into plugin-clones/<key>/ and the resolver reads it exactly as a path source.
//
// The MARKETPLACE source stays path (so syncCloneOnce is a NFR-5 no-op); only the
// PLUGIN entry is git-source. The recorded resolvedSha drives the swap-or-not
// decision: manifest sha (pinned) or re-resolved HEAD (unpinned) != recorded ->
// swap; equal -> (unchanged). The old clone is GC'd after the swap iff no
// surviving record references it (D-78-01 derive-not-persist).
// ───────────────────────────────────────────────────────────────────────────

const SHA_OLD = "1111111111111111111111111111111111111111";
const SHA_NEW = "2222222222222222222222222222222222222222";

/**
 * Bind the clone-cache seam entrypoints to a mock gitOps so update's git-source
 * path materializes without touching the network. Mirrors install.test.ts's
 * seamWith.
 */
function seamWith(gitOps: GitOps): UpdateCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}

/**
 * Build a plugin fixture tree on disk (the "repo" the mock clone copies) whose
 * plugin.json version encodes `versionTag` so successive fixtures are
 * distinguishable, seed a PATH-source marketplace whose manifest entry carries a
 * git-object source, and (optionally) an installed state record pinned at
 * `recordedSha` whose resolvedSource points at the corresponding warm clone.
 */
async function seedGitPluginMarketplace(opts: {
  cwd: string;
  cloneUrl: string;
  fixtureRepoDir: string;
  versionTag: string;
  /** Manifest entry source (pinned carries `sha`; unpinned omits it). */
  entrySource: unknown;
  /** When set, seed an installed record pinned at this sha (git-source). */
  recordedSha?: string;
  /** Extra installed git plugins (name -> recordedSha + entrySource) sharing the mp. */
  extraPlugins?: Record<string, { entrySource: unknown; recordedSha: string }>;
}): Promise<{ marketplaceRoot: string; manifestPath: string; oldCloneRoot?: string }> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const pluginName = "gp";

  // The plugin tree the mock clone copies into staging.
  await mkdir(path.join(opts.fixtureRepoDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(opts.fixtureRepoDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version: opts.versionTag }),
  );
  const skillDir = path.join(opts.fixtureRepoDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: greet\n---\n\nHello ${opts.versionTag}.\n`,
  );

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const entries: { name: string; source: unknown }[] = [
    { name: pluginName, source: opts.entrySource },
  ];
  for (const [name, spec] of Object.entries(opts.extraPlugins ?? {})) {
    entries.push({ name, source: spec.entrySource });
  }

  await writeFile(manifestPath, JSON.stringify({ name: "mp", plugins: entries }));

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const plugins: Record<string, PluginRecord> = {};

  const seedGitRecord = async (name: string, sha: string): Promise<string> => {
    // Materialize the warm clone for the recorded sha so a warm-cache update
    // does NOT re-clone, and so the on-disk clone dir exists for the GC
    // assertions. Uses a gitOps that resolves the recorded sha at checkout.
    const key = pluginCloneKey(opts.cloneUrl, sha);
    const cloneRoot = await locations.pluginCloneDir(key);
    // Copy the fixture tree into the clone root directly (warm cache seed).
    await mkdir(path.dirname(cloneRoot), { recursive: true });
    await cp(opts.fixtureRepoDir, cloneRoot, { recursive: true });
    const record = makePluginRecord(`sha-${sha.slice(0, 12)}`);
    plugins[name] = {
      ...record,
      resolvedSource: cloneRoot,
      resolvedSha: sha,
    };
    return cloneRoot;
  };

  let oldCloneRoot: string | undefined;
  if (opts.recordedSha !== undefined) {
    oldCloneRoot = await seedGitRecord(pluginName, opts.recordedSha);
  }

  for (const [name, spec] of Object.entries(opts.extraPlugins ?? {})) {
    await seedGitRecord(name, spec.recordedSha);
  }

  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins,
      },
    },
  });

  return oldCloneRoot === undefined
    ? { marketplaceRoot, manifestPath }
    : { marketplaceRoot, manifestPath, oldCloneRoot };
}

test("PURL-06 / D-78-05 pinned sha-change: manifest sha differs from recorded -> swap; resolvedSha + shaVersion updated, old clone GC'd, new clone present", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-pinned-swap-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      // Installed at SHA_OLD; manifest now carries SHA_NEW (a pinned bump).
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "a state record must survive the swap");
      assert.equal(record.resolvedSha, SHA_NEW, "resolvedSha swaps to the new manifest sha");
      assert.equal(record.version, `sha-${SHA_NEW.slice(0, 12)}`, "version is shaVersion(new)");

      const newCloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW));
      assert.equal(record.resolvedSource, newCloneRoot, "resolvedSource points at the new clone");
      assert.match(
        path.basename(record.resolvedSource),
        /^[0-9a-f]{12}-[0-9a-f]{12}$/,
        "pinned key stays <12hex>-<12hex> (per-sha, unchanged)",
      );
      assert.equal(await pathExists(newCloneRoot), true, "new clone materialized on disk");
      assert.equal(
        await pathExists(seeded.oldCloneRoot ?? ""),
        false,
        "old clone GC'd (no surviving record references it)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-06 / D-78-05 pinned unchanged: manifest sha equals recorded -> outcome (unchanged), no swap, clone dirs untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-pinned-unchanged-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        // Manifest sha EQUALS the recorded sha.
        entrySource: { source: "url", url: cloneUrl, sha: SHA_OLD },
        recordedSha: SHA_OLD,
      });

      const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_OLD, "recorded sha unchanged");
      assert.equal(record?.version, `sha-${SHA_OLD.slice(0, 12)}`, "version unchanged");
      // The warm-cache clone was never re-cloned, and the (unchanged) short-
      // circuit did not GC the still-referenced clone.
      assert.equal(gitState.cloneCalls.length, 0, "no clone on an equal-sha (unchanged) update");
      assert.equal(
        await pathExists(seeded.oldCloneRoot ?? ""),
        true,
        "the still-referenced clone survives an unchanged update",
      );
      const body = notifications[0]?.message ?? "";
      assert.match(
        body,
        /\(skipped\) \{up-to-date\}|nothing to update/,
        "renders the up-to-date form",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09 / PURL-09: refreshing a DISABLED git-source record moves resolvedSha with the sha-derived version", async () => {
  // For a git source `toVersion` is shaVersion(resolvedSha), so a refresh that
  // bumps `version` without `resolvedSha` leaves the record advertising the new
  // commit while `reinstall` still pins its re-clone to the OLD one -- a silent
  // revert of the update. The two fields must agree after the refresh.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-disabled-refresh-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        // Recorded at SHA_OLD; the manifest now pins SHA_NEW.
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const locations = locationsFor("project", cwd);
      const seededState = await loadState(locations.extensionRoot);
      const seededRecord = seededState.marketplaces["mp"]?.plugins["gp"];
      assert.ok(seededRecord !== undefined);
      // Disable the record in place: the ENBL-02 marker plus the emptied
      // resource slots a real disable leaves behind.
      seededState.marketplaces["mp"]!.plugins["gp"] = {
        ...seededRecord,
        enabled: false,
        resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
      };
      await saveState(locations.extensionRoot, seededState);

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined);
      assert.equal(record.version, `sha-${SHA_NEW.slice(0, 12)}`, "version is shaVersion(new)");
      assert.equal(record.resolvedSha, SHA_NEW, "the pin moves with the sha-derived version");
      assert.equal(
        record.version,
        `sha-${(record.resolvedSha ?? "").slice(0, 12)}`,
        "version and resolvedSha must describe the SAME commit after the refresh",
      );
      // The refresh never re-materializes: the record stays disabled and empty.
      assert.equal(record.enabled, false, "the record stays disabled");
      assertResourcesEmpty(record, "stay empty (no re-materialization)");
      // PURL-06 / D-78-01: the refresh re-pointed resolvedSource + resolvedSha
      // at the clone the preflight materialized, so the OLD key is
      // unreferenced. This arm returns before the finalize path's
      // GC-after-swap, so the sweep has to run on the arm itself -- otherwise
      // every repeated update of a disabled git-source plugin accumulates one
      // more orphan until an unrelated command happens to sweep.
      const cloneEntries = (await readdir(locations.pluginClonesDir)).sort();
      assert.deepEqual(
        cloneEntries,
        [pluginCloneKey(cloneUrl, SHA_NEW)],
        "plugin-clones/ holds only the live key after the disabled-record refresh",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01/MIRR-03 unpinned update: refreshes the mirror in place and re-anchors the record to the bare mirror key with the HEAD sha", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-unpinned-swap-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        // Unpinned entry: no sha, no ref -> the probe routes to the mirror seam.
        entrySource: { source: "url", url: cloneUrl },
        recordedSha: SHA_OLD,
      });

      // The mirror seam reads HEAD from the refreshed clone (no resolveRemoteRef).
      const { gitOps, state: gitState } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // The mirror route reads HEAD directly; it does NOT resolve a remote ref.
      assert.equal(
        gitState.resolveRemoteRefCalls.length,
        0,
        "unpinned mirror update reads HEAD, not resolveRemoteRef",
      );

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_NEW, "records the refreshed mirror HEAD sha");
      assert.equal(record?.version, `sha-${SHA_NEW.slice(0, 12)}`, "version is shaVersion(HEAD)");

      // The record re-anchors to the BARE mirror key `plugin-clones/<12hex>/`.
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      assert.equal(record?.resolvedSource, mirrorRoot, "resolvedSource re-anchors to the mirror");
      assert.match(
        path.basename(record?.resolvedSource ?? ""),
        /^[0-9a-f]{12}$/,
        "resolvedSource segment is a bare 12-hex mirror key",
      );
      assert.equal(await pathExists(mirrorRoot), true, "the mirror clone materialized");
      // The old per-sha clone is no longer referenced -> GC sweeps it.
      assert.equal(await pathExists(seeded.oldCloneRoot ?? ""), false, "old per-sha clone GC'd");

      // MIRR-06 derive-not-persist: the post-swap GC leaves ONLY the bare mirror
      // dir under plugin-clones/ -- no per-sha orphan, and no persisted migration
      // artifact (refcount file / migration stamp) is written anywhere.
      const { readdir } = await import("node:fs/promises");
      const cloneEntries = (await readdir(locations.pluginClonesDir)).sort();
      assert.deepEqual(
        cloneEntries,
        [pluginMirrorKey(cloneUrl)],
        "plugin-clones/ holds only the bare mirror key after re-anchor + sweep (no migration state)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-06 / D-78-01 shared clone NOT GC'd: two git plugins share the old url+sha -> updating one keeps the old clone (the second still references it)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-shared-clone-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      // gp updates SHA_OLD -> SHA_NEW; sibling "other" stays pinned at SHA_OLD,
      // so the SHA_OLD clone must SURVIVE the GC (still referenced).
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
        extraPlugins: {
          other: {
            entrySource: { source: "url", url: cloneUrl, sha: SHA_OLD },
            recordedSha: SHA_OLD,
          },
        },
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        // Update ONLY gp; "other" keeps referencing the SHA_OLD clone.
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha, SHA_NEW, "gp swapped");
      assert.equal(
        after.marketplaces["mp"]?.plugins["other"]?.resolvedSha,
        SHA_OLD,
        "sibling still pinned at the old sha",
      );
      assert.equal(
        await pathExists(seeded.oldCloneRoot ?? ""),
        true,
        "the shared old clone SURVIVES because the sibling still references it",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01 / NFR-3 vanished repo: unpinned mirror update whose clone throws -> fails clean; plugin stays on recorded sha, existing REASONS token, no new token", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-vanished-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl },
        recordedSha: SHA_OLD,
      });

      // The upstream repo vanished: the mirror seam's cold clone throws a
      // DNS-resolution failure (errno ENOTFOUND) -- the network-unreachable
      // class. The mirror key has no warm dir, so the seam materializes cold and
      // the clone throw propagates through the probe unchanged.
      const networkError = new Error("getaddrinfo ENOTFOUND example.com") as NodeJS.ErrnoException;
      networkError.code = "ENOTFOUND";
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        cloneThrows: networkError,
      });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      // NFR-3 fail-clean: the plugin STAYS on its recorded sha (no swap).
      assert.equal(record?.resolvedSha, SHA_OLD, "plugin stays on its recorded sha");
      assert.equal(
        record?.version,
        `sha-${SHA_OLD.slice(0, 12)}`,
        "version stays at the recorded sha",
      );
      // The old clone is untouched (still referenced).
      assert.equal(await pathExists(seeded.oldCloneRoot ?? ""), true, "recorded clone untouched");
      // A failure surfaced through the EXISTING network-unreachable REASON token
      // (no new token); the plugin declined its swap and stayed put.
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /\{network unreachable\}/, "existing network-unreachable REASON token");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * PURL-03 / D-77-03: seed a git-subdir plugin whose monorepo fixture carries the
 * plugin tree under `plugins/p`, with an installed record pinned at
 * `recordedSha` (warm old clone on disk). The marketplace source stays path so
 * syncCloneOnce is a NFR-5 no-op; only the PLUGIN entry is git-subdir.
 */
async function seedGitSubdirMarketplace(opts: {
  cwd: string;
  cloneUrl: string;
  fixtureRepoDir: string;
  entrySource: unknown;
  recordedSha: string;
}): Promise<{ oldCloneRoot: string }> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const pluginDir = path.join(opts.fixtureRepoDir, "plugins", "p");
  await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "gp", version: "9.9.9" }),
  );
  const skillDir = path.join(pluginDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello.\n`);

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "gp", source: opts.entrySource }] }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  // Warm old clone at the recorded sha; the record anchors to its subdir root.
  const oldCloneRoot = await locations.pluginCloneDir(
    pluginCloneKey(opts.cloneUrl, opts.recordedSha),
  );
  await mkdir(path.dirname(oldCloneRoot), { recursive: true });
  await cp(opts.fixtureRepoDir, oldCloneRoot, { recursive: true });

  const record = makePluginRecord(`sha-${opts.recordedSha.slice(0, 12)}`);
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          gp: {
            ...record,
            resolvedSource: path.join(oldCloneRoot, "plugins", "p"),
            resolvedSha: opts.recordedSha,
          },
        },
      },
    },
  });

  return { oldCloneRoot };
}

test("PURL-03 pinned git-subdir update: the new clone's subdir anchors the pluginRoot and the ref hint threads into the clone seam", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-subdir-pinned-"));
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        // Pinned sha bump PLUS a ref: resolvePluginPin returns the ref so the
        // re-clone consumes it as the singleBranch fetch hint.
        entrySource: {
          source: "git-subdir",
          url: cloneUrl,
          path: "plugins/p",
          sha: SHA_NEW,
          ref: "main",
        },
        recordedSha: SHA_OLD,
      });

      const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "a state record survives the swap");
      assert.equal(record.resolvedSha, SHA_NEW, "resolvedSha swaps to the new manifest sha");
      assert.equal(record.version, `sha-${SHA_NEW.slice(0, 12)}`, "version is shaVersion(new)");

      const newCloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW));
      assert.equal(
        record.resolvedSource,
        path.join(newCloneRoot, "plugins", "p"),
        "resolvedSource anchors to the SUBDIR under the new clone root (never the monorepo root)",
      );
      assert.equal(gitState.cloneCalls[0]?.ref, "main", "the re-clone consumed the ref hint");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-03 pinned git-subdir update whose declared path is ABSENT in the new clone declines {no longer installable}; plugin stays on its recorded sha", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-subdir-missing-"));
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        // The new pinned tree does NOT carry plugins/missing.
        entrySource: { source: "git-subdir", url: cloneUrl, path: "plugins/missing", sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      // Fail-clean: the missing-subdir candidate declines; no swap.
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha,
        SHA_OLD,
        "plugin stays on its recorded sha",
      );
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /\{no longer installable\}/,
        "the structural missing-subdir decline renders the existing REASON token",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01 unpinned git-subdir update: the refreshed mirror's subdir anchors the pluginRoot and the record re-anchors to the mirror HEAD sha", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-subdir-unpinned-"));
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        // Unpinned (no sha) with a ref: routes to the mirror seam with the
        // ref hint threaded.
        entrySource: { source: "git-subdir", url: cloneUrl, path: "plugins/p", ref: "main" },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { ctx, pi } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_NEW, "records the refreshed mirror HEAD sha");
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      assert.equal(
        record?.resolvedSource,
        path.join(mirrorRoot, "plugins", "p"),
        "resolvedSource anchors to the SUBDIR under the mirror root",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01 unpinned git-subdir update whose declared path is ABSENT in the refreshed mirror declines {no longer installable}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-subdir-unpinned-missing-"));
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        entrySource: { source: "git-subdir", url: cloneUrl, path: "plugins/missing" },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha,
        SHA_OLD,
        "plugin stays on its recorded sha",
      );
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /\{no longer installable\}/,
        "the mirror-route missing-subdir decline renders the existing REASON token",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NFR-3 device-flow auth failure: a clone throw shaped UserCanceledError classifies as {authentication required}, not {no longer installable}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-git-usercanceled-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl },
        recordedSha: SHA_OLD,
      });

      // An unsuccessful device-flow auth (denied / expired / poll network
      // error) makes platform/git.ts's onAuth return `{ cancel: true }`, which
      // isomorphic-git throws as `UserCanceledError` -- NOT HttpError 401/403.
      const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        cloneThrows: authError,
      });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      // NFR-3 fail-clean: the plugin STAYS on its recorded sha (no swap).
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha,
        SHA_OLD,
        "plugin stays on its recorded sha",
      );
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /\{authentication required\}/,
        "an auth failure renders the existing authentication-required REASON token",
      );
      assert.doesNotMatch(
        body,
        /\{no longer installable\}/,
        "an auth failure must NOT render the lying no-longer-installable reason",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SUB-02 -- end-to-end ${CLAUDE_PROJECT_DIR} delivery through the update path
//
// update's prepareUpdateHandles threads `cwd` into every stage input by hand
// (an optional field the compiler cannot enforce). A refactor that drops the
// `cwd` line would compile, pass the rest of the suite, and silently ship
// un-substituted project dirs on the update path. This test seeds a
// project-scope fixture whose skill/command/agent bodies carry
// ${CLAUDE_PROJECT_DIR} and ${CLAUDE_SKILL_DIR}, updates to a new version, and
// asserts the re-staged files -- closing the silent-miss gap end-to-end.
// ───────────────────────────────────────────────────────────────────────────

test("SUB-02: project-scope update substitutes ${CLAUDE_PROJECT_DIR} to the install cwd in skill, command, and agent files; keeps ${CLAUDE_SKILL_DIR} literal in command and agent", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-sub02-proj-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasCommand: true, hasAgent: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Overwrite the seeded plugin source with token-bearing bodies so the
      // update re-stages content that exercises ${CLAUDE_PROJECT_DIR} and
      // ${CLAUDE_SKILL_DIR} substitution. The first materialization is the
      // update itself (seedPathMarketplace only seeds a state record).
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, "skills", "tool", "SKILL.md"),
        "---\nname: tool\n---\n\nProject: ${CLAUDE_PROJECT_DIR}\n",
      );
      await writeFile(
        path.join(pluginRoot, "commands", "deploy.md"),
        "# deploy\n\nProject: ${CLAUDE_PROJECT_DIR}\nSkill: ${CLAUDE_SKILL_DIR}\n",
      );
      await writeFile(
        path.join(pluginRoot, "agents", "bot.md"),
        "---\nname: bot\ntools: Read,Grep\n---\n\nProject: ${CLAUDE_PROJECT_DIR}\nSkill: ${CLAUDE_SKILL_DIR}\n",
      );

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const skillBody = await readFile(
        path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"),
        "utf8",
      );
      assert.ok(
        skillBody.includes(`Project: ${cwd}`),
        `skill: expected ${cwd} for projectDir, got: ${skillBody}`,
      );
      assert.equal(
        skillBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "skill: no remaining ${CLAUDE_PROJECT_DIR}",
      );

      const commandBody = await readFile(
        path.join(locations.promptsTargetDir, "hello:deploy.md"),
        "utf8",
      );
      assert.ok(
        commandBody.includes(`Project: ${cwd}`),
        `command: expected ${cwd} for projectDir, got: ${commandBody}`,
      );
      assert.equal(
        commandBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "command: no remaining ${CLAUDE_PROJECT_DIR}",
      );
      // ${CLAUDE_SKILL_DIR} is skill-scoped -- commands receive no skillDir, so
      // it stays literal.
      assert.ok(
        commandBody.includes("Skill: ${CLAUDE_SKILL_DIR}"),
        "command: expected literal ${CLAUDE_SKILL_DIR}, got: " + commandBody,
      );

      const agentBody = await readFile(
        path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`),
        "utf8",
      );
      assert.ok(
        agentBody.includes(`Project: ${cwd}`),
        `agent: expected ${cwd} for projectDir, got: ${agentBody}`,
      );
      assert.equal(
        agentBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "agent: no remaining ${CLAUDE_PROJECT_DIR}",
      );
      assert.ok(
        agentBody.includes("Skill: ${CLAUDE_SKILL_DIR}"),
        "agent: expected literal ${CLAUDE_SKILL_DIR}, got: " + agentBody,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MENV-04: project-scope update re-derives ${CLAUDE_PLUGIN_ROOT} in mcp.json when the plugin root changes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-menv04-proj-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasMcp: true,
            rawSourceOverride: "./plugins/hello-OLDROOT",
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Relocate the seeded plugin tree to the distinctively-named root the
      // manifest entry points at, and give its .mcp.json a
      // ${CLAUDE_PLUGIN_ROOT}-bearing command + args. The first
      // materialization is the update itself (seedPathMarketplace only seeds
      // a state record).
      const oldRoot = path.join(seeded.marketplaceRoot, "plugins", "hello-OLDROOT");
      await cp(path.join(seeded.marketplaceRoot, "plugins", "hello"), oldRoot, {
        recursive: true,
      });
      const mcpSource = JSON.stringify({
        mcpServers: {
          server1: {
            command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
            args: ["${CLAUDE_PLUGIN_ROOT}/lib"],
          },
        },
      });
      await writeFile(path.join(oldRoot, ".mcp.json"), mcpSource);

      const first = makeCtx();
      await updatePlugins({
        ctx: first.ctx,
        pi: first.pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const firstErrs = first.notifications.filter((n) => n.severity === "error");
      assert.equal(firstErrs.length, 0, `unexpected errors: ${JSON.stringify(firstErrs)}`);
      const afterFirst = await readFile(locations.mcpJsonPath, "utf8");
      assert.ok(afterFirst.includes(oldRoot), "first update materializes the old root");

      // Swap the source dir: copy the tree to a new root, bump its version,
      // and point the manifest entry at it -- the plugin root CHANGES.
      const newRoot = path.join(seeded.marketplaceRoot, "plugins", "hello-NEWROOT");
      await cp(oldRoot, newRoot, { recursive: true });
      await writeFile(
        path.join(newRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "1.0.2" }),
      );
      await rewriteManifest(seeded.manifestPath, "mp", {
        hello: { version: "1.0.2", rawSourceOverride: "./plugins/hello-NEWROOT" },
      });

      const second = makeCtx();
      await updatePlugins({
        ctx: second.ctx,
        pi: second.pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const secondErrs = second.notifications.filter((n) => n.severity === "error");
      assert.equal(secondErrs.length, 0, `unexpected errors: ${JSON.stringify(secondErrs)}`);

      // Substitution re-derives from the resolver's source, never from a
      // read-back of the prior mcp.json: the new root lands and no substring
      // of the old root survives anywhere in the raw file bytes.
      const onDisk = await readFile(locations.mcpJsonPath, "utf8");
      assert.ok(onDisk.includes(newRoot), "new root must be present");
      assert.equal(onDisk.includes("OLDROOT"), false, "no substring of the old root may survive");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WARN-01 / WR-12 / D-99-03: the `(updated)` row names a degraded component
// ──────────────────────────────────────────────────────────────────────────

/**
 * Frontmatter the YAML parser rejects. The bridge writes the component in
 * synthesized, non-model-invocable form rather than failing the ledger, which is
 * exactly why the row reporting the transition has to name it: `list` renders
 * the record's degraded state one command later, and a bare `(updated)` row
 * would contradict it.
 */
const UNPARSEABLE_FRONTMATTER = "---\nname: [unterminated\n---\n\n# Bad\nBody.\n";

test("WR-12: an update whose new source skill will not parse names the kind on the `(updated)` row and takes the warning raise", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr12-skill-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", "skills", "tool", "SKILL.md"),
        UNPARSEABLE_FRONTMATTER,
      );

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // Asserted through the PUBLIC verb, not through the renderer function:
      // `update` renders its rows through the verb-local `UPDATE_RENDER` map,
      // so a fix applied only to the central `renderPluginRow` arm would raise
      // the severity while still dropping the brace.
      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {malformed skill}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // WARN-01: the raise reaches the Pi API severity argument, not only the
      // summary line.
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-12: an update whose new source command will not parse names the command kind on the row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr12-command-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasCommand: true } },
        installedVersions: { hello: "1.0.0" },
      });

      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", "commands", "deploy.md"),
        UNPARSEABLE_FRONTMATTER,
      );

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {malformed command}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-12: an update that degrades BOTH kinds emits both reasons in the canonical order", async () => {
  // Order is the property the catalog byte fixture depends on, and it is why the
  // collection routes through `malformedReasonsForKinds` rather than a
  // verb-local kinds-to-reasons map: the helper owns the canonical emit order,
  // so a local map would produce the right tokens in the wrong order.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr12-both-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasCommand: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), UNPARSEABLE_FRONTMATTER);
      await writeFile(path.join(pluginRoot, "commands", "deploy.md"), UNPARSEABLE_FRONTMATTER);

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {malformed skill, malformed command}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01 / SURF-05: an update that materializes an orphan-rewake handler names it on the `(updated)` row", async () => {
  // `update` re-materializes `hooks/hooks.json`, so it introduces this config
  // bug exactly as install, enable and backfill do -- and it is the one verb
  // that INHERITS the shared signal shape, so a bare row here made the
  // inheritance's own claim false. The token names itself and moves NO severity
  // channel: the update was carried out in full.
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr01-orphan-"));
    try {
      _resetForTest();
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            // rewakeMessage WITHOUT asyncRewake: true -- the resolver's
            // `detectOrphanRewake` sets `orphanRewake` on the candidate.
            hooksJson: {
              PreToolUse: [
                {
                  matcher: "",
                  hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "wake me" }],
                },
              ],
            },
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

      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {orphan rewake}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, undefined, "orphan rewake stays info");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CR-01: a --partial update that drops a kind AND degrades a component names BOTH axes on one row", async () => {
  // The two axes are independent and the row its own axis owns names each of
  // them. The dropped kind picks the row FORM; the malformed component adds its
  // token to the same brace and carries the info -> warning raise. Before the
  // composer owned both forms, the cascade mapper picked `partially-installed`
  // itself and returned before the malformed axis was ever read, so this row
  // named the dropped kind alone at info severity -- contradicting the record
  // `list` renders one command later, which is the contradiction WR-12 exists
  // to close.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-cr01-both-axes-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // Dropped-kind axis: the candidate re-resolves `partially-available`.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");
      // Malformed axis: the SUPPORTED skill still materializes, in synthesized
      // form, because its frontmatter will not parse.
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", "skills", "tool", "SKILL.md"),
        UNPARSEABLE_FRONTMATTER,
      );

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◉ hello v1.1.0 (partially-installed) {malformed skill, unsupported component}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // The malformed raise reaches the Pi API severity argument. The drop alone
      // stays info on this surface (the `--partial` opt-in is explicit), so a
      // warning here can only have come from the malformed axis.
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NREG-01: a clean update row is byte-identical to before -- no brace, no raise", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-wr12-clean-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
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
      assert.equal(
        notifications[0]?.message ?? "",
        "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated)\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Rare failure and rollback arms (D-99-05b). Each case below reaches one arm
// no happy-path test touches, and asserts the arm's observable consequence --
// the rendered row, the closed-set reason, or the state the abort left behind.
// ───────────────────────────────────────────────────────────────────────────

test("WR-05: a bare-form update whose scope state is unreadable fails on the synthetic `(update)` row", async () => {
  // The bare form has no marketplace identity to attribute an enumerate
  // failure to, so it cannot reuse the `<marketplace>` synthetic-row path the
  // `@mp` / `pl@mp` forms take. A truncated state.json is the cheapest real
  // producer: loadState parses eagerly and throws out of enumerateTargets.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-bare-enumfail-"));
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await writeFile(locations.stateJsonPath, '{"schemaVersion": 1, "marketplaces": {');

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.equal(notifications.length, 1, "the enumerate failure emits exactly one notify");
      const body = notifications[0]?.message ?? "";
      // The placeholder occupies BOTH the marketplace-header slot and the row
      // name -- there is no real identity for either. The scope falls back to
      // `user` because the bare form carried no explicit scope.
      assert.match(body, /\n● \(update\) \[user\]\n/, `expected the (update) header in:\n${body}`);
      assert.match(
        body,
        /⊘ \(update\) \(failed\) \{unreadable manifest\}/,
        `expected the (update) row in:\n${body}`,
      );
      // The cause chain is the only carrier of which file could not be read.
      assert.match(body, /cause: state\.json at .* is not valid JSON/, `no cause in:\n${body}`);
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-03 fail-continue: a hooks write that cannot land is aggregated, not thrown past the other bridges", async () => {
  // writeHookConfig atomically renames onto <hooksDir>/<plugin>/hooks.json.
  // A leftover DIRECTORY at that exact path makes the rename fail with EISDIR
  // while every other bridge commits normally -- the fail-continue contract.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-phase3a-hooks-"));
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
            hooksJson: {
              hooks: { SessionStart: [{ hooks: [{ type: "command", command: "x" }] }] },
            },
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      await mkdir(path.join(locations.hooksDir, "hello", "hooks.json"), { recursive: true });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /hooks/, `the failing bridge must be named in:\n${body}`);
      assert.match(
        body,
        /plugin-uninstall \+ plugin-install for "hello"\./,
        `a phase-3 aggregate must carry the recovery hint in:\n${body}`,
      );

      // The version does NOT advance and the intent-mark survives: the record
      // reports "swap incomplete" until the user reinstalls.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.0.0", "a failed bridge leaves the version at fromVersion");
      assert.equal(record.compatibility.installable, false);
      assert.ok(record.compatibility.notes.includes("update-in-progress"));
      // Fail-continue: the skills bridge committed even though hooks did not.
      assert.deepEqual([...record.resources.skills], ["hello-tool"]);
      // The hooks inventory keeps its pre-update value, matching the disk.
      assert.deepEqual([...record.resources.hooks], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Wrap the clone-cache seam so `mutate` runs after the new clone materializes.
 * Materialization sits between preflight's state read and the intent-mark's
 * re-read, which is exactly the window the ST-9 guards defend: another process
 * writing state.json while this update holds a stale snapshot of it.
 */
function seamMutatingStateMidUpdate(
  gitOps: GitOps,
  mutate: () => Promise<void>,
): UpdateCloneCacheSeam {
  const base = seamWith(gitOps);
  return {
    ...base,
    materializePluginClone: async (args) => {
      const result = await base.materializePluginClone(args);
      await mutate();
      return result;
    },
  };
}

test("ST-9: a version that advanced under an in-flight update aborts on the intent-mark", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-st9-advanced-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture-new") });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const mid = await loadState(locations.extensionRoot);
          const mp = mid.marketplaces["mp"];
          assert.ok(mp !== undefined, "the racing writer needs the marketplace to be present");
          const racing = mp.plugins["gp"];
          assert.ok(racing !== undefined, "the racing writer needs a record to advance");
          mp.plugins["gp"] = { ...racing, version: "sha-cccccccccccc" };
          await saveState(locations.extensionRoot, mid);
        }),
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ gp \(failed\) \{concurrently updated\}/,
        `the version drift must reach the closed-set reason in:\n${body}`,
      );
      assert.match(body, /was concurrently updated; expected version/, `no cause in:\n${body}`);

      // The abort happens BEFORE the intent-mark writes, so the racing
      // writer's record survives untouched -- no half-applied swap.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "sha-cccccccccccc", "the racing write is not overwritten");
      assert.equal(record.resolvedSha, SHA_OLD, "no swap landed");
      assert.deepEqual(
        record.compatibility.notes,
        [],
        "no update-in-progress mark was left behind",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ST-9: a record uninstalled under an in-flight update aborts instead of resurrecting it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-st9-uninstalled-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture-new") });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const mid = await loadState(locations.extensionRoot);
          const mp = mid.marketplaces["mp"];
          assert.ok(mp !== undefined, "the racing writer needs the marketplace to be present");
          delete mp.plugins["gp"];
          await saveState(locations.extensionRoot, mid);
        }),
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ gp \(failed\) \{concurrently uninstalled\}/,
        `the vanished record must reach the closed-set reason in:\n${body}`,
      );
      assert.match(body, /was concurrently uninstalled/, `no cause in:\n${body}`);

      // The uninstall stands: an update must never write back a record the
      // user just removed.
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"],
        undefined,
        "the update must not resurrect the uninstalled record",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

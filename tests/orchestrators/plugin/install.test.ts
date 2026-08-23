import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_PREFIX,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import {
  classifyEntityShapeError,
  classifyInstallFailure,
  composeInstallFailureMessage,
  narrowResolverReasons,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import {
  installPlugin,
  type InstallCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  resetCompletionCache,
  getPluginIndex,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// PI-1..15 + AS-6 + AS-7 + COMP-01 + NFR-5.
//
// Test taxonomy (PRD §5.2.1 PI-1..15 + AS-6 + AS-7):
//   PI-1: orchestrator takes already-parsed `(plugin, marketplace)` -- covered
//         by every test that calls installPlugin with concrete strings.
//   PI-2: no network -- covered architecturally by tests/architecture/
//         no-orchestrator-network.test.ts. End-to-end: installPlugin has no
//         gitOps seam so by construction never calls the network.
//   PI-3: plugin not found in manifest -> notifyError "not found in marketplace".
//   PI-4: not installable (non-path source) -> notifyError "is not installable".
//   PI-5: already installed -> notifyError "is already installed".
//   PI-6: cross-plugin name conflict -> CrossPluginConflictError.
//   PI-7: version precedence -- entry.version then hash-<12hex> fallback.
//   PI-8: atomic staging + cleanup warnings (skills bridge cleanup-leak fold).
//   PI-9: 5-phase ordering + rollback on phase-N failure (end-state assertion).
//   PI-10: ${CLAUDE_PLUGIN_ROOT} substitution observable in staged skill body.
//   PI-11: subagents warning -- pi.getAllTools returns no "subagent" -> warning.
//   PI-12: mcp-adapter warning -- pi.getAllTools returns no "mcp" -> warning.
//   PI-13: dependencies declaration -> manual-install note appended to body.
//   PI-14: PathContainmentError bypass -- verbatim message, NO rollback partial.
//   PI-15: concurrent install (state pre-seeded) -> ConcurrentInstallError path
//          (the early-sanity check collapses with PI-5 on the same surface text;
//          the in-closure ConcurrentInstallError is a defensive layer covered
//          by code review).
//   AS-6: post-state-commit pluginDataDir mkdir failure -> warning severity.
//   AS-7: AG-5 foreign-content rows surface as warning, state record persisted.

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

/**
 * Hermetic home: override process.env.HOME for the duration of `fn`, then
 * restore. Lets us isolate user-scope state.json under a tmp root so the
 * test never reads or writes the developer's real ~/.pi/.
 */
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "install-home-"));
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

interface SeededPlugin {
  pluginRoot: string;
  marketplaceRoot: string;
  manifestPath: string;
}

/**
 * Write the plugin's component sources. Skills are directories carrying a
 * `SKILL.md`; commands and agents are single `.md` files; mcp is a
 * `.mcp.json` at the plugin root.
 *
 * WR-03: the hooks fixture seeds `<pluginRoot>/hooks/hooks.json` so the
 * resolver populates `installable.hooksConfigPath` and the install ledger's
 * cache-plus-rebuild path actually executes.
 */
async function writePluginComponents(
  pluginRoot: string,
  opts: {
    skills?: { sourceName: string; frontmatterName?: string; body?: string }[];
    commands?: { sourceName: string; body?: string }[];
    agents?: { sourceName: string; frontmatterName?: string; tools?: string; body?: string }[];
    mcpServers?: Record<string, unknown>;
    hooksJson?: object;
  },
): Promise<void> {
  for (const skill of opts.skills ?? []) {
    const skillDir = path.join(pluginRoot, "skills", skill.sourceName);
    await mkdir(skillDir, { recursive: true });
    const name = skill.frontmatterName ?? skill.sourceName;
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${name}\n---\n\n${skill.body ?? "Body.\n"}`,
    );
  }

  for (const command of opts.commands ?? []) {
    const commandsDir = path.join(pluginRoot, "commands");
    await mkdir(commandsDir, { recursive: true });
    await writeFile(
      path.join(commandsDir, `${command.sourceName}.md`),
      command.body ?? `# ${command.sourceName}\nBody.\n`,
    );
  }

  for (const agent of opts.agents ?? []) {
    const agentsDir = path.join(pluginRoot, "agents");
    await mkdir(agentsDir, { recursive: true });
    const name = agent.frontmatterName ?? agent.sourceName;
    const tools = agent.tools ?? "Read,Grep";
    await writeFile(
      path.join(agentsDir, `${agent.sourceName}.md`),
      `---\nname: ${name}\ntools: ${tools}\n---\n\n${agent.body ?? "Body.\n"}`,
    );
  }

  if (opts.mcpServers !== undefined) {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: opts.mcpServers }),
    );
  }

  if (opts.hooksJson !== undefined) {
    const hooksDir = path.join(pluginRoot, "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(opts.hooksJson));
  }
}

/**
 * PI-6 fixture: a SECOND marketplace whose installed plugin already owns one
 * of the generated names the plugin under test would produce, so the
 * cross-plugin conflict guard has something to collide with.
 */
function conflictingMarketplaceRecord(
  cp: {
    marketplace: string;
    plugin: string;
    skillName?: string;
    commandName?: string;
    agentName?: string;
  },
  scope: "user" | "project",
  cwd: string,
): ExtensionState["marketplaces"][string] {
  return {
    name: cp.marketplace,
    scope,
    source: pathSource("./other-mp"),
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, "other-mp.json"),
    marketplaceRoot: path.join(cwd, "other-mp"),
    plugins: {
      [cp.plugin]: {
        version: "0.0.1",
        resolvedSource: "/dev/null",
        compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
        resources: {
          skills: cp.skillName === undefined ? [] : [cp.skillName],
          prompts: cp.commandName === undefined ? [] : [cp.commandName],
          agents: cp.agentName === undefined ? [] : [cp.agentName],
          mcpServers: [],
          hooks: [],
        },
        enabled: true,
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  };
}

/**
 * Build a plugin source tree on disk and seed a path-source marketplace
 * pointing at it. Returns the absolute paths for downstream assertions.
 *
 * The marketplace manifest is written under `<marketplaceRoot>/.claude-plugin/marketplace.json`.
 * The plugin tree lives at `<marketplaceRoot>/plugins/<plugin>/`.
 */
/**
 * The plugin's OWN `.claude-plugin/plugin.json`. SNM-34 fixture knob: its
 * `version` is distinct from the marketplace `entry.version` (`pluginVersion`)
 * -- `undefined` preserves the legacy `0.0.1` shape, a string sets that
 * version, and `null` omits the field so the tier-1 read finds none.
 */
function buildSeededPluginManifest(
  pluginName: string,
  opts: {
    pluginJsonVersion?: string | null;
    experimental?: object;
    pluginJsonDefaultEnabled?: boolean;
  },
): Record<string, unknown> {
  return {
    name: pluginName,
    ...(opts.pluginJsonVersion === undefined
      ? { version: "0.0.1" }
      : opts.pluginJsonVersion !== null && { version: opts.pluginJsonVersion }),
    // D-64-06: declaring experimental kinds drives `resolveStrict` to the
    // `unsupported` (force-degradable) arm without a structural defect.
    ...(opts.experimental !== undefined && { experimental: opts.experimental }),
    ...(opts.pluginJsonDefaultEnabled !== undefined && {
      defaultEnabled: opts.pluginJsonDefaultEnabled,
    }),
  };
}

/** The plugin's entry in the seeded marketplace manifest. */
function buildSeededMarketplaceEntry(
  pluginName: string,
  opts: {
    rawSourceOverride?: unknown;
    pluginVersion?: string;
    declareDependencies?: boolean;
    entryDefaultEnabled?: boolean;
  },
): Record<string, unknown> {
  return {
    name: pluginName,
    source: opts.rawSourceOverride ?? `./plugins/${pluginName}`,
    ...(opts.pluginVersion !== undefined && { version: opts.pluginVersion }),
    // PI-13: the exact dependency shape is not validated; presence is.
    ...(opts.declareDependencies === true && { dependencies: { "some-other-plugin": "*" } }),
    ...(opts.entryDefaultEnabled !== undefined && { defaultEnabled: opts.entryDefaultEnabled }),
  };
}

/**
 * DFEN-08: seed each sibling's plugin tree and return its manifest entry.
 * Siblings share the manifest, the marketplace record and the scope, so the
 * only thing that can differ between their installs is the declaration under
 * test.
 */
async function seedSiblingPlugins(
  marketplaceRoot: string,
  opts: {
    pluginVersion?: string;
    siblingPlugins?: readonly { name: string; entryDefaultEnabled?: boolean }[];
  },
): Promise<Record<string, unknown>[]> {
  const entries: Record<string, unknown>[] = [];
  for (const sibling of opts.siblingPlugins ?? []) {
    const siblingRoot = path.join(marketplaceRoot, "plugins", sibling.name);
    await mkdir(path.join(siblingRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(siblingRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: sibling.name, version: "0.0.1" }),
    );
    const siblingSkillDir = path.join(siblingRoot, "skills", "tool");
    await mkdir(siblingSkillDir, { recursive: true });
    await writeFile(path.join(siblingSkillDir, "SKILL.md"), `---\nname: tool\n---\n\nBody.\n`);
    entries.push({
      name: sibling.name,
      source: `./plugins/${sibling.name}`,
      ...(opts.pluginVersion !== undefined && { version: opts.pluginVersion }),
      ...(sibling.entryDefaultEnabled !== undefined && {
        defaultEnabled: sibling.entryDefaultEnabled,
      }),
    });
  }

  return entries;
}

async function seedPathMarketplaceWithPlugin(opts: {
  cwd: string;
  marketplaceRoot: string;
  marketplaceName: string;
  pluginName: string;
  scope?: "user" | "project";
  /** Optional version stamp on the entry; absent -> hash-version fallback. */
  pluginVersion?: string;
  /**
   * The plugin's OWN `.claude-plugin/plugin.json` `version` field (distinct
   * from `pluginVersion`, which is the MARKETPLACE `entry.version`).
   *  - `undefined` (default): preserve the legacy seeded shape
   *    `{ name, version: "0.0.1" }` so existing fixtures are unaffected.
   *  - non-empty string: write that string as the plugin.json `version`.
   *  - `null`: write plugin.json WITHOUT a `version` field so the SNM-34
   *    tier-1 read finds no version and falls through.
   */
  pluginJsonVersion?: string | null;
  /**
   * DFEN-01: stamp `defaultEnabled` on the MARKETPLACE entry -- the side that
   * WINS the precedence rule. Both sides are named, unlike the version pair
   * above, because picking the wrong one yields a fixture that resolves through
   * the fallback instead of the winner and passes for the wrong reason.
   * Absent -> the entry is written exactly as it is without this knob.
   */
  entryDefaultEnabled?: boolean;
  /**
   * DFEN-01: stamp `defaultEnabled` on the plugin's own
   * `.claude-plugin/plugin.json` -- the precedence FALLBACK, consulted only
   * when `entryDefaultEnabled` is absent.
   * Absent -> plugin.json is written exactly as it is without this knob.
   */
  pluginJsonDefaultEnabled?: boolean;
  /**
   * D-64-06: declare unsupported component kinds in the plugin's own
   * plugin.json so `resolveStrict` returns `state: "partially-available"` with NO
   * structural defect (force-degradable). E.g.
   * `{ themes: "./themes", monitors: "./monitors.json" }`. The referenced paths
   * need not exist -- the declaration alone drives the `unsupported` arm.
   */
  experimental?: object;
  /** Skills to seed -- each `{ sourceName, body? }` becomes <pluginRoot>/skills/<sourceName>/SKILL.md. */
  skills?: { sourceName: string; frontmatterName?: string; body?: string }[];
  /** Commands -- each becomes <pluginRoot>/commands/<sourceName>.md. */
  commands?: { sourceName: string; body?: string }[];
  /** Agents -- each becomes <pluginRoot>/agents/<sourceName>.md. */
  agents?: { sourceName: string; frontmatterName?: string; tools?: string; body?: string }[];
  /** mcp.json contents at <pluginRoot>/.mcp.json (raw object). */
  mcpServers?: Record<string, unknown>;
  /** PI-13: declares dependencies. The exact shape isn't validated; presence is. */
  declareDependencies?: boolean;
  /** Pre-seed a state.json with this plugin already installed (PI-5/PI-15). */
  preInstall?: boolean;
  /** Seed an additional plugin in state that already owns one of the generated names (PI-6). */
  conflictingPriorPlugin?: {
    marketplace: string;
    plugin: string;
    skillName?: string;
    commandName?: string;
    agentName?: string;
  };
  /** Override the entry's `source` field with a non-path source (PI-4). */
  rawSourceOverride?: unknown;
  /**
   * WR-03: seed a `<pluginRoot>/hooks/hooks.json` payload so the resolver
   * advertises `hooksConfigPath` and the install/reinstall/update
   * orchestrators run their parsed-config-cache mutation path.
   */
  hooksJson?: object;
  /**
   * DFEN-08: additional entries seeded into the SAME marketplace manifest
   * beside `pluginName`, each with its own plugin tree carrying one skill.
   * Only the enablement declaration varies between them, which is what lets a
   * parity fixture install several plugins whose sole difference is the
   * declaration and compare the resulting rows inside one run. Absent -> the
   * manifest carries `pluginName` alone, exactly as before.
   */
  siblingPlugins?: readonly { name: string; entryDefaultEnabled?: boolean }[];
}): Promise<SeededPlugin> {
  const { cwd, marketplaceRoot, marketplaceName, pluginName } = opts;
  const scope = opts.scope ?? "project";

  await mkdir(marketplaceRoot, { recursive: true });
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  await mkdir(pluginRoot, { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify(buildSeededPluginManifest(pluginName, opts)),
  );

  await writePluginComponents(pluginRoot, opts);

  const manifest = {
    name: marketplaceName,
    plugins: [
      buildSeededMarketplaceEntry(pluginName, opts),
      ...(await seedSiblingPlugins(marketplaceRoot, opts)),
    ],
  };
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify(manifest));

  // Seed state with the marketplace record.
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      [marketplaceName]: {
        name: marketplaceName,
        scope,
        source: pathSource(`./${path.basename(marketplaceRoot)}`),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins:
          opts.preInstall === true
            ? {
                [pluginName]: {
                  version: opts.pluginVersion ?? "0.0.0",
                  resolvedSource: pluginRoot,
                  compatibility: {
                    installable: true,
                    notes: [],
                    supported: [],
                    unsupported: [],
                  },
                  resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
                  enabled: true,
                  installedAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
              }
            : {},
      },
    },
  };

  if (opts.conflictingPriorPlugin !== undefined) {
    state.marketplaces[opts.conflictingPriorPlugin.marketplace] = conflictingMarketplaceRecord(
      opts.conflictingPriorPlugin,
      scope,
      cwd,
    );
  }

  await saveState(locations.extensionRoot, state);
  return { pluginRoot, marketplaceRoot, manifestPath };
}

// ───────────────────────────────────────────────────────────────────────────
// PI-3 -- plugin not in marketplace manifest
// ───────────────────────────────────────────────────────────────────────────

test("PI-3: plugin name not in marketplace plugins[] -> V2 failed/{not in manifest}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi3-"));
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      // Seed marketplace WITHOUT the plugin we ask for.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "real-plugin",
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "ghost-plugin",
      });

      // V2 byte form matches `docs/output-catalog.md` lines 308-314
      // (`failure-runtime-with-cause`) with the entity-shape `{not in
      // manifest}` reason. Severity `"error"` per D-16-11. UXG-07
      // (D-29-02/03): 1 failed plugin, 0 failed marketplace -> the
      // "A plugin operation has failed." summary line is prepended.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A plugin operation has failed.\n\n" +
          "● mp [project]\n" +
          "  ⊘ ghost-plugin (failed) {not in manifest}\n" +
          '    cause: Plugin "ghost-plugin" not found in marketplace "mp".',
      );

      // State unchanged.
      const after = await loadState(locations.extensionRoot);
      const mp = after.marketplaces["mp"];
      assert.ok(mp !== undefined);
      assert.equal("ghost-plugin" in mp.plugins, false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-01 / M1: marketplace itself absent -> standalone {not added} on the marketplace subject", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi3b-"));
    try {
      // No state seeded -- the marketplace record is absent. After the CMP-3
      // project->user fallback also misses, install re-attributes the failure
      // to the MARKETPLACE subject via the canonical `MarketplaceNotAddedMessage` variant
      // (ATTR-01 / ATTR-08 split), NOT `{not in manifest}` on a plugin row.
      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "ghost-mp",
        plugin: "anything",
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // Standalone `marketplace-not-added` emission (D-47-A): a bare
      // column-0 row carrying the requested-scope bracket, NO summary line,
      // NO cause-chain trailer. Byte-identical to `info`'s scope-mismatch
      // not-added state.
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp [project] (failed) {not added}",
      );
      assert.equal(outcome.status, "failed");

      // State unchanged -- no marketplace container was synthesized.
      const after = await loadState(locationsFor("project", cwd).extensionRoot);
      assert.equal(after.marketplaces["ghost-mp"], undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Orchestrated ATTR-01 / M1: marketplace absent in orchestrated mode -> failed outcome, no notification", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-m1-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "ghost-mp",
        plugin: "anything",
        notifications: { mode: "orchestrated" },
      });

      // Orchestrated mode (import cascade) returns the failed outcome WITHOUT
      // emitting the standalone variant (the cascade caller renders its own
      // rows). Mirrors the entity-error orchestrated gate.
      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.equal(outcome.status, "failed");
      assert.ok("cause" in outcome && typeof outcome.cause === "string");
      assert.match((outcome as { cause: string }).cause, /not added in the project scope/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-4 -- non-installable plugin (e.g. github source is not installable)
// ───────────────────────────────────────────────────────────────────────────

test("PI-4: unsupported source (npm) -> V2 unavailable/{unsupported source}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi4-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        // PR-2 / PURL-01: path + the three git kinds (url / git-subdir / github)
        // are installable; `npm` stays out of scope and resolves the
        // not-installable `unavailable {unsupported source}` variant.
        rawSourceOverride: { source: "npm", package: "some-pkg" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // V2 byte form matches `docs/output-catalog.md:295-302` (catalog
      // `failure-unsupported-features`): `(unavailable)` with no
      // `[scope]` bracket on the plugin row (MSG-PL-6 / SNM-11 carve-out)
      // and reasons narrowed to the closed `unsupported source` Reason.
      // No `v<version>` slot because PI-4 throws BEFORE
      // `resolvePluginVersion` runs (`failureVersion` is undefined at
      // throw time). PluginUnavailableMessage carries no `cause?` field
      // per D-15-01 -- the reason text carries the explanation; no
      // cause-chain trailer. D-70-02 / SEV-02: the structural `unavailable`
      // install failure stamps `severity: "error"` (so the leading summary
      // line fires), but carries NO `--force` hint trailer -- force cannot
      // degrade-install a structural defect.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (unavailable) {unsupported source}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-5 -- already installed (early-sanity check at top of guard closure)
// ───────────────────────────────────────────────────────────────────────────

test("PI-5: state already has plugin record -> V2 failed/{already installed}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi5-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        preInstall: true,
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // V2 byte form matches `docs/output-catalog.md:306-314`
      // (`failure-runtime-with-cause`) with the entity-shape `{already
      // installed}` reason. No `v<version>` slot because the PI-5
      // early-sanity check throws BEFORE `resolvePluginVersion` runs
      // (`failureVersion` is undefined at throw time even though the
      // preInstall state record holds version "0.0.0").
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // UXG-07 (D-29-02/03): the already-installed case stays
      // classified as `(failed)` (D-29-05, UXG-09 out of scope); the summary
      // line "A plugin operation has failed." is prepended.
      assert.equal(
        notifications[0]?.message,
        "A plugin operation has failed.\n\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {already installed}\n" +
          '    cause: Plugin "hello" is already installed in marketplace "mp".',
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-6 -- cross-plugin name conflict
// ───────────────────────────────────────────────────────────────────────────

test("PI-6: generated skill name collides with another plugin's existing skill -> CrossPluginConflictError", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi6-"));
    try {
      // The plugin we're installing is "hello"; its skill is "shared-tool"
      // which the generator maps to "hello-shared-tool".
      // We seed a prior plugin "world" that already owns the same name
      // "hello-shared-tool" -> conflict.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "shared-tool", frontmatterName: "shared-tool" }],
        conflictingPriorPlugin: {
          marketplace: "other-mp",
          plugin: "world",
          skillName: "hello-shared-tool",
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /Cross-plugin name conflict/);
      assert.match(
        notifications[0]?.message ?? "",
        /hello-shared-tool/,
        "must name the colliding skill",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-7 -- version precedence
// ───────────────────────────────────────────────────────────────────────────

test("PI-7 (a): entry.version present, plugin.json version absent -> recorded state.version matches entry.version verbatim", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi7a-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.2.3",
        // SNM-34 D-23-01: plugin.json wins when it declares a version, so to
        // exercise the marketplace entry.version (tier 2) suppress plugin.json's.
        pluginJsonVersion: null,
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // No error notifications.
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.2.3");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PI-7 (b): entry.version absent, plugin.json version absent -> recorded state.version is hash-<12hex>", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi7b-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        // No pluginVersion (tier 2 absent) AND plugin.json version omitted
        // (tier 1 absent) -> genuine PI-7 hash fallback (tier 3).
        pluginJsonVersion: null,
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.match(
        record.version,
        /^hash-[0-9a-f]{12}$/,
        `expected hash-<12hex>, got "${record.version}"`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SNM-34: plugin.json version present, entry.version absent -> recorded state.version equals the plugin.json version verbatim (not a hash)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-snm34-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        // Marketplace entry.version OMITTED (tier 2 absent); the plugin's own
        // plugin.json declares a version (tier 1) -> plugin.json tier fires.
        pluginJsonVersion: "1.2.3",
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.2.3");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DFEN-04 / OUT-04 -- a declared `defaultEnabled: false` install lands disabled
//
// The standalone install honors the declaration: the record carries
// `enabled: false` while KEEPING its inventory (ENBL-18), no artifact survives
// on disk, `claude-plugins.json` gains the write-through, and the single
// notification is the info-severity `(disabled) {installs disabled}` row with
// the enable hint. The two declaration sites differ only in WHICH seeder knob
// carries the declaration, so they share one body -- "the two sites behave
// identically" is then enforced by construction rather than asserted in two
// copies that can drift apart.
//
// The recorded resources are asserted alongside the flag and against the disk,
// so "recorded disabled with its inventory" cannot be confused with "recorded
// but never materialized": those are separate outcomes, and a change that
// conflated them would otherwise pass on the flag alone.
// ───────────────────────────────────────────────────────────────────────────

const DFEN_DECLARATION_SITES = [
  {
    label: "marketplace entry declares defaultEnabled false",
    tmpPrefix: "install-dfen-entry-",
    seedKnob: { entryDefaultEnabled: false },
  },
  {
    // The entry stays silent, so the manifest declaration is the one the
    // resolver's precedence rule falls through to.
    label: "plugin.json declares defaultEnabled false with a silent entry",
    tmpPrefix: "install-dfen-manifest-",
    seedKnob: { pluginJsonDefaultEnabled: false },
  },
] as const;

for (const site of DFEN_DECLARATION_SITES) {
  test(`DFEN-04 / OUT-04: ${site.label} -> records disabled, drops the artifacts, writes through, and says so`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), site.tmpPrefix));
      try {
        const locations = locationsFor("project", cwd);
        await seedPathMarketplaceWithPlugin({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          marketplaceName: "mp",
          pluginName: "hello",
          skills: [{ sourceName: "tool" }],
          commands: [{ sourceName: "deploy" }],
          ...site.seedKnob,
        });

        const { ctx, pi, notifications } = makeCtx();
        await installPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          applyDefaultEnabled: true,
        });

        const errs = notifications.filter((n) => n.severity === "error");
        assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

        const after = await loadState(locations.extensionRoot);
        const record = after.marketplaces["mp"]?.plugins["hello"];
        assert.ok(record !== undefined);
        assert.equal(record.enabled, false);

        // ENBL-18: the record keeps its inventory. It describes WHAT the plugin
        // contains, which stays true while the plugin is disabled; emptiness is
        // never the disabled marker.
        assert.deepEqual([...record.resources.skills], ["hello-tool"]);
        assert.deepEqual([...record.resources.prompts], ["hello:deploy"]);

        // ...and nothing the record names is on disk. Asserting the inventory
        // without this would pass on a state-phase-only implementation that
        // never materialized, which is a different (and rejected) outcome.
        await assert.rejects(
          stat(path.join(locations.skillsTargetDir, "hello-tool")),
          "the staged skill directory must be gone",
        );
        await assert.rejects(
          stat(path.join(locations.promptsTargetDir, "hello:deploy.md")),
          "the staged command must be gone",
        );

        // DFEN-04: the state record is only half the contract. Without the
        // write-through the next reload reads the entry's absent `enabled` as
        // enabled, finds the record disabled, and plans a re-enable -- the
        // silent re-enable this behavior exists to close.
        const { loadConfig } =
          await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
        const cfg = await loadConfig(locations.configJsonPath);
        assert.equal(cfg.status, "valid");
        if (cfg.status === "valid") {
          assert.deepEqual(cfg.config.plugins?.["hello@mp"], { enabled: false });
        }

        // OUT-04 / D-102-07: one notification, informational -- the desired
        // state WAS reached -- naming the state, the author-declared cause and
        // the remedy, with no filesystem path anywhere in it (T-102-04).
        assert.equal(notifications.length, 1);
        const note = notifications[0]!;
        assert.equal(note.severity, undefined);
        assert.equal(
          note.message,
          "● mp [project]\n" +
            "  ◍ hello v0.0.1 (disabled) {installs disabled}\n" +
            "    Run enable on this plugin to use its components.",
        );
        assert.ok(
          !note.message.includes(cwd),
          `MUST NOT leak an absolute filesystem path, got: ${note.message}`,
        );
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────
// OUT-04 -- the install-disabled notification's observable contract
//
// The block above proves the terminal state. These pin what the user actually
// reads: how many notifications there are, at what severity, in what token
// ORDER, with which markers suppressed, and with a remedy that names something
// runnable and interpolates nothing.
// ───────────────────────────────────────────────────────────────────────────

/** The frozen D-102-10 trailer, restated here so a wording drift goes red. */
const ENABLE_HINT_TRAILER_BYTES = "Run enable on this plugin to use its components.";

test("OUT-04 / D-102-07 / ENBL-15: the install-disabled row is ONE info emission in subject-first order with no soft-dep marker", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-out04-row-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        entryDefaultEnabled: false,
        // All three artifact-bearing kinds, so the row is asserted against a
        // record that retained agent AND mcp inventory rather than an empty one.
        skills: [{ sourceName: "tool" }],
        commands: [{ sourceName: "deploy" }],
        agents: [{ sourceName: "bot" }],
        mcpServers: { server1: { command: "node", args: ["server.js"] } },
      });

      // ENBL-15 / D-100-06: BOTH companion extensions report UNLOADED. If the
      // `disabled` render arm ever threaded the real soft-dep flags instead of
      // hard-coding them false, this fixture is the one that would emit
      // `{requires pi-subagents, requires pi-mcp}` and fail below.
      const { ctx, pi, notifications } = makeCtx({ getAllTools: (): unknown[] => [] });
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });

      // IL-2: one install, one notification.
      assert.equal(notifications.length, 1);
      const note = notifications[0]!;
      // D-102-07: the desired state WAS reached, so the cascade reduces to info
      // and `notify()` passes no severity arg at all.
      assert.equal(note.severity, undefined);

      // Subject-first row grammar, asserted as ONE anchored ordered match so a
      // reordering of glyph / name / version / status / reasons cannot pass by
      // satisfying a set of independent substring checks.
      assert.match(note.message, /^ {2}◍ hello v1\.0\.0 \(disabled\) \{installs disabled\}$/m);

      // The record kept `agents` and `mcpServers`, and the row still carries no
      // companion marker: those markers state a runtime concern that is
      // suspended while the plugin is disabled.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.enabled, false);
      assert.deepEqual([...record.resources.agents], [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual([...record.resources.mcpServers], ["server1"]);
      assert.ok(
        !note.message.includes("requires pi-"),
        `a disabled row must carry no soft-dep marker, got: ${note.message}`,
      );

      // T-102-04: plugin / marketplace / version tokens only.
      assert.ok(
        !note.message.includes(cwd),
        `MUST NOT leak an absolute filesystem path, got: ${note.message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("OUT-04 / D-102-10: the enable hint is a frozen, non-interpolating trailer under the row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-out04-hint-"));
    try {
      // Deliberately distinctive names: a two-letter marketplace such as `mp`
      // is a substring of the trailer's own prose, so the non-interpolation
      // assertions below would fail for a reason that has nothing to do with
      // interpolation.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "acme-registry",
        pluginName: "widget",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        entryDefaultEnabled: false,
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "acme-registry",
        plugin: "widget",
        applyDefaultEnabled: true,
      });

      assert.equal(notifications.length, 1);
      const lines = (notifications[0]?.message ?? "").split("\n");
      const rowAt = lines.findIndex((l) => l.includes("(disabled)"));
      assert.notEqual(rowAt, -1, "the disabled row must be present");

      // Its own line, directly below the row, indented 4 spaces.
      const trailer = lines[rowAt + 1];
      assert.equal(trailer, `    ${ENABLE_HINT_TRAILER_BYTES}`);

      // T-69-01: the remedy names a runnable verb and nothing else. A trailer
      // that interpolated the ref would drift from the catalog byte form and
      // would have to be re-frozen per plugin.
      assert.ok(!trailer.includes("widget"), "the trailer must not name the plugin");
      assert.ok(!trailer.includes("acme-registry"), "the trailer must not name the marketplace");
      assert.ok(!trailer.includes("1.0.0"), "the trailer must not name the version");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("OUT-04 / D-102-10: an ordinary successful install carries no enable-hint trailer", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-out04-nohint-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });

      assert.equal(notifications.length, 1);
      // Without this the gate would be satisfiable by an unconditional append.
      assert.ok(
        !(notifications[0]?.message ?? "").includes(ENABLE_HINT_TRAILER_BYTES),
        `a clean install must not advertise the enable remedy, got: ${notifications[0]?.message ?? ""}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("OUT-04 / WARN-01 / FSTAT-07: the install-disabled row names the degradations the enable it advertises would inherit", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-out04-degraded-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        entryDefaultEnabled: false,
        // One skill whose frontmatter cannot be parsed (installed in degraded,
        // synthesized form) and two experimental kinds the resolver drops. Both
        // facts are durable and both constrain what the advertised `enable`
        // will produce -- unlike the soft-dep markers, whose runtime concern is
        // suspended while the plugin is disabled.
        skills: [{ sourceName: "bad", frontmatterName: "[unterminated", body: "# Bad\n" }],
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      });

      const { ctx, pi, notifications } = makeCtx({ getAllTools: (): unknown[] => [] });
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        partial: true,
        applyDefaultEnabled: true,
      });

      assert.equal(notifications.length, 1);
      const note = notifications[0]!;
      // WARN-01: a degrade this ledger run produced is a shortfall, and landing
      // disabled does not undo it.
      assert.equal(note.severity, "warning");
      assert.match(
        note.message,
        /^ {2}◍ p1 v1\.0\.0 \(disabled\) \{installs disabled, malformed skill, unsupported component\}$/m,
        `expected the cause first and both degradation facts after it; got:\n${note.message}`,
      );
      // ENBL-15 / D-100-06: the suppressed half stays suppressed.
      assert.ok(
        !note.message.includes("requires pi-"),
        `a disabled row must carry no soft-dep marker, got: ${note.message}`,
      );
      assert.ok(
        note.message.includes(`    ${ENABLE_HINT_TRAILER_BYTES}`),
        `expected the enable-hint trailer; got:\n${note.message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DFEN-05 -- an explicit `enabled` in the user's config wins over the plugin
// author's `defaultEnabled`, in either direction, and is never rewritten.
//
// The gate is a THREE-valued read of one key: `true`, `false`, and ABSENT. Only
// the absent value is the manifest's to answer, which is why the question is
// `entry.enabled !== undefined` rather than `isDeclaredEnabled(entry)` -- the
// two agree on `true` and on `false` and disagree exactly on absent. A matrix
// that exercised only the two present values would therefore pass while the
// gate asked the wrong question, so all three are covered below.
//
// Every case asserts the config entry as a WHOLE OBJECT. The threat DFEN-05
// closes is a plugin release silently moving a value the user typed; an
// assertion on the flag alone would miss a write that added or removed some
// other key in the same entry, which is the same trust problem one field over.
//
// `seedLocal` puts the declaration in `claude-plugins.local.json`. CFG-02 makes
// that entry the effective one whatever the write target is, so the gate has to
// read both files; D-103-16 then aims the write at the file the declaration
// lives in, so the local-declared rows write the LOCAL file.
// `expectSiblingEntryAfter` / `expectSiblingKeyAbsent` pin what the untargeted
// file holds afterwards.
// ───────────────────────────────────────────────────────────────────────────

interface DfenPrecedenceCase {
  readonly label: string;
  readonly tmpPrefix: string;
  /** Seed the declaration into `claude-plugins.local.json` instead of the base file. */
  readonly seedLocal?: boolean;
  readonly seededEntry: Record<string, unknown>;
  readonly manifestDefaultEnabled: boolean;
  readonly expectRecordEnabled: boolean;
  readonly expectArtifacts: boolean;
  /** The whole entry the SEEDED file holds after the install. */
  readonly expectEntryAfter: Record<string, unknown>;
  /** The whole entry the OTHER physical file holds after the install, when asserted. */
  readonly expectSiblingEntryAfter?: Record<string, unknown>;
  /**
   * D-103-16: the OTHER physical file holds NO entry for the key. Distinct from
   * `expectSiblingEntryAfter: {}` -- which asserts the file exists and carries a
   * fieldless entry -- because a file the install never targets may not exist at
   * all, and `loadConfig` answers `absent` rather than `valid` for it.
   */
  readonly expectSiblingKeyAbsent?: boolean;
  /**
   * Seed this entry into the file `seedLocal` does NOT name, so the fixture
   * declares the key in BOTH physical files -- the shape that separates a
   * write target chosen by file identity from one chosen by the caller's flag.
   */
  readonly alsoSeedSiblingEntry?: Record<string, unknown>;
  /**
   * D-103-03: run ONE reconcile pass after the install and assert it drives the
   * record to disabled and drops the artifacts, leaving `expectEntryAfter`
   * byte-identical. Opt-in per case: only the row whose install deliberately
   * lands ENABLED under a declaration saying otherwise has a divergence to
   * close, and the other rows would be asserting a no-op pass.
   */
  readonly expectReconcileConverges?: boolean;
}

const DFEN_PRECEDENCE_CASES: readonly DfenPrecedenceCase[] = [
  {
    label: "an explicit `enabled: true` beats a manifest declaring defaultEnabled false",
    tmpPrefix: "install-dfen05-true-wins-",
    seededEntry: { enabled: true },
    manifestDefaultEnabled: false,
    expectRecordEnabled: true,
    expectArtifacts: true,
    expectEntryAfter: { enabled: true },
  },
  {
    // The mirror of the case above, and the direction that matters most: the
    // manifest says `true` and the user said `false`. The install verb still
    // materializes -- running `install` IS the user asking for the install --
    // so the contract asserted here is the CONFIG one DFEN-05 actually states:
    // the entry the user wrote comes back byte-for-byte.
    //
    // To the reader about to make the two directions symmetric: that edit is
    // the one this comment exists to stop. The symmetric shape is to widen the
    // landed-disabled verdict so it ALSO fires on an explicit `enabled: false`,
    // letting the config value decide in both directions at the install
    // boundary. DFEN-08 forbids it (D-103-01). That requirement demands that a
    // plugin whose manifest declares `defaultEnabled: true`, and a plugin whose
    // manifest never mentions the field at all, behave and render
    // byte-identically to the pre-`defaultEnabled` releases across install,
    // update, reinstall, list, info and reconcile. Widening changes `install`
    // for the silent manifests: a config `enabled: false` with no declaration
    // anywhere would begin installing disabled. Gating the widening on the
    // manifest declaring the field does not rescue it -- `defaultEnabled: true`
    // plus a config `false` is exactly this row, and it would change too. There
    // is no form of the widening that leaves DFEN-08 intact, so the verdict
    // keeps firing only on the ABSENT value.
    //
    // What makes the asymmetry tolerable rather than merely deliberate is that
    // the divergence it leaves -- a materialized, enabled record under a
    // declaration saying otherwise -- is TRANSIENT by construction.
    // `expectReconcileConverges` proves it below: one reconcile pass drives the
    // record to disabled and removes the artifacts, and it does so by acting on
    // the RECORD. The user's entry is still byte-identical afterwards; a pass
    // that "fixed" the config instead would be the overwrite DFEN-05 forbids.
    label:
      "an explicit `enabled: false` is not rewritten by a defaultEnabled-true manifest (DFEN-08), and the next pass converges the record",
    tmpPrefix: "install-dfen05-false-kept-",
    seededEntry: { enabled: false },
    manifestDefaultEnabled: true,
    expectRecordEnabled: true,
    expectArtifacts: true,
    expectEntryAfter: { enabled: false },
    expectReconcileConverges: true,
  },
  {
    // The only case the manifest gets to answer, and the one that separates
    // `entry.enabled !== undefined` from `isDeclaredEnabled(entry)`: a bare
    // `{}` reads as ENABLED under the second predicate, which would suppress
    // the declaration entirely. Its sibling directly above shares the fixture
    // apart from the seeded key and expects the opposite outcome -- do not
    // reconcile the two toward each other.
    label: "a hand-authored entry with no `enabled` key is the one the manifest answers",
    tmpPrefix: "install-dfen05-absent-",
    seededEntry: {},
    manifestDefaultEnabled: false,
    expectRecordEnabled: false,
    expectArtifacts: false,
    expectEntryAfter: { enabled: false },
  },
  {
    // The trivially-enabled control: both sides agree on `true`, so a gate that
    // was simply inverted would still have to fail somewhere, and this is where.
    label:
      "an explicit `enabled: true` under a manifest declaring defaultEnabled true is an ordinary install",
    tmpPrefix: "install-dfen05-both-true-",
    seededEntry: { enabled: true },
    manifestDefaultEnabled: true,
    expectRecordEnabled: true,
    expectArtifacts: true,
    expectEntryAfter: { enabled: true },
  },
  {
    // CFG-02: the declaration lives in the LOCAL file. A local entry replaces
    // the same-keyed base entry wholesale, so the user HAS stated an opinion
    // and the manifest never gets to answer -- reading only one file would
    // report the key absent, install the plugin disabled against that opinion,
    // and stamp an `enabled: false` the user never typed.
    label:
      "CFG-02 / D-103-16: an `enabled: true` in the local file wins, and the stamp follows it there",
    tmpPrefix: "install-dfen05-local-true-wins-",
    seedLocal: true,
    seededEntry: { enabled: true },
    manifestDefaultEnabled: false,
    expectRecordEnabled: true,
    expectArtifacts: true,
    expectEntryAfter: { enabled: true },
    // D-103-16: the write-back addresses the file the declaration LIVES in, so
    // it goes to the local file and the base file gains nothing -- it is never
    // created here at all. CR-02's adopted marketplace declaration rides that
    // same target in one atomic save rather than being split across the two
    // files; the adoption arm only fires when the marketplace is declared in
    // neither file, so there is no base-file declaration for it to contradict.
    expectSiblingKeyAbsent: true,
  },
  {
    // The case that fails if the effective-declaration label is derived from
    // the caller's `--local` flag instead of from the SELECTED file's identity.
    //
    // Both files declare the key: base bare `{}`, local `enabled: true`. The
    // key is in the local file, so the target is local, the local entry is the
    // effective declaration, its `enabled` is true, the verdict never fires and
    // the plugin installs ENABLED with both entries left exactly as seeded.
    //
    // Label the local target with the flag (false, since none was typed) and
    // the two files swap identities: the BASE bare `{}` is read as the
    // effective declaration, `enabled` comes back undefined, the verdict fires
    // against a manifest declaring false, and the install lands DISABLED while
    // stamping `enabled: false` over the `enabled: true` the user typed. The
    // entry is selected by physical-file identity BEFORE its `enabled` field is
    // read, which is why the label decides the answer rather than merely
    // describing it -- and why it is derived from the path the selector
    // returned, not from the flag.
    label:
      "CFG-02 / D-103-16: with the key in BOTH files the LOCAL entry decides, and neither file moves",
    tmpPrefix: "install-dfen05-both-files-",
    seedLocal: true,
    seededEntry: { enabled: true },
    alsoSeedSiblingEntry: {},
    manifestDefaultEnabled: false,
    expectRecordEnabled: true,
    expectArtifacts: true,
    expectEntryAfter: { enabled: true },
    expectSiblingEntryAfter: {},
  },
];

for (const precedence of DFEN_PRECEDENCE_CASES) {
  test(`DFEN-05: ${precedence.label}`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), precedence.tmpPrefix));
      try {
        const locations = locationsFor("project", cwd);
        await seedPathMarketplaceWithPlugin({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          marketplaceName: "mp",
          pluginName: "hello",
          entryDefaultEnabled: precedence.manifestDefaultEnabled,
          skills: [{ sourceName: "tool" }],
        });

        const { loadConfig, saveConfig } =
          await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
        const seededPath =
          precedence.seedLocal === true ? locations.configLocalJsonPath : locations.configJsonPath;
        const siblingPath =
          precedence.seedLocal === true ? locations.configJsonPath : locations.configLocalJsonPath;
        // The entry pre-exists, as it does for a user who hand-authored
        // `claude-plugins.json` before running the install.
        await saveConfig(
          seededPath,
          { schemaVersion: 1, plugins: { "hello@mp": { ...precedence.seededEntry } } },
          locations.scopeRoot,
        );
        if (precedence.alsoSeedSiblingEntry !== undefined) {
          await saveConfig(
            siblingPath,
            { schemaVersion: 1, plugins: { "hello@mp": { ...precedence.alsoSeedSiblingEntry } } },
            locations.scopeRoot,
          );
        }

        const { ctx, pi, notifications } = makeCtx();
        await installPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          applyDefaultEnabled: true,
        });

        const errs = notifications.filter((n) => n.severity === "error");
        assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

        const after = await loadState(locations.extensionRoot);
        const record = after.marketplaces["mp"]?.plugins["hello"];
        assert.ok(record !== undefined);
        assert.equal(record.enabled, precedence.expectRecordEnabled);

        const skillDir = path.join(locations.skillsTargetDir, "hello-tool");
        if (precedence.expectArtifacts) {
          assert.ok((await stat(skillDir)).isDirectory(), "the staged skill must be on disk");
        } else {
          await assert.rejects(stat(skillDir), "the staged skill directory must be gone");
        }

        // The whole entry, not just the flag: a write that added, changed or
        // removed any other key would make the user's own file untrustworthy.
        const cfg = await loadConfig(seededPath);
        assert.equal(cfg.status, "valid");
        if (cfg.status === "valid") {
          assert.deepEqual(cfg.config.plugins?.["hello@mp"], precedence.expectEntryAfter);
        }

        if (precedence.expectSiblingEntryAfter !== undefined) {
          const siblingCfg = await loadConfig(siblingPath);
          assert.equal(siblingCfg.status, "valid");
          if (siblingCfg.status === "valid") {
            assert.deepEqual(
              siblingCfg.config.plugins?.["hello@mp"],
              precedence.expectSiblingEntryAfter,
            );
          }
        }

        // The untargeted file may legitimately not exist -- asserting
        // `status === "valid"` on it would fail against correct behavior.
        if (precedence.expectSiblingKeyAbsent === true) {
          const siblingCfg = await loadConfig(siblingPath);
          const siblingPlugins =
            siblingCfg.status === "valid" ? siblingCfg.config.plugins : undefined;
          assert.equal(siblingPlugins?.["hello@mp"], undefined);
        }

        if (precedence.expectReconcileConverges === true) {
          const { loadMergedScopeConfig } =
            await import("../../../extensions/pi-claude-marketplace/persistence/config-merge.ts");
          const { planReconcile } =
            await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts");
          const { applyReconcile } =
            await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts");

          // Two fixture preconditions, asserted rather than assumed, because
          // either one silently turns the pass below into a no-op that would
          // "prove" convergence by never planning anything. The config must
          // declare the MARKETPLACE -- an entry naming an undeclared one is a
          // dangling reference and gets no disable -- and the merged read must
          // not be an invalid arm, which aborts the pass under CFG-03 before
          // the planner runs at all.
          const { merged } = await loadMergedScopeConfig(locations);
          const planned = planReconcile(merged, after, "project");
          assert.deepEqual(
            planned.sourceMismatches,
            [],
            "the marketplace must be declared -- a dangling reference plans no disable",
          );
          assert.deepEqual(planned.pluginsToDisable, [
            { scope: "project", plugin: "hello", marketplace: "mp" },
          ]);

          const reload = makeCtx();
          await applyReconcile({ ctx: reload.ctx, pi: reload.pi, cwd, scope: "project" });
          assert.deepEqual(
            reload.notifications.filter((n) => n.severity === "error"),
            [],
          );

          // The record moved to match the declaration, and a disable is
          // materially the artifacts leaving disk.
          const converged = await loadState(locations.extensionRoot);
          assert.equal(converged.marketplaces["mp"]?.plugins["hello"]?.enabled, false);
          await assert.rejects(stat(skillDir), "the disable must remove the staged skill");

          // The half that makes the divergence defensible rather than merely
          // temporary: convergence acted on the RECORD. The entry the user
          // wrote is still the whole object it was, so nothing rewrote a value
          // it does not own.
          const cfgConverged = await loadConfig(seededPath);
          assert.equal(cfgConverged.status, "valid");
          if (cfgConverged.status === "valid") {
            assert.deepEqual(
              cfgConverged.config.plugins?.["hello@mp"],
              precedence.expectEntryAfter,
            );
          }
        }
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

/**
 * DFEN-08: the overwhelming majority of plugins say nothing about install-time
 * enablement, and what they are owed is that NOTHING moved for them. The triple
 * is what makes that checkable instead of assumed: `beta` declares the
 * install-time default TRUE, `gamma` declares nothing at all, and the two must
 * render the same row as each other AND as the row this surface produced before
 * the field existed. `alpha`, declaring FALSE, is the third arm -- a precedence
 * fixture over a three-valued key that covers two of its values passes while
 * asking the wrong question -- and it doubles as the CONTROL proving these
 * installs reached the path that reads the declaration at all.
 *
 * This is the arm the DFEN-05 cases above do NOT cover. Every one of them seeds
 * an explicit `enabled` value, so each exercises the precedence rule and none
 * ever reaches the silent-user arm, which is the only arm the declaration can
 * answer. `install` is also the one verb that legitimately reads the field, so
 * it is where a parity regression is most likely.
 *
 * A standalone install emits ONE notification per call, so the three rows arrive
 * in three bodies rather than one cascade. The rows are still compared against
 * EACH OTHER with the plugin name normalized out, because a drift that two
 * independently-correct literals would both stay green through is exactly what
 * a parity claim has to catch.
 */
test("DFEN-08: a declared-true entry and a silent entry render identical install rows", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-dfen08-parity-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "alpha",
        // No entry version: every plugin tree the seeder writes stamps the same
        // `plugin.json` version, which is tier 1 of the version ladder, so all
        // three rows carry the same version and the declaration stays the only
        // difference between them.
        entryDefaultEnabled: false,
        skills: [{ sourceName: "tool" }],
        siblingPlugins: [
          { name: "beta", entryDefaultEnabled: true },
          // No knob at all: the conditional spread writes NO `defaultEnabled`
          // key on this entry, which is the arm every plugin that never heard
          // of the field lands on.
          { name: "gamma" },
        ],
      });

      // The user states nothing anywhere -- neither configuration file is
      // seeded -- because a stated value short-circuits the install's own gate
      // and would collapse the three arms onto one outcome.
      const install = async (plugin: string): Promise<NotifyRecord[]> => {
        const run = makeCtx();
        await installPlugin({
          ctx: run.ctx,
          pi: run.pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin,
          applyDefaultEnabled: true,
        });
        assert.deepEqual(
          run.notifications.filter((n) => n.severity === "error"),
          [],
        );
        return run.notifications;
      };

      const alphaNotifications = await install("alpha");
      const betaNotifications = await install("beta");
      const gammaNotifications = await install("gamma");

      // Whole-body rather than a substring match: the literal pins the header,
      // the row, the reload trailer and the absence of one.
      assert.equal(alphaNotifications.length, 1);
      assert.equal(
        alphaNotifications[0]?.message,
        "● mp [project]\n" +
          "  ◍ alpha v0.0.1 (disabled) {installs disabled}\n" +
          "    Run enable on this plugin to use its components.",
      );

      assert.equal(betaNotifications.length, 1);
      assert.equal(
        betaNotifications[0]?.message,
        "● mp [project]\n  ● beta v0.0.1 (installed)\n\n/reload to pick up changes",
      );
      assert.equal(gammaNotifications.length, 1);
      assert.equal(
        gammaNotifications[0]?.message,
        "● mp [project]\n  ● gamma v0.0.1 (installed)\n\n/reload to pick up changes",
      );
      // Severity is part of the row's observable form: an install that landed
      // as its author declared is the desired state reached, not a shortfall.
      assert.equal(alphaNotifications[0]?.severity, undefined);
      assert.equal(betaNotifications[0]?.severity, undefined);
      assert.equal(gammaNotifications[0]?.severity, undefined);

      // The parity claim itself, stated apart from the whole-body literals.
      // Before the field was consumed it was an unknown key under the lenient
      // manifest tolerance and therefore inert, so a declared-true entry and a
      // silent entry were LITERALLY the same input -- which is what makes these
      // literals the pre-`defaultEnabled` row form as well.
      const rowFor = (notifications: NotifyRecord[], name: string): string =>
        (notifications[0]?.message ?? "")
          .split("\n")
          .find((line) => line.startsWith(`  ● ${name} `)) ?? "";

      const betaRow = rowFor(betaNotifications, "beta");
      const gammaRow = rowFor(gammaNotifications, "gamma");
      assert.equal(betaRow, "  ● beta v0.0.1 (installed)");
      assert.equal(gammaRow, "  ● gamma v0.0.1 (installed)");
      assert.equal(
        betaRow.replaceAll("beta", "<plugin>"),
        gammaRow.replaceAll("gamma", "<plugin>"),
        "DFEN-08: the declared-true install row and the silent install row must COINCIDE",
      );

      // The records the rows report on. `alpha` is the control: without it a
      // fixture whose declarations never reached the install would satisfy
      // every assertion above.
      const after = await loadState(locations.extensionRoot);
      const plugins = after.marketplaces["mp"]?.plugins ?? {};
      assert.equal(
        plugins["alpha"]?.enabled,
        false,
        "control: the declared-false arm proves the declaration was read at all",
      );
      assert.equal(plugins["beta"]?.enabled, true, "DFEN-08: a declared-true entry moves nothing");
      assert.equal(plugins["gamma"]?.enabled, true, "DFEN-08: a silent entry moves nothing");

      // And the configuration entries the write-through authored. Only the
      // declaring arm gains a key; the other two are left bare, which is what
      // the reload convergence loop reads as enabled (D-04).
      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cfg = await loadConfig(locations.configJsonPath);
      assert.equal(cfg.status, "valid");
      if (cfg.status === "valid") {
        assert.deepEqual(cfg.config.plugins?.["alpha@mp"], { enabled: false });
        assert.deepEqual(cfg.config.plugins?.["beta@mp"], {});
        assert.deepEqual(cfg.config.plugins?.["gamma@mp"], {});
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// D-103-16 / DFEN-06 / CFG-02 -- the install stamp follows the DECLARATION.
//
// A user hand-writes `"hello@mp": {}` into `claude-plugins.local.json` and runs
// the install with no flag. The read half was already correct: the merged view
// says `enabled` is absent, so a plugin declaring `defaultEnabled: false` lands
// disabled. Aiming the WRITE by the flag instead put the `enabled: false` stamp
// in the base file, where CFG-02's wholesale per-key replacement shadows it --
// the merged entry still reads `enabled` absent, `isDeclaredEnabled` answers
// true, and every reload from then on plans an enable for a plugin the author
// declared off. Unattended, permanent, and reported as success each time.
//
// `enable` and `disable` carried the same defect at their own write site and
// were fixed with the same helper; treat the three as one rule, not as three
// coincidences. The rule is that a verb AUTHORING an enablement declaration
// writes where the declaration lives -- said as a rule rather than as a claim
// about coverage, because `maybeWritePluginConfigBack` still aims by the flag.
// ───────────────────────────────────────────────────────────────────────────

test("D-103-16 / DFEN-06 / CFG-02: a locally-declared install stamps the LOCAL file and moves the merged view", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-dfen06-local-stamp-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        entryDefaultEnabled: false,
        skills: [{ sourceName: "tool" }],
      });

      const { loadConfig, saveConfig, isDeclaredEnabled } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const { loadMergedScopeConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-merge.ts");

      // The declaration lives ONLY in the local file, and it is bare: the user
      // named the plugin without stating an opinion about enablement, which is
      // the one shape the manifest's `defaultEnabled` gets to answer.
      await saveConfig(
        locations.configLocalJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });
      assert.deepEqual(
        notifications.filter((n) => n.severity === "error"),
        [],
      );

      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.enabled, false);

      // The stamp landed in the declaring file, as a whole entry.
      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.deepEqual(localCfg.config.plugins?.["hello@mp"], { enabled: false });
      }

      // The base file gained nothing -- and was never created, so the `absent`
      // arm is the correct outcome rather than a `valid` file with no key.
      const baseCfg = await loadConfig(locations.configJsonPath);
      const basePlugins = baseCfg.status === "valid" ? baseCfg.config.plugins : undefined;
      assert.equal(basePlugins?.["hello@mp"], undefined);

      // The load-bearing assertion. "The local file gained the key" would also
      // hold if the stamp went to the base file and something else wrote the
      // local one; only the MERGED read distinguishes a correct stamp from one
      // CFG-02 shadows, and the merged view is the planner's only input.
      const { merged } = await loadMergedScopeConfig(locations);
      const mergedEntry = merged.plugins["hello@mp"];
      assert.ok(mergedEntry !== undefined);
      assert.equal(mergedEntry.source, "local");
      assert.equal(mergedEntry.entry.enabled, false);
      assert.equal(isDeclaredEnabled(mergedEntry.entry), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-103-16 / DFEN-06 / CFG-02: the reload after a locally-declared install plans nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-dfen06-local-reload-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        entryDefaultEnabled: false,
        skills: [{ sourceName: "tool" }],
      });

      const { loadConfig, saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const { loadMergedScopeConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-merge.ts");
      const { applyReconcile } =
        await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts");
      const { planReconcile } =
        await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts");
      const { emptyReconcilePlan } =
        await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts");

      await saveConfig(
        locations.configLocalJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );

      const install = makeCtx();
      await installPlugin({
        ctx: install.ctx,
        pi: install.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });
      const localBytes = await readFile(locations.configLocalJsonPath, "utf8");

      // What this half proves that the stamp half cannot: a write can land in
      // the right FILE and still leave the loop open, because whether the
      // planner sees it depends on the MERGED view rather than on the file. The
      // planner is the only witness that settles it -- so run a real reload and
      // then read the plan directly.
      const reload = makeCtx();
      await applyReconcile({ ctx: reload.ctx, pi: reload.pi, cwd, scope: "project" });
      assert.deepEqual(reload.notifications, [], "a converged pass says nothing");

      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.enabled, false);
      assert.equal(await readFile(locations.configLocalJsonPath, "utf8"), localBytes);

      const { merged } = await loadMergedScopeConfig(locations);
      assert.deepEqual(planReconcile(merged, after, "project"), emptyReconcilePlan("project"));

      // The base file is not asserted absent here: a reload materializes a base
      // config from recorded state when none exists, and its plugin entry is
      // FIELDLESS. The local entry keeps replacing it wholesale (CFG-02), which
      // is why the merged view above does not move -- pinned rather than
      // glossed, so a future change that writes a FIELD there fails a test
      // instead of silently reversing the user.
      const baseCfg = await loadConfig(locations.configJsonPath);
      const basePlugins = baseCfg.status === "valid" ? baseCfg.config.plugins : undefined;
      const baseEntry = basePlugins?.["hello@mp"];
      assert.ok(baseEntry === undefined || Object.keys(baseEntry).length === 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// D-102-03 -- a caller that does not opt in installs the plugin ENABLED.
//
// The opt-in is an explicit caller option rather than something derived from
// the config, and it has to be: on the `import` path the config entry does not
// exist yet when the install runs -- import writes every entry in a post-pass,
// after all installs return -- so an absent-entry inference would read "the
// user has stated no opinion" for every imported plugin and install the lot
// disabled, under declarations that say `enabled: true`.
//
// This case pins the orchestrator-level default every non-opting caller
// inherits. `update` and `reinstall` come through here; the `enable` branch of
// the enable/disable verb reaches `runInstallLedger` directly and never passes
// this point at all.
// ───────────────────────────────────────────────────────────────────────────

test("D-102-03: an install that does not opt in ignores defaultEnabled and lands enabled", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-d10203-optout-"));
    try {
      const locations = locationsFor("project", cwd);
      // The same declaration the opting-in cases install DISABLED from. The
      // only difference below is the missing `applyDefaultEnabled`.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        entryDefaultEnabled: false,
        skills: [{ sourceName: "tool" }],
        commands: [{ sourceName: "deploy" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.enabled, true);

      // The artifacts survive: nothing disabled them on the way out.
      assert.ok(
        (await stat(path.join(locations.skillsTargetDir, "hello-tool"))).isDirectory(),
        "the staged skill must be on disk",
      );
      assert.ok(
        (await stat(path.join(locations.promptsTargetDir, "hello:deploy.md"))).isFile(),
        "the staged command must be on disk",
      );

      // The ordinary success row, with neither the token nor the remedy.
      assert.equal(notifications.length, 1);
      const note = notifications[0]!;
      assert.equal(note.severity, undefined);
      assert.match(note.message, /^ {2}● hello v0\.0\.1 \(installed\)$/m);
      assert.ok(
        !note.message.includes("installs disabled"),
        `a non-opting install must not carry the token, got: ${note.message}`,
      );
      assert.ok(
        !note.message.includes(ENABLE_HINT_TRAILER_BYTES),
        `a non-opting install must not advertise the enable remedy, got: ${note.message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// T-102-01 -- a plugin the user's configuration says is disabled must not
// execute code in the session that installed it.
//
// The post-save hooks parsed-config cache add predates any notion of an install
// landing disabled: its gate asks "does this plugin declare hooks", not "is this
// plugin live". Left ungated it would register routing entries for a plugin that
// just had its on-disk hooks.json removed, and nothing short of the next hydrate
// would clear them.
// ───────────────────────────────────────────────────────────────────────────

test("T-102-01: an install-disabled plugin gets no hooks routing entry and no on-disk hooks config", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  const { getRoutingBucket } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");

  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-t10201-disabled-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hooky",
        entryDefaultEnabled: false,
        hooksJson: {
          PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hello" }] }],
        },
      });

      assert.equal(getRoutingBucket("PreToolUse").length, 0);

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hooky",
        applyDefaultEnabled: true,
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(summary.includes("(disabled)"), `expected a disabled row; got: ${summary}`);

      // No routing entry: dispatch cannot reach this plugin.
      assert.deepEqual([...getRoutingBucket("PreToolUse")], []);
      // ...and the staged config the routing table is rebuilt from is gone too,
      // so even a rebuild from disk could not resurrect it.
      await assert.rejects(
        stat(path.join(locations.hooksDir, "hooky", "hooks.json")),
        "the staged hooks.json must be gone",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("T-102-01: the same hooks fixture installed ENABLED does get its routing entry", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  const { getRoutingBucket } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");

  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-t10201-enabled-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // The contrast case: identical fixture, no `defaultEnabled` declaration.
      // Without it the assertion above could pass because the cache was never
      // populated for ANY install.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hooky",
        hooksJson: {
          PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hello" }] }],
        },
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hooky",
        applyDefaultEnabled: true,
      });

      const bucket = getRoutingBucket("PreToolUse");
      assert.equal(bucket.length, 1);
      assert.equal(bucket[0]?.pluginId, "hooky");
      assert.ok((await stat(path.join(locations.hooksDir, "hooky", "hooks.json"))).isFile());
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// D-102-02 / NFR-3 -- the one failure window this composition creates: the
// ledger succeeded, and the disable cascade then threw.
//
// The terminal state is deliberately characterized rather than repaired. An
// install that reports failure while leaving a recorded, ENABLED, partially
// unstaged plugin is precisely what an `install` followed by a failed `disable`
// produces, and the disable verb has the same asymmetry: a cascade that throws
// never reaches the disabled-record producer, so the record keeps
// `enabled: true`. Naming that here is what stops a later reader from inventing
// new failure semantics, a new reason token, or a new rollback composition for
// a path that already has an answer.
//
// What must hold is NFR-3: state.json describes what is still on disk. The
// bridges that ran cleanly removed their artifacts, so their axes are folded
// out of the record; the axes whose bridges never ran are retained, because
// those artifacts are still there.
// ───────────────────────────────────────────────────────────────────────────

test("D-102-02 / NFR-3: a disable cascade that throws reports failure and leaves the record shrunk to what survived", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-d10202-cascade-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        entryDefaultEnabled: false,
        // Skills and commands run first in the cascade and drop cleanly, so the
        // fold has something to subtract. The mcp axis is the one the throw
        // never reaches, so it has something to retain. The plugin declares NO
        // agents: the foreign row seeded below must survive the ledger's agents
        // phase, and a declared agent under the same generated name would
        // replace the foreign file on the way in and defuse the fault.
        skills: [{ sourceName: "tool" }],
        commands: [{ sourceName: "deploy" }],
        mcpServers: { server1: { command: "node", args: ["server.js"] } },
      });

      // The fault: AG-5 foreign content under the agent's target name, with an
      // agents-index row claiming it. The two paths treat that row differently
      // -- the install ledger routes it to `failed[]` and proceeds (AS-7),
      // while the cascade turns a non-empty `failed[]` into a throw -- which is
      // exactly the asymmetry this case needs: the ledger must succeed and the
      // cascade must then fail. The agents bridge runs third in the cascade's
      // skills -> commands -> agents -> hooks -> mcp order, so the two bridges
      // ahead of it drop cleanly and the two behind it never run.
      await mkdir(locations.agentsDir, { recursive: true });
      const foreignAgentName = `${GENERATED_AGENT_PREFIX}hello-bot`;
      const foreignAgentPath = path.join(locations.agentsDir, `${foreignAgentName}.md`);
      await writeFile(foreignAgentPath, "---\nname: foreign\n---\n\nNo marker.\n");
      await writeFile(
        locations.agentsIndexPath,
        JSON.stringify({
          schemaVersion: 1,
          agents: [
            {
              plugin: "hello",
              marketplace: "mp",
              sourceAgent: "bot",
              generatedName: foreignAgentName,
              sourcePath: "/orig/bot.md",
              targetPath: foreignAgentPath,
              sourceHash: "deadbeef",
              droppedFields: [],
              droppedTools: [],
              warnings: [],
            },
          ],
        }),
      );

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });

      assert.equal(notifications.length, 1);
      const note = notifications[0]!;
      assert.equal(note.severity, "error");
      assert.match(note.message, /\(failed\)/);

      // The failure is the DISABLE-side one. An install rollback would have
      // left no record at all, and would surface the rollback vocabulary.
      assert.ok(
        !note.message.includes("rollback partial"),
        `expected a disable-side failure, not an install rollback, got: ${note.message}`,
      );
      // ...and it names the bridge that threw, so the case cannot pass on some
      // other failure that happens to reach the same row.
      assert.match(note.message, /Failed to remove 1 agent\(s\)/);

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined, "the install itself succeeded, so the record must exist");

      // Never reached the disabled-record producer, so it is still enabled --
      // the same asymmetry the disable verb has on this path.
      assert.equal(record.enabled, true);

      // NFR-3: what the record claims is what is on disk. The skills and
      // commands bridges ran cleanly and removed their artifacts, so those axes
      // are folded out; mcp never ran, so its inventory stands.
      assert.deepEqual([...record.resources.skills], []);
      assert.deepEqual([...record.resources.prompts], []);
      assert.deepEqual([...record.resources.mcpServers], ["server1"]);
      await assert.rejects(
        stat(path.join(locations.skillsTargetDir, "hello-tool")),
        "the skills bridge ran, so its artifact must be gone",
      );
      await assert.rejects(
        stat(path.join(locations.promptsTargetDir, "hello:deploy.md")),
        "the commands bridge ran, so its artifact must be gone",
      );
      const mcp = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
        mcpServers?: Record<string, unknown>;
      };
      assert.ok(
        "server1" in (mcp.mcpServers ?? {}),
        "the mcp bridge never ran, so its artifact must still be there",
      );

      assert.notEqual(record.updatedAt, record.installedAt, "updatedAt must have moved");

      // NFR-3: the declaration is written on this path too. A saved record with
      // no declaration is a state neither convergence path can act on -- the
      // standalone retry is rejected by the PI-15 already-installed gate, and a
      // bare reconcile entry over a recorded, enabled, not-disabled record is
      // steady state for the planner. `enabled: false` is what makes the next
      // pass plan the disable this one could not finish.
      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cfg = await loadConfig(locations.configJsonPath);
      assert.equal(cfg.status, "valid");
      if (cfg.status === "valid") {
        assert.deepEqual(
          cfg.config.plugins?.["hello@mp"],
          { enabled: false },
          "a failed disable cascade must still declare enabled:false",
        );
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-9 -- 5-phase order + end-state assertion
// ───────────────────────────────────────────────────────────────────────────

test("PI-9: happy-path install lands skills + commands + agents + mcp + state in order", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi9-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.0.0",
        // SNM-34 D-23-01: plugin.json wins over entry.version. Align the
        // seeded plugin.json version with the entry so the rendered byte form
        // stays v1.0.0 (this test exercises the install pipeline + rendering,
        // not version precedence -- the dedicated tier tests own that).
        pluginJsonVersion: "1.0.0",
        skills: [{ sourceName: "tool" }],
        commands: [{ sourceName: "deploy" }],
        agents: [{ sourceName: "bot" }],
        mcpServers: { server1: { command: "node", args: ["server.js"] } },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // End-state: every bridge's target file exists.
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md");
      assert.ok((await readFile(skillTarget, "utf8")).length > 0, "skill SKILL.md must exist");

      const commandTarget = path.join(locations.promptsTargetDir, "hello:deploy.md");
      assert.ok((await readFile(commandTarget, "utf8")).length > 0, "command .md must exist");

      const agentTarget = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      assert.ok((await readFile(agentTarget, "utf8")).length > 0, "agent .md must exist");

      const mcp = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
        mcpServers?: Record<string, unknown>;
      };
      assert.ok(mcp.mcpServers !== undefined, "mcp.json must have mcpServers");
      assert.ok("server1" in (mcp.mcpServers ?? {}), "server1 must be present");

      // State commit: plugin record has all four resource arrays populated.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.deepEqual([...record.resources.skills], ["hello-tool"]);
      assert.deepEqual([...record.resources.prompts], ["hello:deploy"]);
      assert.deepEqual([...record.resources.agents], [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual([...record.resources.mcpServers], ["server1"]);

      // V2 byte form matches `docs/output-catalog.md` (`success-with-soft-dep`):
      // the default `makeCtx()` mocks pi without `subagent` or `mcp` tools so
      // both companion extensions are unloaded; the renderer emits both per-row
      // soft-dep markers from `dependencies: ["agents", "mcp"]` + the threaded
      // probe per D-16-14 / D-16-15. The fixture seeds version 1.0.0.
      // PluginInstalledMessage triggers the reload-hint structurally per D-16-12.
      // SEV-01: both declared companions are unloaded, so the success row stamps
      // warning -- the cascade gains the `needs attention` summary line.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.equal(
        notifications[0]?.message,
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 (installed) {requires pi-subagents, requires pi-mcp}\n" +
          "\n" +
          "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-10 -- ${CLAUDE_PLUGIN_ROOT} substitution observable in staged content
// ───────────────────────────────────────────────────────────────────────────

test("PI-10: staged skill body has ${CLAUDE_PLUGIN_ROOT} replaced with absolute pluginRoot", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi10-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [
          {
            sourceName: "tool",
            body: "Plugin root: ${CLAUDE_PLUGIN_ROOT}\nPlugin data: ${CLAUDE_PLUGIN_DATA}\n",
          },
        ],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const skillBody = await readFile(
        path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"),
        "utf8",
      );

      // Substitution: ${CLAUDE_PLUGIN_ROOT} -> absolute pluginRoot.
      assert.ok(
        skillBody.includes(`Plugin root: ${seeded.pluginRoot}`),
        `expected pluginRoot substitution, got: ${skillBody}`,
      );

      // Substitution: ${CLAUDE_PLUGIN_DATA} -> absolute pluginDataDir.
      const expectedDataDir = path.join(locations.dataRoot, "mp", "hello");
      assert.ok(
        skillBody.includes(`Plugin data: ${expectedDataDir}`),
        `expected pluginDataDir substitution, got: ${skillBody}`,
      );

      // No remaining placeholders.
      assert.equal(
        skillBody.includes("${CLAUDE_PLUGIN_ROOT}"),
        false,
        "no remaining CLAUDE_PLUGIN_ROOT placeholder",
      );
      assert.equal(
        skillBody.includes("${CLAUDE_PLUGIN_DATA}"),
        false,
        "no remaining CLAUDE_PLUGIN_DATA placeholder",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-11 / RH-3 -- subagents not loaded warning
// ───────────────────────────────────────────────────────────────────────────

test("PI-11 / RH-3: staged agents + pi.getAllTools has no 'subagent' -> success message includes 'pi-subagents is not loaded'", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi11-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        agents: [{ sourceName: "bot" }],
      });

      const { ctx, pi, notifications } = makeCtx({ getAllTools: () => [] });
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // CMC-13 / MSG-SD-1: per-row soft-dep marker `{requires pi-subagents}`
      // fires when (declaresAgents AND !piSubagentsLoaded). The renderer
      // composes the marker into the reasons block of the PluginInlineRow
      // per D-13-07.
      // SEV-01: the declared `pi-subagents` companion is unloaded, so the
      // success row stamps warning (silent degradation of a clean install).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.match(
        notifications[0]?.message ?? "",
        /\{requires pi-subagents\}/,
        "must include per-row {requires pi-subagents} marker",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-12 / RH-4 -- mcp-adapter not loaded warning
// ───────────────────────────────────────────────────────────────────────────

test("PI-12 / RH-4: staged mcp + pi.getAllTools has no 'mcp' -> success message includes 'pi-mcp-adapter is not loaded'", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi12-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        mcpServers: { server1: { command: "node" } },
      });

      const { ctx, pi, notifications } = makeCtx({ getAllTools: () => [] });
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // CMC-13 / MSG-SD-2: per-row soft-dep marker `{requires pi-mcp}`
      // fires when (declaresMcp AND !piMcpAdapterLoaded) per D-13-07.
      // SEV-01: the declared `pi-mcp-adapter` companion is unloaded, so the
      // success row stamps warning (silent degradation of a clean install).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.match(
        notifications[0]?.message ?? "",
        /\{requires pi-mcp\}/,
        "must include per-row {requires pi-mcp} marker",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SKILL-01 / WARN-01 -- unparseable skill degrades but installs
// ───────────────────────────────────────────────────────────────────────────

test("SKILL-01 / WARN-01: standalone install of a plugin with one unparseable skill -> (installed) {malformed skill} at warning severity, no hard-fail", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-malformed-skill-"));
    try {
      // `name: [unterminated` is a closed `---` block whose inner YAML is
      // malformed -> parseFrontmatter throws at gate 1 -> the skill is
      // synthesized into a disable-model-invocation block and still installs.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.0.0",
        skills: [{ sourceName: "bad", frontmatterName: "[unterminated", body: "# Bad\nBody.\n" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Not a hard fail: the degraded skill still installs.
      assert.equal(outcome.status, "installed");
      // D-86-03: the degrade surfaces the `{malformed skill}` reason token on
      // the `(installed)` row (NOT partially-installed -- the component is
      // installed in degraded form, not dropped) at warning severity.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.match(notifications[0]?.message ?? "", /\(installed\)/);
      assert.match(notifications[0]?.message ?? "", /\{malformed skill\}/);
      // The installed outcome carries the `degradedKinds` seam the orchestrated
      // reconcile composer consumes.
      assert.ok(outcome.status === "installed");
      assert.deepEqual([...(outcome.degradedKinds ?? [])], ["skill"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CMD-01 / WARN-01: standalone install of a plugin with one unparseable command -> (installed) {malformed command} at warning severity, no hard-fail", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-malformed-command-"));
    try {
      // A closed `---` block whose inner YAML is malformed (`title: A: B` -> a
      // mapping value where none is allowed) -> parseFrontmatter throws at gate 1
      // -> the command frontmatter is neutralized (stripped) and it still installs.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.0.0",
        commands: [{ sourceName: "bad", body: "---\ntitle: A: B: C\n---\nRun it.\n" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Not a hard fail: the degraded command still installs.
      assert.equal(outcome.status, "installed");
      // D-86-03: the degrade surfaces the `{malformed command}` reason token on
      // the `(installed)` row at warning severity (the command-vertical analogue
      // of the skill degrade E2E above).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.match(notifications[0]?.message ?? "", /\(installed\)/);
      assert.match(notifications[0]?.message ?? "", /\{malformed command\}/);
      assert.ok(outcome.status === "installed");
      assert.deepEqual([...(outcome.degradedKinds ?? [])], ["command"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-13 -- dependencies declaration -> manual-install note
// ───────────────────────────────────────────────────────────────────────────

test("PI-13: entry declares dependencies -> V2 dropped per D-19-01 (no PR-5 trailer)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi13-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
        declareDependencies: true,
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // D-19-01: the PI-13 follow-up notifyWarning (PR-5
      // manual-install free-form trailer) is DROPPED entirely in
      // standalone mode. The resolver still detects the deps note and
      // appends it to `installable.notes` so downstream surfaces (e.g.
      // `/claude:plugin list`) can continue to consume it; the
      // standalone-mode user-visible warning is gone (no clean
      // MarketplaceNotificationMessage representation for the PR-5 free
      // prose). Only the canonical success notification fires.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.match(notifications[0]?.message ?? "", /● hello v\S+ \(installed\)/);
      // Defense-in-depth: the dropped PR-5 phrase must NOT leak onto the
      // V2 notification surface (it does NOT appear on the success line
      // either -- the renderer has no field for it).
      assert.equal(
        (notifications[0]?.message ?? "").includes("dependencies that must be installed manually"),
        false,
        "D-19-01: PR-5 phrase must not appear on the V2 success surface",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-14 -- PathContainmentError bypasses rollback-partial marker
// ───────────────────────────────────────────────────────────────────────────

test("PI-14: PathContainmentError from a bridge prepare propagates verbatim with NO '(rollback partial:' marker", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi14-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      // Pre-create the skills target dir for the generated skill name as a
      // symlink. The skills bridge's prepareStageSkills calls
      // `assertPathInside(locations.skillsTargetDir, targetDir, ...)` where
      // targetDir = <skillsTargetDir>/<generated-name>. assertPathInside
      // walks segments below the parent; a symlink at the first segment is
      // refused via SymlinkRefusedError (subclass of PathContainmentError).
      await mkdir(locations.skillsTargetDir, { recursive: true });
      // Target of the symlink doesn't have to exist; readlink will report it.
      await symlink("/tmp/decoy", path.join(locations.skillsTargetDir, "hello-tool"));

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");

      // PI-14 verbatim: the user-visible message must NOT contain the
      // rollback-partial marker prefix.
      const msg = notifications[0]?.message ?? "";
      assert.equal(
        msg.includes("(rollback partial:"),
        false,
        `PI-14 violation: PathContainmentError must not be wrapped in rollback-partial; got: ${msg}`,
      );

      // The original symlink-refused message should be in the surface.
      assert.match(msg, /contains symlink|escapes/);

      // No state record landed.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-15 -- concurrent install detected at top of guard closure
// ───────────────────────────────────────────────────────────────────────────

test("PI-15 layer (a): record already exists -> caught by early-sanity check (collapses with PI-5 surface)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi15-"));
    try {
      // Pre-seed the record (PI-15 layer (a) sees this BEFORE the ledger runs).
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        preInstall: true,
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Surface collapses onto the PI-5 path: "is already installed".
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /is already installed/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AS-6 -- post-state-commit pluginDataDir mkdir failure -> warning severity
// ───────────────────────────────────────────────────────────────────────────

test("AS-6: pluginDataDir mkdir failure post-state-commit -> V2 drops warning per D-19-01, state record IS persisted", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-as6-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      // Pre-create the dataRoot/mp directory but chmod it read-only (0o555).
      // The path resolution inside the guard works (assertPathInside walks
      // the existing dirs without issue; the leaf "hello" doesn't exist so
      // lstat reports ENOENT -> walk returns OK). State commit then succeeds.
      // POST-state-commit, mkdir(dataRoot/mp/hello, {recursive: true}) fails
      // EACCES because the parent is not writable. The AS-6 warning is
      // DROPPED per D-19-01 -- the side effect still runs inside its
      // try/catch but the user-visible warning surface is gone.
      await mkdir(path.join(locations.dataRoot, "mp"), { recursive: true });
      const { chmod } = await import("node:fs/promises");
      await chmod(path.join(locations.dataRoot, "mp"), 0o555);

      const { ctx, pi, notifications } = makeCtx();
      try {
        await installPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        });
      } finally {
        // Restore perms so tmpdir cleanup works.
        await chmod(path.join(locations.dataRoot, "mp"), 0o755);
      }

      // The state record IS committed (state save happens BEFORE the mkdir).
      // AS-6's core invariant: state-commit precedes data-dir creation.
      const after = await loadState(locations.extensionRoot);
      assert.ok(
        "hello" in (after.marketplaces["mp"]?.plugins ?? {}),
        "state record must be persisted (mkdir failure is post-commit)",
      );

      // D-19-01: no warning notification fires in standalone
      // mode. Only the canonical success notification is emitted; the
      // "data dir creation deferred" phrase MUST NOT appear on any
      // notification.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        (notifications[0]?.message ?? "").toLowerCase().includes("data dir creation deferred"),
        false,
        "D-19-01: mkdir-failure warning surface is dropped in V2",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AS-7 -- agents-bridge foreign-content rows surface via warning, state persists
// ───────────────────────────────────────────────────────────────────────────

test("AS-7: pre-existing foreign agent file under target name -> V2 drops warning per D-19-01, state record IS persisted", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-as7-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        agents: [{ sourceName: "bot" }],
      });

      // Pre-seed the agents-index with a row for hello/bot pointing at a
      // foreign file (no marker in body) at the target. The agents bridge
      // SOFT-FAILS this row via `failed[]` -- the install proceeds. The
      // warning surface is DROPPED per D-19-01. The
      // underlying agents-index state still records the foreign-row
      // preservation; only the user-visible warning is gone.
      await mkdir(locations.extensionRoot, { recursive: true });
      await mkdir(locations.agentsDir, { recursive: true });
      const foreignAgentName = `${GENERATED_AGENT_PREFIX}hello-bot`;
      const foreignAgentPath = path.join(locations.agentsDir, `${foreignAgentName}.md`);
      await writeFile(foreignAgentPath, "---\nname: foreign\n---\n\nNo marker.\n");

      // Seed agents-index pointing at the foreign file (so previousEntries
      // detects it during prepare).
      await writeFile(
        locations.agentsIndexPath,
        JSON.stringify({
          schemaVersion: 1,
          agents: [
            {
              plugin: "hello",
              marketplace: "mp",
              sourceAgent: "bot",
              generatedName: foreignAgentName,
              sourcePath: "/orig/bot.md",
              targetPath: foreignAgentPath,
              sourceHash: "deadbeef",
              droppedFields: [],
              droppedTools: [],
              warnings: [],
            },
          ],
        }),
      );

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // State record persisted.
      const after = await loadState(locations.extensionRoot);
      assert.ok("hello" in (after.marketplaces["mp"]?.plugins ?? {}));

      // D-19-01: no AS-7 foreign-agent warning notification fires in standalone
      // mode -- that warning surface is dropped. Only the canonical success
      // notification is emitted, and the "pre-existing agent file" phrase MUST
      // NOT appear on it. SEV-01: the plugin declares an agent while the
      // `pi-subagents` companion is unloaded, so the canonical success row
      // independently stamps warning (the missing-companion ladder, not the
      // dropped AS-7 surface).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.equal(
        (notifications[0]?.message ?? "").includes("pre-existing agent file"),
        false,
        "D-19-01: AS-7 foreign-agent warning surface is dropped in V2",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CMP-2..4 / PI-16 and PI-17 -- source/target scope split
// ───────────────────────────────────────────────────────────────────────────

test("CMP-3 / PI-16: project-target install falls back to user-scope marketplace source", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-cmp3-"));
    try {
      const userLocations = locationsFor("user", cwd);
      const projectLocations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        scope: "user",
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // V2 byte form: bare marketplace header + plugin row at 2-space
      // indent + reload-hint trailer per D-16-12.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.match(
        notifications[0]?.message ?? "",
        /^● mp \[project\]\n {2}● hello [^(]*\(installed\)/,
      );
      assert.match(notifications[0]?.message ?? "", /\/reload to pick up changes$/);

      const userAfter = await loadState(userLocations.extensionRoot);
      const projectAfter = await loadState(projectLocations.extensionRoot);
      assert.equal(userAfter.marketplaces["mp"]?.plugins["hello"], undefined);
      assert.equal(projectAfter.marketplaces["mp"]?.scope, "project");
      assert.ok(projectAfter.marketplaces["mp"]?.plugins["hello"] !== undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CMP-4 / PI-16: user-target install cannot source a project-only marketplace", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-cmp4-"));
    try {
      const userLocations = locationsFor("user", cwd);
      const projectLocations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "project-mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "user",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // ATTR-01 / SCOPE-01 / M1: a user-target install cannot source a
      // project-only marketplace and the CMP-3 fallback is user->? only (it
      // does NOT fall back project, so the user-target miss is terminal).
      // The marketplace is "not added in user", surfaced via the standalone
      // `marketplace-not-added` variant with the `[user]` bracket -- NOT
      // `{not in manifest}` on a plugin row.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ mp [user] (failed) {not added}",
      );

      const userAfter = await loadState(userLocations.extensionRoot);
      const projectAfter = await loadState(projectLocations.extensionRoot);
      assert.equal(userAfter.marketplaces["mp"], undefined);
      assert.equal(projectAfter.marketplaces["mp"]?.plugins["hello"], undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PI-17: same plugin may be installed in both user and project target scopes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi17-"));
    try {
      const userLocations = locationsFor("user", cwd);
      const projectLocations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        scope: "user",
        preInstall: true,
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // V2 byte form: bare marketplace header + plugin row at 2-space
      // indent.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.match(
        notifications[0]?.message ?? "",
        /^● mp \[project\]\n {2}● hello [^(]*\(installed\)/,
      );

      const userAfter = await loadState(userLocations.extensionRoot);
      const projectAfter = await loadState(projectLocations.extensionRoot);
      assert.ok(userAfter.marketplaces["mp"]?.plugins["hello"] !== undefined);
      assert.ok(projectAfter.marketplaces["mp"]?.plugins["hello"] !== undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-2 / NFR-5 -- architectural: no gitOps surface in install.ts
// ───────────────────────────────────────────────────────────────────────────

test("PI-2 / NFR-5: install.ts has zero git surface (no platform-git import, no DEFAULT_GIT_OPS, no gitOps field)", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts",
    "utf8",
  );
  // Header docstring legitimately mentions platform-git / DEFAULT_GIT_OPS /
  // gitOps in prose; strip comments first.
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(stripped.includes("platform/git"), false, "must not import platform/git");
  assert.equal(stripped.includes("DEFAULT_GIT_OPS"), false, "must not reference DEFAULT_GIT_OPS");
  assert.equal(stripped.includes("gitOps"), false, "must not reference gitOps");
});

// ───────────────────────────────────────────────────────────────────────────
// Bridge ordering sanity (PI-9 corollary) -- state record reflects all 4 bridges
// ───────────────────────────────────────────────────────────────────────────

test("PI-9 corollary: empty plugin (no skills/commands/agents/mcp) -> V2 emits reload-hint structurally on installed status", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi9b-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "0.1.0",
        // SNM-34 D-23-01: plugin.json wins over entry.version. Align the
        // seeded plugin.json version with the entry so the rendered byte form
        // stays v0.1.0 (this test exercises the reload-hint trigger, not
        // version precedence).
        pluginJsonVersion: "0.1.0",
        // No skills, commands, agents, or mcpServers.
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined, "state record must be present");
      assert.deepEqual([...record.resources.skills], []);
      assert.deepEqual([...record.resources.prompts], []);
      assert.deepEqual([...record.resources.agents], []);
      assert.deepEqual([...record.resources.mcpServers], []);

      // The reload-hint is emitted structurally from the
      // `installed` status per D-16-12; there is no MSG-RH-1 noop-gate
      // ("suppress when nothing was staged"). The trigger ladder
      // is per-variant, not per-cascade-outcome resource count. The
      // resourcesChanged field on InstallPluginOutcome still tracks
      // whether anything was staged for downstream cascade consumers.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" + "  ● hello v0.1.0 (installed)\n" + "\n" + "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Marker presence in staged agent (sanity for PI-9 agent phase output)
// ───────────────────────────────────────────────────────────────────────────

test("Sanity: staged agent target carries the AG-5 owned-agent marker", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-marker-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        agents: [{ sourceName: "bot" }],
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      const body = await readFile(agentPath, "utf8");
      assert.ok(
        body.includes(GENERATED_AGENT_MARKER),
        `staged agent must include AG-5 owned-agent marker; got: ${body}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Rollback undo body tests: verify each bridge's undo path removes its
// staged artifacts when a later phase fails.
// ───────────────────────────────────────────────────────────────────────────

test("Rollback-skills-undo: skills committed then commands phase fails -> skill target removed", async () => {
  // Gap: skillsPhase.undo body -- unstagePluginSkills called when skills
  // committed but a later phase (commands) fails with a non-containment error.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-undo-skills-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
        commands: [{ sourceName: "deploy" }],
      });

      // Pre-create a FILE at commandsStagingDir so that mkdir inside it
      // fails with ENOTDIR when the commands phase tries to create a UUID
      // staging sub-directory. This is a non-PathContainmentError, so the
      // phase ledger triggers rollback of skills (the only phase that ran).
      await mkdir(path.dirname(locations.commandsStagingDir), { recursive: true });
      await writeFile(locations.commandsStagingDir, "not-a-dir");

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Install must fail.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");

      // Skills undo: the committed skill dir must have been removed.
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool");
      const { stat } = await import("node:fs/promises");
      let exists = true;
      try {
        await stat(skillTarget);
      } catch {
        exists = false;
      }

      assert.equal(exists, false, "skills undo must remove the committed skill dir");

      // No state record persisted.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Rollback-commands-undo: commands committed then agents phase fails -> command target removed", async () => {
  // Gap: commandsPhase.undo body -- unstagePluginCommands called when
  // commands committed but a later phase (agents) fails.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-undo-cmds-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        commands: [{ sourceName: "deploy" }],
        agents: [{ sourceName: "bot" }],
      });

      // Pre-create a FILE at agentsStagingDir so that mkdir inside it
      // fails with ENOTDIR when the agents phase tries to create staging.
      await mkdir(path.dirname(locations.agentsStagingDir), { recursive: true });
      await writeFile(locations.agentsStagingDir, "not-a-dir");

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Install must fail.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");

      // Commands undo: the committed command file must have been removed.
      const commandTarget = path.join(locations.promptsTargetDir, "hello:deploy.md");
      const { stat } = await import("node:fs/promises");
      let exists = true;
      try {
        await stat(commandTarget);
      } catch {
        exists = false;
      }

      assert.equal(exists, false, "commands undo must remove the committed command file");

      // No state record persisted.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Rollback-agents-undo: agents committed then mcp phase fails -> agent target removed", async () => {
  // Gap: agentsPhase.undo body -- unstagePluginAgents called when agents
  // committed but the mcp phase fails (mcp.json is a directory, so
  // readFile on it gets EISDIR -- a non-PathContainmentError that causes
  // the mcp phase to throw and triggers rollback of agents).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-undo-agents-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        agents: [{ sourceName: "bot" }],
        mcpServers: { server1: { command: "node" } },
      });

      // Pre-create a DIRECTORY at mcpJsonPath so readScopedDoc gets
      // EISDIR (which is not silenced) -- making prepareStageMcpServers
      // throw a non-PathContainmentError.
      await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
      await mkdir(locations.mcpJsonPath, { recursive: true });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Install must fail.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");

      // Agents undo: the committed agent file must have been removed.
      const agentTarget = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      const { stat } = await import("node:fs/promises");
      let exists = true;
      try {
        await stat(agentTarget);
      } catch {
        exists = false;
      }

      assert.equal(exists, false, "agents undo must remove the committed agent file");

      // No state record persisted.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Orchestrated mode: classifyInstallFailure branches
// ───────────────────────────────────────────────────────────────────────────

test("Orchestrated-PI-3: plugin not found -> outcome.status 'failed' with not-found cause, no notification fired", async () => {
  // Gap: classifyInstallFailure path when mode='orchestrated' and the plugin
  // is not in the manifest -> returns { status: 'failed', cause: '...' }.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-pi3-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "real-plugin",
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "ghost-plugin",
        notifications: { mode: "orchestrated" },
      });

      // No direct notification in orchestrated mode.
      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");

      // Outcome carries the failure status with the cause string.
      assert.equal(outcome.status, "failed");
      assert.ok("cause" in outcome && typeof outcome.cause === "string");
      assert.match((outcome as { cause: string }).cause, /not found in marketplace/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Orchestrated-PI-4: non-installable plugin -> outcome.status 'uninstallable', no notification", async () => {
  // Gap: classifyInstallFailure path for 'is not installable' branch.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-pi4-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        rawSourceOverride: "github:anthropics/some-repo",
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.equal(outcome.status, "failed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Orchestrated-PI-5: already installed -> outcome.status 'already-installed', no notification", async () => {
  // Gap: classifyInstallFailure path for 'already installed' branch.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-pi5-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        preInstall: true,
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.equal(outcome.status, "failed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Orchestrated-success: success path returns typed outcome, fires no notifications", async () => {
  // Gap: orchestrated success path -- no notifySuccess call; outcome has
  // status='installed' and resourcesChanged=true when resources were staged.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-ok-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode fires no success notification");
      assert.equal(outcome.status, "installed");
      assert.ok("resourcesChanged" in outcome);
      assert.equal((outcome as { resourcesChanged: boolean }).resourcesChanged, true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Orchestrated mode: post-commit warning collection
// ───────────────────────────────────────────────────────────────────────────

test("Orchestrated-cache-drop-failure: dropMarketplaceCache throws -> postCommitWarnings has deferred message", async () => {
  // Gap: dropMarketplaceCache try/catch in orchestrated mode -- EISDIR from
  // the unlink call is re-thrown by dropMarketplaceCache (not ENOENT), so the
  // catch appends the 'completion cache refresh deferred' string to
  // postCommitWarnings instead of firing notifyWarning.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-cache-"));
    try {
      resetCompletionCache();
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      // Pre-create a DIRECTORY at the pluginCacheFile path. When
      // dropMarketplaceCache calls unlink() on it the OS returns EISDIR
      // (not ENOENT), so dropMarketplaceCache re-throws. The orchestrator
      // catches it and appends the deferred message to postCommitWarnings.
      const cacheFilePath = await locations.pluginCacheFile("mp");
      await mkdir(path.dirname(cacheFilePath), { recursive: true });
      await mkdir(cacheFilePath, { recursive: true });

      const { ctx, pi } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(outcome.status, "installed");
      const warnings = (outcome as { postCommitWarnings?: readonly string[] }).postCommitWarnings;
      assert.ok(warnings !== undefined && warnings.length >= 1, "must have postCommitWarnings");
      assert.ok(
        warnings?.some((w) => w.includes("completion cache refresh deferred")),
        `expected 'completion cache refresh deferred' in warnings; got: ${JSON.stringify(warnings)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Orchestrated-pluginDataDir-failure: mkdir failure -> postCommitWarnings has deferred message", async () => {
  // Gap: orchestrated variant of AS-6 -- pluginDataDir mkdir failure appends
  // 'data dir creation deferred' to postCommitWarnings instead of calling
  // notifyWarning directly.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-data-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      // Make the parent of pluginDataDir read-only so mkdir(pluginDataDir)
      // fails. The parent path is <dataRoot>/mp which we create and chmod.
      await mkdir(path.join(locations.dataRoot, "mp"), { recursive: true });
      await chmod(path.join(locations.dataRoot, "mp"), 0o555);

      const { ctx, pi } = makeCtx();
      let outcome;
      try {
        outcome = await installPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          notifications: { mode: "orchestrated" },
        });
      } finally {
        // Restore permissions so cleanup can remove the temp dir.
        await chmod(path.join(locations.dataRoot, "mp"), 0o755);
      }

      assert.ok(outcome !== undefined);
      assert.equal(outcome.status, "installed");
      const warnings = (outcome as { postCommitWarnings?: readonly string[] }).postCommitWarnings;
      assert.ok(warnings !== undefined && warnings.length >= 1, "must have postCommitWarnings");
      assert.ok(
        warnings?.some((w) => w.includes("data dir creation deferred")),
        `expected 'data dir creation deferred' in warnings; got: ${JSON.stringify(warnings)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("Orchestrated-agent-foreign: agentForeignFailures -> postCommitWarnings has preserved-file message", async () => {
  // Gap: agentForeignFailures loop in orchestrated mode -- the AS-7
  // foreign-content message is appended to postCommitWarnings instead of
  // firing notifyWarning directly.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-orch-foreign-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        agents: [{ sourceName: "bot" }],
      });

      // Pre-seed a foreign agent file (no marker) at the target path and
      // a matching agents-index entry so the bridge's prepare detects it as
      // a foreign-preserved row.
      await mkdir(locations.extensionRoot, { recursive: true });
      await mkdir(locations.agentsDir, { recursive: true });
      const foreignAgentName = `${GENERATED_AGENT_PREFIX}hello-bot`;
      const foreignAgentPath = path.join(locations.agentsDir, `${foreignAgentName}.md`);
      await writeFile(foreignAgentPath, "---\nname: foreign\n---\n\nNo marker.\n");

      await writeFile(
        locations.agentsIndexPath,
        JSON.stringify({
          schemaVersion: 1,
          agents: [
            {
              plugin: "hello",
              marketplace: "mp",
              sourceAgent: "bot",
              generatedName: foreignAgentName,
              sourcePath: "/orig/bot.md",
              targetPath: foreignAgentPath,
              sourceHash: "deadbeef",
              droppedFields: [],
              droppedTools: [],
              warnings: [],
            },
          ],
        }),
      );

      const { ctx, pi } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(outcome.status, "installed");
      const warnings = (outcome as { postCommitWarnings?: readonly string[] }).postCommitWarnings;
      assert.ok(warnings !== undefined && warnings.length >= 1, "must have postCommitWarnings");
      assert.ok(
        warnings?.some((w) => w.includes("pre-existing agent file")),
        `expected 'pre-existing agent file' in warnings; got: ${JSON.stringify(warnings)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-03-INV :: install invalidates plugin cache for the target marketplace", async () => {
  // invalidateMarketplaceCache runs in installPlugin's
  // post-state-commit window (after the AS-6 pluginDataDir mkdir, before
  // AS-7 surfaces foreign-content rows). The plugin moves from
  // status="available" -> status="installed", so the cached plugin index
  // for this (scope, marketplace) pair MUST be dropped. Memory-only op;
  // the file is left intact as a rebuild source. Test pattern: pre-warm
  // memory + delete the on-disk file -> run install -> next read MUST
  // re-invoke rebuild (proves memory cleared).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-d03inv-"));
    try {
      resetCompletionCache();
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.0.0",
        skills: [{ sourceName: "tool" }],
      });

      // Pre-warm the plugin index memory entry.
      const pluginCachePath = await locations.pluginCacheFile("mp");
      let rebuildCount = 0;
      await getPluginIndex(pluginCachePath, "project", "mp", () => {
        rebuildCount += 1;
        return Promise.resolve([{ name: "hello", status: "available" }]);
      });
      assert.equal(rebuildCount, 1, "pre-test: rebuild invoked on first read");

      // Drop the on-disk cache file so the next memory-miss MUST rebuild.
      await rm(pluginCachePath, { force: true });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Memory must be cleared; with file absent, next read invokes rebuild.
      await getPluginIndex(pluginCachePath, "project", "mp", () => {
        rebuildCount += 1;
        return Promise.resolve([{ name: "hello", status: "installed" }]);
      });
      assert.equal(rebuildCount, 2, "post-invalidation read re-invokes rebuild");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Discriminated-dispatch regression guards on the
// catch-site classifiers. Locks in the `instanceof PluginShapeError` +
// `.kind` dispatch so a future refactor cannot regress to message-text
// substring matching. These tests guarantee the typed dispatch produces
// the same closed-set `Reason[]` output without re-parsing `.message`.
// ───────────────────────────────────────────────────────────────────────────

test("classifyEntityShapeError dispatches on kind=already-installed -> failed/{already installed}", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");
  const err = new PluginShapeError({
    kind: "already-installed",
    plugin: "p",
    marketplace: "mp",
  });
  const row = classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "failed");
  assert.deepEqual(row.reasons, ["already installed"]);
});

test("classifyEntityShapeError dispatches on kind=not-in-manifest -> failed/{not in manifest}", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");
  const err = new PluginShapeError({
    kind: "not-in-manifest",
    plugin: "p",
    marketplace: "mp",
  });
  const row = classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "failed");
  assert.deepEqual(row.reasons, ["not in manifest"]);
});

test("classifyEntityShapeError dispatches on kind=not-installable -> unavailable + manifest-field reasons preserved verbatim", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");
  // The resolver's `r.notes` carry the
  // `"contains <kind>"` prefix (via `addUnsupportedKindNotes`); the
  // `lspServers` carve-out in `narrowResolverReasons` strips the prefix and
  // routes the bare token through the shared `narrowUnsupportedKinds` helper
  // -> `lsp` (SNM-36 / D-24-04). The carve-out is arm-independent.
  //
  // SURF-01 / WR-01 / D-64-07: a `not-installable` shape is the structural
  // `unavailable` arm (`partialable: false`). A non-carve-out `contains <kind>`
  // note on that arm stays on the SOURCE axis and renders `unsupported source`,
  // mirroring `narrowResolverNotes` -- the component-axis `unsupported hooks` /
  // `unsupported component` markers belong to the partially-available arm only.
  // (`hooks` is not in `UNSUPPORTED_COMPONENT_KINDS`, so the resolver never
  // emits a real `contains hooks` note; the force-degradable `hooks` marker
  // travels on the typed `unsupported[]` list, covered by the IN-02 parity
  // cases. This synthetic structural note therefore collapses to the source
  // axis.)
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["contains hooks", "contains lspServers"],
    partialable: false,
  });
  const row = classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  assert.deepEqual(row.reasons, ["unsupported source", "lsp"]);
});

test("classifyEntityShapeError dispatches on kind=not-installable with source note -> {unsupported source}", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");
  // The resolver's `r.notes` carry free-form strings like
  // "source dir does not exist"; the narrow at the catch site maps any
  // "source" substring to the closed Reason "unsupported source".
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["source dir does not exist"],
    partialable: false,
  });
  const row = classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  assert.deepEqual(row.reasons, ["unsupported source"]);
});

test("classifyEntityShapeError returns undefined for non-PluginShapeError input (fallback to bare errorMessage)", () => {
  const row = classifyEntityShapeError(new Error("random failure"), {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.equal(row, undefined);
});

test("IN-02 / RSTATE-05: hooks-only unsupported (typed kind, no notes) renders {unsupported hooks} on the failure row", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");
  // A partial-hook `unsupported` plugin carries NO `contains hooks` note (hooks
  // is not an UNSUPPORTED_COMPONENT_KINDS member), so `reasons` is empty; the
  // typed `hooks` kind on `unsupportedKinds` is the SOLE reason source. The
  // failure row must read `{unsupported hooks}`, byte-identical to list/info,
  // NOT the generic `{unsupported source}` fallback.
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: [],
    partialable: true,
    unsupportedKinds: ["hooks"],
  });
  const row = classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  assert.deepEqual(row.reasons, ["unsupported hooks"]);
});

test("IN-02 / RSTATE-05: lsp unsupported (typed kind) renders {lsp} on the failure row", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["contains lspServers"],
    partialable: true,
    unsupportedKinds: ["lspServers"],
  });
  const row = classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  // Deduped: the typed kind and the `contains lspServers` note both map to
  // `lsp`, so the row renders a single marker.
  assert.deepEqual(row.reasons, ["lsp"]);
});

test("IN-02 / RSTATE-05: genuinely unavailable (structural) rows keep their notes-derived reason, unchanged", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");
  // The `unavailable` arm carries NO typed `unsupported[]` (empty list on the
  // throw), so a structural defect keeps its `notes`-sourced reason. This pins
  // that the IN-02 typed-kind path never perturbs a structural failure row.
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["source dir does not exist"],
    partialable: false,
    unsupportedKinds: [],
  });
  const row = classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  assert.deepEqual(row.reasons, ["unsupported source"]);
});

test("SEV-02 / D-69-03: classifyEntityShapeError threads partialable from the thrown shape", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");

  const partialable = classifyEntityShapeError(
    new PluginShapeError({
      kind: "not-installable",
      plugin: "p",
      reasons: ["contains lspServers"],
      partialable: true,
    }),
    { plugin: "p", marketplace: "mp", scope: "project" },
  );
  assert.ok(partialable);
  assert.equal(partialable.status, "unavailable");
  assert.equal(partialable.partialable, true);

  const structural = classifyEntityShapeError(
    new PluginShapeError({
      kind: "not-installable",
      plugin: "p",
      reasons: ["source dir does not exist"],
      partialable: false,
    }),
    { plugin: "p", marketplace: "mp", scope: "project" },
  );
  assert.ok(structural);
  assert.equal(structural.status, "unavailable");
  assert.equal(structural.partialable, false);
});

test("SEV-02 / D-69-03: composeInstallFailureMessage points at --force iff the verdict is force-degradable", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");

  // XSURF-01: force-degradable arm -> the resolver-state-driven `unsupported`
  // row carries the `--force` hint and renders at error severity (consistent
  // with how `list` / `info` describe the same plugin).
  const partialableErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "helper",
    reasons: ["contains lspServers"],
    partialable: true,
  });
  const partialableMsg = composeInstallFailureMessage({
    err: partialableErr,
    plugin: "helper",
    scope: "project",
    version: undefined,
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: classifyEntityShapeError(partialableErr, {
      plugin: "helper",
      marketplace: "mp",
      scope: "project",
    }),
  });
  assert.equal(partialableMsg.status, "partially-available");
  assert.ok(partialableMsg.status === "partially-available");
  assert.equal(partialableMsg.partialHint, true);
  assert.equal(partialableMsg.severity, "error");

  // D-70-02: structural `unavailable` arm -> error severity, but NO `--force`
  // hint (force cannot degrade-install a structural defect).
  const structuralErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "helper",
    reasons: ["source dir does not exist"],
    partialable: false,
  });
  const structuralMsg = composeInstallFailureMessage({
    err: structuralErr,
    plugin: "helper",
    scope: "project",
    version: undefined,
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: classifyEntityShapeError(structuralErr, {
      plugin: "helper",
      marketplace: "mp",
      scope: "project",
    }),
  });
  assert.equal(structuralMsg.status, "unavailable");
  assert.ok(structuralMsg.status === "unavailable");
  assert.equal(structuralMsg.partialHint, undefined);
  assert.equal(structuralMsg.severity, "error");
});

test("composeInstallFailureMessage threads a resolved version onto both not-installable arms and omits an empty-string version", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");

  const partialableErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "helper",
    reasons: ["contains lspServers"],
    partialable: true,
  });
  const partialableRow = classifyEntityShapeError(partialableErr, {
    plugin: "helper",
    marketplace: "mp",
    scope: "project",
  });
  const withVersion = composeInstallFailureMessage({
    err: partialableErr,
    plugin: "helper",
    scope: "project",
    version: "1.2.3",
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: partialableRow,
  });
  assert.equal(withVersion.status, "partially-available");
  assert.ok(withVersion.status === "partially-available");
  assert.equal(withVersion.version, "1.2.3", "the partially-available arm carries the version");

  const structuralErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "helper",
    reasons: ["source dir does not exist"],
    partialable: false,
  });
  const structuralRow = classifyEntityShapeError(structuralErr, {
    plugin: "helper",
    marketplace: "mp",
    scope: "project",
  });
  const unavailableWithVersion = composeInstallFailureMessage({
    err: structuralErr,
    plugin: "helper",
    scope: "project",
    version: "2.0.0",
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: structuralRow,
  });
  assert.equal(unavailableWithVersion.status, "unavailable");
  assert.ok(unavailableWithVersion.status === "unavailable");
  assert.equal(unavailableWithVersion.version, "2.0.0", "the unavailable arm carries the version");

  // An empty-string version (a placeholder resolve) is OMITTED from both arms.
  const emptyPartial = composeInstallFailureMessage({
    err: partialableErr,
    plugin: "helper",
    scope: "project",
    version: "",
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: partialableRow,
  });
  assert.ok(emptyPartial.status === "partially-available");
  assert.equal(emptyPartial.version, undefined, "empty-string version is omitted");

  const emptyStructural = composeInstallFailureMessage({
    err: structuralErr,
    plugin: "helper",
    scope: "project",
    version: "",
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: structuralRow,
  });
  assert.ok(emptyStructural.status === "unavailable");
  assert.equal(emptyStructural.version, undefined, "empty-string version is omitted");
});

test("composeInstallFailureMessage runtime arm: a non-Error throw yields the bare failed row (no cause) with the version threaded", () => {
  const msg = composeInstallFailureMessage({
    err: "disk exploded",
    plugin: "helper",
    scope: "project",
    version: "2.0.0",
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: undefined,
  });
  assert.equal(msg.status, "failed");
  assert.ok(msg.status === "failed");
  assert.deepEqual(msg.reasons, [], "no fabricated reason on a generic runtime throw");
  assert.equal(msg.cause, undefined, "a non-Error throw carries no cause");
  assert.equal(msg.version, "2.0.0", "the runtime arm threads the version");
  assert.equal(msg.severity, "error");
});

// ───────────────────────────────────────────────────────────────────────────
// PHOOK-04 -- partial-hook `install --force` stages a STRICT SUBSET of the
// source `hooks.json`: the dropped event / matcher group is absent from the
// written file, while the supported group is present. The bridge stages
// `parseHooksConfig.value` (the pure filtered subset), so the staged file can
// never carry a dropped handler (PHOOK-04 containment invariant). No source
// change to install.ts / stage.ts -- the subset is inherited from the partition.
// ───────────────────────────────────────────────────────────────────────────

test("PHOOK-04: install --force stages a strict-subset hooks.json -- dropped Notification event absent, supported PostToolUse group present", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-phook04-event-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hook-plugin",
        skills: [{ sourceName: "helper-skill" }],
        // A supported PostToolUse(Edit) group plus a non-bucket-A `Notification`
        // event. The partition keeps the PostToolUse group and drops the whole
        // Notification event (event-level drop, D-71-01).
        hooksJson: {
          hooks: {
            PostToolUse: [
              { matcher: "Edit", hooks: [{ type: "command", command: "echo posttooluse" }] },
            ],
            Notification: [{ hooks: [{ type: "command", command: "echo notification" }] }],
          },
        },
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hook-plugin",
        partial: true,
      });

      // Read the staged file the bridge wrote and assert the strict-subset
      // property: the dropped `Notification` event is ABSENT, the supported
      // `PostToolUse` group is PRESENT (PHOOK-04 / V5 output containment).
      // The bridge stages the bare events map (`parseHooksConfig` unwraps the
      // `{hooks:{...}}` wrapper and returns the filtered subset).
      const stagedPath = path.join(locations.hooksDir, "hook-plugin", "hooks.json");
      const staged = JSON.parse(await readFile(stagedPath, "utf8")) as Record<string, unknown>;
      assert.ok("PostToolUse" in staged, "supported PostToolUse group must be staged");
      assert.equal(
        "Notification" in staged,
        false,
        "dropped Notification event must NOT be staged",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PHOOK-04 / D-71-02: install --force drops only the unsupportable matcher group within a supported event", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-phook04-matcher-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hook-plugin",
        skills: [{ sourceName: "helper-skill" }],
        // One supported event with a clean Edit group and an unsupportable
        // regex group: the partition keeps the Edit group and drops only the
        // `.*` regex group (intra-event matcher-group partition, D-71-02).
        hooksJson: {
          hooks: {
            PreToolUse: [
              { matcher: "Edit", hooks: [{ type: "command", command: "echo edit" }] },
              { matcher: ".*", hooks: [{ type: "command", command: "echo regex" }] },
            ],
          },
        },
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hook-plugin",
        partial: true,
      });

      const stagedPath = path.join(locations.hooksDir, "hook-plugin", "hooks.json");
      const staged = JSON.parse(await readFile(stagedPath, "utf8")) as {
        PreToolUse: { matcher?: string }[];
      };
      // The event survives with ONLY the supportable Edit group; the dropped
      // `.*` regex group is absent (strict subset within the kept event).
      assert.equal(staged.PreToolUse.length, 1);
      assert.equal(staged.PreToolUse[0]?.matcher, "Edit");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SEV-01 / SEV-02 / D-71-06 -- the partial-hook plugin now resolves
// `unsupported` (force-degradable), so it flows through the force-degradation
// gates with no severity-layer source change: WITHOUT `--force` it blocks at error
// severity carrying the `--force` hint (SEV-02); WITH `--force` it degrades to
// an info `force-installed` row with NO summary line (SEV-01 / D-71-06).
// ───────────────────────────────────────────────────────────────────────────

test("SEV-01 / SEV-02 / FSTAT-07 / D-71-06: partial-hook install blocks without --force (error + hint), degrades to info force-installed with --force", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-phook-sev-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hook-plugin",
        skills: [{ sourceName: "helper-skill" }],
        hooksJson: {
          hooks: {
            PostToolUse: [
              { matcher: "Edit", hooks: [{ type: "command", command: "echo posttooluse" }] },
            ],
            Notification: [{ hooks: [{ type: "command", command: "echo notification" }] }],
          },
        },
      });

      // SEV-02: no `--force`. The force-degradable `unsupported` verdict blocks
      // the install at error severity and the row points at `--force`. Nothing
      // is staged and no state record is written (force is never implied).
      const noForce = makeCtx();
      await installPlugin({
        ctx: noForce.ctx,
        pi: noForce.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hook-plugin",
      });
      assert.equal(noForce.notifications.length, 1);
      assert.equal(noForce.notifications[0]?.severity, "error");
      // SEV-02 / XSURF-01 contract: the force-degradable verdict renders the
      // resolver-state-driven `(unsupported)` row at error severity and carries
      // the `--force` hint trailer (consistent with how `list` / `info`
      // describe the same plugin). IN-02 / RSTATE-05: the no-force failure row
      // renders the typed `{unsupported hooks}` marker -- byte-identical to the
      // success / list / info surfaces -- because the resolver threads its typed
      // `unsupported[]` list onto the thrown `PluginShapeError` and the composer
      // narrows it via the shared `narrowUnsupportedKinds` path (the `hooks`
      // kind carries no structural `notes` entry, so the typed list is its only
      // reason source).
      assert.match(
        noForce.notifications[0]?.message ?? "",
        /hook-plugin \(partially-available\) \{unsupported hooks\}/,
      );
      assert.match(
        noForce.notifications[0]?.message ?? "",
        /Re-run with --partial to install the supported components\./,
      );
      const stagedPath = path.join(locations.hooksDir, "hook-plugin", "hooks.json");
      await assert.rejects(readFile(stagedPath, "utf8"), "no-force install must stage nothing");
      const afterBlocked = await loadState(locations.extensionRoot);
      assert.equal(
        "hook-plugin" in (afterBlocked.marketplaces["mp"]?.plugins ?? {}),
        false,
        "no-force install must not record the plugin",
      );

      // SEV-01 / D-71-06: with `--force` the supported components install, the
      // Notification event degrades, and the success row reads `(partially-installed)
      // {unsupported hooks}` at info severity with NO summary line (the body
      // begins at the marketplace header, not a `... failed.` / `... attention.`
      // summary). FSTAT-07: the row reads `force-installed`.
      const forced = makeCtx();
      await installPlugin({
        ctx: forced.ctx,
        pi: forced.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hook-plugin",
        partial: true,
      });
      assert.equal(forced.notifications.length, 1);
      const forcedMsg = forced.notifications[0]?.message ?? "";
      assert.notEqual(forced.notifications[0]?.severity, "error");
      assert.notEqual(forced.notifications[0]?.severity, "warning");
      assert.match(forcedMsg, /\(partially-installed\)/);
      assert.match(forcedMsg, /\{unsupported hooks\}/);
      assert.ok(
        forcedMsg.startsWith("●"),
        "info force-installed body starts at the mp header, no summary line",
      );
      const afterForced = await loadState(locations.extensionRoot);
      assert.ok(
        "hook-plugin" in (afterForced.marketplaces["mp"]?.plugins ?? {}),
        "force install must record the plugin",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test('260525-cjr C3: classifyInstallFailure returns the collapsed `status: "failed"` shape carrying the typed Error', async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");

  // The four error variants
  // (already-installed / unavailable / uninstallable /
  // unexpected-failure) collapse into a single
  // `{ status: "failed"; error; cause }` shape. The typed Error is
  // the dispatch surface; consumers narrow on `instanceof
  // PluginShapeError` and read `.kind` to recover the
  // semantic class.
  const notInManifestErr = new PluginShapeError({
    kind: "not-in-manifest",
    plugin: "p",
    marketplace: "mp",
  });
  const notInManifest = classifyInstallFailure(notInManifestErr, "formatted");
  assert.equal(notInManifest.status, "failed");
  assert.ok(notInManifest.status === "failed");
  assert.equal(notInManifest.error, notInManifestErr);
  assert.equal(notInManifest.cause, "formatted");

  const alreadyInstalledErr = new PluginShapeError({
    kind: "already-installed",
    plugin: "p",
    marketplace: "mp",
  });
  const alreadyInstalled = classifyInstallFailure(alreadyInstalledErr, "formatted");
  assert.equal(alreadyInstalled.status, "failed");
  assert.ok(alreadyInstalled.status === "failed");
  assert.equal(alreadyInstalled.error, alreadyInstalledErr);

  const notInstallableErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["hooks"],
    partialable: false,
  });
  const notInstallable = classifyInstallFailure(notInstallableErr, "formatted");
  assert.equal(notInstallable.status, "failed");
  assert.ok(notInstallable.status === "failed");
  assert.equal(notInstallable.error, notInstallableErr);

  const noLongerInstallableErr = new PluginShapeError({
    kind: "no-longer-installable",
    plugin: "p",
    reasons: ["unsupported source"],
    partialable: false,
  });
  const noLongerInstallable = classifyInstallFailure(noLongerInstallableErr, "formatted");
  assert.equal(noLongerInstallable.status, "failed");
  assert.ok(noLongerInstallable.status === "failed");
  assert.equal(noLongerInstallable.error, noLongerInstallableErr);

  // Non-PluginShapeError input is preserved verbatim on `error`.
  const opaque = new Error("random");
  const unexpected = classifyInstallFailure(opaque, "formatted");
  assert.equal(unexpected.status, "failed");
  assert.ok(unexpected.status === "failed");
  assert.equal(unexpected.error, opaque);
});

// ───────────────────────────────────────────────────────────────────────────
// narrowResolverReasons does not silently degrade
// non-resolver causes to `{unsupported source}`. EACCES / EPERM / ENOENT /
// SyntaxError substrings map to their precise closed Reasons; the
// `unsupported source` fallback runs only when no classifier matched.
// ───────────────────────────────────────────────────────────────────────────

test("PHOOK-05 / D-71-04: narrowResolverReasons routes the `contains hooks` token through the shared per-kind helper -> `unsupported hooks`", () => {
  // `hooks` is a SUPPORTED component kind that, when a parseable hooks.json
  // drops one or more unsupportable handlers, becomes a force-degradable
  // `unsupported` marker (D-71-04). The shared `narrowUnsupportedKinds` helper
  // maps the `hooks` kind to the single aggregate `unsupported hooks` reason,
  // so a `contains hooks` token narrows to `unsupported hooks` on the install
  // error surface -- byte-identical to the `list`/`info` per-kind path.
  //
  // (`hooks` is not in `UNSUPPORTED_COMPONENT_KINDS`, so the resolver does not
  // emit a real `contains hooks` note; the degradable signal travels on the
  // typed `unsupported[]` list. This pins the shared-helper mapping.)
  //
  // SURF-01 / D-64-07: the `hooks` kind is force-degradable, so it lives on the
  // partially-available arm -- pass the arm discriminant (`true`) so the
  // `contains <kind>` token routes through the component-axis helper.
  assert.deepEqual(
    [...narrowResolverReasons(["contains hooks"], ["hooks"], true)],
    ["unsupported hooks"],
  );
});

test("260525-cjr B2 / C5: narrowResolverReasons -> `contains lspServers` extracts the `lspServers` token and emits the `lsp` Reason (SNM-36)", () => {
  assert.deepEqual([...narrowResolverReasons(["contains lspServers"])], ["lsp"]);
});

test("260525-cjr C5: narrowResolverReasons recognises `contains lspServers` as the sole remaining manifest-field carve-out", () => {
  // HOOK-04 / D-58-02: `lspServers` is now the SOLE
  // `MANIFEST_FIELD_REASONS` member. The `contains hooks` half was
  // dropped (dead under v1.13). The `lspServers` detection token maps
  // to the `lsp` Reason per SNM-36 / D-24-04; the catalog row form is
  // `(unavailable) {lsp}`.
  assert.deepEqual([...narrowResolverReasons(["contains lspServers"])], ["lsp"]);
});

test("260525-cjr C5 / D-90-05: narrowResolverReasons maps `contains <non-carve-out-kind>` to {unsupported component}", () => {
  // Resolver also emits `"contains monitors"`, `"contains themes"`,
  // etc. for the other UNSUPPORTED_COMPONENT_KINDS members. Those are
  // NOT the `lspServers` carve-out; their bare token routes through the
  // SAME `narrowUnsupportedKinds` seam list/info use, so a non-carve-out
  // component kind renders the truthful `{unsupported component}` marker
  // (D-90-05) rather than borrowing the source-axis `{unsupported source}`.
  //
  // SURF-01 / D-64-07: this component-axis marker belongs to the partially-
  // available arm, so pass the arm discriminant (`true`); on the structural
  // `unavailable` arm the same note stays on the source axis (covered by the
  // cross-surface parity suite).
  const reasons = narrowResolverReasons(["contains monitors"], ["monitors"], true);
  assert.deepEqual([...reasons], ["unsupported component"]);
});

test("260525-cjr B2: narrowResolverReasons -> source-substring -> `unsupported source`", () => {
  assert.deepEqual(
    [...narrowResolverReasons(["unsupported source kind: foo"])],
    ["unsupported source"],
  );
});

test("260525-cjr B2: narrowResolverReasons -> EACCES note surfaces as `permission denied` (NOT `unsupported source`)", () => {
  const reasons = narrowResolverReasons(["EACCES: permission denied opening '/.pi/agent/...'"]);
  assert.deepEqual([...reasons], ["permission denied"]);
});

test("260525-cjr B2: narrowResolverReasons -> EPERM also classifies as `permission denied`", () => {
  const reasons = narrowResolverReasons(["EPERM: operation not permitted"]);
  assert.deepEqual([...reasons], ["permission denied"]);
});

test("260525-cjr B2: narrowResolverReasons -> ENOENT note surfaces as `source missing`", () => {
  const reasons = narrowResolverReasons(["ENOENT: no such file or directory"]);
  assert.deepEqual([...reasons], ["source missing"]);
});

test("260525-cjr B2: narrowResolverReasons -> SyntaxError note surfaces as `unparseable`", () => {
  const reasons = narrowResolverReasons(["SyntaxError: Unexpected token } in JSON"]);
  assert.deepEqual([...reasons], ["unparseable"]);
});

test("260525-cjr B2: narrowResolverReasons -> empty notes -> `unsupported source` (permissive fallback)", () => {
  assert.deepEqual([...narrowResolverReasons([])], ["unsupported source"]);
});

test("260525-cjr B2: narrowResolverReasons -> wholly unclassifiable note -> `unsupported source` (permissive fallback)", () => {
  // No carve-out, no `source` substring, no errno substring -- the
  // permissive `unsupported source` fallback runs only here.
  assert.deepEqual(
    [...narrowResolverReasons(["something genuinely unclassifiable"])],
    ["unsupported source"],
  );
});

// ──────────────────────────────────────────────────────────────────────────
// WB-01/WB-02 write-back, --local, WR-09, CFG-03
// ──────────────────────────────────────────────────────────────────────────

test("WB-01: standalone install writes the plugin entry to claude-plugins.json", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wb01-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cfg = await loadConfig(locations.configJsonPath);
      assert.equal(cfg.status, "valid");
      if (cfg.status === "valid") {
        // Patch is `{}` per D-04 (consume-time default for `enabled`).
        assert.deepEqual(cfg.config.plugins?.["hello@mp"], {});
      }

      // Local file MUST NOT be touched on the base-target path.
      assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01: --local routes the write to claude-plugins.local.json; base file untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wb01-local-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.deepEqual(localCfg.config.plugins?.["hello@mp"], {});
      }

      // Base MUST be untouched.
      assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-09 / T-56-03-01: orchestrated-mode install SKIPS write-back (neither file created)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wb01-orch-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
      });

      const { ctx, pi } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });
      assert.equal(outcome.status, "installed");

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
      assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// WB-01 / UAT-05 / D-103-16 -- the three arms the declaration-following write
// target must NOT have moved. Together they bound its blast radius to the one
// case it fixes: a stamp that used to land in a file CFG-02 shadows.
// ───────────────────────────────────────────────────────────────────────────

test("WB-01 / UAT-05 / D-103-16: a plugin declared in NEITHER file stamps the base file, local not created", async () => {
  // The majority path -- the shape every fresh `/claude:plugin install` has --
  // and the reason this change is narrow: the membership probe finds no local
  // entry, so the selection falls through to today's answer, the base file.
  //
  // Contrast with the locally-declared stamp regression above: the fixture is
  // identical apart from the seeded local declaration, and only that
  // declaration moves the target. Do not reconcile the two toward each other.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wb01-undeclared-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        entryDefaultEnabled: false,
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const baseCfg = await loadConfig(locations.configJsonPath);
      assert.equal(baseCfg.status, "valid");
      if (baseCfg.status === "valid") {
        assert.deepEqual(baseCfg.config.plugins?.["hello@mp"], { enabled: false });
      }

      assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01 / UAT-05 / D-103-16: a typed --local still targets the local file over a BASE declaration", async () => {
  // The flag is the user naming the file they want written, and a per-machine
  // override that shadows a shared base declaration is the local file's whole
  // purpose. The declaration-following rule answers the question the user did
  // NOT answer; it never overrules the one they did.
  //
  // Contrast with the control above: there the flag is absent AND no
  // declaration exists, so both roads lead to the base file. Here they
  // disagree, and the flag wins.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wb01-flag-wins-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      const { loadConfig, saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": { enabled: true } } },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
        local: true,
      });

      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.deepEqual(localCfg.config.plugins?.["hello@mp"], {});
      }

      // The base entry keeps its pre-call value.
      const baseCfg = await loadConfig(locations.configJsonPath);
      assert.equal(baseCfg.status, "valid");
      if (baseCfg.status === "valid") {
        assert.deepEqual(baseCfg.config.plugins?.["hello@mp"], { enabled: true });
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const arm of [
  { configSource: "local" as const, tmpPrefix: "install-wb01-orch-local-" },
  { configSource: "base" as const, tmpPrefix: "install-wb01-orch-base-" },
]) {
  test(`WB-01 / UAT-05 / D-103-16: the orchestrated stamp targets the ${arm.configSource} file, unchanged`, async () => {
    // The reconcile apply path passes `local: op.configSource === "local"`, and
    // the argument that this arm cannot move is airtight: a "local" source sets
    // the flag, and a "base" source implies the key is ABSENT from the local
    // file, because a local entry would have made the merged source "local"
    // (CFG-02). There is no third case. An argument is not a test, though, and
    // this is the arm a future change to `configSource` could break silently.
    //
    // The end-to-end half -- planner through apply through the on-disk file --
    // is owned by the reconcile suite's DFEN-04 / D-102-04 base-declared and
    // locally-declared stamp cases. This asserts the narrower orchestrator
    // fact: given the flag the apply path derives, the stamp lands in the file
    // it lands in today. The two are not duplicates.
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), arm.tmpPrefix));
      try {
        const locations = locationsFor("project", cwd);
        await seedPathMarketplaceWithPlugin({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          marketplaceName: "mp",
          pluginName: "hello",
          entryDefaultEnabled: false,
          skills: [{ sourceName: "tool" }],
        });

        const { loadConfig, saveConfig } =
          await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
        const declaringPath =
          arm.configSource === "local" ? locations.configLocalJsonPath : locations.configJsonPath;
        const otherPath =
          arm.configSource === "local" ? locations.configJsonPath : locations.configLocalJsonPath;
        await saveConfig(
          declaringPath,
          { schemaVersion: 1, plugins: { "hello@mp": {} } },
          locations.scopeRoot,
        );

        const { ctx, pi, notifications } = makeCtx();
        const outcome = await installPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          applyDefaultEnabled: true,
          local: arm.configSource === "local",
          notifications: { mode: "orchestrated" },
        });
        assert.equal(outcome.status, "installed");
        assert.deepEqual(notifications, []);

        const declaringCfg = await loadConfig(declaringPath);
        assert.equal(declaringCfg.status, "valid");
        if (declaringCfg.status === "valid") {
          assert.deepEqual(declaringCfg.config.plugins?.["hello@mp"], { enabled: false });
        }

        // The other file is never created: the orchestrated arm writes ONE
        // entry to ONE file and skips the batched write-back entirely (WR-09).
        assert.equal((await loadConfig(otherPath)).status, "absent");
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("WB-01: marketplace-not-added FAILED arm does NOT write back; config untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wb01-fail-"));
    try {
      const locations = locationsFor("project", cwd);
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "ghost-mp",
        plugin: "any",
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
      assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CFG-03 / T-56-03-04: invalid config aborts install; basename-only cause; state untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wb01-cfg03-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
      });

      // Seed an invalid base config so CFG-03 fires.
      await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
      await writeFile(locations.configJsonPath, "{ not valid json", "utf8");

      // WR-04: the abort must not rewrite state.json at
      // all -- bytes AND mtime stable (no-save abort discipline).
      const statePath = path.join(locations.extensionRoot, "state.json");
      const stateBytesPre = await readFile(statePath, "utf8");
      const stateMtimePre = (await stat(statePath)).mtimeMs;

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(notifications.length, 1);
      const note = notifications[0]!;
      assert.match(note.message, /\{invalid manifest\}/);
      // Basename only -- no absolute path leak.
      assert.ok(
        !note.message.includes(locations.configJsonPath),
        `MUST NOT leak absolute configJsonPath, got: ${note.message}`,
      );

      // State was NOT mutated.
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"], undefined);

      // WR-04: state.json bytes + mtime unchanged on the CFG-03 abort.
      assert.equal(await readFile(statePath, "utf8"), stateBytesPre);
      assert.equal((await stat(statePath)).mtimeMs, stateMtimePre);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CFG-03 / D-103-16: an UNREADABLE local config aborts a flagless install rather than aiming the stamp at the shadowed base file", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-cfg03-local-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        entryDefaultEnabled: false,
        skills: [{ sourceName: "tool" }],
      });

      // The local file is what DECIDES the destination on a flagless call, and
      // this one cannot be read (a truncated mid-save write; an EACCES or a
      // schema violation arrive through the same `invalid` arm). Whether it
      // declares `hello@mp` is unknowable, and the two answers select different
      // files -- so there is no destination to write to. Reading `invalid` as
      // "not declared locally" stamped the base file, which a local entry
      // replaces wholesale under CFG-02: the install reported success while the
      // merged view the reconcile planner reads never moved.
      await mkdir(path.dirname(locations.configLocalJsonPath), { recursive: true });
      await writeFile(
        locations.configLocalJsonPath,
        '{"plugins": {"hello@mp": {"enabled": tru',
        "utf8",
      );

      const statePath = path.join(locations.extensionRoot, "state.json");
      const stateBytesPre = await readFile(statePath, "utf8");
      const stateMtimePre = (await stat(statePath)).mtimeMs;

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });

      assert.equal(notifications.length, 1);
      const note = notifications[0]!;
      assert.match(note.message, /\{invalid manifest\}/);
      // The row names the file that could not be read -- the one the user has
      // to repair -- not the file the stamp would have landed in.
      assert.match(
        note.message,
        /claude-plugins\.local\.json/,
        "the abort must name the unreadable local file",
      );
      assert.ok(
        !note.message.includes(locations.configLocalJsonPath),
        `MUST NOT leak the absolute path, got: ${note.message}`,
      );

      // Nothing was written anywhere: no base file was created, no state
      // mutation, and the no-save abort discipline holds byte for byte.
      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"], undefined);
      assert.equal(await readFile(statePath, "utf8"), stateBytesPre);
      assert.equal((await stat(statePath)).mtimeMs, stateMtimePre);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("UAT-05 / CR-02: an UNREADABLE sibling config skips the marketplace adoption write instead of counting as a file that declares nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-uat05-unreadable-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
      });

      // The declaration lives in the local file, so that file is the target and
      // the BASE file is the sibling the UAT-05 membership gate consults. The
      // base file declares the marketplace with `autoupdate: false` -- and is
      // schema-invalid on an unrelated entry, so the gate cannot read it.
      const { loadConfig, saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configLocalJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );
      const baseBytes = JSON.stringify({
        schemaVersion: 1,
        marketplaces: { mp: { source: "./mp-src", autoupdate: false } },
        plugins: { "other@mp": { enabled: "no" } },
      });
      await writeFile(locations.configJsonPath, baseBytes, "utf8");

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status !== "valid") {
        return;
      }

      // The plugin entry still lands in its declaring file -- the install is
      // correctly targeted and is not what is in doubt.
      assert.deepEqual(localCfg.config.plugins?.["hello@mp"], {});
      // The load-bearing assertion. Coercing the unreadable sibling to an empty
      // config made the gate conclude the marketplace was undeclared, and the
      // synthesized bare `{source}` entry replaces the base entry wholesale
      // under CFG-02 -- so once the base file is repaired the user's
      // `autoupdate: false` is gone and the marketplace starts auto-updating,
      // a network-touching setting flipped with no command and no prompt.
      assert.equal(
        localCfg.config.marketplaces?.["mp"],
        undefined,
        "an unreadable sibling must not be read as a file that declares nothing",
      );
      // The unreadable file was never written to either.
      assert.equal(await readFile(locations.configJsonPath, "utf8"), baseBytes);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// UAT-05: merged-view membership gate for the adopted-marketplace declaration
// ──────────────────────────────────────────────────────────────────────────

test("UAT-05: --local install with marketplace declared in BASE writes ONLY the plugin entry to local; merged autoupdate from base survives", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-uat05-local-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
      });

      // BASE declares the marketplace with autoupdate: true (the live UAT
      // repro: claude-plugins.json declares the marketplace; the --local
      // install must NOT re-declare it in claude-plugins.local.json -- the
      // bare {source} entry would shadow base wholesale per CFG-02 and flip
      // merged autoupdate to false).
      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        {
          schemaVersion: 1,
          marketplaces: { mp: { source: "./mp-src", autoupdate: true } },
        },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status !== "valid") {
        return;
      }

      // Local gains ONLY the plugin entry -- NO marketplace re-declaration.
      assert.deepEqual(localCfg.config.plugins?.["hello@mp"], {});
      assert.equal(
        localCfg.config.marketplaces?.["mp"],
        undefined,
        "local file must NOT re-declare a base-declared marketplace (CFG-02 shadowing)",
      );

      // The merged view's autoupdate (from base) survives the install.
      const baseCfg = await loadConfig(locations.configJsonPath);
      assert.equal(baseCfg.status, "valid");
      if (baseCfg.status !== "valid") {
        return;
      }

      const { mergeScopeConfigs } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-merge.ts");
      const merged = mergeScopeConfigs(baseCfg.config, localCfg.config);
      assert.equal(
        merged.marketplaces["mp"]?.entry.autoupdate,
        true,
        "merged autoupdate flipped -- the local declaration shadowed base",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("UAT-05 / CR-02: --local install with marketplace declared NOWHERE declares it in the SAME local file; reconcile stays convergent", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-uat05-nowhere-"));
    try {
      const locations = locationsFor("project", cwd);
      // Seed at least one component: an all-empty resources record reads as
      // ENBL-02 "disabled" to the planner and would pollute the no-op proof
      // with a pluginsToEnable row.
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "helper" }],
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");

      // CR-02 preserved: the declaration lands in the SAME targeted file as
      // the plugin entry (local), with the state record's verbatim source.raw.
      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status !== "valid") {
        return;
      }

      assert.deepEqual(localCfg.config.plugins?.["hello@mp"], {});
      assert.equal(localCfg.config.marketplaces?.["mp"]?.source, "./mp-src");

      // Base stays untouched (WB-01).
      assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");

      // Reconcile against (merged view, post-install state) is the EMPTY
      // plan -- no dangling declaration, no planned marketplace removal.
      const { mergeScopeConfigs } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-merge.ts");
      const { planReconcile } =
        await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts");
      const { emptyReconcilePlan } =
        await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts");
      const stateAfter = await loadState(locations.extensionRoot);
      const merged = mergeScopeConfigs({}, localCfg.config);
      const plan = planReconcile(merged, stateAfter, "project");
      assert.deepEqual(plan, emptyReconcilePlan("project"));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("UAT-05: base-targeted install with marketplace already in base leaves the marketplace entry unchanged (entry-level no-op)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-uat05-base-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
      });

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        {
          schemaVersion: 1,
          marketplaces: { mp: { source: "./mp-src", autoupdate: true } },
        },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const baseCfg = await loadConfig(locations.configJsonPath);
      assert.equal(baseCfg.status, "valid");
      if (baseCfg.status !== "valid") {
        return;
      }

      // Plugin entry added; the pre-existing marketplace entry is unchanged
      // at the entry level (no duplicate / no-op rewrite of its fields).
      assert.deepEqual(baseCfg.config.plugins?.["hello@mp"], {});
      assert.deepEqual(baseCfg.config.marketplaces?.["mp"], {
        source: "./mp-src",
        autoupdate: true,
      });

      // Local file untouched.
      assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after a successful installPlugin for a plugin declaring a
// hooks.json, the hooks-bridge routing table reflects the new entry. Without
// the rebuildRoutingTables call inside the per-plugin lock, the routing table
// would stay pinned to whatever the last reconcile produced and the new
// plugin would not receive dispatch until `/reload` (NFR-2 violation).
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: installPlugin of a hooks-declaring plugin rebuilds the routing table without /reload", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  const { getRoutingBucket } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");

  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wr03-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        hooksJson: {
          PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hello" }] }],
        },
      });

      // Pre-condition: the routing table's PreToolUse bucket is empty.
      assert.equal(getRoutingBucket("PreToolUse").length, 0);

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
      });

      // Confirm install succeeded (no "failed" / "unavailable" notification).
      // The first notification carries the cascade text; we only need the
      // routing-table effect to be observable.
      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)") && !summary.includes("(unavailable)"),
        `expected clean install notification; got: ${summary}`,
      );

      // The plugin must have its hooks resource recorded -- otherwise the
      // bridge cache lookup at rebuild time would silently skip it.
      const afterState = await loadState(locations.extensionRoot);
      assert.ok(
        afterState.marketplaces["mp"]?.plugins["p1"]?.resources.hooks !== undefined,
        `expected hooks resource recorded; full notification text: ${summary}`,
      );
      assert.ok(
        (afterState.marketplaces["mp"]?.plugins["p1"]?.resources.hooks ?? []).length > 0,
        `expected non-empty hooks resource; got ${JSON.stringify(afterState.marketplaces["mp"]?.plugins["p1"]?.resources)}; notification: ${summary}`,
      );

      // D-100-01 / ENBL-11: the same install also describes the hooks it
      // materialized. `resources.hooks` names the container slug; this names
      // the entries, which is what `info` reports once the artifacts are gone.
      // A tool event carries its matcher (empty string = match-all); no
      // handler payload is recorded.
      assert.deepEqual(afterState.marketplaces["mp"]?.plugins["p1"]?.hookEntries, [
        { event: "PreToolUse", matcher: "" },
      ]);

      // Post-condition: the routing-table now reflects the installed plugin's
      // PreToolUse entry. This proves WR-03's `rebuildRoutingTables()` ran
      // inside the per-plugin lock right after `addPluginConfigToCache`.
      const bucket = getRoutingBucket("PreToolUse");
      assert.equal(bucket.length, 1);
      assert.equal(bucket[0]?.pluginId, "p1");
      assert.equal(bucket[0]?.scope, "project");
      assert.equal(bucket[0]?.handlerDecl["command"], "echo hello");
      // resolvedSource must propagate from the resolver -> cache -> routing
      // table; without this assert a regression that drops the pluginRoot
      // argument from addPluginConfigToCache(...) would not be caught at
      // the orchestrator-test layer. CLAUDE_PLUGIN_ROOT export at dispatch
      // depends on this field.
      assert.equal(
        bucket[0]?.resolvedSource,
        afterState.marketplaces["mp"]?.plugins["p1"]?.resolvedSource,
        "RoutingEntry.resolvedSource must mirror state.json's resolvedSource",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01 / LIFE-02 / SURF-05: 5th cascade slot in install.ts -- a plugin
// declaring `hooks/hooks.json` writes `<hooksDir>/<plugin>/hooks.json` via
// the bridge `writeHookConfig`; the cascade row surfaces orphan-rewake when
// the resolver flagged it; rollback removes the just-written file.
// ─────────────────────────────────────────────────────────────────────────────

test("LIFE-01: installPlugin with hooks writes <hooksDir>/<plugin>/hooks.json via the hooks bridge slot", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-life01-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      const hooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo life01" }] }],
      };
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        hooksJson,
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)") && !summary.includes("(unavailable)"),
        `expected clean install; got: ${summary}`,
      );

      // LIFE-01: the bridge wrote the file at the documented path.
      const written = await readFile(path.join(locations.hooksDir, "p1", "hooks.json"), "utf8");
      assert.deepEqual(JSON.parse(written), hooksJson);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SURF-05: installPlugin of a hooks-declaring plugin with rewakeMessage but no asyncRewake surfaces `(installed) {orphan rewake}`", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-surf05-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // SURF-05 fixture: rewakeMessage WITHOUT asyncRewake: true triggers
      // detectOrphanRewake -> partial.orphanRewake = true (per resolver
      // applyHooksConfig success branch).
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "orphan",
        hooksJson: {
          PreToolUse: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: "echo orphan",
                  rewakeMessage: "wake me",
                },
              ],
            },
          ],
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "orphan",
      });

      const message = notifications.map((n) => n.message).join("\n");
      // Renderer composes `(installed) {orphan rewake}` via the existing
      // composeReasons helper on PluginInstalledMessage.reasons.
      assert.ok(
        message.includes("(installed) {orphan rewake}"),
        `expected '(installed) {orphan rewake}' in cascade; got:\n${message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SURF-05: installPlugin of a hooks-declaring plugin with rewakeMessage AND asyncRewake: true does NOT surface `{orphan rewake}`", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-surf05neg-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "async-rewake",
        hooksJson: {
          PreToolUse: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: "echo paired",
                  rewakeMessage: "wake me",
                  asyncRewake: true,
                },
              ],
            },
          ],
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "async-rewake",
      });

      const message = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !message.includes("{orphan rewake}"),
        `expected no '{orphan rewake}' brace; got:\n${message}`,
      );
      assert.ok(
        message.includes("(installed)"),
        `expected clean (installed) row; got:\n${message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FORCE-01/03/04/05 -- `--force` degrade gate selection
// ───────────────────────────────────────────────────────────────────────────

test("FORCE-01: force on an unsupported plugin installs the supported components and skips the unsupported ones", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force01-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        // Supported component (a skill) alongside experimental unsupported
        // kinds -> the resolver returns the force-degradable `unsupported` arm.
        skills: [{ sourceName: "tool" }],
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        partial: true,
      });

      // No error notifications: the degrade install succeeded.
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      // The supported skill materialized on disk.
      const skillTarget = path.join(locations.skillsTargetDir, "p1-tool", "SKILL.md");
      assert.ok(
        (await readFile(skillTarget, "utf8")).length > 0,
        "supported skill must materialize",
      );

      // State record written; supported skill recorded, unsupported kinds
      // captured in compatibility but NOT materialized as resources.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["p1"];
      assert.ok(record !== undefined, "state record must be written on force-degrade");
      assert.deepEqual([...record.resources.skills], ["p1-tool"]);
      assert.ok(
        record.compatibility.unsupported.includes("themes"),
        `unsupported should include themes: ${record.compatibility.unsupported.join(" / ")}`,
      );
      assert.ok(
        record.compatibility.unsupported.includes("monitors"),
        `unsupported should include monitors: ${record.compatibility.unsupported.join(" / ")}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-01: force on a fully-supported plugin is inert and installs as (installed)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force01noop-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        partial: true,
      });

      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["p1"];
      assert.ok(record !== undefined, "fully-supported plugin installs under force");
      assert.deepEqual([...record.resources.skills], ["p1-tool"]);
      // Inert: no unsupported kinds, identical to a non-force install.
      assert.deepEqual([...record.compatibility.unsupported], []);

      // `(installed)` row, no `(unavailable)` / `(skipped)` token.
      const message = notifications.map((n) => n.message).join("\n");
      assert.ok(message.includes("(installed)"), `expected (installed) row; got:\n${message}`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FSTAT-07 / D-66-04: force install of an unsupported plugin emits a (partially-installed) success row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force-installed-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        skills: [{ sourceName: "tool" }],
        // D-64-06: experimental unsupported kinds drive the force-degradable
        // `unsupported` arm; the success row reports (partially-installed) with the
        // dropped-component detail rather than (installed).
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        partial: true,
      });

      // FSTAT-07 / D-66-04: force-installed is a realized install transition --
      // info severity, reload-hint (TRANSITION_STATUS_LIST membership), and the
      // ◉ glyph distinct from the clean (installed) row.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined, "force-installed is info, not error");
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" +
          "  ◉ p1 v1.0.0 (partially-installed) {unsupported component}\n" +
          "\n" +
          "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-03: the installed outcome of a partial install carries the dropped kinds, and a clean install carries none", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wr03-unsupported-"));
    const cleanCwd = await mkdtemp(path.join(tmpdir(), "install-wr03-clean-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "degraded",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        skills: [{ sourceName: "tool" }],
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      });
      await seedPathMarketplaceWithPlugin({
        cwd: cleanCwd,
        marketplaceRoot: path.join(cleanCwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "clean",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        skills: [{ sourceName: "tool" }],
      });

      const { ctx, pi } = makeCtx();
      const degraded = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "degraded",
        partial: true,
      });

      // The outcome names what the ledger dropped. Without it an orchestrated
      // caller has the facts only for a bare `(installed)` row, which would
      // contradict the `(partially-installed)` row `list` renders for the same
      // record one command later.
      assert.ok(degraded.status === "installed");
      assert.ok(
        (degraded.unsupported ?? []).length > 0,
        `the partial install reports its dropped kinds: ${JSON.stringify(degraded.unsupported)}`,
      );

      const clean = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd: cleanCwd,
        marketplace: "mp",
        plugin: "clean",
      });

      // NREG-01: a clean install omits the field entirely.
      assert.ok(clean.status === "installed");
      assert.equal(clean.unsupported, undefined);
      assert.equal(Object.hasOwn(clean, "unsupported"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(cleanCwd, { recursive: true, force: true });
    }
  });
});

test("WR-03: a (partially-installed) success row renders soft-dep markers when a staged companion is unloaded", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force-softdep-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        // The force-degradable `unsupported` arm still stages the SUPPORTED
        // components, so the staged agent populates `dependencies: ["agents"]`.
        skills: [{ sourceName: "tool" }],
        agents: [{ sourceName: "bot" }],
        // D-64-06: experimental unsupported kinds drive the force-degradable
        // `unsupported` arm -> the row is (partially-installed) {unsupported component}.
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      });

      // Default probe: getAllTools() returns [] -> pi-subagents is NOT loaded,
      // so the staged agent's `{requires pi-subagents}` soft-dep marker fires.
      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        partial: true,
      });

      // SEV-01: the force-degraded install stages an agent while `pi-subagents`
      // is unloaded -> the missing-companion ladder raises the success row to
      // warning, so the cascade gains the `needs attention` summary line.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning", "missing companion -> warning");
      // WR-03: the soft-dep marker shares the brace with the dropped-component
      // reason -- composeReasons appends `{requires pi-subagents}` AFTER the
      // typed reason (MSG-GR-4), so `unsupported component` leads.
      assert.equal(
        notifications[0]?.message,
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◉ p1 v1.0.0 (partially-installed) {unsupported component, requires pi-subagents}\n" +
          "\n" +
          "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// SEV-01 regression guard: the missing-companion warning is conditioned on the
// probe -- when the declared companion IS loaded, the success row stays info.
test("SEV-01: install staging agents with pi-subagents loaded stays info (companion present)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-sev01-loaded-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.0.0",
        pluginJsonVersion: "1.0.0",
        agents: [{ sourceName: "bot" }],
      });

      // Probe reports the `pi-subagents` companion loaded -> no missing
      // companion -> the success row keeps its info stamp (no summary line).
      const { ctx, pi, notifications } = makeCtx({ getAllTools: () => [{ name: "subagent" }] });
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" + "  ● hello v1.0.0 (installed)\n" + "\n" + "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-03: without force an unsupported plugin still blocks and writes no state record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force03-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        skills: [{ sourceName: "tool" }],
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      });

      const { ctx, pi, notifications } = makeCtx();
      // No `force` -> the default `requireInstallable` gate still blocks the
      // `unsupported` arm.
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
      });

      // A row surfaced (the plugin did not silently install) ...
      assert.ok(notifications.length >= 1, "a notification must surface on block");
      // ... and no state record was written.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["p1"];
      assert.equal(record, undefined, "unsupported plugin must not be recorded without --force");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-04: the force-degrade path emits no warning-severity notification and no Warning: summary", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force04-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        skills: [{ sourceName: "tool" }],
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        partial: true,
      });

      // FORCE-04: no row stamps `warning` severity, so the MAX-reduce summary
      // never renders a `Warning:` line.
      const warnings = notifications.filter((n) => n.severity === "warning");
      assert.equal(warnings.length, 0, `unexpected warnings: ${JSON.stringify(warnings)}`);
      for (const n of notifications) {
        assert.ok(
          !n.message.startsWith("Warning:"),
          `no summary line may begin with "Warning:": ${n.message}`,
        );
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-05: force cannot bypass an unavailable (structural) plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force05a-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p1",
        // An `npm` source stays out of scope (PURL-01 widens only url /
        // git-subdir / github) -> resolver returns the `unavailable` arm, which
        // `requirePartialInstallable` still rejects (FORCE-05). Using npm (not a
        // git kind) keeps this a pure structural rejection with no clone.
        rawSourceOverride: { source: "npm", package: "some-pkg" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        partial: true,
      });

      // Still blocks: an `(unavailable)` row surfaced and no record was written.
      const message = notifications.map((n) => n.message).join("\n");
      assert.ok(message.includes("(unavailable)"), `expected (unavailable) row; got:\n${message}`);
      const warnings = notifications.filter((n) => n.severity === "warning");
      assert.equal(warnings.length, 0, `force on unavailable must emit no warning`);

      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["p1"], undefined, "no record on unavailable");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-05: force cannot bypass a missing marketplace", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-force05b-"));
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      const { ctx, pi, notifications } = makeCtx();
      // No marketplace seeded -> the marketplace-absent precondition
      // short-circuits BEFORE the gate; `--force` cannot conjure a source.
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "ghost-mp",
        plugin: "p1",
        partial: true,
      });

      assert.ok(notifications.length >= 1, "a notification must surface on missing marketplace");
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["ghost-mp"], undefined, "no marketplace record conjured");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PURL-01..04 / PURL-09 -- git-source (url / git-subdir / github) install via
// the clone-cache seam. The mock gitOps copies a real plugin fixture tree into
// the staging dir on clone(); the seam renames it into plugin-clones/<key>/,
// and the resolver reads the materialized clone exactly as a path source.
// ───────────────────────────────────────────────────────────────────────────

const GIT_SOURCE_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

/**
 * Bind the clone-cache seam entrypoints to a mock gitOps so install's
 * git-source path runs without touching the network.
 */
function seamWith(gitOps: GitOps): InstallCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}

/**
 * Build a plugin fixture tree on disk (the "repo" the mock clone copies) and
 * seed a marketplace whose manifest entry carries a git-object source.
 *
 * `subdirPath` places the plugin under `<repo>/<subdirPath>/` for git-subdir
 * fixtures; when absent the plugin lives at the repo root (url / github).
 */
async function seedGitSourceMarketplace(opts: {
  cwd: string;
  marketplaceRoot: string;
  marketplaceName: string;
  pluginName: string;
  source: unknown;
  fixtureRepoDir: string;
  subdirPath?: string;
  scope?: "user" | "project";
}): Promise<void> {
  const scope = opts.scope ?? "project";
  // The plugin tree the mock clone copies into staging. For git-subdir it lives
  // under a subdirectory of the repo root; otherwise at the repo root.
  const pluginRoot =
    opts.subdirPath === undefined
      ? opts.fixtureRepoDir
      : path.join(opts.fixtureRepoDir, opts.subdirPath);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: opts.pluginName, version: "9.9.9" }),
  );
  const skillDir = path.join(pluginRoot, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello.\n`);

  await mkdir(path.join(opts.marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: opts.marketplaceName,
      plugins: [{ name: opts.pluginName, source: opts.source }],
    }),
  );

  const locations = locationsFor(scope, opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      [opts.marketplaceName]: {
        name: opts.marketplaceName,
        scope,
        source: pathSource(`./${path.basename(opts.marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {},
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

test("PURL-01/02/09: url-source install materializes a clone, records sha-<12hex> + resolvedSha", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-url-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "a state record must be written for a url-source install");
      assert.match(record.version, /^sha-[0-9a-f]{12}$/, "version is sha-<12hex>");
      assert.equal(record.resolvedSha, GIT_SOURCE_SHA, "full 40-hex resolvedSha recorded");
      assert.equal(
        record.version,
        `sha-${GIT_SOURCE_SHA.slice(0, 12)}`,
        "version 12-hex == resolvedSha first-12",
      );
      // One clone (cold cache) and one checkout at the pin.
      assert.equal(gitState.cloneCalls.length, 1, "one clone on cold cache");
      assert.equal(gitState.checkoutCalls.length, 1, "one checkout at the pin");
      assert.equal(gitState.checkoutCalls[0]?.ref, GIT_SOURCE_SHA, "checkout pins the sha");
      // The clone materialized under plugin-clones/<key>/.
      const key = pluginCloneKey("https://example.com/org/repo", GIT_SOURCE_SHA);
      const cloneRoot = await locations.pluginCloneDir(key);
      assert.equal(record.resolvedSource, cloneRoot, "resolvedSource points at the clone root");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-04: a second install of the same url+sha does NOT clone again (dedup)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-dedup-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp1",
        source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });
      // A second plugin (different name) referencing the SAME url+sha.
      const manifestPath = path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [
            {
              name: "gp1",
              source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
            },
            {
              name: "gp2",
              source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
            },
          ],
        }),
      );

      const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const seam = seamWith(gitOps);
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp1",
        cloneCacheSeam: seam,
      });
      assert.equal(gitState.cloneCalls.length, 1, "first install clones once");

      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp2",
        cloneCacheSeam: seam,
      });
      assert.equal(
        gitState.cloneCalls.length,
        1,
        "second install reuses the warm cache (no new clone)",
      );

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.ok(
        after.marketplaces["mp"]?.plugins["gp2"] !== undefined,
        "second plugin still records",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-03: git-subdir install resolves pluginRoot = cloneRoot + subdir", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-subdir-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: {
          source: "git-subdir",
          url: "https://example.com/org/mono",
          path: "packages/gp",
          sha: GIT_SOURCE_SHA,
        },
        fixtureRepoDir,
        subdirPath: "packages/gp",
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "git-subdir install records");
      const key = pluginCloneKey("https://example.com/org/mono", GIT_SOURCE_SHA);
      const cloneRoot = await locations.pluginCloneDir(key);
      assert.equal(
        record.resolvedSource,
        path.join(cloneRoot, "packages/gp"),
        "pluginRoot = cloneRoot + subdir",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-03: a git-subdir path escaping the clone root fails the install", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-escape-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: {
          source: "git-subdir",
          url: "https://example.com/org/mono",
          path: "../../etc",
          sha: GIT_SOURCE_SHA,
        },
        fixtureRepoDir,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["gp"], undefined, "no record on escape");
      assert.ok(notifications.length >= 1, "a failure notification surfaces on escape");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-03: a missing git-subdir path fails the install", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-missing-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: {
          source: "git-subdir",
          url: "https://example.com/org/mono",
          path: "packages/absent",
          sha: GIT_SOURCE_SHA,
        },
        fixtureRepoDir,
        // Seed the plugin at a DIFFERENT subdir so the declared path is absent.
        subdirPath: "packages/present",
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"],
        undefined,
        "no record on missing subdir",
      );
      assert.ok(notifications.length >= 1, "a failure notification surfaces on missing subdir");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-77-06: a github-object source dedups to the same clone as a url naming the same repo", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-github-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gh",
        source: { source: "github", repo: "org/repo", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });
      const manifestPath = path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [
            { name: "gh", source: { source: "github", repo: "org/repo", sha: GIT_SOURCE_SHA } },
            {
              name: "u",
              source: { source: "url", url: "https://github.com/org/repo", sha: GIT_SOURCE_SHA },
            },
          ],
        }),
      );

      const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const seam = seamWith(gitOps);
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gh",
        cloneCacheSeam: seam,
      });
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "u",
        cloneCacheSeam: seam,
      });

      // github reconstructs https://github.com/org/repo -- same canonical url as
      // the url entry, so both dedup to ONE clone.
      assert.equal(
        gitState.cloneCalls.length,
        1,
        "github + url naming the same repo share one clone",
      );
      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const ghRecord = after.marketplaces["mp"]?.plugins["gh"];
      const uRecord = after.marketplaces["mp"]?.plugins["u"];
      assert.equal(
        ghRecord?.resolvedSource,
        uRecord?.resolvedSource,
        "both resolve to the same clone root",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01/MIRR-03: an unpinned url source materializes the mirror and records the HEAD sha", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-unpinned-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo" },
        fixtureRepoDir,
      });

      // The mirror seam reads HEAD from the refreshed clone, not resolveRemoteRef;
      // seed the mock HEAD so the checked-out sha is deterministic.
      const headSha = "0f1e2d3c4b5a69788796a5b4c3d2e1f0aabbccdd";
      const { gitOps, state: gitState } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: headSha,
        localRefs: { "refs/heads/main": headSha },
        remoteRefs: { "refs/remotes/origin/main": headSha },
      });
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "unpinned install records");
      assert.equal(record.resolvedSha, headSha, "records the mirror HEAD sha");
      assert.equal(
        record.version,
        `sha-${headSha.slice(0, 12)}`,
        "version from the mirror HEAD sha",
      );

      // The record anchors to the BARE mirror key `plugin-clones/<12hex>/`
      // (no `-<sha>` suffix), so GC's first-segment derivation protects it.
      const mirrorKey = pluginMirrorKey("https://example.com/org/repo");
      const mirrorRoot = await locations.pluginCloneDir(mirrorKey);
      assert.equal(record.resolvedSource, mirrorRoot, "resolvedSource points at the mirror root");
      const segment = path.basename(record.resolvedSource);
      assert.match(segment, /^[0-9a-f]{12}$/, "resolvedSource segment is a bare 12-hex mirror key");

      // The pin-only resolveRemoteRef path is NOT taken for the mirror route.
      assert.equal(
        gitState.resolveRemoteRefCalls.length,
        0,
        "unpinned mirror install does not resolve a remote ref (mirror reads HEAD)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01/MIRR-03: an unpinned git-subdir source materializes the mirror under the bare key", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-unpinned-subdir-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "git-subdir", url: "https://example.com/org/mono", path: "packages/gp" },
        fixtureRepoDir,
        subdirPath: "packages/gp",
      });

      const headSha = "1a2b3c4d5e6f70819283a4b5c6d7e8f901234567";
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: headSha,
        localRefs: { "refs/heads/main": headSha },
        remoteRefs: { "refs/remotes/origin/main": headSha },
      });
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "unpinned git-subdir install records");
      assert.equal(record.resolvedSha, headSha, "records the mirror HEAD sha");
      assert.equal(
        record.version,
        `sha-${headSha.slice(0, 12)}`,
        "version from the mirror HEAD sha",
      );

      // resolvedSource is the subdir UNDER the bare mirror key; the first
      // path segment under plugin-clones is still the bare 12-hex mirror key.
      const mirrorKey = pluginMirrorKey("https://example.com/org/mono");
      const mirrorRoot = await locations.pluginCloneDir(mirrorKey);
      assert.equal(
        record.resolvedSource,
        path.join(mirrorRoot, "packages/gp"),
        "resolvedSource is mirrorRoot + subdir",
      );
      assert.match(
        path.basename(mirrorRoot),
        /^[0-9a-f]{12}$/,
        "the mirror root segment is a bare 12-hex key",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01 regression: a PINNED install still records a per-sha <12hex>-<12hex> path", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-pinned-key-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "pinned install records");
      const perShaKey = pluginCloneKey("https://example.com/org/repo", GIT_SOURCE_SHA);
      const perShaRoot = await locations.pluginCloneDir(perShaKey);
      assert.equal(record.resolvedSource, perShaRoot, "pinned resolvedSource is the per-sha clone");
      assert.match(
        path.basename(record.resolvedSource),
        /^[0-9a-f]{12}-[0-9a-f]{12}$/,
        "pinned key is <12hex>-<12hex> (unchanged)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-09 / sha over ref: a source with both ref and sha records the sha's version", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-shaoverref-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gp",
        source: {
          source: "url",
          url: "https://example.com/org/repo",
          ref: "v2.0.0",
          sha: GIT_SOURCE_SHA,
        },
        fixtureRepoDir,
      });

      // remoteResolveMap maps the ref to a DIFFERENT sha; sha must win.
      const refSha = "ffffffffffffffffffffffffffffffffffffffff";
      const { gitOps, state: gitState } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        remoteResolveMap: { "v2.0.0": refSha },
      });
      const { ctx, pi } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, GIT_SOURCE_SHA, "sha wins over ref");
      assert.equal(record?.version, `sha-${GIT_SOURCE_SHA.slice(0, 12)}`, "version from the sha");
      // resolveRemoteRef is NOT consulted when a sha is set.
      assert.equal(
        gitState.resolveRemoteRefCalls.length,
        0,
        "no remote-ref resolve when sha is pinned",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-09 regression: a path-source install keeps its 3-tier ladder version (not sha)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-purl-pathreg-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "p",
        pluginVersion: "3.4.5",
        // Omit the plugin.json version so the entry.version tier wins (proving
        // the 3-tier ladder still runs for path sources, NOT the sha branch).
        pluginJsonVersion: null,
      });

      const { ctx, pi } = makeCtx();
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "p" });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["p"];
      assert.equal(record?.version, "3.4.5", "path source keeps the entry.version tier");
      assert.equal(record?.resolvedSha, undefined, "path source records no resolvedSha");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SUB-02 -- end-to-end ${CLAUDE_PROJECT_DIR} delivery from the orchestrator
//
// The bridge unit tests prove each surface substitutes scope-gated projectDir,
// but the orchestrator threads `cwd` into every stage input by hand (optional
// field a compiler cannot enforce). These tests install a real fixture whose
// skill/command/agent bodies carry ${CLAUDE_PROJECT_DIR} and ${CLAUDE_SKILL_DIR}
// and assert the materialized files, closing the silent-miss gap end-to-end.
// ───────────────────────────────────────────────────────────────────────────

test("SUB-02: project-scope install substitutes ${CLAUDE_PROJECT_DIR} to the install cwd in skill, command, and agent files; keeps ${CLAUDE_SKILL_DIR} literal in command and agent", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-sub02-proj-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        scope: "project",
        skills: [{ sourceName: "tool", body: "Project: ${CLAUDE_PROJECT_DIR}\n" }],
        commands: [
          {
            sourceName: "deploy",
            body: "# deploy\nProject: ${CLAUDE_PROJECT_DIR}\nSkill: ${CLAUDE_SKILL_DIR}\n",
          },
        ],
        agents: [
          {
            sourceName: "bot",
            body: "Project: ${CLAUDE_PROJECT_DIR}\nSkill: ${CLAUDE_SKILL_DIR}\n",
          },
        ],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

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

test("SUB-02: user-scope install keeps ${CLAUDE_PROJECT_DIR} literal in skill, command, and agent files", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-sub02-user-"));
    try {
      const locations = locationsFor("user", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        scope: "user",
        skills: [{ sourceName: "tool", body: "Project: ${CLAUDE_PROJECT_DIR}\n" }],
        commands: [{ sourceName: "deploy", body: "# deploy\nProject: ${CLAUDE_PROJECT_DIR}\n" }],
        agents: [{ sourceName: "bot", body: "Project: ${CLAUDE_PROJECT_DIR}\n" }],
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({ ctx, pi, scope: "user", cwd, marketplace: "mp", plugin: "hello" });

      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const skillBody = await readFile(
        path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"),
        "utf8",
      );
      assert.ok(
        skillBody.includes("Project: ${CLAUDE_PROJECT_DIR}"),
        "skill: user-scope must keep ${CLAUDE_PROJECT_DIR} literal, got: " + skillBody,
      );

      const commandBody = await readFile(
        path.join(locations.promptsTargetDir, "hello:deploy.md"),
        "utf8",
      );
      assert.ok(
        commandBody.includes("Project: ${CLAUDE_PROJECT_DIR}"),
        "command: user-scope must keep ${CLAUDE_PROJECT_DIR} literal, got: " + commandBody,
      );

      const agentBody = await readFile(
        path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`),
        "utf8",
      );
      assert.ok(
        agentBody.includes("Project: ${CLAUDE_PROJECT_DIR}"),
        "agent: user-scope must keep ${CLAUDE_PROJECT_DIR} literal, got: " + agentBody,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Rollback arms (D-99-05b): a phase that throws after earlier phases committed
// must unwind them, and the assertion is on what the unwind left behind.
// ───────────────────────────────────────────────────────────────────────────

test("PI-15: an mcp phase that cannot run unwinds the hooks bridge and leaves no record", async () => {
  // The hooks bridge writes its config atomically -- there is no staging dir,
  // so its undo is a real removal rather than the discard the other bridges
  // do. Failing the mcp phase (the slot after hooks) is what makes that
  // removal run; occupying <scopeRoot>/mcp.json with a directory fails the
  // phase without touching any earlier one.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-hooks-unwind-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        skills: [{ sourceName: "tool" }],
        hooksJson: { hooks: { SessionStart: [{ hooks: [{ type: "command", command: "x" }] }] } },
        mcpServers: { server1: { command: "node", args: ["s.js"] } },
      });

      await mkdir(locations.mcpJsonPath, { recursive: true });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(allText, /⊘ hello v0\.0\.1 \(failed\)/, `no failed row in:\n${allText}`);

      // The unwind is what these assert: nothing the earlier phases wrote may
      // outlive the failed install, or the next attempt collides with itself.
      const survives = async (p: string): Promise<boolean> =>
        stat(p).then(
          () => true,
          () => false,
        );
      assert.equal(
        await survives(path.join(locations.hooksDir, "hello", "hooks.json")),
        false,
        "the hooks config the hooks phase wrote must be removed by its undo",
      );
      assert.equal(
        await survives(path.join(locations.skillsTargetDir, "hello-tool")),
        false,
        "the skills the first phase staged must not survive the failure",
      );
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        after.marketplaces["mp"]?.plugins["hello"],
        undefined,
        "a failed install must write no record",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// D-141-03: a discovery warning has to reach the user in BOTH modes. It says
// the installed artifact set is smaller than what the author shipped, and the
// install row's resource count gives the user no baseline to notice that.

/**
 * Seed a plugin whose commands directory holds a D-07 collision:
 * `acme-tools/lint.md` elides its head (D-141-01) onto the same
 * `hello:tools:lint` that `tools/lint.md` produces, so one of the two is
 * dropped with a warning.
 */
async function seedCollidingNestedCommands(pluginRoot: string): Promise<void> {
  const commandsDir = path.join(pluginRoot, "commands");
  await mkdir(path.join(commandsDir, "hello-tools"), { recursive: true });
  await mkdir(path.join(commandsDir, "tools"), { recursive: true });
  await writeFile(path.join(commandsDir, "hello-tools", "lint.md"), "first\n");
  await writeFile(path.join(commandsDir, "tools", "lint.md"), "second\n");
}

test("D-141-03: a standalone install surfaces a command discovery warning as a second notification", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-discwarn-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        pluginName: "hello",
        commands: [{ sourceName: "keep" }],
      });
      await seedCollidingNestedCommands(path.join(marketplaceRoot, "plugins", "hello"));

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

      assert.equal(notifications.length, 2, "the install row plus the diagnostic block");
      const diagnostic = notifications[1];
      assert.ok(diagnostic !== undefined);
      assert.equal(diagnostic.severity, "warning");
      // The VERB and the plugin name are the whole reason the diagnostic
      // header is parameterised; assert them, not just the tally clause.
      assert.ok(
        diagnostic.message.includes('Plugin "hello" installed; 1 declared component was skipped.'),
        diagnostic.message,
      );
      assert.match(diagnostic.message, /"hello:tools:lint"/);
      assert.match(diagnostic.message, /ignoring duplicate/);
      // NFR-9: the absolute commands directory is redacted to its basename.
      assert.ok(
        !diagnostic.message.includes(marketplaceRoot),
        `absolute path leaked: ${diagnostic.message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: an orchestrated install carries the same warning on postCommitWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-discwarn-orch-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        pluginName: "hello",
        commands: [{ sourceName: "keep" }],
      });
      await seedCollidingNestedCommands(path.join(marketplaceRoot, "plugins", "hello"));

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(outcome.status, "installed");
      assert.equal(notifications.length, 0, "orchestrated mode fires no notification of its own");
      const warnings = (outcome as { postCommitWarnings?: readonly string[] }).postCommitWarnings;
      assert.ok(
        warnings?.some((w) => w.includes('"hello:tools:lint"')),
        `expected the discovery warning; got: ${JSON.stringify(warnings)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

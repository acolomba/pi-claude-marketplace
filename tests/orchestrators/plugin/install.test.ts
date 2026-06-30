import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_PREFIX,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  __test_classifyEntityShapeError,
  __test_classifyInstallFailure,
  __test_composeInstallFailureMessage,
  __test_narrowResolverReasons,
  installPlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  __resetCacheForTests,
  getPluginIndex,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

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
 * Build a plugin source tree on disk and seed a path-source marketplace
 * pointing at it. Returns the absolute paths for downstream assertions.
 *
 * The marketplace manifest is written under `<marketplaceRoot>/.claude-plugin/marketplace.json`.
 * The plugin tree lives at `<marketplaceRoot>/plugins/<plugin>/`.
 */
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
   * D-64-06: declare unsupported component kinds in the plugin's own
   * plugin.json so `resolveStrict` returns `state: "unsupported"` with NO
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
}): Promise<SeededPlugin> {
  const { cwd, marketplaceRoot, marketplaceName, pluginName } = opts;
  const scope = opts.scope ?? "project";

  await mkdir(marketplaceRoot, { recursive: true });
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  await mkdir(pluginRoot, { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  // SNM-34 fixture knob: the plugin's OWN plugin.json version, distinct from
  // the marketplace entry.version (`pluginVersion`). `undefined` preserves the
  // legacy `0.0.1` shape; a string sets that version; `null` omits the field.
  const pluginManifest: Record<string, unknown> = { name: pluginName };
  if (opts.pluginJsonVersion === undefined) {
    pluginManifest.version = "0.0.1";
  } else if (opts.pluginJsonVersion !== null) {
    pluginManifest.version = opts.pluginJsonVersion;
  }

  // D-64-06: declaring experimental kinds drives `resolveStrict` to the
  // `unsupported` (force-degradable) arm without a structural defect.
  if (opts.experimental !== undefined) {
    pluginManifest.experimental = opts.experimental;
  }

  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify(pluginManifest),
  );

  // Skills
  for (const skill of opts.skills ?? []) {
    const skillDir = path.join(pluginRoot, "skills", skill.sourceName);
    await mkdir(skillDir, { recursive: true });
    const name = skill.frontmatterName ?? skill.sourceName;
    const body = skill.body ?? "Body.\n";
    await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n\n${body}`);
  }

  // Commands
  for (const command of opts.commands ?? []) {
    const commandsDir = path.join(pluginRoot, "commands");
    await mkdir(commandsDir, { recursive: true });
    await writeFile(
      path.join(commandsDir, `${command.sourceName}.md`),
      command.body ?? `# ${command.sourceName}\nBody.\n`,
    );
  }

  // Agents
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

  // MCP servers
  if (opts.mcpServers !== undefined) {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: opts.mcpServers }),
    );
  }

  // Hooks (WR-03): seed `<pluginRoot>/hooks/hooks.json` so the resolver
  // populates `installable.hooksConfigPath` and the install ledger's
  // cache+rebuild path actually executes.
  if (opts.hooksJson !== undefined) {
    const hooksDir = path.join(pluginRoot, "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(opts.hooksJson));
  }

  // Marketplace manifest
  const entry: Record<string, unknown> = {
    name: pluginName,
    source: opts.rawSourceOverride ?? `./plugins/${pluginName}`,
  };
  if (opts.pluginVersion !== undefined) {
    entry.version = opts.pluginVersion;
  }

  if (opts.declareDependencies === true) {
    entry.dependencies = { "some-other-plugin": "*" };
  }

  const manifest = {
    name: marketplaceName,
    plugins: [entry],
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
    const cp = opts.conflictingPriorPlugin;
    state.marketplaces[cp.marketplace] = {
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
          compatibility: {
            installable: true,
            notes: [],
            supported: [],
            unsupported: [],
          },
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

test("PI-4: non-path source -> V2 unavailable/{unsupported source}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi4-"));
    try {
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        // MM-3 / PR-2: only path sources are installable; "github:foo/bar"
        // classifies as github and the resolver returns the not-installable
        // variant.
        rawSourceOverride: "github:anthropics/some-repo",
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
// staged artefacts when a later phase fails.
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
      __resetCacheForTests();
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
      __resetCacheForTests();
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
  const row = __test_classifyEntityShapeError(err, {
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
  const row = __test_classifyEntityShapeError(err, {
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
  // carve-out in `narrowResolverReasons` strips the prefix and routes the
  // bare token through the shared `narrowUnsupportedKinds` helper.
  // `contains lspServers` maps to `lsp` (SNM-36 / D-24-04).
  //
  // PHOOK-05 / D-71-04: the `hooks` kind is now a force-degradable marker
  // and renders the single aggregate `unsupported hooks` reason via the SAME
  // shared helper. A synthetic input mixing `contains hooks` with `contains
  // lspServers` therefore emits BOTH markers (`unsupported hooks`, `lsp`),
  // byte-identical to what `list`/`info` derive from the typed `unsupported[]`
  // list for the same kinds. (`hooks` is not in `UNSUPPORTED_COMPONENT_KINDS`,
  // so the resolver never emits a real `contains hooks` note -- this synthetic
  // input pins the shared-helper mapping for cross-surface parity.)
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["contains hooks", "contains lspServers"],
    forceable: false,
  });
  const row = __test_classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  assert.deepEqual(row.reasons, ["unsupported hooks", "lsp"]);
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
    forceable: false,
  });
  const row = __test_classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  assert.deepEqual(row.reasons, ["unsupported source"]);
});

test("classifyEntityShapeError returns undefined for non-PluginShapeError input (fallback to bare errorMessage)", () => {
  const row = __test_classifyEntityShapeError(new Error("random failure"), {
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
    forceable: true,
    unsupportedKinds: ["hooks"],
  });
  const row = __test_classifyEntityShapeError(err, {
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
    forceable: true,
    unsupportedKinds: ["lspServers"],
  });
  const row = __test_classifyEntityShapeError(err, {
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
    forceable: false,
    unsupportedKinds: [],
  });
  const row = __test_classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  assert.deepEqual(row.reasons, ["unsupported source"]);
});

test("SEV-02 / D-69-03: classifyEntityShapeError threads forceable from the thrown shape", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");

  const forceable = __test_classifyEntityShapeError(
    new PluginShapeError({
      kind: "not-installable",
      plugin: "p",
      reasons: ["contains lspServers"],
      forceable: true,
    }),
    { plugin: "p", marketplace: "mp", scope: "project" },
  );
  assert.ok(forceable);
  assert.equal(forceable.status, "unavailable");
  assert.equal(forceable.forceable, true);

  const structural = __test_classifyEntityShapeError(
    new PluginShapeError({
      kind: "not-installable",
      plugin: "p",
      reasons: ["source dir does not exist"],
      forceable: false,
    }),
    { plugin: "p", marketplace: "mp", scope: "project" },
  );
  assert.ok(structural);
  assert.equal(structural.status, "unavailable");
  assert.equal(structural.forceable, false);
});

test("SEV-02 / D-69-03: composeInstallFailureMessage points at --force iff the verdict is force-degradable", async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");

  // XSURF-01: force-degradable arm -> the resolver-state-driven `unsupported`
  // row carries the `--force` hint and renders at error severity (consistent
  // with how `list` / `info` describe the same plugin).
  const forceableErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "helper",
    reasons: ["contains lspServers"],
    forceable: true,
  });
  const forceableMsg = __test_composeInstallFailureMessage({
    err: forceableErr,
    plugin: "helper",
    scope: "project",
    version: undefined,
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: __test_classifyEntityShapeError(forceableErr, {
      plugin: "helper",
      marketplace: "mp",
      scope: "project",
    }),
  });
  assert.equal(forceableMsg.status, "unsupported");
  assert.ok(forceableMsg.status === "unsupported");
  assert.equal(forceableMsg.forceHint, true);
  assert.equal(forceableMsg.severity, "error");

  // D-70-02: structural `unavailable` arm -> error severity, but NO `--force`
  // hint (force cannot degrade-install a structural defect).
  const structuralErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "helper",
    reasons: ["source dir does not exist"],
    forceable: false,
  });
  const structuralMsg = __test_composeInstallFailureMessage({
    err: structuralErr,
    plugin: "helper",
    scope: "project",
    version: undefined,
    rolledBackPartial: false,
    rollbackPartials: [],
    entityErrorRow: __test_classifyEntityShapeError(structuralErr, {
      plugin: "helper",
      marketplace: "mp",
      scope: "project",
    }),
  });
  assert.equal(structuralMsg.status, "unavailable");
  assert.ok(structuralMsg.status === "unavailable");
  assert.equal(structuralMsg.forceHint, undefined);
  assert.equal(structuralMsg.severity, "error");
});

// ───────────────────────────────────────────────────────────────────────────
// PHOOK-04 -- partial-hook `install --force` stages a STRICT SUBSET of the
// source `hooks.json`: the dropped event / matcher group is absent from the
// written file, while the supported group is present. The bridge stages
// `parseHooksConfig.value` (the pure filtered subset), so the staged file can
// never carry a dropped handler (PHOOK-04 containment invariant). No source
// change to install.ts / stage.ts -- the subset is inherited from the partition.
// ───────────────────────────────────────────────────────────────────────────

test("PHOOK-04: install --force stages a strict-subset hooks.json -- dropped Stop event absent, supported PostToolUse group present", async () => {
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
        // A supported PostToolUse(Edit) group plus a non-bucket-A `Stop` event.
        // The partition keeps the PostToolUse group and drops the whole Stop
        // event (event-level drop, D-71-01).
        hooksJson: {
          hooks: {
            PostToolUse: [
              { matcher: "Edit", hooks: [{ type: "command", command: "echo posttooluse" }] },
            ],
            Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }],
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
        force: true,
      });

      // Read the staged file the bridge wrote and assert the strict-subset
      // property: the dropped `Stop` event is ABSENT, the supported
      // `PostToolUse` group is PRESENT (PHOOK-04 / V5 output containment).
      // The bridge stages the bare events map (`parseHooksConfig` unwraps the
      // `{hooks:{...}}` wrapper and returns the filtered subset).
      const stagedPath = path.join(locations.hooksDir, "hook-plugin", "hooks.json");
      const staged = JSON.parse(await readFile(stagedPath, "utf8")) as Record<string, unknown>;
      assert.ok("PostToolUse" in staged, "supported PostToolUse group must be staged");
      assert.equal("Stop" in staged, false, "dropped Stop event must NOT be staged");
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
        force: true,
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
// `unsupported` (force-degradable), so it flows through the Phase 65/69 gates
// with no severity-layer source change: WITHOUT `--force` it blocks at error
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
            Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }],
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
        /hook-plugin \(unsupported\) \{unsupported hooks\}/,
      );
      assert.match(
        noForce.notifications[0]?.message ?? "",
        /Re-run with --force to install the supported components\./,
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
      // Stop event degrades, and the success row reads `(force-installed)
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
        force: true,
      });
      assert.equal(forced.notifications.length, 1);
      const forcedMsg = forced.notifications[0]?.message ?? "";
      assert.notEqual(forced.notifications[0]?.severity, "error");
      assert.notEqual(forced.notifications[0]?.severity, "warning");
      assert.match(forcedMsg, /\(force-installed\)/);
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
  const notInManifest = __test_classifyInstallFailure(notInManifestErr, "formatted");
  assert.equal(notInManifest.status, "failed");
  assert.ok(notInManifest.status === "failed");
  assert.equal(notInManifest.error, notInManifestErr);
  assert.equal(notInManifest.cause, "formatted");

  const alreadyInstalledErr = new PluginShapeError({
    kind: "already-installed",
    plugin: "p",
    marketplace: "mp",
  });
  const alreadyInstalled = __test_classifyInstallFailure(alreadyInstalledErr, "formatted");
  assert.equal(alreadyInstalled.status, "failed");
  assert.ok(alreadyInstalled.status === "failed");
  assert.equal(alreadyInstalled.error, alreadyInstalledErr);

  const notInstallableErr = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["hooks"],
    forceable: false,
  });
  const notInstallable = __test_classifyInstallFailure(notInstallableErr, "formatted");
  assert.equal(notInstallable.status, "failed");
  assert.ok(notInstallable.status === "failed");
  assert.equal(notInstallable.error, notInstallableErr);

  const noLongerInstallableErr = new PluginShapeError({
    kind: "no-longer-installable",
    plugin: "p",
    reasons: ["unsupported source"],
    forceable: false,
  });
  const noLongerInstallable = __test_classifyInstallFailure(noLongerInstallableErr, "formatted");
  assert.equal(noLongerInstallable.status, "failed");
  assert.ok(noLongerInstallable.status === "failed");
  assert.equal(noLongerInstallable.error, noLongerInstallableErr);

  // Non-PluginShapeError input is preserved verbatim on `error`.
  const opaque = new Error("random");
  const unexpected = __test_classifyInstallFailure(opaque, "formatted");
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
  assert.deepEqual([...__test_narrowResolverReasons(["contains hooks"])], ["unsupported hooks"]);
});

test("260525-cjr B2 / C5: narrowResolverReasons -> `contains lspServers` extracts the `lspServers` token and emits the `lsp` Reason (SNM-36)", () => {
  assert.deepEqual([...__test_narrowResolverReasons(["contains lspServers"])], ["lsp"]);
});

test("260525-cjr C5: narrowResolverReasons recognises `contains lspServers` as the sole remaining manifest-field carve-out", () => {
  // HOOK-04 / D-58-02: `lspServers` is now the SOLE
  // `MANIFEST_FIELD_REASONS` member. The `contains hooks` half was
  // dropped (dead under v1.13). The `lspServers` detection token maps
  // to the `lsp` Reason per SNM-36 / D-24-04; the catalog row form is
  // `(unavailable) {lsp}`.
  assert.deepEqual([...__test_narrowResolverReasons(["contains lspServers"])], ["lsp"]);
});

test("260525-cjr C5: narrowResolverReasons ignores `contains <unknown-kind>` (kind not in MANIFEST_FIELD_REASONS)", () => {
  // Resolver also emits `"contains monitors"`, `"contains themes"`,
  // etc. for the other UNSUPPORTED_COMPONENT_KINDS members. Those
  // are NOT in the bare-token carve-out -- the catalog renders them
  // as `{unsupported source}` per the existing convention. The
  // helper returns `undefined` for those, and the downstream
  // `reason.includes("source")` check (or the final fallback) takes
  // over.
  const reasons = __test_narrowResolverReasons(["contains monitors"]);
  // `contains monitors` does NOT contain "source"; falls through to
  // the final `unsupported source` permissive default (empty-out
  // guard runs).
  assert.deepEqual([...reasons], ["unsupported source"]);
});

test("260525-cjr B2: narrowResolverReasons -> source-substring -> `unsupported source`", () => {
  assert.deepEqual(
    [...__test_narrowResolverReasons(["unsupported source kind: foo"])],
    ["unsupported source"],
  );
});

test("260525-cjr B2: narrowResolverReasons -> EACCES note surfaces as `permission denied` (NOT `unsupported source`)", () => {
  const reasons = __test_narrowResolverReasons([
    "EACCES: permission denied opening '/.pi/agent/...'",
  ]);
  assert.deepEqual([...reasons], ["permission denied"]);
});

test("260525-cjr B2: narrowResolverReasons -> EPERM also classifies as `permission denied`", () => {
  const reasons = __test_narrowResolverReasons(["EPERM: operation not permitted"]);
  assert.deepEqual([...reasons], ["permission denied"]);
});

test("260525-cjr B2: narrowResolverReasons -> ENOENT note surfaces as `source missing`", () => {
  const reasons = __test_narrowResolverReasons(["ENOENT: no such file or directory"]);
  assert.deepEqual([...reasons], ["source missing"]);
});

test("260525-cjr B2: narrowResolverReasons -> SyntaxError note surfaces as `unparseable`", () => {
  const reasons = __test_narrowResolverReasons(["SyntaxError: Unexpected token } in JSON"]);
  assert.deepEqual([...reasons], ["unparseable"]);
});

test("260525-cjr B2: narrowResolverReasons -> empty notes -> `unsupported source` (permissive fallback)", () => {
  assert.deepEqual([...__test_narrowResolverReasons([])], ["unsupported source"]);
});

test("260525-cjr B2: narrowResolverReasons -> wholly unclassifiable note -> `unsupported source` (permissive fallback)", () => {
  // No carve-out, no `source` substring, no errno substring -- the
  // permissive `unsupported source` fallback runs only here.
  assert.deepEqual(
    [...__test_narrowResolverReasons(["something genuinely unclassifiable"])],
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
  const { _resetForTest, getRoutingBucket } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");

  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-wr03-"));
    try {
      _resetForTest();
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
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-life01-"));
    try {
      _resetForTest();
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
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-surf05-"));
    try {
      _resetForTest();
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
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-surf05neg-"));
    try {
      _resetForTest();
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
        force: true,
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
        force: true,
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

test("FSTAT-07 / D-66-04: force install of an unsupported plugin emits a (force-installed) success row", async () => {
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
        // `unsupported` arm; the success row reports (force-installed) with the
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
        force: true,
      });

      // FSTAT-07 / D-66-04: force-installed is a realized install transition --
      // info severity, reload-hint (TRANSITION_STATUS_LIST membership), and the
      // ◉ glyph distinct from the clean (installed) row.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined, "force-installed is info, not error");
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" +
          "  ◉ p1 v1.0.0 (force-installed) {unsupported source}\n" +
          "\n" +
          "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-03: a (force-installed) success row renders soft-dep markers when a staged companion is unloaded", async () => {
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
        // `unsupported` arm -> the row is (force-installed) {unsupported source}.
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
        force: true,
      });

      // SEV-01: the force-degraded install stages an agent while `pi-subagents`
      // is unloaded -> the missing-companion ladder raises the success row to
      // warning, so the cascade gains the `needs attention` summary line.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning", "missing companion -> warning");
      // WR-03: the soft-dep marker shares the brace with the dropped-component
      // reason -- composeReasons appends `{requires pi-subagents}` AFTER the
      // typed reason (MSG-GR-4), so `unsupported source` leads.
      assert.equal(
        notifications[0]?.message,
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◉ p1 v1.0.0 (force-installed) {unsupported source, requires pi-subagents}\n" +
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
        force: true,
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
        // Non-path source -> resolver returns the `unavailable` arm, which
        // `requireForceInstallable` still rejects (FORCE-05).
        rawSourceOverride: "github:anthropics/some-repo",
      });

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
        force: true,
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
        force: true,
      });

      assert.ok(notifications.length >= 1, "a notification must surface on missing marketplace");
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["ghost-mp"], undefined, "no marketplace record conjured");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

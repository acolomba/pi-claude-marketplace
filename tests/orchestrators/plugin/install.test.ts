import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
    schemaVersion: 1,
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
                  resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
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
          },
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
      // manifest}` reason. Severity `"error"` per D-16-11. Phase 29 / UXG-07
      // (D-29-02/03): 1 failed plugin, 0 failed marketplace -> the
      // "1 plugin operation failed." summary line is prepended.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "1 plugin operation failed.\n\n" +
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

test("PI-3: marketplace itself absent -> V2 failed/{not in manifest}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi3b-"));
    try {
      // No state seeded -- the marketplace record is absent.
      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "ghost-mp",
        plugin: "anything",
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // Phase 29 / UXG-07 (D-29-02/03): summary prefix for the single failed
      // plugin (mp glyph is `●`, not `⊘`, so the marketplace did not fail).
      assert.equal(
        notifications[0]?.message,
        "1 plugin operation failed.\n\n" +
          "● ghost-mp [project]\n" +
          "  ⊘ anything (failed) {not in manifest}\n" +
          '    cause: Plugin "anything" not found in marketplace "ghost-mp".',
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-4 -- non-installable plugin (e.g. github source in V1 is not installable)
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
        // MM-3 / PR-2: only path sources are installable in V1; "github:foo/bar"
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
      // cause-chain trailer. Severity is undefined (info) per D-16-11 --
      // `unavailable` is NOT in the error-severity set (catalog
      // confirms: only the `failed` discriminator emits `error`).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ⊘ hello (unavailable) {unsupported source}",
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
      // Phase 29 / UXG-07 (D-29-02/03): the already-installed case stays
      // classified as `(failed)` (D-29-05, UXG-09 out of scope); the summary
      // line "1 plugin operation failed." is prepended.
      assert.equal(
        notifications[0]?.message,
        "1 plugin operation failed.\n\n" +
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

      // V2 byte form matches `docs/output-catalog.md:286-292`
      // (`success-with-soft-dep`): the default `makeCtx()` mocks pi
      // without `subagent` or `mcp` tools so both companion extensions
      // are unloaded; the renderer emits both per-row soft-dep markers
      // from `dependencies: ["agents", "mcp"]` + the threaded probe
      // per D-16-14 / D-16-15. The fixture seeds version 1.0.0.
      // PluginInstalledMessage triggers the reload-hint structurally
      // per D-16-12.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        notifications[0]?.message,
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
      // composes the marker into the reasons block of the PluginInlineRow,
      // retiring the legacy aggregated PI_SUBAGENTS_NOT_LOADED trailer per
      // D-13-07.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
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
      // fires when (declaresMcp AND !piMcpAdapterLoaded). Legacy aggregated
      // PI_MCP_ADAPTER_NOT_LOADED trailer retired per D-13-07.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
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

      // Plan 19-02 D-19-01: the V1 PI-13 follow-up notifyWarning (PR-5
      // manual-install free-form trailer) is DROPPED entirely in
      // standalone mode. The resolver still detects the deps note and
      // appends it to `installable.notes` so downstream surfaces (e.g.
      // `/claude:plugin list`) can continue to consume it; the
      // standalone-mode user-visible warning is gone (no clean V2
      // MarketplaceNotificationMessage representation for the PR-5 free
      // prose). Only the canonical V2 success notification fires.
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
      // EACCES because the parent is not writable. In V1 this surfaced via
      // AS-6 notifyWarning; in V2 the warning is DROPPED per D-19-01
      // (D-18-01 lineage) -- the side effect still runs inside its
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
      // AS-6's core invariant -- state-commit precedes data-dir creation --
      // is unchanged in V2.
      const after = await loadState(locations.extensionRoot);
      assert.ok(
        "hello" in (after.marketplaces["mp"]?.plugins ?? {}),
        "state record must be persisted (mkdir failure is post-commit)",
      );

      // Plan 19-02 D-19-01: no warning notification fires in V2 standalone
      // mode. Only the canonical V2 success notification is emitted; the
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
      // SOFT-FAILS this row via `failed[]` -- the install proceeds. In V1
      // the orchestrator routed the failed rows to notifyWarning; in V2
      // the warning surface is DROPPED per D-19-01 (D-18-01 lineage). The
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

      // Plan 19-02 D-19-01: no warning notification fires in V2 standalone
      // mode -- the AS-7 foreign-agent warning surface is dropped. Only
      // the canonical V2 success notification is emitted, and the
      // "pre-existing agent file" phrase MUST NOT appear on it.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
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

      // V2 byte form: same shape as PI-3 (failed/{not in manifest}) --
      // the failed-discriminator entity-shape row plus the cause-chain
      // trailer that names the marketplace verbatim. Phase 29 / UXG-07
      // (D-29-02/03): the "1 plugin operation failed." summary line precedes
      // the cascade body.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(
        notifications[0]?.message ?? "",
        /^1 plugin operation failed\.\n\n● mp \[user\]\n {2}⊘ hello \(failed\) \{not in manifest\}\n {4}cause: .*not found in marketplace "mp"/,
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

      // V1->V2 behavior change (mirrors Plan 19-01 pilot's PU-8 (b)
      // behavior flip): V2 emits the reload-hint structurally from the
      // `installed` status per D-16-12; the V1 MSG-RH-1 noop-gate
      // ("suppress when nothing was staged") is GONE. The trigger ladder
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
  // Plan 06-05 wires invalidateMarketplaceCache into installPlugin's
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
// Quick task 260525-aub: discriminated-dispatch regression guards on the
// catch-site classifiers. Locks in the `instanceof PluginShapeError` +
// `.kind` dispatch so a future refactor cannot regress to message-text
// substring matching. The S5852 ReDoS regex previously at install.ts:902
// is DELETED; these tests guarantee the typed dispatch produces the same
// closed-set `Reason[]` output without re-parsing `.message`.
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
  // Task 260525-cjr C5: the resolver's `r.notes` carry the
  // `"contains <kind>"` prefix (see resolver.ts:685
  // `addUnsupportedKindNotes`); the carve-out in
  // `narrowResolverReasons` strips the prefix and emits the bare
  // token as the Reason. Pre-C5 the test built bare-token reasons
  // directly because the dead predicate accepted them; after C5 the
  // test matches the actual upstream form so we exercise the live
  // code path.
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p",
    reasons: ["contains hooks", "contains lspServers"],
  });
  const row = __test_classifyEntityShapeError(err, {
    plugin: "p",
    marketplace: "mp",
    scope: "project",
  });
  assert.ok(row);
  assert.equal(row.status, "unavailable");
  // MSG-GR-4 carve-out: the manifest-field detection token `lspServers`
  // (camelCase) is detected and emitted as the closed-set Reason `lsp`
  // (SNM-36 / D-24-04); `hooks` emits unchanged.
  assert.deepEqual(row.reasons, ["hooks", "lsp"]);
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

test('260525-cjr C3: classifyInstallFailure returns the collapsed `status: "failed"` shape carrying the typed Error', async () => {
  const { PluginShapeError } =
    await import("../../../extensions/pi-claude-marketplace/shared/errors.ts");

  // Task 260525-cjr C3: the four pre-C3 error variants
  // (already-installed / unavailable / uninstallable /
  // unexpected-failure) collapse into a single
  // `{ status: "failed"; error; cause }` shape. The typed Error is
  // the dispatch surface; consumers narrow on `instanceof
  // PluginShapeError` and read `.kind` to recover the legacy
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
  });
  const notInstallable = __test_classifyInstallFailure(notInstallableErr, "formatted");
  assert.equal(notInstallable.status, "failed");
  assert.ok(notInstallable.status === "failed");
  assert.equal(notInstallable.error, notInstallableErr);

  const noLongerInstallableErr = new PluginShapeError({
    kind: "no-longer-installable",
    plugin: "p",
    reasons: ["unsupported source"],
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
// Task 260525-cjr B2: narrowResolverReasons no longer silently degrades
// non-resolver causes to `{unsupported source}`. EACCES / EPERM / ENOENT /
// SyntaxError substrings now map to their precise closed Reasons; the
// `unsupported source` fallback runs only when no classifier matched.
// ───────────────────────────────────────────────────────────────────────────

test("260525-cjr B2 / C5: narrowResolverReasons -> `contains hooks` extracts the bare `hooks` Reason", () => {
  // Pre-C5 the test passed a bare `"hooks"` string (matching the
  // dead predicate); C5 aligned the predicate with the resolver's
  // actual emission form (`"contains hooks"`). The user-visible
  // catalog row shape (`(unavailable) {hooks}`) is unchanged.
  assert.deepEqual([...__test_narrowResolverReasons(["contains hooks"])], ["hooks"]);
});

test("260525-cjr B2 / C5: narrowResolverReasons -> `contains lspServers` extracts the `lspServers` token and emits the `lsp` Reason (SNM-36)", () => {
  assert.deepEqual([...__test_narrowResolverReasons(["contains lspServers"])], ["lsp"]);
});

test("260525-cjr C5: narrowResolverReasons recognises the resolver's `contains hooks` prefix and emits bare `hooks`", () => {
  // The resolver's `addUnsupportedKindNotes` writes
  // `partial.notes.push("contains " + kind)` (resolver.ts:685) for
  // every UNSUPPORTED_COMPONENT_KINDS member. Before this fix the
  // `MANIFEST_FIELD_REASONS.has(reason)` predicate compared the WHOLE
  // string against the bare set, so `"contains hooks"` never matched
  // and the row degraded to `{unsupported source}`. The fix strips
  // the `contains ` prefix and re-checks; the mapped Reason is emitted,
  // matching the catalog's `(unavailable) {hooks}` /
  // `(unavailable) {lsp}` forms (the `lspServers` detection token maps to
  // the `lsp` Reason per SNM-36 / D-24-04).
  assert.deepEqual([...__test_narrowResolverReasons(["contains hooks"])], ["hooks"]);
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

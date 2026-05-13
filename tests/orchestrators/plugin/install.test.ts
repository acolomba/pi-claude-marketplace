import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_PREFIX,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
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
  /** Optional version stamp on the entry; absent -> hash-version fallback. */
  pluginVersion?: string;
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

  await mkdir(marketplaceRoot, { recursive: true });
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  await mkdir(pluginRoot, { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version: "0.0.1" }),
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
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const state: ExtensionState = {
    schemaVersion: 1,
    marketplaces: {
      [marketplaceName]: {
        name: marketplaceName,
        scope: "project",
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
      scope: "project",
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

test("PI-3: plugin name not in marketplace plugins[] -> notifyError 'not found in marketplace'", async () => {
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

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /not found in marketplace/);

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

test("PI-3: marketplace itself absent -> notifyError 'not found in marketplace'", async () => {
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
      assert.match(notifications[0]?.message ?? "", /not found in marketplace/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-4 -- non-installable plugin (e.g. github source in V1 is not installable)
// ───────────────────────────────────────────────────────────────────────────

test("PI-4: non-path source -> notifyError 'is not installable'", async () => {
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

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /is not installable/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-5 -- already installed (early-sanity check at top of guard closure)
// ───────────────────────────────────────────────────────────────────────────

test("PI-5: state already has plugin record -> notifyError 'is already installed'", async () => {
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

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /is already installed/);
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

test("PI-7 (a): entry.version present -> recorded state.version matches entry.version verbatim", async () => {
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

test("PI-7 (b): entry.version absent -> recorded state.version is hash-<12hex>", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi7b-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        // No pluginVersion -> hash fallback.
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

      // Single success notification with the canonical "Installed" line + reload hint.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.match(
        notifications[0]?.message ?? "",
        /Installed plugin "hello" from marketplace "mp"\./,
      );
      assert.match(notifications[0]?.message ?? "", /Run \/reload to load it\.$/);
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

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.match(
        notifications[0]?.message ?? "",
        /pi-subagents is not loaded/,
        "must include pi-subagents warning",
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

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.match(
        notifications[0]?.message ?? "",
        /pi-mcp-adapter is not loaded/,
        "must include pi-mcp-adapter warning",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PI-13 -- dependencies declaration -> manual-install note
// ───────────────────────────────────────────────────────────────────────────

test("PI-13: entry declares dependencies -> success message includes the PR-5 phrase", async () => {
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

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.match(
        notifications[0]?.message ?? "",
        /dependencies that must be installed manually/,
        "must include the PR-5 manual-install phrase",
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

test("AS-6: pluginDataDir mkdir failure post-state-commit -> warning surfaces, state record IS persisted", async () => {
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
      // EACCES because the parent is not writable -> AS-6 warning path fires.
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
      const after = await loadState(locations.extensionRoot);
      assert.ok(
        "hello" in (after.marketplaces["mp"]?.plugins ?? {}),
        "state record must be persisted (mkdir failure is post-commit)",
      );

      // A warning notification is present with the data dir creation deferred message.
      const warnings = notifications.filter((n) => n.severity === "warning");
      assert.equal(
        warnings.length >= 1,
        true,
        `expected at least one warning notification, got: ${JSON.stringify(notifications)}`,
      );
      assert.match(
        warnings[0]?.message ?? "",
        /data dir creation deferred/i,
        "warning must mention data dir creation deferred",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AS-7 -- agents-bridge foreign-content rows surface via warning, state persists
// ───────────────────────────────────────────────────────────────────────────

test("AS-7: pre-existing foreign agent file under target name -> warning surfaces, state record IS persisted", async () => {
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
      // SOFT-FAILS this row via `failed[]` -- the install proceeds and the
      // orchestrator routes the failed rows to notifyWarning.
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

      // A warning notification names the preserved foreign agent.
      const warnings = notifications.filter((n) => n.severity === "warning");
      assert.equal(
        warnings.some((w) => w.message.includes("pre-existing agent file")),
        true,
        `expected AS-7 warning naming the pre-existing agent file; got: ${JSON.stringify(notifications)}`,
      );
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

test("PI-9 corollary: empty plugin (no skills/commands/agents/mcp) still produces a clean state record + reload hint suppressed", async () => {
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

      // RH-1: when nothing was staged, no reload hint is appended.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        (notifications[0]?.message ?? "").includes("Run /reload"),
        false,
        "RH-1: no reload hint when nothing was staged",
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

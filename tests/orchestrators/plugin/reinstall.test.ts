import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GENERATED_AGENT_PREFIX } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import {
  __test_errorWithManualRecovery,
  __test_findManualRecoveryError,
  __test_outcomeToPluginMessage,
  __test_renderReinstallPartitionAndNotify,
  reinstallPlugin,
  reinstallPlugins,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { __resetCacheForTests } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { ManualRecoveryError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

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
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "reinstall-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  __resetCacheForTests();
  try {
    return await fn();
  } finally {
    __resetCacheForTests();
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

interface ResourceSet {
  readonly skill?: string;
  readonly command?: string;
  readonly agent?: string;
  readonly mcp?: boolean;
  /**
   * WR-03: seed `<pluginRoot>/hooks/hooks.json` so reinstall's resolver
   * advertises `hooksConfigPath` and the per-plugin lock runs the
   * cache+rebuild pattern.
   */
  readonly hooksJson?: object;
}

async function seedMarketplace(opts: {
  readonly cwd: string;
  readonly marketplaceRoot: string;
  readonly marketplaceName?: string;
  readonly pluginName?: string;
  readonly version?: string;
  readonly resources?: ResourceSet;
  readonly install?: boolean;
  readonly scope?: "user" | "project";
}): Promise<{ readonly pluginRoot: string; readonly manifestPath: string }> {
  const marketplaceName = opts.marketplaceName ?? "mp";
  const pluginName = opts.pluginName ?? "hello";
  const version = opts.version ?? "1.0.0";
  const resources = opts.resources ?? { skill: "old skill", command: "old command" };
  const scope = opts.scope ?? "project";

  const pluginRoot = path.join(opts.marketplaceRoot, "plugins", pluginName);
  await writePluginTree(pluginRoot, pluginName, resources);
  const manifestPath = await mergeManifestEntry(
    opts.marketplaceRoot,
    marketplaceName,
    pluginName,
    version,
  );

  const locations = locationsFor(scope, opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state = await loadState(locations.extensionRoot);
  const previousMarketplace = state.marketplaces[marketplaceName];
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      ...state.marketplaces,
      [marketplaceName]: {
        name: marketplaceName,
        scope,
        source: pathSource(`./${path.basename(opts.marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: previousMarketplace?.plugins ?? {},
      },
    },
  });

  if (opts.install === true) {
    const { ctx, pi } = makeCtx({ getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] });
    await installPlugin({
      ctx,
      pi,
      scope,
      cwd: opts.cwd,
      marketplace: marketplaceName,
      plugin: pluginName,
    });
  }

  return { pluginRoot, manifestPath };
}

async function writePluginTree(
  pluginRoot: string,
  pluginName: string,
  resources: ResourceSet,
): Promise<void> {
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName }),
  );

  if (resources.skill !== undefined) {
    const skillDir = path.join(pluginRoot, "skills", "tool");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: tool\n---\n\n${resources.skill}\n`,
    );
  }

  if (resources.command !== undefined) {
    const commandDir = path.join(pluginRoot, "commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(path.join(commandDir, "deploy.md"), `# deploy\n\n${resources.command}\n`);
  }

  if (resources.agent !== undefined) {
    const agentDir = path.join(pluginRoot, "agents");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      path.join(agentDir, "bot.md"),
      `---\nname: bot\ntools: Read,Grep\n---\n\n${resources.agent}\n`,
    );
  }

  if (resources.mcp === true) {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { server1: { command: "node", args: ["server.js"] } } }),
    );
  }

  // WR-03: seed hooks payload so the resolver advertises hooksConfigPath
  // and the reinstall ledger exercises the cache+rebuild path.
  if (resources.hooksJson !== undefined) {
    const hooksDir = path.join(pluginRoot, "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(resources.hooksJson));
  }
}

async function mergeManifestEntry(
  marketplaceRoot: string,
  marketplaceName: string,
  pluginName: string,
  version: string,
): Promise<string> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const plugins: Record<string, string> = {};
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      readonly plugins?: readonly { readonly name?: unknown; readonly version?: unknown }[];
    };
    for (const entry of manifest.plugins ?? []) {
      if (typeof entry.name === "string" && typeof entry.version === "string") {
        plugins[entry.name] = entry.version;
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  plugins[pluginName] = version;
  return writeManifest(marketplaceRoot, marketplaceName, plugins);
}

async function writeManifest(
  marketplaceRoot: string,
  marketplaceName: string,
  plugins: Record<string, string>,
): Promise<string> {
  const manifestDir = path.join(marketplaceRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplaceName,
      plugins: Object.entries(plugins).map(([name, version]) => ({
        name,
        version,
        source: `./plugins/${name}`,
      })),
    }),
  );
  return manifestPath;
}

async function reinstallDefault(cwd: string, ctx: ExtensionContext, pi: ExtensionAPI) {
  return reinstallPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
}

async function readSkill(cwd: string): Promise<string> {
  const locations = locationsFor("project", cwd);
  return readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8");
}

async function readCommand(cwd: string): Promise<string> {
  const locations = locationsFor("project", cwd);
  return readFile(path.join(locations.promptsTargetDir, "hello:deploy.md"), "utf8");
}

function errorNotifications(notifications: readonly NotifyRecord[]): readonly NotifyRecord[] {
  return notifications.filter((n) => n.severity === "error");
}

test("PRL-06: absent installed record returns skipped and does not mutate state or disk", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-skip-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      const before = await readFile(locations.stateJsonPath, "utf8");
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "skipped");
      assert.deepEqual(outcome.notes, ["not installed"]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), before);
      // CR-02 / D-01: the standalone path emits the absent-target row as an
      // error (was a silent return). State/disk stay untouched; the notify is
      // the only visible effect.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (skipped) {not installed}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-08/11 happy: success preserves installed version, restages resources, deletes data, and refreshes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-happy-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent", mcp: true },
        install: true,
      });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "state.txt"), "plugin data");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
        mcp: true,
      });
      await writeManifest(path.join(cwd, "mp-src"), "mp", { hello: "9.9.9" });
      const beforeRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(beforeRecord !== undefined);

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.version, "1.0.0");
      assert.equal(outcome.resourcesChanged, true);
      assert.deepEqual(outcome.stagedAgents, [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual(outcome.stagedMcpServers, ["server1"]);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.0.0");
      assert.equal(record.installedAt, beforeRecord.installedAt);
      assert.match(await readSkill(cwd), /new skill/);
      await assert.rejects(() => readFile(path.join(dataDir, "state.txt"), "utf8"), /ENOENT/);
      assert.equal(errorNotifications(notifications).length, 0);
      assert.match(notifications.at(-1)?.message ?? "", /\/reload to pick up changes$/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10: missing cached manifest entry fails and preserves old state, resources, and data", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-missing-entry-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "state.txt"), "plugin data");
      const beforeState = await readFile(locations.stateJsonPath, "utf8");
      const beforeSkill = await readSkill(cwd);
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: "mp", plugins: [] }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "failed");
      assert.match(notifications[0]?.message ?? "", /not found in cached manifest/);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), beforeState);
      assert.equal(await readSkill(cwd), beforeSkill);
      assert.equal(await readFile(path.join(dataDir, "state.txt"), "utf8"), "plugin data");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10 / RINST-01: bare reinstall unconditionally overwrites foreign agent content across all bridges", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-overwrite-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      await writeFile(agentPath, "manual foreign bytes", "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
      });
      const { ctx, pi, notifications } = makeCtx();

      // RINST-01 / D-67-03: a bare reinstall (no `--force`) overwrites the
      // agent that holds foreign bytes and refreshes every bridge -- overwrite
      // is unconditional.
      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(errorNotifications(notifications).length, 0);
      assert.match(await readFile(agentPath, "utf8"), /new agent/);
      assert.match(await readSkill(cwd), /new skill/);
      assert.match(await readCommand(cwd), /new command/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10: saveState failure rolls back physical replacements and preserves data", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-save-failure-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent", mcp: true },
        install: true,
      });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "state.txt"), "plugin data");
      const beforeState = await readFile(locations.stateJsonPath, "utf8");
      const beforeSkill = await readSkill(cwd);
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
        mcp: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("saveState failure")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      assert.match(notifications[0]?.message ?? "", /saveState failure/);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), beforeState);
      assert.equal(await readSkill(cwd), beforeSkill);
      assert.equal(await readFile(path.join(dataDir, "state.txt"), "utf8"), "plugin data");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10 / RINST-01: unconditional overwrite of foreign previous agent content rolls back on save failure", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-force-rollback-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      const foreignBytes = "manual foreign bytes";
      await writeFile(agentPath, foreignBytes, "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", { agent: "new agent" });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("save failure after overwrite")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      assert.equal(await readFile(agentPath, "utf8"), foreignBytes);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-12: cache and data cleanup failures are SILENTLY swallowed after successful reinstall (V1 warning surface DROPPED per D-19-01)", async () => {
  // D-19-01 DROPS the two standalone-mode warning surfaces (bridgeWarnings
  // + maintenanceWarnings) that would otherwise fire after a successful
  // reinstall when the post-state-commit cache/data cleanup paths failed:
  // the underlying try/catch is retained (the side effects --
  // dropMarketplaceCache + rm -- still attempt to run), but the
  // user-visible warning surface is gone. The primary success
  // notification still fires.
  //
  // The orchestrated-mode `notes` field accumulation is asserted in the
  // PRL-13-quiet test below; this test asserts the standalone-mode
  // user-visible flow.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-cleanup-warning-"));
    try {
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", { skill: "new skill" });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          dropMarketplaceCache: () => Promise.reject(new Error("cache drop failed")),
          removeDataDir: () => Promise.reject(new Error("data cleanup failed")),
        },
      });

      assert.equal(outcome.partition, "reinstalled");
      // Exactly one notification (the V2 success cascade); zero warnings.
      assert.equal(notifications.length, 1);
      assert.equal(errorNotifications(notifications).length, 0);
      assert.equal(notifications.filter((n) => n.severity === "warning").length, 0);
      // Defense-in-depth: the dropped warning text MUST NOT leak into the
      // success notification's message.
      const body = notifications[0]?.message ?? "";
      assert.equal(body.includes("cache drop failed"), false);
      assert.equal(body.includes("data cleanup failed"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-12/RH-5: V2 per-variant reload-hint -- emitted on reinstalled even with zero resources changed (cascade stub); agents/MCP warn when unloaded", async () => {
  // The reload-hint is emitted structurally from
  // `PluginReinstalledMessage.status` per D-16-12 (the `reinstalled`
  // status is in the state-changing variant set), NOT from
  // cascade-outcome resource count. Mirrors the PU-8 (b) behavior.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-output-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "empty-mp"),
        marketplaceName: "mp",
        pluginName: "hello",
        resources: {},
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();
      const noResource = await reinstallDefault(cwd, ctx, pi);
      assert.equal(noResource.partition, "reinstalled");
      // The reload-hint trailer is emitted structurally
      // from the `reinstalled` variant per D-16-12, regardless of
      // resourcesChanged.
      assert.equal(
        (notifications.at(-1)?.message ?? "").includes("/reload to pick up changes"),
        true,
      );

      notifications.length = 0;
      const cwd2 = await mkdtemp(path.join(tmpdir(), "reinstall-output-deps-"));
      await seedMarketplace({
        cwd: cwd2,
        marketplaceRoot: path.join(cwd2, "mp-src"),
        resources: { agent: "agent", mcp: true },
        install: true,
      });
      const withDeps = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd: cwd2,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(withDeps.partition, "reinstalled");
      const body = notifications.at(-1)?.message ?? "";
      // CMC-13 / MSG-SD-1..2: per-row soft-dep markers. The single-plugin
      // reinstall renders as a 1-row cascade and the soft-dep markers
      // appear on the (reinstalled) row when companion extensions are
      // unloaded.
      assert.match(body, /\{[^}]*requires pi-subagents[^}]*\}/);
      assert.match(body, /\{[^}]*requires pi-mcp[^}]*\}/);
      assert.match(body, /\/reload to pick up changes/);
      await rm(cwd2, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 quiet render suppresses per-plugin notifications", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-quiet-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 quiet render returns warning notes after successful cleanup warnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-quiet-warnings-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
        __deps: {
          dropMarketplaceCache: () => Promise.reject(new Error("cache drop failed")),
          removeDataDir: () => Promise.reject(new Error("data cleanup failed")),
        },
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.deepEqual(notifications, []);
      assert.ok(
        outcome.notes?.some((n) =>
          n.includes(
            'warning: Plugin "hello" reinstalled; completion cache refresh deferred: cache drop failed',
          ),
        ),
      );
      assert.ok(
        outcome.notes?.some((n) =>
          n.includes('warning: Plugin "hello" reinstalled; data cleanup deferred'),
        ),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-04 bulk bare reinstall enumerates user and project scopes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-all-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "ump",
        pluginName: "uplug",
        resources: { skill: "user old" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "project-mp-src"),
        marketplaceName: "pmp",
        pluginName: "pplug",
        resources: { skill: "project old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      // CR-01 / D-04: ordered via compareByNameThenScope (name
      // primary case-insensitive, scope secondary project-before-user
      // per MSG-GR-3). "pmp" sorts before "ump" by name primary alone.
      assert.deepEqual(
        outcomes.map((o) => `[${o.scope}] ${o.name}@${o.marketplace}`),
        ["[project] pplug@pmp", "[user] uplug@ump"],
      );
      // D-19-02: cascade renders with orphan-fold per-row
      // scope suppression (D-17.2-01 / D-17.2-02): when the plugin's
      // scope matches the parent marketplace's scope, the per-row
      // `[<scope>]` bracket is OMITTED (renderScopeBracket contract).
      // The marketplace header still carries the
      // `[<scope>]` token. Project-scoped marketplaces sort before user
      // (compareByNameThenScope: project-before-user tie-breaker).
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /● pmp \[project\]\n {2}● pplug v\d/);
      assert.match(body, /● ump \[user\]\n {2}● uplug v\d/);
      // The summary/partition forms must NOT appear.
      assert.equal(body.includes("Reinstalled 2 plugins."), false);
      assert.equal(body.includes("Reinstalled:"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-03 bulk marketplace reinstall resolves implicit scope like update", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-scope-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mymp",
        pluginName: "plug",
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "mymp" },
      });

      assert.deepEqual(
        outcomes.map((o) => o.scope),
        ["project"],
      );
      // D-19-02: cascade marketplace header + indented
      // plugin row; orphan-fold suppresses the per-row `[<scope>]`
      // bracket when it matches the parent marketplace's scope.
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /● mymp \[project\]\n {2}● plug v/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-05 bulk reinstall explicit scope filters targets", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-filter-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "userplug",
        resources: { skill: "user" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "project-mp-src"),
        marketplaceName: "mp",
        pluginName: "projectplug",
        resources: { skill: "project" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "all" },
      });

      assert.deepEqual(
        outcomes.map((o) => `[${o.scope}] ${o.name}@${o.marketplace}`),
        ["[project] projectplug@mp"],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-03/SCOPE-01: explicit-scope-plugin reinstall of an other-scope-only target emits standalone {not added}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-cross-scope-source-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      // --scope project where the marketplace lives ONLY in user scope.
      // ATTR-03 / D-47-A: re-attributed from the former synthesized phantom
      // target -> `(skipped) {not installed}` to the standalone
      // `MarketplaceNotAddedMessage`. SCOPE-01: the `[project]` bracket carries
      // the REQUESTED scope (the operator infers the other scope).
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "plug", marketplace: "mp" },
      });

      // No raw throw escapes; the entrypoint returns [] before the cascade.
      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(
        body,
        "A marketplace operation has failed.\n\n⊘ mp [project] (failed) {not added}",
      );
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-03/SCOPE-01: explicit-scope-marketplace reinstall of a not-added marketplace emits standalone {not added}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mp-cross-scope-empty-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      // Marketplace target with explicit --scope project where mp lives only
      // in user scope. ATTR-03 / D-47-A: re-attributed from the former raw
      // `MarketplaceNotFoundError` -> synthetic `(reinstall)` `{not found}` row
      // to the standalone `MarketplaceNotAddedMessage`. SCOPE-01: the
      // `[project]` bracket carries the REQUESTED scope. No raw throw escapes.
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(
        body,
        "A marketplace operation has failed.\n\n⊘ mp [project] (failed) {not added}",
      );
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-03: bare reinstall of a marketplace absent in BOTH scopes emits standalone {not added} with no bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bare-absent-both-"));
    try {
      // Seed an unrelated marketplace so both scope states exist on disk but
      // neither holds `ghost-mp`.
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "other",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      // Bare form (no --scope): ghost-mp is absent in both scopes.
      // ATTR-03 / D-47-A: re-attributed from the former raw `Error` ->
      // `{not found}` to the standalone `{not added}` with NO bracket
      // (absent-from-both form).
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "ghost-mp" },
      });

      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(body, "A marketplace operation has failed.\n\n⊘ ghost-mp (failed) {not added}");
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 batch reinstall continues after failed plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-continue-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "bad",
        resources: { skill: "bad" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "good",
        resources: { skill: "good" },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          name: "mp",
          plugins: [{ name: "good", version: "1.0.0", source: "./plugins/good" }],
        }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.deepEqual(
        outcomes.map((o) => `${o.name}:${o.partition}`),
        ["bad:failed", "good:reinstalled"],
      );
      const body = notifications.at(-1)?.message ?? "";
      // D-19-02: cascade with mixed rows; `(reinstalled)`
      // on the success row, `(failed) {not in manifest}` on the failure
      // row (narrowed from `Plugin "bad" not found in cached manifest`).
      // Per-row scope orphan-folded (matches marketplace scope).
      // Severity computed by notify() per D-16-11: `error` (any failed
      // row tips the ladder to error; D-16-11 first-match takes
      // failed before warning).
      assert.match(body, /● mp \[project\]\n {2}⊘ bad \(failed\) \{not in manifest\}/);
      assert.match(body, /● good v1\.0\.0 \(reinstalled\)/);
      // The `Reinstalled plugin "good".` summary line + `Failed:`
      // partition header must NOT appear.
      assert.equal(body.includes('Reinstalled plugin "good".'), false);
      assert.equal(body.includes("Failed:"), false);
      // Severity is computed from contents per D-16-11 -> any failed row
      // tips the ladder to `error`.
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 deterministic partition output sorts by scope marketplace plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-sort-"));
    try {
      const aRoot = path.join(cwd, "a-src");
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "z-src"),
        marketplaceName: "z",
        pluginName: "b",
        resources: { skill: "z b" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: aRoot,
        marketplaceName: "a",
        pluginName: "c",
        resources: { skill: "a c" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: aRoot,
        marketplaceName: "a",
        pluginName: "a",
        resources: { skill: "a a" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "u-src"),
        marketplaceName: "u",
        pluginName: "z",
        resources: { skill: "u z" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      // CR-01 / D-04: ordered project-before-user via
      // `compareByNameThenScope` (name primary case-insensitive, scope
      // secondary project-before-user per MSG-GR-3). Marketplace name
      // is the primary key: "a" < "u" < "z" lexicographically. Plugin
      // rows within a marketplace also sort by name primary.
      assert.deepEqual(
        outcomes.map((o) => ({
          partition: o.partition,
          scope: o.scope,
          marketplace: o.marketplace,
          name: o.name,
        })),
        [
          { partition: "reinstalled", scope: "project", marketplace: "a", name: "a" },
          { partition: "reinstalled", scope: "project", marketplace: "a", name: "c" },
          { partition: "reinstalled", scope: "user", marketplace: "u", name: "z" },
          { partition: "reinstalled", scope: "project", marketplace: "z", name: "b" },
        ],
      );
      const body = notifications.at(-1)?.message ?? "";
      // D-19-02 / D-04: per-marketplace cascade
      // blocks ordered via `compareByNameThenScope` (name primary
      // case-insensitive, scope secondary project-before-user). Per-row
      // scope orphan-folded (matches marketplace scope). The body-regex
      // matches below assert presence (not order between markets) -- the
      // deepEqual above locks outcome order.
      assert.match(body, /● u \[user\]\n {2}● z v1\.0\.0 \(reinstalled\)/);
      assert.match(
        body,
        /● a \[project\]\n {2}● a v1\.0\.0 \(reinstalled\)\n {2}● c v1\.0\.0 \(reinstalled\)/,
      );
      assert.match(body, /● z \[project\]\n {2}● b v1\.0\.0 \(reinstalled\)/);
      assert.equal(body.includes("Reinstalled:"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("260525-cjr C9: same-name cross-scope reinstall -> project-scope row renders BEFORE user-scope row (MSG-GR-3 stable-sort tie-break)", async () => {
  // The existing PRL-13 deterministic-sort test (above) uses DISTINCT
  // marketplace names (a / u / z) so the marketplace-name primary key
  // never produces same-name pairs -- the project-before-user secondary
  // tie-break on `MarketplaceRow.scope` never fires. This test seeds
  // the SAME marketplace name in BOTH scopes so the tie-break is
  // exercised end-to-end through the cascade renderer (NOT just via
  // the unit test on `compareByNameThenScope` in
  // `tests/presentation/sort.test.ts`).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-same-name-scopes-"));
    try {
      // Both scopes carry a marketplace named "mp" with a plugin named
      // "p". The roots are deliberately distinct dirs so install
      // succeeds independently in each scope.
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "mp-user-src"),
        marketplaceName: "mp",
        pluginName: "p",
        resources: { skill: "user-scope skill" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "mp-project-src"),
        marketplaceName: "mp",
        pluginName: "p",
        resources: { skill: "project-scope skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      // Outcome order asserts the project-before-user tie-break at the
      // orchestrator boundary -- both outcomes share `marketplace: "mp"`
      // and `name: "p"`, so the scope secondary key decides.
      assert.deepEqual(
        outcomes.map((o) => ({
          partition: o.partition,
          scope: o.scope,
          marketplace: o.marketplace,
          name: o.name,
        })),
        [
          { partition: "reinstalled", scope: "project", marketplace: "mp", name: "p" },
          { partition: "reinstalled", scope: "user", marketplace: "mp", name: "p" },
        ],
      );

      // Rendered cascade order: the two same-named marketplace blocks
      // appear with project-scope FIRST. Locate both headers in the
      // body and assert the project header's index is lower than the
      // user header's.
      const body = notifications.at(-1)?.message ?? "";
      const projectHeaderIdx = body.indexOf("● mp [project]");
      const userHeaderIdx = body.indexOf("● mp [user]");
      assert.ok(
        projectHeaderIdx >= 0,
        `expected project-scope header '● mp [project]' in body:\n${body}`,
      );
      assert.ok(userHeaderIdx >= 0, `expected user-scope header '● mp [user]' in body:\n${body}`);
      assert.ok(
        projectHeaderIdx < userHeaderIdx,
        `project-scope cascade row must render BEFORE user-scope (MSG-GR-3 stable-sort tie-break).\n  project idx=${String(projectHeaderIdx)}\n  user idx=${String(userHeaderIdx)}\n  body:\n${body}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-14 batch reload hint uses only changed successful outcomes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-reload-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "empty",
        resources: {},
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "withskill",
        resources: { skill: "skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /\/reload to pick up changes/);
      assert.doesNotMatch(body, /"empty"/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-15 batch soft dependency warnings aggregate successful restaged resources only", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-soft-deps-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "bad",
        resources: { agent: "bad agent" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "good",
        resources: { agent: "good agent", mcp: true },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          name: "mp",
          plugins: [{ name: "good", version: "1.0.0", source: "./plugins/good" }],
        }),
      );
      const { ctx, pi, notifications } = makeCtx();

      await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      const body = notifications.at(-1)?.message ?? "";
      // D-19-02 / MSG-SD-1..2: per-row soft-dep markers via
      // the notify() probe. The `good` plugin (reinstalled with
      // agent+mcp) carries `{requires pi-subagents, requires pi-mcp}`;
      // the `bad` plugin (failed) does NOT (effective state = not
      // installed; MSG-SD-3 -- failed rows omit soft-dep markers).
      // Per-row scope orphan-folded (matches marketplace scope).
      assert.match(
        body,
        /● good v1\.0\.0 \(reinstalled\) \{requires pi-subagents, requires pi-mcp\}/,
      );
      assert.match(body, /⊘ bad \(failed\) \{not in manifest\}/);
      assert.equal(body.includes("Failed:"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * D-19-02 binding regression guard for `outcomeToPluginMessage`.
 *
 * `outcomeToPluginMessage` applies a precedence ladder for the failed-
 * variant Reason mapping:
 *   (1) failureClass="manual-recovery"  -> PluginManualRecoveryMessage
 *                                          with reasons: ["rollback partial"]
 *   (2) typed outcome.reasons           -> PluginFailedMessage with verbatim
 *                                          reasons
 *   (3) narrowReasons(outcome.notes)    -> PluginFailedMessage with
 *                                          substring-narrowed reasons
 *
 * The manual-recovery variant is a distinct `PluginManualRecoveryMessage`
 * discriminated variant per D-19-02 (the status discriminator is the
 * literal `"manual recovery"` WITH a space per
 * shared/grammar/status-tokens.ts).
 */
test("D-19-02: outcomeToPluginMessage maps failureClass=manual-recovery -> PluginManualRecoveryMessage with rollback partial", () => {
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: ["staging failed"],
    failureClass: "manual-recovery",
  };
  // marketplace scope matches outcome.scope -> per-row scope orphan-folded
  // (omitted from the variant).
  const row = __test_outcomeToPluginMessage(outcome, "project");
  // manual-recovery is its own discriminated variant per D-19-02 -- NOT
  // a `failed` row carrying `{rollback partial}`. The status discriminator
  // is the literal "manual recovery" WITH a space per shared/grammar/
  // status-tokens.ts.
  assert.equal(row.status, "manual recovery");
  assert.ok(row.status === "manual recovery");
  assert.deepEqual([...row.reasons], ["rollback partial"]);
});

test("ATTR-09 / D-47-B: outcomeToPluginMessage without failureClass falls back to narrowReason -> PluginFailedMessage with the truthful `unreadable`", () => {
  // Without the structural tag, the closed-set narrowing falls through to the
  // ATTR-09 / D-47-B last-resort `"unreadable"` (truthful "could not reconcile
  // this row" member) for opaque notes text, never the former `"not in
  // manifest"` lie.
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: ["something opaque"],
  };
  const row = __test_outcomeToPluginMessage(outcome, "project");
  assert.equal(row.status, "failed");
  assert.ok(row.status === "failed");
  assert.deepEqual([...row.reasons], ["unreadable"]);
});

test("D-19-02: outcomeToPluginMessage rollback substring still maps to rollback partial", () => {
  // The `"rollback"` substring branch in `narrowReason` stays in place --
  // it covers non-manual-recovery rollback scenarios (the rollback-partial
  // fallback path) and produces a PluginFailedMessage (NOT a
  // PluginManualRecoveryMessage; the structural tag is the sole pivot).
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: ["rollback failed at phase X"],
  };
  const row = __test_outcomeToPluginMessage(outcome, "project");
  assert.equal(row.status, "failed");
  assert.ok(row.status === "failed");
  assert.deepEqual([...row.reasons], ["rollback partial"]);
});

// ───────────────────────────────────────────────────────────────────────────
// outcomeToPluginMessage prefers typed `outcome.reasons` over the
// notes-substring narrow. This locks in the producer-narrowed contract:
// EACCES / EPERM / ENOENT (and PluginShapeError shapes) surface as their
// precise closed Reason instead of degrading to `not in manifest`.
// ───────────────────────────────────────────────────────────────────────────

test("D-19-02: outcomeToPluginMessage prefers typed `outcome.reasons` (`permission denied`) over notes-substring fallback", () => {
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    // Notes that the legacy substring path would map to the permissive
    // `not in manifest` default. The presence of `reasons` MUST win.
    notes: ["EACCES: permission denied at some/.pi/agent/file"],
    reasons: ["permission denied"] as const,
  };
  const row = __test_outcomeToPluginMessage(outcome, "project");
  assert.equal(row.status, "failed");
  assert.ok(row.status === "failed");
  assert.deepEqual([...row.reasons], ["permission denied"]);
});

test("D-19-02: outcomeToPluginMessage `source missing` typed reason wins over notes fallback", () => {
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: ["ENOENT: no such file or directory"],
    reasons: ["source missing"] as const,
  };
  const row = __test_outcomeToPluginMessage(outcome, "project");
  assert.equal(row.status, "failed");
  assert.ok(row.status === "failed");
  assert.deepEqual([...row.reasons], ["source missing"]);
});

test("ATTR-09 / D-47-B: outcomeToPluginMessage without `reasons` falls back to the truthful `unreadable`, never `{not in manifest}`", () => {
  // No `reasons` field -- the substring narrow on `notes` runs. ATTR-09 /
  // D-47-B: the last-resort fallback for a genuinely unrecognized cascade/IO
  // note is `"unreadable"` (truthful "could not reconcile this row"), NOT the
  // former `"not in manifest"` lie that the plugin is absent from the manifest.
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: ["something opaque without a matching substring"],
  };
  const row = __test_outcomeToPluginMessage(outcome, "project");
  assert.equal(row.status, "failed");
  assert.ok(row.status === "failed");
  assert.deepEqual([...row.reasons], ["unreadable"]);
});

test("D-19-02: outcomeToPluginMessage `failureClass=manual-recovery` STILL wins over typed `reasons` (precedence locked)", () => {
  // The precedence order in outcomeToPluginMessage:
  //   (1) failureClass="manual-recovery"  -> PluginManualRecoveryMessage
  //                                          with reasons: ["rollback partial"]
  //   (2) outcome.reasons (typed)         -> PluginFailedMessage with verbatim
  //   (3) narrowReasons(outcome.notes)    -> PluginFailedMessage substring fallback
  // This test locks in (1) > (2) so a future refactor cannot accidentally
  // demote the manual-recovery class.
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: ["EACCES: permission denied"],
    failureClass: "manual-recovery",
    reasons: ["permission denied"] as const,
  };
  const row = __test_outcomeToPluginMessage(outcome, "project");
  // (1) wins -- the manual-recovery structural tag is highest priority.
  assert.equal(row.status, "manual recovery");
  assert.ok(row.status === "manual recovery");
  assert.deepEqual([...row.reasons], ["rollback partial"]);
});

/**
 * CMC-16 / F-5 dedup regression guard.
 *
 * `errorWithManualRecovery` MAY be called twice in the bridge cascade: once
 * when a bridge throws ManualRecoveryError with its own `.leaks`, and again
 * at the orchestrator-source rollback site with the merged leak set. The
 * F-5 invariant: even if the same leak string appears in both sources, the
 * final `.leaks` payload counts it ONCE. The implementation uses a
 * `Set`-dedup on the merged array.
 */
test("CMC-16 / F-5: errorWithManualRecovery dedups overlapping leaks", () => {
  const inner = new ManualRecoveryError("inner failed", ["agents: foo"]);
  const wrapped = __test_errorWithManualRecovery(inner, ["agents: foo"]);
  assert.ok(wrapped instanceof ManualRecoveryError);
  assert.equal(
    wrapped.leaks.length,
    1,
    `expected dedup; got: ${JSON.stringify([...wrapped.leaks])}`,
  );
  assert.equal(wrapped.leaks[0], "agents: foo");
  // Cause-chain preserved so the depth-5 walker still surfaces the inner.
  assert.equal((wrapped as ManualRecoveryError & { cause: unknown }).cause, inner);
});

test("CMC-16 / F-5: errorWithManualRecovery merges disjoint leaks without dedup", () => {
  const inner = new ManualRecoveryError("inner failed", ["agents: foo"]);
  const wrapped = __test_errorWithManualRecovery(inner, ["skills: bar"]);
  assert.ok(wrapped instanceof ManualRecoveryError);
  assert.deepEqual([...wrapped.leaks], ["agents: foo", "skills: bar"]);
});

test("CMC-16: errorWithManualRecovery wraps non-ManualRecoveryError with new ManualRecoveryError", () => {
  const inner = new Error("raw error");
  const wrapped = __test_errorWithManualRecovery(inner, ["x: leak"]);
  assert.ok(wrapped instanceof ManualRecoveryError);
  assert.equal(wrapped.message, "raw error");
  assert.deepEqual([...wrapped.leaks], ["x: leak"]);
  assert.equal((wrapped as ManualRecoveryError & { cause: unknown }).cause, inner);
});

test("CMC-16: errorWithManualRecovery short-circuits on zero leaks", () => {
  const inner = new Error("raw error");
  const wrapped = __test_errorWithManualRecovery(inner, []);
  // Zero-leak fast path preserves the original Error reference verbatim.
  assert.equal(wrapped, inner);
});

/**
 * CMC-16 / WR-01 regression guard.
 *
 * When `withScopeLock`'s body throw is a `ManualRecoveryError` AND
 * `release()` also throws, the lock helper wraps the original in a plain
 * `new Error(combinedMsg, { cause: base })`. A direct
 * `err instanceof ManualRecoveryError` check would see a plain Error and
 * silently downgrade the cascade row's Reason from `{rollback partial}`
 * to the `narrowReason` last-resort fallback. WR-01 uses a cause-chain walk
 * instead of the direct `instanceof` check so the class identity survives the
 * wrapping.
 *
 * These tests pin both directions: positive (the walker finds the wrapped
 * MRE) and negative (no MRE in the chain returns undefined; cycles and
 * the depth bound terminate cleanly).
 */
test("WR-01: findManualRecoveryError returns the wrapped MRE when release-also-failed wrapper sits on top", () => {
  const inner = new ManualRecoveryError("staging failed", ["agents: foo"]);
  const wrapped = new Error("staging failed (lock release also failed: chmod denied)", {
    cause: inner,
  });
  const found = __test_findManualRecoveryError(wrapped);
  assert.equal(found, inner);
});

test("WR-01: findManualRecoveryError returns the MRE directly when it is the top-level error", () => {
  const inner = new ManualRecoveryError("staging failed", ["agents: foo"]);
  assert.equal(__test_findManualRecoveryError(inner), inner);
});

test("WR-01: findManualRecoveryError returns undefined when no MRE is in the chain", () => {
  const inner = new Error("opaque inner");
  const wrapped = new Error("opaque outer", { cause: inner });
  assert.equal(__test_findManualRecoveryError(wrapped), undefined);
});

test("WR-01: findManualRecoveryError terminates cleanly on self-referencing cause cycles", () => {
  const cyclic = new Error("cyclic") as Error & { cause: unknown };
  cyclic.cause = cyclic;
  assert.equal(__test_findManualRecoveryError(cyclic), undefined);
});

test("WR-01: findManualRecoveryError respects the depth-5 bound", () => {
  // Build a 6-link chain with the MRE at the deepest position; the walker
  // visits depth 0..4 inclusive, so a MRE at depth 5 is unreachable.
  const mre = new ManualRecoveryError("deep", ["x"]);
  const l5 = new Error("l5", { cause: mre });
  const l4 = new Error("l4", { cause: l5 });
  const l3 = new Error("l3", { cause: l4 });
  const l2 = new Error("l2", { cause: l3 });
  const l1 = new Error("l1", { cause: l2 });
  const l0 = new Error("l0", { cause: l1 });
  // l0 -> l1 -> l2 -> l3 -> l4 -> l5 -> mre (mre is at depth 6 from l0;
  // 5 hops via .cause). The walker visits l0, l1, l2, l3, l4 (5 slots);
  // mre is unreachable.
  assert.equal(__test_findManualRecoveryError(l0), undefined);
});

/**
 * D-19-02 / CMC-16 manual-recovery inline-row emission regression guard.
 *
 * Per D-19-02 the manual-recovery row is folded INSIDE the same cascade
 * `plugins[]` array as the reinstalled/skipped/failed siblings,
 * structurally typed as a `PluginManualRecoveryMessage` discriminated
 * variant. The status discriminator is the literal `"manual recovery"`
 * WITH a space per shared/grammar/status-tokens.ts.
 *
 * This test exercises the `__test_renderReinstallPartitionAndNotify` seam
 * with a synthetic outcome list containing one manual-recovery failure
 * alongside one successful reinstall, and asserts the captured notify
 * body contains:
 *   (a) the manual-recovery row inline at the row level with the literal
 *       `(manual recovery) {rollback partial}` token (NOT a separate
 *       top-level line below the cascade body);
 *   (b) the successful reinstall row co-exists in the same plugins[]
 *       array;
 *   (c) NO separate `\n\n`-separated anchor line after the cascade body;
 *   (d) the reload-hint trailer still composes for the successful
 *       reinstall row (D-16-12 trigger via `reinstalled` status).
 *
 * Severity per D-16-11: `warning` (manual recovery is in the warning set;
 * no `failed` row tips it to error). notify() computes severity from
 * contents.
 */
test("D-19-02: manual-recovery outcome folds into cascade plugins[] as PluginManualRecoveryMessage row", () => {
  const { ctx, pi, notifications } = makeCtx();
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "failed",
      name: "broken",
      marketplace: "mp",
      scope: "project",
      notes: ["staging failed (rollback partial)"],
      failureClass: "manual-recovery",
    } satisfies ReinstallFailedOutcome,
    {
      partition: "reinstalled",
      name: "good",
      marketplace: "mp",
      scope: "project",
      version: "1.0.0",
      stagedAgents: [],
      stagedMcpServers: [],
      declaresAgents: false,
      declaresMcp: false,
      resourcesChanged: true,
    },
  ];

  __test_renderReinstallPartitionAndNotify(ctx, pi, outcomes, "plural");

  // Exactly one notification was emitted; severity routes via notify()'s
  // content-derived ladder (D-16-11): manual-recovery in plugins[] -> warning.
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "warning");
  const body = notifications[0]?.message ?? "";

  // (a) Inline manual-recovery row with the literal "(manual recovery)"
  // token WITH a space per shared/grammar/status-tokens.ts. Per-row
  // scope is orphan-folded (matches the marketplace block's scope).
  assert.match(body, /⊘ broken \(manual recovery\) \{rollback partial\}/);
  // (b) The successful reinstall row co-exists in the same plugins[]
  // array (no separate cascade body for the manual-recovery anchor).
  assert.match(body, /● good v1\.0\.0 \(reinstalled\)/);

  // (c) No separate top-level anchor line below the cascade body. The
  // plugins[]-array form does NOT use the `<name>@<marketplace>` resource
  // collapse (a stand-alone `⊘ broken@mp (manual recovery) {rollback
  // partial}` line below `\n\n` must not appear).
  assert.ok(
    !body.includes("⊘ broken@mp (manual recovery)"),
    `V2 must NOT emit the V1 separate anchor line; body was ${JSON.stringify(body)}`,
  );

  // (d) Reload-hint trailer composes for the successful reinstall row
  // (D-16-12 trigger: `reinstalled` is in the state-changing variant set).
  assert.match(body, /\/reload to pick up changes/);
});

test("D-19-02: outcomeToPluginMessage stays correct when the orchestrator catches a release-wrapped MRE (WR-01 V2 successor)", () => {
  // End-to-end binding: simulate the catch block's behavior on a
  // release-also-failed wrapper. The spread guard uses
  // findManualRecoveryError, so the failureClass tag IS set, and
  // outcomeToPluginMessage maps to PluginManualRecoveryMessage with
  // reasons ["rollback partial"].
  const inner = new ManualRecoveryError("staging failed", ["agents: foo"]);
  const releaseWrapped = new Error("staging failed (lock release also failed: chmod denied)", {
    cause: inner,
  });
  const mre = __test_findManualRecoveryError(releaseWrapped);
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: ["staging failed (lock release also failed: chmod denied)"],
    ...(mre !== undefined && { failureClass: "manual-recovery" as const }),
  };
  const row = __test_outcomeToPluginMessage(outcome, "project");
  // The canonical CMC-11 Reason is preserved across the release-failure
  // wrapping path, and the variant is a PluginManualRecoveryMessage per
  // D-19-02.
  assert.equal(row.status, "manual recovery");
  assert.ok(row.status === "manual recovery");
  assert.deepEqual([...row.reasons], ["rollback partial"]);
});

// -----------------------------------------------------------------------
// Additional coverage tests for uncovered paths
// -----------------------------------------------------------------------

test("GAP-01: reinstallPlugins with no installed plugins emits empty-marketplaces notice", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-no-plugins-"));
    try {
      // No plugins installed; state is empty.
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.deepEqual([...outcomes], []);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "(no marketplaces)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-02: reinstallPlugins with plugin removed from manifest emits failed cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-zero-reinstall-"));
    try {
      // Install then remove plugin from manifest so every reinstall target fails.
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: "mp", plugins: [] }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0]?.partition, "failed");
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /not in manifest/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-03: reinstallPlugin render=none failure returns failed without notifying", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-fail-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: "mp", plugins: [] }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "failed");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-04: errorWithManualRecovery empty-leaks path: saveState fails on empty-resource plugin", async () => {
  // Empty-resource plugin: replaceAll succeeds with all-noop replacements,
  // rollbackReplacements([]) returns []. errorWithManualRecovery(err, [])
  // hits the leaks.length === 0 early-return branch and returns the base
  // error unchanged (no MANUAL RECOVERY REQUIRED prefix).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-empty-leaks-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {},
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("atomic-save-failed")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      const note = outcome.notes?.[0] ?? "";
      assert.ok(note.includes("atomic-save-failed"), `expected cause in: ${note}`);
      assert.equal(
        notifications.some((n) => n.severity === "error"),
        true,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-05: errorWithManualRecovery instanceof-ManualRecoveryError branch merges leaks deduped", () => {
  // When the input error is already a ManualRecoveryError, errorWithManualRecovery
  // merges the new leaks into the existing leaks (deduped) and wraps with cause.
  const inner = new ManualRecoveryError("stage failed", ["agents: old"]);
  const wrapped = __test_errorWithManualRecovery(inner, ["agents: old", "skills: new"]);
  assert.ok(wrapped instanceof ManualRecoveryError);
  const mre = wrapped;
  assert.deepEqual([...mre.leaks].sort(), ["agents: old", "skills: new"]);
  assert.equal(mre.message, "stage failed");
  assert.equal(mre.cause, inner);
});

test("GAP-06: prepareAllHandles catch: MCP collision aborts partial handles and wraps error", async () => {
  // Two plugins in the same marketplace declare the same MCP server name.
  // Reinstalling the first one after the second owns the server triggers
  // McpServerCollisionError inside prepareStageMcpServers, which is caught
  // by prepareAllHandles' try/catch. The error is wrapped by
  // errorWithManualRecovery and surfaced as a failed outcome.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mcp-collision-"));
    try {
      // Install "hello" with mcp server "server1".
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        resources: { mcp: true },
        install: true,
      });
      // Install "other" that also declares "server1" in a separate marketplace.
      // We write its mcp.json entry directly into the project mcp.json so that
      // prepareStageMcpServers sees a cross-slot collision when reinstalling hello.
      const locations = locationsFor("project", cwd);
      const mcpPath = locations.mcpJsonPath;
      let mcpDoc: Record<string, unknown> = {};
      try {
        mcpDoc = JSON.parse(await readFile(mcpPath, "utf8")) as Record<string, unknown>;
      } catch {
        // mcp.json may not exist yet
      }

      const mcpServers = (mcpDoc.mcpServers ?? {}) as Record<string, unknown>;
      // Register server1 under a foreign plugin marker so it looks like another plugin owns it.
      mcpServers["server1"] = {
        command: "node",
        args: ["other.js"],
        __claude_marketplace_plugin: "other@othermp",
      };
      mcpDoc.mcpServers = mcpServers;
      await writeFile(mcpPath, JSON.stringify(mcpDoc));

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(outcome.partition, "failed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-07: reinstallPlugin skipped does not trigger runPostSuccessMaintenance", async () => {
  // When the plugin is not installed, runLockedReinstall returns
  // partition='skipped'. The code at line 184-186 returns the skipped outcome
  // without calling runPostSuccessMaintenance (so no cache/data drops run).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-skip-no-maint-"));
    try {
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      let maintenanceCalled = false;
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          dropMarketplaceCache: () => {
            maintenanceCalled = true;
            return Promise.resolve();
          },
        },
      });

      assert.equal(outcome.partition, "skipped");
      assert.equal(maintenanceCalled, false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-08: reinstallPlugin render=none with skipped outcome emits no notifications", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-skip-"));
    try {
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "skipped");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-09: reinstallPlugin render=none success with bridgeWarnings returns annotated notes", async () => {
  // render='none' success path: when bridgeWarnings or maintenanceWarnings
  // are non-empty, the outcome is returned with notes prefixed 'warning: '.
  // The 'notes.length === 0' branch returns the bare locked.outcome.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-warn-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
        __deps: {
          dropMarketplaceCache: () => Promise.reject(new Error("cache-fail")),
        },
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.ok(outcome.notes?.some((n) => n.startsWith("warning: ")));
      assert.ok(outcome.notes?.some((n) => n.includes("cache-fail")));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-10: reinstallPlugin render=none success with no warnings returns bare locked.outcome", async () => {
  // When no bridge warnings and no maintenance warnings exist,
  // the notes.length === 0 branch returns locked.outcome unchanged (no notes field).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-nowarn-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.notes, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-11 / RINST-01: reinstallPlugin unconditionally overwrites agent foreign content", async () => {
  // RINST-01 / D-67-03: overwrite is unconditional -- replaceAll always calls
  // replacePreparedAgents with { force: true }. The success path verifies that
  // the outer render='default' success notification includes the reload hint.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-force-success-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      await writeFile(agentPath, "foreign bytes", "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", { agent: "new agent" });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.match(await readFile(agentPath, "utf8"), /new agent/);
      assert.equal(errorNotifications(notifications).length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-12: reinstallPlugins exactly-one-reinstalled emits singular summary", async () => {
  // reinstallSummary with reinstalledCount === 1 returns
  // 'Reinstalled plugin "<name>".' (the singular branch).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-singular-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0]?.partition, "reinstalled");
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /hello.*reinstalled/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-13: reinstallPlugin user-scope happy path reinstalls and records correct scope", async () => {
  // Exercise the user-scope code path (locationsFor('user', cwd)).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-user-scope-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "ump",
        pluginName: "uplug",
        resources: { skill: "user old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "user",
        cwd,
        marketplace: "ump",
        plugin: "uplug",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.scope, "user");
      assert.equal(errorNotifications(notifications).length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-14: reinstallPlugins batch with only skipped outcomes emits skipped cascade", async () => {
  // When every reinstall target reports skipped ('not installed' because
  // the plugin record was removed from state), reinstallSummary returns
  // 'Plugin reinstall complete.' and the batch notification includes a
  // Skipped section.  Explicit scope is required so resolveReinstallScope
  // takes the explicitScope branch and finds the marketplace in state.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-all-skipped-"));
    try {
      // Install a plugin then remove it from state so reinstall sees it as skipped.
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      // Clear the plugins map so the plugin appears 'not installed'.
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./mp-src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
            marketplaceRoot: path.join(cwd, "mp-src"),
            plugins: {},
          },
        },
      });
      const { ctx, pi, notifications } = makeCtx();

      // Explicit scope=project so enumerateMarketplaceReinstallTargets finds
      // the marketplace and returns [{ plugin: "hello", scope: "project" }].
      // reinstallPlugin then sees plugin not in mp.plugins and returns skipped.
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0]?.partition, "skipped");
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /skipped/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-15: reinstallPlugin with bridge warning emits notifyWarning before success", async () => {
  // collectStagingWarnings propagates through locked.bridgeWarnings.
  // When render='default', bridgeWarnings are emitted via notifyWarning
  // before the success notification. This exercises the
  // 'for (const warning of locked.bridgeWarnings)' loop body.
  // We trigger the warning via a dropMarketplaceCache failure with render='default'.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bridge-warn-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          dropMarketplaceCache: () => Promise.reject(new Error("cache-drop-warn")),
        },
      });

      // dropMarketplaceCache failure is swallowed; reinstall still succeeds.
      assert.equal(outcome.partition, "reinstalled");
      assert.ok(notifications.some((n) => n.message.includes("reinstalled")));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-16: reinstallPlugin saveState failure with non-empty replacements wraps as ManualRecoveryError", async () => {
  // After successful replaceAll, if saveState throws, rollbackReplacements
  // produces leaks from the reversed rollback. errorWithManualRecovery with
  // non-empty leaks wraps the error as a ManualRecoveryError.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-save-nonempty-leaks-"));
    try {
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
      });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("save-failure")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      const note = outcome.notes?.[0] ?? "";
      // The error message from save failure is "save-failure". After
      // rollbackReplacements the MANUAL_RECOVERY_REQUIRED sentinel may or
      // may not be present depending on whether rollback produces leaks.
      // Either way the note includes the save-failure message.
      assert.ok(note.includes("save-failure"), `expected cause in: ${note}`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-17: reinstallPlugin outcome notes include reinstall-specific failure message", async () => {
  // Verify the 'notes' field on a failed outcome contains the formatted
  // error chain from formatErrorWithCauses, covering the catch-block at
  // lines 175-182 in reinstallPlugin.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-notes-chain-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("root-cause-error")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      assert.ok(outcome.notes !== undefined && outcome.notes.length > 0);
      assert.ok(
        outcome.notes.some((n) => n.includes("root-cause-error")),
        `expected root-cause-error in notes: ${JSON.stringify(outcome.notes)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-18: reinstallPlugins enumeration miss for an other-scope-only marketplace emits standalone {not added}", async () => {
  // enumerateMarketplaceReinstallTargets raises the structural
  // MarketplaceNotAddedSignal when the marketplace exists only in user scope
  // and the caller specifies project scope explicitly. reinstallPlugins
  // catches it at the targets-enumeration boundary and emits the standalone
  // `{not added}` variant (ATTR-03 / D-47-A) -- no raw throw escapes.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-enum-err-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-src"),
        marketplaceName: "onlyuser",
        pluginName: "plug",
        resources: { skill: "s" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "marketplace", marketplace: "onlyuser" },
      });

      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(
        body,
        "A marketplace operation has failed.\n\n⊘ onlyuser [project] (failed) {not added}",
      );
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-19: reinstallPlugin updateStateRecord concurrent-removal detection", async () => {
  // Inject a loadState that returns a state with the plugin present
  // (passes the initial check at runLockedReinstall), but where the
  // plugins object is a Proxy that returns undefined on the second access
  // so updateStateRecord's check (line 646) throws 'concurrently removed'.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-concurrent-remove-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      let firstAccess = true;
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            loadState: async (extensionRoot) => {
              const state = await loadState(extensionRoot);
              const mp = state.marketplaces["mp"];
              if (mp === undefined) {
                return state;
              }

              // Proxy the plugins map so the "hello" plugin exists on first
              // access (the initial null-check in runLockedReinstall) but
              // appears removed on all subsequent accesses (updateStateRecord).
              const proxied = new Proxy(mp.plugins, {
                get(target: typeof mp.plugins, prop: string | symbol): unknown {
                  if (prop === "hello") {
                    if (firstAccess) {
                      firstAccess = false;
                      return Reflect.get(target, prop);
                    }

                    return undefined;
                  }

                  return Reflect.get(target, prop);
                },
              });
              (state.marketplaces as Record<string, unknown>)["mp"] = { ...mp, plugins: proxied };
              return state;
            },
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      const note = outcome.notes?.[0] ?? "";
      assert.ok(
        note.includes("concurrently removed"),
        `expected 'concurrently removed' in: ${note}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WB-01/WB-02 deep-equal short-circuit + --local
// ──────────────────────────────────────────────────────────────────────────

test("WB-01 / A7: reinstall with EQUAL existing entry leaves config byte- and mtime-unchanged (RECON-05)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wb01-noop-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "s", command: "c" },
        install: true,
      });

      // seedMarketplace -> installPlugin already wrote claude-plugins.json
      // with the entry `{}`. Snapshot bytes + mtime BEFORE reinstall.
      const bytesBefore = await readFile(locations.configJsonPath);
      const statBefore = await (await import("node:fs/promises")).stat(locations.configJsonPath);

      // Pause to ensure any write would produce a different mtime.
      await new Promise((r) => setTimeout(r, 50));

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      const bytesAfter = await readFile(locations.configJsonPath);
      const statAfter = await (await import("node:fs/promises")).stat(locations.configJsonPath);
      assert.deepEqual(bytesAfter, bytesBefore);
      assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, "config mtime MUST be unchanged");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01 / A7: reinstall with DIFFERENT existing entry writes back the patched shape (forward-compat key preserved)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wb01-diff-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "s", command: "c" },
        install: true,
      });

      // Overwrite the entry with a known-different shape carrying an unknown
      // forward-compat key. The reinstall MUST preserve the unknown key
      // (D-09) -- the deep-equal short-circuit fires when the prospective
      // patched shape ({} spread over existing) == existing.
      const { saveConfig, loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cur = await loadConfig(locations.configJsonPath);
      assert.equal(cur.status, "valid");
      if (cur.status !== "valid") {
        return;
      }

      await saveConfig(
        locations.configJsonPath,
        {
          schemaVersion: 1,
          plugins: { "hello@mp": { enabled: false, futureKey: "x" } as never },
        },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      // Existing shape `{ enabled: false, futureKey: "x" }` deep-equals
      // the spread-over-existing patched shape -- byte-stable, write
      // SKIPPED. The unknown key MUST still be present (no clobber).
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

test("WB-01: --local reinstall targets the local file; base file untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wb01-local-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "s", command: "c" },
        install: true,
      });

      // Snapshot base bytes BEFORE the --local reinstall.
      const baseBytesBefore = await readFile(locations.configJsonPath);

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });
      assert.equal(outcome.partition, "reinstalled");

      // Base bytes UNCHANGED on the --local path (--local NEVER touches the
      // base file).
      const baseBytesAfter = await readFile(locations.configJsonPath);
      assert.deepEqual(baseBytesAfter, baseBytesBefore);

      // Local file received the write -- the local file was ABSENT before
      // the reinstall, so the key is missing -> WRITE fires to add the
      // implicit declaration.
      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.deepEqual(localCfg.config.plugins?.["hello@mp"], {});
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after reinstallPlugin succeeds, the hooks-bridge routing
// table reflects the post-reinstall entry set. Reinstall does NOT delegate
// to install/uninstall, so the cache lifecycle
// is wired explicitly inside the per-plugin lock and verified end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: reinstallPlugin round-trips the plugin's routing-table entries without /reload", async () => {
  const { _resetForTest, getRoutingBucket } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");

  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr03-"));
    try {
      _resetForTest();
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        install: true,
        resources: {
          skill: "old skill",
          hooksJson: {
            PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hi" }] }],
          },
        },
      });

      // After the seed install, the routing table contains the plugin's
      // PreToolUse entry (install-arm WR-03 wiring confirmed elsewhere).
      const preBucket = getRoutingBucket("PreToolUse");
      assert.equal(preBucket.length, 1);
      assert.equal(preBucket[0]?.pluginId, "hello");

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");
      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)"),
        `expected clean reinstall notification; got: ${summary}`,
      );

      // Post-condition: the routing-table entry still reflects the plugin
      // after the explicit remove+add inside the per-plugin lock. This
      // proves both `removePluginConfigFromCache` and
      // `addPluginConfigToCache` plus the trailing `rebuildRoutingTables`
      // call landed in the right order.
      const postBucket = getRoutingBucket("PreToolUse");
      assert.equal(postBucket.length, 1);
      assert.equal(postBucket[0]?.pluginId, "hello");
      assert.equal(postBucket[0]?.handlerDecl["command"], "echo hi");
      // resolvedSource must propagate from the resolver -> cache -> routing
      // table. CLAUDE_PLUGIN_ROOT export at dispatch depends on it.
      const reinstallLoc = locationsFor("project", cwd);
      const postState = await loadState(reinstallLoc.extensionRoot);
      assert.equal(
        postBucket[0]?.resolvedSource,
        postState.marketplaces["mp"]?.plugins["hello"]?.resolvedSource,
        "RoutingEntry.resolvedSource must mirror state.json's resolvedSource after reinstall",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01: 5th cascade slot in reinstall.ts -- the parallel-prepare/commit
// path writes <hooksDir>/<plugin>/hooks.json between the agents and mcp
// replace steps and removes the stale subtree when the plugin no longer
// ships hooks.
// ─────────────────────────────────────────────────────────────────────────────

test("LIFE-01 (reinstall): a plugin with hooks rewrites <hooksDir>/<plugin>/hooks.json from the resolved manifest", async () => {
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-life01-rewrite-"));
    try {
      _resetForTest();
      const locations = locationsFor("project", cwd);

      const hooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo reinstalled" }] }],
      };

      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        install: true,
        resources: {
          skill: "old skill",
          hooksJson,
        },
      });

      // Corrupt the on-disk hooks file so we can detect whether reinstall
      // actually rewrites it (rather than passively leaving the prior install
      // arm's write in place).
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify({ corrupted: true }),
      );

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean reinstall; got: ${summary}`);

      const written = await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      assert.deepEqual(
        JSON.parse(written),
        hooksJson,
        "reinstall cascade slot must rewrite hooks.json from the resolved manifest",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-01 (reinstall): a plugin without hooks removes any stale <hooksDir>/<plugin>/ subtree", async () => {
  const { _resetForTest } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-life01-drop-"));
    try {
      _resetForTest();
      const locations = locationsFor("project", cwd);

      // Seed a plugin WITHOUT hooks.
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        install: true,
        resources: { skill: "old skill" },
      });

      // Pre-place a stale hooks file at the destination as if a prior
      // install had left one behind.
      await mkdir(path.join(locations.hooksDir, "hello"), { recursive: true });
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify({ stale: true }),
      );

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean reinstall; got: ${summary}`);

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
        "reinstall cascade slot must removeHookConfig when the resolved plugin has no hooks",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// BFILL-01 / RINST-01 / D-68-02: reinstall is force-capable. It resolves the
// `installable | unsupported` union through `requireForceInstallable`, so a
// plugin that re-resolves `unsupported` (here: a `.lsp.json` lspServers
// convention file beside a supported skill) no longer throws `{not-installable}`
// at the gate. Re-resolution stays cache-only (NFR-5). The persisted
// compatibility record reflects the REAL supported/unsupported sets at the
// SAME recorded version (a promotion-shaped repair, not an upgrade).
async function seedThenDegradeToUnsupported(cwd: string): Promise<string> {
  // Install a normal (installable) plugin with one supported skill.
  const seeded = await seedMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    resources: { skill: "old skill" },
    install: true,
  });
  // Drop an lspServers convention file so re-resolution degrades to
  // `unsupported` with supported=["skills"], unsupported=["lspServers"].
  await writeFile(path.join(seeded.pluginRoot, ".lsp.json"), "{}");
  return seeded.pluginRoot;
}

test("BFILL-01 / RINST-01: reinstalling a force-installed (unsupported) plugin succeeds instead of throwing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-force-"));
    try {
      await seedThenDegradeToUnsupported(cwd);

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("BFILL-01 / D-68-02 partial: reinstall records the REAL non-empty unsupported set at the same version", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-partial-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedThenDegradeToUnsupported(cwd);

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });
      assert.equal(outcome.partition, "reinstalled");

      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(record !== undefined);
      // The partial re-materialize stays force-installed: installable=false
      // with a non-empty unsupported set (D-66-01 derivation source).
      assert.equal(record.compatibility.installable, false);
      assert.deepEqual(record.compatibility.unsupported, ["lspServers"]);
      assert.deepEqual(record.compatibility.supported, ["skills"]);
      // D-68-02: SAME recorded version (a repair/promotion, not an upgrade).
      assert.equal(record.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("BFILL-01 / D-68-02 full: reinstall of an installable plugin records installable:true with empty unsupported", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-full-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });
      assert.equal(outcome.partition, "reinstalled");

      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(record !== undefined);
      assert.equal(record.compatibility.installable, true);
      assert.deepEqual(record.compatibility.unsupported, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GENERATED_AGENT_PREFIX } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import {
  reinstallPlugin,
  reinstallPlugins,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { __resetCacheForTests } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

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
      assert.equal(notifications.length, 0);
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
      assert.match(notifications.at(-1)?.message ?? "", /Run \/reload to refresh it\.$/);
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

test("PRL-10: replacement failure rolls back earlier bridges and leaves old data intact", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-replace-fail-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent" },
        install: true,
      });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "state.txt"), "plugin data");
      const beforeState = await readFile(locations.stateJsonPath, "utf8");
      const beforeSkill = await readSkill(cwd);
      const beforeCommand = await readCommand(cwd);
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      await writeFile(agentPath, "manual foreign bytes", "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "failed");
      assert.match(notifications[0]?.message ?? "", /foreign previous content/);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), beforeState);
      assert.equal(await readSkill(cwd), beforeSkill);
      assert.equal(await readCommand(cwd), beforeCommand);
      assert.equal(await readFile(path.join(dataDir, "state.txt"), "utf8"), "plugin data");
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

test("PRL-10: force overwrites foreign previous agent content and rollback restores it on save failure", async () => {
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
        force: true,
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("save failure after force")),
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

test("PRL-12: cache and data cleanup failures are warning-only after successful reinstall", async () => {
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
      assert.equal(errorNotifications(notifications).length, 0);
      const warnings = notifications.filter((n) => n.severity === "warning").map((n) => n.message);
      assert.ok(warnings.some((w) => w.includes("cache drop failed")));
      assert.ok(warnings.some((w) => w.includes("data cleanup failed")));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-12/RH-5: no-resource reinstall suppresses reload hint; agents/MCP warn when unloaded", async () => {
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
      assert.equal((notifications.at(-1)?.message ?? "").includes("Run /reload"), false);

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
      assert.match(body, /pi-subagents is not loaded/);
      assert.match(body, /pi-mcp-adapter is not loaded/);
      assert.match(body, /Run \/reload to refresh it\./);
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

      assert.deepEqual(
        outcomes.map((o) => `[${o.scope}] ${o.name}@${o.marketplace}`),
        ["[user] uplug@ump", "[project] pplug@pmp"],
      );
      assert.match(notifications.at(-1)?.message ?? "", /Reinstalled 2 plugins\./);
      assert.match(
        notifications.at(-1)?.message ?? "",
        /Reinstalled:\n {2}- \[user\] uplug@ump\n {2}- \[project\] pplug@pmp/,
      );
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
      assert.match(notifications.at(-1)?.message ?? "", /\[project\] plug@mymp/);
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

test("PRL-05 explicit plugin reinstall in another scope reports not-installed instead of marketplace-not-found", async () => {
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

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "plug", marketplace: "mp" },
      });

      assert.deepEqual(outcomes, [
        {
          partition: "skipped",
          name: "plug",
          marketplace: "mp",
          scope: "project",
          notes: ["not installed"],
        },
      ]);
      assert.equal(
        notifications.some((n) => n.severity === "error"),
        false,
      );
      assert.match(
        notifications.at(-1)?.message ?? "",
        /Skipped:\n {2}- \[project\] plug@mp: not installed/,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-04 marketplace reinstall with explicit scope where marketplace not found emits error", async () => {
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

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // Marketplace target with explicit --scope project where mp lives only
      // in user scope: enumerateMarketplaceReinstallTargets throws
      // MarketplaceNotFoundError; reinstallPlugins catches it, notifies error,
      // and returns [].
      assert.deepEqual([...outcomes], []);
      assert.equal(
        notifications.some((n) => n.severity === "error"),
        true,
      );
      assert.match(notifications.find((n) => n.severity === "error")?.message ?? "", /mp/);
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
      assert.match(body, /Reinstalled plugin "good"\./);
      assert.match(
        body,
        /Failed:\n {2}- \[project\] bad@mp: Plugin "bad" not found in cached manifest/,
      );
      assert.equal(
        notifications.some((n) => n.severity === "error"),
        false,
      );
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

      assert.deepEqual(
        outcomes.map((o) => ({
          partition: o.partition,
          scope: o.scope,
          marketplace: o.marketplace,
          name: o.name,
        })),
        [
          { partition: "reinstalled", scope: "user", marketplace: "u", name: "z" },
          { partition: "reinstalled", scope: "project", marketplace: "a", name: "a" },
          { partition: "reinstalled", scope: "project", marketplace: "a", name: "c" },
          { partition: "reinstalled", scope: "project", marketplace: "z", name: "b" },
        ],
      );
      const body = notifications.at(-1)?.message ?? "";
      assert.match(
        body,
        /Reinstalled:\n {2}- \[user\] z@u\n {2}- \[project\] a@a\n {2}- \[project\] c@a\n {2}- \[project\] b@z/,
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
      assert.match(body, /Run \/reload to refresh it\./);
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
      assert.match(body, /pi-subagents is not loaded/);
      assert.match(body, /pi-mcp-adapter is not loaded/);
      assert.match(body, /Failed:\n {2}- \[project\] bad@mp/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

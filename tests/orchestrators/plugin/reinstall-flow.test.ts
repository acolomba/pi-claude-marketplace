import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GENERATED_AGENT_PREFIX } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  createHooksRouting,
  createHooksRuntime,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  createNodeReinstallPlugin,
  createNodeReinstallPlugins,
  createReinstallPlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts";
import { REAL_REINSTALL_TRANSACTION } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import { seedMarketplace, writeManifest, writePluginTree } from "./reinstall.test.ts";

import type {
  NotificationContext,
  ToolInventory,
  ToolInventoryItem,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

function toolInfo(name: string): ToolInventoryItem {
  return { name };
}

function makeCtx(): {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx: NotificationContext = {
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  };
  const pi: ToolInventory = {
    getAllTools: () => [toolInfo("subagent"), toolInfo("mcp")],
  };
  return { ctx, pi, notifications };
}

test("owns direct and bulk plugin reinstall factories", () => {
  // arrange
  const hooksRouting = createHooksRouting(createHooksRuntime());
  const completionCache = createCompletionCache();

  // act
  const injected = createReinstallPlugin(REAL_REINSTALL_TRANSACTION, hooksRouting, completionCache);
  const direct = createNodeReinstallPlugin(hooksRouting, completionCache);
  const bulk = createNodeReinstallPlugins(hooksRouting, completionCache);

  // assert
  assert.strictEqual(typeof injected, "function");
  assert.strictEqual(typeof direct, "function");
  assert.strictEqual(typeof bulk, "function");
});

test("preserves state, tree, cleanup, and exact notification through the flow owner", async () => {
  await withHermeticEnvironment("reinstall-flow-", async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-flow-success-"));
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
      const beforeRecord = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins
        .hello;
      assert.ok(beforeRecord !== undefined);
      const { ctx, pi, notifications } = makeCtx();
      const reinstallPlugin = createNodeReinstallPlugin(
        createHooksRouting(createHooksRuntime()),
        createCompletionCache(),
      );

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "1.0.0",
        stagedAgentNames: [`${GENERATED_AGENT_PREFIX}hello-bot`],
        stagedMcpServerNames: ["server1"],
        declaresAgents: true,
        declaresMcp: true,
        resourcesChanged: true,
      });
      const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      assert.strictEqual(record.version, "1.0.0");
      assert.strictEqual(record.installedAt, beforeRecord.installedAt);
      assert.deepStrictEqual(record.resources, {
        skills: ["hello-tool"],
        prompts: ["hello:deploy"],
        agents: [`${GENERATED_AGENT_PREFIX}hello-bot`],
        mcpServers: ["server1"],
        hooks: [],
      });
      assert.strictEqual(
        await readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"),
        '---\nname: hello-tool\ndescription: "new skill"\n---\n\nnew skill\n',
      );
      await assert.rejects(() => readFile(path.join(dataDir, "state.txt"), "utf8"), {
        code: "ENOENT",
      });
      assert.deepStrictEqual(notifications, [
        {
          message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

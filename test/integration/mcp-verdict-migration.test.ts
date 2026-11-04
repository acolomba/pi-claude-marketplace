// AMIG-01 / D-P3-16: the load's MCP move stages only the servers
// pi-mcp-adapter runs, because `mcp-adapter.json` is pi-mcp-adapter's file
// under every implementation, and it writes the neutral verdict with its basis
// into the record a released build left, unless the catalog moved past the
// recorded version (MREC-02). Each case seeds a hermetic home
// with a real install, strips what a released build did not write, and runs
// the real load.

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { listPlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts";
import { createApplyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { createLoadReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { openNotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";
import {
  adapterCommand,
  adapterProxyTool,
  builtinMcpCommand,
  builtinMcpTool,
} from "../platform/pi-inventory-seed.ts";

import { makeCtx, seedLegacyMcpInstall } from "./mcp-plugin-seed.ts";

import type { PluginInstallRecord } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const loadReconcile = createLoadReconcile({ loadState }, createApplyReconcile({ loadState }));

const MARKER = { _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" } };

const STDIO_SERVER = { command: "node", args: ["v1.js"] };

const COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

/**
 * Seeds `hello@mp` in the project scope as a released build left it: the real
 * install of `srv`, then `extra` declared beside it, a marked legacy entry per
 * server in `mcp.json`, and a record with no `compatibilityBasis` and no
 * `mcpServerConfigs`. Returns the record as seeded.
 */
async function seedReleasedOwner(
  cwd: string,
  extra: Readonly<Record<string, unknown>>,
): Promise<PluginInstallRecord> {
  const { pluginRoot } = await seedLegacyMcpInstall(cwd, "project", STDIO_SERVER, STDIO_SERVER);
  await writeFile(
    path.join(pluginRoot, ".mcp.json"),
    JSON.stringify({ mcpServers: { srv: STDIO_SERVER, extra } }),
  );
  const locations = locationsFor("project", cwd);
  await writeFile(
    locations.mcpJsonPath,
    JSON.stringify({
      mcpServers: { srv: { ...STDIO_SERVER, ...MARKER }, extra: { ...extra, ...MARKER } },
    }),
  );
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record);
  delete record.compatibilityBasis;
  delete record.mcpServerConfigs;
  record.resources.mcpServers = ["srv", "extra"];
  await saveState(locations.extensionRoot, state);
  return structuredClone(record);
}

async function runLoad(cwd: string): Promise<readonly string[]> {
  const load = makeCtx();
  await loadReconcile({
    ...load.session,
    cwd,
    projectTrusted: true,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });
  return load.notifications.map((notification) => notification.message);
}

async function projectRecord(cwd: string): Promise<PluginInstallRecord | undefined> {
  return (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces.mp?.plugins
    .hello;
}

async function adapterKeys(cwd: string): Promise<readonly string[]> {
  const raw = await readFile(locationsFor("project", cwd).mcpAdapterJsonPath, "utf8");
  return Object.keys((JSON.parse(raw) as { mcpServers: Record<string, unknown> }).mcpServers);
}

test("D-P3-16: a load leaves a server only Pi's built-in MCP runs out of mcp-adapter.json and keeps the record installable with the neutral basis", async () => {
  await withHermeticEnvironment("mcp-verdict-migration-bare-", async ({ cwd }) => {
    // arrange
    const seeded = await seedReleasedOwner(cwd, {
      command: "node",
      bareElicitationCapability: true,
    });

    // act
    const messages = await runLoad(cwd);

    // assert
    assert.deepStrictEqual(await adapterKeys(cwd), ["plugin_hello_srv_"]);
    const record = await projectRecord(cwd);
    assert.deepStrictEqual(record?.compatibility, seeded.compatibility);
    assert.strictEqual(record.compatibilityBasis, "neutral");
    assert.deepStrictEqual(record.resources.mcpServers, ["srv"]);
    assert.deepStrictEqual(messages, [
      [
        "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
        "",
        "Moved to mcp-adapter.json:",
        "  srv -> plugin_hello_srv_ (hello) [project]",
        "Removed from mcp.json:",
        "  extra (hello) [project] {unsupported mcp} bareElicitationCapability: pi-mcp-adapter cannot run it.",
        COST_LINE,
        "/reload to pick up changes",
      ].join("\n"),
    ]);
  });
});

test("D-P3-16: a load writes a record whose ws server no implementation runs as partially installed with the neutral basis", async () => {
  await withHermeticEnvironment("mcp-verdict-migration-ws-", async ({ cwd }) => {
    // arrange
    const seeded = await seedReleasedOwner(cwd, { type: "ws", url: "wss://example.test/ws" });

    // act
    const messages = await runLoad(cwd);

    // assert
    assert.deepStrictEqual(await adapterKeys(cwd), ["plugin_hello_srv_"]);
    const record = await projectRecord(cwd);
    assert.deepStrictEqual(record?.compatibility, {
      ...seeded.compatibility,
      installable: false,
      unsupported: [...seeded.compatibility.unsupported, "mcpServers"],
    });
    assert.strictEqual(record.compatibilityBasis, "neutral");
    assert.deepStrictEqual(record.resources.mcpServers, ["srv"]);
    assert.deepStrictEqual(messages, [
      [
        "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
        "",
        "Moved to mcp-adapter.json:",
        "  srv -> plugin_hello_srv_ (hello) [project]",
        "Removed from mcp.json:",
        "  extra (hello) [project] {unsupported mcp} ws: pi-mcp-adapter cannot run it.",
        COST_LINE,
        "/reload to pick up changes",
      ].join("\n"),
    ]);
  });
});

/** What each MCP implementation adds to the session's tools and commands. */
const MCP_INVENTORY = {
  adapter: { getAllTools: () => [adapterProxyTool()], getCommands: () => [adapterCommand()] },
  builtin: { getAllTools: () => [builtinMcpTool()], getCommands: () => [builtinMcpCommand()] },
} as const;

/**
 * The `list` text for the project scope from a session whose snapshot finds
 * `implementation` loaded.
 */
async function listText(
  cwd: string,
  implementation: keyof typeof MCP_INVENTORY,
): Promise<readonly string[]> {
  const { session, notifications } = makeCtx();
  const run = openNotificationRun(
    {
      ...MCP_INVENTORY[implementation],
      appendEntry(): never {
        throw new Error("a text-mode session appends no entry");
      },
    },
    { kind: "command", commandId: "plugin", invocationId: "list-run" },
  );
  await listPlugins({ ctx: session.ctx, run, cwd, scope: "project" });
  return notifications.map((notification) => notification.message);
}

test("MREC-03 / D-P3-16: a moved legacy plugin whose only server pi-mcp-adapter blocks lists as partially installed under the adapter", async () => {
  await withHermeticEnvironment("mcp-verdict-migration-asker-", async ({ cwd }) => {
    // arrange
    const asker = { command: "node", bareElicitationCapability: true };
    const { pluginRoot } = await seedLegacyMcpInstall(cwd, "project", asker, STDIO_SERVER);
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { srv: asker } }),
    );
    const locations = locationsFor("project", cwd);
    const state = await loadState(locations.extensionRoot);
    const seeded = state.marketplaces.mp?.plugins.hello;
    assert.ok(seeded);
    delete seeded.compatibilityBasis;
    delete seeded.mcpServerConfigs;
    seeded.resources.mcpServers = ["srv"];
    await saveState(locations.extensionRoot, state);
    await runLoad(cwd);

    // act
    const listed = await listText(cwd, "adapter");

    // assert
    const record = await projectRecord(cwd);
    assert.deepStrictEqual(
      {
        compatibilityBasis: record?.compatibilityBasis,
        mcpServerConfigs: record?.mcpServerConfigs,
        stagedMcpServers: record?.resources.mcpServers,
      },
      {
        compatibilityBasis: "neutral",
        mcpServerConfigs: [{ name: "srv", config: asker }],
        stagedMcpServers: [],
      },
    );
    assert.deepStrictEqual(listed, [
      [
        "● mp [project]",
        "  ◉ hello v1.0.0 (partially-installed) {unsupported mcp, requires builtin mcp}",
        "",
        "Plugin list: 1 success",
      ].join("\n"),
    ]);
  });
});

test("MREC-02 / D-P3-16: a legacy plugin whose catalog moved before the load keeps its stored verdict and lists no newer server's verdict", async () => {
  await withHermeticEnvironment("mcp-verdict-migration-moved-", async ({ cwd }) => {
    // arrange
    const events = { type: "sse", url: "http://127.0.0.1:9/sse" };
    const { pluginRoot } = await seedLegacyMcpInstall(cwd, "project", STDIO_SERVER, STDIO_SERVER);
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "hello", version: "1.1.0" }),
    );
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { srv: STDIO_SERVER, events } }),
    );
    await writeFile(
      path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
      JSON.stringify({
        name: "mp",
        plugins: [{ name: "hello", source: "./plugins/hello", version: "1.1.0" }],
      }),
    );
    const locations = locationsFor("project", cwd);
    const state = await loadState(locations.extensionRoot);
    const seeded = state.marketplaces.mp?.plugins.hello;
    assert.ok(seeded);
    delete seeded.compatibilityBasis;
    delete seeded.mcpServerConfigs;
    seeded.resources.mcpServers = ["srv"];
    await saveState(locations.extensionRoot, state);
    await runLoad(cwd);

    // act
    const listed = await listText(cwd, "builtin");

    // assert
    const record = await projectRecord(cwd);
    assert.deepStrictEqual(
      {
        version: record?.version,
        compatibility: record?.compatibility,
        compatibilityBasis: record?.compatibilityBasis,
        mcpServerConfigs: record?.mcpServerConfigs,
      },
      {
        version: "1.0.0",
        compatibility: seeded.compatibility,
        compatibilityBasis: undefined,
        mcpServerConfigs: undefined,
      },
    );
    assert.deepStrictEqual(listed, [
      [
        "● mp [project]",
        "  ● hello v1.0.0 (partially-upgradable) {unsupported mcp}",
        "",
        "Plugin list: 1 success",
      ].join("\n"),
    ]);
  });
});

// MREC-03 / D-P3-01 / D-P3-02 / D-P3-04: an install stores the neutral MCP
// verdict with `compatibilityBasis: "neutral"`, and `list` reads each
// installed record's verdict for the active MCP implementation at read time,
// offline and without writing. Each case drives the real install in a
// hermetic home and reads the saved state.json or the list payload.

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { loadPluginListPayload } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin } from "./mcp-plugin-seed.ts";

import type { ActiveMcpImplementation } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";

const EVENTS = { type: "sse", url: "http://127.0.0.1:9/sse" };
const LIVE = { type: "ws", url: "ws://127.0.0.1:9/ws" };
const AT_PROJECT = { scope: "project", marketplace: "mp", plugin: "hello" } as const;

async function installHello(cwd: string, partial: boolean): Promise<void> {
  const install = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
  await install({ ...makeCtx().session, ...AT_PROJECT, cwd, partial });
}

/** The plugin rows `list` shows for `hello` under `mcpImplementation`. */
async function listedRows(
  cwd: string,
  mcpImplementation: ActiveMcpImplementation,
): Promise<readonly unknown[]> {
  const blocks = await loadPluginListPayload({
    ctx: makeCtx().session.ctx,
    cwd,
    scope: "project",
    mcpImplementation,
  });
  return blocks.flatMap((block) => block.plugins);
}

test("D-P3-01 / D-P3-02: an install stores the neutral verdict and its basis", async () => {
  await withHermeticEnvironment("mcp-verdict-list-install-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"], EVENTS);
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { events: EVENTS, live: LIVE } }),
    );

    // act
    await installHello(cwd, true);

    // assert
    const record = (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces.mp
      ?.plugins.hello;
    assert.deepStrictEqual(
      {
        compatibility: record?.compatibility,
        compatibilityBasis: record?.compatibilityBasis,
        mcpServerConfigs: record?.mcpServerConfigs,
        stagedMcpServers: record?.resources.mcpServers,
      },
      {
        compatibility: {
          installable: false,
          notes: [],
          supported: [],
          unsupported: ["mcpServers"],
        },
        compatibilityBasis: "neutral",
        mcpServerConfigs: [
          { name: "events", config: EVENTS },
          { name: "live", config: LIVE },
        ],
        stagedMcpServers: ["events"],
      },
    );
  });
});

test("MREC-03 / D-P3-04: list shows one sse install per implementation and writes nothing", async () => {
  await withHermeticEnvironment("mcp-verdict-list-rows-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project"], EVENTS);
    await installHello(cwd, false);
    const { stateJsonPath } = locationsFor("project", cwd);
    const stateBytes = await readFile(stateJsonPath);
    const installedRow = {
      status: "installed",
      name: "hello",
      dependencies: ["mcp"],
      version: "1.0.0",
      severity: "info",
      needsReload: false,
    };

    // act
    const rows = {
      adapter: await listedRows(cwd, "adapter"),
      builtin: await listedRows(cwd, "builtin"),
      none: await listedRows(cwd, "none"),
    };

    // assert
    assert.deepStrictEqual(rows, {
      adapter: [installedRow],
      builtin: [
        {
          status: "partially-installed",
          name: "hello",
          reasons: ["unsupported mcp"],
          version: "1.0.0",
        },
      ],
      none: [installedRow],
    });
    assert.deepStrictEqual(await readFile(stateJsonPath), stateBytes);
  });
});

test("MREC-02: a legacy record with no MCP trace reads as no servers and re-resolves nothing", async () => {
  await withHermeticEnvironment("mcp-verdict-list-legacy-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project"], EVENTS);
    await installHello(cwd, false);
    const { extensionRoot } = locationsFor("project", cwd);
    const state = await loadState(extensionRoot);
    const record = state.marketplaces.mp?.plugins.hello;
    assert.ok(record !== undefined);
    // A record that left no MCP trace: no recorded servers, no basis, no
    // staged server, and no `mcpServers` kind. Its plugin still declares the
    // sse server, so a re-resolution would read it as blocked under Pi's
    // built-in MCP and list the plugin as partially installed.
    delete record.mcpServerConfigs;
    delete record.compatibilityBasis;
    record.resources.mcpServers = [];
    await saveState(extensionRoot, state);

    // act
    const rows = await listedRows(cwd, "builtin");

    // assert
    assert.deepStrictEqual(rows, [
      {
        status: "installed",
        name: "hello",
        dependencies: [],
        version: "1.0.0",
        severity: "info",
        needsReload: false,
      },
    ]);
  });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  adapterCommand,
  adapterProxyTool,
  builtinMcpCommand,
  builtinMcpTool,
  foreignMcpTool,
  forkAdapterCommand,
  toolInfo,
} from "../platform/pi-inventory-seed.ts";

import { installTargetWithMockPi, withE2EEnvironment } from "./_helpers.ts";

import type { E2EEnvironment } from "./_helpers.ts";
import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { SlashCommandInfo, ToolInfo } from "@earendil-works/pi-coding-agent";

// Per-row soft-dep marker contract strings (CMC-13 / MSG-SD-1..2). Each
// expected value is a whole rendered reasons block, closing brace included.
// Each plugin here declares one companion, so its row's reasons block holds
// that marker alone (D-13-07).
const REQUIRES_PI_SUBAGENTS_MARKER = "{requires pi-subagents}";
const REQUIRES_PI_MCP_MARKER = "{requires pi-mcp-adapter}";

interface SoftDepState {
  readonly requirement: string;
  readonly name: string;
  readonly tools: readonly ToolInfo[];
  readonly commands: readonly SlashCommandInfo[];
  readonly reasons: string;
}

interface InstallAndList {
  readonly installMessages: readonly string[];
  readonly listMessages: readonly string[];
  readonly state: ExtensionState;
}

/**
 * Installs `plugin` through the real extension on a mock Pi that reports
 * `tools` and `commands`, then runs `list --scope project` through the same
 * registered command.
 */
async function installAndList(
  env: E2EEnvironment,
  plugin: string,
  tools: readonly ToolInfo[],
  commands: readonly SlashCommandInfo[],
): Promise<InstallAndList> {
  const install = await installTargetWithMockPi(env, plugin, tools, commands);
  const installMessages = install.notifications.map((notification) => notification.message);
  const command = install.mock.commands.get("claude:plugin");
  assert.ok(command);
  await command.handler("list --scope project", install.ctx);
  const listMessages = install.notifications
    .slice(installMessages.length)
    .map((notification) => notification.message);
  return { installMessages, listMessages, state: install.state };
}

/**
 * The trailing `{...}` reasons block on `plugin`'s installed row, `""` when the
 * row has none, and `undefined` when no installed row names `plugin`.
 */
function rowReasons(messages: readonly string[], plugin: string): string | undefined {
  const row = messages
    .flatMap((message) => message.split("\n"))
    .find((line) => line.startsWith(`  ● ${plugin} `));
  if (row === undefined) {
    return undefined;
  }

  return /\{[^}]*\}$/.exec(row)?.[0] ?? "";
}

// ADET-01 / ADET-02: the pi-mcp-adapter states run through install and list on
// the real extension. Each inventory comes from the shared seeds.
const MCP_STATES: readonly SoftDepState[] = [
  {
    requirement: "ADET-02",
    name: "the adapter's proxy tool and command clear {requires pi-mcp-adapter}",
    tools: [adapterProxyTool()],
    commands: [adapterCommand()],
    reasons: "",
  },
  {
    requirement: "ADET-02",
    name: "the adapter's command alone (disableProxyTool) clears {requires pi-mcp-adapter}",
    tools: [],
    commands: [adapterCommand()],
    reasons: "",
  },
  {
    requirement: "ADET-02",
    name: "a fork's mcp-adapter command clears {requires pi-mcp-adapter}",
    tools: [],
    commands: [forkAdapterCommand()],
    reasons: "",
  },
  {
    requirement: "ADET-01",
    name: "Pi's built-in MCP alone keeps {requires pi-mcp-adapter}",
    tools: [builtinMcpTool()],
    commands: [builtinMcpCommand()],
    reasons: REQUIRES_PI_MCP_MARKER,
  },
  {
    requirement: "ADET-01",
    name: "no adapter and no built-in MCP keeps {requires pi-mcp-adapter}",
    tools: [],
    commands: [],
    reasons: REQUIRES_PI_MCP_MARKER,
  },
  {
    requirement: "ADET-01",
    name: "a foreign extension's mcp tool keeps {requires pi-mcp-adapter}",
    tools: [foreignMcpTool()],
    commands: [],
    reasons: REQUIRES_PI_MCP_MARKER,
  },
];

for (const { requirement, name, tools, commands, reasons } of MCP_STATES) {
  test(`${requirement}: ${name} on context7's install and list rows`, async () => {
    await withE2EEnvironment(async (env) => {
      // act
      const { installMessages, listMessages, state } = await installAndList(
        env,
        "context7",
        tools,
        commands,
      );

      // assert
      assert.equal(rowReasons(installMessages, "context7"), reasons);
      assert.equal(rowReasons(listMessages, "context7"), reasons);
      const record = state.marketplaces["claude-plugins-official"]?.plugins.context7;
      assert.ok(record);
      const mcpJson = JSON.parse(
        await readFile(locationsFor("project", env.cwd).mcpAdapterJsonPath, "utf8"),
      ) as { readonly mcpServers?: Record<string, unknown> };
      for (const serverName of record.resources.mcpServers) {
        assert.ok(mcpJson.mcpServers?.[serverName]);
      }
    });
  });
}

// RH-3: pi-subagents counts as loaded when Pi lists a `subagent` tool.
const AGENT_STATES: readonly SoftDepState[] = [
  {
    requirement: "RH-3",
    name: "a subagent tool clears {requires pi-subagents}",
    tools: [toolInfo("subagent")],
    commands: [],
    reasons: "",
  },
  {
    requirement: "RH-3",
    name: "no subagent tool keeps {requires pi-subagents}",
    tools: [],
    commands: [],
    reasons: REQUIRES_PI_SUBAGENTS_MARKER,
  },
];

for (const { requirement, name, tools, commands, reasons } of AGENT_STATES) {
  test(`${requirement}: ${name} on code-simplifier's install and list rows`, async () => {
    await withE2EEnvironment(async (env) => {
      // act
      const { installMessages, listMessages, state } = await installAndList(
        env,
        "code-simplifier",
        tools,
        commands,
      );

      // assert
      assert.equal(rowReasons(installMessages, "code-simplifier"), reasons);
      assert.equal(rowReasons(listMessages, "code-simplifier"), reasons);
      const record = state.marketplaces["claude-plugins-official"]?.plugins["code-simplifier"];
      assert.ok(record);
      const { agentsDir } = locationsFor("project", env.cwd);
      for (const generatedName of record.resources.agents) {
        const body = await readFile(path.join(agentsDir, `${generatedName}.md`), "utf8");
        assert.match(body, /pi-claude-marketplace/);
      }
    });
  });
}

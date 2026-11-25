// test/integration/agents-adapter-grant-conformance.test.ts
//
// Peer conformance (ITSCOPE-01) against pi-subagents' own grant resolver and
// pi-mcp-adapter's own tool names. PG-MCP-02: compare a grant selector from
// the agents bridge with pi-subagents 0.88.1's adapter resolver and
// pi-mcp-adapter 7.0.1's registered tool name. The case pins a pi-subagents
// capability gap (AGTLONGNAME-01): for a granted tool over 64 characters,
// pi-subagents wants the uncut name, and the adapter registers the cut one.
// `features/mcp-server/agent-grants.feature` shows only the exclude side of a
// long name.

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { convertAgent } from "../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";
import { profileFor } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { findCachedPeer, importPeerModule } from "./optional-peer.ts";

interface McpDirectToolAllowlistModule {
  readonly computeMcpServerHash: (definition: Record<string, unknown>) => string;
  readonly resolveMcpDirectToolResolution: (
    selectors: string[],
    cwd: string,
    host: { readonly events: { readonly emit: () => void }; readonly getCommands: () => unknown[] },
  ) => unknown;
}

const TOOL = "list_every_table_in_the_warehouse_with_row_counts";
const SERVER = "plugin_demo_warehouse_";

/** The selector written by the bridge for a granted adapter tool. */
function grantSelector(): string[] {
  const agent = convertAgent({
    pluginName: "demo",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: {
      sourceName: "runner",
      generatedName: "pi-claude-marketplace-demo-runner",
      sourcePath: "/abs/runner.md",
      sourceHash: "abc",
      raw: { description: "d", tools: `mcp__plugin_demo_warehouse__${TOOL}` },
      body: "Body.\n",
    },
    sourceHash: "abc",
    mapModel: false,
    options: undefined,
    mcpServerNames: ["warehouse"],
    mcpImplementation: "adapter",
  });
  const toolsLines = agent.fileContent.split("\n").filter((line) => line.startsWith("tools: "));
  assert.strictEqual(toolsLines.length, 1);
  return (toolsLines[0] ?? "")
    .slice("tools: ".length)
    .split(",")
    .map((entry) => entry.replace(/^mcp:/, ""));
}

/** Imports pi-subagents' resolver and reports the package version under test. */
async function loadAllowlist(t: TestContext): Promise<McpDirectToolAllowlistModule> {
  const peer = await findCachedPeer("pi-subagents");
  t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
  return importPeerModule<McpDirectToolAllowlistModule>(
    peer,
    "src",
    "runs",
    "shared",
    "mcp-direct-tool-allowlist.js",
  );
}

test("PG-MCP-02: pi-subagents names a granted adapter tool over 64 characters without pi-mcp-adapter's cut, a pi-subagents capability gap", async (t) => {
  const allowlist = await loadAllowlist(t);
  await withHermeticEnvironment("agent-adapter-grant-", async ({ agentDir, cwd }) => {
    // arrange
    const definition = {
      command: "node",
      args: ["server.js"],
      directTools: "search",
      toolPrefix: "mcp",
    };
    await writeFile(
      path.join(agentDir, "mcp-adapter.json"),
      JSON.stringify({ mcpServers: { [SERVER]: definition } }),
    );
    await writeFile(
      path.join(agentDir, "mcp-cache.json"),
      JSON.stringify({
        version: 1,
        servers: {
          [SERVER]: {
            configHash: allowlist.computeMcpServerHash(definition),
            cachedAt: Date.now(),
            tools: [{ name: TOOL }],
          },
        },
      }),
    );
    const selectors = grantSelector();
    assert.deepStrictEqual(selectors, [`${SERVER}/${TOOL}`]);

    // act
    const resolution = allowlist.resolveMcpDirectToolResolution(selectors, cwd, {
      events: { emit: () => undefined },
      getCommands: () => [],
    });

    // assert
    const uncutName = `mcp__${SERVER}_${TOOL}`;
    const registeredName = profileFor("adapter").toolName("demo", "warehouse", TOOL);
    assert.strictEqual(uncutName.length, 77);
    assert.strictEqual(
      registeredName,
      "mcp__plugin_demo_warehouse__list_every_table_in_the_war_17c0721b",
    );
    assert.deepStrictEqual(resolution, {
      selections: [{ name: uncutName, selector: `${SERVER}/${TOOL}` }],
      unresolvedSelectors: [],
    });
    assert.notStrictEqual(uncutName, registeredName);
  });
});

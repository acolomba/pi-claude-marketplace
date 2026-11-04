// test/integration/agents-builtin-grant-conformance.test.ts
//
// MGRT-01: the `mcp:` selectors that `convertAgent` writes in the built-in
// grant form, verified against pi-subagents' OWN selector resolver. With a
// host whose `mcp` command comes from `builtin:mcp` and which has no
// `mcp-adapter` command, pi-subagents resolves each selector against the
// host's tools: a whole-server selector takes every tool in the server's
// namespace, a per-tool selector takes the tool Pi names. So the test lists
// each granted tool under the name and namespace Pi 1.5.0 gives it, computed
// here from Pi's rule, and asserts that every built-in selector resolves and
// that every adapter selector of the same agent stays unresolved.
//
// pi-subagents is an optional peer. The test imports its compiled
// `src/runs/shared/mcp-direct-tool-allowlist.js` in place from the declared
// floor in the optional peer cache. A missing or wrong-version package fails
// the test. A run reports the proven version as a diagnostic.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import os from "node:os";
import { test } from "node:test";

import { convertAgent } from "../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";

import { findCachedPeer, importPeerModule } from "./optional-peer.ts";

import type { McpImplementationId } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";

interface HostTool {
  readonly name: string;
  readonly exposure: string;
  readonly namespace: { readonly name: string };
}

interface ResolverHost {
  readonly events: { emit: () => void };
  readonly getCommands: () => readonly { name: string; sourceInfo: { path: string } }[];
  readonly getAllTools: () => readonly HostTool[];
}

interface McpDirectToolAllowlistModule {
  readonly resolveMcpDirectToolResolution: (
    selectors: string[],
    cwd: string,
    host: ResolverHost,
  ) => unknown;
}

const LONG_TOOL = "list_every_table_in_the_warehouse_with_row_counts";

/**
 * Pi 1.5.0 `createMcpToolName` for a server with no name clash: every
 * character outside `[A-Za-z0-9_]` in `mcp__<server>__<tool>` becomes `_`,
 * and a name over 64 characters keeps 55, then `_` and 8 hex of a hash.
 */
function piToolName(server: string, tool: string): string {
  const name = `mcp__${server}__${tool}`.replaceAll(/[^A-Za-z0-9_]/g, "_");
  if (name.length <= 64) {
    return name;
  }

  const hash = createHash("sha256").update(`${server}\0${tool}`).digest("hex").slice(0, 8);
  return `${name.slice(0, 55)}_${hash}`;
}

/** A tool as Pi's built-in MCP lists it, in the namespace `mcp__<server with - folded>`. */
function piTool(server: string, tool: string): HostTool {
  return {
    name: piToolName(server, tool),
    exposure: "deferred",
    namespace: { name: `mcp__${server.replaceAll("-", "_")}` },
  };
}

const BUILTIN_HOST: ResolverHost = {
  events: { emit: () => undefined },
  getCommands: () => [{ name: "mcp", sourceInfo: { path: "builtin:mcp" } }],
  getAllTools: () => [
    piTool("plugin_demo_db", "query"),
    piTool("plugin_demo_my-db", "read"),
    piTool("plugin_demo_warehouse", LONG_TOOL),
  ],
};

/** The selectors of the agent's `tools:` line, each without its `mcp:` prefix. */
function grantSelectors(mcpImplementation: McpImplementationId): string[] {
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
      raw: {
        description: "d",
        tools: `mcp__plugin_demo_db__query, mcp__plugin_demo_my-db, mcp__plugin_demo_warehouse__${LONG_TOOL}`,
      },
      body: "Body.\n",
    },
    sourceHash: "abc",
    mapModel: false,
    mcpServerNames: ["db", "my-db", "warehouse"],
    mcpImplementation,
  });
  const toolsLines = agent.fileContent.split("\n").filter((line) => line.startsWith("tools: "));
  assert.strictEqual(toolsLines.length, 1);
  return (toolsLines[0] ?? "")
    .slice("tools: ".length)
    .split(",")
    .map((entry) => entry.replace(/^mcp:/, ""));
}

test("MGRT-01: pi-subagents resolves every built-in grant selector against Pi's built-in MCP", async (t) => {
  // arrange
  const peer = await findCachedPeer("pi-subagents");
  t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
  const allowlist = await importPeerModule<McpDirectToolAllowlistModule>(
    peer,
    "src",
    "runs",
    "shared",
    "mcp-direct-tool-allowlist.js",
  );
  const selectors = grantSelectors("builtin");

  // act
  const resolution = allowlist.resolveMcpDirectToolResolution(selectors, os.tmpdir(), BUILTIN_HOST);

  // assert
  assert.deepStrictEqual(resolution, {
    selections: [
      { name: "mcp__plugin_demo_db__query", selector: "plugin_demo_db/query" },
      { name: "mcp__plugin_demo_my_db__read", selector: "plugin_demo_my-db" },
      {
        name: piToolName("plugin_demo_warehouse", LONG_TOOL),
        selector: `plugin_demo_warehouse/${LONG_TOOL}`,
      },
    ],
    unresolvedSelectors: [],
    builtin: true,
  });
});

test("MGRT-01: pi-subagents resolves no adapter grant selector of the same agent against Pi's built-in MCP", async (t) => {
  // arrange
  const peer = await findCachedPeer("pi-subagents");
  t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
  const allowlist = await importPeerModule<McpDirectToolAllowlistModule>(
    peer,
    "src",
    "runs",
    "shared",
    "mcp-direct-tool-allowlist.js",
  );
  const selectors = grantSelectors("adapter");

  // act
  const resolution = allowlist.resolveMcpDirectToolResolution(selectors, os.tmpdir(), BUILTIN_HOST);

  // assert
  assert.deepStrictEqual(resolution, {
    selections: [],
    unresolvedSelectors: [
      "plugin_demo_db_/query",
      "plugin_demo_my-db_",
      `plugin_demo_warehouse_/${LONG_TOOL}`,
    ],
    builtin: true,
  });
});

/**
 * Pi inventory seeds shared by the soft-dependency probe tests. Each seed
 * returns a fresh value on every call.
 *
 * PIFL-04: Pi 1.0 requires `exposure` on every `ToolInfo`, so the seed sets it
 * once here for every planted tool.
 */
import { Type } from "typebox";

import type { PiInventory } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { SlashCommandInfo, ToolInfo } from "@earendil-works/pi-coding-agent";

export function toolInfo(name: string): ToolInfo {
  return {
    name,
    description: `test tool ${name}`,
    parameters: Type.Object({}),
    exposure: "direct",
    sourceInfo: {
      origin: "top-level",
      path: `/test/tools/${name}.ts`,
      scope: "temporary",
      source: "test",
    },
  } satisfies ToolInfo;
}

/** A Pi inventory with no tools and no slash commands. */
export function emptyPiInventory(): PiInventory {
  return { getAllTools: () => [], getCommands: () => [] };
}

/**
 * ADET-02: the `mcp-adapter` extension command pi-mcp-adapter registers. It is
 * present with `disableProxyTool`, when the adapter exposes no tool at all.
 * `npm:pi-mcp-adapter` is the source `pi install npm:pi-mcp-adapter` records.
 */
export function adapterCommand(
  name = "mcp-adapter",
  source = "npm:pi-mcp-adapter",
): SlashCommandInfo {
  return {
    name,
    source: "extension",
    sourceInfo: { origin: "package", path: `/test/extensions/${name}.ts`, scope: "user", source },
  } satisfies SlashCommandInfo;
}

/** ADET-02: the adapter's `mcp` proxy tool, from the npm package. */
export function adapterProxyTool(): ToolInfo {
  return {
    ...toolInfo("mcp"),
    sourceInfo: {
      origin: "package",
      path: "/test/extensions/pi-mcp-adapter.ts",
      scope: "user",
      source: "npm:pi-mcp-adapter",
    },
  } satisfies ToolInfo;
}

/** ADET-02: a fork registers the same `mcp-adapter` command from a foreign source. */
export function forkAdapterCommand(): SlashCommandInfo {
  return adapterCommand("mcp-adapter", "git:github.com/example/mcp-fork");
}

// ADET-01: Pi's built-in MCP client, as a sandboxed Pi 1.0.0 RPC run listed it
// on 2026-10-02 with one stub stdio server `stub` exposing one tool `echo`.
// The real-Pi RPC test for ADET-01 re-captures that inventory and checks it
// against these two seeds. The capture names the namespace only; `description`
// and `parameters` are placeholders that `ToolInfo` requires.

/** ADET-01: the built-in MCP client's tool for the stub server's `echo`. */
export function builtinMcpTool(): ToolInfo {
  return {
    name: "mcp__stub__echo",
    description: "test tool mcp__stub__echo",
    parameters: Type.Object({}),
    exposure: "deferred",
    namespace: { name: "mcp__stub" },
    sourceInfo: { path: "builtin:mcp", source: "builtin", scope: "temporary", origin: "top-level" },
  } satisfies ToolInfo;
}

/** ADET-01: the built-in MCP client's `mcp` slash command. */
export function builtinMcpCommand(): SlashCommandInfo {
  return {
    name: "mcp",
    source: "extension",
    sourceInfo: { path: "builtin:mcp", source: "builtin", scope: "temporary", origin: "top-level" },
  } satisfies SlashCommandInfo;
}

/** ADET-02: another extension's tool that happens to be named `mcp`. */
export function foreignMcpTool(): ToolInfo {
  return {
    ...toolInfo("mcp"),
    sourceInfo: {
      origin: "package",
      path: "/test/extensions/other-mcp-extension.ts",
      scope: "user",
      source: "npm:other-mcp-extension",
    },
  } satisfies ToolInfo;
}

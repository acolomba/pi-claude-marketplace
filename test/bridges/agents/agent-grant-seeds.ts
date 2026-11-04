import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentsIndexEntry } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

/**
 * Hand-written agent grant forms and agents-index rows for the MGRT-01 grant
 * rewrite: literal frontmatter blocks, never production staging output.
 */

export const NAME = "pi-claude-marketplace-demo-helper";
export const OTHER_NAME = "pi-claude-marketplace-demo-reviewer";
export const ADAPTER_ASYNC =
  "tools include MCP tools, which pi-subagents serves only to background children -- " +
  "the agent runs in the background (`async: true`), where Claude Code runs it in the " +
  "foreground; a launch before pi-mcp-adapter has cached the server's tools still fails";
export const BUILTIN_ASYNC =
  "tools include MCP tools, which pi-subagents serves only to background children -- " +
  "the agent runs in the background (`async: true`), where Claude Code runs it in the " +
  "foreground; a launch before Pi's built-in MCP has listed the server's tools still fails";
export const BODY = "\nYou help with the demo.\n---\nA body line after a rule.\n";

/** A hand-written generated agent block holding `tools` and one provenance warning. */
export function agentBlock(name: string, tools: string, warning: string): string {
  return [
    "---",
    `name: ${name}`,
    "description: Helps with the demo",
    `tools: ${tools}`,
    "systemPromptMode: replace",
    "inheritProjectContext: true",
    "inheritSkills: false",
    "advertise: true",
    "async: true",
    "provenance:",
    "  generatedBy: pi-claude-marketplace",
    "  sourcePlugin: demo",
    "  sourceAgent: helper",
    "  sourcePath: agents/helper.md",
    "  droppedFields: []",
    "  droppedTools: []",
    "  warnings:",
    `    - ${warning}`,
    "---",
    "",
  ].join("\n");
}

export function adapterBlock(name = NAME): string {
  return agentBlock(name, "read,mcp:plugin_demo_stub_/echo", ADAPTER_ASYNC);
}

export function builtinBlock(name = NAME): string {
  return agentBlock(name, "read,mcp:plugin_demo_stub/echo", BUILTIN_ASYNC);
}

/** A row that stores both forms and records `recorded` as the form its file holds. */
export function storedRow(
  targetPath: string,
  recorded: "adapter" | "builtin",
  name = NAME,
): AgentsIndexEntry {
  const adapter = { frontmatter: adapterBlock(name), warnings: [ADAPTER_ASYNC], droppedTools: [] };
  const builtin = {
    frontmatter: builtinBlock(name),
    warnings: [BUILTIN_ASYNC, "sse server dropped"],
    droppedTools: ["mcp__plugin_demo_events__tail"],
  };
  const current = recorded === "adapter" ? adapter : builtin;
  return {
    plugin: "demo",
    marketplace: "mp",
    sourceAgent: "helper",
    generatedName: name,
    sourcePath: "/plugins/demo/agents/helper.md",
    targetPath,
    sourceHash: "sha256:helper",
    droppedFields: [],
    droppedTools: [...current.droppedTools],
    warnings: [...current.warnings],
    mcpImplementation: recorded,
    mcpForms: { adapter, builtin },
  };
}

/** `row` once it records `active` and that form's warnings and dropped tools. */
export function swappedRow(row: AgentsIndexEntry, active: "adapter" | "builtin"): AgentsIndexEntry {
  const form = row.mcpForms?.[active];
  assert.ok(form !== undefined);
  return {
    ...row,
    mcpImplementation: active,
    warnings: [...form.warnings],
    droppedTools: [...form.droppedTools],
  };
}

/** A row with no stored forms, which no load rewrites. */
export function plainRow(targetPath: string): AgentsIndexEntry {
  return {
    plugin: "demo",
    marketplace: "mp",
    sourceAgent: "plain",
    generatedName: "pi-claude-marketplace-demo-plain",
    sourcePath: "/plugins/demo/agents/plain.md",
    targetPath,
    sourceHash: "sha256:plain",
    droppedFields: [],
    droppedTools: [],
    warnings: [],
  };
}

export function indexPath(locations: ScopedLocations): string {
  return path.join(locations.extensionRoot, "agents-index.json");
}

export async function writeIndex(
  locations: ScopedLocations,
  agents: readonly unknown[],
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await writeFile(indexPath(locations), JSON.stringify({ schemaVersion: 1, agents }), "utf8");
}

export async function readIndexRows(locations: ScopedLocations): Promise<unknown> {
  const text = await readFile(indexPath(locations), "utf8");
  return (JSON.parse(text) as { agents: unknown }).agents;
}

export async function writeAgent(target: string, content: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

export function agentPath(locations: ScopedLocations, name = NAME): string {
  return path.join(locations.agentsDir, `${name}.md`);
}

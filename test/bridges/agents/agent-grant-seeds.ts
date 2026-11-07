import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AgentGrantForm,
  AgentsIndexRow,
} from "../../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
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

/**
 * A hand-written generated agent block with one grant line (`tools: ...` or
 * `excludeTools: ...`) and its provenance warnings.
 */
export function agentBlock(grantLine: string, warnings: readonly string[], name = NAME): string {
  return [
    "---",
    `name: ${name}`,
    "description: Helps with the demo",
    grantLine,
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
    ...warnings.map((warning) => `    - ${warning}`),
    "---",
    "",
  ].join("\n");
}

export function adapterBlock(name = NAME): string {
  return agentBlock("tools: read,mcp:plugin_demo_stub_/echo", [ADAPTER_ASYNC], name);
}

export function builtinBlock(name = NAME): string {
  return agentBlock("tools: read,mcp:plugin_demo_stub/echo", [BUILTIN_ASYNC], name);
}

/** The stored adapter form of the agent `name`. */
function adapterForm(name: string): AgentGrantForm {
  return { frontmatter: adapterBlock(name), warnings: [ADAPTER_ASYNC], droppedTools: [] };
}

/** The stored built-in form of the agent `name`; it drops the tool of an `sse` server. */
export function builtinForm(name = NAME): AgentGrantForm {
  return {
    frontmatter: builtinBlock(name),
    warnings: [BUILTIN_ASYNC, "sse server dropped"],
    droppedTools: ["mcp__plugin_demo_events__tail"],
  };
}

/** A row of the agent `name` with no stored forms, and the warnings and dropped tools of `form`. */
function helperRow(targetPath: string, form: AgentGrantForm, name: string): AgentsIndexRow {
  return {
    plugin: "demo",
    marketplace: "mp",
    sourceAgent: "helper",
    generatedName: name,
    sourcePath: "/plugins/demo/agents/helper.md",
    targetPath,
    sourceHash: "sha256:helper",
    droppedFields: [],
    droppedTools: [...form.droppedTools],
    warnings: [...form.warnings],
  };
}

/** A row that stores both forms and records `recorded` as the form its file holds. */
export function storedRow(
  targetPath: string,
  recorded: "adapter" | "builtin",
  name = NAME,
): AgentsIndexEntry {
  const adapter = adapterForm(name);
  const builtin = builtinForm(name);
  const current = recorded === "adapter" ? adapter : builtin;
  return {
    ...helperRow(targetPath, current, name),
    mcpImplementation: recorded,
    mcpForms: { adapter, builtin },
  };
}

/**
 * A row that stores only the form its file holds. A staging writes such a row
 * when the other implementation maps the agent's explicit `tools:` list to
 * nothing (AG-11).
 */
export function heldOnlyRow(
  targetPath: string,
  held: "adapter" | "builtin",
  name = NAME,
): AgentsIndexRow {
  if (held === "adapter") {
    const adapter = adapterForm(name);
    return {
      ...helperRow(targetPath, adapter, name),
      mcpImplementation: "adapter",
      mcpForms: { adapter },
    };
  }

  const builtin = builtinForm(name);
  return {
    ...helperRow(targetPath, builtin, name),
    mcpImplementation: "builtin",
    mcpForms: { builtin },
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

/** A row written before MGRT-01: no stored forms; its file holds the adapter form. */
export function legacyRow(
  targetPath: string,
  warnings: readonly string[],
  droppedTools: readonly string[] = [],
): AgentsIndexRow {
  return {
    plugin: "demo",
    marketplace: "mp",
    sourceAgent: "helper",
    generatedName: NAME,
    sourcePath: "/plugins/demo/agents/helper.md",
    targetPath,
    sourceHash: "sha256:helper",
    droppedFields: [],
    droppedTools: [...droppedTools],
    warnings: [...warnings],
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

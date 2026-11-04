// bridges/agents/legacy-grant-form.ts
//
// MGRT-01 / P4-DC-06: the grant forms of an agent installed before the agents
// index stored them. Such a row has no stored forms, and its file holds the
// adapter form, the only form an earlier release wrote. The adapter form is
// the file's own frontmatter block; the built-in form is a textual
// translation of that block, so the first session under Pi's built-in MCP can
// swap it like any stored form, and later switches use the stored forms.
//
// The block ends at the first `\n---\n` after the opening `---` line: every
// frontmatter line this bridge writes starts with a key or an indent, so no
// line inside the block is `---`, while the body may hold one.
//
// The translation changes three things and keeps every other byte:
//   - each `mcp:<key>` or `mcp:<key>/<tool>` entry of this plugin loses the
//     key's last `_`: the adapter key is the built-in server name plus `_`
//     (`plugin_<plugin>_<server>_`), and the built-in selector is that name;
//   - each per-tool MCP exclude name of this plugin (the Claude-form token
//     `mcp__plugin_<plugin>_...`) becomes Pi's built-in tool name: every
//     character outside `[A-Za-z0-9_]` turns into `_`;
//   - the adapter async warning becomes the built-in text, and the
//     cannot-narrow warning's `mcp:<key>` selector becomes the built-in one.
//
// Known gaps (P4-DC-06):
//   - A grant of a server Pi's built-in MCP cannot run (an `sse` server) is
//     translated, not dropped, so its launch still fails under built-in as it
//     did before. `reinstall`, `update`, and disable-then-enable re-stage the
//     agent exactly.
//   - An exclude name longer than 64 characters gives up the translation:
//     Pi cuts and hashes such a name from the server and tool names, a split
//     the file no longer holds. The row then records the adapter form only.
//   - A legacy file a user edited, but whose frame and marker survive, is
//     translated in place (T-04-16): there is no stored form to compare.

import { builtinMcpServerName } from "../../domain/name.ts";

import { GENERATED_AGENT_MARKER } from "./marker.ts";
import { mcpAsyncWarning } from "./mcp-async-warning.ts";

import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";

const OPENING_LINE = "---\n";
const CLOSING_LINE = "\n---\n";
const TOOLS_KEY = "tools: ";
const EXCLUDE_TOOLS_KEY = "excludeTools: ";
const LIST_ITEM = "    - ";
const NARROW_GRANT_LEAD = " cannot narrow the whole-server grant ";
// Pi 1.5.0 cuts a longer tool name and hashes it (D-MB-13).
const MAX_TOOL_NAME_LENGTH = 64;

/** The generated frontmatter block at the start of `text`, or undefined. */
function generatedBlock(text: string): string | undefined {
  if (!text.startsWith(OPENING_LINE)) {
    return undefined;
  }

  const end = text.indexOf(CLOSING_LINE, OPENING_LINE.length - 1);
  if (end === -1) {
    return undefined;
  }

  const block = text.slice(0, end + CLOSING_LINE.length);
  return block.includes(GENERATED_AGENT_MARKER) ? block : undefined;
}

/** A `tools:` entry or selector in the built-in form; another plugin's entry stays. */
function translateGrant(entry: string, serverPrefix: string): string {
  return entry.replace(/^mcp:([^/]*)/, (selector, key: string) =>
    key.startsWith(serverPrefix) && key.endsWith("_") ? `mcp:${key.slice(0, -1)}` : selector,
  );
}

/** An `excludeTools:` name in the built-in form; undefined when Pi would cut it. */
function translateExclude(name: string, toolPrefix: string): string | undefined {
  if (!name.startsWith(toolPrefix)) {
    return name;
  }

  const translated = name.replaceAll(/\W/g, "_");
  return translated.length > MAX_TOOL_NAME_LENGTH ? undefined : translated;
}

/** A warning in the built-in form: the async text, and the cannot-narrow selector. */
function translateWarning(warning: string, serverPrefix: string): string {
  if (warning === mcpAsyncWarning("adapter")) {
    return mcpAsyncWarning("builtin");
  }

  const at = warning.indexOf(NARROW_GRANT_LEAD);
  if (at === -1) {
    return warning;
  }

  const start = at + NARROW_GRANT_LEAD.length;
  return (
    warning.slice(0, start) +
    warning.slice(start).replace(/^\S+/, (selector) => translateGrant(selector, serverPrefix))
  );
}

function isTranslated(line: string | undefined): line is string {
  return line !== undefined;
}

/** One block line in the built-in form; undefined when the translation gives up. */
function translateLine(line: string, serverPrefix: string): string | undefined {
  if (line.startsWith(TOOLS_KEY)) {
    const entries = line.slice(TOOLS_KEY.length).split(",");
    return TOOLS_KEY + entries.map((entry) => translateGrant(entry, serverPrefix)).join(",");
  }

  if (line.startsWith(EXCLUDE_TOOLS_KEY)) {
    const names = line
      .slice(EXCLUDE_TOOLS_KEY.length)
      .split(",")
      .map((name) => translateExclude(name, `mcp__${serverPrefix}`));
    return names.every(isTranslated) ? EXCLUDE_TOOLS_KEY + names.join(",") : undefined;
  }

  if (line.startsWith(LIST_ITEM)) {
    return LIST_ITEM + translateWarning(line.slice(LIST_ITEM.length), serverPrefix);
  }

  return line;
}

/** The block in the built-in form; undefined when the translation gives up. */
function translateBlock(block: string, serverPrefix: string): string | undefined {
  const lines = block.split("\n").map((line) => translateLine(line, serverPrefix));
  return lines.every(isTranslated) ? lines.join("\n") : undefined;
}

/**
 * P4-DC-06: `row` with the grant forms derived from its legacy file's text,
 * recording that the file holds the adapter form. The built-in form is
 * absent when the translation gives up, so a later load does not retry it.
 * Undefined when `fileText` is not a generated agent: no opening `---` line,
 * no closing `---` line, or no generated marker inside the block.
 */
export function deriveLegacyGrantForms(
  fileText: string,
  row: AgentsIndexEntry,
): AgentsIndexEntry | undefined {
  const block = generatedBlock(fileText);
  if (block === undefined) {
    return undefined;
  }

  // Every adapter key of the plugin starts with its built-in name prefix.
  const serverPrefix = builtinMcpServerName(row.plugin, "");
  const adapter = {
    frontmatter: block,
    warnings: [...row.warnings],
    droppedTools: [...row.droppedTools],
  };
  const translated = translateBlock(block, serverPrefix);
  if (translated === undefined) {
    return { ...row, mcpImplementation: "adapter", mcpForms: { adapter } };
  }

  const builtin = {
    frontmatter: translated,
    warnings: row.warnings.map((warning) => translateWarning(warning, serverPrefix)),
    droppedTools: [...row.droppedTools],
  };
  return { ...row, mcpImplementation: "adapter", mcpForms: { adapter, builtin } };
}

/**
 * @fileoverview Pi's `tool_search` result in a model call, reduced to the
 * facts this extension owns, so a built-in MCP scenario can state a tool
 * search without stating Pi's wording (BLT-01).
 *
 * The facts are the tools a search loads: each tool's name, which this
 * extension gives (`mcp__plugin_<plugin>_<server>__<tool>`), and the first
 * line of its description, which the stub server declares. A projection
 * keeps them in the form `features/lib/upstream/mcp.ts` gives a search
 * through pi-mcp-adapter's `mcp` tool: one line `found <tool>: <description>`
 * per tool, sorted by tool name because the order is Pi's ranking, or
 * `found no tools`. Counts and hints are Pi's, so the projection drops them,
 * and it throws with the text when it cannot read it, so a real format break
 * fails the scenario.
 */

import { projectTokens, type RunTokens } from "./run-tokens.ts";

const TOOL_LINE_PATTERN = /^-\s*(\S+?):\s?(.*)$/;
const LOADED_PATTERN = /\bloaded\s+\d+\s+tools?\b/i;
const NONE_PATTERN = /\bno matching tools?\b/i;

// Ids drawn for each run and U+200B, projected as the frozen calls step
// projects them.
const RUN_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gu;
const INPUT_MARK_PATTERN = /\u200B/gu;

const SEARCH_RESULT = "tool_search returned: ";
const SEARCH_FAILURE = "tool_search failed: ";

function unreadable(text: string): Error {
  return new Error(`cannot read pi's tool_search result: ${JSON.stringify(text)}`);
}

/**
 * The tools one `tool_search` result loads, as a scenario states them. Throws
 * on a failed search and on any text it cannot read.
 */
function projectToolSearchResult(text: string, failed: boolean): string {
  if (failed) {
    throw new Error(`pi's tool_search failed: ${JSON.stringify(text)}`);
  }

  const [header = "", ...body] = text.split("\n").map((line) => line.trim());
  if (NONE_PATTERN.test(header) && body.every((line) => line === "")) {
    return "found no tools";
  }

  const tools: (readonly [tool: string, description: string])[] = [];
  for (const line of body.filter((bodyLine) => bodyLine !== "")) {
    const match = TOOL_LINE_PATTERN.exec(line);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw unreadable(text);
    }

    tools.push([match[1], match[2]]);
  }

  if (!LOADED_PATTERN.test(header) || tools.length === 0) {
    throw unreadable(text);
  }

  return tools
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tool, description]) => `found ${tool}: ${description}`)
    .join("\n");
}

function projectedText(text: string, tokens: RunTokens): string {
  const projected = projectTokens("text", text, tokens)
    .replaceAll(RUN_ID_PATTERN, "{uuid}")
    .replaceAll(INPUT_MARK_PATTERN, "{zero width space}");
  if (projected.startsWith(SEARCH_RESULT)) {
    return SEARCH_RESULT + projectToolSearchResult(projected.slice(SEARCH_RESULT.length), false);
  }

  return projected.startsWith(SEARCH_FAILURE)
    ? projectToolSearchResult(projected.slice(SEARCH_FAILURE.length), true)
    : projected;
}

/**
 * The `[call, role, text]` rows of a turn's model calls with the run tokens,
 * run ids, and input marks projected as the frozen calls step projects them,
 * and each tool search reduced to the tools it loads.
 */
export function toolSearchCallRows(
  rows: readonly (readonly [string, string, string])[],
  tokens: RunTokens,
): string[][] {
  return rows.map(([call, role, text]) => [call, role, projectedText(text, tokens)]);
}

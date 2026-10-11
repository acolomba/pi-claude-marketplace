import { hookDebugLog } from "../../../shared/debug-log.ts";
import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "../hook-tool-names.ts";

const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;
const CLAUDE_TO_PI_TOOL_NAME_LOOKUP: ReadonlyMap<string, PiToolName> = new Map(
  Object.entries(CLAUDE_TO_PI_TOOL_NAMES),
);

/**
 * A tool-set matcher fires on a tool whose name is in `toolNames` or starts
 * with one of `toolPrefixes`. `toolPrefixes` is present only when at least
 * one alternative was an MCP server prefix (ANAME-02).
 */
export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; toolNames: ReadonlySet<string>; toolPrefixes?: readonly string[] }
  | { kind: "regex" }
  | { kind: "unmapped"; token: string };

type Alternative =
  | { readonly kind: "regex" }
  | { readonly kind: "tool"; readonly toolName: string }
  | { readonly kind: "prefix"; readonly prefix: string }
  | { readonly kind: "discarded" };

/**
 * ANAME-02: returns `mcp__<server>__` for the server-prefix form
 * `mcp__<server>__.*`, or undefined for any other token. Only string
 * operations read the token, so no regular expression is built from
 * plugin-supplied text.
 */
function mcpServerPrefix(token: string): string | undefined {
  if (!token.startsWith("mcp__") || !token.endsWith("__.*")) {
    return undefined;
  }

  const server = token.slice("mcp__".length, -"__.*".length);
  return MCP_SEGMENT.test(server) ? `mcp__${server}__` : undefined;
}

function isMcpLiteral(raw: string): boolean {
  if (!raw.startsWith("mcp__")) {
    return false;
  }

  const body = raw.slice("mcp__".length);
  const separatorIndex = body.lastIndexOf("__");
  if (separatorIndex <= 0 || separatorIndex >= body.length - 2) {
    return false;
  }

  return (
    MCP_SEGMENT.test(body.slice(0, separatorIndex)) &&
    MCP_SEGMENT.test(body.slice(separatorIndex + 2))
  );
}

/**
 * MATCH-02: the server-prefix form is the one regex-shaped alternative
 * accepted. Any other alternative that is empty or holds a character
 * outside `SAFE_MATCHER_CHARS` is one a plugin author could use to smuggle
 * a regex, and it makes the whole matcher `regex`.
 */
function classifyAlternative(token: string): Alternative {
  const prefix = mcpServerPrefix(token);
  if (prefix !== undefined) {
    return { kind: "prefix", prefix };
  }

  if (!SAFE_MATCHER_CHARS.test(token)) {
    return { kind: "regex" };
  }

  const piTool = CLAUDE_TO_PI_TOOL_NAME_LOOKUP.get(token);
  if (piTool !== undefined) {
    return { kind: "tool", toolName: piTool };
  }

  return isMcpLiteral(token) ? { kind: "tool", toolName: token } : { kind: "discarded" };
}

/**
 * Parses a Claude hook matcher into its dispatch-safe form. A pipe-OR
 * matcher degrades per alternative (TOOL-02, MATCH-02, #217): each
 * alternative is classified on its own, a mapped Claude tool or an MCP
 * literal joins `toolNames`, an MCP server prefix joins `toolPrefixes`
 * (ANAME-02), and any other alternative is discarded. The matcher itself
 * only degrades to `unmapped` when every alternative was discarded, so
 * `Write|Edit|apply_patch` keeps firing on `write` and `edit` while
 * `apply_patch` alone still drops.
 */
export function parseMatcher(raw: string): ParsedMatcher {
  if (raw === "" || raw === "*") {
    return { kind: "match-all" };
  }

  const toolNames = new Set<string>();
  const toolPrefixes: string[] = [];
  // The empty-string sentinel for "no alternative discarded yet" is safe:
  // an empty alternative classifies as `regex` and returns before reaching
  // the discard arm, so no real discarded alternative is ever `""`.
  let firstDiscarded = "";
  for (const token of raw.split("|")) {
    const alternative = classifyAlternative(token);
    switch (alternative.kind) {
      case "regex":
        return { kind: "regex" };
      case "tool":
        toolNames.add(alternative.toolName);
        break;
      case "prefix":
        toolPrefixes.push(alternative.prefix);
        break;
      case "discarded":
        hookDebugLog(
          `parseMatcher: alternative "${token}" in "${raw}" has no Pi tool mapping; discarding`,
        );
        if (firstDiscarded.length === 0) {
          firstDiscarded = token;
        }

        break;
    }
  }

  if (toolNames.size === 0 && toolPrefixes.length === 0) {
    return { kind: "unmapped", token: firstDiscarded };
  }

  return toolPrefixes.length === 0
    ? { kind: "tool-set", toolNames }
    : { kind: "tool-set", toolNames, toolPrefixes };
}

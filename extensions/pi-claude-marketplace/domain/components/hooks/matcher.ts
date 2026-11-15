import { hookDebugLog } from "../../../shared/debug-log.ts";
import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "../hook-tool-names.ts";

const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_ ,|-]+$/;
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;
const CLAUDE_TO_PI_TOOL_NAME_LOOKUP: ReadonlyMap<string, PiToolName> = new Map(
  Object.entries(CLAUDE_TO_PI_TOOL_NAMES),
);

/**
 * A parsed matcher ready for support checks and runtime dispatch. A tool
 * matcher never holds `name-set`, and a name matcher never holds `tool-set`
 * or `unmapped`.
 */
export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; toolNames: ReadonlySet<string> }
  | { kind: "name-set"; names: ReadonlySet<string> }
  | { kind: "regex"; pattern: RegExp }
  | { kind: "invalid-pattern" }
  | { kind: "unmapped"; token: string };

type PatternMatcher = Extract<ParsedMatcher, { kind: "match-all" | "regex" | "invalid-pattern" }>;

type Alternative =
  { readonly kind: "tool"; readonly toolName: string } | { readonly kind: "discarded" };

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
 * Classifies an exact-list member after separators and surrounding spaces
 * have been removed.
 */
function classifyAlternative(token: string): Alternative {
  const piTool = CLAUDE_TO_PI_TOOL_NAME_LOOKUP.get(token);
  if (piTool !== undefined) {
    return { kind: "tool", toolName: piTool };
  }

  return isMcpLiteral(token) ? { kind: "tool", toolName: token } : { kind: "discarded" };
}

/**
 * The match-all and pattern states of a whole matcher, before an exact list
 * is split. A text outside the safe characters is a JavaScript RegExp without
 * flags or anchors. An invalid regex has a distinct state so admission can
 * drop only its group. An exact list gives `undefined`.
 */
function parsePattern(raw: string): PatternMatcher | undefined {
  if (raw === "" || raw === "*") {
    return { kind: "match-all" };
  }

  if (SAFE_MATCHER_CHARS.test(raw)) {
    return undefined;
  }

  try {
    return { kind: "regex", pattern: new RegExp(raw) };
  } catch {
    return { kind: "invalid-pattern" };
  }
}

/** The members of an exact list, split on `|` or `,`, trimmed, empty ones dropped. */
function exactListMembers(raw: string): string[] {
  return raw
    .split(/[|,]/)
    .map((token) => token.trim())
    .filter((token) => token !== "");
}

/**
 * Parses a whole tool matcher before splitting exact-list alternatives, each
 * of which maps to a Pi tool name.
 */
export function parseMatcher(raw: string): ParsedMatcher {
  const pattern = parsePattern(raw);
  if (pattern !== undefined) {
    return pattern;
  }

  const toolNames = new Set<string>();
  let firstDiscarded = "";
  for (const token of exactListMembers(raw)) {
    const alternative = classifyAlternative(token);
    switch (alternative.kind) {
      case "tool":
        toolNames.add(alternative.toolName);
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

  if (toolNames.size === 0 && firstDiscarded !== "") {
    return { kind: "unmapped", token: firstDiscarded };
  }

  return { kind: "tool-set", toolNames };
}

/**
 * D-PG6-19: parses a matcher on a command name by the rules of a tool matcher,
 * with no tool name map. An exact-list member is kept as written,
 * case-sensitive and not normalized.
 */
export function parseNameMatcher(raw: string): ParsedMatcher {
  return parsePattern(raw) ?? { kind: "name-set", names: new Set(exactListMembers(raw)) };
}

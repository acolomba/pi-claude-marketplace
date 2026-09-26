import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "../hook-tool-names.ts";

const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;
const CLAUDE_TO_PI_TOOL_NAME_LOOKUP: ReadonlyMap<string, PiToolName> = new Map(
  Object.entries(CLAUDE_TO_PI_TOOL_NAMES),
);

export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; toolNames: ReadonlySet<string> }
  | { kind: "regex" }
  | { kind: "unmapped"; token: string };

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
 * Parse a Claude hook matcher into its dispatch-safe form. A pipe-OR
 * matcher degrades per alternative (TOOL-02, MATCH-02, #217): each
 * alternative is classified on its own, a mapped Claude tool or an MCP
 * literal joins `toolNames`, and any other alternative is discarded. The
 * matcher itself only degrades to `unmapped` when every alternative was
 * discarded, so `Write|Edit|apply_patch` keeps firing on `write` and
 * `edit` while `apply_patch` alone still drops.
 */
export function parseMatcher(raw: string): ParsedMatcher {
  if (raw === "" || raw === "*") {
    return { kind: "match-all" };
  }

  // MATCH-02: reject anything a plugin author could use to smuggle a regex
  // before any MCP handling runs. `MCP_SEGMENT` admits only
  // `[A-Za-z0-9_-]`, a strict subset of `SAFE_MATCHER_CHARS`, so every
  // MCP-shaped alternative already passes this check.
  if (!SAFE_MATCHER_CHARS.test(raw)) {
    return { kind: "regex" };
  }

  const toolNames = new Set<string>();
  // The empty-string sentinel for "no alternative discarded yet" is safe:
  // an empty alternative returns `regex` below before reaching the
  // discard arm, so no real discarded alternative is ever `""`.
  let firstDiscarded = "";
  for (const token of raw.split("|")) {
    if (token.length === 0) {
      return { kind: "regex" };
    }

    const piTool = CLAUDE_TO_PI_TOOL_NAME_LOOKUP.get(token);
    if (piTool !== undefined) {
      toolNames.add(piTool);
    } else if (isMcpLiteral(token)) {
      toolNames.add(token);
    } else if (firstDiscarded.length === 0) {
      firstDiscarded = token;
    }
  }

  if (toolNames.size === 0) {
    return { kind: "unmapped", token: firstDiscarded };
  }

  return { kind: "tool-set", toolNames };
}

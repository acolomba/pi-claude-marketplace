import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "../hook-tool-names.ts";

const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;

export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; piTools: ReadonlySet<PiToolName> }
  | { kind: "mcp-literal"; literal: string }
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

/** Parse a Claude hook matcher into its dispatch-safe form. */
export function parseMatcher(raw: string): ParsedMatcher {
  if (raw === "" || raw === "*") {
    return { kind: "match-all" };
  }

  if (isMcpLiteral(raw)) {
    return { kind: "mcp-literal", literal: raw };
  }

  if (!SAFE_MATCHER_CHARS.test(raw)) {
    return { kind: "regex" };
  }

  const piTools = new Set<PiToolName>();
  for (const token of raw.split("|")) {
    if (token.length === 0) {
      return { kind: "regex" };
    }

    const piTool = (CLAUDE_TO_PI_TOOL_NAMES as Record<string, PiToolName | undefined>)[token];
    if (piTool === undefined) {
      return { kind: "unmapped", token };
    }

    piTools.add(piTool);
  }

  return { kind: "tool-set", piTools };
}

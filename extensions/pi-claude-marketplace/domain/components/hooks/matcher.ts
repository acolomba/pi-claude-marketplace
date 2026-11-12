import { hookDebugLog } from "../../../shared/debug-log.ts";
import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "../hook-tool-names.ts";

const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_ ,|-]+$/;
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;
const CLAUDE_TO_PI_TOOL_NAME_LOOKUP: ReadonlyMap<string, PiToolName> = new Map(
  Object.entries(CLAUDE_TO_PI_TOOL_NAMES),
);

/** A parsed tool matcher ready for support checks and runtime dispatch. */
export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; toolNames: ReadonlySet<string> }
  | { kind: "regex"; pattern: RegExp }
  | { kind: "invalid-pattern" }
  | { kind: "unmapped"; token: string };

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
 * Parses a whole matcher before splitting exact-list alternatives. Other
 * patterns use JavaScript RegExp without flags or anchors. An invalid regex
 * has a distinct state so admission can drop only its group.
 */
export function parseMatcher(raw: string): ParsedMatcher {
  if (raw === "" || raw === "*") {
    return { kind: "match-all" };
  }

  if (!SAFE_MATCHER_CHARS.test(raw)) {
    try {
      return { kind: "regex", pattern: new RegExp(raw) };
    } catch {
      return { kind: "invalid-pattern" };
    }
  }

  const toolNames = new Set<string>();
  let firstDiscarded = "";
  for (const rawToken of raw.split(/[|,]/)) {
    const token = rawToken.trim();
    if (token === "") {
      continue;
    }

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

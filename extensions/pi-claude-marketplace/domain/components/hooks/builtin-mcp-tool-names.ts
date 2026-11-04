// domain/components/hooks/builtin-mcp-tool-names.ts
//
// How a hook matcher or `if` field names a tool that Pi's built-in MCP serves
// (MHK-01). Claude Code names an MCP tool `mcp__<server>__<tool>` with `-`
// kept in both segments. Pi 1.5.0 names it with its `createMcpToolName`
// (`dist/extensions/mcp/tools.js`): every character of that text outside
// `[A-Za-z0-9_]` becomes `_`, and a name over 64 characters, or one that
// another tool already holds, keeps its first 55 characters, then `_` and the
// first 8 hex of the sha256 of `<server>\0<tool>`. Pi keeps the server's
// registered name as the tool's namespace alias, but not the tool's own name
// (D-MB-08), so only the server segment can be compared in Claude's form.
//
// The frozen implementation profile has its own copy of that computation,
// which takes a plugin and its server; it cannot name the tools of a server
// that Pi's `mcp.json` configures, so this module does not reuse it.

import { createHash } from "node:crypto";

// Pi 1.5.0 `createMcpToolName`: the longest name, and the hex digits of the
// hash a cut or taken name ends with.
const PI_NAME_LIMIT = 64;
const PI_NAME_HASH_DIGITS = 8;

// Without the `u` flag, `\W` is exactly Pi's `[^A-Za-z0-9_]`, applied to each
// UTF-16 code unit.
const PI_FOLDED_CHARACTER = /\W/g;

const MCP_PREFIX = "mcp__";
const SEGMENT_SEPARATOR = "__";

/**
 * The tool of a tool event, as hook matchers and `if` fields compare it
 * (D-P5-01, D-P5-05).
 */
export interface McpToolIdentity {
  /** The tool name Pi gives the event. */
  readonly piName: string;
  /**
   * The registered name of the server, with `-` kept, when Pi's built-in MCP
   * serves the tool; `undefined` for every other tool.
   */
  readonly builtinServer: string | undefined;
}

// Every name Pi 1.5.0 can give the tool `tool` of the server `server`: the
// folded name and its hashed form when the folded name fits, else only the
// hashed form. Which one Pi chose depends on the server's other tools.
function piToolNames(server: string, tool: string): readonly string[] {
  const digest = createHash("sha256").update(`${server}\0${tool}`).digest("hex");
  const folded = `${MCP_PREFIX}${server}${SEGMENT_SEPARATOR}${tool}`.replaceAll(
    PI_FOLDED_CHARACTER,
    "_",
  );
  const hashed = [
    folded.slice(0, PI_NAME_LIMIT - PI_NAME_HASH_DIGITS - 1),
    digest.slice(0, PI_NAME_HASH_DIGITS),
  ].join("_");
  return folded.length > PI_NAME_LIMIT ? [hashed] : [folded, hashed];
}

// The `mcp__<server>__` text that starts Claude Code's names of the server's
// tools.
function claudeServerPrefix(server: string): string {
  return `${MCP_PREFIX}${server}${SEGMENT_SEPARATOR}`;
}

/**
 * D-P5-04 / D-P5-05: whether the MCP literal `mcp__<S>__<T>` of a matcher or
 * an `if` field names `tool`. A tool of Pi's built-in MCP is named when `<S>`
 * is its server's registered name and Pi names `<T>` of that server as the
 * event's tool, so Claude's full name fires and so does the name with the
 * tool segment folded, while a folded server segment does not. Every other
 * tool is named only by Pi's own name, which is already Claude's form.
 */
export function toolLiteralNames(literal: string, tool: McpToolIdentity): boolean {
  if (tool.builtinServer === undefined) {
    return literal === tool.piName;
  }

  const prefix = claudeServerPrefix(tool.builtinServer);
  if (!literal.startsWith(prefix) || literal.length === prefix.length) {
    return false;
  }

  return piToolNames(tool.builtinServer, literal.slice(prefix.length)).includes(tool.piName);
}

/**
 * D-P5-04 / D-P5-05: whether the server prefix `mcp__<S>__` of a matcher or an
 * `if` field names the server of `tool`. For a tool of Pi's built-in MCP, `<S>`
 * must be the server's registered name; every other tool's Pi name must start
 * with the prefix.
 */
export function serverPrefixNames(prefix: string, tool: McpToolIdentity): boolean {
  return tool.builtinServer === undefined
    ? tool.piName.startsWith(prefix)
    : prefix === claudeServerPrefix(tool.builtinServer);
}

/**
 * D-P5-02: the name a hook sees for the tool `piName` of Pi's built-in MCP,
 * whose namespace is `namespace` (Pi's `mcp__<server with - folded>`) and whose
 * server registered as `server`: `mcp__<server>__<the rest of Pi's name>`. When
 * Pi cut the name inside the namespace, the hook sees Pi's name.
 */
export function claudeFormToolName(piName: string, namespace: string, server: string): string {
  const piPrefix = `${namespace}${SEGMENT_SEPARATOR}`;
  return piName.startsWith(piPrefix)
    ? `${claudeServerPrefix(server)}${piName.slice(piPrefix.length)}`
    : piName;
}

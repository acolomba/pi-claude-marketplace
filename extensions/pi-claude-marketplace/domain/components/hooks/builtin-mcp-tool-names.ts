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
// The implementation profile supplies the adapter's fit rule. Its built-in
// computation takes a plugin and its server, so this module keeps Pi's rule
// for tools of a server that Pi's `mcp.json` configures.

import { createHash } from "node:crypto";

import { fittedAdapterToolName } from "../../mcp-implementation.ts";

// Pi 1.5.0 `createMcpToolName`: the longest name, and the hex digits of the
// hash a cut or taken name ends with.
const PI_NAME_LIMIT = 64;
const PI_NAME_HASH_DIGITS = 8;
const PI_KEPT_NAME_LENGTH = PI_NAME_LIMIT - PI_NAME_HASH_DIGITS - 1;
const ADAPTER_HASH_SUFFIX = new RegExp(`_[0-9a-f]{${PI_NAME_HASH_DIGITS}}$`);

// Without the `u` flag, `\W` is exactly Pi's `[^A-Za-z0-9_]`, applied to each
// UTF-16 code unit.
const PI_FOLDED_CHARACTER = /\W/g;

/** The text that starts every MCP tool name, in Claude Code and in Pi. */
export const MCP_TOOL_PREFIX = "mcp__";

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
  /** D-PG1-08: the full adapter name recovered for this tool. */
  readonly claudeName?: string;
}

/** D-PG1-08: the cut shape pi-mcp-adapter 7.0.1 tests in its resolver. */
export function looksLikeCutAdapterToolName(name: string): boolean {
  return (
    name.length === PI_NAME_LIMIT &&
    name.startsWith(MCP_TOOL_PREFIX) &&
    ADAPTER_HASH_SUFFIX.test(name)
  );
}

/**
 * D-PG1-08: recover a tool's full name from verified result details or hook
 * literals. A literal must exceed the adapter's limit to identify a cut name.
 */
export function recoverAdapterToolName(
  tool: McpToolIdentity,
  candidates: () => readonly string[],
  verifiedName?: string,
): McpToolIdentity {
  if (tool.builtinServer !== undefined || !looksLikeCutAdapterToolName(tool.piName)) {
    return tool;
  }

  if (verifiedName !== undefined && fittedAdapterToolName(verifiedName) === tool.piName) {
    return { ...tool, claudeName: verifiedName };
  }

  const claudeName = candidates().find(
    (candidate) =>
      candidate.length > PI_NAME_LIMIT && fittedAdapterToolName(candidate) === tool.piName,
  );
  return claudeName === undefined ? tool : { ...tool, claudeName };
}

// Every name Pi 1.5.0 can give the tool `tool` of the server `server`: the
// folded name and its hashed form when the folded name fits, else only the
// hashed form. Which one Pi chose depends on the server's other tools.
function piToolNames(server: string, tool: string): readonly string[] {
  const digest = createHash("sha256").update(`${server}\0${tool}`).digest("hex");
  const folded = `${MCP_TOOL_PREFIX}${server}${SEGMENT_SEPARATOR}${tool}`.replaceAll(
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
  return `${MCP_TOOL_PREFIX}${server}${SEGMENT_SEPARATOR}`;
}

/**
 * D-P5-04 / D-P5-05: whether the MCP literal `mcp__<S>__<T>` of a matcher or
 * an `if` field names `tool`. A tool of Pi's built-in MCP is named when `<S>`
 * is its server's registered name and Pi names `<T>` of that server as the
 * event's tool. So Claude's full name always fires, and a folded server
 * segment never does. The name with the tool segment folded fires only when
 * Pi did not end the tool's name with a hash. Pi adds the hash to a name over
 * 64 characters and to a name that another tool of the server already holds,
 * such as `a-b` beside `a_b`. Pi hashes the tool's original name, which a
 * folded `<T>` no longer spells. A tool pi-mcp-adapter shortened is also
 * named by the full name the adapter cut (D-PG1-08).
 */
export function toolLiteralNames(literal: string, tool: McpToolIdentity): boolean {
  if (tool.builtinServer === undefined) {
    return literal === tool.piName || fittedAdapterToolName(literal) === tool.piName;
  }

  const prefix = claudeServerPrefix(tool.builtinServer);
  if (!literal.startsWith(prefix)) {
    return false;
  }

  return piToolNames(tool.builtinServer, literal.slice(prefix.length)).includes(tool.piName);
}

/**
 * D-P5-04 / D-P5-05: whether the server prefix `mcp__<S>__` of a matcher or an
 * `if` field names the server of `tool`. For a tool of Pi's built-in MCP, `<S>`
 * must be the server's registered name. For an adapter cut, a recovered full
 * name is compared instead. Without one, a prefix longer than the kept part
 * cannot name the tool: a sibling server can share those characters, and a
 * hook running for the wrong server is worse than one that does not run.
 */
export function serverPrefixNames(prefix: string, tool: McpToolIdentity): boolean {
  if (tool.builtinServer !== undefined) {
    return prefix === claudeServerPrefix(tool.builtinServer);
  }

  if (tool.claudeName !== undefined) {
    return tool.claudeName.startsWith(prefix);
  }

  return (
    (!looksLikeCutAdapterToolName(tool.piName) || prefix.length <= PI_KEPT_NAME_LENGTH) &&
    tool.piName.startsWith(prefix)
  );
}

/**
 * D-P5-02, D-P5-03: the name every hook sees for `tool`. For a tool of Pi's
 * built-in MCP it is `mcp__<server>__<the rest of Pi's name>`, where the rest
 * follows the server segment as Pi folds it into each name of the server's
 * tools. The folded `mcp__<server>__` is Pi's namespace of the server plus
 * `__`. When Pi cut the name inside that segment, and for every other tool,
 * the hook sees Pi's name (D-P5-05). When dispatch recovers the adapter's
 * full name from a hook literal, every hook sees that name (D-PG1-08).
 */
export function claudeFormToolName(tool: McpToolIdentity): string {
  if (tool.builtinServer === undefined) {
    return tool.claudeName ?? tool.piName;
  }

  const claudePrefix = claudeServerPrefix(tool.builtinServer);
  const piPrefix = claudePrefix.replaceAll(PI_FOLDED_CHARACTER, "_");
  return tool.piName.startsWith(piPrefix)
    ? `${claudePrefix}${tool.piName.slice(piPrefix.length)}`
    : tool.piName;
}

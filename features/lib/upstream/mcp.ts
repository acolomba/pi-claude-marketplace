/**
 * @fileoverview pi-mcp-adapter texts a scenario reads, reduced to the facts
 * this extension owns. The adapter words its `mcp` proxy output itself, and a
 * release may reword it, so no feature file states that wording.
 *
 * The facts this extension owns are the names it gives: each server key
 * (`plugin_<plugin>_<server>_`), each tool name (`mcp__<key>_<tool>`, from the
 * key and the `toolPrefix` it writes), and the description each stub tool
 * declares, plus the `disabled` flag it writes and the project scope that
 * gets a server blocked. A projection keeps those facts in a form of our own:
 *
 * - the server status list: one line `server <key>` per server, with
 *   ` disabled` or ` blocked` after it, or `no servers`;
 * - the tools of one server: one line `server <key> tool <tool>: <description>`
 *   per tool;
 * - a search: one line `found <tool>: <description>` per tool, or
 *   `found no tools`;
 * - a call to an unknown tool: `no tool <tool>`, then
 *   `server <key> tools: <tool>, <tool>` when the adapter names the server's
 *   tools.
 *
 * Counts, glyphs, hints, cache and connection notes, and the reasons for a
 * block are the adapter's, so a projection drops them. Any other text is the
 * stub server's own answer, such as `echo:ping`, and stays as it is. Each
 * reader anchors on the names above and fails loudly on a text that looks
 * like the adapter's but cannot be read, so a real format break fails the
 * scenario with the text in the message.
 */

const SERVER_KEY = String.raw`plugin_[A-Za-z0-9_-]*_`;
const TOOL_NAME = String.raw`mcp__[A-Za-z0-9_-]+`;

const TOOL_NAME_PATTERN = new RegExp(TOOL_NAME);
const TOOL_NAMES_PATTERN = new RegExp(TOOL_NAME, "g");
const TOOL_LINE_PATTERN = new RegExp(String.raw`^${TOOL_NAME}$`);
const STATUS_HEADER_PATTERN = /^MCP\b/;
const STATUS_SERVER_PATTERN = new RegExp(String.raw`(?:^|\s)(${SERVER_KEY})(?=\s|$)(.*)$`);
const SERVER_TOOLS_HEADER_PATTERN = new RegExp(String.raw`^(${SERVER_KEY})\s*\(\d+ tools?\)`);
const SERVER_TOOL_LINE_PATTERN = new RegExp(String.raw`^\W*(${TOOL_NAME})\b.*? - (.+)$`);
const NOT_FOUND_PATTERN = new RegExp(String.raw`(${TOOL_NAME})\W*\s(?:was )?not found\b`, "i");
const SERVER_HAS_PATTERN = new RegExp(String.raw`(${SERVER_KEY})\W*\s+has\b:?(.*)$`, "m");
const NO_MATCH_PATTERN = /\bno tools? match/i;
const FOUND_PATTERN = /\bfound \d+ tools?\b/i;
const HINT_PATTERN = /\bmcp\(/;

function unreadable(text: string): Error {
  return new Error(`cannot read pi-mcp-adapter's mcp result: ${JSON.stringify(text)}`);
}

function lines(text: string): string[] {
  return text.split("\n").map((line) => line.trim());
}

// The state word of one status line: only the states this extension causes.
function serverState(rest: string): string {
  if (/\bdisabled\b/i.test(rest)) {
    return " disabled";
  }

  return /\bblocked\b/i.test(rest) ? " blocked" : "";
}

// The status list: a header line, then one line per server, then hints.
function projectStatus(text: string): string {
  const [, ...body] = lines(text);
  const servers = body.flatMap((line) => {
    if (line === "" || HINT_PATTERN.test(line)) {
      return [];
    }

    const match = STATUS_SERVER_PATTERN.exec(line);
    if (match?.[1] === undefined) {
      throw unreadable(text);
    }

    return [`server ${match[1]}${serverState(match[2] ?? "")}`];
  });
  return servers.length === 0 ? "no servers" : servers.join("\n");
}

// The tools of one server: a header naming the server, then one line per tool.
function projectServerTools(server: string, text: string): string {
  const [, ...body] = lines(text);
  const tools = body.flatMap((line) => {
    if (line === "") {
      return [];
    }

    const match = SERVER_TOOL_LINE_PATTERN.exec(line);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw unreadable(text);
    }

    return [`server ${server} tool ${match[1]}: ${match[2].trim()}`];
  });
  if (tools.length === 0) {
    throw unreadable(text);
  }

  return tools.join("\n");
}

function projectNotFound(tool: string, text: string): string {
  const has = SERVER_HAS_PATTERN.exec(text);
  if (has?.[1] === undefined) {
    return `no tool ${tool}`;
  }

  const tools = [...(has[2] ?? "").matchAll(TOOL_NAMES_PATTERN)].map(([name]) => name);
  return `no tool ${tool}\nserver ${has[1]} tools: ${tools.join(", ")}`;
}

// A search result names each matching tool on a line of its own, with its
// description on the next line that is not empty.
function projectFound(text: string): string {
  const body = lines(text);
  const found = body.flatMap((line, index) => {
    if (!TOOL_LINE_PATTERN.test(line)) {
      return [];
    }

    const description = body.slice(index + 1).find((next) => next !== "");
    if (description === undefined) {
      throw unreadable(text);
    }

    return [`found ${line}: ${description}`];
  });
  if (found.length === 0) {
    throw unreadable(text);
  }

  return found.join("\n");
}

/** An `mcp` proxy result, reduced to the facts this extension owns. */
export function projectMcpResult(text: string): string {
  if (STATUS_HEADER_PATTERN.test(text)) {
    return projectStatus(text);
  }

  const serverTools = SERVER_TOOLS_HEADER_PATTERN.exec(text);
  if (serverTools?.[1] !== undefined) {
    return projectServerTools(serverTools[1], text);
  }

  const notFound = NOT_FOUND_PATTERN.exec(text);
  if (notFound?.[1] !== undefined) {
    return projectNotFound(notFound[1], text);
  }

  if (NO_MATCH_PATTERN.test(text)) {
    return "found no tools";
  }

  if (FOUND_PATTERN.test(text)) {
    return projectFound(text);
  }

  if (TOOL_NAME_PATTERN.test(text) || HINT_PATTERN.test(text)) {
    throw unreadable(text);
  }

  return text;
}

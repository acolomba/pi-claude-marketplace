// bridges/mcp/builtin-overrides.ts
//
// BLT-04 / BLT-05: the namespaces of the servers Pi's own `mcp.json` files
// configure. Pi's built-in MCP does not connect a server an extension
// registered when an `mcp.json` server holds its namespace (`mcp__` plus the
// name with `-` folded to `_`), so info reports such a plugin server as
// `overridden by mcp.json` (P2-DC-08).
//
// P2-DC-26: the read is synchronous; it is the only `readFileSync` in the
// extension.
//
// P2-DC-15: the checks follow Pi 1.5.0's `readConfigFile`
// (`dist/extensions/mcp/config.js`): a leading BOM is stripped, the text is
// parsed as plain JSON, and a file whose top level is not an object, or whose
// `mcpServers` is present and not an object, configures nothing. Pi then
// validates each entry; this read counts an entry that is an object with a
// string `command` or `url`, which approximates Pi's validated set. A project
// entry with neither only overrides a global server of the same name, which
// already holds the namespace. Any read or parse error reads as no server, so
// the read never throws inside info (T-02-18).
//
// BLT-04 / T-02-18: a missing file configures nothing and leaves no trace, as
// Pi skips a missing `mcp.json`. Any other read error, or text that does not
// parse, also configures nothing and leaves one `mcp`-channel debug line. A
// parse failure is named by a fixed phrase, because the parser's message
// quotes the start of the text, and `mcp.json` holds header and env
// credentials. A shape this read does not count stays silent: Pi reports
// `mcp.json` shape errors itself.

import { readFileSync } from "node:fs";

import { isAbsenceError } from "../../domain/manifest-containment.ts";
import { foldedMcpServerKey } from "../../domain/name.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";

import { isPlainObject } from "./marker.ts";

function traceUnread(error: unknown): void {
  if (isAbsenceError(error)) {
    return;
  }

  const reason = error instanceof SyntaxError ? "the file is not valid JSON" : errorMessage(error);
  hookDebugLog(redactAbsolutePaths(`mcp.json servers not read: ${reason}`), "mcp");
}

function readServerNames(file: string): readonly string[] {
  try {
    const text = readFileSync(file, "utf8");
    const parsed: unknown = JSON.parse(text.codePointAt(0) === 0xfeff ? text.slice(1) : text);
    // An absent `mcpServers` reads as undefined, which configures nothing too.
    const servers = isPlainObject(parsed) ? parsed.mcpServers : undefined;
    if (!isPlainObject(servers)) {
      return [];
    }

    return Object.entries(servers)
      .filter(([, entry]) => definesServer(entry))
      .map(([name]) => name);
  } catch (error: unknown) {
    traceUnread(error);
    return [];
  }
}

function definesServer(entry: unknown): boolean {
  return (
    isPlainObject(entry) && (typeof entry.command === "string" || typeof entry.url === "string")
  );
}

/**
 * Returns the server names the given `mcp.json` files configure, each with
 * `-` folded to `_`, merged across the files. An absent, unreadable, or
 * malformed file adds nothing.
 */
export function readMcpJsonServerNamespaces(files: readonly string[]): ReadonlySet<string> {
  return new Set(files.flatMap(readServerNames).map(foldedMcpServerKey));
}

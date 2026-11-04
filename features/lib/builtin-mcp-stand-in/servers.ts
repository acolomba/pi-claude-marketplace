/**
 * @fileoverview The stub MCP servers that the built-in stand-in registers
 * with Pi's built-in MCP, the file a step names them in, and the log of what
 * the stand-in decided (P1-DC-05).
 *
 * A step writes the list to `<home>/builtin-mcp-stand-in.json` before the
 * profile Pi starts: the harness directory does not exist until the profile
 * Pi starts, so the list sits beside the launch environment's file in the
 * sandbox home. The stand-in reads the list at `session_start` and appends
 * one line per decision to `<harness dir>/builtin-mcp-stand-in.jsonl`. The
 * next scenario's `Before()` empties the sandbox home, so no list outlives
 * its scenario.
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

/** The stand-in extension, which a builtin-profile Pi loads with `--extension`. */
export const BUILTIN_MCP_STAND_IN_EXTENSION = fileURLToPath(
  new URL("extension.ts", import.meta.url),
);

const SERVERS_FILE = "builtin-mcp-stand-in.json";

/** The stand-in's log in the harness directory, one JSON line per decision. */
export const BUILTIN_MCP_STAND_IN_LOG = "builtin-mcp-stand-in.jsonl";

const SERVERS_SCHEMA = Type.Array(
  Type.Object({ plugin: Type.String(), server: Type.String() }, { additionalProperties: false }),
);

const SERVERS_VALIDATOR = Compile(SERVERS_SCHEMA);

/** One stub server the stand-in registers: the plugin and the server name it declares. */
export type StandInServer = Type.Static<typeof SERVERS_SCHEMA>[number];

function serversFile(home: string): string {
  return path.join(home, SERVERS_FILE);
}

/**
 * Returns the stub servers that the list in the sandbox home `home` names,
 * none when no step wrote one. Fails when the list is malformed.
 */
export async function readStandInServers(home: string): Promise<StandInServer[]> {
  let text: string;
  try {
    text = await readFile(serversFile(home), "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const servers: unknown = JSON.parse(text);
  if (!SERVERS_VALIDATOR.Check(servers)) {
    throw new Error(`the stand-in's server list is malformed: ${text}`);
  }

  return servers;
}

/**
 * Replaces the list in the sandbox home `home` with `servers`, through a
 * temporary file and a rename, and returns the path of the list.
 */
export async function writeStandInServers(
  home: string,
  servers: readonly StandInServer[],
): Promise<string> {
  const file = serversFile(home);
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(servers)}\n`, { flag: "wx" });
  await rename(temporary, file);
  return file;
}

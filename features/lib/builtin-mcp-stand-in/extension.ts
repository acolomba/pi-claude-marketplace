/**
 * @fileoverview The built-in stand-in: a Pi extension that registers the
 * stub MCP servers a step named with Pi's built-in MCP, under the names the
 * extension will register them under (P1-DC-05, D-MB-02, D-MB-13).
 *
 * Built-in scenarios need a plugin MCP tool that Pi's built-in MCP serves
 * before the extension registers servers itself. Only the MCP implementation
 * step loads this file, and only under the builtin profile, after every other
 * extension. It registers in its `session_start` handler, after the
 * extension's own registration, made first, which keeps the name.
 * It skips a server when Pi already has a registration of that name, or a
 * server of that name in `<agent dir>/mcp.json` or `<project>/.pi/mcp.json`,
 * comparing names with `-` and `_` folded. So it steps aside once the
 * extension registers its servers.
 *
 * An entry marked `first` is the exception: it stands in for another Pi
 * extension that holds a plugin server's name. The stand-in registers it
 * when Pi loads the stand-in, before any `session_start` handler runs, so Pi
 * refuses the extension's own registration of that name (D-MB-29). Pi
 * applies a registration made at load when the factory returns, and it
 * starts the session only after every extension has loaded. The harness
 * starts Pi in the sandbox project, so the load reads the project directory
 * from `process.cwd()`.
 *
 * It never throws: every failure goes to its log, one JSON line per
 * decision, so a scenario that relied on it fails on the missing tool and
 * the log says why.
 */

import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

import { getAgentDir } from "@earendil-works/pi-coding-agent";

import {
  builtinMcpServerName,
  foldedMcpServerKey,
} from "../../../extensions/pi-claude-marketplace/domain/name.ts";
import { MCP_STUB_SERVER } from "../mcp-stub-server.ts";
import { harnessDirectory } from "../turn-records.ts";

import { BUILTIN_MCP_STAND_IN_LOG, readStandInServers } from "./servers.ts";

import type { StandInServer } from "./servers.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MCP_FILE = "mcp.json";

// One decision of the stand-in about one server, or a failure before any.
type Decision =
  | { readonly decision: "registered"; readonly name: string }
  | { readonly decision: "skipped"; readonly name: string; readonly reason: string }
  | { readonly decision: "failed"; readonly name?: string; readonly error: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// The server names of the `mcpServers` of the mcp.json `file`, none when it is absent.
async function mcpJsonServers(file: string): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const config: unknown = JSON.parse(text);
  const servers =
    typeof config === "object" && config !== null && "mcpServers" in config
      ? config.mcpServers
      : undefined;
  return typeof servers === "object" && servers !== null ? Object.keys(servers) : [];
}

// Why the stand-in leaves `name` alone, or undefined when it registers it.
function skipReason(
  name: string,
  registered: ReadonlyMap<string, string>,
  configured: ReadonlyMap<string, string>,
): string | undefined {
  const folded = foldedMcpServerKey(name);
  const extensionPath = registered.get(folded);
  if (extensionPath !== undefined) {
    return `registered by ${extensionPath}`;
  }

  const file = configured.get(folded);
  return file === undefined ? undefined : `configured in ${file}`;
}

function register(
  pi: ExtensionAPI,
  { plugin, server }: StandInServer,
  registered: ReadonlyMap<string, string>,
  configured: ReadonlyMap<string, string>,
): Decision {
  const name = builtinMcpServerName(plugin, server);
  const reason = skipReason(name, registered, configured);
  if (reason !== undefined) {
    return { decision: "skipped", name, reason };
  }

  try {
    // The stub finds its harness directory through HOME, which Pi's stdio
    // transport passes on with the rest of its environment.
    pi.registerMcpServer(name, {
      command: process.execPath,
      args: [MCP_STUB_SERVER, plugin, server],
      exposure: "deferred",
    });
    return { decision: "registered", name };
  } catch (error: unknown) {
    return { decision: "failed", name, error: errorText(error) };
  }
}

// The entries one pass registers: the ones marked `first` at load, the others at `session_start`.
type Pass = (server: StandInServer) => boolean;

const AT_LOAD: Pass = (server) => server.first === true;
const AT_SESSION_START: Pass = (server) => server.first !== true;

async function decide(
  pi: ExtensionAPI,
  home: string,
  cwd: string,
  pass: Pass,
): Promise<Decision[]> {
  const servers = (await readStandInServers(home)).filter(pass);
  if (servers.length === 0) {
    return [];
  }

  const registered = new Map(
    pi.getMcpServers().map((entry) => [foldedMcpServerKey(entry.name), entry.extensionPath]),
  );
  const files = [path.join(getAgentDir(), MCP_FILE), path.join(cwd, ".pi", MCP_FILE)];
  const configured = new Map<string, string>();
  for (const file of files) {
    for (const name of await mcpJsonServers(file)) {
      configured.set(foldedMcpServerKey(name), file);
    }
  }

  return servers.map((server) => register(pi, server, registered, configured));
}

async function registerStandIns(pi: ExtensionAPI, cwd: string, pass: Pass): Promise<void> {
  const home = process.env.HOME ?? "";
  let decisions: Decision[];
  try {
    decisions = await decide(pi, home, cwd, pass);
  } catch (error: unknown) {
    decisions = [{ decision: "failed", error: errorText(error) }];
  }

  const lines = decisions.map((decision) => `${JSON.stringify(decision)}\n`).join("");
  if (lines === "") {
    return;
  }

  try {
    await appendFile(path.join(harnessDirectory(home), BUILTIN_MCP_STAND_IN_LOG), lines);
  } catch {
    // P1-DC-05: the stand-in never throws into Pi. A log it cannot write
    // leaves the scenario to fail on the tool it did not get.
  }
}

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default async function builtinMcpStandIn(pi: ExtensionAPI): Promise<void> {
  await registerStandIns(pi, process.cwd(), AT_LOAD);
  pi.on("session_start", async (_event, ctx) => {
    await registerStandIns(pi, ctx.cwd, AT_SESSION_START);
  });
}

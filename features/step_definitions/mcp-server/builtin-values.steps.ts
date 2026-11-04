/**
 * @fileoverview Steps about the values Pi's built-in MCP holds for a plugin
 * server: a profile Pi with a probe of Pi's MCP registry, a stub server that
 * declares more fields than the stub marker takes, and the configs Pi holds
 * (BLT-02, P2-DC-17).
 *
 * OAuth, timeout, exposure, and description values never reach a server
 * process, so a probe of Pi's registry stands in for what no stub can log.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import {
  MCP_BUILTIN_CONFIG_PROBE_COMMAND,
  MCP_BUILTIN_CONFIG_PROBE_EXTENSION,
  readRegisteredConfigs,
} from "../../lib/mcp-builtin-config-probe/snapshot.ts";
import { MCP_STUB_SERVER } from "../../lib/mcp-stub-server.ts";
import { writePublishedPluginFile } from "../../lib/published-marketplace.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// P2-DC-24: the probe loads beside the real extension, which registers the
// plugin servers itself, so no stand-in is loaded.
Given(
  "pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [MCP_BUILTIN_CONFIG_PROBE_EXTENSION],
    });
  },
);

// The stub's own command and arguments, then every member of the doc string,
// which may hold fields the stub marker refuses, such as `timeout` or `cwd`.
Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} with these fields:",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string, text: string) {
    const fields: unknown = JSON.parse(text);
    assert.ok(
      typeof fields === "object" && fields !== null && !Array.isArray(fields),
      "the fields are not a JSON object",
    );
    const entry = { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server], ...fields };
    const written = `${JSON.stringify({ mcpServers: { [server]: entry } }, null, 2)}\n`;
    const file = await writePublishedPluginFile(
      this.requirePublished(name),
      plugin,
      ".mcp.json",
      written,
    );
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);

// The whole list of MCP servers that extensions registered with Pi, in Pi's
// order, each with its config as JSON and run tokens projected. A stdio
// server's command and arguments name this run's Node and stub paths, so they
// are left out. The probe is a read-only query of Pi's registry, as a stub
// log is read, so the step runs it itself.
Then(
  "pi holds these mcp server configs, apart from each stdio server's command and arguments:",
  async function (this: ScenarioWorld, table: DataTable) {
    const { response, entries, extensionErrors, dialogs } = await this.pi.request({
      type: "prompt",
      message: `/${MCP_BUILTIN_CONFIG_PROBE_COMMAND}`,
    });
    assert.deepStrictEqual(
      [response.data, extensionErrors, dialogs],
      [{ disposition: "handled" }, [], []],
    );
    const rows = readRegisteredConfigs(entries).map(({ name, config }) => {
      const { command, args: _args, ...rest } = config;
      const shown = typeof command === "string" ? rest : config;
      return [name, projectTokens("config", JSON.stringify(shown), this.tokens)];
    });
    assert.deepStrictEqual([["name", "config"], ...rows], table.raw());
  },
);

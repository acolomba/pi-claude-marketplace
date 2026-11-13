/**
 * @fileoverview Tool-use hook steps: the hooks' own MCP stub server, which a
 * hooked plugin holds so its hooks can watch a call that the model makes
 * through pi-mcp-adapter's `mcp` proxy, and the wait for the adapter's first
 * listing of that server (HOOK-08, D-CF5-12).
 *
 * The plugin's `.mcp.json` names one stdio server that runs the MCP
 * stub with this process's Node, given the plugin and server names, so the
 * stub logs which server it is. When a session starts, pi-mcp-adapter lists
 * the tools of a server it has not cached and then disconnects, in the
 * background, so a scenario waits until that listing is over before it
 * prompts.
 *
 * The call step scripts the model's call of one of the stub's tools through
 * whichever MCP implementation the profile runs: pi-mcp-adapter's `mcp` proxy,
 * or `tool_search` and then the tool itself under Pi's built-in MCP (D-P5-08).
 *
 * The `mcp.json` step configures, in Pi's own `mcp.json` in the user's agent
 * directory, one server that Pi's built-in MCP runs: the hooks' stub MCP tool
 * server, which offers one tool under the given name, with `direct` exposure,
 * so Pi declares the tool to the model before the first prompt (D-P5-09). Pi
 * reads the file when it starts, so the step precedes the profile Pi.
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { HOOK_CASE_TOOLS_EXTENSION } from "../../lib/hook-case-tools.ts";
import { hookMcpCallScript } from "../../lib/hook-mcp-calls.ts";
import { HOOK_MCP_TOOL_SERVER } from "../../lib/hook-mcp-tool-server.ts";
import { HOOK_RUNS_LOG } from "../../lib/hook-recorder.ts";
import {
  HOOK_RESULT_OBSERVER_EXTENSION,
  HOOK_RESULT_OBSERVER_LOG,
} from "../../lib/hook-result-observer.ts";
import { mcpImplementationLaunch } from "../../lib/mcp-implementation.ts";
import { MCP_STUB_SERVER, readStubRequests, stubPidFiles } from "../../lib/mcp-stub-server.ts";
import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";
import { expandTokens, projectTokens } from "../../lib/run-tokens.ts";
import { writeScenarioFile } from "../../lib/scenario-file.ts";
import {
  callMessageRows,
  modelCallsOf,
  readModelScript,
  writeModelScript,
} from "../../lib/scripted-model/script.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { HookRun } from "../../lib/hook-recorder.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// A Node start and one listing take well under a second; the deadline leaves
// room for a loaded runner and stays inside the step timeout.
const HOOK_STUB_LISTING_DEADLINE_MS = 15_000;
const HOOK_STUB_LISTING_RECHECK_MS = 100;

const MCP_FILE = ".mcp.json";

// Pi's global MCP config, in the agent directory, which Pi reads with no
// trust check.
const PI_MCP_FILE = "mcp.json";
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12P4z8DwHwAFAAH/cpxSZwAAAABJRU5ErkJggg==";

Given(
  "the project holds the tiny red image {string} for a tool hook",
  async function (this: ScenarioWorld, name: string) {
    const file = path.join(this.tokens.projectDir, name);
    const bytes = Buffer.from(TINY_PNG, "base64");
    await writeFile(file, bytes, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.deepStrictEqual(await readFile(file), bytes);
  },
);

Then(
  "the tiny red image {string} is unchanged after a tool hook",
  async function (this: ScenarioWorld, name: string) {
    assert.deepStrictEqual(
      await readFile(path.join(this.tokens.projectDir, name)),
      Buffer.from(TINY_PNG, "base64"),
    );
  },
);

Given(
  "pi runs with the scripted model and a downstream file result observer",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [HOOK_RESULT_OBSERVER_EXTENSION],
    });
  },
);

Given(
  "pi runs with the scripted model and custom case-sensitive tools",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [HOOK_CASE_TOOLS_EXTENSION, HOOK_RESULT_OBSERVER_EXTENSION],
    });
  },
);

Given(
  "pi runs with the scripted model, the mcp implementation and a downstream result observer",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const launch = mcpImplementationLaunch(this.mcpProfile);
    await this.usePiWithProfile({
      ...launch,
      extraExtensions: [...launch.extraExtensions, HOOK_RESULT_OBSERVER_EXTENSION],
    });
  },
);

function observedResultRows(world: ScenarioWorld): string[] {
  return (world.requireTurn().logs.get(HOOK_RESULT_OBSERVER_LOG) ?? []).map((record) =>
    projectTokens("text", JSON.stringify(record), world.tokens),
  );
}

function profileRecords(table: DataTable, profile: string): string[] {
  return table.hashes().flatMap(({ profile: rowProfile, record }) => {
    assert.ok(rowProfile !== undefined && record !== undefined);
    return rowProfile === profile ? [record] : [];
  });
}

function toolCallRows(world: ScenarioWorld): string[][] {
  return callMessageRows(modelCallsOf(world.requireTurn().logs)).map(([call, role, text]) => [
    call,
    role,
    text.endsWith(" returned: ") ? `${text}<empty>` : projectTokens("text", text, world.tokens),
  ]);
}

Then(
  "the hooks record these complete mcp inputs:",
  function (this: ScenarioWorld, table: DataTable) {
    const runs = (this.requireTurn().logs.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
    const actual = runs.map((run) => {
      const session = run.stdin.session_id;
      if (typeof session !== "string") {
        throw new Error("MCP hook run has no session id");
      }

      return projectTokens("text", JSON.stringify(run), this.tokens).replaceAll(session, "first");
    });
    const expected = profileRecords(table, this.mcpProfile);
    assert.deepStrictEqual(actual, expected);
    this.markTurnCompared();
  },
);

Then(
  "another pi handler observes these complete tool results:",
  function (this: ScenarioWorld, table: DataTable) {
    const actual = observedResultRows(this);
    const expected = table.hashes().map(({ record }) => {
      assert.ok(record !== undefined);
      return expandTokens(record, this.tokens);
    });
    assert.deepStrictEqual(actual, expected);
    this.markTurnCompared();
  },
);

Then(
  "another pi handler observes these complete mcp results:",
  function (this: ScenarioWorld, table: DataTable) {
    const actual = observedResultRows(this);
    const expected = profileRecords(table, this.mcpProfile);
    assert.deepStrictEqual(actual, expected);
    this.markTurnCompared();
  },
);

Then(
  "the model receives these complete mcp calls:",
  function (this: ScenarioWorld, table: DataTable) {
    const actual = toolCallRows(this);
    const expected = table.hashes().flatMap(({ profile, call, role, text }) => {
      assert.ok(
        profile !== undefined && call !== undefined && role !== undefined && text !== undefined,
      );
      return profile === this.mcpProfile ? [[call, role, text]] : [];
    });
    assert.deepStrictEqual(actual, expected);
    this.markTurnCompared();
  },
);

Then(
  "the model receives these calls, with an empty file result:",
  function (this: ScenarioWorld, table: DataTable) {
    const rows = callMessageRows(modelCallsOf(this.requireTurn().logs)).map(
      ([call, role, text]) => [
        call,
        role,
        text === "read returned: "
          ? "read returned: <empty>"
          : projectTokens("text", text, this.tokens),
      ],
    );
    assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
    this.markTurnCompared();
  },
);

Then(
  "the model receives these calls, with an empty tool result:",
  function (this: ScenarioWorld, table: DataTable) {
    const rows = toolCallRows(this);
    assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
    this.markTurnCompared();
  },
);

Given(
  "pi runs with the scripted model and search tools",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await writeScenarioFile(
      this,
      path.join(this.tokens.agentDir, "settings.json"),
      `${JSON.stringify({ defaultTools: ["read", "bash", "edit", "write", "find", "grep"] })}\n`,
    );
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [HOOK_RESULT_OBSERVER_EXTENSION],
    });
  },
);

Given(
  "the project holds the file {string} with the text {string} for a tool hook",
  async function (this: ScenarioWorld, name: string, text: string) {
    await writeScenarioFile(
      this,
      path.join(this.tokens.projectDir, name),
      text.replaceAll("\\n", "\n"),
    );
  },
);

Then(
  "the project has no file {string} after a tool hook",
  async function (this: ScenarioWorld, name: string) {
    await assert.rejects(readFile(path.join(this.tokens.projectDir, name)), { code: "ENOENT" });
  },
);

Then(
  "the project file {string} has the text {string} after a tool hook",
  async function (this: ScenarioWorld, name: string, text: string) {
    assert.strictEqual(
      await readFile(path.join(this.tokens.projectDir, name), "utf8"),
      text.replaceAll("\\n", "\n"),
    );
  },
);

// Pi's `mcp.json` with the one server `server`, which runs the hooks' stub MCP
// tool server with this process's Node and offers the tool `tool`.
function piMcpText(server: string, tool: string): string {
  const launch = {
    command: process.execPath,
    args: [HOOK_MCP_TOOL_SERVER, tool],
    exposure: "direct",
  };
  return `${JSON.stringify({ mcpServers: { [server]: launch } }, null, 2)}\n`;
}

// The `.mcp.json` of a plugin whose only server is the stub, started as the
// server `server` of the plugin `plugin`.
function hookStubMcpText(plugin: string, server: string, tool?: string, rich = false): string {
  const launch = {
    command: process.execPath,
    args: rich
      ? [HOOK_MCP_TOOL_SERVER, tool ?? "echo", plugin, server]
      : [MCP_STUB_SERVER, plugin, server, ...(tool === undefined ? [] : [tool])],
  };
  return `${JSON.stringify({ mcpServers: { [server]: launch } }, null, 2)}\n`;
}

async function writeHookStubMcpFile(
  world: ScenarioWorld,
  plugin: string,
  name: string,
  server: string,
  tool?: string,
  rich = false,
): Promise<void> {
  const published = world.requirePublished(name);
  const text = hookStubMcpText(plugin, server, tool, rich);
  await writePublishedPluginFiles(published, plugin, { [MCP_FILE]: text });
  const written = path.join(published.root, "plugins", plugin, MCP_FILE);
  assert.strictEqual(await readFile(written, "utf8"), text);
}

// True once the stub logged the adapter's `tools/list` for that server and no
// stub process is left, which means the adapter closed the listing.
async function hookStubListingDone(
  harness: string,
  plugin: string,
  server: string,
): Promise<boolean> {
  const requests = await readStubRequests(harness);
  const listed = requests.some(
    ({ method, plugin: from, server: name }) =>
      method === "tools/list" && from === plugin && name === server,
  );
  return listed && (await stubPidFiles(harness)).length === 0;
}

Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    await writeHookStubMcpFile(this, plugin, name, server);
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks with tool {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string, tool: string) {
    await writeHookStubMcpFile(this, plugin, name, server, tool);
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has the rich stub mcp server {string} for its hooks",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    await writeHookStubMcpFile(this, plugin, name, server, "echo", true);
  },
);

Given(
  "pi-mcp-adapter has listed the hooks' stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    const harness = this.profileHarness();
    const deadline = Date.now() + HOOK_STUB_LISTING_DEADLINE_MS;
    while (!(await hookStubListingDone(harness, plugin, server))) {
      assert.ok(
        Date.now() < deadline,
        `pi-mcp-adapter did not end its listing of ${plugin}/${server} within ${HOOK_STUB_LISTING_DEADLINE_MS} ms`,
      );
      await pause(HOOK_STUB_LISTING_RECHECK_MS);
    }
  },
);

Given(
  "the scripted model calls the tool {string} of the hooks' stub mcp server {string} of the plugin {string} through the mcp implementation with {string}, then replies {string}",
  async function (
    this: ScenarioWorld,
    tool: string,
    server: string,
    plugin: string,
    argumentsText: string,
    reply: string,
  ) {
    const steps = hookMcpCallScript(this.mcpProfile, plugin, server, tool, argumentsText, reply);
    const harness = this.profileHarness();
    await writeModelScript(harness, steps);
    assert.deepStrictEqual(await readModelScript(harness), steps);
  },
);

Given(
  "pi's mcp.json configures the server {string} with the hooks' stub mcp tool {string}",
  async function (this: ScenarioWorld, server: string, tool: string) {
    assert.ok(!this.profilePiStarted, "a profile Pi already started in this scenario");
    const file = path.join(this.tokens.agentDir, PI_MCP_FILE);
    const text = piMcpText(server, tool);
    await writeScenarioFile(this, file, text);
  },
);

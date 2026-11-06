/**
 * @fileoverview The steps every MCP server feature shares: the stub servers a
 * published plugin holds, a profile Pi started with a variable the user set,
 * pi-mcp-adapter's first listing of the servers' tools, and the messages a
 * stub receives (HAR-04, HAR-07, D-CF6-05).
 *
 * When a session starts, pi-mcp-adapter connects to a server whose tools it
 * has not cached, lists them, and disconnects, in the background. A model
 * turn that started meanwhile could share or lose that connection, so a
 * scenario waits for the listing before its turn, and the messages step reads
 * the stub's whole log for the scenario, not only the lines of the turn.
 */

import assert from "node:assert/strict";
import { readFile, readlink, rm } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { registryAfterListing, waitForStubListing } from "../../lib/mcp-implementation.ts";
import {
  LATE_TAG_ENVIRONMENT,
  linkPublishedMcpFile,
  publishStubMcpServer,
  publishStubServersFile,
  stubMcpFileText,
} from "../../lib/mcp-server-files.ts";
import { readStubRequests } from "../../lib/mcp-stub-server.ts";
import {
  PI_LAUNCH_ENVIRONMENT_EXTENSION,
  readAppliedLaunchEnvironments,
  writeLaunchEnvironment,
} from "../../lib/pi-launch-environment.ts";
import { expandTokens, projectTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { StubRequest } from "../../lib/mcp-stub-server.ts";
import type { ScenarioWorld } from "../../support/world.ts";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The ids of the tool calls the model made in the last turn, in call order.
// The last call repeats the whole conversation, so it holds every one.
function turnToolCallIds(world: ScenarioWorld): string[] {
  const messages = modelCallsOf(world.requireTurn().logs).at(-1)?.messages ?? [];
  return messages.flatMap((message) =>
    isRecord(message) && Array.isArray(message.content)
      ? message.content.flatMap((part: unknown) =>
          isRecord(part) && part.type === "toolCall" && typeof part.id === "string"
            ? [part.id]
            : [],
        )
      : [],
  );
}

// A message's params as JSON, with run tokens projected, and the id of the
// n-th tool call of the last turn, which Pi makes up for each call, shown
// as `{tool call <n>}`.
function paramsText(world: ScenarioWorld, request: StubRequest, toolCallIds: string[]): string {
  if (request.params === undefined) {
    return "";
  }

  const text = projectTokens("params", JSON.stringify(request.params), world.tokens);
  return toolCallIds.reduce(
    (projected, id, index) => projected.replaceAll(id, `{tool call ${index + 1}}`),
    text,
  );
}

Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    const stub = { plugin, server };
    const file = await publishStubMcpServer(this.requirePublished(name), stub);
    assert.strictEqual(await readFile(file, "utf8"), stubMcpFileText(stub));
  },
);

// D-CF1-13: the server's env holds a `${NAME:-default}` reference, which
// Claude Code expands when it starts the server.
Given(
  'the published plugin {string} of the marketplace {string} has the stub mcp server {string} with "STUB_TAG" set to "$\\{PI_CM_STUB_TAG:-install-default}"',
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    const stub = { plugin, server, env: LATE_TAG_ENVIRONMENT };
    const file = await publishStubMcpServer(this.requirePublished(name), stub);
    assert.strictEqual(await readFile(file, "utf8"), stubMcpFileText(stub));
  },
);

// D-CF6-06: every member of the doc string whose value is `{"stub": {...}}`
// becomes a stub server named after the member; every other value is
// written as it is, so a scenario can also write a malformed server. A
// wrapped map whose only server is named `stub` reads as such a marker, so
// this step cannot write it (see `withStubServers`).
Given(
  "the published plugin {string} of the marketplace {string} has the file {string} with these stub mcp servers:",
  async function (this: ScenarioWorld, plugin: string, name: string, file: string, text: string) {
    const published = this.requirePublished(name);
    const written = await publishStubServersFile(published, plugin, file, text);
    const target = path.join(published.root, "plugins", plugin, file);
    assert.strictEqual(await readFile(target, "utf8"), written);
  },
);

// MCPR-04: the link's text is the target as written, relative to the link.
Given(
  "the mcp file {string} of the published plugin {string} of the marketplace {string} is a symbolic link to {string}",
  async function (this: ScenarioWorld, file: string, plugin: string, name: string, target: string) {
    const link = await linkPublishedMcpFile(this.requirePublished(name), plugin, file, target);
    assert.strictEqual(await readlink(link), target);
  },
);

// A profile Pi's environment is fixed when it starts, so a variable the user
// sets after an install reaches only a Pi started after it. The variable is
// never set in this worker's own environment.
Given(
  "pi runs with the scripted model, pi-mcp-adapter, and the environment variable {string} set to {string}",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, variable: string, value: string) {
    const file = await writeLaunchEnvironment(this.tokens.home, { [variable]: value });
    this.onRelease(() => rm(file, { force: true }));
    await this.usePiWithProfile({
      companions: ["pi-mcp-adapter"],
      extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION],
    });
    assert.deepStrictEqual(await readAppliedLaunchEnvironments(this.profileHarness()), [
      { [variable]: value },
    ]);
  },
);

// Done once the stub logged a tools/list and no stub is running, which means
// the adapter closed the listing connection. The plugin is the argument the
// stub logs, with run tokens expanded, so a stub started with
// `${CLAUDE_PLUGIN_ROOT}` is named by `{home}/marketplaces/<name>/plugins/<plugin>`.
Given(
  "pi-mcp-adapter has listed the tools of the stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, pluginText: string) {
    const plugin = expandTokens(pluginText, this.tokens);
    await waitForStubListing("adapter", this.pi, this.profileHarness(), plugin, server);
  },
);

// pi-mcp-adapter registers a server's tools with Pi only after its listing
// ends, and after a new session it can list a server again. So, when Pi runs
// the adapter, the step waits for at most 10 seconds until Pi has a tool of
// every stub server that a stub listed (P3-DC-111).
When("the user lists the mcp tools pi offers", async function (this: ScenarioWorld) {
  this.registrySnapshot = await registryAfterListing(this.pi, this.profileHarness());
});

// One row per message the stub received, in arrival order: whether it was a
// request or a notification, its method, and its params as JSON. Every
// message must come from the named server, whose plugin argument may hold
// run tokens, as in the listing wait.
Then(
  "the stub mcp server {string} of the plugin {string} receives these messages:",
  async function (this: ScenarioWorld, server: string, pluginText: string, table: DataTable) {
    const plugin = expandTokens(pluginText, this.tokens);
    const requests = await readStubRequests(this.profileHarness());
    assert.deepStrictEqual(
      requests.filter((request) => request.plugin !== plugin || request.server !== server),
      [],
    );
    const toolCallIds = turnToolCallIds(this);
    const rows = requests.map((request) => [
      request.notification ? "notification" : "request",
      String(request.method),
      paramsText(this, request, toolCallIds),
    ]);
    assert.deepStrictEqual([["kind", "method", "params"], ...rows], table.raw());
  },
);

// pi-mcp-adapter names a tool of a server this extension bridged
// `mcp__plugin_<plugin>_<server>__<tool>`, from the key and the `toolPrefix`
// this extension writes.
const PLUGIN_MCP_TOOL_PREFIX = "mcp__plugin_";

// The tools this extension registers, and the tools Pi has because of a
// server it bridged. Pi's built-in tools,
// the adapter's `mcp` proxy, and each other companion's tools are theirs, and
// a release may add, drop, or rename them, so no scenario states them.
function isMarketplaceTool(name: string): boolean {
  return (
    name.startsWith("pi_claude_marketplace_") ||
    name === "run_plugin_command" ||
    name.startsWith(PLUGIN_MCP_TOOL_PREFIX)
  );
}

// D-CF6-05: one row per model call of the last turn, numbered from 1 as the
// calls step numbers them, with the names of the marketplace tools Pi offered
// that call, sorted by name, because the order is Pi's. A call offered none
// has an empty cell. A scenario that uses it also states the calls, so this
// step leaves the turn for that step to mark compared.
Then(
  "the model calls are offered these marketplace tools:",
  function (this: ScenarioWorld, table: DataTable) {
    const rows = modelCallsOf(this.requireTurn().logs).map((call) => [
      String(call.index + 1),
      call.tools
        .map((tool) => tool.name)
        .filter((name) => isMarketplaceTool(name))
        .sort((left, right) => left.localeCompare(right))
        .join(", "),
    ]);
    assert.deepStrictEqual([["call", "tools"], ...rows], table.raw());
  },
);

// D-CF6-05: one row per tool Pi has for a server this extension bridged,
// sorted by name, with whether it is active, which the `directTools` this
// extension writes decides. The adapter's own `mcp` proxy is not listed.
Then("pi offers these plugin mcp tools:", function (this: ScenarioWorld, table: DataTable) {
  const snapshot = this.registrySnapshot;
  if (snapshot === undefined) {
    assert.fail("no step listed the mcp tools pi offers");
  }

  const active = new Set(snapshot.activeTools);
  const rows = snapshot.allTools
    .map(({ name }) => name)
    .filter((name) => name.startsWith(PLUGIN_MCP_TOOL_PREFIX))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => [name, active.has(name) ? "yes" : "no"]);
  assert.deepStrictEqual([["tool", "active"], ...rows], table.raw());
});

// The stub's whole log for the scenario is empty: no server was started.
Then("no stub mcp server receives a message", async function (this: ScenarioWorld) {
  assert.deepStrictEqual(await readStubRequests(this.profileHarness()), []);
});

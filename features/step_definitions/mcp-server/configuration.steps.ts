/**
 * @fileoverview Steps about the configuration a plugin gives its MCP servers
 * and what the servers receive: a loopback HTTP server with headers, a stub
 * server that echoes its environment, a Pi with built-in MCP started with a
 * variable the user set, and an install that warns of an unset variable
 * (MCP-03, D-CF6-06, BLT-02, IN-02).
 *
 * pi-mcp-adapter's MCP client, like Pi's built-in one, sends its JSON-RPC
 * requests over HTTP one after another, and opens its optional event stream
 * with a `GET` beside them. The `GET` races the next `POST` by about a
 * millisecond, so the steps state the `POST` requests in arrival order and the
 * other requests in any order. A Pi with built-in MCP and no companion
 * registers the plugin's servers with Pi, so its listing waits read Pi's tool
 * registry as well as the server's log.
 */

import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { profileFor } from "../../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import { settledRegistry } from "../../lib/mcp-implementation.ts";
import { MCP_SERVER_ENVIRONMENT_PRELOAD } from "../../lib/mcp-server-environment.ts";
import { McpHttpServer, readMcpHttpRequests } from "../../lib/mcp-server-http.ts";
import { MCP_STUB_SERVER } from "../../lib/mcp-stub-server.ts";
import { runCommandPayloads } from "../../lib/pi-commands.ts";
import {
  PI_LAUNCH_ENVIRONMENT_EXTENSION,
  readAppliedLaunchEnvironments,
  writeLaunchEnvironment,
} from "../../lib/pi-launch-environment.ts";
import { writePublishedPluginFile } from "../../lib/published-marketplace.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { McpHttpRequest } from "../../lib/mcp-server-http.ts";
import type { NotificationPayload } from "../../lib/pi-commands.ts";
import type { PiProfile, ScenarioWorld } from "../../support/world.ts";

// Listing one tool over loopback takes well under a second; the margin
// covers a loaded CI runner and stays below the step timeout, as the stub
// server's listing wait does.
const HTTP_LISTING_TIMEOUT_MS = 15_000;
const HTTP_LISTING_POLL_MS = 50;

// The one tool the loopback HTTP server lists.
const HTTP_TOOL = "echo";

// Writes `servers` as the `mcpServers` of the plugin's `.mcp.json`, which
// must not exist yet, and asserts it reads back.
async function publishMcpFile(
  world: ScenarioWorld,
  plugin: string,
  name: string,
  servers: Readonly<Record<string, unknown>>,
): Promise<void> {
  const published = world.requirePublished(name);
  const text = `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`;
  const file = await writePublishedPluginFile(published, plugin, ".mcp.json", text);
  assert.strictEqual(await readFile(file, "utf8"), text);
}

// The requests the server `server` logged, after asserting that no other
// HTTP server logged one.
async function requestsOf(world: ScenarioWorld, server: string): Promise<McpHttpRequest[]> {
  const requests = await readMcpHttpRequests(world.profileHarness());
  assert.deepStrictEqual(
    requests.filter((request) => request.server !== server),
    [],
  );
  return requests;
}

// One row per request, its request cell, then the whole value of each header
// the table names, or `(none)` when the request carried no such header, so an
// empty value and a missing header read differently. The request cell is the
// HTTP method, then the JSON-RPC method when there is one.
function requestRows(requests: readonly McpHttpRequest[], headers: readonly string[]): string[][] {
  return requests.map((request) => [
    request.rpcMethod === undefined
      ? request.httpMethod
      : `${request.httpMethod} ${request.rpcMethod}`,
    ...headers.map((header) => request.headers[header] ?? "(none)"),
  ]);
}

function byRow(left: readonly string[], right: readonly string[]): number {
  return left.join("\n").localeCompare(right.join("\n"));
}

// The header names a requests table states after its `request` column.
function requestHeaders(table: DataTable): string[] {
  const [first = []] = table.raw();
  const [column, ...headers] = first;
  assert.strictEqual(column, "request");
  return headers;
}

// Waits until the server `server` logged a `tools/list` and `registered`
// holds, and fails with the server's requests after the listing deadline.
// `client` names the MCP client the failure blames.
async function waitForHttpListing(
  world: ScenarioWorld,
  server: string,
  client: string,
  registered: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + HTTP_LISTING_TIMEOUT_MS;
  for (;;) {
    const requests = await requestsOf(world, server);
    if (requests.some((request) => request.rpcMethod === "tools/list") && (await registered())) {
      return;
    }

    if (Date.now() > deadline) {
      assert.fail(`${client} did not list the tools of ${server}: ${JSON.stringify(requests)}`);
    }

    await delay(HTTP_LISTING_POLL_MS);
  }
}

// Whether `name` is the built-in MCP name of a tool of the HTTP server
// `server` of `plugin`, which lists one tool.
function isBuiltinHttpTool(name: string, plugin: string, server: string): boolean {
  const profile = profileFor("builtin");
  const prefix = profile.toolNamePrefix(plugin, server);
  return prefix === undefined
    ? name === profile.toolName(plugin, server, HTTP_TOOL)
    : name.startsWith(prefix);
}

// The scope a setup command names with `--scope`, which the config notices
// of its install name too.
const SCOPE_FLAG_PATTERN = /--scope\s+(\S+)/u;

function commandScope(command: string): string {
  const scope = SCOPE_FLAG_PATTERN.exec(command)?.[1];
  if (scope === undefined) {
    assert.fail(`the setup command names no scope: ${command}`);
  }

  return scope;
}

// A config notice result with its invocation id dropped, since the id is
// drawn for each run.
function noticeResult(payload: NotificationPayload): Readonly<Record<string, unknown>> {
  const { origin, ...fields } = payload;
  const kept =
    origin.kind === "command" ? { kind: origin.kind, commandId: origin.commandId } : origin;
  return { ...fields, origin: kept };
}

// The server starts before the plugin's `.mcp.json` names its URL, because
// the install writes that URL into pi-mcp-adapter's config. Its release runs
// after the profile Pi stops, so no request reaches a closed server.
Given(
  "the published plugin {string} of the marketplace {string} has the http mcp server {string} with these headers:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    server: string,
    table: DataTable,
  ) {
    const [header, ...rows] = table.raw();
    assert.deepStrictEqual(header, ["header", "value"]);
    const headers = Object.fromEntries(rows.map(([key = "", value = ""]) => [key, value]));
    const http = await McpHttpServer.start(this.tokens.home, server);
    this.onRelease(() => http.close());
    await publishMcpFile(this, plugin, name, {
      [server]: { type: "http", url: http.url, headers },
    });
  },
);

// MENV-01/02: the stub runs with the environment preload, which prefixes its
// echo with the values of the two variables, as its own process has them.
Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} that echoes its {string} and {string} environment variables",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    server: string,
    first: string,
    second: string,
  ) {
    const entry = {
      command: process.execPath,
      args: ["--import", MCP_SERVER_ENVIRONMENT_PRELOAD, MCP_STUB_SERVER, plugin, server],
      env: { STUB_TAG_FROM: `${first},${second}` },
    };
    await publishMcpFile(this, plugin, name, { [server]: entry });
  },
);

// IN-02: the install of a plugin whose server reads a variable the run never
// sets. Every result but the MCP config notices must be info, and the
// notices must be exactly one `variables-missing` section naming that server,
// by its key in pi-mcp-adapter's config, and that variable (AVAR-04), so an
// install that stops warning fails here.
Given(
  "the user has run {string}, which warned that the mcp server {string} of the plugin {string} reads the unset variable {string}",
  async function (
    this: ScenarioWorld,
    command: string,
    server: string,
    plugin: string,
    variable: string,
  ) {
    const payloads = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
    assert.deepStrictEqual(
      payloads.filter(({ kind, severity }) => kind !== "mcp-config-notices" && severity !== "info"),
      [],
    );
    const notices = payloads.filter(({ kind }) => kind === "mcp-config-notices");
    assert.deepStrictEqual(notices.map(noticeResult), [
      {
        schemaVersion: 1,
        kind: "mcp-config-notices",
        origin: { kind: "command", commandId: "plugin install" },
        severity: "warning",
        needsReload: false,
        notices: [
          {
            kind: "variables-missing",
            scope: commandScope(command),
            file: "mcp-adapter.json",
            plugin,
            server: profileFor("adapter").serverName(plugin, server),
            names: [variable],
          },
        ],
      },
    ]);
  },
);

// BLT-02, D-MB-04: a profile Pi's environment is fixed when it starts, so a
// variable the user sets after an install reaches only a Pi started after
// it. This Pi loads no companion, so Pi's built-in MCP serves the plugin's
// servers, and the extension reads the variable when it registers them.
Given(
  "pi runs with the scripted model, pi's built-in mcp, and the environment variable {string} set to {string}",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, variable: string, value: string) {
    const variables = { [variable]: value };
    const launch: PiProfile = {
      companions: [],
      extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION],
    };
    const file = await writeLaunchEnvironment(this.tokens.home, variables);
    this.onRelease(() => rm(file, { force: true }));
    await this.usePiWithProfile(launch);
    const applied = await readAppliedLaunchEnvironments(this.profileHarness());
    assert.deepStrictEqual(applied, [variables]);
  },
);

// Done once the server logged a `tools/list`. pi-mcp-adapter's startup
// listing ends with that request: it sends no `DELETE`, because the server
// gives no session id, and its connections stay open until the release.
Given(
  "pi-mcp-adapter has listed the tools of the http mcp server {string}",
  async function (this: ScenarioWorld, server: string) {
    await waitForHttpListing(this, server, "pi-mcp-adapter", () => Promise.resolve(true));
  },
);

// BLT-01: Pi's built-in MCP keeps its connection open and registers the
// listed tools with Pi after the `tools/list`, so the listing is done once
// the server logged that request and Pi's settled registry holds a tool of
// the server: one in its built-in namespace, or, when the namespace is too
// long to be a prefix of a cut tool name, the full name of its one tool.
Given(
  "pi's built-in mcp has listed the tools of the http mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    await waitForHttpListing(this, server, "pi's built-in mcp", async () => {
      const { allTools } = await settledRegistry(this.pi);
      return allTools.some(({ name }) => isBuiltinHttpTool(name, plugin, server));
    });
  },
);

// Every `POST` request the server received in the scenario, in arrival order.
Then(
  "the http mcp server {string} receives these json-rpc requests:",
  async function (this: ScenarioWorld, server: string, table: DataTable) {
    const posts = (await requestsOf(this, server)).filter(
      ({ httpMethod }) => httpMethod === "POST",
    );
    const headers = requestHeaders(table);
    assert.deepStrictEqual([["request", ...headers], ...requestRows(posts, headers)], table.raw());
  },
);

// Every other request the server received in the scenario, sorted by row.
Then(
  "the http mcp server {string} receives these other requests in any order:",
  async function (this: ScenarioWorld, server: string, table: DataTable) {
    const others = (await requestsOf(this, server)).filter(
      ({ httpMethod }) => httpMethod !== "POST",
    );
    const headers = requestHeaders(table);
    const [stated = [], ...expected] = table.raw();
    assert.deepStrictEqual(
      [stated, ...requestRows(others, headers).sort(byRow)],
      [stated, ...[...expected].sort(byRow)],
    );
  },
);

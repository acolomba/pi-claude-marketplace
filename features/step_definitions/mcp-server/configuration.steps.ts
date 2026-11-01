/**
 * @fileoverview Steps about the configuration a plugin gives its MCP servers
 * and what the servers receive: a loopback HTTP server with headers, and a
 * stub server that echoes its environment (MCP-03, D-CF6-06).
 *
 * pi-mcp-adapter's MCP client sends its JSON-RPC requests over HTTP one after
 * another, and opens its optional event stream with a `GET` beside them. The
 * `GET` races the next `POST` by about a millisecond, so the steps state the
 * `POST` requests in arrival order and the other requests in any order.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { publishStubServersFile } from "../../lib/mcp-server-files.ts";
import { McpHttpServer, readMcpHttpRequests } from "../../lib/mcp-server-http.ts";

import type { McpHttpRequest } from "../../lib/mcp-server-http.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Listing one tool over loopback takes well under a second; the margin
// covers a loaded CI runner and stays below the step timeout, as the stub
// server's listing wait does.
const HTTP_LISTING_TIMEOUT_MS = 15_000;
const HTTP_LISTING_POLL_MS = 50;

// Writes `document` as the plugin's `.mcp.json` and asserts it reads back.
async function publishMcpFile(
  world: ScenarioWorld,
  plugin: string,
  name: string,
  document: unknown,
): Promise<void> {
  const published = world.requirePublished(name);
  const text = JSON.stringify(document);
  const written = await publishStubServersFile(published, plugin, ".mcp.json", text);
  const target = path.join(published.root, "plugins", plugin, ".mcp.json");
  assert.strictEqual(await readFile(target, "utf8"), written);
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
// the table names, or an empty cell when the request carried none. The
// request cell is the HTTP method, then the JSON-RPC method when there is one.
function requestRows(requests: readonly McpHttpRequest[], headers: readonly string[]): string[][] {
  return requests.map((request) => [
    request.rpcMethod === undefined
      ? request.httpMethod
      : `${request.httpMethod} ${request.rpcMethod}`,
    ...headers.map((header) => request.headers[header] ?? ""),
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
      mcpServers: { [server]: { type: "http", url: http.url, headers } },
    });
  },
);

// Done once the server logged a `tools/list`. pi-mcp-adapter's startup
// listing ends with that request: it sends no `DELETE`, because the server
// gives no session id, and its connections stay open until the release.
Given(
  "pi-mcp-adapter has listed the tools of the http mcp server {string}",
  async function (this: ScenarioWorld, server: string) {
    const deadline = Date.now() + HTTP_LISTING_TIMEOUT_MS;
    for (;;) {
      const requests = await requestsOf(this, server);
      if (requests.some((request) => request.rpcMethod === "tools/list")) {
        return;
      }

      if (Date.now() > deadline) {
        assert.fail(
          `pi-mcp-adapter did not list the tools of ${server}: ${JSON.stringify(requests)}`,
        );
      }

      await delay(HTTP_LISTING_POLL_MS);
    }
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

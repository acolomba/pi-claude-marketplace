/**
 * @fileoverview Steps about calling the MCP servers of a plugin: the stub
 * servers a published plugin holds, a profile Pi started with a variable the
 * user set, pi-mcp-adapter's first listing of the servers' tools, and the
 * messages a stub receives (HAR-04, HAR-07).
 *
 * When a session starts, pi-mcp-adapter connects to a server whose tools it
 * has not cached, lists them, and disconnects, in the background. A model
 * turn that started meanwhile could share or lose that connection, so a
 * scenario waits for the listing before its turn, and the messages step reads
 * the stub's whole log for the scenario, not only the lines of the turn.
 */

import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import {
  LATE_TAG_ENVIRONMENT,
  publishStubMcpServer,
  stubMcpFileText,
} from "../../lib/mcp-server-files.ts";
import { readStubRequests, stubPidFiles } from "../../lib/mcp-stub-server.ts";
import {
  PI_LAUNCH_ENVIRONMENT_EXTENSION,
  readAppliedLaunchEnvironments,
  writeLaunchEnvironment,
} from "../../lib/pi-launch-environment.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { StubRequest } from "../../lib/mcp-stub-server.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Starting Node on the stub and listing one tool takes well under a second;
// the margin covers a loaded CI runner and stays below the step timeout.
const TOOL_LISTING_TIMEOUT_MS = 15_000;
const TOOL_LISTING_POLL_MS = 50;

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

function listedTools(requests: readonly StubRequest[], plugin: string, server: string): boolean {
  return requests.some(
    (request) =>
      request.plugin === plugin && request.server === server && request.method === "tools/list",
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
// the adapter closed the listing connection.
Given(
  "pi-mcp-adapter has listed the tools of the stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    const harness = this.profileHarness();
    const deadline = Date.now() + TOOL_LISTING_TIMEOUT_MS;
    for (;;) {
      const [requests, running] = await Promise.all([
        readStubRequests(harness),
        stubPidFiles(harness),
      ]);
      if (listedTools(requests, plugin, server) && running.length === 0) {
        return;
      }

      if (Date.now() > deadline) {
        assert.fail(
          `pi-mcp-adapter did not finish listing the tools of ${plugin}/${server}: ${JSON.stringify({ requests, running })}`,
        );
      }

      await delay(TOOL_LISTING_POLL_MS);
    }
  },
);

// One row per message the stub received, in arrival order: whether it was a
// request or a notification, its method, and its params as JSON. Every
// message must come from the named server.
Then(
  "the stub mcp server {string} of the plugin {string} receives these messages:",
  async function (this: ScenarioWorld, server: string, plugin: string, table: DataTable) {
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

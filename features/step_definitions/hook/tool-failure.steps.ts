/**
 * @fileoverview Steps about failed tool calls that no frozen module offers: a
 * stub MCP server whose tool calls fail, and a prompt whose running tool the
 * user interrupts.
 *
 * The failing server is a small wrapper the published plugin carries: it runs
 * the frozen stub server as its child and marks each `tools/call` answer
 * `isError: true`. It lives here because `features/lib/**` is frozen and the
 * frozen stub servers always succeed (P4-DC-04). The stub still logs its
 * requests and keeps its pid file, so the frozen listing waits work with it.
 *
 * The interrupting `When` sends the prompt, waits until the running tool has
 * created a marker file, and sends Pi's RPC `abort`. Pi answers the abort only
 * after the turn has settled, aborted, so the step then reads that settle and
 * keeps every record and stand-in log line from the prompt on as the last
 * turn (HAR-03). The marker's removal is registered before the prompt, and it
 * ends the command's wait loop whatever fails.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Given, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { MCP_STUB_SERVER } from "../../lib/mcp-stub-server.ts";
import { DIALOG_METHODS } from "../../lib/pi-process.ts";
import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// The scripted tool call starts well within a second; the margin covers a
// loaded CI runner and leaves the settle wait room below the 30-second step
// timeout, so a tool that never runs fails here.
const MARKER_DEADLINE_MS = 10_000;

const MARKER_POLL_MS = 50;

// The plugin file that declares its MCP servers, and the failing wrapper.
const MCP_FILE = ".mcp.json";
const FAILING_SERVER_FILE = "failing-stub-server.mjs";

// The wrapper: runs the stub given as its first argument as a child, passes
// every line through, and marks the answer to each `tools/call` request an
// error. A line that is not JSON passes unchanged.
const FAILING_SERVER_TEXT = `import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const [stub, plugin, server] = process.argv.slice(2);
const child = spawn(process.execPath, [stub, plugin, server], {
  stdio: ["pipe", "pipe", "inherit"],
});
const calls = new Set();
createInterface({ input: process.stdin })
  .on("line", (line) => {
    try {
      const message = JSON.parse(line);
      if (message.method === "tools/call" && message.id !== undefined) {
        calls.add(JSON.stringify(message.id));
      }
    } catch {}
    child.stdin.write(line + "\\n");
  })
  .on("close", () => child.stdin.end());
createInterface({ input: child.stdout }).on("line", (line) => {
  let out = line;
  try {
    const message = JSON.parse(line);
    if (message.result !== undefined && calls.delete(JSON.stringify(message.id))) {
      message.result.isError = true;
      out = JSON.stringify(message);
    }
  } catch {}
  process.stdout.write(out + "\\n");
});
child.on("error", () => process.exit(1));
child.on("exit", (code) => process.exit(code ?? 0));
`;

// Pi answers the abort after the turn settled, so the settle record is
// normally there already; the bound fails a Pi that never settles while
// keeping the step below its 30-second timeout.
const ABORTED_SETTLE_TIMEOUT_MS = 15_000;

// Polls until `file` exists, and fails once the deadline passes.
async function awaitMarker(file: string): Promise<void> {
  const deadline = Date.now() + MARKER_DEADLINE_MS;
  while (!existsSync(file)) {
    if (Date.now() > deadline) {
      assert.fail(`the running tool did not create ${file} within ${MARKER_DEADLINE_MS} ms`);
    }

    await delay(MARKER_POLL_MS);
  }
}

// The records of the run that no turn may print: an extension error, or a
// dialog Pi opened.
function unexpectedRecords(records: readonly RpcRecord[]): readonly RpcRecord[] {
  return records.filter((record) =>
    record.type === "extension_ui_request"
      ? DIALOG_METHODS.has(String(record.method))
      : record.type === "extension_error",
  );
}

// The numbers of the model calls that went past the end of the script.
function overflowingCalls(logs: ReadonlyMap<string, readonly unknown[]>): readonly number[] {
  return modelCallsOf(logs).flatMap((call) => (call.overflow ? [call.index + 1] : []));
}

// A dir source installs in place, so the wrapper's absolute path in the
// published plugin stays valid for the installed server.
Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks, whose tool calls fail",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    const published = this.requirePublished(name);
    const directory = path.join(published.root, "plugins", plugin);
    const launch = {
      command: process.execPath,
      args: [path.join(directory, FAILING_SERVER_FILE), MCP_STUB_SERVER, plugin, server],
    };
    const mcpText = `${JSON.stringify({ mcpServers: { [server]: launch } }, null, 2)}\n`;
    await writePublishedPluginFiles(published, plugin, {
      [FAILING_SERVER_FILE]: FAILING_SERVER_TEXT,
      [MCP_FILE]: mcpText,
    });
    assert.strictEqual(
      await readFile(path.join(directory, FAILING_SERVER_FILE), "utf8"),
      FAILING_SERVER_TEXT,
    );
    assert.strictEqual(await readFile(path.join(directory, MCP_FILE), "utf8"), mcpText);
  },
);

When(
  "the user prompts {string} and interrupts the running tool once it has created {string}",
  async function (this: ScenarioWorld, text: string, marker: string): Promise<void> {
    const prompt = expandTokens(text, this.tokens);
    const markerFile = path.join(this.tokens.projectDir, marker);
    this.onRelease(() => rm(markerFile, { force: true }));
    const harness = this.profileHarness();
    const lengths = await readLogLengths(harness);
    const from = this.pi.recordCount();

    const started = await this.pi.request({ type: "prompt", message: prompt });
    assert.strictEqual(
      promptDisposition(started.response),
      "started",
      JSON.stringify(started.response),
    );
    await awaitMarker(markerFile);
    const abort = await this.pi.request({ type: "abort" });
    assert.strictEqual(abort.response.success, true, JSON.stringify(abort.response));
    const settled = await this.pi.waitForRecord(
      from,
      (record) => record.type === "agent_settled",
      ABORTED_SETTLE_TIMEOUT_MS,
    );
    assert.strictEqual(settled.aborted, true, JSON.stringify(settled));

    const records = this.pi.recordsSince(from);
    assert.deepStrictEqual(unexpectedRecords(records), []);
    const logs = await readLogLinesSince(harness, lengths);
    assert.deepStrictEqual(overflowingCalls(logs), [], "the model was called past its script");
    this.recordTurn({ prompt, disposition: "started", records, logs });
  },
);

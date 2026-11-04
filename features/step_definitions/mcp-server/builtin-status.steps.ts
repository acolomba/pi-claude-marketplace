/**
 * @fileoverview Steps about the state plugin info shows for a plugin's MCP
 * servers under Pi's built-in MCP: a server the user's own Pi `mcp.json`
 * configures under the plugin server's name, and a server the user disables
 * for the session in Pi's terminal `/mcp` manager (BLT-04, BLT-05).
 */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Given, Then, When } from "@cucumber/cucumber";

import { MCP_STUB_SERVER, readStubRequests } from "../../lib/mcp-stub-server.ts";
import { writeScenarioFile } from "../../lib/scenario-file.ts";
import { harnessDirectory } from "../../lib/turn-records.ts";

import type { PiTuiSession } from "../../lib/pi-tui.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Pi starts the stub when its session starts and lists its tools at once; the
// margin covers a loaded CI runner.
const LISTING_TIMEOUT_MS = 30_000;
const LISTING_POLL_MS = 50;

// The manager redraws within milliseconds of a key; a quiet terminal means
// it has taken the key, and the limit covers a loaded CI runner.
const SCREEN_MS = 10_000;
const QUIET_MS = 500;

// The step starts a terminal Pi (its readiness wait is 15 seconds), waits
// for the listing, and drives four manager screens, each within SCREEN_MS.
const DISABLE_STEP_TIMEOUT_MS = 120_000;

// Pi's terminal keys: Enter, the up arrow, and Escape.
const ENTER = "\r";
const UP = "\u001b[A";
const ESCAPE = "\u001b";

// The prefix and form of the line plugin info shows for each MCP server.
const MCP_SERVER_LINE = /mcp: plugin:\S+ \([^)\n]*\)/g;

// D-MB-13: the stub logs the plugin and server it was started for, which
// Pi's built-in MCP registers as `plugin_<plugin>_<server>`.
async function waitForListedTools(home: string, name: string): Promise<void> {
  const deadline = Date.now() + LISTING_TIMEOUT_MS;
  for (;;) {
    const requests = await readStubRequests(harnessDirectory(home));
    const listed = requests.some(
      (request) =>
        request.method === "tools/list" && `plugin_${request.plugin}_${request.server}` === name,
    );
    if (listed) {
      return;
    }

    if (Date.now() > deadline) {
      assert.fail(
        `pi's built-in mcp did not list the tools of ${name}: ${JSON.stringify(requests)}`,
      );
    }

    await delay(LISTING_POLL_MS);
  }
}

// Types `keys` and waits until the terminal has redrawn and settled.
async function press(tui: PiTuiSession, keys: string): Promise<void> {
  tui.typeText(keys);
  await tui.waitForQuiet(QUIET_MS, SCREEN_MS);
}

// Pi reads the user's `mcp.json` when its session starts, so this precedes
// the profile Pi. The configured server runs the stub as the plugin's server,
// so only its name in `mcp.json` tells the two apart.
Given(
  "the user's pi mcp.json configures the stub mcp server {string} of the plugin {string} under the name {string}",
  async function (this: ScenarioWorld, server: string, plugin: string, name: string) {
    const file = path.join(this.tokens.agentDir, "mcp.json");
    const text = `${JSON.stringify(
      {
        mcpServers: {
          [name]: { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server] },
        },
      },
      null,
      2,
    )}\n`;
    await writeScenarioFile(this, file, text);
  },
);

// BLT-05: Pi's `/mcp` manager opens only in the terminal. For an enabled
// server an extension registered, its last action disables the server for
// the session, so the up arrow from the first action reaches it whatever
// the server's state offers. Each wait anchors on the server's name or on a
// settled terminal, never on the manager's own wording.
When(
  "the user disables the mcp server {string} for the session in pi's terminal and runs {string}",
  { timeout: DISABLE_STEP_TIMEOUT_MS },
  async function (this: ScenarioWorld, name: string, command: string): Promise<void> {
    const { home } = this.tokens;
    // The stub logs into the harness directory, which only a profile Pi creates.
    await mkdir(harnessDirectory(home), { recursive: true });
    const tui = await this.startTuiSession();
    await waitForListedTools(home, name);

    const beforeManager = tui.markOutput();
    tui.sendLine("/mcp");
    await tui.waitForTextAfter(name, beforeManager, SCREEN_MS);
    await tui.waitForQuiet(QUIET_MS, SCREEN_MS);
    const beforeServer = tui.markOutput();
    tui.typeText(ENTER);
    await tui.waitForTextAfter(name, beforeServer, SCREEN_MS);
    await tui.waitForQuiet(QUIET_MS, SCREEN_MS);
    await press(tui, UP);
    await press(tui, ENTER);
    await press(tui, ESCAPE);
    await press(tui, ESCAPE);

    this.expectTuiNotices();
    tui.sendLine(command);
  },
);

// Only the When's info command prints plugin info in this terminal, so the
// set of its MCP server lines is the whole outcome.
Then(
  "pi's terminal shows the mcp server line {string}",
  async function (this: ScenarioWorld, line: string): Promise<void> {
    const tui = this.requireTuiSession();
    await tui.waitForText("mcp: plugin:", SCREEN_MS);
    await tui.waitForQuiet(QUIET_MS, SCREEN_MS);
    assert.deepStrictEqual([...new Set(tui.text.match(MCP_SERVER_LINE) ?? [])], [line]);
    this.markTuiNoticesCompared();
  },
);

/**
 * @fileoverview Steps about the user's Pi settings around a no-implementation
 * MCP verdict (MREC-05): the check that a command left the setting that turns
 * Pi's built-in MCP off as the user wrote it, since the extension never writes
 * Pi's settings (D-MB-01), and the wait for pi-mcp-adapter's first listing of
 * a stub server after a restart switches to it.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Then, When } from "@cucumber/cucumber";

import { readBuiltinTurnedOff, waitForStubListing } from "../../lib/mcp-implementation.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The user settings file as Pi leaves it after the step `the user's pi
// settings turn off pi's built-in mcp` wrote `extensions` to a new file and
// a profile Pi started: the world turns Pi's auto-retry off over RPC, and Pi
// saves that setting to the same file in its own format. Any other write
// changes the text.
const TURNED_OFF_USER_SETTINGS = JSON.stringify(
  { extensions: ["-builtin:mcp"], retry: { enabled: false } },
  null,
  2,
);

// A restart has no `Given` after it, so this waits as the listing `Given`
// does: until the stub logged a tools/list and the adapter closed the
// listing connection, so a later prompt's connection is the only one open.
When(
  "pi-mcp-adapter finishes listing the tools of the stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    const harness = this.profileHarness();
    await waitForStubListing(
      "adapter",
      this.pi,
      harness,
      expandTokens(plugin, this.tokens),
      server,
    );
  },
);

Then(
  "the user's pi settings still turn off pi's built-in mcp",
  async function (this: ScenarioWorld) {
    const { agentDir, projectDir } = this.tokens;
    const settings = {
      builtinTurnedOff: await readBuiltinTurnedOff(agentDir, projectDir),
      userSettings: await readFile(path.join(agentDir, "settings.json"), "utf8"),
    };
    assert.deepStrictEqual(settings, {
      builtinTurnedOff: true,
      userSettings: TURNED_OFF_USER_SETTINGS,
    });
  },
);

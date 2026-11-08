/**
 * @fileoverview Steps that run `/claude:plugin` commands in a headless Pi and
 * check the JSON results of the last `When` step, a command or a new session.
 * A command can also run in a one-shot Pi in json mode, whose results the
 * same steps read, or in Pi in a real terminal, whose notice a step reads
 * from the terminal's current screen (D-BG-09).
 *
 * A `Given` command is setup and must succeed, unless its text says it
 * failed, warned, or did not fail.
 * A `When` command is the action under test, and its result is kept on the
 * world for the `Then` steps.
 *
 * The `Then` steps compare the whole result. A field becomes lower-case words
 * (`needsReload` is `needs reload`), a nested object adds its own words
 * (`tally.success.count` is `tally success count`), and a list joins with
 * commas. A field the result leaves out is a field the table leaves out.
 *
 * A typed command may carry the run tokens, and result cells carry them too:
 * `{home}` for the sandbox HOME (D-03) and `{scenario time}` for a
 * `last updated at` inside the scenario's window (D-05).
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { namesLike, recordTable } from "../lib/field-rows.ts";
import { runCommandPayloads } from "../lib/pi-commands.ts";
import { runJsonModeCommand } from "../lib/pi-json-mode.ts";
import {
  envelopeFields,
  marketplaceRowRecords,
  pluginRowRecords,
  resultsRowRecords,
  resultsTable,
} from "../lib/result-rows.ts";
import { expandTokens, projectTokens } from "../lib/run-tokens.ts";

import type { NotificationPayload } from "../lib/pi-commands.ts";
import type { ScenarioWorld } from "../support/world.ts";

// A command against the loopback git host finishes in about a second; the
// deadline stays below the 30-second step timeout.
const TERMINAL_COMMAND_MS = 20_000;

// Pi redraws within milliseconds of a keystroke or a notice.
const TERMINAL_QUIET_MS = 1_000;

/**
 * Returns the notice whose first row is `anchor` on `lines`, the screen with
 * its run tokens projected: the rows from the last row that reads `anchor`
 * down to the next blank row, without the indent Pi gives them all. Fails,
 * with the screen, when no row reads `anchor`.
 */
function terminalNotice(lines: readonly string[], anchor: string): string {
  const start = lines.map((line) => line.trim()).lastIndexOf(anchor.trim());
  if (start === -1) {
    assert.fail(`no notice starting ${JSON.stringify(anchor)} on the screen:\n${lines.join("\n")}`);
  }

  const end = lines.findIndex((line, index) => index > start && line.trim() === "");
  const rows = lines.slice(start, end === -1 ? undefined : end);
  const indent = Math.min(...rows.map((row) => row.length - row.trimStart().length));
  return rows.map((row) => row.slice(indent)).join("\n");
}

/**
 * Runs the setup `command` and asserts that every result it emits has one of
 * `severities`, so a result that does not shows whole.
 */
async function runSetup(
  world: ScenarioWorld,
  command: string,
  severities: readonly NotificationPayload["severity"][],
): Promise<void> {
  const payloads = await runCommandPayloads(world.pi, expandTokens(command, world.tokens));
  assert.deepStrictEqual(
    payloads.filter((payload) => !severities.includes(payload.severity)),
    [],
  );
}

// Setup may emit any number of results, such as the two cascades of a first
// bootstrap, and every one must be info.
Given("the user has run {string}", async function (this: ScenarioWorld, command: string) {
  await runSetup(this, command, ["info"]);
});

// A retry's first attempt: every result must be an error, so a first attempt
// that succeeds fails here.
Given(
  "the user has run {string}, which failed",
  async function (this: ScenarioWorld, command: string) {
    await runSetup(this, command, ["error"]);
  },
);

// Setup whose every result is a warning, such as an apply that holds a plugin
// down for its dependency's version.
Given(
  "the user has run {string}, which warned",
  async function (this: ScenarioWorld, command: string) {
    await runSetup(this, command, ["warning"]);
  },
);

// DUAL-01: setup whose severity depends on the active MCP implementation,
// such as the install of a plugin with MCP servers, which can warn under one
// profile and not under the other. Every result must be info or a warning.
Given(
  "the user has run {string}, which did not fail",
  async function (this: ScenarioWorld, command: string) {
    await runSetup(this, command, ["info", "warning"]);
  },
);

When("the user runs {string}", async function (this: ScenarioWorld, command: string) {
  this.recordResults(
    await runCommandPayloads(this.pi, expandTokens(command, this.tokens)),
    "command",
  );
});

// D-BG-09: the same command in a one-shot Pi in json mode, whose results the
// same `Then` steps read as an rpc command's.
When(
  "the user runs {string} in pi's json mode",
  async function (this: ScenarioWorld, command: string) {
    const payloads = await runJsonModeCommand(
      await this.oneShotPiLaunch(),
      expandTokens(command, this.tokens),
      (release) => {
        this.onRelease(release);
      },
    );
    this.recordResults(payloads, "command");
  },
);

// Pi shows no sign that an extension command is running, so the step waits
// for the terminal to stay quiet after the command; the terminal result step
// waits for the notice itself before it reads it.
When(
  "the user runs {string} in pi's terminal",
  async function (this: ScenarioWorld, command: string) {
    const tui = await this.startTuiSession();
    tui.sendLine(expandTokens(command, this.tokens));
    await tui.waitForQuiet(TERMINAL_QUIET_MS, TERMINAL_COMMAND_MS);
  },
);

Then("the result has these fields:", function (this: ScenarioWorld, table: DataTable) {
  const stated = table.raw().map(([name]) => String(name));
  const fields = envelopeFields(this.lastResult(), this.tokens);
  const rows = namesLike(stated, new Set(fields.keys())).map((name) => [name, fields.get(name)]);
  assert.deepStrictEqual(rows, table.raw());
  this.markResultsCompared();
});

Then("the result lists these plugins:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = pluginRowRecords(this.lastResult(), this.tokens);
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
  this.markRowsCompared();
});

Then("the result lists these marketplaces:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = marketplaceRowRecords(this.lastResult(), this.tokens);
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
  this.markRowsCompared();
});

// A table cannot state an empty result: its columns come from the records,
// and an empty result has none.
Then("the result lists no marketplaces", function (this: ScenarioWorld) {
  const result = this.lastResult();
  if (result.kind !== "cascade") {
    assert.fail(`expected a cascade result, got ${JSON.stringify(result)}`);
  }

  assert.deepStrictEqual(result.marketplaces, []);
});

// D-02: one row per result of a command that emits several, in emission
// order, so the table pins their count, order, and kinds. Nothing is merged,
// deduplicated, or sorted: two identical results are two rows. A field one
// result lacks is an empty cell. A multi-result command with no cascade, such
// as `info <name>` over two scopes when one manifest is broken, has no row
// arrays, so this table alone compares it whole. A new session's results have
// a step of their own.
Then("the command reports these results:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  assert.deepStrictEqual(resultsTable(stated, this.resultsOf("command"), this.tokens), table.raw());
  this.markNoticesCompared();
  this.markResultsCompared();
});

Then("the command result contains no absolute sandbox path", function (this: ScenarioWorld) {
  const rendered = JSON.stringify(this.resultsOf("command"));
  for (const root of [this.tokens.home, this.tokens.projectDir, this.tokens.agentDir]) {
    assert.strictEqual(rendered.includes(root), false, `command result contains ${root}`);
  }
});

// The notice of the command the terminal ran, read from the current screen
// and anchored on its own first row, so no text Pi draws reaches the
// comparison. A redraw that replaced the notice shows its last value.
Then(
  "pi's terminal shows this result of the command:",
  async function (this: ScenarioWorld, expected: string) {
    const tui = this.requireTuiSession();
    const [anchor = ""] = expected.split("\n");
    const screen = (): string[] =>
      tui.screenLines().map((line) => projectTokens("", line, this.tokens));
    await tui.waitForScreen(
      () => screen().some((line) => line.trim() === anchor.trim()),
      TERMINAL_COMMAND_MS,
      `the notice ${anchor}`,
    );
    await tui.waitForQuiet(TERMINAL_QUIET_MS, TERMINAL_COMMAND_MS);
    assert.strictEqual(terminalNotice(screen(), anchor), expected);
  },
);

// D-02: the marketplace and plugin rows of every result, in emission order.
// Every result must have marketplace blocks, so no row goes unseen, or carry
// no row array at all: an MCP config notice, whose notices are envelope
// fields, or a kind such as `internal-error`. `the command reports these
// results:` compares those whole. A scenario that leaves a notice to this
// step alone fails when it ends.
Then(
  "the results list these marketplaces and plugins:",
  function (this: ScenarioWorld, table: DataTable) {
    const [stated = []] = table.raw();
    const records = resultsRowRecords(this.allResults(), this.tokens);
    assert.deepStrictEqual(recordTable(stated, records), table.raw());
    this.markRowsCompared();
  },
);

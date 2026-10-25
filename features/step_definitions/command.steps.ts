/**
 * @fileoverview Steps that run `/claude:plugin` commands in a headless Pi and
 * check the JSON results of the last `When` step, a command or a new session.
 *
 * A `Given` command is setup and must succeed, unless its text says it failed.
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
import {
  envelopeFields,
  marketplaceRowRecords,
  pluginRowRecords,
  resultsRowRecords,
  resultsTable,
} from "../lib/result-rows.ts";
import { expandTokens } from "../lib/run-tokens.ts";

import type { NotificationPayload } from "../lib/pi-commands.ts";
import type { ScenarioWorld } from "../support/world.ts";

/**
 * Runs the setup `command` and asserts that every result it emits has
 * `severity`, so a result that does not shows whole.
 */
async function runSetup(
  world: ScenarioWorld,
  command: string,
  severity: NotificationPayload["severity"],
): Promise<void> {
  const payloads = await runCommandPayloads(world.pi, expandTokens(command, world.tokens));
  assert.deepStrictEqual(
    payloads.filter((payload) => payload.severity !== severity),
    [],
  );
}

// Setup may emit any number of results, such as the two cascades of a first
// bootstrap, and every one must be info.
Given("the user has run {string}", async function (this: ScenarioWorld, command: string) {
  await runSetup(this, command, "info");
});

// A retry's first attempt: every result must be an error, so a first attempt
// that succeeds fails here.
Given(
  "the user has run {string}, which failed",
  async function (this: ScenarioWorld, command: string) {
    await runSetup(this, command, "error");
  },
);

When("the user runs {string}", async function (this: ScenarioWorld, command: string) {
  this.recordResults(
    await runCommandPayloads(this.pi, expandTokens(command, this.tokens)),
    "command",
  );
});

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

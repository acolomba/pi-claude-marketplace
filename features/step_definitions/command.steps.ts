/**
 * @fileoverview Steps that run `/claude:plugin` commands in a headless Pi and
 * check the JSON result of the last one.
 *
 * A `Given` command is setup and must succeed. A `When` command is the action
 * under test, and its result is kept on the world for the `Then` steps.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { runCommand } from "../lib/pi-commands.ts";

import type { PluginWorld } from "../support/world.ts";

// The top-level fields a scenario states in full. `kind`, `schemaVersion`,
// and `origin` are fixed by the schema the driver checks, and `tally` and
// `marketplaces` have steps of their own.
const RESULT_FIELDS = ["severity", "needsReload", "noOp", "summary"];

// The row fields every plugin table names, so a row with an unexpected
// status or reason never passes unseen.
const REQUIRED_PLUGIN_COLUMNS = ["id", "status", "reasons"];

// Renders one field of a result as a table cell: a list joins with commas,
// and an absent field is an empty cell.
function cell(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === undefined) {
    return "";
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function project(record: object, columns: readonly string[]): Record<string, string> {
  const fields = new Map(Object.entries(record));
  return Object.fromEntries(columns.map((column) => [column, cell(fields.get(column))]));
}

Given("the user has run {string}", async function (this: PluginWorld, command: string) {
  const payload = await runCommand(this.pi, command);
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
});

When("the user runs {string}", async function (this: PluginWorld, command: string) {
  this.result = await runCommand(this.pi, command);
});

Then("the result has these fields:", function (this: PluginWorld, table: DataTable) {
  const expected = table.rowsHash();
  assert.deepStrictEqual(Object.keys(expected), RESULT_FIELDS);
  assert.deepStrictEqual(project(this.lastResult(), RESULT_FIELDS), expected);
});

// Projects every plugin row onto the table's columns, so a scenario names
// only the fields it is about and still compares every row.
Then("the result lists these plugins:", function (this: PluginWorld, table: DataTable) {
  const expected = table.hashes();
  const columns = Object.keys(expected[0] ?? {});
  assert.deepStrictEqual(
    REQUIRED_PLUGIN_COLUMNS.filter((column) => !columns.includes(column)),
    [],
  );
  const actual = this.lastResult()
    .marketplaces.flatMap((block) => block.plugins)
    .map((row) => project(row, columns));
  assert.deepStrictEqual(actual, expected);
});

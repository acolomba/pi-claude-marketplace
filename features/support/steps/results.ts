/**
 * @fileoverview Steps that assert on the JSON result of the last command.
 */

import assert from "node:assert/strict";

import { Then } from "@cucumber/cucumber";

import type { PluginWorld } from "../world.ts";
import type { DataTable } from "@cucumber/cucumber";

// Renders one field of a plugin row as a table cell: a list joins with
// commas, and an absent field is an empty cell.
function cell(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === undefined) {
    return "";
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function assertSeverity(this: PluginWorld, severity: string): void {
  assert.strictEqual(this.lastResult().severity, severity);
}

Then("the result severity is {string}", assertSeverity);

function assertNeedsReload(this: PluginWorld): void {
  assert.strictEqual(this.lastResult().needsReload, true);
}

Then("the result needs a reload", assertNeedsReload);

function assertNeedsNoReload(this: PluginWorld): void {
  assert.strictEqual(this.lastResult().needsReload, false);
}

Then("the result needs no reload", assertNeedsNoReload);

// Projects every plugin row onto the table's columns, so a scenario names
// only the fields it is about and still compares every row.
function assertPluginRows(this: PluginWorld, table: DataTable): void {
  const expected = table.hashes();
  const columns = Object.keys(expected[0] ?? {});
  const actual = this.lastResult()
    .marketplaces.flatMap((block) => block.plugins)
    .map((row) =>
      Object.fromEntries(
        columns.map((column) => [column, cell((row as Record<string, unknown>)[column])]),
      ),
    );
  assert.deepStrictEqual(actual, expected);
}

Then("the result lists these plugins:", assertPluginRows);

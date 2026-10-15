/**
 * @fileoverview Steps that run `/claude:plugin` commands in a headless Pi and
 * check the JSON result of the last one.
 *
 * A `Given` command is setup and must succeed. A `When` command is the action
 * under test, and its result is kept on the world for the `Then` steps.
 *
 * The `Then` steps compare the whole result. A field becomes lower-case words
 * (`needsReload` is `needs reload`), a nested object adds its own words
 * (`tally.success.count` is `tally success count`), and a list joins with
 * commas. A field the result leaves out is a field the table leaves out.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { runCommand } from "../lib/pi-commands.ts";

import type { CascadePayload } from "../lib/pi-commands.ts";
import type { PluginWorld } from "../support/world.ts";

// Fields no scenario states: `kind` and `schemaVersion` are fixed by the
// schema the driver checks, `origin` carries per-run ids, and `marketplaces`
// has a step of its own.
const UNSTATED_FIELDS: ReadonlySet<string> = new Set([
  "kind",
  "schemaVersion",
  "origin",
  "marketplaces",
]);

// Words of a field name, without a leading word its parent already says:
// `cause.causeChain` is `cause chain`, not `cause cause chain`.
function fieldWords(prefix: readonly string[], key: string): string[] {
  const words = key.split(/(?=[A-Z])/u).map((word) => word.toLowerCase());
  return words[0] === prefix.at(-1) ? [...prefix, ...words.slice(1)] : [...prefix, ...words];
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cell(value: unknown): string {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join(", ");
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

// Flattens `record` into one `[name, cell]` pair per leaf field.
function flatten(record: object, prefix: readonly string[] = []): Array<[string, string]> {
  return Object.entries(record).flatMap(([key, value]): Array<[string, string]> => {
    const words = fieldWords(prefix, key);
    return isPlainObject(value) ? flatten(value, words) : [[words.join(" "), cell(value)]];
  });
}

// The names the table states, in its order, that `actual` has, then the ones
// it has and the table leaves out. Compared against the table, a missing or
// extra name shows up as the difference.
function namesLike(stated: readonly string[], actual: ReadonlySet<string>): string[] {
  return [
    ...stated.filter((name) => actual.has(name)),
    ...[...actual].filter((name) => !stated.includes(name)).sort(),
  ];
}

// One record per plugin row, carrying its marketplace's fields. A marketplace
// with no plugin rows still yields one record, so no block goes unseen.
function pluginRecords(result: CascadePayload): Array<Map<string, string>> {
  return result.marketplaces.flatMap(({ plugins, ...block }) => {
    const blockFields = flatten({ marketplace: block });
    if (plugins.length === 0) {
      return [new Map(blockFields)];
    }

    return plugins.map((row) => new Map([...blockFields, ...flatten(row)]));
  });
}

Given("the user has run {string}", async function (this: PluginWorld, command: string) {
  const payload = await runCommand(this.pi, command);
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
});

When("the user runs {string}", async function (this: PluginWorld, command: string) {
  this.result = await runCommand(this.pi, command);
});

Then("the result has these fields:", function (this: PluginWorld, table: DataTable) {
  const stated = table.raw().map(([name]) => String(name));
  const fields = new Map(
    flatten(
      Object.fromEntries(
        Object.entries(this.lastResult()).filter(([key]) => !UNSTATED_FIELDS.has(key)),
      ),
    ),
  );
  const rows = namesLike(stated, new Set(fields.keys())).map((name) => [name, fields.get(name)]);
  assert.deepStrictEqual(rows, table.raw());
});

Then("the result lists these plugins:", function (this: PluginWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = pluginRecords(this.lastResult());
  const columns = namesLike(stated, new Set(records.flatMap((record) => [...record.keys()])));
  const rows = records.map((record) => columns.map((column) => record.get(column) ?? ""));
  assert.deepStrictEqual([columns, ...rows], table.raw());
});

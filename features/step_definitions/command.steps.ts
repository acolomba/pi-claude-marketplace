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
 *
 * A typed command may carry the run tokens, and result cells carry them too:
 * `{home}` for the sandbox HOME (D-03) and `{scenario time}` for a
 * `last updated at` inside the scenario's window (D-05).
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { fieldRecord, flatten, namesLike, recordTable } from "../lib/field-rows.ts";
import { runCommand, runCommandPayloads } from "../lib/pi-commands.ts";
import { expandTokens } from "../lib/run-tokens.ts";

import type { CascadePayload, NotificationPayload } from "../lib/pi-commands.ts";
import type { RunTokens } from "../lib/run-tokens.ts";
import type { ScenarioWorld } from "../support/world.ts";

// The row arrays of a result: the marketplace rows of `marketplaces` and an
// info fan-out's `blocks`. They have steps of their own, and a passing
// scenario fails when one of them is not empty and no row step read it.
const ROW_FIELDS: ReadonlySet<string> = new Set(["marketplaces", "blocks"]);

// Fields no scenario states: `schemaVersion` is fixed by the schema the
// driver checks, `origin` carries per-run ids, and the row arrays have steps
// of their own. Every table states `kind`, as the wire writes it, hyphens
// included.
const UNSTATED_FIELDS: ReadonlySet<string> = new Set(["schemaVersion", "origin", ...ROW_FIELDS]);

// The non-empty row arrays of `results`, as `<kind> <field>`.
function rowArrays(results: readonly NotificationPayload[]): string[] {
  return results.flatMap((result) =>
    Object.entries(result)
      .filter(([key, value]) => ROW_FIELDS.has(key) && Array.isArray(value) && value.length > 0)
      .map(([key]) => `${result.kind} ${key}`),
  );
}

// One record per plugin row, carrying its marketplace's fields. A marketplace
// with no plugin rows still yields one record, so no block goes unseen.
function pluginRecords(result: CascadePayload, tokens: RunTokens): Array<Map<string, string>> {
  return result.marketplaces.flatMap(({ plugins, ...block }) => {
    const blockFields = flatten({ marketplace: block }, tokens);
    if (plugins.length === 0) {
      return [fieldRecord(blockFields)];
    }

    return plugins.map((row) => fieldRecord([...blockFields, ...flatten(row, tokens)]));
  });
}

// One record per marketplace row: a cascade's blocks or an info fan-out's
// blocks. A cascade block with plugin rows fails, so no plugin row goes unseen.
function marketplaceRecords(
  result: NotificationPayload,
  tokens: RunTokens,
): Array<Map<string, string>> {
  if (result.kind === "marketplace-info-cascade") {
    return result.blocks.map((block) => fieldRecord(flatten(block, tokens)));
  }

  if (result.kind !== "cascade") {
    assert.fail(
      `expected a cascade or marketplace-info-cascade result, got ${JSON.stringify(result)}`,
    );
  }

  return result.marketplaces.map(({ plugins, ...block }) => {
    if (plugins.length > 0) {
      assert.fail(
        `marketplace ${block.name} has plugin rows; compare them with "the result lists these plugins:"`,
      );
    }

    return fieldRecord(flatten(block, tokens));
  });
}

// The fields of one result that a scenario states, flattened: every field
// except the ones `UNSTATED_FIELDS` hides.
function envelopeFields(result: NotificationPayload, tokens: RunTokens): Map<string, string> {
  return fieldRecord(
    flatten(
      Object.fromEntries(Object.entries(result).filter(([key]) => !UNSTATED_FIELDS.has(key))),
      tokens,
    ),
  );
}

Given("the user has run {string}", async function (this: ScenarioWorld, command: string) {
  const payload = await runCommand(this.pi, expandTokens(command, this.tokens));
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
});

When("the user runs {string}", async function (this: ScenarioWorld, command: string) {
  assert.deepStrictEqual(
    this.uncomparedRows,
    [],
    "no step compared these rows of the previous results",
  );
  assert.deepStrictEqual(
    this.uncomparedNotices,
    [],
    "no step compared these MCP config notices of the previous results",
  );
  this.results = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
  this.uncomparedRows = rowArrays(this.results);
  this.uncomparedNotices = this.results
    .map((result) => result.kind)
    .filter((kind) => kind === "mcp-config-notices");
});

Then("the result has these fields:", function (this: ScenarioWorld, table: DataTable) {
  const stated = table.raw().map(([name]) => String(name));
  const fields = envelopeFields(this.lastResult(), this.tokens);
  const rows = namesLike(stated, new Set(fields.keys())).map((name) => [name, fields.get(name)]);
  assert.deepStrictEqual(rows, table.raw());
});

Then("the result lists these plugins:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const result = this.lastResult();
  if (result.kind !== "cascade") {
    assert.fail(`expected a cascade result, got ${JSON.stringify(result)}`);
  }

  assert.deepStrictEqual(recordTable(stated, pluginRecords(result, this.tokens)), table.raw());
  this.markRowsCompared();
});

Then("the result lists these marketplaces:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = marketplaceRecords(this.lastResult(), this.tokens);
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
// arrays, so this table alone compares it whole.
Then("the command reports these results:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = this.allResults().map((result) => envelopeFields(result, this.tokens));
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
  this.markNoticesCompared();
});

// D-02: the marketplace and plugin rows of every result, in emission order.
// Every result must be a cascade, so no row goes unseen, or an MCP config
// notice, which has no rows: its notices are envelope fields, which
// `the command reports these results:` compares. A scenario that leaves a
// notice to this step alone fails when it ends.
Then(
  "the results list these marketplaces and plugins:",
  function (this: ScenarioWorld, table: DataTable) {
    const [stated = []] = table.raw();
    const records = this.allResults().flatMap((result) => {
      if (result.kind === "mcp-config-notices") {
        return [];
      }

      if (result.kind !== "cascade") {
        assert.fail(
          `expected every result to be a cascade or an MCP config notice, got ${result.kind}: ${JSON.stringify(result)}`,
        );
      }

      return pluginRecords(result, this.tokens);
    });
    assert.deepStrictEqual(recordTable(stated, records), table.raw());
    this.markRowsCompared();
  },
);

/**
 * @fileoverview Projects the results of a command or a new session into the
 * records the field and row steps compare.
 *
 * A result's row arrays, `marketplaces` and `blocks`, have row steps of their
 * own. Every other field is an envelope field, which the field steps state.
 * A result with marketplace blocks is a `cascade` or a
 * `reconcile-applied-cascade`, and the row steps read both alike.
 */

import assert from "node:assert/strict";

import { fieldRecord, flatten, recordTable } from "./field-rows.ts";

import type { NotificationPayload } from "./pi-commands.ts";
import type { RunTokens } from "./run-tokens.ts";

// The row arrays of a result: the marketplace rows of `marketplaces` and an
// info fan-out's `blocks`. They have steps of their own, and a passing
// scenario fails when one of them is not empty and no row step read it.
const ROW_FIELDS: ReadonlySet<string> = new Set(["marketplaces", "blocks"]);

// Fields no scenario states: `schemaVersion` is fixed by the schema the
// driver checks, `origin` carries per-run ids, and the row arrays have steps
// of their own. Every table states `kind`, as the wire writes it, hyphens
// included.
const UNSTATED_FIELDS: ReadonlySet<string> = new Set(["schemaVersion", "origin", ...ROW_FIELDS]);

type MarketplaceBlocksResult = Extract<
  NotificationPayload,
  { kind: "cascade" | "reconcile-applied-cascade" }
>;

function hasMarketplaceBlocks(result: NotificationPayload): result is MarketplaceBlocksResult {
  return result.kind === "cascade" || result.kind === "reconcile-applied-cascade";
}

// One record per plugin row, carrying its marketplace's fields. A marketplace
// with no plugin rows still yields one record, so no block goes unseen.
function pluginRecords(
  result: MarketplaceBlocksResult,
  tokens: RunTokens,
): Array<Map<string, string>> {
  return result.marketplaces.flatMap(({ plugins, ...block }) => {
    const blockFields = flatten({ marketplace: block }, tokens);
    if (plugins.length === 0) {
      return [fieldRecord(blockFields)];
    }

    return plugins.map((row) => fieldRecord([...blockFields, ...flatten(row, tokens)]));
  });
}

/** Returns the non-empty row arrays of `results`, as `<kind> <field>`. */
export function rowArrays(results: readonly NotificationPayload[]): string[] {
  return results.flatMap((result) =>
    Object.entries(result)
      .filter(([key, value]) => ROW_FIELDS.has(key) && Array.isArray(value) && value.length > 0)
      .map(([key]) => `${result.kind} ${key}`),
  );
}

/**
 * Returns the fields of `result` that a scenario states, flattened: every
 * field except the per-run ones and the row arrays.
 */
export function envelopeFields(
  result: NotificationPayload,
  tokens: RunTokens,
): Map<string, string> {
  return fieldRecord(
    flatten(
      Object.fromEntries(Object.entries(result).filter(([key]) => !UNSTATED_FIELDS.has(key))),
      tokens,
    ),
  );
}

/**
 * Returns one record per plugin row of `result`. Fails when `result` has no
 * marketplace blocks.
 */
export function pluginRowRecords(
  result: NotificationPayload,
  tokens: RunTokens,
): Array<Map<string, string>> {
  if (!hasMarketplaceBlocks(result)) {
    assert.fail(
      `expected a cascade or reconcile-applied-cascade result, got ${JSON.stringify(result)}`,
    );
  }

  return pluginRecords(result, tokens);
}

/**
 * Returns one record per marketplace row: the blocks of an info fan-out, or
 * the marketplace blocks of a result that has them. A marketplace block with
 * plugin rows fails, so no plugin row goes unseen.
 */
export function marketplaceRowRecords(
  result: NotificationPayload,
  tokens: RunTokens,
): Array<Map<string, string>> {
  if (result.kind === "marketplace-info-cascade") {
    return result.blocks.map((block) => fieldRecord(flatten(block, tokens)));
  }

  if (!hasMarketplaceBlocks(result)) {
    assert.fail(
      `expected a cascade, reconcile-applied-cascade, or marketplace-info-cascade result, got ${JSON.stringify(result)}`,
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

/**
 * Returns the plugin row records of every result, in order. An MCP config
 * notice has no rows: its notices are envelope fields. Any other result
 * without marketplace blocks fails, so no row goes unseen.
 */
export function resultsRowRecords(
  results: readonly NotificationPayload[],
  tokens: RunTokens,
): Array<Map<string, string>> {
  return results.flatMap((result) => {
    if (result.kind === "mcp-config-notices") {
      return [];
    }

    if (!hasMarketplaceBlocks(result)) {
      assert.fail(
        `expected every result to have marketplace blocks or to be an MCP config notice, got ${result.kind}: ${JSON.stringify(result)}`,
      );
    }

    return pluginRecords(result, tokens);
  });
}

/**
 * Returns the table of `results` with one row of envelope fields per result,
 * in order, the way a scenario states it with the `stated` columns.
 */
export function resultsTable(
  stated: readonly string[],
  results: readonly NotificationPayload[],
  tokens: RunTokens,
): string[][] {
  return recordTable(
    stated,
    results.map((result) => envelopeFields(result, tokens)),
  );
}

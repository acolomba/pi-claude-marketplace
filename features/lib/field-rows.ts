/**
 * @fileoverview Turns JSON records into the string rows a data table
 * compares.
 *
 * A field name becomes lower-case words (`needsReload` is `needs reload`), a
 * nested object adds its own words (`tally.success.count` is
 * `tally success count`), and a list joins with commas. Any other value, such
 * as a list of objects, is its JSON text. Each cell, the JSON text too,
 * carries the run tokens in place of run-specific values. A table's columns
 * come in the table's order, followed by any column the table leaves out.
 */

import { projectTokens } from "./run-tokens.ts";

import type { RunTokens } from "./run-tokens.ts";

// Words of a field name, without a leading word its parent already says:
// `cause.causeChain` is `cause chain`, not `cause cause chain`.
function fieldWords(prefix: readonly string[], key: string): string[] {
  const words = key.split(/(?=[A-Z])/u).map((word) => word.toLowerCase());
  return words[0] === prefix.at(-1) ? [...prefix, ...words.slice(1)] : [...prefix, ...words];
}

/** Whether `value` is an object that is neither `null` nor an array. */
export function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// Each string, and each string of a list, is projected to tokens before a
// list is joined. Any other value is projected as its JSON text.
function cell(key: string, value: unknown, tokens: RunTokens): string {
  if (isStringArray(value)) {
    return value.map((item) => projectTokens(key, item, tokens)).join(", ");
  }

  return typeof value === "string"
    ? projectTokens(key, value, tokens)
    : projectTokens(key, JSON.stringify(value), tokens);
}

/** Flattens `record` into one `[name, cell]` pair per leaf field. */
export function flatten(
  record: object,
  tokens: RunTokens,
  prefix: readonly string[] = [],
): Array<[string, string]> {
  return Object.entries(record).flatMap(([key, value]): Array<[string, string]> => {
    const words = fieldWords(prefix, key);
    return isPlainObject(value)
      ? flatten(value, tokens, words)
      : [[words.join(" "), cell(key, value, tokens)]];
  });
}

/**
 * Builds the record of the `[name, cell]` pairs, throwing when two fields
 * project to the same name, so no field's value is dropped unseen.
 */
export function fieldRecord(pairs: ReadonlyArray<readonly [string, string]>): Map<string, string> {
  const record = new Map<string, string>();
  for (const [name, value] of pairs) {
    if (record.has(name)) {
      throw new Error(`two fields project to the column "${name}"`);
    }

    record.set(name, value);
  }

  return record;
}

/**
 * Returns the names the table states, in its order, that `actual` has, then
 * the ones it has and the table leaves out. Compared against the table, a
 * missing or extra name shows up as the difference.
 */
export function namesLike(stated: readonly string[], actual: ReadonlySet<string>): string[] {
  return [
    ...stated.filter((name) => actual.has(name)),
    ...[...actual].filter((name) => !stated.includes(name)).sort(),
  ];
}

/**
 * Returns the table of `records` the way a scenario states it: the stated
 * columns the records have, then the ones the table leaves out, and an empty
 * cell where a record lacks a column.
 */
export function recordTable(
  stated: readonly string[],
  records: ReadonlyArray<ReadonlyMap<string, string>>,
): string[][] {
  const columns = namesLike(stated, new Set(records.flatMap((record) => [...record.keys()])));
  return [columns, ...records.map((record) => columns.map((column) => record.get(column) ?? ""))];
}

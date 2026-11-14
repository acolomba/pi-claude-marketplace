/**
 * @fileoverview The tokens that stand for the stdin values of hook runs that
 * differ on every run, shared by the steps that state whole payloads.
 *
 * A `tool_use_id` names one tool call, so each distinct id of a turn's runs
 * reads as `{tool use <n>}`, counted from 1 by the order it first appears in
 * across the runs, in the order the hook processes appended them. A table
 * then shows that the pre run and the result run of one call share an id and
 * that another call has another. Only a string id gets a token; any other
 * value is the caller's to print as its JSON text, so a wrong type fails the
 * table (D-PG6-12). The tokens differ from the session ordinals `first` to
 * `fourth`.
 */

import type { HookRun } from "./hook-recorder.ts";

/** The token of one stdin member, or `undefined` for a member that has none. */
export type HookRunTokenOf = (key: string, value: unknown) => string | undefined;

/** Reads the tokens of `runs` and returns the lookup of one stdin member's token. */
export function hookRunTokens(runs: readonly HookRun[]): HookRunTokenOf {
  const toolUses = new Map<string, string>();
  for (const { stdin } of runs) {
    const id = stdin.tool_use_id;
    if (typeof id === "string" && !toolUses.has(id)) {
      toolUses.set(id, `{tool use ${toolUses.size + 1}}`);
    }
  }

  return (key, value) =>
    key === "tool_use_id" && typeof value === "string" ? toolUses.get(value) : undefined;
}

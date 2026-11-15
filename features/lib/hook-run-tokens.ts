/**
 * @fileoverview The tokens that stand for the stdin values of hook runs that
 * differ on every run, shared by the steps that state whole payloads.
 *
 * A `tool_use_id` names one tool call, so each distinct id of a turn's runs
 * reads as `{tool use <n>}`, counted from 1 by the order it first appears in
 * across the runs, in the order the hook processes appended them. A table
 * then shows that the pre run and the result run of one call share an id and
 * that another call has another. A pair of a native edit carries its call's
 * id with `#<m>` after it, so it reads as the call's token followed by the
 * same `#<m>` (D-PG6-05). Only a string id gets a token; any other value is
 * the caller's to print as its JSON text, so a wrong type fails the table
 * (D-PG6-12). The tokens differ from the session ordinals `first` to
 * `fourth`.
 *
 * A `duration_ms` that is a non-negative integer reads as `{milliseconds}`,
 * so no table states a timing value; any other value gets no token
 * (D-PG6-06, D-PG6-12).
 */

import type { HookRun } from "./hook-recorder.ts";

/** The token of one stdin member, or `undefined` for a member that has none. */
export type HookRunTokenOf = (key: string, value: unknown) => string | undefined;

// A tool use id split into its call's id and the `#<m>` of an edit pair, if any.
function callAndPair(id: string): readonly [string, string] {
  const pair = /#\d+$/u.exec(id)?.[0] ?? "";
  return [id.slice(0, id.length - pair.length), pair];
}

/** Reads the tokens of `runs` and returns the lookup of one stdin member's token. */
export function hookRunTokens(runs: readonly HookRun[]): HookRunTokenOf {
  const toolUses = new Map<string, string>();
  for (const { stdin } of runs) {
    const id = stdin.tool_use_id;
    if (typeof id === "string") {
      const [call] = callAndPair(id);
      if (!toolUses.has(call)) {
        toolUses.set(call, `{tool use ${toolUses.size + 1}}`);
      }
    }
  }

  return (key, value) => {
    if (key === "duration_ms") {
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? "{milliseconds}"
        : undefined;
    }

    if (key !== "tool_use_id" || typeof value !== "string") {
      return undefined;
    }

    const [call, pair] = callAndPair(value);
    const token = toolUses.get(call);
    return token === undefined ? undefined : `${token}${pair}`;
  };
}

// bridges/commands/command-record.ts
//
// D-CF3-06: the record install stores in a staged command's frontmatter. It
// holds the values `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`
// received at install. The command invocation handler reads it back at
// session time to fill those two variables when a typed argument names one,
// as Claude Code does. Pi sends no frontmatter to the model, so the record
// never reaches it.

import Type from "typebox";
import { Compile } from "typebox/compile";

/** The frontmatter key that holds the record. */
const RECORD_KEY = "pi-claude-marketplace";

/** The install-time values of one staged command. */
export interface CommandRecord {
  readonly pluginRoot: string;
  readonly pluginData: string;
}

// A record with a member of its own is not one install wrote.
const STORED_RECORD = Compile(
  Type.Object(
    { pluginRoot: Type.String(), pluginData: Type.String() },
    { additionalProperties: false },
  ),
);

/**
 * Returns a copy of `frontmatter` that ends with `record` under the record
 * key. An author value under that key is replaced, never merged, so a plugin
 * cannot plant values the handler would trust.
 */
export function withCommandRecord(
  frontmatter: Readonly<Record<string, unknown>>,
  record: CommandRecord,
): Readonly<Record<string, unknown>> {
  const entries = Object.entries(frontmatter).filter(([key]) => key !== RECORD_KEY);
  return Object.fromEntries([
    ...entries,
    [RECORD_KEY, { pluginRoot: record.pluginRoot, pluginData: record.pluginData }],
  ]);
}

/**
 * Returns the record under the record key of a staged command's parsed
 * `frontmatter`, or `undefined` when the key is missing or holds anything
 * other than exactly the two string members install writes.
 */
export function readCommandRecord(
  frontmatter: Readonly<Record<string, unknown>>,
): CommandRecord | undefined {
  const stored = frontmatter[RECORD_KEY];
  return STORED_RECORD.Check(stored)
    ? { pluginRoot: stored.pluginRoot, pluginData: stored.pluginData }
    : undefined;
}

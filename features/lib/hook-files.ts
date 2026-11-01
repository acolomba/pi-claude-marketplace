/**
 * @fileoverview Writes the hooks of a published plugin: one `hooks/hooks.json`
 * whose hooks each run the hook recorder (HAR-04, D-CF1-08).
 *
 * Each hook runs Node on the recorder by absolute paths, both quoted, with
 * the hook's name as its one argument, so a run names the hook that made it
 * and two hooks on one matcher are two different commands.
 */

import { HOOK_RECORDER_PATH } from "./hook-recorder.ts";
import { writePublishedPluginFile } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

/** A hook that records its runs: its name, the event it runs on, and its matcher. */
export interface RecordingHook {
  readonly name: string;
  readonly event: string;
  readonly matcher: string;
}

const COLUMNS = ["name", "event", "matcher"] as const;

/**
 * Reads the rows of a `| name | event | matcher |` table, header included,
 * throwing on a missing or unknown column or an empty table.
 */
export function parseRecordingHooks(rows: readonly (readonly string[])[]): RecordingHook[] {
  const [header, ...body] = rows;
  if (header?.join("|") !== COLUMNS.join("|")) {
    throw new Error(`the hooks table needs the columns ${COLUMNS.join(", ")}`);
  }

  if (body.length === 0) {
    throw new Error("the hooks table lists no hook");
  }

  return body.map(([name, event, matcher]) => {
    if (name === undefined || event === undefined || matcher === undefined) {
      throw new Error("a hooks table row lacks a cell");
    }

    // The name is the command's one argument, so it must not need quoting.
    if (!/^[a-z0-9-]+$/u.test(name)) {
      throw new Error(`a hook name is lower-case letters, digits, and dashes: ${name}`);
    }

    return { name, event, matcher };
  });
}

// The command of a hook named `name` that records its runs.
function recordingHookCommand(name: string): string {
  return `"${process.execPath}" "${HOOK_RECORDER_PATH}" ${name}`;
}

/**
 * Returns the text of a `hooks/hooks.json` that holds `hooks`, one matcher
 * group each, in the order given.
 */
export function recordingHooksText(hooks: readonly RecordingHook[]): string {
  const events: Record<string, unknown[]> = {};
  for (const hook of hooks) {
    const groups = events[hook.event] ?? [];
    groups.push({
      matcher: hook.matcher,
      hooks: [{ type: "command", command: recordingHookCommand(hook.name) }],
    });
    events[hook.event] = groups;
  }

  return `${JSON.stringify({ hooks: events }, null, 2)}\n`;
}

/**
 * Writes `hooks` into the published plugin `plugin`, which must not hold a
 * `hooks/hooks.json` yet, and returns the path of the file.
 */
export async function publishRecordingHooks(
  published: PublishedMarketplace,
  plugin: string,
  hooks: readonly RecordingHook[],
): Promise<string> {
  return writePublishedPluginFile(published, plugin, "hooks/hooks.json", recordingHooksText(hooks));
}

/**
 * @fileoverview Writes the hooks of a published plugin: one `hooks/hooks.json`
 * whose hooks each run the hook recorder (HAR-04, D-CF1-08).
 *
 * The hooks table starts with the columns `name`, `event`, and `matcher`. Any
 * of these optional columns may follow, and an empty cell leaves the column
 * unset for that row:
 *
 * - `form`: how the hook declares its command. `shell` (the default) runs Node
 *   on the recorder by absolute paths, both quoted, with the hook's name as its
 *   first argument, through the shell. `exec` declares the same command in exec
 *   form: `command` is Node's path and `args` holds the recorder's path, the
 *   name, and the hook's arguments, so no shell runs.
 * - `arguments`: a JSON array of strings. In exec form each one is an element
 *   of `args`; in shell form they are words appended to the command line as
 *   written, so the shell reads their quoting.
 *
 * A run names the hook that made it, so two hooks on one matcher are two
 * different commands.
 */

import { HOOK_RECORDER_PATH } from "./hook-recorder.ts";
import { writePublishedPluginFile } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

/** How a hook declares its command. */
export type RecordingHookForm = "shell" | "exec";

/**
 * A hook that records its runs: its name, the event it runs on, its matcher,
 * and the optional columns of its row.
 */
export interface RecordingHook {
  readonly name: string;
  readonly event: string;
  readonly matcher: string;
  readonly form?: RecordingHookForm;
  readonly arguments?: readonly string[];
}

const REQUIRED_COLUMNS = ["name", "event", "matcher"] as const;

const OPTIONAL_COLUMNS: ReadonlySet<string> = new Set(["form", "arguments"]);

const FORMS: ReadonlySet<string> = new Set<RecordingHookForm>(["shell", "exec"]);

// Checks the header and returns its optional columns, in order.
function optionalColumns(header: readonly string[] | undefined): readonly string[] {
  if (header?.slice(0, REQUIRED_COLUMNS.length).join("|") !== REQUIRED_COLUMNS.join("|")) {
    throw new Error(`the hooks table starts with the columns ${REQUIRED_COLUMNS.join(", ")}`);
  }

  const optional = header.slice(REQUIRED_COLUMNS.length);
  for (const [index, column] of optional.entries()) {
    if (!OPTIONAL_COLUMNS.has(column)) {
      throw new Error(`the hooks table has an unknown column: ${column}`);
    }

    if (optional.indexOf(column) !== index) {
      throw new Error(`the hooks table repeats the column: ${column}`);
    }
  }

  return optional;
}

function parseForm(cell: string): RecordingHookForm {
  if (!FORMS.has(cell)) {
    throw new Error(`a hook form is one of ${[...FORMS].join(", ")}: ${cell}`);
  }

  return cell as RecordingHookForm;
}

function parseArguments(cell: string): readonly string[] {
  const value: unknown = JSON.parse(cell);
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    throw new Error(`a hook's arguments are a JSON array of strings: ${cell}`);
  }

  return value;
}

// Reads one row: the required cells, then each optional cell that is not empty.
function parseRow(row: readonly string[], optional: readonly string[]): RecordingHook {
  const [name, event, matcher, ...cells] = row;
  if (
    name === undefined ||
    event === undefined ||
    matcher === undefined ||
    cells.length !== optional.length
  ) {
    throw new Error("a hooks table row lacks a cell");
  }

  // The name is an argument of the command, so it must not need quoting.
  if (!/^[a-z0-9-]+$/u.test(name)) {
    throw new Error(`a hook name is lower-case letters, digits, and dashes: ${name}`);
  }

  let hook: RecordingHook = { name, event, matcher };
  for (const [index, column] of optional.entries()) {
    const cell = cells[index] ?? "";
    if (cell === "") {
      continue;
    }

    hook =
      column === "form"
        ? { ...hook, form: parseForm(cell) }
        : { ...hook, arguments: parseArguments(cell) };
  }

  return hook;
}

/**
 * Reads the rows of a hooks table, header included, throwing on a missing or
 * unknown column, a malformed cell, or an empty table.
 */
export function parseRecordingHooks(rows: readonly (readonly string[])[]): RecordingHook[] {
  const [header, ...body] = rows;
  const optional = optionalColumns(header);
  if (body.length === 0) {
    throw new Error("the hooks table lists no hook");
  }

  return body.map((row) => parseRow(row, optional));
}

// The handler of `hook`, which runs the recorder with the hook's name and arguments.
function recordingHandler(hook: RecordingHook): Record<string, unknown> {
  const extra = hook.arguments ?? [];
  if (hook.form === "exec") {
    return {
      type: "command",
      command: process.execPath,
      args: [HOOK_RECORDER_PATH, hook.name, ...extra],
    };
  }

  const words = [`"${process.execPath}"`, `"${HOOK_RECORDER_PATH}"`, hook.name, ...extra];
  return { type: "command", command: words.join(" ") };
}

/**
 * Returns the text of a `hooks/hooks.json` that holds `hooks`, one matcher
 * group each, in the order given.
 */
export function recordingHooksText(hooks: readonly RecordingHook[]): string {
  const events: Record<string, unknown[]> = {};
  for (const hook of hooks) {
    const groups = events[hook.event] ?? [];
    groups.push({ matcher: hook.matcher, hooks: [recordingHandler(hook)] });
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

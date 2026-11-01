/**
 * @fileoverview Writes the hooks of a published plugin from one table: a
 * `hooks/hooks.json` whose hooks each run the hook recorder, and the script
 * of every hook that runs one (HAR-04, D-CF1-08, D-CF5-26).
 *
 * The hooks table starts with the columns `name`, `event`, and `matcher`. Any
 * of the optional columns below may follow, in any order, and an empty cell
 * leaves its column unset for that row. An unknown or repeated column, or a
 * malformed cell, throws.
 *
 * `form` says how the hook declares its command:
 *
 * - `shell` (the default) runs Node on the recorder by absolute paths, both
 *   quoted, with the hook's name as its first argument, through the shell.
 * - `exec` declares the same command in exec form: `command` is Node's path
 *   and `args` holds the recorder's path, the name, and the hook's arguments.
 * - `script` writes `hooks/<name>.sh` (mode 0755) into the plugin and declares
 *   the shell-form command `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`.
 * - `exec script` writes the same script and declares the same command in
 *   exec form, with `args` holding the hook's arguments (`[]` when it has none).
 * - `missing` declares that exec-form command and writes no script, so the
 *   hook cannot start.
 *
 * A script hook's command text is the same on every run, so a message that
 * quotes the command can be stated whole. Script hooks need a `dir` or `file`
 * publication, which installs run in place, so the mode bit holds.
 *
 * `arguments` is a JSON array of strings. In an exec form each one is an
 * element of `args`. In the `shell` and `script` forms they are words appended
 * to the command line as written, so the shell reads their quoting.
 *
 * These columns describe what a script does, so they need the `script` or
 * `exec script` form. The script reads its whole stdin first and pipes it to
 * the recorder, run with the hook's name, then `met` or `alone` when `meets`
 * is set, then the script's own arguments. After recording it:
 *
 * - `on reentry`: `allow` exits 0 with no output when the stdin holds
 *   `"stop_hook_active":true`, so a Stop hook blocks once and lets the
 *   re-entered turn end.
 * - `stderr` and `output`: text it prints, as written, to stderr and stdout.
 * - `sleep`: seconds it waits after printing.
 * - `exit code`: the code it exits with, 0 by default.
 * - `meets`: before recording, it creates `$HOME/hook-meetings/<name>` and
 *   waits at most 3 seconds for `$HOME/hook-meetings/<meets>`, the file of
 *   another hook of the table. It records `met` if that file appeared and
 *   `alone` if not. The files stay for the rest of the scenario.
 *
 * These columns become fields of the handler: `timeout` (seconds, a number),
 * `if`, `on failure` (`block` or `continue`, the field `onFailure`), and `once`
 * (`true` or `false`).
 *
 * A run names the hook that made it, so two hooks on one matcher are two
 * different commands. Publishing a table again replaces `hooks/hooks.json`
 * and the scripts it writes.
 */

import { chmod, readFile } from "node:fs/promises";
import path from "node:path";

import { HOOK_RECORDER_PATH } from "./hook-recorder.ts";
import { writePublishedPluginFiles } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

/** How a hook declares its command. */
export type RecordingHookForm = "shell" | "exec" | "script" | "exec script" | "missing";

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
  readonly output?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly sleep?: number;
  readonly meets?: string;
  readonly onReentry?: "allow";
  readonly timeout?: number;
  readonly if?: string;
  readonly onFailure?: "block" | "continue";
  readonly once?: boolean;
}

const REQUIRED_COLUMNS = ["name", "event", "matcher"] as const;

const FORMS: readonly RecordingHookForm[] = ["shell", "exec", "script", "exec script", "missing"];

const SCRIPT_FORMS: ReadonlySet<RecordingHookForm | undefined> = new Set<RecordingHookForm>([
  "script",
  "exec script",
]);

// The fields only a script can act on, by the column that sets each.
const BEHAVIOR_FIELDS = {
  output: "output",
  stderr: "stderr",
  "exit code": "exitCode",
  sleep: "sleep",
  meets: "meets",
  "on reentry": "onReentry",
} as const satisfies Record<string, keyof RecordingHook>;

// The directory, in the plugin, of every hook script.
const SCRIPT_DIRECTORY = "hooks";

// How long `meets` waits for the other hook, in tenths of a second.
const MEETING_TENTHS = 30;

function oneOf<T extends string>(cell: string, values: readonly T[], what: string): T {
  const value = values.find((candidate) => candidate === cell);
  if (value === undefined) {
    throw new Error(`${what} is one of ${values.join(", ")}: ${cell}`);
  }

  return value;
}

function parseName(cell: string): string {
  // A name is an argument of a command and part of a file name, so it must
  // not need quoting.
  if (!/^[a-z0-9-]+$/u.test(cell)) {
    throw new Error(`a hook name is lower-case letters, digits, and dashes: ${cell}`);
  }

  return cell;
}

function parseArguments(cell: string): readonly string[] {
  const value: unknown = JSON.parse(cell);
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    throw new Error(`a hook's arguments are a JSON array of strings: ${cell}`);
  }

  return value;
}

function parseExitCode(cell: string): number {
  if (!/^\d+$/u.test(cell) || Number(cell) > 255) {
    throw new Error(`a hook's exit code is an integer from 0 to 255: ${cell}`);
  }

  return Number(cell);
}

function parseSeconds(cell: string, what: string): number {
  if (!/^\d+(?:\.\d+)?$/u.test(cell)) {
    throw new Error(`a hook's ${what} is a number of seconds: ${cell}`);
  }

  return Number(cell);
}

function parseOnce(cell: string): boolean {
  return oneOf(cell, ["true", "false"], "a hook's once") === "true";
}

// Each optional column, and the fields its cell sets.
const COLUMN_PARSERS: Readonly<Record<string, (cell: string) => Partial<RecordingHook>>> = {
  form: (cell) => ({ form: oneOf(cell, FORMS, "a hook form") }),
  arguments: (cell) => ({ arguments: parseArguments(cell) }),
  output: (cell) => ({ output: cell }),
  stderr: (cell) => ({ stderr: cell }),
  "exit code": (cell) => ({ exitCode: parseExitCode(cell) }),
  sleep: (cell) => ({ sleep: parseSeconds(cell, "sleep") }),
  meets: (cell) => ({ meets: parseName(cell) }),
  "on reentry": (cell) => ({ onReentry: oneOf(cell, ["allow"], "a hook's on reentry") }),
  timeout: (cell) => ({ timeout: parseSeconds(cell, "timeout") }),
  if: (cell) => ({ if: cell }),
  "on failure": (cell) => ({
    onFailure: oneOf(cell, ["block", "continue"], "a hook's on failure"),
  }),
  once: (cell) => ({ once: parseOnce(cell) }),
};

// Checks the header and returns the parser of each optional column, in order.
function columnParsers(
  header: readonly string[] | undefined,
): ReadonlyArray<readonly [string, (cell: string) => Partial<RecordingHook>]> {
  if (header?.slice(0, REQUIRED_COLUMNS.length).join("|") !== REQUIRED_COLUMNS.join("|")) {
    throw new Error(`the hooks table starts with the columns ${REQUIRED_COLUMNS.join(", ")}`);
  }

  const optional = header.slice(REQUIRED_COLUMNS.length);
  return optional.map((column, index) => {
    const parser = Object.hasOwn(COLUMN_PARSERS, column) ? COLUMN_PARSERS[column] : undefined;
    if (parser === undefined) {
      throw new Error(`the hooks table has an unknown column: ${column}`);
    }

    if (optional.indexOf(column) !== index) {
      throw new Error(`the hooks table repeats the column: ${column}`);
    }

    return [column, parser] as const;
  });
}

// Throws when a row that runs no script sets a column only a script acts on.
function checkBehavior(hook: RecordingHook): void {
  if (SCRIPT_FORMS.has(hook.form)) {
    return;
  }

  for (const [column, field] of Object.entries(BEHAVIOR_FIELDS)) {
    if (hook[field] !== undefined) {
      throw new Error(`the hook ${hook.name} sets ${column}, which needs the script form`);
    }
  }
}

// Reads one row: the required cells, then each optional cell that is not empty.
function parseRow(
  row: readonly string[],
  parsers: ReadonlyArray<readonly [string, (cell: string) => Partial<RecordingHook>]>,
): RecordingHook {
  const [name, event, matcher, ...cells] = row;
  if (
    name === undefined ||
    event === undefined ||
    matcher === undefined ||
    cells.length !== parsers.length
  ) {
    throw new Error("a hooks table row lacks a cell");
  }

  let hook: RecordingHook = { name: parseName(name), event, matcher };
  for (const [index, [, parser]] of parsers.entries()) {
    const cell = cells[index] ?? "";
    if (cell !== "") {
      hook = { ...hook, ...parser(cell) };
    }
  }

  checkBehavior(hook);
  return hook;
}

/**
 * Reads the rows of a hooks table, header included, throwing on a missing,
 * unknown, or repeated column, a malformed cell, a `meets` that names no hook
 * of the table, or an empty table.
 */
export function parseRecordingHooks(rows: readonly (readonly string[])[]): RecordingHook[] {
  const [header, ...body] = rows;
  const parsers = columnParsers(header);
  if (body.length === 0) {
    throw new Error("the hooks table lists no hook");
  }

  const hooks = body.map((row) => parseRow(row, parsers));
  const names = new Set(hooks.map((hook) => hook.name));
  for (const hook of hooks) {
    if (hook.meets !== undefined && !names.has(hook.meets)) {
      throw new Error(`the hook ${hook.name} meets ${hook.meets}, which the table lacks`);
    }
  }

  return hooks;
}

// How a single quote is written inside a single-quoted shell word.
const QUOTED_QUOTE = String.raw`'\''`;

// A word the shell reads as `text` exactly.
function shellQuoted(text: string): string {
  return `'${text.replaceAll("'", QUOTED_QUOTE)}'`;
}

function writesScript(hook: RecordingHook): boolean {
  return SCRIPT_FORMS.has(hook.form);
}

// The path of `hook`'s script inside the plugin.
function scriptFile(hook: RecordingHook): string {
  return `${SCRIPT_DIRECTORY}/${hook.name}.sh`;
}

// The lines that wait for the other hook and set `meeting` to `met` or `alone`.
function meetingLines(name: string, other: string): string[] {
  return [
    'meetings="$HOME/hook-meetings"',
    'mkdir -p "$meetings"',
    `: > "$meetings/${name}"`,
    "meeting=alone",
    "tenths=0",
    `while [ "$tenths" -lt ${MEETING_TENTHS} ]; do`,
    `  if [ -e "$meetings/${other}" ]; then meeting=met; break; fi`,
    "  sleep 0.1",
    "  tenths=$((tenths + 1))",
    "done",
  ];
}

// The lines a script runs after it records.
function afterRecording(hook: RecordingHook): string[] {
  return [
    ...(hook.onReentry === "allow"
      ? [`case "$stdin" in *'"stop_hook_active":true'*) exit 0 ;; esac`]
      : []),
    ...(hook.stderr === undefined ? [] : [`printf '%s' ${shellQuoted(hook.stderr)} >&2`]),
    ...(hook.output === undefined ? [] : [`printf '%s' ${shellQuoted(hook.output)}`]),
    // The sleep keeps no pipe of the hook open, so killing the script ends
    // the hook's output at once.
    ...(hook.sleep === undefined ? [] : [`sleep ${hook.sleep} </dev/null >/dev/null 2>&1`]),
    `exit ${hook.exitCode ?? 0}`,
  ];
}

/** Returns the text of the script of `hook`, which runs the recorder. */
function scriptText(hook: RecordingHook): string {
  const meeting = hook.meets === undefined ? [] : meetingLines(hook.name, hook.meets);
  const marker = hook.meets === undefined ? "" : ' "$meeting"';
  const recorder = `"${process.execPath}" "${HOOK_RECORDER_PATH}" ${hook.name}${marker} "$@"`;
  return `${[
    "#!/bin/sh",
    "stdin=$(cat)",
    ...meeting,
    `printf '%s' "$stdin" | ${recorder}`,
    ...afterRecording(hook),
  ].join("\n")}\n`;
}

// The `command` and `args` of `hook`'s handler.
function handlerCommand(hook: RecordingHook): Record<string, unknown> {
  const extra = hook.arguments ?? [];
  const script = `\${CLAUDE_PLUGIN_ROOT}/${scriptFile(hook)}`;
  const form = hook.form ?? "shell";
  switch (form) {
    case "shell":
      return {
        command: [`"${process.execPath}"`, `"${HOOK_RECORDER_PATH}"`, hook.name, ...extra].join(
          " ",
        ),
      };
    case "exec":
      return { command: process.execPath, args: [HOOK_RECORDER_PATH, hook.name, ...extra] };
    case "script":
      return { command: [script, ...extra].join(" ") };
    case "exec script":
    case "missing":
      return { command: script, args: [...extra] };
  }
}

// The handler of `hook`: its command and the handler fields its row sets.
function recordingHandler(hook: RecordingHook): Record<string, unknown> {
  return {
    type: "command",
    ...handlerCommand(hook),
    ...(hook.timeout === undefined ? {} : { timeout: hook.timeout }),
    ...(hook.if === undefined ? {} : { if: hook.if }),
    ...(hook.onFailure === undefined ? {} : { onFailure: hook.onFailure }),
    ...(hook.once === undefined ? {} : { once: hook.once }),
  };
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
 * Writes `hooks` into the published plugin `plugin`, replacing its
 * `hooks/hooks.json` and the scripts the table writes, and returns the path
 * of `hooks/hooks.json`. It makes each script executable and reads it back.
 */
export async function publishRecordingHooks(
  published: PublishedMarketplace,
  plugin: string,
  hooks: readonly RecordingHook[],
): Promise<string> {
  const scripts = hooks
    .filter(writesScript)
    .map((hook) => [scriptFile(hook), scriptText(hook)] as const);
  if (scripts.length > 0 && published.kind !== "dir" && published.kind !== "file") {
    throw new Error(`script hooks need a dir or file publication, not ${published.kind}`);
  }

  await writePublishedPluginFiles(published, plugin, {
    "hooks/hooks.json": recordingHooksText(hooks),
    ...Object.fromEntries(scripts),
  });
  const directory = path.join(published.root, "plugins", plugin);
  await Promise.all(
    scripts.map(async ([file, text]) => {
      const target = path.join(directory, file);
      await chmod(target, 0o755);
      if ((await readFile(target, "utf8")) !== text) {
        throw new Error(`the hook script ${file} does not hold the text written`);
      }
    }),
  );
  return path.join(directory, "hooks", "hooks.json");
}

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
 * - `when old string` or `when last message`, with `matched output`: it
 *   prints `matched output` instead of `output` when the stdin's
 *   `tool_input.old_string`, or its `last_assistant_message`, is the cell.
 * - `output bytes`: a number of `x` bytes it prints to stdout after `output`,
 *   such as more than 1 MB of output.
 * - `trailing output`: text it prints, as written, to stdout after
 *   `output bytes`, so `output`, the bytes, and this text can make one JSON
 *   object whose string field holds the bytes.
 * - `sleep`: seconds it waits after printing.
 * - `exit code`: the code it exits with, 0 by default.
 * - `meets`: before recording, it creates `$HOME/hook-meetings/<name>` and
 *   waits at most 3 seconds for `$HOME/hook-meetings/<meets>`, the file of
 *   another hook of the table. It records `met` if that file appeared and
 *   `alone` if not. The files stay for the rest of the scenario.
 * - `sigterm`: `ignore` makes it ignore SIGTERM from its first line, and so
 *   do the commands it runs, so only a SIGKILL ends it before its end.
 * - `waits`: `true` makes it wait, before the lines above, until
 *   `$HOME/hook-releases/<name>` exists, so the hook outlives its event until
 *   a step releases it. It then removes the marker, so one release frees one
 *   run and a later run of the same hook waits again. It gives up after 60
 *   seconds, so a scenario that fails before the release leaves no process
 *   for long (D-BG-12).
 *
 * These columns become fields of the handler: `timeout` (seconds, a number),
 * `if`, `on failure` (`block` or `continue`, the field `onFailure`), `once`
 * (`true` or `false`), `async` and `async rewake` (`true` or `false`, the
 * fields `async` and `asyncRewake`, as Claude Code declares them on a command
 * hook), and `rewake message` and `rewake summary` (text, the fields
 * `rewakeMessage` and `rewakeSummary`).
 *
 * A script hook that sets `async`, `async rewake`, or `waits` is a lifecycle
 * hook (D-BG-12). Before it reads its stdin, its script writes its pid to
 * `<harness dir>/hook-<name>-<pid>.pid`, which the release of the profile Pi
 * reads to stop the script and then checks as a stand-in's. The release also
 * reads the bridge's PID table to stop a child before its script writes that
 * file. Right after recording, the script runs the recorder in its lifecycle
 * mode with `start`. When it exits, it runs the recorder with `end` and its
 * exit code, then removes the pid file. Every other hook writes neither.
 *
 * A lifecycle script runs only while the hook gate of the Pi that started it
 * is open. The gate is the file `<harness dir>/hook-gate-<id>`, and the Pi's
 * environment holds the id in `PI_CM_HOOK_GATE`, so every hook of that Pi has
 * it from the moment Pi starts the hook. The script checks the gate before
 * and after it writes its pid file, and exits 0 at once when the gate is
 * closed. The release closes the gate before it reads the pid files. So a
 * script that Pi started just before it stopped has either written its pid
 * file by the time the release reads them, or finds the gate closed. Without
 * this, such a script would outlive its scenario and could take the release
 * marker of the next one, which uses the same sandbox HOME. A Pi whose
 * environment names no open gate runs no lifecycle script.
 *
 * A run names the hook that made it, so two hooks on one matcher are two
 * different commands. Publishing a table again replaces `hooks/hooks.json`
 * and the scripts it writes.
 */

import { randomUUID } from "node:crypto";
import { chmod, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { HOOK_RECORDER_PATH } from "./hook-recorder.ts";
import { writePublishedPluginFiles } from "./published-marketplace.ts";
import { harnessDirectory, readPidFiles } from "./turn-records.ts";

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
  readonly whenOldString?: string;
  readonly whenLastMessage?: string;
  readonly matchedOutput?: string;
  readonly outputBytes?: number;
  readonly trailingOutput?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly sleep?: number;
  readonly meets?: string;
  readonly onReentry?: "allow";
  readonly timeout?: number;
  readonly if?: string;
  readonly onFailure?: "block" | "continue";
  readonly once?: boolean;
  readonly async?: boolean;
  readonly asyncRewake?: boolean;
  readonly rewakeMessage?: string;
  readonly rewakeSummary?: string;
  readonly waits?: true;
  readonly sigterm?: "ignore";
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
  "when old string": "whenOldString",
  "when last message": "whenLastMessage",
  "matched output": "matchedOutput",
  "output bytes": "outputBytes",
  "trailing output": "trailingOutput",
  stderr: "stderr",
  "exit code": "exitCode",
  sleep: "sleep",
  meets: "meets",
  "on reentry": "onReentry",
  waits: "waits",
  sigterm: "sigterm",
} as const satisfies Record<string, keyof RecordingHook>;

// The directory, in the plugin, of every hook script.
const SCRIPT_DIRECTORY = "hooks";

// How long `meets` waits for the other hook, in tenths of a second.
const MEETING_TENTHS = 30;

// How long `waits` waits for its release, in tenths of a second.
const RELEASE_TENTHS = 600;

// The variable, in a Pi's environment, that holds the id of the Pi's hook
// gate, which every hook of that Pi inherits (D-BG-12).
const HOOK_GATE_VARIABLE = "PI_CM_HOOK_GATE";

// The file whose presence opens the hook gate `id`.
function gateFile(harness: string, id: string): string {
  return path.join(harness, `hook-gate-${id}`);
}

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

function parseByteCount(cell: string): number {
  if (!/^\d+$/u.test(cell)) {
    throw new Error(`a hook's output bytes is a whole number: ${cell}`);
  }

  return Number(cell);
}

function parseSeconds(cell: string, what: string): number {
  if (!/^\d+(?:\.\d+)?$/u.test(cell)) {
    throw new Error(`a hook's ${what} is a number of seconds: ${cell}`);
  }

  return Number(cell);
}

function parseBoolean(cell: string, what: string): boolean {
  return oneOf(cell, ["true", "false"], `a hook's ${what}`) === "true";
}

// Each optional column, and the fields its cell sets.
const COLUMN_PARSERS: Readonly<Record<string, (cell: string) => Partial<RecordingHook>>> = {
  form: (cell) => ({ form: oneOf(cell, FORMS, "a hook form") }),
  arguments: (cell) => ({ arguments: parseArguments(cell) }),
  output: (cell) => ({ output: cell }),
  "when old string": (cell) => ({ whenOldString: cell }),
  "when last message": (cell) => ({ whenLastMessage: cell }),
  "matched output": (cell) => ({ matchedOutput: cell }),
  "output bytes": (cell) => ({ outputBytes: parseByteCount(cell) }),
  "trailing output": (cell) => ({ trailingOutput: cell }),
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
  once: (cell) => ({ once: parseBoolean(cell, "once") }),
  async: (cell) => ({ async: parseBoolean(cell, "async") }),
  "async rewake": (cell) => ({ asyncRewake: parseBoolean(cell, "async rewake") }),
  "rewake message": (cell) => ({ rewakeMessage: cell }),
  "rewake summary": (cell) => ({ rewakeSummary: cell }),
  waits: (cell) => {
    oneOf(cell, ["true"], "a hook's waits");
    return { waits: true };
  },
  sigterm: (cell) => ({ sigterm: oneOf(cell, ["ignore"], "a hook's sigterm") }),
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

// The pid file of a lifecycle hook's script: `hook-<name>-<pid>.pid`.
const HOOK_PID_FILE = /^hook-[a-z0-9-]+-\d+\.pid$/u;

// Whether `hook`'s script logs its lifecycle and keeps a pid file (D-BG-12).
function isLifecycleHook(hook: RecordingHook): boolean {
  return (
    writesScript(hook) &&
    (hook.async !== undefined || hook.asyncRewake !== undefined || hook.waits !== undefined)
  );
}

// The lines that write the script's pid file before it does anything else,
// with an EXIT trap that removes the file. Before and after the write, the
// script exits 0 when the hook gate of its Pi is closed. The release closes
// the gate before it reads the pid files, so either the release finds this
// pid file, or the second check finds the gate closed.
function registrationLines(name: string): string[] {
  const harness = harnessDirectory("$HOME");
  const gate = gateFile(harness, `$${HOOK_GATE_VARIABLE}`);
  const exitWhenClosed = '[ -e "$gate" ] || exit 0';
  return [
    `gate="${gate}"`,
    exitWhenClosed,
    `pidfile="${harness}/hook-${name}-$$.pid"`,
    String.raw`printf '%s\n' "$$" > "$pidfile.tmp"`,
    'mv "$pidfile.tmp" "$pidfile"',
    `trap 'rm -f "$pidfile"' EXIT`,
    exitWhenClosed,
  ];
}

// The lines that log the script's start once it has recorded. The EXIT trap
// they set logs its end with the code it exits with, then removes the pid
// file; the code the script exits with stays the trap's `$?`.
function startLines(name: string): string[] {
  const recorder = `"${process.execPath}" "${HOOK_RECORDER_PATH}" --lifecycle`;
  return [
    `trap '${recorder} end ${name} $$ $?; rm -f "$pidfile"' EXIT`,
    `${recorder} start ${name} $$`,
  ];
}

// The lines that wait for `$HOME/hook-releases/<name>`, or give up, and
// then take the marker, so it frees this run alone.
function releaseLines(name: string): string[] {
  return [
    `release="$HOME/hook-releases/${name}"`,
    "waited=0",
    `while [ ! -e "$release" ] && [ "$waited" -lt ${RELEASE_TENTHS} ]; do`,
    "  sleep 0.1",
    "  waited=$((waited + 1))",
    "done",
    'rm -f "$release"',
  ];
}

// The variables that make the recorder choose between `matched output` and
// `output`, one for each condition the row sets.
function conditions(hook: RecordingHook): string[] {
  return [
    ...(hook.whenOldString === undefined
      ? []
      : [`HOOK_WHEN_OLD_STRING=${shellQuoted(hook.whenOldString)}`]),
    ...(hook.whenLastMessage === undefined
      ? []
      : [`HOOK_WHEN_LAST_MESSAGE=${shellQuoted(hook.whenLastMessage)}`]),
  ];
}

// The lines a script runs after it records.
function afterRecording(hook: RecordingHook): string[] {
  return [
    ...(hook.onReentry === "allow"
      ? [`case "$stdin" in *'"stop_hook_active":true'*) exit 0 ;; esac`]
      : []),
    ...(hook.stderr === undefined ? [] : [`printf '%s' ${shellQuoted(hook.stderr)} >&2`]),
    ...(hook.output === undefined || conditions(hook).length > 0
      ? []
      : [`printf '%s' ${shellQuoted(hook.output)}`]),
    ...(hook.outputBytes === undefined
      ? []
      : [String.raw`head -c ${hook.outputBytes} /dev/zero | tr '\0' x`]),
    ...(hook.trailingOutput === undefined
      ? []
      : [`printf '%s' ${shellQuoted(hook.trailingOutput)}`]),
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
  const set = conditions(hook);
  const conditional =
    set.length === 0
      ? ""
      : `${set.join(" ")} HOOK_MATCHED_OUTPUT=${shellQuoted(hook.matchedOutput ?? "")} HOOK_DEFAULT_OUTPUT=${shellQuoted(hook.output ?? "")} `;
  const recorder = `${conditional}"${process.execPath}" "${HOOK_RECORDER_PATH}" ${hook.name}${marker} "$@"`;
  const lifecycle = isLifecycleHook(hook);
  return `${[
    "#!/bin/sh",
    // An ignored signal stays ignored in every command the script runs.
    ...(hook.sigterm === "ignore" ? ["trap '' TERM"] : []),
    ...(lifecycle ? registrationLines(hook.name) : []),
    "stdin=$(cat)",
    ...meeting,
    `printf '%s' "$stdin" | ${recorder}`,
    ...(lifecycle ? startLines(hook.name) : []),
    ...(hook.waits === undefined ? [] : releaseLines(hook.name)),
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
    ...(hook.async === undefined ? {} : { async: hook.async }),
    ...(hook.asyncRewake === undefined ? {} : { asyncRewake: hook.asyncRewake }),
    ...(hook.rewakeMessage === undefined ? {} : { rewakeMessage: hook.rewakeMessage }),
    ...(hook.rewakeSummary === undefined ? {} : { rewakeSummary: hook.rewakeSummary }),
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

/**
 * Returns the pid that each lifecycle hook's pid file in `harness` holds, in
 * file name order. A script that exited removed its file, and one that was
 * killed left it behind (D-BG-12).
 */
export async function readHookScriptPids(harness: string): Promise<readonly number[]> {
  const files = await readPidFiles(harness, (name) => HOOK_PID_FILE.test(name));
  return files.map(({ pid }) => pid);
}

/** A hook gate that `openHookGate()` opened in a harness directory (D-BG-12). */
export interface HookGate {
  readonly id: string;
  /** The variable that a Pi's environment needs so that its lifecycle hook scripts run. */
  readonly environment: { readonly [HOOK_GATE_VARIABLE]: string };
}

interface RegisteredHookProcess {
  readonly pid: number;
  readonly dispatchId: string;
}

async function registeredHookProcesses(scopeRoot: string): Promise<RegisteredHookProcess[]> {
  const table = path.join(
    scopeRoot,
    "pi-claude-marketplace",
    "data",
    "_shared",
    "async-rewake-pids.json",
  );
  let raw: string;
  try {
    raw = await readFile(table, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const tableValue: unknown = JSON.parse(raw);
  if (
    typeof tableValue !== "object" ||
    tableValue === null ||
    !("version" in tableValue) ||
    tableValue.version !== 1 ||
    !("entries" in tableValue) ||
    !Array.isArray(tableValue.entries)
  ) {
    throw new Error(`invalid hook PID table: ${table}`);
  }

  const entries: unknown[] = tableValue.entries;
  return entries.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("pid" in entry) ||
      typeof entry.pid !== "number" ||
      !Number.isSafeInteger(entry.pid) ||
      entry.pid < 2 ||
      !("dispatchId" in entry) ||
      typeof entry.dispatchId !== "string"
    ) {
      throw new Error(`invalid hook PID table entry: ${table}`);
    }

    return { pid: entry.pid, dispatchId: entry.dispatchId };
  });
}

function errorCode(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

// Whether the environment of `pid` holds the dispatch marker of `entry`.
// Throws when /proc cannot read it.
async function carriesMarker(pid: number, entry: RegisteredHookProcess): Promise<boolean> {
  const environ = await readFile(`/proc/${pid}/environ`, "utf8");
  return environ.split("\0").includes(`PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=${entry.dispatchId}`);
}

// The process group of `pid` from /proc/<pid>/stat, or nothing when the
// process is gone. Any other read error throws. The command name in
// parentheses may hold spaces, so the fields are read after its closing
// parenthesis: state, ppid, pgrp.
async function processGroupOf(pid: number): Promise<number | undefined> {
  let stat: string;
  try {
    stat = await readFile(`/proc/${pid}/stat`, "utf8");
  } catch (error: unknown) {
    const code = errorCode(error);
    if (code === "ENOENT" || code === "ESRCH") {
      return undefined;
    }

    throw error;
  }

  return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
}

// Whether a member of the process group `entry.pid` carries the dispatch
// marker. A member that exited (ENOENT, ESRCH), or whose environment /proc
// does not show (EACCES), does not count. Any other read error throws, so a
// failed scan never skips the kill without a word.
async function groupHoldsMarker(entry: RegisteredHookProcess): Promise<boolean> {
  const pids = (await readdir("/proc")).filter((name) => /^\d+$/.test(name)).map(Number);
  const marked = await Promise.all(
    pids.map(async (pid) => {
      if (pid === entry.pid || (await processGroupOf(pid)) !== entry.pid) {
        return false;
      }

      return carriesMarker(pid, entry).catch((error: unknown) => {
        const code = errorCode(error);
        if (code === "ENOENT" || code === "ESRCH" || code === "EACCES") {
          return false;
        }

        throw error;
      });
    }),
  );
  return marked.includes(true);
}

// Which process of `entry` carries its dispatch marker: the leader itself, a
// member of its group once the leader exited, or none.
type RegisteredHookMatch = "leader" | "group" | "none";

async function registeredHookMatch(entry: RegisteredHookProcess): Promise<RegisteredHookMatch> {
  if (process.platform !== "linux") {
    return "leader";
  }

  try {
    return (await carriesMarker(entry.pid, entry)) ? "leader" : "none";
  } catch (error: unknown) {
    // A leader that exited fails the read: with ESRCH while it is not yet
    // reaped and keeps its /proc entry, with ENOENT once it is reaped. Its
    // group can outlive it, because a child the hook started stays in the
    // group with the marker. While a member lives, no new process or group
    // can take the group ID, so a marked member makes the group the hook's.
    const code = errorCode(error);
    if (code === "ESRCH" || code === "ENOENT") {
      return (await groupHoldsMarker(entry)) ? "group" : "none";
    }

    throw error;
  }
}

// Sends SIGKILL to `target`. An ESRCH means the target already exited.
function killIfPresent(target: number): boolean {
  try {
    process.kill(target, "SIGKILL");
    return true;
  } catch (error: unknown) {
    if (errorCode(error) === "ESRCH") {
      return false;
    }

    throw error;
  }
}

// Kills the group of `entry`. When the leader itself carries the marker and
// leads no group, the leader alone is killed. A group found through a member
// gets no such fallback: its leader already exited, so `entry.pid` could
// only name a process that reused the PID.
async function stopRegisteredHookProcess(entry: RegisteredHookProcess): Promise<void> {
  const match = await registeredHookMatch(entry);
  if (match === "none") {
    return;
  }

  if (!killIfPresent(-entry.pid) && match === "leader") {
    killIfPresent(entry.pid);
  }
}

/**
 * Opens a new hook gate in `harness`. Only a Pi whose release passes the gate
 * to `stopHookScripts()` after the Pi stops may get its environment. The gate
 * stays open until then, or until the next scenario's `Before()` empties the
 * sandbox.
 */
export async function openHookGate(harness: string): Promise<HookGate> {
  const id = randomUUID();
  await writeFile(gateFile(harness, id), "", { flag: "wx" });
  return { id, environment: { [HOOK_GATE_VARIABLE]: id } };
}

/**
 * Closes `gate`, so that a lifecycle hook script of a Pi with that gate that
 * starts or has not yet written its pid file exits at once. Closing a closed
 * gate does nothing (D-BG-12).
 */
export async function closeHookGate(harness: string, gate: HookGate): Promise<void> {
  await rm(gateFile(harness, gate.id), { force: true });
}

/**
 * Closes `gate`, stops the hook groups that the bridge's PID table in each of
 * `scopeRoots` registers, then SIGKILLs each lifecycle hook script that a pid
 * file in `harness` names and that still runs. Call it once the Pi of the
 * gate has stopped. Pi starts each hook as the leader of a process group of
 * its own, so stopping a Pi and its group leaves the hook running. A
 * scenario's release stops what the scenario left, so that a waiting script
 * cannot take the release marker of a later scenario. The registry's table
 * covers a child that started before its script wrote its pid file, and a
 * script of that Pi that had not written its pid file when the release read
 * them finds the gate closed and exits, so none outlives the release. Closing
 * a closed gate does nothing.
 */
export async function stopHookScripts(
  harness: string,
  gate: HookGate,
  scopeRoots: readonly string[],
): Promise<void> {
  await closeHookGate(harness, gate);
  for (const scopeRoot of scopeRoots) {
    for (const entry of await registeredHookProcesses(scopeRoot)) {
      await stopRegisteredHookProcess(entry);
    }
  }

  for (const pid of await readHookScriptPids(harness)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The script has already exited.
    }
  }
}

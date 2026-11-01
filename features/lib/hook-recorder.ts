/**
 * @fileoverview The hook recorder: a command a plugin hook runs, which records
 * what the hook received (HAR-04, D-CF1-17).
 *
 * A hook runs a command in a process of its own, so the recorder cannot be a
 * function the steps call. This module is both sides: the fixture writer
 * imports `HOOK_RECORDER_PATH` to write a hook command that runs Node on this
 * file, and run as that command, the module appends one JSON line per run to
 * `<harness dir>/hook-runs.jsonl` and exits 0 with no output, so the hook
 * allows what it was asked about. The line holds the hook event, the whole
 * parsed stdin, the arguments after this file, and every `CLAUDE_*` variable
 * of the environment, plus `CLAUDECODE`, which Claude Code sets beside them.
 * The recorder never filters or merges runs: two hook processes write two
 * lines, in the order they append them.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { harnessDirectory } from "./turn-records.ts";

/** The absolute path of this file, which a recording hook's command runs. */
export const HOOK_RECORDER_PATH = fileURLToPath(import.meta.url);

/** The name of the log, in the harness directory, that holds one line per hook run. */
export const HOOK_RUNS_LOG = "hook-runs.jsonl";

/** One line of the hook runs log: what one hook process received. */
export interface HookRun {
  /** The `hook_event_name` of the stdin. */
  readonly event: string;
  /** The whole stdin, parsed as JSON. */
  readonly stdin: Readonly<Record<string, unknown>>;
  /** The arguments of the command after the recorder's path. */
  readonly arguments: readonly string[];
  /** Every `CLAUDE_*` variable of the environment, and `CLAUDECODE`, by name. */
  readonly environment: Readonly<Record<string, string>>;
}

// T-01-31: only Claude's own variables, never the rest of the environment.
function isClaudeVariable(name: string): boolean {
  return name.startsWith("CLAUDE_") || name === "CLAUDECODE";
}

function claudeEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment)
      .filter(
        (entry): entry is [string, string] => isClaudeVariable(entry[0]) && entry[1] !== undefined,
      )
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function readStdin(): Record<string, unknown> {
  const stdin: unknown = JSON.parse(readFileSync(0, "utf8"));
  if (typeof stdin !== "object" || stdin === null || Array.isArray(stdin)) {
    throw new Error(`the hook stdin is not a JSON object: ${JSON.stringify(stdin)}`);
  }

  return stdin as Record<string, unknown>;
}

function recordRun(): void {
  const home = process.env.HOME;
  if (home === undefined) {
    throw new Error("the hook process has no HOME");
  }

  const stdin = readStdin();
  const run: HookRun = {
    event: String(stdin.hook_event_name),
    stdin,
    arguments: process.argv.slice(2),
    environment: claudeEnvironment(process.env),
  };
  const directory = harnessDirectory(home);
  mkdirSync(directory, { recursive: true });
  // One write per run, so two hook processes never split each other's line.
  appendFileSync(path.join(directory, HOOK_RUNS_LOG), `${JSON.stringify(run)}\n`);
}

if (process.argv[1] === HOOK_RECORDER_PATH) {
  recordRun();
}

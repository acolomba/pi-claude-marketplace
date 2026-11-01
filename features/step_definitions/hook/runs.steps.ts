/**
 * @fileoverview Steps about the runs of plugin hooks: the hooks a published
 * plugin declares, each recording its runs, and what each run received.
 *
 * Every hook the steps declare runs the hook recorder, which appends one line
 * per hook process to the harness log `hook-runs.jsonl` (HAR-04). The runs
 * step states the runs of the last model turn whole, one row per run in the
 * order the processes appended them. A session id differs on every run, so a
 * cell that holds one names the session by the order it first appears in.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { fieldRecord, recordTable } from "../../lib/field-rows.ts";
import {
  parseRecordingHooks,
  publishRecordingHooks,
  recordingHooksText,
} from "../../lib/hook-files.ts";
import { HOOK_RUNS_LOG } from "../../lib/hook-recorder.ts";
import { projectTokens } from "../../lib/run-tokens.ts";

import type { HookRun } from "../../lib/hook-recorder.ts";
import type { RunTokens } from "../../lib/run-tokens.ts";
import type { ScenarioWorld } from "../../support/world.ts";

const SESSION_ORDINALS: readonly string[] = ["first", "second", "third", "fourth"];

// The column of each stdin field: its words, with the two the table names
// differently. Any other field reads as its words, so it shows up as a
// column the table leaves out.
const STDIN_COLUMNS: Readonly<Record<string, string>> = {
  hook_event_name: "event",
  session_id: "session",
};

// Names each session id by the order it first appears in, across the runs.
function sessionOrdinals(runs: readonly HookRun[]): Map<string, string> {
  const ordinals = new Map<string, string>();
  for (const run of runs) {
    const session = run.stdin.session_id;
    if (typeof session === "string" && !ordinals.has(session)) {
      const ordinal = SESSION_ORDINALS[ordinals.size];
      assert.ok(ordinal !== undefined, `more sessions than ${SESSION_ORDINALS.length}`);
      ordinals.set(session, ordinal);
    }
  }

  return ordinals;
}

// A string is projected to the run tokens, and a cell that is a session id
// becomes its ordinal. Any other value is its JSON text.
function cell(value: unknown, tokens: RunTokens, ordinals: ReadonlyMap<string, string>): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return ordinals.get(text) ?? projectTokens("text", text, tokens);
}

function runRecord(
  run: HookRun,
  tokens: RunTokens,
  ordinals: ReadonlyMap<string, string>,
): Map<string, string> {
  assert.strictEqual(run.event, run.stdin.hook_event_name, "the recorded event is the stdin's");
  return fieldRecord([
    ...Object.entries(run.stdin).map(
      ([key, value]) =>
        [STDIN_COLUMNS[key] ?? key.replaceAll("_", " "), cell(value, tokens, ordinals)] as const,
    ),
    ["arguments", run.arguments.join(" ")],
    ...Object.entries(run.environment).map(
      ([name, value]) => [name, cell(value, tokens, ordinals)] as const,
    ),
  ]);
}

Given(
  "the published plugin {string} of the marketplace {string} has these hooks, each recording its runs:",
  async function (this: ScenarioWorld, plugin: string, name: string, table: DataTable) {
    const hooks = parseRecordingHooks(table.raw());
    const file = await publishRecordingHooks(this.requirePublished(name), plugin, hooks);
    assert.strictEqual(await readFile(file, "utf8"), recordingHooksText(hooks));
  },
);

Then("the hooks record these runs:", function (this: ScenarioWorld, table: DataTable) {
  const runs = (this.requireTurn().logs.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
  const ordinals = sessionOrdinals(runs);
  const records = runs.map((run) => runRecord(run, this.tokens, ordinals));
  const [stated = []] = table.raw();
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
  this.markTurnCompared();
});

/**
 * @fileoverview Steps about prompts whose turn goes on past its first model
 * reply: a prompt whose turn the Stop hooks continue, recorded with the turn
 * they start, and a prompt the user steers while its tool runs.
 *
 * Pi runs the extension `agent_settled` handlers, the Stop hooks among them,
 * before it reports `agent_settled`, and it starts the turn a Stop hook asks
 * for only after that report (STOP-03). So the model-turn `When` ends before
 * the re-entered turn runs. The `When` here waits for the second
 * `agent_settled` instead, and keeps every record and stand-in log line of
 * both turns as the last turn (HAR-03).
 *
 * A steer or a follow-up is a prompt the user sends while the agent runs. Pi
 * queues it into the running agent, which reads a steer after the running
 * tool returns and a follow-up only when it would otherwise stop. So the
 * step waits for the tool to start, queues the prompt, and keeps the whole
 * run as the last turn.
 *
 * An async rewake hook runs in the background, so its prompt's turn settles
 * while the hook's script still waits for its release (D-BG-12). The
 * background `When` waits for both the settle and the hook's start line in
 * the lifecycle log, in either order, asserts that the hook has not ended,
 * and keeps the run as the last turn. Its `Given` form keeps no turn.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import {
  HOOK_LIFECYCLE_LOG,
  HOOK_RUNS_LOG,
  waitForHookLifecycle,
} from "../../lib/hook-recorder.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { callMessageRows, modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { HookLifecycleEvent, HookRun } from "../../lib/hook-recorder.ts";
import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ModelTurn, ScenarioWorld } from "../../support/world.ts";

// Two scripted turns settle in well under a second each; the margin covers a
// loaded CI runner and stays below the 30-second step timeout, so a turn the
// Stop hooks never send back fails here.
const REENTERED_TURNS_DEADLINE_MS = 20_000;

// A scripted turn settles, and an async hook's script starts, in well under a
// second; the margin covers a loaded CI runner and stays below the 30-second
// step timeout, so a turn that never settles or a hook that never starts
// fails here.
const BACKGROUND_HOOK_DEADLINE_MS = 20_000;

const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

// An extension error or a dialog during the two turns is never expected.
function isFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" && DIALOG_METHODS.has(String(record.method)))
  );
}

function isSettled(record: RpcRecord): boolean {
  return record.type === "agent_settled";
}

function isToolStart(record: RpcRecord): boolean {
  return record.type === "tool_execution_start";
}

// Waits for the next `agent_settled` at or after `from`, within the time left
// before `deadline`, asserts that its turn was not aborted, and returns the
// index after it.
async function settledAfter(world: ScenarioWorld, from: number, deadline: number): Promise<number> {
  const settled = await world.pi.waitForRecord(from, isSettled, deadline - Date.now());
  assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
  return from + world.pi.recordsSince(from).indexOf(settled) + 1;
}

// Sends `prompt` and asserts that Pi started a turn for it. Returns the log
// lengths and the record count from before the prompt, so the turn keeps
// only what the prompt added.
async function startPrompt(
  world: ScenarioWorld,
  prompt: string,
): Promise<{ readonly lengths: ReadonlyMap<string, number>; readonly from: number }> {
  const lengths = await readLogLengths(world.profileHarness());
  const from = world.pi.recordCount();
  const { response } = await world.pi.request({ type: "prompt", message: prompt });
  assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
  return { lengths, from };
}

// The model calls past the end of the script, by number.
function callsPastScript(logs: ReadonlyMap<string, readonly unknown[]>): string[] {
  return modelCallsOf(logs)
    .filter((call) => call.overflow)
    .map((call) => `call ${call.index + 1}`);
}

// Asserts that the run since `from` had no fault and no model call past the
// script, and returns its records and the log lines since `lengths` as the
// turn of `prompt`.
async function checkedRun(
  world: ScenarioWorld,
  prompt: string,
  lengths: ReadonlyMap<string, number>,
  from: number,
): Promise<ModelTurn> {
  const records = world.pi.recordsSince(from);
  assert.deepStrictEqual(records.filter(isFault), []);
  const logs = await readLogLinesSince(world.profileHarness(), lengths);
  assert.deepStrictEqual(callsPastScript(logs), [], "the model was called past its script");
  return { prompt, disposition: "started", records, logs };
}

// Keeps the checked run since `from` as the last turn of `prompt`.
async function recordRun(
  world: ScenarioWorld,
  prompt: string,
  lengths: ReadonlyMap<string, number>,
  from: number,
): Promise<void> {
  world.recordTurn(await checkedRun(world, prompt, lengths, from));
}

// Sends `text`, waits for its turn to settle and for `hook` to log its start,
// in either order, and asserts that the hook has not ended. Returns the turn,
// after the checks `recordRun` makes.
async function promptPastBackgroundHook(
  world: ScenarioWorld,
  text: string,
  hook: string,
): Promise<ModelTurn> {
  const deadline = Date.now() + BACKGROUND_HOOK_DEADLINE_MS;
  const harness = world.profileHarness();
  const prompt = expandTokens(text, world.tokens);
  const { lengths, from } = await startPrompt(world, prompt);
  await Promise.all([
    settledAfter(world, from, deadline),
    waitForHookLifecycle(harness, hook, "start", lengths, deadline - Date.now()),
  ]);
  const turn = await checkedRun(world, prompt, lengths, from);
  const lifecycle = (turn.logs.get(HOOK_LIFECYCLE_LOG) ?? []) as readonly HookLifecycleEvent[];
  const ended = lifecycle.filter((event) => event.hook === hook && event.phase === "end");
  assert.deepStrictEqual(ended, [], `the hook ${hook} ended before its release`);
  return turn;
}

Given(
  "the user has prompted {string} and the hook {string} goes on in the background",
  async function (this: ScenarioWorld, text: string, hook: string) {
    await promptPastBackgroundHook(this, text, hook);
  },
);

When(
  "the user prompts {string} and the hook {string} goes on in the background",
  async function (this: ScenarioWorld, text: string, hook: string) {
    this.recordTurn(await promptPastBackgroundHook(this, text, hook));
  },
);

When(
  "the user prompts {string} and the stop hooks send the turn back",
  async function (this: ScenarioWorld, text: string) {
    const deadline = Date.now() + REENTERED_TURNS_DEADLINE_MS;
    const prompt = expandTokens(text, this.tokens);
    const { lengths, from } = await startPrompt(this, prompt);
    await settledAfter(this, await settledAfter(this, from, deadline), deadline);
    await recordRun(this, prompt, lengths, from);
  },
);

When(
  "the user prompts {string} through {int} stop settlements",
  { timeout: 120_000 },
  async function (this: ScenarioWorld, text: string, settlements: number) {
    const deadline = Date.now() + 110_000;
    const prompt = expandTokens(text, this.tokens);
    const { lengths, from } = await startPrompt(this, prompt);
    let next = from;

    for (let index = 0; index < settlements; index += 1) {
      next = await settledAfter(this, next, deadline);
    }

    await recordRun(this, prompt, lengths, from);
  },
);

Then(
  "the stop sequence has these exact replies and hook states:",
  function (this: ScenarioWorld, table: DataTable) {
    const [header, ...rows] = table.raw();
    assert.deepStrictEqual(header, ["reply", "stop hook active"]);
    const turn = this.requireTurn();
    const runs = (turn.logs.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
    assert.deepStrictEqual(
      runs.map((run) => [run.event, run.stdin.last_assistant_message, run.stdin.stop_hook_active]),
      rows.map(([reply, active]) => ["Stop", reply, active === "true"]),
    );
    const calls = modelCallsOf(turn.logs);
    assert.deepStrictEqual(
      calls.map((call) => [call.index + 1, call.overflow]),
      rows.map((_, index) => [index + 1, false]),
    );
    const expected: [string, string, string][] = [];

    for (const [index, [reply]] of rows.entries()) {
      const call = String(index + 1);
      expected.push([call, "user", turn.prompt]);

      for (const [prior] of rows.slice(0, index)) {
        assert.ok(prior !== undefined);
        expected.push([call, "assistant", prior]);
        expected.push([call, "user", "Stop hook feedback:\nkeep going"]);
      }

      assert.ok(reply !== undefined);
    }

    assert.deepStrictEqual(callMessageRows(calls), expected);
    this.markTurnCompared();
  },
);

Then("the stop override cap shows one notice", function (this: ScenarioWorld) {
  const notices = this.requireTurn().records.flatMap((record) => {
    const entry: unknown = record.entry;
    if (record.type !== "entry_appended" || typeof entry !== "object" || entry === null) {
      return [];
    }

    if (!("customType" in entry) || entry.customType !== "claude-plugin") {
      return [];
    }

    const payload: unknown = "data" in entry ? entry.data : undefined;
    return typeof payload === "object" &&
      payload !== null &&
      "kind" in payload &&
      payload.kind === "stop-override-cap"
      ? [payload]
      : [];
  });
  assert.deepStrictEqual(notices, [
    {
      schemaVersion: 1,
      origin: { kind: "hook" },
      kind: "stop-override-cap",
      severity: "warning",
      needsReload: false,
      pluginId: "demo",
      cap: 8,
    },
  ]);
  this.markTurnCompared();
});

// Sends `prompt`, waits for its tool to start, and queues `queuedText` into
// the running agent as `behavior`. Keeps the whole run as the last turn.
async function promptAndQueue(
  world: ScenarioWorld,
  text: string,
  queuedText: string,
  behavior: "steer" | "followUp",
): Promise<void> {
  const deadline = Date.now() + REENTERED_TURNS_DEADLINE_MS;
  const prompt = expandTokens(text, world.tokens);
  const { lengths, from } = await startPrompt(world, prompt);
  await world.pi.waitForRecord(from, isToolStart, deadline - Date.now());
  const queued = await world.pi.request({
    type: "prompt",
    message: expandTokens(queuedText, world.tokens),
    streamingBehavior: behavior,
  });
  assert.strictEqual(promptDisposition(queued.response), "queued", JSON.stringify(queued.response));
  await settledAfter(world, from, deadline);
  await recordRun(world, prompt, lengths, from);
}

When(
  "the user prompts {string} and steers with {string} while the tool runs",
  async function (this: ScenarioWorld, text: string, steerText: string) {
    await promptAndQueue(this, text, steerText, "steer");
  },
);

When(
  "the user prompts {string} and follows up with {string} while the tool runs",
  async function (this: ScenarioWorld, text: string, followUpText: string) {
    await promptAndQueue(this, text, followUpText, "followUp");
  },
);

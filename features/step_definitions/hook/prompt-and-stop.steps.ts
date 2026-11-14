/**
 * @fileoverview Steps about prompts whose turn goes on past its first model
 * reply: a prompt whose turn the Stop hooks continue, recorded with the turn
 * they start, and a prompt the user steers while its tool runs.
 *
 * The Stop hooks run in Pi's `agent_before_settle` handlers, and a Stop hook
 * that blocks or adds context continues the same run with one more model
 * call (D-PG5-01). So a prompt whose Stop hooks continue it settles once,
 * after the last model call. The continuation `When` waits for that one
 * `agent_settled` with a deadline long enough for nine model calls, and
 * keeps every record and stand-in log line of the run as the last turn
 * (HAR-03).
 *
 * The other-extension `Given` starts the profile Pi with a harness extension
 * loaded before the real one, which continues the first run end with a hidden
 * `go on` message, so the Stop hooks of that end run after a handler that
 * already continued the run (D-PG5-05).
 *
 * The run-start `Given` starts the profile Pi with a harness extension that
 * logs each `before_agent_start`, and the counts `Then` states the turn's
 * settlements, run starts, and model calls. Pi raises `agent_start` for each
 * continuation of a run as well, so the step counts run starts from that log
 * and never from `agent_start` records.
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
import { BOUNDARY_CONTINUER_EXTENSION } from "../../lib/boundary-continuer.ts";
import {
  HOOK_LIFECYCLE_LOG,
  HOOK_RUNS_LOG,
  waitForHookLifecycle,
} from "../../lib/hook-recorder.ts";
import { RUN_START_PROBE_EXTENSION, RUN_STARTS_LOG } from "../../lib/run-start-probe.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { callMessageRows, modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { HookLifecycleEvent, HookRun } from "../../lib/hook-recorder.ts";
import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ModelCall } from "../../lib/scripted-model/script.ts";
import type { ModelTurn, ScenarioWorld } from "../../support/world.ts";

// A scripted run with a queued prompt settles in well under a second; the
// margin covers a loaded CI runner and stays below the 30-second step
// timeout, so a run that never settles fails here.
const REENTERED_TURNS_DEADLINE_MS = 20_000;

// A run that the Stop hooks continue up to nine times, with a tool call
// between some of the model calls, settles in a few seconds; the margin
// covers a loaded CI runner and stays below the step's 120-second timeout.
const STOP_CONTINUATION_DEADLINE_MS = 110_000;

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

function stopRunRows(turn: ModelTurn): (readonly [string, unknown, unknown])[] {
  const runs = (turn.logs.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
  return runs.map((run) => [
    run.event,
    run.stdin.last_assistant_message,
    run.stdin.stop_hook_active,
  ]);
}

function assertStopRuns(turn: ModelTurn, expected: readonly (readonly [string, boolean])[]): void {
  assert.deepStrictEqual(
    stopRunRows(turn),
    expected.map(([reply, active]) => ["Stop", reply, active]),
  );
}

function modelCallsWithCount(turn: ModelTurn, count: number): ModelCall[] {
  const calls = modelCallsOf(turn.logs);
  assert.deepStrictEqual(
    calls.map((call) => [call.index + 1, call.overflow]),
    Array.from({ length: count }, (_, index) => [index + 1, false]),
  );
  return calls;
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
  "pi runs with the scripted model and counts its run starts",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({ companions: [], extraExtensions: [RUN_START_PROBE_EXTENSION] });
  },
);

Given(
  "pi runs with the scripted model and another extension, loaded first, that continues the run once",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({
      companions: [],
      leadingExtensions: [BOUNDARY_CONTINUER_EXTENSION],
    });
  },
);

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
  "the user prompts {string} and the stop hooks continue the run",
  { timeout: 120_000 },
  async function (this: ScenarioWorld, text: string) {
    const deadline = Date.now() + STOP_CONTINUATION_DEADLINE_MS;
    const prompt = expandTokens(text, this.tokens);
    const { lengths, from } = await startPrompt(this, prompt);
    await settledAfter(this, from, deadline);
    await recordRun(this, prompt, lengths, from);
  },
);

Then(
  "the stop sequence has these exact replies and hook states:",
  function (this: ScenarioWorld, table: DataTable) {
    const [header, ...rows] = table.raw();
    assert.deepStrictEqual(header, ["reply", "stop hook active"]);
    const turn = this.requireTurn();
    assertStopRuns(
      turn,
      rows.map(([reply, active]) => [reply ?? "", active === "true"]),
    );
    const calls = modelCallsWithCount(turn, rows.length);
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

Then("the stop sequence has these counts:", function (this: ScenarioWorld, table: DataTable) {
  const turn = this.requireTurn();
  assert.deepStrictEqual(
    [
      ["agent settlements", "run starts", "model calls"],
      [
        String(turn.records.filter(isSettled).length),
        String((turn.logs.get(RUN_STARTS_LOG) ?? []).length),
        String(modelCallsOf(turn.logs).length),
      ],
    ],
    table.raw(),
  );
  this.markTurnCompared();
});

Then("the stop override cap notice count is {int}", function (this: ScenarioWorld, count: number) {
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
  assert.deepStrictEqual(
    notices,
    Array.from({ length: count }, () => ({
      schemaVersion: 1,
      origin: { kind: "hook" },
      kind: "stop-override-cap",
      severity: "warning",
      needsReload: false,
      pluginId: "demo",
      cap: 8,
    })),
  );
  this.markTurnCompared();
});

Then("ten stop blocks separated by tool calls continue", function (this: ScenarioWorld) {
  const turn = this.requireTurn();
  const calls = modelCallsWithCount(turn, 21);

  assertStopRuns(
    turn,
    Array.from({ length: 10 }, (_, index) => [`Done ${index + 1}`, index > 0]),
  );
  assert.strictEqual(turn.records.filter(isSettled).length, 1);
  for (let index = 0; index < 10; index += 1) {
    const reentryCall = calls[2 * index + 1];
    const afterToolCall = calls[2 * index + 2];
    assert.ok(reentryCall !== undefined);
    assert.ok(afterToolCall !== undefined);
    const reentry = callMessageRows([reentryCall]);
    const afterTool = callMessageRows([afterToolCall]);
    assert.deepStrictEqual(reentry.at(-1), [
      String(2 * index + 2),
      "user",
      "Stop hook feedback:\nkeep going",
    ]);
    assert.deepStrictEqual(afterTool.slice(-2), [
      [String(2 * index + 3), "assistant", 'tool call bash {"command":"echo from-model"}'],
      [String(2 * index + 3), "tool result", "bash returned: from-model\n"],
    ]);
  }

  this.markTurnCompared();
});

When(
  "the user prompts {string} until {string}, reloads pi, and prompts {string} through the stop limit",
  { timeout: 180_000 },
  async function (this: ScenarioWorld, before: string, lastBefore: string, after: string) {
    const tui = await this.startTuiSession("scripted");
    const harness = this.profileHarness();
    const lengths = await readLogLengths(harness);
    const beforeMark = tui.markOutput();
    tui.sendLine(before);
    await tui.waitForTextAfter(lastBefore, beforeMark, 60_000);
    assert.strictEqual(tui.text.includes("Stop hook override cap reached."), false);
    await tui.reload(30_000);
    const afterMark = tui.markOutput();
    tui.sendLine(after);
    await tui.waitForTextAfter("After 9", afterMark, 90_000);
    await tui.waitForTextAfter("Stop hook override cap reached.", afterMark, 90_000);
    const logs = await readLogLinesSince(harness, lengths);
    assert.deepStrictEqual(callsPastScript(logs), []);
    this.recordTurn({ prompt: after, disposition: "interactive", records: [], logs });
  },
);

Then(
  "the reloaded stop sequence has these exact replies and hook states:",
  function (this: ScenarioWorld, table: DataTable) {
    const [header, ...rows] = table.raw();
    assert.deepStrictEqual(header, ["run", "reply", "stop hook active"]);
    const before = rows.filter(([run]) => run === "before");
    const after = rows.filter(([run]) => run === "after");
    assert.strictEqual(before.length, 3);
    assert.strictEqual(after.length, 9);
    const turn = this.requireTurn();
    assertStopRuns(
      turn,
      rows.map(([, reply, active]) => [reply ?? "", active === "true"]),
    );
    const calls = modelCallsWithCount(turn, 13);
    for (const [offset, replies] of [
      [0, before],
      [4, after],
    ] as const) {
      for (const [index, [, reply]] of replies.entries()) {
        const call = calls[offset + index];
        assert.ok(call !== undefined);
        const messages = callMessageRows([call]);
        if (index === 0) {
          assert.deepStrictEqual(messages.at(-1), [
            String(offset + 1),
            "user",
            offset === 0 ? "before reload" : "after reload",
          ]);
        } else {
          assert.deepStrictEqual(messages.slice(-2), [
            [String(offset + index + 1), "assistant", replies[index - 1]?.[1]],
            [String(offset + index + 1), "user", "Stop hook feedback:\nkeep going"],
          ]);
        }

        assert.ok(reply !== undefined);
      }
    }

    assert.ok(this.requireTuiSession().text.includes("Stop hook override cap reached."));
    this.markTurnCompared();
  },
);

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

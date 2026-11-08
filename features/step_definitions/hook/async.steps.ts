/**
 * @fileoverview Steps about async hooks: the turn an async rewake hook wakes,
 * the release of a waiting hook whose exit wakes the model or shows nothing,
 * and the absence of a rewake summary (ASYNC-01, ASYNC-02).
 *
 * An async rewake hook that exits 2 shows the user its summary, then wakes
 * the model with a turn of its own (D-BG-201, D-BG-204). The extension shows
 * the summary before it starts that turn, so the summary record precedes the
 * woken run's records, and a step that waits for the woken turn waits for the
 * `agent_settled` record after the last summary record.
 *
 * A hook whose exit shows nothing leaves no record to wait for. Its release
 * step waits for the hook's end line, then for Pi to reap the hook's process,
 * then for two `get_state` round trips, which put Pi's handling of the
 * child's output ahead of the step's checks.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Given, Then, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { HOOK_LIFECYCLE_LOG, waitForHookLifecycle } from "../../lib/hook-recorder.ts";
import { claudePluginPayloads } from "../../lib/pi-commands.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { isRunning, readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { HookLifecycleEvent } from "../../lib/hook-recorder.ts";
import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// A scripted turn settles, and a released script exits, in well under a
// second; the margin covers a loaded CI runner and stays below the 30-second
// step timeout.
const ASYNC_STEP_DEADLINE_MS = 20_000;

// How often a wait reads a marker or a process again.
const ASYNC_POLL_MS = 50;

const DIALOG_KINDS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

// An extension error or a dialog is never expected while async hooks run.
function faultOf(record: RpcRecord): boolean {
  if (record.type === "extension_error") {
    return true;
  }

  return record.type === "extension_ui_request" && DIALOG_KINDS.has(String(record.method));
}

// Whether `record` appended a rewake summary of the extension.
function isRewakeSummaryRecord(record: RpcRecord): boolean {
  if (record.type !== "entry_appended" || typeof record.entry !== "object") {
    return false;
  }

  const entry = record.entry as { readonly customType?: string; readonly data?: unknown };
  return claudePluginPayloads([entry]).some((payload) => payload.kind === "async-rewake-summary");
}

// Waits for the first `agent_settled` record at or after `index`, and asserts
// that its turn was not aborted.
async function waitForSettleAt(world: ScenarioWorld, index: number): Promise<void> {
  const isSettle = (record: RpcRecord): boolean => record.type === "agent_settled";
  const record = await world.pi.waitForRecord(index, isSettle, ASYNC_STEP_DEADLINE_MS);
  assert.strictEqual(record.aborted, false, JSON.stringify(record));
}

// Waits for the `agent_settled` record after the last rewake summary record
// at or after `from`: the end of the turn the hook woke.
async function waitForWokenTurn(world: ScenarioWorld, from: number): Promise<void> {
  const records = world.pi.recordsSince(from);
  const last = records.map(isRewakeSummaryRecord).lastIndexOf(true);
  assert.notStrictEqual(last, -1, "no rewake summary shows that a hook woke the model");
  await waitForSettleAt(world, from + last + 1);
}

// Asserts that the records since `from` hold no fault and that the model got
// no call past its script, then keeps them and the log lines since `lengths`
// as the last turn of `prompt`.
async function keepTurn(
  world: ScenarioWorld,
  prompt: string,
  lengths: ReadonlyMap<string, number>,
  from: number,
): Promise<void> {
  const records = world.pi.recordsSince(from);
  assert.deepStrictEqual(records.filter(faultOf), []);
  const logs = await readLogLinesSince(world.profileHarness(), lengths);
  const pastScript = modelCallsOf(logs).filter((call) => call.overflow);
  assert.deepStrictEqual(pastScript, [], "the model was called past its script");
  world.recordTurn({ prompt, disposition: "started", records, logs });
}

// Sends the prompt `text`, asserts that Pi started a turn, and waits for its
// settle. Returns the prompt and the log lengths and record count from before
// it, so a turn keeps only what the prompt added.
async function promptToSettle(
  world: ScenarioWorld,
  text: string,
): Promise<{
  readonly message: string;
  readonly lengths: ReadonlyMap<string, number>;
  readonly from: number;
}> {
  const lengths = await readLogLengths(world.profileHarness());
  const from = world.pi.recordCount();
  const message = expandTokens(text, world.tokens);
  const answer = await world.pi.request({ type: "prompt", message });
  assert.strictEqual(promptDisposition(answer.response), "started", JSON.stringify(answer));
  await waitForSettleAt(world, from);
  return { message, lengths, from };
}

// Creates the release marker of `hook`, waits until a run of the hook takes
// it, then for the end line the hook logs since `lengths`, and returns the
// pid of that line.
async function releaseWaitingHook(
  world: ScenarioWorld,
  hook: string,
  lengths: ReadonlyMap<string, number>,
): Promise<number> {
  const deadline = Date.now() + ASYNC_STEP_DEADLINE_MS;
  const directory = path.join(world.tokens.home, "hook-releases");
  const marker = path.join(directory, hook);
  await mkdir(directory, { recursive: true });
  await writeFile(marker, "", { flag: "wx" });
  while (existsSync(marker)) {
    assert.ok(Date.now() < deadline, `no run of the hook ${hook} took its release`);
    await delay(ASYNC_POLL_MS);
  }

  const ended = await waitForHookLifecycle(
    world.profileHarness(),
    hook,
    "end",
    lengths,
    deadline - Date.now(),
  );
  return ended.pid;
}

Given("the model has answered the woken turn", async function (this: ScenarioWorld) {
  await waitForWokenTurn(this, 0);
});

When(
  "the user prompts {string} after the woken turn ends",
  async function (this: ScenarioWorld, text: string) {
    await waitForWokenTurn(this, 0);
    const { message, lengths, from } = await promptToSettle(this, text);
    await keepTurn(this, message, lengths, from);
  },
);

When(
  "the user releases the hook {string} and it wakes the model",
  async function (this: ScenarioWorld, hook: string) {
    const lengths = await readLogLengths(this.profileHarness());
    const from = this.pi.recordCount();
    await releaseWaitingHook(this, hook, lengths);
    await this.pi.waitForRecord(from, isRewakeSummaryRecord, ASYNC_STEP_DEADLINE_MS);
    await waitForWokenTurn(this, from);
    await keepTurn(this, "release", lengths, from);
  },
);

When(
  "the user releases the hook {string} and pi handles its exit",
  async function (this: ScenarioWorld, hook: string) {
    const lengths = await readLogLengths(this.profileHarness());
    const from = this.pi.recordCount();
    const pid = await releaseWaitingHook(this, hook, lengths);
    await waitForHandledExit(this, pid);
    const started = this.pi.recordsSince(from).filter((record) => record.type === "agent_start");
    assert.deepStrictEqual(started, [], "the hook's exit started a turn");
    await keepTurn(this, "release", lengths, from);
  },
);

// Waits until Pi reaped the hook process `pid`, then for two `get_state`
// round trips, the second answering that Pi is not streaming.
async function waitForHandledExit(world: ScenarioWorld, pid: number): Promise<void> {
  const deadline = Date.now() + ASYNC_STEP_DEADLINE_MS;
  while (isRunning(pid)) {
    assert.ok(Date.now() < deadline, `pi did not reap the hook process ${pid}`);
    await delay(ASYNC_POLL_MS);
  }

  await world.pi.request({ type: "get_state" });
  const { response } = await world.pi.request({ type: "get_state" });
  const state = response.data as { readonly isStreaming?: boolean } | undefined;
  assert.strictEqual(state?.isStreaming, false, JSON.stringify(response));
}

// The log lengths `lengths` with the lifecycle log moved just past the end
// line of `ended`, so a later wait finds only the lines after it.
async function lengthsPast(
  world: ScenarioWorld,
  lengths: ReadonlyMap<string, number>,
  ended: HookLifecycleEvent,
): Promise<ReadonlyMap<string, number>> {
  const logs = await readLogLinesSince(world.profileHarness(), lengths);
  const lines = (logs.get(HOOK_LIFECYCLE_LOG) ?? []) as readonly HookLifecycleEvent[];
  const index = lines.findIndex((line) => line.phase === "end" && line.pid === ended.pid);
  const moved = new Map(lengths);
  moved.set(HOOK_LIFECYCLE_LOG, (lengths.get(HOOK_LIFECYCLE_LOG) ?? 0) + index + 1);
  return moved;
}

// A Stop hook that exits 2 wakes the model, and its run after the woken turn
// sees `stop_hook_active` and ends quietly (D-BG-203, D-BG-206). The step
// waits for each in order and keeps the whole span as one turn.
When(
  "the user prompts {string} and the hook {string} wakes the model once",
  async function (this: ScenarioWorld, text: string, hook: string) {
    const harness = this.profileHarness();
    const { message, lengths, from } = await promptToSettle(this, text);
    const first = await waitForHookLifecycle(harness, hook, "end", lengths, ASYNC_STEP_DEADLINE_MS);
    const past = await lengthsPast(this, lengths, first);
    await this.pi.waitForRecord(from, isRewakeSummaryRecord, ASYNC_STEP_DEADLINE_MS);
    await waitForWokenTurn(this, from);
    const settledAt = this.pi.recordCount();
    const second = await waitForHookLifecycle(harness, hook, "end", past, ASYNC_STEP_DEADLINE_MS);
    await waitForHandledExit(this, second.pid);
    const later = this.pi.recordsSince(settledAt).filter((record) => record.type === "agent_start");
    assert.deepStrictEqual(later, [], "the hook woke the model a second time");
    await keepTurn(this, message, lengths, from);
  },
);

// A table with only a header cannot be compared, so a turn that showed no
// rewake summary has a step of its own.
Then("the hooks show the user no rewake summaries", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.requireTurn().records.filter(isRewakeSummaryRecord), []);
  this.markTurnCompared();
});

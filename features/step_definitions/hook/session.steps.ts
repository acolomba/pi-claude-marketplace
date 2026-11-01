/**
 * @fileoverview Steps about the session actions that run plugin hooks: a new
 * session and a compaction, the setup they need, and each action recording
 * the hook runs it caused as a turn.
 *
 * A session action is not a prompt, so the model-turn `When` cannot read the
 * hook runs it causes. Each action `When` here reads the stand-in logs of the
 * profile Pi before and after the action and keeps the lines the action added
 * as the last turn (HAR-03), so the hook runs steps state them. Each setup
 * `Given` performs the same action and records no turn.
 *
 * Pi compacts nothing in a session shorter than its recent-token budget, so a
 * compaction scenario first lowers the budget in the agent settings, before
 * the profile Pi starts. The scripted model plays each summarization call of
 * a compaction, so the script lists one reply for each.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { startSession } from "../../lib/pi-commands.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf, readModelCalls } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ModelCall } from "../../lib/scripted-model/script.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Pi keeps this many tokens of recent history out of a compaction. One token
// makes a one-turn session compactable.
const COMPACTION_SETTINGS = `${JSON.stringify({ compaction: { keepRecentTokens: 1 } })}\n`;

// A scripted turn settles in well under a second; the margin covers a loaded
// CI runner and stays below the 30-second step timeout, so a setup prompt
// that never settles fails here.
const SETUP_TURN_TIMEOUT_MS = 20_000;

const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

// An extension error or a dialog during a session action is never expected.
function faultsOf(records: readonly RpcRecord[]): readonly RpcRecord[] {
  return records.filter(
    (record) =>
      record.type === "extension_error" ||
      (record.type === "extension_ui_request" && DIALOG_METHODS.has(String(record.method))),
  );
}

// The calls the model got past the end of its script, by number.
function overflowingCalls(calls: readonly ModelCall[]): readonly string[] {
  return calls.filter((call) => call.overflow).map((call) => `call ${call.index + 1}`);
}

// Runs `action` on the profile Pi and keeps every record and stand-in log line
// it added as the last turn, after asserting that Pi reported no fault and
// called the model no further than its script. The action resolves only once
// Pi answered, and Pi answers a session action after its session handlers,
// the hooks among them, finished.
async function recordSessionAction(
  world: ScenarioWorld,
  prompt: string,
  action: () => Promise<void>,
): Promise<void> {
  const harness = world.profileHarness();
  const lengths = await readLogLengths(harness);
  const from = world.pi.recordCount();
  await action();
  const records = world.pi.recordsSince(from);
  assert.deepStrictEqual(faultsOf(records), []);
  const logs = await readLogLinesSince(harness, lengths);
  assert.deepStrictEqual(overflowingCalls(modelCallsOf(logs)), [], "the model ran past its script");
  world.recordTurn({ prompt, disposition: "handled", records, logs });
}

// RPC `compact` answers after Pi ran its `session_compact` handlers.
async function compactSession(world: ScenarioWorld): Promise<void> {
  const { response } = await world.pi.request({ type: "compact" });
  assert.strictEqual(response.success, true, JSON.stringify(response));
}

// Pi reads the agent settings when it starts, so this precedes the profile
// Pi. The file is new in the sandbox, and its release removes it.
Given(
  "pi keeps only one recent token when the hooks session compacts",
  async function (this: ScenarioWorld) {
    const file = path.join(this.tokens.agentDir, "settings.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, COMPACTION_SETTINGS, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), COMPACTION_SETTINGS);
  },
);

// A prompt that gives a compaction a turn to summarize. Pi starts a turn for
// it, and the step waits for `agent_settled`, never for a fixed time, and
// keeps no turn.
Given(
  "the user has prompted {string} with the hooks recording",
  async function (this: ScenarioWorld, text: string) {
    const harness = this.profileHarness();
    const from = this.pi.recordCount();
    const message = expandTokens(text, this.tokens);
    const { response } = await this.pi.request({ type: "prompt", message });
    assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
    const settled = await this.pi.waitForRecord(
      from,
      (record) => record.type === "agent_settled",
      SETUP_TURN_TIMEOUT_MS,
    );
    assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
    assert.deepStrictEqual(faultsOf(this.pi.recordsSince(from)), []);
    assert.deepStrictEqual(overflowingCalls(await readModelCalls(harness)), []);
  },
);

Given(
  "the user has compacted the session with the hooks recording",
  async function (this: ScenarioWorld) {
    this.profileHarness();
    await compactSession(this);
  },
);

// A new session's payloads become the last results, as the frozen session
// `When` keeps them, so a payload no step states still fails the scenario.
When(
  "the user starts a new pi session with the hooks recording",
  async function (this: ScenarioWorld) {
    await recordSessionAction(this, "new_session", async () => {
      const report = await startSession(this.pi);
      this.recordResults(report.payloads, "session");
      this.skills = report.skills;
    });
  },
);

When(
  "the user compacts the session with the hooks recording",
  async function (this: ScenarioWorld) {
    await recordSessionAction(this, "compact", () => compactSession(this));
  },
);

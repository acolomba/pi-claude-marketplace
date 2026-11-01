/**
 * @fileoverview Steps about the session actions that run plugin hooks: a new
 * session, and each action records the hook runs it caused as a turn.
 *
 * A session action is not a prompt, so the model-turn `When` cannot read the
 * hook runs it causes. Each action `When` here reads the stand-in logs of the
 * profile Pi before and after the action and keeps the lines the action added
 * as the last turn (HAR-03), so the hook runs steps state them.
 */

import assert from "node:assert/strict";

import { When } from "@cucumber/cucumber";

import { startSession } from "../../lib/pi-commands.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Runs `action` on the profile Pi and keeps every record and stand-in log line
// it added as the last turn, after asserting that Pi reported no extension
// error. The action resolves only once Pi answered, and Pi answers a session
// action after its session handlers, the hooks among them, finished.
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
  assert.deepStrictEqual(
    records.filter((record: RpcRecord) => record.type === "extension_error"),
    [],
  );
  const logs = await readLogLinesSince(harness, lengths);
  world.recordTurn({ prompt, disposition: "handled", records, logs });
}

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

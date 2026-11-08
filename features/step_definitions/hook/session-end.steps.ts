/**
 * @fileoverview Steps about the ways a session ends that the hook session
 * steps do not drive: a saved Pi session, resuming it, and a command in a
 * one-shot Pi in json mode. Each action keeps the hook runs it caused as the
 * last turn, so the hook runs steps state them (D-BG-606).
 *
 * The profile Pi runs with no saved session, so the saved-session step writes
 * one: Pi's version-3 session header, directly under the agent's sessions
 * directory, so the resumed session reports a stable transcript path.
 *
 * A one-shot Pi shares the sandbox HOME with the profile Pi, so its hook runs
 * land in the profile Pi's harness directory. Its command results are not the
 * point of these steps, so the json-mode step keeps none of them, and its
 * turn holds no RPC record: Pi in json mode stops printing before its session
 * ends.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given, When } from "@cucumber/cucumber";

import { runJsonModeCommand } from "../../lib/pi-json-mode.ts";
import { DIALOG_METHODS } from "../../lib/pi-process.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// The path of the saved session `name` in the sandbox agent directory.
function savedSessionFile(world: ScenarioWorld, name: string): string {
  assert.match(name, /^[a-z0-9-]+$/u, `the saved session name ${name} is not a plain name`);
  return path.join(world.tokens.agentDir, "sessions", `${name}.jsonl`);
}

// A record that shows a fault: an extension error, or a dialog that no step
// of these scenarios expects.
function isFault(record: RpcRecord): boolean {
  if (record.type === "extension_error") {
    return true;
  }

  return record.type === "extension_ui_request" && DIALOG_METHODS.has(String(record.method));
}

// Runs `action` and returns the lines every harness log gained meanwhile.
async function harnessLinesAround(
  world: ScenarioWorld,
  action: () => Promise<void>,
): Promise<ReadonlyMap<string, readonly unknown[]>> {
  const harness = world.profileHarness();
  const before = await readLogLengths(harness);
  await action();
  return readLogLinesSince(harness, before);
}

// Pi reads the header to open the file, and appends to it once it resumes it,
// so the step checks the text right after writing it.
Given(
  "the user has a saved pi session {string} in the project",
  async function (this: ScenarioWorld, name: string) {
    const file = savedSessionFile(this, name);
    const header = {
      type: "session",
      version: 3,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      cwd: this.tokens.projectDir,
    };
    const text = `${JSON.stringify(header)}\n`;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);

// RPC `switch_session` answers after the ended session's shutdown handlers
// and the resumed session's start handlers ran, the hooks among them.
When(
  "the user resumes the saved pi session {string} with the hooks recording",
  async function (this: ScenarioWorld, name: string) {
    const sessionPath = savedSessionFile(this, name);
    const first = this.pi.recordCount();
    const logs = await harnessLinesAround(this, async () => {
      const { response } = await this.pi.request({ type: "switch_session", sessionPath });
      assert.deepStrictEqual(
        { success: response.success, data: response.data },
        { success: true, data: { cancelled: false } },
      );
    });
    const records = this.pi.recordsSince(first);
    assert.deepStrictEqual(records.filter(isFault), []);
    const pastScript = modelCallsOf(logs).filter((call) => call.overflow);
    assert.deepStrictEqual(pastScript, [], "the model ran past its script");
    this.recordTurn({ prompt: "switch_session", disposition: "handled", records, logs });
  },
);

// The driver fails unless Pi exits 0 within its deadline, so a hook that
// kept the one-shot Pi from exiting fails this step.
When(
  "the user runs {string} in pi's json mode with the hooks recording",
  async function (this: ScenarioWorld, command: string) {
    const launch = await this.oneShotPiLaunch();
    const logs = await harnessLinesAround(this, async () => {
      await runJsonModeCommand(launch, expandTokens(command, this.tokens), (release) => {
        this.onRelease(release);
      });
    });
    this.recordTurn({ prompt: command, disposition: "handled", records: [], logs });
  },
);

/**
 * @fileoverview Steps about the background update of marketplaces: the delay
 * Pi waits before it updates them after the first message.
 */

import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { Given, Then, When } from "@cucumber/cucumber";

import { backgroundUpdateNoticeTexts, tuiNoticeTexts } from "../../lib/pi-tui.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Pi prints this only while the hermetic home configures no model provider.
const MESSAGE_REFUSED = "No API key found for the selected model.";

// A Pi's environment, PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS included, is
// fixed when it starts, so the scenario gets a Pi of its own. Its startup load
// reads the configs, so the step comes before the steps that write them.
Given(
  "pi runs with the background update delay {string}",
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithBackgroundUpdateDelay(value);
  },
);

// The variable reaches only the TUI session, whose Pi reads it when the first message arrives.
Given(
  "the tui session starts with the environment variable {string} set to {string}",
  function (this: ScenarioWorld, name: string, value: string): void {
    this.setTuiVariable(name, value);
  },
);

When("the user starts a tui session", async function (this: ScenarioWorld): Promise<void> {
  await this.startTuiSession();
});

When(
  "the user sends the message {string} in the tui session",
  async function (this: ScenarioWorld, message: string): Promise<void> {
    const tui = await this.startTuiSession();
    this.expectTuiNotices();
    this.tuiMessageMark = tui.markOutput();
    tui.sendLine(message);
  },
);

When(
  "the user runs a foreground plugin list while the tui background request is in flight",
  { timeout: 45_000 },
  async function (this: ScenarioWorld): Promise<void> {
    const tui = await this.startTuiSession();
    this.expectTuiNotices();
    const requestWindow = this.gitHost.mark();
    this.backgroundRequestWindow = requestWindow;
    tui.sendLine("hello");
    await this.gitHost.waitForRequestAfter(requestWindow);
    const outputMark = tui.markOutput();
    const startedAt = Date.now();
    tui.sendLine("/claude:plugin list");
    const output = tui.waitForTextAfter("Plugin list", outputMark, 35_000);
    const completedBeforeCap = await Promise.race([
      output.then(() => true),
      delay(1_000, false, { ref: false }),
    ]);
    assert.strictEqual(completedBeforeCap, false, "foreground bypassed the active background step");
    assert.deepStrictEqual(this.gitHost.requestsSince(requestWindow).requests, [
      { method: "GET", path: "/acme/ghp.git/info/refs?service=git-upload-pack", status: "pending" },
    ]);
    await output;
    this.backgroundForegroundWaitMs = Date.now() - startedAt;
  },
);

Then(
  "the tui session has an interactive terminal and is ready",
  function (this: ScenarioWorld): void {
    assert.deepStrictEqual(this.requireTuiSession().readiness, { isatty: true, ready: true });
  },
);

Then(
  "the foreground plugin list waits for the background git request to stop at the wait cap",
  async function (this: ScenarioWorld): Promise<void> {
    const waitMs = this.backgroundForegroundWaitMs;
    assert.ok(waitMs !== undefined);
    assert.ok(waitMs >= 30_000 && waitMs <= 35_000, `foreground wait was ${waitMs} ms`);
    const requestWindow = this.backgroundRequestWindow;
    assert.ok(requestWindow !== undefined);
    await this.gitHost.waitForRequestsSettledAfter(requestWindow);
    assert.deepStrictEqual(this.gitHost.requestsSince(requestWindow), {
      requests: [
        {
          method: "GET",
          path: "/acme/ghp.git/info/refs?service=git-upload-pack",
          status: "dropped",
        },
      ],
      connections: 1,
    });
    await this.requireTuiSession().waitForQuiet(250, 5_000);
    assert.deepStrictEqual(backgroundUpdateNoticeTexts(this.requireTuiSession().text), []);
    this.markTuiNoticesCompared();
  },
);

// Pi runs its input handlers, which arm the background pass with a delay of 0 ms in these
// scenarios, before it refuses the message for want of a model. Waiting for that refusal
// starts the quiet window after the pass has been armed or declined, not before. Pi's
// refusal is the only error or warning the message may add, and no background update
// notice may appear at all. Pi redraws the whole screen at times, so the notices the
// terminal showed before the message are left out rather than counted.
Then("the tui session reports no notice", async function (this: ScenarioWorld): Promise<void> {
  const tui = this.requireTuiSession();
  const mark = this.tuiMessageMark;
  assert.ok(mark !== undefined, "no message was sent in the tui session");
  await tui.waitForTextAfter(MESSAGE_REFUSED, mark, 15_000);
  await tui.waitForQuiet(2_000, 15_000);
  const shownBefore = new Set(tuiNoticeTexts(tui.textBefore(mark)));
  assert.deepStrictEqual(
    {
      added: tuiNoticeTexts(tui.textAfter(mark)).filter((notice) => !shownBefore.has(notice)),
      backgroundUpdates: backgroundUpdateNoticeTexts(tui.text),
    },
    { added: [`Error: ${MESSAGE_REFUSED}`], backgroundUpdates: [] },
  );
  this.markTuiNoticesCompared();
});

Then(
  "the tui session reports the notice {string}",
  async function (this: ScenarioWorld, notice: string): Promise<void> {
    const tui = this.requireTuiSession();
    await tui.waitForText(notice, 30_000);
    await tui.waitForQuiet(250, 5_000);
    assert.deepStrictEqual(backgroundUpdateNoticeTexts(tui.text), [notice]);
    this.markTuiNoticesCompared();
  },
);

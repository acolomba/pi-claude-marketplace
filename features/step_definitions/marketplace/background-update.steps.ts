/**
 * @fileoverview Steps about the background update of marketplaces: the delay
 * Pi waits before it updates them after the first message.
 */

import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";

import { backgroundUpdateNoticeTexts } from "../../lib/pi-tui.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// A Pi's environment, PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS included, is
// fixed when it starts, so the scenario gets a Pi of its own. Its startup load
// reads the configs, so the step comes before the steps that write them.
Given(
  "pi runs with the background update delay {string}",
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithBackgroundUpdateDelay(value);
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
    tui.sendLine(message);
  },
);

When(
  "the user runs a foreground plugin list while the tui background request is in flight",
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
    await tui.waitForTextAfter("Plugin list", outputMark, 35_000);
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
  "the foreground plugin list stops the background request within the wait cap",
  async function (this: ScenarioWorld): Promise<void> {
    const waitMs = this.backgroundForegroundWaitMs;
    assert.ok(waitMs !== undefined);
    assert.ok(waitMs > 0 && waitMs <= 30_000, `foreground wait was ${waitMs} ms`);
    const requestWindow = this.backgroundRequestWindow;
    assert.ok(requestWindow !== undefined);
    await this.gitHost.waitForRequestsSettledAfter(requestWindow);
    assert.deepStrictEqual(this.gitHost.requestsSince(requestWindow), {
      requests: [
        {
          method: "GET",
          path: "/acme/tools/marketplace.json",
          status: "dropped",
        },
      ],
      connections: 2,
    });
    await this.requireTuiSession().waitForQuiet(250, 5_000);
    assert.deepStrictEqual(backgroundUpdateNoticeTexts(this.requireTuiSession().text), []);
    this.markTuiNoticesCompared();
  },
);

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

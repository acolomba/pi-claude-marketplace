/**
 * @fileoverview The request window of the GitHub sign-in stand-in and the
 * GitHub redirect, whose logs lie in the profile Pi's harness directory.
 *
 * Each `When` step opens a new window, so a request step reads only the
 * requests of the last `When`, and a request that a `Given` made is never
 * part of it (D-BG-01).
 */

import { BeforeStep, type ITestStepHookParameter } from "@cucumber/cucumber";

import { readLogLengths } from "../lib/turn-records.ts";

import type { ScenarioWorld } from "./world.ts";

BeforeStep(async function (
  this: ScenarioWorld,
  { pickleStep }: ITestStepHookParameter,
): Promise<void> {
  // The step type is an enum of `@cucumber/messages`, which is not a direct
  // dependency. With no profile Pi yet, every line the logs gain is the `When`'s.
  if (String(pickleStep.type) === "Action") {
    this.harnessLogWindow = this.profilePiStarted
      ? await readLogLengths(this.profileHarness())
      : new Map();
  }
});

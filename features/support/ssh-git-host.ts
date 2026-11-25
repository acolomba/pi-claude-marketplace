/**
 * @fileoverview The launch window of the ssh stand-in.
 *
 * Each `When` step opens a new window, so a launch step reads only the
 * launches of the last command, and a clone that a `Given` made is never part
 * of a later command's launches (SG-HRN-03).
 */

import { BeforeStep, type ITestStepHookParameter } from "@cucumber/cucumber";

import type { ScenarioWorld } from "./world.ts";

BeforeStep(async function (
  this: ScenarioWorld,
  { pickleStep }: ITestStepHookParameter,
): Promise<void> {
  // The step type is an enum of `@cucumber/messages`, which is not a direct dependency.
  if (String(pickleStep.type) === "Action") {
    this.sshLaunchWindow = await this.sshHost.mark();
  }
});

/**
 * @fileoverview The request window of the git host.
 *
 * Each `When` step opens a new window, so a request step reads only the
 * requests of the last command, and a clone that a `Given` made is never part
 * of a later command's requests (HOST-04).
 */

import { BeforeStep, type ITestStepHookParameter } from "@cucumber/cucumber";

import type { ScenarioWorld } from "./world.ts";

BeforeStep(function (this: ScenarioWorld, { pickleStep }: ITestStepHookParameter): void {
  // The step type is an enum of `@cucumber/messages`, which is not a direct dependency.
  if (String(pickleStep.type) === "Action") {
    this.requestWindow = this.gitHost.mark();
  }
});

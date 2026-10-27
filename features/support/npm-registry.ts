/**
 * @fileoverview The request window of the npm registry stand-in.
 *
 * Each `When` step of a scenario that started an npm registry opens a new
 * window, so a request step reads only the requests of the last command or
 * session, never those of a setup command.
 */

import { BeforeStep, type ITestStepHookParameter } from "@cucumber/cucumber";

import type { ScenarioWorld } from "./world.ts";

BeforeStep(function (this: ScenarioWorld, { pickleStep }: ITestStepHookParameter): void {
  // The step type is an enum of `@cucumber/messages`, which is not a direct dependency.
  if (this.npmRegistry !== undefined && String(pickleStep.type) === "Action") {
    this.npmRequestWindow = this.npmRegistry.mark();
  }
});

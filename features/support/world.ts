/**
 * @fileoverview The per-scenario world.
 *
 * Every scenario gets a fresh world. The world holds what the steps of one
 * scenario share and reaches the run's one headless Pi, which
 * `support/pi-process.ts` resets before every scenario. Whatever a step or
 * hook creates registers its release here, and the world runs those releases
 * in reverse order when the scenario ends.
 */

import { After, setDefaultTimeout, setWorldConstructor, World } from "@cucumber/cucumber";

import { currentRun } from "./pi-process.ts";

import type { CascadePayload, OfferedSkill } from "../lib/pi-commands.ts";
import type { PiProcess } from "../lib/pi-process.ts";

// Starting Pi takes most of a second and a command a tenth of that; the
// margin covers a loaded CI runner.
const STEP_TIMEOUT_MS = 30_000;

setDefaultTimeout(STEP_TIMEOUT_MS);

export class PluginWorld extends World {
  result: CascadePayload | undefined = undefined;
  skills: readonly OfferedSkill[] | undefined = undefined;
  private readonly releases: Array<() => Promise<void> | void> = [];

  /** The run's Pi, which the `Before()` hook has reset for this scenario. */
  get pi(): PiProcess {
    return currentRun().pi;
  }

  /** The directory the marketplace steps write local marketplaces into. */
  get marketplacesRoot(): string {
    return currentRun().marketplacesRoot;
  }

  /** Returns the result of the last command, which a `When` step must have run. */
  lastResult(): CascadePayload {
    if (this.result === undefined) {
      throw new Error("no command has run in this scenario");
    }

    return this.result;
  }

  /** Returns the skills of the last new session, which a `When` step must have started. */
  sessionSkills(): readonly OfferedSkill[] {
    if (this.skills === undefined) {
      throw new Error("no new session has started in this scenario");
    }

    return this.skills;
  }

  /** Registers `release` to run when the scenario ends, before anything registered earlier. */
  onRelease(release: () => Promise<void> | void): void {
    this.releases.push(release);
  }

  /** Runs every registered release, the most recent first, even when an earlier one fails. */
  async release(): Promise<void> {
    const errors: unknown[] = [];
    for (const release of this.releases.splice(0).reverse()) {
      try {
        await release();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "scenario releases failed");
    }
  }
}

setWorldConstructor(PluginWorld);

After(async function (this: PluginWorld): Promise<void> {
  await this.release();
});

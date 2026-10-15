/**
 * @fileoverview The per-scenario world.
 *
 * Every scenario gets a fresh world. The world holds what the steps of one
 * scenario share and reaches the run's one headless Pi, which
 * `support/pi-process.ts` resets before every scenario. Whatever a step or
 * hook creates registers its release here, and the world runs those releases
 * in reverse order when the scenario ends.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { After, setDefaultTimeout, setWorldConstructor, World } from "@cucumber/cucumber";

import { currentRun } from "./pi-process.ts";

import type { NotificationPayload, OfferedSkill } from "../lib/pi-commands.ts";
import type { PiProcess } from "../lib/pi-process.ts";
import type { PublishedMarketplace } from "../lib/published-marketplace.ts";
import type { RunTokens } from "../lib/run-tokens.ts";

// Starting Pi takes most of a second and a command a tenth of that; the
// margin covers a loaded CI runner.
const STEP_TIMEOUT_MS = 30_000;

setDefaultTimeout(STEP_TIMEOUT_MS);

export class ScenarioWorld extends World {
  results: readonly NotificationPayload[] | undefined = undefined;
  // Cucumber builds the world before any `Before()` hook, so the
  // `{scenario time}` window opens before any setup command runs (D-05).
  readonly startedAt = Date.now();
  skills: readonly OfferedSkill[] | undefined = undefined;
  private readonly published = new Map<string, PublishedMarketplace>();
  private readonly releases: Array<() => Promise<void> | void> = [];

  /** The run's Pi, which the `Before()` hook has reset for this scenario. */
  get pi(): PiProcess {
    return currentRun().pi;
  }

  /** The directory the marketplace steps write local marketplaces into. */
  get marketplacesRoot(): string {
    return currentRun().marketplacesRoot;
  }

  /**
   * Returns the root directory of `scope`, where its configuration files live:
   * the sandbox agent directory for `user`, and `.pi` under the sandbox
   * project for `project`.
   */
  scopeRoot(scope: string): string {
    const { sandbox } = currentRun();
    switch (scope) {
      case "user":
        return sandbox.agentDir;
      case "project":
        return path.join(sandbox.cwd, ".pi");
      default:
        throw new Error(`unknown scope ${scope}; expected user or project`);
    }
  }

  /** The values the run tokens of this scenario stand for. */
  get tokens(): RunTokens {
    return { home: currentRun().sandbox.home, scenarioStartedAt: this.startedAt };
  }

  /**
   * Returns the one result of the last command, which a `When` step must have
   * run. Fails when the command emitted more than one payload (DRV-01).
   */
  lastResult(): NotificationPayload {
    if (this.results === undefined) {
      throw new Error("no command has run in this scenario");
    }

    const [result, ...others] = this.results;
    if (result === undefined || others.length > 0) {
      assert.fail(`expected exactly one result, got ${JSON.stringify(this.results)}`);
    }

    return result;
  }

  /**
   * Returns every result of the last command in emission order, which a
   * `When` step must have run. The driver guarantees at least one (DRV-01).
   */
  allResults(): readonly NotificationPayload[] {
    if (this.results === undefined) {
      throw new Error("no command has run in this scenario");
    }

    return this.results;
  }

  /** Records how this scenario published the marketplace `name`. */
  recordPublished(name: string, published: PublishedMarketplace): void {
    this.published.set(name, published);
  }

  /** Returns how this scenario published the marketplace `name`, if it did. */
  publishedMarketplace(name: string): PublishedMarketplace | undefined {
    return this.published.get(name);
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

setWorldConstructor(ScenarioWorld);

After(async function (this: ScenarioWorld): Promise<void> {
  await this.release();
});

/**
 * @fileoverview The per-scenario world.
 *
 * Every scenario gets a fresh world. The world holds what the steps of one
 * scenario share and reaches the run's one headless Pi and its git host,
 * which `support/pi-process.ts` resets before every scenario. Whatever a step or
 * hook creates registers its release here, and the world runs those releases
 * in reverse order when the scenario ends. A passing scenario also fails
 * there when a row array or an MCP config notice of its last results went
 * uncompared.
 */

import assert from "node:assert/strict";
import path from "node:path";

import {
  After,
  type ITestCaseHookParameter,
  setDefaultTimeout,
  setWorldConstructor,
  Status,
  World,
} from "@cucumber/cucumber";

import { currentRun } from "./pi-process.ts";

import type { GitHostTraffic, HttpsGitHost, RequestWindow } from "../lib/https-git-host/server.ts";
import type { NotificationPayload, OfferedSkill } from "../lib/pi-commands.ts";
import type { PiProcess } from "../lib/pi-process.ts";
import type { PublicationSites, PublishedMarketplace } from "../lib/published-marketplace.ts";
import type { RunTokens } from "../lib/run-tokens.ts";

// Starting Pi takes most of a second and a command a tenth of that; the
// margin covers a loaded CI runner.
const STEP_TIMEOUT_MS = 30_000;

setDefaultTimeout(STEP_TIMEOUT_MS);

export class ScenarioWorld extends World {
  results: readonly NotificationPayload[] | undefined = undefined;
  // The non-empty row arrays of `results` that no step has compared yet, as
  // `<kind> <field>`. The steps that state a result's fields hide them, so a
  // row step must read them and then call `markRowsCompared()`.
  uncomparedRows: readonly string[] = [];
  // The MCP config notice results of `results` that no step has compared yet,
  // by kind. Only `the command reports these results:` states their fields,
  // and it calls `markNoticesCompared()`.
  uncomparedNotices: readonly string[] = [];
  // Cucumber builds the world before any `Before()` hook, so the
  // `{scenario time}` window opens before any setup command runs (D-05).
  readonly startedAt = Date.now();
  skills: readonly OfferedSkill[] | undefined = undefined;
  // The git host's counts when the last `When` step started, so a request
  // step reads only that command's traffic. The `BeforeStep` hook in
  // `support/https-git-host.ts` sets it.
  requestWindow: RequestWindow | undefined = undefined;
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

  /** The run's https git host, which the `Before()` hook has reset for this scenario. */
  get gitHost(): HttpsGitHost {
    return currentRun().gitHost;
  }

  /** Where the marketplace steps publish marketplaces of every source kind. */
  get publicationSites(): PublicationSites {
    return { marketplacesRoot: this.marketplacesRoot, gitHost: this.gitHost };
  }

  /**
   * Returns the root directory of `scope`, where its configs live:
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
    const run = currentRun();
    return {
      home: run.sandbox.home,
      gitHost: run.gitHost.address,
      scenarioStartedAt: this.startedAt,
    };
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

  /**
   * Returns the requests the git host received and the connections it
   * accepted since the last `When` step started.
   */
  requestsOfLastCommand(): GitHostTraffic {
    const window = this.requestWindow;
    if (window === undefined) {
      throw new Error("no command has run in this scenario");
    }

    return this.gitHost.requestsSince(window);
  }

  /**
   * Records that a row step compared the row arrays of the last results. This
   * is the one write a `Then` step makes to the world.
   */
  markRowsCompared(): void {
    this.uncomparedRows = [];
  }

  /**
   * Records that a step compared the fields of every result of the last
   * command, MCP config notices included.
   */
  markNoticesCompared(): void {
    this.uncomparedNotices = [];
  }

  /** Records how this scenario published the marketplace `name`. */
  recordPublished(name: string, published: PublishedMarketplace): void {
    this.published.set(name, published);
  }

  /** Returns how this scenario published the marketplace `name`, if it did. */
  publishedMarketplace(name: string): PublishedMarketplace | undefined {
    return this.published.get(name);
  }

  /** Returns how this scenario published the marketplace `name`, failing when it did not. */
  requirePublished(name: string): PublishedMarketplace {
    const published = this.published.get(name);
    if (published === undefined) {
      assert.fail(`the marketplace ${name} is not published in this scenario`);
    }

    return published;
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

After(async function (this: ScenarioWorld, { result }: ITestCaseHookParameter): Promise<void> {
  const uncompared = this.uncomparedRows;
  const uncomparedNotices = this.uncomparedNotices;
  await this.release();
  if (result?.status === Status.PASSED) {
    assert.deepStrictEqual(uncompared, [], "no step compared these rows of the last results");
    assert.deepStrictEqual(
      uncomparedNotices,
      [],
      "no step compared these MCP config notices of the last results",
    );
  }
});

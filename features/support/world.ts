/**
 * @fileoverview The per-scenario world.
 *
 * Every scenario gets a fresh world. The world holds what the steps of one
 * scenario share and reaches the worker's one headless Pi and its git host,
 * which `support/pi-process.ts` resets before every scenario. Whatever a step or
 * hook creates registers its release here, and the world runs those releases
 * in reverse order when the scenario ends. A passing scenario also fails
 * there when a row array or an MCP config notice of its last results went
 * uncompared, or when a new session reported a result whose fields no step
 * stated. The last results are those of the last `When` step: a command or a
 * new session.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  After,
  type ITestCaseHookParameter,
  setDefaultTimeout,
  setWorldConstructor,
  Status,
  World,
} from "@cucumber/cucumber";

import { npmConfigText, NpmRegistry } from "../lib/npm-registry.ts";
import { readSession } from "../lib/pi-commands.ts";
import { PiProcess } from "../lib/pi-process.ts";
import { PiTuiSession } from "../lib/pi-tui.ts";
import { rowArrays } from "../lib/result-rows.ts";

import { currentRun } from "./pi-process.ts";

import type { GitPluginRepository } from "../lib/git-plugin.ts";
import type { GitHostTraffic, HttpsGitHost, RequestWindow } from "../lib/https-git-host/server.ts";
import type { NpmRegistryRequest } from "../lib/npm-registry.ts";
import type { NotificationPayload, OfferedSkill, SessionReport } from "../lib/pi-commands.ts";
import type { RpcGitEnvironment } from "../lib/pi-process.ts";
import type { PublicationSites, PublishedMarketplace } from "../lib/published-marketplace.ts";
import type { RunTokens } from "../lib/run-tokens.ts";

// Starting Pi takes most of a second and a command a tenth of that; the
// margin covers a loaded CI runner.
const STEP_TIMEOUT_MS = 30_000;

setDefaultTimeout(STEP_TIMEOUT_MS);

export class ScenarioWorld extends World {
  results: readonly NotificationPayload[] | undefined = undefined;
  // What produced `results`: a command or a new session.
  resultsSource: "command" | "session" | undefined = undefined;
  // The non-empty row arrays of `results` that no step has compared yet, as
  // `<kind> <field>`. The steps that state a result's fields hide them, so a
  // row step must read them and then call `markRowsCompared()`.
  uncomparedRows: readonly string[] = [];
  // The MCP config notice results of `results` that no step has compared yet,
  // by kind. Only `the command reports these results:` states their fields,
  // and it calls `markNoticesCompared()`.
  uncomparedNotices: readonly string[] = [];
  // The results of the last new session whose fields no step has stated yet,
  // by kind. A command is always followed by a field step, a session is not,
  // so a session payload without rows would otherwise pass unseen. The steps
  // that state the fields of every result call `markResultsCompared()`.
  uncomparedSessionResults: readonly string[] = [];
  // Cucumber builds the world before any `Before()` hook, so the
  // `{scenario time}` window opens before any setup command runs (D-05).
  readonly startedAt = Date.now();
  skills: readonly OfferedSkill[] | undefined = undefined;
  // The git host's counts when the last `When` step started, so a request
  // step reads only that command's traffic. The `BeforeStep` hook in
  // `support/https-git-host.ts` sets it.
  requestWindow: RequestWindow | undefined = undefined;
  // The npm registry this scenario started, which only a scenario that ships plugin packages needs.
  npmRegistry: NpmRegistry | undefined = undefined;
  // The npm registry's log length when the last `When` step started; `support/npm-registry.ts` sets it.
  npmRequestWindow: number | undefined = undefined;
  private readonly published = new Map<string, PublishedMarketplace>();
  private readonly gitRepositories = new Map<string, GitPluginRepository>();
  private readonly errorMessages = new Map<string, string>();
  private readonly releases: Array<() => Promise<void> | void> = [];
  // A Pi this scenario started with an environment of its own; while set it
  // takes the place of the run's Pi.
  private scenarioPi: PiProcess | undefined = undefined;
  private tuiSession: PiTuiSession | undefined = undefined;

  /**
   * The Pi the steps talk to: the one this scenario started with
   * `usePiWithGitHubBaseUrl()` or `usePiWithBackgroundUpdateDelay()`, or else
   * the run's Pi, which the `Before()` hook has reset for this scenario.
   */
  get pi(): PiProcess {
    return this.scenarioPi ?? currentRun().pi;
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
      projectDir: run.sandbox.cwd,
      agentDir: run.sandbox.agentDir,
      gitHost: run.gitHost.address,
      scenarioStartedAt: this.startedAt,
      revisions: this.revisionTokens("revision", (sha) => sha.slice(0, 12)),
      commits: this.revisionTokens("commit", (sha) => sha),
      errors: this.errorMessages,
    };
  }

  /**
   * Records `message`, the wording this Node gives a failing file call, as the
   * value of the error token `token`, such as `{mcp-adapter.json read error}`.
   * A step that sets up the failure reads the wording back by making the same
   * call, since Node majors word one errno differently. A second recording
   * must agree with the first.
   */
  recordErrorMessage(token: string, message: string): void {
    const recorded = this.errorMessages.get(token);
    if (recorded !== undefined) {
      assert.strictEqual(message, recorded, `${token} already stands for another message`);
    }

    this.errorMessages.set(token, message);
  }

  // One `{<repository> <noun> <n>}` token per published revision, standing
  // for `value` of that revision's commit.
  private revisionTokens(noun: string, value: (sha: string) => string): Map<string, string> {
    return new Map(
      [...this.gitRepositories.values()].flatMap((repository) =>
        repository.revisions.map((sha, index): [string, string] => [
          `{${repository.name} ${noun} ${index + 1}}`,
          value(sha),
        ]),
      ),
    );
  }

  /**
   * Keeps `results` as the last results, from `source`, after asserting that
   * a step compared the rows and MCP config notices of the previous ones, and
   * the fields of a previous session's results.
   */
  recordResults(results: readonly NotificationPayload[], source: "command" | "session"): void {
    assert.deepStrictEqual(
      this.uncomparedRows,
      [],
      "no step compared these rows of the previous results",
    );
    assert.deepStrictEqual(
      this.uncomparedNotices,
      [],
      "no step compared these MCP config notices of the previous results",
    );
    assert.deepStrictEqual(
      this.uncomparedSessionResults,
      [],
      "no step compared the fields of these results of the previous session",
    );
    this.results = results;
    this.resultsSource = source;
    this.uncomparedRows = rowArrays(results);
    this.uncomparedNotices = results
      .map((result) => result.kind)
      .filter((kind) => kind === "mcp-config-notices");
    this.uncomparedSessionResults =
      source === "session" ? results.map((result) => result.kind) : [];
  }

  /**
   * Returns the one result of the last command or session, which a `When`
   * step must have run. Fails when it emitted more or fewer than one payload
   * (DRV-01).
   */
  lastResult(): NotificationPayload {
    if (this.results === undefined) {
      throw new Error("no command or session has run in this scenario");
    }

    const [result, ...others] = this.results;
    if (result === undefined || others.length > 0) {
      assert.fail(`expected exactly one result, got ${JSON.stringify(this.results)}`);
    }

    return result;
  }

  /**
   * Returns every result of the last command or session in emission order,
   * which a `When` step must have run. The driver guarantees a command at
   * least one (DRV-01); a session may report none.
   */
  allResults(): readonly NotificationPayload[] {
    if (this.results === undefined) {
      throw new Error("no command or session has run in this scenario");
    }

    return this.results;
  }

  /** Returns every result of the last `When` step, failing unless it came from `source`. */
  resultsOf(source: "command" | "session"): readonly NotificationPayload[] {
    const results = this.allResults();
    if (this.resultsSource !== source) {
      assert.fail(`the last results came from a ${this.resultsSource}, not a ${source}`);
    }

    return results;
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
   * Returns the npm registry of this scenario, starting it the first time.
   * Starting it writes the sandbox `.npmrc` that points npm at it, before any
   * plugin ships a package file, so no npm run reaches the public registry.
   * The scenario's releases remove the `.npmrc` and close the registry.
   */
  async useNpmRegistry(): Promise<NpmRegistry> {
    if (this.npmRegistry !== undefined) {
      return this.npmRegistry;
    }

    const registry = await NpmRegistry.start();
    this.onRelease(() => registry.close());
    this.npmRegistry = registry;
    const config = path.join(this.tokens.home, ".npmrc");
    const text = npmConfigText(registry);
    await writeFile(config, text, { flag: "wx" });
    this.onRelease(() => rm(config, { force: true }));
    assert.strictEqual(await readFile(config, "utf8"), text);
    return registry;
  }

  /** Returns the npm registry of this scenario, failing when no step started one. */
  requireNpmRegistry(): NpmRegistry {
    if (this.npmRegistry === undefined) {
      assert.fail("no step started the npm registry in this scenario");
    }

    return this.npmRegistry;
  }

  /** Returns the requests the npm registry received since the last `When` step started. */
  npmRequestsOfLastCommand(): readonly NpmRegistryRequest[] {
    const registry = this.requireNpmRegistry();
    const window = this.npmRequestWindow;
    if (window === undefined) {
      throw new Error("no command has run in this scenario");
    }

    return registry.requestsSince(window);
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

  /** Records that a step compared the fields of every result of the last `When` step. */
  markResultsCompared(): void {
    this.uncomparedSessionResults = [];
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

  /** Records the git plugin repository `repository` under its name, replacing an earlier record. */
  recordGitRepository(repository: GitPluginRepository): void {
    this.gitRepositories.set(repository.name, repository);
  }

  /** Returns the git plugin repository `name` this scenario published, if it did. */
  gitRepository(name: string): GitPluginRepository | undefined {
    return this.gitRepositories.get(name);
  }

  /** Returns the git plugin repository `name` this scenario published, failing when it did not. */
  requireGitRepository(name: string): GitPluginRepository {
    const repository = this.gitRepositories.get(name);
    if (repository === undefined) {
      assert.fail(`the git repository ${name} is not published in this scenario`);
    }

    return repository;
  }

  /**
   * Returns the one git plugin repository this scenario published that holds
   * the plugin `plugin` now, failing when none or more than one does.
   */
  gitRepositoryServing(plugin: string): GitPluginRepository {
    const serving = [...this.gitRepositories.values()].filter((repository) =>
      repository.plugins.some((candidate) => candidate.name === plugin),
    );
    const [repository, ...others] = serving;
    if (repository === undefined || others.length > 0) {
      assert.fail(
        `expected one git repository to hold the plugin ${plugin}, got ${JSON.stringify(serving.map((candidate) => candidate.name))}`,
      );
    }

    return repository;
  }

  /** Returns the skills of the last new session, which a `When` step must have started. */
  sessionSkills(): readonly OfferedSkill[] {
    if (this.skills === undefined) {
      throw new Error("no new session has started in this scenario");
    }

    return this.skills;
  }

  /**
   * Starts a second Pi with the run's HOME and agent directory in a new,
   * empty project directory, and returns what its first session offers and
   * reports. The run's Pi keeps its own working directory for its whole
   * life, so a session in another project needs a process of its own. This
   * one lives only until its session is read.
   */
  async startSessionInAnotherProject(): Promise<SessionReport> {
    const run = currentRun();
    const cwd = await mkdtemp(path.join(run.root, "other-project-"));
    this.onRelease(() => rm(cwd, { recursive: true, force: true }));
    const { home, agentDir } = run.sandbox;
    const pi = await PiProcess.start({ home, agentDir, cwd }, run.piEnvironment);
    // Stopping a stopped Pi does nothing, so this only matters when reading
    // the session fails.
    this.onRelease(() => pi.stop());
    const report = await readSession(pi);
    await pi.stop();
    return report;
  }

  /**
   * Starts a second Pi with the run's sandbox and git environment, except that
   * the GitHub base override is `value`, and makes it the Pi the steps talk
   * to for the rest of the scenario. The run's Pi reads that variable once,
   * at start, so a scenario that needs another value needs a process of its
   * own. The run's Pi stays idle meanwhile, and the scenario's Pi stops with
   * the scenario.
   */
  async usePiWithGitHubBaseUrl(value: string): Promise<void> {
    await this.usePiWith({
      ...currentRun().piEnvironment,
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: value,
    });
  }

  /**
   * Starts a second Pi as `usePiWithGitHubBaseUrl()` does, except that the
   * maximum delay of the background update is `value` (D-PL8-09) instead of
   * the GitHub base override. A Pi's environment is fixed when it starts, and
   * the run's Pi never sets that variable, so its background update keeps the
   * ten-minute maximum.
   */
  async usePiWithBackgroundUpdateDelay(value: string): Promise<void> {
    await this.usePiWith({
      ...currentRun().piEnvironment,
      PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: value,
    });
  }

  /** Starts one contained production TUI and registers its release before waiting for readiness. */
  async startTuiSession(): Promise<PiTuiSession> {
    if (this.tuiSession !== undefined) {
      throw new Error("a TUI session already started in this scenario");
    }

    const run = currentRun();
    const tui = await PiTuiSession.start({ sandbox: run.sandbox, git: run.piEnvironment });
    this.onRelease(() => tui.stop());
    this.tuiSession = tui;
    await tui.waitUntilReady();
    return tui;
  }

  /** Returns the contained TUI this scenario started. */
  requireTuiSession(): PiTuiSession {
    if (this.tuiSession === undefined) {
      throw new Error("no TUI session started in this scenario");
    }

    return this.tuiSession;
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
      } catch (error: unknown) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "scenario releases failed");
    }
  }

  // Starts a Pi in the run's sandbox with `environment`, stops it with the
  // scenario, and makes it the Pi the steps talk to.
  private async usePiWith(environment: RpcGitEnvironment): Promise<void> {
    const pi = await PiProcess.start(currentRun().sandbox, environment);
    this.onRelease(() => pi.stop());
    this.scenarioPi = pi;
  }
}

setWorldConstructor(ScenarioWorld);

After(async function (this: ScenarioWorld, { result }: ITestCaseHookParameter): Promise<void> {
  const uncompared = this.uncomparedRows;
  const uncomparedNotices = this.uncomparedNotices;
  const uncomparedSessionResults = this.uncomparedSessionResults;
  await this.release();
  if (result?.status === Status.PASSED) {
    assert.deepStrictEqual(uncompared, [], "no step compared these rows of the last results");
    assert.deepStrictEqual(
      uncomparedNotices,
      [],
      "no step compared these MCP config notices of the last results",
    );
    assert.deepStrictEqual(
      uncomparedSessionResults,
      [],
      "no step compared the fields of these results of the last session",
    );
  }
});

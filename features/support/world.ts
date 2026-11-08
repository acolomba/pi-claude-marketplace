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
 *
 * A scenario that needs a model starts a profile Pi of its own (D-CF1-15):
 * the real extension plus the scripted model and the registry probe, in the
 * run's sandbox. It takes the place of the run's Pi until the scenario's
 * release stops it, so the run's shared Pi never gets a model. The world keeps
 * the last model turn, and a second turn fails when no step compared the
 * first. Every profile Pi is checked at start against the MCP implementation
 * its launch implies (DUAL-02), and a restart step replaces it with another
 * in the same sandbox.
 */

import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  After,
  type ITestCaseHookParameter,
  setDefaultTimeout,
  setWorldConstructor,
  Status,
  World,
} from "@cucumber/cucumber";

import { listedCommands } from "../../test/e2e/_rpc.ts";
import { inLoadOrder, resolveCompanion } from "../lib/companions.ts";
import {
  classifyMcpImplementation,
  expectedMcpImplementation,
  parseMcpProfile,
  readBuiltinTurnedOff,
  removeAdapterOnboardingSeed,
  turnOffBuiltinMcp,
  turnOnBuiltinMcp,
  waitForAdapterOnboarding,
} from "../lib/mcp-implementation.ts";
import { npmConfigText, NpmRegistry } from "../lib/npm-registry.ts";
import { readSession } from "../lib/pi-commands.ts";
import { PiProcess } from "../lib/pi-process.ts";
import { REGISTRY_PROBE_EXTENSION } from "../lib/pi-registry-probe/snapshot.ts";
import { PiTuiSession } from "../lib/pi-tui.ts";
import { rowArrays } from "../lib/result-rows.ts";
import { readModelCalls, readModelScript } from "../lib/scripted-model/script.ts";
import { assertStandInsStopped, harnessDirectory } from "../lib/turn-records.ts";

import { currentRun } from "./pi-process.ts";

import type { RpcProfileEnvironment } from "../../test/e2e/_rpc.ts";
import type { CompanionName } from "../lib/companions.ts";
import type { GitPluginRepository } from "../lib/git-plugin.ts";
import type { GitHostTraffic, HttpsGitHost, RequestWindow } from "../lib/https-git-host/server.ts";
import type { McpImplementation, McpProfile } from "../lib/mcp-implementation.ts";
import type { NpmRegistryRequest } from "../lib/npm-registry.ts";
import type { NotificationPayload, OfferedSkill, SessionReport } from "../lib/pi-commands.ts";
import type { RpcGitEnvironment, RpcRecord, RpcRequest, RpcSandbox } from "../lib/pi-process.ts";
import type { RegistrySnapshot } from "../lib/pi-registry-probe/snapshot.ts";
import type { PiTuiOptions } from "../lib/pi-tui.ts";
import type { PluginCompletion } from "../lib/plugin-completions.ts";
import type { PublicationSites, PublishedMarketplace } from "../lib/published-marketplace.ts";
import type { RunTokens } from "../lib/run-tokens.ts";
import type { ScriptStep } from "../lib/scripted-model/script.ts";

// Starting Pi takes most of a second and a command a tenth of that; the
// margin covers a loaded CI runner.
const STEP_TIMEOUT_MS = 30_000;

setDefaultTimeout(STEP_TIMEOUT_MS);

/**
 * The timeout of a step that starts a profile Pi. Each worker compiles the
 * real extension, the scripted model, the registry probe, and the companions
 * through a cold jiti cache on its first profile Pi: 13 to 20 seconds on an
 * idle machine, and 27 seconds or more when the parallel workers start their
 * profile Pis at once on a loaded runner. A Pi that never answers still fails
 * the step.
 */
export const PROFILE_PI_START_TIMEOUT_MS = 90_000;

// pi-mcp-adapter writes its onboarding file within a second of its
// `session_start`; the margin covers a loaded CI runner.
const ADAPTER_ONBOARDING_TIMEOUT_MS = 10_000;

// The scripted model, which every profile Pi loads right after the real extension.
const SCRIPTED_MODEL_EXTENSION = fileURLToPath(
  new URL("../lib/scripted-model/extension.ts", import.meta.url),
);

// The profile Pi selects the scripted model over RPC; a terminal Pi selects it
// on its command line.
const SCRIPTED_MODEL_ARGUMENTS = ["--provider", "faux", "--model", "faux-1"];

// D-CF2-12: with the scripted model selected, a terminal Pi never prints its
// default readiness text. Pi lists its loaded resources, ending with
// `[Extensions]`, only after the extensions' `session_start` handlers ran and
// its autocomplete was set up, so a completion exists before the first
// keystroke.
const SCRIPTED_TUI_READY_TEXT = "[Extensions]";

// The profile Pi already compiled every extension into the shared jiti cache,
// so a terminal Pi with the scripted model starts in seconds; a minute covers
// a slow worker.
const SCRIPTED_TUI_READY_MS = 60_000;

/** The bytes of a scope's base config and installation record. */
export interface ScopeBytes {
  readonly config: Buffer;
  readonly state: Buffer;
}

/**
 * What a scenario's profile Pi loads and trusts (D-CF1-15). It always loads
 * the real extension, the scripted model, and the registry probe, then
 * `companions` in the fixed order pi-subagents, pi-mcp-adapter, pi-dynamic-workflows (HAR-01), then
 * `extraExtensions` in order. It trusts the sandbox project unless `trust` is
 * `untrusted` (D-CF1-07).
 */
export interface PiProfile {
  readonly companions: readonly CompanionName[];
  readonly extraExtensions?: readonly string[];
  readonly trust?: "trusted" | "untrusted";
  /**
   * The profile Pi's spawn environment carries `PI_SUBAGENT_CHILD=1`, as
   * pi-subagents' runner sets it before any extension of a background child
   * loads, so the product's child gates and pi-subagents both see a real
   * child (D-BG-10, D-MB-12).
   */
  readonly subagentChild?: true;
  /**
   * The profile Pi starts with the run's git environment minus
   * `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, and a terminal session the
   * scenario starts afterwards gets the same environment and loads the same
   * `extraExtensions` (D-BG-01). `usePiWithProfile()` refuses it when
   * `extraExtensions` is empty, because such a Pi would reach GitHub's real
   * address with no extension to keep its requests on this machine.
   */
  readonly withoutGitHubBaseOverride?: true;
}

/**
 * How a restart step changes the launch of the scenario's profile Pi:
 * `without-adapter` removes pi-mcp-adapter from its companions, and
 * `with-adapter` adds it; `builtin-on` removes `-builtin:mcp` from the user's
 * Pi settings and keeps the companions; `no-mcp` removes pi-mcp-adapter and
 * starts Pi with `--no-mcp`; `after-crash` starts the same launch again after
 * `crashPi()` killed the profile Pi (ASYNC-04).
 */
export type PiRestart =
  "without-adapter" | "with-adapter" | "builtin-on" | "no-mcp" | "after-crash";

/** What a one-shot Pi in the run's sandbox starts with (D-BG-09). */
export interface OneShotPiLaunch {
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  readonly environment: RpcProfileEnvironment;
}

// What a profile Pi starts with: its profile and whether it starts with `--no-mcp`.
interface ProfileLaunch extends PiProfile {
  readonly noMcp?: true;
}

/**
 * One model turn: the prompt as sent, the disposition Pi reported for it,
 * every record Pi printed from the prompt to `agent_settled`, in Pi's order,
 * and the lines each stand-in log in the harness directory gained during the
 * turn, by file name (HAR-03).
 */
export interface ModelTurn {
  readonly prompt: string;
  readonly disposition: string;
  readonly records: readonly RpcRecord[];
  readonly logs: ReadonlyMap<string, readonly unknown[]>;
}

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
  // A TUI message may produce background notices; its assertion compares the complete set.
  uncomparedTuiNotices = false;
  backgroundForegroundWaitMs: number | undefined = undefined;
  backgroundRequestWindow: RequestWindow | undefined = undefined;
  // The scope bytes the config steps remembered, by scope.
  readonly rememberedScopeBytes = new Map<string, ScopeBytes>();
  private readonly completionSets = new Map<string, readonly PluginCompletion[]>();
  private readonly uncomparedCompletionSets = new Set<string>();
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
  // The harness directory of this scenario's profile Pi, once one started.
  private profileHarnessDirectory: string | undefined = undefined;
  // The last report of the registry probe that a `When` step read from the
  // profile Pi: its tools and its slash commands (HAR-04).
  registrySnapshot: RegistrySnapshot | undefined = undefined;
  // What this scenario's profile Pi launched with, once one started; a restart
  // changes it.
  private profileLaunch: ProfileLaunch | undefined = undefined;
  // Whether the scenario carries `@own-implementation`, so it chooses its own
  // MCP implementation; the `Before()` hook in `support/mcp-implementation.ts`
  // sets it.
  ownImplementation = false;
  private lastTurn: ModelTurn | undefined = undefined;
  // Whether a step has compared `lastTurn`; a scenario with no turn has nothing to compare.
  private lastTurnCompared = true;
  private tuiSession: PiTuiSession | undefined = undefined;
  private tuiEnvironment: RpcGitEnvironment | undefined = undefined;
  private readonly tuiVariables: Record<string, string> = {};
  // The extensions the TUI session loads before the scripted model's: the
  // `extraExtensions` of a profile Pi that runs without the GitHub base
  // override, so the terminal session keeps its requests local too (D-BG-01).
  private tuiExtensions: readonly string[] = [];
  // Whether `crashPi()` killed the profile Pi and no restart has replaced it.
  private profilePiCrashed = false;

  /**
   * The Pi the steps talk to: the one this scenario started with
   * `usePiWithGitHubBaseUrl()`, `usePiWithBackgroundUpdateDelay()`, or
   * `usePiWithProfile()`, or else the run's Pi, which the `Before()` hook has
   * reset for this scenario.
   */
  get pi(): PiProcess {
    return this.scenarioPi ?? currentRun().pi;
  }

  /**
   * The MCP implementation that the Pi the steps talk to runs now, read from
   * its command list by the extension's own rule (MSEL-01, DUAL-02).
   */
  async runningMcpImplementation(): Promise<McpImplementation> {
    const { response } = await this.pi.request({ type: "get_commands" });
    return classifyMcpImplementation(listedCommands(response));
  }

  /**
   * The cucumber profile of the run, which names the MCP implementation that
   * its shared Pi runs (DUAL-01). Fails on any other value of the world
   * parameter `mcpImplementation`.
   */
  get mcpProfile(): McpProfile {
    const parameters: unknown = this.parameters;
    const value =
      typeof parameters === "object" && parameters !== null && "mcpImplementation" in parameters
        ? parameters.mcpImplementation
        : undefined;
    return parseMcpProfile(value);
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
    const environment = {
      ...currentRun().piEnvironment,
      PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: value,
    } satisfies RpcGitEnvironment;
    this.tuiEnvironment = environment;
    await this.usePiWith(environment);
  }

  /**
   * Starts this scenario's profile Pi (D-CF1-15) and makes it the Pi the
   * steps talk to until the scenario's release stops it with its process
   * group. A scenario that needs a model must not change the run's shared Pi,
   * which every other scenario reuses, so it gets a Pi of its own in the
   * run's sandbox, with the run's git environment. The profile Pi loads the
   * real extension, the scripted model, the registry probe (HAR-01), the
   * companions the profile names, each from its `pi.extensions` entry in the
   * optional peer cache, and then `profile.extraExtensions`. Its `TMPDIR` and its harness directory lie inside the sandbox home, which
   * the next scenario's `Before()` empties (HAR-05). It trusts the sandbox
   * project through a `trust.json` entry, as Pi records a user's answer to
   * its trust prompt, unless the profile is untrusted (D-CF1-07). It runs the
   * scripted model, with auto retry off, so a call past the script fails at
   * once. The start fails when the Pi does not run the MCP implementation its
   * launch implies (DUAL-02). One scenario starts at most one profile Pi; only
   * `restartPi()` replaces it. The harness directory may already exist, as
   * when a stand-in step wrote its log there before the start.
   */
  async usePiWithProfile(profile: PiProfile): Promise<void> {
    if (this.profileHarnessDirectory !== undefined) {
      throw new Error("a profile Pi already started in this scenario");
    }

    if (profile.withoutGitHubBaseOverride === true) {
      this.keepTerminalSessionLocal(profile);
    }

    const harness = harnessDirectory(currentRun().sandbox.home);
    await mkdir(harness, { recursive: true });
    await this.prepareTemporaryDirectory();
    if (profile.trust !== "untrusted") {
      await this.trustSandboxProject();
    }

    this.profileHarnessDirectory = harness;
    await this.startProfilePi(profile);
  }

  /**
   * Prepares `{home}/tmp` with its compile-cache link and returns what a
   * one-shot Pi in the run's sandbox starts with: the run's sandbox, the
   * run's git environment, and that `TMPDIR` (D-BG-09). A step that starts a
   * one-shot Pi, such as one in json mode, reads it here, so no step module
   * reaches the run's state.
   */
  async oneShotPiLaunch(): Promise<OneShotPiLaunch> {
    const { sandbox, piEnvironment } = currentRun();
    const temporary = await this.prepareTemporaryDirectory();
    return { sandbox, git: piEnvironment, environment: { TMPDIR: temporary } };
  }

  /**
   * Kills this scenario's profile Pi as a Pi that dies does, leaving the rest
   * of its process group running (ASYNC-04). The crashed Pi stays the Pi the
   * steps talk to until `restartPi("after-crash")` replaces it. Fails when no
   * profile Pi of this scenario is running.
   */
  async crashPi(): Promise<void> {
    if (this.profileLaunch === undefined || this.profilePiCrashed) {
      assert.fail("no profile Pi of this scenario is running");
    }

    await this.pi.crash();
    this.profilePiCrashed = true;
  }

  /**
   * Adds `-builtin:mcp` to the `extensions` of the sandbox user's Pi
   * settings, as pi-mcp-adapter or a user does, before any profile Pi starts,
   * since Pi reads its settings when it starts. Fails once a profile Pi has
   * started.
   */
  async turnOffBuiltinMcpBeforeStart(): Promise<void> {
    if (this.profileHarnessDirectory !== undefined) {
      throw new Error("a profile Pi already started in this scenario");
    }

    const { agentDir } = currentRun().sandbox;
    await turnOffBuiltinMcp(agentDir);
    this.onRelease(() => rm(path.join(agentDir, "settings.json"), { force: true }));
  }

  /**
   * Stops this scenario's profile Pi, asserts that its stand-ins stopped, and
   * starts another with the launch that `restart` changes, in the same
   * sandbox, so the trust entry, the script, and the installed plugins stay.
   * When the stopped Pi loaded pi-mcp-adapter, it first waits until the
   * adapter's onboarding file records its version, so the `-builtin:mcp`
   * entry the adapter writes is on disk, as after a real removal. A
   * `builtin-on` restart removes that entry from the user's Pi settings
   * between the two Pis, as a user does (P1-DC-08). Returns what the new Pi's
   * first session offers and reports. Fails when no profile Pi started, or
   * when the new Pi does not run the MCP implementation its launch implies
   * (DUAL-02). An `after-crash` restart fails unless `crashPi()` ran, and it
   * skips the onboarding wait and the stand-in check: the dead Pi's hook
   * processes may outlive it until the new Pi's load stops them, and the
   * first profile Pi's release still checks its stand-ins when the scenario
   * ends (ASYNC-04).
   */
  async restartPi(restart: PiRestart): Promise<SessionReport> {
    const launch = this.profileLaunch;
    if (launch === undefined) {
      assert.fail("no profile Pi of this scenario is running");
    }

    if (restart === "after-crash") {
      assert.strictEqual(this.profilePiCrashed, true, "no step crashed the profile Pi");
      this.profilePiCrashed = false;
    } else {
      await this.stopProfilePiForRestart(launch, restart);
    }

    await this.startProfilePi(restartedLaunch(launch, restart));
    return readSession(this.pi);
  }

  /** Whether a profile Pi started in this scenario, so a step that must precede it can refuse. */
  get profilePiStarted(): boolean {
    return this.profileHarnessDirectory !== undefined;
  }

  /**
   * Returns the harness directory of this scenario's profile Pi, where the
   * scripted model reads its script and the stand-ins keep their logs.
   * Fails when no profile Pi started.
   */
  profileHarness(): string {
    if (this.profileHarnessDirectory === undefined) {
      assert.fail("no step started a profile Pi in this scenario");
    }

    return this.profileHarnessDirectory;
  }

  /**
   * Keeps `turn` as the last model turn, after asserting that a step compared
   * the previous one, so no turn goes unchecked.
   */
  recordTurn(turn: ModelTurn): void {
    assert.strictEqual(this.lastTurnCompared, true, "no step compared the previous model turn");
    this.lastTurn = turn;
    this.lastTurnCompared = false;
  }

  /** Returns the last model turn, failing when no step ran one. */
  requireTurn(): ModelTurn {
    if (this.lastTurn === undefined) {
      assert.fail("no model turn has run in this scenario");
    }

    return this.lastTurn;
  }

  /** Records that a step compared the last model turn. */
  markTurnCompared(): void {
    this.lastTurnCompared = true;
  }

  /** Whether a model turn ran that no step compared. */
  get lastTurnUncompared(): boolean {
    return !this.lastTurnCompared;
  }

  /**
   * Returns the steps of the model script that no model call took, in script
   * order, or none when no profile Pi started (D-CF1-17). A call past the
   * script takes no step.
   */
  async unusedScriptSteps(): Promise<readonly ScriptStep[]> {
    const harness = this.profileHarnessDirectory;
    if (harness === undefined) {
      return [];
    }

    const [script, calls] = await Promise.all([readModelScript(harness), readModelCalls(harness)]);
    return script.slice(calls.filter((call) => !call.overflow).length);
  }

  /** Adds a variable to the environment of the TUI session this scenario starts. */
  setTuiVariable(name: string, value: string): void {
    if (this.tuiSession !== undefined) {
      throw new Error("the TUI session already started in this scenario");
    }

    this.tuiVariables[name] = value;
  }

  /**
   * Starts one contained production TUI and registers its release before
   * waiting for readiness. With `model` set to `scripted`, the TUI also loads
   * and selects the scripted model beside this scenario's profile Pi: it plays
   * the profile Pi's script from the same harness directory, and its `TMPDIR`
   * reuses the profile Pi's compile cache. That fails when no profile Pi
   * started.
   */
  async startTuiSession(model: "none" | "scripted" = "none"): Promise<PiTuiSession> {
    if (this.tuiSession !== undefined) {
      throw new Error("a TUI session already started in this scenario");
    }

    const run = currentRun();
    const scripted = model === "scripted" ? this.scriptedModelTuiOptions() : {};
    const tui = await PiTuiSession.start({
      sandbox: run.sandbox,
      git: this.tuiEnvironment ?? run.piEnvironment,
      variables: this.tuiVariables,
      ...scripted,
      extensions: [...this.tuiExtensions, ...(scripted.extensions ?? [])],
    });
    this.onRelease(() => tui.stop());
    this.tuiSession = tui;
    await tui.waitUntilReady(model === "scripted" ? SCRIPTED_TUI_READY_MS : undefined);
    return tui;
  }

  /** Returns the contained TUI this scenario started. */
  requireTuiSession(): PiTuiSession {
    if (this.tuiSession === undefined) {
      throw new Error("no TUI session started in this scenario");
    }

    return this.tuiSession;
  }

  /** Marks that a TUI message may have produced notices that a Then step must compare. */
  expectTuiNotices(): void {
    assert.strictEqual(this.uncomparedTuiNotices, false, "TUI notices are already uncompared");
    this.uncomparedTuiNotices = true;
  }

  /** Marks the complete TUI notice set compared. */
  markTuiNoticesCompared(): void {
    this.uncomparedTuiNotices = false;
  }

  /** Records the complete registered-provider completion set for `prefix`. */
  recordCompletions(prefix: string, completions: readonly PluginCompletion[]): void {
    assert.strictEqual(
      this.completionSets.has(prefix),
      false,
      `${prefix} completions already exist`,
    );
    this.completionSets.set(prefix, completions);
    this.uncomparedCompletionSets.add(prefix);
  }

  /** Returns the complete completion set recorded for `prefix`. */
  completionsFor(prefix: string): readonly PluginCompletion[] {
    const completions = this.completionSets.get(prefix);
    if (completions === undefined) {
      throw new Error(`no plugin completions were requested for ${prefix}`);
    }

    return completions;
  }

  /** Marks the completion set for `prefix` compared by a Then step. */
  markCompletionsCompared(prefix: string): void {
    assert.strictEqual(
      this.uncomparedCompletionSets.delete(prefix),
      true,
      `${prefix} completions were not awaiting comparison`,
    );
  }

  /** Returns every completion prefix still awaiting a complete-set comparison. */
  completionSetsAwaitingComparison(): readonly string[] {
    return [...this.uncomparedCompletionSets];
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

  // Asserts that `request` succeeded on the Pi the steps talk to.
  private async expectSuccess(request: RpcRequest): Promise<void> {
    const { response } = await this.pi.request(request);
    assert.deepStrictEqual(
      { command: response.command, success: response.success },
      { command: request.type, success: true },
      JSON.stringify(response),
    );
  }

  // Writes the `trust.json` entry Pi saves when a user trusts the sandbox
  // project, in Pi's format: sorted keys, two-space JSON, and a trailing
  // newline. Pi keys the entry by the project's realpath (D-CF1-07).
  private async trustSandboxProject(): Promise<void> {
    const { sandbox } = currentRun();
    const file = path.join(sandbox.agentDir, "trust.json");
    const text = `${JSON.stringify({ [await realpath(sandbox.cwd)]: true }, null, 2)}\n`;
    await writeFile(file, text, { flag: "wx" });
    assert.strictEqual(await readFile(file, "utf8"), text);
  }

  // What a TUI adds to run the scripted model: the model's extension, its
  // selection, the readiness text Pi then prints, and the temporary directory
  // of the profile Pi, whose harness the model reads.
  private scriptedModelTuiOptions(): Pick<
    PiTuiOptions,
    "variables" | "extensions" | "arguments" | "readyText"
  > {
    this.profileHarness();
    return {
      variables: { ...this.tuiVariables, TMPDIR: path.join(currentRun().sandbox.home, "tmp") },
      extensions: [SCRIPTED_MODEL_EXTENSION],
      arguments: SCRIPTED_MODEL_ARGUMENTS,
      readyText: SCRIPTED_TUI_READY_TEXT,
    };
  }

  // Gives a later TUI session the environment and extensions of a profile Pi
  // that runs without the GitHub base override, and refuses such a profile
  // with no extension to keep its requests local (D-BG-01).
  private keepTerminalSessionLocal(profile: PiProfile): void {
    const extensions = profile.extraExtensions ?? [];
    if (extensions.length === 0) {
      throw new Error(
        "a profile Pi without the GitHub base override needs an extension that keeps its requests local",
      );
    }

    this.tuiEnvironment = profileGitEnvironment(profile);
    this.tuiExtensions = extensions;
  }

  // Creates `{home}/tmp` and its compile-cache link when they are absent, and
  // returns the directory. Pi compiles each TypeScript extension through
  // jiti, which caches the output under `$TMPDIR/jiti`. A cold cache costs ten
  // seconds or more per start, and `Before()` empties the sandbox home, so the
  // cache directory links to one under the run's root, which lasts the whole
  // run. It holds compiled copies of repository and peer sources only.
  private async prepareTemporaryDirectory(): Promise<string> {
    const { root, sandbox } = currentRun();
    const temporary = path.join(sandbox.home, "tmp");
    const compileCache = path.join(root, "jiti-cache");
    const link = path.join(temporary, "jiti");
    await mkdir(temporary, { recursive: true });
    await mkdir(compileCache, { recursive: true });
    const linked = await lstat(link).then(
      () => true,
      () => false,
    );
    if (!linked) {
      await symlink(compileCache, link);
    }

    return temporary;
  }

  // Waits for pi-mcp-adapter's onboarding write when the profile Pi loaded
  // it, stops the profile Pi, asserts that its stand-ins stopped, and turns
  // Pi's built-in MCP back on for a `builtin-on` restart (P1-DC-08).
  private async stopProfilePiForRestart(launch: ProfileLaunch, restart: PiRestart): Promise<void> {
    const harness = this.profileHarness();
    const { agentDir } = currentRun().sandbox;
    if (launch.companions.includes("pi-mcp-adapter")) {
      const { version } = await resolveCompanion("pi-mcp-adapter");
      await waitForAdapterOnboarding(agentDir, version, ADAPTER_ONBOARDING_TIMEOUT_MS);
    }

    await this.pi.stop();
    await assertStandInsStopped(harness);
    if (restart === "builtin-on") {
      await turnOnBuiltinMcp(agentDir);
    }
  }

  // Starts a Pi in the run's sandbox with `environment`, stops it with the
  // scenario, and makes it the Pi the steps talk to.
  private async usePiWith(environment: RpcGitEnvironment): Promise<void> {
    const pi = await PiProcess.start(currentRun().sandbox, environment);
    this.onRelease(() => pi.stop());
    this.scenarioPi = pi;
  }

  // Starts a profile Pi with `launch` in the sandbox that `usePiWithProfile()`
  // prepared, makes it the Pi the steps talk to, selects the scripted model,
  // and fails unless the Pi runs the MCP implementation that `launch` implies.
  private async startProfilePi(launch: ProfileLaunch): Promise<void> {
    const { sandbox } = currentRun();
    const harness = harnessDirectory(sandbox.home);
    const adapterLoaded = launch.companions.includes("pi-mcp-adapter");
    if (adapterLoaded && this.ownImplementation) {
      // Without the harness seed, the adapter makes its real first-run write.
      const { version } = await resolveCompanion("pi-mcp-adapter");
      await removeAdapterOnboardingSeed(sandbox.agentDir, version);
    }

    const expected = expectedMcpImplementation({
      adapterLoaded,
      noMcp: launch.noMcp === true,
      builtinTurnedOff: await readBuiltinTurnedOff(sandbox.agentDir, sandbox.cwd),
    });
    const companions = await Promise.all(
      inLoadOrder(launch.companions).map((name) => resolveCompanion(name)),
    );
    const pi = await PiProcess.start(sandbox, profileGitEnvironment(launch), {
      extensions: [
        SCRIPTED_MODEL_EXTENSION,
        REGISTRY_PROBE_EXTENSION,
        ...companions.map((companion) => companion.entry),
        ...(launch.extraExtensions ?? []),
      ],
      environment: {
        TMPDIR: path.join(sandbox.home, "tmp"),
        ...(launch.subagentChild === true ? { PI_SUBAGENT_CHILD: "1" } : {}),
      },
      ...(launch.noMcp === true ? { noMcp: true } : {}),
    });
    // HAR-05: the profile Pi stops first, so a stand-in that exits when its
    // stdin closes has exited before its pid file is checked.
    this.onRelease(async () => {
      await pi.stop();
      await assertStandInsStopped(harness);
    });
    this.scenarioPi = pi;
    this.profileLaunch = launch;
    await this.expectSuccess({ type: "set_model", provider: "faux", modelId: "faux-1" });
    await this.expectSuccess({ type: "set_auto_retry", enabled: false });
    // Pi answers a request only after its startup, so the listing holds a
    // command that an extension registers late in startup.
    const actual = await this.runningMcpImplementation();
    assert.strictEqual(
      actual,
      expected,
      `the profile Pi runs the MCP implementation ${actual}, but its launch implies ${expected}`,
    );
  }
}

// The run's git environment for a profile Pi, without the GitHub base
// override when the profile asks for that (D-BG-01).
function profileGitEnvironment(profile: PiProfile): RpcGitEnvironment {
  const { piEnvironment } = currentRun();
  if (profile.withoutGitHubBaseOverride !== true) {
    return piEnvironment;
  }

  const { PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: _override, ...environment } = piEnvironment;
  return environment;
}

// The launch of a profile Pi after `restart` changes `launch`.
function restartedLaunch(launch: ProfileLaunch, restart: PiRestart): ProfileLaunch {
  const withoutAdapter = launch.companions.filter((name) => name !== "pi-mcp-adapter");
  switch (restart) {
    case "without-adapter":
      return { ...launch, companions: withoutAdapter };
    case "with-adapter":
      return { ...launch, companions: [...withoutAdapter, "pi-mcp-adapter"] };
    case "builtin-on":
    case "after-crash":
      return launch;
    case "no-mcp":
      return { ...launch, companions: withoutAdapter, noMcp: true };
  }
}

setWorldConstructor(ScenarioWorld);

After(async function (this: ScenarioWorld, { result }: ITestCaseHookParameter): Promise<void> {
  const uncompared = this.uncomparedRows;
  const uncomparedNotices = this.uncomparedNotices;
  const uncomparedSessionResults = this.uncomparedSessionResults;
  const uncomparedTuiNotices = this.uncomparedTuiNotices;
  const uncomparedCompletionSets = this.completionSetsAwaitingComparison();
  // Read before the releases stop the profile Pi; a scenario with no profile
  // Pi has no script and no turn. The releases run even when the read fails.
  const lastTurnUncompared = this.lastTurnUncompared;
  let unusedScriptSteps: readonly ScriptStep[];
  try {
    unusedScriptSteps = await this.unusedScriptSteps();
  } finally {
    await this.release();
  }

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
    assert.strictEqual(uncomparedTuiNotices, false, "no step compared the TUI notice set");
    assert.deepStrictEqual(
      uncomparedCompletionSets,
      [],
      "no step compared these plugin completion sets",
    );
    assert.deepStrictEqual(
      unusedScriptSteps,
      [],
      "no model call used these steps of the model script",
    );
    assert.strictEqual(lastTurnUncompared, false, "no step compared the last model turn");
  }
});

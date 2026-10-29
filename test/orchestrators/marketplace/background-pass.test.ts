// Owner suite for `orchestrators/marketplace/background-pass.ts`: which
// marketplaces one background pass updates, the silent run it updates them
// through, how it yields to `/claude:plugin` commands, and how it stops.
//
// Each case seeds real install records and config files in a hermetic Pi
// environment and runs a real gate. `updateMarketplace` and the plugin update
// runner are recording doubles except in the real-cascade dependency cases,
// so this suite owns only what the pass hands them and when. The context the
// pass receives refuses every UI read, so any output that leaks to the session
// fails the case. The `pi` double's entry sink records the one notice a pass
// that updated plugins raises in json and rpc mode. The git abort scope is a
// recording double that tracks which step signal is active, and the cases
// that reach the wait cap drive the real gate with Node's mock timers.

import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createBackgroundGate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts";
import { createBackgroundPass } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts";
import { updateMarketplace } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { InvalidGitHubBaseUrlError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { withExistingScopeLock } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";
import {
  mergeMarketplaceIntoState,
  seedAutoupdateConfig,
} from "../../edge/handlers/marketplace-seed.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { emptyPiInventory } from "../../platform/pi-inventory-seed.ts";

import type { BackgroundGate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts";
import type {
  BackgroundContext,
  BackgroundPassDeps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts";
import type { UpdateMarketplaceOptions } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateFn,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
  PluginUpdateUnchangedOutcome,
  PluginUpdateUpdatedOutcome,
  ScopeDependencyInstallFn,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type {
  NotificationContext,
  NotificationUi,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  NotificationEntrySink,
  NotificationRun,
} from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type MarketplaceScript = (opts: UpdateMarketplaceOptions) => Promise<void>;

interface PluginUpdateNotification {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
}

interface PassUnderTest {
  readonly gate: BackgroundGate;
  readonly calls: UpdateMarketplaceOptions[];
  /** The signal each `runWithAbortSignal` call received, in call order. */
  readonly scopes: AbortSignal[];
  readonly notifications: PluginUpdateNotification[];
  readonly capture: ReturnType<typeof createJsonCapture>;
  readonly deps: BackgroundPassDeps;
}

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => {
    throw new Error("the deferred promise was not created");
  };

  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function unchangedOutcome(name: string): PluginUpdateUnchangedOutcome {
  return {
    partition: "unchanged",
    name,
    fromVersion: "1.0.0",
    toVersion: "1.0.0",
    constraint: undefined,
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

function updatedOutcome(name: string, toVersion: string): PluginUpdateUpdatedOutcome {
  return {
    partition: "updated",
    name,
    fromVersion: "1.0.0",
    toVersion,
    constraint: undefined,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    resourcesChanged: true,
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

function skippedOutcome(name: string): PluginUpdateSkippedOutcome {
  return {
    partition: "skipped",
    name,
    notes: [],
    reasons: ["not installed"],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

/** A missing-dependency step the doubled `updateMarketplace` never runs. */
const missingDependencyStep: ScopeDependencyInstallFn = () =>
  Promise.resolve({ rows: [], mcpConfigNotices: [] });

function failedOutcome(name: string): PluginUpdateFailedOutcome {
  return {
    partition: "failed",
    name,
    notes: [],
    reasons: ["lock held"],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

/**
 * A pass over recording doubles. Each marketplace's update runs its script, if
 * any; each plugin update runs its hook, if any, then logs `update <plugin>`
 * and returns the plugin's scripted outcome, or `unchanged`. The `pi` entry
 * sink is `appendEntry` when given, or a JSON capture.
 */
function createPassUnderTest(options: {
  readonly log?: string[];
  readonly scripts?: ReadonlyMap<string, MarketplaceScript>;
  readonly pluginHooks?: ReadonlyMap<string, () => void>;
  readonly outcomes?: ReadonlyMap<string, PluginUpdateOutcome>;
  readonly appendEntry?: NotificationEntrySink["appendEntry"];
  readonly gate?: BackgroundGate;
  readonly activeScopes?: Map<string, AbortSignal | undefined>;
}): PassUnderTest {
  const log = options.log ?? [];
  const gate = options.gate ?? createBackgroundGate();
  const calls: UpdateMarketplaceOptions[] = [];
  const notifications: PluginUpdateNotification[] = [];
  const capture = createJsonCapture();
  const scopes: AbortSignal[] = [];
  let activeScope: AbortSignal | undefined;
  const pluginUpdate: PluginUpdateFn = (plugin) => {
    options.activeScopes?.set(plugin, activeScope);
    options.pluginHooks?.get(plugin)?.();
    log.push(`update ${plugin}`);
    return Promise.resolve(options.outcomes?.get(plugin) ?? unchangedOutcome(plugin));
  };

  const deps: BackgroundPassDeps = {
    pi: {
      ...emptyPiInventory(),
      appendEntry: options.appendEntry ?? capture.entrySink.appendEntry,
    },
    gate,
    completionCache: createCompletionCache(),
    beginPluginUpdateRun: (notification) => {
      notifications.push(notification);
      return pluginUpdate;
    },
    installMissingDependencies: missingDependencyStep,
    updateMarketplace: async (opts) => {
      calls.push(opts);
      await options.scripts?.get(opts.name)?.(opts);
    },
    runWithAbortSignal: async (signal, step) => {
      scopes.push(signal);
      const enclosing = activeScope;
      activeScope = signal;
      try {
        return await step();
      } finally {
        activeScope = enclosing;
      }
    },
  };
  return { gate, calls, scopes, notifications, capture, deps };
}

/** The `input` event's context; any UI read fails the case. */
function sessionContext(cwd: string, mode = "tui"): BackgroundContext {
  return {
    mode,
    cwd,
    get ui(): NotificationUi {
      throw new Error("the background pass must not touch the session UI");
    },
  };
}

/** Records one path-source marketplace, with an autoupdate value when given. */
async function seedMarketplace(
  cwd: string,
  scope: Scope,
  name: string,
  autoupdate?: boolean,
): Promise<void> {
  const locations = locationsFor(scope, cwd);
  const marketplaceRoot = path.join(cwd, `${name}-src`);
  await mkdir(locations.extensionRoot, { recursive: true });
  await mergeMarketplaceIntoState(locations.extensionRoot, name, {
    name,
    scope,
    source: pathSource(marketplaceRoot),
    addedFromCwd: cwd,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins: {},
  });
  if (autoupdate !== undefined) {
    await seedAutoupdateConfig(locations, name, autoupdate);
  }
}

/** A script that updates `plugins` of `marketplace` in `scope`, in order. */
function updatesPlugins(
  marketplace: string,
  scope: Scope,
  plugins: readonly string[],
): MarketplaceScript {
  return async (opts) => {
    const pluginUpdate = requirePluginUpdate(opts);
    for (const plugin of plugins) {
      await pluginUpdate(plugin, marketplace, scope);
    }
  };
}

/** Project `alpha` and user `gamma` with autoupdate on. */
async function seedTwoAutoupdateMarketplaces(cwd: string): Promise<void> {
  await seedMarketplace(cwd, "project", "alpha", true);
  await seedMarketplace(cwd, "user", "gamma", true);
}

async function seedRealCascade(cwd: string): Promise<void> {
  await seedMarketplace(cwd, "project", "alpha", true);
  const locations = locationsFor("project", cwd);
  const state = await loadState(locations.extensionRoot);
  const marketplace = state.marketplaces.alpha;
  assert.ok(marketplace);
  await mkdir(path.dirname(marketplace.manifestPath), { recursive: true });
  await writeFile(
    marketplace.manifestPath,
    JSON.stringify({
      name: "alpha",
      owner: { name: "test" },
      plugins: [{ name: "one", source: "./one" }],
    }),
  );
  await saveState(locations.extensionRoot, {
    ...state,
    marketplaces: {
      ...state.marketplaces,
      alpha: {
        ...marketplace,
        plugins: {
          one: {
            version: "1.0.0",
            resolvedSource: "./one",
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: [],
            },
          },
        },
      },
    },
  });
}

function updatedTargets(calls: readonly UpdateMarketplaceOptions[]): string[] {
  return calls.map((call) => `${call.name} [${call.scope ?? "no scope"}]`);
}

function onlyNotification(
  notifications: readonly PluginUpdateNotification[],
): PluginUpdateNotification {
  const [notification, ...others] = notifications;
  if (notification === undefined || others.length > 0) {
    throw new Error(`the pass opened ${notifications.length} plugin update runs, not one`);
  }

  return notification;
}

function requirePluginUpdate(opts: UpdateMarketplaceOptions): PluginUpdateFn {
  if (opts.pluginUpdate === undefined) {
    throw new Error("the pass gave updateMarketplace no plugin update runner");
  }

  return opts.pluginUpdate;
}

/** The cap the abort cases give the real gate; mock timers reach it with one tick. */
const WAIT_CAP_MS = 1_000;

/** A gate with the test cap whose `beginStep` records each step signal it gives. */
function recordingGate(begun: AbortSignal[]): BackgroundGate {
  const gate = createBackgroundGate(WAIT_CAP_MS);
  return {
    ...gate,
    beginStep: async () => {
      const signal = await gate.beginStep();
      begun.push(signal);
      return signal;
    },
  };
}

/** Runs an action after the plugin step's halt check, while its config read is pending. */
function actDuringPluginConfigRead(
  gate: BackgroundGate,
  action: (signal: AbortSignal) => void,
): BackgroundGate {
  let begun = 0;
  return {
    ...gate,
    beginStep: async () => {
      const signal = await gate.beginStep();
      begun += 1;
      if (begun === 2) {
        queueMicrotask(() => {
          queueMicrotask(() => {
            action(signal);
          });
        });
      }

      return signal;
    },
  };
}

/** Starts a command that waits for the step in flight past the cap, so the gate aborts the step. */
function capTheStepInFlight(t: TestContext, gate: BackgroundGate, commands: Promise<void>[]): void {
  commands.push(gate.runForeground(() => Promise.resolve()));
  t.mock.timers.tick(WAIT_CAP_MS);
}

/** Turns on the debug log and collects its lines, restoring the flag after the case. */
function observeDebugLog(t: TestContext): string[] {
  const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => {
    lines.push(String(line));
  });
  return lines;
}

test("updates each recorded marketplace whose merged autoupdate is true, project scope first", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-select-");
  await seedMarketplace(cwd, "project", "alpha", true);
  await seedMarketplace(cwd, "project", "beta", false);
  await seedMarketplace(cwd, "user", "gamma", true);
  await seedMarketplace(cwd, "user", "delta");
  const { calls, deps } = createPassUnderTest({});
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]", "gamma [user]"]);
  assert.deepStrictEqual(
    calls.map((call) => call.cwd),
    [cwd, cwd],
  );
});

test("D-PL2-10: hands each autoupdate cascade a missing-dependency step", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-dependency-step-");
  await seedMarketplace(cwd, "project", "alpha", true);
  await seedMarketplace(cwd, "user", "gamma", true);
  const { calls, deps } = createPassUnderTest({});
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(
    calls.map((call) => typeof call.installMissingDependencies),
    ["function", "function"],
  );
});

test("a real cascade skips dependency settlement after the runtime stops", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-dependencies-stopped-");
  await seedRealCascade(cwd);
  let stopped = false;
  const log: string[] = [];
  const { deps } = createPassUnderTest({
    log,
    pluginHooks: new Map([
      [
        "one",
        () => {
          stopped = true;
        },
      ],
    ]),
  });
  const pass = createBackgroundPass({
    ...deps,
    updateMarketplace,
    installMissingDependencies: () => {
      log.push("install dependencies");
      return Promise.resolve({ rows: [], mcpConfigNotices: [] });
    },
  });

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => stopped });

  // assert
  assert.deepStrictEqual(log, ["update one"]);
});

test("a real cascade skips dependency settlement after a plugin step is aborted", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-dependencies-aborted-");
  await seedRealCascade(cwd);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gate = createBackgroundGate(WAIT_CAP_MS);
  const commands: Promise<void>[] = [];
  const log: string[] = [];
  const { deps } = createPassUnderTest({
    gate,
    log,
    pluginHooks: new Map([
      [
        "one",
        () => {
          capTheStepInFlight(t, gate, commands);
        },
      ],
    ]),
  });
  const pass = createBackgroundPass({
    ...deps,
    updateMarketplace,
    installMissingDependencies: () => {
      log.push("install dependencies");
      return Promise.resolve({ rows: [], mcpConfigNotices: [] });
    },
  });

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(log, ["update one"]);
});

test("a real cascade rechecks autoupdate before settling dependencies", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-dependencies-optout-");
  await seedRealCascade(cwd);
  const log: string[] = [];
  const { deps } = createPassUnderTest({});
  const pass = createBackgroundPass({
    ...deps,
    updateMarketplace,
    beginPluginUpdateRun: () => async (plugin) => {
      log.push(`update ${plugin}`);
      await seedAutoupdateConfig(locationsFor("project", cwd), "alpha", false);
      return unchangedOutcome(plugin);
    },
    installMissingDependencies: () => {
      log.push("install dependencies");
      return Promise.resolve({ rows: [], mcpConfigNotices: [] });
    },
  });

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(log, ["update one"]);
});

test("a real cascade settles dependencies in a fresh gate signal's async scope", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-dependencies-signal-");
  await seedRealCascade(cwd);
  const begun: AbortSignal[] = [];
  const scope = new AsyncLocalStorage<AbortSignal>();
  const dependencyScopes: Array<AbortSignal | undefined> = [];
  const selections: boolean[] = [];
  const { deps } = createPassUnderTest({ gate: recordingGate(begun) });
  const pass = createBackgroundPass({
    ...deps,
    updateMarketplace,
    runWithAbortSignal: (signal, step) => scope.run(signal, step),
    installMissingDependencies: (request) => {
      dependencyScopes.push(scope.getStore());
      selections.push(
        request.select({ plugin: "dep", marketplace: "other", declarers: ["one@alpha"] }),
      );
      return Promise.resolve({ rows: [], mcpConfigNotices: [] });
    },
  });

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.strictEqual(begun.length, 3);
  assert.deepStrictEqual(dependencyScopes, [begun[2]]);
  assert.deepStrictEqual(selections, [true]);
});

test("foreground cancellation reaches dependency settlement and waits for the marketplace to return", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-dependencies-cancel-");
  await seedRealCascade(cwd);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gate = createBackgroundGate(WAIT_CAP_MS);
  const scope = new AsyncLocalStorage<AbortSignal>();
  const reached = deferred();
  const finish = deferred();
  const log: string[] = [];
  let dependencySignal: AbortSignal | undefined;
  const { deps } = createPassUnderTest({ gate });
  const pass = createBackgroundPass({
    ...deps,
    updateMarketplace: async (options) => {
      await updateMarketplace(options);
      log.push("marketplace settled");
    },
    runWithAbortSignal: (signal, step) => scope.run(signal, step),
    installMissingDependencies: async () => {
      dependencySignal = scope.getStore();
      reached.resolve();
      await finish.promise;
      log.push("dependencies settled");
      return { rows: [], mcpConfigNotices: [] };
    },
  });

  // act
  const passDone = pass({ ctx: sessionContext(cwd), isStopped: () => false });
  await reached.promise;
  const command = gate.runForeground(() => {
    log.push("foreground");
    return Promise.resolve();
  });
  t.mock.timers.tick(WAIT_CAP_MS);
  const aborted = dependencySignal?.aborted;
  await new Promise<void>((resolve) => setImmediate(resolve));
  const beforeSettlement = [...log];
  finish.resolve();
  await Promise.all([passDone, command]);

  // assert
  assert.strictEqual(aborted, true);
  assert.deepStrictEqual(beforeSettlement, []);
  assert.deepStrictEqual(log, ["dependencies settled", "marketplace settled", "foreground"]);
});

test("a real cascade skips dependencies when a foreground command stops the runtime between steps", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-dependencies-stop-between-");
  await seedRealCascade(cwd);
  const gate = createBackgroundGate();
  const log: string[] = [];
  let stopped = false;
  let command = Promise.resolve();
  const { deps } = createPassUnderTest({
    gate,
    log,
    pluginHooks: new Map([
      [
        "one",
        () => {
          command = gate.runForeground(() => {
            stopped = true;
            return Promise.resolve();
          });
        },
      ],
    ]),
  });
  const pass = createBackgroundPass({
    ...deps,
    updateMarketplace,
    installMissingDependencies: () => {
      log.push("install dependencies");
      return Promise.resolve({ rows: [], mcpConfigNotices: [] });
    },
  });

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => stopped });
  await command;

  // assert
  assert.deepStrictEqual(log, ["update one"]);
});

test("a held scope lock skips the real cascade cleanly and a later pass can settle dependencies", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-dependencies-scope-lock-");
  await seedRealCascade(cwd);
  const log: string[] = [];
  const { deps, gate } = createPassUnderTest({ log });
  const pass = createBackgroundPass({
    ...deps,
    updateMarketplace,
    installMissingDependencies: () => {
      log.push("install dependencies");
      return Promise.resolve({ rows: [], mcpConfigNotices: [] });
    },
  });

  // act
  await withExistingScopeLock(locationsFor("project", cwd), async () => {
    await pass({ ctx: sessionContext(cwd), isStopped: () => false });
    await gate.runForeground(() => {
      log.push("foreground after lock refusal");
      return Promise.resolve();
    });
  });
  const whileLocked = [...log];
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(whileLocked, ["foreground after lock refusal"]);
  assert.deepStrictEqual(log, [
    "foreground after lock refusal",
    "update one",
    "install dependencies",
  ]);
});

test("D-PL8-07: updates an official marketplace without a config value and skips a default-off one", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-official-");
  await seedMarketplace(cwd, "project", "claude-plugins-official");
  await seedMarketplace(cwd, "project", "knowledge-work-plugins");
  await seedMarketplace(cwd, "user", "anthropic-agent-skills");
  const { calls, deps } = createPassUnderTest({});
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(updatedTargets(calls), [
    "claude-plugins-official [project]",
    "anthropic-agent-skills [user]",
  ]);
});

test("runs every update through one silent load run", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-run-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const { calls, notifications, deps } = createPassUnderTest({});
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  const notification = onlyNotification(notifications);
  assert.strictEqual(notification.ctx.mode, "print");
  assert.deepStrictEqual(notification.run.origin, { kind: "load" });
  assert.deepStrictEqual(notification.run.softDeps, {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  });
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]", "gamma [user]"]);
  for (const call of calls) {
    assert.strictEqual(call.ctx, notification.ctx);
    assert.strictEqual(call.run, notification.run);
    assert.strictEqual(call.completionCache, deps.completionCache);
  }
});

test("routes the update's own output to the debug log only", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-silent-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const lines = observeDebugLog(t);
  const { deps } = createPassUnderTest({
    scripts: new Map([
      [
        "alpha",
        (opts: UpdateMarketplaceOptions): Promise<void> => {
          opts.ctx.ui.notify("● alpha [project] (updated)", "info");
          opts.run.entrySink.appendEntry("claude-plugin", { kind: "cascade" });
          return Promise.resolve();
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(lines, ["[autoupdate] ● alpha [project] (updated)"]);
});

test("yields to a command that arrives during the refresh before the first plugin update", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-refresh-yield-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const log: string[] = [];
  const gate = createBackgroundGate();
  const commands: Promise<void>[] = [];
  const { deps } = createPassUnderTest({
    log,
    gate,
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          log.push("refresh");
          commands.push(
            gate.runForeground(() => {
              log.push("command");
              return Promise.resolve();
            }),
          );
          await requirePluginUpdate(opts)("demo", "alpha", "project");
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(log, ["refresh", "command", "update demo"]);
});

test("a command that arrives during a plugin update waits for it", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-plugin-yield-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const log: string[] = [];
  const gate = createBackgroundGate();
  const commands: Promise<void>[] = [];
  const { deps } = createPassUnderTest({
    log,
    gate,
    pluginHooks: new Map([
      [
        "first",
        (): void => {
          commands.push(
            gate.runForeground(() => {
              log.push("command");
              return Promise.resolve();
            }),
          );
        },
      ],
    ]),
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          const pluginUpdate = requirePluginUpdate(opts);
          await pluginUpdate("first", "alpha", "project");
          await pluginUpdate("second", "alpha", "project");
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(log, ["update first", "command", "update second"]);
});

test("D-PL8-01: a command that turns autoupdate off during the pass stops the marketplace's remaining plugin updates", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-autoupdate-off-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const log: string[] = [];
  const gate = createBackgroundGate();
  const commands: Promise<void>[] = [];
  const outcomes: PluginUpdateOutcome[] = [];
  const { capture, deps } = createPassUnderTest({
    log,
    gate,
    pluginHooks: new Map([
      [
        "first",
        (): void => {
          commands.push(
            gate.runForeground(async () => {
              await seedAutoupdateConfig(locationsFor("project", cwd), "alpha", false);
              log.push("noautoupdate alpha");
            }),
          );
        },
      ],
    ]),
    outcomes: new Map([["second", updatedOutcome("second", "2.0.0")]]),
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          const pluginUpdate = requirePluginUpdate(opts);
          outcomes.push(await pluginUpdate("first", "alpha", "project"));
          outcomes.push(await pluginUpdate("second", "alpha", "project"));
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);
  const expectedOutcomes: PluginUpdateOutcome[] = [
    unchangedOutcome("first"),
    {
      partition: "failed",
      name: "second",
      notes: ["autoupdate was turned off before this update ran"],
      reasons: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
  ];

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(outcomes, expectedOutcomes);
  assert.deepStrictEqual(log, ["update first", "noautoupdate alpha"]);
  assert.deepStrictEqual(capture.entries, []);
});

test("skips a scope whose install state cannot be read", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-unreadable-");
  await seedMarketplace(cwd, "user", "gamma", true);
  const projectRoot = locationsFor("project", cwd).extensionRoot;
  await mkdir(projectRoot, { recursive: true });
  await writeFile(
    path.join(projectRoot, "state.json"),
    JSON.stringify({ schemaVersion: 99, marketplaces: {} }),
  );
  const lines = observeDebugLog(t);
  const { calls, deps } = createPassUnderTest({});
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["gamma [user]"]);
  assert.deepStrictEqual(lines, [
    "[autoupdate] background update skipped the project scope: " +
      `state.json at ${path.join(projectRoot, "state.json")} has an unsupported schema version`,
  ]);
});

test("a marketplace whose update throws does not stop the others", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-throw-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const lines = observeDebugLog(t);
  const { calls, deps } = createPassUnderTest({
    scripts: new Map([["alpha", (): Promise<void> => Promise.reject(new Error("boom"))]]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]", "gamma [user]"]);
  assert.deepStrictEqual(lines, ["[autoupdate] background update of alpha [project] failed: boom"]);
});

test("an invalid GitHub base override ends the pass", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-base-url-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const { calls, capture, deps } = createPassUnderTest({
    scripts: new Map([
      [
        "alpha",
        (): Promise<void> =>
          Promise.reject(
            new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
          ),
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act & assert
  await assert.rejects(
    pass({ ctx: sessionContext(cwd), isStopped: () => false }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidGitHubBaseUrlError);
      assert.strictEqual(error.variable, "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL");
      assert.strictEqual(error.problem, "scheme");
      return true;
    },
  );

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]"]);
  assert.deepStrictEqual(capture.entries, []);
});

test("AUP-03: a pass that an invalid GitHub base override ends still reports the plugins that moved", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-base-url-notice-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const { calls, capture, deps } = createPassUnderTest({
    scripts: new Map([
      ["alpha", updatesPlugins("alpha", "project", ["one"])],
      [
        "gamma",
        (): Promise<void> =>
          Promise.reject(
            new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
          ),
      ],
    ]),
    outcomes: new Map([["one", updatedOutcome("one", "1.1.0")]]),
  });
  const pass = createBackgroundPass(deps);

  // act & assert
  await assert.rejects(
    pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidGitHubBaseUrlError);
      assert.strictEqual(error.variable, "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL");
      assert.strictEqual(error.problem, "scheme");
      return true;
    },
  );

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]", "gamma [user]"]);
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "load" },
        kind: "background-update",
        severity: "info",
        needsReload: true,
        plugins: [
          {
            name: "one",
            marketplace: "alpha",
            scope: "project",
            fromVersion: "1.0.0",
            toVersion: "1.1.0",
          },
        ],
      },
    },
  ]);
  capture.assertValid();
});

test("D-PL8-22: a runtime stopped during an update skips the further plugin updates", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-stopped-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const log: string[] = [];
  let stopped = false;
  const outcomes: PluginUpdateOutcome[] = [];
  const { calls, deps } = createPassUnderTest({
    log,
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          stopped = true;
          outcomes.push(await requirePluginUpdate(opts)("b", "alpha", "project"));
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);
  const expectedOutcome: PluginUpdateSkippedOutcome = {
    partition: "skipped",
    name: "b",
    notes: ["the background update stopped before this update ran"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => stopped });

  // assert
  assert.deepStrictEqual(outcomes, [expectedOutcome]);
  assert.deepStrictEqual(log, []);
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]"]);
});

test("a runtime stopped during the plugin config read starts no plugin update", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-config-stop-");
  await seedMarketplace(cwd, "project", "alpha", true);
  let stopped = false;
  const gate = actDuringPluginConfigRead(createBackgroundGate(), () => {
    stopped = true;
  });
  const log: string[] = [];
  const outcomes: PluginUpdateOutcome[] = [];
  const { capture, deps } = createPassUnderTest({
    gate,
    log,
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          const pluginUpdate = requirePluginUpdate(opts);
          outcomes.push(await pluginUpdate("one", "alpha", "project"));
          outcomes.push(await pluginUpdate("two", "alpha", "project"));
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);
  const expectedOutcome: PluginUpdateSkippedOutcome = {
    partition: "skipped",
    name: "one",
    notes: ["the background update stopped before this update ran"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => stopped });

  // assert
  assert.deepStrictEqual(outcomes, [expectedOutcome, { ...expectedOutcome, name: "two" }]);
  assert.deepStrictEqual(log, []);
  assert.deepStrictEqual(capture.entries, []);
});

test("a plugin step aborted during the config read starts no update and halts later targets", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { cwd } = await createHermeticEnvironment(t, "background-pass-config-abort-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const gate = createBackgroundGate(WAIT_CAP_MS);
  const commands: Promise<void>[] = [];
  const observedGate = actDuringPluginConfigRead(gate, () => {
    capTheStepInFlight(t, gate, commands);
  });
  const log: string[] = [];
  const outcomes: PluginUpdateOutcome[] = [];
  const { capture, deps } = createPassUnderTest({
    gate: observedGate,
    log,
    outcomes: new Map([["one", updatedOutcome("one", "1.1.0")]]),
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          const pluginUpdate = requirePluginUpdate(opts);
          outcomes.push(await pluginUpdate("one", "alpha", "project"));
          outcomes.push(await pluginUpdate("two", "alpha", "project"));
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(outcomes, [
    {
      partition: "skipped",
      name: "one",
      notes: ["the update ran past the background wait cap and was stopped"],
      reasons: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
    {
      partition: "skipped",
      name: "two",
      notes: ["the background update stopped before this update ran"],
      reasons: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
  ]);
  assert.deepStrictEqual(log, []);
  assert.deepStrictEqual(capture.entries, []);
});

test("D-PL8-25: runs each marketplace refresh and each plugin update in its own step's abort scope", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-scopes-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const begun: AbortSignal[] = [];
  const activeScopes = new Map<string, AbortSignal | undefined>();
  const { scopes, deps } = createPassUnderTest({
    gate: recordingGate(begun),
    activeScopes,
    scripts: new Map([["alpha", updatesPlugins("alpha", "project", ["one", "two"])]]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.strictEqual(begun.length, 4);
  assert.deepStrictEqual(scopes, begun);
  assert.deepStrictEqual([activeScopes.get("one"), activeScopes.get("two")], [begun[1], begun[2]]);
});

test("D-PL8-25: a refresh the gate aborts at the cap ends the pass before any further step", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { cwd } = await createHermeticEnvironment(t, "background-pass-refresh-abort-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const lines = observeDebugLog(t);
  const begun: AbortSignal[] = [];
  const gate = recordingGate(begun);
  const commands: Promise<void>[] = [];
  const { calls, deps } = createPassUnderTest({
    gate,
    scripts: new Map([
      [
        "alpha",
        (): Promise<void> => {
          capTheStepInFlight(t, gate, commands);
          return Promise.resolve();
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]"]);
  assert.deepStrictEqual(
    begun.map((signal) => signal.aborted),
    [true],
  );
  assert.deepStrictEqual(lines, [
    "[autoupdate] a background step ran past the 1000 ms wait cap and was stopped",
    "[autoupdate] background update of alpha [project] was stopped at the wait cap",
  ]);
});

test("D-PL8-25: an aborted plugin update that failed is skipped, and the notice names only the plugins that moved before it", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { cwd } = await createHermeticEnvironment(t, "background-pass-plugin-abort-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const log: string[] = [];
  const begun: AbortSignal[] = [];
  const gate = recordingGate(begun);
  const commands: Promise<void>[] = [];
  const outcomes: PluginUpdateOutcome[] = [];
  const { calls, capture, deps } = createPassUnderTest({
    log,
    gate,
    pluginHooks: new Map([
      [
        "two",
        (): void => {
          capTheStepInFlight(t, gate, commands);
        },
      ],
    ]),
    outcomes: new Map<string, PluginUpdateOutcome>([
      ["one", updatedOutcome("one", "1.1.0")],
      ["two", failedOutcome("two")],
    ]),
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          const pluginUpdate = requirePluginUpdate(opts);
          for (const plugin of ["one", "two", "three"]) {
            outcomes.push(await pluginUpdate(plugin, "alpha", "project"));
          }
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(outcomes, [
    updatedOutcome("one", "1.1.0"),
    {
      partition: "skipped",
      name: "two",
      notes: ["the update ran past the background wait cap and was stopped"],
      reasons: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
    {
      partition: "skipped",
      name: "three",
      notes: ["the background update stopped before this update ran"],
      reasons: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
  ]);
  assert.deepStrictEqual(log, ["update one", "update two"]);
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]"]);
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "load" },
        kind: "background-update",
        severity: "info",
        needsReload: true,
        plugins: [
          {
            name: "one",
            marketplace: "alpha",
            scope: "project",
            fromVersion: "1.0.0",
            toVersion: "1.1.0",
          },
        ],
      },
    },
  ]);
  capture.assertValid();
});

test("D-PL8-25: an aborted plugin update that threw is skipped", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { cwd } = await createHermeticEnvironment(t, "background-pass-plugin-abort-throw-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const gate = recordingGate([]);
  const commands: Promise<void>[] = [];
  const outcomes: PluginUpdateOutcome[] = [];
  const { deps } = createPassUnderTest({
    gate,
    pluginHooks: new Map([
      [
        "one",
        (): void => {
          capTheStepInFlight(t, gate, commands);
          throw new DOMException("This operation was aborted", "AbortError");
        },
      ],
    ]),
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          outcomes.push(await requirePluginUpdate(opts)("one", "alpha", "project"));
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(outcomes, [
    {
      partition: "skipped",
      name: "one",
      notes: ["the update ran past the background wait cap and was stopped"],
      reasons: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
  ]);
});

test("D-PL8-25: an aborted plugin update that finished keeps its outcome and is named", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { cwd } = await createHermeticEnvironment(t, "background-pass-plugin-abort-done-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const gate = recordingGate([]);
  const commands: Promise<void>[] = [];
  const outcomes: PluginUpdateOutcome[] = [];
  const { capture, deps } = createPassUnderTest({
    gate,
    pluginHooks: new Map([
      [
        "one",
        (): void => {
          capTheStepInFlight(t, gate, commands);
        },
      ],
    ]),
    outcomes: new Map([["one", updatedOutcome("one", "1.1.0")]]),
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          outcomes.push(await requirePluginUpdate(opts)("one", "alpha", "project"));
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false });
  await Promise.all(commands);

  // assert
  assert.deepStrictEqual(outcomes, [updatedOutcome("one", "1.1.0")]);
  assert.deepStrictEqual(
    capture.entries.map((entry) => entry.payload),
    [
      {
        schemaVersion: 1,
        origin: { kind: "load" },
        kind: "background-update",
        severity: "info",
        needsReload: true,
        plugins: [
          {
            name: "one",
            marketplace: "alpha",
            scope: "project",
            fromVersion: "1.0.0",
            toVersion: "1.1.0",
          },
        ],
      },
    ],
  );
});

test("a plugin update that throws without an abort passes the error to the cascade", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-plugin-throw-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const failure = new Error("plugin update failed");
  const rejections: unknown[] = [];
  const { deps } = createPassUnderTest({
    pluginHooks: new Map([
      [
        "one",
        (): void => {
          throw failure;
        },
      ],
    ]),
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          await requirePluginUpdate(opts)("one", "alpha", "project").catch((error: unknown) => {
            rejections.push(error);
          });
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(rejections, [failure]);
});

test("D-PL8-15: a runtime stopped during the project scope reads nothing of the user scope", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-stopped-scope-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const userRoot = locationsFor("user", cwd).extensionRoot;
  await mkdir(userRoot, { recursive: true });
  await writeFile(
    path.join(userRoot, "state.json"),
    JSON.stringify({ schemaVersion: 99, marketplaces: {} }),
  );
  const lines = observeDebugLog(t);
  let stopped = false;
  const { calls, deps } = createPassUnderTest({
    scripts: new Map([
      [
        "alpha",
        (): Promise<void> => {
          stopped = true;
          return Promise.resolve();
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => stopped });

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["alpha [project]"]);
  assert.deepStrictEqual(lines, []);
});

test("a runtime stopped while the pass waits for a command starts no update", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-wait-stop-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const gate = createBackgroundGate();
  const waiting = deferred();
  const observedGate: BackgroundGate = {
    ...gate,
    beginStep: () => {
      waiting.resolve();
      return gate.beginStep();
    },
  };
  const { calls, deps } = createPassUnderTest({ gate: observedGate });
  const pass = createBackgroundPass(deps);
  const release = deferred();
  const command = gate.runForeground(() => release.promise);
  let stopped = false;

  // act
  const passDone = pass({ ctx: sessionContext(cwd), isStopped: () => stopped });
  await waiting.promise;
  stopped = true;
  release.resolve();
  await command;
  await passDone;

  // assert
  assert.deepStrictEqual(calls, []);
});

test("AUP-03: reports the plugins the pass updated across both scopes in one load entry", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-notice-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const { capture, deps } = createPassUnderTest({
    scripts: new Map([
      ["alpha", updatesPlugins("alpha", "project", ["one", "same"])],
      ["gamma", updatesPlugins("gamma", "user", ["two", "skip", "fail"])],
    ]),
    outcomes: new Map<string, PluginUpdateOutcome>([
      ["one", updatedOutcome("one", "1.1.0")],
      ["two", updatedOutcome("two", "2.0.0")],
      ["skip", skippedOutcome("skip")],
      ["fail", failedOutcome("fail")],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false });

  // assert
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "load" },
        kind: "background-update",
        severity: "info",
        needsReload: true,
        plugins: [
          {
            name: "one",
            marketplace: "alpha",
            scope: "project",
            fromVersion: "1.0.0",
            toVersion: "1.1.0",
          },
          {
            name: "two",
            marketplace: "gamma",
            scope: "user",
            fromVersion: "1.0.0",
            toVersion: "2.0.0",
          },
        ],
      },
    },
  ]);
  capture.assertValid();
});

test("AUP-03: a pass that updated no plugin raises no notice", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-no-notice-");
  await seedTwoAutoupdateMarketplaces(cwd);
  const { capture, deps } = createPassUnderTest({
    scripts: new Map([
      ["alpha", updatesPlugins("alpha", "project", ["same"])],
      ["gamma", updatesPlugins("gamma", "user", ["skip", "fail"])],
    ]),
    outcomes: new Map<string, PluginUpdateOutcome>([
      ["skip", skippedOutcome("skip")],
      ["fail", failedOutcome("fail")],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false });

  // assert
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

test("D-PL8-15: a runtime stopped after a plugin moved raises no notice", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-stopped-notice-");
  await seedMarketplace(cwd, "project", "alpha", true);
  let stopped = false;
  const update = updatesPlugins("alpha", "project", ["one"]);
  const { capture, deps } = createPassUnderTest({
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          await update(opts);
          stopped = true;
        },
      ],
    ]),
    outcomes: new Map([["one", updatedOutcome("one", "1.1.0")]]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => stopped });

  // assert
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

test("D-PL8-15: a notice that throws on a stale context rejects the pass", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-stale-notice-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const staleError = new Error("the session is stale");
  const { deps } = createPassUnderTest({
    scripts: new Map([["alpha", updatesPlugins("alpha", "project", ["one"])]]),
    outcomes: new Map([["one", updatedOutcome("one", "1.1.0")]]),
    appendEntry: () => {
      throw staleError;
    },
  });
  const pass = createBackgroundPass(deps);

  // act & assert
  await assert.rejects(
    pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false }),
    (error) => {
      assert.strictEqual(error, staleError);
      return true;
    },
  );
});

test("an invalid config layer turns autoupdate off for the scope, even for an official marketplace", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-invalid-config-");
  await seedMarketplace(cwd, "project", "claude-plugins-official");
  await seedMarketplace(cwd, "project", "alpha", true);
  await seedMarketplace(cwd, "user", "anthropic-agent-skills");
  await writeFile(locationsFor("project", cwd).localConfigJsonPath, "{ invalid", "utf8");
  const { calls, deps } = createPassUnderTest({});
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(updatedTargets(calls), ["anthropic-agent-skills [user]"]);
});

test("a config layer that turns invalid during the pass stops the marketplace's remaining plugin updates", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-invalid-recheck-");
  await seedMarketplace(cwd, "project", "claude-plugins-official");
  const outcomes: PluginUpdateOutcome[] = [];
  const { deps } = createPassUnderTest({
    scripts: new Map([
      [
        "claude-plugins-official",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          await writeFile(locationsFor("project", cwd).baseConfigJsonPath, "{ invalid", "utf8");
          outcomes.push(
            await requirePluginUpdate(opts)("one", "claude-plugins-official", "project"),
          );
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  await pass({ ctx: sessionContext(cwd), isStopped: () => false });

  // assert
  assert.deepStrictEqual(outcomes, [
    {
      partition: "failed",
      name: "one",
      notes: ["autoupdate was turned off before this update ran"],
      reasons: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
  ]);
});

test("a stopped runtime keeps the marketplace step until updateMarketplace returns", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-shutdown-wait-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const gate = createBackgroundGate();
  const finish = deferred();
  const reached = deferred();
  let stopped = false;
  let waiterResolved = false;
  let waiter: Promise<void> = Promise.resolve();
  const { deps } = createPassUnderTest({
    gate,
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          stopped = true;
          waiter = gate.waitForStep().then(() => {
            waiterResolved = true;
          });
          await requirePluginUpdate(opts)("one", "alpha", "project");
          reached.resolve();
          await finish.promise;
        },
      ],
    ]),
  });
  const pass = createBackgroundPass(deps);

  // act
  const passDone = pass({ ctx: sessionContext(cwd), isStopped: () => stopped });
  await reached.promise;
  await new Promise<void>((resolve) => setImmediate(resolve));
  const resolvedBeforeReturn = waiterResolved;
  finish.resolve();
  await passDone;
  await waiter;

  // assert
  assert.strictEqual(resolvedBeforeReturn, false);
  assert.strictEqual(waiterResolved, true);
});

test("a notice that throws does not replace the error that ended the pass", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "background-pass-notice-after-error-");
  await seedMarketplace(cwd, "project", "alpha", true);
  const lines = observeDebugLog(t);
  const baseUrlError = new InvalidGitHubBaseUrlError(
    "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
    "scheme",
  );
  const { deps } = createPassUnderTest({
    scripts: new Map([
      [
        "alpha",
        async (opts: UpdateMarketplaceOptions): Promise<void> => {
          await updatesPlugins("alpha", "project", ["one"])(opts);
          throw baseUrlError;
        },
      ],
    ]),
    outcomes: new Map([["one", updatedOutcome("one", "1.1.0")]]),
    appendEntry: () => {
      throw new Error("the session is stale");
    },
  });
  const pass = createBackgroundPass(deps);

  // act & assert
  await assert.rejects(
    pass({ ctx: sessionContext(cwd, "rpc"), isStopped: () => false }),
    (error) => {
      assert.strictEqual(error, baseUrlError);
      return true;
    },
  );
  assert.ok(
    lines.some((line) => line.includes("background update notice failed: the session is stale")),
  );
});

// Owner suite for `orchestrators/marketplace/background-pass.ts`: which
// marketplaces one background pass updates, the silent run it updates them
// through, how it yields to `/claude:plugin` commands, and how it stops.
//
// Each case seeds real install records and config files in a hermetic Pi
// environment and runs a real gate. `updateMarketplace` and the plugin update
// runner are recording doubles: the pass reuses their real bodies unchanged,
// so this suite owns only what the pass hands them and when. The context the
// pass receives refuses every UI read, so any output that leaks to the session
// fails the case. The `pi` double's entry sink records the one notice a pass
// that updated plugins raises in json and rpc mode.

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createBackgroundGate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts";
import { createBackgroundPass } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { InvalidGitHubBaseUrlError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
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
}): PassUnderTest {
  const log = options.log ?? [];
  const gate = options.gate ?? createBackgroundGate();
  const calls: UpdateMarketplaceOptions[] = [];
  const notifications: PluginUpdateNotification[] = [];
  const capture = createJsonCapture();
  const pluginUpdate: PluginUpdateFn = (plugin) => {
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
    updateMarketplace: async (opts) => {
      calls.push(opts);
      await options.scripts?.get(opts.name)?.(opts);
    },
  };
  return { gate, calls, notifications, capture, deps };
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

test("a runtime stopped during an update runs no further plugin update", async (t) => {
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
  const expectedOutcome: PluginUpdateFailedOutcome = {
    partition: "failed",
    name: "b",
    notes: ["the session ended before this update ran"],
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

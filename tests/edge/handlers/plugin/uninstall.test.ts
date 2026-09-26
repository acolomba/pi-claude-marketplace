// Owner for edge/handlers/plugin/uninstall.ts (MOD-09).
//
// The handler is a shim: a shared scope-target scan, a shared reference parse,
// and one workflow call. It holds no logic of its own, so everything proven here
// is either forwarding or refusal.
//
// D-116-05 (O3) places this handler in Group C: `uninstallPlugin` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as two minimal
// effects -- whether the seeded install record is still in the scope's state.json
// after the command, and whether the seeded plugin data bytes survived it (the
// only way the forwarded `keepData` option shows from outside). That
// exact-argument gap is this owner's recorded scope.
//
// Uninstall is destructive, which is why every case pairs its notification with
// that on-disk footprint. A rejection case asserting only the sentence would
// prove nothing about whether state changed; a rejection case that also reads
// both seeded records back is a direct, non-inferential proof that no
// state-changing work ran.
//
// The negative half of D-116-06 is proven in full. A rejecting case sizes the
// boundary at one emission, zero probes, and no stated working directory, then
// calls `verifyBoundary()`. The zero-probe half is a post-hoc report rather than
// a fail-fast -- `hasLoadedPiSubagents` and `hasLoadedPiMcpAdapter` each swallow
// a throw from `pi.getAllTools()` and degrade to "unloaded" -- so the call is
// mandatory and the emission count is never relied on alone. Both counts are
// measured against the module rather than inherited: a delegating case spends
// three `getAllTools()` reads and one `ctx.cwd` read, a rejecting case spends
// neither.
//
// Both scopes are seeded in every case, rejecting ones included, so a workflow
// that did run would have a record to remove. The two scope roots are
// hand-authored -- `<cwd>/.pi` for the project scope and `<home>/.pi/agent` for
// the user scope (SC-1), with PI_CODING_AGENT_DIR cleared so an ambient value
// cannot defeat the hermetic home.
//
// NFR-5 network half: `https.request` is replaced by a counting fail-fast throw
// and read back at zero in every case. That is the door the git transport uses
// (`simple-get` -> `https.request`); this repo's only `globalThis.fetch` caller
// is the device-flow credential path, which no uninstall enters. Unlike the
// sibling verbs that carry a cold git source in their fixture, NOTHING in the
// uninstall path can reach a transport at all -- the door is in the graph only
// because `orchestrators/marketplace/shared.ts`, which supplies the unstage
// cascade, also re-exports the git operations. So the zero has no positive
// control and no reachable input that moves it: it is a regression guard on
// NFR-5, and it is recorded as one rather than presented as a measurement.
//
// No exhaustiveness claim: plugin/uninstall.ts holds no switch and no
// closed-union dispatch, so a missing-arm plant has no target here. No case
// asserts the absence of direct process output (ESLint and fallow own that),
// none re-proves the scope-target scan owned by tests/edge/handlers/shared.test.ts
// or the reference parse owned by tests/edge/handlers/plugin/shared.test.ts, and
// none re-derives the uninstall workflow's own row grammar, which
// tests/orchestrators/plugin/uninstall.test.ts owns.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { asAbsolutePluginRoot } from "../../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { makeUninstallHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts";
import { createCompletionCache } from "../../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createHermeticEnvironment } from "../../../platform/hermetic-environment.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";
import {
  buildInstalledPluginRecord,
  mergeMarketplaceIntoState,
  type SeededResources,
} from "../marketplace-seed.ts";

import type { HooksRouting } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import type { HooksRuntime } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The usage block, written out here rather than read back off the handler. */
const USAGE_BLOCK =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local] [--prune]";

/**
 * The exact payload seeded under each scope's plugin data directory. Data
 * disposition is a byte contract (DATA-01 / DATA-02), so every case compares the
 * content rather than mere presence.
 */
const DATA_PAYLOAD = "session bytes\n";

/** Nothing was removed anywhere: the shape a rejected command must leave behind. */
const BOTH_RECORDS_INTACT = {
  transportCalls: 0,
  projectPlugins: ["demo"],
  projectData: DATA_PAYLOAD,
  userPlugins: ["demo"],
  userData: DATA_PAYLOAD,
};

/** The project scope lost the record and its data; the user scope survived whole. */
const PROJECT_RECORD_REMOVED = {
  transportCalls: 0,
  projectPlugins: [],
  projectData: null,
  userPlugins: ["demo"],
  userData: DATA_PAYLOAD,
};

/** The user scope lost the record and its data; the project scope survived whole. */
const USER_RECORD_REMOVED = {
  transportCalls: 0,
  projectPlugins: ["demo"],
  projectData: DATA_PAYLOAD,
  userPlugins: [],
  userData: null,
};

/** DATA-01: the project record is gone, its seeded data bytes are not. */
const PROJECT_RECORD_REMOVED_DATA_KEPT = {
  transportCalls: 0,
  projectPlugins: [],
  projectData: DATA_PAYLOAD,
  userPlugins: ["demo"],
  userData: DATA_PAYLOAD,
};

/** DATA-01 at the other scope: the user record is gone, its data bytes are not. */
const USER_RECORD_REMOVED_DATA_KEPT = {
  transportCalls: 0,
  projectPlugins: ["demo"],
  projectData: DATA_PAYLOAD,
  userPlugins: [],
  userData: DATA_PAYLOAD,
};

const PROJECT_UNINSTALLED = {
  message: "● alpha [project]\n  ○ demo v1.0.0 (uninstalled)\n\n/reload to pick up changes",
};

const USER_UNINSTALLED = {
  message: "● alpha [user]\n  ○ demo v1.0.0 (uninstalled)\n\n/reload to pick up changes",
};

// WR-06 / DATA-01: the preserving disposition's row. The `{data kept}` brace is
// the only byte that separates a preserved uninstall from a destructive one, so
// the keep-data cases assert THIS row rather than the bare one -- a flag that
// stopped reaching the orchestrator would otherwise still look right here.
const PROJECT_UNINSTALLED_DATA_KEPT = {
  message:
    "● alpha [project]\n  ○ demo v1.0.0 (uninstalled) {data kept}\n\n/reload to pick up changes",
};

const USER_UNINSTALLED_DATA_KEPT = {
  message:
    "● alpha [user]\n  ○ demo v1.0.0 (uninstalled) {data kept}\n\n/reload to pick up changes",
};

const PROJECT_OVERRIDE_REJECTED = {
  message:
    'A plugin operation has failed.\n\n● alpha [project]\n  ⊘ demo (failed) {invalid manifest}\n    cause: Config file "claude-plugins.local.json" failed schema validation.',
  severity: "error",
};

const USER_OVERRIDE_REJECTED = {
  message:
    'A plugin operation has failed.\n\n● alpha [user]\n  ⊘ demo (failed) {invalid manifest}\n    cause: Config file "claude-plugins.local.json" failed schema validation.',
  severity: "error",
};

/** Construct one isolated registered-handler routing owner per test case. */
function makeHandlerUnderTest(
  pi: Parameters<typeof makeUninstallHandler>[0],
): ReturnType<typeof makeUninstallHandler> {
  return makeUninstallHandler(
    pi,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

/** Populate a real lifecycle owner with one observable hook route. */
async function populateRuntimeRoute(
  workspace: HermeticWorkspace,
  runtime: HooksRuntime,
  plugin: string,
  command: string,
): Promise<HooksRouting> {
  const pluginRoot = path.join(workspace.cwd, "runtime-routes", `${plugin}-${command}`);
  const hooksJsonPath = path.join(pluginRoot, "hooks.json");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ hooks: [{ command, type: "command" }], matcher: "" }],
    }),
    "utf8",
  );
  const hooksRouting = createHooksRouting(runtime, { readHooksJson });
  await hooksRouting.readAndCachePluginHooks({
    cwd: workspace.cwd,
    hooksJsonPath,
    logPrefix: "uninstall-handler-owner-test",
    marketplace: "alpha",
    plugin,
    resolvedSource: asAbsolutePluginRoot(pluginRoot),
    scope: "project",
  });
  hooksRouting.rebuildRoutingTables();
  return hooksRouting;
}

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<home>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
  /** How many times the case reached the replaced git transport door. */
  transportCalls(): number;
}

interface ObservedEffects {
  readonly transportCalls: number;
  readonly projectPlugins: readonly string[];
  readonly projectData: string | null;
  readonly userPlugins: readonly string[];
  readonly userData: string | null;
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before the home
 * default, so an ambient value would defeat a hermetic `HOME`. Removal, both
 * environment restores, and the transport replacement are registered before the
 * handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const { cwd, agentDir } = await createHermeticEnvironment(t, `plugin-uninstall-${label}-`);
  const requestSpy = t.mock.method(https, "request", (): never => {
    throw new Error("uninstall must not open a network connection");
  });
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: agentDir,
    transportCalls: (): number => requestSpy.mock.callCount(),
  };
}

/** The `alpha` manifest path every seeded record names; only `seedOrphanedDependency` writes it. */
function alphaManifestPath(workspace: HermeticWorkspace): string {
  return path.join(workspace.cwd, "alpha-src", ".claude-plugin", "marketplace.json");
}

/** Fresh empty inventory axes, so no two seeded records share an array. */
function emptyResources(): SeededResources {
  return { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] };
}

/**
 * Seed `demo@alpha` (installed by name) into one scope. With
 * `withOrphanedDependency`, a second record `dep` rides beside it with
 * `provenance: "dependency"` and no declarer anywhere in the scope -- the
 * whole-scope orphan the `--prune` sweep exists to find (D-05-01).
 */
async function seedInstalledPlugin(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  withOrphanedDependency = false,
): Promise<void> {
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), "alpha", {
    name: "alpha",
    scope,
    source: { kind: "path", raw: "./alpha-src", logical: "./alpha-src" },
    addedFromCwd: workspace.cwd,
    manifestPath: alphaManifestPath(workspace),
    marketplaceRoot: path.join(workspace.cwd, "alpha-src"),
    plugins: {
      demo: buildInstalledPluginRecord({ version: "1.0.0" }, emptyResources()),
      ...(withOrphanedDependency && {
        dep: buildInstalledPluginRecord(
          { version: "1.0.0", provenance: "dependency" },
          emptyResources(),
        ),
      }),
    },
  });
}

/**
 * The nested payload file under a scope's plugin data directory, composed the
 * way `locations.pluginDataDir` composes it (`<extensionRoot>/data/<mp>/<plugin>`)
 * rather than by calling the production helper.
 */
function pluginDataFile(scopeRoot: string): string {
  return path.join(
    scopeRoot,
    "pi-claude-marketplace",
    "data",
    "alpha",
    "demo",
    "nested",
    "session.bin",
  );
}

/** Persistent data a user would lose if the command disposed of it wrongly. */
async function seedPluginData(scopeRoot: string): Promise<void> {
  const dataFile = pluginDataFile(scopeRoot);
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, DATA_PAYLOAD, "utf8");
}

/** The seeded payload when it survived; `null` once the data directory is gone. */
async function readPluginData(scopeRoot: string): Promise<string | null> {
  try {
    return await readFile(pluginDataFile(scopeRoot), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

/**
 * The same `demo@alpha` install recorded in both scopes, each with its own
 * seeded data, so a wrong scope and a wrong data disposition both show.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedInstalledPlugin(workspace, "project", workspace.projectRoot);
  await seedInstalledPlugin(workspace, "user", workspace.userRoot);
  await seedPluginData(workspace.projectRoot);
  await seedPluginData(workspace.userRoot);
}

/**
 * `seedBothScopes` plus, in the project scope alone, the orphaned `dep` record
 * and the real `alpha` manifest listing `demo` and `dep`. The manifest matters
 * twice: the dependents guard reads every OTHER record's declarations before
 * `demo` may go, and fails closed on a record its marketplace does not list
 * (D-05-07); and the sweep reads the same declarations to decide that nothing
 * holds `dep`. Neither plugin tree exists, so each read falls back to its
 * manifest entry, which declares nothing.
 */
async function seedOrphanedDependency(workspace: HermeticWorkspace): Promise<void> {
  await seedInstalledPlugin(
    workspace,
    "project",
    workspace.projectRoot,
    /* withOrphanedDependency= */ true,
  );
  await seedInstalledPlugin(workspace, "user", workspace.userRoot);
  await seedPluginData(workspace.projectRoot);
  await seedPluginData(workspace.userRoot);
  const manifestPath = alphaManifestPath(workspace);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "alpha",
      plugins: [
        { name: "demo", source: "./plugins/demo" },
        { name: "dep", source: "./plugins/dep" },
      ],
    }),
    "utf8",
  );
}

/**
 * An override layer whose `schemaVersion` is a string: `loadConfig` reports it
 * invalid, which is the CFG-03 precondition the scope-target flag selects. The
 * base layer of the same scope stays absent, so the flag decides between a file
 * that aborts the command and a file that does not exist.
 */
async function seedInvalidOverrideLayer(scopeRoot: string): Promise<void> {
  await mkdir(scopeRoot, { recursive: true });
  await writeFile(
    path.join(scopeRoot, "claude-plugins.local.json"),
    '{"schemaVersion":"nope"}\n',
    "utf8",
  );
}

/** The plugin names `alpha` still records in one scope, read from its state.json. */
async function readInstalledPlugins(scopeRoot: string): Promise<readonly string[]> {
  const raw = await readFile(path.join(scopeRoot, "pi-claude-marketplace", "state.json"), "utf8");
  const state = JSON.parse(raw) as {
    marketplaces: Record<string, { plugins: Record<string, unknown> } | undefined>;
  };
  const marketplace = state.marketplaces.alpha;
  return marketplace === undefined ? [] : Object.keys(marketplace.plugins).sort();
}

/** Both scopes' surviving install records and data bytes, plus the transport counter. */
async function readObservedEffects(workspace: HermeticWorkspace): Promise<ObservedEffects> {
  return {
    transportCalls: workspace.transportCalls(),
    projectPlugins: await readInstalledPlugins(workspace.projectRoot),
    projectData: await readPluginData(workspace.projectRoot),
    userPlugins: await readInstalledPlugins(workspace.userRoot),
    userData: await readPluginData(workspace.userRoot),
  };
}

test("DATA-02: removes the project-scope record and its data when the reference alone selects the plugin", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "bare-reference");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
    value: workspace.cwd,
    reads: 1,
  });
  const ownerRuntime = createHooksRuntime();
  const peerRuntime = createHooksRuntime();
  const hooksRouting = await populateRuntimeRoute(workspace, ownerRuntime, "demo", "owner-target");
  await populateRuntimeRoute(workspace, ownerRuntime, "other", "owner-unrelated");
  await populateRuntimeRoute(workspace, peerRuntime, "demo", "peer-target");
  const uninstallHandler = makeUninstallHandler(pi, hooksRouting, createCompletionCache());

  // act
  await uninstallHandler("demo@alpha", ctx);

  // assert
  assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED);
  assert.deepStrictEqual(
    ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
    ["other"],
  );
  assert.deepStrictEqual(
    peerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
    ["demo"],
  );
  verifyBoundary();
});

for (const { args, placement } of [
  { args: "--keep-data demo@alpha", placement: "ahead of the reference" },
  { args: "demo@alpha --keep-data", placement: "after the reference" },
  { args: "--keep-data demo@alpha --keep-data", placement: "twice" },
]) {
  test(`DATA-01: keeps the seeded data bytes when the preservation flag appears ${placement}`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "keep-data-position");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED_DATA_KEPT]);
    assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED_DATA_KEPT);
    verifyBoundary();
  });
}

// FLAG-01 / D-05-10: `--prune` is accepted in any position and any number of
// times. The scope holds one record, so nothing qualifies for the sweep and the
// row is the plain success row (D-05-12); the flag's effect on a scope that does
// hold orphans is the orchestrator suite's contract.
for (const { args, placement } of [
  { args: "--prune demo@alpha", placement: "ahead of the reference" },
  { args: "demo@alpha --prune", placement: "after the reference" },
  { args: "--prune demo@alpha --prune", placement: "twice" },
]) {
  test(`FLAG-01: accepts the prune flag ${placement} and removes the record and its data`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "prune-position");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED]);
    assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED);
    verifyBoundary();
  });
}

// D-05-09: `--keep-data` and `--prune` are independent dispositions, so both
// apply whatever their relative order.
for (const { args, placement } of [
  { args: "--prune --keep-data demo@alpha", placement: "prune first" },
  { args: "demo@alpha --keep-data --prune", placement: "keep-data first" },
]) {
  test(`FLAG-01: keeps the seeded data bytes when the prune flag rides beside the preservation flag, ${placement}`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "prune-keep-data");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED_DATA_KEPT]);
    assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED_DATA_KEPT);
    verifyBoundary();
  });
}

// FLAG-01 / D-05-10: the forwarding proof the acceptance cases above cannot
// give. With an orphaned dependency in the scope, the `{dependency pruned}` row
// and the emptied project state are observable only if `prune: true` crossed
// the handler-to-orchestrator seam; the plain command on the same seed is the
// control that keeps the orphan (D-05-08's "never without the flag" at the
// command line).
const PROJECT_UNINSTALLED_DEPENDENCY_PRUNED = {
  message:
    "● alpha [project]\n  ○ demo v1.0.0 (uninstalled)\n  ○ dep v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
};

/** The named plugin and the orphan are both gone from the project scope; the user scope is whole. */
const PROJECT_RECORD_AND_ORPHAN_REMOVED = PROJECT_RECORD_REMOVED;

/** The named plugin is gone; the orphan `dep` survived the plain command. */
const PROJECT_RECORD_REMOVED_ORPHAN_KEPT = {
  transportCalls: 0,
  projectPlugins: ["dep"],
  projectData: null,
  userPlugins: ["demo"],
  userData: DATA_PAYLOAD,
};

test("FLAG-01 / D-05-10: a typed --prune reaches the sweep and removes the orphaned dependency beside the named plugin", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "prune-forwarded");
  await seedOrphanedDependency(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("demo@alpha --prune", ctx);

  // assert
  assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED_DEPENDENCY_PRUNED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_AND_ORPHAN_REMOVED);
  assert.deepStrictEqual(await readInstalledPlugins(workspace.projectRoot), []);
  verifyBoundary();
});

test("FLAG-01 / D-05-10: the same command without --prune keeps the orphaned dependency", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "prune-omitted");
  await seedOrphanedDependency(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("demo@alpha", ctx);

  // assert
  assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED_ORPHAN_KEPT);
  assert.deepStrictEqual(await readInstalledPlugins(workspace.projectRoot), ["dep"]);
  verifyBoundary();
});

for (const { expectedEffects, expectedNotification, scopeValue } of [
  {
    scopeValue: "project",
    expectedNotification: PROJECT_UNINSTALLED_DATA_KEPT,
    expectedEffects: PROJECT_RECORD_REMOVED_DATA_KEPT,
  },
  {
    scopeValue: "user",
    expectedNotification: USER_UNINSTALLED_DATA_KEPT,
    expectedEffects: USER_RECORD_REMOVED_DATA_KEPT,
  },
]) {
  test(`DATA-01: preservation keeps the ${scopeValue}-scope data the selected scope alone names`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `keep-data-scope-${scopeValue}`);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(`demo@alpha --keep-data --scope ${scopeValue}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [expectedNotification]);
    assert.deepStrictEqual(await readObservedEffects(workspace), expectedEffects);
    verifyBoundary();
  });
}

test("preservation leaves the scope-target flag selecting the override layer", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "keep-data-write-target");
  await seedBothScopes(workspace);
  await seedInvalidOverrideLayer(workspace.projectRoot);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("demo@alpha --keep-data --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [PROJECT_OVERRIDE_REJECTED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

test("D-02-05: a preservation-shaped scope value is rejected, not read as the flag", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "keep-data-as-scope-value");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("demo@alpha --scope --keep-data", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Invalid --scope value: "--keep-data". Must be "user" or "project".\n\n${USAGE_BLOCK}`,
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

test("reports a missing plugin reference and removes nothing (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "no-positional");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Missing required argument.\n\n${USAGE_BLOCK}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

test("rejects a surplus positional token and leaves both records intact", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "surplus-positional");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("demo@alpha surplus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Too many arguments.\n\n${USAGE_BLOCK}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

for (const { malformedRef, shape } of [
  { malformedRef: "no-at-sign", shape: "carries no separator" },
  { malformedRef: "@alpha", shape: "names no plugin" },
  { malformedRef: "demo@", shape: "names no marketplace" },
]) {
  test(`reports a reference that ${shape} and removes nothing (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "malformed-reference");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(malformedRef, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Invalid <plugin>@<marketplace> ref: "${malformedRef}".\n\n${USAGE_BLOCK}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
    verifyBoundary();
  });
}

for (const { expectedEffects, expectedNotification, scopeValue } of [
  {
    scopeValue: "project",
    expectedNotification: PROJECT_UNINSTALLED,
    expectedEffects: PROJECT_RECORD_REMOVED,
  },
  {
    scopeValue: "user",
    expectedNotification: USER_UNINSTALLED,
    expectedEffects: USER_RECORD_REMOVED,
  },
]) {
  test(`DATA-02: removes the ${scopeValue}-scope record and data alone when --scope ${scopeValue} is supplied`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `scope-${scopeValue}`);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(`demo@alpha --scope ${scopeValue}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [expectedNotification]);
    assert.deepStrictEqual(await readObservedEffects(workspace), expectedEffects);
    verifyBoundary();
  });
}

for (const { args, placement } of [
  { args: "--local demo@alpha --scope project", placement: "ahead of the reference" },
  { args: "demo@alpha --local --scope project", placement: "between the two other tokens" },
  { args: "demo@alpha --scope project --local", placement: "last" },
]) {
  test(`reads the override layer when the scope-target flag appears ${placement}`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "scope-target-position");
    await seedBothScopes(workspace);
    await seedInvalidOverrideLayer(workspace.projectRoot);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [PROJECT_OVERRIDE_REJECTED]);
    assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
    verifyBoundary();
  });
}

test("reads the base layer and removes the record when the scope-target flag is omitted", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "scope-target-omitted");
  await seedBothScopes(workspace);
  await seedInvalidOverrideLayer(workspace.projectRoot);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("demo@alpha --scope project", ctx);

  // assert
  assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED);
  verifyBoundary();
});

test("honors the scope flag and the scope-target flag together", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "both-selectors");
  await seedBothScopes(workspace);
  await seedInvalidOverrideLayer(workspace.userRoot);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeHandlerUnderTest(pi);

  // act
  await uninstallHandler("demo@alpha --scope user --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [USER_OVERRIDE_REJECTED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

// D-02-05 / FLAG-01: the rejected data-disposition aliases, the value form of
// the accepted flag, and an unrelated long option. The consuming scanner refuses
// short options too, which is what keeps `-y` from ever reaching a confirmation
// the command does not have.
for (const rejectedToken of ["--delete-data", "-y", "--yes", "--keep-data=false", "--frobnicate"]) {
  for (const { args, placement } of [
    { args: `${rejectedToken} demo@alpha`, placement: "ahead of the reference" },
    { args: `demo@alpha ${rejectedToken}`, placement: "after the reference" },
  ]) {
    test(`rejects "${rejectedToken}" ${placement} and disposes of nothing (D-02-05 / D-116-06)`, async (t) => {
      // arrange
      const workspace = await createHermeticWorkspace(t, "rejected-flag");
      await seedBothScopes(workspace);
      const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
      const uninstallHandler = makeHandlerUnderTest(pi);

      // act
      await uninstallHandler(args, ctx);

      // assert
      assert.deepStrictEqual(notifications, [
        { message: `Unknown flag: "${rejectedToken}".\n\n${USAGE_BLOCK}`, severity: "error" },
      ]);
      assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
      verifyBoundary();
    });
  }
}

for (const { rejectedToken, shape } of [
  { rejectedToken: "bogus", shape: "an ordinary token" },
  { rejectedToken: "--frobnicate", shape: "a token shaped like a long flag" },
]) {
  test(`reports ${shape} in the scope-value position and removes nothing (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "invalid-scope-value");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const uninstallHandler = makeHandlerUnderTest(pi);

    // act
    await uninstallHandler(`demo@alpha --scope ${rejectedToken}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Invalid --scope value: "${rejectedToken}". Must be "user" or "project".\n\n${USAGE_BLOCK}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
    verifyBoundary();
  });
}

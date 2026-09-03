// Owner for edge/handlers/plugin/uninstall.ts (MOD-09).
//
// The handler is a shim: a shared scope-target scan, a shared reference parse,
// and one workflow call. It holds no logic of its own, so everything proven here
// is either forwarding or refusal.
//
// D-116-05 (O3) places this handler in Group C: `uninstallPlugin` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as one minimal
// effect -- whether the seeded install record is still in the scope's state.json
// after the command. That exact-argument gap is this owner's recorded scope.
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
// two `getAllTools()` reads and one `ctx.cwd` read, a rejecting case spends
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
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { makeUninstallHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts";
import {
  buildInstalledPluginRecord,
  mergeMarketplaceIntoState,
} from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The usage block, written out here rather than read back off the handler. */
const USAGE_BLOCK =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]";

/** Nothing was removed anywhere: the shape a rejected command must leave behind. */
const BOTH_RECORDS_INTACT = {
  transportCalls: 0,
  projectPlugins: ["demo"],
  userPlugins: ["demo"],
};

/** The project scope lost the record; the same plugin in the user scope survived. */
const PROJECT_RECORD_REMOVED = {
  transportCalls: 0,
  projectPlugins: [],
  userPlugins: ["demo"],
};

/** The user scope lost the record; the same plugin in the project scope survived. */
const USER_RECORD_REMOVED = {
  transportCalls: 0,
  projectPlugins: ["demo"],
  userPlugins: [],
};

const PROJECT_UNINSTALLED = {
  message: "● alpha [project]\n  ○ demo v1.0.0 (uninstalled)\n\n/reload to pick up changes",
};

const USER_UNINSTALLED = {
  message: "● alpha [user]\n  ○ demo v1.0.0 (uninstalled)\n\n/reload to pick up changes",
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
  readonly userPlugins: readonly string[];
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before the home
 * default, so an ambient value would defeat a hermetic `HOME`. Removal, both
 * environment restores, and the transport replacement are registered before the
 * handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-uninstall-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-uninstall-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  const requestSpy = t.mock.method(https, "request", (): never => {
    throw new Error("uninstall must not open a network connection");
  });
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
    transportCalls: (): number => requestSpy.mock.callCount(),
  };
}

async function seedInstalledPlugin(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
): Promise<void> {
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), "alpha", {
    name: "alpha",
    scope,
    source: { kind: "path", raw: "./alpha-src", logical: "./alpha-src" },
    addedFromCwd: workspace.cwd,
    manifestPath: path.join(workspace.cwd, "alpha-src", ".claude-plugin", "marketplace.json"),
    marketplaceRoot: path.join(workspace.cwd, "alpha-src"),
    plugins: {
      demo: buildInstalledPluginRecord(
        { version: "1.0.0" },
        { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
      ),
    },
  });
}

/** The same `demo@alpha` install recorded in both scopes, so a wrong scope shows. */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedInstalledPlugin(workspace, "project", workspace.projectRoot);
  await seedInstalledPlugin(workspace, "user", workspace.userRoot);
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

/** Both scopes' surviving install records plus the transport counter. */
async function readObservedEffects(workspace: HermeticWorkspace): Promise<ObservedEffects> {
  return {
    transportCalls: workspace.transportCalls(),
    projectPlugins: await readInstalledPlugins(workspace.projectRoot),
    userPlugins: await readInstalledPlugins(workspace.userRoot),
  };
}

test("removes the project-scope record when the reference alone selects the plugin", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "bare-reference");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeUninstallHandler(pi);

  // act
  await uninstallHandler("demo@alpha", ctx);

  // assert
  assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED);
  verifyBoundary();
});

test("reports a missing plugin reference and removes nothing (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "no-positional");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const uninstallHandler = makeUninstallHandler(pi);

  // act
  await uninstallHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Missing required argument.\n\n${USAGE_BLOCK}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

test("drops a surplus positional token and removes the plugin the first token names", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "surplus-positional");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeUninstallHandler(pi);

  // act
  await uninstallHandler("demo@alpha surplus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), PROJECT_RECORD_REMOVED);
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
    const uninstallHandler = makeUninstallHandler(pi);

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
  test(`removes the ${scopeValue}-scope record alone when --scope ${scopeValue} is supplied`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `scope-${scopeValue}`);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeUninstallHandler(pi);

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
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const uninstallHandler = makeUninstallHandler(pi);

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
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeUninstallHandler(pi);

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
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const uninstallHandler = makeUninstallHandler(pi);

  // act
  await uninstallHandler("demo@alpha --scope user --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [USER_OVERRIDE_REJECTED]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

test("reports an unknown long flag and removes nothing (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "unknown-flag");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const uninstallHandler = makeUninstallHandler(pi);

  // act
  await uninstallHandler("demo@alpha --frobnicate", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Unknown flag: "--frobnicate".\n\n${USAGE_BLOCK}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readObservedEffects(workspace), BOTH_RECORDS_INTACT);
  verifyBoundary();
});

for (const { rejectedToken, shape } of [
  { rejectedToken: "bogus", shape: "an ordinary token" },
  { rejectedToken: "--frobnicate", shape: "a token shaped like a long flag" },
]) {
  test(`reports ${shape} in the scope-value position and removes nothing (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "invalid-scope-value");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const uninstallHandler = makeUninstallHandler(pi);

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

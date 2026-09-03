// Owner for edge/handlers/plugin/enable-disable.ts (MOD-09).
//
// One factory serves both slash subcommands: `makeEnableDisableHandler(pi, true)`
// backs `plugin enable` and `makeEnableDisableHandler(pi, false)` backs
// `plugin disable`. The two forms differ only in the usage block that boolean
// selects and in the enabled state the workflow records, so both arms are driven
// wherever nothing else separates them.
//
// D-116-05 (O3) places this handler in Group C: `setPluginEnabled` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as one minimal
// effect -- the enabled flag each scope's `state.json` carries after the command,
// plus the declaration the write-back leaves in that scope's base or override
// config layer. That exact-argument gap is this owner's recorded scope.
//
// The negative half of D-116-06 is proven in full. A rejecting case sizes the
// boundary at one emission, zero probes, and no stated `cwd`; both scopes are
// seeded, so a workflow that did run would have records to flip and files to
// write, and every rejecting case reads the whole footprint back unchanged
// beside `verifyBoundary()`.
//
// Measured counts, taken against the real module through a counting proxy before
// a case was written, because the two emission paths disagree:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- `notifyUsageError` writes straight to the channel;
//   * a delegating command reads `ctx.ui` once, `ctx.cwd` once, and
//     `pi.getAllTools()` FOUR times -- the orchestrator's context cascade runs
//     two soft-dependency probes and each probe reads the tool list twice;
//   * the handler's own failure conversion reads `pi.getAllTools()` TWICE -- it
//     calls `notify()` directly, so it runs one probe.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project scope,
// and `<HOME>/.pi/agent` for the user scope with the agent-directory variable
// DELETED rather than overwritten, because `getAgentDir()` reads it ahead of
// `homedir()` and an ambient value would defeat a hermetic HOME (SC-1). The
// footprint is read back from those paths, never from `locationsFor`, so the
// record-location claim is independent of the path the workflow computed.
//
// This pair makes no exhaustiveness claim: the module holds no switch and no
// closed-union dispatch, so a missing-arm plant has no target here. No case
// asserts the absence of direct process output (ESLint and fallow own that),
// none re-proves the scope-target scan owned by tests/edge/handlers/shared.test.ts
// or the reference parse owned by tests/edge/handlers/plugin/shared.test.ts, none
// restates the tokenizer diagnostics owned by tests/edge/args.test.ts, and no
// delegating case re-derives the workflow's own row grammar, which
// tests/orchestrators/plugin/enable-disable.test.ts owns at full direct coverage.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { makeEnableDisableHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts";
import {
  buildInstalledPluginRecord,
  materializeMarketplaceTree,
  mergeMarketplaceIntoState,
} from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

import type { ExtensionCommandContext } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The enabled flags one scope's `state.json` carries for the two seeded plugins. */
interface EnabledFlags {
  readonly alpha: boolean | undefined;
  readonly beta: boolean | undefined;
}

/** Every place a command could leave a record, read back as one value. */
interface Footprint {
  readonly projectRecords: EnabledFlags;
  readonly userRecords: EnabledFlags;
  readonly projectBase: unknown;
  readonly projectLocal: unknown;
  readonly userBase: unknown;
  readonly userLocal: unknown;
}

/** The shape this file reads back out of a seeded `state.json`. */
interface SeededStateFile {
  readonly marketplaces: Record<
    string,
    { readonly plugins: Record<string, { readonly enabled: boolean }> } | undefined
  >;
}

const BOTH_ENABLED: EnabledFlags = { alpha: true, beta: true };
const BOTH_DISABLED: EnabledFlags = { alpha: false, beta: false };
const ALPHA_OFF: EnabledFlags = { alpha: false, beta: true };
const ALPHA_ON: EnabledFlags = { alpha: true, beta: false };

/** The declaration a flip to disabled writes back for the seeded plugin. */
const ALPHA_DECLARED_DISABLED = {
  schemaVersion: 1,
  marketplaces: { mp: { source: "./mp-src" } },
  plugins: { "alpha@mp": { enabled: false } },
};

/** The declaration a flip to enabled writes back for the seeded plugin. */
const ALPHA_DECLARED_ENABLED = {
  schemaVersion: 1,
  marketplaces: { mp: { source: "./mp-src" } },
  plugins: { "alpha@mp": { enabled: true } },
};

/** Nothing moved: the footprint a rejected command must leave behind. */
const NOTHING_RECORDED: Footprint = {
  projectRecords: BOTH_ENABLED,
  userRecords: BOTH_ENABLED,
  projectBase: undefined,
  projectLocal: undefined,
  userBase: undefined,
  userLocal: undefined,
};

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<HOME>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
}

/**
 * Replace the door the git transport opens with a fail-fast throw owned by the
 * test context, which restores it after the case.
 *
 * A HERMETICITY DEVICE, not an offline proof, and no case asserts a call count
 * against it. The git transport IS in this handler's import graph -- an enable
 * re-materializes through the install ledger -- but every plugin seeded here
 * declares a PATH source, which resolves off disk and never reaches the
 * transport, so a zero asserted over these fixtures could not rise even with
 * the door correct. The value of the replacement is that a dial-out this path
 * acquires later fails the case where it happens.
 *
 * The door is `https.request` because that is the one the git transport opens:
 * `isomorphic-git/http/node` reaches the wire through `simple-get`, which calls
 * `https.request`. `globalThis.fetch` is NOT watched -- its only production
 * caller in this repository is the device flow in `domain/github-auth.ts`,
 * which a path-source enable never enters.
 */
function installNetworkTrap(t: TestContext): void {
  t.mock.method(https, "request", (): never => {
    throw new Error("the enable-disable surface must not open a network connection");
  });
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared. Removal and both environment restores are
 * registered before the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-enable-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-enable-${label}-home-`));
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
  installNetworkTrap(t);
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
  };
}

/**
 * A context that delegates every member to the shared strict boundary and fails
 * on the single read the failure-conversion path depends on. `Proxy` keeps the
 * boundary as the one source of every other member, so no member of the Pi
 * surface is hand-rolled and `verifyBoundary()` still governs the emission.
 */
function withUnreadableCwd(
  ctx: ExtensionCommandContext,
  failure: unknown,
): ExtensionCommandContext {
  return new Proxy(ctx, {
    get(target, property, receiver): unknown {
      if (property === "cwd") {
        throw failure;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

/**
 * The marketplace tree the enable branch's ledger reads back through the cached
 * manifest, so a re-enable resolves its plugin root without a network read.
 */
async function materializeSource(workspace: HermeticWorkspace): Promise<void> {
  const marketplaceRoot = path.join(workspace.cwd, "mp-src");
  await materializeMarketplaceTree(marketplaceRoot, { installablePluginDirs: ["alpha", "beta"] });
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      owner: { name: "seed-owner" },
      plugins: [
        { name: "alpha", source: "./alpha", version: "1.0.0" },
        { name: "beta", source: "./beta", version: "1.0.0" },
      ],
    }),
    "utf8",
  );
  for (const plugin of ["alpha", "beta"]) {
    await mkdir(path.join(marketplaceRoot, plugin, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(marketplaceRoot, plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin, version: "1.0.0" }),
      "utf8",
    );
  }
}

async function seedScope(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  disabled: boolean,
): Promise<void> {
  const emptyResources = { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] };
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), "mp", {
    name: "mp",
    scope,
    source: { kind: "path", raw: "./mp-src", logical: "./mp-src" },
    addedFromCwd: workspace.cwd,
    manifestPath: path.join(workspace.cwd, "mp-src", ".claude-plugin", "marketplace.json"),
    marketplaceRoot: path.join(workspace.cwd, "mp-src"),
    plugins: {
      alpha: buildInstalledPluginRecord(
        { version: "1.0.0", disabled, resolvedSource: "./alpha" },
        { ...emptyResources },
      ),
      beta: buildInstalledPluginRecord(
        { version: "1.0.0", disabled, resolvedSource: "./beta" },
        { ...emptyResources },
      ),
    },
  });
}

/**
 * `alpha` and `beta` recorded under `mp` in BOTH scopes at the same enabled
 * state, so a command that touched the wrong scope or the wrong plugin is
 * visible, and neither scope carries a declaration yet.
 */
async function seedBothScopes(workspace: HermeticWorkspace, disabled: boolean): Promise<void> {
  await seedScope(workspace, "project", workspace.projectRoot, disabled);
  await seedScope(workspace, "user", workspace.userRoot, disabled);
  await materializeSource(workspace);
}

async function readConfigFile(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }

  return JSON.parse(raw) as unknown;
}

async function readEnabledFlags(scopeRoot: string): Promise<EnabledFlags> {
  const raw = await readFile(path.join(scopeRoot, "pi-claude-marketplace", "state.json"), "utf8");
  const plugins = (JSON.parse(raw) as SeededStateFile).marketplaces.mp?.plugins;
  return { alpha: plugins?.alpha?.enabled, beta: plugins?.beta?.enabled };
}

/** Both scopes' recorded enabled flags and both scopes' config layers. */
async function readFootprint(workspace: HermeticWorkspace): Promise<Footprint> {
  return {
    projectRecords: await readEnabledFlags(workspace.projectRoot),
    userRecords: await readEnabledFlags(workspace.userRoot),
    projectBase: await readConfigFile(path.join(workspace.projectRoot, "claude-plugins.json")),
    projectLocal: await readConfigFile(
      path.join(workspace.projectRoot, "claude-plugins.local.json"),
    ),
    userBase: await readConfigFile(path.join(workspace.userRoot, "claude-plugins.json")),
    userLocal: await readConfigFile(path.join(workspace.userRoot, "claude-plugins.local.json")),
  };
}

for (const { enable, expectedMessage, subcommand } of [
  {
    enable: true,
    subcommand: "enable",
    expectedMessage:
      'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]',
  },
  {
    enable: false,
    subcommand: "disable",
    expectedMessage:
      'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]',
  },
]) {
  test(`reports an unknown flag with the ${subcommand} usage block and records nothing (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `unknown-flag-${subcommand}`);
    await seedBothScopes(workspace, false);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const enableDisableHandler = makeEnableDisableHandler(pi, enable);

    // act
    await enableDisableHandler("alpha@mp --frobnicate", ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_RECORDED);
    verifyBoundary();
  });
}

test("collapses a missing plugin reference into one sentence with the usage block (ENBL-01)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "missing-positional");
  await seedBothScopes(workspace, false);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const enableDisableHandler = makeEnableDisableHandler(pi, true);

  // act
  await enableDisableHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Missing required argument.\n\nUsage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readFootprint(workspace), NOTHING_RECORDED);
  verifyBoundary();
});

test("names the offending token when the plugin reference carries no separator (ENBL-01)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "malformed-ref");
  await seedBothScopes(workspace, false);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const enableDisableHandler = makeEnableDisableHandler(pi, false);

  // act
  await enableDisableHandler("no-at-sign", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        'Invalid <plugin>@<marketplace> ref: "no-at-sign".\n\nUsage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]',
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readFootprint(workspace), NOTHING_RECORDED);
  verifyBoundary();
});

test("reports an unrecognised scope value and records nothing (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "invalid-scope");
  await seedBothScopes(workspace, false);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const enableDisableHandler = makeEnableDisableHandler(pi, true);

  // act
  await enableDisableHandler("alpha@mp --scope bogus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        'Invalid --scope value: "bogus". Must be "user" or "project".\n\nUsage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]',
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readFootprint(workspace), NOTHING_RECORDED);
  verifyBoundary();
});

for (const { enable, expectedFootprint, label, seedDisabled, summary } of [
  {
    enable: false,
    seedDisabled: false,
    label: "disable-flips",
    summary: "disable flips an enabled record and declares the flip in the base config",
    expectedFootprint: {
      projectRecords: BOTH_ENABLED,
      userRecords: ALPHA_OFF,
      projectBase: undefined,
      projectLocal: undefined,
      userBase: ALPHA_DECLARED_DISABLED,
      userLocal: undefined,
    },
  },
  {
    enable: true,
    seedDisabled: false,
    label: "enable-idempotent",
    summary: "enable leaves an already-enabled record untouched and writes no declaration",
    expectedFootprint: {
      projectRecords: BOTH_ENABLED,
      userRecords: BOTH_ENABLED,
      projectBase: undefined,
      projectLocal: undefined,
      userBase: undefined,
      userLocal: undefined,
    },
  },
  {
    enable: true,
    seedDisabled: true,
    label: "enable-flips",
    summary: "enable flips a disabled record and declares the flip in the base config",
    expectedFootprint: {
      projectRecords: BOTH_DISABLED,
      userRecords: ALPHA_ON,
      projectBase: undefined,
      projectLocal: undefined,
      userBase: ALPHA_DECLARED_ENABLED,
      userLocal: undefined,
    },
  },
  {
    enable: false,
    seedDisabled: true,
    label: "disable-idempotent",
    summary: "disable leaves an already-disabled record untouched and writes no declaration",
    expectedFootprint: {
      projectRecords: BOTH_DISABLED,
      userRecords: BOTH_DISABLED,
      projectBase: undefined,
      projectLocal: undefined,
      userBase: undefined,
      userLocal: undefined,
    },
  },
]) {
  test(`${summary} (ENBL-02)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace, seedDisabled);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const enableDisableHandler = makeEnableDisableHandler(pi, enable);

    // act
    await enableDisableHandler("alpha@mp --scope user", ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), expectedFootprint);
    verifyBoundary();
  });
}

test("drops a surplus reference token and flips only the first one (ENBL-01)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "surplus-positional");
  await seedBothScopes(workspace, false);
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
    value: workspace.cwd,
    reads: 1,
  });
  const enableDisableHandler = makeEnableDisableHandler(pi, false);

  // act
  await enableDisableHandler("alpha@mp beta@mp --scope user", ctx);

  // assert
  assert.deepStrictEqual(await readFootprint(workspace), {
    projectRecords: BOTH_ENABLED,
    userRecords: ALPHA_OFF,
    projectBase: undefined,
    projectLocal: undefined,
    userBase: ALPHA_DECLARED_DISABLED,
    userLocal: undefined,
  });
  verifyBoundary();
});

for (const { args, label, selection } of [
  {
    args: "alpha@mp --scope project",
    label: "scope-project",
    selection: "the scope flag names it",
  },
  { args: "alpha@mp", label: "scope-omitted", selection: "no scope flag is supplied" },
]) {
  test(`flips the project record when ${selection} (SCOPE-01)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace, false);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const enableDisableHandler = makeEnableDisableHandler(pi, false);

    // act
    await enableDisableHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), {
      projectRecords: ALPHA_OFF,
      userRecords: BOTH_ENABLED,
      projectBase: ALPHA_DECLARED_DISABLED,
      projectLocal: undefined,
      userBase: undefined,
      userLocal: undefined,
    });
    verifyBoundary();
  });
}

for (const { args, label, placement } of [
  {
    args: "--local alpha@mp --scope user",
    label: "local-before",
    placement: "before the plugin reference",
  },
  {
    args: "alpha@mp --scope user --local",
    label: "local-after",
    placement: "after the plugin reference",
  },
]) {
  test(`honours the scope flag and writes the override layer with the scope-target flag ${placement} (WR-02)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace, false);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const enableDisableHandler = makeEnableDisableHandler(pi, false);

    // act
    await enableDisableHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), {
      projectRecords: BOTH_ENABLED,
      userRecords: ALPHA_OFF,
      projectBase: undefined,
      projectLocal: undefined,
      userBase: undefined,
      userLocal: ALPHA_DECLARED_DISABLED,
    });
    verifyBoundary();
  });
}

for (const { args, enable, expectedMessage, failure, label, reported } of [
  {
    args: "alpha@mp --scope project",
    enable: true,
    failure: new Error("state directory is unreadable"),
    label: "failure-scope-project",
    reported: "the supplied scope",
    expectedMessage:
      "A plugin operation has failed.\n\n● mp [project]\n  ⊘ alpha (failed) {unreadable}\n    cause: state directory is unreadable",
  },
  {
    args: "alpha@mp",
    enable: false,
    failure: new Error("state directory is unreadable"),
    label: "failure-scope-default",
    reported: "the user scope when no scope flag was supplied",
    expectedMessage:
      "A plugin operation has failed.\n\n● mp [user]\n  ⊘ alpha (failed) {unreadable}\n    cause: state directory is unreadable",
  },
  {
    args: "alpha@mp",
    enable: true,
    failure: "state directory is unreadable",
    label: "failure-non-error",
    reported: "the user scope when the escaping throw carried no error object",
    expectedMessage:
      "A plugin operation has failed.\n\n● mp [user]\n  ⊘ alpha (failed) {unreadable}\n    cause: state directory is unreadable",
  },
]) {
  test(`converts a throw escaping the workflow into one failed row naming ${reported} (IL-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace, false);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
    const enableDisableHandler = makeEnableDisableHandler(pi, enable);

    // act
    await enableDisableHandler(args, withUnreadableCwd(ctx, failure));

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_RECORDED);
    verifyBoundary();
  });
}

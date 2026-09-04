// Owner for edge/handlers/marketplace/autoupdate.ts (MOD-09).
//
// One factory serves both slash subcommands: `makeAutoupdateHandler(pi, true)`
// backs `marketplace autoupdate` and `makeAutoupdateHandler(pi, false)` backs
// `marketplace noautoupdate`. The two forms differ only in the usage block that
// boolean selects and in the flip the workflow records, so both arms are driven
// wherever nothing else separates them.
//
// D-116-05 (O3) places this handler in Group C: `setMarketplaceAutoupdate` is
// reached by direct import with no injection point, so a delegating case cannot
// state an exact argument list against it. Delegation is observed instead as one
// minimal effect -- the declarative config each scope root carries after the
// command, which SPLIT-01 makes the real record of a flip, state.json being
// classify-only. That exact-argument gap is this owner's recorded scope.
//
// The negative half of D-116-06 is proven in full, and the mechanism that fires
// is the boundary's UNSTATED working directory, not the emission count. A
// rejecting case sizes the boundary at one emission, zero probes, and no stated
// `cwd`. `setMarketplaceAutoupdate` reaches `locationsFor(scope, opts.cwd)`
// before it can emit anything, so a workflow that ran would carry strong-mock's
// pending-call proxy into `path.join` and die there. The emission count is only
// the fallback, for a workflow that reads no working directory. Every rejecting
// case also reads back an empty config footprint, so "the workflow never ran" is
// asserted as an absence of recorded state too.
//
// Both scopes are seeded in every case, rejecting ones included, so a workflow
// that did run would have marketplaces to flip and files to write.
//
// The two scope roots are hand-authored -- `<cwd>/.pi` for the project scope and
// the directory PI_CODING_AGENT_DIR pins for the user scope (SC-1). Reading the
// footprint back from those paths keeps "which scope the record landed in" a
// measurement rather than a re-derivation of the path the workflow computed.
//
// No exhaustiveness claim: marketplace/autoupdate.ts holds no switch and no
// closed-union dispatch, so a missing-arm plant has no target here. No case
// asserts the absence of direct process output (ESLint and fallow own that),
// none re-proves the scope-target scan owned by
// tests/edge/handlers/shared.test.ts or the positional schema owned by
// tests/edge/args-schema.test.ts, and none re-derives the flip workflow's own row
// grammar, which tests/orchestrators/marketplace/autoupdate.test.ts owns.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { makeAutoupdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";
import { mergeMarketplaceIntoState } from "../marketplace-seed.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The config entry a fresh flip to autoupdate leaves for the project marketplace. */
const PROJECT_ALPHA_ON = {
  schemaVersion: 1,
  marketplaces: { alpha: { autoupdate: true, source: "./alpha-src" } },
  plugins: {},
};

/** The config entry a fresh flip to autoupdate leaves for the user marketplace. */
const USER_BETA_ON = {
  schemaVersion: 1,
  marketplaces: { beta: { autoupdate: true, source: "./beta-src" } },
  plugins: {},
};

/** Nothing was written anywhere: the shape a rejected command must leave behind. */
const NOTHING_RECORDED = {
  projectBase: undefined,
  projectLocal: undefined,
  userBase: undefined,
  userLocal: undefined,
};

/** The base config alone carries the project flip; the override layer stays absent. */
const PROJECT_BASE_ONLY = {
  projectBase: PROJECT_ALPHA_ON,
  projectLocal: undefined,
  userBase: undefined,
  userLocal: undefined,
};

/** The override layer alone carries the project flip; the base file stays absent. */
const PROJECT_OVERRIDE_ONLY = {
  projectBase: undefined,
  projectLocal: PROJECT_ALPHA_ON,
  userBase: undefined,
  userLocal: undefined,
};

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** The user scope root, pinned through PI_CODING_AGENT_DIR (SC-1). */
  readonly userRoot: string;
}

interface ConfigFootprint {
  readonly projectBase: unknown;
  readonly projectLocal: unknown;
  readonly userBase: unknown;
  readonly userLocal: unknown;
}

/**
 * One temporary working directory and one temporary home per case. The user
 * scope root is pinned through PI_CODING_AGENT_DIR rather than left to the
 * `homedir()` default, so both scope roots are values this file chose. Removal
 * and both environment restores are registered before the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `mp-autoupdate-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `mp-autoupdate-${label}-home-`));
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
  const userRoot = path.join(home, "agent");
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = userRoot;
  return { cwd, projectRoot: path.join(cwd, ".pi"), userRoot };
}

async function seedMarketplace(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  name: string,
): Promise<void> {
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), name, {
    name,
    scope,
    source: { kind: "path", raw: `./${name}-src`, logical: `./${name}-src` },
    addedFromCwd: workspace.cwd,
    manifestPath: path.join(workspace.cwd, `${name}-src`, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: path.join(workspace.cwd, `${name}-src`),
    plugins: {},
  });
}

/** `alpha` in the project scope and `beta` in the user scope, neither declared in a config. */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedMarketplace(workspace, "project", workspace.projectRoot, "alpha");
  await seedMarketplace(workspace, "user", workspace.userRoot, "beta");
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

/** Both scopes' base and override config layers, as their consumers read them. */
async function readConfigFootprint(workspace: HermeticWorkspace): Promise<ConfigFootprint> {
  return {
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
    subcommand: "autoupdate",
    expectedMessage:
      'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]',
  },
  {
    enable: false,
    subcommand: "noautoupdate",
    expectedMessage:
      'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project] [--local]',
  },
]) {
  test(`reports an unknown flag with the ${subcommand} usage block and never flips (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `unknown-flag-${subcommand}`);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const autoupdateHandler = makeAutoupdateHandler(pi, enable);

    // act
    await autoupdateHandler("--frobnicate", ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await readConfigFootprint(workspace), NOTHING_RECORDED);
    verifyBoundary();
  });
}

for (const { rejectedToken, shape } of [
  { rejectedToken: "bogus", shape: "an ordinary token" },
  { rejectedToken: "--frobnicate", shape: "a token shaped like a long flag" },
]) {
  test(`reports ${shape} in the scope-value position as an invalid scope and never flips (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "invalid-scope");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const autoupdateHandler = makeAutoupdateHandler(pi, true);

    // act
    await autoupdateHandler(`--scope ${rejectedToken}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Invalid --scope value: "${rejectedToken}". Must be "user" or "project".\n\nUsage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await readConfigFootprint(workspace), NOTHING_RECORDED);
    verifyBoundary();
  });
}

test("flips every marketplace in both scopes when no scope flag narrows the command", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "bare-form");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const autoupdateHandler = makeAutoupdateHandler(pi, true);

  // act
  await autoupdateHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● alpha [project] <autoupdate>\n\n● beta [user] <autoupdate>" },
  ]);
  assert.deepStrictEqual(await readConfigFootprint(workspace), {
    projectBase: PROJECT_ALPHA_ON,
    projectLocal: undefined,
    userBase: USER_BETA_ON,
    userLocal: undefined,
  });
  verifyBoundary();
});

test("flips only the marketplace the name positional selects", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "named-form");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const autoupdateHandler = makeAutoupdateHandler(pi, true);

  // act
  await autoupdateHandler("alpha", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● alpha [project] <autoupdate>" }]);
  assert.deepStrictEqual(await readConfigFootprint(workspace), PROJECT_BASE_ONLY);
  verifyBoundary();
});

test("drops a surplus positional token and flips only the first name", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "surplus-positional");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const autoupdateHandler = makeAutoupdateHandler(pi, true);

  // act
  await autoupdateHandler("alpha beta", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● alpha [project] <autoupdate>" }]);
  assert.deepStrictEqual(await readConfigFootprint(workspace), PROJECT_BASE_ONLY);
  verifyBoundary();
});

for (const { enable, expectedMessage, expectedProjectBase, subcommand } of [
  {
    enable: true,
    subcommand: "autoupdate",
    expectedMessage: "● alpha [project] <autoupdate> {already autoupdate}",
    expectedProjectBase: {
      schemaVersion: 1,
      marketplaces: { alpha: { source: "./alpha-src", autoupdate: true } },
    },
  },
  {
    enable: false,
    subcommand: "noautoupdate",
    expectedMessage: "● alpha [project] <no autoupdate>",
    expectedProjectBase: {
      schemaVersion: 1,
      marketplaces: { alpha: { source: "./alpha-src", autoupdate: false } },
      plugins: {},
    },
  },
]) {
  test(`records the ${subcommand} outcome for a marketplace already declared with autoupdate on`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `declared-on-${subcommand}`);
    await seedBothScopes(workspace);
    await mkdir(workspace.projectRoot, { recursive: true });
    await writeFile(
      path.join(workspace.projectRoot, "claude-plugins.json"),
      '{"schemaVersion":1,"marketplaces":{"alpha":{"source":"./alpha-src","autoupdate":true}}}\n',
      "utf8",
    );
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const autoupdateHandler = makeAutoupdateHandler(pi, enable);

    // act
    await autoupdateHandler("alpha --scope project", ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    assert.deepStrictEqual(await readConfigFootprint(workspace), {
      projectBase: expectedProjectBase,
      projectLocal: undefined,
      userBase: undefined,
      userLocal: undefined,
    });
    verifyBoundary();
  });
}

for (const { expectedFootprint, expectedMessage, scopeValue } of [
  {
    scopeValue: "project",
    expectedMessage: "● alpha [project] <autoupdate>",
    expectedFootprint: PROJECT_BASE_ONLY,
  },
  {
    scopeValue: "user",
    expectedMessage: "● beta [user] <autoupdate>",
    expectedFootprint: {
      projectBase: undefined,
      projectLocal: undefined,
      userBase: USER_BETA_ON,
      userLocal: undefined,
    },
  },
]) {
  test(`flips the ${scopeValue} scope alone when --scope ${scopeValue} is supplied`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `scope-${scopeValue}`);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const autoupdateHandler = makeAutoupdateHandler(pi, true);

    // act
    await autoupdateHandler(`--scope ${scopeValue}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    assert.deepStrictEqual(await readConfigFootprint(workspace), expectedFootprint);
    verifyBoundary();
  });
}

for (const { args, placement } of [
  { args: "--local alpha", placement: "before the name positional" },
  { args: "alpha --local", placement: "after the name positional" },
]) {
  test(`records the flip in the override layer when the scope-target flag appears ${placement}`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "scope-target-position");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const autoupdateHandler = makeAutoupdateHandler(pi, true);

    // act
    await autoupdateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● alpha [project] <autoupdate>" }]);
    assert.deepStrictEqual(await readConfigFootprint(workspace), PROJECT_OVERRIDE_ONLY);
    verifyBoundary();
  });
}

test("accepts a scope flag beside the scope-target flag and honors both selectors", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "both-selectors");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const autoupdateHandler = makeAutoupdateHandler(pi, true);

  // act
  await autoupdateHandler("--scope project --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● alpha [project] <autoupdate>" }]);
  assert.deepStrictEqual(await readConfigFootprint(workspace), PROJECT_OVERRIDE_ONLY);
  verifyBoundary();
});

// Owner for edge/handlers/marketplace/remove.ts (MOD-09).
//
// The module is one factory that opens the command through the shared
// marketplace opener and forwards four members to the remove workflow: the
// parsed name, the working directory, the optional scope, and the optional
// scope-target flag. Its whole promise is therefore the usage block it supplies
// plus those four forwards. The opener's own parse, the collapse of the
// duplicated usage block, and the scope-target scan belong to
// `tests/edge/handlers/marketplace/shared.test.ts` and
// `tests/edge/handlers/shared.test.ts`, which drive them in isolation
// (D-116-07). Nothing here restates that mechanism.
//
// D-116-05 (O3) places this handler in Group C: `removeMarketplace` is reached
// by direct import at the call site with no injection point, so a delegating
// case cannot state an exact argument list against it. Delegation is observed
// instead as one minimal effect -- which marketplace records survive in which
// scope's `state.json` after the command. That exact-argument gap is this
// owner's recorded scope, and the negative half of D-116-06 is proven in full.
//
// This is a state-changing command, so every rejecting case additionally
// asserts the seeded records are still on disk. A rejecting case sizes the
// boundary at one emission and zero probes and leaves the working directory
// UNSTATED, so a workflow that ran would carry strong-mock's pending-call proxy
// into `removeMarketplace`'s first `locationsFor(scope, opts.cwd)` call. A
// delegating case states one emission, two tool probes (one soft-dependency
// probe reading twice), and one working-directory read. All four counts were
// measured against the real module through a counting proxy before this file
// was written.
//
// The scope-target flag is observable ONLY through which config layer the
// CFG-03 precondition validates: the removal's config write-back sweeps both
// layers regardless, so a valid-config workspace cannot tell the flag apart
// from its absence. The rows that drive it therefore run against a workspace
// whose `claude-plugins.local.json` fails schema validation, where supplying
// the flag aborts the removal and omitting it does not.
//
// Every case also asserts the process-wide transport recorded zero calls. The
// architecture suite that gates network reach names orchestrator files only and
// says nothing about the edge tier, so NFR-5 for this path is proven here by
// call count rather than by an error message: an error-message assertion would
// pass for the wrong error.
//
// No exhaustiveness claim: marketplace/remove.ts holds no switch and no
// closed-union dispatch, so a missing-arm plant has no target here. No case
// asserts the absence of direct process output (ESLint and fallow own that),
// and none re-derives the remove workflow's own row grammar, which
// tests/orchestrators/marketplace/remove.test.ts owns.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { pathSource } from "../../../../extensions/pi-claude-marketplace/domain/source.ts";
import { makeRemoveHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { mergeMarketplaceIntoState } from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The usage block this shim supplies, written out rather than read back. */
const REMOVE_USAGE =
  "Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]";

/** The row a successful project-scope removal renders as. */
const PROJECT_ALPHA_REMOVED = "● alpha [project] (removed)";

/** The row a successful user-scope removal renders as. */
const USER_ALPHA_REMOVED = "● alpha [user] (removed)";

/** The row an aborted project-scope removal renders as. */
const PROJECT_ALPHA_ABORTED =
  "A marketplace operation has failed.\n\n⊘ alpha [project] (failed) {invalid manifest}";

/** Marketplace names recorded per scope, the effect a removal is observed by. */
interface MarketplaceFootprint {
  readonly project: readonly string[];
  readonly user: readonly string[];
}

/** What both scopes hold before any command runs. */
const BOTH_SCOPES_SEEDED: MarketplaceFootprint = { project: ["alpha"], user: ["alpha", "beta"] };

/** What both scopes hold after the project-scope `alpha` is removed. */
const PROJECT_ALPHA_GONE: MarketplaceFootprint = { project: [], user: ["alpha", "beta"] };

/** What both scopes hold after the user-scope `alpha` is removed. */
const USER_ALPHA_GONE: MarketplaceFootprint = { project: ["alpha"], user: ["beta"] };

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** How many times the case reached the replaced process-wide transport. */
  fetchCallCount(): number;
}

function refuseNetwork(): Promise<Response> {
  throw new Error("the marketplace remove surface must not reach the network");
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). Removal, both
 * environment restores, and the transport replacement are all registered before
 * the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `mp-remove-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `mp-remove-${label}-home-`));
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
  const fetchSpy = t.mock.method(globalThis, "fetch", refuseNetwork);
  return {
    cwd,
    fetchCallCount(): number {
      return fetchSpy.mock.callCount();
    },
  };
}

/**
 * Persist one path-source marketplace record with no plugins under it, which is
 * the smallest record a removal can consume end to end.
 */
async function seedMarketplace(cwd: string, scope: Scope, name: string): Promise<void> {
  const locations = locationsFor(scope, cwd);
  const manifestPath = path.join(locations.extensionRoot, `${name}.json`);
  await mkdir(locations.extensionRoot, { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ name, plugins: [] }), "utf8");
  await mergeMarketplaceIntoState(locations.extensionRoot, name, {
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot: `/seeded/${scope}/${name}`,
    name,
    plugins: {},
    scope,
    source: pathSource(`/seeded/${scope}/${name}`),
  });
}

/**
 * `alpha` in both scopes so a scope selection is visible as which record
 * survives, and `beta` in the user scope alone as a marketplace no expectation
 * names: a lookup that widened past the first positional would take it.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedMarketplace(workspace.cwd, "project", "alpha");
  await seedMarketplace(workspace.cwd, "user", "alpha");
  await seedMarketplace(workspace.cwd, "user", "beta");
}

/**
 * Write a `claude-plugins.local.json` that fails schema validation, so the
 * CFG-03 precondition aborts whenever that layer is the selected target.
 */
async function seedInvalidLocalConfig(cwd: string, scope: Scope): Promise<void> {
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.scopeRoot, { recursive: true });
  await writeFile(locations.configLocalJsonPath, '{"schemaVersion": "not-a-number"}', "utf8");
}

/** Read the marketplace names each scope records, absent files reading empty. */
async function readMarketplaceFootprint(cwd: string): Promise<MarketplaceFootprint> {
  const [project, user] = await Promise.all([
    readScopeNames(cwd, "project"),
    readScopeNames(cwd, "user"),
  ]);
  return { project, user };
}

async function readScopeNames(cwd: string, scope: Scope): Promise<string[]> {
  const locations = locationsFor(scope, cwd);
  try {
    const raw = await readFile(path.join(locations.extensionRoot, "state.json"), "utf8");
    const state = JSON.parse(raw) as { marketplaces: Record<string, unknown> };
    return Object.keys(state.marketplaces).sort();
  } catch {
    return [];
  }
}

for (const { args, expectedFootprint, expectedMessage, selection } of [
  {
    args: "alpha",
    expectedFootprint: PROJECT_ALPHA_GONE,
    expectedMessage: PROJECT_ALPHA_REMOVED,
    selection: "the project scope first when no scope flag is supplied",
  },
  {
    args: "alpha --scope project",
    expectedFootprint: PROJECT_ALPHA_GONE,
    expectedMessage: PROJECT_ALPHA_REMOVED,
    selection: "the project scope the flag names",
  },
  {
    args: "alpha --scope user",
    expectedFootprint: USER_ALPHA_GONE,
    expectedMessage: USER_ALPHA_REMOVED,
    selection: "the user scope the flag names",
  },
]) {
  test(`reaches the remove workflow, which drops the record held by ${selection}`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "delegates");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      reads: 1,
      value: workspace.cwd,
    });
    const removeHandler = makeRemoveHandler(pi);

    // act
    await removeHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    assert.deepStrictEqual(await readMarketplaceFootprint(workspace.cwd), expectedFootprint);
    assert.strictEqual(workspace.fetchCallCount(), 0);
    verifyBoundary();
  });
}

test("supplies the remove usage block, shown when the name positional is missing", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "missing-name");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const removeHandler = makeRemoveHandler(pi);

  // act
  await removeHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Missing required argument.\n\n${REMOVE_USAGE}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readMarketplaceFootprint(workspace.cwd), BOTH_SCOPES_SEEDED);
  assert.strictEqual(workspace.fetchCallCount(), 0);
  verifyBoundary();
});

test("removes the first positional alone, so a surplus token drops rather than rejecting", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "surplus");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    reads: 1,
    value: workspace.cwd,
  });
  const removeHandler = makeRemoveHandler(pi);

  // act
  await removeHandler("alpha beta", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: PROJECT_ALPHA_REMOVED }]);
  assert.deepStrictEqual(await readMarketplaceFootprint(workspace.cwd), PROJECT_ALPHA_GONE);
  assert.strictEqual(workspace.fetchCallCount(), 0);
  verifyBoundary();
});

for (const { args, expectedFootprint, expectedNotification, placement } of [
  {
    args: "alpha",
    expectedFootprint: { project: [], user: [] },
    expectedNotification: { message: PROJECT_ALPHA_REMOVED },
    placement: "omitted",
  },
  {
    args: "alpha --local",
    expectedFootprint: { project: ["alpha"], user: [] },
    expectedNotification: { message: PROJECT_ALPHA_ABORTED, severity: "error" },
    placement: "supplied after the positional",
  },
  {
    args: "--local alpha",
    expectedFootprint: { project: ["alpha"], user: [] },
    expectedNotification: { message: PROJECT_ALPHA_ABORTED, severity: "error" },
    placement: "supplied before the positional",
  },
] as const) {
  test(`selects the override config layer as the removal precondition when the scope-target flag is ${placement} (WB-01)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "scope-target");
    await seedMarketplace(workspace.cwd, "project", "alpha");
    await seedInvalidLocalConfig(workspace.cwd, "project");
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      reads: 1,
      value: workspace.cwd,
    });
    const removeHandler = makeRemoveHandler(pi);

    // act
    await removeHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [expectedNotification]);
    assert.deepStrictEqual(await readMarketplaceFootprint(workspace.cwd), expectedFootprint);
    assert.strictEqual(workspace.fetchCallCount(), 0);
    verifyBoundary();
  });
}

test("accepts a scope flag beside the scope-target flag and honors the scope it names", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "both-selectors");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    reads: 1,
    value: workspace.cwd,
  });
  const removeHandler = makeRemoveHandler(pi);

  // act
  await removeHandler("alpha --scope user --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: USER_ALPHA_REMOVED }]);
  assert.deepStrictEqual(await readMarketplaceFootprint(workspace.cwd), USER_ALPHA_GONE);
  assert.strictEqual(workspace.fetchCallCount(), 0);
  verifyBoundary();
});

test("supplies the remove usage block beside the unknown-flag sentence and removes nothing (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "unknown-flag");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const removeHandler = makeRemoveHandler(pi);

  // act
  await removeHandler("alpha --frobnicate", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Unknown flag: "--frobnicate".\n\n${REMOVE_USAGE}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readMarketplaceFootprint(workspace.cwd), BOTH_SCOPES_SEEDED);
  assert.strictEqual(workspace.fetchCallCount(), 0);
  verifyBoundary();
});

test("supplies the remove usage block beside a verbatim parse diagnostic and removes nothing (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "invalid-scope");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const removeHandler = makeRemoveHandler(pi);

  // act
  await removeHandler("alpha --scope bogus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Invalid --scope value: "bogus". Must be "user" or "project".\n\n${REMOVE_USAGE}`,
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readMarketplaceFootprint(workspace.cwd), BOTH_SCOPES_SEEDED);
  assert.strictEqual(workspace.fetchCallCount(), 0);
  verifyBoundary();
});

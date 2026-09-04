// Owner for edge/handlers/marketplace/add.ts (MOD-09).
//
// D-116-05 (O3) places this handler in the injected-port group: `deps.gitOps`
// is a declared member of `EdgeDeps` and the shim forwards it into the add
// workflow's options bag. That forward is the exact-argument proof this tier can
// give, so every delegating case drives a url source the workflow MUST clone and
// compares the whole clone recorder of `createGitOpsFake`. Only the identical
// port object the handler was constructed with can produce that recording.
//
// The shim forwards `deps.gitOps` from exactly ONE call site, so one plant
// covers the forward. It forwards its private USAGE string to TWO consumers --
// the flag scan and the positional parse -- so two rejection cases are needed to
// prove both received it, one per consumer.
//
// Every seeded source is `https://gitlab.example.com/team/alpha#main`, a url on a
// host with no registered auth provider. That is the shape that puts the git port
// on the clone path at all (a path source never reaches git) AND keeps the clone
// options structured-clonable: a github source resolves the GitHub provider and
// attaches a credential bundle whose functions make the fake's `structuredClone`
// recorder throw.
//
// The staging directory carries a `randomUUID()` leaf, so the recorded `dir`
// cannot be a hand-authored literal. The recorder is still compared as one whole
// value: a leaf that is a UUID under the EXPECTED scope's staging root is
// substituted for a stable token, and any other directory is compared verbatim,
// so a wrong scope fails on the directory rather than passing silently.
//
// NFR-5: every case also asserts that the door the git transport opens --
// `https.request`, replaced by a counting fail-fast throw -- recorded ZERO
// calls. On the seven clone-carrying rows that zero CAN rise, which is what
// separates it from a regression guard: deleting the handler's single
// `gitOps: deps.gitOps` forward drops the add workflow onto `DEFAULT_GIT_OPS`,
// and the url source is then dialled for real -- measured, the fail-fast fires
// from `simple-get` inside `isomorphic-git/http/node` and exactly those seven
// rows go red. What the zero states there is that the clone was carried out by
// the injected port and never by the real transport. On the path-source row and
// the three rejecting rows the same plant leaves the zero GREEN, because
// neither ever clones; there it is a regression guard, not a measurement.
// `globalThis.fetch` is deliberately NOT the door watched; see
// `installNetworkCounter`.
//
// What this owner proves about scope is where the command LANDED, not an
// argument list it has no injection point against: the scope member reaches the
// workflow inside an options bag, so each delegating case reads back which
// scope's `state.json` and which config file exist on disk. The scope-target flag
// is observable the same way -- it switches the config write-back from
// `claude-plugins.json` to `claude-plugins.local.json` -- which is what makes
// "present only when supplied" provable rather than asserted.
//
// The `pluginUpdate` port is a strict mock with NO expectation stated, so a green
// case is the proof that this handler never touches it. An expectation of zero
// calls would not be, because strong-mock treats that count as no limit.
//
// Arity: the schema declares ONE REQUIRED positional. Zero positionals is
// rejected with the collapsed missing-argument sentence. `parseCommandArgs`
// iterates `schema.positional.entries()` -- the SCHEMA, not the input -- so a
// second token is never inspected and is silently DROPPED; one above the accepted
// arity is not a rejection here, and the row table states the drop.
//
// A scope flag and the scope-target flag supplied together are likewise NOT
// mutually exclusive: `extractLocalFlag` consumes `--scope <value>` as a
// downstream-owned pair and removes only the scope-target token from the
// residual, so both members reach the workflow. The case states that observed
// outcome and proves it by the two effects landing in the same scope root.
//
// No exhaustiveness claim: the module holds no switch and no closed-union
// dispatch, so a missing-arm plant has no target here. No case asserts the
// absence of direct process output (ESLint and fallow own that). The rejection
// cases do not restate the flag-scan rule owned by
// tests/edge/handlers/shared.test.ts, the collapse comparison owned by
// tests/edge/handlers/marketplace/shared.test.ts, or the tokenizer diagnostics
// owned by tests/edge/args.test.ts -- what they add is this handler's own usage
// string reaching each consumer and its early return leaving the workflow, the
// git port, and the disk untouched. None re-derives the add workflow's outcome,
// which belongs to tests/orchestrators/marketplace/add.test.ts.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { mock, verify } from "strong-mock";

import { makeAddHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createGitOpsFake } from "../../../platform/git-ops-fake.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

import type { EdgeDeps } from "../../../../extensions/pi-claude-marketplace/edge/types.ts";
import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

// Both port shapes are derived from the handler's own dependency object, so a
// change to either injection seam is a compile error in this suite rather than a
// silently stale hand-copied type.
type PluginUpdate = EdgeDeps["pluginUpdate"];
type GitCloneCall = ReturnType<typeof createGitOpsFake>["state"]["calls"]["clone"][number];

/** Written out by hand; never read back off the module under test. */
const USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]";

const URL_SOURCE = "https://gitlab.example.com/team/alpha#main";
const CLONE_URL = "https://gitlab.example.com/team/alpha.git";

/** The manifest the cloned staging tree and the path source both carry. */
const MARKETPLACE_MANIFEST = `{
  "name": "seeded",
  "owner": { "name": "seed owner" },
  "plugins": [{ "name": "hello", "source": "./plugins/hello", "version": "1.0.0" }]
}
`;

const USER_ADDED_ROW = "● seeded [user] (added)";
const PROJECT_ADDED_ROW = "● seeded [project] (added)";

/** Stands in for the `randomUUID()` staging leaf, which cannot be a literal. */
const STAGED_CLONE_DIR = "<sources-staging>/<uuid>";
const UUID_LEAF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The single clone a url source pinned to `main` produces, authless. */
const ALPHA_CLONE: GitCloneCall = {
  dir: STAGED_CLONE_DIR,
  url: CLONE_URL,
  ref: "main",
  singleBranch: true,
};

interface ScopeFootprint {
  readonly state: boolean;
  readonly config: boolean;
  readonly localConfig: boolean;
}

interface AddFootprint {
  readonly user: ScopeFootprint;
  readonly project: ScopeFootprint;
}

const NOTHING_WRITTEN: AddFootprint = {
  user: { state: false, config: false, localConfig: false },
  project: { state: false, config: false, localConfig: false },
};

const USER_BASE_CONFIG: AddFootprint = {
  user: { state: true, config: true, localConfig: false },
  project: { state: false, config: false, localConfig: false },
};

const USER_LOCAL_CONFIG: AddFootprint = {
  user: { state: true, config: false, localConfig: true },
  project: { state: false, config: false, localConfig: false },
};

interface HermeticScope {
  readonly cwd: string;
  /** A directory carrying a valid marketplace manifest. */
  readonly sourceTree: string;
  /** How many times the case reached the replaced git transport door. */
  readonly networkCallCount: () => number;
}

/**
 * Replace the door the git transport opens with a counting fail-fast throw
 * owned by the test context, which restores it after the case.
 *
 * Unlike the read-only siblings in this tier, the zero asserted against this
 * counter CAN rise, and that is what makes it a measurement rather than a
 * regression guard: every delegating case drives a URL source the workflow MUST
 * clone, so the git work really happens -- what the zero says is that it was
 * carried out by the INJECTED port and never by the real transport. Measured:
 * with the handler's single `gitOps: deps.gitOps` forward deleted, the add
 * workflow falls back to `DEFAULT_GIT_OPS` and this counter moves off zero.
 *
 * The door is `https.request` because that is the one the git transport opens:
 * `isomorphic-git/http/node` reaches the wire through `simple-get`, which calls
 * `https.request` and never `globalThis.fetch`. A global-fetch spy would record
 * zero here whatever the handler did -- this repository's only `fetch` caller
 * is the device flow in `domain/github-auth.ts`, and every seeded source is a
 * host with no registered auth provider, so no case reaches it.
 */
function installNetworkCounter(t: TestContext): () => number {
  const networkSpy = t.mock.method(https, "request", (): never => {
    throw new Error("the marketplace add must reach git through the injected port");
  });
  return (): number => networkSpy.mock.callCount();
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readScopeFootprint(scope: Scope, cwd: string): Promise<ScopeFootprint> {
  const locations = locationsFor(scope, cwd);
  return {
    state: await exists(locations.stateJsonPath),
    config: await exists(locations.configJsonPath),
    localConfig: await exists(locations.configLocalJsonPath),
  };
}

/** Which scope the command actually landed in, and through which config file. */
async function readAddFootprint(cwd: string): Promise<AddFootprint> {
  return {
    user: await readScopeFootprint("user", cwd),
    project: await readScopeFootprint("project", cwd),
  };
}

function stagingRootFor(scope: Scope, cwd: string): string {
  return path.join(locationsFor(scope, cwd).extensionRoot, "sources-staging");
}

/**
 * Substitute the stable token for a staging leaf that is a UUID under the
 * expected scope's staging root, so the whole recorder stays comparable and a
 * clone into the wrong scope root still fails on its directory.
 */
function describeClone(call: GitCloneCall, stagingRoot: string): GitCloneCall {
  const staged = path.dirname(call.dir) === stagingRoot && UUID_LEAF.test(path.basename(call.dir));
  return { ...call, dir: staged ? STAGED_CLONE_DIR : call.dir };
}

/**
 * One temporary working directory, one temporary home, and one source tree per
 * case, with the agent-directory variable cleared: `getAgentDir()` reads it
 * before `homedir()`, so an ambient value would defeat a hermetic `HOME` (SC-1).
 * Removal and both environment restores are registered before the handler runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `mp-add-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `mp-add-${label}-home-`));
  const sourceTree = await mkdtemp(path.join(tmpdir(), `mp-add-${label}-source-`));
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
    await rm(sourceTree, { recursive: true, force: true });
  });
  await mkdir(path.join(sourceTree, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(sourceTree, ".claude-plugin", "marketplace.json"),
    MARKETPLACE_MANIFEST,
    "utf8",
  );
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  const networkCallCount = installNetworkCounter(t);
  return { cwd, sourceTree, networkCallCount };
}

/** The git port, which only ever admits the one remote a case may reach. */
function createGitPort(sourceTree: string): ReturnType<typeof createGitOpsFake> {
  return createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [CLONE_URL],
    cloneFixture: { boundary: "local", sourceDir: sourceTree },
  });
}

for (const { args, arity } of [
  { args: URL_SOURCE, arity: "at the accepted arity" },
  { args: `${URL_SOURCE} extra`, arity: "with a surplus positional token dropped" },
]) {
  test(`clones through the injected port into the user scope when no scope flag narrows the command ${arity}`, async (t) => {
    // arrange
    const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, "default-scope");
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: cwd,
      reads: 1,
    });
    const git = createGitPort(sourceTree);
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

    // act
    await addHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: USER_ADDED_ROW }]);
    assert.deepStrictEqual(await readAddFootprint(cwd), USER_BASE_CONFIG);
    assert.deepStrictEqual(
      git.state.calls.clone.map((call) => describeClone(call, stagingRootFor("user", cwd))),
      [ALPHA_CLONE],
    );
    assert.strictEqual(networkCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

for (const { footprint, row, scope } of [
  {
    footprint: USER_BASE_CONFIG,
    row: USER_ADDED_ROW,
    scope: "user",
  },
  {
    footprint: {
      user: { state: false, config: false, localConfig: false },
      project: { state: true, config: true, localConfig: false },
    },
    row: PROJECT_ADDED_ROW,
    scope: "project",
  },
] satisfies readonly {
  readonly footprint: AddFootprint;
  readonly row: string;
  readonly scope: Scope;
}[]) {
  test(`clones into the ${scope} scope when --scope ${scope} selects it`, async (t) => {
    // arrange
    const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, `scope-${scope}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: cwd,
      reads: 1,
    });
    const git = createGitPort(sourceTree);
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

    // act
    await addHandler(`${URL_SOURCE} --scope ${scope}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: row }]);
    assert.deepStrictEqual(await readAddFootprint(cwd), footprint);
    assert.deepStrictEqual(
      git.state.calls.clone.map((call) => describeClone(call, stagingRootFor(scope, cwd))),
      [ALPHA_CLONE],
    );
    assert.strictEqual(networkCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

for (const { args, position } of [
  { args: `${URL_SOURCE} --local`, position: "after" },
  { args: `--local ${URL_SOURCE}`, position: "before" },
]) {
  test(`records the marketplace in the per-machine config when the scope-target flag is supplied ${position} the source`, async (t) => {
    // arrange
    const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, `local-${position}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: cwd,
      reads: 1,
    });
    const git = createGitPort(sourceTree);
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

    // act
    await addHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: USER_ADDED_ROW }]);
    assert.deepStrictEqual(await readAddFootprint(cwd), USER_LOCAL_CONFIG);
    assert.deepStrictEqual(
      git.state.calls.clone.map((call) => describeClone(call, stagingRootFor("user", cwd))),
      [ALPHA_CLONE],
    );
    assert.strictEqual(networkCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

test("carries a scope flag and the scope-target flag through together rather than rejecting the pair", async (t) => {
  // arrange
  const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, "scope-and-target");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: cwd,
    reads: 1,
  });
  const git = createGitPort(sourceTree);
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

  // act
  await addHandler(`${URL_SOURCE} --scope project --local`, ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: PROJECT_ADDED_ROW }]);
  assert.deepStrictEqual(await readAddFootprint(cwd), {
    user: { state: false, config: false, localConfig: false },
    project: { state: true, config: false, localConfig: true },
  });
  assert.deepStrictEqual(
    git.state.calls.clone.map((call) => describeClone(call, stagingRootFor("project", cwd))),
    [ALPHA_CLONE],
  );
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

test("adds a path source without ever reaching the git port it was handed (NFR-5)", async (t) => {
  // arrange
  const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, "path-source");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: cwd,
    reads: 1,
  });
  const git = createGitPort(sourceTree);
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

  // act
  await addHandler(sourceTree, ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: USER_ADDED_ROW }]);
  assert.deepStrictEqual(await readAddFootprint(cwd), USER_BASE_CONFIG);
  assert.deepStrictEqual(git.state.calls.clone, []);
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

test("collapses the duplicated usage block to one sentence when no source is supplied and adds nothing", async (t) => {
  // arrange
  const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, "no-source");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const git = createGitPort(sourceTree);
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

  // act
  await addHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Missing required argument.\n\n${USAGE}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readAddFootprint(cwd), NOTHING_WRITTEN);
  assert.deepStrictEqual(git.state.calls.clone, []);
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

test("reports an unknown long flag against the add usage block and adds nothing", async (t) => {
  // arrange
  const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, "unknown-flag");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const git = createGitPort(sourceTree);
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

  // act
  await addHandler(`${URL_SOURCE} --frobnicate`, ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Unknown flag: "--frobnicate".\n\n${USAGE}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readAddFootprint(cwd), NOTHING_WRITTEN);
  assert.deepStrictEqual(git.state.calls.clone, []);
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

test("shows an unrecognised scope value verbatim against the add usage block and adds nothing", async (t) => {
  // arrange
  const { cwd, sourceTree, networkCallCount } = await createHermeticScope(t, "invalid-scope");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const git = createGitPort(sourceTree);
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const addHandler = makeAddHandler(pi, { gitOps: git.gitOps, pluginUpdate });

  // act
  await addHandler(`${URL_SOURCE} --scope bogus`, ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Invalid --scope value: "bogus". Must be "user" or "project".\n\n${USAGE}`,
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readAddFootprint(cwd), NOTHING_WRITTEN);
  assert.deepStrictEqual(git.state.calls.clone, []);
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

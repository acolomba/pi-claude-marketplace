// Owner for edge/handlers/plugin/bootstrap.ts (MOD-09).
//
// This is the one handler in the tier that REJECTS a scope flag instead of
// forwarding it, and one of the two that emit through the probing notification
// path rather than the usage-error path. Both facts are visible in how each case
// sizes the shared boundary: the three rejection sentences reach
// `notifyUsageError`, which probes nothing, so those cases state one emission and
// ZERO probes; the delegating and failure cases reach `notify()`, which runs one
// soft-dependency probe per emission and reads the tool list twice per probe, so
// they state two probes per emission. Every count here was measured against the
// real module through a counting context before a line was written: the workflow
// emits twice (add, then autoupdate) and the failure conversion emits once, and
// the handler reads `ctx.cwd` exactly once on the path that reaches the workflow
// and never on a rejection path.
//
// D-116-05 (O3) places this handler in the injected-port group: `deps.gitOps` is
// threaded into the bootstrap workflow at one real call site (the module's other
// mention of it is its own header comment), so the port itself is the seam. What
// the clone recorder pins was narrowed to what a plant can measure: the git
// operation the workflow performs is CARRIED OUT BY the injected implementation.
// A port re-boxed as a spread copy, and a port with one member wrapped around a
// call back into the injected one, both still record, so no case claims object
// identity or member identity. A port whose implementation is replaced records
// nothing and turns both clone-carrying cases red.
//
// The bootstrap source is a hard-coded github shorthand, and a github source
// resolves the GitHub provider, which attaches a credential bundle whose
// functions are not structured-clonable -- `createGitOpsFake` records each call
// with `structuredClone`, so the raw fake throws inside its own recorder before
// the workflow can run. The port therefore drops that downstream-owned bundle and
// delegates every operation, including the clone itself, to the fake. It is not a
// hand-rolled object of git functions: every member is the fake's own.
//
// The staging directory carries a `randomUUID()` leaf, so the recorded `dir`
// cannot be a hand-authored literal. The recorder is still compared as one whole
// value: a leaf that is a UUID under the USER scope's staging root is substituted
// for a stable token and any other directory is compared verbatim, so a clone
// staged under the wrong scope root fails on its raw directory.
//
// The delegating case asserts the clone recorder and the boundary sizing, not the
// two notification bodies the workflow renders: those belong to
// tests/orchestrators/plugin/bootstrap.test.ts and its two composed orchestrator
// pairs. An exact `times(2)` on the boundary is what proves the workflow ran to
// completion here. The failure row is the opposite case -- the handler builds that
// payload itself, so its rendered bytes are this owner's to claim, and the thrown
// error carries a sentinel message that the compared value proves never reaches
// the user channel.
//
// Arity: this handler parses raw arguments with `parseArgs` and rejects a
// non-empty positional list itself, so the accepted arity is ZERO positionals and
// one above it IS a rejection -- unlike the `parseCommandArgs` siblings, which
// walk the schema and drop surplus tokens. There is no count below zero, so that
// half of the arity claim has no target here and no case asserts it.
//
// The scope-target flag is not a mutually exclusive selector against `--scope`
// either: this handler never reaches `extractLocalFlag`, so `--local` is an
// ordinary token that lands on `positional`. Supplied beside a scope flag it is
// rejected by the positional guard before the scope guard is consulted, which is
// what pins the order of the three guards; the unrecognised-scope rows pin the
// parse failure ahead of both, by driving one row with a positional token already
// present.
//
// The rejection cases build the plugin-update port as a strict mock with NO
// stated expectation, so a green case proves the handler never touches it, and
// they omit the boundary's `cwd`, so the early return is proven to read nothing
// off the context.
//
// No exhaustiveness claim: the module holds no switch and no closed-union
// dispatch, so a missing-arm plant has no target here. No case asserts the
// absence of direct process output (ESLint and fallow own that), and none
// restates the tokenizer or scope-validator rules owned by
// tests/edge/args.test.ts -- the unrecognised-scope rows claim that this
// handler's own usage block reached the catch-and-notify path and that the
// workflow never started.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { mock, verify } from "strong-mock";

import { makeBootstrapHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts";
import { BOOTSTRAP_MARKETPLACE_NAME } from "../../../../extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";
import { createGitOpsFake } from "../../../platform/git-ops-fake.ts";

import type { EdgeDeps } from "../../../../extensions/pi-claude-marketplace/edge/types.ts";
import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

// Both port shapes are derived from the handler's own dependency object, so a
// change to either injection seam is a compile error in this suite rather than a
// silently stale hand-copied type.
type PluginUpdate = EdgeDeps["pluginUpdate"];
type GitCloneCall = ReturnType<typeof createGitOpsFake>["state"]["calls"]["clone"][number];

/** Each written out by hand; never read back off the module under test. */
const NO_ARGUMENTS_MESSAGE = "bootstrap takes no arguments.\n\nUsage: /claude:plugin bootstrap";

const SCOPE_NOT_ACCEPTED_MESSAGE =
  "bootstrap does not accept --scope; it always targets user scope.\n\nUsage: /claude:plugin bootstrap";

const INVALID_SCOPE_MESSAGE =
  'Invalid --scope value: "nope". Must be "user" or "project".\n\nUsage: /claude:plugin bootstrap';

/**
 * The row the handler's own catch builds. The marketplace name comes from the
 * orchestrator constant because that module owns it; everything else -- the
 * failure header, the failed glyph, the user scope bracket and the status token
 * -- is written out by hand.
 */
const FAILED_ROW_MESSAGE = `A marketplace operation has failed.\n\n⊘ ${BOOTSTRAP_MARKETPLACE_NAME} [user] (failed)`;

/** Distinctive enough that the compared row proves it never reached the user. */
const REFUSED_CLONE_MESSAGE = "@@the injected git port refused this clone@@";

const CLONE_URL = "https://github.com/anthropics/claude-plugins-official.git";

/** Stands in for the `randomUUID()` staging leaf, which cannot be a literal. */
const STAGED_CLONE_DIR = "<sources-staging>/<uuid>";
const UUID_LEAF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The single clone the hard-coded github shorthand produces, authless. */
const BOOTSTRAP_CLONE: GitCloneCall = { dir: STAGED_CLONE_DIR, url: CLONE_URL };

/** The manifest the cloned staging tree carries. */
const MARKETPLACE_MANIFEST = `{
  "name": "${BOOTSTRAP_MARKETPLACE_NAME}",
  "owner": { "name": "seed owner" },
  "plugins": [{ "name": "hello", "source": "./plugins/hello", "version": "1.0.0" }]
}
`;

interface HermeticScope {
  readonly cwd: string;
  readonly sourceTree: string;
  /** How many times the case reached the replaced process-wide transport. */
  readonly fetchCallCount: () => number;
}

interface GitPort {
  readonly gitOps: EdgeDeps["gitOps"];
  readonly clones: readonly GitCloneCall[];
}

function refuseNetwork(): Promise<Response> {
  throw new Error("the bootstrap handler must reach git through the injected port");
}

/**
 * One temporary working directory, one temporary home, and one source tree per
 * case, with the agent-directory variable cleared: `getAgentDir()` reads it
 * before `homedir()`, so an ambient value would defeat a hermetic `HOME` (SC-1).
 * Removal and both environment restores are registered before the handler runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-bootstrap-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-bootstrap-${label}-home-`));
  const sourceTree = await mkdtemp(path.join(tmpdir(), `plugin-bootstrap-${label}-source-`));
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
  const fetchSpy = t.mock.method(globalThis, "fetch", refuseNetwork);
  return {
    cwd,
    sourceTree,
    fetchCallCount: (): number => fetchSpy.mock.callCount(),
  };
}

/**
 * The git port, which admits only the one remote a case may reach and drops the
 * GitHub credential bundle the provider attaches, because the recorder clones
 * every call structurally and a function member cannot survive that. Every
 * operation, the clone included, is the fake's own.
 */
function createGitPort(sourceTree: string, cloneError?: Error): GitPort {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [CLONE_URL],
    cloneFixture: { boundary: "local", sourceDir: sourceTree },
    ...(cloneError === undefined ? {} : { cloneError }),
  });
  const gitOps: EdgeDeps["gitOps"] = {
    ...git.gitOps,
    async clone(cloneOptions) {
      const { auth: _auth, ...cloneOptionsWithoutCredentials } = cloneOptions;
      await git.gitOps.clone(cloneOptionsWithoutCredentials);
    },
  };

  return { gitOps, clones: git.state.calls.clone };
}

function userStagingRoot(cwd: string): string {
  return path.join(locationsFor("user" satisfies Scope, cwd).extensionRoot, "sources-staging");
}

/**
 * Substitute the stable token for a staging leaf that is a UUID under the user
 * scope's staging root, so the whole recorder stays comparable and a clone staged
 * anywhere else still fails on its directory.
 */
function describeClones(clones: readonly GitCloneCall[], stagingRoot: string): GitCloneCall[] {
  return clones.map((call) => {
    const staged =
      path.dirname(call.dir) === stagingRoot && UUID_LEAF.test(path.basename(call.dir));
    return { ...call, dir: staged ? STAGED_CLONE_DIR : call.dir };
  });
}

test("clones through the injected git port into the user scope at the accepted arity", async (t) => {
  // arrange
  const { cwd, sourceTree, fetchCallCount } = await createHermeticScope(t, "accepted");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(2, 4, { value: cwd, reads: 1 });
  const git = createGitPort(sourceTree);
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const bootstrapHandler = makeBootstrapHandler(pi, { gitOps: git.gitOps, pluginUpdate });

  // act
  await bootstrapHandler("", ctx);

  // assert
  assert.deepStrictEqual(describeClones(git.clones, userStagingRoot(cwd)), [BOOTSTRAP_CLONE]);
  assert.strictEqual(fetchCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

for (const { args, label, tokens } of [
  { args: "official", label: "one", tokens: "a single positional token" },
  { args: "official extra", label: "two", tokens: "two positional tokens" },
]) {
  test(`rejects ${tokens} with the no-arguments sentence and never reaches the workflow`, async (t) => {
    // arrange
    const { sourceTree, fetchCallCount } = await createHermeticScope(t, `positional-${label}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const git = createGitPort(sourceTree);
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    const bootstrapHandler = makeBootstrapHandler(pi, { gitOps: git.gitOps, pluginUpdate });

    // act
    await bootstrapHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: NO_ARGUMENTS_MESSAGE, severity: "error" }]);
    assert.deepStrictEqual(git.clones, []);
    assert.strictEqual(fetchCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

for (const scope of ["user", "project"] satisfies readonly Scope[]) {
  test(`rejects --scope ${scope} as never accepted, because bootstrap always targets the user scope`, async (t) => {
    // arrange
    const { sourceTree, fetchCallCount } = await createHermeticScope(t, `scope-${scope}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const git = createGitPort(sourceTree);
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    const bootstrapHandler = makeBootstrapHandler(pi, { gitOps: git.gitOps, pluginUpdate });

    // act
    await bootstrapHandler(`--scope ${scope}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: SCOPE_NOT_ACCEPTED_MESSAGE, severity: "error" },
    ]);
    assert.deepStrictEqual(git.clones, []);
    assert.strictEqual(fetchCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

for (const { args, label, subject } of [
  { args: "--local", label: "alone", subject: "when it is the only token" },
  {
    args: "--scope user --local",
    label: "with-scope",
    subject: "before the scope guard is consulted",
  },
]) {
  test(`takes the scope-target flag as a positional and rejects it ${subject}`, async (t) => {
    // arrange
    const { sourceTree, fetchCallCount } = await createHermeticScope(t, `scope-target-${label}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const git = createGitPort(sourceTree);
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    const bootstrapHandler = makeBootstrapHandler(pi, { gitOps: git.gitOps, pluginUpdate });

    // act
    await bootstrapHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: NO_ARGUMENTS_MESSAGE, severity: "error" }]);
    assert.deepStrictEqual(git.clones, []);
    assert.strictEqual(fetchCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

for (const { args, label, subject } of [
  { args: "--scope nope", label: "bare", subject: "no positional token accompanies it" },
  {
    args: "extra --scope nope",
    label: "with-positional",
    subject: "a positional token is already present",
  },
]) {
  test(`reports an unrecognised scope value with the bootstrap usage block when ${subject}`, async (t) => {
    // arrange
    const { sourceTree, fetchCallCount } = await createHermeticScope(t, `invalid-scope-${label}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const git = createGitPort(sourceTree);
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    const bootstrapHandler = makeBootstrapHandler(pi, { gitOps: git.gitOps, pluginUpdate });

    // act
    await bootstrapHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: INVALID_SCOPE_MESSAGE, severity: "error" }]);
    assert.deepStrictEqual(git.clones, []);
    assert.strictEqual(fetchCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

test("converts a thrown bootstrap failure into one failed marketplace row carrying no error text", async (t) => {
  // arrange
  const { cwd, sourceTree, fetchCallCount } = await createHermeticScope(t, "failure");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: cwd,
    reads: 1,
  });
  const git = createGitPort(sourceTree, new Error(REFUSED_CLONE_MESSAGE));
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const bootstrapHandler = makeBootstrapHandler(pi, { gitOps: git.gitOps, pluginUpdate });

  // act
  await bootstrapHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: FAILED_ROW_MESSAGE, severity: "error" }]);
  assert.deepStrictEqual(describeClones(git.clones, userStagingRoot(cwd)), [BOOTSTRAP_CLONE]);
  assert.strictEqual(fetchCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

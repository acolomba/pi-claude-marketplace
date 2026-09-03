// Owner for edge/handlers/plugin/import.ts (MOD-09).
//
// D-116-05 (O3) places this handler alone in the real-seam group. Its dependency
// object declares an OPTIONAL `importClaudeSettings` member and the handler calls
// that member when supplied, so the whole options bag the orchestrator receives
// is statable in a strict interaction mock. That makes this the one handler owner
// in the tier whose exact-argument promise is literal rather than observed
// through a port recorder or an on-disk footprint: every delegating case states
// the COMPLETE object -- context, Pi handle, working directory, selected scopes,
// and git port -- with no wildcard matcher, and ends in `verify()`.
//
// The git-port forward rides in that same stated object, and what it pins was
// measured rather than assumed: strong-mock compares the options bag
// structurally, so a spread copy of the injected port still matches while a port
// whose methods are substituted or wrapped does not. What the stated `gitOps`
// member therefore proves is that every git operation the workflow performs runs
// through the injected implementation, which is the property worth pinning; a
// plant that wraps one method turns every delegating case red.
//
// Every rejection case builds the delegate as a mock with NO stated expectation,
// which throws on any call, so a green case is the proof that the workflow never
// started. It also omits the boundary's `cwd`, so the early return is proven to
// read nothing off the context as well.
//
// The absent member is a distinct branch of `deps.importClaudeSettings ??
// importClaudeSettings`, and the only way to cover it is to let the real import
// workflow run. That case owns a hermetic tree with no Claude settings in either
// scope, so the workflow's minimal observable effect is its empty cascade
// notification. It is not a re-derivation of the import outcome, which belongs to
// tests/orchestrators/import/execute.test.ts.
//
// Arity: this handler parses raw arguments with `parseArgs` and rejects a
// non-empty positional list itself, so the accepted arity is ZERO positionals and
// one above it IS a rejection -- unlike the `parseCommandArgs` siblings, which
// walk the schema and drop surplus tokens. There is no count below zero, so that
// half of the arity claim has no target here and no case asserts it.
//
// The scope-target flag is likewise not a mutually exclusive selector against
// `--scope`: this handler never reaches `extractLocalFlag`, so `--local` is an
// ordinary token that lands on `positional` and is rejected by the arity rule
// before the scope value is ever consulted. The case states that measured
// outcome rather than a rejection the module does not perform.
//
// D-116-01a: this pair lands one branch short of complete, with lines and
// functions both complete. The `String(err)` arm of `err instanceof Error ?
// err.message : String(err)` at import.ts:31 cannot be entered at runtime. The
// only throw that reaches that catch comes from `parseArgs`, which throws
// `new Error(...)` at both of its throw sites, so no input can deliver a
// non-error value there. The arm exists only because a `catch (err)` binding is
// typed `unknown` under `useUnknownInCatchVariables`; narrowing it needs a type
// assertion, which is barred throughout this tree. The claim is measured, not
// inspected: a brute force over the reachable argument space produced an `Error`
// at every throw, and a plant that replaced the arm's expression left the whole
// suite green. No coverage exception is added and no production file is changed.
//
// No exhaustiveness claim: the module holds no switch and no closed-union
// dispatch, so a missing-arm plant has no target here. No case asserts the
// absence of direct process output (ESLint and fallow own that), none restates
// the tokenizer rules owned by tests/edge/args.test.ts, and none re-derives the
// import workflow's outcome.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  makeImportHandler,
  type ImportHandlerDeps,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";
import { createGitOpsFake } from "../../../platform/git-ops-fake.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

// Derived from the handler's own dependency object, so a change to the injection
// seam is a compile error in this suite rather than a silently stale hand-copied
// type.
type ImportDelegate = NonNullable<ImportHandlerDeps["importClaudeSettings"]>;
type ImportOutcome = Awaited<ReturnType<ImportDelegate>>;

/** Written out by hand; never read back off the module under test. */
const NO_POSITIONALS_MESSAGE =
  "import does not accept positional arguments.\n\nUsage: /claude:plugin import [--scope user|project]";

const INVALID_SCOPE_MESSAGE =
  'Invalid --scope value: "bad". Must be "user" or "project".\n\nUsage: /claude:plugin import [--scope user|project]';

/** The whole cascade an import over a tree with no Claude settings renders. */
const EMPTY_CASCADE_MESSAGE = "(no marketplaces)";

interface HermeticScope {
  readonly cwd: string;
}

/**
 * Replace the door the git transport opens with a fail-fast throw owned by the
 * test context, which restores it after the case.
 *
 * A HERMETICITY DEVICE, not an offline proof, and no case asserts a call count
 * against it. Every delegating case states the import delegate as a strict mock,
 * so no workflow runs at all; the one case that DOES run the real workflow owns
 * a tree with no Claude settings in either scope, so its cascade is empty and
 * nothing is ever resolved. Neither fixture can reach a transport, so a zero
 * asserted over them could not rise. The value of the replacement is that a
 * dial-out reached from either fixture fails the case where it happens.
 *
 * The door is `https.request` because that is the one the git transport opens:
 * `isomorphic-git/http/node` reaches the wire through `simple-get`, which calls
 * `https.request`. `globalThis.fetch` is NOT watched -- its only production
 * caller in this repository is the device flow in `domain/github-auth.ts`,
 * which an empty cascade never enters.
 */
function installNetworkTrap(t: TestContext): void {
  t.mock.method(https, "request", (): never => {
    throw new Error("the import handler must reach git through the injected port");
  });
}

/** The cascade outcome the injected delegate promises when nothing is planned. */
function nothingImported(): ImportOutcome {
  return {
    addedMarketplaces: [],
    installedPlugins: [],
    skippedExistingMarketplaces: [],
    skippedExistingPlugins: [],
    warnings: [],
    marketplaceFailures: [],
    sourceMismatches: [],
    unexpectedPluginFailures: [],
    diagnostics: [],
    changedResources: false,
  };
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). Removal and both
 * environment restores are registered before the handler runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-import-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-import-${label}-home-`));
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
  return { cwd };
}

test("imports the project scope before the user scope when no scope flag narrows the command", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "both-scopes");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(0, 0, {
    value: cwd,
    reads: 1,
  });
  const git = createGitOpsFake({ boundary: "memory" });
  const importClaudeSettings = mock<ImportDelegate>({
    exactParams: true,
    name: "import claude settings",
  });
  when(() =>
    importClaudeSettings({
      ctx,
      pi,
      cwd,
      selectedScopes: ["project", "user"],
      gitOps: git.gitOps,
    }),
  ).thenResolve(nothingImported());
  const importHandler = makeImportHandler(pi, { gitOps: git.gitOps, importClaudeSettings });

  // act
  await importHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(git.state.calls.clone, []);
  verifyBoundary();
  verify(importClaudeSettings);
});

for (const scope of ["project", "user"] satisfies readonly Scope[]) {
  test(`imports the ${scope} scope alone when --scope ${scope} narrows the command`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, `scope-${scope}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(0, 0, {
      value: cwd,
      reads: 1,
    });
    const git = createGitOpsFake({ boundary: "memory" });
    const importClaudeSettings = mock<ImportDelegate>({
      exactParams: true,
      name: "import claude settings",
    });
    when(() =>
      importClaudeSettings({
        ctx,
        pi,
        cwd,
        selectedScopes: [scope],
        gitOps: git.gitOps,
      }),
    ).thenResolve(nothingImported());
    const importHandler = makeImportHandler(pi, { gitOps: git.gitOps, importClaudeSettings });

    // act
    await importHandler(`--scope ${scope}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(git.state.calls.clone, []);
    verifyBoundary();
    verify(importClaudeSettings);
  });
}

test("runs the real import workflow when the dependency object declares no delegate", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "no-delegate");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: cwd,
    reads: 1,
  });
  const git = createGitOpsFake({ boundary: "memory" });
  const importHandler = makeImportHandler(pi, { gitOps: git.gitOps });

  // act
  await importHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: EMPTY_CASCADE_MESSAGE }]);
  assert.deepStrictEqual(git.state.calls.clone, []);
  verifyBoundary();
});

for (const { args, label, tokens } of [
  { args: "settings.json", label: "one", tokens: "a single positional token" },
  { args: "settings.json extra", label: "two", tokens: "two positional tokens" },
]) {
  test(`rejects ${tokens} with the import usage block and never imports`, async (t) => {
    // arrange
    await createHermeticScope(t, `positional-${label}`);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const git = createGitOpsFake({ boundary: "memory" });
    const importClaudeSettings = mock<ImportDelegate>({
      exactParams: true,
      name: "import claude settings",
    });
    const importHandler = makeImportHandler(pi, { gitOps: git.gitOps, importClaudeSettings });

    // act
    await importHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: NO_POSITIONALS_MESSAGE, severity: "error" }]);
    assert.deepStrictEqual(git.state.calls.clone, []);
    verifyBoundary();
    verify(importClaudeSettings);
  });
}

test("reports an unrecognised scope value with the import usage block and never imports", async (t) => {
  // arrange
  await createHermeticScope(t, "invalid-scope");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const git = createGitOpsFake({ boundary: "memory" });
  const importClaudeSettings = mock<ImportDelegate>({
    exactParams: true,
    name: "import claude settings",
  });
  const importHandler = makeImportHandler(pi, { gitOps: git.gitOps, importClaudeSettings });

  // act
  await importHandler("--scope bad", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: INVALID_SCOPE_MESSAGE, severity: "error" }]);
  assert.deepStrictEqual(git.state.calls.clone, []);
  verifyBoundary();
  verify(importClaudeSettings);
});

test("takes the scope-target flag as a positional and rejects it alongside a scope flag", async (t) => {
  // arrange
  await createHermeticScope(t, "scope-target");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const git = createGitOpsFake({ boundary: "memory" });
  const importClaudeSettings = mock<ImportDelegate>({
    exactParams: true,
    name: "import claude settings",
  });
  const importHandler = makeImportHandler(pi, { gitOps: git.gitOps, importClaudeSettings });

  // act
  await importHandler("--scope user --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: NO_POSITIONALS_MESSAGE, severity: "error" }]);
  assert.deepStrictEqual(git.state.calls.clone, []);
  verifyBoundary();
  verify(importClaudeSettings);
});

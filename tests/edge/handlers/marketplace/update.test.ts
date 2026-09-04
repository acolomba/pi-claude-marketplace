// Owner for edge/handlers/marketplace/update.ts (MOD-09).
//
// The shim's real promise is a two-way workflow selection driven purely by
// argument arity: no positional selects `updateAllMarketplaces`, one positional
// selects `updateMarketplace`. Both arms forward the same two injected ports,
// so every delegating case seeds THREE marketplaces -- `alpha` and `beta` in the
// project scope and a second `alpha` in the user scope -- and compares the git
// port's whole fetch recorder. A single-marketplace run records one fetch and an
// all-marketplaces run records three, so the recorder discriminates the two arms
// rather than merely showing that one of them ran.
//
// D-116-05 (O3) places this handler in the injected-port group: `deps.gitOps`
// and `deps.pluginUpdate` are declared members of `EdgeDeps`, so the plugin
// update port is a strict interaction mock with exact-parameter matching and the
// git port is `createGitOpsFake`. Both recordings are only possible if the
// identical port objects the handler was constructed with reached the workflow.
//
// Every seeded marketplace is a url source pinned to `main`, which is the shape
// that puts the git port on the refresh path at all: a path source never reaches
// git. The project-scope `alpha` is the only marketplace with autoupdate on and
// the only one carrying an installed plugin, so the cascade -- and therefore the
// plugin update port -- fires on exactly the two selection cases and on no other.
//
// The refresh leaves each manifest byte-identical, so every row is the
// `(skipped) {up-to-date}` no-op. That keeps each delegation a minimal effect
// rather than a re-derivation of the update workflow's own detail tokens, which
// belong to tests/orchestrators/marketplace/update.test.ts.
//
// NFR-5: every case also asserts that the door the git transport opens --
// `https.request`, replaced by a counting fail-fast throw -- recorded ZERO
// calls. That zero is a REGRESSION GUARD WITH NO POSITIVE CONTROL, measured to
// be one rather than assumed to be one: no reachable input moves this counter,
// because the refresh path dies inside `isomorphic-git` before the transport.
// The fetch RECORDER, not the zero, is what carries the delegation claim. See
// `installNetworkCounter` for the measurement.
//
// Arity: the positional schema declares ONE optional entry, so zero and one
// positional are both accepted and there is no count below the accepted range.
// `parseCommandArgs` walks the SCHEMA rather than the input, so a second
// positional is never inspected and is silently dropped -- one above the range
// is not a rejection here, and the row table states the drop.
//
// The parse-failure callback collapses a diagnostic equal to the usage string to
// `Missing required argument.`; with the only positional declared optional,
// `parseCommandArgs` never calls back with the usage string, so that arm has no
// reachable target through the module's exports and no case can discriminate it.
// The reachable half -- a tokenizer diagnostic reaching the user verbatim -- is
// what the rejection case pins.
//
// D-116-01a: this pair lands one branch short of complete. The
// `message === USAGE` arm at update.ts:41 -- the collapse half of
// `message === USAGE ? "Missing required argument." : message` -- cannot be
// entered at runtime through this handler. No compiler setting forces it; it is
// dead here for a structural reason. `parseCommandArgs` passes the usage string
// to the callback only for a REQUIRED positional, and this schema declares its
// sole positional `required: false`, so the callback is only ever reached with a
// tokenizer diagnostic, which can never equal the usage string. The same arm is
// LIVE for the sibling handlers that declare a required positional, so the
// shortfall is a property of this module, not of the collapse expression.
//
// The claim is measured, not inspected: 170 argument shapes produced no
// notification beginning `Missing required argument.`; a plant that replaced the
// arm's literal left all 7 cases green; and an inverted-condition plant
// (`message !== USAGE`) turned the rejection case red, proving the pass-through
// arm is the one that runs. The shortfall is pinned by its identity -- functions
// and lines complete, and exactly ONE uncovered branch -- never by an absolute
// branch pair, because the branch denominator tracks suite strength rather than
// the source. No coverage exception is added and no production file is changed.
//
// No exhaustiveness claim: the selection is an `if` over an optional value, not a
// switch over a closed union, so a missing-arm plant has no target here. No case
// asserts the absence of direct process output (ESLint and fallow own that), none
// restates the tokenizer rules owned by tests/edge/args.test.ts or the positional
// schema owned by tests/edge/args-schema.test.ts, and none re-derives either
// update workflow's outcome.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import { makeMarketplaceUpdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createGitOpsFake } from "../../../platform/git-ops-fake.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";
import { mergeMarketplaceIntoState, seedAutoupdateConfig } from "../marketplace-seed.ts";

import type { EdgeDeps } from "../../../../extensions/pi-claude-marketplace/edge/types.ts";
import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

// Both port shapes are derived from the handler's own dependency object, so a
// change to either injection seam is a compile error in this suite rather than a
// silently stale hand-copied type.
type PluginUpdate = EdgeDeps["pluginUpdate"];
type PluginUpdateOutcome = Awaited<ReturnType<PluginUpdate>>;
type GitFetchCall = ReturnType<typeof createGitOpsFake>["state"]["calls"]["fetch"][number];

/** Written out by hand; never read back off the module under test. */
const USAGE = "Usage: /claude:plugin marketplace update [<name>] [--scope user|project]";

const PROJECT_ALPHA_ROW = "● alpha [project] (skipped) {up-to-date}";
const PROJECT_BETA_ROW = "● beta [project] (skipped) {up-to-date}";
const USER_ALPHA_ROW = "● alpha [user] (skipped) {up-to-date}";

/** The manifest both the pre- and post-refresh reads see, so every row is a no-op. */
const MARKETPLACE_MANIFEST = `{
  "name": "seeded",
  "owner": { "name": "seed owner" },
  "plugins": [{ "name": "hello", "source": "./plugins/hello", "version": "1.0.0" }]
}
`;

interface HermeticScope {
  readonly cwd: string;
  /** How many times the case reached the replaced git transport door. */
  readonly networkCallCount: () => number;
}

interface SeededClones {
  readonly projectAlpha: string;
  readonly projectBeta: string;
  readonly userAlpha: string;
}

/**
 * Replace the door the git transport opens with a counting fail-fast throw
 * owned by the test context, which restores it after the case.
 *
 * The zero asserted against this counter is an NFR-5 REGRESSION GUARD WITH NO
 * POSITIVE CONTROL, not a discriminated proof, and that limit was measured
 * rather than assumed. The fixture is not vacuous -- every seeded marketplace
 * is a url source the workflow really refreshes -- but no reachable input opens
 * the door. With both `gitOps: deps.gitOps` forwards deleted, so the workflow
 * falls back to `DEFAULT_GIT_OPS`, five of the seven cases go red on their
 * MESSAGE (`{network unreachable}`, cause `The function requires a "remote OR
 * url" parameter but none was provided`) while this counter stays at exactly
 * ZERO: the refresh path dies inside `isomorphic-git` on a staged clone with no
 * configured remote, one step before the transport. Having the git door in the
 * import graph is not the same as having a route that opens it.
 *
 * What carries the delegation claim here is therefore the fetch RECORDER beside
 * this zero, never the zero itself.
 *
 * The door is `https.request` because that is the one the git transport opens:
 * `isomorphic-git/http/node` reaches the wire through `simple-get`, which calls
 * `https.request` and never `globalThis.fetch`. A global-fetch spy would record
 * zero here whatever the handler did -- this repository's only `fetch` caller
 * is the device flow in `domain/github-auth.ts`, and every seeded source sits
 * on a host with no registered auth provider, so no case reaches it.
 */
function installNetworkCounter(t: TestContext): () => number {
  const networkSpy = t.mock.method(https, "request", (): never => {
    throw new Error("the marketplace update must reach git through the injected port");
  });
  return (): number => networkSpy.mock.callCount();
}

/** The single fetch a clone pinned to `main` produces on the refresh path. */
function fetchOf(cloneDir: string): GitFetchCall {
  return { dir: cloneDir, remote: "origin", ref: "main" };
}

/** The cascade outcome the injected plugin update port promises. */
function unchangedHello(): PluginUpdateOutcome {
  return {
    partition: "unchanged",
    name: "hello",
    fromVersion: "0.0.1",
    toVersion: "0.0.1",
    declaresAgents: false,
    declaresMcp: false,
  };
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). Removal and both
 * environment restores are registered before the handler runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `mp-update-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `mp-update-${label}-home-`));
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
  const networkCallCount = installNetworkCounter(t);
  return { cwd, networkCallCount };
}

/**
 * Seed one url-source marketplace pinned to `main` and return its clone
 * directory. A url source on a host with no registered auth provider refreshes
 * authless, so the git port receives a fetch carrying no credential bundle.
 */
async function seedMarketplace(opts: {
  readonly cwd: string;
  readonly scope: Scope;
  readonly name: string;
  readonly cascades?: readonly string[];
}): Promise<string> {
  const locations = locationsFor(opts.scope, opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const cloneDir = await locations.sourceCloneDir(opts.name);
  const manifestPath = path.join(cloneDir, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, MARKETPLACE_MANIFEST, "utf8");
  const plugins: Record<string, unknown> = {};
  for (const plugin of opts.cascades ?? []) {
    plugins[plugin] = {
      version: "0.0.1",
      resolvedSource: `./plugins/${plugin}`,
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
      enabled: true,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  await mergeMarketplaceIntoState(locations.extensionRoot, opts.name, {
    name: opts.name,
    scope: opts.scope,
    source: {
      kind: "url",
      raw: `https://gitlab.example.com/team/${opts.name}#main`,
      url: `https://gitlab.example.com/team/${opts.name}`,
      ref: "main",
    },
    addedFromCwd: opts.cwd,
    manifestPath,
    marketplaceRoot: cloneDir,
    plugins,
  });
  if (opts.cascades !== undefined) {
    await seedAutoupdateConfig(locations, opts.name, true);
  }

  return cloneDir;
}

/**
 * `alpha` and `beta` in the project scope and a second `alpha` in the user
 * scope. Only the project `alpha` cascades, so the plugin update port fires on
 * exactly the runs that reach it.
 */
async function seedThreeMarketplaces(cwd: string): Promise<SeededClones> {
  const projectAlpha = await seedMarketplace({
    cwd,
    scope: "project",
    name: "alpha",
    cascades: ["hello"],
  });
  const projectBeta = await seedMarketplace({ cwd, scope: "project", name: "beta" });
  const userAlpha = await seedMarketplace({ cwd, scope: "user", name: "alpha" });
  return { projectAlpha, projectBeta, userAlpha };
}

test("updates every recorded marketplace in both scopes when no name is supplied", async (t) => {
  // arrange
  const { cwd, networkCallCount } = await createHermeticScope(t, "all");
  const clones = await seedThreeMarketplaces(cwd);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(3, 6, {
    value: cwd,
    reads: 1,
  });
  const git = createGitOpsFake({ boundary: "memory" });
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  when(() => pluginUpdate("hello", "alpha", "project")).thenResolve(unchangedHello());
  const marketplaceUpdateHandler = makeMarketplaceUpdateHandler(pi, {
    gitOps: git.gitOps,
    pluginUpdate,
  });

  // act
  await marketplaceUpdateHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: PROJECT_ALPHA_ROW },
    { message: PROJECT_BETA_ROW },
    { message: USER_ALPHA_ROW },
  ]);
  assert.deepStrictEqual(git.state.calls.fetch, [
    fetchOf(clones.projectAlpha),
    fetchOf(clones.projectBeta),
    fetchOf(clones.userAlpha),
  ]);
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

for (const { args, label, arity } of [
  { args: "alpha", label: "named", arity: "at the accepted arity" },
  { args: "alpha extra", label: "surplus", arity: "with a surplus positional token dropped" },
]) {
  test(`updates the named marketplace alone and leaves its siblings untouched ${arity}`, async (t) => {
    // arrange
    const { cwd, networkCallCount } = await createHermeticScope(t, label);
    const clones = await seedThreeMarketplaces(cwd);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: cwd,
      reads: 1,
    });
    const git = createGitOpsFake({ boundary: "memory" });
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    when(() => pluginUpdate("hello", "alpha", "project")).thenResolve(unchangedHello());
    const marketplaceUpdateHandler = makeMarketplaceUpdateHandler(pi, {
      gitOps: git.gitOps,
      pluginUpdate,
    });

    // act
    await marketplaceUpdateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: PROJECT_ALPHA_ROW }]);
    assert.deepStrictEqual(git.state.calls.fetch, [fetchOf(clones.projectAlpha)]);
    assert.strictEqual(networkCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

for (const { emissions, probes, rows, scope, touched } of [
  {
    emissions: 1,
    probes: 2,
    rows: [USER_ALPHA_ROW],
    scope: "user",
    touched: (clones: SeededClones): readonly string[] => [clones.userAlpha],
  },
  {
    emissions: 2,
    probes: 4,
    rows: [PROJECT_ALPHA_ROW, PROJECT_BETA_ROW],
    scope: "project",
    touched: (clones: SeededClones): readonly string[] => [clones.projectAlpha, clones.projectBeta],
  },
] satisfies readonly {
  readonly emissions: number;
  readonly probes: number;
  readonly rows: readonly string[];
  readonly scope: Scope;
  readonly touched: (clones: SeededClones) => readonly string[];
}[]) {
  test(`updates the ${scope} scope alone when --scope ${scope} narrows the command`, async (t) => {
    // arrange
    const { cwd, networkCallCount } = await createHermeticScope(t, `scope-${scope}`);
    const clones = await seedThreeMarketplaces(cwd);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(
      emissions,
      probes,
      {
        value: cwd,
        reads: 1,
      },
    );
    const git = createGitOpsFake({ boundary: "memory" });
    const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
    if (scope === "project") {
      when(() => pluginUpdate("hello", "alpha", "project")).thenResolve(unchangedHello());
    }

    const marketplaceUpdateHandler = makeMarketplaceUpdateHandler(pi, {
      gitOps: git.gitOps,
      pluginUpdate,
    });

    // act
    await marketplaceUpdateHandler(`--scope ${scope}`, ctx);

    // assert
    assert.deepStrictEqual(
      notifications,
      rows.map((message) => ({ message })),
    );
    assert.deepStrictEqual(git.state.calls.fetch, touched(clones).map(fetchOf));
    assert.strictEqual(networkCallCount(), 0);
    verifyBoundary();
    verify(pluginUpdate);
  });
}

test("takes the scope-target flag as the marketplace name instead of rejecting it", async (t) => {
  // arrange
  const { cwd, networkCallCount } = await createHermeticScope(t, "scope-target");
  await seedThreeMarketplaces(cwd);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: cwd,
    reads: 1,
  });
  const git = createGitOpsFake({ boundary: "memory" });
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const marketplaceUpdateHandler = makeMarketplaceUpdateHandler(pi, {
    gitOps: git.gitOps,
    pluginUpdate,
  });

  // act
  await marketplaceUpdateHandler("--scope user --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n⊘ --local [user] (failed) {marketplace not added}",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(git.state.calls.fetch, []);
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

test("reports an unrecognised scope value with the update usage block and never updates", async (t) => {
  // arrange
  const { cwd, networkCallCount } = await createHermeticScope(t, "invalid-scope");
  await seedThreeMarketplaces(cwd);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const git = createGitOpsFake({ boundary: "memory" });
  const pluginUpdate = mock<PluginUpdate>({ exactParams: true, name: "plugin update" });
  const marketplaceUpdateHandler = makeMarketplaceUpdateHandler(pi, {
    gitOps: git.gitOps,
    pluginUpdate,
  });

  // act
  await marketplaceUpdateHandler("--scope bogus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Invalid --scope value: "bogus". Must be "user" or "project".\n\n${USAGE}`,
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(git.state.calls.fetch, []);
  assert.strictEqual(networkCallCount(), 0);
  verifyBoundary();
  verify(pluginUpdate);
});

// Owner for edge/handlers/marketplace/info.ts (MOD-09).
//
// The module is one factory returning the shared single-name marketplace
// handler, so its whole promise is three things: the usage block it supplies,
// the delegate it supplies, and the Pi handle it forwards. The parse itself,
// the collapse of the duplicated usage block, the surplus-token drop, and the
// options-bag shape belong to `tests/edge/handlers/marketplace/shared.test.ts`,
// which drives `makeSingleNameMarketplaceHandler` with an injected collaborator
// (D-116-07). Nothing here restates that mechanism; what is asserted is WHICH
// constant and WHICH workflow this factory wires into it, observed end to end.
//
// D-116-05 (O3) places this handler in Group C: `getMarketplaceInfo` is reached
// by direct import at the factory call site with no injection point, so a
// delegating case cannot state an exact argument list against it. Delegation is
// observed instead as one minimal effect -- the emitted row naming the seeded
// marketplace and the scope bracket it carries. That exact-argument gap is this
// owner's recorded scope, and the negative half of D-116-06 is proven in full.
//
// A rejecting case sizes the boundary at one emission, zero probes, and leaves
// the working directory UNSTATED. `getMarketplaceInfo` reads `opts.cwd` inside
// its scope fan-out before it can emit anything, so a workflow that ran would
// carry strong-mock's pending-call proxy into that read and fail there. A
// delegating case states one emission, two tool probes (one soft-dependency
// probe reading twice), and one working-directory read -- all four counts
// measured against the real module through a counting proxy before this file
// was written.
//
// Every case also installs a fail-fast replacement of `https.request`, the door
// the git transport opens. NO CASE ASSERTS A CALL COUNT AGAINST IT, and the
// replacement is NOT an offline proof: the import closure of
// `edge/handlers/marketplace/info.ts` reaches no HTTP client at all -- neither
// `platform/git.ts` nor `isomorphic-git` nor `node:https` -- so a zero here
// could not rise whatever this surface did. What it is, is a hermeticity
// device: a dial-out this path acquires later fails the case where it happens
// instead of passing silently. That is the half of NFR-5 the architecture suite
// cannot cover here, since it names orchestrator files only. See
// `installNetworkTrap`.
//
// Three marketplaces are seeded in every case, rejecting ones included, so a
// workflow that did run would have records to report. `beta` exists in the user
// scope alone and is never named by any expectation; a lookup that widened past
// the first positional would surface it.
//
// No exhaustiveness claim: marketplace/info.ts holds no switch and no
// closed-union dispatch, so a missing-arm plant has no target here. No case
// asserts the absence of direct process output (ESLint and fallow own that),
// and none re-derives the info workflow's own row grammar, which
// tests/orchestrators/marketplace/info.test.ts owns.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { pathSource } from "../../../../extensions/pi-claude-marketplace/domain/source.ts";
import { makeMarketplaceInfoHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { mergeMarketplaceIntoState } from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The usage block this shim supplies, written out rather than read back. */
const INFO_USAGE = "Usage: /claude:plugin marketplace info <name> [--scope user|project]";

/** The row the project-scope record renders as. */
const PROJECT_ALPHA_ROW = "● alpha [project] <no autoupdate>\npath: /repo/path/alpha";

/** The row the user-scope record renders as. */
const USER_ALPHA_ROW = "● alpha [user] <no autoupdate>\npath: /home/user/marketplaces/alpha";

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
}

/**
 * Replace the door the git transport opens with a fail-fast throw owned by the
 * test context, which restores it after the case.
 *
 * A HERMETICITY DEVICE, not an offline proof: nothing in this handler's import
 * closure can open a connection, so no count asserted against it could ever
 * rise, and none is. The value is that a dial-out acquired later fails the case
 * where it happens.
 *
 * The door is `https.request` because that is the one the git transport opens:
 * `isomorphic-git/http/node` reaches the wire through `simple-get`, which calls
 * `https.request`. `globalThis.fetch` is NOT watched -- its only production
 * caller in this repository is the device flow in `domain/github-auth.ts`,
 * which this closure does not reach.
 */
function installNetworkTrap(t: TestContext): void {
  t.mock.method(https, "request", (): never => {
    throw new Error("the marketplace info surface must not open a network connection");
  });
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). Removal, both
 * environment restores, and the transport replacement are all registered before
 * the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `mp-info-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `mp-info-${label}-home-`));
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

/**
 * Persist one path-source marketplace record plus the manifest the info
 * projection reads. `marketplaceRoot` is a literal this file chose so the
 * rendered `path:` line stays hand-authored; only the manifest has to exist.
 */
async function seedMarketplace(
  cwd: string,
  scope: Scope,
  name: string,
  marketplaceRoot: string,
): Promise<void> {
  const locations = locationsFor(scope, cwd);
  const manifestPath = path.join(locations.extensionRoot, `${name}.json`);
  await mkdir(locations.extensionRoot, { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ name, plugins: [] }), "utf8");
  await mergeMarketplaceIntoState(locations.extensionRoot, name, {
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    name,
    plugins: {},
    scope,
    source: pathSource(marketplaceRoot),
  });
}

/**
 * `alpha` in both scopes so a scope selection is visible as which rows survive,
 * and `beta` in the user scope alone as a marketplace no expectation names.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedMarketplace(workspace.cwd, "project", "alpha", "/repo/path/alpha");
  await seedMarketplace(workspace.cwd, "user", "alpha", "/home/user/marketplaces/alpha");
  await seedMarketplace(workspace.cwd, "user", "beta", "/home/user/marketplaces/beta");
}

for (const { expectedMessage, flags, selection } of [
  {
    expectedMessage: `${PROJECT_ALPHA_ROW}\n\n${USER_ALPHA_ROW}`,
    flags: "",
    selection: "both scopes when no scope flag is supplied",
  },
  {
    expectedMessage: PROJECT_ALPHA_ROW,
    flags: " --scope project",
    selection: "the project scope alone",
  },
  {
    expectedMessage: USER_ALPHA_ROW,
    flags: " --scope user",
    selection: "the user scope alone",
  },
]) {
  test(`reaches the info workflow, which reports ${selection}`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "delegates");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      reads: 1,
      value: workspace.cwd,
    });
    const infoHandler = makeMarketplaceInfoHandler(pi);

    // act
    await infoHandler(`alpha${flags}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    verifyBoundary();
  });
}

test("supplies the info usage block, shown when the name positional is missing", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "missing-name");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const infoHandler = makeMarketplaceInfoHandler(pi);

  // act
  await infoHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Missing required argument.\n\n${INFO_USAGE}`, severity: "error" },
  ]);
  verifyBoundary();
});

test("supplies the info usage block beside a parse diagnostic the parser reports verbatim", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "invalid-scope");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const infoHandler = makeMarketplaceInfoHandler(pi);

  // act
  await infoHandler("alpha --scope bogus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Invalid --scope value: "bogus". Must be "user" or "project".\n\n${INFO_USAGE}`,
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("queries the first positional alone, so a surplus token reaches no second lookup", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "surplus");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    reads: 1,
    value: workspace.cwd,
  });
  const infoHandler = makeMarketplaceInfoHandler(pi);

  // act
  await infoHandler("alpha beta", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: `${PROJECT_ALPHA_ROW}\n\n${USER_ALPHA_ROW}` }]);
  verifyBoundary();
});

test("treats the scope-target flag as the name positional rather than a scope selector", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "scope-target");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    reads: 1,
    value: workspace.cwd,
  });
  const infoHandler = makeMarketplaceInfoHandler(pi);

  // act
  await infoHandler("--scope project --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: "A marketplace operation has failed.\n\n⊘ --local [project] (failed) {not added}",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

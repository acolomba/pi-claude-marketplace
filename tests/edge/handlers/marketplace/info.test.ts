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
import { mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { pathSource } from "../../../../extensions/pi-claude-marketplace/domain/source.ts";
import { makeMarketplaceInfoHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../../platform/hermetic-environment.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";
import { mergeMarketplaceIntoState } from "../marketplace-seed.ts";

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
  const { cwd } = await createHermeticEnvironment(t, `mp-info-${label}-`);
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
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
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

test("rejects surplus input before looking up a marketplace", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "surplus");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const infoHandler = makeMarketplaceInfoHandler(pi);

  // act
  await infoHandler("alpha beta", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Too many arguments.\n\n${INFO_USAGE}`, severity: "error" },
  ]);
  verifyBoundary();
});

for (const args of [
  "--local alpha",
  "alpha --local",
  "alpha --scope project --local",
  "--scope project --local",
]) {
  test(`info ${args} rejects the local flag as unknown`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "local-flag");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const infoHandler = makeMarketplaceInfoHandler(pi);

    // act
    await infoHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Unknown flag: "--local".\n\n${INFO_USAGE}`,
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

for (const { name, autoupdate } of [
  { name: "shared", autoupdate: "autoupdate" },
  { name: "local", autoupdate: "autoupdate" },
  { name: "overlap", autoupdate: "no autoupdate" },
]) {
  test(`info ${name} --scope project reads merged declarations without changing config bytes`, async (t) => {
    // arrange
    const { cwd } = await createHermeticWorkspace(t, "merged-config");
    await seedMarketplace(cwd, "project", "shared", "/repo/shared");
    await seedMarketplace(cwd, "project", "local", "/repo/local");
    await seedMarketplace(cwd, "project", "overlap", "/repo/overlap");
    const locations = locationsFor("project", cwd);
    const sharedBytes =
      '{ "marketplaces": { "shared": { "source": "./shared", "autoupdate": true }, "overlap": { "source": "./overlap", "autoupdate": true } } }\n';
    const localBytes =
      '{ "marketplaces": { "local": { "source": "./local", "autoupdate": true }, "overlap": { "source": "./override", "autoupdate": false } } }\n';
    await writeFile(locations.configJsonPath, sharedBytes);
    await writeFile(locations.configLocalJsonPath, localBytes);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 3, {
      value: cwd,
      reads: 1,
    });
    const handler = makeMarketplaceInfoHandler(pi);

    // act
    await handler(`${name} --scope project`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `● ${name} [project] <${autoupdate}>\npath: /repo/${name}` },
    ]);
    assert.deepStrictEqual(
      [
        await readFile(locations.configJsonPath, "utf8"),
        await readFile(locations.configLocalJsonPath, "utf8"),
      ],
      [sharedBytes, localBytes],
    );
    verifyBoundary();
  });
}

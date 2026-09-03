// Owner for edge/handlers/marketplace/list.ts (MOD-09).
//
// The shim declares an EMPTY positional schema, so its arity contract is "zero
// positionals accepted", and the interesting question is what the schema loop
// does with a surplus token. That loop walks the SCHEMA, not the input, so a
// surplus token is dropped and the listing still runs; two rows state the
// outcome at one and at two surplus tokens. Nothing here is a rejection.
//
// D-116-05 (O3) places this handler in Group C: `listMarketplaces` is reached by
// direct import with no injection point, so the delegation is observed as one
// minimal effect -- the seeded marketplace appearing as a row -- rather than as a
// stated argument list. That exact-argument gap is the recorded scope of this
// owner. The negative half of D-116-06 is proven in full: the rejecting case
// sizes the boundary at one emission, zero probes, and no `cwd` read, so a
// workflow notification would be a second `ctx.ui` access past its `times(1)`
// count and `verifyBoundary()` reports it. Both scopes are seeded in that case
// too, so a workflow that did run would have rows to emit.
//
// Every seeded record omits `lastUpdatedAt` and declares no autoupdate entry, so
// the renderer emits the bare `<glyph> <name> [<scope>]` header row. The detail
// tokens and the empty-state sentinel belong to
// tests/orchestrators/marketplace/list.test.ts and are not restated here.
//
// The listing is read-only (NFR-5), so every case owns a fail-fast replacement
// of `https.request`, the door the git transport opens. NO CASE ASSERTS A CALL
// COUNT AGAINST IT, and the replacement is NOT an offline proof: the import
// closure of `edge/handlers/marketplace/list.ts` reaches no HTTP client at all,
// so a zero here could not rise whatever this surface did. What it is, is a
// hermeticity device -- a dial-out this path acquires later fails the case
// where it happens. See `installNetworkTrap`.
//
// No exhaustiveness claim: marketplace/list.ts holds no switch and no
// closed-union dispatch, so a missing-arm plant has no target here. No case
// asserts the absence of direct process output (ESLint and fallow own that),
// none re-proves the tokenizer's last-scope-wins rule (tests/edge/args.test.ts)
// or the positional-schema contract (tests/edge/args-schema.test.ts), and none
// re-derives the list workflow's own outcome.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { makeMarketplaceListHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { mergeMarketplaceIntoState } from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** Written out by hand; never read back off the module under test. */
const USAGE = "Usage: /claude:plugin marketplace <list|ls> [--scope user|project]";

const PROJECT_ROW = "● alpha [project]";
const USER_ROW = "● beta [user]";
const BOTH_SCOPE_ROWS = `${PROJECT_ROW}\n\n${USER_ROW}`;

interface HermeticScope {
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
    throw new Error("the marketplace listing must not open a network connection");
  });
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). Removal and both
 * environment restores are registered before the handler runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `mp-list-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `mp-list-${label}-home-`));
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

async function seedMarketplace(cwd: string, scope: Scope, name: string): Promise<void> {
  await mergeMarketplaceIntoState(locationsFor(scope, cwd).extensionRoot, name, {
    name,
    scope,
    source: { kind: "path", raw: `./${name}-src`, logical: `./${name}-src` },
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, `${name}-src`, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: path.join(cwd, `${name}-src`),
    plugins: {},
  });
}

/** `alpha` in the project scope and `beta` in the user scope, one bare row each. */
async function seedBothScopes(cwd: string): Promise<void> {
  await seedMarketplace(cwd, "project", "alpha");
  await seedMarketplace(cwd, "user", "beta");
}

test("lists every scope project-first when no scope flag narrows the listing", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "both-scopes");
  await seedBothScopes(cwd);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: cwd,
    reads: 1,
  });
  const marketplaceListHandler = makeMarketplaceListHandler(pi);

  // act
  await marketplaceListHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: BOTH_SCOPE_ROWS }]);
  verifyBoundary();
});

for (const { args, label, surplus } of [
  { args: "official", label: "one-surplus", surplus: "one surplus positional token" },
  { args: "official extra", label: "two-surplus", surplus: "two surplus positional tokens" },
]) {
  test(`drops ${surplus} and still lists every scope`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, label);
    await seedBothScopes(cwd);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: cwd,
      reads: 1,
    });
    const marketplaceListHandler = makeMarketplaceListHandler(pi);

    // act
    await marketplaceListHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: BOTH_SCOPE_ROWS }]);
    verifyBoundary();
  });
}

for (const { row, scope } of [
  { row: USER_ROW, scope: "user" },
  { row: PROJECT_ROW, scope: "project" },
] satisfies readonly { readonly row: string; readonly scope: Scope }[]) {
  test(`lists the ${scope} scope alone when --scope ${scope} is supplied`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, `scope-${scope}`);
    await seedBothScopes(cwd);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: cwd,
      reads: 1,
    });
    const marketplaceListHandler = makeMarketplaceListHandler(pi);

    // act
    await marketplaceListHandler(`--scope ${scope}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: row }]);
    verifyBoundary();
  });
}

test("drops the scope-target flag as a surplus positional and honors the scope beside it", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "scope-target");
  await seedBothScopes(cwd);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: cwd,
    reads: 1,
  });
  const marketplaceListHandler = makeMarketplaceListHandler(pi);

  // act
  await marketplaceListHandler("--scope user --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: USER_ROW }]);
  verifyBoundary();
});

test("reports an unrecognised scope value with the list usage block and never lists", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "invalid-scope");
  await seedBothScopes(cwd);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const marketplaceListHandler = makeMarketplaceListHandler(pi);

  // act
  await marketplaceListHandler("--scope bogus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Invalid --scope value: "bogus". Must be "user" or "project".\n\n${USAGE}`,
      severity: "error",
    },
  ]);
  verifyBoundary();
});

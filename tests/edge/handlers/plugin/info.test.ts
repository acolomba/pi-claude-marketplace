// Owner for edge/handlers/plugin/info.ts (MOD-09).
//
// The shim runs the shared prelude, scans its positionals against the flag set
// the catalog derives for this verb, and rejects three ways: an unrecognised
// long flag, a positional count other than one, and a malformed reference.
//
// Which parser this module calls decides its arity and flag answers, and this
// one reaches `parseArgs` through `withParsedArgs` and never calls
// `extractLocalFlag`. Measured consequences, taken against the real module
// before a case was written:
//   * exactly one non-flag positional is accepted; zero IS rejected and two or
//     three ARE rejected, both by the handler's own `!== 1` count guard and
//     both with the same sentence;
//   * the scope-target flag reaches the positional list as an ordinary token,
//     where the handler's own long-flag scan claims it, so a scope flag and the
//     scope-target flag supplied together are rejected before any workflow
//     call.
//
// D-116-05 (O3) places this handler in Group C: `getPluginInfo` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as one minimal
// effect -- the single emission naming the seeded plugin. The row grammar rides
// along because a whole-value comparison is the house form;
// tests/orchestrators/plugin/info.test.ts owns that grammar.
//
// The negative half of D-116-06 is proven in full. Every rejecting case sizes
// the boundary at one emission, zero probes, and NO stated `cwd`; both scopes
// are seeded, so a workflow that did run would have a marketplace to project
// and a cascade to emit. No on-disk footprint is asserted beside
// `verifyBoundary()`: this read-only surface writes nothing at any time, so an
// unchanged-tree assertion would pass whether or not the workflow ran.
//
// Measured boundary counts, taken through a counting context before a case was
// written, because the two emission paths disagree:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- `notifyUsageError` writes straight to the channel;
//   * a delegating command reads `ctx.ui` once, `ctx.cwd` once, and
//     `pi.getAllTools()` TWICE -- the cascade runs ONE soft-dependency probe
//     and that probe reads the tool list twice.
//
// NFR-5, scoped: the fetch flag exists to warm a clone cache, so this surface
// is offline only while the flag is ABSENT, and the claim is stated that way.
// The watched door is `https.request`, measured to be the one the git transport
// opens: `isomorphic-git/http/node` goes through `simple-get`, which calls
// `https.request` and never `globalThis.fetch`, so a global-fetch spy would
// record zero here whatever the handler did. The claim is asserted on the ONE
// fixture where it can fail -- a cold git-source plugin, whose sibling row with
// the flag supplied does reach that door. A path-source plugin never reaches
// the transport with or without the flag, so a zero there would be unfalsifiable
// and none is asserted.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project
// scope and `<HOME>/.pi/agent` for the user scope, with the agent-directory
// variable DELETED rather than overwritten, because `getAgentDir()` reads it
// ahead of `homedir()` and an ambient value would defeat a hermetic HOME
// (SC-1). Each scope declares the SAME plugin at a different version, so a row
// projected from the wrong scope is visible in the emission.
//
// This pair makes no exhaustiveness claim: `edge/handlers/plugin/info.ts`
// contains no `switch` and no closed-union dispatch, so a missing-arm plant has
// no target here. No case asserts the absence of direct process output (ESLint
// and fallow own that), none restates the tokenizer diagnostics owned by
// tests/edge/args.test.ts, none re-proves the prelude owned by
// tests/edge/handlers/plugin/shared.test.ts, and none re-pins the catalog
// contents owned by tests/architecture/flag-catalog-drift.test.ts -- the
// accepted flag names are TAKEN from that catalog rather than restated, so a
// rename follows the catalog instead of failing here.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { parseFlagNames } from "../../../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { makePluginInfoHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts";
import { mergeMarketplaceIntoState } from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * The long flags the catalog marks parse-accepted for this verb, in the form a
 * user types them. Taken from the catalog rather than restated so this owner
 * proves the flags are HONORED without re-pinning which flags they are.
 */
const ACCEPTED_FLAGS = [...parseFlagNames("info")].join(" ");

/** A git source on a closed loopback port: reachable only through the transport. */
const GIT_SOURCE = "https://127.0.0.1:9/repo.git";

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<HOME>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
  /** How many times the case reached the replaced git transport door. */
  networkCallCount(): number;
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared and the git transport door replaced by a
 * fail-fast counter. Removal and both environment restores are registered
 * before the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-info-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-info-${label}-home-`));
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
  const networkSpy = t.mock.method(https, "request", (): never => {
    throw new Error("plugin info must not open a network connection");
  });
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
    networkCallCount: (): number => networkSpy.mock.callCount(),
  };
}

/**
 * Record the `mp` marketplace in one scope and write the manifest it points at.
 * `alpha` is a path source materialized on disk, so it resolves locally;
 * `gitp` is a git source with no clone, so it stays remote until a warm-up is
 * consented to.
 */
async function seedScope(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  alphaVersion: string,
): Promise<void> {
  const marketplaceRoot = path.join(workspace.cwd, `mp-src-${scope}`);
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      owner: { name: "seed-owner" },
      plugins: [
        { name: "alpha", source: "./alpha", version: alphaVersion },
        { name: "gitp", source: GIT_SOURCE, version: "3.0.0" },
      ],
    }),
    "utf8",
  );
  await mkdir(path.join(marketplaceRoot, "alpha"), { recursive: true });
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), "mp", {
    name: "mp",
    scope,
    source: { kind: "path", raw: `./mp-src-${scope}`, logical: `./mp-src-${scope}` },
    addedFromCwd: workspace.cwd,
    manifestPath,
    marketplaceRoot,
    plugins: {},
  });
}

/**
 * Both scopes declare the same `mp` marketplace and the same two plugins, with
 * `alpha` at a different version per scope, so which scope a projection came
 * from is readable off the single emission.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedScope(workspace, "project", workspace.projectRoot, "1.0.0");
  await seedScope(workspace, "user", workspace.userRoot, "2.0.0");
}

for (const { args, expectedMessage, label, summary } of [
  {
    args: "alpha@mp",
    label: "both-scopes",
    summary: "projects the plugin from every scope when no scope flag is supplied",
    expectedMessage:
      "● mp [project] <no autoupdate>\n  ○ alpha v1.0.0 (available)\n\n● mp [user] <no autoupdate>\n  ○ alpha v2.0.0 (available)",
  },
  {
    args: "alpha@mp --scope project",
    label: "scope-project",
    summary: "narrows the projection to the project scope when it is the supplied scope",
    expectedMessage: "● mp [project] <no autoupdate>\n  ○ alpha v1.0.0 (available)",
  },
  {
    args: "alpha@mp --scope user",
    label: "scope-user",
    summary: "narrows the projection to the user scope when it is the supplied scope",
    expectedMessage: "● mp [user] <no autoupdate>\n  ○ alpha v2.0.0 (available)",
  },
]) {
  test(`${summary} (INFO-02)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const infoHandler = makePluginInfoHandler(pi);

    // act
    await infoHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    verifyBoundary();
  });
}

test("reads a git-source plugin from disk alone while the fetch flag is absent, opening no network connection (NFR-5)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "offline");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const infoHandler = makePluginInfoHandler(pi);

  // act
  await infoHandler("gitp@mp", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] <no autoupdate>\n  ◌ gitp v3.0.0 (remote)\n    components: not resolved\n\n● mp [user] <no autoupdate>\n  ◌ gitp v3.0.0 (remote)\n    components: not resolved",
    },
  ]);
  assert.strictEqual(workspace.networkCallCount(), 0);
  verifyBoundary();
});

for (const { args, label, position } of [
  { args: `${ACCEPTED_FLAGS} gitp@mp`, label: "flag-before", position: "before" },
  { args: `gitp@mp ${ACCEPTED_FLAGS}`, label: "flag-after", position: "after" },
]) {
  test(`consents to a git-source warm-up when the accepted flags are supplied ${position} the reference (FTCH-03)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const infoHandler = makePluginInfoHandler(pi);

    // act
    await infoHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project] <no autoupdate>\n  ◌ gitp v3.0.0 (remote) {unreadable}\n    components: not resolved\n\n● mp [user] <no autoupdate>\n  ◌ gitp v3.0.0 (remote) {unreadable}\n    components: not resolved",
      },
    ]);
    verifyBoundary();
  });
}

for (const { args, label, summary } of [
  { args: "", label: "arity-zero", summary: "no positional at all" },
  {
    args: ACCEPTED_FLAGS,
    label: "arity-flags-only",
    summary: "the accepted flags with no reference",
  },
  { args: "alpha@mp gitp@mp", label: "arity-two", summary: "two references" },
  { args: "alpha@mp gitp@mp alpha@mp", label: "arity-three", summary: "three references" },
]) {
  test(`rejects ${summary} with the exactly-one-argument sentence (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const infoHandler = makePluginInfoHandler(pi);

    // act
    await infoHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "info requires exactly one <plugin>@<marketplace> argument.\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

for (const { args, expectedMessage, label, summary } of [
  {
    args: "--bogus",
    label: "unknown-alone",
    summary: "an unrecognised long flag supplied as the only positional",
    expectedMessage:
      'Unknown flag: "--bogus".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
  },
  {
    args: "alpha@mp --bogus",
    label: "unknown-after-ref",
    summary: "an unrecognised long flag supplied after a valid reference",
    expectedMessage:
      'Unknown flag: "--bogus".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
  },
  {
    args: `alpha@mp ${ACCEPTED_FLAGS} --bogus`,
    label: "unknown-after-accepted",
    summary: "an unrecognised long flag supplied after the accepted flags",
    expectedMessage:
      'Unknown flag: "--bogus".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
  },
  {
    args: "--scope user --local",
    label: "unknown-scope-target",
    summary: "the scope-target flag supplied beside a scope flag",
    expectedMessage:
      'Unknown flag: "--local".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
  },
]) {
  test(`names ${summary} verbatim and never reaches the info workflow (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const infoHandler = makePluginInfoHandler(pi);

    // act
    await infoHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    verifyBoundary();
  });
}

for (const { args, expectedMessage, label, summary } of [
  {
    args: "no-at-sign",
    label: "ref-no-separator",
    summary: "a reference carrying no separator",
    expectedMessage:
      'Invalid <plugin>@<marketplace> ref: "no-at-sign".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
  },
  {
    args: "@mp",
    label: "ref-leading-separator",
    summary: "a reference opening at the separator",
    expectedMessage:
      'Invalid <plugin>@<marketplace> ref: "@mp".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
  },
  {
    args: "alpha@",
    label: "ref-trailing-separator",
    summary: "a reference ending at the separator",
    expectedMessage:
      'Invalid <plugin>@<marketplace> ref: "alpha@".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
  },
]) {
  test(`names ${summary} verbatim and never reaches the info workflow (PI-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const infoHandler = makePluginInfoHandler(pi);

    // act
    await infoHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    verifyBoundary();
  });
}

test("carries the tokenizer's own sentence for an unrecognised scope value and never reaches the info workflow (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "scope-value");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const infoHandler = makePluginInfoHandler(pi);

  // act
  await infoHandler("alpha@mp --scope bogus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        'Invalid --scope value: "bogus". Must be "user" or "project".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]',
      severity: "error",
    },
  ]);
  verifyBoundary();
});

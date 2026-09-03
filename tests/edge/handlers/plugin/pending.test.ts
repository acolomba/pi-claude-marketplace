// Owner for edge/handlers/plugin/pending.ts (MOD-09).
//
// This shim accepts NO positional argument and one optional scope flag. It
// opens with the shared `withParsedArgs` prelude over `parseArgs`, then runs its
// own guard over the recovered positional tokens. The guard's promise is that it
// reads the FIRST positional's SHAPE and picks one of two sentences from it, so
// the discriminating proof is a pair of cases that differ only in that shape.
//
// Which parser a module calls decides its arity and flag answers, so all of the
// following were measured against the real module before a case was written:
//   * ZERO positionals is the accepted arity, and ONE is rejected. There is no
//     arity one BELOW zero, so only the surplus half of the arity obligation has
//     a target here;
//   * a first positional opening with the long-flag prefix is rejected with the
//     unknown-OPTION sentence, and any other first positional with the
//     too-many-arguments sentence. The two sentences are hand-authored, never
//     carried across from a sibling: the rejecting siblings do not agree on the
//     wording, and this shim uses the unknown-OPTION form where the fetch and
//     info shims use the unknown-FLAG form;
//   * the shape test reads only the FIRST positional. A long-flag-shaped token
//     driven SECOND, behind an ordinary first, takes the too-many-arguments
//     sentence;
//   * the scope-target flag is REJECTED. This module never reaches
//     `extractLocalFlag`, so the token survives `parseArgs` as an ordinary
//     positional, opens with `--`, and lands in the unknown-option channel --
//     alone, and beside a scope flag, which is the mutually-exclusive-selector
//     case.
//
// D-116-05 (O3) places this handler in Group C: `pendingReconcile` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as the single
// emission's diff, seeded so each scope's diff names a DIFFERENT plugin -- a diff
// read out of the wrong scope root carries the wrong plugin name rather than
// merely being absent. The rendered pending grammar itself is
// tests/orchestrators/reconcile/pending.test.ts's contract at full direct
// coverage and is not re-derived here.
//
// The negative half of D-116-06 is carried by the shape that CAN fail: a
// rejecting case sizes the boundary at one emission, zero probes, and NO stated
// `cwd`, so a workflow that did run reads an unstated boundary member and dies
// where it happens.
//
// Measured boundary counts, taken through a counting context before a case was
// written, because the two paths disagree:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- `notifyUsageError` writes straight to the channel;
//   * a delegating command reads `ctx.ui` once, `ctx.cwd` once, and
//     `pi.getAllTools()` TWICE, on every scope and fixture combination.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project scope
// and `<HOME>/.pi/agent` for the user scope, with the agent-directory variable
// DELETED rather than overwritten, because `getAgentDir()` reads it ahead of
// `homedir()` and an ambient value would defeat a hermetic HOME (SC-1).
//
// NFR-5 has two halves here and they are proven differently. The WRITE half is
// proven by comparing the complete listing of both hermetic trees across the
// act: this verb reads a merged config and a state file and must add nothing,
// and the sibling apply path DOES write a migrated config from the same inputs,
// so the assertion has a real target on the delegating path. The NETWORK half is
// a counting fail-fast replacement for `https.request`, asserted at zero in every
// case. `globalThis.fetch` is deliberately NOT the door watched: the git
// transport reaches the wire through `simple-get` -> `https.request`, and this
// repo's only `fetch` caller is the device-flow credential path, which no
// pending invocation enters. One fixture declares a COLD git source as a planned
// install, which is the input this verb resolves through the no-network
// resolver, so the zero is asserted over an input that would need the network to
// resolve any further. This verb has no flag that turns materialization on, so
// no positive control is available: the zero is a regression guard on NFR-5, and
// the offline `(will install)` row beside it is what says the workflow answered
// from disk.
//
// D-116-01a: this pair lands with functions and lines COMPLETE and exactly ONE
// uncovered branch, at edge/handlers/plugin/pending.ts:39 -- the `?? ""` fallback
// on the first positional. The guard on the line above has already proven the
// positional list non-empty, and `parseArgs` pushes only non-undefined tokens
// onto that list, so the index read always yields a string and the fallback arm
// cannot be entered at runtime. It exists only because `noUncheckedIndexedAccess`
// (tsconfig.json:12) types the index read as possibly undefined; removing it
// needs a non-null assertion or a type assertion, both barred throughout
// `extensions/`. Measured, not inspected: deleting the fallback raises TS18048
// at its consumption site on the line below, replacing the fallback literal with
// an OBSERVABLE long-flag-shaped token leaves the whole suite green, and a brute
// force driving the handler over all 19530 argument strings of up to six
// characters drawn from the tokenizer's own significant alphabet never produced
// that token in any emission -- while the same brute force with the index moved
// out of range reports it for most of them, so the probe is live. No
// coverage-exception pragma is added and no production file changes. The branch
// NUMBERS are deliberately not pinned anywhere: V8 emits a branch range only when
// its count diverges from the enclosing block, so strengthening a suite raises
// numerator and denominator together. What is pinned, in this plan's verify
// block, is the shortfall's IDENTITY -- exactly one uncovered branch and no
// `lines` or `functions` clause on the verdict line.
//
// This pair makes no exhaustiveness claim: `edge/handlers/plugin/pending.ts`
// contains no `switch` and no closed-union dispatch, so a missing-arm plant has
// no target here. No case asserts the absence of direct process output (ESLint
// and fallow own that), none restates the tokenizer diagnostics owned by
// tests/edge/args.test.ts, none restates the shared prelude owned by
// tests/edge/handlers/plugin/shared.test.ts, and none re-derives the pending
// diff grammar owned by tests/orchestrators/reconcile/pending.test.ts.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { SCOPE_TARGET_FLAG } from "../../../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { makePendingHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";

const PENDING_USAGE = "Usage: /claude:plugin pending [--scope user|project]";

const SKILL_SOURCE = "---\nname: tool\ndescription: A tool skill.\n---\n\nBody.\n";

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** The hermetic home directory the user scope root hangs under. */
  readonly home: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<HOME>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
  /** Calls recorded by the fail-fast git transport door (NFR-5). */
  readonly transportCalls: () => number;
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared and the git transport door replaced by a
 * counting fail-fast throw. Removal and both environment restores are registered
 * before the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-pending-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-pending-${label}-home-`));
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
  const requestSpy = t.mock.method(https, "request", (): never => {
    throw new Error("pending must not open a network connection");
  });
  return {
    cwd,
    home,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
    transportCalls: (): number => requestSpy.mock.callCount(),
  };
}

/** Every path under `root`, relative and sorted, directories marked. */
async function treeListing(root: string): Promise<readonly string[]> {
  const children = await readdir(root, { recursive: true, withFileTypes: true });
  return children
    .map((child) => {
      const relative = path
        .relative(root, path.join(child.parentPath, child.name))
        .split(path.sep)
        .join("/");
      return child.isDirectory() ? `${relative}/` : relative;
    })
    .sort();
}

/** The complete listing of both hermetic trees, which the act must not change. */
async function bothTreeListings(
  workspace: HermeticWorkspace,
): Promise<readonly (readonly string[])[]> {
  return [await treeListing(workspace.cwd), await treeListing(workspace.home)];
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

/** The bytes of a `claude-plugins.json` declaring one marketplace and its plugins. */
function configBytes(marketplace: string, source: string, plugins: readonly string[]): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      marketplaces: { [marketplace]: { source } },
      plugins: Object.fromEntries(plugins.map((key) => [key, { enabled: true }])),
    },
    null,
    2,
  );
}

/**
 * Each scope declares a DIFFERENT plugin under the same marketplace name, so a
 * diff read out of the wrong scope root names the wrong plugin rather than
 * merely being absent from the right block.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await writeUnder(
    path.join(workspace.projectRoot, "claude-plugins.json"),
    configBytes("mp", "acme/tools", ["p-proj@mp"]),
  );
  await writeUnder(
    path.join(workspace.userRoot, "claude-plugins.json"),
    configBytes("mp", "acme/tools", ["p-user@mp"]),
  );
}

const PROJECT_BLOCK = "● mp [project]\n  ● p-proj (will install)";
const USER_BLOCK = "● mp [user]\n  ● p-user (will install)";

// ---------------------------------------------------------------------------
// The accepted arity of ZERO positionals, and the scope member. The omitted row
// is also the accepted arity with no flags at all. Every row asserts both
// hermetic trees are byte-for-byte the same set of paths after the act, which is
// the read-only half of NFR-5.
// ---------------------------------------------------------------------------

for (const { args, expectedMessage, label, summary } of [
  {
    args: "",
    expectedMessage: `${PROJECT_BLOCK}\n\n${USER_BLOCK}`,
    label: "scope-omitted",
    summary: "for both scopes, project first, when no scope flag is supplied",
  },
  {
    args: "--scope user",
    expectedMessage: USER_BLOCK,
    label: "scope-user",
    summary: "for the user scope alone when a user scope flag is supplied",
  },
  {
    args: "--scope project",
    expectedMessage: PROJECT_BLOCK,
    label: "scope-project",
    summary: "for the project scope alone when a project scope flag is supplied",
  },
] satisfies readonly {
  args: string;
  expectedMessage: string;
  label: string;
  summary: string;
}[]) {
  test(`reports the pending diff ${summary}, writing nothing (DIFF-01 / NFR-5)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const expectedListings = await bothTreeListings(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const pendingHandler = makePendingHandler(pi);

    // act
    await pendingHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    assert.deepStrictEqual(await bothTreeListings(workspace), expectedListings);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// NFR-5, the network half. A planned install of a COLD git source is the input
// this verb resolves through the no-network resolver: it needs the network to
// resolve any further, and the row still renders offline.
// ---------------------------------------------------------------------------

test("previews a planned install of a cold git source without opening a connection (NFR-5)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "cold-git-source");
  const marketplaceRoot = path.join(workspace.cwd, "mp-src");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeUnder(
    manifestPath,
    JSON.stringify({
      name: "mp",
      owner: { name: "seed-owner" },
      plugins: [
        { name: "far", source: "https://127.0.0.1:9/far.git" },
        { name: "near", source: "./near" },
      ],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "near", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "near", version: "1.0.0" }),
  );
  await writeUnder(path.join(marketplaceRoot, "near", "skills", "tool", "SKILL.md"), SKILL_SOURCE);
  await writeUnder(
    path.join(workspace.projectRoot, "pi-claude-marketplace", "state.json"),
    JSON.stringify({
      schemaVersion: 2,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "project",
          source: { kind: "path", raw: "./mp-src", logical: "./mp-src" },
          addedFromCwd: workspace.cwd,
          manifestPath,
          marketplaceRoot,
          plugins: {},
        },
      },
    }),
  );
  await writeUnder(
    path.join(workspace.projectRoot, "claude-plugins.json"),
    configBytes("mp", "./mp-src", ["far@mp", "near@mp"]),
  );
  const expectedListings = await bothTreeListings(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const pendingHandler = makePendingHandler(pi);

  // act
  await pendingHandler("--scope project", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● mp [project]\n  ● far (will install)\n  ● near (will install)" },
  ]);
  assert.deepStrictEqual(await bothTreeListings(workspace), expectedListings);
  assert.strictEqual(workspace.transportCalls(), 0);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// One above the accepted arity, first positional NOT long-flag-shaped.
// Rejections size the boundary at one emission, zero probes, and no stated
// `cwd`, so a workflow that ran would read an unstated boundary member.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: "surplus", label: "arity-one", summary: "a single surplus token" },
  { args: "surplus second", label: "arity-two", summary: "two surplus tokens" },
  {
    args: "--scope user surplus",
    label: "arity-one-with-scope",
    summary: "a surplus token beside a scope flag",
  },
  {
    args: "surplus --frobnicate",
    label: "arity-flag-shaped-second",
    summary: "a long-flag-shaped token driven behind an ordinary one",
  },
]) {
  test(`rejects ${summary} with the too-many-arguments sentence and never reaches the pending workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const pendingHandler = makePendingHandler(pi);

    // act
    await pendingHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Too many arguments.\n\n${PENDING_USAGE}`, severity: "error" },
    ]);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// One above the accepted arity, first positional long-flag-shaped. This pair is
// the discriminating proof for the shape test: it differs from the family above
// only in the shape of the FIRST token, and it takes the other sentence.
// ---------------------------------------------------------------------------

for (const { args, label, offendingToken, summary } of [
  {
    args: "--frobnicate",
    label: "unknown-alone",
    offendingToken: "--frobnicate",
    summary: "driven alone",
  },
  {
    args: "--frobnicate surplus",
    label: "unknown-then-ordinary",
    offendingToken: "--frobnicate",
    summary: "driven ahead of an ordinary token",
  },
  {
    args: "--scope user --frobnicate",
    label: "unknown-with-scope",
    offendingToken: "--frobnicate",
    summary: "driven beside a scope flag",
  },
  {
    args: SCOPE_TARGET_FLAG,
    label: "target-alone",
    offendingToken: SCOPE_TARGET_FLAG,
    summary: "when the scope-target flag is driven on its own",
  },
  {
    args: `--scope user ${SCOPE_TARGET_FLAG}`,
    label: "target-with-scope",
    offendingToken: SCOPE_TARGET_FLAG,
    summary: "when the scope-target flag is driven beside a scope flag",
  },
]) {
  test(`names an unrecognised long option ${summary} and never reaches the pending workflow (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const pendingHandler = makePendingHandler(pi);

    // act
    await pendingHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown option: "${offendingToken}".\n\n${PENDING_USAGE}`, severity: "error" },
    ]);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The shared prelude: a parse throw carries its own sentence under this shim's
// usage block, and the workflow never runs.
// ---------------------------------------------------------------------------

for (const { args, expectedSentence, label, summary } of [
  {
    args: "--scope bogus",
    expectedSentence: 'Invalid --scope value: "bogus". Must be "user" or "project".',
    label: "scope-value-unrecognised",
    summary: "an unrecognised scope value",
  },
  {
    args: "--scope",
    expectedSentence: '--scope requires a value: "user" or "project".',
    label: "scope-value-missing",
    summary: "a scope flag with no value",
  },
]) {
  test(`carries the parse failure for ${summary} under this shim's usage block and never reaches the pending workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const pendingHandler = makePendingHandler(pi);

    // act
    await pendingHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `${expectedSentence}\n\n${PENDING_USAGE}`, severity: "error" },
    ]);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

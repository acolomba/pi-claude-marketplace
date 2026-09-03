// Owner for edge/handlers/plugin/fetch.ts (MOD-09).
//
// This is the only plugin shim that EXPORTS its parser, so the module carries
// two public contracts rather than one. `parseFetchTarget` is a pure function
// over the raw argument string and is proven as a contract in its own right:
// every accepted shape is asserted as one whole `{ target, scope? }` value, and
// every rejection carries its own stated sentence. `makeFetchHandler` is proven
// separately, as delegation plus the short-circuit that precedes it.
//
// D-81-01 gives the three accepted positional shapes and the three target forms
// they select: no positional yields the all form, `@<marketplace>` yields the
// marketplace form, and `<plugin>@<marketplace>` yields the plugin form.
//
// Which parser this module calls decides its arity and flag answers, and this
// one calls `parseArgs` DIRECTLY and never reaches `extractLocalFlag`. Measured
// consequences, taken against the real module before a case was written:
//   * zero positionals is an ACCEPTED arity (the all form), so nothing lies
//     below it; two positionals is one above and IS rejected, by the handler's
//     own `nonFlagPositionals.length > 1` guard rather than by the parser;
//   * the scope-target flag reaches the positional list as an ordinary token,
//     where the handler's own long-flag scan claims it, so a scope flag and the
//     scope-target flag supplied together are REJECTED before any workflow call.
//
// D-116-05 (O3) places this handler in Group C: `fetchPlugins` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as the one
// effect this workflow produces -- fetch persists no state (derive-not-persist:
// its only write is the clone seam's, which no path source reaches), so the
// enumerated set the cascade names IS the minimal effect available. What each
// delegating case claims is WHICH targets reached the workflow; the row grammar
// rides along because a whole-value comparison is the house form, and
// tests/orchestrators/plugin/fetch.test.ts owns that grammar.
//
// The negative half of D-116-06 is proven in full. A rejecting case sizes the
// boundary at one emission, zero probes, and NO stated `cwd`; both scopes are
// seeded, so a workflow that did run would have marketplaces to enumerate and a
// cascade to emit. No on-disk footprint is asserted beside `verifyBoundary()`:
// this workflow writes nothing at any time, so an empty-tree assertion would
// pass whether or not the workflow ran.
//
// Measured boundary counts, taken through a counting context before a case was
// written, because the two emission paths disagree:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- `notifyUsageError` writes straight to the channel;
//   * a delegating command reads `ctx.ui` once, `ctx.cwd` once, and
//     `pi.getAllTools()` TWICE -- the cascade runs ONE soft-dependency probe and
//     that probe reads the tool list twice.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project scope
// and `<HOME>/.pi/agent` for the user scope, with the agent-directory variable
// DELETED rather than overwritten, because `getAgentDir()` reads it ahead of
// `homedir()` and an ambient value would defeat a hermetic HOME (SC-1). Each
// scope holds a DIFFERENT marketplace, so which scope a command enumerated is
// visible in the emission.
//
// This pair makes no exhaustiveness claim: the target form is selected by a
// chain of `if` statements over string shapes, not by a switch over a closed
// union, so a missing-arm plant has no target here. No case asserts the absence
// of direct process output (ESLint and fallow own that), none restates the
// tokenizer diagnostics owned by tests/edge/args.test.ts, none re-proves the
// reference split owned by tests/edge/handlers/plugin/shared.test.ts, and no
// case adds an offline guard -- `orchestrators/plugin/fetch.ts` is a named
// member of the forbidden-targets set in
// tests/architecture/no-orchestrator-network.test.ts.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  makeFetchHandler,
  parseFetchTarget,
  type ParsedFetchTarget,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts";
import { mergeMarketplaceIntoState } from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<HOME>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared. Removal and both environment restores are
 * registered before the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-fetch-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-fetch-${label}-home-`));
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
  return { cwd, projectRoot: path.join(cwd, ".pi"), userRoot: path.join(home, ".pi", "agent") };
}

/**
 * Record one path-source marketplace in a scope's `state.json` and write the
 * manifest it points at. The fetchable set comes from the MANIFEST (D-81), and
 * every entry declares a path source, so the sweep renders a no-op row per
 * plugin without reaching the clone seam.
 */
async function seedMarketplace(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  marketplace: string,
  plugins: readonly string[],
): Promise<void> {
  const marketplaceRoot = path.join(workspace.cwd, `${marketplace}-src`);
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      owner: { name: "seed-owner" },
      plugins: plugins.map((plugin) => ({
        name: plugin,
        source: `./${plugin}`,
        version: "1.0.0",
      })),
    }),
    "utf8",
  );
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), marketplace, {
    name: marketplace,
    scope,
    source: { kind: "path", raw: `./${marketplace}-src`, logical: `./${marketplace}-src` },
    addedFromCwd: workspace.cwd,
    manifestPath,
    marketplaceRoot,
    plugins: {},
  });
}

/**
 * `mp` with two plugins in the project scope and `other` with one plugin in the
 * user scope, so the scope a command enumerated and the marketplace it narrowed
 * to are both readable off the single emission.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedMarketplace(workspace, "project", workspace.projectRoot, "mp", ["alpha", "beta"]);
  await seedMarketplace(workspace, "user", workspace.userRoot, "other", ["gamma"]);
}

describe("parseFetchTarget", () => {
  for (const { args, expectedParse, summary } of [
    {
      args: "",
      summary: "maps no positional onto the all form",
      expectedParse: { target: { kind: "all" } },
    },
    {
      args: "--scope user",
      summary: "carries the user scope beside the all form",
      expectedParse: { target: { kind: "all" }, scope: "user" },
    },
    {
      args: "--scope project",
      summary: "carries the project scope beside the all form",
      expectedParse: { target: { kind: "all" }, scope: "project" },
    },
    {
      args: "@mymkt",
      summary: "strips the leading separator from a bare marketplace reference",
      expectedParse: { target: { kind: "marketplace", marketplace: "mymkt" } },
    },
    {
      args: "hello@mymkt",
      summary: "splits a plugin reference into both halves",
      expectedParse: { target: { kind: "plugin", plugin: "hello", marketplace: "mymkt" } },
    },
    {
      args: "hello@mymkt --scope user",
      summary: "carries the user scope beside a plugin reference",
      expectedParse: {
        target: { kind: "plugin", plugin: "hello", marketplace: "mymkt" },
        scope: "user",
      },
    },
  ] satisfies readonly { args: string; expectedParse: ParsedFetchTarget; summary: string }[]) {
    test(`${summary} and stays silent (D-81-01)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

      // act
      const parsed = parseFetchTarget(args, ctx);

      // assert
      assert.deepStrictEqual(parsed, expectedParse);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  for (const { args, expectedMessage, summary } of [
    {
      args: "no-at-sign",
      summary: "a reference carrying no separator",
      expectedMessage:
        'Invalid <plugin>@<marketplace> ref: "no-at-sign".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
    },
    {
      args: "@",
      summary: "a lone separator with no marketplace after it",
      expectedMessage:
        'Invalid <plugin>@<marketplace> ref: "@".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
    },
    {
      args: "foo@",
      summary: "a reference ending at the separator",
      expectedMessage:
        'Invalid <plugin>@<marketplace> ref: "foo@".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
    },
  ]) {
    test(`names ${summary} verbatim and returns no target (FTCH-01)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

      // act
      const parsed = parseFetchTarget(args, ctx);

      // assert
      assert.strictEqual(parsed, undefined);
      assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
      verifyBoundary();
    });
  }

  for (const { args, summary } of [
    { args: "a@mp b@mp", summary: "two references" },
    { args: "a@mp b@mp c@mp", summary: "three references" },
  ]) {
    test(`rejects ${summary} as too many arguments and returns no target (D-81-01)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

      // act
      const parsed = parseFetchTarget(args, ctx);

      // assert
      assert.strictEqual(parsed, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "Too many arguments.\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]",
          severity: "error",
        },
      ]);
      verifyBoundary();
    });
  }

  for (const { args, expectedMessage, summary } of [
    {
      args: "--bogus",
      summary: "an unrecognised long flag supplied as the only positional",
      expectedMessage:
        'Unknown flag: "--bogus".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
    },
    {
      args: "a@mp --bogus",
      summary: "an unrecognised long flag supplied after a valid reference",
      expectedMessage:
        'Unknown flag: "--bogus".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
    },
    {
      args: "--scope user --local",
      summary: "the scope-target flag supplied beside a scope flag",
      expectedMessage:
        'Unknown flag: "--local".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
    },
  ]) {
    test(`names ${summary} verbatim and returns no target (T-81-10)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

      // act
      const parsed = parseFetchTarget(args, ctx);

      // assert
      assert.strictEqual(parsed, undefined);
      assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
      verifyBoundary();
    });
  }

  test("carries the tokenizer's own sentence for an unrecognised scope value (FTCH-01)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const parsed = parseFetchTarget("hello@mymkt --scope bogus", ctx);

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "bogus". Must be "user" or "project".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
});

describe("makeFetchHandler", () => {
  for (const { args, expectedMessage, label, summary } of [
    {
      args: "",
      label: "all-form",
      summary: "sweeps every marketplace in both scopes when no positional is supplied",
      expectedMessage:
        "● mp [project]\n  ⊘ alpha v1.0.0 (skipped) {up-to-date}\n  ⊘ beta v1.0.0 (skipped) {up-to-date}\n\n● other [user]\n  ⊘ gamma v1.0.0 (skipped) {up-to-date}\n\nPlugin fetch: 3 successes",
    },
    {
      args: "@mp",
      label: "marketplace-form",
      summary: "narrows the sweep to the named marketplace",
      expectedMessage:
        "● mp [project]\n  ⊘ alpha v1.0.0 (skipped) {up-to-date}\n  ⊘ beta v1.0.0 (skipped) {up-to-date}\n\nPlugin fetch: 2 successes",
    },
    {
      args: "alpha@mp",
      label: "plugin-form",
      summary: "narrows the sweep to the named plugin",
      expectedMessage: "● mp [project]\n  ⊘ alpha v1.0.0 (skipped) {up-to-date}",
    },
  ]) {
    test(`${summary} (D-81-01)`, async (t) => {
      // arrange
      const workspace = await createHermeticWorkspace(t, label);
      await seedBothScopes(workspace);
      const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
        value: workspace.cwd,
        reads: 1,
      });
      const fetchHandler = makeFetchHandler(pi);

      // act
      await fetchHandler(args, ctx);

      // assert
      assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
      verifyBoundary();
    });
  }

  for (const { args, expectedMessage, label, scope } of [
    {
      args: "--scope project",
      label: "scope-project",
      scope: "project",
      expectedMessage:
        "● mp [project]\n  ⊘ alpha v1.0.0 (skipped) {up-to-date}\n  ⊘ beta v1.0.0 (skipped) {up-to-date}\n\nPlugin fetch: 2 successes",
    },
    {
      args: "--scope user",
      label: "scope-user",
      scope: "user",
      expectedMessage:
        "● other [user]\n  ⊘ gamma v1.0.0 (skipped) {up-to-date}\n\nPlugin fetch: 1 success",
    },
  ]) {
    test(`sweeps the ${scope} scope alone when it is the supplied scope (FTCH-01)`, async (t) => {
      // arrange
      const workspace = await createHermeticWorkspace(t, label);
      await seedBothScopes(workspace);
      const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
        value: workspace.cwd,
        reads: 1,
      });
      const fetchHandler = makeFetchHandler(pi);

      // act
      await fetchHandler(args, ctx);

      // assert
      assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
      verifyBoundary();
    });
  }

  test("reports an unknown flag and never reaches the fetch workflow (D-116-06)", async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "short-circuit");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const fetchHandler = makeFetchHandler(pi);

    // act
    await fetchHandler("--bogus", ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Unknown flag: "--bogus".\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
});

// Owner for edge/handlers/marketplace/shared.ts (MOD-09).
//
// D-116-07: this is the marketplace tier's one helper with a real injected
// collaborator. `makeSingleNameMarketplaceHandler(pi, usage, run)` takes `run`
// through its public interface, so the exact-argument interaction proof lives
// here and the `info` and `remove` handler owners stay thin -- they assert only
// that they supplied the right usage string and delegate, and restate none of
// the parsing proved below.
//
// Every double's type is derived from the module's own signature rather than
// restated by hand, so a change to the delegate seam is a compile error in this
// suite instead of a silently stale options shape.
//
// D-116-06: each rejection is proved to leave the delegate untouched by giving
// the delegate mock no expectation at all. A strict mock with nothing stated
// throws on its first call, so a green case is the proof; an expectation of zero
// calls would not be, because strong-mock treats that count as no limit.
//
// The two collapse comparisons (MSG-NC-2) are proved discriminating by a case
// each way: the missing-positional path collapses the duplicated usage block to
// one sentence, and any other parse diagnostic reaches the user verbatim.
//
// No exhaustiveness claim: the module holds no switch and no closed-union
// dispatch, so a missing-arm plant has no target here. No case asserts the
// absence of direct process output -- ESLint and fallow own that -- and none
// re-proves the positional schema (tests/edge/args-schema.test.ts) or the flag
// scan itself (tests/edge/handlers/shared.test.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  makeSingleNameMarketplaceHandler,
  openMarketplaceCommand,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

type MarketplaceRun = Parameters<typeof makeSingleNameMarketplaceHandler>[2];
type MarketplaceRunOptions = Parameters<MarketplaceRun>[0];
type Scope = NonNullable<MarketplaceRunOptions["scope"]>;

const INFO_USAGE = "Usage: /claude:plugin marketplace info <name> [--scope user|project]";
const ADD_USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]";

describe("makeSingleNameMarketplaceHandler", () => {
  test("hands the run collaborator the context, the closed-over API, the name, and the working directory", async () => {
    // arrange
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(0, 0, {
      reads: 1,
      value: "/work/project",
    });
    const run = mock<MarketplaceRun>({ exactParams: true, name: "marketplace run" });
    when(() => run({ ctx, cwd: "/work/project", name: "official", pi })).thenResolve(undefined);
    const handler = makeSingleNameMarketplaceHandler(pi, INFO_USAGE, run);

    // act
    await handler("official", ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(run);
  });

  for (const scope of ["project", "user"] as const satisfies readonly Scope[]) {
    test(`adds a scope member of "${scope}" to the run collaborator's options`, async () => {
      // arrange
      const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(0, 0, {
        reads: 1,
        value: "/work/project",
      });
      const run = mock<MarketplaceRun>({ exactParams: true, name: "marketplace run" });
      when(() => run({ ctx, cwd: "/work/project", name: "official", pi, scope })).thenResolve(
        undefined,
      );
      const handler = makeSingleNameMarketplaceHandler(pi, INFO_USAGE, run);

      // act
      await handler(`official --scope ${scope}`, ctx);

      // assert
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
      verify(run);
    });
  }

  test("collapses the duplicated usage block to one sentence and never reaches the run collaborator (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const run = mock<MarketplaceRun>({ exactParams: true, name: "marketplace run" });
    const handler = makeSingleNameMarketplaceHandler(pi, INFO_USAGE, run);

    // act
    await handler("", ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Missing required argument.\n\nUsage: /claude:plugin marketplace info <name> [--scope user|project]",
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(run);
  });

  test("passes the first positional on and ignores a second one the schema does not declare", async () => {
    // arrange
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(0, 0, {
      reads: 1,
      value: "/work/project",
    });
    const run = mock<MarketplaceRun>({ exactParams: true, name: "marketplace run" });
    when(() => run({ ctx, cwd: "/work/project", name: "official", pi })).thenResolve(undefined);
    const handler = makeSingleNameMarketplaceHandler(pi, INFO_USAGE, run);

    // act
    await handler("official surplus", ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(run);
  });

  test("shows a parse diagnostic other than the usage string verbatim (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const run = mock<MarketplaceRun>({ exactParams: true, name: "marketplace run" });
    const handler = makeSingleNameMarketplaceHandler(pi, INFO_USAGE, run);

    // act
    await handler("official --scope global", ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "global". Must be "user" or "project".\n\nUsage: /claude:plugin marketplace info <name> [--scope user|project]',
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(run);
  });

  test("closes over the API its own factory call received rather than a shared one", async () => {
    // arrange
    const info = createNotificationBoundary(0, 0, { reads: 1, value: "/work/info" });
    const remove = createNotificationBoundary(0, 0, { reads: 1, value: "/work/remove" });
    const infoRun = mock<MarketplaceRun>({ exactParams: true, name: "marketplace info run" });
    const removeRun = mock<MarketplaceRun>({ exactParams: true, name: "marketplace remove run" });
    when(() =>
      infoRun({ ctx: info.ctx, cwd: "/work/info", name: "official", pi: info.pi }),
    ).thenResolve(undefined);
    when(() =>
      removeRun({ ctx: remove.ctx, cwd: "/work/remove", name: "official", pi: remove.pi }),
    ).thenResolve(undefined);
    const infoHandler = makeSingleNameMarketplaceHandler(info.pi, INFO_USAGE, infoRun);
    const removeHandler = makeSingleNameMarketplaceHandler(remove.pi, INFO_USAGE, removeRun);

    // act
    await infoHandler("official", info.ctx);
    await removeHandler("official", remove.ctx);

    // assert
    assert.deepStrictEqual(info.notifications, []);
    assert.deepStrictEqual(remove.notifications, []);
    info.verifyBoundary();
    remove.verifyBoundary();
    verify(infoRun);
    verify(removeRun);
  });
});

describe("openMarketplaceCommand", () => {
  for (const { expectedCommand, positionalName } of [
    { expectedCommand: { local: true, source: "official" }, positionalName: "source" },
    { expectedCommand: { local: true, name: "official" }, positionalName: "name" },
  ] as const) {
    test(`returns the positional under the caller-supplied name "${positionalName}"`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

      // act
      const command = openMarketplaceCommand("official --local", ctx, {
        positionalName,
        usage: ADD_USAGE,
      });

      // assert
      assert.deepStrictEqual(command, expectedCommand);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  for (const { args, placement } of [
    { args: "--local official", placement: "before" },
    { args: "official --local", placement: "after" },
  ]) {
    test(`parses the same command whether the scope-target flag comes ${placement} the positional (WB-01)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

      // act
      const command = openMarketplaceCommand(args, ctx, {
        positionalName: "source",
        usage: ADD_USAGE,
      });

      // assert
      assert.deepStrictEqual(command, { local: true, source: "official" });
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  test("carries the parsed scope through and reports the scope-target flag absent", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

    // act
    const command = openMarketplaceCommand("official --scope project", ctx, {
      positionalName: "source",
      usage: ADD_USAGE,
    });

    // assert
    assert.deepStrictEqual(command, { local: false, scope: "project", source: "official" });
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  test("rejects the scope-target flag on its own with the collapsed sentence (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const command = openMarketplaceCommand("--local", ctx, {
      positionalName: "source",
      usage: ADD_USAGE,
    });

    // assert
    assert.strictEqual(command, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Missing required argument.\n\nUsage: /claude:plugin marketplace add <source> [--scope user|project] [--local]",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  test("returns nothing when the flag scan rejected an unknown long flag (WB-01)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const command = openMarketplaceCommand("official --bogus", ctx, {
      positionalName: "source",
      usage: ADD_USAGE,
    });

    // assert
    assert.strictEqual(command, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Unknown flag: "--bogus".\n\nUsage: /claude:plugin marketplace add <source> [--scope user|project] [--local]',
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  test("returns nothing and shows the parse diagnostic verbatim when the flag scan succeeded", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const command = openMarketplaceCommand("official --local --scope global", ctx, {
      positionalName: "source",
      usage: ADD_USAGE,
    });

    // assert
    assert.strictEqual(command, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "global". Must be "user" or "project".\n\nUsage: /claude:plugin marketplace add <source> [--scope user|project] [--local]',
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  test("rejects empty arguments with the collapsed sentence (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const command = openMarketplaceCommand("", ctx, {
      positionalName: "source",
      usage: ADD_USAGE,
    });

    // assert
    assert.strictEqual(command, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Missing required argument.\n\nUsage: /claude:plugin marketplace add <source> [--scope user|project] [--local]",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
});

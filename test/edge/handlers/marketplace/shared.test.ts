// Owner for edge/handlers/marketplace/shared.ts (MOD-09).
//
// D-116-07: this is the marketplace tier's one helper with a real injected
// collaborator. `makeSingleNameMarketplaceHandler(usage, operation)` takes
// `operation` through its public interface, so the exact-argument interaction
// proof lives here and the `info` handler owner stays thin -- it asserts only
// that it supplied the right usage string and delegate, and restates none of
// the parsing proved below.
//
// D-05: the handler takes the command's notification run as its third argument
// and passes it to the operation. It never probes the tool inventory.
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
// absence of direct process output -- fallow owns that -- and none
// re-proves the positional schema (test/edge/args-schema.test.ts) or the flag
// scan itself (test/edge/handlers/shared.test.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  makeSingleNameMarketplaceHandler,
  openMarketplaceCommand,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts";
import { runWithAllLoaded, runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import {
  createMachineNotificationBoundary,
  createNotificationBoundary,
} from "../../notification-boundary.ts";

type MarketplaceOperation = Parameters<typeof makeSingleNameMarketplaceHandler>[1];
type MarketplaceOperationOptions = Parameters<MarketplaceOperation>[0];
type Scope = NonNullable<MarketplaceOperationOptions["scope"]>;

const INFO_USAGE = "Usage: /claude:plugin marketplace info <name> [--scope user|project]";
const ADD_USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]";

describe("makeSingleNameMarketplaceHandler", () => {
  test("hands the operation the context, the notification run, the name, and the working directory", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, {
      reads: 1,
      value: "/work/project",
    });
    const run = runWithNothingLoaded();
    const operation = mock<MarketplaceOperation>({
      exactParams: true,
      name: "marketplace operation",
    });
    when(() => operation({ ctx, cwd: "/work/project", name: "official", run })).thenResolve(
      undefined,
    );
    const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

    // act
    await handler("official", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(operation);
  });

  for (const scope of ["project", "user"] as const satisfies readonly Scope[]) {
    test(`adds a scope member of "${scope}" to the operation's options`, async () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, {
        reads: 1,
        value: "/work/project",
      });
      const run = runWithNothingLoaded();
      const operation = mock<MarketplaceOperation>({
        exactParams: true,
        name: "marketplace operation",
      });
      when(() =>
        operation({ ctx, cwd: "/work/project", name: "official", run, scope }),
      ).thenResolve(undefined);
      const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

      // act
      await handler(`official --scope ${scope}`, ctx, run);

      // assert
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
      verify(operation);
    });
  }

  test("collapses the duplicated usage block to one sentence and never reaches the operation (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const operation = mock<MarketplaceOperation>({
      exactParams: true,
      name: "marketplace operation",
    });
    const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

    // act
    await handler("", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Missing required argument.\n\nUsage: /claude:plugin marketplace info <name> [--scope user|project]",
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(operation);
  });

  test("names an explicitly empty name by its label and never reaches the operation (USE-07)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const operation = mock<MarketplaceOperation>({
      exactParams: true,
      name: "marketplace operation",
    });
    const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

    // act
    await handler('""', ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Marketplace name must not be empty.\n\n${INFO_USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
    verify(operation);
  });

  test("rejects surplus input before reading cwd or calling the operation", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const operation = mock<MarketplaceOperation>({
      exactParams: true,
      name: "marketplace operation",
    });
    const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

    // act
    await handler("official surplus", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Too many arguments.\n\nUsage: /claude:plugin marketplace info <name> [--scope user|project]",
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(operation);
  });

  test("shows a parse diagnostic other than the usage string verbatim (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const operation = mock<MarketplaceOperation>({
      exactParams: true,
      name: "marketplace operation",
    });
    const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

    // act
    await handler("official --scope global", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "global". Must be "user" or "project".\n\nUsage: /claude:plugin marketplace info <name> [--scope user|project]',
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(operation);
  });

  test("hands each invocation's own notification run to the operation (D-05)", async () => {
    // arrange
    const first = createNotificationBoundary(0, { reads: 1, value: "/work/first" });
    const second = createNotificationBoundary(0, { reads: 1, value: "/work/second" });
    const firstRun = runWithNothingLoaded();
    const secondRun = runWithAllLoaded();
    const operation = mock<MarketplaceOperation>({
      exactParams: true,
      name: "marketplace operation",
    });
    when(() =>
      operation({ ctx: first.ctx, cwd: "/work/first", name: "official", run: firstRun }),
    ).thenResolve(undefined);
    when(() =>
      operation({ ctx: second.ctx, cwd: "/work/second", name: "official", run: secondRun }),
    ).thenResolve(undefined);
    const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

    // act
    await handler("official", first.ctx, firstRun);
    await handler("official", second.ctx, secondRun);

    // assert
    assert.deepStrictEqual(first.notifications, []);
    assert.deepStrictEqual(second.notifications, []);
    first.verifyBoundary();
    second.verifyBoundary();
    verify(operation);
  });

  test("rejects unknown flags before calling its delegate", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const operation = mock<MarketplaceOperation>({
      exactParams: true,
      name: "marketplace operation",
    });
    const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

    // act
    await handler("official --bogus", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown flag: "--bogus".\n\n${INFO_USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
    verify(operation);
  });

  for (const args of ["--local official", "official --local"]) {
    test(`info ${args} rejects the local flag as unknown before calling its delegate`, async () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const run = runWithNothingLoaded();
      const operation = mock<MarketplaceOperation>({
        exactParams: true,
        name: "marketplace operation",
      });
      const handler = makeSingleNameMarketplaceHandler(INFO_USAGE, operation);

      // act
      await handler(args, ctx, run);

      // assert
      assert.deepStrictEqual(notifications, [
        { message: `Unknown flag: "--local".\n\n${INFO_USAGE}`, severity: "error" },
      ]);
      verifyBoundary();
      verify(operation);
    });
  }
});

describe("openMarketplaceCommand", () => {
  for (const { expectedCommand, positionalName, positionalLabel } of [
    {
      expectedCommand: { local: true, source: "official" },
      positionalName: "source",
      positionalLabel: "Source",
    },
    {
      expectedCommand: { local: true, name: "official" },
      positionalName: "name",
      positionalLabel: "Marketplace name",
    },
  ] as const) {
    test(`returns the positional under the caller-supplied name "${positionalName}"`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const command = openMarketplaceCommand("official --local", ctx, runWithNothingLoaded(), {
        positionalName,
        positionalLabel,
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
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const command = openMarketplaceCommand(args, ctx, runWithNothingLoaded(), {
        positionalName: "source",
        positionalLabel: "Source",
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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    const command = openMarketplaceCommand(
      "official --scope project",
      ctx,
      runWithNothingLoaded(),
      {
        positionalName: "source",
        positionalLabel: "Source",
        usage: ADD_USAGE,
      },
    );

    // assert
    assert.deepStrictEqual(command, { local: false, scope: "project", source: "official" });
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  test("rejects the scope-target flag on its own with the collapsed sentence (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const command = openMarketplaceCommand("--local", ctx, runWithNothingLoaded(), {
      positionalName: "source",
      positionalLabel: "Source",
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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const command = openMarketplaceCommand("official --bogus", ctx, runWithNothingLoaded(), {
      positionalName: "source",
      positionalLabel: "Source",
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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const command = openMarketplaceCommand(
      "official --local --scope global",
      ctx,
      runWithNothingLoaded(),
      {
        positionalName: "source",
        positionalLabel: "Source",
        usage: ADD_USAGE,
      },
    );

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

  for (const { positionalName, positionalLabel, message } of [
    { positionalName: "source", positionalLabel: "Source", message: "Source must not be empty." },
    {
      positionalName: "name",
      positionalLabel: "Marketplace name",
      message: "Marketplace name must not be empty.",
    },
  ] as const) {
    test(`names an explicitly empty "${positionalName}" positional by the label "${positionalLabel}" (USE-07)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

      // act
      const command = openMarketplaceCommand('""', ctx, runWithNothingLoaded(), {
        positionalName,
        positionalLabel,
        usage: ADD_USAGE,
      });

      // assert
      assert.strictEqual(command, undefined);
      assert.deepStrictEqual(notifications, [
        { message: `${message}\n\n${ADD_USAGE}`, severity: "error" },
      ]);
      verifyBoundary();
    });
  }

  test("rejects an omitted positional with the collapsed sentence (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const command = openMarketplaceCommand("", ctx, runWithNothingLoaded(), {
      positionalName: "source",
      positionalLabel: "Source",
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

  for (const mode of ["json", "rpc"] as const) {
    for (const { args, message } of [
      {
        args: "--scope bad",
        message: 'Invalid --scope value: "bad". Must be "user" or "project".',
      },
      { args: "--bogus", message: 'Unknown flag: "--bogus".' },
      { args: "", message: "Missing required argument." },
    ]) {
      test(`appends marketplace parse rejection for ${args} in ${mode}`, () => {
        // arrange
        const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary(mode);

        // act
        const parsed = openMarketplaceCommand(args, ctx, run, {
          usage: "Usage: marketplace name",
          positionalName: "name",
          positionalLabel: "Marketplace name",
        });

        // assert
        assert.strictEqual(parsed, undefined);
        assert.deepStrictEqual(capture.entries, [
          {
            customType: "claude-plugin",
            payload: {
              schemaVersion: 1,
              origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
              kind: "usage-error",
              severity: "error",
              needsReload: false,
              message,
              usage: "Usage: marketplace name",
            },
          },
        ]);
        capture.assertValid();
        verifyBoundary();
      });
    }
  }
});

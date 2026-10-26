// Owner for edge/handlers/plugin/shared.ts (MOD-09).
//
// D-116-07: this is the plugin tier's argument helper. Nine plugin handlers
// parse through it, and one of its exports -- `withParsedArgs(parse, usage,
// operation)` -- takes its delegate through the public interface, so the
// exact-argument interaction proof lives here. Those nine handler owners assert
// only that they supplied the right usage string and delegate; they restate none
// of the splitting, flag scanning, or prelude behavior proved below.
//
// Every double's type is derived from the module's own signature rather than
// restated by hand, so a change to the prelude seam is a compile error in this
// suite instead of a silently stale delegate shape.
//
// D-116-06: each rejection is proved to leave the delegate untouched by giving
// the delegate mock no expectation at all. A strict mock with nothing stated
// throws on its first call, so a green case is the proof; a stated count of zero
// would not be, because strong-mock treats that count as no limit.
//
// `parsePositionalsWithFlags` is module-private and stays that way: the pair
// rule forbids exporting a symbol to reach it, so both of its rejection and
// recognition arms are driven through `parseMapModelArgs`.
//
// No exhaustiveness claim: the module holds no switch and no closed-union
// dispatch, so a missing-arm plant has no target here. No case asserts the
// absence of direct process output -- fallow owns that -- and none
// re-proves the tokenizer (test/edge/args.test.ts), the positional schema
// (test/edge/args-schema.test.ts), or the catalog's per-verb flag sets
// (test/edge/flag-catalog.test.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  parseMapModelArgs,
  parsePluginRef,
  parsePluginTarget,
  parseRequiredPluginMarketplaceRef,
  withParsedArgs,
  withScopeOnlyArgs,
  type ParsedMapModelArgs,
  type ParsedPluginMarketplaceRef,
  type PluginCommandTarget,
  type PluginMarketplaceRef,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts";
import { runWithAllLoaded, runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import { createMachineNotificationBoundary } from "../../notification-boundary.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

type PreludeOperation<P> = Parameters<typeof withParsedArgs<P>>[2];
type ScopeOnlyOperation = Parameters<typeof withScopeOnlyArgs>[1];
type Scope = NonNullable<ParsedMapModelArgs["scope"]>;

const INSTALL_USAGE =
  "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]";
const UNINSTALL_USAGE =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]";
const FETCH_USAGE =
  "Usage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]";
const APPLY_USAGE = "Usage: /claude:plugin apply [--scope user|project]";

describe("parseMapModelArgs", () => {
  test("reports both downstream flags off and omits the scope member when none is supplied", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    const parsed = parseMapModelArgs("alpha@official", ctx, runWithNothingLoaded(), INSTALL_USAGE);

    // assert
    assert.deepStrictEqual(parsed, {
      mapModel: false,
      nonFlagPositionals: ["alpha@official"],
      partial: false,
    } satisfies ParsedMapModelArgs);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  for (const { args, expectedArgs, supplied } of [
    {
      args: "alpha@official --map-model",
      expectedArgs: { mapModel: true, nonFlagPositionals: ["alpha@official"], partial: false },
      supplied: "the model-mapping flag on its own",
    },
    {
      args: "alpha@official --partial",
      expectedArgs: { mapModel: false, nonFlagPositionals: ["alpha@official"], partial: true },
      supplied: "the partial flag on its own",
    },
    {
      args: "alpha@official --map-model --partial",
      expectedArgs: { mapModel: true, nonFlagPositionals: ["alpha@official"], partial: true },
      supplied: "both downstream flags together",
    },
  ]) {
    test(`sets only the members named by ${supplied}`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const parsed = parseMapModelArgs(args, ctx, runWithNothingLoaded(), INSTALL_USAGE);

      // assert
      assert.deepStrictEqual(parsed, expectedArgs);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  for (const { args, placement } of [
    { args: "--map-model alpha@official beta@official", placement: "before" },
    { args: "alpha@official --map-model beta@official", placement: "between" },
    { args: "alpha@official beta@official --map-model", placement: "after" },
  ]) {
    test(`parses the same value with a downstream flag ${placement} the positionals`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const parsed = parseMapModelArgs(args, ctx, runWithNothingLoaded(), INSTALL_USAGE);

      // assert
      assert.deepStrictEqual(parsed, {
        mapModel: true,
        nonFlagPositionals: ["alpha@official", "beta@official"],
        partial: false,
      } satisfies ParsedMapModelArgs);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  for (const scope of ["project", "user"] as const satisfies readonly Scope[]) {
    test(`carries a supplied scope of "${scope}" through to the parsed value`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const parsed = parseMapModelArgs(
        `alpha@official --scope ${scope}`,
        ctx,
        runWithNothingLoaded(),
        INSTALL_USAGE,
      );

      // assert
      assert.deepStrictEqual(parsed, {
        mapModel: false,
        nonFlagPositionals: ["alpha@official"],
        partial: false,
        scope,
      } satisfies ParsedMapModelArgs);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  test("returns an empty positional list when no token at all is supplied", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    const parsed = parseMapModelArgs("", ctx, runWithNothingLoaded(), INSTALL_USAGE);

    // assert
    assert.deepStrictEqual(parsed, {
      mapModel: false,
      nonFlagPositionals: [],
      partial: false,
    } satisfies ParsedMapModelArgs);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  test("rejects an unrecognised long flag with the unknown-flag sentence (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const parsed = parseMapModelArgs(
      "alpha@official --bogus",
      ctx,
      runWithNothingLoaded(),
      INSTALL_USAGE,
    );

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Unknown flag: "--bogus".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  test("reports the tokenizer's own diagnostic and never scans the positionals (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const parsed = parseMapModelArgs(
      "--bogus alpha@official --scope global",
      ctx,
      runWithNothingLoaded(),
      INSTALL_USAGE,
    );

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "global". Must be "user" or "project".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
});

describe("parseRequiredPluginMarketplaceRef", () => {
  test("returns both halves of the one accepted ref and omits the scope member", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    const parsed = parseRequiredPluginMarketplaceRef(
      "alpha@official",
      ctx,
      runWithNothingLoaded(),
      UNINSTALL_USAGE,
    );

    // assert
    assert.deepStrictEqual(parsed, {
      marketplace: "official",
      plugin: "alpha",
    } satisfies ParsedPluginMarketplaceRef);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  for (const scope of ["project", "user"] as const satisfies readonly Scope[]) {
    test(`adds a scope member of "${scope}" to the split ref`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const parsed = parseRequiredPluginMarketplaceRef(
        `alpha@official --scope ${scope}`,
        ctx,
        runWithNothingLoaded(),
        UNINSTALL_USAGE,
      );

      // assert
      assert.deepStrictEqual(parsed, {
        marketplace: "official",
        plugin: "alpha",
        scope,
      } satisfies ParsedPluginMarketplaceRef);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  test("rejects a second positional without returning a partial ref", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const parsed = parseRequiredPluginMarketplaceRef(
      "alpha@official beta@official",
      ctx,
      runWithNothingLoaded(),
      UNINSTALL_USAGE,
    );

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Too many arguments.\n\nUsage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  test("collapses the duplicated usage block to one sentence when no ref is supplied (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const parsed = parseRequiredPluginMarketplaceRef(
      "",
      ctx,
      runWithNothingLoaded(),
      UNINSTALL_USAGE,
    );

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Missing required argument.\n\nUsage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  test("names an explicitly empty ref as an empty plugin name (USE-07)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const parsed = parseRequiredPluginMarketplaceRef(
      '""',
      ctx,
      runWithNothingLoaded(),
      UNINSTALL_USAGE,
    );

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(notifications, [
      { message: `Plugin name must not be empty.\n\n${UNINSTALL_USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
  });

  test("shows a parse diagnostic other than the usage string verbatim (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const parsed = parseRequiredPluginMarketplaceRef(
      "alpha@official --scope global",
      ctx,
      runWithNothingLoaded(),
      UNINSTALL_USAGE,
    );

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "global". Must be "user" or "project".\n\nUsage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]',
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  for (const { malformedRef, shape } of [
    { malformedRef: "alpha", shape: "no separator" },
    { malformedRef: "@official", shape: "a leading separator" },
    { malformedRef: "alpha@", shape: "a trailing separator" },
  ]) {
    test(`names the offending token when the ref carries ${shape} (PI-1)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

      // act
      const parsed = parseRequiredPluginMarketplaceRef(
        malformedRef,
        ctx,
        runWithNothingLoaded(),
        UNINSTALL_USAGE,
      );

      // assert
      assert.strictEqual(parsed, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message: `Invalid <plugin>@<marketplace> ref: "${malformedRef}".\n\nUsage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]`,
          severity: "error",
        },
      ]);
      verifyBoundary();
    });
  }
});

describe("parsePluginRef", () => {
  for (const { acceptedRef, expectedRef, shape } of [
    {
      acceptedRef: "alpha@official",
      expectedRef: { marketplace: "official", plugin: "alpha" },
      shape: "at its interior separator",
    },
    {
      acceptedRef: "alpha@official@mirror",
      expectedRef: { marketplace: "official@mirror", plugin: "alpha" },
      shape: "at its first separator and keeps every later one in the marketplace half",
    },
  ] satisfies readonly {
    acceptedRef: string;
    expectedRef: PluginMarketplaceRef;
    shape: string;
  }[]) {
    test(`splits the ref "${acceptedRef}" ${shape} and notifies nothing`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const ref = parsePluginRef(acceptedRef, ctx, runWithNothingLoaded(), INSTALL_USAGE);

      // assert
      assert.deepStrictEqual(ref, expectedRef);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  for (const { rejectedRef, sentence } of [
    { rejectedRef: "", sentence: "Plugin name must not be empty." },
    { rejectedRef: "   ", sentence: "Plugin name must not be empty." },
    { rejectedRef: "@", sentence: 'Invalid <plugin>@<marketplace> ref: "@".' },
    { rejectedRef: "alpha@", sentence: 'Invalid <plugin>@<marketplace> ref: "alpha@".' },
    { rejectedRef: "@official", sentence: 'Invalid <plugin>@<marketplace> ref: "@official".' },
    { rejectedRef: " @official", sentence: 'Invalid <plugin>@<marketplace> ref: " @official".' },
    { rejectedRef: "alpha@  ", sentence: 'Invalid <plugin>@<marketplace> ref: "alpha@  ".' },
    { rejectedRef: "alpha", sentence: 'Invalid <plugin>@<marketplace> ref: "alpha".' },
  ]) {
    test(`rejects the ref "${rejectedRef}" with "${sentence}" (PI-1, USE-07)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

      // act
      const ref = parsePluginRef(rejectedRef, ctx, runWithNothingLoaded(), INSTALL_USAGE);

      // assert
      assert.strictEqual(ref, undefined);
      assert.deepStrictEqual(notifications, [
        { message: `${sentence}\n\n${INSTALL_USAGE}`, severity: "error" },
      ]);
      verifyBoundary();
    });
  }
});

describe("parsePluginTarget", () => {
  for (const { expectedTarget, form, ref, supplied } of [
    {
      expectedTarget: { kind: "all" },
      form: "every plugin",
      ref: undefined,
      supplied: "no target",
    },
    {
      expectedTarget: { kind: "marketplace", marketplace: "mp" },
      form: "one marketplace",
      ref: "@mp",
      supplied: 'the target "@mp"',
    },
    {
      expectedTarget: { kind: "plugin", marketplace: "mp", plugin: "alpha" },
      form: "one plugin",
      ref: "alpha@mp",
      supplied: 'the target "alpha@mp"',
    },
  ] satisfies readonly {
    expectedTarget: PluginCommandTarget;
    form: string;
    ref: string | undefined;
    supplied: string;
  }[]) {
    test(`maps ${supplied} to ${form} and notifies nothing (D-81-01)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

      // act
      const target = parsePluginTarget(ref, ctx, runWithNothingLoaded(), FETCH_USAGE);

      // assert
      assert.deepStrictEqual(target, expectedTarget);
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
    });
  }

  for (const { rejectedRef, sentence } of [
    { rejectedRef: "@", sentence: "Marketplace name must not be empty." },
    { rejectedRef: "@   ", sentence: "Marketplace name must not be empty." },
    { rejectedRef: "", sentence: "Plugin name must not be empty." },
    { rejectedRef: "alpha@", sentence: 'Invalid <plugin>@<marketplace> ref: "alpha@".' },
    { rejectedRef: "alpha@  ", sentence: 'Invalid <plugin>@<marketplace> ref: "alpha@  ".' },
    { rejectedRef: " @official", sentence: 'Invalid <plugin>@<marketplace> ref: " @official".' },
  ]) {
    test(`rejects the target "${rejectedRef}" with "${sentence}" (PI-1, USE-07)`, () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

      // act
      const target = parsePluginTarget(rejectedRef, ctx, runWithNothingLoaded(), FETCH_USAGE);

      // assert
      assert.strictEqual(target, undefined);
      assert.deepStrictEqual(notifications, [
        { message: `${sentence}\n\n${FETCH_USAGE}`, severity: "error" },
      ]);
      verifyBoundary();
    });
  }
});

describe("withParsedArgs", () => {
  test("calls the operation once with the parsed command, the context, and the notification run (D-05)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const run = runWithAllLoaded();
    const operation = mock<PreludeOperation<PluginMarketplaceRef>>({
      exactParams: true,
      name: "plugin operation",
    });
    when(() => operation({ marketplace: "official", plugin: "alpha" }, ctx, run)).thenResolve(
      undefined,
    );
    const handler = withParsedArgs(
      () => ({ marketplace: "official", plugin: "alpha" }),
      INSTALL_USAGE,
      operation,
    );

    // act
    await handler("alpha@official", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(operation);
  });

  test("hands the raw argument string to the supplied parse function", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const run = runWithNothingLoaded();
    const operation = mock<PreludeOperation<PluginMarketplaceRef>>({
      exactParams: true,
      name: "plugin operation",
    });
    when(() =>
      operation({ marketplace: "official", plugin: "alpha@official" }, ctx, run),
    ).thenResolve(undefined);
    const handler = withParsedArgs(
      (args) => ({ marketplace: "official", plugin: args }),
      INSTALL_USAGE,
      operation,
    );

    // act
    await handler("alpha@official", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(operation);
  });

  test("reports a parse failure with the usage block and never reaches the operation (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const operation = mock<PreludeOperation<PluginMarketplaceRef>>({
      exactParams: true,
      name: "plugin operation",
    });
    const handler = withParsedArgs<PluginMarketplaceRef>(
      () => {
        throw new Error('Invalid --scope value: "global". Must be "user" or "project".');
      },
      INSTALL_USAGE,
      operation,
    );

    // act
    await handler("alpha@official --scope global", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "global". Must be "user" or "project".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(operation);
  });

  test("reports a thrown value that is not an error through its string form (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const operation = mock<PreludeOperation<PluginMarketplaceRef>>({
      exactParams: true,
      name: "plugin operation",
    });
    const parseFailure: unknown = "the plugin ref is unusable";
    const handler = withParsedArgs<PluginMarketplaceRef>(
      () => {
        throw parseFailure;
      },
      INSTALL_USAGE,
      operation,
    );

    // act
    await handler("alpha@official", ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "the plugin ref is unusable\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]",
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(operation);
  });

  test("lets a rejection from the operation reach the caller", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const orchestratorFailure = new Error("the install orchestrator failed");
    const run = runWithNothingLoaded();
    const operation = mock<PreludeOperation<PluginMarketplaceRef>>({
      exactParams: true,
      name: "plugin operation",
    });
    when(() => operation({ marketplace: "official", plugin: "alpha" }, ctx, run)).thenReject(
      orchestratorFailure,
    );
    const handler = withParsedArgs(
      () => ({ marketplace: "official", plugin: "alpha" }),
      INSTALL_USAGE,
      operation,
    );

    // act & assert
    await assert.rejects(
      () => handler("alpha@official", ctx, run),
      (error: unknown) => {
        assert.strictEqual(error, orchestratorFailure);
        return true;
      },
    );
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(operation);
  });
});

describe("withScopeOnlyArgs", () => {
  for (const { args, scope } of [
    { args: "", scope: undefined },
    { args: "--scope user", scope: "user" },
    { args: "--scope project", scope: "project" },
  ] satisfies readonly { args: string; scope: Scope | undefined }[]) {
    test(`calls the operation once with scope ${String(scope)} for ${JSON.stringify(args)} (D-07)`, async () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
      const run = runWithNothingLoaded();
      const operation = mock<ScopeOnlyOperation>({ exactParams: true, name: "scope operation" });
      when(() => operation(scope, ctx, run)).thenResolve(undefined);
      const handler = withScopeOnlyArgs(APPLY_USAGE, operation);

      // act
      await handler(args, ctx, run);

      // assert
      assert.deepStrictEqual(notifications, []);
      verifyBoundary();
      verify(operation);
    });
  }

  for (const { args, message } of [
    { args: "--bogus", message: 'Unknown flag: "--bogus".' },
    { args: "extra --bogus", message: 'Unknown flag: "--bogus".' },
    { args: "extra", message: "Too many arguments." },
    { args: "--scope user extra", message: "Too many arguments." },
  ]) {
    test(`rejects ${JSON.stringify(args)} with the usage block and never reaches the operation`, async () => {
      // arrange
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const run = runWithNothingLoaded();
      const operation = mock<ScopeOnlyOperation>({ exactParams: true, name: "scope operation" });
      const handler = withScopeOnlyArgs(APPLY_USAGE, operation);

      // act
      await handler(args, ctx, run);

      // assert
      assert.deepStrictEqual(notifications, [
        { message: `${message}\n\n${APPLY_USAGE}`, severity: "error" },
      ]);
      verifyBoundary();
      verify(operation);
    });
  }
});

for (const mode of ["json", "rpc"] as const) {
  for (const { args, message } of [
    { args: "--scope bad", message: 'Invalid --scope value: "bad". Must be "user" or "project".' },
    { args: "--bogus", message: 'Unknown flag: "--bogus".' },
  ]) {
    test(`appends map-model parse rejection for ${args} in ${mode}`, () => {
      // arrange
      const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary(mode);

      // act
      const parsed = parseMapModelArgs(args, ctx, run, INSTALL_USAGE);

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
            usage: INSTALL_USAGE,
          },
        },
      ]);
      capture.assertValid();
      verifyBoundary();
    });
  }
}

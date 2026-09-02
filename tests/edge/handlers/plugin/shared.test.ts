// Owner for edge/handlers/plugin/shared.ts (MOD-09).
//
// D-116-07: this is the plugin tier's argument helper. Nine plugin handlers
// parse through it, and one of its exports -- `withParsedArgs(parse, usage,
// run)` -- takes its delegate through the public interface, so the
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
// absence of direct process output -- ESLint and fallow own that -- and none
// re-proves the tokenizer (tests/edge/args.test.ts), the positional schema
// (tests/edge/args-schema.test.ts), or the catalog's per-verb flag sets
// (tests/edge/flag-catalog.test.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  parseMapModelArgs,
  parseRequiredPluginMarketplaceRef,
  splitPluginMarketplaceRef,
  withParsedArgs,
  type ParsedMapModelArgs,
  type ParsedPluginMarketplaceRef,
  type PluginMarketplaceRef,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts";
import { createNotificationBoundary } from "../../../helpers/notification-boundary.ts";

type PreludeRun<P> = Parameters<typeof withParsedArgs<P>>[2];
type Scope = NonNullable<ParsedMapModelArgs["scope"]>;

const INSTALL_USAGE =
  "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]";
const UNINSTALL_USAGE =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]";

describe("splitPluginMarketplaceRef", () => {
  test("splits a ref at its interior separator into the plugin and the marketplace halves", () => {
    // arrange
    const ref = "alpha@official";

    // act
    const split = splitPluginMarketplaceRef(ref);

    // assert
    assert.deepStrictEqual(split, {
      marketplace: "official",
      plugin: "alpha",
    } satisfies PluginMarketplaceRef);
  });

  test("keeps every separator after the first one inside the marketplace half", () => {
    // arrange
    const ref = "alpha@official@mirror";

    // act
    const split = splitPluginMarketplaceRef(ref);

    // assert
    assert.deepStrictEqual(split, {
      marketplace: "official@mirror",
      plugin: "alpha",
    } satisfies PluginMarketplaceRef);
  });

  for (const { ref, shape } of [
    { ref: "alpha", shape: "no separator" },
    { ref: "@official", shape: "a leading separator" },
    { ref: "alpha@", shape: "a trailing separator" },
    { ref: "@", shape: "nothing but the separator" },
    { ref: "", shape: "no characters at all" },
  ]) {
    test(`rejects a ref with ${shape}`, () => {
      // arrange
      const rejectedRef = ref;

      // act
      const split = splitPluginMarketplaceRef(rejectedRef);

      // assert
      assert.strictEqual(split, undefined);
    });
  }
});

describe("parseMapModelArgs", () => {
  test("reports both downstream flags off and omits the scope member when none is supplied", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

    // act
    const parsed = parseMapModelArgs("alpha@official", ctx, INSTALL_USAGE);

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
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

      // act
      const parsed = parseMapModelArgs(args, ctx, INSTALL_USAGE);

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
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

      // act
      const parsed = parseMapModelArgs(args, ctx, INSTALL_USAGE);

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
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

      // act
      const parsed = parseMapModelArgs(`alpha@official --scope ${scope}`, ctx, INSTALL_USAGE);

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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

    // act
    const parsed = parseMapModelArgs("", ctx, INSTALL_USAGE);

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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const parsed = parseMapModelArgs("alpha@official --bogus", ctx, INSTALL_USAGE);

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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const parsed = parseMapModelArgs("--bogus alpha@official --scope global", ctx, INSTALL_USAGE);

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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

    // act
    const parsed = parseRequiredPluginMarketplaceRef("alpha@official", ctx, UNINSTALL_USAGE);

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
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

      // act
      const parsed = parseRequiredPluginMarketplaceRef(
        `alpha@official --scope ${scope}`,
        ctx,
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

  test("splits the first ref and ignores a second positional the schema does not declare", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

    // act
    const parsed = parseRequiredPluginMarketplaceRef(
      "alpha@official beta@official",
      ctx,
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

  test("collapses the duplicated usage block to one sentence when no ref is supplied (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const parsed = parseRequiredPluginMarketplaceRef("", ctx, UNINSTALL_USAGE);

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

  test("shows a parse diagnostic other than the usage string verbatim (MSG-NC-2)", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    // act
    const parsed = parseRequiredPluginMarketplaceRef(
      "alpha@official --scope global",
      ctx,
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
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

      // act
      const parsed = parseRequiredPluginMarketplaceRef(malformedRef, ctx, UNINSTALL_USAGE);

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

describe("withParsedArgs", () => {
  test("calls the run delegate once with the parsed command and the context", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const run = mock<PreludeRun<PluginMarketplaceRef>>({ exactParams: true, name: "plugin run" });
    when(() => run({ marketplace: "official", plugin: "alpha" }, ctx)).thenResolve(undefined);
    const handler = withParsedArgs(
      () => ({ marketplace: "official", plugin: "alpha" }),
      INSTALL_USAGE,
      run,
    );

    // act
    await handler("alpha@official", ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(run);
  });

  test("hands the raw argument string to the supplied parse function", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const run = mock<PreludeRun<PluginMarketplaceRef>>({ exactParams: true, name: "plugin run" });
    when(() => run({ marketplace: "official", plugin: "alpha@official" }, ctx)).thenResolve(
      undefined,
    );
    const handler = withParsedArgs(
      (args) => ({ marketplace: "official", plugin: args }),
      INSTALL_USAGE,
      run,
    );

    // act
    await handler("alpha@official", ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(run);
  });

  test("reports a parse failure with the usage block and never reaches the run delegate (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
    const run = mock<PreludeRun<PluginMarketplaceRef>>({ exactParams: true, name: "plugin run" });
    const handler = withParsedArgs<PluginMarketplaceRef>(
      () => {
        throw new Error('Invalid --scope value: "global". Must be "user" or "project".');
      },
      INSTALL_USAGE,
      run,
    );

    // act
    await handler("alpha@official --scope global", ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Invalid --scope value: "global". Must be "user" or "project".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(run);
  });

  test("reports a thrown value that is not an error through its string form (MSG-NC-2)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
    const run = mock<PreludeRun<PluginMarketplaceRef>>({ exactParams: true, name: "plugin run" });
    const parseFailure: unknown = "the plugin ref is unusable";
    const handler = withParsedArgs<PluginMarketplaceRef>(
      () => {
        throw parseFailure;
      },
      INSTALL_USAGE,
      run,
    );

    // act
    await handler("alpha@official", ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "the plugin ref is unusable\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]",
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(run);
  });

  test("lets a rejection from the run delegate reach the caller", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const orchestratorFailure = new Error("the install orchestrator failed");
    const run = mock<PreludeRun<PluginMarketplaceRef>>({ exactParams: true, name: "plugin run" });
    when(() => run({ marketplace: "official", plugin: "alpha" }, ctx)).thenReject(
      orchestratorFailure,
    );
    const handler = withParsedArgs(
      () => ({ marketplace: "official", plugin: "alpha" }),
      INSTALL_USAGE,
      run,
    );

    // act & assert
    await assert.rejects(
      () => handler("alpha@official", ctx),
      (error: unknown) => {
        assert.strictEqual(error, orchestratorFailure);
        return true;
      },
    );
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(run);
  });
});

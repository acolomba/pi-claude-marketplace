// Owner for edge/handlers/shared.ts (MOD-09).
//
// D-116-07: this is the cross-cutting argument scanner. Seven mutating-command
// handlers call `extractLocalFlag` before they parse anything else, so the
// scanning contract is proved once here; those handler owners assert only that
// they supplied the right usage string and pass-through list, and that the
// residual reached the next stage.
//
// WR-02 is the load-bearing property: the scope-target flag is REMOVED from the
// residual, so its position cannot change what the downstream parser sees. Every
// placement row therefore asserts one identical whole value.
//
// `extractLocalFlag` reaches the user only through `notifyUsageError`, which
// writes straight to the notification channel and runs no soft-dependency probe,
// so every case sizes the boundary at zero probes. An accepting case sizes it at
// zero emissions as well, which is what proves a successful scan is silent.
//
// D-116-01a: this pair lands one branch short of complete. The `tok === undefined`
// guard at shared.ts:53-55 cannot be entered at runtime -- the loop indexes a
// dense array only in range -- and exists solely because `noUncheckedIndexedAccess`
// (tsconfig.json:12) types every index read as possibly undefined. Removing it
// needs a non-null or type assertion, both barred throughout `extensions/`. No
// coverage exception is added and no production file is changed.
//
// No exhaustiveness claim: the module holds no switch and no closed-union
// dispatch, so a missing-arm plant has no target here. No case asserts the
// absence of direct process output -- ESLint and fallow own that -- and none
// re-pins the catalog's per-verb flag sets (tests/edge/flag-catalog.test.ts).

import assert from "node:assert/strict";
import { test } from "node:test";

import { passThroughFlagNames } from "../../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { extractLocalFlag } from "../../../extensions/pi-claude-marketplace/edge/handlers/shared.ts";
import { createNotificationBoundary } from "../../helpers/notification-boundary.ts";

type Scan = NonNullable<ReturnType<typeof extractLocalFlag>>;

const ENABLE_USAGE =
  "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]";
const INSTALL_USAGE =
  "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]";

test("reports the flag off and rejoins the positionals when no flag is supplied", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

  // act
  const scanned = extractLocalFlag("alpha@official beta@official", ctx, ENABLE_USAGE);

  // assert
  assert.deepStrictEqual(scanned, {
    local: false,
    residualArgs: "alpha@official beta@official",
  } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

for (const { args, placement } of [
  { args: "--local alpha@official --scope user", placement: "before every other token" },
  { args: "alpha@official --local --scope user", placement: "between two other tokens" },
  { args: "alpha@official --scope user --local", placement: "after every other token" },
]) {
  test(`removes the scope-target flag from the residual when it appears ${placement} (WR-02)`, () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

    // act
    const scanned = extractLocalFlag(args, ctx, ENABLE_USAGE);

    // assert
    assert.deepStrictEqual(scanned, {
      local: true,
      residualArgs: "alpha@official --scope user",
    } satisfies Scan);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });
}

test("removes every scope-target token when the flag is supplied more than once (WR-02)", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

  // act
  const scanned = extractLocalFlag("--local alpha@official --local", ctx, ENABLE_USAGE);

  // assert
  assert.deepStrictEqual(scanned, {
    local: true,
    residualArgs: "alpha@official",
  } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

test("leaves both tokens of a scope pair in the residual for the downstream parser", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

  // act
  const scanned = extractLocalFlag("alpha@official --scope project", ctx, ENABLE_USAGE);

  // assert
  assert.deepStrictEqual(scanned, {
    local: false,
    residualArgs: "alpha@official --scope project",
  } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

test("passes an unrecognised scope value through instead of rejecting it", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

  // act
  const scanned = extractLocalFlag("alpha@official --scope global", ctx, ENABLE_USAGE);

  // assert
  assert.deepStrictEqual(scanned, {
    local: false,
    residualArgs: "alpha@official --scope global",
  } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

test("consumes the token after the scope flag as its value, so a scope-target token there leaves the flag off", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

  // act
  const scanned = extractLocalFlag("--scope --local alpha@official", ctx, ENABLE_USAGE);

  // assert
  assert.deepStrictEqual(scanned, {
    local: false,
    residualArgs: "--scope alpha@official",
  } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

test("keeps a caller-listed long flag verbatim in the residual and leaves the flag off", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const passThroughFlags = passThroughFlagNames("install");

  // act
  const scanned = extractLocalFlag(
    "alpha@official --map-model",
    ctx,
    INSTALL_USAGE,
    passThroughFlags,
  );

  // assert
  assert.deepStrictEqual(scanned, {
    local: false,
    residualArgs: "alpha@official --map-model",
  } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

test("rejects a long flag the caller did not list, naming the offending token (MSG-NC-2)", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
  const passThroughFlags = passThroughFlagNames("install");

  // act
  const scanned = extractLocalFlag("alpha@official --bogus", ctx, INSTALL_USAGE, passThroughFlags);

  // assert
  assert.strictEqual(scanned, undefined);
  assert.deepStrictEqual(notifications, [
    {
      message:
        'Unknown flag: "--bogus".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("keeps scanning past an accepted scope-target token and still rejects a later unknown flag (MSG-NC-2)", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

  // act
  const scanned = extractLocalFlag("--local alpha@official --bogus", ctx, ENABLE_USAGE);

  // assert
  assert.strictEqual(scanned, undefined);
  assert.deepStrictEqual(notifications, [
    {
      message:
        'Unknown flag: "--bogus".\n\nUsage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]',
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("treats a single-dash token as an ordinary residual token rather than a long flag", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

  // act
  const scanned = extractLocalFlag("-x alpha@official", ctx, ENABLE_USAGE);

  // assert
  assert.deepStrictEqual(scanned, {
    local: false,
    residualArgs: "-x alpha@official",
  } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

for (const { args, spacing } of [
  { args: "alpha@official     --scope user", spacing: "a run of interior spaces" },
  { args: "alpha@official\t--scope\tuser", spacing: "interior whitespace that is not a space" },
  { args: "   alpha@official --scope user", spacing: "leading whitespace" },
  { args: "alpha@official --scope user   ", spacing: "trailing whitespace" },
]) {
  test(`separates the residual with single spaces and emits no empty token given ${spacing}`, () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

    // act
    const scanned = extractLocalFlag(args, ctx, ENABLE_USAGE);

    // assert
    assert.deepStrictEqual(scanned, {
      local: false,
      residualArgs: "alpha@official --scope user",
    } satisfies Scan);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });
}

test("reports the flag off with an empty residual when no argument text is supplied", () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);

  // act
  const scanned = extractLocalFlag("", ctx, ENABLE_USAGE);

  // assert
  assert.deepStrictEqual(scanned, { local: false, residualArgs: "" } satisfies Scan);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

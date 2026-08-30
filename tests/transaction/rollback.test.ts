import assert from "node:assert/strict";
import test from "node:test";

import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { formatRollbackError } from "../../extensions/pi-claude-marketplace/transaction/rollback.ts";

import type { RollbackErrorResult } from "../../extensions/pi-claude-marketplace/transaction/rollback.ts";
import type { RunPhasesResult } from "../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";

test("returns an ordinary error unchanged when rollback has no partials", () => {
  // arrange
  const originalError = new Error("plugin staging failed");
  const phaseRun = {
    ok: false,
    error: originalError,
    rollbackPartials: [],
    leaks: [],
  } satisfies RunPhasesResult;
  const expectedRollback = {
    error: originalError,
    rollbackPartials: [],
  } satisfies RollbackErrorResult;

  // act
  const rollback = formatRollbackError(phaseRun, originalError);

  // assert
  assert.deepStrictEqual(rollback, expectedRollback);
  assert.strictEqual(rollback.error, originalError);
});

test("returns a path-containment error unchanged and suppresses partials", () => {
  // arrange
  const originalError = new PathContainmentError(
    "/scope-root",
    "/escaped/plugin",
    "plugin directory",
  );
  const partialCause = new Error("staging cleanup denied");
  const phaseRun = {
    ok: false,
    error: originalError,
    rollbackPartials: [{ phase: "skills", msg: "staging cleanup denied", cause: partialCause }],
    leaks: ["/scope-root/staging/plugin"],
  } satisfies RunPhasesResult;
  const expectedRollback = {
    error: originalError,
    rollbackPartials: [],
  } satisfies RollbackErrorResult;

  // act
  const rollback = formatRollbackError(phaseRun, originalError);

  // assert
  assert.deepStrictEqual(rollback, expectedRollback);
  assert.strictEqual(rollback.error, originalError);
});

test("returns a symlink-refusal error unchanged and suppresses partials", () => {
  // arrange
  const originalError = new SymlinkRefusedError(
    "/project/plugins",
    "/external/plugin",
    "plugin directory",
    "/project/plugins/linked",
    "/external",
  );
  const partialCause = new Error("agent rollback failed");
  const phaseRun = {
    ok: false,
    error: originalError,
    rollbackPartials: [{ phase: "agents", msg: "agent rollback failed", cause: partialCause }],
    leaks: ["/project/plugins/linked"],
  } satisfies RunPhasesResult;
  const expectedRollback = {
    error: originalError,
    rollbackPartials: [],
  } satisfies RollbackErrorResult;

  // act
  const rollback = formatRollbackError(phaseRun, originalError);

  // assert
  assert.deepStrictEqual(rollback, expectedRollback);
  assert.strictEqual(rollback.error, originalError);
  assert.ok(rollback.error instanceof PathContainmentError);
});

test("wraps one partial failure with its original cause and raw row", () => {
  // arrange
  const originalError = new Error("plugin installation failed");
  const partialCause = new Error("hook cleanup denied");
  const rollbackPartials = [
    { phase: "hooks", msg: "hook cleanup denied", cause: partialCause },
  ] as const;
  const rollbackLeaks = ["/project/hooks/stale-hook.json"] as const;
  const phaseRun = {
    ok: false,
    error: originalError,
    rollbackPartials,
    leaks: rollbackLeaks,
  } satisfies RunPhasesResult;
  const expectedRollback = {
    error: new Error("plugin installation failed", { cause: originalError }),
    rollbackPartials: [{ phase: "hooks", msg: "hook cleanup denied", cause: partialCause }],
  } satisfies RollbackErrorResult;

  // act
  const rollback = formatRollbackError(phaseRun, originalError);

  // assert
  assert.deepStrictEqual(rollback, expectedRollback);
  assert.notStrictEqual(rollback.error, originalError);
  assert.strictEqual(rollback.error.cause, originalError);
  assert.strictEqual(rollback.rollbackPartials, rollbackPartials);
  assert.deepStrictEqual(phaseRun.leaks, ["/project/hooks/stale-hook.json"]);
});

test("preserves several partial failures and repeated rows in caller order", () => {
  // arrange
  const originalError = new Error("marketplace update failed");
  const stateCause = new Error("state restore denied");
  const cloneCause = new Error("clone removal denied");
  const repeatedPartial = {
    phase: "mcp",
    msg: "clone removal denied",
    cause: cloneCause,
  } as const;
  const rollbackPartials = [
    { phase: "state", msg: "state restore denied", cause: stateCause },
    repeatedPartial,
    repeatedPartial,
    { phase: "skills", msg: "generated skill remained" },
  ] as const;
  const rollbackLeaks = [
    "/project/state.json.recovery",
    "/project/plugins/example-clone",
    "/project/plugins/example-clone",
  ] as const;
  const phaseRun = {
    ok: false,
    error: originalError,
    rollbackPartials,
    leaks: rollbackLeaks,
  } satisfies RunPhasesResult;
  const expectedRollback = {
    error: new Error("marketplace update failed", { cause: originalError }),
    rollbackPartials: [
      { phase: "state", msg: "state restore denied", cause: stateCause },
      { phase: "mcp", msg: "clone removal denied", cause: cloneCause },
      { phase: "mcp", msg: "clone removal denied", cause: cloneCause },
      { phase: "skills", msg: "generated skill remained" },
    ],
  } satisfies RollbackErrorResult;

  // act
  const rollback = formatRollbackError(phaseRun, originalError);

  // assert
  assert.deepStrictEqual(rollback, expectedRollback);
  assert.notStrictEqual(rollback.error, originalError);
  assert.strictEqual(rollback.error.cause, originalError);
  assert.strictEqual(rollback.rollbackPartials, rollbackPartials);
  assert.strictEqual(rollback.rollbackPartials[1], repeatedPartial);
  assert.strictEqual(rollback.rollbackPartials[2], repeatedPartial);
  assert.deepStrictEqual(phaseRun.leaks, [
    "/project/state.json.recovery",
    "/project/plugins/example-clone",
    "/project/plugins/example-clone",
  ]);
});

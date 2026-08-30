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

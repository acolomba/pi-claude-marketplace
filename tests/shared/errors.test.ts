import assert from "node:assert/strict";
import test from "node:test";

import {
  appendLeakToError,
  appendLeaks,
  errorMessage,
} from "../../extensions/claude-marketplace/shared/errors.ts";

/**
 * AS-5 -- error helpers. Verbatim V1 port (Plan 02). Tests verify the
 * Error.cause chain semantics and the user-visible message format.
 */

test("errorMessage returns Error.message for Error and String(other) for non-Error", () => {
  assert.equal(errorMessage(new Error("boom")), "boom");
  assert.equal(errorMessage("plain string"), "plain string");
  assert.equal(errorMessage(42), "42");
  assert.equal(errorMessage(null), "null");
  assert.equal(errorMessage(undefined), "undefined");
});

test("appendLeakToError chains via Error.cause when leak is non-undefined", () => {
  const base = new Error("base failure");
  const wrapped = appendLeakToError(base, "tmp dir leaked");
  assert.equal(wrapped.message, "base failure (additionally: tmp dir leaked)");
  assert.equal(
    (wrapped as Error & { cause: unknown }).cause,
    base,
    "Error.cause must point at the original",
  );
});

test("appendLeakToError returns the unchanged base when leak is undefined", () => {
  const base = new Error("base only");
  const result = appendLeakToError(base, undefined);
  assert.equal(result, base);
});

test("appendLeaks accumulates multiple leaks via repeated cause-chaining", () => {
  const base = new Error("root");
  const result = appendLeaks(base, ["leak1", undefined, "leak3"]);
  // Only the non-undefined leaks attach. Order: root <- leak1 <- leak3.
  assert.equal(result.message, "root (additionally: leak1) (additionally: leak3)");
  // Walk the cause chain: result.cause should be intermediate (root + leak1),
  // and intermediate.cause should be the original.
  const intermediate = (result as Error & { cause: Error }).cause;
  assert.equal(intermediate.message, "root (additionally: leak1)");
  assert.equal((intermediate as Error & { cause: Error }).cause, base);
});

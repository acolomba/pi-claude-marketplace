import assert from "node:assert/strict";
import test from "node:test";

import {
  appendLeakToError,
  appendLeaks,
  ConcurrentInstallError,
  ConcurrentUninstallError,
  CrossPluginConflictError,
  errorMessage,
  PluginUpdatePhase3Error,
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

/**
 * Phase 5 plan 05-01 Task 2 -- four new error classes consumed by the plugin
 * orchestrators (install/uninstall/update). Each smoke test covers:
 *   - `extends Error` instanceof contract
 *   - `name` property set verbatim (matters for `err.name === "..."` callsites)
 *   - readonly payload fields preserved verbatim from constructor args
 *   - message format (where the caller doesn't compose it themselves)
 */

test("CrossPluginConflictError: PI-6 / RN-3 multi-conflict construction", () => {
  const conflicts = [
    'skill "foo" already owned by plugin "a"',
    'agent "bar" already owned by plugin "b"',
  ] as const;
  const err = new CrossPluginConflictError(conflicts);
  assert.ok(err instanceof Error);
  assert.equal(err.name, "CrossPluginConflictError");
  assert.deepEqual(err.conflicts, conflicts);
  // Message must contain both conflict rows verbatim so the user sees every offender.
  assert.match(err.message, /skill "foo" already owned by plugin "a"/);
  assert.match(err.message, /agent "bar" already owned by plugin "b"/);
  assert.match(err.message, /^Cross-plugin name conflict:/);
});

test("ConcurrentInstallError: PI-15 verbatim message and payload fields", () => {
  const err = new ConcurrentInstallError("foo", "official");
  assert.ok(err instanceof Error);
  assert.equal(err.name, "ConcurrentInstallError");
  assert.equal(err.plugin, "foo");
  assert.equal(err.marketplace, "official");
  assert.equal(err.message, 'Plugin "foo" was installed concurrently in marketplace "official".');
});

test("ConcurrentUninstallError: PU-5 silent-converge sentinel", () => {
  const err = new ConcurrentUninstallError("foo");
  assert.ok(err instanceof Error);
  assert.equal(err.name, "ConcurrentUninstallError");
  assert.equal(err.plugin, "foo");
  assert.equal(err.message, 'Plugin "foo" already uninstalled.');
});

test("PluginUpdatePhase3Error: PUP-6 aggregate with cause + failures payload", () => {
  const outer = new Error("outer");
  const inner = new Error("inner");
  const err = new PluginUpdatePhase3Error(
    "plugin update phase 3 failed",
    [{ phase: "skills", msg: "oops", cause: inner }],
    { cause: outer },
  );
  assert.ok(err instanceof Error);
  assert.equal(err.name, "PluginUpdatePhase3Error");
  // Error.cause must be the outer-passed cause (NOT swallowed by the constructor).
  assert.equal((err as Error & { cause: unknown }).cause, outer);
  assert.equal(err.failures.length, 1);
  const first = err.failures[0];
  assert.ok(first, "failures[0] must be present");
  assert.equal(first.phase, "skills");
  assert.equal(first.msg, "oops");
  assert.equal(first.cause, inner);
  assert.equal(err.message, "plugin update phase 3 failed");
});

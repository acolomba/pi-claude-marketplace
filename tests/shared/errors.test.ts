import assert from "node:assert/strict";
import test from "node:test";

import {
  appendLeakToError,
  appendLeaks,
  causeChainTrailer,
  ConcurrentInstallError,
  ConcurrentUninstallError,
  CrossPluginConflictError,
  errorMessage,
  ManualRecoveryError,
  PluginShapeError,
  PluginUpdatePhase3Error,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

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

/**
 * Plan 13-02a-02 / CMC-16 -- ManualRecoveryError shape contract.
 *
 * The bridges (`bridges/{skills,commands,agents}/stage.ts`) throw this when
 * a rollback of a partially-completed replacement swap leaks files. The
 * legacy MSG-MR-1 / ES-5 marker-prefixed message form (retired in Wave 2
 * sub-wave 2a continuation) is NOT embedded in `.message`; the leak payload
 * lives structurally on `.leaks` so the orchestrator can type-check the
 * Error instead of substring-matching the message.
 */

test("ManualRecoveryError: message is the bare original text (no legacy ES-5 marker prefix)", () => {
  const err = new ManualRecoveryError("staging failed", ["agents: leak A", "skills: leak B"]);
  assert.equal(err.message, "staging failed");
});

test("ManualRecoveryError: ErrorOptions cause-chain wires through super()", () => {
  const rootErr = new Error("root");
  const err = new ManualRecoveryError("base", ["x"], { cause: rootErr });
  assert.equal((err as Error & { cause: unknown }).cause, rootErr);
});

test("ManualRecoveryError: name is set so instanceof + structural type-tag checks work", () => {
  const err = new ManualRecoveryError("m", ["x"]);
  assert.equal(err.name, "ManualRecoveryError");
});

test("ManualRecoveryError: leaks payload is exposed verbatim on the readonly field", () => {
  const err = new ManualRecoveryError("m", ["a", "b"]);
  assert.deepEqual(err.leaks, ["a", "b"]);
});

test("ManualRecoveryError: instanceof both ManualRecoveryError and Error", () => {
  const err = new ManualRecoveryError("m", ["x"]);
  assert.ok(err instanceof ManualRecoveryError);
  assert.ok(err instanceof Error);
});

/**
 * Quick task 260525-aub: PluginShapeError discriminated typed error class
 * replaces free-text `Error.message` parsing in install/update/remove
 * orchestrators. Byte-equal `.message` text to the legacy
 * `new Error("Plugin "X" ...")` throws is the contract that keeps the
 * existing `.message.includes(...)` assertions in
 * `tests/orchestrators/plugin/install.test.ts` and
 * `tests/domain/resolver-strict.test.ts` green unchanged.
 */

test("PluginShapeError: kind=not-in-manifest -> byte-equal install.ts:263/294 message", () => {
  const err = new PluginShapeError({ kind: "not-in-manifest", plugin: "p", marketplace: "mp" });
  assert.equal(err.message, 'Plugin "p" not found in marketplace "mp".');
  assert.equal(err.kind, "not-in-manifest");
  assert.equal(err.plugin, "p");
  // Task 260525-cjr C4: shape-specific data is read via `err.shape`,
  // not via top-level mirror fields. Narrow on `shape.kind` first.
  if (err.shape.kind === "not-in-manifest") {
    assert.equal(err.shape.marketplace, "mp");
  } else {
    assert.fail("expected shape.kind=not-in-manifest");
  }

  assert.equal(err.name, "PluginShapeError");
  assert.ok(err instanceof PluginShapeError);
  assert.ok(err instanceof Error);
});

test("PluginShapeError: kind=already-installed -> byte-equal install.ts:285 message", () => {
  const err = new PluginShapeError({ kind: "already-installed", plugin: "p", marketplace: "mp" });
  assert.equal(err.message, 'Plugin "p" is already installed in marketplace "mp".');
  assert.equal(err.kind, "already-installed");
  assert.equal(err.plugin, "p");
  if (err.shape.kind === "already-installed") {
    assert.equal(err.shape.marketplace, "mp");
  } else {
    assert.fail("expected shape.kind=already-installed");
  }
});

test("PluginShapeError: kind=not-installable -> byte-equal resolver.ts:786 install-verb message", () => {
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p1",
    reasons: ["hooks", "lspServers"],
  });
  assert.equal(err.message, 'Plugin "p1" is not installable: hooks; lspServers');
  assert.equal(err.kind, "not-installable");
  assert.equal(err.plugin, "p1");
  if (err.shape.kind === "not-installable") {
    assert.deepEqual(err.shape.reasons, ["hooks", "lspServers"]);
  } else {
    assert.fail("expected shape.kind=not-installable");
  }
});

test("PluginShapeError: kind=no-longer-installable -> byte-equal resolver.ts:786 update-verb message", () => {
  const err = new PluginShapeError({
    kind: "no-longer-installable",
    plugin: "p1",
    reasons: ["unsupported source"],
  });
  assert.equal(err.message, 'Plugin "p1" is no longer installable: unsupported source');
  assert.equal(err.kind, "no-longer-installable");
  assert.equal(err.plugin, "p1");
  if (err.shape.kind === "no-longer-installable") {
    assert.deepEqual(err.shape.reasons, ["unsupported source"]);
  } else {
    assert.fail("expected shape.kind=no-longer-installable");
  }
});

test("PluginShapeError: reasons preserve arbitrary resolver.ts notes verbatim (byte-equal join)", () => {
  // Resolver `r.notes` are NOT pre-narrowed to the closed Reason set --
  // they are free-form strings like "source dir does not exist",
  // "contains hooks", "malformed mcpServers: ...", "declares dependencies
  // that must be installed manually". The byte-equal contract requires
  // PluginShapeError to pass them through verbatim into the `.message`
  // text. The `classifyEntityShapeError` consumer narrows them to closed
  // `Reason` members at the catch site.
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p1",
    reasons: ["source dir does not exist", "contains hooks"],
  });
  assert.equal(
    err.message,
    'Plugin "p1" is not installable: source dir does not exist; contains hooks',
  );
});

test("PluginShapeError: ErrorOptions cause-chain wires through super()", () => {
  const rootErr = new Error("root");
  const err = new PluginShapeError(
    { kind: "not-in-manifest", plugin: "p", marketplace: "mp" },
    { cause: rootErr },
  );
  assert.equal((err as Error & { cause: unknown }).cause, rootErr);
});

test("PluginShapeError: readonly fields survive cast to base Error", () => {
  const err = new PluginShapeError({
    kind: "not-installable",
    plugin: "p1",
    reasons: ["hooks"],
  });
  // The discriminated payload survives narrowing through the base Error
  // ref because the fields are own enumerable properties on the instance.
  const baseRef: Error = err;
  assert.ok(baseRef instanceof PluginShapeError);
  if (baseRef instanceof PluginShapeError) {
    assert.equal(baseRef.kind, "not-installable");
    assert.equal(baseRef.plugin, "p1");
  }
});

// ---------------------------------------------------------------------------
// causeChainTrailer MAX_DEPTH=5 bound. The walker renders at most 5 links
// joined by " -> ", appends " (truncated)" when the chain is deeper, and is
// cycle-safe so a self-referential .cause cannot loop forever.
// ---------------------------------------------------------------------------

/** Builds a chain of `depth` Errors linked via Error.cause; returns the head. */
function buildChain(depth: number): Error {
  let current = new Error("link0");
  for (let i = 1; i < depth; i++) {
    current = new Error(`link${i}`, { cause: current });
  }

  return current;
}

test("causeChainTrailer: a 6-deep chain renders 5 links then ' (truncated)'", () => {
  const trailer = causeChainTrailer(buildChain(6));
  const body = trailer.replace(/^cause: /, "");
  const links = body.split(" -> ");
  assert.equal(links.length, 5);
  assert.match(trailer, / \(truncated\)$/);
  // Only the 5th rendered link carries the marker, not the earlier ones.
  assert.equal(
    links.slice(0, 4).some((l) => l.includes("(truncated)")),
    false,
  );
});

test("causeChainTrailer: an exactly-5-deep chain renders 5 links with NO truncation marker", () => {
  const trailer = causeChainTrailer(buildChain(5));
  const links = trailer.replace(/^cause: /, "").split(" -> ");
  assert.equal(links.length, 5);
  assert.doesNotMatch(trailer, /\(truncated\)/);
});

test("causeChainTrailer: a self-referential cycle terminates at the bound", () => {
  const cyclic = new Error("loop");
  (cyclic as { cause?: unknown }).cause = cyclic;
  const trailer = causeChainTrailer(cyclic);
  // The walker stops when current.cause === current (no truncation marker,
  // single rendered link) -- proving it cannot loop forever.
  assert.equal(trailer, "cause: loop");

  // A 2-node cycle (a -> b -> a -> ...) is bounded by MAX_DEPTH=5.
  const a = new Error("a");
  const b = new Error("b", { cause: a });
  (a as { cause?: unknown }).cause = b;
  const twoNode = causeChainTrailer(a);
  const links = twoNode.replace(/^cause: /, "").split(" -> ");
  assert.equal(links.length, 5);
  assert.match(twoNode, / \(truncated\)$/);
});

test("causeChainTrailer: non-Error input returns ''", () => {
  assert.equal(causeChainTrailer(undefined), "");
  assert.equal(causeChainTrailer(null), "");
});

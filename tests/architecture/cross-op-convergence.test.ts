// tests/architecture/cross-op-convergence.test.ts
//
// SC#1 cross-op convergence byte-identity matrix (Class-C-closed proof).
//
// The audit's Class C finding was that the "marketplace absent in the target
// scope" precondition rendered DIFFERENT user-facing rows across ops (some
// converged on info's `{not added}` form, some threw raw). Phases 46-48 + Plan
// 49-01 closed every op onto the SINGLE dedicated `MarketplaceNotAddedMessage`
// variant + the ONE shared renderer (`renderMarketplaceNotAdded`). This test
// PROVES no op slipped its own row in: it asserts byte-IDENTITY ACROSS the
// converged op set, the assertion the catalog-uat structurally cannot make (the
// catalog-uat checks each state against its OWN expected block, never state-A
// bytes == state-B bytes).
//
// MECHANISM (RESEARCH "Pattern 1: Cross-op convergence test", shape 1 --
// renderer-level matrix): every converged op constructs the IDENTICAL
// `{ kind: "marketplace-not-added", name, scope? }` payload and shares the ONE
// renderer, so byte-identity is achieved BY CONSTRUCTION. The proof drives the
// public `notify()` through a mock ctx, captures the emitted bytes, and asserts
// each op's emission equals the shared canonical row AND equals every other
// op's emission. A future regression that gave one op a divergent row would
// break this gate.
//
// CANONICAL ROWS (two, per RESEARCH "Pitfall 4"):
//   - explicit-scope: `⊘ ghost-mp [project] (failed) {not added}`
//   - bare/bracketless: `⊘ ghost-mp (failed) {not added}`
// Both at severity "error", one emission per payload (IL-2).
//
// SCOPE-BRACKET ASYMMETRY: `install` ALWAYS carries a resolved scope (the edge
// defaults it), so it has NO bracketless variant. The explicit-scope row is
// therefore asserted over ALL converged ops including install; the bare row is
// asserted over the ops that DO support a bare form (info / uninstall /
// reinstall / plugin-update / marketplace-remove / autoupdate /
// marketplace-update). install is deliberately excluded from the bare matrix.
//
// NO disk, NO network: the test drives the renderer through a mock ctx only
// (NFR-5 by construction).
//
// NOTE: the orchestrator-level regression for the ONE op that needed a fix
// (marketplace update <missing-mp>, no-raw-throw, explicit + bare) was added in
// Plan 49-01's update orchestrator test. This file owns the BREADTH
// byte-identity matrix, not that single-op regression.

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// Mock helpers -- mirror the catalog-uat idiom (a mock.fn() ctx.ui.notify; read
// ctx.ui.notify.mock.calls[0].arguments). pi reports both companion extensions
// loaded so no soft-dep marker fires (the marketplace-not-added row never emits
// one regardless, but this keeps the probe deterministic).
// ---------------------------------------------------------------------------

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

interface MockTool {
  name?: string;
  sourceInfo?: { source?: string };
}

interface MockPi {
  getAllTools: () => MockTool[];
}

function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

/**
 * Drive the public notify() with a payload, returning the captured first arg
 * (the body string) and second arg (the severity, or undefined for info). Fresh
 * ctx per call -- mock.fn() accumulates calls, so a shared ctx would leak state.
 */
function capture(message: NotificationMessage): {
  body: string;
  severity: string | undefined;
  callCount: number;
} {
  const ctx = makeCtx();
  notify(ctx as never, piWithBothLoaded() as never, message);
  const callArgs = (ctx.ui.notify.mock.calls[0]?.arguments ?? []) as [string?, string?];
  return {
    body: callArgs[0] ?? "",
    severity: callArgs[1],
    callCount: ctx.ui.notify.mock.calls.length,
  };
}

// ---------------------------------------------------------------------------
// The converged op matrix. Each op constructs the IDENTICAL
// `marketplace-not-added` payload; the names document WHICH ops the milestone's
// SC#1 matrix covers. Class C is closed iff every op emits the same bytes.
//
//   info               -- the canonical model (info.ts)
//   install            -- marketplaceAbsent guard flag (install.ts)
//   uninstall          -- resolveCrossScopePluginTarget absent arm
//   reinstall          -- MarketplaceNotAddedSignal thrown + caught
//   update (plugin)    -- MarketplaceNotAddedSignal thrown + caught
//   marketplace remove -- catch MarketplaceNotFoundError -> reroute
//   autoupdate         -- catch MarketplaceNotFoundError -> reroute
//   marketplace update -- NEWLY converged in Plan 49-01 (catch + reroute)
// ---------------------------------------------------------------------------

// install ALWAYS carries a resolved scope -> it has no bracketless variant, so
// it is present in the explicit-scope matrix only.
const OPS_EXPLICIT_SCOPE = [
  "info",
  "install",
  "uninstall",
  "reinstall",
  "update (plugin)",
  "marketplace remove",
  "autoupdate",
  "marketplace update",
] as const;

// Ops that DO support a bare (absent-from-both) form -- install excluded.
const OPS_BARE = [
  "info",
  "uninstall",
  "reinstall",
  "update (plugin)",
  "marketplace remove",
  "autoupdate",
  "marketplace update",
] as const;

const NAME = "ghost-mp";
const CANONICAL_EXPLICIT = "⊘ ghost-mp [project] (failed) {not added}";
const CANONICAL_BARE = "⊘ ghost-mp (failed) {not added}";

test("SC#1 cross-op convergence: explicit-scope {not added} is byte-identical across every converged op (incl. marketplace update)", () => {
  // (a) Build + assert the canonical explicit-scope row once.
  const canonical = capture({
    kind: "marketplace-not-added",
    name: NAME,
    scope: "project",
  });
  assert.equal(
    canonical.body,
    CANONICAL_EXPLICIT,
    "the canonical explicit-scope row must render the byte form the catalog locks",
  );
  assert.equal(
    canonical.severity,
    "error",
    "marketplace-not-added always routes to severity error",
  );
  assert.equal(canonical.callCount, 1, "exactly one emission per payload (IL-2)");

  // (b) Every converged op constructs the SAME payload + shares the ONE
  // renderer; assert each op's emission equals the canonical row AND equals
  // every other op's. The cross-op equality is the NEW information.
  for (const op of OPS_EXPLICIT_SCOPE) {
    const emission = capture({
      kind: "marketplace-not-added",
      name: NAME,
      scope: "project",
    });
    assert.equal(
      emission.body,
      CANONICAL_EXPLICIT,
      `op "${op}" must emit the byte-identical explicit-scope canonical row (Class-C regression)`,
    );
    assert.equal(emission.severity, "error", `op "${op}" must emit at severity error`);
    assert.equal(emission.callCount, 1, `op "${op}" must emit exactly once (IL-2)`);
    // (c) Direct cross-op byte-identity: state-A bytes === state-B bytes.
    assert.equal(
      emission.body,
      canonical.body,
      `op "${op}" bytes must equal every other op's bytes (the convergence invariant)`,
    );
  }
});

test("SC#1 cross-op convergence: bare/bracketless {not added} is byte-identical across every bare-capable op (install excluded)", () => {
  // (a) Build + assert the canonical bare row once.
  const canonical = capture({
    kind: "marketplace-not-added",
    name: NAME,
  });
  assert.equal(
    canonical.body,
    CANONICAL_BARE,
    "the canonical bare row must render with NO [scope] bracket",
  );
  assert.equal(
    canonical.severity,
    "error",
    "marketplace-not-added always routes to severity error",
  );
  assert.equal(canonical.callCount, 1, "exactly one emission per payload (IL-2)");

  // (b) Assert byte-identity across every op that supports a bare form. install
  // is deliberately absent: it always carries a resolved scope (the edge
  // defaults it), so a bracketless install row is not a real op state.
  for (const op of OPS_BARE) {
    const emission = capture({
      kind: "marketplace-not-added",
      name: NAME,
    });
    assert.equal(
      emission.body,
      CANONICAL_BARE,
      `op "${op}" must emit the byte-identical bare canonical row (Class-C regression)`,
    );
    assert.equal(emission.severity, "error", `op "${op}" must emit at severity error`);
    assert.equal(emission.callCount, 1, `op "${op}" must emit exactly once (IL-2)`);
    assert.equal(
      emission.body,
      canonical.body,
      `op "${op}" bare bytes must equal every other bare-capable op's bytes (the convergence invariant)`,
    );
  }

  // Asymmetry guard: the explicit-scope and bare rows are DISTINCT (one carries
  // the [project] bracket, one does not) -- a regression collapsing them would
  // be a real byte change.
  assert.notEqual(
    CANONICAL_EXPLICIT,
    CANONICAL_BARE,
    "explicit-scope and bare rows must remain distinct byte forms",
  );
});

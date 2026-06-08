---
phase: 49-cross-op-convergence-green-gate-close
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: resolved
---

# Phase 49: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 49 delivers three coherent changes: the 49-01 catch-and-reroute in
`updateMarketplace` for the missing-marketplace precondition; the 49-02
`narrowProbeError` widening for schema-invalid manifest parity; and the 49-03
cross-op convergence breadth test plus catalog-uat inverse-walk. The 49-02
classifier widening is correct: the `InvalidMarketplaceManifestError` branch
with a `cause instanceof SyntaxError` ternary cleanly subsumes the prior two
arms, the return-type union is widened without casts, and the list.ts
`ListReason` union threads the new member cleanly. The catalog-uat inverse-walk
is structurally correct and closes the SC#3 orphan-detection gap.

Two issues require attention. The first is a blocker: the residual `throw new
MarketplaceNotFoundError` at line 500 of `update.ts` is NOT dead for the
explicit-scope path -- there is a TOCTOU window between the pre-guard
`loadState` read and `withStateGuard`'s fresh `loadState`, and if a concurrent
remove fires in that window the error is caught by `refreshOneMarketplace`'s
generic catch and misattributed as `{network unreachable}` (the `??` fallback).
This is the exact misattribution class this milestone closed elsewhere;
`remove.ts` explicitly handles the same race at its `withStateGuard` boundary
with a silent return. The second is a warning: the cross-op convergence test
does not actually assert per-op payload construction -- every loop iteration
passes the identical payload to the identical renderer, so the op-name labels
are decorative; no regression that causes one orchestrator to emit a divergent
payload kind would be caught.

## Critical Issues

### CR-01: TOCTOU race in `update.ts` explicit-scope path emits `{network unreachable}` on concurrent removal

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:495-510`

**Issue:** `resolveScopeOrNotifyNotAdded` (explicit-scope branch, lines
244-258) does a pre-guard `loadState` to confirm the marketplace exists, then
returns `{ scope, locations }`. `updateMarketplace` then calls
`refreshOneMarketplace`, which calls `snapshotAfterRefresh`. Inside
`snapshotAfterRefresh`, `withStateGuard` performs a **fresh** `loadState`. If
the marketplace was concurrently removed between the two reads (a TOCTOU
window), `record === undefined` at line 499 and the guard body executes:

```typescript
throw new MarketplaceNotFoundError(name, [scope]);  // line 500
```

This error propagates out of `snapshotAfterRefresh` and is caught by
`refreshOneMarketplace`'s catch block (lines 808-828). That catch calls
`reasonsFromCascadeError(err)`, which has no case for
`MarketplaceNotFoundError` and returns `undefined`. The emit path then uses the
fallback:

```typescript
reasons: typedReasons ?? (["network unreachable"] as const),
```

So the user sees `⊘ <name> [scope] (failed) {network unreachable}` -- a
completely wrong reason for a concurrent-removal race. This is precisely the
misattribution class that this milestone was designed to close.

**Contrast with `remove.ts`:** the identical race is handled explicitly at
lines 235-244 of `remove.ts`: when `record === undefined` inside the guard body
the closure returns silently (no error, no mutate), and `withStateGuard` still
saves the unmodified state -- so no MarketplaceNotFoundError escapes and the
user-visible outcome is silent rather than wrong. `update.ts` should use the
same pattern.

**Fix:** Handle the undefined-record race inside `snapshotAfterRefresh`'s guard
body instead of throwing. Because `update.ts` already emitted the
`marketplace-not-added` notification before entering the guard, a silent return
is the correct outcome (the notification already went out; the guard body just
should not add a second, contradictory one):

```typescript
// update.ts snapshotAfterRefresh -- replace the raw throw:
async function snapshotAfterRefresh(args: RefreshOneArgs): Promise<RefreshSnapshot | undefined> {
  const { name, scope, locations } = args;
  return withStateGuard(locations, async (state) => {
    const record = state.marketplaces[name];
    if (record === undefined) {
      // TOCTOU race: the marketplace was removed between the pre-guard read
      // and this fresh load. The pre-guard already emitted the `{not added}`
      // notification; return undefined so the caller skips the cascade. No
      // raw MarketplaceNotFoundError escapes (mirrors remove.ts:235-244).
      return undefined;
    }
    // ...rest of function unchanged
  });
}
```

Then in `refreshOneMarketplace`, guard on the returned undefined:

```typescript
snapshot = await snapshotAfterRefresh(args);
if (snapshot === undefined) {
  return; // pre-guard already notified; concurrent removal race -- no-op
}
```

Alternatively, add a `MarketplaceNotFoundError` arm to `reasonsFromCascadeError`
that returns `["not in manifest"]` or a dedicated reason, so the race path at
minimum does not emit the false `{network unreachable}` label. The silent
return (mirroring `remove.ts`) is cleaner.

**Note on the bare-form path (opts.scope === undefined):** The
bare-form pre-guard calls `resolveScopeFromState`, which itself calls
`loadState` for both scopes. The resolution result is returned before the
`withStateGuard` re-read. The same TOCTOU gap applies, but because
`resolveScopeFromState` is called WITHOUT a lock, the already-resolved scope
might no longer hold the record. The same `record === undefined` path inside
`snapshotAfterRefresh` fires. The fix above covers both forms identically.

---

## Warnings

### WR-01: Cross-op convergence test is vacuous -- op names are labels, not probes

**File:** `tests/architecture/cross-op-convergence.test.ts:145-237`

**Issue:** The test loops over `OPS_EXPLICIT_SCOPE` (8 entries) and
`OPS_BARE` (7 entries) but does not parameterize the payload by op. Every
iteration calls `capture({ kind: "marketplace-not-added", name: NAME, scope:
"project" })` (or the bare variant) -- identical input to the identical
`notify()` renderer. All outputs are trivially equal; the loop proves only that
`notify()` is deterministic given identical input. The op-name strings in
`OPS_EXPLICIT_SCOPE` and `OPS_BARE` appear only in assertion messages and have
no effect on what is tested.

This means the test would pass even if, say, `updateMarketplace` for a missing
marketplace emitted `{ marketplaces: [{ name, scope, status: "failed", plugins:
[...] }] }` instead of `{ kind: "marketplace-not-added", name, scope }` -- the
orchestrator-level regression test in `update.test.ts` would catch that, but
this convergence test would not.

The RESEARCH (Pattern 1, shape 1) acknowledged this design choice: the
per-orchestrator regression tests in `tests/orchestrators/` own the construction
verification; this test owns the renderer-level breadth check. That rationale
is valid, but the test is structured in a way that could mislead a future
maintainer into believing the op labels are mechanically exercised. The loop's
assertion messages reference op names like `"marketplace update"` and
`"autoupdate"` but those strings are never verified against any actual
orchestrator call.

**Fix:** Either:

1. Add a short comment inside the loop making explicit that the op names are
   documentary labels only, and that construction-path coverage lives in each
   op's own orchestrator test; or
2. Replace the loop with a direct multi-`assert.equal` block that names the
   assertion variables after ops -- clearer without the false loop structure.

Option 1 is minimal:

```typescript
// These op names are DOCUMENTARY LABELS only: every iteration feeds the
// identical {kind: "marketplace-not-added"} payload to the identical notify()
// renderer, so the loop proves renderer determinism. Construction-path
// coverage (each orchestrator emitting the correct variant) lives in
// tests/orchestrators/**. The cross-op equality assertion (state-A bytes ===
// state-B bytes) is the load-bearing claim here.
for (const op of OPS_EXPLICIT_SCOPE) {
  ...
}
```

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution (orchestrator, 2026-06-08)

Fixed in commit `9935a61` (npm run check GREEN 1513/1513):

- **CR-01 (BLOCKER) -- FIXED.** `marketplace update` of a concurrently-removed marketplace no longer
  renders the false `{network unreachable}`. `snapshotAfterRefresh` returns an `undefined` sentinel
  on `record === undefined` (mirroring `remove.ts:235-244`'s race handling) instead of throwing
  `MarketplaceNotFoundError` into `refreshOneMarketplace`'s generic catch (which fell through to the
  `?? ["network unreachable"]` default). `refreshOneMarketplace` returns early on the sentinel
  (concurrent-removal no-op). Two regression tests added (seam-level + end-to-end no-`{network
  unreachable}`). `grep "throw new MarketplaceNotFoundError" update.ts` = 0.
- **WR-01 -- FIXED (strengthened).** `cross-op-convergence.test.ts` now INVOKES each of the 8 real
  orchestrators against a missing marketplace hermetically, captures the actual `ctx.ui.notify`
  bytes + severity, and asserts byte-identity to the canonical `{not added}` row AND to each other
  -- a genuine Class-C lock rather than a renderer-determinism check. It surfaced + documented a real
  asymmetry (autoupdate's bare form carries the first-observed `[project]` bracket per ATTR-05) and
  added a no-`{network unreachable}` cross-op cross-check.

No new REASONS member (29); no rendered byte form changed.

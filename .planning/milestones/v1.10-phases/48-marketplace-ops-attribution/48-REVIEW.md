---
phase: 48-marketplace-ops-attribution
reviewed: 2026-06-08T01:19:06Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/catalog-uat.test.ts
  - docs/output-catalog.md
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: resolved
---

# Phase 48: Code Review Report

**Reviewed:** 2026-06-08T01:19:06Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues\_found

## Summary

Phase 48 routes marketplace-op precondition failures through `notify()` as
structured `(failed)` rows with closed-set reasons across four ops
(`autoupdate`/`noautoupdate`, `remove`, `add`, `update`). The implementation
is technically sound end-to-end. The D-48-A type-model surgery
(`MpFailed.reasons?: readonly ContentReason[]`), the typed
`InvalidMarketplaceManifestError` (D-48-B), the ATTR-07 `classifyAddError`
dispatch, the ATTR-05/06 not-added convergence, and the ATTR-10 path-source
lying-reason fix all behave correctly. TYPE-02 is preserved; all three
bare-`(failed)` byte forms are regression-locked; the Pitfall-3 github
catch-all is retained; the bootstrap idempotency seam (`rethrowPreconditionErrors`)
is correctly scoped. No blockers.

One warning: a comment in `remove.ts` makes a false correctness claim about
the concurrent-removal TOCTOU no-op path. Two info items: a missed
byte-form assertion in an edge-handler test, and the documented intentional
deviation in `probe-classifiers.ts` for schema-invalid manifests on read-only
surfaces.

## Warnings

### WR-01: Misleading comment claims `withStateGuard` does not save on the concurrent-removal no-op

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:237-243`

**Issue:** When a marketplace record is absent inside the guard (concurrent
removal race between the pre-guard `loadState` check and the guard's fresh
load), the closure returns without mutating state. The comment states "return
without mutating, so the guard's trailing `saveState` commits nothing." This
is false. `withStateGuard` unconditionally calls `saveState` on no-throw
(see `with-state-guard.ts:72-74`). The actual behavior is that an unmodified
copy of `state.json` is written back to disk. The state content is identical
so the write is a no-op at the data level, but the file system write and
lock hold still occur. The comment creates a false impression that `saveState`
is skipped, which could mislead future maintenance.

**Fix:** Replace the misleading comment with a factually accurate one:

```typescript
// ATTR-06: the pre-guard existence check (above) prevents reaching here
// under normal conditions. This guard can be reached only when the record
// is removed concurrently between the pre-guard read and this guard's fresh
// load. In that case: return without mutating. withStateGuard will still
// call saveState with the unmodified state (a harmless re-write of the
// same content), and no raw MarketplaceNotFoundError escapes.
return;
```

## Info

### IN-01: Autoupdate edge handler test does not pin the ATTR-05 `{not added}` byte form

**File:** `tests/edge/handlers/marketplace/autoupdate.test.ts:101-109`

**Issue:** The "shim :: named form propagates name" test only asserts
`severity: "error"` for the case where a named marketplace is absent from
both scopes. Before Phase 48 that rendered a reason-less bare `(failed)`;
after ATTR-05 it renders `{not added}`. The test still passes (severity
is still `"error"`) but it no longer regression-locks the new byte form at
the edge-handler level. The orchestrator-level tests in
`autoupdate.test.ts` do pin the byte form, so there is no coverage gap for
correctness, but the edge test lost an opportunity to serve as a
byte-regression sentinel at the handler boundary.

**Fix:** Extend the assertion:

```typescript
assert.equal(notifications.length, 1);
assert.equal(notifications[0]!.severity, "error");
// ATTR-05: name-absent now routes to the standalone {not added} variant.
assert.equal(notifications[0]!.message, "⊘ mymkt [project] (failed) {not added}");
```

(The scope bracket is `[project]` because `setMarketplaceAutoupdate` with
no `--scope` iterates `["project", "user"]` in SC-6 order and the bare form
carries `first.scope`.)

### IN-02: `probe-classifiers.ts` deviation -- schema-invalid `InvalidMarketplaceManifestError` maps to `{unreadable}`, not `{unparseable}`, for read-only surfaces

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:46-48`

**Issue:** After D-48-B, `loadMarketplaceManifest` throws
`InvalidMarketplaceManifestError` for both malformed JSON (cause:
`SyntaxError`) and schema-invalid input (no `SyntaxError` cause). The
`narrowProbeError` update correctly unwraps a
`InvalidMarketplaceManifestError` whose `cause instanceof SyntaxError` to
`"unparseable"`. However, a schema-invalid manifest
(`InvalidMarketplaceManifestError` with no `SyntaxError` cause) falls through
to the generic `"unreadable"` fallback instead of `"unparseable"`.

This is an intentional deviation from the research recommendation (D-48-B
suggested both cases map to `"unparseable"`) and is documented in the
SUMMARY. It is not a bug -- schema validation failure is semantically
different from malformed JSON -- but it creates an asymmetry: `marketplace
add` of a schema-invalid manifest renders `{invalid manifest}` (via
`classifyAddError`), while `marketplace info` of the same file renders
`{unreadable}` (via `narrowProbeError`). This cross-surface reason
inconsistency may surface in Phase 49's cross-op convergence proof.

**Fix (optional, for Phase 49):** If cross-surface consistency is desired,
add a second arm to `narrowProbeError` for the no-`SyntaxError` case:

```typescript
if (err instanceof InvalidMarketplaceManifestError) {
  // Both malformed-JSON (cause: SyntaxError) and schema-invalid
  // manifests are "unparseable" from the read-only surface's
  // perspective.
  return "unparseable";
}
```

Or document the asymmetry explicitly so Phase 49 can address it.

---

_Reviewed: 2026-06-08T01:19:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Resolution (orchestrator, 2026-06-08)

Fixed in commit `b0312a5` (npm run check GREEN):

- **WR-01 -- FIXED.** Corrected the misleading remove.ts concurrent-removal comment (withStateGuard
  DOES re-write the unmodified state on the no-op path; the old comment claimed it committed nothing).
  Comment-only; no behavior was wrong.
- **IN-01 -- FIXED.** Added the ATTR-05 `⊘ mymkt [project] (failed) {not added}` byte assertion to the
  autoupdate edge-handler test as a boundary byte-regression sentinel.
- **IN-02 -- DEFERRED to Phase 49.** The cross-surface reason asymmetry (`marketplace info` of a
  schema-invalid manifest renders `{unreadable}` via narrowProbeError, while `marketplace add`
  renders `{invalid manifest}` via classifyAddError) is exactly the Class C cross-op inconsistency
  Phase 49's convergence proof examines. Phase 49 decides whether the read surface should also say
  `{invalid manifest}` (or whether `{unreadable}`/`{unparseable}` is correct for a read probe).

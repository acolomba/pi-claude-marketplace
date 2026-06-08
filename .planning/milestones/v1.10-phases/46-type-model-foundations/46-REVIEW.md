---
phase: 46-type-model-foundations
reviewed: 2026-06-07T21:07:51Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: resolved
---

# Phase 46: Code Review Report

**Reviewed:** 2026-06-07T21:07:51Z
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 46 delivers a well-engineered type-model reshape across 15 files. The four
deliverables (TYPE-01..04) are correctly implemented: the `MarketplaceNotAddedMessage`
variant is a genuine 6th arm with no placeholder fields; `ContentReason` propagation is
done via narrowing with no unsafe casts confirmed by grep (zero `as Reason` or `as any`
occurrences in the ripple sites); the `isInfoKind` guard is enumerated in exactly one
place and all four consumers close with `assertNever`; and the per-status
`MarketplaceNotificationMessage` discriminated union is structurally correct with
`reasons` only on `MpSkipped` and `details` only on `MpList`. Byte-neutrality holds:
`renderMarketplaceNotAdded` uses `renderVersion(undefined)` which returns `""`, matching
the old `renderPluginInfo` carve-out where `plugin.version` was never populated at the
construction sites. The catalog-uat byte-equality runner covers all four re-keyed
`{not added}` fixtures.

Three warnings and one info item were found. All are documentation inconsistencies
introduced by the carve-out deletion; no logic defects, no type-safety regressions, and
no byte-neutrality violations were identified.

## Warnings

### WR-01: Stale docstring in `computeSeverity` still credits `PluginInfoMessage` for `{not added}` routing

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1543-1547`

**Issue:** The block comment immediately above the `isInfoKind(message)` branch reads:

```
// `plugin-info` payloads route to `"error"` ONLY when
// the embedded plugin row is `(failed)` (the `{not added}` --scope mismatch
// row is the canonical example), else info; ...
// (the orchestrator routes `{not added}` through the sibling
// `PluginInfoMessage` variant instead).
```

Since TYPE-01, the `{not added}` condition is carried by `MarketplaceNotAddedMessage`,
not by `PluginInfoMessage`. The "canonical example" of `plugin-info` routing to `error`
is now a plain `(failed)` plugin row (e.g. unreadable manifest), and the claim that the
orchestrator routes `{not added}` "through the sibling `PluginInfoMessage`" is factually
wrong. A future reader of `computeSeverity` will be misled about which message kind
carries the condition and why `plugin-info` ever reaches `error` severity.

**Fix:** Update the block comment to reflect the post-TYPE-01 routing:

```typescript
// `plugin-info` payloads route to `"error"` ONLY when the embedded plugin
// row is `(failed)` (e.g. unreadable manifest); the `{not added}` --scope
// mismatch condition is carried by the dedicated `MarketplaceNotAddedMessage`
// arm, which always routes to `"error"`. `marketplace-info`,
// `marketplace-info-cascade`, and `plugin-info-cascade` carry no failure
// state and route to info (undefined).
```

---

### WR-02: Stale docstring in `MarketplaceInfoMessage` still attributes `{not added}` to `PluginInfoMessage`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:708-709`

**Issue:** The `MarketplaceInfoMessage` interface docstring reads:

```
// The INFO-04 `{not added}` `--scope` mismatch row is emitted via the
// sibling `PluginInfoMessage` per INFO-04's byte form -- see that interface.
```

This is the inverse of the TYPE-01 commit goal: the dedicated `MarketplaceNotAddedMessage`
variant replaced the `PluginInfoMessage`-routed carve-out. The docstring now directs a
reader to `PluginInfoMessage` for the condition that no longer lives there. The `see that
interface` cross-reference is a dead pointer.

**Fix:**

```typescript
// The marketplace-absent (`{not added}`) condition is NOT emitted by this
// variant -- it is the dedicated `MarketplaceNotAddedMessage` variant
// (TYPE-01 / D-46-01). This variant can only carry a found marketplace.
```

---

### WR-03: `blockToMarketplaceMessage` default arm uses runtime `throw` instead of compile-time `assertNever`, so new `MarketplaceStatus` members silently bypass exhaustiveness

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:492-496`

**Issue:** `MarketplaceBlock.status` is typed as `MarketplaceStatus | undefined`. The
switch covers `"added"`, `"updated"`, `"failed"`, and `undefined`. The four unhandled
`MarketplaceStatus` literals (`"removed"`, `"skipped"`, `"autoupdate enabled"`,
`"autoupdate disabled"`) fall to the `default:` arm, which throws a runtime `Error`.

```typescript
default:
  throw new Error(`unexpected import marketplace status: ${block.status}`);
```

Because the arm uses a throw expression rather than `assertNever(block.status)`, the
TypeScript compiler does NOT flag the gap. If a future change adds a new status to
`MARKETPLACE_STATUSES` or adds a new `block.status = "skipped"` assignment in
`buildImportNotificationMarketplaces`, it compiles cleanly and the only signal is a
runtime throw in production. The SUMMARY acknowledges this as deferred B-6/TYPE-F3, and
the comment names the unhandled statuses. The pre-TYPE-04 code had the same gap (the old
spread silently produced an unconstrained object). Phase 46 introduced the switch form
but preserved the runtime-only guard instead of taking the `assertNever` opportunity.

Note: `assertNever(block.status)` is blocked here because `block.status` in the `default`
arm is NOT `never` (it's the four unhandled literals), which is why the throw was used.
The correct compile-time approach is to narrow `MarketplaceBlock.status` to the import
subset:

```typescript
// In MarketplaceBlock, narrow the status field to the import-reachable subset:
status?: Extract<MarketplaceStatus, "added" | "updated" | "failed">;

// Then `blockToMarketplaceMessage` can use assertNever(block.status) in the default arm.
```

This would make `block.status = "skipped"` (or any unanticipated value) a compile error
at the assignment site. Deferring to post-v1.10 is acceptable given the explicit scope
decision; flag for TYPE-F3.

---

## Info

### IN-01: `StandaloneKind` union has no arity lock in the test suite

**File:** `tests/architecture/notify-types.test.ts`

**Issue:** The `NotificationMessage` union has a 6-arm lock (`_l12`). The `StandaloneKind`
type alias (5 members: the four info surfaces plus `marketplace-not-added`) has no
corresponding arity test. A future developer who adds a standalone-dispatched kind to
`isInfoKind` without also adding it to `StandaloneKind` (or vice versa) will see a
`ts-expect-error` consumer failure but no single "arity is still 5" assertion.

**Fix:** Add a bidirectional extends check analogous to `_mmsd` for `MarketplaceStatus`:

```typescript
// StandaloneKind is NOT exported, but the guard's predicate return type is testable.
// Prove the guard body covers exactly the 5 expected kind literals by checking that
// every arm of Extract<NotificationMessage, { kind: string }> is either in StandaloneKind
// or is the cascade (no-kind) arm. An exact approach: re-derive the set from
// NotificationMessage and check bidirectional inclusion against the expected 5.
```

This is a quality improvement for test coverage of the TYPE-03 invariant; it does not
affect runtime behavior.

---

_Reviewed: 2026-06-07T21:07:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Resolution (orchestrator, 2026-06-07)

- **WR-01 / WR-02 -- FIXED** in commit `fd999cf`. Corrected the three stale
  docstrings in `notify.ts` (the `computeSeverity` comment, the
  `MarketplaceInfoMessage` docstring, and a matching one on
  `MarketplaceInfoCascadeMessage` at the old line 827) so they point at the
  dedicated `MarketplaceNotAddedMessage` variant instead of the removed
  `PluginInfoMessage` carve-out. Comment-only; byte-neutral; `npm run check`
  stays GREEN.
- **WR-03 -- DEFERRED (accepted).** The `blockToMarketplaceMessage` runtime-throw
  default arm is the explicitly-deferred B-6 / TYPE-F3 item (CONTEXT.md Deferred
  Ideas; REQUIREMENTS Future). Narrowing `MarketplaceBlock.status` to the import
  subset is out of v1.10 scope and is flagged for TYPE-F3 post-v1.10.
- **IN-01 -- ACCEPTED (no change).** A `StandaloneKind` arity lock would require
  exporting a file-private type purely for a test nicety. The TYPE-03 invariant
  is already enforced three ways: the `assertNever` tails in all four
  `isInfoKind` consumers (adding a kind without handling = compile error), the
  `@ts-expect-error` proofs, and the 6-arm `_l12` lock on `NotificationMessage`.
  Marginal benefit does not justify widening the module surface.

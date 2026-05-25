---
phase: 15-type-model-adr-refresh
reviewed: 2026-05-25T22:48:22Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/notify-types.test.ts
  - docs/adr/v2-001-structured-notify.md
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-25T22:48:22Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 15 is a type-only / docs-only delta: ~315 LoC of structured-notification types appended to `shared/notify.ts`, ~570 LoC of compile-time assertion arch-test at `tests/architecture/notify-types.test.ts`, and an end-to-end refresh of `docs/adr/v2-001-structured-notify.md`. `npm run check` is GREEN (typecheck + lint + 1327 tests pass).

The type model itself is well-structured: discriminated union on `status:` literal, `as const` tuples driving derived literal-union types via `(typeof X)[number]`, `readonly` everywhere, runtime tuples in lockstep with declared types via independently-duplicated literal lists in the arch test, and good adherence to D-11 layering (no upward imports from `shared/`).

No BLOCKER-class defects. The findings cluster around test-assertion strength gaps that weaken the drift-detection guarantees of the arch test (the load-bearing artifact for this phase per SNM-04/D-15-12), plus three documentation-vs-implementation drift items in the ADR refresh.

## Warnings

### WR-01: Weak `_Assert_RollbackOnFailed` assertion fails to lock `rollbackPartial?` presence

**File:** `tests/architecture/notify-types.test.ts:274-279`

**Issue:** The assertion is structured as `_VFailed extends { rollbackPartial?: ... } ? true : never`. In TypeScript, a type without an optional property still `extends` a type that declares that optional property -- optional fields in the supertype are not required on the subtype. Therefore, if a future commit removes `rollbackPartial?` from `PluginFailedMessage` entirely (the exact regression SNM-09 / D-15-12 is supposed to catch), this assertion still resolves to `true` and `npm run typecheck` stays GREEN.

Contrast with the cause-presence assertion at line 243 (`_VFailed["cause"] extends Error | undefined`) which uses indexed access -- removing the `cause` field would produce a TS2339 typecheck error, catching the regression. The same pattern should be used here.

The negative assertions on the other 9 variants (lines 281-298) already use indexed access correctly; only the positive `_VFailed` assertion is weak.

**Fix:**
```ts
type _Assert_RollbackOnFailed = _VFailed["rollbackPartial"] extends
  | readonly { phase: string; cause?: Error }[]
  | undefined
  ? true
  : never;
export const _rb: _Assert_RollbackOnFailed = true;
```

### WR-02: `_Assert_MarketplaceMessageShape` is unidirectional; misses extra-required-field regressions

**File:** `tests/architecture/notify-types.test.ts:197-199`

**Issue:** Every other top-level shape assertion in the file is bidirectional (NotificationMessage at lines 168-172; MarketplaceDetails at lines 207-211; UsageErrorMessage at lines 219-223), proving set-equality of the two interfaces. `_Assert_MarketplaceMessageShape` only checks `MarketplaceNotificationMessage extends _MarketplaceMessageExpected`, not the reverse. A future commit that adds an extra REQUIRED field to `MarketplaceNotificationMessage` (e.g., `readonly newField: string`) -- which SNM-02 + D-15-06 say should not exist -- would still pass this assertion because the production type would still satisfy the (looser) expected shape.

This is the SNM-02 lock for the marketplace-message shape; weakening it silently broadens what the type model permits without the arch test noticing.

**Fix:**
```ts
type _Assert_MarketplaceMessageShape =
  MarketplaceNotificationMessage extends _MarketplaceMessageExpected
    ? _MarketplaceMessageExpected extends MarketplaceNotificationMessage
      ? true
      : never
    : never;
export const _mms: _Assert_MarketplaceMessageShape = true;
```

### WR-03: Missing negative assertion that `_VUpdated` has no `version` field

**File:** `tests/architecture/notify-types.test.ts:514-556`

**Issue:** D-15-04 (and the ADR at line 114) states that `version?: string` exists on every variant EXCEPT `updated`, which carries REQUIRED `from`/`to` instead. The arch test asserts positive presence of `version?` on the 9 non-`updated` variants (lines 521-556) and asserts both required `from`/`to` on `_VUpdated` (lines 463-474), and asserts absence of `from`/`to` on all 9 other variants (lines 476-512). The symmetric assertion is missing: there is no `@ts-expect-error` block confirming `_VUpdated["version"]` is rejected.

If a future commit accidentally adds `readonly version?: string` back to `PluginUpdatedMessage`, the arch test will not catch it -- violating the symmetric "this field is absent on these variants" lock that the rest of the file consistently enforces (e.g. the 9 negative-presence blocks for `cause`, `rollbackPartial`, `dependencies`, `reasons`, `from`, `to`).

**Fix:** Append after line 556:
```ts
// @ts-expect-error -- D-15-04: updated carries from/to instead of version
export type _NoVersionOnUpdated = _VUpdated["version"];
```

## Info

### IN-01: ADR title still advertises "typed wrappers" -- the v1.4 design pivot rejected them

**File:** `docs/adr/v2-001-structured-notify.md:1`

**Issue:** The title reads `# ADR-v2-001: Structured \`notify\` payload with typed wrappers`. The refreshed Decision section (line 20) explicitly states: "Per-outcome wrappers are NOT introduced" and Alternative 2 was flipped to ACCEPTED for the no-wrappers design (line 177, D-15-16). The title contradicts the locked design and is the first thing a reader sees. The Status flip to "Accepted" lands the rest of the document on the pivot, but the title is stale.

**Fix:** Retitle to something like `# ADR-v2-001: Structured \`notify\` payload, single entrypoint` (drop "with typed wrappers").

### IN-02: ADR LoC accounting line uses "~4096" in one place and "~4500" in another

**File:** `docs/adr/v2-001-structured-notify.md:135,171`

**Issue:** Line 135 describes `tests/lint-rules/` as "~4096 lines: 34 MSG-* rules + 34 RuleTester suites + registry + helpers" (matches `wc -l` of the directory exactly: 4096). Line 171's net-delta math uses "≈ 4500 LoC deleted lint plugin + RuleTester suites" as one of the operands. The arithmetic still arrives at ~4300 LoC net removed, but the two figures for the same artifact disagree by ~10%. Picking one number (4096 + the registry parity test's ~200) and reusing it in the net-delta math keeps the document internally consistent.

**Fix:** Replace `≈ 4500 LoC deleted lint plugin + RuleTester suites - ≈ 200 LoC deleted registry parity test` with `≈ 4096 LoC deleted lint plugin + RuleTester suites - ≈ 200 LoC deleted registry parity test`, and recompute (4096 + 200 - 400 ≈ 3896 net removed). Or update line 135 to "~4500 lines" (matches the existing net-delta figure but conflicts with the actual `wc -l`).

### IN-03: `notifyError` `cause === undefined` early-return is asymmetric with `null`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:85-89`

**Issue:** Line 86 short-circuits on `cause === undefined` and otherwise delegates to `causeChainTrailer(cause)`. The walker itself (errors.ts:47) handles `null` by returning `""`, so the behavior is correct for `null` -- but the guard is asymmetric with what the walker treats as the empty case. With `cause?: unknown` and `exactOptionalPropertyTypes: true`, the caller can't explicitly pass `undefined`; `null` and `undefined` are the two distinct "no cause" inputs the walker treats identically. Aligning the guard removes the asymmetry.

This is not a behavioral bug -- both paths produce `body === message` for `null` input -- but the readability cost is non-zero and a future refactor that inlines the trailer logic would hit this asymmetry.

**Fix:**
```ts
const trailer = cause === undefined || cause === null ? "" : causeChainTrailer(cause);
```

Alternatively, drop the guard entirely and rely on `causeChainTrailer(cause) === ""` as the empty-trailer signal (the walker is already the single source of truth for what an empty trailer looks like).

### IN-04: Test file imports `Reason` via inline type query instead of the new re-export

**File:** `tests/architecture/notify-types.test.ts:87`

**Issue:** `notify.ts` line 12 explicitly re-exports `Reason` so "Phase 16-20 call-site authors can import the entire v1.4 structured-notify surface ... from this file alone." The arch test, written in the same phase, imports `Reason` via `import("../../extensions/pi-claude-marketplace/shared/grammar/reasons.ts").Reason` -- bypassing the re-export. The file header (line 47) justifies this as "keeps the import block focused on the 11 SNM-01..SNM-11 surface symbols", which is a defensible choice, but the test is the FIRST consumer of the new surface and choosing not to use the re-export weakens the implicit contract that the re-export exists.

If the intent is to validate that the re-export works, add a one-line `_Assert_*` block that exercises it; if the intent is to keep the import block focused, the file comment already documents it and no change is needed. Flagging for an explicit decision rather than ambiguity.

**Fix (optional):** Either change line 87 to `import type { Reason } from "../../extensions/pi-claude-marketplace/shared/notify.ts"` (rename the local alias collision with the existing import if needed) and drop `_Reason`, or add an assertion like:

```ts
type _Assert_ReasonReExported = import("../../extensions/pi-claude-marketplace/shared/notify.ts").Reason extends _Reason ? true : never;
export const _rrx: _Assert_ReasonReExported = true;
```

---

_Reviewed: 2026-05-25T22:48:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

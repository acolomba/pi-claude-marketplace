---
phase: 13-conformance-refactor-es-5-supersession
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/markers.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/transaction/rollback.ts
  - eslint.config.js
  - tests/architecture/no-legacy-markers.test.ts
  - tests/architecture/markers-snapshot.test.ts
  - tests/transaction/rollback.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/shared/errors.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/bridges/agents/stage.test.ts
  - docs/prd/pi-claude-marketplace-prd.md
scope_commits:
  - 7ebc082 feat(13-02a-02): introduce ManualRecoveryError; migrate bridge stages
  - b34b0fa feat(13-02a-02): migrate reinstall.ts to structural ManualRecoveryError
  - 64d823f feat(13-02a-02): migrate transaction/rollback.ts to closed-set tokens
  - da8a566 feat(13-02a-02): retire ESLint allow-list for migrated marker callsites
  - c4d87d4 chore(13): ES-5 supersession atomic three-file edit
findings:
  critical: 0
  blocker: 0
  warning: 2
  info: 5
  total: 7
status: fixes_applied
fixes_applied_at: 2026-05-24T00:00:00Z
fixes_applied_summary: "WR-01 (walk .cause chain + 6 regression tests), WR-02 (move __test_* re-exports below declarations at 3 sites), IN-01 (refresh phase-ledger header for CMC-11 token form), IN-04 (install gitlint at commit-msg stage), IN-05 (delete vestigial prd-extract helper). IN-02 skipped: architectural decision documented in SUMMARY Deviation #1; WR-01's __test_findManualRecoveryError seam now covers the structural-pivot regression risk. IN-03 skipped: doc-only precision issue on historical PLAN.md/commit body; no runtime impact."
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard (per-file with cross-file ManualRecoveryError flow trace)
**Files Reviewed:** 11 production/test/config + 1 PRD entry
**Status:** issues_found (advisory only -- 0 blockers, 2 warnings, 5 info)

## Summary

The 5 in-scope commits cleanly land Plan 13-02a-02 (structural
`ManualRecoveryError` + closed-set CMC-11 token rendering at the transaction
chokepoint + ESLint allow-list retirement) and Plan 13-03-02 (atomic ES-5
supersession deletion). Production behavior at the catalog UAT level is
byte-preserved (1138/1138 tests pass; catalog UAT green); the structural
pivot is defensible and matches the PluginUpdatePhase3Error precedent.

Two **WARNINGS** are correctness-adjacent and worth fixing in a follow-up:

1. **WR-01 (correctness, narrow edge case):** `withScopeLock`'s
   release-error wrapping path constructs a plain `Error(... { cause:
   primary })` around a thrown `ManualRecoveryError`. The orchestrator's
   `err instanceof ManualRecoveryError` check at `reinstall.ts:201,276` then
   fails, silently downgrading the cascade row's Reason from
   `{rollback partial}` to `{not in manifest}`. The user still sees the
   underlying message text via the depth-5 cause-chain trailer, but the
   structural CMC-11 Reason tag is lost. This is a real but narrow
   regression introduced by the structural pivot (the pre-migration
   substring branch would have caught it via `.includes("rollback")`).
2. **WR-02 (JSDoc binding):** The primary JSDoc for both
   `outcomeToCascadeRow` and `errorWithManualRecovery` is orphaned by an
   intervening `export { ... as __test_*}` re-export. Hover-doc and most
   JSDoc tooling no longer associate the primary doc with the function
   declaration.

Five **INFO** items document scope deferrals, plan/summary documentation
drift, and small hygiene issues none of which affect runtime behavior.

The 8 acceptance gates the plan documented (A-F per Plan 13-02a-02 + the
4-file atomic for Plan 13-03-02) are independently re-verified in this
review: zero `MANUAL_RECOVERY_REQUIRED` / `ROLLBACK_PARTIAL` references
outside the canonical allow-list + `transaction/phase-ledger.ts`; ESLint
BLOCK E rolled back cleanly; `c4d87d4` lists exactly 4 source files;
commit messages all conform to Conventional Commits (titles ≤72 chars
modulo the 79-char title on `da8a566` -- see IN-04; bodies ≤80 chars).

## Warnings

### WR-01: ManualRecoveryError loses its class identity if state-lock release also fails

**Severity:** WARNING (narrow edge case, but loses the structural Reason
tag the migration introduced; pre-migration substring branch was robust
against this path)
**Files:**
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:138-143`
  (the wrapping site, unchanged by this plan but newly load-bearing for
  the structural-tag check)
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:201,276`
  (the `instanceof ManualRecoveryError` check that now drives Reason
  mapping; the same pattern in `outcomeToCascadeRow`'s
  `failureClass === "manual-recovery"` consumes the tag)

**Issue:** `withScopeLock` (used by `withLockedStateTransaction`, which
`reinstallPlugin` calls) wraps a thrown body error with a plain `new
Error(combinedMsg, { cause: base })` when BOTH the body throw AND
`release()` also throws. If the body throw was a `ManualRecoveryError`,
the wrapping promotes it to a plain Error whose `.cause` is the
ManualRecoveryError. The catch in `reinstallPlugin`/`reinstallPlugins`
then sees a plain Error and `err instanceof ManualRecoveryError` is
false, so the `...(err instanceof ManualRecoveryError && { failureClass:
"manual-recovery" as const })` spread is empty and the cascade row's
Reason narrows to `"not in manifest"` (the catch-all fallback in
`narrowReason`).

User impact: under a release-failure during a leaked reinstall rollback,
the user-visible Reason silently downgrades from `{rollback partial}` to
`{not in manifest}`. The underlying error message and cause text still
surface via the ES-4 depth-5 trailer at the notify boundary, so this is
not a data-loss bug, just a Reason-tag downgrade. The pre-migration
substring branch would have caught it (`note.includes("rollback")` ->
`"rollback partial"`).

**Fix (recommended):** Either (a) change the `instanceof` check at
`reinstall.ts:201,276` to walk `.cause` looking for a
`ManualRecoveryError` (consistent with the depth-5 cause-chain pattern
elsewhere in the codebase), OR (b) change `withScopeLock` to preserve
class identity by re-constructing the same Error subclass with the
release-failure note appended to `.message`. Option (a) is structurally
simpler and stays inside Plan 13-02a-02's scope semantics:

```typescript
function findManualRecoveryError(err: unknown): ManualRecoveryError | undefined {
  let cur: unknown = err;
  for (let depth = 0; depth < 5; depth++) {
    if (cur instanceof ManualRecoveryError) {
      return cur;
    }
    if (!(cur instanceof Error) || cur.cause === undefined || cur.cause === cur) {
      return undefined;
    }
    cur = cur.cause;
  }
  return undefined;
}
// Then at line 201 / 276:
...(findManualRecoveryError(err) !== undefined && {
  failureClass: "manual-recovery" as const,
}),
```

A regression test for the wrapped-by-release-failure path (driving a
ManualRecoveryError through `withScopeLock` with a stubbed release()
that throws) would bind the fix.

---

### WR-02: Orphaned JSDoc blocks above `__test_*` re-exports

**Severity:** WARNING (documentation/IDE hover binding; not a behavior
defect)
**Files:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:481-503`
  (primary JSDoc for `outcomeToCascadeRow` orphaned by the intervening
  `__test_outcomeToCascadeRow` export's JSDoc)
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:985-1012`
  (primary JSDoc for `errorWithManualRecovery` orphaned by the
  intervening `__test_errorWithManualRecovery` export's JSDoc)

**Issue:** The plan added test-seam re-exports immediately above the
function declarations, sandwiched between the primary JSDoc and the
function body:

```typescript
/** ... primary JSDoc describing outcomeToCascadeRow ... */
/** ... seam JSDoc explaining the __test_ alias ... */
export { outcomeToCascadeRow as __test_outcomeToCascadeRow };

function outcomeToCascadeRow(outcome: ReinstallPluginOutcome) { ... }
```

Most JSDoc tooling (TypeScript Language Server hover-doc, VS Code,
typedoc) attaches a JSDoc comment to the next *declaration* and treats
intervening comments as separators. The primary JSDoc here is two
comments away from `function outcomeToCascadeRow`, so the hover-doc on
the function shows nothing (or shows only the second, seam-related
JSDoc). The primary doc text describes the Reason-token mapping and is
the most useful contract; losing the binding makes the function
effectively undocumented in IDE tooling.

**Fix:** Either (a) merge the two JSDoc blocks into one (combine the
contract description with a short "test seam exposed via `__test_*`"
note); OR (b) move the `__test_*` re-export AFTER the function
declaration so the primary JSDoc stays adjacent to the function. Option
(b) is mechanically simpler:

```typescript
/** ... primary JSDoc describing outcomeToCascadeRow ... */
function outcomeToCascadeRow(outcome: ReinstallPluginOutcome) { ... }

/** Plan 13-02a-02 / CMC-16 / F-2 binding seam: ... */
export { outcomeToCascadeRow as __test_outcomeToCascadeRow };
```

## Info

### IN-01: Phase-ledger header docstring is now factually incorrect

**Severity:** INFO (acknowledged scope-deferred; in
`no-legacy-markers.test.ts` ALLOW_LIST)
**File:** `extensions/pi-claude-marketplace/transaction/phase-ledger.ts:12-19`

The header still contains the legacy `(rollback partial: ...)` literal
and describes it as the AS-4 assembly format that `transaction/
rollback.ts` produces. After commit `64d823f`, `rollback.ts` no longer
produces this form -- it produces `(failed) {rollback partial}` +
indented `[<phase>] (rollback failed) {rollback partial}` children. The
header is now misleading documentation.

This is explicitly in the `no-legacy-markers.test.ts` ALLOW_LIST with a
"stays until a later refactor updates the phase-ledger header" rationale
(`tests/architecture/no-legacy-markers.test.ts:27-32`). Confirmed by the
review: the deferral is intentional. Recommend folding it into the next
phase-13 cleanup wave or Phase 14 drift-guard so the header text matches
the produced output.

---

### IN-02: F-2 binding regression guard is unit-level only; no integration test exercises a real bridge `ManualRecoveryError`

**Severity:** INFO (acknowledged in plan summary "Deviation #1")
**File:** `tests/orchestrators/plugin/reinstall.test.ts:1098-1149` +
`tests/edge/handlers/plugin/reinstall.test.ts:217-263`

The plan's F-2 binding was originally to strengthen the line-225
assertion in `tests/edge/handlers/plugin/reinstall.test.ts` to require
`{rollback partial}`. Per the SUMMARY's Deviation #1, this was reverted
because the seeded foreign-content scenario rejects BEFORE any bridge
backup commit, so `replaceAll` catches with empty leaks ->
`errorWithManualRecovery(err, [])` short-circuits -> no
ManualRecoveryError. The binding moved to the unit-level
`__test_outcomeToCascadeRow` seam.

The unit seam binds the structural mapping but does NOT exercise the
end-to-end flow: bridge throws ManualRecoveryError -> orchestrator
catches -> `err instanceof ManualRecoveryError` -> spread sets
`failureClass` -> outcomeToCascadeRow maps to `["rollback partial"]` ->
cascade renderer emits `(failed) {rollback partial}`. A future refactor
that breaks the `instanceof` check (see WR-01) OR the spread placement
(typo dropping the as-const, etc.) would not be caught by this gate.

The acknowledged trade-off is reasonable (the integration fixture is
fragile -- requires POSIX chmod manipulation to force a leak). A
follow-up that seeds a real `ManualRecoveryError` via dependency
injection (e.g., `__deps: { replacePreparedAgents: () =>
Promise.reject(new ManualRecoveryError(...)) }`) would close the gap
without touching the filesystem permissions.

---

### IN-03: SUMMARY/commit body describe `extractEs5MarkerLiterals` post-edit return value imprecisely

**Severity:** INFO (documentation drift; no code impact)
**Files:**
- `.planning/phases/13-conformance-refactor-es-5-supersession/13-03-02-PLAN.md:88`
  ("after PRD §6.12 is rewritten to the pointer ...
  `extractEs5MarkerLiterals(prdContent)` returns 0 literals")
- `c4d87d4` commit body: "the PRD-extract helper returns the pointer
  span post-edit"

The new PRD §6.12 ES-5 row IS the brief pointer per D-13-11. That row
contains one backtick-quoted literal (`docs/messaging-style-guide.md`).
`extractEs5MarkerLiterals` pulls every backtick-quoted substring from
the row, so it returns `["docs/messaging-style-guide.md"]` (length 1),
not 0. The plan-text rationale ("returns 0 literals; the
`literals.length === 5` assertion fails without deletion") is
directionally correct but quantitatively wrong: the assertion fails
because length is 1, not 5; the helper does not return 0.

The downstream effect is identical (the snapshot assertion must be
deleted), so this is purely a documentation precision issue.

---

### IN-04: Commit title for `da8a566` is 79 chars (within the 72-char project guideline by 7 chars)

**Severity:** INFO (cosmetic; `CLAUDE.md` says "no more than 72 chars")
**Commit:** `da8a566 feat(13-02a-02): retire ESLint allow-list for migrated marker callsites` (79 chars)

Project's `CLAUDE.md` says: "Titles must be at least 5 characters and
no more than 72 characters." This title is 79 chars (7 over). The other
4 in-scope commits are all within the 72-char limit (59, 77, 77, 77).
The pre-commit hook (gitlint or equivalent) did not catch this -- worth
verifying the hook configuration enforces the 72-char limit. Body lines
all ≤80 chars in the 5 in-scope commits (within the 80-char body
guideline).

This is a one-off cosmetic violation; not worth a rewrite. Recommend
verifying the pre-commit gitlint config catches future violations.

---

### IN-05: `tests/helpers/prd-extract.ts` is now vestigial

**Severity:** INFO (acknowledged "vestigial but harmless" by the plan;
clean-up candidate)
**File:** `tests/helpers/prd-extract.ts` (entire file)

The `extractEs5MarkerLiterals` helper is used in exactly one
remaining test -- a negative-assertion that it throws when PRD §6.12
ES-5 row is missing (`tests/architecture/markers-snapshot.test.ts:31-36`).
This is a tautological self-check of a function that has no production
consumers and one test consumer that verifies its error path. The
helper can be deleted along with that single test without losing any
real coverage; the static-audit gate at
`tests/architecture/no-legacy-markers.test.ts` is the actual defense.

Plan 13-02a-02 documented the deletion as out of scope; recommend
folding into Phase 14 drift-guard cleanup.

---

## Verification Summary

Performed the following independent gate verifications during this
review:

| Gate | Command | Result |
|------|---------|--------|
| A (marker absence) | `grep -rEn "MANUAL_RECOVERY_REQUIRED\|MANUAL RECOVERY REQUIRED:" extensions/ tests/ \| grep -v 'no-legacy-markers\|markers-snapshot'` | 0 matches (PASS) |
| B (rollback-partial absence) | `grep -rEn 'ROLLBACK_PARTIAL\|"\\(rollback partial: "' extensions/ tests/` | Only `no-legacy-markers.test.ts:61` fixture (PASS) |
| C-rollback (tests) | `node --test tests/transaction/rollback.test.ts ...` | 28/28 pass (PASS) |
| D (ESLint allow-list cleanup) | Visual: BLOCK E has only Pi peer-import entry + `platform/pi-api.ts` ignore | PASS |
| Atomic-commit invariant (D-13-03) | `git show c4d87d4 --stat` | Exactly 4 files (PASS) |
| ManualRecoveryError contract | `instanceof ManualRecoveryError && instanceof Error`; readonly `.leaks`; `ErrorOptions` cause | PASS (mirrors `PluginUpdatePhase3Error` precedent at `shared/errors.ts:258-265`) |
| Discriminated-union NFR-7 | `ReinstallFailedOutcome.failureClass?: "manual-recovery"` | PASS (typed string literal; no widening) |
| IL-2 notify-channel | `grep -n 'process\.stdout\|process\.stderr' ` against modified bridge/orchestrator/transaction files | 0 matches (PASS) |
| NFR-10 path containment | `assertPathInside` calls preserved in all 3 bridge stages | PASS (unchanged by this plan) |
| Commit-hygiene (Conventional Commits, body ≤80) | All 5 in-scope commits | PASS modulo IN-04 title-length |

## Out-of-Scope (Not Reviewed)

Per the workflow's explicit instruction, the 8 pre-existing plan
implementations from prior sessions (13-01-01 through 13-02d-01,
13-03-01) were NOT reviewed. Their commits were folded into the diff
range only to allow `git diff 4a7866c..HEAD` to surface the source
changes; the review focused on commits `7ebc082`, `b34b0fa`, `64d823f`,
`da8a566`, `c4d87d4`.

`.planning/` and `*-SUMMARY.md` / `*-PLAN.md` doc-only changes were not
reviewed (review of those is workflow-level; the SUMMARY content was
consulted for plan-text vs. as-built parity, surfacing IN-03).

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

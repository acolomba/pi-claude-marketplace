---
phase: 29-notification-label-suppression-update-classification
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - docs/adr/v2-001-structured-notify.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/shared/snm38-indent-ladder.test.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-05-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 29 delivers the Phase-29 / UXG-07 summary-line composition (D-29-02/03/04) layered on top
of the existing structured-notify architecture. The core logic in `shared/notify.ts` is
well-structured: `buildSummaryLine`, `countFailedOperations`, `countSkippedOperations`, and the
updated `notify()` composition path are consistent with the spec. The catalog UAT, orchestrator
tests, and per-status unit tests are comprehensive.

Two meaningful defects were found. One is a user-contract coverage gap: the `catalog-uat.test.ts`
parser silently drops the `usage-error` catalog state because `## Usage errors` does not match the
section regex, meaning the `notifyUsageError` byte form is never byte-checked by the UAT gate.
The other is a behavioral inconsistency: the two direct-path failure helpers in `update.ts` apply
different default scopes (`"project"` vs `"user"`), which produces inconsistent user-visible
output for the same class of bare-form failure.

The remaining findings are stale comments in test files that actively contradict the current
behavior, and minor documentation table gaps.

## Critical Issues

### CR-01: `catalog-uat.test.ts` silently skips the `usage-error` catalog state -- `notifyUsageError` byte form is never byte-checked

**File:** `tests/architecture/catalog-uat.test.ts:82-83`
**Issue:** The catalog parser's `sectionRe` matches only `` ## `/claude:plugin ...` `` and
`## Manual recovery anchors`. The heading `## Usage errors` (line 1001 of `output-catalog.md`)
does not match, so `currentSection` is reset to `null` and the immediately following
`<!-- catalog-state: usage-error -->` annotation (line 1005) is consumed under a null section
and silently discarded. The condition `pendingState !== null && currentSection !== null` on the
fence-close path guarantees the example is never added to `examples[]`. As a result, the
`notifyUsageError` on-the-wire string `${message}\n\n${usage}` at `"error"` severity is not
covered by the byte-equality UAT gate at all -- only by the standalone unit test in
`tests/shared/notify-v2.test.ts`. Any future renderer drift on the usage-error surface would
not be caught by the UAT.

**Fix:** Either extend the section regex to also match `## Usage errors`, or move the usage-error
catalog block under one of the matched sections. The cleanest fix is to extend `sectionRe`:

```ts
// tests/architecture/catalog-uat.test.ts:82
const sectionRe =
  /^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors|Usage errors)\s*$/;
```

This requires adding a corresponding `"Usage errors"` entry in `FIXTURES` (or mapping it to
the existing `"usage-error"` state string) and adding a fixture that calls `notifyUsageError`
and captures the result.

---

## Warnings

### WR-01: `update.ts` uses inconsistent default scopes for bare-form vs marketplace/plugin failure paths

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:226,1456`
**Issue:** Two failure helpers that handle the same class of "no marketplace identity available"
error apply different default scopes when `explicitScope` is `undefined`:

- `notifyDirectFailure` (line 226): `scope: explicitScope ?? "project"`
- `notifyBareFormEnumerateFailure` (line 1456): `scope: scope ?? "user"`

When a user runs `/claude:plugin update` without `--scope` and the enumerate step fails,
the bare form emits a synthetic `(update)` row under a `[user]` header. When the same
enumerate step fails on a targeted `@mp` form, it emits under a `[project]` header. A user
running `update ghost-mp` gets `⊘ (ghost-mp) (failed)... [project]` while the same error on
a bare `update` would render `⊘ (update) (failed)... [user]`. The two defaults are documented
by their inline comments, but they are not intentional per any spec decision captured in the
planning artifacts.

**Fix:** Align both to the same default. The `"project"` default in `notifyDirectFailure` is the
better choice because the bare-form `enumerateTargets` failure for the bare `update` form loads
both scopes, so no single scope is "more right" -- but `"project"` is the iteration-order-first
scope and is the same default used everywhere else in the direct-path branch. Change line 1456:

```ts
// notifyBareFormEnumerateFailure:
scope: scope ?? "project",
```

### WR-02: `tests/shared/notify-v2.test.ts` header comment documents the superseded pre-Phase-28 severity ladder

**File:** `tests/shared/notify-v2.test.ts:104-108`
**Issue:** The doc comment in the test file mini-spec section "SEVERITY LADDER (D-16-11, first
match wins)" at lines 104-108 describes the **old** two-arm ladder:

```
1. Any plugin.status === "failed" OR mp.status === "failed" -> "error"
2. Any plugin.status in {"skipped", "manual recovery"}      -> "warning"
3. Otherwise                                                -> undefined (info)
```

The actual implementation uses the five-arm Phase-28 / UXG-02 ladder where benign skips
(`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`) route to
`info`, not `warning`. The stale comment will mislead a contributor writing new cascade payloads
into expecting `warning` severity for an all-`{up-to-date}` cascade, which would be a product
bug. The tests themselves are correct; only the comment is wrong.

**Fix:** Replace the stale ladder comment with the current five-arm description. Concise version:

```
1. Any plugin.status === "failed" OR mp.status === "failed" -> "error"
2. Any plugin.status === "manual recovery"                  -> "warning"
3. Any plugin.status === "skipped" with non-benign reasons  -> "warning"
4. Any mp.status === "skipped" with non-benign/empty reasons-> "warning"
5. Otherwise (incl. all-benign skip cascade)                -> undefined (info)
(Phase 28 / UXG-02 / D-28-06)
```

### WR-03: `tests/shared/notify-v2.test.ts` header comment documents a non-existent marketplace-status reload-hint arm

**File:** `tests/shared/notify-v2.test.ts:93-98`
**Issue:** The doc comment "RELOAD-HINT TRIGGER LADDER (D-16-12 -- refines SNM-15)" states:

```
- Any plugin.status in {"installed", "updated", "reinstalled", "uninstalled"}, OR
- Any mp.status in {"added", "removed", "updated"} (state-changing; NOT "failed").
```

The second bullet does not exist in the current `shouldEmitReloadHint` implementation
(`notify.ts:1297`), which only checks plugin statuses. The marketplace-status arm was removed
per D-22-01 / SNM-33. The actual tests (16c-16g, lines 906-1004) correctly verify that
`added`/`removed`/`updated` marketplace statuses with `plugins: []` do NOT trigger the trailer.
The stale comment contradicts those correct tests and would mislead a contributor adding a new
marketplace-only operation into incorrectly expecting a reload-hint trigger.

**Fix:** Remove the second bullet from the header comment. The corrected ladder is:

```
- Any plugin.status in {"installed", "updated", "reinstalled", "uninstalled"}.
- Otherwise: suppressed. (D-22-01 / SNM-33 deleted the marketplace-status arm.)
```

---

## Info

### IN-01: `docs/output-catalog.md` "Marketplace status tokens" table claims 4 entries but 7 exist

**File:** `docs/output-catalog.md:141`
**Issue:** The table heading reads "Marketplace status tokens (4 entries):" and lists only
`added`, `removed`, `updated`, `failed`. Three entries added in Phase 17.1 are absent:
`autoupdate enabled`, `autoupdate disabled`, and `skipped`. The `MARKETPLACE_STATUSES` tuple
in `shared/notify.ts` and `docs/messaging-style-guide.md` both correctly state 7 entries.

**Fix:** Update the count and add the three missing rows with their byte forms and where-used
descriptions:

```markdown
Marketplace status tokens (7 entries):

| Token                  | Icon | Where it appears                                                 |
| ---------------------- | ---- | ---------------------------------------------------------------- |
| `(added)`              | ●    | Marketplace header -- `marketplace add`, `bootstrap`, import.   |
| `(removed)`            | ●    | Marketplace header -- `marketplace remove` clean.                |
| `(updated)`            | ●    | Marketplace header -- `marketplace update`.                      |
| `(failed)`             | ⊘    | Marketplace header -- add/remove/update/autoupdate failures.     |
| `<autoupdate>`         | ●    | Marketplace header -- fresh `marketplace autoupdate` enable.     |
| `<no autoupdate>`      | ●    | Marketplace header -- fresh `marketplace autoupdate` disable.    |
| `(skipped) {<reason>}` | ●    | Marketplace header -- update no-op, idempotent autoupdate flip.  |
```

### IN-02: `docs/output-catalog.md` "Marketplace header shape" table is missing 3 rows for the autoupdate surface

**File:** `docs/output-catalog.md:19-27`
**Issue:** The "Marketplace header shape" table (lines 19-27) documents only 6 forms (4
status-change arms + 2 list-surface sub-branches). Three autoupdate-surface forms added in
Phase 17.1 / UXG-04 are absent:
- `mp.status === "autoupdate enabled"` → `● M [S] <autoupdate>`
- `mp.status === "autoupdate disabled"` → `● M [S] <no autoupdate>`
- `mp.status === "skipped"` with `reasons: ["already autoupdate"]` → `● M [S] <autoupdate> {already autoupdate}`
- `mp.status === "skipped"` with `reasons: ["already no autoupdate"]` → `● M [S] <no autoupdate> {already no autoupdate}`
- `mp.status === "skipped"` (generic) → `● M [S] (skipped) {<reason>}`

**Fix:** Add rows to the table for the three autoupdate-surface `mp.status` values, or add a
forward-reference note pointing to the `## /claude:plugin marketplace autoupdate|noautoupdate`
section for the byte forms.

### IN-03: `tests/shared/snm38-indent-ladder.test.ts` includes unreachable "◐" glyph in header and plugin-row filter predicates

**File:** `tests/shared/snm38-indent-ladder.test.ts:152,171`
**Issue:** The `captureIndents` function's two filter predicates include the `◐` (half-filled
circle) glyph as a potential marketplace-header and plugin-row indicator. This glyph does not
exist anywhere in the renderer (`shared/notify.ts` only defines `●`, `○`, `⊘`). The filters
are correct and will never produce false positives, but the dead pattern can mislead future
maintainers into thinking there is or was a fourth icon state.

```ts
// Line 152: "◐ " will never match
.filter(({ l }) => l.startsWith("● ") || l.startsWith("◐ ") || l.startsWith("⊘ "))
// Line 171: "◐" will never match
.filter(({ l }) => /^ {2}[●◐○⊘] /.test(l))
```

**Fix:** Remove `◐` from both filter conditions:

```ts
// Line 152
.filter(({ l }) => l.startsWith("● ") || l.startsWith("⊘ "))
// Line 171
.filter(({ l }) => /^ {2}[●○⊘] /.test(l))
```

---

_Reviewed: 2026-05-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

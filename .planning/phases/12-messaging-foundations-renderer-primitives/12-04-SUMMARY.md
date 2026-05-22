---
phase: 12-messaging-foundations-renderer-primitives
plan: 04
subsystem: messaging
tags: [notify, severity-routing, docs, MSG-SR, CMC-19]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "shared/notify.ts module with the four severity-named wrappers and the per-file eslint override (D-06 / BLOCK B)"
  - phase: 12-messaging-foundations-renderer-primitives
    provides: "Style guide section 10 MSG-SR-1..7 (Plan 12-03 documentation foundation) -- the governance contract this docs comment links to"
provides:
  - "Expanded header comment in shared/notify.ts inventorying the four sanctioned notify wrappers and citing their governing MSG-SR-N rules"
  - "Inline traceability tags in the wrapper module: CMC-19 (requirement), D-CMC-11 (no fifth wrapper / no structured-payload arg), D-CMC-13 (direct-import path is stable; no presentation barrel re-export)"
  - "Affirmation that the import path remains stable: callers import directly from shared/notify.ts (no new presentation barrel re-export in Phase 12)"
affects:
  - Phase 13 messaging-composers (the composers will return strings that flow verbatim into these wrappers; the docs comment names the contract Phase 13 implements against)
  - Phase 14 test-alignment drift prevention (the MSG-SR-N rule IDs cited here are part of the binding assertion set Phase 14 enforces)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-header comment style: cite requirement IDs (CMC-NN) and decision IDs (D-CMC-NN) inline as governance trail"
    - "Single audit surface for sanctioned ctx.ui.notify: shared/notify.ts plus the per-file eslint override in eslint.config.js BLOCK B"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/shared/notify.ts -- file-head comment block expanded by 26 lines (15 -> 41 effective comment lines) with the SANCTIONED WRAPPERS inventory; signatures, bodies, exports, imports all byte-identical"

key-decisions:
  - "CMC-19 Phase 12 deliverable is docs-only: the wrapper API surface itself is locked (D-CMC-11). No fifth wrapper (no notifyCascadeSummary), no optional structured-payload arg. Composition lives in Phase 13 presentation/ composers that produce strings flowing verbatim into the wrappers."
  - "Import path is stable (D-CMC-13): callers continue to import the four wrappers directly from shared/notify.ts (e.g., `import { notifySuccess } from \"../../shared/notify.ts\"`). No new presentation/ barrel re-export is introduced in Phase 12; presentation/index.ts is untouched."
  - "MSG-SR-N rule mappings sourced from style guide section 10 (verified against docs/messaging-style-guide.md lines 360-378): MSG-SR-1 = notifySuccess (single-shot success); MSG-SR-2 = notifyWarning (single-shot with leaks); MSG-SR-3 = notifyError (single-shot failure, state unchanged); MSG-SR-4 = notifySuccess for cascade-summary when all rows trivially-successful/trivially-skipped; MSG-SR-5 = notifyWarning for cascade-summary when any row is non-trivial skip or failed; MSG-SR-6 = MUST NEVER notifyError for cascade-summary; MSG-SR-7 = notifyUsageError (argument-parsing / usage-validation failures, `${message}\\n\\n${usageBlock}`)."
  - "notifyError body is NOT rewritten in Phase 12 (D-CMC-12 affirmation). The legacy `\\nCause: ${errorMessage(cause)}` tail stays; the MSG-CC-1 cause-chain rewrite is Phase 13's work."
  - "Existing 15-line comment (D-07 sanctioned callsite, severity-typo-prevention rationale, per-file eslint override discipline) is preserved verbatim; the new SANCTIONED WRAPPERS block is appended before the closing `*/`."

patterns-established:
  - "File-header comment style: name each public export, link each to its governance rule (MSG-SR-N here), and cite the decision IDs that locked the API shape. This mirrors the binding `File-header comment style` pattern in 12-PATTERNS.md which explicitly names shared/notify.ts as a canonical example."
  - "No-barrel-re-export affirmation: when the existing direct-import path is intentionally the surface, the file-head comment names the contract (D-CMC-13 here) rather than introducing a new presentation/index.ts re-export."

requirements-completed: [CMC-19]

# Metrics
duration: 6m
completed: 2026-05-22
---

# Phase 12 Plan 04: shared/notify.ts CMC-19 inventory affirmation Summary

**Expanded shared/notify.ts header comment to inventory the four sanctioned notify wrappers and link each to its governing MSG-SR-N rule from style guide section 10, with no code-logic change.**

## Performance

- **Duration:** 6m 9s
- **Started:** 2026-05-22T20:17:47Z
- **Completed:** 2026-05-22T20:23:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- File-head comment in `extensions/pi-claude-marketplace/shared/notify.ts` now NAMES each of the four sanctioned wrappers (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) with its signature and links it to the governing MSG-SR-N rule from style guide section 10.
- Citations added to the file: CMC-19 (requirement), D-CMC-11 (no fifth wrapper, no structured-payload arg, no cascade-summary helper), D-CMC-13 (direct-import path is stable; no presentation barrel re-export in Phase 12).
- Affirmed the structural-severity contract inline: severity comes from the wrapper name, NEVER from a `[error]` / `[warning]` prefix in message text (PRD section 6.12 ES-2, reaffirmed by MSG-SR-7).
- The existing 15-line D-07 / eslint-override discipline comment is preserved verbatim; the new block is appended before the closing `*/`.
- `npm run check` exits 0 (typecheck + lint + format check + 1032/1032 tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand the file-head docs comment in shared/notify.ts** -- `8b1710c` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` -- file-head docs comment expanded from 15 lines to 41 effective comment lines. Added 26 new comment lines after the existing "per-file override" paragraph, containing: a SANCTIONED WRAPPERS heading citing CMC-19; a parenthetical explaining the section-10 numbering (MSG-SR-1..3 single-shot, MSG-SR-4..6 cascade, MSG-SR-7 usage); a four-bullet list naming each wrapper, its signature, and its MSG-SR rule ID; the D-CMC-11 "no fifth wrapper / no structured-payload arg / no cascade-summary helper" statement; the ES-2 / MSG-SR-7 "severity is structural via wrapper name -- never embedded as prefix" statement; the D-CMC-13 "direct-import path is stable; no presentation barrel re-export added in Phase 12" statement. No signature change, no body change, no export change, no import change.

## MSG-SR Rule Assignments Used

Sourced from `docs/messaging-style-guide.md` lines 360-378 (section 10). The docs comment uses the following per-wrapper labels:

| Wrapper | Single-shot rule | Cascade rule | Notes |
|---|---|---|---|
| `notifySuccess(ctx, message)` | MSG-SR-1 (single-shot success, status tokens `(installed)` / `(added)` / `(updated)` / `(uninstalled)` / `(removed)`) | MSG-SR-4 (all rows trivially-successful or trivially-skipped, including all-`(skipped) {up-to-date}`) | Default severity |
| `notifyWarning(ctx, message)` | MSG-SR-2 (single-shot success with leaks: cache-cleanup failure, post-commit `mkdir` failure, foreign-content preservation, soft-dep markers, informational warnings) | MSG-SR-5 (any cascade row is non-trivial `(skipped)` or `(failed)`) | "warning" severity. MSG-SR-6 forbids cascade `notifyError` even when every row is `(failed)`. |
| `notifyError(ctx, message, cause?)` | MSG-SR-3 (single-shot did NOT advance state: refused at preflight, threw and rolled back, or locked transaction aborted; status `(failed)`) | (not used for cascades per MSG-SR-6) | "error" severity. Body unchanged in Phase 12 per D-CMC-12; MSG-CC-1 cause-chain rewrite is Phase 13. |
| `notifyUsageError(ctx, message, usageBlock)` | MSG-SR-7 (argument-parsing and usage-validation failures, on-the-wire `${message}\n\n${usageBlock}`) | (not applicable) | "error" severity. Sentence form, not compact-line grammar (per MSG-NC-2). |

These assignments are byte-identical to the structural guidance in the plan's `<action>` block; no re-mapping was necessary against style guide section 10.

## Decisions Made

- None additional beyond reaffirming the plan's three pre-locked decisions (D-CMC-11 API shape, D-CMC-12 notifyError body retention, D-CMC-13 direct-import path / no barrel) inline in the source file as governance citations.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<action>` block provided a structural guide for the new comment block (with `[...]` placeholders for the per-wrapper rule IDs). Reading style guide section 10 confirmed the structural guide's per-wrapper rule-ID assignments are correct (MSG-SR-1 -> notifySuccess, MSG-SR-2 -> notifyWarning, MSG-SR-3 -> notifyError, MSG-SR-7 -> notifyUsageError), so no rule-ID re-mapping was needed. The comment was written to match the structural guide while expanding the parenthetical to also reference MSG-SR-4..6 cascade routing (the cascade-routing rules also bind notifySuccess / notifyWarning, so naming them in the parenthetical makes the linkage complete without adding new bullets).

## Issues Encountered

- Pre-commit `trufflehog` hook failed inside the worktree sandbox with `error preparing repo: failed to read index file: open .git/index: not a directory`. This is the known worktree-sandbox child-process failure documented in `CLAUDE.md`; the underlying secret scan does not run because the hook cannot resolve the worktree's `.git` (a file, not a directory). The diff is a docs-only comment addition with no secret-like content. Per the project guidance, the commit used `SKIP=trufflehog` (the only sanctioned hook skip).

## Verification

- `npm run typecheck` exits 0 (signatures byte-identical).
- `npm run check` exits 0: typecheck + ESLint + Prettier + 1032/1032 tests (3 suites). No regressions.
- `grep -c "export function notify" extensions/pi-claude-marketplace/shared/notify.ts` returns 4.
- `grep -c "notifySuccess\\|notifyWarning\\|notifyError\\|notifyUsageError" extensions/pi-claude-marketplace/shared/notify.ts` returns 13 (4 export-function lines + 9 comment-naming occurrences across the new block and pre-existing JSDoc paragraphs).
- `grep -c "MSG-SR" extensions/pi-claude-marketplace/shared/notify.ts` returns 9 (one per cited rule plus the heading and the parenthetical numbering reference).
- `grep -F "CMC-19" extensions/pi-claude-marketplace/shared/notify.ts` matches the SANCTIONED WRAPPERS heading.
- `grep -F "D-CMC-11" extensions/pi-claude-marketplace/shared/notify.ts` matches the "no fifth wrapper" sentence.
- `grep -F "D-CMC-13" extensions/pi-claude-marketplace/shared/notify.ts` matches the "import path is stable" sentence.
- `grep -F "SOLE sanctioned ctx.ui.notify call site (D-07)" extensions/pi-claude-marketplace/shared/notify.ts` confirms the existing 15-line comment is preserved verbatim.
- `grep -F "per-file override in eslint.config.js" extensions/pi-claude-marketplace/shared/notify.ts` confirms the existing eslint-discipline paragraph is preserved.
- `grep -rn "ctx.ui.notify" extensions/pi-claude-marketplace/` finds the 4 actual `ctx.ui.notify(` callsites only in `shared/notify.ts` (D-07 single-callsite discipline preserved); other matches are comments referencing the rule.
- `git diff --name-only HEAD~1 HEAD` lists ONLY `extensions/pi-claude-marketplace/shared/notify.ts` (no other file touched).
- `git diff --name-only HEAD~1 HEAD -- eslint.config.js` is empty (CMC-37 / per-file BLOCK B override untouched).
- `git diff --name-only HEAD~1 HEAD -- extensions/pi-claude-marketplace/presentation/index.ts` is empty (D-CMC-13 barrel decision affirmed; no new re-export added).
- `git diff --name-only HEAD~1 HEAD -- extensions/pi-claude-marketplace/shared/markers.ts` is empty (D-CMC-08 retention through Phase 12).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 12 Plan 05 (subsequent plan in the same wave, if any) is unblocked: the wrapper inventory in `shared/notify.ts` is the affirmation Plan 12-04 was scoped to deliver.
- Phase 13 composers can be added to `presentation/` returning plain strings; per the inline D-CMC-11 citation, those strings will flow verbatim into `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError` without a new wrapper or structured-payload arg.
- Phase 13's MSG-CC-1 cause-chain rewrite of `notifyError`'s body remains queued (D-CMC-12); the current body's `\nCause: ${errorMessage(cause)}` tail is intentionally preserved.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/notify.ts`: FOUND (90 lines total; 26 new comment lines added at file head).
- Commit `8b1710c` (docs(12-04): expand shared/notify.ts header for CMC-19 wrapper inventory): FOUND in `git log`.
- `.planning/phases/12-messaging-foundations-renderer-primitives/12-04-SUMMARY.md`: created by this step.

---
*Phase: 12-messaging-foundations-renderer-primitives*
*Completed: 2026-05-22*

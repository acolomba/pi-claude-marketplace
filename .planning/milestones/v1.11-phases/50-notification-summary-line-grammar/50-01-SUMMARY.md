---
phase: 50-notification-summary-line-grammar
plan: 01
subsystem: notifications
tags: [notify, notification-grammar, summary-line, catalog-uat, typescript]

# Dependency graph
requires:
  - phase: 46-49 (v1.10 Error Attribution)
    provides: the dedicated marketplace-not-added variant, single-source isInfoKind guard, computeSeverity standalone arm, and the catalog-uat byte-equality gate this plan corrects
provides:
  - Single shared emitWithSummary seam routing BOTH standalone + cascade error/warning emissions through buildSummaryLine
  - buildSummaryLine returns the failed-subject summary for the two standalone error kinds (marketplace-not-added, failed plugin-info)
  - Two-block notification grammar (summary line + separate detail block) for every standalone error/warning emission
  - Cross-cutting notify-grammar-invariant gate over the catalog error/warning fixtures
affects: [notify, any future standalone NotificationMessage kind, output-catalog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared summary-emission seam (emitWithSummary): no standalone-kind bypass can drift back to a summary-less error/warning emission (GRAM-04)"
    - "Failed-row subject attribution for the summary line (marketplace vs plugin) via the existing computeSeverity discriminator"

key-files:
  created:
    - tests/architecture/notify-grammar-invariant.test.ts
    - .planning/phases/50-notification-summary-line-grammar/deferred-items.md
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - docs/output-catalog.md
    - tests/shared/notify-v2.test.ts
    - "20 cascading orchestrator/edge byte tests (see Files Created/Modified)"

key-decisions:
  - "Extract one file-private emitWithSummary(ctx, message, body) seam; both dispatchInfoMessage and the cascade arm call it -- the structural anti-divergence guarantee for GRAM-04"
  - "Drive the standalone summary off the existing computeSeverity discriminator so info-severity standalone kinds (marketplace-info, *-info-cascade, non-failed plugin-info) stay byte-unchanged"
  - "Hard-count-1 summary for both standalone error kinds (one absent marketplace / one failed plugin row); no cascade-style traversal"
  - "Updated 45 cascading orchestrator/edge byte assertions to the two-block form (Rule 1) -- the v1.10 catalog encoded the glued single line as the contract across the full op matrix"

patterns-established:
  - "emitWithSummary seam: severity computed once; info -> body only; error/warning -> buildSummaryLine + \\n\\n + body (GRAM-01/GRAM-04)"
  - "Summary subject follows the failed row, not the invoking command (GRAM-02)"

requirements-completed: [GRAM-01, GRAM-02, GRAM-03, GRAM-04, GRAM-05]

# Metrics
duration: 20min
completed: 2026-06-08
---

# Phase 50 Plan 01: Notification Summary-Line Grammar Summary

**Every error/warning notification now carries a non-empty summary first line with the detail rendered as its own block, emitted through ONE shared `emitWithSummary` seam so the standalone-vs-cascade divergence that caused the v1.10 glued-label defect cannot recur.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-08T17:08:42Z
- **Completed:** 2026-06-08T17:29Z
- **Tasks:** 3
- **Files modified:** 21 (1 source, 1 catalog, 19 test files; +1 deferred-items doc)

## Accomplishments

- Routed both `dispatchInfoMessage` (standalone arm) and the cascade arm of `notify()` through ONE file-private `emitWithSummary(ctx, message, body)` seam: severity computed once; info emits body-only (byte-unchanged), error/warning prepends `buildSummaryLine(...) + "\n\n" + body` (GRAM-01 / GRAM-04). The body-only standalone tail that glued the host `Error:` label onto the `⊘ ... {not added}` detail row is gone.
- Extended `buildSummaryLine`'s standalone arm so `marketplace-not-added` returns `1 marketplace operation failed.` and a failed `plugin-info` returns `1 plugin operation failed.` (subject follows the failed row, GRAM-02); info/cascade kinds and a non-failed `plugin-info` still return `""`.
- Rewrote all 11 standalone error fence bodies in `docs/output-catalog.md` to the two-block form and corrected the 8 violation-asserting prose sentences (`NO summary line` / `no summary prefix` now 0 occurrences).
- Added `tests/architecture/notify-grammar-invariant.test.ts`: a cross-cutting gate asserting every error/warning emission has a non-empty summary first line distinct from the detail block, matching the closed summary grammar (no leading icon, no `(failed)`/`(skipped)` token).
- `npm run check`: 1514/1515 tests pass (the single remaining failure is a pre-existing, unrelated README documentation gap -- see Deviations).

## Task Commits

1. **Task 1: Author the byte tests + cross-cutting grammar invariant (RED before code)** -- `f000843` (test)
2. **Task 2: Unify standalone + cascade emission on one shared summary helper; extend buildSummaryLine** -- `0112496` (fix)
3. **Task 3: Rewrite catalog fence bodies + prose; update cascading byte tests; run the full gate GREEN** -- `8f45037` (feat)

**Plan metadata:** _(final docs commit -- recorded at close)_

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` -- new `emitWithSummary` seam; both arms route through it; `buildSummaryLine` standalone arm returns the failed-subject summary; refreshed comments (kept GRAM/UXG IDs, stripped the now-false "NEVER carry a summary" narrative).
- `docs/output-catalog.md` -- 11 standalone error fence bodies rewritten to `{summary}\n\n{detail}`; 8 prose sentences corrected; stale `PluginInfoMessage` variant-name prose corrected to `marketplace-not-added`.
- `tests/shared/notify-v2.test.ts` -- standalone `marketplace-not-added` test updated to the two-block form; new failed `plugin-info` two-block byte test; sibling reload-hint test re-verified GREEN.
- `tests/architecture/notify-grammar-invariant.test.ts` (NEW) -- cross-cutting grammar invariant over standalone + cascade error/warning fixtures.
- 18 cascading orchestrator/edge byte tests updated to the two-block form: `tests/architecture/cross-op-convergence.test.ts`, `tests/edge/handlers/{marketplace/autoupdate,marketplace/remove,marketplace/info,marketplace/update,plugin/info,plugin/reinstall,plugin/update}.test.ts`, `tests/orchestrators/{marketplace/info,marketplace/autoupdate,marketplace/remove,marketplace/update,plugin/info,plugin/reinstall,plugin/update,plugin/uninstall,plugin/install}.test.ts`.
- `.planning/phases/50-notification-summary-line-grammar/deferred-items.md` (NEW) -- pre-existing reinstall-docs failure logged.

## Decisions Made

- **One shared `emitWithSummary` seam** rather than fixing the standalone tail in place -- the structural anti-divergence guarantee that closes GRAM-04's root cause (`dispatchInfoMessage` skipping `buildSummaryLine`).
- **Subject from the failed row** via the existing `computeSeverity` discriminator (`marketplace-not-added` -> marketplace; `plugin-info` with `status === "failed"` -> plugin), so no new severity logic or kind list was introduced and info-severity surfaces stayed byte-identical.
- **Hard-count-1** for both standalone kinds -- one absent marketplace / one failed plugin row; no cascade-style traversal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 45 cascading orchestrator/edge byte assertions to the two-block form**
- **Found during:** Task 3 (full `npm run check` after the code + catalog landed)
- **Issue:** The plan's `files_modified` listed only 4 files, but 22 orchestrator/edge/architecture test files asserted the OLD glued standalone form (`assert.equal(<captured message>, "⊘ ... {not added}")` and one failed `plugin-info` multi-line body). The centralized `notify.ts` behavior change correctly broke all of them -- the v1.10 catalog had encoded the glued single line as the contract across the entire op matrix.
- **Fix:** Mechanically prepended `1 marketplace operation failed.\n\n` to the 44 marketplace-subject `{not added}` assertions (scripted, regex-scoped to full-message string literals only) + the 2 `cross-op-convergence` CANONICAL refs; hand-updated the 1 failed `plugin-info` `{not in manifest}` multi-line assertion to the `1 plugin operation failed.` two-block form.
- **Files modified:** 18 test files (listed above).
- **Verification:** each file re-run individually -> `# fail 0`; full `npm test` -> 1514/1515 (only the unrelated reinstall-docs failure remains); `npm run check` typecheck + eslint + prettier all GREEN.
- **Committed in:** `8f45037` (Task 3 commit).

---

**Total deviations:** 1 auto-fixed (Rule 1 -- cascading byte-test updates directly caused by the in-scope centralized fix).
**Impact on plan:** Necessary for the plan's atomicity constraint (whole suite GREEN); no scope creep -- every updated assertion verifies the exact behavior this plan corrects.

## Issues Encountered

- **Pre-existing, out-of-scope test failure (NOT fixed):** `tests/architecture/reinstall-docs.test.ts` fails because `README.md` lacks the v1.1 reinstall command documentation it asserts. Confirmed pre-existing on the baseline (`git show f000843~1:README.md` lacks the string; the test is byte-unchanged by this plan; README was last touched by an unrelated docs commit). Logged to `deferred-items.md`; out of scope per the executor SCOPE BOUNDARY rule. This is the sole reason `npm run check` exits 1; the notification-grammar work itself is fully GREEN.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- GRAM-01..05 fully addressed; the standalone `marketplace-not-added` two-block form renders `1 marketplace operation failed.` then a blank line then the `⊘ ...` detail row, across install/uninstall/reinstall/update/marketplace-update/remove/autoupdate and the failed `plugin-info` surface.
- v1.11 milestone is a single-phase milestone; Phase 50 is its only phase. Ready for milestone verification/close.
- **Concern:** the pre-existing reinstall-docs README gap keeps `npm run check` non-zero; resolve via a `/gsd-quick` doc task (add reinstall forms to README) or align the test to the current README surface before milestone close.

---
*Phase: 50-notification-summary-line-grammar*
*Completed: 2026-06-08*

## Self-Check: PASSED

- Created files verified present: `50-01-SUMMARY.md`, `tests/architecture/notify-grammar-invariant.test.ts`, `deferred-items.md`.
- Modified files verified present: `extensions/pi-claude-marketplace/shared/notify.ts`, `docs/output-catalog.md`.
- Task commits verified in history: `f000843` (test), `0112496` (fix), `8f45037` (feat).

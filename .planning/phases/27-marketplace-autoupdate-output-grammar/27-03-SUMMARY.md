---
phase: 27-marketplace-autoupdate-output-grammar
plan: 03
subsystem: ui
tags: [notify, output-grammar, markers, autoupdate, marketplace, catalog-uat, UXG-04]

# Dependency graph
requires:
  - phase: 27-marketplace-autoupdate-output-grammar (plan 27-01)
    provides: "renamed autoupdate|noautoupdate catalog heading + synced catalog-uat FIXTURES key (loadCatalogExamples sectionRe coupling)"
  - phase: 27-marketplace-autoupdate-output-grammar (plan 27-02)
    provides: "list-surface renderMpHeader case undefined: arm (drop <last-updated>) -- the byte-baseline the flip-surface change must NOT touch"
provides:
  - "Autoupdate flip surface renders <autoupdate> / <no autoupdate> marker tokens (byte-form parity with the list surface)"
  - "Explicit <no autoupdate> off-marker emitted on the flip surface (previously off was marker absence everywhere)"
  - "Idempotent flips render marker-as-outcome + {already autoupdate} / {already no autoupdate} brace (no (skipped) token)"
  - "Renamed REASONS members: already enabled -> already autoupdate, already disabled -> already no autoupdate"
affects: [phase-28, notification-output-polish, marketplace-autoupdate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strategy B closed-set refactor: keep discriminators, rewrite renderer arm bodies + rename REASONS members (zero MARKETPLACE_STATUSES / MARKERS churn)"
    - "Marker-aware branching inside the shared skipped arm (branch only on autoupdate-idempotent reasons; all other skipped reasons keep (skipped) {<reason>})"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts

key-decisions:
  - "Strategy B (research-recommended, lowest blast radius): keep the 7 MARKETPLACE_STATUSES discriminators (autoupdate enabled / autoupdate disabled / skipped) intact and rewrite the renderMpHeader arm bodies + rename two REASONS members. Strategy A (route flips through the list-surface arm) was rejected -- it cannot express the idempotent {already ...} brace and would shrink MARKETPLACE_STATUSES."
  - "<no autoupdate> is already a MARKERS member (notify.ts:129); UXG-04 adds no closed-set members -- only a renamed REASONS pair and new emission on the flip surface."
  - "The autoupdate.ts header comment was INVERTED: marker-as-outcome (● <mp> [<scope>] <autoupdate> / <no autoupdate>) IS NOW the emitted form on the flip surface, reversing the Phase 17.1 / D-18-05 status-token design."
  - "The three list-surface <no autoupdate>-not-emitted prose statements (output-catalog.md L28, L79, L844) were reconciled surface-precisely: <no autoupdate> IS emitted on the flip surface; the list surface still conveys autoupdate-off by marker absence (UXG-04 does not change the list surface)."

patterns-established:
  - "Marker-as-outcome on a state-flip surface: the closed-set marker conveys the persisted state and a separate brace conveys idempotence -- no (skipped) status token on the autoupdate-idempotent forms."

requirements-completed: [UXG-04]

# Metrics
duration: 14min
completed: 2026-05-30
---

# Phase 27 Plan 03: Marketplace Autoupdate Marker Grammar (UXG-04) Summary

**The `marketplace autoupdate` / `noautoupdate` flip surface now renders `<autoupdate>` / `<no autoupdate>` marker tokens (with `{already autoupdate}` / `{already no autoupdate}` idempotence braces) instead of `(autoupdate enabled)` / `(autoupdate disabled)` / `(skipped) {already …}` status tokens, achieving byte-form parity with the `marketplace list` surface while keeping `MARKETPLACE_STATUSES` and `MARKERS` closed sets intact (Strategy B).**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-05-30
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 8

## Accomplishments

- Fresh autoupdate enable renders `● <mp> [<scope>] <autoupdate>`; fresh disable renders `● <mp> [<scope>] <no autoupdate>` (introduces the explicit off-marker -- previously "off" was marker absence).
- Idempotent enable renders `● <mp> [<scope>] <autoupdate> {already autoupdate}`; idempotent disable renders `● <mp> [<scope>] <no autoupdate> {already no autoupdate}` (no `(skipped)` token -- the marker conveys the outcome, the brace conveys idempotence).
- Strategy B: renamed the two `REASONS` members (`already enabled` -> `already autoupdate`, `already disabled` -> `already no autoupdate`), rewrote the `renderMpHeader` fresh-flip arms + added a marker-aware branch in the shared `skipped` arm, and updated the orchestrator payload's reason literal. `MARKETPLACE_STATUSES` (7) and `MARKERS` (2) membership unchanged.
- Idempotent flips still keep `status: "skipped"`, so `computeSeverity` routes them to `warning`; flips carry `plugins: []`, so `shouldEmitReloadHint` still suppresses the `/reload` trailer (neither helper changed).
- Inverted the `autoupdate.ts` header comment (L30-35) that previously forbade the marker-as-outcome form; reconciled the three list-surface `<no autoupdate>`-not-emitted catalog prose statements surface-precisely.
- Landed the renderer + orchestrator + catalog + byte gate + per-variant tests + orchestrator tests in ONE atomic commit so `catalog-uat` never saw an intermediate RED.

## Task Commits

The plan was an intentionally single-commit lockstep change (Tasks 1 and 2 land together; Task 3 is the GREEN gate):

1. **Task 1: Rename autoupdate REASONS + rewrite renderer flip/idempotent arms (renderer + orchestrator)** - `dbd149a` (feat)
2. **Task 2: Rewrite catalog autoupdate state blocks + reconcile `<no autoupdate>` prose + update byte tests** - `dbd149a` (feat, same atomic commit)
3. **Task 3: Full-suite GREEN gate for UXG-04** - no source change; `npm run check` GREEN at 1143/1143

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md) committed separately as `docs(27-03)`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - Renamed the two autoupdate REASONS members; rewrote the `autoupdate enabled` / `autoupdate disabled` fresh-flip arms to emit `<autoupdate>` / `<no autoupdate>`; added a marker-aware branch in the shared `skipped` arm (branch only on the autoupdate-idempotent reasons; all other skipped reasons keep `(skipped) {<reason>}`); updated the `renderMpHeader` docblock byte-form table.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` - Updated the idempotent payload's reason literal to the renamed members; inverted the header comment block (marker-as-outcome is now the emitted form); updated the outcome-map comment to the new byte forms.
- `docs/output-catalog.md` - Rewrote the 4 flip-result state blocks (`enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent`) to marker forms; reconciled the three list-surface `<no autoupdate>`-not-emitted prose statements surface-precisely; updated the autoupdate-section intro.
- `tests/architecture/catalog-uat.test.ts` - Updated the `enable-idempotent` / `disable-idempotent` fixture `reasons` to the renamed members (fresh fixtures keep their statuses; severity stays `warning`).
- `tests/shared/notify-v2.test.ts` - Updated the 5 autoupdate byte/severity tests to the new marker forms and renamed reasons.
- `tests/orchestrators/marketplace/autoupdate.test.ts` - Updated all flip-surface byte assertions and test names to the new marker forms.
- `tests/orchestrators/plugin/bootstrap.test.ts` - Updated 3 byte assertions (delegates to `setMarketplaceAutoupdate`).
- `tests/edge/handlers/plugin/bootstrap.test.ts` - Updated 2 byte assertions (same delegation path).

## Decisions Made

- **Strategy B over Strategy A** (recorded for operator plan-review): keep `MARKETPLACE_STATUSES` discriminators, rewrite renderer arm bodies, rename two REASONS members. Zero closed-set membership change; zero `notify-types.test.ts` / `markers-snapshot.test.ts` impact. `<no autoupdate>` was already a MARKERS member, so only its emission is new.
- **Inverted the `autoupdate.ts` header comment**: the marker-as-outcome row form is now the documented + emitted form on the flip surface (reverses Phase 17.1 / D-18-05). All output still flows through `notify()` (CLAUDE.md IL-2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated bootstrap test byte assertions broken by the renderer change**
- **Found during:** Task 2 (byte-test update / full-suite check)
- **Issue:** The plan's file list named `tests/orchestrators/plugin/bootstrap.test.ts` only implicitly (via the REASONS rename) and did not name `tests/edge/handlers/plugin/bootstrap.test.ts` at all. Both assert the rendered autoupdate flip byte form because `bootstrapClaudePlugin` delegates to `setMarketplaceAutoupdate` (the same `autoupdate.ts` orchestrator). The fresh-enable rows (`(autoupdate enabled)` -> `<autoupdate>`) and the idempotent-enable row (`(skipped) {already enabled}` -> `<autoupdate> {already autoupdate}`) all change under the renderer rewrite, so leaving these tests unedited would have RED-ed the same atomic commit.
- **Fix:** Updated 3 byte assertions + comments in `tests/orchestrators/plugin/bootstrap.test.ts` and 2 byte assertions + comments in `tests/edge/handlers/plugin/bootstrap.test.ts` to the new marker forms.
- **Files modified:** tests/orchestrators/plugin/bootstrap.test.ts, tests/edge/handlers/plugin/bootstrap.test.ts
- **Verification:** Both files GREEN under `node --test`; `npm run check` GREEN at 1143/1143.
- **Committed in:** `dbd149a` (part of the lockstep commit)

**2. [Rule 3 - Blocking] Two lint padding-line + one markdownlint emphasis-style fix**
- **Found during:** Task 3 (`npm run check`)
- **Issue:** ESLint `@stylistic/padding-line-between-statements` required blank lines before the two new `if`/`return` statements in the `skipped` arm; markdownlint `MD049/emphasis-style` flagged an `*absence*` asterisk-emphasis in the catalog (repo enforces underscore emphasis).
- **Fix:** Added blank lines between the marker-branch `if` statements; changed `*absence*` to `_absence_`.
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts, docs/output-catalog.md
- **Verification:** `npm run check` GREEN.
- **Committed in:** `dbd149a` (part of the lockstep commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both were direct mechanical consequences of the planned renderer change (the bootstrap tests exercise the same orchestrator) and the project's lint/format gates. No scope creep; the `docs/adr/v2-001-structured-notify.md` Phase 17.1 record was intentionally left frozen as a historical artifact.
**Impact on plan:** All auto-fixes necessary to keep the single atomic commit GREEN. Closed sets unchanged exactly as Strategy B intended.

## Issues Encountered

None beyond the deviations above.

## Threat Flags

None - UXG-04 rewrites render-time byte forms + renames two closed-set REASONS members + adjusts an orchestrator payload's reason literal. No untrusted input, disk mutation, network, or new parsing surface. The `Reason` literal-union keeps an out-of-set reason a compile error at the producer (T-27-03 mitigation intact).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UXG-04 closed. The flip surface gains the explicit `<no autoupdate>` off-marker; the list surface marker behavior is unchanged.
- `MARKETPLACE_STATUSES` / `MARKERS` membership intact; `notify-types.test.ts` + `markers-snapshot.test.ts` both GREEN.
- Phase 27 has one remaining plan (4 of 4). Phase 28 carries the UXG-03 multi-line cascade label spike.

## Self-Check: PASSED

- `27-03-SUMMARY.md` present in the plan directory.
- Lockstep commit `dbd149a` present in git history.
- Renderer source emits `<autoupdate>` / `<no autoupdate>` markers (15 references in notify.ts).

---
*Phase: 27-marketplace-autoupdate-output-grammar*
*Completed: 2026-05-30*

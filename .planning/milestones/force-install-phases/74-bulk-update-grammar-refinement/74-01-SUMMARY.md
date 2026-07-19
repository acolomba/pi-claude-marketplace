---
phase: 74-bulk-update-grammar-refinement
plan: 01
subsystem: ui
tags: [notify, cascade, tally, update-grammar, output-catalog, byte-equality]

# Dependency graph
requires:
  - phase: 73-force-cross-surface-token-unification
    provides: "the post-73 `(force-upgradable) {<degrade>}` row bytes + `--force` update trailer that the relocked skip-force-upgradable-bulk summary sits below"
provides:
  - "Opt-in updates-only `tally` override on CascadeNotificationMessage (UGRM-02), read only by composeTally"
  - "Bulk-update unchanged-row suppression (UGRM-01) at the orchestrator (cardinality-gated)"
  - "Never-silent `Plugin update: nothing to update` headline for every zero-realized-transition bulk update (empty + info-skip-only cascades)"
  - "emitUpdateNoOpCascade / notifyUpdateNoOpWithContext seam owning the no-op headline"
affects: [update grammar, output-catalog, catalog-uat, any future notify tally changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in per-message envelope override (tally) read by a shared composer, default path byte-identical for non-opting ops"
    - "Orchestrator-owned never-silent no-op headline via a dedicated emit seam (mirrors reconcile-pending-empty byte-lock)"
    - "catalog-uat `emit` override for catalog states whose bytes are produced by the orchestrator, not notify()"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - tests/orchestrators/plugin/update.test.ts
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "tally override owns ONLY the success category; failures/warnings still fold in from countRowsBySeverity (1 failure, 1 updated composes)"
  - "count===0 tally contributes nothing (failure-only cascade stays byte-identical); the no-op headline is the orchestrator's job, not composeTally's"
  - "added emitUpdateNoOpCascade + notifyUpdateNoOpWithContext rather than overloading composeTally — the no-op line never routes through the count:0 collapse"
  - "catalog-uat gained an optional fixture emit override so the two orchestrator-emitted no-op states byte-pair without teaching notify() the no-op grammar"

patterns-established:
  - "Per-op opt-in tally override: install/reinstall/marketplace/import summaries are byte-identical (no tally field)"
  - "Never-silent no-op headline owned by the orchestrator emit seam, not the shared tally composer"

requirements-completed: [UGRM-01, UGRM-02]

coverage:
  - id: D1
    description: "UGRM-01: bulk update suppresses per-plugin (skipped) {up-to-date} rows; single-target path keeps its skip row"
    requirement: "UGRM-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#PUP-1 @mp form: enumerates all installed plugins in the marketplace, partitions accordingly"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#unchanged path (single-target up-to-date render, line 324)"
        status: pass
    human_judgment: false
  - id: D2
    description: "UGRM-01: zero-realized-transition bulk update emits never-silent 'Plugin update: nothing to update' (empty cascade AND info-skip-only cascade)"
    requirement: "UGRM-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#bare-form both-scopes: plugins in user + project scopes both appear in update cascade"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#XSURF-03 / SEV-04: bulk update skipping a force-upgradable candidate -> info (untargeted decline)"
        status: pass
      - kind: integration
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (all-up-to-date-noop, skip-force-upgradable-bulk)"
        status: pass
    human_judgment: false
  - id: D3
    description: "UGRM-02: bulk-update headline counts realized transitions only (Plugin update: N updated), composing with failures"
    requirement: "UGRM-02"
    verification:
      - kind: integration
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT (single-mp-mixed, bare-multi-mp, same-mp-both-scopes, hash-version-arrow)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#PUP-1 @mp form (Plugin update: 1 updated)"
        status: pass
    human_judgment: false
  - id: D4
    description: "UGRM-02 scope discipline: install/reinstall/marketplace/import summaries byte-unchanged (no tally override)"
    requirement: "UGRM-02"
    verification:
      - kind: integration
        ref: "tests/architecture/catalog-uat.test.ts#UGRM-02 scope discipline: a non-update bulk cascade keeps `N successes` (no tally override)"
        status: pass
    human_judgment: false

# Metrics
duration: 23min
completed: 2026-06-30
status: complete
---

# Phase 74 Plan 01: Bulk Update Grammar Refinement Summary

**Bulk `update` now suppresses per-plugin `(skipped) {up-to-date}` rows, counts realized transitions only (`Plugin update: N updated`), and never goes silent (`Plugin update: nothing to update`) — delivered via an opt-in `tally` envelope override so every other op's summary stays byte-identical.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-06-30T03:52:46Z
- **Completed:** 2026-06-30T04:15:56Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- UGRM-01: a bulk (plural) `update` no longer renders a `(skipped) {up-to-date}` row for every unchanged plugin; empty marketplace groups are dropped; the single-target path is untouched.
- UGRM-01/UGRM-02: every zero-realized-transition bulk update (all up-to-date OR an info-skip-only cascade such as a `(force-upgradable)` decline) emits the never-silent `Plugin update: nothing to update` headline — the line can never vanish or render `(no marketplaces)`.
- UGRM-02: the bulk-update headline counts realized transitions only (`Plugin update: N updated`, force-installed degraded updates included), composing with any failure (`1 failure, 1 updated`), via an OPT-IN `tally` override on `CascadeNotificationMessage` read only by `composeTally`.
- Scope discipline proven: install/reinstall/marketplace/import summaries are byte-identical (regression assertion added); `npm run check` green (2484 unit + 16 integration).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add opt-in updates-only tally override to the shared cascade envelope** - `c5913f10` (feat)
2. **Task 2: Suppress unchanged bulk rows, emit no-op headline, stamp tally** - `543d4d20` (feat)
3. **Task 3: Relock the byte contract — catalog, style guide, update tests** - `0ba03246` (test)

_Task 1 was a TDD task; its behavioral RED is the relocked catalog-uat / update fixtures landed in Task 3 (per the plan, Task 1's own gate is typecheck-clean)._

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/notify.ts` - optional `tally` field on `CascadeNotificationMessage`; `composeTally` reads the override (verb has no plural-s; count 0 contributes nothing); new `UPDATE_NO_OP_HEADLINE` constant + exported `emitUpdateNoOpCascade`.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - threads the optional `tally` arg through `notifyWithContext`; new `notifyUpdateNoOpWithContext` seam.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - derive `updatedCount` (partition `updated`); suppress `unchanged` rows when plural; drop empty groups; route the zero-realized-transition case to the no-op emitter; otherwise stamp `tally { verb: "updated", count }`.
- `docs/output-catalog.md` - relocked `single-mp-mixed` (`1 failure, 1 updated`), `all-up-to-date-noop` (`nothing to update`), `bare-multi-mp` (`1 failure, 2 updated`), `same-mp-both-scopes` (`2 updated`), `hash-version-arrow` (`1 updated`), `skip-force-upgradable-bulk` summary (`nothing to update`, Phase-73 row bytes intact); `failed-with-rollback-partial` deliberately unchanged.
- `docs/messaging-style-guide.md` - added the update-scoped bulk grammar rule (suppression + `N updated` + never-silent no-op).
- `tests/orchestrators/plugin/update.test.ts` - relocked PUP-1 @mp to `1 updated`; tightened SEV-04 bulk to a full-body `assert.equal`; relocked bare-form both-scopes to the no-op line.
- `tests/architecture/catalog-uat.test.ts` - `tally` overrides on every relocked plural update fixture; `emit` override drives the two orchestrator-emitted no-op states; reinstall regression assertion.

## Decisions Made
- **tally override owns only the success category.** Failures/warnings still come from `countRowsBySeverity`, so a mixed cascade composes `1 failure, 1 updated`. A `count: 0` override drops the success category entirely, leaving `failed-with-rollback-partial` byte-identical at `1 failure`.
- **The no-op headline is orchestrator-owned, not composeTally-owned.** Routing a `tally { count: 0 }` envelope through `composeTally` returns `""` (the byte-drift defect), so a dedicated `emitUpdateNoOpCascade` / `notifyUpdateNoOpWithContext` seam folds the hard-coded `Plugin update: nothing to update` line in the tally slot. Empty cascade emits only the headline (not `(no marketplaces)`); an info-skip-only cascade renders the body above it.
- **catalog-uat `emit` override.** Because the no-op headline is produced by the orchestrator rather than `notify()`, the byte-equality runner gained an optional per-fixture `emit` hook so the `all-up-to-date-noop` and `skip-force-upgradable-bulk` catalog states byte-pair against the real orchestrator output without teaching `notify()` the no-op grammar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Relocked an un-enumerated all-up-to-date bulk test**
- **Found during:** Task 3 (test relock)
- **Issue:** The plan's Task 3 read_first named `update.test.ts:663-672` (PUP-1) and `3203` (SEV-04 bulk) but not the `bare-form both-scopes` test (line 1632), which is an all-up-to-date bulk case. After UGRM-01 suppression it correctly emits `Plugin update: nothing to update`, so its old `/up-to-date/` + `/alpha/` + `/beta/` assertions no longer held — a legitimate, in-scope new behavior (the all-up-to-date no-op).
- **Fix:** Relocked the test to assert the no-op headline byte-exact at info severity.
- **Files modified:** tests/orchestrators/plugin/update.test.ts
- **Committed in:** `0ba03246` (Task 3 commit)

**2. [Rule 3 - Blocking] SEV-04 bulk degrade reason is `{unsupported source}`, not `{lsp}`**
- **Found during:** Task 3 (tightening the SEV-04 bulk assertion to a full body)
- **Issue:** The plan's dependency note correctly flagged that the `makeCandidateUnsupported` fixture uses an `experimental` manifest. The full-body assertion therefore needed the `{unsupported source}` brace (verified against the FORCE-02 test) — NOT the catalog's hand-built `{lsp}` fixture brace. The catalog `skip-force-upgradable-bulk` state keeps `{lsp}` (its own fixture); the orchestrator test renders `{unsupported source}`.
- **Fix:** Used the `{unsupported source}` brace in the SEV-04 bulk full-body lock.
- **Files modified:** tests/orchestrators/plugin/update.test.ts
- **Committed in:** `0ba03246` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** Both were test-relock corrections within the plan's stated scope (UGRM-01 all-up-to-date no-op; correct degrade-reason byte). No production-code or scope creep. The plan anticipated tests may be RED until Task 3; these are two such cases, now green.

## Issues Encountered
- **gitlint title-length gate (72-char max).** The first Task 2 commit title was 75 chars and was rejected by the `gitlint` hook. Shortened the title; committed clean. No content change.

## Plural-update fixture enumeration (catalog-uat)
Every `cardinality: "plural"` + `label: "Plugin update"` fixture is accounted for:
- `single-mp-mixed` — relocked (tally count 1, beta removed) → `1 failure, 1 updated`
- `failed-with-rollback-partial` — relocked (tally count 0) → byte-unchanged `1 failure`
- `all-up-to-date-noop` — relocked (emit no-op) → `nothing to update`
- `bare-multi-mp` — relocked (tally count 2, beta removed) → `1 failure, 2 updated`
- `same-mp-both-scopes` — relocked (tally count 2) → `2 updated`
- `hash-version-arrow` — relocked (tally count 1) → `1 updated`
- `skip-force-upgradable-bulk` — relocked (emit no-op) → `nothing to update`
- `decline-force-upgradable-targeted` — **single** cardinality, provably unaffected (composeTally returns `""` for single; no suppression, no tally)
- `missing-marketplace-not-added` / `missing-marketplace-not-added-absent-from-both` — standalone `marketplace-not-added` kind, provably unaffected (no cascade tally)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 74 closes UGRM-01/UGRM-02. `npm run check` green. Ready for `/gsd-verify-work`.
- No blockers; no new threat surface (render/count grammar only — threat register T-74-01/02 both `accept`).

## Self-Check: PASSED

- SUMMARY.md present.
- Task commits c5913f10, 543d4d20, 0ba03246 all present in git history.

---
*Phase: 74-bulk-update-grammar-refinement*
*Completed: 2026-06-30*

---
phase: 03-desired-state-output-atomic-catalog-supersession
plan: 02
subsystem: notifications
tags: [typescript, notify, catalog-uat, tally, cardinality, desired-state-output]

# Dependency graph
requires:
  - phase: 03-desired-state-output-atomic-catalog-supersession
    plan: 01
    provides: D-02 leading severity sentence (summaryPhrase helper); D-03 render-time mixed-subject detection; D-01 absent-target error flips; the catalog blocks already carrying the D-02 summary line
  - phase: 01-localized-type-model-command-context-spine
    provides: CommandContext.Messaging.label (the tally <Operation> name); structural tuple-vs-array cardinality (Single/Plural row aliases)
  - phase: 02-caller-stamped-severity-reload-reducer
    provides: caller-stamped row.severity + dumb MAX reducer (cascadeSeverity/countRowsBySeverity)
provides:
  - "OUT-03/OUT-04/D-04 trailing per-operation tally (<Operation>: <n> failure(s), <n> warning(s), <n> success(es)) on plural cascades, gated on structural cardinality, using Messaging.label"
  - "OUT-06/D-03 mixed-subject tally for reconcile/import (operation name; all rows counted uniformly)"
  - "widened countRowsBySeverity target union ('info' for the success count)"
  - "structural single|plural cardinality signal carried on CascadeNotificationMessage / ReconcileAppliedCascadeMessage, threaded from notifyWithContext"
affects: [04-concern-module-extraction, catalog-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tally is a renderer-derived string folded into the single composed body between the cascade body and the reload-hint trailer ({body}\\n\\n{tally}\\n\\n{hint}); single emitWithSummary -> one ctx.ui.notify preserved (IL-2)"
    - "Structural cardinality is the invocation FORM (reinstall/update <plugin>@<mp> = single, @marketplace/bare/import/reconcile = plural), threaded as a notifyWithContext parameter onto the message -- NOT a render-time row count (D-04/Pitfall 5)"
    - "A marketplace row counts as an operation IFF it carries a status (added/updated/removed/failed/skipped) OR a stamped severity; a bare grouping header (neither) is bookkeeping and excluded from the success count"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/shared/notify-inert-fields.test.ts

key-decisions:
  - "Cardinality + label ride on the message (CascadeNotificationMessage.label/cardinality) rather than as new emitContextCascade params -- the message already flows through every seam AND through the catalog-uat notify() driver, so fixtures can supply them directly"
  - "Marketplace update is STRUCTURALLY SINGLE (one named marketplace per invocation -> Single<...> at the call site), so it OMITS the tally -- diverges from the plan's enumeration of it as a plural section; the structural-cardinality rule (D-04, a HARD constraint) overrides the planning-time guess"
  - "A bare marketplace header (no status, no severity) is bookkeeping and excluded from the success count; an mp row WITH a status (import added, remove removed) IS a real operation and counts"

patterns-established:
  - "The tally composer reuses the widened countRowsBySeverity (info/warning/error) -- no new counter built (RESEARCH Don't-Hand-Roll)"
  - "Atomic catalog supersession held across both task commits: every plural catalog block + its catalog-uat fixture + the orchestrator byte-assertion tests moved in lockstep; catalog-uat and npm run check green at every boundary"

requirements-completed: [OUT-03, OUT-04, OUT-06, OUT-08, GATE-02]

# Metrics
duration: ~95min
completed: 2026-06-24
---

# Phase 3 Plan 02: OUT-03/04 trailing per-operation tally Summary

**The OUT-03/OUT-04/D-04 trailing per-operation tally (`<Operation>: <n> failure(s), <n> warning(s), <n> success(es)`) on plural (bulk) cascades -- gated on a structural single/plural cardinality signal threaded from the invocation form, using `Messaging.label` as `<Operation>`, with D-03 mixed-subject counting for reconcile/import -- additive on top of Plan 01's D-02 leading sentence, with every plural catalog block + fixture superseded in lockstep (catalog-uat green at every commit).**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-06-24
- **Completed:** 2026-06-24
- **Tasks:** 2
- **Files modified:** 11 (4 in the plan's file list; the 3 bulk orchestrators + 3 orchestrator byte-assertion test files were lockstep additions the tally reddened)

## Accomplishments

- **Task 1 (commit `b8cb2cd8`):** Widened `countRowsBySeverity`'s `target` union to include `"info"` (the success count, RESEARCH Don't-Hand-Roll); added inert `label?`/`cardinality?` fields to `CascadeNotificationMessage` and `ReconcileAppliedCascadeMessage`; threaded `context.Messaging.label` + a structural `cardinality` parameter through `notifyWithContext` / `notifyReconcileAppliedWithContext` onto the message. Kept inert (no byte shift) -- catalog-uat stayed green with ZERO fixture edits, proving the threading consumed no bytes.
- **Task 2 (commit `1746a0d1`):** Added the `composeTally` composer + `tallyCategory` pluralizer + `foldTallyAndHint` placement helper in `notify.ts`; folded the tally into the single composed body between the cascade body and the reload-hint trailer at all three composition sites (`notify()`, `emitContextCascade`, `emitReconcileAppliedContextCascade`, plus the `dispatchInfoMessage` reconcile-applied arm so the catalog-uat `notify()` driver path matches the production seam byte-for-byte). Wired the bulk reinstall/update orchestrators to thread `single`/`plural` from the invocation form; import + reconcile are always plural. Added the tally line to every plural catalog block (reinstall x7, plugin update x6, import x4, reconcile-applied x5) and updated the catalog-uat fixtures + the reinstall/update/import orchestrator byte-assertion tests in lockstep.

## Task Commits

1. **Task 1: thread tally label + structural cardinality, widen counter** - `b8cb2cd8` (feat)
2. **Task 2: add OUT-03/04 trailing per-operation tally for plural ops** - `1746a0d1` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - Widened `countRowsBySeverity` to `"info" | "warning" | "error"`; added `label?`/`cardinality?` to `CascadeNotificationMessage` + `ReconcileAppliedCascadeMessage`; new `composeTally` / `tallyCategory` / `foldTallyAndHint`; tally folded into `notify()`, `emitContextCascade`, `emitReconcileAppliedContextCascade`, and the `dispatchInfoMessage` reconcile arm.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - `notifyWithContext` gains a `cardinality?` param and stamps `Messaging.label` + cardinality onto the cascade message; `notifyReconcileAppliedWithContext` stamps `label` + `cardinality: "plural"`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - threads `cardinality` (`opts.target.kind === "plugin" ? "single" : "plural"`) through `renderReinstallPartitionAndNotify`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - threads `cardinality` from the invocation form through `renderUpdateCascadeAndNotify` / `renderUpdateCascadeIfAny`.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` - passes `cardinality: "plural"` at the bulk import notify.
- `docs/output-catalog.md` - tally lines added to all 22 plural fenced blocks (reinstall, plugin update, import, reconcile-applied); reconcile section intro prose updated to describe the tally taking the reload-hint slot.
- `tests/architecture/catalog-uat.test.ts` - `label`/`cardinality` added to the 22 plural fixtures.
- `tests/orchestrators/plugin/update.test.ts` - PUP-1 @mp bulk-form body assertion gains the tally line.
- `tests/orchestrators/plugin/reinstall.test.ts` - `__test_renderReinstallPartitionAndNotify` seam call passes `"plural"`.
- `tests/orchestrators/import/execute.test.ts` - two bulk-import body assertions gain `Import: 2 successes`.
- `tests/shared/notify-inert-fields.test.ts` - new inert-threading guard (single-target label renders no tally) + two tally render tests (mixed + all-success).

## Decisions Made

- **Cardinality + label ride on the message, not as new seam params.** The plan's acceptance criterion suggested threading `label` into `emitContextCascade`/`emitReconcileAppliedContextCascade` signatures. Riding both on `CascadeNotificationMessage.label`/`cardinality` is cleaner (the message already flows through every seam) AND necessary: the catalog-uat driver calls `notify(ctx, pi, message)` directly, so the only way a fixture can exercise the tally is via message-borne fields. The grep criterion is satisfied (`label`/`cardinality` are referenced in notify.ts).
- **Marketplace update OMITS the tally (deviation from the plan's enumeration).** The plan listed "marketplace update cascade" as a plural section, but the `marketplace update <name>` orchestrator constructs `Single<MarketplaceRows<...>>` at its notify call sites (one named marketplace per invocation). Per D-04 / Pitfall 5 (a HARD project constraint -- cardinality is STRUCTURAL, not a row count), a single-target operation omits the tally; the marketplace's outcome is embedded in its single header row. The structural rule overrides the planning-time enumeration.
- **Bare marketplace headers are not operations.** A marketplace row with neither a `status` nor a stamped `severity` is a pure grouping label (reinstall/update bare headers); it is excluded from the success count so a 2-plugin reinstall reads `2 successes`, not `3`. A marketplace row WITH a `status` (import `added`, remove `removed`) IS a real mp-level operation and counts -- which is exactly what D-03/OUT-06 mixed-subject uniform counting requires.
- **Idempotent/info rows count as successes.** A `(skipped) {up-to-date}` row stamps `info` (D-01 desired-state-reached), so it counts in the success tally; a plural all-up-to-date update reads `Plugin update: 2 successes`. This follows the stamped-fact tri-state contract (info = reached desired state).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Wired the bulk orchestrator call sites to pass `cardinality`**
- **Found during:** Task 2
- **Issue:** The plan's Task 2 `files` list named only `notify.ts`, `output-catalog.md`, `catalog-uat.test.ts`, but the tally is dead in production unless the orchestrators pass `cardinality: "plural"` at their bulk call sites. Without this, the tally would render only in catalog-uat fixtures and never for a real user.
- **Fix:** Threaded the structural single/plural cardinality from the invocation form (`opts.target.kind`) through `renderReinstallPartitionAndNotify` (reinstall.ts) and `renderUpdateCascadeAndNotify`/`renderUpdateCascadeIfAny` (update.ts); passed `cardinality: "plural"` at the import bulk site (execute.ts). Reconcile is wired via `notifyReconcileAppliedWithContext` (Task 1).
- **Files modified:** reinstall.ts, update.ts, import/execute.ts.
- **Verification:** the single-target `update <plugin>@<mp>` tests now correctly omit the tally; the `@mp` bulk-form test carries it.
- **Committed in:** `1746a0d1`

**2. [Rule 3 - Blocking] Lockstep update of 3 orchestrator byte-assertion tests + the reinstall seam test**
- **Found during:** Task 2
- **Issue:** Wiring the bulk orchestrators reddened byte-exact body assertions in `update.test.ts` (PUP-1 @mp), `import/execute.test.ts` (two bulk-import bodies), and a type error in `reinstall.test.ts` (the `__test_renderReinstallPartitionAndNotify` seam now takes a 4th `cardinality` arg). GATE-03 requires `npm run check` green at every boundary.
- **Fix:** Updated the bulk-form body assertions to include the tally line and passed `"plural"` to the reinstall seam call, in the same commit as the producer wiring. The single-target `pl@mp` update tests required NO change (they correctly omit the tally now).
- **Files modified:** update.test.ts, import/execute.test.ts, reinstall.test.ts.
- **Verification:** `npm run check` exits 0 (serial run); catalog-uat green.
- **Committed in:** `1746a0d1`

---

**Total deviations:** 2 auto-fixed (1 missing-functionality wiring of the bulk call sites, 1 blocking lockstep test update). Plus one documented scope decision (marketplace update omits the tally per structural cardinality).
**Impact on plan:** The marketplace-update exclusion narrows the plan's stated catalog blast radius by one section but is mandated by the D-04 structural-cardinality HARD constraint. apply.ts (reconcile converge) and notify-reasons.ts (closed reason set) were NOT modified, as required (constraint #7).

## Issues Encountered

- **One flaky filesystem-race test** (`autoupdate.test.ts` `D-UPD: setMarketplaceAutoupdate ... rmdir ENOTEMPTY`) failed transiently under parallel full-suite load. It passes in isolation and on a serial run (`TEST_CONCURRENCY=1 npm test` -> 2331 pass, 0 fail); unrelated to the tally change (autoupdate is a single-target section that gets no tally). Out of scope per the SCOPE BOUNDARY rule -- the same class of flake was documented in 03-01-SUMMARY.

## Threat Surface

- The tally is renderer-derived from integer severity counts + a static English command label (`Messaging.label`); no path, PII, or secret crosses the seam (T-03-03 disposition `accept`, confirmed). No new cause-bearing row is introduced; the redaction seam on existing cause trailers is untouched.
- No package installs (T-03-04); in-repo TypeScript + markdown only.
- No new network endpoints, auth paths, or schema changes at trust boundaries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The desired-state output surface (D-02 leading sentence from Plan 01 + the OUT-03/04 trailing tally from this plan) is live and byte-fixed in the catalog. Phase 4 (concern-module extraction, MOD-04/05/06, GATE-03) can proceed against this stable rendered-output baseline.
- Note: the tally's `cardinality` signal is a structural parameter on `notifyWithContext`; if Phase 4 extracts concern modules that emit their own cascades, they must thread `cardinality` (and benefit from the message-borne `label`) to participate in the tally.

## Self-Check: PASSED

- SUMMARY file exists at the plan directory.
- Both task commits (`b8cb2cd8`, `1746a0d1`) present in git history.
- All modified key-files exist on disk.
- `node --test tests/architecture/catalog-uat.test.ts` exits 0; `npm run check` green (serial run).

---
*Phase: 03-desired-state-output-atomic-catalog-supersession*
*Completed: 2026-06-24*

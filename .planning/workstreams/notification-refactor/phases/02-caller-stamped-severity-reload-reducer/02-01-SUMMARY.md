---
phase: 02-caller-stamped-severity-reload-reducer
plan: 01
subsystem: notifications
tags: [typescript, discriminated-union, notify, reducer, severity, reload, output-preserving]

# Dependency graph
requires:
  - phase: 01-localized-type-model-command-context-spine
    provides: inert optional MessageBase severity?/needsReload? base fields + CommandContext/MarketplaceRows<Msg> spine
provides:
  - TransitionMessageBase narrowing the 5 plugin transition arms to REQUIRED severity + needsReload (GATE-01 type-level, TS2741 on omission)
  - notify() as a dumb reducer -- emission severity = numeric MAX over row.severity (SEV-02), /reload trailer = OR-reduce of row.needsReload (RLD-02), tally by stamped severity
  - Every transition + non-success notification producer row stamps severity/needsReload per the D-03 severity map and D-06 reload map (SEV-01/RLD-01)
  - skipSeverity helper (notify-reasons.ts) classifying benign-vs-actionable skips at the producer emit site
  - MarketplaceRows<Msg> carrying optional severity?/needsReload? so header-only failed mp blocks stamp their own error severity
affects: [Phase 3 desired-state divergence + catalog supersession (D-02), Phase 2 Plan 02-02 present->installed collapse + disable-cascade kind removal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Caller-stamped facts + dumb reducer: producers stamp severity/needsReload; notify() reduces (MAX / OR / tally) with no content inference"
    - "TransitionMessageBase interface narrowing optional MessageBase fields to required on the 5 state-change arms (GATE-01 type-level enforcement)"
    - "Producer-local benign classification via shared skipSeverity over the OUT-08-proven IDEMPOTENT_REASONS group"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/{install,uninstall,update,reinstall,enable-disable,info,list}.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/{add,remove,update,autoupdate}.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/{notify,pending}.ts
    - tests/shared/notify-v2.test.ts
    - tests/shared/notify-inert-fields.test.ts
    - tests/shared/snm38-indent-ladder.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "Narrowed ONLY the 5 plugin transition arms (Task 2 acceptance criteria). Marketplace-level transition arms (removed/updated) stay on MessageBase; they default correctly (info / needsReload false) and stamping their non-success rows (failed/skipped severity) on the optional field is byte-safe without narrowing."
  - "Kept the computeSeverity standalone info-kind switch (Q1 LOCKED): those kinds carry no per-row severity array, so a kind->severity map is not reason inference and preserves SEV-02. Only the cascade branch becomes the dumb MAX reducer."
  - "Extended MarketplaceRows<Msg> with optional severity?/needsReload? so a header-only failed mp block (no plugin child) can stamp its own error severity; the widening cast preserves it into MarketplaceNotificationMessage."
  - "Added skipSeverity to notify-reasons.ts (over the existing IDEMPOTENT_REASONS group) for dynamic-reason skip sites, replacing the deleted central allBenign lookup with producer-local classification."

patterns-established:
  - "Interface-first task order: stamp producers -> narrow interfaces -> rewrite reducer + repair tests, keeping npm run check green at every commit."
  - "Output-preserving relocation: producers stamp the value the deleted ladder would have computed (D-03/D-06), gated byte-identical by catalog-uat."

requirements-completed: [SEV-01, SEV-02, SEV-03, SEV-04, SEV-05, RLD-01, RLD-02, RLD-03, GATE-01]

# Metrics
duration: 51min
completed: 2026-06-24
---

# Phase 2 Plan 01: Caller-stamped severity & reload reducer Summary

**Relocated severity/reload correctness from one central content ladder to ~20 producers (caller-stamped severity + needsReload), narrowed the 5 plugin transition interfaces to required fields (GATE-01 TS2741), and rewrote notify() as a dumb MAX-severity / OR-reload / tally reducer -- all byte-identical (catalog-uat green, docs/output-catalog.md blob OID unchanged).**

## Performance

- **Duration:** 51 min
- **Started:** 2026-06-24T20:32:39Z
- **Completed:** 2026-06-24T21:23:58Z
- **Tasks:** 3
- **Files modified:** 23 (across 3 task commits)

## Accomplishments
- Turned the inert Phase-1 `severity`/`needsReload` fields LIVE: every transition producer (and every non-success notification row across all orchestrators) stamps both fields per the D-03 severity map and D-06 reload map.
- Added `TransitionMessageBase` and narrowed the 5 plugin transition arms (`PluginInstalled/Updated/Reinstalled/Uninstalled/DisabledMessage`) to REQUIRED `severity`+`needsReload` -- omitting either is now a TS2741 compile error at the construction site (GATE-01 proven live, then reverted).
- Rewrote `notify()` into a dumb reducer: emission severity = numeric MAX over `row.severity` (SEV-02), `/reload` trailer = OR-reduce of `row.needsReload` (RLD-02), summary tallies by stamped severity. Deleted `BENIGN_REASONS`, `allBenign`, the content-derived `cascadeSeverity` ladder, `reconcileAppliedSeverity`, and the `shouldEmitReloadHint` status-token trigger loop + `disable-cascade` straddle.
- Repaired every dependent test in lockstep (notify-v2, notify-inert-fields, catalog-uat, notify-grammar-invariant, snm38, apply.test) so `npm run check` stays green and the catalog stays byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stamp severity + needsReload on every transition producer literal (D-03/D-06)** - `b30abf70` (feat)
2. **Task 2: Narrow the 5 transition interfaces to required (GATE-01)** - `b41248d2` (feat)
3. **Task 3: Rewrite the reducer to MAX/OR/tally, delete the content ladders, repair the dependent tests** - `798d34df` (feat)

## Files Created/Modified
- `shared/notify.ts` - added `TransitionMessageBase`, narrowed the 5 plugin transition arms, deleted `BENIGN_REASONS`/`allBenign`/`reconcileAppliedSeverity`, rewrote `cascadeSeverity` (MAX over `row.severity`), `shouldEmitReloadHint` cascade branch (OR-reduce `row.needsReload`), and `countFailedRows`/`countSkippedRows` (tally by stamped severity via `countRowsBySeverity`).
- `shared/notify-context.ts` - extended `MarketplaceRows<Msg>` with optional `severity?`/`needsReload?` so header-only failed mp blocks stamp their own severity.
- `shared/notify-reasons.ts` - added `skipSeverity(reasons)` (over `IDEMPOTENT_REASONS`) for producer-local benign-vs-actionable classification.
- `orchestrators/plugin/{install,uninstall,update,reinstall,enable-disable,info,list}.ts`, `orchestrators/marketplace/{add,remove,update,autoupdate}.ts`, `orchestrators/import/execute.ts`, `orchestrators/reconcile/{notify,pending}.ts` - stamped `severity`/`needsReload` on every transition + non-success notification row.
- `tests/shared/notify-inert-fields.test.ts` - rewritten to assert the fields are LIVE (SEV-02/RLD-02), superseding the inverted inert-field premise.
- `tests/orchestrators/reconcile/apply.test.ts` - the S9 source-shape pin now asserts `cascadeSeverity` reads `severity`, not `status`/`reasons`.
- `tests/shared/notify-v2.test.ts`, `tests/architecture/catalog-uat.test.ts`, `tests/architecture/notify-grammar-invariant.test.ts`, `tests/shared/snm38-indent-ladder.test.ts` - fixture INPUT literals stamped; no expected-byte block or assertion semantics changed.

## Decisions Made
- **Narrowing scope limited to the 5 plugin transition arms** (Task 2 acceptance criteria). The marketplace-level `removed`/`updated` arms were left on `MessageBase`: they default correctly for the reducer, and their non-success siblings (`failed`/`skipped`) stamp severity on the still-optional field without narrowing. This keeps the GATE-01 blast radius tight while preserving bytes.
- **Q1 LOCKED:** kept the `computeSeverity` standalone info-kind switch (`marketplace-not-added`->error, failed `plugin-info`->error, read-only info kinds->info). These carry no per-row severity array; the map is a kind lookup, not reason inference, so SEV-02 holds. Only the cascade branch became the dumb MAX reducer.
- **`MarketplaceRows<Msg>` gained `severity?`/`needsReload?`** so a header-only `(failed)` marketplace block (no plugin child to carry the error) can stamp its own error severity; the post-check widening cast preserves it into `MarketplaceNotificationMessage`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Layout drift: tests + npm run check run from repo ROOT, not the extension dir**
- **Found during:** Task 1 setup
- **Issue:** The plan's `cd extensions/pi-claude-marketplace && npm run check` and `node --test tests/...` commands assume the tests/package live under the extension dir; in this repo `package.json`, `tests/`, and `docs/output-catalog.md` are at the repo root while `shared/notify.ts` lives under `extensions/pi-claude-marketplace/`.
- **Fix:** Ran all gates (`npm run check`, `node --test tests/architecture/catalog-uat.test.ts`, the catalog byte gate) from the repo root. No source change.
- **Verification:** `npm run check` exit 0; catalog-uat passes; catalog blob OID unchanged at every commit.
- **Committed in:** n/a (workflow adjustment)

**2. [Rule 3 - Blocking] `MarketplaceRows<Msg>` could not carry mp-level severity**
- **Found during:** Task 1 (stamping header-only mp `failed` blocks)
- **Issue:** `MarketplaceRows<Msg>` is a structural type that omitted the `MessageBase` severity/needsReload fields, so stamping a header-only failed mp block (no plugin child) was a TS2353 error and the dumb reducer would later mis-report its severity as info.
- **Fix:** Added optional `severity?`/`needsReload?` to `MarketplaceRows<Msg>` (mirroring `MpCommon`); the widening cast preserves them into the broad union the reducer reads.
- **Files modified:** shared/notify-context.ts
- **Verification:** typecheck green; catalog-uat byte-identical (header-only failed states route to error).
- **Committed in:** b30abf70 (Task 1)

**3. [Rule 2 - Missing Critical] Producers outside the plan's file list emit non-success rows the dumb reducer reads**
- **Found during:** Task 3 (full test suite after the reducer rewrite)
- **Issue:** The plan's `files_modified` omitted `marketplace/add.ts`, `reconcile/pending.ts`, and the `plugin/list.ts` synthetic-failure / failed-header rows. These emit `failed` notification rows; once the reducer stopped inferring from `status`, an unstamped `failed` row defaulted to info -> wrong severity/summary (18 cross-suite test failures).
- **Fix:** Stamped the `failed` notification rows in `marketplace/add.ts`, `reconcile/pending.ts`, and `plugin/list.ts` with `severity: "error"` (+ `needsReload: false` on plugin rows). Left `marketplace/info.ts`'s `plugin-info` `PluginInfoRow` UNCHANGED (a separate info-surface type whose severity is handled by the info-kind switch).
- **Files modified:** orchestrators/marketplace/add.ts, orchestrators/reconcile/pending.ts, orchestrators/plugin/list.ts
- **Verification:** full `npm test` green (2324/2324); catalog byte-identical.
- **Committed in:** 798d34df (Task 3)

**4. [Rule 1 - Bug] Stale docs/test-pin describing the deleted ladder**
- **Found during:** Task 3 (reducer rewrite)
- **Issue:** The notify.ts module header comment and the `apply.test` S9 source-shape pin described the deleted content ladder (`status`/`reasons` first-match, `disable-cascade` straddle); they were now factually wrong / failing.
- **Fix:** Updated the module header comment to describe the SEV-02 MAX / RLD-02 OR-reduce; rewrote the S9 pin to assert `cascadeSeverity` reads `severity` and not `status`/`reasons`.
- **Files modified:** shared/notify.ts, tests/orchestrators/reconcile/apply.test.ts
- **Verification:** typecheck + lint green; the rewritten pin passes.
- **Committed in:** 798d34df (Task 3)

**Scope-boundary note:** `orchestrators/edge-deps.ts` (in the plan's file list) was NOT stamped -- its `installed` row at ~:134 is a `PluginIndexRow` (completion-cache persistence schema, validated by typebox), NOT a `PluginNotificationMessage`. Likewise `plugin/info.ts`'s installed rows are `PluginInfoRow` (info surface), not cascade rows. Both were correctly excluded.

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 missing critical, 1 bug) + 1 documented scope-boundary exclusion.
**Impact on plan:** All auto-fixes were required for correctness (the dumb reducer reads stamped facts from EVERY non-success row) or to keep the gates green. No scope creep -- the marketplace-arm narrowing was intentionally NOT expanded, and the present->installed collapse + disable-cascade kind removal were left for Plan 02-02 as specified.

## Issues Encountered
- **One flaky `fail 1` on a concurrency test:** a single full-suite run reported one transient failure (a process-race timing test); the clean re-run was 2324/2324 green and the final `npm run check` passed exit 0. Not caused by this plan's changes.
- **GATE-01 probe:** deliberately removed `needsReload` from one install transition literal -> `npx tsc --noEmit` reported `TS2741: Property 'needsReload' is missing ... but required in type 'PluginInstalledMessage'` at the construction site (line 1359), then reverted; tree green again.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The relocation is mechanism-only and output-preserving: `docs/output-catalog.md` blob OID stays `8f9724c31307e759277b69534918d28a860c54a4`; catalog-uat byte-identical; `npm run check` green.
- Plan 02-02 owns the `present`->`installed` status collapse (RLD-04) and the `disable-cascade` KIND removal (RLD-05). This plan left the `present` token and the `disable-cascade` kind literal intact, and the reducer no longer DEPENDS on the kind (the disable transition stamps `needsReload: true` directly), so 02-02 can remove the kind cleanly.
- Phase 3 (D-02) can now exercise divergent desired-state severities (install-already->error, update-up-to-date->info) by changing producer stamps; the SEV-05 capability is structurally established.

## Self-Check: PASSED

- Created/modified files present: `shared/notify.ts`, `shared/notify-context.ts`, `shared/notify-reasons.ts`, the listed orchestrators, and the 6 repaired test files (verified below).
- Task commits present: `b30abf70`, `b41248d2`, `798d34df`.
- `npm run check` exit 0; `node --test tests/architecture/catalog-uat.test.ts` passes; `docs/output-catalog.md` blob OID unchanged (`8f9724c3...`); GATE-01 TS2741 proven live and reverted.

---
*Phase: 02-caller-stamped-severity-reload-reducer*
*Completed: 2026-06-24*

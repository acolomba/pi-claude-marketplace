---
phase: 69-force-path-severity
plan: 02
subsystem: api
tags: [notify, severity, soft-dep, force-upgradable, update, install, output-catalog]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: the installable/unsupported/unavailable three-way discriminant the force success arms read
  - phase: 66-derived-force-state-glyphs
    provides: the force-installed / force-upgradable rows whose severity is stamped here
  - phase: 69-force-path-severity (plan 01)
    provides: the forceable discriminant threading and the SEV-02 conditioning seam this plan builds on
provides:
  - SEV-01 missing-companion warning on otherwise-successful install/update success rows (clean + force-installed)
  - companionSeverity shared helper in notify-reasons.ts (declared-companion vs softDepStatus(pi) probe)
  - SEV-04 targeted-vs-bulk severity for the force-upgradable `no longer installable` decline (cardinality-threaded)
  - cascadeSkipSeverity helper threading invocation cardinality into the update skip arm
affects: [70-spec-documentation-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-stamped desired-state severity: raise info -> warning at the emit site, never re-derive in cascadeSeverity"
    - "Single softDepStatus(pi) probe per notify invocation, threaded into per-row mappers (mirrors the renderer's probe discipline)"
    - "Invocation-shape (cardinality) threaded into a row-severity helper rather than inferred from cascade shape"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "Missing-companion warning is a CASCADE-level change, not purely per-row: flipping info->warning prepends the `A plugin operation needs attention.` summary line, so the catalog blocks and producer byte-form tests gained that prefix in lockstep"
  - "Extracted a shared companionSeverity helper (sibling to skipSeverity) used by both install.ts and update.ts -- removes duplication and keeps outcomeToCascadePluginMessage under the sonarjs cognitive-complexity cap"
  - "SEV-04 scoped strictly to the `no longer installable` decline; `not installed`/`not found` stay error, idempotent skips stay info, all other non-idempotent skips keep skipSeverity"

patterns-established:
  - "companionSeverity(declaresAgents, declaresMcp, probe): the canonical missing-companion severity classifier"
  - "cascadeSkipSeverity(reasons, cardinality): targeted=warning / bulk=info for the force-upgradable decline only"

requirements-completed: [SEV-01, SEV-04]

# Metrics
duration: ~75min
completed: 2026-06-28
---

# Phase 69 Plan 02: Force-Path Severity (SEV-01 + SEV-04) Summary

**An otherwise-successful install/update whose declared soft-dep companion is unloaded now stamps warning (SEV-01), and a force-upgradable `no longer installable` decline follows invocation cardinality -- targeted warning, bulk info (SEV-04) -- both as producer-side desired-state stamps on the existing caller-stamped notification model.**

## Performance

- **Duration:** ~75 min
- **Completed:** 2026-06-28
- **Tasks:** 2
- **Files modified:** 7 (3 source, 1 doc, 3 test)

## Accomplishments
- SEV-01: raised the install (clean `installed` + degraded `force-installed`) and update (`updated` + `force-installed`) success rows from info to warning when a DECLARED companion (`pi-subagents` for staged/declared agents, `pi-mcp-adapter` for mcp) is absent from the single sanctioned `softDepStatus(pi)` probe. The `{requires pi-...}` per-row marker already renders the detail; only the desired-state severity (and the cascade summary line) moves.
- Extracted a shared `companionSeverity(declaresAgents, declaresMcp, probe)` helper into `shared/notify-reasons.ts` (sibling to `skipSeverity`), consumed by both install and update so the logic is single-sourced.
- SEV-04: threaded the existing `cardinality` invocation-shape signal into `outcomeToCascadePluginMessage` via a new `cascadeSkipSeverity(reasons, cardinality)` helper -- a targeted `update <plugin>@<marketplace>` declining a force-upgradable candidate stays warning; a bulk `@<marketplace>` / bare `update` skipping one flips to info, shifting the plural summary tally to count it among the successes.
- Locked the live regression guards: force-degrade install/update stay info (no missing companion), reinstall manual-recovery stays warning (existing catalog-uat `per-plugin-manual-recovery` + reinstall tests), and added an explicit "companion present -> info" install conditioning test.
- Updated catalog blocks + catalog-uat fixtures in lockstep for the three missing-companion install states (SEV-01) and the two new targeted/bulk decline states (SEV-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: SEV-01 -- lock live stamps + missing-companion warning probe** - `3b7b0ff4` (feat)
2. **Task 2: SEV-04 -- targeted=warning / bulk=info for the force-upgradable decline** - `5b54a46a` (feat)

_Both tasks are `tdd="true"`; the byte-equality lockstep constraint (no RED window on the catalog-uat gate) required producer + catalog + fixture in a single commit per task, so RED/GREEN collapsed into one GREEN commit each (the prior wave's documented pattern). The producer-level conditioning tests (install.test.ts / update.test.ts) were updated in the same commit._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - SEV-01 stamp via `companionSeverity` at both success arms; `softDepStatus` import
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - SEV-01 stamp on `updated`/`force-installed` arms; SEV-04 `cascadeSkipSeverity` threading `cardinality`; single probe per cascade
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - new `companionSeverity` helper (SEV-01 classifier)
- `docs/output-catalog.md` - 3 install states gained the warning summary line (SEV-01); 2 new update states for the targeted/bulk decline (SEV-04)
- `tests/architecture/catalog-uat.test.ts` - flipped 3 install fixtures to `expectedSeverity: warning`; added 2 update decline fixtures
- `tests/orchestrators/plugin/install.test.ts` - PI-9/PI-11/PI-12/AS-7/WR-03 now assert warning + summary prefix; new companion-present info regression test
- `tests/orchestrators/plugin/update.test.ts` - PUP-6 asserts warning + summary prefix; new bulk-decline info test

## Decisions Made
- **The missing-companion flip is a cascade-level byte change, not purely per-row.** Stamping warning makes `notify()` prepend `A plugin operation needs attention.` ahead of the body (and, for the bulk SEV-04 case, flips the tally count). The plan framed SEV-01 as "row bytes do not change"; that holds at the per-ROW level, but the cascade summary line moves. Catalog blocks and producer byte-form tests were updated to match the true production output.
- **Shared helper over inline duplication.** `companionSeverity` lives next to `skipSeverity` so the install and update success arms share one classifier; this also kept `outcomeToCascadePluginMessage` under the cognitive-complexity cap.
- **SEV-04 is surgical to the `no longer installable` decline.** Absent-target (`not installed`/`not found`) stays error; idempotent stays info; every other non-idempotent skip keeps `skipSeverity`. No inference from cascade shape (D-69-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cognitive-complexity lint on outcomeToCascadePluginMessage**
- **Found during:** Task 1 (update.ts SEV-01 stamp)
- **Issue:** Inlining the missing-companion ternary pushed `outcomeToCascadePluginMessage` cognitive complexity from 15 to 18 (sonarjs cap 15).
- **Fix:** Extracted the shared `companionSeverity` helper into `shared/notify-reasons.ts`; both install.ts and update.ts call it. (SEV-04 likewise added `cascadeSkipSeverity` to keep the function under the cap.)
- **Files modified:** extensions/pi-claude-marketplace/shared/notify-reasons.ts, install.ts, update.ts
- **Verification:** `npx eslint` clean; `npm run typecheck` green.
- **Committed in:** `3b7b0ff4` (Task 1) and `5b54a46a` (Task 2)

### Interpretation / scope clarifications (documented, gate-verified)

**1. Task 1 touched files outside the plan's `<files>` list (docs/output-catalog.md, install.test.ts, update.test.ts)**
- **Found during:** Task 1.
- **Reason:** SEV-01 raising missing-companion installs/updates to warning changes the cascade byte form (adds the summary line), so the catalog blocks for the three missing-companion states MUST move in lockstep with the producer change or the catalog-uat byte gate goes RED. The producer conditioning tests (PI-9/11/12, AS-7, WR-03, PUP-6) assert severity/byte form and had to flip from info to warning. These are correct, necessary lockstep updates, not scope creep.
- **Files modified:** docs/output-catalog.md, tests/orchestrators/plugin/install.test.ts, tests/orchestrators/plugin/update.test.ts.

**2. SEV-01 missing-companion scope applied to install (clean + force) AND update success (assumption A1)**
- The RESEARCH A1 assumption (scope to install success clean+force and update success by symmetry) was honored as the plan directed; reinstall's manual-recovery warning is a separate, already-live clause and was left untouched.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking lint) + 2 documented interpretation/lockstep clarifications.
**Impact on plan:** No functional scope creep. The out-of-`<files>` edits are gate-mandated lockstep (catalog/byte-UAT) and conditioning-test updates that the plan's own acceptance criteria require.

## Issues Encountered
- **Known parallel flake (NOT a regression):** `tests/orchestrators/marketplace/autoupdate.test.ts` hit `ENOTEMPTY` once under the full parallel `npm run check` run (tmpdir cleanup race documented in 69-RESEARCH). Confirmed clean in isolation: `node --test tests/orchestrators/marketplace/autoupdate.test.ts` passes 20/20. All other 2459 tests pass.

## Next Phase Readiness
- SEV-01 and SEV-04 conditioning + stamping are in place. Remaining SEV items (SEV-03 autoupdate-takes-force, SEV-05 backfill reasons brace) are owned by the later Phase 69 plans. Phase 70 owns the byte-exact wording / final PRD reconcile of all severity-affected rows.
- Closed-set token counts unchanged at **22 / 17 / 7** (no new tokens; severity is metadata). No tripwire bump needed.

## Self-Check: PASSED

All modified source/doc/test files exist; both task commits (`3b7b0ff4`, `5b54a46a`) are present in git history.

---
*Phase: 69-force-path-severity*
*Completed: 2026-06-28*

---
phase: 06-assertion-and-module-refinement
plan: 48
subsystem: plugin-orchestration
tags: [typescript, reinstall, hub-retirement, direct-coverage, architecture-gates]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Public reinstall flow owner and transition-time caller/gate coverage from Plans 46-47
provides:
  - Direct reinstall flow ownership with no compatibility facade or legacy hub
  - READY export/caller/dependency ledger backed by fresh CodeGraph evidence
  - Complete reinstall owner proof with exact transaction, state, path, order, notification, and redaction contracts
  - Generic Phase 06 hub-ledger coverage rotated to the live list hub and legacy test
affects: [plugin-reinstall, phase-06-list-refinement, architecture-gates, direct-coverage]
plan_head_before: aff70a721bc7d23bbf4b17296a526ba7c686212d
actuals:
  tokens: 175274.5
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - retire a legacy hub only after a fresh fail-closed ownership ledger reports READY
    - bind flow orchestration directly to leaf owners and prove every surviving source module at 100 percent direct coverage
    - rotate generic lifecycle fixtures to a genuine non-deleted legacy pair before deleting the active fixture
key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-reinstall-PREEDIT.md
    - .planning/phases/06-assertion-and-module-refinement/06-48-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - scripts/check-phase-06-hub-ledger.mjs
    - tests/scripts/check-phase-06-hub-ledger.test.ts
    - docs/plugin-enablement.md
key-decisions:
  - "Delete reinstall.ts and reinstall.test.ts only after the fresh ledger maps every export, caller, owner test, gate, document, completeness check, and dependency edge with no cycle."
  - "Make reinstall-flow.ts the sole public and behavior-bearing owner; do not retain a forwarding facade or compatibility re-export."
  - "Keep the generic lifecycle checker live by rotating its real legacy fixture from reinstall to list, the next scheduled hub family in Plans 49-51."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Reinstall resolves through five named direct-tested owner pairs with the flow owner preserving exact public outcomes and side-effect order.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/reinstall-targets.test.ts, reinstall-clone-probe.test.ts, reinstall-replace.test.ts, reinstall-record.test.ts, and reinstall-flow.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts and reinstall-record.ts
        status: pass
    human_judgment: false
  - id: D2
    description: The reinstall hub and legacy test are absent, every stale path scan is empty, and the generic ledger checker remains attached to a live legacy pair.
    requirement: TREF-09
    verification:
      - kind: integration
        ref: .planning/phases/06-assertion-and-module-refinement/06-reinstall-PREEDIT.md and scripts/check-phase-06-hub-ledger.mjs
        status: pass
      - kind: other
        ref: npm run typecheck && npm run test:corresponding && npm run fallow
        status: pass
    human_judgment: false
duration: 23min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 48: Reinstall Hub Retirement Summary

**The reinstall hub and its legacy test are gone; `reinstall-flow.ts` now owns the complete public flow directly, backed by five owner suites, exact direct coverage, and a fresh fail-closed READY ledger.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-09T20:01:56Z
- **Completed:** 2026-09-09T20:25:02Z
- **Tasks:** 3
- **Task commits:** 3
- **Files changed by task commits:** 14
- **Realized diff scale:** 175,274.5 estimate tokens (701,098 diff characters / 4)

## Accomplishments

- Consolidated every remaining reinstall behavior and end-to-end assertion into `reinstall-flow.test.ts`: 112 migrated behavior cases plus two flow-owner cases pass without duplicate test titles.
- Produced fresh CodeGraph evidence and a fail-closed READY ledger covering all four legacy exports, the sole production caller, five owner suites, four architecture gates, documentation, completeness checks, and dependency edges with no cycle.
- Moved the retained sequencing implementation into `reinstall-flow.ts`, bound it directly to target, clone-probe, replacement, and record owners, and preserved the existing public API without a facade.
- Deleted `reinstall.ts` and `reinstall.test.ts` atomically, then proved both paths absent and all stale-path scans empty.
- Rotated the generic Phase 06 lifecycle checker and fixture to the genuine `list.ts` / `list.test.ts` legacy pair scheduled for the next refinement wave.
- Preserved exact transaction, filesystem, installed-state, notification-order, and redaction behavior across 11 affected suites.

## Task Commits

1. **Task 1: Repoint docs and consolidate reinstall flow proof** - `f4604d5b` (test)
2. **Task 2: Authorize hub retirement and rotate the generic lifecycle fixture** - `2ab27302` (test)
3. **Task 3: Delete the hub/test and establish direct flow ownership** - `cb8f352d` (refactor)

## Files Created/Modified

- `.planning/phases/06-assertion-and-module-refinement/06-reinstall-PREEDIT.md` - Records the fresh export/caller/dependency trace and READY deletion decision.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts` - Owns the public factories and the complete reinstall transaction flow directly.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts` - Uses precise input-to-outcome overloads for direct flow binding.
- `tests/orchestrators/plugin/reinstall-flow.test.ts` - Holds the complete surviving behavior and flow proof.
- `scripts/check-phase-06-hub-ledger.mjs` and `tests/scripts/check-phase-06-hub-ledger.test.ts` - Keep the generic lifecycle gate live on the list legacy pair.
- `docs/plugin-enablement.md` - Names `reinstall-flow.ts` as the reinstall owner.
- Four architecture suites and the edge handler suite - Point scanner scope and ownership notes at the surviving owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` and `tests/orchestrators/plugin/reinstall.test.ts` - Deleted intentionally with no replacement facade.

## Decisions Made

- Treat READY as evidence, not an assertion. The hub remained untouched until the checker consumed the fresh CodeGraph trace and verified every ledger category.
- Absorb sequencing into the already-public flow owner. The final module exports only the intended public reinstall API; internal orchestration types and functions remain private.
- Rotate the generic checker before deletion. This prevents the lifecycle mechanics from disappearing when their previous real-world fixture is retired.
- Keep record outcomes type-correlated. Precise overloads express the existing runtime relationship and remove a defensive branch that became impossible after direct owner binding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Rotated the generic lifecycle fixture before deletion**

- **Found during:** Task 2
- **Issue:** Deleting reinstall would otherwise leave the generic checker fixture attached to a removed hub/test pair.
- **Fix:** Repointed the checker registry and owner test to the live list hub/test pair planned for Plans 49-51.
- **Files modified:** `scripts/check-phase-06-hub-ledger.mjs`, `tests/scripts/check-phase-06-hub-ledger.test.ts`
- **Commit:** `2ab27302`

**2. [Rule 1 - Bug] Removed an impossible outcome branch exposed by direct coverage**

- **Found during:** Task 3 direct-coverage verification
- **Issue:** After binding the private flow directly to `recordReinstallOutcome`, a defensive union branch could not be reached and prevented truthful 100 percent branch coverage.
- **Fix:** Added precise overloads that preserve the existing input-to-outcome runtime contract and removed only the now-impossible branch.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts`
- **Commit:** `cb8f352d`

**3. [Rule 3 - Blocking issue] Removed obsolete test-helper exports and corrected import order**

- **Found during:** Task 3 Fallow and lint verification
- **Issue:** Test consolidation left helper exports with no consumers, and the merged direct-owner imports initially violated the enforced import grouping.
- **Fix:** Made the helpers local to their surviving suite and ordered imports according to the project style rules.
- **Files modified:** `tests/orchestrators/plugin/reinstall-flow.test.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts`
- **Commit:** `cb8f352d`

The optional broken-windows append could not run because the pre-existing rendered table in `.planning/WINDOWS.md` disagrees with its fenced JSON source for rows 9 and 30. This plan did not alter that unrelated ledger drift.

## Verification

- Five direct owner suites: **5/5 files pass; 114/114 reinstall flow tests pass**.
- All affected checker, architecture, edge, and owner suites: **11/11 files pass**.
- Fresh PRE-EDIT checker: **READY**, with non-empty CodeGraph evidence and no unmapped owner, duplicate owner, stale caller, missing owner pair, or cycle.
- `reinstall-flow.ts` direct coverage: **899/899 lines, 18/18 functions, 100 percent branches**.
- `reinstall-record.ts` direct coverage: **197/197 lines, 11/11 functions, 46/46 branches**.
- `npm run typecheck`: pass.
- `npm run lint`: pass with zero warnings.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issue.
- Generic hub-ledger checker owner test: pass on the rotated list fixture.
- Scoped Prettier over every changed TypeScript, JavaScript, Markdown, and documentation file: pass.
- Both deleted paths are absent; exact stale-path scans across `extensions`, `tests`, `scripts`, `docs`, and `eslint.config.js` return zero matches.
- `git diff --check`: pass.

## Issues Encountered

- The repository-wide formatting command is not a truthful Plan 48 gate because it includes the preserved unrelated untracked `.mcp.json`; scoped formatting over all Plan 48 files passes.
- The full unit command retains the known pre-existing `tests/architecture/revalidation.test.ts` Phase 1 sealed-expectation mismatch for legitimate TREF-04 through TREF-09 planning. Plan 48 does not modify that test or its sealed contract.
- The linked worktree stores Git metadata outside the sandbox writable root, so atomic commits used the already-authorized external Git permission.
- Existing unrelated configuration, Phase 1 review artifacts, `.codegraph`, `.mcp.json`, and `AGENTS.md` were preserved unchanged and excluded from every task commit.

## Known Stubs

None. The `"(reinstall)"` placeholder string is the intentional public name for a synthetic failure row when no target can be derived; it is exercised by exact outcome tests and is not an unwired UI or test stub.

## Threat Flags

None. The refactor preserves the existing validated-input, transaction, filesystem, notification, and redaction trust boundaries and adds no endpoint, authentication path, schema, or new file-access capability.

## User Setup Required

None.

## Next Phase Readiness

- Reinstall now has five surviving direct owner pairs and no legacy hub, test, facade, or stale path.
- The generic lifecycle checker remains live on the list hub/test pair, ready for Plans 49-51 to repeat the evidence-backed retirement sequence.
- All required type, pairing, dead-code, duplication, lint, direct-coverage, and focused behavior gates are green.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The summary, READY ledger, flow owner, record owner, and consolidated owner test exist; both legacy paths are absent; all three task commits resolve from the persisted plan base; the measured task-commit count is three; and every required plan gate passes.

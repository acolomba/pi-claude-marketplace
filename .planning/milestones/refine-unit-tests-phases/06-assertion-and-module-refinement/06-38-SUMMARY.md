---
phase: 06-assertion-and-module-refinement
plan: 38
subsystem: plugin-orchestration
tags: [typescript, install, ownership, hub-removal, architecture-gates]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Five direct install owners and migrated callers from Plans 34-37
provides:
  - Complete READY ownership ledger for the retired install hub and test
  - Guard-free install ledger implementation private to the direct outcome owner
  - Zero live legacy install-orchestrator path references across required roots
affects: [plugin-install, enable-disable, reconcile, architecture-gates, phase-06-hub-closure]
plan_head_before: 8555953147c55e3eab15f2b3ccedbbc7deed52c6
actuals:
  tokens: 38949
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns:
    - private ledger executor behind a narrow public outcome boundary
    - READY-gated atomic hub and legacy-test deletion
    - generic lifecycle fixture rotation to the next live hub pair
key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-install-PREEDIT.md
    - .planning/phases/06-assertion-and-module-refinement/06-38-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - scripts/check-phase-06-hub-ledger.mjs
    - tests/scripts/check-phase-06-hub-ledger.test.ts
    - tests/architecture/hooks-lifecycle.test.ts
  deleted:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
key-decisions:
  - "The mutable ledger context, context-bearing result, and executeInstallLedger remain private details of install-outcome.ts; callers retain only runInstallLedger and its readonly summary."
  - "The complete Plan 06-01 command-flow and notification proof remains in install-flow.test.ts, while the former marketplace-absent legacy case exists once in install-outcome.test.ts."
  - "The generic hub-ledger fixture advances to update.ts/update.test.ts, the next live Phase 06 lifecycle pair."
patterns-established:
  - "Final hub retirement: prove a READY inverse ledger, rotate generic fixtures, migrate every gate and prose reference, then delete source/test together without a facade."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Five direct install owners preserve clone, preference, disabled cascade, ledger outcome, and complete transaction-flow behavior.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: node --test tests/orchestrators/plugin/install-clone-probe.test.ts tests/orchestrators/plugin/install-declared-enabled.test.ts tests/orchestrators/plugin/install-disable-cascade.test.ts tests/orchestrators/plugin/install-outcome.test.ts tests/orchestrators/plugin/install-flow.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Install hub and legacy test are absent, every scanner points at a direct owner, and the required tracked-root stale-path inventory is empty.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: npm run test:corresponding and exact git-grep stale-path scan
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 38: Install Hub Retirement Summary

**The install lifecycle now has five direct owners, with its guard-free ledger private to `install-outcome.ts`, its complete flow proof preserved, and no legacy hub, test, facade, or live path reference remaining.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-09T16:04:47Z
- **Completed:** 2026-09-09T16:23:02Z
- **Tasks:** 3
- **Files changed:** 34 before this summary and normal planning-state updates

## Accomplishments

- Consolidated the final install ownership proof: the former legacy marketplace-absent case now exists once under `install-outcome.test.ts`, while the sole complete end-to-end transaction and exact Plan 06-01 notification-array proof remains in `install-flow.test.ts`.
- Captured fresh 514-line, 25,027-byte CodeGraph evidence and a fail-closed `Status: READY` PRE-EDIT ledger mapping all three hub exports, responsibilities, callers, five test owners, scanners, documents, completeness invariants, dependency edges, and the constructed hooks-lifecycle path.
- Merged the guard-free phase ledger into `install-outcome.ts`, made `InstallLedgerContext`, `InstallLedgerContextResult`, and `executeInstallLedger` private, and deleted `install.ts` plus `install.test.ts` in one atomic commit.
- Rotated both the generic hub-ledger inventory and its fail-closed PRE-EDIT fixture to the next real lifecycle pair, `update.ts` and `update.test.ts`.
- Repointed every live exact or prose ownership reference discovered under the authorized Phase 06 roots; the required exact stale-path scan returns zero.

## Task Commits

1. **Task 1: Consolidate final lifecycle test ownership** - `94398612` (test)
2. **Task 2: Record READY PRE-EDIT evidence and rotate checker fixture** - `af7bf751` (docs)
3. **Task 3: Delete the install hub/test and move the ledger to its direct owner** - `a5a21ed0` (refactor)
4. **Authorized completeness expansion: repoint the full live documentation inventory** - `597ed825` (docs)

The deletion commit is `a5a21ed0`; it removes both legacy files and introduces no replacement facade or re-export.

## Ownership Result

| Responsibility                                                                           | Direct owner                  | Direct test                        |
| ---------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------- |
| clone cache seam and probe                                                               | `install-clone-probe.ts`      | `install-clone-probe.test.ts`      |
| declared-enabled precedence                                                              | `install-declared-enabled.ts` | `install-declared-enabled.test.ts` |
| disabled cascade and hooks routing                                                       | `install-disable-cascade.ts`  | `install-disable-cascade.test.ts`  |
| guard-free ledger, public result, and installed outcome                                  | `install-outcome.ts`          | `install-outcome.test.ts`          |
| options, transaction composition, factories, state/tree effects, and exact notifications | `install-flow.ts`             | `install-flow.test.ts`             |

The dependency direction is one-way: command callers consume `install-flow.ts`; flow and enable/disable consume `install-outcome.ts`; outcome consumes lower-level bridge, domain, persistence, transaction, and clone-probe owners. No owner imports the flow or command caller back.

## Verification

- Task 1 lifecycle suites: pass, 3/3 (`install-flow`, `reinstall`, `update`).
- Five direct owner suites: pass, 5/5.
- Lifecycle consumers and migrated architecture/checker gates: pass, 11/11 (`reinstall`, `update`, `enable-disable`, import execute, reconcile apply, edge install, four architecture suites, and hub-ledger checker).
- Fresh PRE-EDIT verifier: pass with exact `Status: READY` and the required CodeGraph evidence.
- Legacy source and test: absent; exact tracked-root `orchestrators/plugin/install.ts` scan: zero.
- `npm run typecheck`: pass.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no dead-code, health-threshold, or duplicate-threshold issue.
- `npm run lint`: pass; the later documentation expansion also passes scoped ESLint.
- Focused Prettier check over every Plan 38 source, test, gate, and scanner file: pass.
- Repository-wide `npm run format:check`: reports only the pre-existing untracked `.mcp.json`; it remains untouched.

### Coverage measurements

- `install-clone-probe.ts`: 100% branches (14/14), functions (1/1), and lines (87/87).
- `install-declared-enabled.ts`: 100% branches (11/11), functions (2/2), and lines (28/28).
- `install-disable-cascade.ts`: 100% branches (21/21), functions (9/9), and lines (186/186).
- `install-flow.ts`: 100% branches (89/89), functions (18/18), and lines (1,127/1,127).
- Five-owner aggregate for `install-outcome.ts`: 99.42% lines, 96.67% branches, and 100% functions. The only uncovered lines are the three optional cleanup-leak folds after successful skills, commands, and agents bridge commits (lines 668-669, 711-712, and 756-757).
- The strict direct-pair-only diagnostic for `install-outcome.ts` measures 92.73% lines (956/1,031), 72.29% branches (60/83), and 81.48% functions (22/27), because transaction behavior remains intentionally consolidated in the single `install-flow.test.ts` end-to-end proof instead of duplicated in the outcome suite.

## Decisions Made

- Kept the public outcome types and `runInstallLedger` stable while making the mutable execution details private to the same file.
- Preserved the literal phase array and every Plan 06-01 exact notification array; no flow case was copied into another suite.
- Advanced the generic checker to update rather than retaining a completed install pair in its live-hub inventory.

## Deviations from Plan

### Authorized Scope Expansions

**1. [Rule 2 - Completeness] Rotated the generic hub-ledger fixture before deletion**

- **Found during:** Task 2
- **Issue:** The checker and companion test still used the install pair as their live generic lifecycle fixture.
- **Fix:** Removed the retired install hub from `LEGACY_HUBS` and changed the PRE-EDIT fixture, destinations, and negative duplicate-owner case to the exact Plan 06-39 update pair.
- **Files modified:** `scripts/check-phase-06-hub-ledger.mjs`, `tests/scripts/check-phase-06-hub-ledger.test.ts`
- **Commit:** `af7bf751`

**2. [Rule 2 - Completeness] Repointed a constructed-path architecture gate**

- **Found during:** Task 3
- **Issue:** `hooks-lifecycle.test.ts` assembled the legacy filename with `path.join`, so the exact literal scan could not detect it.
- **Fix:** Moved the cache/rebuild source probe to `install-flow.ts` and recorded it in the PRE-EDIT ledger.
- **Files modified:** `tests/architecture/hooks-lifecycle.test.ts`, `06-install-PREEDIT.md`
- **Commit:** `a5a21ed0`, `597ed825`

**3. [Rule 2 - Completeness] Migrated the full live prose ownership inventory**

- **Found during:** Final stale-reference audit
- **Issue:** Source comments and two current documents retained bare legacy owner names even though they did not match the exact module-path scan.
- **Fix:** Repointed each responsibility to the direct flow, outcome, clone-probe, preference, or messaging owner and extended the PRE-EDIT ledger with the complete inventory.
- **Files modified:** Phase 06 orchestration comments, `docs/competitive-analysis/pi-plugins.md`, `docs/prd/pi-claude-marketplace-prd.md`, and one owner-test comment
- **Commit:** `597ed825`

## Issues Encountered

- Git metadata for this linked worktree resides outside the workspace sandbox; approved elevated staging and commits succeeded after validating the spawn toplevel and protected-branch guard.
- Repository-wide formatting remains red only for the known unrelated untracked `.mcp.json`. All Plan 38 files pass Prettier.
- The supplemental direct-pair-only outcome coverage diagnostic is below the strict 100% threshold after the private ledger consolidation; the required five-owner suites and aggregate coverage measurement pass, and no test was skipped.

## Known Stubs

None.

## Threat Review

- Clone/path/state validation, the literal transaction phase ordering, rollback formatting, and the sole notification boundary moved without semantic changes.
- No endpoint, schema, authentication path, file-access pattern, or new trust boundary was introduced.
- Exact Plan 06-01 notification arrays and redaction paths remain exercised by `install-flow.test.ts`.

## User Setup Required

None.

## Next Phase Readiness

Plan 06-39 can begin the update-family split using the rotated generic PRE-EDIT fixture. The install hub and test are absent, every direct owner pair exists, all live callers and gates point to named owners, and the tracked-root legacy-path inventory is empty.

## Self-Check: PASSED

- The PRE-EDIT ledger, summary, and both retained install owners exist.
- Task commits `94398612`, `af7bf751`, `a5a21ed0`, and `597ed825` exist in history.
- The legacy source and test are absent, and the exact required-root stale-path scan is empty.
- No stub, skipped test, unrun planned verification, or new threat surface was introduced.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

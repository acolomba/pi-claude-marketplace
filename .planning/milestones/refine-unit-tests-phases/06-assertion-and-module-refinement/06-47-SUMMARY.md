---
phase: 06-assertion-and-module-refinement
plan: 47
subsystem: plugin-orchestration
tags: [typescript, reinstall, architecture-gates, caller-migration, security]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Public reinstall flow owner and caller migration from Plan 46
provides:
  - Lifecycle enablement drift coverage for the public reinstall flow and retained sequencer
  - No-network structural coverage for both reinstall owners during hub retirement
  - Verified direct caller migration across architecture, edge, integration, and orchestrator suites
affects: [plugin-reinstall, phase-06-hub-retirement, architecture-gates]
plan_head_before: a45a907286c5f5d2cc1be0d861e2387a29333d31
actuals:
  tokens: 1137
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - transition gates cover both a new public flow owner and its retained behavior owner
    - scanner allowlists stay attached to the file that writes the behavior they exempt
key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-47-SUMMARY.md
  modified:
    - tests/architecture/manifest-lookup-drift.test.ts
    - tests/architecture/no-lifecycle-default-enabled-read.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
key-decisions:
  - "Gate both reinstall-flow.ts and the retained reinstall.ts sequencer during the ownership transition so no temporary coverage gap exists."
  - "Keep the manifest raw-lookup exemption on reinstall.ts because that file still writes the lookup; an unused reinstall-flow.ts exemption would weaken the scanner and fail its stale-entry proof."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Public reinstall callers resolve through reinstall-flow.ts while lifecycle and no-network architecture gates cover the new owner.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: tests/architecture/cross-op-convergence.test.ts, tests/architecture/no-lifecycle-default-enabled-read.test.ts, and tests/architecture/no-orchestrator-network.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck && npm run test:corresponding && npm run fallow
        status: pass
    human_judgment: false
  - id: D2
    description: Edge, transaction lifecycle, and enable-disable consumers preserve their exact reinstall outcomes after the owner move.
    requirement: TREF-09
    verification:
      - kind: integration
        ref: tests/edge/handlers/plugin/reinstall.test.ts, tests/integration/transaction-lifecycle-cascade.test.ts, and tests/orchestrators/plugin/enable-disable.test.ts
        status: pass
      - kind: integration
        ref: npm run test:integration
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 47: Reinstall Caller and Gate Migration Summary

**Reinstall callers now resolve through the direct-tested flow owner, while transition-time architecture gates cover both that owner and the retained sequencer without weakening scanner truth.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-09T19:46:36Z
- **Completed:** 2026-09-09T19:58:06Z
- **Tasks:** 2
- **Task commits:** 2
- **Files changed by task commits:** 3
- **Realized diff scale:** 1,137 estimate tokens (4,546 diff characters / 4, rounded up)

## Accomplishments

- Added `reinstall-flow.ts` to the lifecycle enablement guard while retaining coverage for `reinstall.ts` until its sequencing behavior moves.
- Added both transition-time reinstall owners to the no-network structural gate, preserving the cached-manifest-only contract through hub retirement.
- Kept the manifest raw-lookup allowlist entry on the actual writer and clarified that `reinstall.ts` remains the behavior-bearing sequencer.
- Verified the four public test callers already migrated atomically by Plan 46, with no import left on the old public owner.
- Preserved the exact cross-operation, edge, transaction, enable-disable, manifest, lifecycle, and network assertions.

## Task Commits

1. **Task 1: Repoint reinstall architecture gates** - `11ee1e1f` (test)
2. **Task 2: Guard reinstall flow network boundary** - `c3f7b807` (test)

## Files Created/Modified

- `tests/architecture/manifest-lookup-drift.test.ts` - Names `reinstall.ts` as the retained sequencer that still owns the raw manifest lookup.
- `tests/architecture/no-lifecycle-default-enabled-read.test.ts` - Guards both the public reinstall flow and retained sequencer against declared-enablement reads.
- `tests/architecture/no-orchestrator-network.test.ts` - Guards both reinstall owners against direct git or refresh surfaces.
- `tests/architecture/cross-op-convergence.test.ts`, `tests/edge/handlers/plugin/reinstall.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, and `tests/orchestrators/plugin/enable-disable.test.ts` - Verified predecessor-owned imports already point directly to `reinstall-flow.ts`.

## Decisions Made

- Cover both owners during the transition. Removing `reinstall.ts` from negative gates before Plan 48 deletes or absorbs it would create a real blind spot.
- Keep scanner exceptions behavioral. `manifest-lookup-drift.test.ts` rejects unused exemptions, so moving the entry before moving the raw lookup would make the gate false and red.
- Treat Plan 46's atomic caller migration as completed dependency work. Plan 47 verifies those callers instead of adding churn or compatibility exports.

## Deviations from Plan

None. Plan 46 completed four overlapping caller imports atomically with the public owner move; this plan verified them and completed the remaining scanner coverage.

## Verification

- Task 1 architecture suites: **3/3 files pass**.
- Task 2 security, edge, transaction, and orchestrator suites: **4/4 files pass**.
- `npm run typecheck`: pass.
- `npm run lint`: pass with zero warnings.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issue.
- `npm run test:corresponding:negative`: pass outside the sandbox.
- `npm run test:coverage:direct:negative`: pass outside the sandbox.
- `npm run test:integration`: **32/32 tests pass** outside the sandbox.
- Scoped Prettier over all three changed TypeScript files: pass.
- `git diff --check`: pass.
- `npm run check`: its Plan 47 portions pass, but the command stops at the known unrelated untracked `.mcp.json` formatting issue.
- `npm test`: all failures are confined to the pre-existing `tests/architecture/revalidation.test.ts` sealed Phase 1 expectations, which do not yet include legitimate TREF-04 through TREF-09 route changes.

## Issues Encountered

- The repository-wide formatting gate sees the preserved untracked `.mcp.json`; scoped formatting over every Plan 47 file passes.
- The full unit suite repeats the known Phase 1 revalidation-fixture mismatch across its negative-control cases. Plan 47 does not modify that test or its planning contract.
- The linked worktree keeps Git metadata outside the sandbox writable root, so atomic commits and child-process negative controls ran with the required external permission.
- Existing unrelated local configuration, Phase 1 review artifacts, `.codegraph`, and `AGENTS.md` were preserved unchanged and excluded from every commit.

## Known Stubs

None. The empty arrays in `manifest-lookup-drift.test.ts` are populated offender accumulators, not rendered or production placeholders.

## Threat Flags

None. The plan changes test scanners only and adds no endpoint, authentication path, filesystem trust boundary, schema change, or notification capability.

## User Setup Required

None.

## Next Phase Readiness

- Every public reinstall caller in Plan 47 resolves through `reinstall-flow.ts`.
- The lifecycle and no-network gates already cover the destination owner before Plan 48 moves the remaining sequencer behavior.
- The manifest scanner remains exact and will require an atomic path update when the raw lookup moves out of `reinstall.ts`.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The summary and three modified architecture gates exist; both task commits resolve from the persisted plan base; the measured task-commit count is two; all focused and required plan gates pass; and no Plan 47 public caller imports the retained hub.

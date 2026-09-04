---
phase: 112-hook-runtime
plan: 06
subsystem: hook-runtime
tags: [typescript, node-test, event-adapters, mutation-whitelist, session-context, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: HookExecResult exhaustiveness and routing-state lifecycle contracts from Plans 112-08 and 112-25
provides:
  - Complete direct ownership of tool-call, tool-result, input, and observation adapter outcomes
  - Exact tool-result mutation whitelist and SessionStart provenance evidence
  - Narrower production surface with the unused legacy observation export and duplicate adapter suite removed
affects:
  - 112-07 event-router lifecycle ownership
  - 112-14 hook barrel ownership
  - MOD-05 hook-runtime verification
actuals:
  tokens: 13789
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Complete event objects with independently authored whole-result assertions
    - Public routing lifecycle setup and cleanup for pending SessionStart context
    - Semantic debug diagnostics observed through case-local console boundaries
key-files:
  created:
    - tests/bridges/hooks/event-adapters.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - tests/architecture/hooks-adapters.test.ts
key-decisions:
  - Removed the legacy adaptObservationResult export after CodeGraph and historical call-site proof found no production caller.
  - Consolidated every direct adapter contract and the duplicate architecture suite into the mirrored event-adapters owner.
  - Left the mixed SessionStart additional-context supplemental unchanged for Plan 112-07 to remove after all dependent evidence is absorbed.
patterns-established:
  - Adapter owners assert complete host events before and after mutation so routing identity and optional-key absence stay explicit.
  - Observation adapter cases use public routing-state lifecycle operations and case-local cleanup instead of private readers or reset seams.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: The event-adapters owner proves every noop, block, mutate, stop, object-guard, optional-key, and exhaustive-default partition for all public adapters.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/event-adapters.test.ts#complete adapter outcome matrix
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- tests/bridges/hooks/event-adapters.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Tool-result mutations accept only array content and boolean isError, preserve routing and tool identity, and SessionStart capture retains ordered marketplace and plugin provenance.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/event-adapters.test.ts#applies only whitelisted tool-result fields
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/event-adapters.test.ts#captures ordered SessionStart context with exact plugin provenance
        status: pass
      - kind: integration
        ref: tests/bridges/hooks/session-start-additional-context.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: The unused legacy observation export and duplicate architecture suite are absent without adding a replacement symbol, test seam, skip, or coverage exception.
    requirement: MOD-05
    verification:
      - kind: other
        ref: codegraph explore adaptObservationResult and production callers
        status: pass
      - kind: other
        ref: test ! -e tests/architecture/hooks-adapters.test.ts
        status: pass
    human_judgment: false
duration: 26 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 06: Event adapter summary

**The canonical owner now proves every event-adapter result and mutation boundary at 100% direct coverage while the unused legacy export and duplicate suite are gone.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-31T10:12:32Z
- **Completed:** 2026-08-31T10:38:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added complete direct evidence for non-object drops, tool-call object patches, every adapter result arm, optional-key absence, wrong-type omission, diagnostics, and exhaustive defaults.
- Locked tool-result mutation to array `content` and boolean `isError`, with whole-event assertions proving discriminator, tool name, call identity, routing fields, source inputs, and unrelated fields remain exact.
- Proved ordered SessionStart additional-context capture with scope, marketplace, and plugin provenance while SessionEnd, PreCompact, and PostCompact mutations drop without pending-state leakage.
- Removed the CodeGraph-confirmed unused `adaptObservationResult` export and retired the duplicate `hooks-adapters` supplemental after consolidating its direct evidence.

## Task Commits

1. **Task 1: Prove one whitelisted tool-result mutation** - `01f476e8`
2. **Task 2: Complete result arms, capture lifecycle, and diagnostics** - `b9ed5817`
3. **Task 2 follow-up: Retire duplicate adapter supplemental** - `8a11635b`

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` - Removes the unused legacy observation adapter and keeps the production-dispatched event-aware adapter as the sole observation surface.
- `tests/bridges/hooks/event-adapters.test.ts` - Canonical direct owner for complete guards, outcomes, whitelists, pending-context provenance, observation drops, and diagnostics.
- `tests/architecture/hooks-adapters.test.ts` - Deleted after all distinct direct adapter evidence moved into the canonical owner.

## Decisions Made

- Removed `adaptObservationResult` only after live CodeGraph inspection and a historical production-tree call-site search confirmed that dispatch calls `adaptObservationResultForEvent` and no production code calls the legacy shim.
- Consolidated direct adapter authority in the mirrored owner. The owner calls public exports with complete, case-local events and independently authored results rather than relying on the architecture supplemental.
- Used the existing routing-state lifecycle for pending SessionStart setup, observation, and cleanup; no reader, reset seam, mutable cell, or replacement production export was added.
- Left `tests/bridges/hooks/session-start-additional-context.test.ts` byte-identical. It remains the mixed cross-module carrier until Plan 112-07 absorbs its remaining drain and event-router evidence.
- Kept `MOD-05` pending in `.planning/REQUIREMENTS.md` until all Phase 112 owners complete.

## Validation

- `node --test tests/bridges/hooks/event-adapters.test.ts` passed with zero failures, skips, or todos.
- `npm run test:coverage:direct -- tests/bridges/hooks/event-adapters.test.ts` passed with 59/59 branches, 7/7 functions, and 352/352 lines for `event-adapters.ts`.
- The unchanged `tests/bridges/hooks/session-start-additional-context.test.ts` passed with zero failures, skips, or todos.
- `test ! -e tests/architecture/hooks-adapters.test.ts`, `npm run typecheck`, targeted ESLint, targeted Prettier, and `git diff --check` passed.
- Static export comparison found exactly one production-surface change: `adaptObservationResult` is absent, while the five planned current exports remain and no replacement export was added.
- The owner contains no skip, todo, or only directive and uses lowercase runtime phase comments with combined `act & assert` only for single rejection expressions.
- Commits `01f476e8`, `b9ed5817`, and `8a11635b` form a contiguous sequence and collectively modify exactly the planned production source, direct owner, and deleted duplicate supplemental.

## Deviations from Plan

None - the plan executed within the declared production, owner, and supplemental scope.

## Issues Encountered

The duplicate supplemental deletion was omitted from the first Task 2 commit. The orchestrator captured the already-verified deletion in scoped follow-up commit `8a11635b`; no production or owner-test content changed in that follow-up.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Empty strings, absent optional keys, non-object mutations, and empty pending state are explicit contract inputs or outcomes.

## Security Review

The direct owner closes T-112-06 by proving that untrusted hook output can update only the documented object input or tool-result `content` and `isError` slots. Complete event comparisons show routing discriminators, tool identity, call identity, and unrelated host fields cannot be overwritten. This plan adds no endpoint, state reader, test seam, public mutation bypass, or trust boundary.

## Next Phase Readiness

Plan 112-07 can consume the proven event-aware SessionStart capture surface, and Plan 112-14 can prove the narrowed hook barrel. The adapter pair is ready for phase-wide MOD-05 verification with no duplicate adapter carrier remaining.

## Self-Check: PASSED

- The production source, canonical owner, plan, and summary exist; the duplicate supplemental and legacy export are absent.
- Task commits `01f476e8`, `b9ed5817`, and `8a11635b` exist in an exact contiguous sequence with the planned three-file scope.
- Owner, unchanged SessionStart supplemental, direct coverage, typecheck, targeted lint, targeted format, diff, export, skip, and coverage-metadata checks pass.
- `.planning/REQUIREMENTS.md` was not changed, and `MOD-05` remains pending until Phase 112 completes.

---

*Phase: 112-hook-runtime*
*Completed: 2026-08-31*

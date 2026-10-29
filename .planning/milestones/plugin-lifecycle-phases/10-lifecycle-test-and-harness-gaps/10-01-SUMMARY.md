---
phase: 10-lifecycle-test-and-harness-gaps
plan: "01"
subsystem: testing
tags: [cucumber, harness, lifecycle, node-test]
requires:
  - phase: 09-install-flow-lifecycle-coverage
    provides: lifecycle scenarios and conflict fixtures hardened here
provides:
  - Fail-closed clone, data-entry, and run-token projections
  - Event-driven browse tests and shared list-filter setup
  - Marketplace fixtures that write manifests before records
affects: [phase-10-lifecycle-tests, plugin-lifecycle-verification]
actuals:
  tokens: 16708
  tasks: 3
  commits: 4
plan_head_before: 7e2a3ca78a36f8e69f7e25276fb45ecbd6793b8f
plan_head_after: 5a65b567
tech-stack:
  added: []
  patterns: [event barriers for asynchronous UI tests, manifest-first marketplace seeds]
key-files:
  created:
    - features/plugin/list-filters.feature
    - test/orchestrators/plugin/marketplace-seed.ts
  modified:
    - features/lib/git-clones.ts
    - features/lib/run-tokens.ts
    - features/step_definitions/plugin/installation.steps.ts
    - test/edge/handlers/plugin/browse.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
key-decisions:
  - "Represent directories with a trailing slash and symlinks as -> target in complete file tables."
  - "Resolve browse barriers on the post-load render request instead of elapsed time."
patterns-established:
  - "A test marketplace record is returned only after its marketplace and plugin manifests exist."
requirements-completed: [TST-02, TST-03]
coverage:
  - id: D1
    description: Harness projections expose hidden clone and data entries and reject unknown tokens.
    requirement: TST-02
    verification:
      - kind: integration
        ref: "npm run check:features and features/plugin/git-source.feature#Installation records expose git revisions"
        status: pass
    human_judgment: false
  - id: D2
    description: Browse tests use event barriers and list filters share one Given-only fixture.
    requirement: TST-02
    verification:
      - kind: unit
        ref: "test/edge/handlers/plugin/browse.test.ts"
        status: pass
      - kind: integration
        ref: "features/plugin/install-rollback.feature and features/plugin/list-filters.feature"
        status: pass
    human_judgment: false
  - id: D3
    description: Install and reinstall conflict records have loadable manifests.
    requirement: TST-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow.test.ts and test/orchestrators/plugin/reinstall-flow.test.ts"
        status: pass
    human_judgment: false
duration: 55min
completed: 2026-10-27
status: complete
---

# Phase 10 Plan 01: Harness Integrity Summary

**Lifecycle tests now fail closed on hidden filesystem state, synchronize browse loading by event, and seed every recorded marketplace with loadable manifests.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-10-27T21:52:00Z
- **Completed:** 2026-10-27T22:47:02Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Clone projections reject unfinished staging and non-git source entries, expose mirror revisions, and data tables include directories and symlinks.
- List-filter scenarios share one Given-only Background, while browse tests wait for loading to request its completed render.
- Install and reinstall conflict fixtures share a manifest-first marketplace record seeder.

## Task Commits

1. **Task 1: Make one harness projection fail closed end to end** - `d7fc278c`
2. **Task 2: Remove fixture duplication and fixed browse waits** - `94da3ad0`
3. **Task 3: Seed marketplace records with their manifests** - `5a65b567`

The measured plan ledger also includes the concurrently written planning-record commit `6694856c`.

## Files Created/Modified

- `features/lib/git-clones.ts` - Rejects hidden clone residue and reads mirror HEAD revisions.
- `features/lib/run-tokens.ts` - Rejects unrecognized brace tokens.
- `features/step_definitions/plugin/installation.steps.ts` - Projects every data entry and clone revision.
- `features/plugin/git-source.feature` - Proves revision projection through the installation record and clone table.
- `features/plugin/list-filters.feature` - Holds the nine filter scenarios over one complete fixture.
- `features/plugin/list.feature` - Keeps non-filter list behavior without repeated filter fixtures.
- `test/edge/handlers/plugin/browse.test.ts` - Replaces both fixed sleeps with render-event barriers.
- `test/orchestrators/plugin/marketplace-seed.ts` - Writes plugin and marketplace manifests before returning a record.
- `test/orchestrators/plugin/install-flow.test.ts` - Uses the shared seeder for conflict records.
- `test/orchestrators/plugin/reinstall-flow.test.ts` - Uses the shared seeder for conflict records.
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - Keeps serve-again setup before the scenario action.

## Decisions Made

- Used complete entry tables without adding a new column: directories end in `/`, and symlink text is `-> target`.
- Counted render requests because opening the marketplace requests one immediate loading render and one render after the loader settles.
- Kept the production fail-closed manifest reader unchanged; only the invalid test fixtures changed.

## Deviations from Plan

None - plan executed as specified. The install-retry scenario already used a Given seed on this branch, so that stale backlog item required no edit.

## Issues Encountered

- The plan's lowercase Cucumber `--name` pattern selected zero scenarios because project rules require uppercase scenario titles. Verification used the exact compliant title and passed one scenario with 14 steps.
- Sandbox policy initially denied loopback listeners and `mkfifo`. The same hermetic checks passed with the required local permissions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The shared harness and fixtures are ready for the remaining Phase 10 lifecycle scenarios. No blocker remains.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All created files exist.
- All three task commits are ancestors of `HEAD`.

---

*Phase: 10-lifecycle-test-and-harness-gaps*
*Completed: 2026-10-27*

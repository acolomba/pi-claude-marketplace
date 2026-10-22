---
phase: 04-marketplace-remove-and-list
plan: "01"
subsystem: testing
tags: [cucumber, marketplace-remove, scope-selection, compatibility]

requires: []
provides:
  - Approved D-MF-05 project-first unscoped removal decision
  - Clean empty-marketplace removal coverage across scopes and source kinds
  - Complete scope-selection, not-added, and rm-alias behavioral coverage
affects: [04-marketplace-remove-and-list, marketplace-removal]

actuals:
  tokens: 3952
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - Complete wire-envelope and ordered-row assertions in Cucumber scenarios
    - Surviving declarations as controls for scoped marketplace mutations

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md
    - features/marketplace/remove.feature

key-decisions:
  - "D-MF-05: unscoped removal selects project before user, mutates only the selected scope, and resolves scope before layer."

patterns-established:
  - "Removal controls: compare the complete surviving config after every successful or refused mutation."
  - "Missing targets: compare only serialized marketplace-not-added fields so absent scope and internal flags remain distinguishable."

requirements-completed: [RM-01, RM-05, RM-06, RM-07, RM-08]

coverage:
  - id: D1
    description: Empty marketplaces remove without reload across project/user and dir/file sources, with remote source examples retained under their exclusions.
    requirement: RM-01
    verification:
      - kind: e2e
        ref: npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature
        status: pass
      - kind: other
        ref: npm run check:features
        status: pass
    human_judgment: false
  - id: D2
    description: Explicit misses distinguish absent-everywhere targets from marketplaces present only in the other scope.
    requirement: RM-05
    verification:
      - kind: e2e
        ref: npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature
        status: pass
    human_judgment: false
  - id: D3
    description: An unscoped missing marketplace returns the generic not-added payload without a scope field.
    requirement: RM-06
    verification:
      - kind: e2e
        ref: npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature
        status: pass
    human_judgment: false
  - id: D4
    description: The rm alias matches remove for success and reports a stable scoped miss when repeated.
    requirement: RM-07
    verification:
      - kind: e2e
        ref: npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature
        status: pass
    human_judgment: false
  - id: D5
    description: D-MF-05 and behavioral witnesses pin project-first selection, sole-user fallback, and scope-before-layer refusal.
    requirement: RM-08
    verification:
      - kind: e2e
        ref: npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature
        status: pass
      - kind: other
        ref: D-MF-05 decision-row acceptance assertion
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-18
status: complete
plan_head_before: 6c1e6d120d388d69181361224bd9ee2d2b3fef53
plan_head_after: e958e34cda64386e93b96f9cf5b2f3978eec827c
---

# Phase 04 Plan 01: Marketplace Removal Scope Contract Summary

**Project-first unscoped removal, complete not-added payloads, and clean no-reload removal are pinned through real-Pi behavioral tests.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-18T14:02:21Z
- **Completed:** 2026-10-18T14:14:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Recorded D-MF-05 as the approved, evidence-backed divergence from Claude Code's all-scope unscoped removal.
- Covered empty removal for project and user scopes across local source kinds, while preserving tagged remote variants and an unrelated declaration.
- Pinned alias equivalence, project-first and sole-user selection, scope-before-layer refusal, all missing-target directions, and repeated removal.

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the approved unscoped removal decision** - `7c079c62` (docs)
2. **Task 2: Cover clean removal across source kinds and the rm alias** - `06fb7a0d` (test)
3. **Task 3: Pin scope precedence, complete misses, and a repeated alias removal** - `e958e34c` (test)

## Files Created/Modified

- `.planning/PROJECT.md` - Records the D-MF-05 compatibility decision.
- `.planning/REQUIREMENTS.md` - Marks the delivered removal requirements complete.
- `features/marketplace/remove.feature` - Adds clean removal, alias, precedence, layer, miss, and repeat-removal scenarios.

## Decisions Made

- D-MF-05 selects a project record before a user record for unscoped removal, falls back to a sole user record, and never falls through after selecting a mismatched project layer.
- The selected scope alone is mutated and reported, preserving independent scope ownership despite the documented upstream all-scope behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The sandbox prevented the headless Pi subprocess from staying open, so the focused Cucumber command was rerun outside the sandbox and passed.
- The first Task 2 commit attempt encoded a literal newline in its body and failed gitlint; the message was split into compliant paragraphs and committed without changing the task files.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Clean removal and its edge-case scope contract are fully specified for subsequent removal-cascade and list work.
- No blockers remain; STATE.md and ROADMAP.md are intentionally left for the orchestrator.

## Self-Check: PASSED

- The three task commits descend from the recorded plan head and exist in this worktree.
- The D-MF-05 row and all eleven added scenario/outline titles are present.
- Focused Cucumber verification passed 34 scenarios and 347 steps; the feature gate also passed.
- STATE.md and ROADMAP.md have no plan diff.

---
*Phase: 04-marketplace-remove-and-list*
*Completed: 2026-10-18*

---
phase: 109-shared-contracts
plan: 04
subsystem: testing
tags: [node-test, soft-dependencies, type-contracts, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for Dependency and softDepMarkers
  - Exact Boolean truth-table and marker-order evidence
affects: [shared-contracts, notification-rendering, plugin-lifecycle, reconcile]

actuals:
  tokens: 1300
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Module-scope satisfies and @ts-expect-error evidence for a closed union
    - Named sibling rows for the complete Boolean truth table

key-files:
  created:
    - tests/shared/concerns/soft-dep.test.ts
    - .planning/phases/109-shared-contracts/109-04-SUMMARY.md
  modified: []

key-decisions: []

patterns-established:
  - "Each truth-table row creates its probe and expected marker array for one independent runtime case."
  - "Soft-dependency expectations use the complete independent marker literals in canonical order."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins Dependency as the exact agents-or-MCP closed union."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sixteen named rows pin every declaration and loaded-state combination with exact marker arrays."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/concerns/soft-dep.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mirrored owner reaches complete direct function, line, and branch coverage without a production change."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 04: Soft dependency owner summary

**A canonical owner now pins the closed dependency type and every soft-dependency marker combination through `softDepMarkers`.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-29T18:36:59Z
- **Completed:** 2026-08-29T18:43:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added the mirrored owner for `Dependency` and `softDepMarkers`.
- Added module-scope positive and negative evidence for the closed dependency type.
- Pinned all 16 declaration and loaded-state combinations with independent marker arrays.
- Reached complete direct coverage without changing production bytes or exports.

## Caller-facing contract

`shared/notify.ts` is the only runtime caller of `softDepMarkers`. Its `composeReasons` function appends the returned markers to existing reasons.

Eight production modules import `Dependency` directly:

- `shared/notify.ts`
- `orchestrators/import/execute.ts`
- `orchestrators/plugin/install.ts`
- `orchestrators/plugin/list.ts`
- `orchestrators/plugin/reinstall.messaging.ts`
- `orchestrators/plugin/shared.ts`
- `orchestrators/plugin/update-row.ts`
- `orchestrators/reconcile/apply-outcomes.ts`

These callers retain the same contract. The type accepts only `"agents"` and `"mcp"`. A marker appears only for a declared but unavailable companion.

When both markers appear, `requires pi-subagents` comes before `requires pi-mcp`. The function remains pure and returns no marker for a loaded companion.

## Edge resolution

- **Boundary:** The owner covers every combination of the four Boolean inputs.
- **Adjacency and equality:** The both-declared, both-unavailable row keeps two adjacent, distinct markers.
- **Empty values:** Undeclared or loaded dependencies produce the exact empty array where applicable.
- **Ordering:** The dual-marker row pins agents before MCP.
- **Numeric precision:** Not applicable. The function accepts Boolean inputs and returns strings.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `9278fb46` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `acc6f2e0` (test)

## Files created or modified

- `tests/shared/concerns/soft-dep.test.ts` - Direct owner for the closed type and complete marker truth table.
- `.planning/phases/109-shared-contracts/109-04-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

None.

## Verification

- `node --test tests/shared/concerns/soft-dep.test.ts` passed.
- Direct coverage passed at 100 percent: 60/60 lines, 6/6 branches, and 1/1 function.
- `npm run typecheck` passed and proved the positive and negative type expressions.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source remained byte-identical at SHA-256 `d7ef9d818470c8284b166834789369547ae853262b4321d05018234271e98ee5`.

## Known stubs

None.

## Threat review

The complete truth table mitigates marker-selection tampering. The test-only change adds no endpoint, file access, authentication path, or schema change.

## User setup required

None. The owner uses pure local values and no external service.

## Next phase readiness

P109-04 is ready for phase verification. P109-14 can keep only the final bytes that render these already-selected markers.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `9278fb46` and `acc6f2e0` exist.
- Focused tests, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

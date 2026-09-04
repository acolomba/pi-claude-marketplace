---
phase: 109-shared-contracts
plan: 13
subsystem: testing
tags: [node-test, notification-reasons, type-contracts, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for notification reason and severity selection
  - Exact runtime matrices for skip severity, companion severity, and malformed-kind reasons
  - Compile-time evidence for FailureReason, DegradeKind, and _ReasonsCoverageProof
affects: [shared-contracts, notification-rendering, plugin-lifecycle, reconcile]

actuals:
  tokens: 2585
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Named sibling rows for pure reason and severity matrices
    - Module-scope satisfies and @ts-expect-error evidence for closed type boundaries

key-files:
  created:
    - tests/shared/notify-reasons.test.ts
    - .planning/phases/109-shared-contracts/109-13-SUMMARY.md
  modified: []

key-decisions: []

patterns-established:
  - "Each severity and mapping row carries an independent expected value and its own lowercase runtime phases."
  - "Malformed kinds de-duplicate into canonical skill-before-command output, independent of input order."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins every FailureReason and DegradeKind member plus the exact reasons coverage proof."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Named rows pin all idempotent and actionable skip-severity outcomes plus every companion-state combination."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/notify-reasons.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Malformed kinds map, de-duplicate, and order their exact public failure reasons."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notify-reasons.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The owner reaches complete direct coverage without a production-source or public-export change."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "git diff --exit-code -- extensions/pi-claude-marketplace/shared/notify-reasons.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 13: Notification reason owner summary

**A mirrored owner now pins pure notification severity and malformed-kind selection with exact runtime and compile-time evidence.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T20:04:42Z
- **Completed:** 2026-08-29T20:11:01Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added the mirrored owner for `skipSeverity`, `companionSeverity`, and `malformedReasonsForKinds`.
- Added module-scope positive and negative evidence for `FailureReason`, `DegradeKind`, and `_ReasonsCoverageProof`.
- Pinned all 16 companion declaration and loaded-state combinations with independent severity values.
- Pinned absent, empty, single, multiple, repeated, mixed, reversed, and de-duplicated reason inputs.
- Reached complete direct coverage without changing production bytes or exports.

## Caller-facing contract

`skipSeverity` serves marketplace-update, plugin-update, and reinstall producers. These callers stamp `info` only when every reason is an idempotent no-op. Missing, empty, or actionable reasons stamp `warning`.

`companionSeverity` serves install, update, and enable producers. A declared but unloaded agents or MCP companion stamps `warning`. Other combinations stamp `info`.

`malformedReasonsForKinds` serves install, reinstall, enable, update-row, and reconcile composition. It emits one reason per degraded kind in canonical skill-before-command order.

`DegradeKind` also types the degraded-kind collectors and outcome fields across install, reinstall, update, and shared plugin orchestration. `FailureReason` constrains the malformed-kind map, while `_ReasonsCoverageProof` keeps the complete reason partition exact.

## Edge resolution

- **Boundary:** Separate rows cover absent, empty, single, and several reason inputs.
- **Adjacency and equality:** Every adjacent failure literal has compile-time evidence. Repeated idempotent reasons stay informational, and repeated degraded kinds collapse.
- **Empty values:** Missing and empty skip reasons warn. Missing and empty degraded-kind inputs return the exact empty array.
- **Ordering:** Actionable reasons warn in either input position. Malformed-kind output always uses skill-before-command order, so first-seen input order is not public behavior.
- **Numeric precision:** Not applicable. The public functions accept strings and Booleans and return strings or string arrays.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `535c01f6` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `e34c49bb` (test)

## Files created or modified

- `tests/shared/notify-reasons.test.ts` - Direct owner for notification reason and severity selection.
- `.planning/phases/109-shared-contracts/109-13-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

The first focused run found that a declared type-only symbol compiled into an undefined runtime reference. A conditional exactness type replaced it before Task 1 was committed.

## Verification

- `node --test tests/shared/notify-reasons.test.ts` passed.
- Direct coverage passed at 100 percent: 257/257 lines, 18/18 branches, and 6/6 functions.
- `npm run typecheck` passed with all positive and negative type expressions.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The completed notification-concern owners for plans 03, 04, and 13 passed together.
- The production source remained byte-identical at SHA-256 `cc9fce0ef860e9ad899997afb53719fb5967d71d8cec855a8f91fe33d8742e15`.

## Known stubs

None.

## Threat review

The complete matrices and closed type evidence mitigate reason-selection tampering. The test-only change adds no endpoint, file access, authentication path, or schema change.

## User setup required

None. The owner uses pure local values and no external service.

## Next phase readiness

Plan 109-13 is ready for phase verification. Plan 109-14 can consume the selected reasons without repeating this truth table.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `535c01f6` and `e34c49bb` exist.
- Focused tests, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

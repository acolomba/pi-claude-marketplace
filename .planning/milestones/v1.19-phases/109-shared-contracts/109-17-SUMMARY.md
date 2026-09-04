---
phase: 109-shared-contracts
plan: 17
subsystem: testing
tags: [node-test, session-env, path-ledger, process-env, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for claudeSessionEnvFor, applySessionEnv, PATH_LEDGER_ENV, and applyPathLedger
  - Exact session projection, environment isolation, PATH ownership, de-duplication, ordering, and tamper evidence
affects: [shared-contracts, session-start, hook-env, plugin-path]

actuals:
  tokens: 3542
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Case-owned process environment restoration registered before mutation
    - Named pure PATH-ledger rows with independent whole-value expectations

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-17-SUMMARY.md
  modified:
    - tests/shared/session-env.test.ts

key-decisions: []

patterns-established:
  - "Each live environment case restores every key that it touches through its own test context."
  - "PATH-ledger rows compare complete path and ledger strings across platform delimiters."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins the exact session triple, unconditional refresh, and unrelated-key preservation."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/session-env.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner pins PATH-ledger removal, append, de-duplication, order, empty-segment, and tamper behavior."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/session-env.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The production source and public export surface remain byte-identical."
    requirement: MOD-02
    verification:
      - kind: other
        ref: "git diff --exit-code -- extensions/pi-claude-marketplace/shared/session-env.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-29
status: complete
---

# Phase 109 plan 17: Session environment owner summary

**A canonical owner now pins the session projection and exact PATH-ledger ownership without changing production code.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-29T20:16:46Z
- **Completed:** 2026-08-29T20:27:17Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Directly proved all four public exports from the mirrored owner.
- Replaced shared environment helpers with case-owned restoration that starts before mutation.
- Added exact rows for empty, duplicate, adjacent, ordered, repeated, and tampered PATH values.
- Reached complete direct coverage without a production change.

## Caller-facing contract

CodeGraph found three production integration points. `index.ts` refreshes the live session triple from the active Pi session.

`hook-env.ts` spreads `claudeSessionEnvFor` last. This order makes the per-dispatch session snapshot authoritative over inherited environment values.

`plugin-path.ts` reads the public ledger key and calls `applyPathLedger`. It writes the returned path and ledger to `process.env` after reload reconciliation.

These callers retain the same values and effects. The session triple stays `CLAUDECODE="1"` plus two identical session identifiers.

The ledger key stays `PI_CLAUDE_MARKETPLACE_PATH`. The pure transform removes only absolute owned entries and appends new entries after every surviving value.

## Edge resolution

- **Boundary:** Empty path, ledger, and fresh lists remain byte-empty.
- **Adjacency and equality:** Relative ledger neighbors survive, while adjacent absolute owned entries leave the path.
- **Empty values:** A fresh entry appended to an empty path gains no leading delimiter. Existing empty path segments remain exact.
- **Ordering:** Non-owned entries keep their order. Fresh entries keep their first-seen order at the tail.
- **Duplicate values:** Existing and repeated fresh entries appear once. The new ledger records only entries that the transform appended.
- **Tamper resistance:** Relative ledger entries cannot remove relative path content. An absolute owned value is removed from every matching position.
- **Numeric precision:** Not applicable. This public contract has no numeric input, output, or computation.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `a54c60f0` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `eb2cea86` (test)

## Files created or modified

- `tests/shared/session-env.test.ts` - Direct owner for session projection and PATH-ledger behavior.
- `.planning/phases/109-shared-contracts/109-17-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

One pre-commit safety check rejected a mistyped expected hash before staging. The next check used the authoritative worktree hash.

## Verification

- `node --test tests/shared/session-env.test.ts` passed.
- Direct coverage passed at 100 percent: 127/127 lines, 9/9 branches, and 5/5 functions.
- `npm run typecheck` passed for the public exports and callers.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source remained byte-identical at SHA-256 `ae08efc9221a821074da5abb60c6f9de6e6a78a78ec0a7b89005d08d62d30144`.

## Known stubs

None.

## Threat review

The owner proves the high-severity environment mitigation. It pins owned-key isolation, absolute-ledger filtering, fresh-entry de-duplication, and case-owned restoration.

The test-only change adds no network endpoint, authentication path, filesystem access, schema change, or new trust boundary.

## User setup required

None. The owner uses process-local state and no external service.

## Next phase readiness

P109-17 is ready for phase verification. The production source and its callers require no follow-up change.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `a54c60f0` and `eb2cea86` exist.
- Focused tests, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

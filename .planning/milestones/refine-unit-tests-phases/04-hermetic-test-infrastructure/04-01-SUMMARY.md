---
phase: 04-hermetic-test-infrastructure
plan: "01"
subsystem: test-environment
tags: [typescript, hermeticity, filesystem, environment, node-test]

requires:
  - phase: 03-production-defect-corrections
    provides: Stable production location behavior and green baseline
provides:
  - Case-owned HOME and PI_CODING_AGENT_DIR boundary
  - Exact environment restoration on success or failure
  - Ambient-agent-directory regression for plugin list
affects: [phase-04, plugin-install-tests, plugin-list-tests]

actuals:
  tokens: 6200
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - One temporary root owns home, Pi agent directory, project cwd, and cleanup
    - Ambient location input is restored by prior presence and exact value

key-files:
  created:
    - tests/platform/hermetic-environment.ts
    - .planning/phases/04-hermetic-test-infrastructure/04-01-SUMMARY.md
  modified:
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/list.test.ts

key-decisions:
  - "Place the synthetic Pi agent directory at home/.pi/agent so existing independently authored user-scope fixtures remain valid while the higher-precedence variable is explicit."
  - "Keep suite-specific wrapper signatures but delegate all environment mutation and cleanup to one concern-owned platform helper."

patterns-established:
  - "Hermetic Pi environment: assign both HOME and PI_CODING_AGENT_DIR before production location resolution."
  - "Poison proof: seed an ambient user marketplace and prove public list behavior ignores it and leaves it unchanged."

requirements-completed: [TREF-01]

coverage:
  - id: H1
    description: "Plugin install and list execute with case-owned Pi user locations and preserve existing behavior."
    requirement: TREF-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/list.test.ts"
        status: pass
    human_judgment: false
  - id: H2
    description: "Plugin list ignores an independently seeded ambient agent directory and leaves its tree unchanged."
    requirement: TREF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#CMC-10: empty state ignores an ambient Pi agent directory"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-07
status: complete
---

# Phase 04 Plan 01: Hermetic Pi Environment Summary

**Plugin install and list now resolve all user state beneath a case-owned root, even when the host process already defines a different Pi agent directory.**

## Accomplishments

- Added a typed test-platform helper that owns temporary home, agent, project, restoration, and cleanup state.
- Replaced HOME-only install and list wrappers without changing their callback contracts.
- Strengthened the empty plugin-list case with a valid ambient user marketplace that must remain invisible and byte-for-byte unchanged.

## Task Commit

1. **Tasks 1-2: Isolate the Pi user environment and migrate install/list** — `9d4f1867`

## Decisions Made

- Nested the explicit agent directory at the production default relative path under the synthetic home. This preserves existing fixture paths while still exercising the environment variable's higher precedence.
- Used `finally` restoration keyed by property presence, so an originally absent variable is deleted rather than assigned `undefined`.

## Deviations from Plan

- Both tasks landed in one atomic implementation commit because the second task is the direct behavioral proof of the shared helper and the three files form one indivisible change.

## Verification

- Install/list owner suites passed.
- The strengthened plugin-list suite passed independently.
- `npm run typecheck` passed.
- Focused ESLint passed with zero warnings.
- Prettier reported the three changed TypeScript files clean.

## User Setup Required

None.

## Next Phase Readiness

The shared environment boundary is ready for the remaining plugin, marketplace, architecture, and MCP migrations in Plan 04-02.

## Self-Check: PASSED

---

_Phase: 04-hermetic-test-infrastructure_
_Completed: 2026-09-07_

---
phase: 109-shared-contracts
plan: 05
subsystem: testing
tags: [node-test, debug-log, environment, console, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for hookDebugLog
  - Exact debug gate, tag, detail, and console argument evidence
affects: [shared-contracts, hooks, plugin-path, git-diagnostics]

actuals:
  tokens: 1681
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Case-owned environment restoration registered before mutation
    - Current-test-context console method replacement with complete argument assertions

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-05-SUMMARY.md
  modified:
    - tests/shared/debug-log.test.ts

key-decisions: []

patterns-established:
  - "Each debug case restores PI_CLAUDE_MARKETPLACE_DEBUG and uses its own console method replacement."
  - "Debug output assertions compare the complete console.error argument list to independent literal bytes."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins the exact string gate and silence for every required near match."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/debug-log.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner pins default and custom tags, empty and one-character details, and exact console arguments."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/debug-log.test.ts#emits the exact default-tag message under the exact debug gate"
        status: pass
      - kind: unit
        ref: "tests/shared/debug-log.test.ts#emits the exact custom-tag message under the exact debug gate"
        status: pass
      - kind: unit
        ref: "tests/shared/debug-log.test.ts#emits the default tag and separator for an empty detail"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mirrored owner reaches complete direct coverage without a production change."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/debug-log.ts"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-29
status: complete
---

# Phase 109 plan 05: Debug log owner summary

**A canonical owner now pins the exact debug gate, default and custom tags, detail boundaries, and complete `console.error` arguments.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-29T18:48:23Z
- **Completed:** 2026-08-29T18:52:55Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Normalized every runtime case to separate lowercase arrange, act, and assert phases.
- Proved that only the exact string `"1"` enables output.
- Pinned default and custom tags, empty and one-character details, and tag-before-detail order.
- Reached complete direct coverage without changing production bytes or exports.

## Caller-facing contract

CodeGraph found 65 production call sites across 20 importing modules. They span hook dispatch, async rewake, hook translation, plugin lifecycle, plugin PATH handling, and Git diagnostics.

Callers retain the same contract. `hookDebugLog` is a named direct-path export with no imports or module state. It emits one `console.error` argument only when `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`.

The default tag remains `hooks`. A supplied tag appears inside the leading brackets, before one space and the unchanged detail string.

## Edge resolution

- **Boundary:** Exact `"1"` emits, while undefined, empty, `"0"`, `"true"`, and `" 1 "` stay silent.
- **Adjacency and equality:** The one-character detail case pins the smallest non-empty detail under the exact gate.
- **Empty values:** An empty detail emits the exact bytes `[hooks] `, including the trailing separator.
- **Ordering:** The custom-tag case pins `[env] x`, so the tag must precede the detail.
- **Numeric precision:** Not applicable. The public contract has no numeric input, output, or computation.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `c8eccecb` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `18cb8060` (test)

## Files created or modified

- `tests/shared/debug-log.test.ts` - Direct owner for the exact gate and console effect.
- `.planning/phases/109-shared-contracts/109-05-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

None.

## Verification

- `node --test tests/shared/debug-log.test.ts` passed.
- Direct coverage passed at 100 percent: 26/26 lines, 3/3 branches, and 1/1 function.
- `npm run typecheck` passed for the public export and its callers.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source remained byte-identical at SHA-256 `a7f566618d7065e608e6ef21bc3f7557991aa08f36127609104652990664625b`.

## Known stubs

None.

## Threat review

Exact near-match silence and case-owned restoration mitigate the environment-gated information-disclosure threat. The test-only change adds no new trust boundary.

## User setup required

None. The owner uses process-local state and no external service.

## Next phase readiness

P109-05 is ready for phase verification. The remaining independent shared owners can proceed.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `c8eccecb` and `18cb8060` exist.
- Focused tests, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

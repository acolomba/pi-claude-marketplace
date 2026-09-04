---
phase: 109-shared-contracts
plan: 01
subsystem: testing
tags: [node-test, atomic-json, filesystem, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for atomicWriteJson
  - Exact byte and replacement evidence for atomic JSON writes
affects: [shared-contracts, persistence, completion-cache, hook-staging, mcp-staging]

actuals:
  tokens: 1934
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Case-owned temporary filesystem boundaries
    - Independent complete JSON byte expectations

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-01-SUMMARY.md
  modified:
    - tests/shared/atomic-json.test.ts

key-decisions: []

patterns-established:
  - "Each filesystem case creates and removes its own temporary directory."
  - "Atomic JSON expectations use independent complete strings with the trailing newline."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins parent creation and exact two-space JSON bytes with one trailing newline."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/atomic-json.test.ts#writes two-space JSON with one trailing newline"
        status: pass
      - kind: unit
        ref: "tests/shared/atomic-json.test.ts#creates a missing parent tree before writing the document"
        status: pass
    human_judgment: false
  - id: D2
    description: "Concurrent same-path writes expose only complete submitted documents."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/atomic-json.test.ts#keeps every concurrent same-path observation as one complete document"
        status: pass
    human_judgment: false
  - id: D3
    description: "The owner pins empty, ordered, fractional, negative-zero, and non-finite JSON output."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/atomic-json.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 01: Atomic JSON owner summary

**A canonical owner now pins complete JSON bytes, parent creation, same-path replacement, and numeric serialization through `atomicWriteJson`.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-29T17:55:44Z
- **Completed:** 2026-08-29T18:02:17Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Normalized every runtime case to separate lowercase arrange, act, and assert phases.
- Proved missing parent creation and complete UTF-8 JSON documents with independent expected strings.
- Covered same-path concurrency, an empty root object, insertion order, and JSON number edge behavior.
- Kept `extensions/pi-claude-marketplace/shared/atomic-json.ts` byte-identical with no new public surface.

## Caller-facing contract

The caller trace found nine production modules that use `atomicWriteJson`:

- `bridges/hooks/async-rewake/pid-table.ts`
- `bridges/hooks/stage.ts`
- `bridges/mcp/stage.ts`
- `bridges/mcp/unstage.ts`
- `persistence/agents-index-io.ts`
- `persistence/config-io.ts`
- `persistence/migrate.ts`
- `persistence/state-io.ts`
- `shared/completion-cache.ts`

These callers retain the same contract. The wrapper creates missing parents, writes `JSON.stringify(value, null, 2) + "\n"` as UTF-8, and replaces same-path files atomically. It does not catch write or serialization errors.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `c2af1f85` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `cb5f059a` (test)

## Files created or modified

- `tests/shared/atomic-json.test.ts` - Direct owner for exact atomic JSON bytes and filesystem effects.
- `.planning/phases/109-shared-contracts/109-01-SUMMARY.md` - Execution evidence and caller trace.

## Decisions made

None. The plan and its locked test contract were sufficient.

## Deviations from plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Widened the expected-document set for file reads**

- **Found during:** Task 2 pair-local type check.
- **Issue:** TypeScript inferred a set of three string literals, but a file read returns `string`.
- **Fix:** Declared the set as `Set<string>` without changing the runtime assertion.
- **Files modified:** `tests/shared/atomic-json.test.ts`.
- **Verification:** `npm run typecheck` passed.
- **Committed in:** `cb5f059a`.

**Total deviations:** 1 auto-fixed blocking issue.
**Impact on plan:** The fix kept the owner type-safe and did not expand scope.

## Issues encountered

The first type-check pass found the literal-set inference problem. The explicit string set resolved it, and all pair-local checks passed.

## Verification

- `node --test tests/shared/atomic-json.test.ts` passed.
- Direct coverage passed at 100 percent functions, lines, and branches.
- Pair-local ESLint and Prettier checks passed.
- `npm run typecheck` passed.
- `git diff --check` passed.
- The production source hash remained `33932cefbefc23510e415537f49b11b172dfc7f3`.

## User setup required

None. The plan uses only local temporary directories.

## Next phase readiness

P109-01 is ready for phase verification. The remaining Phase 109 source-owner pairs are independent of this owner.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `c2af1f85` and `cb5f059a` exist.
- The focused owner, coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

*Phase: 109-shared-contracts*
*Completed: 2026-08-29*

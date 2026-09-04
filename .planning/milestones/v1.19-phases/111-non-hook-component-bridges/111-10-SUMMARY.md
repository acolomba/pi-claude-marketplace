---
phase: 111-non-hook-component-bridges
plan: 10
subsystem: testing
tags: [typescript, node-test, command-discovery, filesystem, symlink, direct-coverage]

requires:
  - phase: 109-shared-contracts
    provides: Lowercase runtime phases and independently authored expectation rules
provides:
  - Canonical mirrored owner for recursive command discovery and deterministic generated names
  - Exact source digests, skip behavior, collision warnings, and hostile-path evidence
affects: [command-bridges, component-discovery, filesystem-security]

actuals:
  tokens: 15281
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: [case-owned temporary trees, complete discovery records, deterministic filesystem races]

key-files:
  created: [.planning/phases/111-non-hook-component-bridges/111-10-SUMMARY.md]
  modified: [tests/bridges/commands/discover.test.ts]

key-decisions:
  - "Kept commands/discover.ts byte-identical because its public discovery result exposes the required command inventory and diagnostics."
  - "Used case-owned filesystem mutations to reproduce subdirectory and file races without sleeps or polling."
  - "Used one case-scoped readdir stub for the defensive branch where an errno changes between two observations."

patterns-established:
  - "Command discovery cases build every meaningful source entry locally and compare the complete ordered result."
  - "Filesystem race cases mutate only their temporary tree after the relevant directory read completes."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "Recursive command discovery preserves depth-first order, complete records, first-segment prefix elision, and source bytes."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/commands/discover.test.ts#discovers recursive commands in deterministic depth-first order with complete records"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/discover.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dot entries, symlinks, permissions, races, overlapping roots, unsafe names, and generated-name collisions preserve exact outcomes."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/commands/discover.test.ts#hostile path and collision cases"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "npx eslint tests/bridges/commands/discover.test.ts"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 10: Command discovery owner summary

**Case-owned command discovery tests pin recursive records, source-byte digests, exact skip diagnostics, deterministic collisions, and filesystem failures at 100 percent direct coverage**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-30T15:38:27Z
- **Completed:** 2026-08-30T15:54:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced shared-fixture reads and partial assertions with fresh command trees and complete expected results in each case.
- Proved recursive depth-first traversal, nested generated names, first-segment elision, byte preservation, absolute roots, and frozen result arrays.
- Closed dot-entry, symlink, permission, race, invalid-name, overlap, empty-elision, case, punctuation, and first-wins collision evidence.
- Reached 58/58 branches, 15/15 functions, and 414/414 lines without changing production bytes or exports.

## Task commits

Each task was committed atomically:

1. **Task 1: Establish the canonical commands/discover owner** - `5eaf8d8e` (test)
2. **Task 2: Close edge and direct-coverage evidence** - `7e55d531` (test)
3. **Task 2 lint correction** - `cdc2b641` (fix)

## Files created or modified

- `tests/bridges/commands/discover.test.ts` - Canonical owner for command records, skips, diagnostics, collisions, and error policy.
- `.planning/phases/111-non-hook-component-bridges/111-10-SUMMARY.md` - Plan evidence, decisions, coverage metadata, and commit record.

## Verification

- `node --test tests/bridges/commands/discover.test.ts` passed.
- `npm run typecheck` passed.
- Direct coverage passed with 58/58 branches, 15/15 functions, and 414/414 lines.
- Pair-local ESLint, Prettier, and `git diff --check` passed.
- The production source retained SHA-256 `de2d0db900e9d374c9f5ea21440dd3bec0d92382a32f32e3486769d039734c06`.

## Decisions made

- Kept production behavior and exports unchanged because `discoverPluginCommands` exposes each required result and rejection path.
- Used exact SHA-256 literals to prove that discovery does not change command source bytes.
- Used `async_hooks` to mutate a case-owned tree after a directory read and before the next filesystem operation.
- Limited the changing-errno stub to one case and restored the built-in binding before cleanup.

## Threat controls

- T-111-10-01 is mitigated. Real symlinks cannot escape a command root, and directory symlinks produce exact skip diagnostics.
- Permission and race cases prove that tolerated entry failures skip safely while non-tolerated storage errors propagate.
- Generated-name collisions retain the deterministic first record and return the complete warning in stable order.
- No network, authentication, schema, production filesystem, or public API surface was introduced.

## Deviations from plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Removed an unnecessary async marker from the errno stub**

- **Found during:** Repository-wide lint after Task 2
- **Issue:** ESLint rejected an async replacement function that contained no `await` expression.
- **Fix:** Returned explicit resolved and rejected promises without changing the stub behavior.
- **Files modified:** `tests/bridges/commands/discover.test.ts`
- **Verification:** Pair-local ESLint, focused test, typecheck, and direct coverage passed.
- **Committed in:** `cdc2b641`

---

**Total deviations:** 1 auto-fixed blocking issue
**Impact on plan:** The correction changes test syntax only. It does not change behavior or scope.

## Issues encountered

- The repository-wide `npm run check` reached ESLint and found seven errors in concurrent Phase 111 agent-owner files.
- The errors are outside Plan 111-10. Pair-local ESLint and all required Plan 111-10 commands pass.

## User setup required

None. This plan adds no external service or local configuration requirement.

## Next phase readiness

- P111-10 is ready for phase-level verification.
- MOD-04 remains pending until the other non-hook bridge owners produce their summaries.
- No plan-local blocker, production change, open high-severity threat, stub, skipped test, todo, or coverage exception remains.

## Self-check: PASSED

- The canonical owner and summary exist on disk.
- All three implementation commits exist in repository history.
- The production source is byte-identical to the plan-start revision.
- The owner directly imports its mirrored source and has no stubs, skipped tests, todos, or non-lowercase phase comments.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_

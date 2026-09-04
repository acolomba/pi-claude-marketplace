---
phase: 111-non-hook-component-bridges
plan: 02
subsystem: testing
tags: [typescript, node-test, agent-discovery, filesystem, symlink, direct-coverage]

requires:
  - phase: 109-shared-contracts
    provides: Lowercase runtime phases and independently authored expectation rules
provides:
  - Canonical mirrored owner for flat agent discovery and deterministic ordering
  - Exact raw-byte digests, skip behavior, collision warnings, and hostile-name evidence
affects: [agent-bridges, component-discovery, filesystem-security]

actuals:
  tokens: 4512
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [case-owned temporary trees, independently pinned complete records, exact filesystem errors]

key-files:
  created: [.planning/phases/111-non-hook-component-bridges/111-02-SUMMARY.md]
  modified: [tests/bridges/agents/discover.test.ts]

key-decisions:
  - "Kept agents/discover.ts byte-identical because its public discovery function exposes every real branch."
  - "Authored complete records and raw-byte digests independently inside each case-owned temporary tree."
  - "Pinned generated-name first-wins warnings separately from the hard empty-elision failure."

patterns-established:
  - "Filesystem discovery owners build every meaningful entry locally and register cleanup with the case before acting."
  - "Discovery assertions compare the complete ordered result, including paths, hashes, parsed fields, bodies, and warnings."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "Flat agent discovery selects only direct markdown files and returns complete records in deterministic source order."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/agents/discover.test.ts#discovers flat markdown agents in source order with complete records"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/discover.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Missing, non-directory, unreadable, symlinked, duplicate, and hostile-name inputs preserve exact skip, warning, and failure policy."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/agents/discover.test.ts#filesystem and collision edge cases"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 02: Agent discovery owner summary

**Case-owned agent discovery tests pin sorted records, raw-byte SHA-256 digests, skip semantics, first-wins warnings, and hard name validation at 100 percent direct coverage**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-30T13:46:11Z
- **Completed:** 2026-08-30T13:55:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced shared-fixture reads and partial assertions with a canonical direct owner that builds complete agent trees per case.
- Proved sorted flat traversal, markdown selection, filename fallback, plugin-prefix elision, raw-byte hashing, parsed records, frozen arrays, and warning order.
- Closed missing-path, ENOTDIR, unreadable-file, symlink, duplicate generated-name, elided-name collision, and empty-elision failure evidence.
- Reached 14/14 branches, 3/3 functions, and 116/116 lines without changing production bytes or exports.

## Task commits

Each task was committed atomically:

1. **Task 1: Establish the canonical agents/discover owner** - `2a3269b7` (test)
2. **Task 2: Close edge and direct-coverage evidence** - `a4deea69` (test)

## Files created or modified

- `tests/bridges/agents/discover.test.ts` - Canonical direct owner for deterministic records, hashes, filtering, errors, symlink refusal, and collision policy.
- `.planning/phases/111-non-hook-component-bridges/111-02-SUMMARY.md` - Plan evidence, decisions, coverage metadata, and commit record.

## Verification

- `node --test tests/bridges/agents/discover.test.ts` passed.
- `npm run typecheck` passed.
- Direct coverage passed with 14/14 branches, 3/3 functions, and 116/116 lines.
- `npm run test:integration` passed 10/10 integration files.
- ESLint, Fallow, pair-local Prettier, and `git diff --check` passed.
- The production source retained SHA-256 `b65fbaad5af126a0750bdaca3dd72b8ed13dbbf23eb85e5541b5e2f8d1d801c3` and is byte-identical to the plan-start revision.

## Decisions made

- Kept production behavior and exports unchanged because `discoverPluginAgents` exposes every required outcome through its public result and rejection behavior.
- Replaced the shared fixture and cleanup helper with fresh case-owned trees and `t.after()` cleanup registered inside each case.
- Hard-coded the expected SHA-256 digests and authored every complete expected record independently from production hashing and parsing helpers.
- Proved cross-directory duplicates and same-directory elision collisions separately so first-wins ordering and exact warning paths remain explicit.

## Threat controls

- T-111-02-01 is mitigated. A real case-local symlink is skipped without following its target, and an unreadable file preserves the exact filesystem error.
- Hostile source-name elision fails closed without a test-only seam, while duplicate generated names retain the first complete record and emit an exact ordered warning.
- No network, authentication, schema, production filesystem, or public API surface was introduced.

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Corrected generated metadata formatting**

- **Found during:** Plan metadata update
- **Issue:** The registered handlers duplicated Phase 111 labels in three state decisions and emitted a misaligned roadmap progress row.
- **Fix:** Removed the duplicate labels and restored the existing roadmap table alignment without changing handler-owned values.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** State position, decisions, session, metric, and roadmap 2/31 progress were read back after correction.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 1 auto-fixed bug
**Impact on plan:** The correction affects planning metadata presentation only; implementation scope and behavior are unchanged.

## Issues encountered

- The repository-wide `npm run check` reached format validation after typecheck, lint, and Fallow passed. It then stopped on five pre-existing user-owned untracked JSON files: `.mcp.json` and four `.planning/research/.cache/` files. The changed owner passes its own Prettier check, and the unrelated files were preserved.
- The full unit sweep passed the changed owner and 220 other test files. `tests/orchestrators/marketplace/add.test.ts` failed because the sandbox denied Unix-domain socket creation. Three cases in `tests/orchestrators/plugin/update.test.ts` expect `no longer installable`, while current output is `network unreachable`. This plan does not import or modify either owner, and the same baseline issues are recorded in Plan 111-01.

## User setup required

None. This plan adds no external service or local configuration requirement.

## Next phase readiness

- P111-02 is ready for phase-level verification.
- MOD-04 remains pending until the other 29 non-hook bridge owners produce their summaries.
- No plan-local blocker, production change, open high-severity threat, stub, skipped test, todo, or coverage exception remains.

## Self-check: PASSED

- The canonical owner and summary exist on disk.
- Both task commits exist in repository history.
- The production source is byte-identical to the plan-start revision.
- The owner directly imports its mirrored source and has no stubs, skipped tests, todos, coverage exceptions, or non-lowercase runtime phase comments.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_

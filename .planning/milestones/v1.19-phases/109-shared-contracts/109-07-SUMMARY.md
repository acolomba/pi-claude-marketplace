---
phase: 109-shared-contracts
plan: 07
subsystem: testing
tags: [node-test, shared-errors, typed-errors, cause-chain, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for every shared error helper, class, and discriminant
  - Exact bounded cause-chain, leak, aggregate, and defensive-copy evidence
affects:
  [
    shared-contracts,
    marketplace-lifecycle,
    plugin-lifecycle,
    bridge-staging,
    notification-rendering,
  ]

actuals:
  tokens: 16049
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Complete structured assertions for typed public error values
    - Module-scope satisfies and @ts-expect-error evidence for closed discriminants
    - Exact depth-bound and cycle cases for public cause-chain consumers

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-07-SUMMARY.md
  modified:
    - tests/shared/errors.test.ts

key-decisions: []

patterns-established:
  - "Shared error owners compare complete names, messages, fields, causes, collections, and discriminants independently."
  - "Cause-chain evidence pins zero, one, exact-bound, beyond-bound, self-cycle, and multi-node-cycle behavior with complete strings."
  - "Collection evidence distinguishes retained aliases from frozen defensive copies and pins first-seen duplicate order."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner directly imports and proves every shared error helper, class, interface, type, and runtime discriminator arm."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/errors.test.ts"
        status: pass
      - kind: unit
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cause chains, leak merges, failure aggregates, empty collections, duplicate text, ordering, and defensive copies preserve exact public values."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/errors.test.ts#causeChainTrailer"
        status: pass
      - kind: unit
        ref: "tests/shared/errors.test.ts#errorWithManualRecovery"
        status: pass
      - kind: unit
        ref: "tests/shared/errors.test.ts#AggregateResourcesDiscoverError"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mirrored owner reaches complete direct function, line, and branch coverage without changing production bytes or exports."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors.ts"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 07: Shared error owner summary

**A canonical owner now locks every shared error helper, class, discriminant, bounded cause walk, and defensive aggregate through exact public values.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-29T19:07:21Z
- **Completed:** 2026-08-29T19:23:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Normalized 69 runtime cases to the exact lowercase arrange, act, and assert contract, with combined markers limited to one throwing expression.
- Added module-scope positive and negative type evidence for every `Phase3Failure`, `PluginShapeErrorShape`, `PluginShapeErrorKind`, and `ResourcesDiscoverFailure` discriminator family.
- Pinned exact names, messages, stable fields, causes, aliases, frozen copies, empty and repeated collections, and first-seen ordering for every exported class and helper.
- Reached 100 percent direct coverage while keeping `extensions/pi-claude-marketplace/shared/errors.ts` and its public export surface byte-identical.

## Caller-facing contract

CodeGraph found 62 production importers across bridge staging, hook execution, persistence, state transactions, edge handlers, marketplace lifecycle, plugin lifecycle, reconciliation, discovery, and notification rendering.

The broad `errorMessage` contract remains `Error.message` for `Error` values and `String(value)` otherwise. `isErrnoException` still accepts only `Error` objects carrying a string `code`, and `assertNever` still throws the complete `Unexpected value: <value>` message.

Command discovery, marketplace and plugin update aggregation, plugin reinstall, and `notify.ts` continue to share the same depth-five cause-chain grammar. Zero links emit no trailer; one through five links render in caller order; a continuing sixth link marks only the fifth rendered link as truncated; self-cycles stop immediately; multi-node cycles terminate at the same bound.

Agent, command, and skill staging plus clone-cache and update paths retain the same leak-wrapping behavior. Manual-recovery callers retain first-seen de-duplication, a frozen merged copy, the first matching error within five links, and the first non-empty leak payload within the same bound.

Marketplace add/update/remove, plugin install/update/uninstall/reinstall, state locking, resource discovery, and notification callers continue to observe the same typed classes, exact messages, fields, causes, collection order, aliases, and defensive copies. No constructor, helper signature, type union, or runtime export changed.

## Edge resolution

- **Boundary:** Cause traversal covers absent, one-link, exact five-link, and six-link inputs. Error and failure collections cover empty, single, and several values.
- **Adjacency and equality:** Both scopes, every phase and shape arm, every resource scope/kind combination, repeated conflicts, repeated reasons, repeated failures, and repeated leaks are explicit.
- **Empty values:** Empty scopes, conflicts, failures, leaks, reasons, and aggregate discovery inputs each have an independently discriminating exact assertion.
- **Ordering:** Cause links, conflicts, phase failures, resource failures, reasons, and leak de-duplication preserve caller or first-seen order exactly.
- **Numeric precision:** Not applicable outside the exact integer cause-depth boundary; the public module performs no numeric calculation.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `0e9e6aea` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `9efc06d4` (test)

## Files created or modified

- `tests/shared/errors.test.ts` - Direct owner for every shared error export and public edge.
- `.planning/phases/109-shared-contracts/109-07-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

TypeScript initially retained a narrower literal union for a mutable resource-failure array. Declaring the array through the exported `ResourcesDiscoverFailure[]` contract preserved the intended test and passed type checking before the Task 2 commit.

## Verification

- `node --test tests/shared/errors.test.ts` passed with 69 cases across 24 suites.
- Direct coverage passed at 100 percent: 618/618 lines, 98/98 branches, and 42/42 functions.
- `npm run typecheck` passed for every public type expression and all production callers.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source remained byte-identical at SHA-256 `05e93a98824ef11e647528ecbb2e1e26da210e055349457995cb0addc20bf4c8`.

## Known stubs

None.

## Threat review

Exact bounded traversal and cycle evidence mitigates the planned denial-of-service risk, while complete message and collection assertions prevent accidental information-contract drift. The test-only change adds no endpoint, authentication path, file access, schema change, or other trust boundary.

## User setup required

None. The owner uses only in-process values and no external service.

## Next phase readiness

P109-07 is ready for phase verification. The remaining independent shared owners can proceed without a production dependency on this test.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `0e9e6aea` and `9efc06d4` exist.
- Focused tests, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

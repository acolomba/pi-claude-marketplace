---
phase: 109-shared-contracts
plan: 10
subsystem: testing
tags: [node-test, git-transport, classifier, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for classifyGitTransportFailure
  - Exact HTTP, cancellation, network, cause-placement, and fallback evidence
affects:
  - plugin-fetch
  - plugin-info
  - plugin-install
  - plugin-update
  - marketplace-add
  - marketplace-update

actuals:
  tokens: 4146
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Named sibling classifier rows with fresh errors and independent expected reasons
    - Conflicting-signal cases that pin public precedence without inspecting private branches

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-10-SUMMARY.md
  modified:
    - tests/shared/git-failure-classifiers.test.ts

key-decisions:
  - "Keep cause traversal in callers: the shared classifier examines only the Error that it receives."
  - "Pin cancellation before network classification with one error that carries both signals."

patterns-established:
  - "Each classifier row creates a fresh error inside its case and compares the complete returned reason."
  - "Adjacent and conflicting inputs prove branch boundaries without duplicating production constants."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The mirrored owner pins every accepted authentication and network reason with exact public values."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/git-failure-classifiers.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "HTTP adjacency, cancellation equality, cause placement, empty inputs, and precedence have independent cases."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The production module stays byte-identical and every production caller continues to typecheck."
    requirement: MOD-02
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "git diff --exit-code f31fd00f HEAD -- extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-29
status: complete
---

# Phase 109 plan 10: Git transport failure classifier owner summary

**A canonical owner pins exact Git authentication, cancellation, network, cause-placement, and fallback results without a production change.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-29T20:00:52Z
- **Completed:** 2026-08-29T20:09:22Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced the brownfield suite with named sibling cases that use separate lowercase arrange, act, and assert phases.
- Pinned HTTP 400, 401, 403, and 404 boundaries, plus exact integer comparison and absent-status behavior.
- Pinned cancellation identity, network errno values, direct cause placement, caller-owned cause unwrapping, and deterministic precedence.
- Reached 100 percent direct function, line, and branch coverage without changing the production module.

## Caller-facing contract

CodeGraph found direct consumers in six production modules. They serve plugin fetch, info, install, update, marketplace add, and marketplace update.

Plugin fetch accepts the shared transport reason first. It keeps permission and source-missing fallbacks for unclassified errors.

Plugin info accepts the shared reason first. It sends unclassified errors to its probe classifier.

Plugin install accepts only the authentication result. Other errors keep the existing cause-chain rendering.

Plugin update turns a classified transport failure into a skipped outcome. Unclassified errors keep the existing shape and installability paths.

Marketplace add and update keep their typed, filesystem, and source fallbacks. Marketplace update unwraps one caller-owned cause before classification.

The shared classifier itself does not traverse `Error.cause`. It returns only `network unreachable`, `authentication required`, or `undefined`.

## Edge resolution

- **Boundary:** HTTP 401 and 403 classify as authentication. HTTP 400 and 404 remain unclassified.
- **Adjacency and equality:** Matching cancellation code and name remains authentication. HTTP 404 can fall through to a cancellation name.
- **Empty values:** Empty string, null, empty object, undefined, and an empty-message Error remain unclassified.
- **Ordering:** A cancellation name wins when the same Error also carries a network errno.
- **Cause placement:** A direct code classifies. The same code on `Error.cause` remains available for a caller to unwrap.
- **Numeric precision:** Only exact integer status equality matters. A fractional 401.5 status remains unclassified.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `d89c489d` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `ad797d0a` (test)

## Files created or modified

- `tests/shared/git-failure-classifiers.test.ts` - Direct owner for every public classifier result and boundary.
- `.planning/phases/109-shared-contracts/109-10-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

The owner treats cause traversal as a caller contract. This matches the existing marketplace-update seam and keeps the shared source unchanged.

The owner uses one conflicting cancellation-and-network Error to prove precedence through the public return value.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

The raw project-wide `git diff --check` reached unrelated LFS demo files and could not write the shared read-only LFS cache.

The same check passed with LFS filters disabled. Owned-path diff checks and the byte-identical production-source check also passed.

## Verification

- `node --test tests/shared/git-failure-classifiers.test.ts` passed.
- Direct coverage passed at 62/62 lines, 19/19 branches, and 1/1 function.
- `npm run typecheck` passed for all production callers.
- Pair-local ESLint and Prettier checks passed.
- The safe project diff check and owned-path diff checks passed.
- The production source is byte-identical to base `f31fd00f`.

## Known stubs

None.

## Threat review

Exact authentication and network boundaries mitigate the planned spoofing and denial-of-service risk. The plan adds no endpoint, identity decision, or public surface.

## User setup required

None. The owner uses local Error values and no external service.

## Next phase readiness

P109-10 is ready for phase verification. Later shared owners can rely on the locked transport-reason contract.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `d89c489d` and `ad797d0a` exist.
- Focused tests, direct coverage, type, lint, format, and diff checks passed.
- No skipped case, stub, coverage ignore, public test seam, or unrelated source change remains.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

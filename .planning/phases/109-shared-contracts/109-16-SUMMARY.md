---
phase: 109-shared-contracts
plan: 16
subsystem: testing
tags: [typescript, node-test, classifier, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner coverage for the shared probe classifiers
  - Exact evidence for prefix precedence, de-duplication, kind mapping, and probe failures
affects: [shared-contracts, marketplace-info, plugin-fetch, plugin-info, plugin-list]

actuals:
  tokens: 6587
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [top-level describe per public entrypoint, lowercase runtime phases]

key-files:
  created: [.planning/phases/109-shared-contracts/109-16-SUMMARY.md]
  modified: [tests/shared/probe-classifiers.test.ts]

key-decisions:
  - "Kept probe-classifiers.ts byte-identical and proved the current public contract through direct imports."
  - "Pinned startsWith adjacency and direct-cause behavior as caller-visible contracts."

patterns-established:
  - "Classifier owners compare complete ordered outputs against independently written literals."
  - "Every runtime row uses separate lowercase arrange, act, and assert phases."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The mirrored owner proves every public probe classifier with exact edge behavior and 100 percent direct coverage."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/probe-classifiers.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/probe-classifiers.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 16: Probe classifiers Summary

**Canonical probe-classifier owner with exact prefix, ordering, cause, and unsupported-kind contracts at 100 percent direct coverage**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-29T20:15:42Z
- **Completed:** 2026-08-29T20:24:52Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced migration narration with behavior-focused cases grouped by the three public runtime entrypoints.
- Applied the exact lowercase arrange, act, and assert contract to every runtime case, including data rows.
- Added explicit empty, adjacency, overlap, repeat, stable-order, and cause-depth evidence while preserving production bytes.
- Retained 100 percent direct function, line, and branch coverage for `probe-classifiers.ts`.

## Caller-facing invariants

- `narrowProbeError` remains the shared read-surface ladder used by marketplace info and plugin fetch, info, and list flows. It recognizes a `SyntaxError` only as the direct cause of `InvalidMarketplaceManifestError`.
- `narrowResolverNotes` keeps production prefix order: hooks prefixes, malformed MCP references, the `lspServers` substring, then the unsupported-source fallback. It de-duplicates by reason without changing first-seen order.
- `narrowUnsupportedKinds` keeps the exact `lspServers` and `hooks` carve-outs. All other strings map to `unsupported component`, with stable first-seen de-duplication.
- The full project typecheck passed, so traced production callers continue to compile against the unchanged export surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `12416ccb` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `a683c2cb` (test)

## Files Created/Modified

- `tests/shared/probe-classifiers.test.ts` - Canonical direct owner for the public probe, note, and unsupported-kind classifiers.
- `.planning/phases/109-shared-contracts/109-16-SUMMARY.md` - Execution evidence, caller invariants, commands, and commits.

## Verification

- `node --test tests/shared/probe-classifiers.test.ts` passed.
- Direct coverage passed with 35/35 branches, 5/5 functions, and 217/217 lines.
- Pair-local ESLint and Prettier checks passed.
- `npm run typecheck` passed.
- `git diff --check` passed.
- `git diff --exit-code -- extensions/pi-claude-marketplace/shared/probe-classifiers.ts` passed.

## Decisions Made

- Kept the production source byte-identical because the accepted public seam already exposes every behavior required for direct proof.
- Treated `malformed mcp reference` as the literal `startsWith` contract: one character short does not match, while an adjacent suffix character does.
- Proved that only a direct `SyntaxError` cause selects `unparseable`; a nested `SyntaxError` behind another error keeps `invalid manifest`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P109-16 is ready for phase-level verification and merge.
- No open threats, stubs, skipped tests, unrun checks, or production changes remain.

## Self-Check: PASSED

- The owner test and summary exist in the isolated worktree.
- Both task commits are present and the paired production source is byte-identical to the expected base.
- Runtime phase markers are balanced at 38 arrange, 38 act, and 38 assert blocks.
- The owner contains no skipped tests, placeholders, process-history comments, or coverage exceptions.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

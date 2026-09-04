---
phase: 109-shared-contracts
plan: 08
subsystem: testing
tags: [node-test, extension-version, exact-literal, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for EXTENSION_VERSION
  - Independent exact-literal evidence for the checked-in extension version
affects: [shared-contracts, reconcile, backfill, version-sync]

actuals:
  tokens: 104
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Direct import with an independently authored full-string expectation
    - Supplemental package-sync evidence retained outside the mirrored owner

key-files:
  created:
    - tests/shared/extension-version.test.ts
    - .planning/phases/109-shared-contracts/109-08-SUMMARY.md
  modified: []

key-decisions: []

patterns-established:
  - "A checked-in constant owner compares the complete exported value with an independent literal."
  - "Architecture sync tests supplement, but do not replace, the mirrored owner."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The mirrored owner directly imports EXTENSION_VERSION and pins the complete independent literal 0.17.0."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/extension-version.test.ts#exports the checked-in extension version"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner reaches complete direct coverage without a production or public-surface change."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/extension-version.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The supplemental architecture guard still proves that the checked-in value matches package.json."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/architecture/extension-version-sync.test.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-29
status: complete
---

# Phase 109 plan 08: Extension version owner summary

**A canonical mirrored owner now pins `EXTENSION_VERSION` to the independent full string `0.17.0`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T19:24:32Z
- **Completed:** 2026-08-29T19:30:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added the mirrored owner for `EXTENSION_VERSION` with the exact lowercase arrange, act, and assert structure.
- Compared the complete export with an independent literal instead of package metadata or another production value.
- Reached 100 percent direct function, line, and branch coverage without changing production bytes or exports.
- Retained the architecture version-sync test as separate package-drift evidence.

## Caller-facing contract

`orchestrators/reconcile/backfill.ts` is the only production importer. The load-time backfill compares the persisted `lastReconciledExtensionVersion` stamp with `EXTENSION_VERSION`. An equal value closes the scan gate without a write. After a failure-free scan, the guarded state write stamps the same value.

The constant remains a checked-in, zero-I/O string. Reconciliation callers still observe `0.17.0`, and the public surface still exports only `EXTENSION_VERSION` from this module.

The architecture sync test still compares the constant with the root `package.json` version. The reconcile backfill and apply suites remain supplemental consumer evidence.

## Edge resolution

- **Boundary:** Not applicable. The export accepts no input and has one complete string value.
- **Adjacency and equality:** Not applicable. The export has no adjacent input or comparison domain.
- **Empty values:** Not applicable. Exact equality with `0.17.0` rejects an empty string.
- **Ordering:** Not applicable. The export has no collection or ordering behavior.
- **Numeric precision:** Not applicable. The version is an opaque string, not a numeric calculation.

Exact full-string equality is the complete runtime contract for this pair.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `8d3d1db8` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `4d00b379` (test, no file delta required)

## Files created or modified

- `tests/shared/extension-version.test.ts` - Direct owner for the checked-in extension version value.
- `.planning/phases/109-shared-contracts/109-08-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

None.

## Verification

- `node --test tests/shared/extension-version.test.ts` passed.
- Direct coverage passed at 100 percent: 16/16 lines, 1/1 branches, and 0/0 functions.
- `node --test tests/architecture/extension-version-sync.test.ts` passed.
- `npm run typecheck` passed for the export and its production callers.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source remained byte-identical at SHA-256 `0fbc615e711e6f4bb1f44fab13cfd10fa9a0202543722dea85b2c116912c2bd5`.

## Known stubs

None.

## Threat review

The independent literal owner mitigates drift in the backfill gate. The test-only change adds no endpoint, authentication path, file access, schema change, or other trust boundary.

## User setup required

None. The owner uses one in-process constant and no external service.

## Next phase readiness

P109-08 is ready for phase verification. The remaining independent shared owners can proceed.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `8d3d1db8` and `4d00b379` exist.
- Focused tests, direct coverage, sync, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

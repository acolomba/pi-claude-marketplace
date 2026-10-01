---
phase: 11-cross-marketplace-dependency-allowlist
plan: "01"
subsystem: marketplace-manifest
tags: [typebox, manifest, validation, marketplace-add]
requires:
  - phase: 03-dependency-resolution
    provides: cached marketplace manifest loader
provides:
  - optional string-array dependency marketplace allowlist validated by the compiled manifest schema
  - command and loader tests for valid and malformed policies
affects: [marketplace-info, dependency-closure, install-cascade]
tech-stack:
  added: []
  patterns: [single cached compiled manifest validator]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/manifest.ts
    - tests/domain/manifest.test.ts
    - tests/orchestrators/marketplace/add.test.ts
key-decisions:
  - "Keep allowlist entries verbatim and use the existing TypeBox Check path."
requirements-completed: [XMKT-01]
actuals:
  tokens: 1111
  tasks: 2
  commits: 2
commits: 2
plan_head_before: c690d20f08415df9eb75b103ab6277adce2724fe
duration: 41min
completed: 2026-09-23
status: complete
---

# Phase 11 Plan 01: Marketplace allowlist validation Summary

The cached manifest loader now validates an optional string-array allowlist, and marketplace add rejects malformed policies before recording a marketplace.

## Accomplishments

- Added `allowCrossMarketplaceDependenciesOn` to the compiled TypeBox schema. Absence remains absent in the parsed manifest; downstream consumers can treat it as an empty policy.
- Tested exact array preservation, including empty arrays, duplicates, empty strings, Unicode, control characters, and strings outside dependency-name grammar.
- Tested scalar and mixed-array failures with the validator's exact field path. The real path-source add command emits its existing invalid-manifest notification and leaves state empty.

## Task Commits

1. `1437d3c3` — `feat: validate marketplace dependency allowlist`
2. `01e470f0` — `test: cover marketplace dependency allowlist value shapes`

## Verification

- `node --test tests/domain/manifest.test.ts tests/orchestrators/marketplace/add.test.ts`: 98 passed, 0 failed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest.ts`: 26/26 branches, 4/4 functions, 155/155 lines.
- `SKIP=trufflehog pre-commit run --files ...`: passed for each task's changed files. TruffleHog cannot read a `.git` file worktree, so the repository's worktree skip was used.
- `fallow audit --format json --quiet --explain --gate-marker agent`: warning verdict, no blocking findings. `fallow audit --base HEAD`: no issues in changed files.
- `npm run check`: typecheck, ESLint, workflow lint, fallow, formatting, corresponding-test gates, and direct-coverage negative controls passed. Unit coverage ran 7,598 tests: 7,597 passed and one unrelated architecture test failed. The chain stopped before integration and type-member negative controls.

## Decisions Made

- The optional field remains unnormalized. The existing `Check` call and typed `InvalidMarketplaceManifestError` remain the sole parser and failure path.

## Deviations from Plan

- Task 1's new command test failed intentionally before implementation; the persisted RED evidence returned `RED_EVIDENCE_OK`. The project's pre-commit gate requires direct coverage to pass, so the failing test could not be committed separately. The test and schema shipped in the Task 1 commit.
- Task 2's added cases passed before further production changes because Task 1's schema already enforced the full string-array contract. Task 2 is a test-only commit.
- An ignored worktree-local hardlinked copy of the existing `node_modules` was needed for the type-member gate to resolve declaration paths inside the worktree. No package was installed or changed.

## Issues Encountered

- The overall check failed in unchanged `tests/architecture/fallow-production-mode.test.ts`, case `D-05: duplication analysis keeps its test-inclusive scope`: the test expects fallow duplication report schema version 10, while the installed analyzer reports 9 (`9 !== 10` at line 560). This is outside the three plan-owned files. Focused tests, direct coverage, and changed-file pre-commit gates passed.

## Known Stubs

None.

## Self-Check: PASSED

All three changed files and both task commits exist. No tracked files were deleted.

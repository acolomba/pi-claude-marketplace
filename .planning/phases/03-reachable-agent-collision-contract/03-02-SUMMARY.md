---
phase: 03-reachable-agent-collision-contract
plan: 02
subsystem: agents
tags: [agent-identity, filesystem-safety, discovery]
status: complete
plan_head_before: 08fe8e65a52eaf9416387eb1de316fc8c2f37708
actuals:
  tasks: 3
  commits: 1
requires:
  - phase: 03-01
    provides: Validated nonempty tool mapping and restored coverage baseline
provides:
  - Full-source generated agent names
  - Occupied-target preflight before previous file deletion
  - One reachable duplicate policy owned by discovery
affects: [03-03, 03-04]
tech-stack:
  added: []
  patterns: [real-filesystem ownership preflight]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - tests/domain/name.test.ts
    - tests/bridges/agents/discover.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/bridges/agents/convert.test.ts
key-decisions:
  - Preserve the complete source name, including an existing plugin prefix.
  - Reject occupied newly claimed targets before deleting previous safe targets.
requirements-completed: []
completed: 2026-09-14
---

# Phase 3 Plan 2: Safe full-source agent naming Summary

Generated agent names preserve the complete source identity, and commit refuses unrelated occupied destinations before removing old owned bytes.

## Accomplishments

1. Added commit-entry occupancy checks over new index targets against the safe previous target set. Real prepare/commit cases cover foreign files, directories, dangling symlinks created after prepare, new arrivals, and foreign-preserved indexed rows.
2. Preserved full agent source names and retained plugin/source/generated name validation. Updated complete discovery/staging expectations, including repeated prefixes, punctuation, exact plugin names, and trailing hyphens.
3. Removed the unreachable converter collision assertion, its staging call, and its manufactured duplicate-array tests. Preserved the existing nonempty tool assertion from 03-01.

The partial-rename test now removes the later staged file after real preparation. It still proves that a completed earlier rename is reversed; the existing rollback-leak and cleanup-cause assertions remain.

## Verification

- Intentional RED: `/tmp/agents-red.log` showed occupied new files being overwritten instead of rejected. A pre-existing dangling symlink was rejected earlier by path safety, so that fixture creates its symlink after prepare.
- Intentional naming RED: `/tmp/agents-names-red.log` showed the old elided names disagreeing with full-source expectations.
- `node --test tests/domain/name.test.ts tests/bridges/agents/discover.test.ts tests/bridges/agents/convert.test.ts tests/bridges/agents/stage.test.ts`: 160 passed at the naming/diagnostic checkpoint; later additional stage cases passed in the full stage/install run.
- Direct coverage, one CLI invocation per production path, in `/tmp/agents-all-direct.log`:

| Owner | Lines | Functions | Branches |
|---|---:|---:|---:|
| domain/name.ts | 167/167 | 4/4 | 32/32 |
| agents/convert.ts | 717/717 | 23/23 | 117/117 |
| agents/discover.ts | 119/119 | 3/3 | 14/14 |
| agents/stage.ts | 639/639 | 26/26 | 109/109 |

Typecheck passed at the earlier migration checkpoint. Final integrated typecheck, lint, aggregate coverage and `npm run check` are parent-owned and pending. A duplicate executor lint process was intentionally stopped while the parent lint continued.

## Deviations from Plan

Three existing install tests assumed that a newly generated file could overwrite a foreign-preserved row. Their fixtures now install a distinct new agent while keeping the retired foreign row, as the approved soft-preservation contract requires. Existing checks remain; exact foreign bytes, complete failure details and the full ordered orchestrated warning result are additionally asserted in the install-flow and install-outcome owners.

The implementation adds no concurrency guarantee after commit-entry preflight. Existing transaction serialization remains the protection against concurrent extension operations.

### Review repair: index-persistence failure retry

Independent review reproduced an index-write failure after newly named files had landed. Those files remained on disk while the index still named the old targets, so the new occupancy guard blocked both commit and forced replacement retry. Moved `saveAgentsIndex` into the existing completed-renames try/catch. A persistence failure now reverses the new files into staging and cleans them up; old indexed files may remain absent under the established commit recovery contract.

Four real filesystem tests make the extension root read-only after prepare. They cover prefixed-only migration and coexistence, followed by either commit retry or forced replacement retry. All four failed before the repair because unrecorded files remained, and all four pass afterward. They compare unchanged old index bytes, complete failure state, complete regenerated bytes/provenance and final index rows. The recorded native failure is EACCES opening the atomic index temporary file.

Latest full stage owner: 46/46 passed. Direct coverage is now 638/638 lines, 26/26 functions, 113/113 branches (`/tmp/agents-index-failure-direct.log`). Focused lifecycle migration/foreign/forced-replacement checks: 16/16 passed (`/tmp/agents-index-failure-lifecycle.log`). Raw RED and GREEN logs are `/tmp/agents-index-failure-red.log` and `/tmp/agents-index-failure-green.log`. The GSD RED validator could not parse the Node spec-format log; the raw log records all four assertion failures. Parent owns the next integrated measurement.

Typecheck passed after the repair (`/tmp/agents-index-failure-typecheck.log`).

## Commit and Finalization Status

Committed in `b663bc68` with the other coordinated Phase 3 plans. Independent goal verification passed 18/18.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.

## Self-Check: PASSED

All listed files exist. The recorded base commit exists. No new stubs, skipped tests, test-only exports, exclusions or threshold reductions were introduced. Commit and final verification evidence are recorded above.

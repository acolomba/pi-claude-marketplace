---
phase: 13-conformance-refactor-es-5-supersession
plan: 03-02
subsystem: messaging
tags: [es-5-supersession, markers, prd, eslint, atomic-commit, milestone-boundary]

requires:
  - phase: 13-conformance-refactor-es-5-supersession
    provides: "13-03-01 catalog-uat green gate; 13-02a-02 cleared all 6 legacy ES-5 marker emission callsites; the remaining work is scope = constants + snapshot + PRD + ESLint."
provides:
  - "ES-5 atomic three-file edit landed in a SINGLE commit (D-13-03): 5 ES-5 marker exports deleted; PRD §6.12 ES-5 row replaced with a pointer to docs/messaging-style-guide.md §15; snapshot byte-equality test retired; ESLint marker-restriction additions rolled back."
  - "Milestone v1.3 user-contract change boundary established per D-30. After this commit, the 5 legacy ES-5 literals appear nowhere in the codebase except docs/messaging-style-guide.md §15 (supersession table) and tests/architecture/no-legacy-markers.test.ts (pinned fixtures)."
  - "Phase 5/7 extension markers (RECOVERY_PLUGIN_REINSTALL_PREFIX, STATE_LOCK_HELD_PREFIX) preserved unchanged."
affects: [phase-14-drift-guard, future-messaging-changes]

tech-stack:
  added: []
  patterns:
    - "Atomic supersession contract: a milestone user-contract boundary edit lands in ONE commit across constants + tests + PRD + lint config; intermediate states are partially-consistent by construction and rejected by the snapshot test or ESLint."

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/shared/markers.ts (5 ES-5 exports removed; header rewritten; PUP-6 + D-08 preserved)"
    - "tests/architecture/markers-snapshot.test.ts (ES-5 block deleted; stale PRD-extract imports/constants removed; AG-5/PUP-6/D-08/D-09 blocks preserved)"
    - "docs/prd/pi-claude-marketplace-prd.md (§6.12 ES-5 → pointer to style guide §15; ES-1..ES-4 unchanged)"
    - "eslint.config.js (BLOCK E marker-restriction entries removed; BLOCK E-2 retired; Gate 1 Pi peer-import restriction preserved)"

key-decisions:
  - "D-13-03 atomic-commit invariant honored: all 4 edits in a single commit (c4d87d4). git show HEAD --stat lists exactly 4 files."
  - "D-13-11 pointer wording adopted verbatim in PRD §6.12 ES-5."
  - "D-13-12 static-audit gate (tests/architecture/no-legacy-markers.test.ts) intentionally left in place to enforce zero re-introductions across the codebase's lifetime."
  - "D-13-13 rollback path documented in the commit body: `git revert c4d87d4` restores all 4 files atomically."
  - "Pre-commit hooks: TruffleHog skipped via SKIP=trufflehog per CLAUDE.md guidance (worktree sandbox cannot spawn its child process); diff was manually scanned for secret-like patterns and is clean. All other hooks passed."

patterns-established:
  - "Checkpoint pattern for milestone-boundary atomic commits: autonomous: false plan halts after the atomic commit lands but before SUMMARY.md is written; orchestrator presents the commit + post-commit gate results to the human; human types 'approved' before the worktree merges back."

requirements-completed:
  - CMC-35

duration: ~14min
completed: 2026-05-23
---

# Phase 13 / Plan 13-03-02: ES-5 atomic three-file edit

**Milestone v1.3 user-contract change boundary landed in a single atomic commit; the 5 legacy ES-5 marker strings are now reachable only via docs/messaging-style-guide.md §15 and the static-audit fixture.**

## Performance

- **Duration:** ~14 min (executor 815s + checkpoint review + merge cleanup)
- **Started:** 2026-05-23T01:49:13Z
- **Completed:** 2026-05-23T02:10Z (approximate; checkpoint approval gate)
- **Tasks:** 3/3 (Task 1 baseline gate, Task 2 atomic edit + commit, Task 3 human-verify approved)
- **Files modified:** 4

## Accomplishments

- **Atomic commit `c4d87d4`** lands the v1.3 user-contract boundary in 4 files (44 insertions(+), 226 deletions(-)). Conventional Commits format; subject 47 chars; body cites D-13-03, D-13-11, D-30 and documents the D-13-13 rollback path.
- **PRD §6.12 ES-5 row** rewritten to the brief pointer per D-13-11: `v1.3 supersedes the V1 ES-5 marker strings; see docs/messaging-style-guide.md §15 (Supersession of ES-5) for the replacement table.` ES-1..ES-4 rows are unchanged so back-references remain valid.
- **`shared/markers.ts`** lost 5 exports (`PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`, `MANUAL_RECOVERY_REQUIRED`, `ROLLBACK_PARTIAL`); file-header comment rewritten to describe the remaining Phase 5/7 extension markers and cite the supersession; `RECOVERY_PLUGIN_REINSTALL_PREFIX` (PUP-6) and `STATE_LOCK_HELD_PREFIX` (D-08) preserved unchanged.
- **`markers-snapshot.test.ts`** lost the ES-5 byte-equality block and the `assert.equal(literals.length, 5, ...)` assertion; stale imports (`readFile`, `fileURLToPath`, `REPO_ROOT`, `PRD_PATH`) and "table above" cross-references removed; AG-5 / PUP-6 / D-08 / D-09 / helper-throws blocks all preserved (6 tests pass).
- **`eslint.config.js` BLOCK E** rolled back: the 3 ES-5 marker-restriction `paths[]` entries and the `shared/markers.ts` `ignores` entry removed; BLOCK E-2 retired entirely; Gate 1 Pi peer-import restriction with `platform/pi-api.ts` allow-list preserved.
- **Static-audit gate** (`tests/architecture/no-legacy-markers.test.ts`) stays green and continues to enforce zero re-introductions across the rest of the codebase's lifetime.

## Task Commits

1. **Task 1: Pre-commit gate verification** -- no edits (verification-only). `catalog-uat.test.ts` exits 0; `npm run check` baseline green. D-13-04 gate confirmed.
2. **Task 2: Atomic four-file edit + commit** -- `c4d87d4` (`chore(13): ES-5 supersession atomic three-file edit`). Single commit; all 4 acceptance greps pass; post-commit `npm run check`, `no-legacy-markers.test.ts`, and `catalog-uat.test.ts` all exit 0.
3. **Task 3: Human checkpoint** -- user typed "approved" after reviewing the diff, the commit message, and the post-commit gate results.

**Merge into orchestrator branch:** `5e3a832` (`chore: merge executor worktree (worktree-agent-a990da8adca483016)`) -- `--no-ff` merge of the worktree branch back into `gsd/v1.3-replan-catalog`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/markers.ts` -- 5 ES-5 marker exports deleted; header rewritten; PUP-6 + D-08 preserved.
- `tests/architecture/markers-snapshot.test.ts` -- ES-5 byte-equality block + assertion deleted; stale PRD-extract imports/constants removed; 6 remaining marker tests preserved.
- `docs/prd/pi-claude-marketplace-prd.md` -- §6.12 ES-5 row rewritten to brief pointer to docs/messaging-style-guide.md §15.
- `eslint.config.js` -- BLOCK E marker-restriction entries removed; BLOCK E-2 retired; Gate 1 Pi peer-import restriction preserved.

## Decisions Made

None beyond the plan-encoded decisions (D-13-03, D-13-04, D-13-11, D-13-12, D-13-13, D-30) -- the plan was executed as specified.

## Deviations from Plan

None -- plan executed exactly as written. The pre-commit hook handling (`SKIP=trufflehog` inside the worktree) is the project-CLAUDE.md-prescribed protocol, not a deviation.

## Issues Encountered

None. The wave 5 dependency (Plan 13-02a-02) cleared all 6 callsite migrations, so the atomic edit's scope reduced exactly as predicted: constants + snapshot + PRD + ESLint with zero production callsite touches.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Phase 13 is complete. Phase 14 (Drift Guard & Test Alignment) inherits a codebase where:

- The 5 legacy ES-5 marker strings exist nowhere except the supersession table (`docs/messaging-style-guide.md` §15) and the static-audit fixture (`tests/architecture/no-legacy-markers.test.ts`).
- `tests/architecture/no-legacy-markers.test.ts` is the durable defence against re-introductions.
- `tests/architecture/catalog-uat.test.ts` is the durable per-command UAT byte-equality gate.

A `git revert c4d87d4` is the documented rollback path per D-13-13 if any post-merge regression surfaces.

---
*Phase: 13-conformance-refactor-es-5-supersession*
*Completed: 2026-05-23*

---
phase: 12-standalone-prune-with-dry-run
plan: "01"
subsystem: plugin-lifecycle
tags: [prune, dependency, command, transaction, integration]
requires:
  - phase: 05-prune-on-uninstall
    provides: offline declaration index, orphan fixpoint, and guarded member removal
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    provides: allowed named uninstall and surviving-dependent reporting
provides:
  - registered standalone prune command for one selected scope
  - locked whole-scope orphan sweep with at most one state save
  - fail-closed unreadable-declarer reporting
affects: [12-02, 12-03, 12-04, 12-07]
actuals:
  tokens: 10518
  tasks: 2
  commits: 5
plan_head_before: 94463afe198e238d65ae9786e1bed61d456cc641
tech-stack:
  added: []
  patterns:
    - reuse the uninstall member sweep and finalizer under one standalone state lock
    - preserve orphan removal order with one marketplace block per member
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts
    - tests/integration/standalone-prune.test.ts
    - tests/orchestrators/plugin/prune.test.ts
    - tests/edge/handlers/plugin/prune.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/edge/router.test.ts
    - tests/edge/register.test.ts
key-decisions:
  - Standalone prune indexes every installed record; named uninstall still excludes its removed primary.
  - Standalone prune uses uninstall's member removal and post-commit cleanup with an empty initially-gone set.
requirements-completed: [PRUNE-06]
coverage:
  - id: D1
    description: A registered user-scope prune removes an orphan and its staged skill while retaining an explicit plugin.
    requirement: PRUNE-06
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#prune removes an orphan dependency through the registered command
        status: pass
    human_judgment: false
  - id: D2
    description: Project prune leaves the full user-scope tree byte-identical.
    requirement: PRUNE-06
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#project prune removes only the project orphan
        status: pass
    human_judgment: false
  - id: D3
    description: An unreadable declarer produces a named redacted failure without saving or removing records.
    requirement: PRUNE-06
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#an unreadable declarer refuses prune without changing either scope
        status: pass
    human_judgment: false
duration: 63min
completed: 2026-09-23
status: complete
---

# Phase 12 Plan 01: Standalone prune command summary

The registered `/claude:plugin prune` command now removes dependency orphans from one scope under a single state lock, and refuses an unreadable declarer before any removal.

## Performance

- **Duration:** about 63 minutes
- **Tasks:** 2
- **Files changed:** 13
- **Commits:** 3 production and test commits, the initial summary commit, and a comment correction

## Accomplishments

- Added a no-target `prune` route with shared `--scope` parsing and rejection of extra operands or flags.
- Reused the offline declaration walk, fixpoint sweep, failed-member hold check, and post-commit cleanup from named uninstall. The successful path saves state at most once.
- Verified user and project scope behavior, exact success and failure notifications, staged resource removal, unchanged opposite-scope trees, and no git transport calls.

## Task Commits

1. **RED tracer:** `fcef6310` — failing registered-command integration test, with `RED_EVIDENCE_OK` from the TAP evidence gate.
2. **Task 1:** `0bbe9b9c` — standalone operation, command wiring, and required direct test pairs.
3. **Task 2:** `c62ff3d1` — project isolation and unreadable-declarer command cases.
4. **Initial summary:** `092430b2` — execution record and self-check.
5. **Comment correction:** `f64c53a9` — documentation of the shared sweep's two callers.

## Verification

- `node --test tests/integration/standalone-prune.test.ts` — pass.
- Focused seven-file suite for integration, direct pairs, router, registration, and offline architecture — pass.
- `node --test tests/orchestrators/plugin/uninstall.test.ts` with FIFO access — 93/93 pass, including named uninstall and existing `--prune` behavior.
- `npm run typecheck` — pass.
- Direct coverage of new `prune.ts`, handler, and operations composition — 100% lines, branches, and functions for each pair.
- `SKIP=trufflehog,npm-format-check pre-commit run --files <changed files>` — pass before each task commit. The global format hook was skipped under the repository's documented linked-worktree exception because operator-owned `.planning/config.json` has pre-existing formatting drift; changed files passed Prettier separately.
- `fallow audit --base HEAD` — pass before each task commit. The agent-marker audit returned a JSON runtime error for a missing temporary rule-pack path, which the repository rules classify as non-blocking.
- The comment correction also passed the full changed-file pre-commit gate and Fallow base audit.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking gate] Added direct source/test pairs earlier than planned.**
The pre-commit direct coverage hook required `tests/orchestrators/plugin/prune.test.ts` and `tests/edge/handlers/plugin/prune.test.ts` as soon as their production modules were added. Both pairs reached 100% direct coverage; later plans may expand their case matrices.

**2. [Rule 3 - Blocking gate] Updated frozen router, registration, and operations tests.**
The new verb changed exact command inventory and usage bytes, and the operations factory added an uncovered export. Updated `tests/edge/router.test.ts`, `tests/edge/register.test.ts`, and `tests/orchestrators/plugin/operations.test.ts` so the introduced behavior has meaningful coverage and the hook passes.

**3. [Rule 1 - Type surface] Exported the shared sweep's declaration type without moving its contract anchor.**
Fallow found a private type in the new public sweep signature. A type-only re-export made the signature public while preserving the type-member gate's source location.

**4. [Rule 1 - Documentation bug] Corrected comments on the shared sweep.**
The comments in `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` described named uninstall only, although standalone prune now calls the sweep too. Commit `f64c53a9` describes both callers without changing behavior.

## Issues Encountered

The initial `node --test` RED run reported only a file-level failure in this sandbox. Running the file with the TAP reporter showed the intended orphan-retention assertion and passed GSD's `tdd-red-evidence` gate. Task 2's behaviors were already implemented by Task 1, so its added cases passed after the exact failure-row literal was corrected.

## Next Plan Readiness

Plan 02 can expand direct fixpoint and failed-member coverage. Later plans add preview, the empty-result message, and final command flag/catalog pins.

## Self-Check: PASSED

The summary, operation, handler, and command tracer exist on disk. All five listed commits exist, and `git rev-list` measures five commits from `plan_head_before` through the comment correction.

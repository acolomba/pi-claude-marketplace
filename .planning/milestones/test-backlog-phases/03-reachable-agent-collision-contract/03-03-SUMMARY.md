---
phase: 03-reachable-agent-collision-contract
plan: 03
subsystem: agents
tags: [duplicate-diagnostics, discovery, lifecycle, documentation]
status: complete
plan_head_before: 08fe8e65a52eaf9416387eb1de316fc8c2f37708
actuals:
  tasks: 3
  commits: 1
requires:
  - phase: 03-02
    provides: Full-source naming and safe new-target commits
provides:
  - First-discovered exact-name duplicate warnings with both complete paths
  - Complete warning propagation through install, update and reinstall
  - Reconciled AG-12, RN-1 and RN-6 contracts
affects: [03-04]
tech-stack:
  added: []
  patterns: [discovery-owned exact-name duplicate resolution]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/discover.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - tests/bridges/agents/discover.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - docs/prd/pi-claude-marketplace-prd.md
key-decisions:
  - Exact duplicates retain the first source in resolved directory and filename traversal order.
  - Diagnostics identify both full source paths and the retained source.
requirements-completed: []
completed: 2026-09-14
---

# Phase 3 Plan 3: Reachable duplicate diagnostics Summary

Discovery retains the first exact source name and reports the incoming and retained file paths through every lifecycle operation.

## Accomplishments

1. Updated the private duplicate formatter to use the incumbent discovered record and incoming source path. The map remains keyed by generated name because complete-source naming preserves distinct identities within a plugin.
2. Added real same-directory, filename-fallback and reversed-directory discovery expectations. A prepare/commit case compares the complete winning file, provenance, index and warning. Existing multi-warning ordering assertions remain.
3. Updated the declared-directory install/update/reinstall cases to expect complete warnings. Added a fresh install with both `hello-reviewer` and `reviewer`, checking complete outcome, resource names, file contents and index rows.
4. Reconciled AG-12, RN-1, RN-6, the testing inventory and live type comments. Documented indexed-name migration and newly claimed target protection while retaining reinstall's previous-target overwrite permission.

## Verification

- Intentional diagnostic RED: `/tmp/agents-duplicates-red.log` showed old directory-only/elision warnings disagreeing with complete path-bearing expectations.
- Focused PDEF-01 lifecycle owners: 7/7 passed (`/tmp/agents-flows.log`).
- Fresh-install and initial reinstall migration focus: 6/6 passed (`/tmp/agents-lifecycle.log`).
- Full affected owner run: 578 executed, 576 passed and 2 pre-existing foreign-target fixture assumptions failed (`/tmp/agents-full-owners.log`). Both fixtures were corrected to retain their soft-preservation behavior with nonconflicting newly generated agents.
- Final focused foreign-preservation run: 2/2 passed (`/tmp/agents-foreign-final.log`), including the complete ordered warning list and unchanged foreign file bytes.
- The first integrated full-unit run found one more legacy fixture in install-outcome.test.ts with the same conflicting-target assumption. Its source is now new-gamma while the retired indexed gamma file is preserved. The case additionally checks complete agentForeignFailures, new staged names and unchanged foreign bytes; see `/tmp/agents-outcome-full.log` for the full owner result.
- Discover direct pair: 119/119 lines, 3/3 functions, 14/14 branches.
- Stage direct pair: 639/639 lines, 26/26 functions, 109/109 branches.
- Earlier migration typecheck passed. Parent owns final integrated typecheck/lint/format/full-unit/`npm run check` evidence.

No aggregate counts are claimed until the integrated measurement completes.

## Deviations from Plan

The existing AS-7 and orchestrated foreign-file scenarios were updated to install `new-bot` while preserving the retired indexed `bot` target. Their prior fixture depended on overwriting the same foreign file, which the approved new preflight correctly refuses. The orchestrated test now checks the complete outcome and both ordered warnings instead of searching for a substring.

The parent explicitly extended ownership to tests/orchestrators/plugin/install-outcome.test.ts after the integrated run exposed its equivalent AS-7 fixture. This test-only adjustment preserves the reachable soft-failure warning contract; it does not change any additional production module.

Parent independently changed marketplace sections of the PRD after the agent contract edits were complete. Final documentation diff attribution and formatting are coordinated by the parent.

## Commit and Finalization Status

Committed in `b663bc68` with the other coordinated Phase 3 plans. Independent goal verification passed 18/18.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.

## Self-Check: PASSED

All modified artifacts and the base commit exist. No new stubs, skipped tests, unreachable test seams or reduced coverage thresholds were introduced. Failed intermediate checks and their subsequent corrections are recorded above.

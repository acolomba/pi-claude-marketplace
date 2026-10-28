---
phase: 01-staging-warning-channels
fixed_at: 2026-10-28T15:50:28Z
review_path: .planning/phases/01-staging-warning-channels/01-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-10-28T15:50:28Z
**Source review:** .planning/phases/01-staging-warning-channels/01-REVIEW.md at `d9851f43`
**Iteration:** 2

**Summary:**

- Findings in scope: 1 (remaining CR-01)
- Fixed: 1
- Skipped: 0

## Fixed Issues

### CR-01: Final-root validation abort still drops committed dependency MCP notices

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts`, `test/orchestrators/plugin/install-flow-ledger.test.ts`, `features/plugin/staging-warnings.feature`, `features/lib/npm-registry.ts`, `features/step_definitions/config.steps.ts`
**Commit:** `4bcdf9697b87ea97d21face0154933e6c7f625a5`
**Status:** fixed: requires human verification

**Applied fix:** Every non-throwing final transaction outcome now reaches one `withMcpConfigNotices` boundary after its rows and diagnostics. Invalid config, absent marketplace, refusal, and declaration outcomes retain prior dependency notices. Promotion, installed, and disable-failure outcomes add their own notices to that list. The dependency-planning arm delegates to the next install, whose finalizer owns emission, without emitting a second copy. The caught-failure path retains its existing finalizer. Empty notice lists still leave the outcome property absent. Orchestrated installs return notices without sending notifications.

Two new unit cases call the real `createInstallPlugin` entry point, one per notification mode. Their transaction wrapper edits the config only after the dependency update has committed. They assert the exact `comments-dropped` payload, the entire standalone notification sequence (failed rows followed by one notice), zero orchestrated notifications, and the durable dependency versions and MCP configuration.

The new Cucumber scenario drives the real `/claude:plugin install` command through Pi. The local npm stand-in runs a one-shot callback before answering the moved dependency's package request. The callback writes a malformed local config through the existing layer-config writer. Dependency work commits, then the final root transaction rejects the edited config. The scenario compares every result and row, the exact notice payload, the edited config text, and the registry's complete request list. No production test seam or timing delay was added.

**Regression proof:** Temporarily removed only this finding's source diff. Both new unit cases failed because `mcpConfigNotices` was absent, and the new Cucumber scenario failed because the notice result was absent. Both commands exited 1. Restored the exact source diff with `git apply` in a `finally` block. With the fix, all three cases pass.

The prior iteration's commits `15e12fdf` and `da9756bd` remain intact. CR-02 was already closed in the source review and is not counted in this iteration.

## Verification

All checks ran in the existing isolated checkout `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`, on `agent-reverify-a`, using Node `v26.12.1`. The owner temporarily set `workflow.use_worktrees=false`; no nested worktree or recovery sentinel was created. The fixer neither changed nor staged `.planning/config.json`.

- Re-read modified source and fixture sections and traced their callers.
- `node --test --test-name-pattern 'keeps dependency MCP notices when the final config' test/orchestrators/plugin/install-flow-ledger.test.ts` passed both new cases.
- `node --test --test-name-pattern 'keeps dependency-step MCP notices' test/orchestrators/plugin/install-flow-planning.test.ts` passed all four existing successful-install and later-move-failure cases.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts` exited 0. The full owner suite met 100% line, function, and branch coverage.
- `npx cucumber-js features/plugin/staging-warnings.feature` exited 0: 20 scenarios and 248 steps passed.
- `SKIP=npm-check pre-commit run --files <five changed paths>` passed after formatting.
- `fallow audit --base HEAD --format json --quiet` passed before the commit, reporting no introduced dead-code, complexity, or duplication findings.
- The successful commit passed `npm run check:commit`, including typecheck, lint, Fallow, feature validation, unpaired tests, and staged-pair direct coverage. The first attempt found four missing blank lines; these were corrected before the successful retry. No hook was bypassed.
- `git diff --check` passed. No uncommitted build inputs remain.

The combined-tree `npm run check` gate remains the coordinating workflow's responsibility. Focused checks and commit hooks do not substitute for that gate. This report is intentionally uncommitted for the coordinator.

---

_Fixer: gsd-code-fixer_
_Iteration: 2_

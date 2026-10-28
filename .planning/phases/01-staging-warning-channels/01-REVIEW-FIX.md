---
phase: 01-staging-warning-channels
fixed_at: 2026-10-28T15:05:48Z
review_path: .planning/phases/01-staging-warning-channels/01-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-10-28T15:05:48Z
**Source review:** .planning/phases/01-staging-warning-channels/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (CR-01 and CR-02)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### CR-01: Install drops MCP notices from dependency steps that already changed the file

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts`, `test/orchestrators/plugin/install-flow-planning.test.ts`, `test/orchestrators/plugin/install-flow-dependency-ledger.test.ts`, `features/plugin/staging-warnings.feature`
**Commit:** `15e12fdf`
**Status:** fixed: requires human verification

**Applied fix:** Dependency-step notices now reach both the failed-moves projection and the final install through `InstallAfterPlan`. The final install prepends prior notices to its own notices before the existing mode-selected emission, including its caught-failure path. Failed dependency moves use that same emission helper. Orchestrated installs return the notices without sending a notification; standalone installs emit them once after their rows and diagnostics.

Four new unit cases cover successful installs and a later dependency move failing, each in standalone and orchestrated modes. They assert the exact `comments-dropped` notice; the successful standalone case also compares the complete notification sequence. Two new Cucumber scenarios compare the complete results and rows for the success and later-move-failure cases. No new step definition was needed.

**Regression proof:** Removing only this finding's source diff made all four new unit cases fail because the notice was absent. The source diff was restored in a `finally` block. All three modified source modules passed their own direct-coverage checks.

### CR-02: Install member diagnostics no longer follow their row order

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts`, `test/orchestrators/plugin/install-flow-ledger.test.ts`, `test/orchestrators/plugin/install-flow-results.test.ts`, `features/plugin/staging-warnings.feature`
**Commit:** `da9756bd`
**Status:** fixed: requires human verification

**Applied fix:** The root and dependency diagnostics are composed together and sorted with `compareByNameThenScope`, using the root's displayed name and each dependency's qualified row key. The root's member entry is excluded so it cannot emit twice. Diagnostic headers retain the root's display name and each member's plugin name. The ordered entries still pass through the discovery-only renderer, after the cascade and before MCP notices.

A new install-owner case compares the complete notification sequence when `zroot` depends on `aaa` and both produce notes. The projection case now checks member ordering, distinct row and header names, the root's displayed name, and exclusion of its duplicate member entry. A new Cucumber scenario compares every notification and row for the same root-after-dependency ordering.

**Regression proof:** Removing only this finding's source diff made the Cucumber scenario fail on the reversed `zroot` and `aaa` diagnostics. The source diff was restored in a `finally` block. Both modified source modules passed their own direct-coverage checks.

## Verification

All checks ran in the existing isolated checkout `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`, on `agent-reverify-a`, using Node `v26.12.1`. The owner temporarily set `workflow.use_worktrees=false`; no nested worktree or recovery sentinel was created. The fixer neither changed nor staged `.planning/config.json`.

- Re-read all changed source sections and checked their callers.
- `npm run test:coverage:direct -- <source paths>` passed for the three CR-01 modules and the two CR-02 modules. Each pair met the required 100% line, function, and branch coverage.
- `SKIP=npm-check pre-commit run --files <changed paths>` passed before each successful commit, after applying formatting fixes.
- `fallow audit --base HEAD` passed before each successful commit.
- Both successful commits passed the mandatory `npm run check:commit` hook, including typecheck, lint, Fallow, feature validation, unpaired tests, and staged-pair direct coverage. CR-02 hook failures were corrected before its successful commit; no hook was bypassed.
- At final commit `da9756bd`, `npx cucumber-js features/plugin/staging-warnings.feature` exited 0: 19 scenarios and 227 steps passed.
- `git diff --check` passed. No uncommitted build-input changes remain from this fixer.

The combined-tree `npm run check` gate remains the coordinating workflow's responsibility. Focused checks and commit hooks do not substitute for that gate. This report is intentionally uncommitted for the coordinator.

---

_Fixer: gsd-code-fixer_
_Iteration: 1_

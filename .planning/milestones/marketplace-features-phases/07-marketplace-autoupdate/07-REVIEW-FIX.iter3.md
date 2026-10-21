---
phase: 07-marketplace-autoupdate
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-10-20
**Source review:** .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 1 (WR-03; the Info findings IN-01 to IN-03 are out of scope)
- Fixed: 1
- Skipped: 0

Iteration 1 fixed WR-01 (commit 4a40a0c2) and WR-02 (commit e32d79a1). Its report is kept in `07-REVIEW-FIX.iter2.md`. This iteration adds one scenario. No production code changed.

## Fixed Issues

### WR-03: No scenario covers a nameless `noautoupdate` without `--local`, so D-04 in the disable direction rests only on a unit test

**Files modified:** `features/marketplace/autoupdate.feature`
**Commit:** 7732b694
**Applied fix:** Added the scenario "Disabling autoupdate for every marketplace sets the base config and leaves a local entry without a value to inherit it", as the reviewer wrote it. It sits after the two nameless enable scenarios it mirrors (line 326). The project scope adds `tools` to the base config, turns autoupdate on there, and adds a local entry without a value. Then `/claude:plugin marketplace noautoupdate --scope project` runs. The scenario expects one `autoupdate disabled` row, a tally of 1, `autoupdate: false` in `claude-plugins.json`, and a local entry with no `autoupdate` column.

**Non-vacuity proof:**

- Mutation in `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`, `inheritAfterFlip`: `return (name) => enable && ownValue(base.config.marketplaces, name) !== undefined;` became `return (name) => ownValue(base.config.marketplaces, name) !== undefined;`. This drops the `enable &&` term, as the finding names.
- Result: 35 scenarios, 34 passed and 1 failed. Only the new scenario failed, at `Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:`. The actual table was `name | source | autoupdate` / `tools | {home}/marketplaces/tools | false`, so the local entry gained the explicit `autoupdate: false` that D-04 forbids. The row step still passed (`autoupdate disabled`), which matches the finding: a user sees no sign of the extra local override.
- `git checkout --` restored the file. `git diff --quiet -- extensions/` exited 0 before the commit.

## Verification

All checks ran in the main checkout of this worktree (`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`, branch `features/cucumber-behavioral-tests`). No separate review-fix worktree was created, as in iteration 1. A bare git worktree has no `node_modules`, so `cucumber-js`, `check:features`, and the commit hook's `check:commit` could not run there. The results can be reproduced from this tree.

- Cucumber ran with a temporary `HOME`, `TMPDIR`, and `PI_CODING_AGENT_DIR` in the session scratchpad. It never touched the real `~/.pi/agent`.
- `npx cucumber-js features/marketplace/autoupdate.feature` exited 0 (35 scenarios, 345 steps).
- `npm run check:features` exited 0.
- `SKIP=npm-check pre-commit run --files features/marketplace/autoupdate.feature` exited 0. The commit hook ran `npm run check:commit`, which passed, and gitlint, which passed.
- The full `npm run check` was not run. The orchestrator runs it after the fix loop.

---

_Fixed: 2026-10-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

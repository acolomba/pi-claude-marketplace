---
phase: 07-marketplace-autoupdate
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-10-20
**Source review:** .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
**Iteration:** 3

**Summary:**

- Findings in scope: 2 (WR-04, WR-05; the Info findings IN-01 to IN-03 are out of scope)
- Fixed: 2
- Skipped: 0

Iteration 1 fixed WR-01 (commit 4a40a0c2) and WR-02 (commit e32d79a1); its report is in `07-REVIEW-FIX.iter2.md`. Iteration 2 fixed WR-03 (commit 7732b694); its report is in `07-REVIEW-FIX.iter3.md`. This iteration adds two scenarios and one unit row. No production code changed.

## Fixed Issues

### WR-04: No scenario starts from a base entry with an explicit `autoupdate: false`, so `inheritFrom` can read "the base sets a value" as "on"

**Files modified:** `features/marketplace/autoupdate.feature`, `tests/orchestrators/marketplace/autoupdate.test.ts`
**Commit:** 5cc95f04
**Applied fix:**

- Added the scenario "Disabling autoupdate with --local skips a local entry without a value while the base layer has it set off", as the reviewer wrote it. It sits right after the D-03 scenario whose base entry has no value (now line 425). The base entry gets an explicit `false` from `autoupdate` then `noautoupdate`. A local entry without a value is added. Then `noautoupdate tools --scope project --local` runs. The scenario expects `skipped` / `already no autoupdate`, a local entry with no `autoupdate` column, and base `autoupdate: false`.
- Added the row "inherits off from a base entry that has it off" to `inheritedNamedLocalCases` (line 642), after the "base entry without a value" row. It expects `● mp [user] <no autoupdate> {already no autoupdate}` and unchanged bytes.

**Non-vacuity proof:**

- Mutation M1 in `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`, `inheritFrom`: `ownValue(base.config.marketplaces, name)?.autoupdate ?? false` became `ownValue(base.config.marketplaces, name)?.autoupdate !== undefined`.
- Cucumber: 36 scenarios, 35 passed and 1 failed. Only the new scenario failed, at `Then the result lists these marketplaces:`. The actual row was `tools | project | autoupdate disabled` against the expected `tools | project | skipped | already no autoupdate`.
- Unit: 59 tests, 58 passed and 1 failed. Only the new row failed: `LAYER-02: a named --local disable of a local entry without a value inherits off from a base entry that has it off`, with `Didn't expect extension UI.notify("● mp [user] <no autoupdate>") to be called.`
- `git checkout --` restored the file. `git diff --quiet -- extensions/` exited 0 before the commit.

### WR-05: No scenario covers a nameless `noautoupdate` of a local-only entry without a value, so a design that "always writes a local-only entry" passes

**Files modified:** `features/marketplace/autoupdate.feature`
**Commit:** 306f6465
**Applied fix:** Added the scenario "Disabling autoupdate for every marketplace skips a local entry without a value that the base config does not declare", as the reviewer wrote it. It sits right after the enable scenario it mirrors (now line 326). The project scope gets only a local entry without a value. Then `noautoupdate --scope project` runs. The scenario expects a tally of 1 with no failures or warnings, `skipped` / `already no autoupdate`, a local entry with no `autoupdate` column, and no `claude-plugins.json`. The optional unit case the review mentions was not added: the orchestrator scoped WR-05 to the scenario.

**Non-vacuity proof:**

- Mutation M2 in `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`, `inheritAfterFlip`: `return (name) => enable && ownValue(base.config.marketplaces, name) !== undefined;` became `return (name) => enable === (ownValue(base.config.marketplaces, name) !== undefined);`.
- Cucumber: 37 scenarios, 36 passed and 1 failed. Only the new scenario failed, at `Then the result lists these marketplaces:`. The actual row was `tools | project | autoupdate disabled` against the expected `tools | project | skipped | already no autoupdate`. The fields step passed, because the tally is 1 either way.
- `git checkout --` restored the file. `git diff --quiet -- extensions/` exited 0 before the commit.

## Verification

The edits, mutations, checks, and commits ran in an isolated review-fix worktree under `.claude/worktrees/` of this checkout, on a temp branch `gsd-reviewfix/07-757704`. Its `node_modules` was a symlink to this checkout's `node_modules`, so the results match what this tree produces. The worktree's base was this checkout, not the first entry of `git worktree list` (the main repository on `main`), so the fast-forward landed on `features/cucumber-behavioral-tests`. After the fast-forward, the symlink was unlinked (not followed), the worktree and temp branch were removed, and the recovery sentinel was deleted.

- Cucumber and the unit tests ran with a temporary `HOME`, `TMPDIR`, and `PI_CODING_AGENT_DIR` in the session scratchpad. They never touched the real `~/.pi/agent`.
- `npx cucumber-js features/marketplace/autoupdate.feature` exited 0 after each fix: 36 scenarios / 357 steps after WR-04, 37 scenarios / 366 steps after WR-05.
- `npm run check:features` exited 0 after each fix.
- `node --test tests/orchestrators/marketplace/autoupdate.test.ts` exited 0 after each fix (59 tests).
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` exited 0 after each fix.
- `SKIP=npm-check pre-commit run --files <changed files>` exited 0 before each commit. Each commit hook ran `npm run check:commit`, which passed.
- The full `npm run check` was not run. The orchestrator runs it after the fix loop.

---

_Fixed: 2026-10-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_

---
phase: 07-marketplace-autoupdate
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-10-20
**Source review:** .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (WR-01, WR-02; the Info findings IN-01 to IN-03 are out of scope)
- Fixed: 2
- Skipped: 0

Both fixes add scenarios only. No production code changed. Each new scenario passes on the real code. Each one fails against the wrong implementation the finding names. Each mutation was a temporary local edit, and `git checkout --` reverted it. `git diff --quiet -- extensions/` exited 0 before each commit.

## Fixed Issues

### WR-01: No scenario pins that a local-only entry without a value inherits off in a nameless flip without `--local`

**Files modified:** `features/marketplace/autoupdate.feature`
**Commit:** 4a40a0c2
**Applied fix:** Added the scenario "Enabling autoupdate for every marketplace writes a local entry the base config does not declare". The scenario follows the reviewer's suggestion. It sits after the related nameless scenario. The marketplace is added only with `--local`. Then `/claude:plugin marketplace autoupdate --scope project` runs. The scenario expects one `autoupdate enabled` row, `autoupdate: true` in `claude-plugins.local.json`, and no `claude-plugins.json`.

**Non-vacuity proof:**

- Mutation in `orchestrators/marketplace/autoupdate.ts`, `inheritAfterFlip`: `return (name) => enable && ownValue(base.config.marketplaces, name) !== undefined;` became `return (_name) => enable;`. This drops the base-declares check.
- Result: 33 scenarios, 32 passed and 1 failed. Only the new scenario failed, at `Then the result lists these marketplaces:`. The actual row was `tools | project | skipped | already autoupdate` instead of `tools | project | autoupdate enabled`. That is the user-visible lie the finding describes.

### WR-02: AU-09 "changes both" is never shown: no scenario has an unscoped named flip that changes both scopes

**Files modified:** `features/marketplace/autoupdate.feature`
**Commit:** e32d79a1
**Applied fix:** Added the scenario "Enabling autoupdate without a scope changes both scopes that hold the marketplace". It sits after the existing "judges each scope ... on its own" scenario. Both scopes add `tools` with autoupdate off. Then `/claude:plugin marketplace autoupdate tools` runs with no scope. The scenario expects two `autoupdate enabled` rows, project first and then user, and `autoupdate: true` in both base configs.

**Non-vacuity proof (two mutations of `flipScopes`):**

- Mutation A, the finding's form: the loop returns `{ rows, refusals }` right after the first scope whose plan has a non-empty `changed`. Result: 34 scenarios, 32 passed and 2 failed. The new scenario failed at `Then the result lists these marketplaces:` because the `tools | user | autoupdate enabled` row was missing. The existing D-01 nameless scenario ("... lists the changed marketplaces of each scope before the ones already on") also failed, because this mutation also affects nameless flips.
- Mutation B, limited to named flips (`opts.name !== undefined && plan.changed.length > 0`): the AU-09 gap applies to named flips only. Result: 34 scenarios, 33 passed and 1 failed. Only the new scenario failed, with the same missing `tools | user | autoupdate enabled` row. Before this fix, no scenario caught mutation B.

## Verification

All checks ran in the main checkout of this worktree (`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`, branch `features/cucumber-behavioral-tests`). No separate review-fix worktree was created. A bare git worktree has no `node_modules`, so `cucumber-js`, `check:features`, and the commit hook's `check:commit` could not run there. The results can be reproduced from this tree.

- Cucumber ran with a temporary `HOME`, `TMPDIR`, and `PI_CODING_AGENT_DIR` in the session scratchpad. It never touched the real `~/.pi/agent`.
- After WR-01: `npx cucumber-js features/marketplace/autoupdate.feature` exited 0 (33 scenarios, 324 steps). `npm run check:features` exited 0.
- After WR-02: `npx cucumber-js features/marketplace/autoupdate.feature` exited 0 (34 scenarios, 334 steps). `npm run check:features` exited 0.
- For each commit, `SKIP=npm-check pre-commit run --files features/marketplace/autoupdate.feature` exited 0. The commit hook ran `npm run check:commit`, which passed, and gitlint, which passed.
- The full `npm run check` was not run. The orchestrator runs it after the fix loop.

---

_Fixed: 2026-10-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

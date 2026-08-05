---
phase: 93-substitution-completion
fixed_at: 2026-08-03T00:00:00Z
review_path: .planning/phases/93-substitution-completion/93-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 93: Code Review Fix Report

**Fixed at:** 2026-08-03
**Source review:** .planning/phases/93-substitution-completion/93-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope (critical + warning): 1
- Fixed: 1
- Skipped: 0
- Out of scope (info-level, not attempted): 2

## Fixed Issues

### WR-01: reinstall and update orchestrators thread `cwd` by hand with no end-to-end SUB-02 guard

**Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`,
`tests/orchestrators/plugin/update.test.ts`
**Commit:** 9e0fbc00
**Applied fix:** Took the review's preferred test-side remedy (mirror the install
e2e SUB-02 tests) rather than the type-level alternative, which would have made
`cwd` required on the `Stage*Input` interfaces — an API contract change beyond
review-fix scope.

Added end-to-end SUB-02 assertions that exercise the hand-threaded `cwd` on both
orchestrator paths:

- `reinstall.test.ts`: a project-scope reinstall test installs a fixture whose
  skill/command/agent bodies carry `${CLAUDE_PROJECT_DIR}` and
  `${CLAUDE_SKILL_DIR}`, rewrites the source with a fresh marker, reinstalls, and
  asserts the re-staged files substitute `cwd` for `projectDir` (proving the
  reinstall — not the prior install — did the substitution) while keeping
  `${CLAUDE_SKILL_DIR}` literal in the command and agent. A companion user-scope
  test pins the scope gate: `${CLAUDE_PROJECT_DIR}` stays literal.
- `update.test.ts`: a project-scope update test seeds a version-bumped fixture,
  overwrites the plugin source with token-bearing bodies, updates, and asserts
  the re-staged files substitute `cwd` while keeping `${CLAUDE_SKILL_DIR}`
  literal in the command and agent.

Both tests reuse each file's existing harness patterns (`seedMarketplace` /
`writePluginTree` in reinstall; `seedPathMarketplace` with a post-seed source
overwrite in update). A future refactor that drops the `cwd` line from either
`prepareAllHandles` / `prepareUpdateHandles` now fails these assertions instead
of silently shipping un-substituted project dirs.

**Verification:** re-read the edited sections (Tier 1), `npm run typecheck` clean
(Tier 2), the three new tests pass, and the full `npm test` suite is green
(3227 pass, 1 pre-existing skip: the pi-subagents integration test that skips
absent a global peer). Verification ran in the main checkout on branch
`features/env-parity` (no worktree; `workflow.use_worktrees` opt-out path).

## Out of Scope (info-level, not attempted)

These are `info`-severity findings; the fix scope is `critical_warning`, so they
were not attempted. Recorded here for traceability.

### IN-01: description cap applied pre-substitution

**File:** `extensions/pi-claude-marketplace/bridges/skills/stage.ts:169-172`
**Reason:** Info severity, out of `critical_warning` scope. The review itself
marks it low priority and notes the ordering is intentional and pre-existing;
the open question (bound emitted vs authored bytes) is a semantics decision for
the maintainer, not a review-fix.

### IN-02: `name` replacer parameter type-asserted without a runtime guard

**File:** `extensions/pi-claude-marketplace/shared/vars.ts:63-65`
**Reason:** Info severity, out of `critical_warning` scope. The suggested change
(derive `CLAUDE_VAR_PATTERN` from `Object.keys(TOKEN_TO_FIELD)`) is a robustness
refactor of correct-today code; the assertion is sound for the current
four-token alternation.

---

_Fixed: 2026-08-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

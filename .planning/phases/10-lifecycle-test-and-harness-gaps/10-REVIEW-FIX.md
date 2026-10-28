---
phase: 10-lifecycle-test-and-harness-gaps
fixed_at: 2026-10-28T03:57:12Z
review_path: .planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-28T03:57:12Z
**Source review:** `.planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md`
**Iteration:** 1

Both critical findings were fixed in separate commits. No findings were skipped.

## Fixed Issues

### CR-01: The normal reconcile read pass schedules each source replacement twice

**Status:** fixed: requires human verification
**Commit:** `5dd94d67` — `fix(reconcile): schedule each source repair once`
**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts`
- `test/orchestrators/reconcile/read-pass.test.ts`
- `test/orchestrators/reconcile/apply.test.ts`
- `features/plugin/apply.feature`

Removed the redundant source-repair expansion from `planFrom`. Its input already carries the repairs from the locked read pass or the move-settlement replan callback. Fresh plans produced by either replan callback still receive one expansion.

Added an exact one-operation assertion through public `readPassForScope`, and added a source repair to the deferred-enable case to exercise replanning. Added an apply regression requiring one remote clone and one rendered marketplace outcome. Added the scenario “Apply downloads a replacement marketplace once,” which checks the complete HTTPS request log and the added marketplace result.

Before the fix, all three owner regressions failed: the normal and replanned plans each contained two replacements, and apply cloned the replacement twice. The new Cucumber scenario also failed because it observed two GET requests. The rendered outcome alone remained one row, confirming why the request assertion is necessary.

After the fix, direct coverage passed for the read-pass and apply pairs. Both source-repair Cucumber scenarios passed: 2 scenarios, 27 steps. The logic fix retains the required human-verification disposition for the parent review despite these behavioral regressions passing.

### CR-02: Both completion scenarios pass when the provider returns no completions

**Status:** fixed
**Commit:** `2150ca02` — `test(completions): require exact nonempty suggestion sets`
**Files modified:**

- `features/step_definitions/completion.steps.ts`
- `features/marketplace/market-alias.feature`
- `features/plugin/list.feature`

Replaced the equality-of-two-arrays and empty-result assertions with an exact table comparison of labels, insertion values, and descriptions. Insertion values use JSON quotes in the feature tables to preserve significant trailing spaces. The alias and canonical commands each have their own explicit ten-suggestion table; the assertion normalizes neither prefix nor insertion text.

The installed-git-version scenario now includes an installed path plugin, `alpha@extras`, with a newer available version. It requires exactly that suggestion for `update --partial --scope project`, excluding `ghp@tools` whose installed git version remains current. The list result also asserts both plugins and their statuses.

An in-memory empty-provider mutation passed both original scenarios: 2 scenarios, 18 steps, exit 0. With the fixed assertions, the same mutation failed both scenarios at their suggestion tables: 2 failed scenarios, 20 passed steps, 2 failed steps, 2 skipped steps, exit 1. The real provider passed both fixed scenarios: 2 scenarios, 24 steps, exit 0. No provider or production completion code changed.

## Verification

All verification ran in the existing isolated Phase 10 worktree at `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p10-tests-79b511`, on `features/plugin-lifecycle-p10`, using Node `v26.12.1`. No nested worktree was created and no other checkout was merged or changed.

| Check | Result |
| --- | --- |
| Read modified sections and inspect diffs | Passed for both findings |
| Fail-first owner regressions for normal read pass, replanning, and remote apply | Failed on duplicate operations before CR-01 fix |
| Fail-first hosted replacement Cucumber scenario | Failed on duplicate GET before CR-01 fix |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts test/orchestrators/reconcile/apply.test.ts` | Exit 0; both owner suites meet enforced 100% direct coverage |
| `npx cucumber-js --parallel 1 --name 'Apply downloads a replacement marketplace once\|Apply replaces a marketplace whose declared source changed'` | Exit 0; 2 scenarios, 27 steps |
| `npx cucumber-js --parallel 1 --name 'Market exposes marketplace completions\|Completion uses the installed git version'` | Exit 0; 2 scenarios, 24 steps |
| Same completion command with `NODE_OPTIONS=--import=/tmp/phase10-empty-completions.mjs` | Both scenarios reject the empty provider; exit 1 as expected |
| `npx fallow audit --base HEAD --format json --quiet` before each fix commit | Pass; zero dead-code issues, complexity findings, and duplication clone groups |
| `SKIP=npm-check pre-commit run --files` for each finding's files | Exit 0 |
| `git commit` with all hooks enabled for each finding | Exit 0; `npm run check:commit` passed, including typecheck, feature checks, Fallow, other static checks, unpaired tests, and applicable direct coverage |
| `git diff --check` | Exit 0 |

The temporary mutation loader intercepts only `features/lib/plugin-completions.ts` with `node:module`'s `registerHooks` and substitutes `export async function pluginCompletions() { return []; }`. It changes no repository file.

The full combined-tree `npm run check` gate and the re-review remain with the parent workflow, as assigned. This report is intentionally uncommitted. No source or test edits remain uncommitted.

---

_Fixer: gsd-code-fixer_
_Iteration: 1_

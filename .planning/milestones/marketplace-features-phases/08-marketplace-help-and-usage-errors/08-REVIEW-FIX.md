---
phase: 08-marketplace-help-and-usage-errors
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/08-marketplace-help-and-usage-errors/08-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-10-20T00:00:00Z
**Source review:** .planning/phases/08-marketplace-help-and-usage-errors/08-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 2 (fix scope: all; the review has no Critical or Warning findings)
- Fixed: 2
- Skipped: 0

Both fixes change comments only. No code behavior changed, so neither fix needed a failing test first.

## Fixed Issues

### IN-01: The `parseCommandArgs` doc comment gets the order of the omitted and empty checks wrong

**Files modified:** `extensions/pi-claude-marketplace/edge/args-schema.ts`
**Commit:** 99ff69ac (`docs(args): state the per-slot order of positional errors`)
**Applied fix:** The last two bullets of the ordered list are now one bullet. It says the function checks one slot at a time, in schema order. For each slot it reports an omitted required positional as the `usage` string, or an empty or blank positional as `<label> must not be empty.` (USE-07). The loop itself did not change.

### IN-02: Three marketplace handler headers still copy their usage line by hand

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts`
**Commit:** c1dee8ba (`docs(marketplace): point list, update, info headers at usage rows`)
**Applied fix:** The three headers now use the wording of the `add`, `remove`, and `autoupdate` headers from b9c37c02. For example: "Thin-shim factory for `marketplace list`; its usage line comes from `marketplaceUsage("list")`." No marketplace handler header writes out a signature now. The other copies of these strings are in test fixtures and catalog-UAT keys, which are outside this finding.

## Verification

All checks ran in the main checkout of the `features/cucumber-behavioral-tests` worktree, not in an isolated review-fix worktree. The orchestrator told the fixer to commit there with explicit pathspecs, and a separate worktree would have no `node_modules` for the commit hook. Anyone can reproduce the results from this tree.

- `npx prettier --check extensions/pi-claude-marketplace/edge/args-schema.ts`: exit 0
- `SKIP=npm-check pre-commit run --files <changed files>` for each fix: exit 0 both times
- Commit hook `npm run check:commit` (static checks, unpaired tests, direct coverage for the staged pairs): Passed on both commits, and both `git commit` runs exited 0
- The full `npm run check` was not run. The orchestrator runs it as the regression gate after the fix loop.

---

_Fixed: 2026-10-20T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_

---
phase: 08-marketplace-help-and-usage-errors
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/08-marketplace-help-and-usage-errors/08-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-10-20T00:00:00Z
**Source review:** .planning/phases/08-marketplace-help-and-usage-errors/08-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 3 (fix scope: all; the review has no Critical or Warning findings)
- Fixed: 3
- Skipped: 0

All three fixes change comments or documentation only. No behavior changed.

## Fixed Issues

### IN-01: The handler header comments still state the old usage, without `[--local]`

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts`
**Commit:** b9c37c02
**Applied fix:** Removed the hand-written signatures from the three file headers. Each header now says that its usage line comes from `marketplaceUsage("add")`, `marketplaceUsage("remove")`, or `marketplaceUsage(...)` (autoupdate and noautoupdate). The signature rows in `router.ts` are now the only copy. The `update.ts`, `info.ts`, and `list.ts` headers still carry hand-written signatures, but those match their rows (none of those verbs takes `--local`), so they were left as they are.

### IN-02: An edited header comment in `info.test.ts` was not reflowed

**Files modified:** `tests/edge/handlers/marketplace/info.test.ts`
**Commit:** af1191eb
**Applied fix:** Rewrapped header lines 6-11 to the file's 80-column comment width. The words did not change.

### IN-03: The rewritten open-closed bullet still says a new top-level verb needs only one `TOP_LEVEL_USAGE` line

**Files modified:** `docs/open-closed-proof.md`
**Commit:** 2c57764e
**Applied fix:** The bullet now says that a new top-level verb adds one `TOP_LEVEL_USAGE` line and its spelling in the hand-written `TOP_LEVEL_USAGE` header. `router.ts` and the `TOP_LEVEL_USAGE` text did not change. The header derivation and its test are deferred to the top-level help work.

## Verification

All checks ran in the main checkout of the worktree `/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests` on branch `features/cucumber-behavioral-tests`. No separate review-fix worktree was created: the dispatching workflow told this run to commit there directly, and a hand-made worktree has no `node_modules` for the commit hook.

- `SKIP=npm-check pre-commit run --files <changed files>` before each commit: exit 0 all three times.
- Commit hook: `npm run check:commit` passed for the source commit (b9c37c02) and the test commit (af1191eb). It was skipped for the docs-only commit (2c57764e), because a Markdown file is not a build input. The mdformat and markdownlint hooks passed.
- Full `npm run check` was not run. The orchestrator runs the regression gate.

---

_Fixed: 2026-10-20T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

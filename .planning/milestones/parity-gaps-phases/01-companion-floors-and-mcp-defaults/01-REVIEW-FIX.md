---
phase: 01-companion-floors-and-mcp-defaults
fixed_at: 2026-11-12T07:04:13Z
review_path: .planning/phases/01-companion-floors-and-mcp-defaults/01-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-11-12T07:04:13Z
**Source review:** `.planning/phases/01-companion-floors-and-mcp-defaults/01-REVIEW.md`
**Iteration:** 1

**Summary:** One critical finding was fixed. No finding was skipped.

## Fixed Issues

### CR-01: A valid 64-character adapter tool name suppresses its server-prefix hook

**Status:** fixed: independently verified by the code reviewer; no human check needed for this finding.
**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, their paired tests, `features/hook/mcp-tool-names.feature`, `features/lib/mcp-stub-server.ts`, and `features/step_definitions/hook/tool-use.steps.ts`
**Commit:** `1e762749`
**Applied fix:** Successful result metadata now supplies a separate full-name candidate. Recovery checks that the adapter would format this name as the event's registered name. Exact 64-character names can therefore use their server prefix. Hook literals still recover only names longer than 64 characters, and the long-prefix guard remains in place when metadata is absent or disagrees.

## Verification

The checks below ran in the isolated worktree, at `.claude/worktrees/rf-01-3031815-1794465939`, on branch `agent-reviewfix-01-3031815`. Its `node_modules` entry was a symlink to the main checkout's installed dependencies. The final combined-tree `npm run check` gate belongs to the parent workflow and was not run by the fixer.

- Before the source fix, the domain test failed because recovery omitted `claudeName`; the dispatcher test recorded `[]` instead of the one expected `PostToolUse` hook. The adapter Cucumber scenario failed with zero hook runs instead of one.
- After the fix, the domain and dispatcher owner suites passed (49/49 and 196/196 before one further guard case was added). Both source/test pairs passed `npm run test:coverage:direct`, including that guard case. The targeted adapter Cucumber scenario passed after the fixture cleanup (1/1 scenario, 14/14 steps).
- `npm run typecheck`, `npm run check:features`, scoped pre-commit fixers, and `fallow audit --base HEAD --format json --quiet --explain` passed. Fallow reported zero introduced findings. The commit hook passed `npm run check:commit` and all other required hooks.

## Worktree Integration

The code-fixer role required a hand-rolled isolated worktree because `workflow.use_worktrees` was `true`. The current GSD skill adapter did not declare that isolation in the parent dispatch. The fixer used the role's recovery-sentinel protocol, with a path inside this writable checkout and an `agent-*` branch name allowed by `AGENTS.md`. The temporary branch was fast-forwarded into `features/gaps` after its hook-backed commit, then the worktree and branch were removed and the sentinel cleared. The report remains uncommitted for the parent workflow to commit.

---

_Fixed: 2026-11-12T07:04:13Z_
_Fixer: gsd-code-fixer_
_Iteration: 1_

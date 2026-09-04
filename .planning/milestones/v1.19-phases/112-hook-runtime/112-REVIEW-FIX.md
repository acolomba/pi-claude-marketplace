---
phase: 112-hook-runtime
fixed_at: 2026-08-31T14:40:43Z
review_path: .planning/phases/112-hook-runtime/112-REVIEW.md
iteration: 3
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 112: Code Review Fix Report

**Fixed at:** 2026-08-31T14:40:43Z
**Source review:** `.planning/phases/112-hook-runtime/112-REVIEW.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### CR-01: A no-PID spawn can crash the extension host with an unhandled child error

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `tests/bridges/hooks/async-rewake/registry.test.ts`
**Commit:** 6268f2cd
**Status:** fixed: requires human verification
**Applied fix:** The no-PID branch now installs an error listener before it attempts to kill the child or returns. The listener contains and logs the asynchronous spawn error, while the close listener removes any unused error listener. A faithful exec-form lifecycle regression emits an asynchronous ENOENT-style error after a child returns without a PID, then emits close twice. It proves that the child is killed once, both lifecycle listeners are removed, no PID table or rewake output is produced, and neither `uncaughtException` nor `unhandledRejection` is reached.

## Verification

- Isolated review-fix worktree: the focused async-rewake registry, PID-table, ring-buffer, and architecture suites passed (4/4 files).
- Isolated review-fix worktree: direct registry coverage passed at 115/115 branches, 30/30 functions, and 729/729 lines.
- Isolated review-fix worktree: scoped ESLint and scoped Prettier passed. The committed diff passed its scoped whitespace check.
- Active feature checkout after fast-forward: TypeScript typecheck passed. The isolated-worktree typecheck could not resolve the checkout-local `strong-mock` dependency, so the reproducible active-checkout gate is reported here.

---

_Fixed: 2026-08-31T14:40:43Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_

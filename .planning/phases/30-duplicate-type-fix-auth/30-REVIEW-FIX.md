---
phase: 30-duplicate-type-fix-auth
fixed_at: 2026-06-01T10:35:00Z
review_path: .planning/phases/30-duplicate-type-fix-auth/30-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-06-01T10:35:00Z
**Source review:** .planning/phases/30-duplicate-type-fix-auth/30-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `GitCredentials` missing `cancel` field -- breaks GitAuth parity

**Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`
**Commit:** `4d6a6a1`
**Applied fix:** Added `cancel?: boolean` field with JSDoc to `GitCredentials`
interface so it matches isomorphic-git's `GitAuth` exactly.

### WR-02: `pull` / `PullOptions` are dead exports that contradict D-14

**Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`
**Commit:** `7ff442a`
**Applied fix:** Removed `PullOptions` interface (9 lines) and `pull()` function
(10 lines). No callers existed; the exports contradicted D-14's documented
fetch -> forceUpdateRef -> checkout requirement.

### WR-03: `fetch` return type is `Promise<FetchResult>` but all callers treat it as `Promise<void>`

**Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`
**Commit:** `08f6b91`
**Applied fix:** Changed `fetch` signature from `Promise<git.FetchResult>` with
`return git.fetch(...)` to `Promise<void>` with `await git.fetch(...)` (Option A
from the review). Now aligned with `GitOps.fetch` in shared.ts:81 and the
`DEFAULT_GIT_OPS` bridge wrapper.

---

_Fixed: 2026-06-01T10:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

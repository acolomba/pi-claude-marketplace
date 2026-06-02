---
phase: 30-duplicate-type-fix-auth
reviewed: 2026-06-01T12:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - extensions/pi-claude-marketplace/platform/git.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 30: Code Review Report (re-review after fixes)

**Reviewed:** 2026-06-01T12:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Re-review of `platform/git.ts` after the three findings from the initial pass
were fixed (WR-01 `cancel` field added, WR-02 `pull`/`PullOptions` removed,
WR-03 `fetch` return type changed to `void`).

All three fixes are correctly applied and consistent with upstream
`isomorphic-git` types and the `GitOps` boundary in `shared.ts`.

One surviving Info finding from the original review (IN-01, `noCheckout`
JSDoc) was not in scope for the fix pass and remains present in the file.

No new defects were introduced by the fixes. The file is otherwise sound:
conditional spreads handle all optional fields correctly, the
`branch ?? undefined` normalization on `currentBranch` is correct at both
the TypeScript and runtime levels, and `GitCredentials` correctly matches
`GitAuth` from isomorphic-git.

---

## Info

### IN-01: `CheckoutOptions.noCheckout` JSDoc inverts the flag's semantics

**File:** `extensions/pi-claude-marketplace/platform/git.ts:57`

**Issue:** The JSDoc for `noCheckout` reads:

> "Set true to keep working-tree files at HEAD."

isomorphic-git's own documentation states the flag means HEAD advances but
the working directory is NOT updated. The wrapper's description says the
opposite: that files stay at HEAD (i.e. normal checkout behaviour). A
developer reading only the wrapper's comment would set `noCheckout: true`
expecting a normal checkout and instead get HEAD advancement with no file
writes to disk.

**Fix:**

```ts
/** If true, advance HEAD but do NOT update working-tree files. Default false. */
noCheckout?: boolean;
```

---

_Reviewed: 2026-06-01T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

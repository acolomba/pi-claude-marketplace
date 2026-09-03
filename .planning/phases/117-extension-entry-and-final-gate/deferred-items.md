# Deferred items — phase 117

Out-of-scope discoveries logged during execution. Each names the plan that found
it and why that plan could not resolve it.

## 1. Stale test path in an `install.messaging.ts` doc comment

- **Found during:** 117-04 Task 1
- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`
  (the `isHooksResolverNote` doc comment)
- **Issue:** the comment pins the cross-surface parity contract to
  `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`. Plan 117-04
  moved that suite to `tests/architecture/cross-surface-reason-parity.test.ts`,
  so the cited path no longer exists.
- **Why not fixed here:** 117-04 forbids production edits, and both of its verify
  blocks assert `git diff --quiet -- extensions/ package.json`. Correcting the
  comment would have failed the plan's own gate.
- **Suggested owner:** the 117-12 closing sweep, or any later plan already
  editing this file.
- **Impact:** documentation only. No gate reads the cited path, and the pinning
  suite still runs — at its new location.

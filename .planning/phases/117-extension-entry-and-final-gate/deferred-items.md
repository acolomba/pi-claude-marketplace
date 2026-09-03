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

## 2. Stale byte-form-lock path in the output catalog

- **Found during:** 117-05 Task 1
- **File:** `docs/output-catalog.md` (the `### Device Flow user-code prompt
  (AUTH-03)` entry, `<!-- catalog-state: device-flow-prompt -->`)
- **Issue:** the entry's prose says "The byte form is locked by
  `tests/shared/device-flow-prompt.test.ts`". Plan 117-05 folded that suite into
  `tests/domain/github-auth.test.ts` and deleted it, so the cited path no longer
  exists. The correct pointer is the
  `emits the documented AUTH-03 prompt before any token is acquired` case in
  `tests/domain/github-auth.test.ts`.
- **Why not fixed here:** 117-05 pins the catalog. Its verify block ends with
  `git diff --quiet -- extensions/ package.json docs/output-catalog.md`, so
  editing the entry would have failed the plan's own gate.
- **Suggested owner:** the 117-12 closing sweep, or any later plan already
  editing the catalog.
- **Impact:** documentation only. No gate reads the cited path — `catalog-uat`
  pairs on the `catalog-state` marker, not on the prose — and the byte form is
  still locked, at its new location.

---
phase: 34-gitops-interface-threading-auth
plan: 01
subsystem: orchestrators/marketplace
tags: [auth, gitops, interface, unit-tests, AUTH-01, AUTH-02]
dependency_graph:
  requires:
    - Phase 33 platform/git.ts CloneOptions.auth? / FetchOptions.auth? ledge
    - Phase 31 platform/git-credential.ts CredentialOps interface
  provides:
    - GitAuthBundle exported from orchestrators/marketplace/shared.ts
    - GitOps.clone and GitOps.fetch accept optional auth?: GitAuthBundle
    - refreshGitHubClone 5th parameter threads auth into gitOps.fetch
  affects:
    - Phase 35 add.ts and update.ts (will wire auth at call sites)
    - tests/helpers/git-mock.ts (structurally compatible without modification)
tech_stack:
  added: []
  patterns:
    - type-only import of platform types into orchestrator tier (D-13 preserved)
    - optional parameter conditional spread for backward-compatible widening
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - tests/orchestrators/marketplace/shared.test.ts
decisions:
  - GitAuthBundle defined as interface (not type alias) to match codebase convention
    for exported structural types; readonly fields enforce immutability at call sites
  - auth? is optional on all three signatures (GitOps.clone, GitOps.fetch,
    refreshGitHubClone) so zero existing call sites need modification (T-34-03)
  - DEFAULT_GIT_OPS needs no wrapper change: structural typing propagates the
    widened opts shape through bound function references transparently
  - CallLog.fetch widened from number counter to array of opts records so new
    tests can assert on auth field presence/absence and reference equality
metrics:
  duration: "~10 minutes"
  completed: "2026-06-01"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 34 Plan 01: GitOps Interface Auth-Threading Summary

GitOps interface and refreshGitHubClone widened with optional GitAuthBundle type
threading auth from orchestrator tier into platform/git.ts without crossing D-13.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Widen GitOps+refreshGitHubClone auth seam (AUTH-01,02) | 5ed937c |
| 2 | Lock auth-threading with unit tests (AUTH-01,02) | ea208ba |

## What Was Built

**Task 1 - orchestrators/marketplace/shared.ts:**

- Added type-only imports: `CredentialOps` from `platform/git-credential.ts`,
  `OnAuthRequiredFn` from `platform/git.ts`
- Exported `GitAuthBundle` interface with `credentialOps`, `host`,
  `onAuthRequired` -- mirrors `CloneOptions.auth?` / `FetchOptions.auth?` shape
  from Phase 33; D-13 boundary preserved (no isomorphic-git symbol in orchestrator)
- Widened `GitOps.clone` and `GitOps.fetch` with `auth?: GitAuthBundle`
- Added Phase 34 JSDoc to the `GitOps` interface documenting the opt-in auth seam
- Added explanatory comment to `DEFAULT_GIT_OPS` documenting the structural
  typing pass-through; `clone: defaultGit.clone` and the `fetch:` wrapper remain
  byte-identical
- Extended `refreshGitHubClone` with optional 5th parameter `auth?: GitAuthBundle`,
  forwarded via conditional spread into `gitOps.fetch`; zero call sites modified

**Task 2 - tests/orchestrators/marketplace/shared.test.ts:**

- Extended `CallLog.fetch` from `number` counter to
  `{ dir, remote?, ref?, auth? }[]` array
- Updated all 3 existing tests to use `log.fetch.length` (no behavior change)
- Added Test A: without auth, `log.fetch[0]?.auth === undefined` (backward compat)
- Added Test B: with auth bundle, `log.fetch[0]?.auth === auth` (reference
  equality); verifies `host`, `credentialOps`, `onAuthRequired` each forwarded
  by reference; asserts `onAuthRequired` NOT called (pure threading test)
- Added Test C: with both `onFetchSucceeded` and `auth`, both thread correctly;
  `fetchSucceededCount === 1` and auth bundle reference-equal

## Verification

- `npx tsc --noEmit`: exits 0
- `npm run check`: exits 0 (typecheck + ESLint + Prettier + 1304 tests)
- 6 tests in shared.test.ts all pass
- Existing call sites in update.ts (marketplace + plugin) compile without
  modification
- `makeMockGitOps` consumers compile without modification (widening is additive)
- D-13: no `isomorphic-git` import in orchestrators/marketplace/shared.ts
- AUTH-09: no logging or interpolation of the auth bundle anywhere in shared.ts

## Deviations from Plan

**1. [Rule 1 - Bug] ESLint padding-line-between-statements at line 171**
- **Found during:** Task 2 pre-commit hook (`npm lint` step)
- **Issue:** Missing blank line after the `onAuthRequired` arrow function body
  closure `};` before the `const auth` const declaration (stylistic rule)
- **Fix:** Added blank line between `};` and `const auth: GitAuthBundle = ...`
- **Files modified:** tests/orchestrators/marketplace/shared.test.ts
- **Commit:** Included in Task 2 commit ea208ba (fixed before commit)

No other deviations. Plan executed as specified.

## Known Stubs

None. This plan is purely interface/type widening + unit tests; no stub data
or placeholder implementations.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema
changes at trust boundaries beyond what the plan's threat model already covers.

## Self-Check: PASSED

Files exist:
- FOUND: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
- FOUND: tests/orchestrators/marketplace/shared.test.ts
- FOUND: .planning/phases/34-gitops-interface-threading-auth/34-01-SUMMARY.md

Commits exist:
- FOUND: 5ed937c (feat(34-01): widen GitOps+refreshGitHubClone auth seam)
- FOUND: ea208ba (test(34-01): lock auth-threading on refreshGitHubClone)

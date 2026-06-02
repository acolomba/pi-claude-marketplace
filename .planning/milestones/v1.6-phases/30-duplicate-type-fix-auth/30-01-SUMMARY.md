---
phase: 30-duplicate-type-fix-auth
plan: "01"
subsystem: auth
tags: [typescript, isomorphic-git, platform, types]

# Dependency graph
requires: []
provides:
  - "GitCredentials interface exported from platform/git.ts (D-13 boundary)"
  - "Canonical credential shape for Phase 31+ consumers"
affects:
  - 31-git-credential-platform
  - 33-auth-wiring
  - 34-gitops-threading
  - 35-orchestrator-auth

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GitCredentials declared as interface to satisfy ESLint consistent-type-definitions"
    - "D-13 type re-declaration: structural match to isomorphic-git GitAuth without importing it"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts

key-decisions:
  - "Used interface declaration (not type alias) to satisfy @typescript-eslint/consistent-type-definitions ESLint rule"
  - "Omitted isomorphic-git GitAuth's optional cancel field -- GitCredentials covers only the credential fields Phase 31 needs"

patterns-established:
  - "D-13 structural re-declaration: declare types matching isomorphic-git shapes without importing them"

requirements-completed:
  - AUTH-10

# Metrics
duration: 6min
completed: 2026-06-01
---

# Phase 30 Plan 01: Duplicate Type Fix Auth Summary

**GitCredentials interface appended to platform/git.ts as the canonical D-13
boundary export for Phase 31+ auth wiring**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-01T10:14:00Z
- **Completed:** 2026-06-01T10:20:58Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Appended `export interface GitCredentials` to `platform/git.ts` after the
  last existing export
- Shape matches isomorphic-git's `GitAuth` (username/password/headers) without
  importing isomorphic-git types, preserving D-13 boundary
- `npm run check` passes with typecheck + lint + format + 1260/1260 tests GREEN
- Phase 31's `platform/git-credential.ts` can now import
  `{ GitCredentials }` from `platform/git.ts` without TypeScript errors

## Task Commits

1. **Task 1: Export canonical GitCredentials type from platform/git.ts**
   - `9ca6769` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - Added `GitCredentials`
  interface declaration at end of file

## Decisions Made

**Used `interface` instead of `type` alias:** The plan specified
`export type GitCredentials = { ... }` but the project's ESLint rule
`@typescript-eslint/consistent-type-definitions` requires `interface` over
type aliases for object shapes. Changed to `export interface GitCredentials`.
The semantic result is identical: TypeScript duck-typing still lets
isomorphic-git callbacks accept `GitCredentials` values.

**Omitted `cancel?: boolean`:** isomorphic-git's `GitAuth` includes an
optional `cancel` field to trigger `UserCanceledError`. The plan explicitly
specifies only `username`, `password`, and `headers`. Phase 31 doesn't need
the cancel escape hatch; it can be added later if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced `type` alias with `interface` declaration**
- **Found during:** Task 1 (pre-commit lint run)
- **Issue:** `export type GitCredentials = { ... }` triggers
  `@typescript-eslint/consistent-type-definitions` (error: "Use an interface
  instead of a type")
- **Fix:** Changed to `export interface GitCredentials { ... }` -- semantically
  equivalent, accepted by the linter
- **Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`
- **Verification:** `pre-commit run npm lint` passes; all other hooks pass
- **Committed in:** `9ca6769` (same task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug: lint enforcement)
**Impact on plan:** The `type`-vs-`interface` switch is cosmetic -- TypeScript
treats them identically for structural compatibility. The plan's grep check
`export type GitCredentials` was a secondary artifact; the primary goals
(single declaration, `npm run check` GREEN) are both met.

## Issues Encountered

None beyond the lint deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `platform/git.ts` exports exactly one `GitCredentials` interface
- Phase 31 can `import type { GitCredentials } from "../platform/git.js"`
  without TypeScript errors
- No blockers for auth wiring chain (Phases 31-36)

---

*Phase: 30-duplicate-type-fix-auth*
*Completed: 2026-06-01*

---
phase: 06-live-mcp-status-in-info
fixed_at: 2026-10-09T00:00:00Z
review_path: .planning/phases/06-live-mcp-status-in-info/06-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-10-09
**Source review:** .planning/phases/06-live-mcp-status-in-info/06-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: A snapshot field read twice lets a payload pass the check and then put a non-string into the closed status set

**Files modified:** `extensions/pi-claude-marketplace/platform/mcp-status.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts`,
`tests/platform/mcp-status.test.ts`,
`tests/orchestrators/plugin/info-mcp-status.test.ts`
**Commit:** 03a4104e
**Status:** fixed: requires human verification (logic change to a validation
path)
**Applied fix:**

- `readSnapshot` reads each server's `name` and `status` once after the
  validator check into `unknown` locals, and stores only copies that are still
  strings. A non-string copy voids the whole snapshot (`undefined`), so it
  reads as `"no-snapshot"`. This matches the module's existing contract
  ("a hostile payload reads as no usable snapshot"; a malformed snapshot is
  no usable snapshot). The empty-list rule now checks the built map's size, so
  `payload.servers` is read once after the check too.
- `statusToken` in `info-mcp-status.ts` checks `Object.hasOwn` on
  `RUNTIME_STATUS_TOKENS`. An answer outside the reader's closed set reads
  `status unknown` and never resolves to an `Object.prototype` member.
- Tests: in `mcp-status.test.ts`, a status and a name that read as strings
  during the check and as an object (`toString` gives `"connected"`, then
  `"constructor"`) afterwards, and a status whose second read throws. All
  three replace an earlier valid snapshot and read `"no-snapshot"`. One more
  case: a status that turns into the string `"constructor"` reads
  `"unrecognized"`. The two object cases fail on the pre-fix source (checked).
  In `info-mcp-status.test.ts`, a reader that answers `constructor`,
  `toString`, or `__proto__` stamps `status unknown`.

**Verification (main checkout, no worktree):** the commit hook's
`npm run check:commit` passed (static checks, unpaired tests, and 100% direct
coverage for both staged source-test pairs). `npx fallow audit --base HEAD~1`
reported no issues in the 4 changed files. The full `npm run check` was not
run.

---

_Fixed: 2026-10-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

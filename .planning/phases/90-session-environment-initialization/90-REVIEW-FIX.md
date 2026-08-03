---
phase: 90-session-environment-initialization
fixed_at: 2026-08-03T08:45:00Z
review_path: .planning/phases/90-session-environment-initialization/90-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 90: Code Review Fix Report

**Fixed at:** 2026-08-03T08:45:00Z
**Source review:** .planning/phases/90-session-environment-initialization/90-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 2 (both WARNING; the single INFO item IN-01 is out of scope)
- Fixed: 2
- Skipped: 0

Both in-scope findings were regression-test gaps, not source defects. The fixes
add tests that exercise the failure branches the prior iteration introduced, so a
later refactor that removes either guard turns the suite red.

## Fixed Issues

### WR-01: No regression test exercises the `collectBinDirs` drop branch

**Files modified:** `tests/shared/plugin-path.test.ts`
**Commit:** 876a0d8c
**Applied fix:** Added `WR-01 collectBinDirs: drops records with a non-absolute
or empty resolvedSource`. It builds a state with three enabled records — one
absolute (`/plugins/good`), one relative (`plugins/relative`), one empty — and
asserts `collectBinDirs` yields only `join("/plugins/good", "bin")`. This drives
the `catch` at plugin-path.ts:44-46 (`asAbsolutePluginRoot` rejecting the
relative and empty records), so removing the `asAbsolutePluginRoot` call would
now fail the test rather than silently reintroduce the CWE-426 relative-PATH
exposure. Matches the review's suggested snippet.

### WR-02: No regression test exercises the `session_start` error-swallow

**Files modified:** `tests/shared/index-smoke.test.ts`
**Commit:** e9bd4a96
**Applied fix:** Added `WR-02 session_start swallows a throwing or undefined
sessionManager`. It loads the extension against the mock, retrieves the
registered `session_start` handlers, and invokes the SENV handler with (a) a
`ctx` whose `sessionManager.getSessionId()` throws and (b) a `ctx` with no
`sessionManager`, asserting `doesNotThrow` for both — proving the index.ts:129-133
`try/catch` never propagates past `session_start` (NFR-2).

Adaptation from the review snippet: the suggested `events.get("session_start")!.at(-1)!`
targets the *last* session_start handler, but the SENV handler is not last. Three
handlers register in a fixed order — the hooks-bridge Bucket-A dispatch
(event-router.ts:857), the SENV injection (index.ts:128), then the TC-7
autocomplete wrapper (edge/register.ts:116). `.at(-1)` is the autocomplete
handler, which dereferences `ctx.ui` and is unrelated to the swallow under test.
The test instead selects the middle handler (index 1) — the only session_start
handler that dereferences `ctx.sessionManager.getSessionId()` — after asserting
exactly three handlers are registered. Invoking all three with a SENV-shaped
`ctx` was rejected because the autocomplete handler would throw on the absent
`ctx.ui` for reasons unrelated to WR-02.

## Verification

- Gates ran **inside the isolated worktree** (`/tmp/sv-90-reviewfix-*`) with
  `node_modules` symlinked from the main checkout; the worktree was fast-forwarded
  into `features/env-parity` and removed afterward. The numbers are reproducible
  from the main checkout post-teardown (same source, same `node_modules`).
- `node --test` per file: plugin-path 12/12, session-env 5/5, index-smoke 4/4 —
  all pass, 0 fail. The two new tests (`WR-01`, `WR-02`) pass.
- `npm run typecheck` (`tsc --noEmit`): clean.
- `pre-commit run --files` on both changed files: all hooks pass except
  `trufflehog`, which fails only due to the worktree `.git` layout
  (`.git/index: not a directory`). Per project policy the scan was confirmed
  clean via `pre-commit run trufflehog --all-files` (Passed) and each commit used
  `SKIP=trufflehog`.

## Out of Scope

### IN-01: `collectBinDirs` admits enabled partial / non-installable records

Info tier — left unchanged. Intentional per PENV-01 ("every enabled plugin
record"); no code change requested.

---

_Fixed: 2026-08-03T08:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

---
phase: 90-session-environment-initialization
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - tests/shared/index-smoke.test.ts
  - tests/shared/plugin-path.test.ts
  - tests/shared/session-env.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 90: Code Review Report

**Reviewed:** 2026-08-03T00:00:00Z (iteration 3, final)
**Depth:** standard
**Files Reviewed:** 6
**Status:** clean

## Summary

Iteration-3 (final) re-review after the fix loop closed. Both prior warnings are
fixed AND now carry real, correct regression tests. All 21 tests across the three
phase test files pass (0 fail).

- **WR-01 — FIXED (fix `822924cd`) + regression test landed (`876a0d8c`).**
  `collectBinDirs` (plugin-path.ts:41-47) wraps `asAbsolutePluginRoot(rec.resolvedSource)`
  in a per-record try/catch, dropping any record whose `resolvedSource` is empty,
  relative, or null-byte-bearing before it can compose a CWE-426 untrusted-search-path
  entry. The catch is scoped per-record, so one corrupt entry drops only itself while
  siblings still contribute. The new test
  `WR-01 collectBinDirs: drops records with a non-absolute or empty resolvedSource`
  (plugin-path.test.ts:89-103) seeds an absolute-good, a relative (`plugins/relative`),
  and an empty record, and asserts `collectBinDirs` returns only `/plugins/good/bin`.
  This drives the exact catch branch the fix added — a later edit removing the
  `asAbsolutePluginRoot` call would now turn the suite red. Verified against
  `domain/plugin-root.ts`: the brand rejects empty/relative/null-byte and passes
  absolute paths, matching the test's expectations.

- **WR-02 — FIXED (fix `050835f8`) + regression test landed (`e9bd4a96`).** The
  `session_start` handler (index.ts:128-134) wraps
  `applySessionEnv(ctx.sessionManager.getSessionId())` in try/catch, routing a throwing
  `getSessionId()` or an undefined `ctx.sessionManager` through `hookDebugLog` so it
  cannot propagate past `session_start` (NFR-2). The new test
  `WR-02 session_start swallows a throwing or undefined sessionManager`
  (index-smoke.test.ts:175-203) resolves the SENV handler positionally as
  `sessionStart[1]`, guarded by an explicit `assert.equal(sessionStart.length, 3)` and
  a comment documenting the fixed registration order, then asserts `doesNotThrow` for
  both the throwing-`getSessionId` case and the empty-`ctx` (undefined `sessionManager`)
  case. This drives the exact catch branch the fix added.

Verification performed this iteration:
- Traced `session_start` registration order in `index.ts` to confirm the test targets
  the right handler: `registerHooksBridge` is `await`ed first (Bucket-A dispatch =
  index 0) → the SENV `pi.on("session_start")` at line 128 (index 1) →
  `registerClaudePluginCommand` autocomplete wrapper (index 2). `sessionStart[1]`
  reliably resolves the SENV handler; the `length === 3` assertion fails loudly if the
  order ever shifts.
- Ran `node --test` over all three files: 21 pass, 0 fail.
- Confirmed via file history that only the four described fix/test commits touched these
  paths this phase; no unrelated changes slipped in.
- Test/describe titles use only permitted anchors (`WR-01`, `WR-02`, `SENV-*`,
  `PENV-01`, `D-90-*`, `PATH_LEDGER_ENV`); no forbidden phase/plan references
  (`.claude/rules/typescript-comments.md`).

The pure primitives remain correct: `applyPathLedger` appends (never prepends), removes
owned entries by exact match before re-append, and dedupes against the surviving base;
`applySessionEnv` assigns exactly three keys with no collateral env mutation (proven by
the before/after delta test). No bugs, security gaps, or quality defects above Info
remain. Per the fix-loop exit criterion (nothing above Info remaining), status is clean.

## Info

### IN-01: collectBinDirs admits enabled partial records (intentional per PENV-01)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:33-51`
**Issue:** Carried forward unchanged. `collectBinDirs` gates only on `rec.enabled` plus
the absolute-path brand; it does not check `rec.compatibility.installable`. An
enabled-but-non-installable record (e.g. a `--partial` install) with a valid absolute
`resolvedSource` still contributes a `<root>/bin` PATH entry, and no on-disk existence
check is performed (Claude-Code parity: append with no fs stat). This is intentional per
PENV-01 ("every enabled plugin record"), so it is recorded as Info, not escalated.
**Fix:** None required. Behavior is contract-mandated (PENV-01) and covered by
`applyPathLedger: adds a bin dir even when it does not exist on disk`. If intent were
installable-only, add `&& rec.compatibility.installable` to the guard — but that is a
scope change, not a defect.

---

_Reviewed: 2026-08-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

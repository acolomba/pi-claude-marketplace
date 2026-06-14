---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
fixed_at: 2026-06-14T18:00:00Z
review_path: .planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 58: Code Review Fix Report

**Fixed at:** 2026-06-14T18:00:00Z
**Source review:** `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 4 (WR-01..WR-04; the 3 IN-* findings are out of `critical_warning` scope)
- Fixed: 4
- Skipped: 0

`npm run check` (typecheck + lint + format + tests + integration tests) was green after every fix.

## Fixed Issues

### WR-01: `narrowResolverNotes` second-hooks-note falls through to `unsupported source`

**Files modified:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`, `tests/shared/probe-classifiers.test.ts`
**Commit:** `d109e3a`
**Applied fix:** Restructured the `narrowResolverNotes` loop so each bucket is an explicit `if (predicate) { dedup-push; continue; }` block. A duplicate hit short-circuits before the trailing `unsupported source` catch-all, instead of falling through. Used Option 1 from the review (explicit `continue` after dedup). Replaced the existing "fall-through is the intended behavior" test with one that asserts the corrected `["unsupported hooks"]` outcome and added a second test covering two `malformed hooks.json:` notes (the motivating scenario in the finding).

### WR-02: `readStandaloneHooks` conflates I/O errors and parse/supportability failures under `malformed hooks.json:`

**Files modified:** `extensions/pi-claude-marketplace/domain/resolver.ts`, `tests/domain/resolver-strict.test.ts`
**Commit:** `ad49e92`
**Applied fix:** Removed the `try/catch` around `readFileTextOf(ctx)(hooksPath)` so EACCES / EPERM / other I/O errors propagate out of `resolveStrict`. The outer `narrowProbeError` ladder in `orchestrators/plugin/{list,info}.ts` then classifies the thrown error by its `.code` and emits the truthful `{permission denied}` / `{unreadable}` Reason. Parse / schema / supportability failures continue to flow through the structured-notes path so the catalog layer still emits `{unsupported hooks}` for them (the wrap was already truthful for those). Used Option 1 from the review (rethrow). Added a regression test that builds a `ResolveContext` whose `statKind` reports the hooks file exists but `readFileText` rejects with `EACCES`, and asserts `resolveStrict` rejects with the same error (so `.code === "EACCES"`).

### WR-03: `hookDebugLog` writes to `console.error` from a domain module, blunting IL-3 enforcement

**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`, `eslint.config.js`
**Commit:** `5e7c894`
**Applied fix:** Removed the per-file ESLint override that disabled `no-console` + `no-restricted-syntax` for the entire `hooks.ts` module. Replaced it with a single `// eslint-disable-next-line no-console, no-restricted-syntax -- OBS-01 hand-off seam (D-58-03); retires when the shared debug-log helper lands` directive on the one `console.error` call inside `hookDebugLog`. The deviation surface drops from "whole file" to "one line" -- a future contributor adding a stray `console.error` elsewhere in the file now trips lint. Updated the file header comment so it no longer points at a per-file override that no longer exists. Used Option 2 from the review (tighten the lint scope) rather than deferring the stub.

### WR-04: `tryNonToolEventTrip` collapses "closed set missing" and "closed set miss" into the same debugDetail

**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`, `tests/architecture/hooks-supportability.test.ts`
**Commit:** `891e4ab`
**Applied fix:** Replaced the optional-chain `closedSet?.has(rawMatcher)` with an explicit two-branch split. When `closedSet === undefined` (meaning `NON_TOOL_EVENT_FIELDS` declares a matcher target field but `NON_TOOL_EVENT_CLOSED_SETS` has no parallel entry -- a programming error), the function now returns the distinct debug detail `(c) missing closed-set entry for non-tool event: <event>`. The ordinary value-miss path continues to emit `(c) matcher value not in closed set for <event>: <matcher>`. Added an architecture-level test in `hooks-supportability.test.ts` that walks `NON_TOOL_EVENT_FIELDS` and asserts every non-null-field event has a `NON_TOOL_EVENT_CLOSED_SETS` entry (and every null-sentinel event does NOT) -- the table-synchrony invariant red-fails CI at compile time so the runtime "missing entry" branch should remain statically unreachable.

---

_Fixed: 2026-06-14T18:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

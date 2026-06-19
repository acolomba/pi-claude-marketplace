---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
fixed_at: 2026-06-14T18:30:00Z
review_path: .planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 58: Code Review Fix Report

**Fixed at:** 2026-06-14T18:30:00Z
**Source review:** `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (WR-01..WR-04 and IN-01..IN-03; `fix_scope: all`)
- Fixed: 7 (4 Warning already-fixed in a prior run, 3 Info fixed in this run)
- Skipped: 0

`npm run check` (typecheck + lint + format + tests + integration tests) was
green after every fix. All 1938 unit/architecture tests plus 10
stable-fingerprint tests pass.

## Fixed Issues

### WR-01: `narrowResolverNotes` second-hooks-note falls through to `unsupported source`

**Files modified:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`, `tests/shared/probe-classifiers.test.ts`
**Commit:** `d109e3a` (prior run)
**Applied fix:** Restructured the `narrowResolverNotes` loop so each bucket is
an explicit `if (predicate) { dedup-push; continue; }` block. A duplicate hit
short-circuits before the trailing `unsupported source` catch-all, instead of
falling through. Used Option 1 from the review (explicit `continue` after
dedup). Replaced the existing "fall-through is the intended behavior" test
with one that asserts the corrected `["unsupported hooks"]` outcome and added
a second test covering two `malformed hooks.json:` notes (the motivating
scenario in the finding).

### WR-02: `readStandaloneHooks` conflates I/O errors and parse/supportability failures under `malformed hooks.json:`

**Files modified:** `extensions/pi-claude-marketplace/domain/resolver.ts`, `tests/domain/resolver-strict.test.ts`
**Commit:** `ad49e92` (prior run)
**Applied fix:** Removed the `try/catch` around
`readFileTextOf(ctx)(hooksPath)` so EACCES / EPERM / other I/O errors
propagate out of `resolveStrict`. The outer `narrowProbeError` ladder in
`orchestrators/plugin/{list,info}.ts` then classifies the thrown error by its
`.code` and emits the truthful `{permission denied}` / `{unreadable}` Reason.
Parse / schema / supportability failures continue to flow through the
structured-notes path so the catalog layer still emits `{unsupported hooks}`
for them (the wrap was already truthful for those). Used Option 1 from the
review (rethrow). Added a regression test that builds a `ResolveContext`
whose `statKind` reports the hooks file exists but `readFileText` rejects
with `EACCES`, and asserts `resolveStrict` rejects with the same error (so
`.code === "EACCES"`).

### WR-03: `hookDebugLog` writes to `console.error` from a domain module, blunting IL-3 enforcement

**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`, `eslint.config.js`
**Commit:** `5e7c894` (prior run)
**Applied fix:** Removed the per-file ESLint override that disabled
`no-console` + `no-restricted-syntax` for the entire `hooks.ts` module.
Replaced it with a single
`// eslint-disable-next-line no-console, no-restricted-syntax -- OBS-01 hand-off seam (D-58-03); retires when the shared debug-log helper lands`
directive on the one `console.error` call inside `hookDebugLog`. The
deviation surface drops from "whole file" to "one line" -- a future
contributor adding a stray `console.error` elsewhere in the file now trips
lint. Updated the file header comment so it no longer points at a per-file
override that no longer exists. Used Option 2 from the review (tighten the
lint scope) rather than deferring the stub.

### WR-04: `tryNonToolEventTrip` collapses "closed set missing" and "closed set miss" into the same debugDetail

**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`, `tests/architecture/hooks-supportability.test.ts`
**Commit:** `891e4ab` (prior run)
**Applied fix:** Replaced the optional-chain `closedSet?.has(rawMatcher)`
with an explicit two-branch split. When `closedSet === undefined` (meaning
`NON_TOOL_EVENT_FIELDS` declares a matcher target field but
`NON_TOOL_EVENT_CLOSED_SETS` has no parallel entry -- a programming error),
the function now returns the distinct debug detail
`(c) missing closed-set entry for non-tool event: <event>`. The ordinary
value-miss path continues to emit
`(c) matcher value not in closed set for <event>: <matcher>`. Added an
architecture-level test in `hooks-supportability.test.ts` that walks
`NON_TOOL_EVENT_FIELDS` and asserts every non-null-field event has a
`NON_TOOL_EVENT_CLOSED_SETS` entry (and every null-sentinel event does NOT)
-- the table-synchrony invariant red-fails CI at compile time so the runtime
"missing entry" branch should remain statically unreachable.

### IN-01: `SAFE_MATCHER_CHARS` admits `_` at the top level but Claude tool names contain none

**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`
**Commit:** `9a530ef`
**Applied fix:** Used the comment-extension option from the review (preserve
forward-compat; do NOT tighten the regex). Extended the inline JSDoc on
`SAFE_MATCHER_CHARS` with a paragraph spelling out why the looser top-level
charset is intentional: today none of the seven Claude tool names in the
TOOL-01 reverse map contain an underscore, so a tighter
`/^[A-Za-z0-9|-]+$/` would behave identically against the current tool
catalog. If a future Claude release ships a tool whose name carries an
underscore, admitting `_` here lets the token reach the TOOL-01 reverse-map
lookup (where it can be mapped or flagged unmapped) instead of being
silently demoted to the regex arm one step earlier. The TOOL-02
supportability gate still produces a precise debugDetail in either path --
the charset just controls which arm (`(a) regex matcher` vs
`(b) unmapped tool`) carries the trip.

### IN-02: `MCP_LITERAL` allows underscores in server/tool segments that overlap the `mcp__server__tool` delimiter

**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`
**Commit:** `63aed66`
**Applied fix:** Used the JSDoc-paragraph option from the review (intentional
ambiguity; do NOT change the regex). Added a paragraph to `MCP_LITERAL`'s
JSDoc explaining that the `__` delimiter is ambiguous when server or tool
segments themselves contain `__` (e.g. `mcp__a__b__c` could parse as server
`a` + tool `b__c`, or server `a__b` + tool `c`), and that this is harmless
at this layer: the parsed value is opaque
(`{kind: "mcp-literal", literal: raw}`), the parser only decides the matcher
is a supportable MCP literal and stores the raw string, and the downstream
MCP-aware bridge dispatcher (out of scope for v1.13) owns splitting the
literal on its own canonical delimiter when it needs to route to a specific
server/tool pair. Tightening the regex would push disambiguation work into
this parser without any consumer that needs the split today.

### IN-03: `hooks-supportability.test.ts:225` uses literal `"http"` for the `(d)` arm but the schema allows any string

**Files modified:** `tests/architecture/hooks-supportability.test.ts`
**Commit:** `e951d58`
**Applied fix:** Replaced the literal `"http"` handler type in the
`(d) non-command handler` arm with `"frobnicate"` so the test reads as
obviously synthetic and conveys the closed-set discipline (anything not
equal to `"command"` trips `(d)`). Updated the assertion message to
`expected "(d) non-command-handler" prefix on synthetic handler type, got: ...`
to reinforce the synthetic-input intent. Test contract is unchanged; only
the reader's intuition about what's being asserted improves.

---

_Fixed: 2026-06-14T18:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

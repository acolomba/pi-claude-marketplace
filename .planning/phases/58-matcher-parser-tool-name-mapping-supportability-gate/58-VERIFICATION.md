---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
verified: 2026-06-14T16:00:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `npm run check` (typecheck + ESLint + Prettier + full test suite) and confirm GREEN exit"
    expected: "All 1935 unit tests pass; typecheck, lint, and format all clean"
    why_human: "Cannot run the full suite in the verification environment; individual test runs confirm the targeted behaviors pass but a full regression sweep verifies no cross-file regressions from the 15-file atomic commit"
---

# Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate Verification Report

**Phase Goal:** A plugin's `hooks.json` is parsed into a normalized internal model, with regex / unmapped-tool / non-bucket-A / non-`command` plugins flipped to `(unavailable) {unsupported hooks}` at resolve time.
**Verified:** 2026-06-14T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Claude-form matchers (Edit, Bash, Edit\|Write, "", mcp__s__t) parse correctly; Pi-form lowercase never matches | ✓ VERIFIED | `parseMatcher` exported from `hooks.ts` (line 298); 9 unit tests in `hooks.test.ts` cover all arms; `CLAUDE_TO_PI_TOOL_NAMES` reverse-map lookup confirms Pi-form tokens map to `{kind:"unmapped"}` |
| 2 | hooks.json containing any regex pattern installs plugin as `(unavailable) {unsupported hooks}`; no per-entry skip | ✓ VERIFIED | `checkMatcherSupportability` returns `{ok:false, debugDetail:"(a) regex..."}` for regex arms; `parseHooksConfig` folds into `{ok:false, reason:"unsupported hooks: ..."}` via D-58-03 single-seam arm (hooks.ts lines 193-199) |
| 3 | Bidirectional Claude ↔ Pi tool-name map lives at `domain/components/hook-tool-names.ts`; architecture test asserts every Pi toolName literal has a mapping; MCP tools bypass | ✓ VERIFIED | File exists (117 lines); `PI_TO_CLAUDE_TOOL_NAMES satisfies Record<PiToolName, string>` at line 88; `CLAUDE_TO_PI_TOOL_NAMES` at line 117; 3-invariant arch test passes (3/3); find↔Glob D-58-05 entry confirmed |
| 4 | Plugins declaring hooks against non-bucket-A event / unmapped Claude tool / non-`command` handler type flip `(unavailable) {unsupported hooks}` | ✓ VERIFIED | `checkMatcherSupportability` implements TOOL-02(b)/(c)/(d) with locked prefix strings; `BUCKET_A_EVENTS` 8-tuple in `hook-events.ts`; `NON_TOOL_EVENT_CLOSED_SETS` per D-58-06; 10 unit tests in `hooks.test.ts` cover each condition |

**Score:** 4/4 ROADMAP success criteria verified

### Must-Have Truths (Plan Frontmatter — merged, deduplicated against ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | `parseMatcher` discriminated union has 5 arms (match-all / tool-set / mcp-literal / regex / unmapped); malformed pipe-OR → regex; Pi-form lowercase → unmapped | ✓ VERIFIED | `ParsedMatcher` type at hooks.ts line 267; 5 arms confirmed; 9 parseMatcher tests all pass |
| 6 | `checkMatcherSupportability` returns `{ok:false, debugDetail}` on first failure; (a)/(b)/(c)/(d) prefix strings locked | ✓ VERIFIED | Function at hooks.ts line 497; prefix strings at lines 406, 432, 440, 460, 500; arch test "TOOL-02: checkMatcherSupportability debugDetail prefixes" in hooks-supportability.test.ts |
| 7 | REASONS member `"hooks"` renamed to `"unsupported hooks"` at `shared/notify.ts:81`; `MANIFEST_FIELD_REASONS` drops `"hooks"`; narrowResolverNotes tightened to 4 prefix-anchored startsWith checks | ✓ VERIFIED | notify.ts line 81 confirmed; install.ts `MANIFEST_FIELD_REASONS = new Set(["lspServers"])`; probe-classifiers.ts has 4 startsWith arms (lines 90-93); 9 tests in probe-classifiers.test.ts all pass |
| 8 | `domain/resolver.ts` is byte-unchanged except for a JSDoc comment update (D-58-03 single-seam claim) | ✓ VERIFIED | `git diff 85b0091^..HEAD -- extensions/pi-claude-marketplace/domain/resolver.ts` shows only a 3-line JSDoc comment rewrite in the f74005b commit; no behavioral change |
| 9 | HOOK-04 atomic commit (`f74005b`) lands REASONS rename + narrowResolverNotes tightening + MANIFEST carve-out drop + catalog byte-form updates + fixture re-keys in ONE commit | ✓ VERIFIED | Confirmed via `git show f74005b --stat`; 15 files, 219 insertions(+), 86 deletions(-); no intermediate `{hooks}` bytes exist on the branch |
| 10 | Catalog gains NEW fixture states for the four TOOL-02 trigger conditions at min one per surface (install / preview / reconcile-apply / info / list) | ✗ FAILED | Atomic commit only re-keyed 7 existing fixture rows; no new catalog state sections appended to `docs/output-catalog.md`; `git show f74005b -- docs/output-catalog.md` shows 10 additions and 10 deletions (byte-rename only). The `preview` and `reconcile-applied-cascade` sections have no `{unsupported hooks}` catalog state at all |

**Score:** 9/10 plan must-haves verified

### Deferred Items

No must-have truths map to later milestone phases.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` | TOOL-01 bidirectional map + PiToolName/ClaudeToolName exports | ✓ VERIFIED | 117 lines; 7 entries each direction; `satisfies Record<PiToolName, string>` exhaustiveness gate; D-58-05 find↔Glob entry |
| `extensions/pi-claude-marketplace/domain/components/hook-events.ts` | BUCKET_A_EVENTS 8-tuple + TOOL_EVENTS + NON_TOOL_EVENT_FIELDS + NON_TOOL_EVENT_CLOSED_SETS | ✓ VERIFIED | 145 lines; all 4 exports confirmed; D-58-06 strict closed sets (SessionStart: {startup,resume}, SessionEnd/PreCompact/PostCompact: empty, UserPromptSubmit: null sentinel) |
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` | parseMatcher + checkMatcherSupportability + extended parseHooksConfig | ✓ VERIFIED | 513 lines (+332 from Phase 57 baseline of 181 lines); all 3 exports confirmed; D-58-03 single-seam arm present |
| `tests/architecture/hooks-tool-name-map.test.ts` | 3 TOOL-01 invariant tests | ✓ VERIFIED | 3/3 pass: inverse round-trip, peer-dep completeness with count-lock, D-58-05 find↔Glob lock |
| `tests/architecture/hooks-supportability.test.ts` | 6 tests (5 from Plan 02 + 1 from Plan 03) | ✓ VERIFIED | 6/6 pass: BUCKET_A_EVENTS deepEqual, TOOL_EVENTS subset, NON_TOOL_EVENT_FIELDS entries, NON_TOOL_EVENT_CLOSED_SETS per-event, UserPromptSubmit absence, debugDetail prefixes |
| `tests/shared/probe-classifiers.test.ts` | 9 tests for narrowResolverNotes tightened contract | ✓ VERIFIED | 9/9 pass; covers 4 prefix-anchored happy paths, Pitfall 2 negative case, lsp regression, permissive fallback, empty input, multi-note dedup |
| `docs/output-catalog.md` | 8 byte-form renames; NEW TOOL-02 catalog states per surface | ⚠️ PARTIAL | 8 byte-form renames confirmed (grep count = 8); NO new catalog state sections added for TOOL-02 trigger conditions; preview and reconcile-applied-cascade sections have no `{unsupported hooks}` state |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hooks.ts::parseMatcher` | `hook-tool-names.ts::CLAUDE_TO_PI_TOOL_NAMES` | reverse-map lookup at parse time | ✓ WIRED | Import at hooks.ts line 43; usage at line 343 `(CLAUDE_TO_PI_TOOL_NAMES as Record<string, PiToolName | undefined>)[token]` |
| `hooks.ts::checkMatcherSupportability` | `hook-events.ts::{BUCKET_A_EVENTS, TOOL_EVENTS, NON_TOOL_EVENT_FIELDS, NON_TOOL_EVENT_CLOSED_SETS}` | membership + per-event field/value-set lookup | ✓ WIRED | Import at hooks.ts line 42; usage in checkMatcherSupportability body (lines 497-520) |
| `hooks.ts::parseHooksConfig` | `domain/resolver.ts` | `{ok:false, reason}` arm consumed by existing not-installable cascade | ✓ WIRED | resolver.ts imports parseHooksConfig at line 34; readStandaloneHooks at lines 653-659 wraps the result with `malformed hooks.json:` prefix; no behavioral change to resolver |
| `shared/notify.ts::REASONS[8]` | `shared/probe-classifiers.ts::narrowResolverNotes return-type` | literal-union derive | ✓ WIRED | notify.ts line 81 is `"unsupported hooks"`; probe-classifiers.ts line 85 return type includes `"unsupported hooks"` |
| `domain/components/hooks.ts::parseHooksConfig` | `shared/probe-classifiers.ts::narrowResolverNotes` | 4 startsWith prefix-anchored checks | ✓ WIRED | The three prefixes from hooks.ts (`hooks.json is not valid JSON:`, `hooks.json failed schema validation:`, `unsupported hooks:`) plus the resolver wrapper (`malformed hooks.json:`) are all detected |

### Data-Flow Trace (Level 4)

No rendering components that display dynamic data — all Phase 58 artifacts are pure domain-layer parsers and static lookup tables. Level 4 not applicable.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TOOL-01: 3 arch-test invariants pass | `node --test tests/architecture/hooks-tool-name-map.test.ts` | pass 3 | ✓ PASS |
| TOOL-02: 6 supportability invariants pass | `node --test tests/architecture/hooks-supportability.test.ts` | pass 6 | ✓ PASS |
| MATCH-01/02: 35 hooks domain tests pass | `node --test tests/domain/components/hooks.test.ts` | pass 35 | ✓ PASS |
| HOOK-04: 9 narrowResolverNotes contract tests pass | `node --test tests/shared/probe-classifiers.test.ts` | pass 9 | ✓ PASS |
| Phase 57 baseline not regressed | `node --test tests/architecture/hooks-foundation.test.ts` | pass 8 | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files declared or referenced in Phase 58 plans. Step 7c SKIPPED — no conventional probes for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MATCH-01 | 58-03 | Claude-form matcher normalization into ParsedMatcher | ✓ SATISFIED | `parseMatcher` exports 5-arm discriminated union; 9 unit tests cover all arms including Pi-form rejection and pipe-OR |
| MATCH-02 | 58-03 | Regex matcher detection → TOOL-02(a) trip | ✓ SATISFIED | SAFE_MATCHER_CHARS regex gate in `parseMatcher`; `{kind:"regex"}` arm feeds TOOL-02(a); checkMatcherSupportability returns `(a) regex...` debugDetail |
| TOOL-01 | 58-01 | Bidirectional Claude↔Pi tool-name map at domain/components/hook-tool-names.ts | ✓ SATISFIED | File exists; 7 entries each direction; `satisfies Record<PiToolName, string>` exhaustiveness gate; arch test with count-lock |
| TOOL-02 | 58-02/03 | Four-condition supportability gate (a/b/c/d) | ✓ SATISFIED | `checkMatcherSupportability` implements all 4 conditions; D-58-06 closed sets in hook-events.ts; 10 unit tests |
| HOOK-04 | 58-04 | REASONS rename `"hooks"` → `"unsupported hooks"`; carve-out drop | ✓ SATISFIED | notify.ts line 81 confirmed; MANIFEST_FIELD_REASONS drops `"hooks"`; narrowResolverNotes tightened; atomic commit f74005b |

All 5 required requirement IDs (MATCH-01, MATCH-02, TOOL-01, TOOL-02, HOOK-04) accounted for and marked Complete in REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `hooks.ts` | 162 | `console.error` in domain module via `hookDebugLog` | ⚠️ Warning | WR-03 (code review): IL-3 widening — a second sanctioned direct-stderr write beyond the single legacy migration `console.warn`. Per-file ESLint override at `eslint.config.js:167` suppresses the rule file-wide (not line-scoped), making future stray `console.error` additions in the file invisible to lint. Phase comment cites OBS-01 as the retirement path. No runtime correctness defect. |
| `hooks.ts` | 436-442 | `closedSet?.has(rawMatcher)` optional-chain collapses two failure modes | ⚠️ Warning | WR-04 (code review): When `NON_TOOL_EVENT_FIELDS[event]` exists but `NON_TOOL_EVENT_CLOSED_SETS[event]` is absent (programming error), `closedSet?.has` returns `undefined`, `!undefined === true`, and the debugDetail lies: "(c) matcher value not in closed set" instead of a more accurate "missing closed-set entry". Architecture tests lock the current 4 entries so the immediate exposure is low. Not a blocker for current must-haves. |
| `probe-classifiers.ts` | 84-100 | Deduplication misfires for second hooks-prefixed note | ⚠️ Warning | WR-01 (code review): A second hooks-prefixed note in the same `notes[]` array falls through to `unsupported source` because `seen.has("unsupported hooks")` is true and the code lacks an explicit `continue`. Test line 100 ACCEPTS this as "intended" behavior (`["unsupported hooks", "unsupported source"]`), but the resulting brace is semantically wrong — two hooks-related failures should not emit `{unsupported source}`. Does not affect the current must-have truth that "narrowResolverNotes emits `unsupported hooks`" for single-note cases. |
| `domain/resolver.ts` | 650-659 | `readStandaloneHooks` wraps EACCES/EPERM under `malformed hooks.json:` prefix | ⚠️ Warning | WR-02 (code review): A permission-denied hooks file renders as `{unsupported hooks}` instead of `{permission denied}`. The `narrowResolverNotes` probe-classifiers detect the `malformed hooks.json:` prefix and emit `unsupported hooks` regardless of the underlying error class. This misclassification is a known issue (WR-02) but does not touch any Phase 58 must-have truth. |

No TBD, FIXME, or XXX debt markers found in Phase 58 modified source files.

### Human Verification Required

#### 1. Full `npm run check` suite green-exit confirmation

**Test:** Run `npm run check` from the repository root on the features/v1.13-hook-bridge branch.
**Expected:** All checks pass — typecheck, ESLint flat config, Prettier, and the full node:test suite (reported as 1935 tests in the Plan 04 SUMMARY). The atomic commit f74005b touched 15 files including orchestrator snapshot tests; a full run catches any cross-file regression the targeted spot-checks could not.
**Why human:** Running the full test suite (1935 tests + integration tests + lint + format) requires the repository environment. Individual targeted test runs confirm the Phase 58 behavioral goals pass, but the SUMMARY's "1935 / 1935 pass" claim was made by the executor and needs independent confirmation.

### Gaps Summary

One plan must-have failed: Plan 04 required "Catalog gains NEW fixture states for the four TOOL-02 trigger conditions: at minimum one fixture per orchestrator surface (install / preview / reconcile-apply / info / list)." The atomic commit f74005b only re-keyed 7 existing fixture rows (byte rename `{hooks}` → `{unsupported hooks}`) and added NO new catalog state sections. The `docs/output-catalog.md` git diff shows exactly 10 additions and 10 deletions — a pure rename. Neither the `preview` section (line 1217+) nor the `reconcile-applied-cascade` section (line 1291+) contain any `{unsupported hooks}` catalog state entry.

**Assessment:** This gap is documentation-only and does not affect behavioral correctness. The ROADMAP success criteria (the binding contract) do not require catalog states; they require behavioral correctness of the parser and supportability gate, which is verified. The missing catalog states are a test-documentation gap: future contributors cannot use catalog-uat.test.ts to verify TOOL-02-triggered unavailability on the preview or reconcile surfaces by example. However, existing `{unsupported hooks}` fixture rows in the install, list, and info sections cover the byte-equality gate for those surfaces.

The code review findings (WR-01 through WR-04) are warnings, not blockers. None touch a ROADMAP success criterion. The most impactful (WR-01 deduplication misfiring, WR-02 EACCES misclassification, WR-04 optional-chain collapse) are improvement candidates for a follow-up plan.

---

_Verified: 2026-06-14T16:00:00Z_
_Verifier: Claude (gsd-verifier)_

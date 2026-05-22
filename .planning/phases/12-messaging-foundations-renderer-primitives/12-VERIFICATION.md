---
phase: 12-messaging-foundations-renderer-primitives
verified: 2026-05-22T22:10:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
gaps: []
deferred: []
human_verification: []
---

# Phase 12: Messaging Foundations & Renderer Primitives Verification Report

**Phase Goal:** Land the closed-set constants, renderer primitives, notify-helper signatures, single-trailer reload-hint composer, and the rewritten sanctioned `console.warn` wording -- everything the Phase 13 mechanical refactor depends on but that can land without breaking the user contract.

**Verified:** 2026-05-22T22:10:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Importing STATUS_TOKENS yields exactly 14 entries matching frontmatter; no `reinstalled` token | VERIFIED | `shared/grammar/status-tokens.ts` has 14-entry `as const` array; `grep "reinstalled"` returns no match; drift test passes |
| 2 | Importing REASONS yields exactly 23 entries matching frontmatter | VERIFIED | `shared/grammar/reasons.ts` has 23-entry `as const` array byte-equal to style-guide frontmatter |
| 3 | Drift test asserts set-equality against style-guide frontmatter | VERIFIED | `tests/architecture/grammar-frontmatter.test.ts` exists with 4 tests (2 set-equality + 2 extractor guards); no YAML dep; runs within `npm run check` |
| 4 | reloadHint collapsed to single trailer; ReloadVerb removed; all 8 callsites migrated | VERIFIED | `presentation/reload-hint.ts` exports `reloadHint(names: readonly string[]): string`; `RELOAD_HINT_TRAILER` const present; `grep ReloadVerb extensions/` = 0 matches; `grep -rE "reloadHint\\(\"(load|refresh|drop)\"" extensions/` = 0 matches; 8 callsite lines confirmed in orchestrators |
| 5 | `persistence/migrate.ts:178` contains byte-exact §14.1 wording with IL-3 comment preserved verbatim above | VERIFIED | Template literal `Legacy marketplace migration could not be persisted to ${stateJsonPath}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.` confirmed; IL-3 comment `// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` confirmed directly above; exactly 1 `console.warn(` callsite |
| 6 | `shared/notify.ts` header names four wrappers and links to MSG-SR-1..7; signatures unchanged | VERIFIED | Header contains CMC-19, D-CMC-11, D-CMC-13 citations; 9 MSG-SR references; 4 `export function notify*` definitions; signatures byte-identical; no 5th wrapper |
| 7 | `npm run check` green; no eslint.config.js widening; RELOAD_HINT_PREFIX retained | VERIFIED | `npm run check` exits 0; 1038/1038 tests pass; `grep "RELOAD_HINT_PREFIX" shared/markers.ts` returns export with value `"Run /reload to "`; eslint.config.js not modified |

**Score:** 7/7 truths verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CMC-08 | 12-01 | Closed status-token set (14 entries; no reinstalled); frontmatter binding | SATISFIED | `shared/grammar/status-tokens.ts` with 14-entry `as const` array; `reinstalled` clause dropped from REQUIREMENTS.md |
| CMC-11 | 12-01 | Closed reasons set (23 entries; frontmatter binding; reconciled from 24) | SATISFIED | `shared/grammar/reasons.ts` with 23-entry `as const` array; REQUIREMENTS.md, ROADMAP.md, CONTEXT.md all say "23 reasons" |
| CMC-14 | 12-02 | Reload-hint composer to single canonical trailer; three-verb selector retired | SATISFIED | `presentation/reload-hint.ts` with `reloadHint(names): string`; `RELOAD_HINT_TRAILER = "/reload to pick up changes"`; 8 callsites migrated; `ReloadVerb` fully purged |
| CMC-19 | 12-04 | Severity wrapper inventory; four wrappers named with MSG-SR-N links | SATISFIED | `shared/notify.ts` header expanded with SANCTIONED WRAPPERS block; CMC-19/D-CMC-11/D-CMC-13 cited; no 5th wrapper; signatures unchanged |
| CMC-36 | 12-03 | `persistence/migrate.ts` console.warn adopts §14.1 byte-exact wording | SATISFIED | Template literal byte-exact; legacy `"failed to persist migrated state to"` absent; CMC-36 source-byte test in `tests/persistence/migrate.test.ts` |
| CMC-37 | 12-03 | IL-3 inline `eslint-disable-next-line` comment preserved; no config widening | SATISFIED | IL-3 comment byte-identical directly above warn; exactly 1 warn callsite; `eslint.config.js` unchanged; CMC-37 source-byte test present |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` | 14-entry `as const` + `StatusToken` union | VERIFIED | Exists, substantive (14 entries), layered correctly (no imports from higher layers) |
| `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` | 23-entry `as const` + `Reason` union | VERIFIED | Exists, substantive (23 entries), layered correctly |
| `tests/architecture/grammar-frontmatter.test.ts` | Set-equality drift test with extractor guards | VERIFIED | Exists, substantive (4 tests), wired to both constants modules and style-guide file |
| `extensions/pi-claude-marketplace/presentation/reload-hint.ts` | Single-trailer composer with `RELOAD_HINT_TRAILER` const; no `ReloadVerb` | VERIFIED | Exists, ~57 lines, substantive; exports `reloadHint(names: readonly string[]): string` and `appendReloadHint` |
| `extensions/pi-claude-marketplace/presentation/index.ts` | Barrel without `ReloadVerb` re-export | VERIFIED | Exports `appendReloadHint, reloadHint`; no `ReloadVerb` line |
| `tests/presentation/reload-hint.test.ts` | 5 tests: 3 MSG-RH-1 + 2 appendReloadHint | VERIFIED | Exactly 5 `test(` blocks; references MSG-RH-1; no `ReloadVerb`/verb-literal/`RELOAD_HINT_PREFIX` |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | Byte-exact §14.1 wording at line ~178; IL-3 comment above | VERIFIED | Template literal confirmed; IL-3 comment confirmed directly above; single callsite |
| `docs/messaging-style-guide.md` | §14 past-tense "Phase 12 LANDED"; §14.1 heading + closing paragraph updated | VERIFIED | `grep "Phase 12 LANDED"` returns match; heading `### 14.1 Wording (Phase 12 landed)` confirmed; old "discretion" framing absent |
| `extensions/pi-claude-marketplace/shared/notify.ts` | Header expanded with CMC-19 SANCTIONED WRAPPERS inventory + MSG-SR links | VERIFIED | 9 MSG-SR references; CMC-19/D-CMC-11/D-CMC-13 present; 4 wrappers; signatures byte-identical |
| `tests/persistence/migrate.test.ts` | Updated runtime regexes + 3 source-byte tests (CMC-36 wording, CMC-37 comment, CMC-37 count) | VERIFIED | CMC-36/CMC-37 test names present; updated runtime regexes match new wording |
| `CHANGELOG.md` | Phase-12 entry with D-CMC-10 carve-out citation | VERIFIED | `grep "D-CMC-10"` returns match; `"8 reload-hint callsite trailers now emit /reload to pick up changes; Phase 12 carve-out per D-CMC-10"` confirmed verbatim; `"roadmap criterion #2 authorizes"` confirmed |
| `.planning/REQUIREMENTS.md` | CMC-08 no `reinstalled` clause; CMC-11 says "23 reasons" | VERIFIED | `grep "plus the \`reinstalled\` token"` = NOT FOUND; `grep "24 reasons"` = NOT FOUND; `grep "23 reasons"` matches CMC-11 |
| `.planning/ROADMAP.md` | Phase 12 scope says "23 reasons"; success criterion #1 says "23 entries" | VERIFIED | `grep "24 reasons"` = NOT FOUND; `grep "23 entries in \`reasons:\`"` confirmed in success criterion #1 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/architecture/grammar-frontmatter.test.ts` | `shared/grammar/status-tokens.ts` | `import { STATUS_TOKENS }` | WIRED | Import on line 8; array iterated in set-equality test |
| `tests/architecture/grammar-frontmatter.test.ts` | `shared/grammar/reasons.ts` | `import { REASONS }` | WIRED | Import on line 7; array iterated in set-equality test |
| `tests/architecture/grammar-frontmatter.test.ts` | `docs/messaging-style-guide.md` | `readFile + extractFrontmatterList` | WIRED | `STYLE_GUIDE_PATH` resolved from REPO_ROOT; both tests do `readFile(STYLE_GUIDE_PATH)` |
| Orchestrators (8 files) | `presentation/reload-hint.ts` | `reloadHint(names)` | WIRED | 8 callsites confirmed with 1-arg signature; no verb-literal first args |
| `tests/presentation/reload-hint.test.ts` | `presentation/reload-hint.ts` | `import { appendReloadHint, reloadHint }` | WIRED | Import on lines 4-7; 5 test assertions use the functions |
| `tests/persistence/migrate.test.ts` | `persistence/migrate.ts` | `readFile(MIGRATE_PATH)` + runtime mock | WIRED | CMC-36/37 source-byte tests read migrate.ts; runtime mock-capture test imports `persistMigratedState` |
| `shared/notify.ts` header | `docs/messaging-style-guide.md §10` | doc comment citing MSG-SR-1..7 | WIRED | 9 MSG-SR references in header comment; per-wrapper rule assignments match §10 |

### Data-Flow Trace (Level 4)

Level 4 not applicable: Phase 12 delivers pure-data constants modules, a composer function, a docs-only edit to a notify wrapper, and a wording rewrite in an error path. No component renders dynamic user-visible data from a database or external source. The reload-hint composer is a pure function with a fixed literal return; the constants are static exports; the notify wrapper is a pass-through. No hollow-prop or DISCONNECTED risk.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| npm run check (all gates green) | `npm run check` | exit 0; typecheck + ESLint + Prettier + 1038/1038 tests pass | PASS |
| STATUS_TOKENS has 14 entries, no `reinstalled` | `grep -c "as const" + count array` | 14 entries confirmed; `grep "reinstalled"` = 0 matches | PASS |
| REASONS has 23 entries | array count in source | 23 entries confirmed | PASS |
| No verb-arg reloadHint callsites remain | `grep -rE "reloadHint\\(\"(load|refresh|drop)\""` | 0 matches | PASS |
| ReloadVerb fully purged from extensions/ | `grep -rF "ReloadVerb" extensions/` | 0 matches | PASS |
| RELOAD_HINT_PREFIX retained in markers.ts | `grep "RELOAD_HINT_PREFIX" shared/markers.ts` | returns export with value `"Run /reload to "` | PASS |
| Single console.warn callsite in migrate.ts | `grep -c "console.warn(" migrate.ts` | returns 1 | PASS |
| IL-3 comment directly above warn | `awk '/console.warn/{print prev}'` | returns IL-3 disable comment | PASS |
| Style guide §14.1 past-tense framing | `grep "Phase 12 LANDED"` | match found; old "Phase 13 PROPOSES" = NOT FOUND | PASS |
| CHANGELOG.md D-CMC-10 citation | `grep -F "D-CMC-10" CHANGELOG.md` | match found with full binding phrase | PASS |
| D-07 single-callsite discipline | `grep -rn "ctx.ui.notify" extensions/ \| grep -v shared/notify.ts \| grep -v comment` | only comment references outside notify.ts; no direct callsites | PASS |

### Probe Execution

No probe scripts declared in this phase's plans or SUMMARY files. No `scripts/*/tests/probe-*.sh` files relevant to Phase 12. Step 7c: SKIPPED (no probes declared or applicable).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `presentation/reload-hint.ts` | 50 | `TODO (Phase 13, MSG-RH-1)` | Info | Intentional deferral of `appendReloadHint` blank-line-above conformance to Phase 13; explicitly cited in plan scope carve-outs and SUMMARY; not a blocker for Phase 12 goal |

No `TBD`, `FIXME`, or `XXX` markers found in Phase 12 modified files. The single `TODO` is a formally deferred item referencing Phase 13's mechanical refactor scope -- it is a documented deferral, not unresolved debt.

### Human Verification Required

None. All must-haves are verifiable programmatically. The user-visible output changes are covered by the D-CMC-10 carve-out documented in CHANGELOG.md and the PLAN.md objective, and are validated by the 1038-test suite passing.

### Gaps Summary

None. All six requirements (CMC-08, CMC-11, CMC-14, CMC-19, CMC-36, CMC-37) and all five roadmap success criteria are fully satisfied in the codebase.

---

## Detailed Findings

### CMC-08 and CMC-11: Closed-Set Grammar Constants (Plan 12-01)

`shared/grammar/status-tokens.ts` and `shared/grammar/reasons.ts` exist under a new `shared/grammar/` directory as siblings to `shared/markers.ts`. Both use the D-CMC-03 shape (`as const` array + derived literal union). STATUS_TOKENS has exactly 14 entries matching the style-guide frontmatter; REASONS has exactly 23 entries. Neither imports from `presentation/`, `persistence/`, or `orchestrators/` (D-11 layering preserved). The `reinstalled` token does not appear in STATUS_TOKENS; REQUIREMENTS.md CMC-08 no longer contains the spurious clause. REQUIREMENTS.md CMC-11, ROADMAP.md Phase 12 scope text, and ROADMAP.md success criterion #1 all say "23 reasons" -- no remaining "24 reasons" references.

The drift test at `tests/architecture/grammar-frontmatter.test.ts` reads `docs/messaging-style-guide.md` via a local hand-rolled regex extractor (no YAML dependency per D-CMC-04), asserts set-equality for both arrays, and includes two extractor-guard tests. The test is included in the `npm run check` suite and passes.

### CMC-14: Reload-Hint Composer Collapse (Plan 12-02)

`presentation/reload-hint.ts` is a ~57-line file with a file-private `RELOAD_HINT_TRAILER = "/reload to pick up changes"` const (D-CMC-07). The exported `reloadHint(names: readonly string[]): string` function returns the trailer or `""`. `ReloadVerb` type is deleted; `RELOAD_HINT_PREFIX` import is removed. `presentation/index.ts` barrel no longer exports `ReloadVerb`. All 8 orchestrator callsites use the 1-arg signature with no verb literal.

`tests/presentation/reload-hint.test.ts` has exactly 5 tests (3 MSG-RH-1 composer + 2 appendReloadHint) with no legacy references. `shared/markers.ts` RELOAD_HINT_PREFIX export is byte-unchanged (D-CMC-08 retention). `tests/architecture/markers-snapshot.test.ts` is untouched.

CHANGELOG.md contains the binding D-CMC-10 carve-out citation with all three required literal strings: "D-CMC-10", "8 reload-hint callsite trailers now emit /reload to pick up changes; Phase 12 carve-out per D-CMC-10", and "roadmap criterion #2 authorizes".

### CMC-36 and CMC-37: migrate.ts Wording + IL-3 Discipline (Plan 12-03)

`persistence/migrate.ts` at line 178 contains the byte-exact §14.1 template literal. The IL-3 inline disable comment `// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` is byte-identical and sits on the line directly above the warn. Exactly one `console.warn(` callsite exists in the file. `eslint.config.js` was not modified.

`docs/messaging-style-guide.md` §14 MSG-LC-1 row contains "Phase 12 LANDED the new wording"; §14.1 heading is "### 14.1 Wording (Phase 12 landed)"; §14.1 closing paragraph begins "The wording above is the binding text shipped at persistence/migrate.ts:178 in Phase 12 per D-CMC-14." The old framing ("Phase 12 PROPOSES", "Phase 13 owns", "Phase 13's planner has FINAL discretion") is absent.

`tests/persistence/migrate.test.ts` has updated runtime-capture regexes matching the new wording plus three source-byte tests: CMC-36 wording, CMC-37 IL-3 comment preservation regex, and CMC-37 single-callsite count.

### CMC-19: Notify Wrapper Inventory (Plan 12-04)

`shared/notify.ts` header comment has been expanded to 41 effective comment lines. The new SANCTIONED WRAPPERS block names all four wrappers (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) with their signatures and MSG-SR-N rule assignments sourced from style guide §10. CMC-19, D-CMC-11 (no 5th wrapper), and D-CMC-13 (stable import path) are all cited. The original 15-line D-07/eslint-override paragraph is preserved verbatim. Wrapper signatures and bodies are byte-identical. `presentation/index.ts` is unchanged (no new barrel re-export). D-07 single-callsite discipline: the only actual `ctx.ui.notify(` callsites are the 4 within `shared/notify.ts` itself.

---

_Verified: 2026-05-22T22:10:00Z_
_Verifier: Claude (gsd-verifier)_

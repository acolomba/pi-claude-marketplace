---
phase: 21-final-teardown-green-gate
verified: 2026-05-27T23:30:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: G-21-01 outstanding from initial verification (post Plans 21-01..21-03)
  gaps_closed:
    - "G-21-01: /claude:plugin list reload-hint misfire (closed by Plan 21-04 commit 5a82471)"
    - "CR-01: orphan-fold filter regression introduced by Plan 21-04 (closed by commit 770ce92)"
    - "WR-01: PluginPresentMessage missing per-variant invariants (closed by dc943e9)"
    - "WR-03 / WR-04: catalog status-token reference missing present discriminator + list surface (closed by 962d7df)"
  gaps_remaining: []
  regressions: []
---

# Phase 21: Final Teardown & GREEN Gate -- Verification Report

**Phase Goal (ROADMAP.md):** The v1.3 drift-guard infrastructure is fully retired -- 34-rule lint plugin gone, registry parity test gone, V1 wrappers gone, `eslint.config.js` swapped to stock rules -- and `npm run check` is GREEN against the new minimal surface.

**Re-verification:** Post-gap-closure verification after G-21-01 was reported during initial verification of Plans 21-01..21-03, then closed by Plan 21-04 (commit `5a82471`), with subsequent code-review fixes (CR-01 BLOCKER at commit `770ce92`, plus WR-01/WR-03/WR-04 warnings at `dc943e9`, `962d7df`, `d1dc5e1`).

**Verified:** 2026-05-27T23:30:00Z
**Status:** **passed**

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                | Status     | Evidence                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ROADMAP SC#1: `tests/lint-rules/` + `msg-rule-registry.test.ts` are absent                                                                          | VERIFIED   | Both confirmed absent on disk; `test -d tests/lint-rules` exits 1; `test -f tests/architecture/msg-rule-registry.test.ts` exits 1.                                                                                                       |
| 2   | ROADMAP SC#2: V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError`) and V1 3-arg `notifyUsageError` deleted from `shared/notify.ts`        | VERIFIED   | `grep -nE "^export function notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/shared/notify.ts` returns no matches.                                                                                                  |
| 3   | ROADMAP SC#3: `eslint.config.js` has stock rules only; no MSG-* wirings; `no-restricted-syntax` + `no-console` retained; `persistence/migrate.ts` override active | VERIFIED   | `grep -E "import msgPlugin\|msg/(sr-\|...)" eslint.config.js` returns no matches; BLOCK A `no-restricted-syntax` selector retained; BLOCK B-2 override for `persistence/migrate.ts` present; no inline `eslint-disable` in `migrate.ts`. |
| 4   | ROADMAP SC#4: `no-legacy-markers.test.ts` absent; `shared/grammar/` absent; closed sets inlined into `shared/notify.ts`                              | VERIFIED   | All four deletes confirmed; `grep -c "^export const REASONS\|^export const STATUS_TOKENS\|^export const MARKERS\|^export const PATTERN_CLASSES" extensions/pi-claude-marketplace/shared/notify.ts` returns each = 1.                    |
| 5   | ROADMAP SC#5: `npm run check` GREEN                                                                                                                  | VERIFIED   | Re-ran `npm run check` at verification time: exit code 0; `# tests 1123 / # pass 1123 / # fail 0 / # skipped 0 / # todo 0`.                                                                                                              |
| 6   | G-21-01 closure: `/claude:plugin list` with zero state changes emits NO `/reload to pick up changes` trailer                                         | VERIFIED   | `installedRowMessage` at `list.ts:255` emits `status: "present"`; `shouldEmitReloadHint` body unchanged and triggers only on the four state-change tokens (verified `installed`/`updated`/`reinstalled`/`uninstalled` plugin tokens). Regression Test A in `tests/shared/notify-v2.test.ts` asserts negative. |
| 7   | Cascade rows with real state changes (install/update/reinstall/uninstall) STILL emit the reload-hint                                                 | VERIFIED   | Regression Test B in `tests/shared/notify-v2.test.ts` asserts positive; 4 token checks in `shouldEmitReloadHint` body present.                                                                                                          |
| 8   | CR-01 BLOCKER closure: orphan-fold carry-over filter at `list.ts:690` discriminates on `"present"` (post-21-04) instead of unreachable `"installed"` | VERIFIED   | Read `list.ts:701`: `folded = projectSideRows.filter((r) => r.status === "present" \|\| r.status === "upgradable");` -- correct discriminator. New regression test at `tests/orchestrators/plugin/list.test.ts:441` ("CR-01 / G-21-01: project-scope plugin under a CLONED user marketplace folds...") passes. |
| 9   | `tests/integration/fold-adoption.test.ts` phase 2 (line 238) PASSES (was FAIL on diff base)                                                          | VERIFIED   | `node --test tests/integration/fold-adoption.test.ts` shows phase 2 (`ok 2`) passing; phase 1 (line 165) still fails for unrelated pre-existing reasons -- flagged below in Pre-Existing Conditions, NOT a phase 21 gap.                  |
| 10  | WR-01: `tests/architecture/notify-types.test.ts` has `_VPresent` alias + per-variant invariants (post-WR-01 fix)                                     | VERIFIED   | `grep` confirms 9 `_VPresent` references including `_VPresent` alias at line 89, `_NoCauseOnPresent`, `_NoRollbackOnPresent`, `_NoReasonsOnPresent`, `_NoFromOnPresent`, `_NoToOnPresent`, `_Assert_DepsRequiredPresent`, `_Assert_DepsNotOptionalPresent`, `_Assert_ScopeOnPresent`. |
| 11  | WR-03/WR-04: `docs/output-catalog.md` includes `(installed)` row with `list` surface + `(installed) (via present discriminator)` row                | VERIFIED   | Catalog line 113: `(installed)` row "Where it appears" now starts with `list`; catalog line 114: new `(installed) (via present discriminator)` row exists immediately after.                                                              |
| 12  | All ROADMAP-mapped requirements (SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32) are Complete in `.planning/REQUIREMENTS.md` traceability    | VERIFIED   | Traceability table shows all 7 phase-21-mapped IDs as Complete; SNM-23 remains Pending per documented B6 scope discipline (Phase 20 record-keeping debt).                                                                                |

**Score:** 12/12 truths verified.

### Required Artifacts (Three Levels: exists, substantive, wired)

| Artifact                                                                              | Expected                                                                                  | Status     | Details                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.js`                                                                    | Stock rules; BLOCK B-2 for migrate.ts; no MSG-* wirings; no tests/lint-rules overrides    | VERIFIED   | All checks pass; file is 323-ish lines; BLOCK A/B/C/D/E present.                                                                                                                                              |
| `extensions/pi-claude-marketplace/shared/notify.ts`                                   | V2-only; inlined REASONS/STATUS_TOKENS/MARKERS/PATTERN_CLASSES; PluginPresentMessage added; `case "present"` arm; `shouldEmitReloadHint` unchanged | VERIFIED   | `interface PluginPresentMessage` count=1; `case "present"` count=1; `\| PluginPresentMessage` count=1; 4 state-change tokens present in `shouldEmitReloadHint`.                                                |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`                       | `installedRowMessage` returns `PluginPresentMessage \| PluginUpgradableMessage`; emits `status: "present"`; orphan-fold filter discriminates on `"present"` | VERIFIED   | `status: "present"` emitted at line 255; `status: "installed"` count=0 in this file; orphan-fold filter at line 701 uses `r.status === "present" \|\| r.status === "upgradable"`.                              |
| `extensions/pi-claude-marketplace/persistence/migrate.ts`                             | No inline `eslint-disable` directives                                                     | VERIFIED   | `grep -n "eslint-disable" extensions/pi-claude-marketplace/persistence/migrate.ts` returns no matches.                                                                                                          |
| `tests/architecture/notify-types.test.ts`                                             | Per-variant invariants for `_VPresent`                                                    | VERIFIED   | 9 `_VPresent`/`Present` symbols present in file (alias + 5 negative-presence + 4 positive assertions).                                                                                                         |
| `tests/architecture/catalog-uat.test.ts`                                              | 13 list-surface fixtures use `status: "present"`                                          | VERIFIED   | `grep -c 'status: "present"' tests/architecture/catalog-uat.test.ts` = 13; runner passes (3 tests).                                                                                                            |
| `tests/orchestrators/plugin/list.test.ts`                                             | PL-1 byte assertion no longer has `/reload to pick up changes`; new CR-01 regression test | VERIFIED   | `grep "/reload to pick up changes" tests/orchestrators/plugin/list.test.ts` returns no matches; CR-01 regression test exists at line 441; suite passes 29/29.                                                  |
| `tests/shared/notify-v2.test.ts`                                                      | 2 new G-21-01 regression tests (list-shape no trailer; cascade trailer preserved)         | VERIFIED   | `grep -c "UAT G-21-01" tests/shared/notify-v2.test.ts` = 3 (alias + 2 test names); suite passes 43/43.                                                                                                         |
| `docs/output-catalog.md`                                                              | Status-token table includes `(installed) (via present discriminator)` row; `(installed)` row mentions `list` surface; G-21-01 clarification paragraph; no `/reload` trailer in `/claude:plugin list` section | VERIFIED   | Line 113 + 114 confirmed; line 71 has "is deliberately ABSENT" clarification; trailer count: 29 (was 36 pre-edit); list section has zero trailers.                                                              |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts`                             | 4 exhaustive switches over `PluginNotificationMessage["status"]` extended with `case "present":` | VERIFIED   | Plan 21-04 SUMMARY documents this as Rule 1 auto-fix; typecheck GREEN end-to-end confirms exhaustiveness.                                                                                                       |

All artifacts pass Level 1 (exists), Level 2 (substantive), Level 3 (wired).

### Key Link Verification

| From                                       | To                                                          | Via                                                  | Status | Details                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `orchestrators/plugin/list.ts::installedRowMessage` | `shared/notify.ts::PluginPresentMessage`           | Type import + return type + literal `status: "present"` | WIRED  | Read at lines 250-260: imports `PluginPresentMessage`, return type updated, single literal emission.                  |
| `shared/notify.ts::shouldEmitReloadHint`   | 4 state-change tokens (installed/updated/reinstalled/uninstalled) | switch-style equality checks; deliberately does NOT include `"present"` | WIRED  | All 4 plugin tokens present in function body; no `"present"` token in function body; function body unchanged by Plan 21-04. |
| `shared/notify.ts::renderPluginRow`        | `case "present"`                                            | switch arm                                           | WIRED  | Arm present; body byte-identical to `case "installed"` (same `joinTokens([ICON_INSTALLED, ..., "(installed)", ...])`). |
| `orchestrators/plugin/list.ts` orphan-fold filter (line 690-701) | `r.status === "present" \|\| r.status === "upgradable"` | Direct filter predicate                              | WIRED  | CR-01 BLOCKER fix verified: filter now correctly carries `present` rows (the post-21-04 list-surface inventory token). |
| `tests/integration/fold-adoption.test.ts` phase 2 (line 238) | Orphan-fold rendering            | End-to-end orchestrator + renderer trace             | WIRED  | Phase 2 now PASSES (was FAIL on diff base). Confirms CR-01 fix is end-to-end correct.                                |

### Data-Flow Trace (Level 4)

| Artifact                                      | Data Variable                | Source                                                      | Produces Real Data | Status   |
| --------------------------------------------- | ---------------------------- | ----------------------------------------------------------- | ------------------ | -------- |
| `installedRowMessage` (list.ts)               | `PluginPresentMessage` object | Real plugin record (loaded from `state.json` via `enumerateMarketplacePlugins`) | YES                | FLOWING  |
| `shouldEmitReloadHint` (notify.ts)            | `body` substring             | Real `NotificationMessage` payload constructed by orchestrators | YES                | FLOWING  |
| Orphan-fold filter (list.ts:701)              | `folded` rows                | `projectSideRows` from `enumerateMarketplacePlugins`        | YES                | FLOWING  |

All artifacts that render dynamic data trace back to real state-loaded sources, not hardcoded empty arrays.

### Behavioral Spot-Checks

| Behavior                                                                              | Command                                                                                                                                                                                  | Result                            | Status |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------ |
| Full pipeline GREEN                                                                   | `npm run check`                                                                                                                                                                          | exit 0; 1123 pass / 0 fail        | PASS   |
| Catalog UAT byte-equality runner                                                      | `node --test tests/architecture/catalog-uat.test.ts`                                                                                                                                     | 3 pass / 0 fail                   | PASS   |
| V2 per-variant renderer (incl. new G-21-01 regression tests)                          | `node --test tests/shared/notify-v2.test.ts`                                                                                                                                             | 43 pass / 0 fail                  | PASS   |
| List orchestrator tests (incl. CR-01 regression)                                      | `node --test tests/orchestrators/plugin/list.test.ts`                                                                                                                                    | 29 pass / 0 fail                  | PASS   |
| notify-types compile invariants (incl. WR-01 `_VPresent` invariants)                  | `node --test tests/architecture/notify-types.test.ts`                                                                                                                                    | 1 pass / 0 fail (compile-time `_Assert_*`) | PASS   |
| Fold-adoption integration phase 2 (CR-01 end-to-end counterpart)                      | `node --test tests/integration/fold-adoption.test.ts` (phase 2 only)                                                                                                                     | phase 2 PASS                      | PASS   |

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                                  | Status   | Evidence                                                                                                                                 |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| SNM-22      | Plan 21-02 (closure half) | V1 severity wrappers + V1 3-arg `notifyUsageError` deleted from `shared/notify.ts`                       | SATISFIED | `grep -nE "^export function notify(Success\|Warning\|Error)\(" shared/notify.ts` returns 0; `usageBlock` absent.                       |
| SNM-24      | Plan 21-01          | `tests/lint-rules/` directory deleted in full                                                                | SATISFIED | Directory absent.                                                                                                                       |
| SNM-25      | Plan 21-01          | `tests/architecture/msg-rule-registry.test.ts` deleted                                                       | SATISFIED | File absent.                                                                                                                            |
| SNM-27      | Plan 21-01          | `eslint.config.js` cleaned of MSG-* + new BLOCK B-2 `persistence/migrate.ts` override                        | SATISFIED | Zero MSG-* wirings; BLOCK B-2 active; no inline `eslint-disable` in `migrate.ts`.                                                       |
| SNM-28      | Plan 21-01          | `tests/architecture/no-legacy-markers.test.ts` deleted entirely (D-21-03 DELETE arm)                         | SATISFIED | File absent.                                                                                                                            |
| SNM-29      | Plan 21-02          | `shared/grammar/` deleted; closed-set declarations inlined into `shared/notify.ts`                           | SATISFIED | Directory absent; 4 `export const` declarations present exactly once in `shared/notify.ts`.                                              |
| SNM-32      | Plan 21-03 (closure) | `npm run check` GREEN after all migrations land                                                              | SATISFIED | `npm run check` exit 0; 1123 tests pass.                                                                                                |
| SNM-15      | Plan 21-04 (surface tightening) | Reload-hint computed from contents (already Complete per Phase 16; Plan 21-04 tightens via discriminator split for inventory-vs-transition) | SATISFIED | `shouldEmitReloadHint` body unchanged; `present` token deliberately absent from trigger set; G-21-01 regression tests passing.            |

**No orphaned requirements.** REQUIREMENTS.md Phase-21 mapping: SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32 (7 items) -- all accounted for in plans 21-01/21-02/21-03 and confirmed Complete in traceability. SNM-23 is intentionally NOT in Phase 21 scope (mapped to Phase 20 in REQUIREMENTS.md traceability; closure documented B6 record-keeping debt).

### Pre-Existing Conditions (NOT Phase 21 Gaps)

| Item                                                                                              | Status                                          | Disposition                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/fold-adoption.test.ts` phase 1 (line 165) FAILS                                | Pre-existing on diff base (not introduced by Phase 21) | Flagged in 21-04-REVIEW-FIX.md notes. The integration test is NOT included in `npm test` (only `npm run test:integration`), so `npm run check` GREEN is unaffected. Recommended follow-up: separate `/gsd-debug` session. |
| SNM-23 Pending in `.planning/REQUIREMENTS.md` traceability table                                  | Phase 20 record-keeping debt (B6 scope discipline) | Documented in Plan 21-03 SUMMARY + 21-VERIFICATION traceability section. To be reconciled in a separate `/gsd-quick` commit after Phase 21 closes.                                            |

### Anti-Patterns Found

None. Spot scans for empty/stub patterns in modified files surface no live anti-patterns. The `MARKERS` / `PATTERN_CLASSES` const tuples in `shared/notify.ts` are intentionally zero-caller documentation (per D-21-01) -- not stubs awaiting implementation.

### Human Verification Required

None. The gap that originally required human verification (G-21-01) is now closed by Plan 21-04 with automated regression tests (Test A: list-shape no trailer; Test B: cascade-shape trailer preserved) plus the CR-01 end-to-end integration test (fold-adoption phase 2 passing). The behavioral fix is fully verifiable by automated means; no further human UAT step is needed for closure.

### Gaps Summary

No gaps. The phase goal is fully achieved:

- v1.3 MSG-* drift-guard infrastructure retired (SNM-24, SNM-25, SNM-27, SNM-28).
- V1 wrappers deleted; `shared/grammar/` inlined into `shared/notify.ts`; `presentation/` clean-swept (SNM-22, SNM-29).
- v1.4 messaging surface consolidated.
- `PluginPresentMessage` discriminator split closes the G-21-01 reload-hint misfire on `/claude:plugin list` (SNM-15 surface tightening).
- CR-01 BLOCKER (orphan-fold filter regression introduced by the 21-04 fix itself) closed by the carry-over filter at `list.ts:690-701` discriminating on `"present"` post-split, with both orchestrator-level (29/29) and integration-level (fold-adoption phase 2) regression tests passing.
- WR-01/WR-03/WR-04 review warnings closed (notify-types invariants for `_VPresent`; catalog status-token reference table accurate).
- `npm run check` GREEN at 1123 pass / 0 fail / 0 skipped / 0 todo.

The v1.4 Structured Notification Messages milestone is fully closed.

---

_Verified: 2026-05-27T23:30:00Z_
_Verifier: Claude (gsd-verifier) -- Phase 21 post-gap-closure re-verification_

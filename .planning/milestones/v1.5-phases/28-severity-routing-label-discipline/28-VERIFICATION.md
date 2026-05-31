---
phase: 28-severity-routing-label-discipline
verified: 2026-05-31T14:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 28: Severity Routing & Label Discipline Verification Report

**Phase Goal:** Make severity presentation match operator expectations -- stop warning
on benign no-ops, and stop the host severity label from breaking multi-line cascade
formatting -- while preserving the severity color and the single-line label.
**Verified:** 2026-05-31T14:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A cascade whose only non-success rows are benign skips (`{up-to-date}` / `{already ...}`) computes `info` severity (no severity arg) | VERIFIED | `computeSeverity` arm 5 returns `undefined`; all 5 benign-skip catalog-uat fixtures have no `expectedSeverity`; notify-v2 variants assert 1-arg call |
| 2 | Actionable plugin skips (e.g. reason `not installed`) still compute `warning` | VERIFIED | Arm 3 of the D-28-06 ladder; new test `UXG-02 (D-28-03/06): actionable plugin skip ("not installed") computes warning` is GREEN at notify-v2.test.ts:1940 |
| 3 | A mixed cascade (one benign skip + one actionable skip, or any manual-recovery row) computes `warning` | VERIFIED | First-match poisoning via arms 2-4; new test at notify-v2.test.ts:1969 is GREEN |
| 4 | An mp-level skipped with missing/empty reasons computes `warning` (D-28-08 safe default) | VERIFIED | `allBenign(undefined)` returns `false`; new test at notify-v2.test.ts:1995 is GREEN |
| 5 | Any failed plugin or mp computes `error` (unchanged) | VERIFIED | Arm 1 unchanged; all 15 `expectedSeverity: "error"` catalog-uat fixtures still GREEN |
| 6 | Every rendered byte string is byte-identical to before (severity is the 2nd arg, never part of the string) | VERIFIED | Deferral sentences removed from output-catalog.md but no fenced output blocks changed; catalog-uat byte gate GREEN (3/3 tests) |
| 7 | UXG-03 feasibility spike was RUN and outcome recorded as evidence | VERIFIED | `tests/shared/snm-uxg03-label-color-spike.test.ts` exists; 4/4 tests PASS under `node --test` (live run confirmed) |
| 8 | Spike confirms host `notify(message, type?)` has NO color-only / label-suppression parameter | VERIFIED | Test 1 asserts exact byte signature at `types.d.ts:75`; no `opts/options/color/label/suppress` token present |
| 9 | UXG-03 resolves as upstream-tracked finding -- four-part record (finding doc + UAT note + REQUIREMENTS note + STATE.md deferral row) | VERIFIED | All four parts confirmed to exist and be internally consistent (see Artifacts section) |

**Score:** 9/9 truths verified

### Required Artifacts

#### Plan 28-01 (UXG-02)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | BENIGN_REASONS const + 5-arm computeSeverity ladder | VERIFIED | `BENIGN_REASONS: ReadonlySet<Reason>` contains exactly the four D-28-02 members (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`); `computeSeverity` is the D-28-06 5-arm first-match ladder; `shouldEmitReloadHint` untouched; no renderer arm or byte literal changed |
| `tests/shared/notify-v2.test.ts` | Benign-skip info variants + new warning coverage | VERIFIED | 58/58 tests GREEN; benign-skip variants assert 1-arg notify; three new warning-coverage tests (actionable, mixed, missing-reasons) at lines 1940/1969/1995 |
| `tests/architecture/catalog-uat.test.ts` | Benign-skip fixtures with `expectedSeverity` removed; byte strings unchanged | VERIFIED | 3/3 tests GREEN; `expectedSeverity: "warning"` count is 1 (the manual-recovery fixture, which is correctly not benign); the five named benign-skip fixtures (`all-up-to-date-noop`, `update-no-op-skipped`, `update-autoupdate-noop-skipped`, `enable-idempotent`, `disable-idempotent`) have no `expectedSeverity` |
| `docs/adr/v2-001-structured-notify.md` | Lines 68 + 205 amended to benign-softening refinement citing UXG-02 / D-28-06 | VERIFIED | Both lines describe the 5-arm ladder with BENIGN_REASONS set membership and the D-28-08 missing-reasons safe default |
| `docs/messaging-style-guide.md` | Section "Severity Routing" ladder synced; `{up-to-date}` worked example shows info | VERIFIED | Ladder rules 3-5 describe the benign closed set; benign skip -> info, actionable skip -> warning; first-match poisoning D-28-09 documented |
| `docs/output-catalog.md` | Deferral sentences removed; severity prose flipped to info for benign-skip arm | VERIFIED | `grep "NOT pre-empted here\|info-softening is Phase 28"` returned no output -- deferral sentences are gone |

#### Plan 28-02 (UXG-03)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/28-severity-routing-label-discipline/UXG-03-FINDING.md` | In-repo finding >= 30 lines with host line refs + spike evidence + D-28-13 contingent policy | VERIFIED | 167 lines; contains `types.d.ts:75` exact ref; `Warning: ` / `Error: ` literal evidence; root cause; DEFER-WITH-FINDING resolution; operator filing statement; D-28-13 entrypoint policy |
| `tests/shared/snm-uxg03-label-color-spike.test.ts` | GREEN evidence-lock harness asserting host label/color coupling | VERIFIED | 4/4 tests PASS (live run); asserts: no color-only param at `types.d.ts:75`; `Error:`/`Warning:` literals present; `showExtensionNotify` coupling; feasibility = refuted |
| `.planning/v1.4-MILESTONE-UAT.md` | UXG-03 entry with `status: defer-with-finding` | VERIFIED | Entry at line 851 with `status: defer-with-finding`; mirrors G-MIL-07 shape (truth / root_cause / artifacts / missing / contingent_policy / debug_session) |
| `.planning/REQUIREMENTS.md` | UXG-03 line annotated with spike-refuted resolution and link to UXG-03-FINDING.md | VERIFIED | Line 21 marked `[x]`; full resolution annotation including host version `@0.75.5`, exact line refs, REFUTED verdict, links to finding doc and spike test |
| `.planning/STATE.md` | `upstream_finding` deferral row for UXG-03 with host line refs | VERIFIED | Row present in "Additional v1.4.1-scope deferrals" table (line 202); category `upstream_finding`; cites `types.d.ts:75`; `dist/main.js:64-69`; `interactive-mode.js:1771-1781/2944-2954`; deferral date 2026-05-31 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `computeSeverity` | `BENIGN_REASONS` | `allBenign()` predicate over plugin/mp reasons | VERIFIED | `allBenign(reasons)` returns `reasons !== undefined && reasons.length > 0 && reasons.every((r) => BENIGN_REASONS.has(r))`; shared by arms 3 and 4 |
| `catalog-uat.test.ts` driver loop | `ctx.ui.notify` args assertion | `expectedSeverity` per fixture | VERIFIED | Driver at line 1490-1496 checks `callArgs.length !== 2 || callArgs[1] !== fixture.expectedSeverity` when `expectedSeverity !== undefined`; benign-skip fixtures omit `expectedSeverity` so driver asserts `callArgs.length === 1` |
| `UXG-03-FINDING.md` | `dist/core/extensions/types.d.ts:75` | exact host line ref for the `notify(message, type?)` signature | VERIFIED | `grep "types.d.ts:75" UXG-03-FINDING.md` exits 0; exact line ref present at line 43 of the finding doc |
| `UXG-03-FINDING.md` | `dist/main.js` `Error: ` / `Warning: ` label literals | host bundle label-derives-from-type evidence | VERIFIED | Label literal evidence at lines 62, 96, 102 of the finding doc |

### Data-Flow Trace (Level 4)

This phase modifies `computeSeverity` (a pure function with no rendering side-effects) and creates a read-only evidence-lock test. No component renders dynamic data from an external source. Level 4 data-flow trace is not applicable.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| UXG-03 spike: host signature has no color-only param | `node --test tests/shared/snm-uxg03-label-color-spike.test.ts` | 4/4 pass, exit 0 | PASS |
| Benign-skip variants assert info; new warning coverage GREEN | `node --test tests/shared/notify-v2.test.ts` | 58/58 pass, exit 0 | PASS |
| Catalog-uat byte gate GREEN | `node --test tests/architecture/catalog-uat.test.ts` | 3/3 pass, exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UXG-02 | 28-01 | Benign no-op skips route at `info` severity, not `warning` | SATISFIED | `BENIGN_REASONS` closed set + 5-arm `computeSeverity` implemented; both test gates GREEN; ADR/style-guide/catalog prose synced |
| UXG-03 | 28-02 | Multi-line cascade label suppression -- feasibility spike + upstream-tracked finding | SATISFIED (defer-with-finding) | Spike RUN; feasibility REFUTED; four-part record present and internally consistent; no colorless workaround shipped per D-28-10 |

### Anti-Patterns Found

No anti-patterns found in phase-modified files. Scanned:

- `extensions/pi-claude-marketplace/shared/notify.ts` -- zero TBD/FIXME/XXX markers; no stub returns; no empty handlers
- `tests/shared/notify-v2.test.ts` -- zero debt markers
- `tests/architecture/catalog-uat.test.ts` -- zero debt markers
- `tests/shared/snm-uxg03-label-color-spike.test.ts` -- zero debt markers

The one remaining `expectedSeverity: "warning"` in `catalog-uat.test.ts` is the `per-plugin-manual-recovery` fixture -- correctly non-benign per D-28-09 (manual recovery is always actionable).

### Human Verification Required

None. All must-haves are programmatically verifiable.

UXG-03 is a documented upstream finding, not a deferred implementation gap. The absence of a colorless in-extension label-suppression implementation is the correct, decision-backed outcome (D-28-10/D-28-11). No human verification is required to confirm this.

### Gaps Summary

No gaps. Phase goal is fully achieved.

- UXG-02: `computeSeverity` implements the D-28-06 5-arm first-match ladder with the D-28-02 `BENIGN_REASONS` closed set. All six observable truths from Plan 28-01 hold against the codebase.
- UXG-03: The four-part defer-with-finding record is complete and internally consistent. The spike ran and all four evidence-lock tests pass. No in-extension code was shipped -- the correct outcome per D-28-10.
- SC-4 (`npm run check` + catalog-uat GREEN): reported 1156/1156 tests at plan close; the three test suites spot-checked here all pass independently.

---

_Verified: 2026-05-31T14:00:00Z_
_Verifier: Claude (gsd-verifier)_

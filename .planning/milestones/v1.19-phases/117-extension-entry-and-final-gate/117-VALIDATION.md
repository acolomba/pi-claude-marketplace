---
phase: "117"
slug: "extension-entry-and-final-gate"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-03"
validated: "2026-09-04"
requirement: MOD-10, OWN-01..06, COV-01..05, SUITE-01..06
coverage_score: 100
---

# Phase 117 — Validation Strategy

> Reconciled after execution and verification (`117-VERIFICATION.md`, `status: passed`, 5/5
> roadmap success criteria satisfied — 4 verified directly, 1 closed by an accepted operator
> override; 36/36 REQUIREMENTS.md IDs cross-checked). The draft below predates execution and
> reads as a plan against a not-yet-built owner; this reconciliation replaces its projections
> with measurements taken directly against the current tree.
> **This phase changed no production file.** `git diff --quiet 562f5d13 HEAD -- extensions/`
> re-measured exit 0 during this reconciliation.

## Status Lifecycle

1. **Draft (seeded 2026-09-03):** written by plan-phase before any wave ran; correctly flagged
   Wave 0 as the entry-pair owner, the glob amendment, three new negative controls, and the
   all-pair artifact — all six items were in fact built across 12 plans and two code-review
   iterations (`117-REVIEW.md`/`117-REVIEW-FIX.md`, `117-REVIEW-2.md`/`117-REVIEW-FIX-2.md`).
2. **Validated (this reconciliation):** every Wave 0 item is present on disk and independently
   re-measured; the one requirement that cannot pass literally (SUITE-05's "direct coverage for
   all pairs ... pass" clause) is closed by an operator-accepted override in
   `117-VERIFICATION.md`'s frontmatter (`decision_ref: D-117-20 (amended); WINDOWS.md entry 30;
   deferred-items.md item 6`), not by a passing command. That override is recorded below as
   ACCEPTED, not as a gap or a failure.
3. **Why no new gaps were filled here.** `117-VERIFICATION.md` already reproduced every
   measurement this reconciliation would otherwise redo — the entry pair, the correspondence
   gate, both negative controls, `tests/helpers/` dissolution, the 204-row artifact composition,
   and the full unit/integration suites. This reconciliation independently re-ran the load-bearing
   subset (see Verification Evidence) and found no drift. No test file was generated, edited, or
   deleted, and none was needed — the paired-test invariant this milestone exists to enforce
   (`node scripts/check-corresponding-tests.mjs`, exit 0, zero violations) would itself reject an
   unpaired test.

## Test Infrastructure

| Property | Value |
| --- | --- |
| **Framework** | `node:test` (Node built-in) + `strong-mock` + `node:assert/strict` |
| **Pair gate** | `node scripts/test-coverage-direct.mjs <exact-source-path>` |
| **Correspondence gate** | `node scripts/check-corresponding-tests.mjs` (+ `.negative.mjs`) |
| **Full unit suite** | `npm test` |
| **Integration suite** | `npm run test:integration` |
| **All-pair sweep** | `npm run test:coverage:direct:all` — wired, but exits 1 by design (see Accepted Override below) |

## Coverage Scorecard

| Dimension | Covered | Total | Score | Evidence |
| --- | ---: | ---: | ---: | --- |
| Entry-pair owner (`index.ts` / `tests/index.test.ts`) | 1 | 1 | 100% | Re-measured: branches 15/15, functions 3/3, lines 161/161, exit 0, 14/14 cases pass |
| Correspondence gate (204 mirrored pairs) | 204 | 204 | 100% | `check-corresponding-tests.mjs` → exit 0, zero violations, re-measured |
| All-pair inventory rows with a recorded verdict | 204 | 204 | 100% | `117-ALL-PAIR-RESULT.ndjson` re-parsed: 204 rows, 204 distinct source paths, verdict split `{complete: 190, type-only: 7, accepted-shortfall: 7}` — identical to the verification report's independently reproduced count |
| Full unit suite | 5144 | 5144 | 100% | `npm test` re-run: `tests 5144, suites 295, pass 5144, fail 0` |
| Integration suite | 31 | 31 | 100% | `npm run test:integration` re-run: `pass 31, fail 0` |
| Wave 0 items delivered | 6 | 6 | 100% | See Wave 0 Requirements below |
| Roadmap success criteria | 4 verified + 1 accepted override | 5 | 5/5 | Matches `117-VERIFICATION.md` score exactly |

**Nyquist verdict:** PASS. Every automatable requirement has a passing, re-measured command; the
one requirement that cannot pass literally under the amended design decision is closed by an
explicit, dated operator override rather than by a weakened assertion or a self-granted waiver.

## Wave 0 Requirements — measured against the built tree

- [x] `tests/index.test.ts` — 14 cases, branches 15/15, functions 3/3, lines 161/161, exit 0
      (re-measured). The two legacy proxy tests (`tests/edge/index-handler.test.ts`,
      `tests/shared/index-smoke.test.ts`) are confirmed deleted.
- [x] `package.json` unit-test glob amendment — `npm test` totals include the root owner; total
      rose to 5144 (matches verification). Draft's stated pre-amendment glob count ("249 paths")
      is a plan-time projection, not re-derived here; the post-amendment outcome (owner runs
      under `npm test`) is what was verified and holds.
- [x] Negative control for `Expected one LCOV record ... found 2` — present in
      `test-coverage-direct.negative.mjs`, part of `npm run test:coverage:direct:negative`
      (exit 0, planting confirmed by 117-10's SUMMARY and corroborated by the verification report).
- [x] Negative control for `Incomplete direct coverage for ...` — same file, same exit-0 run.
- [x] Negative control for the proxy/barrel check (`proxy-owned`) — present in
      `check-corresponding-tests.negative.mjs`, confirmed planted and passing in
      `117-VERIFICATION.md`'s Goal Achievement row 2.
- [x] The `--all` result artifact and its completeness assertion — `117-ALL-PAIR-RESULT.ndjson`
      exists, 204 rows, 204 distinct paths, re-parsed directly in this reconciliation. Its
      reproducibility gap (originally produced by an uncommitted scratch driver) was fixed, not
      accepted: `npm run test:coverage:direct:report` (commit 1495488b, per `117-VERIFICATION.md`
      override reason) now regenerates the identical 204-row split from the shipped gate.

## Accepted Override

| Requirement | Status | Decision | Reason (condensed) |
| --- | --- | --- | --- |
| SC-4 / SUITE-05: "the clean tree passes ... all-pair coverage" | **ACCEPTED, not a gap** | D-117-20 (amended 2026-09-03); recorded in `117-VERIFICATION.md` frontmatter `overrides:` entry, `accepted_by: operator`, `accepted_at: 2026-09-04` | `npm run test:coverage:direct:all` exits 1 on a clean tree by deliberate design — it refuses the first of seven operator-accepted D-116-01a single-branch shortfalls (stops at `edge/args.ts`, branches 28/29, lines 86/89), and the code review (WR-05, iteration 2) explicitly declined to add a ledger-keyed accepted-shortfall allowlist because D-117-20 bars that remedy as "D-116-01a's banned pragma wearing a different hat." The 204-row proof this command would otherwise produce exists and is independently reproducible via `npm run test:coverage:direct:report` instead. CONTRIBUTING.md documents the stop as expected, not a regression. |

This reconciliation does not re-litigate the override; it records it as closed per the operator's
own acceptance, consistent with the sibling phase-115 reconstruction's standard of only treating a
requirement as satisfied when either a command passes or an explicit, dated acceptance exists.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Resolution |
| --- | --- | --- | --- |
| The all-pair run's wall-clock duration | SC-3, D-117-10 | An observation read from the runner, not a computed assertion | Recorded in `117-ALL-PAIR-RESULT.md` per the verification report; not re-measured here (no assertion depends on it) |
| Which runtime the all-pair result is labelled with | SC-3 | No Node 24 available locally (measured v22.22.2 / v26.8.1 on this machine; CI pins 24) | `117-ALL-PAIR-RESULT.md` states plainly it is not a Node 24 result — confirmed present during verification |
| COV-05's reading for the 7 type-only modules | COV-05 | A module emitting no JS has no lines to cover; the reading is a judgement call, not a measurement | Resolved by the operator-amended D-117-20: 190 complete + 7 accepted-shortfall + 7 type-only, not the original 197+7 wording — documented, not silently weakened |

## Verification Evidence (re-measured in this reconciliation)

- `git diff --quiet 562f5d13 HEAD -- extensions/` → exit 0. No production file changed.
- `node scripts/check-corresponding-tests.mjs` → `Corresponding-test gate passed.`, exit 0.
- `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/index.ts` →
  `branches 15/15, functions 3/3, lines 161/161`, exit 0, 14/14 cases pass.
- `test -d tests/helpers` → absent.
- `117-ALL-PAIR-RESULT.ndjson` parsed directly: 204 rows, 204 distinct `sourcePath`s, verdict
  split `{complete: 190, type-only: 7, accepted-shortfall: 7}`.
- `npm test` → `tests 5144, suites 295, pass 5144, fail 0`.
- `npm run test:integration` → `pass 31, fail 0`.

## Validation Sign-Off

- [x] All tasks have automated verify or an explicit accepted override
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (12 plans, each with
      its own commit-level verify per the SUMMARY files)
- [x] Wave 0 covers all MISSING references — all six items built and re-measured
- [x] No watch-mode flags
- [x] Feedback latency < 10s for a focused pair (index pair measured well under 4s)
- [x] Every gate added in this phase has a control that plants the violation — confirmed for
      `proxy-owned`, `Expected one LCOV record ... found 2`, and `Incomplete direct coverage for
      ...`; path-level ambiguity is proved structurally unreachable rather than checked for a
      case that cannot occur (documented, reasoned choice, D-117-07/D-117-21)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-04, per this reconciliation and `117-VERIFICATION.md`.

## Validation Audit 2026-09-04

| Metric | Count |
| --- | ---: |
| Gaps found | 0 |
| Gaps resolved | 0 |
| Gaps escalated | 0 |
| Gaps accepted via operator override | 1 (SC-4 / SUITE-05, D-117-20) |
| Tests generated | 0 |
| Production files modified | 0 |
| Manual-only items | 3 (all previously resolved by documented judgement calls, not left open) |

---

_Reconciled: 2026-09-04. Draft (`status: draft`, seeded 2026-09-03 by plan-phase) replaced with
measurements taken directly against the built and verified tree, following the structure and
evidence standard of the phase-115 sibling reconstruction (`115-VALIDATION.md`)._

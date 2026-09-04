---
phase: "116"
slug: "edge-surface"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-02"
validated: "2026-09-04"
requirement: MOD-09
coverage_score: 100
---

# Phase 116 — Validation Strategy

> Reconciled audit of the thirty edge-surface pairs. Phase 116 was executed and verified
> (`116-VERIFICATION.md`, `status: passed`) but its VALIDATION.md was left `status: draft` —
> seeded by plan-phase and never reconciled by validate-phase. Per #2117 that made
> `nyquist_compliant: false` an artifact of the unreconciled file, not a measured compliance
> failure. This reconciliation re-measures the thirty pairs directly against the current tree.
> **It changed no production file, no test file, and generated no tests.**

## Status Lifecycle

1. **Draft seeded 2026-09-02:** plan-phase wrote the 30-row Per-Task Verification Map with every
   status cell `⬜ pending` and `nyquist_compliant: false` as the seed default.
2. **Executed and verified 2026-09-03:** all 30 plans landed; `116-VERIFICATION.md` scored 5/6
   observable truths verified outright, with the sixth (WINDOWS.md filing completeness) closed
   the same day in its own Gap Closure section — ledger entries 21 and 22 filed for the two
   original D-116-01a claimants (`edge/args.ts`, `edge/handlers/shared.ts`).
3. **Reconciled 2026-09-04:** every one of the 30 pairs re-measured against
   `117-ALL-PAIR-RESULT.ndjson` and re-run standalone; `status: validated`,
   `nyquist_compliant: true`, `wave_0_complete: true`.

## Test Infrastructure

| Property | Value |
| --- | --- |
| **Framework** | Node.js built-in `node:test` with native TypeScript execution |
| **Pair gate** | `node scripts/test-coverage-direct.mjs <exact-source-path>` |
| **Owner suite run** | `node --test <owner-test-path>` |
| **Phase suite** | 30 pairs (29 direct + 1 type-only), 641 owner cases measured in this reconciliation |
| **Repository suite** | `npm test`, `npm run test:integration`, `node scripts/check-corresponding-tests.mjs` |
| **Isolation** | Fresh test processes, case-owned temporary roots and state, restored environment and built-in overrides |

## Coverage Scorecard

| Dimension | Covered | Total | Score | Evidence |
| --- | ---: | ---: | ---: | --- |
| Planned plans with an executable owner | 30 | 30 | 100% | One exact owner/source pair per plan (00 is a shared-helper plan with no owned pair) |
| Exact source-owner pair gates, complete verdict | 22 | 30 | 73% | See Exact Pair Map — the shortfall is the accepted D-116-01a set, not a coverage gap |
| Exact source-owner pair gates, complete OR accepted-shortfall | 29 | 29 | 100% | 1 pair is type-only (`edge/types.ts`) and gates via `npm run typecheck` instead |
| Focused owner cases, standalone run | 641 | 641 | 100% | `node --test $(find tests/edge -name '*.test.ts')`, this reconciliation, 0 failures |
| Phase success criteria | 4 | 4 | 100% | See the table below |
| Requirement coverage | 1 | 1 | 100% | MOD-09 is exercised by all 30 pairs |

**Nyquist verdict:** PASS — every planned direct boundary in phase 116 has automated evidence.
Seven pairs fall exactly one branch short of complete direct coverage; all seven are
operator-accepted, ledger-pinned, compiler-forced-or-structural shortfalls under D-116-01a, not
unmeasured or unargued gaps (see Accepted Shortfalls below).

## Requirement and Success-Criterion Coverage

| Contract | Status | Automated evidence |
| --- | --- | --- |
| **MOD-09:** all 30 edge-surface pairs complete the pair contract | COVERED | 30/30 owners exist and pass alone; 29/29 non-type-only sources read `complete` or `accepted-shortfall` in the 204-row artifact |
| **Criterion — command grammar preserved** | COVERED | `edge/router.test.ts`, `edge/args.test.ts`, `edge/args-schema.test.ts` (complete/accepted-shortfall as measured) |
| **Criterion — scope resolution preserved** | COVERED | `edge/handlers/shared.test.ts`, `edge/handlers/plugin/shared.test.ts` |
| **Criterion — completion behavior preserved** | COVERED | `edge/completions/{data,normalize,provider}.test.ts` |
| **Criterion — tool surface preserved** | COVERED | `edge/handlers/tools.test.ts`, including the CR-01/CR-02 post-review fixtures |
| **Criterion — notification behavior preserved** | COVERED | Backstopped by the existing architecture suite per D-116-05 (`tests/architecture/notify-*`), not duplicated per owner (D-116-12) |
| **SC-3 (no direct stdout/stderr writes)** | COVERED (negative, gate-owned) | `npm run lint` (`no-restricted-syntax`) and `npm run fallow` (`boundaries.calls.forbidden`) — not a per-owner test by design |
| **SC-4 (offline path, edge-owned half)** | COVERED | 8 read-only edge surfaces watch `https.request` (not `globalThis.fetch`) per WR-01's fix, `callCount() === 0` on each network-free path |

## Exact Pair Map

Re-measured from `117-ALL-PAIR-RESULT.ndjson`, filtered to `extensions/pi-claude-marketplace/edge/`
(30 rows) — not restated from the phase's own SUMMARYs.

| # | Source | Verdict | Direct coverage |
| ---: | --- | --- | --- |
| 116-01 | `edge/args-schema.ts` | complete | branches 17/17, functions 2/2, lines 96/96 |
| 116-02 | `edge/args.ts` | **accepted-shortfall** | branches 28/29, lines 86/89 |
| 116-03 | `edge/completions/data.ts` | **accepted-shortfall** | branches 109/110 |
| 116-04 | `edge/completions/normalize.ts` | complete | branches 9/9, functions 2/2, lines 47/47 |
| 116-05 | `edge/completions/provider.ts` | **accepted-shortfall** | branches 79/80 |
| 116-06 | `edge/flag-catalog.ts` | complete | branches 11/11, functions 10/10, lines 190/190 |
| 116-07 | `edge/handlers/marketplace/add.ts` | complete | branches 8/8, functions 2/2, lines 48/48 |
| 116-08 | `edge/handlers/marketplace/autoupdate.ts` | complete | branches 15/15, functions 4/4, lines 61/61 |
| 116-09 | `edge/handlers/marketplace/info.ts` | complete | branches 2/2, functions 1/1, lines 22/22 |
| 116-10 | `edge/handlers/marketplace/list.ts` | complete | branches 8/8, functions 3/3, lines 44/44 |
| 116-11 | `edge/handlers/marketplace/remove.ts` | complete | branches 8/8, functions 2/2, lines 46/46 |
| 116-12 | `edge/handlers/marketplace/shared.ts` | complete | branches 18/18, functions 5/5, lines 134/134 |
| 116-13 | `edge/handlers/marketplace/update.ts` | **accepted-shortfall** | branches 11/12 |
| 116-14 | `edge/handlers/plugin/bootstrap.ts` | complete | branches 8/8, functions 2/2, lines 88/88 |
| 116-15 | `edge/handlers/plugin/enable-disable.ts` | complete | branches 17/17, functions 3/3, lines 87/87 |
| 116-16 | `edge/handlers/plugin/fetch.ts` | complete | branches 27/27, functions 4/4, lines 132/132 |
| 116-17 | `edge/handlers/plugin/import.ts` | **accepted-shortfall** | branches 11/12 |
| 116-18 | `edge/handlers/plugin/info.ts` | complete | branches 17/17, functions 2/2, lines 79/79 |
| 116-19 | `edge/handlers/plugin/install.ts` | complete | branches 17/17, functions 2/2, lines 101/101 |
| 116-20 | `edge/handlers/plugin/list.ts` | complete | branches 19/19, functions 2/2, lines 82/82 |
| 116-21 | `edge/handlers/plugin/pending.ts` | **accepted-shortfall** | branches 9/10 |
| 116-22 | `edge/handlers/plugin/reinstall.ts` | complete | branches 25/25, functions 3/3, lines 100/100 |
| 116-23 | `edge/handlers/plugin/shared.ts` | complete | branches 32/32, functions 7/7, lines 201/201 |
| 116-24 | `edge/handlers/plugin/uninstall.ts` | complete | branches 10/10, functions 2/2, lines 42/42 |
| 116-25 | `edge/handlers/plugin/update.ts` | complete | branches 22/22, functions 2/2, lines 90/90 |
| 116-26 | `edge/handlers/shared.ts` | **accepted-shortfall** | branches 14/15, lines 83/85 |
| 116-27 | `edge/handlers/tools.ts` | complete | branches 103/103, functions 16/16, lines 583/583 |
| 116-28 | `edge/register.ts` | complete | branches 15/15, functions 9/9, lines 143/143 |
| 116-29 | `edge/router.ts` | complete | branches 37/37, functions 3/3, lines 221/221 |
| 116-30 | `edge/types.ts` | type-only | gated by `npm run typecheck`, not by branch coverage |

**22 complete, 7 accepted-shortfall, 1 type-only — 30 of 30 pairs accounted for.**

## Accepted Shortfalls (D-116-01a)

Seven modules fall exactly one branch short of complete direct coverage. Each is
COMPILER-FORCED or structurally unreachable, proved by planting during phase 116 and re-measured
here from the live tree — not assumed from the phase's own claim. `!` and `as` assertions are
both barred throughout `extensions/`, so closing any of them means a production rewrite outside
this reconciliation's scope. These are read as `accepted-shortfall` in the all-pair artifact and
are recorded, not assumed:

| Pair | WINDOWS.md entry | Reading | Class |
| --- | ---: | --- | --- |
| 116-02 `edge/args.ts:34-37` | **21** | branches 28/29, lines 86/89 | COMPILER-FORCED (`noUncheckedIndexedAccess`) — original claimant |
| 116-03 `edge/completions/data.ts:188` | **16** | branches 109/110 | COMPILER-FORCED (`Array.prototype.at()` typed `T \| undefined`) |
| 116-05 `edge/completions/provider.ts:125` | **17** | branches 79/80 | Structural (optional field type, not compiler-forced) |
| 116-13 `edge/handlers/marketplace/update.ts:41` | **15** | branches 11/12 | Structural (schema declares its sole positional optional) |
| 116-17 `edge/handlers/plugin/import.ts:31` | **18** | branches 11/12 | COMPILER-FORCED (`useUnknownInCatchVariables`) |
| 116-21 `edge/handlers/plugin/pending.ts:39` | **19** | branches 9/10 | COMPILER-FORCED (`noUncheckedIndexedAccess`) |
| 116-26 `edge/handlers/shared.ts:53-55` | **22** | branches 14/15, lines 83/85 | COMPILER-FORCED (`noUncheckedIndexedAccess`) — original claimant |

All seven ledger rows now exist in `.planning/WINDOWS.md` (entries 15-19, 21, 22), each `status:
open` by design — D-117-20 bars both a coverage-exception pragma and a ledger-keyed gate verdict,
so the ledger records the acceptance rather than silencing the gate. `116-VERIFICATION.md`'s Gap
Closure section (2026-09-03) confirms entries 21 and 22 — the two original claimants — were the
ones missing a filed row at verification time and were filed that day; this reconciliation
re-confirms all seven rows are present and none has regressed to `complete` or drifted to a
different branch count.

Two of the seven (`edge/args.ts`, `edge/handlers/shared.ts`) belong to this phase's own five-plus
in the operator's framing; the other five in this table are phase 116's remaining accepted
shortfalls. All seven live under `extensions/pi-claude-marketplace/edge/`, i.e. entirely within
phase 116's ownership.

## Manual-Only

| Behavior | Criterion | Gate that owns it |
| --- | --- | --- |
| No direct `process.stdout`/`process.stderr` writes | SC-3 (negative) | `npm run lint` (ESLint `no-restricted-syntax`) and `npm run fallow` (`boundaries.calls.forbidden`) — duplicating this in an owner is forbidden by D-116-12 |

Every other phase-116 requirement and success criterion has automated, per-owner verification.

## Verification Evidence

Measured on the current tree during this reconciliation, each command run separately with its own
exit code read:

- `node --test $(find tests/edge -name '*.test.ts')` → **641 tests, 0 fail, exit 0**.
- 30 pairs cross-checked against `117-ALL-PAIR-RESULT.ndjson`: 22 `complete`, 7
  `accepted-shortfall`, 1 `type-only` — 30/30 accounted for, matching the phase's own claim.
- `node scripts/check-corresponding-tests.mjs` → exit 0, `Corresponding-test gate passed.`
- `rg -n "116-02|116-26" .planning/WINDOWS.md` → both present at ledger entries 21 and 22.
- `116-VERIFICATION.md` (`status: passed`, 5/6 truths verified outright, 6th closed same day) was
  read as evidence, not restated as this file's own claim — every number above was re-derived
  independently against the live tree rather than copied from it.

## Gaps Summary

| Metric | Count |
| --- | ---: |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Accepted (D-116-01a shortfalls, ledger-pinned) | 7 |
| Tests generated | 0 |
| Manual-only items | 1 (SC-3, gate-owned, not per-owner by design) |

---

_Reconciled 2026-09-04. Promotes phase 116's VALIDATION.md from `draft` (seeded by plan-phase,
never reconciled) to `validated`, per the v1.19 milestone audit's flag under #2117. No test file,
fixture, or production file was created or modified during this reconciliation._

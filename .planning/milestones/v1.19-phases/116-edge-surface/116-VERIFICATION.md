---
phase: 116
verified: 2026-09-03T07:30:00Z
status: passed
must_haves_verified: 6
must_haves_total: 6
---

# Phase 116: Edge Surface Verification Report

**Phase Goal:** Users can invoke the complete command surface with preserved grammar, scope,
completion, tool, and notification behavior.

## Method

Every claim below was run in this working tree, not read off a SUMMARY. Commands and their raw
output are quoted or summarized inline. Where a `SUMMARY.md`/`CONTEXT.md`/`WINDOWS.md` claim could
be re-measured directly, it was.

## 1. Correspondence — 30 sources, 30 mirrored owners, one deliberate orphan

```
find extensions/pi-claude-marketplace/edge -name '*.ts' -type f | wc -l   → 30
```

Walked every one of the 30 sources against its mirrored `tests/edge/...` path — zero missing
owners. Walked every file under `tests/edge/` (31 files) against its expected source — exactly one
orphan: `tests/edge/index-handler.test.ts` (expects `extensions/.../edge/index-handler.ts`, which
does not exist; its real pair is the root `index.ts`, owned by Phase 117 per D-116-10). This matches
the phase's own claim exactly — no more, no fewer orphans.

`node scripts/check-corresponding-tests.mjs` reports 8 remaining violations repo-wide, all outside
`tests/edge/`/`edge/` (the `index.ts`/`index-handler.test.ts` pair plus 6 pre-existing cross-cutting
integration suites: `tests/bridges/integration-materialization-gate.test.ts`,
`tests/helpers/source-scan.test.ts`, `tests/orchestrators/marketplace/cascade.test.ts`,
`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`,
`tests/shared/device-flow-prompt.test.ts`, `tests/shared/index-smoke.test.ts`). Phase 116 closed all
seven violations attributed to it (D-116-08/09/10) — **VERIFIED**.

## 2. No coverage-exception pragma anywhere

```
rg -n 'c8 ignore|node:coverage ignore' extensions/ tests/
```

No matches (`rg` exit 1 = no hits). D-116-01's ban holds with zero exceptions across the whole tree,
not just this phase's files — **VERIFIED**.

## 3. No banned cast under `tests/edge/` (within the phase's own 30 pairs)

```
rg -n 'as any|as unknown as' tests/edge/
```

7 matches, all in `tests/edge/index-handler.test.ts` — the one file this phase explicitly does not
own (D-116-10, Phase 117). Zero matches across the 30 owned pairs — **VERIFIED**.

## 4. The gates, run separately

| Gate | Command | Exit | Result |
|---|---|---|---|
| typecheck | `npm run typecheck` | 0 | clean |
| lint | `npm run lint` | 0 | clean |
| fallow | `npm run fallow` (dead-code && health && dupes, checked with a direct `$?`, not through a pipe) | 0 | dead-code: 0 issues; health: 0 above threshold, MI 92.2 good; dupes: 1.2% duplicated, all within the pre-approved/threshold set, gate exits 0 |
| unit | `npm test` | 0 | **`ℹ tests 5141` / `ℹ suites 295` / `ℹ pass 5141` / `ℹ fail 0`** — matches the phase's recorded baseline exactly |
| integration | `npm run test:integration` | 0 | **`ℹ tests 31` / `ℹ pass 31` / `ℹ fail 0`** |

All five run and checked independently per the phase's own constraint ("`npm run check` never runs
the tests"). All green, all numbers matching the phase's self-reported baseline — **VERIFIED**.

## 5. D-116-01a claimants — identity, not absolute branch pairs

Re-ran `scripts/test-coverage-direct.mjs` directly against a spread of claimants and non-claimants:

| Source | Expected (per SUMMARY/WINDOWS) | Measured | Match |
|---|---|---|---|
| `edge/args.ts` (116-02) | `Incomplete direct coverage…: branches 28/29, lines 86/89`, uncovered `35-37` | `branches 28/29, lines 86/89`, uncovered `35-37` | exact |
| `edge/handlers/shared.ts` (116-26) | `branches 14/15, lines 83/85` | `branches 14/15, lines 83/85` | exact |
| `edge/handlers/marketplace/update.ts` (116-13, ledger 15) | denominator−numerator = 1 | `Incomplete…: branches 11/12` | exact (identity, not a fixed pair — matches the amended rule) |
| `edge/args-schema.ts` (non-claimant) | complete | `Direct coverage passed: branches 17/17, functions 2/2, lines 96/96` | complete, as expected |
| `edge/router.ts` (non-claimant) | complete | `Direct coverage passed: branches 37/37, functions 3/3, lines 221/221` | complete, as expected |
| `edge/handlers/tools.ts` (non-claimant, post-CR fix) | complete | `Direct coverage passed: branches 103/103, functions 16/16, lines 583/583` | complete — confirms the CR-01/CR-02 production fix did not create a new shortfall |

Every claimant measured lands at exactly one uncovered branch (never an absolute pair asserted
loosely — the pin is on identity, matching the amended D-116-01a). Every non-claimant measured is
complete. **Gate mechanics VERIFIED.**

**Filing gap found.** `.planning/phases/116-edge-surface/116-CONTEXT.md`'s D-116-01a amendment states,
as a general rule (not scoped to only the two examples it happens to name): "Each claimed shortfall is
also filed in `.planning/WINDOWS.md` so the phase boundary can sweep them as one set." `.continue-here.md`
asserts "Seven claimants, ALL SEVEN NOW PINNED" and cites WINDOWS ledger entry numbers for two of
them (116-17 → entry 18, 116-21 → entry 19).

```
grep -n "116-02\|116-26\|args.ts.*34-37\|shared.ts.*53-55\|edge/args.ts\|edge/handlers/shared.ts" .planning/WINDOWS.md
```

No matches. `.planning/WINDOWS.md` has 20 entries total (1-14 pre-116, 15-19 the D-116-01a claimants
found or re-pinned during this phase, 20 the `register.ts` stale-comment deviation). The two
claimants locked at planning time — **116-02 (`edge/args.ts:34-37`)** and **116-26
(`edge/handlers/shared.ts:53-55`)** — are pinned correctly inside their own `must_haves`/verify
blocks and re-measure clean (table above), but neither has a WINDOWS.md ledger row. 116-03, 116-05,
116-13, 116-17 and 116-21 do. This is a real, measurable gap against the phase's own filing promise,
not a coverage defect — the shortfalls themselves are real, argued, and correctly pinned in the pair
suites; only the cross-phase ledger sweep the phase promised is incomplete for two of the seven.

## 6. Code-review findings — all thirteen closed, re-verified from source

`116-REVIEW.md` (2 critical, 6 warning, 5 info) and three fix reports were read, then the fixes were
confirmed directly against the current source rather than trusting the reports:

- **CR-01** (tool can never return `remote`/`partially-available`): `applyFilter` now returns a
  `narrowed` flag; `loadToolPluginPayload` forwards nothing when the caller narrowed nothing, and
  forwards `{ available: true, remote: true }` / `{ unavailable: true, partial: true }` when it did
  (`edge/handlers/tools.ts:264-350`). New fixtures `remote-mp` and `partially-available-mp` drive
  `registration.execute` in `tests/edge/handlers/tools.test.ts:673-707`. Fixed, confirmed in source.
- **CR-02** (dropped `reasons` on `disabled`/`available`/`remote`): `pluginReasons` now includes all
  four optional-`reasons` arms (`installed`/`disabled`/`available`/`remote`) before the required-arms
  group (`edge/handlers/tools.ts:394-413`). New fixture `absent-disabled-mp` asserts the forwarded
  `(not in manifest)` reason (`tests/edge/handlers/tools.test.ts:1115`). Fixed, confirmed in source.
- **WR-01** (12 suites watching the wrong door, `globalThis.fetch` instead of `https.request`):
  `rg -n 't\.mock\.method\(globalThis, "fetch"' tests/edge/` → no matches. All twelve suites now
  watch `https.request`, resolved into three documented shapes (hermeticity device / planted
  regression guard / stated-no-control guard) per suite, per `116-REVIEW-FIX-REPORT-3.md`'s
  reachability table. Fixed, confirmed absent from source.
- **WR-02 through WR-06, IN-01 through IN-05**: `116-REVIEW-FIX-REPORT-2.md` closes all seven with no
  production change (`git diff --quiet -- extensions/` reported clean before and after in the
  report); spot-checked `tests/edge/flag-catalog.test.ts` — the tautological
  `CATALOG_VERBS`/`isCatalogVerb` cases (WR-02, IN-02) are gone, replaced with a hand-authored
  `EXPECTED_CATALOG_VERBS` comparison.

Findings-closed count (5 + 7 + 1 = 13) matches STATE.md's "ALL THIRTEEN are closed" and
`116-REVIEW.md`'s own `findings.total: 13`. **VERIFIED.**

## 7. Notification and offline-path architecture backstop (SC-3, SC-4)

Left to the existing architecture suite per D-116-05's "Claude's Discretion" note.
`tests/architecture/{notify-closed-set-locks,notify-grammar-invariant,notify-producer-wire-coverage,
notify-stamp-coverage,notify-will-reload-agreement,no-orchestrator-network}.test.ts` all exist and
ran green inside the 5141/5141 total above. `edge/handlers/plugin/info.test.ts` and the WR-01 closure
additionally measured the real door (`https.request` via `isomorphic-git/http/node` →
`simple-get`) rather than trusting a `globalThis.fetch` spy. **VERIFIED**, at the level the phase
scoped it.

## Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | 30 owner tests exist, each mirrored, one deliberate orphan (index-handler, Phase 117) | ✓ VERIFIED | §1 |
| 2 | No coverage-exception pragma anywhere in `extensions/`/`tests/` | ✓ VERIFIED | §2 |
| 3 | All five gates (typecheck/lint/fallow/test/test:integration) pass independently, counts match baseline | ✓ VERIFIED | §4 |
| 4 | D-116-01a claimants pin shortfall identity (never an absolute branch pair), no pragma | ✓ VERIFIED (coverage mechanics) / gap on filing completeness | §5 |
| 5 | All 13 code-review findings closed, fixes present in source with owning test evidence | ✓ VERIFIED | §6 |
| 6 | Every D-116-01a claim is filed in `.planning/WINDOWS.md` so the phase boundary sweeps them as one set | ✓ PASSED after gap closure — see Gap Closure below | §5 |

**Score:** 5/6 truths verified.

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `tests/edge/**/*.test.ts` (30 files) | mirrored owner per source, 100% direct coverage or an argued D-116-01a shortfall | ✓ VERIFIED | §1, §5 |
| `extensions/pi-claude-marketplace/edge/flag-catalog.ts` | production licence 1 (116-06), closed | ✓ VERIFIED | typecheck/lint/fallow/tests green; catalog owner suite strengthened post-review |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | production licence 2+3 (116-27, D-116-15), CR-01/CR-02 fixed | ✓ VERIFIED | §6, source-read confirmed |
| `.planning/WINDOWS.md` | every D-116-01a claim filed | ⚠️ PARTIAL | 5 of 7 filed (entries 15, 16, 17, 18, 19); 116-02 and 116-26 missing |

## Gaps Summary

One gap, narrow and well-bounded: **two of the seven D-116-01a claimants — 116-02
(`edge/args.ts:34-37`) and 116-26 (`edge/handlers/shared.ts:53-55`) — were never filed as rows in
`.planning/WINDOWS.md`**, despite the phase's own locked amendment stating every claimed shortfall
"is also filed in `.planning/WINDOWS.md` so the phase boundary can sweep them as one set," and despite
`.continue-here.md`'s own closing claim that "Seven claimants, ALL SEVEN NOW PINNED." Only five are
actually in the ledger (entries 15-19, covering 116-13, 116-03, 116-05, 116-17, 116-21).

This is a filing/traceability gap, not a coverage gap: both shortfalls are correctly identified,
correctly argued (compiler-forced / structural reason named), correctly pinned by identity in their
own pair's `must_haves` and `<verify>` blocks, and re-measure exactly as documented
(`branches 28/29, lines 86/89` for `args.ts`; `branches 14/15, lines 83/85` for `handlers/shared.ts`).
No production behavior is at risk and no coverage-exception pragma exists. The gap is that the
cross-phase ledger sweep the phase promised — the mechanism that lets a future phase boundary find
and re-audit every admitted shortfall in one place — is missing two of its seven rows, which means a
`.planning/WINDOWS.md`-only reader (rather than a reader of all 31 individual SUMMARYs) would
undercount the phase's admitted shortfalls by 2.

**Suggested closure:** file two WINDOWS.md rows for 116-02 (`edge/args.ts:34-37`) and 116-26
(`edge/handlers/shared.ts:53-55`), in the same `unmet-truth` / D-116-01a form as entries 15-19,
before the phase closes. This is a few-minutes fix, not a re-open of any test or production file.

```yaml
gaps:
  - truth: "Every D-116-01a claim is filed in .planning/WINDOWS.md so the phase boundary can sweep them as one set"
    status: failed
    reason: "116-02 (edge/args.ts:34-37) and 116-26 (edge/handlers/shared.ts:53-55) are correctly pinned in their own pair's must_haves/verify blocks and re-measure exactly as documented, but neither has a corresponding row in .planning/WINDOWS.md. Five of seven claimants (116-03, 116-05, 116-13, 116-17, 116-21) are filed at ledger entries 15-19; these two are not."
    artifacts:
      - path: ".planning/WINDOWS.md"
        issue: "Missing rows for the 116-02 and 116-26 D-116-01a claimants"
    missing:
      - "A WINDOWS.md row for edge/args.ts:34-37 (116-02), same unmet-truth/D-116-01a form as entry 15-19"
      - "A WINDOWS.md row for edge/handlers/shared.ts:53-55 (116-26), same form"
```

No other gap was found. Correspondence, pragma-freedom, all five gates, the code-review closure, and
the coverage-gate mechanics for both claimants and non-claimants all re-measured exactly as the phase
claimed.

---

_Verified: 2026-09-03T07:30:00Z_
_Verifier: Claude (gsd-verifier)_


---

## Gap Closure (orchestrator, 2026-09-03)

The one gap this report found was real and is now closed. It was a **filing gap, not a coverage
defect**: 116-02 (`edge/args.ts:34-37`) and 116-26 (`edge/handlers/shared.ts:53-55`) — the two
ORIGINAL D-116-01a claimants — were pinned correctly inside their own pairs' `must_haves` and
`<verify>` blocks and re-measured exactly as documented, but neither had a `.planning/WINDOWS.md` row.
`.continue-here.md` asserted "all seven now pinned", which was true of the pins and false of the
ledger.

Worth noting how it happened: the three claimants found by MEASUREMENT during the phase (116-03,
116-05, 116-13) were filed as they were discovered, because the amended D-116-01a told their executors
to file them. The two claimants that predated the amendment were never revisited — the amendment
added a filing obligation and nobody applied it retroactively to the claims that already existed.

Both rows are now filed as ledger entries **21** (`args.ts`) and **22** (`shared.ts`), each naming the
compiler-forced reason (`noUncheckedIndexedAccess` types every index read as `T | undefined`, so a
guard the loop can never enter must still exist, and removing it needs a non-null assertion that is an
error throughout `extensions/` under `strictTypeChecked`).

The ledger now carries all seven D-116-01a shortfalls for this phase — entries 15, 16, 17, 18, 19, 21,
22 — plus entry 20, which is 116-28's separate finding about two production comments claiming a
registration-time `process.cwd()` capture the code does not make.

Nothing else in this report changed. Every other measurement stands as written.

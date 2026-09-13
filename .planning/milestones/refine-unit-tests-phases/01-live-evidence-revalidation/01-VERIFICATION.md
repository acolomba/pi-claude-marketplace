---
phase: 01-live-evidence-revalidation
verified: 2026-09-12T00:00:00Z
status: passed
score: 10/10 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/01-live-evidence-revalidation/01-71-PLAN.md"
  - ".planning/phases/01-live-evidence-revalidation/01-71-SUMMARY.md"
  - ".planning/phases/01-live-evidence-revalidation/01-72-PLAN.md"
  - ".planning/phases/01-live-evidence-revalidation/01-72-SUMMARY.md"
  - ".planning/phases/01-live-evidence-revalidation/01-VALIDATION.md"
  - "scripts/revalidation.mjs"
  - "scripts/revalidation.negative.mjs"
  - "tests/architecture/revalidation.test.ts"
covered_digest: "v1:sha256:6b84dfd01795c88aa70e35f06a9deb01073fc6e8607eb9213b8247cdea3b897e"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "gaps_found"
  previous_score: 9/10
  gaps_closed:
    - "Final REQUIREMENTS.md and ROADMAP.md pass a complete evidence-backed scope-impact round-trip: the exact Phase 2-9 titles and the exact canonical action for all 40 stable scope rows are now sealed outside the mutable ledger (SEALED_PHASE_CONTRACTS, SEALED_REQUIREMENT_ACTIONS), and scope-impact --check measures both mutable inputs against that fixed authority instead of against each other. Both previously-false-passing drift shapes (coordinated Phase 8 title + ledger afterAnchor rename; PDEF-01 action narrow/split -> keep) now exit 1 with a named violation, independently reproduced by this verifier on a disposable copy of the repository root and reverted cleanly. Public-CLI (9 new cases) and standalone negative controls (scripts/revalidation.negative.mjs) cover both shapes."
    - "The final Phase 1 quality gate remains green after gap closure: validateScopeChangeStructure was split into three functions (validateScopeChangeStructure 12 cyclomatic/10 cognitive, validateScopeRowMandatoryFields 7/2, validateScopeContractKind 6/5), all under the fallow ceiling (20/15) and the independent ESLint sonarjs/cognitive-complexity ceiling (15). The fallow-ignore-next-line suppression at the old line 1133 was deleted with no replacement suppression, and .fallowrc.json still carries zero health.thresholdOverrides entries. npm run check exits 0, independently re-run by this verifier (6118 unit / 32 integration, 0 fail/skip/todo, ~4m26s)."
  gaps_remaining: []
  regressions: []
decision_coverage:
  honored: 23
  total: 23
  not_honored: []
---

# Phase 1: Live Evidence Revalidation Verification Report

**Phase Goal:** Establish the complete reproducible scope before changing code.
**Verified:** 2026-09-12T00:00:00Z
**Status:** passed
**Re-verification:** Yes — `--gaps-only`, closing both truths left `failed` by the prior report (9/10)

## Goal Achievement

### Observable Truths (re-verified items — full 3-level check)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 9 | Final REQUIREMENTS.md and ROADMAP.md pass a complete evidence-backed scope-impact round-trip before later-phase planning. | ✓ VERIFIED | `scope-impact --check` prints `Scope impact valid: 40 records.` (measured directly, exit 0). This verifier independently planted both previously-surviving drift shapes on a disposable copy of the repo root (`/tmp/.../scratchpad/probe-root`, not `.planning/`): (a) renamed `### Phase 8: Direct Coverage` in ROADMAP.md and the matching `SCOPE-ROUTE-PHASE-08` before/after anchors in the ledger together — exit 1, `phase-title-contract: PHASE-08: roadmap phase title differs from sealed phase contract` + `scope-after-anchor: SCOPE-ROUTE-PHASE-08: afterAnchor does not resolve to phase`; (b) changed `SCOPE-REQ-PDEF-01`'s action from `narrow/split` to `keep` with both planning documents untouched — exit 1, `scope-action-contract: SCOPE-REQ-PDEF-01: canonical action differs from sealed scope contract`. Both reverted cleanly back to exit 0 / `Scope impact valid: 40 records.`. `git status --short` on the real `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `01-REVALIDATION.json` was empty throughout — no real planning file was mutated. `node --test tests/architecture/revalidation.test.ts` (147/147 pass) includes public-CLI cases for both shapes (`rejects coordinated phase title and route anchor drift`, `rejects a narrow/split row silently changed to keep`, plus siblings for `keep`->`narrow/split`, route-action->`keep`, and `move-to-evidence`->`keep`); `scripts/revalidation.negative.mjs` (exit 0) plants and asserts both shapes independently. |
| 10 | The final Phase 1 quality gate remains green after gap closure and review fixes. | ✓ VERIFIED | `npm run check` re-run by this verifier end to end: exit 0, unit `6118/6118` pass (0 fail/skip/todo), integration `32/32` pass (0 fail/skip/todo), ~4m26s wall time. `npx fallow health --fail-on-issues --format human` exits 0 with `0 above threshold · 13157 analyzed`; the raw JSON report (`functions_above_threshold: 0`, `findings: []`) confirms no suppression is masking a real violation. Forcing `--max-cyclomatic 5` to surface all three functions measured `validateScopeChangeStructure` 12/10, `validateScopeRowMandatoryFields` 7/2, `validateScopeContractKind` 6/5 — matching the SUMMARY's claimed numbers exactly. `npx eslint scripts/revalidation.mjs scripts/revalidation.negative.mjs` exits 0. `grep -rn 'fallow-ignore\|eslint-disable\|thresholdOverrides' scripts/revalidation.mjs scripts/revalidation.negative.mjs .fallowrc.json` returns nothing; `.fallowrc.json`'s `health.thresholdOverrides` is `None`/absent. `npm run test:coverage:direct -- scripts/revalidation.mjs` reports 100% branches/functions/lines (806/806, 208/208, 2795/2795). `01-VALIDATION.md` was refreshed with the current command table, superseding the stale Plan 01-69 sign-off. |

**Score (re-verified items):** 2/2 previously-failed truths now VERIFIED.

### Full Truth Table (regression check on previously-passed items)

Truths 1-8 were `✓ VERIFIED` in the prior report and are unaffected by 01-71/01-72's scope (both plans touch only `validateScopeChangeStructure` and the new sealed-contract tables in `scripts/revalidation.mjs`, plus the negative/test files and `01-VALIDATION.md`). Quick regression sanity checks, not full re-derivation:

| # | Truth | Status | Regression check |
|---|---|---|---|
| 1 | Corpus is exactly 110 files (45/58/7). | ✓ VERIFIED (no regression) | `node scripts/revalidation.mjs inventory` still reports `110 total (45 first-pass, 58 adversarial, 7 control)`, exit 0. |
| 2 | 53 shards exclusively cover the corpus. | ✓ VERIFIED (no regression) | `.planning/phases/01-live-evidence-revalidation/shards/*.json` still counts 53 files; `01-CORPUS-ASSIGNMENT.md` unchanged (not in either plan's `files_modified`). |
| 3 | Every claim/finding has a terminal disposition. | ✓ VERIFIED (no regression) | Ledger (`01-REVALIDATION.json`) was not edited by 01-71/01-72 (both plans list only `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`, `tests/architecture/revalidation.test.ts`, `01-VALIDATION.md` in `files_modified`). |
| 4 | Merged ledger is schema-valid with canonical duplicate chains. | ✓ VERIFIED (no regression) | Strict `validate` still runs against the same unedited ledger; its 945 `unsafe-reference` red is the documented, out-of-scope, pre-existing condition (see Scope Fence below), unchanged in count from before. |
| 5 | Generated Markdown/publish path reproduces the ledger. | ✓ VERIFIED (no regression) | `01-REVALIDATION.md` not touched by either plan; focused suite's publish/rollback/recovery cases (147/147) still pass. |
| 6 | Nine operator decisions resolved after terminal premises. | ✓ VERIFIED (no regression) | Ledger unedited; decision-count invariant unaffected. |
| 7 | Scope crosswalk has one record per requirement clause and route. | ✓ VERIFIED (no regression) | `scope-impact --check` still reports exactly 40 records. |
| 8 | REQUIREMENTS.md/ROADMAP.md contain the evidence-derived scope. | ✓ VERIFIED (no regression) | Neither file was edited by 01-71/01-72; `git status --short` on both is clean. |
| 9 | Scope-impact round-trip is complete and evidence-backed. | ✓ VERIFIED (closed this round) | See re-verified table above. |
| 10 | Evidence tooling, negative controls, and fixes are executable/tested. | ✓ VERIFIED (closed this round) | See re-verified table above; test count grew 136 -> 147, all passing; direct coverage stayed 100% (branch/function counts grew 794->806 / 202->208, all reached — no stranded code). |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts (delta from prior report)

| Artifact | Prior Status | Current Status | Details |
|---|---|---|---|
| `scripts/revalidation.mjs` | ✗ PARTIAL | ✓ VERIFIED | Now seals both phase titles and per-row actions outside the mutable ledger, and the blocking complexity violation is resolved with no suppression. |
| `scripts/revalidation.negative.mjs` | ⚠️ PARTIAL | ✓ VERIFIED | Both new drift shapes are planted and asserted standalone; exit 0 measured directly, unpiped. |
| `tests/architecture/revalidation.test.ts` | ⚠️ PARTIAL | ✓ VERIFIED | 147/147 pass; new cases discriminate both previously-plausible-wrong contracts, plus a sibling case that still isolates anchor-only drift from the coordinated shape. |
| `.planning/phases/01-live-evidence-revalidation/01-VALIDATION.md` | ⚠️ PARTIAL | ✓ VERIFIED | Refreshed with the current `npm run check` / scope-impact / coverage command table and the plant/revert round-trip record; supersedes the stale Plan 01-69 sign-off. |

Artifacts unaffected by this round (`01-CORPUS-ASSIGNMENT.md`, shard files, `01-REVALIDATION.json`, `01-REVALIDATION.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`) remain ✓ VERIFIED per the prior report and the regression checks above.

**Artifacts:** 10/10 fully verified

### Key Link Verification (delta from prior report)

| From | To | Via | Prior | Current |
|---|---|---|---|---|
| Ledger requirement rows | REQUIREMENTS.md | Fixed-path parse + `SEALED_REQUIREMENT_ACTIONS` exact-action comparison | ⚠️ PARTIAL | ✓ WIRED — verified by plant/revert probe 2 |
| Ledger route rows | ROADMAP.md | Fixed-path phase parse + `SEALED_PHASE_CONTRACTS` exact-title comparison, anchor built from the seal not from the parsed heading | ⚠️ PARTIAL | ✓ WIRED — verified by plant/revert probe 1 |
| Test/negative harness | Public CLI | Child-process execution against case-owned roots | ✓ WIRED | ✓ WIRED — both new false-pass combinations now have a public-CLI case and a standalone case |

**Wiring:** 7/7 complete

### Data-Flow Trace (Level 4, delta)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Requirements check | IDs, clauses, dispositions, sections, **exact action** | Canonical ledger + live REQUIREMENTS.md + `SEALED_REQUIREMENT_ACTIONS` | Yes | ✓ FLOWING (was ⚠️ HOLLOW) |
| Roadmap check | phase IDs, **exact titles**, memberships | Canonical ledger + live ROADMAP.md + `SEALED_PHASE_CONTRACTS` | Yes | ✓ FLOWING (was ⚠️ HOLLOW) |

### Behavioral Spot-Checks (personally re-run, unpiped)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full repository gate | `npm run check` (own process, own exit status) | exit 0; unit 6118/6118, integration 32/32 | ✓ PASS |
| Live planning-contract check | `node scripts/revalidation.mjs scope-impact --check` | `Scope impact valid: 40 records.`, exit 0 | ✓ PASS |
| Standalone negative witnesses | `node scripts/revalidation.negative.mjs` (own process, own exit status) | `Revalidation negative controls passed.`, exit 0 | ✓ PASS |
| Focused architecture suite | `node --test tests/architecture/revalidation.test.ts` | 147/147 pass, exit 0 | ✓ PASS |
| Direct source coverage | `npm run test:coverage:direct -- scripts/revalidation.mjs` | 100% branches/functions/lines (806/806, 208/208, 2795/2795) | ✓ PASS |
| Complexity ceiling (both engines) | `npx fallow health --fail-on-issues` / `npx eslint scripts/revalidation.mjs` | both exit 0; `functions_above_threshold: 0` | ✓ PASS |
| Suppression absence | `grep -rn 'fallow-ignore\|eslint-disable\|thresholdOverrides' scripts/revalidation.mjs scripts/revalidation.negative.mjs .fallowrc.json` | no output | ✓ PASS |
| Coordinated Phase 8 title + afterAnchor drift, planted on a disposable root | plant -> `scope-impact --check` -> revert | exit 1 with both named violations, then exit 0 on revert | ✓ PASS (self-planted by this verifier) |
| PDEF-01 `narrow/split` -> `keep` drift, planted on a disposable root | plant -> `scope-impact --check` -> revert | exit 1 with the named violation, then exit 0 on revert | ✓ PASS (self-planted by this verifier) |
| Out-of-scope strict `validate` (unpiped, own exit status read directly — not via a `tail` pipe) | `node scripts/revalidation.mjs validate` | exit 1, 945 `unsafe-reference` violations | Expected red — see Scope Fence |

### Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| RVAL-01 | ✓ SATISFIED (unchanged) | Regression-checked: inventory still 110/45/58/7. |
| RVAL-02 | ✓ SATISFIED (unchanged) | Regression-checked: ledger unedited by this round. |
| RVAL-03 | ✓ SATISFIED (unchanged) | Regression-checked: nine resolved decisions, ledger unedited. |
| RVAL-04 | ✓ SATISFIED (closed this round) | Both surviving false-pass classes are now sealed and independently proved fail-closed by this verifier; the final hard gate (`npm run check`) is green by measurement, with zero complexity suppression. |

No Phase 1 requirement is orphaned.

### Decision Coverage

| Source | Trackable | Honored | Status |
|---|---:|---:|---|
| `01-CONTEXT.md` | 23 | 23 | ✓ PASS (unchanged — D-19 through D-23, cited by the new seal code, predate this round and were already counted) |

### Scope Fence (recorded, accepted, not a gap)

- `node scripts/revalidation.mjs validate` exits 1 with 945 `unsafe-reference` violations against stale source/test paths in the canonical ledger's finding references (modules split by later hub-retirement refactors, e.g. commit `a5a21ed0`). This is pre-existing staleness of a historical evidence ledger, is **outside** `npm run check`, and per `.planning/STATE.md`'s `## At Milestone Close` section the operator has decided the entire revalidation toolchain (`scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`, `tests/architecture/revalidation.test.ts`) retires with this milestone rather than being repointed now. Not treated as a gap or regression.
- `scripts/revalidation.negative.mjs` had a second, unrelated pre-existing red (stale `AUTH-01`/`PDEF-01`/`GGAT-02` plant literals that no longer matched the reformatted `REQUIREMENTS.md`) which 01-72 repaired as a folded, in-scope fix (it authors that file). Verified: the runner now passes end to end, matching by pattern rather than by stale literal.
- `IN-01`/`IN-03`/`IN-04` (recorded non-actions) and the 13 waived window entries remain out of scope, unchanged.

### Anti-Patterns Found

None blocking. No debt marker (`TBD`/`FIXME`/`XXX`) or warning-level marker (`TODO`/`HACK`/`PLACEHOLDER`) found in `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`, or `tests/architecture/revalidation.test.ts` (`grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` on all three: no matches). No new comment in the diff (`fd875fe4..676cdb40`) references a GSD process artifact (`Phase NN`/`Plan NN`/`Wave N`) as a planning citation — the one `Phase 1` occurrence in a new comment refers to the product's own ROADMAP.md phase-numbering domain concept (paired with decision IDs D-20/D-23), not a GSD workflow reference, and is consistent with this repository's comment-citation convention.

### Human Verification Required

None. Both closed truths are machine-reproducible: exact-string CLI output, exit codes, and fallow/ESLint measurements. This verifier independently reproduced the plant/revert round trip for both previously-surviving false-pass classes rather than accepting the SUMMARY's account of them.

### Gaps Summary

No gaps remain. Both truths left `failed` by the prior verification (`.planning/phases/01-live-evidence-revalidation/01-VERIFICATION.md`, `verified: 2026-09-06T16:04:42Z`) are now closed and independently re-measured by this verifier, not merely re-read from `01-71-SUMMARY.md` / `01-72-SUMMARY.md`. The one out-of-scope red (strict `validate`, 945 `unsafe-reference`) is a documented, operator-accepted condition tied to this milestone's planned retirement of the revalidation tooling, not a gap.

## Verification Metadata

**Verification approach:** Goal-backward `--gaps-only` re-verification: full 3-level checks plus independent plant/revert probes on the two previously-failed truths; regression sanity checks on the eight previously-passed truths.
**Must-haves source:** Prior `01-VERIFICATION.md` gaps block, `01-71-PLAN.md`/`01-72-PLAN.md` `must_haves`, and the task's explicit re-measurement instructions.
**Automated checks:** `npm run check` (full, unpiped), `scope-impact --check`, `revalidation.negative.mjs` (unpiped), `tests/architecture/revalidation.test.ts` (unpiped), `test:coverage:direct`, `fallow health --fail-on-issues`, `eslint`, two independently-planted-and-reverted drift probes on a disposable repository-root copy, suppression-marker greps, `.fallowrc.json` threshold-override check.
**Human checks required:** 0
**Regressions found:** 0

---

_Verified: 2026-09-12T00:00:00Z_
_Verifier: the agent (gsd-verifier)_

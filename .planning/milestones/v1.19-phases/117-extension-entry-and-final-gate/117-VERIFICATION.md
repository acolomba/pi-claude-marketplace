---
phase: 117-extension-entry-and-final-gate
verified: 2026-09-04T02:00:00Z
status: passed
score: 5/5 roadmap success criteria satisfied (4 verified directly, 1 closed by an accepted operator override; 36/36 REQUIREMENTS.md IDs cross-checked)
behavior_unverified: 0
overrides_applied: 1
gaps:
  - truth: "The clean tree passes all-pair coverage (Success Criterion 4, and requirement SUITE-05's 'direct coverage for all pairs ... pass' clause)"
    status: accepted_override
    reason: >
      The only wired, documented all-pair command — `npm run test:coverage:direct:all`
      (`node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl`) —
      does not exit 0 on the clean HEAD tree. Run directly during verification, it prints
      83 "Direct coverage passed" lines and then:
      `Incomplete direct coverage for extensions/pi-claude-marketplace/edge/args.ts:
      branches 28/29, lines 86/89` and exits 1. This is by design, not a regression: the
      gate refuses the first of seven operator-accepted D-116-01a single-branch shortfalls
      it reaches, and plan 117-11 (via code-review finding WR-05, iteration 2) explicitly
      declined to teach the gate an accepted-shortfall allowlist, because D-117-20 bars
      that remedy in terms ("not by a ledger-keyed verdict, which would be D-116-01a's
      banned pragma wearing a different hat"). CONTRIBUTING.md now documents this stop as
      "the expected outcome rather than a regression" and states plainly that neither
      sweep script has, or will have, a CI job.
      The 204-row proof that DOES exist (`117-ALL-PAIR-RESULT.ndjson`/`.md`, 204 rows, 204
      distinct source paths, verdicts 190 complete / 7 type-only / 7 accepted-shortfall —
      independently reproduced during this verification) was produced by driving the
      shipped gate once per row from a scratch script that was never committed to the
      repository, not by any wired npm script. So the retained artifact is genuine and
      correct, but no command a maintainer can run today reproduces it, and no command
      distinguishes "the same seven accepted shortfalls" from "an eighth, genuinely new
      shortfall" other than opening `.planning/WINDOWS.md` by hand.
      The phase's own artifacts already flag this as unresolved: `.planning/WINDOWS.md`
      entry 30 (open, kind `unrun-verify`) and `deferred-items.md` item 6 both end with
      "Needs an operator decision to close" / "Suggested owner: an operator decision."
      This verification independently confirms the underlying measurement (rc 1, same stop
      point, same module) but does not treat the open ledger entry as itself sufficient
      closure — the roadmap's Success Criterion 4 wording is not met literally, and no
      `overrides:` entry accepting the deviation exists yet.
    artifacts:
      - path: scripts/test-coverage-direct.mjs
        issue: "--all stops (rc 1) at the first of seven accepted D-116-01a shortfalls and has no accepted-shortfall list, by deliberate operator decision (D-117-20); CONTRIBUTING.md documents the stop as expected"
      - path: .planning/phases/117-extension-entry-and-final-gate/117-ALL-PAIR-RESULT.ndjson
        issue: "correct and complete (independently reproduced: 204 rows, 204 distinct sources, 190/7/7 verdict split), but was produced by an uncommitted scratch driver, not by any command in package.json"
    missing:
      - "An explicit operator decision closing WINDOWS entry 30 / deferred item 6 one way or the other: either accept that `npm run test:coverage:direct:all` will permanently exit 1 on a clean tree while any D-116-01a shortfall stands (and record that as an accepted deviation from SC-4's literal wording, e.g. via an `overrides:` entry on this file), or revisit D-117-20 to allow the accepted-shortfall list the code-reviewer proposed (already built and measured in 117-REVIEW-FIX-2.md, then reverted unshipped) so the wired command can pass."
overrides:
  - must_have: "The clean tree passes all-pair coverage (Success Criterion 4 / SUITE-05)"
    reason: >
      D-117-20 (amended 2026-09-03) deliberately keeps the all-pair gate refusing the seven
      accepted D-116-01a shortfalls rather than adding a ledger-keyed accepted-shortfall list,
      which the operator judged to be D-116-01a's banned coverage-exception pragma wearing a
      different hat. `npm run test:coverage:direct:all` therefore exits 1 on a clean tree, and
      will keep doing so for as long as any D-116-01a shortfall stands. That is the decision
      working as designed, not a regression. SC-4 and SUITE-05 were worded before the
      amendment, so their literal "passes" clause is accepted as superseded.
      The second half of this gap was NOT overridden — it was fixed. The verifier noted that
      117-ALL-PAIR-RESULT.ndjson, though correct, had been produced by an uncommitted scratch
      driver that nothing in the repository could re-run. `npm run test:coverage:direct:report`
      (commit 1495488b) now regenerates it from the gate's own enumeration and per-pair runner,
      reproducing all 204 rows, 204 distinct source paths and the identical
      190 complete / 7 type-only / 7 accepted-shortfall split, with a row-by-row diff at exit 0.
      It is a report, not a gate: it blocks nothing, and the gate's own diff for that commit is
      three `export` keywords and nothing else, verified by the orchestrator.
      Accepting this trades an automated, CI-visible all-pair check for keeping the
      coverage-exception-pragma ban absolute.
    accepted_by: operator
    accepted_at: 2026-09-04
    decision_ref: D-117-20 (amended); WINDOWS.md entry 30; deferred-items.md item 6
---

# Phase 117: Extension Entry and Final Gate Verification Report

**Phase Goal:** Maintainers have complete one-to-one ownership and direct proof for the accepted
204-module baseline.
**Verified:** 2026-09-04T02:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria — the roadmap contract)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The root entry owner test proves registration, composition, and reload behavior with 100 percent direct function, line, and branch coverage. | ✓ VERIFIED | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/index.ts` run directly during verification: `Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 15/15, functions 3/3, lines 161/161)`, exit 0. `tests/edge/index-handler.test.ts` and `tests/shared/index-smoke.test.ts` (the two legacy proxies) confirmed deleted (`ls` → "No such file"). |
| 2 | The correspondence gate reports exactly 204 mirrored owner pairs and rejects missing, unexpected, ambiguous, or proxy-owned tests. | ✓ VERIFIED | `node scripts/check-corresponding-tests.mjs` → `Corresponding-test gate passed.`, exit 0. `check-corresponding-tests.negative.mjs` plants `missing-test`, `unexpected-test`, `wrong-import`, and (117-09) `proxy-owned` — all confirmed present in the negative-control source and passing (`npm run test:corresponding:negative`, exit 0). Path-level ambiguity is proved structurally unreachable (round-trip injectivity assertion over the whole 204-row inventory, planted in 117-11) rather than checked for a case that cannot occur — a documented, reasoned choice (D-117-07/D-117-21), not a gap. |
| 3 | The all-pair result contains one complete direct coverage record for every inventory row, with no aggregate-coverage substitution. | ✓ VERIFIED | `117-ALL-PAIR-RESULT.ndjson` independently parsed during verification: 204 rows, 204 distinct source paths, verdict counts exactly `{ complete: 190, type-only: 7, accepted-shortfall: 7 }`, matching the claimed composition. `117-ALL-PAIR-RESULT.md` names all seven type-only rows by path and states plainly it is not a Node 24 result (measured on v26.8.1; CI pins Node 24 at `.github/workflows/ci.yml` lines 70/91/111/132) — no forbidden "Node 24 all-pair result" label present. The aggregate-exclusion argument (merged coverage hides an uncovered branch on the entry pair) is measured, not asserted. |
| 4 | Planted negative controls fail for their intended violations, and the clean tree passes focused tests, all-pair coverage, and `npm run check`. | ✗ FAILED (partial) | Negative controls: both `npm run test:corresponding:negative` and `npm run test:coverage:direct:negative` pass (exit 0, verified directly). Focused tests: `npm test` → 5144/295/0 fail (verified directly, matches orchestrator measurement). **All-pair coverage does not pass**: `npm run test:coverage:direct:all` run directly during verification exits 1, stopping at `edge/args.ts` after 83 of 204 rows — see the gap below. `npm run check` also does not exit 0, but only on 8 pre-existing untracked operator files (`.mcp.json`, seven `.planning/research/.cache/*.json`) unrelated to any file this phase touched — confirmed via `git status --short --ignored`; a longstanding, previously-documented environment condition, not a phase-117 regression. |
| 5 | Public, persistence, adapter, and named product contracts remain unchanged. Prohibited preservation and migration mechanisms are absent. | ✓ VERIFIED | `git diff --quiet 562f5d13 HEAD -- extensions/` exits 0 — no production file changed anywhere in the phase (verified directly). `tests/helpers/` confirmed absent (`test -d` fails). No exemption/allow-list mechanism was reintroduced: the 8 correspondence violations were resolved by relocating/folding each orphan by subject (D-117-01), not by an allow-list. |

**Score:** 4/5 roadmap success criteria fully verified; criterion 4 verified in part (negative controls and focused tests pass; the all-pair sweep and the aggregate `npm run check` command do not exit 0, one of which — the all-pair sweep — is a genuine, if thoroughly documented, unresolved gap).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `tests/index.test.ts` | Mirrored owner for `index.ts`, 100% direct coverage alone | ✓ VERIFIED | 14 cases, all pass; coverage 15/15 branches, 3/3 functions, 161/161 lines |
| `scripts/check-corresponding-tests.mjs` (+ `.negative.mjs`) | Correspondence gate + planting control, extended for proxy-owned | ✓ VERIFIED | Gate passes at 0 violations; negative control plants and rejects `missing-test`, `unexpected-test`, `wrong-import`, `proxy-owned` |
| `scripts/test-coverage-direct.mjs` (+ `.negative.mjs`) | Self-checking all-pair run, completeness + injectivity assertions, retained-report support | ✓ VERIFIED (assertion machinery); ⚠️ the wired `--all` invocation itself does not reach a green exit on this tree (see gap) |
| `.planning/phases/117-extension-entry-and-final-gate/117-ALL-PAIR-RESULT.ndjson` / `.md` | One record per 204 inventory rows, retained | ✓ VERIFIED | 204 rows, 204 distinct sources, correct verdict composition, independently reproduced |
| `tests/helpers/` (deleted) | SUITE-02 — no generic test-support directory | ✓ VERIFIED | Directory absent; `source-scan.ts` → `tests/architecture/`, `ipc-child.ts` → `tests/integration/`, `notification-boundary.ts` → `tests/edge/`, `marketplace-seed.ts` → `tests/edge/handlers/`, all confirmed present at their new homes |
| `.planning/REQUIREMENTS.md` Brownfield Pair Inventory | All 204 rows `Complete`, Status column not stale | ✓ VERIFIED | Every row read `Complete` in the sampled sections; `P117-01` (`index.ts` → `tests/index.test.ts`) present and `Complete` |
| `.planning/ROADMAP.md` / `.planning/STATE.md` pair totals | 204/204 in both places | ✓ VERIFIED | ROADMAP progress table and per-phase plan count both read 204/204; STATE.md narrative reads 204 of 204 in the sampled lines |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `package.json` `test` / `test:coverage:unit` globs | `tests/index.test.ts` | explicit second quoted glob argument | ✓ WIRED | `grep` confirms both scripts append `"tests/index.test.ts"`; `npm test` totals rose to 5144 and the root owner's 14 cases print in the run |
| `tests/architecture/unit-suite-glob-completeness.test.ts` | `package.json` scripts | scrapes quoted glob args, compares against a `readdirSync` walk | ✓ WIRED | Present on disk, described as D-117-15's planted control; not independently re-planted during this verification but corroborated by the SUMMARY's recorded RED→GREEN transition |
| `package.json` `test:coverage:direct:all` | `scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl` | npm script body | ✓ WIRED (but fails) | Confirmed the script body includes `--report`; confirmed by direct execution that the wired command exits 1 on this tree (see gap) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Entry-pair owner passes alone at full coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/index.ts` | `branches 15/15, functions 3/3, lines 161/161`, exit 0 | ✓ PASS |
| Correspondence gate is clean | `node scripts/check-corresponding-tests.mjs` | `Corresponding-test gate passed.`, exit 0 | ✓ PASS |
| Both negative controls fire correctly | `npm run test:corresponding:negative && npm run test:coverage:direct:negative` | both `... passed.`, exit 0 | ✓ PASS |
| Full unit suite | `npm test` | `tests 5144, suites 295, pass 5144, fail 0` | ✓ PASS |
| Integration suite | `npm run test:integration` | `tests 31, pass 31, fail 0` | ✓ PASS |
| typecheck / lint / fallow | `npm run typecheck`, `npm run lint`, `npm run fallow` | all exit 0 (fallow reports pre-existing 1.2% duplication, under threshold) | ✓ PASS |
| `format:check` failure is scoped to pre-existing untracked files | `npm run format:check`; `git status --short --ignored \| grep -E "mcp.json\|research/.cache"` | 8 warned files, all untracked and unrelated to this phase | ✓ PASS (confirms the documented exemption, not a phase defect) |
| **All-pair sweep (the wired command)** | `npm run test:coverage:direct:all` | 83 "Direct coverage passed" lines, then `Incomplete direct coverage for extensions/pi-claude-marketplace/edge/args.ts: branches 28/29, lines 86/89`, exit 1 | ✗ FAIL — matches the documented, deliberate stop point exactly, but does not satisfy SC-4's "passes ... all-pair coverage" literally |
| Retained all-pair artifact is internally consistent | parsed `117-ALL-PAIR-RESULT.ndjson` directly (204 lines → JSON) | 204 rows, 204 distinct `sourcePath`s, verdict split `{complete: 190, type-only: 7, accepted-shortfall: 7}` | ✓ PASS |
| Production untouched all phase | `git diff --quiet 562f5d13 HEAD -- extensions/` | exit 0 | ✓ PASS |
| `tests/helpers/` dissolved | `test -d tests/helpers` | absent | ✓ PASS |

### Requirements Coverage

All 36 requirement IDs assigned to Phase 117 are marked `[x]` in `.planning/REQUIREMENTS.md`. Cross-checked
against phase evidence:

| Requirement | Status | Evidence |
| --- | --- | --- |
| OWN-01..06 | ✓ SATISFIED | 204-row correspondence gate clean; proxy-owned and wrong-import both detected and controlled; type-only/barrel modules follow the same rule (no exemptions found in gate source) |
| CASE-01..04 | ✓ SATISFIED | Spot-checked `tests/index.test.ts`: 14 `// arrange` / 14 `// act` / 15 `// assert` markers; repo-wide `grep` for `.only(`/`.skip(`/`.todo(` in `tests/**/*.test.ts` returns zero matches |
| TEST-01..05 | ✓ SATISFIED (sampled) | 117-08 SUMMARY documents strong-mock exact-parameter registration-table proof (Plant C: wrong event name fails at the call site across all 12 cases) and an honestly-labelled regression guard (not a false measurement) for the offline-transport claim |
| COV-01 | ✓ SATISFIED | Confirmed for the entry pair directly; the milestone's own retained artifact confirms it for 190/197 emitting modules, with the other 7 pinned by identity as accepted shortfalls |
| COV-02 | ✓ SATISFIED | `Expected one LCOV record ... found 2` and `Incomplete direct coverage for ...` both now carry planting controls (117-10); path-level ambiguity proved structurally unreachable rather than left unchecked |
| COV-03 | ✓ SATISFIED | Changed-pair and all-pair commands both route through `assertCompleteCoverage`/`pairForPath` (confirmed by reading `scripts/test-coverage-direct.mjs`) |
| COV-04 | ✓ SATISFIED | Every new check in this phase (glob-completeness, proxy-owned, LCOV-ambiguity, incomplete-coverage, report-completeness/injectivity) carries a planting control per the SUMMARY files' verbatim plant output |
| COV-05 | ✓ SATISFIED (as amended) | The retained artifact genuinely holds one verdict per row for all 204, independently reproduced. Reading is per the operator-amended D-117-20 (190 complete + 7 accepted-shortfall + 7 type-only), not the original 197+7 wording — an explicit, dated, documented decision, not a silent weakening |
| DES-01..03 | ✓ SATISFIED | No production file changed in this phase (`git diff --quiet` on `extensions/`); no test-only export added |
| DEL-01..04 | ✓ SATISFIED | Each of the 12 plans owns one concern per its `files_modified`/commit history; 117-11's SUMMARY explicitly separates gate-script commits from artifact commits |
| MOD-10 | ✓ SATISFIED | `index.ts` pair complete at 100% direct coverage; correspondence gate at 204/204 |
| PRES-01..02 | ✓ SATISFIED (trivially) | No production edits this phase, so no public/persistence/adapter contract could have moved |
| SUITE-01 | ✓ SATISFIED | `npm test` runs fully offline (no network-dependent suite observed to fail; entry pair explicitly proves zero transport opens) |
| SUITE-02 | ✓ SATISFIED | `tests/helpers/` confirmed deleted; all four modules relocated beside their dominant consumer |
| SUITE-03 | ✓ SATISFIED (spot-checked) | `rg -n 'Phase [0-9]\|Plan [0-9]\|Wave [0-9]\|Pitfall [0-9]'` reported clean in the 117-11 plan's own verify block for the gate scripts it touched |
| SUITE-04 | ✓ SATISFIED | No exemption list, preservation kit, or generic helper directory reintroduced; orphans resolved by subject (D-117-01) |
| SUITE-05 | ⚠️ **PARTIALLY SATISFIED — same gap as SC-4** | Focused tests and both negative controls pass; `npm run test:coverage:direct:all` (the wired "direct coverage for all pairs" command this requirement names) does not exit 0 on the clean tree, for the reasons detailed in the gap above. `npm run check` also does not exit 0, but only on pre-existing, phase-unrelated untracked files. |
| SUITE-06 | ✓ SATISFIED | Inventory sweep confirmed: REQUIREMENTS.md, ROADMAP.md, and STATE.md all agree at 204/204, and `.planning/WINDOWS.md` was updated with this phase's own findings (entries 23-30) |

No orphaned requirements found: all IDs REQUIREMENTS.md maps to Phase 117 also appear in the ROADMAP's requirement list for the phase.

### Anti-Patterns Found

None blocking. `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` scan not separately re-run given the volume of files touched (50+ across 12 plans); the phase's own SUMMARY files document repeated anti-pattern scans per task with zero matches, and `npm run lint`/`npm run fallow` (which independently catch several of these classes) both exit 0 on the current tree.

### Human Verification Required

None. The one open item (the all-pair sweep gap) is a structural/design question the phase's own artifacts already frame as needing an *operator* decision, not a manual behavioral check — it is captured as a gap with a suggested resolution path, not a human-UAT item.

### Gaps Summary

**One gap, already extensively self-documented by the phase.** The all-pair coverage sweep
(`npm run test:coverage:direct:all`) does not exit 0 on the clean HEAD tree, and by design will not
until either (a) the seven remaining D-116-01a accepted shortfalls are closed by a production rewrite
(explicitly out of scope for this phase — no production licence was opened), or (b) the operator
revisits D-117-20 to permit the ledger-keyed accepted-shortfall list the code review already built,
measured, and reverted unshipped (see `117-REVIEW-FIX-2.md`'s WR-05 section). This directly affects
the literal wording of ROADMAP Success Criterion 4 ("the clean tree passes ... all-pair coverage") and
requirement SUITE-05 ("direct coverage for all pairs ... pass").

This is not sloppy or hidden work — it is the opposite. The phase's own review loop (iteration 2)
found it, the fix pass built and measured the alternative, deliberately did not ship it because an
explicit operator decision (D-117-20) bars that remedy in terms, and filed it as `.planning/WINDOWS.md`
entry 30 and `deferred-items.md` item 6, both ending with "needs an operator decision." This
verification independently reproduced the exact failure (same module, same stop point, same reading)
and treats the unresolved ledger entry as a genuine open item rather than self-granting closure on the
strength of the documentation trail alone — per this verifier's mandate, only the operator's own
explicit acceptance (e.g., an `overrides:` entry, or a revisited D-117-20) can close it.

**This looks intentional.** To accept this deviation as-is and let the phase close, add to this file's
frontmatter:

```yaml
overrides:
  - must_have: "The clean tree passes all-pair coverage (Success Criterion 4 / SUITE-05)"
    reason: "D-117-20 (amended 2026-09-03) deliberately keeps the all-pair gate refusing the seven
      accepted D-116-01a shortfalls rather than adding a ledger-keyed accepted-shortfall list, which
      the operator judged to be D-116-01a's banned coverage-exception pragma wearing a different hat.
      The 204-row proof exists and is correct (117-ALL-PAIR-RESULT.ndjson, independently verified);
      only the single-command, always-green reproduction of it is absent, and CONTRIBUTING.md documents
      the stop as expected. Accepting this trades an automated CI-visible all-pair check for keeping
      the coverage-exception-pragma ban absolute."
    accepted_by: "<operator>"
    accepted_at: "<ISO timestamp>"
```

Everything else in the phase — the entry pair, the correspondence gate at 204/204, the gate-strengthening
work (proxy-owned naming, the two previously-uncontrolled verdicts), the `tests/helpers/` dissolution,
the glob-completeness fix, and the full inventory/ledger sweep — is independently verified against the
live codebase and holds.

---

_Verified: 2026-09-04T02:00:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
verified: 2026-10-10T21:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/BACKLOG.md"
  - ".planning/WINDOWS.md"
  - ".planning/phases/01-presentation-model/01-VALIDATION.md"
  - ".planning/phases/03-typed-raw-surfaces/03-VALIDATION.md"
  - ".planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-01-PLAN.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-01-SUMMARY.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-02-PLAN.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-02-SUMMARY.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-03-PLAN.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-03-SUMMARY.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-04-PLAN.md"
  - ".planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-04-SUMMARY.md"
  - "package-lock.json"
  - "tests/integration/provenance-invisibility.test.ts"
  - "tests/integration/skill-path-resolution.test.ts"
covered_digest: "v3:sha256:00b7daaa0355a1570c96beab3c128505ed4d4ab8bcf95ac4bcae5b187240e4ee"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Address tech debt: ledger dispositions and advisory Verification Report

**Phase Goal:** Every open WINDOWS.md entry carries a `fixed` or `waived` disposition with an auditable reason, so the `/gsd-ship` broken-windows gate reads zero open, and the `brace-expansion` advisory is remediated in the root lock with the Pi-pinned residual recorded and carried.
**Verified:** 2026-10-10
**Status:** passed
**Re-verification:** No, initial verification
**Tree:** `76abf211`, base `a876e321`

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC-1: `windows status` reports `open_count: 0`; 85 and 89 `fixed`; waived entries carry `[json-output]` reasons naming #236 (`d7213bc2`) for 32-34, #202 (`0affe79e`/`feb04658`) for 41-58, WOUT-01 for 84, accepted design for 88 | VERIFIED | `windows status --raw` parsed: open 0, waived 50, fixed 39, total 89. Entries 32-34 share one reason naming #236 and `d7213bc2`. Entries 41-58 share one reason naming `0affe79e` and `feb04658` (#202). Entry 84 names BACKLOG.md WOUT-01. Entry 88 names `composeContextBlocks`, the fallow gate, and 15 files with 138 references. 85 and 89 are `fixed`. Commits cited exist in git (`d7213bc2` is #236, 2026-10-05; `feb04658` is #202 on main; `0affe79e` is on the test-backlog branch, not main, as the roadmap says). All 25 disposed reasons are stored in full (4 distinct strings, none truncated). |
| 2 | SC-2: both pi-subagents resolver tests resolve the root before the hermetic HOME swap; SC-2 / AGSK-06 runs, not skips, where the global peer is installed; CI unchanged | VERIFIED | Diff shows `resolvePiSubagentsPackageRoot()` called at case top in both files, root passed into the loaders. Run with the global peer: `# tests 2 / pass 2 / fail 0 / skipped 0`. Run with `PI_SUBAGENTS_ROOT=/nonexistent`: `pass 0 / fail 0 / skipped 2`, exit 0. `.github/workflows/` has an empty diff against `a876e321`. |
| 3 | SC-3: root lock pins `node_modules/brace-expansion` >=5.0.12, `package.json` unchanged; only the `pi-coding-agent/node_modules/` path is still reported; e2e peer-floor fixture byte-identical | VERIFIED | Lock diff is exactly 3 added / 3 removed lines in the root entry (5.0.9 to 5.0.12, resolved URL, integrity). Root entry reads 5.0.12, nested reads 5.0.9. `npm audit --package-lock-only --json`: exit 1, 1 vulnerable node, `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion`. `package.json` and `tests/e2e/pi-peer-floor/` have empty diffs against `a876e321`. |
| 4 | SC-4: BACKLOG.md carries WOUT-01 and DEPADV-01; DEP-07-03-01 points at DEPADV-01 | VERIFIED | Each heading appears once, they are the last two sections, 0 deleted lines against `a876e321`. WOUT-01 holds engine 3.13.0, pi 0.85.1, `tmp/pi-uat`, 16.5 s, `SCHEMA_NONCOMPLIANCE`, `agent.ts:818`, and a "To settle it" recipe. DEPADV-01 names the three GHSA ids, fix range >=5.0.12, lock commit `a12dfa16`, the shrinkwrap pin, why deleting nested entries is not a fix, and the clearing action. The phase 07 deferred item states the root fix and points at DEPADV-01. |
| 5 | SC-5: `03-VALIDATION.md` reads `nyquist_compliant: true`; `01-VALIDATION.md` stays `false` with its checkbox unticked; `npm run check` green, no new suppression, text corpus unchanged | VERIFIED | 03 diff is one line (`false` to `true`), and its checkbox at line 89 is ticked. 01 diff is one line (checkbox `[x]` to `[ ]`); frontmatter still `false`. Diff outside `.planning/` is only `package-lock.json` and the two test files: no `extensions/`, `docs/`, or catalog change, and no `fallow-ignore` / `eslint-disable` / `@ts-*` line added. Phase 01-06 VERIFICATION files and the 01 corpus baseline have no diff. `npm run check` was run by the regression gate on the final tree: exit 0 at `76abf211` (not re-run, per instruction). |

**Score:** 5/5 truths verified

### CONTEXT decisions

| Decision | Status | Evidence |
| --- | --- | --- |
| D-01, D-02 (waive 32-34, 41-58 as moot, none marked fixed) | VERIFIED | All 21 are `waived`; reasons above. `08-04-SUMMARY.md` records the absent-file evidence (21 entries, 18 paths, 14 absent, 4 present no longer match). |
| D-03 (84 waived to WOUT-01) | VERIFIED | Entry 84 reason and BACKLOG section above. |
| D-04 (85 fixed after test passes) | VERIFIED | `tests/orchestrators/marketplace/update.test.ts`: 66 pass, 0 fail. |
| D-05 (88 waived as accepted design) | VERIFIED | Entry 88 reason. |
| D-06 (89 fixed via resolver-order fix) | VERIFIED | Entry 89 `fixed`; SC-2 case runs (2 pass, 0 skipped). |
| D-07, D-08, D-10 (root bump only, nested kept, no CI audit, no override) | VERIFIED | Lock diff, audit result, empty `package.json` / workflow diffs. |
| D-09 (DEPADV-01 carrier and pointer) | VERIFIED | See SC-4. |
| D-11 (validation records) | VERIFIED | See SC-5. |
| D-12 (phase 07 verification stale, accepted) | VERIFIED | Recorded in `08-01-SUMMARY.md` and `08-03-SUMMARY.md`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Ledger shape | `gsd-tools windows status --raw` (saved to file, parsed) | open 0 / waived 50 / fixed 39 / total 89 | PASS |
| Audit residual | `npm audit --package-lock-only --json` | exit 1, single nested node | PASS |
| SC-2 with peer | `node --test --test-reporter=tap` over both files | pass 2, skipped 0 | PASS |
| SC-2 absent peer | same, `PI_SUBAGENTS_ROOT=/nonexistent` | skipped 2, fail 0, exit 0 | PASS |
| Entry 85 evidence | `node --test` on `update.test.ts` | 66 pass, 0 fail | PASS |

### Requirements Coverage

The four plans declare `requirements: []`, which is by design for this closeout phase (ROADMAP: "none; traceability lives in WINDOWS.md and BACKLOG.md"). No requirement IDs to cross-reference, and REQUIREMENTS.md maps none to Phase 8, so there are no orphans.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` in the two modified test files, and no new suppression marker anywhere in the diff.

### Observations (non-blocking)

- The resolver functions in the two test files are no longer byte-identical to `a876e321`, which plan 08-02 had stated. The post-execution review-fix commits (`ab350dd2`, `eddd3cf0`) deliberately changed them so a present-but-unloadable peer fails instead of skipping, while an absent peer or `PI_SUBAGENTS_ROOT=/nonexistent` still skips. The SC-2 proofs hold on the final tree, so this strengthens the goal rather than breaking it.
- The 27 waived entries that predate this phase do not carry a `[json-output]` prefix. SC-1's prefix and retirement-naming wording is read as applying to the entries this phase disposed (the 25 listed), since the criterion names exactly those groups.
- Phase 07's verification reads `stale` by accepted design (D-12).

### Human Verification Required

None.

### Gaps Summary

No gaps. The ledger reads zero open with full, auditable reasons, the brace-expansion root entry is at 5.0.12 with only the Pi-shrinkwrapped residual reported and carried as DEPADV-01, and the resolver tests run where the peer exists and skip only where it is absent.

---

_Verified: 2026-10-10_
_Verifier: Claude (gsd-verifier)_

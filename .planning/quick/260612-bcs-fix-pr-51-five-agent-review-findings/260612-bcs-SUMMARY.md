---
name: 260612-bcs-fix-pr-51-five-agent-review-findings
status: complete
date: 2026-06-12
---

# Quick Task 260612-bcs: Fix PR #51 five-agent review findings — Summary

All 53 findings from the five-agent PR #51 review (code-reviewer,
pr-test-analyzer, silent-failure-hunter, type-design-analyzer,
comment-analyzer) closed, plus a final leftover scrub. The original
single plan was re-cut into 7 sequential single-commit sub-plans after
the first executor refused the scope as intractable for one session
(see `260612-bcs-INDEX.md` for the finding-to-plan coverage table).

## Commit chain (8 commits)

| Commit | Sub-plan | Scope |
| --- | --- | --- |
| d552ccd | 01 | I1/I2/I5/S2/S3 — catalog-amending error-channel fixes |
| 0ef0cc9 | 02 | C1 (critical), I3/I4/S5, D-UPD, D-NCF, T2 |
| 01e294e | 03 | I6/S4/S6/Y7 — classification + fail-loud loops |
| cfc414c | 04 | Y1/Y2/Y4/Y5/Y6 — type cuts (byte-neutral) |
| 59ceb0e | 05 | Y3 overload pair + S7-S10 tightening |
| 852fc7e | 06 | T1/T3-T6 — test-only gap closure |
| 6843255 | 07 | D1-D11/S1/D-MIG — comment scrub, README rewrite, CHANGELOG |
| f0ae1af | (extra) | Leftover phase-numbered pitfall refs (47 sites, 17 files) |

Per-sub-plan details in `260612-bcs-NN-SUMMARY.md` (01-07).

## Locked user decisions honoured

- **D-UPD**: `plugin update`/autoupdate refresh a disabled plugin's
  record (version/source pin) but keep it disabled — no silent
  re-enable (was: re-materialized artefacts until next reload).
- **D-NCF**: `marketplace/remove.ts` cascade classifier aligned to
  ATTR-09 — `AgentsUnstageFailureError` → `"source mismatch"`.
- **D-MIG**: first-run config migration stays silent (NFR-2);
  contract comment fixed to mark the silence deliberate.

## Verification

- `npm run check` green after every commit; final state 1853 unit +
  10 integration tests, typecheck + ESLint + Prettier + catalog-uat
  byte gate all green.
- Pre-commit hooks green on every commit; no `--no-verify`.
- Version audit (user request): 0.5.0 consistent across package.json,
  package-lock.json, sonar.projectVersion; CHANGELOG 0.5.0 entry
  amended with this batch's user-visible changes and re-dated.

## Open item (needs user ruling)

~100 BARE `Pitfall N` references (no phase number) remain across
source and tests as a recurring taxonomy (e.g. state-io's Pitfall 9
ENOENT contract, git-credential's Pitfall 2-8). The comment-analyzer
recommended ruling on this family in
`.claude/rules/typescript-comments.md`: either bless `Pitfall N` as an
allowed anchor or schedule a repo-wide strip. Not changed here.

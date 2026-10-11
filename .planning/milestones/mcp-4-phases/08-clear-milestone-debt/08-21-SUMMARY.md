---
phase: 08-clear-milestone-debt
plan: 21
subsystem: planning-records
tags: [debt-01, debt-02, debt-05, ledgers, records, final-gate]

requires:
  - "08-01..08-20: the Findings closed tables and commit SHAs each ledger row cites"
provides:
  - ".planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md, a closed ledger for the docs-phase review"
  - "Phase 1-7 review ledgers with `open: 0`: every finding `fixed` (with a commit) or `wontfix` (with a reason)"
  - "ROADMAP Phase 1 criterion 4 and PIFL-07 amendment notes; corrected ADET-02 decision lines in STATE.md"
  - "BACKLOG.md: MCPOVR-01 and MCPROW-01 CLOSED; ROOTKEY-01 carries broken-windows entry 90"
affects: [phase verification, milestone audit]

actuals:
  tokens: 4415
  tasks: 3
  commits: 3
plan_head_before: 8c0ae094c7ba75ba87969551eaff736f0dc18e81
plan_head_after: f47a2c9edf2699127d891fc139c432991c82d300

tech-stack:
  added: []
  patterns:
    - "A ledger closed by hand records why a later code-review run would read `wontfix` as `open`"

key-files:
  created:
    - .planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md
  modified:
    - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-REVIEW-DISPOSITION.md
    - .planning/phases/02-adapter-file-delivery/02-REVIEW-DISPOSITION.md
    - .planning/phases/03-claude-code-tool-names-and-tool-search/03-REVIEW-DISPOSITION.md
    - .planning/phases/04-variable-expansion-at-claude-code-parity/04-REVIEW-DISPOSITION.md
    - .planning/phases/05-automatic-migration-on-reload/05-REVIEW-DISPOSITION.md
    - .planning/phases/06-live-mcp-status-in-info/06-REVIEW-DISPOSITION.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/BACKLOG.md
    - .planning/WINDOWS.md

key-decisions:
  - "Broken-windows entry 90 (the misleading `declares an unusable dependency (root: ...)` cause for an invalid root plugin name) gets BACKLOG carrier ROOTKEY-01 and is waived in the ledger with that pointer; the code is not changed in this phase"
  - "CONVENTIONS.md already states 22 `fallow-ignore` markers, which matches `rg`; plans 08-11 and 08-15 added no marker, so the file is unchanged"

patterns-established: []

requirements-completed: [DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05]

duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 21: Close the review ledgers, match the records, final gates Summary

**Every review finding of Phases 1-7 now reads `fixed` with the commit that fixed it, or `wontfix` with its reason, and all seven ledgers say `open: 0`. Phase 7 has its own ledger. The floor criterion, PIFL-07 and the ADET-02 decision lines match the code, MCPOVR-01 and MCPROW-01 are closed in BACKLOG.md, and the last open debt item (broken-windows entry 90) has a carrier. On the final tree the fallow audit reads `pass` with 0 introduced groups, and `npm run check` with both peer roots exits 0.**

## Ledger tallies

| Ledger | Before (8c0ae094) | After |
| ------ | ----------------- | ----- |
| 01 (total 16) | fixed 5, open 11 | fixed 16 |
| 02 (total 16) | fixed 7, deferred 8, skipped 1 | fixed 15, wontfix 1 (WR-06) |
| 03 (total 10) | open 10 | fixed 8, wontfix 2 (WR-01, WR-03) |
| 04 (total 16) | fixed 7, open 9 | fixed 13, wontfix 3 (IN-01, IN-03, IN-04) |
| 05 (total 12) | fixed 4, open 8 | fixed 11, wontfix 1 (IN-04) |
| 06 (total 3) | fixed 1, open 2 | fixed 3 |
| 07 (total 8) | no ledger | fixed 8 |
| **All (81)** | fixed 24, open 40, deferred 8, skipped 1, 8 unrecorded | fixed 74, wontfix 7 |

Split findings keep one row each: P3 WR-03 reads `wontfix` (code accepted in 03-UAT.md test 1) and its Source names the docs half fixed in `c2e89982`; P7 IN-06 reads `fixed` (`22d621ef`) and its Source names the absolute-path sub-item as wontfix with its reason. P1 IN-10 reads `fixed` (`64a49e4d`) and its Source records the declined shell harness. P2 IN-03 reads `fixed` (`8578407a`, `d45f5b5d`) and its Source records the declined `ENOTDIR` part with the 08-20 reason. P5 IN-07 cites `14c70964` and `de427118` and records the missing-checkout catalog note. Ledgers 02-05 carry the footer sentence on the parser's `open|fixed|skipped|deferred` set.

The DEBT-02 node check (Task 2 verify) was run before the edits and failed on the open rows, which shows it detects them (exit 1; first lines):

```text
.planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-REVIEW-DISPOSITION.md count or open 16 16
.planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-REVIEW-DISPOSITION.md IN-01 open ["open","01-REVIEW.md iteration 2"]
.planning/phases/02-adapter-file-delivery/02-REVIEW-DISPOSITION.md IN-01 deferred ["deferred","Info, outside the critical_warning fix scope"]
.planning/phases/02-adapter-file-delivery/02-REVIEW-DISPOSITION.md WR-06 skipped ["skipped","02-REVIEW-FIX.iter2.md (not in the current review)"]
...
exit=1
```

After the edits, both Task 2 checks and the Task 3 records check exit 0 on the final tree.

## Inherited clone groups (D-08-08)

| Group (RESEARCH numbering) | Disposition |
| -------------------------- | ----------- |
| r1, r13 | removed by refactoring (08-01) |
| r3, r6 | reviewed `fallow-ignore-next-line code-duplication` markers (08-06) |
| r8 | stays inherited, `introduced: false`; no builder or marker (08-11) |
| r11, r14 | removed by extraction, no marker (08-15) |
| r2, r4, r5, r7, r9, r10, r12 | left inherited: they exist on main, no plan edited inside their spans, and the audit reports them `introduced: false` |

The final audit lists 8 inherited groups, all `introduced: false`: notification-dispatch.ts 1104-1114/1150-1160; install-flow.ts 1693-1727/2432-2462; plugin-resolver.ts 428-443/470-485; catalog-uat plugin-list.ts 93-123/270-300; enable-disable.messaging.ts 79-90 / install.messaging.ts 108-123; reinstall.messaging.ts 373-387 / apply-outcomes.ts 666-680; info.ts 2180-2194/2290-2304; install-flow.ts 838-849 / uninstall.ts 933-944.

`rg -n "fallow-ignore" extensions tests scripts | wc -l` prints 22; CONVENTIONS.md states 22 (6 unused-file, 2 unused-export, 2 private-type-leak, 1 unused-type, 1 unused-class-member, 10 code-duplication). `.fallowrc.json` `duplicates` is `{"threshold":3}`, with no `ignoredClones` key.

## Task Commits

1. **Task 1 (tracer): Phase 7 ledger.** `c3ee0035` (`docs(planning): record the docs-phase review dispositions`). Pre-commit log `PRECOMMIT_EXIT=0`; hook: gitlint Passed, `npm run check:commit` skipped (no build input). Tracer gate: the verify block is automated only; it passed before the commit and on re-run.
2. **Task 2: close the Phase 1-6 ledgers.** `a0ec3c7a` (`docs(planning): close the review dispositions with commits and reasons`). Pre-commit log `PRECOMMIT_EXIT=0`; hook: gitlint Passed, `npm run check:commit` skipped.
3. **Task 3: records and backlog.** `f47a2c9e` (`docs(planning): match the records to the code and close backlog items`). Pre-commit log `PRECOMMIT_EXIT=0`. The first commit attempt failed gitlint (title 73 > 72 characters), so nothing was committed; the shortened title passed gitlint, and `npm run check:commit` skipped.

## Final gates (HEAD f47a2c9e, Node v26.11.1)

- **Audit:** `npx fallow audit --base 369eaec3 --format json` (merge-base with origin/main): `verdict pass introduced 0 inherited 8`, dead code 0, complexity 0. The `ignoredClones` check exits 0.
- **Ledger check:** both Task 2 commands exit 0 over all seven ledgers; the Task 3 records grep chain exits 0.
- **Full check:** `PI_MCP_ADAPTER_ROOT=... PI_SUBAGENTS_ROOT=... TMPDIR=/var/tmp/mcp4-p8-21 npm run check` ends with `Merged LCOV: coverage/direct.lcov (270 records)` and `CHECK_EXIT=0` (second run). The first run exited 1 in direct coverage: `tests/bridges/hooks/dispatch-exec.test.ts` "contains an async delegate rejection from its failing diagnostic sink" (`false !== true` at :1269, with an unhandled rejection from the test at :1079). Neither that test nor `bridges/hooks/dispatch-exec.ts` changed on this branch. The pair passed 4 of 4 runs alone (`Direct coverage passed: ... (branches 55/55, functions 18/18, lines 479/479)`), and the full rerun passed. The failed log is kept at `/var/tmp/mcp4-p8-21/check-run1-failed.log`.
- After the check, only planning Markdown changed (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md, WINDOWS.md), so the result applies to the final tree under the local-verification reuse rule.

## Deviations from Plan

**1. CONVENTIONS.md unchanged.** The plan lists it in `files_modified`, but its suppression total (22) already matches `rg`, and 08-11 and 08-15 added no marker (08-11 left r8 inherited; 08-15 removed r11 and r14 by extraction). No edit was needed.

**2. Broken-windows entry 90 routed to a carrier.** 08-19 recorded a `deviation` entry for `domain/dependency-closure.ts`. Following the verifier-deferrals rule, BACKLOG.md gains ROOTKEY-01 with the evidence (the closure root check runs before the resolver; `TOKEN_PATTERN` needs a leading letter or digit; the pinned case in `tests/integration/reserved-record-keys.test.ts`), and the entry is waived through `gsd-tools windows waive 90` with a pointer to ROOTKEY-01. The code is not changed.

**3. MCPOVR-01 closing paragraph cites `57182472`.** That 08-10 commit holds the pi-mcp-adapter 5.2.0 conformance case for a stored server choice; the 08-10 Findings table did not list it, so I found it with `git log -G'D-08-02'` on the conformance test.

**4. TMPDIR for the full check.** The plan's verify line uses `/var/tmp/mcp4-p8`; the executor rules require `/var/tmp/mcp4-p8-21`, which I used.

**5. Commit `8578407a` (from the previous plan) has no attribution trailers.** History cannot be rewritten, so it stays as it is; noted here only.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: .planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md
- FOUND: c3ee0035, a0ec3c7a, f47a2c9e (ancestors of HEAD)

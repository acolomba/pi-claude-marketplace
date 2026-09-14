---
gsd_state_version: "1.0"
milestone: test-backlog
milestone_name: test-backlog
status: executing
last_updated: "2026-09-14T15:37:44+00:00"
last_activity: 2026-09-14
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 38
  completed_plans: 10
  percent: 50
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-13 after the refine-unit-tests milestone)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Execute production export ownership; plan the static member and coverage metric gates.

## Current Position

Phase: 5 of 8 — Production Export Ownership
Plan: 05-01 — real Fallow controls and complete production census
Status: Executing
Last activity: 2026-09-14 — Phases 3 and 4 committed and independently verified; Phase 5 approved for execution

### Historical refine-unit-tests closeout: `override_closeout`

Two reasons, neither an outcome failure.

1. **`init.manager` reports eight of nine phases `stale`.** This is a timestamp
   verdict, not an outcome verdict. Their `covered_files` include
   `REQUIREMENTS.md`, `ROADMAP.md` and `STATE.md`, which every later plan rewrites,
   so re-verifying re-stales them and the loop never converges. All nine
   `VERIFICATION.md` files read `status: passed` with full scores.
2. **Four open artifacts were acknowledged at close.** Known verification
   overrides: **4 newly acknowledged, 17 carried forward** from a prior close.

## Known Risk Worth Revisiting

`IN-03` from the Phase 9 code review. **NFR-10 path containment now rests on an
injected collaborator honoring a prose-only contract that nothing type-enforces.**
`IN-01` and `IN-04` are also open by choice but carry no comparable risk.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first.

| Category       | Item                                                                                                                                                                                          | Status          | Deferred At          | Milestone |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | --------- |
| quick_tasks    | 260907-qqo-hkps-01-if-field-powershell-rule-prefix-                                                                                                                                           | unknown (work is complete; scanner misreads it) | 2026-09-13 | refine-unit-tests |
| deferred_items | 06/deferred-items.md: 1. Stale notification hub reference outside Plan 06-19 callers                                                                                                          | acknowledged — RESOLVED, condition no longer holds | 2026-09-13 | refine-unit-tests |
| deferred_items | 06/deferred-items.md: 2. Node 26 direct-coverage negative-control subprocess capture                                                                                                          | acknowledged — promoted to backlog `NEGCTL-01` | 2026-09-13 | refine-unit-tests |
| deferred_items | 25/deferred-items.md (archived v1.4.1): `tests/e2e/import-command.test.ts` 3 failures                                                                                                         | acknowledged — promoted to backlog `E2EIMP-01` | 2026-09-13 | refine-unit-tests |
| Tooling        | Detect unused code and unused type members — no gate reports a type member nothing reads (measured: typecheck, lint, and fallow all pass with one planted)                                    | Pending         | Phase 116 discussion | v1.19     |
| quick_tasks    | 260720-d8i-move-agent-provenance-from-body-comment-                                                                                                                                           | unknown         | 2026-09-04           | v1.19     |
| todos          | 2026-09-02-detect-unused-code-and-type-members.md                                                                                                                                             | (presence-only) | 2026-09-04           | v1.19     |
| uat_gaps       | 89/89-UAT.md (archived v1.16)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 63/63-UAT.md (archived v1.13)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX-2.md (archived v1.12)                                                                                                                                                           | all_fixed       | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX.md (archived v1.12)                                                                                                                                                             | all_fixed       | 2026-09-04           | v1.19     |
| deferred_items | 112/deferred-items.md: Phase 112 deferred items - `npm run check` reaches `format:check` but reports pre-existing format differences in user-owned, untracked `.mcp.json` and                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 1. Stale test path in an `install.messaging.ts` doc comment                                                                                                            | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 2. Stale byte-form-lock path in the output catalog                                                                                                                     | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 3. Stale `tests/helpers/` references throughout the codebase map                                                                                                       | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 4. RESOLVED - `--all` cannot complete: the seven D-116-01a shortfalls are accepted                                                                                     | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 5. RESOLVED - The PATH interpreter was upgraded mid-phase and reddened 11 tests                                                                                        | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 6. RESOLVED - The direct-coverage sweeps still have no automated control                                                                                               | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 90/deferred-items.md (archived v1.17): 90-03 execution — pre-existing pi-subagents global-peer environment failure                                                                            | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 86/deferred-items.md (archived v1.15): pre-existing integration test failures, identical on the base commit                                                                                   | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 85/deferred-items.md (archived v1.14): pre-existing integration-test failures, unrelated to the phase                                                                                         | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 50/deferred-items.md (archived v1.11): pre-existing reinstall README documentation gap                                                                                                        | acknowledged    | 2026-09-04           | v1.19     |

### The phase-25 table limitation is FIXED

v1.19's close disclosed one item the tool could not suppress: phase 25's deferred
items lived in a markdown **table**, and the scanner synthesizes a row's `text` by
joining cells with a spaced hyphen while the file stores them with a spaced vertical
bar — so the `acknowledge` writer's literal-text search could never match, and it
refused with `no deferred item matched --text`. That row was disclosed here instead
and was expected to resurface at every future close.

It did resurface, and it is now closed. At this milestone's close the row was
converted to the bullet shape the writer understands, **with every cell preserved
verbatim**, and it acknowledged cleanly. Any future table-shaped deferred item will
hit the same wall; convert it rather than re-disclosing it.

## Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
| --- | --- | --- | --- | --- | --- |
| 260913-uwq | Gate and commit the issue-179 fix: agents omitting `tools:` inherit Pi's defaults, and the two dropped agent fields get targeted guidance | 2026-09-13 | a9186816 | Complete | [260913-uwq-issue-179-agent-tools-and-mcpservers-con](./quick/260913-uwq-issue-179-agent-tools-and-mcpservers-con/) |
| 260913-ttl | Close the remaining SonarQube branch-coverage gap to reach 100% line and 100% branch coverage | 2026-09-13 | d2ef20fa..46815bd6 | Complete | [260913-ttl-close-the-remaining-sonarqube-branch-cov](./quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/) |
| 260913-r2h | Make a FIFO state-harness over-read fail loudly instead of hanging to the test timeout | 2026-09-13 | c45850af | Complete | [260913-r2h-make-a-fifo-harness-over-read-fail-loudl](./quick/260913-r2h-make-a-fifo-harness-over-read-fail-loudl/) |
| 260913-n7w | Fix the FIFO state server so each reader open receives exactly one payload | 2026-09-13 | e4f12cce | Complete | [260913-n7w-fix-the-fifo-state-server-reader-pairing](./quick/260913-n7w-fix-the-fifo-state-server-reader-pairing/) |
| 260913-l07 | Fix every remaining zizmor finding, drop the severity floor, and simplify the gate comments | 2026-09-13 | 729348b4 | Complete | [260913-l07-fix-remaining-zizmor-findings-and-simpli](./quick/260913-l07-fix-remaining-zizmor-findings-and-simpli/) |
| 260913-f6a | Gate the two SonarQube workflow findings, githubactions:S6505 and githubactions:S7637 | 2026-09-13 | 8a8a0396..69797ebc | Complete | [260913-f6a-gate-sonar-workflow-findings-s6505-and-s](./quick/260913-f6a-gate-sonar-workflow-findings-s6505-and-s/) |

## Session Continuity

**Current work:** test-backlog on `features/test-backlog`. Phases 1–4 are complete;
Phase 5 is approved for execution. Phase 6 planning and Phase 7 coverage research
continue. Earlier milestone continuity is preserved in
`inputs/test-backlog/PRE-MILESTONE-STATE.md` and archived milestone artifacts.

### Known snag for the next close

`gsd-tools query phase.complete` and the state verbs refuse in this checkout: they
see `.planning/workstreams/` and demand `--ws`, but this milestone's ROADMAP and
STATE were the ROOT files and no workstream is named `refine-unit-tests`. Hand-edit
and verify by diff. Two further CLI gaps were worked around at this close and will
recur: `milestone complete` leaves the original-path deletions **unstaged**
(`git add -u .planning/`), and it wrote `completed_phases: 1` / `percent: 11` for a
9-of-9 milestone, which was corrected by hand.

## Operator Next Steps

- Execute Phase 5 in approved dependency waves, retaining public assertions and exact coverage.
- Complete Phases 6–8; reconcile every authorized item before milestone close.

## Active Session — test-backlog

- Authorized: all ten handoff items; Phase numbering restarts at 1.
- Preserve local quick task 260914-dz1 and configuration/setup edits.
- Marketplace decision: add/document --local on info/list/update; keep merged reads and use local only for config writes.
- Agent collision decision: preserve full source names like Claude; keep both agents and migrate owned generated names on reinstall/update.
- Phase 1: complete, independently reviewed and verified 5/5.
- Phase 2: complete, independently verified 4/4; all pre-commit checks passed.
- Phase 3: complete in b663bc68; review clean and independent verification 18/18.
- Phase 4: complete in a8ef0dac; review clean and independent verification 7/7.
- Next: execute Phase 5; complete Phase 6 planning and plan Phase 7.

### Live baseline correction

Initial measurement: 6003/6003 tests passed, with four production lines and one
branch uncovered in agents/convert.ts. Phase 3 Plan 1 removed a redundant
unreachable throw by carrying the existing runtime validation in the type.
Current measurement: 6267/6267 tests pass; production lines 63374/63374,
functions 1851/1851, branches 9145/9145. Integration: 32/32 passed. The obsolete converter direct pin was
removed after its owner reached 100%; the two unrelated direct pins remain.

GSD phase.complete still refuses this root milestone because archived
workstream directories exist. Phase 1–4 tracking was updated in the authorized
root files and checked by diff; archived workstreams were preserved.

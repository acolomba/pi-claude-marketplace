---
gsd_state_version: "1.0"
milestone: refine-unit-tests
milestone_name: Refine Unit Tests
status: Awaiting next milestone
stopped_at: "Milestone closed and archived. PR #181 is open and unmerged by operator decision."
last_updated: "2026-09-13T16:10:00.000Z"
last_activity: 2026-09-13
last_activity_desc: Quick task 260913-l07 cleared every remaining zizmor finding
state_head: 3580c7d14af502bb966c30b9420a9c39313798e2
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 213
  completed_plans: 213
  percent: 100
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-13 after the refine-unit-tests milestone)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** None. No milestone is active — define the next one with
`/gsd-new-milestone`.

## Current Position

Milestone `refine-unit-tests` closed 2026-09-13: 9 of 9 phases, 213 of 213 plans,
412 tasks. Every phase reads `verification_status: passed`. The milestone audit
passed with no blockers — requirements 30/30, phases 9/9, integration 6/6.

The milestone's full narrative now lives in its archive rather than here. This file
was reset at close so the next milestone starts from a readable state:

- **Entry:** [`.planning/MILESTONES.md`](MILESTONES.md) — the curated summary,
  driver, accomplishments, closeout type, and accepted gaps.
- **Detail:** `.planning/milestones/refine-unit-tests-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`,
  with phase directories under `refine-unit-tests-phases/` and quick tasks under
  `refine-unit-tests-quick/`. That bucket holds the 14 tasks done inside this
  milestone's window. The 29 older ones the close had swept in with them were
  filed under `v1.19-quick-tasks/` instead, by date against v1.19's ship date.
- **Carried forward:** [`.planning/ROADMAP.md`](ROADMAP.md) — what the next
  milestone inherits, with evidence for each item.

### Closeout type: `override_closeout`

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
| 260913-l07 | Fix every remaining zizmor finding, drop the severity floor, and simplify the gate comments | 2026-09-13 | 729348b4 | Complete | [260913-l07-fix-remaining-zizmor-findings-and-simpli](./quick/260913-l07-fix-remaining-zizmor-findings-and-simpli/) |
| 260913-f6a | Gate the two SonarQube workflow findings, githubactions:S6505 and githubactions:S7637 | 2026-09-13 | 8a8a0396..69797ebc | Complete | [260913-f6a-gate-sonar-workflow-findings-s6505-and-s](./quick/260913-f6a-gate-sonar-workflow-findings-s6505-and-s/) |
| 260909-h38 | Make three cross-process concurrency tests deterministic with a FIFO state.json barrier | 2026-09-09 | 147b63f4 | Complete | [260909-h38-make-three-cross-process-concurrency-tes](./quick/260909-h38-make-three-cross-process-concurrency-tes/) |

## Session Continuity

**Stopped at:** Milestone `refine-unit-tests` closed and archived on 2026-09-13.

**PR #181 is open and unmerged, by operator decision.** All nine checks pass,
`mergeStateStatus` is `CLEAN`, the SonarCloud quality gate reads `OK`, and the pull
request carries **zero open issues of any rule**, down from 38. The milestone closed
with its branch unmerged; that is deliberate, not an oversight.

Last session: 2026-09-13 — repaired this file's stale session-continuity section,
closed the four outstanding SonarCloud findings, then closed the milestone.

**Next:** `/gsd-new-milestone`.

### Known snag for the next close

`gsd-tools query phase.complete` and the state verbs refuse in this checkout: they
see `.planning/workstreams/` and demand `--ws`, but this milestone's ROADMAP and
STATE were the ROOT files and no workstream is named `refine-unit-tests`. Hand-edit
and verify by diff. Two further CLI gaps were worked around at this close and will
recur: `milestone complete` leaves the original-path deletions **unstaged**
(`git add -u .planning/`), and it wrote `completed_phases: 1` / `percent: 11` for a
9-of-9 milestone, which was corrected by hand.

## Operator Next Steps

- Start the next milestone with `/gsd-new-milestone`
- Merge PR #181 whenever you choose — nothing in the close depends on it

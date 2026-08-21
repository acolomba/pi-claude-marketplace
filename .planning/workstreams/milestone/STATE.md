---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: Manifest-Independent Installed Plugin Info
status: Awaiting next milestone
stopped_at: "Quick task 260818-k7f landed on features/pi-coding-agent-0-84-2 (commit b6414110), awaiting PR; v0.16.0 released"
last_updated: "2026-08-18T18:45:52.000Z"
last_activity: 2026-08-18
last_activity_desc: "Completed quick task 260818-k7f: Bump pi-coding-agent to 0.84.2 and handle the deferred stop reason"
current_phase: 100
current_phase_name: disabled-plugin-information-retention
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 29
  completed_plans: 29
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-12 after v1.18 close)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.
**Current focus:** Planning next milestone. v1.18 shipped 2026-08-12 (PR #120
squash-merged 2026-08-12, npm 0.14.0 released). Post-milestone work has run as
quick tasks; PR #132 (`features/fallow-full-gate`) carries the fallow gate and
is green awaiting squash-merge.

## Current Position

Phase: Milestone v1.18 complete (Phases 95-100 archived to
.planning/milestones/v1.18-phases/)
Plan: —
Status: Awaiting next milestone
Last activity: 2026-08-19 - Completed quick task 260819-r3k: Land PR #138, hook timeout read as seconds

## Milestone Summary

v1.18 Manifest-Independent Installed Plugin Info shipped 2026-08-12 — 6 phases
(95-100), 29 plans, 64 tasks, 32/32 requirements satisfied; milestone audit
passed (6/6 phases, 5/5 integration seams, 3/3 flows, `threats_open: 0`);
Phase 100 closed on live human UAT against Pi 0.84.1 (3/3, zero issues). Full
detail: .planning/milestones/v1.18-ROADMAP.md,
.planning/milestones/v1.18-REQUIREMENTS.md, and the entry in
.planning/MILESTONES.md.

An installed plugin now stays visible, inspectable and uninstallable after its
marketplace manifest stops declaring it; a disabled partially-installed plugin
is recognized as disabled again; and a disabled plugin keeps describing itself.

Known tech debt carried out of the milestone (recorded in
milestones/v1.18-MILESTONE-AUDIT.md): 99-VALIDATION.md and 100-VALIDATION.md
were both left at `status: draft` — seeded by plan-phase, never promoted by
`/gsd-validate-phase`, so neither `nyquist_compliant: false` is authoritative
(coverage itself is asserted independently by each phase's VERIFICATION.md).
One stale test comment at
tests/orchestrators/plugin/list-manifest-absent.test.ts:179 still states the
retired ENBL-04 definition; named and deliberately deferred by the phase's own
review loop, confirmed harmless. Three rare-failure arms in reinstall/install
remain uncovered, each with its unreachability reason recorded in
99-07-SUMMARY.md.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260807-q0v | amend v1.18 planning docs per two-review validation findings | 2026-08-07 | d76b4f6 | [260807-q0v-amend-v1-18-planning-docs-per-two-review](./quick/260807-q0v-amend-v1-18-planning-docs-per-two-review/) |
| 260807-ur3 | bring disabled-partial classification repair into v1.18 scope | 2026-08-07 | d543f74 | [260807-ur3-bring-disabled-partial-classification-re](./quick/260807-ur3-bring-disabled-partial-classification-re/) |
| 260808-dhm | amend v1.18 requirements for LLM tool-surface reason widening | 2026-08-08 | 74df349 | [260808-dhm-amend-v1-18-requirements-for-llm-tool-su](./quick/260808-dhm-amend-v1-18-requirements-for-llm-tool-su/) |
| 260814-a7m | Add GitLab OAuth Device Flow authentication support (GAUTH-02) | 2026-08-14 | 52f78f56 | [260814-a7m-add-gitlab-oauth-device-flow-authenticat](./quick/260814-a7m-add-gitlab-oauth-device-flow-authenticat/) |
| 260814-fqf | Withdraw SRCP-01 backlog item -- upstream rejects bare GitLab shorthand too | 2026-08-14 | 7bbefc4a | [260814-fqf-correct-backlog-md-item-srcp-01-based-on](./quick/260814-fqf-correct-backlog-md-item-srcp-01-based-on/) |
| 260814-hdc | Fix GitLab (and any non-GitHub url-kind) clone .git-suffix bug | 2026-08-14 | 82aa35cb | [260814-hdc-fix-a-real-bug-in-the-gitlab-and-any-non](./quick/260814-hdc-fix-a-real-bug-in-the-gitlab-and-any-non/) |
| 260815-h7g | Adopt fallow static analysis as a linting gate | 2026-08-15 | 1d4f478b..a93d2be9 | [260815-h7g-adopt-fallow-static-analysis-as-a-lintin](./quick/260815-h7g-adopt-fallow-static-analysis-as-a-lintin/) |
| 260815-p25 | Remove the bridges/hooks circular-dependency knot and gate cycles locally | 2026-08-15 | cee12150 | [260815-p25-implement-hooks-cycle-removal-from-spike](./quick/260815-p25-implement-hooks-cycle-removal-from-spike/) |
| 260816-qov | Make fallow a full uniform static-analysis gate with zero categorical exclusions | 2026-08-16 | 345b325e..HEAD (PR #132) | [260816-qov-make-fallow-a-full-uniform-static-analys](./quick/260816-qov-make-fallow-a-full-uniform-static-analys/) |
| 260818-k7f | Bump pi-coding-agent to 0.84.2 and handle the deferred stop reason | 2026-08-18 | b6414110 | [260818-k7f-bump-pi-coding-agent-to-0-84-2-and-handl](./quick/260818-k7f-bump-pi-coding-agent-to-0-84-2-and-handl/) |
| 260819-bs8 | GitHub release automation and Codex config tracking | 2026-08-19 | 2c19c8cb | [260819-bs8-github-release-automation-and-codex-conf](./quick/260819-bs8-github-release-automation-and-codex-conf/) |
| 260819-r3k | Land PR #138: hook timeout read as seconds (@rakesh-vs) | 2026-08-19 | 2fbaaca3..HEAD (PR #138) | [260819-r3k-land-pr-138-hook-timeout-seconds-units](./quick/260819-r3k-land-pr-138-hook-timeout-seconds-units/) |

## Decisions

The v1.18 decision log is folded into PROJECT.md Key Decisions (D-96-02
own-manifest authority, ENBL-05 single-axis disabled predicate, ENBL-18 disable
retains inventory, and `hookEntries` as an additive record key). No open
decisions.

## Deferred Items

**None carried.** This is a `verified_closeout`: all six phases hold
`verification_status: passed`, and every item the pre-close artifact audit
flagged was resolved rather than acknowledged. The seven carryover items that
had been re-acknowledged unchanged at the v1.14, v1.16 and v1.17 closes are now
closed or relocated:

| Category | Item | Disposition at the v1.18 close |
|----------|------|--------------------------------|
| backlog | REASON-01 — unify parse-error reasons under a `{malformed <feature>}` family | Lives in BACKLOG.md; not an open artifact |
| debug | async-rewake-lane-inert | Concluded diagnose-only; filed under debug/resolved/ |
| debug | knowledge-base | Not a session — the knowledge base itself; marked `status: resolved` so the scanner stops counting it |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | Landed long ago; SUMMARY gained the missing `status: complete` |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | Landed long ago; SUMMARY gained the missing `status: complete` |
| todo | 2026-08-10 coverage exclusion versus tests for the out-of-bound orchestrators | Promoted to BACKLOG.md as COV-01; todo moved to todos/completed/ |
| seed | SEED-001-remote-plugin-status-fetch-verb | Promoted to BACKLOG.md as the RSTA/FTCH entry; seed marked `status: promoted` and kept as the planting record |

The Phase 95 deferred pair (two pi-subagents integration suites failing on a
stale global peer) was fixed, not deferred: upgrading the global install from
0.24.3 to 0.47.1 — above the `>=0.35.0` floor — took `npm run test:integration`
from 16/18 to 18/18 with no source change.

## Operator Next Steps

- Merge PR #132 (`gh pr merge --squash`) -- the fallow whole-repo gate. Green
  on all 8 checks with a passing SonarQube gate and 0 open issues.
- Then work the open PR queue: #130 (`defaultEnabled`, 1 check failing) and the
  dependabot set #133/#134/#135 (green, merge serially), #136 (2 failing).
  #95 (typescript 7.0.2) is the known skip.

- Start the next milestone with /gsd-new-milestone. BACKLOG.md carries two
  promoted candidates: RSTA/FTCH (remote plugin status + fetch verb, a
  ready-made 13-requirement set) and COV-01 (coverage exclusion policy plus the
  two out-of-bound orchestrators).

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |

## Session

**Last session:** 2026-08-18T18:45:52.000Z
**Stopped at:** Quick task 260818-k7f landed on features/pi-coding-agent-0-84-2 (commit b6414110); PR #132 still awaiting squash-merge
**Resume file:** None

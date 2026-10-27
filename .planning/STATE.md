---
gsd_state_version: "1.0"
milestone: plugin-lifecycle
milestone_name: Marketplace and Plugin Lifecycle Backlog
current_phase: 1
current_phase_name: Staging Warning Channels
status: executing
stopped_at: Completed 01-01-PLAN.md
last_updated: "2026-10-27T07:27:42.703Z"
last_activity: 2026-10-26
last_activity_desc: Phase 1 execution started
state_head: 605913f34594b1598080941e30589094a80670a2
progress:
  total_phases: 11
  completed_phases: 0
  total_plans: 8
  completed_plans: 7
  percent: 0
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-22 at the lifecycle-coverage start)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 1 — Staging Warning Channels

## Current Position

Phase: 1 (Staging Warning Channels) — EXECUTING
Plan: 8 of 8
Status: Ready to execute
Last activity: 2026-10-26 — Phase 1 execution started


### mcp-4 closeout

Completed 2026-10-10 on `features/mcp-4` and merged to main the same day as
PR #250; released as npm 0.20.0 (tag `v0.20.0`, D-07-11). 8/8 phases (`01/`
to `08/`), 73 plans, 41/41 requirements. The first audit read `tech_debt`;
`08/` cleared it, and the re-audit passed (12/12 integration seams, 6/6 flows,
Nyquist compliant on all eight phases, `threats_open: 0`). It was a verified
close, so no verification override was acknowledged. The archive is
`.planning/milestones/mcp-4-*`, with phase and quick-task records under
`milestones/mcp-4-phases/` and `milestones/mcp-4-quick/`. Its decisions are
kept under `### mcp-4 decisions` below.

Carried items:

- `ROOTKEY-01` in `BACKLOG.md` (WINDOWS #90, waived): `install __proto__@<mp>`,
  and any root plugin name outside the dependency token alphabet, is refused
  with a misleading dependency cause.
- From the mcp-4 `05/` session notes, not re-checked since: the user-scope
  plugin record was moved aside to
  `~/.pi/agent/pi-claude-marketplace/state.json.broken-20261008`; run `/reload`
  or reinstall `plugin-dev@claude-plugins-official` in Pi to recreate it.

### workflows-replay closeout

Completed 2026-09-21 with no accepted debt: 46/46 requirements, 9/9 phases
verified, `threats_open: 0`, Nyquist-validated. All twelve
`[workflows-replay]` broken-window entries are fixed or waived with named
`BACKLOG.md` carriers (VSTALE-01, WLREC-01, RLHINT-01, PCERR-01, WSTOR-01,
WPIN-01).

The bridge reached `main` in PR #205 (`5c652697`) on 2026-09-24. The `0.19.x`
tags deliberately exclude it: they were cut from `releases/v0.19.2`, which PR
#216 then merged back into `main`. No release action is outstanding — whatever
is cut from `main` next carries workflows by construction.

### test-backlog closeout: `override_closeout`

Shipped 2026-09-18, no npm release. All eight phases read `status: passed`
(5/5, 4/4, 18/18, 7/7, 10/10, 2/2, 8/8, 7/7); the audit is `tech_debt` with no
blockers (requirements 18/18, phases 8/8, integration 9/9, flows 2/2). Two
override reasons, neither an outcome failure:

1. **`init.manager` reports every phase `stale`** because each `covered_files`
   list names `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md`, which every later
   close rewrites. Third milestone with this artifact.
2. **Two artifacts acknowledged at close** (the `05/` and `06/` deferred-item
   records). Known verification overrides: **2 newly acknowledged, 16 carried
   forward**.

The refine-unit-tests close (2026-09-13) carried the same shape: 4 newly
acknowledged, 17 carried forward, and the phase-25 table conversion.

### Known snags for the next close

- `phase.complete` drops `current_phase_name`, resets Current Position to
  `Plan: Not started`, and rewrites the historical `Stopped at:` line under an
  older heading. Restore by hand and check with `git diff`.
- `milestone complete` leaves every original-path deletion **unstaged**
  (`git add -u .planning/phases .planning/quick`) and writes 40 verbose
  accomplishment bullets that need a hand rewrite. `.planning/workstreams/` no
  longer exists, so the verb runs; the earlier `--ws` refusal is gone.
- The `audit-open` line parser stops at a frontmatter list item that begins
  with a backtick, so a complete quick task reads `unknown`, and the
  acknowledge writer then **replaces the whole frontmatter** with its marker.
  Quote the scalar instead of acknowledging; restore the file from git if the
  writer already ran.
- A table-shaped deferred item still cannot be acknowledged; convert it to
  bullets with every cell preserved.
- `state.advance-plan` resets `Status:` and rewrites a historical `Stopped at:`
  line; re-read STATE.md after every state verb.
- **Name an archived phase by its directory token (`05/`, `09/`), never
  `Phase 5`.** `/gsd-health`'s W002 archived-phase exemption matches
  `^v\d+.*-phases$` only, so `test-backlog-phases`,
  `refine-unit-tests-phases`, `url-source-phases` and every `ws-*` workstream
  archive are invisible to it: a `Phase N` token from one of those reads as an
  undeclared phase as soon as N leaves ROADMAP.md. The directory form says the
  same thing, more precisely, and the check stays quiet. Do not re-add a phase
  checklist to ROADMAP.md to silence it — that trades each W002 for a W006.
- **Do not zero the `progress:` block between milestones.** The 9/9 phases and
  39/39 plans are workflows-replay's, not root scope's, but 0 routes worse:
  `smart-entry` tests `total_phases <= 0` first and recommends
  `/gsd-discuss-phase` for a phase that does not exist. Measured both ways.

## Known Risk Worth Revisiting

`IN-03` from the refine-unit-tests `09/` code review. **NFR-10 path containment now rests on an
injected collaborator honoring a prose-only contract that nothing type-enforces.**
`IN-01` and `IN-04` are also open by choice but carry no comparable risk.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first.

| Category       | Item                                                                                                                                                                                          | Status          | Deferred At          | Milestone |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | --------- |
| todos          | 2026-10-13-cucumber-rules-trial.md: try the cucumber rules on another repository (§3; reviewed in Phase 10 and not folded) | acknowledged — still pending | 2026-10-21 | marketplace-features |
| deferred_items | 07/deferred-items.md: DEP-07-03-01 brace-expansion advisory in the root Pi tree; TEST-07-06-01 optional pi-subagents resolver skip | acknowledged — carried as BACKLOG DEPADV-01; WINDOWS #92 (was #89 before the main merge) | 2026-10-11 | json-output |
| deferred_items | 08/deferred-items.md: DEF-08-04-01 `windows status --pick` fails when stdout is a pipe | acknowledged — upstream gsd-tools, out of scope | 2026-10-11 | json-output |
| deferred_items | 05/deferred-items.md: the record (five open comment-drift items, three closed; the scanner reads the file as one entry)                                                                | acknowledged    | 2026-09-18           | test-backlog |
| deferred_items | 06/deferred-items.md: Six ledger notes name a witness coordinate the fresh report no longer holds (table converted to bullets at this close; item 1 was resolved by the #196 hermetic merge)  | acknowledged    | 2026-09-18           | test-backlog |
| quick_tasks    | 260907-qqo-hkps-01-if-field-powershell-rule-prefix-                                                                                                                                           | unknown (work is complete; scanner misreads it) | 2026-09-13 | refine-unit-tests |
| deferred_items | 06/deferred-items.md: 1. Stale notification hub reference outside Plan 06-19 callers                                                                                                          | acknowledged — RESOLVED, condition no longer holds | 2026-09-13 | refine-unit-tests |
| deferred_items | 06/deferred-items.md: 2. Node 26 direct-coverage negative-control subprocess capture                                                                                                          | acknowledged — promoted to backlog `NEGCTL-01` | 2026-09-13 | refine-unit-tests |
| deferred_items | 25/deferred-items.md (archived v1.4.1): `test/e2e/import-command.test.ts` 3 failures                                                                                                         | acknowledged — promoted to backlog `E2EIMP-01` | 2026-09-13 | refine-unit-tests |
| Tooling        | Detect unused code and unused type members — no gate reports a type member nothing reads (measured: typecheck, lint, and fallow all pass with one planted)                                    | closed — test-backlog `06/` (06-VERIFICATION 2/2); gate `lint:type-members` in `check` | Phase 116 discussion | v1.19     |
| quick_tasks    | 260720-d8i-move-agent-provenance-from-body-comment-                                                                                                                                           | unknown         | 2026-09-04           | v1.19     |
| todos          | 2026-09-02-detect-unused-code-and-type-members.md                                                                                                                                             | (presence-only) | 2026-09-04           | v1.19     |
| uat_gaps       | 89/89-UAT.md (archived v1.16)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 63/63-UAT.md (archived v1.13)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX-2.md (archived v1.12)                                                                                                                                                           | all_fixed       | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX.md (archived v1.12)                                                                                                                                                             | all_fixed       | 2026-09-04           | v1.19     |
| deferred_items | 112/deferred-items.md: Phase 112 deferred items - `npm run check` reaches `format:check` but reports pre-existing format differences in user-owned, untracked `.mcp.json` and                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 1. Stale test path in an `install.messaging.ts` doc comment                                                                                                            | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 2. Stale byte-form-lock path in the output catalog                                                                                                                     | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 3. Stale `test/helpers/` references throughout the codebase map                                                                                                       | acknowledged    | 2026-09-04           | v1.19     |
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
| 1 | Run init.sh in new worktrees: SessionStart guard keyed on node_modules/.init-done (7f4c2178) | 2026-10-24 | 7f4c2178 | — | — |
| 2 | APPLYTHROW-01: report the changes an apply made before it failed | 2026-10-25 | 20ee9b25 | complete | [261025-j40](./quick/261025-j40-report-the-changes-an-apply-made-before-/) |
| 3 | APPLY1-01: move a plugin and its newer dependency in one apply | 2026-10-25 | a777b12f | complete | [261025-n1z](./quick/261025-n1z-move-a-plugin-and-its-newer-dependency-i/) |
| 261025-vf1 | UPD-DEP-D1: settle the dependencies of every version a plugin moves to | 2026-10-26 | 1daa12d0 | complete | [261025-vf1-resolve-the-new-version-s-dependency-clo](./quick/261025-vf1-resolve-the-new-version-s-dependency-clo/) |
| 261026-26d | UPDDEP-REVIEW: plan every dependency move before the first write | 2026-10-26 | 6d57cb9a | complete | [261026-26d-plan-dependency-moves-before-any-write](./quick/261026-26d-plan-dependency-moves-before-any-write/) |
| 261026-c06 | Lifecycle-coverage leftovers: a lost state lock, apply dependency judgement, cross-marketplace trust | 2026-10-26 | 82ef8cac | complete | [261026-c06-fix-lock-compromise-apply-dependency-jud](./quick/261026-c06-fix-lock-compromise-apply-dependency-jud/) |
| 261026-gv1 | GV-01: record git plugin versions as Claude Code does; errno wording per Node; two Sonar findings | 2026-10-26 | cf2a1c37 | complete | [261026-gv1-record-git-plugin-versions-as-claude-code](./quick/261026-gv1-record-git-plugin-versions-as-claude-code/) |
| 261026-gvt | GV-01: record plugins at a range-selected release tag as Claude Code does, the tag semver kept as resolvedVersion | 2026-10-26 | 2638b001 | complete | [261026-gvt-record-plugins-at-release-tags-as-claude-code](./quick/261026-gvt-record-plugins-at-release-tags-as-claude-code/) |
| 261026-glv | GV-01: an update with no tag drops the tag commit from the record; plugin directory plugins pick no release tag and their listed copy answers the range | 2026-10-26 | 33c9ac69 | complete | [261026-glv-match-claude-code-on-untagged-updates-an](./quick/261026-glv-match-claude-code-on-untagged-updates-an/) |
| 261026-dpt | GV-01: a pinned plugin directory plugin at its listed commit is up to date before the range check; its refusal names every requirer, MISS-01 included; list and completion compare the recorded version string | 2026-10-26 | ece42b45 | complete | [261026-dpt-match-claude-code-on-directory-pins-and](./quick/261026-dpt-match-claude-code-on-directory-pins-and/) |

## Session Continuity

**Last session:** 2026-10-27T04:05:22.055Z
**Stopped at:** Completed 01-01-PLAN.md
**Resume file:** None

**lifecycle-coverage (2026-10-22):** requirements and roadmap are defined on
`claude/plugin-lifecycle-coverage-b1d431`. Next: `/gsd-plan-phase 1` (Suite
Foundation). After Phase 1 lands, Phases 2-15 run in parallel; each depends on
Phase 1 only.

**Phase 8 closed (2026-10-20):** all five plans executed, Nyquist-compliant,
`threats_open: 0`, the code review fix loop closed 7 of 7 findings, and
`npm run check` exited 0 at `a393bead`; verification passed 12/12. The work
lives only in the worktree
`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests` on
`features/cucumber-behavioral-tests`, nothing pushed. Next:
`/gsd-autonomous --from 9 --interactive` from the worktree. Debts: the
codebase map is stale by 468 elements (advisory drift gate only); Phases 1-6
verifications are stale for the milestone audit; the un-numbered CHANGELOG
bullets are consolidated into one at PR time.

**Main merge (2026-10-11, quick task 261011-bsm):** `origin/main` at
`94160614` (#248, and #250, the mcp-4 milestone released as 0.20.0) is merged
into `features/json`, and main's MCP notices are ported to the run and
row-policy model. The WINDOWS.md ledger now holds 92 entries: 1-87 are shared,
88-90 are mcp-4's, and json-output's 88 and 89 were renumbered to 91 and 92
(open 0, waived 51, fixed 41). Dated archives keep the old numbers. The root
`.planning/research/` files are mcp-4's; json-output's research moved to
`milestones/json-output-research/`.

**Earlier work:** json-output on `features/json`. Phases 1 and 2 are complete
and verified. Phase 2's review-fix loop closed after three iterations with ten
findings fixed (CR-01, WR-01..WR-06, IN-01..IN-03); D-07 now records 29 approved
corpus replacements (29 / 2,632 / 2,661 against the original blob). The full
`npm run check` passed at `571b6883`. Phase 3 (Typed Raw Surfaces) has all 4
plans complete and is verified (11/11). Its review-fix loop converged clean
after three iterations (three gate warnings fixed in 95237f7c, 16f507cd,
13729cd8; four Info items open in 03-REVIEW-DISPOSITION.md). The full
`npm run check` passed at `13729cd8`; corpus 3134 present / 0 extra per the
D-17 ledger; catalog unchanged. Phase 4 (Wire Schema and JSON Strategy) has
all 5 plans executed; its review-fix loop converged clean at iteration 2 (CR-01
and WR-01..WR-05 fixed, WR-06 deferred to Phase 5 criterion 6, nine Info items
open in 04-REVIEW-DISPOSITION.md), and the full check passed on `ad5348ab`.
Verification found one gap (SC3 / PMOD-04: marketplace block names and other
subject names are not redacted). Gap-closure plan 04-06 is executed
(`c8a45a9b`, `5d988d7d`, SUMMARY `8c861f3b`): `resolveRows` redacts every block
and plugin row name, `presentNotification` redacts the marketplace-not-added
name, and AUTH-09 has three subject-name rows, each proven to fail before its
fix. Corpus 3143 present / 0 extra; catalog unchanged from `4e6c568a`. The
full-scope pre-commit (`npm run check` plus all-pair coverage) passed on the
exact code committed as `5d988d7d`. Phase 4 is now complete; its final re-verification is recorded below.

**Current resumption (2026-10-06):** Gap review iteration 2 confirmed all
three fixes. The distinct ledger IDs are CR-02, WR-07, WR-08, and IN-10.
The user accepted both conservative masking rules. Full `npm run check`
and corpus passed at `c5494971`, Node v26.10.0: 264 direct coverage pairs,
3149 corpus entries, zero extras. Validation covers 12 tasks and 10
requirements; security records 18 mitigated and four accepted threats, zero
open. Re-verification passed 5/5 with no code gaps. The user explicitly
confirmed all five prohibition assessments on 2026-10-06 ("sure");
`04-UAT.md` records 5/5 passed. Phase 4 is complete; Phase 5 discussion is
next. Current-session checks remain reusable while build inputs are unchanged.

**Corpus determinism (resolved by quick task 261002-dys):** prune rollback
now receives its backup-directory creator through `PruneRestoreOps`, so tests
name a fixed `prune-backup-ABC123`. The 8 prune.test.ts corpus entries that
held random suffixes were re-captured; `node scripts/notify-corpus.mjs check`
exits 0 (3,133 present, 0 extra). The D-17 ledger then removed 2 and added 3
entries, so the baseline holds 3,134. Later phases compare the catalog against
main's `8b6ac3bc` (or the latest merged main) rather than `e40d3dda`, because
#198 changed catalog bytes.

**Release context (unchanged):** The 0.19.1 and 0.19.2 releases are tagged and
published, PR #216 merged `releases/v0.19.2` back into `main`, and PRs #218 and
#219 landed after it. `main` carries the workflows bridge from PR #205, which no
tag includes yet. Handoffs for the earlier milestones moved into their archives
(`milestones/refine-unit-tests-HANDOFF*.md`,
`milestones/ws-defaults-enabled-2026-09-17/HANDOFF.md`) and the paused phase-117
handoff moved to `milestones/ws-workflows-2026-09-27/`. Earlier milestone
continuity is preserved in `inputs/test-backlog/PRE-MILESTONE-STATE.md` and
archived milestone artifacts.

## Operator Next Steps

- lifecycle-coverage is archived under `.planning/milestones/lifecycle-coverage-*`
  on `claude/plugin-lifecycle-coverage-b1d431`; nothing is pushed. Next: offer
  the version bump, then open the PR (squash).
- Follow-ups recorded at close: BACKLOG APPLY1-01 (one-run convergence for a
  co-shipped dependent), APPLYTHROW-01 (rows dropped when apply throws).
- Start the next milestone with /new-gsd-milestone.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 50 min | 3 tasks | 5 files |
| Phase 01 P02 | 80 min | 2 tasks | 11 files |
| Phase 01 P03 | 67 min | 2 tasks | 15 files |
| Phase 01 P04 | 122 min | 2 tasks | 42 files |
| Phase 01 P05 | 73 min | 2 tasks | 37 files |
| Phase 01 P06 | 74 min | 2 tasks | 25 files |
| Phase 01 P07 | 71 min | 2 tasks | 25 files |
| Phase 01 P08 | 51 min | 2 tasks | 22 files |
| Phase 01 P09 | 70 min | 2 tasks | 24 files |
| Phase 01 P10 | 67 min | 2 tasks | 23 files |
| Phase 01 P11 | 81 min | 2 tasks | 19 files |
| Phase 01 P12 | 62 min | 2 tasks | 27 files |
| Phase 01 P13 | 75 min | 2 tasks | 18 files |
| Phase 01 P14 | 77 min | 2 tasks | 17 files |
| Phase 01 P15 | 50 min | 2 tasks | 32 files |
| Phase 01 P16 | 78 min | 2 tasks | 26 files |
| Phase 03 P01 | 1h 17m | 2 tasks | 10 files |
| Phase 03 P02 | 1h 15m | 2 tasks | 10 files |
| Phase 03 P03 | 1h 13m | 2 tasks | 20 files |
| Phase 03 P04 | 1h 3m | 2 tasks | 4 files |
| Phase 04 P01 | 89min | 2 tasks | 15 files |
| Phase 04 P02 | 85min | 2 tasks | 20 files |
| Phase 04 P03 | 113min | 2 tasks | 17 files |
| Phase 04 P04 | 84min | 2 tasks | 9 files |
| Phase 04 P05 | 67 min | 2 tasks | 6 files |
| Phase 04 P06 | 83 min | 2 tasks | 6 files |
| Phase 05 P01 | 35 min | 2 tasks | 69 files |
| Phase 05 P02 | 33 min | 2 tasks | 51 files |
| Phase 05 P03 | 30 min | 2 tasks | 14 files |
| Phase 05 P04 | 25 min | 2 tasks | 30 files |
| Phase 05 P05 | 30 min | 2 tasks | 10 files |
| Phase 05 P06 | 29 min | 2 tasks | 8 files |
| Phase 05 P07 | 32 min | 2 tasks | 2 files |
| Phase 08 P01 | 28 min | 3 tasks | 1 files |
| Phase 08 P02 | 5 min | 2 tasks | 2 files |
| Phase 08 P03 | 4 min | 2 tasks | 4 files |
| Phase 08 P04 | 6 min | 3 tasks | 2 files |
| Phase 09 P01 | 10 min | 3 tasks | 3 files |
| Phase 01 P01 | 8 min | 3 tasks | 12 files |
| Phase 01 P02 | 13 min | 3 tasks | 4 files |
| Phase 01 P03 | 13 min | 3 tasks | 10 files |
| Phase 01 P04 | 12 min | 3 tasks | 7 files |
| Phase 01 P05 | 4 min | 2 tasks | 6 files |
| Phase 02 P01 | 14min | 2 tasks | 7 files |
| Phase 02 P02 | 13 min | 2 tasks | 10 files |
| Phase 02 P03 | 18 min | 3 tasks | 16 files |
| Phase 02 P04 | 15 min | 3 tasks | 10 files |
| Phase 02 P05 | 14 min | 3 tasks | 10 files |
| Phase 03 P01 | 7 min | 2 tasks | 5 files |
| Phase 03 P02 | 5 min | 2 tasks | 3 files |
| Phase 03 P03 | 7 min | 2 tasks | 3 files |
| Phase 03.1 P01 | 21min | 3 tasks | 12 files |
| Phase 03.1 P02 | 20min | 3 tasks | 13 files |
| Phase 03.1 P03 | 16min | 2 tasks | 7 files |
| Phase 03.1 P04 | 16min | 3 tasks | 11 files |
| Phase 03.1 P05 | 11min | 3 tasks | 7 files |
| Phase 03.2 P03 | 15min | 3 tasks | 24 files |
| Phase 03.2 P04 | 38min | 3 tasks | 11 files |
| Phase 03.2 P05 | 25min | 3 tasks | 9 files |
| Phase 03.3 P01 | 16min | 1 tasks | 16 files |
| Phase 03.3 P02 | 9min | 1 tasks | 12 files |
| Phase 03.3 P03 | 31min | 2 tasks | 9 files |
| Phase 03.3 P04 | 36min | 2 tasks | 18 files |
| Phase 03.3 P05 | 28min | 2 tasks | 19 files |
| Phase 03.3 P06 | 37min | 3 tasks | 13 files |
| Phase 03.3 P10 | 16min | 2 tasks | 9 files |
| Phase 03.4 P06 | 19min | 2 tasks | 10 files |
| Phase 03.4 P07 | 15min | 2 tasks | 15 files |
| Phase 03.4 P08 | 36min | 3 tasks | 56 files |
| Phase 03.4 P10 | 40min | 2 tasks | 20 files |
| Phase 06 P02 | 50 min | 3 tasks | 6 files |
| Phase 07 P01 | 10 min | 2 tasks | 8 files |
| Phase 07 P02 | 11 min | 2 tasks | 6 files |
| Phase 07 P03 | 7 min | 2 tasks | 9 files |
| Phase 07 P04 | 7min | 3 tasks | 1 files |
| Phase 08 P01 | 4 min | 2 tasks | 1 files |
| Phase 08 P02 | 11 min | 3 tasks | 12 files |
| Phase 08 P03 | 12 min | 2 tasks | 20 files |
| Phase 08 P04 | 9 min | 2 tasks | 10 files |
| Phase 08 P05 | 12 min | 3 tasks | 10 files |
| Phase 09 P01 | 14 min | 1 tasks | 16 files |
| Phase 09 P02 | 6min | 2 tasks | 6 files |
| Phase 09 P03 | 11min | 3 tasks | 6 files |
| Phase 09 P04 | 12 min | 2 tasks | 4 files |
| Phase 09 P05 | 11 min | 2 tasks | 13 files |
| Phase 09 P06 | 7 min | 2 tasks | 8 files |
| Phase 09 P07 | 6 min | 2 tasks | 3 files |
| Phase 09 P08 | 8 min | 3 tasks | 4 files |
| Phase 10 P01 | 8min | 2 tasks | 9 files |
| Phase 10 P02 | 14min | 2 tasks | 8 files |
| Phase 10 P03 | 10 min | 3 tasks | 11 files |
| Phase 10 P04 | 19 min | 2 tasks | 7 files |
| Phase 10 P05 | 5min | 2 tasks | 4 files |
| Phase 10 P06 | 14min | 2 tasks | 8 files |
| Phase 10 P07 | 13min | 2 tasks | 2 files |
| Phase 01 P01 | 9 min | 3 tasks | 3 files |
| Phase 01 P02 | 11 min | 2 tasks | 14 files |
| Phase 01 P03 | 10 min | 2 tasks | 9 files |
| Phase 01 P04 | 8 min | 2 tasks | 4 files |
| Phase 01 P05 | 8 min | 2 tasks | 8 files |
| Phase 01 P06 | 10 min | 3 tasks | 10 files |
| Phase 01 P07 | 9 min | 2 tasks | 8 files |
| Phase 01 P08 | 10 min | 2 tasks | 8 files |
| Phase 01 P09 | 12 min | 2 tasks | 6 files |
| Phase 01 P10 | 10 min | 3 tasks | 10 files |
| Phase 29 P01 | 28 min | 2 tasks | 27 files |
| Phase 29 P02 | 46 min | 2 tasks | 17 files |
| Phase 29 P03 | 27 min | 2 tasks | 24 files |
| Phase 29 P04 | 29 min | 2 tasks | 27 files |
| Phase 29 P05 | 40 min | 2 tasks | 24 files |
| Phase 29 P06 | 24 min | 2 tasks | 24 files |
| Phase 29 P07 | 19 min | 2 tasks | 7 files |
| Phase 29 P08 | 27 min | 2 tasks | 15 files |
| Phase 29 P09 | 52 min | 3 tasks | 41 files |
| Phase 29 P10 | 54 min | 3 tasks | 31 files |
| Phase 29 P11 | 27 min | 2 tasks | 14 files |
| Phase 29 P12 | 70 min | 3 tasks | 34 files |
| Phase 29 P13 | 48 min | 3 tasks | 44 files |
| Phase 29 P14 | 20 min | 2 tasks | 9 files |
| Phase 01 P01 | 51m | 2 tasks | 36 files |

## Decisions

- [Phase 01]: Notify corpus scripts carry file-level fallow-ignore markers (unused-file; unused-export on notify-corpus.mjs) instead of a package.json entry, since D-03 keeps the tool out of package.json and npm run check
- [Phase 01]: resolveEnvelope resolves severity and the summary line before needsReload and the tally, because getter-backed kind cases in notification-dispatch.test.ts pin the bytes of that read order
- [Phase 01]: emitWithSummary keeps its name and takes a ResolvedEnvelope; every structured emitter renders the body, resolves the envelope, then formats and notifies once
- [Phase 01]: dispatchInfoMessage keeps rendering the standalone body before it resolves the envelope, and calls resolveRows only in the reconcile-applied arm, because getter-backed kind tests pin that read order
- [Phase 01]: The context emitters take a required hasRenderArm predicate; resolveRows floors a row with no render arm to error on the input row before the envelope resolves
- [Phase 01]: Row hints are RowHint ids set in resolveRows; the grammar maps them to frozen literals through a map total over RowHint
- [Phase 01]: MarkerPolicy and CommandContext.markers use Record spellings, because @typescript-eslint/consistent-indexed-object-style rejects the mapped-type form
- [Phase 01]: resolveRow stays an if-chain that ends in a fallback return, so an out-of-band row whose status no branch names still resolves and reaches the missing-arm diagnostic
- [Phase 01]: Each context emitter reads softDepStatus(pi) once, before resolveRows, and reuses that snapshot for the renderers; renderMpHeader takes a ResolvedMarketplace
- [Phase 01]: RenderFn is (row, mpScope) and composeReasons(reasons) only formats a resolved list; the one softDepStatus(pi) snapshot per emission feeds resolveRows and no renderer (D-13)
- [Phase 01]: softDepMarkers is called only from notification-resolve.ts, pinned by a filesMatching scan whose planted control copies a real registered orchestrator, because gate files may not name an unregistered production path (D-12, SC-5)
- [Phase 01]: The /claude:plugin closure opens one NotificationRun per invocation and routes it as every SubcommandHandler's third argument; marketplace list and info render from run.softDeps with no emission-time probe (D-05, D-07 Option A)
- [Phase 01]: The notify family takes NotificationRun | ToolInventory until 01-16; module-private snapshotOf discriminates on softDeps. register.test.ts states tool reads as { runs, probingEmissions }
- [Phase 01]: The resources_discover pass opens one NotificationRun inside the reconcile try, before the reconcile reads event.cwd, and hands it to applyReconcile; ApplyReconcileOptions keeps pi only for the nested orchestrators until 01-12 (D-05, D-07)
- [Phase 01]: withParsedArgs(parse, usage, operation) returns SubcommandHandler and forwards the run; pending renders from it, and the plugin list and info factories return SubcommandHandler while still ignoring the run
- [Phase 01]: The import cascade renders from ImportClaudeSettingsOptions.run; pi stays only as the forward to the nested install and marketplace add until 01-09/01-10 (D-05)
- [Phase 01]: marketplace remove and update, including resolveScopeOrNotifyNotAdded, take run in place of pi; their handler factories take no pi, and reconcile hands its load-pass run to the nested removeMarketplace (D-05, D-07)
- [Phase 01]: The add and autoupdate orchestrator suites drop the strict pi mock: their boundaries return a run seed and have no tool inventory to probe
- [Phase 01]: fold-adoption's shared context helper carries both pi and run; add reads run, install and list still read pi until they migrate
- [Phase 01]: bootstrap renders its add, autoupdate flip, and its handler's failed row from the router's one run (D-05)
- [Phase 01]: Plugin install takes InstallPluginOptions.run: the success row stamps companionSeverity from run.softDeps and notify composes the markers from the same snapshot, so one probe drives both (D-05)
- [Phase 01]: ImportClaudeSettingsOptions carries no pi; import and reconcile hand their own run to the nested install, and reconcile keeps pi only for uninstall, enable, and backfill (D-07)
- [Phase 01]: SC-3 is proven through the registered command with a two-answer inventory: [] for the first three reads, subagent after; the case asserts the warning summary with the marker and exactly three reads (D-08)
- [Phase 01]: Plugin enable and disable take EnableDisablePluginOptions.run: dispatchOutcome passes run.softDeps to composeOutcomeRow, the same snapshot notifyWithContext composes the markers from, so one probe drives both (D-05)
- [Phase 01]: Uninstall and the shared emitMarketplaceNotAdded take a run; the enable/disable and uninstall handlers take no pi, and reconcile hands its run to both nested verbs, keeping pi only for the backfill (D-07)
- [Phase 01]: Reinstall takes ReinstallPlugin(s)Options.run and emitMarketplaceNotAddedSignal takes a run; update opens one from pi at its single signal call until it takes the router's run (D-05)
- [Phase 01]: ApplyReconcileOptions carries no pi: the backfill hands the load pass's run to reinstall, and index.ts passes applyReconcile only the run it opens (D-07)
- [Phase 01]: Plugin update and fetch take UpdatePluginsOptions.run and FetchPluginsOptions.run; composeUpdateCascade stamps severity from run.softDeps, the snapshot the markers come from, so no orchestrator probes the tool inventory (D-05)
- [Phase 01]: makeUpdateHandler and makeFetchHandler take no pi; openNotificationRun is constructed only in edge/register.ts and index.ts (D-07)
- [Phase 01]: list-flow.ts splits its options: PluginListPayloadOptions carries no run, and ListPluginsOptions extends it with run, so the LLM list tool and the browser's plugin loader build payloads without constructing a run (D-05, IL-2)
- [Phase 01]: Plugin info takes GetPluginInfoOptions.run; the fan-out and the failure loop render from one snapshot per command, and makeListHandler, makePluginInfoHandler, and makeBrowseHandler take no pi, so no edge handler factory takes pi (D-05, D-07)
- [Phase 01]: createNotificationBoundary takes (emissions, cwd?) and holds no Pi mock; the probe count belongs to the root suites register.test.ts and index.test.ts, which build their own strict Pi mocks, and loadExtension states rootReads (three per discover pass that reaches the reconcile and per registered-command run) (D-05, D-07)
- [Phase 01]: The notify family takes run: NotificationRun only; the dispatcher reads run.softDeps and imports no probe, and the catalog driver opens one run per fixture from the fixture's inventory (SC-2, D-05, D-06)
- [Phase 03]: 03-01: RawSurface is spelled as an explicit union while LoadSurface is its only member (sonarjs/redundant-type-aliases); 03-01 Task 2 widened it to UsageErrorSurface | UsageInfoSurface | LoadSurface
- [Phase 03]: 03-01: each TDD task lands as one feat commit with its owner tests, because the full-check pre-commit hook rejects a failing RED commit; RED is observed locally
- [Phase 03]: 03-02: diagnostic, async-rewake-summary, and stop-override-cap are typed raw kinds; formatRawSurface returns undefined only for a zero-length line list or summary, and deliver skips it (D-05, D-08, D-15)
- [Phase 03]: 03-02: HookSurface has its own private emitHookSurface entry; settle passes STOP_OVERRIDE_CAP exported from bridges/hooks/runtime.ts, so the shared layer holds no cap literal (D-07, D-14)
- [Phase 03]: 03-03: the device-flow prompt is the device-flow-prompt raw kind; the domain passes { verificationUri, userCode } to onDeviceCode and auth-host binds it to notifyDeviceFlowPrompt (D-09, D-10, D-12)
- [Phase 03]: 03-03: the AUTH-09 gate pairs a positive call count with an exact-form allow-list for onDeviceCode and for the provider binding (D-11)
- [Phase 03]: 03-03: the D-17 corpus exception is a five-record ledger in its own commit; the baseline holds 3134 entries with 0 extras
- [Phase 03]: 03-04: assertPlantedCopyRejects is the shared D-07-01 offender control; new architecture gates call it per data row instead of repeating the temp-root sequence
- [Phase 03]: 03-04: the D-16 presentation-sink gate pairs two pattern clauses with a placement clause (exactly two notify spellings, both inside deliver); each clause is proven by its own planted offender
- [Phase 04]: Wire closed-set fields use Type.Enum over Record<ClosedSet, true> enrollment keys; typebox 1.3.34 Static of a Union over a non-tuple array is never
- [Phase 04]: Plugin LLM tool details are wire marketplace blocks with verbatim statuses (details.marketplaces replaces the flat plugins list)
- [Phase 04]: Marketplace LIST_CONTEXT renamed MARKETPLACE_LIST_CONTEXT so tools.ts can import both list contexts without a fallow duplicate export
- [Phase 04]: composeContextBlocks stays as the cascade formatter's block composer (only production reader of renderMpHeader/composePluginLines); composeMarketplaceBlock is grammar-private
- [Phase 04]: renderPruneCommittedWarning takes the scope and the serialized cause chain (or undefined), so the grammar owner test covers the no-cause branch without a new emitting dispatch case
- [Phase 04]: isInfoKind and StandaloneKind are module-private once dispatchInfoMessage is gone; no production module imports them
- [Phase 04]: Raw payloads carry no summary, and the async-rewake-summary payload carries its text as text; RAW_SURFACE_SEVERITY is the one raw-kind severity table
- [Phase 04]: PMOD-04: plugin-info-cascade blocks get the same notes redaction as a single plugin-info
- [Phase 04]: PMOD-04: the D-08 redaction ledger is empty (corpus 3134 present, 0 extra; no catalog diff)
- [Phase 04]: WIRE-08: the payload walk's path pattern is redactAbsolutePaths' pattern plus a bare UNC root, which the redactor does not match
- [Phase 04]: WIRE-08: planted path, Error, and undefined offenders extend the prune committed-warning payload, the one catalog payload with a top-level cause chain
- [Phase 04]: PMOD-04: block names and plugin row names are redacted in resolveRows, and the marketplace-not-added name in presentNotification; record-backed names and the scp subject pass through unchanged
- [Phase 04]: PMOD-04: an out-of-band plugin row without a name keeps that shape; resolveRows redacts a row name only when the row carries one

- [Phase 04]: On 2026-10-06 the user accepted both conservative masking rules: split row names ending in scheme://host:port and hyphenated text after Bearer. Resume the review loop, re-verification, and autonomous continuation.
- [Phase 08]: D-07 applied: root brace-expansion bumped 5.0.9 to 5.0.12 lock-only (--ignore-scripts) after the user approved the artifact at checkpoint 08-01-02; D-08 keeps the Pi-shrinkwrapped nested copy at 5.0.9 as the single npm audit path
- [Phase 08]: D-06: resolver integration cases look up the global pi-subagents root before the hermetic HOME swap and pass it into the loader
- [Phase 08]: DEPADV-01 clears only once the lock resolves Pi >=1.0.1 (first release without npm-shrinkwrap.json); Pi 1.0.0 on origin/main still pins nested brace-expansion 5.0.9
- [Phase 08]: 08-04: all 25 open WINDOWS.md entries disposed (23 waived with full [json-output] reasons, 85 and 89 fixed); ledger open 0 / waived 50 / fixed 39 / total 89
- [Phase 09]: LLM tool content is redacted at the tool return through one module-private textContent builder (PMOD-04); details stay as presentCascade redacts them
- [Phase 09]: D-03 kept: both LLM tools return the TC-9 isError shape instead of throwing, though Pi 0.87.1 ignores a returned isError; throwing a redacted Error is left for the user to decide
- [Phase 09]: 04/ deferred item marked status: resolved (not closed) because audit-open treats only resolved or acknowledged as closed
- [Phase 01]: [marketplace-features] Given setup commands stay on the strict runCommand path (one cascade, severity info); only When stores every payload via runCommandPayloads
- [Phase 01]: [marketplace-features] PluginWorld renamed to ScenarioWorld; {scenario time} window has zero tolerance and opens at world construction
- [Phase 01]: [marketplace-features] check:features (scripts/check-features.mjs) is the unused/undefined/ambiguous step gate; npx cucumber-js --dry-run --format usage honors the @url/@github exclusion and is no longer a substitute
- [Phase 01]: [marketplace-features] Feature gate findings name the cucumber skill rule file; ambiguous findings list each matching definition by pattern and source location
- [Phase 01]: The source kind parameter type is named `source kind` (with a space); Cucumber accepts it
- [Phase 01]: `offers these plugins:` republishes under the recorded source kind, defaulting to dir
- [Phase 01]: D-02 multi-payload results are read with 'the command reports these results:' (envelope row per payload) and 'the results list these marketplaces and plugins:' (rows across every cascade payload)
- [Phase 01]: The config read step fails on a missing claude-plugins file and names its path: an absent base file is rebuilt from records on load (MIG-01), so missing is not an empty declaration
- [Phase 01]: The cucumber skill names source kinds and decision IDs, never phases; reviewers gate on npm run check:features, not the CLI usage report (D-09)
- [Phase 02]: setGitHubBaseUrl restores the variable once per test (first call), because node:test runs after hooks FIFO
- [Phase 02]: platform/git.ts fetch passes remote and the wire url together only when the override rewrites the recorded origin; otherwise the previous options
- [Phase 02]: GitHub auth bundles come from buildGitHubAuth: a stored credential bound to the override host with no Device Flow while PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL is set, today's github.com bundle when unset (GHB-02, D-04)
- [Phase 02]: GITHUB_HOST lives in shared/github-base-url.ts so the github.com host literal has one home for the D-06 rule
- [Phase 02]: rethrowInvalidGitHubBaseUrl rethrows InvalidGitHubBaseUrlError from every per-target catch on a GitHub path (add, update, install, missing-dependency install, import, enable), so an invalid override fails the whole command with no new reason token (GHB-03, D-08)
- [Phase 02]: marketplace add rethrows inside the unclassified branch of handleAddFailure, because an exotic-throw case pins the exact prototype-read count of classification
- [Phase 02]: Plugin reinstall, fetch, info --fetch, and update (direct, bulk, autoupdate cascade) rethrow InvalidGitHubBaseUrlError from every per-target catch; transport failures keep their existing rows (GHB-03, D-08)
- [Phase 02]: Bare info never reads PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL; a GHB-04 / NFR-5 case pins its unchanged row and zero git calls with an invalid value set
- [Phase 02]: D-06 literal gate is a local ESLint rule, local/no-github-literal, on for the extension and turned off (not ignored) for shared/github-base-url.ts; seven per-line disables carry reasons
- [Phase 02]: canonicalCloneUrl builds the GitHub identity from the exported GITHUB_ORIGIN, the same prefix gitHubWireUrl matches
- [Phase 03]: [marketplace-features] invalidateManifest takes a ManifestProblem and picks its writer from a total record, so the kind switch stays single (D-04)
- [Phase 03]: [marketplace-features] The malformed manifest is the valid no-plugin manifest minus its last byte: 56 vs 57 valid vs 61 schema-invalid, so the manifest cache never serves another content's parse
- [Phase 03]: [marketplace-features] publishMarketplace delegates to publishMarketplaceIn (directory = name), so the kind switch stays single; the second-publish step records nothing on the world (D-01)
- [Phase 03]: [marketplace-features] remove --local is shown by a second local entry that stays (Option 1), so no remove.steps.ts and no zero-declaration step exist
- [Phase 03]: [marketplace-features] Review WARNING recorded: the published-marketplace lookup is duplicated in add.steps.ts and publishing.steps.ts; move it to features/lib when publishing.steps.ts next changes
- [Phase 03.1]: The first-run migration leaves out what claude-plugins.local.json declares and declines with local-invalid on an unreadable local file (FIX-02, D-01, D-02)
- [Phase 03.1]: A reload after a local install writes no base file, because the install adopts the marketplace into the local file (CR-02); D-04's plugin-key rule is proven by unit and convergence cases
- [Phase 03.1]: FIX-03: the refusal token is the closed-set reason 'marketplace declared locally' in the shared FailureReason group; the --local remedy rides the cause line (D-07)
- [Phase 03.1]: FIX-03: localOnlyMarketplaceRefusal (plugin/shared.ts) is the single rule; install refuses inside the lock right after the write-target selection, before the D-04-07 promotion and the cascade, standalone only (D-06)
- [Phase 03.1]: Standalone enable and disable refuse a shared write under a local-only marketplace right after the not-installed check; orchestrated calls never refuse (FIX-03, D-06)
- [Phase 03.1]: Update and reinstall keep the flag as the write-back target; without the flag they write nothing for a local key or under a local-only marketplace and report an unreadable local file (D-08, D-MF-03)
- [Phase 03.1]: A named flagless update is refused between the preflight and the swap, and a named flagless reinstall inside the lock before resolution; both read writeBackRefusal over selectLayerWriteBack; nameless forms, autoupdate, and the backfill are never refused (FIX-03, D-08)
- [Phase 03.1]: ReinstallFailedOutcome.cause is set only for MarketplaceDeclaredLocallyError, so no other failed reinstall row gains a cause line (FIX-03, D-07)
- [Phase 03.1]: One catalog state in the install section documents the FIX-03 refusal row for install, enable, disable, named update, and named reinstall (A-12)
- [Phase 03.2]: D-04: the mirror refusal reason is 'marketplace declared in shared config'; MarketplaceDeclaredLocallyError lives in shared/errors.ts so marketplace verbs can raise it
- [Phase 03.2]: An unreadable other layer keeps every plugin installed on a layer remove (A-07 applied to plugin keys)
- [Phase 03.2]: Plugin-clone GC still runs whenever no plugin failed; the marketplace data dir and clone go only when the state record was deleted
- [Phase 03.2]: The full marketplace remove unstages only explicit records; every dependency record under it goes through the retention order (D-04-dep)
- [Phase 03.2]: Remove retention reads dependency candidates from the marketplace record; the scope index answers only who holds what
- [Phase 03.2]: An unreadable declaration index refuses a remove with {unreadable} before any change, in both modes (D-09 Q4)
- [Phase 03.2]: [marketplace-features] A standalone project install declares every marketplace its transaction added (dependencies included) in the root's target config file, under the UAT-05 gate; no dependency plugin key (D-04-02); reload/import write nothing (WR-09)
- [Phase 03.3]: pluginLayerVerdict (plugin/shared.ts) is the one layer verdict for named plugin verbs; a standalone uninstall reads both layers, refuses an invalid other layer with the CFG-03 row, and refuses other-only declarations after the record checks (LAYER-04)
- [Phase 03.3]: Install, enable, and disable pick their layer by the --local flag alone (selectDeclaringConfigWriteTarget reads both layers, either invalid layer stops the command); standalone enable/disable refuse a plugin only the other layer declares, idempotent calls included (LAYER-04)
- [Phase 03.3]: A command that writes a plugin declaration also declares the plugin's marketplace in that layer; dependency marketplaces keep the both-layer gate; CR-06 overwrites enabled:false in every layer with the plain writer (LAYER-06)
- [Phase 03.3]: The install no-op fires only for a standalone call, an explicit record, no version pin, and verdict other-only; it returns the existing installed outcome shape with resourcesChanged false (LAYER-05)
- [Phase 03.3]: A standalone uninstall deletes the plugin key from its target layer only; when both layers declare the plugin it drops only that declaration and reports a warning skipped row with the --local hint (LAYER-05)
- [Phase 03.3]: Uninstall of an undeclared dependency: refused with {dependents remain} while a target-layer plugin needs it, skipped at warning while only other-layer plugins do (LAYER-08, D-07, D-14)
- [Phase 03.3]: A flagless enable or disable that the local layer's opposite enabled overrides is refused with {disabled|enabled in local layer} (LAYER-04, D-13); closed reason set 76
- [Phase 03.3]: Named update and reinstall refuse a plugin only the other layer declares through namedPluginLayerRefusal; update checks before the preflight (NFR-5), reinstall inside the lock before resolve and replace
- [Phase 03.3]: An unreadable layer on a named update or reinstall is InvalidMarketplaceManifestError with the basename-only message, mapped to {invalid manifest}
- [Phase 03.3]: Nameless update and reinstall with --local keep only the targets their scope's local layer declares (keepLocalLayerTargets: own keys, one read per scope)
- [Phase 03.3]: [marketplace-features] Plugin layer docs: the READMEs define the two files as the scope's shared and local layers, and the CHANGELOG states the D-11 load error remedy (marketplace add <source> --local) with no automatic repair
- [Phase 03.4]: IN-02 / D-02: the flag-only layer loader is loadTargetLayers (TargetLayers, arm loaded); seams loadTargetLayers and UninstallTransaction.loadLayerConfig; the other layer's parse is other
- [Phase 03.4]: D-02: the migration helper that builds the base config's plugin entries is basePluginEntries; production comments say base config/local config and base layer/local layer (D-03)
- [Phase 03.4]: D-02: test layer helpers, snapshot keys, and layer values say base and local; test data named shared keeps its name
- [Phase 03.4]: User rule: a layer's file is a config -- LayerConfigUnreadableError, features/lib/layer-config.ts, prose says layer config; plan 10 gates add the layer-file pattern
- [Phase 03.4]: D-03: prose says layer for a level and config for a file; configuration stays only for a scope's effective configuration
- [Phase 03.4]: D-03: the writing step is now 'a config in scope <scope> and layer <layer>, with these plugins:'
- [Phase 06]: Use bare marketplace update for one-record behavioral checks because only the plural result includes the required tally. — The named form omits tally fields.
- [Phase 06]: Derive destructive fixture targets from PublishedMarketplace and reject filesystem-root or out-of-root targets. — Missing-source scenarios must not accept arbitrary deletion paths.
- [Phase 06]: Assert the prior failed refresh inside Given for repair scenarios. — The action under test remains after all setup and runs in the same Pi process.
- [Phase 07]: D-08 landed: an unscoped autoupdate/noautoupdate miss reports marketplace-not-added with no scope; autoupdate joins OPS_BARE and the catalog byte total is 46_623
- [Phase 07]: A local autoupdate entry without a value inherits the base value; the base is read once and an invalid base fails a flip only when a valueless local entry needs it (D-02..D-05, fc43090a)
- [Phase 07]: D-09 allows two layer-config writers (plugins member and whole text); a raw-text read step is an ordinary read step
- [Phase 07]: Docs say a nameless flip writes a local entry only when the value that applies to it still differs, since an enable also writes a valueless local-only entry
- [Phase 07]: No step, library, support, production, or cucumber.json change: every step the AU-01..AU-09 pins use already existed, and each pin passed on first run against the final code.
- [Phase 08]: Usage-error Outlines name columns arguments, message, value, and usage only, so Gherkin never rewrites <name> or <source> inside a usage cell
- [Phase 08]: Marketplace usage-error rows carry one fault each and no rm or ls alias rows; combined-fault precedence by parser path stays unpinned
- [Phase 08]: Signature table in edge/router.ts builds both the marketplace help and each verb's usage line; handlers value-import marketplaceUsage
- [Phase 08]: Marketplace help alias column is computed from the rows; the list line gains 10 spaces to keep (alias: ls) under (alias: rm)
- [Phase 08]: PositionalSpec.label is required, so every parseCommandArgs call site names its field and an empty value reports <label> must not be empty. (USE-07)
- [Phase 08]: parsePluginRef in edge/handlers/plugin/shared.ts is the one source of the empty-reference and invalid-reference messages for install, info, and the shared required-reference parser; a bare @ and other partly malformed references keep the invalid-reference message
- [Phase 08]: An @ followed only by blanks on update, fetch, or reinstall is the marketplace form with an empty name and reports `Marketplace name must not be empty.`, and parsePluginTarget is the one target parser of the three verbs
- [Phase 09]: The url publication splits PublishedMarketplace into a path and a git variant, and the publishing functions take PublicationSites { marketplacesRoot, gitHost }, so features/lib never imports features/support
- [Phase 09]: A plan checkpoint commit cannot export a function whose only consumer lands later: fallow dead-code fails the hook (runGit was held back to the final commit)
- [Phase 09]: The colon-in-value parser case uses an Expires header, because the plan's Content-Type example held no colon in its value
- [Phase 09]: Url fixture changes go through one private dispatch (changePublication) that writes the work tree, then commits and pushes; removing a url source deletes only its bare repository
- [Phase 09]: The git host arms one repository by request path (404/500/502/503, drop, or one Basic credential); reset clears the arms and Before() asserts arms: []
- [Phase 09]: The add-authentication-required catalog child-row shape differs from the measured bare url add 401 row; the scenario pins the code, WINDOWS #100 records it
- [Phase 09]: D-19 applied: a failed git marketplace add child row carries marketplaceSubject, and rowId in notification-json.ts uses its redacted name alone as the JSON id; marketplaceFailureRows keeps <mp>@<mp> (BACKLOG ROWID-01)
- [Phase 09]: D-16 uses the existing source missing token for a url add at a missing #ref; only classifyGitSourceAccessFailure (marketplace add) maps NotFoundError, the transport ladder stays unchanged
- [Phase 09]: The empty-log step compares the whole git host traffic record ({ requests: [], connections: 0 }) in one deepStrictEqual, so a kept-alive request or a non-TLS attempt fails it
- [Phase 09]: cucumber.json excludes only @github; every @url row runs by default (D-14)
- [Phase 09]: SC6 evidence uses the local edit in resolveTargetScopeMarketplace: the f78907bf plant now loads but crashes in the Given install, which is not behavioral RED
- [Phase 10]: The github publication kind shares the url arms; only the source differs (GitRepositoryHost.repositoryShorthand), and the acme owner stays a literal of server.ts
- [Phase 10]: The git host's unread-body case GETs /acme/tools.git/HEAD; for info/refs the backend forwards a GET body to upload-pack and exits 141, which stays a 500
- [Phase 10]: The owner/repo shorthand splits at the first # only when no @ comes before it; an empty # ref reads as no ref (D-MF-07)
- [Phase 10]: A github update 401 under the override gets the git credential approve line as a new Error whose cause is the FetchedUrlCause, so the fetched URL stays the last link (UPD-12, GHB-01)
- [Phase 10]: cucumber.json excludes no tag; a future source kind without a stand-in excludes its tag until its stand-in lands (D-07)
- [Phase 10]: A failed add or install that compares its result but no persisted state is a cucumber BLOCKER; a failed update that does not restate the declaration is a WARNING
- [Phase 10]: The Phase 9 review ledger's IN rows were closed by hand with commit SHAs in the Source cell, matching the WR rows
- [Phase 01]: Plugin topic module named installation (not a reserved verb); step module moves are rename-only commits (D-08)
- [Phase 01]: New-session payloads are read through RPC get_entries and kept as the last results; a lasting reconcile failure appears twice and scenarios state both rows
- [Phase 01]: Result projections shared by command and session steps live in features/lib/result-rows.ts; row steps read reconcile-applied-cascade wherever they read a cascade
- [Phase 01]: Retry scenarios state a failed first attempt with Given the user has run <command>, which failed (every payload must be an error)
- [Phase 01]: The marketplace repair step moved to marketplace/publishing.steps.ts because marketplace add and update both use it (D-08)
- [Phase 01]: the result lists these plugins: reads plugin-info-cascade blocks with the column names of a single plugin-info result
- [Phase 01]: The installed-skills deletion step removes each recorded skill directory without force, so a skill the install did not stage fails the setup
- [Phase 01]: The plugin data and skill steps accept only single directory entries for the id parts, the planted file name, and each recorded skill name (T-01-07)
- [Phase 01]: A session in another project uses a second, short-lived Pi that reads its first session with readSession and never sends new_session; the world releases its directory and process
- [Phase 01]: Plugin publishing steps live in features/step_definitions/plugin/publishing.steps.ts; publishOutputStyle makes a published plugin partially available on every source kind
- [Phase 01]: [lifecycle-coverage] Git host steps name a repository through {git repository}; every arm registers a disarming release, and 'the git host serves the <repository> again' lifts it mid-scenario
- [Phase 01]: [lifecycle-coverage] Another process holds a scope's state lock through a self-spawning features/lib holder with the product's proper-lockfile options; a directory in place of mcp-adapter.json is the rollback obstruction; {project dir} and {agent dir} state sandbox paths
- [Phase 1]: [lifecycle-coverage 01-08] Git plugin versions are stated as {<repository> revision <n>} run tokens that the world derives from the revisions a scenario published; plugin source kinds go in a 'plugin source kind' Examples column, untagged
- [Phase 1]: [lifecycle-coverage 01-08] One plugin git-source Outline covers github, url, and git-subdir: each unpinned install made the upload-pack pair twice (clone, then mirror refresh)
- [Phase 01]: 01-09: The marketplaces config writer expands the run tokens in each source in its step; readLayerMarketplaces keeps the table's text
- [Phase 01]: 01-09: The Claude Code settings step lives in claude-code-settings.steps.ts (named after the file, not the import verb) and builds its path only from the sandbox tokens
- [Phase 01]: 01-09: pending never reads the source of a marketplace it would add, so the writer's token expansion is carried to a Phase 11 reconcile seed (WINDOWS #110)
- [Phase 01]: 01-10: The plugin form of {git repository} resolves through gitRepositoryServing, which fails when no recorded repository or more than one holds the plugin
- [Phase 01]: 01-10: Git clones are stated by origin URL and revision token, never by their directory key; the clone reader fails on a stray plugin-clones entry or a checkout with no origin
- [Phase 29]: The apply handler member is SubcommandHandlers.pluginApply, not apply: strong-mock reserves apply/call/bind on every mock
- [Phase 29]: pending and apply share the withScopeOnlyArgs prelude in edge/handlers/plugin/shared.ts; spelling-only top-level verbs route through TOP_LEVEL_VERB_ROUTES in edge/router.ts
- [Phase 29]: apply and the load share openScopePass / closeScopePass / notifyScopePasses in orchestrators/reconcile/read-pass.ts; readPassFailureOutcome, migrateScopeIsolated and rebuildScopeRoutingTableIsolated stay module-private
- [Phase 29]: The load passes no reason to the MCP move, so it skips only the owners the plan installs, uninstalls or disables; MISS-01 dependency installs run nowhere until the reason gate goes
- [Phase 29]: The pending apply trailer is the fixed literal /claude:plugin apply to make these changes, folded after the reload trailer; isReconcilePlanListEmpty is !planListNeedsApply plus no source mismatch
- [Phase 29]: A new optional cascade wire field needs its docs/json-output.md row in the same commit as the schema change, because the hook's json-output-docs gate fails otherwise
- [Phase 29]: An empty apply reports Apply: nothing to change. through the reconcile-pending-empty kind with a required text-only command member; the JSON payload omits it and origin.commandId names the command
- [Phase 29]: The apply-empty advisory is sent in applyReconcileWithReader, not in the shared notifyScopePasses, so the load stays silent on an empty pass (D-05)
- [Phase 29]: Every apply report with a realized row ends with the reload trailer: shouldEmitReloadHint reads reconcile-applied-cascade rows through rowsNeedReload, the cascade's RLD-02 OR-reduce (D-08)
- [Phase 29]: The reason option is gone from ApplyReconcileOptions, McpMigrationInput and ScopePassInput; every apply installs missing declared dependencies and the MCP move skips planned dependency installs (D-02, D-22)
- [Phase 29]: Pending previews marketplace adds and removes as (will add) / (will remove) headers stamped severity info and needsReload false; each counts as one tally success and toward needsApply, and a remove with no plugin still shows its header (D-20)
- [Phase 29]: pending previews the LOAD-01 dependency disable and the MISS-01 install apply makes: it computes the satisfaction verdict, mirrors apply's D-09-07 re-plan so a dependent a planned dependency install satisfies shows no disable, and drops a disable of an already-disabled record (D-21)
- [Phase 29]: The load prints pending's block through the shared composePendingReport / notifyPendingReport on a mismatch, with the apply trailer and no reload hint, and nothing on a match; an invalid config, layer gap or source mismatch is reported only in that block, while per-session warnings and read-pass throws keep their reconcile-applied-cascade payload (D-05, D-06, D-18)
- [Phase 29]: planConvergence (reconcile/convergence.ts) previews each enabled, listed, path-source record whose catalog candidate on disk is a new revision as a (will update) row in pending and the load's block; it plans against the scope as apply's plan leaves it, fails closed on an unreadable declaration walk, and moves stay beside ReconcilePlan, counted for emptiness and needsApply (APL-02, D-10, D-14)
- [Phase 29]: With 20 plugin statuses a full switch exceeds fallow's cyclomatic 20, so status switches split at the new isPendingPluginRow partition into two exhaustive halves or become total Record maps (D-15)
- [Phase 29]: Blocked catalog moves (D-12): planConvergence holds a move a dependent's range does not admit, judged by the network-free constraint-fold.ts on the catalog version alone (D-23), and declines a clean record's partial move; both run to a fixed point that gives a blocked plugin its installed-copy declarations, and pending and the load list update's (skipped) {dependents constrain} and (partially-upgradable) rows at warning, never counted for needsApply
- [Phase 29]: The catalog decline's hint is the new RowHint catalog-partial-update, set by PluginPartiallyUpgradableMessage.catalogHint, with the frozen trailer 'Run update --partial on this plugin to update it with the supported components.' because apply and pending take no --partial (D-24)
- [Phase 29]: Git-source and growth catalog moves (D-10, D-11): planConvergence previews a git-source record from the clone cache offline, a cached tree by version and commit (root not compared, GIT-01) and a target with no cached tree only when the catalog pins another commit or declares another version; the BFILL-01 growth test runs on every pass, so a strictly grown supported set is a move (growth-only at the same version, row marked {components now supported}), still subject to the range hold and consent decline
- [Phase 29]: supportedSetGrew moved to convergence.ts as an export; backfill.ts imports it until the backfill is removed
- [Phase 29]: apply moves catalog plugins through PluginUpdateOperations.convergePlugin (the update runner, refreshSource off, skipSameRevision on, overwrite off, searchReleaseTags off), never reinstall; a failed move shows the planned move and its closed-set reason
- [Phase 29]: The cascade failure classifier reads the errno a BridgeStagingError carries on its cause, so an unreadable plugin source is permission denied (also in the autoupdate cascade)
- [Phase 29]: apply runs growth-only moves through convergePlugin with rematerialize (skipSameRevision off, overwrite off) and reports them with the plugin-backfilled row; the load-time backfill, its stamp gate and EXTENSION_VERSION are deleted, lastReconciledExtensionVersion stays readable and nothing writes it (D-10, D-13, D-25)
- [Phase 29]: README.md's dependents sentence says apply reinstalls an uninstalled dependency a dependent still declares and disables the dependents only if that install fails; the APL-D1 and APL-D2 rows record the read-only load and the NFR-2 amendment
- [Phase 01]: Staging warnings are tagged at each bridge producer and split by partitionStagingWarnings alone; agents D-07 skips are discovery (D-PL1-01..03)
- [Phase 01]: Staging diagnostic headers read Plugin "<name>" [<scope>] <verb>; the verb is a closed seven-member union (D-PL1-05, D-PL1-06)

### mcp-4 decisions

- [mcp-4 Phase 6] info shows the adapter's last-reported server state in
  Claude Code words (`failed` kept distinct), `status unknown` / `not loaded`
  when unknown, `overridden by project scope` for the user row when both
  scopes hold the plugin; severity stays info (D-06-01..10, D-06-06a).
- [mcp-4 Phase 5] `/reload` moves plugin MCP entries out of `mcp.json`;
  old entries are cleanup, not input, and the marked entries are the only
  trigger (D-05-09, D-05-16, COMPAT-01).
- [mcp-4 Phase 5] Operator 2026-10-09: a left-in-place row names a remedy
  per cause (reinstall only for a cold git clone); project-file disable
  stubs go only in the reload move's user pass, written lockless when the
  project has no extension directory; a collision source outside the scope
  files is named by its home-relative path (D-05-02, D-05-08, D-05-10).
- [mcp-4 Phase 5] UAT 2026-10-09: the operator accepted the migration notice
  wording and the leftover reading as built. 8 info findings stay `open` in
  `05-REVIEW-DISPOSITION.md`.
- [mcp-4 Phase 3] Plugin MCP servers use Claude Code's key
  `plugin_<plugin>_<server>_` with `toolPrefix: "mcp"` and
  `directTools: "search"`; a closed 2.1.291 field table translates entries
  (D-03-01, D-03-02, D-03-07).
- [mcp-4 Phase 3] Keys that collide after normalization or the `-`/`_` fold
  refuse at install; no tool-name length check exists (D-03-12, D-03-13,
  D-03-17).
- [mcp-4 Phase 3] UAT 2026-10-06: the operator accepted review warnings
  WR-01 (TR-03 accounting with a legacy `mcp.json` entry), WR-02 (OAuth with
  `headers`), WR-03 (the same-plugin clash refuses inside the ledger) and
  WR-05 (fallow audit `warn` from the ADET-01 fixture clones) as they stand.
  All 10 review findings stay `open` in `03-REVIEW-DISPOSITION.md`.
- [Phase 01]: Pi 1.0 floor: pi-coding-agent peer >=1.0.0 (dev ^1.0.0); pi-subagents >=0.74.0 and pi-mcp-adapter >=5.0.0 are optional peers only, never installed (amended by D-04-12 and D-07-07: the adapter floor is now >=5.2.0)
- [Phase 01]: dispatchRow reads the render map through a Readonly<Record<string, unknown>> view, so no-unsafe-enum-assignment is fixed in code with no rule override
- [Phase 01]: One shared Pi ToolInfo seed (test/platform/pi-inventory-seed.ts) replaces the three Pi-typed copies; ToolInventoryItem-typed helpers stay local
- [Phase 01]: Strict Pi doubles state soft-dependency snapshots through expectSoftDepProbes (test/edge/notification-boundary.ts), the one place that turns a snapshot into Pi reads, so the getCommands() read changes one function
- [Phase 01]: pi-subagents peer tests share test/integration/pi-subagents-peer.ts; the floor is semver.minVersion of the declared peer range, and an explicit PI_SUBAGENTS_ROOT that names no pi-subagents package fails instead of skipping
- [Phase 01]: The MCP soft-dependency marker is {requires pi-mcp-adapter}, at the old member's Reason position; MCP marker assertions end at `}` or `,` so neither token passes on a prefix
- [Phase 01]: pi-mcp-adapter counts as loaded by an extension command named mcp-adapter (optional :<digits> suffix, exact case), or by the sourceInfo.source of an extension command or of a tool containing pi-mcp-adapter; a bare mcp tool and Pi's built-in MCP do not count (ADET-02)
- [Phase 01]: Both command arms require an extension command (source === extension), the name match and the pi-mcp-adapter sourceInfo.source match; a tool counts by its sourceInfo.source (ADET-02)
- [Phase 01]: The e2e soft-dep matrix runs one install-and-list case per detection state and compares the whole reasons block of the plugin's installed row, so a missing row or an extra reason fails the case
- [Phase 01]: Info names each companion a resolved row needs on a requires: line, stamped by the orchestrator from one softDepStatus snapshot and only formatted by the renderer
- [Phase 01]: Pi 1.0 starts each stdio MCP server in its own process group and stops it on shutdown, so the RPC harness proves its clean-exit group sweep with a same-group sentinel child, not the stub MCP server's PID
- [Phase 01]: Stop canary exit contract: a proven STOP-07 regression exits 2; the expected headless cap-trip-warning result and an inconclusive drive exit 1 (PIFL-07)
- [Phase 01]: Every canary passed on Pi 1.0.0 / engine 3.13.1, so the upstream-failure path did not fire; BACKLOG and PIFL-07 text unchanged
- [Phase 02]: MCP servers stage into <scopeRoot>/mcp-adapter.json, read with strip-json-comments (adapter grammar); unreadable files refuse with a cause-less McpConfigFileError
- [Phase 02]: readMcpConfigDoc server keys are a non-empty tuple; plan 02-02 PI_MCP_SERVER_KEYS should match
- [Phase 02]: Ancestor roots follow adapter 5.0.0: only a ~/ prefix expands; a bare ~ entry is skipped
- [Phase 02]: The MCP collision walk exempts the plugin's own marked entries in every one of the nine sources
- [Phase 02]: Unstage reads both mcp-adapter.json and the legacy mcp.json before writing either; adapter file written first
- [Phase 02]: AFILE-06 carry-forward input is { ...ours, ...overlays }: a marker-less stub under the selected key wins over the plugin's previous marked entry
- [Phase 02]: Entry content (substitution, carry-forward, marker) lives in bridges/mcp/adapter-entry.ts; the carried set is module-private and pinned by a vendored 34-key ServerEntry list tied to the >=5.0.0 floor
- [Phase 02]: Install outcomes carry mcpConfigNotices in both modes (omitted when empty); only the standalone path sends them
- [Phase 02]: A failed install restores the exact prior bytes of mcp-adapter.json through the replacement handle; a restore that cannot write is the mcp rollback partial
- [Phase 02]: InstallMissingDependencyOutcome.mcpConfigNotices is excepted in the unused-type-member gate until reconcile reads it (plan 02-08 drops the row)
- [Phase 02]: Update takes MCP notices only after commitPreparedMcp returns; a later bridge or finalize failure still carries them on the failed outcome
- [Phase 02]: Direct update shows MCP notices after the cascade, and after the failure row plus accumulated cascade on a phase-3a abort
- [Phase 02]: Reinstall's render none arm spreads notes, discoveryWarnings and mcpConfigNotices each only when non-empty
- [Phase 02]: cascadeUnstagePlugin carries the MCP slot's notices on both arms; a later slot can fail after the MCP slot rewrote the file
- [Phase 02]: Uninstall, prune and marketplace remove show MCP notices once after their rows, failure rows included; orchestrated uninstall and remove return them on the outcome
- [Phase 02]: A rolled-back prune sends no MCP notice: its rollback-partial row names the rewritten file and the recovery backup keeps the commented original
- [Phase 02]: UninstallPluginOutcome.mcpConfigNotices is excepted in the unused-type-member gate until reconcile reads it (plan 02-08 drops both rows)
- [Phase 02]: Enable and disable carry MCP config notices in result types to the lock-holding helper, which sets a function-local sink before its config write and save, so a later throw still reports the rewrite
- [Phase 02]: The enable cascade's undo (member or root) reports its unstage notices; the root ledger restores its own bytes when it throws and adds none
- [Phase 02]: McpConfigNoticesCarrier.mcpConfigNotices is excepted in the unused-type-member gate until reconcile reads it (plan 02-08 drops the row)
- [Phase 02]: Reconcile notices ride OutcomeBase.mcpConfigNotices; one surfaceMcpConfigNotices call follows surfacePostCommitWarnings, and the empty-reconcile return keeps RECON-05 silence
- [Phase 02]: Import keeps its notice list module-private and strips it from ClaudeImportExecutionResult; the marketplace update cascade reads notices from updated and failed outcomes
- [Phase 03]: Plugin MCP entries are keyed plugin_<plugin>_<server>_ by generatedMcpServerKey; state.json keeps declared names and cascade unstage maps keys back
- [Phase 03]: Stamping warnings and override-kept notices name the generated server key
- [Phase 03]: Hook matchers accept mcp__<server>__.* as a string server prefix (toolPrefixes on the tool-set arm); every other regex matcher still drops (MATCH-02)
- [Phase 03]: translateMcpServer in domain/mcp-server-features.ts is the closed Claude Code server table; a server with no type is stdio, and every unnamed key is dropped
- [Phase 03]: Plugin description resolves once in preflight: plugin.json first, then the marketplace entry; the unavailable arm never carries it
- [Phase 03]: classifyMcpServer validates every server against compiled Claude Code 2.1.291 schemas; a blocked feature adds the typed mcpServers kind ({unsupported mcp}) with no note, and a schema-invalid config adds a "malformed mcp server" note that makes the plugin unavailable
- [Phase 03]: Remote-only fields (headersHelper, tools, toolPermissions) are not features on a stdio server, because Claude strip-mode stdio schema drops them; alwaysLoad, bareElicitationCapability and discoveryCache must be booleans
- [Phase 03]: MCP same-plugin key collisions refuse in keyedServers before readTargetConfig; folded cross-source refusals name the other key via McpServerCollisionError.definedAs
- [Phase 03]: info shows plugin MCP servers as plugin:<plugin>:<server> on both arms; mcpServerDisplayName builds it and generatedMcpServerKey normalizes the same string
- [Phase 03]: McpServerSummaryEntry.unsupportedFeature is a plain string: shared/ cannot import domain/
- [Phase 03]: Agent MCP grants use the longest written-server Claude prefix; an empty or slash-holding tool part is never mapped (ANAME-02)
- [Phase 03]: A per-tool disallow under a surviving whole-server mcp: grant warns rather than narrowing; async: true is warned, never injected (ANAME-02)
- [Phase 03]: Plugin-set carried fields (only requestTimeoutMs today) belong to the plugin; carry-forward skips them and the marker lists their names as pluginSetFields
- [Phase 03]: A field the previous marker lists as plugin-set comes from that marker's kept override, so the user's stub timeout applies again once the plugin drops its timeout
- [Phase 03]: Write-back restores the kept override's own value for a field the live marker lists as plugin-set
- [Phase 03]: docs/mcp-compatibility.md is the home of the MCP naming, tool search, length, lifecycle and divergence records; docs cite ANAME-0N, never D-03-NN
- [Phase 03]: README.es.md carries the same MCP name table, partial-install text and agent MCP rule as README.md (.claude/rules/readme.md)
- [Phase 04]: Plugin MCP entries translate first, then expand only Claude's five fields; references keep names only and the adapter encoding is a separate serializer
- [Phase 04]: variables-missing notices derive from the per-server variable reports and carry names only; the row renders after override-kept
- [Phase 04]: the credential deny-list is a verbatim 2.1.291 snapshot pinned by set digests and differential-fuzzed against the evidence code; mode-gated sets (Gqe, Voo, Gur, tRe) are omitted
- [Phase 04]: a plain-field deny-listed variable unset at install is written as the split-token literal, never a kept reference, so a value set later cannot reach the server
- [Phase 04]: A leading ~, ~/, ~\ or ${NAME:-~...} default in a stdio command or args blocks the server as command ~ / args ~ ({unsupported mcp}); remote url and headers never block
- [Phase 04]: session_start reads ctx.cwd before and outside the session id's try, so adapter variables and the session triple fail independently (AVAR-01, NFR-2)
- [Phase 04]: The pi-mcp-adapter optional peer is >=5.1.0 <6, pinned by the PIFL-03 gate and the AFILE-06 assertion (D-04-17)
- [Phase 04]: info lists each written plugin MCP server's unset (no :- default) and withheld (deny-listed) variable names from the environment injected into createGetPluginInfo, as plugin:<plugin>:<server> (unset A; withheld C); left-out servers and the record arm show no lists (AVAR-04, AVAR-05)
- [Phase 04]: The adapter conformance test finds pi-mcp-adapter only through PI_MCP_ADAPTER_ROOT; CI installs exactly pi-mcp-adapter@5.1.0 with --ignore-scripts into $RUNNER_TEMP, and the install line carries a zizmor adhoc-packages suppression because PIFL-03 keeps the peer out of every lockfile (AVAR-03, AVAR-05)
- [Phase 04]: Every staging verb (install, update, reinstall, enable, import, reconcile) has an AVAR-04 case asserting its rows then both variable warnings; the import case runs the real install path
- [Phase 05]: MCP migration step reads the manifest through lookupDeclaredPlugin (D-99-02a drift gate)
- [Phase 05]: An unreadable mcp-adapter.json makes a movable owner's stage refuse: stopped row, legacy entries kept
- [Phase 05]: Servers with tool permission rules install and warn; unenforcedToolRules re-checks the remote schema so a malformed server never gets the notice
- [Phase 05]: Update takes the MCP stage notices right after its commit and appends the legacy removal's, so a removal throw still reports the adapter rewrite (AFILE-04)
- [Phase 05]: An unparseable mcp.json gives no legacy names at prepare: install, enable, reinstall send no left-unchanged notice for it; update does
- [Phase 05]: The reload migration passes the recorded-sha presence probe whenever the record has resolvedSha; resolveStrict calls it only for git sources
- [Phase 05]: An unavailable offline resolve is source-unreadable unless its notes narrow to malformed mcp
- [Phase 05]: Left-in-place rows sort by scope, plugin key, first old name; a file-unreadable row leads its scope
- [Phase 05]: The migration unsupported removal cause is "unsupported-feature"; the partial-vocabulary guard forbids the bare literal
- [Phase 05]: A failed mcp.json removal is an unfinished row only for a moving owner; disabled and malformed owners keep a stopped row
- [Phase 06]: 06-01: the MCP status lookup keeps unrecognized apart from no-snapshot (both render status unknown) so the shadow token can tell whether a usable snapshot exists
- [Phase 06]: 06-01: hand-built Pi harnesses that run the real factory carry an events bus, because the factory subscribes to pi-mcp-adapter/status/v1
- [Phase 06]: Info decides the user-row MCP override from the project scope's installation record; under --scope user it reads it with persistMigration false and treats a failed read as not overriding
- [Phase 06]: The MCP status conformance test builds the snapshot by hand in pi-mcp-adapter's shape, keyed by the names a real install wrote, because the adapter ships its snapshot builder only as TypeScript source
- [Phase 07]: [mcp-4 Phase 7] The pi-mcp-adapter optional peer is >=5.2.0 <6 (MCP SDK 2.3.1 fixes GHSA-6qxp-vccf-f47h); cited adapter files are byte-identical to 5.1.0, so citations keep their line references and PI_MCP_ADAPTER_ROOT must now name a 5.2.0 install (D-07-07).
- [Phase 07]: [mcp-4 Phase 7] scripts/pi.sh passes -e builtin:tool-search after --no-extensions so tool_search stays available; builtin:mcp stays off (D-07-05).
- [Phase 07]: [mcp-4 Phase 7] Live canary routing: a contradicting observation (missing migration notice, missing fresh-install row, A1 token other than status unknown) exits 2; an unobservable drive exits 1
- [Phase 07]: [mcp-4 Phase 7] The move from mcp.json to mcp-adapter.json takes exactly 1 reload on Pi 1.0.0 with pi-mcp-adapter 5.2.0, measured live by the mcp-adapter canary
- [Phase 07]: [mcp-4 Phase 7] CHANGELOG [Unreleased] uses D-07-10 grouped bullets with no PR numbers and no version bump; the 0.20.0 offer is recorded for the PR (D-07-11)
- [Phase 07]: [mcp-4 Phase 7] env-vars.md gives AI_AGENT its own footnote: Pi sets it at process start, so it has no spawn-order caveat
- [Phase 07]: [mcp-4 Phase 7] PRD PI-11 (pi-subagents only) stays stale; D-07-14 scopes the PRD update to MCP mentions
- [Phase 07]: [mcp-4 Phase 7] Both live-canary search routes run through one route driver; the --no-extensions probes are recorded, never asserted
- [Phase 07]: [07-05] Upgrade notes give the old Pi tool name as <old-name>_<tool> (pi-mcp-adapter default server prefix; 0.19.2 entries carried no toolPrefix), not mcp__<old-name>__<tool>
- [Phase 08]: Plugin-info clone groups removed by hoisting one shared fixture row, never suppressed (D-08-08)
- [Phase 08]: info requires line counts only MCP servers the install writes (ADET-01)
- [Phase 08]: D-08-05: a warm recorded-sha clone with no plugin at the declared path gets the source-outdated migration row, whose remedy is /claude:plugin update
- [Phase 08]: A failed project stub probe keeps every staged owner's legacy entries with an unfinished row (NFR-2, NFR-3)
- [Phase 08]: A stored MCP server choice is { plugin, marketplace, fields } under _piClaudeMarketplace.serverChoices; only the recording plugin@marketplace consumes it (D-08-02; marketplace added by review fix WR-02, 28a1bf0c)
- [Phase 08]: Unstage keeps choices only in mcp-adapter.json; legacy mcp.json composes with withPluginServers
- [Phase 08]: An override the user emptied leaves the file at unstage; a kept {} stub round-trips (AFILE-06)
- [Phase 08]: D-08-05: reinstall treats a mirror whose HEAD cannot be read as unusable and materializes the recorded-sha clone; the reload migration's presence probe makes the same choice with file reads only
- [Phase 08]: holdsBytes takes its read through an optional readMetadata restore op, so the lstat-read race and the rethrow are testable for 100% direct coverage
- [Phase 08]: The agents and skills rollback marker sits above the throw in the else-if arm (bridges/agents/stage.ts:517): the first span line carries an eslint-disable-next-line directive, and a fallow marker above the directive does not hide the group.
- [Phase 08]: dispatchRow keeps an unknown-valued view of the render map and casts the looked-up arm once; a typed RenderFn view fails tsc (function parameters are contravariant)
- [Phase 08]: D-08-03: the adapter-loaded enable and import shapes are pinned by tests; SEV-01 kept, no renderer change
- [Phase 08]: D-08-07: shared/own-key.ts (ownValue, setOwn) is the own-key helper every zone imports; isReservedRecordKey reserves only __proto__; marketplace add checks reserved and duplicate names in one helper (newMarketplaceName)
- [Phase 08]: D-08-04 header cleanliness is checked on written values with the adapter's own reference regex; the split token is unclean even if its variable is set
- [Phase 08]: A non-string written header value withdraws auth (defense in depth; the resolver marks it malformed)
- [Phase 08]: An unparseable authServerMetadataUrl is malformed before any feature blocks
- [Phase 08]: D-08-06 enable threading: env rides a module-private SetEnabledRunOptions bound once in createSetPluginEnabled; install-flow threads env positionally and via PromotionArgs
- [Phase 08]: update-flow bundles hooksRouting, completionCache and env into a module-private UpdateBindings to stay within max-params 7 (D-08-06)
- [Phase 08]: Own-key target resolution: resolveCrossScopePluginTarget and resolveInstalledMarketplaceTarget share one private explicit-scope helper (resolveExplicitScope) and one two-scope loader (loadBothScopes); the audit stays pass with no marker (D-08-07, D-08-08)
- [Phase 08]: Stage tests that drive no variable pass env {}; process-environment AVAR-02 cases set and restore the variable through t.after
- [Phase 08]: README prerequisites name the pi-subagents 0.74.0 floor; per-scope choice storage is recorded as a User choices divergence (D-08-02)
- [Phase 08]: Own-key install, enable, disable and uninstall: test Proxies that fake a record answer getOwnPropertyDescriptor, and ones that drop a write trap defineProperty, because ownValue and setOwn bypass get and set (D-08-07)
- [Phase 08]: Reinstall, update and list read state records by own key; the reinstalled record is written with setOwn (D-08-07)
- [Phase 08]: Reconcile, import, config write-back and marketplace modules read by own key and write config maps with setOwn; mcp-migration imports the shared ownValue (D-08-07)
- [Phase 08]: End-to-end reserved-name proof runs the registered /claude:plugin handler and the real applyReconcile in a hermetic home; install __proto__@<mp> is refused at the closure root-key token rule as (failed) {invalid manifest}, and the resolver's (unavailable) {unsupported source} row surfaces through list
- [Phase 08]: The MCP bridge keeps one isPlainObject, exported from bridges/mcp/marker.ts (a module with no sibling imports); the ENOTDIR-as-absent change in stage.ts readOptionalBytes is declined because such a stage throws before it records a prior file
- [Phase 08]: Every Phase 1-7 review ledger is closed by hand with open: 0; fixed rows cite commits, wontfix rows carry reasons, and ledgers holding wontfix note the code-review parser reads it as open (DEBT-02)
- [Phase 08]: Broken-windows entry 90 (misleading dependency cause for an invalid root plugin name) is carried by BACKLOG ROOTKEY-01 and waived in the ledger; code unchanged

## Current Verification Checkpoint

Phase 6 implements all four plans. CR-01 is fixed by `e7a8182f`, `6680ff1b`,
and `045f53cd`. The independent review is clean and all fifteen declared
security threats are closed. `npm run check` passed at `045f53cd`, Node
`v26.11.0`, with all 266 direct pairs. The strict corpus retains 3149 entries
and zero extras. Only planning Markdown changed after these checks.

The code-fixer workflow requires developer confirmation of redaction logic
before goal verification. Recognized local paths become `[path]`.
Ambiguous affected causes become `Command failure details omitted.`.
Text output remains unchanged. The user accepted this behavior with option 1
on 2026-10-09. The redaction confirmation is resolved.

The final verifier confirmed all 15 positive truths with no implementation
gaps. The user accepted both remaining judgments with option 1 on 2026-10-09:
per-command correlation does not introduce tracking or telemetry, and failure
output does not promise rollback. `06-UAT.md` records both checks as passed.
`06-VERIFICATION.md` is passed with a current fingerprint. Phase 6 is complete.

**Current work:** Phase 7 is complete. All seven UAT reviews passed explicitly
on 2026-10-10; canonical verification and the phase-completion predicate pass.
The six phase requirements are complete. Full `npm run check` passed at
`bfd0d2db` on Node `v26.11.1`; only planning Markdown changed afterwards.
The root dependency advisory and optional-peer integration skip remain recorded
in the phase deferred items. The milestone remains open for audit and archival.

## Accumulated Context

### Roadmap Evolution

- lifecycle-coverage roadmap created 2026-10-22: Phase 1 (Suite Foundation)
  then Phases 2-15 in parallel, each owning disjoint feature files and step
  modules
- Phase 8 added: Address tech debt: ledger dispositions and advisory
- Phase 9 added: Address tech debt: redact LLM tool error text
- Phase 3.1 inserted after Phase 3: Local Declaration Leak Fix: a --local marketplace leaks into claude-plugins.json on the first-run migration (FIX-02), found in Phase 3 discussion
- Phase 3.2 inserted after Phase 3.1: Marketplace Layer Partition (LAYER-01..03, D-MF-03)
- Phase 3.3 inserted after Phase 3.2: Plugin Layer Partition (LAYER-04..06, D-MF-03)

### Recent Decisions

- D-MF-05: unscoped marketplace removal selects project before user, falls
  back to a sole user record, and never falls through after selecting a
  project record whose base layer does not declare the marketplace.
- D-MF-06: marketplace info evaluates both scopes independently in
  project-first order, keeps the shipped invalid-manifest failed row, and
  preserves manifest declaration order for allowed dependency marketplaces.

### Blockers/Concerns

- [lifecycle-coverage] Parallel Phases 2-15 own disjoint `features/` files,
  but a product fix can touch production code or `CHANGELOG.md` that another
  phase also changes; the later merge resolves the overlap and re-runs
  `npm run check`.
- [Phase 9] The url stand-in is proven only locally (OpenSSL 4, Node 26, git 2.55);
  CI (OpenSSL 3.0.13, Node 24) first runs it when the branch is pushed.
- [Phase 10] Resolved: no tag is excluded; every `@github` row runs (48 pass).
- [Phase 10] BACKLOG SHORTREF-01: the `owner/repo@ref` shorthand splits at the
  last `@` (D-76-04), Claude Code at the first; a parity decision for later.
- [Milestone] Phases 1-7 read stale verification (later phases touched files
  their reports cover); the milestone audit must re-verify them.

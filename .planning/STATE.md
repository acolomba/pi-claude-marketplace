---
gsd_state_version: "1.0"
milestone: none
status: between milestones; any-git-host archived; npm 0.19.2 released
stopped_at: CI deduplication and parallel direct coverage verified; local check optimizations next
last_updated: "2026-10-01T17:43:11.012Z"
last_activity: 2026-10-01
last_activity_desc: completed CI deduplication and parallel direct coverage
state_head: b0d45f4f5c65ac69924d16eedc3e8bb9e54a7276
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-01 after the git-hosts workstream was archived)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Planning the next milestone

## Current Position

Phase: No active milestone
Plan: —
Status: any-git-host complete (3/3 phases, 11/11 plans) and archived 2026-10-01
Last activity: 2026-10-01 — Completed quick task 261001-iad: CI deduplication and parallel direct coverage

Five milestones have closed since the last root-scope milestone ran here.
`test-backlog` and `refine-unit-tests` closed in root scope. `workflows` and
`workflows-replay` ran in the `workflows` workstream, archived to
`milestones/ws-workflows-2026-09-27/` on 2026-09-27. `any-git-host` ran in the
`git-hosts` workstream, archived to `milestones/ws-git-hosts-2026-10-01/` on
2026-10-01. `.planning/workstreams/` no longer exists and no workstream is
active, so every phase, plan and quick-task record for those three milestones
lives under its archive directory.

### any-git-host closeout

Completed 2026-09-30: 10/10 requirements, 3/3 phases (`01/`-`03/`) re-verified
`passed` against the final tree, `threats_open: 0` on each. The audit reads
`passed` after quick task 260930-j4y closed the review debt (`BACKLOG.md`
GHRED-01, GHADD-01) in PR #231. Both live canaries (GHCAN-01, GHCAN-02) closed
against local stand-in servers on 2026-09-28.

The code reached `main` in PR #221 (`a0d3aef1`) on 2026-09-30, with review
fixes in PR #231. No tag contains it: `v0.19.2` was cut on 2026-09-24. The
workstream's three quick tasks (260928-tt9, 260930-j4y, 260930-tlb) are recorded
in the archived `STATE.md`, not in the table below.

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
- `workstream complete` run from Claude Code clears only its session-scoped
  pointer (`CLAUDE_CODE_SESSION_ID` selects it), so the tracked
  `.planning/active-workstream` still names the archived workstream. Delete it
  by hand with `git rm`.
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
- **Do not zero the `progress:` block between milestones.** The 3/3 phases and
  11/11 plans are any-git-host's, not root scope's, but 0 routes worse:
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
| deferred_items | 05/deferred-items.md: the record (five open comment-drift items, three closed; the scanner reads the file as one entry)                                                                | acknowledged    | 2026-09-18           | test-backlog |
| deferred_items | 06/deferred-items.md: Six ledger notes name a witness coordinate the fresh report no longer holds (table converted to bullets at this close; item 1 was resolved by the #196 hermetic merge)  | acknowledged    | 2026-09-18           | test-backlog |
| quick_tasks    | 260907-qqo-hkps-01-if-field-powershell-rule-prefix-                                                                                                                                           | unknown (work is complete; scanner misreads it) | 2026-09-13 | refine-unit-tests |
| deferred_items | 06/deferred-items.md: 1. Stale notification hub reference outside Plan 06-19 callers                                                                                                          | acknowledged — RESOLVED, condition no longer holds | 2026-09-13 | refine-unit-tests |
| deferred_items | 06/deferred-items.md: 2. Node 26 direct-coverage negative-control subprocess capture                                                                                                          | acknowledged — promoted to backlog `NEGCTL-01` | 2026-09-13 | refine-unit-tests |
| deferred_items | 25/deferred-items.md (archived v1.4.1): `tests/e2e/import-command.test.ts` 3 failures                                                                                                         | acknowledged — promoted to backlog `E2EIMP-01` | 2026-09-13 | refine-unit-tests |
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
| 260920-qx0 | Reject `--local` on the merged-read marketplace verbs (info, list, update) | 2026-09-20 | f2fbd402 | complete | [260920-qx0-remove-local-from-marketplace-info](./quick/260920-qx0-remove-local-from-marketplace-info/) |
| 260921-t5t | Suppress success-count lines for empty cascades and non-bulk operations | 2026-09-21 | ffdecc5f | shipped in PR #209 | [260921-t5t-when-a-command-returns-an-empty-result-a](./quick/260921-t5t-when-a-command-returns-an-empty-result-a/) |
| 260922-ckn | Read the Claude Code compatibility skill during discuss phases; fix a racy coverage test | 2026-09-22 | 0b0623a3 | complete | [260922-ckn-implement-upstream-informed-discuss-phas](./quick/260922-ckn-implement-upstream-informed-discuss-phas/) |
| 260923-vk3 | Restore Pi-valid skill names and prepare 0.19.1 | 2026-09-23 | 4a710359 | complete | [260923-vk3-fix-issue-211-generate-pi-valid-skill-na](./quick/260923-vk3-fix-issue-211-generate-pi-valid-skill-na/) |
| 260924-bvi | Add bare skill aliases and rewrite plugin Markdown references | 2026-09-24 | b07ae35c | complete | [260924-bvi-add-bare-skill-aliases-and-centrally-rew](./quick/260924-bvi-add-bare-skill-aliases-and-centrally-rew/) |
| 260924-q0m | Keep only plugin-qualified interactive skill aliases | 2026-09-24 | 1bae7cd6 | complete | [260924-q0m-keep-only-plugin-qualified-interactive-s](./quick/260924-q0m-keep-only-plugin-qualified-interactive-s/) |
| 261001-iad | Deduplicate CI checks and run isolated direct coverage pairs concurrently | 2026-10-01 | b0d45f4f | complete | [261001-iad-deduplicate-ci-checks-and-run-isolated-d](./quick/261001-iad-deduplicate-ci-checks-and-run-isolated-d/) |

## Session Continuity

**Last session:** 2026-10-01
**Stopped at:** CI deduplication and parallel direct coverage verified; local check optimizations next
**Resume file:** None

**Current work:** Quick task 261001-iad completed on `features/ci-check-efficiency`.
The approved local check optimizations remain in its plan as follow-up work.
The 0.19.1 and 0.19.2 releases are tagged and
published, PR #216 merged `releases/v0.19.2` back into `main`, and PRs #218
through #232 landed after it. `main` carries the workflows bridge from PR #205
and any-git-host from PRs #221 and #231, which no tag includes yet. The
git-hosts workstream left no root handoff. Handoffs for the earlier milestones moved into their archives
(`milestones/refine-unit-tests-HANDOFF*.md`,
`milestones/ws-defaults-enabled-2026-09-17/HANDOFF.md`) and the paused phase-117
handoff moved to `milestones/ws-workflows-2026-09-27/`. Earlier milestone
continuity is preserved in `inputs/test-backlog/PRE-MILESTONE-STATE.md` and
archived milestone artifacts.

## Operator Next Steps

- Start the next milestone with `/gsd-new-milestone`; `BACKLOG.md` holds the
  six carriers the workflows-replay close named (VSTALE-01, WLREC-01,
  RLHINT-01, PCERR-01, WSTOR-01, WPIN-01).
- PR #153, the contributor PR any-git-host reimplemented, is still open with a
  comment explaining what landed; close it if there is no reply.

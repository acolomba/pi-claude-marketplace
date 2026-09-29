---
gsd_state_version: "1.0"
milestone: json-output
current_phase: 01
current_phase_name: Presentation Model
status: executing
stopped_at: Completed 01-04-PLAN.md
last_updated: "2026-09-29T19:16:25.294Z"
last_activity: 2026-09-29
last_activity_desc: Completed 01-04 marker policy
state_head: 3d842f7a2cad6bac2977d38fc7c145896554cb44
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 16
  completed_plans: 4
milestone_name: Mode-Keyed Presentation Strategies
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-28 for the json-output milestone)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 01 — Presentation Model

## Current Position

Phase: 01 (Presentation Model) — EXECUTING
Plan: 5 of 16
Status: Ready to execute
Last activity: 2026-09-29 — Completed 01-04 (marker policy)

Progress: [██░░░░░░░░] 25% (4 of 16 plans)

Phase 1's first plan captures the text wire-corpus baseline (every emitted
`(message, severity)` pair and its argument count) before any renderer change;
every later phase re-diffs against it. Each phase leaves `npm run check` green
and the text bytes unchanged, except for PMOD-04 credential redaction in
Phase 4.

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

## Session Continuity

**Last session:** 2026-09-29T19:16:18.376Z
**Stopped at:** Completed 01-04-PLAN.md
**Resume file:** None

**Current work:** Milestone json-output on `features/json`. Requirements and
the roadmap are written (36 requirements, 7 phases, all mapped). No phase has
started, and no `phases/` directory exists yet.

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

- Discuss Phase 1 with `/gsd-discuss-phase 1`, then plan it with
  `/gsd-plan-phase 1`. Its research flag asks for the per-verb soft-dep
  suppression table and the inventory of named-file gates to re-point.
- `BACKLOG.md` still holds the six carriers the workflows-replay close named
  (VSTALE-01, WLREC-01, RLHINT-01, PCERR-01, WSTOR-01, WPIN-01). This
  milestone closes MRO-01 in Phase 7.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 50 min | 3 tasks | 5 files |
| Phase 01 P02 | 80 min | 2 tasks | 11 files |
| Phase 01 P03 | 67 min | 2 tasks | 15 files |
| Phase 01 P04 | 122 min | 2 tasks | 42 files |

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

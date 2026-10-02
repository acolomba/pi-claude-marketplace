---
gsd_state_version: "1.0"
milestone: json-output
current_phase: 3
current_phase_name: Typed Raw Surfaces
status: planning
stopped_at: Phase 2 complete, ready to plan Phase 3
last_updated: "2026-10-02T13:36:04.585Z"
last_activity: 2026-10-02
last_activity_desc: Phase 2 complete, transitioned to Phase 3
state_head: 571b6883cda8fa497654c58c62e5b68899457769
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 18
  completed_plans: 18
  percent: 29
milestone_name: Mode-Keyed Presentation Strategies
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-01 after json-output Phase 1 verification)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 2 — Row Policies

## Current Position

Phase: 3 — Typed Raw Surfaces
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-02 — Phase 2 complete, transitioned to Phase 3

Progress: [███░░░░░░░] 29% (2 of 7 phases fully verified; 18 plans complete)

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

**Last session:** 2026-10-02T13:36:26Z
**Stopped at:** Phase 2 complete, ready to plan Phase 3
**Resume file:** None

**Current work:** json-output on `features/json`. Phases 1 and 2 are complete
and verified. Phase 2's review-fix loop closed after three iterations with ten
findings fixed (CR-01, WR-01..WR-06, IN-01..IN-03); D-07 now records 29 approved
corpus replacements (29 / 2,632 / 2,661 against the original blob). The full
`npm run check` passed at `571b6883`. Phase 3 (Typed Raw Surfaces) is next.

**Carried concern -- corpus nondeterminism:** `node scripts/notify-corpus.mjs
check` exits 1 on 8 missing/extra pairs in
`tests/orchestrators/plugin/prune.test.ts`. Those messages embed a random
`prune-backup-XXXXXX` directory name (`prune-rollback.ts`), which
`normalizeMessage` does not normalize, so the `e514ea67` post-merge re-baseline
captured random suffixes. With the suffix normalized, all 37 prune entries match.
It arrived with main's prune tests (#198), not with phase 2. Until the tool
normalizes it and those 8 entries are re-captured, the corpus gate cannot exit
0 in phases 3-7. Later phases also compare the catalog against main's
`8b6ac3bc` (or the latest merged main) rather than `e40d3dda`, because #198
changed catalog bytes.

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

- Decide how to fix the prune corpus nondeterminism (normalizer rule plus an
  8-entry re-capture) before the Phase 3 corpus gate.
- Plan Phase 3 (Typed Raw Surfaces) under the original autonomous run.

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

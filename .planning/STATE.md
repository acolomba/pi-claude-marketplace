---
gsd_state_version: "1.0"
milestone: test-backlog
current_phase: 05
current_phase_name: Production Export Ownership
status: executing
last_updated: "2026-09-15T00:30:00Z"
last_activity: 2026-09-14
last_activity_desc: Wave 8 plan 05-17 reinstall composition owner complete
state_head: e7fe8c47
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 54
  completed_plans: 33
  percent: 61
milestone_name: test-backlog
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-13 after the refine-unit-tests milestone)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 05 — Production Export Ownership

## Current Position

Phase: 05 (Production Export Ownership) — EXECUTING
Plan: 23 of 28 — 05-17 complete; 05-27 is the other Wave 8 plan
Status: Executing Phase 05 Wave 8
Last activity: 2026-09-15 — 05-17 added `createReinstallOperation` to the plugin
composition owner, pointed the load-time backfill scan at it, migrated the two
outside single-reinstall call sites, and made `createNodeReinstallPlugin`
module-private behind a TS2578-discriminating missing-export proof. Committed in
`5ac7e4fe` and `e7fe8c47`. One identity leaves the census with zero additions;
the live total moves 14 -> 13.

Earlier activity: 2026-09-15 — 05-26 gave the PreCompact and PostCompact payload
modules their event-specific export names, `translatePreCompact` and
`translatePostCompact`, committed in `42477b85` and `94b46e37`. The `translate`
duplicate-export group drops from four members to two; the census total stays 14
with zero additions.

Earlier activity: 2026-09-14 — 05-16 added `createEnableOperation` and
`createUninstallOperation` to the plugin composition owner, switched both command
handlers and reconcile onto them, and retired `createNodeSetPluginEnabled` and
`createNodeUninstallPlugin` with no-caller evidence. Committed in `d3d7abba`,
`11fe18f3` and `4d48f853`. Two identities leave the census with zero additions;
the live total moves 16 -> 14.

Earlier activity: 2026-09-15 — 05-25 gave the SessionStart, SessionEnd and
UserPromptSubmit payload modules their event-specific export names, committed in
`fbce2dfc`, `6823c071` and `fefd6fe9`. The `translate` duplicate-export group
drops from seven members to four; the census total stays 16 with zero additions.

Earlier activity: 2026-09-14 — 05-23 retired the four notification vocabulary tuples
in favour of bare literal unions, privatized `ICON_REMOTE`,
`ICON_PARTIALLY_AVAILABLE` and `emitWithSummary`, and folded the reason coverage
proof into the per-kind malformed-reason map, committed in `b191b2bc`,
`5e7d0ef3`, `95cf4929` and `3997bbda`. Eight identities leave the production
census, 24 to 16, with zero additions and no transitive finding.

Earlier activity: 2026-09-14 — 05-19 privatized install reason narrowing, plugin-PATH
bin collection, the four reinstall replacement steps and the reinstall row
projection, committed in `accb1fcd` and `0f5f9d4c`. Seven identities leave the
production census, 31 to 24, with zero additions; the one transitive finding the
privatization exposed, the now-unreferenced `ReinstallMsg` union, was dispositioned
inside the same owner file.

Earlier activity: 2026-09-14 — 05-15 gave install its production composition owner,
committed in `dd8547ec` and `a99d7dd1`. `orchestrators/plugin/operations.ts` now
holds the one concrete `runPhases` / `withLockedStateTransaction` binding;
`createNodeInstallPlugin` is retired and all eleven callers ask the new owner for a
composed operation. The production census drops one identity, from 32 to 31, with
zero additions; the shared census pin edit remains deferred to the parent wave
reconciliation

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
Phase 5 has completed twenty-three of twenty-eight plans. Phase 6 and Phase 7 plans are
approved; their production acceptance follows Phase 5 completion. Earlier milestone continuity is preserved in
`inputs/test-backlog/PRE-MILESTONE-STATE.md` and archived milestone artifacts.

### Known snag for the next close

`gsd-tools query phase.complete` and the state verbs refuse in this checkout: they
see `.planning/workstreams/` and demand `--ws`, but this milestone's ROADMAP and
STATE were the ROOT files and no workstream is named `refine-unit-tests`. Hand-edit
and verify by diff. Two further CLI gaps were worked around at this close and will
recur: `milestone complete` leaves the original-path deletions **unstaged**
(`git add -u .planning/`), and it wrote `completed_phases: 1` / `percent: 11` for a
9-of-9 milestone, which was corrected by hand.

### Wave 5 complete — census reconciliation pending

Stopped at: completed `05-24-PLAN.md`. Resume file: none. All three Wave 5 plans
(05-07, 05-12, 05-24) are committed and no source writer is active, so the tree is
frozen for the reconciliation.

Full unit run on the finished tree: 6244 tests, 6242 pass, 2 fail. Both failures are
the `tests/architecture/unowned-exports-census.test.ts` pin-equality gates, red by
design until the parent applies its single pin edit. Integration: 32/32, exit 0.
Every direct owner touched in the wave measures hit == found.

The parent's one pin edit covers thirteen changes to `tests/architecture/gate-targets.ts`
(42 pinned -> 32 live): ten identity removals from 05-07 and 05-12, and three location
removals from the single `duplicate_exports` `translate` entry. Zero additions. The
exact identity strings are listed in `05-24-SUMMARY.md`.

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
- Next: reconcile the Wave 5 census pin, then execute Wave 6 and the remaining approved export, member-gate and coverage work.

### Live baseline correction

Initial measurement: 6003/6003 tests passed, with four production lines and one
branch uncovered in agents/convert.ts. Phase 3 Plan 1 removed a redundant
unreachable throw by carrying the existing runtime validation in the type.
Phase 3/4 measurement: 6267/6267 tests pass; production lines 63374/63374,
functions 1851/1851, branches 9145/9145. Integration: 32/32 passed.
Current Wave 4 measurement: 6242/6242 unit tests pass; production 62,664/62,664 lines, 1,835/1,835 functions and 9,063/9,063 branches across 225 emitted modules.
Affected direct pairs and all 58 analyzer/census/Sonar controls pass.
The complete production finding census moves from 111 to 42 across four waves, with no additions. The obsolete converter direct pin was
removed after its owner reached 100%; the two unrelated direct pins remain.

GSD phase.complete still refuses this root milestone because archived
workstream directories exist. Phase 1–4 tracking was updated in the authorized
root files and checked by diff; archived workstreams were preserved.

### Explicit pause

User requested `$gsd-pause-work` after the verified Wave 4 source commit `851c5e26`. All task executors and checks are stopped. Resume from `.planning/HANDOFF.json` and `phases/05-production-export-ownership/.continue-here.md`; Wave 5 preparation is saved durably, with no implementation applied. Configuration/setup changes and the local quick-task row remain uncommitted.

### Session resumed

Session resumed on 2026-09-14 via `$gsd-resume-work`. Context restored and
reconciled against the checkout: branch `features/test-backlog` at `2c67f391`;
Phase 5 holds 13 of 28 summaries; the three durable pause archives verify against
`MANIFEST.json`; all eight prepared 05-07 baseline hashes still match the committed
tree. No background jobs, no async job manifests, no blockers. Implementation has
**not** restarted -- `.planning/HANDOFF.json` and the phase `.continue-here.md` are
deliberately retained until Wave 5 lands. Next action: execute Phase 5 Wave 5
(plans 05-07, 05-12, 05-24).

Correction to the handoff record: `.planning/config.json` no longer carries the
`model_profile_overrides.codex.opus` Astra entry and is clean in git; the active
runtime is `claude`.

### Wave 7 progress

Plan 05-16 is complete. `orchestrators/plugin/operations.ts` now composes the
enable/disable and uninstall operations as well as install. Its enable binding is
built here from the five capabilities other modules own; uninstall's binding stays
in `uninstall.ts` and is imported, because three of its six members are steps of
the uninstall algorithm itself and exporting them would leak that module's
internals. `createNodeSetPluginEnabled` and `createNodeUninstallPlugin` are gone,
and `createSetPluginEnabled` / `createUninstallPlugin` are now production-consumed.

Evidence: 6260 unit tests, 6258 pass, 2 fail -- both the parent-owned census
equality gates. Integration 32/32, exit 0. All six changed direct owners measure
hit == found; the direct-coverage pin is untouched. Typecheck, lint, prettier,
fallow, the corresponding-test gate and both negative controls pass. Four planted
offenders discriminate the new composition cases (eager timer, eager owner call,
and each transaction's cascade replaced by a no-op); the benign control passes.

Open, parent-owned: the two identities to remove at the Wave 7 reconciliation are
`unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts|createSetPluginEnabled`
and
`unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts|createUninstallPlugin`,
with the matching `UNOWNED_EXPORT_CENSUS` keys. Zero additions. Plan 05-26
contributes its own delta.

### Wave 7 progress — plan 05-26

Plan 05-26 is complete, and with it Wave 7 source writing. The PreCompact and
PostCompact payload modules publish `translatePreCompact` and
`translatePostCompact` -- the names both dispatch modes already supplied at
import -- so the identity lives in the module instead of being re-supplied at each
call site. Both `dispatch-exec.ts` and `async-rewake/registry.ts` import the names
directly; their event-keyed translator maps are untouched, so both modes still
reach the same event translator. All ten entries in the per-event export-name table
in `tests/architecture/hooks-translators.test.ts` now pin an event-specific name
except `Stop` and `StopFailure`, which plan 05-27 owns.

Evidence: 6260 unit tests, 6258 pass, 2 fail -- both the parent-owned census
equality gates. Integration 32/32, exit 0. All four changed direct owners measure
hit == found. Typecheck, lint, prettier, fallow and the direct-coverage pair gate
pass. Two planted offenders discriminate the updated export table, one naming an
export the module does not publish and one renaming a published export without
updating the table; each reports 1 pass / 1 fail, because the gate's second test
iterates the three tool events only.

Open, parent-owned: the live census total stays 14. This plan changes membership,
not count: the single `duplicate_exports` `translate` entry loses its `pre-compact`
and `post-compact` locations and keeps `stop-failure` and `stop`. Zero additions;
no other identity moved. The exact before/after identity strings are in
`05-26-SUMMARY.md`.

### Wave 6 progress

Plan 05-25 is complete, and with it Wave 6 source writing. The SessionStart,
SessionEnd and UserPromptSubmit payload modules publish `translateSessionStart`,
`translateSessionEnd` and `translateUserPromptSubmit` -- the names both dispatch
modes already supplied at import -- so the identity lives in the module instead of
being re-supplied at each call site. Both `dispatch-exec.ts` and
`async-rewake/registry.ts` import the names directly; their event-keyed translator
maps are untouched, so both modes still reach the same event translator. The
per-event export-name table in `tests/architecture/hooks-translators.test.ts` pins
all three new names.

Evidence: 6256 unit tests, 6254 pass, 2 fail -- both the parent-owned census
equality gates. Integration 32/32, exit 0. All five changed direct owners measure
hit == found. Typecheck, lint, prettier, fallow and the direct-coverage pair gate
pass. Two planted offenders discriminate the updated export table, one naming an
export the module does not publish and one renaming a published export without
updating the table.

Open, parent-owned: the live census total stays 16. This plan changes membership,
not count: the single `duplicate_exports` `translate` entry loses its `session-end`,
`session-start` and `user-prompt-submit` locations and keeps `post-compact`,
`pre-compact`, `stop-failure` and `stop`. Zero additions; no other identity moved.
The exact before/after identity strings are in `05-25-SUMMARY.md`.

Plan 05-23 is complete. `Reason`, `StatusToken`, `PluginStatus` and
`MarketplaceStatus` are declared directly as literal unions -- the four `as const`
tuples they used to derive from were values nothing iterated, and privatizing them
would only have moved an unreferenced runtime artifact behind a `_` prefix.
COMPAT-01 keeps its full promise: the catalog-stable ORDER is asserted by reading
the declaration as data, and membership by a bidirectional union proof, so a pure
transposition still fails while typecheck stays clean. The length tripwires count
exhaustive `Record<Vocabulary, true>` maps, which is a count and a membership
check in one annotation.

`ICON_REMOTE` and `ICON_PARTIALLY_AVAILABLE` are module-private and pinned through
`renderRemoteRow` and `renderPartiallyAvailableRow`; the eighth-glyph clause now
counts declarations rather than exports, so a private eighth glyph is caught.
`emitWithSummary` is module-private: its eleven cases stayed with their own owner
against the public `composeWithSummary`, which returns the exact argument tuple the
emitter spreads, and six delivery cases joined the dispatch owner. That split was
forced by measurement -- moving all eleven dropped `notification-summary.ts` direct
coverage to 605/631 lines. `_ReasonsCoverageProof` is retired as an export and
consumed by `MALFORMED_REASON_BY_KIND`'s annotation, so a reason without a topic
home fails the build at the map.

Evidence: 6256 unit tests, 6254 pass, 2 fail -- both the parent-owned census
equality gates. Integration 32/32, exit 0. All five changed direct owners measure
hit == found. Typecheck, lint, prettier, fallow and the direct-coverage pair gate
pass. Ten planted offenders discriminate the rewritten gates, including one proving
the order assertion survived the move off a runtime tuple.

Open, parent-owned: the eight identities this plan removes are listed in
`05-23-SUMMARY.md`. Combined with 05-15 and 05-19 the live census reads 16, zero
additions.

Plan 05-19 is complete. `narrowResolverReasons`, `collectBinDirs`,
`replaceReinstalledPlugin`, `rollbackReinstalledPlugin`,
`finalizeReinstalledPlugin`, `runPostSuccessMaintenance` and
`outcomeToPluginMessage` are module-private and are now asserted through the
public results that carry them: the `unavailable` row `classifyEntityShapeError`
composes, the ledger and PATH `recomputePluginPath` writes, the
`REAL_REINSTALL_TRANSACTION` schedule steps, and the exact notification bytes
`renderReinstallPartitionAndNotify` emits. The cross-surface parity gate no longer
imports the private helper; it drives the public install row and pins both
surfaces to independent literals.

`outcomeToPluginMessage`'s `marketplaceScope` argument had no reachable caller --
the notify operation groups outcomes by `(scope, marketplace)`, so a row's scope
always equalled its block's -- so the orphan-fold branch was retired with that
evidence rather than left uncoverable. `ReinstallMsg` was privatized with it and
its required-dependency proof retargeted at the public row composer's return type.

Evidence: 6244 unit tests, 6242 pass, 2 fail -- both the parent-owned census
equality gates. Integration 32/32, exit 0. All four changed direct owners measure
hit == found. Typecheck, lint, prettier, fallow, test:corresponding and both
negative-control gates pass. Five planted offenders and three benign controls
discriminate the rewritten owner tests.

Open, parent-owned: the seven identities this plan removes are listed in
`05-19-SUMMARY.md`. Combined with 05-15 the live census reads 24, zero additions.

Plan 05-15 is complete. `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts`
is the single production place that binds install's semantic `InstallTransaction`
contract to the concrete ledger and state lock. `createInstallPlugin` keeps the
semantic factory and is now production-consumed; `createNodeInstallPlugin` and
`REAL_INSTALL_TRANSACTION` are retired, and install-flow's two transaction imports
became type-only. The edge install handler, the import executor, the reconcile apply
loop, the concurrent-install child helper and six test consumers all migrated.

Evidence: 6245 unit tests, 6243 pass, 2 fail — both are the parent-owned census
equality gates, red by design on exactly one removal and zero additions. Integration
32/32, exit 0. All five affected direct owners measure hit == found at 100%
(operations 36/36 lines, install-flow 1119/1119, edge install 106/106, import execute
1212/1212, reconcile apply 961/961). Typecheck, lint, prettier, fallow,
test:corresponding and both negative-control gates pass. Four planted offenders and
one benign control discriminate the new owner tests.

Open, parent-owned: the one census identity to remove at the Wave 6 reconciliation is
`unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts|createInstallPlugin`
(and the matching `UNOWNED_EXPORT_CENSUS` key, whose only member it was). 32 -> 31,
zero additions. Sibling Wave 6 plans contribute their own deltas.

### Wave 5 progress

Plan 05-07 is complete. Hook config writing and skill tree removal are now composed at
`bridges/hooks/index.ts` and `bridges/skills/index.ts` from their production-consumed
factories; `hookConfigPathFor` is private. 40/40 focused tests, all four direct owners at
100% with hit == found, 2113/2113 orchestrator tests, typecheck/lint/format/fallow clean.

Plan 05-12 is complete. Config, state and completion-cache validation now lives entirely
inside `persistence/config-io.ts`, `persistence/state-io.ts` and `shared/completion-cache.ts`:
five schema/validator bindings are private, `MARKETPLACE_NAMES_CACHE_SCHEMA` and the
`EnabledPluginRecord` alias are retired with no-caller evidence, and validity plus the
diagnostic now come from the compiled validator's first `Errors` entry. Every private-schema
assertion became a public load/save/hydrate result, an exact serialized byte string, or an
exact public type equality. 243/243 focused tests, all three direct owners at 100% with
hit == found, 6242 passing unit tests, 32/32 integration, 8 of 8 isolated drift controls
reproduced, and a 644-case typebox corpus confirming the validator swap is behaviour-neutral.
Production findings 39 → 32, seven exact removals, zero additions.

Open, parent-owned: `tests/architecture/gate-targets.ts` still pins all ten Wave 5 identities
so far, so two census equality gates in `tests/architecture/unowned-exports-census.test.ts`
fail on exactly those ten with zero additions. Every task in both plans forbids editing that
pin; the wave reconciliation updates it once after 05-24 also lands. The combined Wave 5
target of 42 → 32 is already reached; 05-24 should leave the total at 32 while changing
`translate` duplicate-group membership, so compare group member identities, not the count.

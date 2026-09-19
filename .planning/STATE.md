---
gsd_state_version: "1.0"
milestone: test-backlog
current_phase: 08
current_phase_name: Final Verification and Reconciliation
status: executing
stopped_at: Phase 07 complete, ready to plan Phase 08
last_updated: "2026-09-19T00:16:59.154Z"
last_activity: 2026-09-18
last_activity_desc: Phase 07 complete, transitioned to Phase 08
state_head: 719d9e264195d432ced1d55845d4a4b95514fd41
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 65
  completed_plans: 63
  percent: 88
milestone_name: test-backlog
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-13 after the refine-unit-tests milestone)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 07 — Reliable Coverage Metrics

## Current Position

Phase: 08 (Final Verification and Reconciliation) — READY TO EXECUTE
Plan: Not started
Status: Ready to execute
Last activity: 2026-09-18 — Phase 07 complete, transitioned to Phase 08

Phase 06 shipped an automated gate for type members nothing reads — a class
no existing tool caught here: typecheck, lint and fallow all pass with a
planted unread member.

The live population went 614 -> 468 -> 261 -> 138 through analyzer
corrections, -> 33 through six bounded source repairs, -> 16 and -> 9 through
two analyzer-engine plans, -> 5 through a duplicate-declaration collapse and
the activation plan's own cleanup. Every one of those steps measured its
delta as a (path, owner, key) set difference and recorded ZERO findings
gained.

Five members remain and each is a recorded decision, not a defect: the
WR-01 `partition?: never` refusal marker, the D-32-05 `authAttempted` pair,
`UpdatePhaseFailure.msg`'s rollback-populated surface, and the single-variant
`PLUGIN_INFO_RENDER.status` filter. The exception layer lives in the CLI, not
the analyzer, so `--inventory` and `--check` still count all five as unread;
a decision changes exit status and nothing else. Counts, thresholds and path
globs are unwritable rather than discouraged, and an entry matching no
finding exits 2, so the list self-expires.

`npm run check` now runs the gate and its negative controls: seven
whole-program analyses, 14m21s. Pre-commit splits them across two hooks so an
ordinary `extensions/` commit costs ~85s.

Verification ran the 7-control negative suite live and planted a new unread
member into the real `EdgeDeps` declaration, confirming the exception list
excuses exactly five coordinates and nothing else. Coverage recomputed
independently from unit.lcov: 1833/1833 functions, 9049/9049 branches, 0
modules below 100%. The direct-coverage pin was renumbered, never loosened.

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
| 260917-bh3 | Condense the #181 unreleased CHANGELOG entries | 2026-09-17 | 399dea49 | Complete | [260917-bh3-condense-the-181-unreleased-changelog-en](./quick/260917-bh3-condense-the-181-unreleased-changelog-en/) |
| 260913-uwq | Gate and commit the issue-179 fix: agents omitting `tools:` inherit Pi's defaults, and the two dropped agent fields get targeted guidance | 2026-09-13 | a9186816 | Complete | [260913-uwq-issue-179-agent-tools-and-mcpservers-con](./quick/260913-uwq-issue-179-agent-tools-and-mcpservers-con/) |
| 260913-ttl | Close the remaining SonarQube branch-coverage gap to reach 100% line and 100% branch coverage | 2026-09-13 | d2ef20fa..46815bd6 | Complete | [260913-ttl-close-the-remaining-sonarqube-branch-cov](./quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/) |
| 260913-r2h | Make a FIFO state-harness over-read fail loudly instead of hanging to the test timeout | 2026-09-13 | c45850af | Complete | [260913-r2h-make-a-fifo-harness-over-read-fail-loudl](./quick/260913-r2h-make-a-fifo-harness-over-read-fail-loudl/) |
| 260913-n7w | Fix the FIFO state server so each reader open receives exactly one payload | 2026-09-13 | e4f12cce | Complete | [260913-n7w-fix-the-fifo-state-server-reader-pairing](./quick/260913-n7w-fix-the-fifo-state-server-reader-pairing/) |
| 260913-l07 | Fix every remaining zizmor finding, drop the severity floor, and simplify the gate comments | 2026-09-13 | 729348b4 | Complete | [260913-l07-fix-remaining-zizmor-findings-and-simpli](./quick/260913-l07-fix-remaining-zizmor-findings-and-simpli/) |
| 260913-f6a | Gate the two SonarQube workflow findings, githubactions:S6505 and githubactions:S7637 | 2026-09-13 | 8a8a0396..69797ebc | Complete | [260913-f6a-gate-sonar-workflow-findings-s6505-and-s](./quick/260913-f6a-gate-sonar-workflow-findings-s6505-and-s/) |

## Session Continuity

**Last session:** 2026-09-18T21:00:37.990Z
**Resume file:** None

**Current work:** test-backlog on `features/test-backlog`. Phases 1–5 are complete.
Phase 6 has completed 16 of its 17 plans; 06-17 and 06-08 remain. Phase 7 plans
are approved and follow it.
Earlier milestone continuity is preserved in
`inputs/test-backlog/PRE-MILESTONE-STATE.md` and archived milestone artifacts.

### Known snag for the next close

`gsd-tools query phase.complete` and the state verbs refuse in this checkout: they
see `.planning/workstreams/` and demand `--ws`, but this milestone's ROADMAP and
STATE were the ROOT files and no workstream is named `refine-unit-tests`. Hand-edit
and verify by diff. Two further CLI gaps were worked around at this close and will
recur: `milestone complete` leaves the original-path deletions **unstaged**
(`git add -u .planning/`), and it wrote `completed_phases: 1` / `percent: 11` for a
9-of-9 milestone, which was corrected by hand.

### Phase 6 Plan 1 complete

Stopped at: Phase 07 complete, ready to plan Phase 08
(directed value transfers) and 06-03 (validated contracts), which the plan
graph runs together in Wave 2 over disjoint files.

Seven commits, `3b5b57c3..df4b2978`, each task executed red then green. The
red phase of task 1 ran against a deliberately always-clean analysis module
and failed six of nine cases, so the suite is measured against the mutant the
phase exists to catch. No gate was weakened: no census pin, no threshold
override, no suppression, no coverage exclusion.

### Wave 10 source complete — census reconciliation pending

Stopped at: completed `05-21-PLAN.md`. Resume file: none. The only Wave 10 plan
has landed, so the tree is frozen for the parent reconciliation.

Full unit run after 05-21: 6266 tests, 6264 pass, 2 fail. Both failures are the
`tests/architecture/unowned-exports-census.test.ts` pin-equality gates, red by
design until the parent applies its single pin edit. Integration: 32/32, exit 0.
`npm run fallow` exit 0. Every direct owner touched measures hit == found. The
net -1 test count is four retired branch/remote wrapper cases minus three new
launcher, construction-purity and composition cases.

The wave's contribution to the parent's one pin edit is four identity removals
from `tests/architecture/gate-targets.ts` and zero additions, taking the live
production census 7 -> 3:

- `platform/git-credential.ts`'s `createCredentialOps`.
- `platform/git.ts`'s `buildAuthCallbacks`, `listBranches` and `listRemotes`.

Both keys lose every member, so both keys go. The exact identity strings are
listed in `05-21-SUMMARY.md`.

The three survivors are exactly Wave 11's (05-28): `index.ts|default`,
`RingBuffer.read` and `scripts/check-phase-06-hub-ledger.mjs`. None of the
three moved under 05-21.

**Registry work the parent still owns.** `platform/git-auth-callbacks.ts` is a
new credential-handling module that no AUTH-09 scan names. Adding it to
`CREDENTIAL_LEAK_TARGETS` also requires extending the positional destructuring
and `DECLARED_MODULE_ORDER` in `no-credential-leak.test.ts`, plus a scan for
the module. `05-21-SUMMARY.md` records the per-gate verdicts.

## Operator Next Steps

- Execute Phase 5 in approved dependency waves, retaining public assertions and exact coverage.
- Complete Phases 6–8; reconcile every authorized item before milestone close.

## Active Session — test-backlog

- Authorized: all ten handoff items; Phase numbering restarts at 1.
- Preserve local configuration/setup edits.
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

Plan 06-14 is the second repair plan and cleared the `shared` owner group. The
two hand-written `{ cause?: unknown }` mirrors in `shared/errors-bridges.ts` take
the ambient `ErrorOptions` the rest of the error family already annotates. The
`(marketplace, plugin)` pair spelled three times in that same file collapses onto
one `PluginCoordinate`, so the surviving declaration is the one production
reads -- the frozen copy, its freeze assertion and the refusal-message bytes are
untouched, because two suites assert them. `Phase3Failure.cause` is gone on
measured evidence: its three siblings carry production witnesses reaching them
through `Omit<Phase3Failure, "cause">`, while `cause` -- the one member that
`Omit` removes -- carries none, and `update-flow.ts`'s `rollbackPartialCauseSlot`
reads the narrower `UpdatePhase3Failure.cause` instead.

`CommandContext`, `dispatchRow` and the reconcile emitter each ran an `Extract`
filter over an unbounded type parameter; bounding the parameter by
`PluginNotificationMessage` made each one a selection the contract engine
accepts, with all 21 instantiations across 16 orchestrator files unchanged. The
reconcile emitter's intersection bound was drafted as a `type-refinement` first
and the engine REFUSED it by name ("does not narrow status"); the bound was
re-expressed as a selection rather than dropped, and a control measured under the
old bound, the new bound and no bound proves nothing was lost. The fallback
severity write now goes through a mapped view over the row's own declared slot,
and `isDescriptionBearingRow` narrows by the status discriminant its runtime map
already keys on, with the status set derived from that map.

Live population 113 -> 103, measured by a `(path, owner, key)` set difference at
every task: ten rows lost, zero gained. Contracts 81 -> 85 (four accepted, one
refused and recorded). `06-LIVE-TRIAGE.md` is regenerated against digest
`90d45a1f` at revision `12d3292e` and `--check` reports 103 problems that are ALL
`unread` -- zero stale, missing, duplicate, incomplete or invalid. Production
aggregate unit coverage holds at 1,834/1,834 functions and 9,050/9,050 branches
with no module below 100%, and both direct pins matched exactly. The one `shared/`
row still standing is `shared/fs-utils.ts:225:32`, which 06-10 owns and must move
together with its three bridge declaration sites. Next is 06-10.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 06 P02 | 1h 50m | 3 tasks | 4 files |
| Phase 06 P03 | 2h 0m | 2 tasks | 5 files |
| Phase 06 P04 | 2h 20m | 3 tasks | 6 files |
| Phase 06 P05 | 50 min | 2 tasks | 4 files |
| Phase 06 P06 | 3h 10m | 2 tasks | 8 files |
| Phase 06 P09 | 1h 11m | 3 tasks | 12 files |
| Phase 06 P14 | 1h 37m | 4 tasks | 11 files |
| Phase 06 P11 | 1h 16m | 3 tasks | 7 files |
| Phase 06 P13 | 78 min | 3 tasks | 7 files |
| Phase 06 P12 | 2h 54m | 7 tasks | 28 files |
| Phase 06 P15 | 4h 20m | 7 tasks | 9 files |
| Phase 06 P16 | 5h 5m | 5 tasks | 6 files |
| Phase 06 P08 | 3h 52m | 3 tasks | 16 files |
| Phase 07 P01 | 1h 26m | 3 tasks | 6 files |
| Phase 07 P02 | 1h 57m | 3 tasks | 12 files |
| Phase 07 P03 | 50m | 2 tasks | 5 files |
| Phase 07 P04 | 1h 45m | 3 tasks | 9 files |
| Phase 07 P05 | 1h 59m | 3 tasks | 12 files |
| Phase 07 P06 | 1h 40m | 3 tasks | 7 files |
| Phase 07 P07 | 1h 12m | 2 tasks | 8 files |
| Phase 07 P08 | 2h 21m | 3 tasks | 14 files |

## Decisions

- [Phase 06]: The three new exemption categories stay separate — `satisfies-constraint`, `schema-pin` and `external-mirror` name three different artifacts and make three different refusals, and one merged category would have to accept on the weakest of the three
- [Phase 06]: `external-mirror` claims only what was measured, that the compiler compels a mirror member's SHAPE and not its presence, and refuses a REQUIRED upstream slot by name so it cannot become a soft substitute for `external-input`
- [Phase 06]: The arrival walk carries the key a destructuring selected, and containment alone does not answer while a key is carried — the question becomes whether the origin is what arrived in that slot, which the surrounding syntax cannot settle
- [Phase 06]: `deepestSourceHop` was NOT raised to clear a row — the live chain was measured to need exactly eight, and a bound raised to fit is the shape of permissiveness the whole phase exists to avoid
- [Phase 06]: A predicate no permissive mutant can break is not yet a refusal — four of this plan's thirteen mutants broke nothing until a sharper counterexample was derived for each
- [Phase 06]: An invalid contract is an exit-2 setup failure, not an exit-1 finding, which keeps "the gate cannot answer" apart from "this member is unread" — The research fail-closed list names invalid contracts alongside a malformed tsconfig; treating a stale contract as a finding would let it be triaged away instead of fixed
- [Phase 06]: A type-selection contract covers the filter literal own member, not the union discriminants it selects on — Measuring the inventory showed Extract<Msg, { status: K }> contributes its own status member that no runtime syntax can read, while the variants status members are ordinary discriminants real code switches on
- [Phase 06]: Contract identity is settled through the inventory declaration map, never through the coordinate string alone — A coordinate only locates syntax; requiring the node found there to be the one byDeclaration recorded is what stops a drifted entry from being proved against the wrong member
- [Phase 06]: A whole-object operation is settled by the declaration the checker resolved, and a local wrapper earns the same summary only from its own body, applied at the call site — Resolving by name would let any function called stringify or deepStrictEqual excuse a member; applying the summary at the call site is what keeps a record alive through an unknown-typed parameter
- [Phase 06]: push, unshift and fill are directed element writes, not whole-object reads — Placing a value into an array reads none of its members; 73 of the 76 unmodeled container rows were push, and crediting them as bulk reads would have accepted records that were only stored
- [Phase 06]: Provenance is traced from the operand only; members below it are credited on the operand own declaration — Tracing nested paths exhausted a tenfold transfer budget on the live tree; the bound under-credits, which leaves a finding to investigate rather than accepting a member
- [Phase 06]: An inventory and a verdict are different answers, so they are different commands: --inventory always succeeds and states its own limits, --check fails every unresolved row.
- [Phase 06]: A member settled by a production witness needs no recorded disposition; only the 483 rows resting on judgment do, of 3,464 candidates.
- [Phase 06]: The audit fingerprint covers analysed source only, because an analyzer change is caught more precisely by per-row status reconciliation than by a digest.
- [Phase 06]: A carried explanation is dropped when its row status moves, since the prose was written about a row that no longer exists.
- [Phase 06]: An async body that hands back another promise hands back what that promise fulfils, so its value sits where its own awaited value does rather than one await deeper
- [Phase 06]: A key exactly one arm of a union declares can only have come from that arm; two arms spelling one key stay unsettled and resolve to nothing
- [Phase 06]: type-refinement is a fifth contract category, separate from type-selection, because narrowing a slot an intersection already declares is different evidence from selecting a variant
- [Phase 06]: `never` admits nothing, so its constituent set is empty — that is what makes an absence marker a narrowing, while a marker over a slot the rest already closes compares empty against empty and still narrows nothing
- [Phase 06]: conditional-clause is a sixth contract category rather than a widening of type-selection, because both live rows fail that prover's own downstream checks and absorbing them would weaken the discriminant proof fifty-plus entries rest on
- [Phase 06]: A whole-object comparison settles an ambiguous key only through a discriminant value that leaves exactly one arm standing, and only for keys the comparison actually names; the single-arm place rule and the production-lineage requirement are untouched
- [Phase 06]: Production lineage follows a name bound to a factory call through to the function that call returns, and through nothing else; a factory returning a name reaches nothing, which under-credits by design
- [Phase 06]: A refusal the unchanged engine already makes is proved discriminating by writing the permissive variant of the prover and measuring which controls break, because such a control cannot fail RED by construction
- [Phase 06]: An engine widening in the opt-in contract layer is measured clearing zero rows with no entry written — a free, exact permissiveness control that all four contract-layer changes in 06-15 passed
- [Phase 06]: The live closure is honest rather than complete: 138 members really are unread, each recorded with its evidence and an owner repair plan, rather than excused by a widened proof
- [Phase 06]: A published duplicate is repaired by aliasing it to the declaration its reads already resolve to, never by deleting the published name — structural compatibility is not a read (D-03), so the fifteen AsyncRewakeEntry rows leave the population without the runtime row's own count moving
- [Phase 06, superseded by 06-15]: `WriteHookConfigResult.written` stays unread on purpose: nine `assert.deepStrictEqual` sites read the whole result, so the row is an analyzer under-credit, not a dead member — `assertionSummary` demands production lineage and `isProductionDerived` does not reach production through a factory-returned closure, which the sibling `RemoveHookConfigResult.removed` proves by carrying two deep-comparison witnesses from the same file
- [Phase 06]: A repair's delta is measured by a `(path, owner, key)` set difference against a pre-edit baseline, not by comparing totals — a flat total would hide a repair that pushed some other member into `unread`
- [Phase 06]: A repeated inline shape is repaired by collapsing it onto one named declaration, not by deleting the copy a test asserts — `AgentOwnershipConflictError.stagingFor` is read by two suites and frozen against caller mutation, so the dead rows were the duplication, not the field
- [Phase 06]: An `Extract` filter over an unbounded type parameter proves nothing, because the parameter stands for everything; bounding it by the union the filter selects within is what makes the selection contract available
- [Phase 06]: A `type-refinement` proof cannot reach a slot typed by a type parameter — `narrows()` asks whether the refined constituents are a strict subset of the wider ones, and a type parameter is not one of the union's constituents; measured as an exit-2 refusal, and answered by re-expressing the bound as a selection rather than by dropping the constraint
- [Phase 06]: `Phase3Failure.cause` is a genuine dead slot, not an analyzer under-credit — its three siblings carry production witnesses reaching them through `Omit<Phase3Failure, "cause">`, so the model demonstrably reaches the declaration, and `cause` is the one member the `Omit` removes
- [Phase 06]: The `external-output` contract category cannot prove a payload returned from a Pi tool `execute` written as a method shorthand — `getContextualType` answers `undefined` for a `MethodDeclaration`, so the prover finds no external signature even though the enclosing object literal resolves to `ToolDefinition` — Measured against the real engine on all six tool payload slots: the origin half passed for every one, the boundary half for none. Widening the prover or converting `execute` to an arrow-function property would change working code to suit the analyzer, so the rows stay findings
- [Phase 06]: A conditional-type `extends` clause is not the two-argument selection `type-selection` proves, so `ParsedCommandArgs.required` and `PiToolName.toolName` both stay findings rather than being restated as `Extract` selections — `selectionOf` requires the filter literal parent to be a `TypeReferenceNode` with two type arguments; rewriting a public generic every command handler argument parse flows through, purely to fit the analyzer, is the failure mode this phase exists to prevent
- [Phase 06]: An interface slot with no calling syntax anywhere is dead surface even when a structural twin implements it — the twin keeps its own verdict and no finding is gained — Removing `LocationsResolver.marketplaceNamesCachePath` left `LocationsResolverLike.marketplaceNamesCachePath` `test-only-observed`, not unread, so the edge repair cost the orchestrators group nothing and the twin is a recorded hand-off rather than a silent deletion
- [Phase 06]: `narrows()` cannot prove a `never` pin over a non-union slot — `constituentsOf` returns `[type]` for a non-union, so `never` counts as ONE constituent against `string`'s one and the `chosen.length < allowed.length` test fails — Measured against the real engine on three markers after the R4 restatements got them past the `widerSlotFor` refusal 06-06 recorded; `true` over `boolean` passes because `boolean` genuinely has two constituents, which is why the sibling `partialable` pin was accepted
- [Phase 06]: A restatement the engine refuses is REVERTED, not shipped — reshaping production source to satisfy a proof the prover would not accept is the failure this phase exists to prevent, and a churned exported type that cleared no row is worse than leaving working code alone
- [Phase 06]: `RemoveMarketplaceOutcome.name` stays because three `deepStrictEqual` assertions observe it, NOT because its sibling keeps one — `AddMarketplaceOutcome.name` is read at `reconcile/apply.ts:332` for a documented CR-01 reason (the add outcome's name is manifest-derived and need not match the declared key) that remove has no analogue for, so the production symmetry was measured and found not load-bearing before the row was recorded
- [Phase 06]: A slot a rollback path populates is behaviour even with no reader today — `UpdatePhaseFailure.msg` is unread by every survey, but the phase-3 aggregation is its only writer and the surface's own header states its contract, so it is recorded rather than deleted
- [Phase 06]: A ledger note that survives re-keying is still verified against the fresh report — nine notes named a witness coordinate, a witness count or a contract category the tree no longer held, and `--check` certifies such a note as `explained` without ever checking it
- [Phase 06]: The architecture allow-list decides WHICH of two mirrored declarations survives a collapse — `bridges-hooks -> domain` is permitted and `domain -> bridges` is not, so the anchor triple's domain declaration had to be the survivor; `edge -> orchestrators` is permitted and the reverse is not, so the seam's orchestrator declaration had to be. The collapse never runs against the graph that created the duplicate
- [Phase 06]: A collapse blocked by a DIFFERENT gate is left standing with the blocking finding quoted, not forced through — aliasing `edge/completions/data.ts::LocationsResolver` removes the only in-extension reference to `MarketplaceStateRecord` and `fallow dead-code` exits 1 on it; both published alias forms were measured producing the identical finding, and a `fallow-ignore`, a manufactured consumer and an edit to the three consuming test files were each refused in turn
- [Phase 06]: A staged repair stops at the step that worked — step A (aliasing the bridge twin alone) cleared both anchor rows, so `PathAnchorContext` was left untouched and `glob.ts` appears in no commit; the phase does not churn source without a measured row to show for it
- [Phase 06]: A coverage figure that moves is explained line-for-line before it is accepted — lcov `LF` tracks total source lines, so a net +46 comment lines is +46 `LF` and +46 `LH`, while functions (1833/1833) and branches (9049/9049) stay byte-identical, which is what a type-level change must produce
- [Phase 06]: 06-15's grouping of the two `ResolveHookIfContext` rows under a `satisfies`-constraint category was mis-assigned — they were a duplicate declaration with a legal collapse direction and cleared with no engine change at all; only the two `hook-if-targets.ts` rows in that group were genuinely `satisfies`-constrained
- [Phase 06]: The analyzer never excuses a member and the record never stops counting one — a separate per-row recorded-decision layer in the CLI applies exact member coordinates to the exit status alone, so `--inventory` and `--check` still report all five as unread
- [Phase 06]: A residual allowance is made un-widenable by the SHAPE of its file — the identity field admits no glob metacharacter and any sixth field is a setup failure, so a count, a threshold or a path pattern cannot be written down at all
- [Phase 06]: An allowance that matches no reported finding refuses the run — the list self-expires instead of outliving its reason, so a repaired member takes its own allowance with it and a drifted coordinate fails rather than excusing whatever moved there
- [Phase 06]: The gate and its negative controls both ride the mandatory npm check chain, but pre-commit splits them across two triggers — the negative runner costs five whole-program analyses (6m50s, 2.12 GiB) and its subject is the gate machinery rather than the tree, so no ordinary edit under extensions/ can change its answer

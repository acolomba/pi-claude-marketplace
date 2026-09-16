---
gsd_state_version: "1.0"
milestone: test-backlog
current_phase: 06
current_phase_name: Unused Type Member Gate
status: executing
stopped_at: Completed 06-10-PLAN.md
last_updated: "2026-09-16T01:25:00.000Z"
last_activity: 2026-09-16
last_activity_desc: Plan 06-10 complete (three artifact bridges + fs-utils repaired, 103 -> 90 unread measured, zero findings gained)
state_head: 9046b74f
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 60
  completed_plans: 48
  percent: 63
milestone_name: test-backlog
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-13 after the refine-unit-tests milestone)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 06 — Unused Type Member Gate

## Current Position

Phase: 06 (Unused Type Member Gate) — EXECUTING
Plan: 11 of 14
Status: Executing the six bounded repair plans (06-09 ✅ -> 06-14 ✅ -> 06-10 ✅ -> 06-11 -> 06-13 -> 06-12)
Last activity: 2026-09-16 — Plan 06-10 complete (three artifact bridges + fs-utils repaired, 103 -> 90 unread measured, zero findings gained)

Plan 06-01 landed the member gate's compiler tracer: `node
scripts/check-unused-type-members.mjs` compiles the project once, inventories
production member declarations, and matches runtime observations back to those
exact declarations through checker symbols. Classification is by syntax before
symbol. Exit 0 is clean, 1 is unread or unsupported members, 2 is a setup or
internal analysis failure, and a budget cutoff takes the third path so it can
never read as clean.

Plan 06-02 added directed value transfers in
`scripts/check-unused-type-members.flow.mjs`. Each recorded read is traced
backwards through edges that exist only where a value actually moved: arguments
to resolved parameters, initializers, assignments, object and array
construction, returns, callbacks in both directions, and containers — arrays,
tuples, promise fulfillment and Map/WeakMap values. Structural compatibility
alone transfers nothing, edges are one-way, and a tuple neighbour or a map key
receives no credit. A call whose target is invisible and a container operation
with no directed semantics each raise a bounded gap rather than reading clean.

Plan 06-03 added the contract engine in
`scripts/check-unused-type-members.contracts.mjs`, supplied to the analysis
through 06-01's `contractEvaluator` seam by the real command-line tool. An
exemption has to be earned: the entry names one exact declaration, settled
against the inventory's declaration map rather than its coordinate string, and
brings the evidence its category demands. An external output must be built at
the named origin and arrive at a return the compiler checks against an installed
declaration, directly or along 06-02's transfers. An external input needs a
required upstream slot and a callback the compiler really checks; an optional
slot or an asserted cast proves nothing. A nominal brand needs a key symbol no
other module can spell plus a type no ordinary value satisfies. A type selection
covers the filter literal's own member and needs a source that discriminates on
that key. Stale, contradictory, duplicate, wildcard, unknown-key, wrong-version
and read-redundant entries are refused as exit-2 setup failures, which keeps "we
cannot answer" apart from "this member is unread".

`scripts/check-unused-type-members.contracts.json` ships with no entries by
design; live ones are 06-06's after the tree is reconciled.

Plan 06-04 added whole-object operations in
`scripts/check-unused-type-members.operations.mjs`. An operation is settled by
the declaration the checker resolved -- a default-library interface for
`JSON.stringify` and the `Object` enumerators, an ambient `assert` module for the
deep comparisons -- so a local function carrying the name summarises nothing. A
local wrapper earns the same summary only by passing one of its own parameters
into an already-summarised operation, and the summary is applied at the call site
against the argument written there, which is what carries a caller's record
through an `unknown`-typed parameter. A body changed to discard or return its
input loses the summary with it. Copies are shallow and a rest copy omits the
keys the pattern named; a deep comparison credits only the operand whose value
came out of production code, so a typed fixture a test wrote for itself proves
nothing. Two refusals replace credit rather than shrinking it:
`unmodeled-serializer-options` for a run-time replacer or a `toJSON` member, and
`unproven-own-properties` where an accessor or a class constituent makes
own-enumerability unprovable. All 76 of 06-02's unmodeled container rows are now
explained: 73 were `array.push`, which is a directed element write and not a
bulk read, and `sort`, `reverse`, `splice`, `flat` and `entries` are modelled by
their real result semantics. `reduce` stays unmodeled and still raises its gap.

Live run now 3,464 candidates, 2,981 runtime-observed, 222 test-only, 0
explicit-contract, 261 unread, 0 unsupported -- 468 findings down to 261. The run
takes 80.2 s and peaks at 2.05 GiB, spending 2,889,809 of a 12,000,000-step
transfer budget over 82,164 traced reads and 939,556 operation reads. Still
interim: 06-06 reconciles every remaining row. `lint:type-members` exists as a
package alias but is deliberately NOT in `npm run check` until 06-08.

Plan 06-05 added the closure audit in
`scripts/check-unused-type-members.audit.mjs` and recorded the live population.
It separates two answers a single count cannot give. `--inventory` records the
complete current population, always succeeds, and says in its own output that it
is not a clean-gate verdict. `--check` re-runs the analysis, recomputes the
source digest from disk, and fails eight distinct ways: `unread`,
`unsupported`, `missing`, `duplicate`, `stale-source`, `stale-record`,
`incomplete` and `invalid`. Neither command can change an analyzer verdict.
A recorded explanation is carried across a regeneration only when its row's status
did not move.

`06-LIVE-TRIAGE.md` records 3,464 candidates over 236 production files, bound to
digest `08023619` over 602 hashed source files at revision `0dc3666b`. 483 of
those rows need a disposition -- 261 unread plus 222 test-only -- and every one is
still pending, which is exactly what `--check` reports today: exit 1 with 744
problems and zero stale, missing, duplicate or invalid rows. The inherited
261 / 0 / 261 baseline holds exactly; the inventory takes 77.4 s at 2.00 GiB and
the check 81.7 s at 2.04 GiB.

All four current `EdgeDeps` members are runtime-observed, including the optional
`importClaudeSettings`, which a directed transfer settles through
`edge/register.ts:103`. Leads handed to 06-06: `kind` is the largest unread key
at 46 rows and a window scan puts 76 of the 261 inside an `Extract<>`/`Exclude<>`
selection filter, which is the contract engine's `type-selection` category.
`lint:type-members:audit` is a real package entry and is deliberately not in
`npm run check`.

All five analyzer suites pass together at 134/134 (06-03's 101 plus 33 new).

Plan 06-06 reconciled the live population. Two directed-flow corrections came
first, both found by reading diagnostics against source. An async body that
hands back another promise hands back what that promise fulfils, so its value
sits where its own awaited value does; placing it one await deeper consumed the
reader's await twice and dropped the rest of the chain. And a key exactly one
arm of a union declares can only have come from that arm, so it now resolves
there -- the checker answers a union only when every arm has the key, which left
the success-beside-failure relay shape unanswered. Two arms spelling one key
stay unsettled and resolve to nothing. Together they moved 42 rows out of unread
and upgraded 10 test-only rows to runtime-observed, with nothing moving the
other way.

The contract engine gained two proofs. A selection resolves a type-parameter
source through its bound, because the bound is the set the filter selects
within. `type-refinement` is a fifth category, separate from `type-selection`: a
member earns it by sitting in an operand of the named intersection, naming a
slot the rest of the intersection already declares, and writing a type there
that admits strictly less -- including a refinement nested one level inside a
refined slot, and including insisting on a slot the rest lets a value omit. An
intersection that adds a slot, or restates one unchanged, is refused by name. A
discriminant proof now needs two spellings to differ rather than every spelling
to be unique, and a filter site descends through a node that shares its start.

`scripts/check-unused-type-members.contracts.json` now carries 81 live entries --
62 selections, 17 refinements, 2 brands -- each accepted by the engine against
this tree before being written. Of 88 drafted, 7 were refused and all 7 stayed
findings.

Live run now 3,464 candidates, 3,009 runtime-observed, 236 test-only, 81
explicit-contract, 138 unread, 0 unsupported. 82.1 s at 2.05 GiB, spending
3,001,672 of a 12,000,000-step transfer budget -- four times the measured cost,
recorded with its rationale beside the constant. `06-LIVE-TRIAGE.md` is bound to
digest `ba06bb95` over 603 hashed files at revision `77629eb2`, and all 455 rows
that need a reader to agree with them carry recorded evidence. `--check` exits 1
with exactly 138 problems, all `unread`: zero stale, missing, duplicate,
incomplete or invalid.

The 138 are named findings with owners, not an unexplained baseline. Six bounded
repair plans are required before 06-08 can activate the gate: 06-09
(`bridges/hooks`, 26 rows, the `AsyncRewakeEntry` duplicate), 06-10
(`bridges/{agents,commands,skills}` plus `shared/fs-utils.ts`, 13 rows, the
`renamed[].from` dead field), 06-11 (`edge`, 17), 06-12 (`orchestrators`, 49),
06-13 (`domain`, `persistence`, `platform`, 23, including the locally asserted
Pi mirrors) and 06-14 (`shared`, 10). Closure then has to be re-run and reach
zero.

06-06 also repaired an inherited break: `tests/architecture/partial-vocabulary-guard.test.ts`
had been red since 06-05's audit test spelled the retired `"unsupported"` status
literal as the name of one of the audit's own refusal categories. A fourth
`homonym` waiver, the guard's designed mechanism, brings `npm run check` back to
exit 0. No production source under `extensions/` was touched by this plan.
Typecheck, lint, format, all four fallow links and both corresponding-test gates
are green. No production source under `extensions/` changed in 06-02, 06-03 or
06-04, so the wave's aggregate production unit coverage snapshot still holds.

Plan 06-07 proved the gate on the declaration the project ships.
`scripts/check-unused-type-members.negative.mjs` plants an unread optional
member into the REAL `EdgeDeps` interface through a compiler read overlay,
taking the insertion point from the interface's own last member and counting the
expected identity out of the overlay text rather than reading it back from the
analyzer. The real command-line tool then reports
`extensions/pi-claude-marketplace/edge/types.ts:31:3` by exact declaration
record, over and above the honest 138-row baseline; an optional-chain read from
the owner test turns the same declaration `test-only-observed` with one witness
at the probe's exact site; removing the overlay reproduces the baseline report;
and a same-spelling member on an unrelated type, read from production, leaves the
offender a finding while coming back `runtime-observed` itself. Two further
controls require a run the gate cannot complete -- an unparsable input and a
refused option -- to exit 2 with no report and a reason naming what it could not
read, which is what keeps exit 1 meaning a member verdict. Seven of seven
controls pass in 6 m 49 s at 2.11 GiB over five whole-program analyses.

The baseline the plan assumed does not exist: 06-06 closed at 138 unread, so
every control measures a delta against that recorded baseline instead of against
a clean run. `baseline` checks the gate's exit status against its own finding
count rather than against a literal 1, so the controls keep working unchanged
once the repair plans drain the population to zero.

The runner is itself measured. `--gate` points the controls at any executable,
and 21 suite controls drive stand-in gates that answer by invocation index: an
always-clean gate, one that always reports the same findings, one that describes
a different member at the planted coordinates, an unparsable report, an
executable that cannot be launched, a refusal where a finding belongs, a finding
where a refusal belongs, a refusal naming nothing, an unexplained diagnostic, and
one that clears the offender on an unrelated read. Each is rejected by name, and
the always-clean case is rejected on report content rather than on an exit
status. `tests/architecture/unused-type-member-gate.test.ts` adds the four guards
the executable controls cannot see from inside: the planted key must stay absent
from the real declaration, the benign probe's receiver type must stay importable
in the owner test, every gate script must stay reachable from a `package.json`
entry, and every capability the printed help claims must stay bound to a named
landed control.

The live population is unchanged -- 3,464 candidates, 138 unread, 0 unsupported,
81 contracts -- and `git diff 06ec0723..HEAD -- extensions/` is empty. The two new
suites are analysed input, so the triage digest moved from `ba06bb95` to
`671cb0ae` over 605 hashed files; `--inventory` re-recorded it and `--check`
reconciles again at exactly 138 `unread` with nothing stale, missing, duplicate,
incomplete or invalid. `npm run check` is exit 0 at 6,473 unit and 32 integration
tests. `lint:type-members:negative` is a real package entry and, like
`lint:type-members` and `lint:type-members:audit`, is deliberately NOT in
`npm run check`; 06-08 activates all three after the six repair plans land.

Plan 06-09 is the first of the six bounded repair plans and cleared the
`bridges/hooks` owner group by source repair alone. `AsyncRewakeEntry` became an
alias of `HooksRuntimeChildEntry` rather than a second declaration of the same
fifteen members; the four mirrored hooks-registration option bags became one
exported `RegisterHooksBridgeOptions`, which took the never-read `ctx` field with
it along with the extension factory's `{} as unknown as ExtensionContext`
placeholder and ~37 call sites; the `tool_result` patch now writes through the
event's own slots behind a `Partial<Pick<ToolResultEvent, "content" | "isError">>`
view instead of minting a single-member cast literal per write, with the CR-01
whitelist guards unchanged; and `HydratedScope.state` and `ChildLike.pid` were
removed.

25 of the 26 rows cleared. The live population is a measured 138 -> 113 unread,
0 unsupported, 81 contracts, at digest `c285cdee` over 605 hashed files, and the
delta was taken as a `(path, owner, key)` set difference against a pre-edit
baseline: 25 lost, **0 gained**. The candidate count moved 3,464 -> 3,434 and all
30 declarations are accounted for. `--check` reports 113 problems that are ALL
`unread`, with nothing stale, missing, duplicate, incomplete or invalid.
`npm run check` is exit 0, the seven negative controls still pass, aggregate
production unit coverage is 1,834/1,834 functions and 9,050/9,050 branches with
zero modules below 100%, and the two direct pins matched exactly.

The twenty-sixth row, `WriteHookConfigResult.written`, was deliberately left
standing. Nine `assert.deepStrictEqual` sites read the whole result, so the
inherited disposition's "no witness of any kind" is wrong about the tree; the
`--json` report shows neither member credited through those nine sites while the
sibling `RemoveHookConfigResult.removed` carries two `deep-comparison` witnesses
from the same file. The difference is that `writeHookConfig` is the closure
`createWriteHookConfig` returns, and `isProductionDerived`'s bounded backward
search does not reach production through a factory-returned closure. That is an
analyzer under-credit for its own bounded plan, not a source repair, and the row
is recorded that way in `06-LIVE-TRIAGE.md`.

Plan 06-10 is the third repair plan and cleared all 13 rows across the three
artifact bridges and the rollback helper. Ten of them were one dead field --
`renamed[].from` -- spread across four declaration sites: the input interface of
`rollbackReplacementCommon` in `shared/fs-utils.ts`, and in each bridge the
`*ReplacementInternals` handle, the local ledger array and the rollback-internal
parameter. All four narrowed in ONE commit, because `{ from, to }[]` is
assignable to `{ to }[]`: narrowing the helper alone compiles while leaving three
bridges describing a value it no longer declares, and nothing fails. Each rename
loop now pushes a fresh `{ to: pair.to }` rather than forwarding the wider
iterated element, and that the boundary is still guarded was exercised --
reinstating the source key is refused TS2353.

The remaining three were surplus slots on the staging input bundles:
`StageAgentsInput.resolved` and `marketplaceName` on both the commands and skills
inputs. These are the rows the triage marked "needs the owner to confirm", so the
confirmation is the load-bearing part. The decisive evidence is sibling
comparison: every OTHER member of all three interfaces carries a production
witness at its destructure site, so the model reaches these declarations and the
empty witness list is an absence of readers, not an absence of reach. The check
for 06-09's factory-closure under-credit came back negative. Excess-property
checking then named 120 sites across nine files, every one fixed by deletion --
no cast, no assertion, no widened parameter anywhere in the diff.

`update-swap.ts:177`'s vestigial `Omit<Phase3Failure, "cause">`, handed off
conditionally by 06-14, WAS simplified: the compiler-forced deletions put this
plan in that file anyway. It landed as its own commit.

Live population is a measured 103 -> 90 unread, taken as a `(path, owner, key)`
set difference against a pre-edit baseline at two points: 13 lost, **0 gained**.
Candidates 3,426 -> 3,413, runtime-observed held at 3,002, contracts held at 85.
All four owner areas now read 0 unread. `--check` reports 90 problems that are
ALL `unread`, none naming this plan's areas, with nothing stale, missing,
duplicate, incomplete or invalid, at digest `59f0fa76`.

Eight contract coordinate fields across four entries were re-anchored, and that a
mis-anchor is loud rather than quiet was exercised: re-introducing one pre-repair
coordinate makes the gate exit 2 with `names no declaration in this program`. The
`install-outcome.ts` direct pin was re-measured to `branches 109/111, lines
1040/1046` -- only the reading string, finding ids and reasons byte-identical, and
the uncovered branch count held at 2. `npm run check` is exit 0 with all four
fallow sub-gates, the seven negative controls pass, and aggregate production unit
coverage is 1,834/1,834 functions and 9,050/9,050 branches with zero modules below
100%; lines moved 62,919 -> 62,910, exactly the nine covered property lines
deleted from the three orchestrator build sites.

Sixteen disposition rows were re-keyed by the line shifts and restored from the
fresh report rather than transcribed -- eight of them carry a witness coordinate
that genuinely moved, so transcription would have written eight addresses nothing
is at.

Two measured defects were recorded in a new `deferred-items.md` rather than fixed,
neither in a file this plan owns. `tests/orchestrators/marketplace/remove.test.ts`
makes a `scope: "user"` call without a hermetic home and reads the operator's real
`~/.pi/agent/` state; with `schemaVersion: 3` there it fails 1 of 24, and passes
24 of 24 under an empty `HOME`. CI has no such directory, so it stays latent
there, but every gate in this plan was run with a hermetic `HOME`. Separately, six
ledger notes name a witness coordinate the fresh report no longer holds -- three
`bridges/hooks/routing-state.ts` rows and three `orchestrators/types.ts` rows, off
by 4 and 2 lines from earlier repairs in this phase. `--check` does not compare
note text against the report, so it is silent about them.

Phase 05 closed: all 28 plans landed and the production
dead-code census drained from 111 to 0 with zero net additions at every step.
Independent verification re-measured the start population from a clean archive
of `a8ef0dac` (111, matching the first committed pin), confirmed the pins are
empty because the tree measures empty rather than because identities were
allowlisted, and proved the gates discriminate with seven planted violations.
Aggregate production unit coverage held at exactly 100%: 62,889 lines,
1,834 functions, 9,050 branches, zero modules below 100%.

Independent code review of waves 5-11 returned 0 blockers and 5 warnings; four
were closed in `dfe78c9e`, `e2285f73`, `bf7584da`, `dcb16d40`. The one that
mattered: `production.deadCode` scoped cycle detection to the production entry
graph, so a cycle under `tests/` or `scripts/` was reported by nothing — measured
both ways, then fixed by adding a second `--no-production --circular-deps
--re-export-cycles` link to `npm run fallow` and pinning the split with a planted
offender. The credential scan re-aimed after `buildAuthCallbacks` moved was also
measurably inert; it now fails when its subject set is empty. The fifth warning
(persistence validation's `Errors()`-based fail-open shape) is the operator's
approved design and was recorded, not reverted.

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

**Last session:** 2026-09-15T18:21:06.728Z
**Resume file:** None

**Current work:** test-backlog on `features/test-backlog`. Phases 1–5 are complete.
Phase 6 has completed one of eight plans; Phase 7 plans are approved and follow it.
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

Stopped at: Completed 06-06-PLAN.md
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

## Decisions

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
- [Phase 06]: The live closure is honest rather than complete: 138 members really are unread, each recorded with its evidence and an owner repair plan, rather than excused by a widened proof
- [Phase 06]: A published duplicate is repaired by aliasing it to the declaration its reads already resolve to, never by deleting the published name — structural compatibility is not a read (D-03), so the fifteen AsyncRewakeEntry rows leave the population without the runtime row's own count moving
- [Phase 06]: `WriteHookConfigResult.written` stays unread on purpose: nine `assert.deepStrictEqual` sites read the whole result, so the row is an analyzer under-credit, not a dead member — `assertionSummary` demands production lineage and `isProductionDerived` does not reach production through a factory-returned closure, which the sibling `RemoveHookConfigResult.removed` proves by carrying two deep-comparison witnesses from the same file
- [Phase 06]: A repair's delta is measured by a `(path, owner, key)` set difference against a pre-edit baseline, not by comparing totals — a flat total would hide a repair that pushed some other member into `unread`
- [Phase 06]: A repeated inline shape is repaired by collapsing it onto one named declaration, not by deleting the copy a test asserts — `AgentOwnershipConflictError.stagingFor` is read by two suites and frozen against caller mutation, so the dead rows were the duplication, not the field
- [Phase 06]: An `Extract` filter over an unbounded type parameter proves nothing, because the parameter stands for everything; bounding it by the union the filter selects within is what makes the selection contract available
- [Phase 06]: A `type-refinement` proof cannot reach a slot typed by a type parameter — `narrows()` asks whether the refined constituents are a strict subset of the wider ones, and a type parameter is not one of the union's constituents; measured as an exit-2 refusal, and answered by re-expressing the bound as a selection rather than by dropping the constraint
- [Phase 06]: `Phase3Failure.cause` is a genuine dead slot, not an analyzer under-credit — its three siblings carry production witnesses reaching them through `Omit<Phase3Failure, "cause">`, so the model demonstrably reaches the declaration, and `cause` is the one member the `Omit` removes

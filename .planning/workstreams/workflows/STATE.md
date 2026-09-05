---
gsd_state_version: 1.0
milestone: workflows-replay
milestone_name: Workflow Bridge Replay onto main
current_phase: 112
current_phase_name: Install and removal lifecycle
current_plan: 112-03 (not started)
status: In progress
stopped_at: Completed 112-02-PLAN.md
last_updated: "2026-09-05T17:50:00.000Z"
last_activity: 2026-09-05
last_activity_desc: 112-02 complete - the sixth cascade slot, both partial-cascade record folds, removal pinned on all four verbs
state_head: 740da1cd7958d27ca26eb8a7c291c145e4b57e27
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 16
  completed_plans: 14
  percent: 33
---

# Project State

## Project Reference

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.

**Current focus:** Re-land the `workflows` bridge on a main that has moved under
it. Phases 101-105 shipped on `features/workflows-spike` and that branch was
never merged. Since then #154 declared `workflows` an *unsupported* kind, and
#167 replaced the test architecture the bridge was written against.

## Current Position

Phase: 112 (Install and removal lifecycle) — IN PROGRESS, 2 of 4 plans done
Plan: `112-01` and `112-02` complete; `112-03` is next
Status: `112-01` landed the tracer in four commits — `a025d5b4` the
`resources.workflows` record inventory, `d02db74b` the sixth ledger phase,
`6d01ed99` the rollback evidence, `6f8e1c6a` the closed-set widening. `112-02`
landed the removal side in three — `edb7007c` the sixth cascade slot and the
`dropped.workflows` axis on both returns, `246f855c` both partial-cascade record
folds, `ce4b98f9` removal pinned on all four verbs against real envelopes on
disk. `npm run check` is green end to end (unit 5413/0, integration 32/0) and
every file either plan touched holds at 100% direct coverage. Remaining:
`112-03` (reinstall's bespoke re-materialization), then `112-04` (the
age-bounded staging sweep).

**What `112-02` settled for `112-03`.** Every removal path clears workflow
envelopes from one edit to `cascadeUnstagePlugin`, so reinstall re-materializes
against a directory known to be clean of its own prior envelopes. A DISABLED
record deliberately RETAINS `resources.workflows` — the enable path reads that
inventory to displace its own envelopes aside rather than hitting the occupancy
refusal, and a case pins the asymmetry. `CASCADEAX-01` stays open: both folds
still read their `dropped` argument structurally and the hand-rolled one still
omits the hooks axis, so a SEVENTH axis would be dropped in silence again.

**Three facts `112-01` settled that the next plans depend on.** The record
carries a REQUIRED `resources.workflows` with a migrate default-fill and no
`schemaVersion` bump, so every removal path now has an inventory to read. The
sixth phase's undo removes only the names `onPlaced` REPORTED, and
`PathContainmentError` is not re-folded — it escapes `runPhases` by class and
bypasses the `capture` assignment, so the failure row carries no version and no
rollback-partial marker; a test pins that so a later reader does not repair it.
And the fallow allow-list edge is in place, so `112-02` and `112-03` may import
the bridge freely.

**Two things the next plans should know.** The typecheck worklist after the
schema edit was 67 errors across 30 files (the research predicted ~68), and the
one production site the research expected in `state-io.ts` did not materialise.
The complexity extraction the plan budgeted was needed — but on two TEST
helpers (`seedMarketplace` in `list.test.ts`, `writePluginComponents` in
`install.test.ts`), not on the install ledger body, which absorbed the sixth
phase without breaching either ceiling. Expect the same pressure on any fixture
that enumerates the record's resource axes by hand.

**One interaction to budget for.** The sixth phase reads
`stateSnapshot.marketplaces[mp].plugins[plugin]` once per install. Two existing
tests pin proxy read counts and both needed their reveal threshold moved one
read later so the sabotage still lands on `statePhase`.

**Unlike Phases 110 and 111, nothing is ported here.** Those two checked
production code out of `features/workflow-port-wip` verbatim and spent their
effort on owner tests. This phase writes new wiring against orchestrators main
rewrote after the spike branch was cut, and criterion 5 makes that a success
criterion rather than a style note.

Three measured findings shape it. **An unnamed prerequisite has to be commit
1**: `state.json`'s record schema has no `workflows` resources array, every
removal path removes by recorded name, and adding the field produces ~68 `tsc`
errors across 30 files. **Two fold sites the compiler will not catch** —
`applyPartialCascadeFold` and a hand-rolled duplicate in `remove.ts` read
`dropped` structurally and keep compiling while silently omitting a new axis;
this is a defect class the project has shipped repeatedly, now filed as
`CASCADEAX-01`. And **the disk-state undo test does not exist**: the assertion
appears in three places, all driven by a sibling-bridge failure, but the
workflows phase is the last bridge slot so its vehicle must be `statePhase` —
and the `statePhase`-vehicle tests assert only on the rejection. That gap is how
Phase 111's two data-loss bugs survived 100% coverage.

Phase 111 is complete and verified 9/9.
`b524524c` moved the version literal to `0.19.0` at all six sites — the
manifest, both lockfile records, the `EXTENSION_VERSION` constant, the
hard-coded literal in `tests/shared/extension-version.test.ts` (the site the
repository's own checklist does not name), the Sonar project version, and a new
`## [0.19.0]` changelog heading — plus the `.planning/PROJECT.md` prose site.
The bump opens the load-time backfill gate; the re-materialization behind it
runs through `reinstallPlugin`, which gains no workflows phase until Phase 112,
so **artifacts for records written by the last released version do not appear
yet**. `a3939034` turned the install-window assertion: it now drives the bridge
through its barrel and compares the `hello:greet` envelope as one whole object,
read back from `workflowsSavedDir`. The fixture body changed from a default
export (which the admission rule classifies `skipped`/`no-meta`, so no envelope
was ever written) to a named `meta` export. A negative control confirmed the
case goes red when the old body is restored. The positive precondition's three
assertions are byte-identical; only its comment, which named a deleted ENOENT
assertion, was rewritten.

Phase gate: `npm run check` green end to end (unit 5378/0, integration 32/0),
`npm run test:corresponding` passing, `pre-commit run --all-files` leaving no
file modified, and all six touched pairs at complete direct coverage —
discover 56/56, stage 61/61, unstage 8/8, barrel 25/25 lines, locations 20/20,
errors-bridges 13/13.

Two items ride forward. **The end-to-end stale-record repair is not observable
in this phase** and goes to the milestone's live acceptance testing. **The
duplication remedy at pull-request time is a `sonar.cpd.exclusions` entry citing
`port/README.md`, explicitly not a shared-helper refactor** — `fallow dupes`
measures zero new duplicated lines for this bridge.

Phase 112 inherited two carriers and `112-01` closed both. The two explicit
bridge calls in `tests/integration/workflow-kind-inversion.test.ts` are gone,
replaced by the install-driven path; the ENOENT assertion beside them, which
claimed the install materialized nothing, became the assertion its own comment
described. And `"bridges-workflows"` is in the `orchestrators` zone's `allow`
array, landed in `d02db74b`, the commit that first imports the bridge —
verified load-bearing by removing the string and watching `fallow dead-code`
exit 1 naming both new edges by file and line.

Earlier in the phase, `111-01` landed the path layer, `111-02` landed the
bridge's read half — `bridges/workflows/{types,discover,unstage}.ts` with their
three owner tests, the `bridges-workflows` fallow zone triple, and the one
behavior this phase authors, the criterion-4 admitted-but-caveated warning row
for a stem-fallback script — and `111-03` completed the bridge with
`bridges/workflows/stage.ts` and `bridges/workflows/index.ts` (`6981b2b4`), 24
cases in `stage.test.ts` and 5 in `index.test.ts`. No branch proved unreachable
and no `fallow-ignore` marker was added anywhere in the phase.

Two findings the research measured in a probe worktree shape this phase.
**Criterion 9 could not be satisfied as written**: `tests/integration/workflow-kind-inversion.test.ts`
still passes with the complete bridge present, because nothing drives the bridge
from `installPlugin` until Phase 112 — and the fixture ships
`export default { name: "greet" }`, which admits as `skipped`/`no-meta`, so no
envelope would be written in any phase. Resolved to Option A: invert against an
explicit bridge drive now and fix the fixture body, rather than defer. **The
version bump has six sites, not the five CLAUDE.md names** — `tests/shared/extension-version.test.ts`
is the one the checklist misses.

Phase 110 is complete and verified 20/20.
`110-01` landed the tracer: `platform/workflow-home.ts` with
its relocation seam deleted, `domain/workflow-project-key.ts` unedited, and both
owner tests, in two commits (`df7b9be8`, `ed756b8f`). `110-02` landed
`generatedWorkflowName` and `WorkflowNameCollisionError` in one commit
(`2152a2aa`), with the ported engine-parity wrapper completed from two clauses
to six. `110-03` landed `acorn` at `^8.16.0`, `domain/workflow-script.ts` and
its 51-case owner test as one atomic commit of exactly four paths (`d3c5be6f`).
The whole gate chain is green, all five pairs the phase touched are at complete
direct coverage, and Phase 109's five inverted files plus all Phase 111
territory are provably untouched. Then thirteen code-review fix commits followed across two review iterations
(`101478f3`..`af1634ea`), and the verifier re-ran the whole chain live: typecheck
0, ESLint 0, all three fallow sub-gates, Prettier, both corresponding-test
gates, `npm test` at 5303/0, `npm run test:integration` at 32/0. Next: Phase 111 (the
workflows bridge).

**The phase mechanism is proved and reusable.** `110-01` ran it end to end:
path-scoped `git checkout features/workflow-port-wip -- <one file>` (never a
directory, never `extensions/`), the five-file blast-radius assertion
immediately after, an owner test that imports every export by name so
`fallow dead-code` stays clean without a suppression marker, 100% direct
coverage per pair, and the full chain before each commit.

**WPTH-02 does not close in this phase.** `110-01` proved only its provable
half — the storage root is home-derived, reads no `cwd` and reads no
environment override. The "legacy project path is never written" guarantee is a
Phase 111 property of `persistence/locations.ts` and
`bridges/workflows/stage.ts`. `110-01-SUMMARY.md` §WPTH-02 carry-forward has
the detail; the requirement should be re-scoped or split rather than marked
satisfied on Phase 110's evidence.

**WNAM-03 does not close in this phase either.** `110-03` delivered its
classification half — a script with no `meta` is `skipped` with cause
`no-meta`, pinned by three cases and by the case that keeps it apart from
`refused`/`unparseable`. The *warning* half (surfacing that skip to the user)
and the "and not installed" half are both Phase 111's: nothing in Phase 110
emits anything to a user and nothing in it installs. `110-03-SUMMARY.md`
§WNAM-03 carry-forward has the detail; `requirements-completed` there lists
WNAM-01, WNAM-02, WNAM-04 and WNAM-05 and deliberately omits WNAM-03.

**T-110-17 is accepted, not mitigated.** `admitWorkflowScript` places no size
or depth cap on the source it hands to acorn. The host engine has none either,
and matching its posture is the current decision — a cap stricter than the
engine's would refuse a script the engine accepts, and only the lax direction
self-corrects across engine upgrades. Recorded as a candidate for Phase 115
(admission-gate hardening), not as a Phase 110 gap.

Phase 109 remains complete and verified 12/12; the inversion is live, the whole
test tree agrees with it, and `npm run check` was green end to end at its close.

**The measured WNAM-06 defect is CLOSED.** The port's
`assertSafeSavedWorkflowName` claimed `assertSafeName` covered the engine's
remaining `isSafeSavedWorkflowName` clauses. It did not: `assertSafeName` screens
only `charCode < 0x20 || charCode === 0x7f` plus `/` and `\`, so a plain space
and every `\p{Cf}` code point passed it and the engine then rejected the
generated name. `110-02` closed it red-first — four parity rows written before
any production edit, observed failing 4-of-78 against the ported wrapper — then
added the `/[\s/\\\0]/u` and `/[\p{Cc}\p{Cf}]/u` screens so the wrapper carries
all six engine clauses. The wrapper now matches engine 3.10.1 exactly rather
than exceeding it, and its docblock cites that version.

**One item rides to pull-request time, not to `110-03`.** `fallow dupes` now
reports a new clone family in `domain/name.ts` ("2 groups, 70 lines", tree total
928 lines / 1.4%) because `generatedWorkflowName` deliberately mirrors
`generatedSkillName`. `fallow` exits 0, so no local gate fails, but
`sonar-project.properties` does not list `domain/name.ts` in
`sonar.cpd.exclusions` — expect a SonarCloud Duplicated Lines condition on the
PR. The remedy is that exclusion entry with the `port/README.md` rationale, NOT
a refactor into a shared colon-name helper: WNAM-06's 2026-09-04 amendment
explicitly declines that mechanism, and main has since taught
`generatedCommandName` nested-path and empty-head rules a flat workflow caller
can never produce.

Last activity: 2026-09-05 — Phase 111 verified 9/9 and marked complete; the
next step is `/gsd-plan-phase 112`

**The D-109-06 window is CLOSED.** Phase 111 landed `bridges/workflows/` and
bumped `EXTENSION_VERSION` to `0.19.0`, discharging both obligations Phase 109
deferred forward. A workflow-bearing plugin still resolves `installable` and
renders `● (installed)` with no brace, but the bridge now materializes its
envelopes — `tests/integration/workflow-kind-inversion.test.ts` asserts the
envelope IS written, with the old ENOENT assertion repositioned between the two
acts so it proves the transition rather than the end state alone. The verifier
reproduced the negative control: restoring the old fixture body turns the case
red, so the inverted assertion is not vacuous.

**The A-03 prohibition is spent.** It forbade bumping `EXTENSION_VERSION` *during*
the window, because the bump fires the `supportedSetGrew` convergence and no
bridge existed to materialize anything. The bridge exists now, so the bump was
this phase's obligation rather than its hazard, and it landed at all six sites —
including `tests/shared/extension-version.test.ts`, which the repository's own
bump checklist does not name.

**What the bump does NOT yet do.** `orchestrators/reconcile/backfill.ts:76`
returns early while `state.lastReconciledExtensionVersion === EXTENSION_VERSION`,
so the bump opens that gate — but `backfill.ts:343` re-materializes through
`reinstallPlugin`, which gains no workflows phase until Phase 112. A user who
`--partial`-installed a workflow-bearing plugin on the released 0.18.1 still
carries `compatibility: { installable: false, unsupported: ["workflows"] }` on
disk and still renders `◉ helper (partially-installed) {unsupported component}`.
Phase 112 is what makes the repair actually run; the effect lands at release.

## Progress

**Phases Complete:** 3/9 verified (Phases 109-114 replay, 115-117 hardening)
**Current Plan:** `112-03` not started — Phase 112 is 2/4 plans done.

```text
[===-------] 33%
```

| Phase | Name | Status |
|-------|------|--------|
| 109 | Kind inversion | Complete (5/5 plans, verified 12/12) |
| 110 | Domain and platform modules | In progress (3/3 plans executed, verification pending) |
| 111 | Workflows bridge | In progress (4/4 plans executed, verification pending) |
| 112 | Install and removal lifecycle | In progress (2/4 plans executed) |
| 113 | Update, enable/disable, reconcile | Not started |
| 114 | Degradation and documentation | Not started |
| 115 | Install-time admission-gate warnings | Not started (hardening) |
| 116 | Load-time workflow convergence | Not started (hardening) |
| 117 | Measured `agent()` failure evidence | Not started (hardening) |

**Why one run covers both milestones.** GSD scopes a milestone by parsing a
`vN.N` version out of STATE's `milestone:` field
(`workstream-inventory.cjs::readCurrentMilestoneVersion`). This workstream uses
a NAME, so scoping never engages and `roadmap analyze` returns all nine phases.
That is the right order to run them in anyway — replay, then harden — so
`total_phases` is 9 rather than the replay's 6. A consequence of the same gap:
`workstream status` reports this workstream `milestone complete`, derived from
the archived `milestones/workflows-ROADMAP.md` through the legacy fallback.
`init milestone-op` reads it correctly as incomplete, and that is what
`/gsd-autonomous` uses.

**Why the numbers start at 109.** Phase numbers are per-workstream, not global:
root `v1.19` uses 106-117, `defaults-enabled` uses 101-105, and this
workstream's archived milestone uses 101-105. Only a collision *within* this
workstream would matter, and 106-108 are free here. They are left unused
anyway, because the spike branch's own records plan the hardening milestone as
"Phases 106-108" — reusing those numbers for the replay would make every such
reference ambiguous when the two branches are read side by side.

## Replay Ground Truth

What is on this branch right now, so a later session does not read the archived
101-105 records as a claim about this tree:

- **Planning artifacts:** ported. The 101-105 phase records, the archived
  requirements, and the milestone audit all describe work that exists on
  `features/workflows-spike`, not here.
- **Spike evidence:** ported and renumbered 021-026 (008-013 collided with this
  branch's existing spikes). Re-verified against engine 3.10.1 in Spike 027.
- **Production code:** the domain and platform leaves from Phase 110, and the
  whole of `bridges/workflows/` (`types`, `discover`, `unstage`, `stage`,
  `index`) plus the `persistence/locations.ts` workflows members from Phase 111.
  Still absent: any orchestrator that DRIVES the bridge, and the
  `EXTENSION_VERSION` bump.
- **Behavior today:** Phase 109 inverted it. A workflow-bearing plugin now
  resolves `installable`, installs with no `--partial`, and renders a clean
  `● (installed)` row — and materializes nothing, because no bridge exists yet.
  The `{workflows}` reason is retired from all four declaration sites. The
  released 0.18.1 still behaves the #154 way; that difference is the D-109-06
  window, and it is pinned by test rather than left undocumented.

## Accumulated Context

**Decisions carried in:**

- **Only the lax direction self-corrects.** A replicated engine gate can only
  make the bridge stricter than the engine; a spurious refusal needs an
  extension release to clear, a spurious warning costs one line. Phase 115 may
  read the six gates but must never refuse on them.

- **The determinism blocklist keeps its refusal.** It is the one replicated
  gate because it is the one whose failure the engine reports wrongly — a
  raw-text screen cannot tell a call from a mention, so a script is refused for
  a rule its comment merely names.

- **Equality is not growth.** The convergence widening keeps the strict-superset
  test and the extension-version stamp; re-materializing on every load is the
  failure WCONV-02 exists to prevent.

- **Never scan a disabled record.** The backfill re-materializes through
  reinstall, whose record write sets `enabled: true` unconditionally, so
  scanning a disabled record reverses an explicit user disable at load time.
  Widening the arm must not widen past that filter.

- **Engine claims are pinned to `@quintinshaw/pi-dynamic-workflows` 3.10.1 (Spike 027)**, and
  every claim carries its evidence grade — documented-upstream,
  runtime-measured, or source-read. An ungraded claim reads as stronger evidence
  than it is.

- **The engine is deliberately not a declared dependency.** Adding it would
  couple `npm run check` to a 0.x package with ~50 releases since May 2026 and
  no exported contract. The live-UAT scratch-install route exists precisely to
  avoid that, which is why WEVID-01 produces a HUMAN-UAT item rather than an
  automated gate.

- Host engine chosen on trust grounds: it sandboxes scripts in a
  `vm.createContext` realm. `@nicknisi/pi-workflows` is rejected —
  `runInThisContext()` plus the real `process`, all env vars, and
  `process.binding('fs')`. The reason token is `requires pi-dynamic-workflows`,
  never `requires pi-workflows` — the latter names the rejected engine.

- NFR-10 carries a writable **root** (`~/.pi/workflows/`), not a subdirectory;
  the engine honors no override, and staging must sit adjacent to the target.

**Open todos:** None yet.

**Blockers:** None.

**Evidence base:** The validation audit of Phases 101-105 (2026-08-16) — sources
and tests read, suites run, and the real admission logic driven against the
seven workflow scripts of the two Anthropic-authored plugins that carry a
`workflows/` directory (`claude-security`, `code-modernization`). All seven pass
the six unreplicated gates today, so the value of Phase 115 is in the error
message a third-party author gets, not in a live breakage. Spike findings for
the bridge itself are packaged in the `spike-findings-pi-claude-marketplace`
project skill (`references/workflows-bridge.md`), which auto-loads during
implementation.

## Session Continuity

**Last session:** 2026-09-05T17:50:00Z

**Stopped At:** Completed 112-02-PLAN.md
**Resume File:** None
**Next Action:** `/gsd-verify-work 111` — all four plans are executed and the
phase gate is green. `111-04`'s two commits are `b524524c` (the version bump at
six sites plus the `.planning/PROJECT.md` prose site) and `a3939034` (the
install-window assertion inversion). Task 3 produced no commit, which is the
planned outcome: `pre-commit run --all-files` rewrote nothing.

Three things the next phase inherits. **The `orchestrators` fallow allow-list
still omits `"bridges-workflows"`** — nothing imports the bridge yet, so adding
it here would be unverifiable, but the first orchestrator import must add that
one string in the same change or `fallow dead-code`'s boundary sub-gate fails on
the new edge. **The two explicit bridge calls in
`tests/integration/workflow-kind-inversion.test.ts` are a placeholder for the
install-driven path**; replacing them is a small edit and the assertion beside
them does not change. And **the bump does not repair a stale record's artifacts
in this phase** — the gate opens and the re-resolution clears the reason token,
but the re-materialization runs through `reinstallPlugin`, which gains no
workflows phase until Phase 112.

`commitPreparedWorkflows`'s `onPlaced` is the caller's removal payload on every
path including each throw, while its RETURN value is a leak string rather than a
throw when only the staging cleanup failed; a caller that derives removal work
from the thrown error's type instead will unlink either a foreign file or a
previous envelope the rollback just restored.

Phase 109 remains verified 12/12 and marked complete in ROADMAP.md;
`109-VERIFICATION.md` carries the evidence. The phase's two manual-only
obligations were answered in `109-05-SUMMARY.md` §*Human-check answers* — the
Success-Criterion-4 observation sequence and the WINV-05 prose read — and the
verifier confirmed both against the tree.

**Two obligations ride into Phase 111, and both now live in ROADMAP.md**
§Phase 111 Success Criteria items 7-8 rather than only in phase-109 artifacts:
bump `EXTENSION_VERSION` in the same change that lands `bridges/workflows/`, and
invert the D-109-06 ENOENT assertion in
`tests/integration/workflow-kind-inversion.test.ts`.

**Where the work lives:** the worktree
`/home/acolomba/pi-claude-marketplace-workflows` on branch `features/workflow`.
The primary checkout (`/home/acolomba/pi-claude-marketplace`) carries none of
this workstream's planning files. The older `.worktrees/workflows-spike`
worktree on `features/workflows-spike` still exists and is reference only — the
replay reads it, never merges it. GSD tooling is gitignored and therefore absent
from a fresh worktree; this one has `gsd-core`, `agents`, `hooks`, `scripts`,
`commands/gsd-*.md` and the install state copied in from the primary checkout,
with `workstream set workflows` applied. All of it is gitignore-matched, so
`git status` stays clean. Run gsd-tools from this worktree, never from `main`.

**Executors run SEQUENTIALLY here, never in agent worktrees.** This worktree's
own `node_modules` is a real directory, but a freshly-created agent worktree has
none, so it could not run `npm run check` at all. `workflow.use_worktrees` is
`false` in `.planning/config.json` for the same reason. Force the dispatch
sentinel (`query dispatch-isolation --raw --phase N --force-isolation none`)
before every executor, reviewer and fixer dispatch — a bare call re-resolves and
re-persists `harness-worktree` as a side effect.

**Outstanding, carried deliberately:**

- **Phase 101 was never code-reviewed.** Its 23 changed files are verified 4/4
  but unreviewed — the earlier autonomous run was interrupted at that dispatch.
  Phase 102's review found two blockers in comparable code, so the gap is real.
  Resume with `/gsd-code-review 101`.

- **Release work from the `workflows` milestone is partly done.** `111-04`
  bumped `package.json`, `package-lock.json`, `EXTENSION_VERSION`,
  `tests/shared/extension-version.test.ts` and `sonar-project.properties` to
  `0.19.0` and opened a `## [0.19.0]` `CHANGELOG.md` section; later phases append
  bullets there rather than bumping again. Still open: push
  `features/workflows-spike` and open the PR — nothing is pushed yet and no PR
  exists. This milestone's phases can land on the same branch first.

- **A pre-existing bare planning-artifact token** sits at
  `tests/orchestrators/reconcile/backfill.test.ts:320` (commit `c695bdab3`).
  Phase 116 edits that file, so the token is now in reach — clean it there
  rather than leaving it.

- **The `node_modules` cleanup hazard does not apply on this worktree.** It did
  on `.worktrees/workflows-spike`, where `node_modules` was a symlink ignored
  only via a local `.git/info/exclude` and had to be removed before
  `gsd-cleanup` would pass its worktree_dirty check. Here it is a real
  directory ignored by the committed `.gitignore:67`, and this worktree's
  exclude file is empty — verified 2026-09-04. Re-check before running
  `gsd-cleanup` from any other worktree.

- **Four residual risks accepted in the `workflows` milestone**, recorded so they
  are not rediscovered as new defects: the commit double-fault branch (restore
  failure during rollback) has no automated test; a narrow `update` double fault
  can persist a record over-claiming a foreign name; the two re-stage-window
  tests are POSIX-only and SKIP as root, so container CI skips them silently;
  and `unplaceWorkflows` failures surface only as leak strings on the
  manual-recovery message.

- **All five `VALIDATION.md` files for Phases 101-105 are `status: draft`**, so
  Nyquist reads NOT-VALIDATED. A coverage TODO, not a compliance failure —
  `/gsd-validate-phase 101..105` closes it if wanted.

- **One open question for the operator:** `README.es.md` reads
  `Workflows (flujos de trabajo).` (parallel to the existing `Hooks (ganchos).`).
  Flip to `Flujos de trabajo (workflows).` if preferred — the link text changes
  with it.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| — | — | — | — |
| Phase 109 P01 | 22 min | 3 tasks | 7 files |
| Phase 109 P02 | 11 min | 2 tasks | 6 files |
| Phase 109 P03 | 12 min | 2 tasks | 8 files |
| Phase 109 P04 | 14 min | 3 tasks | 5 files |
| Phase 109 P05 | 15 min | 2 tasks | 1 file |
| Phase 110 P01 | 21 min | 2 tasks | 4 files |
| Phase 110 P02 | 22 min | 2 tasks | 4 files |
| Phase 110 P03 | 47 min | 3 tasks | 4 files |
| Phase 111 P01 | 35 min | 2 tasks | 5 files |
| Phase 111 P02 | 62 min | 3 tasks | 7 files |
| Phase 111 P03 | 35 min | 3 tasks | 4 files |
| Phase 111 P04 | 34 min | 3 tasks | 8 files |
| Phase 112 P01 | 70 min | 3 tasks | 51 files |
| Phase 112 P02 | 40 min | 3 tasks | 8 files |

## Decisions

_Recorded per phase as the milestone proceeds._

- [Phase 109]: The closed-set move is one commit, never two. T-02-25 warns that a kind in neither closed set is silently ignored, so the removal from `UNSUPPORTED_COMPONENT_KINDS` and the additions to both supported tuples landed together in `f23d964d`. — A tidier two-commit split would have published an intermediate tree carrying the exact defect the security note exists to prevent.
- [Phase 109]: The install-level window test composes the host engine's storage root by hand (`path.join(HOME, ".pi", "workflows")`) rather than adding a `locations` getter for it. — That getter is Phase 110's deliverable; adding it here would be an unused export `fallow dead-code` would flag, and a boundary widening the assertion does not need.
- [Phase 110]: The relocation seam was deleted outright rather than reshaped into a `homeDir` parameter. — `os.homedir()` re-reads `HOME` on every call and caches nothing, so `HOME` plus `t.after()` restoration is a working replacement; threading a home directory through every Phase 111 call site that does not otherwise need one would be a worse contract for a hazard the research measured absent.
- [Phase 110]: The header sentence defending the seam was replaced, not merely orphaned. — A comment arguing for a mechanism you just deleted, from a premise measured false, is worse than no comment.
- [Phase 110]: The relative-path parity case pins the working directory with `process.chdir("/")` instead of taking the spike's split pin. — The split pin computes half its expectation with production code; a pinned cwd makes the same row a transcribed literal that is deterministic on any machine.
- [Phase 111]: WPTH-03 is read as SPLIT across two phases rather than re-proved at the composition site. — The derivation half closed in Phase 110 with a mutation-sensitive literal parity table; this plan owes only that the derived key lands as the middle segment of `workflowsSavedDir`, and a second copy of those literals here would give one derivation two sources of truth.
- [Phase 111]: The WPTH-02 writing-half case passes a distinct temp directory as the `cwd` ARGUMENT instead of relocating `process.cwd()` as planned. — Nothing in `locationsFor`'s call graph reads the process global; `cwd` is a parameter, so mutating `process.cwd()` would prove nothing about the input the code consumes and the case would pass for a cwd-derived implementation too.
- [Phase 111]: The two `path.basename` failure injectors in the marketplace-add owner test were scoped to the config path rather than moving `locationsFor` inside `addMarketplace`'s try block. — The port made `locationsFor` traverse `path.basename`, and `addMarketplace` calls it one line before the try, so an unconditional process-wide throw escaped the normalizer under test. The normalizer was never broken and `locationsFor` cannot throw in production; changing an orchestrator's error contract to accommodate a test injector would have been the wrong repair.
- [Phase 111]: That repair landed as its own commit placed BEFORE the tracer commit. — It is green both with and without the port, so ordering it first is what lets the tracer commit carry exactly its two planned paths and still leave `npm test` green, instead of trading one verification clause for the other.
- [Phase 111]: WPTH-05 is pinned by a cross-configuration invariant, not by a rename-fails-EXDEV assertion. — Whether two roots share a filesystem is a property of the machine, so a same-filesystem box records success as an expected result; two bundles under one `HOME` with differing `PI_CODING_AGENT_DIR` and differing project directories fail on exactly the refactor that reintroduces EXDEV.
- [Phase 110]: WPTH-02 is recorded as carried forward rather than completed. — Phase 110 writes nothing, so it can prove only the home-derivation negative; the "never written" guarantee belongs to the Phase 111 modules that write.
- [Phase 110]: The ported `assertSafeSavedWorkflowName` was completed to all six engine clauses rather than the gap being recorded and carried to the admission-gate hardening phase. — The wrapper is new code the port itself introduces, so completing it makes the bridge match the engine EXACTLY rather than exceed it; the alternative was a workflow whose author put a space in `meta.name` installing and never running, with no signal.
- [Phase 110]: The docblock sentence claiming `assertSafeName` already enforced the separator/NUL screening was replaced, not annotated. — It was measured false against engine 3.10.1 for a plain space and the whole `\p{Cf}` category; a comment arguing a false premise is worse than none.
- [Phase 110]: `CrossPluginConflictError`'s reference-identity assertion was INVERTED for `WorkflowNameCollisionError` rather than copied as `110-PATTERNS.md` instructs. — The analog assigns its argument array directly; this class assigns `Object.freeze([...collisions])`, so the owner test pins `notStrictEqual` + `Object.isFrozen` + a post-construction push into the caller's array, which is what proves the copy defensive rather than incidental.
- [Phase 110]: The dependency, the module and its owner test landed as ONE commit of four paths. — `fallow dead-code` reports `unused-dependency` for a declared-but-unimported package and `unused-export` for a module no test imports, and both the `npm-fallow` hook and `npm run check` scan the whole working tree, so every intermediate split publishes a red tree.
- [Phase 110]: Verdicts are asserted through a projection that drops `reason`. — `reason` is the only field that changes when wording is edited, and discriminating a verdict by message text is the exact failure the literal-tagged union exists to remove; the projection plus one `deepStrictEqual` plus `satisfies` pins the discriminant at run time and the arm at compile time.
- [Phase 110]: Two coverage gaps the research did not predict were closed by adding public-behaviour cases, never a suppression directive. — The restructure changed which arms the case set reaches (Assumptions Log A2 warned of exactly this), leaving `metaPropertyKey`'s computed-key early return and `stemFallbackVerdict`'s refusal arm uncovered; reading the reported LCOV lines and adding one case each took the pair to 105/105 branches.
- [Phase 110]: WNAM-03 is recorded as carried forward rather than completed. — Phase 110 delivers the `skipped`/`no-meta` classification but emits nothing to a user and installs nothing, so the requirement's warning and not-installed halves belong to Phase 111.
- [Phase 110]: No parse size or depth cap was added (T-110-17, accepted). — The host engine has none either, and a cap stricter than the engine's would refuse a script the engine accepts; only the lax direction self-corrects across engine upgrades. Recorded as a Phase 115 candidate.
- [Phase 111]: The criterion-4 row is emitted from `verdictWarning` in the discovery module, reusing `softFailWarning` with a fourth outcome phrase (`was installed but will not run`). — It is the single verdict-to-warning mapping in the bridge, staging already re-exports discovery's warnings unchanged, and the read-only surfaces that consume the same discovery pass get the row for free; emitting from staging would add a second warning-composing site and reach neither.
- [Phase 111]: The row's reason names the missing NAME and states the description as the engine's OTHER requirement, never as a second observed absence. — Both measured stem-fallback shapes carry a description, so a row claiming otherwise would be a false statement about the file, which is worse than no row.
- [Phase 111]: The case-fold dedup case plants two REAL directories differing only in case rather than declaring one directory under two spellings. — On a case-sensitive filesystem the plan's shape leaves the second directory non-existent, `readdir` returns nothing, and the case passes whether or not the key is folded; it would have covered the darwin arm while asserting nothing about it.
- [Phase 111]: The three permission-mutating cases share ONE `t.after()` between the restoring `chmod` and the tree removal. — `node:test` runs after-hooks in registration order, so a removal registered by a shared root helper runs before the restoring chmod and fails with `EACCES`, turning two green assertions into two red cases whose summary line looks like a broken assertion.
- [Phase 111]: The CR-01 restore-failure branch is driven by a composer override carrying a SIDE EFFECT, not by a composer returning two different paths. — `displacePreviousTargets` resolves each previous name once and the restore loop replays the captured pair, so "resolve differently on the displacement read and on the restore read" is unbuildable; what the seam does reach is ordering, and resolving the second previous name after the first has been displaced is the one moment the freed target can be turned into something a restore cannot rename back onto.
- [Phase 111]: The fully-successful-reversal case asserts the ABSENCE of a leak suffix rather than its presence. — A reversal that left nothing placed and a staging cleanup that succeeded produce no leak at all, so asserting one would require an implementation that reports a leak falsely; the absence is exactly what separates that case from the failed-reversal case beside it.
- [Phase 111]: Four measured branch gaps in `stage.ts` were closed by adding three public-behaviour cases, never a suppression directive. — The noop case now plants a no-`meta` script instead of a non-script file, and two rollback cases were added (a non-ENOENT displacement failure, and a re-stage whose restore succeeds); the module went from 53/57 to 61/61 branches.
- [Phase 111]: The staging-side first-wins dedup is reported as unreachable through the public API rather than force-covered. — Discovery dedups by absolute source path and the collision assert rejects any two records sharing a generated name, so no input makes `seen.has(...)` true; V8 records the expression as evaluated, the module still reports 61/61, and the guard stands as defence in depth.
- [Phase 109]: A negative assertion is only trusted after a non-vacuity probe. Before accepting the green `ENOENT` assertion, `resolveStrict` was driven against the identical fixture shape and returned `installable` with `workflows` in `supported`. — Without that check the assertion passes just as happily for a plugin carrying no `workflows/` directory at all, and would pin nothing.
- [Phase 111]: The version moves to `0.19.0`, a MINOR bump, and it is the only bump of the milestone. — Every `0.x.0` heading in this changelog introduces new user-visible capability and a sixth component kind is capability; a patch bump would force a second bump later and a renamed section, and later phases append bullets under the heading created here.
- [Phase 111]: The install-window assertion was inverted against two EXPLICIT bridge calls through the barrel rather than deferred to the install-driven path. — No orchestrator calls the bridge until Phase 112, so the criterion could not be met by wiring; the explicit drive makes the assertion true today and Phase 112 replaces the two calls without the assertion inverting again.
- [Phase 111]: The fixture's script body was changed from a default export to a named `meta` export. — The real admission rule classifies a default export `skipped`/`no-meta`, so no envelope was written in any phase and the inverted assertion would have been red forever; a negative control restoring the old body confirmed the case goes red.
- [Phase 111]: The precondition's COMMENT was rewritten while its three assertions stayed byte-identical. — It named an ENOENT assertion the inversion deletes, and the failure mode it described inverts too; the project's comment policy forbids narrating code that no longer exists, and the guard the plan protects is the assertions, not the prose above them.
- [Phase 109]: D-109-01/D-109-05 executed as a red slice: the five locking gates and the published byte contract were turned to the post-inversion reading BEFORE any production edit, and each was observed failing against unmodified code. — Success Criterion 4 asks for a red-then-green pair. With production edited first the renderer prints whatever the fixture hands it, both halves agree, and the observed red never happens.

- [Phase 112]: Both partial-cascade fold tests were observed RED against the unmodified folds before either filter line landed, then re-proven by deleting the lines again. — Neither site is compile-forced: both read the `dropped` bundle structurally, so a six-axis argument satisfies a five- and a four-axis parameter with no error. A fold test written after its line proves only that it compiles.
- [Phase 112]: The hand-rolled marketplace fold's pre-existing `hooks` omission was left in place, and the new case asserts the persisted record STILL names the dropped hook. — The divergence predates this work and is filed as `CASCADEAX-01`; pinning it as deliberate is what stops a later reader repairing it silently as an unrelated behavior change.
- [Phase 112]: The workflows unstage throw is placed AFTER `dropped.workflows` is assigned. — A cascade that fails part-way must still report the envelopes it did remove, and the partial-failure return is the only channel that carries them.
- [Phase 112]: The planned containment-refusal case for the cascade was dropped rather than written. — `assertSafeName` throws a plain `Error` for a path separator, so such a name lands in the bridge's per-name failure array, not as `PathContainmentError`; the containment class is already pinned at the install ledger where `assertPathInside` is actually reachable.
- [Phase 112]: `createProjectScope` and `projectCase` relocate `HOME` rather than a new per-case helper being added. — `workflowsSavedDir` is rooted at `os.homedir()` and honors no override, so every cascade test now reaches the real user's saved workflows unless the bundle is built after the assignment.

## Operator Next Steps

- Verify Phase 111 with `/gsd-verify-work 111` — all 4 plans are executed
- Phase 109 is complete and verified 12/12; 110-114 run in order, each
  depending on the one before it
- The hardening phases 115, 116 and 117 are mutually independent; the order
  above is execution order, not a dependency chain (they were renumbered from
  the spike branch's 106-108)
- Phase 117's canary run needs a disposable scratch install of
  `@quintinshaw/pi-dynamic-workflows` — it can be primed at any point in the
  milestone

---
gsd_state_version: 1.0
milestone: workflows-replay
milestone_name: Workflow Bridge Replay onto main
current_phase: 111
current_phase_name: Workflows bridge
current_plan: 111-01 (not started)
status: Ready to execute
stopped_at: Phase 111 planned (4 plans), ready to execute
last_updated: "2026-09-05T09:19:16.918Z"
last_activity: 2026-09-05
last_activity_desc: Phase 111 planned - 4 plans, checker passed clean
state_head: 8bf926deb34d50a1e28bd277e072f0a1ae1d0a0f
progress:
  total_phases: 9
  completed_phases: 2
  total_plans: 12
  completed_plans: 8
  percent: 22
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

Phase: 111 (Workflows bridge) — READY TO EXECUTE
Plan: 4 plans, none started
Status: Ready to execute. Phase 111 is planned and the checker passed with zero
issues across all seven phase-specific traps. Four serialized waves: `111-01`
(the tracer — the `locations.ts` workflows members and `WorkflowTargetOccupiedError`,
opening red on the two exhaustive `Object.keys` bundle assertions the port breaks),
`111-02` (types/discover/unstage, the `bridges-workflows` fallow zone, and the
criterion-4 stem-fallback warning row), `111-03` (the stage triplet and barrel,
the WR-06 occupancy refusal, every rollback branch), and `111-04` (the 0.19.0
version bump across six sites and the install-window assertion inversion).

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

Last activity: 2026-09-05 — Phase 110 verified 20/20 and marked complete; the
next step is `/gsd-plan-phase 111`

**The D-109-06 window is now open, and pinned by test.** Until Phase 111 lands, a
workflow-bearing plugin resolves `installable`, renders `● (installed)` with no
brace, and materializes zero workflow commands.
`tests/integration/workflow-kind-inversion.test.ts` asserts both halves, so the
window is a fact under test rather than an undocumented gap. Cut no release from
this branch, and do NOT bump `EXTENSION_VERSION` before Phase 111 (A-03: a bump
would fire the `supportedSetGrew` backfill convergence while no bridge exists to
materialize anything).

**Phase 111 must invert the no-artifact half** of that test — the single
`assert.rejects(stat(<HOME>/.pi/workflows), { code: "ENOENT" })` line becomes an
assertion that the envelopes ARE written. An assertion that quietly stays green
while meaning the opposite is worse than no assertion. Recorded in
`109-CONTEXT.md` §Deferred Ideas and `109-05-SUMMARY.md`.

**Phase 111 must also BUMP `EXTENSION_VERSION`** in the same change that lands
`bridges/workflows/`. A-03 records only the prohibition — do not bump *during*
the window — and its inverse is an obligation that was written nowhere.
`orchestrators/reconcile/backfill.ts:76` returns early while
`state.lastReconciledExtensionVersion === EXTENSION_VERSION`, so the bump is the
only thing that opens the gate and lets `supportedSetGrew` (`backfill.ts:343`)
re-materialize the records the released v0.18.1 wrote. Any user who
`--partial`-installed a workflow-bearing plugin on 0.18.1 has
`compatibility: { installable: false, unsupported: ["workflows"] }` on disk, and
`list` / `info` / `enable` / reconcile read that PERSISTED array rather than a
fresh resolution, so the row now renders
`◉ helper (partially-installed) {unsupported component}` — a token naming a
dropped component for a kind Pi supports. Without the bump those records stay
that way permanently.

## Progress

**Phases Complete:** 2/9 verified (Phases 109-114 replay, 115-117 hardening)
**Current Plan:** Not started — Phase 111 needs planning.

```text
[==--------] 22%
```

| Phase | Name | Status |
|-------|------|--------|
| 109 | Kind inversion | Complete (5/5 plans, verified 12/12) |
| 110 | Domain and platform modules | In progress (3/3 plans executed, verification pending) |
| 111 | Workflows bridge | Not started |
| 112 | Install and removal lifecycle | Not started |
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
- **Production code:** two leaf modules so far, both landed by `110-01` —
  `platform/workflow-home.ts` (seam-free) and `domain/workflow-project-key.ts`
  (unedited). Still absent: `bridges/workflows/`, `domain/workflow-script.ts`,
  the `domain/name.ts` and `shared/errors.ts` additions, and the `acorn`
  dependency.
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

**Last session:** 2026-09-05T05:35:00Z

**Stopped At:** Phase 110 complete, ready to plan Phase 111
**Resume File:** None
**Next Action:** `/gsd-verify-work 110`, then `/gsd-discuss-phase 111`. All
three of Phase 110's plans are complete and all three SUMMARYs are on disk; the
production commits are `df7b9be8` (storage root), `ed756b8f` (project key),
`2152a2aa` (name generator plus collision error) and `d3c5be6f` (script
admission, acorn, owner test). The phase mechanism held all three times:
path-scoped checkout naming individual files, the blast-radius assertion
immediately after, an owner test that imports every export by name, complete
direct coverage per pair, and the full gate chain before each commit.

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

- **Release work from the `workflows` milestone is still open.** Bump the
  version in `package.json`, `sonar-project.properties` and `EXTENSION_VERSION`;
  update `package-lock.json`; record the milestone in `CHANGELOG.md`; re-run
  `npm test` (pre-commit does not run the suite that guards the version). Push
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

## Decisions

_Recorded per phase as the milestone proceeds._

- [Phase 109]: The closed-set move is one commit, never two. T-02-25 warns that a kind in neither closed set is silently ignored, so the removal from `UNSUPPORTED_COMPONENT_KINDS` and the additions to both supported tuples landed together in `f23d964d`. — A tidier two-commit split would have published an intermediate tree carrying the exact defect the security note exists to prevent.
- [Phase 109]: The install-level window test composes the host engine's storage root by hand (`path.join(HOME, ".pi", "workflows")`) rather than adding a `locations` getter for it. — That getter is Phase 110's deliverable; adding it here would be an unused export `fallow dead-code` would flag, and a boundary widening the assertion does not need.
- [Phase 110]: The relocation seam was deleted outright rather than reshaped into a `homeDir` parameter. — `os.homedir()` re-reads `HOME` on every call and caches nothing, so `HOME` plus `t.after()` restoration is a working replacement; threading a home directory through every Phase 111 call site that does not otherwise need one would be a worse contract for a hazard the research measured absent.
- [Phase 110]: The header sentence defending the seam was replaced, not merely orphaned. — A comment arguing for a mechanism you just deleted, from a premise measured false, is worse than no comment.
- [Phase 110]: The relative-path parity case pins the working directory with `process.chdir("/")` instead of taking the spike's split pin. — The split pin computes half its expectation with production code; a pinned cwd makes the same row a transcribed literal that is deterministic on any machine.
- [Phase 110]: WPTH-02 is recorded as carried forward rather than completed. — Phase 110 writes nothing, so it can prove only the home-derivation negative; the "never written" guarantee belongs to the Phase 111 modules that write.
- [Phase 110]: The ported `assertSafeSavedWorkflowName` was completed to all six engine clauses rather than the gap being recorded and carried to the admission-gate hardening phase. — The wrapper is new code the port itself introduces, so completing it makes the bridge match the engine EXACTLY rather than exceed it; the alternative was a workflow whose author put a space in `meta.name` installing and never running, with no signal.
- [Phase 110]: The docblock sentence claiming `assertSafeName` already enforced the separator/NUL screening was replaced, not annotated. — It was measured false against engine 3.10.1 for a plain space and the whole `\p{Cf}` category; a comment arguing a false premise is worse than none.
- [Phase 110]: `CrossPluginConflictError`'s reference-identity assertion was INVERTED for `WorkflowNameCollisionError` rather than copied as `110-PATTERNS.md` instructs. — The analog assigns its argument array directly; this class assigns `Object.freeze([...collisions])`, so the owner test pins `notStrictEqual` + `Object.isFrozen` + a post-construction push into the caller's array, which is what proves the copy defensive rather than incidental.
- [Phase 110]: The dependency, the module and its owner test landed as ONE commit of four paths. — `fallow dead-code` reports `unused-dependency` for a declared-but-unimported package and `unused-export` for a module no test imports, and both the `npm-fallow` hook and `npm run check` scan the whole working tree, so every intermediate split publishes a red tree.
- [Phase 110]: Verdicts are asserted through a projection that drops `reason`. — `reason` is the only field that changes when wording is edited, and discriminating a verdict by message text is the exact failure the literal-tagged union exists to remove; the projection plus one `deepStrictEqual` plus `satisfies` pins the discriminant at run time and the arm at compile time.
- [Phase 110]: Two coverage gaps the research did not predict were closed by adding public-behaviour cases, never a suppression directive. — The restructure changed which arms the case set reaches (Assumptions Log A2 warned of exactly this), leaving `metaPropertyKey`'s computed-key early return and `stemFallbackVerdict`'s refusal arm uncovered; reading the reported LCOV lines and adding one case each took the pair to 105/105 branches.
- [Phase 110]: WNAM-03 is recorded as carried forward rather than completed. — Phase 110 delivers the `skipped`/`no-meta` classification but emits nothing to a user and installs nothing, so the requirement's warning and not-installed halves belong to Phase 111.
- [Phase 110]: No parse size or depth cap was added (T-110-17, accepted). — The host engine has none either, and a cap stricter than the engine's would refuse a script the engine accepts; only the lax direction self-corrects across engine upgrades. Recorded as a Phase 115 candidate.
- [Phase 109]: A negative assertion is only trusted after a non-vacuity probe. Before accepting the green `ENOENT` assertion, `resolveStrict` was driven against the identical fixture shape and returned `installable` with `workflows` in `supported`. — Without that check the assertion passes just as happily for a plugin carrying no `workflows/` directory at all, and would pin nothing.
- [Phase 109]: D-109-01/D-109-05 executed as a red slice: the five locking gates and the published byte contract were turned to the post-inversion reading BEFORE any production edit, and each was observed failing against unmodified code. — Success Criterion 4 asks for a red-then-green pair. With production edited first the renderer prints whatever the fixture hands it, both halves agree, and the observed red never happens.

## Operator Next Steps

- Continue Phase 110 with `/gsd-execute-phase 110` — `110-02` is next
- Phase 109 is complete and verified 12/12; 110-114 run in order, each
  depending on the one before it
- The hardening phases 115, 116 and 117 are mutually independent; the order
  above is execution order, not a dependency chain (they were renumbered from
  the spike branch's 106-108)
- Phase 117's canary run needs a disposable scratch install of
  `@quintinshaw/pi-dynamic-workflows` — it can be primed at any point in the
  milestone

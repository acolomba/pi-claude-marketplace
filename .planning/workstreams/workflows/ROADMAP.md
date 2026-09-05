# Roadmap: workflows

**Workstream:** workflows

## Milestones

- 🚧 **workflows-replay — Workflow Bridge Replay onto main** — Phases 109-114 (in progress)
- 📋 **workflow-hardening — Workflow Bridge Hardening** — Phases 115-117 (planned)
- ✅ **workflows — Claude `workflows` Component-Kind Bridge** — Phases 101-105 (completed 2026-08-16 on `features/workflows-spike`; **not merged**)

## Phases

### In progress workflows-replay

🚧 **workflows-replay — Workflow Bridge Replay onto main**

Phases 101-105 shipped the bridge on `features/workflows-spike`. That branch was
never merged, and main has since moved under it in two ways that make a merge
the wrong instrument:

- **`workflows` is already a recognized kind, with the opposite meaning.** PR
  #154 put `workflows` in `UNSUPPORTED_COMPONENT_KINDS` with a convention entry,
  a dedicated closed-set `workflows` reason, a `probe-classifiers` arm, docs, and
  tests that lock those closed sets. A plugin carrying workflows resolves
  `partially-available` today. Admitting the kind means inverting that, not
  adding to it.

- **The test architecture the spike wrote against is gone.** PR #167 deleted
  `tests/helpers/`, rewrote 204 source-test pairs, changed 81 production files to
  remove test-only seams, and added `scripts/check-corresponding-tests.mjs` to
  `npm run check`, which fails when a production module has no mirrored owner
  test. The spike carries 38 `__test_*` exports; main carries none.

A dry-run merge conflicts in 85 files — 25 production, 48 test — and main
rewrote the orchestrators the spike wires into far more than the spike touched
them (`install.ts` 1243+/1222-, `update.ts` 860+/771-, `apply.ts` 205+/781-).
Resolving those is re-deriving the wiring while calling it a merge.

**What carries over unchanged:** the 36 requirements, the phase records, the
spike evidence (renumbered 021-026 here, re-verified against engine 3.10.1 in
Spike 027), and the ten net-new production modules, which touch only leaf
surfaces and conflict nowhere except `persistence/locations.ts`.

**What is rewritten:** the wiring into the rewritten orchestrators, and every
test — against the owner-test convention rather than the deleted helpers.

- [x] **Phase 109: Kind inversion** — `workflows` moves from `UNSUPPORTED_COMPONENT_KINDS` to both supported tuples, and every closed set, classifier arm, doc, and locking test that #154 wrote is turned with it (WINV-01..05) (completed 2026-09-04)
- [x] **Phase 110: Domain and platform modules** — `workflow-script.ts`, `workflow-project-key.ts`, `workflow-home.ts`, the `name.ts` addition, and the `acorn` dependency land with owner tests and no test-only seams (WNAM-01..06, WPTH-02) (completed 2026-09-05)
- [x] **Phase 111: Workflows bridge** — `bridges/workflows/` discover / stage / unstage / types and the `locations.ts` additions land with owner tests (WBRG-01..04, WPTH-01, WPTH-03..05) (completed 2026-09-05)
- [x] **Phase 112: Install and removal lifecycle** — the sixth ledger phase, cascade unstage, and reinstall re-materialization, wired against the rewritten `install.ts` / `uninstall.ts` / `reinstall.ts` (WLIF-01..03)
- [ ] **Phase 113: Update, enable/disable, reconcile** — the remaining lifecycle verbs plus the `info` and `list` read surfaces, wired against the rewritten orchestrators (WLIF-04..06, WFLW-04)
- [ ] **Phase 114: Degradation and documentation** — the third soft-dependency marker, the notify closed-set amendments, and `docs/workflows-compatibility.md` (WDEP-01..04, WDOC-01..03)

### Planned workflow-hardening

📋 **workflow-hardening — Workflow Bridge Hardening**

The `workflows` bridge landed with three gaps, each found by the validation
audit of Phases 101-105 by reading the sources, running the suites, and driving
the real admission logic against the seven workflow scripts of the two
Anthropic-authored plugins that carry a `workflows/` directory:

- **A script installs and then refuses to run, with no signal at install time.**
  The host engine refuses a script at nine distinct checks before it runs; the
  bridge replicates two (determinism and the acorn parse). Seven therefore
  install cleanly, register a command, and fail at first invocation. The author
  learns nothing until then. Re-measured against engine 3.10.1 in Spike 027,
  which also found that `meta.description` is required by the engine and
  checked by nothing in this bridge.

- **The population whose install already works is exactly the population that
  never converges.** The load-time self-heal returns early on any record at
  `installable: true`, so a plugin installed before the `workflows` kind was
  admitted never gains its workflow commands — and both Anthropic-authored
  workflow plugins land on that side, because the kind they were missing was
  invisible rather than unsupported.

- **The claim that decides whether a script degrades or dies is a source read.**
  `agent()` on failure is the load-bearing divergence from Claude Code, and it
  has never been driven at runtime.

**Design anchors carried by every phase:**

- **The warn direction is deliberate, not a compromise.** A replicated gate can
  only make the bridge stricter than the engine, and only the lax direction
  self-corrects across engine upgrades: a spurious warning costs one line of
  output, a spurious refusal costs an extension release. Nothing in this
  milestone may turn a gate reading into a refusal.

- **Equality is not growth.** The convergence widening keeps both bounds the
  existing arm relies on — a strict-superset test and the extension-version
  stamp — so the self-heal stays one-time and never re-materializes on every
  load.

- **Evidence carries its grade.** Engine claims stay pinned to
  `@quintinshaw/pi-dynamic-workflows` 3.10.1 (re-measured in Spike 027), and a
  claim's stated grade
  (documented-upstream / runtime-measured / source-read) must match how it was
  actually obtained.

**Phase Numbering:**

- Integer phases (115-117): the hardening milestone, renumbered from the spike
  branch's 106-108. Phase numbers are per-workstream rather than global — root
  `v1.19` uses 106-117, `defaults-enabled` uses 101-105, and this workstream's
  archived milestone uses 101-105 — so 106-108 were never actually taken here.
  They are left unused anyway, so that the spike branch's own references to
  "Phases 106-108" cannot be read as the replay phases that now precede them.

- Decimal phases (115.1, 116.1): urgent insertions only, marked `INSERTED`.

**Documentation placement.** `WGATE-05` and `WEVID-02` both edit
`docs/workflows-compatibility.md`, and each rides with the behavior it
documents rather than being pooled into a shared documentation phase. Neither
edit can be written before its own phase produces the fact it states:
`WGATE-05`'s replicate/warn/neither column is only true once the warnings
exist, and `WEVID-02`'s evidence grade is only knowable once the canary has
measured it. They also touch disjoint sections of the file (the
admit-versus-run table versus the script-semantics section), so there is no
textual conflict to avoid. `WDOCS-02` likewise rides with the work that settles
it: the self-contradicting verification record goes to the phase that runs the
canary it disputes. `WDOCS-01` depends on nothing in this milestone — the
backlog entry it prunes (`WFLW-01`) was closed by the `workflows` milestone — so
it rides in Phase 115 simply because that is the phase whose own backlog entry
(`WGATE-01`) sits in the same file, and one editor should visit `BACKLOG.md`
once.

- [ ] **Phase 115: Install-time admission-gate warnings** — the seven unreplicated engine checks become per-script warnings read off the parse already in hand, never refusals; the published contract and the backlog catch up (WGATE-01..05, WDOCS-01 — prunes the stale `WFLW-01` entry)
- [ ] **Phase 116: Load-time workflow convergence** — a cleanly-installed record whose supported set grew converges on the next load, once, and says so on its row (WCONV-01..03)
- [ ] **Phase 117: Measured `agent()` failure evidence** — the live canary drives the host engine's `agent()` failure path with a negative control, and the doc restates the divergence at the grade it was actually measured to (WEVID-01, WEVID-02, WDOCS-02)

<details>
<summary>✅ workflows — Claude <code>workflows</code> Component-Kind Bridge (Phases 101-105) — COMPLETED 2026-08-16</summary>

A Claude plugin shipping `workflows/` installs its scripts as working Pi commands
hosted by `@quintinshaw/pi-dynamic-workflows`, across the full plugin lifecycle.
The first bridge to install executable code rather than data, and the first to
write outside every existing scope root.

- [x] Phase 101: Workflow component-kind recognition (4/4 plans, verified 4/4) — completed 2026-08-14
- [x] Phase 102: Workflow naming and script admission (2/2 plans, verified 6/6) — completed 2026-08-15
- [x] Phase 103: Workflow artifact materialization (4/4 plans, verified 7/7) — completed 2026-08-15
- [x] Phase 104: Workflow lifecycle completion (6/6 plans, verified 4/4) — completed 2026-08-16
- [x] Phase 105: Workflow degradation and documentation (4/4 plans, verified 6/6) — completed 2026-08-16

Full detail: [`milestones/workflows-ROADMAP.md`](milestones/workflows-ROADMAP.md)
Requirements: [`milestones/workflows-REQUIREMENTS.md`](milestones/workflows-REQUIREMENTS.md)
Audit: [`milestones/workflows-MILESTONE-AUDIT.md`](milestones/workflows-MILESTONE-AUDIT.md)

</details>

## Phase Details

### Phase 109: Kind inversion

**Goal**: A plugin carrying `workflows/` resolves `installable` instead of `partially-available {workflows}`, and every closed set, classifier arm, document and locking test that PR #154 wrote to mean the opposite has been turned rather than deleted.
**Depends on**: Nothing. It is the first phase because nothing else compiles until `componentPaths.workflows` exists.
**Requirements**: WINV-01, WINV-02, WINV-03, WINV-04, WINV-05
**Success Criteria** (what must be TRUE):

1. `workflows` is absent from `UNSUPPORTED_COMPONENT_KINDS` and from
   `UNSUPPORTED_COMPONENT_CONVENTIONS`, and present in both
   `SUPPORTED_COMPONENT_KINDS` and `SUPPORTED_COMPONENT_PATH_KINDS`. The
   resolver exposes `componentPaths.workflows`.
2. A plugin whose only unsupported component was `workflows` resolves
   `installable` and installs on a plain `install`, with no `--partial`.
3. The dedicated `workflows` member of the `REASONS` closed set is either
   retired with its `probe-classifiers` arm or kept with a stated second
   meaning, and the closed-set counts in the `notify-reasons.ts` header comment
   agree with the tuple.
4. `compat-01-no-expansion`, `catalog-uat` and `notify-closed-set-locks` each
   assert the new meaning. Each was seen to fail against the old code and pass
   against the new; none was deleted to make room.
5. `docs/output-catalog.md` and every other document stating that
   workflow-bearing plugins degrade is corrected in this phase, not a later one.
6. `npm run check` is green.

**Plans**: 5/5 plans executed in 4 waves
**Wave 1**

- [x] 109-01-PLAN.md — Turn the five locking gates and the published catalog contract, and observe each one RED

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 109-02-PLAN.md — Move the kind across the closed sets and retire the dedicated reason, in two atomic commits

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 109-03-PLAN.md — Close the 68 compile-forced `componentPaths` construction sites
- [x] 109-04-PLAN.md — Close the 8 compiler-invisible payloads, turn the catalog fixtures and the classifier owner test

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 109-05-PLAN.md — Pin the 109-111 window at install level and take the phase through `npm run check`

### Phase 110: Domain and platform modules

**Goal**: The three leaf modules the bridge needs — script admission, project-key derivation, and the engine home directory — are on this branch with owner tests and no test-only seams.
**Depends on**: Phase 109 (`domain/workflow-script.ts` is reachable without it, but the phase's own gate run is not green until the resolver compiles)
**Requirements**: WNAM-01, WNAM-02, WNAM-03, WNAM-04, WNAM-05, WNAM-06, WPTH-02
**Start from**: branch `features/workflow-port-wip`, which already carries these modules verbatim from the spike branch plus the three additive edits their imports need. Do NOT rewrite them from scratch. `git checkout features/workflow-port-wip -- extensions/pi-claude-marketplace/domain/workflow-script.ts extensions/pi-claude-marketplace/domain/workflow-project-key.ts extensions/pi-claude-marketplace/platform/workflow-home.ts extensions/pi-claude-marketplace/domain/name.ts extensions/pi-claude-marketplace/shared/errors.ts`. Read [`port/README.md`](port/README.md) first — it records what is verbatim, what is not, and why. The work of this phase is the owner tests and the seam removal, not the modules.
**Success Criteria** (what must be TRUE):

1. `domain/workflow-script.ts`, `domain/workflow-project-key.ts` and
   `platform/workflow-home.ts` are present, together with
   `generatedWorkflowName` in `domain/name.ts` and the two error classes in
   `shared/errors.ts`.
2. `acorn` is a declared runtime dependency at `^8.16.0`, the range the host
   engine itself pins.
3. Each of the three modules has a mirrored owner test that covers it directly,
   and `npm run test:corresponding` passes for them.
4. No `__test_*` export is introduced. Where the spike reached a unit through
   one, the unit is made reachable from its own test instead.
5. `meta.name` extraction survives the comment decoy, the string decoy and the
   double-quoted key, and reports its four non-admission verdicts distinctly.
6. The project-key derivation reproduces the engine's across the Spike 025 case
   set, proved by a test that fails when the hash width is changed.

**Plans**: 3/3 plans executed in 3 waves, one per commit boundary. The waves are serialized
deliberately: `use_worktrees` is `false` here, so same-wave plans share one
working tree, and every gate this phase leans on (`typecheck`, `fallow`,
`format:check`, `npm test`) scans the whole tree rather than the staged diff.
Wave 3 additionally carries a real code dependency — `domain/workflow-script.ts`
imports `generatedWorkflowName` and `WorkflowNameCollisionError`, both landed in
wave 2.

**Wave 1**

- [x] 110-01-PLAN.md — Tracer: land `platform/workflow-home.ts` seam-free and
  `domain/workflow-project-key.ts` with their owner tests, proving the
  path-scoped checkout leaves Phase 109 intact

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 110-02-PLAN.md — Land `generatedWorkflowName` and
  `WorkflowNameCollisionError`, and complete the engine-parity gate red-first so
  every generated name passes the real `isSafeSavedWorkflowName`

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 110-03-PLAN.md — Declare `acorn`, land `domain/workflow-script.ts` with the
  owner test that is also its only consumer, and take the phase through the full
  gate in one atomic commit

### Phase 111: Workflows bridge

**Goal**: The sixth bridge exists as a discover / stage / unstage triplet with the same shape as its five siblings, and writes its envelopes atomically into a directory outside every scope root.
**Depends on**: Phase 110
**Requirements**: WBRG-01, WBRG-02, WBRG-03, WBRG-04, WPTH-01, WPTH-03, WPTH-04, WPTH-05
**Start from**: branch `features/workflow-port-wip`. `git checkout features/workflow-port-wip -- extensions/pi-claude-marketplace/bridges/workflows extensions/pi-claude-marketplace/persistence/locations.ts`. These are verbatim from the spike branch and were verified to compile against this branch once Phase 109 lands. The work of this phase is the owner tests, not the bridge.
**Success Criteria** (what must be TRUE):

1. `bridges/workflows/` provides `discover`, `prepareStage` / `commitPrepared` /
   `abortPrepared`, and `unstage`, and `persistence/locations.ts` owns every
   path it writes through `assertPathInside`.
2. Discovery is flat, non-recursive, refuses symlinks, and dedups first-wins.
3. A script that cannot be read or staged is reported through `warnings[]`
   without failing the plugin install.
4. **A stem-fallback workflow gets a `warnings[]` row.** Every WNAM-02
   stem-fallback verdict names a command the engine cannot actually load: its
   `validateMeta` requires a `meta.name` and a `meta.description` that both
   resolve to non-empty strings, and no shape that reaches the stem fallback
   resolves a name. Phase 110 settled that narrowing the fallback in
   `domain/workflow-script.ts` is the wrong place — it would replicate engine
   structural rules the module deliberately does not copy, and it cannot see the
   `description` half at all. The bridge stages the envelope and owns the
   warning channel, so the row belongs here: it must say the command will not
   run until the script declares a literal `name` and `description`. A test
   states it, so the arm is not silently a dead-command factory.
5. Staging sits adjacent to its target so the commit `rename()` never crosses a
   filesystem boundary, and a commit that finds foreign content at a target path
   refuses before its first rename.
6. Every file under `bridges/workflows/` has a mirrored owner test and
   `npm run test:corresponding` passes.
7. `npm run check` is green.
8. **`EXTENSION_VERSION` is bumped in this phase.** Phase 109 deliberately left it
   at `0.18.1` (D-109-06 / A-03) because bumping it would have fired the
   `supportedSetGrew` convergence with no bridge to materialize anything. That
   prohibition inverts here. Records persisted under the released v0.18.1 by a
   `--partial` install carry `unsupported: ["workflows"]` and today render
   `{unsupported component}` -- a token naming a kind Pi now supports. The
   backfill scan that repairs them returns early while
   `state.lastReconciledExtensionVersion === EXTENSION_VERSION`
   (`orchestrators/reconcile/backfill.ts:76`); the bump is what releases it, and
   `backfill.ts:343` then re-materializes through `reinstallPlugin`. Without the
   bump those records stay stale permanently.
9. **The install-window assertion is inverted.**
   `tests/integration/workflow-kind-inversion.test.ts` currently asserts
   `~/.pi/workflows` does NOT exist -- the D-109-06 window. Once the bridge
   lands it must assert the envelopes ARE written. Its positive precondition
   (the fixture resolves `workflows` supported) stays as-is; only the ENOENT
   half moves.

**Plans**: 4/4 plans executed in 4 waves, each wave one commit group. The waves are serialized
deliberately: `use_worktrees` is `false` here, so same-wave plans would share one working tree,
and every gate this phase leans on (`typecheck`, `lint`, `fallow`, `format:check`,
`test:corresponding`, `npm test`) scans the whole tree rather than the staged diff. Waves 2 and
3 additionally carry real code dependencies — `bridges/workflows/stage.ts` imports
`discover.ts` and `WorkflowTargetOccupiedError`, and the barrel imports all three siblings.

The bridge itself is a verbatim port from `features/workflow-port-wip`, landed by path-scoped
checkout with the five-file blast-radius assertion after each one. The work of the phase is the
owner tests, plus the one new behavior (criterion 4) and the two mechanical obligations
(criteria 8 and 9).

**Wave 1**

- [x] 111-01-PLAN.md — Tracer: land the `persistence/locations.ts` workflows members and
  `WorkflowTargetOccupiedError` with their owner tests, proving the artifact-path chokepoint,
  the new writable root and the hermetic-`HOME` discipline before anything writes

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 111-02-PLAN.md — Land types, discovery and unstage with the `bridges-workflows` boundary
  zone, and add the admitted-but-caveated stem-fallback warning row red-first

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 111-03-PLAN.md — Land the staging triplet and the barrel, pinning the envelope bytes, the
  occupancy refusal before the first rename, and every rollback branch

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 111-04-PLAN.md — Bump `EXTENSION_VERSION` at all six sites and invert the install-window
  assertion so it proves the envelope present

### Phase 112: Install and removal lifecycle

**Goal**: Installing a workflow-bearing plugin writes its envelopes as a sixth ledger phase that unwinds with the rest, and every removal path takes them away again.
**Depends on**: Phase 111
**Requirements**: WLIF-01, WLIF-02, WLIF-03
**Start from**: nothing ported. `orchestrators/plugin/update-row.ts` and the `"workflows"` widening of the ledger `phase` union were deliberately left out of `features/workflow-port-wip`, because main rewrote the orchestrators they touch (`install.ts` 1243+/1222-, `reinstall.ts` 244+/715-). Read the spike branch's versions for intent, then write against the current files. `git show features/workflows-spike:extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` is reference, not a source to copy.
**Success Criteria** (what must be TRUE):

1. `runPhases` carries a sixth phase whose `undo` removes the envelopes it
   wrote. A later phase failing leaves nothing behind, which matters more here
   than for any other bridge because the envelopes live outside every scope root
   and no scope-root cleanup will ever find them.
2. The ledger `phase` union in `shared/errors.ts` carries `"workflows"`.
3. `uninstall`, `disable` and `marketplace remove --cascade` all remove workflow
   envelopes, and a removal that partly fails reports per-name reasons through a
   typed error.
4. `reinstall` re-materializes envelopes from the plugin source and records the
   names it actually wrote.
5. The wiring is written against the current `install.ts` / `uninstall.ts` /
   `reinstall.ts`, not transplanted from the spike branch, which predates their
   rewrite.
6. **An orphaned staging tree is swept or reported.** Carried from the Phase 111
   code review (WR-08). `<workflowsStagingDir>/<uuid>/` is created before the
   write loop and removed only by `commitPreparedWorkflows` or
   `abortPreparedWorkflows`. A crash, a `SIGKILL`, or the deliberate retention
   path a failed restore takes leaves it behind holding verbatim third-party
   executable JavaScript. Because the staging root lives under
   `~/.pi/workflows/` and not under any scope root, nothing sweeps it: it is
   invisible to `uninstall` and to `/reload`, and it accumulates for the life of
   the machine in the user's home. The retention path at least names its path in
   a leak message; a crash-orphaned tree names nothing anywhere. Phase 111
   declined to fix this in the leaf bridge: a sweep is a lifecycle concern, it
   must be age-bounded so a concurrent install's fresh staging root is never
   removed, and the bridge has no view of which trees belong to a live
   transaction. This phase owns the ledger and is where that view exists.
7. `npm run check` is green.

**Plans**: 2/4 plans executed in 3 waves. The waves are serialized because `use_worktrees` is `false` here, so
same-wave plans would share one working tree while every gate this phase leans on scans the whole
tree rather than the staged diff. They also carry a real ordering constraint: the `resources.workflows`
record member is an unnamed prerequisite of criteria 3 and 4, so it lands in the first commit of wave 1
and everything that reads or writes it follows.

Plans:

- [x] 112-01-PLAN.md — the workflow inventory on the install record, the sixth ledger phase with its
  undo, and the three mirrored ledger-phase closed sets (wave 1)
- [x] 112-02-PLAN.md — the sixth cascade slot, the dropped-axis, both partial-cascade record folds, and
  removal pinned on all four verbs (wave 2)
- [x] 112-03-PLAN.md — reinstall re-materializes envelopes and records the names it actually wrote
  (wave 2)
- [x] 112-04-PLAN.md — the age-bounded orphan staging sweep and the stale bridge-count corrections
  (wave 3)

### Phase 113: Update, enable/disable, reconcile

**Goal**: The remaining lifecycle verbs treat workflows as a first-class component kind, and the read surfaces show them.
**Depends on**: Phase 112
**Requirements**: WLIF-04, WLIF-05, WLIF-06, WFLW-04
**Start from**: nothing ported, for the same reason as Phase 112 — main rewrote `update.ts` (860+/771-), `enable-disable.ts` (466+/406-) and `reconcile/apply.ts` (205+/781-). `orchestrators/plugin/update-row.ts` on `features/workflows-spike` is the one file here that would still apply cleanly; treat it as a starting draft to re-verify, not a drop-in.
**Success Criteria** (what must be TRUE):

1. `update` prepares, aborts, commits and records workflows as a sixth bridge,
   so an author's workflow fix reaches the user and a withdrawn workflow stops
   being registered.
2. `enable` and `disable` materialize and unstage envelopes, and the staged
   workflow names ride on the projection both verbs read.
3. Load-time reconcile does not re-materialize envelopes on every load.
4. `info` renders a `workflows:` line and `list` counts the kind, both under the
   project's byte-equality contract with paired fixtures.
5. **The discovery warning phrases stop asserting an install outcome on the
   `info` surface.** Carried from the Phase 111 code review (WR-09). All four
   soft-fail phrases in `bridges/workflows/discover.ts` are install-tense --
   `"was installed but will not run"`, `"was not installed"`, `"was refused"`,
   `"could not be read and was skipped"` -- yet `discoverPluginWorkflows` runs
   before anything is staged, and both `types.ts` and the discovery module
   header state that this read-only surface consumes the SAME discovery pass. On
   `info` for a plugin that is not installed, every one of those rows is a false
   statement, and `"was installed but will not run"` is the worst: it tells the
   user an envelope exists that does not. The fix is to make the outcome phrase
   a parameter of the discovery call rather than a constant of the module, so
   the staging surface and the `info` surface each state their own tense. Phase
   111 declined to choose the wording, because this phase is the one that builds
   the `info` surface and the phrasing is shipped text that will be quoted back.
   (`"could not be read and was skipped"` is also inaccurate at its `lstat` call
   site, where nothing was read.)
6. **The `workflows` failure-phase widenings stop being inert.** Carried from
   the Phase 112 code review (WR-03). Three closed sets -- `update.ts`'s two
   failure-phase arrays, `orchestrators/types.ts`, and `shared/errors.ts` --
   already carry a `workflows` member that `update.ts` cannot produce, so the
   compile-forcing signal `PHASE3_FAILURE_PHASES` exists to give ("a future
   bridge surfaces here as a TS error") is already spent for this axis. Phase
   112 left them widened rather than reverting type-only churn for one phase.
   Criterion 1 above is what makes them honest: once `update` stages workflows,
   each widened slot must be reachable and covered by a case that drives a
   workflows failure through the update verb. Until then the gap is silent --
   an update reports success while the envelopes on disk still hold the
   PREVIOUS version's executable script, a workflow the new version added never
   appears, and one it removed stays installed and runnable. No row, reason
   token or warning marks it. Nothing outside this branch is exposed, because
   the kind is not fully shipped until Phase 114.
7. **A retained workflows staging tree becomes discoverable.** Carried from the
   Phase 112 code review (WR-06). The sweeper deliberately keeps any aged
   staging root whose `.previous/` still holds displaced envelopes, because
   those bytes are the only surviving copy of the user's previous workflow
   scripts. Nothing then removes that tree, and nothing names it: it sits
   outside every scope root so uninstall and `/reload` cannot reach it, and both
   sweeper call sites discard the return inside a bare `catch {}` under D-19-01.
   The operator's only notice is the one-shot leak line inside the failure that
   caused the retention — and on the crash path there is no failure and
   therefore no line at all, so a kill signal between the displacement and the
   rename loop leaves the targets empty, the only copies inside `.previous/`,
   and no surface that mentions either. Retaining beats the alternative Phase
   112 replaced (a silent 24-hour expiry on the recovery copy), but "kept
   forever, undiscoverable" is not the finished state. Phase 112 did not build
   the read surface because this phase builds the surfaces that would render it:
   criterion 4 above is what gives `info` a `workflows:` line. The shape is a
   second channel off the sweep — `{ leaks, retained }`, with `retained`
   carrying the staging path and the envelope count — rendered once from `info`
   or `pending`. Returning it before a renderer exists would add a member both
   call sites discard.
8. `npm run check` is green.

**Plans**: TBD

### Phase 114: Degradation and documentation

**Goal**: The host engine becomes the third soft dependency, and the contract of the one bridge that installs executable code is written down.
**Depends on**: Phase 113
**Requirements**: WDEP-01, WDEP-02, WDEP-03, WDEP-04, WDOC-01, WDOC-02, WDOC-03
**Success Criteria** (what must be TRUE):

1. `DEPENDENCIES` carries a third member and every surface that can render a
   soft-dependency marker renders `requires pi-dynamic-workflows`.
2. The envelopes are written whether or not the engine is loaded, and two
   installs differing only in the session's tool list write the same bytes.
3. A gate, not a grep, proves the marker coverage: reverting any one
   `Dependency[]` derivation turns exactly one case red.
4. `docs/workflows-compatibility.md` states which engine runs third-party
   JavaScript, how it is sandboxed, which script shapes install and then refuse
   to run, and which claims were measured versus read. Engine claims cite 3.10.1
   and Spike 027.
5. The engine's own peer floor (`pi-coding-agent >=0.80.8`) is documented as
   distinct from this project's (`>=0.80.5`).
6. **The path-bearing premise is confirmed against Claude Code's own
   documentation, or the behavior resting on it is changed.** Phase 109 admitted
   `workflows` to `SUPPORTED_COMPONENT_PATH_KINDS`, which routes a declared
   `workflows` field through `validateComponentPath` and makes a non-string
   declaration resolve `unavailable` rather than degrade to
   `partially-available`. That is a harsher verdict than the pre-inversion one
   and it rests on the premise that upstream's field is path-bearing. The
   premise has lineage -- WFLW-02 states the `string | array` shape, Spike 021
   recorded it as assumption A1 at risk grade Low -- but no upstream citation.
   `tests/domain/resolver.test.ts` pins the consequence and names this as the
   phase that settles the premise. Upstream absence is itself a decisive answer;
   record whichever way it goes.
7. `npm run check` is green.

**Plans**: TBD

### Phase 115: Install-time admission-gate warnings

**Goal**: A plugin author who ships a workflow script the host engine will refuse learns it at install time, with the refusing gate named — and the install still succeeds, every sibling script is unaffected, and no gate reading can ever block anything.
**Depends on**: Nothing (independent of Phases 116 and 117; touches `domain/workflow-script.ts` and `bridges/workflows/stage.ts`, which the other two phases do not)
**Requirements**: WGATE-01, WGATE-02, WGATE-03, WGATE-04, WGATE-05, WDOCS-01
**Success Criteria** (what must be TRUE):

1. Installing a plugin whose workflow script trips one of the seven unreplicated
   engine checks — `meta` declared after another statement, `export let meta`,
   a non-exported `const meta`, two bindings in one declaration, a missing
   initializer, or a `meta` the engine's literal validation would reject —
   emits a per-script warning naming that file and that gate, and the script's
   envelope is still written.
2. A gate reading never refuses a script and never fails a plugin: a warned
   plugin still resolves and renders as `(installed)`, its sibling scripts
   install with no warning of their own, and no plugin-level status, glyph, or
   disposition changes.
3. The two existing refusal paths are unchanged: a script acorn cannot parse is
   still refused whole with no gate warnings attached (there is no tree to read
   the gates off), and a determinism-blocklist match is still refused by file
   with its existing four-way reason.
4. The admit-versus-run table in `docs/workflows-compatibility.md` states
   replicate / warn / neither per gate, and every row agrees with what the
   bridge does.
5. `WFLW-01` is gone from `.planning/BACKLOG.md`, recorded under the file's
   existing pruned-footer convention naming the `workflows` milestone that
   closed it, so the backlog stops advertising completed work as open.

**Plans**: TBD

### Phase 116: Load-time workflow convergence

**Goal**: A user who installed a workflow-bearing plugin before the `workflows` kind was admitted gets its workflow commands after one reload, exactly once, and can tell from the output why commands appeared after a reload they did not initiate.
**Depends on**: Nothing (independent of Phase 115 — the seam is `orchestrators/reconcile/`, a different layer)
**Requirements**: WCONV-01, WCONV-02, WCONV-03
**Success Criteria** (what must be TRUE):

1. A recorded plugin at `installable: true` whose offline re-resolution now
   yields a strictly larger supported set is re-materialized on the next load,
   and its workflow commands are runnable after that reload — with no `update`
   and no `reinstall` run by the user.
2. The self-heal is one-time: a second load re-materializes nothing, writes
   nothing, and leaves `state.json` untouched — the same extension-version
   stamp and strict-superset test the `installable: false` arm already uses.
3. A record whose supported set did not grow is never re-materialized, and a
   record the user disabled is never scanned, so widening the arm reverses no
   explicit user decision and churns no state for a plugin whose boundary did
   not move.
4. A convergence that materialized artifacts is visible on its reconcile row
   through a closed-set reason token — pinned in
   `tests/architecture/notify-closed-set-locks.test.ts` and
   `tests/architecture/compat-01-no-expansion.test.ts`, and byte-paired in
   `docs/output-catalog.md` against `tests/architecture/catalog-uat.test.ts` —
   while a scan that materialized nothing stays silent.

**Plans**: TBD

### Phase 117: Measured `agent()` failure evidence

**Goal**: The claim that decides whether a copied workflow script degrades or dies rests on a measurement against a real engine rather than a source read, and every document that states it says so at the grade it actually holds.
**Depends on**: Nothing (independent of Phases 115 and 116; the scratch install can be primed at any point in the milestone, since nothing before it reads the result)
**Requirements**: WEVID-01, WEVID-02, WDOCS-02
**Success Criteria** (what must be TRUE):

1. `tests/live-uat/workflow-storage-canary.mjs` drives the host engine's
   `agent()` failure path and asserts the observed behavior — rejection versus
   resolution to `null` — instead of restating the source read.
2. A negative control in the same driver proves the assertion can fail:
   inverting the expectation turns the run red, so a green run means something.
3. The canary has been run against a real engine 3.5.1 through the scratch
   install route (`npm install --prefix` plus `PI_WORKFLOW_ENGINE_ROOT`), and
   its result is recorded. The engine is deliberately not a declared
   dependency, so this is a HUMAN-UAT item rather than an automated gate, and
   the phase carries it as one.
4. `docs/workflows-compatibility.md` states the `agent()` divergence at its
   measured grade and names the concrete consequence for the upstream
   `pipeline(...)` plus `.filter(Boolean)` pattern — used by six of the seven
   real Anthropic workflow scripts, twelve times in total.
5. `105-VERIFICATION.md` no longer records the live canary as `UNRUN` while its
   own frontmatter and status line record it closed; the current record wins.

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 109. Kind inversion | 5/5 | Complete    | 2026-09-04 |
| 110. Domain and platform modules | 3/3 | Complete    | 2026-09-05 |
| 111. Workflows bridge | 4/4 | Complete    | 2026-09-05 |
| 112. Install and removal lifecycle | 4/4 | Complete    | 2026-09-05 |
| 113. Update, enable/disable, reconcile | 0/? | Not started | - |
| 114. Degradation and documentation | 0/? | Not started | - |
| 115. Install-time admission-gate warnings | 0/? | Not started | - |
| 116. Load-time workflow convergence | 0/? | Not started | - |
| 117. Measured `agent()` failure evidence | 0/? | Not started | - |

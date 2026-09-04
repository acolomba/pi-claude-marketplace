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

- [ ] **Phase 109: Kind inversion** — `workflows` moves from `UNSUPPORTED_COMPONENT_KINDS` to both supported tuples, and every closed set, classifier arm, doc, and locking test that #154 wrote is turned with it (WINV-01..05)
- [ ] **Phase 110: Domain and platform modules** — `workflow-script.ts`, `workflow-project-key.ts`, `workflow-home.ts`, the `name.ts` addition, and the `acorn` dependency land with owner tests and no test-only seams (WNAM-01..06, WPTH-02)
- [ ] **Phase 111: Workflows bridge** — `bridges/workflows/` discover / stage / unstage / types and the `locations.ts` additions land with owner tests (WBRG-01..04, WPTH-01, WPTH-03..05)
- [ ] **Phase 112: Install and removal lifecycle** — the sixth ledger phase, cascade unstage, and reinstall re-materialization, wired against the rewritten `install.ts` / `uninstall.ts` / `reinstall.ts` (WLIF-01..03)
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

- Integer phases (106-108): planned milestone work continuing the global
  counter past Phase 108, the highest number any milestone in this repo has
  used. Phase 106 is already held by the `workflows-detection` milestone and
  106-108 by the archived v1.19 milestone, so the original 106-108 numbering
  could not be kept.

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
| 106. Install-time admission-gate warnings | 0/? | Not started | - |
| 107. Load-time workflow convergence | 0/? | Not started | - |
| 108. Measured `agent()` failure evidence | 0/? | Not started | - |

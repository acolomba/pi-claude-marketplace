# Phase 4: Install provenance - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Each install record states how the plugin got there — the user asked for it by
name, or another plugin declared it — and reconcile respects that distinction.
The field is what `--prune` reads in Phase 5.

Requirements: PROV-01..04.

**This phase is larger than "add a field."** Phase 3 shipped a fix for CR-01
that writes every cascade-installed dependency into `claude-plugins.json` — the
DESIRED-STATE config. That conflates what the user asked for with what was
pulled in to satisfy it, and it destroys the very distinction `--prune` needs.
Phase 4 both introduces provenance and retires that write. Provenance is
therefore load-bearing for RECONCILE correctness, not just for `--prune`: once
the config write is gone, the provenance field is the only thing stopping
`buildUninstallBucket` from uninstalling every dependency on the next
`resources_discover`.

Not in this phase: `--prune` itself and PRUNE-01..04 (Phase 5), FLAG-01
(Phase 5), MIGR-01's staleness gate and the `persistence/migrate.ts` deletion
(backlog — and see D-04-06, this phase no longer borrows anything from it).

</domain>

<decisions>
## Implementation Decisions

All six were settled by the operator during the 2026-09-15 discussion. D-04-01
through D-04-03 were settled before the session paused; D-04-04 and D-04-05
were the two open questions, both answered on resume with the recommended
option.

### What the field is

- **D-04-01: Provenance stores the MODE ONLY — `"explicit" | "dependency"`.**
  No declaring-plugin list, no back-reference of any kind. A stored declarer
  list is a cache of another plugin's manifest: it drifts whenever any plugin
  is installed, updated or uninstalled, and nothing would keep it honest.
  `--prune` instead re-derives "does anything still need this?" at prune time
  by reading the installed plugins' declarations offline (the Phase 1
  `domain/dependencies.ts` read). Deriving on demand cannot go stale.
  — **Reversibility:** cheap to extend later (a declarer list could be added
  as an optional additive field), costly to retract once written.

- **D-04-02: The desired-state config holds ONLY explicitly-requested
  plugins.** Cascade-installed dependencies are NOT written to
  `claude-plugins.json` or its `.local.json` overlay. Operator decision,
  2026-09-15: *"don't write dependencies to config... the desired state
  configuration only contains explicit plugins."* Dependencies are already
  derivable from the marketplace records plus the declaring plugins'
  manifests, so the config write bought nothing that provenance does not buy
  more honestly.

  This REVERSES the shape of Phase 3's CR-01 fix — both arms at
  `orchestrators/plugin/install-flow.ts:1340-1365`: the
  `dependencyPluginPatches` arm and the `writeOrchestratedDeclarations`
  call's `dependencyKeys` argument. Phase 3's own artifacts (SUMMARY,
  REVIEW, REVIEW-FIX, VERIFICATION) all describe that write as the correct
  fix. It IS correct as a mechanism — it works, and its tests prove it
  works. It is the wrong design. **Those artifacts do not settle this
  question; this decision supersedes them.**
  — **Reversibility:** one-way in practice — Phase 5's `--prune` is built on
  the separation this restores.

### How it is persisted

- **D-04-03: schemaVersion 2 → 3. The field is REQUIRED at v3. Absence is
  filled with `"explicit"`, and the upgrade is SILENT.** No released version
  through v0.18.3 had a dependency cascade, so every record written by a
  released build genuinely IS explicit — the default is truthful, not a
  guess. Records Phase 3 wrote on development trees are mislabelled; the
  ROADMAP already accepted that cost ("lands on development trees only, and
  this milestone releases as a single version").

  The mechanism is the `enabled` precedent exactly:
  `persistence/migrate.ts::ensurePluginEnabled` fills an absent required
  field with its truthful default BEFORE `STATE_VALIDATOR.Check` runs, and
  says nothing. Mirror it — same iteration shape, same mutated-flag
  discipline, same "only an ABSENT field is filled; a present-but-wrong
  value is left for the validator to reject with an actionable error."
  — **Reversibility:** costly — a shipped schemaVersion is on users' disks.

### How the reversal is sequenced

- **D-04-04: The whole reversal lands in Phase 4, in a fixed three-step
  order.** Phase 3 stays closed and verified; its config write is treated as
  a bridge that Phase 4 retires rather than a defect that reopens the phase.

  **The order is part of the contract:**

  1. The provenance field exists and every install path writes it.
  2. `buildUninstallBucket` skips records with `provenance: "dependency"`.
  3. Only then, remove the config write.

  **Any plan that reorders these is wrong.** The config write is currently
  the ONLY thing stopping `buildUninstallBucket` from sweeping cascade
  dependencies on the next `resources_discover`. Removing it before step 2
  lands re-opens CR-01 — a blocker-severity data-loss defect where a user's
  dependencies silently vanish on reload. Step 3 must not land in an earlier
  execution wave than step 2.

  CR-01's regression test stays honest across all three steps: it asserts
  that a cascade-installed dependency survives a reload, which remains true
  throughout — first via the config write, then via provenance.

  The alternatives considered and rejected: reopening Phase 3 to revert the
  write (leaves a window where dependencies ARE swept, and forces a
  re-verification of a phase closed at 5/5), and deferring the removal to
  Phase 5 (makes Phase 5 the largest phase in the milestone on top of
  PRUNE-01..04 and FLAG-01, and ships the conflation for a phase longer).

### What reconcile does with everything else

- **D-04-05: `buildUninstallBucket` keeps sweeping genuine orphans. Exactly
  one exemption is added: `provenance: "dependency"`.** A recorded plugin
  that is neither named in the merged config nor marked as a dependency is
  still uninstalled, exactly as today. This is the smallest change that makes
  the model work, and it leaves established reconcile behavior otherwise
  untouched.

  The alternative — keep an orphan and report it instead — is safer against
  an accidental hand-edit of `claude-plugins.json`, but it changes reconcile
  behavior well beyond this phase's scope and would need its own closed-set
  reason token and catalog byte form. Rejected for this phase; not reopened
  by it either.

### What the requirement actually says

- **D-04-06: PROV-04 is reworded, and this phase borrows nothing from
  MIGR-01.** As written, PROV-04 demands a pre-milestone record be "reported
  as stale rather than silently repaired" — which D-04-03's silent upgrade
  does not satisfy and is not trying to. Replacement wording:

  > **PROV-04**: an install record written before this milestone is upgraded
  > to the current schema with a truthful default, and no record is
  > misreported as a dependency.

  The consequence: the MIGR-01 guard-wording question — the notify text and
  recovery command for "stale state, absent config" — is NOT answered in this
  phase. It returns to MIGR-01 in the backlog, intact. The ROADMAP's "Scope
  of the borrowed MIGR-01 answer" note is superseded, as is its "a required
  field is the staleness detector" note (a required field WITH a migrate fill
  is not a staleness detector — that is the whole point of D-04-03).

### How PROV-03's promotion is reported

- **D-04-07: `install <plugin>` on a dependency-installed plugin PROMOTES it and
  reports a distinct new outcome row.** Operator decision, 2026-09-15, after
  research established that no promotion path exists today.

  Today that command throws `PluginShapeError({ kind: "already-installed" })` at
  `orchestrators/plugin/install-outcome.ts:414` and renders `(failed)
  {already installed}`. That throw is on the **non-mutating** arm, and
  `install-flow.ts` saves only on its mutating arm (`WR-04`), so a promotion
  written at the throw site would be silently discarded. There is exactly one
  code path for PROV-03's scenario and it currently produces a failure.

  The new behavior: promote `provenance` to `"explicit"`, write the plugin's
  key into the config (consistent with D-04-02 — the user has now asked for it
  by name, so it belongs in desired state), change no other record, and report
  a distinct row.

  **This expands the phase into the pinned output catalog, deliberately.** The
  amendment is the project's sanctioned mechanism for exactly this and must
  land in full: a new closed-set `REASONS` member (`shared/notification-types.ts`),
  a `docs/output-catalog.md` row, a `catalog-uat` fixture, a bump of the
  documented-state count the catalog contract test asserts, and
  `notify-closed-set-locks.test.ts`.

  Rejected alternatives: reusing the existing `already installed` bytes for a
  row that MUTATES state — it would be the one row in the catalog that lies,
  and it contradicts the notification tri-state model where `error` means
  not-carried-out; and promoting via reconcile instead of the command, which
  needs an apply-side bucket or fold that D-04-05 explicitly scoped out
  (`plan.ts` is pure and gated by `reconcile-planner-purity.test.ts`).
  — **Reversibility:** one-way — a published catalog row is a user-visible
  contract.

### How this phase's IDs are spelled in source

- **D-04-08: source comments anchor on `D-04-NN`, never on `PROV-NN`.**
  `PROV-01..07` ALREADY means *git auth **prov**ider* in this codebase — 48
  citations across `extensions/`, `tests/` and `docs/`, including `PROV-05` and
  `PROV-07`, which this milestone never defined. `install-flow.ts:252` cites
  `PROV-03` today for the auth notify seam.

  `REQUIREMENTS.md` keeps `PROV-01..04` as the requirement names; only source
  comments avoid the ambiguous spelling. CONVENTIONS.md already blesses
  decision IDs as first-class traceability anchors, so this costs nothing and
  moves nothing existing. Renumbering the v1.20 family was considered and
  declined as milestone-level churn mid-phase.

### Derived rule, not a separate decision

- **Provenance is a one-way ratchet: `dependency` → `explicit`, never the
  reverse.** This is the direct consequence of PROV-02 and PROV-03 read
  together — an explicit install stays explicit when a later plugin declares
  it (PROV-02), and a dependency becomes explicit when the user installs it
  by name (PROV-03). Stating it as one rule is easier to implement correctly
  and easier to test than two independent transition cases. PROV-03 also
  requires the upgrade touch nothing else: no other record changes.

### Claude's Discretion

- Exact field name on the install record (`provenance` is the working name
  used throughout this document and the requirements) and whether the two
  values are a typebox `Type.Union` of literals or a named enum-ish constant
  — follow whatever the neighbouring fields in
  `PLUGIN_INSTALL_RECORD_SCHEMA` already do.
- Where the `dependency`-exemption predicate lives relative to
  `buildUninstallBucket` — inline condition versus a named helper. The
  function is small and flat today; keep it under both cognitive-complexity
  ceilings.
- Whether the three-step order (D-04-04) maps to three plans or to waves
  within fewer plans, so long as step 3 never precedes step 2.
- How the provenance value is threaded from the cascade into each member's
  install record — the cascade already knows which member is the root
  (`rootKey`) and which are closure members.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's own supersessions — read FIRST

- **This CONTEXT.md's `<decisions>` section supersedes Phase 3's artifacts on
  the config question, and supersedes two ROADMAP Phase 4 notes.** Phase 3's
  `03-SUMMARY`/`03-REVIEW`/`03-REVIEW-FIX`/`03-VERIFICATION` all describe
  writing cascade dependencies into `claude-plugins.json` as the correct fix
  for CR-01, with passing tests. Reading them as architectural truth will
  re-entrench the conflation this phase exists to undo.
- `.planning/phases/04-install-provenance/.continue-here.md` — the discussion
  handoff, including the blocking-constraint checklist and the anti-pattern
  table. Its two open questions are now closed (D-04-04, D-04-05).

### Phase boundary and requirements

- `.planning/ROADMAP.md` § Phase 4 — the goal, the four success criteria, and
  the COMPAT-01 amendment note (still current). Criterion 4 and the
  MIGR-01-borrow note were updated in this phase to match D-04-06.
- `.planning/REQUIREMENTS.md` PROV-01..04 (PROV-04 as reworded by D-04-06)
  and the MIGR-01 future requirement, whose scope this phase no longer
  touches.

### Prior phase decisions this phase builds on

- `.planning/phases/03-dependency-resolution/03-CONTEXT.md` — D-03-05 and
  D-03-06 (a dependency lands in the parent's scope, and its config entry
  mirrors the parent's file). D-04-02 retires the config-entry half of
  D-03-06; the SCOPE half of D-03-05 stands unchanged — a cascade dependency
  still installs into the requesting plugin's scope.
- `.planning/phases/03-dependency-resolution/03-UAT.md` — what was proven
  against live systems, and the one credential sub-item still unexercised.

### Project rules

- `.planning/codebase/CONVENTIONS.md` — typed error classes, the dual
  cognitive-complexity ceilings (ESLint `sonarjs/cognitive-complexity: 15`
  and fallow `health.maxCognitive: 15`, independently computed), and the
  "plant the violation, don't read the config" rule for gate tests.
- `.planning/codebase/ARCHITECTURE.md` — the reconcile flow
  (`resources_discover` → `applyReconcile` → `plan.ts`), and the note that
  reconcile is a config-to-record reconciliation, NOT a deep diff of records
  against on-disk artifacts.

</canonical_refs>

<code_context>
## Existing Code Insights

### The three files that change

- `extensions/pi-claude-marketplace/persistence/state-io.ts` —
  `PLUGIN_INSTALL_RECORD_SCHEMA` (line 81) is where the field lands.
  `STATE_SCHEMA.schemaVersion` (line 288) is the
  `Type.Union([Literal(1), Literal(2)])` that becomes `[1, 2, 3]`;
  `DEFAULT_STATE.schemaVersion` (line 306) and the two `{ schemaVersion: 2 }`
  literals at lines 387/458/462 follow. The `loadState` guard at lines
  408-410 rejects any version that is not 1 or 2 and must learn about 3.
- `extensions/pi-claude-marketplace/persistence/migrate.ts` —
  `ensurePluginEnabled` (line 161) is the exact template for the provenance
  fill: fill only an ABSENT field, leave a present-but-wrong value for
  `STATE_VALIDATOR.Check` to reject, run BEFORE the check, mutate a flag so
  the normalized state is persisted best-effort. Note the header comment
  block (lines 10-30) enumerates every fill; a new one belongs there too.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` —
  `buildUninstallBucket` (line 484). The sweep is the four-line inner loop at
  lines 500-506: for each recorded plugin, if its `plugin@marketplace` key is
  not in `declaredPluginKeys`, push an uninstall. D-04-05's exemption goes
  here and nowhere else. `mpRecord.plugins[pluginName]` is already in hand at
  that point, so the record's provenance is readable without threading new
  state through.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`
  lines 1340-1365 — the two arms D-04-02 retires. The `if` arm passes
  `dependencyPluginPatches: Object.fromEntries(installed.members.map(...))`;
  the `else` arm passes `dependencyKeys: installed.members.map(...).filter(key
  => key !== rootKey)` to `writeOrchestratedDeclarations`. Both carry
  comments citing "RESV-01's reload clause" as their justification — that
  justification moves to provenance, so the comments go with the code.

### Two drift hazards already documented in the source

- `clonePluginRecord` (`state-io.ts:147`) ENUMERATES the record's fields
  rather than spreading, precisely so a newly-added key is caught by whoever
  extends the schema. Its own doc comment says so. A provenance field that is
  not added here is silently dropped from every snapshot, with no compile
  error and no failure until a later reader wants it. `reinstall`'s replace
  step is today's consumer.
- `tests/architecture/compat-01-no-expansion.test.ts` holds THREE assertions
  this phase must amend deliberately, not loosen:
  - line 439, the pinned install-record key set by enumeration equality. Its
    failure message currently sanctions only OPTIONAL additive keys needing
    no schemaVersion bump. A REQUIRED field plus a bump means that message
    itself needs amending to record the new precedent. **Do NOT relax the
    equality into a subset check.**
  - line 529, `schemaVersion` union `[1, 2]` → `[1, 2, 3]`, whose message
    says "no state-schema migration was introduced" — now untrue, and the
    amendment is the deliberate act the gate exists to force.
  - line 545, `DEFAULT_STATE.schemaVersion` `2` → `3`.

### Established patterns

- The `enabled` field is the closest precedent in every respect: required at
  schemaVersion 2+, introduced with a bump, back-filled silently in
  `migrate.ts` with a truthful default, and accompanied by a documented
  over-fill caveat. Read ENBL-02's handling end to end before designing
  anything new.
- `resolvedSha` and `hookEntries` are the OPPOSITE precedent — optional,
  additive, no bump, no fill. Provenance deliberately does not follow them
  (D-04-03), because a record whose provenance is unknown is not a record
  that should read as "no answer yet."

</code_context>

<specifics>
## Specific Ideas

- The one branch Phase 3 and Phase 4 share is the cascade meeting an
  already-installed dependency: RESV-05 says skip the install, PROV-02 says
  do not downgrade its provenance. That is a single code path and a single
  test case, not two.
- After D-04-02, two earlier gray areas collapse to nothing: "is a
  config-named plugin explicit?" is trivially yes, and reconcile and import
  need no special provenance rule, because the config will only ever name
  explicit things.
- D-04-03 stays safe under D-04-02: a legacy record fills to `explicit`, so
  reconcile keeps it. Nothing is swept by the upgrade itself.
- **The fill will mislabel the dependency records Phase 3 wrote on development
  trees as `"explicit"`.** The ROADMAP accepted this in advance. The visible
  consequence lands in Phase 5: `--prune` will decline to prune those specific
  plugins on the operator's own machine. Say so in the phase summary and carry
  a note into Phase 5's UAT — otherwise it reads as a `--prune` bug and someone
  debugs the wrong thing. The remedy is to uninstall and reinstall the plugin,
  not to touch `--prune`.
- PROV-02 needs **no production code** — the cascade's already-installed branch
  never touches the record, so an explicit install stays explicit by
  construction. It is a test task, and the test must be written so it cannot
  pass vacuously.

### Execution environment notes (carried from the discuss checkpoint)

- **Force the isolation sentinel before EVERY `Agent()` dispatch.**
  `workflow.use_worktrees` is `true` in config, but `worktree base-check`
  reports `shouldDegrade: true` — HEAD diverges from `origin/HEAD` and this
  checkout is itself a linked worktree. The Agent guard reads a sentinel, not
  the base-check, so it blocks every dispatch until the sentinel is forced to
  `none`. A bare `dispatch-isolation` call re-resolves to `harness-worktree`
  and silently undoes the force, so it must be redone per dispatch.
- **`phase.complete`'s "file not on disk" warnings are mostly false
  positives.** It reported 22 across the Phase 3 summaries; all 22 were
  spurious — the scanner strips the `extensions/pi-claude-marketplace/`
  prefix, and the remainder were shell command lines and a doc example URL.
  Verify a sample under the real prefix before treating one as real.
- **Apply a verifier's cosmetic findings BEFORE dispatching it, or defer them
  to the next phase.** Fixing a stale test title that the Phase 3 verifier
  itself reported edited a `covered_files` entry and invalidated the
  `covered_digest` the verifier had just written, flipping the report to
  `stale`. If that happens, a scoped re-verify is the honest fix — never
  hand-edit `covered_digest`.
- **`.planning/config.json` is uncommitted on purpose.** It carries an
  agent-made `git.branching_strategy: milestone → none` (so this phase does
  not fork `features/v1.20` off `origin/main` and strand the milestone)
  alongside the operator's own `model_profile_overrides.codex` edit. The
  setting reads from disk, so Phases 4-5 honor it either way.

</specifics>

<deferred>
## Deferred Ideas

- **Reporting a genuine orphan instead of sweeping it** (the rejected arm of
  D-04-05). It needs its own closed-set reason token and catalog byte form,
  and it changes reconcile behavior beyond this milestone's scope. Worth
  revisiting if an accidental config edit ever costs someone an install.
- **MIGR-01's staleness gate** — the notify wording and recovery command for
  "stale state, absent config", plus deleting `persistence/migrate.ts` and
  replacing `migrate-config.ts` with a loud-failure guard. D-04-06 returns
  the wording half to MIGR-01 rather than answering a fraction of it here.

</deferred>

---

*Phase: 4-Install provenance*
*Context gathered: 2026-09-15*

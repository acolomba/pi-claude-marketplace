# Phase 9: Reload installs missing declared dependencies - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning

<domain>
## Phase Boundary

A desired plugin implies its dependencies. An explicit `/reload` that finds an
installed plugin missing a declared dependency installs that dependency the
way `install` would have -- through the install cascade, from the marketplace
the declaration resolves to, at a version inside every declarer's range, with
provenance `dependency` -- instead of leaving the dependent to be disabled by
Phase 6's check (MISS-01). When the dependency cannot be installed, the reload
completes, the failure is reported on the dependency's own row with its cause,
and the dependent is disabled by the load-time check with the install remedy;
nothing is half-materialized (MISS-02). A reload with nothing missing installs
nothing and stays offline (NFR-5).

Requirements: MISS-01, MISS-02.

Not in this phase: constraint-aware update (Phase 10), the cross-marketplace
allowlist (Phase 11 -- a cross-marketplace missing dependency resolves under
D-03-08's current rules here and gains the allowlist refusal there),
standalone `prune` (Phase 12), `marketplace add` / autoupdate running this
step (deferred below), `pending` computing a verdict (BACKLOG
`PENDING-VERDICT-01`, left open), re-enabling a disabled already-installed
dependency at load (upstream does not; see D-09-04).

</domain>

<decisions>
## Implementation Decisions

The operator's instruction for this phase: take Claude's recommendation on
each point unless upstream contradicts it, and follow upstream wherever
upstream has a behavior. Every decision below was therefore checked against
the installed Claude Code binary (2.1.267) before being written down; the
upstream facts are in `<specifics>`.

### Which dependents get their missing dependencies installed

- **D-09-01: The bucket derives from the LOAD-01 verdict's `missing` arm.**
  `dependency-verdict.ts::buildScopeSatisfactionVerdict` already walks every
  record's declarations offline inside the locked read pass (D-06-04) and
  emits one `UnsatisfiedDeclaration` per declared key with
  `kind: "missing" | "disabled" | "out-of-range"`. The planner filters the
  `missing` entries into a new bucket; no second declaration walk, no config
  read (D-04-02 holds: the config still names only what the user asked for).
  Upstream does literally this -- `resolveMissingDependencies(errors)`
  consumes the load check's `dependency-unsatisfied` errors filtered to
  `reason: "not-found"`.
  -- **Reversibility:** reversible -- a planner filter over an existing input.

- **D-09-02: A dependent counts when it will be enabled once this pass
  applies.** That is: its record is currently enabled; OR it is held only by
  the check's own `dependencyDisabled` marker (D-06-02) -- without this arm a
  dependent Phase 6 already put down could never recover through reload; OR
  it is user-disabled but the merged config declares it enabled (the enable
  bucket would re-enable it this pass, and its dependencies come with it).
  Excluded: a user-disabled record the config leaves alone (reload never
  overrides a user's disable), a config-declared `enabled: false` record, and
  any record the same plan uninstalls, disables, or whose marketplace it
  removes -- the planner sees those buckets and must not fetch dependencies
  for a plugin it is about to remove (the fetched record would be an orphan
  the D-04-05 exemption keeps forever). Upstream's check walks only plugins
  enabled in settings, including the ones it demoted in the same load; this
  set is that rule once config-vs-record divergence is folded.
  -- **Reversibility:** reversible -- a planner predicate.

- **D-09-03: The install reaches the missing dependency's whole transitive
  closure.** It goes through `runInstallCascade`, so attribution (RESV-02,
  D-03-08), range merge across branches (D-03-10), cycle termination
  (RESV-04), the Phase 7 tag probes for path sources, and D-03-07's
  all-or-nothing rollback of this run's own materializations all apply
  unchanged. Upstream installs the dependency through `installResolvedPlugin`,
  which walks the dependency's own closure.
  -- **Reversibility:** reversible.

- **D-09-04: A dependency that is installed but disabled is left alone.**
  Reload installs what is MISSING -- MISS-01's word. A disabled dependency
  keeps LOAD-01's `Enable "X" or uninstall "Y"` remedy. Upstream resolves only
  `not-found`; a `not-enabled` dependency is never re-enabled by
  `/reload-plugins`. This also keeps the reload path away from EDEP-03's
  config overwrite (the install cascade rewrites an `enabled: false` config
  entry to `true` for a re-enabled member; a load-time step must not).
  Consequence for the cascade: on this path a disabled record is a WALL, not
  a read-through member -- `installedKeys` includes disabled records rather
  than going through `liveInstalledKeys`, so the closure contains only
  never-installed keys and the phase array has no `re-enable` entries.
  -- **Reversibility:** reversible -- one input of the walk.

### How the install runs

- **D-09-05: One cascade per missing dependency KEY, rooted at the
  dependency.** Deduplicated across declarers (upstream groups its errors by
  dependency and installs each once). The root carries a range: the
  intersection of every eligible declarer's constraint for that key (the
  verdict walk's `constraintsByKey` already accumulates them per declarer;
  the bucket entry carries the fold), threaded into
  `resolveMemberConstraints` as a new root-range input so the root is pinned
  exactly as a constrained member is -- git-source tag probe or Phase 7's
  marketplace tag probe, TAGS-02's current-copy fallback when no tag
  satisfies. Every member, root included, records `provenance: "dependency"`
  (D-04-01: the caller's `ledgerOptionsFor` builder decides, so no cascade
  change is needed for that). No config write for any member (D-04-02), no
  D-04-07 promotion arm, no DFEN-04 landed-disabled arm: the dependency lands
  ENABLED whatever its own `defaultEnabled` says, because it exists to
  satisfy a declaration (BACKLOG ENBL-DEP-01's rule; upstream forces the same
  with `requiredByEnabledDependent: true`). This is a new orchestrated entry
  point beside `installPlugin` in `install-flow.ts` (or a sibling module)
  that shares the locked transaction, `lookupCascadeDependencies`,
  `resolveInstallMarketplaceSource`, the ledger-options builder and
  `hydrateInstalledHooks`; it is composed through `operations.ts` like the
  other operations and driven by `apply.ts` in `orchestrated` mode.
  Rejected: rooting the cascade at the dependent in a "recorded root" mode.
  It would need the root's phase suppressed (an already-recorded root throws
  from its own `do`), would merge only the ranges reachable from one
  dependent, and has no upstream counterpart.
  -- **Reversibility:** reversible in mechanism; the root-range input is
  additive to `InstallCascadeOptions`.

- **D-09-06: The step runs after `install plugins` and before the toggles.**
  Apply order becomes: uninstall -> remove marketplaces -> add marketplaces
  -> install plugins -> **install missing dependencies** -> enable -> disable
  -> dependency-disable (LOAD-01) -> source-mismatch. Marketplaces must be
  added before a declaration can resolve to them; config-declared installs
  run first so their own cascades claim what they need and this step finds
  those keys already present.
  -- **Reversibility:** reversible.

- **D-09-07: When at least one dependency was installed, the read pass is
  re-run and the toggle buckets are driven from the FRESH plan.** The
  read-pass verdict predates the install, so its `pluginsToDependencyDisable`
  still holds every dependent this step just satisfied and its
  `pluginsToEnable` still excludes them (D-06-03). Re-running
  `readPassForScope` after the step (one more locked read plus verdict walk,
  paid only when something was installed) and taking `pluginsToEnable`,
  `pluginsToDisable` and `pluginsToDependencyDisable` from the new plan is
  what lets a marker-held dependent come back up in the SAME reload, holds a
  dependent whose dependency failed, and catches a TAGS-02 current-copy that
  landed out of range -- which no plan-time prediction can see. The uninstall
  / remove / add / install buckets of the fresh plan are NOT re-driven (a
  round-1 failure would be retried and double-reported); source-mismatch rows
  come from the round-1 plan. Nothing installed -> the read-pass plan stands
  and the pass costs nothing extra; the steady-state reload is unchanged.
  Upstream re-loads plugins only when `installed.length > 0`.
  Rejected: always re-planning after any mutating bucket. It would also close
  the pre-existing one-reload lag after a config-driven uninstall of a
  dependency (the read-pass verdict cannot see the uninstall step's effect),
  but that is broader than this phase; recorded under Deferred Ideas.
  -- **Reversibility:** reversible -- an apply-side control-flow choice.

- **D-09-08: The lift becomes provenance-independent.** Today the only lift
  path for a `dependencyDisabled` record is `classifyDeclaredPlugin`'s enable
  branch, which iterates CONFIG-declared entries; a dependency-provenance
  record (never in config, D-04-02) that the check held down is never
  re-enabled by reconcile. On this phase's own success path -- A declares B
  (a dependency record), B declares C, C missing -- installing C would bring A
  up and leave B down, so A loads without B. The planner gains a record-walk
  sibling of `buildUninstallBucket`: a record carrying the marker that the
  live verdict no longer holds, and that the merged config does not declare
  disabled, is pushed onto `pluginsToEnable` whether or not the config names
  it. The apply side is unchanged (the enable re-runs the ledger's state
  phase, which rebuilds the record without the marker). Upstream has no
  persisted demotion, so its chains recover on the next load; this is the
  same observable behavior. It is a LOAD-02 gap Phase 6 left; it is fixed
  here because this phase is what first exercises it, and it is recorded as
  such (not as a Phase 6 defect to re-verify).
  -- **Reversibility:** reversible -- a planner bucket rule.

### What the user sees

- **D-09-09: One `(installed)` row per MATERIALIZED member, carrying a new
  closed-set token `{dependency installed}`.** The missing dependency and
  anything its own closure pulled in each get a row (upstream names every
  installed closure member: ` (+ N dependencies: a, b, ...)`). The token
  extends D-08-02's register (`dependency promoted` / `dependency pruned` /
  `dependency enabled`) and needs the full closed-set amendment mechanism:
  `REASONS` tuple, `notify-reasons.ts` header count, `docs/output-catalog.md`
  state + byte pins, `tests/architecture/notify-closed-set-locks.test.ts`,
  the catalog-uat fixture. No cause line: the register's success rows carry
  none, and `info` answers "who declares this". Rows render under the
  dependent's scope; a cross-marketplace member keeps the standalone
  cascade's `name@marketplace` key form.
  Rejected: folding members into one row per missing key as the
  `pluginsToInstall` row does today (that fold is a consequence of the
  install operation's single-outcome shape, not a surface choice, and upstream
  lists every member); a bare `(installed)` (an undeclared plugin appearing
  with no stated reason is exactly the row a user cannot explain).
  -- **Reversibility:** one-way -- a published catalog row.

- **D-09-10: A failure is two existing rows and no new token.** The failing
  dependency's own `(failed)` row carries the cascade's existing closed-set
  reason (`{dependency marketplace not added}`, `{no matching version}`,
  `{network unreachable}`, ...) and the redacted cause chain, through the
  existing `plugin-install-failed` outcome and `redactedDependencyCascadeError`
  path. The dependent gets Phase 6's `(disabled) {dependency unsatisfied}`
  row with the `Install "X" or uninstall "Y"` remedy from the re-derived
  check (or nothing, if it was already down -- the idempotent arm). No
  `{dependency failed}` row for the dependent: nothing was being installed
  for it, and its own row already names the remedy. Upstream: ` -- N
  dependencies still unresolved: x, y. Is the "mp" marketplace added?`.
  -- **Reversibility:** reversible in wording; reuses existing rows.

- **D-09-11: A member the walk skipped as already installed gets no row.**
  RECON-05's load-time silence: the reconcile surface reports transitions.
  The standalone cascade's `(skipped) {already installed}` row is a
  command-surface convention and is not copied here.
  -- **Reversibility:** reversible.

- **D-09-12: Preview renders the bucket as bare `(will install)` rows per
  missing key -- when a verdict is supplied.** `pending.ts` keeps calling
  `planReconcile` with the empty verdict default (D-06-10), so the bucket is
  empty on `pending` exactly as `pluginsToDependencyDisable` is today.
  BACKLOG `PENDING-VERDICT-01` stays the owner of whether preview computes an
  offline verdict; it is not pulled in.
  -- **Reversibility:** reversible.

### When it runs, retry, and proof

- **D-09-13: Only an explicit `/reload` runs the step.** Pi's
  `ResourcesDiscoverEvent.reason` is `"startup" | "reload"`; `index.ts`
  threads it into `applyReconcile` as one new option, and the missing-
  dependency step (and D-09-07's re-plan) runs only when it is `"reload"`.
  Upstream's session start runs the check and demotes but never installs;
  only `/reload-plugins` (and `marketplace add` / post-install activation,
  see D-09-15) resolves. Session start therefore stays offline even with a
  missing dependency, and LOAD-01's `Install "X" or uninstall "Y"` remedy is
  satisfied by `/reload` -- the same asymmetry upstream has. A startup
  reconcile still plans the bucket (the planner is reason-blind, so preview
  and the convergence test see it); only the apply step is gated.
  Rejected: every reconcile including startup -- Pi's converge-at-every-load
  posture, but an offline session start with a missing dependency would pay
  a failed clone every time, and it has no upstream counterpart.
  -- **Reversibility:** reversible -- one option and one gate.

- **D-09-14: A dependency that fails to install is retried on every
  `/reload` while the declaration stays unsatisfied.** No backoff, no
  persisted failure marker. Each attempt reports the failure row; the
  dependent's disable row is silent once it is already down. Same posture as
  upstream's `/reload-plugins`. The failure path is therefore a deliberate
  non-fixpoint of the planner (the bucket re-plans the retry), and the
  convergence test pins it by name rather than forcing it empty.
  -- **Reversibility:** reversible.

- **D-09-15: `marketplace add`, `bootstrap.ts` and `autoupdate.ts` are not
  wired to this step.** None of the three reaches `applyReconcile` today
  (verified); the next `/reload` completes the closure. Upstream's
  `marketplace add` and post-install activation DO resolve missing
  dependencies; recorded under Deferred Ideas with that fact, not as a
  requirement.
  -- **Reversibility:** reversible.

- **D-09-16: Convergence proof and network gate.**
  `tests/integration/reconcile-plan-convergence.test.ts` gains the success
  fixpoint: a recorded plugin declaring a missing key (verdict supplied)
  plans the bucket; the same state with the key recorded as
  `provenance: "dependency"` plans nothing. No new network path: the step
  reaches the network only through the cascade's own clone and tag probes for
  a member that is actually missing; an empty bucket drives nothing (NFR-5).
  The new entry point lives beside `install-flow.ts`, already a git consumer,
  so `tests/architecture/no-orchestrator-network.test.ts` keeps `plan.ts` /
  `pending.ts` / `notify.ts` armed and needs no new exemption; `apply.ts`
  calls the operation, never git.
  -- **Reversibility:** reversible.

### Claude's Discretion

- Bucket, type and option names (`pluginsToDependencyInstall`,
  `PlannedDependencyInstall`, the `applyReconcile` reason option, the cascade
  root-range option, the new entry point's name and home file).
- Whether the bucket entry carries the declarers' ranges pre-folded (one
  string) or as the list, as long as the fold is `intersectDependencyRanges`
  and a fold that fails is treated as an unsatisfiable root constraint (the
  cascade's existing `constraint-failed` arm), never as "no constraint"
  (T-06-10).
- The cascade's own constraint verdicts (RESV-03 / RESV-05) stay in force on
  this path: an already-installed member outside the root's closure ranges
  fails that cascade as `install` would, and the re-derived check then
  reports the dependent. No special-casing.
- How the D-09-07 re-plan is structured in `apply.ts` (a second
  `readPassForScope` call and a toggle-only continuation, or an extracted
  "toggle phase" applied to whichever plan is current) -- keep the
  documented fixed bucket order and the RECON-03 per-step try/catch
  discipline; `applyPlan` and `applyReconcileWithReader` sit under the two
  independent cognitive-complexity ceilings (ESLint `sonarjs` 15, fallow
  `health.maxCognitive` 15), so the established pattern is another extracted
  step function, not a bigger `if`.
- Whether D-09-08's record walk lives in `plan.ts` as a sibling of
  `buildUninstallBucket` or inside `diffPlugins`' accumulator -- `plan.ts`
  stays grep-gated pure either way.
- Docs: `docs/dependency-resolution.md` § "The load-time check" gains the
  reload paragraph (what a `/reload` installs, that startup does not, the
  retry posture); `docs/output-catalog.md` gains the states for D-09-09 and
  the two-row failure form; whether `docs/plugin-enablement.md` needs a
  sentence for the provenance-independent lift.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream parity contract
- `.planning/HANDOFF-upstream-dependency-parity.md` row 4 ("Reload installs
  missing declared deps") and § "Facts a planner needs" (closed-set
  amendment surface list, coverage and complexity gates).
- The installed Claude Code binary `~/.local/share/claude/versions/2.1.267`
  -- the `resolveMissingDependencies` chunk (grep
  `export{m2,Oan,ROe}`), the load check `uan` (grep
  `"dependency-unsatisfied",source:P.source`), and the `/reload-plugins`
  call site (grep `resolved\`,o=await mC(`). The facts extracted from them
  are pinned in `<specifics>`; re-derive from the binary, not from memory,
  if any of them is questioned.
- `https://code.claude.com/docs/en/plugin-dependencies` -- the documented
  contract the binary implements.

### This milestone's contracts
- `.planning/REQUIREMENTS.md` § "Reload installs missing dependencies (MISS)"
  (MISS-01, MISS-02) and the NFR-1 / NFR-3 / NFR-5 lines this phase cites.
- `.planning/ROADMAP.md` § "Phase 9" -- goal, success criteria 1-3, the
  Notes paragraph (bucket from the declaration index, not the config; the
  `bootstrap.ts` / `autoupdate.ts` planning question D-09-15 answers).
- `.planning/BACKLOG.md` § `PENDING-VERDICT-01` (left open, D-09-12) and
  § `ENBL-DEP-01` (the "asked for by declaration -> enabled" rule D-09-05's
  lands-enabled clause applies).

### Prior-phase decisions this phase builds on
- `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-CONTEXT.md`
  -- D-06-01..05 (the marker, the stamp-only-on-transition rule, the D-06-03
  enable gate this phase re-drives from a fresh plan, the purity boundary
  D-09-01 respects, the fixpoint walk the verdict runs).
- `.planning/phases/08-enablement-parity-for-dependencies/08-CONTEXT.md` --
  D-08-02 (the token register D-09-09 extends), the `liveInstalledKeys`
  read-through this phase deliberately does NOT use (D-09-04).
- `.planning/phases/07-marketplace-repo-tag-resolution/07-CONTEXT.md` -- the
  marketplace tag probe and TAGS-02's current-copy fallback the root-range
  input (D-09-05) reaches.
- `.planning/phases/04-install-provenance/04-CONTEXT.md` -- D-04-01
  (provenance is the mode only), D-04-02 (config names only explicit
  plugins), D-04-05 (the exemption that would keep a mis-fetched orphan
  forever -- why D-09-02 excludes uninstall-bound dependents), D-04-07 (the
  promotion arm the new entry point must not run).
- `.planning/phases/03-dependency-resolution/03-CONTEXT.md` -- D-03-05
  (same scope), D-03-07 (rollback scope), D-03-08 (a not-added marketplace
  fails the dependency; never auto-added), D-03-10 (range merge).

### Architecture constraints
- `tests/architecture/reconcile-planner-purity.test.ts` -- `plan.ts` may not
  read the filesystem; D-09-01 and D-09-08 are planner filters over inputs
  it already has.
- `tests/architecture/no-orchestrator-network.test.ts` -- the file-named
  `FORBIDDEN_TARGETS`; D-09-16.
- `orchestrators/reconcile/README.md` -- the 8-bucket model this phase makes
  9, the fixed apply order D-09-06 extends, the single-notify rule.
- `.planning/codebase/CONVENTIONS.md` -- the dual cognitive-complexity
  ceilings; `scripts/test-coverage-direct.pin.json` (every changed production
  module 100% covered by its paired test unless pinned).

### Output contract
- `docs/output-catalog.md` § `reconcile-applied-cascade` (the three LOAD-01
  states and "Load-time install failed by a dependency" -- the rows D-09-10
  reuses) and the closed-set `REASONS` paragraph (D-09-09's amendment).
- `docs/messaging-style-guide.md` -- token wording rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/reconcile/dependency-verdict.ts` -- `buildScopeSatisfactionVerdict`
  returns `UnsatisfiedDeclaration[]` with the `missing` kind; its private
  `constraintsByKey` already accumulates each declarer's ranges per key
  (export or return alongside the verdict for the root range).
- `orchestrators/plugin/install-cascade.ts::runInstallCascade` -- the
  cascade; `InstallCascadeOptions.installedKeys` is where D-09-04's wall is
  set; `resolveMemberConstraints` is where the root range enters;
  `InstallCascadeResult.members` / `alreadyInstalled` give D-09-09 / D-09-11
  their row lists.
- `orchestrators/plugin/install-flow.ts` lines 1320-1480 -- the locked
  transaction around the cascade, `lookupCascadeDependencies`,
  `resolveInstallMarketplaceSource`, the `ledgerOptionsFor` builder
  (provenance decided per member) and `hydrateInstalledHooks`; the new entry
  point is this arm minus promotion, config selection/write and the DFEN
  arms.
- `orchestrators/plugin/operations.ts` -- `createInstallOperation` /
  `createEnableOperation`: the composition seam the new operation joins.
- `orchestrators/reconcile/apply.ts::applyPluginInstalls` -- the loop shape
  and the `plugin-installed` / `plugin-install-failed` outcome pushes
  (including `redactedDependencyCascadeError`) D-09-09 / D-09-10 reuse;
  `readPassForScope` is the function D-09-07 calls a second time.
- `orchestrators/reconcile/plan.ts::buildDependencyDisableBucket` -- the
  template for the new bucket (verdict filter + `claimed` exclusion);
  `buildUninstallBucket` -- the record-walk template for D-09-08.
- `orchestrators/reconcile/notify.ts` lines 439-442 -- where
  `pluginsToDependencyDisable` folds into `will disable`; the new bucket
  folds into `will install` the same way (D-09-12).

### Established Patterns
- Planner buckets are small extracted functions over precomputed inputs;
  apply steps are one function per bucket in a fixed order, each with the
  RECON-03 try/catch discipline and `notifications: { mode: "orchestrated" }`.
- Closed-set token amendments follow D-04-07 / D-05-11 / D-08-02 exactly.
- `notify.ts` is a dumb renderer: the orchestrator stamps status, reasons and
  severity.
- The verdict is re-derived live every pass; the marker only says "currently
  held".

### Integration Points
- `index.ts` `resources_discover` handler -- `event.reason` becomes an
  `applyReconcile` option (D-09-13).
- `apply.ts::applyPlan` -- the new step slots between `applyPluginInstalls`
  and the toggle steps; the D-09-07 re-plan wraps the toggle steps.
- `types.ts` -- `ReconcilePlan` gains the bucket and `emptyReconcilePlan`
  its empty default; `ApplyReconcileOptions` gains the reason.
- `notify.ts::isPlanEmpty` (the WR-02 count at line ~499) must count the new
  bucket or a bucket-only plan renders as the empty steady state.

</code_context>

<specifics>
## Specific Ideas

Operator instruction, verbatim intent: "Q1-Q3: your recommendation, unless
upstream contradicts them. Q4: whatever upstream does" -- applied to every
area, so each decision above names its upstream check.

Upstream facts extracted from the 2.1.267 binary (2026-09-21):

- `resolveMissingDependencies(errors, storage)`: filters the load check's
  errors to `type === "dependency-unsatisfied" && reason === "not-found"`;
  groups by dependency (`Map<dep, Set<declaringSource>>`); skips a dependency
  whose marketplace is not known (`marketplaceMissing`, message `Is the "mp"
  marketplace added?`), one blocked by policy, and one outside every
  declarer's `allowCrossMarketplaceDependenciesOn` (Phase 11's rule); installs
  each remaining dependency once via `installResolvedPlugin({ pluginId: dep,
  explicit: false, auto: <declarer scope found>, requiredByEnabledDependent:
  true, trigger: "dependency-resolution" })` into the first scope
  (user/project/local order) where a declaring dependent is enabled, else
  `user`; collects every installed closure member; logs a warn per failure and
  returns `{ installed, stillUnresolved, marketplaceMissing }`.
- The load check (`uan`) iterates only plugins enabled in settings; a
  dependency that is installed but not enabled yields `reason: "not-enabled"`
  and is NOT installed or re-enabled by reload; it demotes to a fixpoint and
  persists nothing (demotion is per-load).
- Call sites: `/reload-plugins` (load -> resolve -> if `installed.length > 0`
  load again -> `(+ N dependencies: a, b, ...) resolved`), post-install
  activation, and `marketplace add`. Session-start plugin load does not call
  it.
- Report wording: ` (+ N dependencies: a, b, ...)` (names, first five) and
  ` -- N dependencies still unresolved: x, y.` with the marketplace hint.

</specifics>

<deferred>
## Deferred Ideas

- **`marketplace add` and post-install activation running the step**
  (upstream does both; D-09-15). Pi's `marketplace add` command and the
  install cascade's own post-commit path would each need to run the verdict
  and the step for one scope. A follow-up or a backlog entry; not a Phase 9
  requirement.
- **Always re-planning the toggles after any mutating bucket** -- would close
  the pre-existing one-reload lag when a config-driven uninstall removes a
  dependency in the same pass (the read-pass verdict cannot see it, so the
  dependent is held only at the next reload). Broader than this phase's
  D-09-07 trigger; note for BACKLOG.
- **`PENDING-VERDICT-01`** -- preview computing an offline verdict so
  `pending` shows `will disable` and `will install` truthfully. Left open
  (D-09-12).
- **A `list` / `info` marker for consequence-disabled or dependency-installed
  records** -- Phase 6's deferred idea, still deferred; `PRUNE-CMD-01`'s
  `{orphaned}` marker question is Phase 12's discuss.
- **Backoff for a repeatedly failing dependency install** -- rejected for
  this phase (D-09-14); revisit only with evidence of a real cost.

### Reviewed Todos (not folded)
None -- no pending todos matched this phase's scope.

</deferred>

---

*Phase: 09-Reload installs missing declared dependencies*
*Context gathered: 2026-09-21*

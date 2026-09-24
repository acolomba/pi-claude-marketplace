# Phase 9: Reload installs missing declared dependencies - Research

**Researched:** 2026-09-21
**Domain:** Internal extension architecture (TypeScript, no new external stack) -- reconcile planner/apply pipeline, install cascade, closed-set notification vocabulary
**Confidence:** HIGH (every claim below is either read from source this session, or explicitly marked `[ASSUMED]`/flagged as a contradiction for the planner to resolve)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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
  **[See Contradictions / risks -- R1: this claim does not hold as written
  for the reused mechanism; the row that would actually render for a
  constraint/closure failure is the generic `{dependency failed}` token, not
  the specific examples named here.]**

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

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MISS-01 | A reload installs every declared dependency of an installed plugin that is not yet installed, through the install cascade, with provenance `dependency`. | `Architecture Patterns` §§ 1-5 below give the exact bucket/type/apply-step shape; `runInstallCascade` (already RESV-01/RESV-06 complete) is reused unmodified except for the additive root-range input (§5). |
| MISS-02 | When such a dependency cannot be installed, the reload completes, the failure is reported on its own row, and the dependent is handled by LOAD-01. | `Architecture Patterns` § 6 traces the exact failure-classification path (`unwrapCascade` / `classifyOrchestratorThrow` / `redactedDependencyCascadeError`) and flags in **Contradictions / risks R1** that the specific reason tokens D-09-10 names do not actually surface through that reused path -- the planner must pick a resolution. |
</phase_requirements>

## Summary

Phase 9 has no new external stack: every collaborator it needs -- the
load-time satisfaction verdict (`dependency-verdict.ts`, Phase 6), the
install cascade (`install-cascade.ts`, Phases 3/7/8), the reconcile
planner/apply split (`plan.ts` / `apply.ts`), and the closed-set notification
vocabulary (`notification-types.ts` / `notify-reasons.ts`) -- already exists
and is already exercised by prior phases. The work is entirely internal
plumbing: (1) extend `UnsatisfiedDeclaration`'s `missing` arm to carry the
per-declarer raw ranges so the planner can fold them (today only the
`out-of-range` arm carries a `range`); (2) add a ninth reconcile bucket
(`pluginsToDependencyInstall`) built by a new `plan.ts` function on the
model of `buildDependencyDisableBucket`, plus a tenth conceptual "lift"
change to the existing enable-bucket construction (D-09-08); (3) add a new,
narrow install entry point beside `installPluginWithTransaction` in
`install-flow.ts` that runs the SAME locked transaction, `runInstallCascade`
call, and `ledgerOptionsFor` shape, but skips promotion, config
selection/write-back and the DFEN-04 disabled-landing arm entirely; (4) wire
a new apply step into `apply.ts::applyPlan` between `applyPluginInstalls`
and the toggle steps that pushes one `plugin-installed`-shaped outcome PER
CASCADE MEMBER on success (a deliberate divergence from today's
one-row-per-op fold) and one `plugin-install-failed` on failure, followed by
a conditional second `readPassForScope` call (D-09-07); (5) thread
`ResourcesDiscoverEvent.reason` from `index.ts` through `ApplyReconcileOptions`
to gate the new step and the re-plan to `"reload"` only; (6) run the full
closed-set-amendment checklist for one new `Reason` literal,
`"dependency installed"`, using Phase 8's `40717eed` commit as the literal
file-by-file template; (7) extend the convergence integration test with the
D-09-16 fixpoint case.

**Primary recommendation:** Build the new install entry point as a sibling
function inside `install-flow.ts` (not a new file) so it is automatically
covered by the existing `NETWORK_FREE_TARGETS` gate with no new
architecture-test entry, and reuse `unwrapCascade` /
`handleCascadeThrow` / `handleInstallThrow` from that same file verbatim --
they are pure functions of the cascade result and throw/return shape, not of
promotion or config state, so nothing about them needs to change for the new
caller. Resolve **Contradictions / risks R1** (the reused
`classifyOrchestratorThrow` path collapses every constraint/closure cascade
failure to the generic `dependency failed` token, not the specific examples
D-09-10 names) explicitly during planning rather than silently building new
classification code or silently accepting the discrepancy.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Missing-dependency detection | Reconcile planner (`plan.ts`, pure) | Load-time verdict walk (`dependency-verdict.ts`, fs-reading) | The verdict already computes `kind: "missing"` per declared key inside the locked read pass (D-06-04); the planner only filters/folds it -- no new I/O surface. |
| Dependency materialization | Plugin orchestrator (`install-cascade.ts` via a new `install-flow.ts` entry point) | Reconcile apply (`apply.ts`, drives the operation) | Materialization (clone, tag probe, ledger phases, rollback) is the install-cascade's existing job; apply.ts only sequences the call and folds outcomes, exactly as it does for `pluginsToInstall` today. |
| Failure/success reporting | Reconcile apply (`apply.ts` → `apply-outcomes.ts` → `notify.ts`) | Closed-set vocabulary (`notification-types.ts`, `notify-reasons.ts`) | Apply pushes typed outcomes; notify.ts is a "dumb renderer" (per-project convention) that maps outcome shape to row -- no new vocabulary lives in notify.ts, only in the two shared vocabulary files. |
| Consequence-disable lift after install | Reconcile planner (`plan.ts`, D-09-08) | Reconcile apply (re-plan, D-09-07) | Symmetric split: the planner decides WHAT changed given a fresh verdict; apply decides WHEN to ask for a fresh verdict (only after a successful install). |
| Reload-vs-startup gating | Reconcile apply (`apply.ts`/`index.ts`) | Pi runtime (`ResourcesDiscoverEvent.reason`) | The distinguishing fact (`"startup" | "reload"`) originates in the host runtime and is a pass-through option on `ApplyReconcileOptions`; no extension-owned state tracks it. |

## Standard Stack

Not applicable in the conventional sense -- this phase adds no new package,
framework, or external library. Every primitive it needs (`semver` for range
folding, `proper-lockfile` for the scope lock, the existing `git` clone
seams) is already a declared dependency, already used by Phases 3/6/7/8, and
is not touched by this phase's own code. No `npm install` is required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new `install-flow.ts` sibling function | A brand-new module (`install-dependency-flow.ts`) | CONTEXT.md leaves the home file to Claude's Discretion, but D-09-16 notes the sibling-function choice avoids adding a new target to `no-orchestrator-network.test.ts`'s `NETWORK_FREE_TARGETS` (verified: that list is a hand-maintained array in `tests/architecture/gate-targets.ts`, and `install-flow.ts` is already a member, `tests/architecture/gate-targets.ts:53`). A new file would need its own entry to keep the "no direct git surface" invariant checked, and there is no correctness reason to leave it unchecked. Recommend the sibling-function approach unless the function grows unmanageably large under the two cognitive-complexity ceilings, in which case extract to a same-directory helper module and add it to `NETWORK_FREE_TARGETS`. |

## Package Legitimacy Audit

Not applicable -- this phase installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
 Pi runtime
   │ ResourcesDiscoverEvent{ reason: "startup" | "reload" }
   ▼
 index.ts (resources_discover handler)
   │  applyReconcile({ ..., reason: event.reason })      <-- NEW: thread reason
   ▼
 apply.ts :: applyReconcileWithReader
   │
   ├─ per scope: readPassForScope (LOCKED)
   │     ├─ migrateFirstRunConfig
   │     ├─ loadMergedScopeConfig
   │     ├─ buildScopeSatisfactionVerdict  ─┐ (unchanged, Phase 6)
   │     └─ planReconcile(merged, state, scope, verdict)
   │           │
   │           ▼
   │        plan.ts :: planReconcile  (PURE, no I/O)
   │           ├─ diffMarketplaces / diffPlugins (existing 7 buckets)
   │           ├─ buildDependencyDisableBucket (existing, LOAD-01)
   │           ├─ NEW: buildDependencyInstallBucket (D-09-01/02/05)
   │           │     filters verdict.unsatisfied[kind=="missing"]
   │           │     + D-09-02 "will be enabled" predicate
   │           │     + dedup by dependency key, fold ranges
   │           └─ NEW (or folded into enable bucket): D-09-08 lift walk
   │                 over records carrying dependencyDisabled==true that
   │                 the live verdict no longer holds
   │
   ├─ per scope: applyPlan (NO outer lock; RECON-03 per-step try/catch)
   │     1. applyPluginUninstalls
   │     2. applyMarketplaceRemoves
   │     3. applyMarketplaceAdds
   │     4. applyPluginInstalls               (existing, pluginsToInstall)
   │     5. NEW: applyDependencyInstalls       (D-09-06 position)
   │           for each PlannedDependencyInstall:
   │             installMissingDependency({ ..., rootRange })  <-- NEW entry
   │                point in install-flow.ts, reuses runInstallCascade
   │             on success: push ONE plugin-installed outcome PER
   │                CascadeMemberOutcome (D-09-09, {dependency installed})
   │             on failure: push ONE plugin-install-failed outcome for
   │                the dependency's own key (D-09-10; see R1)
   │     ── IF any dependency installed (D-09-07) ──
   │           re-run readPassForScope for this scope
   │           take pluginsToEnable / pluginsToDisable /
   │             pluginsToDependencyDisable from the FRESH plan
   │     6. applyPluginToggles(enable)   <-- uses fresh-or-original bucket
   │     7. applyPluginToggles(disable)  <-- uses fresh-or-original bucket
   │     8. applyDependencyDisables (LOAD-01, fresh-or-original bucket)
   │     9. applySourceMismatches (report-only, ROUND-1 plan always)
   │
   └─ single notify() with the accumulated outcomes (unchanged RECON-04)
```

### Recommended Project Structure

No new files are structurally required. Changed files:

```
extensions/pi-claude-marketplace/
├── orchestrators/reconcile/
│   ├── dependency-verdict.ts   # extend UnsatisfiedDeclaration "missing" arm with ranges
│   ├── plan.ts                 # + buildDependencyInstallBucket, D-09-08 lift walk
│   ├── types.ts                # + PlannedDependencyInstall, pluginsToDependencyInstall,
│   │                            #   ApplyReconcileOptions.reason
│   ├── apply.ts                 # + applyDependencyInstalls, D-09-07 re-plan wrapper,
│   │                            #   thread `reason` gate
│   ├── apply-outcomes.ts        # possibly: dependencyInstalledOutcome() helper (D-09-09 signal)
│   └── notify.ts                # installedRowFromOutcome: derive {dependency installed} token;
│                                 #   isReconcilePlanListEmpty: count new bucket
├── orchestrators/plugin/
│   ├── install-cascade.ts       # + root-range input threaded into resolveMemberConstraints
│   └── install-flow.ts          # + new entry point (sibling fn), reusing unwrapCascade/
│                                 #   handleCascadeThrow/handleInstallThrow
├── shared/
│   ├── notification-types.ts    # + "dependency installed" literal (Reason tuple, 60->61)
│   └── notify-reasons.ts        # + header count paragraph, command-private group membership
└── index.ts                      # thread event.reason into applyReconcile call

tests/
├── architecture/notify-closed-set-locks.test.ts       # REASON_ENROLLMENT + length 60->61
├── architecture/catalog-uat/catalog-contract.test.ts  # EXPECTED_STATE_COUNT / EXPECTED_UTF8_BYTES
├── architecture/catalog-uat/fixtures/*.ts             # new fixture entry
├── architecture/compat-01-no-expansion.test.ts        # Reason enumeration
├── shared/notification-types.test.ts                  # Reason enumeration
├── orchestrators/reconcile/{plan,apply,dependency-verdict}.test.ts  # new cases
├── orchestrators/plugin/{install-cascade,install-flow}.test.ts      # new cases
└── integration/reconcile-plan-convergence.test.ts      # D-09-16 fixpoint case

docs/
├── dependency-resolution.md     # "The load-time check" reload paragraph
└── output-catalog.md            # new states for D-09-09 / D-09-10's two-row form
```

### Pattern 1: The verdict's `missing` arm does not carry ranges today -- extend it

**What:** `orchestrators/reconcile/dependency-verdict.ts::unsatisfiedEntries`
pushes a bare `{ dependent, dependency: key, kind: "missing" }` for a missing
declared key -- the `ranges` variable is already in scope in that loop
(`for (const [key, ranges] of constraintsByKey(declared))`) but is not
attached. Only the `out-of-range` arm carries a `range` field today.

**Where (verbatim, read this session):**

```
221	/**
222	 * The declarations of one record that the scope does not satisfy, in
...
227	function unsatisfiedEntries(
228	  dependent: string,
229	  declared: readonly AddressedDependency[],
230	  recorded: ReadonlyMap<string, RecordedPlugin>,
231	  held: ReadonlySet<string>,
232	): readonly UnsatisfiedDeclaration[] {
233	  const entries: UnsatisfiedDeclaration[] = [];
234	  for (const [key, ranges] of constraintsByKey(declared)) {
235	    const record = recorded.get(key);
236	    if (record === undefined) {
237	      entries.push({ dependent, dependency: key, kind: "missing" });
238	      continue;
239	    }
```
(`extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:222-238`)

And the type it pushes into (`extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:80-89`):
```
80	export interface UnsatisfiedDeclaration {
81	  /** `name@marketplace` of the record that declared it. */
82	  readonly dependent: string;
83	  /** `name@marketplace` of the declared dependency. */
84	  readonly dependency: string;
85	  readonly kind: UnsatisfiedKind;
86	  /** The declared range, present only on the out-of-range kind. */
87	  readonly range?: string;
88	}
```

**When to use:** D-09-05 needs "the intersection of every eligible declarer's
constraint for that key" to become the new cascade's root range. Several
DIFFERENT dependents can each declare the SAME missing dependency with
different constraints (e.g., `a` declares `c@^1.0.0`, `b` declares
`c@>=1.2.0`) -- `constraintsByKey` only folds ranges WITHIN one declarer's own
list of elements for the SAME key, so folding across declarers is a job the
new bucket-builder in `plan.ts` must do, and it needs each declarer's raw
range texts to do it.

**Recommended change (additive, non-breaking):**
```typescript
// dependency-verdict.ts -- add an optional `ranges` field, populated only
// for the "missing" kind (the only kind D-09-05 needs to fold across
// declarers; "out-of-range" already carries its own folded `range`).
export interface UnsatisfiedDeclaration {
  readonly dependent: string;
  readonly dependency: string;
  readonly kind: UnsatisfiedKind;
  readonly range?: string;
  /** Raw per-declarer range texts for the "missing" kind, so the reconcile
   *  planner can fold them across every declarer of the same dependency
   *  (D-09-05). Absent when the declaration carried no version constraint. */
  readonly ranges?: readonly string[];
}

// unsatisfiedEntries, "missing" arm:
if (record === undefined) {
  entries.push({
    dependent,
    dependency: key,
    kind: "missing",
    ...(ranges.length > 0 && { ranges }),
  });
  continue;
}
```
This is additive to a `readonly` interface and to one push-site inside a
module that carries its own architecture gate for network-freedom (not
purity -- `dependency-verdict.ts` is explicitly NOT one of the
`RECONCILE_PURITY_TARGETS`, only `plan.ts` is:
`tests/architecture/gate-targets.ts:492` names exactly one target for that
gate). The change touches no I/O and does not risk
`reconcile-planner-purity.test.ts`, which only greps `plan.ts`.

**Test file to extend:** `tests/orchestrators/reconcile/dependency-verdict.test.ts`
(paired 1:1 with the production file per the `test:corresponding` convention,
§ Validation Architecture below).

### Pattern 2: The new bucket -- `buildDependencyInstallBucket` in `plan.ts`

**What:** A new pure function in `plan.ts`, structurally parallel to
`buildDependencyDisableBucket` (`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:651-694`),
consuming the SAME precomputed `verdict` input `planReconcile` already
threads through `diffPlugins`.

**Verbatim precedent it should mirror (`plan.ts:651-694`):**
```
651	function buildDependencyDisableBucket(
652	  state: ExtensionState,
653	  scope: Scope,
654	  verdict: ScopeSatisfactionVerdict,
655	  claimed: ReadonlySet<string>,
656	): PlannedDependencyDisable[] {
657	  if (!verdict.ok) {
658	    return [];
659	  }
660
661	  const planned: PlannedDependencyDisable[] = [];
662	  const bucketed = new Set<string>();
663	  for (const entry of verdict.unsatisfied) {
664	    if (bucketed.has(entry.dependent) || claimed.has(entry.dependent)) {
665	      continue;
666	    }
667	    ...
```

**Concrete shape for the new function:**
1. Guard `!verdict.ok` -> `[]` (same fail-closed posture D-05-07 requires
   everywhere else in this module -- an incomplete verdict must never drive
   an action).
2. Filter `verdict.unsatisfied` to `entry.kind === "missing"`.
3. Apply D-09-02's "will be enabled once this pass applies" predicate to
   `entry.dependent`. This predicate needs, per dependent key: (a) whether
   the record is currently enabled (`!isRecordedButDisabled(record)`); OR
   (b) `record.dependencyDisabled === true` (the D-06-02 marker, held only by
   the check itself); OR (c) the dependent is IN `acc.enable` (this pass's
   own enable bucket, i.e. config declares it enabled and the record is
   currently disabled without the marker). All three checks read data
   `diffPlugins` already has in scope (`state`, `acc.enable`) -- no new state
   read. EXCLUDE a dependent that is in `uninstall`, `disable`, or under a
   removed marketplace -- i.e., subtract `claimed` (the same
   `claimedPluginKeys(...)` set `buildDependencyDisableBucket` already
   receives, `plan.ts:596-613`) from the candidate set.
4. Group survivors by `entry.dependency` (dedup across declarers -- D-09-05).
5. For each group, fold `entry.ranges ?? []` from every member of the group
   via `intersectDependencyRanges` (`domain/dependency-range.ts:203`, already
   imported by `dependency-verdict.ts` and safe to import into `plan.ts` too
   -- it is a pure domain function with no I/O, so it does not violate the
   `reconcile-planner-purity.test.ts` forbidden-pattern list at
   `tests/architecture/reconcile-planner-purity.test.ts:30-40`, which
   forbids only `node:fs`, `platform/git`, `gitOps`, `notify`, `saveState`,
   `saveConfig`, `atomicWriteJson`, `withStateGuard`,
   `withLockedStateTransaction`). A fold failure (`ok: false`) must NOT be
   silently dropped (T-06-10 forbids reading a fold failure as "no
   constraint") -- carry the raw range strings through unfolded instead and
   let the cascade's own `constraint-failed` arm (already handles
   `range-conflict` / `range-too-complex` / `range-invalid`) report it, per
   the Claude's Discretion note. This means the SIMPLEST correct choice is:
   the bucket entry carries the raw `ranges: readonly string[]` list
   (unfolded), and the new install-flow.ts entry point folds it at cascade
   build time using the SAME `intersectDependencyRanges` call the cascade
   itself already makes internally (`install-cascade.ts:692`,
   `install-cascade.ts:786`) -- one fold site, not two, which also avoids a
   plan.ts/install-cascade.ts fold-logic duplication risk.
6. Split the deduped key back into `plugin`/`marketplace` via the same
   `parsePluginKey` helper `buildDependencyDisableBucket` uses
   (`plan.ts:85-94`).

**Recommended `PlannedDependencyInstall` type** (add to `types.ts`, modeled
on `PlannedPluginInstall` at `types.ts:93-98` plus the range list):
```typescript
export interface PlannedDependencyInstall {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  /** Raw per-declarer range texts to fold at cascade build time (D-09-05). */
  readonly ranges: readonly string[];
}
```

Then `ReconcilePlan` gains `readonly pluginsToDependencyInstall: readonly PlannedDependencyInstall[];`
and `emptyReconcilePlan` gains the matching `[]` default
(`types.ts:252-280`).

### Pattern 3: The D-09-08 provenance-independent lift

**What:** A sibling of `buildUninstallBucket` (`plan.ts:543-586`) that walks
recorded plugins (not declared config entries) looking for a record where
`record.dependencyDisabled === true` (persistence/state-io.ts:128, quoted
verbatim: `dependencyDisabled: Type.Optional(Type.Boolean()),`) AND the live
verdict no longer holds it (i.e., `!isHeldByUnsatisfiedDependency(key, verdict)`,
reusing the existing helper at `plan.ts:423-425`) AND the merged config does
not declare it `enabled: false`. Such a record is pushed onto `pluginsToEnable`
-- Claude's Discretion leaves open whether this lives as its own function
merged into `acc.enable` inside `diffPlugins`, or as a separate post-pass
that concatenates onto the existing enable array before it is returned. The
apply side needs NO changes for this: `applyPluginToggles` already re-runs
the ledger's state phase for anything in `pluginsToEnable`
(`apply.ts:710-770`), which rebuilds the record without the marker.

**Important interaction:** this record-walk sibling and the D-09-01 bucket
both consult the SAME live verdict, but answer different questions ("is this
record still held down" vs. "is this dependency still missing"). They can be
computed from ONE pass over `state.marketplaces` if convenient, but
correctness only requires that both run AFTER the verdict is available (they
already do -- `verdict` is a `planReconcile` parameter).

### Pattern 4: `plan.ts` bucket order and the empty-plan fast path

`planReconcile` (`plan.ts:764-807`) has a fast-path check that returns
`emptyReconcilePlan(scope)` when every bucket is empty (`plan.ts:783-793`).
The new bucket count must be added to that check (`totalDependencyInstalls =
pluginDiff.dependencyInstall.length`, folded into the `if` at line 783) or a
plan with ONLY the new bucket populated would incorrectly render as the
canonical empty-plan shape via `deepEqual` mismatch against what
`ReconcilePlan` actually returns -- i.e., the object literal at
`plan.ts:796-806` and `emptyReconcilePlan` (`types.ts:268-280`) must both
gain the new field, and the fast-path `if` must test it, mirroring exactly
how `totalDependencyDisables` was added for LOAD-01 (visible at
`plan.ts:780,790`).

### Pattern 5: The new install-flow.ts entry point

**What:** `installPluginWithTransaction` (`install-flow.ts:1268-1949`) is the
existing single entry point; D-09-05 wants "this arm minus promotion, config
selection/write and the DFEN arms." Concretely, the new function should:

1. Take the SAME lock via `transaction.withLockedStateTransaction(locations, ...)`
   (`install-flow.ts:1340`).
2. SKIP `selectDeclaringConfigWriteTarget` (`install-flow.ts:1360-1364`) and
   the whole `promoteDependencyRecord` arm (`install-flow.ts:1391-1415`) --
   there is no config file to select or promote against; D-04-02 holds.
3. Call `runInstallCascade` with the SAME shape of options
   (`install-flow.ts:1427-1510`) EXCEPT:
   - `rootKey` is the MISSING DEPENDENCY's key, not a user-typed plugin.
   - `ledgerOptionsFor` sets `provenance: "dependency"` UNCONDITIONALLY for
     every member including the root (unlike the existing builder at
     `install-flow.ts:1464-1480`, which sets `provenance: isRoot ?
     "explicit" : "dependency"`).
   - `installedKeys: collectInstalledKeys(state)` is reused as-is
     (`install-flow.ts:460-469`) -- D-09-04 already gets what it needs from
     `runInstallCascade`'s own internal `liveInstalledKeys` wall logic
     (`install-cascade.ts:747-761`); no caller-side change needed there,
     since a disabled dependency record is ALREADY excluded from
     `liveInstalledKeys`'s live set only when the WALK treats it as
     re-enterable -- but D-09-04 wants the OPPOSITE (a disabled dependency is
     a wall on THIS path). **This is a real implementation fork**: see
     Contradictions / risks R2 below -- `liveInstalledKeys` is
     unconditionally called inside `runInstallCascade`
     (`install-cascade.ts:1123`), so D-09-04's "disabled record is a WALL on
     this path" cannot be achieved by a caller-side option alone; it needs
     either a new `InstallCascadeOptions` flag (e.g. `treatDisabledAsWall?:
     true`) that `runInstallCascade` uses to choose between
     `options.installedKeys` and `liveInstalledKeys(...)`, or the caller must
     pre-seed `installedKeys` with every disabled key itself (achievable
     without a cascade change: `collectInstalledKeys(state)` already returns
     EVERY recorded key including disabled ones, per
     `install-flow.ts:460-469` -- it does NOT distinguish disabled from
     enabled. The standard `installPlugin` caller passes this same
     `collectInstalledKeys(state)` result and relies on `runInstallCascade`
     calling `liveInstalledKeys` internally to STRIP the disabled ones back
     out for the read-through behavior EDEP-03 wants. So the new entry point
     cannot reuse `runInstallCascade` unmodified and get D-09-04's wall
     behavior "for free" -- it needs a cascade-level opt-out of the
     `liveInstalledKeys` call, OR it must NOT call `runInstallCascade`'s
     existing entry and instead pass a pre-computed set through a new
     option. Recommend: add `readonly treatDisabledAsWall?: true` to
     `InstallCascadeOptions` (`install-cascade.ts:414-451`), and gate the
     `liveInstalledKeys` call at `install-cascade.ts:1123`
     (`installedKeys: liveInstalledKeys(options.state, options.installedKeys)`)
     on `!options.treatDisabledAsWall`.
   - The root-range input (D-09-05) is threaded in as described in Pattern 6.
4. Skip the DFEN-04 disable-cascade arm (`install-flow.ts:1520-1573`)
   entirely and the `writeOrchestratedDeclarations` call
   (`install-flow.ts:1633-1641`, which itself only fires `if
   (args.landedDisabled)` -- `install-flow.ts:434-451` -- so for this new
   path where `landedDisabled` is always false, it is a correct no-op to
   call OR to omit; omitting it is cleaner and matches "no DFEN-04 arm" in
   D-09-05 literally).
5. `await tx.save()`.
6. Call `hydrateInstalledHooks` for every materialized member
   (`install-flow.ts:1698-1705`, minus the `landedDisabled` filter which
   never applies here).
7. On success, return a shape that names EVERY `CascadeMemberOutcome` (root
   + closure members) so the apply step can push one row per member
   (D-09-09) -- reuse `InstallCascadeResult`'s `"installed"` arm shape
   (`root`, `members`, `alreadyInstalled`) directly rather than re-deriving
   it, since `installed.members` from `unwrapCascade`'s output already has
   exactly this list (`install-cascade.ts:454-467`).
8. On failure, reuse `unwrapCascade` / `handleCascadeThrow` /
   `handleInstallThrow` from the SAME file verbatim (they take no
   promotion/config-write dependency -- confirmed by reading their bodies,
   `install-flow.ts:544-580`, `1095-1187`) to get the SAME
   `{status:"failed", error, cause}` shape `applyPluginInstalls` already
   knows how to fold (`apply.ts:636-655`).

**Where the root member's `ranges` field is populated (needs care):**
`ClosureMember.ranges` is seeded empty for the root and only ever appended
to by an EDGE from a DECLARER (`domain/dependency-closure.ts:248-266`,
`recordEdge`) -- the root has `requiredBy: undefined` and nothing points an
edge AT it within this walk, so `member.ranges` for the root is always `[]`
today (confirmed by reading `resolveDependencyClosure`,
`domain/dependency-closure.ts:451-477`, and the seed at
`domain/dependency-closure.ts:250-256`: `ranges: []`). The three sites that
read `member.ranges` directly are:
```
504	  const range = renderConstraintRange(member.ranges.join(" "));   // toIntersectionFailure
692	  const intersected = intersectDependencyRanges(member.ranges);   // resolveOneMember
786	  const intersected = intersectDependencyRanges(member.ranges);   // checkInstalledMember
```
(`extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:504,692,786`)

Recommended mechanism: add `readonly rootRange?: readonly string[];` (or a
single pre-folded string, per Claude's Discretion) to `InstallCascadeOptions`
and `MemberConstraintOptions`, and add ONE helper,
`effectiveRanges(options, member)`, used at all three read sites in place of
the bare `member.ranges`:
```typescript
function effectiveRanges(
  rootKey: string,
  rootRange: readonly string[] | undefined,
  member: ClosureMember,
): readonly string[] {
  return member.key === rootKey && rootRange !== undefined
    ? [...member.ranges, ...rootRange]
    : member.ranges;
}
```
This keeps the fold logic (`intersectDependencyRanges`) in exactly the ONE
place it already lives (`install-cascade.ts`), so the D-09-05 fold does not
need to be re-implemented in `plan.ts` (see Pattern 2, step 5).

### Pattern 6: The apply step -- `applyDependencyInstalls`

**What:** A new function in `apply.ts`, parallel in shape to
`applyPluginInstalls` (`apply.ts:535-657`) but iterating
`plan.pluginsToDependencyInstall` and calling the new install-flow entry
point instead of `createInstallOperation`. Composed through `operations.ts`
exactly as `createInstallOperation` is (`orchestrators/plugin/operations.ts:82-87`),
so a new `createDependencyInstallOperation` export belongs beside it.

**Divergence from `applyPluginInstalls` (load-bearing, per D-09-09/D-09-10):**
- **Success:** iterate `result.members` (every `CascadeMemberOutcome`, root
  included) and push ONE `plugin-installed`-shaped outcome per member,
  keyed by THAT member's own `name`/`marketplace`/`version`, not the
  op's `plugin`/`marketplace`. `applyPluginInstalls` today never looks at
  `result.members` for the `pluginsToInstall` case (it only reads
  `result.status`, `result.landedDisabled`, `result.version`,
  `result.postCommitWarnings`, `result.orphanRewake`, `result.degradedKinds`
  -- confirmed by reading `apply.ts:541-656` in full: `.members` is not
  referenced there at all), so this per-member loop is genuinely new
  plumbing, not a refactor of existing logic.
- **The `{dependency installed}` token:** `PluginInstalledOutcome`
  (`apply-outcomes.ts:110-126`) currently has no `reasons` field at all;
  `installedRowFromOutcome` (`notify.ts:549-560`) builds its `reasons` array
  LOCALLY from two boolean signal fields (`outcome.orphanRewake`,
  `outcome.degradedKinds`), not from a passed-in `reasons` list. The
  established pattern for adding a new signal to an "installed" row is
  therefore a new boolean-ish field on the outcome (mirroring
  `orphanRewake`), e.g. `dependencyInstalled?: true`, read by
  `installedRowFromOutcome` and pushed into its local `reasons` array ahead
  of/after the existing two. This keeps `notify.ts` a "dumb renderer" (repo
  convention, confirmed by the module's own header comment at
  `notify.ts:515-528`) and matches the precedent exactly.
- **Failure:** push ONE `plugin-install-failed` outcome keyed by the
  DEPENDENCY's own `plugin`/`marketplace` (not the dependent's), reusing
  `classifyOrchestratorThrow(result.error)` for `reason` and
  `redactedDependencyCascadeError(result.error)` for `cause` when
  `result.error instanceof DependencyCascadeError`
  -- this is the EXACT code shape `applyPluginInstalls`'s failure arm
  already uses (`apply.ts:636-655`), so this half of D-09-10 is a
  correct, verified reuse. **See Contradictions / risks R1** for the caveat
  on WHICH reason token actually renders.

### Pattern 7: D-09-07's conditional re-plan

**What:** After `applyDependencyInstalls` runs, if it materialized at least
one member, call `readPassForScope` a second time for the SAME scope and
substitute the fresh plan's `pluginsToEnable`, `pluginsToDisable`, and
`pluginsToDependencyDisable` for the round-1 plan's before running the
existing toggle/dependency-disable steps.

**Lock safety (verified):** `readPassForScope` acquires and releases its OWN
lock per call via `withLockedStateTransaction(loc, ...)` (`apply.ts:144-236`)
and is called ONCE PER SCOPE inside `applyReconcileWithReader`'s loop
(`apply.ts:1093`) with NO outer lock held across that call -- confirmed by
reading `applyReconcileWithReader` end to end (`apply.ts:1071-1180`): the
lock from the FIRST `readPassForScope` call is released before that
function returns (the `withLockedStateTransaction` closure has already
returned), and `applyPlan` (which runs the mutating steps) is called with NO
lock held around it -- the file's own header comment confirms this
("Per-scope APPLY PASS with NO outer lock ... CR-01 lesson preserved",
`apply.ts:18-22`). So calling `readPassForScope` a SECOND time for the same
scope, after `applyDependencyInstalls` has returned (which itself takes and
releases its own per-member lock through `runInstallLedger`'s lockless-body
/ `withLockedStateTransaction` wrapper inside the new install-flow.ts entry
point), is lock-safe: no lock is held across the boundary between the first
`readPassForScope`, `applyPlan`'s mutating steps, and a second
`readPassForScope` call. `proper-lockfile`'s `retries: 0` /
non-reentrant configuration (referenced throughout `apply.ts`'s header
comment and `install-cascade.ts`'s header comment) is therefore never
double-acquired.

**Recommended shape (Claude's Discretion per CONTEXT.md, but recommend this
concretely):** extract the toggle/dependency-disable steps
(`applyPluginToggles` x2 + `applyDependencyDisables`, currently inlined in
`applyPlan` at `apply.ts:977-1003`) into one helper, e.g.
`applyToggleSteps(opts, plan, outcomes)`, called once with the ROUND-1 plan
when nothing was installed, and once with the ROUND-2 plan's toggle buckets
spliced onto the round-1 plan's other fields when something was. This keeps
`applyPlan` and the new re-plan logic each under the 15-point cognitive
ceiling (`.fallowrc.json:10`, `eslint.config.js:88`) as an extracted-function
split, matching the CONTEXT.md discretion note's explicit guidance
("another extracted step function, not a bigger `if`").

### Pattern 8: Threading `reason` from `index.ts`

**Verified upstream type (read this session, not from training memory):**
```
404	export interface ResourcesDiscoverEvent {
405	    type: "resources_discover";
406	    cwd: string;
407	    reason: "startup" | "reload";
408	}
```
(`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:404-408`)

The project's own mirror agrees exactly:
```
export interface ResourcesDiscoverEvent {
  type: "resources_discover";
  cwd: string;
  reason: "startup" | "reload";
}
```
(`extensions/pi-claude-marketplace/platform/pi-api.ts`, the `ResourcesDiscoverEvent`
block immediately preceding the `ResourcesDiscoverResult` interface -- both
files declare the identical three-field shape verbatim.)

**Current call site (no `reason` threaded today):**
```
116	        await applyReconcile({ ctx, pi, cwd: event.cwd, hooksRouting, completionCache });
```
(`extensions/pi-claude-marketplace/index.ts:116`)

**Change:** add `reason: event.reason` to that call, add
`readonly reason?: "startup" | "reload";` (or reuse a project-local type
alias) to `ApplyReconcileOptions` (`types.ts:302-346`), and gate BOTH the new
`applyDependencyInstalls` step and the D-09-07 re-plan on
`opts.reason === "reload"`. Every other production caller of `applyReconcile`
omits the option (none exist outside `index.ts` per a repo-wide grep of
`applyReconcile(` -- only `index.ts` and test files call it), so making it
optional and defaulting the gate to "off" (`opts.reason !== "reload"` skips
the new step) preserves every existing test's behavior unless the planner
decides a test-visible default of `"reload"` is preferable for the
convergence test's convenience. Recommend keeping the option optional and
requiring tests that want the new behavior to pass it explicitly, since
D-09-13 says "the planner is reason-blind" -- meaning the GATE belongs at
the apply layer, not the plan layer, and an omitted option should default to
the SAFER (non-installing) behavior, matching startup's observed posture.

### Pattern 9: The closed-set amendment checklist (D-09-09's `{dependency installed}`)

Phase 8 shipped an EXACTLY analogous amendment (retiring `"dependency
disabled"` and adding a re-enable token) in one commit; the file list is the
concrete, no-guessing checklist for this phase's simpler ADD-ONLY case
(current set size 60 -> 61, confirmed verbatim below):

```
243:  assert.strictEqual(Object.keys(REASON_ENROLLMENT).length, 60);
```
(`tests/architecture/notify-closed-set-locks.test.ts:243`)

```
115:const EXPECTED_STATE_COUNT = 220;
116:const EXPECTED_UTF8_BYTES = 30_068;
```
(`tests/architecture/catalog-uat/catalog-contract.test.ts:115-116`)

```
146:  provenance: Type.Union([Type.Literal("explicit"), Type.Literal("dependency")]),
```
(`extensions/pi-claude-marketplace/persistence/state-io.ts:146` -- confirms
`provenance: "dependency"` is already a valid, schema-accepted literal; no
schema change needed for D-09-05's provenance requirement.)

**Files touched by the precedent commit (`40717eedc39503e2188a0b7e3963bcc568bb7076`,
"feat(08-03): the row says so, and dependency disabled leaves the closed
set"), read via `git show --stat` this session:**
```
 docs/output-catalog.md
 extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
 extensions/pi-claude-marketplace/shared/notification-types.ts
 extensions/pi-claude-marketplace/shared/notify-reasons.ts
 scripts/check-unused-type-members.contracts.json
 tests/architecture/catalog-uat/catalog-contract.test.ts
 tests/architecture/catalog-uat/fixtures/plugin-install.ts
 tests/architecture/compat-01-no-expansion.test.ts
 tests/architecture/dependency-doc-agreement.test.ts
 tests/architecture/notify-closed-set-locks.test.ts
 tests/orchestrators/plugin/install-cascade.messaging.test.ts
 tests/shared/notification-types.test.ts
```

For Phase 9's pure-ADD case, the exact checklist is:

1. `shared/notification-types.ts` -- append `| "dependency installed"` to the
   `Reason` union (append at the tail, per the module's own documented
   convention: "declaration order is the catalog's order -- a new token
   appends at the tail", `notification-types.ts:10-12`). This is 60 -> 61
   members.
2. `shared/notify-reasons.ts` -- add a numbered paragraph to the header
   docstring following the exact pattern of every prior addition (see the
   D-08-02 paragraph, `notify-reasons.ts:63-70`, for the template); add the
   literal to whichever topic-grouped union it belongs to (NOT idempotent,
   NOT a failure reason -- it is a state-change success marker, so it likely
   joins the "command-private reasons" group alongside `"dependency
   enabled"` / `"dependency promoted"`, per the grouping rationale at
   `notify-reasons.ts:158-164`).
3. `tests/architecture/notify-closed-set-locks.test.ts` -- add
   `"dependency installed": true,` to `REASON_ENROLLMENT`
   (`notify-closed-set-locks.test.ts:38` onward) and bump the length
   assertion `60 -> 61` (`:243`).
4. `tests/architecture/compat-01-no-expansion.test.ts` and
   `tests/shared/notification-types.test.ts` -- both enumerate `Reason`
   membership; both need the new literal added (exact mechanism: read these
   two files during planning, since their exact assertion shape was not
   captured this session -- flagged in Assumptions Log).
5. `docs/output-catalog.md` -- add the new catalog state(s) for D-09-09 (one
   `(installed)` row per materialized member) and D-09-10 (the two-row
   failure form, reusing the EXISTING `reconcile-install-dependency-failed`
   state's shape at `docs/output-catalog.md:2783-2797` as the template,
   since D-09-10 explicitly reuses that mechanism). Recompute
   `EXPECTED_STATE_COUNT` (220 -> 221 at minimum, possibly +2 if D-09-10's
   two-row form needs its own distinct catalog example beyond the existing
   `reconcile-dependency-unsatisfied` state at `docs/output-catalog.md:2735-2749`,
   which already documents the dependent's `(disabled) {dependency
   unsatisfied}` half) and `EXPECTED_UTF8_BYTES` -- these are two literal
   integer pins that MUST be recomputed from the actual file bytes after the
   edit, never hand-guessed (`catalog-contract.test.ts:115-116`).
6. `scripts/check-unused-type-members.contracts.json` -- per the project's
   own memory note ("contracts.json pins are line:col") this file pins
   SPECIFIC line:col locations of type-member usages; any edit that shifts
   line numbers in a file this contracts file tracks (very likely
   `notification-types.ts` and/or `install-cascade.messaging.ts`-adjacent
   files) needs remapping. Verify which lines are pinned there BEFORE
   editing `notification-types.ts`, and remap after.
7. `tests/architecture/catalog-uat/fixtures/*.ts` -- add or extend a fixture
   exercising the new state (the Phase 8 precedent touched
   `fixtures/plugin-install.ts`; the closest analog for this phase is
   whichever fixture module exercises reconcile-driven install rows --
   verify the exact file during planning).
8. `tests/architecture/dependency-doc-agreement.test.ts` -- this gate drives
   the STANDALONE cascade's failure-message composers
   (`composeCascadeFailureMessage`, `composeCascadeMemberRows`) against
   `docs/dependency-resolution.md`'s failure table and is scoped to FAILURE
   arms (confirmed by reading its header comment,
   `tests/architecture/dependency-doc-agreement.test.ts:1-30`) -- D-09-09 is
   a SUCCESS token and D-09-10 introduces no new failure token, so this gate
   is likely UNAFFECTED by this phase; verify during planning rather than
   assuming.
9. `tests/orchestrators/reconcile/notify.test.ts` (or wherever
   `installedRowFromOutcome` / `isReconcilePlanListEmpty` are unit-tested) --
   new cases for the `{dependency installed}` reasons derivation and for the
   new bucket's inclusion in the pending-emptiness count.

### Anti-Patterns to Avoid

- **Re-implementing range folding in `plan.ts`:** `intersectDependencyRanges`
  already lives in `domain/dependency-range.ts` and is already the fold the
  cascade itself uses. Carry raw ranges through the bucket and let the ONE
  existing fold site (inside `install-cascade.ts`'s constraint resolution)
  do the work, rather than duplicating the fold-and-fail-closed logic in two
  places that could drift.
- **New classification logic for D-09-10's failure reasons** without first
  resolving **Contradictions / risks R1** below -- building a parallel
  reason-classifier that reads `CascadeConstraintFailure.kind` /
  `DependencyClosureResult.reason` directly (bypassing
  `classifyOrchestratorThrow`) is a bigger, more novel change than D-09-10's
  "reuses existing rows" framing implies, and should be a deliberate,
  named decision, not an accidental scope-creep during implementation.
- **Treating the new bucket's provenance as caller-decided per-member:**
  D-04-01 already establishes that provenance is decided by the CALLER's
  `ledgerOptionsFor` builder, not by the cascade. The new entry point's
  builder must set `provenance: "dependency"` unconditionally (including for
  the root), diverging from `installPluginWithTransaction`'s
  `isRoot ? "explicit" : "dependency"` ternary (`install-flow.ts:1478`) --
  do not copy that ternary verbatim into the new function.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency closure walk, cycle detection, post-order materialization | A second closure/cascade implementation | `runInstallCascade` (`install-cascade.ts`), unmodified except the additive root-range/wall inputs | Already implements RESV-01..06, D-03-07/08/10, TAGS-01/02/03, EDEP-03; a parallel implementation would duplicate ~1180 lines of carefully specified, tested logic and risk drifting from the standalone command's behavior. |
| Version-range intersection / satisfaction | A hand-rolled semver comparator | `intersectDependencyRanges` / `recordedVersionSatisfies` (`domain/dependency-range.ts`), already used by both the verdict walk and the cascade | The module is explicitly documented as "the single evaluator in this tree" (`dependency-verdict.ts:31`); a second evaluator is a stated anti-goal repeated across multiple modules' header comments. |
| Failure classification for a cascade throw | A new reason-mapping function | `classifyOrchestratorThrow` (`apply-outcomes.ts:568-590`) + `redactedDependencyCascadeError` (`apply.ts:518-524`) | Same mechanism `applyPluginInstalls` already uses for the existing `pluginsToInstall` bucket's dependency-cascade failures; reuse is D-09-10's own stated intent (subject to R1's caveat on token accuracy). |
| Closed-set vocabulary amendment mechanics | Ad-hoc edits to `notification-types.ts` alone | The full checklist in Pattern 9, traced from the Phase 8 precedent commit | The repo enforces this with FIVE+ separate architecture/unit tests (`notify-closed-set-locks`, `compat-01-no-expansion`, `notification-types.test.ts`, `catalog-contract.test.ts`, `check-unused-type-members.contracts.json`); a partial edit fails CI, not silently. |

**Key insight:** every piece of machinery this phase needs to MATERIALIZE a
dependency, CLASSIFY a failure, or REPORT a transition already exists and is
already used by the standalone `install <plugin>` command and by Phases
6-8's reconcile work. The phase-specific work is entirely about WIRING --
new bucket, new entry point, new apply step, new gate -- not about new
domain logic.

## Common Pitfalls

### Pitfall 1: Assuming `liveInstalledKeys` respects a caller-side "treat disabled as wall" intent

**What goes wrong:** `runInstallCascade` unconditionally calls
`liveInstalledKeys(options.state, options.installedKeys)` at
`install-cascade.ts:1123`, which STRIPS every disabled record's key out of
`installedKeys` so the walk reads through it (EDEP-03's intended behavior
for the STANDARD install/enable cascades). D-09-04 wants the OPPOSITE for
this new path: a disabled dependency must remain a wall.

**Why it happens:** `InstallCascadeOptions.installedKeys` looks like the
natural place to "just pass a set that already excludes disabled keys as
live" -- but the cascade recomputes liveness itself downstream of that
input, silently overriding a caller's attempt to make a disabled key act as
a wall.

**How to avoid:** add an explicit `InstallCascadeOptions` flag (e.g.
`treatDisabledAsWall?: true`) that gates the `liveInstalledKeys` call at
`install-cascade.ts:1123`, as detailed in Pattern 5.

**Warning signs:** a test where a dependency's OWN dependency is disabled
and the new bucket install unexpectedly re-enables it (violating D-09-04
literally).

### Pitfall 2: Believing D-09-10's parenthetical reason list without checking `cascadeFailureCause`'s wrapping

**What goes wrong:** Assuming the reused `classifyOrchestratorThrow` /
`redactedDependencyCascadeError` path will surface `{no matching version}`
or `{dependency marketplace not added}` as the row's `Reason`, when in fact
EVERY closure/constraint cascade failure is wrapped as a `DependencyCascadeError`
before it reaches that classifier (see Contradictions / risks R1), so the
classifier ALWAYS returns the generic `"dependency failed"` for those arms.

**Why it happens:** the specific reason token names (`"no matching
version"`, `"dependency marketplace not added"`, etc.) DO exist in the
codebase's `Reason` union and ARE used -- but only by the STANDALONE
command's `composeCascadeFailureMessage` path (`install-cascade.messaging.ts`),
which reads `facts.reasons` directly rather than going through
`classifyOrchestratorThrow`. It is easy to conflate "this token exists in
the codebase" with "this token will render for the reused reconcile path."

**How to avoid:** write the new apply step's failure-case unit test FIRST
against a synthetic `constraint-failed` cascade result and assert on the
ACTUAL reason the row carries, before writing the bullet in the phase's
PLAN.md describing what the row says.

**Warning signs:** a UAT/manual check where the row says `{dependency
failed}` when the plan or docs claimed a more specific token.

### Pitfall 3: Forgetting the fast-path emptiness checks (three separate places)

**What goes wrong:** the new bucket must be counted in THREE independent
emptiness checks or a plan/pending render that should show something renders
as empty: (1) `planReconcile`'s own fast-path `if` at `plan.ts:783-793`; (2)
`isReconcilePlanListEmpty` in `notify.ts:491-502` (consumed by
`pending.ts` for the "0 actions" advisory); (3) the `outcomes.length === 0`
check in `apply.ts:1150` is UNAFFECTED (it counts pushed outcomes, not plan
buckets, so it is automatically correct once the apply step pushes outcomes)
-- but a preview-only consumer (`pending.ts`) walks plan buckets directly
and must be checked.

**How to avoid:** grep for every existing reference to
`pluginsToDependencyDisable` (the most recently added bucket, LOAD-01) and
add the new bucket to the SAME set of call sites -- it is the closest
precedent and touches exactly these files.

### Pitfall 4: The D-09-07 re-plan silently changing round-1 failure attribution

**What goes wrong:** if the re-plan swaps in the ENTIRE fresh
`ReconcilePlan` rather than splicing only `pluginsToEnable` /
`pluginsToDisable` / `pluginsToDependencyDisable`, round-1's
`pluginsToInstall` / `pluginsToUninstall` / marketplace buckets would be
driven a SECOND time, double-reporting or silently retrying a round-1
failure -- explicitly forbidden by D-09-07 ("The uninstall / remove / add /
install buckets of the fresh plan are NOT re-driven").

**How to avoid:** structure the re-plan as described in Pattern 7 -- extract
ONLY the three toggle-adjacent buckets from the fresh plan; never pass the
whole fresh `ReconcilePlan` to `applyPlan`.

## Code Examples

### The existing "reuse" precedent for a member-list result (RESV-06 / EDEP-03)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:454-467
export type InstallCascadeResult =
  | {
      readonly kind: "installed";
      readonly root: InstallLedgerSummary;
      readonly members: readonly CascadeMemberOutcome[];
      readonly alreadyInstalled: readonly CascadeSkippedMember[];
    }
  | { readonly kind: "marketplace-absent" }
  | { readonly kind: "closure-failed"; readonly failure: Extract<DependencyClosureResult, { readonly ok: false }> }
  | { readonly kind: "constraint-failed"; readonly failure: CascadeConstraintFailure }
  | { /* member-failed */ };
```
This is exactly the shape the new install-flow.ts entry point should surface
to its own caller (`apply.ts`'s new step): the "installed" arm's `members`
array is what D-09-09's per-member row loop iterates.

### The existing bucket-with-verdict-filter precedent (LOAD-01)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:651-694
function buildDependencyDisableBucket(
  state: ExtensionState,
  scope: Scope,
  verdict: ScopeSatisfactionVerdict,
  claimed: ReadonlySet<string>,
): PlannedDependencyDisable[] {
  if (!verdict.ok) {
    return [];
  }
  const planned: PlannedDependencyDisable[] = [];
  const bucketed = new Set<string>();
  for (const entry of verdict.unsatisfied) {
    if (bucketed.has(entry.dependent) || claimed.has(entry.dependent)) {
      continue;
    }
    bucketed.add(entry.dependent);
    const parsed = parsePluginKey(entry.dependent);
    const record =
      parsed === undefined ? undefined : state.marketplaces[parsed.marketplace]?.plugins[parsed.plugin];
    if (parsed === undefined || record === undefined || isAlreadyDependencyDisabled(record)) {
      continue;
    }
    planned.push({ scope, plugin: parsed.plugin, marketplace: parsed.marketplace, dependency: entry.dependency, kind: entry.kind, ...(entry.range !== undefined && { range: entry.range }) });
  }
  return planned;
}
```
The new `buildDependencyInstallBucket` should follow this SAME shape, but
group/dedup by `entry.dependency` instead of `entry.dependent` (D-09-05:
"Deduplicated across declarers").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A -- this is a new feature within an actively-developed extension, not a migration off a deprecated pattern. | N/A | N/A | N/A |

**Deprecated/outdated:** None applicable to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact grouping (idempotent / command-private / failure) `"dependency installed"` belongs to in `notify-reasons.ts`'s topic unions was not read verbatim for a suitable insertion point this session (only the surrounding precedent paragraphs were read). | Pattern 9, checklist item 2 | A wrong group assignment fails the module's own compile-time coverage proof (mentioned at `notify-reasons.ts:82-84` but not read in full this session) -- caught by `npm run typecheck`, low actual risk, but the planner should verify the exact union membership syntax before writing the task. |
| A2 | `tests/architecture/compat-01-no-expansion.test.ts` and `tests/shared/notification-types.test.ts`'s exact assertion mechanics (line numbers, whether they enumerate literal-by-literal or just check `.length`) were not read this session -- only that both were touched by the Phase 8 precedent commit (`git show --stat`). | Pattern 9, checklist item 4 | Low risk -- these are compile-time/type-level or length-based checks per the precedent commit's small diff sizes (4 and 1 lines respectively); the planner should open both files before writing the corresponding task, but no architectural surprise is expected. |
| A3 | The exact fixture file(s) under `tests/architecture/catalog-uat/fixtures/` that need a new entry for D-09-09/D-09-10's states were not identified this session beyond the Phase 8 precedent naming `fixtures/plugin-install.ts` for an install-cascade-adjacent token; the reconcile-applied-cascade states (this phase's actual surface) may live in a DIFFERENT fixture file. | Pattern 9, checklist item 7 | Medium -- picking the wrong fixture file wastes a task cycle but is caught immediately by `catalog-contract.test.ts`'s own count/byte assertions failing; not a correctness risk, only a planning-efficiency one. |
| A4 | Whether `docs/output-catalog.md` needs ONE new state (a per-member `(installed) {dependency installed}` example) or TWO (also a dedicated example for D-09-10's two-row failure form, distinct from the existing `reconcile-install-dependency-failed` state which documents a DIFFERENT scenario -- a user-declared plugin's own dependency failing, not a reload-driven missing-dependency install failing) was not settled this session. | Pattern 9, checklist item 5 | Low-medium -- affects the exact `EXPECTED_STATE_COUNT` delta (+1 vs +2); recompute the byte/state pins from the actual edited file regardless, so this cannot silently diverge -- the test enforces it. |
| A5 | The precise line:col entries `scripts/check-unused-type-members.contracts.json` pins for `notification-types.ts` / `install-cascade.messaging.ts`-adjacent files were not read this session. | Pattern 9, checklist item 6 | Medium -- per the project's own memory note, this file's pins are line:col and merge/edit-fragile; a missed remap fails `npm run check` with a specific, catchable error (not a silent miss), but costs a debugging cycle if not anticipated. |

**If this table is empty:** N/A -- see rows above. Every other claim in this
research is `[VERIFIED: file:line]` against source read this session, or is
copied verbatim from CONTEXT.md (already checked against the upstream
binary per that document's own provenance statement).

## Open Questions

1. **Does the new apply step need its own outcome-fold helper file, or does
   it belong inline in `apply.ts`?**
   - What we know: `applyPluginInstalls`, `applyPluginUninstalls`,
     `applyMarketplaceAdds`, `applyMarketplaceRemoves`,
     `applyDependencyDisables` are all inline functions in `apply.ts`
     (1284 lines total) already.
   - What's unclear: whether adding a per-member success-row loop (a new
     kind of iteration not present in any existing apply step) pushes
     `apply.ts` over a size/complexity threshold that would argue for
     extraction to a sibling file.
   - Recommendation: start inline, matching every existing precedent; only
     extract if the cognitive-complexity linter (`sonarjs/cognitive-complexity`,
     ceiling 15) actually flags it.

2. **Should `PlannedDependencyInstall.ranges` carry the raw per-declarer
   texts, or should `plan.ts` pre-fold via `intersectDependencyRanges` and
   carry one string?**
   - What we know: CONTEXT.md leaves this to Claude's Discretion, with the
     constraint that a fold failure must be treated as unsatisfiable, never
     as "no constraint" (T-06-10).
   - What's unclear: which choice produces a cleaner diff and avoids
     duplicating the fold call.
   - Recommendation (stated in Pattern 2/5 above): carry raw texts through
     the bucket; fold ONCE at the cascade's existing fold site inside
     `install-cascade.ts`, via the new `effectiveRanges` helper. This keeps
     `plan.ts` simpler (a pure filter/group/dedup, no `intersectDependencyRanges`
     import needed) and avoids a second fold-and-fail-closed implementation.

3. **R1's resolution: accept the generic `{dependency failed}` token for
   constraint/closure cascade failures, or build new classification?**
   - See Contradictions / risks R1 below -- this is the single biggest open
     design question this research surfaced. It should be resolved
     explicitly during planning/discuss, not decided silently by whichever
     approach is easiest to implement.

## Contradictions / risks

### R1 (significant): D-09-10's specific-reason examples do not survive the reused classification path

**Claim in CONTEXT.md (D-09-10):** "The failing dependency's own `(failed)`
row carries the cascade's existing closed-set reason (`{dependency
marketplace not added}`, `{no matching version}`, `{network unreachable}`,
...) and the redacted cause chain, through the existing
`plugin-install-failed` outcome and `redactedDependencyCascadeError` path."

**What the source actually does (all read this session):**

1. `applyPluginInstalls`'s EXISTING failure arm -- the mechanism D-09-10
   says to reuse -- classifies the reason via
   `classifyOrchestratorThrow(result.error)`:
   ```
   568	export function classifyOrchestratorThrow(err: unknown): ContentReason {
   569	  if (err instanceof DependencyCascadeError) {
   570	    return "dependency failed";
   571	  }
   572	  if (err instanceof StateLockHeldError) {
   573	    return "lock held";
   574	  }
   575	  if (err instanceof PluginShapeError) { ... }
   576	  return narrowProbeError(err);
   577	}
   ```
   (`extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:568-590`)
   -- the FIRST check, before anything more specific, is `instanceof
   DependencyCascadeError` -> unconditionally `"dependency failed"`.

2. EVERY closure-failure arm (`cycle`, `marketplace-not-added`, `not-found`,
   `unusable-declaration`) and EVERY constraint-failure arm (`no-matching-tag`,
   `tag-listing-failed`, `range-invalid`, `range-too-complex`, and by pattern
   `range-conflict`) builds its `.cause` as `new DependencyCascadeError(...)`,
   confirmed verbatim for two representative arms:
   ```
   291	    case "marketplace-not-added":
   292	      return {
   293	        key: failure.key,
   294	        reasons: ["dependency marketplace not added"],
   295	        cause: new DependencyCascadeError(
   296	          `Dependency "${failure.key}" requires marketplace "${failure.marketplace}", which is not added. Run marketplace add <source> to add it.`,
   297	          failure.key,
   298	        ),
   299	      };
   ```
   and
   ```
   361	    case "no-matching-tag":
   362	      return {
   363	        key: failure.key,
   364	        reasons: ["no matching version"],
   365	        cause: new DependencyCascadeError(
   366	          `Dependency "${failure.key}" has no release tag satisfying "${failure.range}".`,
   367	          failure.key,
   368	        ),
   369	      };
   ```
   (`extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:291-299,361-369`)

   Note that `reasons: ["dependency marketplace not added"]` /
   `reasons: ["no matching version"]` DO exist on the returned
   `CascadeFailureFacts` object -- but that field is consumed ONLY by
   `composeCascadeFailureMessage` (the STANDALONE command's own
   `PluginFailedMessage` builder, `install-cascade.messaging.ts:479-520`),
   which is a COMPLETELY SEPARATE rendering path from the orchestrated
   `classifyOrchestratorThrow(result.error)` path `apply.ts` uses. The `.cause`
   `Error` object -- the ONLY thing that crosses into the orchestrated
   `InstallPluginOutcome`'s `{status:"failed", error, cause}` shape -- carries
   just a message string and a `key`, and is ALWAYS a `DependencyCascadeError`
   instance for these arms.

3. The ONE arm where the underlying error is NOT forcibly wrapped is a
   member's own ledger throw where `subject.key === rootKey`:
   ```
   420	function memberCause(
   421	  subject: Extract<CascadeFailureSubject, { readonly kind: "member" }>,
   422	  rootKey: string,
   423	): Error {
   424	  if (subject.key === rootKey) {
   425	    return subject.error;
   426	  }
   427	  return new DependencyCascadeError(
   428	    subject.error.message,
   429	    subject.key,
   430	    subject.error.cause === undefined ? undefined : { cause: subject.error.cause },
   431	  );
   432	}
   ```
   (`extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:420-432`)
   -- this is the case where the CASCADE'S ROOT is the plugin whose OWN
   six-phase install ledger threw (e.g. a clone failed with a network error,
   or a permission error writing files), which for the NEW bucket IS the
   common case (the missing dependency itself is this new cascade's root).
   In THIS one arm, `subject.error` passes through unwrapped, and
   `classifyOrchestratorThrow`'s fallthrough (`narrowProbeError`, or the
   `PluginShapeError` branch) CAN correctly classify it to a specific
   token like `"network unreachable"` or `"permission denied"`.

4. The EXISTING catalog example for this exact reused mechanism confirms the
   generic-token behavior is not hypothetical -- it is what ships today for
   the analogous "member failed one level down" case:
   ```
   2793	  ⊘ hello (failed) {dependency failed}
   2794	    cause: Dependency "missing@mp" is not declared by its marketplace.
   ```
   (`docs/output-catalog.md:2793-2794`) -- the SPECIFIC fact ("is not
   declared by its marketplace", which corresponds to the closure `not-found`
   arm) appears ONLY as free text inside the `cause:` line, never as its own
   `{...}` token, on the reused orchestrated path.

**Consequence for D-09-10 and MISS-02:** MISS-02 itself ("the failure is
reported on its own row with its cause") is still satisfiable exactly as
worded -- a row DOES render, with a cause line naming the specific fact.
What is NOT accurate is D-09-10's PARENTHETICAL claim that the row's
CLOSED-SET TOKEN will be one of `{dependency marketplace not added}` /
`{no matching version}` -- for a closure or constraint failure (the majority
of realistic failure modes for a NEWLY-being-installed dependency: wrong
marketplace, no satisfying tag, a cycle), the token that actually renders
through the reused mechanism is the GENERIC `{dependency failed}`, with the
specific fact only in the cause-line text. Only a TRANSPORT-level failure of
the dependency's OWN ledger (network unreachable mid-clone, permission
denied) would surface a more specific token, because that ONE arm
(`memberCause` when `subject.key === rootKey`) does not wrap the error.

**Recommendation for the planner:** either (a) correct the phase's
documented expectation to match the existing, proven mechanism -- the row
renders `{dependency failed}` for closure/constraint failures and a more
specific transport token for ledger failures, exactly mirroring the existing
`reconcile-install-dependency-failed` catalog state -- which requires ZERO
new classification code and is the option consistent with "reuses existing
rows, no new token" (D-09-10's own stated intent), or (b) deliberately scope
NEW classification logic that reads `CascadeConstraintFailure.kind` /
`DependencyClosureResult.reason` directly (bypassing
`classifyOrchestratorThrow`) to surface the specific tokens, which is
materially more work than "reuse" and should be named as its own task if
chosen. This research recommends (a) as the lower-risk, precedent-consistent
choice, but surfaces it here rather than deciding it unilaterally, per this
agent's provenance rules.

### R2 (moderate, resolved above in Pattern 5/Pitfall 1): `liveInstalledKeys` needs a cascade-level opt-out for D-09-04

Already detailed in full under Pattern 5 and Pitfall 1 above -- restated
briefly here because it is a genuine gap between what D-09-05's prose
implies ("threaded into `resolveMemberConstraints` as a new root-range
input") and what D-09-04 separately requires (a disabled dependency is a
wall). The root-range input alone does not achieve D-09-04's wall behavior;
a SEPARATE `InstallCascadeOptions` addition (`treatDisabledAsWall`) is also
needed. Not a contradiction in CONTEXT.md's DECISIONS (D-09-04 and D-09-05
are both individually correct statements of INTENT), but the two decisions'
mechanisms interact in a way that is not obvious from either decision read
in isolation, and the planner should treat "gate `liveInstalledKeys`" as its
own explicit task line rather than assuming it falls out of the root-range
change.

## Environment Availability

No new external dependency, tool, runtime, or service is introduced by this
phase. `git` (for the cascade's clone/tag-probe seams) and `semver` (for
range folding) are pre-existing, already-verified dependencies exercised by
Phases 3/6/7/8; this phase adds no new caller of either that was not already
reachable through the existing `installPluginWithTransaction` path. Skipped
per the template's own skip condition.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` + `node:assert/strict`, with `--experimental-test-coverage` for the coverage gates |
| Config file | None dedicated -- test discovery and coverage thresholds are inline flags on the `npm run test:*` scripts in `package.json` |
| Quick run command | `npm run test:corresponding` (pairing gate) then a targeted `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/dependency-verdict.test.ts tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-flow.test.ts` |
| Full suite command | `npm run check` (verified: `package.json:78`, quoted verbatim below) |

Verbatim `check` script (`package.json:78`):
```
"check": "npm run typecheck && npm run lint && npm run lint:workflows && npm run lint:workflows:negative && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm run test:coverage:unit && npm run test:integration && npm run lint:type-members && npm run lint:type-members:negative"
```

Relevant sub-scripts (verified, `package.json:90-100`):
```
"test:corresponding": "node scripts/check-corresponding-tests.mjs",
"test:coverage:direct": "node scripts/test-coverage-direct.mjs",
"test:coverage:direct:commit": "node scripts/test-coverage-direct.mjs --base HEAD",
"test:coverage:direct:negative": "node scripts/test-coverage-direct.negative.mjs",
"test:coverage:unit": "mkdir -p coverage && node --test ... --experimental-test-coverage --test-coverage-include='extensions/**' --test-coverage-lines=100 --test-coverage-functions=100 --test-coverage-branches=100 ..."
```

**Test-pairing convention (verified,
`scripts/check-corresponding-tests.mjs:8-35`):** every file under
`extensions/pi-claude-marketplace/X.ts` must have a paired
`tests/X.test.ts`, EXCEPT files under the `architecture`, `e2e`,
`integration`, and `scripts` test roots, which are exempt from the 1:1
pairing requirement (`nonCorrespondingRoots`, `check-corresponding-tests.mjs:10`).
This means every changed production file in this phase (`plan.ts`,
`types.ts`, `apply.ts`, `apply-outcomes.ts`, `notify.ts`,
`dependency-verdict.ts`, `install-cascade.ts`, `install-flow.ts`,
`operations.ts`, `index.ts`, `notification-types.ts`, `notify-reasons.ts`)
needs its PAIRED `tests/.../X.test.ts` file touched with new cases -- not a
new standalone integration test alone.

**Coverage gate (verified,
`scripts/test-coverage-direct.pin.json`, read in full this session):**
```json
{
  "version": 1,
  "rows": []
}
```
Empty `rows` array -- NO file in this repo currently has a coverage-pin
exemption. Every changed line in every production file this phase touches
must be 100% covered (line/function/branch) by its own paired test, with no
existing carve-out to lean on.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MISS-01 | New bucket populated from verdict's `missing` arm, deduped by dependency key, respecting D-09-02's inclusion predicate | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ (extend existing file) |
| MISS-01 | Root-range threading + `treatDisabledAsWall` cascade option | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ✅ (extend existing file) |
| MISS-01 | New install-flow entry point materializes with `provenance: "dependency"`, no config write, no DFEN-04 arm | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✅ (extend existing file) |
| MISS-01 | Apply step pushes one `(installed)` row per cascade member with `{dependency installed}` | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ (extend existing file) |
| MISS-01 | D-09-07 re-plan lifts a marker-held dependent in the same reload | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ (extend existing file) |
| MISS-01 | `reason` gating -- startup plans but does not apply the bucket | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ (extend existing file) |
| MISS-01 | Full fixpoint: recorded-as-dependency state plans nothing; unsatisfied-but-recordable state plans the bucket | integration | `node --test tests/integration/reconcile-plan-convergence.test.ts` | ✅ (extend existing file per D-09-16) |
| MISS-02 | Failing dependency reports on its own row; dependent handled by the re-derived LOAD-01 check; nothing half-materialized | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ (extend existing file) |
| MISS-02 | Verify (Pitfall 2 / R1) the ACTUAL reason token that renders for a synthetic closure/constraint failure | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ (extend existing file; NEW assertion, not currently exercised for this bucket) |
| (closed-set) | `Reason` union amendment closed-set proofs | unit + architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/shared/notification-types.test.ts tests/architecture/compat-01-no-expansion.test.ts` | ✅ (all extend existing files) |
| (purity) | `plan.ts` stays fs/network-free after the new bucket/lift functions land | architecture | `node --test tests/architecture/reconcile-planner-purity.test.ts` | ✅ (no changes needed, gate self-verifies) |
| (network) | The new install-flow.ts entry point makes no direct git import | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ (no changes needed IF the new function stays inside `install-flow.ts`, per Pattern 5's recommendation) |

### Sampling Rate

- **Per task commit:** `npm run test:corresponding` + the targeted `node
  --test` invocation covering only the files touched by that task.
- **Per wave merge:** `npm run test:coverage:direct:commit` (diffs against
  HEAD to confirm every changed line is covered) + `npm run
  test:coverage:unit` (full 100%/100%/100% gate over `extensions/**`).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps

None -- every production file this phase touches already has a paired test
file (`tests/orchestrators/reconcile/{plan,types,apply,apply-outcomes,notify,dependency-verdict}.test.ts`,
`tests/orchestrators/plugin/{install-cascade,install-flow,operations}.test.ts`,
`tests/index.test.ts`, `tests/shared/{notification-types,notify-reasons}.test.ts`),
and the closed-set architecture tests (`notify-closed-set-locks`,
`catalog-uat/catalog-contract`, `compat-01-no-expansion`,
`reconcile-planner-purity`, `no-orchestrator-network`) already exist and
already exercise this exact class of change (verified by Phase 6/7/8's own
commits touching the identical file set). The convergence integration test
(`reconcile-plan-convergence.test.ts`) already exists and needs only a new
case (D-09-16), not new fixture infrastructure -- its existing
`populatedMixedState()` helper (read this session,
`tests/integration/reconcile-plan-convergence.test.ts:16-90`) is a template
for constructing a state with a `provenance: "dependency"` record.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (confirmed:
grep for the key returned nothing), so per the default it is treated as
enabled. This phase, however, introduces no new external input surface: the
missing-dependency KEY, the version RANGE, and the MARKETPLACE name it
resolves against are all values already read, validated, and token-checked
by the EXISTING declaration-read path (`dependency-index.ts` /
`dependency-declaration-read.ts`, Phase 3/6 work) before they ever reach the
verdict walk -- this phase does not add a new parser, a new network
endpoint, or a new place a plugin author's manifest content is trusted
further than it already is today. The install cascade this phase drives is
the SAME cascade the standalone `install` command already drives with the
same untrusted-manifest inputs.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | N/A -- extension-local operation, no new auth surface |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A -- scope isolation is unchanged (D-03-05: every cascade member installs into the requesting plugin's own scope; this phase adds no cross-scope path) |
| V5 Input Validation | yes (inherited, not new) | The existing `assertSafeName` / dependency-token allowlist (`domain/dependencies.ts`, `domain/dependency-closure.ts:isRenderableDependencyToken`) already governs every string this phase's new code paths touch; no new parser is added. |
| V6 Cryptography | no | N/A -- no credential handling changes; the auth-trio (`credentialOps`/`deviceFlowHttp`/`authMemo`) is passed through unchanged from the existing `InstallPluginOptions`, per Pattern 5. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A malicious plugin manifest declares a dependency name/marketplace crafted to break out of the rendered row (quote injection into a notification row) | Tampering / Information Disclosure | Already mitigated by `assertSafeName`/`isRenderablePluginKey`/`remedyParty`'s token-check-then-quote pattern (`apply-outcomes.ts:340-341`, unchanged by this phase); the new per-member success row must use the SAME `remedyParty`-style gating if it ever needs to interpolate a member's raw name into free text (it should not need to -- D-09-09 specifies structured fields, not free text, for the success row). |
| A pathological set of declared ranges across many declarers causes a combinatorial blow-up during the cross-declarer fold | Denial of Service | Already mitigated by `intersectDependencyRanges`'s two project-owned caps (`MAX_RANGE_INPUT_CHARS = 4096`, `MAX_RANGE_CONJUNCTS = 1024`, `domain/dependency-range.ts:28,37`), which the new bucket's fold reuses unchanged (Pattern 2/5 recommend folding at the SAME existing call site, not a new one). |
| A dependency cycle across the new bucket's per-key cascades (e.g. `c` declares `d`, `d` declares `c`, both missing) loops forever | Denial of Service | Already mitigated by `resolveDependencyClosure`'s `path.includes` cycle guard (`domain/dependency-closure.ts:407-409`), reused unchanged since the new entry point calls the same `resolveDependencyClosure` via `runInstallCascade`. |

## Sources

### Primary (HIGH confidence -- read this session, in this repository)

- `.planning/phases/09-reload-installs-missing-dependencies/09-CONTEXT.md` -- all sixteen decisions, already checked against upstream by the operator's own process.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` (lines 1-350, 560-643)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` (lines 380-560)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts` (lines 1-40)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` (lines 273-520)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` (lines 1-100, 265-470, 1095-1949)
- `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts` (full file)
- `extensions/pi-claude-marketplace/domain/dependency-closure.ts` (lines 1-478)
- `extensions/pi-claude-marketplace/domain/dependency-range.ts` (full file)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (grep for `provenance`/`dependencyDisabled`)
- `extensions/pi-claude-marketplace/shared/notification-types.ts` (full file)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (lines 1-120)
- `extensions/pi-claude-marketplace/index.ts` (lines 85-155)
- `extensions/pi-claude-marketplace/platform/pi-api.ts` (`ResourcesDiscoverEvent` block)
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:404-408`
- `tests/architecture/no-orchestrator-network.test.ts` (lines 1-60) + `tests/architecture/gate-targets.ts` (lines 38-78, 492)
- `tests/architecture/reconcile-planner-purity.test.ts` (full file)
- `tests/architecture/notify-closed-set-locks.test.ts` (grep for `REASON_ENROLLMENT`, line 243)
- `tests/architecture/catalog-uat/catalog-contract.test.ts` (lines 115-116)
- `tests/architecture/dependency-doc-agreement.test.ts` (lines 1-30)
- `tests/integration/reconcile-plan-convergence.test.ts` (lines 1-90)
- `scripts/check-corresponding-tests.mjs` (lines 1-40)
- `scripts/test-coverage-direct.pin.json` (full file)
- `package.json` (scripts section)
- `.fallowrc.json:10`, `eslint.config.js:88,336,381,458`
- `docs/dependency-resolution.md` (lines 130-215)
- `docs/output-catalog.md` (lines 2735-2797, table of contents grep)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (lines 1-100)
- `git show --stat 40717eedc39503e2188a0b7e3963bcc568bb7076` (Phase 8's closed-set-amendment precedent commit)

### Secondary (MEDIUM confidence)

None -- no WebSearch/WebFetch was used per the objective's explicit instruction; all upstream facts are pre-pinned in CONTEXT.md `<specifics>` and were not re-derived this session (no re-check of the 2.1.267 binary was needed, since none of CONTEXT.md's upstream claims were contradicted by the in-repo source read this session).

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A -- no new stack.
- Architecture (bucket/apply/entry-point shapes): HIGH -- every claim traces to source read this session with file:line citations.
- Closed-set amendment mechanics: HIGH for the checklist's existence and the two numeric pins (60, 220, 30_068 -- all read verbatim); MEDIUM for the exact insertion syntax in two of the nine checklist files (A1, A2 in Assumptions Log) since their bodies were not read line-by-line this session.
- Failure-reason token accuracy (R1): HIGH confidence that the described discrepancy exists (multiple independent source reads converge on the same conclusion: `classifyOrchestratorThrow`'s `instanceof DependencyCascadeError` check, EVERY closure/constraint arm's `cause` construction, and the existing catalog example all agree) -- this is the research's single most load-bearing finding and should not be silently overridden during planning.

**Research date:** 2026-09-21
**Valid until:** Until this phase's PLAN.md is written and executed (this research is source-derived, not time-sensitive beyond the current state of the `features/manifest` worktree's code; re-derive if the branch's `orchestrators/reconcile/` or `orchestrators/plugin/install-*` files change materially before planning happens).

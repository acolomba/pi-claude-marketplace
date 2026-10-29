# Phase 2: Apply Ordering and Installed Declarations - Research

**Researched:** 2026-10-26
**Domain:** reconcile `apply`/`pending` planner ordering, dependency-declaration reads, an injected missing-dependency seam (TypeScript, in-repo only)
**Confidence:** HIGH for the current-code traces (the two backlog shapes were run against the real extension in this session); MEDIUM for the proposed restructure (design, not yet built)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Apply ordering (RCN-01, RCN-02: PENDMOVE-01, MISSORDER-01)

- **D-PL2-01 — MISS-01 runs after the catalog moves.** Per scope, `apply`
  runs: uninstalls, marketplace removes, marketplace adds, config installs,
  toggles, the catalog-move cascade (`convergeScope`), THEN the
  missing-dependency install (MISS-01), THEN the D-09-07 toggle refresh for the
  dependents MISS-01 satisfied (marker lifts), THEN the final judgement
  (`judgeFinalScope` over the final state, unchanged invariant check of
  APPLY1-D1). Matches Claude Code's only flow with both steps (E4: updates,
  then `bae`). MISS-01 keeps RESV-05's refusal of an out-of-range installed
  dependency (UPD-DEP-D1 says so; E4 agrees), so it does not move anything
  itself: it now sees the versions the moves landed.
  - A dependent whose only unmet need before the moves is a dependency in the
    MISS-01 bucket is not disabled by the pre-move toggle step (the plan treats
    scheduled MISS-01 installs as present, as `pending` already does through
    `withPlannedInstallsLanded`); if MISS-01 then fails, the final judgement
    disables it with the existing `Install "<dep>" or uninstall "<plugin>"`
    remedy, in the same `apply`.
  - The MISS-01 bucket is recomputed after the moves from a fresh verdict, so a
    dependency a moved plugin's new version needs (`dependencyInstallsFollow`)
    is installed by this same `apply`.
  - Alternative rejected: keep MISS-01 before the moves and let it plan moves
    like `installAfterMoves` — contradicts UPD-DEP-D1's "the reload's
    missing-dependency install keeps RESV-05's refusal" and upstream E4.
  - Alternative rejected: run MISS-01 twice (before and after) — doubles the
    rows/attempts for one key and makes `pending` harder to mirror.
- **D-PL2-02 — `pending` previews that order.** The release and plan judgement
  (`releaseOnLandedMoves` → `verdictAfterMoves` → `buildScopeSatisfactionVerdict`)
  count scheduled installs (config installs plus the MISS-01 bucket, including
  what moved versions need) as present, exactly as `judgePlannedScope` already
  does with `scheduled`. So for PENDMOVE-01 `pending` lists the move `apply`
  makes, and for MISSORDER-01 it lists the move and then the install, in
  `apply`'s row order. One shared planner path for both; no pending-only
  special case.
- **D-PL2-03 — Proof.** Two new `features/plugin/apply.feature` scenarios, one
  per shape, each asserting `pending`'s rows, `apply`'s rows (same set, same
  order), the installation record, and that a second `pending` is
  `reconcile-pending-empty` (success criterion 1). Each must fail on the
  pre-phase code.

#### Config-dropped dependency (RCN-03: RECON-REPLAN-01)

- **D-PL2-04 — Close with the existing proof.** APPLY1-D1's final judgement
  already disables the dependent in the same `apply`.
  `features/plugin/apply.feature` "Pending lists the disable of a plugin whose
  dependency a config drops, as apply makes it" (line ~749) edits the config to
  drop `orphan` and shows `keeper` disabled in that `apply`. The plan verifies
  the scenario fails with the final judgement's disable removed (mutation check,
  not committed) and retitles it to name the apply behavior if the title does
  not; no new scenario unless the check shows the existing one does not prove
  it. The backlog entry closes as fixed by APPLY1-D1. The D-09-07 "re-plan only
  after a dependency install" scope note is superseded by APPLY1-D1's
  final-state judgement (no measured read-pass cost is added by this phase).

#### Unreadable declarer failure unit (RCN-04: STALE-DECLARER-01)

- **D-PL2-05 — Keep the whole-scope fail-closed unit.** `buildScopeDeclarationIndex`,
  `buildScopeDeclarationDetail` and `judgeFinalScope` keep returning on the
  first unreadable record. Upstream (E6) skips one plugin and continues for the
  load check but aborts the whole scope for prune and the orphan scan — the
  guards that protect removals, which is exactly what this reader also feeds
  here (uninstall's dependents guard D-05-07, prune, `marketplace remove`
  retention). The divergence for the load-time check is licensed by the
  recorded project decision D-05-07 (Locked) and the project rule "fail closed
  on corrupt data". Code and tests already match; the phase adds/keeps a unit
  test per walk pinning the early return and a comment citing D-PL2-05 at the
  early returns, and fixes the stale "disables it on the next reload" comment in
  `dependency-verdict.ts` (LCDOC-01 overlap, comment only).

#### Installed-copy declarations (RCN-05: ENDEPS-01, UPDDEP-01 b3)

- **D-PL2-06 — Enable closure and update preflight read the installed copy.**
  A new reader (in `dependency-index.ts`) returns an installed record's
  declarations from its installed copy: for a git-source record, the
  per-commit clone of the RECORDED commit under `plugin-clones/`; when that
  copy has no `plugin.json`, the catalog entry stands in (E2); when the copy
  is gone, fall back to today's catalog read. `enableCascadeLookup`
  (`enable-disable.ts`) and the update preflight's holder walk (through the
  `update-constraint-gate.ts` seam into `evaluateCatalogConstraint`) use it.
  The other callers (load verdict, convergence/pending plan, uninstall guard,
  prune, `marketplace remove`) keep the catalog-first reader: APPLY1-D1's
  judgement already reads catalog plus installed copy (D-12a), and moving the
  verdict would change locked APPLY1-D1 behavior (apply.feature "Apply disables a
  plugin whose marketplace now declares a newer version of its dependency").
- **D-PL2-07 — Path sources keep the marketplace tree.** A path-source plugin's
  installed copy IS the marketplace tree (this extension translates artifacts
  and keeps no copy of `plugin.json`), so after the marketplace changes, its
  old declarations are unknowable — the same fact APPLY1-D1 records ("a
  path-source dependent whose own move failed has unknown old declarations").
  Divergence from E2 for path sources, licensed as an architecture capability
  gap (no retained copy). Recording declarations in `state.json` at install is
  the full fix and is deferred (backlog candidate DECLREC-01).
- **D-PL2-08 — Proof.** A scenario in `features/plugin/enable.feature` with a
  git-source plugin: install it, publish a catalog whose entry and new commit
  declare a different dependency, disable then enable it, and show the enable
  closure follows the installed copy. A scenario in
  `features/plugin/update-dependencies.feature` (or `update.feature`) where an
  installed git-source holder's installed copy declares a range that the
  catalog no longer declares, and `update` of the dependency is held
  `{dependents constrain}` by the installed range.

#### Missing dependencies after marketplace add, bootstrap, autoupdate (RCN-06: MISS-MPADD-01)

- **D-PL2-09 — Run MISS-01 after `marketplace add` and `bootstrap`.** After a
  successful (not already-added) add, the add's scope runs the one-scope
  missing-dependency step (the same verdict + `pluginsToDependencyInstall`
  derivation and `createDependencyInstallOperation` that `apply` uses),
  installing missing dependencies of that scope's enabled dependents that the
  newly added marketplace now satisfies, as upstream E1 does. `bootstrap` gets it
  through its add. Rows: one `(installed) {dependency installed}` row per
  materialized member in the add's cascade result; a refusal renders as `apply`
  renders it (D-PL2-11). Wired through an injected seam (typed in
  `orchestrators/types.ts` like `PluginUpdateFn`, composed in `index.ts` next to
  `createApplyReconcile`, threaded via `EdgeDeps` to the add, bootstrap and
  marketplace-update handlers) because BLOCK C and the
  add→operations→install-outcome→add cycle forbid a direct import. Scope: the
  add's scope only (upstream scans every scope; see Uncertain choices).
- **D-PL2-10 — Autoupdate cascade.** After `marketplace update`'s autoupdate
  cascade (`cascadeAutoupdates`) the same seam runs for the scope, limited to
  dependents from autoupdate-enabled marketplaces (E1), after the plugin
  updates (E4 order). Phase 8's background autoupdate reuses the cascade and
  inherits it. `autoupdate.ts` (setting command) needs no change.

#### MISS-01 refusal report (RCN-07: PARITYGV-01 b4)

- **D-PL2-11 — Keep the failed row; record the difference.** `apply` (and the
  D-PL2-09/10 call sites) render a MISS-01 refusal as a `(failed)` row with the
  cause, where Claude Code's `bae` only logs (E3) and the dependent stays
  disabled. Licensed by APL-D1 (`apply` is the explicit command that reports
  every change it attempts) and the project's row grammar; the dependent's
  `disabled {dependency unsatisfied}` row matches upstream's visible state. ID
  D-PL2-11 closes PARITYGV-01 b4.

#### Delisted installed-copy containment (RCN-08: LCORCH-01 b6)

- **D-PL2-12 — One owning root per source kind.** `readInstalledCopyDeclaration`
  accepts only the owning clone root of the record's source kind: the
  marketplace clone for `path` sources, `plugin-clones/` (its own clone key)
  for git sources (NFR-10 re-anchored by url-source). The symlink half is stale
  (`assertPathInside` already refuses symlink segments below the root). Both
  callers (`dependency-index.ts` `readInstalledCopy`, `convergence.ts`
  installed-copy reader) pass the single root. Unit tests: a path-source record
  whose copy resolves under `plugin-clones/` and a git record whose copy
  resolves under the marketplace clone both fail closed.

### Claude's Discretion

- Function boundaries for the reordered apply driver and the shared
  scheduled-installs set; whether MISS-01's post-move bucket is recomputed via
  `readPassForScope` or a narrower verdict call (must not change load-time
  output).
- Exact cucumber fixture shapes, as long as each scenario fails before the
  change.

### Deferred Ideas (OUT OF SCOPE)

- DECLREC-01 (new backlog candidate): record each install's dependency
  declarations in `state.json` so path-source records keep their installed
  declarations, and move the load verdict and uninstall guard to installed
  declarations for full E2 parity.
- Running the add-time MISS-01 over every scope, as upstream does.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RCN-01 | `pending` previews the move `apply` makes for a plugin whose moved dependency needs a plugin MISS-01 installs (PENDMOVE-01) | Shape run against current code (§Traces, T1): pending lists `widget (will disable)`, apply moves it. Root cause: `releaseOnLandedMoves` → `verdictAfterMoves` without `scheduled` (convergence.ts:879-903, dependency-verdict.ts:497-516). Fix: §Pattern 1, steps B and E. |
| RCN-02 | `apply` installs a missing dependency that needs a version the same `apply` moves to, in one run, and `pending` previews the same order (MISSORDER-01) | Shape run (T2): apply fails `newdep` with `Dependency "ycore@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0.` and disables `widget`. Fix: move `applyDependencyInstalls` (apply.ts:657-737) from `applyPlan` (apply.ts:1139) into `convergeScope` after `runCascade` (apply.ts:1195); §Pattern 1, step D. |
| RCN-03 | A scenario proves a dependent whose dependency a config edit uninstalls is disabled in the same `apply` | Existing apply.feature:749 scenario; the `keeper` disable comes from `judgeScopeAfterCascade` → `applyDependencyDisables` (apply.ts:1625-1633). Mutation check: §Validation. |
| RCN-04 | Failure unit decided, recorded, backlog closed (STALE-DECLARER-01) | Early returns at dependency-index.ts:344-346, 368-370 and dependency-verdict.ts:576-579; existing pins: dependency-index.test.ts:596, :743; dependency-verdict.test.ts:999. Stale comment: dependency-verdict.ts:35-42. |
| RCN-05 | Enable closure and update preflight read the installed copy (ENDEPS-01, UPDDEP-01 b3) | New reader beside `readRecordDeclarations` (dependency-index.ts:249-297); callers `enableCascadeLookup` (enable-disable.ts:632-660, call at :645) and `REAL_UPDATE_CONSTRAINT_SEAM` (update-constraint-gate.ts:82-86), which already forwards a `buildScopeDeclarationDetail` seam into `evaluateCatalogConstraint` (constraint-fold.ts:405-412), so constraint-fold.ts needs no edit. §Pattern 2. |
| RCN-06 | `marketplace add`, `bootstrap`, autoupdate cascade settle missing dependencies like Claude Code (MISS-MPADD-01) | Seam design §Pattern 3; render via existing `UpdateDependencyRow` (orchestrators/types.ts:330-334); `UPDATE_CONTEXT` already has an `installed` policy (update.messaging.ts:35-42), `ADD_CONTEXT` does not (add.messaging.ts:18-23). |
| RCN-07 | MISS-01 refusal report matches Claude Code or the difference has an ID (PARITYGV-01 b4) | D-PL2-11 records the difference; current refusal row already renders (apply.feature:1179, apply.test.ts MISS-02 cases). |
| RCN-08 | Installed-copy containment for a delisted plugin offers only the owning clone root (LCORCH-01 b6) | `isInsideAnyRoot` (dependency-declaration-read.ts:347-362) fed `[marketplaceRoot, pluginClonesDir]` at dependency-index.ts:314-318 and convergence.ts:446-449. Discriminator must be `resolvedSha`, not "source kind" (see Pitfall 6). |
</phase_requirements>

## Summary

Both backlog shapes were reproduced in this session by running throwaway cucumber
scenarios against the current code (hermetic sandbox, no repo edits). PENDMOVE-01:
`pending` lists `extra (will install)`, `widget (will disable)`, `zcore (will update)`,
while `apply` reports `extra (installed) {dependency installed}`, `zcore (updated)`,
`widget (updated)`. MISSORDER-01: `pending` lists `newdep (will install)`,
`widget (will update)`, `ycore (will update)`, while `apply` reports `newdep (failed)
{dependency failed}`, `widget (disabled) {dependency unsatisfied}`, `ycore (updated)`.
Both scenarios D-PL2-03 calls for would therefore fail on the pre-phase code, as required.

The core of D-PL2-01/02 is not "move one call". Three facts force a small but real
restructure: (1) apply's read pass (read-pass.ts:221-248) plans the pre-move toggles
WITHOUT counting scheduled installs as present (only `pending` wraps its plan in
`withPlannedInstallsLanded`, pending.ts:321-350), so moving MISS-01 later would disable
more dependents before the cascade; (2) enabling a disabled record whose closure
contains an uninstalled member is refused (`EnableRefusedError("dependency
unsatisfied")`, enable-disable.ts:816-821), so any enable the planned installs release
(a marker lift or a config enable) must run AFTER MISS-01, never in the toggle step or in
the cascade's deferred enables; (3) apply's rows are emitted in push order and pending's
in projection order (notify.ts:705-768 puts every install before the moves), so the
pending projection must render MISS-01 installs (and the enables they release) after
the moves. `notify.ts` and `reconcile/types.ts` are therefore extra files beyond the
ROADMAP `Files` line.

RCN-05 fits the existing seams: the update gate's `seam.buildScopeDeclarationDetail`
is already threaded into `evaluateCatalogConstraint`, so an installed-copy-first detail
walk can be swapped in from `update-constraint-gate.ts` alone; `enableCascadeLookup`
needs a one-line reader swap. RCN-06 needs an injected seam (EdgeDeps → handlers →
`addMarketplace`/`updateMarketplace` options) because `apply.ts` imports
`marketplace/add.ts` and the reverse would be a cycle. RCN-08's "source kind" does not
exist on a record; `resolvedSha` is the reliable discriminator, and a tag-pinned
path-source dependency also lives under `plugin-clones/` with a `resolvedSha`.

**Primary recommendation:** Build one shared "plan with installs landed" path in
`convergence.ts` (move `withPlannedInstallsLanded`/`releasedDependents` out of
`pending.ts`), thread `scheduled` through `verdictAfterMoves`/`releasableDependents`,
carry a new `enablesAfterInstalls` list next to `deferredEnables`, and move
`applyDependencyInstalls` plus a post-install enable refresh into `convergeScope`
between `runCascade` and `judgeScopeAfterCascade`, with their rows placed after the
cascade step rows and before the judgement's disable rows.

## Architectural Responsibility Map

This is a single-process Pi extension; the "tiers" are the project's layers
(ARCHITECTURE.md).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Apply step order (moves, then MISS-01, then lifts, then judgement) | orchestrators/reconcile (`apply.ts`) | orchestrators/plugin (operations) | `apply.ts` owns the per-scope driver; it already binds `createDependencyInstallOperation`. |
| Shared plan with scheduled installs counted present | orchestrators/reconcile (`convergence.ts`, `dependency-verdict.ts`) | `read-pass.ts`, `pending.ts` (callers) | D-PL2-02 "one shared planner path"; both read pass and pending already call `settleMoveCascade`. |
| Pending row order | orchestrators/reconcile (`notify.ts` projection) | `pending.ts` | `buildReconcilePendingNotification` fixes row order (notify.ts:705-768). |
| Installed-copy-first declarations | orchestrators/plugin (`dependency-index.ts`) | `dependency-declaration-read.ts` | D-PL2-06 names the file; it already owns `readRecordDeclarations`. |
| Installed-copy containment | orchestrators/plugin (`dependency-declaration-read.ts`) | shared/path-safety | `isInsideAnyRoot` is the chokepoint; callers pass roots. |
| Add/bootstrap/autoupdate MISS-01 | orchestrators/reconcile (new exported factory) composed in `index.ts` | edge (handlers thread the seam), orchestrators/marketplace (calls it) | BLOCK C + cycle: marketplace ledgers may only receive it injected. |
| Rendering add-time/autoupdate MISS-01 rows | orchestrators/marketplace (`add.ts`/`add.messaging.ts`, `update.ts`) | shared notify spine | Each command owns its row policy (MOD-01). |

## Project Constraints (from AGENTS.md)

- Never commit to `main`; branch `features/plugin-lifecycle-p2` is in use. Commit messages: Conventional Commits, no GSD phase/plan IDs in the scope (`.agents/skills/committing/SKILL.md`). Never `--no-verify`, never rebase.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario under `features/` that fails without the change (AGENTS.md "Behavioral tests").
- Upstream parity is the default; divergences need a recorded decision ID (D-PL2-07, D-PL2-11 are such IDs) or a Pi capability gap.
- NFR-1 atomic writes; NFR-2 no restart needed; NFR-3 idempotent/fail-clean; NFR-5 network policy (see Pitfall 8: MISS-01 at a path-source `marketplace add` can clone a git dependency); NFR-10 containment.
- IL-2: exactly one notify per command outcome through `shared/notification-dispatch.ts`; no direct `ctx.ui.notify`.
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`, sonarjs cognitive complexity 15), fallow (dead code, cycles, boundaries, `maxCognitive: 15`, `maxCyclomatic: 20`, dupes with zero clone groups), Prettier, source/test pairing, unit, integration, cucumber, 100% direct coverage per source-test pair.
- Comments cite durable IDs (`D-PL2-01`, `NFR-10`), never phase/plan numbers; no comments on trivial code.
- Tests that touch state must use the hermetic-home helpers (`createHermeticScopes`, cucumber world); never the real `~/.pi`.
- `features/` rules: steps lower case, `Given`/`When`/`Then` only, whole-table comparisons, one behavior per scenario, `npm run check:features` must pass.

## Standard Stack

No new runtime or dev dependency is needed. Everything is in-repo TypeScript on the
existing stack (`.planning/codebase/STACK.md`): Node `^22.22.2 || ^24.15.0 || >=26.0.0`,
`node:test` for unit tests, `@cucumber/cucumber` for behavioral tests, `typebox`,
`write-file-atomic`, `proper-lockfile`, `isomorphic-git` (unchanged chokepoints).

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external package.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Current vs. proposed apply data flow (one scope)

```
CURRENT (apply.ts:1858-1876, 1128-1145, 1165-1217)
read pass (locked)  ──plan, deferredEnables──▶ applyPlan
  verdict → planReconcile → verdictAfterToggles → settleMoveCascade(no installs-landed)
applyPlan: uninstalls → mp removes → mp adds → config installs
           → MISS-01 (round-1 bucket)                         ◀── fails MISSORDER-01
           → [refresh read pass if anything landed] → toggles (enable/disable/dep-disable)
convergeScope: planConvergenceCascade → runCascade (moves + deferred enables)
           → judgeScopeAfterCascade (judgeFinalScope, disables with marker) → cascadeRows

PROPOSED (D-PL2-01)
read pass (locked)  ──plan, deferredEnables, enablesAfterInstalls──▶ applyPlan
  verdict → planReconcile → verdictAfterToggles
          → settleMoveCascade(replan = plan WITH installs landed; verdictAfterMoves(scheduled))
applyPlan: uninstalls → mp removes → mp adds → config installs
           → [refresh read pass if a config install landed]  (c06 behavior kept)
           → toggles (no disable of a dependent released by scheduled installs;
                      no enable that the scheduled installs release)
convergeScope: planConvergenceCascade → runCascade
           → MISS-01 bucket (round-1 bucket, or recomputed when a cascade step ran)
           → applyDependencyInstalls                         ◀── sees landed versions
           → post-install enables (re-read; run fresh enables ∩ enablesAfterInstalls)
           → judgeScopeAfterCascade (unchanged invariant) → cascadeRows
```

### Traces of the two backlog shapes (run in this session)

Probe: `npx cucumber-js --format progress <scratchpad>/probe.feature`, using the repo's
own step definitions (`cucumber.json` imports), dir-source marketplace `tools`, project
scope. [VERIFIED: cucumber run against current code, 2026-10-26]

**T1 PENDMOVE-01.** Installed `widget 1.0.0 (deps zcore)`, `zcore 1.0.0`. Re-offered
`widget 1.1.0 zcore@^2.0.0`, `zcore 2.0.0 extra`, `extra 1.0.0`.

| Surface | Current rows (in order) | Target rows after the phase |
|---|---|---|
| `pending` | `extra will install`; `widget will disable`; `zcore will update 1.0.0→2.0.0` | `zcore will update 1.0.0→2.0.0`; `widget will update 1.0.0→1.1.0`; `extra will install` |
| `apply` | `extra installed {dependency installed} 1.0.0`; `zcore updated 1.0.0→2.0.0`; `widget updated 1.0.0→1.1.0` | `zcore updated`; `widget updated`; `extra installed {dependency installed}` |

Why pending says `will disable` today: verdict holds `widget` (out-of-range zcore) and
`zcore` (missing extra). `releasableDependents` (dependency-verdict.ts:439-460) releases
`widget` only; `pending`'s replan drops `zcore`'s disable through
`withPlannedInstallsLanded`; the cascade moves both; then `verdictAfterMoves`
(dependency-verdict.ts:497-516) rebuilds the verdict with no `scheduled`, so `zcore` is
"missing extra" again, `widget` sees `zcore` held, `stillHeld` returns `{widget}`, the
release set empties and `input.plan` (with `widget` disabled) is returned
(convergence.ts:879-903). `apply` escapes this only because its MISS-01 runs first and
the D-09-07 refresh re-plans over a state that records `extra`.

**T2 MISSORDER-01.** Installed `widget 1.0.0`, `ycore 1.0.0`. Re-offered
`widget 1.1.0 newdep`, `newdep 1.0.0 ycore@^2.0.0`, `ycore 2.0.0`.

| Surface | Current rows (in order) | Target rows after the phase |
|---|---|---|
| `pending` | `newdep will install`; `widget will update 1.0.0→1.1.0`; `ycore will update 1.0.0→2.0.0` | `widget will update`; `ycore will update`; `newdep will install` |
| `apply` | `newdep failed {dependency failed}` cause `Dependency "ycore@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0.`; `widget disabled {dependency unsatisfied}` cause `Install "newdep@tools" or uninstall "widget@tools"`; `ycore updated 1.0.0→2.0.0` | `widget updated`; `ycore updated`; `newdep installed {dependency installed}` |

Move order note: `dependenciesFirst` (convergence.ts:653-677) recurses only through
keys that are themselves moves, so `widget` (which reaches `ycore` only through the
not-yet-installed `newdep`) sorts before `ycore`; today's pending already prints
`widget` then `ycore`. The converge runner does not check a moved plugin's own
dependencies (`createConvergeOperation` runs without `settleDependencies`,
update-flow.ts:1352-1364), so `widget 1.1.0` lands while `newdep` is still missing and
MISS-01 installs it afterwards. [VERIFIED: update-flow.ts:1352-1364]

### Pattern 1: Reorder MISS-01 after the cascade (D-PL2-01/02)

Recommended steps (function boundaries are Claude's discretion):

**A. One shared planner path.** Move `withPlannedInstallsLanded` (pending.ts:321-350),
`releasedDependents` (pending.ts:282-309) and `independentlyDisabledKeys`
(pending.ts:263-274) to `convergence.ts` (or `dependency-verdict.ts`), export them, and
use the same `planFrom` composition in both `read-pass.ts` (today
`replan: (released) => planReconcile(outcome.merged, state, scope, released)`,
read-pass.ts:238) and `pending.ts` (pending.ts:512-533). `withoutDisabledDependents`
(pending.ts:358-366) stays pending-only (it hides a no-op row `apply` never reports).
Their direct coverage moves to `test/orchestrators/reconcile/convergence.test.ts`
(source-test pairing), so the pending.test.ts cases that pin them must keep an
equivalent assertion in the new owner.

**B. Thread `scheduled`.** `propagateUnsatisfied` already takes `scheduled`
(dependency-verdict.ts:299-304) and `judgeFinalScope` passes it
(dependency-verdict.ts:587-594); `buildScopeSatisfactionVerdict`
(dependency-verdict.ts:334-350) does not. Add `scheduled?: ReadonlySet<string>` to
`ScopeSatisfactionOptions` (dependency-verdict.ts:70-83; `FinalScopeOptions` at
:541-548 already declares it and can inherit it), forward it in
`buildScopeSatisfactionVerdict`, and pass it from `releaseOnLandedMoves` to
`verdictAfterMoves`, computed from the replanned plan's `pluginsToInstall` +
`pluginsToDependencyInstall` keys, exactly as `judgePlannedScope` computes it
(convergence.ts:838-842). Also give `releasableDependents` a `scheduled` argument so a
`missing` entry whose dependency is scheduled does not block the dependent
(dependency-verdict.ts:449-458): without it, a dependent that is out of range on one
dependency AND missing a scheduled one is never released, so it is disabled before the
moves and needs a second `apply`.

**C. Withhold the enables the scheduled installs release.** Every enable that the
landed-installs replan adds (a D-09-08 marker lift, or a config enable that
`classifyDeclaredPlugin` gated on the verdict, plan.ts:536-541) would be refused if it
ran before MISS-01 (enable-disable.ts:816-821). Compute them once in the shared path
(the keys `releasedDependents` returned that appear in the replanned
`pluginsToEnable`), remove them from `plan.pluginsToEnable` and from `deferredEnables`,
and carry them as a new `enablesAfterInstalls` on `MoveCascade`
(convergence.ts:743-753) and `ScopeReadResult` (reconcile/types.ts:424-449). After the
c06 refresh (a config install landed), the re-read naturally moves the
config-released ones back into plain enables, because the config-installed plugin is
now recorded.

**D. Apply driver.** In `applyPlan` (apply.ts:1128-1145) remove the
`applyDependencyInstalls` call; keep the refresh only on `installed` (the c06 trigger);
return `{ deferred, enablesAfterInstalls, dependencyInstalls }` from the toggles plan
(the refreshed one when it ran — `refreshTogglePlan`, apply.ts:762-786, must then also
copy the fresh `pluginsToDependencyInstall` and `enablesAfterInstalls`). In
`convergeScope` (apply.ts:1165-1217), inside the `try` after `runCascade`:
1. bucket = the toggles plan's bucket, or, when `reports.length > 0` (a step ran), a
   fresh bucket (see "Post-move bucket" below);
2. `applyDependencyInstalls` into a local row list;
3. if it installed or found something, or `enablesAfterInstalls` is non-empty: re-read
   the scope (`readPassForScope`, like `refreshTogglePlan`) and run
   `applyPluginToggles(..., ENABLE_AXES)` over the fresh `pluginsToEnable` restricted to
   keys in `enablesAfterInstalls` plus fresh marker lifts not already attempted in this
   apply (no duplicate rows for a config enable that already failed);
4. append those rows as `StepReport`s (or a list `cascadeRows` places after step rows),
   then let the `finally` judgement run with `ran: true` when anything landed (today
   `ran: reports.length > 0`, apply.ts:1204, would make the judgement reuse the
   pre-cascade `before.state`, apply.ts:1601).

Row placement is load-bearing: rows pushed straight into `outcomes` inside the `try`
would print BEFORE the cascade's move rows, because `cascadeRows` is pushed in the
`finally` (apply.ts:1210-1215). And they must print before the judgement's leftover
disable rows (`[...rows, ...holds, ...byKey leftovers]`, apply.ts:1679-1690) to keep
`apply.feature:1179` (`dirp failed` then `app disabled`) and the MISS-02 unit cases
(`secrets-vault failed` then `deploy-kit disabled`, apply.test.ts:5927-5942) unchanged.

**Post-move bucket.** Discretion item. Options: (a) `readPassForScope` again (takes the
lock, runs migration, verdict, plan AND `settleMoveCascade` — the costliest offline
step); (b) a narrower exported read in `read-pass.ts`: lock, `loadMergedScopeConfig`,
CFG-03/LAYER-06 checks, `buildScopeSatisfactionVerdict`, `planReconcile`, return
`pluginsToDependencyInstall` only. Recommend (b), called only when a cascade step ran,
so a steady-state `apply` reads the scope exactly as often as today (the NFR-5 unit
test compares call counts between two runs, apply.test.ts:6691-6778). Load-time output
is untouched either way: `load.ts` never calls these.

**E. Pending projection order.** In `buildReconcilePendingNotification`
(notify.ts:695-777) render `plan.pluginsToDependencyInstall` after the convergence
moves (today it shares the install loop at notify.ts:720-733, before
`pushConvergence` at :768), then the `enablesAfterInstalls` rows, then holds/declines.
`pushConvergence` (notify.ts:315-340) has to split moves from holds/declines, or take a
callback. Apply's matching order is: cascade step rows → MISS-01 rows →
post-install enable rows → holds → judgement leftovers.

### Pattern 2: Installed-copy-first declarations (D-PL2-06, D-PL2-12)

Facts:
- A git install always records `resolvedSha`: the clone probe returns it on every
  `materialized` arm (install-clone-probe.ts:74, :88), the schema field is
  `resolvedSha: Type.Optional(Type.String()),` (state-io.ts:100), and it shipped in the
  same commit as git-source plugins and `plugin-clones/` (051914b3, 0.9.0).
  [VERIFIED: git log -S; state-io.ts:91-100]
- A tag-pinned PATH-source dependency is also materialized under `plugin-clones/`
  with a `resolvedSha`: `materializeMarketplaceTagClone` keys it
  `pluginCloneKey(marketplaceUrl, args.tagOid)` and returns
  `{ kind: "materialized", pluginRoot: rootResult.pluginRoot, resolvedSha: args.tagOid }`
  (clone-cache.ts:905-937); install sets `resolvedSha = result.resolvedSha` on that arm
  (install-outcome.ts:777-787). [VERIFIED: clone-cache.ts:887-937]
- `isPinnedCopy` already decides "installed copy lives under plugin-clones" from
  `assertPathInside(locations.pluginClonesDir, pluginRoot, ...)` (convergence.ts:906-916).

Recommended reader (in `dependency-index.ts`), shape only:

```typescript
// Source: composed from dependency-index.ts:249-319 and dependency-declaration-read.ts:373-388
export async function readInstalledRecordDeclarations(
  options: ScopeDeclarationDetailOptions,
  marketplace: MarketplaceStateRecord,
  name: string,
): Promise<RecordDeclarations> {
  const record = ownValue(marketplace.plugins, name);
  if (record?.resolvedSha !== undefined) {
    const copy = await readInstalledCopyDeclaration({
      pluginRoot: record.resolvedSource,
      ownerRoots: [options.locations.pluginClonesDir],          // D-PL2-12: one root
      ...(options.reader !== undefined && { reader: options.reader }),
    });
    // found -> addressed copy declarations; unusable -> fail closed (D-05-07);
    // absent (copy gone, or no plugin.json) -> fall through to the catalog read.
  }
  return readRecordDeclarations(options, marketplace, name);
}
```

- `enableCascadeLookup`: replace the call at enable-disable.ts:645. Keep the
  `isDelistedRead` root exemption (enable-disable.ts:646-648) working: the installed-copy
  arm never sets `delisted`, and a delisted record with a readable copy is answered by
  the copy anyway.
- Update preflight: add `buildInstalledScopeDeclarationDetail` (same walk as
  `buildScopeDeclarationDetail`, dependency-index.ts:360-377, with the installed-first
  per-record reader) and set it as `REAL_UPDATE_CONSTRAINT_SEAM.buildScopeDeclarationDetail`
  (update-constraint-gate.ts:82-86). `evaluateUpdateConstraint` already passes its seam
  through (`evaluateCatalogConstraint({ ...options, seam })`, update-constraint-gate.ts:241),
  so `constraint-fold.ts` stays untouched. Factor the two walks over one private
  per-record reader parameter: two near-identical loops would be a fallow clone group.
- Scope of the change: only `searchReleaseTags: true` callers reach
  `evaluateUpdateConstraint` (`selectConstraintGate`, update-preflight.ts:1031-1039):
  `update`, autoupdate, reinstall, install's dependency moves. `apply`'s converge uses
  `CONVERGE_MATERIALIZATION` with `searchReleaseTags: false` (update-flow.ts:1268-1273)
  and `RECONCILE_MOVE_MATERIALIZATION` (dependency-bindings.ts:46-49), which go straight
  to `evaluateCatalogConstraint` with the catalog seam (update-preflight.ts:1038). That
  matches D-PL2-06 (convergence/pending keep the catalog-first reader), but it means
  `update` and `apply` can now disagree about a holder whose installed copy differs from
  the catalog. Document it.
- "Copy has no plugin.json → catalog entry stands in (E2)": `readInstalledCopyDeclaration`
  answers `absent` for both "copy gone" and "no manifest" (dependency-declaration-read.ts:377-382),
  so both fall back to `readRecordDeclarations`, which for a listed git record reads the
  catalog clone's own manifest first and the entry second (dependency-declaration-read.ts:292-307).
  That is "today's catalog read", slightly broader than "entry stands in". Acceptable;
  record it in a comment.

D-PL2-12 containment, recommended discriminator: `ownerRoots` = `[pluginClonesDir]`
when `record.resolvedSha !== undefined`, else `[marketplace.marketplaceRoot]`. Apply it
at both callers: dependency-index.ts:314-318 (`readInstalledCopy`, delisted) and
convergence.ts:446-449 (`installedCopyDeclarations`). This is "one owning root per
record", which covers git sources and tag-pinned path sources alike. Narrowing further
to "its own clone key" is not possible for a delisted git record: the key's left half
hashes the catalog source URL (`pluginCloneKey`, domain/clone-key.ts:38-41), which a
delisted record no longer has. [VERIFIED: domain/clone-key.ts:38-41]

### Pattern 3: One-scope MISS-01 seam (D-PL2-09/10)

Wiring path (all files read this session):

```
index.ts                       createApplyReconcile({ loadState })        (index.ts:90)
  + const installMissingDependencies = createScopeDependencyInstall({ loadState })   [new, in reconcile/apply.ts]
  └─ registerClaudePluginCommand(pi, { ..., applyReconcile, installMissingDependencies })
edge/types.ts EdgeDeps         + readonly installMissingDependencies: ScopeDependencyInstallFn
edge/register.ts               makeAddHandler(deps)            (register.ts:137)
                               makeBootstrapHandler(deps)      (register.ts:122)
                               makeMarketplaceUpdateHandler({ ..., installMissingDependencies })  (register.ts:141-145)
edge/handlers/marketplace/add.ts       Pick<EdgeDeps, "completionCache" | "gitOps" | "installMissingDependencies">
edge/handlers/plugin/bootstrap.ts      same Pick; passes to bootstrapClaudePlugin → addOptions
edge/handlers/marketplace/update.ts    passes to updateMarketplace / updateAllMarketplaces
orchestrators/types.ts         export type ScopeDependencyInstallFn = (args) => Promise<readonly UpdateDependencyRow[]>
orchestrators/marketplace/add.ts       AddMarketplaceOptions + optional seam; call after
                                       settleAddedMarketplace (add.ts:1097-1102), before the
                                       standalone notify (add.ts:1104-1119); never on alreadyAdded
                                       (add.ts:1076-1092) or failure arms
orchestrators/plugin/bootstrap.ts      thread into addOptions (bootstrap.ts:98-109)
orchestrators/marketplace/update.ts    after cascadeAutoupdates (update.ts:815), filter
                                       dependents to the refreshed marketplace; rows appended
                                       to the cascade block's plugins (update.ts:904-907)
```

- Seam type: put it in `orchestrators/types.ts` beside `PluginUpdateFn`
  (orchestrators/types.ts:607-611). Return `readonly UpdateDependencyRow[]`, the existing
  union `PluginInstalledMessage | PluginPartiallyInstalledMessage | PluginUpdatedMessage
  | PluginFailedMessage` (orchestrators/types.ts:330-334) whose rows are "named by their
  full keys as install's cascade rows are" (orchestrators/types.ts:310-315). That gives
  `add` and `marketplace update` one row shape, keeps `add`'s notification `Single`
  (one block, child rows named `lib@other`), and needs no new message kind.
- Inputs: `{ ctx, run, scope, cwd, dependents?: (dependentKey: string) => boolean }`.
  The implementation (in `reconcile/apply.ts`, beside `createApplyReconcile`) runs the
  narrow read (Pattern 1, "Post-move bucket" option b) to get
  `pluginsToDependencyInstall`, filters entries whose `declarers` satisfy `dependents`
  (autoupdate: declarers in the refreshed marketplace), runs the existing private
  `applyDependencyInstalls`, and maps its `PerEntryOutcome`s to `UpdateDependencyRow`s.
  `PlannedDependencyInstall` carries `declarers` (reconcile/types.ts:189-197), so the
  filter needs no new planner field.
- Eligibility: reuse D-09-01 as is (`isEligibleDependencyInstallDependent`,
  plan.ts:731-760: enabled, marker-held, or config-enabled records). Upstream's E1 input
  is "dependency-unsatisfied with reason not-found from enabled plugins only"; a
  marker-held record is still enabled in its config, so the two agree.
- Rendering: `ADD_CONTEXT.rowPolicies` has only `failed: { markers: false, contentReasons: true }`
  (add.messaging.ts:18-23); add `installed: { markers: true, contentReasons: true }` (and
  `partially-installed` if the seam can return it). `UPDATE_CONTEXT` already has
  `installed: { markers: true, contentReasons: true }` (update.messaging.ts:35-42).
- Lock rule: `addMarketplace` releases its state lock before `settleAddedMarketplace`
  returns; the seam's read and each `installMissingDependency` take their own lock
  (CR-01). Never call the seam inside `runAddInGuard`.
- Skip conditions: `apply`'s own reconcile-driven adds (`applyMarketplaceAdds`) and
  `import`'s adds must not pass the seam (they run their own steps).

### Recommended file touch list

| File | Change | Phase file list? |
|---|---|---|
| `orchestrators/reconcile/apply.ts` | reorder (Pattern 1 D); export `createScopeDependencyInstall` | yes (shared with Phases 6, 7: touch only `applyPlan`, `convergeScope`, `refreshTogglePlan`, `cascadeRows` placement, the new factory) |
| `orchestrators/reconcile/convergence.ts` | shared planner helpers, `scheduled` in release loop, `enablesAfterInstalls` | yes |
| `orchestrators/reconcile/dependency-verdict.ts` | `scheduled` option, `releasableDependents` arm, stale comment fix | yes |
| `orchestrators/reconcile/read-pass.ts` | use the shared planner; narrow bucket read export | yes |
| `orchestrators/reconcile/pending.ts` | use the shared planner; pass `enablesAfterInstalls` to projection | yes |
| `orchestrators/reconcile/notify.ts` | pending projection order | **no — add** |
| `orchestrators/reconcile/types.ts` | `ScopeReadResult.enablesAfterInstalls` | **no — add** |
| `orchestrators/plugin/dependency-index.ts` | installed-first reader + detail walk; D-PL2-12 root; D-PL2-05 comments | yes |
| `orchestrators/plugin/dependency-declaration-read.ts` | doc/containment comment (roots now single) | yes |
| `orchestrators/plugin/update-constraint-gate.ts` | `REAL_UPDATE_CONSTRAINT_SEAM` uses the installed walk | yes |
| `orchestrators/plugin/enable-disable.ts` | `enableCascadeLookup` reader swap only | shared with Phase 1 |
| `orchestrators/marketplace/add.ts`, `add.messaging.ts` | seam option + rows | add.ts yes; add.messaging.ts **add** |
| `orchestrators/marketplace/update.ts` | seam after `cascadeAutoupdates` | listed in CONTEXT specifics |
| `orchestrators/plugin/bootstrap.ts` | thread seam | yes |
| `orchestrators/types.ts`, `edge/types.ts`, `edge/register.ts`, `index.ts`, `edge/handlers/marketplace/{add,update}.ts`, `edge/handlers/plugin/bootstrap.ts` | seam wiring | listed in CONTEXT specifics |

### Anti-Patterns to Avoid

- **Running a released enable in the toggle step or the cascade.** It is refused with
  `dependency unsatisfied` while its scheduled dependency is still missing
  (enable-disable.ts:816-821) and produces a spurious `(failed)` enable row; inside the
  cascade it also turns a landed move into a `(failed)` move with `restorePin`
  (apply.ts:1452-1476).
- **Pushing MISS-01 rows straight into `outcomes` inside `convergeScope`'s `try`.** They
  print before the move rows (cascade rows are pushed in the `finally`).
- **A pending-only fix.** D-PL2-02 forbids it; `pending` already special-cases
  `withPlannedInstallsLanded`, which is exactly the drift that caused PENDMOVE-01.
- **Re-driving a round-1 config install from a fresh plan.** `refreshTogglePlan`'s
  contract (apply.ts:739-761) takes only toggle buckets; the post-move bucket read must
  take only `pluginsToDependencyInstall`.
- **Editing `constraint-fold.ts`.** Phase 3 owns it; the gate seam suffices.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Missing-dependency install for add/autoupdate | a second install loop | `applyDependencyInstalls` (apply.ts:657-737) via `createDependencyInstallOperation` (operations.ts) | it already handles skipped/installed/failed, D-09-09 member rows, warnings, MCP notices |
| "Installs landed" release | new fixpoint | `releasedDependents` + `withPlannedInstallsLanded` (pending.ts:282-350) | proven by the D-21 pending cases |
| Scheduled-present verdict | a new walk | `propagateUnsatisfied(..., scheduled)` (dependency-verdict.ts:299-328) | already supports `scheduled` |
| Installed copy read | own `readFile` | `readInstalledCopyDeclaration` (dependency-declaration-read.ts:373-388) | NFR-10 containment, fixed-detail refusal, D-01-32 parse |
| Dependency row shape for add/update | new message kind | `UpdateDependencyRow` (orchestrators/types.ts:330-334) | update cascade already renders it |
| Git-copy detection | parsing paths | `record.resolvedSha` + `isPinnedCopy` (convergence.ts:906-916) | reliable since 0.9.0 |

## Runtime State Inventory

Not a rename/migration phase. State-shape note: no `state.json` schema change is
needed (no new record field). Stored data: none; live service config: none;
OS-registered state: none; secrets/env vars: none; build artifacts: none — verified by
reading `PLUGIN_INSTALL_RECORD_SCHEMA` (state-io.ts:91-164); DECLREC-01 (which would
add a field) is deferred.

## Common Pitfalls

### Pitfall 1: Enables that wait on MISS-01
**What goes wrong:** the shared planner releases a marker-held or config-enabled record because a scheduled install satisfies it; the toggle step or the cascade enables it before MISS-01 → refused.
**How to avoid:** `enablesAfterInstalls` (Pattern 1 C); run them after MISS-01 behind a re-read.
**Warning signs:** a `(failed) {dependency unsatisfied}` enable row in an `apply` that also installs a dependency.

### Pitfall 2: Row order drift between `apply` and `pending`
**What goes wrong:** D-PL2-03 compares whole ordered tables; apply's order is push order, pending's is projection order.
**How to avoid:** fix both orders explicitly (Pattern 1 D/E) and assert both tables in the same scenario.

### Pitfall 3: `ran: false` judgement over a stale state
**What goes wrong:** `judgeScopeAfterCascade` reuses `before.state` when `ran` is false (apply.ts:1601); after MISS-01 installed something with no cascade step, the judgement would judge the pre-install state and disable a dependent that is now satisfied.
**How to avoid:** set `ran` when MISS-01 or a post-install enable changed anything.

### Pitfall 4: Tests that count `loadState` calls
**What goes wrong:** apply.test.ts:6163-6235 fails the SECOND project `loadState` to simulate a failing D-09-07 re-read; after the reorder the second call is `convergeScope`'s planning read (apply.ts:1176) and the test's meaning changes (and `deploy-kit` is no longer stamped by round-1 toggles because it is released by the scheduled install).
**How to avoid:** rewrite that case to fail the post-MISS-01 re-read and assert the new contract (MISS-01 row kept, `state.json` row added, judgement still runs).

### Pitfall 5: Pre-existing pending/apply disagreement in the D-21 table
**What goes wrong:** pending.test.ts case "a dependency the user disabled, the config enables and the check holds down" expects `vault (will install)`, `app (will disable)`, `core (will enable)`. Today's `apply` for that shape (MISS-01, then a refresh where `core` is enabled) does not disable `app`. Under the new order `core`'s enable is withheld until after MISS-01, so the pre-move toggle step WOULD disable `app` (its dependency `core` is user-disabled, which `releasedDependents` never releases, pending.ts:289-294).
**How to avoid:** decide explicitly. Either count a record the plan enables as not independently disabled in `releasedDependents`, or accept the disable and update the expectation. Do not let the order of this table change silently.

### Pitfall 6: "Source kind" is not on the record
**What goes wrong:** D-PL2-12 says "marketplace clone for `path` sources, `plugin-clones/` for git". A delisted record has no catalog entry to read a kind from, and a tag-pinned path-source dependency legitimately lives under `plugin-clones/` (clone-cache.ts:887-937). Keying on "path → marketplace root" would refuse that copy, the walk would fail closed (`not in manifest`), and D-PL2-05 would then stop the whole scope's dependency check.
**How to avoid:** discriminate on `record.resolvedSha` (present → `pluginClonesDir`; absent → `marketplaceRoot`). Update D-PL2-12's wording in the plan, and fix the existing unit fixture at dependency-index.test.ts:893-925, whose git record has no `resolvedSha`.

### Pitfall 7: The installed manifest file itself is not containment-checked
**What goes wrong:** `assertPathInside(ownerRoot, pluginRoot)` checks segments only down to `pluginRoot` (path-containment.ts:122-142). The candidate files `.claude-plugin/plugin.json` and `plugin.json` (`MANIFEST_CANDIDATES`, domain/manifest-path.ts:43-46) are read with `stat`/`readFile`, which follow symlinks (dependency-declaration-read.ts:116-118, :125-129). So CONTEXT's "the symlink half is stale" is only true down to the plugin root. Upstream (E5) realpaths the manifest and requires it to stay inside the plugin dir.
**How to avoid:** either add `assertPathInside(pluginRoot, candidate)` before the read in the installed-copy path only (refuses any symlinked manifest — stricter than upstream, consistent with D-14 "refuse all symlinks"), or record the residual explicitly. Ask before choosing (Open Question 2).

### Pitfall 8: NFR-5 and add-time MISS-01
**What goes wrong:** a path-source `marketplace add` that installs a git-source missing dependency can clone on a cache miss. NFR-5 says "path-source operations MUST NOT touch the network" and lists git-source `marketplace add` and git-source plugin installs as the network cases.
**How to avoid:** treat it as a git-source plugin install (allowed on cache miss) and record an NFR-5 amendment note with the decision ID (as D-MF-04 and AAP-D1 did), or confirm with the user.

### Pitfall 9: fallow duplication and complexity
**What goes wrong:** a second copy of the detail walk, or of the toggle loop, is a clone group (`fallow dupes` fails on every group); `convergeScope` and `applyPlan` are near the cognitive ceiling of 15 in both ESLint and fallow.
**How to avoid:** parametrize the walk; extract the post-cascade MISS-01 + enable block into its own function.

## Code Examples

### `scheduled` through the satisfaction verdict

```typescript
// Source: dependency-verdict.ts:70-83, 334-350 (existing); proposal adds `scheduled`
export interface ScopeSatisfactionOptions {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly reader?: DependencyDeclarationReader;
  readonly loadManifest?: typeof loadMarketplaceManifest;
  readonly seeded?: readonly UnsatisfiedDeclaration[];
  /** D-PL2-02: keys the same `apply` installs, which a declaration naming them counts as met. */
  readonly scheduled?: ReadonlySet<string>;
}
// buildScopeSatisfactionVerdict: propagateUnsatisfied(detail.declarations,
//   recordedPlugins(options.state), options.seeded ?? [], options.scheduled)
```

### Release loop with scheduled installs

```typescript
// Source: convergence.ts:879-903 (existing shape)
const plan = input.replan(verdictWithout(input.verdict, released));
const cascade = await planConvergenceCascade({ ...base, plan });
const scheduled = new Set(
  [...plan.pluginsToInstall, ...plan.pluginsToDependencyInstall].map(
    (op) => `${op.plugin}@${op.marketplace}`,
  ),
);
const after = await verdictAfterMoves(
  { state: input.state, locations: input.locations, scheduled },
  { enable: plan.pluginsToEnable, disable: plan.pluginsToDisable },
  cascade.plan.moves,
);
```

### Existing seam the update gate already forwards

```typescript
// Source: update-constraint-gate.ts:82-86 and :241 (verbatim)
const REAL_UPDATE_CONSTRAINT_SEAM: UpdateConstraintSeam = Object.freeze({
  buildScopeDeclarationDetail,
  probeDependencyTags,
  probeMarketplaceTags,
});
// ...
const verdict = await evaluateCatalogConstraint({ ...options, seam });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MISS-01 before toggles, refresh only after MISS-01 (D-09-07) | refresh also after a config install (261026-c06, 3dc6c124) | 2026-10-26 | the c06 refresh stays; the MISS-01 refresh moves after the cascade |
| apply judged only planned toggles | APPLY1-D1 final-state judgement (`judgeFinalScope`) | before this milestone | RCN-03 is already met; the judgement stays last |

**Deprecated/outdated:** the D-09-07 scope note "re-plan only after a dependency install" (superseded per D-PL2-04); the `dependency-verdict.ts:35-42` comment "disables it on the next reload" (the load no longer disables, APL-D1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The post-cascade refresh and narrow bucket read add no measurable cost for a steady-state `apply` when gated on "a step ran / something landed" | Pattern 1 D | WR-08 lock window grows; measure with the NFR-5 call-count test |
| A2 | Rendering add-time MISS-01 rows as key-named child rows of the added marketplace's block is acceptable output (as update's dependency rows) | Pattern 3 | if the user wants per-marketplace blocks, `add` needs `Plural` cardinality |
| A3 | Marker-held dependents that the add-time MISS-01 satisfies may stay disabled until the next `apply` (the seam installs, it does not lift) | Pattern 3 | parity gap with upstream's post-add reload; see Open Question 3 |
| A4 | `update` and `apply` may disagree about a holder whose installed copy differs from its catalog entry (gate vs converge readers) | Pattern 2 | a range `update` holds may move under `apply`; document or extend later |

## Open Questions

1. **D-PL2-12 wording.** What we know: no record field holds the source kind; `resolvedSha` is reliable and tag-pinned path sources live under `plugin-clones/`. Recommendation: plan with the `resolvedSha` discriminator and note the amended wording in the plan's decision log.
2. **Symlinked manifest inside the installed copy** (Pitfall 7). Recommendation: refuse via `assertPathInside(pluginRoot, candidate)` in the installed-copy read only; confirm with the user since CONTEXT calls the symlink half stale.
3. **Add-time lift.** Should the D-PL2-09/10 seam also lift a marker-held dependent it satisfied (apply's post-install enable step)? Recommendation: no (keep D-PL2-09 as written); `pending` will list the `(will enable)` and `apply` makes it.
4. **Pitfall 5 case.** Decide whether a config-enabled user-disabled dependency counts as released.
5. **NFR-5 note for add-time MISS-01** (Pitfall 8): record an amendment line or ask.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all checks | ✓ | v26.12.1 | — |
| npm | scripts | ✓ | 11.20.0 | — |
| node_modules | tests, cucumber | ✓ (installed in this worktree) | — | `npm ci` |
| cucumber stand-ins (https git host, headless Pi) | features | ✓ (probe ran) | — | — |

**Missing dependencies:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| Config file | `cucumber.json` (imports `features/support/**/*.ts`, `features/step_definitions/**/*.steps.ts`, `parallel: 8`) |
| Quick run command | `node --test <test-path>`; `npx cucumber-js --name '<scenario title>'` |
| Pair coverage | `npm run test:coverage:direct -- <source-or-test-path>` (100% line/function/branch) |
| Full suite command | `npm run check` (static, unpaired, integration, cucumber, direct coverage all pairs) |
| Feature-file gate | `npm run check:features` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RCN-01 | PENDMOVE-01: pending rows = apply rows (zcore, widget updated; extra installed after); second pending empty | cucumber | `npx cucumber-js --name 'Apply moves a plugin whose moved dependency needs a missing plugin, as pending lists it'` (title is a suggestion) | ❌ new in `features/plugin/apply.feature` |
| RCN-01 | release loop counts scheduled installs | unit | `node --test test/orchestrators/reconcile/convergence.test.ts` | ✅ add cases |
| RCN-01 | `verdictAfterMoves`/`releasableDependents` with `scheduled` | unit | `node --test test/orchestrators/reconcile/dependency-verdict.test.ts` | ✅ add cases |
| RCN-02 | MISSORDER-01: apply moves ycore/widget, then installs newdep; pending same order | cucumber | `npx cucumber-js --name 'Apply installs a missing dependency that needs the version the same apply moves to'` | ❌ new |
| RCN-02 | MISS-01 after cascade; rows between step rows and judgement rows; post-install enables | unit | `node --test test/orchestrators/reconcile/apply.test.ts` | ✅ update D-09-07/MISS-02 cases, add order case |
| RCN-02 | pending projection order | unit | `node --test test/orchestrators/reconcile/notify.test.ts` and `.../pending.test.ts` | ✅ update |
| RCN-03 | keeper disabled in same apply | cucumber (existing, retitle) | `npx cucumber-js --name '<retitled apply.feature:749 title>'`; mutation: stub the `applyDependencyDisables` call in `judgeScopeAfterCascade` locally, run, confirm FAIL, revert | ✅ |
| RCN-04 | first unreadable record ends each walk | unit | `node --test test/orchestrators/plugin/dependency-index.test.ts` (existing :596, :743), `node --test test/orchestrators/reconcile/dependency-verdict.test.ts` (:999) | ✅ cite D-PL2-05 |
| RCN-05 | enable follows installed copy (git-source) | cucumber | `npx cucumber-js --name 'Enabling a git-source plugin enables the dependency its installed copy declares'` | ❌ new in `features/plugin/enable.feature` |
| RCN-05 | update held by installed holder range | cucumber | `npx cucumber-js --name 'Updating a dependency is held by the range a git-source plugin's installed copy declares'` | ❌ new in `features/plugin/update-dependencies.feature` |
| RCN-05 | installed-first reader arms (found / unusable / absent→catalog) | unit | `node --test test/orchestrators/plugin/dependency-index.test.ts`; `.../enable-disable.test.ts`; `.../update-constraint-gate.test.ts` | ✅ add cases |
| RCN-06 | `marketplace add` installs a missing dependency it now offers | cucumber | `npx cucumber-js --name 'Adding a marketplace installs the missing dependency of an installed plugin that it offers'` | ❌ new in `features/marketplace/add.feature` |
| RCN-06 | bootstrap does the same in the user scope | cucumber | new scenario in `features/plugin/bootstrap.feature` (fixture: `the marketplace "..." is published as the official marketplace`) | ❌ new |
| RCN-06 | autoupdate installs a missing dependency after the plugin updates | cucumber | new scenario in `features/plugin/update-dependencies.feature` or `features/marketplace/update.feature` | ❌ new |
| RCN-06 | seam wiring | unit | `node --test test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/plugin/bootstrap.test.ts test/edge/handlers/marketplace/add.test.ts test/edge/handlers/marketplace/update.test.ts test/edge/handlers/plugin/bootstrap.test.ts test/edge/register.test.ts test/index.test.ts` | ✅ update |
| RCN-07 | refusal row kept | cucumber (existing) | `npx cucumber-js --name "Apply refuses a missing anthropic-plugin-directory dependency whose listed copy falls outside a plugin's range, naming that plugin"` | ✅ (order must stay) |
| RCN-08 | path record under plugin-clones and git record under the marketplace clone both fail closed | unit | `node --test test/orchestrators/plugin/dependency-declaration-read.test.ts test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/reconcile/convergence.test.ts` | ✅ add cases |

### Cucumber fixture notes
- Shapes T1/T2 use only existing steps: `the marketplace {string} is published as a {source kind} source`, `the marketplace {string} offers these plugins with dependencies:`, `the marketplace {string} is added to the {word} scope`, `the user has run {string}`, `the user runs {string}`, `the result lists these plugins:`, `the installation record of the {word} scope holds these plugins:`, `the result has these fields:` [CITED: grep of features/step_definitions/marketplace/publishing.steps.ts, command.steps.ts, plugin/installation.steps.ts]. The probe confirmed these produce the rows in §Traces.
- Git-source enable/update scenarios: `the git repository {string} holds these plugins:` (a second call pushes a new revision; a last `dependencies` column writes `plugin.json` dependencies, features/lib/git-plugin.ts:80-111) and `the marketplace {string} offers these plugins from git repositories:` with `| name | source kind | repository | pinned |`. A git offer's marketplace entry carries no `dependencies` (`GitPluginEntry` is `name` + `source`, features/lib/git-plugin.ts:72-75), so with `pinned true` re-offered at revision 2 the catalog read finds no cached rev-2 clone and answers the entry's (empty) list, while the installed rev-1 copy declares the dependency — exactly the difference to prove. Disable order: dependent first, then dependency (enable.feature:169-200 template).
- Cross-marketplace add scenario: `the marketplace {string} allows dependencies on the marketplace {string}` exists (publishing.steps.ts:134-138). Shape: install `app@tools` declaring nothing, re-offer `app` declaring `lib@other`, allow `other`, publish `other` offering `lib`, `marketplace add {home}/marketplaces/other --scope project`; assert the add result rows and the record. No new step is expected; if the add result needs a plugin child table, `the result lists these plugins:` already reads child rows.
- Autoupdate shape: re-offer the dependent at the SAME version with a new dependency, so the plugin update cascade reports it unchanged and only MISS-01 installs the dependency.

### Sampling Rate
- Per task commit: the owner tests plus `npm run test:coverage:direct -- <each touched source>`; the hook runs `npm run check:commit`.
- Per wave merge: `npm run check`.
- Phase gate: `npm run check` green, plus `npm run check:features`.

### Wave 0 Gaps
- None for infrastructure. New scenarios go into existing feature files; any new step must live in the step module its layout rule names (`.agents/skills/cucumber/rules/layout.md`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (credentials untouched; MISS-01 git clones reuse `auth-host.ts`) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes, scope isolation | add-time MISS-01 limited to the add's scope (SC-1 / D-29) |
| V5 Input Validation | yes | `parseDeclaredDependencies`, typebox validators, fail closed (D-05-07) |
| V12 Files and Resources | yes | `assertPathInside` single root (NFR-10, D-PL2-12); Pitfall 7 |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Recorded `resolvedSource` pointing into another owner's tree | Tampering / Info disclosure | one owning root per record (`resolvedSha` discriminator) |
| Symlinked `plugin.json` inside an installed copy | Tampering | refuse via `assertPathInside(pluginRoot, candidate)` or record residual |
| Unexpected network from a path-source add | Info disclosure / policy | NFR-5 amendment or confirmation (Pitfall 8) |
| Corrupt declarer silently ignored | Tampering | keep whole-scope fail-closed (D-PL2-05) |

## Sources

### Primary (HIGH confidence)
- Codebase files read this session: `orchestrators/reconcile/{apply,convergence,dependency-verdict,pending,read-pass}.ts`, `reconcile/plan.ts:425-1059`, `reconcile/notify.ts:130-360, 690-810, 1430-1469`, `reconcile/types.ts:189-197, 424-449`, `plugin/{dependency-index,dependency-declaration-read,update-constraint-gate,bootstrap}.ts`, `plugin/constraint-fold.ts:340-425`, `plugin/enable-disable.ts:530-840`, `plugin/git-source-probe.ts:150-269`, `plugin/clone-cache.ts:860-937`, `plugin/update-flow.ts:1262-1384`, `plugin/update-preflight.ts:160-185, 1015-1045`, `marketplace/add.ts:120-254, 1036-1143`, `marketplace/update.ts:480-679, 747-921`, `marketplace/{add,update}.messaging.ts`, `persistence/state-io.ts:76-175`, `shared/path-containment.ts:60-149`, `domain/clone-key.ts`, `edge/{types,register}.ts`, `edge/handlers/{marketplace/add,marketplace/update,plugin/bootstrap}.ts`, `index.ts`, `eslint.config.js:10-90, 470-545`.
- Cucumber probe run of T1/T2 against the current code (this session).
- `.agents/skills/{cucumber,local-verification,committing}` rules.

### Secondary (MEDIUM confidence)
- `.planning/BACKLOG.md` entries PENDMOVE-01, MISSORDER-01, UPDDEP-01, LCORCH-01, STALE-DECLARER-01, ENDEPS-01, MISS-MPADD-01, PARITYGV-01, RECON-REPLAN-01; quick task 261026-c06 SUMMARY.
- Upstream evidence E1-E6 as recorded in 02-CONTEXT.md (not re-researched, per instructions).

## Metadata

**Confidence breakdown:**
- Current behavior and root causes: HIGH (code read plus a live run of both shapes)
- Proposed restructure: MEDIUM (consistent with the code, but untested; Pitfalls 1, 3, 5 are the risk points)
- Seam wiring and containment: HIGH for facts, MEDIUM for row rendering choices (A2, A3)

**Research date:** 2026-10-26
**Valid until:** 2026-11-25, or earlier if Phases 1, 3, 5, 6 or 7 land changes in `apply.ts`, `enable-disable.ts`, `marketplace/add.ts` or `constraint-fold.ts`

# Phase 2: Apply Ordering and Installed Declarations - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning
**Mode:** autonomous smart discuss (parallel wave-1 session; decisions taken without user prompts per the milestone's shared rules)

<domain>
## Phase Boundary

`pending` previews exactly what `apply` does, one `apply` settles a missing
dependency that needs a version the same `apply` moves to, and the dependency
declarations of an installed plugin come from its installed copy where one
exists. Requirements RCN-01..RCN-08; backlog PENDMOVE-01, MISSORDER-01,
RECON-REPLAN-01, STALE-DECLARER-01, ENDEPS-01, UPDDEP-01 b3, MISS-MPADD-01,
PARITYGV-01 b4, LCORCH-01 b6.

Owned files (ROADMAP `Files`): `orchestrators/reconcile/{apply,pending,convergence,dependency-verdict,read-pass}.ts`,
`orchestrators/plugin/{dependency-index,dependency-declaration-read,update-constraint-gate}.ts`,
`orchestrators/marketplace/{add,autoupdate}.ts` (dependency step only),
`orchestrators/plugin/bootstrap.ts`; `enable-disable.ts` (`enableCascadeLookup`
only; Phase 1 owns its warning surface). Sibling phases edit `apply.ts`
(Phase 6 failed-install row, Phase 7 clone cleanup) and `marketplace/add.ts`
(Phase 5 classification, reserved names): touch only the functions named here.

</domain>

<upstream_evidence>
## Claude Code evidence (binary 2.1.310, `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`, grepped 2026-10-26; docs plugins/dependencies.md, troubleshooting.md, host-marketplace.md, plugins-reference fetched the same day)

Minified names: `bae` = resolveMissingDependencies, `lsn` = installResolvedPlugin,
`o3s` = resolveDependencyClosure, `s3s` = load-time dependency check (demotes),
`gNe` = load all plugins, `VJ` = read manifest, `smn` = enable closure,
`r3s` = updatePluginOp's dependents scan, `a3s` = prune orphan scan.

- **E1 Call sites of resolveMissingDependencies** (high): `/reload-plugins`;
  `claude plugin marketplace add` and the `/plugin` marketplace-add screen
  (over ALL enabled plugins, skipped only for deep-link adds); `/plugin` after an
  install (`activatePluginsAfterInstall`); background autoupdate (after the
  marketplace refresh and the plugin updates, only for declarers whose
  marketplace has autoupdate on); re-running `install X` on an installed X whose
  only load errors are missing dependencies. Never on a fresh CLI install, an
  explicit `update`, enable/disable, uninstall, or plain session-start load.
  Input filter: `dependency-unsatisfied` with reason `not-found` from enabled
  plugins only.
- **E2 Declarations source** (high): every load reads
  `<installPath>/.claude-plugin/plugin.json` (`VJ`); the install record has no
  dependency field; the catalog entry stands in only when plugin.json is
  missing. Enable (`smn`) and update's dependents scan (`r3s`, disabled holders
  included, `pinner_blocked`) read the loaded plugins' installed manifests.
- **E3 Failure reporting** (high): inside `bae` only debug/warn log lines
  (`install of "<id>" did not complete (<reason>)`); `pOt` callers print
  `N dependencies still unresolved: X`; elsewhere the dependent just stays
  disabled with `Dependency "<dep>" is not installed`.
- **E4 Order and range conflict** (high): the missing dependency's install
  refuses when an enabled installed dependency is outside its range
  (`range-conflict` / `installed-unsatisfied`); it does not move it.
  Autoupdate, the only flow with both steps, runs the plugin updates FIRST,
  then reload, then `bae`.
- **E5 Delisted plugins** (high): not loaded at all (`plugin-not-found`);
  install path checked textually against cache/seed/marketplace-source roots;
  manifest symlinks resolved with realpath and must stay inside the plugin dir.
- **E6 One unreadable plugin.json** (high): that plugin is skipped, the check
  continues for the rest (`Promise.allSettled`), its dependents see it as
  `not-found`; prune and the post-uninstall orphan scan abort for the whole
  scope.

</upstream_evidence>

<decisions>
## Implementation Decisions

### Apply ordering (RCN-01, RCN-02: PENDMOVE-01, MISSORDER-01)

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

### Config-dropped dependency (RCN-03: RECON-REPLAN-01)

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

### Unreadable declarer failure unit (RCN-04: STALE-DECLARER-01)

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

### Installed-copy declarations (RCN-05: ENDEPS-01, UPDDEP-01 b3)

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

### Missing dependencies after marketplace add, bootstrap, autoupdate (RCN-06: MISS-MPADD-01)

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

### MISS-01 refusal report (RCN-07: PARITYGV-01 b4)

- **D-PL2-11 — Keep the failed row; record the difference.** `apply` (and the
  D-PL2-09/10 call sites) render a MISS-01 refusal as a `(failed)` row with the
  cause, where Claude Code's `bae` only logs (E3) and the dependent stays
  disabled. Licensed by APL-D1 (`apply` is the explicit command that reports
  every change it attempts) and the project's row grammar; the dependent's
  `disabled {dependency unsatisfied}` row matches upstream's visible state. ID
  D-PL2-11 closes PARITYGV-01 b4.

### Delisted installed-copy containment (RCN-08: LCORCH-01 b6)

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

</decisions>

<code_context>
## Existing Code Insights

- `apply.ts` `applyScopes` (1818-1855) → `applyAndConverge` (1858-1876) =
  `applyPlan` (1128-1145: uninstalls, mp removes, mp adds, installs with
  `dependencyInstallsFollow: true`, `applyDependencyInstalls` MISS-01 at 1139,
  `refreshTogglePlan` 1140-1141, `applyToggleSteps` 1142) then `convergeScope`
  (1165-1217: `planConvergenceCascade`, `runCascade`, `judgeScopeAfterCascade`
  1593-1640 → `judgeFinalScope` with no `scheduled`). Nothing re-runs MISS-01
  after the moves; `createConvergeOperation` omits `resolveDependencies`.
- `convergence.ts`: `withPlannedInstalls` (217-254) treats both install buckets
  as enabled planned records; `judgePlannedScope` (814-872) passes `scheduled`;
  `releaseOnLandedMoves` (879-903) calls `verdictAfterMoves`
  (dependency-verdict.ts:497-516) WITHOUT `scheduled` and `releasableDependents`
  (439-460) treats every `missing` as blocking — the PENDMOVE-01 cause.
  `pending.ts` fallback `planConvergence(plan: settled.plan)` (536-539).
- MISSORDER-01 cause: `installMissingDependencyWithTransaction`
  (install-flow.ts:3018-3190) → `runInstallCascade` fails `constraint-failed`
  on a recorded member outside range (install-cascade.ts:1653-1665).
- `readRecordDeclarations` (dependency-index.ts:249-297): listed git record is
  read at the CATALOG's sha clone or mirror; delisted → `readInstalledCopy`
  (304-319). Early returns at 344-346, 368-370; `judgeFinalScope` 576-579.
  Callers listed in the analysis: `withPlannedInstalls`, `judgeFinalScope`,
  `enableCascadeLookup` (enable-disable.ts:645), `localLayerCoverage`
  (plugin/shared.ts:920); detail: verdict, `planConvergenceCascade`,
  `evaluateCatalogConstraint` (constraint-fold.ts:409, seam 389-391),
  `REAL_UPDATE_CONSTRAINT_SEAM` (update-constraint-gate.ts:82-86); index:
  remove.ts, enable-disable `readEnabledDependents`, prune, uninstall.
- Containment: `isInsideAnyRoot` (dependency-declaration-read.ts:347-362) gets
  `[marketplaceRoot, pluginClonesDir]` from dependency-index.ts:314-318 and
  convergence.ts:446-449.
- `applyDependencyInstalls` (apply.ts:657-737, not exported) binds
  `createDependencyInstallOperation` (operations.ts:108-113) →
  `createInstallMissingDependency` (install-flow.ts:3197).
- Seams: `EdgeDeps` (edge/types.ts:28-53) carries `applyReconcile`;
  handlers `makeAddHandler` (edge/handlers/marketplace/add.ts:29-31),
  `makeBootstrapHandler` (edge/handlers/plugin/bootstrap.ts:37-38),
  `makeMarketplaceUpdateHandler` (register.ts:141-145);
  `cascadeAutoupdates` (marketplace/update.ts:566-600) with injected
  `pluginUpdate`. BLOCK C forbids marketplace→plugin-ledger imports; add.ts
  importing apply.ts or operations.ts would form cycles.
- Features: `features/plugin/apply.feature` dependency scenarios 192-1179;
  keeper/orphan at 749; fixture builders in `features/lib/path-marketplace.ts`
  (dependency cell syntax `lib@^2.0.0`), `features/lib/published-marketplace.ts`,
  git repositories via `features/step_definitions/plugin/publishing.steps.ts`.

</code_context>

<specifics>
## Specific Ideas

- Success criterion 1 needs both shapes' `pending` rows to equal `apply`'s rows
  and a clean second `pending`/`apply`.
- Files outside the `Files` line this phase expects to touch, with reason:
  `index.ts`, `edge/types.ts`, `edge/register.ts`,
  `edge/handlers/marketplace/add.ts`, `edge/handlers/plugin/bootstrap.ts`,
  `orchestrators/types.ts`, `orchestrators/marketplace/update.ts`
  (`cascadeAutoupdates` only) — the injected MISS-01 seam (D-PL2-09/10), since
  BLOCK C and import cycles forbid a direct call.

</specifics>

<deferred>
## Deferred Ideas

- DECLREC-01 (new backlog candidate): record each install's dependency
  declarations in `state.json` so path-source records keep their installed
  declarations, and move the load verdict and uninstall guard to installed
  declarations for full E2 parity.
- Running the add-time MISS-01 over every scope, as upstream does.

</deferred>

## Uncertain choices (for user review)

1. **D-PL2-01 order** — chose MISS-01 after the moves (one step); alternative:
   keep it before and run it again after the moves. Why: upstream E4 order and
   one row per attempt.
2. **D-PL2-04** — closing RECON-REPLAN-01 with the existing keeper/orphan
   scenario instead of a new one. Alternative: add a dedicated scenario. Why:
   the existing one already proves the behavior; duplication adds nothing.
3. **D-PL2-05** — keeping whole-scope fail-closed although upstream's load check
   skips one unreadable plugin (E6). Alternative: per-record walk for the load
   verdict only. Why: D-05-07 (Locked), fail-closed rule, upstream itself aborts
   the removal guards.
4. **D-PL2-06/07** — installed copy only for the enable closure and update
   preflight, git sources only; load verdict, uninstall guard and path sources
   stay catalog/tree-based. Alternative: switch the shared reader everywhere and
   record declarations in state. Why: RCN-05's wording, locked APPLY1-D1
   behavior, no retained path-source copy.
5. **D-PL2-09** — add-time MISS-01 over the add's scope only. Alternative: all
   scopes, as upstream. Why: SC-1/D-29 scope independence; an add with
   `--scope project` should not install into user scope.
6. **D-PL2-10** — autoupdate's MISS-01 is wired in `marketplace/update.ts`
   `cascadeAutoupdates` (outside `Files`). Alternative: in the edge handler.
   Why: Phase 8's background autoupdate reuses the cascade.
7. **D-PL2-11** — keep `apply`'s failed row for a MISS-01 refusal, where
   upstream only logs. Alternative: drop the row, keep only the dependent's
   disabled row. Why: APL-D1 explicit-command reporting.

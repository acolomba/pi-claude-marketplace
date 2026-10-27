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
  E2 refined 2026-10-27 (same binary): when the copy at the install path has
  no `plugin.json`, `VJ` returns a stub manifest with no `dependencies`, and
  `q9n` then replaces that manifest with the marketplace entry, so the entry's
  `dependencies` are the plugin's declarations. When a manifest is present, the
  entry adds display fields only. A gone copy is not read as absent: `z9n`
  downloads it again before it loads it, at the installed commit first, else
  from the source the marketplace lists. A failed download pushes `Failed to
  download/cache plugin`, and the plugin does not load.
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
  E5 refined 2026-10-27 (same binary): the manifest read lstats each segment of
  the manifest path below the plugin directory and checks nothing when none is
  a link. When one is, it realpaths the manifest and compares it against
  realpath'd boundary roots: the plugin directory for a cached copy, and the
  plugin and marketplace directories for a plugin loaded in place. Inside, it
  also checks that the spelled and the resolved path are one file (dev and
  inode). A link that escapes, or that cannot be resolved, is a containment
  error that fails the plugin's load; a dangling link (ENOENT or ENOTDIR, with
  `stat` also missing) is no manifest.
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
  **Amended 2026-10-27 (D-PL2-22):** a gone copy also answers from the entry alone.
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

### Amendments after research (2026-10-26)

- **D-PL2-12 (amended) — discriminator is `resolvedSha`.** Records carry no
  source-kind field. A record with `resolvedSha` (every git record since 0.9.0,
  and a tag-pinned path-source dependency, clone-cache.ts:887-937) owns
  `plugin-clones/` (its own clone-key directory); a record without it owns the
  marketplace clone. One root per record; the other root fails closed.
  **Amended 2026-10-27 (user decision):** a recorded copy root outside its
  owning root answers `unusable` (the D-05-07 refusal), not absent. Per
  caller: the delisted read fails `unreadable manifest`; the enable closure
  and the update preflight fail `{unreadable}` with no catalog read;
  convergence fails closed (D-PL2-25). A missing copy is still absent.
  **Amended 2026-10-27 (D-PL2-23):** the owning root follows `resolvedSha` together with where `resolvedSource` lies.
- **D-PL2-13 — Installed-copy manifest symlinks.** The installed-copy read also
  checks the manifest file itself with `assertPathInside(copyRoot, manifestPath)`,
  so a symlinked `plugin.json` is refused (project's NFR-10 convention). Claude
  Code (E5) follows a manifest symlink whose realpath stays inside the plugin
  dir; this is stricter, licensed by NFR-10. **Reversed 2026-10-27 by user
  decision:** the read follows a manifest link (chained, with absolute or
  relative text, on the manifest or on a directory above it) whose resolved
  target stays inside the record's owning root (D-PL2-12), and reads that
  resolved target. A link that escapes the owning root is refused as D-PL2-17.
  The boundary is the owning root: for a path-source record it equals Claude
  Code's in-place boundary (plugin and marketplace directories); for a git
  record (all of `plugin-clones/`) it is wider than Claude Code's
  plugin-directory boundary for a cached copy.
- **D-PL2-14 — A record the plan enables counts as released.** Under the new
  order, a dependent whose dependency the user disabled and the config
  re-enables is judged with that dependency enabled, so `apply` agrees with
  `pending` (pending.test.ts case "a dependency the user disabled, the config
  enables and the check holds down"). `pending` is the preview contract
  (APL-D1).
- **D-PL2-15 — NFR-5 note for add-time MISS-01.** `marketplace add` (any
  source kind), `bootstrap` and the autoupdate cascade may clone a git-source
  missing dependency on a cache miss, as any install may; warm sha-pinned
  caches stay offline. Recorded as an NFR-5 amendment for the parent to carry
  into PROJECT.md.
- **D-PL2-16 — Enables a scheduled install releases run after MISS-01.** Since
  enabling a record whose closure has an uninstalled member is refused
  (enable-disable.ts:816-821), marker lifts and config enables that depend on a
  MISS-01 install run after it (D-09-07 refresh position), not in the pre-move
  toggle step.
- **D-PL2-17 — A manifest link that containment refuses is unusable.** (user
  decision 2026-10-27) A manifest link whose resolved target leaves the owning
  root, or that cannot be resolved (a loop), answers `unusable`, the D-05-07
  fixed-detail refusal, not `absent`, and ends the candidate walk. Per caller:
  the installed-first read (`readInstalledRecordDeclarations`) fails closed
  with no catalog fallback, so enable and update fail `{unreadable}`; the
  catalog-first read of a delisted record fails as `unreadable manifest`
  instead of `not in manifest`, and the scope walk still ends (D-PL2-05);
  convergence's installed-copy fold is unchanged (every answer but `found`
  folds to the catalog declarations). A dangling link stays absence. The
  copy-root refusal (D-PL2-12) still answers absent. This matches Claude Code,
  whose load fails on an escaping manifest (E5 refined). **Amended 2026-10-27
  (user decision):** the boundary is Claude Code's, not the owning root: the
  plugin directory for a copy (a record or a source with a resolved or pinned
  commit: every git source and a tag-pinned path dependency), and the plugin
  directory plus its marketplace directory for a path plugin read in place.
  The installed-copy read uses it too, so a git record's link into another
  part of `plugin-clones/` is refused. The copy-root check (D-PL2-12) keeps
  the owning root. Claude Code copies a path plugin of a git-hosted
  marketplace into its cache, so its boundary there is the plugin directory;
  this extension reads such a plugin in place, with the wider in-place
  boundary.
- **D-PL2-18 — A waiting record's catalog move is its own step and its own
  row.** (user decision 2.12, 2026-10-27) It supersedes the one-row part of
  D-PL2-16, and for such a move it also supersedes WR-B's no-row rule.
  - The move of a record whose enable waits on the missing-dependency install
    is planned whether or not the enable comes. Internally the move and the
    enable stay one cascade step, marked `waiting`, because the steps are
    ordered by key and two steps with one key would collapse into one; each
    command turns the step into two rows. `apply` runs the move and the enable
    back to back, so WR-C still restores the pin when the enable fails.
  - On success, `pending` and `apply` list the same rows in the same order
    (D-PL2-02): the install, the move, then the enable (`apply` renders the
    enable as `(installed)`).
  - On failure or refusal, `pending` (which cannot foresee it) listed those
    three rows. `apply` reports the install's `(failed)` row (D-PL2-11), then
    the move as `(skipped) {dependency failed}`, and nothing for the enable.
    The record's version, enabled flag and marker do not change. A move that
    declares the record is skipped, or disabled by the judgement (WR-08). A
    dependent that the judgement disables takes the cascade's `{dependency
    failed}` remedy ("<record> did not update; run apply again once it can, or
    uninstall <dependent>"), not the LOAD-01 "Enable ..." remedy, because the
    blocked step joins the failed steps.
  - A growth-only move follows the same rule: its `(updated)` row with equal
    versions and `{components now supported}` comes before its enable row.
  - Deferred records in the cascade keep WR-02's one row.
  - Out of scope (WR-B): a held-down record whose waited-on catalog move
    fails still reports nothing for itself.
  - Proof: unit cases in `convergence.test.ts`, `notify.test.ts`,
    `pending.test.ts` and `apply.test.ts`; the `apply.feature` scenarios
    "Apply moves a held-down plugin and then enables it once the missing
    dependency it waits on is installed, as pending lists both" and "Apply
    reports the move of a held-down plugin as skipped when the install of the
    missing dependency it waits on is refused".
- **D-PL2-22 — An installed copy with no manifest answers from its marketplace
  entry alone.** (user decision 2026-10-27) When the installed-first read
  (`readInstalledRecordDeclarations`) reads a record that has `resolvedSha`,
  and the record's copy holds no manifest, the record declares what its
  marketplace entry's `dependencies` say, and nothing else. The catalog copy's
  own manifest is not read. The enable closure and the update preflight's
  holder walk use this read. A delisted record has no entry, so it still fails
  as `not in manifest` (D-05-07). A record without `resolvedSha` keeps the
  catalog read (D-PL2-07). This is Claude Code's rule for a copy with no
  `plugin.json` (E2 refined). A gone copy takes the same answer. Claude Code
  downloads a gone copy again and reads its `plugin.json`, but this read is
  offline (NFR-5) and cannot download, so the entry is the offline stand-in.
  This amends the gone-copy clause of D-PL2-06. Proof: unit cases in
  `dependency-index.test.ts` and the `enable.feature` scenario "Enabling a
  git-source plugin whose installed copy has no manifest enables the
  dependency its marketplace entry declares".
- **D-PL2-23 — One owning root per record, chosen by where its copy lies.**
  (user decision 2026-10-27; amends D-PL2-12) `installedCopyReadOptions` gives
  `plugin-clones/` as the owning root only when the record has `resolvedSha`
  and its `resolvedSource` lies under `plugin-clones/`. Such a copy is bounded
  by its plugin directory. Every other record owns its marketplace clone and is
  read in place, bounded by its plugin and marketplace directories (D-PL2-17).
  Clone GC uses the same test to find live clones.
  - The stale-sha path record: an older version could leave a path record with
    a `resolvedSha` that names no clone, and its files in the marketplace clone
    (the state that WR-01, WR-02 and WR-05 repair). It now reads its
    marketplace clone again. Its scope's updates and enables no longer fail
    `{unreadable}`, and an update repairs the record. This resolves 261027-a3r
    uncertain choice 1.
  - These still answer `unusable`: a copy under neither clone root, a
    symlinked path segment below the owning root, a manifest link that leaves
    the D-PL2-17 boundary, and a record without `resolvedSha` whose copy lies
    under `plugin-clones/`.
  - Rejected: the catalog entry's source kind. A delisted record has no entry,
    and the entry describes the marketplace's current listing, not the
    install, so a later change of source kind would move the owning root of an
    unchanged record.
  - Rejected: location alone, without `resolvedSha`. It would also admit a
    record with no commit under `plugin-clones/`, a shape no install writes
    (git sources and `resolvedSha` both arrived in 0.9.0, D-77-02).
  - Accepted consequence: a git record whose `resolvedSource` was edited to
    point into its own marketplace clone is now read there in place, still
    bounded by that clone. Records carry no source kind, so this shape looks
    the same as the legacy path record.
  - Evidence: Claude Code checks a recorded install path textually against its
    cache, seed and marketplace-source roots (E5), so a rule keyed on where the
    copy lies matches it.
  - Proof scope: unit cases only (`dependency-declaration-read.test.ts`,
    `dependency-index.test.ts`, `convergence.test.ts`, `update-swap.test.ts`).
    No supported command writes the legacy shape, and the cucumber harness has
    no step that writes installation records.
- **D-PL2-24 — Install-time manifest reads use the same containment.** (user
  decision 2026-10-27) One helper, `domain/manifest-containment.ts`
  (`locateManifestCandidate`), locates every plugin manifest candidate inside
  the D-PL2-17 boundary for the readers on the install, update and reinstall
  paths, each keeping its own outcome type:
  - the resolver's `readManifest`: an escaping link is the structural
    `unavailable` arm with the fixed note "plugin manifest resolves outside the
    <boundary>", which install, `list` and `info` report as `{unreadable
    manifest}`; an unresolvable link (a loop) rethrows its errno, the
    resolver's unreadable-manifest outcome;
  - `readDeclaredPluginVersion` (and the GV-01 directory pin through it):
    escaping or unresolvable declares no version (`undefined`);
  - `readDependencyDeclaration`, `readCandidateDeclaration` and
    `readInstalledCopyDeclaration`: escaping or unresolvable is `unusable`
    (D-05-07), which each caller handles by its own rule.

  A dangling link, or one whose target runs through a regular file, is no
  manifest, and the walk reads the next candidate. `marketplace.json` reads are
  unchanged: Claude Code reads that file with no containment check. `info`'s
  own dependency walk is unchanged too: it is read-only and outside the decided
  scope (follow-up T-a3r-07). Upstream (2.1.310): the plugin load contains the
  manifest read and fails the plugin on an escape, while the install-time
  version read passes no boundary. This extension refuses at install because
  install is where it writes the Pi artifacts, so it is its load. Scenarios:
  "Installing a git-source plugin whose manifest links outside its plugin
  directory refuses it and installs nothing" (`git-source.feature`) and
  "Installing a plugin whose manifest links outside its marketplace refuses it
  and installs nothing" (`install.feature`).
- **D-PL2-25 — Convergence fails closed on a refused installed copy.** (user
  decision 2026-10-27) Convergence's installed-copy read no longer folds
  `unusable` into "no copy declarations". `judgeFinalScope` ends with the
  record's failure arm (D-PL2-05), so `apply`'s final judgement disables
  nothing and the planned judgement leaves the plan as it was.
  `planConvergenceCascade` plans no catalog move in that scope and carries the
  failure (`installedCopyFailure`). `apply` reports the declarer once with the
  REC-05 `plugin-declarer-unreadable` row: `(failed)` at warning severity,
  `{unreadable manifest}`, cause "cannot read the dependencies of <key>: its
  own manifest is present but cannot be read". The load verdict and the read
  pass stay catalog-first (D-PL2-06), so `pending` and the load list no move
  for that scope and print no row naming the record yet; quick 261027-9oo adds
  that row.
  **Amended 2026-10-27 (orchestrator decision for quick 261027-9oo):**
  `pending`, and the load, which prints `pending`'s block, now list the same
  REC-05 row `apply` reports, so `pending` lists what `apply` reports for this
  case. `composePendingReport` takes the cascade's `installedCopyFailure`, then
  runs `judgeFinalScope` over the scope as it stands with the installed-copy
  reader `apply` uses, and lists each failing record once, after the plan's
  rows and before the catalog moves. The row is a failure, not a change, so
  it adds no apply trailer. The load verdict and the read pass stay
  catalog-first (D-PL2-06). Proof: unit cases in `pending.test.ts`,
  `notify.test.ts` and `load.test.ts`. No scenario: an enabled record whose
  installed copy is refused needs a hand-edited `state.json`, because install
  refuses such a copy (D-PL2-24), and the cucumber harness has no step that
  writes installation records.
- **Add-time MISS-01 lifts no marker-held dependent** (D-PL2-09 as written).
- **Files outside the ROADMAP line also touched:** `orchestrators/reconcile/{types,notify}.ts`
  (or wherever pending's projection orders rows) so `pending` prints rows in
  `apply`'s order; `orchestrators/marketplace/add.messaging.ts` row policy for
  `installed` rows if needed.

Uncertain additions: D-PL2-13 (resolved by user decision 2026-10-27: reversed,
an inside-root symlink is followed; see D-PL2-17); D-PL2-14 (alternative: keep apply's old disagreement).

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

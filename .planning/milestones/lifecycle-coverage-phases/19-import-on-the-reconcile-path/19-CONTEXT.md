# Phase 19: Import on the Reconcile Path - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous discuss; the orchestrating session asked for an
autonomous, non-interactive run, so every recommended answer below was
accepted without a prompt.

<domain>
## Phase Boundary

Phase 19 implements the user's 2026-10-23 decision for `/claude:plugin import`
(IMP-05, IMP-06, IMP-07): `import` is the desired-state reconcile with the
Claude Code settings as its source. It never reinstalls an installed plugin,
it reports what it skipped, and it fails cleanly as `lock held` while another
process holds the scope's state lock. The phase owns
`orchestrators/import/*`, the shared reason vocabulary it needs, and
`features/plugin/import.feature`. Phase 17 edits
`orchestrators/reconcile/apply.ts` in parallel, so this phase does not edit
that file.

</domain>

<decisions>
## Implementation Decisions

### The shared path
- **D-01:** Each selected scope runs reconcile's two passes. The read pass
  takes the scope lock with `withLockedStateTransaction`, never saves, and
  runs reconcile's pure planner `planReconcile` over a desired-state view built
  from the settings (each planned marketplace with its settings source, each
  enabled plugin with `enabled: true`) against the locked state snapshot. The
  apply pass then drives, with no outer lock, the same orchestrated operations
  reconcile's apply pass drives: `addMarketplace` for `marketplacesToAdd`, the
  install operation for `pluginsToInstall`, and the enable operation for
  `pluginsToEnable`. `sourceMismatches` stays report-only, as in reconcile.
  `planReconcile` is reconcile's existing exported entry point, so
  `apply.ts` is not edited (Phase 17 owns it).
- **D-02:** Import drives only the additive buckets. The settings are a
  partial desired state: they name what the user wants added, not the whole
  scope. So `marketplacesToRemove`, `pluginsToUninstall`, `pluginsToDisable`
  and the dependency buckets of the plan are ignored, and the planner gets no
  satisfaction verdict. Import never removes or disables anything.
- **D-03:** A record that arrived as another plugin's dependency keeps the
  D-04-07 promotion: the settings name it, so it goes to the install
  operation's promotion arm even though the planner reads it as steady state.
  This check runs before the plan's buckets are read.

### Reported skips (IMP-06)
- **D-04:** A settings plugin the plan leaves alone (recorded, not disabled,
  not a dependency record) reads `skipped {already installed}`, info severity,
  no reload. This is the existing row.
- **D-05:** A settings marketplace the scope already records with the same
  source is a marketplace header `(skipped) {already added}` with no severity
  stamp, so the cascade stays `info`. The token comes from Claude Code's own
  `marketplace add` message for this case, "Marketplace '<name>' is already
  added; nothing changed" (Claude Code 2.1.309 binary). `already added` is a
  new shared `ContentReason`. This replaces Phase 13 D-04's `(updated)` header,
  which claimed a change that never happened. Phase 13 D-04's worry was that a
  `skipped` header routes to `warning`; it no longer does: severity is the
  maximum of the caller-stamped row severities (SEV-02), and `marketplace
  update`'s unstamped `(skipped) {up-to-date}` header is already `info`.
- **D-06:** A recorded-but-disabled plugin that the settings enable is in the
  plan's `pluginsToEnable`, so import enables it with the enable operation and
  reports the `(installed)` row with the version, which is the row reconcile
  renders for the same re-enable (`enabledRowFromOutcome`). The post-pass declares it `{ enabled: true }`,
  the same way as a re-enabled promotion (D-04-07), because the disable verb
  left `{ enabled: false }` under that key. Before this phase, import reported
  such a plugin as `skipped {already installed}` and left it disabled.
- **D-07 (revised after code review CR-01):** Import does not follow the
  planner's source claim. A settings marketplace the scope does not record
  under the settings' own name goes to `addMarketplace`, as before this
  phase; when the scope holds the same source under another name, that add
  fails (typically `duplicate name`) and blocks its plugins. Following the
  claim made the config post-pass declare `plugin@<recorded name>` under a
  config that declares only the settings name, so the next reload uninstalled
  what the import had just installed.
- **D-13 (code review WR-01):** The read pass hands `planReconcile` the
  satisfaction verdict reconcile's own read pass computes
  (`buildScopeSatisfactionVerdict`, inside the lock), so a record the
  load-time dependency check holds down is not enabled and stays a skip
  (LOAD-02).
- **D-14 (code review WR-03, IN-02):** An enable that answers `skipped {not
  installed}` (the record vanished) fails that plugin as `{not installed}`; an
  enable that throws takes the install's defensive arm.

### Lock held (IMP-07)
- **D-08:** A held lock at the read pass fails the scope before anything
  runs. Every marketplace of that scope's plan gets the `(failed)` header and
  one failed child row, `{lock held}`, whose cause is the lock error with its
  whole chain ("Another pi-claude-marketplace operation is in progress ...",
  "Lock file is already being held"). This is the row `marketplace add` shows
  for a held lock (FLR-02). The plugins under it get no rows, as for any
  marketplace failure of the import. No operation runs, and the config
  post-pass does not run for that scope.
- **D-09:** A lock taken by another process after the read pass is a race,
  not the IMP-07 case, but it must not read `unexpected-failure` either. A
  plugin operation that fails with `StateLockHeldError` reads
  `failed {lock held}` with the error's cause chain, and a marketplace add
  that fails as `lock held` carries that reason and its chain on its cause
  row. This is the `StateLockHeldError` arm `dispatchFailedOutcome` lacked.

### Scenarios
- **D-10:** The Phase 13 second-import scenario changes its expected header
  from `updated` to `skipped {already added}`.
- **D-11:** New scenarios in `features/plugin/import.feature`: import under a
  held lock (fails as `lock held`, cause chain, nothing recorded, no config);
  import that finds the plugin disabled enables it (D-06); and import into a
  scope that already holds the marketplace but not the plugin installs the
  plugin under a skipped marketplace header.
- **D-12:** `docs/output-catalog.md` gains two import states,
  `repeat-import-skips` and `lock-held`, with their catalog fixtures, and the
  import section's header rule now names `(skipped) {already added}`.

### Claude's Discretion
- Exact field values (tally counts, summary text) come from the product.

</decisions>

<code_context>
## Existing Code Insights

- `orchestrators/import/execute.ts::executeScopedPlan` loads state without
  the lock and classifies marketplaces and plugins by name lookups of its own.
- `orchestrators/reconcile/plan.ts::planReconcile` is pure and exported; its
  `classifyDeclaredPlugin` puts a recorded-but-disabled declared plugin in
  `pluginsToEnable`, and its `diffMarketplaces` source-claims a recorded
  marketplace of another name with the same source.
- `orchestrators/reconcile/apply.ts::readPassForScope` is the template for the
  locked, write-free read pass; reconcile reports a held lock there as
  `lock held` (`classifyReadPassThrow`).
- `orchestrators/marketplace/add.ts` returns `{ status: "failed", reason:
  "lock held", error }` for a held lock in orchestrated mode.
- Reproduced before the change: import under a held lock, with the
  marketplace not yet added, reports a `(failed)` header and a cause row with
  no reason and a truncated chain; with the marketplace already added, the
  install's `StateLockHeldError` falls to `unexpected-failure`.

</code_context>

<deferred>
## Deferred Ideas

- `marketplace add` of a source the scope already holds fails as
  `duplicate name`, while Claude Code reports "already added; nothing
  changed". That is the `marketplace add` command, outside this phase.

</deferred>

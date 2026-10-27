# Phase 6: Import Marketplace Planning - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning

<domain>
## Phase Boundary

`/claude:plugin import` plans marketplaces the way Claude Code registers them, and `import` and `apply` report a partial rollback with the detail `install` shows.

In scope:

- MIM-01 (IMPNAME-01): a settings marketplace whose source the scope records under another name.
- MIM-02 (IMPEXTRA-01): every `extraKnownMarketplaces` entry, referenced by an enabled plugin or not.
- MIM-03 (LCORCH-01 b2): the per-phase rollback rows on import's failed rows (own install, enable, and a dependency's), and on `apply`'s failed-install row.
- MIM-04 (LCCODE-01 b7): the import enable outcome carries each companion fact once.

Out of scope: the other LCORCH-01 items, `apply`'s enable rows, the MISS-01 missing-dependency row (its outcome type does not declare `rollbackPartials`; LCCODE-01's undeclared-field item, Phase 11), CLOSUREROW-01 (Phase 3), and anything in `apply.ts` other than the failed-install row of `applyPluginInstalls` (Phases 2 and 7).

</domain>

<upstream_evidence>
## Claude Code evidence

Grepped from the installed binary, Claude Code 2.1.310 (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`), on 2026-10-26.

### E1: which `extraKnownMarketplaces` entries Claude Code registers

- **Behavior:** the startup marketplace reconciler registers every entry. `zF()` builds the declared set from the merged settings' whole `extraKnownMarketplaces` map, plus `--add-dir` declarations, plus the official marketplace only when an enabled plugin names it (with `sourceIsFallback`). `W7r(declared, known)` puts each declared name that `known_marketplaces.json` lacks in `missing`, each with another source in `sourceChanged`, and the rest in `upToDate`. `CRn()` installs every `missing` entry and updates every `sourceChanged` one. `enabledPlugins` is not consulted, except for the official marketplace.
- **Evidence:** `function zF(){let e={},n={...CQ(),...pt().enabledPlugins??{}};for(...)if(y&&On(h).marketplace===df){e[df]={source:Mde,sourceIsFallback:!0};break}...return{...e,...r?j$r():{},...s}}`, `function W7r(e,r,s){...for(let[u,f]of Object.entries(e)){let y=ib(r,u)...if(!y)g.push(u)...}return{missing:g,sourceChanged:o,upToDate:n}}`, and `async function CRn(e){let r=zF();...let o=W7r(r,g,...),n=[...o.missing.map((i)=>({...action:"install"})),...]`.
- **Confidence:** high. The code path is explicit.
- **Unresolved:** none for this phase.

### E2: a declared marketplace whose source is already recorded under another name

- **Behavior:** the add finds the source among the recorded marketplaces and returns that record's name, with no clone, no new entry, and no error. The reconciler counts the declaration as installed. Nothing is recorded under the declared name, so the next startup finds it `missing` again and gets the same answer.
- **Evidence:** `async function Lle(e,n,r,s,h){...let S=await Ic(r);for(let[we,Te]of Object.entries(S))if(wn(Te.source,y)){let Ee=h?.refuseNameCollision?Sut(we,y):void 0;if(Ee)throw Ee;return t(\`Source already materialized as '${we}', skipping clone\`),{name:we,alreadyMaterialized:!0,resolvedSource:y}}...`. The reconciler calls it as `Lle(k,void 0,s,p)`, with no `refuseNameCollision`.
- **Plugin ids:** Claude Code does not alias plugin ids. An enabled `p@<declared name>` whose marketplace is not recorded under that name is a `marketplace-not-found` plugin error (`Marketplace '${e}' not found in configuration. Available marketplaces: ...`). A `directory` or `file` declaration is the exception: its plugins load in place from the declared path, at runtime only (`FVn`, `declared-only:` debug line).
- **Name:** Claude Code records a marketplace under its manifest name (`rt.name` in `But`), as this project does.
- **Confidence:** high for the marketplace. Medium for the user-visible plugin outcome: the error type is clear, but this phase did not run Claude Code to see how it is shown.

</upstream_evidence>

<decisions>
## Implementation Decisions

### Marketplace planning

- **D-PL6-01 (MIM-02):** Import plans every `extraKnownMarketplaces` entry of a scope's merged settings, whether an enabled plugin names it or not, as Claude Code's reconciler does (E1). The enabled plugins' marketplaces come first, in settings order, then the remaining entries in settings order. An unreferenced entry with no supported source gets the same `unmappable-marketplace-source` diagnostic a referenced one gets. The official marketplace is still planned only when an enabled plugin names it (E1: `sourceIsFallback`). An added unreferenced marketplace is declared in `claude-plugins.json` by the post-pass, as any added marketplace is. An unreferenced entry is now enough for a scope to take its lock.
- **D-PL6-02 (MIM-01) — REVERSED by D-PL6-17 (user decision 2026-10-27)**, supersedes lifecycle-coverage D-07 (phase 19):** When the scope records a settings marketplace's source under exactly one other name, and the settings do not declare that name themselves, import follows the reconcile planner's one-to-one source claim (Key Decision "Reconcile aliases through one-to-one source claims while preserving the manifest-derived canonical state name"). It adds nothing, reports the recorded marketplace `(skipped) {already added}` under its recorded name, and installs or enables each `p@<settings name>` as `p@<recorded name>`. The post-pass declares the recorded name, with the settings source, when the config lacks it, and declares the plugins under the recorded name. Claude Code's add also finds the source recorded under the other name and reuses it without error (E2). D-07 refused to follow the claim because the old post-pass declared `p@<recorded>` while the config declared only the settings name, so the next load uninstalled the plugin. Declaring both under the recorded name is the config the planner reads as steady state. A conflicted claim (two recorded candidates, or two declarations for one record) is the planner's source mismatch and blocks its plugins as `{source mismatch}`, as before. The same source recorded under the settings' own name is unchanged (`(skipped) {already added}`).

### Rollback reporting

- **D-PL6-03 (MIM-03):** Import's failed row for a plugin whose own install or enable rolled back partially carries install's per-phase child rows (`[<phase>] (rollback failed)` and the phase's cause line), built from the outcome's `rollbackPartials`, not from a boolean. The row's brace stays `{rollback partial}`.
- **D-PL6-04 (MIM-03):** A dependency's partial rollback is reported as `install` reports it: the failing dependency's `(failed) {rollback partial}` row, named by its `plugin@marketplace` key, with the cause and the per-phase rows, beside the requested plugin's bare `(failed) {dependency failed}` row. To make that possible, the orchestrated install outcome of a cascade member failure carries that member's rollback partials (`orchestrators/plugin/install-flow.ts::handleCascadeThrow`), as the single-plugin failure outcome already does (REC-06). Import puts both rows under the requested plugin's marketplace block, as `install` does. A dependency failure with no partial keeps today's rows.
- **D-PL6-05 (MIM-03):** `apply`'s failed-install row (`applyPluginInstalls` only) reads `(failed) {rollback partial}` with the per-phase rows and the redacted install error as its cause when the failed install left rollback partials. For a dependency's partial, `apply` adds the dependency's own failed-install row, under the dependency's own marketplace and by its bare name (apply's convention for dependency rows), with `{rollback partial}`, the per-phase rows, and the redacted cause, and the requested plugin's row keeps `{dependency failed}` without the cause, as `install`'s does. `PluginInstallFailedOutcome` gains an optional `rollbackPartials`, its `cause` widens to `Error`, and the reconcile row projection threads `rollbackPartial` onto the failed row.

### Outcome shape

- **D-PL6-06 (MIM-04):** The import enable outcome keeps the staged-kind facts only in the required `declaresAgents`, `declaresMcp`, and `declaresWorkflows`. `enableSignals` narrows to the degradation facts (`unsupported`, `orphanRewake`, `degradedKinds`), and `installedRow` rebuilds the enable row's `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows` inputs from the `declares*` fields. The rendered rows do not change.

### Behavioral tests

- **D-PL6-07:** The partial-rollback scenarios use a real undo failure. A plugin ships a skill with a read-only directory inside it, and a directory blocks the scope's `mcp-adapter.json`. The mcp phase fails, and the skills undo cannot delete the copied read-only directory (`fs.cp` keeps the 0555 mode, and `rm` then fails with EACCES for a non-root user; verified with Node on 2026-10-26). The fixture step makes the scenario's release step restore write permission before cleanup. The scenarios cannot run as root, and CI runs as a non-root user.

### Settled after research

- **D-PL6-08:** An unreferenced settings entry named `claude-plugins-official` is not planned: Claude Code declares the official marketplace only through an enabled plugin (E1).
- **D-PL6-09 — REVERSED by D-PL6-19 (user decision 2026-10-27):** A settings marketplace the planner reports as a source mismatch (including a conflicted claim) is checked before the add, and when no enabled plugin of it would carry the `{source mismatch}` row (an unreferenced entry), it takes a `(failed)` block through `recordMarketplaceAddFailure`, so it is never silent.
- **D-PL6-10 — REVERSED with D-PL6-02 (the claim map and alias rewrite are removed):** The claim map comes from a thin pure export of `orchestrators/reconcile/plan.ts` (the planner's own `buildMarketplaceClaims`), called in `readPassForImport`, so import and reconcile cannot disagree on the rule. Aliasing rewrites each aliased ref's `marketplace` and `raw` to the recorded key.
- **D-PL6-11:** The enable path's failed outcome (`EnableDisablePluginOutcome` failed arm, `enable-disable.ts::outcomeToTypedResult`) carries `rollbackPartials`, additively.
- **D-PL6-12:** Each rollback phase's cause is redacted like the row's own cause before it reaches an import or apply row.
- **D-PL6-13:** A sixth scenario, in `features/plugin/apply.feature`, covers apply's dependency rollback rows.
- **D-PL6-14:** The cucumber harness projects a non-empty `rollback partial` cell into tokens, and projects path-free error tokens so cause cells match on Node 24 and Node 26 (Node 26 appends the path to fs errno messages).

User decisions on the uncertain choices (2026-10-27, relayed by the parent session):

- **D-PL6-15 (6.18):** `apply` sorts a failed plugin's `{dependency failed}` row and its dependency's `{rollback partial}` row by name (`compareByNameThenScope`), as `import` does.
- **D-PL6-16 (6.22):** The cucumber harness matches a quoted path at any directory only for the `{read-only skill directory removal error}` token; every other error token matches strictly (its message or the path-cut form, D-PL6-14).
- **D-PL6-17 (6.1, reverses D-PL6-02 and D-PL6-10):** A settings marketplace whose source the scope records under another name reuses that record silently (no add, no clone, no row of its own), as Claude Code's add does (E2). Each enabled `p@<settings name>` plugin fails with install's `Marketplace "<name>" is not added in the <scope> scope.` under a `(failed)` block for the settings name, without calling install, and nothing is installed or declared for it. The alias rewrite (`ref.raw` included) and the recorded-name row are removed; CR-01's config naming stays for a recorded marketplace the config declares under another name.
- **D-PL6-18 (6.8, reverses the WR-01 review fix):** Settings that name another marketplace with a recorded source and also declare the recorded name reuse the record silently, as upstream does, instead of failing `already exists`.
- **D-PL6-19 (6.6, reverses D-PL6-09):** An `extraKnownMarketplaces` entry whose name the scope records with a different source is added again in place under the same name from the new source (`replaceRecorded` in `marketplace/add.ts`): the record and clone are replaced, the old github/url clone is removed, a path source's directory is never touched, and installed plugins are left alone for the next `pending`/`apply` to converge (E3: Claude Code 2.1.310 `W7r` `sourceChanged`, `CRn`, `Lle`). A declared path that does not exist, or a source already recorded under another name, keeps the record. The official marketplace (`sourceIsFallback`) keeps `{source mismatch}`. A new manifest naming another marketplace fails closed and restores the record and clone. `forceRemoveDeletedPlugins` is not ported.
- **D-PL6-20 (6.15):** When a failed skills undo leaves a skill staged, the failed row's `leaks` names that skill directory: the full path in `install`, the last segment in `import` and `apply` (D-PL6-12 redaction).

### Claude's Discretion

- Helper and type names, and how the alias is threaded through the scope plan in `execute.ts`.
- Unit test layout inside the existing owner test files.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `orchestrators/import/marketplaces.ts::planMarketplaceSourcesForRefs`: walks only enabled refs today; `marketplaceSourceFromExtra` maps one entry to a source string.
- `orchestrators/reconcile/plan.ts`: `buildMarketplaceClaims` and `recordedSourceCandidates` define the claim rule (candidate = recorded marketplace with `samePlannedSource(...) === "same"` that the config does not declare; conflicts land in `sourceMismatches` as `source-mismatch`).
- `domain/source.ts::samePlannedSource`: the identity rule.
- `orchestrators/plugin/install.messaging.ts::composeInstallFailureMessage` and `orchestrators/plugin/install-cascade.messaging.ts::composeCascadeFailureMessage`: install's row shapes for a root partial and for a dependency member failure.
- `PluginFailedMessage.rollbackPartial` and `shared/notification-grammar.ts::composeFailureLines` already render the per-phase rows; no grammar change is expected.
- `features/step_definitions/mcp-configuration.steps.ts`: "a directory blocks the mcp-adapter.json file of the {word} scope".

### Established Patterns

- Import is reconcile's read pass with the settings as the desired state (IMP-05): `readPassForImport` runs `planReconcile(desiredConfigFor(scopePlan), ...)` under the scope lock, then the buckets run without it.
- `pushUnexpectedFailure` keeps head and cause chain apart, redacted (T-55-02-02).
- `apply.ts::redactedDependencyCascadeError` redacts a cascade error's whole chain.

### Integration Points

- `orchestrators/import/execute.ts`: `ensurePlannedMarketplaces`, `applyPlannedPlugins`, `dispatchFailedOutcome`, `pushUnexpectedFailure`, `installedRow`, `enableOnePlannedPlugin`, `buildBatchedPatchForScope`, `buildRepairPatchForScope`.
- `orchestrators/reconcile/apply.ts::applyPluginInstalls` failure arm; `orchestrators/reconcile/apply-outcomes.ts::PluginInstallFailedOutcome`; `orchestrators/reconcile/notify.ts::failedRowCause` and the failed-row projection.
- `orchestrators/plugin/install-flow.ts::handleCascadeThrow` (orchestrated return only).

</code_context>

<specifics>
## Specific Ideas

Scenarios (each fails without the change):

1. `features/plugin/import.feature`: an `extraKnownMarketplaces` entry no enabled plugin names is added and declared (MIM-02).
2. `features/plugin/import.feature`: settings name a marketplace whose source the scope records under another name; import reports the recorded marketplace `(skipped) {already added}`, installs the plugin under it, declares both under the recorded name, and a following `pending` shows nothing to change (MIM-01).
3. `features/plugin/import.feature`: an enabled plugin whose install rolls back partially shows the `skills` rollback row (MIM-03).
4. `features/plugin/import.feature`: a dependency whose install rolls back partially shows the dependency's `{rollback partial}` row with its `skills` rollback row, and the requested plugin's `{dependency failed}` row (MIM-03).
5. `features/plugin/apply.feature`: `apply` installing a declared plugin whose install rolls back partially shows `{rollback partial}` and the `skills` rollback row (MIM-03).

</specifics>

<deferred>
## Deferred Ideas

- The MISS-01 missing-dependency failed row in `apply` (`applyDependencyInstalls`) does not show rollback partials: `InstallMissingDependencyOutcome`'s failed arm does not declare the field (LCCODE-01, Phase 11).
- `apply`'s enable rows and the update and reinstall rows in `apply` do not show rollback partials either; not part of MIM-03's failed-install row.

</deferred>

## Uncertain choices (for user review)

1. **D-PL6-02, alias instead of Claude Code's plugin error.** Chosen: import installs `p@<settings name>` as `p@<recorded name>` and declares both under the recorded name. Alternative: match Claude Code at the plugin level (E2): reuse the recorded marketplace but report each `p@<settings name>` as `(failed) {marketplace not added}` and install nothing. Why: the reconcile planner already aliases one-to-one source claims (recorded Key Decision), import runs on the reconcile path (IMP-05), and the user's settings ask for that plugin from that source. This supersedes lifecycle-coverage D-07; its stated failure is fixed by declaring both under the recorded name.
2. **D-PL6-02, the row names the recorded marketplace.** Chosen: `<recorded> (skipped) {already added}`, with no row under the settings name. Alternative: show the settings name. Why: nothing is, or will be, recorded under the settings name, and Claude Code's add answers with the recorded name (E2).
3. **D-PL6-05, apply's dependency row placement.** Chosen: the dependency's row goes under its own marketplace, by its bare name, as apply's other dependency rows do. Alternative: under the requested plugin's block by its full key, as `install` and import do. Why: apply's blocks are per marketplace, and its moved and missing-dependency rows already use the dependency's own block.
4. **D-PL6-05, MISS-01 left out.** Chosen: only `applyPluginInstalls`'s failed-install row. Alternative: also the missing-dependency row, which needs the undeclared `rollbackPartials` field declared in `install-flow.ts` (Phase 4's functions). Why: the triage scoped `apply.ts` to the failed-install row, and Phase 11 owns that type fix.
6. **D-PL6-09, an unreferenced source mismatch fails.** Chosen: a `(failed)` block. Alternative: follow Claude Code's reconciler, which re-adds a `sourceChanged` entry with the new source. Why: import has always blocked a source mismatch rather than replacing the recorded marketplace; replacing it is a destructive change no phase decided.
7. **D-PL6-11/D-PL6-05, Phase 1 files.** Chosen: small additive edits to `enable-disable.ts` (failed outcome) and `apply-outcomes.ts` (failed-install outcome), both Phase 1 files. Alternative: leave the enable and apply partials unreported. Why: MIM-03 cannot be met without them.
5. **D-PL6-01, unreferenced marketplace order.** Chosen: referenced marketplaces first, then unreferenced ones, each in settings order. Alternative: one pass in `extraKnownMarketplaces` order. Why: it keeps today's add order for every existing case; rows are sorted by name anyway.
8. **Review fix WR-01, no alias to a name the settings declare.** Chosen: when the settings also declare the recorded name (in `extraKnownMarketplaces` or through an enabled plugin), import does not alias the other settings name to it; the add of that name fails with `Marketplace "<recorded>" already exists in <scope> scope.` Alternative: follow Claude Code, whose add reuses the recorded marketplace with no error (E2). Why: aliasing would merge two names the settings keep apart, so the claim is ambiguous and import fails closed, as it did before D-PL6-02.

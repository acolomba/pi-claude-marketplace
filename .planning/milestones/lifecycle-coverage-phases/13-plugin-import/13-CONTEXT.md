# Phase 13: Plugin Import - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous discuss; the orchestrating session asked for an autonomous, non-interactive run, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 13 adds cucumber coverage for `/claude:plugin import` (IMP-01..IMP-04)
in `features/plugin/import.feature`, which already holds the two Phase 1 seeds
(import from the user's and from the project's settings file). The phase owns
that file and, if needed, `features/step_definitions/plugin/import.steps.ts`.
Test plugins carry skills only. A product bug a scenario exposes is fixed in
this phase.

</domain>

<decisions>
## Implementation Decisions

### Upstream reference
- **D-01:** Claude Code has no `import` verb: it reads `enabledPlugins` and
  `extraKnownMarketplaces` from its settings directly. So `import` has no
  upstream output to match. The reference for each row `import` reports is the
  row the delegated pi verb reports for the same fact (`install` for an
  installed plugin, `install` / `marketplace update` / `list` for a plugin
  the marketplace does not list). Upstream reports that case as "not found in
  marketplace".

### Product fixes
- **D-02:** The `installed` rows of `import` carry the installed `version`, as
  the `installed` rows of `install`, `enable`, and reconcile do. Phase 1 (01-09)
  observed the gap. `InstallPluginOutcome.version` exists for exactly this
  ("an orchestrated caller has no other way to fill the version slot"); import
  drops it. Fix: carry `version` on the import's installed outcome and row.
- **D-03:** An enabled plugin the marketplace does not list is reported
  `(unavailable) {not in manifest}`, not `{no longer installable}`. Import
  collapses its two warning reasons, `unavailable` (not in manifest) and
  `uninstallable` (the resolver says not installable), into one token, while
  `marketplace update` maps them to `not in manifest` and
  `no longer installable`, `install` refuses with `{not in manifest}`, and
  `list` reports `{not in manifest}`. The row stays `unavailable` with
  severity `warning`; only the reason token changes. The e2e assertion in
  `test/e2e/import-command.test.ts` and the import unit tests follow.
- **D-04:** Keep the `(updated)` header for a marketplace that a second import
  finds already recorded with the same source. The marketplace `skipped`
  status routes the envelope to `warning` (`marketplace/update.ts`), which
  would turn a no-op import into a warning; `updated` is the documented,
  info-severity mapping (`buildImportNotificationMarketplaces`). Recorded as
  observed, not changed.

### Scenarios
- **D-05:** The Background offers two plugins, `demo` and `tool`, from the dir
  marketplace `fixtures`; the scope scenarios need two distinct plugins, and
  the seeds' rows do not change.
- **D-06 (IMP-01):** The two seeds stay, with a `version` column after D-02. A
  third scenario proves that a plugin the settings list as `false` is not
  imported: the marketplace is added, the disabled plugin gets no row, no
  record, and no declaration.
- **D-07 (IMP-02):** A second import of the same settings reports the
  marketplace `updated` and the plugin `skipped {already installed}`, needs no
  reload, and leaves the config declarations and the installation record as
  the first import left them.
- **D-08 (IMP-03):** Settings that enable `demo` and `ghost` (not offered):
  `demo` installs, `ghost` is `unavailable {not in manifest}`, severity
  `warning` with one warning in the tally, only `demo` is recorded and
  declared, and a new session offers `demo`'s skill.
- **D-09 (IMP-04):** Two scenarios, one per selected scope. Both settings
  files exist, the user's enabling `demo` and the project's enabling `tool`.
  `import --scope project` installs only `tool` in the project scope, and the
  user scope has no installed plugins and no `claude-plugins.json`; the mirror
  for `--scope user`. An Outline needs three variants, so two scenarios.
- **D-10:** Every needed step already exists in the Phase 1 modules, so no
  `plugin/import.steps.ts` is added.

### Claude's Discretion
- Exact field and row values come from the product after the fixes; the
  scenarios state whole results.

</decisions>

<code_context>
## Existing Code Insights

- `orchestrators/import/execute.ts`: `installOnePlannedPlugin` builds
  `PluginInstalledOutcome` (no version today); `buildImportNotificationMarketplaces`
  renders rows; `importWarningReason` maps both warning reasons to
  `no longer installable`.
- `shared/notification-json.ts` `wireScope`: `unavailable` is a catalogue
  status, so its JSON row carries no `scope`; the scenario states an empty
  scope cell for it.
- Steps used: `claude-code-settings.steps.ts` (settings writer),
  `command.steps.ts` (fields and rows), `config.steps.ts` (declarations),
  `scope-state.steps.ts` (installation record), `session.steps.ts`.

</code_context>

<deferred>
## Deferred Ideas

- The `(updated)` header on an untouched marketplace (D-04) reads as a change.
  A dedicated info-severity no-op marketplace status would need a vocabulary
  decision across commands.

</deferred>

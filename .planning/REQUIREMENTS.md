# Requirements: pi-claude-marketplace

**Defined:** 2026-09-09
**Milestone:** v1.20 transitive-dependencies
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact -- atomically, recoverably, and with soft-dependency
degradation that never blocks the install.

## v1.20 Requirements

### Manifest location (MANF)

Closes `PMAN-01`. Claude Code reads a plugin manifest from either
`<pluginRoot>/.claude-plugin/plugin.json` or a bare `<pluginRoot>/plugin.json`;
we only ever build the wrapped path, at two independent call sites.

- [x] **MANF-01**: A plugin whose manifest sits at a bare
  `<pluginRoot>/plugin.json` has that manifest read and honored.
- [x] **MANF-02**: When a plugin ships both manifest locations, the wrapped
  `.claude-plugin/plugin.json` wins.
- [x] **MANF-03**: A plugin that declares `"./skills/"` and also ships a
  conventional `skills/` directory produces one component path, so installing it
  emits no duplicate-skill warning.
- [x] **MANF-04**: A plugin whose bare `plugin.json` is malformed resolves
  `(unavailable)` with the existing `malformed plugin.json:` reason, rather than
  being skipped silently.
- [x] **MANF-05**: A plugin with no manifest at either location still installs.

### Dependency display (DEPS)

Closes the display half of `PDEP-01`. `normalizeDependencies` filters the array
to `typeof d === "string"`, dropping every object-shaped entry -- the shape
upstream documents as the primary use case.

- [x] **DEPS-01**: `info` shows a dependency declared as
  `{name, version, marketplace}`, including its version constraint.
- [x] **DEPS-02**: `info` shows every element of a dependency array that mixes
  bare strings and objects.

### Dependency resolution (RESV)

New scope. Supersedes the PI-13 / PR-5 no-auto-resolution decision, which is
retired by this milestone rather than worked around.

- [ ] **RESV-01**: Installing a plugin also installs the plugins it declares as
  dependencies.
- [x] **RESV-02**: A dependency that names a marketplace resolves from that
  marketplace; one that names none resolves from the depending plugin's
  marketplace.
- [ ] **RESV-03**: A dependency whose version constraint no available plugin
  satisfies fails the install with a reason naming the constraint.
- [ ] **RESV-04**: A dependency cycle terminates instead of installing forever.
- [ ] **RESV-05**: A dependency that is already installed is not reinstalled.
- [ ] **RESV-06**: When a dependency cannot be installed, the user learns which
  dependency failed and why, and the install does not leave a half-materialized
  plugin behind.

### Install provenance (PROV)

New scope. The record `--prune` reads.

- [ ] **PROV-01**: Each install record states whether the user asked for the
  plugin directly or it arrived as another plugin's dependency.
- [ ] **PROV-02**: A plugin the user installed directly stays marked as such
  even when a later install declares it as a dependency.
- [ ] **PROV-03**: A plugin first installed as a dependency becomes
  directly-installed when the user installs it by name.
- [ ] **PROV-04**: An install record written before this milestone is reported
  as stale rather than silently repaired.

### Prune on uninstall (PRUNE)

New scope. Consumes PROV.

- [ ] **PRUNE-01**: `uninstall --prune` also removes dependency-installed
  plugins that no remaining installed plugin declares.
- [ ] **PRUNE-02**: `--prune` never removes a plugin the user installed
  directly.
- [ ] **PRUNE-03**: `--prune` never removes a dependency that another installed
  plugin still declares.
- [ ] **PRUNE-04**: The user learns which plugins `--prune` removed.

### Uninstall data disposition (DATA)

Closes `UDISP-01`. `uninstall.ts:429` runs
`rm(dataDir, { recursive: true, force: true })` on every uninstall, with no way
to opt out.

- [x] **DATA-01**: `uninstall --keep-data` preserves the plugin's data
  directory.
- [x] **DATA-02**: `uninstall` without `--keep-data` deletes the data directory
  and does not prompt.
- [x] **DATA-03**: An uninstall driven by reconcile deletes the data directory,
  matching the promptless default, since it carries no command line.

### Uninstall flag surface (FLAG)

- [ ] **FLAG-01**: `uninstall` accepts exactly `--keep-data` and `--prune` as
  its extra flags, and the flag-catalog drift guard pins that set.

## Future Requirements

Acknowledged, not in this milestone.

### Migration (MIGR)

- **MIGR-01**: Replace field-level backward-compat migration with a staleness
  gate -- delete `persistence/migrate.ts`, replace `migrate-config.ts` with a
  loud-failure guard. Tracked in `.planning/BACKLOG.md`. **PROV-04 depends on
  the guard half of this item**: the notify wording and recovery command for
  "stale state, absent config" is MIGR-01's own unresolved design question, and
  PROV-04 needs an answer to it. Answer only that much here; leave the
  `migrate.ts` deletion to MIGR-01.

## Out of Scope

| Feature | Reason |
|---------|--------|
| `-y` / `--yes` flag | It exists upstream only to skip the `--prune` confirmation prompt in non-TTY contexts. We delete silently and have no prompt to skip, so it would be a flag that does nothing. |
| `--delete-data` flag | Upstream has no such flag. The required `--keep-data`/`--delete-data` mutex is the competitor's model, recorded in `UDISP-01` as the wrong one to copy. |
| Prompt with directory size before deleting data | Matches upstream's interactive `/plugin` but not its CLI. `applyPluginUninstalls()` fires from `resources_discover` / `session_start` with no way to prompt, so adopting it would give one operation two behaviors depending on the entry point. |
| Deleting `persistence/migrate.ts` | MIGR-01's own scope. This milestone needs only its stale-state guard answer. |

## Traceability

Filled during roadmap creation (2026-09-09). Phase numbering restarts at 1 for
this milestone.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MANF-01 | Phase 1 | Complete |
| MANF-02 | Phase 1 | Complete |
| MANF-03 | Phase 1 | Complete |
| MANF-04 | Phase 1 | Complete |
| MANF-05 | Phase 1 | Complete |
| DEPS-01 | Phase 1 | Complete |
| DEPS-02 | Phase 1 | Complete |
| RESV-01 | Phase 3 | Pending |
| RESV-02 | Phase 3 | Complete |
| RESV-03 | Phase 3 | Pending |
| RESV-04 | Phase 3 | Pending |
| RESV-05 | Phase 3 | Pending |
| RESV-06 | Phase 3 | Pending |
| PROV-01 | Phase 4 | Pending |
| PROV-02 | Phase 4 | Pending |
| PROV-03 | Phase 4 | Pending |
| PROV-04 | Phase 4 | Pending |
| PRUNE-01 | Phase 5 | Pending |
| PRUNE-02 | Phase 5 | Pending |
| PRUNE-03 | Phase 5 | Pending |
| PRUNE-04 | Phase 5 | Pending |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| FLAG-01 | Phase 5 | Pending |

**Coverage:**

- v1.20 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

Every requirement maps to exactly one phase: 7 to Phase 1, 3 to Phase 2, 6 to
Phase 3, 4 to Phase 4, 5 to Phase 5.

## Planning Notes

Facts verified first-hand on 2026-09-09, against source and against the
installed Claude Code CLI v2.1.236. Planning should not re-derive them.

- **Two hardcoded manifest paths, not one.** `domain/resolver.ts:627`
  (`readManifest`) and `orchestrators/plugin/shared.ts:921`
  (`resolvePluginVersion` tier 1) each build the wrapped path independently.
  MANF-01 must cover both or the two disagree.
- **MANF-03 is what keeps MANF-01 from being a regression.**
  `addComponentPath` (`domain/resolver.ts:1001`) dedups by raw relative-path
  string, so `"./skills/"` and `"skills"` are distinct keys, and
  `collectStrictComponentKind` (`:1051`) adds the convention path additively and
  unconditionally. Without a normalized key, reading the four known bare
  manifests enumerates one directory twice: 8 spurious warnings for `ui5`, 2 for
  `ui-theme-designer`.
- **No in-the-wild dependency fixtures exist.** 290 of 292 official-marketplace
  manifests were checked at their pinned SHAs. Exactly one
  (`salesforce-development`) has the `dependencies` key at all, and its value is
  `[]`. All RESV and PROV test data is necessarily synthetic. Pin the accepted
  shapes from the installed Claude Code binary rather than inventing a sample.
- **The install record's key set is pinned by an architecture test** (v1.18's
  no-expansion promise, which pins the record's key set, four closed sets by
  enumeration equality, and the schema-version union). PROV-01 trips it by
  design. Amend the pin deliberately; do not loosen it.
- **`enabled` is required at schemaVersion 2+.** A required provenance field
  makes every pre-existing record fail `STATE_VALIDATOR.Check()`. Under
  MIGR-01's reading that failure IS the staleness detector and is the desired
  outcome -- which is why PROV-04 is phrased as "reported as stale", not
  "migrated".
- **There is no semver library in the dependency tree,** and PL-5 compares
  versions as strings deliberately. RESV-03 needs either a new dependency or a
  documented constraint subset. Decide in planning; do not assume semver is
  available.
- **`orchestrators/import/` already cascade-installs** an entire config with
  per-entry outcomes, and `orchestrators/plugin/bootstrap.ts` is an existing
  composer. RESV-01 should map onto that machinery rather than introduce a
  second cascade.
- **Reconcile calls uninstall too.**
  `orchestrators/reconcile/apply.ts::applyPluginUninstalls()` runs
  non-interactively from `resources_discover` / `session_start`. DATA-03 and
  PRUNE behavior must both hold there, where no flag can be passed.

---

*Requirements defined: 2026-09-09*

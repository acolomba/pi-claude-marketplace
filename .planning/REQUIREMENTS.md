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

- [x] **RESV-01**: Installing a plugin also installs the plugins it declares as
  dependencies.
- [x] **RESV-02**: A dependency that names a marketplace resolves from that
  marketplace; one that names none resolves from the depending plugin's
  marketplace.
- [x] **RESV-03**: A dependency whose version constraint no available plugin
  satisfies fails the install with a reason naming the constraint.
- [x] **RESV-04**: A dependency cycle terminates instead of installing forever.
- [x] **RESV-05**: A dependency that is already installed is not reinstalled.
- [x] **RESV-06**: When a dependency cannot be installed, the user learns which
  dependency failed and why, and the install does not leave a half-materialized
  plugin behind.

### Install provenance (PROV)

New scope. The record `--prune` reads.

- [x] **PROV-01**: Each install record states whether the user asked for the
  plugin directly or it arrived as another plugin's dependency.
- [x] **PROV-02**: A plugin the user installed directly stays marked as such
  even when a later install declares it as a dependency.
- [x] **PROV-03**: A plugin first installed as a dependency becomes
  directly-installed when the user installs it by name.
- [x] **PROV-04**: An install record written before this milestone is upgraded
  to the current schema with a truthful default, and no record is misreported
  as a dependency.

### Prune on uninstall (PRUNE)

New scope. Consumes PROV.

- [x] **PRUNE-01**: `uninstall --prune` also removes dependency-installed
  plugins that no remaining installed plugin declares.
- [x] **PRUNE-02**: `--prune` never removes a plugin the user installed
  directly.
- [x] **PRUNE-03**: `--prune` never removes a dependency that another installed
  plugin still declares.
- [x] **PRUNE-04**: The user learns which plugins `--prune` removed.
- [x] **PRUNE-05**: `uninstall` refuses to remove a plugin that another
  installed plugin in the same scope still declares, and names the dependents.
  (Folded into Phase 5 by the operator on 2026-09-16; D-05-14..16.
  **Superseded by LOAD-03 in Phase 6 on 2026-09-18:** the refusal is retired
  for upstream parity; the dependents are named on the row and reported
  unsatisfied at the next load instead. D-05-14 and D-05-15 are superseded in
  full. Of D-05-16 only the dependents arm is: its refuse-and-retry loop on the
  reconcile path survives, because the fail-closed unreadable-declarer refusal
  D-05-07 still reaches it. The supersession record is
  `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-04-SUMMARY.md`.)
- [ ] **PRUNE-06**: A standalone `prune` removes the dependency-installed
  plugins that no installed plugin in the scope declares, without uninstalling
  anything else, and says which ones it removed.
- [ ] **PRUNE-07**: `prune --dry-run` lists what `prune` would remove and
  removes nothing.

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

- [x] **FLAG-01**: `uninstall` accepts exactly `--keep-data` and `--prune` as
  its extra flags, and the flag-catalog drift guard pins that set.
- [ ] **FLAG-02**: `prune` accepts exactly `--dry-run` as its extra flag, and
  the flag-catalog drift guard pins that set. No `-y`: there is no prompt to
  skip (Out of Scope table).

### Load-time dependency check (LOAD)

Parity with the upstream load-time check (`dependency-unsatisfied`,
`dependency-version-unsatisfied`). Today nothing checks an installed plugin's
declarations after install; a dependency can be uninstalled or disabled
underneath its dependent and the dependent keeps loading.

- [x] **LOAD-01**: At load, an installed plugin whose declared dependency is
  missing, disabled, or outside the declared range is disabled and reported
  with a remedy that names the dependency and the dependent (`Install "X" or
  uninstall "Y"`, `Enable "X" or uninstall "Y"`, `Update "X" to satisfy R, or
  uninstall "Y"`).
- [x] **LOAD-02**: The load-time disable is a consequence the config does not
  express: reconcile keeps the dependent disabled while the dependency stays
  unsatisfied, does not oscillate, and lifts the disable once the dependency is
  installed, enabled and in range.
- [x] **LOAD-03**: `uninstall <plugin>` proceeds while other installed plugins
  in the scope still declare it; the row names the dependents, and each becomes
  unsatisfied at the next load. Supersedes PRUNE-05 and the reload-path
  refusal.

### Marketplace-repository tag resolution (TAGS)

Parity with upstream tag resolution for relative-path plugins. Today any
non-wildcard constraint on a path-source dependency fails
`{no matching version}`, so constraints are unusable on the common case.

- [x] **TAGS-01**: A constrained dependency whose marketplace entry is a
  relative path resolves the constraint against the marketplace repository's
  `{name}--v{version}` tags, read from the local marketplace clone without
  network (NFR-5).
- [ ] **TAGS-02**: When no tag satisfies the constraint, the marketplace's
  current copy is installed and the constraint is checked at load (LOAD-01)
  rather than failing the install.
- [x] **TAGS-03**: A constrained path-source dependency with a satisfying tag
  installs the plugin as it stands at that tag, not the marketplace's current
  copy.

### Enablement parity for dependencies (EDEP)

Parity with the upstream enable/disable rules. Today `enable` and `disable`
know nothing about plugin dependencies, and the cascade leaves a disabled,
already-installed dependency disabled (RESV-05; BACKLOG ENBL-DEP-01).

- [ ] **EDEP-01**: `enable <plugin>` also enables the plugin's declared
  dependencies, transitively, in the same scope, and lists them.
- [ ] **EDEP-02**: `disable <plugin>` is refused while an enabled installed
  plugin in the scope declares it; the refusal names the dependents and gives
  the one command that disables them together.
- [ ] **EDEP-03**: Installing or enabling a plugin enables an already-installed,
  disabled dependency through its record -- the desired-state config never
  names a dependency (D-04-02) -- and reports it on the row; the
  `{already installed, dependency disabled}` skip is retired.

### Reload installs missing dependencies (MISS)

Parity with upstream reload. Today reconcile keeps recorded dependencies
(D-04-05) but never fetches a declared one that is absent.

- [ ] **MISS-01**: A reload installs every declared dependency of an installed
  plugin that is not yet installed, through the install cascade, with
  provenance `dependency`.
- [ ] **MISS-02**: When such a dependency cannot be installed, the reload
  completes, the failure is reported on its own row, and the dependent is
  handled by LOAD-01.

### Constraint-aware update (UPDT)

Parity with upstream update. Today `update` and `autoupdate` never read
constraints, so an update can move a dependency out of every range that
depends on it.

- [ ] **UPDT-01**: `update` and `autoupdate` move a plugin that installed
  plugins constrain only to the highest version that satisfies every
  dependent's range.
- [ ] **UPDT-02**: When no version satisfies every range, the update of that
  plugin is skipped and reported, naming the constraining plugin(s).

### Cross-marketplace dependency allowlist (XMKT)

Parity with upstream's `allowCrossMarketplaceDependenciesOn`. Today any added
marketplace may satisfy a dependency (D-03-08 covers only the not-added case).

- [ ] **XMKT-01**: A dependency that resolves from a marketplace other than the
  root plugin's is refused unless the root marketplace's `marketplace.json`
  lists that marketplace in `allowCrossMarketplaceDependenciesOn`; the reason
  names the field.
- [ ] **XMKT-02**: An already-installed dependency satisfies the declaration
  regardless of the allowlist.

### Divergence record (DIVG)

- [ ] **DIVG-01**: `docs/dependency-resolution.md` states that upstream accepts
  a `sha` field on a dependency element and that this extension refuses it
  (D-03-36), beside the kept divergences it already records.

## Future Requirements

Acknowledged, not in this milestone.

### Migration (MIGR)

- **MIGR-01**: Replace field-level backward-compat migration with a staleness
  gate -- delete `persistence/migrate.ts`, replace `migrate-config.ts` with a
  loud-failure guard. Tracked in `.planning/BACKLOG.md`. **PROV-04 no longer
  depends on this item** (D-04-06, 2026-09-15): the reworded PROV-04 upgrades a
  legacy record silently with a truthful default, so it emits no stale-state
  report and needs no recovery-command wording. The notify wording and recovery
  command for "stale state, absent config" returns to MIGR-01 intact, alongside
  the `migrate.ts` deletion.

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
| RESV-01 | Phase 3 | Complete |
| RESV-02 | Phase 3 | Complete |
| RESV-03 | Phase 3 | Complete |
| RESV-04 | Phase 3 | Complete |
| RESV-05 | Phase 3 | Complete |
| RESV-06 | Phase 3 | Complete |
| PROV-01 | Phase 4 | Complete |
| PROV-02 | Phase 4 | Complete |
| PROV-03 | Phase 4 | Complete |
| PROV-04 | Phase 4 | Complete |
| PRUNE-01 | Phase 5 | Complete |
| PRUNE-02 | Phase 5 | Complete |
| PRUNE-03 | Phase 5 | Complete |
| PRUNE-04 | Phase 5 | Complete |
| PRUNE-05 | Phase 5 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| FLAG-01 | Phase 5 | Complete |
| LOAD-01 | Phase 6 | Complete |
| LOAD-02 | Phase 6 | Complete |
| LOAD-03 | Phase 6 | Complete |
| TAGS-01 | Phase 7 | Complete |
| TAGS-02 | Phase 7 | Pending |
| TAGS-03 | Phase 7 | Complete |
| EDEP-01 | Phase 8 | Pending |
| EDEP-02 | Phase 8 | Pending |
| EDEP-03 | Phase 8 | Pending |
| MISS-01 | Phase 9 | Pending |
| MISS-02 | Phase 9 | Pending |
| UPDT-01 | Phase 10 | Pending |
| UPDT-02 | Phase 10 | Pending |
| XMKT-01 | Phase 11 | Pending |
| XMKT-02 | Phase 11 | Pending |
| PRUNE-06 | Phase 12 | Pending |
| PRUNE-07 | Phase 12 | Pending |
| FLAG-02 | Phase 12 | Pending |
| DIVG-01 | Phase 7 | Pending |

**Coverage:**

- v1.20 requirements: 44 total (25 defined 2026-09-09; 19 added 2026-09-18
  from `HANDOFF-upstream-dependency-parity.md`)
- Mapped to phases: 44
- Unmapped: 0 ✓

Every requirement maps to exactly one phase: 7 to Phase 1, 3 to Phase 2, 6 to
Phase 3, 4 to Phase 4, 5 to Phase 5, 3 to Phase 6, 4 to Phase 7, 3 to Phase 8,
2 to Phase 9, 2 to Phase 10, 2 to Phase 11, 3 to Phase 12.

**Parity extension (2026-09-18).** After the five original phases shipped, a
doc-vs-shipped comparison against the Claude Code dependency docs (binary
2.1.267) found thirteen divergences; the operator's rule is to align with
upstream unless Pi or this project's model gives a concrete reason not to.
The nine alignments are the LOAD, TAGS, EDEP, MISS, UPDT, XMKT and DIVG
families plus PRUNE-06/07 and FLAG-02 below; the decision table with the four
kept divergences is `HANDOFF-upstream-dependency-parity.md`.

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

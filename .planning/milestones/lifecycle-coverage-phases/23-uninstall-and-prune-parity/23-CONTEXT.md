# Phase 23: Uninstall and Prune Parity - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous discuss; the orchestrating session asked for an
autonomous, non-interactive run, so every recommended answer below was
accepted without a prompt.

<domain>
## Phase Boundary

Phase 23 closes three second-round findings (PRN-02, PRN-03, UNI-01): every
`will uninstall` row names the plugin's version, `prune` under a held lock
prints the lock path as every other command does, and `uninstall` of a
dependency whose only dependents are disabled behaves as Claude Code does.
It owns the `will uninstall` row type and its producers (prune `--dry-run`,
`pending`), prune's operation-failure row, uninstall's dependents read, and
the prune, pending, and uninstall feature files. Phases 20-22 and 24 run in
parallel, so shared files get minimal edits.

</domain>

<research>
## Upstream evidence (Claude Code 2.1.309 binary)

Grepped `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.309/claude`.

- The uninstall operation (`Nfe`) has no dependents refusal. Its only
  dependents-shaped check is the organization-required block
  (`required_by_organization`). It removes the plugin, then computes
  `U = Z1t(pluginId, installed)` and appends `JUo(U)` to the success message:
  `Successfully uninstalled plugin: <name> (scope: <scope>) — warning: required by <names>`.
- `Z1t(e, n)` is `Y(e, n).map(o => o.name)`, and `Y` keeps only plugins with
  `o.enabled && …dependencies… names e`. A DISABLED dependent is not a reverse
  dependent: it neither blocks nor appears in the warning.
- `disable` refuses (`required_by_dependents`, "is still required by … Disable
  that plugin first") with the same enabled-only filter.
- Conclusion for UNI-01: when the only plugins that need the target are
  disabled, Claude Code uninstalls it with a plain success, and names no
  dependents. Confidence HIGH (code read directly).
- Prune preview (PRN-02): the roadmap finding records Claude Code's preview as
  `name (version)`; not re-verified here, the decision is binding.

## Project records

- D-MF-03 (PROJECT.md): "a named uninstall of a dependency that plugins still
  need is refused, a recorded divergence from Claude Code, which uninstalls it
  and reports the dependents". The divergence replaces upstream's warning with
  a refusal; upstream's warning names enabled dependents only.
- D-05-04: a disabled installed plugin still holds what it declares. Its home
  is the orphan sweep (`domain/dependency-orphans.ts` header: prune and
  `--prune`), where it keeps a disabled plugin's dependency from being pruned.
- Phase 15 D-06 recorded prune's `(.state-lock)` redaction as an
  "inconsistency, not a reason mismatch" and deferred it. No decision gives a
  reason for it. The catalog lines in `docs/output-catalog.md` ("The lock path
  is redacted") describe the behavior; they record no reason.

</research>

<decisions>
## Implementation Decisions

### PRN-02: `will uninstall` carries the version
- **D-01:** `PluginWillUninstallMessage` gains `version?: string`. The text
  layout of `will uninstall` moves from `version: "none"` to `"single"`, so
  the row renders `○ lib [project] v1.2.0 (will uninstall) {…}`, the same slot
  every other versioned row uses. `pluginVersion` and the JSON `wireVersion`
  return it. The wire schema's plugin row already has an optional `version`
  string, so the payload schema needs no change; `docs/json-output.md` text
  that says pending rows carry no version is updated for `will uninstall`.
- **D-02:** The other pending statuses (`will install`, `will enable`,
  `will disable`) stay versionless: the finding and the requirement name
  `will uninstall` only, and a `will install` row has no recorded version.
- **D-03:** prune `--dry-run` stamps the candidate record's version
  (`candidate.record.version`).
- **D-04:** `pending` stamps the recorded version of each `will uninstall` row
  (both the `pluginsToUninstall` bucket and the per-plugin rows of a removed
  marketplace). The planner DTO stays unchanged (its deep-equality tests and
  the apply path do not need the version): `pendingReconcile` already walks
  each scope's state, so it builds a `(scope, marketplace, plugin) → version`
  map and passes it to `buildReconcilePendingNotification` as an optional
  third argument. A row with no recorded version (never in practice) renders
  without one.
- **D-05:** Load-time reconcile emits no `will uninstall` rows (apply executes
  the uninstall and reports `(uninstalled)` with its version), so it needs no
  change.

### PRN-03: prune prints the lock path
- **D-06:** prune's operation-failure row passes a `StateLockHeldError`
  unredacted, as uninstall and the other commands do; every other prune
  failure keeps the redacted cause chain (T-53-02-02 still covers state paths
  in unreadable and rollback causes). The two state-lock scenarios assert the
  absolute path with `{project dir}` / `{agent dir}`, and the catalog fixture
  and `docs/output-catalog.md` follow.

### UNI-01: disabled dependents do not hold an uninstall
- **D-07:** A disabled record is not a reverse dependent for a named
  uninstall: it neither refuses the uninstall (LAYER-08 target layer), nor
  produces the skipped row (other layer), nor is named on the success row's
  `{dependents remain}` / `required by …` cause. This is Claude Code's
  enabled-only `Z1t` filter. With no enabled needer the uninstall goes ahead
  with a plain `(uninstalled)` row.
- **D-08:** The LAYER-08 needer walk also does not continue through a
  disabled undeclared holder: a disabled plugin needs nothing, as upstream's
  direct enabled-only check implies.
- **D-09:** An ENABLED declared needer still refuses (D-MF-03 recorded
  divergence stays), and D-05-04 stays for the orphan sweep: prune and
  `--prune` keep a dependency a disabled plugin declares. The filter is
  applied in the uninstall orchestrator over the declaration index (holders
  whose record is disabled are dropped), so `domain/dependency-orphans.ts`
  keeps its pure contract.
- **D-10:** A later `enable` of the disabled dependent already refuses with
  `{dependency unsatisfied}` ("Install lib@tools first…", ENA-05), matching
  upstream's `dependency_missing`, so the uninstall leaves no silent break.

- **D-13 (from review WR-01):** "Disabled" means disabled by the user or a
  config. A record the load-time check held down (`dependencyDisabled: true`)
  is still enabled in its config, which is what Claude Code reads, so it keeps
  holding the uninstall, as the reconcile verdict's `isDisabledIndependently`
  already treats it.

### Scenarios
- **D-11:** `prune.feature`'s dry-run scenario and `pending.feature`'s
  `will uninstall` rows gain a `version` column. `state-lock.feature`'s two
  prune scenarios assert the absolute lock path. `uninstall.feature` gains
  "Uninstalling a dependency whose only dependent is disabled uninstalls it".
- **D-12:** Catalog-uat fixtures (`plugin-prune.ts`, `plugin-pending.ts`) and
  `docs/output-catalog.md` follow the new bytes; counts in
  `test/architecture/catalog-uat/*` are updated only if they change.

### Claude's Discretion
- Exact placement of the disabled filter inside `uninstall.ts`.

</decisions>

<deferred>
## Deferred Ideas

- D-MF-03 still refuses a named uninstall of a dependency an ENABLED declared
  plugin needs, where Claude Code uninstalls and warns. Recorded divergence;
  not reopened.
- `will install` / `will enable` / `will disable` rows carry no version
  (D-02).

</deferred>

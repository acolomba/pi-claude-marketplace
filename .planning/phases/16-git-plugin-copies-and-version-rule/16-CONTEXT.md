# Phase 16: Git Plugin Copies and Version Rule - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

An installed git-source plugin runs exactly the code its record names, and
every command reports a plugin's version the same way. Requirements: GIT-01,
GIT-02, VER-01. The user's 2026-10-23 decisions in ROADMAP "### Phase 16" are
binding: no per-plugin version pinning; unpinned installs get a per-commit
copy like pinned ones; the URL-keyed mirror is only a download cache; one
version rule, declared version first and `sha-<12hex>` only when none is
declared (supersedes D-77-01's "sha replaces the ladder").

Today an unpinned git install records the URL-keyed mirror itself
(`plugin-clones/<urlhash12>/`) as its `resolvedSource`. `fetch` and
`info --fetch` refresh that mirror in place, so the hooks and MCP servers of
an installed plugin, which run from `resolvedSource`, change without an
`update` (the GIT-01 bug).

Files this phase owns: `orchestrators/plugin/clone-cache.ts`, `clone-gc.ts`,
`install-clone-probe.ts`, `update-preflight.ts`, `reinstall-clone-probe.ts`,
`git-source-probe.ts`, `install-outcome.ts`, `shared.ts`
(`resolvePluginVersion`), `info.ts` and `list-candidate-row.ts` (version
fields only), and their unit tests; `features/plugin/git-source.feature`,
`git-source-update.feature`, `fetch.feature`, the `info`/`list`/`prune`
scenarios that state git versions, `features/step_definitions/plugin/fetch.steps.ts`
(fetch stream module, owned here for fetch.feature), and a new verb module
`features/step_definitions/plugin/git-source.steps.ts`.

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (Claude Code 2.1.309 binary)
- **D-01:** The installed binary's version function (`Pte`, log strings
  `Using manifest version for`, `Using catalog version`, `Using pre-resolved
  git SHA for`, `Using git SHA for`, `No version found ... using 'unknown'`)
  orders the version as: the plugin manifest `version`, then the marketplace
  catalog entry `version`, then the first 12 hex of the git commit (git-subdir
  appends an 8-hex hash of the path), then `unknown`. Upstream also stores
  installs in a per-version cache directory (`Z2(plugin, version)`). This
  matches the user's rule; the project keeps its `sha-` prefix (D-77-01) and
  its `hash-<12hex>` last resort for path plugins, and does not add the
  git-subdir path hash (a recorded divergence, see "For the user").

### Per-commit copies (GIT-01)
- **D-02:** A new clone-cache function `materializePluginCommitCopy` gives a
  git source its per-commit copy at `plugin-clones/<urlhash12>-<sha12>/`
  (the existing pinned key): a present copy is returned as is; otherwise a
  present mirror is copied (work tree and `.git`) into a staging dir, the
  commit is checked out there, and the staging dir is renamed into place
  (local, no network, NFR-1); when there is no mirror, or the mirror does not
  hold the commit, it falls back to `materializePluginClone` at that commit.
- **D-03:** Unpinned `install` keeps its mirror step (clone on a cold key,
  refresh on a warm one, D-79.1-02 and Phase 4 D-05) and then materializes
  the per-commit copy at the mirror's HEAD. The record's `resolvedSource`
  names the copy, never the mirror. Unpinned `update` does the same.
- **D-04:** `fetch` and `info --fetch` keep refreshing only the mirror and
  never touch a per-commit copy, so an installed plugin's files change only
  through `update` or `reinstall`.
- **D-05:** `reinstall` of a git source restores the per-commit copy at the
  recorded sha through `materializePluginCommitCopy` (copy present, else from
  the mirror, else a clone at that sha). This fixes a related bug: reinstall
  used the mirror's HEAD while recording the OLD sha and version, so after a
  `fetch` the record named a commit the files were not at. Phase 18 decides
  what version reinstall takes; this phase only keeps record and files
  consistent.
- **D-06:** The reload migration's offline probe
  (`makeRecordedShaPresenceProbe`) reads the per-commit copy at the recorded
  sha first, and reads the mirror only when its HEAD is that sha (a record
  made before this phase).

### Clone cleanup (GIT-02)
- **D-07:** Clone cleanup keeps every clone directory an installation record
  names (the per-commit copy, the existing rule) and, for each kept
  `<urlhash12>-<sha12>` copy, the mirror `<urlhash12>` of the same URL: the
  mirror is the download cache of an installed plugin, so a later `update`
  fetches incrementally. Every other directory, including a mirror `fetch`
  warmed for a plugin that is not installed, is deleted. Cleanup still runs
  only where it runs today (uninstall, update, marketplace remove).

### Version rule (VER-01)
- **D-08:** One function, `resolvePluginVersion(entry, installable,
  resolvedSha?)`: the plugin.json version, then the marketplace entry
  version, then `sha-<12hex>` when a git commit is given, else the
  `hash-<12hex>` content hash. `install` (`deriveInstallVersion`) and
  `update` (`deriveUpdateToVersion`) pass the commit only for git kinds;
  the enable pin override and a tag-pinned update's version keep their
  precedence. The full sha is still stored as `resolvedSha` (D-77-02).
- **D-09:** `update` decides `unchanged` only when the version AND, for a git
  source, the resolved sha both equal the record's. A new commit with the
  same declared version is `updated` (from and to show the same version), so
  `update` still detects a new revision through the stored sha.
- **D-10:** `info` on a not-installed plugin with a warm git tree, and `list`
  candidate rows with a warm git tree, show the same rule against that tree:
  plugin.json version, then entry version, then `sha-<12hex>`. A cold git
  entry keeps the entry version or none; path-source candidate rows keep the
  entry version (out of this phase's git scope).
- **D-11:** An existing record whose version is `sha-...` for a plugin that
  declares a version is not migrated; the next `update` reports it `updated`
  to the declared version (D-09: the versions differ).

### Scenarios
- **D-12:** The git fixtures always declare a version, so every git row that
  states `{<repo> revision N}` now states the declared version. A new
  `git-source.steps.ts` step makes a repository plugin declare no version
  (rewrites its plugin.json and pushes a new revision) for the `sha-<12hex>`
  scenarios.
- **D-13:** GIT-01 scenarios: after an unpinned install and a `fetch` of a
  new revision, the installed plugin still runs revision 1 (a new
  `git-source.steps.ts` step reads the record's `resolvedSource` clone HEAD)
  and the scope holds the mirror and the revision-1 copy; `update` then moves
  it to revision 2. The fetch step that reads "the fetched copy" reads the
  mirror (the clone with no commit in its key).
- **D-14:** GIT-02 scenarios: after an update, the scope holds the mirror and
  the new copy only; a mirror `fetch` warmed for a not-installed plugin is
  removed by the next cleanup.

### Claude's Discretion
- Function names, seam shapes, and unit-test layout within the
  `typescript-unit-tests` skill; each source-test pair keeps 100% direct
  coverage.
- Scenario titles and step wording within `.agents/skills/cucumber/rules/`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` -- "### Phase 16" (goal, decision, success criteria, files)
- `.planning/REQUIREMENTS.md` -- GIT-01, GIT-02, VER-01
- `.planning/phases/04-git-source-plugins/04-CONTEXT.md` -- D-05 (no refresh of a just-cloned mirror)
- `.planning/phases/12-fetch-and-prune/12-CONTEXT.md` -- fetch row and request-log decisions
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, `clone-gc.ts`, `git-source-probe.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- `resolvePluginVersion`
- `.agents/skills/cucumber/rules/layout.md` -- stream file ownership

</canonical_refs>

<deferred>
## Deferred Ideas

- Migrating records made before this phase off the mirror (their
  `resolvedSource` is the mirror, so a `fetch` still changes them until their
  next `update` or `reinstall`).
- The git-subdir path hash upstream appends to the sha version.

</deferred>

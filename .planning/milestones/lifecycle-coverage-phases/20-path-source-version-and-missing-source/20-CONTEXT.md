# Phase 20: Path-Source Version and Missing Source - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

A path-source plugin reports its version and a missing source the same way a
git-source plugin does. Requirements: VER-02, SRC-01. The 2026-10-23
second-round decision in ROADMAP "### Phase 20" is binding: follow Claude
Code unless a recorded divergence applies; path and git sources behave the
same in most respects (a git source is a path source from a cloned repo).

Today:

- `list` candidate rows (`list-candidate-row.ts`) and `info` not-installed
  rows (`info.ts::buildNotInstalledRow`) of a path-source plugin show the
  marketplace entry's version, while `install` records plugin.json's version
  first (`resolvePluginVersion`, VER-01). A warm git candidate row already
  shows plugin.json first (Phase 16 D-10).
- A path-source plugin whose directory is missing resolves `unavailable` with
  the resolver note `source dir does not exist: <path>`. The read-only
  classifier (`shared/probe-classifiers.ts::classifyResolverNote`) and the
  install classifier (`install.messaging.ts::classifyResolverReason`) both
  fall through to their `unsupported source` catch-all, so `list`, `info`,
  and `install` read `{unsupported source}`.

Files this phase owns: `orchestrators/plugin/list-candidate-row.ts`,
`orchestrators/plugin/info.ts` (not-installed path version only),
`shared/probe-classifiers.ts`, `orchestrators/plugin/install.messaging.ts`
(one classifier arm), their unit tests,
`test/architecture/cross-surface-reason-parity.test.ts` (one parity row), and
new scenarios in `features/plugin/list.feature`, `info.feature`,
`install.feature`.

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (Claude Code 2.1.309 binary)
- **D-01:** Upstream's version function (Phase 16 D-01) orders a plugin's
  version as the manifest `version`, then the catalog entry `version`, for
  every source kind; the commit tier applies only to git. For a missing
  local plugin directory upstream fails with `Plugin path not found:`,
  `Plugin directory does not exist:`, or `Plugin source directory not
  found:` -- a missing source, not an unsupported one. Both match the
  phase's success criteria; no new divergence.

### Version rule for path sources (VER-02)
- **D-02:** A path-source `list` candidate row shows
  `resolveDeclaredPluginVersion(entry, pluginRoot)` -- plugin.json's version,
  then the entry's -- whenever the resolver yields a plugin root (the
  `installable` and `partially-available` arms). The `unavailable` arm has no
  root (NFR-7) and keeps the entry version.
- **D-03:** `info` on a not-installed path-source plugin uses the same rule
  on its `available` and `partially-available` rows. Installed rows keep the
  recorded version (unchanged).
- **D-04:** The read-only surfaces do not compute the `hash-<12hex>` content
  hash a path install records when neither plugin.json nor the entry declares
  a version: it walks the whole plugin tree on every `list` row. Such a row
  keeps showing no version, as today. Recorded for the user.
- **D-05:** `install` already records plugin.json's version first
  (`resolvePluginVersion`); a scenario pins it for a path plugin whose entry
  declares a different version.

### Missing source (SRC-01)
- **D-06:** `classifyResolverNote` gains a `source dir does not exist` prefix
  arm that maps to `source missing` (the `ResolverNoteReason` union widens by
  that token), placed before the catch-all. `install.messaging.ts`'s
  `classifyResolverReason` gains the same arm before its
  `includes("source")` arm, so install and the read-only surfaces stay equal;
  `cross-surface-reason-parity.test.ts` gains the row. The note is the
  resolver's only missing-directory note, so a git tree whose plugin root is
  missing reads `source missing` too, which matches upstream.
- **D-07:** `enable-disable.messaging.ts` already maps this note to
  `source missing` (ENBL-03); it is left as is.

### Phase 10 deferred list item
- **D-08:** "`list` shows only the entry version for a fetched git plugin
  whose entry declares none" is already fixed by VER-01: a warm git
  candidate row shows plugin.json's version, then the entry's, then
  `sha-<12hex>` (Phase 16 D-10). A `list.feature` scenario pins it: after a
  `fetch` of a not-installed git plugin whose entry declares no version, the
  row shows plugin.json's version.

### Scenarios
- **D-09:** The existing step `the marketplace {string} publishes this
  manifest:` drives both conditions with no new step: an entry whose
  `version` differs from the plugin.json the plugin was published with, and
  an entry whose `source` names a directory that does not exist.
- **D-10:** New scenarios: `list.feature` (declared version on an available
  path row; `{source missing}` row; fetched git row), `info.feature`
  (declared version; `{source missing}`), `install.feature` (records the
  declared version; fails `{source missing}`).

### Claude's Discretion
- Unit-test layout within the `typescript-unit-tests` skill; each touched
  source-test pair keeps 100% direct coverage.
- Scenario titles and wording within `.agents/skills/cucumber/rules/`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` -- "### Phase 20"
- `.planning/REQUIREMENTS.md` -- VER-01, VER-02, SRC-01
- `.planning/phases/16-git-plugin-copies-and-version-rule/16-CONTEXT.md` -- D-01, D-08, D-10
- `.planning/phases/10-plugin-info/10-VERIFICATION.md` -- deferred list item
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` -- `source dir does not exist` note
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- `resolveDeclaredPluginVersion`

</canonical_refs>

<deferred>
## Deferred Ideas

- Showing the `hash-<12hex>` content hash on read-only rows of a path plugin
  that declares no version (D-04).

</deferred>

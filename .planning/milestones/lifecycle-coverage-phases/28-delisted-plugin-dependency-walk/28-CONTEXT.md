# Phase 28: Delisted Plugin Dependency Walk - Context

**Gathered:** 2026-10-24
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the orchestrating session relayed the user's decision (option B, 2026-10-24) and asked for a run without prompts, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

DLS-01: a plugin its marketplace no longer lists (installed, `{not in manifest}`)
no longer makes the scope's dependency walk unreadable. Its dependencies are
read from its installed copy, so `update`, `reinstall`, `uninstall`, `enable`,
and the load-time backfill of other plugins proceed. Only a record whose
installed copy is also unreadable fails closed (D-17 / D-05-07).

Today `readRecordDeclarations` (`orchestrators/plugin/dependency-index.ts`)
answers a record absent from its loaded manifest with
`unreadableDeclarer(key, "not in manifest", ...)`, and both scope walks stop at
the first such record (phase 18 review WR-06).

Out of scope: a manifest that fails to load (missing, unreadable, invalid)
keeps failing closed exactly as today; the walk's whole-scope fail-closed unit
(STALE-DECLARER-01's per-record narrowing); `forceRemoveDeletedPlugins`
auto-uninstall.

</domain>

<decisions>
## Implementation Decisions

### Upstream position
- **D-01:** Claude Code 2.1.309 (binary
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.309/claude`,
  grepped 2026-10-24; docs `plugins/dependencies.md`, `plugins/loading.md`)
  does not load a delisted plugin. The loader looks the marketplace entry up
  first and, when it is missing, pushes
  `{type:"plugin-not-found", source, pluginId, marketplace, ...}` ("Plugin "x"
  not found in marketplace "m"") without reading the cached `plugin.json`.
  Reverse dependents are computed over loaded plugins only
  (`Y(e,n){return n.filter((o)=>o.enabled&&o.source!==e&&(o.manifest.dependencies??[]).some(...))}`),
  and install ranges come from loaded plugins' `depConstraints` only. So
  upstream treats a delisted plugin as declaring nothing, because it is not
  running at all. Confidence: high for load, reverse dependents and install
  ranges; medium for auto-update (not traced exhaustively).

### The divergence (DLS-D1)
- **D-02 (DLS-D1, user, 2026-10-24):** a delisted plugin that Pi keeps running
  (v1.18 divergence) keeps its dependencies from its installed copy, so it
  still protects its dependencies and constrains other plugins; upstream skips
  the plugin entirely because it does not load it. License: a recorded project
  decision (this ID). It follows from v1.18's existing divergence: a plugin Pi
  keeps loading must keep the dependencies it loads with.

### The installed-copy read
- **D-03:** the installed copy is the record's `resolvedSource`, the plugin root
  its install materialized (`plugin-clones/<key>/...` for a git source, the
  plugin directory inside the marketplace clone for a path source). The read
  walks the shared `MANIFEST_CANDIDATES` ordering, as the own-manifest read
  does. NFR-10: the root must sit inside the marketplace clone root or the
  scope's `plugin-clones/`; one outside both reads as no copy.
- **D-04:** outcomes of the read, all through the existing fail-closed arm:
  - readable manifest → its `dependencies` (absent key = declares nothing, as
    D-01-32 reads a readable own manifest);
  - `dependencies` the parser rejects → `invalid manifest` (unchanged arm);
  - manifest present but unusable → `unreadable manifest`, fixed phrase
    `its own manifest is present but cannot be read` (unchanged arm);
  - no copy or no manifest in it (a path-source plugin whose directory the
    marketplace deleted, a root outside the owning roots) → `not in manifest`,
    phrase `not declared by its marketplace, and its installed copy cannot be
    read`. There is no entry to fall back on, so this is D-05-07's "no usable
    answer", never "declares nothing". Target rows keep `{unreadable}` with
    this cause (phase 17 D-06).
- **D-05:** the read is a sibling export of `dependency-declaration-read.ts`
  (`readInstalledCopyDeclaration`) so it shares the reader seam, the candidate
  walk and the refusal literal, and stays inside that file's network-free
  read (NFR-5).

### The delisted warning row (REC-05 kept)
- **D-06:** the phase 17 per-session warning for a delisted plugin stays, as
  its own row, our counterpart to upstream's `plugin-not-found` load error. It
  no longer depends on the walk failing: reconcile scans each scope's records
  against their loaded manifests after the backfill step and reports every
  enabled record its marketplace does not list.
- **D-07:** the row keeps phase 17's shape, `⊘ <plugin> [<scope>] (failed)
  {not in manifest}` at `warning`, `needsReload: false`, with the cause
  `Plugin "<plugin>" not found in marketplace "<marketplace>"` (upstream's
  text). It reuses the walk's `plugin-declarer-unreadable` outcome, whose row
  shape is identical. (Revised in execution: a separate outcome kind pushed
  the reconcile router past fallow's cyclomatic ceiling of 20, and the lint
  rule `switch-exhaustiveness-check` requires every case to stay listed.)
- **D-08:** only enabled records get the row: upstream raises
  `plugin-not-found` while loading enabled plugins. A marketplace whose manifest
  fails to load reports nothing here; that fault is the walk's own row.
- **D-09:** RECON-04 single-emit: a plugin that already has a failed,
  uninstalled, or declarer-unreadable row this pass gets no delisted row, so a
  delisted plugin whose copy is unreadable reads once, with the walk's cause.

### Typed checks, not message text
- **D-10:** `enable-disable.ts` tells a delisted root by
  `read.reason === "not in manifest"` instead of matching the cause text. A
  sweep of `extensions/` found no other classification by walk-cause text
  (the edge's `message === usage` compares are the usage string, not a fault).

### Claude's Discretion
- Module placement of the reconcile scan; naming of the outcome kind.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 28; `.planning/REQUIREMENTS.md` DLS-01
- `.planning/phases/18-update-and-reinstall-unification/18-REVIEW.md` WR-06
- `.planning/phases/17-reconcile-stale-declarer-warning/17-CONTEXT.md` (REC-05 row shape)
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (`reportUnreadableDeclarer`)

</canonical_refs>

# Phase 07: Marketplace-repository tag resolution for path-source dependencies - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A version constraint on a path-source dependency (the common case — most marketplaces declare plugins with `"source": "./plugins/x"`) resolves against the marketplace repository's own `{name}--v{version}` tags, read from the local marketplace clone with no network access. When no tag satisfies, the install proceeds with the marketplace's current copy instead of failing, and the constraint is checked at load by Phase 6's reconcile check. When a tag does satisfy, the plugin's files are materialized from that tag, not the current checkout, and the install record's version reflects the tag. `docs/dependency-resolution.md` also gains a divergence entry: upstream accepts a `sha` field on a dependency element; this extension refuses it (D-03-36).

</domain>

<decisions>
## Implementation Decisions

### Materialization mechanics (the ROADMAP-named open mechanics question)
- **D-07-01:** Reuse the existing `plugin-clones/<key>/` content-addressed cache and its GC sweep (`orchestrators/plugin/clone-cache.ts`, `clone-gc.ts`) rather than inventing a second materialization mechanism. Concretely: check out the winning tag's tree into a new `plugin-clones/<key>/` directory using isomorphic-git's `checkout()` with a separate `dir`/`gitdir` pair — `gitdir` pointing at the marketplace clone's shared object store, `dir` the new key'd directory — so the marketplace clone's own working tree and HEAD are never mutated (`noUpdateHead: true`). Key it the same way existing pinned clones are keyed (by resolved tag oid), so `clone-gc.ts`'s existing live-key sweep (keyed off `resolvedSource` in state) covers it with no new GC logic. — **Reversibility:** costly — changing the materialization mechanism later means re-deriving cache keys and re-running GC against a different directory shape; every existing dependency-pin install path this milestone builds on assumes this cache convention.
- Tag listing itself is a NEW seam distinct from the existing `probeDependencyTags`/`listRemoteTags` path: that path lists a *dependency's own remote repository's* advertised tags over the network. Path sources have no such repository, so this phase lists the *marketplace clone's local* tags via `platform/git.ts`'s isomorphic-git `listTags`, not the advertised-refs path (keeps `no-orchestrator-network.test.ts` passing).

### Version provenance (TAGS-03) — already decided by Phase 3 precedent, not re-litigated
- **D-07-02:** The installed record's version is the tag's own parsed semver (from `{name}--v{version}`), never the checked-out `plugin.json`'s `version` field, matching the existing git-source tag-pin convention (`install-cascade.ts:215`, `ResolvedCascadeMember.pin.version`) so `recordedVersionSatisfies` can re-check the pin on a later install. Verified this also matches upstream: the installed Claude Code binary's own comment says a "tag-derived semver … [is used] in preference to manifest.version, since the upstream may have forgotten to bump plugin.json."

### Fallback notice tone (TAGS-02)
- **D-07-03:** When no tag satisfies the constraint and the marketplace's current copy installs instead, the row's notice is a **quiet info-level note**, not a warning. Deliberate divergence from upstream: the installed Claude Code binary surfaces this exact fallback (falling back to a non-tag-derived version for constraint purposes) as an explicit "warning" in its message text (`Plugin dependency install warning for {name}: resolved to a commit whose plugin.json says version {X}, used for constraint checks`). This project instead treats it as a plain note, because Phase 6's load-time check is what actually flags and disables a dependent if the fallback copy turns out to be genuinely out of range — the install itself always succeeds here, so nothing is wrong yet.

### Claude's Discretion
- DIVG-01's exact doc wording in `docs/dependency-resolution.md` — write it following the format of the existing divergence entries in that doc (e.g. the git-SHA / `sha`-field refusal is already explained there; this just adds that upstream accepts the field). No review requested before committing.
- Exact info-note wording/placement for the TAGS-02 fallback row (tone is locked as "quiet info", the specific phrasing is an implementation detail).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` § "Phase 7: Marketplace-repository tag resolution for path-source dependencies" — goal, success criteria, and the Notes paragraph naming the materialization mechanics question (now resolved — see D-07-01).
- `.planning/REQUIREMENTS.md` §"Marketplace-repository tag resolution (TAGS)" — TAGS-01, TAGS-02, TAGS-03 (lines 142-157); §"Divergence record (DIVG)" — DIVG-01 (line 213).
- `.planning/HANDOFF-upstream-dependency-parity.md` row 2 and row 11 — upstream behavior for path-source constraints and the `sha`-field divergence.

### Prior-phase decisions this phase builds on
- `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-CONTEXT.md` — D-06-04's purity boundary and the fixpoint sweep shape that TAGS-02's load-time check (Phase 6, already shipped) will apply to a fallback-installed dependency.

### Docs to update
- `docs/dependency-resolution.md` — §"What a version constraint can say" and §path source need the new resolution behavior; the divergence entries list (around line 216-230) gains the `sha`-field row (DIVG-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin/clone-cache.ts::materializePluginClone` / `pluginCloneKey` — the existing clone-cache pattern (key by hash of canonical URL + pin, warm-cache short-circuit on a present key dir) is the template for the new marketplace-clone tag materialization (D-07-01), even though the source clone is local rather than a fresh network clone.
- `orchestrators/plugin/clone-gc.ts::garbageCollectPluginClones` / `deriveLiveCloneKeys` — sweeps any `plugin-clones/<key>/` dir not referenced by a live install record's `resolvedSource`; a new tag-materialized dir needs no new GC logic if it's keyed and referenced the same way.
- `orchestrators/plugin/dependency-tag-probe.ts::probeDependencyTags` / `selectHighestSatisfyingTag` / `RELEASE_TAG_SEPARATOR` — the existing tag-selection logic (parse `{name}--v{version}`, pick highest satisfying) is reusable once fed a *local* tag list instead of a remote one; only the listing seam changes.
- `platform/git.ts` — has `clone`/`fetch`/`checkout`/`resolveRef`; needs a `listTags` (local, isomorphic-git, no network) added alongside the existing `listRemoteTags` used by `dependency-tag-probe.ts`.

### Established Patterns
- `ResolvedCascadeMember.pin` (install-cascade.ts) folds oid + version into one field "so a producer cannot set one without the other" — the same shape should carry the path-source tag pin.
- Failure-kind closed sets (`DependencyTagProbeResult`, `CascadeConstraintFailure`) — TAGS-02 needs a NON-failure outcome for "no matching tag on a path source" (unlike the existing git-source `no-matching-tag`, which fails the install today); this is a new success-shaped variant, not a reuse of the git-source failure arm.

### Integration Points
- `install-cascade.ts`'s member-constraint resolution is where the path-source case currently has no tag-listing option at all (docs/dependency-resolution.md:96: "A `path` source has no tag list at all... reports `{no matching version}` for every constraint except the wildcard") — this is the exact code path TAGS-01/02/03 extend.

</code_context>

<specifics>
## Specific Ideas

No specific UI/wording requirements beyond D-07-03 (info-level, not warning) — open to standard approaches for exact row phrasing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-Marketplace-repository tag resolution for path-source dependencies*
*Context gathered: 2026-09-19*

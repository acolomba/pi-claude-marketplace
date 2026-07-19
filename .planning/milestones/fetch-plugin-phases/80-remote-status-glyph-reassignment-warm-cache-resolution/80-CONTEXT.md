# Phase 80: Remote status, glyph reassignment & warm-cache resolution - Context

**Gathered:** 2026-07-13 (resumed and completed 2026-07-14 after the Phase 79.1 re-scope shipped)

**Status:** Ready for planning

<domain>
## Phase Boundary

The classification layer for git-source plugins: a new closed-set `(remote)` plugin status replacing the over-claiming manifest-only `(available)` for not-installed git-source plugins with nothing materialized locally; the `◌`/`◍` glyph reassignment as an atomic closed-set amendment; fs-only component resolution in bare `info` wherever a clone/mirror is already warm; and `list --remote` joining the PL-1 filter union. Covers RSTA-01..07. Resolver three-way union untouched (NFR-7) — `(remote)` derives at the classification layer in shared `git-source-probe.ts`.

Builds on shipped Phase 79.1: unpinned fetched-state = mirror-dir presence (`plugin-clones/<urlhash12>/`); pinned fetched-state = exact per-sha key presence. No prefix scan exists.

</domain>

<decisions>
## Implementation Decisions

### Glyph reassignment (terminal gate CLEARED)
- **D-80-01:** `◍` U+25CD is LOCKED for disabled + `will disable` rows — the operator eyeballed the rendering 2026-07-13 and cleared the gate; the `◎` U+25CE fallback is NOT needed. `◌` U+25CC moves to `(remote)`. The lockstep closed-set amendment (ICON constants, STATUS_TOKENS / PLUGIN_STATUSES tuples + completeness proofs + tripwires, `docs/output-catalog.md` byte forms, catalog-UAT fixtures, `docs/messaging-style-guide.md`) lands atomically in ONE green commit (RSTA-02).

### Fetched-state derivation (re-scoped; shipped in 79.1)
- **D-80-02:** RSTA-06 as rewritten: unpinned sources derive fetched-state from mirror-dir presence via the SC-7 chokepoint (`makePresenceProbe`'s mirror arm + `readMirrorHeadSha`, shipped in Phase 79.1); pinned sources use the exact per-sha key. Manifest pin wins for pinned entries: exact key or `(remote)`, even if stale clones of the same URL exist. Multi-clone ambiguity is structurally impossible — no prefix scan, no newest-pick heuristics.

### (remote) presentation (confirmed 2026-07-14)
- **D-80-03:** `(remote)` rows render bare: `◌ <name> [scope] (remote)` — no reason brace (REASONS closed set does not grow this milestone; parity with `(available)`). Rows stay in manifest order; no bucket re-grouping. Installed plugins NEVER render `(remote)` (D-78-04 degrade preserved: installed git plugin with missing clone stays `(upgradable)`/`(installed)`).
- **D-80-04:** Info surface: a `(remote)` plugin keeps the existing `components: not resolved` marker line (componentsResolved: false arm, unchanged wording). A warm plugin resolves components fs-only (amends INFO-05): unpinned from the mirror working tree, pinned from its per-sha clone dir; a fetched-not-installed plugin classifies via the three-way resolver on that warm tree → `(available)` / `(partially-available)` / `(unavailable)` with the same reason braces path plugins get (RSTA-04/05).
- **D-80-05:** Install completion still offers `(remote)` plugins (install performs the fetch); the completion-cache status literal set grows `remote` alongside the plugin-index cache schemaVersion 5→6 bump (RSTA-03) so pre-fix caches drop+rebuild. Output-parity drift-guard extended to the new bucket.
- **D-80-06:** `(remote)` is an inventory row: severity `info`, `needsReload: false` (like `available` / `unavailable`), appended LAST in the closed-set tuples (below the reload-hint trigger window) per the established tuple-ordering discipline.

### list --remote (locked by RSTA-07)
- **D-80-07:** `--remote` joins the PL-1 filter union family; the internal `FilterBucket` union in `list.ts` gains a `remote` member. INTENDED behavior change: `--available` stops including unfetched git-source plugins; `--available --remote` restores the pre-milestone set. Every classification path stays network-free (NFR-5).

### Claude's Discretion
- Exact tuple insertion positions (subject to the append-last / reload-hint-window rules), test file organization, and the drift-guard extension mechanics — follow the closed-set amendment precedents from the `partially-available` (USTAT-02/D-64-01) and `disabled` (D-54-01) amendments.
- docs/output-catalog.md row wording — follow the catalog's established prose style; byte forms are normative once locked.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/workstreams/url-source/REQUIREMENTS.md` — RSTA-01..07 (rewritten RSTA-06), constraints, out-of-scope table
- `.planning/workstreams/url-source/ROADMAP.md` — Phase 80 section (notes carry the lockstep discipline + resolved discuss decisions)
- `.planning/workstreams/url-source/todos/pending/2026-07-13-remote-plugin-status-fetch-verb-glyph-reassignment.md` — SEED-001 design narrative

### Closed-set / catalog discipline (the lockstep amendment set)
- `extensions/pi-claude-marketplace/shared/notify.ts` — STATUS_TOKENS (line ~211), PLUGIN_STATUSES (~400), ICON constants (~1440: `ICON_DISABLED = "◌"` is the glyph being reassigned), completeness proofs
- `docs/output-catalog.md` — byte-normative catalog rows (`components: not resolved` arms at ~1301-1433 show the marker forms)
- `docs/messaging-style-guide.md` — style guide to amend in the same commit

### Classification seams (post-79.1 state)
- `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` — `probeManifestEntry`'s git-source short-circuit to `"available"` is THE reclassification site (RSTA-01); `makePresenceProbe` mirror arm + `readMirrorHeadSha` (shipped 79.1) are the presence primitives
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` — shared classifier both list and completion consume
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `FilterBucket` union (~135), PL-1 filter predicate (~194-230), row builders
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — INFO-05 arms, componentsResolved switch
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` — status literal schema (~98-124) + schemaVersion
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` — completion bucketizer consuming the shared probe

### Phase 79.1 deliverables this phase consumes
- `.planning/workstreams/url-source/phases/79.1-mutable-mirror-clones-for-unpinned-git-plugin-sources/79.1-02-SUMMARY.md` — presence probe + readMirrorHeadSha
- `.planning/workstreams/url-source/phases/79.1-mutable-mirror-clones-for-unpinned-git-plugin-sources/79.1-CONTEXT.md` — mirror architecture decisions D-79.1-01..04

### Project rules
- `.claude/rules/typescript-comments.md` — comment policy (decision/requirement IDs allowed; no phase/plan refs)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `makePresenceProbe` (79.1 mirror arm) — the fs-only presence primitive for both pinned and unpinned arms.
- Closed-set amendment precedents: `partially-available` (USTAT-02/D-64-01) and `disabled` (D-54-01) show exactly which files a token amendment touches and the append-last ordering rules.
- Output-parity drift-guard + catalog-UAT byte-equality runner — extend, don't fork.

### Established Patterns
- Subject-first row grammar: `<glyph> <name> [scope] (status) {reason}` — status token never precedes the subject, even in mock examples.
- notify.ts is a dumb renderer: commands determine state and stamp status/severity/reasons; notify must not probe state.
- Tri-state severity: info = desired-state-reached; `(remote)` is inventory → info.
- Closed-set tuples: `as const` + `(typeof X)[number]`, new members appended LAST below the reload-hint window, with completeness proofs and tripwires updated in the same commit.

### Integration Points
- `probeManifestEntry` — replace the unconditional git-source `"available"` short-circuit with presence-derived `remote` vs warm-tree three-way resolution.
- `ManifestEntryClassification` — gains the `remote` bucket; both `list.ts` row-building and `edge-deps.ts` completion bucketizer consume it (parity by construction).
- Plugin-index / completion cache schemaVersion 5→6 — drop+rebuild invalidation for pre-fix caches.

</code_context>

<specifics>
## Specific Ideas

- The operator verified `◌ ◍ ◎` rendering personally — samples shown in-terminal 2026-07-13; `◍` is clearly distinct from `◉`/`●` in their font. No runtime re-verification needed.
- Never refuse to resolve components of a plugin we hold local information on (the 79.1 guiding principle) — warm trees ALWAYS resolve.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-07-13-remote-plugin-status-fetch-verb-glyph-reassignment` (SEED-001, `resolves_phase: 81`) — Phase 80 delivers its RSTA half; stays pending until Phase 81 ships the fetch verb.

</deferred>

---

*Phase: 80-remote-status-glyph-reassignment-warm-cache-resolution*
*Context gathered: 2026-07-13/14*

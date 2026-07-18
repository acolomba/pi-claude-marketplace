# Phase 78: Plugin git-source lifecycle - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A Pi user can update, uninstall, reinstall, list, and inspect git-source plugins with
the same guarantees as path-source plugins — atomic sha-change swaps, garbage
collection of unreferenced clones, offline warm-cache operations, and network-free
listing.

In scope: uninstall clone GC (PURL-05), update sha-change detection + atomic swap +
post-swap GC (PURL-06), offline reinstall from the warm cache (PURL-07), and
list/info status correctness for git-source plugins with zero cloning (PURL-08).

Out of scope: provider auth for private hosts (PROV-*, Phase 79); any new plugin
source shapes; marketplace-level lifecycle (done in Phase 76).

</domain>

<decisions>
## Implementation Decisions

### Clone GC mechanism (PURL-05 / PURL-06)
- **D-78-01:** GC derives references at GC time by scanning the scope's state.json
  plugin records: any record whose url+resolvedSha maps to a clone key still
  references that clone. NO persisted refcount/index artifact (derive-not-persist —
  same philosophy as the force-install derive-not-sticky decision). GC runs after the
  state mutation commits; a crash between state write and clone delete just leaves an
  orphan clone that the next GC pass removes (idempotent, NFR-3 fail-clean).

### Reinstall pin source (PURL-07)
- **D-78-02:** Reinstall re-materializes a git-source plugin from the state record's
  `resolvedSha` — NOT the manifest's current sha. Warm cache by construction, so the
  PURL-07 no-network guarantee holds unconditionally; matches reinstall's existing
  identity (targets the already-installed plugin, preserves version/installedAt).
  Manifest sha drift is update's business exclusively.

### List/info status (PURL-08)
- **D-78-03:** list/info inject the cache-presence-only probe (the non-materializing
  `resolveGitPluginRoot` arm designed in Phase 77) so an UNINSTALLED git-source
  plugin classifies and renders exactly like an uninstalled path plugin. No
  "needs network" or "cached" marker — network is install's concern. Zero new
  REASONS/status tokens.
- **D-78-04:** An INSTALLED git plugin whose cache clone is missing from disk shows
  NO status change. The clone cache is an implementation detail; installed components
  keep working from staged resources. A later reinstall on a cold cache simply
  refetches (network). No per-row clone-dir probing during list; list stays fast and
  network-free (NFR-5).

### Update semantics (PURL-06)
- **D-78-05:** Pinned entries (manifest carries sha) swap only when the manifest sha
  differs from the recorded resolvedSha. UNPINNED entries re-resolve remote HEAD at
  update time (the refresh-time half of D-77-05) and swap when the resolved sha
  differs from the recorded one. Same 3-phase atomic swap machinery as path-source
  updates; the new clone materializes into the cache BEFORE the swap; the old clone
  is GC'd after the swap iff unreferenced (D-78-01).
- **D-78-06:** Version change renders with the existing update version-arrow renderer
  using the compact forms: `v#<7hex> → v#<7hex>`. No new render grammar.

### Claude's Discretion
- Swap staging mechanics and ordering inside withStateGuard (follow the existing
  3-phase swap in update.ts).
- GC placement in the guard sequence (after state commit; exact hook point at
  planning discretion).
- Presence-probe wiring shape for list/info call sites.
- Failure classification for update-time network errors (reuse `authentication
  required` / `network unreachable` REASONS from prior phases; no new tokens
  expected — if one proves necessary, follow the closed-set amendment process).
- Update of a plugin whose upstream repo vanished (expected: existing failure
  classification path, plugin stays on recorded sha — fail-clean per NFR-3).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase definition
- `.planning/workstreams/url-source/ROADMAP.md` — Phase 78 goal + success criteria
- `.planning/workstreams/url-source/REQUIREMENTS.md` — PURL-05..08 texts; out-of-scope
  table (list must never clone, NFR-5)

### Prior phase decisions this phase builds on
- `.planning/workstreams/url-source/phases/77-plugin-clone-cache-install/77-CONTEXT.md`
  — D-77-01..06: sha-<12hex> version + resolvedSha field, cache key/location, pin-time
  vs refresh-time split, github-object routing
- `.planning/workstreams/url-source/phases/77-plugin-clone-cache-install/77-RESEARCH.md`
  — no-orchestrator-network constraint map, isomorphic-git notes, clone-cache seam
  architecture
- `.planning/workstreams/url-source/phases/77-plugin-clone-cache-install/77-03-SUMMARY.md`
  and `77-04-SUMMARY.md` — what shipped: materializePluginClone, resolvePluginPin,
  resolveRemoteRef, makeInstallCloneProbe, deriveInstallVersion

### Authority spec
- `docs/prd/pi-claude-marketplace-prd.md` — NFR-1 atomicity, NFR-3 idempotent/fail-clean,
  NFR-5 network policy, NFR-10 containment

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin/clone-cache.ts` — `materializePluginClone` (staging → checkout
  → EEXIST-tolerant rename, warm-cache short-circuit) and `resolvePluginPin` (canonical
  url + sha-over-ref + unpinned HEAD via `resolveRemoteRef`). Update re-uses BOTH;
  reinstall re-uses materialize with the recorded sha.
- `orchestrators/plugin/update.ts` — the shared per-plugin 3-phase swap (D-03) that
  git-source updates must flow through unchanged.
- `orchestrators/plugin/reinstall.ts` — "reads the cached marketplace manifest only,
  preserves the installed record's version/installedAt" — the identity D-78-02 extends.
- `domain/resolver.ts` — `resolveGitPluginRoot` injection seam; the presence-probe arm
  (`not-cached` result) is what list/info inject per D-78-03.
- `persistence/state-io.ts` — `resolvedSha` field (D-77-02) — the GC reference source
  and the reinstall pin source.
- `domain/clone-key.ts` — `pluginCloneKey(url, sha)` — the url+sha → cache key mapping
  GC uses to match records to clone dirs.

### Established Patterns
- withStateGuard single-writer discipline; all disk mutations atomic (NFR-1).
- Derive-not-persist for computed state (force-install precedent).
- Closed-set REASONS tokens; no new tokens expected this phase.
- `no-orchestrator-network` architecture gate: uninstall/list/info must not import
  gitOps; update.ts is already an exempt legal consumer; clone-cache.ts is the seam.

### Integration Points
- `orchestrators/plugin/uninstall.ts` — gains post-uninstall GC (derive + delete).
- `orchestrators/plugin/update.ts` — gains the git-source refresh arm (pin re-resolution,
  materialize-before-swap, GC-after-swap).
- `orchestrators/plugin/list.ts` / `info.ts` — gain the presence-probe injection.
- `plugin-state-classifier.ts` — status derivation must stay token-neutral for git
  plugins (D-78-03/04).

</code_context>

<specifics>
## Specific Ideas

- GC = scan state records → compute live clone keys → delete cache dirs not in the
  set (scoped to the entries just touched, or a full sweep — planner's choice, but
  idempotent either way).
- Reinstall offline guarantee is a hard acceptance criterion: a test must prove
  reinstall completes with a GitOps stub that FAILS on any network call when the
  cache is warm.

</specifics>

<deferred>
## Deferred Ideas

- Private-host auth for update-time fetches — Phase 79 (provider registry wires into
  the same clone-cache seam).
- Any `(cache missing)` / `(cached)` list markers — rejected for now (D-78-03/04);
  revisit only if real-world confusion shows up post-ship.

</deferred>

---

*Phase: 78-plugin-git-source-lifecycle*
*Context gathered: 2026-07-11*

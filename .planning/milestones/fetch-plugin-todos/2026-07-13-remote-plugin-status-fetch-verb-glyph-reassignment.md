---
created: 2026-07-13T15:43:17.563Z
title: Add (remote) plugin status, fetch verb, and glyph reassignment
area: plugin
resolves_phase: 81
files:
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/shared/notify.ts:400-430,1439-1475
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - docs/output-catalog.md
  - docs/messaging-style-guide.md
---

## Problem

`info` on a git-source ("remote source") plugin renders `components: not
resolved`, so the user cannot assess whether the plugin will install. Two
distinct causes:

1. The INFO-05 gate ("only `path` sources are locally resolvable") predates the
   Phase 77 clone cache. Installed git-source plugins ALWAYS have a
   materialized clone, and previously-fetched shas sit warm in
   `plugin-clones/`, yet info never resolves from them
   (`buildNonPathInstalledRow` emits `componentsResolved: false`
   unconditionally).
2. Unfetched git-source plugins genuinely cannot be resolved without network —
   but `list`/completion classify them `(available)` straight from the
   manifest (78-09), which over-claims: nothing is validated until fetched.

Design settled in conversation 2026-07-13 (post-url-source-milestone
candidate):

1. **New closed-set plugin status `(remote)`** for git-source plugins
   (url / git-subdir / github) whose clone is not materialized locally —
   replaces the manifest-only `(available)` classification. Install completion
   still offers `(remote)` plugins (install performs the fetch).
   Reclassification lands in the shared `git-source-probe.ts` consumed by both
   list and the completion bucketizer; the output-parity drift-guard keeps
   surfaces in lockstep. Requires plugin-index cache schemaVersion bump 5→6.
2. **Glyph reassignment**: `◌` U+25CC dotted circle moves from disabled to
   `(remote)` (Unicode placeholder-glyph semantics: "belongs here but isn't
   present"). Disabled (and the shared `will disable` row) gets `◍` U+25CD
   circle-with-vertical-fill (grayed-out metaphor; fails-safe toward the
   installed family). No dotted-circle-with-fill codepoint exists in Unicode;
   `◎` U+25CE is the fallback if `◍` renders poorly in the terminal font —
   verify rendering before locking catalog byte forms. Lockstep closed-set
   amendment: ICON constants, STATUS_TOKENS/PLUGIN_STATUSES tuples +
   completeness proofs + tripwires, output-catalog byte forms, catalog-UAT
   fixtures, messaging-style-guide.
3. **New `fetch` command** (pi-only verb; upstream has none — verified
   code.claude.com/docs 2026-07-13): materializes a git-source plugin clone
   into the shared cache without installing. Idempotent no-op at info severity
   for path sources and already-warm caches (desired-state-reached tri-state
   model). Document explicitly as a pi extension to the upstream-aligned
   /plugin surface.
4. **`info --fetch`** = fetch + resolve. Bare `info` stays network-free (NFR-5
   preserved). Independently: warm-cache component resolution in bare info
   (fs-only via the presence probe) fixes cause 1 with no network-policy
   change.
5. **Post-fetch status** derives from the three-way resolver on the warm
   clone: available / partially-available / unavailable; then installed /
   partially-installed after install. Keep the D-78-04 degrade: an installed
   git plugin with a missing clone stays `(upgradable)`, never regresses to
   `(unavailable)`.
6. **GC stance**: fetched-but-uninstalled clones remain unreferenced and
   sweepable by `garbageCollectPluginClones` (derive-not-persist; status
   self-heals back to `(remote)`). No persisted fetch registry.
7. **Unpinned sources**: the presence probe can derive "fetched at some sha"
   offline by prefix-scanning `plugin-clones/<urlhash12>-*` (cache key
   structure `<12hex sha256(url)>-<sha12>` supports this without persisting
   state).

## Solution

One coherent discuss-phase-sized phase for a next milestone. Amends INFO-05,
PURL-08, and NFR-5 wording. Scope: closed-set token + glyph reassignment +
probe reclassification + fetch orchestrator + `info --fetch` + completion
bucket + cache schema bump + catalog rows. Route through
`/gsd-phase` → `/gsd-discuss-phase` when the next milestone opens.

## Draft requirements (consistency-checked 2026-07-13)

Compatible with NFR-1/3/7/10, tri-state severity, closed-set grammar,
derive-not-persist. Three amendments required (INFO-05, PURL-08, NFR-5); the
resolver's three-way union is untouched — `(remote)` derives at the
classification layer.

### RSTA — remote status and state derivation

- **RSTA-01**: `(remote)` closed-set plugin status for a not-installed
  git-source plugin with no materialized clone; replaces manifest-only
  `(available)` in list/info/install-completion. Plugin rows only; never
  applies to installed plugins.
- **RSTA-02**: `◌` U+25CC becomes the `(remote)` glyph; disabled + `will
  disable` move to `◍` U+25CD (fallback `◎`; verify terminal rendering before
  locking byte forms). Lockstep amendment: ICON constants, status tuples +
  proofs + tripwires, catalog byte forms, style guide.
- **RSTA-03**: Classification in shared `git-source-probe.ts` (list AND
  completion bucketizer); output-parity drift-guard extended; plugin-index
  cache schemaVersion 5→6.
- **RSTA-04**: Materialized clone resolves components fs-only in bare `info`;
  bare info stays network-free.
- **RSTA-05**: Fetched-not-installed classifies via the three-way resolver on
  the warm clone; D-78-04 degrade preserved.
- **RSTA-06**: Unpinned sources derive fetched-state via
  `plugin-clones/<urlhash12>-*` prefix scan through the SC-7 chokepoint; no
  persisted fetch state.
- **RSTA-07**: `list --remote` filter flag selects the `(remote)` bucket,
  joining the existing PL-1 filter union family (`--installed` /
  `--available` / `--unavailable` / `--partial`; no flags = all buckets, any
  flags = union). Stays network-free. INTENDED behavior change: `--available`
  no longer includes unfetched git-source plugins once they reclassify
  `(remote)` — combine `--available --remote` for the old set.

### FTCH — fetch verb

- **FTCH-01**: `fetch <plugin>@<marketplace>` materializes the clone without
  installing; documented as a pi-only extension.
- **FTCH-02**: Idempotent (NFR-3): no-op at info severity for path sources and
  warm caches.
- **FTCH-03**: `info --fetch` = fetch then resolve; fetch failure degrades to
  `not resolved` + existing closed-set reason, never fails info. No new
  REASONS members.
- **FTCH-04**: Fetch network use is cache-miss-only (NFR-5 amendment).
- **FTCH-05**: Fetched-but-uninstalled clones stay GC-sweepable; status
  self-heals to `(remote)`.
- **FTCH-06**: Auth on fetch — DECIDED (user, 2026-07-13): parity with install
  (`buildAuthForHost`, once-per-host memo, PROV-02/03/04 semantics); explicit
  fetch is consented network. Unauthenticated-only was rejected because it
  leaves private-host plugins unfetchable.

### Remaining discuss-phase decisions

1. Fetch granularity: single plugin only in v1 (no bulk `fetch <marketplace>`).
2. Unpinned prefix-scan ambiguity: manifest pin wins; exactly-one match
   resolves; multiple matches mean "fetched" without component resolution.

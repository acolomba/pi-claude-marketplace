# Requirements: fetch-plugin (Remote Plugin Status & Fetch)

**Defined:** 2026-07-13
**Workstream:** url-source
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Give git-source plugins an honest pre-install lifecycle -- an explicit `(remote)` status for unfetched plugins replacing the over-claiming manifest-only `(available)`, a pi-only `fetch` verb that warms the shared clone cache without installing, and fs-only component resolution in `info` wherever a clone is already warm.

Scope adopted from SEED-001 (requirement set consistency-checked 2026-07-13). Amends INFO-05, PURL-08, and NFR-5 wording; the resolver three-way union is untouched (NFR-7) -- `(remote)` derives at the classification layer.

Amended at Phase 80 discuss (2026-07-13): the seed's RSTA-06 prefix-scan design was rejected in favor of mutable mirror clones for unpinned sources (MIRR-01..06, inserted Phase 79.1); RSTA-06 rewritten to mirror-dir presence.

## v1 Requirements

### Mutable mirror clones (unpinned sources)

- [x] **MIRR-01**: An unpinned git-source plugin (url / git-subdir / github with no manifest `sha`) is backed by exactly ONE mutable mirror clone per canonical URL at `plugin-clones/<urlhash12>/` (no sha suffix); pinned sources keep the per-sha immutable content-addressed cache (`plugin-clones/<urlhash12>-<sha12>/`) unchanged
- [x] **MIRR-02**: Mirror refresh is in-place at parity with marketplace clone update (fetch + force-update ref + checkout); idempotent or fail-clean (NFR-3); a concurrent same-URL operation never corrupts the mirror
- [x] **MIRR-03**: Install/update/reinstall of an unpinned git plugin consume the mirror working tree; the recorded version remains the resolved sha (PURL-09 / PI-7 preserved)
- [x] **MIRR-04**: GC treats the mirror as referenced while any installed plugin records that canonical URL unpinned; unreferenced mirrors are swept by `garbageCollectPluginClones` (derive-not-persist)
- [x] **MIRR-05**: The fs-only presence probe and classifier derive unpinned fetched-state from mirror-dir existence through the SC-7 chokepoint -- no prefix scan, no network; components resolve fs-only from the mirror working tree
- [x] **MIRR-06**: Pre-existing per-sha clones of unpinned sources (previous design) coexist safely: installed plugins' recorded url+sha references stay valid until a lifecycle op re-anchors them to the mirror; orphaned per-sha clones sweep via GC; no persisted migration state

### Remote status and state derivation

- [x] **RSTA-01**: User sees `(remote)` -- a new closed-set plugin status -- for a not-installed git-source plugin (url / git-subdir / github) with no materialized clone; replaces the manifest-only `(available)` classification in list/info/install-completion. Plugin rows only; never applies to installed plugins
- [x] **RSTA-02**: `◌` U+25CC becomes the `(remote)` glyph; disabled and `will disable` rows move to `◍` U+25CD (fallback `◎`; verify terminal rendering before locking byte forms). Lockstep closed-set amendment: ICON constants, status tuples + completeness proofs + tripwires, output-catalog byte forms, catalog-UAT fixtures, messaging style guide
- [x] **RSTA-03**: `(remote)` classification lands in shared `git-source-probe.ts` consumed by BOTH list and the completion bucketizer; output-parity drift-guard extended; plugin-index cache schemaVersion 5→6
- [x] **RSTA-04**: Bare `info` resolves components fs-only from a materialized clone; bare `info` stays network-free (amends INFO-05)
- [x] **RSTA-05**: A fetched-not-installed plugin classifies via the three-way resolver on the warm clone (available / partially-available / unavailable); the D-78-04 degrade is preserved -- an installed git plugin with a missing clone stays `(upgradable)`, never regresses to `(unavailable)`
- [x] **RSTA-06**: Unpinned sources derive fetched-state offline from mirror-dir presence (`plugin-clones/<urlhash12>/`, MIRR-05) through the SC-7 chokepoint; components resolve fs-only from the mirror; no persisted fetch state. (Rewritten at Phase 80 discuss 2026-07-13 -- mirror presence replaces the prefix-scan design; multi-clone ambiguity is impossible by construction. Manifest pin still wins for pinned entries: exact key or `(remote)`)
- [x] **RSTA-07**: User can `list --remote` to select the `(remote)` bucket, joining the PL-1 filter union family (`--installed` / `--available` / `--unavailable` / `--partial`; no flags = all buckets, any flags = union); stays network-free. INTENDED behavior change: `--available` no longer includes unfetched git-source plugins once they reclassify `(remote)` -- combine `--available --remote` for the old set

### Fetch verb

- [x] **FTCH-01**: User can `fetch <plugin>@<marketplace>` to materialize a git-source plugin clone into the shared cache without installing; documented as a pi-only extension to the upstream-aligned `/plugin` surface (upstream has no fetch verb -- verified code.claude.com/docs 2026-07-13)
- [x] **FTCH-02**: `fetch` is idempotent (NFR-3): no-op at info severity for path sources and already-warm caches (desired-state-reached tri-state model)
- [x] **FTCH-03**: User can `info --fetch` to fetch then resolve; a fetch failure degrades to `not resolved` + an existing closed-set reason and never fails info. No new REASONS members
- [x] **FTCH-04**: Fetch network use is cache-miss-only (NFR-5 amendment)
- [x] **FTCH-05**: Fetched-but-uninstalled clones stay sweepable by `garbageCollectPluginClones` (derive-not-persist); status self-heals back to `(remote)` after a sweep
- [x] **FTCH-06**: Fetch auth is at parity with install (`buildAuthForHost`, once-per-host memo, PROV-02/03/04 semantics); explicit fetch is consented network. DECIDED 2026-07-13 -- unauthenticated-only rejected because it leaves private-host plugins unfetchable
- [x] **FTCH-07**: User can `fetch @<marketplace>` to fetch every fetchable plugin in a marketplace, and bare `fetch` to fetch across ALL marketplaces; per-plugin rows at bulk-update grammar parity (headers, summary lines); a per-plugin fetch failure never aborts the sweep. (Promoted from v2 at Phase 81 discuss 2026-07-14 -- operator wants all three shapes in v1.)

## v2 Requirements

### Fetch verb

*(none -- FTCH-07 promoted to v1 at Phase 81 discuss 2026-07-14)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persisted fetch registry / refcount | Derive-not-persist house invariant; fetched-state derives from `plugin-clones/` contents at read time (RSTA-06, FTCH-05) |
| New REASONS members | FTCH-03 reuses the existing closed set; the only closed-set growth is the `(remote)` status token + glyph reassignment (RSTA-01/02) |
| Resolver union changes | The three-way `installable` / `partially-available` / `unavailable` state is untouched (NFR-7); `(remote)` derives at the classification layer |
| Upstream `/plugin fetch` parity claim | Upstream Claude Code has no fetch verb (verified 2026-07-13); `fetch` ships documented as a pi-only extension |
| Fetch progress UI / rich output | Standard notify rows only; no new output machinery |

## Constraints

- **NFR-5 (amended by this milestone)**: `fetch` and `info --fetch` may touch the network **on cache miss only**; bare `info`, `list` (including `--remote`), and all RSTA classification stay network-free.
- **NFR-1 / NFR-3**: Clone materialization reuses the Phase 77 staging + atomic-rename cache seam; fetch is idempotent or fail-clean.
- **NFR-7**: The discriminated resolver state is preserved; no fourth resolver arm.
- **Closed-set lockstep discipline**: status-token and glyph amendments land atomically with catalog byte forms, catalog-UAT fixtures, style-guide frontmatter, completeness proofs, and tripwires.
- **Derive-not-persist**: no fetch state is written anywhere; presence of `plugin-clones/<key>/` IS the fetched-state.

## Remaining discuss-phase decisions

1. ~~Fetch granularity~~ -- RESOLVED at Phase 81 discuss (2026-07-14): ALL THREE shapes ship in v1 (`fetch <plugin>@<marketplace>`, `fetch @<marketplace>`, bare `fetch`); FTCH-07 promoted from v2.
2. ~~Unpinned prefix-scan ambiguity~~ -- RESOLVED at Phase 80 discuss (2026-07-13): re-scoped to mutable mirror clones (Phase 79.1, MIRR-01..06); prefix-scan dropped. Also resolved there: `◍` U+25CD rendering gate cleared (lock `◍`, no fallback).

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIRR-01 | Phase 79.1 | Complete |
| MIRR-02 | Phase 79.1 | Complete |
| MIRR-03 | Phase 79.1 | Complete |
| MIRR-04 | Phase 79.1 | Complete |
| MIRR-05 | Phase 79.1 | Complete |
| MIRR-06 | Phase 79.1 | Complete |
| RSTA-01 | Phase 80 | Complete |
| RSTA-02 | Phase 80 | Complete |
| RSTA-03 | Phase 80 | Complete |
| RSTA-04 | Phase 80 | Complete |
| RSTA-05 | Phase 80 | Complete |
| RSTA-06 | Phase 80 | Complete |
| RSTA-07 | Phase 80 | Complete |
| FTCH-01 | Phase 81 | Complete |
| FTCH-02 | Phase 81 | Complete |
| FTCH-03 | Phase 81 | Complete |
| FTCH-04 | Phase 81 | Complete |
| FTCH-05 | Phase 81 | Complete |
| FTCH-06 | Phase 81 | Complete |
| FTCH-07 | Phase 81 | Complete |

**Coverage:**

- v1 requirements: 20 total
- Mapped to phases: 20 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-13*
*Last updated: 2026-07-13 after Phase 80 discuss re-scope (Phase 79.1 inserted; MIRR-01..06 added; RSTA-06 rewritten)*

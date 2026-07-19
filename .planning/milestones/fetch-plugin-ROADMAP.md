# Roadmap: pi-claude-marketplace — url-source (URL Sources)

## Milestones

- ✅ **url-source URL Sources** — Phases 76-79 (shipped 2026-07-13)
- 🔜 **fetch-plugin Remote Plugin Status & Fetch** — Phases 80-81 (in progress)

## Phases

### In progress fetch-plugin (Remote Plugin Status & Fetch)

- [x] **Phase 79.1: Mutable mirror clones for unpinned git plugin sources** (INSERTED) - one marketplace-style mutable mirror clone per canonical URL for unpinned git sources; pinned sources keep the per-sha immutable cache (completed 2026-07-14)
- [x] **Phase 80: Remote status, glyph reassignment & warm-cache resolution** - `(remote)` closed-set status for unfetched git-source plugins, `◌`/`◍` glyph reassignment, fs-only warm-cache component resolution, and the `list --remote` filter (completed 2026-07-14)
- [x] **Phase 81: Fetch verb & info --fetch** - pi-only `fetch <plugin>@<marketplace>` warms the clone cache without installing; `info --fetch` fetches then resolves (completed 2026-07-15)

<details>
<summary>✅ url-source URL Sources (Phases 76-79) — SHIPPED 2026-07-13</summary>

- [x] Phase 76: Marketplace git-URL sources (3/3 plans) — completed 2026-07-11
- [x] Phase 77: Plugin clone cache + install (4/4 plans) — completed 2026-07-11
- [x] Phase 78: Plugin git-source lifecycle (10/10 plans incl. two UAT gap-closure waves) — completed 2026-07-13
- [x] Phase 79: Provider-auth registry (3/3 plans) — completed 2026-07-11

Full phase details: `.planning/milestones/url-source-ROADMAP.md`
Audit: `.planning/milestones/url-source-MILESTONE-AUDIT.md` (passed — 20/20 requirements, 9/9 seams)

</details>

## Phase Details

### Phase 79.1: Mutable mirror clones for unpinned git plugin sources (INSERTED)

**Goal**: An unpinned git-source plugin (url / git-subdir / github with no manifest `sha`) is backed by exactly ONE marketplace-style mutable mirror clone per canonical URL at `plugin-clones/<urlhash12>/` — refreshed in place like a marketplace clone — so fetched-state derives from a single well-known directory and multi-clone ambiguity is impossible by construction; pinned sources keep the per-sha immutable content-addressed cache unchanged.
**Depends on**: Phase 77 (clone cache + staging seam; shipped, archived), Phase 78 (fs-only presence probe / classifier seams; shipped, archived)
**Requirements**: MIRR-01, MIRR-02, MIRR-03, MIRR-04, MIRR-05, MIRR-06
**Success Criteria** (what must be TRUE):

  1. Installing an unpinned git-source plugin materializes/refreshes the single mirror clone at `plugin-clones/<urlhash12>/` (no sha suffix) and installs from its working tree; the recorded version remains the resolved sha (PURL-09 / PI-7 preserved). Pinned sources continue to use `plugin-clones/<urlhash12>-<sha12>/` byte-identically to today.
  2. Mirror refresh is in-place at parity with marketplace clone update (fetch + force-update ref + checkout), idempotent or fail-clean (NFR-3); a concurrent same-URL operation never corrupts the mirror.
  3. The fs-only presence probe and classifier derive unpinned fetched-state from mirror-dir existence through the SC-7 chokepoint — no prefix scan, no network — and components resolve fs-only from the mirror working tree.
  4. GC treats the mirror as referenced while any installed plugin records that canonical URL unpinned; unreferenced mirrors and orphaned per-sha clones of unpinned sources (left by the previous design) are swept by `garbageCollectPluginClones` — no persisted migration state.

**Plans**: 4/4 plans complete
Plans:
**Wave 1**

- [x] 79.1-01-PLAN.md — pluginMirrorKey (bare URL key) + materializeOrRefreshPluginMirror seam in the git-legal clone-cache tier [MIRR-01/02/03]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 79.1-02-PLAN.md — fs-only mirror presence probe + readMirrorHeadSha (loose+packed refs, real-fixture verified) [MIRR-05]
- [x] 79.1-03-PLAN.md — install + update clone-probe forks route unpinned sources to the mirror seam [MIRR-01/03]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 79.1-04-PLAN.md — reinstall warm-only fs-only repair + GC coexistence (mirror protection, orphan sweep) [MIRR-04/06]

**Notes**:

  - (INSERTED 2026-07-13 at Phase 80 discuss) Operator rejected the seed's RSTA-06 prefix-scan design — guiding principle: never refuse to resolve components of a plugin we hold local information on. One mirror per URL makes the multi-clone ambiguity structurally impossible.
  - Pinning stays — upstream contract verified at code.claude.com/docs/en/plugin-marketplaces: `sha` is the effective pin and is checked out directly; entries pin independently; the sha doubles as the version when `version` is omitted. Per-sha immutable dirs remain for pinned sources (independent pins of one monorepo need simultaneous trees; lock-free concurrency; a pinned tree survives upstream force-pushes).
  - Installed unpinned plugins from the old design keep working: their recorded url+sha per-sha clones stay referenced until a lifecycle op re-anchors them to the mirror; re-anchor timing is a discuss/plan decision for this phase.
  - Phase 81's `fetch` verb on an unpinned source becomes semantically identical to `marketplace update` (refresh the mirror).

### Phase 80: Remote status, glyph reassignment & warm-cache resolution

**Goal**: A not-installed git-source plugin with no materialized clone reads as an honest `(remote)` instead of over-claiming `(available)`; where a clone is already warm, `info`/`list` resolve components fs-only with no network; and users can filter the `(remote)` bucket with `list --remote`.
**Depends on**: Phase 78 (shared `git-source-probe.ts` classification seam, plugin-index cache, D-78-04 degrade), Phase 79 (provider auth registry — carried forward untouched), Phase 79.1 (mutable mirror clones — unpinned fetched-state derives from mirror-dir presence)
**Requirements**: RSTA-01, RSTA-02, RSTA-03, RSTA-04, RSTA-05, RSTA-06, RSTA-07
**Success Criteria** (what must be TRUE):

  1. A not-installed git-source plugin (url / git-subdir / github) with no clone in `plugin-clones/` renders `(remote)` in `list`, `info`, and install-completion — never the old manifest-only `(available)`; installed plugins never render `(remote)`.
  2. The `(remote)` glyph is `◌` U+25CC, and disabled + `will disable` rows render `◍` U+25CD (fallback `◎` if `◍` renders poorly), consistently across list/info/preview and the messaging style guide.
  3. Bare `info` on a plugin whose clone is already materialized resolves and lists its components fs-only, touching no network; a fetched-not-installed plugin classifies available / partially-available / unavailable via the three-way resolver on the warm clone, and an installed git plugin with a missing clone still degrades to `(upgradable)`/`(installed)`, never `(unavailable)`.
  4. `list --remote` selects exactly the `(remote)` bucket and composes with the other PL-1 filters as a union (`--available --remote` restores the pre-milestone `--available` set); every classification path stays network-free.

**Plans**: 4/4 plans complete
**Wave 1**

  - [x] 80-01-PLAN.md — Closed-set `(remote)` token + `◌`/`◍` glyph reassignment (lockstep amendment, one atomic commit) [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 80-02-PLAN.md — Presence-derived classification substrate: `probeManifestEntry` rewrite, `ManifestEntryClassification` + cache status union, schemaVersion 5→6, install-completion offer [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 80-03-PLAN.md — List surface consolidation, `list --remote` filter, completion-bucketizer parity [wave 3]
  - [x] 80-04-PLAN.md — Info warm-cache fs-only component resolution (not-installed + installed) [wave 3]

**Cross-cutting constraints:**

- installed git plugins never render `(remote)` (D-78-04 degrade preserved)

**Notes**:

  - Lockstep closed-set discipline (RSTA-02): ICON constants, STATUS_TOKENS / PLUGIN_STATUSES tuples + completeness proofs + tripwires, `docs/output-catalog.md` byte forms, catalog-UAT fixtures, and `docs/messaging-style-guide.md` frontmatter all land atomically in one green commit. This is why the closed-set amendment and its catalog byte forms cannot be split across phases.
  - Terminal-rendering verification of `◍` U+25CD is a gate BEFORE locking the catalog byte forms; `◎` U+25CE is the sanctioned fallback.
  - Plugin-index cache schemaVersion bumps 5→6 (RSTA-03) so pre-fix caches carrying the old `(available)` classification drop+rebuild on next read.
  - INTENDED behavior change (RSTA-07): `--available` stops including unfetched git-source plugins once they reclassify `(remote)`.
  - Amends INFO-05 (bare info resolves fs-only from a warm clone) and PURL-08 (git-source list/completion classification). Resolver three-way union untouched (NFR-7) — `(remote)` derives at the classification layer in shared `git-source-probe.ts`.
  - **Discuss-phase decisions (RESOLVED 2026-07-13)**: `◍` U+25CD terminal-rendering gate CLEARED by operator — lock `◍` for disabled + `will disable`, no fallback needed (RSTA-02). Unpinned prefix-scan ambiguity re-scoped away: RSTA-06 rewritten to mirror-dir presence via Phase 79.1; manifest pin still wins for pinned entries (exact key or `(remote)`).

### Phase 81: Fetch verb & info --fetch

**Goal**: A Pi user can warm a git-source plugin's clone cache ahead of install with a pi-only `fetch <plugin>@<marketplace>` verb, and `info --fetch` fetches-then-resolves in one step — with fetched-but-uninstalled clones staying GC-sweepable and self-healing back to `(remote)`.
**Depends on**: Phase 80 (`(remote)` self-heal target, warm-cache fs-only resolution that `info --fetch` resolves against)
**Requirements**: FTCH-01, FTCH-02, FTCH-03, FTCH-04, FTCH-05, FTCH-06, FTCH-07
**Success Criteria** (what must be TRUE):

  1. `fetch <plugin>@<marketplace>` materializes the plugin's clone into the shared cache without installing it, documented as a pi-only extension (upstream `/plugin` has no fetch verb); a re-fetch of a warm cache or a path-source plugin is an idempotent info-severity no-op.
  2. `info --fetch` fetches then resolves and lists components; a fetch failure degrades to `not resolved` with an existing closed-set reason and never fails the info command (no new REASONS members).
  3. `fetch` and `info --fetch` touch the network on cache miss only; auth on private/self-hosted hosts is at parity with install (`buildAuthForHost`, once-per-host memo).
  4. A fetched-but-uninstalled clone is reclaimed by `garbageCollectPluginClones` like any other unreferenced clone, and the plugin's status self-heals back to `(remote)` after the sweep — no persisted fetch state exists anywhere.

**Plans**: 6/6 plans complete
Plans:

**Wave 1**

- [x] 81-01-PLAN.md — fetch.messaging.ts (FETCH_CONTEXT render vocabulary; no closed-set growth) [FTCH-02]
- [x] 81-03-PLAN.md — info --fetch hook (fetch-then-resolve, degrade-safe, network-free bare info) [FTCH-03/04/06]

**Wave 2** *(blocked on Wave 1)*

- [x] 81-02-PLAN.md — fetch.ts orchestrator (3 shapes, manifest enumeration, no-op gate, once-per-host auth, failure-tolerant sweep) [FTCH-01/02/04/06/07]

**Wave 3** *(blocked on Wave 2)*

- [x] 81-04-PLAN.md — edge wiring (router/register/handler/completions) + fetch.ts added to FORBIDDEN_TARGETS [FTCH-01/07]
- [x] 81-05-PLAN.md — fetch catalog section + catalog-UAT fixtures + style-guide + README pi-only note + FTCH-05 GC self-heal regression [FTCH-01/05]

**Gap closure** *(from 81-UAT.md — warm git-subdir wrong-root)*

- [x] 81-06-PLAN.md — makePresenceProbe anchors git-subdir pluginRoot at `<clone>/<source.path>` fs-only (shared subdir helper extracted to fs-utils; regression coverage across info/list/completion/fetch) [RSTA-04/05, FTCH-04/06]

**Notes**:

  - Clone materialization reuses the Phase 77 staging + atomic-rename cache seam (NFR-1); fetch is idempotent or fail-clean (NFR-3).
  - NFR-5 amendment: `fetch` / `info --fetch` are the only new network paths, and only on cache miss; explicit fetch is consented network (FTCH-04/06).
  - Derive-not-persist (FTCH-05): presence of `plugin-clones/<key>/` IS the fetched-state; no fetch registry or refcount is written.
  - FTCH-06 is DECIDED (2026-07-13) — fetch auth at install parity; do not re-litigate.
  - **Discuss-phase decisions (RESOLVED 2026-07-14)**: Fetch granularity — ALL THREE shapes ship in v1 (`fetch <plugin>@<marketplace>`, `fetch @<marketplace>`, bare `fetch` across all marketplaces); FTCH-07 promoted from v2. Success output = post-fetch derived status row; no-ops render `(skipped)` + closed-set reason at info severity (update-verb parity); bulk output at bulk-update grammar parity, per-plugin failures never abort the sweep. Completion offers `(remote)` + unpinned-warm git-source plugins.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 76. Marketplace git-URL sources | url-source | 3/3 | Complete | 2026-07-11 |
| 77. Plugin clone cache + install | url-source | 4/4 | Complete | 2026-07-11 |
| 78. Plugin git-source lifecycle | url-source | 10/10 | Complete | 2026-07-13 |
| 79. Provider-auth registry | url-source | 3/3 | Complete | 2026-07-11 |
| 79.1. Mutable mirror clones for unpinned git plugin sources | fetch-plugin | 4/4 | Complete    | 2026-07-14 |
| 80. Remote status, glyph reassignment & warm-cache resolution | fetch-plugin | 4/4 | Complete    | 2026-07-14 |
| 81. Fetch verb & info --fetch | fetch-plugin | 6/6 | Complete    | 2026-07-14 |

# Roadmap: pi-claude-marketplace — url-source (URL Sources)

## Overview

Today only `github` (owner/repo) and `path` (local) sources work end-to-end; every
other git source surfaces as `unavailable {unsupported source}`. This milestone makes
arbitrary git HTTPS URL sources first-class for both marketplaces and plugins, across
every surface and lifecycle operation. The journey moves along the natural difficulty
gradient: first widen the marketplace side (lighter — the clone-per-marketplace
lifecycle already exists, we just stop reconstructing a github.com URL and clone
`source.url` directly), then build the genuinely new plugin-side subsystem (a
source-addressed, refcounted clone cache keyed by url+sha, shared across the ~180
`git-subdir` plugins that back external monorepos), then generalize the GitHub-only
Device Flow auth into a provider registry so public repos on any host clone
unauthenticated and private/self-hosted hosts can register their own flow. Public-repo
unauthenticated clone works from Phase 76 onward; provider auth is the follow-on.

## Phases

**Phase Numbering:**

- Integer phases (76, 77, 78, 79): Planned milestone work (continues from Phase 75, the last force-install phase)
- Decimal phases (76.1, 76.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 76: Marketplace git-URL sources** - `marketplace add/update/remove/list/info` accept arbitrary HTTPS git URLs by cloning `source.url` directly; config reconcile and import map URL sources too (marketplace-level `git-subdir` dropped — no upstream concept) (completed 2026-07-11)
- [x] **Phase 77: Plugin clone cache + install** - source-addressed refcounted clone cache (url+sha) plus resolver classifies `url`/`git-subdir`/`github`-object plugins installable; `install` clones at pinned sha and records the resolved commit (completed 2026-07-11)
- [x] **Phase 78: Plugin git-source lifecycle** - `update`/`uninstall`/`reinstall`/`list`/`info` work for git-source plugins with sha-change atomic swaps, last-reference GC, offline warm-cache operations, and network-free listing (completed 2026-07-11)
- [x] **Phase 79: Provider-auth registry** - generalize the GitHub-only Device Flow into a `GitAuthProvider` registry; public repos on any host clone unauthenticated, registered hosts run their flow, unregistered hosts fail clean, and the no-credential-leak gate covers every provider file (completed 2026-07-11)

## Phase Details

### Phase 76: Marketplace git-URL sources

**Goal**: A Pi user can add, update, remove, list, and inspect a marketplace sourced from any public HTTPS git URL, and declare such marketplaces in config or import them from Claude settings. (Marketplace-level `git-subdir` was dropped in phase discussion — upstream Claude Code has no subdirectory-marketplace concept; `git-subdir` remains a plugin-source concept for Phase 77.)
**Depends on**: Nothing (first phase of this milestone; builds on the existing clone-per-marketplace lifecycle)
**Requirements**: MURL-01, MURL-03, MURL-04, MURL-05, MURL-06, MURL-07
**Success Criteria** (what must be TRUE):

  1. User can `marketplace add <https-git-url>` and the repo is cloned directly from `source.url` (no github.com reconstruction), then its plugins list normally
  2. `marketplace update` re-fetches a URL-sourced marketplace with the same atomic-swap semantics as a GitHub source, and `marketplace remove` deletes its clone and state
  3. `marketplace list` and `marketplace info` render URL-sourced marketplaces with the correct source display
  4. A `claude-plugins.json` entry with a URL source reconciles at load time, and `import` maps an `extraKnownMarketplaces` entry with a URL source

**Plans**: 3/3 plans complete
**Wave 1**

- [x] 76-01-PLAN.md — Widen the source-string parser (generic https, owner/repo@ref fold, github normalization) + live samePlannedSource url arm + `authentication required` REASONS token [Wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 76-02-PLAN.md — Marketplace add/update/remove url arms: shared clone-into-guard, verbatim clone with no auth, S5b gate, HttpError classification, clone-deletion gate [Wave 2]
- [x] 76-03-PLAN.md — Info surface url projection + last_updated gate + import dual-shape extraKnownMarketplaces reader + catalog UAT byte forms [Wave 2]

### Phase 77: Plugin clone cache + install

**Goal**: A Pi user can install a plugin whose source is a `url`, `git-subdir`, or `github`-object entry; the plugin clones once into a shared source-addressed cache and installs its supported components, with the recorded version reflecting the resolved commit.
**Depends on**: Phase 76 (direct-clone plumbing and containment-vs-clone-root patterns established for marketplaces)
**Requirements**: PURL-01, PURL-02, PURL-03, PURL-04, PURL-09
**Success Criteria** (what must be TRUE):

  1. A plugin with a `url` / `git-subdir` / `github`-object source resolves installable (no longer `unavailable {unsupported source}`); partial-component degradation still applies on top of the three-way resolver state
  2. `install` clones the plugin source at its pinned sha into the shared clone cache; a second install of a plugin referencing the same url+sha completes with no new clone (deduped), and a warm-cache install completes offline
  3. For a `git-subdir` plugin, the plugin root resolves to clone-root + subdirectory, and no write escapes the plugin's own clone root (NFR-10 anchored to the clone root, not `marketplaceRoot`)
  4. The recorded plugin version reflects the pinned/resolved commit; an unpinned source resolves to remote head at install time and records the resolved sha

**Plans**: 4/4 plans complete

**Wave 1** *(parallel — no file overlap)*

- [x] 77-01-PLAN.md — Pure leaf primitives: cache-key helper, `sha-<12hex>` version + display transform, `plugin-clones/` SC-7 chokepoint, additive `resolvedSha` state field [Wave 1]
- [x] 77-02-PLAN.md — Resolver widening: classify url/git-subdir/github installable, inject `resolveGitPluginRoot` policy, clone-root-anchored git-subdir containment [Wave 1]

**Wave 2** *(blocked on 77-01)*

- [x] 77-03-PLAN.md — Clone-cache seam: `materializePluginClone` (dedup + offline warm cache + sha-over-ref pin + EEXIST-tolerant rename), `resolveRemoteRef` unpinned-HEAD primitive [Wave 2]

**Wave 3** *(blocked on 77-01, 77-02, 77-03)*

- [x] 77-04-PLAN.md — Install wiring: inject clone-materializing callback, thread `resolvedSha` into the state record, git-source `sha-<12hex>` version branch, keep install.ts gitOps-free [Wave 3]

### Phase 78: Plugin git-source lifecycle

**Goal**: A Pi user can update, uninstall, reinstall, list, and inspect git-source plugins with the same guarantees as path-source plugins — atomic sha-change swaps, garbage collection of unreferenced clones, offline warm-cache operations, and network-free listing.
**Depends on**: Phase 77 (clone cache and installable git-source plugins exist)
**Requirements**: PURL-05, PURL-06, PURL-07, PURL-08
**Success Criteria** (what must be TRUE):

  1. `update` detects a sha change in the marketplace manifest, fetches the new clone, swaps the plugin atomically, and garbage-collects the old clone once it is unreferenced
  2. `uninstall` garbage-collects a cached clone when its last referencing plugin is removed, and leaves the clone intact while another installed plugin still references it
  3. `reinstall` of a cached git-source plugin completes with no network
  4. `list` and `info` show git-source plugins with correct status and never clone (listing stays network-free)

**Plans**: 10/10 plans complete

**Wave 1** *(parallel — no file overlap)*

- [x] 78-01-PLAN.md — fs-only clone-GC helper (garbageCollectPluginClones, derive-not-persist live keys, idempotent delete) [Wave 1]
- [x] 78-02-PLAN.md — extract canonicalCloneUrl (pure) + shared resolveGitSubdirRoot from clone-cache/install for reinstall reuse [Wave 1]
- [x] 78-03-PLAN.md — list/info presence probe + uninstalled-git (available) short-circuit, network-free (PURL-08) [Wave 1]

**Wave 2** *(blocked on Wave 1)*

- [x] 78-04-PLAN.md — uninstall post-commit GC of the last-referencer clone (PURL-05) [Wave 2, depends 78-01]
- [x] 78-05-PLAN.md — reinstall offline recorded-sha probe + resolvedSha carry-forward (PURL-07) [Wave 2, depends 78-02]
- [x] 78-06-PLAN.md — update sha-change swap, materialize-before-swap, resolvedSha finalize, GC-after-swap, version-arrow verify (PURL-06) [Wave 2, depends 78-01]

**Gap closure** *(from UAT — cross-config-layer removal gap; not a phase-78 regression)*

- [x] 78-07-PLAN.md — cross-layer cascade config delete in standalone marketplace remove + plugin uninstall (sweep base AND local; self-heal the perpetual dangling-reference) [Wave 1]
- [x] 78-08-PLAN.md — new `dangling reference` reason token (closed-set catalog amendment) so the diagnostic stops reusing `{source mismatch}` at both reconcile render sites [Wave 1]

**Gap closure round 2** *(from round-2 UAT — completion-parity + marketplace-remove clone GC)*

- [x] 78-09-PLAN.md — shared git-source probe module consumed by list AND completion bucketizer; plugin-index cache schemaVersion 4→5; output-parity drift-guard so install completion offers git-source plugins (available) at parity with list (PURL-08) [Wave 1]
- [x] 78-10-PLAN.md — wire garbageCollectPluginClones into the marketplace-remove post-commit cascade so removing the last referencing marketplace drops its git-source plugin clones (PURL-05, PURL-06) [Wave 1]

### Phase 79: Provider-auth registry

**Goal**: A Pi user can clone public repos from any host without authentication, authenticate against private/self-hosted hosts that have a registered provider, and receive a clean actionable error for hosts with no provider — all with no credential ever leaking into output.
**Depends on**: Phase 76 (direct-clone call sites with the hardcoded `host = "github.com"` seams are the parameterization points; git-source plugin cloning from Phase 77 also flows through the same auth wiring)
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05
**Success Criteria** (what must be TRUE):

  1. A `GitAuthProvider` registry (id, host match, authenticate) exists, and the GitHub provider wraps the existing RFC-8628 Device Flow with byte-identical behavior for github.com
  2. A public repo on any host clones unauthenticated with no provider involved
  3. An auth-required clone against a host with a registered provider runs that provider's flow and stores the credential host-keyed via `CredentialOps`
  4. An auth-required clone against a host with no registered provider fails clean with an actionable error and no isomorphic-git retry loop
  5. The no-credential-leak architecture gate (`tests/architecture/no-credential-leak.test.ts`) covers every provider file

**Plans**: 3/3 plans complete

**Wave 1**

- [x] 79-01-PLAN.md — GitAuthProvider registry (auth-registry.ts) + parameterize the github-auth.ts engine by an optional descriptor (byte-identical github.com) + extend the no-credential-leak gate (PROV-01, PROV-05) [Wave 1]

**Wave 2** *(blocked on 79-01)*

- [x] 79-02-PLAN.md — buildAuthForHost helper + marketplace add/update per-host provider lookup + resolveRemoteRef auth threading + no-provider cause line (PROV-02, PROV-03, PROV-04) [Wave 2]

**Wave 3** *(blocked on 79-01, 79-02)*

- [x] 79-03-PLAN.md — plugin clone-cache/install/update/reinstall auth threading + once-per-host memo, install/reinstall stay gitOps-free (PROV-02, PROV-03, PROV-04) [Wave 3]

## Progress

**Execution Order:**
Phases execute in numeric order: 76 → 77 → 78 → 79

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 76. Marketplace git-URL sources | 3/3 | Complete    | 2026-07-11 |
| 77. Plugin clone cache + install | 4/4 | Complete    | 2026-07-11 |
| 78. Plugin git-source lifecycle | 10/10 | Complete    | 2026-07-13 |
| 79. Provider-auth registry | 3/3 | Complete    | 2026-07-11 |

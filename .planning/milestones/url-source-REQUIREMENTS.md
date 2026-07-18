# Requirements Archive: url-source URL Sources

**Archived:** 2026-07-13
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: url-source (URL Sources)

**Defined:** 2026-07-10
**Workstream:** url-source
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Everything that can be done for the current `github` and `path` sources works for arbitrary git URL sources -- for both marketplaces and plugins, across every surface and lifecycle operation.

## v1 Requirements

### Marketplace URL sources

- [x] **MURL-01**: User can `marketplace add` an arbitrary public HTTPS git URL (`url` kind); the repo is cloned directly from `source.url` (no github.com URL reconstruction)
- [x] **MURL-03**: `marketplace update` re-fetches URL-sourced marketplaces with the same atomic-swap semantics as GitHub sources today
- [x] **MURL-04**: `marketplace remove` deletes URL-sourced marketplace clones and state
- [x] **MURL-05**: `marketplace list` / `marketplace info` render URL-sourced marketplaces with correct source display
- [x] **MURL-06**: `claude-plugins.json` config declarations with URL sources reconcile at load time (v1.12 declarative-config surface)
- [x] **MURL-07**: `import` maps `extraKnownMarketplaces` entries with URL sources (v1.2 Claude-settings-import surface)

### Plugin URL sources

- [x] **PURL-01**: Resolver classifies `url` / `git-subdir` / `github`-object plugin sources as installable (no longer `unavailable {unsupported source}`); partial component degradation still applies on top of the three-way state
- [x] **PURL-02**: `install` clones the plugin source at its pinned sha into a shared clone cache; a warm cache install completes offline
- [x] **PURL-03**: `git-subdir` plugin root = clone root + subdirectory path, with NFR-10 containment anchored to the plugin's own clone root (not `marketplaceRoot`)
- [x] **PURL-04**: Clone cache is source-addressed (keyed by url+sha) and deduped -- one external monorepo clone serves every plugin that references it
- [x] **PURL-05**: `uninstall` garbage-collects a cached clone when its last referencing plugin is removed
- [x] **PURL-06**: `update` detects sha changes in the marketplace manifest, fetches the new clone, swaps the plugin atomically, and GCs the old clone when unreferenced
- [x] **PURL-07**: `reinstall` of a cached git-source plugin completes without network
- [x] **PURL-08**: `list` / `info` show git-source plugins with correct status and never clone (list stays network-free)
- [x] **PURL-09**: Recorded plugin version reflects the pinned/resolved commit; unpinned sources resolve to remote head at install time and record the resolved sha

### Provider auth (AUTH-D02)

- [x] **PROV-01**: `GitAuthProvider` registry (id, host match, authenticate); the GitHub provider wraps the existing RFC-8628 Device Flow state machine with byte-identical behavior for github.com
- [x] **PROV-02**: Public repos on any host clone unauthenticated -- no provider required
- [x] **PROV-03**: Auth-required on a host with a registered provider runs that provider's flow; the credential is stored host-keyed via `CredentialOps`
- [x] **PROV-04**: Auth-required on a host with no registered provider fails clean with an actionable error (no isomorphic-git retry loop)
- [x] **PROV-05**: The no-credential-leak architecture gate (`tests/architecture/no-credential-leak.test.ts`) covers every provider file

## v2 Requirements

### Provider auth

- **PROV-06**: GitLab provider (device-flow config: endpoints, client_id, scope `read_repository`, credential mapping `oauth2`) -- registry must make this config-shaped, but no GitLab provider ships in v1
- **PROV-07**: Per-source explicit provider declaration for self-hosted GitHub Enterprise / self-managed GitLab hosts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Marketplace-level `git-subdir` sources (ex-MURL-02) | Dropped in Phase 76 discussion (2026-07-11): upstream Claude Code has no subdirectory-marketplace concept anywhere (no CLI syntax, no `extraKnownMarketplaces` shape; marketplace.json must sit at repo root). `git-subdir` remains a plugin-source concept (PURL-03) |
| `npm` plugin sources | Registry+tarball fetch, not git; zero occurrences in the official directories |
| SSH git URLs (`git@host:...`, `ssh://`) | Auth model (device flow + `git credential` over https) is https-oriented; https covers the observed ecosystem |
| Remote `marketplace.json` URLs, sparse checkout, browser-paste `/tree/<ref>` URLs | Pre-existing V1 non-goals, unchanged by this milestone |
| GitLab provider implementation | Deferred to v2 (PROV-06); this milestone ships the registry + GitHub provider only |
| Cloning during `list` | `list` must stay network-free (NFR-5); resolution uses manifest + cache presence only |

## Constraints

- **NFR-5 (amended)**: `install`/`update`/`reinstall` of git-source plugins may touch the network **only on cache miss**; warm sha-pinned cache operations stay offline. `list`, `uninstall`, `marketplace remove`, and path-source operations remain network-free.
- **NFR-1**: All clone-cache and state mutations atomic (staging + rename; same-FS placement under the scope root).
- **NFR-10**: Containment re-anchored -- plugin roots must resolve inside their **owning clone root** (marketplace clone for `path` sources, plugin-source clone for git sources).
- **NFR-7**: The discriminated resolver state (`installable` / `partially-available` / `unavailable`) is preserved; git-source support widens the `installable` arm, it does not add a fourth state.
- **No-credential-leak gate**: any new file that interpolates tokens into errors/notifications must be added to the architecture scan.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MURL-01 | Phase 76 | Complete |
| MURL-03 | Phase 76 | Complete |
| MURL-04 | Phase 76 | Complete |
| MURL-05 | Phase 76 | Complete |
| MURL-06 | Phase 76 | Complete |
| MURL-07 | Phase 76 | Complete |
| PURL-01 | Phase 77 | Complete |
| PURL-02 | Phase 77 | Complete |
| PURL-03 | Phase 77 | Complete |
| PURL-04 | Phase 77 | Complete |
| PURL-09 | Phase 77 | Complete |
| PURL-05 | Phase 78 | Complete |
| PURL-06 | Phase 78 | Complete |
| PURL-07 | Phase 78 | Complete |
| PURL-08 | Phase 78 | Complete |
| PROV-01 | Phase 79 | Complete |
| PROV-02 | Phase 79 | Complete |
| PROV-03 | Phase 79 | Complete |
| PROV-04 | Phase 79 | Complete |
| PROV-05 | Phase 79 | Complete |

**Coverage:**

- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-11 after Phase 76 discussion (MURL-02 dropped — no upstream subdirectory-marketplace concept)*

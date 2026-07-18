# Phase 77: Plugin clone cache + install - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A Pi user can install a plugin whose source is a `url`, `git-subdir`, or `github`-object
entry; the plugin clones once into a shared source-addressed cache and installs its
supported components, with the recorded version reflecting the resolved commit.

In scope: resolver classification of the three git source shapes as installable
(PURL-01), install-time clone into the per-scope cache at the pinned/resolved sha
(PURL-02), git-subdir plugin-root resolution with NFR-10 containment anchored to the
clone root (PURL-03), source-addressed dedup keyed by url+sha (PURL-04), and
sha-derived version recording (PURL-09).

Out of scope (later phases): uninstall GC of unreferenced clones (PURL-05, Phase 78),
update sha-change swaps (PURL-06, Phase 78), offline reinstall (PURL-07, Phase 78),
list/info network-free rendering guarantees (PURL-08, Phase 78), and any private-repo
auth for non-github or github hosts (PROV-*, Phase 79).

</domain>

<decisions>
## Implementation Decisions

### Version recording (PURL-09)
- **D-77-01:** Git-source plugins record version `sha-<12hex>` — the first 12 hex chars
  of the resolved commit sha with a `sha-` prefix. Parallels the PI-7 `hash-<12hex>`
  convention, names the provenance (git commit vs content hash), stays compact on the
  list surface. Exact-equality comparison semantics only, same as hash-versions.
- **D-77-02:** The plugin install record ALSO stores the full 40-hex resolved sha in a
  dedicated state.json field (additive schema change). Phase 78 update/GC compares full
  shas — never 12-hex truncations. The `sha-<12hex>` version string is display-level.

### Clone cache location & key (PURL-02 / PURL-04)
- **D-77-03:** The cache is per-scope: `<scopeRoot>/pi-claude-marketplace/plugin-clones/<key>/`.
  Stays inside the NFR-10 containment boundary, same-FS with the staging area so
  tmp+rename stays atomic (NFR-1), and scope removal cleans its own cache. Dedup
  applies within a scope.
- **D-77-04:** Cache entries are keyed `<12hex(sha256(url))>-<sha12>` — a 12-hex
  truncation of the SHA-256 of the canonical clone URL, a dash, and the first 12 hex of
  the resolved commit sha. Fixed-length, filesystem-safe for any https URL, no
  sanitization edge cases. state.json records the url+sha per plugin, so
  human-readable reverse lookup is always available. (Verified during discussion: the
  existing marketplace convention `sources/<manifest-name>` cannot be reused because
  the plugin cache must dedup by SOURCE, not by name — two differently-named plugins
  referencing the same url+sha share one clone.)

### Unpinned install policy (PURL-09)
- **D-77-05:** Install is pin-time; update (Phase 78) is refresh-time. An unpinned
  manifest entry resolves remote HEAD at install and records the resolved sha. A later
  unpinned install referencing the same url REUSES any cached clone for that url — no
  network on warm cache (offline success criterion), maximal dedup. Staleness is
  addressed only by Phase 78 `update`.

### github-object routing (PURL-01)
- **D-77-06:** github-object plugin sources reconstruct the canonical public URL
  `https://github.com/<owner>/<repo>` and flow through the SAME plugin-clones cache
  path as url sources — one clone lifecycle, and a `url` entry and `github` entry
  naming the same repo dedup to one clone. Public-only in this phase: a private github
  plugin repo fails with the existing `authentication required` REASONS token. Phase 79
  parameterizes auth for this single seam via the provider registry.

### Claude's Discretion
- Resolver three-way state / partial-component degradation interplay mechanics — follow
  the existing resolver architecture (NFR-7 discriminated `installable` union).
- git-subdir escape/missing-subdir failure UX — reuse existing REASONS tokens where
  truthful; mint a new token only if no existing token is truthful, following the
  closed-set catalog amendment process established in Phase 76 (lockstep: token +
  tripwire + catalog + style guide).
- Cold-cache offline install failure classification (likely `network unreachable`).
- Whether the sha256(url) canonicalization uses the parse-time canonical URL (`.git`
  stripped, ref split off) — recommended yes, so dedup is insensitive to `.git` suffix
  variance; encode concretely at planning time.
- Ref-but-no-sha manifest entries: resolving the ref to a sha at install time (pin the
  resolved sha per D-77-05) — mechanics at Claude's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase definition
- `.planning/workstreams/url-source/ROADMAP.md` — Phase 77 goal + success criteria
- `.planning/workstreams/url-source/REQUIREMENTS.md` — PURL-01..04, PURL-09 texts;
  out-of-scope table (npm sources, SSH URLs, sparse checkout all excluded)

### Prior phase decisions this phase builds on
- `.planning/workstreams/url-source/phases/76-marketplace-git-url-sources/76-CONTEXT.md`
  — D-76-01..13: parse-time `.git` canonicalization + `#ref` split, github-host
  normalization, verbatim-URL public-only clone discipline, `authentication required`
  token, closed-set catalog amendment process
- `.planning/workstreams/url-source/phases/76-marketplace-git-url-sources/76-RESEARCH.md`
  — HttpError duck-typing idiom (D-13), MA-9 append-leak discipline, isomorphic-git
  behavior notes

### Authority spec
- `docs/prd/pi-claude-marketplace-prd.md` — PI-7 hash-version contract (§11), NFR-1
  atomicity, NFR-5 network policy, NFR-10 containment

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `domain/source.ts` — already parses ALL three plugin source shapes:
  `urlObjectSource` (line ~150), `gitSubdirObjectSource` (~169, `kind: "git-subdir"`
  with url + path), `githubObjectSource` (~129). Phase 77 does not add parsing; it
  consumes existing `ParsedSource` kinds.
- `domain/resolver.ts:503` — the exact rejection seam: `unsupported source kind:
  ${parsedSource.kind}`. PURL-01 widens this gate.
- `domain/version.ts` — PI-7 `hash-<12hex>` computation; the `sha-<12hex>` sibling
  belongs here with a `looksLike*` predicate pattern.
- `persistence/locations.ts` — `ScopedLocations` brand + containment-checked path
  helpers (SC-7/D-15 single chokepoint); the plugin-clones dir + key helper must be
  added HERE, not composed by string concat at call sites.
- `orchestrators/marketplace/add.ts` — `addGitClonedInGuard` (extracted in 76-02):
  staging-clone → validate → atomic rename lifecycle to mirror for plugin clones.
- `platform/git.ts` — `CloneOptions` with optional auth (absent for public url clones).

### Established Patterns
- Staging + atomic rename on same FS (D-09) for all clone materialization.
- Duck-typed git error classification at the orchestrator boundary (no isomorphic-git
  import outside platform tier, D-13).
- Closed-set REASONS tokens; new tokens are lockstep catalog amendments.
- Discriminated `installable: true | false` union (NFR-7) — resolver widening must
  keep the discriminated shape so non-installable plugins cannot expose `pluginRoot`.

### Integration Points
- `orchestrators/plugin/install.ts` — where clone-before-install slots in.
- `orchestrators/plugin/plugin-state-classifier.ts` + list/info surfaces — must render
  `sha-<12hex>` versions; list stays network-free (no cache probing that clones).
- `persistence/state-io.ts` — plugin install record gains the full-sha field
  (additive; mirror the migration discipline used for `resources.hooks` / `enabled`).

</code_context>

<specifics>
## Specific Ideas

- Cache key format locked: `<12hex(sha256(canonical-url))>-<sha12>` under
  `plugin-clones/`. Canonical URL should be the parse-time canonical form.
- Version string locked: `sha-<12hex>`; full sha in its own field.
- One clone lifecycle for all three source shapes; github-object reconstructs
  `https://github.com/<owner>/<repo>`.

</specifics>

<deferred>
## Deferred Ideas

- Private-repo auth for plugin clones (github device-flow reuse) — explicitly routed
  to Phase 79's provider registry; Phase 77 ships public-only with `authentication
  required` failures.
- Clone GC, sha-change update swaps, offline reinstall, list/info lifecycle guarantees
  — Phase 78 (PURL-05..08).

</deferred>

---

*Phase: 77-plugin-clone-cache-install*
*Context gathered: 2026-07-11*

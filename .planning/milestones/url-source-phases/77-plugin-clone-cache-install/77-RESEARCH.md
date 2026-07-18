# Phase 77: Plugin clone cache + install - Research

**Researched:** 2026-07-11
**Domain:** Resolver widening + install-time git clone cache + source-addressed dedup + additive state schema (all in-tree TypeScript against the already-pinned isomorphic-git@1.38.5; no new external deps)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Version recording (PURL-09)**
- **D-77-01:** Git-source plugins record version `sha-<12hex>` — the first 12 hex chars of the resolved commit sha with a `sha-` prefix. Parallels the PI-7 `hash-<12hex>` convention, names the provenance (git commit vs content hash), stays compact on the list surface. Exact-equality comparison semantics only, same as hash-versions.
- **D-77-02:** The plugin install record ALSO stores the full 40-hex resolved sha in a dedicated state.json field (additive schema change). Phase 78 update/GC compares full shas — never 12-hex truncations. The `sha-<12hex>` version string is display-level.

**Clone cache location & key (PURL-02 / PURL-04)**
- **D-77-03:** The cache is per-scope: `<scopeRoot>/pi-claude-marketplace/plugin-clones/<key>/`. Stays inside the NFR-10 containment boundary, same-FS with the staging area so tmp+rename stays atomic (NFR-1), and scope removal cleans its own cache. Dedup applies within a scope.
- **D-77-04:** Cache entries are keyed `<12hex(sha256(url))>-<sha12>` — a 12-hex truncation of the SHA-256 of the canonical clone URL, a dash, and the first 12 hex of the resolved commit sha. Fixed-length, filesystem-safe for any https URL, no sanitization edge cases. state.json records the url+sha per plugin, so human-readable reverse lookup is always available. (Verified during discussion: the existing marketplace convention `sources/<manifest-name>` cannot be reused because the plugin cache must dedup by SOURCE, not by name — two differently-named plugins referencing the same url+sha share one clone.)

**Unpinned install policy (PURL-09)**
- **D-77-05:** Install is pin-time; update (Phase 78) is refresh-time. An unpinned manifest entry resolves remote HEAD at install and records the resolved sha. A later unpinned install referencing the same url REUSES any cached clone for that url — no network on warm cache (offline success criterion), maximal dedup. Staleness is addressed only by Phase 78 `update`.

**github-object routing (PURL-01)**
- **D-77-06:** github-object plugin sources reconstruct the canonical public URL `https://github.com/<owner>/<repo>` and flow through the SAME plugin-clones cache path as url sources — one clone lifecycle, and a `url` entry and `github` entry naming the same repo dedup to one clone. Public-only in this phase: a private github plugin repo fails with the existing `authentication required` REASONS token. Phase 79 parameterizes auth for this single seam via the provider registry.

### Claude's Discretion
- Resolver three-way state / partial-component degradation interplay mechanics — follow the existing resolver architecture (NFR-7 discriminated `installable` union).
- git-subdir escape/missing-subdir failure UX — reuse existing REASONS tokens where truthful; mint a new token only if no existing token is truthful, following the closed-set catalog amendment process established in Phase 76 (lockstep: token + tripwire + catalog + style guide).
- Cold-cache offline install failure classification (likely `network unreachable`).
- Whether the sha256(url) canonicalization uses the parse-time canonical URL (`.git` stripped, ref split off) — recommended yes, so dedup is insensitive to `.git` suffix variance; encode concretely at planning time.
- Ref-but-no-sha manifest entries: resolving the ref to a sha at install time (pin the resolved sha per D-77-05) — mechanics at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
- Private-repo auth for plugin clones (github device-flow reuse) — explicitly routed to Phase 79's provider registry; Phase 77 ships public-only with `authentication required` failures.
- Clone GC, sha-change update swaps, offline reinstall, list/info lifecycle guarantees — Phase 78 (PURL-05..08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PURL-01 | Resolver classifies `url` / `git-subdir` / `github`-object plugin sources as installable (no longer `unavailable {unsupported source}`); partial degradation still applies on the three-way state | Widen `sourceUnsupportedReason` (resolver.ts:497) so `url`/`git-subdir`/`github` return `undefined` (not a reject reason). Rework `preflightStages` pluginRoot derivation (resolver.ts:593) to be cache-root-relative for git sources — but WITHOUT cloning (resolver is network-free; shared with list/info). Recommended: split the git-source pluginRoot into an injected `resolveGitPluginRoot` callback on `ResolveContext` so `list`/`info` pass a cache-presence-only probe and `install` passes the clone-materializing one (see Pattern 1). |
| PURL-02 | `install` clones the plugin source at its pinned sha into a shared clone cache; warm-cache install completes offline | New clone-cache seam OUTSIDE `install.ts` (which the NFR-5 architecture guard forbids from touching `gitOps`). The seam clones into `sourcesStagingDir(uuid)` then atomic-renames into `plugin-clones/<key>/` — mirroring `addGitClonedInGuard` (add.ts:618). Warm cache = key dir already exists → skip clone entirely (offline). See Pattern 2 + the architecture-guard finding. |
| PURL-03 | `git-subdir` plugin root = clone root + subdirectory; NFR-10 containment anchored to the plugin's own clone root (not `marketplaceRoot`) | pluginRoot = `path.resolve(cloneRoot, subdir.path)`; `assertPathInside(cloneRoot, pluginRoot, ...)` (mirror resolver.ts:507 `sourceEscapeReason`, re-anchored to cloneRoot). A missing subdir → `source missing`; an escaping subdir → structural `unavailable` note. |
| PURL-04 | Clone cache is source-addressed (keyed by url+sha) and deduped | Key = `<12hex(sha256(canonicalUrl))>-<sha12>` (D-77-04). A second install of any plugin (any name, any of the three source shapes) resolving to the same canonical-url+sha finds the key dir present and skips the clone. |
| PURL-09 | Recorded version reflects the pinned/resolved commit; unpinned resolves to remote head at install and records the resolved sha | Version = `sha-<12hex>` (D-77-01) written to the state record's `version` field; full 40-hex sha in a NEW additive `resolvedSha` field (D-77-02). Pin precedence: `sha` (if set) wins over `ref`; unpinned → resolve remote HEAD via `getRemoteInfo2`/`listServerRefs` at install (D-77-05). |
</phase_requirements>

## Summary

Phase 77 is where the milestone stops being surface-widening and adds a genuinely new capability: an install-time, source-addressed, deduped git clone cache for plugins. Unlike Phase 76 (marketplace URL sources, which reused the existing clone-per-marketplace lifecycle), plugin sources must dedup by SOURCE, not by name — so the `sources/<name>/` convention cannot be reused, and a new `plugin-clones/<key>/` cache is introduced (D-77-03/04).

The parsing is already done. `domain/source.ts` already parses all three shapes with `url`/`path`/`ref`/`sha` fields (`UrlSource`, `GitSubdirSource`, `GitHubSource` at lines 39–54), and the upstream-parity check confirms these field names are byte-exact against Claude Code's documented schema (see Upstream Parity below). Phase 77 does NOT touch the parser; it consumes existing `ParsedSource` kinds.

**The central architectural tension** is that the resolver (`resolveStrict`) is invoked by BOTH `install` AND the network-free `list`/`info` surfaces, and a `tests/architecture/no-orchestrator-network.test.ts` gate forbids `install.ts` from importing `gitOps`/`platform/git`/`DEFAULT_GIT_OPS` at all. The clone must therefore happen in a NEW seam that `install.ts` calls (not inside the resolver, not inside install.ts's own body), and the resolver's git-source pluginRoot derivation must be an INJECTED callback so `list`/`info` supply a cache-presence-only probe (no clone) while the install path supplies the clone-materializing one. This is the load-bearing design decision the planner must lock.

**Primary recommendation:** (1) Widen `sourceUnsupportedReason` to accept the three git kinds. (2) Add an injected `resolveGitPluginRoot(source) => Promise<GitPluginRootResult>` to `ResolveContext` — network-free probe for list/info (returns "not-cached" → the plugin renders as not-yet-materialized, NOT unavailable), clone-materializing for install. (3) Put the actual clone logic in a NEW module (e.g. `orchestrators/plugin/clone-cache.ts` or a `plugin-clones`-suffixed helper in `orchestrators/marketplace/shared.ts`) that imports `gitOps` and is NOT in the network-guard's forbidden list; install.ts calls it. (4) Add `ScopedLocations.pluginCloneDir(key)` + `pluginCloneKey(url, sha)` chokepoint helpers. (5) Add the `sha-<12hex>` version + the additive `resolvedSha` state field.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse `url`/`git-subdir`/`github` object sources (with `ref`/`sha`) | `domain/source.ts` (already done) | — | Parser already emits the three kinds with all fields; Phase 77 adds nothing here. |
| Classify git sources installable + derive pluginRoot | `domain/resolver.ts` | injected `resolveGitPluginRoot` callback | Resolver must stay network-free (shared with list/info); the clone-vs-probe policy is injected by the caller, not decided in the resolver. |
| Compute cache key + expose `plugin-clones/<key>/` path | `persistence/locations.ts` (`pluginCloneDir` + `pluginCloneKey`) | `node:crypto` (sha256) | SC-7 single containment chokepoint; the key is a name-derived path input that MUST route through `assertPathInside`. |
| Clone at sha into the cache (staging → atomic rename) | NEW seam (e.g. `orchestrators/plugin/clone-cache.ts`) importing `gitOps` | `platform/git.ts` | install.ts is forbidden `gitOps` by the network guard; the clone lives in a sibling seam install.ts calls. |
| Resolve unpinned remote HEAD → sha at install | same NEW seam | `platform/git.ts` (`getRemoteInfo2`/`listServerRefs`) | Network op; belongs where `gitOps` is legal. |
| Compute `sha-<12hex>` version + full-sha record | `domain/version.ts` (sibling of `computeHashVersion`) + `install.ts` state phase | `persistence/state-io.ts` (schema) | Version derivation is domain-pure; the state phase writes it. |
| Additive `resolvedSha` state field + migration | `persistence/state-io.ts` + `persistence/migrate.ts` | — | Mirror the `resources.hooks`/`enabled` additive-optional discipline. |
| git-subdir containment (anchor to clone root) | `domain/resolver.ts` (`assertPathInside(cloneRoot, ...)`) | `shared/path-safety.ts` | Re-anchor the existing `sourceEscapeReason` pattern from `marketplaceRoot` to the plugin's clone root (NFR-10, PURL-03). |

## Standard Stack

No new libraries. Entirely in-tree TypeScript against the already-pinned stack.

### Core (already installed — carry forward unchanged)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `isomorphic-git` | `1.38.5` | Pure-JS clone/fetch/checkout/remote-ref-listing | `git.clone({url,ref})` + `git.checkout({dir,ref:<sha>})` materialize a pinned tree; `getRemoteInfo2`/`listServerRefs` resolve an unpinned remote HEAD → sha WITHOUT a full clone. All present in the installed package. [VERIFIED: node -e require checks against node_modules/isomorphic-git 1.38.5 — clone/fetch/checkout/resolveRef/currentBranch/writeRef/listServerRefs/getRemoteInfo2 all `function`] |
| `node:crypto` | bundled (Node ≥20.19) | `createHash("sha256")` for the cache key + the `sha-<12hex>` version | Already used by `domain/version.ts::computeHashVersion`. The cache key truncates `sha256(canonicalUrl)` to 12 hex, mirroring the existing 12-hex truncation. [VERIFIED: domain/version.ts:20,31] |
| `node:fs/promises` | bundled | `mkdir` + `rename` for staging → atomic cache placement | The `sources-staging/` + `rename` same-FS pattern in `addGitClonedInGuard` is the template. [VERIFIED: add.ts:628-671] |
| `typebox` | `^1.1.38` (peer) | State schema validation | The `resolvedSha` field is an additive `Type.Optional(Type.String())` on `PLUGIN_INSTALL_RECORD_SCHEMA` — no schemaVersion bump (mirrors `lastReconciledExtensionVersion` at state-io.ts:161). [VERIFIED: state-io.ts:54-73] |

**Installation:** None. `npm install` unchanged.

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. The sole dependency touched (`isomorphic-git@1.38.5`) is an already-committed, in-use direct dependency. No audit table required.

## Architecture Patterns

### System Data Flow (install of a url / git-subdir / github-object plugin)

```
user: /claude:plugin install my-plugin@some-marketplace
        │
        ▼
installPlugin(opts)  →  withLockedStateTransaction  →  runInstallLedger
        │
        ▼
PI-2  loadCachedMarketplaceManifest(mp.manifestPath)   ← NO network
        │   entry = manifest.plugins.find(name === plugin)
        │   entry.source is a url/git-subdir/github OBJECT (ParsedSource)
        │
        ▼
PI-4  resolveStrict(entry, {                            ← STILL network-free
        marketplaceRoot: mp.marketplaceRoot,
        resolveGitPluginRoot: installCloneProbe         ← NEW injected callback
      })
        │  resolver:
        │    sourceUnsupportedReason(source) === undefined  ← WIDENED (PURL-01)
        │    git kind → await resolveGitPluginRoot(source):
        │         ├─ compute canonicalUrl (parse-time form; .git stripped)
        │         ├─ pin = source.sha ?? resolveRemoteHead(url, source.ref)  (D-77-05)
        │         ├─ key = sha256_12(canonicalUrl) + "-" + sha12(pin)
        │         ├─ cloneRoot = locations.pluginCloneDir(key)
        │         ├─ if !exists(cloneRoot): CLONE at pin into staging → rename  ← network ONLY on miss
        │         └─ pluginRoot = git-subdir ? join(cloneRoot, source.path) : cloneRoot
        │                        assertPathInside(cloneRoot, pluginRoot)        ← PURL-03 / NFR-10
        │    (probe returns { pluginRoot, resolvedSha }; resolver stores pluginRoot)
        │  → installable | partially-available | unavailable   (three-way, unchanged)
        │
        ▼
requireInstallable / requirePartialInstallable  (unchanged; git pluginRoot flows through)
        │
        ▼
PI-7  version = resolvePluginVersion(entry, installable)   ← for git sources, branch to sha-<12hex>
        │                                                     (D-77-01; see Pattern 4)
        ▼
5-phase ledger [skills, commands, agents, hooks, mcp, state]  (UNCHANGED — reads pluginRoot)
        │
        ▼
state phase: record { version: "sha-<12hex>", resolvedSha: "<40hex>", resolvedSource: pluginRoot, ... }
```

### Pattern 1: The resolver stays network-free — inject the git-pluginRoot policy

**What:** `resolveStrict`/`resolveLoose` are called by install (may clone) AND by `list`/`info` (must NOT clone; the `no-orchestrator-network` guard lists both). Do NOT make the resolver clone. Add an OPTIONAL injected callback to `ResolveContext`:

```typescript
// domain/resolver.ts — ResolveContext gains:
export interface ResolveContext {
  readonly marketplaceRoot: string;
  readonly readFileText?: (p: string) => Promise<string>;
  readonly statKind?: StatKindReader;
  // NEW: git-source pluginRoot policy. Absent → git sources resolve `unavailable`
  // (back-compat with pure path-source callers). Present → the resolver delegates
  // clone-vs-probe to the caller.
  readonly resolveGitPluginRoot?: (source: UrlSource | GitSubdirSource | GitHubSource)
    => Promise<GitPluginRootResult>;
}

// Discriminated result so a not-yet-materialized cache miss on the LIST path
// is NOT the same as a structural defect:
export type GitPluginRootResult =
  | { readonly kind: "materialized"; readonly pluginRoot: string; readonly resolvedSha: string }
  | { readonly kind: "not-cached" }        // list/info cache-miss: render "not installed", never clone
  | { readonly kind: "escapes"; readonly detail: string }   // git-subdir escaped clone root → unavailable
  | { readonly kind: "missing-subdir"; readonly detail: string }; // subdir absent → source missing
```

**When to use:** the resolver's `preflightStages` git-source branch. For a git kind, call `ctx.resolveGitPluginRoot(source)` INSTEAD of `path.resolve(ctx.marketplaceRoot, parsedSource.raw)` (resolver.ts:593). Path sources keep the existing `marketplaceRoot`-relative derivation unchanged.

**Install callback:** clones on cache-miss, returns `materialized` (with `resolvedSha`). **List/info callback:** probes `exists(pluginCloneDir(key))` only — returns `materialized` if present (offline, from the already-recorded sha in state), `not-cached` if absent. **NEVER clones on the list path** (NFR-5, PL-3). The `resolvedSha` for the list probe comes from the recorded `state.plugins[].resolvedSha` (D-77-02) — this is exactly why the full sha is persisted.

**Boundary note (D-11/D-13):** the resolver is in `domain/`, which may NOT import `platform/git` or the orchestrator `gitOps`. The callback is injected by the ORCHESTRATOR that owns the git surface — the domain never sees isomorphic-git. This preserves the existing `ResolveContext` injection idiom (`readFileText`/`statKind` are already injected for testability; resolver.ts:240-244).

### Pattern 2: Clone-cache seam lives OUTSIDE install.ts (mirror addGitClonedInGuard)

**What:** `install.ts` cannot import `gitOps` (network guard). Put the clone in a NEW module — `orchestrators/plugin/clone-cache.ts` is the natural home — that imports `DEFAULT_GIT_OPS` from `orchestrators/marketplace/shared.ts` (the same Pattern S-9 re-export `update.ts` uses; update.ts:119). install.ts imports the seam's PURE entrypoint (which accepts an injected `gitOps` defaulting to `DEFAULT_GIT_OPS`), NOT `gitOps` itself.

**The clone body mirrors `addGitClonedInGuard` (add.ts:618) exactly:**

```typescript
// orchestrators/plugin/clone-cache.ts (NEW) — distilled from add.ts:628-698
export async function materializePluginClone(args: {
  locations: ScopedLocations;
  cloneUrl: string;          // canonical (.git-stripped) url; github reconstructs https://github.com/<o>/<r>
  pin: string;               // the resolved 40-hex sha (already remote-HEAD-resolved for unpinned)
  ref?: string;              // the pinning ref, if any (for the clone's singleBranch fetch)
  gitOps?: GitOps;           // D-12 injection; defaults to DEFAULT_GIT_OPS
}): Promise<string> {        // returns the cloneRoot
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  const key = pluginCloneKey(args.cloneUrl, args.pin);          // D-77-04
  const cloneRoot = await args.locations.pluginCloneDir(key);   // SC-7 chokepoint

  // PURL-04 dedup + PURL-02 offline warm cache: key dir present → no clone, no network.
  if (await pathExists(cloneRoot)) {
    return cloneRoot;
  }

  const stagingDir = await args.locations.sourcesStagingDir(randomUUID());
  try {
    // Clone the ref (or default branch), then checkout the exact pin (detached HEAD).
    await gitOps.clone({ dir: stagingDir, url: args.cloneUrl,
      ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }) });
    await gitOps.checkout({ dir: stagingDir, ref: args.pin });   // pin the exact commit
  } catch (err) {
    const leak = await cleanupStaging(stagingDir, "plugin clone staging");
    throw appendLeakToError(err, leak);                          // MA-9 append-leak discipline
  }
  // Atomic rename staging → plugin-clones/<key>/ (same-FS: both under extensionRoot).
  try {
    await mkdir(path.dirname(cloneRoot), { recursive: true });
    await rename(stagingDir, cloneRoot);
  } catch (err) {
    // A concurrent install may have won the race (EEXIST/ENOTEMPTY) — the winner's
    // clone is byte-equivalent (same url+sha), so treat as warm-cache success after
    // cleaning our staging. Otherwise append-leak-and-rethrow.
    /* see Pitfall 4 */
  }
  return cloneRoot;
}
```

**Do NOT add `orchestrators/plugin/clone-cache.ts` to the `no-orchestrator-network` forbidden-targets list.** It is legally allowed `gitOps` — it is the plugin equivalent of the exempt `update.ts` syncClone path. The gate stays on `install.ts`/`list.ts`/`info.ts`/`reinstall.ts`.

### Pattern 3: Cache key + `plugin-clones/` path are single-chokepoint helpers (SC-7)

**What:** Per SC-7/D-15, name-derived paths NEVER get string-concatenated at call sites — they route through `ScopedLocations` methods with `assertPathInside`. Add TWO members mirroring `sourceCloneDir`/`pluginDataDir` (locations.ts:216, 193):

```typescript
// persistence/locations.ts
readonly pluginClonesDir: string;                          // <extensionRoot>/plugin-clones/ (hard-coded suffix)
pluginCloneDir(key: string): Promise<string>;              // <pluginClonesDir>/<key>/ after assertPathInside

// implementation (mirror sourceCloneDir at locations.ts:216):
async pluginCloneDir(key: string): Promise<string> {
  assertSafeName(key, `pluginCloneDir key "${key}"`);      // key is fixed-length hex+dash — safe by construction, but gate anyway
  const candidate = path.join(pluginClonesDir, key);
  await assertPathInside(pluginClonesDir, candidate, `pluginCloneDir(${key})`);
  return candidate;
}
```

The `pluginCloneKey(url, sha)` pure helper (compute `sha256_12(canonicalUrl) + "-" + sha.slice(0,12)`) belongs in `domain/` (e.g. alongside `computeHashVersion` in `domain/version.ts`, or a new `domain/clone-key.ts`) so both the install seam and the list/info probe compute the SAME key. The key format is filesystem-safe by construction (12 lowercase-hex + `-` + 12 lowercase-hex = 25 chars, no path separators) so `assertSafeName` never rejects it — but keep the gate for defense-in-depth symmetry with the other helpers.

### Pattern 4: `sha-<12hex>` version is a sibling of `hash-<12hex>` — branch in resolvePluginVersion

**What:** D-77-01 wants git-source plugins recorded as `sha-<12hex>`. This is NOT a new tier in `resolvePluginVersion`'s 3-tier ladder (plugin.json > entry.version > hash; shared.ts:489) — the sha-version is a provenance-tagged identity for the git materialization, so it should be chosen when the source is a git kind, taking precedence over the content-hash fallback but NOT over an explicit plugin.json/entry.version (open question — see Open Q1).

```typescript
// domain/version.ts — sibling of computeHashVersion (version.ts:30)
const SHA_VERSION_RE = /^sha-[0-9a-f]{12}$/;             // mirror HASH_VERSION_RE (notify.ts:1737)
export function shaVersion(fullSha: string): string {   // "sha-" + first 12 hex
  return "sha-" + fullSha.slice(0, 12);
}
export function looksLikeShaVersion(v: string): boolean { return SHA_VERSION_RE.test(v); }
```

**Renderer:** add a `formatShaVersionForDisplay` sibling to `formatHashVersionForDisplay` (notify.ts:1752) so `sha-2ea95f857031` renders `#2ea95f8` on the list surface (mirror the `hash-` → `#<7hex>` rule). Route it through the same `renderVersion` funnel (notify.ts:1767). The full 40-hex sha stays in the state record's `resolvedSha` field (D-77-02) and is NEVER truncated for comparison (Phase 78 compares full shas).

### Anti-Patterns to Avoid
- **Cloning inside the resolver.** The resolver is `domain/`-tier and network-free; `list`/`info` call it. Cloning there would violate NFR-5 and the `no-orchestrator-network` gate (list.ts is in the forbidden set). Inject the clone-vs-probe policy (Pattern 1).
- **Importing `gitOps`/`platform/git`/`DEFAULT_GIT_OPS` into `install.ts`.** The `no-orchestrator-network` gate (tests/architecture/no-orchestrator-network.test.ts:50-73) fails the build on the literal tokens `gitOps`, `DEFAULT_GIT_OPS`, `platform/git`, `refreshGitHubClone` in install.ts. Put the clone in the sibling seam (Pattern 2); install.ts imports the seam's entrypoint by its own name.
- **Reusing `sources/<name>/` for plugin clones.** Verified during discussion (D-77-04): plugin clones dedup by SOURCE, not by name. Two differently-named plugins pointing at the same url+sha share ONE `plugin-clones/<key>/` clone. `sourceCloneDir(mp)` keys by marketplace name and is wrong here.
- **Anchoring git-subdir containment to `marketplaceRoot`.** PURL-03/NFR-10: a git-subdir plugin's containment root is its OWN clone root (`plugin-clones/<key>/`), not the marketplace clone. Re-anchor the `sourceEscapeReason` `assertPathInside` (resolver.ts:507-522) to `cloneRoot`.
- **Truncating the sha for comparison.** The `sha-<12hex>` string is display/version-identity ONLY. Phase 78 GC/update compares the FULL 40-hex `resolvedSha`. Storing only the 12-hex form would break Phase 78 (D-77-02).
- **Sparse/partial checkout for git-subdir.** Upstream Claude Code "clones sparsely to minimize bandwidth" for git-subdir, but sparse checkout is explicitly OUT OF SCOPE (REQUIREMENTS.md line 54; isomorphic-git does not support it — platform/git.ts:23 documents this). Phase 77 does a FULL clone + subdirectory path resolution. This is a deliberate, documented divergence.
- **Building an auth bundle for plugin clones.** D-77-06: public-only. A private github plugin repo fails with the existing `authentication required` token (already a REASONS member #33 from Phase 76). No CredentialOps/onAuthRequired wiring — that is Phase 79.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic clone-into-place | A new staging mechanism | `sourcesStagingDir(uuid)` + `mkdir(dirname)` + `rename` (add.ts:628-671) | Same-FS staging + atomic rename already satisfies NFR-1; `plugin-clones/` is a sibling of `sources-staging/` under `extensionRoot`, so the rename is same-FS. |
| Clone-then-pin-commit | A shell `git checkout` | `gitOps.clone({url,ref})` then `gitOps.checkout({dir,ref:<sha>})` | Both exist on the `GitOps` interface (shared.ts:103-127) and route through platform/git.ts (pure-JS, no PATH `git`). |
| Unpinned remote HEAD → sha | A `git ls-remote` subprocess | `getRemoteInfo2`/`listServerRefs` from isomorphic-git (via a NEW platform/git.ts wrapper + GitOps method) | Resolves the remote default-branch sha WITHOUT a full clone; keeps the D-13 boundary. [VERIFIED: both are `function` in isomorphic-git 1.38.5] |
| Auth-challenge / network-failure classification | Substring-matching error messages | The existing `classifyAddError` HttpError+errno ladder (add.ts:233-290) | Already maps 401/403 → `authentication required`, ENETUNREACH/etc → `network unreachable`. Reuse (extract/share) for the plugin clone-failure path. |
| MA-9 cleanup-on-throw | Ad-hoc try/finally | `cleanupStaging` + `appendLeakToError` (add.ts:641,690) | The append-leak-not-mask discipline is subtle; reuse the exact helpers. |
| Cache key path composition | `path.join(extensionRoot, "plugin-clones", key)` at call sites | `locations.pluginCloneDir(key)` (SC-7 chokepoint) | NFR-10 containment is enforced ONLY when name-derived paths route through the branded `ScopedLocations` methods. |
| `sha-<12hex>` predicate/format | A one-off regex | Mirror `HASH_VERSION_RE`/`looksLikeHashVersion`/`formatHashVersionForDisplay` (notify.ts:1737-1758) | The hash-version display machinery is the exact template; a sha sibling keeps the two consistent. |

**Key insight:** Every downstream install step (bridges materialize skills/commands/agents/hooks/mcp, cross-plugin conflict guard, state commit) already reads `resolved.pluginRoot` uniformly. Once the git pluginRoot is materialized into the cache and handed to the resolver, the 5-phase ledger is UNCHANGED. The phase's new surface is: (1) the resolver widening + injected pluginRoot policy, (2) the clone-cache seam, (3) two `ScopedLocations` helpers, (4) the sha-version + additive state field.

## Runtime State Inventory

> This is a feature-addition phase, not a rename/refactor/migration. The state schema gains ONE additive optional field; existing records are untouched (forward-compatible).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` plugin records gain an additive optional `resolvedSha` field (D-77-02) for git-source installs. Existing github/path plugin records omit it and load unchanged. New git installs also gain a `sha-<12hex>` `version` value (was `hash-<12hex>` / semver). A NEW on-disk `<extensionRoot>/plugin-clones/<key>/` cache dir tree is created at install time. | Additive `Type.Optional(Type.String())` on `PLUGIN_INSTALL_RECORD_SCHEMA` (no schemaVersion bump — mirror `lastReconciledExtensionVersion`). No migration of existing records: absent `resolvedSha` is legal. The migrate.ts pass needs NO new fill (optional field). |
| Live service config | None — no external service holds this state. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — D-77-06 is public-only; no credentials stored (Phase 79 adds host-keyed credentials). | None. |
| Build artifacts | None. | None. |

**Nothing found in categories 2–5:** verified — this phase writes only to `state.json` and the new `plugin-clones/<key>/` cache dir, both governed by NFR-10 containment under `extensionRoot`.

## Common Pitfalls

### Pitfall 1: Cloning in the resolver breaks the network-free list/info surface
**What goes wrong:** Making `resolveStrict` clone git plugins makes `/claude:plugin list` and `info` hit the network (and clone), violating NFR-5/PL-3, and the `no-orchestrator-network` gate fails because `list.ts`/`info.ts` transitively reach the git surface.
**Why it happens:** The naive fix is to derive the git pluginRoot inside the resolver by cloning — but the resolver is shared by install AND the read-only surfaces.
**How to avoid:** Inject `resolveGitPluginRoot` (Pattern 1). List/info pass a cache-presence-only probe that returns `not-cached` on a miss (the plugin renders as not-yet-materialized / recorded-sha-from-state), NEVER clones. Install passes the clone-materializing callback.
**Warning signs:** `list` of a marketplace containing a not-yet-installed git plugin triggers a network fetch, or the architecture test flags `list.ts`.

### Pitfall 2: install.ts trips the `no-orchestrator-network` architecture gate
**What goes wrong:** Adding the clone call directly in `install.ts` (or importing `gitOps`/`DEFAULT_GIT_OPS`/`platform/git`) fails `tests/architecture/no-orchestrator-network.test.ts` — it greps the comment-stripped source for the literal tokens `gitOps`, `DEFAULT_GIT_OPS`, `platform/git`, `refreshGitHubClone`.
**Why it happens:** The gate predates this phase (it was written to keep install PI-2/NFR-5-clean for the path/github era, when install never cloned) and lists install.ts explicitly (line 51).
**How to avoid:** Put the clone in a sibling seam (`orchestrators/plugin/clone-cache.ts`) that install.ts calls by the seam's own entrypoint name. The seam imports `DEFAULT_GIT_OPS` from `orchestrators/marketplace/shared.ts` (Pattern S-9, exactly as update.ts:119 does). install.ts never names `gitOps`. **Planner decision:** the `no-orchestrator-network` gate's DOC COMMENT (lines 9-49) claims install is network-free "PI-2: install consults the cached manifest only; NO network sync." That is no longer literally true post-Phase-77 (install now clones on cache-miss). The gate's token-grep on install.ts STILL holds (install.ts imports the seam, not gitOps), so the test passes unchanged — but the comment must be updated to reflect "install delegates the clone to clone-cache.ts; install.ts itself carries no git surface." Keep install.ts in the forbidden list (its body stays gitOps-free); update the rationale prose.

### Pitfall 3: git-subdir containment anchored to the wrong root
**What goes wrong:** A malicious `git-subdir` entry with `"path": "../../etc"` escapes the clone root; if containment is checked against `marketplaceRoot` (the old path-source anchor) instead of the clone root, the escape check is meaningless (the clone root is not under `marketplaceRoot`).
**Why it happens:** The existing `sourceEscapeReason` (resolver.ts:507) asserts `assertPathInside(ctx.marketplaceRoot, pluginRoot, ...)` — correct for path sources (pluginRoot IS under marketplaceRoot), wrong for git sources (pluginRoot is under `plugin-clones/<key>/`).
**How to avoid:** For git-subdir, compute `pluginRoot = path.resolve(cloneRoot, source.path)` and assert `assertPathInside(cloneRoot, pluginRoot, ...)`. A `PathContainmentError` → `escapes` result → resolver `unavailable` note (structural). This lives in the injected `resolveGitPluginRoot` callback (which knows cloneRoot) OR the resolver applies it after the callback returns the pluginRoot — recommend the callback returns the discriminated `escapes`/`missing-subdir`/`materialized` result so the containment check happens where cloneRoot is in scope (Pattern 1).
**Warning signs:** A git-subdir with a `..`-bearing path resolves installable instead of unavailable.

### Pitfall 4: Concurrent-install cache-key race on the atomic rename
**What goes wrong:** Two installs of plugins referencing the same url+sha run concurrently (e.g. an import cascade). Both see the key dir absent, both clone into their own staging, both `rename` to `plugin-clones/<key>/`. The second rename hits `ENOTEMPTY`/`EEXIST`.
**Why it happens:** The presence-check and the rename are not atomic against a peer process; `proper-lockfile` serializes per-SCOPE state writes but the clone materialization can run before/outside the state lock, and two scopes (or two in-flight cascade rows) can collide.
**How to avoid:** On `rename` failure with `EEXIST`/`ENOTEMPTY`, treat it as a warm-cache win: the peer's clone at `<key>/` is byte-equivalent (same canonical-url+sha ⇒ same tree), so clean up our staging and return `cloneRoot` as success. This is the source-addressed cache's key safety property (identical key ⇒ identical content). Any OTHER rename errno append-leaks-and-rethrows (MA-9). **Note:** whether the clone runs inside or outside the per-scope state lock is a planner decision — running it BEFORE `withLockedStateTransaction` avoids holding the lock across a network clone (good for concurrency) but requires this EEXIST-tolerant rename; running it inside the lock serializes same-scope installs but still races cross-scope. Recommend clone-before-lock + EEXIST-tolerant rename.
**Warning signs:** A parallel `import` of two plugins sharing one monorepo throws `ENOTEMPTY` on the second.

### Pitfall 5: Unpinned install records a moving target instead of a resolved sha
**What goes wrong:** An unpinned entry (`{source:"url", url:...}` with no `sha`/`ref`) records `version: "sha-<HEAD-at-clone-time>"` but the recorded `resolvedSha` doesn't match the actually-checked-out commit, or the cache key is computed from a ref name rather than the resolved sha — breaking dedup and Phase 78 comparison.
**Why it happens:** The cache key and the version BOTH depend on the resolved sha, which for an unpinned entry must be resolved (remote HEAD → sha) BEFORE the key is computed. If the flow clones first (getting whatever HEAD is) and derives the key from the ref, two unpinned installs at different times key differently even for the same commit.
**How to avoid (D-77-05):** Resolve the pin FIRST — `pin = source.sha ?? (source.ref ? resolveRemoteRef(url, source.ref) : resolveRemoteHead(url))` — THEN compute `key = sha256_12(canonicalUrl) + "-" + sha12(pin)`, THEN check cache / clone / checkout the exact `pin`. The recorded `version` and `resolvedSha` derive from the SAME `pin`. Warm-cache reuse for an unpinned url (D-77-05: a later unpinned install of the same url REUSES any cached clone) means: if ANY key-dir for that canonical-url prefix exists, reuse it offline — this needs the state record's url+sha reverse lookup, NOT a fresh remote HEAD resolve. **Open question:** the exact warm-cache-for-unpinned lookup (scan existing `plugin-clones/` for a `sha256_12(url)-*` prefix, or consult state records) — see Open Q2.

### Pitfall 6: `sha` vs `ref` precedence — sha wins when both are set
**What goes wrong:** An entry sets both `ref: "v2.0.0"` and `sha: "a1b2..."`; if the flow checks out the ref, it may resolve to a different commit than the pinned sha (the tag could have moved).
**Why it happens:** Upstream parity: "When both `ref` and `sha` are set on any of them, the `sha` is the effective pin. Claude Code fetches and checks out the pinned commit directly." (docs, verified). The parser stores both fields; the install flow must prefer `sha`.
**How to avoid:** `pin = source.sha ?? resolvedFromRef`. Use `ref` only for the `singleBranch` fetch hint (bandwidth), then `checkout({ref: pin})` the exact sha. The recorded version/resolvedSha is `pin`.
**Warning signs:** A pinned-sha install records the ref's tip instead of the sha.

## Code Examples

### Widen sourceUnsupportedReason (PURL-01)
```typescript
// domain/resolver.ts:497 (current: only "path" returns undefined; all else rejects)
// NEW: the three git kinds are now installable (their pluginRoot comes from
// the injected resolveGitPluginRoot callback). npm stays rejected.
function sourceUnsupportedReason(parsedSource: ParsedSource): string | undefined {
  switch (parsedSource.kind) {
    case "path":
    case "github":
    case "url":
    case "git-subdir":
      return undefined;                       // installable (PURL-01)
    case "npm":
      return `unsupported source kind: npm`;   // still out of scope
    case "unknown":
      return `unsupported source kind: unknown (${parsedSource.reason})`;
  }
}
```

### preflightStages git-source branch (PURL-01 / PURL-03)
```typescript
// domain/resolver.ts:592-612 (current: pluginRoot = resolve(marketplaceRoot, raw))
// NEW: path sources keep the marketplaceRoot derivation; git sources delegate.
let pluginRoot: string;
if (parsedSource.kind === "path") {
  pluginRoot = path.resolve(ctx.marketplaceRoot, parsedSource.raw);
  const escapeReason = await sourceEscapeReason(ctx, pluginRoot, parsedSource.raw);
  if (escapeReason !== undefined) {
    return { kind: "unavailable", result: unavailable(entry.name, [...partial.notes, escapeReason]) };
  }
} else {
  // url | git-subdir | github — delegate to the injected policy (network-free for list/info).
  if (ctx.resolveGitPluginRoot === undefined) {
    // No git policy injected (pure path-source caller): git sources are unavailable.
    return { kind: "unavailable", result: unavailable(entry.name,
      [...partial.notes, `git source requires a clone-cache resolver`]) };
  }
  const r = await ctx.resolveGitPluginRoot(parsedSource);
  switch (r.kind) {
    case "materialized": pluginRoot = r.pluginRoot; break;
    case "not-cached":   // list/info miss: render "not installed", not a structural defect
      return { kind: "unavailable", result: unavailable(entry.name,
        [...partial.notes, `not installed`]) };  // NOTE: planner may prefer a distinct render path
    case "escapes":
      return { kind: "unavailable", result: unavailable(entry.name, [...partial.notes, r.detail]) };
    case "missing-subdir":
      return { kind: "unavailable", result: unavailable(entry.name, [...partial.notes, r.detail]) };
  }
}
// (dir-existence + manifest read continue unchanged from resolver.ts:604)
```
> **Planner note:** the `not-cached` render is a design choice. On the LIST surface a git plugin that has never been installed should NOT read `unavailable {...}` (that implies a defect). Consider whether the list path even calls the resolver for un-installed git plugins, or whether it renders them from the manifest entry directly with a "not installed" status. Resolve against the existing list.ts candidate-resolve flow (list.ts:379-382) during planning.

### Additive resolvedSha state field (D-77-02)
```typescript
// persistence/state-io.ts:54 — additive optional; NO schemaVersion bump
const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  // D-77-02: full 40-hex resolved commit sha for git-source installs. OPTIONAL
  // (path/github-name installs omit it). Phase 78 GC/update compares this full
  // sha, never the sha-<12hex> display form. Additive — v1.0..v1.14 records load
  // unchanged; migrate.ts needs no fill (absence is legal).
  resolvedSha: Type.Optional(Type.String()),
  compatibility: Type.Object({ /* unchanged */ }),
  resources: Type.Object({ /* unchanged */ }),
  enabled: Type.Boolean(),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});
```

### getRemoteInfo2 wrapper for unpinned HEAD (D-77-05) — NEW platform/git.ts primitive
```typescript
// platform/git.ts — resolve remote default-branch (or ref) sha WITHOUT a full clone.
// Source: isomorphic-git 1.38.5 getRemoteInfo2 (protocolVersion 2 refs listing).
export async function resolveRemoteRef(opts: { url: string; ref?: string }): Promise<string> {
  const info = await git.getRemoteInfo2({ http, url: opts.url, protocolVersion: 2 });
  // info.refs is a map of ref → oid; HEAD symref resolves the default branch.
  // For opts.ref undefined → use HEAD; else the matching refs/heads/<ref> or tag.
  // (exact ref-selection logic to be pinned at planning against the installed API shape)
  /* ... */
}
```
> **Planner note:** verify the exact `getRemoteInfo2` return shape (`refs` map vs `HEAD` symref) against `node_modules/isomorphic-git/index.d.ts` at planning time; `listServerRefs` is the lower-level alternative. Both are confirmed present. This is a NEW `GitOps` method (`resolveRemoteRef`) so the clone-cache seam stays D-13-clean.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `url`/`git-subdir`/`github`-object plugin sources resolve `unavailable {unsupported source kind}` | The three git kinds resolve installable via an injected clone-cache policy | D-77-01..06 (this phase) | `sourceUnsupportedReason` widens; `npm` stays rejected. |
| Plugin version = plugin.json > entry.version > `hash-<12hex>` content hash | git-source plugins record `sha-<12hex>` (provenance-tagged) + full `resolvedSha` | D-77-01/02 (this phase) | New version provenance; renderer gains a `sha-` display arm. |
| Clones live at `sources/<marketplace-name>/` (keyed by name, one per marketplace) | Plugin clones live at `plugin-clones/<sha256_12(url)-sha12>/` (keyed by source, deduped) | D-77-03/04 (this phase) | New cache root; dedup by source across differently-named plugins. |
| `install` never touches the network (PI-2/NFR-5) | `install` clones on cache-MISS only; warm cache is offline | PURL-02 / NFR-5 amended (REQUIREMENTS.md:60) | The `no-orchestrator-network` gate's rationale prose updates; install.ts body stays gitOps-free (clone in sibling seam). |

**Deprecated/outdated by this phase:** none. All Phase 76 surfaces (marketplace url sources) are untouched.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getRemoteInfo2` returns a `refs` map / `HEAD` symref usable to resolve an unpinned default-branch sha without a full clone | Code Examples / D-77-05 | Low–Medium — the function EXISTS (verified `function`); the exact return shape must be pinned against `index.d.ts` at planning. `listServerRefs` is a confirmed fallback. Only affects the unpinned path; pinned (`sha`/`ref`) installs don't need it. |
| A2 | The `no-orchestrator-network` gate passes unchanged when the clone lives in a NEW `clone-cache.ts` seam that install.ts imports by name (install.ts never names `gitOps`) | Pitfall 2 | Low — verified the gate greps only the four literal tokens in the listed files' comment-stripped source; a seam import (`import { materializePluginClone } from "./clone-cache.ts"`) matches none. Confirm no accidental `gitOps` identifier leaks into install.ts. |
| A3 | The `@earendil-works/pi-coding-agent ^0.79.0` host pkg is current | Standard Stack (implicit) | Low — not load-bearing this phase; sourced from MEMORY.md. |

## Open Questions

1. **`sha-<12hex>` precedence vs plugin.json/entry.version in `resolvePluginVersion`.**
   - What we know: D-77-01 says git-source plugins record `sha-<12hex>`. The existing ladder (shared.ts:489) is plugin.json.version > entry.version > `computeHashVersion`. For a git source, the resolved sha is a stronger identity than a content hash.
   - What's unclear: does `sha-<12hex>` REPLACE the whole ladder for git sources (always sha), or only the tier-3 hash fallback (plugin.json/entry.version still win when declared)? D-77-01's "names the provenance (git commit vs content hash)" phrasing suggests it replaces tier-3 only, but "Git-source plugins record version `sha-<12hex>`" reads absolute.
   - Recommendation: git source ⇒ ALWAYS `sha-<12hex>` (the commit IS the version identity for a git-materialized plugin; a plugin.json version inside a pinned commit is redundant with the sha). Confirm with the user at discuss/plan time; it's a one-line branch either way.

2. **Warm-cache reuse for UNPINNED url installs (D-77-05).**
   - What we know: D-77-05 says a later unpinned install of the same url REUSES any cached clone — no network on warm cache. But the cache key includes the sha, and an unpinned entry has no sha until it's resolved (which needs network).
   - What's unclear: how a warm unpinned install finds the prior clone offline. Two mechanisms: (a) scan `plugin-clones/` for any dir matching the `sha256_12(url)-*` prefix and reuse the first; (b) consult state records for a prior install of the same canonical url and reuse its recorded `resolvedSha`.
   - Recommendation: mechanism (b) — the state record's url+sha reverse lookup (D-77-04 explicitly persists url+sha per plugin for exactly this) — is more truthful (reuses a KNOWN prior resolution, not an arbitrary dir). Prefix-scan (a) is simpler but reuses whatever sha happens to be cached. Pin at planning; both satisfy the offline criterion.

3. **Does the LIST surface call the resolver for not-yet-installed git plugins at all?**
   - What we know: `list.ts` candidate-resolves manifest entries (list.ts:379-382) to compute upgrade status. For a git plugin never installed, there's no cache dir and no recorded sha.
   - What's unclear: whether list should render such an entry from the manifest directly (status "not installed") without invoking `resolveStrict` (avoiding the `not-cached` → `unavailable` awkwardness in the Pattern 1 example), or whether the `not-cached` result needs a dedicated non-`unavailable` render path.
   - Recommendation: trace the existing list.ts candidate-resolve flow at planning; likely list renders un-installed plugins from the manifest entry + `plugin-state-classifier.ts` without a git-materializing resolve. The `not-cached` arm may only ever fire on an info probe of a recorded-but-cache-evicted plugin (a Phase 78 concern).

## Environment Availability

> Skipped for external tooling — this phase adds no new external dependencies, tools, or services. `isomorphic-git@1.38.5` is already installed and in use (clone/checkout/getRemoteInfo2/listServerRefs all verified present). Node ≥22.22.2 / TypeScript toolchain unchanged. Network is used only on cache-MISS by the new clone seam (NFR-5 amended, REQUIREMENTS.md:60).

## Validation Architecture

> nyquist_validation is enabled (config.json: `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (TS via native strip) |
| Config file | none (globs in `package.json` scripts) |
| Quick run command | `node --test "tests/domain/resolver.test.ts"` (or the specific new test file) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PURL-01 | `url`/`git-subdir`/`github` sources resolve installable (given a materialized/probe callback); npm stays unavailable; three-way state preserved | unit | `node --test "tests/domain/resolver.test.ts"` | ✅ (extend) |
| PURL-02 | install clones at pinned sha on cache-miss; second install of same url+sha does NOT clone (deduped); warm-cache install completes with a mock gitOps that throws on any network call | orchestrator | `node --test "tests/orchestrators/plugin/install.test.ts"` + `node --test "tests/orchestrators/plugin/clone-cache.test.ts"` (NEW) | ⚠️ clone-cache test NEW (Wave 0) |
| PURL-03 | git-subdir pluginRoot = cloneRoot + path; a `..`-escaping subdir → unavailable; a missing subdir → source missing | unit + orchestrator | `node --test "tests/domain/resolver.test.ts"` | ✅ (extend) |
| PURL-04 | cache key = `sha256_12(canonicalUrl)-sha12`; two differently-named plugins at same url+sha share one clone | unit + orchestrator | `node --test "tests/domain/*clone-key*.test.ts"` (NEW) + install dedup test | ⚠️ key test NEW (Wave 0) |
| PURL-09 | recorded `version` = `sha-<12hex>`; `resolvedSha` = full 40-hex; unpinned resolves remote HEAD and records the resolved sha; `sha` wins over `ref` when both set | unit + orchestrator | `node --test "tests/domain/version.test.ts"` + install state-record assertion | ✅ (extend) |
| D-77-02 | `resolvedSha` optional field loads on legacy records (absent) and round-trips on new ones | persistence | `node --test "tests/persistence/state-io.test.ts"` | ✅ (extend) |
| arch | install.ts still carries zero gitOps surface after the phase | architecture | `node --test "tests/architecture/no-orchestrator-network.test.ts"` | ✅ (unchanged — must stay green; update the comment rationale) |
| arch | `sha-<12hex>` renders `#<7hex>` on the list surface (mirror hash) | catalog UAT | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the specific new/edited test file (e.g. `node --test "tests/domain/resolver.test.ts"`).
- **Per wave merge:** `npm test` (unit suite).
- **Phase gate:** `npm run check` fully green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] NEW `tests/orchestrators/plugin/clone-cache.test.ts` — dedup (same key → no second clone), offline warm cache (mock gitOps throws on clone; existing key dir → success), MA-9 cleanup-on-throw, EEXIST-tolerant rename race (Pitfall 4), pin-precedence (sha over ref).
- [ ] NEW `tests/domain/clone-key.test.ts` (or extend version.test.ts) — key format `sha256_12(url)-sha12`, canonical-url insensitivity to `.git`, cross-shape dedup (url vs github-object vs git-subdir at same repo).
- [ ] Extend `tests/domain/resolver.test.ts` — the three git kinds installable via a stub `resolveGitPluginRoot`; git-subdir containment (escape → unavailable, missing → source missing); `not-cached` render path; npm still unavailable; three-way state (partial degradation) composes over a git pluginRoot.
- [ ] Extend `tests/domain/version.test.ts` — `shaVersion`/`looksLikeShaVersion`; `formatShaVersionForDisplay`.
- [ ] Extend `tests/persistence/state-io.test.ts` — `resolvedSha` optional load (absent on legacy, present on new); saveState round-trip.
- [ ] Extend `tests/orchestrators/plugin/install.test.ts` — end-to-end git install records `version: sha-<12hex>` + `resolvedSha`; dedup across two installs; unpinned resolves+records a sha.
- [ ] Extend `tests/architecture/catalog-uat.test.ts` — git-source install byte form + `sha-` version display.
- [ ] Verify `tests/architecture/no-orchestrator-network.test.ts` stays green (no code change to the gate; update its rationale comment per Pitfall 2).

*A `GitOps` mock/stub fixture already exists for the marketplace add/update tests; the clone-cache tests reuse it (inject a stub that records clone/checkout calls and can be made to throw for the offline-warm-cache assertion).*

## Security Domain

> `security_enforcement` is not explicitly `false` in config → enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Phase 77 is **public-only** (D-77-06) — no credentials handled. A private github plugin repo fails with the existing `authentication required` token. Non-github/private auth is Phase 79. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No access-control surface added. |
| V5 Input Validation | **yes** | The `url`/`path`/`ref`/`sha` fields are parser-validated (`https://` only; `path` is a relative subdir). The `sha`/`ref` pin is checked out verbatim; a nonexistent sha fails the checkout (fail-clean, NFR-3). git-subdir `path` is containment-checked against the clone root (PURL-03). |
| V6 Cryptography | **yes (usage, not implementation)** | SHA-256 via `node:crypto` for the cache key + `sha-<12hex>` version. No hand-rolled crypto; identical to `computeHashVersion`. The sha is a git commit identity, not a security boundary. |
| V12 File / Resource | **yes** | Clone writes to `plugin-clones/<key>/` under `extensionRoot` — NFR-10 containment enforced by the new `pluginCloneDir` SC-7 chokepoint + `assertPathInside`. Staging → atomic rename (NFR-1). |

### Known Threat Patterns for {source-addressed git clone cache}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| git-subdir `path` traversal (`../../etc`) escaping the clone root | Tampering | `assertPathInside(cloneRoot, path.resolve(cloneRoot, source.path))` (PURL-03/NFR-10) — escape → `unavailable`. |
| Malicious cache-key collision (two different urls hashing to the same 12-hex prefix) | Tampering | The key is `sha256_12(url) + "-" + sha12` — a 12-hex url-hash collision requires ~2^24 work AND a matching commit sha; the state record persists the FULL url+sha for reverse verification (D-77-04). A collision would at worst reuse a byte-different tree; acceptable at 12-hex given the milestone's threat model. **Planner note:** if the operator threat model requires it, widen the url-hash truncation; 12-hex matches the existing `hash-`/`sha-` convention and is the locked D-77-04 choice. |
| Malicious `plugin.json`/component tree in a cloned repo | Tampering | Existing resolver validation (`PLUGIN_MANIFEST_VALIDATOR`, component-path containment) runs on the materialized clone root — source-kind-agnostic, unchanged. |
| Credential leak in a clone error surfaced to the user | Information disclosure | D-77-06: no credentials handled (public-only) → nothing to leak. `authentication required` carries only the HTTP status. The `no-credential-leak` architecture gate needs NO new file entry (no new auth-interpolating file) until Phase 79 — verify this stays true. |
| SSRF-ish clone of an internal `https://` host | Information disclosure | Out of scope to block (public-repo utility needs arbitrary hosts); `https://`-only parsing blocks `file://`/`ssh://`. No pre-clone probe (fail-clean is the signal), consistent with Phase 76. |

**No-credential-leak gate:** Phase 77 adds no file that interpolates a token into an error/notification (public-only). Confirm `tests/architecture/no-credential-leak.test.ts` needs no new file entry (the new `clone-cache.ts` handles no credentials).

## Project Constraints (from CLAUDE.md)

- **Runtime:** Node >= 20.19.0 (NFR-4); dev machine is 22.22.2. No new syntax requiring a higher floor.
- **TypeScript strict / NFR-7:** the resolver's discriminated `installable | partially-available | unavailable` union MUST stay sound. The new `GitPluginRootResult` union and the injected callback must narrow via discriminants; the `unavailable` arm must NEVER carry `pluginRoot` (compile-enforced). No casts beyond the existing `record.source as ParsedSource`.
- **All disk mutations atomic (NFR-1):** the clone materializes via `sourcesStagingDir` + `rename` into `plugin-clones/<key>/` (same-FS sibling under `extensionRoot`). Do NOT clone directly into the final cache dir.
- **No Pi restart for recovery (NFR-2) / idempotent-or-fail-clean (NFR-3):** a partial/failed clone cleans its staging (MA-9) and leaves NO half-materialized cache dir; a re-run re-clones. The EEXIST-tolerant rename (Pitfall 4) is an NFR-3 safety property.
- **Network policy (NFR-5, amended REQUIREMENTS.md:60):** `install` may clone ONLY on cache-miss; warm sha-pinned cache is offline. `list`, `uninstall`, path-source ops stay network-free. The resolver stays network-free (Pattern 1). install.ts carries zero gitOps surface (Pattern 2).
- **Containment (NFR-10):** new write target `plugin-clones/<key>/` under `extensionRoot`, keyed through the new `pluginCloneDir` SC-7 chokepoint. git-subdir pluginRoot anchored to the clone root (PURL-03).
- **Output channel (IL-2):** all user-visible messages through `notify()` → `ctx.ui.notify`; the renderer stays a dumb renderer (MEMORY.md: notify.ts must not probe state — the `sha-<12hex>` display formatter is a pure string transform like `formatHashVersionForDisplay`).
- **Quality bar (NFR-6):** `npm run check` green.
- **Comment policy (`.claude/rules/typescript-comments.md`):** tag new code with decision/requirement IDs (`D-77-01`, `PURL-02`, `NFR-5`, `SC-7`), NEVER with `Phase 77`/`Plan`/`Wave`/`Pitfall N` planning refs. Domain-word `phase` (ledger phases) is exempt.
- **Closed-set discipline (MEMORY.md):** git-subdir escape/missing UX reuses existing REASONS tokens (`source missing`, structural `unavailable` notes) where truthful. A new token is a lockstep catalog amendment (REASONS tuple + length tripwire currently 33 → 34 + catalog rows + style-guide row in ONE commit) — mint ONLY if no existing token is truthful.
- **Git:** never commit to main; branch `features/*`; run `pre-commit run` before commit; `SKIP=trufflehog` prefix only inside a worktree.

## Upstream Parity (verified against code.claude.com/docs)

Re-fetched `https://code.claude.com/docs/en/plugin-marketplaces.md` (2026-07-11). The parser field names in `domain/source.ts` are byte-exact against upstream:

| Source kind | Discriminator | Fields (upstream) | `domain/source.ts` match |
|-------------|---------------|-------------------|--------------------------|
| github (object) | `"source": "github"` | `repo`, `ref?`, `sha?` | ✅ `GitHubSource` (owner/repo from `repo`, ref, sha) |
| url (object) | `"source": "url"` | `url`, `ref?`, `sha?` | ✅ `UrlSource` (url, ref, sha) |
| git-subdir (object) | `"source": "git-subdir"` | `url`, **`path`** (required), `ref?`, `sha?` | ✅ `GitSubdirSource` (url, path, ref, sha) — uses `path`, NOT `subdirectory` |
| local (string) | `"./..."` | — | ✅ `PathSource` |
| npm (object) | `"source": "npm"` | (package, version, registry) | Parsed but OUT OF SCOPE (rejected) |

**Load-bearing upstream facts confirmed:**
1. **Plugin sources support BOTH `ref` and `sha`** (unlike MARKETPLACE sources, which support `ref` but NOT `sha`). This is why PURL-09 pins by sha.
2. **"When both `ref` and `sha` are set, the `sha` is the effective pin. Claude Code fetches and checks out the pinned commit directly."** → `pin = source.sha ?? resolveFromRef` (Pitfall 6).
3. **git-subdir upstream "clones sparsely (partial clone) to minimize bandwidth for monorepos."** We intentionally DIVERGE: sparse checkout is out of scope (isomorphic-git can't do it; REQUIREMENTS.md:54). Phase 77 does a FULL clone + subdirectory resolution — a documented, accepted difference (same tree result, more bandwidth for monorepos).
4. **Marketplace vs plugin source are independent** ("point to different repositories and are pinned independently") — confirms the plugin clone cache is a SEPARATE lifecycle from the marketplace clone (`sources/<name>/`), justifying the new `plugin-clones/` root (D-77-03).

**What upstream supports that we intentionally exclude this phase:** npm plugin sources (out of scope, REQUIREMENTS.md:52), sparse checkout (above), private-repo auth on non-github/github hosts (Phase 79), SSH URLs (REQUIREMENTS.md:53).

## Sources

### Primary (HIGH confidence — read in full or verified against installed source)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `sourceUnsupportedReason` (497), `preflightStages` pluginRoot derivation (593), `sourceEscapeReason` (507), `ResolveContext` injection idiom (240), three-way decision (1152), `requireInstallable`/`requirePartialInstallable` (1226/1264). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/domain/source.ts` — `UrlSource`/`GitSubdirSource`/`GitHubSource` types with url/path/ref/sha (39-54); object parsers (150-177); `sourceLogical` (544). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/domain/version.ts` — `computeHashVersion` 12-hex truncation (30-34); the `sha-` sibling template. [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — 5-phase ledger, PI-4 resolve gate (499), version resolve (555), state phase record (805). [VERIFIED: read lines 1-1171]
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — `resolvePluginVersion` 3-tier ladder (489); `pickAgentsSourceDir` (518). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — `addGitClonedInGuard` staging→rename→MA-9 (618-698); `classifyAddError` HttpError+errno ladder (233-290). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` — `GitOps` interface + `DEFAULT_GIT_OPS` (103-148); `refreshGitHubClone` D-14 sequence (179-248); Pattern S-9 re-export. [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — imports `gitOps`/`DEFAULT_GIT_OPS` from marketplace/shared.ts (119), exempt from the network gate. [VERIFIED: grep]
- `extensions/pi-claude-marketplace/platform/git.ts` — `clone`/`checkout`/`resolveRef` wrappers; no host gate; sparse-checkout explicitly not exposed (23). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `sourceCloneDir`/`pluginDataDir`/`sourcesStagingDir` SC-7 chokepoints (193-241); hard-coded-suffix dir construction (148-158). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `PLUGIN_INSTALL_RECORD_SCHEMA` (54-73); `lastReconciledExtensionVersion` additive-optional precedent (161); `normalizeStoredSource` (192). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — additive default-fill discipline (`ensurePluginResources`/`ensurePluginEnabled`); optional field needs no fill. [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/shared/notify.ts` — REASONS 33-tuple with `authentication required` (89-134); `HASH_VERSION_RE`/`formatHashVersionForDisplay`/`renderVersion` (1737-1768). [VERIFIED: read relevant regions]
- `tests/architecture/no-orchestrator-network.test.ts` — forbidden-targets (install/list/reinstall/info) + forbidden tokens (gitOps/DEFAULT_GIT_OPS/platform-git/refreshGitHubClone); update.ts exempt. [VERIFIED: read in full]
- `node_modules/isomorphic-git@1.38.5` — clone/fetch/checkout/resolveRef/currentBranch/writeRef/listServerRefs/getRemoteInfo2 all present (`function`). [VERIFIED: node require probe]
- `code.claude.com/docs/en/plugin-marketplaces.md` — plugin source schema (url/git-subdir/github fields, ref+sha, sha-wins-over-ref, git-subdir uses `path`). [VERIFIED: re-fetched 2026-07-11, quoted]

### Secondary (MEDIUM confidence)
- Phase 76 RESEARCH (`76-RESEARCH.md`) — HttpError idiom (D-76-08), MA-9 discipline, isomorphic-git behavior notes, `addGitClonedInGuard` extraction. [CITED]

### Tertiary (LOW confidence)
- MEMORY.md host-package migration note (`@earendil-works/pi-coding-agent ^0.79.0`). [ASSUMED — not load-bearing]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; isomorphic-git clone/checkout/getRemoteInfo2/listServerRefs verified present in the installed package.
- Architecture (resolver injection + clone-cache seam + network-guard tension): HIGH — every seam read in full; the central `no-orchestrator-network` constraint verified against the actual test source; the clone body mirrors a verified existing pattern (`addGitClonedInGuard`).
- Upstream parity (field names, ref/sha precedence, git-subdir `path`): HIGH — re-fetched and quoted from official docs.
- Version + state schema: HIGH — additive-optional precedent verified in state-io.ts; sha-version mirrors the verified hash-version machinery.
- Unpinned remote-HEAD resolution mechanics: MEDIUM — the API exists (verified) but the exact `getRemoteInfo2` return shape is pinned at planning (Open Q, A1). Only affects the unpinned path.

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 (stable in-tree domain; external drift risk limited to isomorphic-git's `getRemoteInfo2`/`clone` shape, pinned at 1.38.5).

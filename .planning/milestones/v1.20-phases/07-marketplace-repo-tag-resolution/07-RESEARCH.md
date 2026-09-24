# Phase 07: Marketplace-repository tag resolution for path-source dependencies - Research

**Researched:** 2026-09-19
**Domain:** Local git tag resolution and same-repository plugin materialization (isomorphic-git, in-repo TypeScript orchestrators)
**Confidence:** HIGH (all claims below are grounded in files read this session or in CONTEXT.md-locked decisions; no external package research was needed — this phase adds zero new dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-07-01 (materialization mechanics):** Reuse the existing `plugin-clones/<key>/` content-addressed cache and its GC sweep (`orchestrators/plugin/clone-cache.ts`, `clone-gc.ts`) rather than inventing a second materialization mechanism. Concretely: check out the winning tag's tree into a new `plugin-clones/<key>/` directory using isomorphic-git's `checkout()` with a separate `dir`/`gitdir` pair — `gitdir` pointing at the marketplace clone's shared object store, `dir` the new key'd directory — so the marketplace clone's own working tree and HEAD are never mutated (`noUpdateHead: true`). Key it the same way existing pinned clones are keyed (by resolved tag oid), so `clone-gc.ts`'s existing live-key sweep (keyed off `resolvedSource` in state) covers it with no new GC logic. **Reversibility: costly.**

Tag listing itself is a NEW seam distinct from the existing `probeDependencyTags`/`listRemoteTags` path: that path lists a *dependency's own remote repository's* advertised tags over the network. Path sources have no such repository, so this phase lists the *marketplace clone's local* tags via `platform/git.ts`'s isomorphic-git `listTags`, not the advertised-refs path (keeps `no-orchestrator-network.test.ts` passing).

> **Research finding on D-07-01's literal mechanism — see "Critical Technical Finding" below.** The literal "separate `dir`/`gitdir` pair pointed at the marketplace clone's own `.git`" mechanism has a verified correctness defect: isomorphic-git's `checkout()` reads and writes the git index at `${gitdir}/index` regardless of `noUpdateHead`, so pointing `gitdir` at the marketplace clone's real `.git` would overwrite the *marketplace clone's own index* with the tag's tree state — silently desyncing the marketplace's own working directory bookkeeping. This is not a re-litigation of D-07-01's INTENT (reuse the `plugin-clones/` cache and GC convention; key by tag oid; never mutate the marketplace clone's own working tree/HEAD) — all four of those intents are preserved by the alternative construction below, which is also the exact pattern this codebase already uses for a structurally identical problem (`seedOnePluginMirror` in the same file). This is presented as an implementation detail for the plan to adopt, not a re-opening of the decision.

**D-07-02 (version provenance, TAGS-03):** The installed record's version is the tag's own parsed semver (from `{name}--v{version}`), never the checked-out `plugin.json`'s `version` field, matching the existing git-source tag-pin convention (`install-cascade.ts:215`, `ResolvedCascadeMember.pin.version`) so `recordedVersionSatisfies` can re-check the pin on a later install. Verified against upstream: the installed Claude Code binary's own comment says a "tag-derived semver … [is used] in preference to manifest.version, since the upstream may have forgotten to bump plugin.json."

**D-07-03 (fallback notice tone, TAGS-02):** When no tag satisfies the constraint and the marketplace's current copy installs instead, the row's notice is a **quiet info-level note**, not a warning. Deliberate divergence from upstream (which surfaces this as a "warning"): this project treats it as a plain note because Phase 6's load-time check is what actually flags and disables a dependent if the fallback copy turns out to be genuinely out of range — the install itself always succeeds here, so nothing is wrong yet.

### Claude's Discretion

- DIVG-01's exact doc wording in `docs/dependency-resolution.md` — follow the format of the existing divergence entries in that doc (the git-SHA / `sha`-field refusal is already explained there; this just adds that upstream accepts the field). No review requested before committing.
- Exact info-note wording/placement for the TAGS-02 fallback row (tone is locked as "quiet info"; the specific phrasing and the exact reason-token spelling are implementation details — see "Code Examples" below for the established naming convention to follow).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAGS-01 | A constrained dependency whose marketplace entry is a relative path resolves the constraint against the marketplace repository's `{name}--v{version}` tags, read from the local marketplace clone without network (NFR-5). | New `platform/git.ts::listTags` wrapper (verified isomorphic-git API below) + a new local tag-listing/selection function alongside `dependency-tag-probe.ts`, invoked from `install-cascade.ts::resolveMemberTagSource`/`probeMemberPin` when the member's marketplace entry parses to a `PathSource`. `mp.marketplaceRoot` (verified schema field) is the local git working dir to list against. |
| TAGS-02 | When no tag satisfies, the install proceeds with the marketplace's current copy and the row says so; the constraint is then checked at load by Phase 6 rather than failing the install with `{no matching version}`. | New non-failure arm threaded through `MemberConstraintResolution`'s `ok: true` path (not `CascadeConstraintFailure`); new command-private `Reason` token + `install-cascade.messaging.ts` row composition, following the `composePromotedRow` / `dependency promoted` precedent for an `installed`-status row carrying a non-idempotent, `severity: "info"` note. |
| TAGS-03 | A constrained path-source dependency with a satisfying tag installs the plugin as it stands at that tag, not the marketplace's current copy. | New clone-cache function (pattern: `seedOnePluginMirror` + `deriveMarketplaceUrl`, both in `clone-cache.ts`) that copies the marketplace checkout and checks out the target tag inside the copy's own gitdir; a new `ResolveContext` injection point for `path` sources in `domain/plugin-resolver.ts` / `domain/resolver-types.ts` (today `path` sources have no injectable materialization callback at all); `resolvedSha` must be stamped on the install record for `clone-gc.ts` to protect the new directory. |
| DIVG-01 | `docs/dependency-resolution.md` says that upstream accepts a `sha` field on a dependency element and that this extension refuses it (D-03-36), next to the divergences it already lists; §"What a version constraint can say" and §path source describe the new resolution. | Exact current doc text and line numbers captured below (docs/dependency-resolution.md lines 31-33, 49-64, 92-98, 216-230). |
</phase_requirements>

## Summary

This phase closes the one gap in the dependency-resolution feature that makes version constraints unusable on the common case: a marketplace-relative `path` source (`"source": "./plugins/x"`). Today, `install-cascade.ts::resolveMemberTagSource` returns `undefined` for any non-git-backed source, which `probeMemberPin` turns into an unconditional `no-matching-tag` failure for every non-wildcard constraint (`docs/dependency-resolution.md:96`). The fix is NOT a variant of the existing network tag probe (`dependency-tag-probe.ts::probeDependencyTags`, which lists a *remote* repository's advertised tags) — it is a new, offline counterpart that lists tags on the *local marketplace clone* already on disk at `state.marketplaces[name].marketplaceRoot`, using isomorphic-git's `listTags({fs, dir, gitdir})` local API rather than `listServerRefs`.

Three distinct code changes compose the phase: (1) a local tag-listing/selection seam parallel to `dependency-tag-probe.ts` but backed by `platform/git.ts`'s new `listTags` wrapper instead of `listRemoteTags`; (2) a new non-failure "fell back to current copy" outcome threaded through `install-cascade.ts`'s constraint resolution and rendered as a quiet info note on the cascade's install row (D-07-03); and (3) a new tag-pinned materialization path for `path` sources — copying the marketplace checkout tree into a fresh `plugin-clones/<key>/` directory and checking out the winning tag *inside that copy's own git directory*, then wiring that materialization into the resolver's currently-uninjectable `path` branch (`domain/plugin-resolver.ts::deriveSourcePluginRoot`).

The single largest risk this research surfaces is in (3): D-07-01's literal wording (a shared `dir`/`gitdir` pair against the marketplace clone's own object store) would have isomorphic-git's `checkout()` overwrite the marketplace clone's own `.git/index` file, corrupting its own working-tree bookkeeping — verified directly against the installed `isomorphic-git` package source this session. This codebase already has a proven-safe pattern for the identical problem (`clone-cache.ts::seedOnePluginMirror`, which copies the whole marketplace tree including `.git` and checks out inside the *copy's own* gitdir), and the plan should follow it rather than the literal separate-gitdir construction.

**Primary recommendation:** Add a `platform/git.ts::listTags` wrapper over isomorphic-git's local `listTags`; add a local tag-selection function reusing `selectHighestSatisfyingTag`'s logic against that local listing; and materialize a satisfying tag by copying the marketplace checkout (`cp -r` including `.git`) into a new `plugin-clones/<key>/` directory keyed by `pluginCloneKey(marketplaceUrl, tagOid)` (reusing `deriveMarketplaceUrl` for the key's URL half) and checking out the tag inside that copy's own default gitdir — never against the marketplace clone's live `.git`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Local tag listing (TAGS-01) | Platform (`platform/git.ts`) | Orchestrator (`orchestrators/plugin/`) | `platform/git.ts` is the sole isomorphic-git wrapper boundary (D-13); the orchestrator tier composes it into a domain-specific probe, exactly as `dependency-tag-probe.ts` does for the network case. |
| Tag selection / constraint resolution (TAGS-01, TAGS-02) | Orchestrator (`install-cascade.ts`) | Domain (`domain/dependency-range.ts`) | `install-cascade.ts` already owns "between the closure walk and the phase array" constraint resolution (RESV-03/05); satisfaction testing itself stays in `domain/dependency-range.ts`, not duplicated. |
| Plugin materialization at a tag (TAGS-03) | Orchestrator seam (`orchestrators/plugin/clone-cache.ts`) | — | This is the one file legally allowed the git surface among plugin orchestrators (it is NOT in `NETWORK_FREE_TARGETS`); every gated caller reaches it by injected seam name, never by importing `platform/git.ts` directly. |
| Resolver injection point for a pinned path source (TAGS-03) | Domain (`domain/plugin-resolver.ts`, `domain/resolver-types.ts`) | Orchestrator (`install-outcome.ts`) | The resolver is network-free by contract (`NETWORK_FREE_TARGETS`) and only ever calls injected callbacks; `install-outcome.ts` is the composition root that supplies the callback (mirrors the existing `resolveGitPluginRoot` wiring at `install-outcome.ts:459-475`). |
| Row / reason messaging (TAGS-02) | Orchestrator (`install-cascade.messaging.ts`) | Shared vocabulary (`shared/notify-reasons.ts`, `shared/notification-types.ts`) | Cascade-row facts are command-private per the module's own header docstring; the reason TOKEN itself must still be a closed-set member in the shared `REASONS` tuple (COMPAT-01). |
| Docs (DIVG-01) | Docs (`docs/dependency-resolution.md`) | — | Pure prose change; no code owns it. |

## Critical Technical Finding: shared-gitdir checkout would corrupt the marketplace clone's own index

**[VERIFIED: node_modules/isomorphic-git/index.cjs:1073, 7286-7313, 7957-7991]**

D-07-01's prose describes checking out the winning tag with a "separate `dir`/`gitdir` pair — `gitdir` pointing at the marketplace clone's shared object store, `dir` the new key'd directory". Read literally, this means calling isomorphic-git's `checkout({ fs, dir: newKeyedDir, gitdir: marketplaceClone/.git, ref: tagOid, noUpdateHead: true })`.

Tracing isomorphic-git's actual implementation (installed version `^1.41.8`, `node_modules/isomorphic-git/index.cjs`):

- `checkout()` (line 7957) resolves `gitdir = join(dir, '.git')` only when `gitdir` is omitted; when the caller supplies `gitdir` explicitly (as D-07-01 describes), it is used as-is and passed straight through to the internal `_checkout()`.
- `_checkout()` (line 7164) computes the set of filesystem operations needed to transform the *working directory* to the target tree, then applies them via `GitIndexManager.acquire({ fs, gitdir, cache }, ...)` (lines 7286, 7313, 7389, 7405) — **every one of these acquisitions reads and writes the index file at the path `${gitdir}/index`** (confirmed at `node_modules/isomorphic-git/index.cjs:1073`: `const filepath = \`${gitdir}/index\`;`).
- `noUpdateHead` only gates whether `checkout()` also force-updates the `HEAD`/branch ref (line 7967: `noUpdateHead = _ref === undefined`, consumed later in the ref-write branch); it does **not** gate the index read/write above.

Consequence: if `gitdir` is the marketplace clone's real `.git` directory, this checkout call overwrites `<marketplaceClone>/.git/index` — the marketplace clone's OWN staged-file bookkeeping — to reflect the *tag's* tree, not the marketplace's actual working-directory contents. The marketplace clone's working tree and files on disk are untouched by this specific call (they live under `dir`, the new keyed directory), but its `.git/index` is left permanently out of sync with its own working tree. This is exactly the "marketplace clone's own working tree and HEAD are never mutated" property D-07-01 states as its goal — but the *index* is a third piece of git-managed state the decision's own prose does not mention, and it silently breaks. A subsequent `marketplace update` (which fetches + checks out against the marketplace's own `dir`+`gitdir=dir/.git` pair, via `orchestrators/marketplace/shared.ts::refreshGitHubClone`) would then run its own `analyze()`/checkout cycle against a stale index — the specific failure mode (spurious "modified"/"deleted" detections, or a checkout that silently does the wrong partial update) was not reproduced in this session, but the underlying state (index tracking the wrong tree) is confirmed.

**No alternates/multi-object-directory mechanism exists to avoid this safely.** A classic git `--reference`/alternates setup (a fresh, empty gitdir whose `objects/info/alternates` points at the marketplace clone's object store, so reads share the object database while writes go to the new gitdir's own index) is not supported by isomorphic-git — `grep -rn "alternates"` across `node_modules/isomorphic-git/index.cjs` and `index.d.ts` returns zero matches, and every internal object read composes `gitdir` directly with no secondary lookup path (`_readObject({ fs, cache, gitdir, oid })`, dozens of call sites, all single-`gitdir`).

**The existing, safe, precedented alternative — already in this codebase for the identical problem:**

`orchestrators/plugin/clone-cache.ts::seedOnePluginMirror` (lines 386-441) already solves "materialize a plugin from the SAME repository a marketplace clone already has on disk, at a specific commit, without touching the marketplace clone's own git state":

1. `cp(marketplaceRoot, staging, { recursive: true })` (line 411) — copies the ENTIRE marketplace checkout, **including `.git`**, into a staging directory. This is a plain filesystem copy; it does not invoke any git API against the marketplace clone, so nothing about the marketplace clone's own state is touched, read, or at risk.
2. `gitOps.checkout({ dir: staging, ref: source.sha })` (line 420) — checks out the target commit using the **copy's own default gitdir** (`staging/.git`, the one just copied). Every index read/write from this call lands on the COPY's index, never the marketplace's.
3. `promoteStagingToClone` (shared helper, lines 82-102) atomically renames `staging` into the final `plugin-clones/<key>/` location.

The cache key for this pattern (line 394-397) is `pluginCloneKey(marketplaceUrl, source.sha)` (pinned) or `pluginMirrorKey(marketplaceUrl)` (unpinned) — where `marketplaceUrl` is derived via `deriveMarketplaceUrl` (lines 341-373), which reads the marketplace's own canonical git URL either directly from its `github`/`url` source or, for a path-sourced marketplace add, by reading `<marketplaceRoot>/.git/config`'s `origin` remote fs-only (`readOriginRemoteUrl`, lines 307-339) — no network call.

**Recommendation for the plan:** implement TAGS-03's materialization as a new sibling function to `seedOnePluginMirror` (or a small generalization of it) that:
1. Derives the marketplace's canonical URL via the existing `deriveMarketplaceUrl` helper (reused, not reinvented).
2. Computes `key = pluginCloneKey(marketplaceUrl, tagOid)` — the same key shape `deriveLiveCloneKeys` (`clone-gc.ts:38-54`) already expects.
3. Warm-cache-shortcuts on `pathExists(dest)` exactly like `materializePluginClone` (line 187).
4. `cp(mp.marketplaceRoot, staging, { recursive: true })`, then `gitOps.checkout({ dir: staging, ref: tagOid })` — **default gitdir (`staging/.git`), never a `gitdir` pointed at `mp.marketplaceRoot`**.
5. Atomically promotes staging into `plugin-clones/<key>/` via the existing `promoteStagingToClone`.

This satisfies every stated intent of D-07-01 (reuses the `plugin-clones/` cache and its GC convention; keyed by the resolved tag oid; the marketplace clone's own working tree, HEAD, *and index* are all untouched; no second cache mechanism is invented — it is the SAME mechanism `seedOnePluginMirror` already established) while avoiding the index-corruption defect in the decision's literal "shared gitdir" phrasing. Flag this as a `checkpoint:human-verify` or an explicit note in the plan, since it changes *how* D-07-01 is implemented (not *whether* its outcome is honored) — the planner should confirm this reading with the operator if there is any doubt, but the underlying isomorphic-git behavior is not in question (it is read from the installed package's own source, not assumed).

**Disk-cost trade-off to note honestly:** this approach duplicates the marketplace's `.git` history into every distinct `plugin-clones/<key>/` directory it materializes (one full copy per distinct pinned tag oid across the marketplace's plugins), rather than literally sharing the object store. This is not a new cost this phase introduces — it is the exact cost model `seedOnePluginMirror`/SEED-01..06 already accepted for the "same-repo git-backed plugin" case — but the plan should note it, since a marketplace with many independently-tagged path-source plugins could multiply local disk usage per distinct tag.

## Standard Stack

### Core

No new external packages. This phase is implemented entirely with already-vetted, already-installed dependencies:

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `isomorphic-git` | `^1.41.8` [VERIFIED: package.json:9] | Local tag listing (`listTags`) and local checkout, alongside the existing network `listServerRefs`/`clone`/`checkout` usage | Already the sole git implementation in this codebase (D-18/19/20); pure-JS, no `git` binary dependency |
| `semver` | `^7.8.5` [VERIFIED: package.json:11] | Version parsing/comparison for the local tag selection (`gt`, `valid`) — reused identically to `dependency-tag-probe.ts`'s existing usage | Already this project's declared semver dependency (RESV-03, Plan 03-02) |

**Installation:** none required — both packages are already `package.json` dependencies.

### Package Legitimacy Audit

Not applicable — this phase installs no new packages. `isomorphic-git` and `semver` were already vetted in Phase 3 (RESV-03) and are unchanged.

## Architecture Patterns

### System Architecture Diagram

```
                      install-cascade.ts (RESV-03 constraint resolution)
                                   |
                    resolveOneMember -> resolveMemberTagSource
                                   |
                 +-----------------+------------------+
                 |                                     |
      source.kind is git-backed              source.kind is "path"   <-- NEW branch this phase adds
     (url/git-subdir/github)                          |
                 |                                     v
      probeMemberPin (existing)          NEW: probeMarketplaceLocalTags(marketplaceRoot, pluginName, range)
                 |                                     |
      dependency-tag-probe.ts                platform/git.ts::listTags   <-- NEW wrapper (local, no network)
      ::probeDependencyTags                  (isomorphic-git git.listTags({fs, dir: marketplaceRoot}))
      -> platform/git.ts::listRemoteTags               |
      (network, listServerRefs)               selectHighestSatisfyingTag (REUSED logic)
                 |                                     |
                 v                        +-------------+-------------+
      pin found / no-matching-tag         |                           |
      (existing failure semantics)   tag found (TAGS-03)      no tag found (TAGS-02)
                                            |                           |
                                 ResolvedCascadeMember.pin    NEW ok:true outcome,
                                 {oid: tagOid, version}       no `pin`, install proceeds
                                            |                 with marketplace's current
                                            v                 copy; row carries a new
                          install-flow.ts ledgerOptionsFor    quiet-info reason token
                          -> sourcePinOverride, pinVersion
                                            |
                                            v
                          install-outcome.ts::preflightInstallResolve
                          -> resolveStrict(entry, { marketplaceRoot, ...
                               resolveGitPluginRoot (existing, git-backed only)
                               NEW: a path-source materialization callback })
                                            |
                                            v
                          domain/plugin-resolver.ts::deriveSourcePluginRoot
                          "path" branch: currently ALWAYS
                          `path.resolve(marketplaceRoot, raw)` -- NEW: when a
                          pin is present, calls the injected callback instead,
                          which materializes the tag via clone-cache.ts
                          (cp marketplaceRoot -> plugin-clones/<key>/,
                          checkout tagOid inside the COPY's own gitdir)
                                            |
                                            v
                          pluginRoot = plugin-clones/<key>/[subpath]
                          resolvedSha = tagOid  (stamped for clone-gc.ts)
```

### Recommended Project Structure

No new files are strictly required; the phase is additive to existing modules. If the planner prefers a dedicated module for the local tag probe (parallel to how `dependency-tag-probe.ts` is a dedicated module for the network case), a natural name is `orchestrators/plugin/marketplace-tag-probe.ts`, kept OUT of `NETWORK_FREE_TARGETS` (it is invoked from `install-cascade.ts`, which is already outside that gate — the same arrangement `dependency-tag-probe.ts` uses, per its own module header at lines 11-17).

```
extensions/pi-claude-marketplace/
├── platform/
│   └── git.ts                          # + new listTags() wrapper (local, no network)
├── orchestrators/plugin/
│   ├── dependency-tag-probe.ts         # unchanged — remote/git-backed dependency tags
│   ├── marketplace-tag-probe.ts        # NEW (or a new function inside install-cascade.ts) — local marketplace-clone tags for path sources
│   ├── install-cascade.ts              # resolveMemberTagSource / probeMemberPin gain a path-source branch; MemberConstraintResolution's ok:true arm gains the "fell back" case
│   ├── install-cascade.messaging.ts    # new reason token + row composition for the TAGS-02 info note
│   ├── clone-cache.ts                  # + new materialize-at-tag function (pattern: seedOnePluginMirror)
│   └── install-outcome.ts              # preflightInstallResolve's ResolveContext gains the new path-materialization callback, gated on sourcePinOverride + path-kind entry
└── domain/
    ├── plugin-resolver.ts              # deriveSourcePluginRoot's "path" branch gains an injectable-callback arm
    └── resolver-types.ts               # ResolveContext gains a new optional field (or resolveGitPluginRoot's type widens)
```

### Pattern 1: Local tag listing via isomorphic-git

**What:** Read a repository's tags from a LOCAL working directory (no network), the offline counterpart to the existing `listRemoteTags`.

**When to use:** Whenever the "repository" whose tags matter is already materialized on disk (here: the marketplace clone) rather than a remote the dependency names.

**Verified isomorphic-git signature** [VERIFIED: node_modules/isomorphic-git/index.d.ts:2158-2177]:

```typescript
// Source: node_modules/isomorphic-git/index.d.ts:2173-2177
export function listTags({ fs, dir, gitdir }: {
    fs: FsClient;
    dir?: string | undefined;
    gitdir?: string | undefined;
}): Promise<Array<string>>;
```

Note the return shape difference from `listServerRefs`/`RemoteTag`: `listTags` returns **bare tag name strings only** (no oid). To get the oid a tag resolves to (peeling an annotated tag to its commit, matching `listRemoteTags`'s `peeled ?? oid` preference), each candidate name must be separately resolved, e.g. via `git.resolveRef({ fs, dir, gitdir, ref: \`refs/tags/${name}\` })` [VERIFIED: node_modules/isomorphic-git/index.d.ts:3046-3052] or `git.readTag`/`git.log` for annotated-tag peeling. **This needs a small design decision the plan should make explicit:** resolve every candidate tag's oid eagerly (simplest, and the marketplace clone's tag count is typically small), or resolve lazily only for the highest-name candidate that passes the version/prefix filter first (mirrors `selectHighestSatisfyingTag`'s existing filter-then-pick order, minimizing resolveRef calls). Either is correct; the existing `selectHighestSatisfyingTag` (dependency-tag-probe.ts:186-203) assumes oid is already attached to each candidate, so the new local prober's contract should attach `{ name, oid }` pairs (matching the `RemoteTag` shape) before calling into shared selection logic, OR the selection logic should be generalized to accept a lazy oid resolver.

```typescript
// NEW wrapper for platform/git.ts, following the existing listRemoteTags pattern
// (platform/git.ts:331-363) but local (git.listTags) instead of remote
// (git.listServerRefs). Verified API: node_modules/isomorphic-git/index.d.ts:2173.
export interface ListTagsOptions {
  dir: string;
}

export async function listTags(opts: ListTagsOptions): Promise<string[]> {
  return git.listTags({ fs, dir: opts.dir });
}
```

Whether annotated-tag peeling is needed for the local case is worth the planner confirming against a real annotated tag on a real marketplace clone — `03-UAT.md` (Phase 3's live UAT) already confirmed "an annotated tag peels to its commit" for the REMOTE path via `peelTags: true`; the LOCAL `resolveRef`/`readTag` peeling equivalent should get the same live-UAT-style confirmation rather than assumed to behave identically, since it is a different isomorphic-git code path.

### Pattern 2: Copy-then-checkout for same-repository materialization (see "Critical Technical Finding" above)

**What:** Materialize a specific commit/tag from a repository already cloned locally, without a second network clone and without touching the existing clone's own git state.

**When to use:** Any time a plugin's source repository IS the marketplace's own already-cloned repository (this phase's `path`-source case; also the existing SEED-01..06 same-repo mirror case for git-backed sources).

**Example — the existing precedent to follow, verbatim:**

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:386-441
// (seedOnePluginMirror) -- the exact pattern TAGS-03's new function should mirror.
async function seedOnePluginMirror(
  ops: RemovalOps,
  locations: ScopedLocations,
  gitOps: GitOps,
  source: UrlSource | GitSubdirSource | GitHubSource,
  marketplaceUrl: string,
  marketplaceRoot: string,
): Promise<void> {
  const key =
    source.sha === undefined
      ? pluginMirrorKey(marketplaceUrl)
      : pluginCloneKey(marketplaceUrl, source.sha);
  const dest = await locations.pluginCloneDir(key);

  if (await pathExists(dest)) {
    return; // warm cache, byte-equivalent
  }

  const staging = await locations.sourcesStagingDir(randomUUID());
  await mkdir(path.dirname(staging), { recursive: true });
  // Copy the working tree AND `.git` -- own gitdir for the checkout below.
  await cp(marketplaceRoot, staging, { recursive: true });

  if (source.sha !== undefined) {
    try {
      // Default gitdir = staging/.git (the COPY's own) -- never marketplaceRoot's.
      await gitOps.checkout({ dir: staging, ref: source.sha });
    } catch {
      await cleanupStaging(ops, staging, "plugin mirror seed staging");
      return;
    }
  }

  // Atomic same-FS rename staging -> dest.
  try {
    await mkdir(path.dirname(dest), { recursive: true });
    await rename(staging, dest);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    await cleanupStaging(ops, staging, "plugin mirror seed staging");
    if (code !== "EEXIST" && code !== "ENOTEMPTY") {
      throw err;
    }
  }
}
```

TAGS-03's new function differs from this precedent in exactly two ways: (a) it must be a first-class step of the INSTALL path, not a best-effort post-add sweep — its failure must propagate to the install (unlike `seedSameRepoPluginMirrors`'s swallow-and-skip, `clone-cache.ts:511-514`); (b) it needs `resolveGitPluginRootWithSubdir`-equivalent handling if the plugin's path itself points at a subdirectory of the checked-out tree (a `path` source's `raw`/`logical` is a relative path within the marketplace repo, structurally analogous to a `git-subdir` source's `path` field — `resolveGitPluginRootWithSubdir`, `clone-cache.ts:594-609`, is the existing containment-checked subdir resolver to reuse rather than re-derive).

### Pattern 3: Injecting a new resolver callback for the `path` source kind

**What:** `domain/plugin-resolver.ts::deriveSourcePluginRoot` (lines 382-431) currently has an unconditional `path` branch (`path.resolve(marketplaceRoot, parsedSource.raw)`, line 391) with NO injection point — unlike the `url`/`git-subdir`/`github` branch, which always calls `ctx.resolveGitPluginRoot`. `domain/resolver-types.ts::ResolveContext` (lines 130-137) types that callback's parameter as `UrlSource | GitSubdirSource | GitHubSource` only [VERIFIED: domain/resolver-types.ts:134-136, quoted]:

```typescript
// Source: extensions/pi-claude-marketplace/domain/resolver-types.ts:130-137
export interface ResolveContext {
  readonly marketplaceRoot: string;
  readonly readFileText?: (path: string) => Promise<string>;
  readonly statKind?: StatKindReader;
  readonly resolveGitPluginRoot?: (
    source: UrlSource | GitSubdirSource | GitHubSource,
  ) => Promise<GitPluginRootResult>;
}
```

**When to use:** TAGS-03 needs the resolver to call an injected callback for a `path` source too, but ONLY when a pin exists (unconstrained/no-pin path installs must keep resolving to `marketplaceRoot + raw` exactly as today — changing that unconditionally would be a regression for every ordinary path-source plugin). Two viable shapes, both legitimate implementation choices for the planner:

1. **Widen `resolveGitPluginRoot`'s parameter type** to `SupportedParsedSource` (the union already declared at `domain/plugin-resolver.ts:192`, which includes `PathSource`) and have `deriveSourcePluginRoot`'s `path` branch call it conditionally (e.g., only when the injected callback is present AND some caller-supplied signal says "this install has a pin" — since the resolver itself has no notion of "pin", the signal likely needs to travel via a new `ResolveContext` field, e.g. `pathPluginPin?: { oid: string }`, rather than overloading `resolveGitPluginRoot`'s type for a case it structurally cannot express — `GitPluginRootResult`'s `not-cached`/`escapes` arms are also meaningful for a path+pin materialization, so reusing that return type is sound).
2. **A new dedicated field**, e.g. `resolvePathPluginRoot?: (source: PathSource, pin: string) => Promise<GitPluginRootResult>`, called by `deriveSourcePluginRoot`'s `path` branch only when both the callback and a pin are present, falling through to the existing `marketplaceRoot + raw` logic otherwise.

Option 2 is more type-safe (no widening of an existing callback's contract) and keeps the "pin" concept explicit in the signature rather than smuggled through a side-channel field; option 1 keeps `ResolveContext` smaller. Either is a reasonable planning-time choice — this is exactly the kind of open design question the plan should settle explicitly rather than leave implicit, since `plugin-resolver.ts` is read by BOTH `list`/`info` (which never carry a pin) and `install` (which sometimes does).

**Where the callback gets supplied — the existing wiring to extend:**

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:459-475
const resolved = await resolveStrict(entry, {
  marketplaceRoot: sourceMp.marketplaceRoot,
  resolveGitPluginRoot: async (gitSource) => {
    const clone = await (opts.cloneProbe ?? probeInstallClone)({
      source:
        opts.sourcePinOverride === undefined
          ? gitSource
          : { ...gitSource, sha: opts.sourcePinOverride },
      // ...
```

`opts.sourcePinOverride` (the exact field `ResolvedCascadeMember.pin.oid` flows into via `install-flow.ts:1451`, `sourcePin: member.pin.oid`) is ALREADY available at this exact call site, and `sourceMp.marketplaceRoot` is ALREADY in scope on the line above. The new path-materialization callback the plan adds here has both inputs it needs with zero new plumbing to thread through `InstallLedgerOptions` — `sourcePinOverride` already exists and already reaches every cascade member with a pin, git-backed or not (`install-flow.ts:1451` sets it unconditionally whenever `member.pin !== undefined`, regardless of source kind).

### Pattern 4: `pinVersionOverride` already does TAGS-03's version-recording job for free

**[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:332-363, quoted above; install-flow.ts:1443-1458, quoted above]**

`install-flow.ts`'s cascade `ledgerOptionsFor` builder (lines 1443-1458) already does this for EVERY member with a `pin`, regardless of source kind:

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1443-1458
ledgerOptionsFor: (member) => {
  const isRoot = member.key === rootKey;
  const pinVersion = member.pin?.version ?? (isRoot ? opts.pinVersionOverride : undefined);
  return buildInstallLedgerOptions(opts, {
    scope, cwd,
    marketplace: member.marketplace,
    plugin: member.name,
    ...(member.pin !== undefined && { sourcePin: member.pin.oid }),
    ...(pinVersion !== undefined && { pinVersion }),
    provenance: isRoot ? "explicit" : "dependency",
  });
},
```

And `deriveInstallVersion`'s precedence (`install-outcome.ts:332-363`) checks `pinVersionOverride` FIRST, unconditionally, before any source-kind branching:

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:346-363
async function deriveInstallVersion(args: {
  entry: PluginEntry;
  installable: MaterializablePlugin;
  resolvedSha: string | undefined;
  pinVersionOverride: string | undefined;
}): Promise<string> {
  if (args.pinVersionOverride !== undefined) {
    return args.pinVersionOverride;  // <-- D-07-02 is satisfied here, automatically
  }
  // ... (git-source sha branch, then the 3-tier ladder -- neither reached for a pinned path member)
}
```

**Consequence for the plan:** as long as `install-cascade.ts` attaches `pin: { oid: tagOid, version: tagVersion }` to a path-source `ResolvedCascadeMember` exactly the same way it already does for a git-backed one (`install-cascade.ts:210-226`, `probeMemberPin`, lines 468-518), D-07-02 (record the tag's own semver) requires **zero new code** in `install-outcome.ts` or `install-flow.ts` — the existing `pinVersionOverride` plumbing already handles it. The only genuinely new plumbing is (a) how `resolveMemberTagSource`/`probeMemberPin` PRODUCE that pin for a path source in the first place (Pattern 1 above), and (b) how the pin's `oid` gets turned into materialized FILES for a path source (Pattern 2/3 above, since `sourcePinOverride` alone does nothing for a path source today — it only feeds `resolveGitPluginRoot`, which path sources never call).

### Anti-Patterns to Avoid

- **Reusing `probeDependencyTags`/`dependency-tag-probe.ts` unmodified for the local case:** it is hard-wired to `listRemoteTags` (network, `listServerRefs`). Do not attempt to make it "dual-mode" by branching internally on a `local: boolean` flag — its module header explicitly frames it as the network-only leaf exempted from `NETWORK_FREE_TARGETS` for that specific reason (dependency-tag-probe.ts:11-17); a local-only sibling function keeps that framing accurate and keeps the existing module's tests untouched.
- **Pointing `gitdir` at the marketplace clone's real `.git` for the tag-materialization checkout:** see "Critical Technical Finding" above — this corrupts the marketplace clone's own index.
- **Treating `{no matching version}` (the existing FailureReason) as TAGS-02's fallback token:** `{no matching version}` is documented (`docs/dependency-resolution.md:218`) and typed (`shared/notify-reasons.ts:146-180`, `FailureReason`) as a reason that appears on a FAILED install row. TAGS-02's outcome is a SUCCESSFUL install with an informational note — reusing the failure token on a success row would misrepresent the outcome to anything that greps the catalog for failure-class reasons (`tests/architecture/catalog-uat/`). A new, distinct `CommandPrivateReason` token is required (see "Code Examples" below for the precedent to follow).
- **Skipping the `resolvedSha` stamp on the install record for a tag-pinned path-source member:** `clone-gc.ts::deriveLiveCloneKeys` (lines 38-54) ONLY protects a `plugin-clones/<key>/` directory when the record carries `resolvedSha !== undefined`. A path-source record that materializes into `plugin-clones/<key>/` but leaves `resolvedSha` unset will have its directory swept on the very next `uninstall`/`update`/`marketplace remove` elsewhere in the same scope — a live, reproducible data-loss bug if missed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Comparing/selecting versions | A second semver comparator for the local tag case | `domain/dependency-range.ts::recordedVersionSatisfies` + `semver`'s `gt`/`valid` (already imported by `dependency-tag-probe.ts:33`) | One satisfaction evaluator, per the project's own stated principle (`dependency-tag-probe.ts:184-185`: "the satisfaction test is domain/dependency-range.ts's, not a second evaluator") |
| Copying a repo + checking out a specific commit locally | A hand-rolled fs-walk + git-object-decode | `cp(marketplaceRoot, staging, {recursive:true})` + `gitOps.checkout({dir: staging, ref})` | Exactly `seedOnePluginMirror`'s existing, tested pattern; reinventing it risks missing an edge case (symlinks, permission bits, `.gitignore`d-but-tracked files) `cp -r` + real git checkout already handle correctly |
| Deriving a marketplace's canonical clone URL | A second URL-canonicalization routine for path-sourced marketplaces | `clone-cache.ts::deriveMarketplaceUrl` (already handles both the github/url-marketplace case and the path-marketplace-reads-its-own-`.git/config`-origin case) | Already exists, already fs-only/NFR-5-safe, already used by the structurally identical SEED-* feature |
| Deciding what counts as an "installable" source kind | A parallel classification of source kinds for the tag-probe path | `domain/source.ts::parsePluginSource` + the existing `ParsedSource` discriminated union (`kind === "path"`) | One parser, one discriminated union, already the single source of truth project-wide (`domain/source.ts` header docstring) |

**Key insight:** every piece this phase needs except the local `listTags` wrapper and the constraint-resolution branching already exists in the codebase, built for a structurally adjacent problem (SEED-* same-repo mirroring, RESV-03 tag-pin version recording). The risk in this phase is almost entirely in WIRING — finding the exact places three or four existing, well-tested primitives need a new caller — rather than in novel algorithm design.

## Runtime State Inventory

Not applicable. This phase adds new behavior (local tag resolution) rather than renaming, refactoring, or migrating an existing string/identifier. No rename/refactor/migration audit is required.

## Common Pitfalls

### Pitfall 1: Shared-gitdir index corruption (see "Critical Technical Finding")

**What goes wrong:** A literal implementation of D-07-01's "separate dir/gitdir pair" checks out a tag with `gitdir` pointed at the marketplace clone's own `.git`, silently overwriting `<marketplaceClone>/.git/index`.
**Why it happens:** isomorphic-git's `checkout()` always reads/writes `${gitdir}/index` regardless of `noUpdateHead`; there is no isomorphic-git flag that scopes a checkout's index effects to only `dir` while leaving `gitdir`'s index alone.
**How to avoid:** Copy the marketplace checkout (`cp -r`, including `.git`) into the new keyed directory FIRST, then checkout using the copy's own default gitdir — see Pattern 2.
**Warning signs:** After the first tag-pinned path-source install, `marketplace update <name>` on that same marketplace behaves oddly (spurious file changes, files reverting, or a `CommitNotFetchedError`/checkout error that references a tree the marketplace was never actually at).

### Pitfall 2: Forgetting `resolvedSha` on the record

**What goes wrong:** The new `plugin-clones/<key>/` directory for a tag-pinned path-source plugin gets deleted by `clone-gc.ts` on the very next unrelated `uninstall`/`update`/`marketplace remove` in the same scope, because `deriveLiveCloneKeys` only protects keys where `record.resolvedSha !== undefined` (`clone-gc.ts:42`).
**Why it happens:** `resolvedSha` is a git-source-only field today, populated only by `resolveGitPluginRoot`'s callback (`install-outcome.ts:454`, `let resolvedSha: string | undefined;`, set only inside the git-backed materialize path). A new path-source materialization path must independently remember to set it.
**How to avoid:** The new resolver injection point (Pattern 3) must return `resolvedSha = tagOid` alongside `pluginRoot`, exactly like `resolveGitPluginRootWithSubdir` already does for git-backed sources (`clone-cache.ts:594-609`, `GitPluginRootResult`'s `materialized` arm carries `resolvedSha`).
**Warning signs:** A tag-pinned path-source plugin's files vanish from disk after an unrelated uninstall elsewhere in the same scope, while its `state.json` record still looks intact until the next load tries to read a missing directory.

### Pitfall 3: Conflating "marketplace clone's own git-backed same-repo source" with "path source" tag resolution

**What goes wrong:** `dependency-tag-probe.test.ts` already has a passing test, "reports the same no-match arm when the query ran against the marketplace repository" (`tests/orchestrators/plugin/dependency-tag-probe.test.ts:236-253`), which exercises `probeDependencyTags` against a `GitBackedSource` whose URL happens to equal the marketplace's OWN repository URL — this is the case where a plugin entry uses e.g. a `git-subdir` source pointing back at the marketplace's own repo, resolved over the **network** exactly like any other git-backed dependency. It is easy to mistake this existing test/capability for "the local path-source case already works" — it does not. Phase 7's target is a `PathSource`-kind entry (`"source": "./plugins/x"`), which has no `url` at all and is parsed to `{ kind: "path", raw, logical }` (`domain/source.ts:24-28`); `resolveMemberTagSource` (`install-cascade.ts:449-452`) explicitly returns `undefined` for exactly this kind today, which is the actual bug this phase closes.
**Why it happens:** Both scenarios involve "the marketplace's own repository" in some sense, but one is network-based (existing, works) and one is local-clone-based (missing, this phase's job).
**How to avoid:** Keep the new local-listing code path entirely separate from `dependency-tag-probe.ts`, gated strictly on `parsedSource.kind === "path"` (not on "URL happens to match the marketplace's").
**Warning signs:** A test that asserts "path-source tag resolution works" but actually constructs a `GitSubdirSource`/`UrlSource` fixture pointed at the marketplace's URL would pass without exercising the new local code at all.

### Pitfall 4: The new non-failure outcome must not become a `CascadeConstraintFailure`

**What goes wrong:** `MemberConstraintResolution` is currently a strict `{ok: true, members} | {ok: false, failure}` union (`install-cascade.ts:229-231`), and `resolveOneMember`/`probeMemberPin` currently treat "no matching tag" as always `{kind: "failed", ...}` (`install-cascade.ts:501-506`). A naive implementation of TAGS-02 might reuse this exact failure shape for a path source's "no matching tag" case, which would fail the entire cascade (D-03-07 all-or-nothing rollback) — the opposite of TAGS-02's requirement ("the install proceeds with the marketplace's current copy").
**Why it happens:** The failure-shaped return is the path of least resistance from the existing `probeMemberPin` structure, since it is the ONLY existing "no tag matched" arm.
**How to avoid:** For a `path`-source member with no satisfying tag, `resolveOneMember`/`probeMemberPin`'s equivalent must return `{kind: "resolved", member}` (the member UNCHANGED — no `pin` — installing exactly as an unconstrained member would today) PLUS a side-channel note (e.g. a new field on `ResolvedCascadeMember` or a parallel list threaded alongside `members`) that the row composer reads to render the info note. This mirrors how `CascadeSkippedMember`/`alreadyInstalled` already carries an out-of-band fact (RESV-05) that isn't itself a `Phase` outcome.
**Warning signs:** A path-source dependency with a version constraint and no matching tag causes the WHOLE cascade to fail instead of installing the requesting plugin plus the current-copy dependency — directly contradicts TAGS-02's stated success criterion.

## Code Examples

### The existing `CommandPrivateReason` pattern to follow for TAGS-02's new token

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify-reasons.ts:296-307 (existing precedent)
  | "dependency disabled"
  // D-04-07: install's marker for a recorded dependency the user then named.
  // The record changed hands and nothing was materialized, so it joins
  // `already installed` on an `installed` row rather than a skipped one -- a
  // promotion mutates state, which is why it is not an idempotent reason.
  | "dependency promoted"
```

A new token such as `"dependency current copy"` (exact wording is Claude's Discretion per D-07-03) would join this same `CommandPrivateReason` union in `shared/notify-reasons.ts`, be added to the closed `REASONS` tuple in `shared/notification-types.ts` (currently pinned at a specific length by `tests/architecture/notify-closed-set-locks.test.ts` and the `COMPAT-01` no-expansion gate over `docs/output-catalog.md` — both need the deliberate, documented amendment the file's own header comments describe for every prior addition), and be composed in `install-cascade.messaging.ts` following the exact `composePromotedRow` shape (`install.messaging.ts:333-368`):

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:333-368
// (composePromotedRow) -- the shape a new TAGS-02 row composer should mirror:
// status: "installed", a NON-idempotent reason token, severity stamped
// literally as "info" (not derived from skipSeverity, which only classifies
// idempotent-vs-not for a SKIPPED row).
return {
  status: "installed",
  name: args.plugin,
  version: args.version,
  scope: args.scope,
  dependencies: [],
  reasons: [/* the new token */],
  severity: "info",
  needsReload: args.needsReload,
};
```

### The local tag-listing wrapper (new, following the existing `listRemoteTags` shape)

```typescript
// Verified isomorphic-git API: node_modules/isomorphic-git/index.d.ts:2173-2177
// Pattern to follow: platform/git.ts:331-363 (listRemoteTags), adapted for
// the local, no-network case (no `http`, no `auth`, `dir` instead of `url`).
export interface ListTagsOptions {
  dir: string;
}

export async function listTags(opts: ListTagsOptions): Promise<string[]> {
  return git.listTags({ fs, dir: opts.dir });
}
```

Resolving each candidate name's oid (isomorphic-git's `listTags` returns names only, unlike `listRemoteTags`'s `{name, oid}` pairs) needs an additional `resolveRef`/peeling step — see "Pattern 1" above for the two viable orderings.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Path-source dependency + any non-wildcard constraint → unconditional `{no matching version}` failure | Path-source dependency + constraint resolves against the marketplace clone's own local tags, with a no-match fallback to the current copy | This phase (TAGS-01/02/03) | Version constraints become usable on the common case (most marketplaces use path sources) |

**Deprecated/outdated:** none — no prior implementation of this capability existed to deprecate; this is new capability, not a replacement.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Local annotated-tag peeling via `resolveRef`/`readTag` behaves equivalently to the remote `listServerRefs({peelTags:true})` peeling already verified live in Phase 3's UAT (`03-UAT.md`) | Pattern 1 | If it differs (e.g. `resolveRef` on an annotated tag's ref returns the TAG object's oid, not the peeled commit, without an extra `readTag`/`log` step), the local prober could pin to a tag object instead of a commit, breaking checkout. Recommend a live-UAT check against a real annotated tag on a real marketplace clone, mirroring how Phase 3 verified the remote case live rather than only in a mocked test. |
| A2 | `deriveMarketplaceUrl`'s path-source branch (reading `.git/config` origin) reliably produces a stable, reusable key basis for EVERY marketplace this phase will encounter, including one added without a discoverable `origin` remote | Pattern 2 / Critical Technical Finding | If `deriveMarketplaceUrl` returns `undefined` for some marketplace shapes, the plan needs a fallback key basis (e.g. keying off `marketplaceRoot` itself, or off the marketplace's own recorded name) — worth confirming during planning which marketplaces in practice lack a discoverable origin. |
| A3 | Widening `ResolveContext`'s injected-callback shape (Pattern 3, option 1 or 2) has no other production caller of `domain/plugin-resolver.ts` that would be affected by the new field/widened type | Pattern 3 | `plugin-resolver.ts` is read by `list`/`info` in addition to `install` (per `NETWORK_FREE_TARGETS`'s own comment, "the resolver now answers a question for list and info"); a new REQUIRED field would break those callers, but an OPTIONAL new field/callback (the recommended shape) should not. Confirm at planning/implementation time that `list`/`info`'s existing `ResolveContext` construction sites compile unchanged with an added optional field. |

## Open Questions

1. **Exact shape of the new non-failure "fell back to current copy" outcome (TAGS-02)**
   - What we know: it must NOT be a `CascadeConstraintFailure` (would fail the whole cascade, D-03-07); it must render as an `installed`-status row with a new info-severity reason token (D-07-03).
   - What's unclear: whether the cleanest implementation adds a new optional field to `ResolvedCascadeMember` (e.g. `fellBackToCurrentCopy?: true`) that the row composer reads, or a parallel list alongside `members`/`alreadyInstalled` (mirroring `CascadeSkippedMember`'s existing pattern for a structurally similar "out of band fact about a member that isn't itself a Phase outcome").
   - Recommendation: the planner should pick whichever keeps `MemberConstraintResolution`'s `ok: true` arm and `ResolvedCascadeMember` the simplest to reason about; either is architecturally sound given the precedents already in the file.

2. **Eager vs. lazy oid resolution for local tag candidates**
   - What we know: `listTags` returns names only; each candidate needs a separate `resolveRef`/peel call to get an oid.
   - What's unclear: whether resolving every candidate eagerly (simpler, matches `RemoteTag[]`'s existing shape so `selectHighestSatisfyingTag` needs zero changes) or lazily (fewer `resolveRef` calls, but requires generalizing the shared selection function) is preferable; a typical marketplace has few enough tags per plugin that eager resolution is very unlikely to matter for performance.
   - Recommendation: eager resolution, reusing `selectHighestSatisfyingTag` unchanged by producing a `RemoteTag[]`-shaped list from the local names — the simpler option, and consistent with "reuse the existing selection logic" rather than generalizing it prematurely.

3. **Subdirectory support for a `path` source that also has a version constraint and a matching tag**
   - What we know: `PathSource` is a bare relative path (`raw`/`logical`), not itself a "repo + subdir" pair the way `GitSubdirSource` is — but conceptually, once a `path` entry is pinned to a tag, its `raw` path IS a subdirectory of the checked-out tree, structurally identical to `git-subdir`'s `path` field.
   - What's unclear: whether the plan should literally reuse `resolveGitPluginRootWithSubdir` (renaming/generalizing it) or write a smaller path-specific containment check, given `domain/plugin-resolver.ts`'s existing `path` branch already has its OWN containment check (`sourceEscapeReason`, `plugin-resolver.ts:232-247`) that must still apply to the checked-out copy's root, not the marketplace's original root.
   - Recommendation: reuse `resolveGitPluginRootWithSubdir`'s containment logic against the new checked-out copy's root, since it is already NFR-10-audited and tested; do not re-derive.

## Environment Availability

Not applicable — no new external tool, service, or runtime dependency. `isomorphic-git` and `semver` are already installed dependencies (verified above); all git operations remain local-filesystem-only for this phase's new code paths (TAGS-01's own success criterion is explicitly "no network access").

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` + `node:assert/strict` [VERIFIED: package.json:86, `tests/orchestrators/plugin/dependency-tag-probe.test.ts:1-2`] |
| Config file | none — `npm test` globs `tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts` (package.json:86) |
| Quick run command | `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/dependency-tag-probe.test.ts` (and the new test file(s) this phase adds) |
| Full suite command | `npm run check` (typecheck, lint, fallow, format:check, corresponding-test gates, `npm test`, `npm run test:integration`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAGS-01 | Local tag listing selects the highest satisfying `{name}--v{version}` tag from a path source's marketplace clone, offline | unit | `node --test tests/orchestrators/plugin/<new-local-tag-probe>.test.ts` | ❌ Wave 0 — new test file needed, mirroring `dependency-tag-probe.test.ts`'s structure |
| TAGS-01 | No network call occurs for the path-source resolution path | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ existing — the new local-probe module must stay OUT of `NETWORK_FREE_TARGETS` (same arrangement as `dependency-tag-probe.ts`) and must not import `platform/git.ts`'s network functions |
| TAGS-02 | No matching tag on a path source → install proceeds with the current copy, row carries the new info-level reason | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` (new cases) | ✅ file exists — new test cases needed |
| TAGS-02 | The new reason token is a closed-set member (COMPAT-01) | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ existing — will fail until the new token is added everywhere the closed-set gates expect (REASONS tuple, notify-reasons.ts grouping, output-catalog.md, catalog byte-count) |
| TAGS-03 | A satisfying tag materializes the plugin's files from that tag (not the current checkout) | unit + integration | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/install-outcome.test.ts` (new cases) | ✅ files likely exist (not opened this session — confirm exact filenames during planning) — new test cases needed |
| TAGS-03 | The materialized clone survives `clone-gc.ts`'s sweep after an unrelated uninstall in the same scope | unit | `node --test tests/orchestrators/plugin/clone-gc.test.ts` (new case) | confirm exact filename during planning — this is the Pitfall 2 regression test and should not be skipped |
| DIVG-01 | Docs state the `sha`-field divergence and the new resolution behavior | manual / doc-lint | `docs/dependency-resolution.md` prose review; `tests/architecture/` vocabulary guards over `docs/output-catalog.md` if the new reason token's exact wording is quoted there too | doc-only, no dedicated test |

### Sampling Rate

- **Per task commit:** the quick run command above, scoped to the files the task touched.
- **Per wave merge:** `npm run check` (full suite, per this repo's own `check` script — includes typecheck, lint, fallow, the two negative-corresponding-test gates, and `npm test` + `npm run test:integration`).
- **Phase gate:** full suite green before `/gsd-verify-work`, per this project's established convention (every prior phase in this milestone records this as its gate).

### Wave 0 Gaps

- [ ] A new unit test file for the local tag probe (name TBD — e.g. `tests/orchestrators/plugin/marketplace-tag-probe.test.ts`), mirroring `dependency-tag-probe.test.ts`'s structure (a fake `listTags` seam, tests for: highest-satisfying selection, prefix-must-match, no-tags-at-all, tag-name-not-a-version, listing-throw handling if any).
- [ ] New test cases in `tests/orchestrators/plugin/install-cascade.test.ts` for: a path-source member with a satisfying tag (pin attached, version recorded per D-07-02), a path-source member with no satisfying tag (install proceeds, info note, NOT a `CascadeConstraintFailure`).
- [ ] A regression test proving a tag-materialized `plugin-clones/<key>/` directory survives `clone-gc.ts`'s sweep (Pitfall 2) — confirm the exact existing GC test file during planning and add a case there rather than a new file, if one already exercises `deriveLiveCloneKeys`.
- [ ] Confirm whether `tests/orchestrators/plugin/clone-cache.test.ts` (or equivalent — not opened this session) already has a pattern for testing `seedOnePluginMirror`-shaped functions that the new materialize-at-tag function's tests should mirror.

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` (checked; absent = enabled), so this section is included per the default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase's tag listing is entirely local-filesystem (no network, no credentials) |
| V3 Session Management | No | Not applicable to a CLI/local-tooling extension |
| V4 Access Control | No | No new access-control surface |
| V5 Input Validation | Yes | The tag name's version portion is validated via `semver.valid()` (existing pattern, `dependency-tag-probe.ts:171`) before being trusted as a version; the `{name}--v{version}` prefix match is what prevents an arbitrary unrelated tag from being selected (existing pattern, `dependency-tag-probe.ts:158-176`, reused unchanged) |
| V6 Cryptography | No | No cryptographic operation is added |
| V12 Files and Resources | Yes | NFR-10 path containment already governs both halves of this phase's new materialization: the `path` source's own escape check (`plugin-resolver.ts::sourceEscapeReason`, existing, must still apply to the new checked-out root) and the new clone-cache directory's containment via `locations.pluginCloneDir` (the existing SC-7 chokepoint, `assertSafeName`/`assertPathInside`, reused unchanged) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted tag name (e.g. `formatter--v1.0.0-actually-evil-payload`) selected as a satisfying version when it is not really a valid semver | Tampering | `semver.valid()` gate before satisfaction testing (existing pattern, reused unchanged — no new code needed here, only correct reuse) |
| A tag belonging to an unrelated plugin in the same marketplace (e.g. `other-plugin--v9.9.9`) selected for THIS plugin's constraint | Spoofing | The `{pluginName}--v` prefix match (existing pattern, `dependency-tag-probe.ts:231`, reused unchanged) — this project's existing rule that "a tag that does not carry THIS dependency's own release prefix is never a candidate" applies identically to the local listing |
| A `path` source's `raw` value escaping the marketplace root after being resolved against a tag-checked-out copy instead of the live marketplace root | Tampering / Elevation of Privilege | `sourceEscapeReason`'s existing `assertPathInside` check (`plugin-resolver.ts:232-247`) must be re-run against the NEW checked-out root, not skipped because "it already passed against the live marketplace root" — the escape check is a property of the (root, relative-path) pair, and the root changes for a pinned install |
| A malicious/compromised marketplace clone with a crafted `.git` history where an old tag points at a plugin subtree containing symlinks that escape the checked-out copy | Tampering | Not a new threat this phase introduces — `cp -r`'s symlink handling and the existing containment check both already apply; worth an explicit test case if the planner has time, but this is the same threat class the existing git-subdir materialization already accepts as covered by NFR-10 |

## Sources

### Primary (HIGH confidence — read directly this session)

- `node_modules/isomorphic-git/index.d.ts` (lines 1990-2177, 3010-3052) — `listTags`, `listRefs`, `resolveRef`, `checkout` signatures
- `node_modules/isomorphic-git/index.cjs` (lines 1073, 7164-8008) — `checkout`/`_checkout` implementation, confirming the shared-index behavior (the Critical Technical Finding above)
- `extensions/pi-claude-marketplace/platform/git.ts` (full file) — existing git wrapper conventions
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts` (full file) — the network tag-probe this phase's local counterpart parallels
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` (full file) — constraint resolution integration points
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` (full file) — `seedOnePluginMirror`, `deriveMarketplaceUrl`, `materializePluginClone` precedents
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts` (full file) — `deriveLiveCloneKeys`'s `resolvedSha` requirement (Pitfall 2)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts` (full file) — the existing git-backed-only materialization dispatcher
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` (lines 150-475) — `InstallLedgerOptions`, `deriveInstallVersion`, `preflightInstallResolve`'s `ResolveContext` construction
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` (lines 255-310, 1400-1470) — cascade `ledgerOptionsFor` builder, `sourcePinOverride`/`pinVersionOverride` plumbing
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` (lines 180-431) — `deriveSourcePluginRoot`'s uninjectable `path` branch
- `extensions/pi-claude-marketplace/domain/resolver-types.ts` (full file) — `ResolveContext`'s current callback type
- `extensions/pi-claude-marketplace/domain/source.ts` (full file) — `ParsedSource`/`PathSource`/`GitBackedSource` shapes
- `extensions/pi-claude-marketplace/domain/clone-key.ts` (full file) — `pluginCloneKey`/`pluginMirrorKey`/`canonicalCloneUrl`
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (lines 19-305, 380) — `marketplaceRoot`/`resolvedSource`/`resolvedSha` schema fields
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (full file) — the closed `Reason` topic groups and the `composePromotedRow`-adjacent precedent
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` (lines 320-370) — `composePromotedRow`, the exact row-composition precedent for TAGS-02
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` (lines 1-120) — cascade-row messaging conventions
- `tests/architecture/gate-targets.ts` (full file) — `NETWORK_FREE_TARGETS` membership, confirming `install-cascade.ts` and `dependency-tag-probe.ts` are both outside the gate while `install-flow.ts`/`install-outcome.ts` are inside it (by injected-seam-name convention)
- `tests/architecture/no-orchestrator-network.test.ts` (full file) — the gate's forbidden-pattern mechanics
- `tests/orchestrators/plugin/dependency-tag-probe.test.ts` (lines 217-253) — the existing "marketplace repository" network test, distinguished from this phase's local case (Pitfall 3)
- `docs/dependency-resolution.md` (full file) — current documented behavior, exact line numbers for DIVG-01's target sections
- `.planning/phases/07-marketplace-repo-tag-resolution/07-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/HANDOFF-upstream-dependency-parity.md`, `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-CONTEXT.md` — upstream requirement/decision provenance

### Secondary (MEDIUM confidence)

None — no external documentation lookup was performed (no MCP doc providers configured for this project per `init.phase-op`'s `brave_search`/`firecrawl`/`exa_search: false`), and none was needed: this phase adds no new external dependency and every question was answerable by reading the installed package's own source and this repository's existing code.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; both existing libraries' relevant APIs were read directly from the installed package source, not from memory
- Architecture: HIGH — every integration point (resolver injection, ledger options, cascade constraint resolution, clone-cache materialization) was traced to specific file/line citations this session
- Pitfalls: HIGH — the shared-gitdir index-corruption finding is verified against the installed isomorphic-git source, not assumed from general git knowledge; the `resolvedSha`/GC pitfall is verified against `clone-gc.ts`'s actual sweep predicate

**Research date:** 2026-09-19
**Valid until:** 30 days (stable, in-repo mechanics; no external API surface expected to shift) — re-verify the isomorphic-git behavior findings if `package.json`'s `isomorphic-git` version changes before this phase is planned/executed.

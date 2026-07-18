# Phase 77: Plugin clone cache + install - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 9 (2 new, 7 modified)
**Analogs found:** 9 / 9

All source paths are under `extensions/pi-claude-marketplace/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `orchestrators/plugin/clone-cache.ts` (NEW) | orchestrator seam | file-I/O + git-clone | `orchestrators/marketplace/add.ts` (`addGitClonedInGuard`) | exact (role + flow) |
| `domain/clone-key.ts` OR extend `domain/version.ts` (NEW/mod) | utility (pure) | transform | `domain/version.ts` (`computeHashVersion`) | exact |
| `domain/resolver.ts` (mod) | domain resolver | transform (classification) | self (existing `preflightStages`/`sourceUnsupportedReason`) | in-place |
| `domain/version.ts` (mod) | utility (pure) | transform | self (`computeHashVersion`) | in-place |
| `persistence/locations.ts` (mod) | config/path chokepoint | transform | self (`sourceCloneDir`/`sourcesStagingDir`) | in-place |
| `persistence/state-io.ts` (mod) | model (schema) | CRUD | self (`lastReconciledExtensionVersion` additive-optional) | in-place |
| `platform/git.ts` (mod) | platform wrapper | request-response (network) | self (`resolveRef` wrapper) | in-place |
| `orchestrators/marketplace/shared.ts` (mod) | interface (`GitOps`) | request-response | self (`GitOps.resolveRef`) | in-place |
| `orchestrators/plugin/install.ts` (mod) | orchestrator | request-response | self (PI-4 resolve gate, PI-7 version, state phase) | in-place |
| `shared/notify.ts` (mod) | utility (renderer) | transform | self (`formatHashVersionForDisplay`) | in-place |

## Pattern Assignments

### `orchestrators/plugin/clone-cache.ts` (NEW — orchestrator seam)

**Analog:** `orchestrators/marketplace/add.ts` — `addGitClonedInGuard` (lines 618-698). This is the exact template: staging clone → validate → atomic rename → MA-9 append-leak cleanup. Distill it; drop the marketplace-manifest-read/duplicate-name/state-mutation steps (steps 2, 3, 6) — the plugin clone materializes a tree and returns `cloneRoot`; the resolver reads the manifest afterward.

**Staging + clone + append-leak pattern** (add.ts:628-643):
```typescript
const stagingDir = await locations.sourcesStagingDir(randomUUID());
try {
  await gitOps.clone({
    dir: stagingDir,
    url: cloneUrl,
    ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
    ...(auth !== undefined && { auth }),   // OMIT for Phase 77 — public-only (D-77-06)
  });
} catch (err) {
  const leak = await cleanupStaging(stagingDir, "marketplace clone staging");
  throw appendLeakToError(err, leak);   // MA-9: append, do not mask
}
```

**Atomic rename same-FS pattern** (add.ts:667-698):
```typescript
// same FS: sources-staging/ and the final dir are siblings under extensionRoot
await mkdir(path.dirname(finalDir), { recursive: true });
await rename(stagingDir, finalDir);
stagedAtFinal = true;
// ... MA-9 catch: cleanupStaging(stagingDir OR finalDir) + appendLeakToError
```

**Phase-77 deltas from the analog:**
- Compute `cloneRoot = await locations.pluginCloneDir(key)` where `key = pluginCloneKey(cloneUrl, pin)` (D-77-04).
- **Warm-cache short-circuit BEFORE clone** (PURL-02/04 dedup): `if (await pathExists(cloneRoot)) return cloneRoot;` — no network on a key hit.
- After the ref-hint clone, `await gitOps.checkout({ dir: stagingDir, ref: pin })` to pin the exact commit (sha wins over ref — Pitfall 6).
- **EEXIST/ENOTEMPTY-tolerant rename** (Pitfall 4): a concurrent install of the same url+sha produces a byte-equivalent tree; on `EEXIST`/`ENOTEMPTY` clean staging and return `cloneRoot` as warm-cache success; any other errno append-leaks-and-rethrows.
- Imports `DEFAULT_GIT_OPS` from `orchestrators/marketplace/shared.ts` (Pattern S-9 re-export; `update.ts:119` does exactly this). Entrypoint takes an injected `gitOps?: GitOps` defaulting to `DEFAULT_GIT_OPS` (D-12).
- **Do NOT add this file to the `no-orchestrator-network` forbidden-targets list** — it is legally allowed `gitOps`, like `update.ts`.

---

### `domain/clone-key.ts` or `domain/version.ts` (NEW/mod — pure utility)

**Analog:** `domain/version.ts` — `computeHashVersion` (lines 30-34). Same `node:crypto` `createHash("sha256")` + 12-hex truncation idiom.

**Truncation idiom to mirror** (version.ts:27-34):
```typescript
const HASH_TRUNC = 12;
export async function computeHashVersion(pluginRoot: string): Promise<string> {
  const hash = createHash("sha256");
  await walkAndHash(hash, pluginRoot, "");
  return "hash-" + hash.digest("hex").slice(0, HASH_TRUNC);
}
```

**New helpers (Phase 77):**
```typescript
// pluginCloneKey: <12hex(sha256(canonicalUrl))>-<sha12>  (D-77-04)
export function pluginCloneKey(canonicalUrl: string, fullSha: string): string {
  const urlHash = createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 12);
  return `${urlHash}-${fullSha.slice(0, 12)}`;
}
```
Both the clone seam and the list/info probe MUST call this same helper so keys agree. Canonical URL = the parse-time `.git`-stripped, ref-split form (D-77 discretion, recommended).

---

### `domain/version.ts` — `sha-<12hex>` sibling (mod — pure utility)

**Analog:** `shared/notify.ts` `HASH_VERSION_RE` / `looksLikeHashVersion` (lines 1737-1740) for the predicate; `computeHashVersion` for the constructor.

```typescript
const SHA_VERSION_RE = /^sha-[0-9a-f]{12}$/;
export function shaVersion(fullSha: string): string { return "sha-" + fullSha.slice(0, 12); }
export function looksLikeShaVersion(v: string): boolean { return SHA_VERSION_RE.test(v); }
```
The full 40-hex sha stays in state's `resolvedSha`; `sha-<12hex>` is display/identity only (D-77-02).

---

### `domain/resolver.ts` (mod — domain resolver)

**Analog:** self — in-place widening. Three seams.

**1. Widen `sourceUnsupportedReason`** (resolver.ts:497-505 — currently only `path` returns `undefined`):
```typescript
function sourceUnsupportedReason(parsedSource: ParsedSource): string | undefined {
  switch (parsedSource.kind) {
    case "path": case "github": case "url": case "git-subdir":
      return undefined;                       // installable (PURL-01)
    case "npm":     return `unsupported source kind: npm`;   // still rejected
    case "unknown": return `unsupported source kind: unknown (${parsedSource.reason})`;
  }
}
```

**2. Inject `resolveGitPluginRoot` on `ResolveContext`** (resolver.ts:240-244 — mirror the existing `readFileText`/`statKind` optional-injection idiom):
```typescript
export interface ResolveContext {
  readonly marketplaceRoot: string;
  readonly readFileText?: (p: string) => Promise<string>;
  readonly statKind?: StatKindReader;
  readonly resolveGitPluginRoot?: (source: UrlSource | GitSubdirSource | GitHubSource)
    => Promise<GitPluginRootResult>;   // absent → git sources resolve unavailable (path-only callers)
}
```
`GitPluginRootResult` is a discriminated union (`materialized` | `not-cached` | `escapes` | `missing-subdir`) so NFR-7 stays sound — the `unavailable` arm never carries `pluginRoot`.

**3. Branch `preflightStages` pluginRoot derivation** (resolver.ts:592-601 — currently `pluginRoot = path.resolve(ctx.marketplaceRoot, parsedSource.raw)` for all). Path sources keep the `marketplaceRoot` derivation + `sourceEscapeReason`; git sources delegate to `ctx.resolveGitPluginRoot(source)` and switch on the result kind. Re-anchor git-subdir containment to `cloneRoot` (not `marketplaceRoot`, Pitfall 3).

**Existing containment pattern to re-anchor** (`sourceEscapeReason`, resolver.ts:507-522):
```typescript
try {
  await assertPathInside(ctx.marketplaceRoot, pluginRoot, `plugin source path "${rawSource}"`);
  return undefined;
} catch (err) {
  if (err instanceof PathContainmentError) { return `source path escapes marketplace root: ${rawSource}`; }
  throw err;
}
```
For git-subdir, the `assertPathInside(cloneRoot, pluginRoot, ...)` check lives inside the injected callback (where `cloneRoot` is in scope) and surfaces as the `escapes` result arm.

---

### `persistence/locations.ts` (mod — path chokepoint, SC-7)

**Analog:** `sourceCloneDir` (locations.ts:216-223) and `sourcesStagingDir` (225-230). Add two members with the identical `assertSafeName` → `path.join` → `assertPathInside` chokepoint discipline.

**Template** (sourceCloneDir, 216-223):
```typescript
async sourceCloneDir(mp: string): Promise<string> {
  assertSafeName(mp, `sourceCloneDir marketplace name "${mp}"`);
  const candidate = path.join(sourcesDir, mp);
  await assertPathInside(sourcesDir, candidate, `sourceCloneDir(${mp})`);
  return candidate;
}
```
New: `pluginClonesDir` (hard-coded `path.join(extensionRoot, "plugin-clones")` suffix, sibling of `sources-staging/`) + `pluginCloneDir(key)` gated the same way. The key is fixed-length hex+dash (safe by construction) but keep `assertSafeName` for defense-in-depth symmetry.

---

### `persistence/state-io.ts` (mod — schema)

**Analog:** `lastReconciledExtensionVersion` (state-io.ts:161) — additive-optional field, NO `schemaVersion` bump.

**Add to `PLUGIN_INSTALL_RECORD_SCHEMA`** (state-io.ts:54-73):
```typescript
const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  resolvedSha: Type.Optional(Type.String()),   // D-77-02: full 40-hex; git-source only; absent=legal
  compatibility: Type.Object({ /* unchanged */ }),
  resources: Type.Object({ /* unchanged */ }),
  enabled: Type.Boolean(),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});
```
`migrate.ts` needs NO fill pass — an optional field's absence is legal (unlike the `ensurePluginResources`/`ensurePluginEnabled` required-field fills). `toDisabledRecord` (state-io.ts:110-120) spreads `...record`, so `resolvedSha` survives disable automatically.

---

### `platform/git.ts` + `orchestrators/marketplace/shared.ts` (mod — network wrapper + GitOps interface)

**Analog:** `platform/git.ts::resolveRef` (line 166) wrapper + the `GitOps` interface method (shared.ts:118-119). Add a `resolveRemoteRef({ url, ref? }): Promise<string>` wrapper over isomorphic-git `getRemoteInfo2` (unpinned HEAD → sha, D-77-05) and expose it as a new `GitOps` method wired through `DEFAULT_GIT_OPS` (shared.ts:135-148).

**GitOps method-declaration idiom** (shared.ts:118-119):
```typescript
/** Resolve a ref name to its SHA (used to read remote SHA after fetch). */
resolveRef(opts: { dir: string; ref: string }): Promise<string>;
```
**DEFAULT_GIT_OPS wiring idiom** (shared.ts:135-148): `resolveRef: defaultGit.resolveRef,`. Keeps isomorphic-git confined to `platform/git.ts` (D-13). Note `platform/git.ts:22` explicitly documents sparse checkout is NOT exposed — Phase 77 does a full clone (documented divergence).

---

### `orchestrators/plugin/install.ts` (mod — orchestrator)

**Analog:** self — three existing seams, unchanged shape.

**PI-4 resolve gate** (install.ts:499): pass the new `resolveGitPluginRoot` install callback into the context:
```typescript
const resolved = await resolveStrict(entry, {
  marketplaceRoot: sourceMp.marketplaceRoot,
  resolveGitPluginRoot: installCloneProbe,   // NEW — clone-materializing (calls clone-cache.ts seam)
});
```
The gate (`requireInstallable`/`requirePartialInstallable`, 504-508) and the 5-phase ledger are UNCHANGED — they read `resolved.pluginRoot` uniformly.

**PI-7 version** (install.ts:555): for git sources, branch to `shaVersion(pin)` instead of `resolvePluginVersion`'s 3-tier ladder (Open Q1 — recommend git ⇒ always `sha-<12hex>`).

**State-record write** (install.ts:805-807): add `resolvedSha` alongside `version`/`resolvedSource`:
```typescript
mpInner.plugins[c.plugin] = {
  version: c.version,                    // "sha-<12hex>" for git sources
  resolvedSource: c.resolved.pluginRoot,
  resolvedSha: c.resolvedSha,            // NEW: full 40-hex, git sources only (D-77-02)
  compatibility: { installable: c.resolved.state === "installable", /* ... */ },
```
**Constraint:** install.ts MUST NOT name `gitOps`/`DEFAULT_GIT_OPS`/`platform/git`/`refreshGitHubClone` — the clone flows through the imported `clone-cache.ts` entrypoint (Pitfall 2). The install callback that clones is defined in/imported from the seam, not from `gitOps` directly.

---

### `shared/notify.ts` (mod — renderer)

**Analog:** self — `formatHashVersionForDisplay` (notify.ts:1752-1758). Add a `sha-` display arm routed through the same `renderVersion` funnel (1767-1773). notify.ts stays a dumb renderer (MEMORY: no state probing) — a pure string transform:
```typescript
function formatHashVersionForDisplay(v: string): string {
  if (!looksLikeHashVersion(v)) { return v; }
  return `#${v.slice("hash-".length, "hash-".length + 7)}`;
}
```
Mirror for `sha-<12hex>` → `#<7hex>` (either a sibling formatter, or generalize the existing one to both prefixes).

## Shared Patterns

### Atomic clone materialization (NFR-1)
**Source:** `orchestrators/marketplace/add.ts:628-698` (`addGitClonedInGuard`)
**Apply to:** `clone-cache.ts`
Pattern: `sourcesStagingDir(uuid)` clone → `mkdir(dirname)` → `rename` (same-FS sibling under `extensionRoot`). Never clone directly into the final cache dir.

### MA-9 append-leak-not-mask cleanup on throw
**Source:** `orchestrators/marketplace/add.ts:641,690` (`cleanupStaging` + `appendLeakToError`)
**Apply to:** `clone-cache.ts` — every clone/rename failure path. Append leak info to the original error; never mask it.

### GitOps injection (D-12) + Pattern S-9 re-export (D-13)
**Source:** `orchestrators/marketplace/shared.ts:103-148` (`GitOps` interface + `DEFAULT_GIT_OPS`); `orchestrators/plugin/update.ts:119` (re-export usage)
**Apply to:** `clone-cache.ts`, `platform/git.ts`, marketplace/shared.ts. Seam takes `gitOps?: GitOps` defaulting to `DEFAULT_GIT_OPS`; isomorphic-git stays in `platform/git.ts` only.

### SC-7 path-chokepoint containment (NFR-10)
**Source:** `persistence/locations.ts:216-241` (`assertSafeName` → `path.join` → `assertPathInside`)
**Apply to:** the new `pluginCloneDir` helper. Name-derived paths NEVER string-concatenated at call sites.

### Additive-optional state schema (no schemaVersion bump)
**Source:** `persistence/state-io.ts:161` (`lastReconciledExtensionVersion`)
**Apply to:** `resolvedSha` on `PLUGIN_INSTALL_RECORD_SCHEMA`. Absence is legal; no migrate.ts fill.

### 12-hex SHA-256 truncation (crypto)
**Source:** `domain/version.ts:30-34` (`computeHashVersion`)
**Apply to:** `pluginCloneKey` (url hash) and `shaVersion` (commit sha).

### Prefixed short-hash display transform (dumb renderer, IL-2)
**Source:** `shared/notify.ts:1737-1773` (`HASH_VERSION_RE`/`formatHashVersionForDisplay`/`renderVersion`)
**Apply to:** `sha-<12hex>` → `#<7hex>` display.

### ResolveContext injection idiom (network-free domain)
**Source:** `domain/resolver.ts:240-244` (`readFileText`/`statKind` optional callbacks)
**Apply to:** the new `resolveGitPluginRoot` callback — install injects the clone-materializing one; list/info inject a cache-presence-only probe (NEVER clones — NFR-5, Pitfall 1).

## No Analog Found

None. Every new capability maps to an existing in-tree pattern.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,orchestrators/plugin,orchestrators/marketplace,persistence,platform,shared}/`
**Files scanned:** resolver.ts, version.ts, source.ts (via research), add.ts, marketplace/shared.ts, plugin/shared.ts, install.ts, state-io.ts, locations.ts, platform/git.ts, notify.ts
**Pattern extraction date:** 2026-07-11

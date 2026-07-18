# Phase 78: Plugin git-source lifecycle - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 6 source (1 new, 5 modified) + 6 test (1 new, 5 extended)
**Analogs found:** 6 / 6

This phase is almost pure wiring: inject the Phase-77 clone-cache seam into four
existing orchestrators and add one fs-only GC helper. Every hard primitive
(atomic clone, warm-cache dedup, unpinned HEAD resolution, sha-version render,
path containment) already shipped in Phase 77. The analogs below are the exact
files this phase edits; the "closest analog" for the one NEW file
(`clone-gc.ts`) is `clone-cache.ts` (sibling fs helper) + `uninstall.ts`'s
`rm` cleanup template.

All paths are rooted at `extensions/pi-claude-marketplace/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `orchestrators/plugin/clone-gc.ts` (NEW) | utility | file-I/O (derive + delete) | `orchestrators/plugin/clone-cache.ts` + `uninstall.ts:596-610` | role-match |
| `orchestrators/plugin/uninstall.ts` (MOD) | orchestrator | file-I/O / event-driven | itself (`rm(pluginDataDir)` at 596-610) | exact |
| `orchestrators/plugin/update.ts` (MOD) | orchestrator | request-response + streaming (3-phase swap) | `orchestrators/plugin/install.ts` (probe/seam) | exact |
| `orchestrators/plugin/reinstall.ts` (MOD) | orchestrator | CRUD (re-materialize) | `orchestrators/plugin/install.ts` (`InstallCloneCacheSeam` + probe) | exact |
| `orchestrators/plugin/list.ts` (MOD) | orchestrator | request-response (read-only) | itself (`installedRowMessage` / `availableRowMessage`) | exact |
| `orchestrators/plugin/info.ts` (MOD) | orchestrator | request-response (read-only) | `list.ts` availableRowMessage + info's own `buildNotInstalledRow` | exact |

Consumed but NOT modified (read-only reuse): `domain/resolver.ts`
(`GitPluginRootResult` union + `ResolveContext.resolveGitPluginRoot` seam),
`domain/clone-key.ts` (`pluginCloneKey`), `persistence/locations.ts`
(`pluginClonesDir` field + `pluginCloneDir(key)` chokepoint),
`persistence/state-io.ts` (`resolvedSha` field), `shared/notify.ts`
(`composeVersionArrow` — D-78-06 already satisfied).

## Shared Foundations (read before any per-file work)

### The injection seam (domain/resolver.ts:257-280, 656-681)

The resolver stays git-free. Every orchestrator delegates the git-source
clone-vs-probe decision through `ResolveContext.resolveGitPluginRoot`:

```typescript
// domain/resolver.ts:257-261 — the discriminated union each probe returns
export type GitPluginRootResult =
  | { readonly kind: "materialized"; readonly pluginRoot: string; readonly resolvedSha: string }
  | { readonly kind: "not-cached" }
  | { readonly kind: "escapes"; readonly detail: string }
  | { readonly kind: "missing-subdir"; readonly detail: string };

// domain/resolver.ts:277-279 — the seam on ResolveContext
readonly resolveGitPluginRoot?: (
  source: UrlSource | GitSubdirSource | GitHubSource,
) => Promise<GitPluginRootResult>;
```

Resolver mapping (resolver.ts:656-681): absent callback → `unavailable {git
source requires a clone-cache resolver}`; `materialized` → `ok`;
`escapes`/`missing-subdir` → `unavailable {detail}`; **`not-cached` →
`unavailable {not installed}`**. That last arm is the load-bearing PURL-08
subtlety (see Pitfall 3 in RESEARCH): a not-installed git entry that returns
`not-cached` renders `(unavailable)`, but D-78-03 wants `(available)` like a
path plugin. Resolve at planning (Open Q2) — either the presence probe returns
`materialized` for uninstalled entries, or list/info short-circuit git-source
not-installed rows to `(available)` from the manifest without calling the git arm.

### Location chokepoints (persistence/locations.ts)

```typescript
// locations.ts:80,210 — pluginClonesDir is EXPOSED on ScopedLocations
readonly pluginClonesDir: string;   // <extensionRoot>/plugin-clones  (per-scope)

// locations.ts:247-257 — the SC-7/NFR-10 containment chokepoint EVERY
// delete/create/probe target must route through
async pluginCloneDir(key: string): Promise<string> {
  assertSafeName(key, `pluginCloneDir clone key "${key}"`);
  const candidate = path.join(pluginClonesDir, key);
  await assertPathInside(pluginClonesDir, candidate, `pluginCloneDir(${key})`);
  return candidate;
}
```

GC enumerates `readdir(locations.pluginClonesDir)` then routes each entry
through `locations.pluginCloneDir(key)` BEFORE `rm` — a `..`-bearing dir name
is rejected by `assertSafeName`/`assertPathInside` before deletion (NFR-10).

## Pattern Assignments

### `orchestrators/plugin/clone-gc.ts` (NEW — utility, file-I/O)

**Analog:** `clone-cache.ts` (sibling fs helper, import-by-name shape) +
`uninstall.ts:606-610` (the `rm` + swallow template).

Place it as a `clone-cache.ts` sibling (or `clone-gc.ts`) so `uninstall.ts`
imports it WITHOUT touching the git surface — the GC is fs-only (`readdir` +
`rm`), no `gitOps`, keeping uninstall git-clean.

**Live-key derivation (Option A, recommended — Open Q1):** for a git-source
record, install/update/reinstall write `resolvedSource = installable.pluginRoot
= <pluginClonesDir>/<key>[/<subdir>]`. Extract `<key>` as the first path
segment under `pluginClonesDir`:

```typescript
const rel = path.relative(locations.pluginClonesDir, rec.resolvedSource);
const seg = rel.split(path.sep)[0];   // the clone key
```

Only records carrying `resolvedSha` are git-source (path/github-name records
have none → contribute no key → skipped). Full skeleton is in RESEARCH.md
Pattern 1 (lines 150-185).

**Delete template — copy from uninstall.ts:606-610:**

```typescript
try {
  await rm(dir, { recursive: true, force: true });
} catch {
  // D-19-01: hygienic cleanup never becomes the primary user-facing path.
}
```

**ENOENT no-op (idempotent):** `readdir(pluginClonesDir)` on a missing dir
returns `[]`, not a throw (catch `ENOENT` → `return []`). Running GC twice is
safe; a crash between state save and GC leaves an orphan the next pass removes.

**Containment:** route the delete target through `locations.pluginCloneDir(key)`
(chokepoint above) BEFORE `rm`.

---

### `orchestrators/plugin/uninstall.ts` (MOD — orchestrator, file-I/O)

**Analog:** itself. GC slots in beside the existing POST-state-commit
`rm(pluginDataDir)` cleanup.

**Insertion point (uninstall.ts:596-610):**

```typescript
// POST-state-commit per PU-2 / D-08: drop the per-plugin data dir AFTER the
// state save so an EACCES on rm cannot strand state in installed=true.
const dataDir = await locations.pluginDataDir(marketplace, plugin);
try {
  await rm(dataDir, { recursive: true, force: true });
} catch {
  // Per D-19-01: hygienic cleanup never becomes the primary user-facing path.
}
// NEW (PURL-05): garbageCollectPluginClones(locations) here — same D-19-01
// swallow discipline, AFTER the withLockedStateTransaction commit.
```

`rm` is already imported (uninstall.ts:44). uninstall.ts is NOT in the network
forbidden list and the GC is fs-only, so it stays clean.

---

### `orchestrators/plugin/update.ts` (MOD — orchestrator, request-response + 3-phase swap)

**Analog:** `install.ts` `makeInstallCloneProbe` (below). update OWNS gitOps
(network-gate exempt) so it can build the clone-materializing probe inline or
via the seam import — it does not need the by-name-only discipline reinstall does.

**Two additive edit points:**

1. **Candidate resolve (update.ts:758):** currently `resolveStrict(entry, {
   marketplaceRoot })` with no git callback → git plugins resolve `unavailable`.
   Inject a clone-materializing probe with D-78-05 pin logic: pinned →
   `source.sha`; unpinned → `resolveRemoteRef(HEAD)` at update time. The
   swap-or-not decision falls out of the existing `toVersion === fromVersion`
   short-circuit (update.ts:818) — equal shas → `(unchanged)`.

2. **finalize record (update.ts:1168-1177, all-success arm):** currently writes
   `version`/`compatibility`/`resolvedSource` but NOT `resolvedSha`:

   ```typescript
   if (phase3aFailures.length === 0) {
     sRecord.version = toVersion;
     sRecord.compatibility = { installable: true, notes: [...], supported: [...], unsupported: [...] };
     sRecord.resolvedSource = installable.pluginRoot;
     // NEW (PURL-06 / D-78-05): if (resolvedSha !== undefined) sRecord.resolvedSha = resolvedSha;
   }
   ```

**materialize-before-swap:** `prepareUpdateHandles` (update.ts:837) reads
`installable.pluginRoot` — for a git source that is the NEW clone the probe
materialized during the candidate resolve, so the new tree is on disk before the
swap begins (D-78-05).

**GC-after-swap:** call `garbageCollectPluginClones(locations)` AFTER
`finalizeUpdateRecord`'s `withStateGuard` returns on the all-success arm.

**Vanished-repo update (Claude's Discretion):** the probe's
`resolveRemoteRef`/`materializePluginClone` throw is caught by the existing
phase-2 error arm (update.ts:331-347), surfaces the existing `network
unreachable`/`authentication required` REASONS, plugin stays on recorded sha
(NFR-3). No new token.

---

### `orchestrators/plugin/reinstall.ts` (MOD — orchestrator, CRUD)

**Analog:** `install.ts` — `InstallCloneCacheSeam` bundle + `makeInstallCloneProbe`.
reinstall IS in the forbidden list, so it must reach `materializePluginClone`
BY NAME through a `ReinstallCloneCacheSeam` bundle, never referencing `gitOps`.

**Seam bundle to mirror (install.ts:379-382):**

```typescript
export interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
}
```

Reinstall's variant needs only `materializePluginClone` (NOT `resolvePluginPin`
— see below) plus a pure `canonicalCloneUrl(source)` helper (extract from
`resolvePluginPin`'s url arm, clone-cache.ts:136-137).

**Probe divergence from install (D-78-02 / PURL-07 — the critical difference):**
install's probe calls `resolvePluginPin` which resolves unpinned HEAD via
`resolveRemoteRef` (NETWORK). Reinstall must NOT: the recorded `resolvedSha` IS
the pin, so the probe skips `resolvePluginPin` and calls
`materializePluginClone(url, oldRecord.resolvedSha)` directly. Warm cache →
offline; cold cache → refetch (NFR-5 cache-miss). `resolveRemoteRef` is NEVER
reached → PURL-07 offline holds unconditionally.

**install's probe to adapt (install.ts:457-493):**

```typescript
const probe = async (gitSource) => {
  const { cloneUrl, pin, ref } = await seam.resolvePluginPin({ source: gitSource }); // ← REMOVE for reinstall
  const cloneRoot = await seam.materializePluginClone({ locations, cloneUrl, pin, ...(ref && { ref }) });
  if (gitSource.kind === "git-subdir") {
    const subdirResult = await resolveGitSubdirRoot(cloneRoot, gitSource.path);
    if (subdirResult.kind !== "materialized") return subdirResult;
    return { kind: "materialized", pluginRoot: subdirResult.pluginRoot, resolvedSha: pin };
  }
  return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: pin };
};
```

Reinstall variant: `pin = oldRecord.resolvedSha`, `cloneUrl =
canonicalCloneUrl(gitSource)` (pure, no network), no `resolvePluginPin` call.

**Inject at resolveInstallable (reinstall.ts:1268-1275):** currently passes no
git callback:

```typescript
async function resolveInstallable(entry, marketplaceRoot): Promise<MaterializablePlugin> {
  const resolved = await resolveStrict(entry, { marketplaceRoot });   // ← add resolveGitPluginRoot
  requirePartialInstallable(resolved, "install");
  return resolved;
}
```

**Carry resolvedSha forward (reinstall.ts:1437-1457 — currently DROPS it):**

```typescript
mp.plugins[plugin] = {
  version: oldRecord.version,
  // NEW: ...(oldRecord.resolvedSha !== undefined && { resolvedSha: oldRecord.resolvedSha }),
  resolvedSource: installable.pluginRoot,
  compatibility: { installable: installable.state === "installable", notes: [...], supported: [...], unsupported: [...] },
  resources: resourcesFromHandles(handles, plugin, installable),
  enabled: true,
  installedAt: oldRecord.installedAt,
  updatedAt: new Date().toISOString(),
};
```

**Offline hard test (acceptance criterion):** a mock gitOps whose `clone` AND
`resolveRemoteRef` THROW must still succeed on a warm cache;
`resolveRemoteRefCalls` must be empty. `tests/helpers/git-mock.ts` exposes
`cloneThrows`/`resolveRemoteRefThrows`/`resolveRemoteRefCalls` for this.

---

### `orchestrators/plugin/list.ts` (MOD — orchestrator, request-response read-only)

**Analog:** itself — `installedRowMessage` (304-391) and `availableRowMessage`
(498-576). list.ts is in the forbidden list → the injected probe is
PRESENCE-ONLY (`pathExists(pluginCloneDir(key))`), zero git surface.

**Inject at the two `resolveStrict` sites** (list.ts:382 candidate / list.ts:511
`availableRowMessage`):

```typescript
const resolved = await resolveStrict(manifestEntry, {
  marketplaceRoot,
  resolveGitPluginRoot: makePresenceProbe(locations),   // NEW — fs-only, NEVER clones
});
```

**D-78-04 satisfied by construction:** `installedRowMessage` derives status from
recorded `compatibility.unsupported` + `record.version` + manifest-drift, and
calls `resolveStrict` ONLY when `upgradable`. It never probes the clone dir for
installed status → a missing clone changes nothing. No code needed to "avoid
probing."

**D-78-03 (the load-bearing decision):** an uninstalled git entry must render
`(available)` not `(unavailable)`. The presence probe returning `not-cached`
maps to `unavailable {not installed}` (resolver.ts:676-679). Planner picks:
(a) probe returns `materialized` for uninstalled entries, or (b) short-circuit
git not-installed rows to `(available)` from the manifest without calling the
git arm. Trace the exact `availableRowMessage` flow at planning (Open Q2).

---

### `orchestrators/plugin/info.ts` (MOD — orchestrator, request-response read-only)

**Analog:** `list.ts` availableRowMessage (same presence-probe injection) +
info's own `buildInstalledRow`/`buildNotInstalledRow`. info.ts is in the
forbidden list → identical presence-only, fs-only probe.

**Inject at the two `resolveStrict` sites** (info.ts:906 `buildInstalledRow` /
info.ts:1037 `buildNotInstalledRow`), same shape as list. The
`buildNotInstalledRow` `isLocallyResolvable` gate currently renders non-path
sources `(unavailable)` — the same D-78-03 decision resolves this row too.

## Shared Patterns

### Clone materialization (all of update / reinstall)
**Source:** `clone-cache.ts:53-107` (`materializePluginClone`)
**Apply to:** update probe, reinstall probe
Warm-cache short-circuit (network-free on cache hit), staging→checkout→atomic
same-FS rename, EEXIST/ENOTEMPTY concurrent-race tolerance, MA-9 leak cleanup —
all done. Callers pass `{ locations, cloneUrl, pin, ref? }`.

### Canonical url + pin resolution (update only; reinstall reuses url arm ONLY)
**Source:** `clone-cache.ts:129-149` (`resolvePluginPin`)
**Apply to:** update's unpinned re-resolve (D-78-05). Reinstall must NOT call
this (it hits `resolveRemoteRef` for unpinned entries — network). Extract a pure
`canonicalCloneUrl(source)` from lines 136-137 (`github →
https://github.com/<o>/<r>`, else `source.url`) for reinstall to reuse.

### Post-commit cleanup swallow (uninstall GC, update GC, GC helper itself)
**Source:** `uninstall.ts:606-610` (D-19-01)
**Apply to:** every GC call site. `rm(dir, { recursive: true, force: true })`
in a `try/catch {}` — a cleanup leak must never fail the user-visible operation.

### Containment chokepoint (GC delete, all clone targets)
**Source:** `locations.ts:247-257` (`pluginCloneDir(key)`)
**Apply to:** GC delete target, update/reinstall clone target. `assertSafeName`
+ `assertPathInside` before any `rm`/create (NFR-10).

### Seam-by-name injection into a forbidden orchestrator
**Source:** `install.ts:379-382` (`InstallCloneCacheSeam`) + install.ts:457-493
**Apply to:** reinstall (`ReinstallCloneCacheSeam`). Import
`materializePluginClone` by name via the bundle; never reference `gitOps`,
`DEFAULT_GIT_OPS`, or `platform/git` (token-grep gate,
`tests/architecture/no-orchestrator-network.test.ts`).

### Version-arrow render — D-78-06 ALREADY SATISFIED (no code)
**Source:** `shared/notify.ts` `composeVersionArrow` → `renderVersion` →
`formatShaVersionForDisplay`
Already renders `sha-<12hex>` pairs as `v#<7hex> → v#<7hex>`. Add ZERO render
code; verify with a catalog fixture only.

## No Analog Found

None. Every file this phase touches either exists (5 modifications) or has a
tight sibling analog (`clone-gc.ts` ← `clone-cache.ts` + `uninstall.ts` rm
template). No file falls back to RESEARCH.md-only patterns.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/`,
`domain/`, `persistence/`, `shared/`
**Files scanned:** install.ts, clone-cache.ts, uninstall.ts, reinstall.ts,
update.ts, resolver.ts, locations.ts, state-io.ts
**Pattern extraction date:** 2026-07-11
**Comment-policy note (.claude/rules/typescript-comments.md):** tag new code with
decision/requirement IDs (`D-78-01`, `PURL-05`, `NFR-5`, `SC-7`); NEVER
`Phase 78`/`Plan`/`Wave`/`Pitfall N`. Domain-word `phase` (3-phase swap ledger)
is exempt.

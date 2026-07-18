# Phase 78: Plugin git-source lifecycle - Research

**Researched:** 2026-07-11
**Domain:** Reuse of the Phase 77 clone-cache seam across four existing plugin lifecycle orchestrators (update / uninstall / reinstall / list+info) — orchestrator wiring + one new derive-not-persist GC helper, all in-tree TypeScript against the already-pinned `isomorphic-git@1.38.5`. No new external deps.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Clone GC mechanism (PURL-05 / PURL-06)**
- **D-78-01:** GC derives references at GC time by scanning the scope's state.json plugin records: any record whose url+resolvedSha maps to a clone key still references that clone. NO persisted refcount/index artifact (derive-not-persist — same philosophy as the force-install derive-not-sticky decision). GC runs after the state mutation commits; a crash between state write and clone delete just leaves an orphan clone that the next GC pass removes (idempotent, NFR-3 fail-clean).

**Reinstall pin source (PURL-07)**
- **D-78-02:** Reinstall re-materializes a git-source plugin from the state record's `resolvedSha` — NOT the manifest's current sha. Warm cache by construction, so the PURL-07 no-network guarantee holds unconditionally; matches reinstall's existing identity (targets the already-installed plugin, preserves version/installedAt). Manifest sha drift is update's business exclusively.

**List/info status (PURL-08)**
- **D-78-03:** list/info inject the cache-presence-only probe (the non-materializing `resolveGitPluginRoot` arm designed in Phase 77) so an UNINSTALLED git-source plugin classifies and renders exactly like an uninstalled path plugin. No "needs network" or "cached" marker — network is install's concern. Zero new REASONS/status tokens.
- **D-78-04:** An INSTALLED git plugin whose cache clone is missing from disk shows NO status change. The clone cache is an implementation detail; installed components keep working from staged resources. A later reinstall on a cold cache simply refetches (network). No per-row clone-dir probing during list; list stays fast and network-free (NFR-5).

**Update semantics (PURL-06)**
- **D-78-05:** Pinned entries (manifest carries sha) swap only when the manifest sha differs from the recorded resolvedSha. UNPINNED entries re-resolve remote HEAD at update time (the refresh-time half of D-77-05) and swap when the resolved sha differs from the recorded one. Same 3-phase atomic swap machinery as path-source updates; the new clone materializes into the cache BEFORE the swap; the old clone is GC'd after the swap iff unreferenced (D-78-01).
- **D-78-06:** Version change renders with the existing update version-arrow renderer using the compact forms: `v#<7hex> → v#<7hex>`. No new render grammar.

### Claude's Discretion
- Swap staging mechanics and ordering inside withStateGuard (follow the existing 3-phase swap in update.ts).
- GC placement in the guard sequence (after state commit; exact hook point at planning discretion).
- Presence-probe wiring shape for list/info call sites.
- Failure classification for update-time network errors (reuse `authentication required` / `network unreachable` REASONS from prior phases; no new tokens expected — if one proves necessary, follow the closed-set amendment process).
- Update of a plugin whose upstream repo vanished (expected: existing failure classification path, plugin stays on recorded sha — fail-clean per NFR-3).

### Deferred Ideas (OUT OF SCOPE)
- Private-host auth for update-time fetches — Phase 79 (provider registry wires into the same clone-cache seam).
- Any `(cache missing)` / `(cached)` list markers — rejected for now (D-78-03/04); revisit only if real-world confusion shows up post-ship.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PURL-05 | `uninstall` garbage-collects a cached clone when its last referencing plugin is removed | GC helper runs POST-state-commit in uninstall.ts, at the exact spot the existing `rm(pluginDataDir)` cleanup runs (uninstall.ts:596–610). Derives live clone keys from the surviving state records (D-78-01), deletes any `plugin-clones/<key>/` dir not in the live set, swallows leaks (D-19-01). uninstall.ts is NOT in the network gate's forbidden list AND the GC is fs-only (no gitOps), so it stays clean. |
| PURL-06 | `update` detects sha changes, fetches the new clone, swaps atomically, and GCs the old clone when unreferenced | update.ts already imports `gitOps` (network-gate exempt). Inject a clone-materializing `resolveGitPluginRoot` into the candidate `resolveStrict` at update.ts:758 (currently passes no git callback → git plugins resolve `unavailable`). Pin re-resolution per D-78-05 (pinned: manifest sha; unpinned: `resolveRemoteRef` HEAD). New clone materializes BEFORE the 3-phase swap (`prepareUpdateHandles` reads `installable.pluginRoot`); `resolvedSha` recorded in `finalizeUpdateRecord` (update.ts:1168–1177); GC-after-swap once the finalize `withStateGuard` commits. |
| PURL-07 | `reinstall` of a cached git-source plugin completes without network | reinstall.ts `resolveInstallable` (reinstall.ts:1268–1275) currently passes no git callback → git plugins resolve `unavailable`. Inject a RECORDED-SHA probe: materialize directly from `oldRecord.resolvedSha` (D-78-02), bypassing `resolvePluginPin` entirely so NO `resolveRemoteRef`/network fires. Warm cache short-circuits; cold cache re-clones (still allowed on cache-miss per NFR-5 amended). reinstall.ts IS in the forbidden list → must call the seam BY NAME via an injection bundle (mirror install.ts's `InstallCloneCacheSeam`), never naming `gitOps`. Also carry `oldRecord.resolvedSha` forward in `updateStateRecord` (reinstall.ts:1437 — currently drops it). |
| PURL-08 | `list` / `info` show git-source plugins with correct status and never clone | Inject the cache-presence-only probe (the `not-cached` / `materialized`-from-recorded-sha arm) into the four `resolveStrict` sites: list.ts:382 (candidate), list.ts:511 (`availableRowMessage`), info.ts:906 (`buildInstalledRow`), info.ts:1037 (`buildNotInstalledRow`). Probe does presence-only `pathExists(pluginCloneDir(key))`, NEVER clones (D-78-03). list.ts + info.ts are in the forbidden list → the probe must NOT import gitOps; a pure presence probe needs only `fs`/`locations` (no git surface). Installed-row status reads recorded `compatibility`/`version` and does not probe the clone dir (D-78-04 satisfied by construction). |
</phase_requirements>

## Summary

Phase 78 is almost entirely **wiring an already-built seam into four existing orchestrators**. Phase 77 shipped the load-bearing primitives: `materializePluginClone` (staging→checkout→atomic-rename with warm-cache short-circuit + EEXIST-tolerance), `resolvePluginPin` (canonical-url + sha-over-ref + unpinned-HEAD resolution), `resolveRemoteRef` (the `GitOps` primitive), the `resolveGitPluginRoot` injection seam on `ResolveContext` with its `GitPluginRootResult` discriminated union (`materialized | not-cached | escapes | missing-subdir`), the `pluginCloneKey`/`pluginCloneDir` chokepoints, the additive `resolvedSha` state field, and the `sha-<12hex>` version + its `renderVersion` display arm. Phase 78 adds NO new domain primitives — it adds one GC helper and injects the right probe at each call site.

**The central tension is the same network-gate constraint from Phase 77, now applied to three more surfaces.** The `no-orchestrator-network` gate (tests/architecture/no-orchestrator-network.test.ts) forbids `install.ts`, `list.ts`, `reinstall.ts`, `plugin/info.ts`, and `marketplace/info.ts` from carrying any `gitOps` surface; `update.ts` is exempt (it already imports gitOps for marketplace sync); `uninstall.ts` is implicitly clean. This dictates: (a) **update** injects a clone-materializing probe freely (already has gitOps); (b) **reinstall** must inject a probe that reaches the git surface only through the `clone-cache.ts` seam BY NAME (mirror install.ts's `InstallCloneCacheSeam` bundle) and never names `gitOps`; (c) **list/info** inject a PRESENCE-ONLY probe that touches only `fs`+`locations` (no git surface at all — a cache-miss returns `not-cached`, never clones); (d) **uninstall** GC is fs-only (`readdir` + `rm`), no git surface.

**Primary recommendation:** (1) Add one `garbageCollectPluginClones(locations)` helper (fs-only: enumerate `plugin-clones/`, derive live keys from surviving state records, `rm -rf` the difference, swallow leaks) — place it as a `clone-cache.ts` sibling or a new `clone-gc.ts` so uninstall imports it without touching git. Derive live keys from each git plugin record's `resolvedSource` path segment (the `<key>` is embedded in the clone path) — simpler and more truthful than recomputing `pluginCloneKey(url, sha)` from the manifest. (2) In **update**, inject the install-style clone-materializing probe (update owns gitOps) with D-78-05 pin re-resolution; call GC after the finalize commit. (3) In **reinstall**, inject a RECORDED-SHA probe (materialize from `oldRecord.resolvedSha`, no pin re-resolution, no network) via an injection bundle, and carry `resolvedSha` forward in the state record. (4) In **list/info**, inject the presence-only probe so uninstalled git plugins render `(available)` not `(unavailable)`. (5) D-78-06 is **already satisfied** — `composeVersionArrow`→`renderVersion`→`formatShaVersionForDisplay` already renders `sha-<12hex>` pairs as `v#<7hex> → v#<7hex>`; verify with a catalog fixture, add no render code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Derive live clone keys + delete unreferenced dirs (GC) | NEW helper (`clone-gc.ts` or `clone-cache.ts` sibling), fs-only | `persistence/locations.ts` (`pluginClonesDir`, `pluginCloneDir`), `persistence/state-io.ts` (read records) | GC reads state + deletes cache dirs — pure fs. Placing it OUTSIDE uninstall.ts is not required by the gate (uninstall is git-clean) but keeps the derive-live-keys logic testable and reusable by update's post-swap GC. |
| update: pin re-resolution + materialize-before-swap | `orchestrators/plugin/update.ts` (gitOps-exempt) | `clone-cache.ts` (`resolvePluginPin` / `materializePluginClone`), `resolveRemoteRef` | update already imports gitOps (Pattern S-9); the git-source refresh arm slots into the existing `syncCloneOnce` + candidate-resolve flow. |
| reinstall: offline materialize from recorded sha | `orchestrators/plugin/reinstall.ts` (forbidden gitOps) | injection bundle → `clone-cache.ts` seam BY NAME | reinstall is in the forbidden list; it must reach the seam by name (mirror `InstallCloneCacheSeam`), never `gitOps`. The recorded-sha probe skips `resolvePluginPin` so no `resolveRemoteRef` network call fires (D-78-02 unconditional offline). |
| list/info: presence-only classification | `list.ts` / `plugin/info.ts` (forbidden gitOps) | `persistence/locations.ts` (`pluginCloneDir` + `pathExists`) | Presence probe is pure fs — no git surface, satisfies the gate and D-78-03 (never clones). |
| Installed-row status stability on missing clone | `list.ts` `installedRowMessage` / `plugin-state-classifier.ts` | recorded `compatibility` + `version` | Installed-row status derives from the persisted record, not a live clone probe → D-78-04 holds by construction (no code needed to "not probe"). |
| Version-arrow render (`v#<7hex> → v#<7hex>`) | `shared/notify.ts` (`composeVersionArrow`) | — | ALREADY handles sha-versions via `renderVersion`→`formatShaVersionForDisplay`. No change (D-78-06). |

## Standard Stack

No new libraries. Entirely in-tree TypeScript against the already-pinned stack (identical to Phase 77).

### Core (already installed — carry forward unchanged)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `isomorphic-git` | `1.38.5` | `clone`/`checkout`/`resolveRemoteRef` for update's materialize-before-swap and reinstall's cold-cache refetch | All wrappers shipped in Phase 77 (`platform/git.ts` + `GitOps`); Phase 78 consumes them via `clone-cache.ts`, adds no new git primitive. [VERIFIED: 77-03-SUMMARY.md — resolveRemoteRef/materializePluginClone/resolvePluginPin shipped and tested] |
| `node:fs/promises` | bundled (Node ≥20.19) | `readdir(pluginClonesDir)` to enumerate cache dirs + `rm(dir, {recursive, force})` to delete unreferenced clones (GC) | uninstall.ts already imports `rm` and does POST-state-commit `rm(pluginDataDir, {recursive, force})` with silent-leak-swallow (uninstall.ts:44,607) — the exact template for the GC delete. [VERIFIED: read uninstall.ts:596–610] |
| `node:crypto` | bundled | `pluginCloneKey` (already shipped in `domain/clone-key.ts`) if GC recomputes keys from url+sha | Only needed if the planner chooses key-recompute over resolvedSource-path-extraction (see Open Q1). [VERIFIED: read domain/clone-key.ts] |
| `typebox` | `^1.1.38` (peer) | `resolvedSha` state field (already additive-optional on the record schema) | No schema change this phase — reinstall/update just READ + carry-forward the field shipped in Phase 77. [VERIFIED: read state-io.ts:54–80] |

**Installation:** None. `npm install` unchanged.

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. The sole dependency touched (`isomorphic-git@1.38.5`) is an already-committed, in-use direct dependency wrapped by Phase 77's `platform/git.ts`. No audit table required.

## Architecture Patterns

### System Data Flow (the four lifecycle operations)

```
UPDATE  (update.ts — gitOps-exempt)
  updatePlugins → syncCloneOnce(mp) [marketplace refresh, D-14; unchanged]
      │
      ▼  per plugin: derivePluginPreflight (update.ts:~695)
  resolveStrict(entry, {                         ← currently NO git callback (line 758)
      marketplaceRoot,
      resolveGitPluginRoot: updateCloneProbe     ← NEW inject (clone-materializing)
  })
      │  updateCloneProbe (git kind):
      │    pin = D-78-05:  source.sha (pinned) OR resolveRemoteRef(HEAD) (unpinned)
      │    if pin === record.resolvedSha → NO swap (unchanged short-circuit at toVersion===fromVersion)
      │    else materializePluginClone(url, pin) INTO cache  ← network only on cache-miss
      │    returns { materialized, pluginRoot=cloneRoot, resolvedSha=pin }
      ▼
  prepareUpdateHandles reads installable.pluginRoot (NEW clone)   [3-phase swap, unchanged]
      ▼  phase-3a per-bridge commits → finalizeUpdateRecord (withStateGuard)
  sRecord.version = shaVersion(pin);  sRecord.resolvedSha = pin  ← NEW (carry sha)
  sRecord.resolvedSource = installable.pluginRoot
      ▼  AFTER finalize commit:
  garbageCollectPluginClones(locations)   ← NEW: old clone GC'd iff now-unreferenced (D-78-01)

UNINSTALL  (uninstall.ts — git-clean, NOT in forbidden list)
  withLockedStateTransaction → delete mp.plugins[plugin]; tx.save()   [unchanged]
      ▼  POST-state-commit (uninstall.ts:596, beside the existing rm(pluginDataDir)):
  garbageCollectPluginClones(locations)   ← NEW: last referencer gone → clone deleted (PURL-05)

REINSTALL  (reinstall.ts — forbidden gitOps)
  read oldRecord (has resolvedSha, version, installedAt)
  resolveInstallable(entry, marketplaceRoot, {
      resolveGitPluginRoot: reinstallRecordedShaProbe   ← NEW inject via seam-BY-NAME bundle
  })
      │  reinstallRecordedShaProbe (git kind):
      │    pin = oldRecord.resolvedSha        ← D-78-02: recorded sha, NOT manifest, NO resolvePluginPin
      │    materializePluginClone(url, pin)   ← warm cache: offline; cold: refetch (NFR-5 cache-miss)
      │    NO resolveRemoteRef ever called → PURL-07 offline holds unconditionally
      ▼  3-phase re-materialize [unchanged], then updateStateRecord:
  version = oldRecord.version; resolvedSha = oldRecord.resolvedSha  ← NEW carry-forward (line 1437)

LIST / INFO  (list.ts + plugin/info.ts — forbidden gitOps)
  resolveStrict(entry, {
      marketplaceRoot,
      resolveGitPluginRoot: presenceProbe    ← NEW inject (fs-only, NEVER clones)
  })
      │  presenceProbe (git kind):
      │    key from recorded resolvedSha (installed) OR skip (uninstalled → not-cached)
      │    pathExists(pluginCloneDir(key)) ? materialized : not-cached
      ▼  uninstalled git plugin renders (available) like a path plugin (D-78-03)
      ▼  installed-row status reads recorded compatibility/version, no clone probe (D-78-04)
```

### Pattern 1: GC derives live keys from surviving state records (D-78-01, derive-not-persist)

**What:** After a state mutation commits (uninstall delete, or update swap), enumerate the on-disk `plugin-clones/<key>/` dirs and delete every one NOT referenced by a surviving git-source plugin record. No refcount file — the live set is DERIVED at GC time from state.

**Deriving the live key set — TWO options (planner picks; recommend A):**

- **Option A (recommended): extract the key from `resolvedSource`.** For a git-source plugin, install/update write `resolvedSource = installable.pluginRoot = <pluginClonesDir>/<key>` (url source / github) or `<pluginClonesDir>/<key>/<subdir>` (git-subdir). The `<key>` is the path segment immediately under `pluginClonesDir`. GC computes it with `path.relative(locations.pluginClonesDir, resolvedSource).split(path.sep)[0]`. This is network-free, needs no manifest read, and reuses the EXACT string that named the clone dir (no recompute drift). [VERIFIED: clone-cache.ts:62 cloneRoot=pluginCloneDir(key); install.ts writes resolvedSource=installable.pluginRoot; reinstall.ts:1441 / update.ts:1176 same]
- **Option B: recompute `pluginCloneKey(canonicalUrl, resolvedSha)`.** Requires the plugin's url (from the marketplace manifest, a cache read) + the recorded `resolvedSha`. More moving parts and a manifest dependency; use only if `resolvedSource` proves unreliable (e.g. a legacy record).

```typescript
// NEW: clone-gc.ts (fs-only; uninstall imports it without touching git)
export async function garbageCollectPluginClones(locations: ScopedLocations): Promise<string[]> {
  const state = await loadState(locations.extensionRoot);
  const liveKeys = new Set<string>();
  for (const mp of Object.values(state.marketplaces)) {
    for (const rec of Object.values(mp.plugins)) {
      // Git-source plugins carry resolvedSha; derive the clone key from the
      // resolvedSource path segment (Option A). Path/github-name plugins have
      // no clone and contribute no key.
      if (rec.resolvedSha === undefined) continue;
      const rel = path.relative(locations.pluginClonesDir, rec.resolvedSource);
      const seg = rel.split(path.sep)[0];
      if (seg !== undefined && seg !== "" && !seg.startsWith("..")) liveKeys.add(seg);
    }
  }
  const leaks: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(locations.pluginClonesDir);
  } catch (err) {
    // ENOENT: no cache dir yet → nothing to GC (idempotent no-op).
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;   // other errno: surface (caller swallows per D-19-01)
  }
  for (const key of entries) {
    if (liveKeys.has(key)) continue;
    try {
      const dir = await locations.pluginCloneDir(key);   // SC-7 chokepoint (containment)
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      leaks.push(`${key}: ${errorMessage(err)}`);   // D-19-01: swallow at the call site
    }
  }
  return leaks;   // caller ignores (hygienic cleanup never becomes the primary path)
}
```

**Idempotency (NFR-3):** running GC twice is safe — the second pass finds the already-deleted dirs absent. A crash between `tx.save()` and the GC leaves an orphan clone that the NEXT GC pass (any uninstall/update) removes. This is exactly the force-install derive-not-sticky philosophy applied to disk.

**Placement (Claude's Discretion per CONTEXT):** run GC AFTER the state mutation commits. In uninstall, the natural home is beside the existing `rm(pluginDataDir)` (uninstall.ts:596–610), inside the same D-19-01 swallow discipline. In update, after `finalizeUpdateRecord`'s `withStateGuard` returns on the all-success arm.

### Pattern 2: reinstall's recorded-sha probe is offline BY CONSTRUCTION (D-78-02 / PURL-07)

**What:** install's probe calls `resolvePluginPin` (which resolves unpinned HEAD via `resolveRemoteRef` — a NETWORK call). reinstall must NOT do that: the recorded `resolvedSha` IS the pin, so the probe skips `resolvePluginPin` entirely and calls `materializePluginClone(url, oldRecord.resolvedSha)` directly. On a warm cache this short-circuits with zero git calls; on a cold cache it re-clones (allowed on cache-miss, NFR-5 amended). `resolveRemoteRef` is NEVER reached, so PURL-07's offline guarantee holds unconditionally even for an entry that was originally unpinned.

```typescript
// reinstall.ts — recorded-sha probe (mirror install's makeInstallCloneProbe,
// but pin = oldRecord.resolvedSha; NO resolvePluginPin call).
function makeReinstallCloneProbe(seam: ReinstallCloneCacheSeam, locations, recordedSha, cloneUrl) {
  const probe = async (gitSource) => {
    const cloneRoot = await seam.materializePluginClone({
      locations, cloneUrl, pin: recordedSha,   // D-78-02: recorded sha, no HEAD re-resolve
    });
    if (gitSource.kind === "git-subdir") { /* containment against cloneRoot, same as install */ }
    return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: recordedSha };
  };
  return { probe };
}
```

**cloneUrl reconstruction:** reinstall needs the canonical url to pass to `materializePluginClone`. It can get it from `resolvePluginPin`'s url arm WITHOUT the pin-resolution (that arm is pure — `github → https://github.com/<o>/<r>`, else `source.url`), or reconstruct inline. Do NOT call the full `resolvePluginPin` (it also resolves the pin, hitting network for unpinned). **Recommend:** extract a tiny `canonicalCloneUrl(source)` pure helper from `resolvePluginPin`'s url arm so reinstall reuses it without the pin-resolution. [VERIFIED: clone-cache.ts:136-137 — cloneUrl is a pure expression]

**Gate compliance:** reinstall.ts is in the forbidden list. It must import `materializePluginClone` BY NAME through a `ReinstallCloneCacheSeam` injection bundle (exactly like install's `InstallCloneCacheSeam`), never referencing `gitOps`. [VERIFIED: install.ts:379-381 InstallCloneCacheSeam shape; no-orchestrator-network.test.ts:59 reinstall.ts forbidden]

### Pattern 3: list/info presence probe is fs-only and NEVER clones (D-78-03 / PURL-08)

**What:** The Phase 77 `GitPluginRootResult` union already has the two arms this needs: `materialized` (clone present) and `not-cached` (absent, render "not installed"). The list/info probe does presence-only `pathExists(pluginCloneDir(key))`:
- **Installed git plugin:** key derived from the recorded `resolvedSha` (+ canonical url) → `pathExists` true → `materialized` (or, if the clone was evicted, `not-cached` — but per D-78-04 the INSTALLED row status doesn't consult this probe anyway; see below).
- **Uninstalled git plugin (the D-78-03 case):** the `availableRowMessage`/`buildNotInstalledRow` path has NO recorded sha. The probe must return a status that renders `(available)`, NOT `(unavailable)`. Since there is no recorded sha and no clone, the truthful arm is `not-cached` — but the CURRENT resolver maps `not-cached → unavailable {not installed}` (resolver.ts:676-680). **This is the load-bearing planner decision (see Open Q2):** for the not-installed list/info surface, an uninstalled git plugin must render like an uninstalled PATH plugin, i.e. `(available)`. Options: (a) the presence probe returns `materialized` with a sentinel pluginRoot for uninstalled git entries so the resolver classifies `installable` (matches how a path plugin's not-yet-installed manifest entry resolves `installable`); or (b) list/info short-circuit git-source not-installed entries to `(available)` from the manifest WITHOUT calling the resolver's git arm (cleanest — a not-installed git entry has nothing on disk to validate, exactly like a path entry pointing at an existing marketplace clone). Resolve during planning against the exact `availableRowMessage` flow.

**D-78-04 (installed row, missing clone → no status change) is satisfied by construction:** `installedRowMessage` (list.ts:304) derives status from the recorded `compatibility.unsupported` + `record.version` + manifest-version-drift (`upgradable`). It calls `resolveStrict` ONLY when `upgradable` (list.ts:380). It never probes the clone dir for the installed status. So a missing clone changes nothing on an installed row — **no code needed to "avoid probing"; the existing flow already doesn't.** [VERIFIED: read list.ts:304–391]

**Gate compliance:** the presence probe imports only `fs`/`locations` + `pathExists` (shared/fs-utils.ts) — zero git surface. list.ts, plugin/info.ts, marketplace/info.ts stay clean. [VERIFIED: no-orchestrator-network.test.ts:57-61]

### Pattern 4: update's git-source refresh arm slots into the existing candidate resolve + 3-phase swap

**What:** update.ts already runs the full 3-phase atomic swap for path/github plugins. The git-source arm is purely additive at TWO points:

1. **Candidate resolve (update.ts:758):** currently `resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot })` — no git callback → a git plugin resolves `unavailable`. Inject a clone-materializing `resolveGitPluginRoot` with D-78-05 pin logic. update OWNS gitOps, so (unlike install/reinstall) it can build the probe inline or via the same seam import. The pin: `source.sha` (pinned) else `resolveRemoteRef(HEAD)` (unpinned re-resolve at update time). The swap-or-not decision falls OUT of the existing `toVersion === fromVersion` short-circuit (update.ts:818): `toVersion = shaVersion(pin)`, `fromVersion = record.version`; equal shas → `(unchanged)`, differing → swap. [VERIFIED: update.ts:816–828]

2. **finalize record (update.ts:1168):** on the all-success arm, additionally set `sRecord.resolvedSha = pin` (the captured side-channel sha, same mechanism as install). Currently finalize writes `version`/`compatibility`/`resolvedSource` but NOT `resolvedSha` — add it for git sources. [VERIFIED: update.ts:1168-1177]

**materialize-before-swap:** `prepareUpdateHandles` (update.ts:837) reads `installable.pluginRoot` for every bridge stage. For a git source that pluginRoot is the NEWLY materialized clone (the probe cloned it during the candidate resolve). So the new tree is on disk BEFORE the swap begins — exactly D-78-05's "new clone materializes into the cache BEFORE the swap." The old clone stays until GC. [VERIFIED: update.ts:844–886]

**GC-after-swap:** after `finalizeUpdateRecord` commits the new `resolvedSha`, the OLD clone's key is no longer in any live record (assuming no other plugin references it) → `garbageCollectPluginClones` removes it. If another installed plugin still references the old url+sha, its record keeps that key live and GC leaves it (PURL-06 / D-78-01). [VERIFIED: D-78-01 derive-at-GC-time semantics]

### Anti-Patterns to Avoid
- **Calling `resolvePluginPin` in reinstall.** That re-resolves unpinned HEAD via `resolveRemoteRef` (network), breaking PURL-07's unconditional offline guarantee. reinstall pins from `oldRecord.resolvedSha` (D-78-02) and calls `materializePluginClone` directly.
- **Cloning in the list/info probe.** list.ts/info.ts are in the forbidden list AND NFR-5 forbids list-time network. The presence probe is `pathExists` only; a miss returns `not-cached`, never a clone.
- **Naming `gitOps`/`DEFAULT_GIT_OPS`/`platform/git` in reinstall.ts, list.ts, or info.ts.** The token-grep gate fails the build. reinstall reaches the seam by name via an injection bundle; list/info touch no git surface at all.
- **Persisting a refcount/GC index.** D-78-01 is derive-not-persist. A persisted refcount can desync from reality; deriving from state records at GC time cannot.
- **Recomputing the GC key from the manifest url when `resolvedSource` already embeds it.** Option A (path-segment extraction) is network-free and drift-free; only fall back to url+sha recompute if a record's `resolvedSource` is not under `pluginClonesDir` (a legacy/path record — which has no `resolvedSha` anyway and is skipped).
- **Adding a new render grammar for the sha version arrow.** `composeVersionArrow` already renders `sha-<12hex>` pairs as `v#<7hex> → v#<7hex>` via `renderVersion`. Verify with a catalog fixture; write no render code (D-78-06).
- **Probing the clone dir to decide an INSTALLED row's status.** D-78-04: installed status derives from the recorded `compatibility`/`version`. A missing clone is invisible on the list surface.
- **Deleting a clone another scope references.** Not a concern — the cache is per-scope (`<scopeRoot>/pi-claude-marketplace/plugin-clones/`), so a scope's GC only ever sees its own clones and its own records (D-10 per-scope independence). No cross-scope check needed. [VERIFIED: locations.ts:170 pluginClonesDir under extensionRoot per scope]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delete a clone dir tree | A custom recursive unlink | `rm(dir, { recursive: true, force: true })` (uninstall.ts:607 template) | Node built-in; `force` swallows ENOENT (idempotent). The exact call uninstall already uses for `pluginDataDir`. |
| Swallow cleanup leaks after a successful state commit | Bespoke try/catch messaging | The D-19-01 discipline already in uninstall.ts:596–610 (silent swallow, hygienic cleanup never becomes the primary path) | GC is post-commit hygiene — a leak must not fail the user-visible uninstall/update. |
| Materialize/refetch a clone at a pin | A new clone routine | `materializePluginClone` (clone-cache.ts, shipped Phase 77) | Warm-cache short-circuit, EEXIST-tolerant rename, MA-9 cleanup all done. Update + reinstall + install share it. |
| Resolve unpinned HEAD at update time | `git ls-remote` subprocess | `resolveRemoteRef` (GitOps primitive, shipped Phase 77) | Protocol-v2 refs listing, no full clone; D-13-clean. update only. |
| Canonical clone url from a source | Inline url munging at each call | Extract `canonicalCloneUrl(source)` from `resolvePluginPin`'s url arm (clone-cache.ts:136-137) | reinstall needs the url without the pin-resolution; a pure helper keeps url reconstruction single-sourced (github → https://github.com/<o>/<r>). |
| sha-version display / arrow | A new formatter | `renderVersion` / `composeVersionArrow` (notify.ts, shipped Phase 77) | Already renders `v#<7hex> → v#<7hex>` for sha pairs. D-78-06 needs zero render code. |
| Clone-cache path composition | `path.join(pluginClonesDir, key)` at GC/probe sites | `locations.pluginCloneDir(key)` (SC-7 chokepoint) | NFR-10 containment is enforced ONLY through the branded chokepoint (`assertSafeName` + `assertPathInside`). |
| Injected clone seam into a forbidden orchestrator | Importing `gitOps` into reinstall | A `ReinstallCloneCacheSeam` bundle (mirror `InstallCloneCacheSeam`, install.ts:379) | Keeps the git surface out of reinstall.ts source (token-grep gate) while allowing test injection of a mock gitOps-backed seam. |

**Key insight:** Phase 78 writes almost no new logic. Every hard problem (atomic clone, warm-cache dedup, EEXIST race, unpinned HEAD resolution, sha-version render, path containment) was solved in Phase 77. The phase is (1) one fs-only GC helper, (2) four probe injections at existing `resolveStrict` call sites, (3) two record-field carry-forwards (`resolvedSha` in update-finalize and reinstall-updateStateRecord). The 3-phase swap, the uninstall transaction, and the list/info row builders are all UNCHANGED in structure.

## Runtime State Inventory

> This is a lifecycle-wiring phase, not a rename/refactor. It adds NO state schema field (the `resolvedSha` field shipped in Phase 77). It DELETES on-disk clone dirs (GC) and re-materializes them (update/reinstall). The inventory below covers what runtime state the phase touches.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` plugin records: reinstall must CARRY FORWARD the existing `resolvedSha` (reinstall.ts:1437 `updateStateRecord` currently drops it — a bug this phase must fix); update-finalize must WRITE the new `resolvedSha` on a git-source swap (update.ts:1168 currently omits it). The `<extensionRoot>/plugin-clones/<key>/` cache dirs are DELETED by GC when unreferenced and RE-CREATED by update/reinstall materialize. No schema change. | Code edit: carry `oldRecord.resolvedSha` in reinstall's record write; add `sRecord.resolvedSha = pin` in update-finalize; GC helper deletes unreferenced clone dirs. No data migration (existing records already carry the field from Phase 77 installs). |
| Live service config | None — no external service holds this state. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — public-only (D-77-06 carried forward; private-host auth is Phase 79). No credentials stored or read. | None. |
| Build artifacts | None. | None. |

**Nothing found in categories 2–5:** verified — the phase writes only to `state.json` (via the existing withStateGuard/withLockedStateTransaction seams) and deletes/creates `plugin-clones/<key>/` cache dirs, both under `extensionRoot` per scope (NFR-10 containment via `pluginCloneDir` chokepoint).

## Common Pitfalls

### Pitfall 1: reinstall silently re-resolves HEAD and breaks offline (PURL-07)
**What goes wrong:** reinstall reuses install's `makeInstallCloneProbe` (which calls `resolvePluginPin`). For an entry that was originally unpinned, `resolvePluginPin` calls `resolveRemoteRef(HEAD)` — a network call — so a warm-cache reinstall fails offline, violating PURL-07.
**Why it happens:** the install probe's pin logic is "resolve the pin from the source"; reinstall's pin logic is "the pin IS the recorded sha."
**How to avoid:** reinstall builds its OWN probe (`makeReinstallCloneProbe`) that sets `pin = oldRecord.resolvedSha` and calls `materializePluginClone` directly, never `resolvePluginPin`/`resolveRemoteRef` (Pattern 2, D-78-02).
**Warning signs:** the PURL-07 hard test (a mock gitOps whose `resolveRemoteRef`/`clone` THROW, with a warm cache) fails; or `resolveRemoteRefCalls` is non-empty on a reinstall. The git-mock already exposes `resolveRemoteRefThrows` + `cloneThrows` + `resolveRemoteRefCalls` for exactly this assertion. [VERIFIED: tests/helpers/git-mock.ts:78-104]

### Pitfall 2: GC deletes a clone still referenced by another plugin (PURL-05 partial)
**What goes wrong:** two plugins reference the same url+sha (one shared clone, PURL-04 dedup). Uninstalling ONE deletes the shared clone, breaking the other plugin's future reinstall/enable from the warm cache.
**Why it happens:** naive GC deletes "the uninstalled plugin's clone" instead of "clones no surviving record references."
**How to avoid:** GC derives the live key set from ALL surviving records FIRST, then deletes only the difference (D-78-01). The uninstalled plugin's key stays live iff another record still maps to it. Success criterion 2 tests exactly this: uninstall one of two sharers → clone intact; uninstall the last → clone gone.
**Warning signs:** a two-plugin-one-clone test where the first uninstall deletes the shared dir.

### Pitfall 3: the presence probe classifies an uninstalled git plugin as `(unavailable)` (PURL-08 / D-78-03)
**What goes wrong:** injecting the presence probe naively returns `not-cached` for an uninstalled git plugin, and the resolver maps `not-cached → unavailable {not installed}` (resolver.ts:676) — so `list`/`info` render `(unavailable)` for a perfectly-installable git plugin that simply hasn't been installed yet. A path plugin in the same state renders `(available)`.
**Why it happens:** `not-cached` was designed (Phase 77) for an info probe of an installed-but-evicted plugin, not for the not-installed manifest-entry surface.
**How to avoid:** for the NOT-INSTALLED list/info surface, an uninstalled git entry must render `(available)` like a path entry. Either the probe returns `materialized` for uninstalled git entries (so the resolver classifies `installable`), or list/info render git-source not-installed entries `(available)` from the manifest without invoking the resolver's git arm (Pattern 3 / Open Q2). This is the single load-bearing planner decision.
**Warning signs:** `list @<mp>` shows a never-installed git plugin as `(unavailable)` instead of `(available)`; a catalog-uat byte-diff against the path-plugin available row.

### Pitfall 4: update-finalize forgets `resolvedSha`, so the NEXT update/GC misbehaves
**What goes wrong:** update swaps a git plugin to a new sha but finalize writes only `version`/`resolvedSource`, not `resolvedSha`. The record's `resolvedSha` now points at the OLD commit. GC then computes the wrong live key (deleting the NEW clone or keeping the OLD), and the next update compares against a stale sha.
**Why it happens:** finalize (update.ts:1168) predates git sources and writes only the fields path/github updates need.
**How to avoid:** on the git-source all-success arm, set `sRecord.resolvedSha = pin` alongside `version`/`resolvedSource`. If GC uses Option A (resolvedSource-path extraction), the key is consistent as long as `resolvedSource` points at the new clone — but `resolvedSha` must still be updated for the next update's sha comparison (D-78-05) and for reinstall's pin (D-78-02).
**Warning signs:** a second update reports `(unchanged)` when the manifest sha actually changed; or GC deletes the just-materialized clone.

### Pitfall 5: GC runs BEFORE the state commit and deletes a live clone
**What goes wrong:** GC placed inside the withStateGuard closure (before `tx.save()`) sees the in-memory mutated state but a crash after delete + before save re-instates the record on reload, now pointing at a deleted clone.
**Why it happens:** wrong hook placement.
**How to avoid:** GC runs strictly AFTER the state mutation commits (D-78-01: "GC runs after the state mutation commits"). In uninstall, post-`withLockedStateTransaction`, beside the existing `rm(pluginDataDir)` (uninstall.ts:596). In update, after `finalizeUpdateRecord` returns. The worst case is then an orphan clone (next GC removes it), never a live-clone deletion.
**Warning signs:** a mid-GC crash test leaves a record pointing at a missing clone.

### Pitfall 6: update of a git plugin whose upstream repo vanished
**What goes wrong:** an unpinned update calls `resolveRemoteRef(HEAD)` on a repo that was deleted/renamed → network/404 error mid-update.
**Why it happens:** update-time re-resolution reaches a dead remote.
**How to avoid (Claude's Discretion, per CONTEXT):** the existing failure-classification path handles this — the probe's `resolveRemoteRef`/`materializePluginClone` throw is caught by update's per-plugin error arm (update.ts:331 `notifyDirectFailure` / phase-2 throw), surfaces the existing `network unreachable` / `authentication required` REASONS token, and the plugin STAYS on its recorded sha (no swap, fail-clean per NFR-3). No new token. [VERIFIED: update.ts:331-347 phase-2 error handling; clone-cache preserves raw HttpError per 77-03-SUMMARY.md]

## Code Examples

### Inject the presence-only probe into list's availableRowMessage (PURL-08 / D-78-03)
```typescript
// list.ts availableRowMessage (currently: resolveStrict(entry, { marketplaceRoot }))
// Inject a presence-only probe. fs-only — NO git surface (gate-clean).
// Source: domain/resolver.ts ResolveContext.resolveGitPluginRoot seam (Phase 77).
const resolved = await resolveStrict(manifestEntry, {
  marketplaceRoot,
  resolveGitPluginRoot: makePresenceProbe(locations),   // NEW
});

// makePresenceProbe (fs-only): a not-installed git entry has no recorded sha,
// so it renders (available) — see Open Q2 for the exact materialized-vs-shortcircuit
// shape. NEVER clones; a cache miss returns not-cached.
```

### reinstall's recorded-sha probe (PURL-07 / D-78-02) — offline by construction
```typescript
// reinstall.ts resolveInstallable — inject a probe pinned to the recorded sha.
// Seam imported BY NAME (ReinstallCloneCacheSeam bundle), never `gitOps` (gate).
const resolved = await resolveStrict(entry, {
  marketplaceRoot,
  resolveGitPluginRoot: makeReinstallCloneProbe(seam, locations, oldRecord.resolvedSha, cloneUrl),
});
requirePartialInstallable(resolved, "install");
// ... and carry the sha forward in updateStateRecord (reinstall.ts:1437):
mp.plugins[plugin] = {
  version: oldRecord.version,
  ...(oldRecord.resolvedSha !== undefined && { resolvedSha: oldRecord.resolvedSha }),  // NEW
  resolvedSource: installable.pluginRoot,
  /* ...unchanged... */
};
```

### update-finalize carries the new resolvedSha (PURL-06 / D-78-05)
```typescript
// update.ts finalizeUpdateRecord, all-success arm (update.ts:1168):
if (phase3aFailures.length === 0) {
  sRecord.version = toVersion;              // shaVersion(pin) for git sources
  sRecord.compatibility = { /* unchanged */ };
  sRecord.resolvedSource = installable.pluginRoot;   // the NEW clone root
  if (resolvedSha !== undefined) sRecord.resolvedSha = resolvedSha;   // NEW (captured pin)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Git-source plugins install but have no lifecycle (update/uninstall/reinstall/list treat them as `unavailable` post-install) | The four lifecycle ops wire the Phase 77 seam: update swaps + GCs, uninstall GCs, reinstall re-materializes offline, list/info classify via presence | D-78-01..06 (this phase) | Git plugins reach parity with path plugins across every surface. |
| Clone cache grows unbounded (install only creates, nothing deletes) | GC derives live keys from state and deletes unreferenced clones after every uninstall/update | PURL-05 / PURL-06 (this phase) | Bounded cache; derive-not-persist (D-78-01). |
| `list`/`info` of an uninstalled git plugin renders `(unavailable)` (no git callback → resolver structural-unavailable) | Presence probe classifies uninstalled git entries `(available)` like path entries | PURL-08 / D-78-03 (this phase) | Correct not-installed status, still network-free. |

**Deprecated/outdated by this phase:** none. All Phase 76/77 surfaces are untouched in structure; the phase only adds probe injections + one GC helper + two field carry-forwards.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | For a git-source plugin, `resolvedSource` is `<pluginClonesDir>/<key>` (url/github) or `<pluginClonesDir>/<key>/<subdir>` (git-subdir), so GC can extract `<key>` by path-relative segment (Option A) | Pattern 1 / Open Q1 | Low — VERIFIED that install/update/reinstall write `resolvedSource = installable.pluginRoot` and that `installable.pluginRoot` for git sources is the clone root (or clone-root+subdir) from `pluginCloneDir(key)`. If a git-subdir's `resolvedSource` includes the subdir, the FIRST path segment under `pluginClonesDir` is still the key (`split(sep)[0]`). Fallback: Option B (recompute from url+sha). |
| A2 | A not-installed git-source manifest entry should render `(available)` on list/info exactly like a not-installed path entry, and this is achievable without cloning | Pattern 3 / Pitfall 3 / Open Q2 | Medium — D-78-03 states the intent explicitly ("classifies and renders exactly like an uninstalled path plugin"), but the exact resolver-vs-shortcircuit wiring is a planner decision; both options satisfy the requirement. |
| A3 | update's per-plugin error arm already surfaces `network unreachable`/`authentication required` for a mid-update clone/HEAD-resolve failure with no new token | Pitfall 6 | Low — the clone-cache seam preserves the raw HttpError (77-03-SUMMARY.md) and update.ts:331 has a phase-2 error arm; the classification reuses the Phase 76/77 ladder. Confirm the ladder is reachable from update's probe throw at planning. |

**Two assumptions (A1, A2) are planner-resolvable one-line/one-flow decisions; A3 is a verification step, not a design risk.**

## Open Questions (RESOLVED)

1. **GC live-key derivation: resolvedSource-path extraction (Option A) vs url+sha recompute (Option B)?**
   - What we know: git records carry both `resolvedSha` (full sha) and `resolvedSource` (the clone path, which embeds `<key>`). D-78-01 says derive references from records at GC time.
   - What's unclear: whether to extract `<key>` from the `resolvedSource` path segment (A — no manifest read, drift-free) or recompute `pluginCloneKey(canonicalUrl, resolvedSha)` (B — needs the url from the manifest).
   - Recommendation: **Option A.** It reuses the exact string that named the clone dir, needs no manifest read (fully offline), and cannot drift from the recompute. Guard against a non-`pluginClonesDir` `resolvedSource` (path/github-name records have no `resolvedSha` and are skipped anyway). Pin at planning.

2. **How does the not-installed list/info surface render an uninstalled git plugin `(available)` without a clone?**
   - What we know: `availableRowMessage` (list.ts:498) / `buildNotInstalledRow` (info.ts:1026) call `resolveStrict`; the resolver's git arm maps `not-cached → unavailable {not installed}` (resolver.ts:676). A path plugin in the same state renders `(available)`.
   - What's unclear: (a) the presence probe returns `materialized` with a sentinel/derived pluginRoot for uninstalled git entries so the resolver classifies `installable`; OR (b) list/info short-circuit git-source not-installed entries to `(available)` from the manifest without invoking the resolver git arm.
   - Recommendation: trace the exact `availableRowMessage`/`buildNotInstalledRow` flow at planning. Option (b) is cleanest — a not-installed git entry has nothing on disk to validate (identical to a path entry whose marketplace clone exists), so classifying it `(available)` from the manifest is truthful and needs no probe. But confirm the completion bucketizer (`classifyManifestEntry`) agrees so list filters stay consistent.

3. **Where does reinstall get the canonical clone url (needed for `materializePluginClone`) without triggering pin re-resolution?**
   - What we know: `resolvePluginPin` reconstructs the url AND resolves the pin (network for unpinned). reinstall needs only the url (the pin is `oldRecord.resolvedSha`).
   - What's unclear: extract a pure `canonicalCloneUrl(source)` helper from `resolvePluginPin`'s url arm (clone-cache.ts:136-137) vs reconstruct inline in reinstall.
   - Recommendation: extract the pure helper so the github→https reconstruction is single-sourced and reinstall reuses it without the pin-resolution. One small refactor of clone-cache.ts.

## Environment Availability

> Skipped for external tooling — this phase adds no new external dependencies, tools, or services. `isomorphic-git@1.38.5` is already installed and wrapped (Phase 77). Network is used only on cache-MISS by update (materialize-before-swap) and reinstall (cold-cache refetch); uninstall GC and list/info are fully network-free (NFR-5). Node/TypeScript toolchain unchanged.

## Validation Architecture

> nyquist_validation is enabled (config.json: `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (TS via native strip) |
| Config file | none (globs in `package.json` scripts) |
| Quick run command | `node --test "tests/orchestrators/plugin/<file>.test.ts"` |
| Full suite command | `npm run check` (typecheck + eslint + prettier + tests + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PURL-05 | uninstall of the last referencer GCs the clone; uninstall of one of two sharers leaves the clone intact | orchestrator | `node --test "tests/orchestrators/plugin/uninstall.test.ts"` + `node --test "tests/orchestrators/plugin/clone-gc.test.ts"` (NEW) | ✅ extend + ⚠️ NEW (Wave 0) |
| PURL-06 | update detects sha change, materializes new clone before swap, records new resolvedSha, GCs old clone when unreferenced; `(unchanged)` when sha equal | orchestrator | `node --test "tests/orchestrators/plugin/update.test.ts"` | ✅ (extend) |
| PURL-07 | reinstall completes with a mock gitOps whose clone AND resolveRemoteRef THROW when the cache is warm (offline guarantee); records carry resolvedSha forward | orchestrator | `node --test "tests/orchestrators/plugin/reinstall.test.ts"` | ✅ (extend) |
| PURL-08 | uninstalled git plugin renders `(available)` on list/info (not `(unavailable)`); installed git plugin with a missing clone shows NO status change; neither clones | orchestrator | `node --test "tests/orchestrators/plugin/list.test.ts"` + `tests/orchestrators/plugin/info.test.ts` | ✅ (extend) |
| GC helper | derive live keys from records; delete only unreferenced dirs; idempotent (double-run safe); ENOENT cache dir → no-op; leak swallow | unit | `node --test "tests/orchestrators/plugin/clone-gc.test.ts"` (NEW) | ⚠️ NEW (Wave 0) |
| arch | reinstall.ts / list.ts / info.ts still carry zero gitOps surface after the phase; uninstall.ts stays git-clean | architecture | `node --test "tests/architecture/no-orchestrator-network.test.ts"` | ✅ (must stay green) |
| render | `sha-<12hex> → sha-<12hex>` renders `v#<7hex> → v#<7hex>` on the update arrow (no new grammar) | catalog UAT | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the specific new/edited test file (e.g. `node --test "tests/orchestrators/plugin/clone-gc.test.ts"`).
- **Per wave merge:** `npm test` (unit suite).
- **Phase gate:** `npm run check` fully green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] NEW `tests/orchestrators/plugin/clone-gc.test.ts` — live-key derivation from records (Option A path-segment extraction); delete-only-unreferenced; two-sharers → keep, last-referencer → delete; idempotent double-run; ENOENT `plugin-clones/` → `[]`; leak swallow returns leak strings without throwing.
- [ ] Extend `tests/orchestrators/plugin/uninstall.test.ts` — post-uninstall GC fires (last referencer → clone gone; one of two sharers → clone intact); GC runs POST-state-commit; a GC leak does not fail the uninstall.
- [ ] Extend `tests/orchestrators/plugin/update.test.ts` — git-source sha-change swap (pinned: manifest sha differs; unpinned: resolveRemoteRef HEAD differs), new clone materialized before swap, `resolvedSha` recorded, old clone GC'd; `(unchanged)` when sha equal; vanished-repo update fails clean on recorded sha.
- [ ] Extend `tests/orchestrators/plugin/reinstall.test.ts` — offline warm-cache reinstall with a mock gitOps throwing on clone AND resolveRemoteRef (PURL-07 hard test); `resolveRemoteRefCalls` empty; `resolvedSha` carried forward; cold-cache reinstall refetches from recorded sha.
- [ ] Extend `tests/orchestrators/plugin/list.test.ts` + `info.test.ts` — uninstalled git plugin → `(available)` (not `(unavailable)`); installed git plugin with a deleted clone → unchanged status; NO clone/network during list/info (mock gitOps throws on any call → still succeeds).
- [ ] Verify `tests/architecture/no-orchestrator-network.test.ts` stays green (reinstall/list/info carry no gitOps token; uninstall git-clean) — update the rationale comment if reinstall's seam-injection prose needs it.
- [ ] Extend `tests/architecture/catalog-uat.test.ts` — git-source update arrow `v#<7hex> → v#<7hex>` byte form.

*The `GitOps` mock (tests/helpers/git-mock.ts) already exposes `cloneThrows`, `resolveRemoteRefThrows`, `cloneCalls`, `checkoutCalls`, `resolveRemoteRefCalls` — reuse directly for the offline-warm-cache and no-network-list assertions.*

## Security Domain

> `security_enforcement` is not explicitly `false` in config → enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Public-only (D-77-06 carried forward) — no credentials handled. Update-time fetch of a private repo fails with the existing `authentication required` token. Provider auth is Phase 79. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No access-control surface added. |
| V5 Input Validation | **yes** | GC enumerates `readdir(pluginClonesDir)` and routes each entry through `pluginCloneDir(key)` (`assertSafeName` + `assertPathInside`) before `rm` — a maliciously-named directory under `plugin-clones/` cannot cause a delete outside the cache root (NFR-10). The recorded `resolvedSha`/`resolvedSource` are parser/schema-validated on load. |
| V6 Cryptography | **yes (usage, not implementation)** | SHA-256 via `node:crypto` only if GC uses Option B (key recompute); Option A needs none. No hand-rolled crypto. |
| V12 File / Resource | **yes** | GC DELETES trees under `plugin-clones/`; update/reinstall CREATE them via staging→rename (NFR-1). Every delete/create path routes through the `pluginCloneDir` SC-7 chokepoint (containment). Post-commit ordering (delete after state save) prevents stranding state in a clone-missing-but-record-present state on a delete failure. |

### Known Threat Patterns for {clone-cache GC + git-source lifecycle}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| GC deletes a directory outside `plugin-clones/` (path traversal via a crafted dir name from `readdir`) | Tampering | Every deletion target routes through `pluginCloneDir(key)` → `assertSafeName` (rejects `/`, `\`, `..`, control chars) + `assertPathInside(pluginClonesDir, ...)`. A `..`-bearing entry is rejected before `rm` (NFR-10). |
| GC deletes a still-referenced clone (shared dedup) | Denial of service | Live-key set derived from ALL surviving records BEFORE deletion (D-78-01); only the difference is removed. A shared clone stays while any record references it. |
| Update-time TOCTOU: manifest sha changes between resolve and swap | Tampering | The pin is captured ONCE at the candidate resolve and the clone materialized at that exact pin BEFORE the swap; the swap reads `installable.pluginRoot` (the materialized tree), not a re-read manifest. |
| Credential leak in an update-time clone error | Information disclosure | Public-only (D-77-06) — no credentials handled; `authentication required` carries only the HTTP status. No new file interpolates a token → no-credential-leak gate needs no new entry (confirm). |
| Stranded state on a GC delete failure (record present, clone deleted mid-op) | Availability | GC runs POST-state-commit and swallows leaks (D-19-01); a partial delete leaves an orphan that the next GC removes (idempotent). A record never points at a deleted clone because deletion only targets UNREFERENCED keys. |

**No-credential-leak gate:** Phase 78 adds no file that interpolates a token into an error/notification (public-only, GC handles no credentials). Confirm `tests/architecture/no-credential-leak.test.ts` needs no new file entry.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Node >= 20.19.0 (NFR-4); dev machine 22.22.2. No new syntax.
- **TypeScript strict / NFR-7:** the `GitPluginRootResult` union (shipped Phase 77) stays sound — the presence/reinstall/update probes return only its declared arms; the `unavailable` resolver arm never carries `pluginRoot`. No new casts.
- **Atomic disk mutations (NFR-1):** update/reinstall materialize via the existing `materializePluginClone` staging→rename. GC `rm(dir, {recursive, force})` is a delete (not a mutation-in-place); a partial delete is recovered by idempotent re-GC (NFR-3), not by atomicity.
- **No Pi restart for recovery (NFR-2) / idempotent-or-fail-clean (NFR-3):** GC is idempotent (double-run safe); an orphan clone is removed by the next pass. A vanished-repo update fails clean on the recorded sha.
- **Network policy (NFR-5, amended):** `uninstall` GC + `list`/`info` presence probe are network-free (fs-only). `update`/`reinstall` touch the network ONLY on cache-miss; a warm-cache reinstall is unconditionally offline (D-78-02). `reinstall.ts`/`list.ts`/`info.ts` carry zero gitOps surface (seam-by-name for reinstall; fs-only probe for list/info).
- **Containment (NFR-10):** GC delete targets + update/reinstall clone targets route through the `pluginCloneDir` SC-7 chokepoint. git-subdir containment (reinstall/update) anchors to the clone root (reuse the install callback's `assertPathInside(cloneRoot, ...)`).
- **Output channel (IL-2):** all user-visible messages through `notify()`; GC leaks are SWALLOWED (D-19-01, no user surface — hygienic cleanup never becomes the primary path). notify stays a dumb renderer (MEMORY.md); the sha-arrow is a pure string transform already shipped.
- **Quality bar (NFR-6):** `npm run check` green.
- **Comment policy (`.claude/rules/typescript-comments.md`):** tag new code with decision/requirement IDs (`D-78-01`, `PURL-05`, `NFR-5`, `SC-7`), NEVER `Phase 78`/`Plan`/`Wave`/`Pitfall N`. Domain-word `phase` (3-phase swap ledger) is exempt.
- **Closed-set discipline (MEMORY.md):** NO new REASONS/status tokens expected (D-78-03/04/06). update-time network errors reuse `network unreachable` / `authentication required`. Mint a new token ONLY via the lockstep catalog amendment if none is truthful (not anticipated).
- **Git:** never commit to main; branch `features/*`; run `pre-commit run` before commit; `SKIP=trufflehog` prefix only inside a worktree.

## Upstream Parity (carried from Phase 77, re-confirmed applicable)

The lifecycle semantics this phase implements have no NEW upstream schema surface — they operate on the Phase 77 parser output (`url`/`git-subdir`/`github` sources with `ref`/`sha`, `sha` wins over `ref`). The load-bearing upstream facts (verified against `code.claude.com/docs/en/plugin-marketplaces.md` in Phase 77) remain: plugin sources support both `ref` and `sha`; the `sha` is the effective pin; marketplace and plugin sources are pinned independently (so the plugin clone cache is a separate lifecycle from the marketplace clone). Nothing in Phase 78 diverges from or re-checks upstream — it wires the already-parity-checked sources into update/uninstall/reinstall/list.

## Sources

### Primary (HIGH confidence — read in full or verified against installed source)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — `syncCloneOnce` github-only refresh (236-265), candidate `resolveStrict` NO git callback (758), `toVersion===fromVersion` short-circuit (818), `prepareUpdateHandles` reads `installable.pluginRoot` (837-886), `finalizeUpdateRecord` all-success arm writes version/compatibility/resolvedSource but NOT resolvedSha (1096-1177), phase-2 error arm (331-347). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — `withLockedStateTransaction` delete + tx.save (372-502), POST-state-commit `rm(pluginDataDir, {recursive, force})` with D-19-01 swallow (596-610), imports `rm` (44); NOT in the network forbidden list. [VERIFIED: read in full region]
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — `resolveInstallable` NO git callback (1268-1275), `updateStateRecord` drops resolvedSha (1422-1458), imports `resolveStrict`/`requirePartialInstallable` (68); IS in the forbidden list. [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `installedRowMessage` derives status from recorded compatibility/version, resolves ONLY when upgradable (304-391), `availableRowMessage` resolves not-installed entries (498-576), both pass NO git callback (382, 511). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — INFO-05 source-kind gate (10-18, 148-155), `buildInstalledRow` resolveStrict (906), `buildNotInstalledRow` resolveStrict + `isLocallyResolvable` gate → non-path renders `(unavailable)` (1026-1104), NO git callback. [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `InstallCloneCacheSeam` bundle (379-381), `makeInstallCloneProbe` calls `resolvePluginPin` then `materializePluginClone`, captures sha side-channel (457-493), injected at resolveStrict (656-675). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — `materializePluginClone` warm-cache/EEXIST/MA-9 (53-107), `resolvePluginPin` url-canonicalize + sha-over-ref + unpinned resolveRemoteRef (129-149). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `GitPluginRootResult` union (257-261), `ResolveContext.resolveGitPluginRoot` (277-279), git-source branch mapping `not-cached → unavailable {not installed}` (656-681). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/domain/clone-key.ts` — `pluginCloneKey(canonicalUrl, fullSha)` = `sha256_12(url)-sha12` (31-34). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `pluginClonesDir` per-scope suffix (170), `pluginCloneDir(key)` SC-7 chokepoint (247-257). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `PLUGIN_INSTALL_RECORD_SCHEMA` with additive-optional `resolvedSha` + `resolvedSource` (54-80). [VERIFIED: read relevant region]
- `extensions/pi-claude-marketplace/shared/notify.ts` — `formatShaVersionForDisplay` (1779-1785), `renderVersion` (1797-1803), `composeVersionArrow` routes both sides through renderVersion (1848-1849). [VERIFIED: read in full region — D-78-06 already satisfied]
- `extensions/pi-claude-marketplace/shared/fs-utils.ts` — `pathExists` (58), `removeOrphanIfPresent(target, "tree")` (104). [VERIFIED: exports grep]
- `tests/architecture/no-orchestrator-network.test.ts` — FORBIDDEN_TARGETS = install/list/reinstall/plugin-info/marketplace-info (56-61), FORBIDDEN_PATTERNS incl `\bgitOps\b` (74-77), update.ts exempt + uninstall.ts implicitly clean (38-42). [VERIFIED: read relevant regions]
- `tests/helpers/git-mock.ts` — `cloneThrows`/`resolveRemoteRefThrows`/`cloneCalls`/`checkoutCalls`/`resolveRemoteRefCalls` (51-104). [VERIFIED: grep]

### Secondary (MEDIUM confidence)
- Phase 77 RESEARCH + 77-03/77-04 SUMMARY — clone-cache seam architecture, network-gate constraint map, install-probe pattern, resolvedSha side-channel. [CITED]

### Tertiary (LOW confidence)
- MEMORY.md — force-install derive-not-sticky precedent (echoed by D-78-01 derive-not-persist); notify-is-a-dumb-renderer. [ASSUMED — corroborating, not load-bearing]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; every primitive shipped and tested in Phase 77.
- Architecture (four probe injections + GC placement + network-gate compliance): HIGH — every call site read in full; the forbidden list and the install-probe pattern verified against source.
- GC mechanics (derive-not-persist, live-key derivation, idempotent delete): HIGH on the delete/idempotency shape (reuses the verified uninstall `rm(pluginDataDir)` template); MEDIUM on Option A vs B key derivation (both work; A recommended, pinned at planning — Open Q1).
- List/info not-installed classification: MEDIUM — D-78-03 intent is explicit; the resolver-vs-shortcircuit wiring is a planner decision (Open Q2), both options satisfy the requirement.
- Version arrow (D-78-06): HIGH — verified `composeVersionArrow`→`renderVersion`→`formatShaVersionForDisplay` already renders sha pairs; zero new render code.

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 (stable in-tree domain; all touched code is committed and read directly; no external drift risk — isomorphic-git wrappers frozen in Phase 77).

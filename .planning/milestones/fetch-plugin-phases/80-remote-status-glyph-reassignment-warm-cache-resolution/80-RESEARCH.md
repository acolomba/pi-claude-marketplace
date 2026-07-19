# Phase 80: Remote status, glyph reassignment & warm-cache resolution - Research

**Researched:** 2026-07-14
**Domain:** Closed-set token amendment + fs-only git-source classification (TypeScript, in-repo)
**Confidence:** HIGH (all findings verified against the live codebase this session)

## Summary

This is a codebase-internal phase: no new external packages, no new libraries. Every finding here is `[VERIFIED: codebase]` by reading the actual source and tests. The phase has two intertwined mechanical shapes: (1) a **closed-set token/glyph amendment** — add the `(remote)` `PluginStatus`, reassign `◌ ◍`, and land the catalog/style-guide/tripwire updates atomically in one green commit (RSTA-01/02/03); and (2) a **classification-seam rewrite** — replace the unconditional git-source `"available"` short-circuit in three sites with presence-derived `remote` vs warm-tree three-way resolution via the Phase 79.1 `makePresenceProbe` + `resolveStrict` composition (RSTA-04/05/06/07).

The single highest-leverage discovery: the git-source `"available"` short-circuit is duplicated across **three** call sites, not one. `git-source-probe.ts::probeManifestEntry` (the shared probe both completion and — indirectly — parity tests read) is the canonical site named in CONTEXT, but `list.ts::availableRowMessage` (lines 534-552) and `info.ts::buildNotInstalledRow`/`isGitSource` (lines 1076-1078, 131-133) each carry their **own** inline `parsedSource.kind === "url" | "git-subdir" | "github" → "available"` short-circuit that never routes through `probeManifestEntry`. All three must change in lockstep or the surfaces diverge (the exact class of drift the 78-09 output-parity guard exists to catch).

The second key discovery: `remote` is derived at the **classification layer**, never as a resolver arm (NFR-7). The composition is exactly `probeUpgradeCandidate`'s pattern — build a `ResolveContext` with `resolveGitPluginRoot: makePresenceProbe(locations)`, call `resolveStrict(entry, ctx)`, and read the outcome: a cold cache (`not-cached`) makes `resolveStrict` return `unavailable{not installed}` → classify **`remote`**; a warm tree (`materialized`) makes `resolveStrict` proceed to the real three-way resolution → `available`/`partially-available`/`unavailable`.

**Primary recommendation:** Split into two waves — Wave A lands the closed-set amendment (notify.ts tuples + glyphs + PluginInfoRowBase + renderer arms + catalog + style-guide + all tripwire/fixture tests) in ONE commit; Wave B rewrites the three classification short-circuits + the schemaVersion 5→6 bump + `list --remote` + `INSTALL_STATUSES`. Invert the three git-source-probe tests asserting the old `(available)` intentionally.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `(remote)` token + glyph vocabulary | Renderer (`shared/notify.ts`) | Docs (catalog + style guide) | notify.ts is the single closed-set authority (`as const` tuples); catalog byte forms are the user contract |
| Git-source presence classification | Orchestrator (`git-source-probe.ts`) | Domain (`resolver.ts` via injected probe) | Classification derives at the orchestrator layer; the resolver union stays 3-way (NFR-7) |
| Warm-tree component resolution (info) | Orchestrator (`info.ts`) | Domain (`resolver.ts` + fs read) | fs-only; NFR-5 keeps it network-free; resolver does the three-way, info composes components |
| Completion offer set for `remote` | Edge (`completions/data.ts`) | Shared (`completion-cache.ts` schema) | Install completion filters on `PluginIndexRow.status`; the cache schema carries the literal |
| `list --remote` filter | Edge (`handlers/plugin/list.ts` parse) + Orchestrator (`list.ts` predicate) | — | Flag parse is edge; `FilterBucket` union + `shouldShow` predicate is the orchestrator |

## Standard Stack

No external packages are introduced, removed, or upgraded in this phase. The relevant in-repo modules and their current versions are governed by `package.json` and CLAUDE.md's locked stack (typebox `^1.1.38`, TypeScript strict, `node:test`). **No `## Package Legitimacy Audit`, `## Environment Availability`, or installation section applies — this phase touches only existing first-party source and docs.**

Verified in-repo dependencies this phase composes (no version action needed):

| Module | Role in this phase | Verified |
|--------|-------------------|----------|
| `shared/notify.ts` | Closed-set tuples (`STATUS_TOKENS`, `PLUGIN_STATUSES`), ICON constants, renderer switches, message variants | `[VERIFIED: codebase]` |
| `orchestrators/plugin/git-source-probe.ts` | `probeManifestEntry` (reclassification site), `makePresenceProbe`, `probeUpgradeCandidate` (composition template) | `[VERIFIED: codebase]` |
| `orchestrators/plugin/plugin-state-classifier.ts` | `ManifestEntryClassification` union, `classifyManifestEntry` | `[VERIFIED: codebase]` |
| `orchestrators/plugin/list.ts` | `FilterBucket`, `shouldShow`, `availableRowMessage` (2nd short-circuit) | `[VERIFIED: codebase]` |
| `orchestrators/plugin/info.ts` | `isGitSource`, `buildGitNotInstalledRow`, `buildNotInstalledRow` (3rd short-circuit), `buildNonPathInstalledRow` | `[VERIFIED: codebase]` |
| `orchestrators/edge-deps.ts` | `classifyNotInstalledPluginRow` (bucketizer consuming `probeManifestEntry`) | `[VERIFIED: codebase]` |
| `shared/completion-cache.ts` | `PLUGIN_INDEX_CACHE_SCHEMA` (schemaVersion `5`), `PluginIndexRow.status` union | `[VERIFIED: codebase]` |
| `edge/completions/data.ts` | `INSTALL_STATUSES = Set(["available"])` — the completion offer filter | `[VERIFIED: codebase]` |
| `edge/handlers/plugin/list.ts` | `BOOLEAN_FLAGS` set + spread — the `--remote` parse site | `[VERIFIED: codebase]` |
| `domain/resolver.ts` | `resolveStrict`, `ResolveContext.resolveGitPluginRoot`, `GitPluginRootResult`, `not-cached → unavailable{not installed}` mapping | `[VERIFIED: codebase]` |

## Architecture Patterns

### System Architecture Diagram — classification flow (per not-installed manifest entry)

```
                          manifest entry (source: url | git-subdir | github | path | npm | unknown)
                                   |
             +---------------------+---------------------+
             |                                           |
     parsedSource.kind is git?                    parsedSource.kind is path/npm/unknown
             |                                           |
             v                                           v
   makePresenceProbe(locations)                   resolveStrict(entry, { marketplaceRoot })
   as resolveGitPluginRoot in a                          |
   ResolveContext, then                            classifyManifestEntry(resolved)
   resolveStrict(entry, ctx)                              |
             |                                    available | partially-available | unavailable
     probe.kind?                                          |
        |        |                                        |
   not-cached  materialized                               |
   (cold)      (warm mirror / per-sha clone)              |
        |        |                                        |
        v        v                                        |
   resolver     resolveStrict proceeds on warm tree       |
   returns      -> available | partially-available        |
   unavailable  | unavailable (real 3-way on disk)        |
   {not         |                                         |
   installed}   +--------------------+--------------------+
        |                            |
        v                            v
   classify REMOTE             classify available / partially-available / unavailable
        |                            |
        +------------+---------------+
                     v
     ManifestEntryClassification -> consumed IDENTICALLY by:
        - list.ts row builder (availableRowMessage)
        - edge-deps.ts bucketizer (classifyNotInstalledPluginRow -> PluginIndexRow.status)
        - info.ts not-installed row builder (buildNotInstalledRow)
     (parity by construction; output-parity drift-guard asserts it)
```

The **decision point that produces `remote`** is: *git source AND presence probe returns `not-cached`*. Everything else flows through the existing resolver machinery unchanged.

### Component Responsibilities

| File | Current behavior | Phase-80 change |
|------|-----------------|-----------------|
| `git-source-probe.ts::probeManifestEntry` | Git source → `return "available"` unconditionally (lines 165-171); `_locations` param unused | Compose `makePresenceProbe(locations)` + `resolveStrict`; `not-cached` → `"remote"`, warm → `classifyManifestEntry(resolved)`. `_locations` becomes used |
| `plugin-state-classifier.ts::ManifestEntryClassification` | `"available" \| "partially-available" \| "unavailable"` (line 53) | Add `"remote"` member |
| `list.ts::availableRowMessage` | Inline git short-circuit → `status: "available"`, `bucket: "available"` (534-552) | Route through the same presence-derived classification; emit `PluginRemoteMessage` on `not-cached` |
| `list.ts::FilterBucket` | `"installed-inventory" \| "available" \| "partially-available" \| "unavailable"` (line 135) | Add `"remote"`; add `opts.remote`; extend `filtersPassive`, `shouldShow` |
| `info.ts::buildNotInstalledRow` + `isGitSource` | Git source → `buildGitNotInstalledRow` → `status: "available"`, `componentsResolved: false` (1076-1078) | `not-cached` → `(remote)` row (components not resolved); warm → resolve fs-only via `resolveStrict` + `composeResolvedComponents` |
| `info.ts::buildNonPathInstalledRow` | Non-path installed → `componentsResolved: false` always (862-880) | Installed git plugin with a warm clone resolves components fs-only (amends INFO-05) |
| `edge-deps.ts::classifyNotInstalledPluginRow` | Reads `probeManifestEntry` (no local change needed) | Inherits `remote` automatically once the probe returns it — verify parity |
| `completion-cache.ts` | `schemaVersion: Type.Literal(5)`; status union has 8 members | Bump `5`→`6` (three literal sites); add `"remote"` to schema union + `PluginIndexRow.status` |
| `edge/completions/data.ts::INSTALL_STATUSES` | `Set(["available"])` | Add `"remote"` (D-80-05: install still offers remote — install performs the fetch) |
| `edge/handlers/plugin/list.ts::BOOLEAN_FLAGS` | 4 flags | Add `"--remote"` + one spread line `...(filterFlags.has("--remote") && { remote: true })` |
| `shared/notify.ts` | Tuples, glyphs, variants, renderer switches | See "Closed-Set Amendment File Inventory" below |

### Pattern 1: Compose presence-probe + resolveStrict for `remote` derivation

**What:** Derive `remote` by reading whether `resolveStrict` (fed the presence probe) short-circuits on a cold cache.
**When to use:** In `probeManifestEntry` for git sources; the same shape appears in `probeUpgradeCandidate` (the working template, lines 191-205).
**Example:**
```typescript
// Source: git-source-probe.ts::probeUpgradeCandidate (existing template to mirror)
const ctx: ResolveContext = {
  marketplaceRoot,
  resolveGitPluginRoot: makePresenceProbe(locations),
};
try {
  const resolved = await resolveStrict(entry, ctx);
  // materialized warm tree -> real 3-way classification
  return classifyManifestEntry(resolved);
} catch {
  return "unavailable";
}
```
**The `remote` discrimination:** on a cold cache the injected probe returns `{ kind: "not-cached" }`, and `resolver.ts` (lines 676-680) maps that to `unavailable{not installed}`. That specific note (`"not installed"`) is the signal that the plugin is *unfetched*, not *structurally broken*. Two viable designs, choose at plan time:
- **(a) Probe-first:** call `makePresenceProbe(locations)(parsedSource)` directly; if `not-cached` → `"remote"` without invoking `resolveStrict` at all; if `materialized` → run `resolveStrict` for the 3-way. This is the cleanest because `remote` never depends on note-string sniffing. `[VERIFIED: codebase]` — the probe is a standalone callable returning `GitPluginRootResult`.
- **(b) Note-sniff:** always `resolveStrict`, then inspect the `unavailable` arm's notes for `"not installed"`. Brittle (note-string coupling). **Recommend (a).**

### Pattern 2: Closed-set append-last amendment (the `disabled` / `partially-available` precedent)

**What:** A new `PluginStatus` member is appended LAST in both `STATUS_TOKENS` and `PLUGIN_STATUSES` (below the reload-hint trigger window), the length tripwire is bumped in the SAME commit, and every renderer `switch` + `assertNever` tail gets an arm.
**When to use:** Adding `"remote"` (RSTA-01).
**Example — the two tuples, `remote` appended after `partially-available`:**
```typescript
// Source: shared/notify.ts:211-248 (STATUS_TOKENS) and :400-430 (PLUGIN_STATUSES)
// ... "partially-installed", "partially-upgradable", "partially-available",
  "remote",   // appended LAST: inventory row, info severity, needsReload:false, below reload-hint window
] as const;
```
`remote` MUST join `PLUGIN_STATUSES` (not just `STATUS_TOKENS`) because `PluginInfoRowBase.status` derives via `Extract<PluginStatus, ...>` and the info surface renders `(remote)` (RSTA-01: replaces `(available)` in info too). `[VERIFIED: codebase]` — the `partially-available` comment at notify.ts:423-429 states exactly this coupling.

### Anti-Patterns to Avoid

- **Changing only `probeManifestEntry`.** The `list.ts` and `info.ts` inline short-circuits will still emit `(available)` for git sources — the surfaces diverge and the parity guard fails. All THREE sites change together.
- **Adding a fourth resolver arm.** NFR-7 forbids it. `remote` is a classification-layer derivation, never a `ResolvedPlugin.state`. The `classifyManifestEntry` `switch` + `assertNever` stays 3-way.
- **Sniffing `resolveStrict` notes to detect cold cache.** Use the probe's `not-cached` discriminant directly (Pattern 1a).
- **Bumping the schemaVersion literal in only one place.** `completion-cache.ts` has `5 as const` in THREE spots: the schema `Type.Literal(5)` (line 86), the poison writer (line 338), and the main writer (line 353). All three go to `6`.
- **Rendering a `[scope]` bracket on `(remote)` rows.** D-80-03: bare row, parity with `(available)`. The variant carries no `scope` field (SNM-11 carve-out family: `available | partially-available | unavailable` — `remote` joins it).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cold-vs-warm cache detection | A new fs-stat helper | `makePresenceProbe` (79.1, `git-source-probe.ts:110`) | Already handles both pinned (per-sha key) and unpinned (mirror-dir + `readMirrorHeadSha`) arms, fs-only, network-free |
| Three-way warm-tree classification | Manual component enumeration | `resolveStrict` + `classifyManifestEntry` | The resolver already produces `installable`/`partially-available`/`unavailable`; reuse keeps `remote` off the resolver union |
| Component listing for warm info | New readdir walk | `composeResolvedComponents` (`info.ts:521`) | Already walks `componentPaths`, mcpServers keys, hooks re-parse; tolerates ENOENT |
| List/completion parity | A second classifier | The shared `probeManifestEntry` both surfaces read | The 78-09 output-parity drift-guard exists precisely to prevent a second classifier |
| Cache invalidation on token growth | Manual migration | schemaVersion 5→6 bump | Existing drop+rebuild-on-mismatch path; the plugin-index cache is an ephemeral optimization, not persisted state |

**Key insight:** Phase 79.1 already shipped every fs-only presence primitive. This phase is 90% *wiring existing primitives into the classification decision* and 10% *closed-set vocabulary growth*. Nothing new gets built at the fs/git layer.

## Closed-Set Amendment File Inventory (RSTA-02 — the ONE atomic commit)

Every file the `partially-available` (USTAT-02/D-64-01) and `disabled` (D-54-01) amendments touched, mapped to the exact edit for `remote` + the `◌ ◍` reassignment. `[VERIFIED: codebase]` for every row.

### notify.ts (the closed-set authority)

| Site | Line(s) | Edit |
|------|---------|------|
| `STATUS_TOKENS` tuple | 211-248 | Append `"remote"` last |
| `PLUGIN_STATUSES` tuple | 400-430 | Append `"remote"` last |
| `ICON_DISABLED` constant | 1452 | Change `"◌"` → `"◍"` (U+25CD) |
| New `ICON_REMOTE` constant | near 1440 | Add `export const ICON_REMOTE = "◌";` (U+25CC) |
| `PluginRemoteMessage` variant | new, near 681 | New interface modeled on `PluginAvailableMessage` (status `"remote"`, no scope, no reasons, optional `version`/`description`) |
| `PluginNotificationMessage` union | ~923 area | Add `PluginRemoteMessage` |
| `PluginInfoRowBase.status` | 1202-1210 | Add `\| "remote"` to the `Extract<PluginStatus, ...>` list |
| Plugin-row renderer `switch` | 2120-2234 | Add `case "remote":` using `ICON_REMOTE`, `(remote)`, `renderScopeBracket(undefined, mpScope)`, no reasons |
| `will disable` renderer arm | 2207-2219 | Now uses `ICON_DISABLED` (which is now `◍`) — no code change, glyph flows through the constant |
| `disabled` renderer arm | 2220-2234 | Same — flows through `ICON_DISABLED` (now `◍`) |
| `pluginInfoStatusGlyph` switch | 3042-3064 | Add `case "remote": return ICON_REMOTE;` |

### Type-level exhaustiveness (`assertNever`) sites that fail to compile until an arm is added

`[VERIFIED: codebase]` — these are the compile-time guards that force the amendment complete:
- `shared/notify.ts:2235` plugin-row renderer `assertNever(p)` — needs a `case "remote"`.
- `shared/notify.ts:3060` `pluginInfoStatusGlyph` `assertNever(status)` — needs a `case "remote"` (only if `remote` joins `PluginInfoRowBase.status`, which it does for RSTA-04 info rendering).
- `list.ts:1088-1094` `sortPluginsInBlock` `scopeOf` switch `assertNever(p)` — add `case "remote":` alongside `available | unavailable | partially-available` (returns `marketplaceScope`; no scope field).
- `plugin-state-classifier.ts:176` `classifyManifestEntry` `assertNever(resolved)` — does NOT change (resolver stays 3-way; `remote` derives outside the switch).

### Tripwire tests (bump in the SAME commit)

| Test | Line | Change |
|------|------|--------|
| `notify-closed-set-locks.test.ts` STATUS_TOKENS length | 41 | `23` → `24` |
| `notify-closed-set-locks.test.ts` PLUGIN_STATUSES length | 49 | `18` → `19` |
| `notify-grammar-invariant.test.ts` `WILL_TOKEN_RE` | 238 | Char class `[●○⊘◌]` → `[●○⊘◍]` (`◌` reassigned away from `will disable`) |
| `notify-grammar-invariant.test.ts` `DISABLED_TOKEN_RE` | 247 | Anchor `^◌ ` → `^◍ ` |
| `notify-grammar-invariant.test.ts` `ROW_ICONS` | 73 | `["●", "○", "⊘"]` — no change unless a `(remote)` error/warning fixture is added (remote is info-only, so likely no change; verify) |
| `notify-stamp-coverage.test.ts` `TRANSITION_STATUS_LIST` | 55-67 | NO change — `remote` is inventory (info, `needsReload:false`), excluded like `available` |

### Catalog + style guide (byte-normative)

| File | Site | Change |
|------|------|--------|
| `docs/output-catalog.md` glyph legend | line 13 | `◌` entry: split — `◌` now means `(remote)`; add a new `◍` legend entry for `(disabled)`/`(will disable)` |
| `docs/output-catalog.md` `<icon>` enumeration | line 38 | Add `◍` to the `● / ○ / ⊘ / ⊖ / ◌` list |
| `docs/output-catalog.md` status table | lines 136-147 | Add a `(remote)` row (`◌`); change `(will disable)` and `(disabled)` glyph column `◌` → `◍` |
| `docs/output-catalog.md` disabled fixtures | 322-346 | Change `◌ foo-plugin ... (disabled)` byte rows → `◍` |
| `docs/output-catalog.md` new `(remote)` fixtures | plugin-list + plugin-info sections | Add `<!-- catalog-state: remote-... -->` blocks (list row `◌ <name> (remote)`; info `(remote)` + `components: not resolved`) |
| `docs/messaging-style-guide.md` variant list | 41-53 | Add `PluginRemoteMessage // status: "remote"; NO scope (SNM-11); ◌`; note `PluginDisabledMessage` now uses `◍` |
| `docs/messaging-style-guide.md` stale count | line 58 | Says "16 plugin status discriminators" — already stale (actual 18→19). Fix to `19` while here, or drop the count per the guide's own "do not re-enumerate in prose" rule |

### Catalog-UAT fixtures + runner (`tests/architecture/catalog-uat.test.ts`)

`[VERIFIED: codebase]` — the runner is a **bidirectional byte-equality gate**:
- Forward walk (line 3728): every `<!-- catalog-state: STATE -->` block must byte-match `notify()` output for its `FIXTURES[section][state]` payload.
- Inverse walk (line 3970): every `FIXTURES` entry must have a matching catalog annotation (no orphan fixtures).

Therefore each new `(remote)` catalog block needs a paired `FIXTURES` entry carrying a `PluginRemoteMessage`-bearing `NotificationMessage`, and the two disabled fixtures' expected bytes flip `◌`→`◍` on both sides. `FIXTURES` is keyed `[section][state]` (map at line 280); existing `disabled-inventory` entry at line 655.

## Runtime State Inventory

> Included because this phase mutates a persisted-ish cache schema and a user-visible token set.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Plugin-index completion cache** (`schemaVersion: 5`, on-disk JSON per scoped marketplace). Carries `status` literals incl. `available` for git sources classified pre-fix. | schemaVersion 5→6 bump → existing drop+rebuild-on-mismatch path auto-invalidates stale caches. No manual migration (ephemeral optimization cache, T-67-07). |
| Live service config | None — no external service holds this state. | None — verified: classification is derived at read time from `plugin-clones/` presence (derive-not-persist). |
| OS-registered state | None. | None — verified: no OS registration involves plugin status tokens. |
| Secrets/env vars | None. | None — verified: no secret/env references the token set. |
| Build artifacts | None — TypeScript is type-stripped at runtime; no compiled token table. | None — verified: `as const` tuples are source-only. |

**The canonical question — after every file is updated, what runtime systems still hold the old `(available)` classification?** Only the plugin-index cache files on disk. The 5→6 bump handles them. There is NO persisted fetch state (derive-not-persist), so warm/cold status self-derives from `plugin-clones/` contents every read.

## Common Pitfalls

### Pitfall 1: The triple short-circuit
**What goes wrong:** Only `probeManifestEntry` is updated; `list.ts` and `info.ts` still emit `(available)` for git sources.
**Why it happens:** CONTEXT names `git-source-probe.ts` as "THE reclassification site," but `list.ts::availableRowMessage` (534-552) and `info.ts::buildNotInstalledRow`/`isGitSource` (131-133, 1076-1078) predate the shared probe and each carry their own inline copy.
**How to avoid:** Enumerate all three in the plan; ideally refactor `list.ts` and `info.ts` to call the shared classifier so there is ONE decision. `[VERIFIED: codebase]`
**Warning signs:** The output-parity drift-guard (`tests/orchestrators/edge-deps.test.ts`, feeds the same manifest through `__test_availableRowMessage` + the bucketizer) goes red, or list shows `(remote)` while info shows `(available)`.

### Pitfall 2: Glyph reassignment touches the tripwire regexes, not just constants
**What goes wrong:** `ICON_DISABLED` is flipped to `◍` but `notify-grammar-invariant.test.ts`'s `WILL_TOKEN_RE` (238) and `DISABLED_TOKEN_RE` (247) still hard-code `◌` — the test fails against the new render.
**Why it happens:** The grammar-invariant test embeds the glyph literally in regexes, not via the constant.
**How to avoid:** Change `◌`→`◍` in both regexes in the same commit. `[VERIFIED: codebase]`
**Warning signs:** `DISABLED_TOKEN_RE` mismatch: rendered `◍ foo (disabled)` vs regex `^◌ ...`.

### Pitfall 3: Catalog-UAT is bidirectional — orphan-fixture failure
**What goes wrong:** A `(remote)` `FIXTURES` entry is added but no matching `<!-- catalog-state: remote-... -->` block exists (or vice-versa).
**Why it happens:** The runner walks both directions (forward byte-equality + inverse orphan check).
**How to avoid:** Add catalog block AND `FIXTURES` entry together; the state slug must match exactly. `[VERIFIED: codebase]` — inverse walk at catalog-uat.test.ts:3970.

### Pitfall 4: The three tests asserting OLD `(available)` invert INTENTIONALLY
**What goes wrong:** `git-source-probe.test.ts:51-84` (three tests) assert a not-installed url/github/git-subdir source classifies `"available"`. Under RSTA-01 with no materialized clone these must now assert `"remote"`.
**Why it happens:** These encode the 78-09 short-circuit that this phase deliberately replaces.
**How to avoid:** Invert them (assert `"remote"` for the cold-cache arm) and ADD warm-mirror tests asserting `available`/`partially-available`/`unavailable` after staging a mirror (the `makePresenceProbe` warm test at line 110 shows the mirror-staging recipe). `[VERIFIED: codebase]`
**Warning signs:** These three failing is EXPECTED and correct; do not "fix" them back.

### Pitfall 5: `(remote)`-never-for-installed invariant (D-78-04 degrade)
**What goes wrong:** An installed git plugin whose clone went missing regresses to `(remote)` instead of staying `(upgradable)`/`(installed)`.
**Why it happens:** If the installed-record path accidentally routes through the not-installed classifier.
**How to avoid:** `remote` derives ONLY on the not-installed manifest-entry path (`probeManifestEntry` / `availableRowMessage` / `buildNotInstalledRow`). The installed path (`installedRowMessage`, `buildInstalledRow`) keeps the existing `probeUpgradeCandidate` CR-01 degrade — a cold cache on an installed candidate folds to plain `(upgradable)`, never `(remote)`. `[VERIFIED: codebase]` — this degrade already exists and is untouched.
**Warning signs:** An installed plugin row shows `◌ ... (remote)`.

### Pitfall 6: schemaVersion literal appears three times
**What goes wrong:** Only the schema `Type.Literal(5)` is bumped; the two `atomicWriteJson` writers still write `5 as const` → the just-written cache fails its own validator on next read.
**How to avoid:** Bump all three (completion-cache.ts:86, 338, 353). `[VERIFIED: codebase]`

## Code Examples

### The `not-cached → unavailable{not installed}` mapping (the `remote` signal source)
```typescript
// Source: domain/resolver.ts:676-680
case "not-cached":
  return {
    kind: "unavailable",
    result: unavailable(entry.name, [...partial.notes, `not installed`]),
  };
```

### The warm-mirror staging recipe for new tests
```typescript
// Source: tests/orchestrators/plugin/git-source-probe.test.ts:110-144
const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
await mkdir(mirrorDir, { recursive: true });
await git.init({ fs, dir: mirrorDir, defaultBranch: "main" });
// ... write, add, commit -> readMirrorHeadSha reads HEAD fs-only
// probe(source) now returns { kind: "materialized", pluginRoot: mirrorDir, resolvedSha }
```

### The list `--remote` flag parse (one-line additions)
```typescript
// Source: edge/handlers/plugin/list.ts:24 + 74-77
const BOOLEAN_FLAGS = new Set(["--installed", "--available", "--unavailable", "--partial", "--remote"]);
// ...
...(filterFlags.has("--remote") && { remote: true }),
```

### The install completion offer set (D-80-05: remote still offered)
```typescript
// Source: edge/completions/data.ts:63
const INSTALL_STATUSES: ReadonlySet<PluginIndexRow["status"]> = new Set(["available", "remote"]);
// install performs the fetch, so a (remote) plugin is a valid install target
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Not-installed git source → `(available)` (manifest-only over-claim) | `(remote)` when nothing materialized; warm tree resolves fs-only | Phase 80 (this) | Honest pre-install lifecycle; INTENDED `--available` behavior change |
| Unpinned fetched-state via prefix-scan | Mirror-dir presence (`plugin-clones/<urlhash12>/`) | Phase 79.1 (shipped) | No multi-clone ambiguity; `makePresenceProbe` mirror arm ready to consume |
| `◌` = disabled | `◌` = remote; `◍` = disabled/will-disable | Phase 80 (this) | Terminal-render gate cleared 2026-07-13 (D-80-01) |

**Deprecated/outdated by this phase:**
- The git-source `"available"` short-circuit (three sites) — replaced by presence-derived classification.
- `docs/messaging-style-guide.md` "16 plugin status discriminators" (line 58) — already stale; fix to 19 or drop the count.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Info surface renders the `(remote)` TOKEN (not `(available)`) for unfetched git plugins, so `remote` must join `PluginInfoRowBase.status`. | Info surface / notify.ts inventory | Low — RSTA-01 says `(remote)` "replaces `(available)` in list/**info**/install-completion"; D-80-04 confirms the `components: not resolved` marker stays. If the intent were "info keeps `(available)`," `PluginInfoRowBase` would not need the member. Confirm at plan/discuss if ambiguous. |
| A2 | Probe-first design (Pattern 1a) is preferred over note-sniffing for `remote` detection. | Warm-tree resolution | Low — both work; 1a is cleaner and avoids note-string coupling. Planner may choose either; flagged as Claude's-discretion-adjacent. |
| A3 | `ROW_ICONS` in grammar-invariant (line 73) needs no change because `(remote)` is info-severity and won't appear in the error/warning fixtures that test drives. | Tripwire tests | Low — verified `remote` is inventory (info, needsReload:false); if a `(remote)` row is ever added to an error fixture, `◌` must join `ROW_ICONS`. |

**Note:** A1-A3 are low-risk verification points, not open design questions. All core decisions (D-80-01..07) are locked in CONTEXT.

## Open Questions (RESOLVED)

1. **RESOLVED — consolidate (adopted in the 80-02/80-03/80-04 plans): Refactor the two inline short-circuits into the shared classifier, or patch each in place?**
   - What we know: `list.ts` and `info.ts` each carry a copy of the git short-circuit; the shared `probeManifestEntry` is the canonical one.
   - What's unclear: Whether the plan should consolidate to one decision site (cleaner, larger diff) or patch three sites (smaller diff, keeps duplication).
   - Recommendation: Consolidate `list.ts::availableRowMessage` and `info.ts::buildNotInstalledRow` to consume the shared classification so `remote` derives once. The output-parity drift-guard already assumes parity-by-construction; consolidation makes it structural.

2. **RESOLVED — gate on `makePresenceProbe` returning `materialized` (adopted in 80-04-PLAN.md): Info warm-installed component resolution scope (RSTA-04 / D-80-04).**
   - What we know: `buildNonPathInstalledRow` currently emits `componentsResolved: false` unconditionally for non-path sources.
   - What's unclear: The exact gating — installed git plugin resolves components fs-only from its materialized clone ONLY when warm; cold stays `not resolved`.
   - Recommendation: Gate on `makePresenceProbe` returning `materialized` for the installed record's source; on `materialized`, run `composeResolvedComponents(pluginRoot, resolved)` against the warm tree; else keep `componentsResolved: false`. Mirrors the not-installed warm path.

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly false in config — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥20) `[VERIFIED: CLAUDE.md + codebase]` |
| Config file | none — `node --test` (native TS strip) |
| Quick run command | `node --test tests/orchestrators/plugin/git-source-probe.test.ts` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + tests) `[VERIFIED: CLAUDE.md]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSTA-01 | not-installed git, cold cache → `remote` | unit | `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | ✅ (invert 3 tests) |
| RSTA-02 | glyph/token amendment renders + tripwires | arch | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/notify-grammar-invariant.test.ts tests/architecture/catalog-uat.test.ts` | ✅ (bump counts, flip glyphs, add fixtures) |
| RSTA-03 | shared classification + schemaVersion 5→6 + parity | unit/arch | `node --test tests/orchestrators/edge-deps.test.ts` | ✅ (drift-guard) |
| RSTA-04 | bare info resolves warm components fs-only; remote stays not-resolved | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ Wave 0 (add remote + warm cases) |
| RSTA-05 | warm tree → 3-way via resolver | unit | `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | ✅ Wave 0 (add warm-tree classification cases) |
| RSTA-06 | unpinned mirror presence classification | unit | (covered by RSTA-01/05 with mirror staging) | ✅ (79.1 primitives) |
| RSTA-07 | `list --remote` filter union + `--available` change | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ Wave 0 (add `--remote` + `--available --remote` cases) |

### Sampling Rate
- **Per task commit:** the touched suite (e.g. `node --test tests/orchestrators/plugin/git-source-probe.test.ts`)
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/orchestrators/plugin/git-source-probe.test.ts` — invert 3 `(available)` tests → `(remote)`; add warm-mirror + warm-per-sha 3-way cases (RSTA-01/05/06)
- [ ] `tests/orchestrators/plugin/list.test.ts` — `--remote` bucket, `--available` no longer includes unfetched git, `--available --remote` restores old set (RSTA-07)
- [ ] `tests/orchestrators/plugin/info.test.ts` — `(remote)` row (not-resolved), warm not-installed 3-way, warm installed component resolution (RSTA-04)
- [ ] `tests/architecture/notify-closed-set-locks.test.ts` — length bumps 23→24, 18→19 (RSTA-02)
- [ ] `tests/architecture/notify-grammar-invariant.test.ts` — `◌`→`◍` in `WILL_TOKEN_RE` + `DISABLED_TOKEN_RE` (RSTA-02)
- [ ] `tests/architecture/catalog-uat.test.ts` — new `(remote)` `FIXTURES` entries + flip disabled fixtures' glyph bytes (RSTA-02)
- [ ] `tests/orchestrators/edge-deps.test.ts` — parity: bucketizer emits `remote` at parity with list; schemaVersion drop+rebuild (RSTA-03)

## Security Domain

> `security_enforcement` not explicitly false — section included, scoped to this phase's surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase (fetch auth is Phase 81 FTCH-06) |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | Manifest entries already validated by `PLUGIN_ENTRY_VALIDATOR`/typebox upstream; cache reads validated by `PLUGIN_INDEX_VALIDATOR` (Compile) — the schemaVersion bump preserves this gate |
| V6 Cryptography | no | SHA usage (clone keys) is content-addressing, unchanged this phase |

### Known Threat Patterns for this surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via warm-tree component resolution | Tampering | NFR-10 containment: `assertPathInside` already guards `composeResolvedComponents` derivations; git-subdir containment is the presence-probe/resolver's responsibility (D-77-03), untouched |
| Network egress from a "read-only" surface | Info disclosure / policy violation | NFR-5 network-free gate — `no-orchestrator-network.test.ts` greps `list.ts`, `info.ts`, `edge-deps` for `gitOps`; the presence probe never spawns git. Keep the composition importing only `makePresenceProbe` + `resolveStrict`, never `platform/git` |
| Stale cache serving wrong classification | Tampering (indirect) | schemaVersion 5→6 drop+rebuild + 10-min TTL |

**The load-bearing security invariant:** the entire classification path stays network-free (NFR-5). The `makePresenceProbe` + `resolveStrict` composition must NOT introduce any `gitOps`/`platform/git` import into `list.ts`, `info.ts`, or `edge-deps.ts`, or the `no-orchestrator-network.test.ts` gate (greps these exact files, line 57-71) fails. `git-source-probe.ts` is already fs-only by construction and is safe to import from those surfaces.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Node ≥20.19.0; TypeScript strict.
- **Discriminated `installable: true | false`** resolver union preserved (NFR-7) — `remote` derives at classification layer, no fourth arm.
- **Atomic file ops** (NFR-1) — cache writes use `atomicWriteJson` (already atomic); schemaVersion bump rides existing path.
- **Recovery = `/reload`, no restart** (NFR-2); all ops idempotent/fail-clean (NFR-3).
- **Network policy (NFR-5):** `list` (incl. `--remote`), `info`, all RSTA classification MUST NOT touch the network.
- **Containment (NFR-10):** no writes outside sanctioned roots; warm-tree reads guarded by `assertPathInside`.
- **`npm run check` must stay green** (NFR-6) — the phase gate.
- **Output channel (IL-2):** all user-visible messages via `ctx.ui.notify`; no direct stdout/stderr.
- **Comment policy** (`.claude/rules/typescript-comments.md`): decision/requirement IDs (`D-80-01`, `RSTA-01`, `NFR-5`) allowed; NO phase/plan/wave refs. Strip historical narrative, keep traceability IDs.
- **Git:** never commit to main; feature branch under `features/*`; `pre-commit run --all-files` before commit; Conventional Commits.

## Sources

### Primary (HIGH confidence — verified in-session against live source)
- `extensions/pi-claude-marketplace/shared/notify.ts` — STATUS_TOKENS (211), PLUGIN_STATUSES (400), ICON_DISABLED (1452), variant defs (640-760), renderer switches (2120-2238, 3042-3064), PluginInfoRowBase (1196-1210)
- `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` — probeManifestEntry (159-178), makePresenceProbe (110-141), probeUpgradeCandidate (191-205)
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` — ManifestEntryClassification (53), classifyManifestEntry (167-178)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — FilterBucket (135), shouldShow (191-234), availableRowMessage git short-circuit (534-552), sortPluginsInBlock switch (1054-1096)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — isGitSource (131-133), buildGitNotInstalledRow (1038-1052), buildNotInstalledRow (1060-1078), buildNonPathInstalledRow (862-880)
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` — classifyNotInstalledPluginRow (116-132), loadManifestForMarketplace (173-223)
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` — PLUGIN_INDEX_CACHE_SCHEMA schemaVersion 5 (85-107), writers (338, 353), PluginIndexRow (113-126)
- `extensions/pi-claude-marketplace/edge/completions/data.ts` — INSTALL_STATUSES (63), PARTIAL_INSTALL_STATUSES (70)
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` — BOOLEAN_FLAGS (24), spread (74-77)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — git arm not-cached→unavailable (666-681), ResolveContext (267-278)
- `tests/architecture/notify-closed-set-locks.test.ts` (35-49), `notify-grammar-invariant.test.ts` (73, 238, 247), `notify-stamp-coverage.test.ts` (55-67), `catalog-uat.test.ts` (77-100, 280, 3728, 3970), `no-orchestrator-network.test.ts` (57-71)
- `tests/orchestrators/plugin/git-source-probe.test.ts` (51-95, 110-144) — the three tests that invert + the warm-mirror recipe
- `docs/output-catalog.md` (10-38, 136-147, 322-346), `docs/messaging-style-guide.md` (41-58)
- `.planning/workstreams/url-source/phases/80-.../80-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`

### Secondary / Tertiary
- None — no external sources consulted; this is a fully in-repo phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external deps; all in-repo modules read directly.
- Architecture / classification seam: HIGH — three short-circuit sites and the resolver mapping verified by reading source.
- Closed-set amendment inventory: HIGH — every tuple, glyph, renderer arm, tripwire, and catalog site located by line number.
- Pitfalls: HIGH — each backed by a specific file:line and the precedent amendment (`disabled`/`partially-available`).

**Research date:** 2026-07-14
**Valid until:** ~2026-08-13 (stable in-repo domain; only invalidated by concurrent edits to notify.ts/list.ts/info.ts/git-source-probe.ts)

# Phase 80: Remote status, glyph reassignment & warm-cache resolution - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 13 (all modified; no new source files)
**Analogs found:** 13 / 13 (all in-repo; the `partially-available` USTAT-02/D-64-01 amendment is a self-documenting precedent for the token/glyph half)

> This phase is codebase-internal: no new files, no external deps. Every "analog"
> is an existing pattern *inside the same file being edited* — a prior closed-set
> amendment arm or the `probeUpgradeCandidate` composition template. The primary
> analog for the whole token/glyph half is the **`partially-available`
> (USTAT-02 / D-64-01)** amendment, whose inline `USTAT-02 / D-64-01` comments mark
> every site a new token touches. The secondary analog is the **`disabled`
> (D-54-01 / ENBL-02)** amendment (glyph constant + grammar-invariant regex).
> RESEARCH.md already carries the authoritative per-line inventory; this document
> maps each edit to the concrete existing pattern to copy.

## File Classification

| Modified File | Role | Data Flow | Closest Analog (in-file or sibling) | Match Quality |
|---------------|------|-----------|-------------------------------------|---------------|
| `shared/notify.ts` | renderer / closed-set authority | transform | `partially-available` amendment arms (same file) | exact |
| `orchestrators/plugin/git-source-probe.ts` | orchestrator (classifier) | transform | `probeUpgradeCandidate` (same file, lines 191-205) | exact |
| `orchestrators/plugin/plugin-state-classifier.ts` | orchestrator (union) | transform | `ManifestEntryClassification` (`partially-available` member add) | exact |
| `orchestrators/plugin/list.ts` | orchestrator (row builder + filter) | request-response | `availableRowMessage` + `FilterBucket` `partially-available` arm | exact |
| `orchestrators/plugin/info.ts` | orchestrator (row builder) | request-response | `buildNotInstalledRow` git arm + `composeResolvedComponents` | role-match |
| `orchestrators/edge-deps.ts` | orchestrator (bucketizer) | transform | `classifyNotInstalledPluginRow` (inherits automatically) | exact |
| `shared/completion-cache.ts` | config / schema | CRUD (cache) | `schemaVersion` literal + status union | exact |
| `edge/completions/data.ts` | edge (filter) | request-response | `INSTALL_STATUSES` set | exact |
| `edge/handlers/plugin/list.ts` | edge (flag parse) | request-response | `BOOLEAN_FLAGS` + spread pattern | exact |
| `docs/output-catalog.md` | docs (byte-normative) | — | disabled fixtures + `partially-available` legend rows | exact |
| `docs/messaging-style-guide.md` | docs | — | variant list entries | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` | test (tripwire) | — | length assertions | exact |
| `tests/architecture/notify-grammar-invariant.test.ts` | test (tripwire) | — | `DISABLED_TOKEN_RE` / `WILL_TOKEN_RE` | exact |
| `tests/architecture/catalog-uat.test.ts` | test (byte-equality) | — | `FIXTURES[section][state]` disabled entry | exact |
| `tests/orchestrators/plugin/git-source-probe.test.ts` | test (unit) | — | warm-mirror staging recipe (lines 110-144) | exact |

## Pattern Assignments

### `shared/notify.ts` (renderer, transform)

**Analog:** the `partially-available` (USTAT-02 / D-64-01) amendment, which touched exactly the same set of sites and left inline `USTAT-02 / D-64-01` markers. Copy its shape for `remote`; the ONLY structural difference is `remote` carries NO `reasons` (it is bare like `available`, per D-80-03), whereas `partially-available` carries required `reasons`.

**Closed-set tuple append pattern** (STATUS_TOKENS 211-250, PLUGIN_STATUSES 400-460): the `partially-available` member is appended LAST with a block comment stating the `Extract<PluginStatus, ...>` coupling. `remote` copies this exactly — append last (D-80-06, below the reload-hint window), same comment discipline, join BOTH tuples.

**Message variant pattern** — model `PluginRemoteMessage` on `PluginAvailableMessage`, NOT on `PluginPartiallyAvailableMessage` (lines 723-734), because `remote` has no `reasons` and no `partialHint`:
```typescript
// PluginPartiallyAvailableMessage (723-734) is the STRUCTURAL sibling but carries
// reasons+partialHint; strip those for remote. Keep: status literal, name,
// optional version, optional description, NO scope (SNM-11 carve-out).
export interface PluginPartiallyAvailableMessage extends MessageBase {
  readonly status: "partially-available";
  readonly name: string;
  readonly reasons: readonly ContentReason[];  // <- remote OMITS this
  readonly version?: string;
  readonly description?: string;
  readonly partialHint?: boolean;               // <- remote OMITS this
}
```

**Renderer-arm pattern** (plugin-row switch, `partially-available` arm at 2140-2152) — clone this arm, swap glyph `ICON_PARTIALLY_AVAILABLE`→`ICON_REMOTE`, token `(partially-available)`→`(remote)`, and DROP the `composeReasons(...)` line (bare row):
```typescript
case "partially-available":
  // SNM-11 carve-out: NO scope? field, so the scope bracket is omitted.
  return joinTokens([
    ICON_PARTIALLY_AVAILABLE,
    p.name,
    renderScopeBracket(undefined, mpScope),
    renderVersion(p.version),
    "(partially-available)",
    composeReasons(p.reasons, false, false, probe),  // <- remote DROPS this line
  ]);
```

**Glyph-constant pattern** (line 1452 `ICON_DISABLED = "◌"`): reassign to `"◍"` (U+25CD, D-80-01) and add a sibling `export const ICON_REMOTE = "◌";` (U+25CC) near the other ICON_ constants. `will disable` / `disabled` renderer arms consume `ICON_DISABLED` through the constant, so the glyph flows through with no arm-code change.

**assertNever sites** (2235 plugin-row, 3060 `pluginInfoStatusGlyph`) — each needs a `case "remote":`. `pluginInfoStatusGlyph` (3042-3064) returns `ICON_REMOTE`. `PluginInfoRowBase.status` (1202-1210) gains `| "remote"` in its `Extract` list (A1: info renders `(remote)`, not `(available)`).

---

### `orchestrators/plugin/git-source-probe.ts` (orchestrator, transform)

**Analog:** `probeUpgradeCandidate` (lines 191-205, same file) — the exact `makePresenceProbe` + `resolveStrict` composition template.

**Current short-circuit to REPLACE** (`probeManifestEntry`, 159-178):
```typescript
export async function probeManifestEntry(
  entry: ManifestEntry,
  marketplaceRoot: string,
  _locations: ScopedLocations,   // <- becomes `locations` (currently unused)
): Promise<ManifestEntryClassification> {
  const parsedSource = parsePluginSource(entry.source);
  if (parsedSource.kind === "url" || parsedSource.kind === "git-subdir" || parsedSource.kind === "github") {
    return "available";          // <- RSTA-01: the over-claim to replace
  }
  try {
    return classifyManifestEntry(await resolveStrict(entry, { marketplaceRoot }));
  } catch { return "unavailable"; }
}
```

**Composition template to copy** (`probeUpgradeCandidate`, 196-204) — build the `ResolveContext` with the injected presence probe. For `remote` derivation use Pattern 1a (probe-first, RESEARCH recommendation): call `makePresenceProbe(locations)(parsedSource)` directly; `{ kind: "not-cached" }` → return `"remote"`; `{ kind: "materialized" }` → `classifyManifestEntry(await resolveStrict(entry, ctx))` for the 3-way:
```typescript
const ctx: ResolveContext = {
  marketplaceRoot,
  resolveGitPluginRoot: makePresenceProbe(locations),
};
try {
  return await resolveStrict(entry, ctx);
} catch { return undefined; }
```

---

### `orchestrators/plugin/plugin-state-classifier.ts` (orchestrator, union)

**Analog:** the `partially-available` member add on `ManifestEntryClassification` (line 53). Add `"remote"` the same way. The `classifyManifestEntry` `assertNever` (line 176) does NOT change — `remote` derives OUTSIDE the resolver switch (NFR-7; resolver stays 3-way).

---

### `orchestrators/plugin/list.ts` (orchestrator, request-response)

**Analog:** `availableRowMessage` (513-552, its own inline git short-circuit) + `FilterBucket` `partially-available` arm.

**Second inline short-circuit to REPLACE** (534-552) — mirrors the `probeManifestEntry` change; route through the shared presence-derived classification, emitting `PluginRemoteMessage` on `not-cached`:
```typescript
const parsedSource = parsePluginSource(manifestEntry.source);
if (parsedSource.kind === "url" || parsedSource.kind === "git-subdir" || parsedSource.kind === "github") {
  return { message: { status: "available", name: manifestEntry.name, ... }, bucket: "available" };
}
```
RESEARCH Open Question 1 recommends CONSOLIDATING this to consume the shared classifier so `remote` derives once (parity-by-construction). Return type union at 517 gains `PluginRemoteMessage`.

**FilterBucket + shouldShow pattern** (135, 191-234): `FilterBucket` gains `"remote"`; `shouldShow` gains an `opts.remote === true && status === "remote"` arm modeled on the `available` arm at 215; `opts` gains `remote?`. `sortPluginsInBlock` `scopeOf` switch `assertNever` (~1088) gains `case "remote":` returning `marketplaceScope` (no scope field), alongside `available | unavailable | partially-available`.

---

### `orchestrators/plugin/info.ts` (orchestrator, request-response)

**Analog:** `buildNotInstalledRow` / `isGitSource` git arm (third inline short-circuit, ~1060-1078) + `composeResolvedComponents` (521) for the warm-resolution half.

**Change:** `not-cached` → `(remote)` row with `componentsResolved: false` (existing marker wording preserved, D-80-04). Warm → resolve fs-only via `resolveStrict` + `composeResolvedComponents(pluginRoot, resolved)` against the warm tree, then classify 3-way. Installed warm case (`buildNonPathInstalledRow`, 862-880) gates on `makePresenceProbe` returning `materialized` before resolving components (RESEARCH Open Question 2 recommendation). **Do not import `platform/git`** — only `makePresenceProbe` + `resolveStrict` (NFR-5 gate `no-orchestrator-network.test.ts` greps this file).

---

### `orchestrators/edge-deps.ts` (orchestrator, transform)

**Analog:** `classifyNotInstalledPluginRow` (116-132) consuming `probeManifestEntry`. **No local change** — inherits `remote` automatically once the shared probe returns it. Plan step is VERIFICATION only (parity drift-guard in `tests/orchestrators/edge-deps.test.ts`).

---

### `shared/completion-cache.ts` (config, CRUD)

**Analog:** the existing `schemaVersion` literal + status union. Bump `Type.Literal(5)`→`6` (line 86) AND both writer `5 as const` sites (338, 353) — all THREE (Pitfall 6). Add `"remote"` to the schema status `Type.Union` (92) and `PluginIndexRow.status` (116). The existing drop+rebuild-on-mismatch path (D-03) auto-invalidates stale caches; no manual migration.

---

### `edge/completions/data.ts` (edge, request-response)

**Analog:** `INSTALL_STATUSES` (line 63). Grow the set to `new Set(["available", "remote"])` (D-80-05: install performs the fetch, so `remote` is a valid install target). `PARTIAL_INSTALL_STATUSES` (70) unchanged unless plan decides otherwise.

---

### `edge/handlers/plugin/list.ts` (edge, request-response)

**Analog:** `BOOLEAN_FLAGS` set (24) + the `...(filterFlags.has(...) && { ... })` spread pattern (74-77). Add `"--remote"` to the set and one spread line `...(filterFlags.has("--remote") && { remote: true })`.

---

### Test files (tripwire + byte-equality)

- **`notify-closed-set-locks.test.ts`** (41, 49): bump lengths `23→24` (STATUS_TOKENS), `18→19` (PLUGIN_STATUSES). Same edit the `partially-available` amendment made.
- **`notify-grammar-invariant.test.ts`** (238, 247): `◌`→`◍` in `WILL_TOKEN_RE` char class and `DISABLED_TOKEN_RE` anchor — the `disabled`-amendment analog (glyph embedded literally in regex, not via constant; Pitfall 2). `ROW_ICONS` (73) unchanged (`remote` is info-only; verify — A3).
- **`catalog-uat.test.ts`**: `FIXTURES[section][state]` map (280) — add `remote-...` entries carrying a `PluginRemoteMessage` NotificationMessage (paired with catalog blocks, bidirectional; Pitfall 3), and flip the two `disabled-inventory` fixtures' expected bytes `◌`→`◍`. Existing `disabled-inventory` entry at 655 is the shape template.
- **`git-source-probe.test.ts`** (51-95): INVERT the three `(available)` cold-cache tests → `(remote)` (Pitfall 4 — this is EXPECTED, not a regression). Add warm-tree cases using the warm-mirror staging recipe (110-144: `mkdir` mirrorDir, `git.init`, commit → probe returns `materialized`).

---

## Shared Patterns

### Closed-set token amendment (the load-bearing cross-cutting pattern)
**Source:** `partially-available` (USTAT-02 / D-64-01) amendment across `notify.ts`, tripwire tests, catalog, style guide.
**Apply to:** RSTA-01/02/03 — Wave A, ONE atomic green commit.
Discipline: append LAST in both tuples with the `Extract` coupling comment; bump the length tripwires in the SAME commit; add every renderer `switch` + `assertNever` arm (compile-time gate forces completeness); add paired catalog block + `FIXTURES` entry; update the style-guide variant list. Traceability IDs only (`D-80-01`, `RSTA-01`, `SNM-11`); no phase/plan refs (`.claude/rules/typescript-comments.md`).

### Presence-probe + resolveStrict composition
**Source:** `git-source-probe.ts::probeUpgradeCandidate` (191-205).
**Apply to:** all THREE git-source short-circuit sites (`probeManifestEntry`, `list.ts::availableRowMessage`, `info.ts::buildNotInstalledRow`) — Wave B. Consolidate to the shared classifier so `remote` derives once (parity-by-construction).

### Bare-row / no-scope carve-out (SNM-11)
**Source:** `partially-available` renderer arm (2140-2152) omitting the scope bracket; `PluginPartiallyAvailableMessage` having no `scope?` field.
**Apply to:** `PluginRemoteMessage` + its renderer arm — `renderScopeBracket(undefined, mpScope)`, no `scope?` field, and (unlike `partially-available`) NO `reasons`/`composeReasons` line (D-80-03).

### schemaVersion triple-bump
**Source:** `completion-cache.ts` three `5`-literal sites (86, 338, 353).
**Apply to:** the 5→6 bump — all three or the just-written cache fails its own validator (Pitfall 6).

### Network-free import discipline (NFR-5)
**Source:** `no-orchestrator-network.test.ts` (greps `list.ts`, `info.ts`, `edge-deps.ts` for `gitOps`/`platform/git`).
**Apply to:** the composition in `list.ts`/`info.ts` — import ONLY `makePresenceProbe` + `resolveStrict` from `git-source-probe.ts` (already fs-only); never `platform/git`.

## No Analog Found

None. Every edit maps to an existing in-repo pattern. `PluginRemoteMessage` is a NEW interface but is a structural clone of `PluginAvailableMessage` (minus scope) / `PluginPartiallyAvailableMessage` (minus reasons/partialHint), so it is not net-new territory.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{shared,orchestrators,edge}/`, `docs/`, `tests/architecture/`, `tests/orchestrators/`; git history for the `partially-available` (719605b7) and `disabled` (c695bdab) amendments.
**Files scanned:** ~15 source + test + doc files, line numbers verified against live source 2026-07-14.
**Pattern extraction date:** 2026-07-14

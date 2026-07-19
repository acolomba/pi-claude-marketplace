# Phase 66: Derived Force-State, Glyphs & Force-Upgradability - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 11 modified (no new files) + 6 test files + 1 doc
**Analogs found:** 11 / 11 (every change has an in-file or adjacent precedent)

This is a derivation/display-only phase. No new files except (optionally) a small
deriver helper. Every change EXTENDS an existing closed set, switch, deriver, or
projection. The canonical recipe is the most recent full-status addition in the
tree: the `"disabled"` token (D-54-01 / ENBL-04), which touched every site this
phase must touch. Use it as the master analog for `force-installed`; use the
existing `upgradable` arm as the master analog for `force-upgradable`.

Comment/test-title policy: use `D-66-NN` / `FSTAT-NN` / `NFR-N` / `SNM-NN` IDs
only — never GSD phase/plan references (`.claude/rules/typescript-comments.md`).

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `shared/notify.ts` (closed-set tuples) | model (closed-set) | transform | `"disabled"` token addition in same tuples | exact (in-file) |
| `shared/notify.ts` (ICON_* + render switch) | utility (renderer) | transform | `ICON_DISABLED` + `case "disabled"` / `case "upgradable"` arms | exact (in-file) |
| `shared/notify.ts` (message interfaces + union) | model | transform | `PluginDisabledMessage` / `PluginUpgradableMessage` | exact (in-file) |
| `shared/notify.ts` (`PluginWillInstallMessage.force?`) | model | transform | optional-field precedent `PluginDisabledMessage.description?`; will-arm render seam | role-match (modifier is novel) |
| `shared/notify.ts` (`PluginInfoRowBase` + glyph) | model + utility | transform | existing `Extract<PluginStatus,...>` + `pluginInfoStatusGlyph` switch | exact (in-file) |
| `shared/notify.ts` (PL-4 description filter) | utility | transform | existing 5-status description guard | exact (in-file) |
| `orchestrators/plugin/list.ts` (`installedRowMessage`) | orchestrator | CRUD/derive | the `upgradable` branch in the same function | exact (in-file) |
| `orchestrators/plugin/info.ts` (`buildInstalledRow`) | orchestrator | request-response | the non-installable arm already present at 832-850 | exact (in-file) |
| `orchestrators/plugin/install.ts` + `update.ts` (success row) | orchestrator | event-driven | success `installedRow` construction at 1391-1400 | exact (in-file) |
| `edge/handlers/tools.ts` (`projectRowStatus`) | edge/projection | transform | existing `case "installed": case "upgradable":` arm | exact (in-file) |
| `orchestrators/reconcile/notify.ts` (pending projection) | orchestrator | transform | the `will install` row push at 269-275 | exact (in-file) |

## Pattern Assignments

### `shared/notify.ts` — closed-set tuple extension (model, transform)

**Analog:** the `"disabled"` member already present in BOTH tuples.

`STATUS_TOKENS` (line 198-219, currently 20 members) — append the two realized
statuses (NOT `will force install`, which is a modifier; see Pattern Note 3):

```typescript
// shared/notify.ts:218 — append after "disabled"
  "disabled",
  "force-installed",
  "force-upgradable",
] as const;  // length 20 -> 22
```

`PLUGIN_STATUSES` (line 371-387, currently 15 members) — same two appended →
length 15 → 17. `PluginStatus = (typeof PLUGIN_STATUSES)[number]` (line 417)
picks them up automatically.

Why it is safe: the `assertNever` tail in `renderPluginRow` (line 1951) turns any
new tuple member lacking a render arm into a compile error at the switch.

### `shared/notify.ts` — glyph constants (utility, transform)

**Analog:** `ICON_DISABLED` block (lines 1275-1285) — a dedicated glyph with a
doc-comment justifying distinctness.

```typescript
// shared/notify.ts — add to the ICON block (~1285). U+25C9.
// D-66-03 / FSTAT-02: distinct from ICON_INSTALLED ("●"); marks a recorded
// plugin that currently re-resolves unsupported (force-installed).
export const ICON_FORCE_INSTALLED = "◉";
```

`force-upgradable` reuses `ICON_INSTALLED` (`●`, line 1272) — exactly as the
`upgradable` arm does — because the row is currently clean. The glyph-sharing
precedent is documented at lines 1282-1283 (`●` for installed / will install).

### `shared/notify.ts` — render-switch arms (utility, transform)

**Analog:** `case "upgradable"` (line 1879-1880, one-line `pluginRow` helper call)
for the clean-glyph force-upgradable; `case "disabled"` (line 1936-1950, full
`joinTokens` arm with its own glyph) for the new-glyph force-installed.

```typescript
// shared/notify.ts — add arms before the default/assertNever tail (1951)
    case "force-installed":
      // D-66-03 / FSTAT-02: recorded-installed but currently re-resolves
      // unsupported. New glyph ◉. Models on the "installed" arm (1808).
      return pluginRow(ICON_FORCE_INSTALLED, p, mpScope, "(force-installed)", probe);
    case "force-upgradable":
      // D-66-02 / FSTAT-04: currently clean, candidate degrades. Reuses
      // ICON_INSTALLED exactly like the upgradable arm at 1879-1880.
      return pluginRow(ICON_INSTALLED, p, mpScope, "(force-upgradable)", probe);
```

Note: choose `pluginRow(...)` vs the explicit `joinTokens([...])` form to match
whichever message shape the new interfaces carry (reasons/version/scope). The
`upgradable` arm uses `pluginRow`; the `installed` arm uses explicit `joinTokens`
to thread `dependencies`/`reasons`. Pick per the interface (next section).

### `shared/notify.ts` — message interfaces + union (model, transform)

**Analog:** `PluginUpgradableMessage` (lines 667-674) for force-upgradable;
`PluginInstalledMessage` (lines 554-562) for force-installed.

`PluginUpgradableMessage` carries `name`, REQUIRED `reasons`, optional
`version?`/`scope?`/`description?` — list-surface-only (MSG-PL-4). Model both new
interfaces on it (force-installed may want `reasons?` for the dropped-component
markers via `narrowUnsupportedKinds`; force-upgradable mirrors upgradable):

```typescript
// shared/notify.ts ~675 — model on PluginUpgradableMessage (667-674)
export interface PluginForceInstalledMessage extends MessageBase {
  readonly status: "force-installed";
  readonly name: string;
  readonly reasons: readonly ContentReason[];   // dropped-kind markers
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}
export interface PluginForceUpgradableMessage extends MessageBase {
  readonly status: "force-upgradable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}
```

Add both arms to `PluginNotificationMessage` union (lines 790-805), after
`PluginDisabledMessage`.

### `shared/notify.ts` — `will force install` modifier (model + render seam)

**Analog (optional field):** `PluginDisabledMessage.description?` (line 628).
**Analog (render seam):** the `case "will install"` arm (lines 1888-1898).

This is a MODIFIER, not a new closed-set token (Pattern Note 3). Add a boolean to
the existing interface and branch the existing arm:

```typescript
// shared/notify.ts:740-744 — add the modifier
export interface PluginWillInstallMessage extends MessageBase {
  readonly status: "will install";
  readonly name: string;
  readonly scope?: Scope;
  readonly force?: boolean;   // D-66-04 / FSTAT-06
}
```

```typescript
// shared/notify.ts:1888-1898 — branch the existing arm on p.force
    case "will install":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        p.force === true ? "(will force install)" : "(will install)",
      ]);
```

No `will force update` arm — vacuous; the reconcile plan has no update bucket
(types.ts `ReconcilePlan` 203-216; pending projection only pushes
install/uninstall/enable/disable, notify.ts 269-303). Document the absence.

### `shared/notify.ts` — info-row status set + glyph (model + utility)

**Analog:** the inlined `Extract<PluginStatus, ...>` (line 1043) and the
`pluginInfoStatusGlyph` switch (lines 2704-2718).

`force-upgradable` is LIST-only (an installed plugin's info is force-installed or
installed, never force-upgradable), so info needs only `force-installed`:

```typescript
// shared/notify.ts:1043 — widen the Extract
  readonly status: Extract<
    PluginStatus, "installed" | "available" | "unavailable" | "failed" | "force-installed"
  >;
```

```typescript
// shared/notify.ts:2706 — add arm before the assertNever tail (2715)
    case "force-installed":
      return ICON_FORCE_INSTALLED;
```

### `shared/notify.ts` — PL-4 description filter (utility, transform)

**Analog:** the 5-status description guard at lines 3172-3180.

```typescript
// shared/notify.ts:3172 — add force statuses to the description-carrying set
    (p.status === "installed" ||
      p.status === "upgradable" ||
      p.status === "available" ||
      p.status === "unavailable" ||
      p.status === "disabled" ||
      p.status === "force-installed" ||
      p.status === "force-upgradable") &&
```

### `orchestrators/plugin/list.ts` — `installedRowMessage` THE DERIVER SEAM (orchestrator, derive)

**Analog:** the branch ladder already in the function (lines 260-304): disabled
check FIRST (260), then `upgradable` (274), then `installed` (290).

The deriver inserts a force-installed check BEFORE the upgradable branch (read
`record.compatibility`), and WITHIN the upgradable branch a no-network
`resolveStrict(manifestEntry)` to split upgradable vs force-upgradable. Ordering
is load-bearing (A4): force-installed wins over force-upgradable.

```typescript
// list.ts — current upgradable predicate at 241-242 (the seam to extend)
const upgradable =
  manifestEntry?.version !== undefined && manifestEntry.version !== record.version;
```

Deriver shape (FSTAT-01: read the EXISTING persisted record, no new flag):
```
// D-66-01 — force-installed from the persisted compatibility record
if (record.compatibility.unsupported.length > 0) return force-installed row
// D-66-02 — within the upgradable branch, split via no-network resolveStrict
if (upgradable) {
  const candidate = await resolveStrict(manifestEntry, { marketplaceRoot });
  if (candidate.state === "unsupported") return force-upgradable row
  return upgradable row
}
return installed row
```

`record` type is `ExtensionState["marketplaces"][string]["plugins"][string]`
(list.ts:236). `compatibility.unsupported` is `readonly string[]` persisted at
state-io.ts:57-62. `resolveStrict` signature: `(entry, ctx) => Promise<ResolvedPlugin>`
(resolver.ts:948); `ctx` is `{ marketplaceRoot }` — see the info.ts call site at
info.ts:819. NFR-5: `resolveStrict` is the no-network resolver (guarded by
`tests/architecture/no-orchestrator-network.test.ts`).

**Async signature change:** `installedRowMessage` is currently SYNC (returns a
union directly, list.ts:232-238). Either make it `async` and `await` it in the
already-async `enumerateMarketplacePlugins` loop (the call site is list.ts:455-461;
`availableRowMessage` at 486 is already `await`ed in the same loop), OR resolve the
candidate in the caller and pass the resolved state in. Both are fine — the async
loop shape already exists.

Extend the local `PluginRenderStatus` union (line 101) to add `"force-installed"`
and `"force-upgradable"`. Do NOT extend the `shouldShow` `--installed` filter
(lines 144-147) to span force states in this phase — that is LIST-01 / Phase 67
(A3). Phase 66 makes the new statuses RENDER, not FILTER.

### `orchestrators/plugin/info.ts` — `buildInstalledRow` force-installed (orchestrator)

**Analog:** the non-installable arm ALREADY present at lines 832-850 — it resolves
`unsupported`/`unavailable` but currently keeps `status: "installed"`. The only
change is to switch the status to `force-installed` when `resolved.state ===
"unsupported"`.

```typescript
// info.ts:818-850 — current: status stays "installed" on the non-installable arm
const resolved = await resolveStrict(entry, { marketplaceRoot: mpRecord.marketplaceRoot });
if (resolved.state === "installable") { /* status: "installed" + components */ }
// non-installable arm (832): currently status "installed"; FSTAT-07: when
// resolved.state === "unsupported", emit status "force-installed" instead.
const fields = await buildNonInstallableRowFields(resolved, entry, ...);
return { status: "installed", name: pluginName, ...fields };  // <- branch to force-installed
```

Dropped-component detail already routes through the marker family
(`narrowUnsupportedKinds`, probe-classifiers.ts:146-160) used at info.ts:52 — do
not build a new `{kind→reason}` map. Keep `unavailable` on `installed` (D-64-05);
only `unsupported` becomes `force-installed`.

### `orchestrators/plugin/install.ts` + `update.ts` — success row (orchestrator)

**Analog:** the success `installedRow` construction at install.ts:1391-1400.

```typescript
// install.ts:1391 — current success row is unconditional "installed"
const installedRow: PluginInstalledMessage = {
  status: "installed",
  name: plugin,
  dependencies,
  version: installCtx.version,
  ...(reasons.length > 0 && { reasons }),
  severity: "info",
  needsReload: true,
};
```

FSTAT-07: when `installCtx.resolved.state === "unsupported"`, construct a
`force-installed` row instead (the orchestrator already holds the live
`resolved.state` — no re-derivation). `update.ts` mirrors this on its candidate
`resolved.state` (force gate at update.ts:735-745). Note: decide whether
`force-installed` belongs in the realized-transition stamp set — see Shared
Patterns / stamp-coverage below.

### `edge/handlers/tools.ts` — `projectRowStatus` (edge, transform)

**Analog:** the `case "installed": case "upgradable": return "installed";` arm at
lines 164-166.

```typescript
// tools.ts:164 — both force states flatten to the installed tool surface
    case "installed":
    case "upgradable":
    case "force-installed":
    case "force-upgradable":
      return "installed";
```

The exhaustive switch ends in a `throw` over the unreachable cascade statuses
(lines 186-188) — adding the two `PLUGIN_STATUSES` members without an arm here is
a typecheck failure (the switch is exhaustive over
`PluginNotificationMessage["status"]`).

### `orchestrators/reconcile/notify.ts` — pending `will force install` (orchestrator)

**Analog:** the plain `will install` row push at lines 269-275.

```typescript
// reconcile/notify.ts:269-275 — current push (no force modifier)
for (const o of plan.pluginsToInstall) {
  const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
  block.plugins.push({ status: "will install", name: o.plugin });
}
```

FSTAT-06: when the planned install candidate resolves `unsupported` (no-network
`resolveStrict` of the install candidate), set `force: true` on the pushed row.
`PlannedPluginInstall` (types.ts:79-84) carries `scope`/`plugin`/`marketplace`/
`configSource` — the resolve needs the manifest entry + marketplaceRoot, resolved
in this loop (mirror the list deriver's no-network resolve). Open Question 2 in
RESEARCH.md: this is PREVIEW-only token derivation; do not expand reconcile-apply
scope.

## Shared Patterns

### Closed-set extension recipe (the canonical lockstep)
**Source / master analog:** the `"disabled"` token (D-54-01) — search the tree for
its sites. It touched: `STATUS_TOKENS`, `PLUGIN_STATUSES`, a new `ICON_*`, a new
`PluginXxxMessage` interface, the union, the `renderPluginRow` arm, the PL-4
description filter, `PluginInfoRowBase` (via glyph), and the closed-set tripwire.
**Apply to:** every notify.ts change above. Land the tuple bump + render arms +
every coupled test + any catalog example in ONE green commit (65.1 precedent,
commit 5e102920), or the catalog-UAT byte gate and the tripwire go RED between
commits.

### Exhaustiveness enforcement (`assertNever`)
**Sources:** `renderPluginRow` tail (notify.ts:1951), `pluginInfoStatusGlyph` tail
(notify.ts:2715), `projectRowStatus` throw tail (tools.ts:186-189).
**Apply to:** every render/projection site. Let `npm run typecheck` enumerate any
missed arm — the error reads `Argument of type '"force-installed"' is not
assignable to parameter of type 'never'`.

### Stamp-coverage (decide force-installed's transition membership)
**Source:** `tests/architecture/notify-stamp-coverage.test.ts:55-61` —
`TRANSITION_STATUS_LIST ... satisfies readonly PluginStatus[]`. This is a
`satisfies` pin, NOT an exhaustive switch, so adding `force-installed` /
`force-upgradable` to `PLUGIN_STATUSES` does NOT break it automatically.
**Decision for planner:** the install/update SUCCESS cascade emits `force-installed`
with `severity: "info"` + `needsReload: true` (a realized transition). If so,
`force-installed` should JOIN `TRANSITION_STATUS_LIST` (line 55) so the stamp
invariant covers it; `force-upgradable` is list-inventory only (`needsReload:
false`) and stays out.

### Dropped-component markers (don't hand-roll)
**Source:** `narrowUnsupportedKinds` (probe-classifiers.ts:146-160) — maps
`lspServers`→`lsp`, else `unsupported source`, dedup-ordered. Already used at
info.ts:52 and the list resolver-narrowing path.
**Apply to:** info force-installed detail and any force-installed `reasons[]` the
list deriver populates. Cross-surface parity is by construction.

### No-network candidate resolve (don't hand-roll)
**Source:** `resolveStrict` (resolver.ts:948), `(entry, { marketplaceRoot }) =>
Promise<ResolvedPlugin>`; returns the three-way `state`. Call-site precedent:
info.ts:819.
**Apply to:** the list force-upgradable split and the reconcile pending
`will force install` derivation. Guarded by `no-orchestrator-network.test.ts`.

## Test Analogs

| New/modified test | Analog / seam | Change |
|-------------------|---------------|--------|
| `tests/architecture/notify-closed-set-locks.test.ts` | lines 33-39 (exact-length tripwires) | Bump `STATUS_TOKENS` 20→22 (line 34), `PLUGIN_STATUSES` 15→17 (line 38). `MARKETPLACE_STATUSES`=7 and `REASONS`=32 UNCHANGED. |
| `tests/architecture/notify-grammar-invariant.test.ts` | `WILL_TOKEN_RE` lines 219-220 | Widen the alternation to allow `will force install`: `(?: \(will (?:force )?install\|will (?:uninstall\|enable\|disable)\))?` (or add `force install` to the group). Add a `force: true` fixture mirroring line 175-179. |
| `tests/architecture/catalog-uat.test.ts` | `FIXTURES` map line 246; `installed`/`upgradable` fixtures at 266/274 | Add force-installed / force-upgradable `(section, state)` fixtures IN LOCKSTEP with new rows in `docs/output-catalog.md` (same commit). |
| `tests/shared/notify-v2.test.ts` | existing render byte-assertions | Assert `◉ <name> ... (force-installed)` distinct from `● ... (installed)`; assert `● ... (force-upgradable)`; assert `(will force install)`. |
| `tests/orchestrators/plugin/list.test.ts` | existing installedRowMessage cases | Deriver matrix: (compatibility.unsupported non-empty)→force-installed; (clean + candidate unsupported)→force-upgradable; (clean + candidate installable)→upgradable/installed; assert NO state write (FSTAT-01) and force-installed-never-force-upgradable (A4). |
| `tests/orchestrators/plugin/info.test.ts` | existing buildInstalledRow cases | installed+unsupported → `force-installed` row with `narrowUnsupportedKinds` markers (FSTAT-07). |
| `tests/orchestrators/reconcile/*.test.ts` | pending projection cases | `will force install` under `force:true`; assert NO update/force-update row (FSTAT-06 vacuity). |
| `docs/output-catalog.md` | existing token/glyph legend rows | Add force-installed/force-upgradable/will-force-install rows; matching FIXTURES entry required same commit (catalog-uat byte gate). |

## No Analog Found

| Item | Role | Reason |
|------|------|--------|
| `PluginWillInstallMessage.force?` render branch | modifier render | No prior boolean-modifier-on-a-will-arm exists. Closest precedent is the optional-field pattern (`PluginDisabledMessage.description?`, notify.ts:628) and the glyph-sharing comment (1282-1283). The branch itself (`p.force === true ? ... : ...`) is new but trivial; the `will install` arm at 1888-1898 is the exact seam. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{shared,orchestrators,edge,persistence,domain}`, `tests/architecture`, `tests/orchestrators`, `tests/shared`.
**Files scanned:** notify.ts (6 regions), list.ts, info.ts, install.ts, tools.ts, reconcile/notify.ts, reconcile/types.ts, state-io.ts, probe-classifiers.ts, resolver.ts, 4 test files.
**Closed-set baseline verified live:** STATUS_TOKENS=20, PLUGIN_STATUSES=15, MARKETPLACE_STATUSES=7, REASONS=32 (matches RESEARCH.md and notify-closed-set-locks.test.ts).
**Pattern extraction date:** 2026-06-27

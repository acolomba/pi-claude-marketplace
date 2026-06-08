# Phase 46: Type-Model Foundations - Research

**Researched:** 2026-06-07
**Domain:** TypeScript discriminated-union type-model refactor (self-contained, in-repo)
**Confidence:** HIGH

## Summary

Phase 46 is a pure type-model reshape of `extensions/pi-claude-marketplace/shared/notify.ts`
(plus a one-line `Scope` import) with synchronized edits to the orchestrator construction
sites and three test files. There are **no external libraries, no network, no new
dependencies** -- every claim below was verified against the live source via Read/Grep and a
green `npm run typecheck` baseline (exit 0). The work is mechanical breadth (every
`MarketplaceNotificationMessage` construction site must satisfy a tighter per-status union)
plus four focused type-shape additions (TYPE-01..04). The byte contract is locked: Phase 46
changes **zero** rendered bytes and adds **zero** catalog states.

The single hard constraint is the atomic landing (D-46-06 / NFR-6): the type changes,
the renderer dispatch changes, every construction-site edit, and every re-keyed fixture must
land in **one commit** with `npm run check` green -- there is no intermediate RED state where
the type is added before its construction sites compile. Because TYPE-02 retypes shared row
`reasons` fields and TYPE-04 converts an open-optional interface into a discriminated union,
the compiler will surface every site that needs touching; the planner's job is to make that
set exhaustive up front so the single commit compiles on the first try.

**Primary recommendation:** Add the 6th `NotificationMessage` arm
(`MarketplaceNotAddedMessage`), lift the `renderPluginInfo` `{not added}` carve-out into its
own renderer, derive `ContentReason = Exclude<Reason,"not added">` and retype the 3 row
`reasons` fields that carry content reasons, convert `MarketplaceNotificationMessage` to a
per-status discriminated union, and route all four info-kind consumers through a single
`isInfoKind` guard with `assertNever`. Drive every change to compile in one commit; prove it
with the `notify-types.test.ts` `@ts-expect-error` / arity asserts and the unchanged
`catalog-uat` byte-equality runner.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Message type model (`NotificationMessage` union, row variants) | shared/ (`notify.ts`) | -- | `notify.ts` is the documented single source of truth for the structured-notification surface (file header lines 8-41); types live beside the renderer |
| Renderer dispatch (`notify`, `dispatchInfoMessage`, per-status switch) | shared/ (`notify.ts`) | -- | SNM-17/18: grammar + dispatch live in `notify.ts` as the sole emission site |
| Exhaustiveness guard (`isInfoKind`, `assertNever`) | shared/ (`notify.ts` + `errors.ts`) | -- | `assertNever` is the repo-wide discriminated-union exhaustiveness helper (`shared/errors.ts:12`) |
| Message construction (per-status arm payloads) | orchestrators/ + import/ | -- | Orchestrators own outcome→message mapping; `notify.ts` never constructs messages |
| Byte contract / proofs | tests/ + docs/ | -- | `catalog-uat.test.ts` is the closed-loop byte gate against `docs/output-catalog.md`; `notify-types.test.ts` is the compile-time proof |

This phase touches only the shared/ type tier, the orchestrator construction tier, and the
test/doc proof tier. No domain/, persistence/, transaction/, edge/, or platform/ changes.

## Standard Stack

No external packages. The phase uses only TypeScript language features already in use
throughout `notify.ts`:

| Feature | Where used today | TYPE-* deliverable |
|---------|------------------|--------------------|
| `as const` tuple + `(typeof X)[number]` literal union | `REASONS`/`Reason` (notify.ts:69-101), `MARKETPLACE_STATUSES` (270-300) | TYPE-02 keeps `REASONS` unchanged |
| `Exclude<U, M>` utility type | not yet used in notify.ts | TYPE-02: `ContentReason = Exclude<Reason,"not added">` |
| Discriminated union on a `kind`/`status` literal | `PluginNotificationMessage` (549-560), `NotificationMessage` (777-782) | TYPE-01 (6th `kind` arm), TYPE-04 (per-status mp union) |
| Type predicate `x is T` | none in notify.ts today (consumers narrow inline) | TYPE-03: `isInfoKind(m): m is …` |
| `assertNever(x: never)` exhaustiveness tail | renderer switches (notify.ts:989, 1310, 1800, 1879, 2014, 2072, 2127) | TYPE-03/04: add to the 3 consumers + the per-status mp switch |

**No installation. No Package Legitimacy Audit needed** -- this phase installs no external
packages.

**Version verification:** N/A (no packages). Baseline `npm run typecheck` (`tsc --noEmit`)
exits 0 as of 2026-06-07.

## Architecture Patterns

### System Architecture Diagram (data flow of a notification)

```
orchestrator (e.g. plugin/info.ts, marketplace/add.ts, plugin/update.ts)
   │  constructs a NotificationMessage payload (one of 6 arms after Phase 46)
   ▼
notify(ctx, pi, message)                         [notify.ts:2089]
   │  softDepStatus(pi) probe taken once
   ├── isInfoKind(message)? ──yes──► dispatchInfoMessage(ctx, message, probe)   [2045]
   │                                    │  switch(message.kind):
   │                                    │    marketplace-info        → renderMarketplaceInfo
   │                                    │    plugin-info             → renderPluginInfo
   │                                    │    marketplace-info-cascade→ renderMarketplaceInfoCascade
   │                                    │    plugin-info-cascade     → renderPluginInfoCascade
   │                                    │    marketplace-not-added   → renderMarketplaceNotAdded  ◄── NEW (TYPE-01)
   │                                    │    default → assertNever
   │                                    ▼  computeSeverity(message) → ctx.ui.notify(body, sev?)
   │
   └── cascade arm (kind undefined|"cascade") ──► per-marketplace block render
          │  renderMpHeader(mp) switch(mp.status):                  [917]
          │    added/removed/updated/failed/autoupdate*/skipped/undefined
          │    ── TYPE-04 makes each case narrow to exactly one arm + assertNever tail
          ▼  composeMarketplaceBlock → renderPluginRow per plugin
          ▼  computeSeverity / shouldEmitReloadHint / buildSummaryLine
          ▼  ctx.ui.notify(summarized, sev?)
```

### Pattern 1: 6th union arm carrying only rendered fields (TYPE-01 / D-46-01)

**What:** A new top-level `NotificationMessage` arm with a REQUIRED `kind` discriminator and
only the fields the bare row renders.
**When to use:** the `{not added}` marketplace-not-present condition (info today; install/
uninstall/reinstall/update reuse it in Phases 47-48).
**Shape (per D-46-01, name at executor discretion):**
```typescript
export interface MarketplaceNotAddedMessage {
  readonly kind: "marketplace-not-added";
  readonly name: string;      // carries the MARKETPLACE name
  readonly scope?: Scope;     // present ⇒ [scope] bracket; absent ⇒ no bracket
}
```
Add to the union (notify.ts:777-782), making it the 6th arm:
```typescript
export type NotificationMessage =
  | CascadeNotificationMessage
  | MarketplaceInfoMessage
  | PluginInfoMessage
  | MarketplaceInfoCascadeMessage
  | PluginInfoCascadeMessage
  | MarketplaceNotAddedMessage;   // 6th arm (D-46-07)
```

### Pattern 2: lifted carve-out renderer (TYPE-01 / D-46-01a)

**What:** Move the `renderPluginInfo` `{not added}` body (notify.ts:1964-1977) into a
dedicated file-private `renderMarketplaceNotAdded(message, probe)` that reuses
`joinTokens`, `ICON_UNINSTALLABLE`, `renderVersion`, `composeReasons` unchanged. The lifted
body composes the byte-identical row:
```
⊘ <name> [scope?] (failed) {not added}
```
Source carve-out to lift (verified current text, notify.ts:1969-1976):
```typescript
return joinTokens([
  ICON_UNINSTALLABLE,
  plugin.name,
  plugin.scope === undefined ? "" : `[${plugin.scope}]`,
  renderVersion(plugin.version),   // variant has no version ⇒ pass undefined ⇒ ""
  "(failed)",
  composeReasons(plugin.reasons, false, false, probe),  // reasons is the literal ["not added"]
]);
```
The new renderer hard-codes `{not added}` via `composeReasons(["not added"], false, false,
probe)` (or an equivalent literal) -- there is no `reasons` field on the variant. The `version`
slot collapses to `""` because the variant carries no version (matches today: the carve-out's
`plugin.version` is always undefined on this path). **After lifting, delete the carve-out `if`
block from `renderPluginInfo`** so the predicate no longer special-cases `["not added"]`.

### Pattern 3: structural-reason `Exclude` (TYPE-02 / D-46-02)

```typescript
export type ContentReason = Exclude<Reason, "not added">;
```
Retype the 3 row fields that carry content reasons from `readonly Reason[]` to
`readonly ContentReason[]` (see "Don't Hand-Roll" + the exact list below). `REASONS` stays the
29-member tuple; `Reason` unchanged; the `REASONS.length === 29` lock (`notify-types.test.ts`
`_l4`) and the `"not added" extends Reason` membership assert (`_l4b`) are untouched.

### Pattern 4: per-status marketplace discriminated union (TYPE-04 / D-46-03)

**What:** Replace the single open-optional `MarketplaceNotificationMessage` interface
(notify.ts:580-587) with a union of one arm per `MarketplaceStatus` plus a list/inventory arm
(status omitted). Common fields `name`/`scope`/`plugins` on every arm; `reasons:
readonly ContentReason[]` ONLY on the `skipped` arm; `details?: MarketplaceDetails` ONLY on
the list/inventory arm. The `renderMpHeader` switch (917-993) then narrows to exactly one arm
per case; the existing `assertNever(mp.status)` default tail (989) stays.

Arm sketch (names at executor discretion per D-46-03 / Claude's Discretion):
```typescript
interface MpCommon { readonly name: string; readonly scope: Scope;
                     readonly plugins: readonly PluginNotificationMessage[]; }
interface MpAdded   extends MpCommon { readonly status: "added"; }
interface MpRemoved extends MpCommon { readonly status: "removed"; }
interface MpUpdated extends MpCommon { readonly status: "updated"; }
interface MpFailed  extends MpCommon { readonly status: "failed"; }          // NO reasons (D-46-03a)
interface MpAutoOn  extends MpCommon { readonly status: "autoupdate enabled"; }
interface MpAutoOff extends MpCommon { readonly status: "autoupdate disabled"; }
interface MpSkipped extends MpCommon { readonly status: "skipped";
                                       readonly reasons?: readonly ContentReason[]; }
interface MpList    extends MpCommon { readonly status?: undefined;          // list/inventory arm
                                       readonly details?: MarketplaceDetails; }
export type MarketplaceNotificationMessage =
  | MpAdded | MpRemoved | MpUpdated | MpFailed
  | MpAutoOn | MpAutoOff | MpSkipped | MpList;
```
**Critical narrowing note:** The `skipped` arm keeps `reasons` OPTIONAL (`reasons?`) -- the
autoupdate orchestrator constructs `skipped` rows both with reasons (idempotent flips) and the
mp-update no-op constructs `skipped` with `reasons: ["up-to-date"]`; `allBenign(undefined)`
already returns false, and `computeSeverity` arm 4 reads `mp.reasons` on the skipped arm. Keep
it optional to avoid forcing a reasons field onto every skipped construction. The `MpList` arm
must allow `status` to be absent; model it as `status?: undefined` (TS narrows
`mp.status === undefined` to this arm in the renderer's `case undefined:` at 966).

### Pattern 5: single `isInfoKind` guard (TYPE-03 / D-46-04)

**What:** One type-predicate enumerating the **5 standalone-rendered kinds** in exactly one
place, routed through by all four consumers, each closing with `assertNever`.
```typescript
type StandaloneKind =
  | "marketplace-info" | "plugin-info"
  | "marketplace-info-cascade" | "plugin-info-cascade"
  | "marketplace-not-added";
function isInfoKind(m: NotificationMessage): m is Extract<NotificationMessage, { kind: StandaloneKind }> {
  return m.kind === "marketplace-info" || m.kind === "plugin-info"
      || m.kind === "marketplace-info-cascade" || m.kind === "plugin-info-cascade"
      || m.kind === "marketplace-not-added";
}
```
Today three consumers use inline `||` chains over **4** kinds and lack `assertNever`
(`computeSeverity` notify.ts:1402-1408, `buildSummaryLine` 1543-1550, `shouldEmitReloadHint`
1603-1610). The fourth (`dispatchInfoMessage` 2058-2074) and the `notify()` early-dispatch gate
(2106-2114) already switch + `assertNever`. Retrofit all four to call `isInfoKind` and add the
new-arm behavior:

| Consumer | Line | New `marketplace-not-added` behavior |
|----------|------|--------------------------------------|
| `computeSeverity` | 1391 | → `"error"` (matches the carve-out's current severity, output-catalog.md:890/900) |
| `buildSummaryLine` | 1535 | → `""` (info kinds carry no summary line) |
| `shouldEmitReloadHint` | 1595 | → `false` (read-only surface) |
| `dispatchInfoMessage` | 2045 | add `case "marketplace-not-added": body = renderMarketplaceNotAdded(message, probe)` |
| `notify()` early-dispatch | 2106 | routes via `isInfoKind` → `dispatchInfoMessage` |

After routing through `isInfoKind`, the cascade-only functions (`computeSeverity`,
`buildSummaryLine`, `shouldEmitReloadHint`) narrow `message` to the cascade arm and may keep
their existing cascade bodies unchanged. Adding a future standalone kind then becomes a
compile error in `isInfoKind` (one place) + `assertNever` in `dispatchInfoMessage`.

### Anti-Patterns to Avoid
- **Re-cutting a narrow info-only variant.** D-46-01 supersedes BACKLOG #2's
  `plugin-info-scope-mismatch`; cut ONE general reusable variant.
- **Adding a new REASONS member or a two-tuple partition.** D-46-02a: `REASONS` stays the
  single 29-member tuple. `ContentReason` is a derived `Exclude`, not a second runtime tuple.
- **Putting `reasons` on the mp `failed` arm.** D-46-03a: the `failed` marketplace arm carries
  no mp-level reasons today -- the reason rides a child plugin row (e.g. update.ts:734-742).
- **Pre-staging Phase 47-48 op fixtures.** D-46-05: no anticipatory `(failed) {not added}` op
  catalog states in 46.
- **Intermediate RED.** D-46-06: type + dispatch + construction sites + fixtures in ONE commit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exhaustiveness over the 5 standalone kinds | a 4th inline `||` chain | the single `isInfoKind` guard + `assertNever` | TYPE-03 mandate; one place to extend |
| Rejecting `["not added","permission denied"]` | a render-time `length === 1` guard (today's carve-out, notify.ts:1966) | `ContentReason = Exclude<Reason,"not added">` on row fields | TYPE-02 makes the illegal mix a compile error, not a runtime guard |
| Marketplace co-occurrence (reasons-only-on-skipped, details-only-on-list) | independent optionals + comments | per-status discriminated union | TYPE-04 makes the type structurally enforce it |
| `{not added}` placeholder fields | `marketplaceScope: scope ?? "user"` + `marketplaceDetails: { autoupdate: false }` (today: marketplace/info.ts:94-95, plugin/info.ts:553-554) | the dedicated variant carrying only `name`/`scope?` | TYPE-01 deletes the unused placeholders entirely |

**Key insight:** Every TYPE-* deliverable replaces a *runtime guard or comment* with a
*compile-time constraint*. The audit's foot-guns (B-1..B-3, B-7) all stem from shapes that are
representable-but-illegal; the fix is to make them unrepresentable.

## Runtime State Inventory

This is **not** a rename/refactor of stored data -- it is a compile-time type reshape. The five
categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no on-disk state shape changes (REQUIREMENTS.md "Out of Scope": "No on-disk state shape changes"). The `not added` REASONS string is not persisted as a key. | none |
| Live service config | None -- verified: no external service, no network (NFR-5; info surfaces are read-only). | none |
| OS-registered state | None -- verified: no OS registrations involved. | none |
| Secrets/env vars | None -- verified: no secret/env names reference the message types. | none |
| Build artifacts | None -- TypeScript is type-stripped at runtime (Node native strip); no compiled artifact carries the old type names. | none |

**Nothing found in any category** -- this is a source-only type-model change. The only
"caches" to consider are the in-repo test fixtures, covered under Validation Architecture.

## Exact Current Shapes (verified line numbers, 2026-06-07)

> CONTEXT.md `canonical_refs` line refs had drifted; these are re-verified against live source.
> Note: `shared/notify.ts` is 2230 lines; the source file lives under
> `extensions/pi-claude-marketplace/shared/notify.ts` but the three test files live at the
> **repo root** under `tests/` (NOT under `extensions/...`).

| Symbol | CONTEXT.md said | Verified line(s) |
|--------|-----------------|------------------|
| `REASONS` tuple (29 members, `not added` last) | ~69 | **69-99** |
| `Reason = (typeof REASONS)[number]` | ~101 | **101** |
| `MARKETPLACE_STATUSES` (7) / `MarketplaceStatus` | -- | **270-278 / 300** |
| `MarketplaceNotificationMessage` interface | ~580 | **580-587** |
| `CascadeNotificationMessage` | -- | **609-612** |
| `PluginInfoMessage` (carries placeholder `marketplaceScope`/`marketplaceDetails`) | ~661 | **661-667** |
| `PluginInfoRowBase` (`reasons?: readonly Reason[]`) | -- | **694-701** |
| `NotificationMessage` union (5 arms today) | ~777 | **777-782** |
| `renderMpHeader` switch (+ `assertNever` tail at 989) | -- | **917-993** |
| `PluginNotificationMessage.reasons` fields (`readonly Reason[]`) | -- | unavailable 438, upgradable 453, skipped 521, failed 498, manual recovery 535 |
| `computeSeverity` (info-kind `||` chain, no assertNever) | ~1391 | **1391-1452**; info gate 1402-1411 |
| `buildSummaryLine` (info-kind `||` chain) | ~1535 | **1535-1569**; info gate 1543-1550 |
| `shouldEmitReloadHint` (info-kind `||` chain) | ~1595 | **1595-1626**; info gate 1603-1610 |
| `renderPluginInfo` `{not added}` carve-out body to lift | ~1954 / 1964-1979 | function 1954; carve-out `if` **1964-1977** (body 1969-1976) |
| `dispatchInfoMessage` switch (has assertNever) | ~2045 / 2058 | **2045-2082**; switch 2058-2074 |
| `notify()` info early-dispatch gate (has assertNever below) | ~2106 | gate **2106-2114**; cascade switch 2121-2129 |
| `assertNever(x: never)` | errors.ts:12 | **errors.ts:12-14** |
| `Scope = "user" \| "project"` | types.ts | **types.ts:16** |

### Which row types carry `reasons: Reason[]` → retype to `ContentReason[]` (TYPE-02)

Exhaustive list of fields that must change from `readonly Reason[]` to `readonly ContentReason[]`:

1. **`PluginUnavailableMessage.reasons`** -- notify.ts:438
2. **`PluginUpgradableMessage.reasons`** -- notify.ts:453
3. **`PluginSkippedMessage.reasons`** -- notify.ts:521
4. **`PluginFailedMessage.reasons`** -- notify.ts:498
5. **`PluginManualRecoveryMessage.reasons`** -- notify.ts:535
6. **`MarketplaceNotificationMessage.reasons`** (→ the new `skipped` arm's `reasons`) -- notify.ts:585
7. **`PluginInfoRowBase.reasons?`** -- notify.ts:700

**Verification that `not added` is never legitimately constructed on a content-reason row
today:** Grep confirms the ONLY two `"not added"` construction sites in the whole extension are
the two info not-added paths (`marketplace/info.ts:104`, `plugin/info.ts:559`) -- both of which
become the new variant. No `PluginFailedMessage`, `PluginSkippedMessage`, etc. ever carries
`"not added"`. So retyping rows to `ContentReason[]` breaks **zero** real construction sites.

> CONTEXT.md (D-46-02) names items 4 and 6 explicitly ("the cascade
> `PluginNotificationMessage.reasons` and the marketplace skipped-arm reasons"). The planner
> must decide whether to also tighten items 1-3, 5, 7 (all the other `Reason[]` row fields) for
> consistency. **Recommendation:** retype ALL seven. They never carry `not added` today, so
> tightening is byte-neutral and free; the cascade `PluginNotificationMessage` reasons fields
> ARE items 1-5 (the union's reason-bearing variants), and `notify-types.test.ts` proves them
> as `readonly _Reason[]` (asserts `_rrUna`/`_rrUpg`/`_rrSk`/`_rrF`/`_rrMR`). If retyped to
> `ContentReason`, those asserts may need their expected type updated -- see Validation note.

> **`composeReasons` parameter:** notify.ts:1133-1139 types its `reasons` param as
> `readonly Reason[] | undefined` and its accumulator as `Reason[]`. The soft-dep markers it
> appends (`requires pi-subagents`/`requires pi-mcp`) are `Reason` (`ContentReason`) members.
> Because the NEW variant renderer passes the literal `["not added"]` (a full `Reason`), keep
> `composeReasons`'s parameter as `Reason[]` so the not-added renderer can pass it. Row callers
> pass `ContentReason[]`, which is assignable to `Reason[]` (subtype). **No change to
> `composeReasons` signature required.**

## The 3 info construction sites to switch to the variant (D-46-05)

CONTEXT.md says "3 confirmed info construction sites." Verified enumeration:

1. **`orchestrators/marketplace/info.ts::buildNotAddedMessage`** -- lines **88-108**. Currently
   builds a `plugin-info` payload with placeholder `marketplaceScope: scope ?? "user"`
   (line 94) and `marketplaceDetails: { autoupdate: false }` (line 95). Replace its return with
   the new variant: `{ kind: "marketplace-not-added", name, ...(scope !== undefined && { scope }) }`.
   Sole caller: line 154 (the `found.length === 0` path).
2. **`orchestrators/plugin/info.ts`** -- the inline not-added branch at lines **550-562**
   (`found.length === 0`). Same placeholder pattern (`marketplaceScope: opts.scope ?? "user"`
   line 553, `marketplaceDetails: { autoupdate: false }` line 554). Replace with the variant
   carrying `name: opts.marketplace` and optional `scope: opts.scope`.
3. **"standard-path coexistence"** -- this is **not a third literal construction site**; it is
   the requirement that the new variant coexist with the standard info-dispatch paths in
   `getMarketplaceInfo` / `getPluginInfo` WITHOUT regressing them. Concretely: in
   `marketplace/info.ts::getMarketplaceInfo` the not-added emission (line 154) sits alongside
   the standard `marketplace-info` / `marketplace-info-cascade` emissions (lines 177-179) and
   the `buildManifestFailureMessage` partial-failure emissions (line 187). The dispatcher must
   route the new `marketplace-not-added` kind through `dispatchInfoMessage` so it coexists in
   the same `notify()` flow as those standard paths. **Action for the planner:** verify the
   `getMarketplaceInfo`/`getPluginInfo` orchestrators still type-check and dispatch correctly
   after the variant is added -- no new literal construction beyond sites 1 and 2.

> **Note on `buildManifestFailureMessage` (marketplace/info.ts:117-134):** This builds a
> `plugin-info` payload with `reasons: [reason]` where `reason` is a content reason (e.g.
> `unreadable manifest`), NOT `not added`. It legitimately uses the standard `plugin-info`
> header form. It does NOT switch to the new variant and is unaffected by TYPE-01. It is the
> reason `PluginInfoRowBase.reasons?` must stay `ContentReason[]` (not be removed).

## Every `MarketplaceNotificationMessage` construction site (TYPE-04 broad sweep)

This is the mechanical-but-broad sweep. Each site below constructs a marketplace block payload;
after D-46-03 each must satisfy exactly one per-status arm. **Byte-neutrality:** none of these
change rendered bytes -- they change only the static type the object must satisfy. The
"Impact" column flags whether the site needs a touch beyond recompiling.

| # | File:line | Constructed shape (status) | Target arm | Impact to stay byte-neutral |
|---|-----------|----------------------------|-----------|-----------------------------|
| 1 | `marketplace/add.ts:177-184` | `status: "added"`, `plugins: []` | `MpAdded` | none (compiles as-is) |
| 2 | `marketplace/remove.ts:292-316` | `status: "failed"`, mixed uninstalled+failed plugins | `MpFailed` | none |
| 3 | `marketplace/remove.ts:326-339` | `status: "removed"`, uninstalled plugins | `MpRemoved` | none |
| 4 | `marketplace/autoupdate.ts:176-185` | `status: "failed"`, `plugins: [failedRow]` | `MpFailed` | none |
| 5 | `marketplace/autoupdate.ts:202-211` | `status: "failed"`, `plugins: []` | `MpFailed` | none |
| 6 | `marketplace/autoupdate.ts:220` | `{ marketplaces: [] }` (empty cascade) | n/a (no mp arm) | none |
| 7 | `marketplace/autoupdate.ts:236-253` | `status: "skipped"` + `reasons` (idempotent) OR `status: "autoupdate enabled"/"disabled"` | `MpSkipped` / `MpAutoOn` / `MpAutoOff` | none; `reasons` only on skipped (already true) |
| 8 | `marketplace/list.ts:50,68-82` | status omitted, optional `details` | `MpList` | none; `details` only on list arm (already true) |
| 9 | `marketplace/update.ts:251` | `{ marketplaces: [] }` | n/a | none |
| 10 | `marketplace/update.ts:740-742` | `status: "failed"`, `plugins: [failedRow]` (NO mp reasons) | `MpFailed` | none (confirms D-46-03a) |
| 11 | `marketplace/update.ts:787-789` | `status: "skipped"`, `reasons: ["up-to-date"]`, `plugins: []` | `MpSkipped` | none |
| 12 | `marketplace/update.ts:793-795` | `status: "updated"`, `plugins: []` | `MpUpdated` | none |
| 13 | `marketplace/update.ts:810-812` | `status: "skipped"`, `reasons: ["up-to-date"]`, `plugins: []` | `MpSkipped` | none |
| 14 | `marketplace/update.ts:824-833` | `status: "updated"`, cascade plugins | `MpUpdated` | none |
| 15 | `plugin/install.ts:746-754` | status omitted (cascade failure block) | `MpList` (status absent) | none -- no status field |
| 16 | `plugin/install.ts:781-796` | status omitted, `plugins: [failed internal-error row]` | `MpList` (status absent) | none |
| 17 | `plugin/install.ts:931-939` | status omitted, `plugins: [installedRow]` | `MpList` (status absent) | none |
| 18 | `plugin/uninstall.ts:267-275` | status omitted, `plugins: [failedRow]` | `MpList` (status absent) | none |
| 19 | `plugin/uninstall.ts:301-309` | status omitted, `plugins: [failedRow]` | `MpList` (status absent) | none |
| 20 | `plugin/uninstall.ts:386-394` | status omitted, `plugins: [uninstalledRow]` | `MpList` (status absent) | none |
| 21 | `plugin/update.ts:224` | `{ marketplaces: [] }` | n/a | none |
| 22 | `plugin/update.ts:1374-1382` | status omitted, mapped cascade plugins | `MpList` (status absent) | none |
| 23 | `plugin/update.ts:1465-1473` | status omitted, `plugins: [failedRow]` (direct-fail helper) | `MpList` (status absent) | none |
| 24 | `plugin/update.ts:1602-1610` | status omitted, `plugins: [failedRow]` (synthetic placeholder) | `MpList` (status absent) | none |
| 25 | `plugin/reinstall.ts:241-243` | status omitted, `plugins: [reinstalledRow]` | `MpList` (status absent) | none |
| 26 | `plugin/reinstall.ts:294-296` | status omitted, `plugins: [failureRow]` | `MpList` (status absent) | none |
| 27 | `plugin/reinstall.ts:342-344` | status omitted, `plugins: [failedRow]` | `MpList` (status absent) | none |
| 28 | `plugin/reinstall.ts:354` | `{ marketplaces: [] }` | n/a | none |
| 29 | `plugin/reinstall.ts:590-595` | status omitted, mapped cascade plugins | `MpList` (status absent) | none |
| 30 | `plugin/list.ts:482-545` (`buildMarketplaceMessage`) | `status: "failed"` (unparseable, 502-509) OR status omitted + optional `details` (536-544) | `MpFailed` / `MpList` | none; `details` only on list arm (already true) |
| 31 | `plugin/list.ts:828-839` | status omitted, synthetic `plugins: [failedRow]` (aggregate list-failure) | `MpList` (status absent) | none |
| 32 | `import/execute.ts:467-474` | status optional (`added`/`updated`/`failed`), `reasons` optional (source-mismatch), `plugins` | per-status arm (`MpAdded`/`MpUpdated`/`MpFailed`/`MpList`) | **see note** |

**Count: 32 construction sites** (29 marketplace-block literals + 3 empty-cascade
`{ marketplaces: [] }` sentinels at #6/#9/#21/#28 -- note #6/#9/#21/#28 are 4 empty sentinels;
the 29 substantive block literals are the rest). To be precise for the orchestrator: **28
marketplace-block construction sites that build at least one `MarketplaceNotificationMessage`
object**, plus **4 empty-`marketplaces: []` sentinels** that construct no mp object. Type
references to `MarketplaceNotificationMessage` as a type annotation (not a construction) appear
additionally in `import/execute.ts:367`, `plugin/list.ts:478/555/678-679`,
`plugin/update.ts:1374`, `plugin/reinstall.ts:590`, `marketplace/list.ts:50`,
`marketplace/autoupdate.ts:236`, and `edge/handlers/tools.ts:29` (comment) -- these just need to
resolve against the new union type (they will, since the union name is unchanged).

**The one site that needs careful attention -- #32 `import/execute.ts`:** The
`MarketplaceBlock` accumulator (execute.ts:292-299) is a MUTABLE struct with independent
optional `status?` and `reasons?` fields, spread into the final object at 467-474 via
conditional spreads (`...(block.status !== undefined && { status: block.status })`,
`...(block.reasons !== undefined && { reasons: block.reasons })`). Under the new discriminated
union, the spread-built object's static type is `{ name; scope; status?; reasons?; plugins }`
-- which does NOT structurally match any single arm (the union has no arm with both optional
status AND optional reasons). **This site will likely need a small refactor** so the returned
object resolves to a concrete arm -- e.g. a `switch (block.status)` that constructs the correct
arm, or a typed reducer. This is the audit's B-6 foot-gun (mutable `MarketplaceBlock`
accumulator) surfacing as a real type obstacle. **Recommendation:** the planner should add an
explicit task to convert the execute.ts final-mapping (467-474) into a per-status arm
constructor. Note B-6's *full* cleanup (TYPE-F3, single reducer) is deferred post-v1.10; here
only the minimal change needed to satisfy the union is in scope.

> The `MpList` arm modeled as `status?: undefined` lets the many "status omitted" sites
> (#15-31) compile unchanged: an object literal with no `status` key satisfies `status?:
> undefined`. The empty `{ marketplaces: [] }` sentinels are unaffected (no mp object). Verify
> that `compareByNameThenScope({ name, scope })` calls (e.g. plugin/update.ts:1376,
> reinstall.ts:587) still type-check -- they take the structural `Sortable` minimum, so they do.

## Common Pitfalls

### Pitfall 1: `MpList` arm modeling breaks "status omitted" sites
**What goes wrong:** If the list arm is modeled with no `status` field at all (rather than
`status?: undefined`), TS may fail to narrow `case undefined:` in `renderMpHeader`, or reject
the 16 status-omitted construction sites.
**How to avoid:** model the list arm as `status?: undefined`. The renderer's existing
`case undefined:` (notify.ts:966) narrows to it; `default: assertNever(mp.status)` (989) still
guards. Verify the `mp.status === undefined` check at composeSeverity/list paths still narrows.
**Warning signs:** TS2339 "Property 'status' does not exist" or TS2345 at any
`marketplaces: [{ name, scope, plugins }]` site.

### Pitfall 2: `import/execute.ts` spread object won't satisfy the union
**What goes wrong:** the conditional-spread final object (execute.ts:467-474) types as a single
struct with independent optionals -- no union arm matches.
**How to avoid:** construct the correct arm explicitly per `block.status` (small reducer or
switch). See site #32 above.
**Warning signs:** TS2322 "Type '{...}' is not assignable to type
'MarketplaceNotificationMessage'" pointing at execute.ts.

### Pitfall 3: deleting the carve-out without deleting its predicate
**What goes wrong:** lifting `renderMarketplaceNotAdded` out but leaving the
`if (plugin.status === "failed" && plugin.reasons?.length === 1 && plugin.reasons[0] === "not
added")` block in `renderPluginInfo` (notify.ts:1964-1977) leaves dead code AND keeps
`PluginInfoRowBase.reasons` needing `"not added"` in its set -- but after retyping to
`ContentReason[]`, `plugin.reasons[0] === "not added"` becomes a type error (the literal can
no longer be a `ContentReason`).
**How to avoid:** delete the carve-out `if` block from `renderPluginInfo` as part of the same
edit that lifts the renderer. After deletion, `PluginInfoRowBase.reasons?` is safely
`ContentReason[]` (no construction site passes `not added` to it -- the two not-added sites
become the variant).
**Warning signs:** TS2367 "comparison appears unintentional" on `=== "not added"`.

### Pitfall 4: `notify-types.test.ts` arity assert not updated
**What goes wrong:** adding the 6th arm without updating `_Assert_NotifFiveArms` leaves the
union-arity proof asserting 5 arms -- it stays green but no longer proves the 6th arm exists.
**How to avoid:** per D-46-07, add `_Assert_NotifSixArms` extending the chain with
`Extract<NotificationMessage, { kind: "marketplace-not-added" }> extends never ? never : true`.
The legacy `_Assert_NotifFourArms` (line 843) may be retired or kept (Claude's Discretion).
**Warning signs:** none at compile time -- this is a *coverage* gap, caught only by review.

### Pitfall 5: `_MarketplaceMessageExpected` shape assert breaks under the union
**What goes wrong:** `notify-types.test.ts` `_Assert_MarketplaceMessageShape` (lines 234-244)
asserts `MarketplaceNotificationMessage extends _MarketplaceMessageExpected` where the expected
shape is the OLD open-optional interface. A discriminated union does NOT extend the
all-optional struct in the same way (each arm is narrower).
**How to avoid:** rewrite this assert to prove the per-status co-occurrence (TYPE-04): e.g.
assert `reasons` only on the skipped arm, `details` only on the list arm, via `Extract<…,
{ status: "skipped" }>` / `Extract<…, { status?: undefined }>` arm checks. This is the new
TYPE-04 proof the planner must add (Claude's Discretion on exact constants).
**Warning signs:** TS error in notify-types.test.ts at `_mms`.

## Code Examples

### TYPE-02 illegal-mix compile-fail proof (notify-types.test.ts, new)
```typescript
// @ts-expect-error -- TYPE-02: "not added" is NOT a ContentReason; cannot mix on a row
const _illegal: readonly ContentReason[] = ["not added", "permission denied"];
// proof that ContentReason excludes "not added":
type _Assert_NotAddedExcluded = "not added" extends ContentReason ? never : true;
export const _car: _Assert_NotAddedExcluded = true;
```

### TYPE-01 variant carries no placeholder fields (notify-types.test.ts, new)
```typescript
type _VNotAdded = Extract<NotificationMessage, { kind: "marketplace-not-added" }>;
// @ts-expect-error -- TYPE-01: variant has NO marketplaceScope placeholder
export type _NoMpScope = _VNotAdded["marketplaceScope"];
// @ts-expect-error -- TYPE-01: variant has NO marketplaceDetails placeholder
export type _NoMpDetails = _VNotAdded["marketplaceDetails"];
type _Assert_NotAddedFields = _VNotAdded extends
  { readonly kind: "marketplace-not-added"; readonly name: string; readonly scope?: _Scope }
  ? true : never;
export const _vna: _Assert_NotAddedFields = true;
```

### TYPE-04 co-occurrence proof (notify-types.test.ts, new)
```typescript
type _MpSkipped = Extract<MarketplaceNotificationMessage, { status: "skipped" }>;
type _MpList = Extract<MarketplaceNotificationMessage, { status?: undefined }>;
type _MpFailed = Extract<MarketplaceNotificationMessage, { status: "failed" }>;
// reasons only on skipped:
type _Assert_ReasonsOnSkipped = _MpSkipped["reasons"] extends readonly ContentReason[] | undefined ? true : never;
export const _mrs: _Assert_ReasonsOnSkipped = true;
// @ts-expect-error -- TYPE-04: failed mp arm has NO reasons (D-46-03a)
export type _NoReasonsOnMpFailed = _MpFailed["reasons"];
// details only on list arm:
// @ts-expect-error -- TYPE-04: skipped mp arm has NO details
export type _NoDetailsOnMpSkipped = _MpSkipped["details"];
```

### Byte-equality of lifted renderer (notify-v2.test.ts, re-keyed fixture)
```typescript
const msg: NotificationMessage = { kind: "marketplace-not-added", name: "my-mp", scope: "user" };
notify(ctx, pi, msg);
assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[0], "⊘ my-mp [user] (failed) {not added}");
assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
```

## State of the Art

| Old Approach | Current (Phase 46) Approach | Why |
|--------------|------------------------------|-----|
| `{not added}` via `plugin-info` payload + placeholder `marketplaceScope`/`marketplaceDetails` + runtime renderer carve-out | dedicated 6th `NotificationMessage` arm carrying only `name`/`scope?` | TYPE-01 / B-1 / M-5: placeholders + carve-out permitted the drift |
| `reasons: readonly Reason[]` with render-time `length === 1` guard against `["not added", ...]` | `reasons: readonly ContentReason[]`; illegal mix is a compile error | TYPE-02 / B-2 |
| `MarketplaceNotificationMessage` open-optional struct (independent `status?`/`details?`/`reasons?`) | per-status discriminated union | TYPE-04 / B-3 |
| 4 info-kind consumers each enumerating kinds via inline `||`, 3 lacking `assertNever` | single `isInfoKind` guard, all 4 with `assertNever` | TYPE-03 / B-7 |

**Deprecated/outdated after this phase:**
- The `renderPluginInfo` `{not added}` carve-out `if` block (notify.ts:1964-1977) -- deleted.
- The placeholder `marketplaceScope: scope ?? "user"` / `marketplaceDetails: { autoupdate:
  false }` at marketplace/info.ts:94-95 and plugin/info.ts:553-554 -- deleted.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "standard-path coexistence" third site is the dispatch-coexistence requirement, not a 3rd literal construction. | "3 info construction sites" | LOW -- if a 3rd literal exists, grep would have found a 3rd `"not added"` construction; only 2 exist. Planner verifies during planning. |
| A2 | `import/execute.ts` (#32) needs a small per-status-arm refactor to satisfy the union. | construction sites | MEDIUM -- confirmed structurally (conditional-spread object can't match a discriminated union), but exact refactor shape is the planner's call. If TS happens to accept it via excess-property tolerance, the refactor is still the safe path. |
| A3 | Retyping ALL 7 reason-bearing fields (not just the 2 named in D-46-02) is byte-neutral and safe. | TYPE-02 list | LOW -- verified no site constructs `not added` on any of them; D-46-02 names only items 4+6 but the others are free to tighten. Planner confirms scope. |
| A4 | Modeling `MpList` as `status?: undefined` lets all 16 status-omitted sites compile unchanged. | Pattern 4 / Pitfall 1 | LOW -- standard TS discriminated-union idiom; the renderer already has `case undefined:`. |

**This table is non-empty:** A1-A4 should be confirmed by the planner/executor during the
single-commit implementation (the compiler is the arbiter -- all four are checkable at build).

## Open Questions

1. **Exact scope of TYPE-02 retyping (2 fields vs 7 fields).**
   - What we know: D-46-02 names the cascade `PluginNotificationMessage.reasons` and the mp
     skipped-arm reasons. All 7 reason-bearing fields never carry `not added` today.
   - What's unclear: whether to tighten only the 2 named or all 7 for consistency.
   - Recommendation: retype all 7 (free, byte-neutral, closes the foot-gun uniformly); update
     the corresponding `_rr*` asserts' expected type if needed.

2. **`import/execute.ts` final-mapping refactor shape.**
   - What we know: the conditional-spread object can't satisfy a discriminated union.
   - What's unclear: switch-per-status vs typed reducer.
   - Recommendation: minimal per-status arm constructor (a `switch (block.status)` returning
     the matching arm); defer the full B-6 reducer cleanup (TYPE-F3) to post-v1.10.

3. **Retire `_Assert_NotifFourArms`?** (Claude's Discretion per D-46-07.)
   - Recommendation: keep it (cheap regression coverage) and add `_Assert_NotifSixArms`;
     optionally update `_Assert_NotifFiveArms` → six-arms or leave both.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (native TS strip / node:test) | typecheck + tests | ✓ (assumed per project baseline) | >=20.19.0 (NFR-4) | -- |
| TypeScript (`tsc --noEmit`) | `npm run typecheck` | ✓ | 5.9.x | -- |
| `npm run check` (typecheck+eslint+prettier+tests) | atomic-commit gate (NFR-6) | ✓ | -- | -- |

No external services, no network (NFR-5 preserved -- this is a type change). `npm run typecheck`
verified exit 0 at research time.

## Validation Architecture

> nyquist_validation: include (no `.planning/config.json` override found disabling it).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict`; TS via native strip |
| Config file | none (node --test) |
| Quick run command | `npm run typecheck` (the load-bearing proof for TYPE-01..04 lands at typecheck) |
| Full suite command | `npm run check` (typecheck + eslint + prettier + tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYPE-01 | dedicated `marketplace-not-added` variant; no placeholder fields; byte-identical row | compile proof + byte-equality | `npm run typecheck` (`@ts-expect-error` `_NoMpScope`/`_NoMpDetails`, `_vna`, `_Assert_NotifSixArms`) + `node --test tests/architecture/catalog-uat.test.ts` | ✅ notify-types.test.ts + catalog-uat.test.ts (add asserts; re-key fixtures) |
| TYPE-02 | `["not added","permission denied"]` unrepresentable on a row | compile-fail | `npm run typecheck` (`@ts-expect-error` `_illegal`, `_Assert_NotAddedExcluded`) | ✅ notify-types.test.ts (add asserts) |
| TYPE-03 | single `isInfoKind`; adding a kind = compile error in every consumer | compile proof + behavior | `npm run typecheck` (assertNever in all 4) + `node --test tests/shared/notify-v2.test.ts` (severity/reload-hint for the new arm) | ✅ notify-v2.test.ts (re-key + add new-arm severity/reload tests) |
| TYPE-04 | reasons only on skipped arm, details only on list arm | compile proof | `npm run typecheck` (`_mrs`, `@ts-expect-error` `_NoReasonsOnMpFailed`/`_NoDetailsOnMpSkipped`) | ✅ notify-types.test.ts (rewrite `_Assert_MarketplaceMessageShape` → per-arm proofs) |

### Sampling Rate
- **Per task commit:** N/A -- Phase 46 is ONE atomic commit (D-46-06). Run `npm run typecheck`
  iteratively while editing (it is the fastest TYPE-* signal).
- **Single commit gate:** `npm run check` must exit 0 (NFR-6).
- **Phase gate:** full `npm run check` green before `/gsd-verify-work`.

### What GREEN looks like
1. `npm run typecheck` exits 0 with all new `_Assert_*` constants = `true` and every
   `@ts-expect-error` directive consumed (an unused `@ts-expect-error` is itself a typecheck
   failure -- this is how the negative-presence proofs catch regressions).
2. `node --test tests/architecture/catalog-uat.test.ts` passes: the 4 re-keyed `{not added}`
   catalog states render byte-identically to `docs/output-catalog.md` (lines 895, 905, 1021,
   1031) via the new variant. **The catalog markdown is NOT edited** (no new states; byte forms
   unchanged).
3. `node --test tests/shared/notify-v2.test.ts` passes: the re-keyed not-added renderer tests
   assert the same `⊘ <name> [scope?] (failed) {not added}` bytes + `error` severity + no
   reload-hint.

### Fixtures to re-key (assert IDENTICAL bytes; per D-46-05)

**`tests/architecture/catalog-uat.test.ts`** -- 4 `{not added}` fixtures change from
`kind: "plugin-info"` (+ placeholder `marketplaceScope`/`marketplaceDetails` + `plugin.status:
"failed"` + `reasons: ["not added"]` + `componentsResolved: false`) to
`kind: "marketplace-not-added"` (+ `name` + optional `scope`):
- `absent-from-both` (lines **1351-1372**; under `marketplace info`) → `{ kind:
  "marketplace-not-added", name: "ghost-mp" }` (no scope ⇒ no bracket).
- `scope-mismatch-not-added` (lines **1375-1395**) → `{ kind: "marketplace-not-added", name:
  "my-mp", scope: "user" }`. **Header comment says "Anchor preserved byte-identical. DO NOT
  modify."** -- the *bytes* stay identical; the *fixture shape* changes to the variant. The
  planner must reconcile this comment (it refers to byte preservation, which holds).
- `missing-marketplace-not-added-absent-from-both` (lines **1580-1601**; under `plugin info`)
  → `{ kind: "marketplace-not-added", name: "ghost-mp" }`.
- `missing-marketplace-not-added-scope-mismatch` (lines **1603-1621**) → `{ kind:
  "marketplace-not-added", name: "ghost-mp", scope: "user" }`.
- All four keep `expectedSeverity: "error"` and their catalog-state byte blocks unchanged.

**`tests/shared/notify-v2.test.ts`** -- the Phase 42 INFO-04 not-added tests re-key to the
variant:
- "Phase 42 / INFO-04: {not added} row renders as bare column-0 plugin row…" (lines
  **2663-2688**) → construct `{ kind: "marketplace-not-added", name: "my-mp", scope: "user" }`;
  same `assert.equal(args[0], "⊘ my-mp [user] (failed) {not added}")` and `args[1], "error"`.
- "Phase 42 / INFO-04: {not added} row never carries a reload-hint…" (lines **2690-2715**) →
  same re-key; assert no `/reload`.
- The OTHER plugin-info / plugin-info-cascade fixtures in notify-v2 (e.g. 2784, 2830, 3064+)
  are standard `plugin-info` rows that do NOT use `["not added"]` -- they stay `plugin-info` and
  are unaffected by TYPE-01 (they exercise the standard header path / `buildManifestFailureMessage`-style rows).

**`tests/architecture/notify-types.test.ts`** -- additive + one rewrite:
- ADD: `ContentReason` exclusion proof, variant no-placeholder proofs, 6-arm arity
  (`_Assert_NotifSixArms`), per-status co-occurrence proofs (the code examples above).
- REWRITE: `_Assert_MarketplaceMessageShape` (lines 234-244) from the open-optional
  `_MarketplaceMessageExpected` struct to per-arm `Extract` proofs (Pitfall 5).
- KEEP UNCHANGED: `_Assert_ReasonsLen` (`_l4`, REASONS===29, line 654) and `_Assert_NotAddedMember`
  (`_l4b`, line 657) -- D-46-02a forbids touching these.
- The `_rr*` reason-required asserts (lines 423-444) currently assert `extends readonly
  _Reason[]`; if rows are retyped to `ContentReason`, verify whether `ContentReason[] extends
  Reason[]` keeps these green (it does -- `ContentReason` is a subtype of `Reason`), so they may
  stay; tighten to `ContentReason[]` only if proving the exclusion at the row level is desired.

### Wave 0 Gaps
- None -- all three test files exist and the byte-equality runner + type-proof harness are
  already in place. Phase 46 ADDS asserts and RE-KEYS fixtures within them; no new test
  infrastructure, no framework install.

## Project Constraints (from CLAUDE.md)

- **TypeScript strict; discriminated `installable` union** -- the new variant + per-status mp
  union follow the same discriminated-union discipline (NFR-7 spirit).
- **All user-visible output via `ctx.ui.notify` through `shared/notify.ts`** (IL-2) -- the new
  renderer dispatches through the existing single `notify()` site; the eslint per-file override
  (`eslint.config.js:139-143`) keeps `no-restricted-syntax` off only for `notify.ts`.
- **English-only (IL-1), no telemetry (IL-4)** -- unaffected; no strings change.
- **`npm run check` must stay green** (NFR-6) -- the atomic-commit gate (D-46-06).
- **NFR-5 (no network on info/list/etc.)** -- preserved; this is a type change with zero I/O.
- **Git: never commit to main; conventional commits; `pre-commit run` before commit;
  `SKIP=trufflehog` only inside worktrees.** -- the orchestrator owns the commit (this research
  writes no commits).

## Sources

### Primary (HIGH confidence -- live source verified 2026-06-07)
- `extensions/pi-claude-marketplace/shared/notify.ts` (full read, 2230 lines) -- all type
  shapes, renderer switches, consumer functions, line numbers.
- `extensions/pi-claude-marketplace/shared/types.ts:16` -- `Scope`.
- `extensions/pi-claude-marketplace/shared/errors.ts:12` -- `assertNever`.
- `orchestrators/marketplace/{info,add,remove,autoupdate,list,update}.ts`,
  `orchestrators/plugin/{info,install,uninstall,update,reinstall,list}.ts`,
  `orchestrators/import/execute.ts` -- every construction site read at the cited lines.
- `tests/architecture/notify-types.test.ts`, `tests/architecture/catalog-uat.test.ts`,
  `tests/shared/notify-v2.test.ts` -- proof harness + fixtures.
- `docs/output-catalog.md:880-906, 1010-1032` -- byte contract for the 4 `{not added}` states.
- `eslint.config.js:90-157` -- notify.ts per-file `no-restricted-syntax` override.
- `npm run typecheck` → exit 0 (baseline GREEN).
- Grep: only 2 `"not added"` construction sites exist (marketplace/info.ts:104,
  plugin/info.ts:559) -- confirms TYPE-02 safety.

### Secondary (project decisions)
- `.planning/phases/46-type-model-foundations/46-CONTEXT.md` -- D-46-01..07.
- `.planning/REQUIREMENTS.md` -- TYPE-01..04 acceptance criteria + Out-of-Scope.

### Tertiary
- None -- no WebSearch/external sources needed (self-contained in-repo refactor).

## Metadata

**Confidence breakdown:**
- Type-model design (TYPE-01..04 shapes): HIGH -- fully specified by CONTEXT.md + verified
  against live source; idiomatic TS discriminated unions already pervasive in the file.
- Construction-site enumeration: HIGH -- exhaustive grep + per-site read; 32 sites cataloged
  with line numbers and target arms.
- Byte-neutrality: HIGH -- 30/32 sites compile unchanged; the 2 info sites + 1 import/execute
  site are the only behavioral touches, all byte-preserving.
- `import/execute.ts` refactor shape: MEDIUM -- the obstacle is confirmed structurally; the
  exact minimal refactor is the planner's call (A2).

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable; in-repo source -- re-verify line numbers if `notify.ts` or
the orchestrators are edited before planning).

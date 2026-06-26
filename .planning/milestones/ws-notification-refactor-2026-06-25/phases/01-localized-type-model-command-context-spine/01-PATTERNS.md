# Phase 1: Localized type model & command-context spine - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 1 shared monolith (modified) + 18 command-local declarations (new, co-located) + ~14 orchestrator files (modified call sites) + 1 test (deleted)
**Analogs found:** all in-repo — every new construct has a verbatim analog already living in `shared/notify.ts`

> This phase is a **relocation + threading** refactor, not an invention. Every NEW construct (status tuple, message interface, render map, label) has a direct analog already in `shared/notify.ts`. The "analog" for a new per-command module is the *exact central construct it lifts from*. Planner copies the central body verbatim into the command module so rendered bytes never change (catalog-uat 114 fixtures + notify-v2 gate).

> All line numbers below are for `extensions/pi-claude-marketplace/shared/notify.ts` unless another path is given.

---

## File Classification

| New/Modified Construct | Role | Data Flow | Closest Existing Analog | Match Quality |
|------------------------|------|-----------|-------------------------|---------------|
| Per-command status tuple (`as const`) ×18 | model (type literal) | transform | `PLUGIN_STATUSES` :450, `MARKETPLACE_STATUSES` :479 | exact (idiom lifts verbatim) |
| Per-command message interface(s) ×~26 arms | model | transform | `PluginInstalledMessage` :590, `MpFailed` :907 | exact (interfaces relocate as-is) |
| Per-command render map `Record<Status, RenderFn>` ×18 | renderer (utility) | transform | `renderPluginRow` switch :1798–1977, `renderMpHeader` switch :1462–1566 | exact (switch arm bodies lift into map values) |
| `CommandContext` shared shape + per-command const ×18 | config (vocabulary holder) | request-response | (no exact analog) `MpCommon` :873 base-interface pattern; `satisfies` pin idiom (see `domain/components/hook-events.ts`) | partial — NEW horizontal surface |
| Shared topic-grouped reason enums | config | transform | `REASONS` :72–113, `BENIGN_REASONS` :140, `ContentReason` :127 | role-match (split, not new) |
| Optional base fields `severity?`/`needsReload?`/`dependencies?` | model | transform | existing `scope?`/`version?`/`reasons?` optionals :594–596 | exact (same optionality idiom) |
| Tuple-vs-array cardinality typing | model | transform | `CascadeNotificationMessage.marketplaces: readonly Mp[]` :1020 | role-match (narrows array→1-tuple) |
| `notify()` reshaped dispatcher | controller (dispatcher) | request-response | current `notify()` :2987 | exact (modified-in-place) |
| ~70 `notify()` call sites | controller (producer) | request-response | `add.ts:469/557`, `install.ts:1128/1168/1194`, `plugin/list.ts:852/890` | exact |
| DELETE `tests/architecture/notify-types.test.ts` | test | — | (removal — see D-03) | n/a |

---

## Shared Vocabulary That Render Maps Will CALL (D-11 — STAYS central)

The command render maps must call these **with the exact signatures below** so byte output is preserved. These are the "do not duplicate, call these" primitives.

**Icon constants** (:1323–1336) — file-private `const` (NOT exported today; planner must decide export-vs-pass-through):
```ts
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";
const ICON_DISABLED = "◌";   // D-54-01: (disabled) / (will disable)
```

**`joinTokens`** (:1590) — the empty-slot-suppressing join primitive every plugin arm uses:
```ts
function joinTokens(parts: readonly string[]): string {
  return parts.filter((p) => p !== "").join(" ");
}
```

**`renderScopeBracket`** (:1663) — orphan-fold scope-bracket policy (emits `[scope]` only when plugin scope differs from mp scope):
```ts
function renderScopeBracket(pluginScope: Scope | undefined, mpScope: Scope): string {
  if (pluginScope === undefined || pluginScope === mpScope) return "";
  return `[${pluginScope}]`;
}
```

**`renderVersion`** (:1632) / **`composeVersionArrow`** (:1683) — version composers (incl. PI-7 hash short-SHA):
```ts
function renderVersion(version: string | undefined): string { /* "" | `v${...}` */ }
function composeVersionArrow(from: string, to: string): string {
  return `${renderVersion(from)} → ${renderVersion(to)}`;
}
```

**`composeReasons`** (:1706) — reasons-brace + soft-dep marker injection. The 4-arg signature is load-bearing; the two boolean `declares*` flags gate soft-dep markers:
```ts
function composeReasons(
  reasons: readonly Reason[] | undefined,
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): string  // "" | `{<r1>, <r2>}`
```

**`pluginRow`** (:1776) — folds the 4 structurally-identical scope+reasons rows (`upgradable`/`skipped`/`failed`/`manual recovery`); both `declares` flags hard-`false`:
```ts
function pluginRow(
  icon: string,
  p: { readonly name: string; readonly scope?: Scope;
       readonly version?: string; readonly reasons: readonly ContentReason[] },
  mpScope: Scope, label: string, probe: SoftDepStatus,
): string  // joinTokens([icon, name, scopeBracket, version, label, reasons])
```

**Probe + scope types** (imported, not redeclared): `SoftDepStatus` from `../platform/pi-api.ts`; `Scope = "user" | "project"` from `shared/types.ts:16`.

> **Planner decision (Open Question — flag):** `ICON_*`, `joinTokens`, `renderScopeBracket`, `renderVersion`, `composeVersionArrow`, `composeReasons`, `pluginRow` are all **file-private** today. To call them from a sibling command module they must either be (a) exported from `notify.ts`, or (b) the render map stays a closure constructed inside `notify.ts` and only the *status tuple + message interface + label* move out. (b) keeps the eslint BLOCK-A `ctx.ui.notify` containment tighter but partially defeats D-10's "command owns its render map." Resolve before planning render-map placement.

---

## Pattern Assignments

### Per-command status tuple (model, transform) — ×18

**Analog:** `PLUGIN_STATUSES` (:450–467), `MARKETPLACE_STATUSES` (:479–489)

The `as const` tuple + `(typeof X)[number]` literal-union idiom (used ~16× in the file). A command lifts only ITS OWN subset:
```ts
// notify.ts:450 — the central tuple being decomposed
export const PLUGIN_STATUSES = ["installed","updated","reinstalled","uninstalled",
  "available","unavailable","upgradable","failed","skipped","manual recovery",
  "present","will install","will uninstall","will enable","will disable","disabled"] as const;

// notify.ts:505 — the derived literal-union idiom (the ~16× pattern)
export type PluginStatus = (typeof PLUGIN_STATUSES)[number];
```
Command-local form (e.g. install owns 3): `const INSTALL_STATUSES = ["installed","failed","unavailable"] as const; type InstallStatus = (typeof INSTALL_STATUSES)[number];`

Per-command status sets are enumerated in RESEARCH.md "Per-command inventory" table (the intersection of each orchestrator's `status:` literals with the closed tuples).

---

### Per-command message interface (model, transform) — ×~26 arms

**Analog (plugin arm):** `PluginInstalledMessage` (:590–597) — note the existing optional/required discipline that lifts verbatim:
```ts
export interface PluginInstalledMessage {
  readonly status: "installed";
  readonly name: string;
  readonly dependencies: readonly Dependency[];   // REQUIRED on installed/updated/reinstalled only
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];     // orphan-rewake brace (optional)
}
```

**Analog (marketplace arm):** the `MpCommon` base + extends pattern (:873–910) — the shared-base idiom the planner can reuse for the universal base-message shape:
```ts
interface MpCommon {                                 // :873 — shared base every arm extends
  readonly name: string;
  readonly scope: Scope;
  readonly plugins: readonly PluginNotificationMessage[];
}
interface MpAdded extends MpCommon { readonly status: "added"; }            // :880
interface MpFailed extends MpCommon {                                       // :907
  readonly status: "failed";
  readonly reasons?: readonly ContentReason[];       // optional only on this arm (TYPE-04)
}
```

The discriminated-union assembly (:844–860 plugin, :975–985 mp) becomes a per-command union of just the command's arms (or stays as the envelope's row-type union — D-01 forbids a *registry*, not a row-type union; see RESEARCH Open Question 2).

**Optional base-field introduction (D-06/D-07):** follow the *existing* optionality at :594–596 (`version?`, `scope?`, `reasons?`). Add `severity?`, `needsReload?` as inert optionals the Phase-1 renderer never reads. `dependencies` reconciliation: it is REQUIRED on `installed`/`updated`/`reinstalled` today (:593, :609, :620); promoting to optional base must keep soft-dep marker injection gated to exactly those 3 render arms (:1818–1820, :1852–1854, :1866–1868) — the other arms pass `false`/`undefined` to `composeReasons` (RESEARCH Pitfall 4).

---

### Per-command render map `Record<Status, RenderFn>` (renderer, transform) — ×18

**Analog:** `renderPluginRow` switch (:1798–1977), `renderMpHeader` switch (:1462–1566). **Each switch arm body lifts verbatim into a render-map value.** This is the D-10 exhaustiveness anchor: a missing key for a declared status is a TS2741 compile error (exactly what the central `assertNever` default arm at :1972–1975 guards today).

Sample arm bodies to lift (verbatim — byte source of truth):

`installed` arm (:1809–1822) → install render map `installed` value:
```ts
case "installed":
  return joinTokens([ICON_INSTALLED, p.name, renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version), "(installed)",
    composeReasons(p.reasons, p.dependencies.includes("agents"),
      p.dependencies.includes("mcp"), probe)]);
```

`failed`/`skipped`/`upgradable`/`manual recovery` arms (:1901–1908) → fold through `pluginRow`:
```ts
case "upgradable": return pluginRow(ICON_INSTALLED, p, mpScope, "(upgradable)", probe);
case "skipped":    return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe);
case "failed":     return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe);
case "manual recovery": return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(manual recovery)", probe);
```

Marketplace `failed` arm (:1470–1483) → mp render map `failed` value (note the `composeReasons(mp.reasons, false, false, probe)` — mp rows NEVER emit soft-dep markers, both declares-flags hard-`false`):
```ts
case "failed": {
  const reasonsBrace = composeReasons(mp.reasons, false, false, probe);
  return reasonsBrace === ""
    ? `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed)`
    : `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed) ${reasonsBrace}`;
}
```

The RenderFn signature the planner must preserve (derived from the switch params at :1798–1802): `(row: Msg, probe: SoftDepStatus, mpScope: Scope) => string`.

---

### `CommandContext` + `Messaging.label` (config, request-response) — ×18

**Analog:** No exact prior — this is the NEW horizontal surface (D-04/D-05). Closest idioms in the repo:
- The `as const satisfies` pin used elsewhere for value↔type lock without centralizing (RESEARCH cites `domain/components/hook-events.ts` `satisfies readonly ClaudeHookEvent[]`).
- `MpCommon` (:873) for the "shared base interface, per-command extension" shape.

Target shape (from RESEARCH Pattern 2; planner finalizes class-vs-const-satisfies per D-04 discretion):
```ts
interface CommandContext<Status extends string, Msg> {
  readonly Messaging: { readonly label: string };
  readonly render: { [K in Status]: RenderFn<Extract<Msg, { status: K }>> };
}
export const INSTALL_CONTEXT = {
  Messaging: { label: "Plugin install" },
  render: INSTALL_RENDER,
} as const satisfies CommandContext<InstallStatus, InstallMsg>;
```

> **NAMING COLLISION — flag to planner:** `ExtensionCommandContext` already exists (`platform/pi-api.ts`, imported as the per-command Pi handler `ctx` in `edge/router.ts:24` and used ~18× in `SubcommandHandlers`). The new D-04/D-05 `CommandContext` is a *distinct* notification concept. D-05 mandates the literal name `CommandContext`, so this coexists with `ExtensionCommandContext` — confirm the two are not conflated at import sites and that `CommandContext` is unambiguous in orchestrator scope.

---

### Shared reasons split (config, transform)

**Analog:** `REASONS` (:72–113, 32 entries) — the closed set whose *membership* must stay byte-identical (OUT-08); only its *organization* changes. Supporting analogs: `BENIGN_REASONS` set (:140), `ContentReason = Exclude<Reason, "not added">` (:127).

```ts
export const REASONS = [ /* 32 entries, :73–112 */ ] as const;   // :72
export type Reason = (typeof REASONS)[number];                    // :115
export type ContentReason = Exclude<Reason, "not added">;        // :127 — "not added" stays structural marker
```

Topic groups (RESEARCH "Reasons split detail" — planner finalizes taxonomy):
- **already-in-requested-state:** `up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`
- **unsupported-components / soft-dep** (user-named): `unsupported hooks`, `lsp`, `requires pi-subagents`, `requires pi-mcp`, `unsupported source`, `no longer installable`
- **failure-class:** `permission denied`, `source missing`, `network unreachable`, `unreadable`, `unparseable`, `unreadable manifest`, `invalid manifest`, `not in manifest`, `rollback partial`, `lock held`, `source mismatch`, `concurrently uninstalled`, `concurrently updated`
- **command-private:** `duplicate name`/`stale clone` (add), `not found`, `not installed` (uninstall), `plugins remain` (mp remove), `orphan rewake` (install), `not added` (structural — NOT a ContentReason)

Constraint: union of all groups + privates == the 32-entry closed set exactly.

---

### `notify()` dispatcher reshape (controller, request-response)

**Analog:** the current `notify()` itself (:2987–3048) — modified in place. Current signature:
```ts
export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void {
  const probe = softDepStatus(pi);                          // :2996 — STAYS (threaded to render maps)
  if (isInfoKind(message)) { dispatchInfoMessage(ctx, message, probe); return; }  // :3007 — STAYS
  switch (message.kind) { case undefined: case "cascade": case "disable-cascade": break;  // :3017
    default: assertNever(message); return; }
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe)); // :3035 — render dispatch
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");        // :3036
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";               // :3040 — Phase-1 UNCHANGED
  emitWithSummary(ctx, message, hint === "" ? body : `${body}\n\n${hint}`);            // :3047 — single ctx.ui.notify seam
}
```

Reshape (D-02): the central render dispatch (`composeMarketplaceBlock` → `renderPluginRow`/`renderMpHeader` switches) is replaced by calling the command's render map carried on the threaded `CommandContext`. Severity/summary/reload ladders stay content-derived (Phase-1 UNCHANGED). RESEARCH recommends adapter-then-migrate (keep old 3-arg entry as a synthesizer) to avoid breaking 114 catalog fixtures + ~70 call sites at once (Pitfall 2, A1).

---

### `notify()` call sites (controller, request-response) — ~70 across ~14 files

**Single-cascade (1-tuple `[Row]`) representative — `add.ts:469`:**
```ts
notify(opts.ctx, opts.pi, {
  marketplaces: [
    { name: addSubjectName(err, opts.rawSource), scope: opts.scope,
      status: "failed", reasons: [reason], plugins: [] },
  ],
});
```
Success twin at `add.ts:557` (`status: "added", plugins: []`). Install single-cascade at `install.ts:1128` (`marketplaces: [{ name, scope, plugins: [failureMessage] }]`) and the standalone `marketplace-not-added` at `install.ts:1194` (`{ kind: "marketplace-not-added", name, scope }`).

**Plural-cascade (array `Row[]`) representative — `plugin/list.ts:852`:**
```ts
const marketplaces = await loadPluginListPayload(opts);   // variable-length array
notify(ctx, pi, { marketplaces });
```
(The catch path at `:890` is single: `notify(ctx, pi, { marketplaces: [mp] })`.)

**D-12 cardinality reshape:** single-target ops (`install`, `marketplace add`) type their row slot as `readonly [Row]`; bulk ops (`list`, update cascade, import, reconcile) type it `readonly Row[]`. Phase-1 caveat: additive typing only — a 1-tuple IS an array at runtime, so the severity/summary `.length`/`.filter().length` ladders (:3036, :2202–2244) keep working unchanged (ladder rewrite is Phase 2 — A5).

Full call-site list (file:line) is in RESEARCH "Per-command inventory" table; importers verified: `marketplace/{autoupdate,remove,shared,list,info,update}.ts`, `plugin/{install,uninstall,update,reinstall,enable-disable,list,info}.ts`, `import/execute.ts`, `reconcile/{apply,pending}.ts`.

---

### DELETE `tests/architecture/notify-types.test.ts` (test)

**Structure (header :1–48, body :100–189+):** compile-time-only proofs. Type-level `_Assert_*` aliases resolve `true`/`never`; `export const _x: _Assert_* = true;` is the load-bearing typecheck; a trivial `test(...)` body anchors it to node:test. Guards:
1. `PluginStatus` ⇄ `PluginNotificationMessage["status"]` bidirectional set-equality (`_Assert_PluginStatusForward` :127, `_Assert_PluginStatusBackward` :132).
2. Tuple length-locks (`PLUGIN_STATUSES.length extends 16` :145, `MARKETPLACE_STATUSES.length extends 9` :151, `STATUS_TOKENS.length extends 22` :159, `DEPENDENCIES.length extends 2` :163, `REASONS.length extends 32`).
3. Exact literal-set membership (`_PluginStatusExpected` :174).
4. Per-variant field-presence `@ts-expect-error` blocks (lower in file).

**Why safe to delete (D-03):** items 1–3 guard the *central tuples* that no longer exist after localization. Item 4 (field-presence) travels with the message interface to the command module if the planner keeps it (relocated `@ts-expect-error` blocks). The file is self-contained, runtime-inert, nothing imports it (path: `tests/architecture/notify-types.test.ts`, repo-root-relative, not under `extensions/`). `notify-grammar-invariant.test.ts` SURVIVES (output-behavior, not type tuples).

---

## Shared Patterns

### `(typeof X)[number]` literal-union idiom
**Source:** `notify.ts:505` (`type PluginStatus = (typeof PLUGIN_STATUSES)[number]`), used ~16× file-wide.
**Apply to:** every per-command status tuple.

### Discriminated-union narrowed on `status` + `assertNever` exhaustiveness
**Source:** `renderPluginRow` switch :1803 + `assertNever(p)` default :1972; `renderMpHeader` :1462 + `assertNever(mp)` :1562.
**Apply to:** replaced by per-command `Record<Status, RenderFn>` mapped type (D-10) — TS2741 replaces the runtime `assertNever`.

### Optional-field output-neutrality
**Source:** `version?`/`scope?`/`reasons?` at :594–596; the `MpFailed.reasons?`/`MpSkipped.reasons?` arm-local optionals at :909/:933.
**Apply to:** introducing inert `severity?`/`needsReload?` base fields.

### Soft-dep marker gating (do-not-regress)
**Source:** only `installed`/`updated`/`reinstalled` arms pass `p.dependencies.includes(...)` to `composeReasons` (:1818, :1852, :1866); all other arms pass `false`/`undefined` (:1878, :1888, :1898). `renderMpHeader` passes `(false, false)` everywhere (:1479, :1505).
**Apply to:** all render maps — preserve the gating exactly (Pitfall 4).

### Path-redaction security seam (do-not-move)
**Source:** `redactAbsolutePaths` :244, cause-chain via `renderIndentedCauseChain` (NFR-9).
**Apply to:** any render map emitting cause-chain trailers must route through the existing seam, never raw `.stack`.

---

## No Analog Found

| Construct | Role | Data Flow | Reason |
|-----------|------|-----------|--------|
| `CommandContext` shared shape (D-04) | config | request-response | NEW horizontal surface — no prior per-command vocabulary holder exists. Closest idioms (`as const satisfies`, `MpCommon` base) are partial. Naming collides with existing `ExtensionCommandContext` (distinct concept) — see flag above. |
| `Messaging.label` member | config | — | NEW — the label is introduced this phase but the summary surface that consumes it lands Phase 3; Phase 1 threads it without rendering it (output-neutral). |

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/notify.ts` (full), `orchestrators/{plugin,marketplace,import,reconcile}/*.ts` (call sites), `tests/architecture/notify-types.test.ts`, `shared/types.ts`, `platform/pi-api.ts`, `edge/router.ts`.
**Files scanned:** ~10 read directly; ~14 orchestrators enumerated for call sites (per RESEARCH inventory).
**Pattern extraction date:** 2026-06-24

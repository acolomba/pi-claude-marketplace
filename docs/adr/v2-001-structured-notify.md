# ADR-v2-001: Structured `notify` payload with typed wrappers

- **Status:** Accepted (Phase 15, 2026-05-25); landed via Phase 17 -- spec + catalog UAT migration (2026-05-26)
- **Date:** 2026-05-25
- **Supersedes:** D-CMC-11 (no structured-payload arg)

## Context

V1 ships a stringly-typed user-output surface: `notifySuccess/Warning/Error(ctx, message: string)` accepts a fully-assembled compact-line string. Every call site independently makes two choices that must stay consistent:

1. **Severity wrapper** (`notifySuccess` vs `notifyWarning` vs `notifyError`)
2. **Message body** (icon glyph + status token + scope bracket + grammar slots + reasons)

These two choices are coupled by `docs/messaging-style-guide.md` -- e.g. a SUCCESS-class status token like `(installed)` MUST flow through `notifySuccess`, never `notifyWarning`. The coupling is enforced by **34 custom ESLint rules** under `tests/lint-rules/` (MSG-SR-1..7 severity routing, MSG-IC-1..3 icon discipline, MSG-GR-1..5 grammar, MSG-PL-1..6 plugin-row conventions, MSG-CC-1 cause-chain, MSG-MR-1..2 manual-recovery, MSG-RP-1 rollback-partial, MSG-RH-1 reload-hint, MSG-SD-1..3 soft-dep, MSG-NC-1..2 entity-error/usage, MSG-ER-1 empty-token, MSG-LC-1..2 console discipline) plus the 4-way registry parity test plus the byte-equality catalog UAT runner. The presentation layer (`presentation/compact-line.ts:247`) already carries a discriminated `RowSpec` union with 9 variants -- but it produces `string` and hands it to the caller, who then picks the wrapper.

This works but accrues cost: every new notify surface needs a new lint glob; the typed `PluginShapeError` refactor (quick task 260525-aub) had to thread typed dispatch separately from message routing; the recent code review surfaced two known MSG-GR-3 drift sites outside the lint glob (`shared/types.ts:20`, `edge/completions/provider.ts:70`); and the lint rules themselves require RuleTester suites -- the linter has become a parallel codebase. The 34 custom rules + 34 RuleTester suites exist *because* the API is unstructured; they would not exist if grammar were enforced by types.

## Decision

v1.4 introduces a single structured `notify(ctx, NotificationMessage)` entrypoint and a single `notifyUsageError(ctx, UsageErrorMessage)` entrypoint. Per-outcome wrappers are NOT introduced. The discriminator on `status:` literal (per-variant interfaces joined in a discriminated union) recovers per-outcome-wrapper autocomplete ergonomics without the per-wrapper file maintenance cost; `assertNever` in the renderer's `switch` retains the compile-error gate that motivated the wrapper design. The design pivot is documented in the Alternatives section below (Alternative 2 flipped Rejected → ACCEPTED).

### Public surface

Two exported entrypoints and the user-facing types live in `extensions/pi-claude-marketplace/shared/notify.ts`:

```ts
export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void;
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void;

// Public types (shipped by Phase 15):
export type NotificationMessage;            // { marketplaces: readonly MarketplaceNotificationMessage[] }
export type MarketplaceNotificationMessage; // { name; scope; status?; details?; plugins }
export type PluginNotificationMessage;      // 11-variant discriminated union on `status`
export type PluginStatus;                   // 11 literal strings, derived from PLUGIN_STATUSES tuple
export type MarketplaceStatus;              // 7 literal strings, derived from MARKETPLACE_STATUSES tuple
export type Dependency;                     // "agents" | "mcp", derived from DEPENDENCIES tuple
export interface MarketplaceDetails;        // { autoupdate: boolean; lastUpdatedAt?: string }
export interface UsageErrorMessage;         // { message: string; usage: string }

// Runtime tuples shipped alongside the derived literal-union types (D-15-11):
export const PLUGIN_STATUSES;       // 11 entries
export const MARKETPLACE_STATUSES;  // 7 entries
export const DEPENDENCIES;          // 2 entries
```

The `presentation/` composers become module-internal helpers of `notify()` and are NOT re-exported from the barrel (SNM-18). The Phase 16 renderer is the SOLE consumer of the per-variant grammar.

### Implementation seam

One private switch over the `status` discriminator is the SOLE site that knows the user-output grammar (SNM-17). The Phase 16 renderer body has the following shape:

```ts
function renderPlugin(plugin: PluginNotificationMessage): string {
  switch (plugin.status) {
    case "installed":
      return `${ICON_INSTALLED} ${plugin.name}${scopeBracket(plugin.scope)}${versionSlot(plugin.version)} (installed)${dependencyProbes(plugin.dependencies)}`;
    case "updated":
      return `${ICON_INSTALLED} ${plugin.name}${scopeBracket(plugin.scope)} v${plugin.from} → v${plugin.to} (updated)${dependencyProbes(plugin.dependencies)}`;
    // ... 8 more arms, one per PluginStatus literal ...
    default:
      assertNever(plugin);
  }
}
```

`assertNever(plugin)` makes "added a variant without a case arm" a compile error (SNM-17). The switch is the only place that picks severity, picks the icon glyph, embeds the status-token literal, orders the grammar slots, or composes brackets / probes / trailers.

Severity is **computed** from contents inside `notify()` (SNM-14, refined by UXG-02 / D-28-06): any plugin or marketplace with `status: "failed"` raises severity to `"error"`; any plugin with `status: "manual recovery"` raises severity to `"warning"` (always actionable); a `skipped` row routes to `"warning"` UNLESS all its reasons are in the benign closed set (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`), in which case it routes to `"info"`; an mp-level `skipped` with missing/empty reasons cannot be proven benign and routes to `"warning"` (the D-28-08 safe default); otherwise the call lands at default success severity. A mixed cascade (one benign skip plus one actionable skip, or any manual-recovery row) routes the whole notification to `"warning"` (first-match poisoning, D-28-09). No `severity` field on `NotificationMessage` -- the message contents fully determine routing. For `error` / `warning` severity, the emitted string is `{summary-line}\n\n{body}` (Phase 29 / UXG-07) -- a structurally-computed count sentence prepended before the cascade body; see the Phase 29 amendment below.

The reload-hint trailer is **computed** at render time (SNM-15): the trailer is emitted iff any plugin carries one of `installed | updated | reinstalled | uninstalled` OR any marketplace carries a `status` set. The call site never asks for it.

The dependency probe is **computed** at render time (SNM-16): each `dependencies: ["agents"]` triggers a per-row probe for the `pi-subagents` companion extension and emits `{requires pi-subagents}` when absent; `dependencies: ["mcp"]` triggers the analogous probe for `pi-mcp-adapter` and emits `{requires pi-mcp}` when absent. The 3 structurally-absorbed v1.3 Reasons (`rollback partial`, `requires pi-subagents`, `requires pi-mcp`) no longer appear in any typed `reasons` field of the new model.

Tests exercise `notify()` via a mock `ctx` and assert on the exact string passed to `ctx.ui.notify` (matches V1's existing notification-recording test pattern).

### NotificationMessage shape

The top-level payload is a thin envelope; every grammar decision lives in the per-plugin variants:

```ts
interface NotificationMessage {
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}

interface MarketplaceNotificationMessage {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus; // "added" | "removed" | "updated" | "failed" | "autoupdate enabled" | "autoupdate disabled" | "skipped"
  readonly details?: MarketplaceDetails; // { autoupdate; lastUpdatedAt? }
  readonly plugins: readonly PluginNotificationMessage[];
}

type PluginNotificationMessage =
  | PluginInstalledMessage // status: "installed";   dependencies (required)
  | PluginUpdatedMessage // status: "updated";     dependencies (required); from/to (required)
  | PluginReinstalledMessage // status: "reinstalled"; dependencies (required)
  | PluginUninstalledMessage // status: "uninstalled"
  | PluginAvailableMessage // status: "available";   NO scope (SNM-11)
  | PluginUnavailableMessage // status: "unavailable"; reasons (required); NO scope (SNM-11)
  | PluginUpgradableMessage // status: "upgradable";  reasons (required)
  | PluginPresentMessage // status: "present";     dependencies (required); inventory token (G-21-01)
  | PluginFailedMessage // status: "failed";      reasons (required); cause?; rollbackPartial?
  | PluginSkippedMessage // status: "skipped";     reasons (required)
  | PluginManualRecoveryMessage; // status: "manual recovery"; reasons (required); cause?
```

`NotificationMessage` has NO `severity` field and NO `trailer` field (SNM-01) -- both are computed inside `notify()` from contents per the rules in the Implementation seam.

`MarketplaceNotificationMessage.status?` and `.details?` are independent optionals (SNM-02 + D-15-06) -- they never co-occur in practice (Phase 16 renderer ignores `details` when `status` is set) but the type does not structurally constrain that. An empty `plugins: []` IS the structural representation of the `(no plugins)` rendering on the list surface (D-15-08); on state-change paths an empty `plugins` array is the normal case (renderer emits the marketplace header alone).

The 11-variant `PluginNotificationMessage` discriminated union locks per-variant field carve-outs at compile time (SNM-03 + D-15-12):

- `reasons: readonly Reason[]` REQUIRED only on `unavailable | upgradable | skipped | failed | manual recovery` (D-15-01). The other 5 variants omit the field entirely so `(installed) {up-to-date}` is a compile error.
- `dependencies: readonly Dependency[]` REQUIRED only on `installed | updated | reinstalled` (D-15-02 + SNM-06). The other 7 variants omit the field; only those 3 switch arms reach the per-dependency probe path.
- `version?: string` on every variant EXCEPT `updated`, which carries REQUIRED `from: string; to: string` instead (D-15-04). Hash-version contract (PI-7 `hash-<12hex>`) remains a plain string -- no branded type.
- `scope?: Scope` on every variant EXCEPT `available | unavailable` (SNM-11 -- MSG-PL-6 carve-out preserved structurally; the list surface does not emit `[<scope>]` brackets for those rows).
- `cause?: Error` on `failed | manual recovery` only (SNM-10). The v1.3 top-level cause-chain trailer is RETIRED -- per-plugin causes survive every cascade and are surfaced individually by the renderer.
- `rollbackPartial?: readonly { phase; cause? }[]` on `failed` only (SNM-09). No separate `"rollback failed"` status -- rollback-partial is structurally a sub-state of `failed`.

`PluginStatus = (typeof PLUGIN_STATUSES)[number]` -- the runtime tuple and the derived literal-union type stay in lockstep (SNM-04 + D-15-11). Same pattern for `MarketplaceStatus` and `Dependency`.

`MarketplaceDetails = { autoupdate: boolean; lastUpdatedAt?: string }` -- intentionally minimal (SNM-07 + D-15-05); `lastUpdatedAt?` mirrors `persistence/state-io.ts:70` so list-surface orchestrators can pass the record's value through unchanged.

`UsageErrorMessage = { message: string; usage: string }` (SNM-08) -- both fields REQUIRED; the renderer composes the on-the-wire string as `${message}\n\n${usage}` mirroring V1's blank-line discipline. No `cause` (usage-error is non-cause-bearing) and no `severity` (always `"error"` -- structural, not a field).

**Always-marketplace-header spec change.** Every `notify()` output renders a marketplace header at column 0 with plugin rows indented two spaces. v1.3's inline-plugin and bare-cascade emissions are replaced by the always-header form for structural uniformity. The spec rewrite of `docs/output-catalog.md` lands in Phase 17 (SNM-20).

## Consequences

### Removed at compile time

No test or lint needed for any of: severity routing, icon glyph, status-token literal, grammar slot order, scope brackets, scope ordering, closed sets (status-tokens, dependencies, reasons, markers), soft-dep markers, reload-hint trailer, per-plugin cause-chain trailers. All derive structurally inside `notify()` rather than per caller. Closed sets are encoded as `as const` tuples in `shared/notify.ts` (D-15-11) so the runtime arrays power downstream fixture iteration AND the literal-union types power compile-time narrowing from a single source of truth.

### Custom ESLint plugin deleted entirely

`tests/lint-rules/` (~4096 lines: 34 MSG-\* rules + 34 RuleTester suites + registry + helpers) is removed. `tests/architecture/msg-rule-registry.test.ts` (the 4-way parity test) is also removed -- no plugin to parity-check. `eslint.config.js` swaps the MSG-plugin wiring for stock rules:

```js
// eslint.config.js (post-Phase-21)
"no-restricted-syntax": ["error", {
  selector: "CallExpression[callee.object.property.name='ui'][callee.property.name='notify']",
  message: "Call ctx.ui.notify only from shared/notify.ts.",
}],
"no-console": ["error", { allow: [] }], // per-file override in persistence/migrate.ts (IL-3)
```

The deletion lands in Phase 21 after the call-site migration waves (Phases 18-20) complete. The lint plugin stays in place through Phase 20 to guard call sites that have not yet migrated.

### Coverage moves to per-variant unit tests + catalog UAT

Each `PluginStatus` and `MarketplaceStatus` value gets a small unit test that calls `notify()` with a mock `ctx` and asserts on the exact string passed to `ctx.ui.notify` (SNM-30). The catalog UAT runner (`tests/architecture/catalog-uat.test.ts`) keeps its byte-equality role unchanged but is now fed by structured `NotificationMessage` fixtures (SNM-31) flowing through `notify()` via mock ctx -- not pre-assembled strings. `docs/output-catalog.md` is rewritten in Phase 17 to reflect the always-marketplace-header spec (SNM-20). `docs/messaging-style-guide.md` v2.0 describes the structured type model as the binding contract (SNM-19).

### Other consequences

- `presentation/` composers become module-internal helpers of `notify()`'s switch; the public notify surface shrinks to the two entrypoints + the public types (SNM-18). The barrel does not re-export the composers.
- Per-plugin causes survive every cascade (SNM-10) -- a multi-failure cascade now surfaces each plugin's cause chain separately instead of collapsing into a single top-level trailer.
- The top-level cause-chain trailer is retired (no top-level `severity`, no top-level `trailer` on `NotificationMessage` per SNM-01); severity is computed from contents, reload-hint is computed from contents.
- Discoverability is recovered by discriminated-union literal narrowing: typing `status: "` in a `PluginNotificationMessage` literal autocompletes the 10 legal values; selecting one narrows the variant and autocompletes the per-variant field set.
- Greppability preserved -- per-status `case` arms in the renderer's switch are distinct symbols; grep for `case "installed":` is the structured equivalent of "grep for the literal `(installed)`."
- Typed errors (`PluginShapeError`, the v1.3 outcome from quick task 260525-aub) integrate cleanly: `cause?: Error` on `failed` / `manual recovery` accepts the typed error directly, no message pre-formatting.

### Costs

- Migrating ~33 call sites total (~20 orchestrator `notifySuccess` / `notifyWarning` / `notifyError` sites + ~13 edge `notifyUsageError` sites) -- mechanical but touches every orchestrator family.
- ~120 LoC of types in `shared/notify.ts` (added by Phase 15).
- ~80 LoC of compile-check arch test in `tests/architecture/notify-types.test.ts` (added by Phase 15).
- The Phase 16 `notify()` renderer body (the switch + helpers).
- One-time deletion of `tests/lint-rules/` + `tests/architecture/msg-rule-registry.test.ts` + `eslint.config.js` MSG-plugin wiring lands in Phase 21.

### Net code delta

≈ +400 LoC types/switch/wrappers - ≈ 4500 LoC deleted lint plugin + RuleTester suites - ≈ 200 LoC deleted registry parity test + absorbed presentation composers = **~4300 LoC net removed** at milestone close. Phase 15 in isolation ADDS ~+200 LoC; the deletion happens in Phase 21.

## Alternatives considered

1. **Keep V1 unchanged.** Cost is the 34 ESLint rules and the ongoing risk of drift sites outside lint globs. Diminishing returns as the surface grows. Rejected.

2. **Single `notify(ctx, payload)` only, no typed wrappers. ACCEPTED (v1.4 design pivot).** Discriminated-union literal narrowing on `status:` recovers per-outcome-wrapper autocomplete ergonomics without the per-wrapper file maintenance cost; `assertNever` in the `notify()` switch retains the compile-error gate that motivated the original wrappers; the pivot trades 15-20 per-outcome wrapper symbols for one symbol whose discriminated `status` field is structurally narrower than wrapper-argument types could have been; per-status unit tests (SNM-30) preserve the per-outcome coverage affordance. The original ADR draft preferred typed wrappers; the design pivot that produced the current shape landed between ADR draft and CONTEXT.md decisions, and this refresh documents the pivot honestly (D-15-16).

3. **Typed wrappers only, no shared `notify()` seam.** Each wrapper independently picks severity, formats the string, and calls `ctx.ui.notify`. Moves the drift surface from "string contents" to "what each wrapper renders" -- we'd be right back to needing lint rules to check that `notifyPluginUpdated` actually writes `(updated)` and not `(installed)`. The single switch + `assertNever` exhaustiveness gate is the whole point. Rejected.

4. **Expose `render(payload): string` as a separate pure function.** Tempting because it gives tests a side-effect-free entrypoint. Rejected because it adds a public symbol that callers can misuse (passing a payload through `render` then through their own `ctx.ui.notify` reintroduces every drift class the wrapper architecture removed), and the mock-`ctx` test pattern is already idiomatic in V1.

5. **Structured payload with a fallback string escape hatch** (`notify(ctx, payload | string)`). Reintroduces the drift problems wherever `string` is chosen. Rejected.

6. **Codegen the wrappers from `messaging-style-guide.md`'s YAML.** Moves the binding contract from spec→code into spec→codegen→code; adds a build step. Reject unless the union becomes unwieldy.

## Migration

Phased rollout across v1.4 (Phases 15-21). Each phase preserves byte-equality of user-visible output against the catalog UAT until the catalog spec itself is rewritten in Phase 17.

- **Phase 15** (this ADR): land the type model in `shared/notify.ts` (10-variant `PluginNotificationMessage` discriminated union + closed-set tuples + supporting interfaces) and the compile-check arch test at `tests/architecture/notify-types.test.ts`. No call sites change; V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError`) stay intact alongside the new types. `npm run check` GREEN. SNM-21 closes here.
- **Phase 16:** introduce `notify(ctx, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` in `shared/notify.ts` alongside the V1 severity-named wrappers (V1 NOT yet deleted). The internal switch with `assertNever` is the sole grammar site (SNM-17). Per-status unit tests (SNM-30) exercise every variant via a mock `ctx`. Catalog UAT stays GREEN against the V1 callsites unchanged.
- **Phase 17:** rewrite `docs/messaging-style-guide.md` to v2.0 (SNM-19) and `docs/output-catalog.md` to the always-marketplace-header spec (SNM-20). Migrate `tests/architecture/catalog-uat.test.ts` to feed structured `NotificationMessage` fixtures through `notify()` via mock ctx (SNM-31). Byte-equality assertion remains the user-contract gate.
- **Phases 18-20:** migrate call sites by family -- Phase 18 marketplace orchestrators, Phase 19 plugin orchestrators, Phase 20 edge handlers + `notifyUsageError` (SNM-23). Each phase narrows the MSG-\* `files:` globs in `eslint.config.js` to the still-unmigrated family. Catalog UAT byte-equality is GREEN for the family at the end of each migration phase.
- **Phase 21:** delete the V1 severity-named wrappers (`notifySuccess` / `notifyWarning` / `notifyError`) and the V1 three-argument `notifyUsageError(ctx, msg, usage)` signature from `shared/notify.ts` (SNM-22); delete `tests/lint-rules/` (SNM-24) and `tests/architecture/msg-rule-registry.test.ts` (SNM-25); rewrite or delete `tests/architecture/grammar-frontmatter.test.ts` (SNM-26); swap `eslint.config.js` to stock `no-restricted-syntax` + `no-console` with the `persistence/migrate.ts` per-file override (SNM-27); review `tests/architecture/no-legacy-markers.test.ts` for v2 vocabulary (SNM-28); resolve `shared/grammar/` retain-or-delete (SNM-29). `npm run check` GREEN against the new minimal surface (SNM-32).

If the phase numbers shift between this ADR's acceptance and the final teardown, the canonical traceability is `.planning/REQUIREMENTS.md`'s phase-mapping table (Phase column per SNM-\* row); this ADR's phase numbers are informative, not binding.

## Amendment: Phase 17.1 (2026-05-26)

Phase 17.1 amends the V2 grammar on three layered surfaces: (1) `shared/notify.ts` adds three new `MarketplaceStatus` literals (`"autoupdate enabled"`, `"autoupdate disabled"`, `"skipped"`) extending `MARKETPLACE_STATUSES` from 4 entries to 7, and adds an optional `readonly reasons?: readonly Reason[]` field to `MarketplaceNotificationMessage` (a third independent optional alongside `status?` and `details?` per D-15-06); (2) the `renderMpHeader` switch gains three new arms producing the byte forms `● ${name} [${scope}] (autoupdate enabled)`, `● ${name} [${scope}] (autoupdate disabled)`, and `● ${name} [${scope}] (skipped) {<reasons>}`; (3) `docs/output-catalog.md` § `marketplace autoupdate` is rewritten with five per-state catalog blocks (`enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent`, `failure-not-found`).

Phase 17's v2 catalog collapsed the marketplace autoupdate enable/disable surface to a single `(updated)` status, erasing the V1 distinction between fresh state changes and idempotent flips. The Phase 18 discuss-phase (D-18-05) locked a 5-state user-visible design that requires the type model + renderer to distinguish fresh enable/disable from idempotent no-ops from failures. Phase 17.1 implements that contract as a layered amendment to Phase 15 (types), Phase 16 (renderer), and Phase 17 (catalog) -- a pure amendment, no new orchestrator behavior.

The severity ladder (D-16-11) is extended: `mp.status === "skipped"` routes consistently with plugin-level `"skipped"`. (Phase 28 / UXG-02 / D-28-06 later softens this: a `skipped` row routes to `"warning"` UNLESS all its reasons are in the benign closed set -- `up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate` -- in which case it routes to `"info"`; an mp-level `skipped` with missing/empty reasons still routes to `"warning"` per the D-28-08 safe default. The idempotent autoupdate flips emitted here -- `already autoupdate` / `already no autoupdate` -- are benign, so they route to `"info"` post-Phase-28.) The reload-hint trigger ladder (D-16-12) is extended: `mp.status === "autoupdate enabled"` and `mp.status === "autoupdate disabled"` trigger the `/reload to pick up changes` trailer (the marketplace persistence record was mutated); `mp.status === "skipped"` does NOT trigger (idempotent no-op -- no state changed). The `"failed"` arm continues to route to `"error"` severity with no reload-hint (D-16-12 explicitly excludes failed).

The Decision section above reflects the post-amendment state. The Consequences / Migration / Alternatives sections are intentionally not refreshed (per D-17.1-08): their accepted narrative still holds. This Amendment section preserves the historical "why did this change" narrative without rewriting the locked reasoning.

## Amendment: Phase 29 (2026-05-31)

Phase 29 (UXG-07) adds a human-readable **summary line** to the `error` / `warning` output composition without changing severity routing:

1. `shared/notify.ts` adds a file-private `buildSummaryLine(message, severity)` helper (co-located with `computeSeverity`, decomposed into `countFailedOperations` / `countSkippedOperations` / `operationPhrase`). It counts the operations that drive the computed severity, by type (plugin vs marketplace), via the same `NotificationMessage` traversal `computeSeverity` performs and the same `allBenign` predicate. The verb is `failed` for error severity and `skipped` for warning severity (D-29-03/04).
2. For `error` / `warning` severity, `notify()` now composes `{summary}\n\n{cascade body}` (the reload-hint, if any, stays last) rather than emitting the bare cascade body. **Info** severity is byte-unchanged -- no summary line (D-29-02).
3. `computeSeverity` remains active and the severity arg is still dispatched via the Pi-API magic-string second-argument convention exactly as before (D-29-01). The summary line is a body-composition change only; it does not alter the second arg or the reload-hint ladder.

This gives the host `Error:` / `Warning:` prefix a meaningful sentence to introduce ("focus on the operation, not what happened to each plugin -- the cascade body already shows that"). The REQUIREMENTS.md UXG-07 spec (suppress the severity label by routing cascades to `info`) is **superseded** by the user decision captured in D-29-01/02: the label + color pair is kept, and the prefix is made meaningful by the prepended summary instead. The summary line is computed structurally, not caller-supplied, so the "no top-level free text" invariant (D-17-09) is preserved. `docs/output-catalog.md` error/warning byte blocks and the `docs/messaging-style-guide.md` Severity Routing section were updated in lockstep (Plan 29-02). `notifyUsageError()` is out of scope and byte-unchanged.

The Decision section above reflects the post-amendment state for severity routing; this Amendment records the summary-line composition layered on top of it (per D-17.1-08: the accepted narrative is not rewritten).

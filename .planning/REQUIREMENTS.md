# Requirements: pi-claude-marketplace v1.4 -- Structured Notification Messages

**Defined:** 2026-05-25
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Milestone Goal

Replace v1.3's string-based notify API + 34-rule ESLint drift-guard plugin with a type-driven structured `NotificationMessage` payload. Simultaneously simplify the user-output spec to a single uniform shape: every output renders a marketplace header at column 0 with plugin rows indented two spaces.

**Source-of-truth artifact:** `docs/adr/v2-001-structured-notify.md` (commit `492d9c4`). The ADR predates several v1.4 design refinements (status renames, `PluginStatus`/`MarketplaceStatus` enums, `Dependency` closed set, always-marketplace-header spec change, per-plugin causes, dropped trailer). The ADR is refreshed during this milestone to reflect the locked design (SNM-21).

## v1.4 Requirements (Active)

### Type Model

- [ ] **SNM-01**: `NotificationMessage` type defined in `shared/notify.ts` with shape `{ marketplaces: readonly MarketplaceNotificationMessage[] }`. No `severity` field (computed). No `trailer` field (reload hint computed; no top-level cause).
- [ ] **SNM-02**: `MarketplaceNotificationMessage` type defined with shape `{ name: string; scope: Scope; status?: MarketplaceStatus; details?: MarketplaceDetails; plugins: readonly PluginNotificationMessage[] }`.
- [ ] **SNM-03**: `PluginNotificationMessage` defined as a discriminated union on `status` with 10 variants: `installed`, `updated`, `reinstalled`, `uninstalled`, `available`, `unavailable`, `upgradable`, `failed`, `skipped`, `manual recovery`. Each variant pins `status` to its literal string for TypeScript narrowing.
- [ ] **SNM-04**: `PluginStatus` type derived from `PluginNotificationMessage["status"]` via indexed access; serves as the canonical closed enum for validators, fixture iterators, and external functions that need the bare status list.
- [ ] **SNM-05**: `MarketplaceStatus` type defined directly as `"added" | "removed" | "updated" | "failed"`.
- [ ] **SNM-06**: `Dependency` type defined as `"agents" | "mcp"`. Each `installed` / `updated` / `reinstalled` plugin variant carries required `dependencies: readonly Dependency[]` (empty array = no soft deps).
- [ ] **SNM-07**: `MarketplaceDetails` type defined for the list context (autoupdate state, last-updated timestamp). Optional on `MarketplaceNotificationMessage`.
- [ ] **SNM-08**: `UsageErrorMessage` type defined with shape `{ message: string; usage: string }`.
- [ ] **SNM-09**: `failed` plugin variant carries optional `rollbackPartial?: readonly { phase: string; cause?: Error }[]`. No separate `rollback failed` status -- rollback partial is structurally a sub-state of `failed`.
- [ ] **SNM-10**: `failed` and `manual recovery` plugin variants carry optional `cause?: Error`. Causes are per-plugin -- the v1.3 top-level cause-chain trailer is retired.
- [ ] **SNM-11**: All plugin variants except `available` / `unavailable` carry optional `scope?: Scope` representing the orphan-fold case (plugin's scope differs from parent marketplace's scope). `available` / `unavailable` carry no scope at all (MSG-PL-6 carve-out preserved).

### Public API

- [ ] **SNM-12**: `notify(ctx: ExtensionContext, message: NotificationMessage): void` exported from `shared/notify.ts`. The single public entrypoint for state-change notifications.
- [ ] **SNM-13**: `notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void` exported from `shared/notify.ts`. The single public entrypoint for argv-validation errors.
- [ ] **SNM-14**: `notify()` computes severity from contents: any plugin or marketplace `status === "failed"` → error; any plugin status in `{skipped, manual recovery}` → warning; otherwise success. No caller-supplied severity.
- [ ] **SNM-15**: `notify()` emits the reload-hint trailer (`/reload to pick up changes`) when contents indicate state change: any plugin status in `{installed, updated, reinstalled, uninstalled}` or any marketplace status set. No caller-supplied flag.
- [ ] **SNM-16**: `notify()` probes each declared `Dependency` at notify time (no caller-supplied probe state). `agents` → pi-subagents probe; `mcp` → pi-mcp-adapter probe. Emits `{requires pi-subagents}` / `{requires pi-mcp}` marker per absent probe on the corresponding plugin row.
- [ ] **SNM-17**: `notify()` internal switch over plugin/marketplace `status` is the SOLE site that knows the user-output grammar. Uses `assertNever` for compile-time exhaustiveness across `PluginStatus` and `MarketplaceStatus`.
- [ ] **SNM-18**: `presentation/` composers become module-internal helpers of `notify()`. The barrel re-exports the user-facing TYPES (`NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `PluginStatus`, `MarketplaceStatus`, `Dependency`, `MarketplaceDetails`, `UsageErrorMessage`) so callers can construct payloads, but no longer exports any string-producing render functions.

### Spec & Docs

- [ ] **SNM-19**: `docs/messaging-style-guide.md` v2.0 rewritten to describe the structured type model as the binding contract. The `status_tokens` / `reasons` / `markers` / `pattern_classes` frontmatter sets are either deleted (now type-derived) or kept as a documentation aid with a drift test verifying parity against the TypeScript types.
- [ ] **SNM-20**: `docs/output-catalog.md` rewritten to reflect the always-marketplace-header spec. Every output renders a marketplace header at column 0 with plugin rows indented two spaces, including single-plugin install / update / uninstall and marketplace add / remove. Per-command sections updated with new expected byte-equal outputs.
- [ ] **SNM-21**: `docs/adr/v2-001-structured-notify.md` refreshed to reflect the locked design (status renames, `*NotificationMessage` naming, `PluginStatus`/`MarketplaceStatus` enums, `Dependency` closed set, per-plugin causes, dropped trailer, computed severity, always-marketplace-header spec change). Status flips from "Proposed" to "Accepted" with reference to the phase that landed it.

### Migration & Deletion

- [ ] **SNM-22**: All `notifySuccess` / `notifyWarning` / `notifyError` call sites across orchestrators (~20 sites) migrated to `notify(ctx, structuredMessage)`. The V1 severity-named wrappers are deleted from `shared/notify.ts`.
- [ ] **SNM-23**: All `notifyUsageError(ctx, msg, usage)` call sites across edge handlers (~13 sites) migrated to the V2 `notifyUsageError(ctx, structuredUsageError)`. The V1 three-argument signature is deleted.
- [ ] **SNM-24**: `tests/lint-rules/` directory deleted in full (34 MSG-\* rule files + 34 RuleTester companion tests + helpers + plugin shell + types).
- [ ] **SNM-25**: `tests/architecture/msg-rule-registry.test.ts` (4-way parity test) deleted.
- [ ] **SNM-26**: `tests/architecture/grammar-frontmatter.test.ts` rewritten or deleted -- replaced by the spec-vs-types drift verification from SNM-19 (closed-set membership is now compile-enforced; runtime drift test only needed if style-guide retains the frontmatter sets as a documentation aid).
- [ ] **SNM-27**: `eslint.config.js` cleaned of all 34 MSG-\* rule wirings. Added: `no-restricted-syntax` rule blocking `ctx.ui.notify` calls outside `shared/notify.ts`; `no-console` rule with per-file override for `persistence/migrate.ts` (IL-3 sanctioned legacy-migration warn).
- [ ] **SNM-28**: `tests/architecture/no-legacy-markers.test.ts` reviewed and updated for v2 vocabulary (the 5 ES-5 legacy markers it blocks remain relevant; the test's closed-set source may need to migrate from style-guide frontmatter to the new type definitions).
- [ ] **SNM-29**: `shared/grammar/` files (`status-tokens.ts`, `reasons.ts`, `markers.ts`, `pattern-classes.ts`) either deleted (closed sets now type-encoded) or retained as the `Reason` / `Marker` enum source and re-exported from `shared/notify.ts`. Either path preserves the binding contract; pick at phase plan time.

### Test Coverage

- [ ] **SNM-30**: Per-status unit tests on `notify()` switch: one test or test block per variant of `PluginNotificationMessage` and per value of `MarketplaceStatus`. Each test passes a structured payload with a mock `ctx`, asserts on the exact string passed to `ctx.ui.notify`. Covers empty `plugins: []`, single-plugin, multi-plugin, orphan-fold (`scope?` set), `rollbackPartial`, multi-cause cascades.
- [ ] **SNM-31**: `tests/architecture/catalog-uat.test.ts` rewritten to feed structured `NotificationMessage` fixtures through `notify()` (via mock ctx) and assert byte-equality against `docs/output-catalog.md` per-command expected outputs. The byte-equality assertion remains the user-contract gate.
- [ ] **SNM-32**: `npm run check` GREEN after all migrations land: typecheck + ESLint (with new stock rules) + Prettier + tests (1249 v1.3 baseline minus retired lint-rule tests, plus the new per-variant unit tests; expected net change accounted for in the phase plan).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-locale message support | Still deferred (IL-1) -- v1.4 stays English-only |
| Telemetry / event sink for notification emissions | Still deferred (IL-4) -- no metrics, no analytics endpoint |
| JSON output mode for notifications | Backlog -- structured payloads make it cheaper later but not in v1.4 |
| Multi-process notification serialization | Out -- concurrent notifies remain safe via Pi host serialization |
| Codegen wrappers from style-guide YAML | Rejected in ADR alternatives -- adds a build step the type system can handle directly |
| Optional `notify*` per-outcome typed wrappers | Rejected -- the payload IS the API; per-method wrappers added autocomplete win that's already available from the discriminated-union literal on `kind:` |

## Traceability

Phase mapping populated by `gsd-roadmapper` after roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SNM-01 | TBD | Pending |
| SNM-02 | TBD | Pending |
| SNM-03 | TBD | Pending |
| SNM-04 | TBD | Pending |
| SNM-05 | TBD | Pending |
| SNM-06 | TBD | Pending |
| SNM-07 | TBD | Pending |
| SNM-08 | TBD | Pending |
| SNM-09 | TBD | Pending |
| SNM-10 | TBD | Pending |
| SNM-11 | TBD | Pending |
| SNM-12 | TBD | Pending |
| SNM-13 | TBD | Pending |
| SNM-14 | TBD | Pending |
| SNM-15 | TBD | Pending |
| SNM-16 | TBD | Pending |
| SNM-17 | TBD | Pending |
| SNM-18 | TBD | Pending |
| SNM-19 | TBD | Pending |
| SNM-20 | TBD | Pending |
| SNM-21 | TBD | Pending |
| SNM-22 | TBD | Pending |
| SNM-23 | TBD | Pending |
| SNM-24 | TBD | Pending |
| SNM-25 | TBD | Pending |
| SNM-26 | TBD | Pending |
| SNM-27 | TBD | Pending |
| SNM-28 | TBD | Pending |
| SNM-29 | TBD | Pending |
| SNM-30 | TBD | Pending |
| SNM-31 | TBD | Pending |
| SNM-32 | TBD | Pending |

**Coverage:**
- v1.4 requirements: 32 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 32 (will be 0 after roadmap)

---

*Requirements defined: 2026-05-25*
*Last updated: 2026-05-25 -- initial v1.4 definition derived from `docs/adr/v2-001-structured-notify.md` and locked design discussion.*

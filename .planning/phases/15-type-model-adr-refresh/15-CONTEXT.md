# Phase 15: Type Model & ADR Refresh - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure TypeScript type definitions in `extensions/pi-claude-marketplace/shared/notify.ts` plus refresh of the source-of-truth ADR at `docs/adr/v2-001-structured-notify.md`. Zero runtime impact: the existing V1 `notifySuccess/Warning/Error/notifyUsageError` wrappers stay intact and continue to back every call site. No `notify(ctx, NotificationMessage)` consumer exists yet (Phase 16). No call sites migrate (Phases 18-20). No teardown (Phase 21).

Scope:

1. Add the new type model (`NotificationMessage`, `MarketplaceNotificationMessage`, 10-variant `PluginNotificationMessage` discriminated union on `status`, derived `PluginStatus`, `MarketplaceStatus`, `Dependency`, `MarketplaceDetails`, `UsageErrorMessage`) to `shared/notify.ts` per SNM-01..SNM-11.
2. Ship runtime `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` `as const` arrays alongside the types so derived literal unions and downstream fixture iteration share one source.
3. Add a compile-time proof file at `tests/architecture/notify-types.test.ts` that locks closed-set membership AND per-variant structural invariants.
4. Refresh `docs/adr/v2-001-structured-notify.md` end-to-end to reflect the locked single-`notify(ctx, payload)` design and flip status `Proposed → Accepted` with a forward reference to Phase 15.

`npm run check` stays GREEN; no call site references the new types yet (success criterion #4).

</domain>

<decisions>
## Implementation Decisions

### Per-variant field discipline (Reasons, Dependencies, Version)

- **D-15-01:** `reasons: readonly Reason[]` is a REQUIRED field only on the 5 variants that emit a `{<reason>}` brace in v1.3 output: `unavailable`, `upgradable`, `skipped`, `failed`, `manual recovery`. Empty array allowed. The other 5 variants (`installed`, `updated`, `reinstalled`, `uninstalled`, `available`) omit the field entirely. Emitting `(installed) {up-to-date}` becomes a compile error.
- **D-15-02:** `dependencies: readonly Dependency[]` is REQUIRED only on `installed` / `updated` / `reinstalled` (per SNM-06). The other 7 variants do NOT carry the field. The Phase 16 renderer's per-dependency probe path is only reachable from those 3 switch arms.
- **D-15-03:** `Reason` is imported unchanged from `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- the 28-entry runtime array + drift test against `docs/messaging-style-guide.md` YAML frontmatter stay intact. Three entries (`rollback partial`, `requires pi-subagents`, `requires pi-mcp`) become structurally absorbed by `rollbackPartial[]` / `dependencies[]` probes and won't appear in any typed Reason field, but the runtime array is unchanged in Phase 15. Phase 21 (SNM-29) makes the survive/retire call.
- **D-15-04:** `version` field placement: optional `version?: string` on `installed` / `uninstalled` / `reinstalled` / `available` / `unavailable` / `upgradable` / `failed` / `skipped` / `manual recovery`. The `updated` variant carries REQUIRED `from: string; to: string` instead (mirrors v1.3's `v1.0 → v1.2` arrow rendering). Hash-version contract (PI-7 `hash-<12hex>`) remains a plain string -- no branded type.

### Marketplace-level shape

- **D-15-05:** `MarketplaceDetails = { autoupdate: boolean; lastUpdatedAt?: string }`. `autoupdate` is REQUIRED boolean (record always knows enabled/disabled). `lastUpdatedAt?: string` is ISO timestamp matching `persistence/state-io.ts:70` exactly. No source field, no version field, no other entries. Used on the `marketplace list` surface only.
- **D-15-06:** `MarketplaceNotificationMessage.status?: MarketplaceStatus` and `MarketplaceNotificationMessage.details?: MarketplaceDetails` are independent optionals (matches SNM-02 as written). The two never co-occur in practice -- Phase 16 renderer ignores `details` when `status` is set -- but the type does not structurally constrain that. Mirrors v1.3 `MarketplaceRow`'s independent `status?` / `marker?` pattern.
- **D-15-07:** `MarketplaceStatus = "added" | "removed" | "updated" | "failed"` -- 4 values, no `"skipped"`. Confirms SNM-05 as locked. v1.3's marketplace-skipped rendering case is treated as a downstream-verification item: researcher must read `docs/output-catalog.md` (and Phase 17 confirms via the catalog rewrite) that every v1.3 marketplace-skipped emission re-routes through one of the 4 new statuses (likely `updated` with an empty `plugins: []`) or is rendered structurally via the always-marketplace-header spec.
- **D-15-08:** Empty `plugins: []` IS the explicit `(no plugins)` rendering on the list surface; on state-change paths (`add` / `remove` / `update`), an empty `plugins` array is the normal case -- the renderer emits the marketplace header alone. No separate `noPlugins` discriminator field. Phase 16 renderer's switch branches on `status` presence.
- **D-15-09:** Empty top-level `marketplaces: []` IS the explicit `(no marketplaces)` rendering on the `marketplace list` surface. State-change paths always populate at least one marketplace. No top-level `noMarketplaces` discriminator.

### Compile-check + runtime const arrays

- **D-15-10:** Compile-time proof lives at `tests/architecture/notify-types.test.ts` (standalone file under `tests/architecture/`, consistent with v1.3's `grammar-frontmatter.test.ts` and `msg-rule-registry.test.ts` precedent). Uses `type _Assert_* = ...` blocks; node:test runner counts the file via a trivial `assert.equal(1, 1)` body. Failures surface in `npm run check` test output.
- **D-15-11:** Ship runtime `as const` arrays in `shared/notify.ts` alongside the types: `PLUGIN_STATUSES = ['installed', 'updated', 'reinstalled', 'uninstalled', 'available', 'unavailable', 'upgradable', 'failed', 'skipped', 'manual recovery'] as const`, `MARKETPLACE_STATUSES = ['added', 'removed', 'updated', 'failed'] as const`, `DEPENDENCIES = ['agents', 'mcp'] as const`. Derive `PluginStatus`, `MarketplaceStatus`, `Dependency` via `(typeof X)[number]`. SNM-04 is still satisfied (PluginStatus IS derived via indexed access -- just from the tuple instead of the union literal). Phase 16 per-variant tests + Phase 17 catalog UAT fixtures iterate the runtime arrays.
- **D-15-12:** The compile-check file locks per-variant structural invariants beyond just closed-set membership: `cause?` exists only on `failed` / `manual recovery`; `rollbackPartial?` exists only on `failed`; `scope?` exists on all variants except `available` / `unavailable` (SNM-11); `dependencies` exists only on `installed` / `updated` / `reinstalled` (D-15-02); `reasons` exists only on the 5 status-with-{reason} variants (D-15-01); `from` / `to` exist only on `updated` (D-15-04). One `type _Assert_<invariant> = ...` block per rule. Mirrors `tests/architecture/no-legacy-markers.test.ts`'s "enforce-the-rule-once" pattern.

### ADR refresh

- **D-15-13:** Full Decision / Consequences rewrite. Replace the per-outcome wrapper code snippets (`notifyPluginInstalled` / `notifyMarketplaceAdded` / ...) with one `notify(ctx, payload)` snippet plus the discriminated-union shape. Cover: status renames (`PluginStatus` / `MarketplaceStatus` named enums), `*NotificationMessage` type names, `Dependency` closed set, per-plugin causes, dropped top-level trailer, computed severity, always-marketplace-header spec change. Flip status `Proposed → Accepted` with forward reference to Phase 15. Keep Context section intact.
- **D-15-14:** Resolve both "Open questions" inline and delete the section. Q1 (cascade-section abstraction) answered by single `PluginNotificationMessage` union + always-marketplace-header spec -- no separate abstraction needed. Q2 (runtime validation of Scope/Reason/StatusToken) answered by compile-enforced discriminated union + `assertNever` in `notify()` switch -- no runtime validator.
- **D-15-15:** Migration section rewritten to cite concrete phase numbers -- Phase 16 (renderer + public API alongside V1, byte-equal), Phase 17 (spec rewrite + catalog UAT structured-fixture migration), Phases 18-20 (call-site migration waves: marketplace / plugin / edge+UsageError), Phase 21 (V1 wrapper deletion + lint plugin teardown + GREEN gate). REQUIREMENTS.md's traceability table is the drift mitigation if numbers shift.
- **D-15-16:** Alternative 2 ("single `notify`, no typed wrappers") flipped from Rejected → ACCEPTED with a note explaining that discriminated-union literal narrowing on `status:` recovers per-outcome-wrapper autocomplete ergonomics without the per-wrapper file maintenance cost; `assertNever` in the switch retains the compile-error gate. Alternative 3 stays rejected with original reasoning. Alternatives 1, 4, 5, 6 stay rejected with original reasoning. Honest about the design pivot.

### Claude's Discretion

- The exact `type _Assert_*` formulation for each per-variant invariant in the compile-check file (e.g. extracting `{ [K in PluginStatus]: Extract<PluginNotificationMessage, { status: K }> extends never ? never : K }` vs. one-off `Extract<PluginNotificationMessage, { status: "failed" }>["cause"] extends Error | undefined ? true : false` patterns). Multiple valid TypeScript idioms exist; planner picks per readability.
- Naming of per-variant interfaces inside the discriminated union (e.g., `PluginInstalledMessage` / `PluginUpdatedMessage` exported separately vs. inline anonymous variants in one big union literal). v1.3's `compact-line.ts` uses named per-variant interfaces (`PluginInlineRow`, `PluginCascadeRow`, etc.) -- planner is free to follow that precedent or use inline variants if the file stays under a reasonable size.
- Whether to export `Reason` (and `Marker` if used) from `shared/notify.ts` as a re-export of `shared/grammar/reasons.ts` for a single-import surface, or leave callers to import from both. Either preserves the drift test.
- Commit granularity within Phase 15 (one commit for types, one for compile-check file, one for ADR -- vs. one big commit). Both are atomic-per-plan compliant.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth design

- `docs/adr/v2-001-structured-notify.md` -- Current ADR (170 lines, status: Proposed). Phase 15 refreshes this to Accepted with full Decision/Consequences rewrite per D-15-13..D-15-16. The current ADR's per-outcome wrapper design is OBSOLETE -- the final shipped design is single `notify(ctx, NotificationMessage)`.
- `.planning/REQUIREMENTS.md` §"Type Model" SNM-01..SNM-11 -- Locked type-shape requirements for `NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `PluginStatus`, `MarketplaceStatus`, `Dependency`, `MarketplaceDetails`, `UsageErrorMessage`, `rollbackPartial`, `cause`, orphan-fold `scope?`.
- `.planning/REQUIREMENTS.md` §"Spec & Docs" SNM-21 -- ADR refresh requirement.
- `.planning/ROADMAP.md` §"Phase 15" -- Goal statement + 4 success criteria.

### v1.3 binding artifacts (downstream-consumed but informative for Phase 15 shape choices)

- `docs/messaging-style-guide.md` v1.0 -- v1.3 binding style contract; the renderer-time grammar IS Phase 16's responsibility but Phase 15's type model encodes the closed sets the style guide locks (status tokens, reasons, markers, pattern classes). Read before deciding per-variant required-vs-optional field discipline.
- `docs/output-catalog.md` v1.0 -- Per-command byte-equal expected outputs. Source of truth for which v1.3 emissions exist in each variant (informs D-15-01, D-15-04, D-15-07).

### Source files Phase 15 touches

- `extensions/pi-claude-marketplace/shared/notify.ts` -- Current V1 wrapper file (97 lines, 4 exported wrappers). Phase 15 ADDS new types + const arrays; does NOT modify or delete the V1 wrappers.

### Source files Phase 15 reads but does not modify

- `extensions/pi-claude-marketplace/shared/types.ts` -- `Scope = "user" | "project"` (locked closed enum used by every new type variant).
- `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- `Reason` closed enum (28 entries) + `REASONS as const` runtime array. Imported (not re-implemented) by new type model per D-15-03.
- `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` -- Pattern reference for "runtime `as const` array + derived literal union" (D-15-11 follows this pattern).
- `extensions/pi-claude-marketplace/presentation/compact-line.ts` -- v1.3 `RowSpec` discriminated-union pattern reference (named per-variant interfaces joined in a union). Pattern reference for the new `PluginNotificationMessage` union.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` line 70 -- `lastUpdatedAt?: string` ISO field shape that `MarketplaceDetails.lastUpdatedAt?` mirrors (D-15-05).
- `tests/architecture/grammar-frontmatter.test.ts`, `tests/architecture/msg-rule-registry.test.ts`, `tests/architecture/no-legacy-markers.test.ts` -- Pattern references for the new `tests/architecture/notify-types.test.ts` file (D-15-10).

### Phase boundary

- `.planning/PROJECT.md` §"Current Milestone: v1.4 Structured Notification Messages" -- Top-level milestone context including the net-LoC-delta target (~4300 LoC removed across v1.4) and the always-marketplace-header spec change rationale.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` -- Pattern template: `export const STATUS_TOKENS = [...] as const; export type StatusToken = (typeof STATUS_TOKENS)[number];`. Phase 15's `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` arrays + derived literal unions copy this shape exactly.
- `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- Imported as-is by the new plugin variants for `Reason` (per D-15-03). No reimplementation, no parallel definition.
- `extensions/pi-claude-marketplace/shared/types.ts` `Scope = "user" | "project"` + `SCOPES` const tuple -- `MarketplaceNotificationMessage.scope` and the orphan-fold `scope?` on most plugin variants reuse this type directly.
- `extensions/pi-claude-marketplace/presentation/compact-line.ts` `RowSpec` union -- v1.3 discriminated-union-with-named-interfaces pattern. Planner can mirror it for `PluginNotificationMessage` (each variant as a separate exported interface joined in the union) or use inline anonymous variants.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` `MarketplaceRecord.lastUpdatedAt?: string` -- Phase 15's `MarketplaceDetails.lastUpdatedAt?: string` mirrors this field shape so list-surface orchestrators can pass the record's value through unchanged.

### Established Patterns

- **"Runtime `as const` array + derived literal union"** -- Established in `shared/grammar/*.ts`. Phase 15 extends to `shared/notify.ts` for the 3 new closed sets. Drift tests live under `tests/architecture/`.
- **Discriminated union on a literal-string field** -- v1.3 `RowSpec` discriminates on `kind: "plugin-inline" | "plugin-cascade" | ...`. The new `PluginNotificationMessage` discriminates on `status: "installed" | "updated" | ...` instead. Same `switch(payload.status)` + `assertNever` exhaustiveness pattern.
- **Architecture tests under `tests/architecture/`** -- `grammar-frontmatter.test.ts`, `msg-rule-registry.test.ts`, `no-legacy-markers.test.ts` are the existing precedents. Phase 15 adds `notify-types.test.ts` alongside.
- **Per-variant field carve-outs via `Extract<StatusToken, "x" | "y">`** -- v1.3 `PluginCascadeRow.status` uses `Extract<StatusToken, "installed" | "updated" | ...>` to narrow the per-row allowed statuses. Phase 15's per-variant interfaces use `status: "installed"` (single literal) -- narrower but same idiom.
- **D-11 layering (`shared/` is the lowest layer)** -- `shared/notify.ts` cannot import from `presentation/` / `persistence/` / `domain/` / `orchestrators/` / `edge/`. Only imports allowed: `shared/types.ts` (for `Scope`), `shared/grammar/reasons.ts` (for `Reason`). Phase 15 stays inside this boundary.

### Integration Points

- **V1 wrappers stay co-located** -- `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError` (V1, 3-arg) remain in `shared/notify.ts` after Phase 15. Phase 16 will ADD `notify(ctx, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` (V2, 2-arg) alongside them; Phase 21 deletes V1.
- **Compile-check file integration with `npm run check`** -- `tests/architecture/notify-types.test.ts` runs in the existing test runner; the file's body must include a node:test `test()` block (even if trivial) so the runner counts it. Same pattern as `grammar-frontmatter.test.ts`.
- **No call-site touchpoints** -- Success criterion #4 explicitly requires zero runtime references to the new types outside their own declarations and the compile-check file. The new types are pure declarations + a closed-system proof; the rest of the codebase doesn't know they exist until Phase 16.

</code_context>

<specifics>
## Specific Ideas

- **Catalog example anchors used during discussion:** `● commit-commands [user] v1.2.3 (installed)` (single-plugin installed); `● commit-commands [user] v1.0 → v1.2 (updated)` (updated, arrow form); `⊘ hookify [user] (unavailable) {hooks}` (unavailable with reason); `⊘ unknown@claude-plugins-official (failed) {not found}` (failed with reason). These map to specific variant shapes: D-15-04 covers version placement; D-15-01 covers reasons placement.
- **The 3 structurally-absorbed Reason entries** -- `rollback partial` (now in `rollbackPartial: readonly { phase; cause? }[]`), `requires pi-subagents` (now computed from `dependencies: ["agents"]` + render-time probe), `requires pi-mcp` (now computed from `dependencies: ["mcp"]` + render-time probe). They stay in the v1.3 `REASONS` runtime array through Phase 15, but won't appear in any typed `reasons` field of the new model. Phase 21 (SNM-29) decides whether `shared/grammar/` retires or stays.
- **The `"manual recovery"` literal with a space** -- Status literal is `"manual recovery"` (matches v1.3 `STATUS_TOKENS`). Not `"manual-recovery"` or `"manualRecovery"`. Spaces in discriminator literals are TypeScript-legal and the renderer in Phase 16 emits the literal token directly into the `(<status>)` slot.

</specifics>

<deferred>
## Deferred Ideas

- **Branded `Version` type with `hash-<12hex>` / semver validation** -- Phase 15 keeps `version: string`. A branded type with constructor-level validation is an over-engineering risk for a phase that ships only types. Backlog if catalog UAT later wants stricter shape proofs.
- **`source?: ParsedSource` on `MarketplaceDetails`** -- Would let a future v1.4.x emit `claude-plugins-official [user] (github)` rows without a type change. v1.4 catalog doesn't emit source on list rows; YAGNI for the milestone. Revisit if Phase 17's catalog rewrite reveals a need.
- **Splitting `MarketplaceNotificationMessage` into discriminated `StateChange` vs. `ListEntry` variants** -- Would compile-error the `status` + `details` co-occurrence. Rejected per D-15-06 in favor of independent optionals. Revisit if Phase 16 unit tests find the co-occurrence is a real footgun.
- **Pruning `Reason` to a v1.4-active subset (`Exclude<Reason, "rollback partial" | "requires pi-subagents" | "requires pi-mcp">`)** -- Would forbid the 3 structurally-absorbed reasons at compile time. Rejected for Phase 15 per D-15-03 (couples Phase 15 to a partial SNM-29 outcome). Revisit in Phase 21 alongside the `shared/grammar/` retire-or-keep decision.
- **In-file `type _Assert = ...` block in `shared/notify.ts`** -- Rejected as the primary surface per D-15-10; planner has discretion to add small in-file assertions that prove self-referential claims (e.g., `PluginStatus extends PluginNotificationMessage["status"]`) if doing so reduces file-crossing complexity.
- **Separate `v2-002-notify-single-entrypoint.md` ADR superseding v2-001** -- Rejected per D-15-13 in favor of refreshing v2-001 in place. Revisit only if a future v1.5+ design pivot requires preserving the v1.4 ADR as a historical record.

### Reviewed Todos (not folded)

None -- `gsd-sdk query todo.match-phase 15` returned 0 matches.

</deferred>

---

*Phase: 15-Type Model & ADR Refresh*
*Context gathered: 2026-05-25*

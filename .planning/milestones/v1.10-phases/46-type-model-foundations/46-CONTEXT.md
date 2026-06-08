# Phase 46: Type-Model Foundations - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Reshape `shared/notify.ts` (+ `shared/types.ts`) so the message shapes that *permitted*
the v1.10 attribution drift become **unrepresentable**. Four type-model deliverables
(TYPE-01..04):

1. A dedicated marketplace-not-added `NotificationMessage` variant carrying only the fields
   it renders -- no placeholder `marketplaceScope`/`marketplaceDetails`, no runtime renderer
   carve-out.
2. Structural reasons (`not added`) that cannot be type-combined with content reasons.
3. A single-source `isInfoKind` exhaustiveness guard with `assertNever` across all four
   info-kind consumers.
4. A co-occurrence-constrained `MarketplaceNotificationMessage` (discriminated union).

**This phase is a pure type-model foundation.** It changes ZERO rendered bytes for any
v1.0-v1.9 command. The actual attribution *behavior* corrections (install / uninstall /
reinstall / update misattributing the marketplace-missing condition; raw throws in
marketplace ops; lying fallback reasons; cross-scope blind spot) are **Phases 47-48** and
are explicitly out of scope here.

</domain>

<decisions>
## Implementation Decisions

### New variant generality (TYPE-01)
- **D-46-01:** Cut ONE **general reusable** variant in Phase 46, not a narrow info-only
  one. Shape: `MarketplaceNotAddedMessage { readonly kind: "marketplace-not-added";
  readonly name: string; readonly scope?: Scope }` -- the 6th arm of `NotificationMessage`.
  It carries **only** the fields the row renders (no placeholder
  `marketplaceScope`/`marketplaceDetails`). The info construction sites build it in Phase 46;
  install/uninstall/reinstall/update/remove/autoupdate reuse the **same** variant in
  Phases 47-48 (no re-cut). This matches the ROADMAP's "the Phase 46 variant" reuse framing
  and supersedes BACKLOG #2's narrower `plugin-info-scope-mismatch` proposal.
- **D-46-01a (rendered form, byte-neutral):** The variant renders byte-identical to today's
  `renderPluginInfo` `{not added}` carve-out -- a bare column-0 row
  `⊘ <name> [scope?] (failed) {not added}` where `name` carries the **marketplace** name.
  `scope` omitted ⇒ no bracket (absent-from-both); `scope` present ⇒ `[scope]` bracket
  (scope-mismatch). Catalog evidence: `docs/output-catalog.md:890,900,1016,1021,1031`.

### Structural-reason encoding (TYPE-02)
- **D-46-02:** Minimal `Exclude`: `type ContentReason = Exclude<Reason, "not added">`. Every
  row `reasons` field is retyped to `readonly ContentReason[]` (the cascade
  `PluginNotificationMessage.reasons` and the marketplace skipped-arm reasons). `not added`
  is reachable **only** via `MarketplaceNotAddedMessage.kind` -- it no longer shares the open
  `Reason[]` field with content reasons on any row. `reasons: ["not added", "permission
  denied"]` becomes a **compile error**, not a render-time `length === 1` guard.
- **D-46-02a:** `REASONS` stays the single 29-member tuple; `Reason = (typeof REASONS)[number]`
  unchanged. The `REASONS.length === 29` length-lock and `"not added" extends Reason`
  membership assert in `notify-types.test.ts` are untouched. No new REASONS member, no
  two-tuple partition.

### Marketplace message union shape (TYPE-04)
- **D-46-03:** `MarketplaceNotificationMessage` becomes a **full per-status discriminated
  union** -- one arm per `MarketplaceStatus` (`added` / `removed` / `updated` / `failed` /
  `autoupdate enabled` / `autoupdate disabled` / `skipped`) plus a list/inventory arm
  (status omitted). `reasons` (`ContentReason[]`) reachable **only** on the `skipped` arm;
  `details` reachable **only** on the list/inventory arm; common fields `name` / `scope` /
  `plugins` on every arm. The renderer's status switch narrows to exactly one arm per `case`
  with an `assertNever` tail -- adding a marketplace status becomes a compile error at every
  construction site and renderer case. (Chosen over a coarser 3-arm field-grouping for
  maximal per-status exhaustiveness.)
- **D-46-03a:** This is forward-compatible with Phase 48: today the `failed` marketplace arm
  does NOT carry mp-level reasons (the reason rides a child plugin row, e.g.
  `orchestrators/marketplace/update.ts:741`), so "reasons only on skipped" matches the
  current renderer and Phase 48's `marketplace add`/`remove` failures can follow the existing
  child-row pattern.

### isInfoKind guard membership (TYPE-03)
- **D-46-04:** Single `isInfoKind` type-predicate enumerated in **exactly one place**,
  covering all **5 standalone-rendered kinds**: the 4 read-only info surfaces
  (`marketplace-info`, `plugin-info`, `marketplace-info-cascade`, `plugin-info-cascade`)
  **plus** `marketplace-not-added`. All four consumers route through that one guard, each
  with an `assertNever` exhaustiveness tail (3 of 4 lack it today --
  `computeSeverity`, `buildSummaryLine`, `shouldEmitReloadHint`; only `dispatchInfoMessage`
  and the `notify()` cascade gate have it). Per-consumer behavior for the new arm:
  `computeSeverity` → `error`; `buildSummaryLine` → `""`; `shouldEmitReloadHint` → `false`;
  `notify()` early-dispatch → `dispatchInfoMessage`. The guard is documented as
  "standalone-dispatched kinds"; the name `isInfoKind` is kept per TYPE-03 wording even
  though the set now includes a failure kind. Adding a new standalone kind = compile error
  in all four consumers.

### Byte boundary / phase scope (TYPE-01..04 landing)
- **D-46-05:** **Strict byte-neutral foundation.** Phase 46 changes ZERO rendered bytes for
  any v1.0-v1.9 command. It is limited to: (a) the variant + `ContentReason` + per-status mp
  union + `isInfoKind`/`assertNever`; (b) switching the **3** confirmed info construction
  sites to the variant (`orchestrators/plugin/info.ts`, `orchestrators/marketplace/info.ts`
  `buildNotAddedMessage`, and the standard-path coexistence); (c) re-keying the existing info
  catalog / UAT / `notify-v2` fixtures to the new shapes while asserting **identical** bytes.
  **No new catalog states.** All new `(failed) {not added}` op byte forms + their catalog
  states land in Phases 47-48 **with** the behavior change. No anticipatory/pre-staged op
  fixtures in 46.

### Atomic landing (locked, carried forward -- not re-decided)
- **D-46-06:** The variant, the guards, the type reshape, and any catalog / UAT / notify-v2
  fixtures that change shape land in **one atomic commit** -- no intermediate RED state
  (atomic-supersession lesson, NFR-6). `npm run check` exits 0 at the single commit.
- **D-46-07:** The variant is the **6th** `NotificationMessage` arm -- update the union-arity
  assert in `notify-types.test.ts` (`_Assert_NotifFiveArms` → `_Assert_NotifSixArms`; the
  legacy `_Assert_NotifFourArms` constant also exists and may be retired/kept per the
  executor's judgment).

### Claude's Discretion
- Exact internal interface names for the per-status marketplace arms (e.g. `MpAddedRow`,
  `MpSkippedRow`, `MpListRow`) and the variant type name -- refine to match repo conventions.
- Whether `isInfoKind` exposes a dedicated `StandaloneKind` type alias for the predicate
  (`m is StandaloneKind`) or narrows inline.
- The precise `notify-types.test.ts` assert constants proving the new shapes (placeholder
  fields gone, illegal reason mix rejected, per-status co-occurrence, 6-arm arity, compile-fail
  / `@ts-expect-error` for a hypothetical new kind).
- Whether to retire `_Assert_NotifFourArms` or keep it alongside the 6-arm assert.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Driving research & origin
- `.planning/research/v1.10-attribution-audit.md` -- the 23-finding audit driving the whole
  milestone. Theme 5 (type foot-guns B-1..B-8) is the direct input for Phase 46: B-1/M-5
  (placeholder + carve-out → TYPE-01), B-2 (illegal reason mix → TYPE-02), B-3 (mp-message
  co-occurrence → TYPE-04), B-7 (4-consumer re-enumeration, 3 lack `assertNever` → TYPE-03).
- `.planning/BACKLOG.md` -- the two originating items: "Install error misattribution when
  marketplace is missing" (#1, → Phase 47) and "Structural `{not added}` variant for
  `PluginInfoMessage`" (#2, → TYPE-01; note D-46-01 generalizes #2's narrow proposal).

### Type model (the files Phase 46 reshapes)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `NotificationMessage` union
  (defs ~777), `PluginInfoMessage` (~661) + `renderPluginInfo` carve-out (~1954),
  `MarketplaceNotificationMessage` (~580), `REASONS` (~69) + `Reason` (~101),
  `computeSeverity` (~1391), `buildSummaryLine` (~1535), `shouldEmitReloadHint` (~1595),
  `dispatchInfoMessage` (~2045) + `notify()` dispatch (~2106).
- `extensions/pi-claude-marketplace/shared/types.ts` -- `Scope` (the `scope?` field type).
- `extensions/pi-claude-marketplace/shared/errors.ts` -- `assertNever(x: never)` (~12).

### Construction sites (switch to the new variant)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` -- `buildNotAddedMessage`
  (~88) with the placeholder `marketplaceScope: scope ?? "user"` + `marketplaceDetails:
  { autoupdate: false }`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- the `(a)` not-added branch.

### Byte-locked contract (must stay GREEN / byte-identical)
- `docs/output-catalog.md` -- the byte contract; `{not added}` states at lines 890, 900,
  1016, 1021, 1031 (the states re-keyed in 46).
- `docs/messaging-style-guide.md` -- closed-set grammar contract (status tokens / reasons /
  markers / pattern classes).
- `extensions/pi-claude-marketplace/tests/architecture/catalog-uat.test.ts` -- byte-equality runner.
- `extensions/pi-claude-marketplace/tests/architecture/notify-types.test.ts` -- type-level
  asserts (union arity `_Assert_NotifFiveArms`, `REASONS.length === 29`, shape asserts); the
  TYPE-01..04 type proofs land here.
- `extensions/pi-claude-marketplace/tests/shared/notify-v2.test.ts` -- renderer unit suite.

### Milestone context
- `.planning/ROADMAP.md` §"Phase 46: Type-Model Foundations" -- goal + 5 success criteria.
- `.planning/PROJECT.md` -- milestone goal; canonical-reason lock (reuse `not added`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderPluginInfo`'s `{not added}` carve-out body (`notify.ts:1964-1979`) becomes the
  dedicated renderer for `MarketplaceNotAddedMessage` -- same `joinTokens([ICON_UNINSTALLABLE,
  name, scope-bracket, renderVersion, "(failed)", composeReasons])` shape, lifted out of the
  predicate.
- `assertNever` (`shared/errors.ts:12`) -- the exhaustiveness tail for the 4 consumers + the
  per-status mp renderer switch.
- `composeReasons`, `joinTokens`, `ICON_UNINSTALLABLE`, `renderVersion`, `renderScopeBracket`
  -- reused unchanged by the variant renderer.

### Established Patterns
- Closed-set tuple + `(typeof X)[number]` + length-lock + `_Assert_*` bidirectional-`extends`
  shape asserts in `notify-types.test.ts` -- the variant/union proofs follow this exact idiom.
- Discriminated union on `kind` with a REQUIRED literal on info-surface arms / OPTIONAL `kind?`
  on the cascade arm (so `{ marketplaces: [...] }` type-checks); `notify()` narrows via
  `message.kind ?? "cascade"`. The new variant adds a 6th REQUIRED-`kind` arm.
- Atomic-supersession: type + fixtures land in one commit, no RED intermediate (v1.3 ES-5,
  v1.4 patterns).

### Integration Points
- `notify()` early-dispatch (~2106) + `dispatchInfoMessage` switch (~2058) -- add the
  `marketplace-not-added` case routing to its renderer.
- The 4 info-kind consumers (`computeSeverity` ~1391, `buildSummaryLine` ~1535,
  `shouldEmitReloadHint` ~1595, `notify()` early-dispatch ~2106) -- all retrofitted to call the
  single `isInfoKind` guard + `assertNever`.
- Every `MarketplaceNotificationMessage` construction site (cascade producers across
  `orchestrators/marketplace/{add,remove,update,autoupdate,list}.ts`,
  `orchestrators/plugin/{update,reinstall,list}.ts`, `import/execute.ts`) must produce a
  fully-typed per-status arm after D-46-03 -- a mechanical but broad sweep.

</code_context>

<specifics>
## Specific Ideas

- The variant name in the type sketches reviewed during discussion was
  `MarketplaceNotAddedMessage` with `kind: "marketplace-not-added"` (final name at executor's
  discretion).
- The `info` model is the **canonical target** the whole milestone copies: `(failed)
  {not added}` on the marketplace subject. Phase 46 makes that model the only representable
  shape for the condition.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 47 open question (NOT decided here):** how bulk/cascade plugin ops emit the
  `marketplace-not-added` variant -- as a standalone top-level message (the precondition fails
  before any cascade, matching info's single-emission model) vs. embedded as a row within a
  `CascadeNotificationMessage`. The Phase 46 variant is a TOP-LEVEL union arm (matches info);
  the multi-target emission/embedding model is a Phase 47 design decision. Flag for Phase 47
  research/planning.
- **Audit B-4 / B-5 / B-6 / B-8 (med/lo type foot-guns, NOT in v1.10 TYPE-01..04 scope):**
  empty-array `reasons: []` sentinel; `outcome.reasons[0]`-only narrowing; mutable
  `MarketplaceBlock` accumulator in `import/execute.ts`; `NotificationMessage` union
  over-breadth. Potential future type-hardening; explicitly out of scope for this milestone.
- **`marketplace add` failed-with-reason rendering (Phase 48):** D-46-03a notes the per-status
  union keeps `reasons` off the `failed` mp arm; Phase 48 must decide whether `add` precondition
  failures render via the existing child-row pattern or warrant a union change. Not a Phase 46
  concern.

</deferred>

---

*Phase: 46-type-model-foundations*
*Context gathered: 2026-06-07*

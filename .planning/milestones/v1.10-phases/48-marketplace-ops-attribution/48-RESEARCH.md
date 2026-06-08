# Phase 48: Marketplace-Ops Attribution - Research

**Researched:** 2026-06-07
**Domain:** TypeScript discriminated-union message attribution; marketplace-op orchestrator error-routing; closed-set reason rendering on the marketplace subject; NFR-5 network-policy enforcement
**Confidence:** HIGH (internal-correctness refactor; every claim verified against live code, the Phase 46 type model, the byte catalog, and the catalog-uat/notify-types proofs)

## Summary

Phase 48 finishes the v1.10 convergence by making the four marketplace ops (`autoupdate`/`noautoupdate`, `remove`, `add`, `update`) route their precondition failures through `notify(...)` as structured `(failed)` rows with closed-set reasons, instead of throwing raw past the orchestrator or lying about the blocker. Three of the four reuse Phase 46/47 primitives verbatim: `autoupdate`/`noautoupdate`/`remove` of a missing marketplace converge on the standalone `MarketplaceNotAddedMessage` `(failed) {not added}` variant (ATTR-05, ATTR-06), and `update`'s path-source manifest failure is a reason-classification fix on an already-structured `(failed)` path (ATTR-10). The one genuinely new surface is `marketplace add` (ATTR-07): its five precondition reasons (`duplicate name`, `stale clone`, `unsupported source`, `source missing`, `invalid manifest`) are content reasons that must render ON the marketplace subject -- and the Phase 46 type model **cannot represent `(failed) {<content-reason>}` on a marketplace row today** (D-46-03a left the `MpFailed` arm with no `reasons` field, and `add` precondition failures have no plugin child rows to carry the reason).

The linchpin decision (#1) resolves in favor of a **surgical addition of `reasons?: readonly ContentReason[]` to the `MpFailed` arm** plus a small `renderMpHeader` `failed`-arm edit. The two alternatives both fail: the child-row pattern (b/a) requires synthesizing a phantom plugin row under the marketplace header (visually wrong -- `add` has no plugins, and the reason belongs to the marketplace, not a fabricated plugin), and the `marketplace-not-added` variant only carries the hard-coded `{not added}` brace (it cannot express `duplicate name`). The surgical `reasons?` addition is the smallest change that renders the required byte forms truthfully; it is a controlled relaxation of one D-46-03a `@ts-expect-error` (which must be inverted to a positive proof), and it does not weaken TYPE-02 (the structural `not added` marker stays excluded because the field type is `ContentReason[]`, not `Reason[]`).

**Primary recommendation:** Add `reasons?: readonly ContentReason[]` to the `MpFailed` interface; teach `renderMpHeader`'s `failed` arm to append `composeReasons(mp.reasons, false, false, probe)`; invert the `_NoReasonsOnMpFailed` proof in notify-types.test.ts to `_Assert_ReasonsOnMpFailed`. Route `add`'s five precondition errors and `remove`/`autoupdate`'s missing-marketplace through `notify` with try/catch discipline at the edge handlers (or orchestrator-internal catch mirroring Phase 47's `MarketplaceNotAddedSignal`). Classify `update`'s path-source manifest failure to `invalid manifest`, never `network unreachable`.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Canonical reason for marketplace-absent: reuse the existing `not added` REASONS member + the Phase 46 `MarketplaceNotAddedMessage` variant (NOT a new member).
- `marketplace add` reasons reuse the EXISTING `REASONS` members (`duplicate name`, `stale clone`, `unsupported source`, `source missing`, `invalid manifest`) -- already defined; this phase routes them through `notify`. No new REASONS member expected.
- Atomic-supersession: any catalog/UAT/type/fixture changes that change shape land together with the behavior change in one GREEN commit (no intermediate RED); `npm run check` exits 0.
- Reuse Phase 47's `MarketplaceNotAddedSignal` (now exported from `orchestrators/plugin/shared.ts`) if a signal-raise/catch pattern fits the marketplace-op edge handlers.

### Claude's Discretion (planner MUST resolve these three explicitly in PLAN)
1. **How `marketplace add` / `remove` structured `(failed)` rows render their content reason** (THE LINCHPIN -- resolved below in Decision D-48-A; recommendation: surgical `reasons?` on `MpFailed`).
2. **Reason classification for the path-source manifest failure (ATTR-10):** map `SyntaxError` / schema validation `Error` to `invalid manifest`; ensure `network unreachable` cannot fire on a path source; confirm NFR-5 (resolved in Decision D-48-B).
3. **Edge-handler try/notify discipline:** the shape of the try/catch → notify wrapper for remove/update/add edge handlers (resolved in Decision D-48-C).

### Deferred Ideas (OUT OF SCOPE -- Phase 49)
- Cross-op convergence proof + GREEN-gate close -- Phase 49.
- Phase 47 deferrals folded into Phase 49 holistic reason review: IN-01 (install M1 zero-delta save) + IN-02 (preflightUpdate concurrent-removal `{not in manifest}` reason).
- Audit B-4/B-5/B-6/B-8 (med/lo type foot-guns) -- out of scope for v1.10.
- ATTR-09 cascade/cleanup reason fixes in `remove.ts::narrowCascadeFailure` -- **closed in Phase 47 for plugin ops; remove.ts's `narrowCascadeFailure` is NOT in Phase 48 scope** (it maps per-plugin cascade failures, not the marketplace-existence precondition). Do NOT touch it.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATTR-05 | `marketplace autoupdate`/`noautoupdate` of a missing marketplace reports `{not added}` consistently whether scope is explicit or the name is missing in every scope (no reason-less failed row, no `{not found}`) | Sites S1 (per-scope failure path, autoupdate.ts:167-187) + S2 (missing-everywhere path, autoupdate.ts:196-215). Both currently emit a `(failed)` with either `["not found"]` or NO reason. Re-route both to standalone `MarketplaceNotAddedMessage`. |
| ATTR-06 | `marketplace remove` of a missing marketplace renders a structured `(failed) {not added}` instead of throwing `MarketplaceNotFoundError` raw past the orchestrator | Sites S3 (remove.ts:183-185 raw throw inside guard) + S4 (remove.ts:167-169 `resolveScopeFromState` raw throw for bare form) + edge S9 (remove handler has no try/catch). |
| ATTR-07 | `marketplace add` surfaces precondition failures (duplicate name, stale clone, unsupported source, missing path source, invalid manifest) as structured `(failed)` rows with closed-set reasons, instead of raw throws | Sites S5a-S5e (add.ts: unknown-source 116-118, unsupported-kind 120-124, duplicate 250-252/335-337, stale clone 256-258, path-source not-found stat 315 ENOENT, invalid manifest via `loadMarketplaceManifest`) + edge S9. **Depends on Decision D-48-A** (MpFailed reasons). |
| ATTR-10 | path-source manifest failure during `marketplace update` reports a manifest-specific reason, never `{network unreachable}` (NFR-5: path-source touches no network) | Site S7 (update.ts:733-738 `reasonsFromCascadeError(err) ?? ["network unreachable"]` default fires for a path-source `SyntaxError`/schema-`Error`). Decision D-48-B classifies path-source manifest failures to `invalid manifest`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Marketplace-existence precondition check (remove/autoupdate) | Orchestrator (marketplace/*.ts) | persistence (loadState in guard) | The precondition is a property of state; it must fail before/at the guard, routed through notify, not thrown. |
| `add` precondition classification (dup/stale/unsupported/source-missing/invalid-manifest) | Orchestrator (marketplace/add.ts) | shared/errors.ts (typed error classes) + domain/source.ts + domain/manifest.ts | The typed errors already exist; the orchestrator maps each to a closed-set `ContentReason` and routes via notify. |
| Marketplace `(failed) {<reason>}` rendering | shared/notify.ts (`renderMpHeader` failed arm + `MpFailed.reasons`) | -- | Single renderer site; D-48-A type/renderer touch lands here. |
| Marketplace-not-added rendering | shared/notify.ts (`renderMarketplaceNotAdded`) | -- | Phase 46 deliverable; reused verbatim for ATTR-05/06. |
| Path-source manifest reason classification (ATTR-10) | Orchestrator (marketplace/update.ts `refreshOneMarketplace` catch + `reasonsFromCascadeError`) | shared/notify.ts REASONS (closed set) | NFR-5: classification must distinguish path (no network) from github source. |
| Edge try/notify discipline | edge/handlers/marketplace/{add,remove,update}.ts | shared/notify.ts | No precondition error may escape raw to the Pi runner (IL-2). |
| Notify chokepoint (severity/reload/summary) | shared/notify.ts (`notify`) | -- | All user-visible output flows here (IL-2). |

## Standard Stack

No new packages. This phase edits existing first-party TypeScript only. The relevant in-repo "stack" is the Phase 46 type model + the existing marketplace orchestrators + the four typed error classes.

### Core (existing, reused or surgically extended)
| Symbol | Location | Purpose | Phase 48 action |
|--------|----------|---------|-----------------|
| `MarketplaceNotAddedMessage` + `renderMarketplaceNotAdded` | shared/notify.ts:869-873, 2103-2115 | Standalone `⊘ <mp> [scope?] (failed) {not added}` | REUSE verbatim for ATTR-05/06 (autoupdate/noautoupdate/remove missing-mp). |
| `MarketplaceNotAddedSignal` | orchestrators/plugin/shared.ts:107-118 | Exception class hoisting marketplace-existence precondition to entrypoint, caught and re-attributed to the standalone variant | REUSE (Phase 47 WR-02) -- import into marketplace orchestrators OR mirror the catch pattern at the edge. |
| `MpFailed` interface | shared/notify.ts:613-615 | `(failed)` marketplace block, currently NO reasons (D-46-03a) | **EXTEND: add `reasons?: readonly ContentReason[]`** (Decision D-48-A). |
| `renderMpHeader` `"failed"` arm | shared/notify.ts:1070-1071 | Renders `⊘ <name> [<scope>] (failed)` | **EXTEND: append `composeReasons(mp.reasons, false, false, probe)`** (Decision D-48-A). |
| `ContentReason` | shared/notify.ts:114 | `Exclude<Reason, "not added">` | The type of the new `MpFailed.reasons` field -- keeps `not added` structurally OUT (TYPE-02 preserved). |
| `composeReasons` | shared/notify.ts:1281-1302 | Composes `{<r>, <r>}` brace; returns `""` when empty | REUSE in the `failed` arm exactly as the `skipped` arm already does. |
| `notify(ctx, pi, message)` | shared/notify.ts:2251+ | The single IL-2 chokepoint | All Phase 48 emissions route through it. |
| `MarketplaceDuplicateNameError` / `StaleSourceCloneError` / `MarketplaceNotFoundError` / `MarketplaceUpdateError` | shared/errors.ts:143-176 | The typed precondition errors `add`/`remove`/`update` already throw | Classify via `instanceof` (NOT substring) into closed-set reasons. |

### Supporting (closed-set REASONS members reused -- all already defined, NONE new)
| Reason | REASONS index | Used by | Trigger |
|--------|---------------|---------|---------|
| `not added` (structural) | 28 | ATTR-05, ATTR-06 | missing marketplace (autoupdate/noautoupdate/remove) -- via `MarketplaceNotAddedMessage`, NOT via `MpFailed.reasons` |
| `duplicate name` | 21 | ATTR-07 | `MarketplaceDuplicateNameError` (add.ts:250-252, 335-337) |
| `stale clone` | 20 | ATTR-07 | `StaleSourceCloneError` (add.ts:256-258) |
| `unsupported source` | 7 | ATTR-07 | parser `kind: "unknown"` (add.ts:116-118) + valid-but-unsupported kinds url/git-subdir/npm (add.ts:120-124) |
| `source missing` | 26 | ATTR-07 | path-source `stat` ENOENT / "neither file nor directory" (add.ts:315, 325-327) |
| `invalid manifest` | 5 | ATTR-07, ATTR-10 | `loadMarketplaceManifest` schema/parse failure (add path + update path-source) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Surgical `MpFailed.reasons?` (D-48-A) | Synthetic child `PluginFailedMessage` row under the marketplace header (the cascade/update-mp-failure pattern) | `add` has NO plugins; a fabricated `⊘ <mp>\n  ⊘ (<mp>) (failed) {duplicate name}` row attributes the reason to a phantom plugin, not the marketplace. Visually + semantically wrong for a single-marketplace command. REJECTED. |
| Surgical `MpFailed.reasons?` (D-48-A) | The `marketplace-not-added` variant | Only carries the hard-coded `{not added}` brace; cannot express `duplicate name` / `stale clone` / etc. Fits ONLY the ATTR-05/06 missing-mp cases. REJECTED for ATTR-07. |
| Surgical `MpFailed.reasons?` (D-48-A) | A NEW dedicated `marketplace-add-failed` top-level variant | Heavier than needed; re-cuts the union for one op; the `MpFailed` arm already renders the exact `⊘ <mp> [scope] (failed)` byte prefix -- only the reason brace is missing. REJECTED (milestone "no new mechanism unless required" lean). |

**Installation:** None. `npm run check` is the only gate.

**Version verification:** N/A -- no external packages added.

## Package Legitimacy Audit

Not applicable -- this phase installs no external packages. All work is edits to existing first-party TypeScript under `extensions/pi-claude-marketplace/` and `tests/`. No `npm install`, no registry interaction. Package Legitimacy Gate is a no-op for this phase.

## Decision D-48-A: How `marketplace add`/`remove` `(failed)` rows render their reason (THE LINCHPIN) -- RECOMMENDED

**Add `reasons?: readonly ContentReason[]` to the `MpFailed` arm; teach `renderMpHeader`'s `failed` arm to compose the reason brace; invert the D-46-03a `_NoReasonsOnMpFailed` proof.**

### Why the marketplace-not-added variant does NOT cover ATTR-07
`MarketplaceNotAddedMessage` (`renderMarketplaceNotAdded`, notify.ts:2103-2115) hard-codes `composeReasons(["not added"], ...)`. Its brace is always `{not added}`. The `add` precondition failures need `{duplicate name}` / `{stale clone}` / `{unsupported source}` / `{source missing}` / `{invalid manifest}` -- none of which are `not added`. The variant fits ONLY the ATTR-05/06 missing-mp cases (where the reason genuinely IS `not added`). **ATTR-05/06 reuse the variant; ATTR-07 cannot.**

### Why the child-row pattern is wrong
The update/autoupdate mp-level-failure recipe (synthesize a `PluginFailedMessage` child carrying `cause`) works there because those ops conceptually act on the marketplace's plugins. `marketplace add` has NO plugins (`plugins: []` always, add.ts:182). Embedding the reason on a fabricated child row would render `⊘ <mp> [scope] (failed)\n  ⊘ (<mp>) (failed) {duplicate name}` -- the reason is attributed to a phantom plugin named `(<mp>)`, and the marketplace header carries a bare `(failed)`. The reason belongs to the **marketplace subject**. REJECTED.

### Why the surgical `reasons?` addition is the smallest correct change
The `MpFailed` arm already renders the exact byte prefix `⊘ <name> [<scope>] (failed)` (notify.ts:1070-1071). The ONLY missing capability is appending the reason brace -- which the `skipped` arm already does via `composeReasons` (notify.ts:1092). Mirroring that one line onto the `failed` arm is the minimal delta. The field is typed `readonly ContentReason[]` (NOT `Reason[]`), so the structural `not added` marker stays unrepresentable on it -- **TYPE-02 is preserved, not weakened**.

### Exact deltas the planner must apply (all in ONE GREEN commit per atomic-supersession)

**1. Type model -- `shared/notify.ts:613-615`** (`MpFailed` interface):
```typescript
/**
 * `(failed)` marketplace block. Carries OPTIONAL mp-level `reasons?`
 * (D-48-A): a marketplace-op precondition failure with NO plugin child rows
 * (e.g. `marketplace add` duplicate-name / unsupported-source) renders its
 * closed-set reason on the marketplace subject. `reasons?` is
 * `readonly ContentReason[]` so the structural `"not added"` marker stays
 * unrepresentable here (TYPE-02) -- that condition is the dedicated
 * `MarketplaceNotAddedMessage` variant. When omitted/empty the brace
 * collapses (composeReasons returns ""), preserving the bare
 * `⊘ <name> [<scope>] (failed)` byte form for the existing
 * update/autoupdate mp-failure states that carry the cause on a child row.
 */
interface MpFailed extends MpCommon {
  readonly status: "failed";
  readonly reasons?: readonly ContentReason[];
}
```

**2. Renderer -- `shared/notify.ts` `renderMpHeader` `case "failed"` (line 1070-1071):**
```typescript
case "failed": {
  // D-48-A: append the closed-set reason brace iff `mp.reasons` is present
  // and non-empty (marketplace-op precondition failure with no plugin child
  // rows, e.g. `marketplace add`). Pass (false, false) for the soft-dep
  // declares-flags -- mp-level rows never emit soft-dep markers (mirrors the
  // "skipped" arm). composeReasons returns "" when reasons is undefined/empty,
  // so the existing bare `(failed)` byte form (update/autoupdate mp-failure
  // states that ride the cause on a child row) is preserved unchanged.
  const reasonsBrace = composeReasons(mp.reasons, false, false, probe);
  return reasonsBrace === ""
    ? `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed)`
    : `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed) ${reasonsBrace}`;
}
```
The arm must become a block `{ ... }` (it is currently a single-line `return`). Note `mp` already narrows to `MpFailed` inside the case, so `mp.reasons` is accessible.

**3. Type proof -- `tests/architecture/notify-types.test.ts:1043-1044`:** invert the negative proof to a positive one (the `@ts-expect-error` would otherwise fire "Unused @ts-expect-error" once the field exists):
```typescript
// D-48-A: the failed mp arm now carries OPTIONAL reasons (ContentReason[])
// so a marketplace-op precondition failure with no plugin child rows can
// render its closed-set reason on the marketplace subject. TYPE-02 preserved:
// the field is ContentReason[], so the structural "not added" stays out.
type _Assert_ReasonsOnMpFailed = _MpFailed["reasons"] extends
  | readonly ContentReason[]
  | undefined
  ? true
  : never;
export const _mrf: _Assert_ReasonsOnMpFailed = true;
```
The `_NoDetailsOnMpFailed` proof at line 1045-1046 STAYS (details still must not appear on the failed arm). Update the TYPE-04 block comment (1024-1025) to read "reasons on skipped AND failed, details only on the list arm."

**4. Catalog comment** at `docs/output-catalog.md:374`-region and the `marketplace add` section header (841-843): note the failed header MAY now carry a reason brace. The existing `failure-unreachable` (add, 867-872), `mp-failure-network` (update, 1187-1192), and `failure-not-found` (autoupdate, 1245-1250) bare-`(failed)` states are UNCHANGED (they pass `reasons` omitted → brace collapses).

### Blast-radius check (verified)
- `composeReasons` is already imported/used inside `renderMpHeader` (the `skipped` arm), so no new import.
- `_NoReasonsOnMpFailed` (notify-types.test.ts:1044) is the ONLY `@ts-expect-error` that references `MpFailed["reasons"]`; inverting it is a single-site edit. (Verified via grep -- no other consumer reads `MpFailed.reasons`.)
- `computeSeverity` arm 1 already routes `mp.status === "failed"` to `"error"` regardless of reasons (notify.ts:1571-1574) -- no severity change needed; the new reason brace does not alter routing.
- `countFailedOperations` (notify.ts:1626-1639) counts `mp.status === "failed"` -- the summary line "N marketplace operations failed." already fires for these states; UNCHANGED.
- `shouldEmitReloadHint` is plugin-row-driven only (notify.ts:1778-1789) -- a reason-bearing failed marketplace still emits NO reload-hint. Correct.

## Decision D-48-B: Path-source manifest-failure reason classification (ATTR-10) -- RECOMMENDED

**In `refreshOneMarketplace`'s catch (update.ts:718-744), classify the failure by SOURCE KIND, mapping a path-source manifest failure to `invalid manifest` and NEVER falling back to `network unreachable`.**

### The bug (Site S7, update.ts:733-738)
```typescript
const typedReasons = reasonsFromCascadeError(err);
const failedRow: PluginFailedMessage = {
  status: "failed",
  name,
  reasons: typedReasons ?? (["network unreachable"] as const),  // ← LIES for path source
  cause: ...,
};
```
`reasonsFromCascadeError` (update.ts:510-539) classifies only `PluginShapeError` + EACCES/EPERM/ENOENT/ENOTDIR. A path-source `marketplace.json` that is malformed JSON throws a bare `SyntaxError` (from `JSON.parse` in `loadMarketplaceManifest`, manifest.ts:52), and a schema-invalid manifest throws a bare `Error("marketplace.json schema invalid: ...")` (manifest.ts:54-59). Neither carries an errno code nor is a `PluginShapeError`, so `reasonsFromCascadeError` returns `undefined` → the `?? ["network unreachable"]` default fires. For a path source (NFR-5: no network) this is a lying network reason -- the audit's M-3 / Class A+D finding.

### Two correct shapes (planner picks; both satisfy ATTR-10)

**Option B1 (recommended -- narrow at the catch, source-kind-aware):** Read the record's source kind (already in scope via `snapshotAfterRefresh` → the `record.source.kind`; or re-read in the catch) and choose the default by kind:
- path source: default to `["invalid manifest"]` (never `network unreachable`).
- github source: keep `["network unreachable"]` as the catch-all (a github refresh failure with no errno IS plausibly network/clone).

Because the `name`/`scope` are in scope but the record is inside `snapshotAfterRefresh`, the cleanest implementation threads the source kind out: capture `record.source.kind` into the thrown `MarketplaceUpdateError` (add a `sourceKind` field) OR re-derive it in `refreshOneMarketplace` from a `loadState` read of the record (NFR-5-safe -- `loadState` only). The `MarketplaceUpdateError` carries `cause` already; adding a `sourceKind` discriminator to it is the lowest-friction path and keeps the classification at the catch.

**Option B2 (extend `reasonsFromCascadeError`):** Add a branch that recognizes a manifest-invalid error structurally. The `loadMarketplaceManifest` schema error is a bare `Error` whose message starts `marketplace.json schema invalid:`, and malformed JSON is a `SyntaxError`. A structural test (`err instanceof SyntaxError`) plus a typed manifest-error class would be the non-substring approach. **The codebase prefers typed dispatch over substring matching** (audit + Phase 47 D-47-B). RECOMMENDATION: introduce a typed `InvalidMarketplaceManifestError` (or reuse a structural `SyntaxError` check + a manifest-error wrapper) in `domain/manifest.ts` so `loadMarketplaceManifest` throws a classifiable error; then `reasonsFromCascadeError` maps it to `["invalid manifest"]`. This also benefits ATTR-07's add path (same `loadMarketplaceManifest` failure → `invalid manifest`).

**The decisive constraint:** the `network unreachable` default MUST NOT be reachable on the path-source code path. Whichever option, the planner MUST add a test asserting a path-source malformed/schema-invalid manifest renders `⊘ <mp> [scope] (failed) {invalid manifest}` (NOT `{network unreachable}`) and that ZERO gitOps methods are called (an `NFR-5: path-source update calls zero gitOps methods` test already exists at update.test.ts:845 -- extend it / add a sibling for the failure path).

### NFR-5 confirmation
The path-source branch of `refreshRecord` (update.ts:387-388) calls only `validateManifestAtRoot(record, record.marketplaceRoot)` → `loadMarketplaceManifest` (a `readFile` + parse). NO `gitOps`, NO `platform/git`, NO network. The only network surface is the `source.kind === "github"` branch (refreshGitHubClone). **NFR-5 is already structurally honored on the path code path; the bug is purely the lying REASON, not an actual network call.** The fix is reason-only.

> `[ASSUMED]` (A1): whether the planner introduces a typed `InvalidMarketplaceManifestError` (B2) or threads `sourceKind` through `MarketplaceUpdateError` (B1) is a structural judgment. Both satisfy ATTR-10. B2 (typed manifest error) is the more reusable and better matches the typed-dispatch convention, but it touches `domain/manifest.ts` (a hot, cached path read). Verify B2 does not break the manifest negative-cache (manifest-cache.ts re-throws the SAME error until the file changes -- a typed error survives that fine, but confirm the cache stores/re-throws the typed instance).

## Decision D-48-C: Edge-handler try/notify discipline -- RECOMMENDED

**Two viable shapes; the planner picks per op. Both ensure no precondition error escapes raw to the Pi runner.**

The current edge handlers (add.ts:52-59, remove.ts:45-51, update.ts:50-71, autoupdate.ts:45-52) wrap ONLY `parseCommandArgs` (for usage errors); the orchestrator call has NO surrounding try/catch. Any throw past the orchestrator boundary propagates raw to the Pi command runner -- unstyled, no `(failed)` row, no closed-set reason (audit Theme 2).

### Shape 1 (RECOMMENDED -- orchestrator-internal catch, mirrors Phase 47)
Phase 47 routed ALL marketplace-not-added through `notify` INSIDE the orchestrator (the `MarketplaceNotAddedSignal` raised by a resolver, caught at the entrypoint, emitted as the standalone variant). The edge handler stays a thin shim with no orchestrator-call catch. This is the established convention (47-03-SUMMARY: "the fix is at the orchestrator, NOT the edge"). For Phase 48:
- **`remove` (ATTR-06):** in `removeMarketplace`, before/at the guard, when `state.marketplaces[name] === undefined`, emit `notify(ctx, pi, { kind: "marketplace-not-added", name, ...(scope-bracket) })` and return -- instead of `throw new MarketplaceNotFoundError`. The bare-form (no `--scope`) miss is `resolveScopeFromState` throwing `MarketplaceNotFoundError` (S4) -- catch it at the entrypoint and emit the variant (no requestedScope → no bracket; or carry the resolved scope). The guard-internal `record === undefined` throw (S3) must be hoisted to a pre-guard `loadState` check (or caught after the guard) so the variant is emitted standalone.
- **`add` (ATTR-07):** wrap the `addMarketplace` body so each typed precondition error (`MarketplaceDuplicateNameError`, `StaleSourceCloneError`, the unsupported-source `Error`, the path-source-not-found `Error`, the `loadMarketplaceManifest` invalid-manifest `Error`) is caught and routed to `notify(ctx, pi, { marketplaces: [{ name: derivedName-or-rawSource, scope, status: "failed", reasons: [<classified>], plugins: [] }] })`. CAVEAT: `add` derives the marketplace NAME from the manifest, which for github sources requires the clone to have succeeded. For pre-clone/pre-manifest failures (unsupported source, clone failure) there is NO derived name -- use the raw source string or a sensible placeholder as the `name`. For duplicate-name/stale-clone (post-manifest), the `derivedName` is available.
- **`autoupdate`/`noautoupdate` (ATTR-05):** already mostly routes through notify (autoupdate.ts:176-187, 196-215). The two fixes: (S1) the per-scope `(failed)` with synthetic child `["not found"]` → standalone `MarketplaceNotAddedMessage`; (S2) the missing-everywhere reason-LESS `(failed)` (autoupdate.ts:202-211) → standalone `MarketplaceNotAddedMessage`. Use the `MarketplaceNotFoundError` already caught in the loop to drive the variant. NOTE: a `StateLockHeldError` is NOT a missing-marketplace -- keep its existing `(failed) {lock held}` synthetic-child routing (autoupdate.ts:129-138). Only the `MarketplaceNotFoundError` path converts to `{not added}`.

### Shape 2 (defense-in-depth edge catch)
Add a `try { await <orchestrator>(...) } catch (err) { notify(ctx, pi, <styled failed payload>) }` around the orchestrator call in each edge handler. This is a SECOND safety net but is NOT a substitute for orchestrator-internal routing (the orchestrator knows the marketplace name/scope/reason; the edge handler does not without re-deriving). RECOMMENDATION: prefer Shape 1 (orchestrator-internal) for correctness + Phase 47 consistency; the planner MAY additionally add a thin edge catch as belt-and-suspenders only if an architectural grep gate is added to enforce "no raw throw escapes" -- but that gate does not exist today, so it is optional.

> `[ASSUMED]` (A2): whether `add`'s pre-clone failures (unsupported source, clone failure) emit with the raw source string as the `name` or a placeholder is a byte-form judgment the catalog state will pin. The audit says "surface as a structured `(failed)` row" but does not prescribe the subject name when no marketplace name has been derived yet. Verify the chosen `name` against the catalog fixture and operator legibility during planning.

## Exhaustive Site Map

> **9 distinct sites** (S1-S9) verified against LIVE code (line numbers current post-Phase-47). "current" = behavior today; "target" = Phase 48 behavior; "REQ" = requirement closed.

### autoupdate.ts (ATTR-05)

**S1 -- Per-scope flip failure emits `(failed)` with synthetic child `["not found"]`.** autoupdate.ts:167-187 (`setMarketplaceAutoupdate` catch, non-collect path) + `autoupdateFailedRow` (129-138).
- Current: a non-`shouldCollectNotFound` error (i.e. explicit-scope miss, OR any non-`MarketplaceNotFoundError`) emits `notify({ marketplaces: [{ status: "failed", plugins: [autoupdateFailedRow(name, err)] }] })`; `autoupdateFailedRow` maps `StateLockHeldError → ["lock held"]` else `["not found"]`. For a `MarketplaceNotFoundError` (explicit scope), this is `(failed)` + child `{not found}` -- wrong reason/shape.
- Target: when the error is `MarketplaceNotFoundError`, emit the standalone `MarketplaceNotAddedMessage` (`{not added}`, with the explicit `[scope]` bracket). KEEP the `StateLockHeldError → (failed) {lock held}` synthetic-child path unchanged (it is NOT a missing-marketplace and is not in ATTR-05 scope).
- REQ: **ATTR-05**.

**S2 -- Missing-everywhere emits a reason-LESS `(failed)` row.** autoupdate.ts:196-215 (`missingEverywhere` path).
- Current: when a single-name flip missed in EVERY scope (collected `MarketplaceNotFoundError` from each), emits `notify({ marketplaces: [{ status: "failed", plugins: [] }] })` -- a bare `(failed)` with NO reason at all (`⊘ <mp> [scope] (failed)`). The catalog `failure-not-found` state (autoupdate, 1245-1250) documents this bare form.
- Target: standalone `MarketplaceNotAddedMessage` (`{not added}`). Since the bare-everywhere form missed in both scopes with no requested scope, decide the bracket: if `opts.scope` was explicit, carry it; if bare, use the `first.scope` (the scope where the first not-found was observed) OR omit (no bracket, "absent from both"). RECOMMENDATION: mirror Phase 47's `update`/`reinstall` bare form -- explicit scope → bracket; bare → no bracket. The `missing-everywhere` path implies a bare-or-explicit single-name flip; carry `opts.scope` when present.
- REQ: **ATTR-05** ("no reason-less failed row, no `{not found}`").

### remove.ts (ATTR-06)

**S3 -- Raw `MarketplaceNotFoundError` thrown INSIDE the guard.** remove.ts:182-185.
- Current: `const record = state.marketplaces[opts.name]; if (record === undefined) throw new MarketplaceNotFoundError(opts.name, [resolved.scope]);`. The throw escapes `withStateGuard` → `removeMarketplace` (no catch) → the edge handler (no catch) → raw to the Pi runner. Bypasses notify entirely.
- Target: do NOT throw for the missing-marketplace precondition. Hoist the existence check: either (a) pre-guard `loadState` check that, on miss, emits the standalone `MarketplaceNotAddedMessage` and returns BEFORE entering the guard, or (b) raise `MarketplaceNotAddedSignal` inside the guard and catch it at the `removeMarketplace` entrypoint (the guard re-throws on closure-throw; verify `withStateGuard` does not save on throw -- it saves on no-throw, so a signal-throw leaves state untouched, which is correct for a no-op). RECOMMENDATION: pre-guard check (cleaner; the guard then only runs when the record exists). Carry the resolved scope on the variant for the `[scope]` bracket.
- REQ: **ATTR-06**.

**S4 -- Bare-form raw `MarketplaceNotFoundError` from `resolveScopeFromState`.** remove.ts:167-169 (`resolveScopeFromState` call when `opts.scope === undefined`).
- Current: `resolveScopeFromState(opts.name, userLocations, projectLocations)` throws `MarketplaceNotFoundError` when the name is in neither scope (verified: remove.test.ts:103 asserts this throw). Escapes raw (same path as S3).
- Target: catch the `MarketplaceNotFoundError` from `resolveScopeFromState` at the entrypoint and emit the standalone `MarketplaceNotAddedMessage` (bare form → no requested scope → no bracket, "absent from both"). DO NOT modify `resolveScopeFromState` itself (it is shared by `update.ts`'s `updateMarketplace` too -- changing its throw contract would ripple; catch at the remove entrypoint instead). NOTE: `resolveScopeFromState` also throws on AMBIGUITY (name in both scopes) -- that is a DIFFERENT condition (not missing); verify the catch distinguishes "not found in any" (→ `{not added}`) from "ambiguous" (keep current behavior or its own handling). Check `resolveScopeFromState`'s implementation in marketplace/shared.ts for the exact throw discriminator.
- REQ: **ATTR-06**.

### add.ts (ATTR-07)

**S5a -- Unknown source kind.** add.ts:116-118.
- Current: `if (source.kind === "unknown") throw new Error(\`Cannot add marketplace from "${rawSource}": ${source.reason}\`)` -- raw throw, escapes (no edge catch). Test add.test.ts:260 (`MA-10: unknown source kind throws with parser's reason`) asserts the throw.
- Target: route to `notify(... status: "failed", reasons: ["unsupported source"], plugins: [] ...)`. The parser's `source.reason` rides the cause (synthetic-cause not available on `MpFailed`; reason brace carries the class). Pre-clone, pre-name: subject name = rawSource (D-48-C / A2).
- REQ: **ATTR-07**.

**S5b -- Valid-but-unsupported source kind (url/git-subdir/npm).** add.ts:120-124.
- Current: `if (source.kind !== "github" && source.kind !== "path") throw new Error(\`...unsupported source kind ${source.kind}\`)` -- raw throw. (Reachable for `url`/`git-subdir`/`npm` -- kinds the parser produces but `add` does not implement.)
- Target: `notify(... reasons: ["unsupported source"] ...)`. Same subject-name caveat as S5a.
- REQ: **ATTR-07**.

**S5c -- Duplicate name (github + path).** add.ts:250-252 (github guard) + 335-337 (path guard).
- Current: `if (derivedName in state.marketplaces) throw new MarketplaceDuplicateNameError(derivedName, locations.scope)`. For github this throw is inside the `addGithubInGuard` try (250) which appends leaks + re-throws (279-291); for path it is inside `addPathInGuard` (335). Both escape `addMarketplace` (no catch). Tests add.test.ts:167-201 assert the throw.
- Target: `notify(... name: derivedName, scope, reasons: ["duplicate name"], plugins: [] ...)`. derivedName IS available (post-manifest). For github, the leak-append cleanup (cleanupStaging) must still run -- route the notify at the `addMarketplace` entrypoint catch AFTER the guard's cleanup, classifying `err instanceof MarketplaceDuplicateNameError → ["duplicate name"]`.
- REQ: **ATTR-07**.

**S5d -- Stale clone (github only).** add.ts:256-258.
- Current: `if (await pathExists(finalDir)) throw new StaleSourceCloneError(finalDir)` inside `addGithubInGuard` try → leak-append → re-throw → escapes.
- Target: `notify(... reasons: ["stale clone"] ...)`. derivedName available.
- REQ: **ATTR-07**.

**S5e -- Path-source not found / not file-or-dir.** add.ts:315 (`stat(onDiskPath)` throws ENOENT) + 325-327 (explicit "neither a file nor a directory" throw).
- Current: `const probe = await stat(onDiskPath)` throws a `NodeJS.ErrnoException` (ENOENT) for a missing path; the else branch throws a bare `Error`. Both escape. NFR-5-safe (no network on path branch).
- Target: `notify(... reasons: ["source missing"] ...)`. The path-source `add` has no derived name (the manifest could not be read) -- subject name = rawSource (A2). Classify ENOENT/ENOTDIR → `["source missing"]`.
- REQ: **ATTR-07**.

**S5f -- Invalid manifest (github + path).** add.ts:245 (github `loadMarketplaceManifest`) + 330 (path `loadMarketplaceManifest`).
- Current: `loadMarketplaceManifest` throws a `SyntaxError` (malformed JSON) or bare `Error("marketplace.json schema invalid: ...")` (schema fail) -- escapes. Test add.test.ts:202-224 (`MA-9`) asserts a throw on invalid manifest (and the cleanupStaging leak-append).
- Target: `notify(... reasons: ["invalid manifest"] ...)`. For github, derivedName is NOT yet derived if the manifest is unreadable (derivedName is read FROM the manifest at add.ts:247) -- so for invalid-manifest the subject name = rawSource. For path, same (manifest read at 330, name derived at 332). Classify the manifest failure structurally (shared with ATTR-10's D-48-B -- a typed `InvalidMarketplaceManifestError` benefits both paths).
- REQ: **ATTR-07**.

### update.ts (ATTR-10)

**S7 -- Path-source manifest failure defaults to `network unreachable`.** update.ts:733-738 (`refreshOneMarketplace` catch).
- Current: `reasons: typedReasons ?? (["network unreachable"] as const)` -- a path-source `SyntaxError`/schema-`Error` (no errno, not `PluginShapeError`) → `reasonsFromCascadeError` returns `undefined` → `network unreachable` default fires. Lying network reason for a no-network op (NFR-5 violation, audit M-3).
- Target: classify by source kind / typed manifest error → path-source manifest failure renders `{invalid manifest}`, never `{network unreachable}`. github source keeps `network unreachable` as the catch-all default. (Decision D-48-B.)
- REQ: **ATTR-10**.

### Edge handlers (ATTR-05/06/07 -- try/notify discipline)

**S9 -- Marketplace edge handlers have no orchestrator-call try/catch.** edge/handlers/marketplace/{add.ts:52-59, remove.ts:45-51, update.ts:50-71, autoupdate.ts:45-52}.
- Current: each wraps ONLY `parseCommandArgs`; the orchestrator call (`addMarketplace`/`removeMarketplace`/`updateMarketplace`/`updateAllMarketplaces`/`setMarketplaceAutoupdate`) has NO surrounding catch.
- Target: per Decision D-48-C, route precondition errors through notify. RECOMMENDED: orchestrator-internal routing (Shape 1) so the edge handlers stay thin; the precondition errors never escape because the orchestrator catches/routes them. (Shape 2 edge-catch is optional defense-in-depth.)
- REQ: **ATTR-05, ATTR-06, ATTR-07** (the "no bare-registered handler lets a precondition error escape raw" boundary).

> **NOTE on `update` (S7) vs the `update` mp-level catch:** `refreshOneMarketplace` already catches `snapshotAfterRefresh` failures and routes through notify (update.ts:724-743). It does NOT throw raw past the orchestrator -- so `update`'s edge handler does NOT need a missing-marketplace re-route (the `MarketplaceNotFoundError` from `snapshotAfterRefresh`, update.ts:436-438, is caught and rendered as a synthetic-child `(failed)` row). ATTR-10 is purely the REASON-classification fix at S7; ATTR-02 (update missing-marketplace → `{not added}`) was already closed in Phase 47 for the PLUGIN `update` op. **Marketplace `update` of a missing marketplace is NOT in Phase 48's ATTR set** -- ATTR-10 is only the path-source lying-reason. The planner should verify whether marketplace `update <missing-mp>` should ALSO converge on `{not added}` (currently it renders a synthetic-child `(failed) {network unreachable or classified}`); if the audit/CONTEXT intends it, it is an ATTR-10-adjacent consistency item -- but the requirement text scopes ATTR-10 to the path-source lying reason only. FLAG for the planner (Open Question #1).

## Runtime State Inventory

This is a rename/refactor-adjacent (attribution) phase but with ZERO persistence/state-shape changes. Inventory completed:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no on-disk state SHAPE change. REQUIREMENTS.md Out-of-Scope explicitly excludes "State migration of already-installed records." The `not added` / precondition conditions are computed at runtime from `state.marketplaces[name]` and typed-error `instanceof`, never persisted. | None |
| Live service config | None -- no external services; TS-only correctness change. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None -- no secret/env names referenced or changed. | None |
| Build artifacts | None -- no `package.json`/build changes; pure source + test + catalog edits under `extensions/pi-claude-marketplace/`, `tests/`, `docs/output-catalog.md`. | None |

**Nothing found in any category -- verified:** behavior/attribution + type/renderer surgical touch + catalog/fixture changes; zero persistence, zero network added (NFR-5 preserved -- all new reads are `loadState`, no git), zero new dependencies, zero state-shape changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marketplace-not-added rendering (ATTR-05/06) | A new `(failed) {not added}` composer | `renderMarketplaceNotAdded` + `MarketplaceNotAddedMessage` | Phase 46 deliverable; byte-locked; routed through `isInfoKind` (error severity, no reload, no summary). Re-cutting = atomic-supersession violation. |
| Marketplace `(failed) {<reason>}` rendering (ATTR-07) | A bespoke per-op reason composer | `composeReasons(mp.reasons, false, false, probe)` in the `failed` arm (D-48-A) | Mirrors the existing `skipped` arm exactly; one-line delta; the closed-set brace discipline is already centralized. |
| Reason classification | Substring-matching error messages | `instanceof` on the typed error classes (`MarketplaceDuplicateNameError`/`StaleSourceCloneError`/`MarketplaceNotFoundError`) + a typed manifest error for D-48-B | The codebase prefers typed dispatch (audit, Phase 47 D-47-B); substring matching is the legacy fallback only. |
| Missing-marketplace signal hoisting | A per-op ad-hoc resolver throw | The Phase 47 `MarketplaceNotAddedSignal` (exported from plugin/shared.ts) OR a pre-guard `loadState` check | One pattern across plugin + marketplace ops; avoids per-op drift. |
| New REASONS member | Any new closed-set string | The 6 EXISTING members (table in Standard Stack → Supporting) | Locked OUT (REQUIREMENTS.md Out-of-Scope + CONTEXT). All reasons already exist. |
| Path-source network avoidance (NFR-5) | A network guard/check | Nothing -- the path branch already calls zero gitOps; the bug is the lying REASON, not an actual network call | NFR-5 is structurally honored; only the reason classification is wrong. |

**Key insight:** Three of four ops reuse Phase 46/47 primitives verbatim. The ONLY genuinely new mechanism is the surgical `MpFailed.reasons?` field (D-48-A) -- and even that mirrors the `MpSkipped` arm exactly. Resist the temptation to add a new variant, a new REASONS member, or a child-row workaround.

## Architecture Patterns

### Emission Flow (marketplace-op precondition failure)

```
edge handler (parse only; thin shim, NO orchestrator-call catch -- Shape 1)
  → orchestrator entrypoint (add/remove/autoupdate/update)
      → PREFLIGHT / GUARD: detect precondition failure
          ├─ missing marketplace (remove/autoupdate)
          │     → notify(ctx, pi, { kind:"marketplace-not-added", name, scope? }); return   [ATTR-05/06]
          ├─ add precondition (dup/stale/unsupported/source-missing/invalid-manifest)
          │     → classify err instanceof → ContentReason
          │     → notify(ctx, pi, { marketplaces:[{ name, scope, status:"failed",
          │                          reasons:[<reason>], plugins:[] }] }); return            [ATTR-07, D-48-A]
          └─ update path-source manifest failure
                → classify by source kind → "invalid manifest" (never "network unreachable")
                → notify(... synthetic-child failed row OR mp-level reasons ...)              [ATTR-10, D-48-B]
  → notify() → isInfoKind? → dispatchInfoMessage (error, no reload, no summary)  [not-added standalone]
            → else cascade body → renderMpHeader "failed" arm composes the reason brace
```

### Pattern 1: Standalone not-added emission (ATTR-05/06 -- copy from Phase 47)
```typescript
// Source: orchestrators/plugin/update.ts:351-357 (verified live)
notify(ctx, pi, {
  kind: "marketplace-not-added",
  name: marketplace,
  ...(requestedScope !== undefined && { scope: requestedScope }),
});
return;
```

### Pattern 2: Marketplace-level failed-with-reason emission (ATTR-07 -- enabled by D-48-A)
```typescript
// New byte form enabled by D-48-A. The `reasons` field lands on MpFailed.
notify(ctx, pi, {
  marketplaces: [
    {
      name: subjectName,   // derivedName when post-manifest; rawSource pre-manifest (A2)
      scope,
      status: "failed",
      reasons: [classifyAddError(err)],  // closed ContentReason
      plugins: [],
    },
  ],
});
return;
```

### Pattern 3: Typed reason classification (ATTR-07)
```typescript
// instanceof dispatch, NOT substring (mirrors Phase 47 D-47-B)
function classifyAddError(err: unknown): ContentReason {
  if (err instanceof MarketplaceDuplicateNameError) return "duplicate name";
  if (err instanceof StaleSourceCloneError) return "stale clone";
  if (err instanceof InvalidMarketplaceManifestError) return "invalid manifest";  // D-48-B typed error
  if (isErrnoException(err) && (err.code === "ENOENT" || err.code === "ENOTDIR")) return "source missing";
  // unsupported source: the raw Error thrown for unknown/url/git-subdir/npm kinds
  return "unsupported source";  // verify the unsupported-source classification is structural, not a default catch-all
}
```
> The `unsupported source` fallback is the one classification that is NOT instanceof-driven today (it is a bare `Error`). The planner should consider a typed `UnsupportedSourceError` (cheap) so `classifyAddError` stays fully structural and the catch-all default can be a truthful `invalid manifest` or re-thrown. `[ASSUMED]` (A3) -- verify the chosen structure pins the catalog byte form.

### Anti-Patterns to Avoid
- **Embedding the add reason on a synthetic plugin child row** -- the reason belongs to the marketplace subject; `add` has no plugins. (D-48-A rejected alternative.)
- **Using `MarketplaceNotAddedMessage` for ATTR-07 reasons** -- it hard-codes `{not added}`; cannot express `duplicate name`. (D-48-A.)
- **`?? ["network unreachable"]` on a path-source path** -- the exact NFR-5 bug (S7). Classify by source kind.
- **Substring-matching `"not found"`/`"schema invalid"`** -- use typed errors.
- **Adding a new REASONS member** -- locked OUT.
- **Modifying `resolveScopeFromState`'s throw contract** -- it is shared by `update.ts`; catch at the remove entrypoint instead (S4).
- **Re-typing `MpFailed.reasons` as `Reason[]`** -- must be `ContentReason[]` to keep `not added` structurally out (TYPE-02).

## Common Pitfalls

### Pitfall 1: Breaking the existing bare-`(failed)` marketplace states with D-48-A
**What goes wrong:** Adding the reason brace unconditionally would change the `failure-unreachable` (add), `mp-failure-network` (update), and `failure-not-found` (autoupdate) bare-`(failed)` byte forms.
**Why:** Those states emit `MpFailed` with `reasons` OMITTED (the cause rides a child row or there is no child).
**How to avoid:** `composeReasons(mp.reasons, ...)` returns `""` for undefined/empty → the brace collapses → bare `(failed)` preserved. The `reasonsBrace === ""` ternary in the renderer (D-48-A delta 2) is load-bearing. Add a regression test asserting the three existing bare-`(failed)` states are byte-unchanged.
**Warning signs:** catalog-uat byte mismatch on `failure-unreachable`/`mp-failure-network`/`failure-not-found`.

### Pitfall 2: The `_NoReasonsOnMpFailed` unused-`@ts-expect-error`
**What goes wrong:** Adding `MpFailed.reasons?` makes the `@ts-expect-error` at notify-types.test.ts:1043-1044 fire "Unused @ts-expect-error" → typecheck fails.
**How to avoid:** Invert it to a positive `_Assert_ReasonsOnMpFailed` proof IN THE SAME COMMIT (D-48-A delta 3). The `_NoDetailsOnMpFailed` proof (1045-1046) STAYS.
**Warning signs:** `npx tsc --noEmit` reports unused expect-error directive.

### Pitfall 3: github-source vs path-source classification collapse (ATTR-10)
**What goes wrong:** Mapping ALL manifest failures to `invalid manifest` would re-label a github clone/network failure as `invalid manifest`.
**How to avoid:** Classify by SOURCE KIND. github failures keep `network unreachable` as the catch-all; ONLY path-source (and explicit typed manifest errors) map to `invalid manifest`. A github source whose clone advanced but whose manifest is then malformed is genuinely `invalid manifest` -- so a typed manifest error (B2) is more precise than a source-kind default (B1). Prefer B2.
**Warning signs:** a github DNS-failure test now asserts `{invalid manifest}` instead of `{network unreachable}`.

### Pitfall 4: `add` github cleanup must still run on precondition failure
**What goes wrong:** Routing the duplicate-name/stale-clone/invalid-manifest error to notify at the entrypoint catch could skip the `cleanupStaging` + `appendLeakToError` that `addGithubInGuard`'s catch (add.ts:279-291) performs.
**How to avoid:** Let the guard's existing catch run its cleanup and re-throw; catch the (already-cleaned) error at the `addMarketplace` entrypoint and route to notify there. The leak-append rides the error's message/cause; the `MpFailed.reasons` brace carries the class. Verify MA-9's cleanupStaging assertion (add.test.ts:202-224) still holds.
**Warning signs:** a staging dir leaks after a duplicate-name add; MA-9 test fails.

### Pitfall 5: Catalog parser-coverage failure
**What goes wrong:** Adding a `<!-- catalog-state: STATE -->` without a paired FIXTURES entry (or vice versa) fails the catalog-uat coverage assertion.
**How to avoid:** Every new catalog state gets a fixture under the SAME op H2 key (e.g. `"/claude:plugin marketplace add <source>"`); amend bytes + fixtures in the SAME commit (atomic-supersession). The catalog-uat parser keys on the H2 `## \`/claude:plugin ...\`` headers (catalog-uat.test.ts:82).
**Warning signs:** `npm test` reports an unpaired catalog state or orphan fixture.

### Pitfall 6: `resolveScopeFromState` ambiguity vs not-found (remove S4)
**What goes wrong:** Blanket-catching `MarketplaceNotFoundError` from `resolveScopeFromState` and converting to `{not added}` could also swallow the ambiguity (name-in-both-scopes) case if it throws the same class.
**How to avoid:** Read `resolveScopeFromState`'s implementation (marketplace/shared.ts) to confirm the throw discriminator; only the genuine "not found in any scope" case maps to `{not added}`. Preserve any ambiguity handling.
**Warning signs:** `marketplace remove <name>` of a name in both scopes mis-renders `{not added}`.

## Code Examples

### D-48-A renderer delta (the linchpin)
```typescript
// Source: shared/notify.ts renderMpHeader (current line 1070-1071), amended
case "failed": {
  const reasonsBrace = composeReasons(mp.reasons, false, false, probe);
  return reasonsBrace === ""
    ? `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed)`
    : `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed) ${reasonsBrace}`;
}
```

### D-48-B path-source reason classification (ATTR-10)
```typescript
// Source: update.ts:733-738 refreshOneMarketplace catch, amended (Option B2 form)
const typedReasons = reasonsFromCascadeError(err);  // now also recognizes InvalidMarketplaceManifestError -> ["invalid manifest"]
const failedRow: PluginFailedMessage = {
  status: "failed",
  name,
  // github catch-all stays network; path-source manifest failure is typed -> invalid manifest
  reasons: typedReasons ?? (["network unreachable"] as const),
  cause: err instanceof Error ? err : new Error(errorMessage(err)),
};
```

## State of the Art

| Old Approach (pre-Phase-48) | Current Approach (Phase 48 target) | When Changed | Impact |
|-----------------------------|------------------------------------|--------------|--------|
| `remove`/`update` raw `MarketplaceNotFoundError` past orchestrator | routed through `notify` as `{not added}` | Phase 48 | No unstyled raw throws (ATTR-06). |
| `add` typed precondition errors thrown raw, reasons defined-but-never-routed | structured `(failed) {<reason>}` on the marketplace subject | Phase 48 | The 5 defined REASONS become reachable end-to-end (ATTR-07). |
| `autoupdate`/`noautoupdate` missing-mp → `(failed) {not found}` or reason-less `(failed)` | `{not added}` consistently (explicit + missing-everywhere) | Phase 48 | Consistent, truthful (ATTR-05). |
| path-source manifest failure → `{network unreachable}` | `{invalid manifest}` (never network on path) | Phase 48 | NFR-5 honored; honest blocker (ATTR-10). |
| `MpFailed` arm cannot carry a reason (D-46-03a) | `MpFailed.reasons?: ContentReason[]` (D-48-A) | Phase 48 | Marketplace subject can render its own closed-set reason. |

**Deprecated/outdated by Phase 46/47 (already done, do not re-do):**
- The `renderPluginInfo` `{not added}` carve-out -- gone; use the `MarketplaceNotAddedMessage` variant.
- `["not added", ...]` on any row reasons field -- compile error (ContentReason).
- Plugin-op marketplace-absent attribution (install/uninstall/reinstall/update) -- closed in Phase 47.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Path-source manifest failure is best classified via a typed `InvalidMarketplaceManifestError` (D-48-B Option B2) OR a `sourceKind`-threaded default (B1); both satisfy ATTR-10 | D-48-B | Wrong structure → either touches the cached manifest read (B2 cache re-throw must preserve the typed instance) or threads an extra field (B1). Either way the byte form is `{invalid manifest}` -- low risk to the requirement, medium risk to the cleanest implementation. Verify against manifest-cache.ts negative-cache behavior. |
| A2 | `add`'s pre-clone/pre-manifest failures (unsupported source, source missing, invalid manifest for github) use the raw source string as the `(failed)` subject `name` (no derived name available); post-manifest failures (duplicate name, stale clone) use the derived name | D-48-C / S5a/b/e/f | Wrong subject name → catalog byte form differs. The audit prescribes "structured `(failed)` row" but not the subject name when no marketplace name is derived. Verify against catalog fixture + operator legibility. |
| A3 | `unsupported source` classification may need a typed `UnsupportedSourceError` to stay fully structural (it is a bare `Error` today); without it, it is the catch-all default in `classifyAddError` | Code Examples / Pattern 3 | If left as a default catch-all, an unexpected error class could be mis-labeled `unsupported source`. Low risk (the only reachable errors at that site are the 5 enumerated); a typed error is cleaner. |
| A4 | Marketplace `update <missing-mp>` is NOT required to converge on `{not added}` by ATTR-10 (which scopes only the path-source lying reason); it currently renders a synthetic-child `(failed)` | Site map note / Open Question #1 | If the milestone intends marketplace-`update` missing-mp to also read `{not added}`, that is an additional (small) re-route. The requirement text scopes ATTR-10 narrowly; flag for planner. |

## Open Questions

1. **Should marketplace `update <missing-mp>` ALSO converge on `{not added}` (beyond ATTR-10's path-source reason fix)?**
   - What we know: ATTR-10's text scopes to "a path-source manifest failure reports a manifest-specific reason, never `{network unreachable}`." `update`'s missing-marketplace path (`snapshotAfterRefresh` → `MarketplaceNotFoundError`, update.ts:436-438) is already caught and rendered as a synthetic-child `(failed)` row -- NOT raw-thrown -- so it is not an ATTR-06-style raw-throw escape. Phase 47 closed PLUGIN `update <missing-mp>` → `{not added}`, but that is the plugin op, not `marketplace update`.
   - What's unclear: whether the milestone wants `marketplace update <missing-mp>` to render `{not added}` for cross-op consistency (Phase 49 is the convergence proof).
   - Recommendation: keep Phase 48 scoped to ATTR-10's literal path-source reason fix; FLAG marketplace-`update` missing-mp `{not added}` consistency for Phase 49 (the cross-op convergence phase) unless the planner sees a clean win folding it here. Low risk either way.

2. **Edge try/notify: Shape 1 (orchestrator-internal) only, or Shape 1 + a thin edge catch (Shape 2)?**
   - What we know: Phase 47 used orchestrator-internal routing exclusively ("the fix is at the orchestrator, NOT the edge"). No architectural grep gate enforces "no raw throw escapes" today.
   - Recommendation: Shape 1 for all four ops (consistency + the orchestrator has the name/scope/reason). Add Shape 2 (edge catch) only if the planner also adds an architectural test gating raw escapes -- optional, not required by the ATTR set.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | runtime + `node --test` | ✓ | project floor >=20.19.0 (CLAUDE.md) | -- |
| TypeScript (`tsc --noEmit`) | typecheck gate | ✓ | ^5.9.x | -- |
| ESLint / Prettier | lint + format gate | ✓ | eslint ^10.x | -- |
| `node:test` | test runner (`npm test`) | ✓ | built-in | -- |

No external services, no network (NFR-5), no new tools. `npm run check` (typecheck → ESLint → Prettier:check → `npm test`) is the single gate.

## Validation Architecture

> nyquist_validation: true (config.json) -- section REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict` |
| Config file | none (CLI invocation in package.json `test` script) |
| Quick run command | `node --test "tests/orchestrators/marketplace/add.test.ts"` (per-op; substitute file) |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier:check + `npm test`) |
| Byte-contract runner | `node --test "tests/architecture/catalog-uat.test.ts"` |
| Type-proof gate | `npx tsc --noEmit` (drives notify-types.test.ts `_Assert_*` / `@ts-expect-error`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATTR-05 | autoupdate/noautoupdate missing-mp (explicit + missing-everywhere) → standalone `{not added}` (no reason-less failed, no `{not found}`) | unit + byte | `node --test tests/orchestrators/marketplace/autoupdate.test.ts` ; catalog-uat | ✅ amend autoupdate.test.ts:292-345 (`/not found/`→`{not added}`); add catalog state(s) |
| ATTR-06 | remove missing-mp → `(failed) {not added}`, no raw `MarketplaceNotFoundError` | unit + byte | `node --test tests/orchestrators/marketplace/remove.test.ts` ; `node --test tests/edge/handlers/marketplace/remove.test.ts` ; catalog-uat | ✅ amend remove.test.ts:103-115 (throw→notify); add catalog state |
| ATTR-07 | add precondition failures (5 reasons) → `(failed) {<reason>}` on the marketplace subject | unit + byte | `node --test tests/orchestrators/marketplace/add.test.ts` ; `node --test tests/edge/handlers/marketplace/add.test.ts` ; catalog-uat | ✅ amend add.test.ts:141-267 (5 throw-asserting tests → notify-asserting); add 5 catalog states |
| ATTR-10 | path-source manifest failure → `{invalid manifest}`, never `{network unreachable}`; zero gitOps on path failure | unit + byte | `node --test tests/orchestrators/marketplace/update.test.ts` ; catalog-uat | ✅ add a path-source-invalid-manifest test (mirror WR-02 at update.test.ts:463 + NFR-5 at :845); add catalog state |
| D-48-A (type) | `MpFailed.reasons?` exists; `not added` still excluded; details still excluded | type-proof | `npx tsc --noEmit` (notify-types.test.ts) | ✅ invert `_NoReasonsOnMpFailed`→`_Assert_ReasonsOnMpFailed`; keep `_NoDetailsOnMpFailed` |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` + the touched op's `node --test tests/orchestrators/marketplace/<op>.test.ts` + `node --test tests/architecture/catalog-uat.test.ts` (byte gate after any catalog/renderer edit) + `node --test tests/architecture/notify-types.test.ts` (after the type-model edit).
- **Per wave merge:** `npm run check` (the phase converges on shared/notify.ts → serialize through one merge gate, like Phase 47).
- **Phase gate:** Full `npm run check` GREEN before `/gsd-verify-work`; `git diff --stat docs/output-catalog.md` is NON-empty this phase (bytes change) and every changed/added state has a paired fixture.

### Wave 0 Gaps
- [ ] `tests/architecture/notify-types.test.ts` -- invert `_NoReasonsOnMpFailed` to `_Assert_ReasonsOnMpFailed` (covers D-48-A type-model touch). Lands with the renderer change.
- [ ] New catalog states + FIXTURES entries:
  - `marketplace add`: `duplicate-name`, `stale-clone`, `unsupported-source`, `source-missing`, `invalid-manifest` (5 states, each `expectedSeverity: "error"`).
  - `marketplace remove`: `missing-not-added` (standalone `marketplace-not-added` fixture, mirror Phase 47 update fixtures at catalog-uat.test.ts:1084-1104).
  - `marketplace autoupdate|noautoupdate`: amend `failure-not-found` → `missing-not-added` standalone variant (and/or a second absent-from-both state).
  - `marketplace update`: `path-invalid-manifest` (mp-level or synthetic-child `(failed) {invalid manifest}`).
- [ ] Regression assertions that the 3 existing bare-`(failed)` states (`failure-unreachable` add, `mp-failure-network` update, `failure-not-found`-bare autoupdate) remain byte-unchanged after D-48-A (Pitfall 1).
- [ ] (If D-48-B Option B2) a typed `InvalidMarketplaceManifestError` + a `domain/manifest.ts` test that `loadMarketplaceManifest` throws it for malformed JSON and schema-invalid input, and a manifest-cache negative-cache test that the typed instance survives the re-throw.

*(Existing test infrastructure -- per-op orchestrator tests, edge-handler tests, the catalog-uat byte runner, the notify-types type-proof file -- covers all Phase 48 surfaces; the only genuinely-new harness need is the typed manifest error test if B2 is chosen.)*

## Security Domain

> security_enforcement not set to `false` in config.json → section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface changed; this is local CLI attribution. |
| V3 Session Management | no | N/A. |
| V4 Access Control | no | Scope is a namespace, not a security boundary. |
| V5 Input Validation | yes (existing) | Marketplace names/sources already validated at the edge + parser (`parsePluginSource`, `MARKETPLACE_VALIDATOR`); no new untrusted input. The new `MpFailed.reasons` carries only closed-set `ContentReason` literals -- never user text. |
| V6 Cryptography | no | None. |
| V12 File Resources | yes (existing, NFR-10) | Path containment (`assertPathInside`) unchanged; no new write paths. The new reads (remove pre-guard `loadState`) are read-only + containment-safe (`locationsFor`). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Network access on a no-network op (NFR-5) | Tampering / NFR-5 | ATTR-10's fix REMOVES a lying network reason; confirm the path-source code path imports no `platform/git` and calls zero gitOps (extend the `NFR-5: path-source update calls zero gitOps methods` test at update.test.ts:845). |
| Path traversal via marketplace name in the failed reason rendering | Tampering | `MpFailed.name` is rendered as text only (no path join); names are edge-/parser-validated. The reason brace is a closed-set literal, never user-derived. |
| Information disclosure via the failed reason | Information Disclosure | The 5 add reasons + `not added` reveal only the existence/shape of a same-named record or source in the user's own scope (single-user CLI). Acceptable. |
| Error message leak (raw error escaping to the Pi runner) | Information Disclosure | The WHOLE POINT of the phase: routing raw throws through `notify` REPLACES the unstyled raw error with a closed-set reason brace + (where applicable) a depth-bounded `causeChainTrailer` (the existing `cause` rendering already truncates at depth 5). No new leak surface; the change reduces leakage. |

No new security-relevant surface beyond at most one extra read-only `loadState` (remove pre-guard check). NFR-5 strengthened (a lying network reason removed); NFR-10 containment unchanged.

## Sources

### Primary (HIGH confidence -- live codebase, verified this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- REASONS (70-100), ContentReason (114), MpFailed (613-615), MpSkipped (636-639), renderMpHeader incl. failed arm (1062-1141), composeReasons (1281-1302), MarketplaceNotAddedMessage (869-873), renderMarketplaceNotAdded (2103-2115), computeSeverity (1539-1608), countFailedOperations (1626-1639), shouldEmitReloadHint (1756-1792), notify (2251+).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` -- unknown/unsupported source (116-124), duplicate name (250-252, 335-337), stale clone (256-258), path stat/ENOENT + neither-file-nor-dir (315, 325-327), loadMarketplaceManifest invalid-manifest (245, 330), success notify (176-185), github cleanup catch (279-291).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- guard raw throw (182-185), bare-form resolveScopeFromState (167-169), narrowCascadeFailure (104-148, OUT of Phase 48 scope), success/partial notify (292-344).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- refreshOneMarketplace catch + `?? ["network unreachable"]` (718-744), reasonsFromCascadeError (510-539), path branch validateManifestAtRoot (387-388), snapshotAfterRefresh MarketplaceNotFoundError (432-447), manifestContentKey WR-02 (313-330).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` -- per-scope failure + autoupdateFailedRow (129-138, 167-187), missing-everywhere reason-less failed (196-215), success flips (236-255).
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- MarketplaceNotAddedSignal (107-118), ScopedMarketplaceResolution (291-294).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- handleEnumerateFailure standalone not-added emission (348-388).
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,remove,update,autoupdate}.ts` -- all parse-only, no orchestrator-call catch (verified each).
- `extensions/pi-claude-marketplace/edge/router.ts` -- bare handler dispatch (158-197).
- `extensions/pi-claude-marketplace/shared/errors.ts` -- StaleSourceCloneError (133-140), MarketplaceDuplicateNameError (143-152), MarketplaceNotFoundError (155-166), MarketplaceUpdateError (169-176).
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- loadMarketplaceManifestUncached schema/parse throw (50-63), cache (69-83).
- `extensions/pi-claude-marketplace/domain/source.ts` -- unknown/url/git-subdir/npm kinds + reasons (65-175).
- `tests/architecture/notify-types.test.ts` -- TYPE-04 block, `_NoReasonsOnMpFailed`/`_NoDetailsOnMpFailed` (1024-1050).
- `tests/architecture/catalog-uat.test.ts` -- parser (54-130), FIXTURE shape (180-186), marketplace add (1298-1334), remove (1671-1708), update (1713-1797), autoupdate (1802-1858), marketplace-not-added fixtures (1084-1104).
- `docs/output-catalog.md` -- install not-added template (374-385), marketplace add (841-879), remove (1096-1133), update (1134-1197), autoupdate (1199-1257).
- `tests/orchestrators/marketplace/{add,remove,update,autoupdate}.test.ts` -- current throw/byte assertions (add 141-267, remove 103-115, update 463-495/845, autoupdate 292-345).
- `.planning/phases/47-plugin-ops-attribution-cross-scope/47-RESEARCH.md` + `47-03-SUMMARY.md` -- the standalone-not-added + MarketplaceNotAddedSignal convergence pattern, catalog/fixture conventions, atomic-supersession discipline.

### Secondary (MEDIUM)
- `docs/messaging-style-guide.md` -- closed-set grammar authority (now points at the `as const` tuples in notify.ts).
- `.planning/research/v1.10-attribution-audit.md` -- M-1 (remove raw throw → ATTR-06), M-3 (path-source `{network unreachable}` lie → ATTR-10), M-7 (add reasons defined-but-never-routed → ATTR-07), Theme 1-3.
- `.planning/REQUIREMENTS.md` -- ATTR-05/06/07/10 acceptance + Out-of-Scope locks.

### Tertiary (LOW)
- None -- no WebSearch needed; internal refactor verified end-to-end against source.

## Metadata

**Confidence breakdown:**
- Site map (S1-S9): HIGH -- all 9 sites verified against live code with current line numbers; current bytes confirmed against tests + catalog.
- Decision D-48-A (MpFailed.reasons): HIGH -- backed by the type model (MpFailed already renders the byte prefix; only the brace is missing), the MpSkipped precedent (identical composeReasons usage), TYPE-02 preservation (ContentReason[]), and the single-site `_NoReasonsOnMpFailed` blast-radius check.
- Decision D-48-B (ATTR-10 classification): MEDIUM-HIGH -- the requirement and NFR-5 are unambiguous; the EXACT structure (typed manifest error B2 vs sourceKind-threaded default B1) is a planner judgment (A1). Both satisfy ATTR-10.
- Decision D-48-C (edge discipline): HIGH on the mechanism (Phase 47 precedent); MEDIUM on the `add` subject-name byte form for pre-manifest failures (A2).
- Catalog/fixture impact: HIGH -- the runner mechanism + fixture template (Phase 47) are verified; the new states are mechanical additions.

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable internal codebase; re-verify line numbers only if Phase 49 lands first or notify.ts is otherwise edited).

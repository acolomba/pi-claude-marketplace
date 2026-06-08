# Phase 48: Marketplace-Ops Attribution - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Every marketplace operation routes its precondition failures through `notify(...)` as structured
`(failed)` rows with closed-set reasons instead of throwing raw past the orchestrator:

- `autoupdate` / `noautoupdate` and `marketplace remove` of a missing marketplace converge on
  `(failed) {not added}` (reuse the Phase 46 `MarketplaceNotAddedMessage` variant) -- consistent
  whether the scope is explicit or the name is missing in every scope; no reason-less failed row,
  no `{not found}`, no raw `MarketplaceNotFoundError` past the orchestrator boundary.
- `marketplace add` surfaces each precondition failure -- duplicate name, stale clone, unsupported
  source, missing path source, invalid manifest -- as a structured `(failed)` row carrying the
  matching closed-set `REASONS` member (`duplicate name` / `stale clone` / `unsupported source` /
  `source missing` / `invalid manifest`), instead of a raw throw. These reasons are already defined
  in `REASONS` but are never currently routed through `notify`.
- A path-source malformed/unreadable manifest during `marketplace update` reports a manifest-specific
  reason (e.g. `invalid manifest`), NEVER `{network unreachable}` (the `refreshOneMarketplace`
  `?? ["network unreachable"]` default must not fire for a path source); the path-source update path
  performs NO network access (NFR-5).

Serialized after Phase 47 because the marketplace-op family also converges on `shared/notify.ts`
reasons/renderer. Edge handlers for remove/update/add need try/notify discipline (no bare-registered
handler lets a precondition error escape raw).

**Out of scope (Phase 49):** cross-op convergence proof + GREEN-gate close.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Discuss skipped (workflow.skip_discuss=true). All implementation choices are at the
planner's/executor's discretion, guided by the ROADMAP goal, the 5 success criteria, the audit
findings, the Phase 46 type model, and codebase conventions. Key decisions the planner MUST make
explicitly (flag in PLAN):

1. **How `marketplace add` / `remove` structured `(failed)` rows render their content reason.**
   D-46-03a (Phase 46) left the per-status `MarketplaceNotificationMessage` `failed` arm WITHOUT a
   `reasons` field (the reason rides a child plugin row, e.g. update.ts cascade). Phase 48 must
   resolve how a marketplace-add precondition failure (duplicate name / unsupported source /
   invalid manifest, etc. -- which have NO plugin child rows) renders its reason. Options the
   research must evaluate against the live type model + renderer:
   (a) reuse the existing child-row pattern;
   (b) the `marketplace-not-added` variant for the `{not added}` cases (autoupdate/noautoupdate/
       remove) -- this clearly fits `{not added}`;
   (c) a minimal, surgical addition of `reasons` to the marketplace `failed` arm IF (a) cannot
       carry the add-failure content reasons -- but this is a type-model touch; weigh it against
       the milestone's "no new mechanism unless required" lean and the Phase 46 lock.
   Pick the smallest change that renders the required byte forms; document the rationale.
2. **Reason classification for the path-source manifest failure (ATTR-10):** map `SyntaxError` /
   schema validation `Error` to `invalid manifest`; ensure the `network unreachable` default cannot
   fire on a path source. Confirm NFR-5 (no network) on the path-source update path.
3. **Edge-handler try/notify discipline:** the shape of the try/catch -> notify wrapper for the
   remove/update/add edge handlers so precondition errors are styled, not raw-propagated.

### Locked (carried from milestone context)
- Canonical reason for marketplace-absent: reuse existing `not added` REASONS member + the Phase 46
  `MarketplaceNotAddedMessage` variant.
- `marketplace add` reasons reuse the EXISTING `REASONS` members (`duplicate name`, `stale clone`,
  `unsupported source`, `source missing`, `invalid manifest`) -- already defined; this phase routes
  them through `notify`. No new REASONS member expected.
- Atomic-supersession: any catalog/UAT/type/fixture changes that change shape land together with
  the behavior change in one GREEN commit (no intermediate RED); `npm run check` exits 0.
- Reuse Phase 47's `MarketplaceNotAddedSignal` (now exported from `orchestrators/plugin/shared.ts`)
  if a signal-raise/catch pattern fits the marketplace-op edge handlers.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Driving research & origin
- `.planning/research/v1.10-attribution-audit.md` -- Phase 48 closes Theme 2 / Class A+D findings:
  M-1 (remove raw throw -> ATTR-06), M-3 (path-source manifest failure lying `{network unreachable}`
  -> ATTR-10), M-7 (add precondition reasons defined-but-never-routed -> ATTR-07), and the
  autoupdate/noautoupdate missing-mp inconsistency (ATTR-05).

### The marketplace-op family (the files Phase 48 changes)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` -- autoupdate/noautoupdate
  missing-mp -> `(failed) {not added}` (ATTR-05).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- missing-mp structured
  `(failed) {not added}`, no raw `MarketplaceNotFoundError` (ATTR-06).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` -- route duplicate name /
  stale clone / unsupported source / source missing / invalid manifest through `notify` (ATTR-07).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- `refreshOneMarketplace`
  path-source manifest reason classification; kill the `?? ["network unreachable"]` default for path
  sources (ATTR-10, NFR-5).
- The edge handlers for marketplace remove/update/add (under `extensions/pi-claude-marketplace/edge/`
  or wherever the Pi command runner registers them) -- add try/notify discipline.

### Type model (Phase 46/47 deliverables to build on)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `MarketplaceNotAddedMessage` variant,
  `renderMarketplaceNotAdded`, the per-status `MarketplaceNotificationMessage` union (note D-46-03a:
  the `failed` arm carries NO reasons today), `REASONS`/`Reason`, `ContentReason`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- exported
  `MarketplaceNotAddedSignal` (Phase 47 WR-02) for the signal-raise/catch pattern.
- `.planning/phases/46-type-model-foundations/46-CONTEXT.md` (D-46-03a) +
  `.planning/phases/47-*/47-*-SUMMARY.md` (the plugin-op convergence pattern to mirror).

### Byte-locked contract
- `docs/output-catalog.md` -- new marketplace-op `(failed)` byte forms each get a catalog state.
- `docs/messaging-style-guide.md` -- closed-set grammar contract.
- `extensions/pi-claude-marketplace/tests/architecture/catalog-uat.test.ts` -- byte-equality runner.
- `.planning/REQUIREMENTS.md` -- ATTR-05/06/07/10 acceptance criteria.
</canonical_refs>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. The audit enumerates the specific
raw-throw / lying-reason / never-routed sites; the researcher must verify each against live code
(line numbers may have drifted post-Phase-46/47) and enumerate every marketplace-op precondition
path + edge handler. Critical: resolve the "how do add/remove failed rows render their reason"
question (decision #1) against the actual type model + renderer before planning.
</code_context>

<specifics>
## Specific Ideas

- `marketplace add` already DEFINES the closed-set reasons (`duplicate name`, `stale clone`,
  `unsupported source`, `source missing`, `invalid manifest`) but never routes them through
  `notify` -- this phase makes them reachable end-to-end (audit M-7).
- The `info` `(failed) {not added}` marketplace-subject form (Phase 46) is the canonical target for
  the autoupdate/noautoupdate/remove missing-mp cases.
</specifics>

<deferred>
## Deferred Ideas

- Cross-op convergence proof + GREEN-gate close -- **Phase 49**.
- Phase 47 deferrals folded into the Phase 49 holistic reason review: IN-01 (install M1 zero-delta
  save) + IN-02 (preflightUpdate concurrent-removal `{not in manifest}` reason).
- Audit B-4/B-5/B-6/B-8 (med/lo type foot-guns) -- out of scope for v1.10.
</deferred>

---

*Phase: 48-marketplace-ops-attribution*
*Context auto-generated: 2026-06-07 (discuss skipped via workflow.skip_discuss)*

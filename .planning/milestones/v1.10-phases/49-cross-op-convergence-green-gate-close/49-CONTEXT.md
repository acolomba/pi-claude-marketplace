# Phase 49: Cross-Op Convergence & GREEN-Gate Close - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Prove, across the FULL plugin + marketplace operation matrix, that the identical precondition now
produces the SAME canonical structured outcome the audit's `info` row models -- Class C cross-op
inconsistency is CLOSED, not merely fixed per-op -- and close milestone v1.10.

This is a **verification + closure phase: NO new requirement closure** (all ATTR/SCOPE/TYPE
requirements closed in Phases 46-48), mirroring the v1.4 execution-only / GREEN-gate phases.

Three precondition classes must converge to a single canonical outcome:
1. **Target marketplace absent / wrong-scope** -> `(failed) {not added}` on the marketplace subject,
   uniformly across `install`, `uninstall`, `reinstall`, `update`, `marketplace remove`,
   `autoupdate` -- matching the `info` model. No op silent, misattributing, or raw-throwing.
2. **Cleanup / cascade failure** -> a truthful on-disk/IO/permission reason (never `{not in manifest}`).
3. **Path-source manifest failure** -> a manifest-specific reason (never `{network unreachable}`).

Plus: REASONS has ONE canonical vocabulary for marketplace-missing (`not added`, no new member);
catalog-uat byte-equality GREEN with no orphaned/stale state; `docs/output-catalog.md` documents
every corrected byte form; `npm run check` exits 0 with no test-count regression from the Phase 45
baseline (1473); `.planning/REQUIREMENTS.md` traceability shows all 15 v1.10 requirements mapped
with no TBD; milestone ready to close.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Discuss skipped (workflow.skip_discuss=true). All choices at the planner's/executor's discretion,
guided by the ROADMAP goal + 5 success criteria. Key decisions the planner MUST make explicitly:

1. **Cross-op convergence proof shape.** A dedicated cross-op convergence test (a single test file
   exercising the marketplace-absent precondition across all 6 ops and asserting the identical
   `(failed) {not added}` byte form) vs. relying on the catalog-uat matrix. Prefer an explicit
   convergence test that makes Class-C closure a first-class, regression-locked assertion (the audit
   framed Class C as the cross-op inconsistency; a single matrix test is the cleanest proof).

2. **Residual cross-op inconsistencies deferred from Phases 47-48 -- close or accept (with rationale).**
   The research must examine each against the convergence goal and recommend close-now vs
   accept-with-documented-rationale (this phase closes convergence, not new requirements, so small
   convergence fixes are in-scope; large new mechanisms are not):
   - **Phase 48 IN-02:** `marketplace info` of a schema-invalid manifest renders `{unreadable}`
     (via narrowProbeError) while `marketplace add` renders `{invalid manifest}` (via classifyAddError)
     -- a path-source-manifest-failure cross-surface asymmetry (precondition class 3). Decide whether
     the read surface should also say `{invalid manifest}` (one-line narrowProbeError arm) or whether
     read-vs-write semantics justify the difference.
   - **Phase 47 IN-02:** `preflightUpdate`'s concurrent-removal edge reports `(skipped) {not in manifest}`
     (a lying reason on a rare concurrency edge; precondition class 2-ish). Decide truthful reason
     (e.g. `concurrently uninstalled`) vs accept (rare edge, not in the marketplace-absent matrix).
   - **marketplace `update <missing-mp>`** (Phase 48 research OQ#1): currently rendered as a caught
     synthetic-child `(failed)`, NOT the canonical standalone `{not added}`. SC#1 lists `update` in
     the convergence matrix -- decide whether the marketplace-form update miss must converge on the
     standalone variant too, or whether the plugin-update `@<mp>` form (already converged in Phase 47)
     satisfies SC#1's "update".
   - **Phase 47 IN-01** (install M1 zero-delta state save): a perf nicety, NOT a reason/attribution
     inconsistency -- almost certainly ACCEPT (out of convergence scope).

3. **Traceability reconciliation:** confirm REQUIREMENTS.md maps all 15 v1.10 requirements
   (TYPE-01..04, ATTR-01..10, SCOPE-01) to Phases 46-48 with no TBD; update if any are stale.

### Locked (carried from milestone context)
- Canonical reason = existing `not added` REASONS member (no new `marketplace not added`); REASONS
  stays the 29-member tuple (length-lock untouched).
- Atomic-supersession for any byte/catalog/test changes; `npm run check` exits 0; no test-count
  regression from the Phase 45 baseline (1473) -- expect strictly MORE tests (46-48 added many).
- This is the GREEN-gate close: the final commit leaves the tree GREEN and the milestone ready for
  `/gsd-audit-milestone` -> `/gsd-complete-milestone`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Driving research & origin
- `.planning/research/v1.10-attribution-audit.md` -- the audit; Theme 1 / Class C is the cross-op
  inconsistency this phase proves closed across the whole matrix.
- `.planning/STATE.md` Decisions -- the [Phase 46], [Phase 47], [Phase 48] entries record exactly
  what converged + the deferred items (Phase 47 IN-01/IN-02; Phase 48 IN-02).

### The converged surface (read to build the matrix proof)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- the `MarketplaceNotAddedMessage` variant +
  `renderMarketplaceNotAdded`; the per-status `MarketplaceNotificationMessage` union incl.
  `MpFailed.reasons?`; `REASONS`/`Reason`/`ContentReason`; the `isInfoKind` guard.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install,uninstall,reinstall,update,shared}.ts`
  -- the converged plugin ops + the cross-scope resolvers + `MarketplaceNotAddedSignal`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{autoupdate,remove,add,update}.ts`
  -- the converged marketplace ops.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` -- narrowProbeError (Phase 48 IN-02).

### Byte-locked contract + proofs
- `docs/output-catalog.md` -- must document every corrected byte form added in 46-48; no orphan/stale.
- `extensions/pi-claude-marketplace/tests/architecture/catalog-uat.test.ts` -- byte-equality runner.
- `extensions/pi-claude-marketplace/tests/architecture/notify-types.test.ts` -- REASONS length-lock +
  closed-set proof (SC#2).
- `.planning/REQUIREMENTS.md` -- the 15-requirement traceability table (SC#5).

### Prior GREEN-gate phases (the pattern to mirror)
- The v1.4 Phase 21 / v1.4.1 Phase 26 / v1.5 GREEN-gate closure phases (verification + closure, no
  new requirement closure).
</canonical_refs>

<code_context>
## Existing Code Insights

Codebase context gathered during plan-phase research. The convergence surface is already implemented
(Phases 46-48); this phase's NEW code is primarily the cross-op convergence test + any small residual
convergence fix the research recommends + traceability/doc reconciliation. Baseline: Phase 45 = 1473
tests; Phase 48 left the suite at 1502 GREEN.
</code_context>

<specifics>
## Specific Ideas

- The `info` `(failed) {not added}` marketplace-subject form is the canonical model; the convergence
  proof asserts every other op matches it byte-for-byte for the marketplace-absent precondition.
- This is the milestone capstone -- after it, `/gsd-audit-milestone` -> `/gsd-complete-milestone`.
</specifics>

<deferred>
## Deferred Ideas

- Audit B-4/B-5/B-6/B-8 (med/lo type foot-guns) -- explicitly out of scope for v1.10 (future hardening).
- Real-publish runtime validation (carried from v1.4.1 D-25-06) -- not a v1.10 concern.
</deferred>

---

*Phase: 49-cross-op-convergence-green-gate-close*
*Context auto-generated: 2026-06-08 (discuss skipped via workflow.skip_discuss)*

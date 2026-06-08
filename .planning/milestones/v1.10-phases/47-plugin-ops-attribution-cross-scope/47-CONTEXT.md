# Phase 47: Plugin-Ops Attribution & Cross-Scope - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Every plugin operation (`install`, `uninstall`, `reinstall`, `update`) converges on `info`'s
model for the marketplace-existence and scope preconditions:

- A missing/not-added marketplace renders `(failed) {not added}` on the **marketplace subject**
  (the Phase 46 `MarketplaceNotAddedMessage` variant) -- never `{not in manifest}` on the plugin
  row, never silent, never raw-thrown.
- "Plugin absent from a present manifest" stays distinct as `{not in manifest}` (the two
  conditions emit different reasons).
- Cleanup / cascade failures (foreign content, IO, permission) report a truthful reason instead of
  degrading to `{not in manifest}`.
- A target present only in the OTHER scope says so instead of being reported as
  not-in-manifest / not-installed (explicit-scope resolution consults the other scope before
  failing; the by-design project-to-user install fallback per CMP-3 is preserved).

Built on the Phase 46 not-added variant + `isInfoKind` guard. The plugin-op family is migrated as
ONE serialized wave through the shared scope-resolution chokepoint
(`orchestrators/plugin/shared.ts`) -- serialized rather than parallelized because every change
converges on `shared/notify.ts` reasons/types (the v1.4.1/v1.5 convergence lesson).

**Out of scope (Phase 48):** marketplace-op attribution (autoupdate/remove/add raw throws;
path-source manifest failure lying `{network unreachable}`).
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Discuss was skipped (workflow.skip_discuss=true). All implementation choices are at the
planner's/executor's discretion, guided by the ROADMAP goal, the 6 success criteria, the audit
findings, the Phase 46 type model, and codebase conventions. Key decisions the planner MUST make
explicitly (flag in PLAN):

1. **Cascade emission model (the Phase 46-flagged open question).** How do bulk/cascade plugin ops
   emit the `marketplace-not-added` variant -- as a standalone TOP-LEVEL message (the precondition
   fails before any cascade, matching `info`'s single-emission model) vs. embedded as a row within
   a cascade message. The Phase 46 variant is a top-level `NotificationMessage` arm; the milestone
   theme is "converge on `info`'s model," which biases toward the standalone single-emission form.
   Resolve during research/planning with codebase evidence.
2. **Reason vocabulary for cascade/cleanup failures** (ATTR-09): the truthful on-disk/IO/permission
   reasons replacing the `{not in manifest}` degradation -- reuse existing `REASONS` members
   (no new members unless strictly required; the audit maps these to existing reasons).
3. **Cross-scope resolution shape** (SCOPE-01) at `orchestrators/plugin/shared.ts`: how the
   explicit-scope chokepoint consults the other scope and renders "present in other scope," while
   preserving the CMP-3 project-to-user install fallback.

### Locked (carried from milestone context)
- Canonical reason: reuse the existing `not added` REASONS member (no new `marketplace not added`).
- The `(failed) {not added}` marketplace-subject form is the canonical target `info` already
  models (Phase 46 made it the only representable shape for the condition).
- Atomic-supersession: any catalog/UAT/type/fixture changes that change shape land together with
  the behavior change in one GREEN commit (no intermediate RED); `npm run check` exits 0.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Driving research & origin
- `.planning/research/v1.10-attribution-audit.md` -- the 23-finding audit. Phase 47 closes
  Class A/cross-op findings: A-7 (cross-scope blind spot -> SCOPE-01), A-9/A-10 (cascade/cleanup
  degrading to `{not in manifest}` -> ATTR-09), and the install/uninstall/reinstall/update
  misattribution + raw-throw findings (ATTR-01/02/03/04/08).
- `.planning/BACKLOG.md` #1 -- "Install error misattribution when marketplace is missing".

### The chokepoint + plugin-op family (the files Phase 47 changes)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- the shared
  scope-resolution chokepoint (cross-scope SCOPE-01 lands here).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- the `not-in-manifest`
  throws at the marketplace-absent branch are replaced with a marketplace-absent subject path
  (ATTR-01/08).
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- silent-no-output path
  for a missing marketplace eliminated (ATTR-04); cleanup/cascade truthful reasons (ATTR-09).
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- bare + explicit forms;
  cascade truthful reasons (ATTR-03/09).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- `<plugin>@<mp>` and `@<mp>`
  forms; no `MarketplaceNotFoundError` raw-thrown past the orchestrator (ATTR-02).

### Type model (Phase 46 deliverables to build on)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `MarketplaceNotAddedMessage` variant
  (`kind: "marketplace-not-added"`), `renderMarketplaceNotAdded`, `isInfoKind` guard,
  `ContentReason`, the per-status `MarketplaceNotificationMessage` union, `REASONS`/`Reason`.
- `.planning/phases/46-type-model-foundations/46-SUMMARY` + `46-CONTEXT.md` -- the Phase 46 model
  and its deferred "Phase 47 open question" (cascade emission model).

### Byte-locked contract
- `docs/output-catalog.md` -- new `(failed) {not added}` + cross-scope byte forms each get a
  catalog state; pre-existing states stay byte-identical except those intentionally amended.
- `docs/messaging-style-guide.md` -- closed-set grammar contract.
- `extensions/pi-claude-marketplace/tests/architecture/catalog-uat.test.ts` -- byte-equality runner.
- `.planning/REQUIREMENTS.md` -- ATTR-01/02/03/04/08/09 + SCOPE-01 acceptance criteria.
</canonical_refs>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. The audit
(`.planning/research/v1.10-attribution-audit.md`) already enumerates the specific misattribution
sites; the researcher should verify each against live code (line numbers may have drifted) and
enumerate every throw/silent/degraded path across the 5 plugin-op files + the shared chokepoint.
</code_context>

<specifics>
## Specific Ideas

- The `info` command's `(failed) {not added}` on the marketplace subject is the canonical target
  the whole milestone copies. Phase 47 makes the plugin ops produce that same canonical outcome
  for the marketplace-absent / wrong-scope precondition.
- Migrate the family as ONE serialized wave through `orchestrators/plugin/shared.ts` (do not
  parallelize -- shared/notify.ts convergence).
</specifics>

<deferred>
## Deferred Ideas

- Marketplace-op attribution (autoupdate/noautoupdate/remove/add raw throws; path-source manifest
  failure lying `{network unreachable}`) -- **Phase 48**.
- Cross-op convergence proof + GREEN-gate close -- **Phase 49**.
- Audit B-4/B-5/B-6/B-8 (med/lo type foot-guns) -- out of scope for v1.10.
</deferred>

---

*Phase: 47-plugin-ops-attribution-cross-scope*
*Context auto-generated: 2026-06-07 (discuss skipped via workflow.skip_discuss)*

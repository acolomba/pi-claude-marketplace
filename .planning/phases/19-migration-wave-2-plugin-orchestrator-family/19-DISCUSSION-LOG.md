# Phase 19: Migration Wave 2 -- Plugin Orchestrator Family - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 19-Migration Wave 2 -- Plugin Orchestrator Family
**Areas discussed:** Post-success warnings (DROP vs FOLD), Cascade-summary composer migration, install.ts rollback-partial composer fate, Plan granularity & pilot file

---

## Initial gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Plan granularity & pilot file | 5 per-file + 1 lint = 6 plans (like 18 minus Wave 0), or split install.ts? Pilot candidates: list.ts / uninstall.ts / install.ts. | ✓ |
| Post-success warnings (DROP vs FOLD) | install.ts emits 4 post-commit notifyWarnings + PI-13 deps note. list.ts emits probe-failures summary. V2 catalog has NO representation. | ✓ |
| Cascade-summary composer migration | presentation/cascade-summary.ts is shared by install/reinstall/update (this phase) AND import/execute.ts (Phase 20). | ✓ |
| install.ts rollback-partial composer fate | composeRollbackPartial builds V1 PluginInlineRow + RollbackChild[]. V2 has structural rollbackPartial on PluginFailedMessage. | ✓ |

**User's choice:** All 4 selected.

---

## Post-success warnings (DROP vs FOLD) -- install.ts (5 sources)

| Option | Description | Selected |
|--------|-------------|----------|
| DROP all 5 per D-18-01 | Treat all 5 as 'no V2 catalog representation' -- same precedent that dropped marketplace/remove.ts's cleanup-leak warning. Cleanest V2 conformance, lowest test churn. | ✓ |
| DROP cleanup-class (3), KEEP info-class (2) | DROP mkdir + cache-refresh + bridge cleanup-leak. KEEP AG-5 foreign files + PI-13 deps as separate notify() calls because they convey actionable user info. Catalog gets new sub-states OR free-form trailer carve-out. | |
| FOLD all 5 into success payload | Add `reasons?` or `notes?` field on PluginInstalledMessage. Renderer emits an additional `{<reason>}` brace per warning. Requires Phase 15 type-model amendment. Heaviest churn; preserves user-visible info. | |

**User's choice:** DROP all 5 per D-18-01 (Recommended).
**Notes:** Captured as D-19-01 in CONTEXT.md. Same precedent applied to install.ts (5), reinstall.ts (2 bridge + maintenance warnings), update.ts (1 cache-refresh warning) uniformly.

---

## Post-success warnings (DROP vs FOLD) -- list.ts (PROBE_FAILURES summary)

| Option | Description | Selected |
|--------|-------------|----------|
| DROP per D-18-01 | PROBE_FAILURES drain at list.ts:774-780 emits a 'Some plugins could not be probed' notifyWarning AFTER the success render. Same shape as install.ts cleanup warnings. V2 catalog list section shows zero post-list warning fixtures. DROP keeps catalog UAT GREEN; probe failure already manifests in per-row 'unavailable' status. | ✓ |
| FOLD into per-row reasons[] | Fold probe failure into the per-plugin row's reasons[]. Requires verifying 1:1 correspondence with rows; would need a Phase 15 amendment to add 'probe-failed' to the closed Reason set. | |
| Keep as a second notify() call | Accept a second notify() with synthetic marketplace header. Adds catalog state. Highest divergence from D-18-01. | |

**User's choice:** DROP per D-18-01 (Recommended).
**Notes:** Folded into the same D-19-01 decision as install.ts's 5 sources.

---

## Cascade-summary composer migration

| Option | Description | Selected |
|--------|-------------|----------|
| Inline cascade construction per orchestrator | Each of install/reinstall/update builds its V2 cascade payload INLINE. presentation/cascade-summary.ts stays unmodified for import/execute.ts (Phase 20). Phase 21 deletes V1 composer. Mirrors Phase 18 pattern. | ✓ |
| Extract V2 payload helper in shared/ | Add composePluginCascadePayload(...) that returns MarketplaceNotificationMessage. install/reinstall/update import it; Phase 20 import also imports it; Phase 21 deletes V1, keeps V2 helper. Less duplication, more abstraction surface. | |
| Rewrite cascade-summary in place | Change V1 composer's return type from {message, severity} to MarketplaceNotificationMessage. Phase 21 deletes it WITH the rest of presentation/*. Awkward coupling between 19+20 and a deleted-in-21 composer. | |

**User's choice:** Inline cascade construction per orchestrator (Recommended).
**Notes:** Captured as D-19-02 in CONTEXT.md. Each orchestrator's cascade variants are owned per-orchestrator (reinstall=manual-recovery; update=version-arrow; install=rollback-partial), so a shared helper would either be trivial or fork per-orchestrator anyway.

---

## install.ts rollback-partial composer fate

| Option | Description | Selected |
|--------|-------------|----------|
| Retire composeRollbackPartialBody entirely | Single call site (the install failure path). Orchestrator constructs PluginFailedMessage INLINE with reasons: ['rollback partial'], cause: err, rollbackPartial: rollbackPartials.map(...). classifyEntityShapeError stays. Drops one helper, one import. | ✓ |
| Refactor into composePluginFailedMessage typed helper | Replace V1 composer with a typed V2 helper that returns the structured object. install.ts wraps in marketplaces[]. Preserves a named extraction point IF future install variants reuse it; but currently single call site. | |
| Keep V1 composer alive temporarily | Mix V1 + V2 grammar at one site via an adapter. No precedent in Phase 18. Reject. | |

**User's choice:** Retire composeRollbackPartialBody entirely (Recommended).
**Notes:** Captured as D-19-03 in CONTEXT.md. Mirrors the inline-cascade decision (D-19-02) for consistent style.

---

## Plan granularity & pilot file -- Wave 1 pilot selection

| Option | Description | Selected |
|--------|-------------|----------|
| uninstall.ts | 5 callsites, smallest cascade pattern. Establishes single-shot success+failure AND cascade-summary inline-construction. Goldilocks pilot. | ✓ |
| list.ts (simplest) | 3 callsites, NO cascade. Locks only single-shot PluginListMessage shape. install/reinstall/update would have no cascade pilot. | |
| install.ts (most complex) | 8 callsites including rollback-partial composer retirement + 5 dropped warnings. Highest-fidelity recipe; biggest blast radius if pilot deviates mid-implementation. | |

**User's choice:** uninstall.ts (Recommended).
**Notes:** Captured as D-19-05 in CONTEXT.md. Wave 2 mirrors uninstall.ts's inline-cascade recipe.

---

## Plan granularity & pilot file -- Plan/wave structure

| Option | Description | Selected |
|--------|-------------|----------|
| 6 plans, 3 waves | Wave 1 = 19-01 (uninstall.ts pilot). Wave 2 = 19-02..05 (install/list/reinstall/update parallel). Wave 3 = 19-06 (MSG-Block 1+1b lint narrowing + final catalog UAT GREEN gate). Mirrors Phase 18 minus Wave 0. | ✓ |
| 7 plans (split install.ts) | Split install.ts into 19-02a (single-shot success/failure path) and 19-02b (rollback-partial + post-commit drops). More granular review, smaller blast radius per plan; but adds wave dependency. | |
| 6 plans, flatten waves | After pilot, install.ts comes alone in Wave 2 (highest risk) and list/reinstall/update parallel in Wave 3, lint in Wave 4. Reduces parallel pressure on install.ts. More waves, slower. | |

**User's choice:** 6 plans, 3 waves (Recommended).
**Notes:** Captured as D-19-04, D-19-05, D-19-06 in CONTEXT.md.

---

## Continuation check

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Lock the 4 decisions and write CONTEXT.md. | ✓ |
| Explore more gray areas | Surface additional grays: test-file mock-pi extraction, standalone-vs-orchestrated install boundary, classifyInstallFailure tuple handling, PROBE_FAILURES module-level variable lifecycle, classifyEntityShapeError reasons[] mapping. | |

**User's choice:** I'm ready for context.
**Notes:** Additional grays were considered during pre-question scouting and are resolved within the 4 locked decisions or covered by inherited Phase 18 / 16 / 15 decisions.

---

## Claude's Discretion

Per CONTEXT.md `<decisions>` "Claude's Discretion" subsection:

- Exact ordering of file mutations within each per-file plan (orchestrator first or test file first -- both atomic within one plan commit).
- Whether to extract a tiny shared helper for `pi: { getAllTools: () => [] }` mock-pi shape (Phase 18 left inlined; Phase 19 inherits the choice).
- Stale V1-comment cleanup in `orchestrators/plugin/shared.ts` -- inside a per-file plan or in plan 19-06 or deferred to Phase 21.
- Severity-tier assertion form (`assert.equal(note.severity, undefined)` vs helper).
- install.ts cascade-direct-path emissions (lines 227 + 254 + 783): construct `MarketplaceNotificationMessage` with `plugins: []` (bare failed-mp) OR with a single synthetic `PluginFailedMessage`. Planner picks the cleaner round-trip.
- `runPostSuccessMaintenance` (reinstall.ts) and `runPostUpdateMaintenance` (update.ts) -- inline into callers or keep as named helpers after D-19-01 drops remove their notify paths.

---

## Deferred Ideas

Per CONTEXT.md `<deferred>` section:

- Phase 20 (Migration Wave 3 -- Edge + UsageError + orchestrators/import/execute.ts)
- Phase 21 (Final Teardown + GREEN gate)
- Test-helper extraction for `makeCtx()` + mock-pi (Phase 21 cleanup or quick task)
- presentation/*.test.ts deletion (Phase 21)
- `orchestrators/plugin/shared.ts` stale comment cleanup (planner discretion within Phase 19, or Phase 21)
- `RollbackPartial` ledger refactor to expose typed `Error` (backlog)
- JSON output mode for notifications (REQUIREMENTS.md "Out of Scope" backlog)
- Branded `Version` type with `hash-<12hex>` / semver validation (carried Phase 15/16 backlog)

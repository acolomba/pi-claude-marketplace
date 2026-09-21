# Phase 5: Production Export Ownership — Context

Recorded 2026-09-14 from the authorized test-backlog handoff and current investigation. This is an autonomous planning record, not a new approval request.

## Decisions

- **D-01 — Preserve the quality contract.** Aggregate production unit coverage remains 100%; preserve exact results, errors, bytes, state, and promised interactions. Preserve existing direct-pair pins as a separate measurement. No threshold reduction, production exclusions, test-only exports, or manufactured assertions.
- **D-02 — Finish the full production finding population.** Remeasure after Phases 3 and 4. The research snapshot of 111 findings is evidence, not a frozen target or a list of confirmed defects. Account for values, types, files, class members, and duplicate groups, including findings exposed by removing their only production caller.
- **D-03 — Use conceptual ownership.** Privatize same-file helpers and test their public operation. Retire truly unreachable implementations with caller evidence. Keep factories with legitimate injected contracts; give them real composition consumers. Do not create a production module per helper or factory.
- **D-04 — Preserve completed seam work.** Keep the no-test-only-production-surface gate, lifecycle-owned runtime state, required routing/cache owners, semantic transactions, and explicit collaborator contracts. Preserve Phase 3 naming/migration behavior and Phase 4's 19-verb argument/catalog work.
- **D-05 — Enforce production dead code without weakening other analysis.** Use `production: { deadCode: true, health: false, dupes: false }`. Keep `includeEntryExports: true`, existing rules, boundaries, and coverage scope. The shipping command itself must detect planted violations without a flag that conceals a misconfigured file.
- **D-06 — Use only proven local analyzer exceptions.** The Pi-loaded default export may carry one immediately adjacent `fallow-ignore-next-line unused-export` reason identifying the manifest loader. `RingBuffer.read` may carry one adjacent `unused-class-member` annotation citing the two real stream reads in registry finalization. No global name exemptions, entry-file exclusions, or blanket same-file-use settings.
- **D-07 — Keep compile-time protection without gratuitous exports.** Probe private declarations for ResolvedPluginSchema, REASONS, STATUS_TOKENS, PLUGIN_STATUSES, and MARKETPLACE_STATUSES. Keep the same closed contracts and exact exhaustiveness/drift proofs through public types and real consumers. Private proof aliases must be consumed by the contracts they protect. A retained exported exception requires a demonstrated compiler/analyzer limitation and a discriminating control; convenience imports from tests are not evidence.
- **D-08 — Prove the gate.** Use isolated offender/benign fixture pairs with exact finding identities, normal process exit, valid report shape, and nonempty production entry discovery. Test ordinary test-only exports, same-entry stray exports, unused types/files/members, and duplicate exports. A clean report alone cannot prove instrumentation. Preserve the existing routed historical-disposition check.
- **D-09 — Preserve historical evidence.** Retire the obsolete hub-ledger script and its paired tests only after current caller/reference checks and a passing pre-removal test. Keep archived plans, ledgers, and summaries. Record the factual retirement and close FLOW-09 only with final gate and coverage evidence.
- **D-10 — Make census changes reviewable.** Keep an exact normalized finding pin during the cleanup, update it only from reviewed report deltas, and explain each removed or retained identity in the plan summary. Never copy an unexpected report over the pin. The parent reconciles the shared pin once per stable wave after disjoint source owners finish; the final state is an empty complete report plus live controls.

## Agent Discretion Resolved

- Use one shared plugin production-composition owner, `orchestrators/plugin/operations.ts`, for the install, enable/disable, uninstall, reinstall-backfill, fetch, and info adapters. Existing flow modules keep their semantic factories. Existing entry, bridge barrels, and auth-host compose reconcile, bridge, and credential capabilities.
- Extract the complete git authentication-callback protocol into `platform/git-auth-callbacks.ts`, and the complete filesystem containment policy into `shared/path-containment.ts`; these are coherent concerns with real production importers.
- Rename the ten payload exports to their event-specific names already used by production import aliases. This supersedes the research's ten export exemptions and leaves unused and duplicate-export analysis effective for those symbols.
- Rename the domain hook parse context to `ResolveHookIfContext` and the shared notification event type to `HookSummaryToolEvent`; retain the distinct domain `ToolEvent`. Consolidate the bridge's `assertNever` on the shared implementation.
- Local Fallow 3.22.0 probes proved both an exact file/name exception and the narrower adjacent entry annotation. With the latter and entry-export checking enabled, the report still identified the entry's stray export and the helper read only by its test (exit 1, two exact findings). Prefer the adjacent annotation.
- `scripts/check-phase-06-hub-ledger.mjs` has no current package/workflow/production caller; its remaining references are its test, archived work, and this investigation. Its paired test passed before planning. Reconfirm these facts at execution before retirement.

## Execution Rules Shared by Every Plan

Read each changed file and trace callers with CodeGraph before editing. Preserve concurrent work. Each task changes only its listed files; if the fresh census exposes another owner, extend the bounded plan set before editing that owner. Do not suppress the finding to fit a file budget.

For every helper test that moves, map the old assertion to a public result, state transition, complete emitted bytes, error class/fields, or exact promised interaction. Retire assertions only with their proven unreachable implementation; a public case that subsumes another must demonstrably retain every assertion. Test fixture bytes are independent literals, never generated by the implementation being checked. Preserve type-only tests as type-only checks.

Run the task's automated check, typecheck after changed interfaces, and `npm run test:coverage:direct -- <each changed production path>`. Keep existing pins and repair regressions through reachable public behavior. At phase close, run aggregate unit coverage, direct all-pairs, and the complete quality gate. Do not claim 100% from the direct pin or from an integration/e2e union.

The census remains exact while draining. Cleanup plans record their finding and assertion deltas without writing the shared pin. The parent owns one explicit reconciliation after every stable wave: review the combined deltas, update the exact pin once, run its complete control gate, and measure aggregate production unit coverage. Do not start dependent waves with an unexplained census change or coverage regression. Plans that share actual source, tests, or composition files remain sequential; independent owner groups run in parallel. See 05-VALIDATION.md for the executable wave-boundary contract.

## Deferred Ideas

None from Phase 5. The unread-interface-member gate belongs to Phase 6 and CRAP/coverage conversion to Phase 7. Neither changes the Phase 5 coverage or dead-code requirements.

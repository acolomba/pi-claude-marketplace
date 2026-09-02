---
schema_version: 1
open_count: 10
waived_count: 0
fixed_count: 5
total_count: 15
last_updated: 2026-09-02T22:03:02.310Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 86 | unrun-verify | extensions/pi-claude-marketplace/bridges/skills/stage.ts |  | SKILL-01 backstop: after /reload a degraded skill's /skill:<name> resolves and the model never auto-invokes it (disable-model-invocation) — needs a live Pi session, not exercised in unit tests | open |  | 2026-07-26T13:18:03.001Z |  |
| 2 | 88 | stub | extensions/pi-claude-marketplace/bridges/hooks/settle.ts |  | stop_hook_active hardcoded false in synthetic Stop event; loop-protection flag + 8-block cap land in plan 03 (STOP-07) | open |  | 2026-07-30T12:26:37.974Z |  |
| 3 | 88 | stub | extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts |  | thin StopFailure translator; errorMessage classifier lands in plan 04 (SFAIL-03) | open |  | 2026-07-30T12:26:38.396Z |  |
| 4 | 109 | deviation | tests/shared/atomic-json.test.ts | 55 | TypeScript inferred a literal-only expected-document set before the Task 2 type check widened it to Set<string>. | fixed |  | 2026-08-29T18:04:33.606Z | 2026-08-29T18:04:45.703Z |
| 5 | 112 | deviation | .planning/ROADMAP.md |  | Closed the canonical P112-15 row and current activity after the generic progress update left them stale. | fixed |  | 2026-08-31T04:43:18.412Z | 2026-08-31T04:43:40.050Z |
| 6 | 115 | unmet-truth | tests/orchestrators/reconcile/apply.test.ts |  | Backfill's owner stopped driving applyReconcile, so the apply-tier facts it used to carry (one cascade with a promotion row plus an install row, the rendered (installed)/(failed) row bytes, no reload-hint trailer) now need an owner in reconcile/apply.test.ts (P115-05). | fixed |  | 2026-09-02T01:30:10.208Z | 2026-09-02T04:33:38.886Z |
| 7 | 115 | deviation | tests/orchestrators/reconcile/backfill.test.ts |  | The two runScopeIsolated cases own no temporary tree; that entrypoint touches no filesystem, HOME or agent directory, so the plan's per-case tree requirement is satisfied vacuously. | open |  | 2026-09-02T01:30:10.510Z |  |
| 8 | 115 | deviation | tests/orchestrators/reconcile/pending.test.ts |  | Two force-preview guards in pending.ts (record === undefined, manifestEntry === undefined) are behaviorally redundant with the per-install catch in resolvePendingForceInstalls: removing either leaves the owner suite green because the resulting throw is caught per install and degrades the row to the same plain (will install). The two cases still make the guards reachable, so they are not dead code, but no public behavior discriminates them. | open |  | 2026-09-02T01:56:56.047Z |  |
| 9 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts |  | Three per-entry catch clauses (marketplace add, plugin install, plugin toggle) were removed under the unreachable-code rule because addMarketplace, installPlugin and setPluginEnabled each answer with a typed outcome for every throw they can meet. RECON-03 per-entry isolation for those three now rests on an internal contract with no compile-time enforcement. WR-02 corrects the blast radius recorded here: an escape is NOT confined to one entry losing its failed row. applyPlan is called bare inside applyReconcile's per-scope loop, unlike its neighbours applyBackfillForScopeIsolated and rebuildScopeRoutingTableIsolated (both wrapped in runScopeIsolated) and unlike the read pass (its own try). An escape from any of the three uncaught loops therefore aborts the remaining entries in that bucket, skips backfill and the routing-table rebuild for that scope, skips the sibling scope entirely (project runs first, so a project-scope throw means user scope never reconciles), and DISCARDS EVERY OUTCOME ACCUMULATED SO FAR because notifyReconcileAppliedWithContext is never reached. The user gets a raw error out of resources_discover instead of a cascade. WR-02 also records that no test can ever prove the loops safe: installPlugin, addMarketplace and setPluginEnabled are static imports and ApplyReconcileOptions exposes no injection seam, so apply.test.ts physically cannot plant a throwing collaborator (contrast the two loops that kept their catch, which ARE covered through raceStateFromRead). Two margins the header comment does not mention: installPlugin has one awaited statement outside its try (collectPostCommitWarnings) plus buildInstalledOutcome, both dereferencing a definitely-assigned installCtx and safe only because runInstallLedgerBody returns a two-armed union 500 lines away; and handleInstallThrow composes a full failure message BEFORE its orchestrated branch, so a future throw inside composeInstallFailureMessage would escape from inside the entrypoint's own catch handler. Neither remedy is in bounds for the fix pass: restoring the catches creates arms no input can reach, which breaks the 100 percent direct-branch-coverage requirement for this pair, and adding the three orchestrators as injected collaborators is the test seam D-115-03 and CONVENTIONS.md forbid. This needs an operator decision. | open |  | 2026-09-02T04:33:39.238Z |  |
| 10 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts |  | applyPlan's documented remove-before-add ordering is not discriminated by any input: swapping the two leaves the owner suite green, because the planner makes the removal and add buckets disjoint by name. The add-before-install and project-before-user orderings ARE discriminated and are pinned. | open |  | 2026-09-02T04:33:39.577Z |  |
| 11 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/import/execute.ts |  | CR-01: installOnePlannedPlugin's default assertNever arm was removed on the stated ground that TypeScript proves the InstallPluginOutcome switch exhaustive. It does not: a switch in a void-returning function with a missing arm compiles clean, so a third outcome arm would have fallen through, recorded the plugin in no result bucket, rendered no cascade row and under-counted the Import tally with typecheck, lint, fallow and the owner suite green. FIXED: the function now declares a PlannedPluginBucket return, restoring the TS2366 check at the switch. Verified by planting a third arm on InstallPluginOutcome (no diagnostic before, TS2366 after). | fixed |  | 2026-09-02T06:22:19.083Z | 2026-09-02T06:22:29.213Z |
| 12 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts |  | WR-03: three default assertNever arms were removed from applyMarketplaceOutcomeToBlock, applyPluginOutcomeToBlock and applyOutcomeToBlock on the ground that the narrowed Extract parameter makes each switch exhaustive. The union was narrow but the CHECK was absent: all three returned void, so a newly-added PerEntryOutcome kind compiled clean at all three sites and silently produced no row. FIXED: each applier now answers with the block it mutated, restoring TS2366 at the edit site. Verified by planting a PerEntryOutcome kind (no diagnostic before; after, TS2366 at the dispatcher and at each inner applier once the planted kind is routed into its narrowed parameter). | fixed |  | 2026-09-02T06:22:29.544Z | 2026-09-02T06:22:29.869Z |
| 13 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts |  | WR-01: the D-115-10 mode-discriminated overloads on addMarketplace, removeMarketplace, uninstallPlugin and setPluginEnabled are unchecked assertions, not compile-time proofs. TypeScript accepts a narrower overload return against a wider implementation with no diagnostic, and never verifies the body honours it; confirmed against this repository's compiler by making addMarketplace's orchestrated success arm return undefined, which typechecks clean at exit 0. Three runtime guards in reconcile/apply.ts were deleted on the strength of that narrowing, so the assertion was relocated from the consumer to the producer's signature rather than removed. Every orchestrated arm of all four producers returns a defined outcome today and the reconcile owner suite pins the exercised paths behaviourally; an arm that suite does not reach is covered by neither. The reviewer's structural fix (split each entrypoint so the narrow overload delegates to a helper whose DECLARED return type is Promise<TOutcome>) was not applied: it restructures three production modules whose Phase 114 owner suites are complete and closed to edits. Doc comments at all four sites now state that the narrowing is asserted, not proved. | open |  | 2026-09-02T06:22:46.935Z |  |
| 14 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/import/execute.ts |  | WR-04: buildImportNotificationMarketplaces iterates the header map byMp and looks plugin rows up in the sibling rowsByMp map, so any row whose (scope, marketplace) key carries no header is never visited and vanishes without trace behind the ?? [] fallback. Making MarketplaceBlock.status required prevents a STATUSLESS HEADER; it does not prevent a HEADERLESS ROW. What rules that out is an invariant spanning four functions: every pushMarketplaceRow site is reachable only for a plugin that passed the blockedMarketplaces gate, and scopedPlan derives pluginsToInstall and marketplacesToEnsure from the same refs set under one scope. No structural gate was added because the check would be an arm no input can reach, which breaks the 100 percent direct-branch-coverage requirement for this pair. The overstated doc comment was corrected to describe the invariant instead of implying the type enforces it. WR-06's fix removed the one concrete near-miss (the unknown-stored branch now assigns a status). | open |  | 2026-09-02T06:22:47.283Z |  |
| 15 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts | 41 | Usage-string collapse arm is unreachable through the module exports, so the 116-13 pair stands at direct branches 11/12; reported, not pinned or excepted | open |  | 2026-09-02T22:03:02.310Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "86",
    "file": "extensions/pi-claude-marketplace/bridges/skills/stage.ts",
    "line": null,
    "description": "SKILL-01 backstop: after /reload a degraded skill's /skill:<name> resolves and the model never auto-invokes it (disable-model-invocation) — needs a live Pi session, not exercised in unit tests",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-26T13:18:03.001Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "88",
    "file": "extensions/pi-claude-marketplace/bridges/hooks/settle.ts",
    "line": null,
    "description": "stop_hook_active hardcoded false in synthetic Stop event; loop-protection flag + 8-block cap land in plan 03 (STOP-07)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-30T12:26:37.974Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "stub",
    "phase": "88",
    "file": "extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts",
    "line": null,
    "description": "thin StopFailure translator; errorMessage classifier lands in plan 04 (SFAIL-03)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-30T12:26:38.396Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "109",
    "file": "tests/shared/atomic-json.test.ts",
    "line": 55,
    "description": "TypeScript inferred a literal-only expected-document set before the Task 2 type check widened it to Set<string>.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-29T18:04:33.606Z",
    "resolved_at": "2026-08-29T18:04:45.703Z"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "112",
    "file": ".planning/ROADMAP.md",
    "line": null,
    "description": "Closed the canonical P112-15 row and current activity after the generic progress update left them stale.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-31T04:43:18.412Z",
    "resolved_at": "2026-08-31T04:43:40.050Z"
  },
  {
    "id": 6,
    "kind": "unmet-truth",
    "phase": "115",
    "file": "tests/orchestrators/reconcile/apply.test.ts",
    "line": null,
    "description": "Backfill's owner stopped driving applyReconcile, so the apply-tier facts it used to carry (one cascade with a promotion row plus an install row, the rendered (installed)/(failed) row bytes, no reload-hint trailer) now need an owner in reconcile/apply.test.ts (P115-05).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-02T01:30:10.208Z",
    "resolved_at": "2026-09-02T04:33:38.886Z"
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "115",
    "file": "tests/orchestrators/reconcile/backfill.test.ts",
    "line": null,
    "description": "The two runScopeIsolated cases own no temporary tree; that entrypoint touches no filesystem, HOME or agent directory, so the plan's per-case tree requirement is satisfied vacuously.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T01:30:10.510Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "115",
    "file": "tests/orchestrators/reconcile/pending.test.ts",
    "line": null,
    "description": "Two force-preview guards in pending.ts (record === undefined, manifestEntry === undefined) are behaviorally redundant with the per-install catch in resolvePendingForceInstalls: removing either leaves the owner suite green because the resulting throw is caught per install and degrades the row to the same plain (will install). The two cases still make the guards reachable, so they are not dead code, but no public behavior discriminates them.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T01:56:56.047Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "115",
    "file": "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts",
    "line": null,
    "description": "Three per-entry catch clauses (marketplace add, plugin install, plugin toggle) were removed under the unreachable-code rule because addMarketplace, installPlugin and setPluginEnabled each answer with a typed outcome for every throw they can meet. RECON-03 per-entry isolation for those three now rests on an internal contract with no compile-time enforcement. WR-02 corrects the blast radius recorded here: an escape is NOT confined to one entry losing its failed row. applyPlan is called bare inside applyReconcile's per-scope loop, unlike its neighbours applyBackfillForScopeIsolated and rebuildScopeRoutingTableIsolated (both wrapped in runScopeIsolated) and unlike the read pass (its own try). An escape from any of the three uncaught loops therefore aborts the remaining entries in that bucket, skips backfill and the routing-table rebuild for that scope, skips the sibling scope entirely (project runs first, so a project-scope throw means user scope never reconciles), and DISCARDS EVERY OUTCOME ACCUMULATED SO FAR because notifyReconcileAppliedWithContext is never reached. The user gets a raw error out of resources_discover instead of a cascade. WR-02 also records that no test can ever prove the loops safe: installPlugin, addMarketplace and setPluginEnabled are static imports and ApplyReconcileOptions exposes no injection seam, so apply.test.ts physically cannot plant a throwing collaborator (contrast the two loops that kept their catch, which ARE covered through raceStateFromRead). Two margins the header comment does not mention: installPlugin has one awaited statement outside its try (collectPostCommitWarnings) plus buildInstalledOutcome, both dereferencing a definitely-assigned installCtx and safe only because runInstallLedgerBody returns a two-armed union 500 lines away; and handleInstallThrow composes a full failure message BEFORE its orchestrated branch, so a future throw inside composeInstallFailureMessage would escape from inside the entrypoint's own catch handler. Neither remedy is in bounds for the fix pass: restoring the catches creates arms no input can reach, which breaks the 100 percent direct-branch-coverage requirement for this pair, and adding the three orchestrators as injected collaborators is the test seam D-115-03 and CONVENTIONS.md forbid. This needs an operator decision.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T04:33:39.238Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "115",
    "file": "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts",
    "line": null,
    "description": "applyPlan's documented remove-before-add ordering is not discriminated by any input: swapping the two leaves the owner suite green, because the planner makes the removal and add buckets disjoint by name. The add-before-install and project-before-user orderings ARE discriminated and are pinned.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T04:33:39.577Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "115",
    "file": "extensions/pi-claude-marketplace/orchestrators/import/execute.ts",
    "line": null,
    "description": "CR-01: installOnePlannedPlugin's default assertNever arm was removed on the stated ground that TypeScript proves the InstallPluginOutcome switch exhaustive. It does not: a switch in a void-returning function with a missing arm compiles clean, so a third outcome arm would have fallen through, recorded the plugin in no result bucket, rendered no cascade row and under-counted the Import tally with typecheck, lint, fallow and the owner suite green. FIXED: the function now declares a PlannedPluginBucket return, restoring the TS2366 check at the switch. Verified by planting a third arm on InstallPluginOutcome (no diagnostic before, TS2366 after).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-02T06:22:19.083Z",
    "resolved_at": "2026-09-02T06:22:29.213Z"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "115",
    "file": "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts",
    "line": null,
    "description": "WR-03: three default assertNever arms were removed from applyMarketplaceOutcomeToBlock, applyPluginOutcomeToBlock and applyOutcomeToBlock on the ground that the narrowed Extract parameter makes each switch exhaustive. The union was narrow but the CHECK was absent: all three returned void, so a newly-added PerEntryOutcome kind compiled clean at all three sites and silently produced no row. FIXED: each applier now answers with the block it mutated, restoring TS2366 at the edit site. Verified by planting a PerEntryOutcome kind (no diagnostic before; after, TS2366 at the dispatcher and at each inner applier once the planted kind is routed into its narrowed parameter).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-02T06:22:29.544Z",
    "resolved_at": "2026-09-02T06:22:29.869Z"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "115",
    "file": "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
    "line": null,
    "description": "WR-01: the D-115-10 mode-discriminated overloads on addMarketplace, removeMarketplace, uninstallPlugin and setPluginEnabled are unchecked assertions, not compile-time proofs. TypeScript accepts a narrower overload return against a wider implementation with no diagnostic, and never verifies the body honours it; confirmed against this repository's compiler by making addMarketplace's orchestrated success arm return undefined, which typechecks clean at exit 0. Three runtime guards in reconcile/apply.ts were deleted on the strength of that narrowing, so the assertion was relocated from the consumer to the producer's signature rather than removed. Every orchestrated arm of all four producers returns a defined outcome today and the reconcile owner suite pins the exercised paths behaviourally; an arm that suite does not reach is covered by neither. The reviewer's structural fix (split each entrypoint so the narrow overload delegates to a helper whose DECLARED return type is Promise<TOutcome>) was not applied: it restructures three production modules whose Phase 114 owner suites are complete and closed to edits. Doc comments at all four sites now state that the narrowing is asserted, not proved.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T06:22:46.935Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "115",
    "file": "extensions/pi-claude-marketplace/orchestrators/import/execute.ts",
    "line": null,
    "description": "WR-04: buildImportNotificationMarketplaces iterates the header map byMp and looks plugin rows up in the sibling rowsByMp map, so any row whose (scope, marketplace) key carries no header is never visited and vanishes without trace behind the ?? [] fallback. Making MarketplaceBlock.status required prevents a STATUSLESS HEADER; it does not prevent a HEADERLESS ROW. What rules that out is an invariant spanning four functions: every pushMarketplaceRow site is reachable only for a plugin that passed the blockedMarketplaces gate, and scopedPlan derives pluginsToInstall and marketplacesToEnsure from the same refs set under one scope. No structural gate was added because the check would be an arm no input can reach, which breaks the 100 percent direct-branch-coverage requirement for this pair. The overstated doc comment was corrected to describe the invariant instead of implying the type enforces it. WR-06's fix removed the one concrete near-miss (the unknown-stored branch now assigns a status).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T06:22:47.283Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "unmet-truth",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts",
    "line": 41,
    "description": "Usage-string collapse arm is unreachable through the module exports, so the 116-13 pair stands at direct branches 11/12; reported, not pinned or excepted",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:03:02.310Z",
    "resolved_at": null
  }
]
````

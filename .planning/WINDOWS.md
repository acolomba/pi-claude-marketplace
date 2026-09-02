---
schema_version: 1
open_count: 7
waived_count: 0
fixed_count: 3
total_count: 10
last_updated: 2026-09-02T04:33:39.577Z
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
| 9 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts |  | Three per-entry catch clauses (marketplace add, plugin install, plugin toggle) were removed under the unreachable-code rule because addMarketplace, installPlugin and setPluginEnabled each answer with a typed outcome for every throw they can meet. RECON-03 per-entry isolation for those three now rests on an internal contract with no compile-time enforcement; a future throw added outside their guarded regions would abort the whole reconcile instead of surfacing one failed row. | open |  | 2026-09-02T04:33:39.238Z |  |
| 10 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts |  | applyPlan's documented remove-before-add ordering is not discriminated by any input: swapping the two leaves the owner suite green, because the planner makes the removal and add buckets disjoint by name. The add-before-install and project-before-user orderings ARE discriminated and are pinned. | open |  | 2026-09-02T04:33:39.577Z |  |

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
    "description": "Three per-entry catch clauses (marketplace add, plugin install, plugin toggle) were removed under the unreachable-code rule because addMarketplace, installPlugin and setPluginEnabled each answer with a typed outcome for every throw they can meet. RECON-03 per-entry isolation for those three now rests on an internal contract with no compile-time enforcement; a future throw added outside their guarded regions would abort the whole reconcile instead of surfacing one failed row.",
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
  }
]
````

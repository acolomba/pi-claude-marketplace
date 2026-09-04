---
schema_version: 1
open_count: 23
waived_count: 0
fixed_count: 7
total_count: 30
last_updated: 2026-09-04T01:03:42.619Z
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
| 9 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts |  | Three per-entry catch clauses (marketplace add, plugin install, plugin toggle) were removed under the unreachable-code rule because addMarketplace, installPlugin and setPluginEnabled each answer with a typed outcome for every throw they can meet. RECON-03 per-entry isolation for those three now rests on an internal contract with no compile-time enforcement. WR-02 corrects the blast radius recorded here: an escape is NOT confined to one entry losing its failed row. applyPlan is called bare inside applyReconcile's per-scope loop, unlike its neighbours applyBackfillForScopeIsolated and rebuildScopeRoutingTableIsolated (both wrapped in runScopeIsolated) and unlike the read pass (its own try). An escape from any of the three uncaught loops therefore aborts the remaining entries in that bucket, skips backfill and the routing-table rebuild for that scope, skips the sibling scope entirely (project runs first, so a project-scope throw means user scope never reconciles), and DISCARDS EVERY OUTCOME ACCUMULATED SO FAR because notifyReconcileAppliedWithContext is never reached. The user gets a raw error out of resources_discover instead of a cascade. WR-02 also records that no test can ever prove the loops safe: installPlugin, addMarketplace and setPluginEnabled are static imports and ApplyReconcileOptions exposes no injection seam, so apply.test.ts physically cannot plant a throwing collaborator (contrast the two loops that kept their catch, which ARE covered through raceStateFromRead). Two margins the header comment does not mention: installPlugin has one awaited statement outside its try (collectPostCommitWarnings) plus buildInstalledOutcome, both dereferencing a definitely-assigned installCtx and safe only because runInstallLedgerBody returns a two-armed union 500 lines away; and handleInstallThrow composes a full failure message BEFORE its orchestrated branch, so a future throw inside composeInstallFailureMessage would escape from inside the entrypoint's own catch handler. Neither remedy is in bounds for the fix pass: restoring the catches creates arms no input can reach, which breaks the 100 percent direct-branch-coverage requirement for this pair, and adding the three orchestrators as injected collaborators is the test seam D-115-03 and CONVENTIONS.md forbid. DECIDED 2026-09-02: the operator accepted the recorded exposure. No code change - both structural remedies collide with phase 115's own bounds (100% branch coverage; no test-only DI seam on apply.ts), and the removed arms are unreachable today, so there is no live defect. This entry stays `open` deliberately, as the durable record of the residual risk rather than as a pending action. Resolution recorded in 115-VERIFICATION.md human_verification item 2. | open |  | 2026-09-02T04:33:39.238Z |  |
| 10 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts |  | applyPlan's documented remove-before-add ordering is not discriminated by any input: swapping the two leaves the owner suite green, because the planner makes the removal and add buckets disjoint by name. The add-before-install and project-before-user orderings ARE discriminated and are pinned. | open |  | 2026-09-02T04:33:39.577Z |  |
| 11 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/import/execute.ts |  | CR-01: installOnePlannedPlugin's default assertNever arm was removed on the stated ground that TypeScript proves the InstallPluginOutcome switch exhaustive. It does not: a switch in a void-returning function with a missing arm compiles clean, so a third outcome arm would have fallen through, recorded the plugin in no result bucket, rendered no cascade row and under-counted the Import tally with typecheck, lint, fallow and the owner suite green. FIXED: the function now declares a PlannedPluginBucket return, restoring the TS2366 check at the switch. Verified by planting a third arm on InstallPluginOutcome (no diagnostic before, TS2366 after). | fixed |  | 2026-09-02T06:22:19.083Z | 2026-09-02T06:22:29.213Z |
| 12 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts |  | WR-03: three default assertNever arms were removed from applyMarketplaceOutcomeToBlock, applyPluginOutcomeToBlock and applyOutcomeToBlock on the ground that the narrowed Extract parameter makes each switch exhaustive. The union was narrow but the CHECK was absent: all three returned void, so a newly-added PerEntryOutcome kind compiled clean at all three sites and silently produced no row. FIXED: each applier now answers with the block it mutated, restoring TS2366 at the edit site. Verified by planting a PerEntryOutcome kind (no diagnostic before; after, TS2366 at the dispatcher and at each inner applier once the planted kind is routed into its narrowed parameter). | fixed |  | 2026-09-02T06:22:29.544Z | 2026-09-02T06:22:29.869Z |
| 13 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts |  | WR-01: the D-115-10 mode-discriminated overloads on addMarketplace, removeMarketplace, uninstallPlugin and setPluginEnabled are unchecked assertions, not compile-time proofs. TypeScript accepts a narrower overload return against a wider implementation with no diagnostic, and never verifies the body honours it; confirmed against this repository's compiler by making addMarketplace's orchestrated success arm return undefined, which typechecks clean at exit 0. Three runtime guards in reconcile/apply.ts were deleted on the strength of that narrowing, so the assertion was relocated from the consumer to the producer's signature rather than removed. Every orchestrated arm of all four producers returns a defined outcome today and the reconcile owner suite pins the exercised paths behaviourally; an arm that suite does not reach is covered by neither. The reviewer's structural fix (split each entrypoint so the narrow overload delegates to a helper whose DECLARED return type is Promise<TOutcome>) was not applied: it restructures three production modules whose Phase 114 owner suites are complete and closed to edits. Doc comments at all four sites now state that the narrowing is asserted, not proved. | open |  | 2026-09-02T06:22:46.935Z |  |
| 14 | 115 | deviation | extensions/pi-claude-marketplace/orchestrators/import/execute.ts |  | WR-04: buildImportNotificationMarketplaces iterates the header map byMp and looks plugin rows up in the sibling rowsByMp map, so any row whose (scope, marketplace) key carries no header is never visited and vanishes without trace behind the ?? [] fallback. Making MarketplaceBlock.status required prevents a STATUSLESS HEADER; it does not prevent a HEADERLESS ROW. What rules that out is an invariant spanning four functions: every pushMarketplaceRow site is reachable only for a plugin that passed the blockedMarketplaces gate, and scopedPlan derives pluginsToInstall and marketplacesToEnsure from the same refs set under one scope. No structural gate was added because the check would be an arm no input can reach, which breaks the 100 percent direct-branch-coverage requirement for this pair. The overstated doc comment was corrected to describe the invariant instead of implying the type enforces it. WR-06's fix removed the one concrete near-miss (the unknown-stored branch now assigns a status). | open |  | 2026-09-02T06:22:47.283Z |  |
| 15 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts | 41 | Usage-string collapse arm is unreachable through the module exports, so the 116-13 pair falls one branch short of complete direct coverage. NOT compiler-forced: parseCommandArgs passes the usage string only for a required positional and this schema declares its sole positional optional, so the arm is dead here and stays live for sibling handlers that declare a required one. Pinned by identity under the amended D-116-01a (commit ed0e490f); closes only by a production rewrite | open |  | 2026-09-02T22:03:02.310Z |  |
| 16 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/completions/data.ts | 188 | Right-hand side of the nullish fallback on the last-token read is unreachable through the module exports, so the 116-03 pair falls one branch short of complete direct coverage. Compiler-forced: Array.prototype.at() is typed T or undefined by the standard library, so the fallback must exist though the array is non-empty on every path reaching it. Proved by construction, by a brute force over all 65,536 BMP code points in five shapes, and by a plant that stayed green. Pinned by identity under the amended D-116-01a (commit ed0e490f); closes only by a production rewrite | open |  | 2026-09-02T22:04:43.869Z |  |
| 17 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/completions/provider.ts | 125 | Empty-object arm of the optionalDescription conditional is unreachable through the module exports, so the 116-05 pair falls one branch short of complete direct coverage. NOT compiler-forced; structural: the only two producers of the flagCompletions entry list are a written-out literal that carries a description and completionFlagEntries, whose every element derives from a FlagEntry whose description field is required. The declared element type keeps the field optional, so the guard must exist and nothing reachable can supply an entry without one. Proved by a plant that replaced the arm with a distinguishable description and stayed green, and by an independent route over 406 long-flag cursor prefixes spanning every top-level head, every marketplace subcommand, unknown heads and scope-, partial- and reference-bearing prefixes, which emitted 169 items with zero missing a description and zero carrying the marker. Pinned by identity under the amended D-116-01a; closes only by a production rewrite | open |  | 2026-09-03T00:18:38.629Z |  |
| 18 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts | 31 | String-conversion arm of the catch-block error formatter is unreachable through the module exports, so the 116-17 pair falls one branch short of complete direct coverage. COMPILER-FORCED: the only throw reaching this catch comes from parseArgs, which constructs a new Error at both of its throw sites, but a catch binding is typed unknown under useUnknownInCatchVariables, so the residual arm must exist; narrowing it needs a type assertion, which is barred throughout extensions/. Proved by a plant that replaced the arm with a distinguishable literal and stayed green across all 8 cases, by a live-arm plant that turned the tokenizer case red, and by an independent brute force over 3615 argument strings that produced 521 throws and zero non-Error values. Pinned by identity under the amended D-116-01a; closes only by a production rewrite (routing the catch through shared/errors.ts errorMessage) | open |  | 2026-09-03T00:44:13.846Z |  |
| 19 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts | 39 | Nullish-fallback arm on the first positional is unreachable through the module exports, so the 116-21 pair falls one branch short of complete direct coverage. COMPILER-FORCED: the guard on the line above has already proven the positional list non-empty and parseArgs pushes only non-undefined tokens onto it, but noUncheckedIndexedAccess (tsconfig.json:12) types the index read as possibly undefined, so the fallback must exist; removing it raises TS18048 at its consumption site and narrowing it needs a non-null or type assertion, both barred throughout extensions/. Proved by a plant that replaced the fallback with a distinguishable literal and stayed green across all 15 cases, by an OBSERVABLE plant that would have named a long-flag-shaped sentinel in the emission and also stayed green, and by an independent brute force over 19530 argument strings of up to six characters drawn from the tokenizer's significant alphabet that produced zero sentinel emissions while the same brute force with the index moved out of range reported it for 136 of 155. Pinned by identity under the amended D-116-01a; closes only by a production rewrite | open |  | 2026-09-03T04:09:41.716Z |  |
| 20 | 116 | deviation | extensions/pi-claude-marketplace/edge/register.ts | 18 | Two production comments assert a property the code does not have: register.ts:18-20 ("The cwd captured here is per-command-registration") and register.ts:104-106 ("Captured at registration time; threads through every keystroke's completion lookup via the closed-over resolver") both claim the working directory is read ONCE when the command is registered. It is not. process.cwd() is evaluated INSIDE the getArgumentCompletions arrow (register.ts:107-108), so it is read on every completion invocation and nothing is closed over. Measured by the 116-28 owner: registering under one hermetic root, moving the process into a second root, then driving the captured callback returns the SECOND root's marketplace names; Plant C, which hoists the read above pi.registerCommand into a registrationCwd binding, turns exactly that case RED. The plan's own must_haves inherited the comment's claim as a truth to prove, and its literal Plant 3 ("move the working-directory read from registration time into the completion callback") has NO TARGET because the read is already there. Behaviourally harmless today, because index.ts registers once per session and Pi does not chdir; it needs an operator decision on which of the two is authoritative. Not fixed: both production licences for this phase (116-06 flag-catalog.ts, 116-27 tools.ts) are spent and no remaining plan may edit a production file. | open |  | 2026-09-03T06:11:16.092Z |  |
| 21 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/args.ts | 34 | Index-read guard at 34-37 is unreachable at runtime, so the 116-02 pair falls one branch short of complete direct coverage. COMPILER-FORCED: noUncheckedIndexedAccess (tsconfig.json:12) types every index read as T or undefined, so a loop whose bounds already guarantee the read must still carry a guard the loop can never enter. Removing it needs a non-null assertion, which is an error throughout extensions under strictTypeChecked. Pinned by identity in the 116-02 pair; original D-116-01a claimant | open |  | 2026-09-03T11:00:38.155Z |  |
| 22 | 116 | unmet-truth | extensions/pi-claude-marketplace/edge/handlers/shared.ts | 53 | Cross-cutting flag scanner guard at 53-55 is unreachable at runtime, so the 116-26 pair falls one branch short of complete direct coverage. COMPILER-FORCED, same class as the args.ts claimant. Pinned by identity in the 116-26 pair; original D-116-01a claimant | open |  | 2026-09-03T11:00:38.508Z |  |
| 23 | 117 | deviation | extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts | 476 | Doc comment on isHooksResolverNote still cites tests/orchestrators/plugin/cross-surface-reason-parity.test.ts; 117-04 moved that suite to tests/architecture/ and may not edit production | open |  | 2026-09-03T18:15:25.451Z |  |
| 24 | 117 | stub | docs/output-catalog.md | 2729 | Output catalog still names the deleted tests/shared/device-flow-prompt.test.ts as the AUTH-03 byte-form lock; the lock now lives in tests/domain/github-auth.test.ts | open |  | 2026-09-03T18:29:36.570Z |  |
| 25 | 117 | deviation | .planning/codebase/TESTING.md | 124 | TESTING.md still describes tests/helpers/ as live and names four modules by their pre-move paths; the directory and both glob alternatives are gone as of 117-07 | open |  | 2026-09-03T19:17:31.820Z |  |
| 26 | 117 | deviation | extensions/pi-claude-marketplace/bridges/hooks/event-router.ts | 741 | Comment justifying the SessionStart gate on ensureSharedDataDir names tests/edge/index-handler.test.ts as the pin for the WR-05 clean-reconcile invariant; 117-08 deleted that suite and may not edit production. The invariant itself survives: tests/index.test.ts asserts neither scope root is created by a clean reconcile. | open |  | 2026-09-03T19:50:24.976Z |  |
| 27 | 117 | unrun-verify | scripts/test-coverage-direct.mjs |  | test:coverage:direct:all cannot complete on this tree: it throws on the first of the seven accepted D-116-01a single-branch shortfalls (ledger 15-19, 21, 22), so COV-05's 204-row result is 190 complete records + 7 accepted shortfalls + 7 type-only, not D-117-20's 197 + 7 | fixed |  | 2026-09-03T21:13:03.167Z | 2026-09-03T22:06:14.027Z |
| 28 | 117 | deviation | tests/bridges/agents/marker.test.ts | 232 | PATH node was upgraded v26.7.0 -> v26.8.1 mid-phase (26.7.0 no longer in the Cellar). On 26.8.1 readFile on a directory attaches path to the EISDIR error; eleven whole-value assertions across ten suites compare against path: undefined and now fail. Measured: npm test is 5131/11 on v26.8.1 and 5142/0 on /usr/bin/node v22.22.2. CI is unaffected (pins Node 24). Same class as D-117-18: a whole-value comparison capturing a runtime-owned value. | fixed |  | 2026-09-03T21:13:11.747Z | 2026-09-03T22:06:08.080Z |
| 29 | 117 | deviation | .planning/codebase/CONVENTIONS.md | 151 | CONVENTIONS.md:151 claims barrels exist per bridge kind 'plus the aggregate bridges/index.ts'. Measured in 117-12: extensions/pi-claude-marketplace/bridges/ holds agents/, commands/, hooks/, mcp/, skills/ and README.md — there is no bridges/index.ts. The five per-kind barrels do exist. Documentation drift in a planning document, outside the source tree and outside this phase's scope (D-117-13 opened no production licence and this plan edits no source); recorded, not fixed. | open |  | 2026-09-03T22:29:00.933Z |  |
| 30 | 117 | unrun-verify | scripts/test-coverage-direct.mjs |  | WR-05 (review iteration 2): the two direct-coverage sweeps have no automated control. Both stop at the first accepted D-116-01a shortfall, so a red run does not distinguish a genuine new gap from a known one, and test:coverage:direct:negative runs in every CI job while the gate it controls runs nowhere. The reviewer's remedy (teach the script an accepted-shortfall list) is barred in terms by D-117-20: 'not by a ledger-keyed verdict (which would be D-116-01a's banned pragma wearing a different hat)'. Built and measured during the fix pass, then reverted unshipped: with the list the changed-pairs sweep runs 204 pairs at exit 0 (197 passed, 7 accepted shortfalls each named with its ledger entry), and both self-expiry refusals work (a listed module that becomes complete, and an entry naming a module no longer in the tree). All seven readings are identical on Node v22.22.2 and v26.8.1. Mitigated in documentation only: CONTRIBUTING.md now names the seven modules and their exact readings, so a contributor can tell an expected stop from a regression without opening a planning artifact. Needs an operator decision to close: either revisit D-117-20 or accept that the gate has no CI control. RESOLVED 2026-09-04 by operator decision: D-117-20 stands (no ledger-keyed gate verdict); SC-4's literal wording accepted as superseded via an overrides entry on 117-VERIFICATION.md. The reproducibility half was fixed outright by npm run test:coverage:direct:report (commit 1495488b), which regenerates all 204 rows from the gate's own enumeration and blocks nothing. | fixed |  | 2026-09-04T01:03:42.619Z |  |

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
    "description": "Usage-string collapse arm is unreachable through the module exports, so the 116-13 pair falls one branch short of complete direct coverage. NOT compiler-forced: parseCommandArgs passes the usage string only for a required positional and this schema declares its sole positional optional, so the arm is dead here and stays live for sibling handlers that declare a required one. Pinned by identity under the amended D-116-01a (commit ed0e490f); closes only by a production rewrite",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:03:02.310Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "unmet-truth",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/completions/data.ts",
    "line": 188,
    "description": "Right-hand side of the nullish fallback on the last-token read is unreachable through the module exports, so the 116-03 pair falls one branch short of complete direct coverage. Compiler-forced: Array.prototype.at() is typed T or undefined by the standard library, so the fallback must exist though the array is non-empty on every path reaching it. Proved by construction, by a brute force over all 65,536 BMP code points in five shapes, and by a plant that stayed green. Pinned by identity under the amended D-116-01a (commit ed0e490f); closes only by a production rewrite",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:04:43.869Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "unmet-truth",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/completions/provider.ts",
    "line": 125,
    "description": "Empty-object arm of the optionalDescription conditional is unreachable through the module exports, so the 116-05 pair falls one branch short of complete direct coverage. NOT compiler-forced; structural: the only two producers of the flagCompletions entry list are a written-out literal that carries a description and completionFlagEntries, whose every element derives from a FlagEntry whose description field is required. The declared element type keeps the field optional, so the guard must exist and nothing reachable can supply an entry without one. Proved by a plant that replaced the arm with a distinguishable description and stayed green, and by an independent route over 406 long-flag cursor prefixes spanning every top-level head, every marketplace subcommand, unknown heads and scope-, partial- and reference-bearing prefixes, which emitted 169 items with zero missing a description and zero carrying the marker. Pinned by identity under the amended D-116-01a; closes only by a production rewrite",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T00:18:38.629Z",
    "resolved_at": null
  },
  {
    "id": 18,
    "kind": "unmet-truth",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts",
    "line": 31,
    "description": "String-conversion arm of the catch-block error formatter is unreachable through the module exports, so the 116-17 pair falls one branch short of complete direct coverage. COMPILER-FORCED: the only throw reaching this catch comes from parseArgs, which constructs a new Error at both of its throw sites, but a catch binding is typed unknown under useUnknownInCatchVariables, so the residual arm must exist; narrowing it needs a type assertion, which is barred throughout extensions/. Proved by a plant that replaced the arm with a distinguishable literal and stayed green across all 8 cases, by a live-arm plant that turned the tokenizer case red, and by an independent brute force over 3615 argument strings that produced 521 throws and zero non-Error values. Pinned by identity under the amended D-116-01a; closes only by a production rewrite (routing the catch through shared/errors.ts errorMessage)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T00:44:13.846Z",
    "resolved_at": null
  },
  {
    "id": 19,
    "kind": "unmet-truth",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts",
    "line": 39,
    "description": "Nullish-fallback arm on the first positional is unreachable through the module exports, so the 116-21 pair falls one branch short of complete direct coverage. COMPILER-FORCED: the guard on the line above has already proven the positional list non-empty and parseArgs pushes only non-undefined tokens onto it, but noUncheckedIndexedAccess (tsconfig.json:12) types the index read as possibly undefined, so the fallback must exist; removing it raises TS18048 at its consumption site and narrowing it needs a non-null or type assertion, both barred throughout extensions/. Proved by a plant that replaced the fallback with a distinguishable literal and stayed green across all 15 cases, by an OBSERVABLE plant that would have named a long-flag-shaped sentinel in the emission and also stayed green, and by an independent brute force over 19530 argument strings of up to six characters drawn from the tokenizer's significant alphabet that produced zero sentinel emissions while the same brute force with the index moved out of range reported it for 136 of 155. Pinned by identity under the amended D-116-01a; closes only by a production rewrite",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T04:09:41.716Z",
    "resolved_at": null
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/register.ts",
    "line": 18,
    "description": "Two production comments assert a property the code does not have: register.ts:18-20 (\"The cwd captured here is per-command-registration\") and register.ts:104-106 (\"Captured at registration time; threads through every keystroke's completion lookup via the closed-over resolver\") both claim the working directory is read ONCE when the command is registered. It is not. process.cwd() is evaluated INSIDE the getArgumentCompletions arrow (register.ts:107-108), so it is read on every completion invocation and nothing is closed over. Measured by the 116-28 owner: registering under one hermetic root, moving the process into a second root, then driving the captured callback returns the SECOND root's marketplace names; Plant C, which hoists the read above pi.registerCommand into a registrationCwd binding, turns exactly that case RED. The plan's own must_haves inherited the comment's claim as a truth to prove, and its literal Plant 3 (\"move the working-directory read from registration time into the completion callback\") has NO TARGET because the read is already there. Behaviourally harmless today, because index.ts registers once per session and Pi does not chdir; it needs an operator decision on which of the two is authoritative. Not fixed: both production licences for this phase (116-06 flag-catalog.ts, 116-27 tools.ts) are spent and no remaining plan may edit a production file.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T06:11:16.092Z",
    "resolved_at": null
  },
  {
    "id": 21,
    "kind": "unmet-truth",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/args.ts",
    "line": 34,
    "description": "Index-read guard at 34-37 is unreachable at runtime, so the 116-02 pair falls one branch short of complete direct coverage. COMPILER-FORCED: noUncheckedIndexedAccess (tsconfig.json:12) types every index read as T or undefined, so a loop whose bounds already guarantee the read must still carry a guard the loop can never enter. Removing it needs a non-null assertion, which is an error throughout extensions under strictTypeChecked. Pinned by identity in the 116-02 pair; original D-116-01a claimant",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T11:00:38.155Z",
    "resolved_at": null
  },
  {
    "id": 22,
    "kind": "unmet-truth",
    "phase": "116",
    "file": "extensions/pi-claude-marketplace/edge/handlers/shared.ts",
    "line": 53,
    "description": "Cross-cutting flag scanner guard at 53-55 is unreachable at runtime, so the 116-26 pair falls one branch short of complete direct coverage. COMPILER-FORCED, same class as the args.ts claimant. Pinned by identity in the 116-26 pair; original D-116-01a claimant",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T11:00:38.508Z",
    "resolved_at": null
  },
  {
    "id": 23,
    "kind": "deviation",
    "phase": "117",
    "file": "extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts",
    "line": 476,
    "description": "Doc comment on isHooksResolverNote still cites tests/orchestrators/plugin/cross-surface-reason-parity.test.ts; 117-04 moved that suite to tests/architecture/ and may not edit production",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T18:15:25.451Z",
    "resolved_at": null
  },
  {
    "id": 24,
    "kind": "stub",
    "phase": "117",
    "file": "docs/output-catalog.md",
    "line": 2729,
    "description": "Output catalog still names the deleted tests/shared/device-flow-prompt.test.ts as the AUTH-03 byte-form lock; the lock now lives in tests/domain/github-auth.test.ts",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T18:29:36.570Z",
    "resolved_at": null
  },
  {
    "id": 25,
    "kind": "deviation",
    "phase": "117",
    "file": ".planning/codebase/TESTING.md",
    "line": 124,
    "description": "TESTING.md still describes tests/helpers/ as live and names four modules by their pre-move paths; the directory and both glob alternatives are gone as of 117-07",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T19:17:31.820Z",
    "resolved_at": null
  },
  {
    "id": 26,
    "kind": "deviation",
    "phase": "117",
    "file": "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts",
    "line": 741,
    "description": "Comment justifying the SessionStart gate on ensureSharedDataDir names tests/edge/index-handler.test.ts as the pin for the WR-05 clean-reconcile invariant; 117-08 deleted that suite and may not edit production. The invariant itself survives: tests/index.test.ts asserts neither scope root is created by a clean reconcile.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T19:50:24.976Z",
    "resolved_at": null
  },
  {
    "id": 27,
    "kind": "unrun-verify",
    "phase": "117",
    "file": "scripts/test-coverage-direct.mjs",
    "line": null,
    "description": "test:coverage:direct:all cannot complete on this tree: it throws on the first of the seven accepted D-116-01a single-branch shortfalls (ledger 15-19, 21, 22), so COV-05's 204-row result is 190 complete records + 7 accepted shortfalls + 7 type-only, not D-117-20's 197 + 7",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-03T21:13:03.167Z",
    "resolved_at": "2026-09-03T22:06:14.027Z"
  },
  {
    "id": 28,
    "kind": "deviation",
    "phase": "117",
    "file": "tests/bridges/agents/marker.test.ts",
    "line": 232,
    "description": "PATH node was upgraded v26.7.0 -> v26.8.1 mid-phase (26.7.0 no longer in the Cellar). On 26.8.1 readFile on a directory attaches path to the EISDIR error; eleven whole-value assertions across ten suites compare against path: undefined and now fail. Measured: npm test is 5131/11 on v26.8.1 and 5142/0 on /usr/bin/node v22.22.2. CI is unaffected (pins Node 24). Same class as D-117-18: a whole-value comparison capturing a runtime-owned value.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-03T21:13:11.747Z",
    "resolved_at": "2026-09-03T22:06:08.080Z"
  },
  {
    "id": 29,
    "kind": "deviation",
    "phase": "117",
    "file": ".planning/codebase/CONVENTIONS.md",
    "line": 151,
    "description": "CONVENTIONS.md:151 claims barrels exist per bridge kind 'plus the aggregate bridges/index.ts'. Measured in 117-12: extensions/pi-claude-marketplace/bridges/ holds agents/, commands/, hooks/, mcp/, skills/ and README.md — there is no bridges/index.ts. The five per-kind barrels do exist. Documentation drift in a planning document, outside the source tree and outside this phase's scope (D-117-13 opened no production licence and this plan edits no source); recorded, not fixed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T22:29:00.933Z",
    "resolved_at": null
  },
  {
    "id": 30,
    "kind": "unrun-verify",
    "phase": "117",
    "file": "scripts/test-coverage-direct.mjs",
    "line": null,
    "description": "WR-05 (review iteration 2): the two direct-coverage sweeps have no automated control. Both stop at the first accepted D-116-01a shortfall, so a red run does not distinguish a genuine new gap from a known one, and test:coverage:direct:negative runs in every CI job while the gate it controls runs nowhere. The reviewer's remedy (teach the script an accepted-shortfall list) is barred in terms by D-117-20: 'not by a ledger-keyed verdict (which would be D-116-01a's banned pragma wearing a different hat)'. Built and measured during the fix pass, then reverted unshipped: with the list the changed-pairs sweep runs 204 pairs at exit 0 (197 passed, 7 accepted shortfalls each named with its ledger entry), and both self-expiry refusals work (a listed module that becomes complete, and an entry naming a module no longer in the tree). All seven readings are identical on Node v22.22.2 and v26.8.1. Mitigated in documentation only: CONTRIBUTING.md now names the seven modules and their exact readings, so a contributor can tell an expected stop from a regression without opening a planning artifact. Needs an operator decision to close: either revisit D-117-20 or accept that the gate has no CI control.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T01:03:42.619Z",
    "resolved_at": null
  }
]
````

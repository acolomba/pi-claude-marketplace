---
phase: 01-staging-warning-channels
verified: 2026-10-27T00:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/01-staging-warning-channels/01-01-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-01-SUMMARY.md
  - .planning/phases/01-staging-warning-channels/01-02-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-02-SUMMARY.md
  - .planning/phases/01-staging-warning-channels/01-03-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-03-SUMMARY.md
  - .planning/phases/01-staging-warning-channels/01-04-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-04-SUMMARY.md
  - .planning/phases/01-staging-warning-channels/01-05-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-05-SUMMARY.md
  - .planning/phases/01-staging-warning-channels/01-06-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-06-SUMMARY.md
  - .planning/phases/01-staging-warning-channels/01-07-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-07-SUMMARY.md
  - .planning/phases/01-staging-warning-channels/01-08-PLAN.md
  - .planning/phases/01-staging-warning-channels/01-08-SUMMARY.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/staging-warnings.ts
  - features/plugin/staging-warnings.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - test/architecture/workflows-marker-coverage.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/agents/types.test.ts
  - test/bridges/commands/stage.test.ts
  - test/bridges/commands/types.test.ts
  - test/bridges/mcp/stage.test.ts
  - test/bridges/mcp/types.test.ts
  - test/bridges/skills/stage.test.ts
  - test/bridges/skills/types.test.ts
  - test/bridges/workflows/stage.test.ts
  - test/bridges/workflows/types.test.ts
  - test/integration/plugin-layer-verbs.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/reinstall-record.test.ts
  - test/orchestrators/plugin/reinstall.messaging.test.ts
  - test/orchestrators/plugin/shared.test.ts
  - test/orchestrators/plugin/update-cascade.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-row.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/types.test.ts
  - test/shared/staging-warnings.test.ts
covered_digest: "v4:sha256:a0539186e5f78f7a71ae0a04f681c034802cb1dfde721ce88ba246e2ae659f57"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Staging Warning Channels Verification Report

**Phase Goal:** `enable`, the update and reinstall cascades, and a failed install, update, or reinstall show the staging warnings a standalone install shows, and the two warning channels are told apart by type.
**Verified:** 2026-10-27
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths (ROADMAP success criteria; the plan truths are merged under them)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Enabling a plugin whose skills collide reports the same skip `install` reports, and a scenario proves it (WRN-01) | VERIFIED | `enable-disable.ts`: `materializeEnableRoot` returns `stagingWarnings` from `summary.discoveryWarnings` and `summary.bridgeWarnings`. Both enable branches (`runEnableBranch` and `runFreshEnableCascadeWithRoot`) set them on the sink. `surfaceEnableStagingWarnings` renders them with the verb `enabled` before `notifyMcpConfigNotices`. The scenario "Enabling a plugin whose skills collide..." passes, and its skip line is byte-identical to the install and update lines. |
| 2 | A `marketplace update` cascade, an autoupdate cascade, and an `apply` catalog move each render a moved plugin's warnings under one header that names the plugin and its scope (WRN-02) | VERIFIED | `marketplace/update.ts::refreshOneMarketplace` calls `surfaceCascadeStagingWarnings` after the cascade rows and before the MCP notices. `updateMarketplace` and `updateAllMarketplaces` both reach `refreshOneMarketplace` (line 816 runs `cascadeAutoupdates`), so the autoupdate cascade takes the same path. `apply.ts::reportScopePasses` calls `surfaceStagingDiagnostics(stagingDiagnosticsOf(outcomes))`, and the carriers are wired in `grownMoveOutcomes`, `convergedMoveOutcomes`, and `applyPluginToggles`. The scenarios for the marketplace update with autoupdate on, the apply catalog move, and the apply enable pass with `Plugin "demo" [project] updated/enabled; ...`. |
| 3 | Every bridge returns tagged warnings, and assigning a hygiene warning to the discovery channel fails `npm run typecheck` (WRN-03) | VERIFIED | New leaf module `shared/staging-warnings.ts`. The skills, commands, and workflows stages tag `discoveryWarning`, and mcp tags `hygieneWarning`. Agents tags D-07 skips as discovery and corruptions and conversion notes as hygiene. Hooks has no warnings member (D-PL1-02). `splitStagingWarnings` is deleted (grep finds 0 hits). `surfaceDiscoveryWarnings` takes `readonly DiscoveryWarning[]`. Two `@ts-expect-error` pins exist: `test/shared/staging-warnings.test.ts:15` and `test/orchestrators/plugin/shared.test.ts:3641`. Typecheck passed in `npm run check` at 7adfd8c7, and HEAD differs from that commit only in `.planning` docs, so both directives raise the expected error. The agents D-07 install scenario passes. |
| 4 | An install whose mcp phase fails after the skills phase skipped a duplicate shows that skip beside the `(failed)` row (WRN-04). Update and reinstall failures do the same. | VERIFIED | `install-outcome.ts` calls `captureStagingWarnings(capture, ctxLocal)` on a `runPhases` failure, and `install-flow.ts::handleInstallThrow` renders `install failed`. `update-swap.ts::reportStagingWarnings` reports from the prepare catch and before the intent mark. `composePhase3FailureOutcome` carries `stagingWarnings`. `update-flow.ts` renders `update failed` in the abort and failed paths. `reinstall-flow.ts::failReinstall` and `reinstall-record.ts` carry `discoveryWarnings` with `reinstall failed`. The three failure scenarios (install, update, reinstall) pass. |
| 5 | A reinstall keeps a hand-named `agents-index.json` row (WRN-05). `update` shows a dependency's MCP notices (WRN-06). A reinstall drops the completion cache once (WRN-07). | VERIFIED | WRN-05: `bridges/agents/stage.ts::partitionPreviousEntries` replaces under force only the foreign rows whose `generatedName` is staged. The unit test "D-PL1-15: force replaces a staged row ... keeps a hand-named row with its file" passes. Reinstall passes `force: policy.overwrite` (`update-swap.ts:1231`). WRN-06: `saveRootClosure` spreads `mcpConfigNotices`. `runDependencySteps` accumulates them, and `materialize-latest.ts::settleNoticesFirst` puts them first. The scenario "Updating a plugin whose new version needs a dependency with an MCP server..." passes. WRN-07: `runPostSuccessMaintenance` no longer drops the cache. `CONVERGED_SCHEDULE` in `reinstall-flow.test.ts` holds exactly one `drop:cache`. `resourcesChanged` is required on the `updated` and `reinstalled` arms, and its derivation is tested both ways (`update-swap.test.ts:1784`, `reinstall-record.test.ts:579`). |

**Score:** 5/5 truths verified (0 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/staging-warnings.ts` | Tagged types, constructors, partition | VERIFIED | 48 lines. Imported by every bridge stage and by the orchestrators. |
| `bridges/{skills,commands,agents,mcp,workflows}/{stage,types}.ts` | `warnings: readonly StagingWarning[]` | VERIFIED | Tagged at the producer as D-PL1-02 specifies. |
| `orchestrators/plugin/shared.ts` | `surfaceStagingDiagnostics`, scoped header, seven-verb union | VERIFIED | Header is `Plugin "<n>" [<scope>] <verb>; ...`. |
| `orchestrators/marketplace/update.messaging.ts` | Cascade helper | VERIFIED | Called from `update.ts:912`. |
| `orchestrators/reconcile/apply-outcomes.ts` | `carriedStagingWarnings`, `stagingDiagnosticsOf` | VERIFIED | Used in `apply.ts` and `notify.ts`. |
| `features/plugin/staging-warnings.feature` | 11 scenarios | VERIFIED | 11 of 11 pass. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| bridge prepare results | install ledger context | `collectStagingWarnings` -> `partitionStagingWarnings` | WIRED |
| install ledger failure | standalone failure diagnostic | `InstallFailureCapture.stagingWarnings` -> `handleInstallThrow` | WIRED |
| swap handles | updated/failed outcome | `collectUpdateWarnings`, `onStagingWarnings` -> `CandidateReport` | WIRED |
| runner outcome | marketplace cascade render | `outcome.stagingWarnings` -> `surfaceCascadeStagingWarnings` | WIRED |
| runner/enable outcome | apply render | `carriedStagingWarnings` -> `stagingDiagnosticsOf` -> `surfaceStagingDiagnostics` | WIRED |
| settle cascade | update outcome notices | `saveRootClosure` -> `runDependencySteps` -> `settleNoticesFirst` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All phase scenarios | `npx cucumber-js features/plugin/staging-warnings.feature` (sandboxed HOME) | 11 scenarios, 121 steps passed, exit 0 | PASS |
| Warning module and leaf tests | `node --test` on staging-warnings, agents stage, shared, dependency-settle, materialize-latest, reinstall-record, update.messaging, apply-outcomes, types | 388/388 pass | PASS |
| Orchestrator flows | `node --test` on enable-disable, update-swap, update-flow, reinstall-flow, install-outcome, install-flow, marketplace/update, reconcile/apply, reconcile/notify | 1644/1644 pass | PASS |

The scenarios fail without the change: before this phase every header lacked the `[scope]` bracket, the agents D-07 skips rode the hygiene channel, and `saveRootClosure` dropped the settle notices.

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` exists, and no plan declares a probe.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| WRN-01 | 01-05 | SATISFIED | Truth 1 |
| WRN-02 | 01-01, 01-02, 01-07 | SATISFIED | Truth 2 |
| WRN-03 | 01-01, 01-02 | SATISFIED | Truth 3 |
| WRN-04 | 01-06 | SATISFIED | Truth 4 |
| WRN-05 | 01-03 | SATISFIED | Truth 5 |
| WRN-06 | 01-08 | SATISFIED | Truth 5 |
| WRN-07 | 01-04 | SATISFIED | Truth 5 |

No requirement is orphaned. All seven WRN IDs appear in the plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `orchestrators/plugin/install-outcome.ts` | 1379-1382 | Stale comment. The WR-04 note in `workflowsPhase` still says the warnings "are lost on the failure path wherever they are collected". `captureStagingWarnings` now copies them onto the failure capture (D-PL1-13). | Warning | Misleading documentation only. Behavior is correct and proven by the install-failure scenario. |

The added lines contain no TBD, FIXME, XXX, TODO, or placeholder markers.

### Human Verification Required

None.

### Notes

- CONTEXT.md lists seven "Uncertain choices (for user review)" (D-PL1-08 cascades render the discovery half only, D-PL1-15 match on new names, D-PL1-18 no reader of `resourcesChanged`, and others). These are design choices that the code implements as decided. They do not block the goal and are left for the operator's review.
- The deferred items (cascade members' warnings, `enable failed`, dependency-move notices, apply's and import's failed-install rows) are recorded in CONTEXT.md as out of scope. Phases 3 and 6 carry them.

### Gaps Summary

No gaps. Every ROADMAP success criterion is backed by wired code, unit tests, and a passing cucumber scenario.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_

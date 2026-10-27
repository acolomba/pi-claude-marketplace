---
phase: 06-import-marketplace-planning
verified: 2026-10-27T06:11:29Z
status: human_needed
score: 4/4 must-haves verified
covered_files:
  - ".agents/skills/cucumber/rules/features.md"
  - ".planning/phases/06-import-marketplace-planning/06-01-PLAN.md"
  - ".planning/phases/06-import-marketplace-planning/06-01-SUMMARY.md"
  - ".planning/phases/06-import-marketplace-planning/06-02-PLAN.md"
  - ".planning/phases/06-import-marketplace-planning/06-02-SUMMARY.md"
  - ".planning/phases/06-import-marketplace-planning/06-03-PLAN.md"
  - ".planning/phases/06-import-marketplace-planning/06-03-SUMMARY.md"
  - ".planning/phases/06-import-marketplace-planning/06-04-PLAN.md"
  - ".planning/phases/06-import-marketplace-planning/06-04-SUMMARY.md"
  - ".planning/phases/06-import-marketplace-planning/06-05-PLAN.md"
  - ".planning/phases/06-import-marketplace-planning/06-05-SUMMARY.md"
  - ".planning/phases/06-import-marketplace-planning/06-06-PLAN.md"
  - ".planning/phases/06-import-marketplace-planning/06-06-SUMMARY.md"
  - "extensions/pi-claude-marketplace/orchestrators/import/execute.ts"
  - "extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts"
  - "extensions/pi-claude-marketplace/orchestrators/import/types.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts"
  - "features/lib/field-rows.ts"
  - "features/lib/published-marketplace.ts"
  - "features/lib/run-tokens.ts"
  - "features/plugin/apply.feature"
  - "features/plugin/import.feature"
  - "features/plugin/install-rollback.feature"
  - "features/step_definitions/plugin/publishing.steps.ts"
  - "test/orchestrators/import/execute.test.ts"
  - "test/orchestrators/import/marketplaces.test.ts"
  - "test/orchestrators/import/types.test.ts"
  - "test/orchestrators/plugin/enable-disable.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/reconcile/apply-outcomes.test.ts"
  - "test/orchestrators/reconcile/apply.test.ts"
  - "test/orchestrators/reconcile/notify.test.ts"
  - "test/orchestrators/reconcile/plan.test.ts"
covered_digest: "v4:sha256:49fb01f005f9148a0196117bf02dc6a5285bd269324adeb673156abe2cf37ca5"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Review uncertain choice 1 of 06-CONTEXT.md / 06-06-SUMMARY.md: D-PL6-02 installs `p@<settings name>` as `p@<recorded name>` when the settings name a marketplace whose source the scope records under one other name"
    expected: "The operator accepts the alias (current behavior, pinned by the scenario 'Importing settings that name a known marketplace under another name installs the plugin under the recorded marketplace') or asks for Claude Code's plugin outcome, `marketplace-not-found` for each `p@<settings name>` (E2)"
    why_human: "MIM-01 says 'as Claude Code does' and SC-1 says 'with Claude Code's outcome'. The marketplace outcome matches E2 (reuse the record, no clone, no error). The plugin outcome does not: Claude Code fails the plugin. The divergence carries a decision ID (D-PL6-02), which CLAUDE.md accepts as a license, but the phase itself lists it under 'Uncertain choices (for user review)', and no record shows the operator accepted it"
  - test: "Review the WR-01 arm: settings that name a settings marketplace `other` with the recorded marketplace's source AND also declare the recorded name `fixtures` themselves"
    expected: "Current behavior: no alias; `other` goes to the add and fails `Marketplace \"fixtures\" already exists in user scope.` (scenario 'Importing settings that also declare the recorded name of a known marketplace does not follow its source to that record'). The operator confirms this outcome is wanted"
    why_human: "Claude Code's add (E2, `Lle`) finds the source recorded under another name and returns that name without error, so its outcome for `other` is a silent reuse, not a failure. This arm came from review fix WR-01, after the CONTEXT decisions, and no decision row covers its user-visible failure"
---

# Phase 6: Import Marketplace Planning Verification Report

**Phase Goal:** `import` registers marketplaces as Claude Code does and reports partial rollbacks with install's detail.
**Verified:** 2026-10-27T06:11:29Z
**Status:** human_needed
**Re-verification:** No. This is the first verification.

All four requirements are implemented, wired, and covered by cucumber scenarios. Each new import and apply scenario fails on the phase base source and passes at HEAD. `npm run check` exits 0. The status is `human_needed` only because the phase lists its MIM-01 plugin-level divergence from Claude Code as an uncertain choice for the user, and a review-fix arm adds a second one.

## Goal Achievement

### Observable Truths (ROADMAP success criteria and requirements)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1 / MIM-02: an `extraKnownMarketplaces` entry that no enabled plugin names is added and declared, as Claude Code's reconciler does (E1) | VERIFIED | `import/marketplaces.ts:104` `planMarketplaceSources` plans the referenced marketplaces first, then every other extra entry in settings order, and skips the official marketplace (D-PL6-08). The post-pass declares it (`execute.ts` `buildBatchedPatchForScope`). Scenario `import.feature:630` "Importing adds an extra known marketplace that no enabled plugin names": `tools (added)`, declared in `claude-plugins.json`. Unit tests: `marketplaces.test.ts:816,857,897,928`, `execute.test.ts:1144,1211` (an unreferenced entry alone takes the scope lock) |
| 2 | SC-1 / MIM-01: a settings marketplace whose source the scope records under another name reuses the record: no add, `(skipped) {already added}` under the recorded name, plugin installed under it, config steady (`pending` empty) | VERIFIED | `reconcile/plan.ts:269` `marketplaceSourceClaims` (the planner's own `buildMarketplaceClaims`, D-PL6-10). `execute.ts:1521` `readPassForImport` filters claims to one-to-one claims of names the settings do not declare (WR-01). `execute.ts:1599` `aliasedScopePlan` rewrites `marketplace` and `raw`, and `executeScopedPlan` passes the aliased plan to ensure, install, and the post-pass. `execute.ts:1498` `configNamesByRecorded` keeps a name the config already uses (CR-01). `execute.ts:1004` `sourceMismatchCause` names a conflicted claim (WR-02). Scenarios: `import.feature:670` (renamed source, `pending` → `reconcile-pending-empty`), `:713` (CR-01: config keeps `other` / `demo@other`, `pending` empty), `:752` (WR-01), `:781` (WR-02). Plugin-level parity: see Human Verification 1 |
| 3 | SC-2 / MIM-03: a partial rollback during `import` and during `apply` shows the per-phase detail `install` shows | VERIFIED | Reference detail: `install-rollback.feature:60` "An install whose skills rollback cannot finish names the skills phase" (`(failed) {rollback partial}`, `[skills]` phase with `{read-only skill directory removal error}`). Import: `execute.ts:637` `unexpectedFailureRows`, `:2128` `partialMember`, `:2143` `redactedRollbackPartials` (D-PL6-12), fed by `dispatchFailedOutcome(... rollbackPartials)` from the install path and the enable path. No boolean partial flag remains in `execute.ts`. Dependency partials come from `install-flow.ts:1835` `memberPartials` in `handleCascadeThrow`, and enable partials from `enable-disable.ts:2934`. Apply: `apply.ts:544` `installFailedOutcomes`, `:490` `dependencyRollbackOutcome`, `apply-outcomes.ts` `PluginInstallFailedOutcome.rollbackPartials`, `notify.ts:1166` `failedRowRollback`. Scenarios with the same `rollback partial` cell as install: import `:810` (own install), `:846` (enable), `:883` (dependency), `:918` (shared dependency, IN-02); apply `:167` (own install), `:187` (dependency), `:213` (shared dependency, IN-02) |
| 4 | SC-3 / MIM-04: the import enable outcome carries each companion fact once | VERIFIED | `execute.ts:157` types `enableSignals` as `Omit<EnableDegradationSignals, "stagedAgents" \| "stagedMcpServers" \| "stagedWorkflows">`, so the staged facts live only in the required `declares*` members. `execute.ts:1249` `enableDegradation` copies only `unsupported`, `orphanRewake`, `degradedKinds`. `installedRow` rebuilds the staged inputs from `declares*`. Unit tests: `execute.test.ts` IMP-05 case now expects `enableSignals: {}` with `declares*` true and an unchanged row, and the new IMP-10 degraded-kind case. Not user-visible, so no scenario is required; the existing enable scenarios still pass |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Plan must-haves (merged)

Every PLAN truth in 06-01..06-06 maps to the rows above or to these checks:

- 06-01 harness (D-PL6-07, D-PL6-14): the step "the published plugin {string} of the marketplace {string} has a read-only skill directory" (`publishing.steps.ts`) asserts mode 0555 and an EACCES `unlink` before it records the token, and registers a write restore on release. `field-rows.ts` projects the JSON cell through `projectTokens`. `run-tokens.ts` matches the path-cut form (IN-05). The verifier runs as uid 1000, so the undo really fails.
- 06-02: the orchestrated install with a dependency partial carries `rollbackPartials` (`install-flow.test.ts:5405`), and a cascade with no partial carries none (`:5434`). The orchestrated enable carries them (`enable-disable.test.ts:3633`).
- 06-05: apply redaction (`apply.test.ts:2425,2487`), a single dependency row (`:2550`), and the row projection (`notify.test.ts:1736`).
- 06-06: `npm run check` passes (see below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `orchestrators/import/marketplaces.ts` | plan every extra entry, `settingsMarketplaces` | VERIFIED | `planMarketplaceSources`, `settingsMarketplaces` at :167; consumed by `readPassForImport` |
| `orchestrators/import/execute.ts` | alias, claims, conflicts, rollback rows, enable signals | VERIFIED | Functions cited above, all called from `executeScopedPlan` / `buildImportNotificationMarketplaces` |
| `orchestrators/reconcile/plan.ts` | pure claim exports | VERIFIED | `marketplaceSourceClaims` :269, `marketplaceClaimConflicts` :280; both imported by `execute.ts` |
| `orchestrators/plugin/install-flow.ts` | orchestrated cascade failure carries the member's partials | VERIFIED | `memberPartials` :1835 spread into the orchestrated return of `handleCascadeThrow` |
| `orchestrators/plugin/enable-disable.ts` | failed enable outcome carries partials | VERIFIED | :2934 |
| `orchestrators/reconcile/apply.ts`, `apply-outcomes.ts`, `notify.ts` | apply failed-install row with phases | VERIFIED | `installFailedOutcomes` replaces the inline push in `applyPluginInstalls`; `failedRowRollback` spread into the failed row |
| `features/plugin/{import,apply,install-rollback}.feature` | scenarios for MIM-01..03 | VERIFIED | 9 import, 3 apply, and 1 install scenario added |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `execute.ts::readPassForImport` | `plan.ts::buildMarketplaceClaims` | `marketplaceSourceClaims`, `marketplaceClaimConflicts` | WIRED |
| `execute.ts::executeScopedPlan` | ensure, install, post-pass | `aliasedScopePlan(scopePlan, read.claims)` passed to all three, plus `read.configNames` to the post-pass | WIRED |
| `install-flow.ts::handleCascadeThrow` | `execute.ts::dispatchFailedOutcome` | `outcome.rollbackPartials` → `partialMember` → `failedDependency` | WIRED |
| `enable-disable.ts::outcomeToTypedResult` | `execute.ts::enableOnePlannedPlugin` | `outcome.rollbackPartials ?? []` | WIRED |
| `apply.ts::installFailedOutcomes` | `notify.ts::applyPluginOutcomeToBlock` | `rollbackPartials` → `failedRowRollback` → `PluginFailedMessage.rollbackPartial` → `notification-grammar.ts::composeFailureLines` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| The new scenarios fail without the phase's source change | Base source `git archive d98660a7` with the HEAD `features/` tree, in a scratch directory; `cucumber-js` on the 13 new scenarios | 13 scenarios: 12 failed (all 9 import and all 3 apply scenarios), 1 passed (the install-rollback reference scenario, which pins install's detail from before the phase, as intended) | PASS |
| The full gate passes at HEAD | `npm run check` (once, unpiped to a log file) | exit 0: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features, unpaired, integration, 914/914 cucumber scenarios (9139 steps), direct coverage merged (291 records) | PASS |

### Probe Execution

None. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MIM-01 | 06-03 | settings marketplace recorded under another name, as Claude Code does | SATISFIED (parity question open) | Truth 2; Human Verification 1 and 2 |
| MIM-02 | 06-03 | add every `extraKnownMarketplaces` entry, referenced or not | SATISFIED | Truth 1 |
| MIM-03 | 06-01, 06-02, 06-04, 06-05 | import and apply report partial rollback with install's detail | SATISFIED | Truth 3 |
| MIM-04 | 06-06 | import enable outcome carries companion facts once | SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps only MIM-01..04 to Phase 6, and the plans claim all four. REQUIREMENTS.md still shows them as `Pending`, which is the orchestrator's update to make.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all changed files) | - | TBD / FIXME / XXX | none found | - |
| `orchestrators/import/execute.ts` | `recordPlannedMismatch` | IN-01 (left by the operator): an unreferenced source mismatch reads `(failed)` with no `{source mismatch}` brace and counts two failures. Visible in `import.feature:781` (`tally failures 4` for two marketplaces) | Info | Cosmetic tally; deliberately skipped |
| `orchestrators/reconcile/apply.ts` | `installFailedOutcomes` | IN-03 (left): the dependency row follows the requested row | Info | Ordering only |
| `orchestrators/import/execute.ts` | `enableDegradation` | IN-04 (left): it restates part of `degradationFromEnable` | Info | A new degradation fact could be missed in one copy |

`CHANGELOG.md` is not changed on this branch. 06-06-SUMMARY hands the CHANGELOG line to the parent session, so this is not a phase gap.

### Human Verification Required

#### 1. D-PL6-02 alias against Claude Code's plugin outcome

**Test:** Read uncertain choice 1 in `06-06-SUMMARY.md` / `06-CONTEXT.md`, and the scenario at `features/plugin/import.feature:670`.
**Expected:** Accept the alias (`demo@other` installs as `demo@fixtures`, and the config declares `fixtures`), or ask for Claude Code's outcome, `marketplace-not-found` for `demo@other`.
**Why human:** MIM-01 and SC-1 ask for Claude Code's outcome. The marketplace half matches E2. The plugin half diverges. The divergence has a decision ID, but the phase asks the user to review it, and no record shows that review.

#### 2. WR-01 arm fails where Claude Code would reuse

**Test:** Read the scenario at `features/plugin/import.feature:752`.
**Expected:** Confirm that `other (failed)` with `Marketplace "fixtures" already exists in user scope.` is the wanted outcome when the settings also declare the recorded name.
**Why human:** Claude Code's add returns the recorded name without error (E2). This arm came from review fix WR-01, after the decisions, and no decision row covers its user-visible failure.

### Gaps Summary

No gaps. All four requirements and all three success criteria are met in code, wired end to end, and proved by scenarios that fail on the base source and pass at HEAD. `npm run check` exits 0. Two parity choices wait for the operator's review.

---

_Verified: 2026-10-27T06:11:29Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 09-reload-installs-missing-dependencies
verified: 2026-09-24T17:02:30Z
status: passed
score: 12/12 must-haves verified
covered_files: [".planning/BACKLOG.md", ".planning/phases/09-reload-installs-missing-dependencies/09-01-PLAN.md", ".planning/phases/09-reload-installs-missing-dependencies/09-01-SUMMARY.md", ".planning/phases/09-reload-installs-missing-dependencies/09-02-PLAN.md", ".planning/phases/09-reload-installs-missing-dependencies/09-02-SUMMARY.md", ".planning/phases/09-reload-installs-missing-dependencies/09-03-PLAN.md", ".planning/phases/09-reload-installs-missing-dependencies/09-03-SUMMARY.md", ".planning/phases/09-reload-installs-missing-dependencies/09-04-PLAN.md", ".planning/phases/09-reload-installs-missing-dependencies/09-04-SUMMARY.md", ".planning/phases/09-reload-installs-missing-dependencies/09-REVIEW-FIX.md", ".planning/phases/09-reload-installs-missing-dependencies/09-REVIEW.md", "CHANGELOG.md", "docs/dependency-resolution.md", "docs/output-catalog.md", "docs/plugin-enablement.md", "extensions/pi-claude-marketplace/index.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts", "extensions/pi-claude-marketplace/orchestrators/reconcile/README.md", "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts", "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts", "extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts", "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts", "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts", "extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts", "extensions/pi-claude-marketplace/shared/notification-types.ts", "extensions/pi-claude-marketplace/shared/notify-reasons.ts", "scripts/check-unused-type-members.contracts.json", "tests/architecture/catalog-uat/catalog-contract.test.ts", "tests/architecture/catalog-uat/catalog-parser.test.ts", "tests/architecture/catalog-uat/fixtures/reconcile-applied.ts", "tests/architecture/compat-01-no-expansion.test.ts", "tests/architecture/notify-closed-set-locks.test.ts", "tests/architecture/notify-stamp-coverage.test.ts", "tests/index.test.ts", "tests/integration/reconcile-plan-convergence.test.ts", "tests/orchestrators/plugin/install-cascade.test.ts", "tests/orchestrators/plugin/install-flow.test.ts", "tests/orchestrators/plugin/install-outcome.test.ts", "tests/orchestrators/plugin/operations.test.ts", "tests/orchestrators/reconcile/apply.test.ts", "tests/orchestrators/reconcile/dependency-verdict.test.ts", "tests/orchestrators/reconcile/notify.test.ts", "tests/orchestrators/reconcile/plan.test.ts", "tests/orchestrators/reconcile/types.test.ts", "tests/shared/notification-types.test.ts"]
covered_digest: "v1:sha256:0aa59ed6d2ba7d51788806b2405563900a9981241c22247de63d8857b63a945e"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 9: Reload installs missing declared dependencies Verification Report

**Phase Goal:** A desired plugin implies its dependencies. A reload that finds an installed plugin missing a declared dependency installs it, the way `install` would have, instead of leaving the dependent to be disabled.
**Verified:** 2026-09-22T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ROADMAP SC1: on `/reload`, every declared dependency of an installed plugin missing in scope is installed through the install cascade with provenance `dependency`, from the marketplace the declaration resolves to; a not-added marketplace is never auto-added | ✓ VERIFIED | `apply.test.ts` `MISS-01: a reload installs a missing declared dependency and the dependent stays up` and `MISS-02 / D-03-08: a dependency whose marketplace is not added fails with the cause naming the marketplace` both pass (ran live, `apply.test.ts` 88/88 green); `install-flow.ts:2098-2122` threads `rootRanges: opts.ranges`, `treatDisabledAsWall: true`, and stamps `provenance: "dependency"` unconditionally |
| 2 | ROADMAP SC2: when the dependency cannot be installed, the reload completes, the failure is reported on its own row with its cause, the dependent is disabled by Phase 6's check with the install remedy, nothing is half-materialized | ✓ VERIFIED | `apply.test.ts` `MISS-02: a dependency whose closure fails reports on its own row and the dependent is held down` passes; `docs/output-catalog.md`'s `reconcile-dependency-install-failed` fenced bytes are byte-matched against the fixture by `catalog-contract.test.ts` (222/222 states, ran live, green) |
| 3 | ROADMAP SC3: a reload with nothing missing installs nothing and stays offline; the new bucket is exercised by `reconcile-plan-convergence.test.ts` | ✓ VERIFIED | `apply.test.ts` `NFR-5: a reload with nothing missing installs nothing and reads the scope once` passes; `reconcile-plan-convergence.test.ts` `D-09-16` (fixpoint) and `D-09-14` (named retry) both pass (ran live, 6/6 green) |
| 4 | D-09-01/02/05/06: the planner's ninth bucket dedupes per dependency key, carries raw declarer ranges + `requiredBy`, sorted by key, and excludes every ineligible dependent arm | ✓ VERIFIED | `plan.test.ts` (129/129 pass, ran live) including `MISS-01: buckets a missing declared dependency once...`, `...two declarers...fold into one bucket entry`, `...bucket entries sort by dependency key`; `buildDependencyInstallBucket` present at `plan.ts:771` |
| 5 | D-09-08: a marker-held `provenance: "dependency"` record recovers without a config entry, never overturning a user's own disable or a config-declared disable | ✓ VERIFIED | `plan.test.ts` D-09-08 cases pass; `buildDependencyDisabledLift` at `plan.ts:858` |
| 6 | D-09-05: the install cascade's root is pinned by every declarer's range through the same fold site a constrained member uses; a fold failure fails the cascade clean | ✓ VERIFIED | `install-cascade.test.ts` D-09-05 cases pass (ran live, part of 129/129 combined run); `effectiveRanges` at `install-cascade.ts:728` |
| 7 | D-09-04: a disabled dependency is a wall on the reload path — left alone, never re-enabled, RESV-05 still checked | ✓ VERIFIED | `install-cascade.test.ts` D-09-04 cases and `apply.test.ts` `D-09-04: a disabled recorded dependency is left alone by the reload` pass |
| 8 | D-09-07/D-09-08: a dependent the install satisfied (config-declared or marker-held) comes back up in the SAME reload via the toggle re-plan | ✓ VERIFIED | `apply.test.ts` `D-09-07: a marker-held dependent comes back up in the same reload` and `D-09-08: a provenance-independent dependent comes back up in the same reload` pass |
| 9 | D-09-09: `dependency installed` is the 61st closed-set reason, landed on every pinning surface, no cause line | ✓ VERIFIED | `notification-types.ts:177` tail member; `notify-closed-set-locks.test.ts` `OUT-08: Reason is the closed 61-entry reason set` passes |
| 10 | D-09-13: only an explicit `/reload` runs the install step; startup/omitted reason plans the bucket but installs nothing | ✓ VERIFIED | `apply.test.ts` `D-09-13: a startup reconcile plans the bucket but installs nothing and stays offline` passes; `apply.ts:687` gates on `opts.reason !== "reload"`; `tests/index.test.ts` `MISS-01 / D-09-13: a reload event installs a missing dependency that a startup event left alone` drives the real `resources_discover` handler end to end and passes |
| 11 | D-09-14: a failed dependency install is retried on every `/reload`; the dependent's row is silent once already down | ✓ VERIFIED | `apply.test.ts` `D-09-14: a failed dependency install is retried on the next reload and the dependent's row is silent once down` passes |
| 12 | Requirements traceability: MISS-01 and MISS-02 are Complete in REQUIREMENTS.md with no orphaned requirement IDs for Phase 9 | ✓ VERIFIED | `REQUIREMENTS.md:284-285` both `Complete`; all four plans' `requirements:` frontmatter fields account for both IDs |

**Score:** 12/12 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `orchestrators/reconcile/dependency-verdict.ts` | `UnsatisfiedDeclaration.ranges` on the missing arm | ✓ VERIFIED | present, populated from `constraintsByKey` |
| `orchestrators/reconcile/types.ts` | `PlannedDependencyInstall`, ninth bucket, `emptyReconcilePlan` default | ✓ VERIFIED | `types.ts:290,308`; `ApplyReconcileOptions.reason` at `:385` |
| `orchestrators/reconcile/plan.ts` | `buildDependencyInstallBucket`, `buildDependencyDisabledLift` | ✓ VERIFIED | `plan.ts:771,858`; purity gate (`reconcile-planner-purity.test.ts`) green |
| `orchestrators/reconcile/notify.ts` | will-install fold, emptiness count, `{dependency installed}` projection | ✓ VERIFIED | confirmed via passing `notify.test.ts` D-09-09/D-09-12 cases (part of full-suite evidence) |
| `orchestrators/plugin/install-cascade.ts` | `rootRanges`, `treatDisabledAsWall`, `effectiveRanges` | ✓ VERIFIED | `install-cascade.ts:319,443,460,728` |
| `orchestrators/plugin/install-flow.ts` | `createInstallMissingDependency`, orchestrated-only entry point | ✓ VERIFIED | `install-flow.ts:2205`; no config write, no promotion arm (per 09-03-SUMMARY and code read) |
| `orchestrators/plugin/operations.ts` | `createDependencyInstallOperation` | ✓ VERIFIED | `operations.ts:99` |
| `orchestrators/reconcile/apply.ts` | `applyDependencyInstalls`, `refreshTogglePlan`, `applyToggleSteps` | ✓ VERIFIED | `apply.ts:682,782,1110`, wired in `applyPlan` at `:1195-1197` |
| `extensions/pi-claude-marketplace/index.ts` | `reason: event.reason` thread | ✓ VERIFIED | `index.ts:126` |
| `docs/output-catalog.md` | `reconcile-dependency-installed`, `reconcile-dependency-install-failed` states | ✓ VERIFIED | anchors at `:2803,:2817`; byte-matched by `catalog-contract.test.ts` (222 states) |
| `.planning/BACKLOG.md` | `MISS-MPADD-01`, `RECON-REPLAN-01` | ✓ VERIFIED | headings present at `:3243,:3256` |
| `docs/dependency-resolution.md`, `docs/plugin-enablement.md`, `CHANGELOG.md` | reload paragraphs | ✓ VERIFIED | grep-confirmed content present in all three |
| `scripts/check-unused-type-members.contracts.json` | pins remapped | ✓ VERIFIED | `npm run lint:type-members` exits 0 with only 5 pre-existing, unrelated exceptions |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `plan.ts::buildDependencyInstallBucket` | `dependency-verdict.ts` | filters `verdict.unsatisfied` to `kind === "missing"` | ✓ WIRED |
| `plan.ts::planReconcile` | `types.ts::ReconcilePlan` | returns `pluginsToDependencyInstall` at bucket position nine | ✓ WIRED |
| `notify.ts::installedRowFromOutcome` | `apply-outcomes.ts::PluginInstalledOutcome.dependencyInstalled` | reads flag, pushes token | ✓ WIRED |
| `index.ts` | `apply.ts::applyReconcile` | `reason: event.reason` | ✓ WIRED |
| `apply.ts::applyDependencyInstalls` | `operations.ts::createDependencyInstallOperation` | composed once, called per bucket entry | ✓ WIRED |
| `operations.ts::createDependencyInstallOperation` | `install-flow.ts::createInstallMissingDependency` | binds `INSTALL_TRANSACTION` | ✓ WIRED |
| `install-flow.ts` | `install-cascade.ts::runInstallCascade` | `rootRanges: opts.ranges, treatDisabledAsWall: true` | ✓ WIRED |
| `apply.ts::applyPlan` | `apply.ts::refreshTogglePlan` | re-runs `readPassForScope`, substitutes only the three toggle buckets | ✓ WIRED |

### Behavioral Spot-Checks / Live Test Runs

Full targeted suites were run live during this verification (not re-derived from SUMMARY claims):

| Suite | Result | Status |
|-------|--------|--------|
| `tests/integration/reconcile-plan-convergence.test.ts` | 6/6 pass, including `D-09-16` and `D-09-14` | ✓ PASS |
| `tests/orchestrators/reconcile/apply.test.ts` | 88/88 pass | ✓ PASS |
| `tests/orchestrators/plugin/install-cascade.test.ts` + `tests/orchestrators/reconcile/plan.test.ts` | 129/129 pass (combined run) | ✓ PASS |
| `tests/orchestrators/plugin/install-flow.test.ts` | 179/179 pass | ✓ PASS |
| `tests/index.test.ts` | 21/21 pass, including `D-09-13` and `MISS-01 / D-09-13` | ✓ PASS |
| `tests/architecture/no-orchestrator-network.test.ts` + `reconcile-planner-purity` + `notify-closed-set-locks` + `catalog-uat/catalog-parser` | 25/25 pass | ✓ PASS |
| `tests/architecture/catalog-uat/catalog-contract.test.ts` | 4/4 pass, 222/222 documented states byte-matched | ✓ PASS |
| `npm run lint:type-members` | exit 0, 5 pre-existing unrelated exceptions only | ✓ PASS |

Not independently re-run in this verification session (accepted as evidence per task instructions): full `npm test` (7489/7489) and `npm run test:integration` (38/38) as reported by the orchestrator's regression gate on the final tree; `npm run typecheck`, `npm run lint`, `npm run lint:type-members` reported green on the final tree. The `lint:type-members` claim was independently re-run above and confirmed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MISS-01 | 09-01, 09-02, 09-03, 09-04 | Reload installs every declared dependency of an installed plugin not yet installed, through the install cascade, with provenance `dependency` | ✓ SATISFIED | `REQUIREMENTS.md:181-183,284` Complete; live test evidence above |
| MISS-02 | 09-01, 09-03, 09-04 | When such a dependency cannot be installed, reload completes, failure reported on its own row, dependent handled by LOAD-01 | ✓ SATISFIED | `REQUIREMENTS.md:184-186,285` Complete; live test evidence above |

No orphaned requirements: `grep -E "Phase 9"` in REQUIREMENTS.md yields only MISS-01/MISS-02, and both appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

`grep -n -E "TBD|FIXME|XXX"` and `grep -n -E "TODO|HACK|PLACEHOLDER"` over the 13 core production files this phase modified returned zero matches. No debt markers found.

Code review (`09-REVIEW.md`, iteration 3/final): 0 Critical, 0 Warning, 12 Info — all 12 Info items are recorded and explicitly left open by the reviewer's own ruling (either pre-existing/out-of-scope duplication residue, wording nits, or test-quality suggestions), none of which contradicts a must-have truth or roadmap success criterion. Two review-fix rounds (`d2ad4161`, `f9172700`, `3a2b8f5f`, `9ad0d9a3`) closed all Critical/Warning findings from iterations 1-2 before the phase converged clean.

### Human Verification Required

None. Every must-have truth, including the state-transition/ordering truths (D-09-07 re-plan, D-09-08 lift, D-09-14 retry, D-09-16 convergence fixpoint), is backed by a passing named test exercising the actual transition, run live during this verification session rather than inferred from SUMMARY claims. The `resources_discover` event path (the one truth that could only be confirmed by a live Pi `/reload`) is exercised end-to-end through `tests/index.test.ts`'s real discover-event listener against a hermetic scope, which is the closest automatable proxy to a live reload and was run live and confirmed passing.

### Gaps Summary

None. All 12 must-haves derived from ROADMAP success criteria, PLAN frontmatter must_haves, and CONTEXT.md decisions (D-09-01 through D-09-16) are verified against the current working tree at commit `bc89db9a`, not against SUMMARY claims alone — every load-bearing test cited above was re-run in this session and confirmed green.

---

*Verified: 2026-09-22T18:00:00Z*
*Verifier: Claude (gsd-verifier)*

## Current-tree re-verification (2026-09-24)

The reload install, convergence, and catalog tests still pass. The `dependency installed` reason remains present without a cause line. Later update and allowlist work expanded the closed reason set from the historical 61 members to 62; the current closed-set tests pass.

The current milestone run passed 7,760 unit tests and all 15 integration files. `npm run typecheck`, `npm run lint:type-members`, and the network, notification, and planner architecture tests also passed. The historical truth table and line numbers above record the original verification run. The full `npm run check` still stops on formatting in the operator-owned `.planning/config.json`. No implementation change was needed for this re-verification.

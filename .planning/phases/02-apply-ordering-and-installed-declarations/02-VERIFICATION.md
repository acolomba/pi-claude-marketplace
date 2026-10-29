---
phase: 02-apply-ordering-and-installed-declarations
verified: 2026-10-29T12:34:41Z
status: passed
score: 19/19 must-haves verified
covered_files:
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-01-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-01-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-02-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-02-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-03-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-03-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-04-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-04-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-05-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-05-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-06-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-06-SUMMARY.md
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/transaction/with-state-guard.ts
  - features/marketplace/add.feature
  - features/plugin/apply.feature
  - features/plugin/bootstrap.feature
  - features/plugin/enable.feature
  - features/plugin/import.feature
  - features/plugin/state-lock.feature
  - features/plugin/update-dependencies.feature
  - test/architecture/soft-dep-marker-policy.test.ts
  - test/e2e/import-command.test.ts
  - test/edge/handlers/marketplace/add.test.ts
  - test/edge/handlers/marketplace/update.test.ts
  - test/edge/handlers/plugin/bootstrap.test.ts
  - test/edge/register.test.ts
  - test/edge/types.test.ts
  - test/index.test.ts
  - test/integration/reserved-record-keys.test.ts
  - test/integration/standalone-prune.test.ts
  - test/orchestrators/marketplace/add.messaging.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/bootstrap.test.ts
  - test/orchestrators/plugin/dependency-declaration-read.test.ts
  - test/orchestrators/plugin/dependency-index.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - test/orchestrators/reconcile/dependency-verdict.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/pending.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - test/orchestrators/reconcile/types.test.ts
  - test/orchestrators/types.test.ts
covered_digest: "v4:sha256:9d1a185ebd550d71ff9a52687669684252dfbd8df55d436c389447d85e844867"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 19/19
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 2: Apply Ordering and Installed Declarations Verification Report

**Phase Goal:** `pending` previews exactly what `apply` does, one `apply` settles a missing dependency that needs a moved version, and dependency declarations of an installed plugin come from its installed copy.
**Verified:** 2026-10-29T12:34:41Z
**Status:** passed
**Re-verification:** Yes. The prior report passed on an earlier integrated tree; this run rechecked all truths after the final Phase 1-10 merge.

## Goal Achievement

### Roadmap Success Criteria

| # | Observable truth | Status | Code and behavioral evidence |
|---|---|---|---|
| 1 | PENDMOVE-01 and MISSORDER-01: pending/apply row parity and empty second apply | VERIFIED | `pending.ts` and `apply.ts` share the convergence deferral and after-install order. `apply.feature:1508,1562` asserts exact row order and settled records; the named D-PL2-01 one-run and D-08 second-apply tests pass. |
| 2 | Config removal disables its dependent in the same apply | VERIFIED | `apply.feature:1074` asserts orphan uninstalled and keeper disabled with remedy. `apply.ts:2018` judges final state; the full Cucumber gate passed. |
| 3 | STALE-DECLARER-01 has a decision ID and matching code/tests | VERIFIED | D-PL2-05 in `02-CONTEXT.md:145`; first-unreadable returns in `dependency-index.ts:479,510` and `dependency-verdict.ts:600`; four walk tests pass. |
| 4 | Enable and update preflight read installed declarations | VERIFIED | `enable-disable.ts:679` calls `readInstalledRecordDeclarations`; `update-constraint-gate.ts:95` locks the installed-detail walk. `enable.feature:202` and `update-dependencies.feature:378` distinguish installed copy from changed catalog. |
| 5 | Add, bootstrap and autoupdate settle missing dependencies; refusal rows and containment match decisions | VERIFIED | `index.ts:105` composes one scope-install seam; add/bootstrap/update handlers forward it. `add.ts:1619` and `update.ts:821` select the marketplace. `dependency-declaration-read.ts:418-493` admits one owning root and bounds manifest reads. Scenarios and direct tests pass. |

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| RCN-01 | 02-01, 02-03 | SATISFIED | PENDMOVE-01 scenario, shared planner, second-apply test; interrupted-move retry test at `apply.test.ts:8888` now proves the backstop. |
| RCN-02 | 02-01, 02-03 | SATISFIED | MISSORDER-01 scenario and D-PL2-01 unit case; `operations.test.ts:358` proves real dependency-install lock failure and retry. |
| RCN-03 | 02-03 | SATISFIED | Keeper/orphan same-apply scenario; `enable-disable.test.ts:5050` proves the exact disable operation's lock failure and retry. |
| RCN-04 | 02-01, 02-02 | SATISFIED | D-PL2-05 and first-unreadable tests; `BACKLOG.md` now marks STALE-DECLARER-01 closed and `PROJECT.md` records D-PL2-05. |
| RCN-05 | 02-02 | SATISFIED | Installed-first reader, enable/update scenarios; `update-constraint-gate.ts:95` locks a possible holder walk and `update-constraint-gate.test.ts:959` proves held-lock refusal followed by installed-copy retry. |
| RCN-06 | 02-05, 02-06 | SATISFIED | Add/bootstrap/autoupdate seam wiring and behavioral scenarios; scope selection is preserved. |
| RCN-07 | 02-03, 02-05 | SATISFIED | D-PL2-11 first-refusal failed/disabled pair; D-09-14 silent already-down row; `apply.test.ts:10672` proves earlier MISS-01 cascade member rollback. |
| RCN-08 | 02-04 | SATISFIED | D-PL2-23 one-owner selection and D-PL2-17 manifest boundary, including contained-link acceptance and escape refusal tests. |

All eight RCN IDs occur in PLAN frontmatter and in `REQUIREMENTS.md`; none is orphaned.

### PLAN Backstops

| Truth | Status | Direct test and production link |
|---|---|---|
| RCN-01 interruption after moves, then retry (02-03-PLAN:38-39) | VERIFIED | `apply.test.ts:8888` checks committed moved version, absent dependency after injected read failure, then install on next apply without repeating the move. Named test passed. |
| RCN-02 held lock at MISS-01, then retry (02-03-PLAN:40-41) | VERIFIED | `operations.test.ts:358` invokes real `createDependencyInstallOperation` and checks typed held-lock failure, identical state bytes and successful retry. `apply.ts:835` constructs this exact operation for MISS-01. Named test passed. |
| RCN-03 held lock at final-judgement disable, then retry (02-03-PLAN:42-43) | VERIFIED | `enable-disable.test.ts:5050` invokes the orchestrated disable and checks lock-held outcome, unchanged state and successful retry. `apply.ts:1168-1180` constructs the same `createEnableOperation` with `enable: false`. Named test passed. |
| RCN-05 installed-copy read versus same-scope uninstall (02-02-PLAN:33-34) | VERIFIED | `update-constraint-gate.ts:95` uses `withExistingScopeLock` for every possible distinct holder; uninstall and clone GC use that lock. `update-constraint-gate.test.ts:959` proves held-lock refusal and retry from the installed copy; no-holder and requester tests prove the bypass cannot skip a possible holder. Named test passed. |
| RCN-07 refusal retries (02-03-PLAN:44-45) | VERIFIED under D-09-14 | `apply.test.ts:6554` proves the failure row recurs and the dependent stays disabled. D-09-14 supersedes the old PLAN phrase requiring a repeated disabled/remedy row after the dependent is already down. |
| RCN-07 cascade rollback on refusal (02-03-PLAN:46-47) | VERIFIED | `apply.test.ts:10672` forces a later MISS-01 member failure, then checks neither root nor earlier member has a record and the member's skill is absent. Named test passed. |

**Score:** 19/19 truths verified: five roadmap criteria, eight RCN requirements and six PLAN backstops. No behavior-dependent truth rests on symbol presence alone.

### Prohibition Resolution

The three PLAN frontmatter `status: flagged, verification: unverified` markers were execution-time audit markers. Each has a current, explicit verdict:

| Prohibition | Verdict | Enforcement evidence and contract |
|---|---|---|
| 02-03-PLAN:48-51: no successful apply leaves an enabled unsatisfied plugin | VERIFIED | `apply.ts:2018-2070` reads final state, calls `judgeFinalScope`, then `applyDependencyDisables`; keeper/orphan and post-cascade tests assert the disable. A held lock can explicitly fail that disable row; the documented RCN-03 retry restores the invariant. The prohibition applies after successful final judgement. |
| 02-03-PLAN:52-54: MISS-01 refusal has dependent disable/remedy row | VERIFIED | `apply.feature:1805` asserts the failed dependency and newly disabled dependent/remedy rows in order. D-PL2-11 governs this first refusal. `apply.test.ts:6554` proves D-09-14's accepted exception: a later refusal repeats the failed row while the already-down dependent has no new disable row. |
| 02-05-PLAN:49-52: no add/bootstrap/autoupdate dependency goes to another scope | VERIFIED | `request.scope` reaches `readPlainPlanForScope`; each selected operation retains `op.scope`, and its ledger uses `locationsFor(scope,cwd)`. Project add, user bootstrap and independent project/user update tests exercise the scope paths. |

These verdicts resolve the markers with code, tests and recorded decisions; the historical PLAN metadata is retained. No prohibition is silently counted as passed.

### Required Artifacts and Key Links

| Plan | Automated artifacts | Automated links | Final assessment |
|---|---|---|---|
| 02-01 | 4/4 | 3/3 | Substantive, imported and exercised |
| 02-02 | 5/5 | 1/2 literal patterns | Manual trace resolves the stale second pattern: `update-constraint-gate.ts:95` wraps `buildInstalledScopeDeclarationDetail` in `withExistingScopeLock`, retaining the installed-copy walk while adding the RCN-05 concurrency guarantee. |
| 02-03 | 4/4 | 2/2 | Substantive, imported and exercised |
| 02-04 | 0/3 literal patterns | 0/2 literal patterns | Manual trace verifies D-PL2-23 replaced `installedCopyOwnerRoot` with `installedCopyReadOptions`; `dependency-index.ts:411,447` and `convergence.ts:478` pass its single `ownerRoot` to `readInstalledCopyDeclaration`. D-PL2-17 superseded blanket symlink refusal. The stale checker patterns do not indicate stubs or missing wiring. |
| 02-05 | 7/7 | 3/3 | Substantive, imported and exercised |
| 02-06 | 5/5 | 2/2 | Substantive, imported and exercised |

**Data flow:** Config and state feed `planReconcile` in `pending.ts`; `withMarketplaceSourceRepairs` normalizes the pending and apply read passes. The post-move `readPlainPlanForScope` produces MISS-01 entries consumed by `applyDependencyInstalls`, then `dependencyInstallRows` renders outcomes. Installed manifest bytes pass through `readInstalledCopyDeclaration` and `readInstalledRecordDeclarations` into enable and update verdicts. The reported values are tied to real state or filesystem reads.

### Behavioral Spot Checks and Gate

| Check | Result |
|---|---|
| Focused RCN-01 interruption, RCN-07 retry, and RCN-07 rollback owner tests | 3/3 named invocations passed, exit 0 |
| Focused RCN-02 real install-lock, RCN-03 disable-lock, and RCN-05 installed-copy-lock owner tests | 3/3 named invocations passed, exit 0 |
| Public PENDMOVE/MISSORDER, installed-copy, add, bootstrap, and autoupdate scenarios | 7 scenarios, 113 steps, 16 hooks passed, exit 0 |
| Six concurrency/idempotency backstop owner invocations | 6/6 named tests passed: interrupted move retry, dependency-install lock retry, judgement-disable lock retry, refusal retry, cascade rollback, and installed-copy constraint lock retry. |
| Seven public Phase 2 scenarios rerun by this verifier | 7 scenarios, 112 steps and 16 hooks passed after the restricted sandbox's expected loopback refusal was rerun with loopback permission. |
| Exact integrated `npm run check` at executable head `be0de0c3` | Exit 0: static, integration and unpaired checks passed; Cucumber 1145 scenarios/11777 steps passed; direct coverage merged 309 LCOV records. `git diff --quiet be0de0c3 -- . ':(exclude,glob).planning/**/*.md'` exits 0 at this verification head. |

**Probe execution:** No Phase 02 PLAN or SUMMARY declares a probe script.

### Test Quality Audit

| Test scope | Linked requirements | Active evidence | Skipped | Circular | Assertion level | Verdict |
|---|---|---:|---:|---:|---|---|
| Reconcile apply/convergence/pending/read-pass/notify/verdict owners | RCN-01..04, RCN-07 | 1,387-owner batch plus six named backstops | 0 requirement-linked | 0 | Behavioral: exact rows, state bytes, retries, rollback and ordering | PASS |
| Installed declaration/index/enable/update-gate owners | RCN-04, RCN-05, RCN-08 | Fresh owner batch and installed-copy named lock test | 0 | 0 | Value + behavioral filesystem and lock assertions | PASS |
| Marketplace add/bootstrap/update owners and Cucumber | RCN-06, RCN-07 | Seven focused scenarios plus current exact full gate | 0 | 0 | Behavioral: scope, rows, ordering and persisted records | PASS |

**Disabled tests on requirements:** 0. **Circular oracle patterns:** 0; filesystem writes build independent hermetic inputs and expected fixtures rather than capturing system output. **Insufficient assertions:** 0.

### Anti-Patterns

The requirement tests assert exact rows, versions, persisted state, lock failure, retry and rollback effects. The new backstop tests use real production operation factories and temporary scope roots. No linked requirement relies only on a skipped test or a generated oracle. The conditional root-only `t.skip` in `apply.test.ts:2402` is not sole requirement proof. No unreferenced TBD/FIXME/XXX debt marker or stub was found in the modified implementation paths.

The old 02-04 pattern checks and old D-09-14 repeated-row sentence are superseded by recorded decisions. Nyquist is COMPLIANT 8/8 at `91b3fdd8`; security is SECURED at `9faa7074` with **19/19 threats closed** and zero open; the complete final-head review is CLEAN at `33eb4bf7` across 44 files with zero Critical, Warning, or Info findings. No requirement-linked test is disabled, no expected value is generated by the production function under test, and no unreferenced TBD/FIXME/XXX marker exists in the implementation scope.

### Decision Coverage

The current decision-coverage gate reports **26/26** trackable `02-CONTEXT.md` decisions honored by shipped artifacts. No translated decision vanished during execution.

### Advisory (New Scope, Unevidenced)

None. The final integrated review covered 44 files and is clean at zero Critical, Warning, and Info findings; no new-scope unevidenced concern arose in this re-verification.

### Human Verification Required

None. All six behavior-dependent PLAN backstops now have direct or compositional passing behavioral tests. The three previously flagged negative checks have explicit verified dispositions above.

### Gaps Summary

No observed implementation or evidence gap blocks the Phase 02 goal. Pending and apply share the relevant planning and ordering paths, one apply settles the moved-version missing dependency, and enable/update read installed declarations from the installed copy. The final source-repair, hosted-replacement and lock fixes are present in the current integrated tree.

---

_Verified: 2026-10-29T12:34:41Z_
_Verifier: Codex (gsd-verifier)_

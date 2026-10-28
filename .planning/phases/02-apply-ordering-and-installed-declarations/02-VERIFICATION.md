---
phase: 02-apply-ordering-and-installed-declarations
verified: 2026-10-28T17:40:00Z
status: passed
score: 19/19 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
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
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-REVIEW-FIX.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-REVIEW.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-SECURITY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-VALIDATION.md
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
covered_digest: "v4:sha256:6fc1b55376ace3726bc2cd54bda9a066d78b6ecdef163463f43f58f9514c1bf9"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 14/19
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Phase 2 BACKLOG entries are marked closed with their dispositions."
    addressed_in: "Phase 11"
    evidence: "Phase 11 SC4 / CLN-04 closes every milestone BACKLOG entry with its disposition."
  - truth: "D-PL2-11 and D-PL2-15 final PROJECT.md documentation is reconciled."
    addressed_in: "Phase 11"
    evidence: "Phase 11 SC3 / CLN-03 reconciles project decisions and shipped behavior."
---

# Phase 2: Apply Ordering and Installed Declarations Verification Report

**Phase Goal:** `pending` previews exactly what `apply` does, one `apply` settles a missing dependency that needs a moved version, and dependency declarations of an installed plugin come from its installed copy.
**Verified:** 2026-10-28T17:40:00Z
**Status:** passed
**Re-verification:** Yes. The previous report was `human_needed` because five PLAN backstops lacked direct evidence; current source and tests close them.

## Goal Achievement

### Roadmap Success Criteria

| # | Observable truth | Status | Code and behavioral evidence |
|---|---|---|---|
| 1 | PENDMOVE-01 and MISSORDER-01: pending/apply row parity and empty second apply | VERIFIED | `pending.ts` and `apply.ts` share the convergence deferral and after-install order. `apply.feature:1483,1537` asserts exact row order and settled records; the named D-PL2-01 one-run and D-08 second-apply tests pass. |
| 2 | Config removal disables its dependent in the same apply | VERIFIED | `apply.feature:1049` asserts orphan uninstalled and keeper disabled with remedy. `apply.ts:2018` judges final state; the full Cucumber gate passed. |
| 3 | STALE-DECLARER-01 has a decision ID and matching code/tests | VERIFIED | D-PL2-05 in `02-CONTEXT.md:145`; first-unreadable returns in `dependency-index.ts:479,510` and `dependency-verdict.ts:600`; four walk tests pass. |
| 4 | Enable and update preflight read installed declarations | VERIFIED | `enable-disable.ts:679` calls `readInstalledRecordDeclarations`; `update-constraint-gate.ts:95` locks the installed-detail walk. `enable.feature:202` and `update-dependencies.feature:329` distinguish installed copy from changed catalog. |
| 5 | Add, bootstrap and autoupdate settle missing dependencies; refusal rows and containment match decisions | VERIFIED | `index.ts:105` composes one scope-install seam; add/bootstrap/update handlers forward it. `add.ts:1619` and `update.ts:821` select the marketplace. `dependency-declaration-read.ts:418-493` admits one owning root and bounds manifest reads. Scenarios and direct tests pass. |

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| RCN-01 | 02-01, 02-03 | SATISFIED | PENDMOVE-01 scenario, shared planner, second-apply test; interrupted-move retry test at `apply.test.ts:8888` now proves the backstop. |
| RCN-02 | 02-01, 02-03 | SATISFIED | MISSORDER-01 scenario and D-PL2-01 unit case; `operations.test.ts:358` proves real dependency-install lock failure and retry. |
| RCN-03 | 02-03 | SATISFIED | Keeper/orphan same-apply scenario; `enable-disable.test.ts:5050` proves the exact disable operation's lock failure and retry. |
| RCN-04 | 02-01, 02-02 | SATISFIED | D-PL2-05 and first-unreadable tests; final BACKLOG mark is Phase 11's CLN-04 task. |
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
| 02-02 | 5/5 | 2/2 | Substantive, imported and exercised |
| 02-03 | 4/4 | 2/2 | Substantive, imported and exercised |
| 02-04 | 0/3 literal patterns | 0/2 literal patterns | Manual trace verifies D-PL2-23 replaced `installedCopyOwnerRoot` with `installedCopyReadOptions`; `dependency-index.ts:411,447` and `convergence.ts:478` pass its single `ownerRoot` to `readInstalledCopyDeclaration`. D-PL2-17 superseded blanket symlink refusal. The stale checker patterns do not indicate stubs or missing wiring. |
| 02-05 | 7/7 | 3/3 | Substantive, imported and exercised |
| 02-06 | 5/5 | 2/2 | Substantive, imported and exercised |

**Data flow:** Config and state feed `planReconcile` in `pending.ts`; `withMarketplaceSourceRepairs` normalizes the pending and apply read passes. The post-move `readPlainPlanForScope` produces MISS-01 entries consumed by `applyDependencyInstalls`, then `dependencyInstallRows` renders outcomes. Installed manifest bytes pass through `readInstalledCopyDeclaration` and `readInstalledRecordDeclarations` into enable and update verdicts. The reported values are tied to real state or filesystem reads.

### Behavioral Spot Checks and Gate

| Check | Result |
|---|---|
| Named RCN-01 interrupted-move retry | 1 pass, exit 0 |
| Named RCN-02 real dependency-install lock/retry | 1 pass, exit 0 |
| Named RCN-03 orchestrated disable lock/retry | 1 pass, exit 0 |
| Named RCN-05 installed-copy lock/retry | 1 pass, exit 0 |
| Named RCN-07 MISS-01 cascade rollback | 1 pass, exit 0 |
| Combined `npm run check` at implementation/test commit `9692623d`, Node v26.12.1 | Exit 0: static, integration and unpaired checks passed; Cucumber 1122 scenarios/11447 steps passed; direct coverage merged 309 LCOV records. `git diff 9692623d HEAD -- . ':(exclude,glob).planning/**/*.md'` is empty; the only dirty file before this report rewrite was this report. |

**Probe execution:** No Phase 02 PLAN or SUMMARY declares a probe script.

### Test Quality and Anti-Patterns

The requirement tests assert exact rows, versions, persisted state, lock failure, retry and rollback effects. The new backstop tests use real production operation factories and temporary scope roots. No linked requirement relies only on a skipped test or a generated oracle. The conditional root-only `t.skip` in `apply.test.ts:2402` is not sole requirement proof. No unreferenced TBD/FIXME/XXX debt marker or stub was found in the modified implementation paths.

The old 02-04 pattern checks and old D-09-14 repeated-row sentence are superseded by recorded decisions. The current decision-coverage query reports **26/26** CONTEXT decisions honored. Current `02-SECURITY.md` records **19/19 threats closed** and zero open. The clean `02-REVIEW.md` records zero Critical, Warning or Info findings.

### Deferred Items

Phase 11 SC4 carries the final BACKLOG closure marks; Phase 11 SC3 carries the final project decision/documentation reconciliation. Those later milestone records are informational and do not weaken any Phase 02 behavior.

### Human Verification Required

None. All six behavior-dependent PLAN backstops now have direct or compositional passing behavioral tests. The three previously flagged negative checks have explicit verified dispositions above.

### Gaps Summary

No observed implementation or evidence gap blocks the Phase 02 goal. Pending and apply share the relevant planning and ordering paths, one apply settles the moved-version missing dependency, and enable/update read installed declarations from the installed copy. The final source-repair, hosted-replacement and lock fixes are present in the current integrated tree.

---

_Verified: 2026-10-28T17:40:00Z_
_Verifier: Codex (gsd-verifier)_

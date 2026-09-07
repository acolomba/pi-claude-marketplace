---
phase: "05"
slug: "injection-and-ownership-design"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-07"
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property                      | Value                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| **Framework**                 | Node built-in `node:test` with `node:assert/strict` on Node `v26.8.1` |
| **Config file**               | No runner config; scripts live in `package.json`                      |
| **Quick run command**         | `node --test <owning-test-path>`                                      |
| **Direct coverage**           | `npm run test:coverage:direct -- <changed-source.ts>`                 |
| **Type/style gates**          | `npm run typecheck`; focused `npx eslint ... --max-warnings=0`        |
| **Full suite command**        | `npm run check`                                                       |
| **Estimated focused runtime** | Less than 30 seconds per owner group                                  |

## Sampling Rate

- **After every task:** run the task's focused owner suites and direct-pair coverage for each changed production source.
- **After every wave:** run all affected hooks, completion-cache, completion-reader, and mutation-invalidator owner suites plus `npm run typecheck`.
- **Before `$gsd-verify-work`:** run the static removal/authorization censuses and `npm run check`.
- **Max feedback latency:** 30 seconds for task-local owner tests; the full repository gate runs only at phase close.

## Per-Task Verification Map

These rows map every finalized execution task to its focused automated verification and explicit failing direction.

| Task ID  | Plan  | Wave | Requirement(s)            | Threat Ref                                           | Secure Behavior                                                                                                                         | Test Type                                            | Automated Command                   | File Exists | Status     |
| -------- | ----- | ---: | ------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- | ----------- | ---------- |
| 05-01-01 | 05-01 |    1 | TREF-04                   | T-05-01, T-05-03, T-05-04, T-05-05                   | Required removal port preserves containment, symlink refusal, ordered effects, exact errors, and real-tree evidence.                    | Tracer + unit + integration + direct-pair            | Task 1 verify command in Plan 05-01 | ✅          | ⬜ pending |
| 05-01-02 | 05-01 |    1 | TREF-04                   | T-05-02, T-05-03, T-05-04, T-05-05                   | Narrow path inspector cannot bypass lexical containment and preserves ordered real symlink checks and typed failures.                   | Unit + security + direct-pair                        | Task 2 verify command in Plan 05-01 | ✅          | ⬜ pending |
| 05-02-01 | 05-02 |    2 | TREF-04                   | T-05-06, T-05-10, T-05-11                            | One required hydration reader serves all lifecycle paths while cache replacement, ordering, diagnostics, and stale guards stay exact.   | Unit + integration + direct-pair                     | Task 1 verify command in Plan 05-02 | ✅          | ⬜ pending |
| 05-02-02 | 05-02 |    2 | TREF-04                   | T-05-07, T-05-10, T-05-11                            | Hooks staging uses a four-operation inspector while containment, no-follow traversal, diagnostics, and real writes remain intact.       | Unit + security + direct-pair                        | Task 2 verify command in Plan 05-02 | ✅          | ⬜ pending |
| 05-02-03 | 05-02 |    2 | TREF-04                   | T-05-08, T-05-09, T-05-10, T-05-11                   | Separate fetch and info capabilities preserve fresh post-materialization status, contained reads, exact reasons, and notifications.     | Unit + integration + direct-pair                     | Task 3 verify command in Plan 05-02 | ✅          | ⬜ pending |
| 05-03-01 | 05-03 |    2 | TREF-04                   | T-05-11, T-05-14, T-05-15, T-05-16                   | A required state reader reproduces the reconcile race without replacing real children, locks, persistence, or public composition.       | Unit + composition + direct-pair                     | Task 1 verify command in Plan 05-03 | ✅          | ⬜ pending |
| 05-03-02 | 05-03 |    2 | TREF-04                   | T-05-12, T-05-13, T-05-14, T-05-16                   | Separate transaction ports preserve validation, commit, compensation, rollback, error identity, state, trees, and notifications.        | Unit + transaction + direct-pair                     | Task 2 verify command in Plan 05-03 | ✅          | ⬜ pending |
| 05-03-03 | 05-03 |    2 | TREF-04                   | T-05-12, T-05-13, T-05-14, T-05-15, T-05-16, T-05-17 | Reinstall and uninstall remain separate cohesive transactions with exact rollback, cleanup, containment, and composition evidence.      | Unit + transaction + composition                     | Task 3 verify command in Plan 05-03 | ✅          | ⬜ pending |
| 05-04-01 | 05-04 |    3 | TREF-05, TREF-06          | T-05-18, T-05-19, T-05-22                            | One private HooksRuntime owns registration and hydration state; fresh instances isolate state and stale callbacks become inert.         | Tracer + unit + architecture + lifecycle             | Task 1 verify command in Plan 05-04 | ✅          | ⬜ pending |
| 05-04-02 | 05-04 |    3 | TREF-05, TREF-06          | T-05-18, T-05-19, T-05-20, T-05-22                   | Dispatch, pending context, and settle state stay runtime-bound with post-await stale guards and exact reducer behavior.                 | Unit + integration + direct-pair                     | Task 2 verify command in Plan 05-04 | ✅          | ⬜ pending |
| 05-04-03 | 05-04 |    3 | TREF-05, TREF-06          | T-05-18, T-05-19, T-05-21, T-05-22, T-05-23          | Async children and PID serialization stay instance-owned while marker checks, conservative signaling, and messages remain exact.        | Unit + architecture + integration + static           | Task 3 verify command in Plan 05-04 | ✅          | ⬜ pending |
| 05-05-01 | 05-05 |    4 | TREF-04, TREF-05, TREF-06 | T-05-24, T-05-25, T-05-26, T-05-27                   | The registered runtime reaches install and reconcile mutations without changing hydration, transaction, routing, or notification order. | Tracer + unit + integration + direct-pair            | Task 1 verify command in Plan 05-05 | ✅          | ⬜ pending |
| 05-05-02 | 05-05 |    4 | TREF-04, TREF-05, TREF-06 | T-05-24, T-05-26, T-05-27                            | Enable, disable, uninstall, import, and reconcile mutate only the lifecycle runtime at existing commit and rollback boundaries.         | Unit + architecture + integration + direct-pair      | Task 2 verify command in Plan 05-05 | ✅          | ⬜ pending |
| 05-05-03 | 05-05 |    4 | TREF-04, TREF-05, TREF-06 | T-05-24, T-05-26, T-05-27, T-05-28, T-05-29          | Update, reinstall, and backfill retain one runtime plus exact transaction, bootstrap, PID-safety, and Phase 6 boundaries.               | Unit + architecture + integration + repository       | Task 3 verify command in Plan 05-05 | ✅          | ⬜ pending |
| 05-06-01 | 05-06 |    2 | TREF-05, TREF-06          | T-05-30, T-05-31, T-05-32, T-05-34                   | One factory-owned cache serves registered reads and transition invalidators; separate instances cannot share completion rows.           | Tracer + unit + integration + direct-pair            | Task 1 verify command in Plan 05-06 | ✅          | ⬜ pending |
| 05-06-02 | 05-06 |    2 | TREF-05, TREF-06          | T-05-30, T-05-31, T-05-32, T-05-33, T-05-34          | Every completion mode preserves schema, TTL, poison, thrown-error, filtering, ordering, and fresh-instance isolation contracts.         | Unit + architecture + static + direct-pair           | Task 2 verify command in Plan 05-06 | ✅          | ⬜ pending |
| 05-06-03 | 05-06 |    2 | TREF-05, TREF-06          | T-05-31, T-05-33, T-05-35                            | Dead names memory is removed only after a zero-consumer census while authoritative scoped reads and schema-2 invalidation remain.       | Unit + static census + direct-pair                   | Task 3 verify command in Plan 05-06 | ✅          | ⬜ pending |
| 05-07-01 | 05-07 |    3 | TREF-04, TREF-05          | T-05-36, T-05-37, T-05-38, T-05-39, T-05-41          | Marketplace add invalidates the completion reader's cache only after commit and preserves exact state, files, failures, and notices.    | Tracer + unit + integration + direct-pair            | Task 1 verify command in Plan 05-07 | ✅          | ⬜ pending |
| 05-07-02 | 05-07 |    3 | TREF-04, TREF-05          | T-05-36, T-05-37, T-05-38, T-05-39, T-05-41          | Marketplace remove invalidates only committed targets before hygiene while full, partial, no-effect, and failure behavior stays exact.  | Unit + architecture + integration + direct-pair      | Task 2 verify command in Plan 05-07 | ✅          | ⬜ pending |
| 05-07-03 | 05-07 |    3 | TREF-04, TREF-05          | T-05-36, T-05-37, T-05-38, T-05-39, T-05-40, T-05-41 | Named and bulk refreshes invalidate successful targets after persistence and before cascade without affecting failed or unrelated rows. | Unit + architecture + integration + static           | Task 3 verify command in Plan 05-07 | ✅          | ⬜ pending |
| 05-08-01 | 05-08 |    5 | TREF-05, TREF-06          | T-05-42, T-05-43, T-05-44, T-05-45, T-05-46          | Install invalidates the registered completion cache only after durable success and retains exact rollback and warning semantics.        | Tracer + unit + architecture + direct-pair           | Task 1 verify command in Plan 05-08 | ✅          | ⬜ pending |
| 05-08-02 | 05-08 |    5 | TREF-05, TREF-06          | T-05-42, T-05-43, T-05-44, T-05-45, T-05-46          | Update, reinstall, cascade, bulk, and backfill share one required cache without optional selectors or transaction drift.                | Unit + architecture + integration + direct-pair      | Task 2 verify command in Plan 05-08 | ✅          | ⬜ pending |
| 05-08-03 | 05-08 |    5 | TREF-05, TREF-06          | T-05-42, T-05-43, T-05-44, T-05-45, T-05-46, T-05-47 | Direct and reconciled uninstall invalidate only committed removals, continue independent cleanup, and retain complete compositions.     | Unit + composition + integration + repository        | Task 3 verify command in Plan 05-08 | ✅          | ⬜ pending |
| 05-09-01 | 05-09 |    6 | TREF-04, TREF-05, TREF-06 | T-05-48, T-05-50, T-05-51                            | One extension-owned runtime, cache, and adapter graph joins reconcile, hook dispatch, and authoritative completion refresh.             | Tracer + unit + integration + direct-pair            | Task 1 verify command in Plan 05-09 | ✅          | ⬜ pending |
| 05-09-02 | 05-09 |    6 | TREF-04, TREF-05, TREF-06 | T-05-48, T-05-49, T-05-51                            | Real re-registration invalidates every old callback without disposal and preserves live-generation state and exact transition order.    | Unit + lifecycle integration + direct-pair           | Task 2 verify command in Plan 05-09 | ✅          | ⬜ pending |
| 05-09-03 | 05-09 |    6 | TREF-04, TREF-05, TREF-06 | T-05-48, T-05-50, T-05-51, T-05-52, T-05-53          | Apply and bootstrap remain the only real-child compositions with exact state, trees, errors, diagnostics, and notifications.            | Unit + composition + integration + repository        | Task 3 verify command in Plan 05-09 | ✅          | ⬜ pending |
| 05-10-01 | 05-10 |    7 | TREF-04, TREF-05, TREF-06 | T-05-54, T-05-55, T-05-57, T-05-58                   | Fresh runtime/cache fixtures replace all reset surfaces without losing public behavior, isolation, or retained Phase 6 patch code.      | Tracer + unit + architecture + static census         | Task 1 verify command in Plan 05-10 | ✅          | ⬜ pending |
| 05-10-02 | 05-10 |    7 | TREF-04, TREF-05, TREF-06 | T-05-54, T-05-57                                     | The list flag set becomes private while independent catalog literals and exact accepted/rejected public behavior remain discriminating. | Unit + architecture + static census + direct-pair    | Task 2 verify command in Plan 05-10 | ✅          | ⬜ pending |
| 05-10-03 | 05-10 |    7 | TREF-04, TREF-05, TREF-06 | T-05-54, T-05-55, T-05-56, T-05-57, T-05-58, T-05-59 | Final gates prove exactly eleven roots, two compositions, intact Phase 6 and suppression baselines, and a green repository.             | Security + static census + focused + full repository | Task 3 verify command in Plan 05-10 | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

## Wave 0 Requirements

Existing Node test, direct-pair coverage, TypeScript, ESLint, Prettier, and Fallow infrastructure covers every Phase 5 requirement. New production modules must receive mirrored owner tests in the same implementation task; no framework, package, service, fixture download, or manual setup is required.

## Manual-Only Verifications

None. Every Phase 5 behavior has an automated owner, integration, static-census, or repository-gate route.

## Required Static Acceptance Checks

- No production export or test import/call named `BOOLEAN_FLAGS`, `resetEpoch`, `resetRoutingState`, or `resetCompletionCache` remains.
- No new `__deps`, `ForTest`, optional real-adapter fallback, or `fallow-ignore` marker is added.
- Every new production `.ts` file has a mirrored owner test under `tests/`.
- `bridges/skills/stage.test.ts`, pid-table behavior, the info split, and Phase 6 split ownership remain untouched.
- Existing `createRequire` and `syncBuiltinESMExports` uses are inventoried for Phase 6 but are not removed by Phase 5.

## Validation Sign-Off

- [x] Final plan and task identifiers replace the provisional requirement rows.
- [x] Every task has an automated verification command and an explicit failing direction.
- [x] No three consecutive tasks lack automated feedback.
- [x] Wave 0 has no missing framework or external dependency.
- [x] No watch-mode flag appears.
- [ ] All focused commands are green on the final source state.
- [ ] `nyquist_compliant: true` is set after execution evidence is recorded.

**Approval:** planning complete; execution and final Phase 5 validation pending.

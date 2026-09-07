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

The planner replaces these requirement-level rows with final plan/task identifiers after decomposition.

| Task ID    | Plan | Wave | Requirement | Threat Ref                                                                                                                            | Secure Behavior                                                                                                                                                 | Test Type                                                                                                     | Automated Command                                                    | File Exists | Status     |
| ---------- | ---- | ---: | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------- | ---------- |
| 05-TREF-04 | TBD  |  TBD | TREF-04     | T-05-01                                                                                                                               | Real adapters remain the production default; only classified irreproducible behavior receives a narrow port; apply/bootstrap observable proofs remain complete. | Unit + integration + static census                                                                            | Changed owner suites and direct-pair coverage; final `npm run check` | ✅          | ⬜ pending |
| 05-TREF-05 | TBD  |  TBD | TREF-05     | Fresh owned instances prevent cross-test and cross-lifecycle state leakage while reload and invalidation semantics remain observable. | Unit + integration                                                                                                                                              | Hooks state, event-router, settle, async-rewake, completion-cache, completion data, and provider owner suites | ✅                                                                   | ⬜ pending  |
| 05-TREF-06 | TBD  |  TBD | TREF-06     | Test-only exports and reset hooks are absent while independent catalog and public behavior contracts remain covered.                  | Architecture + unit + static census                                                                                                                             | Flag-catalog, plugin-list, hooks-state, and completion-cache owners plus zero-match `rg` checks               | ✅                                                                   | ⬜ pending  |

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

- [ ] Final plan and task identifiers replace the provisional requirement rows.
- [ ] Every task has an automated verification command and an explicit failing direction.
- [ ] No three consecutive tasks lack automated feedback.
- [x] Wave 0 has no missing framework or external dependency.
- [x] No watch-mode flag appears.
- [ ] All focused commands are green on the final source state.
- [ ] `nyquist_compliant: true` is set after execution evidence is recorded.

**Approval:** pending planning, execution, and final Phase 5 validation.

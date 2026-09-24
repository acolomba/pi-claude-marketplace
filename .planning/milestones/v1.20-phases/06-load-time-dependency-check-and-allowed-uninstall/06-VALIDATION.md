---
phase: "06"
slug: "load-time-dependency-check-and-allowed-uninstall"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-18"
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), TypeScript run natively by Node (no build step) |
| **Config file** | none — glob-driven from `package.json` scripts |
| **Quick run command** | `node --test "tests/orchestrators/reconcile/**/*.test.ts" "tests/orchestrators/plugin/uninstall*.test.ts" "tests/architecture/**/*.test.ts"` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ≈ 20s; full ≈ 5 min |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/orchestrators/reconcile/**/*.test.ts" "tests/orchestrators/plugin/uninstall*.test.ts" "tests/architecture/**/*.test.ts"`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green plus `npm run test:coverage:direct:all` (CI-only gate, not part of `check`) plus `pre-commit run --all-files`
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-* | 01 | 1 | LOAD-01 | — | A recorded dependency that is absent/disabled/out-of-range yields the right verdict `kind` | unit | `node --test tests/orchestrators/reconcile/dependency-verdict.test.ts` | ✅ created | ✅ green |
| 06-01-* | 01 | 1 | LOAD-01 | T-06-01 | Verdict becomes the new plan.ts bucket | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | LOAD-01 | T-06-02 | Row renders with the new token + cause line | unit (byte) | `node --test tests/orchestrators/reconcile/notify.test.ts` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | LOAD-01 | — | Catalog byte-contract holds for the new state(s) | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ✅ green |
| 06-02-* | 02 | 2 | LOAD-02 | — | Second pass over an unchanged unsatisfied tree is a no-op (`emptyReconcilePlan`) | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ | ✅ green |
| 06-02-* | 02 | 2 | LOAD-02 | — | apply → re-plan → apply does not oscillate | integration | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ✅ green |
| 06-02-* | 02 | 2 | LOAD-02 | T-06-06 | Lift: satisfying the dependency re-enables the dependent and clears the marker (marker never written to config) | unit + integration | `plan.test.ts` + `apply.test.ts` | ✅ | ✅ green |
| 06-02-* | 02 | 2 | LOAD-02 | — | D-06-05 fixpoint propagates a 3-deep chain in one pass | unit | `apply.test.ts` (or the verdict module's own suite) | ✅ | ✅ green |
| 06-03-* | 03 | 3 | LOAD-03 | — | `uninstall` proceeds and the success row names the dependents | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ (6 existing refusal cases rewritten) | ✅ green |
| 06-03-* | 03 | 3 | LOAD-03 | T-06-05 | Unreadable-declarer refusal still refuses (D-05-07 survives) | unit | `uninstall.test.ts` | ✅ | ✅ green |
| 06-03-* | 03 | 3 | LOAD-03 | — | `--prune` semantics unchanged | unit | `uninstall.test.ts` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | D-06-01 | T-06-07 | Schema accepts the new optional field; a legacy record without it loads unchanged | unit | `node --test tests/persistence/state-io.test.ts` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | D-06-01 | — | Record key-set pin includes the field | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | Closed set | — | Length + both enumerations agree | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | Purity (D-06-04) | — | `plan.ts` still imports nothing effectful | architecture | `node --test tests/architecture/reconcile-planner-purity.test.ts` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | NFR-5 | T-06-04 | The new verdict module names no git surface | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ | ✅ green |
| 06-04-* | 04 | 4 | LOAD-01, LOAD-02, LOAD-03 | — | Dependency, enablement, requirement, and backlog prose agrees with the shipped behavior | manual / doc-lint | `docs/dependency-resolution.md` and `docs/plugin-enablement.md` prose review | ✅ reviewed | ✅ green |

*Rows group related plan tasks; each PLAN.md supplies its exact task IDs.*

---

## Wave 0 Requirements

- [x] `tests/orchestrators/reconcile/dependency-verdict.test.ts` — pairs the new dependency-satisfaction verdict module; required by `npm run test:corresponding` before that module can land green.
- [x] Any additional new production module needs its pair in the same commit (`test:corresponding` gate).
- [x] Fixture additions in `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts` and `.../plugin-uninstall.ts` for each new catalog state.
- [x] No framework install needed — `node:test` is already in place.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* Live UAT against a real Pi session (multi-plugin dependency chain, `/reload` observing the disable-then-lift cycle) is recommended but not required for automated pass — follow the Phase 3/5 precedent of a live UAT note if the executor/verifier judges it warranted.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`dependency-verdict.test.ts`)
- [x] No watch-mode flags
- [x] Feedback latency < 20s (quick), < 5 min (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-24

## Validation Audit 2026-09-24

| Metric | Count |
| --- | ---: |
| Behavioral requirement gaps | 0 |
| New tests needed | 0 |
| Escalated | 0 |

The phase plans and summaries map every behavior to a named test. The current milestone run passed 7,760/7,760 unit tests and all 15 integration files. The corresponding source/test pairs, catalog contracts, and architecture guards remain active. The chain-wide `npm run check` still stops on the operator-owned `.planning/config.json` formatting drift; the test results above were run separately on the current tree.

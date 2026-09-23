---
phase: "11"
slug: "cross-marketplace-dependency-allowlist"
status: validated
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-23"
---

# Phase 11 — Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | Node.js `node:test` with TypeScript support |
| Config file | `package.json` |
| Quick run command | `node --test tests/domain/manifest.test.ts tests/domain/dependency-closure.test.ts` |
| Full suite command | `npm run check` |
| Estimated runtime | Measure during execution |

## Sampling Rate

- **After every task commit:** Run the direct tests listed for that task below.
- **After every plan wave:** Run `npm run check`.
- **Before `$gsd-verify-work`:** Run `npm run check`. If the inherited,
  user-owned `.planning/config.json` format drift blocks the parent chain,
  preserve it and verify each remaining gate separately; use the passing
  isolated Wave 7 check as the clean-tree result.
- **Max feedback latency:** Use the direct test command for each affected source and test pair.

## Per-Task Verification Map

Every planned task has a focused check below. Full commands and immediate
failure conditions remain in each PLAN.md. The seven SUMMARY.md files record
the focused checks, and the isolated Wave 7 `npm run check` passed all gates.

| Task ID | Wave | Requirement | Behavior | Automated command | Status |
| --- | --- | --- | --- | --- | --- |
| 11-01-01 | 1 | XMKT-01 | Real marketplace command accepts a string array and rejects a scalar with the field named. | `node --test tests/domain/manifest.test.ts tests/orchestrators/marketplace/add.test.ts` | ✓ passed |
| 11-01-02 | 1 | XMKT-01 | Complete schema matrix preserves all string values and refuses every malformed present shape. | `node --test tests/domain/manifest.test.ts tests/orchestrators/marketplace/add.test.ts` | ✓ passed |
| 11-02-01 | 2 | XMKT-01 | Info displays only nonempty lists, safely escaped and independently scoped. | `node --test tests/orchestrators/marketplace/info.test.ts tests/shared/notification-grammar.test.ts` | ✓ passed |
| 11-02-02 | 2 | XMKT-01 | Info catalog and type anchors agree. | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | ✓ passed |
| 11-03-01 | 3 | XMKT-01 | The real notify boundary renders cross-marketplace with both remedies. | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | ✓ passed |
| 11-03-02 | 3 | XMKT-01 | Reason membership, ordering, count, classification, and type anchors stay coherent. | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✓ passed |
| 11-04-01 | 4 | XMKT-01, XMKT-02 | Real direct install permits a listed edge and refuses an unlisted edge before writes. | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✓ passed |
| 11-04-02 | 4 | XMKT-01, XMKT-02 | Required callers and exhaustive failure documentation remain complete. | `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/architecture/dependency-doc-agreement.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✓ passed |
| 11-05-01 | 5 | XMKT-01, XMKT-02 | Direct root governs transitive edges; installed-first, disabled traversal, exact strings, and guard order remain correct. | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/domain/dependency-closure.test.ts tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | ✓ passed |
| 11-05-02 | 5 | XMKT-01, XMKT-02 | Production refusal projection preserves the policy root, declarer, and both remedies. | `node --test tests/shared/notify-reasons.test.ts tests/orchestrators/plugin/install-cascade.messaging.test.ts tests/architecture/dependency-doc-agreement.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✓ passed |
| 11-06-01 | 6 | XMKT-01, XMKT-02 | Missing install checks original declarers before B's cascade and skips recorded B before policy reads. | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✓ passed |
| 11-06-02 | 6 | XMKT-01, XMKT-02 | Reload retains every eligible declarer, accepts any grant, and preserves the refusal reason. | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/plugin/install-flow.test.ts` | ✓ passed |
| 11-06-03 | 6 | XMKT-01, XMKT-02 | B's own policy controls B-to-C; refusal is fail-clean and corrected-policy reload retries succeed. | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/reconcile/types.test.ts` | ✓ passed |
| 11-07-01 | 7 | XMKT-01, XMKT-02 | Complete user guidance agrees with the actual production composer. | `node --test tests/architecture/dependency-doc-agreement.test.ts tests/architecture/partial-vocabulary-guard.test.ts` | ✓ passed |
| 11-07-02 | 7 | XMKT-01, XMKT-02 | Reload catalog, offline boundaries, and all project gates have honest results. | `npm run check` | ✓ isolated pass; parent format baseline blocks chained check |

Every command fails verification on a non-zero exit, a zero-test summary where
tests are expected, or a missing required downstream gate. Preserve and report
the known operator-owned formatting baseline; it is not a passing full check.

## Wave 0 Requirements

Existing test infrastructure covers this phase. Add targeted cases to the paired
test files and catalog fixtures in the implementation waves.

## Manual-Only Verifications

All phase behaviors have automated verification. The two judgment-tier wording
checks in `11-UAT.md` remain for human review; they are not test coverage gaps.

## Validation Audit 2026-09-23

| Metric | Count |
| --- | ---: |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

The isolated Wave 7 check passed 7,646 unit tests with 100% coverage, 38
integration tests, and all seven type-member negative controls. The parent
checkout's chained check exits at formatting because of the pre-existing,
user-owned `.planning/config.json` drift; downstream gates also passed when
run separately. See `11-07-SUMMARY.md` and `11-VERIFICATION.md` for details.

## Validation Sign-Off

- [x] Every plan task has an automated verification command or Wave 0 dependency.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Existing tests cover every behavior above.
- [x] No watch-mode flags.
- [x] Direct test feedback is fast enough for each task.
- [x] `nyquist_compliant: true` set after validation.

**Approval:** validated 2026-09-23

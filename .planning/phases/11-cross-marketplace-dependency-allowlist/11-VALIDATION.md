---
phase: "11"
slug: "cross-marketplace-dependency-allowlist"
status: draft
nyquist_compliant: false
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
- **Before `$gsd-verify-work`:** `npm run check` must pass.
- **Max feedback latency:** Use the direct test command for each affected source and test pair.

## Per-Task Verification Map

Plan task IDs and waves will be filled after the plans are written. The required
behavior and test targets are:

| Requirement | Behavior | Automated command | Status |
| --- | --- | --- | --- |
| XMKT-01 | Schema accepts an absent or string-array allowlist and rejects malformed present values with the field name. | `node --test tests/domain/manifest.test.ts` | ⬜ pending |
| XMKT-01 | A direct cascade uses its root marketplace's list for direct and transitive edges; an added but unlisted marketplace is refused before lookup. | `node --test tests/domain/dependency-closure.test.ts tests/orchestrators/plugin/install-cascade.test.ts` | ⬜ pending |
| XMKT-02 | An installed dependency satisfies before the allowlist check, including when its marketplace is absent. | `node --test tests/domain/dependency-closure.test.ts tests/orchestrators/plugin/install-cascade.test.ts` | ⬜ pending |
| XMKT-01 | Reload checks every original declarer before the missing-key cascade, accepts any authorizing declarer, and uses the missing plugin's list for its own transitive edges. | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/plugin/install-flow.test.ts` | ⬜ pending |
| XMKT-01 | Refusal leaves state and files unchanged; an already-recorded missing key skips the policy before manifest reads. | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ⬜ pending |
| XMKT-01 | `marketplace info` prints `allowed_marketplaces:` only for nonempty parsed lists, including two-scope output. | `node --test tests/orchestrators/marketplace/info.test.ts tests/shared/notification-grammar.test.ts` | ⬜ pending |
| XMKT-01 | The closed-set `cross-marketplace` row names the blocked edge and both remedies; catalog and dependency documentation agree. | `node --test tests/orchestrators/plugin/install-cascade.messaging.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/dependency-doc-agreement.test.ts` | ⬜ pending |

## Wave 0 Requirements

Existing test infrastructure covers this phase. Add targeted cases to the paired
test files and catalog fixtures in the implementation waves.

## Manual-Only Verifications

All phase behaviors have automated verification.

## Validation Sign-Off

- [ ] Every plan task has an automated verification command or Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks lack automated verification.
- [ ] Existing tests cover every behavior above.
- [ ] No watch-mode flags.
- [ ] Direct test feedback is fast enough for each task.
- [ ] `nyquist_compliant: true` set after validation.

**Approval:** pending

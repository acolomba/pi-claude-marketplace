---
phase: "02"
slug: uninstall-data-disposition-and-the-uninstall-option-seam
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-14"
---

# Phase 02 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Built-in Node test runner |
| Config file | package.json |
| Quick run command | `node --test tests/edge/handlers/shared.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/edge/flag-catalog.test.ts tests/architecture/flag-catalog-drift.test.ts` |
| Data lifecycle command | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/reconcile/apply.test.ts` |
| Full suite command | `npm run check` |
| Estimated focused runtime | 15 seconds |

## Sampling Rate

- After each task: run its changed owner suites and direct pair coverage.
- After each plan wave: run `npm run check`.
- Before verification: the full gate must pass for the final source tree.
- Maximum focused feedback latency: 60 seconds.
- Run the existing FIFO fixture with the required sandbox permission; do not skip it or change the test to accommodate the sandbox.

## Per-Task Verification Map

Task IDs and waves will be assigned by the planner before execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Pending plan | Pending | Pending | DATA-01 | Pending plan | Accepted option preserves data; rejected flags cause no mutation | unit | `node --test tests/edge/handlers/shared.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/edge/flag-catalog.test.ts tests/architecture/flag-catalog-drift.test.ts` | Yes | pending |
| Pending plan | Pending | Pending | DATA-01, DATA-02 | Pending plan | Preserve nested bytes or delete by default after commit; retain path checks and other cleanup | filesystem unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | Yes | pending |
| Pending plan | Pending | Pending | DATA-03 | Pending plan | Reconcile deletes seeded data using the shared default | consumer integration | `node --test tests/orchestrators/reconcile/apply.test.ts` | Yes | pending |

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Extend the existing paired test files with preservation, promptless deletion, rejected-flag, and reconcile-data cases. No new dependency or test framework is required.

## Manual-Only Verifications

All phase behaviors have automated verification. Help and success output use exact comparisons against existing conventions.

## Validation Sign-Off

- [ ] All tasks have automated verification.
- [ ] Sampling continuity: no three consecutive tasks lack automated verification.
- [ ] Existing owners cover all required behaviors.
- [ ] No watch-mode flags.
- [ ] Focused feedback latency is below 60 seconds.
- [ ] Direct coverage passes for changed source-test pairs.
- [ ] Full project checks pass.
- [ ] `nyquist_compliant: true` is set after validation.

**Approval:** Pending execution and validation.

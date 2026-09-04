---
phase: 106
slug: workflow-detection-and-partial-install
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-29
---

# Phase 106 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | None. `package.json` defines commands and test scopes. |
| **Quick run command** | `node --test tests/domain/manifest.test.ts tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/discover.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | About 10 seconds for focused tests. Full-suite time varies by environment. |

---

## Sampling Rate

- **After every task commit:** Run the smallest command from the verification map.
- **After every plan wave:** Run `npm test && npm run test:integration`.
- **Before `$gsd-verify-work`:** Run `npm run check` and `npm run test:e2e`.
- **Max feedback latency:** 30 seconds for task-level checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 106-01-01 | 01 | 1 | WDET-02, WDET-03, WDET-04, WDET-05, WDET-06 | T-106-01, T-106-02, T-106-03, T-106-04, T-106-05 | Carry the fixed directory signal through rejection and partial install without copying workflow files. | integration and architecture | `node --test tests/orchestrators/plugin/install.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ✅ green |
| 106-01-02 | 01 | 1 | WDET-03, WDET-05, WDET-06 | T-106-03, T-106-04 | Keep structural failure ahead of the workflow soft signal. | integration | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ✅ green |
| 106-02-01 | 02 | 2 | WDET-01 | T-106-01 | Treat declarations as opaque presence signals in both schemas. | unit | `node --test tests/domain/manifest.test.ts` | ✅ | ✅ green |
| 106-02-02 | 02 | 2 | WDET-02, WDET-03 | T-106-01, T-106-03 | Keep strict and loose workflow classification deterministic, local, and deduplicated. | unit | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | ✅ | ✅ green |
| 106-03-01 | 03 | 2 | WDET-05, WDET-06 | T-106-02, T-106-03, T-106-04 | Prove rejection, rollback, retry, compatibility state, and source-only sentinels. | integration and architecture | `node --test tests/orchestrators/plugin/install.test.ts tests/architecture/compat-01-no-expansion.test.ts` | ✅ | ✅ green |
| 106-03-02 | 03 | 2 | WDET-06 | T-106-02, T-106-04 | Keep reload discovery limited to skill and prompt paths. | boundary integration | `node --test tests/orchestrators/discover.test.ts` | ✅ | ✅ green |
| 106-04-01 | 04 | 3 | WDET-04 | T-106-05 | Use one ordered and deduplicated workflow reason on every surface. | unit and integration | `node --test tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | ✅ | ✅ green |
| 106-04-02 | 04 | 3 | WDET-04 | T-106-05 | Bind inventory, rejection, and partial-success bytes to the executable catalog. | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The listed test files and fixture helpers already exist. Implementation tasks extend them with workflow cases.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have an automated check or a Wave 0 dependency.
- [x] No three consecutive tasks omit an automated check.
- [x] Wave 0 covers all missing references.
- [x] Commands do not use watch mode.
- [x] Task-level feedback latency is less than 30 seconds.
- [x] Set `nyquist_compliant: true` after execution evidence is green.

**Approval:** Validated after execution. All six requirements have green automated coverage.

## Validation Audit 2026-08-29

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

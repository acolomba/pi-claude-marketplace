---
phase: "3"
slug: "read-time-verdicts"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-04"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (unit, integration, e2e); cucumber-js profiles adapter and builtin |
| **Config file** | package.json scripts, cucumber profiles; none to install |
| **Quick run command** | `npm run check:commit` |
| **Full suite command** | `npm run check && npm run test:modules && npm run test:e2e` |
| **Estimated runtime** | several minutes |

---

## Sampling Rate

- **After every task commit:** Run `npm run check:commit`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green (green at commit 6775599)
- **Max feedback latency:** minutes (per-pair coverage)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | MREC-03 | N/A | unit+integration | `node --test test/orchestrators/plugin/mcp-verdict-read.test.ts test/orchestrators/plugin/list-installed-row.test.ts test/integration/mcp-verdict-list.test.ts` | ✅ | ✅ green |
| 3-01-02 | 01 | 1 | MREC-03 | N/A | unit | `node --test test/orchestrators/plugin/list-candidate-row.test.ts test/orchestrators/plugin/list-flow.test.ts` | ✅ | ✅ green |
| 3-01-03 | 01 | 1 | MREC-03 | N/A | integration+cucumber | `npx cucumber-js --profile adapter features/mcp-server/verdict-list.feature` | ✅ | ✅ green |
| 3-02-01 | 02 | 1 | MREC-05, MREC-07 | N/A | unit | `node --test test/orchestrators/plugin/mcp-verdict.test.ts test/orchestrators/plugin/install-outcome.test.ts` | ✅ | ✅ green |
| 3-02-02 | 02 | 1 | MREC-05, MREC-07 | N/A | unit | `node --test test/shared/concerns/soft-dep.test.ts` | ✅ | ✅ green |
| 3-02-03 | 02 | 1 | MREC-05, MREC-07 | N/A | unit | `node --test test/orchestrators/plugin/mcp-verdict.test.ts` | ✅ | ✅ green |
| 3-03-01 | 03 | 2 | MREC-03, MREC-04 | N/A | unit+cucumber | `node --test test/orchestrators/plugin/info.test.ts; npx cucumber-js --profile adapter features/mcp-server/verdict-info.feature` | ✅ | ✅ green |
| 3-03-02 | 03 | 2 | MREC-03, MREC-04 | N/A | unit+cucumber | `node --test test/orchestrators/plugin/fetch.test.ts; npx cucumber-js --profile adapter features/mcp-server/verdict-fetch.feature` | ✅ | ✅ green |
| 3-04-01 | 04 | 2 | MREC-05, MREC-07 | N/A | unit | `node --test test/shared/notify-reasons.test.ts test/shared/notification-resolve.test.ts test/architecture/soft-dep-marker-policy.test.ts` | ✅ | ✅ green |
| 3-04-02 | 04 | 2 | MREC-05, MREC-07 | N/A | unit+cucumber | `node --test test/orchestrators/plugin/list.messaging.test.ts; npx cucumber-js --profile adapter features/mcp-server/verdict-markers.feature` | ✅ | ✅ green |
| 3-04-03 | 04 | 2 | MREC-05, MREC-07 | N/A | cucumber | `npx cucumber-js --profile adapter features/mcp-server/companion-missing.feature` | ✅ | ✅ green |
| 3-05-01 | 05 | 3 | MREC-03, MREC-05, MREC-06 | N/A | unit | `node --test test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/install-cascade.test.ts` | ✅ | ✅ green |
| 3-05-02 | 05 | 3 | MREC-06 | N/A | cucumber | `npx cucumber-js --profile adapter features/mcp-server/verdict-install.feature` | ✅ | ✅ green |
| 3-06-01 | 06 | 3 | MREC-03, MREC-06 | N/A | unit | `node --test test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/update-preflight.test.ts` | ✅ | ✅ green |
| 3-06-02 | 06 | 3 | MREC-03, MREC-06 | N/A | unit+integration | `node --test test/orchestrators/plugin/update-swap.test.ts test/integration/mcp-verdict-update.test.ts` | ✅ | ✅ green |
| 3-06-03 | 06 | 3 | MREC-06 | N/A | cucumber | `npx cucumber-js --profile adapter features/mcp-server/verdict-update.feature` | ✅ | ✅ green |
| 3-07-01 | 07 | 3 | MREC-03, MREC-06 | N/A | unit | `node --test test/orchestrators/reconcile/convergence.test.ts test/orchestrators/reconcile/pending.test.ts` | ✅ | ✅ green |
| 3-07-02 | 07 | 3 | MREC-03, MREC-06 | N/A | unit+integration | `node --test test/orchestrators/reconcile/mcp-migration.test.ts test/integration/mcp-verdict-migration.test.ts` | ✅ | ✅ green |
| 3-07-03 | 07 | 3 | MREC-06 | N/A | cucumber | `npx cucumber-js --profile adapter features/mcp-server/verdict-apply.feature` | ✅ | ✅ green |
| 3-08-01 | 08 | 3 | MREC-05, MREC-07 | N/A | unit+integration | `node --test test/shared/concerns/soft-dep.test.ts test/orchestrators/plugin/info.test.ts test/integration/mcp-status-conformance.test.ts` | ✅ | ✅ green |
| 3-08-02 | 08 | 3 | MREC-05, MREC-07 | N/A | cucumber | `npx cucumber-js --profile adapter features/mcp-server/companion-missing.feature` | ✅ | ✅ green |
| 3-08-03 | 08 | 3 | MREC-05, MREC-07 | N/A | e2e | `npm run test:e2e (adapter-detection-rpc, install-soft-deps)` | ✅ | ✅ green |
| 3-09-01 | 09 | 4 | MREC-03..07 | N/A | unit+cucumber | `npm run check:commit; npx cucumber-js --profile builtin` | ✅ | ✅ green |
| 3-09-02 | 09 | 4 | MREC-03..07 | N/A | full gate | `npm run check && npm run test:modules && npm run test:e2e` | ✅ | ✅ green |

*Requirement classification: MREC-03 COVERED, MREC-04 COVERED, MREC-05 COVERED, MREC-06 COVERED, MREC-07 COVERED.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have automated verify
- [x] Sampling continuity maintained
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-04

## Validation Audit 2026-11-04

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

---
phase: "2"
slug: "apply-ordering-and-installed-declarations"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| **Config file** | `cucumber.json`; `package.json` scripts |
| **Quick run command** | `node --test <test-path>`; `npx cucumber-js --name '<scenario title>'`; `npm run test:coverage:direct -- <source-or-test-path>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (full), seconds per pair |

---

## Sampling Rate

- **After every task commit:** owner tests + `npm run test:coverage:direct -- <touched source>`; the hook runs `npm run check:commit`
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green, plus `npm run check:features`
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled from the plans; requirement → check mapping (from RESEARCH.md `## Validation Architecture`):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| RCN-01 | PENDMOVE-01: pending rows = apply rows; second pending empty | cucumber | `npx cucumber-js --name '<PENDMOVE scenario title>'` | ❌ new in `features/plugin/apply.feature` | ⬜ pending |
| RCN-01 | release loop counts scheduled installs | unit | `node --test test/orchestrators/reconcile/convergence.test.ts test/orchestrators/reconcile/dependency-verdict.test.ts` | ✅ add cases | ⬜ pending |
| RCN-02 | MISSORDER-01: moves then MISS-01 in one apply; pending same order | cucumber | `npx cucumber-js --name '<MISSORDER scenario title>'` | ❌ new | ⬜ pending |
| RCN-02 | MISS-01 after cascade, row order, post-install enables | unit | `node --test test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/pending.test.ts test/orchestrators/reconcile/notify.test.ts` | ✅ update | ⬜ pending |
| RCN-03 | keeper disabled in same apply | cucumber (existing) | `npx cucumber-js --name '<apply.feature keeper/orphan title>'` + local mutation check | ✅ | ⬜ pending |
| RCN-04 | first unreadable record ends each walk (D-PL2-05) | unit | `node --test test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/reconcile/dependency-verdict.test.ts` | ✅ | ⬜ pending |
| RCN-05 | enable follows installed copy (git source) | cucumber | `npx cucumber-js --name '<enable scenario title>'` | ❌ new in `features/plugin/enable.feature` | ⬜ pending |
| RCN-05 | update held by installed holder's range | cucumber | `npx cucumber-js --name '<update scenario title>'` | ❌ new in `features/plugin/update-dependencies.feature` | ⬜ pending |
| RCN-05 | installed-first reader arms | unit | `node --test test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/update-constraint-gate.test.ts` | ✅ add cases | ⬜ pending |
| RCN-06 | marketplace add / bootstrap / autoupdate install missing deps | cucumber | `npx cucumber-js --name '<add / bootstrap / autoupdate titles>'` | ❌ new | ⬜ pending |
| RCN-06 | seam wiring | unit | `node --test test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/plugin/bootstrap.test.ts test/edge/register.test.ts test/index.test.ts` | ✅ update | ⬜ pending |
| RCN-07 | refusal row kept (D-PL2-11) | cucumber (existing) | `npx cucumber-js --name "Apply refuses a missing anthropic-plugin-directory dependency whose listed copy falls outside a plugin's range, naming that plugin"` | ✅ | ⬜ pending |
| RCN-08 | one owning root per record (D-PL2-12), manifest symlink refused (D-PL2-13) | unit | `node --test test/orchestrators/plugin/dependency-declaration-read.test.ts test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/reconcile/convergence.test.ts` | ✅ add cases | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

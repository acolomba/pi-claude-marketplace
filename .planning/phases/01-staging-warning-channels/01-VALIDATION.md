---
phase: "1"
slug: "staging-warning-channels"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test <test-path>` and `npm run test:coverage:direct -- <source>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~120 seconds (full); ~5-20 seconds (one pair) |

---

## Sampling Rate

- **After every task commit:** owner tests of the touched pairs plus `npm run test:coverage:direct -- <each touched source>`; `npm run typecheck` when a shared type changes
- **After every plan wave:** `npm run check` on the merged tree
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 120 seconds

---

## Per-Requirement Verification Map

| Requirement | Test Type | Automated Command | File Exists |
|-------------|-----------|-------------------|-------------|
| WRN-01 | unit + scenario | `node --test test/orchestrators/plugin/enable-disable.test.ts`; `npx cucumber-js features/plugin/staging-warnings.feature` | unit yes; scenario W0 |
| WRN-02 | unit + scenario | `node --test test/orchestrators/marketplace/update.messaging.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/plugin/shared.test.ts`; `npx cucumber-js features/plugin/staging-warnings.feature` | unit yes; scenario W0 |
| WRN-03 | unit + typecheck + scenario | `node --test test/shared/staging-warnings.test.ts test/bridges/*/stage.test.ts`; `npm run typecheck` | `staging-warnings.test.ts` W0 |
| WRN-04 | unit + scenario | `node --test test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | unit yes; scenario W0 |
| WRN-05 | unit | `node --test --test-name-pattern 'force' test/bridges/agents/stage.test.ts` | yes |
| WRN-06 | unit + scenario | `node --test test/orchestrators/plugin/dependency-settle.test.ts test/orchestrators/plugin/materialize-latest.test.ts test/orchestrators/plugin/update-flow.test.ts` | unit yes; scenario W0 |
| WRN-07 | unit | `node --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-record.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | yes |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/pi-claude-marketplace/shared/staging-warnings.ts` + `test/shared/staging-warnings.test.ts` (WRN-03)
- [ ] `features/plugin/staging-warnings.feature` and new `Given` steps (colliding skill; duplicate agents)

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

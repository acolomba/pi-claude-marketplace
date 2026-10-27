---
phase: "9"
slug: "plugin-package-dependencies"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit/architecture); `@cucumber/cucumber` (behavioral) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test test/orchestrators/plugin/package-install.test.ts test/platform/package-manager.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** owner test + `npm run test:coverage:direct -- <source>`; the hook runs `check:commit`
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

See `09-RESEARCH.md` § Validation Architecture (Phase Requirements -> Test Map). The planner binds each task to one of those commands.

| Req | Test Type | Automated Command |
|-----|-----------|-------------------|
| PKD-01 | unit | `node --test test/orchestrators/plugin/package-install.test.ts test/platform/package-manager.test.ts` |
| PKD-01 | behavioral | cucumber scenario in `features/plugin/package-dependencies.feature` |
| PKD-02 | unit + behavioral | same files; `node --test test/orchestrators/plugin/materialize-latest.test.ts` |
| PKD-03 | architecture + lint + fallow | `node --test test/architecture/no-shell-out.test.ts`; `npm run lint`; `npm run fallow` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/platform/package-manager.test.ts`
- [ ] `test/orchestrators/plugin/package-install.test.ts`
- [ ] `features/lib/npm-registry.ts` (loopback npm registry stand-in)
- [ ] `features/plugin/package-dependencies.feature` + step module

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

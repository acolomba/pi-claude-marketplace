---
phase: "9"
slug: "plugin-package-dependencies"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

| Req | Test Type | Automated Command | Status |
|-----|-----------|-------------------|--------|
| PKD-01 | unit | `node --test test/orchestrators/plugin/package-install.test.ts test/platform/package-manager.test.ts` | ✅ green |
| PKD-01 | behavioral | cucumber scenario in `features/plugin/package-dependencies.feature` (9 scenarios) | ✅ green |
| PKD-02 | unit + behavioral | same files; `node --test test/orchestrators/plugin/materialize-latest.test.ts` | ✅ green |
| PKD-03 | architecture + lint + fallow | `node --test test/architecture/no-shell-out.test.ts`; `npm run lint`; `npm run fallow` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/platform/package-manager.test.ts`
- [x] `test/orchestrators/plugin/package-install.test.ts`
- [x] `features/lib/npm-registry.ts` (loopback npm registry stand-in)
- [x] `features/plugin/package-dependencies.feature` + step module

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-27 (`npm run check` CHECK_EXIT=0 at fb0feda0; targeted run exit 0)

## Validation Audit 2026-10-27

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

---
phase: "10"
slug: "model-facing-tools"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-08"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit), `@cucumber/cucumber` 13.3.0 (behavioral) |
| **Config file** | `cucumber.json` (default profile = adapter) |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/handlers/tools.test.ts` and `npx cucumber-js features/plugin/model-tools.feature` |
| **Full suite command** | `npm run check`, run as its parts in order at wave gates |
| **Estimated runtime** | ~30 seconds quick; ~10 minutes full |

---

## Sampling Rate

- **After every task commit:** the hook's `npm run check:commit`, plus the quick commands for any task touching `tools.ts` or the feature file
- **After every plan wave:** `check:static`, `test:unpaired`, `test:integration`, both cucumber profiles, `test:coverage:direct:all`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled in by the plans; each task's `<automated>` command is the owner unit test, the pair's direct coverage, or the feature run.

| Requirement | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-------------------|-------------|--------|
| TOOL-01 | unit + cucumber | owner test; `npx cucumber-js features/plugin/model-tools.feature` | ✅ | ⬜ pending |
| TOOL-02 | unit + cucumber | same | ✅ | ⬜ pending |
| TOOL-03 | unit + cucumber | same | ✅ | ⬜ pending |

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
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

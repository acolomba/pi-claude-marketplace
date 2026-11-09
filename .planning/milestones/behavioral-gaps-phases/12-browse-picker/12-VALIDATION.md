---
phase: "12"
slug: "browse-picker"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (behavioral, terminal Pi); `node:test` (unit) |
| **Config file** | `cucumber.json` (profiles `adapter`, `builtin`); `package.json` scripts |
| **Quick run command** | `npx cucumber-js --profile adapter --parallel 3 features/plugin/browse.feature` |
| **Full suite command** | `npm run check` (phase gate adds `npm run test:modules`) |
| **Estimated runtime** | ~60 seconds for the quick run |

---

## Sampling Rate

- **After every task commit:** the owner unit tests (`node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/browser/plugin-browser.test.ts test/edge/handlers/plugin/browse.test.ts`), direct coverage of the touched source, the quick cucumber run, and `npm run check:features`.
- **After every plan wave:** the parts of `npm run check` in order, each in the background with its exit code in a file.
- **Before `/gsd-verify-work`:** `npm run check` and `npm run test:modules` green.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

See `12-RESEARCH.md` § Validation Architecture: the requirement-to-test map (BROWSE-01 unit + coverage + scenarios B and H; BROWSE-02 scenarios C to G) and the red-proof table, one temporary product mutation per new or rewritten scenario. The plans' `<verify>` blocks carry the exact commands.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements: no framework install and no new step module. The new unit cases land with the count fix.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

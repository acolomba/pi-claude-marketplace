---
phase: "2"
slug: "async-hooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The requirement-to-test map and the red proofs are in `02-RESEARCH.md`, "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, architecture, integration); `@cucumber/cucumber` (behavior) |
| **Config file** | `cucumber.json` (profiles `adapter`, `builtin`) |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <pair test>` and `npm run test:coverage:direct -- <source>` |
| **Feature run command** | `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/async.feature` |
| **Full suite command** | `npm run check` (wave gates run its parts in order in the background) |
| **Estimated runtime** | ~60 s for the feature file; ~15 min for the parts of `npm run check` under shared load |

---

## Sampling Rate

- **After every task commit:** the commit hook's `npm run check:commit`, plus the owner test and its pair coverage.
- **After every plan wave:** the parts of `npm run check` in order: `check:static`, `test:unpaired`, `test:integration`, both cucumber profiles, `test:coverage:direct:all`.
- **Before `/gsd-verify-work`:** the full `npm run check` and `npm run test:modules` green.
- **Max feedback latency:** 120 seconds for a pair or the feature file.

---

## Per-Task Verification Map

Filled by the plans: each task's `<verify>` names its pair test, pair coverage, or the feature file. Every scenario records a red proof in its plan SUMMARY.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Pair tests of any new leaf module under `bridges/hooks/async-rewake/`.
- [ ] `features/step_definitions/hook/async.steps.ts`, the new step module.

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

---
phase: 10
slug: claude-settings-import-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
---

# Phase 10 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` |
| **Config file** | none for test runner |
| **Quick run command** | `npm test -- tests/orchestrators/import/*.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Targeted import tests should run in seconds; full gate is the existing repository quality bar. |

---

## Sampling Rate

- **After every task commit:** Run the targeted test file named in the task `<verify>` block.
- **After every plan wave:** Run `npm test -- tests/orchestrators/import/*.test.ts`.
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** Targeted feedback under one minute; full gate at phase close.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 10-01 | 1 | IMP-04 | unit | `npm test -- tests/orchestrators/import/settings.test.ts` | planned | pending |
| 10-01-02 | 10-01 | 1 | IMP-04 | unit | `npm test -- tests/orchestrators/import/settings.test.ts` | planned | pending |
| 10-01-03 | 10-01 | 1 | IMP-04 | unit / typecheck | `npm run typecheck && npm test -- tests/orchestrators/import/settings.test.ts` | planned | pending |
| 10-02-01 | 10-02 | 2 | IMP-05 / IMP-06 | unit | `npm test -- tests/orchestrators/import/refs.test.ts` | planned | pending |
| 10-02-02 | 10-02 | 2 | IMP-05 / IMP-06 | unit | `npm test -- tests/orchestrators/import/refs.test.ts` | planned | pending |
| 10-03-01 | 10-03 | 3 | IMP-07 / IMP-08 | unit | `npm test -- tests/orchestrators/import/marketplaces.test.ts` | planned | pending |
| 10-03-02 | 10-03 | 3 | IMP-07 / IMP-08 | unit | `npm test -- tests/orchestrators/import/marketplaces.test.ts` | planned | pending |
| 10-03-03 | 10-03 | 3 | IMP-04..IMP-08 | unit / full gate | `npm run check` | planned | pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- [x] `node:test` is already configured.
- [x] `npm test` includes `tests/orchestrators/**/*.test.ts`.
- [x] `npm run check` already combines typecheck, lint, format, and tests.

---

## Manual-Only Verifications

All Phase 10 behaviors have automated verification. There is no UI, network, or live Pi runtime behavior in this phase.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all MISSING references.
- [x] No watch-mode flags.
- [x] Feedback latency target < 60 seconds for task-level targeted tests.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution evidence

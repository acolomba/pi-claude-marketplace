---
phase: "3"
slug: "stopfailure-hooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (behavioral); `node:test` (unit) |
| **Config file** | `cucumber.json` (profiles `adapter`, `builtin`) |
| **Quick run command** | `npx cucumber-js --profile adapter --parallel 3 features/hook/stop-failure.feature` |
| **Full suite command** | `npm run check` (phase gate also `npm run test:modules`) |
| **Estimated runtime** | ~60 seconds quick; ~8 minutes full under load |

---

## Sampling Rate

- **After every task commit:** the commit hook (`npm run check:commit`, staged pairs) plus the quick run
- **After every plan wave:** the parts of `npm run check` in order
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 (SC1, SC2, D-BG-304) | 01 | 1 | STOPF-01 | T-3-01 | a temporary red-proof break never reaches a commit | behavioral | `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/stop-failure.feature`; `npm run check:features`; `git diff --quiet HEAD -- extensions` | ✅ seed | ⬜ pending |
| 3-01-02 (SC3) | 01 | 1 | STOPF-01 | T-3-01 | a temporary red-proof break never reaches a commit | behavioral | `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/stop-failure.feature`; `git diff --quiet HEAD -- extensions` | ✅ | ⬜ pending |
| 3-01-03 (SC4) | 01 | 1 | STOPF-01 | T-3-01, T-3-02 | a StopFailure hook's output reaches neither the model nor the user | behavioral | `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/stop-failure.feature features/hook/prompt-and-stop.feature`; `npm run check:features`; `git diff --quiet HEAD -- extensions` | ✅ | ⬜ pending |
| 3-02-01 (SC2, D-BG-302) | 02 | 2 | STOPF-01 | T-3-03, T-3-04, T-3-05 | no `RegExp` is built from a plugin matcher; a list is admitted only with a vocabulary type; other closed-set events unchanged | behavioral + unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/components/hook-events.test.ts test/domain/components/hooks/partition.test.ts test/bridges/hooks/settle.test.ts`; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts extensions/pi-claude-marketplace/domain/components/hooks/partition.ts extensions/pi-claude-marketplace/bridges/hooks/settle.ts`; `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/stop-failure.feature features/hook/configuration.feature features/hook/session.feature`; `npm run check:static` | ✅ | ⬜ pending |
| 3-02-02 (D-BG-301) | 02 | 2 | STOPF-01 | T-3-04 | a type outside the vocabulary still drops | behavioral + unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/components/hook-events.test.ts test/domain/components/hooks/partition.test.ts`; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts`; `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/stop-failure.feature features/hook/configuration.feature`; `npm run check:static` | ✅ | ⬜ pending |
| 3-03-01 (SC1, D-BG-303) | 03 | 3 | STOPF-01 | T-3-06, T-3-07 | the hook gets no more error text than Claude Code sends | behavioral + unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/payloads/stop-failure.test.ts test/bridges/hooks/settle.test.ts`; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts extensions/pi-claude-marketplace/bridges/hooks/settle.ts`; `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/stop-failure.feature features/hook/prompt-and-stop.feature`; `npm run check:static` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task IDs are `3-<plan>-<task>`. The red proof of every scenario is recorded in its plan's SUMMARY: plan 01 by temporary product breaks, plans 02 and 03 by running each scenario before its fix (plus temporary breaks for the info rows that pass before the fix).

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

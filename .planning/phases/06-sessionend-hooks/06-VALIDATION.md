---
phase: "6"
slug: "sessionend-hooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-08"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral, `adapter` and `builtin` profiles); `node:test` (unit) |
| **Config file** | `cucumber.json` (frozen) |
| **Quick run command** | `npx cucumber-js --profile adapter --parallel 2 features/hook/session-end.feature` |
| **Full suite command** | `npm run check` (run as its parts in order at wave gates; once whole at the phase gate) |
| **Estimated runtime** | ~60 seconds quick; ~8 minutes full under load |

---

## Sampling Rate

- **After every task commit:** the commit hook runs `npm run check:commit`; plus the quick run command when a scenario or step changed
- **After every plan wave:** `check:static`, `test:unpaired`, `test:integration`, both cucumber profiles at `--parallel 3`, `test:coverage:direct:all`
- **Before `/gsd-verify-work`:** `npm run check` and `npm run test:modules` green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | Status |
|-------------|----------|-----------|-------------------|--------|
| SEND-01 (1) | resume (switch_session) and json-mode quit run SessionEnd with Claude's reason and payload | behavioral | quick run command | ⬜ pending |
| SEND-01 (2) | a matcher for clear, resume, other, prompt_input_exit selects only its run; logout never runs | behavioral | quick run command | ⬜ pending |
| SEND-01 (3) | exit 1, exit 2, outlasting the budget, a longer declared timeout: the next session starts or Pi exits, and the run is recorded | behavioral | quick run command | ⬜ pending |
| D-BG-604 | a declared blocking SessionEnd timeout is capped at 1.5 s with a debug line; 1.5 s kept; background lane kept | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/timeout.ts` | ⬜ pending |
| hygiene | no unused, undefined, or ambiguous step; no clone group | static | `npm run check:features`; `npx fallow dupes --fail-on-issues --format human` | ⬜ pending |

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

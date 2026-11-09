---
phase: "9"
slug: "legacy-mcp-entry-move"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (behavioral, profiles `adapter` and `builtin`); `node:test` (unit pair) |
| **Config file** | `cucumber.json` (frozen) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile adapter --parallel 1 features/mcp-server/legacy-move.feature`, then the same with `--profile builtin` |
| **Full suite command** | `npm run check` (in parts on this shared machine: `check:static`, `test:unpaired`, `test:integration`, both cucumber profiles with `--parallel 3`, `test:coverage:direct:all`) |
| **Estimated runtime** | ~35 s per profile for the owned file; ~8-10 min for the full suite |

---

## Sampling Rate

- **After every task commit:** the owned feature file under both profiles, and `npm run check:features`
- **After every plan wave:** the full suite, in parts
- **Before `/gsd-verify-work`:** `npm run check` and `npm run test:modules` green
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-* | 01 | 1 | AMIG-01, AMIG-02 | — | N/A (test-only) | behavioral | `npm run test:cucumber:profile -- --profile <adapter\|builtin> --parallel 1 features/mcp-server/legacy-move.feature` | ✅ seed / ❌ new scenarios | ⬜ pending |
| 9-01-* | 01 | 1 | AMIG-01, AMIG-02 | — | N/A | static | `npm run check:features` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `features/step_definitions/mcp-server/legacy-move.steps.ts` — new verb module with the D-BG-905 Given, created together with the scenario that uses it.

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

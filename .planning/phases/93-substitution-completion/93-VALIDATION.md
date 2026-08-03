---
phase: 93
slug: substitution-completion
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 93 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, TS via native type stripping) |
| **Config file** | package.json `test` script |
| **Quick run command** | `node --test tests/shared/vars.test.ts tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts tests/bridges/agents/convert.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60 seconds full check; ~5 seconds targeted files |

---

## Sampling Rate

- **After every task commit:** Run the targeted test files for the touched surfaces
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | SUB-01, SUB-02 | — | absent field never substitutes empty string; unknown tokens pass through | unit | `node --test <targeted files>` | ✅ (existing files extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — vars and per-bridge stage/convert test files exist; new tests extend them.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

All phase behaviors have automated verification — materialized file content is fully assertable in unit tests.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

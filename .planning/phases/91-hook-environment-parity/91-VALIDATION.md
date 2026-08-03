---
phase: 91
slug: hook-environment-parity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 91 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, TS via native type stripping) |
| **Config file** | package.json `test` script |
| **Quick run command** | `node --test tests/architecture/hooks-async-rewake.test.ts tests/bridges/hooks/dispatch-exec.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~60 seconds full check; ~3 seconds targeted files |

---

## Sampling Rate

- **After every task commit:** Run the targeted test files for the touched lanes
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | HENV-01, HENV-02 | — | snapshot id wins over spread; no other env keys disturbed | unit | `node --test <lane test files>` | ✅ (existing files extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — both lanes already have test files with spawn-spy env assertion machinery (`tests/bridges/hooks/dispatch-exec.test.ts`, `tests/architecture/hooks-async-rewake.test.ts` with `wireBoth` + `_setSpawnForTest`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

All phase behaviors have automated verification — hook spawn env is fully assertable in-process via the spawn-spy seam. (Phase 90's deferred live-Pi UAT covers the underlying session-var freshness end-to-end.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

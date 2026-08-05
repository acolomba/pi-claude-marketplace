---
phase: 91
slug: hook-environment-parity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 91-01 T1 (tracer) | 91-01 | 1 | HENV-01 | — | snapshot id wins over spread (sentinel test); existing env set undisturbed | unit | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | ✅ | ✅ green |
| 91-01 T2 | 91-01 | 1 | HENV-02 | — | async lane mirrors sync; MARKER_ENV sole async-only key | unit | `node --test tests/architecture/hooks-async-rewake.test.ts` | ✅ | ✅ green |
| 91-01 T3 | 91-01 | 1 | HENV-02 | — | assertLaneParity: key-set symmetric difference == [MARKER_ENV], per-key equality, PreToolUse + SessionStart fixtures | unit | `node --test tests/architecture/hooks-async-rewake.test.ts` | ✅ | ✅ green |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infrastructure)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-03

## Validation Audit 2026-08-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Both requirements COVERED: HENV-01 by the sync-lane env assertions + snapshot-wins sentinel test (`tests/bridges/hooks/dispatch-exec.test.ts`), HENV-02 by the async mirror assertions + `assertLaneParity` drift guard (`tests/architecture/hooks-async-rewake.test.ts`). Targeted runs green (63 pass / 1 pre-existing platform skip); full unit suite 3181 pass at phase seal.

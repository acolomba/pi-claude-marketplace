---
phase: 95
slug: manifest-independent-installed-inventory
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-08
---

# Phase 95 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in runner, TS run natively) |
| **Config file** | package.json scripts (no separate config) |
| **Quick run command** | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` |
| **Full suite command** | `PI_SUBAGENTS_ROOT=~/.pi/agent/npm/node_modules/pi-subagents npm run check` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test <touched-suite>.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 95-01-01 | 01 | 1 | INV-02, INV-03, INV-04 | — | N/A | characterization | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ | ✅ green |
| 95-01-02 | 01 | 1 | INV-01, BOUND-03 | — | N/A | unit (tracer) | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ | ✅ green |
| 95-01-03 | 01 | 1 | INV-02 | — | N/A | unit | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ | ✅ green |
| 95-02-01 | 02 | 2 | INV-05 | — | N/A | unit | `node --test tests/edge/handlers/tools.test.ts` | ✅ | ✅ green |
| 95-02-02 | 02 | 2 | INV-05 | — | N/A | unit | `node --test tests/edge/handlers/tools.test.ts` | ✅ | ✅ green |
| fix-loop | — | — | INV-01, BOUND-03 (WR-05/06/07), catalog gate (WR-03/08) | — | N/A | unit + byte gate | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concurrent list read never observes torn state.json | INV-05 (backstop, probe artifact) | Rests on pre-existing write-file-atomic rename semantics (NFR-1); no phase test exercises a live read/write race | Signed off by operator 2026-08-08 via 95-UAT.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-08

## Validation Audit 2026-08-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All six phase requirements (INV-01..05, BOUND-03) map to green automated
tests: `list-manifest-absent.test.ts` (12), `tools.test.ts` (28, incl. the
INV-05 arms), `catalog-uat.test.ts` (6, byte-equality over the two new
catalog states). Full `npm run check` exit 0 confirmed by the Phase 95
verifier at HEAD `0d461b31`.

---
phase: 88
slug: agent-settled-dispatcher-stop-contract-stopfailure
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-30
validated: 2026-07-31
---

# Phase 88 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in runner, TS via native strip) |
| **Config file** | package.json `scripts.test` |
| **Quick run command** | `node --test tests/bridges/hooks/settle.test.ts tests/bridges/hooks/payloads/stop.test.ts tests/bridges/hooks/payloads/stop-failure.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/hooks-dispatch.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~4s (quick, 71 tests) / ~60s (full check) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command scoped to the touched suite
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 88-01 T1 | 01 | 1 | D-88-04 (Wave 0) | — | — | build | `npm run typecheck` | ✅ | ✅ COVERED |
| 88-01 T2 | 01 | 1 | STOP-01, STOP-03 | — | — | unit | `node --test tests/bridges/hooks/settle.test.ts` | ✅ | ✅ COVERED |
| 88-02 T1 | 02 | 2 | STOP-03, STOP-04, STOP-05, STOP-06 | — | — | unit | `node --test tests/bridges/hooks/settle.test.ts` | ✅ | ✅ COVERED |
| 88-02 T2 | 02 | 2 | STOP-02 | — | — | unit | `node --test tests/bridges/hooks/payloads/stop.test.ts` | ✅ | ✅ COVERED |
| 88-03 T1 | 03 | 3 | STOP-07 | T-88-02 (livelock bound) | 8-consecutive-block cap suppresses re-entry | unit + arch | `node --test tests/bridges/hooks/settle.test.ts tests/architecture/hooks-dispatch.test.ts` | ✅ | ✅ COVERED |
| 88-03 T2 | 03 | 3 | STOP-07 (D-88-01 warning) | — | Cap trip is never silent (P-88-01) | arch (byte) | `node --test tests/architecture/hooks-cap-notify.test.ts` | ✅ | ✅ COVERED |
| 88-04 T1 | 04 | 4 | SFAIL-01, SFAIL-02 | — | Observation-only: no re-entry, loop cells untouched | unit | `node --test tests/bridges/hooks/settle.test.ts tests/bridges/hooks/payloads/stop-failure.test.ts` | ✅ | ✅ COVERED |
| 88-04 T2 | 04 | 4 | SFAIL-03 | — | Classifier output pinned to closed 10-value set | unit | `node --test tests/bridges/hooks/payloads/stop-failure.test.ts` | ✅ | ✅ COVERED |
| 88-05 T1 | 05 | 5 | STOP-01, STOP-03 | T-88-08 (sandbox containment) | Harness refuses PI_CODING_AGENT_DIR outside tmp/pi-uat; uninstalls canary in finally | live (manual trigger) | `node tests/live-uat/stop-canary.mjs` | ✅ | ✅ COVERED |
| 88-05 T2 | 05 | 5 | STOP-01, STOP-07 | — | Honesty contract: unscriptable residue routes human_needed, never silent pass | manual checklist | tests/live-uat/README.md items 1–4 | ✅ | ✅ MANUAL (passed) |

Notes:
- `settle.test.ts` (39K) is the shared suite for all settle-dispatcher arms; requirement IDs are annotated inline per test.
- The 88-05 T1 canary is automated but drives a real Pi >= 0.80.5 runtime; it is intentionally outside `npm test` and run at UAT time.

---

## Wave 0 Requirements

Dev-tree refresh (D-88-04): `npm install` materializing the locked
pi-coding-agent 0.82.1 so `agent_settled` typings exist — first task, before
any subscription code. **Complete** (88-01-SUMMARY: dev tree materialized at
0.82.1, `agent_settled` overload typechecks).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Result |
|----------|-------------|------------|-------------------|--------|
| Live-Pi abort/queue/canary UAT items (D-88-03b) | STOP-01, STOP-07 | Real Pi >= 0.80.5 runtime behavior (agent_settled on abort paths, queued-message settle timing, 8-block cap end-to-end) | tests/live-uat/README.md items 1–4 | ✅ passed 4/4 (88-UAT.md, 2026-07-31) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-31 (retroactive audit; phase archived with v1.16)

---

## Validation Audit 2026-07-31

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Audit notes: retroactive audit against the archived v1.16 phase dir. The
seeded per-task map was never filled during execution; reconstructed here from
the five PLAN/SUMMARY pairs. All 10 requirements (STOP-01..07, SFAIL-01..03)
cross-referenced to existing suites; 71/71 tests pass on re-run. The seeded
quick-run command referenced a nonexistent path
(`tests/bridges/hooks/hooks-dispatch.test.ts`) — corrected to the actual
phase-88 suites. The four D-88-03b human-verification items were executed and
passed in 88-UAT.md; no auditor spawn was needed.

---
phase: 96
slug: installation-record-backed-plugin-info
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-08
---

# Phase 96 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in runner, TS run natively) |
| **Config file** | package.json scripts (no separate config) |
| **Quick run command** | `node --test tests/orchestrators/plugin/info*.test.ts` |
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
| 96-01 T1 | 96-01 | 1 | BOUND-01 | T-96-02 | A failed manifest read licenses no membership claim, even with a live installation record | integration | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ | ✅ green |
| 96-01 T2 | 96-01 | 1 | INFO-09, INFO-10, INFO-11, BOUND-02 | T-96-01, T-96-03 | Component names come from `assertSafeName`-validated record data; reasons stay a closed set | integration | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts tests/orchestrators/plugin/info.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ✅ green |
| 96-01 T3 | 96-01 | 1 | INFO-09, INFO-10 | T-96-04 | The `error`→`info` severity change is documented, not silent | architecture | `node --test tests/architecture/catalog-uat.test.ts && npm run check` | ✅ | ✅ green |
| 96-02 T1 | 96-02 | 2 | INFO-11 | T-96-06, T-96-07 | `assertPathInside` runs before `readFile` on the state-supplied slug | integration | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ | ✅ green |
| 96-02 T2 | 96-02 | 2 | INFO-11 | T-96-06, T-96-08 | Traversal refused and every failure shape degrades to a marker without failing the block | integration | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ | ✅ green |
| 96-02 T3 | 96-02 | 2 | INFO-11 | T-96-09 | Rendered hook entries carry no free-form file content into a reason brace | architecture | `node --test tests/architecture/catalog-uat.test.ts && npm run check` | ✅ | ✅ green |
| 96-03 T1 | 96-03 | 3 | INFO-12 | T-96-11 | Zero clone/fetch/credential seam calls, asserted on injected doubles | integration | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ✅ green |
| 96-03 T2 | 96-03 | 3 | INFO-12 | T-96-12, T-96-14 | The skip note fires only for the state-only arm under `--fetch`; its brace is a closed-set literal | integration | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ✅ green |
| 96-03 T3 | 96-03 | 3 | INFO-09, INFO-12 | T-96-13 | The `(failed)` separation survives the fan-out severity change | architecture | `node --test tests/architecture/catalog-uat.test.ts && npm run check` | ✅ | ✅ green |
| 96-04 T1 | 96-04 | 4 | BOUND-01 | T-96-16, T-96-17 | A row never describes itself with a neighbouring record's manifest | integration | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ | ✅ green |
| 96-04 T2 | 96-04 | 4 | BOUND-01, BOUND-02 | T-96-18, T-96-19 | The wholesale suppression is pinned as contract; every prose closure has a test | integration | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts tests/orchestrators/plugin/info.test.ts && npm run check` | ✅ | ✅ green |

*Status: ✅ green · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

One MISSING reference, created inside plan 96-01 Task 2 before any assertion
depends on it:

- [x] `tests/orchestrators/plugin/info-manifest-absent.test.ts` — new orchestrator
      suite covering INFO-09, INFO-10, INFO-11 and INFO-12. Helpers (`makeCtx`,
      `withHermeticHome`, `seedPathMarketplace`, `fetchSeamWith`) are copied
      file-private per house convention, not imported.

Every other referenced suite already exists: `tests/orchestrators/plugin/info.test.ts`,
`tests/orchestrators/plugin/list-manifest-absent.test.ts`,
`tests/architecture/catalog-uat.test.ts`,
`tests/architecture/no-orchestrator-network.test.ts`,
`tests/architecture/notify-closed-set-locks.test.ts`.

No framework install is needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Two environment notes apply to
the full-suite runs rather than to any single behavior:

- `PI_SUBAGENTS_ROOT` must point at a pi-subagents install satisfying `>=0.35.0`
  (for example `~/.pi/agent/npm/node_modules/pi-subagents`). The stale global
  0.24.3 makes two unrelated integration tests fail locally; CI skips them.
- `grep` cannot read `orchestrators/plugin/info.ts` (a literal NUL byte at line
  416 makes grep classify it binary). Source-level checks over that file use
  `Read` or `readFile`, never `grep`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-09

## Validation Audit 2026-08-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All six phase requirements (INFO-09..12, BOUND-01/02) map to green automated
tests: `info-manifest-absent.test.ts` (30, incl. the INFO-12 zero-call cases
and the D-96-04 negative controls), `info.test.ts` + `list-manifest-absent.test.ts`
regression pins, `catalog-uat.test.ts` (8 catalog states incl.
`disabled-fetch-skipped` and `mixed-fetch-skipped`). Full `npm run check`
exit 0 confirmed by the Phase 96 verifier at HEAD `305988c2`.

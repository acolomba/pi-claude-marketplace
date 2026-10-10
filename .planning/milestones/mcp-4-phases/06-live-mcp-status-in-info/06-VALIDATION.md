---
phase: "6"
slug: "live-mcp-status-in-info"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-09"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` |
| **Config file** | none (npm scripts in `package.json`) |
| **Quick run command** | `node --test <owner test file>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run the owner test via `node --test <path>` (the commit hook runs `check:commit` for staged pairs)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | ASTAT-01 | T-06-01 | extension only subscribes; strict bus mock proves no publish | unit | `node --test tests/index.test.ts` | ✅ | ✅ green |
| 6-01-02 | 01 | 1 | ASTAT-01, ASTAT-02 | T-06-02..05 | malformed/newer/throwing payloads read as no snapshot; handler never throws | unit | `node --test tests/platform/mcp-status.test.ts tests/orchestrators/plugin/info-mcp-status.test.ts tests/shared/notification-grammar.test.ts tests/orchestrators/plugin/info.test.ts` | ✅ | ✅ green |
| 6-01-03 | 01 | 1 | ASTAT-02 | — | closed tokens locked with catalog states | architecture | `npm run test:architecture` | ✅ | ✅ green |
| 6-02-01 | 02 | 2 | ASTAT-01 | T-06-06..08 | project state read without writing; failed read = not overridden | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ | ✅ green |
| 6-02-02 | 02 | 2 | ASTAT-01, ASTAT-02 | — | override token locked with its catalog state | unit + coverage | `node --test tests/orchestrators/plugin/info-mcp-status.test.ts tests/orchestrators/plugin/info.test.ts` | ✅ | ✅ green |
| 6-03-01 | 03 | 3 | ASTAT-01 | — | adapter 5.1.0 channel/version reach info via Pi createEventBus | integration | `PI_MCP_ADAPTER_ROOT=… node --test tests/integration/mcp-status-conformance.test.ts` | ✅ | ✅ green |
| 6-03-02 | 03 | 3 | ASTAT-02 | — | shutdown snapshot reads as no snapshot; dist/types.d.ts drift guard | integration | `PI_MCP_ADAPTER_ROOT=… node --test tests/integration/mcp-status-conformance.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/platform/mcp-status.test.ts` — pairs the new tracker
- [x] `tests/integration/mcp-status-conformance.test.ts` — channel/version conformance with adapter 5.1.0 `dist/types.js`
- [x] default no-snapshot tracker wrapper in `tests/orchestrators/plugin/info.test.ts`

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live status in a real Pi session (deferred-session `status unknown`, status after first MCP use) | ASTAT-01, ASTAT-02 | Needs a live Pi + adapter session | Phase 7 live UAT |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 6s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-09 (full `npm run check` green on 03c50f3a)

## Validation Audit 2026-10-09

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

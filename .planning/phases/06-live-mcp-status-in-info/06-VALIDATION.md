---
phase: "6"
slug: "live-mcp-status-in-info"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| (filled by the planner and validate-phase) | | | ASTAT-01, ASTAT-02 | | | | see 06-RESEARCH.md Validation Architecture | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/platform/mcp-status.test.ts` — pairs the new tracker
- [ ] `tests/integration/mcp-status-conformance.test.ts` — channel/version conformance with adapter 5.1.0 `dist/types.js`
- [ ] default no-snapshot tracker wrapper in `tests/orchestrators/plugin/info.test.ts`

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live status in a real Pi session (deferred-session `status unknown`, status after first MCP use) | ASTAT-01, ASTAT-02 | Needs a live Pi + adapter session | Phase 7 live UAT |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 6s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

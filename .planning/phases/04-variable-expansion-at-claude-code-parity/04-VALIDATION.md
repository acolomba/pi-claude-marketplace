---
phase: "4"
slug: "variable-expansion-at-claude-code-parity"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-07"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 24 in CI) |
| **Config file** | none — scripts in `package.json` |
| **Quick run command** | `node --test <owner test file>` |
| **Full suite command** | `npm run check` |
| **Conformance command** | `PI_MCP_ADAPTER_ROOT=<scratch install>/node_modules/pi-mcp-adapter node --test --test-reporter=./scripts/test-reporter.mjs tests/integration/adapter-expansion-conformance.test.ts` |
| **Estimated runtime** | ~75 seconds (full check) |

---

## Sampling Rate

- **After every task commit:** Run the task's owner tests (`node --test <file>`); the pre-commit hook runs `npm run check:commit`.
- **After every plan wave:** Run `npm run check`.
- **Before `/gsd-verify-work`:** `npm run check` green, plus one recorded zero-skip conformance run (command, `# skipped 0`, adapter 5.1.0, Node version, commit) and a negative run with `PI_MCP_ADAPTER_ROOT=/nonexistent` that fails.
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled by the planner from the PLAN.md tasks. Requirement → test sources come from 04-RESEARCH.md "Validation Architecture".

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-TBD | TBD | TBD | AVAR-01..05 | T-04-NN | see plans | unit / integration | see plans | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/pi-mcp-adapter-peer.ts` (or a generalized optional-peer helper): env-var-only lookup, floor read from `package.json`
- [ ] `tests/integration/adapter-expansion-conformance.test.ts`: case table, bounded-exhaustive property, call-site drift guard
- [ ] Shared case-table module under `tests/`, consumed by the unit goldens and the conformance test
- [ ] Paired unit tests for the new domain/bridge modules (deny-list snapshot, variable rule, adapter escape), 100% direct coverage
- [ ] CI: scratch install of the pinned adapter in the `integration` job, `PI_MCP_ADAPTER_ROOT` in the test step env (D-04-18)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live adapter loads the written entries | AVAR-01..05 | Needs a real Pi session with adapter 5.x | Covered by Phase 7 live UAT (ADOC-02) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

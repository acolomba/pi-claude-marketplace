---
phase: 88
slug: agent-settled-dispatcher-stop-contract-stopfailure
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 88 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in runner, TS via native strip) |
| **Config file** | package.json `scripts.test` |
| **Quick run command** | `node --test tests/bridges/hooks/hooks-dispatch.test.ts tests/bridges/hooks/dispatch-exec.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~60 seconds (full check) |

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
| (filled by planner) | | | | | | | | | ⬜ pending |

---

## Wave 0 Requirements

Dev-tree refresh (D-88-04): `npm install` materializing the locked
pi-coding-agent 0.82.1 so `agent_settled` typings exist — first task, before
any subscription code.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live-Pi abort/queue/canary UAT items (D-88-03b) | STOP-01, STOP-07 | Real Pi >= 0.80.5 runtime behavior (agent_settled on abort paths, queued-message settle timing, 8-block cap end-to-end) | Scripted live session per plan; unscripted residue lands as human_needed verification items |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 82
slug: agent-skill-preload-fidelity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node built-in runner, TS via native strip) |
| **Config file** | package.json `scripts.test` (glob-based, no separate config) |
| **Quick run command** | `node --test "tests/bridges/**/*.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + lint + format + unit + integration) |
| **Estimated runtime** | quick ~10s; full ~90s |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/bridges/**/*.test.ts"`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | AGSK-01..04 | — | — | unit | `node --test "tests/bridges/**/*.test.ts"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Byte-identity regression corpus: pin current generated-agent output for representative non-target agents (CSV `skills:`, inline-array `skills:`, no `skills:`) against unmodified HEAD before any converter change (per 82-RESEARCH.md Pitfall 5)

*Existing node:test infrastructure covers all phase requirements; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 61
slug: if-field-permission-rule-matcher
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, ESM-strip via Node ≥22.18 or `tsx` loader) |
| **Config file** | none (node:test discovers test files via glob) |
| **Quick run command** | `node --test --import tsx tests/architecture/hooks-if-field.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds (single file); ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `node --test --import tsx tests/architecture/hooks-if-field.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 61-01-01 | 01 | 1 | MATCH-03 §1 | — | N/A | unit | `node --test --import tsx tests/architecture/hooks-if-field.test.ts -t 'bash subcommand'` | ❌ W0 | ⬜ pending |

*Planner fills the full per-task map at plan time. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/hooks-if-field.test.ts` — stubs for MATCH-03 §1-5 + D-61-01..04
- [ ] No new framework install — node:test is built-in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (architecture-test fixtures pin every upstream truth-table row).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

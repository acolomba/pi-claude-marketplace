---
phase: 82
slug: agent-skill-preload-fidelity
status: planned
nyquist_compliant: true
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
| 82-01 T1 | 82-01 | 1 | AGSK-01/04 (byte-identity) | T-82-01 | capture at pre-fix HEAD only | scratch capture | `node <scratchpad>/capture-byte-identity.ts` | n/a (scratch) | ⬜ pending |
| 82-01 T2 | 82-01 | 1 | AGSK-01/04 (byte-identity) | T-82-01 | seven full-fileContent exact pins | unit | `node --test tests/bridges/agents/convert-byte-identity.test.ts` | ❌ Wave 0 creates | ⬜ pending |
| 82-02 T1 | 82-02 | 2 | AGSK-01 | T-82-03/04 | dash items never colon-split; fold into allowlisted downstream validation | unit | `node --test tests/bridges/agents/frontmatter.test.ts` | ✅ extend | ⬜ pending |
| 82-02 T2 | 82-02 | 2 | AGSK-01 (D-82-02/03 docs) | — | no YAML dep introduced | unit + grep | `npm run check` | ✅ | ⬜ pending |
| 82-03 T1 | 82-03 | 2 | AGSK-02 | T-82-06/07/08 | warn-drop never throws; sanitizeProvenance holds for `-->` tokens | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ extend | ⬜ pending |
| 82-03 T2 | 82-03 | 2 | AGSK-03 | — | D-82-09 exact string; non-Skill drops stay silent | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ extend | ⬜ pending |
| 82-04 T1 | 82-04 | 3 | AGSK-04 | T-82-13 | no-legend emit byte-identical | unit | `node --test tests/bridges/agents/frontmatter.test.ts` | ✅ extend | ⬜ pending |
| 82-04 T2 | 82-04 | 3 | AGSK-04 | T-82-10/11/12 | constrained token class + knownSkills allowlist; escaped plugin name in regex | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ extend | ⬜ pending |
| 82-04 T3 | 82-04 | 3 | AGSK-01..04 (SC-1..5 e2e) | T-82-01 | corpus untouched through whole phase | unit | `node --test tests/bridges/agents/convert.test.ts && npm run check` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Byte-identity regression corpus: pin current generated-agent output for representative non-target agents (CSV `skills:`, inline-array `skills:`, no `skills:`) against unmodified HEAD before any converter change (per 82-RESEARCH.md Pitfall 5) — **plan 82-01 (Wave 1) creates `tests/bridges/agents/convert-byte-identity.test.ts` before any implementation wave runs**

*Existing node:test infrastructure covers all phase requirements; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (corpus file is the only MISSING reference; plan 82-01 creates it in Wave 1 before all implementation plans)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (execution)

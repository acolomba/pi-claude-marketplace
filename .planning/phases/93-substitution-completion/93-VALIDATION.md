---
phase: 93
slug: substitution-completion
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-03
validated: 2026-08-03
---

# Phase 93 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, TS via native type stripping) |
| **Config file** | package.json `test` script |
| **Quick run command** | `node --test tests/shared/vars.test.ts tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts tests/bridges/agents/convert.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60 seconds full check; ~5 seconds targeted files |

---

## Sampling Rate

- **After every task commit:** Run the targeted test files for the touched surfaces
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 93-01 | 1 | SUB-01, SUB-02 | T-93-01, T-93-02 | single-pass no re-expansion; absent field → literal pass-through; scope-gated projectDir | unit (end-to-end bridge) | `node --test tests/bridges/skills/stage.test.ts` | ✅ existing extended | ✅ green |
| 01-T2 | 93-01 | 1 | SUB-01, SUB-02 | T-93-01, T-93-02 | prohibitions: no empty-string sub, no re-expansion, unknown-token pass-through | unit | `node --test tests/shared/vars.test.ts` | ✅ existing extended | ✅ green |
| 02-T1 | 93-02 | 2 | SUB-02 | T-93-04 | commands: scope-gated projectDir; ${CLAUDE_SKILL_DIR} stays literal | unit | `node --test tests/bridges/commands/stage.test.ts` | ✅ existing extended | ✅ green |
| 02-T2 | 93-02 | 2 | SUB-02 | T-93-04 | agents: scope-gated projectDir via convertAgent; ${CLAUDE_SKILL_DIR} stays literal | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ existing extended | ✅ green |
| 02-T3 | 93-02 | 2 | SUB-02 | T-93-05 | orchestrator cwd threading delivers projectDir end-to-end (project scope) | integration | `node --test tests/orchestrators/plugin/install.test.ts` then `npm run check` | ✅ existing extended | ✅ green |
| 02-T3+ | 93-02 | 2 | SUB-02 | T-93-05 | review-fix guard: reinstall/update orchestrators deliver projectDir end-to-end (project scope; user scope literal) | integration | `node --test tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/update.test.ts` | ✅ added by WR-01 fix | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — vars and per-bridge stage/convert test files exist; new tests extend them.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

All phase behaviors have automated verification — materialized file content is fully assertable in unit tests.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infrastructure)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-03

---

## Validation Audit 2026-08-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All six mapped verifications ran green this session (verifier re-ran the five
plan commands directly: 234 + 148 pass; full `npm test` 3227 pass / 0 fail
after the last code change). The WR-01 review fix extended T-93-05 end-to-end
coverage from install to the reinstall and update orchestrators.

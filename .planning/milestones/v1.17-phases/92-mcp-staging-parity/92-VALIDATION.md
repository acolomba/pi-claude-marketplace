---
phase: 92
slug: mcp-staging-parity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-03
---

# Phase 92 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, TS via native type stripping) |
| **Config file** | package.json `test` script |
| **Quick run command** | `node --test tests/bridges/mcp/*.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~60 seconds full check; ~3 seconds targeted files |

---

## Sampling Rate

- **After every task commit:** Run the targeted MCP bridge test files
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 92-01-T1 | 01 | 1 | MENV-01 | T-92-01..04 | substitution into JSON value slot only; marker stamped after walk; keys never substituted; single-pass no re-expansion | tracer (e2e unit) | `node --test tests/bridges/mcp/stage.test.ts && npm run typecheck` | ✅ (stage.test.ts extended) | ✅ green |
| 92-01-T2 | 01 | 1 | MENV-01 | T-92-02, T-92-03 | keys immutable; marker isolation; unknown-var pass-through; literal `$` insertion | unit | `node --test tests/bridges/mcp/substitute.test.ts` | ✅ (new substitute.test.ts) | ✅ green |
| 92-02-T1 | 02 | 2 | MENV-02 | T-92-05 | injection stdio-only; declared-wins; url-type never env-injected | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (stage.test.ts extended) | ✅ green |
| 92-02-T2 | 02 | 2 | MENV-03 | T-92-06 | project bakes cwd; user-scope absence (token pass-through, no key) | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (stage.test.ts extended) | ✅ green |
| 92-02-T3 | 02 | 2 | MENV-04 | T-92-07, T-92-08 | no stale path after root change; idempotent; theirs verbatim; NFR-1/NFR-10 hold | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (stage.test.ts extended) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — the MCP bridge test suite exists under `tests/bridges/mcp/` with staging fixtures; new tests extend it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

All phase behaviors have automated verification — staged `mcp.json` content is fully assertable in unit tests (substitution, injection, precedence, re-derivation).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infrastructure)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-03

## Validation Audit 2026-08-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All five task rows COVERED and green: MENV-01 via `tests/bridges/mcp/substitute.test.ts` + `stage.test.ts` tracer (48 pass), MENV-02/03/04 via the stage suite arms, plus the review-fix regression tests (`safeSet` sites incl. `unstage.test.ts`, 8 pass). Full unit suite 3210 pass at phase seal; `npm run check` exit 0.

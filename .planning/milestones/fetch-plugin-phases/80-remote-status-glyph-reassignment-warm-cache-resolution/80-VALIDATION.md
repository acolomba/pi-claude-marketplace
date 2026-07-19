---
phase: 80
slug: remote-status-glyph-reassignment-warm-cache-resolution
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-14
---

# Phase 80 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node >= 20.19.0) |
| **Config file** | package.json test script |
| **Quick run command** | `node --test tests/<touched-area>/*.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~60 seconds full check |

---

## Sampling Rate

- **After every task commit:** Run the touched-area quick command
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 80-01-01 | 01 | 1 | RSTA-01, RSTA-02 | — | N/A | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/notify-grammar-invariant.test.ts tests/architecture/catalog-uat.test.ts` | ✅ | ⬜ pending |
| 80-02-01 | 02 | 2 | RSTA-01, RSTA-05, RSTA-06 | — | N/A | unit | `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | ✅ | ⬜ pending |
| 80-02-02 | 02 | 2 | RSTA-03 | — | N/A | unit + typecheck | `npm run typecheck && node --test tests/orchestrators/edge-deps.test.ts` | ✅ | ⬜ pending |
| 80-03-01 | 03 | 3 | RSTA-01, RSTA-07 | — | N/A | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ | ⬜ pending |
| 80-03-02 | 03 | 3 | RSTA-03 | — | N/A | unit + typecheck | `node --test tests/orchestrators/edge-deps.test.ts && npm run typecheck` | ✅ | ⬜ pending |
| 80-04-01 | 04 | 3 | RSTA-04, RSTA-05 | — | N/A | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ | ⬜ pending |
| 80-04-02 | 04 | 3 | RSTA-04, RSTA-06 | — | N/A | unit + typecheck | `node --test tests/orchestrators/plugin/info.test.ts && npm run typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/plugin/git-source-probe.test.ts` — three assertions intentionally invert (cold git sources: old `(available)` → `remote`); not a regression
- [ ] Closed-set tripwire tests (`notify-closed-set-locks` tuple lengths 23→24 / 18→19; `notify-grammar-invariant` glyph regexes) update in the SAME commit as the tuple amendment — the lockstep discipline is the test
- [ ] Catalog-UAT byte-equality fixtures regenerate with the new `(remote)` rows and `◍` disabled forms

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `◍` glyph rendering in operator terminal | RSTA-02 | Font-dependent | ALREADY CLEARED — operator verified 2026-07-13 at discuss (D-80-01); no runtime re-check needed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all test scaffolds exist)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-14

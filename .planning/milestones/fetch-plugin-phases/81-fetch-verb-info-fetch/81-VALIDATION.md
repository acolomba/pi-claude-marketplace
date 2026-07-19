---
phase: 81
slug: fetch-verb-info-fetch
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-14
---

# Phase 81 — Validation Strategy

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
| 81-01-01 | 01 | 1 | FTCH-02 | T-81-SC | no new deps | typecheck | `npx tsc --noEmit -p extensions/pi-claude-marketplace/tsconfig.json` | ✅ | ⬜ pending |
| 81-03-01 | 03 | 1 | FTCH-03 | T-81-SC | info never fails | unit (RED) | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ | ⬜ pending |
| 81-03-02 | 03 | 1 | FTCH-03, FTCH-04, FTCH-06 | T-81-SC | git-surface grep gate = 0 | unit (GREEN) + gate | `node --test tests/orchestrators/plugin/info.test.ts` + grep gate | ✅ | ⬜ pending |
| 81-02-01 | 02 | 2 | FTCH-01, FTCH-02 | T-81-SC | — | unit (RED) | `node --test tests/orchestrators/plugin/fetch.test.ts` | ⬜ W0 | ⬜ pending |
| 81-02-02 | 02 | 2 | FTCH-01, FTCH-02, FTCH-04, FTCH-06, FTCH-07 | T-81-SC | git-surface grep gate = 0 | unit (GREEN) + gate | `node --test tests/orchestrators/plugin/fetch.test.ts` + grep gate | ⬜ W0 | ⬜ pending |
| 81-04-01 | 04 | 3 | FTCH-01, FTCH-07 | T-81-SC | fetch.ts in FORBIDDEN_TARGETS | unit (RED) + arch | `node --test tests/architecture/no-orchestrator-network.test.ts tests/edge/handlers/plugin/fetch.test.ts` | ⬜ W0 | ⬜ pending |
| 81-04-02 | 04 | 3 | FTCH-01, FTCH-07 | T-81-SC | — | unit (GREEN) | `node --test tests/edge/handlers/plugin/fetch.test.ts tests/edge/completions/provider.test.ts` | ⬜ W0 | ⬜ pending |
| 81-05-01 | 05 | 3 | FTCH-01 | T-81-SC | — | architecture | `node --test tests/architecture/catalog-uat.test.ts` + pi-only doc grep | ✅ | ⬜ pending |
| 81-05-02 | 05 | 3 | FTCH-05 | T-81-SC | GC verify-only | unit | `node --test tests/orchestrators/plugin/clone-gc.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New `tests/orchestrators/plugin/fetch.test.ts` — verb tests (single/bulk shapes, no-op rows, failure-tolerant sweep)
- [ ] `tests/architecture/no-orchestrator-network.test.ts` — `fetch.ts` ADDED to FORBIDDEN_TARGETS (install-style seam injection)
- [ ] Catalog-UAT fixtures — new fetch verb rows land with the catalog section in the same commit

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live fetch against a real remote | FTCH-04/06 | Network-dependent; CI stays offline | `fetch <plugin>@<mp>` on a real git-source marketplace; re-run to confirm no-op/refresh semantics |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (fetch.test.ts / edge fetch tests created by their TDD RED tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-14

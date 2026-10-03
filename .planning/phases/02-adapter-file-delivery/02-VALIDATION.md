---
phase: "02"
slug: "adapter-file-delivery"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-02"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (Node v26) |
| **Config file** | none — scripts in `package.json` (`test`, `test:modules`, `test:architecture`, `test:integration`, `test:coverage:direct`) |
| **Quick run command** | `node --test tests/bridges/mcp/*.test.ts tests/persistence/locations.test.ts tests/orchestrators/plugin/prune-rollback.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~4 seconds; full ~20-30 minutes |

---

## Sampling Rate

- **After every task commit:** Run the owner test files with `node --test` (pre-commit runs `check:changed` and selected direct coverage)
- **After every plan wave:** Run `npm run test:modules && npm run test:architecture`
- **Before `/gsd-verify-work`:** `npm run check` green; `npm run test:e2e` once
- **Max feedback latency:** 60 seconds for the quick command

---

## Per-Task Verification Map

Filled by the planner per task. Requirement → test map (from 02-RESEARCH.md § Validation Architecture):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| AFILE-01 | `locationsFor` exposes `mcpAdapterJsonPath` per scope | unit | `node --test tests/persistence/locations.test.ts` | ✅ extend | ⬜ pending |
| AFILE-01 | Stage writes `mcp-adapter.json`; unstage removes exactly marked entries (both keys), keeps stubs (D-02-07), no rewrite when nothing matched | unit | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts` | ✅ retarget | ⬜ pending |
| AFILE-01 | Prune snapshot/rollback cover the new file | unit | `node --test tests/orchestrators/plugin/prune-rollback.test.ts` | ✅ extend | ⬜ pending |
| AFILE-01 | Install → uninstall round trip; architecture gates name the new file | orchestrator / architecture | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/uninstall.test.ts && npm run test:architecture` | ✅ retarget | ⬜ pending |
| AFILE-02 | JSONC corpus (BOM, comments, trailing commas, CRLF, comment tokens in strings) parses; differential check against `strip-json-comments` | unit | `node --test tests/bridges/mcp/adapter-doc.test.ts` | ❌ W0 | ⬜ pending |
| AFILE-02 | Unparseable file → typed error, bytes unchanged, no secret text in the message chain; foreign keys survive a write | unit | `node --test tests/bridges/mcp/adapter-doc.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts tests/shared/errors-bridges.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| AFILE-03 | `mcp-servers`-only file keeps the key; both keys → `mcpServers` | unit | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts` | ✅ new cases | ⬜ pending |
| AFILE-04 | Structured notice only on a real rewrite of a commented file; every routed verb notifies with the exact catalog text at warning severity; catalog byte-lock | unit / orchestrator / architecture | `node --test tests/bridges/mcp/stage.test.ts tests/orchestrators/plugin/install-flow.test.ts` (+ per routed verb, + byte-lock test) | ❌ W0 / ✅ | ⬜ pending |
| AFILE-05 | Nine sources, later-wins attribution, overlays never declare, legacy and cross-scope self-exemption (D-02-12, D-02-13) | unit (hermetic HOME) | `node --test tests/bridges/mcp/collision-slots.test.ts tests/bridges/mcp/stage.test.ts` | ✅ rewrite | ⬜ pending |
| AFILE-06 | 35-key vendored `ServerEntry` whole-entry compare; `disabled: true` survives update and reinstall | unit / orchestrator | `node --test tests/bridges/mcp/adapter-entry.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install strip-json-comments@^5.0.3` (lockfile committed, D-02-08)
- [ ] `tests/bridges/mcp/adapter-doc.test.ts` — AFILE-02/03 parsing and key selection
- [ ] `tests/bridges/mcp/adapter-entry.test.ts` — AFILE-06 (vendored 35-key list with provenance comment)
- [ ] Byte-lock test for the AFILE-04 catalog line (any production path it names registered in `tests/architecture/gate-targets.ts` as a full literal, D-07-05/D-07-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real pi-mcp-adapter 5 loads our entries from `mcp-adapter.json` after `/reload` | AFILE-01..06 | Needs a live Pi + adapter install; covered by Phase 7 live proof | Phase 7 live UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

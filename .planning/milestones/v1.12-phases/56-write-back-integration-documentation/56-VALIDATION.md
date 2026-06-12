---
phase: 56
slug: write-back-integration-documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node `>=20.19.0`) |
| **Config file** | none — npm scripts invoke `node --test` |
| **Quick run command** | `npm test -- tests/orchestrators/<changed>.test.ts` (per-file) |
| **Full suite command** | `npm run check` (typecheck + lint + format + tests + integration) |
| **Estimated runtime** | ~10 seconds (quick) / ~80 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <changed test files>`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green (baseline ≥1709 unit + 10 integration from Phase 55 close)
- **Max feedback latency:** 80 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | WB-01 | T-merged-view-serialization | each mutating command writes a targeted entry patch (base re-read under lock) | unit | `npm test -- tests/orchestrators/marketplace/{add,remove,autoupdate}.test.ts tests/orchestrators/plugin/{install,uninstall,reinstall,update}.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | WB-01 SC#4 | T-unknown-key-loss | round-trip integrity: unknown keys preserved + post-command reconcile no-op | architecture | `npm test -- tests/architecture/config-state-consistency.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WB-02 | T-base-contamination | `--local` targets local file; base file never touched | unit | per-orchestrator tests with `local: true` variants | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | WB-02 | — | edge handlers parse `--local` order-insensitively and forward | unit | `npm test -- tests/edge/handlers/{marketplace,plugin}/*.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | WB-03 | T-n-rewrites | import writes ONE batched multi-entry patch under one lock | unit | `npm test -- tests/orchestrators/import/execute.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | WB-04 | — | bootstrap records marketplace + autoupdate into config | unit | `npm test -- tests/orchestrators/plugin/bootstrap.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CFG-04 | — | README documents config workflow + `.local` gitignore convention | manual + lint | manual review; markdown checks in `npm run check` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | SPLIT-02 | T-write-seam-widening | no new `atomicWriteJson(configJsonPath)` callsites outside allow-list | architecture | `npm test -- tests/architecture/config-state-write-seams.test.ts` | ✅ verify | ⬜ pending |
| TBD | TBD | TBD | SPLIT-01 | T-stale-display | the 7 `// SPLIT-01:` autoupdate cast-read sites rewired (or gated) | architecture | `npm test -- tests/architecture/no-split-01-cast-reads.test.ts` (new) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/config-state-consistency.test.ts` — WB-01 SC#4 round-trip + reconcile no-op
- [ ] `tests/architecture/no-split-01-cast-reads.test.ts` — SPLIT-01 rewire completion gate
- [ ] Per-orchestrator `local: true` fixture variants — extend existing test files

Framework install: none — `node:test` is built-in.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README config-workflow section reads correctly and names the right files | CFG-04 | prose quality | Read the new README section; confirm it says commit `claude-plugins.json`, keep `claude-plugins.local.json` local (gitignore) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 80s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

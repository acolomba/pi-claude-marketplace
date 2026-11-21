---
phase: "3"
slug: "marketplace-layers-and-cross-scope-install"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the trimmed integration file |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/<function>/<file>.feature` (6-13 s per file), with the non-DAC environment of `02-CONTEXT.md` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds per focused run; the full check is far longer (2,400-second limit) |

---

## Sampling Rate

- **After every task commit:** the touched feature files under adapter, plus `npm run check:static` by hand in a worktree
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled by the planner from `02-RESEARCH.md` "Phase Requirements → Test Map".

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-* | 01 | 1 | ITMIG-05 | — | N/A | behavioral | `features/marketplace/autoupdate.feature` under adapter | ✅ | ⬜ pending |
| 3-02-* | 02 | 1 | ITMIG-05 | — | N/A | behavioral + integration | `features/marketplace/remove.feature`; trimmed `marketplace-layer-remove.test.ts` | ✅ | ⬜ pending |
| 3-03-* | 03 | 1 | ITMIG-05 | — | N/A | behavioral + unit | `features/marketplace/url-source.feature`; direct coverage of `clone-cache.ts` (seeding fix) | ✅ | ⬜ pending |
| 3-04-* | 04 | 1 | ITMIG-06 | — | N/A | behavioral | `features/plugin/cross-scope-install.feature` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Six new steps land in the plans that use them (each plan owns its shared module); no separate wave.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Each deliberate break is a reverted experiment whose command and failing scenario the plan's SUMMARY.md records.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

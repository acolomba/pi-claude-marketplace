---
phase: "5"
slug: "mcp-install-legacy-move-and-overrides"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the trimmed integration file |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/prune.feature` (6-10 s), with the non-DAC environment of `04-CONTEXT.md` |
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

Filled by the planner from `04-RESEARCH.md` "Phase Requirements → Test Map" and the two plans.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-* | 01 | 1 | ITMIG-09 | — | secret value never written to `mcp-adapter.json`; deny-listed credential withheld | behavioral | `features/mcp-server/configuration.feature`, `options.feature` under adapter and builtin | ✅ | ⬜ pending |
| 5-02-* | 02 | 1 | ITMIG-10 | — | user servers kept | behavioral + integration | `features/mcp-server/legacy-move.feature`, `verdict-list.feature` under adapter and builtin; trimmed `mcp-migration`, `mcp-verdict-migration`, `mcp-verdict-list` | ✅ | ⬜ pending |
| 5-03-* | 03 | 1 | ITMIG-11 | — | N/A | behavioral | `features/mcp-server/lifecycle.feature` under adapter and builtin | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Five new steps land in the plans that use them, one shared module per plan: 05-01 `mcp-implementation.steps.ts`; 05-02 `session.steps.ts` and `legacy-move.steps.ts`; 05-03 `lifecycle.steps.ts`. No separate wave.

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

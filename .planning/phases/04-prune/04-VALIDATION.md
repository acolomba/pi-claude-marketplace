---
phase: "4"
slug: "prune"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the trimmed integration file |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile adapter --parallel 1 features/<function>/<file>.feature` (6-16 s per file), with the non-DAC environment of `03-CONTEXT.md` |
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

Filled by the planner from `03-RESEARCH.md` "Phase Requirements → Test Map" and the four plans.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-* | 01 | 1 | ITMIG-08 | — | malformed state reported without its path | behavioral + integration | `features/plugin/prune.feature` under adapter; trimmed `standalone-prune.test.ts` | ✅ feature; ❌ `plugin/prune.steps.ts` (created) | ⬜ pending |
| 4-02-* | 02 | 2 | ITMIG-08 | — | N/A | behavioral + unit | `features/plugin/prune.feature` (no backup left); direct coverage of `prune-rollback.ts` (env -i) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 04-01 creates `features/step_definitions/plugin/prune.steps.ts` with three new steps; plan 04-02 adds the fourth (`the prune has left no backup in the {word} scope`) with the backup fix. No separate wave.

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

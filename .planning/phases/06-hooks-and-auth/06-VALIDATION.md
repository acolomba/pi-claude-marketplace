---
phase: "6"
slug: "hooks-and-auth"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the trimmed integration files |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `flock -w 3600 "$S/phase05-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile <adapter\|builtin> --parallel 1 <the plan's feature files>`, `$S` being the shared scratchpad of the plans' execution rules |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | 20 to 80 seconds per focused run at `--parallel 1`, more while the lock is held; the full check is far longer (2,400-second limit) |

---

## Sampling Rate

- **After every task commit:** the plan's feature files under both profiles, plus `npm run check:static` by hand in a worktree
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 120 seconds for a focused run without lock waits

---

## Per-Task Verification Map

Filled by the planner from `05-RESEARCH.md` "Phase Requirements → Test Map" and the three plans. Each plan's "Red-proof tables" section holds the break runs and the scenarios each must fail; `check-red.mjs` (`$S/plan-05/inputs/`) checks them.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-* | 01 | 1 | ITMIG-12 | — | N/A | behavioral + integration | `features/hook/{lifecycle,session,additional-context}.feature` under adapter; repeated full adapter runs (flake fixes); trimmed `hooks-dispatch-end-to-end` | ✅ | ⬜ pending |
| 6-02-* | 02 | 1 | ITMIG-13 | — | credential evicted on rejection; print-mode refusal leaves no staged clone | behavioral + integration | `features/marketplace/device-flow.feature` under adapter; trimmed `auth-e2e` | ✅ (new `features/lib/pi-one-shot.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

06-01 adds `Then the project directory is empty` to `project.steps.ts` and fixes two harness races; 06-02 adds the print-mode driver `features/lib/pi-one-shot.ts` and three print-mode steps in `command.steps.ts`. No separate wave.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Each deliberate break is a reverted experiment whose command and failing scenario the plan's SUMMARY.md records.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

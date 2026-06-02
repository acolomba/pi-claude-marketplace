---
phase: 39
slug: cascade-ghost-record
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 39 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, via `tsx`) |
| **Config file** | none -- uses `npm run check` script in `package.json` |
| **Quick run command** | `npm run test -- tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/marketplace/remove.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~18 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the relevant test file
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5s single-file / ~18s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | TR-03 | -- | uninstall.ts filters sRecord.resources.* by outcome.dropped.* on non-AG-5 partial; AG-5 preserves row | unit | `npm run test -- tests/orchestrators/plugin/uninstall.test.ts` | ✅ | ⬜ pending |
| 39-01-02 | 01 | 1 | TR-03 | -- | remove.ts per-plugin loop applies same filter; AG-5 preserves row | unit | `npm run test -- tests/orchestrators/marketplace/remove.test.ts` | ✅ | ⬜ pending |
| 39-01-03 | 01 | 1 | TR-03 | -- | cascade primitive (cascadeUnstagePlugin) makes no state mutation; outcome.dropped frozen | unit | `npm run test -- tests/orchestrators/marketplace/shared.test.ts tests/orchestrators/plugin/uninstall.test.ts` | ✅ | ⬜ pending |
| 39-01-04 | 01 | 1 | TR-03 | -- | field-name mapping correctness: dropped.commands -> resources.prompts | unit | `grep -nE "dropped\\.commands.*prompts" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | ✅ | ⬜ pending |
| 39-01-05 | 01 | 1 | -- | -- | full check passes, no regression from 1358 baseline | integration | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Both target test files
already exist with the cascade-injection seam pattern.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

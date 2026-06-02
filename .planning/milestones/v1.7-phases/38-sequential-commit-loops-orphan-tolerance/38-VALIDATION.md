---
phase: 38
slug: sequential-commit-loops-orphan-tolerance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 38 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, via `tsx`) |
| **Config file** | none -- uses `npm run check` script in `package.json` |
| **Quick run command** | `npm run test -- tests/bridges/agents/stage.test.ts tests/bridges/commands/stage.test.ts tests/shared/fs-utils.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~18 seconds full suite (per existing CI baseline) |

---

## Sampling Rate

- **After every task commit:** Run the relevant bridge or shared test file
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds (single-file test) / ~18 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | TR-06 | -- | removeOrphanIfPresent kind-strict matrix (file/tree/mismatched/ENOENT) | unit | `npm run test -- tests/shared/fs-utils.test.ts` | ✅ | ⬜ pending |
| 38-01-02 | 01 | 1 | TR-01 | -- | commitPreparedAgents sequential rollback on rename throw | unit | `npm run test -- tests/bridges/agents/stage.test.ts` | ✅ | ⬜ pending |
| 38-01-03 | 01 | 1 | TR-05 | -- | commitPreparedCommands sequential rollback on rename throw | unit | `npm run test -- tests/bridges/commands/stage.test.ts` | ✅ | ⬜ pending |
| 38-01-04 | 01 | 1 | TR-06 | -- | replacePrepared* helpers pre-remove owned orphans via helper; PI-6 foreign-content guard intact | unit | `npm run test -- tests/bridges/skills/stage.test.ts tests/bridges/agents/stage.test.ts tests/bridges/commands/stage.test.ts` | ✅ | ⬜ pending |
| 38-01-05 | 01 | 1 | TR-01,TR-05,TR-06 | -- | PUP-6 phase-3 failure path unchanged; PI-6 collision rejection unchanged | integration | `npm run test -- tests/orchestrators/plugin/update.test.ts tests/bridges/skills/stage.test.ts` | ✅ | ⬜ pending |
| 38-01-06 | 01 | 1 | -- | -- | full check passes, no regression | integration | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* All four target test files
already exist; `removeOrphanIfPresent` cases are appended to `tests/shared/fs-utils.test.ts`.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A -- no Wave 0 required)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

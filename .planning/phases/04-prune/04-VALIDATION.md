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
| 4-01-01 | 01 | 1 | ITMIG-08 | T-04-01, T-04-02 | breaks restored, never committed; helper runs in its own checkout | behavioral + integration + static | adapter `features/plugin/prune.feature` (`13 scenarios (13 passed)`); K8 fails S01; `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-reporter=spec test/integration/standalone-prune.test.ts` (`tests 24`, `pass 24`); `check:static` | ✅ feature; ❌ `plugin/prune.steps.ts` (created) | ⬜ pending |
| 4-01-02 | 01 | 1 | ITMIG-08 | T-04-04 | a malformed state file is reported with its cause redacted and no absolute sandbox path (M01) | behavioral + static | adapter `prune.feature` (`40 scenarios (40 passed)`); builtin (`0 scenarios`); `check:static` | ✅ | ⬜ pending |
| 4-01-03 | 01 | 1 | ITMIG-08 | T-04-01, T-04-03, T-04-05 | a red run counts only on an assertion; the trim follows every red proof | behavioral + integration + static | K1 to K29 over `prune.feature`, `state-lock.feature`, and `usage-errors.feature` (`171 scenarios`), each failing its scenarios and Outline rows, K2 passing as the accepted survivor; `standalone-prune.test.ts` (`tests 2`, `pass 2`); `check:static`; `fallow audit` (only `weakened-tests`) | ✅ | ⬜ pending |
| 4-02-01 | 02 | 2 | ITMIG-08 | T-04-07, T-04-08, T-04-09, T-04-11 | the permission walk never follows a symlink or touches a backup kept for recovery; the snapshot refusal is never hidden | unit + behavioral + static | before the fix: adapter `prune.feature` (`41 scenarios (40 passed, 1 failed)`) and `--test-name-pattern "read-only directory"` (`fail 3`); against the unguarded helper `--test-name-pattern "absent backup root"` (`fail 1`); after it: the unit file through `nondac-sh` (`tests 48`, `pass 48`), `env -i ... npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`, adapter `prune.feature` (`41 scenarios (41 passed)`), `check:static` | ✅ | ⬜ pending |
| 4-02-02 | 02 | 2 | ITMIG-08 | T-04-10 | B1 restored, never committed | behavioral + static | B1 fails F03 alone (`41 scenarios (40 passed, 1 failed)`); builtin (`0 scenarios`); `fallow audit` (no finding) | ✅ | ⬜ pending |

Every cucumber run passes `--profile <name> --parallel 2` with the non-DAC prefix of `04-CONTEXT.md`; the two plans run in different waves, one executor at a time, so no lock file is needed. The unit file of `prune-rollback.ts` runs through `nondac-sh`, because its read-only cases need a mode that denies, and direct coverage also runs under `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp` (STATE.md).

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

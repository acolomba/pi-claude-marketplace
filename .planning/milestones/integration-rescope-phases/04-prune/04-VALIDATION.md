---
phase: "4"
slug: "prune"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 4-01-01 | 01 | 1 | ITMIG-08 | T-04-01, T-04-02 | breaks restored, never committed; helper runs in its own checkout | behavioral + integration + static | adapter `features/plugin/prune.feature` (`13 scenarios (13 passed)`); K8 fails S01; `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-reporter=spec test/integration/standalone-prune.test.ts` (`tests 24`, `pass 24`); `check:static` | ✅ feature; ✅ `features/step_definitions/plugin/prune.steps.ts` | ✅ green |
| 4-01-02 | 01 | 1 | ITMIG-08 | T-04-04 | a malformed state file is reported with its cause redacted and no absolute sandbox path (M01) | behavioral + static | adapter `prune.feature` (`40 scenarios (40 passed)`); builtin (`0 scenarios`); `check:static` | ✅ | ✅ green |
| 4-01-03 | 01 | 1 | ITMIG-08 | T-04-01, T-04-03, T-04-05 | a red run counts only on an assertion; the trim follows every red proof | behavioral + integration + static | K1 to K29 over `prune.feature`, `state-lock.feature`, and `usage-errors.feature` (`171 scenarios`), each failing its scenarios and Outline rows, K2 passing as the accepted survivor; `standalone-prune.test.ts` (`tests 2`, `pass 2`); `check:static`; `fallow audit` (only `weakened-tests`) | ✅ | ✅ green |
| 4-02-01 | 02 | 2 | ITMIG-08 | T-04-07, T-04-08, T-04-09, T-04-11 | the permission walk never follows a symlink or touches a backup kept for recovery; the snapshot refusal is never hidden | unit + behavioral + static | before the fix: adapter `prune.feature` (`41 scenarios (40 passed, 1 failed)`) and `--test-name-pattern "read-only directory"` (`fail 3`); against the unguarded helper `--test-name-pattern "absent backup root"` (`fail 1`); after it: the unit file through `nondac-sh` (`tests 48`, `pass 48`), `env -i ... npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`, adapter `prune.feature` (`41 scenarios (41 passed)`), `check:static` | ✅ | ✅ green |
| 4-02-02 | 02 | 2 | ITMIG-08 | T-04-10 | B1 restored, never committed | behavioral + static | B1 fails F03 alone (`41 scenarios (40 passed, 1 failed)`); builtin (`0 scenarios`); `fallow audit` (no finding) | ✅ | ✅ green |

Every cucumber run passes `--profile <name> --parallel 2` with the non-DAC prefix of `04-CONTEXT.md`; the two plans run in different waves, one executor at a time, so no lock file is needed. The unit file of `prune-rollback.ts` runs through `nondac-sh`, because its read-only cases need a mode that denies, and direct coverage also runs under `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp` (STATE.md).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 04-01 creates `features/step_definitions/plugin/prune.steps.ts` with three new steps; plan 04-02 adds the fourth (`the prune has left no backup in the {word} scope`) with the backup fix. No separate wave. Both files exist and the four steps pass (audit 2026-11-24).

---

## Manual-Only Verifications

All phase behaviors have automated verification. Each deliberate break is a reverted experiment whose command and failing scenario the plan's SUMMARY.md records.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-24

## Audit Re-run (2026-11-24, current tree)

ITMIG-08 sub-cases map to `features/plugin/prune.feature` scenarios at lines 300 (empty scope variants), 327 (malformed state), 446 (held neighbours across marketplaces), 389 (prune after stale preview), 589/620/645 (failed member keeps dependency; retry; no backup), 527 (preview with no project state), 548 (unreadable declarer manifest), 357 (flags), 503 (project-only prune), 421 (dependent-first chain matches preview).

| Run (non-DAC shell) | Result |
|---|---|
| adapter `features/plugin/prune.feature` | 41 scenarios (41 passed) |
| builtin `features/plugin/prune.feature` | 0 scenarios (adapter-only tag) |
| adapter `features/{marketplace,plugin}/{state-lock,usage-errors}.feature` | 224 scenarios (224 passed) |
| `node --import scripts/isolated-pi-home.mjs --test test/integration/standalone-prune.test.ts` | tests 2, pass 2 |
| `node --test test/orchestrators/plugin/prune-rollback.test.ts` | tests 56, pass 56 |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts` | exit 0 (100% direct) |

## Validation Audit 2026-11-24

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

---
phase: "8"
slug: "integration-suite-rescope"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the unit tests of the six changed `bridges/hooks/` source-test pairs and `test/architecture/hooks-lifecycle.test.ts` |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`); `scripts/test-coverage-direct.mjs` (direct coverage) |
| **Quick run command** | `flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/hook/additional-context.feature`, `$S` being the shared scratchpad of the plan's execution rules; one unit file: `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp "$S/nondac-sh" -c "node --import \"$PWD/scripts/isolated-pi-home.mjs\" --test --test-reporter=spec <test file>"` |
| **Full suite command** | `npm run check` (the wave gate); 06.1-01 also runs the full adapter suite once (`npm run test:cucumber:profile -- --profile adapter --parallel 2`, with `fd` on `PATH`) |
| **Estimated runtime** | about 40 seconds for the feature file at `--parallel 2` (measured by the planner), 2 to 4 seconds per unit file, about 5 seconds for the direct coverage of the six pairs, about 3 minutes for `check:static`, about 5 minutes for the hook-wide set, and about 20 minutes for a full adapter run at `--parallel 2`; more while the lock is held |

---

## Sampling Rate

- **After every task commit:** `features/hook/additional-context.feature` under adapter (the builtin profile selects none of its scenarios), the touched unit files, direct coverage of the touched pairs, plus `npm run check:static` by hand in a worktree
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 120 seconds for a focused run without lock waits

---

## Per-Task Verification Map

Filled by the planner from `06.1-RESEARCH.md` "Phase Requirements → Test Map" and plan 06.1-01. The plan's "Red-proof tables" section holds the break runs and the scenarios each must fail; `check-red.mjs` (`$S/plan-06.1/inputs/`) checks them, with the table prefix `fix-` on the fix commit and `final-` on the final tree. Counts are under the adapter profile; the five changed scenarios are untagged, so the builtin profile selects none of them (DUAL-02). The planner measured every count below on a scratch checkout of 89d17f0.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-0N-* | per plan | 1-2 | ITSCOPE-01..04 | — | N/A | unit + integration + gate | moved unit cases with direct coverage; `npm run test:integration`; `npm run check` on the combined tree | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No new step and no new test file; the plan changes the hooks bridge, its unit tests, five scenarios of `features/hook/additional-context.feature`, the docs, and one Key Decisions row, and deletes one integration file. No separate wave.

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

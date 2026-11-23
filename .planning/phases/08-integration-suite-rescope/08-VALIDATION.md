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
| **Framework** | `node:test` for the unit pairs and the integration files; cucumber-js for the scenario covers of the red proofs |
| **Config file** | `package.json` scripts; `cucumber.json` (profiles `adapter` and `builtin`); `scripts/test-coverage-direct.mjs` (direct coverage) |
| **Quick run command** | one test file: `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp "$S/nondac-sh" -c "node --import \"$PWD/scripts/isolated-pi-home.mjs\" --test --test-reporter=spec <test file>"`; one scenario: `flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 --name '<anchored title>' <feature file>`; a break: `bash "$D/break.sh" <id> adapter "$D/brk/<id>.json" --name '<anchored title>' <feature file>` or `bash "$D/break-unit.sh" <id> "$D/brk/<id>.json" <test files>`, `$S` and `$D` being the shared scratchpad and the plan folder of the plan's execution rules |
| **Full suite command** | `npm run check` (the wave gate, and plan 08-05's ITSCOPE-04 gate on the combined tree as its five steps, the coverage step under `env -i`) |
| **Estimated runtime** | 2 to 10 seconds per unit file, about 60 seconds for the four big plugin unit files together, about 5 seconds for the direct coverage of `plan.ts`, 20 to 90 seconds per one-scenario cucumber run, about 40 seconds for the integration suite, about 3 minutes for `check:static`, and about 35 minutes for `npm run check`; more while the lock is held (measured by the planner at 9aa92a1) |

---

## Sampling Rate

- **After every task commit:** the touched files' own runs (the unit pair or the integration files of the task, with their measured counts), the task's red proofs (`check-red.mjs` for cucumber covers, the `✖` lines of `break-unit.sh` logs for unit covers), direct coverage of `plan.ts` when 08-01 touches it, plus `npm run check:static` by hand in a worktree
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** full suite green (plan 08-05)
- **Max feedback latency:** 120 seconds for a focused run without lock waits

---

## Per-Task Verification Map

Filled by the planner from `08-RESEARCH.md` "Validation Architecture", the case map, and the plans' verify commands (each row's exact commands are in its task's `<verify>` block).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | ITSCOPE-01 | T-08-01, T-08-02, T-08-03 | every break restored; no file under `extensions/` staged | unit + red proof + coverage | edits check; `plan.test.ts` 71/71; B1 to B3 `break-unit.sh` logs with their `✖` covers; direct coverage of `plan.ts` 100%; `check:static`; file set | ✅ | ⬜ pending |
| 8-01-02 | 01 | 1 | ITSCOPE-01 | — | N/A | integration + audit | `CI=1 npm run test:integration` with `ℹ fail 0`; `fallow audit` with only `weakened-tests` on the deleted file | ✅ | ⬜ pending |
| 8-02-01 | 02 | 1 | ITSCOPE-01, ITSCOPE-02 | T-08-04, T-08-05, T-08-06, T-08-07 | every break restored | cucumber red proof + integration | green cover 1/1; `check-red.mjs ... tracer-`; edits check; `load-reconcile-race` 2/2; `check:static`; file set | ✅ | ⬜ pending |
| 8-02-02 | 02 | 1 | ITSCOPE-01, ITSCOPE-02 | T-08-04, T-08-05, T-08-06, T-08-07 | every break restored | cucumber red proof + integration + architecture | green covers 4/4; `check-red.mjs ... t2-`; edits checks; `subagent-hook-ownership` 1/1; `workflow-kind-inversion` 3/3; `test:unpaired`; `check:static` twice; file set | ✅ | ⬜ pending |
| 8-02-03 | 02 | 1 | ITSCOPE-01 | T-08-04, T-08-05, T-08-06, T-08-08 | every break restored | unit + cucumber red proof + integration + audit | green covers 3/3; four unit files with their covers `✔`; `check-red.mjs ... t3-` (B7c survivor); B7, B7i, B7c unit `✖` covers; `CI=1 npm run test:integration`; `check:static`; `fallow audit` with only the four `weakened-tests`; file set | ✅ | ⬜ pending |
| 8-03-01 | 03 | 1 | ITSCOPE-02 | T-08-09, T-08-10 | N/A | integration + header gate | edits check; `standalone-prune` and `mcp-verdict-migration` 5/5; header gate; `check:static`; file set | ✅ | ⬜ pending |
| 8-03-02 | 03 | 1 | ITSCOPE-02 | T-08-09, T-08-10 | N/A | integration + header gate | edits check; six internal and multi-process files 23/23; header gate; `check:static`; file set | ✅ | ⬜ pending |
| 8-03-03 | 03 | 1 | ITSCOPE-02 | T-08-09, T-08-11 | AVAR-05 conformance rows kept | integration + header gate + audit | edits check; twelve conformance files 224/224; peer header gate and the MCP doc sentence; `check:static`; `fallow audit` with only `weakened-tests` on `standalone-prune`; file set | ✅ | ⬜ pending |
| 8-04-01 | 04 | 1 | ITSCOPE-03 | T-08-12, T-08-13 | N/A | doc check | edits check; section check before `## Review`; file set | ✅ | ⬜ pending |
| 8-04-02 | 04 | 1 | ITSCOPE-03 | T-08-12 | N/A | doc check | edits check; same-words check (nine items in three places); file set | ✅ | ⬜ pending |
| 8-05-01 | 05 | 2 | ITSCOPE-01, ITSCOPE-02, ITSCOPE-03 | T-08-15, T-08-16 | Phase 6.1 complete before the doc edit | combined-tree checks | edits check; 28 files with headers; orphan check; `CI=1 npm run test:integration` 265/265; same-words check; `plan.test.ts` 71/71 | ✅ | ⬜ pending |
| 8-05-02 | 05 | 2 | ITSCOPE-04 | T-08-14 | no timeout accepted as a pass | full gate | `npm run check` as its five steps (`main_exit=0`, both cucumber count lines passed; `cov_exit=0` with `Merged LCOV`); `fallow audit` of the plan clean; file set | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No new step and no harness change; the plans move eight reconcile cases into `test/orchestrators/reconcile/plan.test.ts`, delete covered cases after reverted breaks, rewrite integration file headers, and write the charter. The red-proof helpers (`break.sh`, `break-unit.sh`, `check-red.mjs`, `apply-edits.mjs`) and the frozen edits and breaks live in `<scratchpad>/plan-08/inputs/`, checked by `SHA256SUMS`. No separate wave.

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

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
| **Quick run command** | `flock -w 3600 "$S/phase06-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile <adapter\|builtin> --parallel 1 <the plan's feature files>`, `$S` being the shared scratchpad of the plans' execution rules |
| **Full suite command** | `npm run check`; 06-01 also runs the full adapter suite twice (`npm run test:cucumber:profile -- --profile adapter`, with `fd` on `PATH`) for the harness race fixes |
| **Estimated runtime** | 5 to 95 seconds per focused run at `--parallel 1` (measured by the planner), more while the lock is held; a full adapter run takes about 11 minutes; the full check is far longer (2,400-second limit) |

---

## Sampling Rate

- **After every task commit:** the plan's feature files under both profiles, plus `npm run check:static` by hand in a worktree
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 120 seconds for a focused run without lock waits

---

## Per-Task Verification Map

Filled by the planner from `06-RESEARCH.md` "Phase Requirements → Test Map" and the two plans. Each plan's "Red-proof tables" section holds the break runs and the scenarios each must fail; `check-red.mjs` (`$S/plan-06/inputs/`) checks them. Counts are under the adapter profile unless the row says builtin; every new scenario is untagged, so the builtin profile selects none of them (DUAL-02).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | ITMIG-12 | T-06-01, T-06-02, T-06-03, T-06-05, T-06-06 | the release stops every hook process; no break reaches a commit | harness + behavioral + integration | `$D/zombie-repro.ts` and `$D/partial-line-repro.ts` before and after F1 and F2; `features/hook/async.feature` (22); `features/hook/session.feature` (29; builtin 0); W1-tracer through `check-red.mjs ... tracer-`; `hooks-dispatch-end-to-end` (6 tests); `check:static` | ✅ (repro scripts in `$I/repro/`) | ⬜ pending |
| 6-01-02 | 01 | 1 | ITMIG-12 | T-06-03 | N/A | behavioral | `features/hook/{lifecycle,session,additional-context}.feature` (45; builtin 0); `check:static` | ✅ | ⬜ pending |
| 6-01-03 | 01 | 1 | ITMIG-12 | T-06-01, T-06-02, T-06-04, T-06-07 | no break reaches a commit; the kept internal case stays | behavioral + integration + full suite | 16 break runs and `check-red.mjs` (`RED-PROOFS OK`); `hooks-dispatch-end-to-end` (1 test); `check:static`; `fallow audit` (3 `weakened-tests`); two full adapter runs (2263 each) | ✅ | ⬜ pending |
| 6-02-01 | 02 | 1 | ITMIG-13 | T-06-08, T-06-09, T-06-10, T-06-12 | a one-shot Pi of a routed scenario reaches no real GitHub address | behavioral | `features/marketplace/device-flow.feature` (10; builtin 0); the json-mode set (38); R1-tracer through `check-red.mjs ... tracer-`; `check:static` | ✅ (new `features/lib/pi-one-shot.ts`) | ⬜ pending |
| 6-02-02 | 02 | 1 | ITMIG-13 | T-06-10, T-06-12, T-06-13 | the rejected credential is evicted; print mode prints only the remedy and leaves no staged clone | behavioral | `features/marketplace/device-flow.feature` (13; builtin 0); `check:static` | ✅ | ⬜ pending |
| 6-02-03 | 02 | 1 | ITMIG-13 | T-06-08, T-06-09, T-06-11, T-06-14 | no break reaches a commit; the kept fault-injection case stays | behavioral + integration | 7 break runs and `check-red.mjs` (`RED-PROOFS OK`); `auth-e2e` (1 test); `check:static`; `fallow audit` (1 `weakened-tests`) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

06-01 adds `Then the project directory is empty` to `project.steps.ts` and fixes two harness races, each in its own first commit, proven by the frozen reproductions in `$I/repro/`; 06-02 adds the print-mode driver `features/lib/pi-one-shot.ts` and three print-mode steps in `command.steps.ts`. Each lands in its plan's tracer task, before the scenarios that use it. No separate wave.

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

---
phase: "5"
slug: "mcp-install-legacy-move-and-overrides"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-21"
---

# Phase 5 — Validation Strategy

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
| 5-01-01 | 01 | 1 | ITMIG-09 | T-05-01, T-05-02, T-05-03, T-05-04 | breaks restored and never committed; copies checked against `SHA256SUMS` and with `cmp`; a deny-listed credential is written empty (AVAR-05) | behavioral + integration + static | `configuration.feature` with `options.feature`: adapter `24 scenarios (24 passed)`, builtin `22 scenarios (22 passed)`; M6-tracer fails C5 under both (`check-red.mjs ... tracer-`); `mcp-variable-expansion.test.ts` (`tests 5`, `pass 5`); `check:static` | ✅ features; ✅ step module | ✅ green |
| 5-01-02 | 01 | 1 | ITMIG-09 | T-05-04, T-05-06 | no secret or option value in `mcp-adapter.json` (whole-text checks); loopback URLs only | behavioral + static | adapter `34 scenarios (34 passed)`, builtin `31 scenarios (31 passed)`; `cmp` against the final copies; `check:static` | ✅ | ✅ green |
| 5-01-03 | 01 | 1 | ITMIG-09 | T-05-01, T-05-02, T-05-05 | a red run counts only on an assertion; the deletion follows `RED-PROOFS OK` | behavioral + static | M1 to M10 (M3b adapter, M3c builtin) over the two files; `check-red.mjs` `RED-PROOFS OK`; the three files absent; `check:static`; `fallow audit` (only `weakened-tests`) | ✅ | ✅ green |
| 5-02-01 | 02 | 1 | ITMIG-10 | T-05-07, T-05-08, T-05-09, T-05-10 | breaks restored and never committed; copies checked; the user's own server kept (AMIG-02) | behavioral + integration + static | `legacy-move.feature` with `verdict-list.feature`: adapter `15 scenarios (15 passed)`, builtin `13 scenarios (13 passed)`; L2-tracer fails LM1 under both; `mcp-legacy-sweep.test.ts` (`tests 3`, `pass 3`); `check:static` | ✅ features; ✅ step modules | ✅ green |
| 5-02-02 | 02 | 1 | ITMIG-10 | T-05-10 | whole files and whole scopes for every "leaves alone" claim | behavioral + static | adapter `32 scenarios (32 passed)`, builtin `30 scenarios (30 passed)`; `cmp` against the final copies; `check:static` | ✅ | ✅ green |
| 5-02-03 | 02 | 1 | ITMIG-10 | T-05-07, T-05-08, T-05-11, T-05-12 | a red run counts only on an assertion; the kept fault-injection and record cases stay byte for byte | behavioral + integration + static | L1b to L15, M2, V1 to V3b over the two files; `check-red.mjs` `RED-PROOFS OK` with the one MREC-02 adapter survivor; `mcp-migration.test.ts` through `nondac-sh` (`tests 1`), `mcp-verdict-migration.test.ts` (`tests 3`), `mcp-verdict-list.test.ts` (`tests 2`); `check:static`; `fallow audit` (only `weakened-tests`) | ✅ | ✅ green |
| 5-03-01 | 03 | 1 | ITMIG-11 | T-05-13, T-05-14, T-05-15, T-05-17 | breaks restored and never committed; copies checked; the enable stand-in reproduces pi-mcp-adapter 7.0.1's rewrite | behavioral + integration + static | `lifecycle.feature`: adapter `27 scenarios (27 passed)`, builtin `12 scenarios (12 passed)`; O2b-tracer fails LC7 to LC9 under both; `mcp-override-lifecycle.test.ts` (`tests 11`, `pass 11`); `check:static` | ✅ feature; ✅ step module | ✅ green |
| 5-03-02 | 03 | 1 | ITMIG-11 | T-05-16 | the user's overrides and choices checked as the whole `mcp-adapter.json` text | behavioral + static | adapter `49 scenarios (49 passed)`, builtin `34 scenarios (34 passed)`; `cmp` against the final copies; `check:static` | ✅ | ✅ green |
| 5-03-03 | 03 | 1 | ITMIG-11 | T-05-13, T-05-14, T-05-18 | a red run counts only on an assertion; the deletion follows `RED-PROOFS OK` | behavioral + static | O1 to O10 over the file; `check-red.mjs` `RED-PROOFS OK`; the file absent; `check:static`; `fallow audit` (only `weakened-tests`) | ✅ | ✅ green |

Every cucumber run passes `--profile <name> --parallel 1` under `flock -w 3600 "$S/phase05-heavy.lock"` with the non-DAC prefix of `05-CONTEXT.md`: the three plans run in one wave and share the 4 CPUs. `mcp-migration.test.ts` runs through `nondac-sh`, because its refused-write case needs a directory mode that denies.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Five new steps land in the plans that use them, one shared module per plan: 05-01 `mcp-implementation.steps.ts` (S1); 05-02 `session.steps.ts` (S2) and `mcp-server/legacy-move.steps.ts` (S3 with `mcpJsonText`); 05-03 `mcp-server/lifecycle.steps.ts` (S4, S5). No separate wave.

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

### Audit run on the current tree (2026-11-24)

The break runs above are historical red proofs. The current tree covers every requirement:

- ITMIG-09: `features/mcp-server/configuration.feature` and `features/mcp-server/options.feature`
- ITMIG-10: `features/mcp-server/legacy-move.feature` and `features/mcp-server/verdict-list.feature`, plus `test/integration/mcp-migration.test.ts` (1 case, through `nondac-sh`), `test/integration/mcp-verdict-migration.test.ts` and `test/integration/mcp-verdict-list.test.ts` (5 cases)
- ITMIG-11: `features/mcp-server/lifecycle.feature`

`npm run --silent test:cucumber:profile -- --profile <adapter|builtin> --parallel 2` over the five feature files: adapter `116 scenarios (116 passed)`, builtin `96 scenarios (96 passed)`. The integration files: `tests 5, pass 5` and `tests 1, pass 1`. The five deleted integration files are still absent. No gap was found, and no test was added.

## Validation Audit 2026-11-24

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

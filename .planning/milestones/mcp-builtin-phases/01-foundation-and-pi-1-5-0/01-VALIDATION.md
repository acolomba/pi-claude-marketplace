---
phase: "1"
slug: "foundation-and-pi-1-5-0"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-04"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, integration, e2e); `@cucumber/cucumber` 13.3.0 (behavioral) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test --test-reporter=./scripts/test-reporter.mjs <test files>`; `npx cucumber-js --profile <adapter\|builtin> <feature>` |
| **Full suite command** | `npm run check` (both cucumber profiles) plus `npm run test:modules` at the phase gate |
| **Estimated runtime** | ~900 seconds for `npm run check`; cucumber ~6 min per adapter leg, ~2-4 min builtin |

All npm scripts run as `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run <script>` (the container runs as root).

---

## Sampling Rate

- **After every task commit:** the touched test pairs plus `npm run check:static`
- **After every plan wave:** `npm run check` (both profiles) on the combined tree
- **Before `/gsd-verify-work`:** `npm run check`, both profiles, `npm run test:modules`, `npm run test:e2e`
- **Max feedback latency:** 300 seconds per task

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PI15-01 | pins and lock | architecture | `node --test test/architecture/peer-floor.test.ts` | ✅ | ✅ green |
| PI15-02 | floor fixture 1.5.0 | e2e | `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts && PI_CM_E2E_REF=pinned node --test test/e2e/pi-json-output.test.ts` | ✅ | ✅ green |
| PI15-02 | version text | grep | `rg -n '1\.4\.0' README.md README.es.md AGENTS.md docs .planning/codebase/STACK.md` (only dated history lines in `docs/mcp-compatibility.md`) | — | ✅ green |
| PI15-03 | suites on 1.5.0 | all | `npm run check`; `npm run test:e2e` | ✅ | ✅ green |
| MSEL-01 | precedence, one `getCommands()` per snapshot, `piMcpAdapterLoaded` equality | unit | `node --test test/platform/pi-api.test.ts test/shared/notification-run.test.ts test/platform/mcp-builtin-status.test.ts test/domain/mcp-implementation.test.ts test/domain/mcp-builtin-features.test.ts` | ✅ | ✅ green |
| MSEL-01 | no factory-time probe | architecture | `node --test test/architecture/no-factory-time-probe.test.ts` | ✅ | ✅ green |
| MSEL-01 | session steps are no-ops, never throw | unit | `node --test test/orchestrators/mcp/*.test.ts test/index.test.ts` | ✅ | ✅ green |
| MREC-01 | field written on install, update, disabled update; pre-substitution; no root, data, or home path in `mcpServerConfigs` | unit + integration | `node --test test/orchestrators/plugin/{install-outcome,update-swap,update-preflight}.test.ts test/persistence/state-io.test.ts test/integration/mcp-server-records.test.ts` | ✅ | ✅ green |
| MREC-01 | record keys pinned | architecture | `node --test test/architecture/compat-01-no-expansion.test.ts` | ✅ | ✅ green |
| MREC-01 | output unchanged | behavioral | `npm run test:cucumber:profile -- --profile adapter`; `npm run test:cucumber:profile -- --profile builtin` | ✅ | ✅ green |
| DUAL-01 | profiles, tags | static + behavioral | `npm run check:features`; both cucumber profiles | ✅ | ✅ green |
| DUAL-02 | implementation probe, tag rule | harness + static | `features/support/mcp-implementation.ts` probe at profile start; `npm run check:features` | ✅ | ✅ green |
| DUAL-03 | matrix coverage | architecture | `node --test test/architecture/behavioral-shard-coverage.test.ts`; CI timings manual (below) | ✅ | ✅ green |
| MDEC-01 | decision rows | doc grep | `rg -c 'D-MB-(0[1-9]\|1[0-3])' .planning/PROJECT.md` (26) | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/domain/mcp-implementation.test.ts`, `test/domain/mcp-builtin-features.test.ts`: profiles, naming (64-char cut with hash), the effective-compatibility table
- [x] `test/orchestrators/mcp/{session-materialize,recorded-servers,builtin-registration-step,agent-grants-step}.test.ts`, `test/platform/mcp-builtin-status.test.ts`
- [x] `test/architecture/no-factory-time-probe.test.ts`
- [x] the integration test for the record producer (`test/integration/mcp-server-records.test.ts`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI behavioral jobs finish within timeouts for both profiles | DUAL-03 | needs a hosted CI run | dispatch `ci.yml` on the branch, read job durations, confirm each timeout is at least 1.5 times its run and at least 15 minutes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-04

## Validation Audit 2026-11-04

| Metric | Count |
|---|---|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

---
phase: "1"
slug: "foundation-and-pi-1-5-0"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| PI15-01 | pins and lock | architecture | `node --test test/architecture/peer-floor.test.ts` | ✅ update | ⬜ pending |
| PI15-02 | floor fixture 1.5.0 | e2e | `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts && PI_CM_E2E_REF=pinned node --test test/e2e/pi-json-output.test.ts` | ✅ update | ⬜ pending |
| PI15-02 | version text | grep | `rg -n '1\.4\.0' README.md README.es.md AGENTS.md docs .planning/codebase/STACK.md` (only dated history lines) | — | ⬜ pending |
| PI15-03 | suites on 1.5.0 | all | `npm run check`; `npm run test:e2e` | ✅ | ⬜ pending |
| MSEL-01 | precedence, one `getCommands()` per snapshot, `piMcpAdapterLoaded` equality | unit | `node --test test/platform/pi-api.test.ts test/shared/notification-run.test.ts` | ✅ extend | ⬜ pending |
| MSEL-01 | no factory-time probe | architecture | `node --test test/architecture/<probe-ban>.test.ts` | ❌ W3 | ⬜ pending |
| MSEL-01 | session steps are no-ops, never throw | unit | `node --test test/orchestrators/mcp/*.test.ts test/index.test.ts` | ❌ W3 | ⬜ pending |
| MREC-01 | field written on install, update, disabled update; pre-substitution; no root, data, or home path in `mcpServerConfigs` | unit + integration | `node --test test/orchestrators/plugin/{install-outcome,update-swap,update-preflight}.test.ts test/persistence/state-io.test.ts` plus a new integration test | ❌ W3 | ⬜ pending |
| MREC-01 | record keys pinned | architecture | `node --test test/architecture/compat-01-no-expansion.test.ts` | ✅ update | ⬜ pending |
| MREC-01 | output unchanged | behavioral | both cucumber profiles green | ✅ | ⬜ pending |
| DUAL-01 | profiles, tags | static + behavioral | `npm run check:features`; `npx cucumber-js --profile builtin`; `npx cucumber-js` | ✅ extend | ⬜ pending |
| DUAL-02 | implementation probe, tag rule | harness + static | the probe in `BeforeAll`/`Before`/profile start; `npm run check:features` | ❌ W2 | ⬜ pending |
| DUAL-03 | matrix coverage | architecture | `node --test test/architecture/behavioral-shard-coverage.test.ts`; CI dispatch timings | ✅ extend | ⬜ pending |
| MDEC-01 | decision rows | doc grep | `rg -c 'D-MB-(0[1-9]\|1[0-3])' .planning/PROJECT.md` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/domain/mcp-implementation.test.ts`, `test/domain/mcp-builtin-features.test.ts`: profiles, naming (64-char cut with hash), the effective-compatibility table
- [ ] `test/orchestrators/mcp/{session-materialize,recorded-servers,builtin-registration-step,agent-grants-step}.test.ts`, `test/platform/mcp-builtin-status.test.ts`
- [ ] `test/architecture/<factory-probe-ban>.test.ts`
- [ ] the integration test for the record producer

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI behavioral jobs finish within timeouts for both profiles | DUAL-03 | needs a hosted CI run | dispatch `ci.yml` on the branch, read job durations, confirm each timeout is at least 1.5 times its run and at least 15 minutes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

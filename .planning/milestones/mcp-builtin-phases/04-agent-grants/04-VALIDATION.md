---
phase: "4"
slug: "agent-grants"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-04"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `strong-mock` (unit, integration); `@cucumber/cucumber` (`adapter`, `builtin` profiles) |
| **Config file** | `package.json` scripts, `cucumber.json` (frozen) |
| **Quick run command** | `node --test <owner test>` |
| **Full suite command** | `npm run check` in parts plus both cucumber profiles (see research) |
| **Estimated runtime** | ~20 s per owner test file; ~7 min adapter profile; ~2 min builtin profile |

Prefix npm scripts with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.

## Sampling Rate

- **After every task commit:** owner tests of the staged pairs; the hook runs `npm run check:commit`.
- **After every plan wave:** `npm run check` (in parts) plus both cucumber profiles on the combined tree.
- **Before `/gsd-verify-work`:** full suite, `npm run test:modules`, both profiles green.
- **Max feedback latency:** 60 seconds for owner tests.

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Command | RED proof |
|-------------|----------|-----------|---------|-----------|
| MGRT-01 | Per-implementation grant form (selector, exclude names, async text, sse dropped under built-in) | unit | `node --test test/bridges/agents/convert.test.ts` | new cases fail pre-phase |
| MGRT-01 | Frontmatter/body split emitter | unit | `node --test test/bridges/agents/frontmatter.test.ts` | fails pre-phase |
| MGRT-01 | Stage stores forms + `mcpImplementation` only when they differ | unit | `node --test test/bridges/agents/stage.test.ts` | fails pre-phase |
| MGRT-01 | Index schema/IO accept and round-trip new fields | unit | `node --test test/persistence/agents-index-schema.test.ts test/persistence/agents-index-io.test.ts` | fails pre-phase |
| MGRT-01 | agentsPhase / update staging pass the implementation | unit | `node --test --test-name-pattern 'MGRT-01' test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/update-swap.test.ts` | fails pre-phase |
| MGRT-01 | Load rewrite + legacy translation (swap, row fix, edited/missing/foreign left, none, untrusted, lock held, pristine scope) | unit | `node --test test/orchestrators/mcp/agent-grants-step.test.ts test/bridges/agents/<rewrite>.test.ts` | seed no-op fails |
| MGRT-01 | Install/update/reinstall/enable selector in `subagent get`; foreground refusal per profile | cucumber | `npx cucumber-js --profile builtin features/mcp-server/agent-grants.feature` (and `--profile adapter`) | builtin shows `plugin_demo_stub_/echo` pre-phase |
| MGRT-01 / D-MB-03 | Switch rewrites; no-MCP keeps files | cucumber (`@own-implementation`) | `npx cucumber-js --profile adapter features/mcp-server/agent-grants.feature` | `_/echo` pre-phase |
| MGRT-02 | `isSubagentChild` | unit | `node --test test/platform/subagent-child.test.ts` | module missing |
| MGRT-02 | Child load skips autoapply + MCP move | unit | `node --test --test-name-pattern 'MGRT-02' test/orchestrators/reconcile/load.test.ts` | fails pre-phase |
| MGRT-02 | Child Pi with autoapply installs nothing; child leaves agent form | cucumber | `npx cucumber-js --profile adapter features/mcp-server/agent-grants.feature` | autoapply: real red; grants: mutation red |

## Wave 0 Requirements

- [x] `test/platform/subagent-child.test.ts`
- [x] `test/bridges/agents/grant-rewrite.test.ts`
- [x] rewrite `test/orchestrators/mcp/agent-grants-step.test.ts`

## Manual-Only Verifications

All phase behaviors have automated verification.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-04

## Validation Audit 2026-11-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Run results (nondac env): 896 unit/integration tests green across test/bridges/agents, test/persistence/agents-index-*, test/platform/subagent-child, test/orchestrators/mcp/agent-grants-step, install-outcome, update-swap, reconcile/load, and test/integration/agents-builtin-grant-conformance. Cucumber `features/mcp-server/agent-grants.feature`: adapter 12/12, builtin 5/5.

Per-task map: every row above maps to a file on disk that passed. Wave 0 files exist (`grant-rewrite.test.ts` is the rewrite module test).

Accepted partial coverage (recorded in 04-VERIFICATION.md, not new gaps): cascade-driven update staging and some legacy-translation cases; untrusted-project rewrite is unit-only (P4-DC-18).

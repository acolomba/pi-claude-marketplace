---
phase: "4"
slug: "variable-expansion-at-claude-code-parity"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-07"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 24 in CI) |
| **Config file** | none — scripts in `package.json` |
| **Quick run command** | `node --test <owner test file>` |
| **Full suite command** | `npm run check` |
| **Conformance command** | `PI_MCP_ADAPTER_ROOT=<scratch install>/node_modules/pi-mcp-adapter node --test --test-reporter=./scripts/test-reporter.mjs tests/integration/adapter-expansion-conformance.test.ts` |
| **Estimated runtime** | ~75 seconds (full check) |

---

## Sampling Rate

- **After every task commit:** Run the task's owner tests (`node --test <file>`); the pre-commit hook runs `npm run check:commit`.
- **After every plan wave:** Run `npm run check`.
- **Before `/gsd-verify-work`:** `npm run check` green, plus one recorded zero-skip conformance run (command, `# skipped 0`, adapter 5.1.0, Node version, commit) and a negative run with `PI_MCP_ADAPTER_ROOT=/nonexistent` that fails.
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled by the planner from the PLAN.md tasks. Requirement → test sources come from 04-RESEARCH.md "Validation Architecture".

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | AVAR-01..04 | T-04-01, T-04-04, T-04-05 | Install writes Claude's rule; no value on disk; `!`→`!!`; missing warning names only | integration + arch | `TMPDIR=/var/tmp/mcp4-p4-01 node --test tests/integration/mcp-variable-expansion.test.ts tests/architecture/mcp-config-notices.test.ts` | ❌ W0 (task creates) | ⬜ pending |
| 4-01-02 | 01 | 1 | AVAR-01..04 | T-04-01..04 | Rule, split tokens, guard, merge, five-field walk, sentinel, `!` invariant | unit | `node --test tests/domain/claude-mcp-variables.test.ts tests/bridges/mcp/adapter-escape.test.ts tests/bridges/mcp/substitute.test.ts tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/stage.test.ts` + `npm run test:coverage:direct -- <sources>` | ❌ W0 (task creates) | ⬜ pending |
| 4-02-01 | 02 | 2 | AVAR-05, AVAR-04 | T-04-06, T-04-11 | Set deny-listed credential in a header written empty; withheld warning | integration + arch | `TMPDIR=/var/tmp/mcp4-p4-02 node --test tests/integration/mcp-variable-expansion.test.ts tests/architecture/mcp-config-notices.test.ts` | ✅ | ⬜ pending |
| 4-02-02 | 02 | 2 | AVAR-05 | T-04-08 | Snapshot digests pinned to 2.1.291; `JA` port fully covered | unit | `node --test tests/domain/claude-credential-denylist.test.ts` + direct coverage | ❌ W0 (task creates) | ⬜ pending |
| 4-02-03 | 02 | 2 | AVAR-05, AVAR-04 | T-04-06, T-04-07 | Deny arm per field class; security sentinel absent from document and notices | unit | `node --test tests/domain/claude-mcp-variables.test.ts tests/bridges/mcp/substitute.test.ts tests/bridges/mcp/stage.test.ts tests/shared/notification-dispatch.test.ts` | ✅ | ⬜ pending |
| 4-03-01 | 03 | 3 | AVAR-03 | T-04-12 | Leading `~` refuses a normal install before any write | integration | `TMPDIR=/var/tmp/mcp4-p4-03 node --test tests/integration/mcp-home-path-partial.test.ts` | ❌ W0 (task creates) | ⬜ pending |
| 4-03-02 | 03 | 3 | AVAR-03 | T-04-12 | Every home-marker form; `--partial`; info names field and token | unit + orchestrator | `node --test tests/domain/mcp-server-features.test.ts tests/domain/plugin-resolver.test.ts` | ✅ | ⬜ pending |
| 4-04-01 | 04 | 3 | AVAR-01, AVAR-03 | T-04-14, T-04-16 | Reserved variable and `CLAUDE_PROJECT_DIR` set in factory and session_start; hostile cwd not exported | unit | `node --test tests/shared/session-env.test.ts tests/index.test.ts tests/bridges/hooks/hook-env.test.ts` | ✅ | ⬜ pending |
| 4-04-02 | 04 | 3 | AVAR-01 | — | Injected stdio env is exactly `{ROOT, DATA}` | unit + orchestrator | `node --test tests/bridges/mcp/substitute.test.ts tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/stage.test.ts` | ✅ | ⬜ pending |
| 4-04-03 | 04 | 3 | AVAR-03 | T-04-18 | Peer range `>=5.1.0 <6` in manifest, lock and gates | arch | `node --test tests/architecture/peer-floor.test.ts` | ✅ | ⬜ pending |
| 4-05-01 | 05 | 4 | AVAR-04, AVAR-05 | T-04-20 | info lists unset and withheld names, never values | orchestrator | `TMPDIR=/var/tmp/mcp4-p4-05 node --test --test-name-pattern="^AVAR-04" tests/orchestrators/plugin/info.test.ts` | ✅ | ⬜ pending |
| 4-05-02 | 05 | 4 | AVAR-04, AVAR-05 | T-04-20 | Scan, rendering, catalog state byte-pinned | unit + catalog | `node --test tests/domain/claude-mcp-variables.test.ts tests/shared/notification-grammar.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ⬜ pending |
| 4-06-01 | 06 | 4 | AVAR-03 | T-04-SC | Package legitimacy confirmed by a human before the first install | manual (blocking-human) | — | n/a | ⬜ pending |
| 4-06-02 | 06 | 4 | AVAR-03 | T-04-22, T-04-24 | Every table row through the real adapter; CI wired; no single `!` reaches it | integration | `PI_MCP_ADAPTER_ROOT=<scratch>/node_modules/pi-mcp-adapter node --test --test-reporter=tap tests/integration/adapter-expansion-conformance.test.ts` | ❌ W0 (task creates) | ⬜ pending |
| 4-06-03 | 06 | 4 | AVAR-03, AVAR-05 | T-04-23 | Bounded-exhaustive property, security property, drift guard; zero-skip and negative runs recorded | integration | same, plus `PI_MCP_ADAPTER_ROOT=/nonexistent` must fail | ✅ | ⬜ pending |
| 4-07-01 | 07 | 5 | AVAR-04 | T-04-26 | update, reinstall and enable report both warnings | integration | `TMPDIR=/var/tmp/mcp4-p4-07 node --test tests/integration/mcp-variable-expansion.test.ts` | ✅ | ⬜ pending |
| 4-07-02 | 07 | 5 | AVAR-04, AVAR-03 | T-04-26, T-04-27 | import and reconcile report both warnings; divergences documented | orchestrator | `TMPDIR=/var/tmp/mcp4-p4-07 node --test --test-name-pattern="^AVAR-04" tests/orchestrators/import/execute.test.ts tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/pi-mcp-adapter-peer.ts` with the shared `tests/integration/optional-peer.ts`: env-var-only lookup, range read from `package.json` (plan 04-06 Task 2)
- [ ] `tests/integration/adapter-expansion-conformance.test.ts`: case table, bounded-exhaustive property, call-site drift guard (plan 04-06 Tasks 2-3)
- [ ] Shared case-table module `tests/bridges/mcp/expansion-cases.ts`, consumed by the unit goldens and the conformance test (plan 04-01 Task 2; deny rows in plan 04-02 Task 3)
- [ ] Paired unit tests for the new domain/bridge modules (deny-list snapshot, variable rule, adapter escape), 100% direct coverage (plans 04-01 Task 2, 04-02 Tasks 2-3)
- [ ] CI: scratch install of the pinned adapter in the `integration` job, `PI_MCP_ADAPTER_ROOT` in the test step env (D-04-18; plan 04-06 Task 2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live adapter loads the written entries | AVAR-01..05 | Needs a real Pi session with adapter 5.x | Covered by Phase 7 live UAT (ADOC-02) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

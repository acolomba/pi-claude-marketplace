---
phase: "04"
slug: "hermetic-test-infrastructure"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-07"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property                    | Value                                                |
| --------------------------- | ---------------------------------------------------- |
| **Framework**               | Node built-in `node:test` with `node:assert/strict`  |
| **Quick run command**       | `node --test <owning-test-path>`                     |
| **Direct coverage**         | `npm run test:coverage:direct -- <source-path>`      |
| **Shared support coverage** | `npm run test:coverage:direct:all`                   |
| **Type/style gates**        | `npm run typecheck`; `npx eslint . --max-warnings=0` |
| **Full suite command**      | `npm run check`                                      |

All external behavior stays offline. Filesystem cases use a unique temporary
root and control both `HOME` and `PI_CODING_AGENT_DIR`. Auth cases use the
existing credential, device-flow, and Git fakes; no real remote is reachable.

## Sampling Rate

- **After every task:** run the exact focused command in that task.
- **After an environment wave:** run all migrated owner suites and poison-path
  regressions.
- **After the shared Git fake:** run every listed dependent suite and the
  all-pairs direct coverage gate.
- **After typed production signatures:** run typecheck, focused owners, and
  ESLint before the next wave.
- **Before phase verification:** run the exact naming/cast/hermeticity censuses,
  all focused owners, and `npm run check`.

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement                           | Threat                                                                   | Secure behavior                                                                                                                                                                                                                                                                                                                            | Automated command                                        | Exists     | Status     |
| -------- | ----- | ---: | ------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------- | ---------- |
| 04-01-01 | 04-01 |    1 | TREF-01                               | T-04-01                                                                  | Both location inputs point under one case root and restore exactly                                                                                                                                                                                                                                                                         | `node --test tests/orchestrators/plugin/install.test.ts` | ✅         | ⬜ pending |
| 04-01-02 | 04-01 |    1 | TREF-01                               | Plugin list cannot touch ambient user state                              | `node --test tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/install.test.ts`                                                                                                                                                                                                                                           | ✅                                                       | ⬜ pending |
| 04-02-01 | 04-02 |    2 | TREF-01                               | Project MCP lookup merges only case-owned user state                     | `node --test tests/bridges/mcp/stage.test.ts`                                                                                                                                                                                                                                                                                              | ✅                                                       | ⬜ pending |
| 04-02-02 | 04-02 |    2 | TREF-01                               | Every implicated sibling restores exact environment and lifecycle state  | `node --test tests/architecture/cross-op-convergence.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/update.test.ts` | ✅                                                       | ⬜ pending |
| 04-03-01 | 04-03 |    3 | TREF-02                               | Shared Git fake preserves callable auth without aliasing data fields     | `node --test tests/platform/git-ops-fake.test.ts && npm run test:coverage:direct:all`                                                                                                                                                                                                                                                      | ✅                                                       | ⬜ pending |
| 04-03-02 | 04-03 |    3 | TREF-02                               | Eight consumers forward auth directly with unchanged behavior            | focused shared-fake and eight-consumer `node --test` command in Plan 04-03                                                                                                                                                                                                                                                                 | ✅                                                       | ⬜ pending |
| 04-04-01 | 04-04 |    4 | AUTH-01                               | Hostile provider neighbors are rejected                                  | `node --test tests/domain/auth-registry.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/auth-registry.ts`                                                                                                                                                                                               | ✅                                                       | ⬜ pending |
| 04-04-02 | 04-04 |    4 | AUTH-01 / TREF-02                     | Optional and failing auth callbacks stay offline and identity-preserving | `node --test tests/orchestrators/auth-host.test.ts tests/platform/git-ops-fake.test.ts`                                                                                                                                                                                                                                                    | ✅                                                       | ⬜ pending |
| 04-05-01 | 04-05 |    4 | TREF-03                               | Narrow Pi ports remain real-SDK compatible                               | `node --test tests/platform/pi-api.test.ts tests/shared/notify.test.ts && npm run typecheck`                                                                                                                                                                                                                                               | ✅                                                       | ⬜ pending |
| 04-05-02 | 04-05 |    4 | TREF-03                               | Marketplace/update values need no broad SDK cast                         | focused marketplace/enable-disable tests, typecheck, and ESLint in Plan 04-05                                                                                                                                                                                                                                                              | ✅                                                       | ⬜ pending |
| 04-06-01 | 04-06 |    5 | TREF-03                               | Plugin option dependencies name only live capabilities                   | `npm run typecheck` plus four plugin owner suites                                                                                                                                                                                                                                                                                          | ✅                                                       | ⬜ pending |
| 04-06-02 | 04-06 |    5 | TREF-03                               | Plugin/cross-operation test values have exact structural types           | focused five-suite, typecheck, and ESLint command in Plan 04-06                                                                                                                                                                                                                                                                            | ✅                                                       | ⬜ pending |
| 04-07-01 | 04-07 |    6 | TREF-02 / TREF-03                     | Exactly 16 local factories change names without behavior changes         | focused ten-suite command and `npm run typecheck`                                                                                                                                                                                                                                                                                          | ✅                                                       | ⬜ pending |
| 04-07-02 | 04-07 |    6 | AUTH-01 / TREF-01 / TREF-02 / TREF-03 | Final censuses and all repository gates are green                        | `npm run check`                                                                                                                                                                                                                                                                                                                            | ✅                                                       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

## Wave 0 Requirements

The repository already has Node test infrastructure, direct-pair coverage,
strict TypeScript, ESLint, Prettier, Fallow, and the credential/device-flow/Git
support modules. Plan 04-01 creates the only new shared primitive before any
dependent migration. No external package, service, fixture download, or manual
setup is required.

## Manual-Only Verifications

None. Every Phase 4 success criterion has a focused automated owner route and a
final repository gate.

## Validation Sign-Off

- [x] Final plan and task identifiers replace provisional rows.
- [x] Every task has an automated verification command.
- [x] No three consecutive tasks lack automated feedback.
- [x] Wave 0 has no missing framework or external dependency.
- [x] No watch-mode flag appears.
- [ ] All focused commands are green on the final source state.
- [ ] `nyquist_compliant: true` is set after execution evidence is recorded.

**Approval:** pending execution and final Phase 4 validation.

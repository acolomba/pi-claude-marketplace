---
phase: "10"
slug: "plugin-options-variables-and-trust"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-14"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (unit, integration), @cucumber/cucumber 13.3.0 (behavioral, profiles `adapter` and `builtin`) |
| **Config file** | `cucumber.json`, `package.json` scripts |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <owner test>`; one feature: `npm run test:cucumber:profile -- --profile adapter <feature>` |
| **Full suite command** | `npm run check` (wave merge and phase gate only; executors do not run it) |
| **Estimated runtime** | ~10 seconds per owner test; one feature under one profile ~1-3 minutes |

Every command runs in a hermetic home. No test may read, list, stat, or write the real `~/.pi/agent`.

---

## Sampling Rate

- **After every task commit:** the owner test of each touched source-test pair, the owner tests of its callers, `npm run test:coverage:direct -- <source>` for each touched source, and each touched feature under each profile it runs in; `npm run check:features` when a feature or step file changes; the relevant `test/integration/` files when an MCP or adapter path changes.
- **After every plan wave:** `npm run check` on the combined tree (orchestrator gate).
- **Before `/gsd-verify-work`:** full suite green.
- **Max feedback latency:** ~3 minutes per task.

---

## Per-Task Verification Map

Seeded from `10-RESEARCH.md` "Validation Architecture". Task IDs stay unassigned: each row spans several plans of waves 1-9 (see the 10-NN-SUMMARY files). Statuses audited 2026-11-15 at 71c4c1dc: the unit owner tests of every row pass (1514 tests, 0 failures); the feature rows passed in the full gate at 28f2966c.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PG-CORE-03 (D-PG10-05, -20) | — | strict schema; malformed `userConfig` is `unavailable` | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/user-config.test.ts test/domain/plugin-resolver.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-03 (D-PG10-06, -21) | — | required without default is partial; MCP map `""` for non-required | unit | same + `test/shared/probe-classifiers.test.ts test/orchestrators/plugin/install.messaging.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-03 (D-PG10-10, -21) | T-10 hook | exec fill; unset fails; shell-form refused | unit | `... --test test/bridges/hooks/hook-env.test.ts test/bridges/hooks/spawn-helpers.test.ts test/bridges/hooks/dispatch-exec.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-03 (D-PG10-11, -23) | T-10 adapter | no resolved value in `mcp-adapter.json`; escaped export | unit + integration | `... --test test/domain/claude-mcp-variables.test.ts test/bridges/mcp/adapter-entry.test.ts test/bridges/mcp/stage.test.ts test/shared/session-env.test.ts`; `node scripts/install-test-peers.mjs && node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/adapter-expansion-conformance.test.ts test/integration/mcp-variable-expansion.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-03 (D-PG10-12) | — | built-in holds value in memory only | unit + integration | `... --test test/bridges/mcp/builtin-entry.test.ts test/orchestrators/mcp/builtin-registration-step.test.ts test/integration/mcp-builtin-encoding-conformance.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-03 (D-PG10-13, -09) | T-10 content | sensitive placeholder in content | unit | `... --test test/shared/vars.test.ts test/bridges/skills/stage.test.ts test/bridges/commands/staged-command.test.ts test/bridges/agents/convert.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-05 (D-PG10-16) | — | N/A | unit | `... --test test/orchestrators/skill-invocation.test.ts test/orchestrators/command-invocation.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-06, -07 (D-PG10-02, -03, -22) | T-10 PATH | untrusted project state not read; only existing dirs | unit | `... --test test/orchestrators/plugin-path.test.ts test/index.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | D-PG10-24 | — | N/A | unit | `... --test test/shared/completion-cache.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-06, -07 | T-10 PATH | bash does not find an untrusted project's `bin` | e2e | `npm run test:cucumber:profile -- --profile adapter features/plugin/project-trust.feature features/plugin/executables.feature` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-03 | — | N/A | e2e | `npm run test:cucumber:profile -- --profile adapter features/plugin/options.feature features/hook/process.feature features/hook/failures.feature` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-03 | T-10 adapter | entry holds a reference, never the value | e2e | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/options.feature` and `--profile builtin` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-CORE-05 | — | N/A | e2e | `npm run test:cucumber:profile -- --profile adapter features/slash-command/invocation.feature features/slash-command/model-runs.feature features/skill/model-reads.feature features/agent/listing.feature` | ✅ | ✅ green |
| TBD | TBD | TBD | all | — | N/A | static | `npm run check:features` | ✅ | ✅ green |
| TBD | TBD | TBD | PG-SEC-02 (D-PG10-01, -18) | T-10 trust | record names premise and Pi 1.5.0/1.5.2 | doc | `grep -n "D-PG10-01" .planning/PROJECT.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `extensions/pi-claude-marketplace/domain/user-config.ts` + `test/domain/user-config.test.ts` — the new pair
- [x] owned-variable orchestrator pair, if the planner places the state-reading shell in its own module — `orchestrators/plugin-options.ts` + `test/orchestrators/plugin-options.test.ts`, 100% direct coverage
- [x] cucumber: a step or profile that saves "Do not trust" (`trust.json` value `false`) in a hermetic home
- [x] cucumber: a publishing step that writes an executable plugin file
- [x] integration: a conformance case running pi-mcp-adapter 7.0.1's `interpolateEnvVars` on reference plus escaped value (assumption A1), landed before the MCP plans

Runtime State Inventory (10-RESEARCH), "Secrets and env vars" row: closed. `PI_CLAUDE_MARKETPLACE_OPTIONS` and `PI_CLAUDE_MARKETPLACE_OPTION_*` are in the env snapshot of `test/index.test.ts` and documented in `docs/env-vars.md`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Decision 23 record wording and maintainer flags | PG-SEC-02 | a recorded decision, not behavior | Read the D-PG10-01 row in `.planning/PROJECT.md`: premise, Pi 1.5.0 and 1.5.2, options A and B, "pending maintainer review" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-15 (gsd-validate-phase, no gaps)

## Validation Audit 2026-11-15

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

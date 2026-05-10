---
phase: 3
slug: resource-bridges
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 3 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution of the four resource bridges (skills, commands, agents, MCP).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node ≥22 built-in test runner; Phase 1/2 baseline) |
| **Config file** | none -- `package.json` declares `test` script that calls `node --test` |
| **Quick run command** | `npm run test -- --test-name-pattern <bridge>` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + full `node --test`) |
| **Estimated runtime** | ~10-20 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the bridge-scoped `node --test` slice (≤3s)
- **After every plan wave:** Run `npm run check` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

> Populated by the planner during PLAN.md generation. Each task gets a row mapping its REQ-ID(s) to a concrete `node --test` command (or Wave 0 dependency if the test file doesn't exist yet).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-XX-XX | XX | N | REQ-XX | -- | (per planner) | unit / integration | `node --test tests/bridges/<bridge>/<file>.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 is the test-infrastructure-and-fixtures pass that lands before any production bridge code. The planner derives this list from RESEARCH.md §"Test Strategy" and the per-bridge fixture layouts.

- [ ] `tests/fixtures/plugins/full-plugin/` -- test plugin with skills + commands + agents + mcpServers (covers success criterion 1)
- [ ] `tests/fixtures/plugins/empty-mcp/` -- plugin with empty `mcpServers` (covers success criterion 4)
- [ ] `tests/fixtures/plugins/empty-agents/` -- plugin with empty agents source dir (covers success criterion 4)
- [ ] `tests/fixtures/plugins/foreign-agent/` -- plugin whose target path collides with foreign content (covers success criterion 2 -- basename / marker missing)
- [ ] `tests/bridges/skills.test.ts` -- REQ-IDs SK-1..SK-5
- [ ] `tests/bridges/commands.test.ts` -- REQ-IDs CM-1..CM-4
- [ ] `tests/bridges/agents.test.ts` -- REQ-IDs AG-1..AG-12 (marker discipline, ownership guard, soft-fail, file-corruption throw)
- [ ] `tests/bridges/mcp.test.ts` -- REQ-IDs MC-1..MC-8 (collision slots, precedence chain, materialization gate)
- [ ] `tests/bridges/integration.test.ts` -- multi-bridge end-to-end staging (success criterion 1)

*If a fixture or test file already exists from Phase 2, it does not appear here -- Wave 0 only lists net-new artefacts.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (per planner -- likely none) | -- | -- | -- |

*Phase 3 bridges are pure filesystem operations on local disk; all behaviors are expected to have automated verification. The planner will fill this section if any UAT-only check surfaces during planning.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

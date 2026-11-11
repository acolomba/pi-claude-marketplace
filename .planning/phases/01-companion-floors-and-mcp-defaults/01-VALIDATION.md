---
phase: "1"
slug: "companion-floors-and-mcp-defaults"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase section 6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-11"
---

# Phase 1 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md`, section "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` with `node:assert/strict` and `strong-mock`; `@cucumber/cucumber` for `features/` |
| **Config file** | `cucumber.json` (profiles `adapter`, `builtin`); `package.json` scripts |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>`, or `npm run test:coverage:direct -- <source-path>` for one pair |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick: under 30 seconds; full: about 20 minutes |

---

## Sampling Rate

- **After every task commit:** the owner test of each changed source, and `npm run test:coverage:direct -- <path>` for its pair. The commit hook runs `npm run check:commit`.
- **After every plan wave:** `npm run check` on the combined tree.
- **Before `/gsd-verify-work`:** `npm run check` green, plus the two one-off slow runs of D-PG1-14 recorded.
- **Max feedback latency:** 30 seconds for the quick command.

---

## Per-Task Verification Map

The planner fills the task IDs. The rows below are the requirement-level map from the research.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | PG-AGENT-02 | -- | N/A | architecture | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/peer-floor.test.ts` | yes, assertions change | pending |
| TBD | TBD | 1 | PG-AGENT-02 | -- | N/A | integration | `npm run test:integration` | yes, readers change | pending |
| TBD | TBD | TBD | PG-AGENT-02 | -- | N/A | cucumber | `npx cucumber-js --profile adapter --name 'A foreground run of an agent granted a plugin MCP tool'` and `--profile builtin` | yes, rows change after measurement | pending |
| TBD | TBD | TBD | PG-AGENT-07b | -- | N/A | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts` | yes, cases change | pending |
| TBD | TBD | TBD | PG-AGENT-07b | -- | N/A | cucumber | `npx cucumber-js --profile adapter --name "With --map-model Claude Code's model names are listed as the models they select"` | yes, row and projection change | pending |
| TBD | TBD | 1 | PG-MCP-02 | -- | N/A | architecture | `test/architecture/peer-floor.test.ts`, `test/bridges/mcp/adapter-entry.test.ts` | yes, assertions change | pending |
| TBD | TBD | TBD | PG-MCP-02 | -- | the project's rule equals the installed adapter's | integration | new adapter naming conformance test under `test/integration/` | no, Wave 0 | pending |
| TBD | TBD | TBD | PG-MCP-02 | -- | N/A | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-implementation.ts` | yes, new cases | pending |
| TBD | TBD | TBD | PG-MCP-02 | -- | N/A | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/listing.feature` | no, new `@adapter-only` scenario | pending |
| TBD | TBD | TBD | PG-MCP-02 | -- | N/A | cucumber | `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature` | no, new `@adapter-only` scenario | pending |
| TBD | TBD | TBD | PG-MCP-02 | -- | a disallowed long tool is not offered to the child | unit and cucumber | direct coverage of `convert.ts`; a scenario under `features/agent/` or `features/mcp-server/agent-grants.feature` | no, new | pending |
| TBD | TBD | TBD | PG-MCP-01 | -- | N/A | unit | direct coverage of `mcp-server-features.ts`, `mcp-builtin-translation.ts`, `adapter-entry.ts`, `marker.ts` | yes, new cases | pending |
| TBD | TBD | TBD | PG-MCP-01 | -- | N/A | cucumber | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-values.feature` | file yes, new scenarios | pending |
| TBD | TBD | TBD | PG-MCP-01 | -- | a user-written timeout survives an update | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature` | no, new scenario and one `Given` step | pending |

---

## Wave 0 Requirements

- [ ] The shared suite-version source for pi-subagents, read by `scripts/install-test-peers.mjs`, `test/integration/optional-peer.ts`, and `features/lib/companions.ts` (D-PG1-02).
- [ ] An adapter naming conformance test under `test/integration/` (D-PG1-09); extend `PiMcpAdapterTypes` in `test/integration/pi-mcp-adapter-peer.ts`.
- [ ] An adapter grant conformance test under `test/integration/` that measures the pi-subagents long-name gap.
- [ ] `features/lib/upstream/subagents.ts`: the model marker, the bare model ID, and the new refusal text, after the first run on the new peers.
- [ ] One `Given` step for a user-written `requestTimeoutMs` on an entry.
- [ ] A plugin stub server whose tool name can be set, for a cut inside the tool segment.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real background child calls a granted plugin MCP tool | PG-AGENT-02 | The harness cannot start a real detached pi-subagents child (BACKLOG AGTASYNC-01) | The phase states how it was checked; the scenario pins what the stand-in shows |
| A call silent for more than 60 seconds succeeds under each implementation | PG-MCP-01 | Slow, and kept out of the suite by D-PG1-14 | Run a temporary scenario once per profile; record the result in the verification report |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 30 seconds
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

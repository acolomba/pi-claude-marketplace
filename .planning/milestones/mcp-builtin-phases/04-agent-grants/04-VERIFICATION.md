---
phase: 04-agent-grants
verified: 2026-11-05T09:00:00Z
status: passed
score: 3/3 must-haves verified
covered_files:
  - ".planning/phases/04-agent-grants/04-01-PLAN.md"
  - ".planning/phases/04-agent-grants/04-01-SUMMARY.md"
  - ".planning/phases/04-agent-grants/04-02-PLAN.md"
  - ".planning/phases/04-agent-grants/04-02-SUMMARY.md"
  - ".planning/phases/04-agent-grants/04-03-PLAN.md"
  - ".planning/phases/04-agent-grants/04-03-SUMMARY.md"
  - ".planning/phases/04-agent-grants/04-04-PLAN.md"
  - ".planning/phases/04-agent-grants/04-04-SUMMARY.md"
  - ".planning/phases/04-agent-grants/04-05-PLAN.md"
  - ".planning/phases/04-agent-grants/04-05-SUMMARY.md"
  - ".planning/phases/04-agent-grants/04-06-PLAN.md"
  - ".planning/phases/04-agent-grants/04-06-SUMMARY.md"
  - "extensions/pi-claude-marketplace/bridges/agents/convert.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/stage.ts"
  - "extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts"
  - "extensions/pi-claude-marketplace/persistence/agents-index-schema.ts"
  - "extensions/pi-claude-marketplace/platform/subagent-child.ts"
  - "features/mcp-server/agent-grants.feature"
  - "features/step_definitions/mcp-server/agent-grants.steps.ts"
covered_digest: "v4:sha256:e8af590af49396d2c1aaf67cd1ae89c9f7fb2f42741e298384ad3aacb6fc735a"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 3/3
  gaps_closed:
    - "Cascade updates (marketplace autoupdate, apply convergence, dependency moves) staged the adapter form under Pi's built-in MCP until the next load (P4-DC-13, P4-DC-46, P4-DC-60, review WR-03): closed by Phase 6 plan 06-02 (670f742, 75c1d48)"
  gaps_remaining: []
  regressions: []
accepted_gaps:
  - gap: "Legacy translation: per-tool excludeTools names over 64 characters stay in adapter form; grants of servers built-in cannot run (sse) are translated, not dropped"
    ids: "P4-DC-06, P4-DC-30"
    closure: "Backlog item; reinstall writes the exact form"
  - gap: "The untrusted-project leg of the grants step is proven by unit test only"
    ids: "P4-DC-18"
    closure: "None planned; harness cannot present an untrusted project to a profile Pi"
---

# Phase 4: Agent Grants Verification Report

**Phase Goal:** A generated pi-subagents agent carries the active implementation's MCP grant, and after a switch the load rewrites only the agent files whose grants changed, never from a background child.
**Verified:** 2026-11-05T09:00:00Z
**Status:** passed (two recorded accepted gaps, see Warnings)
**Re-verification:** Yes, milestone close on the combined tree (branch `features/mcp-builtin`, working HEAD 9082c47; build inputs equal ca56636 apart from `.planning/`). The earlier report covered 3a7e910 and went stale because later phases changed `update-swap.ts`, `install-outcome.ts`, `convert.ts`, `load.ts`, and `agent-grants.feature`.

## What later phases changed in the covered surface

`git diff 3a7e910 HEAD` over the covered product files touches five: `convert.ts`, `install-outcome.ts`, `update-swap.ts`, `load.ts`, and `agent-grants.feature`. Each change was read.

| File | Change since 3a7e910 | Effect on Phase 4 |
| ---- | -------------------- | ----------------- |
| `update-swap.ts` | Phase 6 plan 06-02 (670f742): the private `updateAgentImplementation` fallback chain (direct run, else preflight notification run, else `none`) is deleted. `prepareUpdateAgents` now passes `active: args.mcpImplementation`, a required field of `ThreePhaseArgsBase` that Phase 3 added. Other hunks are Phase 3's verdict basis and `partialDegradeOf`. | Strengthens MGRT-01. Closes the accepted cascade gap. |
| `install-outcome.ts` | Phase 3 additions (`consentView`, `resolutionFor(...)` in the ledger summary, `declaresMcp` from the declared servers). `agentsPhase` still passes `mcpGrantForms.active = opts.run.softDeps.mcpImplementation` (line 1367). | No change to grant staging. |
| `convert.ts` | 16b53bf: an MCP tool name holding whitespace or `,` matches no grant, so a `tools:` line cannot split or inject a frontmatter key (T-04-01). | Hardening only. |
| `load.ts` | Phase 3 passes `mcpImplementation` into the read pass and `composePendingReport`. The `isSubagentChild(env)` gate in `createLoadReconcile` is unchanged. | No change to MGRT-02. |
| `agent-grants.feature` | +57 lines: the `@adapter-only` / `@builtin-only` apply catalog-move pair (06-02, 75c1d48). | New coverage of the apply path. |

## Goal Achievement

### Observable Truths (ROADMAP Phase 4 success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Installing, updating, reinstalling, or enabling a plugin whose agent is granted a plugin MCP tool gives that agent the active implementation's server selector, as pi-subagents reports it, under both profiles (MGRT-01) | VERIFIED, now including cascade-driven updates | `install-outcome.ts:1366-1369` passes `active: opts.run.softDeps.mcpImplementation` and the declared servers. `update-swap.ts:493-498` passes `active: args.mcpImplementation`. Every producer of that field fills it from its own run: `reinstall-flow.ts:424` and `update-flow.ts:323` from `opts.run`; `dependency-move.ts:170` from the context's soft-dependency snapshot; `convergence.ts:1134,1260` from `input.mcpImplementation`; the autoupdate pass reaches `update-flow.ts:1555` through `beginPluginUpdateRun({ ctx, run })` (`marketplace/background-pass.ts:403`, `edge/handlers/marketplace/update.ts:62`), so the notification's run names the implementation. `grant-forms.ts` renders the built-in form only when `active === "builtin"`, else the adapter form. Cucumber `agent-grants.feature` has an `@adapter-only` / `@builtin-only` pair for install, update, apply catalog move, reinstall, and enable, asserting `tools mcp:plugin_demo_stub_/echo` (adapter) and `tools mcp:plugin_demo_stub/echo` (built-in) from pi-subagents' own `subagent get`, plus the D-CF6-10 foreground-refusal pair. Both profiles pass (below). |
| 2 | After a switch and `/reload`, the load rewrites exactly the agent files whose grants changed, atomically under the scope's state lock, with no user action (D-MB-03); with no active implementation, or in a project Pi does not trust, the files stay as they are (MGRT-01) | VERIFIED | Re-read in full: `agent-grants-step.ts` returns for `none` and for a child before reading the context, handles the user scope, then the project scope only when `ctx.isProjectTrusted()`, and takes the lock with `withExistingScopeLock` passing `assertLockHeld` into `rewriteAgentGrantForms`. `grant-rewrite.ts`: candidates are rows whose recorded `mcpImplementation` differs from the active one and that store the active form; a file is swapped only when it starts with the recorded block byte for byte; new bytes go to `agents-staging/<uuid>/` and are renamed over the target; the index is saved last; `assertPathInside` plus the basename check precede every write; `assertLockHeld` runs before each rename and before the save; an index with a corrupt row is left whole. Unchanged by later phases. Cucumber `@own-implementation` scenarios (switch to built-in rewrites the MCP agent and leaves the no-MCP agent; no implementation keeps the held grant; an earlier-release agent is translated) pass under the builtin profile. The untrusted-project leg stays unit-only (accepted gap, `agent-grants-step.test.ts`). |
| 3 | A background subagent child that loads the extension rewrites no agent file and no other installation state (MGRT-02) | VERIFIED | `platform/subagent-child.ts` compares `PI_SUBAGENT_CHILD` to `"1"`. `agent-grants-step.ts:81` returns on `isSubagentChild(env)`. `load.ts:244-247` runs only the read-only pass with `NO_MCP_MOVE` in a child, never the autoapply apply. Cucumber (builtin profile): "A pi-subagents background child with autoapply on installs nothing" and "A pi-subagents background child leaves an agent's grant in the form it holds" pass. Unit suites for the marker, the step, and the load pass. |

**Score:** 3/3 truths verified, 0 behavior-unverified. Truths 1 and 2 are state-transition truths; each has a passing behavioral scenario, so none rests on presence alone.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `bridges/agents/convert.ts` | Grant selector, `excludeTools` spelling, and async warning per implementation | VERIFIED | Plus the T-04-01 tool-name hardening |
| `bridges/agents/grant-forms.ts` | Both forms per agent, recorded on the row when they differ | VERIFIED | Wired from `stage.ts:144` |
| `bridges/agents/mcp-async-warning.ts` | D-CF6-10 text per implementation | VERIFIED | Phase 3's `verdict-markers.feature` row was updated to the built-in text at merge, so the former P4-DC-23 failure no longer exists (cucumber builtin 133/133 in the gate) |
| `bridges/agents/grant-rewrite.ts` | Locked swap with containment, staging rename, index saved last | VERIFIED | Read in full |
| `bridges/agents/legacy-grant-form.ts` | Textual adapter-to-built-in translation for earlier-release rows | VERIFIED (accepted gaps) | Earlier-release scenario passes |
| `persistence/agents-index-schema.ts` | Additive optional `mcpImplementation` and `mcpForms`; `schemaVersion` stays 1 | VERIFIED | Unit pair passes |
| `orchestrators/mcp/agent-grants-step.ts` | Child, none, and trust gates; never rejects | VERIFIED | Wired through `index.ts` -> `createMcpSessionMaterializer` |
| `platform/subagent-child.ts` | Pure marker reader on an injected env | VERIFIED | Wired from the step and `load.ts` |
| `orchestrators/reconcile/load.ts` | Child gate in the load | VERIFIED | Gate intact after Phase 3 edits |
| `orchestrators/plugin/update-swap.ts` | Update stages the grant of the run's implementation | VERIFIED, strengthened | Reads the required `args.mcpImplementation` |
| `features/mcp-server/agent-grants.feature` and step module | Scenarios per verb, switch, none, child | VERIFIED | 13 adapter and 6 builtin scenarios, all pass |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `agentsPhase` (install, enable, import) | `prepareStagePluginAgents` | `mcpGrantForms.active` from `opts.run.softDeps.mcpImplementation` | WIRED |
| update, reinstall, dependency move, autoupdate cascade, apply convergence | `prepareStagePluginAgents` | `prepareUpdateAgents` -> `args.mcpImplementation` | WIRED for every producer (previously PARTIAL for cascade runs) |
| `stage.ts` | agents index row | `convertAgentGrantForms` -> `mcpImplementation`, `mcpForms` | WIRED |
| `session_start` | `agentGrantsStep` | `index.ts` -> `createMcpSessionMaterializer` | WIRED |
| `agentGrantsStep` | `rewriteAgentGrantForms` | `withExistingScopeLock` + `assertLockHeld` | WIRED |
| `resources_discover` | child gate | `createLoadReconcile` reads `process.env` per load | WIRED |

### Data-Flow Trace (Level 4)

The active implementation flows from the run snapshot (`NotificationRun.softDeps.mcpImplementation`, from Pi's tool and command inventory) into install staging, update staging (through `args.mcpImplementation`), and the load step. Cucumber `subagent get` results come from pi-subagents reading the written file, so the written bytes reach the consumer. FLOWING. One residual: `beginPluginUpdateRun()` called with no notification reads `none` (adapter form); no production caller does that, and the load repairs such a row anyway.

### Behavioral Spot-Checks (run by me on the current tree)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Adapter profile of the feature | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature` | 13 scenarios, 184 steps passed (seed 131743) | PASS |
| Builtin profile of the feature | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature` | 6 scenarios, 89 steps passed (seed 124278) | PASS |
| Focused unit suites (step, rewrite, forms, legacy, async warning, child marker, load, update-swap, index schema, convert, stage, install-outcome) | `node --test --test-reporter=tap ...` | 770 tests, 770 pass, 0 fail | PASS |

I did not repeat the earlier red experiments for the child gate and the grants step: their files are unchanged since they were run. For the new update-path change, 06-02 records red proofs (builtin apply scenario failed on the pre-change code with `tools mcp:plugin_demo_stub_/echo`; two unit cases failed), which I read but did not re-run.

### Gate evidence (not re-run by me)

Supplied by the caller: `npm run check` exit 0 on 71a37c4 (static, unpaired, integration, cucumber adapter 1603/1603 and builtin 133/133, direct coverage); `test:modules` exit 0 on 2b6f2f4; CI run 41967152313 success on 2b6f2f4.

### Probe Execution

SKIPPED (no probes declared by this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MGRT-01 | 04-01..05, 06-02 | Agent grants name the active implementation's server; after a switch and `/reload` the load rewrites only changed files atomically; with no implementation the files stay | SATISFIED (legacy-translation gaps accepted) | Truths 1 and 2 |
| MGRT-02 | 04-02, 04-04, 04-05 | A background child that loads the extension never rewrites agent files or other installation state | SATISFIED | Truth 3 |

No orphaned requirements: REQUIREMENTS.md maps only MGRT-01 and MGRT-02 to Phase 4, both marked complete.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, or `XXX` in the covered product files (grep over the covered set). No stub or empty implementation.

### Human Verification Required

None.

## Warnings (accepted gaps, not blockers)

1. **Legacy translation gaps (P4-DC-06, P4-DC-30).** An earlier-release agent with a per-tool `disallowedTools` name over 64 characters stays in adapter form under built-in, and an `sse` server's grant is translated rather than dropped. `reinstall` writes the exact form. In the backlog.
2. **Untrusted-project leg is unit-only (P4-DC-18).** The harness cannot start a profile Pi in an untrusted project; `agent-grants-step.test.ts` pins that only the user scope is rewritten.
3. **Autoupdate grant staging is pinned by a unit case only (P6-DC-0204).** The apply convergence path has an end-to-end pair; the marketplace autoupdate cascade shares `prepareUpdateAgents` and is covered by the update-swap cascade unit cases, with no cucumber scenario of its own.

Two residual notes, no action needed: the child still runs the idempotent MIG-01 config migration and `loadState`'s legacy migration (not gated by design, P4-DC-08), and the switch scenarios start from the `none` or adapter-form file, not from a live adapter session (the stored form is identical).

## Closed since the earlier report

The earlier report's first accepted gap (cascade updates staging the adapter form under built-in until the next load) is closed. Its parent follow-up lines 1 and 2 are applied: Phase 3's verdict-markers row carries the built-in text, and `updateAgentImplementation` was replaced by `args.mcpImplementation`. ROADMAP.md marks Phase 4 complete.

---

_Verified: 2026-11-05T09:00:00Z_
_Verifier: Claude (gsd-verifier)_

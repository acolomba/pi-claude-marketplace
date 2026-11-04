---
phase: 04-agent-grants
verified: 2026-11-04T18:00:00Z
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
covered_digest: "v4:sha256:b8a78c386c84a543a5fbeee9b9c6b973d12cf97460c48e70930b23d0d4bdd787"
behavior_unverified: 0
overrides_applied: 0
accepted_gaps:
  - gap: "Cascade updates (marketplace autoupdate, apply convergence, dependency moves with no preflight run) stage the adapter form under Pi's built-in MCP until the next load"
    ids: "P4-DC-13, P4-DC-46, P4-DC-60, review WR-03"
    closure: "Parent line 2 in 04-06-SUMMARY.md, after Phase 3 adds the implementation field to ThreePhaseArgs"
  - gap: "Legacy translation: per-tool excludeTools names over 64 characters stay in adapter form; grants of servers built-in cannot run (sse) are translated, not dropped"
    ids: "P4-DC-06, P4-DC-30"
    closure: "Backlog item (parent line 8); reinstall writes the exact form"
  - gap: "The untrusted-project leg of the grants step is proven by unit test only"
    ids: "P4-DC-18"
    closure: "None planned; harness cannot present an untrusted project to a profile Pi"
---

# Phase 4: Agent Grants Verification Report

**Phase Goal:** A generated pi-subagents agent carries the active implementation's MCP grant, and after a switch the load rewrites only the agent files whose grants changed, never from a background child.
**Verified:** 2026-11-04T18:00:00Z
**Status:** passed (with three recorded accepted gaps, see Warnings)
**Re-verification:** No, initial verification
**Commit verified:** 3a7e910 on `features/mcp-builtin-phase-4`, clean tree

## Goal Achievement

### Observable Truths (ROADMAP Phase 4 success criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Installing, updating, reinstalling, or enabling a plugin whose agent is granted a plugin MCP tool gives that agent the active implementation's server selector, as pi-subagents reports it, under both profiles (MGRT-01) | VERIFIED for every user-invoked verb; cascade-driven updates are an accepted gap (see Warnings) | `install-outcome.ts:1329` passes `active: opts.run.softDeps.mcpImplementation` to `prepareStagePluginAgents`; `update-swap.ts` `prepareUpdateAgents` passes `updateAgentImplementation(args)` (direct run snapshot when `cascade:false`); reinstall (`reinstall-flow.ts:417`, `cascade:false`) and enable (`runInstallLedger`) reach those two call sites. `grant-forms.ts` renders the file in the built-in form only when `active === "builtin"`, else the adapter form. Cucumber `agent-grants.feature`: install, update, reinstall, enable each have an `@adapter-only` / `@builtin-only` pair whose `subagent get` result shows `tools mcp:plugin_demo_stub_/echo` (adapter) and `tools mcp:plugin_demo_stub/echo` (built-in), plus the D-CF6-10 foreground refusal twin. I ran both profiles: adapter 12/12, builtin 5/5. |
| 2   | After a switch and `/reload`, the load rewrites exactly the agent files whose grants changed, atomically under the scope's state lock, with no user action (D-MB-03); with no active implementation, or in a project Pi does not trust, the files stay as they are (MGRT-01) | VERIFIED | `agent-grants-step.ts`: returns for `none` and for a child; user scope, then project only when `ctx.isProjectTrusted()`; takes the lock with `withExistingScopeLock` and passes `assertLockHeld` into `rewriteAgentGrantForms`. `grant-rewrite.ts`: candidates are rows whose recorded `mcpImplementation` differs from the active one and that store the active form (rows that render the same under both carry neither field and are never touched); a file is swapped only when it starts with the recorded block byte for byte (user-edited, missing, foreign files are left); new bytes go to `agents-staging/<uuid>/` and are renamed over the target (NFR-1); the index is saved last; containment (`assertPathInside` plus basename check) precedes every write. Cucumber (`@own-implementation`): the switch scenario shows the runner agent rewritten to `mcp:plugin_demo_stub/echo` while the no-MCP helper agent is unchanged; the no-implementation scenario keeps `mcp:plugin_demo_stub_/echo`; the earlier-release scenario translates a legacy row. Untrusted project: unit case `D-LOC-01` in `test/orchestrators/mcp/agent-grants-step.test.ts` (accepted unit-only, P4-DC-18). Red proof I ran: forcing the step to return early turns the switch and earlier-release scenarios red (2 of 2 failed), then I restored the file. |
| 3   | A background subagent child that loads the extension rewrites no agent file and no other installation state (MGRT-02) | VERIFIED | `platform/subagent-child.ts` reads `PI_SUBAGENT_CHILD === "1"`; I checked the signal against pi-subagents 0.84.0 in the optional-peers cache: `src/runs/background/subagent-runner.js:89` sets it, `src/extension/index.js:225` compares it to `"1"`. The grants step returns before reading the context in a child. `load.ts` `createLoadReconcile(…, env = process.env)` reads the marker on every load and, in a child, runs only the read-only pass with a no-op AMIG-01 move (no autoapply apply, no MCP move). The idempotent MIG-01 and legacy `loadState` migrations stay ungated by design (recorded). Cucumber: "background child with autoapply on installs nothing" (shows only the pending block, project scope has no installed plugins) and "background child leaves an agent's grant in the form it holds" (adapter form kept under built-in). Red proof I ran: forcing `isSubagentChild` to false turns both child scenarios red (2 of 2 failed), then I restored the file. Unit tests cover the marker values (`"1"` only) and the child paths of the step and the load. |

**Score:** 3/3 truths verified, 0 behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `bridges/agents/convert.ts` | Grant selector, `excludeTools` spelling, and async warning per implementation | VERIFIED | `buildMcpGrants` uses `profileFor(id).grantSelector`; `excludeNameFor` keeps the Claude token for the adapter and `profile.toolName` for built-in; `convertAgentForm` gives AG-11 per form |
| `bridges/agents/grant-forms.ts` | Both forms per agent, recorded on the row when they differ | VERIFIED | Substantive and wired from `stage.ts`; the built-in server set is the declared servers whose built-in verdict is supported |
| `bridges/agents/mcp-async-warning.ts` | D-CF6-10 text per implementation | VERIFIED | Adapter text byte for byte as before; built-in ends "Pi's built-in MCP has listed the server's tools still fails" |
| `bridges/agents/grant-rewrite.ts` | Locked swap with containment, staging rename, index saved last | VERIFIED | Read in full; lock-held checks before each rename and before the save |
| `bridges/agents/legacy-grant-form.ts` | Textual adapter-to-built-in translation for earlier-release rows | VERIFIED (with recorded gaps) | Exercised by the earlier-release cucumber scenario and its unit pair |
| `persistence/agents-index-schema.ts` | Additive optional `mcpImplementation` and `mcpForms`; `schemaVersion` stays 1 | VERIFIED | Unit pairs for schema and io pass |
| `orchestrators/mcp/agent-grants-step.ts` | Frozen seed filled; child, none, and trust gates | VERIFIED | Wired through `index.ts` -> `createMcpSessionMaterializer` (frozen files untouched) |
| `platform/subagent-child.ts` | Pure marker reader on an injected env | VERIFIED | Wired from the step and `load.ts` |
| `orchestrators/reconcile/load.ts` | Child gate in the load | VERIFIED | `index.ts` still calls `createLoadReconcile({ loadState }, applyReconcile)`; the new third parameter defaults to `process.env` |
| `features/mcp-server/agent-grants.feature` and step module | Scenarios per verb, switch, no implementation, child | VERIFIED | 12 adapter and 5 builtin scenarios pass |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `agentsPhase` (install, enable, import) | `prepareStagePluginAgents` | `mcpGrantForms.active` from `opts.run.softDeps.mcpImplementation` | WIRED |
| update and reinstall staging | `prepareStagePluginAgents` | `prepareUpdateAgents` -> `updateAgentImplementation` | WIRED for direct runs; PARTIAL for cascade runs (accepted gap) |
| `stage.ts` | agents index row | `convertAgentGrantForms` -> `mcpImplementation`, `mcpForms` | WIRED |
| `session_start` | `agentGrantsStep` | `index.ts` -> `createMcpSessionMaterializer` | WIRED |
| `agentGrantsStep` | `rewriteAgentGrantForms` | `withExistingScopeLock` + `assertLockHeld` | WIRED |
| `resources_discover` | child gate | `createLoadReconcile` reads `process.env` per load | WIRED |

### Data-Flow Trace (Level 4)

The active implementation flows from the run snapshot (`NotificationRun.softDeps.mcpImplementation`, read from Pi's tool and command inventory) into both the install staging and the load step. The cucumber `subagent get` results come from pi-subagents reading the written file, so the written bytes reach the consumer. FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Adapter profile of the feature | `npx cucumber-js --profile adapter features/mcp-server/agent-grants.feature` | 12 scenarios, 169 steps passed (seed 470773) | PASS |
| Builtin profile of the feature | `npx cucumber-js --profile builtin features/mcp-server/agent-grants.feature` | 5 scenarios, 73 steps passed (seed 649569) | PASS |
| Focused unit suites (step, rewrite, child, load, forms, legacy, update-swap, install-outcome) | `node --test …` | 503 pass, 0 fail | PASS |
| Red: child gate disabled | edit `isSubagentChild`, run both child scenarios | 2 of 2 fail; file restored | PASS (scenarios discriminate) |
| Red: grants step disabled | edit the step guard, run switch and earlier-release scenarios | 2 of 2 fail; file restored | PASS (scenarios discriminate) |

### Gate evidence (not re-run by me, logs read)

From `scratchpad/gate-phase/summary.txt` on 3a7e910: lint, check:static, test:unpaired, test:integration, test:coverage:direct:all, test:modules all rc=0; adapter profile 1567/1567; builtin profile 43/43 with only Phase 3's "Update preserves dependency move warnings and MCP notices, under Pi's built-in MCP" excluded. That scenario's expected text still names the adapter's async warning, so it fails under built-in; it is recorded as P4-DC-23 and parent line 1, a Phase 3 file that Phase 4 may not edit. The working tree was clean before and after my red experiments.

### Probe Execution

SKIPPED (no probes declared by this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MGRT-01 | 04-01..05 | Agent grants name the active implementation's server; after a switch and `/reload` the load rewrites only changed files atomically; with no implementation the files stay | SATISFIED (cascade-update staging and the legacy-translation gaps are accepted, see Warnings) | Truths 1 and 2 |
| MGRT-02 | 04-02, 04-04, 04-05 | A background child that loads the extension never rewrites agent files or other installation state | SATISFIED | Truth 3 |

No orphaned requirements: REQUIREMENTS.md maps only MGRT-01 and MGRT-02 to Phase 4.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, or `XXX` marker in any file Phase 4 changed. The boundary diff against the phase base touches 38 files, all Phase 4 owned or named in CONTEXT (`load.ts`, `features/lib/upstream/subagents.ts`); no frozen, closed-set, or sibling-owned file changed. `04-REVIEW.md` found no blocker; of its 11 findings, 7 are fixed (WR-01, 02, 04, 05, 06, IN-01, IN-02) and 4 are knowingly left (WR-03, IN-03, IN-04, IN-05).

### Human Verification Required

None.

## Warnings (accepted gaps, not blockers)

1. **Cascade updates stage the adapter form under built-in until the next load (P4-DC-13/46/60, review WR-03).** A marketplace autoupdate pass, an `apply` convergence move, or a dependency move without a preflight run gets `none` from `updateAgentImplementation`, so its agent files carry `mcp:plugin_<p>_<s>_/...`. Under Pi's built-in MCP that grant does not resolve until the next `/reload`, which the grants step then repairs. The `/reload` after `apply` is what the project's recovery model requires anyway (NFR-2), but a background autoupdate pass can leave a stale grant inside a running session, and pi-subagents re-reads agent files on each call. The phase cannot close it alone: the fix needs Phase 3's `ThreePhaseArgs` field (parent line 2, with a `@builtin-only` scenario to add then). The user-invoked `install`, `update`, `reinstall`, `enable`, and `import` are not affected. I classify this as a WARNING because the roadmap text names the verbs a user runs and the closure is scheduled and tracked; the parent should not drop parent line 2.
2. **Legacy translation gaps (P4-DC-06, P4-DC-30).** An earlier-release agent with a per-tool `disallowedTools` name over 64 characters stays in adapter form under built-in, and an `sse` server's grant is translated rather than dropped. `reinstall` writes the exact form.
3. **Untrusted-project leg is unit-only (P4-DC-18).** The harness cannot start a profile Pi in an untrusted project; `agent-grants-step.test.ts` pins that only the user scope is rewritten.

Two further residual notes, no action needed: the child still runs the idempotent MIG-01 config migration and `loadState`'s legacy migration (recorded as not gated by design, P4-DC-08), and the switch scenarios start from the `none` or adapter-form file, not from a live adapter session (the stored form is identical, so the swap is the same).

## Parent follow-ups still open (from 04-06-SUMMARY.md)

- Parent line 1 in the Phase 4 merge commit: fix the Phase 3 verdict-markers row text, or the builtin gate fails.
- Parent line 2 after Phase 3 merges: repoint `updateAgentImplementation`.
- ROADMAP.md still shows Phase 4 as "In Progress" with unchecked plans 04-04..06; the parent updates it at merge.

---

_Verified: 2026-11-04T18:00:00Z_
_Verifier: Claude (gsd-verifier)_

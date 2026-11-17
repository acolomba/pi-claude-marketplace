# Phase 3: Background Subagents - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver PG-AGENT-01 and PG-HOOK-07a together. Let pi-subagents choose the default
launch mode for ordinary converted agents. Keep plugin tool hooks active in child
sessions without dispatching main-session hooks there. Include child identity in
tool-hook payloads. Preserve compatibility with installed agents and both MCP
implementations. Phase 2 is verified complete; pi-subagents 0.88.1 is already the
test companion version, with the ambient MCP fix adopted.

</domain>

<decisions>
## Implementation Decisions

### Launch mode and existing installations

- **D-PG3-01:** Omit generated `async` for an ordinary agent. Delegate the default
  to pi-subagents and its user configuration; do not introduce another setting.
  This carries PRD decision 1 and the user's standing acceptance of recommendations.
- **D-PG3-02:** Emit `async: true` for explicit `background: true` or MCP tool
  grants. MCP requirements win over `background: false`. Preserve existing
  background-value parsing semantics and the current optional-dependency floor.
- **D-PG3-03:** Existing generated `async: false` changes through update or
  reinstall. Do not silently rewrite all agent files at load. Replace the warning
  that incorrectly says Claude Code defaults to foreground execution. Recognize
  exact legacy warning strings as well as the new strings in MCP grant rewriting,
  including legacy records without an implementation field.

### Child event mapping

- **D-PG3-04:** Model main-session versus child hook routing explicitly. Child
  sessions dispatch PreToolUse, PostToolUse and PostToolUseFailure. Do not dispatch
  main-session SessionStart, UserPromptSubmit, Stop, StopFailure or SessionEnd in
  children. Represent lifecycle counterparts as unsupported subagent events where
  appropriate, leaving their future implementation to PG-HOOK-07b. Inspect and
  explicitly classify compaction events too; the phase's contract is child tool
  hooks only, not a growing ad hoc skip-list.
- **D-PG3-05:** Preserve the initialization, project trust checks, hydration,
  generation guards and tool-hook context delivery needed by child tool hooks.
  Suppressing a hook must not accidentally skip required internal setup. Audit
  orphan reaping and shared PID tables so a child cannot terminate another live
  session's hook processes. Keep child load-time state/grant protections.

### Identity and compatibility

- **D-PG3-06:** Child tool payloads carry the actual agent type and, when knowable,
  a stable child identifier. Main-session tool payloads carry neither. Establish
  the identity source and lifecycle timing from the installed companion and Pi
  APIs before planning implementation. Do not infer an agent name from arbitrary
  task text, confuse a parent identifier with a child identifier, or store one
  child's identity in process-global state shared by concurrent child sessions.
  Missing metadata behavior must be documented and tested; inability to provide
  the required agent type is a research blocker, not permission to fabricate it.
- **D-PG3-07:** Preserve Phase 2 input/result translation, batch semantics,
  matcher behavior and main-session Stop protection. Cover success and failure
  tool hooks, not only PreToolUse.

### Automated evidence

- **D-PG3-08:** Replace the foreground-default behavioral expectation and add
  child/main lifecycle and identity scenarios. Use recording hooks to prove
  suppressed hooks did not run, including a Stop hook that would request another
  turn. Prove both explicit background cases and the delegated default.
- **D-PG3-09:** Automate a real installed pi-subagents child check in addition to
  the existing stand-in. Reuse the isolated stub-provider approach from the
  0.88.1 adoption task. Exercise concurrent children or an equivalent identity
  isolation probe, and migration/grant switching for both MCP implementations.
  Keep normal commit hooks and full `npm run check` combined-tree gates.

### the agent's Discretion

Choose small internal types and test seams, exact warning prose, and plan splits
within the above boundaries. The user's instruction to accept recommendations
and automate validation remains in force. No exception to plan size, security,
coverage or verification gates is granted for this phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `platform/subagent-child.ts` recognizes the exact `PI_SUBAGENT_CHILD=1` marker.
- `bridges/agents/convert.ts`, `mcp-async-warning.ts` and `grant-rewrite.ts` own
  generated launch mode and exact-warning-based legacy grant migration.
- `bridges/hooks/event-router.ts` owns registration, hydration and generation
  binding; dispatch, payload and runtime owners preserve Phase 2 behavior.
- `features/plugin/subagent-child.feature` supplies existing child protection
  scenarios. Hook features supply real command-hook fixtures.
- The adoption task's summary is in
  `.planning/quick/261113-8yn-adopt-pi-subagents-0-88-1-ambient-mcp-fi/`.
  Its live-child fixture is `/tmp/pg1-live-companion-pHdbmd` while available.

### Established Patterns

Use the existing runtime instance for session-local state, exact discriminants,
atomic disk mutations and one mode-selected output channel. Add owner unit tests
and Cucumber scenarios for visible behavior. Source maps are orientation only;
trace current callers with CodeGraph before editing.

### Integration Points

The installed companion publishes child source under
`node_modules/.cache/optional-peers/node_modules/pi-subagents/src/`.
`runs/shared/child-launch.js` passes `agent`, `runId`, `childIndex` and optional
session names to its runtime. That config is not yet proven accessible to this
extension. `shared/child-session-name.js` explicitly calls its output display-only
metadata; do not treat it as authoritative identity without further evidence.
The async runner sets the child marker process-wide and can host multiple
sessions. Research the actual extension-visible identity interface.

</code_context>

<specifics>
## Specific Ideas

Upstream evidence checked 2026-11-13:

- Official Claude Code subagent documentation, sections "Which subagents run in
  the background" and "Define hooks for subagents":
  <https://code.claude.com/docs/en/sub-agents>. Background is the normal default;
  `background: true` forces it. Plugin hooks apply to child tool calls. High
  confidence from current official documentation, consistent with the PRD.
- Official hooks documentation:
  <https://code.claude.com/docs/en/hooks>. Tool events expose `agent_id` and
  `agent_type` for subagents; Stop is a main-agent event. High confidence. Pi's
  source of those fields remains an implementation research question.
- Installed Claude Code is 2.1.323; the PRD baseline is 2.1.322. Do not claim a
  binary probe verified semantics merely from that version comparison.
- Local research inputs: `docs/research/parity-gaps/subagents.md`, `hooks.md`,
  the milestone PRD and ROADMAP Phase 3. Recheck old claims about real-child
  testing: the adoption task has since automated detached child checks.

The user explicitly requested automated behavioral tests before interruption.
Avoid asking them to exercise a child manually when a local fixture can do it.

</specifics>

<deferred>
## Deferred Ideas

PG-HOOK-07b (SubagentStart/SubagentStop support), complete tool-result wrappers
(HOOKRESULT-01), long MCP names, and later phase lifecycle/environment changes
remain outside this phase. No new dependency bump or release is requested.

</deferred>

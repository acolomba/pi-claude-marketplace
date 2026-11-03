---
phase: 08-locality-and-upstream-alignment
plan: 04
subsystem: testing
tags: [agents, mcp, commands, audit, retroactive]
status: complete
retroactive: true

requires:
  - phase: 04-agents
    provides: "agent MCP grants and the agents phase rollback"
  - phase: 03-slash-commands
    provides: "the run_plugin_command tool"
provides:
  - "a guard scenario for each of W2 and W4"
affects: [03-slash-commands, 04-agents, 06-mcp-servers]

plan_head_before: ea9b4ea0cca5dde9cbefeb8cec99fdbe74c67167
plan_head_after: b9f40ad1132e9a5a85a2fbd74120d81c753d5260

key-files:
  modified:
    - features/agent/lifecycle.feature
    - features/slash-command/model-runs.feature
    - features/step_definitions/hook/session.steps.ts
    - features/step_definitions/slash-command/model-runs.steps.ts

key-decisions:
  - "W2 and W4 are not defects; the approved fixes were not added"
---

# Plan 08-04 Summary: Guard scenarios for W2 and W4

## Commits

- b9f40ad test: guard agent rollback and per-session command tool

## What changed

No product code. Two scenarios and one step:

- `features/agent/lifecycle.feature`: "An install that fails in its mcp phase
  leaves no agent of the plugin in the list". The mcp stage throws for every
  declared server it would not write (an unreadable `mcp-adapter.json` when
  the plugin has servers, and both name collisions), and the install then
  undoes the agents phase.
- `features/slash-command/model-runs.feature`: "A new session after the
  plugin's commands are gone no longer offers the tool". Pi 1.4.0 builds a
  new extension runner and tool registry for every `session_start`.
- The setup step "the user has prompted {string}" shares its body with
  "... with the hooks recording".

## Test evidence

The two features plus the four hook features that use the shared step:
50/50 scenarios pass. Probes: without the blocking directory the agent
scenario lists `tools:auditor`; model call 1 of the W4 scenario is offered
the tool.

## Deviations and open points

- The user chose "prepare MCP first" for W2 and "hide when empty" for W4.
  Neither was built, because each would only add code that never runs.
- `listed = undefined` on `session_start` in `edge/command-tool.ts` stays as
  a cheap defence in case Pi ever keeps a runtime across sessions.

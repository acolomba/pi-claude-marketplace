---
status: complete
phase: 02-built-in-materialization
source: [02-VERIFICATION.md]
started: 2026-11-04T16:53:24Z
updated: 2026-11-06T18:30:00Z
audit_acknowledged:
  milestone: mcp-builtin
  at: 2026-11-05
  gap_snapshot: "testing::scenarios=2"
---

## Current Test

[testing complete]

## Tests

### 1. BLT-04 "reported, never silent" is met by info and Pi's /mcp only

expected: Accept, or open a follow-up for a load-time notice of overridden or refused built-in registrations (P2-DC-08, P2-DC-46).
result: pass
reported: "option 2" (user review, 2026-11-06). An `mcp.json` override stays reported by `info` and Pi's `/mcp` only, as Claude Code reports a suppressed duplicate in `/plugin`. A registration Pi refuses because another extension holds the name now reads `not loaded` in `info` instead of the other extension's state (quick 261106-m02, merged in 202ef11; scenario "Plugin info shows a server whose name another extension registered first as not loaded (D-MB-29)" in `features/mcp-server/builtin-status.feature`). No load-time notice and no new message kind.

### 2. Built-in /reload and a new session inside a running Pi re-register plugin servers

expected: In a real Pi with built-in MCP, install a plugin with an MCP server, run /reload, and call its tool; then start /new and call it again. The tool answers each time. Scenarios prove startup only; the new-session scenario runs @adapter-only (P2-DC-77) and /reload itself was never run (P2-DC-88).
result: pass
reported: "1" (user review, 2026-11-06: automate the check). Both legs are now automated under the builtin profile. The `/reload` leg is "The plugin's tool answers through tool search after a reload in the terminal (BLT-01, D-MB-10)" in `features/mcp-server/builtin-reload.feature` (quick 261106-m03, 1b5a90d): a terminal-driven Pi runs `/reload` and the scripted model calls the plugin's tool through `tool_search`; it fails when both re-registration paths are turned off on a reload. The new-session leg is "A new session offers the plugin's tool again (BLT-01)" in `features/mcp-server/lifecycle.feature`, `@mcp` since 06-05. `npm run check` passed on c3547b8 with 1604 adapter and 137 builtin scenarios.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.

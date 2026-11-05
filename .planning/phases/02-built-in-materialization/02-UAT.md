---
status: testing
phase: 02-built-in-materialization
source: [02-VERIFICATION.md]
started: 2026-11-04T16:53:24Z
updated: 2026-11-04T16:53:24Z
audit_acknowledged:
  milestone: mcp-builtin
  at: 2026-11-05
  gap_snapshot: "testing::scenarios=2"
---

## Current Test

number: 1
name: BLT-04 "reported, never silent" is met by info and Pi's /mcp only
expected: |
  A user accepts that an mcp.json override (info: overridden by mcp.json, and Pi's /mcp
  overridden list) and a name another extension registered first (debug log only, P2-DC-46)
  need no load-time notice; otherwise open a follow-up for a load-time notice (deferred idea).
awaiting: user response (end-of-milestone review; accepted provisionally as P2-DC-100)

## Tests

### 1. BLT-04 "reported, never silent" is met by info and Pi's /mcp only

expected: Accept, or open a follow-up for a load-time notice of overridden or refused built-in registrations (P2-DC-08, P2-DC-46).
result: [pending]

### 2. Built-in /reload and a new session inside a running Pi re-register plugin servers

expected: In a real Pi with built-in MCP, install a plugin with an MCP server, run /reload, and call its tool; then start /new and call it again. The tool answers each time. Scenarios prove startup only; the new-session scenario runs @adapter-only (P2-DC-77) and /reload itself was never run (P2-DC-88).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

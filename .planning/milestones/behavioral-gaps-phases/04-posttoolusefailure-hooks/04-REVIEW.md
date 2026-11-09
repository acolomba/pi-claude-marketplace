---
phase: 04-posttoolusefailure-hooks
reviewed: 2026-11-08T20:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - test/bridges/hooks/dispatch.test.ts
  - test/bridges/hooks/event-adapters.test.ts
  - test/bridges/hooks/dispatch-exec.test.ts
  - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
  - features/step_definitions/hook/tool-failure.steps.ts
  - features/hook/tool-failure.feature
  - features/hook/tool-use.feature
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-11-08T20:30:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed inline by the phase session, following `.claude/agents/gsd-code-reviewer.md`, over this phase's own commits only (48dfc857, b07d902a, f627409b, be0bcc62, 80558dad, e07494f7, 30ce4b48); the merged commits of other phases are out of scope. The scope came from the commit list, not from the scope resolver, because the branch carries two milestone merges.

The product changes are small and each sits in the PostToolUseFailure arm: the D-BG-402 guard reads the turn signal only after the empty-bucket check; the D-BG-404 routing reads `details` before the proxy rule, returns Pi's event itself when nothing changes, and never sets `isError` in the handler's return value; the D-BG-405 arm drops a failure hook's replacement and keeps the PostToolUse path; the D-BG-401 field sits after `error` with the deferred fields left out. The unit cases pin the view reads, the block label, and the aborted case. The scenarios state whole literals, and the interrupt step removes its marker on release and waits on records, never on fixed times.

No critical or warning finding. Two info items.

## Info

### IN-01: The adapter code is read through a type assertion

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` (`adapterReportsFailure`)
**Issue:** `(details as { readonly error?: unknown }).error` asserts a shape; an `in` check narrows the same value without one.
**Fix:**
```ts
const code =
  typeof details === "object" && details !== null && "error" in details
    ? details.error
    : undefined;
```

### IN-02: The feature description omits the failing MCP stand-in and `mcp_server`

**File:** `features/hook/tool-failure.feature:3-7`
**Issue:** The description names the scripted model and the recording hooks, but not the stub MCP server whose calls fail, which the MCP pair uses, and its list of absent payload fields leaves out `mcp_server` (D-BG-403).
**Fix:** Name the failing stub server among the stand-ins, and list `tool_use_id`, `duration_ms`, and `mcp_server` as the absent fields.

## Fix Status

Both info items were fixed in 7a9703c8 (`refactor(hooks): narrow the adapter failure code without a cast`). After the fix, prettier, eslint, `tsc --noEmit`, and `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` passed.

---

_Reviewed: 2026-11-08T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer, inline)_
_Depth: standard_

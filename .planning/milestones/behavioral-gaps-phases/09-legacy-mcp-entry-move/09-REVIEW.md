---
phase: 09-legacy-mcp-entry-move
reviewed: 2026-11-08T16:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - features/mcp-server/legacy-move.feature
  - features/step_definitions/mcp-server/legacy-move.steps.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: clean
---

# Phase 9: Code Review Report

**Reviewed:** 2026-11-08T16:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** clean

The review ran inline in the child session, following `.claude/agents/gsd-code-reviewer.md`, because a dispatched subagent runs asynchronously and stalls when the session's turn ends (coordinator rule; P9-DC entry).

## Summary

The phase changed no product file. It adds four `@mcp` scenarios beside the seed and one Given in a new verb module. Each scenario was checked against the cucumber rules:

- every `Given` comes before the first `When`;
- one behavior per scenario;
- no `@mcp` scenario names pi-mcp-adapter;
- whole-literal tables and whole-text file comparisons.

Each scenario was also checked for the question "would a plausible wrong implementation pass?" The executor's red proofs make every scenario fail with the move turned off, under both profiles. A mutation in which the move also deletes the user's unmarked copy fails the AMIG-02 scenario. The Given asserts its own precondition: the text is in two-space form, no server is marked, and the file did not exist (`writeScenarioFile` uses `wx`). All reviewed files meet quality standards. No blocking issues were found.

## Narrative Findings (AI reviewer)

### Info

#### IN-01: The listing wait in the servers-run scenario can be satisfied by the old-name run

**File:** `features/mcp-server/legacy-move.feature:177`
**Issue:** Under the adapter profile, `the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"` can be satisfied by the stub's first-session listing under its old name. The legacy entry carries the same plugin and server arguments. The scenario still fails without the move, because `pi offers these plugin mcp tools:` waits for a tool with the new name and compares the whole table. The red proof confirms this.
**Fix:** None needed. The wait is a frozen step.

#### IN-02: The second-load scenario compares the second load's files to literal text, not to the first load's bytes

**File:** `features/mcp-server/legacy-move.feature:128`
**Issue:** Criterion 3 says "as the first load left them". The scenario compares both files after the second load against the same literal text that the seed pins after the first load. So the two files are byte-identical by construction.
**Fix:** None needed.

---

_Reviewed: 2026-11-08T16:00:00Z_
_Reviewer: Claude (gsd-code-reviewer, inline)_
_Depth: standard_

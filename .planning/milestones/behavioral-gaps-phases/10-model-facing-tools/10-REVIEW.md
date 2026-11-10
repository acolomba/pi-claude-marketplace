---
phase: 10-model-facing-tools
reviewed: 2026-11-08T17:40:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - test/edge/handlers/tools.test.ts
  - features/plugin/model-tools.feature
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-11-08T17:40:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found (Info only)

The orchestrating session wrote this review inline, following `.claude/agents/gsd-code-reviewer.md` (P10-DC-18). The scope is the phase's own commits, f136e248 to 8d6714a1, without the planning files.

## Summary

The product diff is small and stays inside `tools.ts`:

- The list tool's `scope` is forwarded with the same conditional spread the plugin tool uses.
- The not-found result gains `isError: true`, and its text still goes through `textContent`, so the redaction stays.
- The `unavailable` bucket forwards `installed: true`, and the existing bucket re-filter drops the enabled installed rows, so no other filter's result changes. The unit cases and the scenarios cover every filter.
- The early `mp.plugins.length === 0` branch was replaced by one `kept.length === 0` check after the row loop. An unreadable or empty manifest still reads `(no plugins)`, and the failed block still keeps `plugins: []`.

No path throws past `execute`, no new import crosses a boundary, and the tools still write nothing. The unit tests follow the arrange/act/assert shape and the strict boundary mocks of the file. The feature file follows the cucumber rules: no tags, no `And`/`But`, lower-case steps, aligned tables, and whole literals.

## Narrative Findings (AI reviewer)

### Info

#### IN-01: The Background carries the fixture for scenarios that do not read it

**File:** `features/plugin/model-tools.feature:7`
**Issue:** The two refused-scope scenarios do not need the two-scope fixture. features.md says a Background holds only what every scenario needs. The planner chose this on purpose (P10-DC-11): it shows the refusal while valid calls would list both scopes. The cost is about 20 s of fixture per scenario.
**Fix:** None needed. If the adapter lifecycle leg grows short of time, move the two refusals to a file of their own.

#### IN-02: A stale count in a unit-test comment

**File:** `test/edge/handlers/tools.test.ts:177`
**Issue:** The `installNetworkCounter` doc comment says "28 of this suite's 53 cases". The suite has 46. The number was already wrong before this phase (P10-DC-16).
**Fix:** Drop the number, or leave it, as the plan chose.

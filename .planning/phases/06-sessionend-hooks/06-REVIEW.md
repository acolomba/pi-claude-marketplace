---
phase: 06-sessionend-hooks
reviewed: 2026-11-08T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
  - test/bridges/hooks/timeout.test.ts
  - features/step_definitions/hook/session-end.steps.ts
  - features/hook/session-end.feature
  - docs/hooks-compatibility.md
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-11-08T12:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found (info only)

Reviewed inline by the child session, following `.claude/agents/gsd-code-reviewer.md`, because the coordinator ruled that Phase 6 dispatches no subagent (P6-DC-21). The scope is the union of the phase's code commits since `7e961d04`: `9b5beb83`, `c5c5643b`, `737151f3`, `b56e0967`.

## Summary

The cap in `timeout.ts` is a module-private function on the declared-value branch only; the fallback path keeps the per-event table, the background lane is untouched, and the boundary (`<=` the budget kept) and the lane are each pinned by a unit case. Both exec lanes still call `resolveTimeoutSeconds` with their own lane (`dispatch-exec.ts` "blocking", `async-rewake/registry.ts` "background"). The step module exports nothing, checks the saved-session name before building a path under the sandbox agent directory, writes with `wx`, releases the file, fails on extension errors and dialogs, and keeps no command results it would leave uncompared. Each scenario has a recorded red proof. No bug or security issue found.

## Info

### IN-01: SessionEnd scenarios depend on the Node recorder starting within 1.5 s

**File:** `features/hook/session-end.feature` (every scenario with a SessionEnd hook that declares no timeout or a longer one)
**Issue:** The SessionEnd budget kills a hook 1.5 s after it spawns. The recording hook starts a Node process before it records, and under a load average of about 85 on 28 cores the recorder sometimes did not record in time, so the run was missing (seen in `hook/session.feature` too, which predates this phase). The cap does not add this risk: the hooks without a declared timeout had 1.5 s before.
**Fix:** None in Phase 6's files: the recorder and its fixtures are frozen. Recorded as P6-DC-22 for the parent.

### IN-02: A SessionEnd hook with `onFailure: "block"` and a long declared timeout now reports a timeout after 1.5 s

**File:** `extensions/pi-claude-marketplace/bridges/hooks/timeout.ts:85`
**Issue:** With the cap, such a hook is killed at 1.5 s and shows `SessionEnd:<reason> hook error: ... timed out; blocking because onFailure is "block"` where it used to run to its declared time. This matches upstream, which ends the session after its budget whatever a plugin hook declares.
**Fix:** None; the behavior is the intended D-BG-604 parity (P6-DC-01).

---

_Reviewed: 2026-11-08T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer, inline)_
_Depth: standard_

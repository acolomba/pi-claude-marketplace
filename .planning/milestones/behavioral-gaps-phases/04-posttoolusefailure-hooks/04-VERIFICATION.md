---
phase: 04-posttoolusefailure-hooks
verified: 2026-11-08T21:30:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/04-posttoolusefailure-hooks/04-01-PLAN.md
  - .planning/phases/04-posttoolusefailure-hooks/04-01-SUMMARY.md
  - .planning/phases/04-posttoolusefailure-hooks/04-02-PLAN.md
  - .planning/phases/04-posttoolusefailure-hooks/04-02-SUMMARY.md
  - .planning/phases/04-posttoolusefailure-hooks/04-03-PLAN.md
  - .planning/phases/04-posttoolusefailure-hooks/04-03-SUMMARY.md
  - docs/hooks-compatibility.md
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - features/hook/tool-failure.feature
  - features/hook/tool-use.feature
  - features/step_definitions/hook/tool-failure.steps.ts
  - test/bridges/hooks/dispatch-exec.test.ts
  - test/bridges/hooks/dispatch.test.ts
  - test/bridges/hooks/event-adapters.test.ts
  - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
covered_digest: "v4:sha256:86d686a920c07a6e11820ae9727196f161345576e747da83876ea62c75230bc0"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 4: PostToolUseFailure Hooks Verification Report

**Phase Goal:** A failed tool call runs the plugin's `PostToolUseFailure` hooks with Claude Code's payload, matchers select them by tool, and the plugin's `PostToolUse` hooks do not run on it.
**Verified:** 2026-11-08T21:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

Verified inline by the phase session, following `.claude/agents/gsd-verifier.md` (the coordinator moved verification inline). The covered digest was computed after the review fix 7a9703c8.

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | A failed call of a built-in tool other than Bash runs PostToolUseFailure with Claude Code's payload, its error fields included (criterion 1) | ✓ VERIFIED | `tool-failure.feature` R2 states the whole run row for a failed `read`: `tool_name` `Read`, `tool_input`, `error` `Offset 9 is beyond end of file (3 lines total)`, `is interrupt` `false`; green under the adapter profile; red under break (a) |
| 2 | A failed plugin MCP tool call runs PostToolUseFailure under each MCP implementation (criterion 1) | ✓ VERIFIED | the `@adapter-only` (D-BG-404, `Error: echo:ping`) and `@builtin-only` (MHK-01, `echo:ping`) scenarios; adapter red before D-BG-404, builtin red with the wrapper's `isError` removed |
| 3 | A matcher selects by tool name, including an alternation and a plugin MCP tool name (criterion 2) | ✓ VERIFIED | R2: `Read` and `Read\|Edit` select, `Write` does not (red under break b); MCP pair: the full name and `mcp__plugin_hook-demo_stub-server__.*` select, another tool of the server does not |
| 4 | No PostToolUse hook runs on a failed call (criterion 3) | ✓ VERIFIED | R2 and the MCP pair carry a PostToolUse hook that records no run; the existing `tool-use.feature` Bash scenario; red under break (a) |
| 5 | A successful call runs no PostToolUseFailure hook (criterion 3) | ✓ VERIFIED | R3 (bash `echo from-model`): only the PostToolUse `after` row; red under break (a) |
| 6 | A PostToolUseFailure hook's additional context, system message, exit 2, and block decision reach the model or the user as Claude Code delivers them (criterion 4) | ✓ VERIFIED | R4 to R7 state the model's calls and the user's messages whole; each red under its named break |
| 7 | A cancelled running tool runs no PostToolUseFailure hook (D-BG-402) | ✓ VERIFIED | interrupt scenario red before the guard (`failure` ran with `Command aborted`), green after; three unit cases in `dispatch.test.ts` |
| 8 | Every PostToolUseFailure payload carries `is_interrupt: false` after `error`, with `tool_use_id`, `duration_ms`, and `mcp_server` left out (D-BG-401, D-BG-403) | ✓ VERIFIED | translator unit tests and the exact-bytes row in `dispatch-exec.test.ts` (red before the change); `tool-use.feature` row in its own commit f627409b |
| 9 | A PostToolUseFailure hook's `updatedToolOutput` leaves the failed result (D-BG-405) | ✓ VERIFIED | R1 red before the fix (`read returned: replaced`), green after; two unit cases in `event-adapters.test.ts` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `features/hook/tool-failure.feature` | ✓ | 10 scenarios; two carry `@adapter-only` / `@builtin-only`, the rest no tag |
| `features/step_definitions/hook/tool-failure.steps.ts` | ✓ | the failing stub server Given and the interrupt When; exports nothing |
| `bridges/hooks/dispatch.ts` | ✓ | `isCancelledFailure`, `ADAPTER_FAILURE_CODES`, `adapterReportsFailure`, `routedToolResult`, wired in `toolResultCompositeHandler` |
| `bridges/hooks/event-adapters.ts` | ✓ | `failedResultPatch`, wired in the `mutate` arm |
| `bridges/hooks/payloads/post-tool-use-failure.ts` | ✓ | `is_interrupt: false` in the type and the payload |

### Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| TFAIL-01 | ✓ SATISFIED | truths 1 to 6, all four success criteria |

### Anti-Patterns Found

None: no `TBD`, `FIXME`, or `XXX` in the phase's files; the code review's two info items were fixed (7a9703c8).

### Gate Results

- Phase gate on the merged tree (milestone merged at 5adc9828): `npm run check` ran `check:static`, `test:unpaired`, and `test:integration` green; its adapter leg had 1762 of 1770 passing, and the 8 failures (reinstall, update, enable, autoapply, session-start-hooks scenarios, assertion and ENOENT failures unrelated to hooks) passed on one rerun; the builtin leg passed 153 of 153; `test:coverage:direct:all` passed; `npm run test:modules` passed.
- Wave 1 gate: green after load-timeout reruns (5 scenarios, one passed alone). Wave 2 gate on the first merged tree: green after one rerun of 35 unrelated scenarios.

### Human Verification Required

None.

### Gaps Summary

None.

---

_Verified: 2026-11-08T21:30:00Z_
_Verifier: Claude (gsd-verifier, inline)_

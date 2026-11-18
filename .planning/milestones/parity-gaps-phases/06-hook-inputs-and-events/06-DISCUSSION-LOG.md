# Phase 6: Hook Inputs and Events - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 6-Hook Inputs and Events
**Areas discussed:** Child session fields (decision 26), Missing stdin fields (decision 9), `permission_mode` (decision 25), Payload placeholders, Spike S7 and `resume`, `UserPromptExpansion`

Mode: `--auto`. No question was put to the maintainer; each area took the
recommended option, and every answer is pending maintainer review.

---

## Child session fields (decision 26)

| Option | Description | Selected |
|--------|-------------|----------|
| Root main session | `session_id`, `transcript_path`, `CLAUDE_CODE_SESSION_ID` name the session the user runs; `agent_id` stays the child's | ✓ |
| Immediate parent | Name the session that started the child, even for a nested child | |
| Child's own (today) | Keep `session_id` equal to `agent_id` and record a divergence | |

**User's choice:** [auto] Root main session (recommended: Claude Code's shared builder and the `SubagentStop` docs keep the main session in the base fields).
**Notes:** Fallback to the child's own fields, with a debug line, when neither `PI_SUBAGENT_PARENT_SESSION` nor the header's `parentSession` yields a root. Internal keys stay on the child's own id.

---

## Missing stdin fields (decision 9)

| Option | Description | Selected |
|--------|-------------|----------|
| Send now | `tool_use_id`, `duration_ms`, `mcp_server`, `custom_instructions`, `model`, `session_title`, `effort` | ✓ |
| Keep deferred | D-CF5-28 / D-BG-403 stand; PG-HOOK-04 moves to Out of Scope | |

**User's choice:** [auto] Send now (recommended: parity; the old reasons were the harness, not Pi).
**Notes:** `mcp_server` is an object `{name, source}`, not a string, per 2.1.323. A multi-pair edit gets one id per pair. `session_title` also on `UserPromptSubmit` (upstream schema carries it).

---

## `permission_mode` (decision 25)

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it out | Upstream types it optional and omits it on some events; Pi has no modes | ✓ |
| Constant `"default"` | Matches the typical upstream payload; claims prompts Pi does not show | |
| Constant `"bypassPermissions"` | Closest to Pi running tools unasked; claims a disabled safety flag | |

**User's choice:** [auto] Leave it out (recommended: no constant is true, and upstream hooks already tolerate absence).

---

## Payload placeholders

| Option | Description | Selected |
|--------|-------------|----------|
| Ordinal tokens | Project each `tool_use_id` to an ordinal as session ids are; one token for `duration_ms` | ✓ |
| Drop fields before comparing | Strip ids and timings from the literal | |

**User's choice:** [auto] Ordinal tokens (recommended: the literal still shows pre/post equality and a missing field still fails).

---

## Spike S7 and `resume`

| Option | Description | Selected |
|--------|-------------|----------|
| Spike first, then detect by restored entries or a pre-existing session file | HOOKLAUNCH-01 approach; `--continue`, `--resume`, `--session` → `resume` | ✓ |
| Parse Pi's command line | Read `process.argv` for the flags | |

**User's choice:** [auto] Spike first (recommended).
**Notes:** `--fork` → `fork` included if S7 shows the header is readable; otherwise it keeps `startup`. Harness gains a launcher option.

---

## `UserPromptExpansion`

| Option | Description | Selected |
|--------|-------------|----------|
| Every typed template and skill | Upstream fires on every prompt-type command the user types | ✓ |
| Bridged plugin items only | Fire only for staged plugin commands and skills | |

**User's choice:** [auto] Every typed template and skill (recommended: parity).
**Notes:** Not for `source: "extension"` input or model-started skills. Block returns `handled` with upstream's `UserPromptExpansion operation blocked by hook:` text. `command_source` for non-plugin items is left to research.

---

## Claude's Discretion

Module and type names, the edit-pair id suffix, placeholder spellings, the
duration start mark, the launcher option's name, plan splits.

## Deferred Ideas

`CLAUDE_EFFORT` and HOOKENV-01; `prompt_id`, `scratchpad_dir`, the
`UserPromptSubmit` `source`, the resume cost fields; unhonored `SessionStart`
outputs; `mcp_prompt` expansions; hooks in foreground children;
PG-HOOK-07b.

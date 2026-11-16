---
quick_id: 261116-gwm
description: Restore the Original prompt part of the UserPromptExpansion block notice
date: 2026-11-16
---

# Restore the `Original prompt:` part of the `UserPromptExpansion` block notice

Maintainer review 2026-11-16 of D-PG6-18 to D-PG6-22: the `mcp_prompt` skip is
licensed (Pi has no MCP-prompt slash surface), but no Pi gap licenses dropping
Claude Code's `Original prompt:` part of the block notice.

1. Read the upstream contract in the Claude Code 2.1.323 binary -> verify: the
   text, its condition, and `suppressOriginalPrompt` are recorded.
2. Parse `hookSpecificOutput.suppressOriginalPrompt` on a JSON block
   (`wire-protocol.ts`), carry it on the block result, and end the expansion
   block notice with `\n\nOriginal prompt: <prompt>` unless the first block
   suppressed it (`hook-labels.ts`, `dispatch.ts`, `payloads/user-prompt-expansion.ts`)
   -> verify: paired unit tests.
3. Cucumber: the existing block scenario expects the part (fails without the
   change); a new scenario covers `suppressOriginalPrompt`.
4. Docs, CHANGELOG, PROJECT.md row, BACKLOG HOOKORIGPROMPT-01.
5. Gate: `npm run check` exit 0.

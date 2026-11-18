---
phase: quick-261116-p4s
plan: 01
status: complete
subsystem: hooks
tags: [hooks, notices, parity]
key-files:
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
    - features/hook/messages.feature
    - features/hook/prompt-commands.feature
    - features/hook/prompt-expansion.feature
    - docs/hooks-compatibility.md
    - CHANGELOG.md
key-decisions:
  - D-PG6-20 extended to UserPromptSubmit (maintainer decision 2026-11-16, amends D-CF5-24, closes HOOKORIGPROMPT-01)
---

# Quick task 261116-p4s: end the prompt block notice with the original prompt

## Upstream (Claude Code 2.1.323 binary, read, not run)

- `iRe(e)` = `UserPromptSubmit operation blocked by hook:\n${e.blockingError}`.
- `ioo`: `X(iRe(i.blockingError), e, p)`, with `X(e,o,r)` = `r===!0 ? e :
  `${e}\n\nOriginal prompt: ${o}``. `e` is the text passed to the hooks as
  `prompt`. `p` is true for `suppressOriginalPrompt===!0`, for a rescreen of
  a different text (`o!==e`), or for Claude Code's own module states
  (`o1`/`kft`), which Pi has no counterpart of. No truncation.
- The field is read only in the `UserPromptSubmit` and `UserPromptExpansion`
  arms of the `hookSpecificOutput.hookEventName` switch; a `hookEventName`
  other than the running event throws ("hook output names a different hook
  event than the one it ran for").
- An `onFailure: "block"` block sets `suppressOriginalPrompt:!0`.

## Change

`originalPromptOf` passes `InputEvent.text` for `UserPromptSubmit`.
`suppressesOriginalPrompt` requires `hookEventName` equal to the running
event, one of the two prompt events. `onFailureBlock` sets
`suppressOriginalPrompt: true`, which also corrects the expansion notice of
an `onFailure` block after 4d6825ba.

## Divergences left

- A wrong `hookEventName` only drops the field; upstream rejects the whole
  output (HOOKSCHEMAFAIL-01 territory).
- Notices over 2,000 characters are still cut by the hook-notice sanitizer;
  upstream does not cut the prompt.

## Verification

- Paired unit tests: dispatch, wire-protocol, on-failure, dispatch-exec.
- Scenarios: three updated block rows (fail on 4ee6ef4a's dispatch.ts) and
  "A prompt hook that blocks with suppressOriginalPrompt leaves the prompt
  out of the notice"; the failures.feature onFailure rows stay unchanged.
- `npm run check`: exit 0 on 8c64be00 (adapter 2100 scenarios, builtin 204).

## Threat Flags

None -- no security-relevant surface outside the task's scope was introduced.

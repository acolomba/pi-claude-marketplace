---
phase: quick-261116-gwm
plan: 01
subsystem: hooks
tags: [UserPromptExpansion, block-notice, parity]
key-files:
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts
    - features/hook/prompt-expansion.feature
    - docs/hooks-compatibility.md
key-decisions:
  - D-PG6-18 to D-PG6-22 locked by the maintainer review 2026-11-16, with the `Original prompt:` part restored on the `UserPromptExpansion` block notice.
  - The `UserPromptSubmit` notice keeps D-CF5-24 (BACKLOG HOOKORIGPROMPT-01); out of this task's scope.
---

# Quick task 261116-gwm: restore the `Original prompt:` part

## Upstream evidence (read in the binary, not run)

Claude Code 2.1.323 (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`),
the `UserPromptExpansion` runner `$t`:

```js
let n = s ? `/${e.name} ${s}` : `/${e.name}`
...
if (u.blockingError) {
  let p = `UserPromptExpansion operation blocked by hook:\n${u.blockingError.blockingError}`,
      P = u.suppressOriginalPrompt === !0 || o1(M) || kft({isRunReached: !1}) ? p : `${p}\n\nOriginal prompt: ${n}`;
  return { blocked: { messages: [Nt(P, "warning", void 0, !0)], ... } }
}
```

- The part lives only in the user-facing block notice (and its `resultText`),
  never in the stdin or the added context.
- `suppressOriginalPrompt` is read from `hookSpecificOutput` for
  `UserPromptExpansion` (and `UserPromptSubmit`); the exit-2 path sets it only
  for incomplete stdio, never from stdout JSON.
- `o1`/`kft` cover Claude Code's own loaded-module states; Pi has none.

## Changes

- A JSON block carries `suppressOriginalPrompt: true` from the hook output.
- The expansion block notice ends with `\n\nOriginal prompt: /<name>[ <args>]`
  unless the first blocking hook suppressed it.
- Cucumber: the existing block scenario now expects the part (it fails without
  the change); a new scenario covers `suppressOriginalPrompt`.

## Not mirrored

- Upstream's internal suppressions (exit 2 with incomplete stdio, distrusted
  output, a timed-out SDK callback hook).

## Threat Flags

None -- no security-relevant surface outside the task's scope was introduced.

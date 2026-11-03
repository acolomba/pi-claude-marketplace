---
phase: 08-locality-and-upstream-alignment
plan: 02
subsystem: hooks
tags: [hooks, on-failure, upstream-parity, retroactive]
status: complete
retroactive: true

requires:
  - phase: 05-hooks
    provides: "the hook dispatch lanes and onFailure handling"
provides:
  - "whole hook output in both lanes"
  - "onFailure: block decisions as Claude Code 2.1.316 makes them"
affects: [05-hooks]

plan_head_before: 4630208b894286372a845eead891f96f1286c388
plan_head_after: 3795720c013da8cc09f433ff0220f40d33507fd5

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts
  deleted:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - features/hook/tool-use.feature
    - features/hook/failures.feature
    - docs/hooks-compatibility.md

key-decisions:
  - "T-05-33: match upstream fully; HOOKBIGJSON-01 closed"
---

# Plan 08-02 Summary: Hook output matches upstream

## Commits

- 209a4ba fix(hooks): read all hook output and match upstream onFailure
- 3795720 docs(planning): record upstream hook output handling
- ed29766 chore: merge reading all hook output like upstream

## What changed

- Both hook lanes read stdout and stderr whole. The 1 MB stdout and 64 KB
  stderr cuts and the asyncRewake ring buffer are gone.
- A large exit-0 JSON deny now blocks.
- Under `onFailure: "block"`, broken JSON means trimmed stdout that starts
  with `{`, ends with `}`, does not parse, and is not JSON lines.
- A failed hook's JSON block or deny applies with its own reason instead of
  the onFailure message. A timeout still blocks.

## Test evidence

`npm run check` exit 0, cucumber 1568/1568 (seed 140152) on its branch
(DC-42).

## Deviations and open points

- Background (asyncRewake) hooks lost their limits too, so an exit-2
  background hook sends its whole output to the model. That part of Claude
  Code was not read (DC-42 item 6).
- Any JSON the wire protocol reads as a block counts as a kept deny, top-level
  `decision: "block"` included (item 7).
- JSON lines means more than one non-empty line that each parse; upstream's
  exact rule was not in the excerpts (item 8).
- Still in BACKLOG: a hook whose output never ends hangs the turn where
  upstream blocks (HKDR-01), and output schema validation
  (HOOKSCHEMAFAIL-01) (item 9).
- The upstream evidence is a static read of the 2.1.316 binary; no live probe
  ran (item 10).

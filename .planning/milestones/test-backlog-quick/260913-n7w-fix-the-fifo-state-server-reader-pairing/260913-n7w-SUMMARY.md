---
quick_id: 260913-n7w
slug: fix-the-fifo-state-server-reader-pairing
date: 2026-09-13
status: complete
commits: 1
plan_head_before: e3c116988928eb39433c69f4721a327139eca07f
---

# Quick Task 260913-n7w Summary

The FIFO state-server harness now hands exactly one payload to each reader open, enforced by
a new deterministic gate that was observed failing against the old server and passing against
the new one.

## What changed

**`tests/orchestrators/plugin/state-fifo.ts`** — the server retires each FIFO inode from the
namespace by `rename`, while it still holds that inode open for write, before the payload
write. Spares are pre-created once per payload as hidden siblings of the state path
(`.state-fifo-spare-N`), so each handoff is a single atomic `rename` and no fork happens while
a reader is parked. The write-open is the numeric `constants.O_WRONLY`, never the `"w"` string
— `"w"` carries `O_CREAT`, which would silently put a regular file at a missing path and
dissolve the barrier, where a bare `O_WRONLY` makes that case a loud `ENOENT`.

Loop order is the fix: open, **rename**, write, close. The header's false sentence ("Each open
pairs exactly one reader with one writer") is replaced with the inode-level account, the
`SERVER_SOURCE` JSDoc now describes the barrier as it stands, and the over-read limitation is
recorded in one sentence.

**`tests/architecture/state-fifo-pairing.test.ts`** (new) — holds a reader's fd open across a
200 ms gap, which makes the interleaving a loaded scheduler produces occasionally into an
unconditional one. It asserts the first payload, then the second, then `complete`,
`messages`, `isFIFO()`, and a `readdir` no-litter check.

`reinstall-flow.test.ts` and `uninstall.test.ts` are unmodified — `git diff` over the commit
range touches exactly the two files above.

## Both directions of the gate

**RED, against the unfixed harness** (exit 1, 337 ms — no hang):

```
AssertionError [ERR_ASSERTION]: one reader open must receive exactly one payload
  actual:   '{"schemaVersion":2,"marketplaces":{}}\n{"schemaVersion":2,"marketplaces":{},"x":1}\n'
  expected: '{"schemaVersion":2,"marketplaces":{}}\n'
  operator: 'strictEqual'
```

`actual` is the two payloads concatenated, which is the exact defect signature. The failure
landed in 337 ms rather than at the 60 s timeout, confirming the deliberate assertion
placement between the two reads does what it was put there to do.

**GREEN, against the fixed harness:** `1 pass, 0 fail` in 1.15 s. Running the gate together
with both consumer suites: `178 pass, 0 fail`.

## Verification

| Check | Result |
| --- | --- |
| Gate against unfixed harness | fails, with the expected message and concatenated `actual` |
| Gate against fixed harness | passes (1/1) |
| Gate + `reinstall-flow.test.ts` + `uninstall.test.ts` | 178 pass, 0 fail |
| `npm run typecheck` | exit 0 |
| Saturated soak, 30 runs, 56 CPU burners on 28 cores | `fails=0/30` |
| `npm run check` | exit 0 (`fallow dead-code` clean, `0 above threshold`) |
| `SKIP=trufflehog pre-commit run --all-files` | exit 0, every hook Passed or Skipped |
| Comment-policy grep (`phase N`/`plan N`/`wave N`/`used to`/`no longer`/`formerly`) | no matches |
| `git status --porcelain` after commit | clean apart from `.planning/` |

The soak used the plan's exact command shape. Load average confirmed the burners were reaped
afterwards (dropped to 1.55). No pre-commit hook rewrote any file, so no follow-up commit was
needed.

## Commit

`e4f12cce` — `fix(tests): serve exactly one payload per state FIFO reader open`

## Deviations from Plan

**1. [Rule 2 — missing critical functionality] `server.kill()` hoisted out of the `try` body.**

The plan asked for `server.kill()` and `rm(dir, ...)` in the gate's `finally`. Declaring
`server` inside the `try` would have put it out of scope there, so it is declared as
`let server: FifoStateServer | undefined` before the `try` and torn down with `server?.kill()`
in the `finally`. Without this, an assertion failure anywhere in the test would leave the
child server running to its 30 s watchdog. This added one type-only import of
`FifoStateServer`, placed last per `import-x/order`.

No other deviations. The settled design was implemented as specified; ENXIO polling and
unlink-plus-mkfifo were not revived.

## Notes for the operator

- The stray research probe `r.mjs` was already moved out of the repository root before this
  task ran. It now sits at
  `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-random-refinements/49452895-350c-48b6-b091-1f172400907c/scratchpad/r.mjs`
  — reclaim or discard it as you prefer. `fallow dead-code` is clean without it.
- TruffleHog was skipped on the commit and on the `pre-commit` run. This checkout is a git
  worktree, so the hook fails with `failed to read index file: .git/index: not a directory`.
  Environmental and pre-existing.
- The over-read hang is now documented in the harness header rather than fixed. An
  orchestrator that reads more times than there are payloads blocks in `open` until the test's
  own 60 s timeout, because the server has exited and its watchdog is already cleared. Every
  candidate design preserves this; closing it needs a timer, which the plan ruled out.

## Known Stubs

None.

## Self-Check: PASSED

- `tests/architecture/state-fifo-pairing.test.ts` — FOUND
- `tests/orchestrators/plugin/state-fifo.ts` — FOUND
- Commit `e4f12cce` — FOUND in `git log`

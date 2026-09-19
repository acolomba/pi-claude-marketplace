---
quick_id: 260913-r2h
slug: make-a-fifo-harness-over-read-fail-loudl
date: 2026-09-13
status: complete
commit: c45850af
---

# Quick Task 260913-r2h Summary

Made the FIFO state harness answer an over-read with a named sentinel instead of parking a reader
until the test timeout, and added a gate that proves it in two seconds.

## What changed

One decision inside the server's spare-creation loop, exactly as planned. `spares[0..N-2]` are
still `mkfifo`'d; `spares[N-1]` is now a regular file holding `OVER_READ_SENTINEL`, passed to the
child over a new `PI_CM_FIFO_SENTINEL` env var. The serve loop is untouched, so the final rename
installs the sentinel at the state path at the same instant it retires the last paired inode —
there is no moment at which a writerless FIFO sits at the path for a reader to park on. No probe,
no `O_NONBLOCK`, no ENXIO, no new timer in the harness.

Files:

- `tests/orchestrators/plugin/state-fifo.ts` — the sentinel export, the env var, the indexed spare
  loop, `writeFile` added to the server's `node:fs/promises` import, and the two header paragraphs
  (the former "one limitation" note and the second caller invariant) rewritten to state the new
  behavior.
- `tests/architecture/state-fifo-pairing.test.ts` — the node-type assertion swapped for a content
  comparison, plus a new test `an over-read of the state FIFO returns the sentinel instead of
  blocking` that races the over-read against a 2 s module-level deadline and then proves the same
  bytes reach the production reader via `assert.rejects(loadState(...))` on an `OVER-READ` message.
- `tests/orchestrators/plugin/reinstall-flow.test.ts:5006` and
  `tests/orchestrators/plugin/uninstall.test.ts:1768` — both `(await stat(...)).isFIFO()`
  assertions replaced with `readFile` content equality against the sentinel, messages unchanged.

## Both directions, measured

The gate is shown to fire, not merely to pass.

| Shape | Over-read result | Elapsed |
|---|---|---|
| Before (today's harness, direct probe) | `BLOCKED` — read never returned; the pending `open` kept the process alive and the external `timeout` killed it (exit 124) | 2003 ms to the deadline, then hung |
| After, immediate over-read | returns `OVER_READ_SENTINEL` | ~1 ms (gate test: 161 ms end to end) |
| After, RED control (last spare forced back to `mkfifo`) | gate fails with `actual: 'BLOCKED'` vs the sentinel string | **2180 ms** |

The RED control's failure text, which is the diagnosis the old shape could not produce:

```
✖ an over-read of the state FIFO returns the sentinel instead of blocking (2180.495894ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + 'BLOCKED'
  - 'OVER-READ: the FIFO state harness had no payload left for this read\n'
```

Task 1's intermediate verification also behaved exactly as predicted: with the harness changed and
the orchestrator assertion not yet swapped, the reinstall test failed **only** at line 5006
(`a marketplace-not-added abort must leave state.json untouched`, `actual: false`), with every
assertion before it — `served:1`/`served:2`, `{ code: 0, signal: null }`, empty stderr, the
notification text — passing. That is what proves the harness change did not disturb the serve
sequence.

Existing pairing contract after the change: green both before and after (`the state FIFO server
delivers exactly one payload per reader open`, including the unchanged no-litter assertion — a
clean run still leaves exactly `['state.json']`).

## Soak under saturation

64 CPU burners on a 28-core box (`load average: 68`), 40 iterations, each running the reinstall
concurrent-removal test and the full pairing gate file:

```
burners: 64 on 28 cpus
soak fails=0
```

80 runs, zero failures, zero `timeout` kills. Burners were killed by a `trap`; verified afterwards
that none survived.

## Gate

- `npm run check` — exit 0 (typecheck, lint, workflow lint, fallow, format, corresponding-test
  gates, unit, integration).
- `SKIP=trufflehog pre-commit run --all-files` — every hook Passed (TruffleHog Skipped by the
  documented worktree workaround). Nothing was rewritten by `prettier`/`yamlfmt`; `git status` was
  clean of tracked changes immediately after the commit.

## Deviations from plan

**1. [Rule 3 - Blocking] `stat` had to be dropped from `reinstall-flow.test.ts` too.**

The plan (line 144) stated that `stat` stays in use in both orchestrator test files and only the
pairing gate loses it. That is wrong for `reinstall-flow.test.ts`: its other two `stat` call sites
(lines 2385, 2402) go through `(await import("node:fs/promises")).stat`, so line 5006 was the only
consumer of the top-level import. Leaving it would fail `noUnusedLocals` /
`@typescript-eslint/no-unused-vars`. Dropped it there as well. `uninstall.test.ts` keeps its
`stat` import (lines 2041, 2067, 3457, 3480, and others still use it), as planned.

**2. [Rule 3 - Blocking] Import-group blank line.** The new `loadState` import was first placed in
its own group, separated by a blank line from the `state-fifo.ts` import. `import-x/order` treats
`../../extensions/...` and `../orchestrators/...` as the same parent group, so ESLint failed with
`There should be no empty line within import group`. Removed the blank line; the two sit adjacent,
`../../extensions/...` first.

**3. Single commit rather than per-task commits.** Task 1's verification deliberately leaves the
reinstall test red (its assertion is swapped in task 2), so committing at that boundary would have
put a knowingly-failing tree in history. The plan itself places the only commit in task 3, and that
is what was done: one commit, `c45850af`, staging the four touched test files by explicit path.

## Worth knowing

Under the RED control the gate reports its failure at ~2.2 s, but the test **file's** process still
cannot exit afterwards — the reader parked in `open` holds a libuv handle, so `node --test` prints
`Promise resolution is still pending but the event loop has already resolved` and waits for the
child. That lingering process is a property of the failure being demonstrated (a writerless FIFO),
not of the fix; on the green path nothing parks and the file exits normally. The diagnosis still
arrives in seconds with the cause named, which is the whole point of the change.

## Self-Check: PASSED

- `tests/orchestrators/plugin/state-fifo.ts` — FOUND, contains `OVER_READ_SENTINEL`
- `tests/architecture/state-fifo-pairing.test.ts` — FOUND, 2 tests pass
- `tests/orchestrators/plugin/reinstall-flow.test.ts` — FOUND, assertion swapped
- `tests/orchestrators/plugin/uninstall.test.ts` — FOUND, assertion swapped
- Commit `c45850af` — FOUND in `git log`, 4 files changed, 107 insertions, 23 deletions, no
  deletions of tracked files
- Scratch work confined to the session scratchpad; `git status` shows only the untracked task
  planning directory

---
phase: 01-harness-on-system-git
fixed_at: 2026-11-23T00:00:00Z
review_path: .planning/phases/01-harness-on-system-git/01-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-11-23
**Source review:** .planning/phases/01-harness-on-system-git/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (WR-01, WR-02; scope `critical_warning`, no Critical findings)
- Fixed: 2
- Skipped: 0
- Out of scope, left in REVIEW.md: IN-01, IN-02, IN-03, IN-04, IN-05

## Fixed Issues

### WR-01: A held probe stub has no bound on its own lifetime, so a caller that dies leaves it running

**Files modified:** `features/lib/ssh-git-host/stub.ts`, `features/lib/ssh-git-host/host.ts`, `test/architecture/ssh-git-host.test.ts`
**Commit:** 2a5adcc
**Applied fix:** The stub reads its caller's pid (`process.ppid`) when the
module loads, before it records the launch. A held probe checks once a second
whether its parent is still that caller and exits with 255 when it is not. It
also exits after a five-minute hard limit. The pid is read at load and not
when the hold starts: a caller killed between the launch record and the hold
would otherwise go unseen. The headers of `stub.ts` and `host.ts` now say
that a held stub ends when its caller dies. A new case, "ends a held probe on
its own once its caller dies", starts the probe under a `/bin/sh` caller,
SIGKILLs the shell, and waits for the stub to exit. Against the old stub it
fails ("these processes still run after 10000 ms"). With the fix it passes.
The optional `SshGitHost.close()` SIGKILL was not added, because a pid can be
reused.

### WR-02: The held-probe test kills the stub 300 ms after spawn, which can race the stub's own startup

**Files modified:** `test/architecture/ssh-git-host.test.ts`
**Commit:** 2913837
**Applied fix:** The case no longer has `execFile` kill the stub 300 ms after
spawn. It spawns the probe through a new `startHeldProbe` helper and waits for
the launch record with `firstLaunchSince`. It then waits 300 ms more
(`ANSWER_WAIT_MS`), so a stub that answered would have exited, and sends
SIGTERM. It asserts that the exit is `{ exitCode: null, signal: "SIGTERM" }`,
that the recorded pid is the child's pid, and that no stub still runs. The
reset case uses the same helper. `runSsh` no longer takes a `timeout`
parameter or returns the `signal` and `killed` fields, because no case reads
them now.

## Verification

All checks ran in the main checkout `/home/user/pi-claude-marketplace` on
`features/system-git`. No worktree was used (`workflow.use_worktrees` was
off for this run), so the results can be reproduced from that tree.

- `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/architecture/ssh-git-host.test.ts`:
  36/36 passed three times in a row, and 36/36 in each of three copies run at
  the same time to load the machine. No stub process was left running.
- The new WR-01 case failed against the old `stub.ts` and passed with the fix.
- `npm run typecheck`: passed.
- `npx eslint --max-warnings 0` on the three changed files: passed.
- `npm run fallow`: passed (exit 0).
- The pre-commit hook (`npm run check:commit`, gitlint, and the fixers)
  passed on both commits.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

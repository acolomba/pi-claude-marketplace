---
phase: 02-git-process-seam-and-typed-failures
plan: "01"
subsystem: platform
tags: [child-process, process-group, timeout, stdin, windows-path, launcher]

requires: []
provides:
  - "platform/process-run.ts: the shared, spawn-injected launcher (runProcess, findOnWindowsPath, NODE_PROCESS_HOST, and the launcher contract types)"
  - "stdin input followed by end-of-file, with EPIPE swallowed (SG-PRC-01)"
  - "per-stream head or tail capture with surrogate-safe cuts"
  - "windowsHide passed to every launch of a run, the taskkill launches included"
  - "findOnWindowsPath with a caller's extension list and accept predicate (D-SG-04)"
  - "test/platform/process-fake.ts: createProcessFake with a recording spawn and stdin control"
affects: [02-03 git-process module, 02-04 git stderr ladder, package-install]

actuals:
  tokens: 18700
  tasks: 2
  commits: 2
plan_head_before: 6c342521c28e874354a0e98522353c306392be1c
plan_head_after: b47620b

tech-stack:
  added: []
  patterns:
    - "Launcher injection: the shared module imports nothing from Node's child-process module; each runner owns its spawn binding (D-PL9-11, D-SG-01)"
    - "OutputCapture { limit, keep: head | tail } per stream instead of one module-level cap"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/process-run.ts
    - test/platform/process-run.test.ts
    - test/platform/process-fake.ts
  modified:
    - extensions/pi-claude-marketplace/platform/package-manager.ts
    - test/platform/package-manager.test.ts

key-decisions:
  - "runProcess keeps its own abort precheck (message `Process run aborted`); the package manager keeps its own precheck and message `Package manager run aborted`, run at the same point as before (after the Windows lookup)"
  - "taskkill launches always close stdin (stdio[0] `ignore`), even when the run they stop had input"
  - "The package-manager-only launcher type aliases (PackageManagerProcess, PackageManagerSpawnOptions, PackageManagerSpawn) are gone; their only users were the moved tests. The six names package-install.ts and its test import are unchanged"

patterns-established:
  - "One describe() per exported entrypoint in test/platform/process-run.test.ts (runProcess, findOnWindowsPath, NODE_PROCESS_HOST)"

requirements-completed: ["SG-PRC-01", "SG-PRC-02"]

coverage:
  - id: D1
    description: "The package manager runs through the shared launcher with the same argv, environment, messages, timeouts, process-tree kill, 65,536-character head captures, and npm lookup, plus windowsHide false"
    requirement: "SG-PRC-02"
    verification:
      - kind: unit
        ref: "test/platform/package-manager.test.ts"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/package-install.test.ts"
        status: pass
      - kind: other
        ref: "npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/platform/package-manager.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "runProcess: no shell, argument arrays, a POSIX process group, and a timeout or abort that stops the whole tree (group SIGTERM, then SIGKILL; taskkill /T /F on Windows), with a closed or fed-then-closed stdin"
    requirement: "SG-PRC-01"
    verification:
      - kind: unit
        ref: "test/platform/process-run.test.ts#runProcess"
        status: pass
      - kind: other
        ref: "npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/platform/process-run.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "findOnWindowsPath with caller extensions and accept predicate"
    requirement: "SG-PRC-01"
    verification:
      - kind: unit
        ref: "test/platform/process-run.test.ts#findOnWindowsPath"
        status: pass
    human_judgment: false
  - id: D4
    description: "Windows behavior of the tree kill, windowsHide, and the PATH lookup on a real Windows host"
    verification: []
    human_judgment: true
    rationale: "The Windows cases run against a fake win32 host; no Windows runner is available here. The phase's manual Windows check covers it"

duration: 34min
completed: 2026-11-23
status: complete
---

# Phase 2 Plan 01: Shared Process Launcher Summary

**`platform/process-run.ts` is the one spawn-injected launcher, moved out of the package manager. It adds stdin input followed by end-of-file with EPIPE swallowed, a head or tail capture per stream, `windowsHide`, and a Windows PATH lookup with the caller's own extensions and accept predicate. The package manager runs on it with no behavior change except `windowsHide: false`, which is Node's default.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-11-23T13:46:38Z
- **Completed:** 2026-11-23T14:20:32Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- The D-PL9-15/18/19 launcher moved, not copied, into `platform/process-run.ts`. It imports nothing from Node's child-process module, so the `child-process-chokepoint` rule never needs to name it. `platform/package-manager.ts` keeps `NODE_PACKAGE_MANAGER_SPAWN = spawn as ProcessSpawn`, the npm.cmd to npm-cli.js launch, the notifier variable, and its abort message.
- SG-PRC-01: a run without input starts with stdin `ignore`. A run with input, the empty string included, gets a stdin pipe that receives the text and then ends. An EPIPE from a child that exits first stays inside the run, and the run settles on `close` with that close's code. A real-child case shows the crash this prevents, with a 4 MiB write to a child that exits at once.
- Each stream takes an `OutputCapture`. `keep: "tail"` keeps the last `limit` characters and drops a leading low surrogate. `keep: "head"` keeps the old prefix rule and drops a trailing high surrogate.
- SG-PRC-02 adjacency cases: a process that closes 1 ms before its timeout settles with its own code and `timedOut: false`. A process that closes during the kill grace settles with its code and `timedOut: true`.
- `findOnWindowsPath(command, env, host, { extensions, accept? })` returns the first candidate that is a file and that `accept` does not refuse. It goes in PATH order, and in extension order inside each directory. npm passes `[".exe", ".cmd"]` and no predicate.

## Task Commits

1. **Task 1: Move the launcher into platform/process-run.ts with the package manager's behavior unchanged:** `c1939b8` (refactor)
2. **Task 2: Give the launcher stdin input, a tail capture, a hidden console, and a parameterized Windows lookup:** `b47620b` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## TDD Evidence

RED and GREEN went into one commit per task. The commit hook runs typecheck and every architecture test, so it rejects a commit that holds only failing tests. Each RED was run locally first.

**Task 1 (tracer, a pure move).**

- RED: I ran `node --import scripts/isolated-pi-home.mjs --test test/platform/process-run.test.ts` with `process-run.ts` set aside. Exit 1: `tests 1, fail 1`, `test/platform/process-run.test.ts ... 'test failed'`.
- Semantic assessment: this is a load failure (the module did not exist), not an assertion failure. A strict classifier would call it INVALID_RED. That is expected here, because the task moves existing behavior and adds none, so a moved case cannot fail on its assertion before the move.
- GREEN: after the move, the three owner tests ran 135/135 pass.
- Tracer gate: all three `verify` commands passed again on the committed tree, so execution expanded into Task 2.

**Task 2.**

- RED: the new cases ran against Task 1's launcher, with the fake already extended (TAP reporter). Exit 1: `tests 62, pass 50, fail 12`. The failing targets:
  - the spawn-options case (no `windowsHide`, and in the package-manager test, no `windowsHide: false`)
  - both input forms (`stdio[0]` was `ignore` and nothing reached stdin)
  - the EPIPE case (`error: 'write EPIPE'`, because nobody listened on stdin)
  - the head/tail, fatal-line, and surrogate capture cases (actual differs from expected)
  - both taskkill cases (no `windowsHide`)
  - the two D-SG-04 lookup cases (expected `C:\Git\cmd\git.exe`, actual `C:\project\git.exe`, because the extensions and `accept` were ignored)
- Semantic assessment: every target failed on its planned assertion. None failed on a load or syntax fault.
- GREEN: 147/147 pass. Then 149/149, after adding the two real-child stdin cases.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/process-run.ts`: the shared launcher. It holds the spawn contract, `runProcess`, the capture, the kill timers and tree kill, the stdin feed, `findOnWindowsPath`, and `NODE_PROCESS_HOST`.
- `extensions/pi-claude-marketplace/platform/package-manager.ts`: the npm and bun runner over `runProcess`. It keeps its own spawn binding, the npm launch, its head captures, and `windowsHide: false`.
- `test/platform/process-run.test.ts`: the moved generic cases plus the new stdin, capture, adjacency, `windowsHide`, and lookup cases, with one `describe` per entrypoint.
- `test/platform/package-manager.test.ts`: only the package-manager cases. It adds a head-capture pin and a case showing that the host shares `NODE_PROCESS_HOST`'s probe and group signal.
- `test/platform/process-fake.ts`: `createProcessFake(pid?)`. It provides `process`, a recording `spawn` with `launches()`, and `close`, `fail`, `failInput`, `input`, `inputEnded`, `kills`, `writeStdout`, and `writeStderr`.

## Decisions Made

- `runProcess` has its own pre-abort result (`Process run aborted`, with the signal reason as cause). The package manager checks first and keeps `Package manager run aborted`, at the same point as before, after the Windows lookup.
- The taskkill launches use `stdio[0] = "ignore"` even when the run has input, because taskkill reads nothing.
- `ProcessRequest.signal` is `AbortSignal | undefined`, so a runner can pass its optional signal through without a branch (`exactOptionalPropertyTypes`).
- `RunningProcess.stdin` is optional and may be `null`, which matches Node's `ChildProcess.stdin`. A run with input and no stdin stream writes nothing.

## Lines for later plans

Symbols whose final shape differs from the plan's artifacts table or `<interfaces>`:

- `findOnWindowsPath`'s fourth parameter is an inline type `{ readonly extensions: readonly string[]; readonly accept?: (candidate: string) => Promise<boolean> }`. No named `WindowsLookup` type is exported. `accept` runs only for a candidate that is a file.
- `package-manager.ts` no longer exports `PackageManagerProcess`, `PackageManagerSpawnOptions`, or `PackageManagerSpawn`. Use `RunningProcess`, `ProcessSpawnOptions`, and `ProcessSpawn` from `process-run.ts`. `PackageManagerHost` now `extends ProcessHost` with `execPath`. `PackageManagerRun` is an alias of `ProcessRun`.
- `ProcessSpawnOptions` is `{ cwd, env, shell: false, stdio: readonly ["ignore" | "pipe", "pipe", "pipe"], detached, windowsHide }`.
- The fake also exports the `ProcessControl` and `ProcessLaunch` types. Its `spawn` returns the same `process` on every call, so a case that needs a second process, such as a taskkill stand-in, builds its own launcher. `fail` and `failInput` throw when nothing listens, as Node's EventEmitter does.
- One moved test title was reworded for the generic module: `D-PL9-19: stops the whole process tree of a package manager that outlives the timeout` became `... of a process that outlives the timeout`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Private type leak in the new module's exported shapes**

- **Found during:** Task 1
- **Issue:** `fallow dead-code` reported `RunningProcess` and `ProcessHost` referencing the private alias `KillSignal`.
- **Fix:** I inlined `"SIGTERM" | "SIGKILL"` in the exported shapes, as the original module did. The alias stays private for internal functions.
- **Files modified:** `extensions/pi-claude-marketplace/platform/process-run.ts`
- **Verification:** `npm run fallow` passes.
- **Committed in:** `c1939b8`

**2. [Rule 3 - Blocking] Clone group between the moved fake and `credential-process-fake.ts`**

- **Found during:** Task 1
- **Issue:** `fallow dupes` found a 15-line clone of `test/platform/credential-process-fake.ts:128-142` once the fake moved into its own module.
- **Fix:** I rebuilt the fake around a small `listeners()` helper (early-return `on`, `kill` last). The fake's behavior did not change.
- **Files modified:** `test/platform/process-fake.ts`
- **Verification:** `npm run fallow`, dupes included, reports no clone group.
- **Committed in:** `c1939b8`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** Both were gate fixes inside the planned files. No scope change.

## Issues Encountered

- My first Task 1 commit failed in the hook. ESLint ran out of heap (`JavaScript heap out of memory`) because my commit script had unset the session's `NODE_OPTIONS` (`--use-openssl-ca --max-old-space-size=8192`). I kept that variable, and the retry passed every hook. A second retry fixed a 73-character title, which gitlint rejected. No commit was amended, and no hook was skipped.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The four mitigations hold: T-02-01, the moved tree-kill cases (fake and real process tree); T-02-02, the fake and real EPIPE cases; T-02-03, the head and tail caps; T-02-04, `grep -c 'from "node:child_process"' process-run.ts` is 0.

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

- Plan 02-03 can call `runProcess` with its own `NODE_GIT_SPAWN`, `input`, `stderr: { limit: 65_536, keep: "tail" }`, and `windowsHide: true`. It can call `findOnWindowsPath("git", env, host, { extensions: [".exe", ".cmd", ".bat"], accept })`.
- `npm run check` on the combined tree is left to the wave gate.

## Self-Check: PASSED

- FOUND: `extensions/pi-claude-marketplace/platform/process-run.ts`, `test/platform/process-run.test.ts`, `test/platform/process-fake.ts`
- FOUND: commits `c1939b8` and `b47620b`, both ancestors of HEAD
- `git rev-list --count 6c342521..HEAD` is 2 before this SUMMARY commit
- All acceptance greps of both tasks re-ran PASS. The plan's `<verification>` commands passed on the final tree: 149 tests, 100% direct coverage on both pairs, typecheck, fallow, and eslint.

---

*Phase: 02-git-process-seam-and-typed-failures*
*Completed: 2026-11-23*

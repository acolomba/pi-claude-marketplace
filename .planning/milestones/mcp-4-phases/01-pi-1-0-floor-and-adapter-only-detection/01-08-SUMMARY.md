---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 08
subsystem: e2e
tags: [e2e, rpc, real-pi, detection]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "Pi 1.0 floor (01-01); two-arm adapter probe and builtinMcpTool()/builtinMcpCommand() seeds (01-05); info requires line (01-07)"
provides:
  - "tests/e2e/_rpc.ts: runRpcSession drives the repository's Pi CLI in RPC mode in a sandbox; exports RpcStep, RpcSandbox, RpcSessionOptions, RpcNotify, RpcResponseRecord, RpcSessionResult, ListedCommand, promptDisposition, listedCommands"
  - "tests/e2e/adapter-detection-rpc.test.ts: five real-Pi MCP states through install, list and info, plus two harness refusal cases"
  - "A live check, on every e2e run, that Pi 1.0's built-in MCP inventory equals the mock-matrix seeds"
affects: [01-09, e2e, soft-dep-probe]

actuals:
  tokens: 8300
  tasks: 2
  commits: 1
plan_head_before: d409121b6babacf4962f2b8557feb16a8a0b2891
plan_head_after: b02c9ed322bbf44f268b77a335e35b0ed3960538

tech-stack:
  added: []
  patterns:
    - "A real-Pi RPC case writes its fixtures (marketplace, stub MCP server, plain-JS extensions) into its hermetic sandbox and proves its state through get_commands and an inventory-probe command before reading rows"
    - "A process-lifetime claim is proven by a sentinel PID that only the code under test can stop, with a negative control that removes that code"

key-files:
  created:
    - tests/e2e/_rpc.ts
    - tests/e2e/adapter-detection-rpc.test.ts
  modified:
    - tests/platform/pi-inventory-seed.ts

key-decisions:
  - "Pi 1.0 starts each stdio MCP server in its own process group and stops it on shutdown, so the RPC harness's group kill cannot reach it; the clean-exit sweep is proven by a same-group sentinel child, and the stub MCP server's PID proves only that no server outlives the session"

patterns-established:
  - "tests/e2e/_rpc.ts is the one way a test runs real Pi over RPC: allowlisted env, --offline --no-session, never --no-extensions, sandbox under the OS temp dir and outside the repository"

# ADET-01 and ADET-02 were also delivered by plans 01-05 (probe and unit
# matrix), 01-06 (e2e mock matrix) and 01-07 (info line). This plan is the
# last owner; after it every phase success criterion for both holds.
requirements-completed: [ADET-01, ADET-02]

coverage:
  - id: D1
    description: "With only Pi's built-in MCP active (mcp from builtin:mcp, no mcp-adapter*), the install and list rows end in {requires pi-mcp-adapter}, the install warns, and info prints `    requires: pi-mcp-adapter (missing)`; the same with -builtin:mcp and no adapter"
    requirement: ADET-01
    verification:
      - kind: e2e
        ref: "TMPDIR=/var/tmp/mcp4-p08 node --test tests/e2e/adapter-detection-rpc.test.ts (tmp/p08-t2.log: 7 pass, 0 fail, 0 skipped, EXIT=0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An mcp-adapter command from a cli-loaded fixture, once or twice registered (mcp-adapter:1, mcp-adapter:2), clears the marker, keeps the install at info and makes info print `    requires: pi-mcp-adapter`; a foreign tool named mcp keeps the marker and the warning"
    requirement: ADET-02
    verification:
      - kind: e2e
        ref: "tests/e2e/adapter-detection-rpc.test.ts#ADET-02 (tmp/p08-t2.log)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The live mcp__stub__echo tool and mcp command projections equal the builtinMcpTool()/builtinMcpCommand() seed projections"
    requirement: ADET-01
    verification:
      - kind: e2e
        ref: "tests/e2e/adapter-detection-rpc.test.ts#ADET-01: with only Pi's built-in MCP active (tmp/p08-t2.log)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The harness refuses a missing sandbox location with `does not exist` and a location inside the repository with the repository message; after a clean exit the stub MCP server and a same-group sentinel are gone, and the sentinel survives when the exit sweep is removed"
    requirement: ADET-01
    verification:
      - kind: e2e
        ref: "tests/e2e/adapter-detection-rpc.test.ts#runRpcSession (tmp/p08-t2.log); negative control tmp/p08-neg-in05.log (sentinelGone: false, EXIT=1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole e2e suite stays green with the new file"
    requirement: ADET-01
    verification:
      - kind: e2e
        ref: "TMPDIR=/var/tmp/mcp4-p08 npm run test:e2e (tmp/p08-e2e.log: 25 pass, 0 fail, 0 skipped, E2E_EXIT=0)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 08: Real-Pi adapter detection Summary

**A new RPC harness runs the repository's own Pi 1.0 CLI in a sandbox and drives the real
extension through five MCP states. With only the built-in MCP, or with no MCP at all, the
install and list rows end in `{requires pi-mcp-adapter}`, the install warns, and info prints
`requires: pi-mcp-adapter (missing)`. An `mcp-adapter` command, registered once or twice,
clears the marker. A foreign tool named `mcp` does not. The same run checks the built-in's
live inventory against the mock-matrix seeds, and they match.**

## Performance

- **Duration:** about 45 min, plus the pre-commit run
- **Started:** 2026-10-02T22:08:02Z
- **Completed:** 2026-10-02
- **Tasks:** 2 (Task 1 is a tracer)
- **Files modified:** 3 (2 created, 1 modified; all test code)
- **Node:** v26.10.0; Pi `@earendil-works/pi-coding-agent` 1.0.0 from the lock

## Accomplishments

- `tests/e2e/_rpc.ts` (396 lines), ported from the features/mcp harness:
  - `resolveSandbox` resolves HOME, the agent dir and cwd with `realpath`. A missing location
    rejects with `runRpcSession: sandbox location <path> does not exist` (the realpath error
    is the `cause`). A location inside the resolved repository root rejects with a message
    that names project trust and tells the reader to point TMPDIR outside the repository.
    A location outside the resolved OS temp directory rejects as before. The repository
    check runs first, so a TMPDIR inside the repository gets the repository message.
  - `spawn` and the child env use the resolved paths.
  - On the child's `exit` event, one process-group SIGKILL runs before `close` resolves.
  - Kept: the env `{ HOME, PI_CODING_AGENT_DIR, PI_OFFLINE: "1", PATH }`,
    `--mode rpc --offline --no-session`, no `--no-extensions`, `detached: true`, the group
    SIGKILL hard stop and the abort signal.
  - `commandSourcePaths` became `listedCommands(response)`, which returns every
    `get_commands` entry as `{ name, sourcePath }`. The test needs every name, because it
    matches `mcp-adapter` with an optional `:<digits>` suffix.
- `tests/e2e/adapter-detection-rpc.test.ts` (516 lines). Each case builds a hermetic sandbox
  and writes its fixtures there: the `fx-mkt` marketplace with `mcp-fixture` (one stdio server
  `fixture`, `process.execPath --version`), and plain-JS fixture extensions. Every session runs
  `get_commands`, `/inventory-probe <prefix>`, marketplace add, install, list and info, and
  checks exit 0, no timeout, no dialogs, no extension errors and four `handled` dispositions.

  | State | Setup | `get_commands` proof (`mcp`, `mcp-adapter*`) | Live tools named `mcp` | Row suffix | Install `notifyType` | Info line |
  | --- | --- | --- | --- | --- | --- | --- |
  | built-in only | `<agentDir>/mcp.json` with the stub server | `mcp` from `builtin:mcp` | none | ` {requires pi-mcp-adapter}` | `warning` | `requires: pi-mcp-adapter (missing)` |
  | neither | settings `-builtin:mcp` | none | none | ` {requires pi-mcp-adapter}` | `warning` | `requires: pi-mcp-adapter (missing)` |
  | adapter command | `adapter.mjs` | `mcp` builtin, `mcp-adapter` fixture | none | none | absent (info) | `requires: pi-mcp-adapter` |
  | doubly registered | `adapter-1.mjs`, `adapter-2.mjs` | `mcp` builtin, `mcp-adapter:1`, `mcp-adapter:2` (load order) | none | none | absent (info) | `requires: pi-mcp-adapter` |
  | foreign `mcp` tool | `foreign-mcp-tool.mjs` | `mcp` builtin | `mcp` from the fixture | ` {requires pi-mcp-adapter}` | `warning` | `requires: pi-mcp-adapter (missing)` |

  Two more cases start no Pi: a `cwd` that does not exist, and a `cwd` inside the repository
  (`tests/e2e`). Both assert the whole error message.
- `tests/platform/pi-inventory-seed.ts`: the built-in seed comment now names
  `tests/e2e/adapter-detection-rpc.test.ts` as the run that checks the seeds. No seed value
  changed.

## Captured inventory

The built-in-only case waits up to 8 s for an `mcp__` tool, then the probe notifies the tools
and commands that `pi.getAllTools()` and `pi.getCommands()` report. The projections the test
compares:

```json
{
  "tool": {
    "name": "mcp__stub__echo",
    "exposure": "deferred",
    "namespace": { "name": "mcp__stub" },
    "sourceInfo": { "path": "builtin:mcp", "source": "builtin", "scope": "temporary", "origin": "top-level" }
  },
  "command": {
    "name": "mcp",
    "source": "extension",
    "sourceInfo": { "path": "builtin:mcp", "source": "builtin", "scope": "temporary", "origin": "top-level" }
  }
}
```

Both deep-equal the same projections of `builtinMcpTool()` and `builtinMcpCommand()`. The live
namespace has no `description` or `instructions`, because the stub's config has no description
and its `initialize` result has no instructions. **Seed correction: none.**

## Task Commits

1. **Tasks 1 and 2 (one commit, as the plan specifies)** - `b02c9ed3`
   (`test(e2e): prove adapter-only MCP detection on real Pi`)

**Plan metadata:** the docs commit that follows it (SUMMARY, STATE, ROADMAP, REQUIREMENTS,
state.json).

The code commit SHA was fixed before the pre-commit run, as in earlier plans. The commit object
was built with `git commit-tree` from a temporary index holding HEAD plus the three changed
files (tree `1226fc33`), with author and committer dates pinned to `2026-10-02T22:40:00+0000`.
`git commit` then uses the same tree, parent, dates and message.

## Verification Evidence

Focused task verification passed; full phase/PR verification pending.

- **Task 1 (tracer) verify** (`tmp/p08-t1.log`): 7 pass, 0 fail, 0 skipped, `EXIT=0`.
  `workflow.auto_advance` is false and the verify is automated-only, so the re-run was the
  gate and no checkpoint was needed.
- **Task 2 verify** (`tmp/p08-t2.log`): 7 pass (five Pi states, two refusals), `ℹ fail 0`,
  `ℹ skipped 0`, `EXIT=0`. Each Pi session takes about 1.3 s, and the built-in-only session
  about 3.8 s because the probe waits for the stub's tool.
- **e2e suite** (`tmp/p08-e2e.log`): `TMPDIR=/var/tmp/mcp4-p08 npm run test:e2e`, 25 pass,
  0 fail, 0 skipped. Last line: `E2E_EXIT=0`.
- **Negative control for the exit sweep** (`tmp/p08-neg-in05.log`): with the `exit` handler
  removed from `_rpc.ts`, the built-in-only case fails with
  `{ stubGone: true, sentinelGone: false }`, `EXIT=1`. The case's `t.after` killed the
  surviving sentinel, and `ps` showed no leftover process. `_rpc.ts` was restored
  byte-for-byte (`cmp`).
- **Static checks:** `npx tsc --noEmit -p .` exit 0; ESLint on both new files exit 0;
  Prettier check clean on all three files.
- **Fallow:** `npm run fallow` exits 0 (`tmp/p08-fallow.log`). `fallow audit --format json
  --quiet --explain --gate-marker agent` gives verdict `warn`, not `fail`
  (`tmp/p08-audit.json`); the new test file appears only in the informational large-function
  list. `npm run test:corresponding` passes.
- **Pre-commit:** one run covers the code commit and the docs commit, per the operator's
  pay-once rule: `TMPDIR=/var/tmp/mcp4-p08 SKIP=trufflehog pre-commit run --files <3 code
  paths + SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md, state.json>`, log
  `tmp/p08-precommit.log`. `git commit` runs only after that log ends with
  `PRECOMMIT_EXIT=0`. A failed hook means no commit.

### Acceptance checks

- `rg -n 'does not exist' tests/e2e/_rpc.ts`: line 117 (the thrown message) and line 348 (the
  doc comment).
- `rg -n '"--no-extensions"' tests/e2e/_rpc.ts tests/e2e/adapter-detection-rpc.test.ts`: no
  output.
- `git diff --name-only HEAD -- package.json package-lock.json`: no output. No package was
  installed.
- `rg -n 'mcp-adapter:2' tests/e2e/adapter-detection-rpc.test.ts`: the doubly-registered title
  (line 429) and its `get_commands` proof (line 438).

## Files Created/Modified

- `tests/e2e/_rpc.ts` - the RPC harness
- `tests/e2e/adapter-detection-rpc.test.ts` - the five real-Pi states and two refusal cases
- `tests/platform/pi-inventory-seed.ts` - the seed comment names the RPC test

## Decisions Made

- The harness checks the repository before the temp directory, so a TMPDIR inside the
  repository gets the repository message, not the generic "outside" message.
- Every state runs the inventory probe. The built-in-only state waits for `mcp__`; the others
  pass no prefix and return at once. That lets every row assert which live tools are named
  `mcp` (none, or the foreign fixture) without a conditional in the loop body.
- The process-exit check waits up to 2 s for `ESRCH`. A process killed at Pi's exit is reaped
  by its new parent shortly after, and a zombie still answers signal 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The stub MCP server's PID cannot prove the clean-exit sweep**
- **Found during:** Task 1 (negative control)
- **Issue:** The plan proves the exit sweep "by the stub MCP server's PID". Pi 1.0's
  `pi-mcp` `StdioTransport` spawns each stdio server with `detached: true`, in a process group
  of its own, and stops it itself on shutdown (stdin close, SIGTERM after 500 ms, then
  SIGKILL, plus an exit hook). With the harness's `exit` handler removed, the stub was still
  gone, so the stub check passed either way. The ported harness comment also claimed the group
  kill reaches "the stdio MCP servers the built-in starts", which is false on Pi 1.0.
- **Fix:** The harness comments now say the group kill reaches the children Pi starts in its
  own group, and that Pi starts and stops each stdio MCP server in a group of its own. The
  built-in-only case also loads `group-sentinel.mjs`, which starts a long-lived child in Pi's
  group with no stdio tie and writes its PID. Only the exit sweep stops it. The case asserts
  `{ stubGone: true, sentinelGone: true }`. The negative control above shows the sentinel
  survives without the sweep.
- **Files modified:** `tests/e2e/_rpc.ts`, `tests/e2e/adapter-detection-rpc.test.ts`
- **Commit:** `b02c9ed3`

### Other adjustments

- **One authoring pass for both tasks.** Task 2's states and refusal cases were written with
  Task 1's harness and run together, so `tmp/p08-t1.log` already shows all seven cases. The
  Task 1 gate held: the built-in-only case passed before anything was committed.
- **`commandSourcePaths` is `listedCommands`.** The plan allows the ported helpers only if the
  test uses them. The test needs every command name, so the helper returns `{ name,
  sourcePath }` for every entry instead of the paths for one name.
- **The `exit` sweep comment.** It no longer names stdio MCP servers (see deviation 1).
- **State verbs.** Run after this SUMMARY was written; any field they left stale was
  hand-edited and is named in the docs commit.

None of these change the plan's scope.

## Issues Encountered

None beyond deviation 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ADET-01 and ADET-02 are complete: the probe and unit matrix (01-05), the e2e mock matrix
  (01-06), the info line (01-07) and this real-Pi proof cover install, list and info, the
  built-in-only negative test, and detection by command or source.
- Plan 01-09 can reuse `runRpcSession` for any later real-Pi proof. Callers must create every
  sandbox location first and keep TMPDIR outside the repository.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-01-SC: accepted. This plan installs no package; package.json and the lock are unchanged.
- T-01-13: mitigated. The child env is built from scratch with four keys, and Pi runs with
  `--offline`.
- T-01-14: mitigated. Every location is resolved with `realpath` and must be inside the OS temp
  directory and outside the repository; the two refusal cases prove the missing and
  in-repository paths.
- T-01-15: mitigated. The group SIGKILL runs on hard stop, abort and clean exit. The
  same-group sentinel proves the clean-exit sweep (deviation 1); stdio MCP servers are stopped
  by Pi in their own groups, and the stub's PID proves none outlives the session.

## Self-Check: PASSED

- `tests/e2e/_rpc.ts`, `tests/e2e/adapter-detection-rpc.test.ts` and
  `tests/platform/pi-inventory-seed.ts` exist with the changes above; this SUMMARY exists.
- `b02c9ed3` exists as a commit-tree object (`git cat-file -t` reports `commit`) over tree
  `1226fc33`. `git commit` makes it HEAD~1 of the docs commit only after
  `tmp/p08-precommit.log` ends with `PRECOMMIT_EXIT=0`.

---
phase: 04-variable-expansion-at-claude-code-parity
plan: 05
subsystem: mcp-bridge
tags: [mcp, session-env, adapter-contract]

requires:
  - phase: 04-01
    provides: "ADAPTER_EMPTY_ENV, the split-token encoding and substituteAndInject"
  - phase: 04-03
    provides: "The deny-list arm of substituteAndInject (the injected env this plan narrows)"
provides:
  - "shared/session-env.ts applyMcpAdapterEnv(cwd): PI_CLAUDE_MARKETPLACE_EMPTY = \"\" always; CLAUDE_PROJECT_DIR = cwd unless the cwd holds $env: or {env:"
  - "index.ts private applyMcpAdapterEnvFrom(readCwd): first statement of the factory (process.cwd()) and first call in the one session_start handler (ctx.cwd), NFR-2 safe"
  - "bridges/mcp/substitute.ts: the injected stdio env is exactly {CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, ...declared} in both scopes"
affects: [04-06, 04-07, 04-08, 04-09]

actuals:
  tokens: 8394
  tasks: 3
  commits: 1
plan_head_before: 932169636f880d4fd6566d678b2698b6e21c19b3
plan_head_after: a8c82627ccc14df019cf16c0a93a72fdba76052c

tech-stack:
  added: []
  patterns:
    - "Pi-process variables for pi-mcp-adapter are set at factory time and refreshed on session_start through one NFR-2-safe helper"
    - "A pure session-env primitive returns a skip flag; the caller in index.ts owns the debug log"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/session-env.ts
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - tests/shared/session-env.test.ts
    - tests/index.test.ts
    - tests/bridges/mcp/substitute.test.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/integration/mcp-override-lifecycle.test.ts
    - tests/integration/mcp-variable-expansion.test.ts
    - tests/integration/mcp-home-path-partial.test.ts
    - tests/architecture/integration-materialization-gate.test.ts

key-decisions:
  - "The session_start handler reads ctx.cwd before and outside the session id's try, so a session id failure cannot skip the adapter variables and a cwd failure cannot skip the session triple"
  - "The three existing session_start cases in tests/index.test.ts now state the one ctx.cwd read on the strict boundary instead of letting strong-mock's CALL_THROW default hand the handler a function"
  - "substitute.test.ts collapses INJECTED_ENV to one object, because the project and user injected sets are now identical"

requirements-completed: [AVAR-01]

coverage:
  - id: D1
    description: "After the factory runs, Pi's process holds PI_CLAUDE_MARKETPLACE_EMPTY = \"\" and CLAUDE_PROJECT_DIR = process.cwd()"
    requirement: AVAR-03
    verification:
      - kind: unit
        ref: "tests/index.test.ts#AVAR-03: the factory sets the reserved empty variable and CLAUDE_PROJECT_DIR from the process working directory"
        status: pass
    human_judgment: false
  - id: D2
    description: "session_start refreshes CLAUDE_PROJECT_DIR from ctx.cwd; a marker-holding cwd is not exported; a throwing cwd read never escapes and the session triple is still applied"
    requirement: AVAR-01
    verification:
      - kind: unit
        ref: "tests/index.test.ts#AVAR-01: session_start refreshes CLAUDE_PROJECT_DIR from the session's cwd"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts#AVAR-01: session_start does not export a working directory holding an adapter variable marker"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts#NFR-2: a session context whose cwd cannot be read leaves the values alone and does not throw"
        status: pass
    human_judgment: false
  - id: D3
    description: "applyMcpAdapterEnv sets the reserved variable first and always, exports a clean cwd, skips $env: and {env: cwds, and touches no other key"
    requirement: AVAR-01
    verification:
      - kind: unit
        ref: "tests/shared/session-env.test.ts#applyMcpAdapterEnv"
        status: pass
    human_judgment: false
  - id: D4
    description: "The injected stdio env is exactly CLAUDE_PLUGIN_ROOT then CLAUDE_PLUGIN_DATA at both scopes; project-scope ${CLAUDE_PROJECT_DIR} still expands at install in command, args, env, url and headers; a declared env.CLAUDE_PROJECT_DIR follows the plain rule"
    requirement: AVAR-01
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/substitute.test.ts#AVAR-01: the injected stdio env is exactly CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA at project scope"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/substitute.test.ts#AVAR-01: a project-scope ${CLAUDE_PROJECT_DIR} expands at install in command, args, env, url and headers"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/substitute.test.ts#AVAR-01: a declared env.CLAUDE_PROJECT_DIR follows the plain rule"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 05: pi-mcp-adapter variables from Pi's process Summary

**Pi's process now holds `PI_CLAUDE_MARKETPLACE_EMPTY=""` and `CLAUDE_PROJECT_DIR` from the moment the extension factory runs, refreshed on every `session_start` (a marker-holding cwd is never exported), and the bridge injects only Claude Code's two keys, `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`, into a stdio env.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-07T17:57:06Z
- **Completed:** 2026-10-07T18:09Z
- **Tasks:** 3 (one commit, as the plan directs)
- **Files modified:** 15

## Accomplishments

- `shared/session-env.ts`: `applyMcpAdapterEnv(cwd): boolean` sets the reserved variable to `""` first and always, then exports `cwd` as `CLAUDE_PROJECT_DIR` unless it holds `$env:` or `{env:` (returns `false` for that skip). `claudeSessionEnvFor` and `applySessionEnv` are unchanged; the module header lists the third concern.
- `index.ts`: module-private `applyMcpAdapterEnvFrom(readCwd)` wraps the call in one try, debug-logs the marker skip and any throw under the `env` tag. It runs as the factory's first statement (`process.cwd()`) and first in the existing `session_start` handler (`ctx.cwd`), outside the session id's try. Still exactly one `session_start` registration.
- `bridges/mcp/substitute.ts`: the injected object is `{CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA}`; `projectDir` now feeds only install-time expansion. Doc comments say MENV-03 is met by inheritance through Pi's process.
- Every suite that pinned a project-scope stdio env drops the `CLAUDE_PROJECT_DIR` key; inputs and the SUB-02 content-substitution cases are untouched.

## Task Commits

1. **Task 1: tracer, Pi's process holds the two variables** - `a8c82627`
2. **Task 2: the bridge injects Claude's two keys (TDD)** - `a8c82627`
3. **Task 3: orchestrator, integration and gate suites, the commit** - `a8c82627` (feat)

Tracer gate: `workflow.human_verify_mode` is the default `end-of-phase`, `auto_advance` is false, and the tracer `<verify>` is automated-only, so it was re-run (pass) and execution expanded with no checkpoint.

TDD (Task 2): the plan ships one commit, so RED was captured without a commit. The new and updated `substitute.test.ts` cases were run against the pre-change `substitute.ts` (`git show HEAD:...`): exit 1, 20 fail / 37 pass, including `AVAR-01: the injected stdio env is exactly ... at project scope`. With the change restored: 57 pass, 0 fail.

## Verification

Node v26.10.0. All commands from the repo root. Each was re-run on commit `a8c82627`.

| Command | Exit | Notes |
|---|---|---|
| Task 1: `npm run typecheck && node --test tests/shared/session-env.test.ts tests/index.test.ts tests/bridges/hooks/hook-env.test.ts` | 0 | 49 pass, 0 fail; no `error TS`; hook-env (per-dispatch value wins) green |
| Task 2: `mkdir -p /var/tmp/mcp4-p4-05 && npm run typecheck && node --test <substitute, adapter-entry, stage tests> && TMPDIR=/var/tmp/mcp4-p4-05 npm run test:coverage:direct -- .../bridges/mcp/substitute.ts` | 0 | 174 pass, 0 fail; 100% direct coverage |
| Direct coverage for `shared/session-env.ts` and `index.ts` | 0 | 100% |
| Task 3: `TMPDIR=/var/tmp/mcp4-p4-05 npm run test:modules && npm run test:architecture && TMPDIR=/var/tmp/mcp4-p4-05 npm run test:integration && test "$(tail -n 1 tmp/p4-05-precommit.log)" = PRECOMMIT_EXIT=0 && git log -1 --format=%s` | 0 | printed `feat(mcp): give pi-mcp-adapter its variables from Pi's process` |
| `npx fallow audit --base 93216963` | 0 | No issues in 15 changed files |
| D-04 ID check on `git diff 93216963..HEAD -- extensions tests` | 0 | no `D-04-NN` added |

- Pre-commit log `tmp/p4-05-precommit.log` ends with `PRECOMMIT_EXIT=0` (first pass clean, no fixer rewrites).
- Commit `a8c82627` hook: `npm run check:commit....Passed`; gitlint Passed. First attempt succeeded.
- Acceptance greps: `applyMcpAdapterEnvFrom(` count 3, `pi.on("session_start"` count 1, `PI_CLAUDE_MARKETPLACE_EMPTY` in both test files, the injected-env case title and the MENV-03 inheritance comment present.

Focused task verification passed; full phase/PR verification pending.

## Decisions Made

- `ctx.cwd` is read first and outside the session id's try, so the two failures are independent; the NFR-2 case proves a throwing `cwd` still lets the session triple apply.
- The three existing `session_start` cases now pass `{ value: scope.cwd, reads: 1 }` to `loadExtension`. Without it, strong-mock's default `CALL_THROW` returns a function for `ctx.cwd`, and the handler took its catch path silently.
- `INJECTED_ENV` in `substitute.test.ts` is one object, since both scopes now inject the same two keys.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/integration/mcp-home-path-partial.test.ts` pinned the old env**
- **Found during:** Task 3
- **Issue:** Plan 04-04's integration test expected `CLAUDE_PROJECT_DIR: cwd` in a project-scope stdio env. It is not in this plan's `files_modified`.
- **Fix:** Removed the key from that one expected env object, as for the listed suites.
- **Files modified:** tests/integration/mcp-home-path-partial.test.ts
- **Verification:** `npm run test:integration` exit 0.
- **Committed in:** a8c82627

**2. [Rule 1 - Test honesty] Existing `session_start` cases state the `ctx.cwd` read**
- **Found during:** Task 1
- **Issue:** The new first call reads `ctx.cwd` on the strict boundary, which the three existing cases did not expect; they stayed green only through the catch path.
- **Fix:** Each case passes the cwd expectation to `loadExtension`, so `verifyBoundary()` checks the read.
- **Files modified:** tests/index.test.ts
- **Committed in:** a8c82627

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 test honesty). **Impact:** no scope change.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-14 (reserved variable set at factory and session_start) and T-04-16 (marker-holding cwd not exported, debug-logged) are mitigated and pinned by the `tests/index.test.ts` and `tests/shared/session-env.test.ts` cases above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 04-06 (peer range), 04-07, 04-08 (adapter conformance can now rely on the reserved variable in Pi's process) and 04-09 (documents T-04-15 and T-04-19). AVAR-01 is marked complete: no later phase-04 plan declares it. AVAR-03 stays pending because plans 04-06, 04-08 and 04-09 still declare it.

## Self-Check: PASSED

- FOUND: commit a8c82627 on HEAD
- FOUND: all 15 modified files in the commit

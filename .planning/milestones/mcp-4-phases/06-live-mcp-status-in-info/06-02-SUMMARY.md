---
phase: 06-live-mcp-status-in-info
plan: 02
subsystem: info
tags: [mcp, info, status, scopes, catalog]

requires:
  - phase: 06-live-mcp-status-in-info
    provides: "06-01 `withMcpServerStatus`, `McpStatusReader.lookup` with its `no-snapshot` / `unlisted` / `unrecognized` split, the nine-member `McpServerStatus`"
provides:
  - "`McpServerStatus` tenth member `overridden by project scope`"
  - "`withMcpServerStatus(block, record, mcpStatus, projectRecord)` with the shadow rule"
  - "private `readProjectInstallRecord(opts, found)` in `orchestrators/plugin/info.ts`: the project record from the fan-out, or a read-only `loadState(..., { persistMigration: false })` under `--scope user`"
  - "catalog state `installed-both-scopes-mcp-overridden`, the token table row and the shadow-rule prose"
affects: [06-03 adapter conformance, phase 7 docs and live UAT]

actuals:
  tokens: 11200
  tasks: 2
  commits: 1
plan_head_before: 54e83331eef353886e5a77c72028dbb15049a4f6
plan_head_after: 51f87c138107b94ab6a7f7efd501a040d5eb3271

tech-stack:
  added: []
  patterns:
    - "A guarded, read-only cross-scope state read (`persistMigration: false` inside `try`/`catch`) that can only ever narrow a display decision"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info-mcp-status.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat/fixtures/plugin-info.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts

key-decisions:
  - "The override decision is inlined in `stampEntries` (a ternary over `answer !== \"no-snapshot\" && overridden.has(server)`), because a helper taking the boolean tripped `sonarjs/no-selector-parameter`"
  - "`projectOverrides(block, projectRecord)` returns the set of overridden server names once per block: empty for a project row, an absent record or a disabled record (ENBL-08)"

patterns-established: []

requirements-completed: [ASTAT-01, ASTAT-02]

coverage:
  - id: D1
    description: "both scopes with a usable snapshot: project row shows the adapter's state, user row reads `overridden by project scope`, in the fan-out and under `--scope user`"
    requirement: "ASTAT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#ASTAT-01: with the plugin in both scopes, the project row shows the adapter's state and the user row reads overridden by project scope"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#ASTAT-01: under --scope user the user row reads overridden by project scope from the project scope's record"
        status: pass
    human_judgment: false
  - id: D2
    description: "no snapshot before the shadow rule; disabled, non-listing and unreadable project records do not override; project row never overridden"
    requirement: "ASTAT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-mcp-status.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#ASTAT-01: under --scope user an unparseable project state.json leaves the user row with the snapshot's state and is not rewritten"
        status: pass
    human_judgment: false
  - id: D3
    description: "the tenth token is byte-locked in the catalog and enrolled in the closed set"
    requirement: "ASTAT-02"
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#ASTAT-02: McpServerStatus is the closed 10-entry MCP server status set"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-09
status: complete
---

# Phase 6 Plan 02: MCP server overridden by the project scope Summary

**When the same `plugin@marketplace` is installed in both scopes, `/claude:plugin info` gives the project row the state pi-mcp-adapter reports and the user row's server the closed token `overridden by project scope`. It decides from the project scope's installation record, which it reads read-only under `--scope user`.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-10-09T18:18Z
- **Completed:** 2026-10-09T18:43Z
- **Tasks:** 2 of 2
- **Files modified:** 10

## Accomplishments

- `McpServerStatus` has a tenth member, `overridden by project scope`. Its doc comment explains the case: both scopes' adapter files hold one key, and the adapter loads the project file last.
- `withMcpServerStatus` takes a fourth parameter, `projectRecord`. It applies the rules in this order: `no-snapshot` gives `status unknown` on every row; a user row's server that an enabled project record lists gives `overridden by project scope`; any other server gets the 06-01 token. A project row is never overridden. The reader is still asked once per server.
- `info.ts` adds `readProjectInstallRecord`. It takes the project entry from the fan-out when there is one. Under `--scope user` it reads `loadState(locationsFor("project", cwd).extensionRoot, { persistMigration: false })` inside a `try`/`catch`, and a failed read returns `undefined`. In every other case it returns `undefined`. The command calls it once per invocation, after the marketplace-not-added return, and passes the result to both stamping sites.
- Catalog: a new token table row, the state `installed-both-scopes-mcp-overridden` (the planned fence bytes) with its prose, including the exclusive-config-mode imprecision, and the state name added to the info severity list. Counts: 270 states and 41_915 bytes. The contract test passed with the planned constants and no other change. `McpServerStatus` is enrolled with ten members.

## Task Commits

The plan commits once, as it requires:

1. **Tasks 1-2: shadow rule, project-record read, owner tests, catalog and locks** - `51f87c13` (feat)

## Files Created/Modified

See `key-files` in the frontmatter. No 06-01 expectation in `info.test.ts` changed. The 06-01 calls in `info-mcp-status.test.ts` only gained `undefined` as the fourth argument.

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `sonarjs/no-selector-parameter` on a boolean helper**
- **Found during:** Task 2 commit (the hook's `check:static` lint step)
- **Issue:** The first version had a helper `serverToken(answer, overridden: boolean)`, and lint rejected the boolean selector parameter.
- **Fix:** Removed the helper and moved the decision into `stampEntries` as a typed ternary. Behavior is the same, and direct coverage stays at 100%.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
- **Commit:** 51f87c13 (the failed hook run left no commit)

**2. [Rule 2 - Missing coverage] Extra info case for the no-`--scope`, user-only branch**
- **Found during:** Task 2 direct coverage (`info.ts` branches 436/437)
- **Issue:** No test reached the branch where no `--scope` was given and only the user scope holds the marketplace, so `readProjectInstallRecord` returned `undefined` without a read.
- **Fix:** Added the case `ASTAT-01: without --scope and with the marketplace in the user scope only, the user row's server keeps the snapshot's state`. Direct coverage of `info.ts` is now 100%.
- **Files modified:** tests/orchestrators/plugin/info.test.ts
- **Commit:** 51f87c13

**3. [Rule 2 - Safety proof] The unparseable-state case also proves nothing is written**
- The case also checks that the project extension root still holds only `state.json` and that the file still reads `{`. This covers the plan's prohibition that info must not write while it reads the project record.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 test additions). **Impact:** structure and tests only. Behavior is as planned.

## Verification

- Task 1: `TMPDIR=/var/tmp/mcp4-p6-02 node --test tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/info-mcp-status.test.ts` gave 248 pass and 0 fail. The tracer check passed.
- Task 2: `npm run typecheck` exit 0. Both owner files gave 249 pass and 0 fail after the coverage case was added. After the lint fix, `info-mcp-status.test.ts` gave 38 pass and 0 fail. `npm run test:coverage:direct` over `info-mcp-status.ts` and `info.ts` exit 0, with no shortfall (100% direct). `npm run test:architecture` exit 0. `npx eslint` on all ten changed files exit 0.
- `PRECOMMIT_EXIT=0` (`SKIP=npm-check pre-commit run --files` over the 10 paths; the last line of `tmp/p6-02-precommit.log`. mdformat realigned the token table on the first run).
- Commit hook: the first `git commit` failed in `npm run check:commit` (the lint finding in deviation 1), so nothing was committed. The second `git commit` passed every hook, including `npm run check:commit` and gitlint, and created `51f87c13`.
- `npx fallow audit --base 54e83331` exit 0: "No issues in 10 changed files". The 3 clone groups it lists are inherited and excluded by the audit gate.
- No added line under `extensions/` or `tests/` cites a decision ID (`D-06-N`).
- Node v26.11.0, `TMPDIR=/var/tmp/mcp4-p6-02`. Every info test runs under `withHermeticHome`.

focused task verification passed; full phase/PR verification pending

## Issues Encountered

None beyond the deviations. The IL-3 `Legacy marketplace migration could not be persisted ... ENOENT` warnings that 06-01 recorded also print during the direct-coverage run, from `plug-info-*` temp homes. They predate this plan.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The project `state.json` read under `--scope user` is the planned T-06-07 / T-06-08 surface. It uses `persistMigration: false` inside a `try`/`catch`, and the unparseable-state test shows that info still emits its one notification and leaves the file unchanged.

## Next Phase Readiness

- 06-03 can conformance-test the tracker against the adapter's constants. This plan does not change the tracker.
- Phase 7 docs can describe the both-scopes case from the catalog prose, including the exclusive-config-mode imprecision (T-06-09, accepted).

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts, extensions/pi-claude-marketplace/orchestrators/plugin/info.ts, docs/output-catalog.md
- FOUND: commit 51f87c13 (ancestor of HEAD)

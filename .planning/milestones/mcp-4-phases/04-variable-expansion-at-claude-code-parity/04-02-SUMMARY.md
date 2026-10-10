---
phase: 04-variable-expansion-at-claude-code-parity
plan: 02
subsystem: mcp-bridge
tags: [mcp, variables, notices, install]

requires:
  - phase: 04-01
    provides: "stampServers(...).variableReports, StageMcpInput.env, Claude's variable rule and the adapter encoding"
provides:
  - "McpVariablesMissingNotice (kind variables-missing) in shared/notification-dispatch.ts and the `MCP server variables not set.` warning row"
  - "bridges/mcp/stage.ts: one variables-missing notice per server with missing names, after the override-kept notices"
  - "docs/output-catalog.md: the mcp-variables-missing block, locked by tests/architecture/mcp-config-notices.test.ts"
  - "tests/integration/mcp-plugin-seed.ts: NotifyRecord, makeCtx, seedMcpPlugin shared by the MCP integration tests"
  - "tests/integration/mcp-variable-expansion.test.ts: end-to-end install proof of AVAR-01/02/04"
affects: [04-03, 04-09]

actuals:
  tokens: 8903
  tasks: 2
  commits: 1
plan_head_before: 233a3e89f3e50979a027a0496117787df61c5105
plan_head_after: e29c66248bb3862fb75bb974fe668cfb4b604c2d

tech-stack:
  added: []
  patterns:
    - "A new MCP notice kind is one more row in notifyMcpConfigNotices' warnings table, rendered from a type-guard filter"
    - "Variable notices are derived from the per-server variable reports, never from values"

key-files:
  created:
    - tests/integration/mcp-plugin-seed.ts
    - tests/integration/mcp-variable-expansion.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - docs/output-catalog.md
    - tests/architecture/mcp-config-notices.test.ts
    - tests/integration/mcp-override-lifecycle.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/shared/notification-dispatch.test.ts

key-decisions:
  - "The variables-missing line renders through a type-guard filter (isVariablesMissing) instead of a copy of mcpConfigFileLines, so fallow dupes sees no new clone"
  - "variableNotices passes report.missing through as names; deduplication and first-seen order stay owned by the five-field walk"
  - "The warning wording is a closed-catalog draft for operator review: `Server \"<key>\" from <plugin> in the <scope>-scope mcp-adapter.json uses environment variables that are not set: <names>. pi-mcp-adapter reads them from Pi's environment when it starts the server.`"

requirements-completed: [AVAR-04, AVAR-01, AVAR-02]

coverage:
  - id: D1
    description: "A real project install writes Claude's rule for the adapter (plugin root, project root, default text, kept ${VAR} references, `!!`) and no environment value reaches the file or a notification"
    requirement: AVAR-02
    verification:
      - kind: integration
        ref: "tests/integration/mcp-variable-expansion.test.ts#AVAR-02: a project install writes Claude's variable rule for the adapter and warns about the unset variable"
        status: pass
    human_judgment: false
  - id: D2
    description: "The install shows the `MCP server variables not set.` warning after its own rows, naming the server key, plugin, scope, file and variable names only"
    requirement: AVAR-04
    verification:
      - kind: integration
        ref: "tests/integration/mcp-variable-expansion.test.ts#AVAR-02: a project install writes Claude's variable rule for the adapter and warns about the unset variable"
        status: pass
      - kind: unit
        ref: "tests/architecture/mcp-config-notices.test.ts#AFILE-04: a variables-missing notice is byte-equal to the catalog's mcp-variables-missing block"
        status: pass
    human_judgment: false
  - id: D3
    description: "The stage reports one variables-missing notice per server with missing names, in declared order, after override-kept notices; set or defaulted references (including ${DD_API_KEY:-}) add none; names appear once each in first-seen order; no set value appears; a noop stage reports none"
    requirement: AVAR-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AVAR-04: a server with an unset variable reports one variables-missing notice after the override-kept notices"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AVAR-04: variables-missing notices follow declared server order, name each variable once, and skip a server whose references are set or defaulted"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AVAR-04: a variables-missing notice names variables and holds no set variable's value"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AVAR-04: a noop stage reports no variables-missing notice"
        status: pass
    human_judgment: false
  - id: D4
    description: "notifyMcpConfigNotices renders the variables-missing summary and lines, deduplicates identical lines, and sends the kind after override-kept"
    requirement: AVAR-04
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#AVAR-04: variables-missing notices for two servers send MCP server variables not set. with a line each"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#AVAR-04: a repeated variables-missing notice renders once"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#AVAR-04: a variables-missing notice listed first still sends after the override-kept warning"
        status: pass
    human_judgment: false
  - id: D5
    description: "The warning's wording reads well to a user (closed-catalog draft)"
    requirement: AVAR-04
    verification: []
    human_judgment: true
    rationale: "The plan marks the wording as a closed-catalog draft for operator review; tests pin the bytes, not their clarity"

duration: 12min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 02: Missing-variable install warning Summary

**A plugin MCP server that references an unset variable with no `:-` default now produces a `variables-missing` notice at stage time, and every staging command shows it as the catalog-pinned `MCP server variables not set.` warning after its rows; a real project install proves Claude's rule end to end with no environment value in the file or the notifications.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-07T17:00:22Z
- **Completed:** 2026-10-07T17:12Z
- **Tasks:** 2 (one commit, as the plan directs)
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- `shared/notification-dispatch.ts`: exported `McpVariablesMissingNotice` (`kind: "variables-missing"`, scope, file, plugin, server, names); `McpConfigNotice` widened; the `MCP server variables not set.` row follows override-kept in `notifyMcpConfigNotices`, with the same line deduplication.
- `bridges/mcp/stage.ts`: reads `variableReports` from `stampServers` and appends one notice per server with missing names, in declared order, after the override-kept notices. `types.ts` documents the order so a later variable notice kind fits.
- `docs/output-catalog.md`: the `mcp-variables-missing` block, locked by a new row in `tests/architecture/mcp-config-notices.test.ts`.
- `tests/integration/mcp-plugin-seed.ts` holds `NotifyRecord`, `makeCtx` and `seedMcpPlugin`, moved unchanged out of `mcp-override-lifecycle.test.ts`; `mcp-variable-expansion.test.ts` installs through `createInstallOperation` and asserts the whole written entry, the sentinel's absence from the file and from every notification, and the exact last notification.

## Task Commits

The plan ships as one commit.

1. **Task 1: tracer, project install writes Claude's rule and warns** - `e29c6624`
2. **Task 2: stage and renderer cases, the commit** - `e29c6624` (feat)

Tracer gate: `workflow.human_verify_mode` is the default `end-of-phase`, `auto_advance` is false, and the tracer `<verify>` is automated-only, so it was re-run (pass) and execution expanded with no checkpoint.

## Verification

Node v26.10.0. All commands from the repo root.

| Command | Exit | Notes |
|---|---|---|
| Task 1: `npm run typecheck && node --test tests/architecture/mcp-config-notices.test.ts && TMPDIR=/var/tmp/mcp4-p4-02 node --test tests/integration/mcp-variable-expansion.test.ts tests/integration/mcp-override-lifecycle.test.ts` | 0 | 12 pass; 6 pass; no `error TS` |
| Task 2 verify 1: `npm run typecheck && node --test tests/bridges/mcp/stage.test.ts tests/shared/notification-dispatch.test.ts && npm run test:coverage:direct -- <stage.ts> <notification-dispatch.ts>` | 0 | 304 pass, 0 fail; 100% direct coverage; rerun on `e29c6624` |
| Task 2 verify 2: `npm run test:modules && npm run test:architecture && npm run test:integration && test "$(tail -n 1 tmp/p4-02-precommit.log)" = PRECOMMIT_EXIT=0 && git log -1 --format=%s` | 0 | rerun on `e29c6624`; printed `feat(mcp): warn about unset plugin MCP variables at install` |
| `npx fallow audit --base 233a3e89` | 0 | no issues in 10 changed files; one inherited clone group (`notification-dispatch.ts:555-611`, not touched) excluded by the gate |
| `npx fallow dead-code` | 0 | nothing for `McpVariablesMissingNotice` or the seed module |
| `npx fallow dupes` | 0 | no clone group between the MCP integration tests |
| D-04 ID check on `git diff 233a3e89..HEAD -- extensions tests` | 0 | no `D-04-NN` added |

- Pre-commit log `tmp/p4-02-precommit.log` ends with `PRECOMMIT_EXIT=0`.
- First commit attempt: the hook's `npm run check:commit` failed on lint (`@typescript-eslint/no-dynamic-delete` in the new integration test), so no commit happened. After the fix, commit `e29c6624` hook: `npm run check:commit....Passed` (all pairs, because `tests/integration/mcp-plugin-seed.ts` is staged test support); gitlint Passed.
- Other suites whose notices changed: none needed a fix (`test:modules`, `test:architecture`, `test:integration` green).

Focused task verification passed; full phase/PR verification pending.

## Decisions Made

- The new row renders through a type-guard filter rather than a second copy of `mcpConfigFileLines`, keeping fallow's duplication report unchanged.
- `variableNotices` passes `report.missing` through; the walk from 04-01 owns deduplication and first-seen order, so the stage case asserts it end to end rather than re-implementing it.
- The integration case asserts the exact last notification as the plan asks, plus a separate check that no notification holds the sentinel (T-04-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lint rejected a dynamic `delete` on `process.env`**
- **Found during:** Task 2 (commit hook)
- **Issue:** `delete process.env[name]` in the integration test's restore helper trips `@typescript-eslint/no-dynamic-delete`.
- **Fix:** `Reflect.deleteProperty(process.env, name)`, the form `tests/index.test.ts` already uses.
- **Files modified:** tests/integration/mcp-variable-expansion.test.ts
- **Verification:** integration test rerun (6 pass); hook passed on the retry.
- **Committed in:** e29c6624

---

**Total deviations:** 1 auto-fixed (1 blocking). **Impact:** none on behavior or scope.

## Issues Encountered

None beyond the lint fix above.

## Known Stubs

None. WINDOWS.md entry #89 (`stampServers(...).variableReports` not read) is marked fixed by this plan. Entry #88 (`report.blanked` always empty) stays open for plan 04-03.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-05 is mitigated: the notice type carries names only, values never reach `shared/`, the gate pins the bytes to the catalog block, and the integration and stage cases assert that no sentinel value appears in the written file or any notice or notification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 04-03 (deny-list arm fills `blanked` and adds the withheld-credential notice after the variables notice; `types.ts` already words the order for it) and 04-09 (proves the warning through update, reinstall, enable and the cascades).

## Self-Check: PASSED

- FOUND: tests/integration/mcp-plugin-seed.ts, tests/integration/mcp-variable-expansion.test.ts
- FOUND: commit e29c6624 on HEAD

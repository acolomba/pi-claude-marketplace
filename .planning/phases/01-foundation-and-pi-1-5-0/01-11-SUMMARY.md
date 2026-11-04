---
phase: 01-foundation-and-pi-1-5-0
plan: "11"
subsystem: mcp
tags: [mcp, info, status, pi-1.5.0, builtin-mcp, frozen-interface]

requires:
  - phase: 01-foundation-and-pi-1-5-0 (plan 01-03)
    provides: PiMcpRegistry and RegisteredMcpServer in platform/pi-api.ts
  - phase: 01-foundation-and-pi-1-5-0 (plan 01-05)
    provides: SoftDepStatus.mcpImplementation on every run snapshot
  - phase: 01-foundation-and-pi-1-5-0 (plans 01-06, 01-08)
    provides: session steps and mcpServerConfigs records (no direct use here)
provides:
  - McpStatusReaders and McpStatusLookup (frozen interface 7) in platform/mcp-status.ts
  - McpStatusReader.lookup(serverName) (frozen interface 6)
  - createBuiltinMcpStatusReader seed in platform/mcp-builtin-status.ts
  - EdgeDeps.mcpStatus as the reader pair, built once per extension load in index.ts
  - the frozen status call in info.ts that picks the reader by run.softDeps.mcpImplementation
  - GetPluginInfoOptions.projectTrusted, fed by ctx.isProjectTrusted() in the info handler
  - test seeds noStatusReaders() and statusReaders({ adapter?, builtin? })
affects: [built-in MCP status (BLT-05), info rendering under builtin, edge wiring]

actuals:
  tokens: 14400
  tasks: 2
  commits: 1
plan_head_before: cdef937310286fed2bc99c57505c00db3da94bd5
plan_head_after: 351ef302390fbc01bb33073723e9f56e1caf1a93

tech-stack:
  added: []
  patterns:
    - "Reader pair picked per run: built-in reader only under builtin; adapter reader under adapter and none"
    - "Status lookup bundle ({ reader, implementation, projectTrusted, cwd }) handed to the stamp so its body can switch naming without touching the call"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts
    - test/platform/mcp-builtin-status.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/mcp-status.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
    - extensions/pi-claude-marketplace/edge/types.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
    - extensions/pi-claude-marketplace/index.ts
    - test/platform/mcp-status-seed.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/info-mcp-status.test.ts
    - test/edge/handlers/plugin/info.test.ts
    - test/edge/types.test.ts
    - test/index.test.ts
    - test/integration/mcp-status-conformance.test.ts

key-decisions:
  - "info's private withServerStatus takes the whole GetPluginInfoOptions and builds the McpStatusLookup itself, so both call sites pass opts"
  - "The built-in seed takes Pick<PiMcpRegistry, 'getMcpServers'> as an unused _pi parameter; it reads nothing at construction or lookup"
  - "Task 1's commit carries every compile-driven caller update, because the commit hook type-checks the whole tree"

patterns-established:
  - "Status reader pair: { adapter, builtin } built at factory time, neither touching Pi then"

requirements-completed: [MSEL-01]

coverage:
  - id: D1
    description: "info picks the built-in status reader only under builtin and the adapter reader under adapter and none"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#MSEL-01: under ${implementation} info stamps the written servers through the ${readerAsked} status reader"
        status: pass
    human_judgment: false
  - id: D2
    description: "withMcpServerStatus takes an McpStatusLookup and keys every lookup with the generated adapter key under every implementation"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info-mcp-status.test.ts#ANAME-01 / ASTAT-01 / MSEL-01: under ${implementation} the lookup's reader is asked for the recorded server's generated adapter key"
        status: pass
    human_judgment: false
  - id: D3
    description: "createBuiltinMcpStatusReader reads nothing from Pi and answers no-snapshot"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/platform/mcp-builtin-status.test.ts#BLT-05 / MSEL-01: the built-in status reader answers no-snapshot for ... and reads nothing from Pi"
        status: pass
    human_judgment: false
  - id: D4
    description: "The info handler asks ctx.isProjectTrusted() once and passes it with ctx.cwd"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/edge/handlers/plugin/info.test.ts (delegating cases verify the strict context's single isProjectTrusted expectation)"
        status: pass
      - kind: unit
        ref: "test/index.test.ts#ASTAT-01: /claude:plugin info shows the status pi-mcp-adapter last published, and a fresh extension load starts with none"
        status: pass
    human_judgment: false
  - id: D5
    description: "info output is byte-identical under every implementation"
    requirement: MSEL-01
    verification:
      - kind: other
        ref: "npm run check parts: check:static, test:unpaired and all-pair direct coverage (commit hook), test:integration, test:cucumber adapter and builtin profiles"
        status: pass
      - kind: e2e
        ref: "npm run test:e2e"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 11: Status Reader Pair and Frozen Info Status Call Summary

**info now reads MCP server status through a `{ adapter, builtin }` reader pair, picked by the run's active MCP implementation and handed to `withMcpServerStatus` as an `McpStatusLookup` with project trust and cwd; the built-in reader is a no-read seed, so every output stays byte-identical.**

## Performance

- **Duration:** about 45 min
- **Started:** 2026-11-04T07:27:00Z
- **Completed:** 2026-11-04T08:13:00Z
- **Tasks:** 2 (one code commit; Task 2 is verification only, see Deviations)
- **Files modified:** 25 (2 created, 23 modified)

## Accomplishments

- Frozen interfaces 6 and 7: `McpStatusReader.lookup(serverName)`, `McpStatusReaders`, and `McpStatusLookup` in `platform/mcp-status.ts`.
- `platform/mcp-builtin-status.ts`: `createBuiltinMcpStatusReader(pi)` seed that reads nothing from Pi and answers `no-snapshot`. A later BLT-05 change fills it.
- The status call in `orchestrators/plugin/info.ts` uses `mcpStatus.builtin` only when `run.softDeps.mcpImplementation === "builtin"`, else `mcpStatus.adapter`. It passes `{ reader, implementation, projectTrusted, cwd }` to `withMcpServerStatus`.
- `EdgeDeps.mcpStatus` is the pair. `index.ts` builds it once per load. The info handler adds `projectTrusted: ctx.isProjectTrusted()`.
- Every EdgeDeps builder and direct `getPluginInfo` caller in the tests passes `noStatusReaders()` (and `projectTrusted: true` for direct callers). No output assertion changed.

## Task Commits

1. **Task 1: Thread the reader pair from index.ts through edge into the frozen info status call** - `351ef30` (feat). The commit also holds Task 2's caller updates (see Deviations).
2. **Task 2: Update every EdgeDeps and info caller and prove output is unchanged** - no separate commit. Its edits are in `351ef30`. Its verification ran after that commit.

**Plan metadata:** this SUMMARY commit.

## TDD Gate Compliance

No RED-only commit (precedent P1-DC-28): the commit hook runs the staged pairs' tests and refuses a failing commit, and `--no-verify` and `test.skip` are forbidden. So the tests and the code landed together in `351ef30`. The plan has no `test(...)` commit before the `feat(...)` commit. The end-of-phase TDD review will flag it.

RED evidence, captured before the implementation and checked with `gsd-tools check tdd-red-evidence`:

- **RED 1 (`RED_EVIDENCE_OK`).** First the status call was scaffolded to always use the adapter reader. Then `node --test --test-reporter=tap --test-name-pattern 'MSEL-01: under' test/orchestrators/plugin/info.test.ts` exited 1. The target `MSEL-01: under builtin info stamps the written servers through the built-in status reader` failed on its notification `deepStrictEqual`: expected `plugin:alpha:srv (failed)` (the built-in reader), actual `(connected)` (the adapter reader). The adapter and none rows passed. Semantic assessment: the target ran and failed on the planned assertion, for the intended reason.
- **RED 2 (`RED_EVIDENCE_OK`).** `node --test --test-reporter=tap --test-name-pattern 'narrows the projection to the user scope' test/edge/handlers/plugin/info.test.ts` exited 1 before the handler asked for trust. The strict context's `isProjectTrusted()` expectation was unmet in `verifyBoundary()`, and the emission matched. Semantic assessment: this is the planned observation.
- **Not classifiable:** `test/platform/mcp-builtin-status.test.ts` was written first, but it imports a new module, so its RED would be a load failure (INVALID_RED by definition). Instead, a negative control: a seed that calls `pi.getMcpServers()` inside a swallowing `try` failed all three cases with strong-mock's "calls were unexpected". The control was reverted at once and never committed.
- **GREEN:** the five Task 1 pairs reach 100% direct coverage. The commit hook ran `check:commit` with all pairs, because shared test support was staged.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts` - built-in status reader seed (new).
- `extensions/pi-claude-marketplace/platform/mcp-status.ts` - `McpStatusReaders`, `McpStatusLookup`, `lookup(serverName)`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - `mcpStatus: McpStatusReaders`, `projectTrusted`, the frozen reader pick in `withServerStatus`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts` - third parameter is `McpStatusLookup`; it reads `lookup.reader` and keeps the adapter key.
- `extensions/pi-claude-marketplace/edge/{types,register}.ts`, `edge/handlers/plugin/info.ts` - pair type, docs, `projectTrusted: ctx.isProjectTrusted()`.
- `extensions/pi-claude-marketplace/index.ts` - builds `{ adapter: createMcpStatusTracker(pi.events), builtin: createBuiltinMcpStatusReader(pi) }`.
- `test/platform/mcp-status-seed.ts` - `noStatusReaders()`, `statusReaders({ adapter?, builtin? })`.
- `test/platform/mcp-builtin-status.test.ts` - new owner test.
- `test/orchestrators/plugin/info.test.ts` - wrapper defaults the pair and `projectTrusted: true`; three per-implementation reader cases; the status cases use `statusReaders({ adapter: ... })`.
- `test/orchestrators/plugin/info-mcp-status.test.ts` - lookup-based helpers; the generated-key case runs once per implementation.
- `test/edge/handlers/plugin/info.test.ts` - delegating cases state one `isProjectTrusted()` read.
- `test/edge/types.test.ts` - pair-typed `mcpStatus`, plus a new pin that a lone reader is rejected.
- `test/index.test.ts` - the info status case states one trust read per info command.
- `test/integration/mcp-status-conformance.test.ts` - passes `statusReaders({ adapter: tracker })` and `projectTrusted` (not in files_modified).
- The other listed tests: `cross-op-convergence`, `manifest-read-agreement`, `import-command` (e2e), `register`, `mcp-migration`, `project-install-adds-user-marketplace`, `reserved-record-keys`, `standalone-prune`, `operations` - `noStatusReaders()`, plus `projectTrusted: true` where they call `getPluginInfo` directly.

## Decisions Made

- `withServerStatus(built, record, opts, projectRecord)` builds the lookup from `opts`, so the pick lives in one place, the frozen status call.
- The built-in seed's parameter is `Pick<PiMcpRegistry, "getMcpServers">`, named `_pi` because the seed does not read it. BLT-05 may widen the view within `ExtensionAPI`.
- `noStatusReaders()` builds both readers as real trackers that never receive a snapshot. It does not use the built-in seed, so the test seed stays independent of production seeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2's caller updates landed in Task 1's commit**
- **Found during:** Task 1
- **Issue:** The commit hook runs `check:static`, which type-checks the whole tree. Every EdgeDeps builder and direct `getPluginInfo` caller failed to compile until it passed the pair, so Task 1 could not commit alone.
- **Fix:** All caller updates went into `351ef30`. Task 2 ran only the verification (`npm run check` in parts, and `npm run test:e2e`) and needed no further edit.
- **Files modified:** the Task 2 test files listed above.
- **Committed in:** 351ef30

**2. [Rule 3 - Blocking] Two tests outside the per-task file lists needed updates**
- **Found during:** Task 1
- **Issue:** `test/integration/mcp-status-conformance.test.ts` calls `getPluginInfo` directly with a lone tracker. It is not in files_modified. `test/index.test.ts` (in files_modified for Task 2) drives info through a strict context that now gets an `isProjectTrusted()` read.
- **Fix:** The conformance test passes `statusReaders({ adapter: mcpStatus })` and `projectTrusted: true`. The index test states one trust read per info command (`trustReads` 2 and 1).
- **Committed in:** 351ef30

**3. Acceptance count for `createBuiltinMcpStatusReader` in index.ts is 2, not 1**
- The plan's grep counts lines. The import line and the call line both match, so the count of 1 is impossible with a named import. The call happens once.

---

**Total deviations:** 2 auto-fixed (both blocking), 1 acceptance-count mismatch.
**Impact on plan:** None on behavior. Only commit granularity differs.

## Issues Encountered

- One adapter-profile cucumber run had one step timeout: `features/plugin/apply.feature:455`, the Given `the marketplace "tools" is added to the project scope` passed 30 s under 8-way parallel load, near the end of a 9m53s run. That step does not involve info. The scenario passed alone, and the whole `apply.feature` (54 scenarios) passed on a rerun. The MCP and info features passed under adapter (80 scenarios), and the builtin profile passed (14 scenarios).
- `npm run test:e2e` first failed 4 peer-floor cases because `test/e2e/pi-peer-floor` had no install in the fresh worktree. After `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` (the test's own instruction, from its lockfile), all 33 passed.

## Known Stubs

This is an intentional seed of frozen interface 6, not a defect:

| File | Line | Stub | Owner |
|------|------|------|-------|
| extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts | 30 | `lookup` answers `"no-snapshot"` for every server, so built-in rows read `status unknown` | BLT-05 (built-in status) |

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-24 is mitigated: the stamp body keeps adapter naming, and the built-in seed answers `no-snapshot`. T-01-25 is mitigated: the seed reads nothing at construction or lookup. The strict-mock test and its negative control prove it, and `test/architecture/no-factory-time-probe.test.ts` passed in `test:unpaired`.

## Dubious Choices

1. **One code commit for two tasks (Medium).** Chosen: put Task 2's compile-driven caller updates in Task 1's commit. Alternatives: (a) two commits with a broken intermediate tree, which the hook refuses, and `--no-verify` is forbidden; (b) a temporary union type `McpStatusReader | McpStatusReaders` to keep old callers compiling, which would put throwaway production code into a frozen interface. Why: the hook type-checks the whole tree, so this is the only clean option.
2. **No RED-only commit (Medium).** Same cause as P1-DC-28: the hook refuses a failing commit. RED evidence is recorded above, and two RED records passed the classifier. RED 1 used a temporary adapter-only scaffold of the status call, so the target failed on an assertion and not on a missing interface.
3. **The info handler test proves the trust question by verifying the strict context, not by output (Low).** `getPluginInfo` is a direct import with no injection point (D-116-05), and `projectTrusted` has no visible effect yet. The test therefore checks the single `isProjectTrusted()` read that the strict mock verifies. A wrong value (for example a constant `true`) would not fail it. The orchestrator side carries the value and BLT-05 will make it visible.
4. **`noStatusReaders()` uses two adapter-style trackers, not the production built-in seed (Low).** Alternative: `builtin: createBuiltinMcpStatusReader(stub)`. Chosen to keep test seeds free of production seed behavior that BLT-05 will change. Either way it reads `status unknown`.
5. **New type pin in `test/edge/types.test.ts` that a lone `McpStatusReader` is rejected as `mcpStatus` (Low).** It is a compile-time `@ts-expect-error` case. It fails if someone reverts the frozen pair to a single reader.
6. **Flaky cucumber step accepted after a targeted rerun (Low).** Alternative: rerun the whole 10-minute adapter profile, which runs into the tool's 10-minute cap. Chosen: rerun the failing scenario and its whole feature, both green. The timed-out step is a marketplace add, unrelated to this change.
7. **No `windows append` for the built-in seed (Low).** It is a planned frozen-interface seed with a named owner (precedent: plan 01-06). `.planning/WINDOWS.md` is shared with parallel plans. REQUIREMENTS.md is not touched either: MSEL-01 is shared with other Phase 1 plans, and the orchestrator owns shared files.
8. **The edit touched `test/integration/mcp-status-conformance.test.ts`, which is outside files_modified (Low).** It is a direct `getPluginInfo` caller that would not compile otherwise.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BLT-05 can fill `createBuiltinMcpStatusReader` within the `PiMcpRegistry` view. It can switch naming in `withMcpServerStatus`'s body by `lookup.implementation`, and use `lookup.projectTrusted` and `lookup.cwd` for `project not trusted` and `overridden by mcp.json`. It needs no edit to `info.ts`'s status call, `edge/*`, or `index.ts`.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts
- FOUND: test/platform/mcp-builtin-status.test.ts
- FOUND: 351ef30 (ancestor of HEAD)
- Acceptance criteria: McpStatusReaders 1, McpStatusLookup 1, `mcpImplementation` in info.ts 1, `createBuiltinMcpStatusReader` in index.ts 2 (import plus call, see Deviations), per-implementation info cases present, `mcpStatus: noStatusSnapshot()` sites 0.
- Verification: check:static, test:unpaired and all-pair direct coverage (commit hook), test:integration exit 0, cucumber builtin 14/14, cucumber adapter 1557/1558 with the one timeout passing on rerun, test:e2e 33/33.

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*

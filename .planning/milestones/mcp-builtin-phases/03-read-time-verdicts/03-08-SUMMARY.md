---
phase: 03-read-time-verdicts
plan: "08"
subsystem: soft-dependency-markers
tags: [mcp, mcp-builtin, soft-dep, info, requires, cucumber, e2e, read-time-verdict]

requires:
  - phase: 03-read-time-verdicts
    provides: "03-02's McpDependency, mcpDependencyOf, recordMcpDependency; 03-03's resolutionFor views and readRecordMcpVerdict in info; 03-04's mcpDependencyMarker and the D-MB-07 table"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "the closed Companion set with mcp and builtin mcp, SoftDepStatus.mcpImplementation, the turn-off and profile-Pi steps"
provides:
  - "MCP_NAME_TABLE in shared/concerns/soft-dep.ts: one table that gives both the D-MB-07 marker and the D-P3-08 requires entry"
  - "companionRequirements(declaresAgents, declaresMcp: McpDependency | false, declaresWorkflows, probe), sorted by companion name"
  - "info.ts: ComposedRow, InfoBlock.mcpDependency, and the required wrapBlock argument"
  - "the requires scenarios in companion-missing.feature, verdict-info.feature, and project-scope.feature"
  - "the two e2e marker tests on D-MB-07 markers and D-P3-08 entries"
affects: [03-09]

actuals:
  tokens: 26000
  tasks: 3
  commits: 3
plan_head_before: e1f1349443529d355109480b182b81dfd442c778
plan_head_after: 10e156f50b0e984b48248bd246363eafa609053f

tech-stack:
  added: []
  patterns:
    - "A name table entry holds the companion and its missing flag; the marker is `requires <companion>` when missing, so marker and requires entry cannot disagree"
    - "Info row builders return { row, mcpDependency }; wrapBlock requires the dependency, so the compiler makes every arm answer for it"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - test/shared/concerns/soft-dep.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/integration/mcp-status-conformance.test.ts
    - features/mcp-server/companion-missing.feature
    - features/mcp-server/verdict-info.feature
    - features/mcp-server/project-scope.feature
    - test/e2e/adapter-detection-rpc.test.ts
    - test/e2e/install-soft-deps.test.ts

key-decisions:
  - "MCP_MARKER_RULE became MCP_NAME_TABLE, keyed the same way, with a { companion, missing } entry in every cell; mcpDependencyMarker returns `requires ${companion}` when missing"
  - "composeResolvedComponents computes the dependency over every declared config (dropped servers included); mcpDependencyOf already drops servers both implementations block"
  - "The second companion-missing info scenario installs on the shared adapter Pi before the profile Pi starts, because a scenario can start only one profile Pi"

patterns-established:
  - "Row builders in info.ts return ComposedRow; an arm that composes no MCP component uses withoutMcpDependency(row)"

requirements-completed: [MREC-05, MREC-07]

coverage:
  - id: D1
    description: "companionRequirements names the MCP implementation that runs every server, missing exactly when mcpDependencyMarker shows, for every runEvery shape and active implementation"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/shared/concerns/soft-dep.test.ts#companionRequirements MCP entry"
        status: pass
    human_judgment: false
  - id: D2
    description: "Entries sort by companion name: builtin mcp and mcp come before the pi- names"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/shared/concerns/soft-dep.test.ts#MREC-07: sorts builtin mcp before the pi- companions (D-P3-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every info arm stamps the MCP entry from the servers it composed (resolved, record-only readable, record-only unreadable P3-DC-24)"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts (D-P3-08 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The requires rows hold under both profiles and with no implementation"
    requirement: MREC-05
    verification:
      - kind: e2e
        ref: "features/mcp-server/{companion-missing,verdict-info,project-scope}.feature (adapter seed 679369, builtin seed 800295)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The real-Pi marker tests follow D-MB-07 and D-P3-08"
    requirement: MREC-05
    verification:
      - kind: e2e
        ref: "test/e2e/adapter-detection-rpc.test.ts, test/e2e/install-soft-deps.test.ts (PI_CM_E2E_REF=pinned, 15/15)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 08: The info requires line names the MCP implementation Summary

**Plugin info's `requires:` line now names the MCP implementation that runs every server: `mcp`, `pi-mcp-adapter`, or `builtin mcp`, tagged `(missing)` exactly when the row's D-MB-07 marker would show. Both come from one name table in `soft-dep.ts`. Every info row builder carries the MCP dependency of the servers it composed to the block, so a ws-only plugin gets no MCP entry and a record-only row reads its recorded servers.**

## Performance

- **Duration:** about 75 min
- **Started:** 2026-11-04 (plan base `e1f1349`)
- **Tasks:** 3 of 3
- **Files modified:** 10

## Accomplishments

- `shared/concerns/soft-dep.ts` (MCP arm only): `MCP_MARKER_RULE` became `MCP_NAME_TABLE`, which has a `{ companion, missing }` entry for every `runEvery` shape (both, adapter, builtin, split) and active implementation (none, adapter, builtin). `mcpDependencyMarker` returns `requires <companion>` when the entry is missing. `companionRequirements` takes `McpDependency | false`, pushes the same entry, and sorts the list by companion name in code-unit order (MREC-07). The module header and the `Companion` and `companionRequirements` docs state the rule.
- `orchestrators/plugin/info.ts`: `composeResolvedComponents` returns `mcpDependencyOf(Object.values(declaredMcpServers))`. `composeStateOnlyComponents` returns `recordMcpDependency(recorded, record)`, with the P3-DC-24 fallback. Every row builder in between returns `ComposedRow { row, mcpDependency }`. `InfoBlock.mcpDependency` is required, and `wrapBlock` takes it as a required argument. The failure, not-in-manifest, and invalid-manifest arms pass `false`. `withCompanionRequirements` reads `built.mcpDependency`. `withServerStatus` is unchanged.
- Scenarios: two `@own-implementation` info scenarios in `companion-missing.feature`, so the file has no profile-only tag. `verdict-info.feature` gains three scenarios: the `@mcp` stdio one and the bare-elicitation `@adapter-only`/`@builtin-only` pair. One cell changed in `project-scope.feature`.
- The e2e marker tests follow D-MB-07 and D-P3-08 on the real Pi.

## Task Commits

1. **Task 1: The requires: rule and its data path through info** - `c5e4410` (feat)
2. **Task 2: The requires: scenarios under both profiles and with no implementation** - `a13f65f` (test)
3. **Task 3: The e2e marker tests follow D-MB-07 and D-P3-08** - `10e156f` (test)

Before each commit I ran these by hand: `check:static` (exit 0 before Task 1 and after Task 3), and `test:coverage:direct` for `soft-dep.ts` and `info.ts` (exit 0, 100%). For Task 1 I also ran `test:modules`, `test:unpaired`, and `test:integration` (all exit 0). The hook printed "(no files to check)" for `check:commit` in this worktree.

## TDD RED evidence

The commit hook refuses a commit that holds only failing tests, so Task 1 committed its tests and implementation together (P1-DC-28).

- `test/shared/concerns/soft-dep.test.ts` on the unchanged product: 11 of 83 failed. These were both MREC-07 sort cases (`builtin mcp` and `mcp` before the `pi-` names), nine `D-P3-08: <shape> MCP dependency under <impl> gives ...` table rows (every row whose companion is `mcp` or `builtin mcp`), and `D-P3-08: ignores the adapter-loaded flag`. They passed afterwards. The base read the `McpDependency` object as a truthy boolean and always named `pi-mcp-adapter` from `piMcpAdapterLoaded`. The adapter-only rows and the D-P3-06 agreement rows passed on the base, because 03-04's marker was already in place. They are guards.
- `test/orchestrators/plugin/info.test.ts` with base `soft-dep.ts` and `info.ts`: 22 of 268 failed. These were every changed `requires: mcp (missing)` expectation (SURF-01, the sort case, ANAME-07, AVAR-03, AVAR-04 x4, ASTAT-01, ADET-01 "still names mcp"), the three ADET-01/D-P3-08 stdio implementation rows, the stdio-with-agent case, the three bare-elicitation rows, the not-installed sse row under builtin, the three stdio rows per implementation, and the record-only readable stdio row. Guards that passed on the base: the sse rows that name `pi-mcp-adapter`, the record-only unreadable rows (P3-DC-24), the ws rows (no MCP entry), and the disabled rows.

## Cucumber red proof (base `soft-dep.ts` and `info.ts` restored, then restored back)

| Profile | Scenarios run | Failed on base | Guards (passed on base) |
|---|---|---|---|
| adapter, companion-missing + verdict-info + project-scope | 14 (seed 941295) | 5, each on `plugin requires`: verdict-info stdio `@mcp` (base `pi-mcp-adapter` false), bare-elicitation `@adapter-only` (base: no requires row), companion-missing no-implementation info (base `pi-mcp-adapter` true), companion-missing adapter info (base `pi-mcp-adapter` false), project-scope pending-approval (base `pi-mcp-adapter` false) | the adapter sse scenarios in verdict-info (their `plugin requires` stays `pi-mcp-adapter`), and the four companion-missing install scenarios |
| builtin, verdict-info | 4 (seed 547144) | 2: stdio `@mcp` (base `pi-mcp-adapter` missing true), bare-elicitation `@builtin-only` (base `pi-mcp-adapter` missing true) | the two builtin sse scenarios (`pi-mcp-adapter` missing true either way) |

Final runs: adapter on the three files, 14/14 (seed 679369). Builtin on the three files, 4/4 (seed 800295). Under the builtin profile, companion-missing and project-scope have no scenario that runs.

## e2e runs

`PI_CM_E2E_REF=pinned node --test test/e2e/adapter-detection-rpc.test.ts test/e2e/install-soft-deps.test.ts`: 15/15 passed. The pinned upstream fetch worked from this container. On the Task 1 product, before the Task 3 edits, 8 of 15 failed on the old `pi-mcp-adapter` expectations. That is the red proof. At the pinned ref (`6196a61b`), context7's `.mcp.json` declares one stdio server (`npx -y @upstash/context7-mcp`), not an http server as the plan says. Both implementations run it either way, so the expectations are the same. The foreign-tool case is titled "ADET-02 / D-MB-07: with the built-in MCP turned off, a foreign extension's tool named mcp keeps {requires mcp} and the install warns". It expects `mcpCommands` `[]` (no `builtin:mcp`), the foreign tool path, reasons `["requires mcp"]`, a warning install, and `{ companion: "mcp", missing: true }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `test/integration/mcp-status-conformance.test.ts` is outside `files_modified`**
- **Found during:** Task 1 (a full integration run)
- **Issue:** Its ASTAT-01 case renders info for an installed stdio plugin with no implementation loaded. That row now reads `requires: mcp (missing)` (two lines).
- **Fix:** I changed the two expected lines and nothing else. No sibling plan of this wave owns the file.
- **Commit:** `c5e4410`

**2. [Rule 3 - Blocking] The second companion-missing info scenario cannot start two profile Pis**
- **Found during:** Task 2
- **Issue:** The plan says to install with `, which warned` after `Given pi runs with the scripted model`, then `Given pi runs with the scripted model and these companions:`. The world allows one profile Pi per scenario (`a profile Pi already started in this scenario`). Also, pi-mcp-adapter loads the plugin's server only if the install happened before its Pi started.
- **Fix:** The scenario installs on the shared adapter Pi (`which did not fail`), then turns off Pi's built-in MCP, then starts the profile Pi with pi-mcp-adapter, then runs the two adapter-report steps. So the untagged `mcp` comes from pi-mcp-adapter alone. The first info scenario covers the no-implementation install that warns.
- **Commit:** `a13f65f`

**3. [Rule 1 - Bug] Missing `plugin id` row in the new verdict-info scenarios**
- **Found during:** Task 2 (first adapter run)
- **Fix:** I added the `plugin id` row that every info result has. The table rule needs every field.
- **Commit:** `a13f65f`

**4. [Environment] Scratch path and commit trailer**
- Temp files went to the prompt's `.../scratchpad/p3/exec-08/`, not the plan's `.../scratchpad/03-08/`. Commits end with the plan's `Claude-Session: .../session_01EDUMG7S9uXh4o5dikBwum8` trailer (see Dubious Choices).

**Total deviations:** 4 (2 blocking, 1 bug, 1 environment). **Impact:** the planned behavior holds under both profiles, with no implementation, and on the real Pi.

## Issues Encountered

None beyond the deviations.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Plan 03-09's phase gate should run the two e2e tests again on the merged tree. The `project-scope.feature` cell is the D-P3-08 value for a stdio server under pi-mcp-adapter. The merge plan must apply the rule again to whatever Phase 2 merges there.

## Parent line candidates

- `docs/output-catalog.md` line 3041: "Agents need `pi-subagents`, MCP servers need `pi-mcp-adapter` ... sorted by package name ... A companion that the soft-dependency probe does not find loaded carries a `(missing)` tag". It should say that MCP servers need the implementation that runs every server: `mcp` (either), `pi-mcp-adapter` (only the adapter), or `builtin mcp` (only Pi's built-in MCP). It should say that `(missing)` shows exactly when the row's D-MB-07 marker would show, that a plugin whose every server both implementations block gets no MCP entry, and that the entries sort by companion name (so `builtin mcp` and `mcp` come before the `pi-` names), not by package name.
- `docs/output-catalog.md` line 3161: "Pi's built-in MCP client does not count as pi-mcp-adapter". Under D-P3-08 the example's stdio `github` server reads `requires: mcp` under either implementation. The example text and its rendered `requires:` line need the new wording.
- `docs/json-output.md` line 723 (`requires`): "Companion extensions the resolved components need, sorted by name". It should say "Companions (extensions or MCP implementations) ..." and that the MCP entry names `mcp`, `pi-mcp-adapter`, or `builtin mcp`. Line 766 (`companion`), "Companion extension that a component needs", needs the same change.
- CHANGELOG (D-P3-21): "`info`'s `requires:` line names the MCP implementation that runs every server (`mcp`, `pi-mcp-adapter`, or `builtin mcp`), tagged `(missing)` when the active one cannot run them all. `info --json` now reports `{\"companion\":\"mcp\"}` where it reported `pi-mcp-adapter` for most plugins."
- The catalog fixture `test/architecture/catalog-uat/fixtures/plugin-info.ts` and the renderer tests build `requires` literals by hand. They are unchanged, and `test:unpaired` passed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-17: one name table feeds the marker and the requires entry. The D-P3-06 cases in `soft-dep.test.ts` check that they agree for all twelve (runEvery, active) pairs. T-03-18: the record-only arm reads `installed.verdict.recorded`, which `readRecordMcpVerdict` already returns. info.ts adds no read. T-03-SC: no package was added, and `npm ci` used the committed lockfile.

## Dubious Choices

- **The second companion-missing info scenario installs while pi-mcp-adapter is active, not with no implementation.** Severity: Medium. Alternatives: (a) install with no implementation, then `When the user restarts pi with pi-mcp-adapter` and the 03-04 `When` listing wait, then info (the server status would race the adapter's first report); (b) a parent line that lets the world start a second profile Pi. Why dubious: the plan asked for an install `which warned`, followed by the adapter Pi. My scenario proves only "adapter loaded gives `mcp` untagged", and the first scenario proves the no-implementation half.
- **The e2e foreign-tool case in adapter-detection-rpc now turns off the built-in MCP.** Severity: Low. The plan asked for this. Its `mcpCommands` is `[]`, so it no longer shows that a foreign tool and `builtin:mcp` live together.
- **`mcpDependencyOf` reads every declared config, dropped servers included.** Severity: Low. Alternative: only the written (not dropped) servers. Why dubious: on a partially-available row, a server that the active implementation drops can change `runEvery`. With an sse server under built-in, the entry is `pi-mcp-adapter (missing)`, as D-P3-08 intends. With the written servers only, it would be `mcp`.
- **Commit trailer session ID.** Severity: Low. This session's harness gave `session_01EDUMG5p4jHecGXqAFGi3Do`, but the plan, the executor brief, and CHILD-SESSION-BRIEF.md require exactly `session_01EDUMG7S9uXh4o5dikBwum8`. I followed the project instruction.
- **The not-installed sse row under built-in now carries `requires: pi-mcp-adapter (missing)`.** Severity: Low. It had no requires line before, because its only server was dropped. This follows D-P3-08 (I = {adapter}, active builtin), and the unit test pins it. Users see a new line on that row.

## Self-Check: PASSED

- FOUND: c5e4410, a13f65f, 10e156f (ancestors of HEAD)
- Acceptance greps: `mcpDependency` in info.ts 28 (needs 3 or more); `companion: "mcp"|"builtin mcp"` in soft-dep.test.ts 10 (2 or more); `requires: mcp (missing)` in info.test.ts 12 (1 or more); `builtin mcp` in info.test.ts 3 (1 or more); `"companion":"mcp"` in companion-missing.feature 2 (2 or more); `"companion":"builtin mcp"` in verdict-info.feature 2 (2 or more); `"companion":"mcp","missing":false` in project-scope.feature 1; `requires mcp` in install-soft-deps 7 (1 or more); `companion: "mcp"` in adapter-detection-rpc 2 (1 or more); `"requires mcp"` in adapter-detection-rpc 1 (1 or more); `check:features` exit 0.

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*

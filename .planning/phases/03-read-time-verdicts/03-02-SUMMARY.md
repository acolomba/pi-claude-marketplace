---
phase: 03-read-time-verdicts
plan: "02"
subsystem: soft-dependency-markers
tags: [mcp, mcp-builtin, soft-dep, markers, read-time-verdict, dependency]

requires:
  - phase: 03-read-time-verdicts
    provides: "03-01's readRecordMcpVerdict (record servers read offline) and the neutral resolver verdict with declaredMcpServers"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "frozen profileFor(id).classify, RecordedMcpServers, McpImplementationId"
provides:
  - "McpDependency { kind: \"mcp\"; runEvery } and isMcpDependency (shared/concerns/soft-dep.ts)"
  - "Dependency = \"agents\" | McpDependency | \"workflows\"; every row's dependency list carries the object"
  - "mcpDependencyOf(configs) and recordMcpDependency(recorded, record), pure (orchestrators/plugin/mcp-verdict.ts)"
  - "readRecordMcpDependency(record, source) (orchestrators/plugin/mcp-verdict-read.ts)"
  - "declaresMcp: McpDependency | false on every outcome; LedgerDegradationSignals.stagedMcpServers?: McpDependency"
  - "softDepMarkers and companionSeverity take McpDependency | false and keep today's rule"
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

actuals:
  tokens: 14171
  tasks: 3
  commits: 3
plan_head_before: a656803c7111fd4090c46068ca74b5e1338cf66d
plan_head_after: 8928f7cde6d3ea5ab5682bd2d1c79ccc7623781e

tech-stack:
  added: []
  patterns:
    - "A row's MCP dependency is computed once by its producer (mcpDependencyOf over the resolution's declaredMcpServers, or recordMcpDependency over the record's recorded servers) and carried as data; renderers only read it"
    - "mcp-verdict.ts is pure and imports neither mcp-verdict-read.ts nor recorded-servers.ts, so any module (install-outcome.ts included) may import it"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts
    - test/orchestrators/plugin/mcp-verdict.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts

key-decisions:
  - "The LAYER-05 declared-row outcome reads the record's MCP dependency inside the lock (declareInstalledPlugin) and carries it on the \"declared\" transaction outcome, because its post-lock caller in install-flow-ledger.ts holds no marketplace record to read against"
  - "enable-disable.ts derives the optional stagedMcpServers signal through one file-private helper (stagedMcpSignal) used by both enable producers, instead of two inline conditional spreads"
  - "import/execute.test.ts keeps its boolean declares table (its MCP column renamed mcp, titles unchanged) and maps true to the adapter-only McpDependency at the outcome"

patterns-established:
  - "Test fixtures spell an MCP dependency that renders today's marker as { kind: \"mcp\", runEvery: [\"adapter\"] }, which keeps the catalog at 324 states and 54652 bytes"

requirements-completed: [MREC-05, MREC-07]

coverage:
  - id: D1
    description: "mcpDependencyOf gives R and I for stdio, sse, bare-elicitation, ws, empty, split, and mixed inputs; recordMcpDependency covers recorded, re-resolved, and unreadable reads (P3-DC-24)"
    requirement: MREC-05
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/mcp-verdict.test.ts"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/mcp-verdict-read.test.ts#P3-DC-24: reads an unreadable legacy record that staged a server as the adapter's dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every outcome carries McpDependency | false computed from its declared or recorded servers"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#D-P3-10 / D-MB-07"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-swap.test.ts#D-P3-10 / D-MB-07: an update to a candidate whose only server the adapter blocks carries Pi's built-in MCP"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-results.test.ts#D-P3-10 / D-MB-07: promotes a recorded stdio server as a dependency both implementations run"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dependency carries the McpDependency; composeRowReasons finds it anywhere in the list; the installed list row reads it from the record's servers"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/shared/notification-resolve.test.ts#D-P3-10: finds the McpDependency among agents and workflows and renders the markers in canonical order"
        status: pass
      - kind: unit
        ref: "test/shared/concerns/soft-dep.test.ts#D-P3-10: isMcpDependency picks the McpDependency out of a mixed list"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/list-installed-row.test.ts#D-P3-10"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rendering is byte-identical for every catalog state (324 states, 54652 bytes)"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 02: Structured MCP dependency on every emit site Summary

**Every MCP soft-dependency emit site now carries an `McpDependency { kind: "mcp"; runEvery }` (or `false`) computed from the plugin's declared servers or its record's recorded servers by the new pure `mcpDependencyOf` / `recordMcpDependency`, and the `Dependency` union carries that object in place of the `"mcp"` literal, while the marker rule stays `requires pi-mcp-adapter` so the catalog keeps 324 states and 54652 bytes.**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-11-04T14:09Z (plan base commit time)
- **Completed:** 2026-11-04T14:58Z
- **Tasks:** 3 of 3
- **Files modified:** 55 (2 created, 53 modified)

## Accomplishments

- New `orchestrators/plugin/mcp-verdict.ts` (pure, D-P3-06 / D-P3-10 / P3-DC-24): `mcpDependencyOf(configs)` classifies each config with `profileFor("adapter").classify` and `profileFor("builtin").classify`, leaves out a server both block (or a malformed one), returns `false` when R is empty, and otherwise lists in the order adapter, builtin each implementation that runs every remaining server. `recordMcpDependency(recorded, record)` applies it to a recorded or re-resolved read, and an unreadable read falls back to `{ runEvery: ["adapter"] }` when the record staged a server.
- `mcp-verdict-read.ts`: `readRecordMcpDependency(record, source)` reads the record's servers with the same guarded legacy reader.
- `shared/concerns/soft-dep.ts`: `McpDependency`, `isMcpDependency`, `Dependency = "agents" | McpDependency | "workflows"`; `declaredDependencies` puts the object in the mcp slot; `softDepMarkers(declaresAgents, declaresMcp: McpDependency | false, ...)` keeps today's rule. `companionRequirements` is unchanged (plan 03-08). `notify-reasons.ts` `companionSeverity` takes `McpDependency | false`.
- `orchestrators/types.ts`: every `declaresMcp` is `McpDependency | false`; `LedgerDegradationSignals.stagedMcpServers` is an optional `McpDependency` (the `never` twin and every `Omit` kept). Every hard-coded `declaresMcp: false` stays as written.
- Producers: `installedPluginOutcome`, `composeInstalledRow`, `recordMaterializedMember`, the promotion re-materialization, the update swap (`installable`), and both enable producers use `mcpDependencyOf` over the resolution's `declaredMcpServers`; `promoteDependencyRecord` and the declared-row outcome use `readRecordMcpDependency`; the installed list row uses `recordMcpDependency` over 03-01's `recorded` value.
- Row builders (`stagedDependencies`, `composeInstalledRow`, `outcomeDependencies`, `enableRowDependencies`, `dependenciesFromRecord`) put the object in the list; `composeRowReasons` passes `dependencies.find(isMcpDependency) ?? false`.

## Task Commits

1. **Task 1: The outcome field carries the structured MCP dependency; rows keep today's dependency literal** - `53f4c49` (feat)
2. **Task 2: The Dependency vocabulary carries the McpDependency; rows render the same bytes** - `c48a1dd` (refactor)
3. **Task 3: Pin each producer's computed dependency** - `8928f7c` (test)

**Plan metadata:** the SUMMARY commit that follows these.

Hook results: inside the worktree each commit's hook printed "(no files to check)" for `npm run check:commit` and prettier (the known `.claude/` exclude); gitlint and the text fixers passed. The by-hand equivalent ran before each commit, all exit 0:

| Commit | `check:static` | `test:unpaired` (catalog 324 / 54652) | `test:modules` | Direct coverage (100%) | Other |
|---|---|---|---|---|---|
| `53f4c49` | pass | pass | pass | 15 changed sources | owner tests 2289/2289 |
| `c48a1dd` | pass | pass | pass | 11 changed sources | `test/integration/mcp-verdict-list.test.ts` 3/3 |
| `8928f7c` | pass | (tests only) | (tests only) | the plan's 10 listed sources | non-vacuity run below |

## TDD RED evidence (unit)

The commit hook refuses a failing-test-only commit, so Tasks 1 and 2 committed tests and implementation together (P1-DC-28).

- **Task 1**, product: `mcp-verdict.ts` replaced by a stub returning today's adapter-only reading (`false` for no configs, else `{ runEvery: ["adapter"] }`), restored byte for byte after the run. `node --test` over `mcp-verdict.test.ts` and `mcp-verdict-read.test.ts`: 7 failures, 15 passes:
  `not ok 11 - D-P3-06: both implementations run a stdio server`, `not ok 13 - ... only Pi's built-in MCP runs a bare-elicitation server`, `not ok 14 - ... a ws server that both implementations block gives no dependency`, `not ok 16 - ... servers split between the implementations leave runEvery empty`, `not ok 17 - ... a server both implementations block is left out of R`, `not ok 19 - D-P3-10: a recorded read gives the dependency of its configs`, `not ok 20 - D-P3-10: a re-resolved read gives the dependency of its configs`.
- **Task 2**, product at `53f4c49` (Task 1), new expectations in place: 16 failures, 514 passes. Assertion failures include `not ok 48 - D-P3-10: finds the McpDependency among agents and workflows and renders the markers in canonical order` (actual reasons lacked `requires pi-mcp-adapter`, because `includes("mcp")` cannot find the object), the PMOD-01 rows, `enableRowDependencies` (2), `update-row` (5), `list-installed-row` (2), and `buildReconcileAppliedCascade` (2). `soft-dep.test.ts` failed at load (`does not provide an export named 'isMcpDependency'`); semantic assessment: a load failure, because the export did not exist yet; the behavior it pins (the object in the mcp slot) is proven RED by the row-builder and `composeRowReasons` assertion failures above.
- **Task 3** (tests only, no product change): all 8 new D-P3-10 cases passed first time. Non-vacuity: with `installedPluginOutcome`'s value replaced by `{ kind: "mcp", runEvery: ["adapter"] }`, `node --test test/orchestrators/plugin/install-outcome.test.ts` exited 1 with 4 failures (`projects the complete empty-plugin summary ...` and the three `D-P3-10 / D-MB-07: an install ...` cases); the file was restored byte for byte (`cmp`) before the commit.

## Verification

- Acceptance greps: `export interface McpDependency` 1; `mcpDependencyOf(` in 7 orchestrator files; boolean `declaresMcp`/`stagedMcpServers?` declarations outside soft-dep.ts 0; `stagedMcpServers: true` 0; `export type Dependency = "agents" | McpDependency | "workflows"` 1; `export function isMcpDependency` 1; `push("mcp")` / `["mcp"] as const` / `includes("mcp")` in extensions 0; `declaresMcp: boolean,` in soft-dep.ts 1 (`companionRequirements`); `declaresMcp: true` only in `soft-dep.test.ts`, 2 occurrences (the `companionRequirements` rows).
- Catalog invariant: `git diff --stat a656803..HEAD -- docs/output-catalog.md test/architecture/catalog-uat/catalog-contract.test.ts` prints nothing.
- No file of plan 03-03 (`info.ts`, `fetch.ts`, their tests) and no frozen file was edited; typecheck never named them.
- Not run here (the post-merge wave gate owns them): `test:integration` as a whole (only `mcp-verdict-list.test.ts`), both cucumber profiles, `test:coverage:direct:all`.

## Files Created/Modified

- `orchestrators/plugin/mcp-verdict.ts` - new pure `mcpDependencyOf`, `recordMcpDependency`
- `orchestrators/plugin/mcp-verdict-read.ts` - `readRecordMcpDependency`
- `shared/concerns/soft-dep.ts` - `McpDependency`, `isMcpDependency`, the structured `Dependency`, `declaredDependencies`, `softDepMarkers`
- `shared/notify-reasons.ts` - `companionSeverity` takes `McpDependency | false`
- `shared/notification-resolve.ts` - `composeRowReasons` finds the object
- `orchestrators/types.ts` - field types and their docs
- `orchestrators/plugin/{install-outcome,install-flow-ledger,install-cascade,install-cascade.messaging,install-flow-results,update-swap,update-row,shared,enable-disable,list-installed-row}.ts`, `orchestrators/import/execute.ts` - producers, consumers, row builders
- `orchestrators/plugin/reinstall.messaging.ts`, `orchestrators/reconcile/{notify,apply-outcomes}.ts` - comments only
- Tests and catalog fixtures as listed in the plan, plus the three below

## Decisions Made

See `key-decisions` above; each is also listed under Dubious Choices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The declared-row outcome takes its MCP dependency from the lock**
- **Found during:** Task 1
- **Issue:** The plan has `declaredRowOutcome`'s async caller read the dependency, but that caller (`install-flow-ledger.ts`, after the lock) holds no marketplace record to read the record's servers against.
- **Fix:** `declareInstalledPlugin` (inside the lock, with the state) reads `readRecordMcpDependency` and puts it on the `"declared"` `InstallTransactionOutcome` variant as `mcpDependency`; the caller passes it to `declaredRowOutcome`, which takes it as an argument as planned. `promoteDependencyRecord` and `declareInstalledPlugin` add `marketplaceRecord === undefined ||` to their guard so the marketplace record narrows for the read source.
- **Files modified:** `install-flow-results.ts`, `install-flow-ledger.ts`
- **Committed in:** `53f4c49`

**2. [Rule 3 - Blocking] `sonarjs/function-return-type` on `mcpDependencyOf`**
- **Found during:** Task 1 (ESLint)
- **Fix:** One ternary return in place of an early `return false` and an object return.
- **Committed in:** `53f4c49`

**3. [Rule 3 - Blocking] Test files beyond `files_modified`, forced by the compiler or by computed values**
- `test/architecture/closed-set-enrollment.test.ts` (Task 2): its `AssertNever` exhaustiveness check over `Dependency` and its `softDepMarkers(…, true, …)` calls; now `Exclude<Dependency, "agents" | McpDependency | "workflows">` and an adapter-only `McpDependency`.
- `test/orchestrators/plugin/list-flow.test.ts` and `test/integration/mcp-verdict-list.test.ts` (Task 2): dependency lists on list rows; the sweep's adapter-only object is the real value for their sse records.
- **Committed in:** `c48a1dd`

**4. [Rule 1 - Plan inconsistency] `import/execute.test.ts`'s boolean table**
- **Issue:** The plan says to keep the table boolean and map at the outcome, while its acceptance grep allows `declaresMcp: true` only in `soft-dep.test.ts`.
- **Fix:** The table keeps booleans under the column name `mcp` (the test titles still read `declaresMcp ${mcp}`), mapped with `mcp && ADAPTER_MCP` at the outcome and in the `installed` helper.
- **Committed in:** `53f4c49`

**5. [Rule 3 - Blocking] Producer cases asserting the computed value**
- 14 cases whose stub servers are stdio now expect `runEvery: ["adapter", "builtin"]` (enable-disable 2, install-flow-ledger 4, reinstall-flow 3, update-flow 1, update-swap 4); two summaries that staged a server without declaring one now declare it (`install-outcome.test.ts` stdio, `install-cascade.test.ts` sse), so the assertion follows the declaration. In Task 2, `install-flow-planning.test.ts`'s cascade row (stdio) and `reinstall.messaging.test.ts`'s companion table row were fixed the same way.
- **Committed in:** `53f4c49`, `c48a1dd`

**6. [Environment] Stale ESLint content cache**
- **Found during:** Task 1 (`npm run check:static`)
- **Issue:** `npm run lint` reported `McpDependency` unused in `notify-reasons.ts` and an unresolved `readRecordMcpDependency` in a test, while a cache-free ESLint run of the same files passed.
- **Fix:** Deleted `node_modules/.cache/eslint/.cache_*` in the worktree; the cached and full runs then passed. No source change.

**7. [Environment] Scratch path**
- `PLAN_BASE` was written to the scratch subfolder the prompt names (`.../scratchpad/p3/exec-02/PLAN_BASE`), not the plan's `.../scratchpad/03-02/`.

**Total deviations:** 7 (4 blocking, 1 plan inconsistency, 2 environment). **Impact:** the planned behavior holds; three test files outside `files_modified` changed.

## Issues Encountered

- **Interim marker for a server only Pi's built-in MCP runs.** The producers now read the declared servers, not the adapter's staged count. A plugin whose only server has a bare elicitation capability (the adapter blocks it, built-in runs it) used to carry no MCP dependency, because the adapter staged nothing; it now carries `{ runEvery: ["builtin"] }`. Under today's rule that renders `requires pi-mcp-adapter` (and raises SEV-01 to warning) when pi-mcp-adapter is not loaded, on install, update, enable, cascade, and list rows. Plan 03-04 switches the rule so the marker reads `requires builtin mcp`. No catalog state covers this case, so the counters hold. The new case in `install-flow-ledger.test.ts` pins the interim text, so 03-04 will need to change it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The marker inputs are in place for 03-04 (rule switch), 03-05 (consent), and 03-08 (`companionRequirements` still takes a boolean; `soft-dep.test.ts`'s two `companionRequirements` rows and the ADET-01 loop pass `declaresMcp !== false`).

## Parent line candidates

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. `mcp-verdict.ts` is pure and imports neither read module (T-03-05; fallow found no cycle), and every producer takes its value from the compiler-listed sites with a pinned case per producer kind (T-03-04). No package was added (T-03-SC).

## Dubious Choices

- **Claude-Session trailer.** Severity: Low. The commits end with `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`, as `.planning/CHILD-SESSION-BRIEF.md`, the plan, the orchestrator's executor rules, and every earlier commit on the branch require; this executor's harness suggested a different session URL. Alternative: the harness URL. Why dubious: two sources named different trailers; the checked-in project rule was taken.
- **Interim `requires pi-mcp-adapter` for a server only built-in runs.** Severity: Medium. See Issues Encountered. Alternatives: keep the staged count for the marker until 03-04 (the plan forbids it: every producer reads the declared or recorded servers), or have this plan switch the rule (03-04's job). Why dubious: between this plan and 03-04 a bare-elicitation-only plugin gains a marker that names the wrong companion, and a test pins that text.
- **The declared-row dependency is read inside the lock.** Severity: Low. Alternative: pass the state out of the lock to the caller. Why dubious: it adds a field to the `"declared"` transaction outcome the plan did not name, and one offline read inside the state lock.
- **A redundant `marketplaceRecord === undefined` guard** in `promoteDependencyRecord` and `declareInstalledPlugin`. Severity: Low. Alternative: a non-null assertion or a separate lookup helper. Why dubious: the guard can never be the deciding condition (a missing marketplace record already means no plugin record), and exists only to narrow the type.
- **Task 3's ws case uses a hand-made legacy record.** Severity: Low. The record has no basis, a clean stored compatibility, a staged `live` server, and a recorded ws config, so its row is `installed` and only the dependency source differs. A real record with a ws server stores the `mcpServers` kind and lists as `partially-installed`, which carries no dependencies at all. A second case (bare elicitation under built-in, `[builtin]`) covers a realistic record. Why dubious: the first record shape cannot occur from a real install.
- **The `import/execute.test.ts` table column renamed to `mcp`.** Severity: Low. Alternatives: keep `declaresMcp` and fail the acceptance grep, or turn the table into objects and change the test titles. Why dubious: a fixture rename to satisfy a grep.
- **`false as const` in two test files** (`update-row.test.ts`, `soft-dep.test.ts`) where untyped fixture objects would widen `false` to `boolean`. Severity: Low. Alternative: annotate each fixture with its outcome type. Why dubious: a cast-like spelling in tests.
- **`isMcpDependency` tests `typeof dependency === "object"`.** Severity: Low. Alternative: `dependency !== "agents" && dependency !== "workflows"`, or a `kind` check. Why dubious: it relies on the MCP member being the only object member of the union.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts
- FOUND: test/orchestrators/plugin/mcp-verdict.test.ts
- FOUND: 53f4c49, c48a1dd, 8928f7c (ancestors of HEAD)

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*

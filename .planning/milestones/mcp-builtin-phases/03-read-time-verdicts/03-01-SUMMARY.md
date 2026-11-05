---
phase: 03-read-time-verdicts
plan: "01"
subsystem: plugin-list
tags: [mcp, resolver, list, mcp-builtin, read-time-verdict, neutral-compatibility]

requires:
  - phase: 01-foundation-and-pi-1-5-0
    provides: "frozen effectiveMcpCompatibility, profileFor, recordedMcpServers, createLegacyServersReader, run.softDeps.mcpImplementation, the record fields mcpServerConfigs/compatibilityBasis"
provides:
  - "resolutionFor(resolved, active): one MCP implementation's view of a neutral resolution (domain/plugin-resolver.ts)"
  - "the neutral resolver verdict: droppedMcpServers and the mcpServers kind hold only the servers both implementations block"
  - "readRecordMcpVerdict(record, source, active): the offline effective read of a record's MCP verdict (orchestrators/plugin/mcp-verdict-read.ts)"
  - "install (statePhase) writes compatibilityBasis: \"neutral\""
  - "list installed and not-installed rows, --partial, the LLM list tool, and the browse loader follow run.softDeps.mcpImplementation"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

actuals:
  tokens: 22355
  tasks: 3
  commits: 3
plan_head_before: 5127539fc863de3518245cea4557530f0e1460b6
plan_head_after: 5fe4c3168fd8877548afa2ae6e8a57fe67f893e0

tech-stack:
  added: []
  patterns:
    - "Fresh resolutions take an implementation's view with resolutionFor; stored records take it with readRecordMcpVerdict; both run the frozen effectiveMcpCompatibility, so install-time and list-time rows agree"
    - "mcp-verdict-read.ts is imported only by modules install-outcome.ts does not reach (cycle through the frozen recorded-servers.ts)"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
    - test/orchestrators/plugin/mcp-verdict-read.test.ts
    - features/mcp-server/verdict-list.feature
    - test/integration/mcp-verdict-list.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - test/domain/mcp-resolution.test.ts
    - test/domain/plugin-resolver.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/list-installed-row.test.ts
    - test/orchestrators/plugin/list-candidate-row.test.ts
    - test/orchestrators/plugin/list-flow.test.ts
    - test/edge/handlers/tools.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/operations.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/integration/mcp-server-records.test.ts

key-decisions:
  - "The no-reinstall switch scenario installs under the adapter-profile Pi and then lists from a fresh Pi that runs Pi's built-in MCP, because a restart without pi-mcp-adapter lands on no MCP implementation (the adapter turns built-in MCP off)"
  - "upgradeCandidate takes the compose options without manifestPath and mcpImplementation, so the completion path in edge-deps.ts compiles unchanged and keeps the stored verdict"
  - "resolutionFor spreads the neutral resolution and overrides only state, unsupported, and droppedMcpServers; every implementation blocks what the neutral verdict blocks, so no stale droppedMcpServers can survive"

patterns-established:
  - "Every list surface passes the run's implementation explicitly (no default): PluginListPayloadOptions.mcpImplementation is required; listPlugins takes it from run.softDeps"

requirements-completed: [MREC-03]

coverage:
  - id: D1
    description: "Neutral resolver verdict and resolutionFor views (adapter, builtin, none; ordering; bundle; unavailable; stdio adjacency)"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/domain/mcp-resolution.test.ts#D-P3-01: stages the adapter subset and drops only the servers both implementations block"
        status: pass
      - kind: unit
        ref: "test/domain/plugin-resolver.test.ts#resolutionFor"
        status: pass
    human_judgment: false
  - id: D2
    description: "Install records the neutral verdict with compatibilityBasis neutral"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#MREC-01 / D-MB-04: records every declared server in its Claude form and leaves the resolver's configs unexpanded"
        status: pass
      - kind: integration
        ref: "test/integration/mcp-verdict-list.test.ts#D-P3-01 / D-P3-02: an install stores the neutral verdict and its basis"
        status: pass
    human_judgment: false
  - id: D3
    description: "readRecordMcpVerdict: recorded, no-trace legacy, re-resolved legacy, unreadable, per implementation"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/mcp-verdict-read.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/mcp-verdict-list.test.ts#MREC-02: a legacy record with no MCP trace reads as no servers and re-resolves nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "list installed rows follow the active implementation with no reinstall (adapter installed, builtin partially-installed)"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/list-installed-row.test.ts#MREC-03 / D-P3-05: lists the same record as partially installed under Pi's built-in MCP"
        status: pass
      - kind: integration
        ref: "test/integration/mcp-verdict-list.test.ts#MREC-03 / D-P3-04: list shows one sse install per implementation and writes nothing"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-list.feature (adapter and builtin profiles)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Not-installed rows and list --partial follow the active implementation"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/list-candidate-row.test.ts#MREC-03"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/list-flow.test.ts#MREC-03 / D-67-01"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-list.feature#A plugin with an sse server is partially available, under Pi's built-in MCP (MREC-03)"
        status: pass
    human_judgment: false
  - id: D6
    description: "LLM list tool probes once per call and passes the implementation; browse loader passes the browse run's implementation"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/edge/handlers/tools.test.ts#registerListPluginsTool"
        status: pass
    human_judgment: true
    rationale: "The browse picker's loader change is straight-line wiring with no dedicated case; the TUI picker cannot be driven by a cucumber scenario here, so a reviewer should confirm the browse rows match list under Pi's built-in MCP"

duration: 47min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 01: Neutral record and read-time list verdicts Summary

**The resolver's verdict and every new install record are now implementation-neutral (`compatibilityBasis: "neutral"`), and `list` (installed rows, not-installed rows, `--partial`, the LLM list tool, browse) computes each plugin's state for `run.softDeps.mcpImplementation` at read time through `resolutionFor` and the new offline `readRecordMcpVerdict`, so one sse plugin lists as installed under pi-mcp-adapter and partially installed under Pi's built-in MCP with no reinstall.**

## Performance

- **Duration:** about 47 min
- **Started:** 2026-11-04T13:05Z (approximate, from the first scratch log)
- **Completed:** 2026-11-04T13:52Z
- **Tasks:** 3 of 3
- **Files modified:** 25 (4 created, 21 modified)

## Accomplishments

- `mergeServers` classifies each non-malformed server under both profiles: the adapter verdict still decides the staged `mcpServers` subset (MSEL-04), and the neutral verdict (blocked only when Pi's built-in MCP also blocks, with the adapter's feature) decides `droppedMcpServers` and the `mcpServers` kind (D-P3-01). `declaredMcpServers`, `mcpBundle`, and `resolveStrict`'s two-argument signature are unchanged (frozen interface 4).
- `resolutionFor(resolved, active)` (two overloads, no default) derives one implementation's view with the frozen `effectiveMcpCompatibility`; `"none"` gives the neutral resolution back, and an `unavailable` resolution returns as is (D-P3-03).
- `statePhase` writes `compatibilityBasis: "neutral"` (one line, D-P3-02), so install, enable, promotion, import, and cascade members store the neutral verdict with its basis.
- New `orchestrators/plugin/mcp-verdict-read.ts`: `readRecordMcpVerdict(record, source, active)` joins `recordedMcpServers` with `effectiveMcpCompatibility`, writes nothing, reaches no network, and answers a legacy record with no MCP trace as no servers without loading the manifest (P3-DC-18).
- `composeInstalledListRow` classifies the effective `unsupported` and the candidate's view; `availableRowMessage` and the `--partial` bucket use `resolutionFor`; `PluginListPayloadOptions.mcpImplementation` is required and `listPlugins` takes it from the run; the LLM list tool opens its one snapshot before the payload and reuses it; the browse loader takes the browse run's implementation.
- `features/mcp-server/verdict-list.feature`: five scenarios (installed and available pairs per profile, plus the adapter-to-built-in switch with no reinstall).
- `test/integration/mcp-verdict-list.test.ts`: the real install's neutral record, the list rows under adapter, builtin, and none with `state.json` byte-identical after the reads, and the no-trace legacy read.

## Task Commits

1. **Task 1: Neutral record and effective installed rows in list, end to end** - `7cf1f3b` (feat)
2. **Task 2: Not-installed rows and the --partial filter follow the active implementation** - `78b50e1` (feat)
3. **Task 3: Prove the neutral record and the effective rows through the real paths** - `5fe4c31` (test)

**Plan metadata:** the SUMMARY commit that follows these.

## Red proof per profile (cucumber)

Each new scenario ran on the plan's base commit `5127539` (Task 1 and Task 2 product files restored to that commit) before the product change.

| Scenario | Profile | On the base commit | Failing step and observed row |
|---|---|---|---|
| An installed plugin with an sse server lists as installed, under pi-mcp-adapter (MREC-03) | adapter | passed | Guard: the adapter verdict already ran the sse server, so the row was already `installed`. It protects the adapter row from regressing. |
| An installed plugin with an sse server lists as partially installed, under Pi's built-in MCP (MREC-03) | builtin | failed | `Then the result lists these plugins:` read `installed` with `requires pi-mcp-adapter` instead of `partially-installed` with `unsupported mcp` |
| A plugin installed under pi-mcp-adapter lists as partially installed when pi runs its built-in MCP instead, with no reinstall (MREC-03) | adapter (`@own-implementation`) | failed | `Then the result lists these plugins:` read `installed` with `requires pi-mcp-adapter` instead of `partially-installed` with `unsupported mcp` |
| A plugin with an sse server is available to install, under pi-mcp-adapter (MREC-03) | adapter | passed | Guard: the not-installed row was already `available` under the adapter. |
| A plugin with an sse server is partially available, under Pi's built-in MCP (MREC-03) | builtin | failed | `Then the result lists these plugins:` read `available` with no reasons instead of `partially-available` with `unsupported mcp` |

GREEN after the change: adapter profile `3 scenarios (3 passed)`, builtin profile `2 scenarios (2 passed)` on `features/mcp-server/verdict-list.feature`.

## TDD RED evidence (unit)

The commit hook refuses a failing-test-only commit, so each task committed tests and implementation together (P1-DC-28). RED was taken by restoring the product files of the task to the commit before it and running the new cases (`node --test --test-reporter=tap <file>` under the non-DAC wrapper):

- **Task 1**, product at `5127539`:
  - `test/domain/mcp-resolution.test.ts`: `not ok 54 - D-P3-01: stages the adapter subset and drops only the servers both implementations block` and `not ok 55 - D-P3-01: an sse and a bare-elicitation server leave the neutral verdict clean` (assertion: the old resolver dropped the bare-elicitation server and kept the `mcpServers` kind).
  - `test/orchestrators/plugin/list-installed-row.test.ts`: `not ok 22 - MREC-03 / D-P3-05: lists the same record as partially installed under Pi's built-in MCP` (actual `status: 'installed'`, `dependencies: ['mcp']`; expected `partially-installed` with `reasons: ['unsupported mcp']`), and `not ok 25` (the partially-upgradable candidate view).
  - `test/orchestrators/plugin/list-flow.test.ts`: `not ok 106` (payload under builtin) and `not ok 108 - MREC-03: listPlugins reads the rows for the run's MCP implementation`.
  - `test/orchestrators/plugin/install-outcome.test.ts`: `not ok 5`, `not ok 43`, `not ok 45` (expected `compatibilityBasis: "neutral"`, actual absent).
  - `test/edge/handlers/tools.test.ts`: `not ok 26`, `32`, `33` (the probe was promised once and not made).
  - `test/domain/plugin-resolver.test.ts` and `test/orchestrators/plugin/mcp-verdict-read.test.ts` failed at load (`does not provide an export named 'resolutionFor'`, `ERR_MODULE_NOT_FOUND` for `mcp-verdict-read.ts`). Semantic assessment: these two are load failures, not assertion failures, because the export and the module did not exist yet; the behavior they pin is proven RED by the assertion failures above, which exercise the same functions through their callers.
- **Task 2**, product at `7cf1f3b`:
  - `test/orchestrators/plugin/list-candidate-row.test.ts`: `not ok 18` (sse under builtin read `available`) and `not ok 19` (bare elicitation under adapter read `available`).
  - `test/orchestrators/plugin/list-flow.test.ts`: `not ok 110 - MREC-03 / D-67-01: --partial keeps a not-installed sse plugin under Pi's built-in MCP` (the plugin was filtered out).
- **Task 3** (integration, no product change): the no-trace legacy case was checked against a sabotaged guard (`false &&` in `legacyReaderFor`): it failed with `partially-installed` / `unsupported mcp` in place of `installed`, so it discriminates the guard. The sabotage was reverted before the commit.

## Verification

- `npm run test:coverage:direct --` on every touched source: exit 0 (100% line, function, and branch coverage), for Task 1's nine sources and Task 2's two.
- `npm run check:static`: exit 0 after each task (typecheck, ESLint, fallow dead code and both cycle classes, Prettier, pairing, check:features).
- `npm run test:modules`: exit 0 (whole unit suite, after the Task 1 fixes).
- `npm run test:integration`: exit 0.
- `node --test test/architecture/catalog-uat/catalog-contract.test.ts`: 5 pass (counters 324 / 54652 unchanged).
- Cucumber `features/mcp-server/verdict-list.feature`: adapter 3/3, builtin 2/2.
- Acceptance greps: `export function resolutionFor` 3 (overloads and implementation), `compatibilityBasis: "neutral"` in install-outcome.ts 1, `readRecordMcpVerdict` in list-installed-row.ts 2, `mcpImplementation` in list-flow.ts 6, `resolutionFor` in list-candidate-row.ts 2.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` - neutral `droppedMcpServers` and `mcpServers` kind; staging subset unchanged
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` - `resolutionFor`
- `extensions/pi-claude-marketplace/domain/resolver-types.ts` - `droppedMcpServers` comment names the neutral list
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` - `statePhase` writes the basis (one line)
- `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts` - new offline record read
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` - `InstalledRecordLike` doc only
- `extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts` - effective installed rows
- `extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts` - not-installed rows take the view
- `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` - required `mcpImplementation`; `listPlugins` reads it from the run
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` - one snapshot before the payload, reused for the resolve
- `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts` - the loader takes the browse run's implementation
- `features/mcp-server/verdict-list.feature` - five MREC-03 scenarios
- `test/integration/mcp-verdict-list.test.ts` - real-path proof
- Unit tests as listed in the frontmatter

## Decisions Made

- See `key-decisions` above. Each one is also logged under Dubious Choices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's scenario] The switch scenario cannot use a restart without pi-mcp-adapter**
- **Found during:** Task 1 (GREEN run of the `@own-implementation` scenario)
- **Issue:** After `When the user restarts pi without pi-mcp-adapter`, Pi runs no MCP implementation: pi-mcp-adapter writes `-builtin:mcp` to the user settings at `session_start`, and `restartPi` waits for that write before it stops the adapter Pi (`features/support/world.ts`). Under no implementation the neutral view runs the sse server, so the row reads `installed`, not the planned `partially-installed`.
- **Fix:** The scenario installs from the adapter-profile Pi and then starts a profile Pi that runs Pi's built-in MCP (`Given pi runs with the scripted model`), and lists from it with no reinstall. The title says so: "A plugin installed under pi-mcp-adapter lists as partially installed when pi runs its built-in MCP instead, with no reinstall (MREC-03)". The red proof was retaken for this form.
- **Files modified:** `features/mcp-server/verdict-list.feature`
- **Committed in:** `7cf1f3b`

**2. [Rule 3 - Blocking] Record expectations in sibling test files**
- **Found during:** Task 1 (`npm run test:modules`)
- **Issue:** Six cases outside the plan's file list pinned the install record without the basis: `install-flow-ledger.test.ts` (1), `operations.test.ts` (2), `reinstall-flow.test.ts` (3, where the install seed now has the basis and the reinstall's `replaceCompatibility` clears it).
- **Fix:** Expect `compatibilityBasis: "neutral"` after install and enable; in the reinstall cases, compare against the install record without its basis, with a WR-02 comment.
- **Committed in:** `7cf1f3b`

**3. [Rule 3 - Blocking] The vocabulary guard rejects a backticked `unsupported`**
- **Found during:** Task 1 commit (hook ran `test/architecture/partial-vocabulary-guard.test.ts`)
- **Fix:** Reworded two new comments to "the `unsupported` kind list".
- **Committed in:** `7cf1f3b`

**4. [Rule 3 - Blocking] The no-trace legacy proof cannot remove the manifest**
- **Found during:** Task 3
- **Issue:** `list` renders a marketplace whose manifest cannot be read as a bare `(failed)` header with no rows (BOUND-01), so a record cannot "still list" after its manifest file is removed.
- **Fix:** The case strips the record's trace while the plugin still declares the sse server: a re-resolution would read it as blocked under Pi's built-in MCP, so the `installed` row proves the read loaded nothing. Verified against a sabotaged guard.
- **Committed in:** `5fe4c31`

**5. [Rule 2 - Correctness] The LLM list tool probes on its load-failure paths too**
- **Found during:** Task 1
- **Issue:** Opening the one snapshot before the payload means a failing payload load also probes once.
- **Fix:** The two failure-path cases in `tools.test.ts` promise one probe; the boundary doc says so.
- **Committed in:** `7cf1f3b`

**Total deviations:** 5 auto-fixed (1 plan bug, 3 blocking, 1 correctness). **Impact:** the planned behavior holds; the switch scenario reaches Pi's built-in MCP through a fresh Pi rather than a restart.

## Issues Encountered

- **Update and reinstall drop the basis (owned by 03-06).** The update swap's final write and intent mark replace the compatibility through `replaceCompatibility`, which clears the basis, while the verdict they now write comes from the neutral resolver. Until 03-06 sets the basis there, an updated or reinstalled record reads as a legacy adapter verdict that actually holds the neutral one: under pi-mcp-adapter, a bare-elicitation server in such a record is not counted against it. `reinstall-flow.test.ts` pins the cleared basis for now; 03-06 changes those three expectations back.
- **Install consent still reads the neutral verdict (owned by 03-05).** Under pi-mcp-adapter, a plugin whose only adapter-blocked server has a bare elicitation capability now installs without `--partial`, stages the adapter subset without that server, and then lists as `partially-installed`.
- **Completions read the neutral candidate verdict.** `edge-deps.ts` (unchanged) gets the resolver's neutral verdict for an upgrade candidate and the stored record verdict (P3-DC-22).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`resolutionFor` and `readRecordMcpVerdict` are ready for 03-02 to 03-09. Callers of `mcp-verdict-read.ts` must stay outside the modules `install-outcome.ts` reaches (named in the module header).

## Parent line candidates

- `edge/register.ts` (frozen) passes the run's active MCP implementation to the completion resolver, and `shared/completion-cache.ts` keys its plugin index by it, so `update --partial` completions follow the active implementation (P3-DC-22).
- `01-FROZEN.md` interface 3 says "An install writes a new record without the basis"; since D-P3-02 the install writes `compatibilityBasis: "neutral"`.
- CHANGELOG: "`/claude:plugin list` shows each plugin's state for the MCP implementation Pi runs now (pi-mcp-adapter, Pi's built-in MCP, or none), so switching needs no reinstall."

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. `readRecordMcpVerdict` (T-03-01, T-03-03) is outside NETWORK_SEAMS and imports no git surface; the no-trace guard is in place and tested.

## Dubious Choices

- **Switch scenario uses a fresh built-in Pi instead of a restart without the adapter.** Severity: Medium. Alternatives: two restarts (without the adapter, then with built-in MCP turned on), which adds a second `When`; or keep the planned restart and expect the no-implementation row, which belongs to 03-04's marker work. Why dubious: the plan named the restart step, and a fresh Pi is a weaker image of a user's switch than a restart.
- **Sibling test files changed to follow the basis.** Severity: Medium. The three `reinstall-flow.test.ts` expectations now pin the cleared basis after a reinstall, which is a temporary defect until 03-06 sets the basis. Alternative: set the basis in the update swap now, but that function is Phase 1's and 03-06's to change. Why dubious: a test pins interim behavior.
- **Load-failure paths of the LLM list tool now probe once.** Severity: Low. Alternative: open the snapshot inside the payload try and skip it on failure. Why dubious: an extra `getCommands`/`getAllTools` call on a failing call.
- **The no-trace legacy proof uses a stripped record with a declared sse server, not a removed manifest.** Severity: Low. Alternative: a spy on the manifest loader (a test seam the conventions forbid). Why dubious: the record shape is artificial.
- **`resolutionFor` spreads the neutral resolution and relies on "every implementation blocks what the neutral verdict blocks" to leave no stale `droppedMcpServers`.** Severity: Low. Alternative: rebuild the object without the key (needs an unused binding that `sonarjs/no-unused-vars` rejects). Why dubious: the invariant lives in the frozen effective read.
- **No WINDOWS.md entry for the interim update/reinstall basis gap.** Severity: Low. Alternative: `gsd-tools windows append --kind deviation`. Why dubious: the ledger is a shared file that parallel worktrees would conflict on; the gap is recorded here for the orchestrator and 03-06 instead.
- **No dedicated unit case for the browse loader's implementation.** Severity: Low. Alternative: a TUI-driven browse test under each implementation. Why dubious: the browse rows are proven only through the shared payload builder.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
- FOUND: test/orchestrators/plugin/mcp-verdict-read.test.ts
- FOUND: features/mcp-server/verdict-list.feature
- FOUND: test/integration/mcp-verdict-list.test.ts
- FOUND: 7cf1f3b, 78b50e1, 5fe4c31 (ancestors of HEAD)

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*

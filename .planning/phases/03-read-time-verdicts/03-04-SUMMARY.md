---
phase: 03-read-time-verdicts
plan: "04"
subsystem: soft-dependency-markers
tags: [mcp, mcp-builtin, soft-dep, markers, list, cucumber, read-time-verdict]

requires:
  - phase: 03-read-time-verdicts
    provides: "03-02's McpDependency { kind, runEvery } on every emit site and the installed list row; 03-01's readRecordMcpVerdict and the neutral resolver verdict"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "frozen SoftDepStatus.mcpImplementation, the closed-set markers requires mcp / requires builtin mcp, readBuiltinTurnedOff, waitForStubListing, the turn-off and restart steps"
provides:
  - "mcpDependencyMarker(declaresMcp, probe) and the D-MB-07 rule table MCP_MARKER_RULE (shared/concerns/soft-dep.ts)"
  - "softDepMarkers' mcp slot and companionSeverity's MCP term both read mcpDependencyMarker"
  - "partially-installed list rows carry only the record's MCP dependency, and LIST_CONTEXT shows markers on them"
  - "features/step_definitions/mcp-server/verdict-settings.steps.ts: the settings check and a post-restart listing wait"
affects: [03-05, 03-06, 03-07, 03-08, 03-09]

actuals:
  tokens: 31300
  tasks: 3
  commits: 3
plan_head_before: 590fb325d86e80d217c599007c72bf94ab4c5be4
plan_head_after: e76002d91d427f53ba095627f3135b8b38694bc3

tech-stack:
  added: []
  patterns:
    - "One lookup table keyed by runEvery shape (both, adapter, builtin, split) and active implementation decides the MCP marker; severity asks the same function, so marker and SEV-01 cannot disagree"
    - "A list row's producer decides which dependencies a row carries; the row policy only turns markers on"

key-files:
  created:
    - features/step_definitions/mcp-server/verdict-settings.steps.ts
  modified:
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - docs/messaging-style-guide.md
    - features/mcp-server/verdict-markers.feature
    - features/mcp-server/verdict-list.feature
    - features/mcp-server/companion-missing.feature
    - test/shared/concerns/soft-dep.test.ts
    - test/shared/notify-reasons.test.ts
    - test/shared/notification-resolve.test.ts
    - test/orchestrators/plugin/list.messaging.test.ts
    - test/orchestrators/plugin/list-installed-row.test.ts
    - test/orchestrators/plugin/list-flow.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/install-flow-planning.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/import/execute.test.ts
    - test/architecture/soft-dep-marker-policy.test.ts
    - test/integration/mcp-home-path-partial.test.ts
    - test/integration/mcp-variable-expansion.test.ts
    - test/integration/mcp-override-lifecycle.test.ts
    - test/integration/mcp-migration.test.ts
    - test/integration/mcp-verdict-list.test.ts

key-decisions:
  - "The marker rule is one table, MCP_MARKER_RULE, keyed by the runEvery shape and the active implementation, with a flat shape helper (no nested conditionals)"
  - "A partially-installed list row carries only its MCP dependency, so agents and workflows markers stay off on it while the list policy turns markers on"
  - "The settings check compares the user settings text with the turn-off step's extensions plus the retry setting the harness turns off through Pi's RPC, which Pi saves to the same file"
  - "A When step waits for pi-mcp-adapter's listing after a restart, because no Given may follow the restart's When"

patterns-established:
  - "A no-implementation scenario is @own-implementation: Given the user's pi settings turn off pi's built-in mcp, then Given pi runs with the scripted model, then the command, then Then the user's pi settings still turn off pi's built-in mcp"

requirements-completed: [MREC-05, MREC-07]

coverage:
  - id: D1
    description: "mcpDependencyMarker follows D-MB-07 for every runEvery shape and active implementation, and false gives no marker"
    requirement: MREC-05
    verification:
      - kind: unit
        ref: "test/shared/concerns/soft-dep.test.ts#mcpDependencyMarker"
        status: pass
    human_judgment: false
  - id: D2
    description: "companionSeverity warns for MCP exactly when the marker shows"
    requirement: MREC-05
    verification:
      - kind: unit
        ref: "test/shared/notify-reasons.test.ts#D-MB-07"
        status: pass
    human_judgment: false
  - id: D3
    description: "Partially-installed list rows carry the MCP marker after the content reasons; a ws server gives {unsupported mcp} only"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/list-installed-row.test.ts#D-P3-07"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-markers.feature, features/mcp-server/verdict-list.feature (adapter and builtin profiles)"
        status: pass
    human_judgment: false
  - id: D4
    description: "With no MCP implementation, stdio, sse, and bare-elicitation plugins install with no --partial, name requires mcp / requires pi-mcp-adapter / requires builtin mcp, and leave the user's Pi settings unchanged"
    requirement: MREC-05
    verification:
      - kind: e2e
        ref: "features/mcp-server/companion-missing.feature (adapter profile, @own-implementation)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The catalog keeps 324 states and 54652 bytes"
    requirement: MREC-07
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 105min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 04: The D-MB-07 MCP marker rule Summary

**The MCP soft-dependency marker now names an implementation: `mcpDependencyMarker` reads the run's active implementation and the row's `McpDependency.runEvery` through one rule table and returns `requires mcp`, `requires pi-mcp-adapter`, `requires builtin mcp`, or nothing. Severity follows the same function. Partially-installed list rows carry the marker beside `{unsupported mcp}`. The no-implementation scenarios prove MREC-05 and show that the user's Pi settings stay unchanged.**

## Performance

- **Duration:** about 105 min
- **Started:** 2026-11-04 (plan base `590fb32`)
- **Tasks:** 3 of 3
- **Files modified:** 27 (1 created, 26 modified)

## Accomplishments

- `shared/concerns/soft-dep.ts`: `mcpDependencyMarker(declaresMcp, probe)` with `MCP_MARKER_RULE` (D-P3-06, D-MB-07). The 12 combinations of (both, adapter, builtin, split) x (none, adapter, builtin) and `false` are pinned. `softDepMarkers` appends its result in the mcp slot, so the order stays agents, mcp, workflows.
- `shared/notify-reasons.ts`: `companionSeverity`'s MCP term is `mcpDependencyMarker(...) !== undefined` (D-P3-09). No MCP code reads `piMcpAdapterLoaded` there any more. `companionRequirements` is unchanged (plan 03-08).
- `list-installed-row.ts` gives the partially-installed row its MCP dependency only, through `mcpOnlyDependencies`, and `LIST_CONTEXT` turns markers on for that status (D-P3-07). An sse record under built-in lists `{unsupported mcp, requires pi-mcp-adapter}`. A ws record lists `{unsupported mcp}` only.
- `verdict-markers.feature`: eight agreeing pairs became `@mcp` scenarios. The "Update preserves dependency move warnings and MCP notices" pair stays a pair, and its built-in twin no longer expects `requires pi-mcp-adapter`. A new bare-elicitation `@adapter-only`/`@builtin-only` pair and a new `@mcp` ws scenario were added. `verdict-list.feature`'s built-in and switch rows read `unsupported mcp, requires pi-mcp-adapter`.
- `companion-missing.feature` no longer has the feature-wide `@builtin-only` tag. It has four `@own-implementation` scenarios (stdio `requires mcp`, sse `requires pi-mcp-adapter`, bare elicitation `requires builtin mcp`, and the adapter restart that answers with no reinstall). The two info scenarios keep their bodies under `@builtin-only` for plan 03-08.
- `docs/messaging-style-guide.md` names the three markers and when each shows (D-P3-22).

## Task Commits

1. **Task 1: The D-MB-07 marker and severity rule** - `268430d` (feat)
2. **Task 2: Partially-installed list rows carry the marker; marker scenarios fold or pair** - `73b4b23` (feat)
3. **Task 3: No-implementation rows on the companion-missing model** - `e76002d` (test)

Before each commit I ran these by hand, and each exited 0: `check:static`, the touched pairs' `test:coverage:direct` at 100%, `test:modules`, `test:unpaired` (catalog 324 / 54652), and `test:integration` for Task 2. The hook's `npm run check:commit` passed on `268430d`.

## TDD RED evidence

The commit hook refuses a commit that holds only failing tests, so each task committed its tests and its implementation together (P1-DC-28).

- **Task 1 (unit)**, new tests on the unchanged product: `soft-dep.test.ts` failed at load with `does not provide an export named 'mcpDependencyMarker'`. That is a load failure, because the export did not exist yet. Its assertion RED comes from the two sibling suites below. `notify-reasons.test.ts` + `notification-resolve.test.ts`: 6 of 190 failed, with assertions on the planned behavior:
  - `D-MB-07: keeps info for servers both implementations run under Pi's built-in MCP` and `... a server only Pi's built-in MCP runs under it` failed with actual `warning`, expected `info`.
  - `... a server only Pi's built-in MCP runs under pi-mcp-adapter` and `... servers split between the implementations under pi-mcp-adapter` failed with actual `info`, expected `warning`.
  - `D-P3-10: finds the McpDependency ...` (actual `requires pi-mcp-adapter`, expected `requires builtin mcp`) and `D-P3-07 / D-MB-07: puts the MCP marker of a split dependency after the content reasons` also failed.
- **Task 2 (unit)**, new tests on the Task 1 product: 5 of 43 failed. They were the bare-elicitation and agents-plus-workflows partially-installed rows (no `dependencies` field), the list.messaging marker case, the `LIST_CONTEXT` policy, and the built-in sse row. The ws row passed first: it is a guard, because `recordMcpDependency` already returns `false` for a server both implementations block.

## Cucumber red proof (product files of the plan base restored, then restored back)

| Profile | Scenarios run | Failed on base | Guards (passed on base) |
|---|---|---|---|
| adapter, verdict-markers + verdict-list | 14 | the bare-elicitation `@adapter-only` twin (`unsupported mcp` without `requires builtin mcp`), and the verdict-list switch scenario (no `requires pi-mcp-adapter`) | the folded `@mcp` scenarios (the adapter rows never had a marker); the ws `@mcp` scenario (`{unsupported mcp}` only already) |
| builtin, verdict-markers + verdict-list | 13 | 11: every folded `@mcp` scenario (their rows carried `requires pi-mcp-adapter`), the remaining update pair's built-in twin, the verdict-list built-in sse row, and the bare-elicitation `@builtin-only` twin (it showed `requires pi-mcp-adapter`) | the ws scenario; the available-row scenario |
| adapter, companion-missing | 4 | the stdio scenario (`requires pi-mcp-adapter`, expected `requires mcp`) and the bare-elicitation scenario (`requires pi-mcp-adapter`, expected `requires builtin mcp`) | the sse scenario (the marker was already `requires pi-mcp-adapter`); the adapter-restart scenario (the base install also warned) |
| builtin, companion-missing | 2 (info) | none | both info scenarios (bodies unchanged except the setup severity) |

On the base, the bare-elicitation install with no `--partial` already passed, because plan 03-01 made the stored verdict neutral. It fails only on its marker.

## Final runs (after the last commit)

- `npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`: 402/402 scenarios, seed 913750.
- `npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin`: 1168/1168 scenarios, seed 150535.
- `npm run test:cucumber:profile -- --profile builtin features`: 48/48 scenarios, seed 500727. Before Task 3, this run failed the 4 old companion-missing scenarios, which Task 1's rule changed, and nothing else.
- `npm run test:modules`, `npm run test:unpaired`, `npm run test:integration`, and `npm run check:static` all exited 0. `npm run check:features` exited 0.
- Not run here (the post-merge wave gate owns it): `test:coverage:direct:all`. The touched pairs were run one by one.

## Unit and integration tests whose expectations the rule changed

Each change follows the rule table: a stdio dependency (`runEvery` both) under no implementation reads `requires mcp`, and the bare-elicitation install reads `requires builtin mcp`. No fixture's dependency was changed to keep an old expectation.

- `test/orchestrators/import/execute.test.ts` (1), `install-flow-ledger.test.ts` (4 rows, plus the PI-12 title and comment; this includes the bare-elicitation case that 03-02 pinned to the interim text), `install-flow-planning.test.ts` (1), `reinstall-flow.test.ts` (6, including one regex), `update-flow.test.ts` (5), `reconcile/apply.test.ts` (9).
- `test/shared/notification-resolve.test.ts` (the `[builtin]` case under no implementation now reads `requires builtin mcp`).
- Task 2: `list-flow.test.ts` (2: the built-in row carries its dependency and renders `{unsupported mcp, requires pi-mcp-adapter}`), `list-installed-row.test.ts` (1), `list.messaging.test.ts` (2), `test/architecture/soft-dep-marker-policy.test.ts` (1 policy cell and its header comment).
- Integration: `mcp-home-path-partial` (1: `{unsupported mcp, requires mcp}`), `mcp-variable-expansion` (3), `mcp-override-lifecycle` (4), `mcp-migration` (1), `mcp-verdict-list` (1: the built-in partially-installed row carries its dependency). I re-read `mcp-tool-rules` (57-61) and `mcp-migration` (541-556) from the plan's survey. They pin record and notice text, not the marker, and needed no change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test files beyond `files_modified`, forced by the rule's rendered bytes**
- **Found during:** Task 1 (`test:modules`) and Task 2 (`test:modules`, `test:unpaired`, `test:integration`)
- **Fix:** I changed the expectations listed above in `execute`, `install-flow-ledger`, `install-flow-planning`, `reinstall-flow`, `update-flow`, `reconcile/apply`, `list-flow`, the architecture `soft-dep-marker-policy` table, and `test/integration/mcp-verdict-list.test.ts`. The plan allows unit tests whose rendered expectation the rule changes. The architecture and `mcp-verdict-list` files are listed here because they fall outside its unit list.
- **Commits:** `268430d`, `73b4b23`

**2. [Rule 1 - Bug] The kept info scenarios' setup could no longer pass under built-in**
- **Found during:** Task 1 (builtin `features` run)
- **Issue:** Under built-in, a stdio install now gets no marker and reports info. The kept info bodies' setup `the user has run ..., which warned` therefore failed.
- **Fix:** That setup now uses `..., which did not fail`. The `When`/`Then` bodies are unchanged.
- **Commit:** `e76002d`

**3. [Rule 3 - Blocking] The settings text includes Pi's own retry setting**
- **Found during:** Task 3
- **Issue:** The plan says to compare with "exactly the content the turn-off step wrote". When the profile Pi starts, the world sends `set_auto_retry enabled: false` over RPC, and Pi saves `"retry": {"enabled": false}` to the same user settings file in its own format.
- **Fix:** The step compares the whole file with `{extensions: ["-builtin:mcp"], retry: {enabled: false}}` as Pi writes it, with no trailing newline. It also asserts that `readBuiltinTurnedOff` is true. Any write by the extension would still change the text.
- **Commit:** `e76002d`

**4. [Rule 3 - Blocking] A `When` listing wait after the restart**
- **Found during:** Task 3
- **Issue:** The restart scenario must wait for pi-mcp-adapter's startup listing before the prompt. Otherwise the prompt's connection races the listing connection. The only listing wait is a `Given` in the frozen `mcp-server/listing.steps.ts`, and no `Given` may follow the restart's `When`.
- **Fix:** `verdict-settings.steps.ts` adds `When pi-mcp-adapter finishes listing the tools of the stub mcp server {string} of the plugin {string}`, which calls the frozen `waitForStubListing`. The body is shaped differently from the frozen `Given`, because fallow reported the two six-line bodies as a clone group.
- **Commit:** `e76002d`

**5. [Rule 2 - Missing] Stale `Dependency` text in the style guide**
- **Found during:** Task 2
- **Fix:** Besides lines 9, 93, and 178, the style guide's `Dependency` declaration comment (28) and its bullet (39) now name the `McpDependency` and the three markers.
- **Commit:** `73b4b23`

**6. [Environment] Scratch path and commands**
- Temp files went to the scratch subfolder that the prompt names (`.../scratchpad/p3/exec-04/`), not the plan's `.../scratchpad/03-04/`. The worktree guard refused `env -u ...` before `pre-commit`, so pre-commit ran with `SKIP=npm-check,trufflehog` and no `env` wrapper. zizmor had no files to check.

**Total deviations:** 6 (3 blocking, 1 bug, 1 missing doc text, 1 environment). **Impact:** the planned behavior holds under both profiles. The listed test files outside `files_modified` changed only where the rule changed their rendered bytes.

## Issues Encountered

None beyond the deviations.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Plan 03-08 rewrites the two `@builtin-only` plugin info scenarios in `companion-missing.feature` on the no-implementation model, with the `requires:` line (`companionRequirements` is still the boolean, adapter-only rule). The e2e marker tests (`adapter-detection-rpc`, `install-soft-deps`) were not run here. Their rendered markers may change under the new rule, and they belong to 03-08.

## Parent line candidates

- `docs/output-catalog.md` line 69: the soft-dep marker prose lists `requires pi-mcp-adapter` as the MCP marker. It should name the three D-MB-07 markers (`requires mcp`, `requires pi-mcp-adapter`, `requires builtin mcp`) and say that the MCP one follows the active implementation and the row's `runEvery`.
- `docs/output-catalog.md` line 3041: the companion line prose says "MCP servers need `pi-mcp-adapter` ... the same names that the `{requires <name>}` markers on `install` and `list` use". The markers now name `mcp` / `builtin mcp` too, so the sentence needs the D-MB-07 wording once 03-08 changes the `requires:` line.
- `docs/output-catalog.md` line 3161: "Pi's built-in MCP client does not count as pi-mcp-adapter". This needs the D-MB-07 wording when the info line changes (03-08).
- The catalog counters stay at 324 states and 54652 bytes. No catalog fixture changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-09: no product path writes Pi settings, and the three no-implementation install scenarios assert the user's settings text afterwards. T-03-10: one table implements D-MB-07, and all twelve combinations plus `false` are pinned. A server neither implementation runs gets `{unsupported mcp}` only (unit and `@mcp` scenario). T-03-SC: no package was added; I used `npm ci` from the committed lockfile.

## Dubious Choices

- **The settings step compares a text that includes Pi's `retry` setting.** Severity: Medium. Alternatives: (a) compare only the `extensions` array; (b) snapshot the file after Pi starts, which needs world state or a frozen-file change. Why dubious: the plan asked for exactly the turn-off step's write. The compared text also pins Pi's serialization and the harness's auto-retry RPC, so a Pi format change would break the step. The plugin behavior would be unchanged.
- **A `When` that only waits for pi-mcp-adapter's listing.** Severity: Low. Alternatives: prompt with no wait (racy), or a parent line that adds a `When` form to the frozen listing module. Why dubious: a wait reads as an event rather than a user action, and the scenario has three `When` steps.
- **The kept info scenarios' setup changed from `which warned` to `which did not fail`.** Severity: Low. Alternative: leave them failing under built-in until 03-08. Why dubious: the plan said to keep their bodies. Only the `Given` severity changed.
- **The partially-installed row carries its MCP dependency even when an implementation runs every server.** Severity: Low. A degraded row (for example lsp) with a stdio server reads `{lsp, requires mcp}` under no implementation, and no marker under either implementation. Alternative: carry the dependency only when the row's MCP kind is unsupported. Why dubious: the plan's behavior text names the blocked-server case. The action text says to carry it "when it is not false", and that is what this follows.
- **The "split" name for an empty `runEvery`.** Severity: Low. Alternative: `none` or `neither`. Why dubious: naming only. The empty list means each implementation runs some server the other cannot.
- **Feature descriptions longer than three lines** (`verdict-markers.feature` 6, `companion-missing.feature` 8, `verdict-list.feature` 4). Severity: Low. Alternative: trim them to three lines. Why dubious: the features rule says two or three lines. The originals were already longer, and `check:features` does not enforce the count.

## Self-Check: PASSED

- FOUND: features/step_definitions/mcp-server/verdict-settings.steps.ts
- FOUND: 268430d, 73b4b23, e76002d (ancestors of HEAD)
- Acceptance greps: `export function mcpDependencyMarker` 1; `mcpDependencyMarker` in notify-reasons 3; `piMcpAdapterLoaded` in notify-reasons 0; `"partially-installed": { markers: true` 1; `requires builtin mcp` in verdict-markers 1, in the style guide 3; `unsupported mcp, requires pi-mcp-adapter` in verdict-list 2; `head -1 companion-missing.feature` = `Feature: MCP server companion missing`; `@own-implementation` 4; the settings step 3; `git diff --stat 590fb32..HEAD -- docs/output-catalog.md test/architecture/catalog-uat/catalog-contract.test.ts` empty; `check:features` exit 0.

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*

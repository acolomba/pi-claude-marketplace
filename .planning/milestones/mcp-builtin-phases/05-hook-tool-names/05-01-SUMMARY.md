---
phase: 05-hook-tool-names
plan: "01"
subsystem: hooks
tags: [hooks, mcp, builtin-mcp, matcher, if-field, cucumber]

requires:
  - phase: 01-foundation-and-pi-1-5-0
    provides: "Pi 1.5.0, the frozen implementation profiles (profileFor), the built-in stand-in, the MCP implementation steps, the inventory seeds"
provides:
  - "domain/components/hooks/builtin-mcp-tool-names.ts: McpToolIdentity, toolLiteralNames, serverPrefixNames, claudeFormToolName (Pi 1.5.0 createMcpToolName candidates)"
  - "bridges/hooks/mcp-tool-view.ts: HookTool, HookToolView (identify only), createHookToolView(pi)"
  - "compositeHandlerFor and toolResultCompositeHandler take a last parameter tools: HookToolView = createHookToolView(pi)"
  - "ifFires(predicate, event, ctx, _claudeEvent, tool?: McpToolIdentity)"
  - "features/hook/mcp-tool-names.feature with the shared @mcp scenario (D-P5-08)"
  - "features/lib/hook-mcp-calls.ts hookMcpCallScript and the profile-aware call step in hook/tool-use.steps.ts"
affects: [05-02, 05-03, 05-04]

actuals:
  tokens: 17300
  tasks: 2
  commits: 2
plan_head_before: 268aafb323ce60eaaf8c780e85c4e0912215ba96
plan_head_after: 72be65b2594a08306a1949ee1d3f59647e0f2725

tech-stack:
  added: []
  patterns:
    - "One per-event tool identity: the matcher and the if compare McpToolIdentity; the executor, labels, and adapters read a shallow copy of Pi's event with toolName replaced"
    - "Dispatch-time tool read: getAllTools() only for an mcp__ tool event with a non-empty bucket, once per event, never at factory time"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
    - test/domain/components/hooks/builtin-mcp-tool-names.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts
    - test/bridges/hooks/mcp-tool-view.test.ts
    - features/lib/hook-mcp-calls.ts
    - features/hook/mcp-tool-names.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - test/bridges/hooks/dispatch.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - test/bridges/hooks/if-field/index.test.ts
    - features/step_definitions/hook/tool-use.steps.ts

key-decisions:
  - "The hook event of a renamed tool is a shallow copy typed through a generic spread (no cast): only an mcp__ name changes, and Pi types those as its open-ended custom tool event"
  - "runAndFold takes the per-event view (event plus tool) instead of the bare event, so the identity reaches matchingHooks and ifFires without an eighth parameter"
  - "The scenario's call step takes its JSON arguments as a single-quoted Gherkin string"

patterns-established:
  - "Built-in tool identity: sourceInfo.path === builtin:mcp and namespace.aliases[0]; the Claude form strips `<namespace.name>__`, decided by startsWith, never by length"

requirements-completed: [MHK-01]

coverage:
  - id: D1
    description: "Pi 1.5.0 tool-name candidates, built-in literal and server-prefix matching, and the Claude-form name"
    requirement: MHK-01
    verification:
      - kind: unit
        ref: "test/domain/components/hooks/builtin-mcp-tool-names.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dispatch-time tool view that names a built-in MCP tool from pi.getAllTools() and keeps every other tool's name"
    requirement: MHK-01
    verification:
      - kind: unit
        ref: "test/bridges/hooks/mcp-tool-view.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/no-factory-time-probe.test.ts and test/index.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "PreToolUse, PostToolUse, PostToolUseFailure matchers, if fields, stdin, notices, block reason, ask dialog, and tool context use the per-event Claude-form name"
    requirement: MHK-01
    verification:
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts#built-in MCP tool names (MHK-01)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/if-field/index.test.ts#D-P5-04"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shared @mcp scenario: Claude-form literal, server prefix, if, and PostToolUse hooks record the Claude name under both profiles; the folded-server hook never runs"
    requirement: MHK-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature (seed 168374)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature features/hook/tool-use.feature (seed 390190)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-04
status: complete
---

# Phase 5 Plan 01: Hook MCP tool names Summary

**Plugin hooks now match and see a tool of Pi's built-in MCP under Claude Code's name (`mcp__plugin_hook-demo_stub-server__echo`, server segment with `-` kept), from one per-event identity read from `pi.getAllTools()` at dispatch time, across PreToolUse, PostToolUse, PostToolUseFailure, and `if` fields.**

## Performance

- **Duration:** about 75 min
- **Started:** 2026-11-04 (worktree base 268aafb)
- **Completed:** 2026-11-04
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- `builtin-mcp-tool-names.ts`: Pi 1.5.0 `createMcpToolName` candidates (folded and hashed, hash computed before the length branch), `toolLiteralNames`, `serverPrefixNames`, `claudeFormToolName`. fallow dupes reports no clone group with the frozen `domain/mcp-implementation.ts`.
- `mcp-tool-view.ts`: `createHookToolView(pi).identify(piName)` reads nothing for a non-`mcp__` name or no Pi API, reads `getAllTools()` once otherwise, counts a tool as built-in only for `sourceInfo.path === "builtin:mcp"` with a namespace alias, and falls back to Pi's name on a missing tool, another source, or a throwing read (debug-logged, OBS-01).
- `dispatch.ts`: both tool composite handlers build one view per event after the bucket and proxy checks; the matcher and `if` compare the identity; the executor, notice label, block reason, ask dialog, tool context, and adapters read a shallow copy, so an `updatedInput` rewrite still lands on Pi's input and Pi's event keeps Pi's name.
- `if-field/index.ts`: optional fifth parameter `tool`; the `mcp-literal` and `mcp-server-prefix` arms use the domain helpers.
- The shared `@mcp` scenario of D-P5-08 with five hooks (`literal`, `prefix`, `folded`, `iffed`, `after`) and the profile-aware call step.

## Task Commits

1. **Task 1: A Claude-form PreToolUse matcher fires on a built-in MCP tool, and the hook sees Claude's name** - `851126e` (feat)
2. **Task 2: Tool-result hooks and if fields see a built-in MCP tool under Claude's name** - `72be65b` (feat)

**Plan metadata:** the commit that adds this SUMMARY (docs).

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts` - Pi's name candidates and the built-in literal, prefix, and Claude-form rules
- `test/domain/components/hooks/builtin-mcp-tool-names.test.ts` - the vectors of the plan (folded, hashed, collision, long, 54-character namespace edge)
- `extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts` - the dispatch-time view
- `test/bridges/hooks/mcp-tool-view.test.ts` - strict strong-mock Pi cases
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` - identity threading for both tool handlers
- `test/bridges/hooks/dispatch.test.ts` - two new describe blocks (PreToolUse; tool results and `if`)
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` - the identity parameter
- `test/bridges/hooks/if-field/index.test.ts` - D-P5-04 rows and the missing-toolName row
- `features/lib/hook-mcp-calls.ts` - `hookMcpCallScript`
- `features/step_definitions/hook/tool-use.steps.ts` - the profile-aware call step (existing steps byte for byte)
- `features/hook/mcp-tool-names.feature` - the shared `@mcp` scenario

## Red proofs

RED runs of the unit files (before the implementation):

- `builtin-mcp-tool-names.test.ts`: the whole file failed with `ERR_MODULE_NOT_FOUND` (module absent).
- `mcp-tool-view.test.ts`: the whole file failed with `ERR_MODULE_NOT_FOUND` (module absent).
- `dispatch.test.ts`, Task 1 cases, run with HEAD's `dispatch.ts` put back: 6 of 126 failed: "runs the Claude-form literal, server prefix, and match-all hooks and not the folded-server ones (D-P5-04)", "gives the hooks Pi's event itself for a tool the view keeps under Pi's name (D-P5-05)", "lands a hook's input rewrite on Pi's own input (D-P5-03)", "names the tool in Claude's form in a block reason, a notice, and the model's context (D-P5-03)", "names the tool in Claude's form in the ask dialog (D-P5-03)", "asks the view once per tool event however many hooks match". ("never asks the view when the PreToolUse bucket is empty" passes on any tree.)
- `if-field/index.test.ts`, Task 2 cases: 8 of 33 failed, every `D-P5-04: ... fires on the built-in tool ...` row (Claude-form literal, folded-server literal, both echo-server tool forms, both Claude-form and both folded server-prefix forms).
- `dispatch.test.ts`, Task 2 cases, run with Task 1's `dispatch.ts` and `if-field/index.ts` put back: 5 of 134 failed: the PostToolUse and PostToolUseFailure "runs the Claude-form ... literal and server prefix and not the folded-server literal (D-P5-04)" and "names the tool in Claude's form in a ... notice, block feedback, and context (D-P5-03)" cases, and "runs the PreToolUse hooks whose if names mcp__echo_server__echo_text as Claude Code does: dashed (D-P5-04)".

Scenario before the change (Task 1 step 2, Task 1 product code absent):

- builtin, `Hooks on a plugin MCP tool match it and see it under Claude Code's name`: FAIL, seed 44339. First failing step `Then the hooks record these runs in any order:`; the hooks recorded `folded` under `mcp__plugin_hook_demo_stub_server__echo` and neither `literal` nor `prefix`.
- adapter, same scenario: PASS, seed 648842 (parity guard).

Task 2 step 1 (scenario extended, Task 1 code in place): builtin FAIL, seed 589414, first failing step `Then the hooks record these runs in any order:`; the `after` PostToolUse row (and with it the `tool response` value `[{"type":"text","text":"echo:ping"}]`) was missing. The `iffed` row already appeared, because Task 1 hands the `if` check the hook event, which carries the Claude-form name (see Dubious Choices P5-01-DC-01).

Red proof after each commit (Phase 1 product code from `640419724c48a60c7bb469acf0fde6f3a6ea7852` restored under `bridges/hooks` and `domain/components/hooks`, then `git restore --source=HEAD`, then an empty `git status --porcelain`):

| After | Profile | Scenario | Result | Seed | First failing step and diff |
|-------|---------|----------|--------|------|-----------------------------|
| `851126e` | builtin | Hooks on a plugin MCP tool match it and see it under Claude Code's name | FAIL | 716366 | `Then the hooks record these runs in any order:`; actual row `folded` with tool name `mcp__plugin_hook_demo_stub_server__echo`, expected rows `literal` and `prefix` with `mcp__plugin_hook-demo_stub-server__echo` |
| `851126e` | adapter | same | PASS | 902051 | - |
| `72be65b` | builtin | same | FAIL | 13042 | `Then the hooks record these runs in any order:`; actual row `folded` under Pi's name; expected `literal`, `prefix`, `iffed`, and the `after` PostToolUse row with `tool response` `[{"type":"text","text":"echo:ping"}]` all missing |
| `72be65b` | adapter | same | PASS | 478028 | - |

## Verification

- `node --test ... builtin-mcp-tool-names.test.ts mcp-tool-view.test.ts dispatch.test.ts if-field/index.test.ts`: pass.
- `npm run test:coverage:direct -- <the four sources>`: exit 0 (100% lines, functions, branches).
- `npm run check:static` on each commit's tree: typecheck, lint, lint:workflows, fallow (dead code, cycles, health, dupes, boundaries, rule pack), format:check, test:corresponding, check:features all passed.
- Cucumber after Task 2: builtin `features/hook/mcp-tool-names.feature` 1 scenario passed (seed 168374); adapter `features/hook/mcp-tool-names.feature features/hook/tool-use.feature` 22 scenarios passed (seed 390190). After Task 1: builtin 1 passed, adapter 22 passed.
- `test/bridges/hooks/**`, `test/domain/components/**`, `test/architecture/no-factory-time-probe.test.ts`, `test/index.test.ts` under the non-DAC shell: pass.
- Acceptance greps: all PASS (`createHookToolView` 3 in dispatch.ts, `"builtin:mcp"` 1 in mcp-tool-view.ts, one `@mcp`, no harness import of hooks modules, no diff to event-router.ts, platform, mcp-implementation.ts, mcp-stub-server.ts, hook-recorder.ts, features/support; `toolLiteralNames` 2 in if-field; `iffed` 2 and `echo:ping` 1 in the feature).

## Decisions Made

- The hook event of a renamed tool is `{ ...event, toolName: tool.name }` through a generic `toolEventView<T>`, with no cast; the doc comment says why that is sound.
- `runAndFold` takes the per-event view instead of the bare event, so the identity reaches `matchingHooks` and `ifFires`; `collectBucketOutcomes` passes no identity.
- `entryFires` reads the view: a tool identity means a tool matcher, otherwise the closed-set match value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 touched `toolResultCompositeHandler` by one line**
- **Found during:** Task 1
- **Issue:** `matcherFiresOnToolEvent` takes an identity now, so the tool_result call site no longer compiled.
- **Fix:** Task 1 passed `{ piName: event.toolName, builtinServer: undefined }` there (today's comparison); Task 2 replaced it with the per-event view.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`
- **Committed in:** `851126e`

**2. [Process] Dispatch unit cases written after the dispatch implementation**
- **Found during:** Tasks 1 and 2
- **Issue:** the plan orders each unit file test-first.
- **Fix:** the RED evidence was taken by putting the previous `dispatch.ts` (and, for Task 2, `if-field/index.ts`) back in the working tree, running the new cases, and restoring the new sources before any commit (see Red proofs).
- **Committed in:** `851126e`, `72be65b`

---

**Total deviations:** 2 (1 blocking fix, 1 process order). **Impact:** none on behavior; RED evidence exists for every unit file.

## Issues Encountered

- The worktree sandbox refused compound shell commands that name `git` or heredocs; the red-proof steps ran as separate commands.

## User Setup Required

None - no external service configuration required.

## Parent lines (for 05-04)

None. No frozen file needed a change.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **P5-01-DC-01 (Low).** Task 1 hands the `if` check the hook event (Claude-form `toolName`), so after Task 1 a Claude-form `if` literal already fires on a built-in tool, and Task 2's scenario RED showed only the missing `after` row, not `iffed` as the plan expected. Alternatives: hand `ifFires` Pi's event in Task 1 (the `if` would then compare Pi's name and see a different tool name than the hook's stdin). Dubious because the plan's Task 2 RED wording does not hold; the red proof against the Phase 1 tree shows both rows missing.
- **P5-01-DC-02 (Low).** The dispatch unit cases of both tasks were written after the implementation; RED came from putting the previous source back. Alternatives: strict test-first order. Dubious because the plan states the order; the evidence is equivalent.
- **P5-01-DC-03 (Low).** The call step takes its JSON arguments as a single-quoted Gherkin string (`'{"text": "ping"}'`), the first single-quoted `{string}` argument in the suite. Alternatives: a double-quoted string with escaped quotes, or a data table. Dubious because it sets a new feature-file convention; `check:features` and both profiles accept it.
- **P5-01-DC-04 (Low).** `createHookToolView`'s parameter type includes `getCommands`, which this plan never calls (05-02's proxy rule will). Alternatives: `Pick<ExtensionAPI, "getAllTools">` now, widened by 05-02. Dubious because the type promises more than the code uses; the plan's frozen interface fixes it.
- **P5-01-DC-05 (Low).** A built-in tool listed with no namespace at all keeps Pi's name through an explicit `namespace === undefined` check that exists for type narrowing; a unit row covers it so the branch is not defensive dead code. Alternatives: a non-null assertion. Dubious only as extra surface.

## Next Phase Readiness

- 05-02 can add `proxyRuleApplies()` to `HookToolView` and gate `isMcpProxyCall` in both handlers; the view is created per factory call through the defaulted parameter, and `event-router.ts` is unchanged.
- 05-03 can add its scenarios to `features/hook/mcp-tool-names.feature` and reuse the call step.

## Self-Check: PASSED

- All six created files exist; commits `851126e` and `72be65b` are ancestors of HEAD.

---
*Phase: 05-hook-tool-names*
*Completed: 2026-11-04*

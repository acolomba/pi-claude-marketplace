---
phase: 05-hook-tool-names
plan: "02"
subsystem: hooks
tags: [hooks, mcp, builtin-mcp, pi-mcp-adapter, proxy, cucumber]

requires:
  - phase: 05-hook-tool-names
    provides: "05-01: HookToolView.identify, createHookToolView(pi), the tools parameter of both tool composite handlers"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "openNotificationSnapshot / softDepStatus mcpImplementation (MSEL-01), the built-in stand-in and MCP implementation steps"
provides:
  - "HookToolView.proxyRuleApplies(): whether pi-mcp-adapter is the active MCP implementation, read once per view through openNotificationSnapshot(pi).softDeps (D-P5-06, D-P5-07)"
  - "Both tool handlers skip a proxy-shaped call only when proxyRuleApplies() holds; the check lives in toolEventView, after the bucket check and before identify"
  - "registerHooksBridgeWith creates one createHookToolView(pi) per bridge generation and passes it to the tool_call and tool_result factories"
  - "features/hook/tool-use.feature: the D-P5-11 @adapter-only / @builtin-only pair on hook-demo/stub-server and the D-P5-10 cut-name scenario"
affects: [05-03, 05-04]

actuals:
  tokens: 8047
  tasks: 2
  commits: 2
plan_head_before: a9b62be48a21f720b12aab108504d66bcce16c19
plan_head_after: 3a5201024c7cbec46adfed07441a237727a250e7

tech-stack:
  added: []
  patterns:
    - "A per-generation answer on the tool view: computed at the first proxy-shaped call and kept, so a new bridge generation (reload or new Pi) reads it again"
    - "The per-event tool view builder returns undefined for a call no hook may see, so the handlers keep one early return each"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts
    - test/bridges/hooks/mcp-tool-view.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - test/bridges/hooks/dispatch.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - test/bridges/hooks/event-router.test.ts
    - features/hook/tool-use.feature

key-decisions:
  - "The proxy check moved into toolEventView, which returns undefined for a skipped call; isProxiedToolCall is gone"
  - "proxyRuleApplies uses ??= on a closure variable: false with no Pi API, else openNotificationSnapshot(pi).softDeps.mcpImplementation === \"adapter\""
  - "The dispatch proxy rows run every call under a view whose rule applies and one whose rule does not, with one read log that pins the read order"

patterns-established:
  - "Proxy rule scope: the D-CF5-12 shape counts only while pi-mcp-adapter is the active MCP implementation (MHK-02)"

requirements-completed: [MHK-02]

coverage:
  - id: D1
    description: "proxyRuleApplies reads the run snapshot once and answers true only under pi-mcp-adapter; false under built-in, none, or no Pi API"
    requirement: MHK-02
    verification:
      - kind: unit
        ref: "test/bridges/hooks/mcp-tool-view.test.ts#applies / does not apply the proxy rule ... (D-P5-06), keeps the first answer ... (D-P5-07)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both tool handlers skip a proxy-shaped call only when the rule applies, read the rule only for a proxy-shaped call, and read no tool for a skipped call"
    requirement: MHK-02
    verification:
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts#mcp proxy calls (D-CF5-12, MHK-02)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "One view per bridge generation: the two tool handlers share one read, a new generation reads again, stale handlers and registration read nothing"
    requirement: MHK-02
    verification:
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#the tool handlers of one bridge load share one read of the proxy rule (D-P5-07)"
        status: pass
      - kind: unit
        ref: "test/architecture/no-factory-time-probe.test.ts, test/index.test.ts, test/bridges/hooks/settle.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Built-in cut-name call that looks like a proxy call runs its *, literal, and PostToolUse hooks; the D-P5-11 pair passes under its profiles"
    requirement: MHK-02
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/hook (seed 748759, 3 scenarios)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/hook (seed 69777, 84 scenarios)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-04
status: complete
---

# Phase 5 Plan 02: The MCP proxy rule under pi-mcp-adapter only Summary

**pi-mcp-adapter's proxy-call rule (D-CF5-12) now applies only while the adapter is the active MCP implementation, read once per bridge generation through the notification snapshot, so under Pi's built-in MCP a tool whose cut name looks like `mcp__<server>` and whose input holds a string `tool` runs its guard hooks; the Phase 1 `@adapter-only` hook scenario is now an `@adapter-only` / `@builtin-only` pair on `hook-demo`/`stub-server`.**

## Performance

- **Duration:** about 75 min
- **Started:** 2026-11-04 (worktree base a9b62be)
- **Completed:** 2026-11-04T15:45Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `mcp-tool-view.ts`: `proxyRuleApplies()` computes `openNotificationSnapshot(pi).softDeps.mcpImplementation === "adapter"` at its first call and keeps the answer; `false` with no Pi API. No `softDepStatus` import (D-JO-01). Creating the view and `identify` for a non-`mcp__` name still read nothing.
- `dispatch.ts`: `toolEventView` returns `undefined` when `isMcpProxyCall(event) && tools.proxyRuleApplies()`, in that order, so only a proxy-shaped call asks for the implementation and a skipped call reads no tool. Both handlers check the bucket first, then the view. `isProxiedToolCall` is removed. The module header and the `isMcpProxyCall` note state the MHK-02 scope.
- `event-router.ts`: `registerHooksBridgeWith` creates one `createHookToolView(pi)` and passes it as the last argument of the `tool_call` and `tool_result` factories.
- `features/hook/tool-use.feature`: the D-P5-10 scenario on `hook-proxy-shaped-tool-names-of-a-long-plugin` (Pi's name `mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d`, input `{"text":"ping","tool":"echo"}`), the adapter half renamed to `hook-demo`/`stub-server`, the built-in twin, and the new feature description.

## Task Commits

1. **Task 1: A built-in tool whose cut name looks like a proxy call runs its hooks, because the proxy rule applies only under pi-mcp-adapter** - `58a980a` (fix)
2. **Task 2: Both tool handlers of one bridge load share one proxy-rule read, and the MCP tool-use scenario becomes a pair** - `3a52010` (feat)

**Plan metadata:** the commit that adds this SUMMARY (docs).

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts` - `proxyRuleApplies` and its doc
- `test/bridges/hooks/mcp-tool-view.test.ts` - adapter, built-in, none, no-Pi, and kept-answer cases with a strict strong-mock (`getCommands()` once, `getAllTools()` three times)
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` - the gated proxy check in the per-event tool view
- `test/bridges/hooks/dispatch.test.ts` - the proxy rows reworked: 5 calls x 2 rules x 2 events, plus two empty-bucket cases; the 05-01 view stub gains `proxyRuleApplies: () => false`
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - one view per generation
- `test/bridges/hooks/event-router.test.ts` - three cases through the registered handlers with a counting Pi inventory
- `features/hook/tool-use.feature` - the pair and the cut-name scenario

## Red proofs

RED runs of the unit files (before each implementation):

- `mcp-tool-view.test.ts`: 5 of 16 failed, every new case, with `TypeError: tools.proxyRuleApplies is not a function` (the method did not exist; the target cases ran and failed on it).
- `dispatch.test.ts` against 05-01's `dispatch.ts`: 8 of 146 failed, exactly the proxy-shaped rows: the four "runs ... when the proxy rule does not apply (built-in MCP or none)" rows ran no hook, and the four "runs no ... when the proxy rule applies (pi-mcp-adapter)" rows never read the rule (`reads` was `[]`, expected `["proxyRuleApplies"]`). The non-proxy rows and the two empty-bucket cases pass on any tree.
- `event-router.test.ts` against the Task 1 router: 2 of 3 failed: "the tool handlers of one bridge load share one read of the proxy rule (D-P5-07)" and "a new bridge load reads the proxy rule again ..." both read `{ getAllTools: 6, getCommands: 2 }` where one read `{ 3, 1 }` was expected (each handler made its own view). "registering the bridge reads neither Pi's tools nor its commands (MSEL-01)" passes on any tree.

Scenario before the change (Task 1 step 1, product code at the base):

- builtin, `A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02)`: FAIL, seed 868373. First failing step `Then the hooks record these runs in any order:`; only `any` on `tool_search` ran. The `any` and `literal` PreToolUse rows and the `after` PostToolUse row on `mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d` were missing (the proxy rule skipped the call and its result), so the actual table had no `tool response` column.

Red proof after each commit (Phase 1 product code from `640419724c48a60c7bb469acf0fde6f3a6ea7852` restored under `bridges/hooks` and `domain/components/hooks`, then `git restore --source=HEAD`, then an empty `git status --porcelain`):

| After | Profile | Scenario | Result | Seed | First failing step and diff |
|-------|---------|----------|--------|------|-----------------------------|
| `58a980a` | builtin | A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02) | FAIL | 378695 | `Then the hooks record these runs in any order:`; actual: only `any` on `tool_search`; expected `any`, `literal`, and `after` on the cut name with input `{"text":"ping","tool":"echo"}` all missing |
| `3a52010` | builtin | A hook on a plugin MCP tool runs on every built-in call, the tool search included (MHK-01, MHK-02) | FAIL | 113230 | `Then the hooks record these runs in any order:`; actual: `any` on `tool_search` and `any` on Pi's `mcp__plugin_hook_demo_stub_server__echo`; expected `literal` and `after` rows and the Claude-form `mcp__plugin_hook-demo_stub-server__echo` missing |
| `3a52010` | builtin | A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02) | FAIL | 113230 | same as the row for `58a980a` |
| `3a52010` | adapter | A hook on a plugin MCP tool runs once per call through pi-mcp-adapter's proxy (D-CF5-12, MHK-02) | PASS | 351680 | - (parity guard: the kept proxy rule) |

## Verification

- `node --test ... mcp-tool-view.test.ts dispatch.test.ts event-router.test.ts`: pass; `test/bridges/hooks/**`, `test/domain/components/**`, `test/architecture/no-factory-time-probe.test.ts`, `test/index.test.ts`, `test/bridges/hooks/settle.test.ts`: pass.
- `npm run test:coverage:direct -- event-router.ts dispatch.ts mcp-tool-view.ts`: exit 0 (100% lines, functions, branches).
- `npm run check:static` on each commit's tree: typecheck, lint, lint:workflows, fallow (dead code, cycles, health, dupes, boundaries, rule pack), format:check, test:corresponding, check:features all passed.
- Cucumber after Task 1: builtin `features/hook/tool-use.feature` 1 passed (seed 235408); adapter 21 passed (seed 753653). After Task 2: builtin 2 passed (seed 944010); adapter 21 passed (seed 532686). Whole `features/hook`: builtin 3 passed (seed 748759), adapter 84 passed (seed 69777).
- Acceptance greps: `proxyRuleApplies` 3 in the view and 2 in dispatch; `openNotificationSnapshot` 2 and no `softDepStatus` import in the view; the long plugin 12 times in the feature; `@builtin-only` 2, `@adapter-only` 1; `lift its tag` 0; `mcp__plugin_demo_stub__echo` 0; the adapter listing wait 1. `createHookToolView` in `event-router.ts`: 2, not 1 (see Deviations).

## Decisions Made

- The proxy check lives in `toolEventView`, which returns `undefined` for a skipped call. Each handler keeps one bucket return and one view return, and no complexity grows (both factories stay well under 15 for ESLint and fallow).
- The answer is kept with `??=` on a closure variable of the view; with no Pi API it is `false` and nothing is read.
- The dispatch proxy rows use a recording `HookToolView` stub; the mapping from Pi's inventory to the answer is pinned once, in `mcp-tool-view.test.ts`, with seeded inventories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The 05-01 view stub in `dispatch.test.ts` gained `proxyRuleApplies`**
- **Found during:** Task 1
- **Issue:** `HookToolView` has a new member, so 05-01's `createBuiltinToolView` stub no longer type-checked.
- **Fix:** it returns `false`, the built-in answer.
- **Files modified:** `test/bridges/hooks/dispatch.test.ts`
- **Committed in:** `58a980a`

**2. [Rule 3 - Blocking] fallow health on the reworked proxy describe block**
- **Found during:** Task 1, `npm run check:static`
- **Issue:** the nested loops and ternaries of the first draft scored cognitive 16 in fallow.
- **Fix:** a `proxyRuleRows` helper builds the flat rows (title, expected runs, expected reads); the test count stayed 146.
- **Committed in:** `58a980a`

**3. [Acceptance criterion] `createHookToolView` appears twice in `event-router.ts`**
- **Found during:** Task 2
- **Issue:** the criterion asks for a count of 1, but the import line names the function too; the file creates one view per generation.
- **Fix:** none; the count is 2 (import plus one call), which meets the intent.

---

**Total deviations:** 3 (2 blocking fixes, 1 criterion count). **Impact:** none on behavior.

## Issues Encountered

- The worktree sandbox refused compound shell commands that name `git` or run a wrapper; checks ran as separate commands.
- The parent's note about Pi 1.5.0 `new_session` leaking a built-in connection does not apply: no scenario of this plan starts a new Pi session.

## User Setup Required

None - no external service configuration required.

## Parent lines (for 05-04)

- BACKLOG (T-05-07, P5-DC-15): when pi-mcp-adapter and Pi's built-in MCP are both loaded, a built-in tool whose name Pi cut inside the namespace, called with a string `tool` and no `action`, is still skipped as a proxy call. Hardening: skip only a call whose tool pi-mcp-adapter registered (a tool whose `sourceInfo` is not `builtin:mcp`).
- CHANGELOG (Phase 6, MDOC-02): "Hooks: pi-mcp-adapter's rule that a proxy `mcp` call runs no hook now applies only while pi-mcp-adapter is the active MCP implementation. Under Pi's built-in MCP every tool call runs its hooks."
- No frozen file needed a change.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **P5-02-DC-01 (Low).** The router cases count inventory reads with a hand-written counter added to `makeRecordingPi`'s Pi through `Object.assign`, not with a strict `strong-mock`. Alternatives: a strong-mock `ExtensionAPI` with every `on` registration stated, or `t.mock.method` spies. Dubious because the unit-test rules prefer a mock when the call count is the promise; registration makes about twenty `on` calls that a strict mock would have to list, and the counter asserts the exact totals.
- **P5-02-DC-02 (Low).** The dispatch proxy rows drive a recording `HookToolView` stub instead of Pi inventories from the seeds. Alternatives: an adapter, a built-in, and an empty inventory per row through the default view. Dubious because the rows then do not exercise the snapshot; `mcp-tool-view.test.ts` pins that mapping, and the router cases run the real view with an adapter inventory end to end.
- **P5-02-DC-03 (Low).** Three new cases pass on any tree (the two empty-bucket reads cases and "registering the bridge reads neither Pi's tools nor its commands"). They are guards for D-P5-07 and MSEL-01, not RED evidence. Alternatives: drop them (the factory-time ban covers registration). Kept because they pin the read order the plan's behavior names.
- **P5-02-DC-04 (Low).** The built-in twin and the cut-name scenario state the `any` row on Pi's own `tool_search` under Pi's name `tool_search`, as D-P5-11 and Pitfall 4 ask. Alternatives: no `*` hook in the twin. Dubious because naming `tool_search` as Claude Code's `ToolSearch` is a deferred idea; doing it later changes these rows.
- **P5-02-DC-05 (Low).** Acceptance criterion `grep -c 'createHookToolView' event-router.ts` prints 2 (the import and the one call), not 1. Alternatives: an aliased import or a namespace import to hit the count. Dubious only as a criterion mismatch; there is one view per generation.

## Next Phase Readiness

- 05-03 and 05-04 can rely on `proxyRuleApplies` and the shared per-generation view; `features/hook/tool-use.feature` has no MCP scenario left that waits on a tag.
- The wave-2 post-merge gate runs `npm run check` and both cucumber profiles on the tree that merges 05-02 and 05-03.

## Self-Check: PASSED

- All seven modified files exist; commits `58a980a` and `3a52010` are ancestors of HEAD.

---
*Phase: 05-hook-tool-names*
*Completed: 2026-11-04*

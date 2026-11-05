---
phase: 06-release-docs-and-combined-tree
plan: "02"
subsystem: orchestrators/plugin (update swap), agent grants
tags: [mcp-builtin, pi-subagents, agent-grants, update-swap, apply, cucumber]

requires:
  - phase: 03 (mcp-builtin)
    provides: the required `ThreePhaseArgsBase.mcpImplementation` field and its producers (update, reinstall, dependency move, autoupdate cascade, apply convergence)
  - phase: 04-agent-grants
    provides: grant forms per implementation (`mcpGrantForms`) and the MGRT-01 update scenario pair
provides:
  - "The update swap stages each agent's MCP grant in the form of the implementation its `mcpImplementation` argument names"
  - "An `@adapter-only` / `@builtin-only` apply catalog-move scenario pair in features/mcp-server/agent-grants.feature"
affects: [06-release-docs-and-combined-tree UF-1 plan (touches update-swap.ts next), docs on agent grants after apply/autoupdate]

actuals:
  tokens: 3400
  tasks: 2
  commits: 2

plan_head_before: 37f1cfdb09cf4cd77d4b1a8f6ff7de6358b8480f
plan_head_after: 75c1d48fc7b40e8394d782d71d53cc9f02f46497

tech-stack:
  added: []
  patterns:
    - "The swap reads the implementation from its arguments; no run snapshot fallback chain"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - features/mcp-server/agent-grants.feature

key-decisions:
  - "Agents staging of an update passes `active: args.mcpImplementation`; the private `updateAgentImplementation` and its fallback chain are deleted because the field is required (P4-DC-60, D-P6-10)"
  - "The adapter apply twin is a parity guard with no red proof: the pre-change code already staged pi-mcp-adapter's form for a convergence run"

patterns-established:
  - "An update path's grant form comes from the swap arguments, which every producer fills from its own run"

requirements-completed: [MGRT-01]

coverage:
  - id: D1
    description: "The update swap stages the grant form of the implementation its arguments name (direct builtin, cascade builtin without a notification, cascade builtin over an adapter notification, none -> adapter form)"
    requirement: MGRT-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-swap.test.ts#MGRT-01 / D-MB-03"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts (branches 176/176, functions 50/50, lines 1878/1878)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Under Pi's built-in MCP, an apply catalog move restages the agent with mcp:plugin_demo_stub/echo before any reload"
    requirement: MGRT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/agent-grants.feature#An apply that moves a plugin to its catalog version restages its agent with Pi's built-in mcp grant (MGRT-01) (builtin profile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Under pi-mcp-adapter, the same apply restages the agent with mcp:plugin_demo_stub_/echo"
    requirement: MGRT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/agent-grants.feature#An apply that moves a plugin to its catalog version restages its agent with pi-mcp-adapter's mcp grant (MGRT-01) (adapter profile)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-11-04
status: complete
---

# Phase 6 Plan 02: Agent grant after a catalog move Summary

**The update swap now stages each agent's MCP grant for the implementation in its required `mcpImplementation` argument. Under Pi's built-in MCP, `/claude:plugin apply` and the marketplace autoupdate cascade now write `mcp:plugin_<p>_<s>/<tool>` at once. Before, they wrote pi-mcp-adapter's form and kept it until the next session. An `@adapter-only`/`@builtin-only` apply scenario pair pins this.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-11-04T23:38:58Z
- **Completed:** 2026-11-04T23:56:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `update-swap.ts`: `mcpGrantForms.active` reads `args.mcpImplementation`. The private `updateAgentImplementation` (direct run, else the preflight notification's run, else `none`) is deleted. One call-site comment explains why (MGRT-01, D-MB-03).
- `update-swap.test.ts`: the MGRT-01 cases now name the implementation through `mcpImplementation`. There are four: direct `builtin`, cascade `builtin` with no notification (new, red before), cascade `builtin` over an adapter-run notification (the arguments win, red before), and `none`, which gives the adapter form and an index row `adapter`.
- `agent-grants.feature`: an apply catalog-move pair. The `@adapter-only` scenario expects `tools mcp:plugin_demo_stub_/echo`. The `@builtin-only` scenario expects `tools mcp:plugin_demo_stub/echo`.

## Task Commits

1. **Task 1: An apply catalog move under Pi's built-in MCP restages the agent with the built-in grant at once** - `670f742` (fix). This one commit holds the scenario, the unit cases, and the fix, because the commit hook refuses a staged test that fails. The RED runs are recorded below.
2. **Task 2: The same apply under pi-mcp-adapter keeps pi-mcp-adapter's grant, and the whole grants feature passes under both profiles** - `75c1d48` (test)

**Plan metadata:** the SUMMARY commit that follows these.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` - the agents staging reads the swap arguments' implementation. The fallback function is removed.
- `test/orchestrators/plugin/update-swap.test.ts` - the reworked and added MGRT-01 / D-MB-03 swap cases, and the `runWithAllLoaded` import.
- `features/mcp-server/agent-grants.feature` - the two apply catalog-move scenarios.

## Owned parent lines

| Parent line | Outcome | Commit |
|---|---|---|
| 04-05 SUMMARY line 2: repoint `updateAgentImplementation` at Phase 3's field (P4-DC-13) | Applied. The function is deleted and the staging reads `args.mcpImplementation` directly. The field is required, so no fallback is needed. | `670f742` |
| 04-06 SUMMARY item 2: repoint, and add a `@builtin-only` apply or autoupdate scenario that pins the built-in grant before a reload (P4-DC-13, P4-DC-46, P4-DC-60) | Applied with an apply catalog-move scenario, plus its `@adapter-only` twin | `670f742`, `75c1d48` |
| Parent note P4-DC-13: repoint the agent staging for autoupdate and apply convergence | Applied: both paths now stage the form of their own run. Autoupdate is pinned by the unit cascade case only (see P6-DC-0204) | `670f742` |

## Red proofs

1. **Scenario, builtin profile, on the pre-change product code** (only the new scenario added): `npm run test:cucumber:profile -- --profile builtin --name "An apply that moves a plugin to its catalog version" features/mcp-server/agent-grants.feature`. Exit 1, seed 786183, `1 scenario (1 failed)`, `16 steps (15 passed, 1 failed)`. The failing step was `Then the model receives these calls`. Actual: `tools mcp:plugin_demo_stub_/echo`. Expected: `tools mcp:plugin_demo_stub/echo`. Semantic assessment: the target scenario ran and failed on the planned grant row. The apply convergence run staged pi-mcp-adapter's form because the old code returned `none` for a cascade with no preflight notification.
2. **Unit, cascade `builtin` with no notification, on the pre-change product code:** `node --test --test-reporter=tap --test-name-pattern="a cascade swap whose arguments name Pi's built-in MCP" test/orchestrators/plugin/update-swap.test.ts`. Exit 1, `# tests 1`, `# fail 1`. Classifier `gsd-tools check tdd-red-evidence` gave `RED_EVIDENCE_OK` (`target_test_failed`). Actual `toolLines: ['tools: read,mcp:plugin_hello_server1_/query']`, expected `['tools: read,mcp:plugin_hello_server1/query']`. Semantic assessment: the target case ran and failed on the planned `deepStrictEqual` of the staged `tools:` line, not on setup or load.
3. **Unit, whole file, pre-change code:** `node --test --test-reporter=./scripts/test-reporter.mjs test/orchestrators/plugin/update-swap.test.ts`. Exit 1, `tests 331, pass 329, fail 2`. The two failures were the new cascade `builtin` case and the "arguments win over the run of the command it runs for" case. Both failed on the grant assertion (the old code read the adapter run of the notification).
4. **Adapter twin: no red proof, by design.** The pre-change code already staged pi-mcp-adapter's form for a convergence run, because the target was `none` and the adapter form looks the same. So the twin is a parity guard that passes on both trees. Measured: with `update-swap.ts` temporarily set back to `37f1cfd`'s content, the adapter profile run of the twin passed (seed 876236, `1 scenario (1 passed)`, `15 steps (15 passed)`). The file was then restored with `git checkout --`.

## Checks

| Command | Exit | Duration | Tree | Result |
|---|---|---|---|---|
| builtin scenario `--name "An apply that moves..."` (RED) | 1 | 59.4 s | pre-fix + scenario | seed 786183, 1 scenario (1 failed) |
| `node --test ... update-swap.test.ts` (RED) | 1 | 39.2 s | pre-fix + tests | 331 tests, 2 fail |
| TAP target-case run (RED) + classifier | 1 / 0 | <10 s | pre-fix + tests | RED_EVIDENCE_OK |
| `node --test ... update-swap.test.ts` (GREEN) | 0 | ~40 s | 670f742 content | all pass |
| `npm run test:coverage:direct -- .../update-swap.ts` | 0 | ~60 s | 670f742 content | branches 176/176, functions 50/50, lines 1878/1878 |
| neighbour tests: update-flow, reconcile/apply, dependency-move, reinstall-flow (one at a time) | 0 each | — | 670f742 content | all pass |
| builtin scenario `--name "An apply that moves..."` (GREEN) | 0 | 16.0 s | 670f742 content | seed 762320, 1 scenario (1 passed), 16 steps |
| `npm run lint` (warm) | 0 | — | 670f742 content | clean |
| `npm run check:static` | 0 | 64 s | 670f742 content | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all passed |
| adapter profile, whole `agent-grants.feature` | 0 | 1m 8.8s | 75c1d48 content | seed 959773, 13 scenarios (13 passed), 184 steps |
| builtin profile, whole `agent-grants.feature` | 0 | 42.0 s | 75c1d48 content | seed 375774, 6 scenarios (6 passed), 89 steps |
| adapter twin on pre-fix `update-swap.ts` | 0 | — | 37f1cfd update-swap + 75c1d48 feature | seed 876236, 1 scenario (1 passed) |
| `npm run check:features` | 0 | — | 75c1d48 content | clean |

The commit hook printed "(no files to check)" for `npm run check:commit` in this worktree, so the checks above were run by hand. `npm run check` and the whole cucumber profiles are the parent's wave gate.

## Decisions Made

- The function is deleted rather than reduced to `return args.mcpImplementation;`, as the plan's action says. The call site carries the rationale in one comment.
- The "arguments win" unit case uses the existing `runWithAllLoaded()` seed as the pi-mcp-adapter run.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. No TUI readiness flake was seen.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The UF-1 containment plan (D-P6-23) can now touch `update-swap.ts` and `update-swap.test.ts` on top of this change.
- The parent's wave gate runs `npm run check` and both cucumber profiles on the merged wave.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-06-03 (mitigate) is done. The swap stages the form its arguments name, and the `@builtin-only` apply scenario and the cascade unit case both fail on the old code.

## Window records

None.

## Dubious Choices

### P6-DC-0201: "Arguments win" case uses `runWithAllLoaded()` as the adapter run

- **Chose:** the notification in the "a cascade swap stages the implementation its arguments name over the run of the command it runs for" case uses the existing seed `runWithAllLoaded()` (`mcpImplementation: "adapter"`, every companion loaded).
- **Alternatives:** add an `adapterRun()` helper next to `builtinRun()` that loads only pi-subagents and pi-mcp-adapter.
- **Why:** the seed already exists, and only its `mcpImplementation` matters to the swap's grant form. A new helper would be one more fixture with the same effect.
- **Severity:** Low

### P6-DC-0202: No fallback chain; the function is deleted

- **Chose:** `active: args.mcpImplementation` with no fallback, and `updateAgentImplementation` deleted.
- **Alternatives:** the 04-06 parent line's order: the field, then the direct run, then `preflightNotification.run`, then `none`.
- **Why:** `ThreePhaseArgsBase.mcpImplementation` is required, and a type assertion in the test file pins that, so the fallbacks could never run. Fallow and direct coverage would also report them as unreachable. The plan and 06-RESEARCH §5.1 call for this.
- **Severity:** Low

### P6-DC-0203: The adapter twin's "passes on the old tree" evidence came from swapping one file

- **Chose:** to show that the twin passes before the fix, I set only `update-swap.ts` back to `37f1cfd`'s content, ran the twin under the adapter profile, then restored the file with `git checkout --`.
- **Alternatives:** check out the whole base tree in a scratch worktree; or record the reason only, which is all the plan asks for.
- **Why:** the fix touches only that one production file, so swapping it back recreates the pre-fix product code. This also avoids making a second worktree.
- **Severity:** Low

### P6-DC-0204: Autoupdate has unit coverage only, no scenario

- **Chose:** the scenario covers `apply` catalog convergence only, as the plan names it. The marketplace autoupdate cascade path is covered by the unit case "a cascade swap whose arguments name Pi's built-in MCP" with no notification.
- **Alternatives:** also add an `@builtin-only` autoupdate scenario (`marketplace update` with autoupdate on, then `subagent get`).
- **Why:** the parent line asks for "an autoupdate or apply-convergence" scenario, and the plan picks apply. Both paths go through the same `swapPluginUpdate` agents staging, which now reads the one argument. An autoupdate run that has a notification but no `preflightNotification` also changes behavior, and no scenario observes that.
- **Severity:** Low

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts (`active: args.mcpImplementation` at line 498)
- FOUND: features/mcp-server/agent-grants.feature (`claude:plugin apply --scope user` 2 times. `@adapter-only` is on the line above the pi-mcp-adapter apply scenario)
- FOUND: 670f742, 75c1d48 (both ancestors of HEAD; `git rev-list --count 37f1cfd..HEAD` = 2 before this SUMMARY commit)

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-04*

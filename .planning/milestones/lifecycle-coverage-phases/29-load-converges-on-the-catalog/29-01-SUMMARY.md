---
phase: 29-load-converges-on-the-catalog
plan: 01
subsystem: edge
tags: [apply, reconcile, router, completions, json-output, cucumber]

requires: []
provides:
  - "/claude:plugin apply [--scope user|project] (commandId `plugin apply`) running the existing reconcile apply step"
  - "EdgeDeps.applyReconcile, filled from the one createApplyReconcile binding in index.ts"
  - "SubcommandHandlers.pluginApply and makeApplyHandler / ApplyHandlerDeps"
  - "withScopeOnlyArgs prelude shared by pending and apply"
  - "reconcile-applied-cascade counts as a command outcome"
  - "features/plugin/apply.feature with its first scenario"
affects: [29-02, 29-05, apply, pending, reconcile, json-output]

actuals:
  tokens: 19600
  tasks: 2
  commits: 2
plan_head_before: d5a8a771f8a7fc0336bf9b14d794110235b28c47
plan_head_after: edac16b0d8d3d23e66e9f45bdff5bc95904aa629

tech-stack:
  added: []
  patterns:
    - "Top-level verbs whose route depends on the spelling alone live in TOP_LEVEL_VERB_ROUTES (a Map) in edge/router.ts"
    - "A verb that takes only --scope opens with withScopeOnlyArgs(usage, operation)"

key-files:
  created:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/apply.ts
    - test/edge/handlers/plugin/apply.test.ts
    - features/plugin/apply.feature
  modified:
    - extensions/pi-claude-marketplace/edge/types.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/flag-catalog.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - docs/json-output.md
    - features/plugin/help.feature
    - features/plugin/usage-errors.feature

key-decisions:
  - "The SubcommandHandlers member is `pluginApply`, not `apply`: strong-mock reserves apply/call/bind on every mock, so a SubcommandHandlers mock cannot state an `apply` member"
  - "pending and apply share a withScopeOnlyArgs prelude in edge/handlers/plugin/shared.ts, which removes the clone group fallow dupes reported between the two handlers"
  - "selectClaudePluginRoute routes the spelling-only verbs through a TOP_LEVEL_VERB_ROUTES Map; the added case had pushed its cyclomatic complexity to 21 (limit 20)"
  - "apply is not an LLM tool: edge/handlers/tools.ts registers only the two read-only queries, and apply changes state (D-16)"

patterns-established:
  - "withScopeOnlyArgs: parse, reject an unknown flag, reject any positional, then run the operation with the scope"

requirements-completed: [APL-01, APL-04]

coverage:
  - id: D1
    description: "/claude:plugin apply --scope project installs a hand-declared plugin and reports one reconcile-applied-cascade with an (installed) row"
    requirement: APL-01
    verification:
      - kind: e2e
        ref: "features/plugin/apply.feature#Apply installs a plugin that a config declares by hand and reports it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The apply handler hands applyReconcile the exact options bag, adds scope for --scope, and rejects surplus tokens, unknown flags, --local and bad scope values with the apply usage"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/edge/handlers/plugin/apply.test.ts"
        status: pass
      - kind: unit
        ref: "test/edge/handlers/plugin/shared.test.ts#withScopeOnlyArgs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Help, completions, the router, the flag catalog and the usage errors name apply beside pending"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/edge/router.test.ts"
        status: pass
      - kind: unit
        ref: "test/edge/completions/provider.test.ts#TC-3 offers only the scope flag for apply (APL-04)"
        status: pass
      - kind: unit
        ref: "test/architecture/flag-catalog-drift.test.ts"
        status: pass
      - kind: e2e
        ref: "features/plugin/help.feature"
        status: pass
      - kind: e2e
        ref: "features/plugin/usage-errors.feature"
        status: pass
    human_judgment: false
  - id: D4
    description: "reconcile-applied-cascade is a command outcome in JSON/RPC mode, and docs/json-output.md lists it among the thirteen outcome kinds"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/shared/notification-dispatch.test.ts#classifies reconcile-applied-cascade as command outcome true"
        status: pass
      - kind: unit
        ref: "test/architecture/json-output-docs.test.ts"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 01: Apply Command Summary

**`/claude:plugin apply [--scope user|project]` runs the existing reconcile apply step from the slash command. A hand-declared plugin installs and reports as one `reconcile-applied-cascade`, and that kind now counts as a command outcome in JSON and RPC mode.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-24T13:45:06Z
- **Completed:** 2026-10-24T14:13:26Z
- **Tasks:** 2
- **Files modified:** 27 (3 created, 24 modified)

## Accomplishments

- The new `apply` verb: handler `edge/handlers/plugin/apply.ts`, router entry (`plugin apply`), register wiring, flag-catalog entry (`apply: []`), completions (`apply --` offers only `--scope`), and help text with `apply` after `pending`.
- `EdgeDeps.applyReconcile` is required. `index.ts` passes in the same `createApplyReconcile({ loadState })` binding that the load uses, so only one instance exists.
- `isStructuredOutcome` now returns `true` for `reconcile-applied-cascade`, so `edge/command-run.ts` no longer raises `Command returned without an outcome.` for an apply report. A load-origin payload never reaches that check.
- `features/plugin/apply.feature` has its first scenario. `help.feature`, `usage-errors.feature` (six apply rows) and `docs/json-output.md` (thirteen outcome kinds) name `apply`.
- `edge/handlers/tools.ts` is unchanged. Its two tools are read-only queries, and `apply` changes state (D-16, T-29-03).

## Task Commits

1. **Task 1: End-to-end `/claude:plugin apply` installs one hand-declared plugin** - `0097b81e` (feat). Tracer gate: every `<verify>` step was re-run green before the commit, so expansion went ahead.
2. **Task 2: Help, usage errors and the JSON reference name `apply`** - `edac16b0` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/apply.ts`: `makeApplyHandler`, `ApplyHandlerDeps`, and the usage `Usage: /claude:plugin apply [--scope user|project]`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts`: `withScopeOnlyArgs` prelude
- `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts`: now uses `withScopeOnlyArgs`, with no change in behavior
- `extensions/pi-claude-marketplace/edge/router.ts`: `pluginApply` member, `apply` in `TOP_LEVEL_SUBCOMMANDS` and `TOP_LEVEL_USAGE`, and the `TOP_LEVEL_VERB_ROUTES` table
- `extensions/pi-claude-marketplace/edge/register.ts`, `edge/types.ts`, `edge/flag-catalog.ts`, `index.ts`, `shared/notification-dispatch.ts`: the wiring above
- Tests: `test/edge/handlers/plugin/apply.test.ts` (new), plus `router`, `register`, `types`, `flag-catalog`, `completions/provider`, `handlers/plugin/shared`, `handlers/plugin/pending` (comment only), `shared/notification-dispatch`, `architecture/flag-catalog-drift`, `architecture/json-output-docs`, `integration/reserved-record-keys`, `integration/standalone-prune`, `e2e/import-command`
- `features/plugin/apply.feature` (new), `features/plugin/help.feature`, `features/plugin/usage-errors.feature`, `docs/json-output.md`

## Decisions Made

- The handler member is named `pluginApply`, which follows the `pluginInfo` precedent. strong-mock (the project's required mocking library) treats `apply`, `call` and `bind` on a mock as `Function.prototype` invocations. So `when(() => handlers.apply(...))` reads the context argument as an argument array, and every `mock<SubcommandHandlers>` case that routes `apply` fails. The verb, the commandId and the user-visible surface are still `apply`.
- In the integration and e2e EdgeDeps literals, `reserved-record-keys` uses the real `createApplyReconcile({ loadState })` because it already composes real operations. `standalone-prune` and `import-command` get a stub that throws when called.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Handler member named `pluginApply` instead of `apply`**
- **Found during:** Task 1
- **Issue:** strong-mock reserves `apply`, `call` and `bind` on every mock, so the router tests could not mock `SubcommandHandlers.apply`.
- **Fix:** Named the member `pluginApply`, with a comment in `router.ts` that gives the reason.
- **Impact:** The acceptance grep `apply: makeApplyHandler` in `register.ts` prints `0`. The wiring line is `pluginApply: makeApplyHandler(deps, hooksRouting)`, and `pluginApply: makeApplyHandler` prints `1`.
- **Committed in:** `0097b81e`

**2. [Rule 3 - Blocking] `selectClaudePluginRoute` exceeded fallow's cyclomatic limit**
- **Found during:** Task 1 (`npm run fallow`)
- **Issue:** The added `case "apply"` raised cyclomatic complexity to 21 (limit 20).
- **Fix:** The spelling-only verbs now route through the `TOP_LEVEL_VERB_ROUTES` Map. Only `marketplace`, `help` and the default case remain in the switch. Every route, commandId and handler is the same as before, and the router owner test passes unchanged except for the new row.
- **Files modified:** `extensions/pi-claude-marketplace/edge/router.ts`
- **Committed in:** `0097b81e`

**3. [Rule 3 - Blocking] fallow dupes reported a clone group between `apply.ts` and `pending.ts`**
- **Found during:** Task 1 (`npm run fallow`)
- **Fix:** Extracted the shared prelude into `withScopeOnlyArgs` in `edge/handlers/plugin/shared.ts` and moved `pending.ts` onto it. Its owner, `test/edge/handlers/plugin/shared.test.ts`, gained a `describe("withScopeOnlyArgs")` block, and direct coverage of `shared.ts` stays at 100%. `pending.ts`, `shared.ts` and their tests were not in `files_modified`.
- **Files modified:** `edge/handlers/plugin/shared.ts`, `edge/handlers/plugin/pending.ts`, `test/edge/handlers/plugin/shared.test.ts`, `test/edge/handlers/plugin/pending.test.ts` (header comment)
- **Committed in:** `0097b81e`

---

**Total deviations:** 3 auto-fixed (3 blocking).
**Impact on plan:** All three were needed to keep `npm run check` green. The user-visible surface is the one the plan specifies.

## Issues Encountered

None beyond the deviations above.

## Verification

- Task 1 `<verify>`: the eight owner tests passed. Direct coverage passed for `apply.ts`, `router.ts`, `notification-dispatch.ts`, `register.ts`, `flag-catalog.ts`, `shared.ts` and `pending.ts`. `npm run typecheck` passed. `npx cucumber-js features/plugin/apply.feature` reported 1 scenario passed. `npm run lint` exited 0 and `npm run fallow` exited 0.
- Task 2 `<verify>`: `test/architecture/json-output-docs.test.ts` passed (115). The `help`, `usage-errors` and `apply` features passed (122 scenarios). `npm run check:features` exited 0.
- The commit hook's `npm run check:commit` passed on both commits.
- Full gate: `npm run check` at `edac16b0` (Node v26.12.1) exited **0**. Log tail:

```
passed test:corresponding (3.8 s)
passed check:features (3.2 s)
Installed optional test peers pi-mcp-adapter@5.2.0 pi-subagents@0.74.0 (published by 2026-10-09T19:25:07.280Z) into node_modules/.cache/optional-peers.
16 hooks (16 passed)
773 scenarios (773 passed)
7365 steps (7365 passed)
Merged LCOV: coverage/direct.lcov (282 records)
```

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Ready for 29-02 (read-only load). The load still applies on its own, so this plan removes no behavior.
- `needs reload` is `false` in the apply scenario until 29-05 lets the reconcile report carry the reload trailer.
- `apply` with nothing to do currently emits no outcome. In JSON mode it would get `Command returned without an outcome.` until the empty advisory (D-08) lands.
- Later plans that mock `SubcommandHandlers` must use `pluginApply`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*

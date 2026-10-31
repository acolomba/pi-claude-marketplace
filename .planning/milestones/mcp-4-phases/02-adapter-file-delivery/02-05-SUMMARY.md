---
phase: 02-adapter-file-delivery
plan: 05
subsystem: notifications
tags: [notifications, jsonc-comments, update, reinstall]

requires:
  - phase: 02-adapter-file-delivery
    provides: McpConfigNotice, notifyMcpConfigNotices and StageMcpCommitResult.notices (plan 02-04); the unreadable-file noop (plan 02-01); the byte-restoring MCP replacement handle (plan 02-03)
provides:
  - PluginUpdateUpdatedOutcome.mcpConfigNotices? and PluginUpdateFailedOutcome.mcpConfigNotices? (orchestrators/types.ts)
  - ReinstallReinstalledOutcome.mcpConfigNotices? (render "none" arm)
  - ReinstallReplacement.mcpConfigNotices (reinstall-replace.ts)
  - commitUpdatePhase3a's module-private mcpConfigNotices result member (update-swap.ts)
  - the notice-surfacing helpers surfaceUpdateMcpConfigNotices (update-flow.ts) and surfaceReinstallMcpConfigNotices (reinstall-flow.ts)
affects: [02-08 reconcile/import and marketplace update cascade routing]

actuals:
  tokens: 6900
  tasks: 3
  commits: 1
plan_head_before: 43fc23b055c8f535b5387cf86cf6c22fa8588d6c
plan_head_after: f401f7e42142b5a34d1261b09d155bb415da713f

tech-stack:
  added: []
  patterns:
    - "A verb that renders rows after its runner finishes carries mcpConfigNotices on the outcome and calls notifyMcpConfigNotices once after its rows"
    - "Notices are taken off the prepared MCP handle only after the commit that writes the file returns"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/plugin/update-swap.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/reinstall-replace.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts

key-decisions:
  - "Update takes the MCP notices only after commitPreparedMcp returns; a thrown MCP commit carries none, while a later bridge or finalize failure still carries them, because the file is already rewritten"
  - "The direct update path shows the notices after the cascade on success and after the failure row plus the accumulated cascade on a phase-3a abort; unlike the discovery warnings, the abort path shows them too"
  - "The cascade update entry returns the notices on its outcome and sends nothing; the marketplace update cascade routing reads them in plan 02-08"
  - "Reinstall's render \"none\" arm spreads each carrier (notes, discoveryWarnings, mcpConfigNotices) only when non-empty, so a notice is never lost to the old no-notes early return"
  - "The self-rendering reinstall arm shows its own notices right after its row"
  - "AFILE-04 stays Pending in REQUIREMENTS.md: plans 02-06 to 02-08 route the remaining verbs"

patterns-established:
  - "commitPreparedMcp -> handles.mcp.result.notices -> outcome.mcpConfigNotices -> notifyMcpConfigNotices after the rows"

requirements-completed: []

coverage:
  - id: D1
    description: "A direct update over a commented mcp-adapter.json shows its update cascade, then the exact comments-removed notice at warning severity"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/update-flow.test.ts#AFILE-04: update over a commented mcp-adapter.json shows the comments-removed notice after the cascade"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-swap.test.ts#AFILE-04: a swap over a commented mcp-adapter.json carries the comments-removed notice"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-swap.test.ts#AFILE-04: a swap over a comment-free mcp-adapter.json carries no notice"
        status: pass
    human_judgment: false
  - id: D2
    description: "An update whose workflows commit fails after the MCP commit carries the notice on the failed outcome, and the direct path shows it after the failure row"
    requirement: AFILE-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-swap.test.ts#AFILE-04: a swap whose workflows commit fails after the MCP commit carries the notice"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/update-flow.test.ts#AFILE-04: an update that fails after its MCP commit still reports the removed comments"
        status: pass
    human_judgment: false
  - id: D3
    description: "The cascade update entry returns the notice on its outcome and sends nothing"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/update-flow.test.ts#AFILE-04: the cascade update entry returns the notice without notifying"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reinstall shows its rows then the notice; a rolled-back reinstall restores the exact bytes and shows no notice; the orchestrated outcome carries the notice without notes; the self-rendered arm shows it after its row"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#AFILE-04"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-replace.test.ts#AFILE-04"
        status: pass
    human_judgment: false
  - id: D5
    description: "Updating or reinstalling a plugin with no MCP servers over an unparseable mcp-adapter.json succeeds, keeps its bytes and shows the exact left-unchanged notice"
    requirement: AFILE-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/update-flow.test.ts#AFILE-02: updating a plugin with no MCP servers over an unparseable mcp-adapter.json leaves it unchanged and says so"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#AFILE-02: reinstalling a plugin with no MCP servers over an unparseable mcp-adapter.json leaves it unchanged and says so"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-03
status: complete
---

# Phase 2 Plan 05: MCP config notices for update and reinstall Summary

**`update` and `reinstall` now report every MCP config rewrite that dropped the user's JSONC comments: the notice rides the update and reinstall outcomes, the direct update path shows it after its cascade (and after the failure row when a later bridge or the finalize fails), reinstall shows it after its rows, and a rolled-back reinstall restores the exact bytes and shows nothing.**

## Performance

- **Duration:** about 17 min of editing and focused checks, plus about 25 min waiting on the full-scope pre-commit run
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3
- **Files changed:** 10 (all modified)

## Accomplishments

- `orchestrators/types.ts`: `mcpConfigNotices?` on `PluginUpdateUpdatedOutcome`, `PluginUpdateFailedOutcome` (inherited by `UpdatePhase3FailedOutcome` through its `Omit`) and `ReinstallReinstalledOutcome`. Each is omitted when empty (NREG-01).
- `update-swap.ts`: `commitUpdatePhase3a` takes `handles.mcp.result.notices` only after `commitPreparedMcp` returns and returns them as `mcpConfigNotices` (empty when the commit threw). `swapPluginUpdate` spreads them onto the `updated` outcome, and `composePhase3FailureOutcome` spreads them onto the phase-3 failed outcome on both the bridge-failure and the synthetic finalize-failure paths. The swap only carries; it sends nothing.
- `update-flow.ts`: `surfaceUpdateMcpConfigNotices` folds the notices of every accumulated `updated` outcome, in order, plus the failing outcome's own on a phase-3a abort, into one `notifyMcpConfigNotices` call. The success path calls it after `surfaceUpdateDiscoveryWarnings`; the abort path calls it after `renderUpdateCascadeIfAny`. `updateSinglePluginWith` (the cascade entry) returns the swap's outcome unchanged.
- `reinstall-replace.ts`: `ReinstallReplacement.mcpConfigNotices` is set from the MCP handle on the success return. A failed replace rolls back and throws, so it returns nothing.
- `reinstall-flow.ts`: `LockedSuccess.mcpConfigNotices` (empty on the two skipped arms). The `render: "none"` arm now spreads `notes`, `discoveryWarnings` and `mcpConfigNotices` each only when non-empty, which replaces the no-notes early return. `reinstallPlugins` calls `surfaceReinstallMcpConfigNotices` after the cascade and the discovery diagnostics. The self-rendering arm shows its own notices after its row.

## Notification order (exact, from the tests)

- Direct update, commented file: the update cascade row (`● hello v1.0.0 → v1.0.1 (updated) {requires pi-mcp-adapter}`, warning), then `MCP config comments removed.` (warning).
- Direct update, workflows commit refused after the MCP commit: the `⊘ hello (failed) {rollback partial}` row with its `[workflows] (rollback failed)` child (error), then the notice.
- Reinstall, commented file: `● hello v1.0.0 (reinstalled) {requires pi-mcp-adapter}`, then the notice.
- Reinstall whose save fails: only `⊘ hello (failed) {unreadable}`; `mcp-adapter.json` holds its exact commented bytes again.
- Update or reinstall of a plugin with no MCP servers over `{ not json`: the success row, then `MCP config left unchanged.` (warning); the file keeps its bytes.

## Task Commits

All three tasks land in ONE code commit, as the plan requires:

1. **Tasks 1-3: report dropped comments on update and reinstall** - `f401f7e4` (feat)

## Verification evidence

- Owner suites (`tmp/p2-05-verify.log`, `SUITES_EXIT=0`): update-swap, update-flow, reinstall-replace and reinstall-flow, 539 pass, 0 fail.
- Pattern runs: `^AFILE-0[24]` update-flow pass 4, reinstall-flow pass 5; update-swap `AFILE-04` pass 3; reinstall-replace pass 15.
- Direct coverage (`tmp/p2-05-verify.log`, `COVERAGE_EXIT=0`): `update-swap.ts` branches 148/148, functions 41/41, lines 1567/1567; `update-flow.ts` 145/145, 28/28, 1078/1078; `reinstall-replace.ts` 58/58, 19/19, 724/724; `reinstall-flow.ts` 108/108, 20/20, 968/968; `types.ts` type-only.
- `npm run typecheck` exit 0. ESLint over the nine changed `.ts` files exit 0 (`tmp/p2-05-lint.log`).
- `npm run lint:type-members` exit 0 with 5 recorded exceptions, after the re-pins below (`tmp/p2-05-typemembers.log`). No new exception row: every new member has a production reader in this plan.
- `fallow audit`: verdict `warn`, 0 complexity findings, 0 dead-code issues; the only introduced clone groups are the pre-existing `tests/architecture/catalog-uat/fixtures/plugin-info.ts` ones.
- `rg "D-02-" extensions tests` counts 11 lines, the baseline.
- Pre-commit over the 10 code paths plus this SUMMARY, STATE.md and ROADMAP.md: `PRECOMMIT_EXIT=0` (`tmp/p2-05-precommit.log`). `npm changed checks` passed; the contracts.json edit selects the full scope. No hook rewrote a file.
- focused task verification passed; full phase/PR verification pending.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shifts only (columns unchanged; `id` and its `filter`/`refines` together):

- `orchestrators/plugin/reinstall-replace.ts` `:72:26`, `:72:43` (refines `:72:12`) -> `:73`
- `orchestrators/plugin/update-flow.ts` `:869:42` (filter `:869:11`) -> `:892`, `:950:42` (filter `:950:11`) -> `:973`
- `orchestrators/plugin/update-swap.ts` `:235:3` -> `:236:3`, `:238:3` -> `:239:3` (refines `:233:45` -> `:234:45`)

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Test shape] The rollback case lives in reinstall-flow, the call order in reinstall-replace**

- **Found during:** Task 2
- **Issue:** `reinstall-replace.test.ts` drives fake bridge operations, so it cannot observe file bytes.
- **Fix:** its rolled-back case asserts that a failure after the MCP replace throws `ManualRecoveryError` and runs `rollback mcp` before the other rollbacks. The byte restore is asserted end to end in `reinstall-flow.test.ts` (`AFILE-04: a rolled-back reinstall restores the comments and shows no notice`, save failure through `stateTransaction`).

**2. [Comment] GAP-10 described the removed early return**

- **Found during:** Task 2
- **Fix:** the case comment now states the observed behavior (no `notes` field) instead of naming the `notes.length === 0` branch.
- **Files modified:** `tests/orchestrators/plugin/reinstall-flow.test.ts`

**3. [Test] A self-rendered reinstall case**

- **Found during:** Task 2
- **Issue:** the plan asks the self-rendering arm to show its notices; no case pinned that order.
- **Fix:** `AFILE-04: a self-rendered reinstall shows the notice after its row`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cost actuals

`actuals.tokens` = 6900 (chars/4 over the added lines of the code diff from `43fc23b0`: 27490 chars) against the 110000 estimate (6%). Tasks 3 of 3. Commits: 1 code commit, measured from the ledger base.

## Next Phase Readiness

Plans 02-06 and 02-07 route the unstage verbs and enable/disable. Plan 02-08 routes the reconcile/import cascades and the marketplace update cascade, which now receives `mcpConfigNotices` on `updateSinglePlugin`'s outcomes, and reconcile backfill, which receives them on the reinstall `render: "none"` outcome. AFILE-04 completes there.

## Self-Check: PASSED

- Modified files exist: `orchestrators/types.ts`, `orchestrators/plugin/reinstall-replace.ts` and the other eight code paths in `key-files`.
- Code commit `f401f7e4` exists on `features/mcp-4` and lists all 10 code paths; `git rev-list --count 43fc23b0..f401f7e4` is 1. The commit deletes no file.

---
phase: 02-adapter-file-delivery
plan: 07
subsystem: notifications
status: complete
tags: [notifications, jsonc-comments, enable, disable, cascade-undo]

requires:
  - phase: 02-adapter-file-delivery
    provides: McpConfigNotice, notifyMcpConfigNotices and InstallLedgerSummary.mcpConfigNotices (plan 02-04); UnstageOutcome.mcpConfigNotices and mcpConfigNoticesMember (plan 02-06)
provides:
  - EnableDisablePluginOutcome mcpConfigNotices? on the enabled, disabled and failed arms, through the exported McpConfigNoticesCarrier
  - the enable/disable notice sink (enable-disable.ts McpConfigNoticeSink), set by each branch before its config write and save
  - EnableCascadeRun.mcpConfigNotices (member ledgers, root ledger, then each undo)
  - FreshInstallDisableResult.mcpConfigNotices (required, both arms)
  - install-cascade member undos fold their unstage notices into the run, through the shared unstageMaterializedMember helper
  - the landed-disabled install joins its disable cascade's notices to the stage's
affects: [02-08 reconcile routing of the orchestrated enable/disable outcome]

actuals:
  tokens: 9200
  tasks: 3
  commits: 1
plan_head_before: 78eb40fc93b23f05810b5492d9aeb12652a3982b
plan_head_after: 0b199e2126244c35629d878f315e4622765fb059

tech-stack:
  added: []
  patterns:
    - "Results carry the notices up to the helper that holds the lock; that helper sets a function-local sink before its config write and save, so a later throw still reports the rewrite"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/install-disable-cascade.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - scripts/check-unused-type-members.contracts.json
    - scripts/check-unused-type-members.exceptions.json

key-decisions:
  - "Enable and disable carry notices in result types up to the lock-holding helper (dispatchBranch, settleIdempotentEnableCascade, runFreshEnableCascadeWithRoot), which sets a function-local sink created in runSetEnabledOutcome; the sink crosses the lock boundary the way install-flow's CascadeFailureSink does"
  - "A transaction throw after a rewrite (a config write or the save) still shows the notice after the failed row, and the orchestrated failed outcome carries it"
  - "The enable root ledger restores its own bytes when it throws, so only a completed root materialization adds notices; the root's undo after a later config-phase failure unstages and adds its notices like a member's"
  - "materializeEnableRoot returns { outcome, mcpConfigNotices } instead of growing the internal SetEnabledOutcome fresh arm, which keeps the 7-parameter ceiling and adds no unread internal field"
  - "McpConfigNoticesCarrier.mcpConfigNotices is excepted in the unused-type-member gate until reconcile reads it (plan 02-08 drops the row)"
  - "AFILE-04 stays Pending in REQUIREMENTS.md until plan 02-08 completes the reconcile and import routing"

patterns-established:
  - "UnstageOutcome.mcpConfigNotices / InstallLedgerSummary.mcpConfigNotices -> branch result -> McpConfigNoticeSink -> notifyMcpConfigNotices after the row"

requirements-completed: []

duration: about 25 min of editing and focused checks, plus the full-scope pre-commit run
completed: 2026-10-03
---

# Phase 2 Plan 07: MCP config notices for enable, disable and the cascade undos Summary

**`enable` and `disable` now report every MCP config rewrite that dropped the user's JSONC comments, including rewrites by re-enabled dependencies and by cascade undos; the install cascade's undo and the landed-disabled install add their unstage notices to the install's own.**

## Performance

- **Duration:** about 25 min of editing and focused checks, plus the full-scope pre-commit run
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3
- **Files changed:** 10 (all modified)

## Accomplishments

- `enable-disable.ts`:
  - `runSetEnabledOutcome` owns one `McpConfigNoticeSink`. The standalone path calls `notifyMcpConfigNotices` once, after `dispatchOutcome` on the normal path and after the failed row in the transaction catch. `outcomeToTypedResult` spreads the notices onto the `enabled`, `disabled` and both failed arms, omitted when empty. The catch's failed outcome carries them too.
  - `runDisableBranch` returns the cascade's notices on both arms, and `dispatchBranch` sets the sink before the shrunken save or the config write.
  - `materializeEnableRoot` returns the ledger summary's notices beside the fresh outcome. `runEnableBranch` (orchestrated enable) sets the sink from them.
  - `EnableCascadeRun.mcpConfigNotices` collects each member ledger's notices, the root's, then every `unstageBackToDisabled` undo's (pushed before the rethrow of an unfinished unstage). `runEnableCascadeMembers` and `runEnableCascadeWithRoot` return the list on both arms, and `settleIdempotentEnableCascade` and `runFreshEnableCascadeWithRoot` set the sink before their save.
- `install-cascade.ts`: both member undos call the new `unstageMaterializedMember`, which pushes the `cascadeUnstagePlugin` outcome's notices into the run before the failure check, so `member-failed` reports them. Each undo keeps its own last step (delete the record, or put it back to disabled).
- `install-disable-cascade.ts`: `FreshInstallDisableResult.mcpConfigNotices` is required on both arms (`[]` for the no-record internal error).
- `install-flow.ts`: the landed-disabled branch appends the disable result's notices to the cascade's, and both the `installed` and the `disable-cascade-failed` arm return the combined list.

## Notification order (exact, from the tests)

- Standalone disable: the `(disabled)` row, then the comments-removed warning.
- Disable whose cascade fails after the MCP slot: the `(failed) {unreadable}` row, then the warning.
- Disable whose config write throws after the cascade: the brace-less `(failed)` row, then the warning.
- Standalone enable (with or without dependencies): the cascade rows, then one warning.
- Enable cascade that unwinds (root ledger throws): the `(failed)` row, then the warning, both when the member's stage removed the comments and when only its undo did.
- Enable of a plugin with no MCP servers over an unparseable `mcp-adapter.json`: the `(installed)` row, then the left-unchanged warning; the file keeps its bytes.
- Install that lands disabled: the `(disabled) {installs disabled}` row, then one warning naming `mcp-adapter.json` (stage) and `mcp.json` (disable cascade, legacy entry).
- Orchestrated enable, disable and failed disable: zero notifications; the outcome carries `mcpConfigNotices`.

## Verification

- `npm run typecheck`: clean. ESLint over the four production files: 0 errors (2 pre-existing unused-directive warnings).
- `node --test --test-name-pattern="^AFILE-0[24]" tests/orchestrators/plugin/enable-disable.test.ts`: pass 11, fail 0.
- `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-disable-cascade.test.ts` and the install-flow `^AFILE-04` pattern: all pass.
- `npm run test:coverage:direct` for enable-disable.ts (branches 299/299, functions 72/72, lines 3069/3069), install-cascade.ts (138/138, 27/27, 1290/1290), install-disable-cascade.ts (23/23, 9/9, 205/205) and install-flow.ts (225/225, 48/48, 2488/2488): `COV_EXIT=0`.
- `npm run lint:type-members`: passed with 8 recorded exceptions.
- `rg "D-02-" extensions tests`: 11 lines, the baseline.
- Pre-commit over the 10 code paths plus this SUMMARY, STATE.md and ROADMAP.md: `PRECOMMIT_EXIT=0` (`tmp/p2-07-precommit.log`). The contracts.json and exceptions.json edits select the full `npm changed checks` scope, which passed. No hook rewrote a file.
- `fallow audit --base HEAD` before the commit: verdict `pass`, no introduced clone group.
- focused task verification passed; full phase/PR verification pending.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shifts only unless noted (`id` and its `refines`/`filter` together):

- `enable-disable.ts` (18 contracts): `:140` -> `:143`, `:614`/`:615`/`:617` -> `:651`/`:652`/`:654`, `:645` -> `:682`, `:760` -> `:797`, `:1179` -> `:1241`, `:1234` -> `:1305`, `:1566`/`:1567` -> `:1647`/`:1648`, `:1672` -> `:1753`, `:1755` -> `:1836`, `:1847` -> `:1928`, `:2382` -> `:2485`, `:2392` -> `:2495`, `:2550` -> `:2653`, `:2825` -> `:2933`. The `materializeEnableRoot` return-type selection `:336:41` (filter `:336:12`) moves to `:464:50` (filter `:464:21`) with owner `MaterializedEnableRoot.outcome`, because the selection now sits on the new result interface's `outcome` member.
- `install-cascade.ts`: `:550` -> `:551`, `:1041` -> `:1072`.
- `install-disable-cascade.ts`: `:58`/`:59` -> `:72`/`:73`.
- `install-flow.ts`: `:2255` -> `:2259`.

`scripts/check-unused-type-members.exceptions.json`: `install-flow.ts:2233:7` -> `:2237:7` (`InstallMissingDependencyOutcome.mcpConfigNotices`, line shift), plus one new row, `enable-disable.ts:206:3` (`McpConfigNoticesCarrier.mcpConfigNotices`). **For plan 02-08:** its orchestrated callers, `reconcile/apply.ts applyPluginToggles` and `applyDependencyDisables`, route the notices there, and 02-08 must drop this row together with the three existing ones.

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Notices survive a transaction throw after a rewrite**

- **Found during:** Task 1
- **Issue:** the plan threads the notices through result types to the post-lock dispatch. A config write or the `tx.save()` can throw after the cascade or ledger rewrote the file, and that throw drops every result. The prohibition forbids a silent comment loss.
- **Fix:** results carry the notices up to the lock-holding helper, which sets a function-local `McpConfigNoticeSink` (no module-level holder) before the throw points. The catch path shows the notices after its failed row and returns them on the orchestrated failed outcome. Test: `AFILE-04: a disable whose config write fails after the cascade still shows the notice`.
- **Files modified:** `enable-disable.ts`, `enable-disable.test.ts`

**2. [Rule 2 - Missing critical functionality] The enable root's undo reports its notices**

- **Found during:** Task 2
- **Issue:** the plan says the root adds no undo notices, because the root ledger restores its own bytes. That holds when the root ledger throws. When the root commits and the config phase then throws, `runPhases` runs the root's undo, which unstages from the rewritten file.
- **Fix:** both undos go through `unstageBackToDisabled`, which pushes its notices into the run. The member-undo case is tested (`AFILE-04: an enable cascade undo that unstages from a commented mcp-adapter.json shows the notice`); the root undo shares the same line.
- **Files modified:** `enable-disable.ts`

**3. [Rule 2] An orchestrated failed disable returns the notices**

- Added `AFILE-04: an orchestrated disable whose cascade fails after the MCP slot returns the notice`, because the must-have names the orchestrated `failed` arm and no listed case covered it.

**4. [Rule 3 - Blocking] Unused-type-member exception for the orchestrated enable/disable outcome**

- **Found during:** Task 3 (`lint:type-members`)
- **Fix:** one recorded exception citing AFILE-04 / D-02-09 and plan 02-08 (see above).
- **Files modified:** `scripts/check-unused-type-members.exceptions.json` (not in `files_modified`)

**5. [Coverage] Extra install-disable-cascade cases**

- `AFILE-04: a clean cascade that rewrote no commented file carries no notices` and `AFILE-04: a partial cascade that rewrote no commented file carries no notices` cover the `?? []` branch on each arm, which direct coverage counts.

**6. [Duplication] Shared member-undo helper in install-cascade.ts**

- **Found during:** Task 3 (`fallow audit --base HEAD`)
- **Issue:** the identical notice line in both member undos grew their existing parallel bodies into a new clone group (`introduced: true`, verdict `warn`).
- **Fix:** `unstageMaterializedMember` holds the shared guard, unstage, notice push and failure fold; the comment that explained the fold moved with it. `fallow audit --base HEAD` then reports `pass` with no introduced clone group.
- **Files modified:** `install-cascade.ts`

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cost actuals

`actuals.tokens` = 9200 (chars/4 over the added lines of the code diff from `78eb40fc`: 36813 chars) against the 110000 estimate (8%). Tasks 3 of 3. Commits: 1 code commit, measured from the ledger base.

## Next Phase Readiness

Plan 02-08 reads `EnableDisablePluginOutcome.mcpConfigNotices` in `reconcile/apply.ts` (`applyPluginToggles`, `applyDependencyDisables`), together with the uninstall, remove and missing-dependency install carriers, drops the four exception rows, and completes AFILE-04.

## Self-Check: PASSED

- All 10 modified code paths are in code commit `0b199e21` on `features/mcp-4`; `git rev-list --count 78eb40fc..0b199e21` is 1.
- `rg "notifyMcpConfigNotices\(" enable-disable.ts` hits the success path and the transaction catch; `rg "mcpConfigNotices" install-disable-cascade.ts` hits both result arms.

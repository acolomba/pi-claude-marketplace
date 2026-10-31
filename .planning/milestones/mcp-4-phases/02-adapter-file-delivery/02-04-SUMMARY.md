---
phase: 02-adapter-file-delivery
plan: 04
subsystem: notifications
tags: [notifications, jsonc-comments, install, rollback, catalog]

requires:
  - phase: 02-adapter-file-delivery
    provides: McpConfigDoc.hadComments and the unreadable-file noop (plan 02-01), the replacement handle in stage.ts (reinstall), stampServers (plan 02-03)
provides:
  - shared/notification-dispatch.ts McpConfigNotice and notifyMcpConfigNotices
  - StageMcpCommitResult.notices (comments-dropped on a rewrite of a commented file, left-unchanged on the unreadable-file noop)
  - InstallLedgerSummary.mcpConfigNotices and the install ledger's byte-restoring mcp undo
  - InstallCascadeResult.mcpConfigNotices on the installed and member-failed arms
  - InstallPluginOutcome and InstallMissingDependencyOutcome mcpConfigNotices? (installed and failed arms)
  - catalog states mcp-comments-dropped and mcp-config-left-unchanged, locked by tests/architecture/mcp-config-notices.test.ts
  - tests/architecture/catalog-block.ts readCatalogBlock
affects: [02-05 update/reinstall routing, 02-06 unstage routing, 02-07 enable/disable routing, 02-08 reconcile/import routing]

actuals:
  tokens: 14400
  tasks: 3
  commits: 1
plan_head_before: 30591f7ee4a8cb6cfc5e46532f98d3b03db4b60d
plan_head_after: 927ce1b9da10d2ca33257ab47c6c148e856f3654

tech-stack:
  added: []
  patterns:
    - "A bridge reports a file fact as a structured notice; the orchestrator calls notifyMcpConfigNotices after its own row"
    - "An outcome carries mcpConfigNotices only when non-empty (NREG-01), through one install-flow helper"

key-files:
  created:
    - tests/architecture/catalog-block.ts
    - tests/architecture/mcp-config-notices.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - docs/output-catalog.md
    - scripts/check-unused-type-members.contracts.json
    - scripts/check-unused-type-members.exceptions.json
    - tests/shared/notification-dispatch.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/types.test.ts
    - tests/architecture/integration-materialization-gate.test.ts
    - tests/architecture/hooks-cap-notify.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts

key-decisions:
  - "Install outcomes carry mcpConfigNotices in both modes (omitted when empty); only the standalone path sends them, so one helper serves every arm"
  - "A disable cascade that fails after a landed-disabled install also reports the notices, because the ledger already rewrote the file"
  - "The cascade member phases share one recordMaterializedMember helper, which removes the clone the new notice line would have extended"
  - "InstallMissingDependencyOutcome.mcpConfigNotices (installed arm) is excepted in the unused-type-member gate until the reconcile routing reads it; the gate refuses the run once that read exists, so the row cannot outlive the gap"
  - "AFILE-04 stays Pending in REQUIREMENTS.md: this plan routes install only; plans 02-05 to 02-08 route the other verbs"

patterns-established:
  - "prepareStageMcpServers -> result.notices -> InstallLedgerSummary.mcpConfigNotices -> CascadeRun -> notifyMcpConfigNotices after the row"

requirements-completed: []

coverage:
  - id: D1
    description: "notifyMcpConfigNotices sends nothing for an empty list and one warning per kind, comments-dropped first, with distinct lines in first-seen order"
    requirement: AFILE-04
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#AFILE-04"
        status: pass
      - kind: unit
        ref: "tests/architecture/mcp-config-notices.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The stage reports comments-dropped only when it rewrites a commented file; a trailing comma alone and the noop report nothing; the unreadable-file noop reports left-unchanged with no warning string"
    requirement: AFILE-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-04"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-02: an empty staged set over an unparseable file is a noop that reports it left unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed install restores the exact prior bytes of mcp-adapter.json; a restore that cannot write is the mcp rollback partial"
    requirement: AFILE-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#AFILE-04: a later-phase failure restores the commented mcp-adapter.json byte for byte"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#AFILE-04 / NFR-3: an mcp restore that cannot write is reported as the mcp rollback partial"
        status: pass
    human_judgment: false
  - id: D4
    description: "Standalone install, cascade, failed cascade and promotion show the notice after their rows; orchestrated and reload installs return it and send nothing"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#AFILE-04"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#AFILE-04"
        status: pass
    human_judgment: false
  - id: D5
    description: "A plugin with no MCP servers installs over an unparseable mcp-adapter.json, keeps its bytes and shows left-unchanged; a plugin with MCP servers refuses with McpConfigFileError"
    requirement: AFILE-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#AFILE-02: installing a plugin with no MCP servers over an unparseable mcp-adapter.json leaves it unchanged and says so"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#AFILE-02"
        status: pass
    human_judgment: false

duration: 78min
completed: 2026-10-03
status: complete
---

# Phase 2 Plan 04: MCP config notices for install Summary

**`notifyMcpConfigNotices` is the one seam for MCP config file notices: the MCP bridge reports `comments-dropped` when it rewrites a commented `mcp-adapter.json` and `left-unchanged` when it skips an unreadable one, every install path routes them after its own row (or returns them when orchestrated), and a failed install now restores the file's exact bytes instead of unstaging from the rewritten file.**

## Performance

- **Duration:** about 78 min (about 20 of them waiting on the full `npm changed checks` hook run)
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3
- **Files changed:** 20 (2 created, 18 modified)

## Accomplishments

- `shared/notification-dispatch.ts`: `McpConfigNotice { kind, scope, file }` and `notifyMcpConfigNotices(ctx, notices)`. An empty list sends nothing; each kind present sends one `"warning"` call (comments-dropped first) with a summary line, a blank line and one line per distinct `(kind, scope, file)`. Lines name the scope and the file basename only.
- `bridges/mcp`: `StageMcpCommitResult.notices` is required and frozen. The staged branch reports `comments-dropped` when `config.hadComments`; the AS-8 noop reports nothing; the unreadable-file noop reports `left-unchanged` and no longer puts the refusal text in `warnings`.
- `install-outcome.ts`: the mcp phase commits through `replacePreparedMcp` and its undo calls `rollbackMcpReplacement`, throwing the joined leak strings so a restore that cannot write is the `mcp` rollback partial. `InstallLedgerSummary.mcpConfigNotices` projects the phase's notices. `enable-disable.ts` inherits the byte restore through `runInstallLedger`.
- `install-cascade.ts`: `CascadeRun` collects each materialized member's notices; the `installed` and `member-failed` arms return them in member order. Both member phases record through one `recordMaterializedMember` helper.
- `install-flow.ts`: `withMcpConfigNotices` notifies after the row in standalone mode and puts `mcpConfigNotices` on the outcome when non-empty. It covers the installed arm (landed-disabled included, with the whole cascade's notices), the promotion arm (re-materialized disabled record), the disable-cascade-failed arm, and the failure catch (notices stored on `CascadeFailureSink` by `unwrapCascade` before the rethrow). The reload missing-dependency entry returns them on its installed and failed outcomes.
- `docs/output-catalog.md`: two out-of-band states. `tests/architecture/catalog-block.ts` now holds `readCatalogBlock` (moved unchanged from `hooks-cap-notify.test.ts`), and `tests/architecture/mcp-config-notices.test.ts` locks the seam's bytes to both blocks.

## Catalog wording (exact)

`mcp-comments-dropped` (example: user scope):

```text
MCP config comments removed.

The user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.
```

`mcp-config-left-unchanged` (example: project scope):

```text
MCP config left unchanged.

The project-scope mcp-adapter.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.
```

## Task Commits

All three tasks land in ONE code commit, as the plan requires:

1. **Tasks 1-3: warn when a rewrite drops mcp-adapter.json comments** - `927ce1b9` (feat)

## Verification evidence

- Task 1 verify (`tmp/p2-04-t1-verify.log`, `VERIFY_EXIT=0`): typecheck; dispatch 213, stage 50, types, gate and install-outcome pass; `^AFILE-04` install-flow pass 1; direct coverage 100% for `notification-dispatch.ts` (62/62, 23/23, 527/527), `stage.ts` (65/65, 17/17, 369/369) and `install-outcome.ts` (132/132, 33/33, 1291/1291).
- Tracer gate after Task 1: interactive mode (`auto_advance: false`), `end-of-phase` human verify, automated-only verify passed, so expansion continued.
- Task 2 verify (`tmp/p2-04-t2-verify.log`, `VERIFY_EXIT=0`): install-outcome, stage and both byte locks 96 pass; `^AFILE-0[24]` install-flow pass 3; direct coverage 100% for `stage.ts` (65/65, 17/17, 371/371) and `install-outcome.ts` (132/132, 33/33, 1298/1298).
- Task 3 verify (`tmp/p2-04-t3-verify.log`, `VERIFY_EXIT=0`): cascade 83 pass; `^AFILE-0` install-flow pass 12; direct coverage 100% for `install-cascade.ts` and `install-flow.ts` (225/225, 48/48, 2483/2483). After the helper extraction, cascade direct coverage is 138/138, 26/26, 1275/1275 (`tmp/p2-04-cascade2.log`).
- `npm run lint:type-members` exit 0 with 5 recorded exceptions; `npm test` 8716 of 8717 pass on a run that overlapped a pin edit, and the one failure (`unused-type-member-gate.test.ts`, empty gate output while a pin was stale) passes on its own rerun (9 of 9).
- ESLint over every changed `.ts` file: 0 errors (one pre-existing unused-directive warning at `install-flow.ts:397`, untouched). `npm run fallow` and `format:check` exit 0. `fallow audit`: verdict `warn`; its only introduced clone groups are the pre-existing `tests/architecture/catalog-uat/fixtures/plugin-info.ts` ones.
- `rg "D-02-" extensions tests` counts 11 lines, the baseline.
- Pre-commit over the 20 code paths plus this SUMMARY, STATE.md and ROADMAP.md: `PRECOMMIT_EXIT=0` (`tmp/p2-04-precommit.log`). `npm changed checks` selected the full scope (`npm run check` plus `test:coverage:direct:all`; `check:changed --list` reports `"scope": "full"`) and passed.
- focused task verification passed; full phase/PR verification pending.

## TDD (Task 2)

RED (`tmp/p2-04-red.log`, `RED_EXIT=1`) before the production change, each failing for the intended reason: the byte-restore case got the rewritten comment-free bytes; the restore-failure case got the raw unstage `EACCES` text instead of the `failed to restore mcp-adapter.json at ...` leak; the left-unchanged ledger case got `mcpConfigNotices: []`. GREEN: the Task 2 verify above. Negative controls: renaming the catalog summary fails the byte lock (`tmp/p2-04-negctl.log`, `NEGCTL_EXIT=1`); routing only the root ledger's notices and dropping the failure notices fails four Task 3 cases (`tmp/p2-04-t3-negctl.log`, `NEGCTL_EXIT=1`). The plan's single-commit protocol replaces per-gate commits.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shifts only (columns unchanged; `id` and its `filter`/`refines` together):

- `bridges/mcp/stage.ts` `:291` -> `:304`, `:338` -> `:351`, `:59` -> `:60`
- `bridges/mcp/types.ts` `:94` -> `:101`
- `orchestrators/plugin/install-outcome.ts` `:1219:3` -> `:1237:3` (refines `:1218:30` -> `:1236:30`)
- `shared/notification-dispatch.ts` `:218` -> `:273`
- `orchestrators/plugin/install-cascade.ts` `:506` -> `:509`, `:539` -> `:550`, `:1013` -> `:1041`
- `orchestrators/plugin/install-flow.ts` `:658` -> `:692`, `:1117` -> `:1156`, `:2177` -> `:2255`

`scripts/check-unused-type-members.exceptions.json` gains one row: `install-flow.ts:2233:7 InstallMissingDependencyOutcome.mcpConfigNotices`.

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The disable-cascade-failed arm reports the notices**

- **Found during:** Task 3
- **Issue:** a landed-disabled install whose disable cascade fails has already rewritten the file; the plan did not list this arm, and the prohibition forbids a silent comment loss.
- **Fix:** the arm carries the cascade's notices and routes them like the others; its orchestrated early return became an `if (!orchestrated)` around the row.
- **Files modified:** `install-flow.ts`

**2. [Rule 3 - Blocking] Unused-type-member exception for the reload outcome's notices**

- **Found during:** Task 3
- **Issue:** `lint:type-members` reports `InstallMissingDependencyOutcome.mcpConfigNotices` unread: its only production caller, `reconcile/apply.ts`, routes notices in plan 02-08.
- **Fix:** a recorded exception citing AFILE-04 / D-02-09. The gate refuses a row that matches no finding, so plan 02-08 must drop it when it adds the read.
- **Files modified:** `scripts/check-unused-type-members.exceptions.json` (not in `files_modified`)

**3. [Rule 1 - Duplication] `recordMaterializedMember` in install-cascade.ts**

- **Found during:** Task 3 (`fallow audit` reported an introduced clone group in the two member phases)
- **Fix:** both phases record the member through one helper, which also removes the pre-existing clone of the outcome literal.
- **Files modified:** `install-cascade.ts`

**4. [Test shape] Restore-failure case restores permissions in `finally`, not `t.after`**

- `createHermeticEnvironment` registers its cleanup first and `t.after` hooks run in registration order, so a later `t.after` would restore permissions after the cleanup failed on the read-only directory. The leak text holds a random write-file-atomic temp path, so the case compares the partial's phase list whole and the message's exact deterministic prefix.

**5. [Wording] Catalog prose for left-unchanged**

- The plan's prose said the file "is not read or rewritten"; the command does read it (that is how it knows the file is invalid), so the catalog says it is not rewritten and keeps its exact bytes.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cost actuals

`actuals.tokens` = 14400 (chars/4 over the added lines of the code diff from `30591f7e`, new files included: 57516 chars) against the 135000 estimate (11%). Tasks 3 of 3. Commits: 1 code commit, measured from the ledger base.

## Next Phase Readiness

Plans 02-05 to 02-08 route the same seam for update, reinstall, unstage verbs, enable/disable and the reconcile/import cascades. Plan 02-08 must read `InstallMissingDependencyOutcome.mcpConfigNotices` in `reconcile/apply.ts` and drop the exception row in the same change. AFILE-04 completes there.

## Self-Check: PASSED

- Created files exist: `tests/architecture/catalog-block.ts`, `tests/architecture/mcp-config-notices.test.ts`.
- Code commit `927ce1b9` exists on `features/mcp-4` and lists all 20 code paths; `git rev-list --count 30591f7e..927ce1b9` is 1.

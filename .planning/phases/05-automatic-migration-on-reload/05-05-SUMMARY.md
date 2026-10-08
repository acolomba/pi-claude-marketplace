---
phase: 05-automatic-migration-on-reload
plan: 05
subsystem: mcp
tags: [mcp, migration, fault-injection, notices]
status: complete

requires:
  - phase: 05-automatic-migration-on-reload
    provides: migrateLegacyMcpEntries, McpMigrationOperations and notifyMcpMigration (05-01), commitPreparedMcp identical-bytes skip and the empty-servers leftover sweep (05-02, 05-03), the offline git probe and left-in-place rows (05-04)
provides:
  - orchestrators/reconcile/mcp-migration.ts OwnerAction arms move / malformed / disabled; per-name removal classification (moved, not-declared, unsupported-feature); the D-05-06 record change (installable false, mcpServers in unsupported); the unfinished row for a failed mcp.json removal after a committed move
  - shared/notification-dispatch.ts McpMigrationRemovedRow, McpMigrationUnfinishedRow, McpMigrationRemovalCause; section "Removed from mcp.json:"; summary "Plugin MCP servers removed from mcp.json." for a removal-only notice
  - catalog states mcp-migration-removed and mcp-migration-unfinished
affects: [phase verification, AMIG-01, AMIG-02, AMIG-03]

tech-stack:
  added: []
  patterns:
    - "Write recorder: wraps each real operation and logs the basename of a file whose inode, mtime or bytes changed during that call"
    - "Crash-point convergence: a fixed clock, a reference tree run uninterrupted, file texts compared with each tree's cwd and home replaced"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - docs/output-catalog.md
    - tests/orchestrators/reconcile/mcp-migration.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/architecture/mcp-migration-notice.test.ts
    - tests/integration/mcp-migration.test.ts

key-decisions:
  - "The unsupported removal cause is the string \"unsupported-feature\", not \"unsupported\": the partial-vocabulary guard forbids the bare \"unsupported\" literal repo-wide"
  - "A failed mcp.json removal is an unfinished row only for a moving owner; a disabled or malformed owner (no server written) keeps a stopped row, because the unfinished wording says new entries were written"
  - "A removal-only notice (no moved and no left row) opens with \"Plugin MCP servers removed from mcp.json.\"; any left row keeps the attention summary"
  - "The record change for a dropped server sets installable false and appends mcpServers to unsupported only; it stamps updatedAt once with the inventory change"

patterns-established:
  - "Each owner gets one OwnerAction arm; the stage input, record change and removal rows each branch on the arm in their own small function"

requirements-completed: [AMIG-01, AMIG-02, AMIG-03]

duration: 75min
completed: 2026-10-08

estimate:
  tokens: 150000
  tasks: 3
  confidence: low
actuals:
  tokens: 21324
  tasks: 3
  commits: 1
plan_head_before: 150c6fbeeaeb386e18a553c9390729e15a6954b8
plan_head_after: 6d56547e4a36795d6b65ff1ac836e6b3f5113542
---

# Phase 05 Plan 05: Removal arms and the write-order fault proof Summary

The reload move now removes what an installed plugin no longer provides: undeclared servers, servers pi-mcp-adapter cannot run (the record becomes partially installed), every entry of a malformed plugin, and a disabled plugin's entries. Each removal is a notice row with its reason. A recorder of real writes and a real filesystem refusal prove the write order `mcp-adapter.json`, `state.json`, `mcp.json` and that every crash point converges.

## What Was Built

- **Arms** (`orchestrators/reconcile/mcp-migration.ts`): `ownerAction` gives `disabled` for a disabled record the plan does not enable, `malformed` for an `unavailable` resolve (only a malformed-MCP resolve gets past `readableOffline`), and `move` for any materializable resolve. `stagedSource` stages the supported servers, or `{}` with `record.resolvedSource` for the two removal arms. `recordAction` sets the inventory to the staged names and, for dropped servers, `installable: false` plus `mcpServers` in `unsupported`. A disabled record is never changed. `removalRow` classifies each removed name as moved, `unsupported-feature` (with its feature) or `not-declared`. The module header records how this differs from backfill.
- **Rows** (`shared/notification-dispatch.ts`): removed rows render in `Removed from mcp.json:` between moved and left-in-place. Unfinished rows render under `Left in mcp.json:`. Severity is `warning` for a left row, an unsupported or malformed removal, or a removed leftover. The reload hint follows whenever a row moved or was removed, and the cost line only follows a move.
- **Catalog** (`docs/output-catalog.md`): blocks `mcp-migration-removed` and `mcp-migration-unfinished`. The moved and left-in-place prose now states the final section order.
- **Proofs**: there are 14 new unit cases: the removal arms, a record already partial, the disabled stopped row, both write orders, the unfinished recovery over three runs, three crash points and the half-done state. There are 4 new integration cases: removed plus dropped plus moved with `info`, malformed plus a fresh-install refusal, the leftover warning, and the `lockedLink` refusal. There are 8 new dispatch cases and 2 new lock rows.

## Verification

- Task 1: `npm run typecheck` clean; `node --test tests/integration/mcp-migration.test.ts`: 11 pass, 0 fail.
- Task 2: both test files 63 pass, 0 fail; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts` exit 0 (100%).
- Task 3: `node --test tests/shared/notification-dispatch.test.ts tests/architecture/mcp-migration-notice.test.ts` pass; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-dispatch.ts` exit 0 (100%); `npm run test:modules` exit 0, `npm run test:architecture` exit 0, `npm run test:integration` exit 0.
- Pre-commit: `tail -n 1 tmp/p5-05-precommit.log` = `PRECOMMIT_EXIT=0`.
- Commit hook: `npm run check:commit` Passed on commit 6d56547e (the commit exited 0).
- `npx fallow audit --base 150c6fbe`: no issues in 7 changed files. It reported one inherited clone group (`dup:6f87acd9`, pre-existing code in `notification-dispatch.ts` whose lines shifted); the audit gate excluded it.
- Decision-ID check: `git diff 150c6fbe..HEAD -- extensions tests` adds no `D-05-NN` line.
- **Phase gate:** `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/mcp4-p5-05 npm run check` exited **0** on commit 6d56547e, Node v26.11.0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The removal cause "unsupported" tripped the partial-vocabulary guard**
- **Found during:** Task 3 (`npm run test:architecture`)
- **Issue:** `tests/architecture/partial-vocabulary-guard.test.ts` forbids the literal `"unsupported"` and a standalone backtick `unsupported` everywhere. The plan's cause value used both.
- **Fix:** The cause is `"unsupported-feature"`. The rendered text still reads `{unsupported mcp} <feature>`.
- **Files modified:** notification-dispatch.ts, mcp-migration.ts, and the three test files
- **Commit:** 6d56547e

**2. [Rule 1 - Correctness] The unfinished row is used only where its wording is true**
- **Found during:** Task 1
- **Issue:** The unfinished row says "The new entries are written". A disabled or malformed owner writes no server.
- **Fix:** Those two arms keep a `stopped` row when the removal fails. A unit case pins it.
- **Commit:** 6d56547e

**3. [Coverage] An unsupported removal row with no feature**
- **Found during:** Task 3 (direct coverage 152/153 branches)
- **Issue:** `feature?: string` left a fallback branch that no case reached.
- **Fix:** The renderer omits the feature when it is absent. A dispatch case pins `{unsupported mcp}: pi-mcp-adapter cannot run it.`
- **Commit:** 6d56547e

**4. [Lint] Nested template literal, padding line, unsafe `any` member access**
- **Fix:** The feature text is now a local constant, `eslint --fix` added the padding line, and a typed `serverKeys` helper replaces the raw `JSON.parse` member access.

**5. [Test design] The integration refusal pins the temp-file name with a placeholder**
- **Issue:** The `EACCES` detail names write-file-atomic's random temp file (`mcp.json.<digits>`).
- **Fix:** Before the exact comparison, the case replaces `mcp\.json\.\d+` with `mcp.json.<tmp>`.

**6. [Simplicity] `npm run format` was not run tree-wide**
- **Fix:** Prettier ran on the seven plan files only, because the operator may edit other files at the same time.

**Total deviations:** 6 (1 blocking gate fix, 1 correctness narrowing, 1 coverage fix, 1 lint fix, 2 process adjustments). **Impact:** the row field `cause` uses `"unsupported-feature"` where the plan said `"unsupported"`. Nothing else changes in the plan's contract.

## TDD Note

Tasks 2 and 3 are `tdd="true"`, but the tracer (Task 1) built the arms first and the plan prescribes one commit, so no failing-test commit comes first. `workflow.tdd_mode` is off, so no gate applies.

## Issues Encountered

- For operator review: all new row wording is a closed-catalog draft (`no longer declares it`, `is disabled`, `{unsupported mcp} <feature>: pi-mcp-adapter cannot run it.`, the `{malformed mcp}` sentence, the unfinished sentence, and the removal-only summary line).
- The `{malformed mcp}` row repeats for each removed entry of one plugin, as the plan's flagged assumption says.
- A record that was already `installable: false` for another component, and now also drops an MCP server, gains `mcpServers` in `unsupported`, but its `notes` are not refreshed, as the plan's "change nothing else" requires.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: all 7 modified files exist; commit 6d56547e is an ancestor of HEAD.

---
phase: 05-automatic-migration-on-reload
plan: 01
subsystem: mcp
tags: [mcp, migration, reconcile, notices]
status: complete

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: generatedMcpServerKey adapter keys and the closed translator in prepareStageMcpServers
  - phase: 04-variable-expansion-at-claude-code-parity
    provides: the variables-missing and credentials-blanked notices on every staging path
provides:
  - bridges/mcp/legacy.ts readLegacyMcpOwners and removeLegacyMcpEntries (re-exported by the MCP barrel with LegacyMcpOwner)
  - bridges/mcp/marker.ts markerOwnerOf and McpMarkerOwner
  - orchestrators/reconcile/mcp-migration.ts migrateLegacyMcpEntries with the McpMigrationOperations write-order seam
  - ApplyReconcileOptions.migrateMcpEntries, McpMigrationInput and McpMigrationStep in orchestrators/reconcile/types.ts
  - notifyMcpMigration and the shared private mcpConfigNoticeSections in shared/notification-dispatch.ts
  - catalog blocks mcp-migration-moved and mcp-migration-stopped, byte-locked by tests/architecture/mcp-migration-notice.test.ts
  - tests/integration/mcp-plugin-seed.ts seedLegacyMcpInstall
affects: [05-02, 05-03, 05-04, 05-05]

actuals:
  tokens: 30250
  tasks: 3
  commits: 1
plan_head_before: faab8758adcb6ce90303ea57a0e888b9670a18d1
plan_head_after: f5686c61231be64d9e9880d4e82d2189fd2972b2

tech-stack:
  added: []
  patterns:
    - "A load-time reconcile step with its own scope lock, injected through an optional ApplyReconcileOptions seam and isolated into its own notice rows"
    - "One out-of-band notice body that reuses the MCP config line sections of notifyMcpConfigNotices"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - tests/bridges/mcp/legacy.test.ts
    - tests/orchestrators/reconcile/mcp-migration.test.ts
    - tests/architecture/mcp-migration-notice.test.ts
    - tests/integration/mcp-migration.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - docs/output-catalog.md
    - tests/bridges/mcp/marker.test.ts
    - tests/bridges/mcp/types.test.ts
    - tests/bridges/mcp/index.test.ts
    - tests/orchestrators/reconcile/types.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/integration/mcp-plugin-seed.ts

key-decisions:
  - "The migration step re-reads the manifest entry through domain/manifest-lookup.ts lookupDeclaredPlugin, because the D-99-02a drift gate forbids a local plugins.find membership twin"
  - "An unreadable mcp-adapter.json makes prepareStageMcpServers refuse for a movable owner (it always has servers to stage), so the owner gets a stopped row and keeps its legacy entries; plan 05-04 turns this into a left-in-place row"
  - "Notice rows sort with plain code-unit comparison (project < user, then plugin, then old name; stopped rows by detail), never compareByNameThenScope or localeCompare"

patterns-established:
  - "McpMigrationOperations: the step's writes and clock as one injectable object whose real value is the parameter default, so a test logs the real write order"

requirements-completed: []

coverage:
  - id: D1
    description: "A /reload moves an installed path-source plugin's legacy mcp.json entry into mcp-adapter.json with the fresh-install bytes, empties its marked entries from mcp.json, and a second reload changes no bytes"
    requirement: AMIG-01
    verification:
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-01: /reload moves an installed plugin's mcp.json entry into mcp-adapter.json under its Claude Code key"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-01: after the move another /reload changes no bytes and sends no notice"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The step runs per scope after the read pass and before applyPlan, also on an invalid config, never after a read-pass throw, and a throw becomes a stopped row"
    requirement: AMIG-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#AMIG-01: the MCP move runs once per scope after the read pass and before the plan is applied"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#NFR-2: a throwing MCP move becomes one warning notice before the cascade, which still follows"
        status: pass
    human_judgment: false
  - id: D3
    description: "One migration notice per reload for both scopes, project rows first, with the cost line and the reload hint, byte-locked against the catalog"
    requirement: AMIG-03
    verification:
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-03: one notice covers both scopes, project rows first"
        status: pass
      - kind: unit
        ref: "tests/architecture/mcp-migration-notice.test.ts"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#notifyMcpMigration"
        status: pass
    human_judgment: false
  - id: D4
    description: "Notice wording (summary lines, section headers, cost line) is a closed-catalog draft for operator review"
    requirement: AMIG-03
    human_judgment: true
    rationale: "The wording is drafted for operator review; no test can judge whether it reads well to a user"

duration: 34min
completed: 2026-10-08
---

# Phase 5 Plan 01: Automatic MCP migration on reload (plain case) Summary

**A `/reload` now re-stages each installed, enabled path-source plugin whose `_piClaudeMarketplace`-marked entries sit in the legacy `mcp.json` into `mcp-adapter.json` under `plugin_<plugin>_<server>_` with fresh-install bytes, saves the record once, removes the old entries last, and tells the user in one notice for both scopes.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-08T13:16:16Z
- **Completed:** 2026-10-08T13:50:00Z
- **Tasks:** 3 (tracer, two TDD test tasks)
- **Files:** 20 (6 created, 14 modified)

## Accomplishments

- `bridges/mcp/legacy.ts`: `readLegacyMcpOwners` groups marked `mcp.json` entries by owner (marketplace then plugin, code-unit order, names in file order); `removeLegacyMcpEntries` rewrites only when it removes something, reports `comments-dropped` and `left-unchanged` for `mcp.json`, and returns the written bytes (NFR-3).
- `orchestrators/reconcile/mcp-migration.ts`: no marked entry or no `state.json` means no lock and no write; otherwise one `withLockedStateTransaction` stages every movable owner into `mcp-adapter.json`, saves `state.json` once when a record's MCP inventory changed, then removes the legacy entries. A per-owner failure is a stopped row and the other owners still move. The module names no git surface (ESLint BLOCK F passes).
- `apply.ts`: `migrateScopeIsolated` runs after the read pass and before the invalid-config check; `notifyMcpMigration` runs after the scope loop and before the empty-outcomes return.
- `notifyMcpMigration` and the shared `mcpConfigNoticeSections`; `notifyMcpConfigNotices` output is unchanged (pinned by a new five-kind case and the existing byte lock).
- Catalog blocks `mcp-migration-moved` / `mcp-migration-stopped` with their byte lock.

## Task Commits

The plan prescribes one commit for all three tasks:

1. **Tasks 1-3: the step, its bridge helpers, the notice, the tests and the catalog** - `f5686c61` (feat)

**Plan metadata:** this SUMMARY with STATE.md, state.json and ROADMAP.md in the following docs commit.

## Verification

- Tracer verify: `npm run typecheck` and `node --test tests/integration/mcp-migration.test.ts`: 3/3 pass on the first run, re-run before expansion (tracer gate passed).
- Task 2: owner files 80/80 pass; `npm run test:coverage:direct` for `legacy.ts`, `marker.ts`, `index.ts`, `types.ts`: exit 0 (100%).
- Task 3: owner files pass (mcp-migration 18/18, notification-dispatch 235/235, apply step cases 5/5, catalog lock 6/6); `npm run test:coverage:direct` for `mcp-migration.ts`, `apply.ts`, `types.ts`, `notification-dispatch.ts`: exit 0 (100%).
- `TMPDIR=/var/tmp/mcp4-p5-01 npm run test:modules`: exit 0. `npm run test:architecture`: exit 0 (317 tests, after the drift-gate fix below). `npm run test:integration`: exit 0. `npm run fallow`: exit 0. `npx fallow audit --base faab8758`: no issues in the 22 changed files (one inherited clone group excluded by the gate).
- `PRECOMMIT_EXIT=0` (`tmp/p5-01-precommit.log`, last line).
- Commit hook: `npm run check:commit` Passed on `f5686c61` (all pairs, because `tests/integration/mcp-plugin-seed.ts` is staged test support). Node v26.11.0.
- Plan verification greps: no `D-05-NN` in the added lines of `extensions` and `tests`; no `D-NN` in the new files or the new seam doc; `migrateScopeIsolated(` (line 1401) sits between the read-pass catch and the `invalidOutcomes` check; `notifyMcpMigration(` (1437) precedes `notifyReconcileAppliedWithContext(` (1456).

Focused task verification passed; full phase/PR verification pending.

## Decisions Made

- `lookupDeclaredPlugin` replaces the plan's `manifest.plugins.find(...)` copy of the backfill shape (drift gate D-99-02a).
- A movable owner always has servers to stage, so `prepareStageMcpServers` never returns its noop arm here; an unreadable `mcp-adapter.json` makes it refuse, which becomes a stopped row and leaves the legacy entries in place.
- Stopped rows sort by scope, then by detail (they have no plugin or old name).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The manifest-lookup drift gate rejected a local `plugins.find`**
- **Found during:** Task 3 (`npm run test:architecture`)
- **Issue:** `tests/architecture/manifest-lookup-drift.test.ts` (D-99-02a) flags any `.plugins.find((p) => p.name === ...)` outside `domain/manifest-lookup.ts`. The plan copied the backfill shape.
- **Fix:** `resolveOffline` calls `lookupDeclaredPlugin(manifest, plugin)` and checks `lookup.kind === "absent"`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`
- **Commit:** f5686c61

**2. [Rule 1 - Bug] The fix-spaces hook turned the NBSP boundary case into a plain space**
- **Found during:** Task 3 commit (`pre-commit run --files`)
- **Issue:** The control-character case used a literal U+00A0 to prove the first non-control code unit after C1 is not escaped; the `fix-spaces` hook rewrote it to U+0020, which removes the boundary check.
- **Fix:** Both the input and the expected line spell it as the ASCII escape ` `.
- **Files modified:** `tests/shared/notification-dispatch.test.ts`
- **Commit:** f5686c61

**3. [Project rule] Apply cases sit in the existing `describe("applyReconcile")`**
- **Found during:** Task 3
- **Issue:** The plan asked for a new `describe` for the step; `skills/typescript-unit-testing/SKILL.md` allows one top-level `describe` per exported entrypoint and no nesting, and `applyReconcile` already has its block.
- **Fix:** The five position and isolation cases were appended to that block. `rg migrateMcpEntries tests/orchestrators/reconcile/apply.test.ts` still prints lines.
- **Commit:** f5686c61

**4. [Test design] The position case counts uninstall calls instead of a shared log**
- **Found during:** Task 3
- **Issue:** `UninstallPluginOperation` is overloaded, so a hand-written logging wrapper does not type-check.
- **Fix:** The real uninstall is wrapped with `t.mock.fn`, and the injected step records `uninstallPlugin.mock.callCount()` when it runs: 0 for the project scope (before `applyPlan` uninstalls `gone@mp`) and 1 for the user scope.
- **Commit:** f5686c61

**Total deviations:** 4 (1 blocking gate fix, 1 hook-induced test fix, 2 test-structure adjustments). **Impact:** none on the plan's contract.

## Issues Encountered

- An unparseable `mcp.json` (invalid JSONC or a non-object `mcpServers`) makes `readLegacyMcpOwners` throw, so `migrateScopeIsolated` reports one `The <scope>-scope move stopped: ...` row on every reload until the file is fixed. This matches the plan; plan 05-04 (D-05-19) replaces it with a left-in-place row naming the file.
- The wording of both notices is a closed-catalog draft for operator review.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 05-02. Owners this plan does not move (no record, disabled, non-installable, undeclared legacy name, unreadable source) keep their `mcp.json` entries byte-unchanged and produce no row; plans 05-04 and 05-05 give them their rows. AMIG-01 and AMIG-03 stay open because sibling plans also declare them.

## Self-Check: PASSED

- FOUND: the six created files listed under key-files.created
- FOUND: commit f5686c61 is an ancestor of HEAD
- Acceptance criteria of Tasks 1-3 re-run: all pass

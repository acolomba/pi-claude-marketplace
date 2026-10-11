---
phase: 05-automatic-migration-on-reload
plan: 03
subsystem: mcp
tags: [mcp, migration, rollback, notices]
status: complete

requires:
  - phase: 05-automatic-migration-on-reload
    provides: removeLegacyMcpEntries and readLegacyMcpOwners (05-01), notifyMcpMigration and mcpConfigNoticeSections (05-01), the tool-rules-unenforced notice (05-02)
provides:
  - bridges/mcp/legacy.ts readLegacyMcpNames, leftoverNames, withoutServers
  - bridges/mcp/stage.ts the legacy sweep in prepare, commit, replace and rollback, with ordered restore (mcp.json first) and a byte-equal write skip
  - PreparedMcpStaged optional _nextDoc, _projectDoc, _legacy; McpReplacementReplaced.legacy
  - shared/notification-dispatch.ts McpLeftoverRemovedNotice and the "Old MCP server settings removed." section; migration notice is a warning when a leftover was removed
  - install-outcome, reinstall-replace and update-swap route the legacy removal's notices after the stage notices; update removes the legacy entries right after its MCP commit
  - catalog block mcp-leftover-removed, byte-locked by tests/architecture/mcp-config-notices.test.ts
  - tests/integration/mcp-legacy-sweep.test.ts
affects: [05-04, 05-05]

actuals:
  tokens: 30207
  tasks: 3
  commits: 1
plan_head_before: 704ed3de35f9ee1eeafd0a84466c8d2477355b7a
plan_head_after: 257483b667244fdd11a954f37b4c771e4e6d0d38

tech-stack:
  added: []
  patterns:
    - "A compensatable multi-file replace records each file's prior bytes just before writing it and restores in reverse write order; the restore stops at a failed mcp.json restore so a server is never in neither file"
    - "An adapter rewrite is skipped when the file already holds the bytes atomicWriteJson would write"

key-files:
  created:
    - tests/integration/mcp-legacy-sweep.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - docs/output-catalog.md
    - tests/bridges/mcp/legacy.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/types.test.ts
    - tests/bridges/mcp/index.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts
    - tests/orchestrators/plugin/reinstall-replace.test.ts
    - tests/orchestrators/plugin/update-swap.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/architecture/mcp-config-notices.test.ts

key-decisions:
  - "Update takes the MCP stage notices as soon as commitPreparedMcp returns, then appends the legacy removal's, so a removal that throws still reports the adapter rewrite it made (AFILE-04)"
  - "replacePreparedMcp records a file's prior bytes only when it actually writes it; a byte-equal skip leaves the file out of the rollback"
  - "An unparseable mcp.json gives no legacy names at prepare, so install, enable and reinstall send no left-unchanged notice for it; update calls the removal unconditionally and does send it"

patterns-established:
  - "PriorFile list: bridge-private compensation record of { filePath, bytes, legacy } kept in the replacement WeakMap"

requirements-completed: [AMIG-01, AMIG-02]

coverage:
  - id: D1
    description: "A real install whose old entry is in mcp.json writes the new mcp-adapter.json entry, empties the plugin's marked mcp.json entries, removes the old-name disable stub and direct-tools copy, keeps a user's own full server under the old name, and ends with the leftover warning"
    requirement: AMIG-02
    verification:
      - kind: integration
        ref: "tests/integration/mcp-legacy-sweep.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The leftover rule: stubs, and with panel copies full definitions with an own directTools key, under the plugin's old names in the selected map; never a full definition without directTools, a non-object, a marked entry, a new key, a foreign name or the other server map; __proto__ stays an own key"
    requirement: AMIG-01
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/legacy.test.ts#leftoverNames"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/legacy.test.ts#withoutServers"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/legacy.test.ts#readLegacyMcpNames"
        status: pass
    human_judgment: false
  - id: D3
    description: "replacePreparedMcp writes the scope's mcp-adapter.json, then the project file, then removes the legacy entries; a mid-replace failure restores earlier writes in reverse; rollbackMcpReplacement restores mcp.json first and leaves the adapter files as written when that restore fails; a byte-equal rewrite keeps the file's inode and mtime"
    requirement: AMIG-02
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#replacePreparedMcp"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#rollbackMcpReplacement"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#commitPreparedMcp"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reinstall returns the legacy notices after the stage notices; update removes the legacy entries after its MCP commit and records a removal throw as an mcp failure that keeps both entries; the install ledger restores mcp.json and mcp-adapter.json byte for byte on a later-phase failure"
    requirement: AMIG-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-replace.test.ts#AMIG-02: a completed replace carries the MCP replacement's legacy notices after the stage notices"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-swap.test.ts#AMIG-02: a legacy removal that fails records an mcp phase failure and keeps both entries"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#AMIG-02: a later-phase failure restores mcp.json and mcp-adapter.json byte for byte"
        status: pass
    human_judgment: false
  - id: D5
    description: "The leftover-removed notice renders last as 'Old MCP server settings removed.', deduplicated, control characters escaped, byte-equal to the catalog block; the migration notice is a warning when it carries one"
    requirement: AMIG-01
    verification:
      - kind: unit
        ref: "tests/architecture/mcp-config-notices.test.ts"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#AMIG-03: a leftover-removed notice makes an all-moved report a warning, its line last"
        status: pass
    human_judgment: false
  - id: D6
    description: "The leftover notice wording, and the flagged readings of D-05-10 (all removed legacy entries, not only moved ones; reported through the config-notice route) are a closed-catalog draft for operator review"
    requirement: AMIG-01
    verification: []
    human_judgment: true
    rationale: "No test can judge whether the wording reads well or whether the flagged reading matches the operator's intent"

duration: 25min
completed: 2026-10-08
---

# Phase 5 Plan 03: The mcp.json move on every staging path Summary

**Install, enable, the reconcile install, import, reinstall and update now remove a plugin's marked `mcp.json` entries after writing `mcp-adapter.json`, drop the stubs and direct-tools copies pi-mcp-adapter left under the old names (keeping a user's own full server), and roll back `mcp.json` first so no server is ever lost.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-08T14:16:31Z
- **Completed:** 2026-10-08T14:41:12Z
- **Tasks:** 3 (tracer, two TDD test tasks)
- **Files:** 18 (1 created, 17 modified)

## Accomplishments

- `legacy.ts`: `readLegacyMcpNames` (the plugin's marked keys, `[]` for an unreadable file), `leftoverNames` (the D-05-10 matching rule), `withoutServers` (a `safeSet` copy without the named servers).
- `stage.ts`: prepare reads the legacy names, drops same-scope leftovers from `_nextDoc`, builds `_projectDoc` for a user-scope stage with project stubs, and sets `_legacy`. `_nextDoc` is absent when the target file would not change. Commit writes each adapter file only when its bytes differ. Replace writes target, project file, then removes the legacy entries, restoring in reverse on failure. Rollback restores `mcp.json` first and stops if that fails.
- The `leftover-removed` notice, its section (last), the migration-notice warning rule, and the catalog block with its byte lock.
- Install's mcp phase, reinstall and update carry the legacy notices after the stage notices; update calls `removeLegacyMcpEntries` right after `commitPreparedMcp`.

## Task Commits

The plan prescribes one commit for all three tasks:

1. **Tasks 1-3: the sweep, the leftover rule, the ordered rollback, the notice, the tests and the catalog** - `257483b6` (feat)

**Plan metadata:** this SUMMARY with STATE.md and ROADMAP.md in the following docs commit.

## Verification

- Tracer verify: `npm run typecheck` and `node --test tests/integration/mcp-legacy-sweep.test.ts tests/integration/mcp-migration.test.ts`: 8/8 pass on the first run, re-run before expansion (tracer gate passed, interactive end-of-phase mode, automated-only verify).
- Task 2: owner files 262/262 pass; `npm run test:coverage:direct` for `reinstall-replace.ts`, `update-swap.ts`, `install-outcome.ts`: exit 0 (100%).
- Task 3: owner files 416/416 pass; `npm run test:coverage:direct` for `legacy.ts`, `stage.ts`, `notification-dispatch.ts`, `types.ts`, `index.ts`: exit 0 (100%).
- `TMPDIR=/var/tmp/mcp4-p5-03 npm run test:modules`: exit 0. `npm run test:architecture`: exit 0. `TMPDIR=/var/tmp/mcp4-p5-03 npm run test:integration`: exit 0. These ran before the one-line `types.test.ts` fix below; the commit hook re-ran the typecheck, the architecture suite and that pair.
- `npx fallow audit --base 704ed3de`: no issues in the 18 changed files (one inherited clone group in `notification-dispatch.ts` excluded by the gate, as in 05-01 and 05-02). The commit hook's `check:static` ran the full `npm run fallow` (dead code, rule packs including the `write-file-atomic` chokepoint, health, dupes): passed.
- `PRECOMMIT_EXIT=0` (`tmp/p5-03-precommit.log`, last line).
- Commit hook: the first `git commit` failed in `npm run check:commit` (typecheck, see deviation 3); no commit was made. After the fix, `npm run check:commit` Passed on `257483b6`. Node v26.11.0.
- Plan verification greps: no `D-05-NN` in the added lines of `extensions` and `tests`; every acceptance grep of Tasks 1-3 passes.

Focused task verification passed; full phase/PR verification pending.

## Other suites fixed

- `tests/orchestrators/plugin/reinstall-replace.test.ts`: the shared `fakeOperations` prepared result gained `notices: []` (see deviation 2).
- `tests/bridges/mcp/stage.test.ts`: the existing "atomically replaces exact previous bytes" case now expects the replaced handle's empty `legacy` member.

## Decisions Made

- Update takes the stage notices as soon as the MCP commit returns, then appends the legacy removal's notices.
- A byte-equal skip leaves that file out of the replacement's rollback record.
- The noop test is "no new key, no owned entry, no legacy name": every leftover sits under a legacy name, so this equals the plan's five-part condition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A failed update legacy removal dropped the adapter's notices**
- **Found during:** Task 2 (the update failure case)
- **Issue:** Setting `mcpConfigNotices` once, after the removal, lost the `comments-dropped` notice of the `mcp-adapter.json` rewrite that had already happened when the removal threw.
- **Fix:** The stage notices are taken right after `commitPreparedMcp`; the removal's notices are appended after it.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`
- **Commit:** 257483b6

**2. [Rule 3 - Blocking] The reinstall fake had no `notices`**
- **Found during:** Task 2
- **Issue:** `replaceReinstalledPlugin` now spreads `handles.mcp.result.notices`; the test fake's prepared result omitted it, so five existing cases threw.
- **Fix:** `notices: []` on the fake's prepared result.
- **Files modified:** `tests/orchestrators/plugin/reinstall-replace.test.ts`
- **Commit:** 257483b6

**3. [Rule 3 - Blocking] Prettier moved a `@ts-expect-error` target**
- **Found during:** Task 3 commit (`npm run check:commit`)
- **Issue:** `npm run format` wrapped a long `satisfies` expression, so the error landed on a line the directive does not cover (TS2578 plus TS1360).
- **Fix:** The literal is written as `{ ...mcpReplacementReplaced, prepared: preparedMcpNoop }` on one line. Recommitted with a new commit, never `--amend`.
- **Files modified:** `tests/bridges/mcp/types.test.ts`
- **Commit:** 257483b6

**4. [Design] `writeIfChanged` takes the `written` list**
- **Found during:** Task 1
- **Issue:** The plan named `writeIfChanged(filePath, doc)`; the replace must record a file's prior bytes before it writes, and only when it writes.
- **Fix:** `writeIfChanged(filePath, doc, written)`; `commitPreparedMcp` passes a throwaway list.
- **Commit:** 257483b6

**5. [Test design] The legacy-step failure in replace is driven two ways**
- **Found during:** Task 3
- **Issue:** With `mcp.json` behind a read-only link, the `mcp.json` restore fails too, so the replace stops there by the same rule as rollback and leaves the adapter files as written.
- **Fix:** One case swaps `mcp.json` for a directory after prepare (the removal's read fails, both adapter files are restored in reverse, the raw `EISDIR` is rethrown). A second case uses the read-only link and pins the stop rule with a `ManualRecoveryError` naming `mcp.json`.
- **Commit:** 257483b6

**6. [Docs] Migration-moved prose**
- **Found during:** Task 3
- **Issue:** The `mcp-migration-moved` prose said `info` whenever every server moved, which a leftover now changes.
- **Fix:** One clause added: `warning` when an old-name leftover was removed.
- **Files modified:** `docs/output-catalog.md`
- **Commit:** 257483b6

**Total deviations:** 6 (1 bug, 2 blocking, 1 design, 1 test design, 1 docs). **Impact:** none on the plan's contract.

## Issues Encountered

- For operator review: an unparseable `mcp.json` gives no legacy names at prepare, so install, enable, reinstall and import send no `left-unchanged` notice for it and no `_legacy` sweep runs. Update calls the removal on every commit and does report it. The plan's "unparseable never fails a staging command" holds on every path.
- A user-scope stage with legacy names whose project `mcp-adapter.json` cannot be read for a reason other than invalid content (for example a directory at that path) rejects the stage. An invalid project file is skipped silently, as planned.
- The plan's flagged assumptions stand for operator review: leftovers are removed for every legacy entry the operation removes, they are reported through the config-notice route, and a user's own full server under an old name gets no "kept" line.
- The leftover notice wording is a closed-catalog draft for operator review.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 05-04. AMIG-01 and AMIG-02 stay open while sibling plans that also declare them have no SUMMARY (`requirements.ready-ids`: 0/2 ready).

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
- FOUND: tests/integration/mcp-legacy-sweep.test.ts
- FOUND: docs/output-catalog.md
- FOUND: commit 257483b6 is an ancestor of HEAD
- Acceptance criteria of Tasks 1-3 re-run: all pass

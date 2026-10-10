---
phase: 05-automatic-migration-on-reload
plan: 04
subsystem: mcp
tags: [mcp, migration, offline, notices]
status: complete

requires:
  - phase: 05-automatic-migration-on-reload
    provides: migrateLegacyMcpEntries and notifyMcpMigration (05-01), the staging-path legacy sweep (05-03)
provides:
  - orchestrators/plugin/git-source-probe.ts makeRecordedShaPresenceProbe (fs-only, keyed on the record's resolvedSha); module-private anchorSubdir, probeMirror and probeShaClone shared with makePresenceProbe
  - bridges/mcp/legacy.ts checkMcpAdapterConfig, re-exported by the MCP barrel
  - orchestrators/reconcile/mcp-migration.ts the unowned, planned-skip, source-unreadable, collision and file-unreadable arms; private sourceLabel
  - shared/notification-dispatch.ts McpMigrationUnownedRow, McpMigrationSourceUnreadableRow, McpMigrationCollisionRow, McpMigrationFileUnreadableRow, rendered under "Left in mcp.json:"
  - catalog block mcp-migration-left-in-place, byte-locked by tests/architecture/mcp-migration-notice.test.ts
affects: [05-05]

actuals:
  tokens: 23911
  tasks: 3
  commits: 1
plan_head_before: e16f59ed8dc7d8dcb9ef7b8246d71ca4f5bfd250
plan_head_after: e878f8cd98abada0f84be63c2f671188a8f4da54

tech-stack:
  added: []
  patterns:
    - "A reload step reads the scope's reconcile plan to stay silent about owners the same reload installs, uninstalls, disables or enables"
    - "A collision source renders as a scope-and-file label or a basename, never an absolute path"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
    - extensions/pi-claude-marketplace/bridges/mcp/index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - docs/output-catalog.md
    - tests/orchestrators/plugin/git-source-probe.test.ts
    - tests/bridges/mcp/legacy.test.ts
    - tests/bridges/mcp/index.test.ts
    - tests/orchestrators/reconcile/mcp-migration.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/architecture/mcp-migration-notice.test.ts
    - tests/integration/mcp-migration.test.ts

key-decisions:
  - "The offline resolve passes the recorded-sha probe whenever the record has resolvedSha, without parsing the source first: resolveStrict calls resolveGitPluginRoot only for url, git-subdir and github sources, so a path source is unaffected"
  - "An unavailable resolve counts as source-unreadable unless narrowResolverNotes(notes) contains 'malformed mcp'; resolveOffline folds that into undefined, so the caller needs no second state check"
  - "Left rows sort by scope, then a plugin key (a stopped row's detail, '' for a file row), then the first old name; a file-unreadable row therefore leads its scope"
  - "The two presence probes share probeMirror and probeShaClone, so fallow reports no clone between them"

patterns-established:
  - "sourceLabel: the four scope files by locationsFor path, <cwd>/.mcp.json as 'project .mcp.json', any other source by basename"

requirements-completed: [AMIG-04]

coverage:
  - id: D1
    description: "A marked entry with no owning record in its scope stays byte-identical and is reported unowned; a user-scope record does not own a project entry; with no state.json the step reports it without a lock or a directory"
    requirement: AMIG-04
    verification:
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-04: an mcp.json entry with no owning install record stays and the user is warned"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-04: a record in the user scope does not own a project mcp.json entry"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-04: a legacy owner in a scope with no state.json gets its row, with no lock and nothing created"
        status: pass
    human_judgment: false
  - id: D2
    description: "An owner the same reload installs (pluginsToInstall, or pluginsToDependencyInstall on reload only) gets no row and its install sweeps the entry; an owner the plan uninstalls, disables, holds down, removes with its marketplace or enables is skipped silently"
    requirement: AMIG-04
    verification:
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-04: when claude-plugins.json declares the owner, the reload installs it and sweeps the old entry without an unowned warning"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-04: <owner> with no record here gets <n> unowned row(s) and no write"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-01: a recorded owner the plan <operation> is skipped silently"
        status: pass
    human_judgment: false
  - id: D3
    description: "A git owner moves offline from its recorded-sha clone, never the manifest sha; a cold cache, a record without resolvedSha, a missing manifest, an unlisted plugin and a throwing resolve each give one source-unreadable row and no write; a cold-cache plugin moves on the reload after its clone appears"
    requirement: AMIG-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#makeRecordedShaPresenceProbe"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-01: a git owner moves offline from its warm recorded-sha clone, never the manifest sha"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-01: a git plugin left in place on a cold clone cache moves once its recorded clone exists"
        status: pass
    human_judgment: false
  - id: D4
    description: "A full server at the new key in another source gives one collision row (key and scope-and-file label) with no write for that plugin while another owner moves; an unparseable mcp.json or mcp-adapter.json gives one file-unreadable row and no write in the scope"
    requirement: AMIG-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-01: a full server at the new key in <source> gives one collision row while another owner still moves"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-01: an mcp.json with <defect> gives one file-unreadable row without a lock or a write"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/legacy.test.ts#checkMcpAdapterConfig"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each left-in-place kind renders its remedy under 'Left in mcp.json:', sorted with the stopped rows, warning, no reload hint without a moved row, control characters escaped, byte-equal to the catalog block"
    requirement: AMIG-03
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#notifyMcpMigration"
        status: pass
      - kind: unit
        ref: "tests/architecture/mcp-migration-notice.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The left-in-place wording and the collision source label for a non-scope file (basename only, so ~/.config/mcp/mcp.json reads 'the mcp.json') are a closed-catalog draft for operator review"
    requirement: AMIG-03
    verification: []
    human_judgment: true
    rationale: "No test can judge whether the wording reads well to a user"

duration: 27min
completed: 2026-10-08
---

# Phase 5 Plan 04: Leave unmovable mcp.json entries in place with a warning Summary

**The `/reload` move now leaves every plugin entry it cannot move working under its old name and lists it in the one migration notice with its cause and remedy: no owning record in the scope, a source that cannot be read offline (git sources resolve only from the record's warm clone), a key another config source already defines, or a config file that does not parse. An owner the same reload installs, uninstalls, disables or enables gets no row.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-08T14:43:00Z
- **Completed:** 2026-10-08T15:10:00Z
- **Tasks:** 3 (tracer, two TDD test tasks)
- **Files:** 13 (all modified)

## Accomplishments

- `makeRecordedShaPresenceProbe(locations, recordedSha)`: a present mirror wins for an unpinned source; otherwise the clone keyed on the record's sha, else `not-cached`. Only `pathExists` and `readFile`; the cold-cache case asserts no directory appears.
- `checkMcpAdapterConfig(filePath)`: a missing or valid file passes; invalid JSONC, a non-object top level or a non-object server map rejects with `McpConfigFileError`.
- `migrateLegacyMcpEntries`: an `McpConfigFileError` on `mcp.json` gives a file-unreadable row before any lock; under the lock an unparseable `mcp-adapter.json` gives one and stops the scope. An owner with no record gets an unowned row unless the plan installs it. A planned uninstall, disable, dependency hold-down, marketplace removal or enable skips silently. An unreadable source gives a source-unreadable row. An `McpServerCollisionError` gives a collision row with `definedAs ?? serverName` and the source label.
- Four row types rendered under `Left in mcp.json:` with the stopped rows; the catalog block `mcp-migration-left-in-place` and its byte lock.

## Task Commits

The plan prescribes one commit for all three tasks:

1. **Tasks 1-3: the probe, the adapter check, the left-in-place arms and rows, the tests and the catalog** - `e878f8cd` (feat)

**Plan metadata:** this SUMMARY with STATE.md, ROADMAP.md, REQUIREMENTS.md and state.json in the following docs commit.

## Verification

- Tracer verify: `npm run typecheck` and `node --test tests/integration/mcp-migration.test.ts`: 7/7 pass, re-run before expansion (tracer gate passed, interactive end-of-phase mode, automated-only verify).
- Task 2: owner files pass (git-source-probe 43/43, legacy and index 56/56, mcp-migration 41/41); `npm run test:coverage:direct` for `git-source-probe.ts`, `legacy.ts`, `index.ts`, `mcp-migration.ts`: exit 0 (100%). `npx eslint --max-warnings 0` on `mcp-migration.ts`: clean (BLOCK F). The forbidden-import `rg` prints nothing.
- Task 3: notification-dispatch 249/249, catalog lock 9/9, integration 8/8; `npm run test:coverage:direct` for `notification-dispatch.ts` (with the other four): exit 0 (100%).
- `TMPDIR=/var/tmp/mcp4-p5-04 npm run test:modules`: exit 0. `npm run test:architecture`: exit 0 (after the fix below). `TMPDIR=/var/tmp/mcp4-p5-04 npm run test:integration`: exit 0. All three re-ran after the probe refactor and `npm run format`.
- `npx fallow audit --base e16f59ed`: "No issues in 13 changed files" (one inherited clone group in `notification-dispatch.ts` excluded by the gate, as in 05-01 to 05-03). `npx fallow dupes`: exit 0, no clone between the two presence probes.
- `PRECOMMIT_EXIT=0` (`tmp/p5-04-precommit.log`, last line; clean on the first pass).
- Commit hook: `npm run check:commit` Passed on `e878f8cd`. Node v26.11.0.
- Plan verification greps: no `D-05-NN` (or any `D-NN`) in the added lines of `extensions` and `tests`; every acceptance grep of Tasks 1-3 passes.

Focused task verification passed; full phase/PR verification pending.

## Other suites fixed

- `tests/architecture/scope-order-drift.test.ts` flagged the `["user", "project"]` literal in `sourceLabel`; it now iterates the canonical `SCOPES` from `shared/types.ts`. No test file changed.

## Decisions Made

- The recorded-sha probe is passed whenever `record.resolvedSha` is set, with no source parse first (see Deviations).
- `resolveOffline` returns `undefined` for every source the step cannot read, including a non-MCP `unavailable` result, so `movableOwner` writes the source-unreadable row in one place.
- `makePresenceProbe` now calls the shared `probeMirror` and `probeShaClone`; its results are unchanged (its 9 cases pass as before).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scope-order drift gate**
- **Found during:** Task 3 (`npm run test:architecture`)
- **Issue:** `sourceLabel` looped over a literal `["user", "project"]`, which the drift gate forbids outside `shared/types.ts`.
- **Fix:** `for (const scope of SCOPES)`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`
- **Commit:** e878f8cd

**2. [Rule 3 - Blocking] fallow audit warned on a clone between the two presence probes**
- **Found during:** Task 3 (`npx fallow audit`)
- **Issue:** Lifting `anchorSubdir` alone left the mirror and sha-clone reads duplicated between `makePresenceProbe` and the new probe (17 lines, a `warn` verdict that the CI audit job fails on).
- **Fix:** Two module-private helpers, `probeMirror` and `probeShaClone`, used by both probes.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts`
- **Commit:** e878f8cd

**3. [Lint] Two ESLint findings**
- **Found during:** Task 2
- **Issue:** `sonarjs/use-type-alias` on the third spelling of `UrlSource | GitSubdirSource | GitHubSource`; `switch-exhaustiveness-check` on a `default` arm in `leftRowKeys`.
- **Fix:** The new code uses `GitBackedSource`; the switch names each kind.
- **Commit:** e878f8cd

**4. [Simplicity] No `parsePluginSource` in the offline resolve**
- **Found during:** Task 2
- **Issue:** The plan parsed the source to decide whether to pass the probe. `resolveStrict` calls `resolveGitPluginRoot` only for git sources, so the parse changes nothing.
- **Fix:** `...(record.resolvedSha !== undefined && { resolveGitPluginRoot: makeRecordedShaPresenceProbe(...) })`. A git record without `resolvedSha` still resolves `unavailable` ("git source requires a clone-cache resolver"), as reinstall's does.
- **Commit:** e878f8cd

**5. [Test design] No separate "invalid entry" case**
- **Found during:** Task 2
- **Issue:** `loadMarketplaceManifest` validates each entry with the same `PLUGIN_ENTRY_SCHEMA`, so an entry that fails `PLUGIN_ENTRY_VALIDATOR.Check` after a successful load cannot be built. A bad field makes the manifest load throw, which the missing-manifest case already covers.
- **Fix:** The re-check stays as defense in depth; the throwing-manifest and unlisted-plugin cases pin the row.

**6. [Test design] The planned install integration case asserts the exact cascade notice**
- **Found during:** Task 1
- **Issue:** The plan asked that "the reconcile cascade reports the install" and no notice mentions `No plugin installed`.
- **Fix:** The case asserts the whole notification list: one cascade notice, `● hello (installed) {requires pi-mcp-adapter}` and `Reconcile: 1 success`, and nothing else.

**Total deviations:** 6 (2 blocking gate fixes, 1 lint fix, 1 simplification, 2 test-structure adjustments). **Impact:** none on the plan's contract.

## TDD Note

Tasks 2 and 3 are `tdd="true"`, but the tracer wrote the arms first and the plan prescribes one commit, so no failing-test commit precedes them. `workflow.tdd_mode` is off, so no gate applies.

## Issues Encountered

- For operator review: a collision in a non-scope source names only the file basename, so `~/.config/mcp/mcp.json` reads "is already defined in the mcp.json". This follows the plan (no absolute path), but a user may confuse it with the scope's own `mcp.json`.
- The unowned line says "owns it" for an owner with several old names.
- Owners that still skip without a row until plan 05-05: a disabled record, a source that resolves partially available, an undeclared legacy name, and a malformed MCP config.
- The wording of the four rows is a closed-catalog draft for operator review.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 05-05. AMIG-04 is marked complete: this plan is its only declarer. AMIG-01 and AMIG-03 stay open while 05-05, which also declares them, has no SUMMARY.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
- FOUND: docs/output-catalog.md (`catalog-state: mcp-migration-left-in-place`)
- FOUND: commit e878f8cd is an ancestor of HEAD
- Acceptance criteria of Tasks 1-3 re-run: all pass

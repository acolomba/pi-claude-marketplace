---
phase: 100-disabled-plugin-information-retention
plan: 02
subsystem: persistence
tags: [typescript, typebox, state-json, hooks, install-ledger, info-surface]

requires:
  - phase: 100-disabled-plugin-information-retention
    plan: "01"
    provides: "retention of the record's resources inventory on disable, which is what makes a persisted hook description worth keeping"
  - phase: 96-installation-record-backed-plugin-info
    provides: "`readStateOnlyHookEntries` and the three-arm `StateOnlyHookRead` discriminant the new branch slots into"
provides:
  - "`hookEntries`, a top-level optional install-record key carrying the supported hook entries (event + optional matcher, no handler payload)"
  - "`projectHookSummaryEntries` and `hookSummaryEntriesFromPersisted` exported from `domain/components/hooks.ts` -- one home for the hook-summary projection"
  - "population of the key at all three write sites (install, update, reinstall) and preservation through the reinstall old-record snapshot"
  - "the record-wins read ladder in `info` with the materialized-file read surviving as the legacy fallback"
affects: [disabled-plugin-info-render, list-and-info-reason-stamping]

actuals:
  tokens: 11000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "open-string persisted token narrowed to a closed render union at a single read boundary"
    - "conditional-spread optional-key writes under `exactOptionalPropertyTypes`, mirrored at every producer including the field-enumerating clone"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/persistence/state-io.test.ts
    - tests/persistence/migrate.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts

key-decisions:
  - "The update ledger's finalize is a separate function, not a closure over the parse site, so the captured entries are passed as a new parameter rather than read from an enclosing scope. The plan's phrasing assumed a shared scope; the guard placement it specified is unchanged."
  - "Update's no-hooks branch DELETES `hookEntries` rather than writing an empty array, matching install's omit-when-the-plugin-declares-no-hooks rule. Both spellings render identically today; the deletion keeps one meaning for the present-empty value (`the plugin declares no supported hooks`) instead of two."
  - "`clonePluginRecord` was exported as `__test_clonePluginRecord`. The snapshot's `hookEntries` is read by nothing today, so a dropped key would have been invisible end-to-end -- the seam is the only way to assert the preservation the plan asked for, and the file already carries four `__test_*` siblings."

patterns-established:
  - "Permissive-persist / strict-render split: the persisted `event` is an open string so a future Claude event token cannot invalidate a whole state file, and the narrowing to the renderer's closed union happens once, in `hookSummaryEntriesFromPersisted`, at the read boundary."
  - "Record-wins read ladder with the prior disk read retained as the legacy fallback -- the shape any later record key that supersedes an artifact read should copy."

requirements-completed: [ENBL-10, ENBL-11, ENBL-12]

coverage:
  - id: H1
    description: "The install record carries a top-level optional `hookEntries` key; the key set gate is amended by one insertion and no schemaVersion bump is introduced"
    requirement: ENBL-10
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the persisted install record holds exactly its inherited key set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the state schema version union is unchanged (passes unedited)"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: no manifest-snapshot or orphan field reached the install record (passes unedited)"
        status: pass
    human_judgment: false
  - id: H2
    description: "A legacy record without the key loads unchanged and the migration adds no fill"
    requirement: ENBL-10
    verification:
      - kind: unit
        ref: "tests/persistence/migrate.test.ts#D-100-01 / ENBL-10: migration adds no hookEntries fill to a legacy record"
        status: pass
    human_judgment: false
  - id: H3
    description: "Disable preserves `hookEntries`, and the reinstall old-record snapshot preserves it too"
    requirement: ENBL-10
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#D-100-01 / ENBL-10: toDisabledRecord preserves hookEntries through the disable transform"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#D-100-01 / ENBL-10: the reinstall old-record snapshot preserves hookEntries"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#D-100-01 / ENBL-10: a record with no hookEntries clones without inventing the key"
        status: pass
    human_judgment: false
  - id: H4
    description: "An install of a hooks-declaring plugin persists the supported entries -- event plus optional matcher, no handler payload"
    requirement: ENBL-11
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WR-03: installPlugin of a hooks-declaring plugin rebuilds the routing table without /reload (extended with the hookEntries assertion)"
        status: pass
      - kind: other
        ref: "PERSISTED_HOOK_ENTRY_SCHEMA declares exactly `event` and optional `matcher`; no handler/command/args/timeout/env field exists to persist"
        status: pass
    human_judgment: false
  - id: H5
    description: "`info` reads hooks from the record when the key is present, from the materialized file when it is absent, and treats a present-but-empty key as a completed read of zero entries"
    requirement: ENBL-12
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-100-03 / ENBL-12: a record carrying hookEntries renders them, not the materialized file's"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-100-03 / ENBL-12: a legacy record with no hookEntries key still reports its hooks from the materialized file"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-100-03 / ENBL-12: a present-but-empty hookEntries renders no `hooks:` line and no reason"
        status: pass
    human_judgment: false
  - id: H6
    description: "The persisted entries feed rendering only; hook routing still comes from the on-disk materialized configuration"
    requirement: ENBL-12
    verification:
      - kind: other
        ref: "grep -vE '^\\s*(//|\\*|/\\*)' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts | grep -c 'hookEntries' returns 0"
        status: pass
    human_judgment: false
  - id: H7
    description: "`list` and `info` acquire no lock, write no state and reach no network -- no backfill, no persist-on-read"
    requirement: ENBL-12
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-12 / NFR-5 zero clone-seam and credential-seam call counters (three cases, all still green)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-11
status: complete
---

# Phase 100 Plan 02: Manifest-independent hook detail Summary

**The installation record now describes a plugin's hooks itself, under a new top-level optional `hookEntries` key written by install, update and reinstall, with `info` preferring the record and the old materialized-file read surviving as the legacy fallback.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-11T15:25:00Z
- **Completed:** 2026-08-11T16:10:00Z
- **Tasks:** 3 of 3
- **Files modified:** 12

## Accomplishments

- The hook-summary projection has one home. `projectHookSummaryEntries` moved from a private declaration in the info orchestrator to `domain/components/hooks.ts`, where its input type is declared; the info orchestrator's `TOOL_EVENT_SET` and four now-unused imports went with it.
- `hookEntries` is a top-level optional record key with a two-property element schema. The persisted payload cannot carry a handler command even by accident: there is no field for one. The key follows the `resolvedSha` precedent exactly -- additive, no `schemaVersion` bump, no migrate fill -- so the COMPAT-01 version clause and the manifest-snapshot clause both pass unedited.
- The key's ABSENCE is a distinct fact from a present empty array, and both are now load-bearing. Absent routes the read to the materialized file, which is what keeps records written before this key from silently reporting "no hooks". Present-and-empty is a completed answer of zero entries.
- All three write sites populate it, and the update site does so under the existing hooks-success guard, so a failed hooks commit leaves `resources.hooks` and `hookEntries` both at version A -- the two hook facts cannot disagree about whether the swap completed.
- The read ladder reduces the traversal surface rather than adding to it. When the key is present, `composeStateOnlyComponents` composes no path and opens no file; the `assertPathInside` chokepoint on the fallback path is untouched.

## Task Commits

1. **Task 1: One home for the projection, and the record key** - `88e0559` (refactor)
2. **Task 2: Populate the key at all three write sites** - `2326555` (feat)
3. **Task 3: Record-wins read ladder** - `0d69501` (feat, TDD)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/components/hooks.ts` - `projectHookSummaryEntries` relocated here as a named export (reusing the file's existing `TOOL_EVENT_MEMBERS` set), plus the new `hookSummaryEntriesFromPersisted` narrower.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` - `PERSISTED_HOOK_ENTRY_SCHEMA`, the derived `PersistedHookEntry`, and the `hookEntries` key on `PLUGIN_INSTALL_RECORD_SCHEMA` with its absence-versus-empty and payload-boundary rules stated inline.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - the private projector deleted, the shared one imported, and the record-wins branch added above `readStateOnlyHookEntries`, which is otherwise unchanged.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - `InstallCtx.hookEntries` set in the hooks phase, spread into the record in the state phase.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - the entries captured at parse time and threaded into `finalizeUpdateRecord`, written inside the `!failedPhases.has("hooks")` guard beside the inventory slug.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - `commitHooks` returns the entries, `replaceAll` returns them alongside its replacement ledger, `updateStateRecord` writes them, `clonePluginRecord` deep-copies them, and the clone is exported as a test seam.
- `tests/architecture/compat-01-no-expansion.test.ts` - one insertion in `localeCompare` order and a rewritten assertion message naming the additive-optional rule.
- `tests/persistence/state-io.test.ts` - the disable-preservation sibling of the `resolvedSha` template.
- `tests/persistence/migrate.test.ts` - the no-fill clause against the existing `v1-missing-resources` fixture.
- `tests/orchestrators/plugin/install.test.ts` - the end-to-end write assertion on the existing hooks install test.
- `tests/orchestrators/plugin/reinstall.test.ts` - the snapshot-preservation pair.
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` - a `hookEntries` seeder option and the three read-ladder cases.

## Decisions Made

- **Update's finalize takes the entries as a parameter.** The plan described capturing them "into a local in the enclosing scope" and writing them in the finalize block. `finalizeUpdateRecord` is a sibling function, not a closure over the parse site, so the local is declared beside the phase-3a hooks try and passed as a fifth argument. The guard placement the plan specified -- inside `!failedPhases.has("hooks")`, next to the `resources.hooks` assignment -- is exactly as written.
- **The no-hooks branch deletes the key instead of writing `[]`.** When version B declares no hooks configuration, update clears the description rather than recording an empty one. Both render identically today, but the empty array already means "this plugin declares no supported hooks", and reusing it for "this plugin has no hooks configuration at all" would give one value two meanings. Install and reinstall omit the key on the same branch, so all three sites now agree.
- **The clone preservation needed a test seam.** `clonePluginRecord`'s output is read only for `version`, `resolvedSha` and `installedAt`, so dropping `hookEntries` from it would have been invisible to every end-to-end path. Rather than assert nothing, the function was exported under the file's existing `__test_*` convention and asserted directly, in both directions (a populated key survives as a deep copy; an absent key is not invented).

## Carrier findings confirmed

The plan recorded three carrier findings as things to verify rather than trust. All three held:

- **Install:** the hooks phase holds the parsed value in scope, `InstallCtx` is the established carrier (`hooksFileWritten` sits in the same phase body), and the fixed phase array puts `state` after `hooks`. No plumbing change was needed.
- **Update:** the phase-3a hooks block parses; the phase-2b finalize writes `resources.hooks` under the hooks-success guard and runs afterwards. Only the parameter noted above diverged.
- **Reinstall:** `commitHooks` returned `Promise<void>` and `resourcesFromHandles` composes the sub-object, so the entries were threaded through `replaceAll` into `updateStateRecord` and kept out of `resourcesFromHandles`, as the plan directed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing coverage] The three write sites had no end-to-end proof**

- **Found during:** Task 2
- **Issue:** The plan's Task 2 acceptance criteria are greps plus "the existing suites stay green". Neither can fail if a write site is wired to the wrong value, or to nothing. Task 3's read-ladder tests seed the record directly, so they do not cover the writers either -- the key could have shipped never actually populated by a real install.
- **Fix:** Extended the existing `WR-03` hooks install test with a `deepEqual` on the post-install record's `hookEntries`. Same fixture, same install, one added assertion; the fixture's `PreToolUse` group with an empty matcher exercises the tool-event arm and the match-all default.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts` (not in the plan's `files_modified`)
- **Verification:** `node --test tests/orchestrators/plugin/install.test.ts` -- 100 pass. The assertion compares against a literal array, so an unwritten key fails as `undefined`.
- **Committed in:** `2326555`

**2. [Rule 3 - Blocking] The snapshot assertion the plan asked for had no observable seam**

- **Found during:** Task 2
- **Issue:** The acceptance criterion requires an assertion that the old-record snapshot carries the entries. `clonePluginRecord` is private and its result is consumed only for fields unrelated to hooks, so no end-to-end reinstall assertion can distinguish a preserving clone from a dropping one.
- **Fix:** Exported it as `__test_clonePluginRecord`, following the four `__test_*` seams already in the file, and asserted both directions directly.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`, `tests/orchestrators/plugin/reinstall.test.ts`
- **Verification:** `node --test tests/orchestrators/plugin/reinstall.test.ts` green; the deep-copy clause asserts the cloned element is not the same object reference.
- **Committed in:** `2326555`

---

**Total deviations:** 2 auto-fixed (1 x Rule 2, 1 x Rule 3)
**Impact on plan:** No scope creep. Both close the gap between what Task 2's `must_haves` claim and what its stated checks could prove.

## Issues Encountered

- **Moving the projector cascaded into four dead imports.** `TOOL_EVENTS`, `ToolEvent`, `HooksConfig` and `ClaudeHookEvent` were each used only by the relocated function, so `noUnusedLocals` failed until all four import sites were pruned. The domain module already had `TOOL_EVENT_MEMBERS`, so the relocated `TOOL_EVENT_SET` was dropped rather than moved.
- **`node --test tests/architecture/` does not accept bare directories** on this Node build; the plan's verification line needs the `'tests/architecture/**/*.test.ts'` glob form to run at all. Run with globs: 1274 tests, 0 fail.

## Verification

- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npm run format:check` -- exit 0 (via `npm run check`)
- `npm test` -- 3431 tests, 3430 pass, 0 fail, 1 skipped
- `node --test 'tests/architecture/**/*.test.ts' 'tests/persistence/**/*.test.ts' 'tests/orchestrators/plugin/**/*.test.ts'` -- 1274 tests, 0 fail
- `npm run check` -- exits 1 on exactly the two known integration failures (`provenance-invisibility`, `skill-path-resolution`), both of which resolve `pi-subagents` from a stale global npm root and reproduce on unmodified `main`. Environment, not this branch.
- Acceptance greps: one `export function projectHookSummaryEntries` and one `export function hookSummaryEntriesFromPersisted` in the domain module; `hookEntries` appears 4 times in `install.ts`, 7 in `update.ts`, 11 in `reinstall.ts`; the hooks event-router source contains 0 non-comment references to the key.

## Threat Model Disposition

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-100-05 (Tampering: state-supplied record data) | mitigated | The key is validated by the same compiled typebox validator as the rest of the record -- one boundary, not a second. The element schema admits only two string fields, so no nested or unbounded structure enters, and `hookSummaryEntriesFromPersisted` is the only path from persisted data to the renderer's closed union. |
| T-100-02 (Spoofing: a fabricated entry registers a handler) | mitigated | Routing is fed by the hydrate walk over the on-disk materialized configuration and by nothing else. Asserted: `bridges/hooks/event-router.ts` contains zero non-comment references to `hookEntries`. |
| T-100-01 (Tampering: traversal at the hooks read site) | mitigated | `assertPathInside` still runs before `readFile` on the fallback path, byte-unchanged. The record-wins branch performs no path composition at all, so a present key strictly reduces the traversal surface. |
| T-100-08 (Information disclosure: handler payloads in state.json) | mitigated | `PERSISTED_HOOK_ENTRY_SCHEMA` has exactly two properties. There is no field for a command, argument, timeout or environment value, so none can be written or rendered. |
| T-100-04 (DoS: state.json growth) | accepted | Entry count is bounded by the plugin's own manifest, the same order of magnitude as the existing skills inventory. No cap added. |
| T-100-SC (Supply chain) | accepted | No package installed, no `package.json` entry added. |

## Known Stubs

None.

## Carriers into the rest of the phase

- **The disabled arm does not read `hookEntries` yet.** `composeStateOnlyComponents` is on the state-only *installed* path; the disabled arm still short-circuits before `buildBlock` (D-100-08's reroute is a later plan). Until that lands, a disabled plugin's persisted hook entries are written and preserved but never rendered. The read ladder is ready for it -- rerouting the disabled arm through `buildBlock` picks the branch up with no further change here.
- **`seedPathMarketplace` in `tests/orchestrators/plugin/info-manifest-absent.test.ts` still hard-codes empty resources on its `disabled` branch**, exactly as 100-01 flagged. This plan did not need a disabled-plus-populated record, so the ternary was left alone; the new `hookEntries` seeder option sits beside it and is independent of the `disabled` flag, so it is already usable from a disabled fixture once that ternary is dropped.

## Self-Check: PASSED

All 12 modified files exist on disk; all three task commits resolve in `git log`.

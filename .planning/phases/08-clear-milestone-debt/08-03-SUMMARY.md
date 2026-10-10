---
phase: 08-clear-milestone-debt
plan: 03
subsystem: bridges-mcp
tags: [mcp, afile-06, d-08-01, d-08-02, server-choices, mcpovr-01]

requires: []
provides:
  - "`CARRIED_FIELDS` gains `openUi` and `trace`, after `searchKeywords` (D-08-01)"
  - "`userCarriedFields(entry)` export in bridges/mcp/adapter-entry.ts"
  - "`storedChoicesFor(config, pluginName, keys)` and `withPluginServersKeepingChoices(config, pluginName, marketplaceName, entries)` exports in bridges/mcp/adapter-doc.ts"
  - "On-disk contract: top-level `_piClaudeMarketplace.serverChoices.<generated key> = { plugin, fields }` in mcp-adapter.json, moved by the one atomic write that removes or writes the entry (D-08-02, NFR-1)"
  - "An override that the user's later `/mcp-adapter enable` emptied leaves the file at unstage; a kept `{}` stub still comes back as `{}` (AFILE-06)"
affects: [08-10 adapter conformance case, 08-14 docs for the choice store, 08-21 ledger plan (closes MCPOVR-01 in BACKLOG.md)]

actuals:
  tokens: 14055
  tasks: 2
  commits: 2
plan_head_before: a12d17a40fd898c9b14478e9ba8e31d2b30c270d
plan_head_after: 00e310e7a39404ff4916ff3152193fe08dc3a8bd

tech-stack:
  added: []
  patterns:
    - "A top-level store member updated in the same document as the entry change, so one atomicWriteJson moves a value between the entry and the store"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - tests/bridges/mcp/adapter-doc.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/unstage.test.ts
    - tests/integration/mcp-override-lifecycle.test.ts

key-decisions:
  - "A store entry is `{ plugin, fields }`: only the plugin that recorded it consumes it, so a colliding generated key never carries one plugin's choice (such as `approveTools`) to another plugin (D-08-02)"
  - "Unstage picks the composer from the target file: the adapter file uses `withPluginServersKeepingChoices`, the legacy mcp.json keeps `withPluginServers`, so mcp.json never gains the member"
  - "An absorbed stub's fields win over the stored choice field by field; the plugin's own previous entry wins whole and its stale store entry is dropped in the same write"

patterns-established:
  - "The capture subtracts the keys of the override the entry writes back, using the same `writtenBackOverride` helper `survivingEntry` uses, so a choice lives in exactly one place"

requirements-completed: []

coverage:
  - id: D1
    description: "A project user's disabled and openUi choices survive uninstall then reinstall"
    requirement: "DEBT-03"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-override-lifecycle.test.ts#D-08-02: a project user's disabled and openUi choices survive uninstall then reinstall"
        status: pass
    human_judgment: false
  - id: D2
    description: "Choices survive plugin disable then enable; a second disable leaves the bytes unchanged"
    requirement: "DEBT-03"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-override-lifecycle.test.ts#D-08-02: a project user's disabled and trace choices survive plugin disable then enable"
        status: pass
    human_judgment: false
  - id: D3
    description: "An update that drops the server stores its choice; one that restores the server restores it; reinstall keeps openUi and trace"
    requirement: "DEBT-03"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-override-lifecycle.test.ts#D-08-02: an update that drops the server stores its choice and one that restores the server restores it"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-override-lifecycle.test.ts#D-08-01: a reinstall keeps the user's openUi and trace on the entry"
        status: pass
    human_judgment: false
  - id: D4
    description: "Another plugin's store entry is neither applied nor removed"
    requirement: "DEBT-03"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-override-lifecycle.test.ts#D-08-02: a choice another plugin stored under the key is neither applied nor removed by an install"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#D-08-02: another plugin's stored choice under the key is neither applied nor removed"
        status: pass
    human_judgment: false
  - id: D5
    description: "An emptied override is removed at unstage; a kept {} stub round-trips"
    requirement: "DEBT-02"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-override-lifecycle.test.ts#AFILE-06: uninstall removes an absorbed disable stub that the user's later enable emptied"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/adapter-doc.test.ts#AFILE-06: an unstage writes a kept empty stub back as an empty stub"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 03: Per-server choices outlive the plugin lifecycle Summary

**A plugin server's user choices now survive uninstall, disable and an update that drops the server. They move into a top-level `_piClaudeMarketplace.serverChoices` member of `mcp-adapter.json`, recorded with the plugin name, and come back when that plugin stages the key again. Each move is part of the one atomic write that removes or writes the entry. `openUi` and `trace` are now carried fields, and an override the user emptied is no longer written back as `{}`.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-10-10T03:34Z
- **Tasks:** 2/2
- **Files modified:** 9

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P2 IN-05 | fixed: an emptied override leaves the file; a kept `{}` stub still round-trips | 00e310e7 |
| MCPOVR-01 | ready to close (D-08-01 `fb345e31`, D-08-02 `fb345e31` and `00e310e7`); plan 08-21 closes it in BACKLOG.md | fb345e31, 00e310e7 |

## Task Commits

1. **Task 1: A project-scope choice survives uninstall then reinstall through the one adapter-file write** - `fb345e31` (feat). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.
2. **Task 2: Disable then enable, a dropped server, a foreign key and an emptied override** - `00e310e7` (fix). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.

## Verify results (final lines)

- Task 1: `node --test` over adapter-entry, adapter-doc, stage, unstage, legacy and mcp-override-lifecycle: `ℹ tests 314 / ℹ pass 314 / ℹ fail 0`. `npm run test:coverage:direct -- …/adapter-entry.ts …/adapter-doc.ts …/stage.ts …/unstage.ts` exited 0.
- Task 2: `node --test` over adapter-doc, unstage, mcp-override-lifecycle and mcp-variable-expansion: `ℹ tests 125 / ℹ pass 125 / ℹ fail 0`. `npm run test:coverage:direct -- …/adapter-doc.ts` exited 0.
- `npm run fallow` (after Task 1) exited 0. `npx fallow audit --base "$(git merge-base origin/main HEAD)"` after each task: verdict `pass`, `duplication_introduced: 0`, `complexity_introduced: 0`, `dead_code_introduced: 0`.
- Wider check after Task 1: every `tests/integration/*mcp*` file and every orchestrator, edge and integration test that names `mcp-adapter.json` (28 files, with the peer roots set): `ℹ tests 1886 / ℹ pass 1886 / ℹ fail 0`.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Integration case titles

- `D-08-02: a project user's disabled and openUi choices survive uninstall then reinstall` (Task 1)
- `D-08-02: a project user's disabled and trace choices survive plugin disable then enable` (also asserts that a second disable leaves the bytes unchanged)
- `D-08-02: an update that drops the server stores its choice and one that restores the server restores it`
- `D-08-01: a reinstall keeps the user's openUi and trace on the entry`
- `D-08-02: a choice another plugin stored under the key is neither applied nor removed by an install`
- `AFILE-06: uninstall removes an absorbed disable stub that the user's later enable emptied`

## Changed existing expectations

All in `tests/bridges/mcp/adapter-entry.test.ts`, all because `openUi` and `trace` joined the carried set (D-08-01):

- `CARRIED_KEYS` gained `openUi` and `trace`. The case `AFILE-06: of every ServerEntry key, only the carried keys take their previous values…` spreads this list, so its expected entry now carries both.
- `AFILE-06: a previous entry's credentials, env and owned fields never reach a command-only entry`: the literal entry gained `openUi: "previous-openUi"` and `trace: "previous-trace"`.
- `AFILE-05: each kept carried field takes the live value and every other field comes from the kept override`: the expected JSON gained `"openUi":"live-openUi","trace":"live-trace"`.

No other existing case changed, and no case was deleted. No existing unstage or integration case held a user carried field outside its kept override, so the capture changes none of their bytes.

## TDD evidence

The hook runs direct coverage for the staged pairs, so RED was observed locally and each task has one commit.

- Task 1 RED: the new tests run against the pre-change sources gave `ℹ pass 141 / ℹ fail 7`. The adapter-entry and adapter-doc files failed to load (missing exports). Three stage cases, the unstage case and the integration case failed on their assertions.
- Task 2 RED: the new tests run against the Task 1 `adapter-doc.ts` gave `ℹ pass 81 / ℹ fail 2`, the unit and the integration emptied-override cases. The kept `{}` case passed before and after, as intended.

## Deviations from Plan

**1. Unstage picks the composer from `target.file`, not from a `keepsChoices` flag**
- The plan names a flag as one option. The target already records which file it is, so `writeUnstageTargets` chooses `withPluginServersKeepingChoices` for `mcp-adapter.json` and `withPluginServers` for `mcp.json`. This adds no new field. A unit case asserts that the legacy file never gains the member.

**2. `writtenBackOverride` helper shared by `survivingEntry` and the capture**
- The plan asks the capture to make "the same `restorableOverride`/`restoredOverride` decision `survivingEntry` makes". One private helper now makes it for both. The IN-05 rule lives there too, so the capture and the write-back cannot drift.

**3. `previous` in stage.ts is `{ ...stored, ...ours, ...overStoredChoices(overlays, stored) }`**
- This keeps the existing precedence: an overlay still wins over an owned entry under the other server key. A stored choice applies only below an overlay, or alone. `overStoredChoices` uses one `as` cast, because `partitionServers` admits only plain-object overlays. A short comment says so.

**4. Requirements not marked complete**
- DEBT-02 and DEBT-03 cover the whole phase. Plan 08-21 owns the phase-wide verdicts, so I did not run `requirements.mark-complete`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations: T-08-07 (the capture reads only `userCarriedFields`, a CARRIED_FIELDS subset; the adapter-doc case seeds `env` and `headers` on the leaving entry and asserts that the store holds only `disabled` and `openUi`. A stored `env` is never applied, because `stampServers` copies only carried fields, and the stage case pins this). T-08-08 (consume and apply require `plugin === pluginName`; unit and integration cases). T-08-09 (the legacy target keeps `withPluginServers`; unit case). T-08-10 (a non-object member or `serverChoices` is kept as it is and nothing is captured; unit cases). The store never holds a credential value.

## Self-Check: PASSED

- All nine modified files exist, and commits fb345e31 and 00e310e7 are ancestors of HEAD.

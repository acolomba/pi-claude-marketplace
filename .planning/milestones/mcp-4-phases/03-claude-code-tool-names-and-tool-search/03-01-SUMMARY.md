---
phase: 03-claude-code-tool-names-and-tool-search
plan: 01
subsystem: mcp-bridge
tags: [mcp-bridge, naming, tool-search, adapter-entry, pi-mcp-adapter]

requires:
  - phase: 02-adapter-file-delivery
    provides: mcp-adapter.json delivery, MC-5 marker, AFILE-06 carry-forward and kept overrides
provides:
  - "generatedMcpServerKey(plugin, server) in domain/name.ts: the only copy of Claude Code's server-name normalization"
  - "Plugin MCP entries keyed plugin_<plugin>_<server>_ with owned toolPrefix \"mcp\" and directTools \"search\" (true for alwaysLoad: true)"
  - "Cascade unstage maps removed keys (or legacy raw names) back to the record's declared names"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, phase-5-rename-map, phase-6-status-join]

actuals:
  tokens: 24115
  tasks: 3
  commits: 1
plan_head_before: 9a05f6d7e2ec68a38c96b451e6a098cb9d8f8db5
plan_head_after: 07c96f65bdb6a07577d6ab21e140aa88bb51f109

tech-stack:
  added: []
  patterns:
    - "Declared server name is the identity in state.json; the adapter key is always derived with generatedMcpServerKey"
    - "Owned entry fields (directTools, toolPrefix) are rewritten on every stamped entry, after the translated fields and before the carried fields"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts

key-decisions:
  - "StagedMcpRecord.generatedName and stagedNames stay the declared server names; no declaredName field was added"
  - "Stamping warnings and override-kept notices name the generated key, because stampServers and the notice builder see the keyed server map"
  - "An alwaysLoad other than the literal true (\"true\", 1, false) writes directTools \"search\""

patterns-established:
  - "keyedServers (stage.ts): key the plugin's server map once with generatedMcpServerKey, in declared order, before the collision walk, the AS-8 test, stamping and notices"
  - "droppedMcpServers (marketplace/shared.ts): filter the record's declared names by key-or-raw-name membership in the unstage's removedNames"

requirements-completed: [ANAME-01, ANAME-04]

coverage:
  - id: D1
    description: "generatedMcpServerKey builds plugin_<plugin>_<server>_ by Claude Code's UTF-16 code-unit rule and screens only the plugin name"
    requirement: ANAME-01
    verification:
      - kind: unit
        ref: "tests/domain/name.test.ts#ANAME-01: keys acme + \"a😀b\" as plugin_acme_a__b_"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every stamped entry carries toolPrefix \"mcp\" and directTools \"search\" (true for alwaysLoad: true); plugin values never survive"
    requirement: ANAME-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#ANAME-04: alwaysLoad true gets directTools true, and the plugin's directTools and toolPrefix never survive"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#ANAME-01: install writes Claude Code server keys that the global toolPrefix cannot rename"
        status: pass
    human_judgment: false
  - id: D3
    description: "Staging writes keyed entries in declared order, idempotently, records declared names, refuses a foreign definition of the key and installs side by side with another plugin's same-named server"
    requirement: ANAME-01
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#ANAME-01: writes each server under its Claude Code key in declared order and records the declared names"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#ANAME-01: a full definition under the plugin's key in ~/.agents/mcp.json refuses and keeps the target bytes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cascade unstage reports the record's declared names for keyed and legacy raw-name entries, on success and on McpUnstagePartialError"
    requirement: ANAME-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#TR-03 / ANAME-01: cascadeUnstagePlugin maps the keys a failed legacy write still removed to declared names"
        status: pass
    human_judgment: false
  - id: D5
    description: "pi-mcp-adapter 5.0.0 turns the key plus toolPrefix mcp into mcp__plugin_<plugin>_<server>__<tool> in a live Pi session"
    requirement: ANAME-01
    verification: []
    human_judgment: true
    rationale: "Backstop truth; the formal live proof is the Phase 7 UAT (ADOC-02). No test in this plan runs the real adapter."

duration: 18min
completed: 2026-10-06
status: complete
---

# Phase 3 Plan 01: Claude Code tool names and tool search Summary

**Plugin MCP servers now land in mcp-adapter.json under Claude Code's key `plugin_<plugin>_<server>_` with `toolPrefix: "mcp"` and `directTools: "search"` pinned, built by one `generatedMcpServerKey`, while state.json keeps declared names and cascade unstage maps keys back to them**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-06T16:53:58Z
- **Completed:** 2026-10-06T17:11:31Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- `generatedMcpServerKey(plugin, server)` in `domain/name.ts` applies Claude Code's `[^A-Za-z0-9_-]` -> `_` rule (no `u` flag, so UTF-16 code units) to `plugin:<plugin>:<server>` and appends `_`. It is the only copy of the pattern under `extensions/`.
- `adapter-entry.ts` drops any plugin `directTools`/`toolPrefix` and appends the owned values after the translated fields, including on the non-object `{}` tolerance path. Key order: translated, owned, carried, marker.
- `stage.ts` keys the server map once (`keyedServers`) and uses the keys for the has-servers flag, the collision walk, the AS-8 test, stamping and override notices. Records and `stagedNames` keep the declared names.
- `cascadeUnstagePlugin` reports declared names through `droppedMcpServers` (key or raw-name match, record order) on the success path and the `McpUnstagePartialError` path.
- Every suite that reads `mcp-adapter.json` now expects keyed entries and the owned fields. Collision fixtures that relied on two plugins sharing a declared name now seed a foreign definition under the plugin's own key.

## Task Commits

The plan commits once, as Task 3 directs:

1. **Task 1: install writes plugin_hello_server1_ end to end (tracer)** - `07c96f65` (feat)
2. **Task 2: bridge owner tests and cascade name mapping (TDD)** - `07c96f65` (feat). The RED step ran before the implementation: 2 of the 3 new cascade cases failed with the keys `plugin_sample_db_`/`plugin_sample_api_` in place of `db`/`api`, and the legacy raw-name case passed. This was not committed separately because the plan requires a single commit.
3. **Task 3: remaining suites and the single commit** - `07c96f65` (feat)

**Plan metadata:** recorded in the docs commit that carries this SUMMARY.

## Verification

- Task 1: `npm run typecheck` (0 errors). `node --test tests/domain/name.test.ts` passed 112 of 112. The pattern-filtered install-flow run passed 25 of 25. The tracer gate re-ran it and it passed.
- Task 2: the four owner suites passed 278 of 278. `npm run test:coverage:direct` on the four source modules exited 0.
- Task 3: `test:modules` exit 0. `test:unpaired` exit 0. `test:integration` exit 0. `tests/e2e/install-soft-deps.test.ts` passed 8 of 8; github.com answered 200, so the precondition held.
- `PRECOMMIT_EXIT=0` (last line of `tmp/p3-01-precommit.log`).
- `npx fallow audit --base 9a05f6d7` reported no issues in the 16 changed files.
- Commit hook: `npm run check:commit` passed for `07c96f65` (Node v26.10.0).
- The decision-ID check printed nothing. No `D-03-NN` appears in the added source or test lines.
- Focused task verification passed. Full phase/PR verification is still pending: the wave gate runs `npm run check`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/name.ts`: `generatedMcpServerKey`.
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`: the owned `directTools` and `toolPrefix` fields (`withOwnedFields`).
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`: the `keyedServers` helper. Staging is keyed, and records keep declared names.
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts`: the `generatedName` and `stagedNames` docs now say "declared name".
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`: the `droppedMcpServers` mapping.
- Tests: `tests/domain/name.test.ts`, `tests/bridges/mcp/{adapter-entry,stage}.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `tests/orchestrators/plugin/{install,reinstall,update}-flow.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/integration/mcp-override-lifecycle.test.ts`, `tests/architecture/integration-materialization-gate.test.ts`, `tests/e2e/install-soft-deps.test.ts`.

Suites changed beyond `files_modified`: none.

## Decisions Made

- The record keeps declared names in `generatedName` and `stagedNames`, as the plan directs. No `declaredName` field was added.
- Stamping warnings (`mcp server "<key>": ...`) and `override-kept` notices now name the generated key. Both builders iterate the keyed map, and a user who overrides the server in the adapter writes that key. Plan 03-03 rewrites the translator and can revisit the warning text.
- An `alwaysLoad` that is not the literal `true` writes `directTools: "search"`. This is the plan's flagged assumption, pinned by the `ANAME-04: alwaysLoad ... gets directTools search` rows.

## Deviations from Plan

None. The plan was executed as written. Extra test rows beyond the plan's minimum (the non-literal `alwaysLoad` rows and the side-by-side stage case) pin the stated truths and are not scope changes. AFILE-05 self-exemption fixtures in `stage.test.ts` were moved under the plugin's key so that they still exercise the exemption.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The plans after this one (03-02 and later) can derive keys through `generatedMcpServerKey`. Plan 03-05 adds the same-plugin and `-`/`_` folded collision checks. `keyedServers` lets a second declared name that maps to the same key overwrite the first, and plan 03-05 covers that case.
- Entries written before this change still sit under declared names. A restage drops them in favor of the keyed entry, and their carried fields do not move. Phase 5 moves those entries.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/name.ts, bridges/mcp/stage.ts, bridges/mcp/adapter-entry.ts, orchestrators/marketplace/shared.ts
- FOUND: commit 07c96f65 on HEAD
- All acceptance criteria re-run: `generatedMcpServerKey` export (1 line); normalization pattern only in `domain/name.ts`; `ANAME-01` install-flow case and `plugin_hello_server1_` reseeds present; `generatedMcpServerKey` in stage.ts, shared.ts and the e2e file; `declared name` in types.ts; `plugin_` keys in the integration suite; `PRECOMMIT_EXIT=0`; HEAD subject is 60 characters.

---
*Phase: 03-claude-code-tool-names-and-tool-search*
*Completed: 2026-10-06*

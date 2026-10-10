---
phase: 03-claude-code-tool-names-and-tool-search
plan: 08
subsystem: mcp-bridge
tags: [mcp-bridge, carry-forward, user-overrides, marker]
status: complete

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "03-01 adapter keys (plugin_<plugin>_<server>_); 03-03 the closed table that writes requestTimeoutMs from timeout; 03-06 the wave this plan depends on"
provides:
  - "ClaudeMarketplaceMarker.pluginSetFields (optional names, tolerant parse) and the exported accessor pluginSetFieldsOf(value)"
  - "buildMarker(plugin, marketplace, { pluginSetFields?, keptOverride? }) with key order plugin, marketplace, pluginSetFields (non-empty only), keptOverride"
  - "inactiveOverrideFields(override, pluginSetFields); plugin-set handling in stampServers carry-forward and restoredOverride write-back"
  - "docs/output-catalog.md mcp-override-kept prose for the plugin-set rule, example keyed plugin_hello_srv_"
affects: [03-09]

actuals:
  tokens: 12040
  tasks: 3
  commits: 1
plan_head_before: 5c745bede66fa3490afc9fd25cbc60b5b06cda7e
plan_head_after: 946c85b2dc004095e2e96bfb61937a577b10f7e5

tech-stack:
  added: []
  patterns:
    - "The marker records the names of the carried fields the plugin set (never values); carry-forward, write-back and the override-kept notice all read them through pluginSetFieldsOf"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - tests/bridges/mcp/marker.test.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - tests/bridges/mcp/adapter-doc.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/integration/mcp-override-lifecycle.test.ts
    - tests/architecture/mcp-config-notices.test.ts
    - docs/output-catalog.md

key-decisions:
  - "A carried field the translated entry holds as an own property is plugin-set; under the closed table only requestTimeoutMs (from a timeout of at least one second) can be"
  - "Carry-forward skips a field that is plugin-set now; a field the previous marker lists as plugin-set is taken from that marker's kept override when it holds one, so the user's stub value applies again once a later version drops its timeout"
  - "restoredOverride restores the kept value for a field the live marker lists as plugin-set; every other carried field keeps the live-value rule"

patterns-established:
  - "buildMarker takes its optional parts as an options bag, so new marker members land without positional churn"

requirements-completed: [ANAME-07]

duration: 17min
completed: 2026-10-06
---

# Phase 3 Plan 08: Plugin-Set Carried Fields Summary

**A plugin's `timeout` now owns `requestTimeoutMs` across install, update and reinstall; the marker names the plugin-set fields (never their values), write-back hands the user their own stub value back, and the override-kept notice names the field that stopped applying.**

## Performance

- **Duration:** about 17 min
- **Started:** 2026-10-06T18:56Z
- **Completed:** 2026-10-06T19:13Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `marker.ts`: `pluginSetFields` on the marker, parsed only when it is an own array of strings (anything else parses as a marker without it, never throws). `buildMarker` takes an options bag and writes `plugin`, `marketplace`, `pluginSetFields` (non-empty only), `keptOverride`. New `pluginSetFieldsOf(value)`.
- `adapter-entry.ts`: `stampServers` computes the plugin-set names (carried-set order) from the translated entry, skips them in carry-forward, and writes them into the marker. Carry-forward also treats the previous marker's plugin-set names as the plugin's old values, so a dropped timeout leaves nothing behind.
- `restoredOverride` restores the kept override's own value for a field the live marker lists as plugin-set. `inactiveOverrideFields(override, pluginSetFields)` adds plugin-set carried fields to the inactive list, in the override's key order.
- `stage.ts`: `overrideKeptNotices` walks the stamped entries and passes each one's plugin-set names to `inactiveOverrideFields`. `adapter-doc.ts` is untouched.
- `docs/output-catalog.md` "MCP server override kept" states the plugin-set rule for carry-forward, the notice and write-back. Its example names `plugin_hello_srv_` with fields `requestTimeoutMs, env`; `tests/architecture/mcp-config-notices.test.ts` follows it.

## Task Commits

The plan asked for one commit for all three tasks (AGENTS.md Git rules), so the task work landed together:

1. **Tasks 1-3: marker field, carry-forward, write-back, notice, lifecycle test, catalog** - `946c85b2` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/mcp/marker.ts` - `pluginSetFields`, `isStringArray`, options-bag `buildMarker`, `pluginSetFieldsOf`
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts` - `pluginSetFieldsIn`, plugin-set-aware `carriedFields`, `inactiveOverrideFields`, `restoredOverride`, `stampServers`
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` - `overrideKeptNotices` reads the stamped entry's plugin-set names
- `tests/bridges/mcp/marker.test.ts` - key order, empty list, tolerant-parse rows, malformed list beside a readable kept override
- `tests/bridges/mcp/adapter-entry.test.ts` - four `stampServers` rows, two `inactiveOverrideFields` rows, two `restoredOverride` rows; the 03-03 ordering case flipped so the plugin's timeout wins
- `tests/bridges/mcp/adapter-doc.test.ts` - write-back through `withPluginServers`
- `tests/bridges/mcp/stage.test.ts` - exact bytes and the `override-kept` notice naming `requestTimeoutMs`
- `tests/orchestrators/plugin/update-flow.test.ts` - `ANAME-07: a plugin-set timeout wins over a carried override and a dropped one leaves no stale value`; the ANAME-06 case's marker now lists the field
- `tests/orchestrators/plugin/install-flow.test.ts` - expected marker on the remote server now lists `requestTimeoutMs`
- `tests/integration/mcp-override-lifecycle.test.ts` - project install over a stub, `/mcp-adapter enable`, uninstall writes back `{ "requestTimeoutMs": 5000 }`
- `tests/architecture/mcp-config-notices.test.ts`, `docs/output-catalog.md` - catalog example and its byte lock

## Verification

- Task 1: `npm run typecheck` clean; marker + adapter-entry tests pass; `TMPDIR=/var/tmp/mcp4-p3-08 node --test --test-name-pattern="^(ANAME-0|AFILE-06)" tests/orchestrators/plugin/update-flow.test.ts` pass 3 / fail 0. The tracer gate re-ran this end to end before expansion.
- Task 2 RED evidence: with the three production files temporarily swapped to their base versions, the new `ANAME-07` cases failed (8 fail, 4 pass; the passing ones are the "no plugin-set field" rows that hold under the base code). Production files were restored before continuing.
- Task 2 GREEN: adapter-entry, adapter-doc, stage and marker tests 209 pass / 0 fail; `npm run test:coverage:direct -- adapter-entry.ts marker.ts stage.ts` exit 0 (100%).
- Task 3: `TMPDIR=/var/tmp/mcp4-p3-08 npm run test:modules` exit 0 (after the install-flow fixture fix below); `npm run test:architecture` exit 0; `npm run test:integration` exit 0.
- `PRECOMMIT_EXIT=0` (last line of `tmp/p3-08-precommit.log`, clean on the first pass).
- `npx fallow audit --base 5c745bed` exit 0: "No issues in 12 changed files".
- Commit hook: `npm run check:commit` Passed on `946c85b2`.
- `git diff 5c745bed -- extensions tests | rg '^\+' | rg -c 'D-0[23]-[0-9]{2}'` printed nothing.
- Focused task verification passed; full phase/PR verification pending.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The kept stub's own timeout re-applies when a later version drops its timeout**
- **Found during:** Task 1
- **Issue:** As specified, carry-forward only skipped fields the previous marker lists as plugin-set. With a stub `{ requestTimeoutMs: 5000 }` absorbed at install under a plugin `timeout`, an update to a version without a timeout wrote no `requestTimeoutMs` at all. The later uninstall then applied the live-value rule (the field is no longer plugin-set and the live entry lacks it), so the user's 5000 was silently lost. That contradicts D-03-04 ("a user override survives for carried fields the plugin leaves unset") and D-03-05 (write-back returns the stub's own value).
- **Fix:** For a field the previous marker lists as plugin-set, `carriedFields` reads it from that marker's kept override instead of the previous entry. With no kept override (the plan's update-flow case, where the user edited the live entry), nothing is carried, as the plan requires. Pinned by `ANAME-07: the kept override's own timeout applies again once the plugin drops its timeout`; the catalog says "When a later version stops setting it, the override's own value applies again."
- **Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `tests/bridges/mcp/adapter-entry.test.ts`, `docs/output-catalog.md`
- **Commit:** `946c85b2`

**2. [Rule 3 - Blocking] An install-flow fixture outside the plan's file list pinned the old marker**
- **Found during:** Task 3 (`npm run test:modules`)
- **Issue:** `ANAME-07: install writes Claude servers through the closed adapter table` in `tests/orchestrators/plugin/install-flow.test.ts` expects the remote server's marker without `pluginSetFields`, but that server sets `timeout: 90000`.
- **Fix:** The expected bytes now list `"pluginSetFields": ["requestTimeoutMs"]` for that server. The stdio server in the same case declares `timeout: 500`, below Claude's one-second floor, so the table writes no `requestTimeoutMs` and its marker is unchanged.
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
- **Commit:** `946c85b2`

### TDD gate note

The plan asks for one commit for the whole plan, so there are no separate RED and GREEN commits. RED was shown by running the new tests against the base production files (see Verification).

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The marker holds only field names (T-03-17), and write-back restores the user's own stub value for a plugin-owned field (T-03-18).

## Next Phase Readiness

Plan 03-09 can build on `pluginSetFieldsOf` and the options-bag `buildMarker`. The marker bytes for an entry with a plugin timeout now include `pluginSetFields`, which the project-approval hash covers; a restage of the same version writes identical bytes.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/mcp/marker.ts (`export function pluginSetFieldsOf`)
- FOUND: extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts (`pluginSetFieldsOf(`)
- FOUND: tests/orchestrators/plugin/update-flow.test.ts (`ANAME-07: a plugin-set timeout wins`)
- FOUND: commit 946c85b2 is an ancestor of HEAD

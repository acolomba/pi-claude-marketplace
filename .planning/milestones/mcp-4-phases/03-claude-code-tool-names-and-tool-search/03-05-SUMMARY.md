---
phase: 03-claude-code-tool-names-and-tool-search
plan: 05
subsystem: mcp-bridge
tags: [mcp-bridge, collisions, naming]
status: complete

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "03-01 generatedMcpServerKey and the keyed server map; 03-03 the closed server table in stage.ts"
provides:
  - "McpServerKeyCollisionError (pluginName, servers, keys): two servers of one plugin whose keys are equal, or equal after folding - to _, refuse before the target config is read"
  - "foldedMcpServerKey(key) in domain/name.ts, the only - to _ fold of a server key"
  - "Folded collision walk in stage.ts: another plugin's entry, a marker-less target definition, or a full definition in any adapter source refuses when its key folds onto ours"
  - "McpServerCollisionError optional fourth argument and readonly definedAs naming the other source's own key spelling"
affects: [03-09]

actuals:
  tokens: 7244
  tasks: 2
  commits: 1
plan_head_before: 66dc393cd9791b3f62507c447537e991ce8b0047
plan_head_after: 346dd7dc0b0beb502f15da897c0be468235e9066

tech-stack:
  added: []
  patterns:
    - "Collision comparisons fold both sides with foldedMcpServerKey; the refusal carries the other side's own key"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/shared/errors-bridges.ts
    - tests/domain/name.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/shared/errors-bridges.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts

key-decisions:
  - "The same-plugin check runs in keyedServers, before readTargetConfig, so a colliding plugin refuses even over an unreadable mcp-adapter.json (the stage test uses an invalid file to prove the order)"
  - "McpServerCollisionError keeps the equal-key message byte-identical; definedAs is set and the folded message used only when the other key differs from serverName"
  - "When one source holds several spellings that fold onto ours, the refusal names whichever the precedence sort leaves last; no exact-key tie-break was added"

patterns-established:
  - "A Pi-only collision rule (license: Pi capability gap) is a fold applied to both sides of every key comparison, kept in one domain helper"

requirements-completed: [ANAME-03]

duration: 11min
completed: 2026-10-06
---

# Phase 3 Plan 05: MCP Server Key Collisions Summary

**MCP server keys that collide after Claude's normalization or after Pi's `-`/`_` fold now refuse before any write, within a plugin (`McpServerKeyCollisionError`) and against other plugins and user servers in all nine adapter sources (`McpServerCollisionError` with `definedAs`).**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-06T18:14:03Z
- **Completed:** 2026-10-06T18:25:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `keyedServers` in `bridges/mcp/stage.ts` tracks each declared server by folded key and throws `McpServerKeyCollisionError` on the second server that lands on an earlier folded key. It names the plugin, both declared servers and both keys. Equal keys get "both map to the server key"; keys that differ by `-`/`_` get the folded wording.
- `otherDeclarers` matches every walk declaration and every foreign target entry whose folded key equals ours, and returns each match's source path and its own key. The self-replace exemption applies when the plugin's own entry folds equal and no foreign one does.
- `foldedMcpServerKey` (`replaceAll("-", "_")`) in `domain/name.ts` is the only fold.
- Tests: a tracer through `runInstallLedger` (`a.b` + `a_b`: typed rejection, no `mcp-adapter.json`, no state record); stage cases for the same-plugin folded pair, cross-plugin `my-tools`/`my_tools`, a marker-less target definition, `~/.agents/mcp.json`, self-replace across spellings, and a case-only difference that does not refuse; error-class cases for both wordings and for `definedAs`.

## Task Commits

1. **Task 1 (tracer): same-key refusal end to end.** Committed together with Task 2, as the plan asks for one commit.
2. **Task 2: folded collisions.** `346dd7dc` (feat(mcp): refuse server keys that collide after normalization)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/name.ts`: `foldedMcpServerKey`.
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`: same-plugin refusal in `keyedServers`; `foldedMatches`, the folded `otherDeclarers`, and the folded self-replace check in `assertNoMcpCollisions`.
- `extensions/pi-claude-marketplace/shared/errors-bridges.ts`: `McpServerKeyCollisionError`; `McpServerCollisionError` takes an optional other key and sets `definedAs`.
- `tests/domain/name.test.ts`, `tests/bridges/mcp/stage.test.ts`, `tests/shared/errors-bridges.test.ts`, `tests/orchestrators/plugin/install-outcome.test.ts`: the ANAME-03 cases.

## Verification

- Task 1 verify: `npm run typecheck` clean; errors-bridges + stage tests 86/86; `^ANAME-03` install-outcome run 1/1.
- TDD RED: the four folded stage cases, the name test module and two error-class cases failed before the implementation (7 failures, plus type errors). GREEN: 209/209 across the three paired test modules.
- `TMPDIR=/var/tmp/mcp4-p3-05 npm run test:modules`: the first run had 1 failure in `tests/bridges/hooks/dispatch-exec.test.ts:1269` (a debug-sink diagnostic count). This plan did not touch that file. The file passed in 2 of 3 isolated reruns. The full rerun exited 0.
- `npm run test:integration`: exit 0.
- `npm run test:coverage:direct -- domain/name.ts bridges/mcp/stage.ts shared/errors-bridges.ts`: exit 0 (100% direct coverage).
- `npx fallow audit --base 66dc393c`: no issues in 7 changed files.
- `git diff <base> -- extensions tests | rg '^\+' | rg -c 'D-0[3]-[0-9]{2}'`: no matches.
- PRECOMMIT_EXIT=0 (`tmp/p3-05-precommit.log`).
- Commit hook: `npm run check:commit` Passed.
- Focused task verification passed; full phase/PR verification pending.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None. The plan was executed as written.

## Issues Encountered

- `tests/bridges/hooks/dispatch-exec.test.ts` failed once in `test:modules` and passed on reruns. The file is outside this plan's scope and was not changed.
- A class field declared as `readonly definedAs?: string` is an own property, value `undefined`, under ES2022 class fields. The error test therefore asserts `definedAs: undefined`, not that the key is absent.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-13 is mitigated: every normalized or folded clash refuses before any write and names both sides.

## Next Phase Readiness

Plan 03-09 documents the folded refusal as a Pi-only divergence (license: Pi capability gap).

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/name.ts (`export function foldedMcpServerKey`)
- FOUND: extensions/pi-claude-marketplace/shared/errors-bridges.ts (`export class McpServerKeyCollisionError`, `definedAs`)
- FOUND: commit 346dd7dc on HEAD

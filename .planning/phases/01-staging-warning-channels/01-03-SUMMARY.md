---
phase: 01-staging-warning-channels
plan: 03
subsystem: agents-bridge
status: complete
tags: [agents, agents-index, reinstall, force, nfr-10]
requires:
  - "01-01: tagged agents prepare warnings in the same source and test file"
provides:
  - "bridges/agents/stage.ts::partitionPreviousEntries keeps hand-named foreign-preserved rows under force (D-PL1-15)"
affects:
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts (commitPreparedAgents, assertAgentCommitTargets, assertForcedTargetsContained read the partition)
tech-stack:
  added: []
  patterns:
    - "Forced replacement limited to rows whose generatedName the staging produces"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - test/bridges/agents/stage.test.ts
decisions:
  - "No separate unforced-vs-forced comparison case: the rewritten forced case asserts the hand-named row's file bytes and its exact seeded index row, which is what an unforced commit keeps"
requirements: [WRN-05]
metrics:
  duration: 13m
  completed: 2026-10-27
actuals:
  tokens: 1800
  tasks: 1
  commits: 1
plan_head_before: daa716673399afa8accb4a9be4c9c976e63e36c1
plan_head_after: b6177e7c45cc824accc99f1db6af2e361a002804
---

# Phase 1 Plan 03: Keep Hand-Named Agents Index Rows on a Forced Commit Summary

A forced agents commit (reinstall's repair overwrite) now replaces a foreign-preserved `agents-index.json` row only when this staging produces its `generatedName`; a hand-named row keeps its file and its row (D-PL1-15, WRN-05).

## What changed

- `partitionPreviousEntries` (`extensions/pi-claude-marketplace/bridges/agents/stage.ts`): without `force` it is unchanged. With `force`, `replaced` is `previousEntries` plus the foreign-preserved rows whose `generatedName` is in the set of `newEntries` names, and `kept` is every other foreign-preserved row. Its doc comment now states the rule and the safe refusal when a kept row's target equals a new entry's target. No other function changed (`git show b6177e7c -- extensions/pi-claude-marketplace/bridges/agents/stage.ts` has one hunk, inside the function and its comment).
- `test/bridges/agents/stage.test.ts`:
  - The forced replace case is now "D-PL1-15: force replaces a staged row whose bytes a user changed and keeps a hand-named row with its file". It seeds a staged-name row and a `my-reviewer` row, then asserts the staged file is regenerated, the hand-named file keeps its bytes, and the whole index equals `[new current entry, hand-named row]`.
  - The NFR-10 escape case gives its escaping row the staged name `pi-claude-marketplace-acme-current` with the escaping `targetPath` unchanged, so it still asserts `PathContainmentError`, an empty agents directory, and unchanged index bytes (D-PL1-23).

## Verification

- `node --test test/bridges/agents/stage.test.ts`: 32/32 pass.
- RED check: with the old `partitionPreviousEntries` restored temporarily, the rewritten D-PL1-15 case fails (31 pass, 1 fail); the NFR-10 case passes on both, as intended.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/stage.ts`: exit 0 (100% direct coverage kept).
- ESLint on the two files, `fallow health --fail-on-issues`, `fallow dupes` and Prettier: clean.
- Commit hook: the first `git commit` attempt failed in `npm run check:commit` lint with 26 `no-unsafe-*` errors at lines ~11178-11574 of a file plan 01-02 was editing concurrently (not this plan's files); no commit was made. The retry passed every hook, `npm run check:commit` included, and created `b6177e7c`.

## Deviations from Plan

None - plan executed exactly as written. The optional extra unforced-vs-forced case was not added; the rewritten case already proves the row is left exactly as seeded.

## Known follow-up (not changed, per the plan's shared-file rule)

Two comments in `commitPreparedAgents` now describe force more broadly than the code does: its JSDoc ("the plugin's own user-edited previous agent files are replaced and their preserved index rows dropped") and the step-1 inline note ("The kept rows (foreignPreservedEntries unless forced)"). Under D-PL1-15 both apply only to rows with a staged name. The plan limited the source diff to `partitionPreviousEntries`, so they were left as is.

## Backlog dispositions

- AGIDX-01: closed by D-PL1-15, proved by the unit case "D-PL1-15: force replaces a staged row whose bytes a user changed and keeps a hand-named row with its file" in `test/bridges/agents/stage.test.ts` (unit tests only, D-PL1-19).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-05 is mitigated: forced removal is limited to staged-name rows, and every replaced row still passes `assertPathInside` (the NFR-10 case keeps a staged-name escaping row under test).

## Commits

- b6177e7c: fix(agents): keep hand-named index rows on a forced commit

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/agents/stage.ts
- FOUND: test/bridges/agents/stage.test.ts
- FOUND: b6177e7c (ancestor of HEAD)

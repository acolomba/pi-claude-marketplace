---
phase: 114-plugin-and-marketplace-lifecycle
plan: 16
subsystem: plugin-reinstall-tests
tags: [typescript, node-test, retry-safety, rollback, persistence]
requires:
  - phase: 114-12
    provides: reinstall owner coverage and prepare/replace/rollback/finalize fault fixtures
  - phase: 114-15
    provides: immutable retry-closure base and the install retry pattern
provides:
  - direct exported reinstallPlugin and reinstallPlugins retry proof across 14 material fault classes
  - semantic-equivalence matrix for reinstall retry and safe-idempotence boundaries
affects: [114-verification, plugin-lifecycle-audit]
tech-stack:
  added: []
  patterns:
    - same-root failure-then-retry through the exported reinstall entrypoints
    - filesystem-primitive observation of the prepare/replace/rollback/abort/finalize ledger
key-files:
  created:
    - .planning/phases/114-plugin-and-marketplace-lifecycle/114-16-SUMMARY.md
  modified:
    - tests/orchestrators/plugin/reinstall.test.ts
key-decisions:
  - Repair only the injected collaborator or the case-owned fault fixture; never reseed the bytes, tree, or residue the first call left.
  - Treat reinstall as a repair primitive, so a post-commit fault retries into a second successful reinstall rather than an already-installed refusal.
  - Prove the mcp and hooks commits by authoritative bytes and tree inventory, because write-file-atomic leaves no observable fs/promises signature.
  - Keep the bulk representative on reinstallPlugins with the same ordered target set and assert target-local continuation instead of inventing batch rollback.
metrics:
  duration: 1h 25m
  completed: 2026-09-01
status: complete
actuals:
  tokens: 23000
  tasks: 1
  commits: 1
---

# Phase 114 Plan 16: Plugin Reinstall Retry Closure Summary

Direct exported-entrypoint retry proof now covers reinstall's prepare, abort-leak, replacement, reverse rollback, hooks-window, persistence, config write-back, post-save cache, maintenance, and bulk-continuation states without reseeding the case-owned root.

Retry closure base: 9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3

## Performance

- **Duration:** 1h 25m
- **Started:** 2026-09-01T17:10:00Z
- **Completed:** 2026-09-01T18:35:00Z
- **Tasks:** 1
- **Files modified:** 1 test owner plus this summary

## Accomplishments

- Added 14 stable-prefix cases. Every case makes two direct, AST-visible calls to the same exported entrypoint (`reinstallPlugin` 13 times, `reinstallPlugins` once) with the same scope, mode, target or ordered target set, and case-owned root.
- Preserved first-call state, config, manifest, mcp, and agent bytes plus the complete owned-tree residue. Between calls, each case changes only its injected collaborator flag or its case-owned fault fixture.
- Proved literal prepare, replace, rollback, abort, finalize, hooks, persistence, and maintenance schedules, including newest-first abort, reverse rollback, and the WR-05 hooks window that no in-process rollback can restore.
- Preserved the existing owner suite while raising the direct TAP total to 108 cases and keeping direct reinstall coverage at 100%.

## Task Commits

1. **Task 1: Prove reinstall recovery across prepare, replace, rollback, finalize, persistence, and cleanup states** - atomic plan commit containing the owner test and this summary

## Semantic-Equivalence Matrix

Every material P114-12 fault boundary maps to exactly one row. Consolidation was allowed only where the complete first outcome, bytes, tree, residue, and second recovery schedule are semantically identical.

| Fault class / boundary                                                    | Stable title (entrypoint / mode)                                                                                                                                              | First exported outcome                                                                                                                                           | First bytes / tree / residue                                                                                                                                                   | First schedule                                                                                                               | Sole repaired fault                                                                           | Second outcome                                                                                                           | Second schedule / final state                                                                                                                      | Consolidation rationale                                                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Skills prepare; prepared set `[]`                                         | `retry proof: reinstall: skills prepare failure with no prepared handles converges on the same root` (`reinstallPlugin`, orchestrated)                                        | `failed`; ENOTDIR notes with cause chain; `reasons: [source missing]`; no `failureClass`; no notifications                                                       | State, config, and manifest bytes unchanged; old skill and command targets intact; the staging sentinel file remains                                                           | `prepare:skills`                                                                                                             | Remove only the skills-staging sentinel file                                                  | `reinstalled` v1.0.0, resources changed, no notes                                                                        | Prepare, replace, hooks removal, save, finalize, cache drop, data removal; final tree carries one skill and one prompt                             | No handle is prepared yet, so every pre-first-handle prepare fault shares this empty abort ledger.                                      |
| Commands prepare; prepared set `[skills]`                                 | `retry proof: reinstall: commands prepare failure aborts the one prepared handle and converges` (`reinstallPlugin`, orchestrated)                                             | `failed`; ENOTDIR notes; `reasons: [source missing]`; no `failureClass`; no notifications                                                                        | State and manifest bytes unchanged; old skill and command targets intact; the skills staging root is aborted clean; the commands sentinel remains                              | `prepare:skills`, `prepare:commands`, `abort:skills`                                                                         | Remove only the commands-staging sentinel file                                                | `reinstalled` v1.0.0, no notes                                                                                           | Full prepare/replace/save/finalize/maintenance schedule; final tree carries one skill and one prompt                                               | This is the unique one-prepared-handle clean-abort state; its abort ledger is non-empty but leaks nothing.                              |
| Abort cleanup leak; manual-recovery output                                | `retry proof: reinstall: an abort cleanup leak reports manual recovery and the leak survives the retry` (`reinstallPlugin`, standalone)                                       | `failed` with `failureClass: manual-recovery`, `reasons: [rollback partial]`, and one `warning` notification naming the cause and the leaked skills staging root | State bytes unchanged; the refused skills staging root and its staged skill remain on disk; the commands sentinel remains                                                      | `prepare:skills`, `prepare:commands`, `abort:skills`                                                                         | Disable only the skills staging removal refusal and remove only the commands-staging sentinel | `reinstalled` v1.0.0 with the canonical standalone success notification                                                  | Full prepare/replace/save/finalize/maintenance schedule; the leaked staging root is byte-identical to the first call and no artifact is duplicated | A manual-recovery anchor is public behavior with its own severity and leak trailer, so it cannot merge with the clean-abort row.        |
| MCP prepare; prepared set `[skills, commands, agents]`                    | `retry proof: reinstall: MCP prepare failure aborts three prepared handles newest first` (`reinstallPlugin`, orchestrated)                                                    | `failed`; EISDIR notes; no `reasons`, no `failureClass`; no notifications                                                                                        | State bytes unchanged; the old agent, skill, and command targets intact; `mcp.json` is still the fault directory                                                               | Three prepares, then `abort:agents`, `abort:commands`, `abort:skills`                                                        | Remove only the directory occupying `mcp.json`                                                | `reinstalled` with `stagedMcpServerNames: [server1]`, the generated agent name, and the agents fallback-description note | Three prepares and replaces, hooks removal, save, three finalizes, maintenance; `mcp.json` is restored to a file                                   | Only the last prepare slot can compensate three handles, and the newest-first abort order is unique to it.                              |
| Skills replacement refusal; replacement ledger `[]`                       | `retry proof: reinstall: skills replacement refusal leaves an empty replacement ledger and converges` (`reinstallPlugin`, orchestrated)                                       | `failed`; the exact non-previous-content message with cause chain; no `reasons`, no `failureClass`; no notifications                                             | State and manifest bytes unchanged; the foreign skill directory keeps its bytes; the previous skill is restored from its backup                                                | `prepare:skills`, `prepare:commands`, `replace:skills`, `rollback:skills`, `abort:commands`                                  | Remove only the foreign skill directory                                                       | `reinstalled` v1.0.0, resources changed, no notes                                                                        | Full replace schedule; the record lists both skills and the target holds the fresh skill                                                           | The bridge rolls its own partial replacement back before the ledger sees it, so nothing is ever pushed onto `replacements[]`.           |
| Commands replacement refusal; replacement ledger `[skills]`               | `retry proof: reinstall: commands replacement refusal unwinds the committed skills replacement in reverse` (`reinstallPlugin`, orchestrated)                                  | `failed`; the exact non-previous-content command message; no `failureClass`; no notifications                                                                    | State bytes unchanged; the committed skill replacement is undone back to the old bytes; the old command target and the foreign command file are intact                         | Two prepares, `replace:skills`, `replace:commands`, then `rollback:commands` before `rollback:skills`                        | Remove only the foreign command file                                                          | `reinstalled` v1.0.0, no notes                                                                                           | Full replace schedule; the record lists both prompts and the new skill and command bytes are live                                                  | A non-empty ledger forces reverse compensation across two bridges, which the empty-ledger row cannot show.                              |
| Hooks removed, then persistence failure (WR-05 window)                    | `retry proof: reinstall: a persistence failure after hooks removal leaves the unrestorable hooks window and the retry converges the record` (`reinstallPlugin`, orchestrated) | `failed`; the exact persistence message; no `failureClass`; no notifications                                                                                     | State bytes unchanged and the record still claims `resources.hooks: [hello]`, while the hooks subtree is gone from disk; the skill replacement is rolled back to the old bytes | `prepare:skills`, `replace:skills`, `remove:hooks`, `save:state`, `rollback:skills`                                          | Disable only the injected persistence refusal                                                 | `reinstalled` v1.0.0                                                                                                     | Same schedule with `finalize:skills` and maintenance; the record converges to `resources.hooks: []` and the subtree stays absent                   | The hooks write is not on the replacement ledger, so this row is the only one that leaves state and disk deliberately divergent.        |
| Persistence failure; replacement ledger `[skills, commands, agents, mcp]` | `retry proof: reinstall: a persistence failure after four committed replacements unwinds them all in reverse` (`reinstallPlugin`, orchestrated)                               | `failed`; the exact persistence message; no `failureClass` because every rollback is clean; no notifications                                                     | State, `mcp.json`, agent, skill, and command bytes are all restored to their pre-call values                                                                                   | Three prepares, three replaces, `remove:hooks`, `save:state`, then `rollback:agents`, `rollback:commands`, `rollback:skills` | Disable only the injected persistence refusal                                                 | `reinstalled` with `stagedMcpServerNames: [server1]` and the agents fallback note                                        | Same forward schedule with three finalizes and maintenance; the new agent, skill, and command bytes are live                                       | This is the deepest clean-rollback state and the only one that also restores the atomic `mcp.json` write.                               |
| Concurrent record removal before any save                                 | `retry proof: reinstall: a concurrently removed record unwinds before any save and the retry persists once` (`reinstallPlugin`, orchestrated)                                 | `failed`; the exact concurrently-removed message; no `failureClass`; no notifications                                                                            | State bytes unchanged and the skill replacement is rolled back; no persistence was attempted                                                                                   | Two prepares, two replaces, `remove:hooks`, `rollback:commands`, `rollback:skills` with no `save:state`                      | Disable only the injected removal-observing `loadState`                                       | `reinstalled` v1.0.0                                                                                                     | Same schedule with `save:state`, two finalizes, and maintenance; the marketplace still holds exactly one plugin record                             | The guard fires before the write-back and the save, so the absent `save:state` entry distinguishes it from every other persistence row. |
| Config write-back declined after a committed replacement                  | `retry proof: reinstall: an invalid config write-back is reported beside the success and the retry writes the entry` (`reinstallPlugin`, standalone)                          | `reinstalled` v1.0.0 with no notes, plus two notifications: the success row and a separate `error` row naming `claude-plugins.json`                              | The artifacts and the state record are committed; the malformed config keeps its exact bytes                                                                                   | Full prepare, replace, hooks removal, save, finalize, and maintenance schedule                                               | Remove only the malformed config fixture                                                      | `reinstalled` v1.0.0 with only the success notification                                                                  | Identical schedule and tree; the config now holds the `hello@mp` entry and `installedAt` is unchanged                                              | The write-back deferral is a success-path second row, not a failure, so it cannot merge with any failed partition.                      |
| Post-save hook-cache read failure                                         | `retry proof: reinstall: a post-save hook-cache read failure stays silent and the retry re-materializes once` (`reinstallPlugin`, orchestrated)                               | `reinstalled` v1.0.0 with `notes` absent; the failure is debug-only                                                                                              | State, hooks container, and skill tree are complete; the record carries `resources.hooks: [hello]` and the projected hook entry                                                | Three reads of the hooks source, the third refused after `tx.save()` committed                                               | Disable only the injected third-read refusal                                                  | `reinstalled` v1.0.0 with `notes` absent                                                                                 | Three more hooks reads and one more materialization; the tree is byte-identical and `installedAt` is preserved                                     | This failure is intentionally silent, so its output differs from both maintenance rows despite also being post-commit.                  |
| Completion-cache maintenance failure                                      | `retry proof: reinstall: a completion-cache maintenance failure notes the deferral and the retry clears it` (`reinstallPlugin`, orchestrated)                                 | `reinstalled` with exactly one deferred-cache warning note and `discoveryWarnings` absent                                                                        | The installed state and skill tree are complete; the plugin data directory is already removed because the data half still ran                                                  | Prepare, replace, hooks removal, save, finalize, `drop:cache` refused, `remove:data`                                         | Disable only the injected cache refusal                                                       | `reinstalled` with `notes` absent                                                                                        | Identical schedule; the tree is byte-identical and `installedAt` is preserved                                                                      | Cache eviction is optimization-only and leaves no residue, unlike the data-directory half.                                              |
| Plugin-data-dir maintenance failure                                       | `retry proof: reinstall: a plugin-data-dir maintenance failure keeps the directory and the retry removes it` (`reinstallPlugin`, orchestrated)                                | `reinstalled` with exactly one deferred-data-cleanup warning note naming the directory, and `discoveryWarnings` absent                                           | The installed state and skill tree are complete; the plugin data directory survives                                                                                            | Prepare, replace, hooks removal, save, finalize, `drop:cache`, `remove:data` refused                                         | Disable only the injected data-removal refusal                                                | `reinstalled` with `notes` absent                                                                                        | Identical schedule; the data directory is now gone and `installedAt` is preserved                                                                  | Data-directory removal is post-commit hygiene with real residue, so its warning text and tree differ from the cache row.                |
| Bulk target-local continuation                                            | `retry proof: reinstall: a bulk cascade keeps the earlier committed target and the retry reinstalls the ordered set once` (`reinstallPlugins`, marketplace target)            | `[alpha:reinstalled, beta:failed]` with one `error` cascade notification carrying both rows and the `1 failure, 1 success` tally                                 | Alpha's record and artifacts are committed; beta's record is byte-identical to its pre-call record; the foreign beta target keeps its bytes                                    | Maintenance ran for alpha only (`remove:data:alpha`)                                                                         | Remove only beta's foreign skill target                                                       | `[alpha:reinstalled, beta:reinstalled]` with one cascade notification and the `2 successes` tally                        | Maintenance ran for both targets in order; the final tree holds three skill directories with no duplicate and beta's `installedAt` is preserved    | Only the bulk entrypoint can show that a later failure never rolls back or re-mutates an earlier committed target.                      |

## Files Created or Modified

- `tests/orchestrators/plugin/reinstall.test.ts` - Added retry tree and ledger-schedule observation helpers plus 14 failure-then-retry cases.
- `.planning/phases/114-plugin-and-marketplace-lifecycle/114-16-SUMMARY.md` - Recorded the reinstall equivalence matrix and exact verification evidence.

## Decisions Made

- Observed the bridge ledger from real filesystem primitives (`mkdir`, `rename`, `rm`) rather than a production seam. The staging root, the `backup-` prefixed replacement root, the replaced target path, and the hooks plugin directory each carry an unambiguous signature.
- Asserted the mcp and hooks commits by authoritative bytes and complete tree inventory. Both bridges write through `write-file-atomic`, so neither leaves a `node:fs/promises` signature a schedule entry could read.
- Classified reinstall's post-commit faults as convergence rather than refusal. Reinstall is a repair primitive, so the correct second result after a committed first call is another successful reinstall with the same `version` and `installedAt`, not an already-installed failure.
- Kept standalone mode for the two public surfaces an orchestrated outcome cannot show: the manual-recovery row with its leak trailer, and the S5 config write-back row beside the success row.
- Left the abort leak in place across the retry. The leaked staging root is real residue the command does not clean, and the second call must neither remove it nor duplicate it.

## Deviations from Plan

None - the plan was executed within the test-owner and summary-owner boundary, with no production changes.

## Verification Results

- Owner file, required command: 108/108 cases pass, 0 failed, 0 skipped, 0 todo.
- Focused retry TAP: 14/14 cases pass, 0 failed, 0 skipped, 0 todo.
- Direct production coverage: 233/233 branches, 46/46 functions, 1609/1609 lines.
- Whole unit suite: 4732/4732 pass across 260 suites.
- TypeScript: `npm run typecheck` passes.
- ESLint: the owner file passes with no findings.
- Prettier: the owner file and this summary pass.
- Fallow: `npm run fallow` exits 0. `dead-code` reports no issues, `health` reports 0 above threshold, and the `dupes` report is byte-identical with and without this change (915 lines across 38 files in both runs), so this closure introduces no new fallow finding.
- Static prohibition scans: no focused tests, skips, todos, coverage ignores, permissive casts, `anyTimes`, production-source stubs, or uppercase AAA labels.
- Two-call audit: each of the 14 cases contains exactly two AST-visible calls to the same exported entrypoint - 13 pairs of `reinstallPlugin` and one pair of `reinstallPlugins`.
- Production diff: `git diff 9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3 -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` is empty, and so is the same diff over the whole `extensions/` tree.
- Whitespace: `git diff --check` passes for both owned files.

## Known Stubs

None.

## Threat Flags

None. This plan changes tests and planning evidence only; it adds no endpoint, authentication path, schema, or file-access surface to production.

## Self-Check: PASSED

- Both owned files exist.
- The retry base is the literal value inherited from `114-15-SUMMARY.md`, not a recaptured HEAD.
- All 14 stable-prefix cases contain two direct calls to one matching exported entrypoint.
- The existing 75 absorbed owner cases and the seven integration cases are unmoved; the three transferred reinstall authentication cases still carry their stable prefix.
- All plan verification gates pass and the production file has no diff against the inherited base.

---

_Phase: 114-plugin-and-marketplace-lifecycle_
_Completed: 2026-09-01_

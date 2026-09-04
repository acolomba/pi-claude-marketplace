---
phase: 114-plugin-and-marketplace-lifecycle
plan: 17
subsystem: plugin-uninstall-tests
tags: [typescript, node-test, retry-safety, cleanup-residue, persistence]
requires:
  - phase: 114-13
    provides: uninstall owner coverage and cascade/config/state/cleanup/containment fault fixtures
  - phase: 114-15
    provides: immutable retry-closure base and the install retry pattern
  - phase: 114-16
    provides: reinstall retry pattern and the write-file-atomic schedule-observation note
provides:
  - direct exported uninstallPlugin retry proof across 13 material fault classes
  - semantic-equivalence matrix for uninstall retry, convergence, and safe-absence boundaries
  - integrated Phase 114 closure evidence for the three pair-atomic retry plans
affects: [114-verification, plugin-lifecycle-audit]
tech-stack:
  added: []
  patterns:
    - same-root failure-then-retry through the exported uninstallPlugin entrypoint
    - filesystem-primitive observation of the cascade-to-persistence-to-cleanup ledger
key-files:
  created:
    - .planning/phases/114-plugin-and-marketplace-lifecycle/114-17-SUMMARY.md
  modified:
    - tests/orchestrators/plugin/uninstall.test.ts
key-decisions:
  - Repair only the injected filesystem refusal, the injected cascade collaborator, or the case-owned fault fixture; never reseed the bytes, tree, or residue the first call left.
  - Keep uninstall's forward-only contract intact - a retry after a committed uninstall converges or reports not installed and never invents reverse compensation.
  - Assert post-commit cleanup residue that the second already-absent pass no longer owns or traverses, rather than inventing a cleanup that the command does not perform.
  - Prove the state, config, agents-index, and mcp.json commits by authoritative bytes and complete tree inventory, because write-file-atomic uses the callback node:fs surface and leaves no node:fs/promises signature.
metrics:
  duration: 1h 40m
  completed: 2026-09-01
status: complete
actuals:
  tokens: 22000
  tasks: 1
  commits: 1
---

# Phase 114 Plan 17: Plugin Uninstall Retry Closure Summary

Direct exported-entrypoint retry proof now covers uninstall's cascade partials, agent-ownership refusals, normalized rejections, config validation and write-back, state persistence, cache and data-dir cleanup, clone garbage collection, and both containment forward points without reseeding the case-owned root.

Retry closure base: 9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3

## Performance

- **Duration:** 1h 40m
- **Started:** 2026-09-01T18:50:00Z
- **Completed:** 2026-09-01T20:30:00Z
- **Tasks:** 1
- **Files modified:** 1 test owner plus this summary

## Accomplishments

- Added 13 stable-prefix cases. Every case makes two direct, AST-visible calls to the exported `uninstallPlugin` function with the same scope, notification mode, target, and case-owned root.
- Preserved first-call state, config, agents-index, and mcp bytes plus the complete owned-tree residue. Between calls, each case changes only its injected refusal, its injected cascade collaborator, or its case-owned fault fixture.
- Proved literal cascade, config write-back, state persistence, cache-drop, data-dir, and clone-GC schedules, including the two containment forward points whose behavior is opposite to each other.
- Preserved the existing owner suite while raising the direct TAP total to 58 cases and keeping direct uninstall coverage at 100%.

## Task Commits

1. **Task 1: Prove uninstall recovery and run the final Phase 114 closure gates** - atomic plan commit containing the owner test and this summary

## Semantic-Equivalence Matrix

Every material P114-13 fault boundary maps to exactly one row. Consolidation was allowed only where the complete first outcome, bytes, tree, residue, forward schedule, mode, referencer inventory, containment behavior, and second recovery schedule are semantically identical.

| Fault class / boundary                                               | Stable title (mode)                                                                                                                   | First exported outcome                                                                                         | First bytes / tree / residue                                                                                                                           | First schedule                                                                                  | Sole repaired fault                             | Second exported outcome                                     | Second schedule / final state                                                                                                           | Consolidation rationale                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-agent cascade partial at the hooks arm; shrunken record persists | `retry proof: uninstall: a hooks cascade refusal persists the shrunken record and the retry converges` (orchestrated)                 | `failed`, `reason: permission denied`, EACCES cause, exactly the four keys `cause`/`error`/`reason`/`status`   | The record is saved shrunken to `skills: []`, `prompts: []`, `agents: []` while `hooks` and `mcpServers` survive; the hooks tree and mcp server remain | `unstage:skill`, `unstage:command`, `unstage:agent`, `unstage:hooks`, `refuse:hooks-rm`         | Disable only the injected hooks removal refusal | `uninstalled` v0.0.1                                        | `unstage:hooks`, `drop:cache`, `remove:data`, `gc:scan`; the record is gone, `mcp.json` is `{}`, and the agents index is empty          | This is the only arm that folds the partial drop into the record and then commits it, so its saved-but-failed state cannot merge with any abort arm.                |
| Agent ownership refusal (AG-5); whole record preserved, no save      | `retry proof: uninstall: foreign agent content preserves the whole record and the retry converges` (standalone)                       | One `error` notification `⊘ hello v0.0.1 (failed) {source mismatch}` naming the missing generated marker       | State and config bytes unchanged; the skill and command targets are really gone; the foreign agent file and its index row both survive                 | `unstage:skill`, `unstage:command` only - the agents bridge soft-fails instead of removing      | Remove only the foreign agent file              | One success notification with the reload trailer            | Command, agent, hooks, cache, data, and GC arms all run; the index empties and the config entry is swept                                | AG-5 rethrows to abort the save, so the record stays whole while disk has already diverged - the opposite persistence outcome from the fold arm above.              |
| Normalized non-Error cascade rejection; nothing mutated              | `retry proof: uninstall: a normalized cascade rejection mutates nothing and the retry uninstalls once` (orchestrated)                 | `failed`, `reason: unreadable`, no errno code, the transaction-normalized `Error` carrying the rejected string | State and `mcp.json` bytes unchanged; the complete seeded tree is untouched                                                                            | Empty - the collaborator rejects before any bridge runs                                         | Disable only the injected cascade rejection     | `uninstalled` v0.0.1                                        | Full cascade plus `drop:cache`, `remove:data`, `gc:scan`; `mcp.json` becomes `{}`                                                       | A rejection thrown out of the closure produces zero residue, which neither the fold arm nor the AG-5 arm can show.                                                  |
| Config validation abort (CFG-03)                                     | `retry proof: uninstall: an invalid config aborts before any mutation and the retry uninstalls` (standalone)                          | One `error` notification `{invalid manifest}` with the basename-only cause and no absolute path                | State bytes AND mtime are unchanged; the complete seeded tree is untouched                                                                             | Empty - the abort precedes the state read                                                       | Remove only the malformed config fixture        | One success notification with the reload trailer            | Full cascade plus cleanup; the absent config layer is never recreated                                                                   | The abort happens before the state read, so unlike every cascade arm it leaves both bytes and mtime untouched.                                                      |
| Config write-back refusal after the in-memory removal                | `retry proof: uninstall: a refused config write-back keeps the record and the retry deletes the entry` (standalone)                   | One `error` notification `{permission denied}` naming the injected config refusal                              | The record survives with unchanged state bytes and the config still declares `hello@mp`, while the skill, command, and hooks targets are already gone  | `unstage:skill`, `unstage:command`, `unstage:hooks`, `refuse:config-write`                      | Disable only the injected config write refusal  | One success notification with the reload trailer            | `unstage:command`, `unstage:hooks`, `drop:cache`, `remove:data`, `gc:scan`; the config keeps only `keep@mp` and the record is gone      | The write-back precedes the save, so this is the only arm that aborts with disk already swept but both authoritative files still intact.                            |
| State persistence refusal after the cascade and the config sweep     | `retry proof: uninstall: a refused state save leaves the swept config diverged and the retry converges it` (standalone)               | One `error` notification `{permission denied}` naming the injected state refusal                               | State bytes unchanged and the record still claims the plugin, while the config entry is already deleted and the artifacts are gone                     | `unstage:skill`, `unstage:command`, `unstage:hooks`, `refuse:state-write`                       | Disable only the injected state write refusal   | One success notification with the reload trailer            | Same cascade plus cleanup; the config bytes and mtime are byte-identical to the first call because the layer no longer declares the key | This is the only arm that leaves the config and the state record deliberately divergent, and the only one that proves the retry does not rewrite a converged layer. |
| Post-commit cache-drop refusal                                       | `retry proof: uninstall: a refused cache drop leaves the cache file and the retry reports not installed` (standalone)                 | One success notification - the leak is swallowed per D-19-01                                                   | The record is removed, and the plugin index cache file survives with its exact bytes                                                                   | Full cascade, `drop:cache`, `refuse:cache-unlink`, `remove:data`, `gc:scan`                     | Disable only the injected cache unlink refusal  | One `error` notification `⊘ hello (failed) {not installed}` | Empty schedule; state bytes and the complete tree are identical to the first call and the cache residue is untouched                    | Cache eviction is optimization-only and its residue is a file the already-absent pass never traverses; the data-dir and clone arms leave different residue.         |
| Post-commit data-dir removal refusal                                 | `retry proof: uninstall: a refused data-dir removal keeps the directory and the retry converges` (orchestrated)                       | `uninstalled` v0.0.1 with zero notifications                                                                   | The record is removed and the plugin data directory plus its guard file survive                                                                        | Full cascade, `drop:cache`, `remove:data`, `refuse:data-rm`, `gc:scan`                          | Disable only the injected data removal refusal  | `converged`                                                 | Empty schedule; state bytes and the complete tree are identical to the first call                                                       | Data-directory removal is post-commit hygiene with a directory residue, and the orchestrated second pass returns `converged` rather than the standalone error row.  |
| Clone-GC per-key removal refusal on the last referencer              | `retry proof: uninstall: a refused clone reclaim orphans the last-referenced clone across the retry` (standalone)                     | One success notification                                                                                       | The record is removed and the now-unreferenced clone directory and its body survive                                                                    | `unstage:hooks`, `drop:cache`, `remove:data`, `gc:scan`, `gc:remove:keySolo`, `refuse:clone-rm` | Disable only the injected clone removal refusal | One `error` notification `⊘ solo (failed) {not installed}`  | Empty schedule; the orphan clone is still on disk because the already-absent pass never reaches GC                                      | GC only reaches a per-key removal when the record was the last referencer, and uninstall never reclaims that orphan on a retry - only a later idempotent pass does. |
| Cascade refusal with a clone that a sibling record still references  | `retry proof: uninstall: a hooks refusal on a shared clone retries without reclaiming the surviving clone` (orchestrated)             | `failed`, `reason: permission denied`, EACCES cause                                                            | State bytes are unchanged because the fold rewrites an identical record; the shared clone and the sibling record are untouched                         | `unstage:hooks`, `refuse:hooks-rm`                                                              | Disable only the injected hooks removal refusal | `uninstalled` v0.0.1                                        | `unstage:hooks`, `drop:cache`, `remove:data`, `gc:scan` with NO `gc:remove`; the clone survives and only `beta` remains recorded        | Only a two-referencer inventory can show that GC derives live keys from the just-committed state and declines to reclaim a clone another record still protects.     |
| Clone-GC scan failure on the last referencer                         | `retry proof: uninstall: a clone-scan failure is swallowed and the retry converges without a scan` (orchestrated)                     | `uninstalled` v0.0.1 with zero notifications                                                                   | The record is removed and the file occupying the `plugin-clones` path survives                                                                         | `unstage:hooks`, `drop:cache`, `remove:data`, `gc:scan`                                         | Remove only the `plugin-clones` file fixture    | `converged`                                                 | Empty schedule; nothing is recreated and the clone container stays absent                                                               | The scan throw is folded by the belt-and-braces catch before GC can classify a single key, so it never reaches the per-key leak path the row above exercises.       |
| Containment refusal at the data-dir resolve point (propagates)       | `retry proof: uninstall: a refused data-dir path escape propagates after the commit and the retry reports not installed` (standalone) | The call REJECTS with the containment error and emits zero notifications                                       | The record is already removed and the config swept; the refused symlink and its outside target both survive                                            | Full cascade and `drop:cache` only - no `remove:data`, no `gc:scan`                             | Unlink only the refused data-dir symlink        | One `error` notification `⊘ hello (failed) {not installed}` | Empty schedule; the escape target is intact and the data container is left as the first call found it                                   | The `pluginDataDir` resolve sits OUTSIDE the hygiene try, so a refusal aborts the remaining cleanup and reaches the caller - the only arm that rejects.             |
| Containment refusal at the cache-file resolve point (swallowed)      | `retry proof: uninstall: a refused cache path escape is swallowed and later cleanup still runs` (orchestrated)                        | `uninstalled` v0.0.1 with zero notifications                                                                   | The record is removed, the refused `plugins` symlink and its outside target survive, and the data directory was still removed                          | Full cascade, `remove:data`, `gc:scan` with NO `drop:cache`                                     | Unlink only the refused cache-path symlink      | `converged`                                                 | Empty schedule; nothing is recreated and the escape target is intact                                                                    | The `pluginCacheFile` resolve sits INSIDE the hygiene try, so the same class of refusal is swallowed and the later cleanup arms still run - the opposite behavior.  |

### Boundaries with no retry obligation

Three uninstall arms carry no partial state and no cleanup residue, so D-15 does not obligate a second-invocation representative and none was invented:

- `marketplace-absent` and `other-scope` resolution: the loud `{not added}` row is emitted before the lock and mutates nothing. Recovering means adding the marketplace, which would reseed persistent bytes rather than repair a fault.
- PU-5 silent converge (the record is already absent): this arm IS the documented second-pass result, and it is asserted as the second outcome of six rows above.
- Concurrent marketplace-container removal: the same converge arm reached through a different pre-lock race, with the same empty residue.

## Files Created or Modified

- `tests/orchestrators/plugin/uninstall.test.ts` - Added a retry tree walker, a filesystem-primitive schedule observer with six toggleable refusal points, an Error-free outcome projection, a rejection capture helper, and 13 failure-then-retry cases.
- `.planning/phases/114-plugin-and-marketplace-lifecycle/114-17-SUMMARY.md` - Recorded the uninstall equivalence matrix and the integrated Phase 114 closure evidence.

## Decisions Made

- Observed the forward ledger from real filesystem primitives (`rm`, `unlink`, `readdir`) rather than a production seam. Each cascade target, the plugin cache file, the plugin data directory, and the clone container carry unambiguous absolute paths.
- Proved the state, config, agents-index, and `mcp.json` commits by authoritative bytes and complete tree inventory. All four route through `write-file-atomic`, which uses the callback `node:fs` surface, so none of them leaves a `node:fs/promises` signature a schedule entry could read. This follows the mechanism note Plan 114-16 recorded for the same reason.
- Refused the `mkdir` that `atomicWriteJson` issues for the config layer and for `state.json` when a case needs a deterministic write-back or persistence failure. The lock preamble mkdirs the extension root before any cascade primitive runs, so an empty ledger identifies it and only the post-cascade commit can be refused.
- Classified uninstall's post-commit faults as safe absence, not repair. Uninstall is a one-way removal, so the correct second result after a committed first call is `converged` in orchestrated mode and the `{not installed}` error row in standalone mode - never a second removal and never a reverse compensation.
- Left every post-commit residue in place across the retry. The leaked cache file, the surviving data directory, the orphaned clone, and both refused symlink targets are real residue the command does not clean, and the second call must neither remove them nor duplicate work.

## Deviations from Plan

None - the plan was executed within the test-owner and summary-owner boundary, with no production changes.

## Verification Results

### Owner-level

- Owner file, required command: **58 tests, 58 pass, 0 fail, 0 skipped, 0 todo.**
- Focused retry TAP (`--test-name-pattern='^retry proof: uninstall:'`, `--test-isolation=none`): **13 tests, 13 pass, 0 fail, 0 skipped, 0 todo** - a nonzero retry subset.
- Direct production coverage for `orchestrators/plugin/uninstall.ts`: **branches 77/77, functions 11/11, lines 718/718** (100%). The branch denominator rose from the 71/71 recorded by P114-13 because the new cases enter code ranges V8 could not previously attribute; both records are complete.
- Two-call audit: each of the 13 cases contains exactly two AST-visible calls to the exported `uninstallPlugin` function.
- Equivalence-matrix rows: **13**, one per stable-prefix case.

### Aggregate Phase 114 closure

- All 14 owner suites together: **921 tests, 921 pass, 0 fail, 0 skipped, 0 todo.**
- Fourteen-source direct coverage loop: all 14 passed at 100% - **branches 2110/2110, functions 394/394, lines 17061/17061.**
- Absorbed single-owner transfers: **exactly 75/75 pass.**
- Retained genuine integrations in their two carriers: **exactly 7/7 pass.**
- Nine architecture carriers: **50 tests across 9 files, 50 pass, 0 fail.**
- Obsolete supplemental paths: all seven confirmed absent.
- TypeScript: `npm run typecheck` passes.
- ESLint: the 14 owners and 2 integration carriers pass with no findings.
- Prettier: the 14 owners, 2 integration carriers, and the three closure summaries pass.
- Static prohibition scan over the same 16 files: no focused tests, skips, todos, coverage ignores, permissive casts, `anyTimes`, production-source stubs, or uppercase AAA labels (`rg` exits 1, no matches).
- Fallow: `npm run fallow` exits 0. `dead-code` reports no issues, `health` reports 0 above threshold, and the pre-existing `dupes` report is unchanged at `915 lines (1.4%) duplicated across 38 files` - byte-identical to the value Plan 114-16 recorded, so this closure introduces no new fallow finding.
- Whole unit suite: **4745/4745 pass across 260 suites.** Integration suite: **28/28 pass.**
- `npm run check`: passes from a clean worktree at the closure commit. Run from the working checkout it stops at the repo-wide `format:check`, which walks eight unrelated user-owned untracked JSON files (`.mcp.json` and seven `.planning/research/.cache/*.json`). Those files are not part of this plan and were left untouched, exactly as P114-13 recorded for the same condition.
- Whitespace: `git diff --check` passes for both owned files.

### Closure-wide production no-change proof

Using the literal immutable base `9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3` read from the `Retry closure base:` line of `114-15-SUMMARY.md` - never recaptured from HEAD:

- `git diff --exit-code 9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3 HEAD -- orchestrators/plugin/{install,reinstall,uninstall}.ts` is **empty**.
- `git diff --exit-code 9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3 HEAD -- extensions/` is **empty** across the whole extension tree, so Plans 114-15, 114-16, and 114-17 together changed no production byte.
- The 14 paired production sources carry no working-tree diff either.

## Verifier Handoff

The tree is frozen for a fresh canonical `gsd-verifier`. `114-VERIFICATION.md` was NOT edited by this executor; it still reports `gaps_found` at 71/75 and must be replaced by a fresh report. The verifier needs to evaluate:

1. **The grouped retry blocker** recorded at `114-VERIFICATION.md:9` - "State-changing install, reinstall, and uninstall cases prove safe retry from every material partial or cleanup state through a second exported invocation." All three owners now satisfy it.
2. **Three matrices**, one per pair: `114-15-SUMMARY.md` (install, 13 rows), `114-16-SUMMARY.md` (reinstall, 14 rows), and this file (uninstall, 13 rows). Each row names its stable case title and its first/second evidence.
3. **AST-visible paired calls** under the three stable prefixes `retry proof: install:`, `retry proof: reinstall:`, and `retry proof: uninstall:` - 13, 14, and 13 cases respectively, each with exactly two calls to one matching exported entrypoint.
4. **Canonical gates**, all recorded above: 14 owners at 921 cases, 14 direct records at 100%, 75 transfers, 7 integrations, 9 architecture carriers, type/static/format checks, the closure-wide no-production-diff against the immutable base, and the project check.
5. **MOD-07**, which P114-13 marked complete and the prior verifier held BLOCKED solely on the retry clauses of P114-10, P114-12, and P114-13.

## Known Stubs

None.

## Threat Flags

None. This plan changes tests and planning evidence only; it adds no endpoint, authentication path, schema, or file-access surface to production.

## Self-Check: PASSED

- Both owned files exist and no other file was staged.
- The retry base is the literal value inherited from `114-15-SUMMARY.md`, not a recaptured HEAD.
- All 13 stable-prefix cases contain two direct calls to the exported `uninstallPlugin` function over one persistent root, one mode, and one target.
- The existing 75 absorbed owner cases and the 7 integration cases are unmoved, and all seven obsolete supplemental paths remain absent.
- All plan verification gates pass and the production tree has no diff against the inherited base.

---

_Phase: 114-plugin-and-marketplace-lifecycle_
_Completed: 2026-09-01_

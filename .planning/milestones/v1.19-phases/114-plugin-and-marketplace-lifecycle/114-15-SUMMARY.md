---
phase: 114-plugin-and-marketplace-lifecycle
plan: 15
subsystem: plugin-install-tests
tags: [typescript, node-test, retry-safety, rollback, persistence]
requires:
  - phase: 114-10
    provides: install owner coverage and six-phase failure fixtures
provides:
  - direct exported installPlugin retry proof across 13 material fault classes
  - semantic-equivalence matrix for retry and safe-idempotence boundaries
affects: [114-verification, plugin-lifecycle-audit]
tech-stack:
  added: []
  patterns:
    - same-root failure-then-retry through the exported installPlugin entrypoint
    - test-owned filesystem schedule observation with exact tree inventories
key-files:
  created:
    - .planning/phases/114-plugin-and-marketplace-lifecycle/114-15-SUMMARY.md
  modified:
    - tests/orchestrators/plugin/install.test.ts
key-decisions:
  - Preserve the actual first-call residue and repair only the injected fault before calling installPlugin again.
  - Treat post-commit maintenance and cleanup-leak retries as safe idempotence because the first call durably installed the plugin.
  - Exercise rollback-partial and containment rendering in standalone mode and all cascade/maintenance cases in orchestrated mode.
metrics:
  duration: 1h 30m
  completed: 2026-09-01
status: complete
actuals:
  tokens: 22861
  tasks: 1
  commits: 1
---

# Phase 114 Plan 15: Plugin Install Retry Closure Summary

Direct exported-entrypoint retry proof now covers bridge rollback, containment, persistence races, disabled cascades, cleanup residue, and post-commit maintenance without reseeding the case-owned root.

Retry closure base: 9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3

## Performance

- **Duration:** 1h 30m
- **Started:** 2026-09-01T15:27:00Z
- **Completed:** 2026-09-01T16:57:38Z
- **Tasks:** 1
- **Files modified:** 1 test owner plus this summary

## Accomplishments

- Added or strengthened 13 stable-prefix cases. Every case makes two direct, AST-visible calls to the same exported `installPlugin` function with the same scope, mode, target, and case-owned root.
- Preserved first-call state/config/manifest bytes and complete owned-tree residue. Between calls, each case changes only its injected filesystem or collaborator fault.
- Proved literal prepare, commit, undo, compensation, cleanup, and maintenance schedules, including newest-first rollback and the standalone typed rollback-partial surface.
- Preserved the existing owner suite while raising the direct TAP total to 134 cases and direct install coverage to 100%.

## Task Commits

1. **Task 1: Prove deterministic install retry closure** - atomic plan commit containing the owner test and this summary

## Semantic-Equivalence Matrix

| Fault class / boundary                                         | Stable title                                                                                              | First exported outcome                                                                                   | First bytes / tree / residue                                                                                               | First schedule                                                                                                                | Sole repaired fault                                                     | Second outcome                                                      | Second schedule / final state                                                                                                                                                            | Rationale                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Skills prepare; completed set `[]`                             | `retry proof: install: skills prepare failure with no committed phases converges on the same root`        | Orchestrated `failed`; exact ENOTDIR error/cause; no notifications                                       | State and manifest bytes unchanged; staging sentinel remains; no installed resources                                       | `prepare:skills`                                                                                                              | Remove only the skills-staging sentinel file                            | Complete `installed`, resources changed, no notifications           | `prepare:skills`, `commit:skills`; one skill tree, one record, no UUID residue                                                                                                           | No prior phase exists to compensate, so all such pre-commit skills faults share this state.                                   |
| Commands prepare; completed set `[skills]`                     | `retry proof: install: commands prepare failure after a committed skill converges on the same root`       | Orchestrated `failed`; exact ENOTDIR error/cause; no notifications                                       | State and manifest bytes unchanged; empty owned skills roots plus command sentinel; committed skill removed                | `prepare:skills`, `commit:skills`, `prepare:commands`, `undo:skills`                                                          | Remove only the commands-staging sentinel file                          | Complete `installed`, resources changed, no notifications           | Skills then commands prepare/commit; exact final inventory has one skill and one prompt                                                                                                  | This is the unique one-completed-phase prepare/commit rollback state.                                                         |
| Agents prepare; completed set `[skills, commands]`             | `retry proof: install: agents prepare failure after committed commands unwinds newest first`              | Orchestrated `failed`; exact ENOTDIR error/cause; no notifications                                       | State and manifest bytes unchanged; command and skill targets absent; only empty owned roots and the agent sentinel remain | Skills commit, commands commit, agents prepare, then commands undo before skills undo                                         | Remove only the agents-staging sentinel file                            | Complete `installed`, agents declared, no notifications             | All three bridges commit; final record/tree has one agent, prompt, and skill with no UUID residue                                                                                        | Distinct because two completed phases must compensate newest-first.                                                           |
| Hooks reparse; completed set `[skills, commands, agents]`      | `retry proof: install: hooks reparse failure after three bridges retries without reseeding`               | Orchestrated `failed`; exact hooks reparse error/cause; no notifications                                 | State and manifest bytes unchanged; all three bridge targets removed; hooks target absent; empty indexes/roots remain      | Three bridge commits, hooks prepare, then agents, commands, skills undo                                                       | Disable only the malformed second hooks read                            | Complete `installed`, agents declared, no notifications             | Three bridge commits plus hooks prepare; final hooks container and hook entry are singular                                                                                               | Hooks are a JSON commit boundary rather than a staging-directory boundary, so this row is not equivalent to agents.           |
| MCP prepare; completed set `[skills, commands, agents, hooks]` | `retry proof: install: MCP prepare failure after hooks compensates every completed bridge`                | Orchestrated `failed`; exact EISDIR error/cause; no notifications                                        | State and manifest bytes unchanged; MCP directory fault remains; hooks, agent, prompt, and skill targets are absent        | Skills, commands, agents commit; MCP prepare fails; agents, commands, skills compensate; hook removal is verified in the tree | Remove only the directory occupying `mcp.json`                          | Complete `installed`, agents and MCP declared, no notifications     | All bridges commit once; final record has one hook container, MCP server, agent, prompt, and skill                                                                                       | This is the last bridge-prepare state before state commit and has a distinct hooks/MCP residue contract.                      |
| Non-containment undo failure                                   | `retry proof: install: non-containment undo failure reports ordered rollback partials then recovers`      | Standalone `failed`; exact canonical notification with `{rollback partial}`, `[skills]`, and typed cause | State/manifest bytes unchanged; the failed skills undo deliberately leaves one owned skill                                 | Skills commit, commands prepare failure, skills undo failure                                                                  | Disable only the skills-undo fault and remove only the command sentinel | Complete standalone `installed` with canonical success notification | Retry first removes the owned skill residue, then commits one skill and one prompt; no duplicates                                                                                        | A rollback partial is public behavior and cannot be consolidated with clean compensation.                                     |
| Path containment refusal                                       | `retry proof: install: containment failure preserves the refused residue and succeeds after unlink`       | Standalone `failed`; exact versioned cause notification; no rollback-partial marker                      | State/manifest bytes unchanged; refused symlink remains; staging root is empty                                             | `prepare:skills`; containment bypasses ordinary compensation                                                                  | Unlink only the fault symlink                                           | Complete standalone `installed` with canonical success notification | Skills prepare/commit; symlink is replaced by exactly one owned directory                                                                                                                | Containment propagation intentionally has different residue and rendering from non-containment undo failures.                 |
| State-commit race after staged work                            | `retry proof: install: state commit race after staged work retries from unchanged state bytes`            | Orchestrated `failed`; exact missing-fresh-record error; no notifications                                | State bytes unchanged while config records `enabled:false`; one staged skill and prompt remain                             | Skills and commands prepare/commit                                                                                            | Disable only the JSON state-record erasure fault                        | Complete `installed`, no notifications                              | Retry removes the owned skill residue before recommit; one skill/prompt record remains. Config stays disabled so normal reconcile closes the declared-vs-recorded enablement difference. | This is the partial-persistence window: artifacts/config exist while the authoritative state record did not.                  |
| Default-disabled cascade failure                               | `retry proof: install: disabled cascade failure preserves shrunken record and retry is safely idempotent` | Orchestrated `failed` with the exact MCP cleanup error; no notifications                                 | State/config bytes persist the shrunken record and `enabled:false`; hook target is absent while MCP residue remains        | MCP prepare/commit followed by failed MCP disable after the hook was removed                                                  | Disable only the targeted third MCP read fault                          | Exact already-installed failure, no notifications                   | No second mutation; state/config/tree bytes equal the first-call bytes                                                                                                                   | The first call durably recorded its partial disable. Re-entering install must not duplicate or silently rewrite that state.   |
| Ordered bridge cleanup leaks                                   | `retry proof: install: ordered bridge cleanup leaks remain explicit and retry is idempotent`              | Complete orchestrated `installed` with four exact warnings; no notifications                             | State record is complete; three UUID staging residues remain in skills, commands, agents order                             | Skills cleanup failure, commands cleanup failure, agent fallback warning, agents cleanup failure                              | Disable only the staging `rm` fault                                     | Exact already-installed failure, no notifications                   | No second mutation; complete first tree and state bytes remain identical                                                                                                                 | Cleanup warnings occur after successful bridge commits, so a second install is safely idempotent rather than a fresh install. |
| Completion-cache maintenance                                   | `retry proof: install: completion-cache maintenance failure stays installed and retry is idempotent`      | Complete orchestrated `installed` with exact deferred-cache warning; no notifications                    | Installed state/skill tree is complete; plugin data dir exists; manifest unchanged                                         | State commit, data-dir success, completion-cache failure                                                                      | Disable only the cache `unlink` fault                                   | Exact already-installed failure, no notifications                   | No maintenance replay or persistent mutation; state bytes and record remain singular                                                                                                     | Cache eviction is optimization-only and failure does not invalidate the committed install.                                    |
| Plugin-data-dir maintenance                                    | `retry proof: install: plugin-data-dir maintenance failure stays installed and retry is idempotent`       | Complete orchestrated `installed` with exact deferred-data-dir warning; no notifications                 | Installed state/skill tree is complete but the plugin data dir is absent; manifest unchanged                               | State commit, plugin-data-dir failure, cache maintenance continues                                                            | Disable only the targeted `mkdir` fault                                 | Exact already-installed failure, no notifications                   | No persistent mutation; the installed record remains singular                                                                                                                            | Data-directory creation is post-commit hygiene and has a different warning/residue from cache failure.                        |
| Post-save hook-cache maintenance                               | `retry proof: install: post-save hook-cache failure stays installed and retry is idempotent`              | Complete orchestrated `installed`; the maintenance failure is debug-only; no warnings or notifications   | State and hooks container are committed; tree/state/manifest are complete                                                  | Resolve hooks, commit hooks, fail post-save hook-cache hydration                                                              | Disable only the third hooks-read fault                                 | Exact already-installed failure, no notifications                   | No second hooks reads and no mutation; first and final state/tree bytes are identical                                                                                                    | Post-save hook-cache failure is intentionally silent and therefore not equivalent to either hygiene-warning case.             |

## Files Created or Modified

- `tests/orchestrators/plugin/install.test.ts` - Added retry tree/schedule helpers, eight new retry cases, and strengthened five existing fault cases into direct two-call proofs.
- `.planning/phases/114-plugin-and-marketplace-lifecycle/114-15-SUMMARY.md` - Recorded the retry boundary matrix and exact verification evidence.

## Decisions Made

- Used real case-owned filesystem trees and narrow Node filesystem mocks. No production seam or private ledger-only helper stands in for the exported retry path.
- Kept standalone mode for the two public notification semantics that cannot be observed from an orchestrated outcome: typed rollback partials and containment cause rendering.
- Classified post-commit failures, cleanup leaks, and the shrunken disabled record as safe-idempotence rows. Their first call already committed authoritative state, so the correct second install result is the exact already-installed failure with unchanged bytes/tree.

## Deviations from Plan

None - the plan was executed within the test-owner and summary-owner boundary, with no production changes.

## Verification Results

- Owner file, required command: 1/1 file pass, 0 failed, 0 skipped.
- Expanded owner TAP: 134/134 cases pass, 0 failed, 0 skipped.
- Focused retry TAP: 13/13 cases pass, 0 failed, 0 skipped.
- Direct production coverage: 238/238 branches, 51/51 functions, 2453/2453 lines.
- TypeScript: `npm run typecheck` passes.
- ESLint: direct owner passes with no findings.
- Prettier: test owner and summary pass.
- Static prohibition scans: no focused tests, skips, todos, coverage ignores, permissive casts, `anyTimes`, production-source stubs, or uppercase AAA labels.
- Production diff: `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` is unchanged.
- Whitespace: `git diff --check` passes for both owned files.

## Known Stubs

None.

## Threat Flags

None. This plan changes tests and planning evidence only; it adds no endpoint, authentication path, schema, or file-access surface to production.

## Self-Check: PASSED

- Both owned files exist.
- The immutable retry base is the pre-implementation 40-character SHA.
- All 13 stable-prefix cases contain two direct exported `installPlugin` calls.
- All plan verification gates pass and the production file has no diff.

---

_Phase: 114-plugin-and-marketplace-lifecycle_
_Completed: 2026-09-01_

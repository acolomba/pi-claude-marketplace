---
phase: 18-update-and-reinstall-unification
plan: 06
subsystem: orchestrators/plugin (reinstall tests)
tags: [reinstall, nfr-3, retry, unit-tests]
requires:
  - phase: 18-update-and-reinstall-unification
    provides: "reinstall on the shared runner (18-02) and the non-git reinstall pins (18-05)"
provides:
  - "Ten NFR-3 retry proofs for reinstall on the shared path, beside the one that never left"
  - "observeRetryCollaborators with an ordinal persistence fault, createRetryReinstall, retryCauseChain, CONVERGED_SCHEDULE"
affects: [18-07 git-source pins]
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: c8dea69c
plan_head_after: self # the task 2 commit, which also adds this file; a file cannot name its own hash
tech-stack:
  added: []
  patterns:
    - "a persistence fault refuses one state save by its position in the active schedule, because the shared swap writes state twice"
key-files:
  created: []
  modified:
    - test/orchestrators/plugin/reinstall-flow.test.ts
key-decisions:
  - "The bulk cascade proof fails beta by refusing the cascade's third guarded write (beta's intent mark), since a foreign directory at a new skill target no longer fails a reinstall (TR-06)"
requirements-completed: [UPR-01]
duration: 20min
completed: 2026-10-23
status: complete
---

# Phase 18 Plan 06: Reinstall retry proofs on the shared path Summary

**The ten NFR-3 retry proofs for reinstall are back, rebased onto the shared
runner: each calls the same entrypoint twice, repairs only the injected fault
between the calls, and converges on the schedule `save:state, save:state,
drop:cache, drop:cache, remove:data` (D-18-05, D-18-10). The new two-write
window is pinned: a refused finalize save leaves the commits and the
in-progress marker, and the retry clears it.**

## Proofs (original line in `9f126315:test/orchestrators/plugin/reinstall-flow.test.ts`)

| Original line | Title | What changed in its expectations |
| ------------- | ----- | -------------------------------- |
| 7405 | retry proof: reinstall: skills prepare failure with no prepared handles converges on the same root | Second schedule is the converged one; second outcome has no `resourcesChanged`. First outcome keys, `source missing`, the ENOTDIR note, the empty first schedule, and both trees are unchanged. |
| 7558 | retry proof: reinstall: commands prepare failure aborts the one prepared handle and converges | Same two changes. |
| 8014 | retry proof: reinstall: MCP prepare failure aborts three prepared handles newest first | Converged second schedule; the second outcome's `notes` is now absent, because the agents hygiene warning does not ride `notes` in direct mode (D-18-02). The runtime-errno read-back is kept. |
| 8472 | retry proof: reinstall: a refused intent-mark save changes nothing and the retry converges the record (was "a persistence failure after hooks removal leaves the unrestorable hooks window ...") | The fault refuses only save 1, the intent mark, so it lands before any commit: first schedule `["save:state"]`, the hooks subtree, its bytes, and the record's hooks inventory all unchanged. The first tree now lists `hooks/hello/hooks.json`. |
| 8600 | retry proof: reinstall: a refused finalize save after every commit fails rollback partial and the retry converges (was "a persistence failure after four committed replacements unwinds them all in reverse") | The fault refuses only save 2. First call: `failed`, notes `[<aggregate>, "mcp: state finalize failed: state persistence refused"]`, reasons `["rollback partial"]`, a `PluginUpdatePhase3Error` cause, one `mcp` rollback-partial child; new skill, command, agent, and MCP entry on disk; the record is the pre-call record with the intent-mark `compatibility` (`installable: false`, `["update-in-progress"]`). First schedule `["save:state", "save:state"]`. Retry: reinstalled in full, the record equal to the pre-call record apart from `updatedAt`, converged schedule. The bridge-operation schedule is gone with the replace path. |
| 8776 | retry proof: reinstall: a concurrently removed record fails before any write and the retry persists once | The Proxy fault is kept; the note is `Plugin "hello" was concurrently uninstalled.` with reason `concurrently uninstalled` (the swap's `PluginUpdateConcurrencyError` at its intent mark). First schedule pinned empty. |
| 8921 | retry proof: reinstall: an unreadable base layer is left unchanged by a reinstall and its retry | Both schedules converged. |
| 9194 | retry proof: reinstall: a completion-cache maintenance failure notes the deferral and the retry clears it | The failing drop runs twice per reinstall; the first outcome still carries exactly one deferral note, because the swap's own cache refresh fails silently. The data cleanup still ran (the schedule ends `remove:data`). |
| 9302 | retry proof: reinstall: a plugin-data-dir maintenance failure keeps the directory and the retry removes it | Both schedules converged. |
| 9408 | retry proof: reinstall: a bulk cascade keeps the earlier committed target and the retry reinstalls the ordered set once | The foreign-directory fault is replaced by refusing the cascade's third guarded write (beta's intent mark). Alpha reinstalled and maintained, beta's record exactly its pre-call record, beta's row still `(failed) {unreadable}` in the same cascade text; the retry reinstalls both in order. The `beta-extra` skill fixture went with the old fault, so the trees and beta's final skills list lost it. |

The proof that never left, "retry proof: reinstall: a post-save hook-cache
read failure stays silent and the retry re-materializes once", still passes
beside them.

## Helpers

- `observeRetryCollaborators(schedule, faults?, loadStateOverride?)`: the
  original, plus `faults.persistence.ordinal`, which refuses only the save at
  that position in the active schedule (without it every save is refused).
- `createRetryReinstall(schedule)`: `createReinstallPlugin(hooksRouting,
  completionCache)` with a completion cache whose drops record `drop:cache`.
- `retryCauseChain(message)` as before, and `CONVERGED_SCHEDULE`.

The NFR-3 banner now says the proofs repair only the injected fault between
the two calls and that the schedule records state writes, cache drops, and the
data removal, with bridge commits proven by bytes and the tree inventory.

## Verification

- Task 1: the reinstall-flow pair at 100% direct coverage; the five new titles
  and the kept proof once each; `createRetryReinstall` once. Commit hook
  `check:commit` passed.
- Task 2: direct coverage 100%; all eleven retry titles once each;
  `npx fallow dupes --quiet --fail-on-issues` exit 0; `npx tsc --noEmit`
  clean.
- Plan gate: `npm run check` exit 0 on the final tree (Node v26.12.1), run
  with exactly the files the task 2 commit stages: static checks, unpaired
  tests, integration, 718/718 cucumber scenarios, direct coverage for all
  pairs (279 records merged).

## Deviations from Plan

1. **The finalize proof's MCP assertion** compares the parsed adapter entry in
   full instead of matching "new" bytes: the fixture's MCP definition is the
   same before and after, so its committed form is the meaningful value.
2. **The finalize-failure child is attributed to `mcp`.** The swap reports a
   refused finalize as a phase-3 failure against its last bridge
   (`mcp: state finalize failed: ...`). The proof pins that as measured.

## Needs the user's attention

- A refused finalize save renders as a `rollback partial` child named `mcp`,
  although no MCP commit failed. The text after the colon names the real
  cause, so the row is not wrong, but the phase label can mislead. This is the
  shared swap's existing labeling, outside this plan's files.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: test/orchestrators/plugin/reinstall-flow.test.ts (contains "retry proof: reinstall: a refused finalize save after every commit fails rollback partial and the retry converges")
- FOUND: c3888eec (task 1); task 2 is the commit that adds this file

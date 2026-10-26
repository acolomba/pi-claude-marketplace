---
phase: 18-update-and-reinstall-unification
plan: 02
subsystem: orchestrators/plugin (reinstall, update)
tags: [reinstall, update, materialization, constraint-gate, backfill]
requires:
  - phase: 18-update-and-reinstall-unification
    provides: "materializeLatestVersion(args, policy) and its three-knob MaterializationPolicy (18-01)"
provides:
  - "reinstall materializes through materializeLatestVersion with REINSTALL_MATERIALIZATION { refreshSource: false, skipSameRevision: false, overwrite: true } and partial: true"
  - "reinstallOutcomeFromRun(target, run, phaseFailure): the projection of the shared runner's outcome onto reinstall's"
  - "the constraint gate's declaration walk fails closed with DependencyDeclarationsUnreadableError for update (direct and autoupdate) and reinstall (D-18-17)"
  - "ReinstallSkippedOutcome.reasons and ReinstallFailedOutcome.rollbackPartial; resourcesChanged is gone from the reinstalled outcome"
affects: [18-03 scenarios, 18-04 deletion of the reinstall replace machinery, 18-05..18-07 test re-adds]
actuals:
  tokens: 76459
  tasks: 3
  commits: 3
plan_head_before: bee2e52f1550ccde685f93f40b305163f4f863a5
plan_head_after: self # the task 3 commit, which also adds this file; a file cannot name its own hash
tech-stack:
  added: []
  patterns:
    - "reinstall keeps only target selection, skips, the layer refusal, maintenance, and messaging; the shared runner owns materialization"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - docs/dependency-resolution.md
  deleted:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
    - test/orchestrators/plugin/reinstall-clone-probe.test.ts
key-decisions:
  - "An unreadable dependency walk is a failure, not a hold: the gate throws DependencyDeclarationsUnreadableError and every surface renders (failed) {unreadable} with the walk's cause line (D-18-17)"
  - "Reinstall's skipped row is a PluginUpdateSkippedMessage, so a dependents constrain skip carries the holders on its cause line as update's row does (D-18-07)"
  - "Reinstall reads state without a lock and leaves locking to the shared swap's intent-mark and finalize guards (D-18-10)"
requirements-completed: [REI-04, UPR-01]
duration: 65min
completed: 2026-10-23
status: complete
---

# Phase 18 Plan 02: Reinstall on the shared runner Summary

**`reinstall` now runs `materializeLatestVersion` under its own policy, so it
installs, records, and reports the version the marketplace offers now
(REI-04), through the same code path as `update` (UPR-01). An unreadable
dependency walk fails both verbs closed as `{unreadable}` (D-18-17).**

## What changed

- **Task 1 (D-18-17).** `evaluateUpdateConstraint` throws
  `DependencyDeclarationsUnreadableError(declarer, walkMessage)` when the
  declaration walk cannot read a record; `held` now means a real range hold
  only. The autoupdate cascade (`updateSinglePluginWith`) maps it to
  `["unreadable"]` and carries it as the outcome's `cause`; the direct path
  already mapped it. The user guide says the update or reinstall fails, changes
  nothing, and names the plugin.
- **Task 2.** `resourcesChanged` is gone from `ReinstallReinstalledOutcome`.
  `ReinstallSkippedOutcome.reasons` (typed skips) and
  `ReinstallFailedOutcome.rollbackPartial` (one child per failed bridge) are
  new. `reinstallReasonsFromError` reads through `CleanupContextError`, maps the
  two concurrency kinds, and uses a file-private class mapper plus an errno
  lookup table (structurally unlike update's `reasonsFromTypedError`, so fallow
  dupes stays clean). The failed outcome carries the unwrapped primary as
  `cause` for a layer refusal, a held lock, or an unreadable walk. The
  messaging skipped arm renders typed reasons and, for `dependents constrain`,
  the holders as the cause line; the failed arm renders the rollback-partial
  children. Hooks-lifecycle Block C, the `HOOKS_LIFECYCLE_TARGETS` reinstall
  entry, and the `replaceOperations` classified seam are gone.
- **Task 3.** `reinstall-flow.ts` reads state with no lock, skips `not
  installed` / `already disabled`, runs the layer refusal, then calls
  `materializeLatestVersion({ ...opts, locations, hooksRouting,
  completionCache, env, cascade: false, cardinality: "single", partial: true,
  cleanupClones: garbageCollectPluginClones, notifyPhaseFailure },
  REINSTALL_MATERIALIZATION)`. `notifyPhaseFailure` only captures. The result
  maps through `reinstallOutcomeFromRun`. A throw goes to
  `rethrowInvalidGitHubBaseUrl` (D-18-16) and then `failReinstall`, which
  renders through `renderReinstallPartitionAndNotify`. The flow reads only
  `transaction.runPostSuccessMaintenance`; `createReinstallPlugin` keeps its
  `ReinstallTransaction` parameter until Plan 04. `reinstall-clone-probe.ts`,
  its test, and `clonePluginRecord` are deleted. Backfill comments cite
  D-18-08 / D-18-12 / D-18-07 / D-18-17. `reinstall-flow.ts` left
  `MANIFEST_LOOKUP_TARGETS`.

## Verification

- Task 1: direct coverage 100% for `update-constraint-gate.ts`,
  `update-flow.ts`, `update-preflight.ts`; `features/plugin/update.feature`,
  `features/marketplace/update.feature`, `features/plugin/reconcile.feature`
  117/117. No scenario pinned the old hold for an unreadable walk. Commit hook
  `check:commit` passed.
- Task 2: direct coverage 100% for `reinstall-record.ts`,
  `reinstall.messaging.ts`, `reinstall-flow.ts`, `types.ts`;
  `npm run test:architecture` green; `plugin-layer-verbs` integration 16/16;
  `npx tsc --noEmit` clean; `fallow dupes` and `fallow health --complexity`
  exit 0. The first commit attempt failed the hook on
  `@typescript-eslint/switch-exhaustiveness-check` (an errno `switch` over
  `string | undefined`); the lookup table replaced it and the hook passed.
- Task 3: direct coverage 100% for `reinstall-flow.ts`, `reinstall-record.ts`,
  `backfill.ts`, `state-io.ts`, `install-outcome.ts`, `plugin-resolver.ts`,
  `git-source-probe.ts`; edge `reinstall.test.ts` green; architecture suite
  green; reinstall, state-lock, update, update-rollback, git-source-update, and
  reconcile features 61/61, unedited.
- Plan gate: `npm run check` exit 0 on the final tree (Node v26.12.1), run
  before the task 3 commit with exactly the files that commit stages: static
  checks, unpaired tests, integration, 712/712 cucumber scenarios, direct
  coverage for all pairs (280 records merged).

## RINST-01 cases

The three RINST-01 cases passed **unedited** on the shared path, bodies
byte-identical to `9f126315`: "PRL-10 / RINST-01: bare reinstall
unconditionally overwrites foreign agent content across all bridges" (original
line 1184), "PRL-10 / RINST-01: unconditional overwrite of foreign previous
agent content rolls back on save failure" (1273), and "GAP-11 / RINST-01:
reinstallPlugin unconditionally overwrites agent foreign content" (2444). Only
the GAP-11 comment changed, to say the shared swap passes reinstall's
overwrite knob to the agents commit (D-18-15).

## Deleted tests

### reinstall-flow.test.ts (49)

Original line and exact title in
`git show 9f126315:test/orchestrators/plugin/reinstall-flow.test.ts`. The
"Re-added by" column names the plan that restores the case, rewritten to the
new semantics; "stays deleted" marks the 18 that pin machinery that no longer
exists or behavior the shared swap's own tests own (D-18-02).

| Line | Title | Re-added by |
| ---- | ----- | ----------- |
| 790 | AGENT-01: reinstall preserves legacy bytes and state when the new target holds foreign content | 18-05 |
| 941 | PDEF-01: reinstall preview detects an agent conflict from a later resolved directory | 18-05 |
| 1004 | PDEF-01: reinstall stages every agent directory and warns on a later duplicate | 18-05 |
| 1078 | PDEF-01: reinstall rolls back replacements sourced from every agent directory | stays deleted |
| 1146 | PRL-10: missing cached manifest entry fails and preserves old state, resources, and data | 18-05 |
| 1223 | PRL-10: saveState failure rolls back physical replacements and preserves data | stays deleted |
| 1786 | PRL-13 batch reinstall continues after failed plugin | 18-05 |
| 2048 | PRL-15 batch soft dependency warnings aggregate successful restaged resources only | 18-05 |
| 2128 | GAP-02: reinstallPlugins with plugin removed from manifest emits failed cascade | 18-05 |
| 2160 | GAP-03: reinstallPlugin render=none failure returns failed without notifying | 18-05 |
| 2366 | GAP-09: reinstallPlugin render=none success with bridgeWarnings returns annotated notes | stays deleted |
| 2649 | GAP-16: reinstallPlugin saveState failure with non-empty replacements wraps as ManualRecoveryError | stays deleted |
| 2853 | GAP-19: reinstallPlugin updateStateRecord concurrent-removal detection | stays deleted |
| 4164 | a clone-cache seam non-Error rejection becomes a complete failed outcome | 18-07 |
| 4654 | NFR-5: a warm-cache pinned GitHub-source reinstall ignores an invalid base and stays offline | 18-07 |
| 4836 | GIT-01 / PRL-07: an unpinned reinstall copies the recorded commit from the warm mirror with no network call | 18-07 |
| 4892 | MIRR-06 / D-79.1-04: an unpinned reinstall with only a per-sha clone (no mirror) still repairs from the per-sha clone (coexistence) | 18-07 |
| 4948 | MIRR-06 / PRL-07: an unpinned reinstall with neither mirror nor per-sha clone degrades without a network clone | 18-07 |
| 5411 | PRL-10: a source that stopped being installable fails with the typed reason, not the substring fallback | 18-05 |
| 6217 | NREG-01: a hygiene-only reinstall carries notes but still omits discoveryWarnings | 18-05 |
| 6255 | D-141-03: an agents hygiene warning rides notes in orchestrated mode and no notification in standalone | 18-05 |
| 6725 | a replacement failure aborts every prepared bridge and preserves foreign content | stays deleted |
| 6767 | a post-save hook-cache read failure leaves the committed reinstall successful | stays deleted |
| 6818 | a hooks source changed after resolve fails before state persistence | stays deleted |
| 6880 | an abort cleanup failure reports manual recovery through the exported workflow | stays deleted |
| 7021 | an unpinned git-subdir reinstall copies the recorded commit from the warm mirror without external calls | 18-07 |
| 7076 | an unpinned git-subdir reinstall reports a missing mirror subdirectory without cloning | 18-07 |
| 7118 | a pinned git-subdir reinstall reports a missing cached subdirectory | 18-07 |
| 7405 | retry proof: reinstall: skills prepare failure with no prepared handles converges on the same root | 18-06 |
| 7558 | retry proof: reinstall: commands prepare failure aborts the one prepared handle and converges | 18-06 |
| 7687 | retry proof: reinstall: a rollback cleanup leak reports manual recovery and the leak survives the retry | stays deleted |
| 7840 | retry proof: reinstall: an abort cleanup leak reports manual recovery and the leak survives the retry | stays deleted |
| 8014 | retry proof: reinstall: MCP prepare failure aborts three prepared handles newest first | 18-06 |
| 8159 | retry proof: reinstall: skills replacement refusal leaves an empty replacement ledger and converges | stays deleted |
| 8299 | retry proof: reinstall: commands replacement refusal unwinds the committed skills replacement in reverse | stays deleted |
| 8472 | retry proof: reinstall: a persistence failure after hooks removal leaves the unrestorable hooks window and the retry converges the record | 18-06 |
| 8600 | retry proof: reinstall: a persistence failure after four committed replacements unwinds them all in reverse | 18-06 |
| 8776 | retry proof: reinstall: a concurrently removed record unwinds before any save and the retry persists once | 18-06 |
| 8921 | retry proof: reinstall: an unreadable base layer is left unchanged by a reinstall and its retry | 18-06 |
| 9194 | retry proof: reinstall: a completion-cache maintenance failure notes the deferral and the retry clears it | 18-06 |
| 9302 | retry proof: reinstall: a plugin-data-dir maintenance failure keeps the directory and the retry removes it | 18-06 |
| 9408 | retry proof: reinstall: a bulk cascade keeps the earlier committed target and the retry reinstalls the ordered set once | 18-06 |
| 9632 | CR-01: a partially failed workflows commit unplaces what it stranded | stays deleted |
| 9889 | WLIF-01: a failure after the commit removes exactly the envelopes it placed | stays deleted |
| 9942 | T-112-14: a containment refusal during recovery becomes a leak, not the surfaced error | stays deleted |
| 10006 | WLIF-01: a workflows staging-cleanup leak reaches the reinstall bridge warnings | stays deleted |
| 10066 | WLIF-03: an unremovable placed envelope becomes a manual-recovery leak | stays deleted |
| 10325 | PRL-03: a bulk cascade forwards the state-transaction seam to every per-plugin reinstall | 18-05 |
| 10385 | PRL-08 / PRL-11: preserves state, tree, cleanup, and exact notification through the flow owner | 18-05 |

Counts: 31 re-added (18-05: 13, 18-06: 10, 18-07: 8), 18 stay deleted.
With them went the helpers only they used: `observeReinstallOperations`,
`reinstallTransactionWith`, `observeRetryCollaborators`, `createRetryReinstall`,
`retryCauseChain`, `MIRROR_HEAD_SHA`, `writeMirrorTree`,
`seedUnpinnedGitRecord`, the MIRR-06 banner, the retry-proof helper banner, and
the bridge replace/rollback/finalize imports. Plans 06 and 07 restore what
their re-added cases need.

### Other deleted tests (none re-added; their subject is gone)

| File (at `bee2e52f`) | Line | Title |
| -------------------- | ---- | ----- |
| test/persistence/state-io.test.ts | 94 | clones every plugin field without retaining nested aliases |
| test/persistence/state-io.test.ts | 165 | clones a legacy plugin without inventing optional fields |
| test/architecture/hooks-lifecycle.test.ts | 203 | WR-03 Block C: reinstall-flow.ts wires remove + add + rebuildRoutingTables in its per-plugin lock |
| test/orchestrators/plugin/reinstall-clone-probe.test.ts | 47 | uses the production seam for a warm pinned clone |
| test/orchestrators/plugin/reinstall-clone-probe.test.ts | 71 | GIT-01: restores an unpinned source's copy at the recorded sha, not the moved mirror |
| test/orchestrators/plugin/reinstall-clone-probe.test.ts | 94 | NFR-5: a pinned GitHub source the seam finds warm never reads an invalid base |
| test/orchestrators/plugin/reinstall-clone-probe.test.ts | 131 | asks for the copy at the recorded sha with the identity and wire urls |
| test/orchestrators/plugin/reinstall-clone-probe.test.ts | 163 | threads provider auth while resolving a pinned git-subdir |
| test/orchestrators/plugin/reinstall-clone-probe.test.ts | 203 | classifies a missing pinned git-subdir |
| test/orchestrators/plugin/reinstall-clone-probe.test.ts | 237 | preserves clone failure attribution |

## Tests added or rewritten

- `update-constraint-gate.test.ts`: the five walk cases became rejection
  cases asserting class, `declarer`, and the verbatim message (D-18-17).
- `update-flow.test.ts`: "D-18-17: an update whose dependency walk cannot read
  another recorded plugin fails as unreadable and names it" and "D-18-17: an
  autoupdate cascade fails a plugin whose dependency walk cannot read another
  record as unreadable".
- `reinstall-record.test.ts`: wrapped lock, both concurrency kinds, unreadable
  walk, non-Error input, and one case per `reinstallOutcomeFromRun` arm.
- `reinstall.messaging.test.ts`: typed skip with holders, typed skip without
  notes, rollback-partial children.
- `reinstall-flow.test.ts`: "PRL-03: a bulk reinstall forwards the
  data-directory removal seam to every per-plugin reinstall" and "REI-04: a
  reinstall after the marketplace offers a newer version records and reports
  that version" (outcome at 1.1.0; record at 1.1.0 with the pre-call
  `installedAt` and `provenance`).
- `backfill.test.ts`: SF-01 declares `conflictor` in the manifest; SF-02 is now
  "SF-02 / D-18-17: a corrupt manifest fails its own plugin and fails the
  healthy sibling's promotion as unreadable" (both rows, state unchanged, so
  the stamp is unwritten); ENBL-08 expects the two empty staging parents.
- edge `reinstall.test.ts`: the cold-git case is "D-18-04 / NFR-5: a cold git
  source is a cache miss, so reinstall tries to clone it and skips the plugin
  when the clone fails" (one transport call, `(skipped) {no longer
  installable}` at warning, no footprint).

## Deviations from Plan

1. **[Rule 1 - stale comment] `PluginUpdateSkippedMessage` doc
   (`shared/notification-types.ts`, not in the plan's file list).** Reinstall's
   skipped row now uses this variant for its cause slot, so the doc that said
   "update's" alone now names reinstall too. The plan said to set
   `PluginSkippedMessage.cause`, but that slot exists only on the update
   variant by design. Commit: task 2.
2. **[Rule 1 - stale comments naming deleted symbols] four production
   comments.** `reinstall-record.ts` (the `clonePluginRecord` rollback aside),
   `install-outcome.ts` (`clonePluginRecord` beside `toDisabledRecord`),
   `domain/plugin-resolver.ts` (BFILL-01 named `reinstall-clone-probe.ts`), and
   `git-source-probe.ts` (AMIG-01 named `reinstall-clone-probe.ts`). Plan 04
   lists `git-source-probe.ts` too; this commit already rewrote it with the
   probe's facts kept. Also the backfill WCONV-01 comment, which named
   reinstall's `replaceAll` / `updateStateRecord`. Commit: task 3.
3. **Test comment edits beyond GAP-11.** GAP-07's comment named
   `runLockedReinstall`; backfill.test.ts's ENBL-08 banner named it too. Both
   now describe the current code.
4. **`reinstallReasonsFromError` errno mapping is a lookup table**, not the
   planned errno mapper with conditionals or a `switch`: the `switch` failed
   `@typescript-eslint/switch-exhaustiveness-check`.
5. **D-18-17 test-title count.** To meet the `grep -c "D-18-17"` >= 5
   criterion with one line per case, the four `D-05-07` row titles carry
   `D-05-07 / D-18-17`, and the loop template does not repeat it.
6. **The cold-git edge case now reads `(skipped) {no longer installable}`.**
   That is the shared runner's existing classification of a failed cold
   clone, the same row `update` produces; the plan expected a `(skipped)` row
   at warning without naming the token.

## Needs the user's attention

- The cold-clone failure reason. An unreachable git URL on a reinstall cache
  miss renders `{no longer installable}`, update's existing token for a probe
  that fails. That wording claims more than "the clone failed". It is
  inherited behavior on the shared path, not new code, so it was left as is.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts (contains materializeLatestVersion, REINSTALL_MATERIALIZATION, reinstallOutcomeFromRun()
- MISSING (deleted as planned): extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
- FOUND: 3a70b560 (task 1), ce10fe6a (task 2); task 3 is the commit that adds this file

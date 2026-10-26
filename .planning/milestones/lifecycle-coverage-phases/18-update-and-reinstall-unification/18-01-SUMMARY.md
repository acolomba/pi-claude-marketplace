---
phase: 18-update-and-reinstall-unification
plan: 01
subsystem: orchestrators/plugin (update)
tags: [update, reinstall, materialization, git-mirror, agents-bridge]
requires:
  - phase: 16-git-plugin-copies-and-version-rule
    provides: per-commit git copies, the D-16-09 same-revision rule
provides:
  - "materializeLatestVersion(args, policy): the shared preflight + swap leaf"
  - "MaterializationPolicy with refreshSource, skipSameRevision, overwrite"
  - "D-18-11 (IN-01) enabled same-revision rule that also compares the plugin root"
  - "a swap that records a partial candidate as installable: false"
  - "a verb-neutral phase-3 rollback message"
  - "commitPreparedAgents { force } (RINST-01 repair overwrite) threaded from the policy"
affects: [18-02 reinstall on the shared path, reconcile backfill]
actuals:
  tokens: 15900
  tasks: 3
  commits: 3
plan_head_before: d2c31dd31e291cc6949465e03f28af610c890a60
plan_head_after: self # the task 3 commit, which also adds this file; a file cannot name its own hash
tech-stack:
  added: []
  patterns:
    - "a per-verb policy object is the only behavioral difference inside the shared materialization path"
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - test/architecture/gate-targets.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - test/orchestrators/plugin/clone-cache.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/bridges/agents/stage.test.ts
    - test/edge/handlers/plugin/update.test.ts
key-decisions:
  - "The disabled-record branch keeps the version + sha rule (D-99-05a); only the enabled branch adds the root (D-18-11)"
  - "commitPreparedAgents force replaces the AG-5 preserved rows (this plugin's user-edited files) and drops them from the index; a file no index row names is still refused (PI-6)"
requirements-completed: [UPR-01]
duration: 41min
completed: 2026-10-23
status: complete
---

# Phase 18 Plan 01: Shared materialization leaf for update

**`update` now runs through `materializeLatestVersion(args, policy)`, a non-ledger leaf
that composes the candidate preflight and the three-phase swap under a
three-knob policy; IN-01 is closed for `update`, and the swap is safe for
`reinstall` to share.**

## What changed

- `materialize-latest.ts` (new): the leaf both verbs will call (UPR-01,
  D-18-02, D-18-03). It is not a ledger, names no git surface, and is absent
  from `PLUGIN_LEDGERS` and `NETWORK_SEAMS`. `update-flow.ts::runPluginUpdate`
  is now the layer refusal plus
  `materializeLatestVersion(args, UPDATE_MATERIALIZATION)`
  (`{ refreshSource: true, skipSameRevision: true, overwrite: false }`).
- `update-preflight.ts`: `MaterializationPolicy` and an optional
  `policy` on `PreparePluginUpdateOptions` (absent is update's policy).
  `makeUpdateCloneProbe` passes `refresh: refreshSource` to the mirror; the
  enabled same-revision short-circuit is gated on `skipSameRevision` and uses
  the new `isRecordedCandidate` (version, sha, and `resolvedSource`), D-18-11.
  The disabled branch stays on `isSameRevision` (D-99-05a).
- `clone-cache.ts`: `materializeOrRefreshPluginMirror` takes `refresh?`; with
  `false` a present mirror is read at its HEAD with no fetch, and a missing
  mirror is still cloned.
- `update-swap.ts`: the success record writes
  `installable: installable.state === "installable"` (D-18-06 prerequisite);
  the phase-3 aggregate message is `Plugin "<p>" failed during physical
  replace. <hint>`; `swapPluginUpdate` takes an optional `policy` and passes
  `{ force: policy?.overwrite === true }` to the agents commit only.
- `bridges/agents/stage.ts`: `commitPreparedAgents(ops, prepared, options?)`.
  With `options?.force` the AG-5 preserved rows count as previous targets (not
  refused, pre-removed) and are left out of the saved index. A file that no
  index row names at a new target is still refused, before anything is
  removed.
- DFEN-07 gate: `materialize-latest.ts` joined `LIFECYCLE_ENABLED_READ_TARGETS`.

## Verification

- Task 1: direct coverage 100% for `materialize-latest.ts` and
  `update-flow.ts`; `update.feature`, `update-rollback.feature`,
  `git-source-update.feature` 24/24; `npm run test:architecture` green;
  ESLint clean on the leaf. Commit hook `check:commit` passed.
- Task 2: direct coverage 100% for `update-preflight.ts`, `clone-cache.ts`,
  `update-flow.ts`, `materialize-latest.ts`; the D-99-05a cases pass unedited;
  `fallow health --complexity` exit 0; update, git-source-update, fetch,
  disable, enable features 44/44. Commit hook `check:commit` passed.
- Task 3: direct coverage 100% for `update-swap.ts`, `bridges/agents/stage.ts`,
  `materialize-latest.ts`, `update-flow.ts`; `test/edge/handlers/plugin/update.test.ts`
  33/33; architecture suite green.
- Plan gate: `npm run check` exit 0 on the final tree (Node v26.12.1), run
  before the task 3 commit with exactly the files that commit stages: static
  checks, unpaired tests, integration, 712/712 cucumber scenarios, direct
  coverage for all pairs.

## Deviations from Plan

1. **[Rule 2 - test discrimination] Two more D-16-09 rows got real roots.**
   The plan named the "same declared version is unchanged at the recorded
   commit" row; the sibling rows ("a path record whose entry moved to a git
   source" / "a git record whose entry moved to a path source") still passed,
   but only because the placeholder root now differs from the candidate's.
   They record the real root too, so they keep proving the sha rule rather
   than the root rule. File: `test/orchestrators/plugin/update-preflight.test.ts`.
2. **Fixture shape.** `seedUpdate`'s `installed` option also accepts a
   function of the seeded plugin root, which is how the preflight cases record
   the candidate's real root.
3. **Leaf test fixture.** The record seeds the generated skill name
   `hello-tool` (the bridge's real name), so the cascade case can assert the
   whole record after the swap. A third leaf case (reinstall's policy at the
   recorded revision restores the missing skill) landed in Task 2 as planned.
4. **Swap signature detail.** `commitUpdatePhase3a` takes the `overwrite`
   boolean as a fifth parameter; the agents commit's partition lives in a new
   file-private helper `partitionPreviousEntries`, which keeps
   `commitPreparedAgents` under both complexity caps.
5. **New swap cases use `createHermeticEnvironment(t, ...)`** rather than the
   file's older `withHermeticHome` wrapper, and a shared `cascadeSwapArgs(cwd)`
   helper.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
- FOUND: test/orchestrators/plugin/materialize-latest.test.ts
- FOUND: 0e159c4f (task 1), 6cec0770 (task 2); task 3 is the commit that adds this file

---
phase: 10-constraint-aware-update
plan: 02
subsystem: plugin-update
tags: [dependency-resolution, git, semver, release-tags, isomorphic-git, node-test]

# Dependency graph
requires:
  - phase: 10-constraint-aware-update
    provides: "plan 10-01's constraint gate scaffolding -- the disjoint/invalid/too-complex arms, the held-row shape, and the seam the two tag probes now plug into"
provides:
  - "Stage-one tag probing on both source kinds: git-backed sources probe the repository's own release tags, path sources probe the marketplace clone's tags, both selecting the highest tag satisfying the intersected dependent range"
  - "Pin threading through resolveUpdateCandidate's resolver callbacks (git sha override, path pathPluginPin/resolvePathPluginRoot conditional spread) with no entry.source mutation"
  - "deriveUpdateToVersion prefers the pin's own version string over a sha-derived pseudo-version, closing a defect where a tag-pinned update would have recorded the wrong version"
  - "Run-scoped tag-listing memos: one pair created per updatePluginsWith bulk run and one pair per createPluginUpdateOperations autoupdate-cascade binding, bounding tag traffic to one listing per repository/marketplace per run"
affects: [10-03, 10-04]

# Actuals (#2632)
actuals:
  tokens: 24572
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Run-scoped memo pair created at the caller boundary (updatePluginsWith per bulk call, createPluginUpdateOperations per factory binding) and threaded down as plain pass-through options -- never exposed on UpdatePluginsOptions, so a caller cannot supply a stale memo that outlives its run"
    - "Pin threading through resolver callback closures (resolveGitPluginRoot's sha override, resolvePathPluginRoot's conditional spread) instead of mutating entry.source, mirroring the install-side contract exactly"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - tests/orchestrators/plugin/update-constraint-gate.test.ts
    - tests/orchestrators/plugin/update-preflight.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "Ctx-undefined git probe skip: rather than an uncoverable SILENT_NOTIFICATION_CONTEXT fallback (an ESLint no-non-null-assertion / non-nullable-type-assertion-style deadlock), probeGitStageOne returns admitsRange(range, holders) directly when options.auth.ctx is undefined, deferring to a later stage exactly as D-10-16's own no-ctx philosophy elsewhere"
  - "Shared UpdateTagPin interface exported from update-constraint-gate.ts and reused by resolveUpdateCandidate's pin parameter, so the outer preparePluginUpdate call site's own .version read makes the type-member analyzer credit it as runtime-observed -- no lint:type-members exception needed for that field"
  - "update-swap.ts's new memo fields are typed via NonNullable<PreparePluginUpdateOptions['constraintTagMemo']> rather than a direct platform/git.ts import, keeping update-swap.ts off no-orchestrator-network.test.ts's gated import surface (the gate's regex matches any platform/git specifier, type-only included)"
  - "Cognitive-complexity relief via two targeted extractions: resolvePinnedUpdateCandidate (Task 2, update-preflight.ts) and constraintGateOptions (Task 3, update-preflight.ts) -- both pulled out of preparePluginUpdate to stay under the sonarjs/cognitive-complexity cap of 15"

requirements-completed: [UPDT-01]

coverage:
  - id: D1
    description: "A constrained plugin whose source is git-backed updates to the highest release tag satisfying the intersected dependent range, materializing that tag's exact commit"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-01: the highest git tag satisfying the intersection is pinned"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#UPDT-01: a tag-pinned update records the tag's version, not a sha"
        status: pass
    human_judgment: false
  - id: D2
    description: "A constrained plugin whose marketplace entry is a relative path updates to the highest marketplace-clone tag satisfying the intersected range, read locally with no network call"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-01: the highest marketplace tag satisfying the intersection is pinned"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#D-10-18: one bulk run resolves two path-source siblings from the same marketplace clone"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tag-pinned update records the tag's own version string, not a sha-derived pseudo-version; an unpinned git update still renders its short-sha version"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#UPDT-01: a tag-pinned update records the tag's version, not a sha"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unconstrained update's resolver context carries exactly today's keys -- pathPluginPin/resolvePathPluginRoot are absent, not undefined"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#D-10-17: an unconstrained update supplies no path pin to the resolver"
        status: pass
    human_judgment: false
  - id: D5
    description: "One bulk update run or autoupdate cascade lists each repository's tags and each marketplace clone's tags at most once, whatever number of plugins resolve against them; a failed listing is retried on the next plugin; separate runs do not share a memo"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#D-10-18: one bulk run lists each repository's tags once"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#D-10-18: one bulk run lists the same repository's tags once"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#D-10-18: a failed listing is re-queried for the next plugin in the same run"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#D-10-18: two separate updatePlugins invocations do not share a memo"
        status: pass
    human_judgment: false
  - id: D6
    description: "update-flow.ts and update-preflight.ts remain the only orchestrator git consumers -- the gate stays absent from NETWORK_FREE_TARGETS' gated surface"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts"
        status: pass
    human_judgment: false

duration: 1h53m
completed: 2026-09-22
status: complete
---

# Phase 10 Plan 02: Stage One -- Probe Release Tags and Pin the Highest Satisfying One Summary

**Constraint gate now selects a real version: it probes git-repository or marketplace-clone release tags on both source kinds, pins the highest one satisfying the intersected dependent range, threads that pin through the resolver's own callbacks (never mutating `entry.source`), records the tag's own version string instead of a sha-derived pseudo-version, and memoizes tag listings once per repository/marketplace per update run.**

## Performance

- **Duration:** 1h 53m (commit-timestamp span, first task commit to last)
- **Started:** 2026-09-22T11:14:31-04:00
- **Completed:** 2026-09-22T13:07:17-04:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Stage one added to `update-constraint-gate.ts`: source-kind decode (git vs path vs neither), both tag probes wired behind the seam, a shared three-way probe-result decode, and the no-satisfying-tag / transport cause-line arms
- `resolveUpdateCandidate` and `preparePluginUpdate` thread the selected pin through both resolver callbacks (git sha override, path `pathPluginPin`/`resolvePathPluginRoot` conditional spread) and `deriveUpdateToVersion` now prefers the pin's version over `shaVersion(resolvedSha)`
- One tag-listing memo pair per update run (bulk `updatePluginsWith` and the autoupdate-cascade `createPluginUpdateOperations` binding), bounding remote/local tag traffic to one listing per repository/marketplace regardless of plugin count in that run

## Task Commits

Each task was committed atomically:

1. **Task 1: Stage one -- decode the source kind, probe its tags, pick the highest satisfying one** - `36f1793e` (feat)
2. **Task 2: Thread the pin into candidate resolution, and record the version the tag names** - `7e859f8b` (feat)
3. **Task 3: One tag listing per repository per run -- the memo pair the whole update run shares** - `c99b2660` (feat)
4. **Fix: match the plan's verbatim D-10-18 test title** - `e9805c21` (test)

**Plan metadata:** pending (this commit)

_Note: TDD tasks -- test coverage for each task's new code was written and verified alongside its production code within the same commit, per this repo's convention of one commit per task rather than separate RED/GREEN commits._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` - Stage-one source-kind decode, both tag probes, shared probe-result decode, `UpdateTagPin` shared type, no-satisfying-tag/transport cause-line arms
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - Pin plumbing on `resolveUpdateCandidate`'s resolver callbacks, `deriveUpdateToVersion`'s pinned-version preference, `resolvePinnedUpdateCandidate`/`constraintGateOptions` complexity-relief extractions, run-scoped memo fields on `PreparePluginUpdateOptions`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` - Memo pair created once per bulk run (`updatePluginsWith`) and once per autoupdate-cascade binding (`createPluginUpdateOperations`), threaded into every preflight of that run
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` - Memo-typed fields on `ThreePhaseArgsBase`, derived from `PreparePluginUpdateOptions` to stay off the network-free gate's import surface
- `tests/orchestrators/plugin/update-constraint-gate.test.ts` - ~15 new cases: pin selection on both source kinds, boundary adjacency, D-10-16 unreadable-listing, D-10-18 memo behavior, ctx-undefined skip
- `tests/orchestrators/plugin/update-preflight.test.ts` - Pin-threading, tag-version-recording, unconstrained-update-byte-identical, and memo-identity cases
- `tests/orchestrators/plugin/update-flow.test.ts` - Wire-protocol HTTP transport mocking for git-arm tag-listing call counting, a real local-git-marketplace fixture for path-arm functional correctness, 4 new D-10-18 run-scoping cases
- `scripts/check-unused-type-members.contracts.json` - Remapped `id`/`filter`/`refines` line:column anchors across `update-preflight.ts`, `update-flow.ts`, and `update-swap.ts` that shifted under this plan's edits

## Decisions Made
- Ctx-undefined git probe path: `probeGitStageOne` defers to `admitsRange` when no ui context was threaded, rather than a fallback that ESLint's `no-non-null-assertion` / `non-nullable-type-assertion-style` rules made irreconcilable to write
- `UpdateTagPin` promoted to a shared exported type between the gate's verdict and the resolver's pin parameter, letting the type-member analyzer credit the `.version` field as runtime-observed at its genuine outer read site instead of needing a contract exception
- `update-swap.ts`'s new fields derive their type from the already-legitimately-imported `PreparePluginUpdateOptions` rather than importing `platform/git.ts` directly, since that file is one of `NETWORK_FREE_TARGETS`'s gated owners and the gate's regex matches any import specifier containing `platform/git`, type-only included
- Path-arm tag-listing-once behavior verified functionally (a real local git marketplace fixture, asserting both path-source siblings correctly pin to one clone's tags) rather than via call-count mocking, because `isomorphic-git`'s package exports are non-configurable (confirmed via two empirical spikes both throwing `Cannot redefine property`); the git-arm's own call-count assertion (via `isomorphic-git/http/node`'s mutable `http.request`) and the gate-level memo tests already prove the underlying "list once" mechanism directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Uncoverable notification-context fallback replaced with an explicit ctx-undefined skip**
- **Found during:** Task 1
- **Issue:** The original `NotificationContext` fallback arrow (`() => undefined`) was unreachable by any real caller and created an ESLint deadlock between `non-nullable-type-assertion-style` (wants `!`) and `no-non-null-assertion` (bans `!` outside `tests/**`)
- **Fix:** `probeGitStageOne` returns `admitsRange(range, holders)` directly when `options.auth.ctx === undefined`, treating "no ctx" as "defer to a later stage" -- consistent with D-10-16's philosophy elsewhere
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
- **Verification:** 100% branch coverage on the file; ESLint clean
- **Committed in:** 36f1793e (Task 1 commit)

**2. [Rule 3 - Blocking] Pre-existing stale lint:type-members contract remapped across three files, three rounds**
- **Found during:** Tasks 2 and 3
- **Issue:** `scripts/check-unused-type-members.contracts.json` pins `file:line:column` coordinates; every insertion above a pinned entry in `update-preflight.ts`, `update-flow.ts`, or `update-swap.ts` invalidated its anchor. This cascaded across three separate remap rounds as later tasks' imports/fields shifted earlier tasks' already-fixed coordinates further down.
- **Fix:** Rebuilt the contracts file from the pristine committed original and reapplied all corrected `id`/`filter`/`refines` triples in one pass per round, verified against the tool's own `--json` positional report each time (property-signature refinements point at the `readonly` keyword's column, not the property name's)
- **Files modified:** scripts/check-unused-type-members.contracts.json
- **Verification:** `npm run lint:type-members` and `npm run lint:type-members:negative` both stop cleanly at the confirmed pre-existing, out-of-scope `notification-types.ts:550:48` entry (present at HEAD before this plan, untouched by any file this plan modifies)
- **Committed in:** 36f1793e, 7e859f8b, c99b2660

**3. [Rule 3 - Blocking] Cognitive-complexity cap relief via two extractions**
- **Found during:** Tasks 2 and 3
- **Issue:** `preparePluginUpdate` exceeded fallow's cognitive-complexity cap (15) after adding pin-threading (Task 2) and memo-option-spreading (Task 3) logic, though ESLint's own `sonarjs/cognitive-complexity` rule did not flag it
- **Fix:** Extracted `resolvePinnedUpdateCandidate` (Task 2) and `constraintGateOptions` (Task 3) helper functions out of `preparePluginUpdate`'s body
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
- **Verification:** `npm run fallow` exit 0, no complexity findings
- **Committed in:** 7e859f8b, c99b2660

**4. [Rule 1 - Bug] update-swap.ts's memo field types de-risked off the network-free gate**
- **Found during:** Task 3
- **Issue:** A direct `import type { RemoteTag } from "../../platform/git.ts"` in `update-swap.ts` failed `tests/architecture/no-orchestrator-network.test.ts` -- the gate's regex matches any import specifier containing `platform/git`, type-only included
- **Fix:** Removed the direct import; derived the field types from the already-imported `PreparePluginUpdateOptions` via `NonNullable<PreparePluginUpdateOptions["constraintTagMemo"]>` (the `NonNullable` wrapper avoids an `exactOptionalPropertyTypes` double-optionality conflict)
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
- **Verification:** `node --test tests/architecture/no-orchestrator-network.test.ts` passes; typecheck clean
- **Committed in:** c99b2660 (Task 3 commit)

**5. [Rule 1 - Bug] ESLint max-params and require-await fixes**
- **Found during:** Task 3
- **Issue:** `updateSinglePluginWith` exceeded `@typescript-eslint/max-params` (8 vs max 7) after adding two memo parameters; a test's `http.request` mock handler was declared `async` without an `await`, tripping `@typescript-eslint/require-await`
- **Fix:** Grouped the two memo parameters into one `constraintMemos: { tagMemo, marketplaceTagMemo }` object parameter; removed `async` from the mock handler and wrapped its returns in `Promise.resolve(...)`
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts, tests/orchestrators/plugin/update-flow.test.ts
- **Verification:** `npx eslint` clean on all changed files
- **Committed in:** c99b2660 (Task 3 commit)

**6. [Rule 1 - Bug] Test title matched to the plan's verbatim spec**
- **Found during:** Final verification (post-Task-3)
- **Issue:** Task 1's committed test titled "D-10-18: one bulk run lists the **same** repository's tags once" did not byte-match the plan's `artifacts_this_phase_produces` verbatim title "D-10-18: one bulk run lists **each** repository's tags once", which the plan states the verifier greps for
- **Fix:** Renamed the test title in `update-constraint-gate.test.ts`
- **Files modified:** tests/orchestrators/plugin/update-constraint-gate.test.ts
- **Verification:** `grep -rl "D-10-18: one bulk run lists each repository's tags once" tests/orchestrators/plugin/*.test.ts` finds it; targeted test run passes
- **Committed in:** e9805c21 (follow-up fix commit)

---

**Total deviations:** 6 auto-fixed (2 Rule 1 bug fixes affecting test/lint correctness, 3 Rule 3 blocking-issue fixes, 1 additional Rule 1 title-match fix)
**Impact on plan:** All auto-fixes were necessary for lint/architecture-gate/complexity-cap compliance or for matching the plan's own stated verification contract. No scope creep -- nothing beyond what the plan's tasks and acceptance criteria required.

## Issues Encountered

**Pre-existing, unrelated test failure (not fixed, out of scope):** `tests/orchestrators/plugin/update-flow.test.ts`'s "PDEF-01: update preview detects an agent conflict from a later resolved directory" fails (`'warning' !== 'error'`) on every run of this file, including a clean `HEAD` checkout untouched by this plan. The test was introduced in commit `553513a5`, long before this plan; `git diff HEAD -- tests/orchestrators/plugin/update-flow.test.ts` (against this plan's own before-state) shows no hunk touching it; `PDEF-01` is a requirement ID from the unrelated, already-archived `refine-unit-tests` milestone, not a phase-10 requirement. It causes `npm run test:coverage:direct:commit` to report a non-zero exit even though every one of this plan's own added/changed lines is 100% covered. Logged to `.planning/phases/10-constraint-aware-update/deferred-items.md`; left for a dedicated defect-repair pass per the SCOPE BOUNDARY rule (only auto-fix issues directly caused by the current task's changes).

**Pre-existing, out-of-scope lint:type-members entry (not touched):** `extensions/pi-claude-marketplace/shared/notification-types.ts:550:48` is a stale contract anchor already present at `HEAD` before this plan (committed in `15530b66`), in a file this plan never modifies. `npm run lint:type-members` and `npm run lint:type-members:negative` both stop cleanly at exactly this entry after all of this plan's own remapping -- confirming the remap is complete and this residual entry is unrelated.

## Next Phase Readiness
- Stage one's positive path (pin selection + materialization + correct version recording) is in place for both source kinds; plan 10-03 can build stage two's disclosure-member behavior on top of the `admits`-with-`pin` and `admits`-without-`pin` (no-matching-tag) arms this plan established
- `update-flow.ts` and `update-preflight.ts` remain the sole orchestrator git consumers (confirmed via `no-orchestrator-network.test.ts`), so plan 10-03/10-04 inherit a clean import boundary to build on
- Two out-of-scope items are tracked in `deferred-items.md` for a future pass; neither blocks phase 10's own remaining plans

---
*Phase: 10-constraint-aware-update*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 8 created/modified files confirmed present on disk (production + test files, contracts.json,
deferred-items.md, this SUMMARY). All 4 commits (`36f1793e`, `7e859f8b`, `c99b2660`, `e9805c21`)
confirmed present in `git log --oneline --all`.

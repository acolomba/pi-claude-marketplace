---
phase: 29-load-converges-on-the-catalog
plan: 09
subsystem: reconcile
tags: [pending, load, convergence, catalog, will-update, notification-closed-set, output-catalog, json-output, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-08: composePendingReport / notifyPendingReport, shared by pending and the load"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-03: the apply trailer and the needsApply envelope fact"
provides:
  - "planConvergence({ scope, state, locations, plan? }) in orchestrators/reconcile/convergence.ts: the offline path-source catalog-move planner (D-10, D-06)"
  - "The `will update` plugin status through every closed-set site, the JSON wire and the schema (D-15)"
  - "pending and the load's block list each path-source catalog move as `v<from> → v<to> (will update)`, counted for the apply trailer (APL-02, D-14)"
  - "isSameRevision / isRecordedCandidate exported from plugin/shared.ts; revisionCommits exported from update-row.ts"
  - "isPendingPluginRow / PendingPluginStatus in notification-types.ts: the partition the exhaustive status switches split at"
affects: [29-10, 29-11, 29-12, 29-13, 29-14, pending, load, apply, docs]

actuals:
  tokens: 36100
  tasks: 3
  commits: 3
plan_head_before: fc2ef59c3d19289102bb737873cf7d048769640b
plan_head_after: f6d88b58e28875f992b47441d5a98755d4c15172

tech-stack:
  added: []
  patterns:
    - "A switch over the 20-member plugin status set splits at the pending partition (isPendingPluginRow) into two no-default exhaustive halves, or becomes a total Record map, so it stays under fallow's cyclomatic ceiling of 20"
    - "Catalog moves travel beside the reconcile plans, not inside ReconcilePlan: the composer adds them to the emptiness test and to needsApply, and the projection appends them after every plan bucket"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - test/orchestrators/reconcile/convergence.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
    - schema/claude-plugin.schema.json
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - features/plugin/pending.feature
    - features/marketplace/update.feature
    - features/plugin/update.feature
    - features/plugin/update-rollback.feature
    - test/architecture/catalog-uat/fixtures/plugin-pending.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - docs/output-catalog.md
    - docs/json-output.md
    - docs/messaging-style-guide.md

key-decisions:
  - "planConvergence plans against the scope as apply's plan leaves it: uninstalled records and removed marketplaces drop out, planned disables and dependency disables read disabled, planned enables read enabled; the declaration walk runs over that view and a failed walk previews no move (D-05-07)"
  - "A move is an enabled, listed, schema-valid, path-source record whose resolvable candidate fails isRecordedCandidate with the version resolvePluginVersion derives; git sources are skipped until 29-11, and grew is always false here"
  - "A per-record catch skips a candidate that throws (T-29-22) and traces it with hookDebugLog; the reachable throw is computeHashVersion over an unreadable tree"
  - "Moves stay outside ReconcilePlan: composePendingReport adds them to the emptiness test and needsApply, and buildReconcilePendingNotification takes them as a fourth argument and appends the rows after every plan bucket"
  - "The `will update` row carries from, to and UPR-02 commits, is scope-bearing on the wire, and uses the row policy { markers: false, contentReasons: true }"
  - "Twenty plugin statuses push every full switch to cyclomatic 21; the switches split at a new pending partition (pluginVersion, wireVersion) or became total Record maps (wireScope, the browser's tag, description and action tables), keeping a compile error for an unplaced status"

patterns-established:
  - "isPendingPluginRow(row) narrows any `{ status: PluginStatus }` union to its pending-tense members; the false branch narrows to the settled members"

requirements-completed: [APL-02, APL-04, APL-03]

coverage:
  - id: D1
    description: "The offline convergence planner finds path-source catalog moves and refuses disabled, delisted, planned-away, invalid, git-source, unavailable and unreadable candidates, failing closed on an unreadable walk"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts (20 cases, 100% direct coverage)"
        status: pass
    human_judgment: false
  - id: D2
    description: "pending lists a path-source catalog move as `(will update)` with its version arrow and the apply trailer"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#APL-02 / D-14: pending previews what apply makes for a recorded plugin the catalog moved to a newer version"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending lists the update to the version a path-source marketplace now offers"
        status: pass
    human_judgment: false
  - id: D3
    description: "A new session behind the catalog prints the same `(will update)` block (D-06)"
    requirement: APL-03
    verification:
      - kind: e2e
        ref: "features/plugin/update.feature#Updating with --local a plugin only the base layer declares fails as plugin in base layer only"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#Autoupdate off preserves installed versions"
        status: pass
    human_judgment: false
  - id: D4
    description: "`will update` is a closed-set status known to every map, switch, the wire schema, the catalog and the references"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/architecture/notify-closed-set-locks.test.ts, compat-01-no-expansion.test.ts, catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: other
        ref: "npm run check (exit 0 at f6d88b58)"
        status: pass
    human_judgment: false

duration: 52min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 09: Catalog Move Preview Summary

**Offline `planConvergence` finds every enabled path-source record whose catalog candidate on disk is a new revision, and `pending` and the load list each one as `● <name> v<from> → v<to> (will update)` with the apply trailer.**

## Performance

- **Duration:** 52 min
- **Started:** 2026-10-24T18:28:31Z
- **Completed:** 2026-10-24T19:21:30Z
- **Tasks:** 3
- **Files modified:** 41

## Accomplishments

- New `orchestrators/reconcile/convergence.ts` (network-free, outside `NETWORK_SEAMS`). It plans against the scope as `apply`'s plan leaves it, fails closed on an unreadable declaration walk, and reports moves sorted by marketplace, then plugin.
- `composePendingReport` plans convergence for each readable scope with the final plan. A move alone makes the report non-empty and sets `needsApply`. The load prints the same rows with no other change (D-06).
- `will update` is a member of `StatusToken` and `PluginStatus`, and every site knows it: the row union, the wire, the schema, the grammar arrow, the row policies, the browser, the pending context and the architecture enrollments.
- The catalog has two new pending states (a version move, and a same-version commit move). The status table has 20 members, and the JSON and style-guide references list the new status.

## Task Commits

1. **Task 1: End-to-end `(will update)` for one path-source plugin the catalog moved**: `1573f623` (feat)
2. **Task 2: Scenarios whose new session now previews a catalog move**: `2d64400d` (test)
3. **Task 3: The catalog and the references document `(will update)`**: `f6d88b58` (docs)

The commit hook (`npm run check:commit`) passed on all three.

## Files Created/Modified

- `orchestrators/reconcile/convergence.ts`: `planConvergence`, `ConvergenceInput`, `ConvergencePlan`, `PlannedMove`.
- `orchestrators/reconcile/pending.ts`: plans convergence per scope and counts moves for emptiness and `needsApply`.
- `orchestrators/reconcile/notify.ts`: `buildReconcilePendingNotification(..., moves)` adds the `will update` rows (`pushPlannedMoves`). Its doc comment now says D-14 supersedes D-66-05.
- `orchestrators/reconcile/reconcile.messaging.ts`: `PendingStatus`, `PendingMsg` and `PENDING_CONTEXT` gain `will update`.
- `orchestrators/plugin/shared.ts`, `update-preflight.ts`, `update-row.ts`: the revision helpers move to `shared.ts`, and `update-row.ts` exports `revisionCommits`.
- `shared/notification-*.ts`, `edge/browser/plugin-browser.ts`, `schema/claude-plugin.schema.json`: the closed-set member, plus the cyclomatic split (see Deviations).
- The four feature files: the new pending scenario and the session blocks.
- Catalog fixtures and pins, and `docs/output-catalog.md`, `docs/json-output.md`, `docs/messaging-style-guide.md`.

`edge/handlers/tools.ts` switches only over list statuses (`installed`, `upgradable` and so on), and `edge/completions/` switches over no plugin status. A grep confirmed both, so neither needed a change.

## Decisions Made

See `key-decisions` in the frontmatter. In short:

- Moves travel beside the reconcile plans, not inside `ReconcilePlan`. This keeps `planReconcile` pure, as its purity gate requires.
- The planner judges records as the plan leaves them.
- An unreadable candidate is skipped and traced, never thrown.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fallow cyclomatic ceiling on the twenty-member status switches**
- **Found during:** Task 1 (`npm run fallow`)
- **Issue:** With 20 statuses, each full switch over `PluginStatus` reached cyclomatic 21. The limit is 20, and the project allows no complexity suppression. The failing switches were `pluginVersion`, `wireScope`, `wireVersion`, the browser's `statusTag` / `statusDescription` / `availableActions`, and the test-side `pluginStatusIsExhaustive`.
- **Fix:** `notification-types.ts` now exports `isPendingPluginRow` and `PendingPluginStatus`, which read the total `PENDING_PLUGIN_STATUS` map.
  - `pluginVersion` and `wireVersion` each split into a pending half and a settled half. Each half is still an exhaustive switch with no default (D-116-14's missing-arm gate holds).
  - `wireScope` reads a total `CATALOGUE_STATUS` map.
  - The browser tables became total `Record` maps.
  - The test switch became a type-level `IsExact` proof.
  - Behavior is unchanged, and the owner tests pass unchanged.
- **Files modified:** `shared/notification-types.ts`, `shared/notification-json.ts`, `edge/browser/plugin-browser.ts`, `test/shared/notification-types.test.ts`
- **Verification:** `npm run fallow` green. Direct coverage is 100% for the three sources.
- **Committed in:** `1573f623`

**2. [Rule 3 - Blocking] Catalog count pins outside the plan's file list**
- **Found during:** Task 3
- **Issue:** The two new states change the tuple counts that `catalog-parser.test.ts` (312) and `catalog-wire.test.ts` (PRESENTED 322, emitted keys 312) pin. Neither file is in `files_modified`.
- **Fix:** Bumped both pins, and the contract test's title count.
- **Files modified:** `test/architecture/catalog-uat/catalog-parser.test.ts`, `test/architecture/catalog-uat/catalog-wire.test.ts`
- **Committed in:** `f6d88b58`

**3. [Rule 1 - Bug] Stale reason-bearing sentence in the output catalog**
- **Found during:** Task 3
- **Issue:** The legend said 9 reason-bearing variants of 19, and it named `installed` as the only optional one. `notification-types.ts` declared `reasons` on 16 of the 19, 8 of them optional.
- **Fix:** Recounted from the interfaces: 17 of 20 are reason-bearing (only `will install`, `will enable` and `will disable` have no `reasons`), and 9 are optional. The style guide's count is now 8 required, 9 optional and 3 absent, and its `Reason` bullet says 17.
- **Files modified:** `docs/output-catalog.md`, `docs/messaging-style-guide.md`
- **Committed in:** `f6d88b58`

**4. [Wording] json-output.md from/to rows**
- The acceptance criterion pins `grep -c 'will update' docs/json-output.md` at 1. So the `from` / `to` field rows say "a pending catalog move" and do not name the status.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 stale doc), plus 1 wording note.
**Impact on plan:** The switch split is the only structural change. It is needed now that the status set has 20 members, and it keeps the compile-time exhaustiveness gates.

## Issues Encountered

- Task 2's zeta question: zeta's unreadable skill file does NOT make its candidate `unavailable` (the resolver reads no skill bodies). So each "Autoupdate continues in installed order after a plugin fails" row now shows `zeta 1.0.0 → 1.10.0 (will update)`, and alpha shows nothing.
- Task 2 scenarios that now state the block (the full suite named exactly these 13 example rows, no others):
  - `features/marketplace/update.feature`: "Autoupdate off preserves installed versions" (dir, file, url and github rows) and "Autoupdate continues in installed order after a plugin fails" (all 4 rows).
  - `features/plugin/update.feature`: "Updating with --local a plugin only the base layer declares fails as plugin in base layer only", "Updating every plugin with --local updates only the plugins the local layer declares", "Updating a dependency past the version range its dependent declares holds the update and changes nothing" (lib 1.0.0 → 2.0.0), and "Updating a plugin whose new version is only partially available is held without --partial and keeps the installed version" (demo 1.0.0 → 1.1.0).
  - `features/plugin/update-rollback.feature`: "A new session offers the skills of the installed version after a failed update".
- The last two `update.feature` rows read `will update` until 29-10 turns them into its range-hold and consent-decline rows.

## Verification

- Owner tests for every touched pair pass. Direct coverage is 100% for: `convergence.ts`, `notify.ts`, `pending.ts`, `reconcile.messaging.ts`, `plugin/shared.ts`, `update-row.ts`, `update-preflight.ts`, `notification-types.ts`, `notification-wire.ts`, `notification-json.ts`, `notification-grammar.ts`, `notification-resolve.ts` and `plugin-browser.ts`.
- `npm run test:cucumber`: 781 scenarios passed. `npm run check:features` passed.
- Full gate: `npm run check`, run once after the last task commit, at HEAD `f6d88b58` on Node v26.12.1. **Exit code 0.** Log tail:

```text
passed format:check (7.9 s)
passed test:corresponding (3.8 s)
passed check:features (3.3 s)
ℹ pi-subagents 0.74.0 at .../node_modules/.cache/optional-peers/node_modules/pi-subagents
16 hooks (16 passed)
781 scenarios (781 passed)
7497 steps (7497 passed)
0m 26.772s (3m 7.661s executing your code)
Merged LCOV: coverage/direct.lcov (285 records)
```

## Known Stubs

None. `PlannedMove.grew` is always `false`, and git sources are skipped. Both are this plan's stated scope (29-11 adds growth and git), not stubs that block its goal.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 29-10 (blocked moves). It can append its blocked rows the same way `pushPlannedMoves` does, and it can read `PlannedMove` from `planConvergence`.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
- FOUND: test/orchestrators/reconcile/convergence.test.ts
- FOUND: 1573f623, 2d64400d, f6d88b58 (all ancestors of HEAD)

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*

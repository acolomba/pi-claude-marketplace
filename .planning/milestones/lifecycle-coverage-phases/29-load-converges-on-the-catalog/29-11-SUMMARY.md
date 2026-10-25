---
phase: 29-load-converges-on-the-catalog
plan: 11
subsystem: reconcile
tags: [pending, load, convergence, git-source, clone-cache, growth, backfill, output-catalog, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-10: ConvergencePlan { moves, holds, declines } and settleCandidates"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-09: planConvergence and the `will update` pending row"
provides:
  - "ListCandidate's resolved arm carries resolvedSha for a materialized git tree (GIT-01)"
  - "planConvergence previews git-source records offline: a cached tree by version and commit, a target with no cached tree only by the catalog's pin or version (D-10, D-11)"
  - "the BFILL-01 growth test runs on every pass; a strictly grown supported set is a move, growth-only at the same version (D-10)"
  - "supportedSetGrew is exported from convergence.ts; backfill.ts imports it"
  - "a growth move's `will update` row carries {components now supported} (WCONV-03)"
affects: [29-12, 29-13, 29-14, pending, load, apply]

actuals:
  tokens: 11619
  tasks: 2
  commits: 2
plan_head_before: 4f17930f592298764043395fcfe84339963f7229
plan_head_after: 49dc45e73c0f2be81d4508a087b9b7ec54ce23a8

tech-stack:
  added: []
  patterns:
    - "Each candidate becomes a private Offer (toVersion, toCommit, revisionChanged, resolved tree); growth is weighed on the offer, so the path, warm git and cold git rules share one move builder"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - test/orchestrators/plugin/list-candidate-version.test.ts
    - test/orchestrators/reconcile/convergence.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-pending.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - docs/output-catalog.md
    - features/plugin/git-source-update.feature
    - features/plugin/fetch.feature

key-decisions:
  - "A git-source candidate whose presence probe found no materialized tree (a cold cache, or a git-subdir clone that lacks the plugin path) is judged by the D-11 catalog rule, not skipped"
  - "A warm git move always carries toCommit (the candidate's sha); the arrow still names commits only under UPR-02"
  - "A cold git offer has no tree, so it never grows and is never declined; its range is judged like any move"
  - "29-09 already ships the equal-version commit state (plugin-pending-update-same-version-commits), so no plugin-pending-update-git-commit state was added"

patterns-established:
  - "A move is `revisionChanged || grew`; a growth-only move keeps the recorded version on both sides of the arrow"

requirements-completed: [APL-02, APL-03, APL-04]

coverage:
  - id: D1
    description: "The offline list candidate carries the commit of a materialized git tree"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/list-candidate-version.test.ts (warm mirror cases and GIT-01: a pinned git source whose commit copy is cached carries that commit; 100% direct coverage)"
        status: pass
    human_judgment: false
  - id: D2
    description: "pending previews a fetched git-source plugin's new revision, and a pinned plugin whose catalog pins a commit it has not cloned, with no request to the git host"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts (D-10 / GIT-01 / D-11 git cases; 100% direct coverage)"
        status: pass
      - kind: e2e
        ref: "features/plugin/git-source-update.feature#Pending previews the revision a fetched git-source plugin now offers without a request; #Pending previews a git-source plugin whose catalog pins a commit it has not cloned without a request"
        status: pass
      - kind: e2e
        ref: "features/plugin/fetch.feature#A fetch leaves the installed plugin running the revision it installed until an update"
        status: pass
    human_judgment: false
  - id: D3
    description: "A strictly grown supported set is a move, marked {components now supported}, and still goes through the consent decline"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts (BFILL-01 growth, not-grown rows, growth decline, disabled record) and notify.test.ts#D-10 / WCONV-03"
        status: pass
    human_judgment: false
  - id: D4
    description: "The catalog documents the growth move and the D-11 git preview rule"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts, catalog-parser.test.ts, catalog-wire.test.ts"
        status: pass
      - kind: other
        ref: "npm run check (exit 0 at 49dc45e7)"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 11: Git and Growth Catalog Moves Summary

**`planConvergence` now previews git-source plugins from the clone cache, offline, and treats a strictly grown supported set as a move on every pass. So `pending` and the load list a fetched or newly pinned git revision, and a growth-only move, as `(will update)`.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-24T20:22:52Z
- **Completed:** 2026-10-24T20:49:46Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- `resolveListCandidate` returns `resolvedSha` beside `version` when the presence probe finds a materialized git tree. List rows ignore it.
- The planner now covers git sources. A cached tree, which is the fetched mirror of an unpinned source or the clone of a pinned commit, moves when its version or commit differs. The plugin root is not compared, because the record names its per-commit copy (GIT-01). A git source with no cached tree moves only when the catalog shows a different target (D-11). That target is a commit pin other than the recorded one, which moves to the entry's version or else to the pin's `sha-` version. Failing that, it is a declared version other than the recorded one. Nothing reaches the git host: both new scenarios assert no request.
- The growth test (`supportedSetGrew`, now exported from `convergence.ts`) runs on every pass for every resolvable candidate. A grown set with no revision change is a growth-only move at the same version. Growth still goes through the range hold and the consent decline: a clean record whose grown candidate would drop components is declined. `backfill.ts` imports the function until the backfill is removed.
- A `will update` row from a growth move carries `{components now supported}`, the marker a backfilled row carries (WCONV-03).
- New catalog state `plugin-pending-update-growth`. The `plugin-pending-update` prose now states the D-11 git rule.

## Task Commits

1. **Task 1: End-to-end git preview and growth moves**: `46c91eb5` (feat)
2. **Task 2: Catalog state for a growth-only move**: `49dc45e7` (docs)

The commit hook (`npm run check:commit`) passed on both. Tracer gate after Task 1: its `<verify>` chain was green before the commit (owner tests, both direct coverage runs, lint, fallow, both features, the whole cucumber suite), so expansion continued.

## Files Created/Modified

- `orchestrators/plugin/list-candidate-version.ts`: `ListCandidate.resolvedSha`.
- `orchestrators/reconcile/convergence.ts`: `supportedSetGrew` (export), `gitSourceOf`, the private `Offer`, `pathOffer`, `gitOffer`, `coldGitOffer`, and a `recordMove` that weighs growth.
- `orchestrators/reconcile/backfill.ts`: imports `supportedSetGrew` and drops its private copy.
- `orchestrators/reconcile/notify.ts`: the growth reason on the `will update` row.
- Tests: new git, cold, growth and not-grown cases in `convergence.test.ts`, which replace the "git-source record is skipped" case. Also a pinned-copy case and `resolvedSha` on the warm cases in `list-candidate-version.test.ts`, and the growth-row case in `notify.test.ts`.
- Scenarios: two new `git-source-update.feature` scenarios. `fetch.feature` line 88's new session now states two `will update` cascades (`Reconcile pending`, needs apply true) before its skill check.
- Catalog fixture, the count and byte pins in three catalog tests, and `docs/output-catalog.md`.

## Decisions Made

See `key-decisions` in the frontmatter. In short:

- A git candidate with no materialized tree uses the D-11 catalog rule.
- A cold offer never grows and never asks for consent, because its tree is unknown offline.
- The plan's optional `plugin-pending-update-git-commit` state was not added. 29-09's `plugin-pending-update-same-version-commits` already shows the two-commit arrow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Catalog pins outside the task's files**
- **Found during:** Task 2
- **Issue:** `catalog-parser.test.ts` (315 tuples) and `catalog-wire.test.ts` (PRESENTED 325, emitted keys 315) also pin the state count. The plan lists neither.
- **Fix:** I bumped both, the same way 29-10 did.
- **Committed in:** `49dc45e7`

**2. [Scope note] `backfill.test.ts` unchanged**
- The plan lists it. Its growth cases still run through `backfill.ts`, which now imports `supportedSetGrew`, so they needed no edit. They pass unchanged.

---

**Total deviations:** 1 auto-fixed (blocking pin), plus 1 scope note.
**Impact on plan:** None on behavior.

## Issues Encountered

- The first "warm tree resolves unavailable" case used a malformed `plugin.json`. The declaration walk failed on it first, so the planner returned no moves before reaching the unavailable branch, and coverage showed it. The case now uses an entry component path that is not a string. The walk accepts that path and the resolver rejects it.
- The full cucumber run before the scenario edits failed only on `fetch.feature:88`, which the plan named. No other scenario sees a git or growth move: the cucumber records store the real supported set.

## Verification

- Owner tests pass. Direct coverage is 100% for `convergence.ts`, `list-candidate-version.ts`, `notify.ts` and `backfill.ts`.
- Acceptance greps:
  - `export function supportedSetGrew` appears once in `convergence.ts`.
  - `resolvedSha` appears on 3 lines of `list-candidate-version.ts` (baseline 1).
  - The `plugin-pending-update-growth` catalog-state marker appears once in `docs/output-catalog.md`.
  - `npx cucumber-js --name 'Pending previews the revision a fetched git-source plugin now offers without a request'` passes.
  - `npm run test:cucumber`: 785 scenarios, all passed.
- Full gate: I ran `npm run check` once after the last task commit, at HEAD `49dc45e7` on Node v26.12.1. **Exit code 0.** Log tail:

```text
passed typecheck (11.3 s)
passed lint (4.1 s)
passed lint:workflows (0.3 s)
passed fallow (5.2 s)
passed format:check (7.6 s)
passed test:corresponding (3.8 s)
passed check:features (3.1 s)
16 hooks (16 passed)
785 scenarios (785 passed)
7548 steps (7548 passed)
Merged LCOV: coverage/direct.lcov (286 records)
CHECK_EXIT=0
```

## Known Stubs

None. `apply` does not execute these moves yet. The plan gives that to 29-12 and 29-13.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 29-12. `apply` can run the moves the planner previews, including git moves (`toCommit` is the pin or the cached tree's commit) and growth-only moves, which should mark their realized rows `{components now supported}`.

## Self-Check: PASSED

- FOUND: .planning/phases/29-load-converges-on-the-catalog/29-11-SUMMARY.md
- FOUND: 46c91eb5, 49dc45e7 (ancestors of HEAD)

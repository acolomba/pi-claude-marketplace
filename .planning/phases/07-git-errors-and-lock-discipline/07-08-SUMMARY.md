---
phase: 07-git-errors-and-lock-discipline
plan: 08
subsystem: plugin-fetch
tags: [fetch, git, classifier, scope-lock, version-rule]

requires:
  - phase: 07-01
    provides: "classifyGitFailure(thrown, rule, remoteUrl?) and its { reason, frame? } result"
  - phase: 07-03
    provides: "the stamp literals in test/orchestrators/plugin/operations.test.ts (kept as they were)"
provides:
  - "fetch classifies a refused clone or mirror refresh with the plugin-clone rule and frames every HTTP status, 404 included (GLK-01)"
  - "an unpinned fetch materializes and reads its row in one withExistingScopeLock body; a pinned fetch takes no lock (GLK-05)"
  - "FetchStatus.resolveListCandidate replaces probeManifestEntry, and every fetch row shows the version list shows (GLK-07)"
affects: [07-09, 07-10, docs/output-catalog.md]

actuals:
  tokens: 12900
  tasks: 2
  commits: 2
plan_head_before: 53fb47e38e80625c07a0e4fcfc561ee8f408ea0b
plan_head_after: ce44cb735a2c5592f7a7524634fb89471ba4f855

tech-stack:
  added: []
  patterns:
    - "A list-rule read that keeps a throw as an `unreadable` candidate, so the skipped and the fresh rows share one version derivation"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - test/orchestrators/plugin/fetch.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - test/orchestrators/plugin/operations.test.ts
    - features/plugin/fetch.feature

key-decisions:
  - "failedRow classifies once through narrowFetchFailure, which now returns { reason, frame? }; the wire URL is networkCloneUrl(gitSource), passed from fetchOne's catch"
  - "fetchOne builds one fetchAndRead body (materialize, then the list-rule read and the fresh row); the unpinned arm runs it under withExistingScopeLock, and the pinned arm runs it with no lock"
  - "readListCandidate wraps status.resolveListCandidate and keeps a throw as { kind: unreadable }, so skippedUpToDate and freshRow take the version from one helper (rowMeta)"
  - "freshRow maps a resolved candidate through resolvedRow, a switch on the resolver state; reasonedRow and its second resolveStrict call are deleted"

patterns-established: []

requirements-completed: [GLK-01, GLK-05, GLK-07]

coverage:
  - id: D1
    description: "A host 503 fails the fetch row as network error and a 404 as source missing, both framed `<status> on <url>`; a 401 stays authentication required with no frame"
    requirement: GLK-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#GLK-01"
        status: pass
      - kind: e2e
        ref: "features/plugin/fetch.feature#Fetching a plugin the git host answers with a server error fails as network error and names the status"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unpinned fetch reads its row with the scope lock held; a pinned fetch reads it with no lock; the lock is free afterwards"
    requirement: GLK-05
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#GLK-05"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fresh and skipped fetch rows show list's version; a cold or unreadable row keeps the entry version"
    requirement: GLK-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#GLK-07"
        status: pass
      - kind: e2e
        ref: "features/plugin/fetch.feature#Fetching a path-source plugin shows the version its plugin.json declares over its entry's"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-27
status: complete
---

# Phase 7 Plan 08: fetch host answers, locked row read, and list's version Summary

**`fetch` now reports a git host's HTTP answer the way `marketplace update` does: a 404/410 is `{source missing}`, any other non-auth status is `{network error}` (the 5xx-as-source-missing bug is fixed), and the cause leads with `<status> on <url>`. An unpinned fetch reads its row inside the same scope-lock body as the mirror refresh. Every fetch row that shows a version shows `list`'s version.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-10-27T07:09:09Z
- **Completed:** 2026-10-27T07:23:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `narrowFetchFailure` keeps its ladder: `lock held` first, then `classifyGitFailure(err, { notFound: "source missing" }, remoteUrl)`, then EACCES/EPERM as `permission denied`, then the `source missing` fold for any other throw. `failedRow` wraps the cause as `new Error(frame, { cause })` when the classifier returns a frame. `classifyGitTransportFailure` is no longer imported by `fetch.ts`.
- `fetchOne` builds the marketplace context once, then one `fetchAndRead` body. The unpinned arm runs that body under `withExistingScopeLock(locations, fetchAndRead)`. The pinned arm runs it with no lock (D-PL7-07). Path and pinned-warm rows take no lock either.
- `FetchStatus` now has `resolveListCandidate` in place of `probeManifestEntry`. `operations.ts` binds `NODE_FETCH_STATUS = { makePresenceProbe, resolveListCandidate }`. `probeManifestEntry` stays exported, because completion (`edge-deps.ts`) still uses it (D-PL7-15).
- `freshRow` maps the candidate the way `list-candidate-row.ts::availableRowMessage` does. `cold` is `remote`. A resolved tree takes its resolver state (`available`, `partially-available` with the unsupported kinds, or `unavailable` with the resolver notes). A read that throws is `unavailable` with `narrowProbeError`. The skipped rows take the version from the same read (D-PL7-17).

## Task Commits

1. **Task 1: fetch reports a host answer with the plugin-clone rule and the frame** - `781b26ac` (fix)
2. **Task 2: one locked fetch-and-read body, and list's version on every row** - `ce44cb73` (fix)

## Verification

| Command | Exit | After |
|---|---|---|
| `node --test --test-name-pattern 'GLK-01' test/orchestrators/plugin/fetch.test.ts` | 0 (3 tests) | 781b26ac |
| `node --test test/orchestrators/plugin/fetch.test.ts` | 0 (35 tests) | 781b26ac |
| `npx cucumber-js features/plugin/fetch.feature` | 0 (10 scenarios) | 781b26ac |
| `node --test test/orchestrators/plugin/fetch.test.ts test/orchestrators/plugin/operations.test.ts` | 0 (57 tests) | ce44cb73 |
| `npm run test:coverage:direct -- .../plugin/fetch.ts .../plugin/operations.ts` | 0 (100%) | ce44cb73 |
| `npx cucumber-js features/plugin/fetch.feature` | 0 (11 scenarios, 143 steps) | ce44cb73 |
| `npx cucumber-js` over `git-source`, `git-source-update`, `list`, `install-dependencies`, `usage-errors` features (they also run `fetch`) | 0 (209 scenarios) | ce44cb73 |
| `node --test test/edge/handlers/plugin/fetch.test.ts` | 0 (25 tests) | ce44cb73 |
| `npm run check:static` | 0 (typecheck, lint with BLOCK F, fallow, format, pairing, features) | ce44cb73 |
| pre-commit hook `npm run check:commit` | Passed on both commits | both |
| `npm run typecheck` (unpiped) | **0** | ce44cb73 |
| `npm run fallow` (unpiped) | **0** | ce44cb73 |

Acceptance greps on `fetch.ts`: `classifyGitTransportFailure` 0 (baseline 3), `classifyGitFailure(` 1, `from "../../platform/git` 0, `probeManifestEntry` 0 (baseline 6), `function reasonedRow` 0. `resolveListCandidate` appears 2 times in `operations.ts`. `fetch.feature` holds the 503 frame and the 404 frame once each.

### Scenario-fails-before records

- "Fetching a plugin the git host answers with a server error fails as network error and names the status": with `fetch.ts` restored to HEAD (53fb47e3), the scenario failed. The row read `source missing` with the bare transport message. The edited line-154 row of "Fetching a marketplace fetches each git-source plugin and reports the one the git host refuses" also failed there, because it had no frame. With the change, both pass.
- "Fetching a path-source plugin shows the version its plugin.json declares over its entry's": with `fetch.ts` and `operations.ts` restored to the Task 1 commit (781b26ac), the scenario failed with version `1.0.0` where `2.0.0` was expected. With the change, it passes.
- Unit: the 503 and 404 GLK-01 cases failed against HEAD's `fetch.ts`. The 401 case passed there too, as intended, because it pins behavior that did not change. A mutation that read the row after the lock was released failed the unpinned GLK-05 case (`[false]` where `[true]` was expected).

### fetch.feature rows whose version cell changed (list's rule)

Every new value is the version that the fetched or path tree's `plugin.json` declares. It comes from `resolveListCandidate`, the function `list`'s not-installed row uses, so it is what `list` shows for that plugin as a candidate. Each entry declares no version of its own, so these cells were empty before.

| Scenario | Row | Before | After |
|---|---|---|---|
| Fetching a plugin succeeds again once the git host serves its repository again | ghp@gits available | (none) | 1.0.0 |
| Fetching a git-source plugin downloads its new revision from the git host | ghp@gits available | (none) | 2.0.0 |
| A fetch leaves the installed plugin running the revision it installed until an update | ghp@gits available | (none) | 2.0.0 |
| Fetching a marketplace fetches each git-source plugin and reports the one the git host refuses | urlp@gits available | (none) | 1.0.0 |
| A bare fetch fetches the git-source plugins of every marketplace in the scope | ghp@gits, urlp@more available | (none) | 1.0.0, 1.0.0 |
| Fetching a pinned plugin whose clone is present makes no request and reports it up to date | subp@gits skipped | (none) | 1.0.0 |

Each of these tables gained a `version` column, because the result step compares every field a row carries. In the two `ghp` rows that read `2.0.0`, the plugin is installed at 1.0.0. There, `list`'s installed row shows `1.0.0 (upgradable)`, and the fetch row shows the fetched candidate's `2.0.0`. That is the version `list`'s shared rule derives for the fetched tree, as D-PL7-09 asks.

### Unit expectations changed by list's rule

In `test/orchestrators/plugin/fetch.test.ts`, nine existing rows gained the plugin.json version of their fixture: `path-plugin v1.0.0`, `moving v3.0.0`, `partial v1.0.0`, `official v1.0.0`, `retry`, `race`, `leak`, `warm-retry`, and `promotion v1.0.0`. In `test/orchestrators/plugin/operations.test.ts`, the warm pinned fetch row is now `⊘ p1 v2.0.0 (skipped) {up-to-date}`. The fixture's clone declares 2.0.0, and that is the version `resolveListCandidate`, the rule `list` uses, derives for the same tree.

## Decisions Made

- The three status stubs the plan named now stub `resolveListCandidate`. "reports available when the cache becomes visible between fresh probes" covered the `installable`-slipped-past-the-classifier branch of the deleted `reasonedRow`. There is now one read and no second resolve, so that race no longer exists. The case is retitled "GLK-07: reads the post-fetch row once through list's rule against the warm clone" and counts the reads (1). "folds a non-Error status read after the locked fetch into a failed row" now expects `list`'s parity row `⊘ odd (unavailable) {unreadable}` and compares the whole notification array.
- The plan asked for a cold-candidate case that keeps the entry version. The existing "reports a successful seam with a still-cold cache as remote" already pins `◌ remote v3.2.1 (remote)`, so it is retitled with GLK-07 rather than duplicated.
- The GLK-01 cases (503, 404, 401) and the GLK-05 cases (unpinned `[true]`, pinned `[false]`) are table loops over `test()`, which keeps fallow's clone detector quiet.

## Deviations

None in behavior. One structural detail: in the new 503 scenario, the row table leaves out the `version` column, because every value in that column would be empty and the step rejects an all-empty column.

## Out-of-line edits

None. Every file edited is in the plan's `files_modified`. `operations.ts` changed only in `NODE_FETCH_STATUS`, its comment, and its imports. `operations.test.ts` changed only in its fetch case.

## Issues Encountered

None.

## For the orchestrator

- `docs/output-catalog.md:2408` still says the post-fetch row comes from "a fresh `probeManifestEntry`". 07-10 owns that file and its plan already covers the fetch prose (list's version rule, the locked read, the 404/5xx frame), so this plan left it alone.
- `classifyGitTransportFailure` keeps its production callers outside fetch (info, until 07-09; update-flow and the tag probe), so it stays exported for now.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The frame travels only as an `Error` message in the row's cause chain, and `serializeCauseChain` redacts credentials there (T-07-16). `fetch.ts` still imports nothing from `platform/git.ts` (T-07-17; BLOCK F passed in `check:static`).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
- FOUND: features/plugin/fetch.feature
- FOUND: 781b26ac (ancestor of HEAD)
- FOUND: ce44cb73 (ancestor of HEAD)

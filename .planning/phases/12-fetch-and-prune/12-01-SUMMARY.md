---
phase: 12-fetch-and-prune
plan: 01
subsystem: behavioral-tests
tags: [cucumber, fetch, git-source, https-git-host]
requirements-completed: [FET-01, FET-02, FET-03]
key-files:
  modified:
    - features/plugin/fetch.feature
duration: ~40 min
completed: 2026-10-23
---

# Phase 12 Plan 01: Plugin fetch coverage Summary

**`features/plugin/fetch.feature` now proves that `fetch` downloads a git-source plugin's new revision without installing it, sweeps a marketplace or the whole scope while reporting a refused plugin, and makes no request for a path-source or a warm pinned plugin.**

## Scenarios added (beside the Phase 1 retry seed)

| Scenario | Requirement | What it pins |
| --- | --- | --- |
| Fetching a git-source plugin downloads its new revision from the git host | FET-01 | row `available`, GET/POST of `/acme/ghp.git` |
| A fetch installs no new version, so the plugin list still shows the installed one | FET-01 | `list` row `installed` at `{ghp revision 1}` after the fetch |
| Fetching a marketplace fetches each git-source plugin and reports the one the git host refuses | FET-02 | error result, tally 1 failure / 2 successes, `failed {source missing}` with the 404 cause chain, the other plugins still fetched |
| A bare fetch fetches the git-source plugins of every marketplace in the scope | FET-02 | rows of two marketplaces, full request log |
| Fetching a path-source plugin makes no request and reports it up to date | FET-03 | `skipped {up-to-date}`, no request |
| Fetching a pinned plugin whose clone is present makes no request and reports it up to date | FET-03 | `skipped {up-to-date}`, no request |

## Task Commits

1. **Task 1: Add the FET-01..FET-03 scenarios** - `bfd675c6` (test)

## Verification

- `npx cucumber-js features/plugin/fetch.feature`: 7 scenarios, 85 steps passed.
- `npm run check:features`: exit 0.
- Negative check: changing the `list` row's version to `{ghp revision 2}` made "A fetch installs no new version..." fail; reverted.

## Deviations from Plan

- **Executed inline by the orchestrating agent**, not a spawned executor: the planner subagent stopped before writing plans, so the plans were written and executed in the main session from the prototype results in CONTEXT.md.
- **Bare-fetch request log has two round trips per repository.** A cold unpinned mirror is cloned and then refreshed in place (`clone-cache.ts` `materializeOrRefreshPluginMirror`, D-79.1-02 "a just-materialized clone is refreshed too"). That is a recorded decision, not a bug, and install shows the same pair in `git-source.feature`. The scenario states all eight requests.
- No product code changed (D-11). The review fix for CR-01 later added the phase-local step module `features/step_definitions/plugin/fetch.steps.ts` (12-REVIEW-FIX.md).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

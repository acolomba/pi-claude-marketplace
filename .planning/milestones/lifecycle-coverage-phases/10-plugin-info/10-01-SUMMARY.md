---
phase: 10-plugin-info
plan: 01
subsystem: testing
tags: [cucumber, info, git-source, fetch, behavioral-tests]

requires:
  - phase: 01-suite-foundation
    provides: "the info seed scenario, the git host and plugin repository steps, revision tokens, the output-style fixture, and the request-log steps"
provides:
  - "features/plugin/info.feature: ten scenarios for INF-01..INF-05"
  - "info on a not-installed git plugin with a warm tree and no declared version shows the tree's `sha-` version"
  - "info --fetch fetches a git plugin repository once"
affects: [phase-9-list]

actuals:
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A single plugin-info result is stated whole with `the result has these fields:`; only the two-scope cascade uses the rows table"

key-files:
  created: []
  modified:
    - features/plugin/info.feature
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - test/orchestrators/plugin/info.test.ts

key-decisions:
  - "D-03: the warm git row takes `version ?? shaVersion(resolvedSha)`, so a declared entry version still wins and the existing unit contract holds"
  - "D-04: INF-04 is proven on a not-installed plugin; info on an installed plugin keeps showing the installed revision"
requirements-completed: [INF-01, INF-02, INF-03, INF-04, INF-05]
---

# Phase 10 Plan 01: Plugin Info Summary

## What changed

- **Bug fix (D-03).** `info --fetch` on a git-source plugin whose marketplace
  entry declares no version showed no version at all, so it could not report a
  new revision. `buildGitNotInstalledRow` now passes
  `version ?? shaVersion(presence.resolvedSha)` to the warm row builders. A new
  unit test pins the `v#<7hex>` rendering for a warm mirror.
- **Scenarios.** `features/plugin/info.feature` keeps the Phase 1 seed and adds
  eight scenarios: installed (INF-01), available (INF-02), partially available
  and npm-source unavailable (INF-03), a never-fetched remote plugin with no
  request, `--fetch` reporting `{ghp revision 2}` with its requests, and a bare
  info after a fetch with no request (INF-04), and not in manifest (INF-05).

- **Bug fix from review (WR-01).** `info --fetch` fetched a git plugin's
  repository twice: the warm row builders handed the fetching probe to the
  resolver again. Both the not-installed and the installed git rows now reuse
  the tree the first probe returned.
- **Review tightening.** The installed scenario offers `2.0.0` after the
  install and expects `1.0.0`; a tenth scenario covers `info --fetch` on an
  installed plugin (D-04).

## Verification

- `npx cucumber-js features/plugin/info.feature`: 10 scenarios, 91 steps passed.
- `node --test test/orchestrators/plugin/info*.test.ts`: all pass.
- The `--fetch` scenario fails without the fix (the version field is absent).

## Deviations

None from the plan. The scenarios use the fields step for single results because
that step compares every field of a non-cascade result (D-07).

## Deferred

- A missing path-source directory reads `unsupported source` in info, install,
  and list (shared classifier, Phases 3 and 9).
- `list` may lack a version for a fetched git plugin with no declared version.

## For the orchestrator

- Deferred: a missing path-source directory reads `unsupported source` in info, install, and list (`shared/probe-classifiers.ts` catch-all); shared with Phases 3 and 9.
- Deferred: `list` shows only the entry version for a fetched git plugin whose entry declares none (`list-candidate-row.ts`), Phase 9's surface.
- Decision for the user (WR-02): info shows a declared entry version on a warm git plugin, while install records `sha-<12hex>`; kept to preserve 12 existing info unit contracts.
- Assumption (D-02): INF-01's "source" is read as the marketplace name and scope; the plugin-info row has no source field.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

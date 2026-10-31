---
phase: 14-bootstrap-browse-help-and-usage-errors
plan: 01
subsystem: plugin bootstrap
tags: [cucumber, bootstrap, failure-reporting, usage-error]
requires: [01-06]
provides:
  - "notifyAddFailure: renders a caught add failure as the public marketplace add does"
  - "features/plugin/bootstrap.feature: first run, second run, 404 failure, argument rejections"
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - features/plugin/bootstrap.feature
requirements-completed: [BOO-01, BOO-02]
completed: 2026-10-23
---

# Plan 14-01 Summary: bootstrap

**A failed bootstrap now reports its reason and cause chain, as `marketplace add` does for the
official source, and bootstrap's first run, second run, failure, and rejections are scenarios.**

## Commits

- `7160e8f9` fix(bootstrap): report why a failed bootstrap add failed
- `967ae9ca` test(features): cover bootstrap runs, failure, and rejections

## What changed

- `add.ts` exports `notifyAddFailure(opts, err)`, the standalone arm of `handleAddFailure`.
  `bootstrapClaudePlugin` calls it for every add error except `MarketplaceDuplicateNameError`
  and returns without the autoupdate step. An error outside the add precondition set is
  rethrown and still reaches the handler's catch-all failed row.
- The bootstrap handler rejects a flag token as `Unknown flag: "<flag>".` before the
  positional check (D-03).
- Scenarios (10): first bootstrap (two results: `added`, `autoupdate enabled`; two clone
  requests; user config declares the marketplace with autoupdate; project config absent);
  second bootstrap (seed, unchanged); bootstrap on a 404 (failed row with reason `source
  missing` and cause chain `HTTP Error: 404 Not Found, fetched https://{git host}/...`, no user
  config, no clones); an outline of seven rejections (positional, `--bogus`, `--local`,
  `--scope user`, `--scope project`, `--scope bad`, bare `--scope`).

## Product bug fixed

Phase 1 (01-06) recorded that a failed bootstrap row carried no reason and no cause. Claude
Code 2.1.308 prints `Failed to clone marketplace repository: <stderr>` for the same failure.
Fixed under D-01; the failed row now names the typed source
`anthropics/claude-plugins-official`, as `marketplace add` does, instead of the manifest name.

## Deviations

- The first commit attempt was killed by a host restart; the second failed `tsc` (the new
  unit test omitted `completionCache`). Fixed and recommitted; the hook passed.

## Verification

- `node --test` on the three owner tests: all pass. `npx cucumber-js features/plugin/bootstrap.feature`:
  10 scenarios pass. `npm run check:commit` passed in the hook for both commits.
- The 404 scenario fails on the pre-fix code (it asserts the cause chain the old row lacked).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

---
phase: 12-browse-picker
plan: 01
subsystem: edge
tags: [browse, picker, cucumber, terminal]

requires:
  - phase: 01-foundation
    provides: "the picker driver features/lib/plugin-picker.ts and the topic module plugin/picker.steps.ts"
provides:
  - "D-BG-1201: the picker's marketplace row reads `{offered} available • {installed} installed -- {source}` (counts from the catalog and the installation record; parts left out when unknown or zero)"
  - "Scenario B in features/plugin/browse.feature: a bare /claude:plugin opens the picker; first screen, plugins screen, installed actions"
affects: [12-02]

actuals:
  tasks: 2
  commits: 2
plan_head_before: f8de296de2a9f5c7ef8242f402fbfb356d979c95
plan_head_after: 9d10e807

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
    - test/edge/handlers/plugin/browse.test.ts
    - test/edge/browser/plugin-browser.test.ts
    - features/plugin/browse.feature

key-decisions:
  - "D-BG-1201 implemented as planned: `pluginCount: number | undefined` (catalog entries) and `installedCount: number` on MarketplaceEntry; the module-private marketplaceDescription formats the row; browse.ts reads each catalog through loadMarketplaceManifest and assertRecordedMarketplaceName"

requirements-completed: [BROWSE-01]
---

# Plan 12-01 Summary: the marketplace row counts what each catalog offers

## What was built

- `edge/handlers/plugin/browse.ts`: the private `offeredPluginCount(name, source, manifestPath)` loads the catalog through `loadMarketplaceManifest(recordedManifestPath(record))`, checks the name with `assertRecordedMarketplaceName` (D-PL5-28), and returns `manifest.plugins.length`, or `undefined` with a debug-log line when either throws. `loadMarketplaceEntries` builds the rows with `Promise.all` and adds `installedCount: Object.keys(record.plugins).length`. The header comment and JSDoc name the catalog seam (NFR-5, NFR-8).
- `edge/browser/plugin-browser.ts`: `MarketplaceEntry.pluginCount` is `number | undefined`, and the new `installedCount` field is required. The private `marketplaceDescription` joins `N available` and `M installed` (when above 0) with ` • `, then ` -- {source}`; with no part the row is the source alone.
- Unit cases: `browse.test.ts` has a first-screen helper and three cases (counts with one installed plugin, unreadable catalog with one installed plugin, refused catalog name `claude-plugins-v2`). `plugin-browser.test.ts` has five table rows, one per row form; existing literals gained `installedCount: 0`. Both pairs report 100% direct coverage.
- `features/plugin/browse.feature`: scenario B ("A bare plugin command opens the terminal picker on both scopes' marketplaces with the plugins each offers and has installed (D-BG-1201)") replaces the seed "The terminal picker lists the marketplaces of both scopes", word for word from the plan. Both computed values held on the first run: the first-screen rows and `ghost`'s `not installable`.
- `demos/browse-demo.ts` is untouched. It is not type-checked; its literals carry no `installedCount`, so its rows read `<n> available -- <source>` at run time.

## Commits

- `b1023be3` fix(browse): count the plugins each marketplace offers (Task 1, tracer)
- `9d10e807` fix(browse): show how many of a marketplace's plugins are installed (Task 2)

## Verification

- `node --import <worktree>/test/platform/isolated-pi-home.ts --test test/edge/browser/plugin-browser.test.ts test/edge/handlers/plugin/browse.test.ts`: 86 pass, 0 fail.
- `npm run test:coverage:direct -- <each source>`: exit 0 for both pairs.
- `npx cucumber-js --profile adapter --parallel 3 features/plugin/browse.feature`: 6 scenarios passed (Task 1: 15.4 s; Task 2: 22.9 s), first run each time, no rerun.
- `npm run check:features`: exit 0. The commit hook (`check:commit`) passed for both commits.

## Red proofs

All three run with `npx cucumber-js --profile adapter --name 'A bare plugin command opens the terminal picker' features/plugin/browse.feature` after commit `9d10e807`. After each restore, `git status --short` printed only the orchestrator's `.planning/STATE.md`.

- (a) Revert the fix: `git checkout f8de296de2a9f5c7ef8242f402fbfb356d979c95 -- extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts`. B failed at the first-screen `Then` (1 scenario failed, 1 step failed): `+ '1 plugin(s) -- {home}/marketplaces/extras'` / `- '3 available • 1 installed -- {home}/marketplaces/extras'`, and `0 plugin(s)` for `tools` and `broken`. Restored with `git checkout HEAD -- <the same two files>`.
- (b) Drop the installed part: Edit made `marketplaceDescription` test `installedCount > 999`. B failed on the extras row: `+ '3 available -- {home}/marketplaces/extras'` / `- '3 available • 1 installed -- {home}/marketplaces/extras'`. Restored with `git checkout -- extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts`.
- (c) Stop the bare command from opening the picker: Edit routed the empty-head arm of `selectClaudePluginRoute` in `edge/router.ts` to `handlers.help` with commandId `plugin help`. B's open step failed: `Error: the plugin picker timed out after 20000 ms`. Restored with `git checkout -- extensions/pi-claude-marketplace/edge/router.ts`.

## Deviations

- The plan ran inline in the orchestrator session, not in a `gsd-executor` subagent: the agent-isolation guard reads its sentinel from the session's own checkout (the parent milestone checkout), so it refused every executor dispatch, and the auto-mode classifier refused writing the sentinel there. See P12-DC-24.
- Unit tests ran with the literal worktree path in `--import` in place of `$PWD`, because the session's command guard refuses a runtime-computed `--import` value. Same file, same effect.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- Executed inline instead of through a `gsd-executor` subagent (see Deviations).
- The `browse.test.ts` first-screen helper fixes `ctx.cwd` to exactly two reads, as the plan said; a later handler change that reads `ctx.cwd` once more fails these three cases.

---
phase: 07-git-errors-and-lock-discipline
plan: 07
subsystem: plugin-update-preflight
tags: [update, reinstall, git, classifier, lock, cucumber]

requires:
  - "07-01: classifyGitFailure(error, rule, remoteUrl?) -> { reason, frame? }"
  - "07-04: the warm tag reinstall scenario in features/plugin/git-source-update.feature (kept)"
provides:
  - "candidateFailure classifies with the plugin-clone rule and frames an HTTP status as `<status> on <wire url>` (GLK-01, D-PL7-03, D-PL7-14)"
  - "the marketplace tag copy of a tag-pinned path update runs inside withExistingScopeLock of the plugin's scope (GLK-04, D-PL7-06)"
affects: [update, reinstall, update-flow, reinstall-flow]

actuals:
  tokens: 3400
  tasks: 2
  commits: 2
plan_head_before: eff700b9eb058a1baf21ecf2cd81ee77a2df5616
plan_head_after: 3449d6132f68e73d5ef4a4c83a60244247a191b9

tech-stack:
  added: []
  patterns:
    - "The resolver's git-root callback records the plugin's wire URL so the failure verdict can frame the host's answer"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - features/plugin/git-source-update.feature

key-decisions:
  - "The frame Error wraps today's cause (`new Error(frame, { cause })`), so the chain reads frame, transport message, then the GitHub-override `fetched <url>` link"
  - "candidateFailure takes `remoteUrl: string | undefined` as a required options member (exactOptionalPropertyTypes), passed as `{ ...options, remoteUrl }` from the resolver's catch"
  - "Reinstall shares the preflight, so its refused clone row carries the same frame; its unit pin was updated rather than splitting the rule per verb"

requirements-completed: [GLK-01, GLK-04]

duration: 35min
completed: 2026-10-27
status: complete
---

# Phase 07 Plan 07: Update preflight frame and locked tag copy Summary

A plugin update (and reinstall) whose clone the git host refuses now leads the row's cause with `<status> on <wire url>` for 404 and 5xx, and a tag-pinned path-plugin update copies the marketplace tag only while it holds the plugin scope's state lock.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | `426c4bde` | fix(update): frame a refused plugin clone with its status and URL |
| 2 | `3449d613` | fix(update): copy a marketplace tag only under the scope lock |

Range: `426c4bde..3449d613` (base `eff700b9`).

## What changed

**Task 1 (tracer, GLK-01).** `resolveUpdateCandidate`'s `resolveGitPluginRoot` callback stores `networkCloneUrl(gitSource)` before it delegates (a pin override keeps the URL). The catch passes it to `candidateFailure`, which now calls `classifyGitFailure(error, { notFound: "source missing" }, remoteUrl)`. When the result has a frame, the row's cause is `new Error(frame, { cause })`. The auth row keeps its rule (bare unless a `CleanupLeakError` carries the cleanup hint), and an auth result has no frame. A `path` source never sets the URL, so it is never framed. The SRC-01 table's 404 and 503 rows expect the framed cause; the outline's 404 and 503 Examples rows show `404 on https://{git host}/acme/ghp.git, HTTP Error: 404 Not Found, fetched ...` and the 503 equivalent.

**Task 2 (GLK-04).** Only the `(options.pathPinProbe ?? materializeMarketplaceTagClone)(...)` call in `resolvePathPluginRoot` is wrapped in `withExistingScopeLock(options.locations, ...)`, with a GLK-04 / D-PL7-06 comment. A held lock throws `StateLockHeldError`, which the resolver's catch already rethrows. Two unit cases: the probe observes `lockfile.check(...) === true` (asserted `[true]` by `deepStrictEqual`) and the lock is free after `prepare`; with a second holder, `prepare` rejects with `StateLockHeldError` and a probe that calls `assert.fail` is never reached.

## Verification

| Check | Result |
| ----- | ------ |
| `node --test --test-name-pattern 'SRC-01' test/orchestrators/plugin/update-preflight.test.ts` | 8/8 pass, exit 0 |
| `npx cucumber-js features/plugin/git-source-update.feature features/plugin/git-source.feature` | 36 scenarios, 483 steps passed, exit 0 |
| Same git-source-update run with Task 1's source reverted locally | 14 scenarios, 2 failed (the 404 and 503 rows), exit 1: the rows fail without the change |
| `node --test --test-name-pattern 'GLK-04' test/orchestrators/plugin/update-preflight.test.ts` | 2/2 pass; with Task 2's source reverted locally both fail |
| `node --test test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | 493/493 pass |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` | exit 0 (100%) |
| `npx cucumber-js features/plugin/update-dependencies.feature features/plugin/update.feature` | 37 scenarios, 515 steps passed, exit 0 |
| `npx fallow dupes` | exit 0 |
| Commit hook `npm run check:commit` on both commits | passed (both commits exit 0) |
| `npm run fallow` (unpiped) | exit 0 |
| `npm run typecheck` (unpiped) | exit 0 |

Acceptance greps: `classifyGitHostFailure` in update-preflight.ts 0; the framed 404 row 1; the framed 503 row 1; `withExistingScopeLock(options.locations` 1; `withExistingScopeLock(` 2; `classifyGitFailure(` 1.

`npm run check` was not run; the orchestrator runs it at the wave gate.

## Deviations

1. **The drops-the-connection row is not byte-unchanged.** Its cells are unchanged, but the longer framed 404 and 503 cells widen the `cause chain` column, and the cucumber rules require aligned columns, so its padding changed. Keeping the columns aligned wins over byte identity.
2. **Reinstall rows are framed too.** Reinstall runs the same preflight through `materialize-latest.ts`, so a refused reinstall clone now carries the same frame. No reinstall cucumber scenario pins a host refusal row, so none was added or changed; the reinstall unit pin was updated (see Out-of-line edits).

## Out-of-line edits

- `test/orchestrators/plugin/reinstall-flow.test.ts`: the case "SRC-01: a cold-cache reinstall whose git host answers 404 fails as source missing with its cause" pinned the bare `HttpError` cause and the `cause: HTTP Error: 404 Not Found` notification line. Plan Task 2's own verify runs this file, and the shared preflight now frames it, so the expected cause became `new Error("404 on https://github.com/org/repo.git", { cause: notFound })` and the line `cause: 404 on https://github.com/org/repo.git -> HTTP Error: 404 Not Found`. No later plan of this phase lists this file. Committed with Task 1.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
- FOUND: features/plugin/git-source-update.feature
- FOUND: 426c4bde, 3449d613 (both ancestors of HEAD)

---
phase: 07-git-errors-and-lock-discipline
plan: 04
subsystem: plugin-clone-cache
tags: [reinstall, git-source, tag, offline, nfr-5, clone-cache]
status: complete

requires: []
provides:
  - "resolveFetchedRefOffline falls back to the mirror's local refs/tags/<ref> (peeled by platform/git.ts::resolveTagOid) when the tracking ref is missing and the source declares a ref (D-PL7-10, GLK-08)"
  - "materializeOrRefreshPluginMirror takes an optional resolveTagOid argument beside gitOps, defaulted at use (args.resolveTagOid ?? resolveTagOid)"
affects: [reinstall-flow, materialize-latest, clone-cache]

actuals:
  tokens: 3300
  tasks: 2
  commits: 2
plan_head_before: 28c8f8e7e1fba4fa01f170eab0d6e2d2ec31d127
plan_head_after: 5d692cb5d40dcfe0cc33edfffe2811a6b7cab025

tech-stack:
  added: []
  patterns:
    - "Offline ref read: tracking ref first; on NotFound with a declared ref, the local tag; a NotFound or undefined tag read is a miss that refreshes; any other error rethrows"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - test/orchestrators/plugin/clone-cache.test.ts
    - features/plugin/git-source-update.feature

decisions:
  - "The tag read passes a fresh `cache: {}`: `ResolveTagOidOptions.cache` is required (the plan's interface listed it as optional), and one peel per call shares nothing."
  - "The tag fallback lives in a private `resolveLocalTagOffline` helper so `resolveFetchedRefOffline` stays flat."
  - "The no-declared-ref branch (tracking ref missing, no ref) got its own unit case, because the direct-coverage gate needs it and no existing case reached it."

requirements-completed: [GLK-08]

metrics:
  duration: "~17 min"
  completed: 2026-10-27
---

# Phase 07 Plan 04: Offline Tag Resolve on Reinstall Summary

A reinstall of an unpinned git-source plugin whose catalog names a tag ref now reads the commit from the warm mirror's local tag and makes no network request. Before, it refreshed the mirror (a GET and a POST), because a clone for a tag writes `refs/tags/<ref>` and no `refs/remotes/origin/<ref>` (GLK-08, D-PL7-10).

## What changed

- `clone-cache.ts`
  - Imports `resolveTagOid` from `../../platform/git.ts`. `clone-cache.ts` is a `NETWORK_SEAMS` member, and this read is local only.
  - `materializeOrRefreshPluginMirror` takes `resolveTagOid?: typeof resolveTagOid` beside `gitOps?`. It passes `args.resolveTagOid ?? resolveTagOid` to `resolveFetchedRefOffline`. No `GitOps` member was added, and the git-ops fake is unchanged.
  - `resolveFetchedRefOffline` still reads the tracking ref first. A non-NotFound error rethrows as before. On NotFound with no declared ref, it returns undefined, as before. On NotFound with a declared ref, the new `resolveLocalTagOffline` runs `resolveTag({ dir: mirrorRoot, name: ref, cache: {} })`:
    - A commit oid is the answer.
    - `undefined` (a tag that names no commit) is a miss, and the caller refreshes.
    - A NotFound throw is a miss, and the caller refreshes.
    - Any other error rethrows.
  - The JSDoc of `resolveFetchedRefOffline` and the `refresh: false` sentence of the flow comment now describe the tag fallback, citing D-PL7-10 and GLK-08.
- `clone-cache.test.ts`
  - New helper `gitNotFound(ref)`: an Error whose `name` is `NotFoundError`.
  - GLK-08 hit: the tracking-ref read misses in the double, and the stub returns a fixed oid. The case checks the result, the stub's call `{ dir, name: "v2.0.0", cache: {} }`, and empty clone and fetch lists.
  - GLK-08 miss rows (one `for` loop with two sibling tests): the stub rejects NotFound, or it resolves `undefined`. Each row refreshes with exactly one fetch for `v2.0.0` and returns the refreshed sha.
  - GLK-08 error: the stub rejects with an EIO-coded error. The call rejects with that same object, and the clone and fetch lists are empty.
  - GLK-08 no-ref: no declared ref, and the default-branch tracking ref is missing until the refresh fetch. The tag stub is never called, and the call refreshes to HEAD.
  - The existing D-18-04 case "refreshes a declared ref the mirror never fetched" now injects a NotFound-rejecting stub, so it never reads a real repository from a plain directory. Its assertions are unchanged.
- `git-source-update.feature`: new scenario "Reinstalling a plugin at a release tag reads the tag from the fetched copy with no request". It uses only existing steps and ends with `Then the git host receives no request` and `runs revision 2 of its repository`. The result row is `reinstalled ... | 2.0.0`, with no `from` column. The product prints no `from` when the version did not change, as the other same-version reinstall rows show.

## Commits

| Commit | Message |
|--------|---------|
| 41bcf820 | feat(reinstall): read a release tag from the warm plugin mirror |
| 5d692cb5 | test(reinstall): cover the tag misses that still refresh the mirror |

## Verification

| Check | Result |
|-------|--------|
| `node --test --test-name-pattern 'GLK-08' test/orchestrators/plugin/clone-cache.test.ts` | exit 0, 5 tests pass |
| `node --test test/orchestrators/plugin/clone-cache.test.ts` | exit 0, 85 tests pass |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | exit 0 (100% lines, functions, and branches) |
| `npx cucumber-js features/plugin/git-source-update.feature --name 'release tag reads the tag from the fetched copy'` | exit 0, 1 scenario, 14 steps pass |
| `npx cucumber-js features/plugin/git-source-update.feature features/plugin/reinstall.feature` | exit 0, 35 scenarios, 452 steps pass |
| `npm run check:features` | exit 0 |
| `npx eslint` on the two .ts files, `--max-warnings 0` | exit 0 |
| `npm run fallow` (unpiped) | exit 0 |
| `npm run typecheck` (unpiped) | exit 0 |
| commit hook `npm run check:commit` | passed on both commits. The first attempt of 41bcf820 failed typecheck on the missing `cache` field (see Deviations). I fixed it and committed again, with no amend |

Fails-without check: I put back the HEAD version of `clone-cache.ts`, kept the new scenario, and ran it. It failed at `Then the git host receives no request`, because the host logged a GET and a POST for `/acme/ghp.git` (the mirror refresh). Then I restored the change. So the scenario proves the behavior. It also shows that the install leaves `refs/tags/v2.0.0` in the mirror, so the harness-limit fallback in the plan did not apply.

Acceptance greps: `grep -c 'resolveTagOid' clone-cache.ts` = 6 (baseline 0). `grep -c 'readonly resolveTagOid' test/platform/git-ops-fake.ts` = 0.

## Deviations

- **[Rule 3 - Blocking] `cache: {}` on the tag read.** The plan's interface block showed `cache?: object`. In `platform/git.ts`, `ResolveTagOidOptions.cache` is required, so the first commit attempt failed typecheck. The call passes a fresh object, and the hit case asserts it.
- **[Rule 3 - Blocking] Task 1's commit holds two Task 2 arms.** The commit hook needs 100% branch coverage of `clone-cache.ts` from the first commit on. So 41bcf820 also holds the error-rethrow case (Task 2 c) and the new no-ref case. 5d692cb5 holds Task 2 (a) and (b) and the hermetic stub on the existing D-18-04 case. Without that stub, the existing case reaches the real `resolveTagOid` on a plain directory. That read throws NotFound, which covers the miss arm, and the case passes.
- **Added case: no declared ref, missing tracking ref.** The plan did not list it, but the `ref === undefined` arm of the fallback needs it for branch coverage.

## Out-of-line edits

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts (`resolveTagOid ??` default, `resolveLocalTagOffline`)
- FOUND: features/plugin/git-source-update.feature (scenario "Reinstalling a plugin at a release tag reads the tag from the fetched copy with no request")
- FOUND: 41bcf820, 5d692cb5 (ancestors of HEAD)

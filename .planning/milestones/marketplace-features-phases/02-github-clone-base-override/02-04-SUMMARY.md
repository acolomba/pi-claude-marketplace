---
phase: 02-github-clone-base-override
plan: 04
subsystem: orchestrators
tags: [github, env-override, typed-errors, reinstall, fetch, info, update]

requires:
  - phase: 02-03
    provides: "rethrowInvalidGitHubBaseUrl(err) in shared/errors.ts, and the rethrow-first pattern for per-target catches"
  - phase: 02-02
    provides: "buildCloneAuth / hostFromCloneUrl, which read the variable and throw the typed error"
provides:
  - "plugin reinstall, plugin fetch, plugin info --fetch, and plugin update (direct, bulk, and the autoupdate cascade entry) fail as a whole on an invalid base"
  - "bare info is proven not to read the variable (GHB-04 / NFR-5 case)"
affects: [02-05 docs and phase gate]

actuals:
  tokens: 8700
  tasks: 3
  commits: 3
plan_head_before: 080fc7272e43b2857d0a15c8fb5983dde17a58db
plan_head_after: 32b79b101b243f107ba162b0ceca0570ab5ebfcb

tech-stack:
  added: []
  patterns:
    - "Each per-target catch on a GitHub network path calls rethrowInvalidGitHubBaseUrl as its first statement, then keeps its existing degrade or failed-row behavior for every other error"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/update-preflight.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts

key-decisions:
  - "The update-preflight case injects the typed error through the clone-cache seam: its harness calls preparePluginUpdate with no notification context, so the probe builds a stored-credential bundle for a url source and never reads the variable"
  - "The update-flow cases that need SHA_OLD sit after its declaration (near the cascade auth cases), because ESLint no-use-before-define rejects the earlier PUP-9 position"
  - "A bulk update or reinstall that meets the typed error after an earlier target committed fails without reporting that target; T-02-13 accepts this, since D-08 makes the whole command fail"

patterns-established:
  - "A rethrow case asserts the rejection with deepStrictEqual against a fresh InvalidGitHubBaseUrlError (or strictEqual for an injected instance) and verifies a strict notification double that allows no call"

requirements-completed: [GHB-03, GHB-04]

coverage:
  - id: D1
    description: "plugin reinstall and plugin fetch reject with the typed error, render no row, and run no later target"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#GHB-03: reinstalling a pinned GitHub-source plugin on an invalid base fails the command"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts#GHB-03: fetching a GitHub-source plugin on an invalid base fails the command instead of rendering a failed row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts#classifies a denied Device Flow as authentication required (unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "info --fetch rejects with the typed error for installed and not-installed GitHub plugins; bare info renders the same row and makes no git call with the invalid value set"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#GHB-03: info --fetch on a not-installed GitHub plugin fails the command on an invalid base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#GHB-03: info --fetch on an installed GitHub plugin fails the command on an invalid base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#GHB-04 / NFR-5: bare info on a GitHub plugin ignores an invalid base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-81-04: info --fetch degrades ... when the fetch THROWS (unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "plugin update rejects with the typed error from candidate resolution, the marketplace sync, the per-target update, and the autoupdate cascade entry; a transport failure still skips as network unreachable"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#GHB-03: an invalid base rethrows from candidate resolution instead of skipping as no longer installable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#GHB-03: a GitHub marketplace sync on an invalid base fails the update command"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#GHB-03: a GitHub-source plugin update on an invalid base fails the update command"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#GHB-03: the cascade's single-plugin update rethrows an invalid base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#classifies a clone transport failure without exposing a raw throw (unchanged)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts (autoupdate cascade cases, unchanged)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 04: Invalid GitHub Base Fails Reinstall, Fetch, Info --fetch, and Update Summary

**Seven per-target catches in `reinstall`, `fetch`, `info --fetch`, and `update` now call `rethrowInvalidGitHubBaseUrl` first. An invalid `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` fails each of these commands with the typed error that names the variable. No `(failed)`, `(skipped) {no longer installable}`, or degraded `components: not resolved` row appears, and no later target runs. Bare `info` renders the same row with the invalid value set, because it never reads the variable.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-16T01:11:31Z
- **Completed:** 2026-10-16T01:26:30Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `reinstallPluginWithTransaction` rethrows before `handleSinglePluginFailure`. The bulk loop has no catch of its own, so a bulk reinstall ends at that target.
- `fetchOne` rethrows before `failedRow`. The module header, the sweep-loop comment, and the `fetchOne` JSDoc no longer say the sweep never throws. They name the one exception (GHB-03).
- `info.ts`: `buildInstalledGitRow` and the `buildGitNotInstalledRow` probe catch both rethrow before they degrade. The `fetch` option doc, the `makeFetchProbe` JSDoc, both catch comments, and the `buildNotInstalledRow` branch comment now say that a transport failure still degrades (D-81-04) and an invalid override fails info.
- `resolveUpdateCandidate` rethrows before the transport classifier, so the typed error can no longer become `(skipped) {no longer installable}`. The "genuinely unexpected" comment names the rethrown error.
- `update-flow.ts`: the marketplace-sync catch, the per-target `runPluginUpdate` catch, and the `updateSinglePluginWith` catch all rethrow. The module header, the section banner, the `updateSinglePluginWith` JSDoc, and its catch comment no longer say "NEVER throws". They say the cascade entry rethrows only an invalid override, which fails the marketplace command.

## Task Commits

1. **Task 1: Fail reinstall and fetch as a whole on an invalid base** - `a3c1fd6b` (fix). Commit hook `npm run check:commit` passed on the first attempt.
2. **Task 2: Fail info --fetch on an invalid base while bare info never reads it** - `d7307e44` (fix). Commit hook `npm run check:commit` passed on the first attempt.
3. **Task 3: Fail plugin update as a whole on an invalid base** - `32b79b10` (fix). The first commit attempt failed in the hook's lint step: two new cases used `SHA_OLD` before its declaration (`@typescript-eslint/no-use-before-define`). Nothing was committed. The two cases moved below the declaration, and the second attempt passed `npm run check:commit`.

**Plan metadata:** the docs commit that records this summary.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts` - rethrow in the single-plugin catch.
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` - rethrow in `fetchOne`; header, loop comment, and JSDoc.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - rethrow in both git row builders; five comment fixes.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - rethrow in `resolveUpdateCandidate`; fallback comment.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` - three rethrows; header, banner, JSDoc, and catch comment.
- Tests: 1 reinstall case, 1 fetch case, 3 info cases, 1 update-preflight case, 3 update-flow cases.

## Verification

- `node --test tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/plugin/fetch.test.ts`: 180 pass, 0 fail.
- `node --test tests/orchestrators/plugin/info.test.ts`: 218 pass, 0 fail.
- `node --test tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/marketplace/update.test.ts`: 324 pass, 0 fail. The 02-03 autoupdate cascade case still passes.
- `npm run test:coverage:direct -- <source>` exited 0 (100%) for `fetch.ts`, `reinstall-flow.ts`, `info.ts`, `update-flow.ts`, and `update-preflight.ts`.
- Acceptance greps for `rethrowInvalidGitHubBaseUrl(`: reinstall-flow.ts 1, fetch.ts 1, info.ts 2, update-flow.ts 3, update-preflight.ts 1. Each named test title appears once.
- `npx fallow audit --base 080fc727`: verdict `pass`, 0 introduced findings. One inherited clone group is in `info.ts` at lines 2192-2206 and 2305-2319. This plan did not touch those lines.
- `npm run check` was not run. Plan 02-05 owns the phase gate.

### TDD evidence

- Task 1 RED: the reinstall and fetch cases each failed because the command tried to render a failed row: the strict boundary threw `UnsupportedModeError` where the typed error was expected.
- Task 2 RED: both `info --fetch` cases failed the same way, because info tried to render the degraded row. The bare-info case passed before the change by design. It pins that bare info never reads the variable.
- Task 3 RED: the preflight case failed with `Missing expected rejection` (the candidate became a skipped row). The three update-flow cases were run against the committed `update-flow.ts`, with the preflight fix in place. The sync and per-target cases failed with `UnsupportedModeError` (a failed row was rendered). The cascade case failed with `Missing expected rejection` (a failed outcome was returned). The update-flow change had been drafted first. It was set aside for this run and restored afterwards, so the RED result shows that the tests fail without it.
- GREEN: as the plan requires, each task's tests and code went into one commit.

### Hand-planted controls (not committed)

- `info.ts`: replaced only the first rethrow with `void err;`, and the installed case alone failed. Replaced only the second rethrow, and the not-installed case alone failed. The file was restored from a scratch copy each time.
- `update-flow.ts`: replaced each of the three rethrows in turn. The sync case, the per-target case, and the cascade case each failed alone, matching its own site. The file was restored from a scratch copy each time.
- `update-preflight.ts`: replaced the rethrow. The preflight case, the per-target case, and the cascade case failed. The sync case passed, because it never reaches candidate resolution. The file was restored, and the final `git diff --stat` showed only the intended change.

## Decisions Made

- The preflight case injects the typed error through the clone-cache seam. The plan allows this when the harness does not reach the real auth helper. The preflight harness calls `preparePluginUpdate` with no notification context, so the probe uses `buildStoredCredentialAuth` for a url source and never reads the variable.
- The direct and cascade update cases reuse `seedGitUpdateMarketplace` with an unpinned GitHub source. An unpinned source goes through `probeUnpinned`, which builds clone auth (`buildCloneAuth` in the direct path, `hostFromCloneUrl` in the cascade path), and both read the variable.
- The reinstall case uses a pinned GitHub source. `probeReinstallClone` skips the warm mirror for a pinned source and always builds clone auth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] update-flow case placement**
- **Found during:** Task 3
- **Issue:** The plan pointed to the PUP-9 cascade-vs-direct cases as analogs. Two new cases placed next to them used `SHA_OLD` before its declaration, and lint failed in the commit hook.
- **Fix:** Moved both cases after the declaration, next to the cascade auth cases that use the same seed.
- **Files modified:** tests/orchestrators/plugin/update-flow.test.ts
- **Verification:** `npx eslint` on the file exited 0; the second commit attempt passed the hook.
- **Committed in:** 32b79b10

**2. [Rule 2 - Stale doc] Extra comment fixes**
- **Found during:** Tasks 1-3
- **Issue:** The plan listed the comments to fix. This change also made other comments false: the fetch sweep-loop "NEVER-throws" comment, the info `fetch` option doc and `buildNotInstalledRow` branch comment, and the update-flow module header and section banner.
- **Fix:** Rewrote each one to name the GHB-03 exception. Only comments changed.
- **Files modified:** fetch.ts, info.ts, update-flow.ts
- **Committed in:** a3c1fd6b, d7307e44, 32b79b10

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 stale doc). **Impact:** no scope change.

## Issues Encountered

- Task 3's first commit attempt failed in the hook (see Deviation 1). No commit was made, and no `--amend` or `--no-verify` was used.
- If a bulk `update` or `reinstall` meets the typed error after an earlier target has already committed, the command fails without a row for that earlier target. This follows D-08, and the plan accepts it as T-02-13. The commands succeed again once the variable is fixed (NFR-3).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-02-12 is mitigated as planned: each listed catch rethrows first, and one case per command asserts the typed error and no row. T-02-14 is mitigated: the bare-info case runs with an invalid value set and asserts the unchanged row and zero clone and fetch calls. T-02-13 is accepted as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-05 (docs and the phase gate, `npm run check`).
- Every command that reads the variable now fails as a whole on an invalid value: marketplace add/update, install, import, enable, reinstall, fetch, info --fetch, and update.

---
*Phase: 02-github-clone-base-override*
*Completed: 2026-10-16*

## Self-Check: PASSED

- FOUND: every file listed in key-files.modified
- FOUND: a3c1fd6b, d7307e44, 32b79b10 (ancestors of HEAD)

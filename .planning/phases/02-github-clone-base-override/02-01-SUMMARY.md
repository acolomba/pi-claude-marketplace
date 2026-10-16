---
phase: 02-github-clone-base-override
plan: 01
subsystem: platform-git
tags: [isomorphic-git, env-override, insteadof, github, typed-errors]

requires: []
provides:
  - "shared/github-base-url.ts: gitHubWireUrl(url), the one seam that reads PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL"
  - "InvalidGitHubBaseUrlError (variable, problem) in shared/errors.ts"
  - "platform/git.ts clone, fetch, resolveRemoteRef, listRemoteTags send the wire URL; clone restores the canonical origin; rewritten failures carry a `fetched <wire url>` cause"
  - "tests/shared/github-base-url-environment.ts: setGitHubBaseUrl(t, value)"
affects: [02-02 auth host, 02-03 verbs, 02-04 literal gate, 02-05 docs and phase gate]

actuals:
  tokens: 8240
  tasks: 2
  commits: 2
plan_head_before: 033e5b9152d63acd1d53f3470c816a2dfba7fb42
plan_head_after: 43e084b7686e9d6e34e4242feec2ef23394df615

tech-stack:
  added: []
  patterns:
    - "insteadOf rewrite at the platform chokepoint: identity stays github.com, only the wire URL follows the base"
    - "Env read on every call, only after the github.com prefix matched"
    - "Cause tail attached only on a rewritten call, so unset output is unchanged"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/github-base-url.ts
    - tests/shared/github-base-url.test.ts
    - tests/shared/github-base-url-environment.ts
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/platform/git.ts
    - tests/shared/errors.test.ts
    - tests/platform/git.test.ts

key-decisions:
  - "setGitHubBaseUrl registers its restore only on the first call per test (WeakSet of contexts): node:test runs after hooks in registration order, so a second restore would put back the first call's value and leak it into later cases"
  - "fetch reads remote.<remote ?? origin>.url and, when rewritten, passes both remote and url to isomorphic-git; a remote with no recorded url passes nothing new and keeps isomorphic-git's MissingParameterError"
  - "The cause-tail helper (withFetchedUrlCause) casts the caught value to Error with a comment: isomorphic-git and the in-file HTTP client reject only with Error instances, and a non-Error branch would be uncoverable"

patterns-established:
  - "Override test cases set the variable only through setGitHubBaseUrl(t, value)"

requirements-completed: [GHB-01, GHB-03, GHB-04]

coverage:
  - id: D1
    description: "A github.com clone downloads from the base through real isomorphic-git and records the canonical origin"
    requirement: GHB-01
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#GHB-01: clones a github.com URL from the base and records the canonical origin"
        status: pass
    human_judgment: false
  - id: D2
    description: "fetch, resolveRemoteRef and listRemoteTags send the wire URL; fetch updates refs/remotes/origin/main and keeps the canonical origin"
    requirement: GHB-01
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#GHB-01 / D-02: fetches a canonical github.com origin from the base and keeps the recorded origin"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#GHB-01: resolves a github.com URL against the base"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#GHB-01: lists the tags of a github.com URL from the base"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seam rewrite, path prefix, trailing-slash normalization, exact-prefix match, per-call read"
    requirement: GHB-01
    verification:
      - kind: unit
        ref: "tests/shared/github-base-url.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every refused form throws InvalidGitHubBaseUrlError with the exact slash-free message that never echoes the value"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/shared/github-base-url.test.ts#GHB-03: refuses base ..."
        status: pass
      - kind: unit
        ref: "tests/shared/errors.test.ts#InvalidGitHubBaseUrlError"
        status: pass
    human_judgment: false
  - id: D5
    description: "Unset and non-GitHub URLs pass the same options as before and carry no cause tail; rewritten failures name the fetched URL"
    requirement: GHB-04
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#GHB-04: an unrewritten failed fetch carries no fetched cause"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#GHB-04: a clone of a non-GitHub URL ignores an invalid base"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#D-10: a failed fetch from the base names the fetched URL"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts (every pre-existing case, unchanged)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 01: GitHub Clone-Base Seam and Platform Rewrite Summary

**`gitHubWireUrl` reads PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL on every call and rewrites the exact `https://github.com/` prefix onto a validated https base; all four GitHub network calls in `platform/git.ts` send that wire URL, a clone resets `remote.origin.url` to the canonical github.com URL, and a rewritten failure carries a `fetched <wire url>` cause.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-16T00:15:51Z
- **Completed:** 2026-10-16T00:29:05Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- Tracer: a clone of `https://github.com/owner/repo.git` with the variable set to the mocked transport's host downloads through real isomorphic-git from the base and records the canonical origin (D-01, D-07).
- `shared/github-base-url.ts` exports exactly one function. It validates in a fixed order (not-a-url, scheme, userinfo, fragment, query), reads `href` for `?`/`#` because WHATWG reports empty `search`/`hash` for a bare `?` or `#`, keeps the base's path prefix and strips every trailing slash with a loop (no regex, `sonarjs/slow-regex`).
- `InvalidGitHubBaseUrlError` carries `variable` and `problem`; its message is the variable plus a fixed rule text, with no slash and never the value (AUTH-09, D-08).
- `fetch` reads the recorded origin and passes the wire URL as an explicit `url` beside the remote name, so tracking refs update while `.git/config` stays canonical (D-02).
- `withFetchedUrlCause` adds the `fetched <wire url>` cause tail only on a rewritten call whose error has no cause; an unrewritten call runs without a `try` (D-10, GHB-04).

## Task Commits

1. **Task 1: Tracer -- a github.com clone goes to the base and keeps its canonical origin** - `3f7cced1` (feat). Commit hook `npm run check:commit` passed on the second attempt (all pairs, because the staged environment helper is test support). The first attempt failed lint: `import-x/order` (blank line inside the parent import group in `tests/platform/git.test.ts`); fixed and recommitted.
2. **Task 2: Send every GitHub fetch, ref lookup, and tag listing to the base, and name the fetched URL on failure** - `43e084b7` (feat). Commit hook `npm run check:commit` passed on the first attempt.

**Plan metadata:** see the final docs commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/github-base-url.ts` - the seam: `gitHubWireUrl(url)` and the private validating reader.
- `extensions/pi-claude-marketplace/shared/errors.ts` - `InvalidGitHubBaseUrlError` after `TooManyRedirectsError`.
- `extensions/pi-claude-marketplace/platform/git.ts` - wire URL in clone, fetch, resolveRemoteRef, listRemoteTags; origin reset after a rewritten clone; `withFetchedUrlCause`.
- `tests/shared/github-base-url.test.ts` - pair test: rewrite rows, unchanged rows, invalid-but-unread, per-call read, 13 refused rows with whole-value comparison.
- `tests/shared/github-base-url-environment.ts` - `setGitHubBaseUrl(t, value)`.
- `tests/shared/errors.test.ts` - one data-row case per problem.
- `tests/platform/git.test.ts` - 10 override cases across clone, fetch, resolveRemoteRef, listRemoteTags.

## Verification

- `node --test tests/shared/github-base-url.test.ts tests/shared/errors.test.ts tests/platform/git.test.ts`: 235 pass, 0 fail.
- `npm run test:coverage:direct -- <source>` exit 0 (100%) for `shared/github-base-url.ts`, `shared/errors.ts`, `platform/git.ts`.
- Every pre-existing `tests/platform/git.test.ts` case passes unchanged with the variable unset (GHB-04).
- `npx fallow dupes` exit 0 before the Task 2 commit.
- Tracer feedback gate (interactive, end-of-phase, automated-only verify): re-ran the tracer verify after commit `3f7cced1`, 227 pass, then expanded.

### TDD evidence

- Task 1 RED: before the seam existed, `GHB-01: clones a github.com URL from the base ...` failed with `unplanned Git HTTP request: GET https://github.com/owner/repo.git/info/refs?service=git-upload-pack` (the request went to github.com, the planned failure); the errors test failed to load because `InvalidGitHubBaseUrlError` did not exist yet.
- Task 2 RED: five new override cases failed. Four sent `GET https://github.com/owner/repo.git/info/refs...` to the transport, and the D-10 case failed its `HttpError` assertion for the same reason. `D-10: a rewritten failure keeps a cause it already carries` and `GHB-04: an unrewritten failed fetch carries no fetched cause` passed before the change by design: they guard against a wrong implementation, which the planted controls below prove.
- GREEN: both tasks' tests and code committed together, as the plan requires (the hook rejects a failing test).

### Hand-planted controls (not committed)

- Replaced the `git.setConfig(... "remote.origin.url" ...)` call in `clone` with `void 0;` and ran `node --test --test-name-pattern 'GHB-01: clones' tests/platform/git.test.ts`: 1 fail, `actual: { kind: 'origin', url: 'https://git.example.invalid/owner/repo.git' }` vs `expected: { ..., url: 'https://github.com/owner/repo.git' }`. Reverted with `git checkout -- extensions/pi-claude-marketplace/platform/git.ts`.
- Changed `if (failure.cause === undefined)` to `if (failure.cause !== null)` in `withFetchedUrlCause` and ran `node --test --test-name-pattern 'D-10' tests/platform/git.test.ts`: 1 pass, 1 fail (`D-10: a rewritten failure keeps a cause it already carries`). Reverted the same way.

## Decisions Made

- `setGitHubBaseUrl` registers the restore only once per test context. `node:test` runs `after` hooks in registration order, so a second registration (the per-call-read case sets the variable twice) would restore the first call's value and leak it into later cases.
- `fetch` passes `remote` and `url` together only when rewritten; otherwise it spreads exactly the previous options.
- The cause-tail helper treats the caught value as `Error` with a comment instead of an `instanceof` branch that no test could reach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test helper would leak the variable when called twice in one test**
- **Found during:** Task 1 (writing the per-call read case)
- **Issue:** the planned helper registers a restore on every call; with FIFO `after` hooks the second restore put back `https://a.example`, leaking it into the next case.
- **Fix:** a module-level `WeakSet<TestContext>` so only the first call per test saves and restores the starting value.
- **Files modified:** tests/shared/github-base-url-environment.ts
- **Verification:** all 235 cases pass in one process, including the unset cases that run after the per-call case.
- **Committed in:** 3f7cced1

**2. [Rule 3 - Blocking] Comment anchor**
- **Found during:** Task 2
- **Issue:** the plan names the helper's behavior D-10, but its own execution notes require code comments to cite GHB IDs (bare `D-0N` collides with older decisions in `extensions/`).
- **Fix:** the helper's JSDoc cites GHB-01 and GHB-04. Test titles keep the plan's exact `D-10:` / `GHB-01 / D-02:` wording, which the acceptance criteria grep for.
- **Committed in:** 43e084b7

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). **Impact:** no scope change.

## Issues Encountered

- First Task 1 commit attempt failed the hook on `import-x/order`; fixed and recommitted (no `--amend`).
- Prettier unquoted the problem keys in the rule record and test map (`"not-a-url"` stays quoted).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-02: the auth-host exports (`gitHubOverrideHost` / `gitHubHost`) join `shared/github-base-url.ts` with their consumer. The GitHub origin constant stays private until `domain/clone-key.ts` imports it.
- Assumption A-04 holds locally: `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` was unset in the executor shell.

---
*Phase: 02-github-clone-base-override*
*Completed: 2026-10-16*

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/shared/github-base-url.ts, tests/shared/github-base-url.test.ts, tests/shared/github-base-url-environment.ts
- FOUND: 3f7cced1, 43e084b7 (ancestors of HEAD)

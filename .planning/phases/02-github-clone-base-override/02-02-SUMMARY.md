---
phase: 02-github-clone-base-override
plan: 02
subsystem: auth
tags: [github, env-override, git-credential, device-flow, auth-host]

requires:
  - phase: 02-01
    provides: "shared/github-base-url.ts gitHubWireUrl seam, InvalidGitHubBaseUrlError, setGitHubBaseUrl test helper"
provides:
  - "shared/github-base-url.ts: GITHUB_HOST and gitHubOverrideHost() (the base's WHATWG host[:port])"
  - "orchestrators/auth-host.ts: buildGitHubAuth, the one GitHub auth helper; hostFromCloneUrl and buildCloneAuth follow the override"
  - "marketplace add, marketplace update, and the plugin-update marketplace sync build GitHub bundles through buildGitHubAuth"
affects: [02-03 verbs, 02-04 literal gate, 02-05 docs and phase gate]

actuals:
  tokens: 11970
  tasks: 2
  commits: 2
plan_head_before: b90326caadc9169ffb2048a3895ec2640d051c62
plan_head_after: d64a9ab4d8ebdc2b188324ab3c9ffd069bda145e

tech-stack:
  added: []
  patterns:
    - "While the variable is set, a GitHub bundle is a stored credential for the override host, built without a provider lookup"
    - "A GitHub bundle is built only inside a github arm, so path and url paths never read the variable"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/github-base-url.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - tests/shared/github-base-url.test.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts

key-decisions:
  - "GITHUB_HOST moved into the seam, and the seam's github.com origin is derived from it, so the module holds the only github.com host literal for the D-06 rule"
  - "buildCloneAuth builds its optional-collaborator bag once and routes kind github, or a url the base rewrites, to buildGitHubAuth"
  - "The seam test file now has one describe per entrypoint (gitHubWireUrl, gitHubOverrideHost), as the unit-test rules require for a module with several entrypoints"

patterns-established:
  - "Verb override cases set the variable inside the arrange block through setGitHubBaseUrl(t, value) and compare the recorded auth bundle as a whole value"

requirements-completed: [GHB-02, GHB-04]

coverage:
  - id: D1
    description: "gitHubOverrideHost returns the base's host[:port] (default port dropped, IPv6 brackets kept, host lowercased), undefined when unset or empty, and throws the typed error for an invalid value"
    requirement: GHB-02
    verification:
      - kind: unit
        ref: "tests/shared/github-base-url.test.ts#gitHubOverrideHost"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildGitHubAuth returns a stored-credential bundle for the override host with no Device Flow, also for github.com and gitlab.com bases; unset it returns the github.com device-flow bundle"
    requirement: GHB-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#GHB-02: returns a stored-credential bundle for the override host"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#D-04: starts no Device Flow for a ${base} base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#returns the github.com device-flow bundle when unset"
        status: pass
    human_judgment: false
  - id: D3
    description: "hostFromCloneUrl and buildCloneAuth bind the override host for github and github.com git-subdir sources; a url source ignores an invalid value"
    requirement: GHB-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#hostFromCloneUrl GHB-02 / D-09 / url cases"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#buildCloneAuth GHB-02 / D-09 override cases"
        status: pass
    human_judgment: false
  - id: D4
    description: "marketplace add clones the canonical URL with the override-host stored credential; an owned leftover with a canonical origin recovers under the override"
    requirement: GHB-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#GHB-02: a GitHub add under the override clones the canonical URL with the override-host stored credential"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#GHB-02 / D-02: an owned leftover with a canonical origin recovers under the override"
        status: pass
    human_judgment: false
  - id: D5
    description: "marketplace update and the plugin-update sync fetch with the override-host bundle; a url marketplace update and a path-only plugin update work with an invalid value set"
    requirement: GHB-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#GHB-02: updating a GitHub marketplace under the override fetches with the override-host bundle"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#GHB-04: updating a url marketplace ignores an invalid override"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#GHB-02: the GitHub marketplace sync under the override binds the override host"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts#GHB-04: a path-only update ignores an invalid override"
        status: pass
      - kind: unit
        ref: "the five owner test files, every pre-existing case unchanged"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 02: GitHub Auth Host Follows the Override Summary

**`buildGitHubAuth` builds every GitHub auth bundle: with `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set it is a stored credential bound to the base's `host[:port]` with no Device Flow, even for a github.com or gitlab.com base; unset it is today's github.com bundle. `marketplace add`, `marketplace update`, the `plugin update` sync, and every plugin clone path (through `buildCloneAuth`) use it.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-16T00:34:21Z
- **Completed:** 2026-10-16T00:46:52Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- The seam exports `GITHUB_HOST` and `gitHubOverrideHost()`. The private reader returns the normalized base and its WHATWG `host`, which is the form `onAuth` in `platform/git-auth-callbacks.ts` compares.
- `buildGitHubAuth` skips the provider registry while the variable is set, so D-04 ("Device Flow never runs for the override host") holds for every value.
- `hostFromCloneUrl` follows the override for github sources and for a github.com git-subdir url (D-09). `buildCloneAuth` routes both to `buildGitHubAuth`. `update-preflight.ts`'s autoupdate branch needed no change: its `hostFromCloneUrl` call now yields the override host.
- `auth-host.ts` no longer exports its own github host constant. The inline github.com clone-URL template in `marketplace/update.ts` is gone. `update-flow.ts` builds the GitHub bundle inside the github arm, so a path-only run never reads the variable.

## Task Commits

1. **Task 1: Bind every GitHub auth bundle to the override host through one helper** - `af2e5beb` (feat). Commit hook `npm run check:commit` passed on the first attempt.
2. **Task 2: Prove the override reaches add, update, and the plugin-update sync, and never a path or url source** - `d64a9ab4` (test). Commit hook `npm run check:commit` passed on the first attempt.

**Plan metadata:** the docs commit that records this summary.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/github-base-url.ts` - `GITHUB_HOST`, `gitHubOverrideHost()`; the reader returns `{ url, host }`.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` - `buildGitHubAuth`; `hostFromCloneUrl` and `buildCloneAuth` follow the override; header updated.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - `addGithubInGuard` calls `buildGitHubAuth`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - `refreshRecord`'s github arm calls `buildGitHubAuth`; unused imports removed.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` - `makeSyncCloneOnce` builds the GitHub bundle in the github arm.
- `tests/shared/github-base-url.test.ts` - existing cases moved under `describe("gitHubWireUrl")`; new `describe("gitHubOverrideHost")`.
- `tests/orchestrators/auth-host.test.ts` - 3 `hostFromCloneUrl` cases, new `describe("buildGitHubAuth")` (5 cases), 2 `buildCloneAuth` override cases.
- `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/update-flow.test.ts` - two override cases each.

## Verification

- `node --test` over the seam, auth-host, add, update, and update-flow owner tests: 458 pass, 0 fail after Task 1. The three verb owner tests: 375 pass, 0 fail after Task 2. Every pre-existing case passes unchanged with the variable unset (GHB-04).
- `npm run test:coverage:direct -- <source>` exit 0 (100%) for `orchestrators/auth-host.ts`, `shared/github-base-url.ts`, and `orchestrators/plugin/update-flow.ts`; the commit hooks also ran direct coverage for every staged pair.
- `npx fallow dupes` exit 0 with no clone group in a touched file; `npx fallow audit --base b90326ca` exit 0.
- `npx tsc --noEmit` clean after the call-site switch.

### TDD evidence

- RED: before the implementation, both `tests/shared/github-base-url.test.ts` and `tests/orchestrators/auth-host.test.ts` failed to load because `gitHubOverrideHost` and `buildGitHubAuth` did not exist (`tsc` TS2305 on both imports). That is a load failure, not an assertion failure; the hand-planted controls below supply the assertion-level proof.
- GREEN: tests and code committed together in `af2e5beb`, as the plan requires.

### Hand-planted controls (not committed)

- `buildGitHubAuth` changed to `return buildAuthForHost({ ...args, host: overrideHost ?? GITHUB_HOST })`, which looks up the provider for the override host. Then `node --test --test-name-pattern 'D-04|GHB-02' tests/orchestrators/auth-host.test.ts`: 3 pass, 2 fail (`D-04: starts no Device Flow for a https://github.com/mirror base` and the gitlab.com row). The file was restored from a scratch copy.
- `makeSyncCloneOnce` given an eager `void buildGitHubAuth(...)` at factory creation. Then `node --test --test-name-pattern 'GHB-04' tests/orchestrators/plugin/update-flow.test.ts`: 0 pass, 1 fail (the path-only update threw the typed error). The file was restored from a scratch copy, and `git diff --quiet` confirmed it was clean.

## Decisions Made

- `GITHUB_HOST` lives in the seam, and the private github.com origin is derived from it as `https://${GITHUB_HOST}`, so the D-06 rule has one module with the host literal.
- `buildCloneAuth` builds its collaborator bag once and passes it to either `buildGitHubAuth` or `buildAuthForHost`. The optional-field spreads appear once, not twice.
- The plan named `GHB-03: throws the typed error for an invalid override` for `buildGitHubAuth` only. The seam test gained a matching `GHB-03` case for `gitHubOverrideHost` (plan step 1 asked for it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seam tests regrouped under one describe per entrypoint**
- **Found during:** Task 1
- **Issue:** adding a second exported function made the seam a multi-entrypoint module. The unit-test rules (`cases.md`) require one top-level `describe()` per entrypoint.
- **Fix:** the existing cases moved, unchanged, under `describe("gitHubWireUrl")`, and the new cases sit under `describe("gitHubOverrideHost")`.
- **Files modified:** tests/shared/github-base-url.test.ts
- **Verification:** 41 seam cases pass.
- **Committed in:** af2e5beb

**2. [Rule 1 - Bug] Path-only update expectation corrected to the real no-op output**
- **Found during:** Task 2
- **Issue:** the first draft of `GHB-04: a path-only update ignores an invalid override` expected a `(skipped) {up-to-date}` tree. A marketplace-target no-op actually renders `Plugin update: nothing to update`, which an existing case in the same file (line 776) also asserts for the same seed.
- **Fix:** the case now expects that message, and it also asserts zero `fetch`/`forceUpdateRef`/`checkout`/`resolveRef` calls.
- **Files modified:** tests/orchestrators/plugin/update-flow.test.ts
- **Committed in:** d64a9ab4

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug in a draft test). **Impact:** no scope change.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-02-06 and T-02-07 are mitigated as planned: the bundle host equals the override's WHATWG host, and no provider lookup runs while the variable is set. The `D-04` data rows and the planted control prove the second point. T-02-08 is mitigated: the path-only and url update cases pass with an invalid value set.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-03. The remaining GitHub verbs (install, reinstall, fetch, `info --fetch`, tag probes) already reach `buildCloneAuth`, so they bind the override host. Their owner tests still need override cases.
- Assumption A-05 now holds in code: while the variable is set, GitHub auth is always a stored credential, even for a github.com or gitlab.com base.

---
*Phase: 02-github-clone-base-override*
*Completed: 2026-10-16*

## Self-Check: PASSED

- FOUND: all ten modified files listed in key-files
- FOUND: af2e5beb, d64a9ab4 (ancestors of HEAD)

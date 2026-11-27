---
phase: 05-credential-surface
plan: 09
subsystem: credentials
tags: [system-git, credentials, auth-host, refactor]

requires:
  - phase: 05-credential-surface
    provides: "05-06 made every bundle a stored-credential bundle; 05-08 left `GitAuthBundle` with one arm"
provides:
  - "`authBundleFor(cloneUrl, kind)`, the one bundle function in `orchestrators/auth-host.ts`"
  - "The marketplace tag probe's `withHostBundle?: true` option"
  - "`UpdateConstraintOptions.notification` in place of `auth`"
  - "Clone and tag probes, fetch, info, update, sync, and add with no auth context"
affects: [05-10, 05-12, credential surface]

actuals:
  tokens: 36055
  tasks: 3
  commits: 3
plan_head_before: d06b3ab5c888785a16dead2e7a09ebc30f4a4bc0
plan_head_after: ddbf3250b2dbe7eeb3ea9a646012fb4d6d586d0f

tech-stack:
  added: []
  patterns:
    - "A bundle comes from `authBundleFor(address, kind)`; no verb carries a notification context or a credential surface to get one"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
    - test/orchestrators/auth-host.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/plugin/carried-marketplace-adds.test.ts
    - test/orchestrators/plugin/dependency-tag-probe.test.ts
    - test/orchestrators/plugin/fetch.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/install-cascade.test.ts
    - test/orchestrators/plugin/install-clone-probe.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/marketplace-tag-probe.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/update-constraint-gate.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/update-preflight.test.ts
  deleted: []

key-decisions:
  - "`hostFromCloneUrl` binds the same host as the deleted builders for every source kind and spelling (450 address, kind, and override combinations compared before any builder was deleted, 0 differences), so no builder host was kept"
  - "`resolveAuth` stays: the tag copy's `resolveAuth` is `authBundleFor` itself, because `materializeMarketplaceTagClone` (clone-cache.ts) takes the bundle function as an optional input"
  - "`hostFromCloneUrl` is private: with the builders gone no production module imports it, and fallow's production dead-code run would report the export; `authBundleFor` cases now pin every spelling its tests pinned"
  - "`addMarketplaceToState` no longer takes `ctx` and `run`; they were read only to build the add's auth context"

patterns-established: []

requirements-completed: [SG-AUTH-01, SG-AUTH-02]

coverage:
  - id: D1
    description: "`authBundleFor(cloneUrl, kind)` returns the stored-credential bundle of the host `hostFromCloneUrl` binds, for a github source, GitHub url, scp, ssh, ssh+git, and www spellings, git-subdir addresses, scp hosts (IPv4, IPv6, unterminated, no colon), and hosts with a port, with the GitHub base override unset, set (a mirror, a github.com base, a gitlab.com base), and invalid"
    requirement: SG-AUTH-01
    verification:
      - kind: unit
        ref: "test/orchestrators/auth-host.test.ts#authBundleFor (30 cases)"
        status: pass
      - kind: other
        ref: "scratch compare.ts: authBundleFor vs buildCloneAuth over 30 addresses x 3 kinds x 5 overrides, 450 checked, 0 differ"
        status: pass
    human_judgment: false
  - id: D2
    description: "No orchestrator builds an auth context to get a bundle; the four builders, `buildUpdateAuth`, the cascade's `probeAuth`, `CloneAuthArgs`, and the probes' `auth` members are deleted; `DEFAULT_CREDENTIAL_OPS` is private and the `CredentialOps` re-export is gone"
    requirement: SG-AUTH-01
    verification:
      - kind: other
        ref: "scratch accept3.sh: all seven acceptance greps at their expected values; no deleted symbol named in extensions, test, features, or scripts"
        status: pass
      - kind: other
        ref: "commit hook npm run check:commit (typecheck, lint, fallow, format, pairing, features check, unpaired tests, all-pair direct coverage) on ddbf325"
        status: pass
    human_judgment: false
  - id: D3
    description: "The no-notification paths keep their network decisions: the constraint gate skips stage one's tag query and the marketplace tag listing carries no bundle without a notification context; with one, the listing carries the bundle of its address"
    requirement: SG-AUTH-02
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-01 / NFR-5: the git arm skips the tag query when no notification context was threaded"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-01: the highest marketplace tag satisfying the intersection is pinned (withHostBundle undefined)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/marketplace-tag-probe.test.ts#D-SG-09: without withHostBundle, the remote listing runs without a bundle"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-preflight.test.ts#D-3-04: gives the autoupdate cascade a github.com stored-credential bundle when it has no notification context"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every scenario passes unchanged and no feature file changed"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin (1539 passed)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/marketplace features/plugin (42 passed)"
        status: pass
      - kind: other
        ref: "git diff --stat d06b3ab..HEAD -- features (empty)"
        status: pass
    human_judgment: false

duration: 53min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 09: One bundle function in auth-host Summary

**Every clone, listing, and fetch binds its bundle with `authBundleFor(cloneUrl, kind)`, and no verb builds an auth context for it. The four builders, `buildUpdateAuth`, and the cascade's `probeAuth` are deleted. The marketplace tag probe takes `withHostBundle`, and the update constraint gate takes `notification`. No host binding or network decision changed.**

## Performance

- **Duration:** about 53 min
- **Started:** 2026-11-27T19:52:05Z (worktree base)
- **Completed:** 2026-11-27T20:44:54Z
- **Tasks:** 3 (3 commits)
- **Files modified:** 30 (0 created, 30 modified, 0 deleted)

PLAN_BASE: `d06b3ab5c888785a16dead2e7a09ebc30f4a4bc0` (the worktree base).

## Accomplishments

- `orchestrators/auth-host.ts` exports only `NO_STORED_CREDENTIAL_CAUSE` and `authBundleFor`. `authBundleFor` returns `{ kind: "stored-credential", credentialOps: DEFAULT_CREDENTIAL_OPS, host: hostFromCloneUrl(cloneUrl, kind) }`. Its doc cites GAUTH-03, D-1-03, and GHB-02 and says the bundle depends only on the address. `DEFAULT_CREDENTIAL_OPS` and `hostFromCloneUrl` are module-private. The module header describes one bundle function and no notification context. `kind` is typed `GitBackedSource["kind"]`, which also clears the `sonarjs/use-type-alias` finding the inline union raised.
- `marketplace/add.ts`: `cloneAuthFor(source)` is `authBundleFor(canonicalCloneUrl(source), source.kind)`. For a url source, `canonicalCloneUrl` is `source.url`, the address the add bound before. `CloneAuthArgs` and the `DEFAULT_CREDENTIAL_OPS`, builder, and `CredentialOps` imports are gone. `addMarketplaceToState` no longer takes `ctx` or `run`.
- `marketplace/update.ts` (`refreshAuthFor`), `plugin/update-flow.ts` (`syncAuthFor`): the same call. `RefreshOneArgs` and the sync helper lose `credentialOps`. The url sync's and the refresh's `NO_STORED_CREDENTIAL_CAUSE` placement is unchanged.
- `plugin/fetch.ts`, `plugin/info.ts`: each clone calls `authBundleFor(cloneUrl, gitSource.kind)`. `FetchOneDeps` keeps `run`, which its rows read, and drops `ctx` and `credentialOps`. `InfoFetchContext` drops `ctx`, `run`, and `credentialOps`, which only built the bundle.
- `plugin/install-clone-probe.ts`, `plugin/dependency-tag-probe.ts`: the `auth` members are gone, and both arms bind with `authBundleFor`. The dependency probe still binds its bundle before the first listing, so an invalid base still throws there.
- `plugin/marketplace-tag-probe.ts`: `withHostBundle?: true`. With it, the remote listing carries `authBundleFor(canonicalCloneUrl(source), source.kind)`, built inside `list()` as before. Without it, the listing carries none.
- `plugin/update-constraint-gate.ts`: `notification?` replaces `auth`. Stage one's git tag query is skipped when it is absent. The path arm passes `withHostBundle: true` only when it is present. `probeAuth` is deleted.
- `plugin/update-preflight.ts`: `buildUpdateAuth` is deleted. `makeUpdateCloneProbe` takes no auth and uses `authBundleFor` for both arms and for `cloneAuth`. `constraintGateOptions` threads `notification` when the caller has one. Moving that spread into the helper keeps `preparePluginUpdate` within fallow's cognitive limit of 15.
- `plugin/install-outcome.ts`: the install auth object is gone, the clone probe gets no `auth`, and the tag copy's `resolveAuth` is `authBundleFor`. `plugin/install-cascade.ts`: `probeAuth` and `MemberConstraintOptions.ledgerOptionsFor` are deleted, because only `probeAuth` read it. The marketplace probe gets `withHostBundle: true` and the dependency probe gets no auth, as the always-present auth context gave before.

### Host binding check (flagged assumption)

Before deleting any builder, a scratch script (`exec-05-09/compare.ts`) compared `authBundleFor` with `buildCloneAuth`. It covered 30 addresses (github, https, http, git, git+https, git+ssh, ssh, ssh.github.com:443, ssh+git in two cases, scp, `github.com:` with no user, non-owner/repo GitHub paths, gitlab with and without a port, IPv6 literals, scp IPv4 and IPv6, an unterminated bracket, no colon, `file://`, and userinfo). Each ran with 3 kinds and 5 override states (unset, a mirror with a port, a github.com base, a gitlab.com base, and an invalid `http:` base). Result: 450 checked, 0 differ, and that includes which combinations throw. The add, update, and sync paths bound `buildGitHubAuth` for github and `hostFromCloneUrl(source.url, "url")` for url. Those are `authBundleFor`'s two arms exactly. No source kind or spelling bound a different host, so no builder host was kept.

### `resolveAuth` choice

`resolveAuth` stays. `install-outcome.ts` passes `resolveAuth: authBundleFor` to `materializeMarketplaceTagClone`, and `update-preflight.ts` passes `clone.cloneAuth`, which is `authBundleFor`. The consumer is in `clone-cache.ts`, outside this plan's files. Its `resolveAuth` is optional. Dropping it would change that module's contract and its tests, so the bundle function is passed instead.

### Deleted files

None.

### Deleted and changed cases

`test/orchestrators/auth-host.test.ts` (31 tests now, in `describe("authBundleFor")` and `describe("NO_STORED_CREDENTIAL_CAUSE")`):

- Task 1 added `describe("authBundleFor")`. It has data rows with the override unset (14 rows), set to a mirror (9 rows), and invalid (3 rows), plus `GHB-04: binds a url address outside GitHub under an invalid override`. Task 2 added `` D-04: binds a GitHub source under a ${base} base to ${host} `` (2 rows), carried over from `buildGitHubAuth`. Task 3 changed `gives every address the production credential surface` to `gives every address the same production credential surface`, which asserts the surface's keys and its identity across two addresses. It also added the scp rows 127.0.0.1, `git@[::1`, and `git@host.example` from `hostFromCloneUrl`'s cases.
- Deleted in Task 2: `describe("buildAuthForHost")`, which held `` D-SG-27: binds ${host} to its stored credential on a ${mode} command run without signing in `` (12 rows), `GAUTH-03: binds an unregistered host's stored credential to a bundle with no sign-in`, `` GAUTH-04 / D-SG-27: offers no sign-in on ${host} when its helper is empty `` (3 rows), `` CR-01 / GAUTH-04: binds ${host} to the bundle that keeps a rejected credential `` (2 rows), and `AAP-02 / D-13: returns a stored-credential bundle for a registry host to a load run without notifying`. Also deleted: `describe("buildGitHubAuth")`, which held `GHB-02: returns a stored-credential bundle for the override host`, `` D-04: binds a ${base} base to its host's stored credential `` (2 rows, moved to `authBundleFor`), `D-SG-27: returns the github.com stored-credential bundle when unset`, and `GHB-03: throws the typed error for an invalid override`.
- Deleted in Task 3: `describe("DEFAULT_CREDENTIAL_OPS")` (`composes the platform credential protocol without launching a process`). Also deleted: `describe("hostFromCloneUrl")`, whose spellings are `authBundleFor` rows now: `canonicalizes a GitHub source without parsing its clone URL`, `extracts the host from a URL source`, `preserves the port in a git-subdir source host`, `` D-SG-17: binds the scp address ${cloneUrl} to ${expectedHost} `` (4 rows), `GHB-02: binds a GitHub source to the override host`, `D-09: binds a github.com git-subdir url to the override host`, `` D-SG-23: binds the GitHub url address ${cloneUrl} to github.com `` (3 rows), `` D-SG-21: binds the GitHub url address ${cloneUrl} to the override host `` (3 rows), `D-SG-21: binds a GitHub git-subdir scp address to the override host`, and `a url source host ignores an invalid override`. Deleted with them: `describe("buildStoredCredentialAuth")` (`binds a stored-credential bundle to the host without any credential I/O`, `D-3-04: binds a github.com helper miss to a bundle with no sign-in`) and `describe("buildCloneAuth")` (`binds a GitHub source to the github.com stored credential without parsing its clone URL`, `D-SG-27: binds a gitlab.com url source to its stored credential`, `` ${clone} clone under the override gets the override-host stored credential `` (2 rows), `binds an unregistered port-bearing git-subdir host to its own bundle`).

Other test modules (Task 3 unless noted):

- `update-constraint-gate.test.ts`: deleted `UPDT-01: the git arm threads the caller's auth bundle untouched`, because the probe now gets no auth to thread. `UPDT-01: the highest git tag satisfying the intersection is pinned` now asserts the whole probe call, `{ pluginName, source, range }`, with no auth. `UPDT-01: the git arm skips the tag query when no ui context was threaded` is now `UPDT-01 / NFR-5: the git arm skips the tag query when no notification context was threaded`. `D-SG-09: a path entry source hands the probe the marketplace source and the caller's auth context` is now `... and asks for the host bundle under a notification context`, and it asserts `withHostBundle: true`. The path pinned case asserts `withHostBundle` is undefined without a notification context.
- `install-cascade.test.ts`: deleted `AUTH-09 the tag query rides the member's notification context and the production credential surface`, because the tag query takes no auth context. The marketplace-probe case asserts `withHostBundle: true` where it asserted the member's `ctx.mode`.
- `marketplace-tag-probe.test.ts`: `auth: auth()` is now `withHostBundle: true` (4 sites). `D-SG-09: with no auth context, the remote listing runs without a bundle` is now `D-SG-09: without withHostBundle, the remote listing runs without a bundle`.
- `dependency-tag-probe.test.ts`: the `auth()` helper and 24 `auth:` arguments are gone. `threads the host credential bundle into the listing for a private source` is now `threads the bundle of the source's address into the listing for a private source`, and it asserts `{ kind: "stored-credential", host: "github.com" }` where it asserted only that a bundle was present.
- `install-clone-probe.test.ts`: the `auth()` helper and its arguments are gone. The recorded bundles compare `{ kind, host }` where they compared `{ credentialOps, host }`. `returns a refreshed unpinned mirror result with ref and auth` asserts the github.com stored-credential binding where it asserted only presence.
- `update-preflight.test.ts`: `D-3-04: gives the autoupdate cascade a github.com stored-credential bundle when it has no notification context` asserts `{ kind: "stored-credential", host: "github.com" }` on both arms.
- `add.test.ts`: `AUTH-01 add: the clone's bundle carries the production credential surface by reference (no re-bundling)` is now `AUTH-01 add: the clone carries the stored-credential bundle of github.com`. Task 1 removed `ctx` and `run` from the two `addMarketplaceToState` cases. Task 2 replaced a comment that named `findProviderForHost/buildAuthForHost`.
- `update.test.ts`: `AUTH-02 update: the GitAuthBundle is forwarded by reference into the re-clone` is now `AUTH-02 update: the re-clone carries the stored-credential bundle of github.com`.
- `fetch.test.ts`, `reinstall-flow.test.ts`, `update-flow.test.ts` (3 sites), `install-flow-ledger.test.ts` (2 sites): each `credentialOps === DEFAULT_CREDENTIAL_OPS` check is now a `kind: "stored-credential"` check next to the host.
- `install-outcome.test.ts`, `carried-marketplace-adds.test.ts` (Task 1): the add seam's expected arguments drop `ctx` and `run`. `info.test.ts` (Task 2): a comment names `authBundleFor`.

### Suite counts

- Task 1 verify, unit (`auth-host`, `marketplace/add`, plus `install-outcome` and `carried-marketplace-adds`): 448 tests, 448 passed. Tracer gate re-run on the committed tree (interactive, `end-of-phase`, automated-only verify): `auth-host` and `marketplace/add`, 323 tests, 323 passed.
- Task 1 verify, cucumber adapter (`git-source`, `credentials`, `ssh-source`): 55 scenarios, 55 passed (693 steps).
- Task 2 verify, unit (`auth-host`, `marketplace/update`, `update-flow`, `fetch`, `info`): 866 tests, 866 passed.
- Task 2 verify, cucumber adapter (`github-refresh`, `update`, `github-transport-update`, `fetch`, `info`): 142 scenarios, 142 passed (1894 steps).
- Task 3 verify, unit `test/orchestrators/**/*.test.ts`: 6785 tests, 6785 passed.
- Task 3 verify and plan verification, cucumber `features/marketplace features/plugin`: adapter 1539 scenarios, 1539 passed (18456 steps), run before and again after the commit. Builtin: 42 scenarios, 42 passed (544 steps). `git diff --stat d06b3ab..HEAD -- features`: empty.
- Direct coverage (`npm run test:coverage:direct --`): Task 1 sources (`auth-host`, `marketplace/add`, `install-outcome`) exit 0. Task 2 sources (`auth-host`, `marketplace/update`, `update-flow`, `fetch`, `info`) exit 0. Task 3 sources (all eight plus `install-flow-cascade-context`) exit 0. Every touched source is at 100%.
- Commit hooks: `npm run check:commit` Passed on `b051881`, `100955b`, and `ddbf325`. The first try of Task 1 failed lint (`sonarjs/use-type-alias` at `auth-host.ts:98`), was fixed with `GitBackedSource["kind"]`, and passed. `check:static` ran in each hook. `npm run fallow` before the Task 3 commit first failed on `preparePluginUpdate` (cognitive 16). It passed once the `notification` spread moved into `constraintGateOptions`.

## Task Commits

1. **Task 1: Adding a private marketplace binds its bundle from the clone address alone, end to end** - `b051881` (refactor)
2. **Task 2: Marketplace update, the PUP-2 sync, fetch, and info bind their bundles from the clone address alone** - `100955b` (refactor)
3. **Task 3: The install, dependency, and update probes take no auth context, and auth-host keeps one bundle function** - `ddbf325` (refactor)

None of the tasks is a TDD task, so there is no RED commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`: `authBundleFor` and `NO_STORED_CREDENTIAL_CAUSE` are its only exports
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,update}.ts`, `plugin/{update-flow,fetch,info}.ts`: bundles from `authBundleFor`, and no credential surface in their argument types
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install-clone-probe,dependency-tag-probe,marketplace-tag-probe,update-constraint-gate,update-preflight,install-outcome,install-cascade}.ts`: no auth context. `withHostBundle` and `notification` carry the no-notification decisions
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts`: doc names `authBundleFor`
- 16 test modules under `test/orchestrators/`: cases deleted or changed as listed above

## Decisions Made

- No source kind or spelling bound a different host (see "Host binding check"), so `authBundleFor` uses `hostFromCloneUrl` for every caller.
- `resolveAuth` is kept, with `authBundleFor` as its value (see "`resolveAuth` choice").
- `hostFromCloneUrl` is private. The must-have says auth-host holds it, and it still does, but no production module imports it, so exporting it would fail fallow's production dead-code run. 05-10 shrinks the bundle by editing `authBundleFor`.
- `addMarketplaceToState`, `FetchOneDeps`, and `InfoFetchContext` drop the `ctx` and `run` that only built the bundle (Task 2's "keep them only where something else reads them", applied to every verb). `FetchOneDeps` keeps `run`, whose `softDeps` its rows read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `sonarjs/use-type-alias` on the second inline source-kind union**
- **Found during:** Task 1 commit (hook lint)
- **Issue:** Adding `authBundleFor` with the inline `"github" | "url" | "git-subdir"` gave the union a second site, and the rule failed lint at `auth-host.ts:98`.
- **Fix:** Both signatures take `GitBackedSource["kind"]` (type import from `domain/source.ts`).
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`
- **Verification:** ESLint exit 0, and the hook passed.
- **Committed in:** `b051881`

**2. [Rule 3 - Blocking] `GitHubSource` has no `url`**
- **Found during:** Task 1 typecheck
- **Issue:** `authBundleFor(source.url, source.kind)` does not typecheck for a github source.
- **Fix:** `add.ts`, `update.ts`, and `update-flow.ts` pass `canonicalCloneUrl(source)`. For a url source that is `source.url`, the address bound before. For a github source the address is unread.
- **Files modified:** the three verbs
- **Committed in:** `b051881`, `100955b`

**3. [Rule 2 - Missing critical] `ctx`/`run` that only built the bundle removed beyond the listed files**
- **Found during:** Tasks 1 and 2
- **Issue:** Once the add stopped building an auth context, `addMarketplaceToState`'s `ctx` and `run` were unread. So were `InfoFetchContext`'s `ctx` and `run` and `FetchOneDeps.ctx`. That left dead plumbing of the kind the plan removes.
- **Fix:** Removed them. That touched `plugin/install-outcome.ts` (Task 1, ahead of Task 3), `test/orchestrators/plugin/install-outcome.test.ts`, and `test/orchestrators/plugin/carried-marketplace-adds.test.ts`, which were not in Task 1's file list.
- **Verification:** The unit tests and the scenarios pass, and coverage is at 100%.
- **Committed in:** `b051881`, `100955b`

**4. [Rule 3 - Blocking] `hostFromCloneUrl` made private; test modules outside the list updated**
- **Found during:** Task 3
- **Issue:** With the builders deleted, `hostFromCloneUrl` had no production importer, so fallow's dead-code run would report the export. `DEFAULT_CREDENTIAL_OPS` going private broke eight test modules that the plan does not list (`marketplace/add`, `marketplace/update`, `fetch`, `install-cascade`, `install-flow-ledger`, `reinstall-flow`, `update-flow`, `update-preflight`).
- **Fix:** `hostFromCloneUrl` is unexported, and its spellings are `authBundleFor` rows. The eight modules assert `kind: "stored-credential"` with the host in place of the surface reference.
- **Verification:** Typecheck, lint, fallow, and the 6785 orchestrator unit tests pass.
- **Committed in:** `ddbf325`

**5. [Rule 3 - Blocking] `preparePluginUpdate` over fallow's cognitive limit**
- **Found during:** Task 3, `npm run fallow` before the commit
- **Issue:** Inlining the `notification` spread in place of `buildUpdateAuth` raised `preparePluginUpdate` to cognitive 16 (limit 15).
- **Fix:** `constraintGateOptions` adds `notification` itself, and its `base` type omits it.
- **Verification:** fallow exit 0, and the update-preflight and update-flow tests pass (394 of 394).
- **Committed in:** `ddbf325`

**6. [Rule 1 - Bug] Weak bundle assertions strengthened**
- **Found during:** Task 3
- **Issue:** Two cases asserted only that a bundle was present: `dependency-tag-probe`'s private-source case and `install-clone-probe`'s mirror case. Neither would fail if the wrong host were bound.
- **Fix:** Both assert `{ kind: "stored-credential", host: "github.com" }`, and the mirror case clears the override first.
- **Committed in:** `ddbf325`

---

**Total deviations:** 6 auto-fixed (4 blocking, 1 missing critical, 1 bug)
**Impact on plan:** More test modules changed than listed, and `hostFromCloneUrl` is private. No behavior, host binding, or network decision changed.

## Issues Encountered

None beyond the deviations.

### Left for later plans

- The `add.ts` and `update.ts` Device Flow wording that the 05-08 summary left for 05-12 is gone, because this plan rewrote `cloneAuthFor`'s, `gitStagingSteps`'s, and `refreshAuthFor`'s docs. `test/orchestrators/marketplace/add.test.ts` still names the provider (`provider-registered host`, `GitLab provider's auth bundle`, and the `GAUTH-02 / MURL-08` case title). That wording belongs to the 05-12 sweep.
- 05-10 can shrink `GitAuthBundle` to `{ readonly host: string }` by editing `authBundleFor` alone. The `kind`-only assertions added here then lose their `kind` field.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-16 (mitigate): the `authBundleFor` cases pin the bound host for every source kind and spelling, with the override unset, set, and invalid. The scratch comparison found no address whose host moved, and `runWithAuthBundle` is unchanged (D-1-03). T-05-17 (mitigate): the gate's skip and the listing's no-bundle path stay keyed on the notification context, with unit cases for both, so no background run gains a query (NFR-5). T-05-SC (mitigate): no package was added, removed, or upgraded.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and this plan leaves no stub, skipped test, or unrun verify.

## Next Phase Readiness

- 05-10: `authBundleFor` is the only place that builds a bundle, and `DEFAULT_CREDENTIAL_OPS` is private to auth-host, so shrinking the bundle to its host edits one function and the `{ kind, host }` assertions.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`: present, and it exports only `NO_STORED_CREDENTIAL_CAUSE` and `authBundleFor`.
- Commits `b051881`, `100955b`, `ddbf325`: ancestors of HEAD. `git rev-list --count d06b3ab..HEAD` = 3.
- Acceptance: `export function authBundleFor` 1; builders and `CloneAuthArgs` in add.ts 0; builders in the four Task 2 verbs 0; extension files naming a builder 0; `^export const DEFAULT_CREDENTIAL_OPS` 0; `CredentialOps` re-export 0; `withHostBundle` in the marketplace probe 3.

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*

---
phase: 04-ssh-sources-and-transport-selection
plan: 03
subsystem: identity
tags: [system-git, identity, github-base-url, ort, ssh, cucumber]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-01: gitUrlRefusal, the scp url source, scp-safe hostFromCloneUrl, the ssh harness steps"
provides:
  - "shared/github-base-url.ts gitHubAddressOf, the port of Claude Code's Ort fold with its Mle refusals"
  - "per-URL insteadOf pairs and wire URLs for every GitHub spelling under PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL (D-SG-21)"
  - "domain/clone-key.ts gitHubRepositoriesMatch and the folded originMatchesSource (D-SG-23, closes IN-05)"
  - "domain/source.ts gitHubRepositoryOf and the folded samePlannedSource"
  - "folded reserved-name acceptance, mirror seeding compare, and credential host"
  - "harness: the `github ssh` plugin source kind and a leftover-checkout step with a stated origin"
affects: [04-04, 04-05, 04-06, transport-selection]

actuals:
  tokens: 17410
  tasks: 3
  commits: 3
plan_head_before: 8d2a592ea56aefdbc3508366e4a043b1a44f6e7c
plan_head_after: 46a72875b329d389c8ca28bb011e1ca92bb45848

tech-stack:
  added: []
  patterns:
    - "Identity fold in comparisons only: gitHubRepositoriesMatch returns true/false when either side folds and undefined when neither does, so each caller keeps its own exact compare"
    - "Under the base override the insteadOf prefix is the address's own text before owner/repo, so git's case-sensitive prefix match covers every spelling"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/github-base-url.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/domain/clone-key.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - test/shared/github-base-url.test.ts
    - test/orchestrators/auth-host.test.ts
    - test/domain/clone-key.test.ts
    - test/domain/source.test.ts
    - test/domain/name.test.ts
    - test/orchestrators/plugin/clone-cache.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - features/lib/git-plugin.ts
    - features/plugin/ssh-source.feature
    - features/step_definitions/marketplace/checkout.steps.ts
    - features/marketplace/add.feature
    - features/marketplace/reserved-name.feature

key-decisions:
  - "The fold sits in shared/github-base-url.ts, not domain/clone-key.ts as CONTEXT [Identity] says, because platform/git.ts's pairs need it and shared/ and platform/ import only each other; the domain keeps the comparisons"
  - "gitHubAddressOf returns an inline { prefix, repository } type: fallow reports an exported GitHubAddress with no importer as unused and an unexported one as a private type leak"
  - "The fold refuses a bracket, a backslash, %00, and control or non-ASCII characters anywhere in the address, stricter than upstream's position-aware checks; a GitHub address never needs one (T-04-09)"
  - "The canonical https://github.com/ prefix keeps its pair even for a URL that does not fold (one or three path segments), so no existing rewrite is lost"
  - "A github source whose owner/repo Claude Code does not fold (such as a_b/c) compares exactly, as upstream's wjt keeps Ort(repo) ?? repo"

patterns-established:
  - "the {word} scope holds a checkout of the marketplace {string} with the origin {string} that an interrupted add left"
  - "plugin source kind `github ssh`: a url source git@github.com:<owner>/<name>.git that the base override sends to the git host"

requirements-completed: [SG-SSH-06, SG-SSH-01]

coverage:
  - id: D1
    description: "gitHubAddressOf folds every GitHub spelling to one lower-cased owner/repo and refuses misleading addresses"
    requirement: SG-SSH-06
    verification:
      - kind: unit
        ref: "test/shared/github-base-url.test.ts#gitHubAddressOf"
        status: pass
    human_judgment: false
  - id: D2
    description: "Under the base override a plugin url source git@github.com:acme/ghp.git installs, pinned or not, from the base over https with no ssh launch (D-SG-21)"
    requirement: SG-SSH-01
    verification:
      - kind: unit
        ref: "test/shared/github-base-url.test.ts#D-SG-21: rewrites the prefix of git@github.com:acme/ghp.git to the base as its own pair"
        status: pass
      - kind: e2e
        ref: "features/plugin/ssh-source.feature#Installing a plugin from a git@github.com address reaches the GitHub base over https"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every identity comparison folds GitHub spellings (leftover recognition, planned-versus-recorded source, reserved names, mirror seeding, credential host) and no cache key changes"
    requirement: SG-SSH-06
    verification:
      - kind: unit
        ref: "test/domain/clone-key.test.ts#originMatchesSource"
        status: pass
      - kind: unit
        ref: "test/domain/source.test.ts#samePlannedSource"
        status: pass
      - kind: unit
        ref: "test/domain/name.test.ts#reservedMarketplaceNameRefusal"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SG-23: a path marketplace whose origin is git@github.com:Owner/Repo.git seeds the github plugin owner/repo"
        status: pass
      - kind: unit
        ref: "test/orchestrators/auth-host.test.ts#hostFromCloneUrl"
        status: pass
    human_judgment: false
  - id: D4
    description: "A user sees one source per GitHub repository: Acme/Tools after acme/tools is already added, a leftover ssh-origin checkout is replaced, and git@github.com:anthropics/... may use a reserved name"
    requirement: SG-SSH-06
    verification:
      - kind: e2e
        ref: "features/marketplace/add.feature#Adding Acme/Tools after acme/tools reports the marketplace already added"
        status: pass
      - kind: e2e
        ref: "features/marketplace/add.feature#Adding a github marketplace over a leftover checkout whose origin is its ssh address replaces it"
        status: pass
      - kind: e2e
        ref: "features/marketplace/reserved-name.feature#Adding a marketplace from git@github.com:anthropics/... may use a reserved name"
        status: pass
    human_judgment: false

duration: about 1h
completed: 2026-11-25
status: complete
---

# Phase 4 Plan 03: The GitHub identity fold Summary

**Claude Code's `Ort` fold ported as `gitHubAddressOf` in `shared/github-base-url.ts`. Every GitHub spelling, scp and ssh forms included, now reaches the base under `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` through its own insteadOf pair. Every identity comparison treats those spellings as one lower-cased `owner/repo`, and `canonicalCloneUrl`, `pluginCloneKey`, and `pluginMirrorKey` are unchanged.**

## Performance

- **Duration:** about 1h
- **Completed:** 2026-11-25T16:40Z
- **Tasks:** 3 of 3
- **Files modified:** 18 (0 created)

## Accomplishments

- `gitHubAddressOf(address)` folds `https`, `http`, `git`, `git+https`, `git+http`, `ssh`, and `git+ssh` URLs, plus scp addresses on github.com or ssh.github.com (`ssh.github.com` only for the ssh protocols). Host case, leading `www.`, trailing dots, one trailing `/`, and one `.git` in any case are all ignored. The rest must match upstream's `owner/repo` pattern. It returns the lower-cased repository and the exact prefix the address writes before it.
- `gitHubInsteadOfPairs` and `gitHubWireUrl` rewrite any folding spelling. The pair key is `url.<base>/.insteadOf=<prefix>`, for example `git@github.com:`. The base is read only after a match (GHB-04), and the `=` refusal still runs first (GHB-03). `platform/git.ts` did not change: `runRemote` and `fetchCommit`, which reads the recorded scp origin, pick the new pairs up.
- `hostFromCloneUrl` binds a url or git-subdir address that folds to `gitHubOverrideHost() ?? GITHUB_HOST`.
- `originMatchesSource` recognizes `git@github.com:acme/tools.git`, `ssh://git@github.com/Acme/Tools`, and `https://github.com/Anthropics/...` as their github sources, which closes IN-05. A non-GitHub origin compares exactly: by WHATWG `href` when both sides are URLs, and as text when either side is scp.
- `samePlannedSource` treats a github source and a url source that spells a GitHub address as one repository and ref. `marketplace add Acme/Tools` after `acme/tools` reports `already added`.
- `reservedMarketplaceNameRefusal` accepts a reserved name for any source that folds to `anthropics/...`.
- Mirror seeding folds both identities, so a path marketplace whose origin is `git@github.com:owner/repo.git` seeds the github plugin `owner/repo`.

## Task Commits

1. **Task 1 (tracer): A plugin from git@github.com:acme/ghp.git installs through the GitHub base override, end to end.** `0f2da82` (feat). The tracer gate re-ran both verify commands on the committed tree, and both passed: "Tracer verified end-to-end, expanding."
2. **Task 2: Every identity comparison reads the folded repository.** `e483434` (feat)
3. **Task 3: Scenarios pin the fold where a user sees it.** `46a7287` (test)

TDD note: the commit hook typechecks, lints, and runs fallow on the whole tree. So each task committed its tests and code together. Each RED ran locally first, as recorded below.

## TDD red runs

- **Task 1, unit:** `node --test test/shared/github-base-url.test.ts` against the HEAD source with a do-nothing `gitHubAddressOf` stub gave `tests 101, pass 73, fail 28`. The failures were the 13 fold rows, the 7 D-SG-21 wire rows, the 6 D-SG-21 pair rows, the scp GHB-03 row, and the "reads no variable" row. Each failed on its assertion.
- **Task 1, auth-host:** with the HEAD `auth-host.ts`, `tests 59, fail 2`: `ssh://git@GitHub.com/...` and `https://www.github.com/...` bound their own host instead of github.com.
- **Task 1, scenarios:** both git@github.com scenarios failed against the HEAD `github-base-url.ts` at `the result has these fields` (`severity error`, `A plugin operation has failed.`). git reached the ssh stand-in, which does not know github.com.
- **Task 2, unit:** the five test files against the HEAD sources, with do-nothing `gitHubRepositoriesMatch` and `gitHubRepositoryOf` stubs, gave `tests 762, pass 733, fail 29`. The failures were the originMatchesSource fold rows, every gitHubRepositoriesMatch row, the two url reserved-name rows, three samePlannedSource fold rows, two gitHubRepositoryOf rows, and the two seeding rows.
- **Task 3, scenarios:** with the Task 2 sources reverted to `0f2da82`, all three new scenarios failed at `the result has these fields` (`severity error`). The Acme/Tools add failed instead of reporting already added. The leftover ssh-origin add failed as a stale clone. The anthropics scp add was refused for the reserved name.

## Whole-suite runs (after Task 3)

- `npm run test:modules`: exit 0, no failing case. The quiet reporter prints no counts on success, and the `dispatch-exec.test.ts:39` baseline did not fail.
- `npm run test:integration`: exit 0, no failing case.
- `test:cucumber:profile --profile adapter features/marketplace features/plugin`: 1460 scenarios, 1460 passed (17318 steps).
- `test:cucumber:profile --profile builtin features/plugin`: 41 scenarios, 41 passed (528 steps).
- Task 3 verify (`add.feature`, `reserved-name.feature`, `ssh-source.feature`, adapter): 81 scenarios, 81 passed. `npm run check:features` exits 0.
- The commit hook (`check:commit`: typecheck, lint, fallow, format, test:corresponding, check:features, unpaired tests, direct coverage of the staged pairs) passed on all three commits. `test:coverage:direct` exits 0 for all six plan sources.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The credential-host change moved from Task 2 into Task 1**
- **Found during:** Task 1 commit
- **Issue:** fallow's dead-code gate reported `gitHubAddressOf` as an unused export, because nothing in production imported it until Task 2.
- **Fix:** Task 2 item 5 (`hostFromCloneUrl` binds a folding url or git-subdir address to the GitHub host) and its test rows landed in the Task 1 commit. It belongs to the D-SG-21 flow anyway: the scp plugin's credential host is the base.
- **Files modified:** `orchestrators/auth-host.ts`, `test/orchestrators/auth-host.test.ts`
- **Committed in:** `0f2da82`

**2. [Rule 3 - Blocking] `GitHubAddress` is an inline return type**
- **Issue:** fallow reported the exported interface as an unused type, and an unexported one as a private type leak.
- **Fix:** `gitHubAddressOf` returns `{ readonly prefix: string; readonly repository: string } | undefined`.
- **Committed in:** `0f2da82`

**3. [Rule 1 - Pinned old behavior] Existing tests that pinned the exact compare were flipped**
- `test/shared/github-base-url.test.ts`: `https://GitHub.com/...`, `https://www.github.com/...`, and `https://github.com:443/...` now go to the base.
- `test/domain/clone-key.test.ts`: the owner-case, ssh-form, and port-8443 origins now match.
- `test/orchestrators/marketplace/add.test.ts` (outside `files_modified`; plan 04-04 does not list it): the MA-13 arms "owner letter case" and "ssh-form remote" moved to the MA-12 recognized list. A new MA-13 arm, an ssh remote of another repository, still refuses.
- **Committed in:** `0f2da82`, `e483434`

**4. [Scope] Two scenarios instead of one Outline for Task 1**
- **Issue:** the pinned row makes six requests and the unpinned row three. One request table cannot hold both in an Outline.
- **Fix:** there are two scenarios. Both titles begin with the plan's Outline title, so the plan's `--name` filter selects both.
- **Committed in:** `0f2da82`

**5. [Scope] `samePlannedSource` was split for fallow's complexity gate**
- **Fix:** the GitHub comparison moved into `gitHubComparison`, which got samePlannedSource under fallow's cognitive and cyclomatic limits. `gitHubRepositoryOf` uses `if` arms because `switch-exhaustiveness-check` rejects a `default` over the union.
- **Committed in:** `e483434`

**Total deviations:** 5 (2 blocking fixes, 1 set of flipped pinning tests, 2 shape adjustments). **Impact:** no change in scope. The one extra file is `test/orchestrators/marketplace/add.test.ts`.

## Issues Encountered

- The worktree had no optional-peer cache, so `node scripts/install-test-peers.mjs` installed it before the first cucumber run.
- The harness refuses compound shell commands that name git paths, so edits and runs went through small scripts in the executor's scratch directory.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-09 is mitigated: the fold refuses brackets, backslashes, `%00`, control and non-ASCII characters, a percent-encoded host, and an scp `@` after its `:`. The fold changes identity only, and the wire URL changes only under the base override. T-04-10 is mitigated: GHB-03's `=` refusal runs before any pair is built, and the prefix is the pair's value. T-04-11 is mitigated: the clone-key test pins the github key to its own spelling, and the acceptance grep confirms `canonicalCloneUrl`'s body is unchanged. T-04-12 is accepted as planned. T-04-SC: no package was added.

## Orchestrator actions

None. The plan asks for no `windows append`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 04-04 through 04-06 can use `gitHubAddressOf` for transport selection. Under the base override every GitHub spelling already reaches the base. Without the override, an scp GitHub address still clones over the user's ssh as written, as OQ-1 decided.

## Self-Check: PASSED

- Commits `0f2da82`, `e483434`, and `46a7287` are ancestors of HEAD.
- Every modified file listed above exists. `gitHubAddressOf` is exported once from `shared/github-base-url.ts`.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-25*

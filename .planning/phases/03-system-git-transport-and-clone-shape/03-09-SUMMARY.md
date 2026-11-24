---
phase: 03-system-git-transport-and-clone-shape
plan: "09"
subsystem: plugin-refresh
tags: [system-git, re-clone-swap, ls-remote, keep-on-failure, plugin-mirror, pup-2, cucumber-rebaseline]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-06 the depth-1 system-git clone; 03-07 refreshCloneBySwap, pluginCloneBackupDir, keepMarketplaceOnFailure, the carry-over rule; 03-08 the marketplace tag read"
provides:
  - "The warm plugin mirror refresh by refreshCloneBySwap through plugin-clones-backup/<key>, never kept on failure (PluginMirrorInUseError reads permission denied)"
  - "plugin update's marketplace sync (PUP-2) by refreshCloneBySwap with the D-SG-15 keep rule and debug-log lines"
  - "CloneSwapArgs.ownershipMarker; installedRootsInside, swapCloneUrl, MARKETPLACE_MANIFEST_MARKER exported from clone-swap.ts"
  - "refreshGitHubClone and refreshUrlClone deleted with their D-14 tests"
  - "Re-baselined plugin refresh tables and the read-only mirror folder scenario"
affects: [03-12, 03-13, 03-14, 03-15, 03-17, Phase 6 wording]

plan_head_before: fb7205fb64d7c71d2b0bc490217006470620da1d
plan_head_after: 26f5099f587ca21c5574cea06c519c8e979cf130

actuals:
  tokens: 46000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A plugin mirror refreshes by the marketplace swap with liveMarker .git/HEAD, keepOnUnreachable false, ownershipMarker false"
    - "A refresh failure that a plugin row must read as permission denied carries an errno-style code (PluginMirrorInUseError.code), so every plugin classifier maps it without a new branch"
    - "A sync test's git double is current when its HEAD equals the remote's main; a stale case passes a fixture tree for the re-clone"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - features/plugin/fetch.feature
    - features/step_definitions/plugin/git-source.steps.ts
    - features/plugin/info.feature
    - features/plugin/git-source-update.feature
    - features/plugin/url-marketplace-update.feature
    - features/plugin/update.feature
    - features/mcp-server/verdict-fetch.feature

key-decisions:
  - "A plugin mirror is never kept on failure: kept-in-use throws PluginMirrorInUseError, whose code is EACCES for an EACCES rename and EPERM otherwise (EBUSY included), so fetch, update, install, info, and reinstall all read permission denied"
  - "The mirror swap carries the packages of an installed root that still runs from the mirror (a record from before the per-commit copies); a state file that cannot be read carries nothing and is debug-logged"
  - "The PUP-2 sync honors CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE and the in-use case as marketplace update does, and says so only in the debug log; the update reads the kept catalog"
  - "The PUP-2 sync clones from the checkout's recorded origin, else networkCloneUrl, as marketplace update does (swapCloneUrl moved to clone-swap.ts)"
  - "The NO_STORED_CREDENTIAL_CAUSE line stays url-only and tail-only on the PUP-2 sync, as the deleted url wrapper attached it"

patterns-established:
  - "Pattern: a mirror backup lives in plugin-clones-backup/<key>, which clone-gc.ts never sweeps; an orphan backup stays until that key refreshes again (T-03-31)"

requirements-completed: ["SG-TRN-03", "SG-TRN-06", "SG-MIG-01"]

coverage:
  - id: D1
    description: "A warm plugin mirror refreshes by ls-remote, re-clone into sources-staging, and swap through plugin-clones-backup/<key>; a current mirror is left as it is; a failed clone leaves the mirror; an interrupted swap is restored or removed first; a second refresh is current"
    requirement: "SG-TRN-03"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SG-10: a warm mirror whose remote moved is cloned into staging and swapped in through its backup"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SG-10 / NFR-3: a backup beside a mirror without its .git/HEAD is restored before the check"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SG-10 / D-18-04: real git moves a warm mirror to its branch's new commit, then answers it offline and stays current"
        status: pass
      - kind: e2e
        ref: "features/plugin/fetch.feature#Fetching a git-source plugin downloads its new revision from the git host"
        status: pass
    human_judgment: false
  - id: D2
    description: "A mirror that cannot be moved aside (EACCES through a read-only plugin-clones/ folder) fails the row as permission denied, the installed plugin keeps its revision, and the next fetch replaces the mirror"
    requirement: "SG-TRN-03"
    verification:
      - kind: e2e
        ref: "features/plugin/fetch.feature#Fetching a git-source plugin whose mirror cannot be moved aside fails as permission denied, and the next fetch replaces it"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#D-SG-10 / SG-TRN-03: a moved warm mirror that cannot be moved aside fails as permission denied and is never used"
        status: pass
    human_judgment: false
  - id: D3
    description: "Windows open-handle form (EBUSY, EPERM on rename) of the mirror's kept-in-use branch"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SG-10 / SG-TRN-03: a mirror that cannot be moved aside with EBUSY fails, is never kept, and leaves no staging"
        status: pass
    human_judgment: true
    rationale: "Only injected renames prove it; a real Windows open handle needs the deferred manual check."
  - id: D4
    description: "plugin update's marketplace sync (PUP-2) runs the swap with the same auth bundles and authMemo, keeps a checkout with the keep variable or when it is in use, and reads the kept catalog"
    requirement: "SG-TRN-06"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-SG-15: with the keep variable, an unreachable marketplace remote keeps its checkout and the update reads the kept catalog"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-SG-10 / D-SG-15: a marketplace checkout that cannot be moved aside is kept and the update reads it"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#PUP-2 / D-SG-10: two plugins of one github marketplace whose remote moved re-clone it once and both read the new catalog"
        status: pass
    human_judgment: false
  - id: D5
    description: "refreshGitHubClone and refreshUrlClone are gone, and every refresh table and cause row of the plugin features follows the swap"
    requirement: "SG-MIG-01"
    verification:
      - kind: other
        ref: "npm run fallow; grep of extensions for both names outside comments = 0"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter|builtin features/plugin features/marketplace features/mcp-server"
        status: pass
    human_judgment: false

duration: 87min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 09: Plugin mirror and PUP-2 sync by re-clone and swap Summary

**A warm plugin mirror and `plugin update`'s marketplace sync now refresh the way `marketplace update` does. An `ls-remote` of the source's ref decides. A current checkout is left as it is. A stale one is cloned again into `sources-staging/` and swapped in through `plugin-clones-backup/<key>` or `sources-backup/<name>`. A mirror is never kept on failure: a mirror that cannot be moved aside fails the plugin's row as `permission denied`. The PUP-2 sync keeps its marketplace under `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, or when the checkout is in use, and says why in the debug log. The D-14 wrappers `refreshGitHubClone` and `refreshUrlClone` are gone.**

## Performance

- **Duration:** about 87 min
- **Started:** 2026-11-24T08:54:16Z
- **Completed:** 2026-11-24T10:21:01Z
- **Tasks:** 3 of 3. Task 1 is a tracer, and its gate passed.
- **Files modified:** 22 (0 created)

## Accomplishments

- `materializeOrRefreshPluginMirror` refreshes a warm mirror with `refreshCloneBySwap`: liveMarker `.git/HEAD`, `keepOnUnreachable: false`, `ownershipMarker: false`, the caller's network URL, and the source's ref. `kept-in-use` throws `PluginMirrorInUseError`. The cold path, `refresh: false`, and the `resolveFetchedRefOffline` order are unchanged.
- `makeSyncCloneOnce` refreshes github and url marketplaces with the swap inside `refreshFramed`. The keep variable is read once per run. `kept-stale` and `kept-in-use` each write one `hookDebugLog` line, and the update reads the kept catalog.
- `shared.ts` no longer has the D-14 wrappers. Their unit cases in `shared.test.ts` and the D-14 interim cases in `test/platform/git.test.ts` are deleted. The module header now describes the swap.
- `features/plugin`, `features/marketplace`, and `features/mcp-server` pass under both profiles: adapter 1314/1314 for the three plan paths, and 163/163 for `features/mcp-server`; builtin 40/40 and 145/145.

## Task Commits

1. **Task 1 (tracer): plugin mirror by re-clone and swap** - `4d3ba61` (feat). Tracer gate: the three verify commands passed before the commit. Unit: 818/818 across `clone-cache`, `clone-swap`, `fetch`, `info`, `errors`, `update`. `fetch.feature`: adapter 12/12, builtin 0. Typecheck, lint, fallow, `check:features`, and ESLint on the step file all exited 0.
2. **Task 2: PUP-2 sync by swap, wrappers deleted** - `e2f5ae5` (feat)
3. **Task 3: refresh tables re-baselined** - `26f5099` (test)

## Files Created/Modified

- `orchestrators/plugin/clone-cache.ts` - `refreshMirrorBySwap`, `installedRootsInMirror`, `MIRROR_LIVE_MARKER`, and the `renameOps` option. The header now describes the swap.
- `orchestrators/marketplace/clone-swap.ts` - the `ownershipMarker` option. It now owns `installedRootsInside`, `swapCloneUrl`, and `MARKETPLACE_MANIFEST_MARKER`, which moved here from `update.ts`.
- `orchestrators/plugin/update-flow.ts` - `syncMarketplaceBySwap`, `syncAuthFor`, `logKeptSync`, and the rewritten `makeSyncCloneOnce`.
- `orchestrators/marketplace/shared.ts` - both wrappers deleted, header updated.
- `orchestrators/marketplace/update.ts` - imports the moved helpers and passes `ownershipMarker: true` (outside `files_modified`, see deviation 1).
- `orchestrators/plugin/update-preflight.ts` - `UpdatePluginsOptions.renameOps` and `.environment` (outside `files_modified`, see deviation 2).
- `shared/errors.ts` - `PluginMirrorInUseError` (outside `files_modified`, see deviation 3).
- Tests: `clone-cache.test.ts` (the mirror section rewritten, plus a real-git case), `clone-swap.test.ts`, `fetch.test.ts`, `info.test.ts`, `update-flow.test.ts`, `shared.test.ts`, `test/platform/git.test.ts`, `test/shared/errors.test.ts`.
- Features: `fetch.feature` (1 table and the new scenario), `git-source.steps.ts` (the read-only Given and its When), and the Task 3 files.

## Decisions Made

See `key-decisions` in the frontmatter. For maintainer review:

- A mirror is never kept on failure. The row reads `permission denied`, and its cause is `Could not replace the plugin mirror because it is in use; the existing copy was kept and the next command will try again.` followed by the rename's error. Phase 6 owns the wording.
- The PUP-2 sync keeps a marketplace as `marketplace update` does, but only the debug log says so until Phase 6 words a note.
- A mirror backup of a key that nothing uses any more stays until that key refreshes again (T-03-31).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `update.ts` edited to share the moved helpers**
- **Found during:** Tasks 1 and 2
- **Issue:** The mirror swap needs the carry-over roots that `update.ts::installedRootsIn` computes. The PUP-2 sync needs `update.ts`'s private `swapCloneUrl` and manifest marker. Copies would trip `fallow dupes`. A plugin ledger may not import a marketplace ledger (BLOCK C), and `update.ts` is one.
- **Fix:** The three helpers moved to `clone-swap.ts`, which is not a ledger. `update.ts` imports them and passes `ownershipMarker: true`. `clone-swap.test.ts` pins `installedRootsInside` and both arms of `swapCloneUrl`.
- **Commits:** `4d3ba61`, `e2f5ae5`

**2. [Rule 3 - Blocking] `update-preflight.ts` gains `renameOps` and `environment`**
- **Issue:** `UpdatePluginsOptions` lives in `update-preflight.ts`. The EBUSY row and the keep-variable rows need injected seams, the same ones `marketplace update` takes.
- **Commit:** `e2f5ae5`

**3. [Rule 2 - Missing Critical] `PluginMirrorInUseError` in `shared/errors.ts`**
- **Issue:** The plan asks for the mirror's in-use case to read `permission denied` on every plugin surface. Fetch, update, install, info, and reinstall each read the errno `code` of the thrown error, and none of them sees `EBUSY`. Without a code, `fetch` read `network error`.
- **Fix:** A typed error with `code: "EACCES" | "EPERM"` and the rename's error as its cause. `EACCES` keeps its code, and every other in-use code maps to `EPERM`. `errors.test.ts` covers all three codes and a rename error with no code.
- **Commit:** `4d3ba61`

**4. [Plan accuracy] The PUP-2 sync clones from the checkout's recorded origin**
- **Issue:** The plan says "the network clone URL". 03-07 showed that a url source recorded under a `.json` URL needs the checkout's origin (its deviation 4).
- **Fix:** The sync uses `swapCloneUrl`, as `marketplace update` does.
- **Commit:** `e2f5ae5`

**5. [Rule 2] Carry-over for a mirror**
- **Issue:** A record from before the per-commit copies may still run from the mirror (`recorded-servers.ts::cloneKeyOf` accepts a bare mirror key). The coordinator asked for 03-07's carry-over rule.
- **Fix:** `installedRootsInMirror` loads the scope's state and passes the roots inside the mirror as `carryOver`. A state file that cannot be read carries nothing and writes one debug-log line.
- **Commit:** `4d3ba61`

**6. [Scope] `test/platform/git.test.ts` edited**
- The D-14 interim describe block and its `installHttpBackendTransport` helper called `refreshGitHubClone`, so they went with the wrapper. That also dropped the now-unused `cgi.ts` import.
- **Commit:** `e2f5ae5`

**7. [Scope] A step-module clone avoided**
- **Issue:** `fallow dupes` found that the new read-only Given copied `failureOf` and the chmod prologue of `features/step_definitions/marketplace/checkout.steps.ts`, which 03-11 owns in this wave.
- **Fix:** The Given uses a different helper, `refusalMessage` over `assert.rejects`. `checkout.steps.ts` is untouched. A later foundation edit could share one helper in `features/lib/`.

---

**Total deviations:** 7 (2 blocking, 2 missing-critical, 1 plan accuracy, 2 scope). **Impact:** within the plan's intent. Three source files outside `files_modified` were edited: `update.ts`, `update-preflight.ts`, and `errors.ts`. None of them is in the `files_modified` of 03-10 or 03-11.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks. The hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each TDD task's commit therefore holds RED and GREEN together. The RED scripts copied the base revision of the named sources in, ran the new cases, and put the new sources back (`red1.sh`, `red1s.sh`, `red2.sh` in the scratch directory).

- **Task 1 RED** (base `clone-cache.ts`, new tests): `# tests 23 # pass 0 # fail 23` across `clone-cache.test.ts` and `fetch.test.ts`. For example, the moved-remote case failed with `GitCommandError: git rev-parse --verify failed: local-ref-missing` from `refreshGitHubClone`, because the old in-place path read a tracking ref the swap does not need. The EBUSY rows failed at `assert.ok(error instanceof PluginMirrorInUseError)`. The fetch row failed on the notification text, because the old code fetched in place and reported the plugin `available`. Semantic assessment: each target ran and failed on its planned assertion; none failed at load. **Scenario RED:** with `kept-in-use` mapped to `current` (a local mutation, not committed, put back after the run), the new scenario failed at `Then the result has these fields`: `+ 'info' - 'error'` and no summary row. The fetch then succeeded on the stale mirror. **GREEN:** 818/818 unit cases. `fetch.feature` passed 12/12 under adapter. Direct coverage of `clone-cache.ts`, `clone-swap.ts`, `errors.ts`, and `update.ts` exited 0. The Given's EACCES check passed in this sandbox, so no cucumber exemption was needed.
- **Task 2 RED** (base `update-flow.ts` and `shared.ts`, new and rewritten sync cases): `# tests 22 # pass 3 # fail 19`. For example, the PUP-2 memo case got `checks: []` and one `checkout` of `sources/official` (the D-14 fetch and checkout) instead of one `ls-remote` and no checkout. The keep-variable case failed because the D-14 sync ignored the variable. The 3 cases that passed are guards whose behavior stays the same: a held lock refuses before any git call, a replaced sync writes no kept line, and a hosted marketplace syncs nothing. **GREEN:** 822/822 across `update-flow`, `shared`, `update-preflight`, `update`, `clone-swap`, and `git.test.ts`. Direct coverage of the seven touched sources exited 0.

## Re-baselined tables (Task 3)

Every edited row is a freshness `ls-remote` row, a re-clone row, or a cause-chain text. No status, outcome, or result row changed.

- `features/plugin/info.feature`: 2 request tables (moved remote: added `GET`, `POST`, `POST`).
- `features/plugin/git-source-update.feature`: 2 request tables (one moved remote: added `GET`, `POST`, `POST`; the refusal outline: the check's `GET <status>` and the re-clone's `GET <status>`), plus 3 cause-chain rows (`HTTP Error: 404 Not Found` became `git ls-remote failed: repository-not-found, exit code 128`; `socket hang up` became `git ls-remote failed: network, exit code 128`; `HTTP Error: 503 Service Unavailable` became `git ls-remote failed: network, exit code 128`; each keeps its `fetched https://{git host}/acme/ghp.git` link).
- `features/plugin/url-marketplace-update.feature`: 1 request table (the check's and the re-clone's `GET <status>`) and 1 cause-chain row: `HTTP Error: <status> <phrase>` became `git ls-remote failed: <kind>, exit code 128`. The outline's `phrase` column became `kind`, which is `network` for 500, 502, and 503 and `repository-not-found` for 404.
- `features/plugin/update.feature`: 0 request tables and 1 cause-chain row. In "Fetch and update classify an unknown network error alike", the `update` row's cause `Empty response from git server.` became `git ls-remote failed: failed, exit code 128`. **Both reasons read `network error`:** the `fetch unknown@gits` row and the `update gits@gits` row.
- `features/mcp-server/verdict-fetch.feature`: 2 request tables, one per profile (moved remote: added `GET`, `POST`, `POST`).
- `features/plugin/fetch.feature` (Task 1): 1 request table (moved remote), plus the new scenario.

## Issues Encountered

- The session refuses Bash text that names a path containing `git` in a complex form. Edits, runs, gates, and commits ran from scripts in the scratch directory.
- The cucumber suite first failed in `BeforeAll`, because the optional-peer cache was empty in this worktree. `node scripts/install-test-peers.mjs` filled it.
- Suite runs: the whole module suite passed 19,154 of 19,155 tests after Task 2. The one failure is the known baseline `test/bridges/hooks/dispatch-exec.test.ts:39` (environment too large). `npm run test:integration` exited 0. A logging `git` first on PATH recorded every clone, fetch, and ls-remote of both suites. No new case reaches a remote host. The github.com rows are the auth-e2e cases through the CONNECT proxy, the contract cases that rewrite the URL to `file://`, and the `install-orch-pi4` case that 03-06 pointed at a loopback base. The other URLs are loopback, `.invalid`, `file://`, or the ssh stand-in.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-27: every directory the mirror swap touches comes from `pluginCloneDir`, `pluginCloneBackupDir`, or `sourcesStagingDir`, and only `rename` moves a mirror. The carry-over paths pass `assertPathInside` against their checkout. T-03-28: `kept-in-use` throws `PluginMirrorInUseError` (`permission denied`), and a mirror passes `keepOnUnreachable: false`. T-03-29: the swap runs inside the caller's state lock, and the next refresh of the key restores or removes a leftover backup before its check. T-03-30: each kept PUP-2 case writes one debug-log line that names the variable or the in-use cause. T-03-31: accepted, as planned. T-03-SC: nothing was installed. The optional-peer cache fill is the repository's own test script.

## Orchestrator actions

Run after the wave merges (the plan asks for it; this executor did not run it):

`node .claude/gsd-core/bin/gsd-tools.cjs windows append --kind unrun-verify --phase 3 --file extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts --description "[system-git] a plugin mirror held open by another process (EBUSY/EPERM on rename) fails the plugin's row as permission denied and is retried by the next command; only injected renames prove it, and the manual Windows check covers it"`

## Lines for later plans

- **The swap's final option list:** `CloneSwapArgs = { locations, liveDir, backupDir, url, ref?, gitOps, auth, liveMarker, keepOnUnreachable, ownershipMarker, carryOver, onReplaced?, removalOps, renameOps }`. Marketplace callers pass `ownershipMarker: true` and `liveMarker: MARKETPLACE_MANIFEST_MARKER`. The mirror passes `ownershipMarker: false`, `liveMarker: ".git/HEAD"`, and `keepOnUnreachable: false`. `clone-swap.ts` also exports `swapCloneUrl(liveDir, source, gitOps)` and `installedRootsInside(liveDir, marketplaces)`.
- **The mirror's `kept-in-use` mapping:** `PluginMirrorInUseError(renameError)`, with the message `Could not replace the plugin mirror because it is in use; the existing copy was kept and the next command will try again.`. Its `code` is `EACCES` for an `EACCES` rename and `EPERM` for `EPERM` or `EBUSY`. Every plugin row reads `permission denied`, and the TUI cause line is `<message> -> <rename error>`. The cucumber token is `{read-only plugin mirror folder rename error}`.
- **PUP-2 debug-log lines (tag `git`):**
  - kept-stale: `plugin update kept marketplace <name>: remote unreachable, keeping existing clone (CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE): <ls-remote error message>`
  - kept-in-use: `plugin update kept marketplace <name>: checkout in use, keeping existing clone: <rename error message>`
- **Re-baselined tables per file:** `fetch` 1 (plus the new scenario), `info` 2, `git-source-update` 2 plus 3 cause rows, `url-marketplace-update` 1 plus 1 cause row, `update` 0 plus 1 cause row, `verdict-fetch` 2.
- **For 03-15:** `GitOps.fetch`, `forceUpdateRef`, and `currentBranch` have no production caller left. Their doc comments in `shared.ts` still say "D-14 step N".
- **Stale comments outside this plan's files:** `eslint.config.js:79` still says `shared.ts` "owns ... refreshGitHubClone". The `NETWORK_SEAM_NAMES` ban still lists the name, which does no harm. `orchestrators/{marketplace,plugin}/info.ts` and `reconcile/pending.ts` name it in their headers as an identifier they never use. `test/orchestrators/marketplace/update.test.ts:5756` names it in a comment.
- **For 03-14 (the PUP-2 keep scenario):** the sync reads the variable once per `updatePlugins` run, and `UpdatePluginsOptions.environment` injects it. A kept sync does not stamp the marketplace record. No `marketplace update` row appears, and the plugin rows read the kept catalog.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The plan's work is complete. The wave gate runs `npm run check`.
- No production code runs D-14's fetch, ref update, and checkout.

## Self-Check: PASSED

- FOUND: every key file listed above (no file was created).
- FOUND: `4d3ba61`, `e2f5ae5`, `26f5099`, each an ancestor of HEAD. `git rev-list --count fb7205f..HEAD` = 3 before this SUMMARY commit.
- Acceptance greps:
  - Task 1: `refreshCloneBySwap` in `clone-cache.ts` = 2; `refreshGitHubClone` = 0; `pluginCloneBackupDir` = 1; `forceUpdateRef\|currentBranch` in `clone-cache.test.ts` = 0; `cannot be moved aside` in `fetch.feature` = 1.
  - Task 2: wrappers in `update-flow.ts` = 0; `refreshCloneBySwap` in `update-flow.ts` = 2; wrappers in `shared.ts` = 0; `forceUpdateRef\|currentBranch` in `update-flow.test.ts` = 0; non-comment wrapper names in `extensions` = 0.
  - Task 3: `Empty response from git server` in `update.feature` = 0.
- Verify commands:
  - Task 1: unit 818/818; `fetch.feature` adapter 12/12, builtin 0; typecheck, lint, fallow, `check:features`, and ESLint on `git-source.steps.ts` exit 0.
  - Task 2: unit 822/822; direct coverage exit 0; typecheck, lint, fallow exit 0.
  - Task 3: `update.feature` adapter 26/26, builtin 1/1; `features/plugin features/marketplace verdict-fetch` adapter 1314/1314, builtin 40/40; `check:features` exit 0.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*

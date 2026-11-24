---
phase: 03-system-git-transport-and-clone-shape
plan: "07"
subsystem: marketplace-update
tags: [system-git, re-clone-swap, ls-remote, keep-on-failure, cucumber-rebaseline]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-05 runRemote, ls-remote verbs, the insteadOf pair, the D-SG-14 retry; 03-06 the depth-1 system-git clone and its rows"
provides:
  - "orchestrators/marketplace/clone-swap.ts: refreshCloneBySwap, keepMarketplaceOnFailure, KEEP_MARKETPLACE_ON_FAILURE_VARIABLE, RenameOps, DEFAULT_RENAME_OPS, and the ownership marker helpers"
  - "ScopedLocations.sourceBackupDir and pluginCloneBackupDir"
  - "marketplace update of github and url sources on D-SG-10 with D-SG-15"
  - "re-baselined marketplace update tables and the kept-in-use scenario"
affects: [03-09, 03-12, 03-13, Phase 6 wording]

plan_head_before: 91ecbeaa9ee08bb4ec2e517b0a839b016b8fbb15
plan_head_after: 0d10348f84057fe131a599f0bf727ed07724302a

actuals:
  tokens: 49000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "A refresh of a cloned checkout is recover, freshness check, clone into sources-staging/<uuid>, move aside to a backup getter, move in, delete the backup"
    - "An update test's GitOps double answers ls-remote with a fixed commit and clones a fixture tree, and its HEAD becomes the remote's after a clone"
    - "A swap carries each installed plugin's node_modules from the backup into the new checkout before it deletes the backup"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
    - test/orchestrators/marketplace/clone-swap.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - eslint.config.js
    - test/orchestrators/marketplace/update.test.ts
    - test/persistence/locations.test.ts
    - features/marketplace/git-source.feature
    - features/marketplace/url-source-update.feature
    - features/marketplace/device-flow.feature
    - features/step_definitions/marketplace/checkout.steps.ts

key-decisions:
  - "The backup lives in sources-backup/<name> (and plugin-clones-backup/<key> for 03-09), outside sources/ and plugin-clones/"
  - "Recovery of an interrupted swap runs before the freshness check, so a restored checkout can be current with no clone"
  - "An unreadable HEAD is stale with no ls-remote, as upstream's $Ft does"
  - "Unreachable is any ls-remote failure except git-missing, refused-input, aborted, and InvalidGitHubBaseUrlError (GHB-03); those are thrown"
  - "When the re-clone after an unreachable check fails too, the check's failure is the one reported (GAUTH-04 keeps 'rejected the stored credential')"
  - "The refresh clones from the checkout's recorded origin when it has one, else networkCloneUrl(source)"
  - "One Device Flow memo per refresh, so the ls-remote and the clone ask the user at most once"
  - "Kept rows: marketplace skipped {network unreachable} or {permission denied}, severity warning, one child PluginUpdateSkippedMessage with marketplaceSubject and the cause; no stamp, no cascade"
  - "Coordinator decision (option A): after the move-in and before the backup is deleted, each installed plugin's node_modules moves from the backup into the same folder of the new checkout, only when that folder exists and has none; a failed move is debug-logged and never fails the update"

patterns-established:
  - "A kept refresh is a RecordRefresh of kind kept that the snapshot carries past the lock, and refreshOneMarketplace reports it instead of cascading"

requirements-completed: ["SG-TRN-03", "SG-TRN-06"]

coverage:
  - id: D1
    description: "A stale github or url marketplace is re-cloned into staging and swapped in through sources-backup/; a current one is not cloned; a full-SHA ref runs no ls-remote"
    requirement: "SG-TRN-03"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/clone-swap.test.ts#D-SG-10: a stale checkout is cloned into staging and swapped in with the ownership marker"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#MU-4 + D-SG-10: a stale github source is re-cloned into staging and swapped in"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#MURL-03 + D-SG-10: a stale url source is re-cloned with its host-keyed auth bundle"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed clone leaves the live checkout; a failed move-in renames the backup back; an interrupted swap is recovered by the next update; the state lock stays fresh past one update interval and a second update gets StateLockHeldError"
    requirement: "SG-TRN-03"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/clone-swap.test.ts#D-SG-10 / NFR-3"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#Q13"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE keeps a valid checkout whose remote is unreachable, warns, does not stamp, and runs no cascade"
    requirement: "SG-TRN-06"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/clone-swap.test.ts#D-SG-15"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-SG-15"
        status: pass
    human_judgment: false
  - id: D4
    description: "A checkout that cannot be moved aside (EACCES through a read-only sources/ folder) is kept with a warning and replaced by the next update"
    requirement: "SG-TRN-03"
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a marketplace whose checkout cannot be moved aside keeps it and warns, and the next update replaces it"
        status: pass
    human_judgment: false
  - id: D5
    description: "Windows open-handle form (EBUSY, EPERM on rename) of the kept-in-use branch"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/clone-swap.test.ts#D-SG-10: a checkout that cannot be moved aside with EBUSY is kept and the staging removed"
        status: pass
    human_judgment: true
    rationale: "Only injected renames prove it; a real Windows open handle needs the deferred manual check."
  - id: D6
    description: "An installed path-source plugin keeps its npm packages across a marketplace update (D-PL9-10 carry-over)"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/clone-swap.test.ts#D-PL9-10"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-PL9-10: an update carries the packages of installed plugins inside the checkout into the new one"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter|builtin features/plugin"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 07: Marketplace update by re-clone and swap Summary

**`marketplace update` of a github or url marketplace now runs Claude Code's model. It checks freshness with `ls-remote`, or compares a full-SHA ref with `HEAD`. A stale checkout is cloned again into `sources-staging/<uuid>`, marked, and swapped in through `sources-backup/<name>`. An interrupted swap is recovered first. A checkout that cannot be moved aside is kept with a warning. With `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` set, an unreachable remote keeps the checkout too. The swap carries each installed plugin's `node_modules` from the old checkout into the new one, so an update never strips an installed plugin of its packages.**

## Performance

- **Duration:** about 62 min
- **Started:** 2026-11-24T06:49:58Z
- **Completed:** 2026-11-24T08:04:31Z
- **Tasks:** 3 of 3, plus the coordinator's option A for the package regression
- **Files modified:** 13 (2 created)

## Accomplishments

- `refreshCloneBySwap` puts back an interrupted swap, checks freshness, keeps or clones, and swaps. Every directory it touches comes from a `ScopedLocations` getter, and both renames stay under the extension root.
- `update.ts` refreshes github and url sources through it. It keeps the GAUTH-04 stored-credential line (before the fetched link for github, as the chain's tail for url). MU-5 flips once the new clone is live. UXG-05 stays a content compare.
- D-SG-15 reads the variable once per update. A kept checkout is a warning row, writes nothing to the record, and runs no autoupdate cascade, so the background pass raises no notice.
- After the move-in, the swap moves each installed plugin's `node_modules` from the backup into the new checkout (coordinator decision, option A). `update.ts` derives the plugin roots from the scope's installed records whose root lies inside the checkout, and each move checks both paths against their checkout (NFR-10).
- `features/plugin` passes under both profiles (776/776 adapter, 39/39 builtin). `features/marketplace` passes under both profiles (534 scenarios adapter, 0 builtin), the new kept-in-use scenario included. `features/plugin/update.feature` passes unchanged (26 adapter, 1 builtin). `features/mcp-server/verdict-update.feature` and `verdict-markers.feature` pass under both profiles.

## Task Commits

1. **Task 1 (tracer): re-clone and swap for github** - `0f869da` (feat). Tracer gate: the three verify commands were green before the commit (407/407 unit; `github-source.feature` 11/11 adapter, 0 builtin; typecheck, lint, fallow exit 0). `github-source.feature` has no update scenario, so it needed no re-baseline.
2. **Task 2: url on the swap, recovery, and the keep variable** - `6539b85` (feat)
3. **Deviation fix: report the check's failure** - `48e170a` (fix)
4. **Task 3, steps 1-3: re-baseline** - `12ec5f9` (test)
5. **Task 3, step 4: the kept-in-use scenario** - `5c1701f` (test)
6. **First SUMMARY (halted on the package regression)** - `9ab72f4` (docs)
7. **Coordinator decision A: carry installed plugins' packages across a swap** - `0d10348` (fix)

## Files Created/Modified

- `orchestrators/marketplace/clone-swap.ts` (created) - the D-SG-10 swap, D-SG-15, and the ownership marker helpers moved from `add.ts`.
- `orchestrators/marketplace/update.ts` - `refreshGitSource`, `refreshAuthFor`, `attachStoredCredentialCause`, `RecordRefresh`, `keptRefresh`, `notifyKept`, and the `renameOps` and `environment` options.
- `orchestrators/marketplace/add.ts` - imports the marker helpers.
- `persistence/locations.ts` - `sourceBackupDir`, `pluginCloneBackupDir`.
- `shared/notification-types.ts` - `PluginUpdateSkippedMessage.marketplaceSubject` (outside `files_modified`, see deviation 1).
- `eslint.config.js` - `clone-swap.ts` in `NETWORK_SEAMS`, `refreshCloneBySwap` in `NETWORK_SEAM_NAMES`.
- Tests: `clone-swap.test.ts` (created, 47 cases), `update.test.ts` (rewritten on the swap), `locations.test.ts`.
- Features: `git-source.feature`, `url-source-update.feature`, `device-flow.feature`, `checkout.steps.ts`.

## Decisions Made

See `key-decisions` in the frontmatter. For maintainer review (orchestrator decision 3):

- The kept outcomes reuse the closed reasons `network unreachable` and `permission denied`. No new closed-set token was added. `EBUSY` shares `permission denied`, because Windows reports a file that another process holds open as `EBUSY` or `EPERM`.
- The kept-in-use cause is `Could not replace the marketplace checkout because it is in use; the existing copy was kept and the next update will try again.` with the rename's error after it. The kept-stale cause is `Marketplace remote unreachable, keeping existing clone (CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE)` with the `ls-remote` error after it. Both follow Claude Code's text, and Phase 6 owns the wording.
- Known leftover: `marketplace remove` does not delete a `sources-backup/<name>` that an interrupted swap left. The next add or update of that name clears it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The kept row's JSON id needed `marketplaceSubject` on the skipped variant**
- **Found during:** Task 1
- **Issue:** A kept checkout's cause rides a child `PluginUpdateSkippedMessage`, the one update row type with a cause. Without `marketplaceSubject`, its JSON id was `tools@tools`.
- **Fix:** Added the existing D-PL5-12 field to `PluginUpdateSkippedMessage` in `shared/notification-types.ts`. The file is outside `files_modified`; 03-08 does not touch it. A unit case pins `id: "official"` in JSON mode.
- **Commit:** `0f869da`

**2. [Rule 1 - Bug] Recovery renamed the backup into a missing `sources/`**
- **Found during:** Task 2 (its own unit case)
- **Fix:** `recoverInterruptedSwap` creates the parent before the rename.
- **Commit:** `6539b85`

**3. [Rule 1 - Bug] An unreachable update reported the re-clone's failure and lost GAUTH-04's line**
- **Found during:** Task 3, step 1
- **Issue:** After the host rejects a stored credential on the `ls-remote`, git's credential helper erases it. The re-clone then finds no credential, and its failure said `no credential was obtained` instead of `rejected the stored credential` (03-RESEARCH Pitfall 6).
- **Fix:** When the clone after an unreachable check fails, the check's failure is thrown. Upstream reports its clone's stderr. Here both failures have the same kind in every other measured case.
- **Commit:** `48e170a`

**4. [Plan accuracy] The refresh clones from the checkout's recorded origin**
- **Issue:** `url-source-update.feature` "...recorded with a clone url ending in .json still fetches from its git host" records the source as `.../tools.json`, while the checkout's origin is `.../tools.git`. D-14 fetched by remote name. A clone of `networkCloneUrl(source)` would have asked the wrong path.
- **Fix:** `swapCloneUrl` reads `listRemotes` and uses the origin URL when there is one.
- **Commit:** `0f869da`

**5. [Rule 2] One Device Flow memo per refresh**
- **Issue:** Without the keep variable, an unreachable check clones again. A declined Device Flow on the `ls-remote` would prompt a second time for the clone.
- **Fix:** `refreshAuthFor` passes a fresh `authMemo` per refresh.
- **Commit:** `6539b85`

**6. [Scope] `background-update.steps.ts` and `checkout.steps.ts` lines 60-105**
- The two inline request assertions in `background-update.steps.ts` read a git-source plugin's background update (`/acme/ghp.git`), not a marketplace update, and pass unchanged. That file needed no edit.

---

**Total deviations:** 6 (2 bugs, 2 missing-critical, 1 plan accuracy, 1 scope), plus the coordinator's decision A above. **Impact:** within the plan's surface except `notification-types.ts`.

## Decision taken: packages of installed plugins survive a swap

The first run of this plan halted. `features/plugin/package-dependencies.feature` failed 2 scenarios under the adapter profile (774/776): "Apply that moves a plugin whose package install fails reports the warning" and "A marketplace update with autoupdate on that moves a plugin whose package install fails reports the warning". Both failed on `ENOENT .../sources/tools/plugins/pkp/node_modules`.

**Cause.** A path-source plugin of a git marketplace runs in place inside `sources/<marketplace>/`, and D-PL9-10 installs its npm packages into `node_modules` there. D-14 fetched in place, so `node_modules` survived. The swap replaced the whole checkout, so the packages were lost. Claude Code keeps installed plugins in a separate cache, so its marketplace refresh never touches them.

**Decision (coordinator, option A).** Carry each installed plugin's `node_modules` from the backup into the new checkout. This keeps today's user-visible behavior, needs no network (NFR-5 unchanged), and keeps the upstream outcome that a marketplace refresh never strips an installed plugin. Options B (install again after a swap, which needs an NFR-5 amendment) and C (accept the loss) were declined.

**Implementation (`0d10348`).**
- `CloneSwapArgs.carryOver` lists the plugin roots relative to the checkout.
- `swapIn` runs `carryPackages` after the move-in and `onReplaced`, and before it deletes the backup. For each root, `<backup>/<root>/node_modules` is renamed to `<live>/<root>/node_modules` only when the backup holds it, the new checkout has `<root>`, and `<root>` has no `node_modules`.
- Both paths go through `assertPathInside` against their checkout. A refusal or a failed rename is debug-logged and never fails the update.
- `update.ts::installedRootsIn` takes every installed record of the scope whose `resolvedSource` lies inside `sources/<marketplace>/`.
- Known consequence: a stale `node_modules` survives a lockfile change that came with no version move, as under D-14.

**RED and GREEN.**
- RED: the six `D-PL9-10` cases ran against HEAD's `clone-swap.ts` and `update.ts`: `# tests 6 # pass 4 # fail 2`. The carry case and the update case failed with `ENOENT ... plugins/pkp/node_modules/dep/index.js`. The four guard cases (root missing, packages already there, no packages, failed move) pass on the old code, because they prove that nothing is carried. The out-of-checkout case (NFR-10) also passes as a guard.
- GREEN: 249/249 across `clone-swap`, `update`, and `background-pass`, and direct coverage of `clone-swap.ts` and `update.ts` is 100%. `features/plugin` passes 776/776 adapter and 39/39 builtin, and `features/marketplace` passes 534/534 adapter.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks. The hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each TDD task's commit holds RED and GREEN together. The RED runs swapped HEAD's copy of the named sources in, ran the new cases, and restored the sources (`red.sh` in the scratch directory).

- **Task 1 RED.** `locations.test.ts` against HEAD `locations.ts`: `# tests 39 # pass 31 # fail 8`. The new backup cases failed because the getters do not exist (`locations.sourceBackupDir is not a function`), and the bundle key lists differed. `update.test.ts` (pattern `D-SG-10|MU-5: a replaced`) against HEAD `update.ts`: `# tests 9 # pass 2 # fail 7`. For example, `+ [] - [{ ref: 'main', url: 'https://github.com/anthropics/claude-plugins-official.git' }]` (no `ls-remote`), and the kept-in-use case got `● official [project] (updated)` plus a cascade row instead of `skipped {permission denied}`. Semantic assessment: each target ran and failed on its planned assertion. The 2 that passed pin behavior that stays the same: the MU-5 advanced-clone message, and a full-SHA ref equal to `HEAD` that clones nothing. `clone-swap.test.ts` has no HEAD source, because the module is new. Its RED is a load failure, not an assertion RED, and the update cases carry that task's RED evidence. **GREEN:** 407/407 across the four Task 1 test files; direct coverage of `clone-swap.ts`, `update.ts`, `add.ts`, and `locations.ts` is 100%.
- **Task 2 RED.** `update.test.ts` (pattern `D-SG-15|NFR-3|MURL-03|right after a replacing|GHB-04: updating a url`) against HEAD `update.ts` and `clone-swap.ts`: `# tests 8 # pass 1 # fail 7`. For example, the kept case got `Some operations have failed. ... ⊘ tools (failed) {network unreachable} cause: Failed to update marketplace "tools". -> git ls-remote failed: network, exit code 128` instead of the kept warning. The recovery case got no `ls-remote` or clone call that matched. The url cases still fetched in place. The idempotency case passed: the Task 1 swap already made a second update current. `clone-swap.test.ts` against HEAD `clone-swap.ts`: a load failure, `does not provide an export named 'KEEP_MARKETPLACE_ON_FAILURE_VARIABLE'` (INVALID_RED; the update cases carry the RED). **GREEN:** 242/242 across `clone-swap`, `update`, and `background-pass`; direct coverage of the three sources is 100%.
- **Task 3 RED (scenario).** With the in-use branch of `moveLiveAside` changed to rethrow (a local edit, not committed, restored after the run), the new scenario failed at `Then the result has these fields`: `+ 'error' - 'warning'` and `+ 'Some operations have failed.' - 'Some operations need attention.'`. **GREEN:** the scenario passes (19/19 steps), and the Given's EACCES check passed in this sandbox, so no cucumber exemption was needed.

## Re-baselined tables (Task 3)

Every edited row is a freshness `ls-remote` row, a re-clone row, a `CONNECT` row, or a cause-chain text.
- `features/marketplace/git-source.feature`: 2 request tables (each gains the re-clone's `GET 401`), 6 cause-chain rows (`The operation was canceled.` becomes `git ls-remote failed: https-auth, exit code 128`; the rejected rows gain that link and lose `fetched https://...`, because `platform/git.ts`'s `withFetchedUrlCause` adds no link to an error that already has a cause, here `StoredCredentialRejectedError`).
- `features/marketplace/url-source-update.feature`: 1 request table (the re-clone's `GET <status>`), 2 cause-chain rows (`HTTP Error: <status> <phrase>` becomes `git ls-remote failed: <kind>, exit code 128`; the outline's `phrase` column became `kind`; `socket hang up` becomes `git ls-remote failed: network, exit code 128`).
- `features/marketplace/device-flow.feature`: 1 request table (the background update with no credential gains the re-clone's `GET 401`), 4 routing tables (one `CONNECT github.com:443` row per git process: 1 for a current update, 2 for an unreachable one).
- `features/step_definitions/marketplace/background-update.steps.ts`: 0.
- New scenario: `git-source.feature` "Updating a marketplace whose checkout cannot be moved aside keeps it and warns, and the next update replaces it", with the error token `{read-only checkout folder rename error}`.

## Issues Encountered

- The session refuses Bash text that names a path containing `git` in a complex form. Edits, cucumber runs, and commits ran from scripts in the scratch directory.
- One direct-coverage run printed a `Legacy marketplace migration could not be persisted ... chown ... ENOENT` line once and exited 0. A second run was clean.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-21: every swap path comes from `sourceCloneDir`, `sourceBackupDir`, or `sourcesStagingDir`, and only `rename` moves a checkout. T-03-22: the state lock covers recovery, the check, the clone, and the swap; a failed move-in renames the backup back. T-03-23: `writeOwnershipMarker` writes into staging before the swap (a unit case reads the marker in the live checkout). T-03-24: a kept checkout warns, names the variable, and leaves the record unstamped. T-03-SC: nothing was installed.

## Orchestrator actions

Run after the wave merges (the plan asks for it; this executor did not run it):

`node .claude/gsd-core/bin/gsd-tools.cjs windows append --kind unrun-verify --phase 3 --file extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts --description "[system-git] a marketplace checkout held open by another process (EBUSY/EPERM on rename) is kept and retried on the next update; only injected renames prove it, and the manual Windows check covers it"`

## Lines for later plans

- **Signature:** `refreshCloneBySwap(args: CloneSwapArgs): Promise<CloneSwapResult>`, with `CloneSwapArgs = { locations, liveDir, backupDir, url, ref?, gitOps, auth, liveMarker, keepOnUnreachable, carryOver, onReplaced?, removalOps, renameOps }`. `liveMarker` is relative to the checkout: `.claude-plugin/marketplace.json` for a marketplace, `.git/HEAD` for a mirror. A mirror passes `keepOnUnreachable: false`.
- **Result union:** `{ kind: "current" } | { kind: "replaced" } | { kind: "kept-stale"; cause: unknown } | { kind: "kept-in-use"; cause: Error }`.
- **Order:** recover (backup beside no checkout, or beside one without `liveMarker`: renamed back; beside a valid one: removed), then the freshness check (unreadable `HEAD` is stale; full-SHA ref compares with `HEAD`; else `resolveRemoteRef`), then keep or clone, then `rename(live, backup)` (EBUSY, EPERM, EACCES give kept-in-use), `rename(staging, live)` (a failure renames the backup back), `onReplaced`, the carry-over of each installed plugin's `node_modules` from the backup, and the backup is removed (a leak is debug-logged).
- **Rows:** kept-stale is `{ status: "skipped", reasons: ["network unreachable"], severity: "warning" }` on the marketplace, with one child `PluginUpdateSkippedMessage { status: "skipped", reasons: ["network unreachable"], cause, marketplaceSubject: true, severity: "warning", needsReload: false }`. kept-in-use is the same with `permission denied`. The TUI text is `Some operations need attention.` then `● <mp> [<scope>] (skipped) {<reason>}` and `⊘ <mp> (skipped) {<reason>}` with the cause line.
- **Requests:** a current update is `GET`, `POST`; a stale one adds the clone's `GET`, `POST`, `POST`; a refused `ls-remote` is followed by the re-clone's refused `GET`; a Device Flow update with a stored token is `GET 401`, `GET 200`, `POST` and one `CONNECT` row.
- **For 03-09, carry-over:** a plugin mirror swap needs the same carry-over rule. A mirror can hold an installed plugin root, and its packages sit in that root's `node_modules`. Pass the roots of the installed records inside the mirror as `carryOver`, as `update.ts::installedRootsIn` does for a marketplace checkout.
- **For 03-09:** `pluginCloneBackupDir(key)` is ready. `shared.ts`'s `refreshGitHubClone` and `refreshUrlClone` keep their other callers (the PUP-2 sync and the mirror refresh). `update.ts` no longer imports them.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The plan's work is complete. The wave gate runs `npm run check`.
- 03-09 can reuse `refreshCloneBySwap` for mirrors, with `liveMarker: ".git/HEAD"`, `keepOnUnreachable: false`, and the carry-over roots of the installed plugins inside the mirror.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts, test/orchestrators/marketplace/clone-swap.test.ts
- FOUND: 0f869da, 6539b85, 48e170a, 12ec5f9, 5c1701f, 9ab72f4, 0d10348 (each an ancestor of HEAD; `git rev-list --count 91ecbea..HEAD` = 7 before this SUMMARY commit)
- Acceptance greps: `refreshCloneBySwap` in `eslint.config.js` = 2; `sources-backup` in `locations.ts` = 2; `refreshUrlClone\|refreshGitHubSource` in `update.ts` = 0; `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` in `clone-swap.ts` = 3; `cannot be moved aside` in `git-source.feature` = 1.
- Verify commands: Task 1 unit 407/407, `github-source.feature` 11/11 + 0, typecheck/lint/fallow exit 0. Task 2 unit 242/242, direct coverage exit 0. Task 3 `features/marketplace` 534/534 + 0, `features/plugin/update.feature` 26/26 + 1/1, `check:features` exit 0, ESLint on `checkout.steps.ts` exit 0.
- After the carry-over: `features/plugin` 776/776 adapter, 39/39 builtin; `features/marketplace` 534/534 adapter; unit 249/249; direct coverage exit 0; ESLint and fallow exit 0.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*

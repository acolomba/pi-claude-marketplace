# Phase 7: Git Errors and Lock Discipline - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning

<domain>
## Phase Boundary

One classifier reports every git host failure, and no clone read, copy, or
cleanup runs outside the state lock. Requirements GLK-01..GLK-08; backlog
GITERR-01, CASCREASON-01, CLONEGC-01, TAGCOPY-01, FETCHROW-01, INTENTMS-01,
ENTRYVER-01, LCORCH-01 b5.

Owned files (ROADMAP `Files`): `shared/git-failure-classifiers.ts`,
`orchestrators/plugin/{fetch,clone-gc,clone-cache,update-preflight,update-flow,uninstall,dependency-bindings}.ts`,
`orchestrators/edge-deps.ts`, `orchestrators/plugin/info.ts` (fetch path only),
`orchestrators/plugin/dependency-tag-probe.ts` (classification only),
`orchestrators/marketplace/{shared,update,remove}.ts` (classification and clone
cleanup only), `orchestrators/reconcile/apply.ts` (clone cleanup only),
`orchestrators/plugin/update-swap.ts` (intent mark and cleanup only),
`orchestrators/plugin/reinstall-flow.ts` (cleanup only). Sibling phases edit
other functions of the shared files in parallel: touch only the functions named
here.

</domain>

<upstream>
## Upstream evidence (Claude Code 2.1.310 binary, grepped 2026-10-26; docs read 2026-10-26)

- **Git failure wording (high confidence).** Claude Code does not tell 404,
  5xx, auth, and network apart for plugins: install and update embed git's raw
  stderr (`Failed to clone repository: ${stderr}`, wrapped as
  `✘ Failed to install plugin "<id>": …` / `✘ Failed to update plugin …`). The
  marketplace family has one classifier shared by add, update, and autoupdate
  (`HTTPS authentication failed…`, `Network error or timeout while cloning…`,
  else raw stderr; a 404 reads as an auth failure). `--json` carries a coarse
  `failureCode` (`error_network` / `error_not_found` / `error_permission` /
  `error_unknown`). So upstream has two family formatters, not per-operation
  ones.
- **No `fetch` verb (high).** Upstream keeps no plugin mirror and has no
  `fetch` or `info --fetch`; this extension's `fetch` is a recorded Pi-only
  extension (FTCH-01..06).
- **Version (high).** Install, update, and the installed list use plugin.json
  `version`, then the entry `version`, then a 12-hex sha. Discover shows the
  entry version. This extension already chose VER-01/VER-02 (one rule for
  install, list, info), so GLK-07 aligns the remaining surfaces with VER-01.
- **Tag refs (medium-high).** Upstream always clones over the network on
  update; this extension keeps mirrors and NFR-5 lets a warm read stay offline.
- **Locks (medium).** Upstream takes no lock around plugin cache GC (it uses
  `.in_use` pid markers and a 14-day orphan delay). This extension's lock model
  (D-06, `withStateGuard`) is its own and is the one GLK-03..05 extend.

</upstream>

<decisions>
## Implementation Decisions

### Git host classification (GLK-01, GLK-02)

- **D-PL7-01: one entry point with a per-operation not-found rule.** Replace
  the four public layers in `shared/git-failure-classifiers.ts` with one export,
  `classifyGitFailure(error, rule, remoteUrl?)`, returning
  `{ reason, frame? } | undefined`. `rule` is
  `{ notFound: "source missing" | "network error"; missingRef?: "source missing" }`.
  Ladder: unwrap a cleanup leak (INR-02); `PinnedCommitMissingError` ->
  `source missing`; transport (`CrossOriginChallengeError`,
  `StoredCredentialRejectedError`, HttpError 401/403, `UserCanceledError`) ->
  `authentication required`; network errno -> `network unreachable`; HTTP
  404/410 -> `rule.notFound`; any other HTTP status -> `network error`; remote
  `NotFoundError` -> `rule.missingRef`. `frame` is `{status} on {url}`, set when
  an HTTP status was classified and `remoteUrl` is passed. Upstream has no
  token model to match (it prints git stderr); the closed reason set is the
  project's recorded model (ADD-09/ADD-10, UPD-11), so no divergence license is
  needed beyond those. Make the old helpers module-private or delete them so
  fallow sees no test-only export; keep an auth predicate for
  `marketplace/shared.ts::lacksStoredCredential`.
- **D-PL7-02: rule per operation.**
  - `marketplace add` (and install's marketplace-add body): `{ notFound: source missing, missingRef: source missing }` (fresh clone, ADD-09).
  - `marketplace update` refresh and its autoupdate cascade: `{ notFound: network error }` (UPD-11 kept).
  - Plugin `update`'s marketplace refresh (`syncCloneOnce` in `update-flow.ts`): `{ notFound: network error }`, because it is the same refresh as `marketplace update` (today it falls through to `{unreadable manifest}`).
  - Every plugin clone access: install, install cascade member, import, apply outcome, update preflight, `fetch`, `info --fetch`, the dependency tag probe: `{ notFound: source missing }`. `fetch` keeps its `source missing` fold for an unclassified throw after the call; `info` keeps `narrowProbeError` after it. The tag probe's `DependencyTagListingFailureReason` widens to the host reasons.
  - Fix the `fetch` bug the audit found: a 5xx is `network error`, not `source missing`.
- **D-PL7-03: frame placement.** Attach the `{status} on {url}` frame wherever
  the row or notification already has a cause slot and the remote URL is in
  hand at the site (marketplace add and update as today, plugin update's
  marketplace refresh, `fetch`, update preflight). `info` rows have no cause
  slot: token only. Install/import/apply rows keep their current cause chain
  (their sites are owned by other phases' functions; adding a URL there is out
  of scope).
- **D-PL7-04: GLK-02 fallback.** `reasonsFromTypedError` (autoupdate cascade
  and apply's converge path) and `narrowDirectFailReason` (direct path) share
  one ladder: typed errors, then `classifyGitFailure` with the plugin-clone
  rule, then errno, then the direct path's `unreadable manifest` fallback.
  `{not in manifest}` stays only for a plugin the catalog really does not
  list. `cascadeFailureOutcome` attaches `cause: err` for the fallback arm so
  the cause line shows. Apply's converge row (`reconcile/notify.ts`, not owned
  here) keeps dropping the cause: recorded as deferred.

### Lock discipline (GLK-03, GLK-04, GLK-05)

- **D-PL7-05: clone GC under a fresh lock of the operation's scope.** Add
  `collectPluginClonesLocked(locations, keep?)` in `clone-gc.ts` =
  `withExistingScopeLock(locations, () => garbageCollectPluginClones(locations, keep))`.
  GC needs only that scope's lock (clones and records are per scope). Use it at
  every post-lock site: `uninstall.ts` (`runPostUninstallCleanup`, also covers
  prune), `marketplace/remove.ts` (`runPostRemoveCleanup`), `reconcile/apply.ts`
  (`collectClones`), the production `cleanupClones` binding that
  `update-swap.ts`/`update-preflight.ts` call through
  (`update-flow.ts`, `reinstall-flow.ts` wiring), and
  `dependency-bindings.ts::planCloneSweep`. Never move GC inside a
  `withStateGuard` closure: that guard saves after the closure, so GC would
  see the old `resolvedSource` and delete the new clone. A held lock skips the
  GC (traced, swallowed as D-19-01); the next lifecycle operation retries.
  GC's `loadState` passes `persistMigration: false`.
- **D-PL7-06: tag copy under the plugin scope's lock.** Wrap only the
  `materializeMarketplaceTagClone` call in `update-preflight.ts` in
  `withExistingScopeLock(options.locations, …)`, as `probeUnpinned` does. Since
  D-MF-04 the plugin's scope records its own marketplace, so the plugin-scope
  lock is the lock `marketplace update` takes on that `.git`. A held lock
  reports the existing `lock held`. Wrapping the whole preflight would nest
  with its other locks.
- **D-PL7-07: fetch rows inside the lock.** `fetchOne` and `info --fetch`
  (`makeFetchProbe` and the row build) run the materialize and the row read in
  one `withExistingScopeLock` body, keeping the `lock held` mapping. Only the
  unpinned arm locks, as today: locking the pinned arm would add a new
  `lock held` failure a user can see.

### Intent mark (GLK-06)

- **D-PL7-08: strictly increasing intent stamp.** The intent mark and the
  finalize in `update-swap.ts` write
  `max(Date.now(), Date.parse(previous) + 1)` as ISO (now when `previous` does
  not parse). The mark reads and writes under the scope lock, so the stamp it
  writes always differs from the one a rival run read, and ST-9's
  `updatedAt` comparison catches the overlap. No schema field, no migration.
  Nothing displays `updatedAt`.

### Version and offline tag (GLK-07, GLK-08)

- **D-PL7-09: fetch and completion use `list`'s version rule.** `fetch` rows
  derive status and version from `resolveListCandidate`
  (`list-candidate-version.ts`), read inside the lock (D-PL7-07); a cold or
  failed row keeps the entry version, as `list`'s `(remote)` row does.
  Completion (`orchestrators/edge-deps.ts`) decides `upgradable` with
  `list`'s shared rule instead of the entry version. `browse` already uses
  `list`'s builders (`loadPluginListPayload`): no change, verify only.
- **D-PL7-10: offline tag resolve.** `resolveFetchedRefOffline` in
  `clone-cache.ts` keeps the tracking-ref lookup first, then on NotFound
  resolves `refs/tags/<ref>` locally with `platform/git.ts::resolveTagOid`
  (peels annotated tags), injected as a default the way
  `marketplace-tag-probe.ts` does, not as a new `GitOps` member. A miss still
  refreshes over the network.

### Tests

- Cucumber scenarios that fail without the change: `fetch` with a host 503
  (`{network error}` + frame); `info --fetch` with a host 404 (`source
  missing`); plugin `update` whose url marketplace answers 503; the autoupdate
  twin of `update-rollback.feature`'s first scenario (GLK-02); a `fetch` for a
  path plugin whose plugin.json and entry versions disagree (GLK-07); a warm
  tag-ref reinstall with `the git host receives no request` (GLK-08).
- Lock behavior (GLK-03..05) and the same-millisecond mark (GLK-06) are unit
  tests: a second holder takes the lock with `lockfile.lock`, and seams assert
  `lockfile.check` is true during the work and that the clone dir is gone.
  A one-millisecond race is not deterministic in cucumber.
- Hermetic home in every test (`withHermeticEnvironment`).

### Planning-time amendments (after research)

- **D-PL7-11: thin named wrappers for foreign callers (amends D-PL7-01).**
  Keep `classifyGitHostFailure`, `classifyGitSourceAccessFailure`, and
  `hostHttpFailureFrame` as one-line exported wrappers over
  `classifyGitFailure` with their fixed rules, so `marketplace/add.ts`,
  `import/execute.ts`, `install.messaging.ts`, `install-cascade.messaging.ts`,
  and `reconcile/apply-outcomes.ts` (owned by Phases 1, 2, 3, 5, 6) need no
  edit. Production calls keep them live for fallow. Owned callers move to
  `classifyGitFailure`. `classifyGitTransportFailure` and `hostHttpStatus`
  become private once no production caller is left;
  `lacksStoredCredential` checks `classifyGitFailure(...)?.reason ===
  "authentication required"` inline.
- **D-PL7-12: the cascade attaches the cause on every arm** that has one
  (errno, git, fallback), so the autoupdate row matches the direct row's
  cause line. Existing `EACCES` cascade rows gain a cause line.
- **D-PL7-13: `planCloneSweep`'s "before" listing also runs under the lock.**
- **D-PL7-14: the frame on every classified HTTP status on plugin rows**
  (`fetch`, update preflight, plugin update's marketplace refresh), 404
  included, as `marketplace update` does today. `marketplace add`'s own frame
  rule (network error only) is untouched. Update `fetch.feature:154` and
  `git-source-update.feature:311,313`.
- **D-PL7-15: completion's not-installed version stays** (never displayed).
- **D-PL7-16: shared upgrade rule.** Export the existing private
  `upgradeCandidate` from `list-installed-row.ts` (a one-word edit in a
  Phase 3 file) and call it from `orchestrators/edge-deps.ts`; do not move it.
  `git-source-probe.ts::probeUpgradeCandidate` and its test block are then
  deleted (fallow).
- **D-PL7-17: `fetch`'s list version rule covers the skipped rows**
  (`skippedUpToDate`) too, not only `freshRow`.
- **D-PL7-18: `docs/output-catalog.md` gets prose edits only** (no new
  states: `catalog-contract.test.ts` pins the count, which Phase 3 changes).
- "Waits for the lock" in the success criteria means "refuses or skips while
  another holder has it": the lock uses `retries: 0`.

### Claude's Discretion

- Exact helper names and module placement within the owned files.
- How the shared update ladder is factored inside `update-flow.ts`.

</decisions>

## Uncertain choices (for user review)

1. **Frame on plugin rows (D-PL7-03).** Chose: frame only where a cause slot
   and the URL exist (fetch, update preflight, plugin update's marketplace
   refresh); install/import/apply rows keep their raw cause chain. Alternative:
   thread the fetched URL through every clone seam so every plugin row shows
   `{status} on {url}`. Why: those rows' functions belong to other phases, and
   upstream shows raw stderr anyway.
2. **Plugin update's marketplace refresh 404 (D-PL7-02).** Chose
   `network error` (UPD-11, same refresh as `marketplace update`).
   Alternative: `source missing`, as for the plugin's own clone. Why: one rule
   per remote operation, not per verb.
3. **GLK-02 fallback (D-PL7-04).** Chose the direct path's `unreadable
   manifest` plus the cause line. Alternative: IMP-09's bare `(failed)` with
   the cause. Why: GLK-02 says "as the direct update path does".
4. **Intent mark (D-PL7-08).** Chose a strictly increasing stamp.
   Alternative: the backlog's random token field in the record. Why: no schema
   change and the same guarantee under the lock.
5. **Pinned fetch arm stays unlocked (D-PL7-07).** Alternative: lock it too,
   adding a new `lock held` refusal. Why: the pinned copy never changes; only
   GC could remove it, and GC now takes the lock.
7. **Wrappers kept (D-PL7-11).** Chose thin wrappers so five files owned by
   other phases need no edit. Alternative: one export only, and edit each
   foreign caller. Why: avoids merge collisions (Phase 5 rewrites
   `errorAddReason` in `add.ts`).
8. **Frame on plugin 404 rows (D-PL7-14).** Chose a frame on every HTTP
   status, as `marketplace update` does. Alternative: `marketplace add`'s
   network-error-only frame.
9. **Upgrade rule export (D-PL7-16).** Chose exporting `upgradeCandidate` from
   Phase 3's `list-installed-row.ts`. Alternative: a new shared module both
   delegate to. Why: smallest edit in a file another phase changes.
6. **Tag resolve injection (D-PL7-10).** Chose a default-injected
   `resolveTagOid` in clone-cache. Alternative: a new `GitOps` member (touches
   the fake, the contract, and about five hand-built GitOps objects).

<code_context>
## Existing Code Insights

### Reusable Assets
- `transaction/with-state-guard.ts::withExistingScopeLock(loc, body)` (:147):
  lock only, no state I/O, `retries: 0`; contention -> `StateLockHeldError`.
- `orchestrators/plugin/list-candidate-version.ts::resolveListCandidate` (:47):
  offline version rule (plugin.json, entry, `sha-<12hex>`; cold git -> `cold`).
- `platform/git.ts::resolveTagOid` (:701): local, peels annotated tags; used by
  `marketplace-tag-probe.ts:25-37`.
- `features/lib/https-git-host/server.ts` (`HttpsGitHost`, arms 404/500/502/503)
  and steps in `features/step_definitions/git-host.steps.ts` (`the git host
  answers {int} for the {git repository}`, `the git host receives no request`).

### Call-site map (from the discuss audit)
- Classifier sites: `marketplace/add.ts:347` (SourceAccess),
  `marketplace/update.ts:718,744,632`, `marketplace/shared.ts:411`
  (auth predicate), `import/execute.ts:1895`, `plugin/install.messaging.ts:258`,
  `plugin/install-cascade.messaging.ts:489`, `plugin/update-preflight.ts:527`,
  `reconcile/apply-outcomes.ts:771` (Host); `plugin/update-flow.ts:932`,
  `plugin/fetch.ts:584`, `plugin/info.ts:2152`,
  `plugin/dependency-tag-probe.ts:137` (Transport only). Other phases own
  `add.ts`, `import/execute.ts`, `install*.messaging.ts`, `apply-outcomes.ts`:
  only rename their classifier call to the new entry point.
- `reasonsFromTypedError`: `update-flow.ts:777-810`, caller
  `cascadeFailureOutcome` (:739); direct ladder `narrowDirectFailReason`
  (:922), fallback `unreadable manifest` (:957). Test pinning
  `not in manifest`: `test/orchestrators/plugin/update-flow.test.ts:4121`.
- GC sites: `uninstall.ts:1155`, `marketplace/remove.ts:1238`,
  `reconcile/apply.ts:1496` (from :1459), `update-swap.ts:1513` and
  `update-preflight.ts:815` (through the `cleanupClones` binding wired at
  `update-flow.ts:276,678,704`, `reinstall-flow.ts:414`),
  `dependency-bindings.ts:172`.
- Tag copy: `update-preflight.ts:474` -> `clone-cache.ts:887`.
- Fetch row: `fetch.ts:351` (lock :380-382, row :389); info `makeFetchProbe`
  :2119-2122, rows :2205-2215 (installed) and :2544-2600 (not installed).
- Intent mark: `update-swap.ts:641-734` (stamp :677, check :666-675),
  finalize stamp :995.
- Completion version: `edge-deps.ts:127-136` (`classifyInstalledPluginRow`),
  :164-185.
- Offline ref: `clone-cache.ts:525-541`, caller :498-506.

### Established Patterns
- Lock refusal tests: `lockfile.lock(locations.extensionRoot, { lockfilePath:
  locations.stateLockFile, realpath: false })` then run, release in `finally`
  (`fetch.test.ts:2325`, `update-preflight.test.ts:2459`).
- Lock-held-during-work: `lockfile.check` inside a seam
  (`with-state-guard.test.ts:124-154`).
- Hermetic home: `test/platform/hermetic-environment.ts`.

### Integration Points
- `docs/output-catalog.md`: update `update-host-failure`, the fetch and
  `info --fetch` failure states, and `dependency-tag-listing-failed` to match.

</code_context>

<specifics>
## Specific Ideas

- The audit found `fetch` reports a host 5xx as `source missing`: fix in
  D-PL7-02.
- `features/plugin/update-rollback.feature:8-30` setup, run through
  autoupdate, reproduces GLK-02's `{not in manifest}`.

</specifics>

<deferred>
## Deferred Ideas

- Candidate-clone window: update, reinstall, and converge create the
  candidate clone in preflight and record it only at finalize, so a locked GC
  from another process in that window can delete it. Options: record the
  candidate key in the intent mark, or hold one lock from copy to finalize.
- `previewInstall` (`install-outcome.ts:848`) reaches the tag copy and mirror
  refresh with no lock (`install-flow.ts:3331/3596`); install-outcome belongs
  to Phases 1 and 4.
- Unlocked deletes of `sources/<name>` (`marketplace/remove.ts:1234->1171`,
  `carried-marketplace-adds.ts:103`) and `seedSameRepoPluginMirrors`
  (`add.ts:780`) copying after the lock.
- Mirror refresh fetches no tags, so a mirror first cloned for another
  plugin's branch ref holds no `refs/tags/<ref>`; `tags: true` would fix it.
- Apply's converge row drops `outcome.cause` (`reconcile/notify.ts:458-471`).
- `shared/notification-types.ts` comment limiting `network error` to
  marketplace refresh and add needs widening (Phase 3 owns that file).

</deferred>

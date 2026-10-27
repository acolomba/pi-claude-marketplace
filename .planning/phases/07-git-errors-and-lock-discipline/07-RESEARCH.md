# Phase 7: Git Errors and Lock Discipline - Research

**Researched:** 2026-10-26
**Domain:** In-repo TypeScript refactor: git-failure classification, `proper-lockfile` scope-lock placement, record-stamp monotonicity, offline tag resolution (no new packages)
**Confidence:** HIGH (every claim below was read from the tree this session unless tagged otherwise)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Git host classification (GLK-01, GLK-02)

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

#### Lock discipline (GLK-03, GLK-04, GLK-05)

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

#### Intent mark (GLK-06)

- **D-PL7-08: strictly increasing intent stamp.** The intent mark and the
  finalize in `update-swap.ts` write
  `max(Date.now(), Date.parse(previous) + 1)` as ISO (now when `previous` does
  not parse). The mark reads and writes under the scope lock, so the stamp it
  writes always differs from the one a rival run read, and ST-9's
  `updatedAt` comparison catches the overlap. No schema field, no migration.
  Nothing displays `updatedAt`.

#### Version and offline tag (GLK-07, GLK-08)

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

#### Tests

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

### Claude's Discretion

- Exact helper names and module placement within the owned files.
- How the shared update ladder is factored inside `update-flow.ts`.

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GLK-01 | Every remote git access classifies a host's HTTP answer through one entry point with an explicit per-operation 404/410 rule (GITERR-01) | Call-site map (verified); `classifyGitFailure` skeleton; per-site migration table; frame sites; staged export removal |
| GLK-02 | The autoupdate cascade classifies an unclassified error as the direct update path does, not as `{not in manifest}` (CASCREASON-01) | Shared ladder shape for `update-flow.ts`; the one unit test that pins the old fallback; errno-arm cause-line gap (Pitfall 3) |
| GLK-03 | Clone cleanup runs under the state lock at every call site (CLONEGC-01) | All 9 GC sites verified outside any held lock; `collectPluginClonesLocked`; compile-time enforcement by making the unlocked GC private |
| GLK-04 | A marketplace-tag-pinned update copies the marketplace git data under a lock (TAGCOPY-01) | `update-preflight.ts:474` wrap point; no nesting; `pathPinProbe` seam for the test |
| GLK-05 | `fetch` and `info --fetch` read their result row inside the lock (FETCHROW-01) | Restructure points in `fetchOne` and the two info row builders; seams that observe the lock |
| GLK-06 | Two update intent marks in the same millisecond are told apart (INTENTMS-01) | Stamp math, both write sites, `t.mock.timers` Date pattern already used in `update-swap.test.ts` |
| GLK-07 | `fetch`, tab completion, and `browse` show the version `list` and `info` show (ENTRYVER-01) | `fetch` skipped AND fresh rows both need the list rule; completion's `upgradable`; browse verified |
| GLK-08 | A tag-ref reinstall with a warm mirror resolves the tag offline (LCORCH-01 b5) | isomorphic-git clone writes `refs/tags/<ref>` (verified in installed source); injection point in `clone-cache.ts` |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Read a file before editing it; trace callers before changing a function.
- NEVER commit to `main`; never rebase; never `--no-verify`. Commit per `.agents/skills/committing/SKILL.md`.
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`), `fallow` (dead code incl. test-only exports, health `maxCognitive 15` / `maxCyclomatic 20`, dupes on every clone group), Prettier, source/test pairing, unit, integration, cucumber, 100% direct coverage per source-test pair.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario under `features/` that fails without the change.
- Every test uses a hermetic home (`withHermeticEnvironment` / `createHermeticEnvironment` / `withHermeticHome`); a test must never touch the real `~/.pi/agent`.
- All output through `shared/notification-dispatch.ts`; no stdout/stderr; no new console calls.
- `proper-lockfile` is imported only by `transaction/with-state-guard.ts` (fallow rule `proper-lockfile-chokepoint`); tests may import it.
- `isomorphic-git` only in `platform/git.ts`; orchestrators reach git through `clone-cache.ts` and the other `NETWORK_SEAMS` (ESLint BLOCK F). `fetch.ts` and `info.ts` are NOT seams: they must not import `platform/git.ts`.
- NFR-5: warm reads stay offline; NFR-1 atomic writes; NFR-3 retry-safe; NFR-10 containment (every delete through `locations.pluginCloneDir`).
- Errors: typed classes in `shared/errors.ts`, narrowed by `instanceof`, never by message.
- Comments cite durable IDs (D-PL7-xx, GLK-xx), never phase/plan numbers.
- Unit-test rules (`.agents/skills/typescript-unit-tests`): `test()` cases, `// arrange / act / assert`, no test-only exports, no reset hooks, 100% direct coverage per pair, do not test what a gate already enforces.
- Upstream parity is the default; the recorded models (ADD-09/ADD-10, UPD-11, D-06) are the license for every divergence in this phase (CONTEXT `<upstream>`).
- Parallel-session constraint: touch only the functions this phase owns in shared files (see "Cross-phase edits" below).

## Summary

This phase is a pure in-repo refactor with no new dependency. Every site CONTEXT
named was re-read; the call-site map is accurate within a few lines, with three
corrections: two frame sites the map omitted (`marketplace/update.ts:504`,
`marketplace/add.ts:869`), the `not in manifest` pin at `update-flow.test.ts:4188`
(the test starts at 4120), and the ROADMAP Files line names a non-existent
`orchestrators/plugin/edge-deps.ts` (only `orchestrators/edge-deps.ts` exists).

The classifier swap cannot be done in one atomic plan without colliding with
the lock and version work, because three of the four plugin callers (`fetch`,
`info`, `update-flow`) change behavior when they move from the transport-only
layer to the host ladder. The safe shape is staged: add `classifyGitFailure`
and migrate the foreign callers first, migrate the plugin callers inside the
plans that already own those files, and delete the last two old exports in a
final plan. Every GC call site was confirmed to run outside any held lock, so
`collectPluginClonesLocked` never nests; making `garbageCollectPluginClones`
module-private afterward turns "every site uses the lock" into a compile-time
fact.

Four findings change what the planner must schedule beyond CONTEXT: (1) the
GLK-07 `fetch` scenario CONTEXT chose (a path plugin) exercises the
`skippedUpToDate` row, not `freshRow`, so the list version rule must cover the
skipped rows too; (2) the GLK-02 twin scenario is an errno (`EISDIR`) failure,
not the fallback arm, so `cascadeFailureOutcome` must attach the cause for the
errno arm as well or the twin's cause line will not match the direct row;
(3) switching completion to `resolveListCandidate` orphans
`git-source-probe.ts::probeUpgradeCandidate` (fallow fails on a test-only
export); (4) adding the `{status} on {url}` frame to update preflight changes
two rows of an existing outline in `features/plugin/git-source-update.feature`.

**Primary recommendation:** Run three waves: (1) classifier entry point plus
foreign callers, GC lock, intent stamp, offline tag, completion; (2) update
flow, update preflight, fetch, info, each owning its file and its scenario;
(3) delete the remaining old exports, privatize the unlocked GC, and update
docs prose.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Git failure classification | `shared/` (`git-failure-classifiers.ts`) | orchestrators pick the rule | Leaf, duck-typed, no git import (D-13) |
| Per-operation 404 rule choice | orchestrators (each call site) | — | The rule is an operation property (D-PL7-02) |
| `{status} on {url}` frame | `shared/` builds it | orchestrator wraps the cause | Only the site knows the URL |
| Scope lock | `transaction/with-state-guard.ts::withExistingScopeLock` | orchestrators decide placement | `proper-lockfile` chokepoint |
| Clone GC | `orchestrators/plugin/clone-gc.ts` | callers | fs-only, gated module |
| Intent stamp | `orchestrators/plugin/update-swap.ts` | — | ST-9 lives in the mark |
| Offline tag resolve | `orchestrators/plugin/clone-cache.ts` (seam) | `platform/git.ts::resolveTagOid` | Only seams may name git |
| Version rule | `orchestrators/plugin/list-candidate-version.ts` | fetch, edge-deps consume | VER-01/VER-02 single derivation |

## Standard Stack

No package is added. The phase uses what the tree already has.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `proper-lockfile` | 4.1.2 installed, `^4.1.2` declared [VERIFIED: node_modules/proper-lockfile/package.json, package.json:11] | per-scope lock via `withExistingScopeLock` | D-06 lock model; chokepoint-enforced |
| `isomorphic-git` | 1.43.1 installed, `^1.42.3` declared [VERIFIED: node_modules/isomorphic-git/package.json:3, package.json:10] | `resolveTagOid` (peels), clone writes tags | Only git engine; confined to `platform/git.ts` |
| `node:test` + `t.mock.timers` | Node v26.12.1 local [VERIFIED: `node --version`] | Date freezing for GLK-06 | Already used: `test/orchestrators/plugin/update-swap.test.ts` (`t.mock.timers.enable({ apis: ["Date"], now: ... })` in `seedUserEditedAgentUpdate`) |
| `@cucumber/cucumber` | `^13.3.0` [VERIFIED: package.json:18] | behavioral scenarios | Project policy |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. Nothing to audit.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Call-Site Map (verified against the tree, 2026-10-26)

### Classifier imports (every production caller)

Old exports today [VERIFIED: shared/git-failure-classifiers.ts:65-67, 98, 119, 143-150, 176-183]:
`classifyGitTransportFailure`, `hostHttpStatus`, `hostHttpFailureFrame`, `classifyGitHostFailure`, `classifyGitSourceAccessFailure`.
Reason union returned by the host layer, verbatim (lines 146-150):
`| "network unreachable" | "authentication required" | "source missing" | "network error" | undefined`.

| Site (file:line) | Owner phase(s) | Old call | New call (recommended) | Behavior change? |
|---|---|---|---|---|
| `marketplace/add.ts:347` (`errorAddReason`) | 5 (classification), 2 | `classifyGitSourceAccessFailure(err)` | `classifyGitFailure(err, { notFound: "source missing", missingRef: "source missing" })?.reason` | No |
| `marketplace/add.ts:869` (`hostErrorFrame`) — **missing from CONTEXT map** | 5, 2 | `hostHttpFailureFrame(unwrapAddError(err), networkCloneUrl(source))` | `classifyGitFailure(unwrapAddError(err), <add rule>, networkCloneUrl(source))?.frame` (line 870's `reason === "network error"` gate stays) | No |
| `marketplace/update.ts:504` (`refreshFailureMessage`) — **missing from CONTEXT map** | 7 (classification) | `hostHttpFailureFrame(err, remoteUrl)` | `classifyGitFailure(err, { notFound: "network error" }, remoteUrl)?.frame` | No |
| `marketplace/update.ts:718` (`transportReason`) | 7 | `classifyGitTransportFailure(bearer)` | `classifyGitFailure(bearer, { notFound: "network error" })?.reason` | Classifies HTTP here now |
| `marketplace/update.ts:744` (`refreshFailureReasons`) | 7 | `hostHttpStatus(err.cause) === undefined ? [] : ["network error"]` | `return [];` — the HTTP case is now classified at :718 via `reasonsFromCascadeError` (:632), so the `["network error"]` branch would be unreachable and fail 100% branch coverage | No (net) |
| `marketplace/shared.ts:411` (`lacksStoredCredential`) | 7 (classification) | `classifyGitTransportFailure(err) === "authentication required"` | `classifyGitFailure(err, { notFound: "source missing" })?.reason === "authentication required"` (auth is rule-independent) | No |
| `import/execute.ts:1895` (`runtimeFailureReason`) | 6 | `classifyGitHostFailure(error)` | `classifyGitFailure(error, { notFound: "source missing" })?.reason` | No |
| `plugin/install.messaging.ts:258` | 1 | `classifyGitHostFailure(err)` | same as import | No |
| `plugin/install-cascade.messaging.ts:489` | 3 | `classifyGitHostFailure(subject.error)` | same | No |
| `reconcile/apply-outcomes.ts:771` | 1 | `classifyGitHostFailure(err) ?? narrowProbeError(...)` | `classifyGitFailure(err, { notFound: "source missing" })?.reason ?? narrowProbeError(...)` | No |
| `plugin/update-preflight.ts:527` (`candidateFailure`) | 7 | `classifyGitHostFailure(error)` | `classifyGitFailure(error, { notFound: "source missing" }, remoteUrl)` + frame | Frame added (D-PL7-03) |
| `plugin/update-flow.ts:932` (`narrowDirectFailReason`) | 7 | `classifyGitTransportFailure(primary)` | shared ladder, plugin-clone rule | Yes (GLK-01/02) |
| `plugin/fetch.ts:584` (`narrowFetchFailure`) | 7 | `classifyGitTransportFailure(err)` | plugin-clone rule + frame | Yes (5xx fix) |
| `plugin/info.ts:2152` (`foldFetchOrProbeError`) | 7 (fetch path) | `classifyGitTransportFailure(err) ?? narrowProbeError(err)` | `classifyGitFailure(err, { notFound: "source missing" })?.reason ?? narrowProbeError(err)` | Yes (404 `unreadable` -> `source missing`) |
| `plugin/dependency-tag-probe.ts:51,137` | 4, 7 (classification) | `ReturnType<typeof classifyGitTransportFailure>`; `classifyGitTransportFailure(err)` | widen type to the 4 host reasons or `undefined`; `classifyGitFailure(err, { notFound: "source missing" })?.reason` | Yes (404/5xx now classified) |

Consumers of the widened `DependencyTagListingFailureReason` need no edit; they
compile with the wider union [VERIFIED: install-cascade.messaging.ts:412-414
`reasons: [failure.classification ?? "unreadable"]`; update-constraint-gate.ts:145
passes it to `transportHeld(holders, classification: string)` at constraint-fold.ts:286-290;
install-cascade.ts:257,818 type-only].

Tests that import the old names: only `test/shared/git-failure-classifiers.test.ts`
(lines 11-16) [VERIFIED: grep over test/, features/, scripts/, docs/].

### GC call sites (all verified outside any held lock)

| Site | Caller context | Lock held at call? |
|---|---|---|
| `uninstall.ts:1155` in `runPostUninstallCleanup` (:1110) | after `transaction.withLockedStateTransaction` returns (:1397 ... ), called at :1581 and from `finalizePrunedMembers` (:1020) | No. `prune.ts:354` calls `finalizeCommittedMembers` after its lock closure (:283-347) [VERIFIED] |
| `marketplace/remove.ts:1238` in `runPostRemoveCleanup` (:1204) | called at :1364 after `withLockedStateTransaction` (:1335) | No |
| `reconcile/apply.ts:1496` in `collectClones` (:1493), from `runStep` :1459 | each step's operations take their own locks | No |
| `update-swap.ts:1513` via `args.cleanupClones` | after `finalizeUpdateRecord`'s `withStateGuard` (:957) | No |
| `update-preflight.ts:815` via `options.cleanupClones` | after `refreshDisabledRecord`'s `withLockedStateTransaction` (:749) | No |
| bindings `update-flow.ts:276, 678, 704`; `reinstall-flow.ts:414` | wiring only | n/a |
| `dependency-bindings.ts:172` sweep from `planCloneSweep` (:161) | invoked from `install-flow.ts:3574` `finally` after `installPluginWithTransaction` returns, and `dependency-settle.ts:220-225` between preflight and swap (`materialize-latest.ts:84`) | No |

Every site already wraps GC in `try/catch` + `hookDebugLog` (D-19-01), so a
`StateLockHeldError` from the locked GC is swallowed with no edit to those
catches.

### Other verified anchors

- Tag copy: `update-preflight.ts:474` (`(options.pathPinProbe ?? materializeMarketplaceTagClone)({...})`) inside `resolvePathPluginRoot`, inside `resolveUpdateCandidate`'s `try`; its catch already rethrows `StateLockHeldError` (:502-504). `materializeMarketplaceTagClone` is `clone-cache.ts:887` and takes no lock itself.
- Fetch: `fetchOne` :351; lock ternary :380-382; row :389 (`freshRow`); `skippedUpToDate` :450 (called at :360 and :372); `failedRow` :557; `narrowFetchFailure` :579.
- Info: `makeFetchProbe` :2088, lock :2119-2122; installed row probe :2202-2206, row build :2207-2222 (`buildInstalledGitRow` :2170); not-installed probe :2539-2544, row build :2565-2622 (`buildGitNotInstalledRow` :2510).
- Intent mark: `markUpdateInProgress` :641; ST-9 check :666-673; stamp :677; finalize stamp :995.
- Completion: `classifyInstalledPluginRow` :120, `upgradable` :127-136; `classifyNotInstalledPluginRow` :164, entry version :183.
- Offline ref: `resolveFetchedRefOffline` :525-541; caller :498-506.
- `not in manifest` pin: `test/orchestrators/plugin/update-flow.test.ts:4188` (`assert.deepEqual(outcome.reasons, ["not in manifest"]);`, test "prepare-handles-fail: MCP collision ..." starting :4120).

## Architecture Patterns

### Data flow after the change

```
remote git access (clone/fetch/listRemoteTags)
        │ throws
        ▼
call site picks rule ──► classifyGitFailure(err, rule, remoteUrl?)
        │                   unwrap leak → pinned-missing → auth → errno
        │                   → HTTP 404/410 → rule.notFound → other HTTP → network error
        │                   → NotFoundError → rule.missingRef
        ▼
{ reason, frame? } ──► row reason; cause = frame ? new Error(frame, { cause: err }) : err
                              │
                              ▼  shared/errors.ts:192 redacts credentials in every cause link

lifecycle op: lock(op) → mutate+save → release ─► collectPluginClonesLocked
                                                     lock(scope) → loadState(persistMigration:false)
                                                     → rm unreferenced → release
                                                     held? → StateLockHeldError → swallowed at site
fetch/info --fetch (unpinned): lock(scope) { materialize → read row } release
update preflight (path tag pin): lock(scope) { materializeMarketplaceTagClone } release
```

### Pattern 1: the single entry point (D-PL7-01)

```typescript
// shared/git-failure-classifiers.ts -- values below are the verbatim constants
// already in the file: SOURCE_MISSING_HTTP_STATUSES = new Set([404, 410]) (:26),
// NETWORK_ERRNO_CODES (:28-35) "ENETUNREACH","ECONNREFUSED","ENOTFOUND",
// "ETIMEDOUT","ECONNRESET","EAI_AGAIN".
type GitFailureReason =
  "network unreachable" | "authentication required" | "source missing" | "network error";

export function classifyGitFailure(
  thrown: unknown,
  rule: { readonly notFound: "source missing" | "network error"; readonly missingRef?: "source missing" },
  remoteUrl?: string,
): { readonly reason: GitFailureReason; readonly frame?: string } | undefined {
  const error = withoutCleanupLeaks(thrown);
  if (error instanceof PinnedCommitMissingError) return { reason: "source missing" };
  const transport = transportReason(error);          // existing private body, renamed
  if (transport !== undefined) return { reason: transport };
  const status = httpStatus(error);                  // existing hostHttpStatus body, private
  if (status !== undefined) {
    const reason = SOURCE_MISSING_HTTP_STATUSES.has(status) ? rule.notFound : "network error";
    return remoteUrl === undefined
      ? { reason }
      : { reason, frame: `${status} on ${gitHubWireUrl(remoteUrl)}` };
  }
  return isRemoteNotFound(error) && rule.missingRef !== undefined ? { reason: rule.missingRef } : undefined;
}
```

Notes for the planner:
- "frame set when an HTTP status was classified" must mean a non-auth status: 401/403 return from the auth arm first, exactly as `hostHttpStatus` excludes them today (:105). Keep it so; marketplace add/update output stays byte-identical.
- The old `classifyGitSourceAccessFailure` checks `NotFoundError` FIRST (:184); moving it last is safe because a `NotFoundError` carries `code: "NotFoundError"`, which no transport, errno, or HTTP arm matches.
- The `{ notFound: ... }` literals can stay inline at each call site; exporting rule constants adds exports for no gain. Export the `GitFailureReason` type only if `dependency-tag-probe.ts` names it (a production consumer, so fallow will not flag it).
- Thin named wrappers (`classifyGitHostFailure = e => classifyGitFailure(e, ...)?.reason`) would spare the five foreign files, and fallow would not flag them (production callers). But D-PL7-01 locks "one export ... make the old helpers module-private or delete them", so wrappers are not an option; the foreign edits are two lines each (import + call).

### Pattern 2: shared update ladder (D-PL7-04, Claude's discretion on factoring)

One module-private function in `update-flow.ts`, used by both paths:

```
narrowUpdateFailReason(err: unknown): ContentReason
  primary = err instanceof CleanupContextError ? err.primary : err
  1. typed (union of today's two typed sets):
     StateLockHeldError → "lock held"; MarketplaceNotFoundError → "not found";
     PluginUpdatePhase3Error → "rollback partial";
     PluginUpdateConcurrencyError → kind "plugin-updated" ? "concurrently updated" : "concurrently uninstalled";
     InvalidMarketplaceManifestError → "invalid manifest";
     PluginInLocalLayerOnlyError / PluginInBaseLayerOnlyError → their tokens;
     DependencyDeclarationsUnreadableError → "unreadable";
     [sync wrapper, see below] → classifyGitFailure(cause, { notFound: "network error" })
  2. classifyGitFailure(primary, { notFound: "source missing" })?.reason
  3. errno via cascadeErrno (unwraps BridgeStagingError): EACCES/EPERM → "permission denied";
     ENOENT/ENOTDIR → "source missing"; EISDIR/EIO/EBADF → "unreadable"
  4. "unreadable manifest"
```

- `cascadeFailureOutcome` returns `reasons: [narrowUpdateFailReason(err)]`; `notifyDirectFailure` and `notifyBareFormEnumerateFailure` call the same function.
- Direct-path side effects of sharing: `BridgeStagingError` gains its errno reason on the direct path (was `unreadable manifest`); the cascade gains `not found`, `invalid manifest`, `rollback partial`, layer tokens and `EISDIR/EIO/EBADF → unreadable`. Both are what GLK-02 asks for.
- Only test that pins the old cascade fallback: `update-flow.test.ts:4188` (MCP collision → becomes `unreadable manifest`, with cause).
- `PluginShapeError` is not thrown past preflight in the update runner (`requireInstallable` runs inside `resolveUpdateCandidate`'s try, `update-preflight.ts:491-505`), so no `not-in-manifest` arm is needed. The real `{not in manifest}` rows come from preflight's static rows (`update-preflight.ts:1047-1053`, `triageUpdateMembership`) and stay.

**Sync-refresh rule and frame (D-PL7-02/03).** `makeSyncCloneOnce` (:171) throws the raw git error, and its catch at `updatePluginsWith` (:361-389) has no URL. Recommended: inside `makeSyncCloneOnce`, compute `remoteUrl = networkCloneUrl(source)` for github/url (as `marketplace/update.ts:415-416` does) and, when `classifyGitFailure(err, { notFound: "network error" }, remoteUrl)` yields a frame, rethrow `new MarketplaceUpdateError(frame, { cause: err })` (existing class, `shared/errors.ts:542-549`; this mirrors how `marketplace update` frames). Leave every other throw raw, so the existing `syncClone-fail` unit tests (401 at `update-flow.test.ts:1651`, errno table at :3900-3990) keep their exact bytes. The ladder's typed arm then maps `MarketplaceUpdateError` → `classifyGitFailure(err.cause, { notFound: "network error" })?.reason`. The cause line becomes `503 on https://{git host}/acme/tools.git, HTTP Error: 503 Service Unavailable`, identical to `features/marketplace/url-source-update.feature:19`. `update-flow.ts` is a `NETWORK_SEAMS` member, so importing `networkCloneUrl` from `domain/clone-key.ts` is legal.

### Pattern 3: locked GC (D-PL7-05)

```typescript
// clone-gc.ts
export function collectPluginClonesLocked(
  locations: ScopedLocations,
  keep?: ReadonlySet<string>,
): Promise<string[]> {
  return withExistingScopeLock(locations, () => garbageCollectPluginClones(locations, keep));
}
// garbageCollectPluginClones: loadState(locations.extensionRoot, { persistMigration: false })
```

- `loadState` accepts `{ persistMigration?: boolean }` [VERIFIED: persistence/state-io.ts:402-405; the fire-and-forget write is gated at :503-505].
- `withExistingScopeLock` creates no directory; on a missing extension root the acquisition rejects with a non-`StateLockHeldError`. Every site swallows any GC throw, so this is safe.
- clone-gc.ts gains an import of `transaction/with-state-guard.ts`; the `orchestrators` zone already imports `transaction` (uninstall.ts:91, fetch.ts:52).
- Wave 3: make `garbageCollectPluginClones` module-private once `update-flow.ts` and `reinstall-flow.ts` bind `collectPluginClonesLocked`. Then no site can call the unlocked GC, and `test/orchestrators/plugin/clone-gc.test.ts`'s `describe("garbageCollectPluginClones")` (:96) moves to the locked entry point.
- `listUnreferencedPluginClones` (`planCloneSweep`'s "before" read, `clone-gc.ts:87`) still reads with no lock. A clone added by a locked `fetch` between that read and the sweep would be deleted. Not named by D-PL7-05; wrapping it the same way is cheap. Open question 2.

### Pattern 4: locked row read (D-PL7-07)

- `fetchOne`: build one body `() => materializeThroughSeam(...).then(() => freshRow(...))` and run it under `withExistingScopeLock` when `gitSource.sha === undefined`, else plain. `freshRow`/`reasonedRow` only use `status.*` and `resolveStrict` with the fs presence probe: no lock inside, no nesting.
- `info.ts`: move the lock out of `makeFetchProbe` (:2119-2122) into each row builder, so the probe AND the row build share one body. In `buildGitNotInstalledRow`, keep the inner row-build `try/catch` (:2565-2622, folds to `narrowProbeError`) inside the locked body, so only probe and lock errors reach the outer catch (:2545-2563, `lockHeldRow` / `foldFetchOrProbeError`). Bare `info` (no `fetchCtx`) never locks. A small local helper `runFetchLocked(locations, fetchCtx, gitSource, body)` keeps both builders under the cognitive ceiling.

### Pattern 5: tag copy lock (D-PL7-06)

Wrap only the call at `update-preflight.ts:474`:
`withExistingScopeLock(options.locations, () => (options.pathPinProbe ?? materializeMarketplaceTagClone)({...}))`.
No nesting: `resolvePathPluginRoot` is only reached for a `path` source, which never reaches `probeUnpinned` (the other lock holder). A held lock throws `StateLockHeldError`, which the catch already rethrows (:502-504): the direct path renders `lock held` (`typedDirectFailReason`), the cascade renders `lock held` (`reasonsFromTypedError`).

### Pattern 6: intent stamp (D-PL7-08)

```typescript
function nextUpdateStamp(previous: string): string {
  const prior = Date.parse(previous);
  const now = Date.now();
  return new Date(Number.isNaN(prior) ? now : Math.max(now, prior + 1)).toISOString();
}
// :677  sRecord.updatedAt = nextUpdateStamp(sRecord.updatedAt);
// :995  sRecord.updatedAt = nextUpdateStamp(sRecord.updatedAt);
```

Why both sites: with A's mark at T1, a run B that read T1 during A's window
compares at its own mark against A's finalize stamp. If finalize wrote T1 again
(same ms) on a same-revision run (reinstall, where version and sha do not move),
B's ST-9 check would pass. Other `updatedAt` writers (`update-preflight.ts:790`,
`enable-disable.ts:1731`, `install-disable-cascade.ts:111`,
`reconcile/mcp-migration.ts:553`) are out of scope; a non-update writer in the
same ms between a preflight read and a mark is a residual (Assumption A4).
Nothing reads `updatedAt` except ST-9 [VERIFIED: grep `.updatedAt` reads: only
update-swap.ts:669].

### Pattern 7: offline tag resolve (D-PL7-10)

- isomorphic-git `clone` defaults `tags: !noTags` = true [VERIFIED: node_modules/isomorphic-git/index.cjs:10878], and with `singleBranch` the fetched ref itself is written to `refs/tags/<tag>` when it is a tag (`tagRefsToWrite`, :2215-2220). The refspec `+refs/heads/*:refs/remotes/origin/*` never translates a tag, so `refs/remotes/origin/<tag>` is never written (:2186-2193). `platform/git.ts::clone` passes no `noTags` (:449-460). So a mirror cloned for a tag ref holds `refs/tags/<ref>` and no tracking ref, which is exactly why today's reinstall goes to the network.
- `refreshGitHubClone` also misses the tracking ref for a tag and checks the stored ref out detached (`marketplace/shared.ts:296-321`), so the refresh does not fix it either.
- Real `resolveTagOid` throws on a missing tag (`git.resolveRef` at `platform/git.ts:702`) and returns `undefined` for a non-commit target. Treat both as a miss (catch `isGitNotFoundError`, `clone-cache.ts:76-78`), then refresh.
- Injection point: add `resolveTagOid?: typeof resolveTagOid` to `materializeOrRefreshPluginMirror`'s `args` beside `gitOps?`, defaulted at use, and thread it to `resolveFetchedRefOffline`. `materializeUnpinnedSource` (:367) passes nothing, so production uses the real one. `clone-cache.ts` is a `NETWORK_SEAMS` member and may import `platform/git.ts`.
- Tension: the unit-test skill says "do not default a parameter to a live boundary"; the same function already defaults `gitOps ?? DEFAULT_GIT_OPS` (:449), and D-PL7-10 locks the default-injection shape. Follow the precedent.

### Pattern 8: version rule for fetch and completion (D-PL7-09)

- **fetch has two row kinds that print a version.** `skippedUpToDate(entry)` (:450, for path sources at :360 and pinned-warm at :372) and `freshRow` (:466). Both use `entryMeta(entry)` (:438). CONTEXT's chosen GLK-07 scenario is a path plugin, which hits `skippedUpToDate`, so the list rule must cover the skipped rows too, not only the fresh row.
- Recommended: change the `FetchStatus` member `probeManifestEntry` to `resolveListCandidate: typeof resolveListCandidate`, and derive both the fresh row (status from `resolved.state`, version `outcome.version ?? entry.version`, `cold` → `remote` with the entry version) and the skipped rows' version from it. A `resolveListCandidate` throw on a skipped row keeps the entry version (list's `probeFailureRow` parity). This forces a one-line edit in `orchestrators/plugin/operations.ts:188` (`NODE_FETCH_STATUS`, owned by no phase) and `test/orchestrators/plugin/fetch.test.ts:70`. `probeManifestEntry` stays exported (edge-deps uses it).
- **Completion.** Completions never display `PluginIndexRow.version`: it is only serialized to the cache file (`shared/completion-cache.ts:296-300`); `edge/completions/*` never reads it [VERIFIED: grep]. What a user sees is `upgradable` (whether `update` offers the plugin). List's rule is `list-installed-row.ts::upgradeCandidate` (:87-104, private) plus `catalogVersion` (:73-77). Options:
  1. (Recommended) Extract the body to a new exported function in a new Phase-7-owned module (for example `orchestrators/plugin/upgrade-candidate.ts` plus its paired test) and make `list-installed-row.ts::upgradeCandidate` delegate. One function body moves out of a Phase 3 file; coordinate, because Phase 3 (CAS-04, "git-source upgrade state") may change the same rule.
  2. Duplicate the 10-line rule in `edge-deps.ts`. Likely trips `fallow dupes` (fails on every clone group).
  3. Defer the completion half until Phase 3 merges.
- **Orphan:** once edge-deps uses the candidate's own `resolved`, `git-source-probe.ts::probeUpgradeCandidate` (:313) has no production caller, and fallow fails on a test-only export. Delete it and its `describe("probeUpgradeCandidate")` block (`test/orchestrators/plugin/git-source-probe.test.ts:749-885`). `git-source-probe.ts` is in no phase's Files line.
- **browse:** verify only. `edge/handlers/plugin/browse.ts:22,86` calls `loadPluginListPayload` [VERIFIED], and `plugin-browser.ts:376` prints `p.version` from that payload.

### Anti-Patterns to Avoid

- **GC inside `withStateGuard`:** the guard saves after the closure; GC would read the old `resolvedSource` and delete the new clone (D-PL7-05).
- **Locking the whole preflight:** nests with `probeUnpinned` (:333) and `refreshDisabledRecord` (:749); `proper-lockfile` with `retries: 0` self-deadlocks to `StateLockHeldError`.
- **Locking `fetch`'s pinned arm:** adds a user-visible `lock held` (D-PL7-07).
- **A new `GitOps` member for tags:** touches the fake, its contract, and the hand-built GitOps objects (D-PL7-10).
- **Leaving the old `["network error"]` branch at `marketplace/update.ts:744`:** unreachable after the swap; fails direct branch coverage.
- **Adding new `catalog-state` blocks to `docs/output-catalog.md`:** `test/architecture/catalog-uat/catalog-contract.test.ts:21-22` pins `EXPECTED_STATE_COUNT = 323` and `EXPECTED_UTF8_BYTES = 54_039`, and each state needs a fixture. Phase 3 is also adding states, so those constants become a merge conflict. Edit prose outside the example blocks instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scope lock | a new lock helper | `withExistingScopeLock` (`with-state-guard.ts:147`) | maps `ELOCKED` → `StateLockHeldError`, handles compromise |
| Tag peel | `gitOps.resolveRef("refs/tags/x")` | `platform/git.ts::resolveTagOid` | an annotated tag's ref names the tag object, not the commit |
| Status frame | per-site string building | `classifyGitFailure(..., remoteUrl).frame` | applies `gitHubWireUrl` (override) once |
| Cause frame | a new error class | `new Error(frame, { cause })` (add.ts:825 precedent) or `MarketplaceUpdateError` | the cause-chain renderer already walks `cause` |
| Credential redaction in frames | anything | nothing: `shared/errors.ts:192` redacts every cause link | already covers frames |
| Version rule | entry-version reads | `resolveListCandidate` | VER-01/02 one derivation |
| Date freezing | a clock seam in update-swap | `t.mock.timers.enable({ apis: ["Date"], now })` | already used in `update-swap.test.ts` |

## Runtime State Inventory

This is a refactor of code paths, not a rename. For completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` `updatedAt` values; new stamps are ISO strings of the same schema (`persistence/state-io.ts:163` `updatedAt: Type.String()`) | none; no migration (D-PL7-08) |
| Live service config | none — verified: no external service carries the classifier tokens | none |
| OS-registered state | none | none |
| Secrets/env vars | none renamed; `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` still read through `gitHubWireUrl` | none |
| Build artifacts | none; no build step (Node strips TS) | none |

## Common Pitfalls

### Pitfall 1: The path-plugin GLK-07 scenario passes only if skipped rows use the list rule
**What goes wrong:** `freshRow` is fixed but `fetch demo@fixtures` (path source) still prints the entry version, because path sources return `skippedUpToDate` before `freshRow` (`fetch.ts:358-361`).
**How to avoid:** Derive the skipped row's version through `resolveListCandidate` too.
**Warning signs:** The new scenario fails with `version 1.0.0` while a git-source fetch shows the right version.

### Pitfall 2: Staged export removal
**What goes wrong:** Deleting `classifyGitTransportFailure`/`classifyGitHostFailure` in the first plan forces behavior changes in `fetch.ts`, `info.ts`, `update-flow.ts`, `update-preflight.ts` in that plan, so it collides with every wave-2 plan.
**How to avoid:** Wave 1 deletes only the three exports with no remaining production caller (`hostHttpStatus`, `hostHttpFailureFrame`, `classifyGitSourceAccessFailure`; fallow would fail otherwise); wave 3 deletes the last two.
**Warning signs:** `fallow dead-code` "unused export" after a wave-1 commit.

### Pitfall 3: The GLK-02 twin needs a cause on the errno arm
**What goes wrong:** D-PL7-04 says `cascadeFailureOutcome` attaches `cause` "for the fallback arm". The twin of `update-rollback.feature`'s first scenario fails on a directory in place of `mcp-adapter.json` (`EISDIR`), which is the errno arm, not the fallback. The reason becomes `unreadable` (correct), but with no cause the cascade row lacks the `{mcp-adapter.json read error}` cause chain the direct row shows (`update-rollback.feature:27-29`).
**How to avoid:** Attach `cause` for the git (non-auth), errno, and fallback arms of the shared ladder. Today's cascade rows for typed errors (lock held, deps unreadable, cleanup failures) already carry it (`update-flow.ts:748-760`). Confirm with the user (Open Question 1).
**Warning signs:** The scenario's `cause chain` column comes back empty.

### Pitfall 4: Preflight frame rewrites existing scenario rows
**What goes wrong:** Adding `{status} on {url}` to preflight failure causes changes `features/plugin/git-source-update.feature:311` and `:313` (404 and 503 rows) to `404 on https://{git host}/acme/ghp.git, HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git`. The trailing `fetched …` frame comes from `FetchedUrlCause` under the GitHub override (`shared/errors.ts:617-623`, attached by `platform/git.ts:448`), so github-kind rows show the URL twice.
**How to avoid:** Update those rows in the preflight plan; use a url-kind plugin (`urlp`) in the new fetch 503 scenario to avoid the doubled URL. Unit pins in `update-preflight.test.ts` that assert an HTTP cause must be updated too.

### Pitfall 5: fetch 404 rows and the frame
**What goes wrong:** D-PL7-01 sets the frame for any classified HTTP status; `marketplace add` shows it only on `network error` rows (add.ts:870). If `fetch` frames its 404 `source missing` row, `features/plugin/fetch.feature:154` changes.
**How to avoid:** Decide (Open Question 3). Recommended: frame every HTTP-classified fetch row (D-PL7-03 says "wherever the row has a cause slot"), and update :154.

### Pitfall 6: Orphaned `probeUpgradeCandidate`
See Pattern 8. fallow fails the commit if it stays exported with only test callers.

### Pitfall 7: "wait for" means "refuse while held"
**What goes wrong:** ROADMAP success criterion 2 says cleanup, tag copy, and row read "wait for" a second holder. The lock is `retries: 0` (`with-state-guard.ts:211`), so nothing waits: GC skips (swallowed), the tag copy and the row read fail `lock held`.
**How to avoid:** Write tests that prove "does not run while another holder has the lock" and "holds the lock while it runs", and say so in the plan's must-haves.

### Pitfall 8: Cross-phase function collisions
`marketplace/add.ts::errorAddReason` (:337-348) is the function Phase 5's MKT-07 ("classifies a crash apart from a malformed manifest ... maps EISDIR") will rewrite. Land the 1-line rename early and tell Phase 5, or let Phase 5 adopt `classifyGitFailure` in its merge. `info.ts`'s two row builders are where Phase 3's "row status only" edits may also land.

## Cross-phase edits forced by the decisions (smallest edit each)

| File | Owner(s) | Why | Smallest edit |
|---|---|---|---|
| `orchestrators/marketplace/add.ts` | 5, 2 | old exports removed | import line + :347 + :869 (3 lines) |
| `orchestrators/import/execute.ts` | 6 | same | import + :1895 |
| `orchestrators/plugin/install.messaging.ts` | 1 | same | import + :258 |
| `orchestrators/plugin/install-cascade.messaging.ts` | 3 | same | import + :489 |
| `orchestrators/reconcile/apply-outcomes.ts` | 1 | same | import + :771 |
| `orchestrators/plugin/operations.ts` | none | `FetchStatus` member changes (Pattern 8) | :188 one line |
| `orchestrators/plugin/git-source-probe.ts` (+ test) | none | `probeUpgradeCandidate` orphaned | delete :302-327 and test :749-885 |
| `orchestrators/plugin/list-installed-row.ts` | 3 | shared upgrade rule (option 1) | `upgradeCandidate` delegates |
| `docs/output-catalog.md` | 3 (new states), 11 (docs/**) | outputs change | prose only: `bulk-mixed` (2445), `update-host-failure` (2351, add plugin update's marketplace refresh and the frame), `dependency-tag-listing-failed` (1052: widen reasons), the `info --fetch` failure prose |
| `features/plugin/{fetch,info,update,update-rollback,git-source-update}.feature` | 10 (after 1-9), 6 (`import.feature` only) | policy requires scenarios | add scenarios; edit `git-source-update.feature:311,313` and possibly `fetch.feature:154` |
| `shared/notification-types.ts` | 3 | comment limits `network error` | deferred per CONTEXT |
| ROADMAP Files typo `orchestrators/plugin/edge-deps.ts` | — | file does not exist | note only |

## Code Examples

### Lock-refusal test (existing pattern)

```typescript
// Source: test/orchestrators/plugin/fetch.test.ts:2325-2366
const release = await lockfile.lock(locations.extensionRoot, {
  lockfilePath: locations.stateLockFile,
  realpath: false,
});
try {
  await fetchPlugins({ /* ... */ });
} finally {
  await release();
}
```

### Lock-held-during-work assertion (existing pattern)

```typescript
// Source: test/transaction/with-state-guard.test.ts:124-131
lockObservations.push(
  await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  }),
);
```

Where each GLK-03..05 test observes the lock:

| Req | Seam that runs during the locked work | Second-holder test |
|---|---|---|
| GLK-03 | none inside GC; prove it in `clone-gc.test.ts` on `collectPluginClonesLocked` (rejects `StateLockHeldError`, unreferenced dir survives; free run deletes it and `lockfile.check` is false afterwards). Site level, where cheap: `runPostUninstallCleanup` calls the injected `completionCache.dropMarketplaceCache` BEFORE GC (uninstall.ts:1118-1122), and `runPostRemoveCleanup` calls `completionCache.invalidateMarketplaceNames` first (remove.ts:1218-1219): a completion-cache double that takes the lock makes the GC skip deterministically | holder via the completion-cache double; assert the clone dir survives and the command still succeeds |
| GLK-04 | `pathPinProbe` option (`update-preflight.ts:210`): a probe that asserts `lockfile.check` is true | holder via `lockfile.lock`; `preparePluginUpdate` rejects `StateLockHeldError`, probe never called (pattern at `update-preflight.test.ts:2459-2490`) |
| GLK-05 fetch | `FetchStatus` member (`resolveListCandidate` after Pattern 8) asserting `lockfile.check` true for an unpinned source | existing GIT-03 test covers refusal (`fetch.test.ts:2325`) |
| GLK-05 info | `PluginInfoReader.readTextFile` (`info.ts:193-198`, injected via `createGetPluginInfo`) asserting `lockfile.check` true during the row read | existing lock-held row test |

### Same-millisecond mark (GLK-06)

```typescript
// Pattern: test/orchestrators/plugin/update-swap.test.ts:362-424 (ST-9 overlap)
// plus Date freezing as in seedUserEditedAgentUpdate (same file).
// The seed writes updatedAt "2026-01-01T00:00:00.000Z" (update-flow.test.ts:467/512).
t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-01T00:00:00.000Z") });
// two preparePluginUpdate() reads, first swap marks then fails finalize,
// second swap must reject PluginUpdateConcurrencyError { kind: "plugin-updated", lifecycle: "intent" }
```
Without the fix the first mark writes the same instant the second run read, and the second swap passes.

## Cucumber scenarios (one per user-visible change)

All steps below exist [VERIFIED: features/step_definitions/git-host.steps.ts:65-153; command.steps.ts:55,62,92,138; marketplace/publishing.steps.ts:128; plugin/git-source.steps.ts:56,104; plugin/publishing.steps.ts:63,75; scope-state.steps.ts:16]. No new step is needed.

| # | Req | Feature file | Setup steps (existing) | Fails today because |
|---|---|---|---|---|
| S1 | GLK-01 | `features/plugin/fetch.feature` | `the git repository "urlp" holds these plugins:`; marketplace dir source; `offers these plugins from git repositories:` (`urlp`, `url`, unpinned); added to project; `the git host answers 503 for the plugin "urlp"`; `When the user runs "/claude:plugin fetch urlp@gits --scope project"` | row reads `{source missing}` with cause `HTTP Error: 503 Service Unavailable`; after: `{network error}`, `503 on https://{git host}/acme/urlp.git, HTTP Error: 503 Service Unavailable` |
| S2 | GLK-01 | `features/plugin/info.feature` | `ghp` github unpinned, not installed; `the git host answers 404 for the plugin "ghp"`; `When the user runs "/claude:plugin info ghp@gits --fetch"` | `plugin reasons` is `unreadable` (`narrowProbeError` fallback, `probe-classifiers.ts:65`); after: `source missing` |
| S3 | GLK-01 | `features/plugin/update.feature` (or a new url-marketplace plugin-update file per `cucumber/rules/layout.md`) | `the marketplace "tools" is published as a url source`; `offers these plugins:`; added; `the user has run "/claude:plugin install demo@tools --scope project"`; `the git host answers 503 for the marketplace "tools"`; `When the user runs "/claude:plugin update demo@tools --scope project"` | row `tools (failed) {unreadable manifest}` (`narrowErrnoFailReason` default); after `{network error}` with the marketplace-update frame |
| S4 | GLK-02 | `features/plugin/update-rollback.feature` (uses its Background) | `the user has run "/claude:plugin marketplace autoupdate fixtures --scope project"`; `When the user runs "/claude:plugin marketplace update fixtures --scope project"`; `Then the results list these marketplaces and plugins:` | cascade row reads `{not in manifest}` and no cause; after `{unreadable}` + `{mcp-adapter.json read error}` (needs Pitfall 3) |
| S5 | GLK-07 | `features/plugin/fetch.feature` | as `info.feature:269-282`: `offers these plugins:` `demo 2.0.0`; `publishes this manifest:` with entry `"version": "1.0.0"`; added; `When the user runs "/claude:plugin fetch demo@fixtures --scope project"` | row `version 1.0.0`; after `2.0.0` (needs Pitfall 1) |
| S6 | GLK-08 | `features/plugin/git-source-update.feature` | `ghp` 1.0.0; `has a revision only the tag "v2.0.0" reaches` (2.0.0); `offers ... from git repositories` (`ghp`, github, unpinned); `the marketplace "gits" names the ref "v2.0.0" for the plugin "ghp"`; added; `the user has run "/claude:plugin install ghp@gits --scope project"`; `When the user runs "/claude:plugin reinstall ghp@gits --scope project"`; `Then the git host receives no request` | reinstall refreshes the mirror (GET + POST) |

Scenario wording must follow `.agents/skills/cucumber/rules/features.md` (lower-case steps, no `And`, full-row tables, every row listed).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5 classifier exports composed per caller | one `classifyGitFailure(err, rule, url?)` | this phase | one place to change the ladder |
| GC after lock release, unlocked | GC under a fresh scope lock | this phase | no delete races a locked reader |
| wall-clock `updatedAt` | strictly increasing stamp | this phase | ST-9 sees same-ms overlap |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `t.mock.timers` with `apis: ["Date"]` does not disturb `proper-lockfile` acquisition in a short test | GLK-06 example | Low: the same file already freezes Date around real swaps (`seedUserEditedAgentUpdate`) |
| A2 | `fallow dupes` would flag a duplicated `upgradeCandidate` body in `edge-deps.ts` | Pattern 8 option 2 | Medium: if it does not, option 2 is viable but still duplicates a Phase 3 rule |
| A3 | A url marketplace offering a dir-path plugin syncs through `refreshUrlClone` in `update` with the steps listed in S3 | Cucumber S3 | Medium: if `offers these plugins:` does not republish a url marketplace, S3 needs a different setup step |
| A4 | Non-update `updatedAt` writers in the same ms are an acceptable residual | Pattern 6 | Low: ST-9 also compares version and sha |
| A5 | Phase 3 has not already changed `list-installed-row.ts::upgradeCandidate` when this phase runs | Pattern 8 | Medium: merge conflict on a moved function body |

## Open Questions

1. **Cause line on the cascade errno arm (GLK-02).** D-PL7-04 names only the fallback arm; S4 needs the errno arm too. Recommendation: attach `cause` for the git (except auth), errno, and fallback arms. Needs user confirmation because it changes existing cascade rows (for example `EACCES` rows gain a cause line).
2. **Lock `listUnreferencedPluginClones` too?** Its unlocked "before" read can miss a mirror a locked `fetch` adds, which the sweep then deletes. Recommendation: wrap it the same way (cheap, same file).
3. **Frame on 404 `source missing` plugin rows.** Recommendation: frame every HTTP-classified fetch/preflight row (D-PL7-03), and update `fetch.feature:154`. Alternative: frame only `network error` rows, as `marketplace add` does.
4. **Completion not-installed row version** (`edge-deps.ts:183`, named by ENTRYVER-01). It is never displayed. Recommendation: leave it (D-PL7-09 scopes completion to `upgradable`) and note it in the SUMMARY; or derive it from the same candidate if the planner already calls `resolveListCandidate` there.
5. **Shared upgrade rule placement** (Pattern 8 options). Recommendation: new Phase-7 module, coordinate the `list-installed-row.ts` delegation with Phase 3.
6. **`lacksStoredCredential` predicate.** Inline `classifyGitFailure(...)?.reason === "authentication required"` keeps literally one export; a named `isGitAuthFailure` export also satisfies "keep an auth predicate". Recommendation: inline.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all tests | yes | v26.12.1 | — |
| npm | scripts | yes | 11.20.0 | — |
| git CLI | cucumber fixtures (`runGit`) | yes | 2.56.0 | — |
| cucumber-js | S1-S6 | yes | `node_modules/.bin/cucumber-js` | — |
| fallow | gate | yes | `node_modules/.bin/fallow` | — |

Missing dependencies: none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration), `@cucumber/cucumber` ^13.3.0 (behavior) |
| Config file | `package.json` scripts; `cucumber.json` |
| Quick run command | `node --test <test-path>`; one case: `node --test --test-name-pattern '<title>' <test-path>` |
| Pair coverage | `npm run test:coverage:direct -- <source-or-test-path>` (100% line/function/branch) |
| One scenario | `npx cucumber-js --name '<scenario title>'` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GLK-01 | ladder per rule; frame only for non-auth HTTP with URL; missingRef only when set | unit | `node --test test/shared/git-failure-classifiers.test.ts` | yes (rewrite) |
| GLK-01 | fetch 503 → `network error` + frame; 404 → `source missing` | unit + cucumber S1 | `node --test test/orchestrators/plugin/fetch.test.ts`; `npx cucumber-js --name '<S1 title>'` | yes / new scenario |
| GLK-01 | info --fetch 404 → `source missing` | unit + cucumber S2 | `node --test test/orchestrators/plugin/info.test.ts` | yes / new |
| GLK-01 | tag probe 404/5xx classified | unit | `node --test test/orchestrators/plugin/dependency-tag-probe.test.ts` | yes |
| GLK-01 | plugin update marketplace sync 503 → `network error` + frame | unit + cucumber S3 | `node --test test/orchestrators/plugin/update-flow.test.ts` | yes / new |
| GLK-01 | preflight frame | unit | `node --test test/orchestrators/plugin/update-preflight.test.ts` | yes |
| GLK-01 | foreign callers unchanged | unit (existing) | `node --test test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/import/execute.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts` | yes |
| GLK-02 | cascade unclassified → `unreadable manifest` + cause; errno → its reason + cause | unit + cucumber S4 | `node --test test/orchestrators/plugin/update-flow.test.ts` (update the :4188 pin) | yes / new |
| GLK-03 | locked GC refuses under a holder, runs under the lock, reads with `persistMigration: false` | unit | `node --test test/orchestrators/plugin/clone-gc.test.ts` | yes |
| GLK-03 | uninstall / remove GC skipped under a holder taken from the completion-cache double | unit | `node --test test/orchestrators/plugin/uninstall.test.ts test/orchestrators/marketplace/remove.test.ts` | yes |
| GLK-04 | tag copy under lock; held lock → `StateLockHeldError` | unit | `node --test test/orchestrators/plugin/update-preflight.test.ts` | yes |
| GLK-05 | fetch and info rows read with the lock held (unpinned only) | unit | `node --test test/orchestrators/plugin/fetch.test.ts test/orchestrators/plugin/info.test.ts` | yes |
| GLK-06 | same-ms marks distinguished; finalize stamp > mark stamp; unparseable previous → now | unit | `node --test test/orchestrators/plugin/update-swap.test.ts` | yes |
| GLK-07 | fetch fresh and skipped rows use list version; cold/failed keep entry | unit + cucumber S5 | `node --test test/orchestrators/plugin/fetch.test.ts` | yes / new |
| GLK-07 | completion `upgradable` uses list rule | unit | `node --test test/orchestrators/edge-deps.test.ts` | yes |
| GLK-07 | browse uses list payload | existing | `node --test test/edge/handlers/plugin/browse.test.ts` | yes (verify only) |
| GLK-08 | warm mirror tag → offline sha; miss → refresh | unit + cucumber S6 | `node --test test/orchestrators/plugin/clone-cache.test.ts` | yes / new |

### Sampling Rate
- **Per task commit:** the owner test file(s) with `node --test`, then the pre-commit hook's `npm run check:commit` (static + unpaired + staged pairs' direct coverage). Run the task's scenario with `npx cucumber-js --name`; `check:commit` does not run cucumber.
- **Per wave merge:** `npm run check` on the combined tree (includes `test:cucumber` and all-pair direct coverage).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
None. All test files and the cucumber harness exist; no new framework, fixture, or step is required. A new module for the shared upgrade rule (Pattern 8 option 1) needs its paired test file created in the same plan.

## Proposed Wave Split (plans in one wave own disjoint files)

**Wave 1**
- **P01 classifier entry point (GLK-01 core):** `shared/git-failure-classifiers.ts` (+test): add `classifyGitFailure`; delete `hostHttpStatus`, `hostHttpFailureFrame`, `classifyGitSourceAccessFailure` (no production callers after this plan); keep `classifyGitTransportFailure` and `classifyGitHostFailure` exported for the wave-2 owners. Migrate `marketplace/{add,update,shared}.ts`, `import/execute.ts`, `install.messaging.ts`, `install-cascade.messaging.ts`, `reconcile/apply-outcomes.ts`, `dependency-tag-probe.ts` (+ its test).
- **P02 locked GC (GLK-03):** `clone-gc.ts` (+test), `uninstall.ts`, `marketplace/remove.ts`, `reconcile/apply.ts`, `dependency-bindings.ts`, `reinstall-flow.ts` (+ their tests). `garbageCollectPluginClones` stays exported until P05 rebinds `update-flow.ts`.
- **P03 intent stamp (GLK-06):** `update-swap.ts` (+test).
- **P04 offline tag (GLK-08):** `clone-cache.ts` (+test), scenario S6 in `git-source-update.feature`.
- **P05 completion version (GLK-07, completion half):** `edge-deps.ts` (+test), the shared upgrade rule (new module + test, `list-installed-row.ts` delegation, coordinated with Phase 3), `git-source-probe.ts` (+test) deletion of `probeUpgradeCandidate`.

**Wave 2**
- **P06 update flow (GLK-01 sync, GLK-02, GLK-03 binding):** `update-flow.ts` (+test): shared ladder, sync wrapper and rule, `cleanupClones` bindings → `collectPluginClonesLocked`. Scenarios S3 (`update.feature`) and S4 (`update-rollback.feature`).
- **P07 update preflight (GLK-01 frame, GLK-04):** `update-preflight.ts` (+test); edit `git-source-update.feature:311,313` (P04 edited that file in wave 1, so no conflict).
- **P08 fetch (GLK-01, GLK-05, GLK-07):** `fetch.ts` (+test), `operations.ts:188`, scenarios S1 and S5 in `fetch.feature` (+ `:154` if Open Question 3 says frame).
- **P09 info (GLK-01, GLK-05):** `info.ts` fetch-path functions (+test), scenario S2 in `info.feature`.

**Wave 3**
- **P10 cleanup and docs:** delete `classifyGitTransportFailure` / `classifyGitHostFailure` exports (+ test rewrite), make `garbageCollectPluginClones` module-private (+ `clone-gc.test.ts` migration), `docs/output-catalog.md` prose (no new catalog states).

P06 and P07 both touch `update-flow.test.ts`? No: P07 tests only `update-preflight.test.ts`. P06/P08 both read `clone-cache.ts` but neither edits it. `update-flow.ts:704` (converge binding) is P06's.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | stored-credential/Device Flow untouched; auth reasons classify the same |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | low | duck-typed error narrowing only; no new input parsing |
| V6 Cryptography | no | — |
| V7 Error Handling and Logging | yes | frames pass through cause-chain credential redaction (`shared/errors.ts:192`); `gitHubWireUrl` already applied for the frame URL |
| V12 Files and Resources | yes | GC deletes still route through `locations.pluginCloneDir` (NFR-10, `clone-gc.ts:132`) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| GC deletes a clone a concurrent reader is using (TOCTOU) | Tampering / DoS | scope lock around GC (D-PL7-05) |
| Tag copy reads a `.git` mid-refresh | Tampering | scope lock around the copy (D-PL7-06) |
| Credentials in an error frame | Information disclosure | `redactCredentials` on every cause link (`shared/errors.ts:192`) |
| A held lock starves GC | DoS (disk growth) | accepted: swallowed, retried by the next operation (D-19-01) |
| Same-ms overlap writes over a rival update | Tampering | strictly increasing stamp (D-PL7-08) |

## Sources

### Primary (HIGH confidence, read this session)
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` (whole file)
- `orchestrators/plugin/{fetch,info,update-flow,update-preflight,update-swap,clone-gc,clone-cache,dependency-bindings,dependency-tag-probe,reinstall-flow,uninstall,prune,list-candidate-version,list-installed-row,git-source-probe,marketplace-tag-probe,materialize-latest,dependency-settle,install-flow}.ts` (cited ranges)
- `orchestrators/{edge-deps.ts,marketplace/{add,update,shared,remove}.ts,reconcile/apply.ts,import/execute.ts}`
- `transaction/with-state-guard.ts`, `persistence/state-io.ts:399-508`, `shared/errors.ts:542-623`, `platform/git.ts:166-174,440-505,701-731`
- `node_modules/isomorphic-git/index.cjs` (1.43.1): 2162-2232, 10490-10690, 10838-10891
- `features/**` scenarios and step definitions cited above; `test/**` files cited above
- `docs/output-catalog.md` states cited; `test/architecture/catalog-uat/catalog-contract.test.ts:21-22,291-293`
- `.agents/skills/{cucumber,local-verification,typescript-unit-tests}` rules

### Secondary
- CONTEXT `<upstream>` record (Claude Code 2.1.310 binary grep, 2026-10-26) — not re-run; this phase's choices rest on recorded project models, not on new upstream behavior.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from installed files.
- Architecture: HIGH — every site and lock boundary read this session.
- Pitfalls: HIGH for 1, 2, 4, 6, 7 (read from code and features); MEDIUM for 3 and 5 (depend on a user decision).

**Research date:** 2026-10-26
**Valid until:** about 7 days, given eight sibling sessions editing shared files; re-check line numbers before each plan.

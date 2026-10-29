---
phase: 07-git-errors-and-lock-discipline
plan: 10
subsystem: git-failure-classification
tags: [git, classifier, dependency-tag-probe, output-catalog, phase-handoff]
status: complete

requires:
  - phase: 07-01
    provides: "classifyGitFailure(thrown, rule, remoteUrl?) and its three fixed-rule wrappers"
  - phase: 07-06
    provides: "update-flow no longer imports classifyGitTransportFailure"
  - phase: 07-08
    provides: "fetch no longer imports classifyGitTransportFailure"
  - phase: 07-09
    provides: "info no longer imports classifyGitTransportFailure"
provides:
  - "the dependency tag probe classifies a failed listing with classifyGitFailure and the plugin-clone rule: a host 404/410 is source missing, another non-auth HTTP status network error (GLK-01)"
  - "classifyGitTransportFailure is module-private; the classifier module exports classifyGitFailure, classifyGitHostFailure, classifyGitSourceAccessFailure, and hostHttpFailureFrame only"
  - "docs/output-catalog.md prose for update-host-failure, the autoupdate and apply ladder, fetch, bulk-mixed, info --fetch, and dependency-tag-listing-failed"
affects: [phase-07-verification, sibling branches importing classifyGitTransportFailure]

actuals:
  tokens: 8510
  tasks: 2
  commits: 2
plan_head_before: e706c30be2ba59968276a2456f3feb95436c1072
plan_head_after: 710e8bf3e04cb84cff956c07c98635d44f0ee23b

tech-stack:
  added: []
  patterns:
    - "A derived exported type (NonNullable<ReturnType<typeof f>>['reason'] | undefined) widens a consumer union with no new export"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
    - test/orchestrators/plugin/dependency-tag-probe.test.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - test/shared/git-failure-classifiers.test.ts
    - features/plugin/git-source.feature
    - docs/output-catalog.md

key-decisions:
  - "The tag probe calls classifyGitFailure(err, { notFound: 'source missing' })?.reason directly, as the plan names, not the equivalent classifyGitHostFailure wrapper"
  - "The private transport rung takes an Error, not unknown: classifyGitFailure already unwraps the cleanup leak and rejects a non-Error, so a second check would be a branch no test reaches"
  - "The transport describe's cases became classifyGitFailure rows; cases the table already held (same input, same meaning) were not duplicated"

requirements-completed: [GLK-01]

metrics:
  duration: "about 15 min"
  started: 2026-10-27T07:51:30Z
  completed: 2026-10-27T08:06:00Z
  tasks: 2
  files: 6
---

# Phase 7 Plan 10: Dependency tag listing on the host ladder, private transport rung, catalog prose

A constrained dependency whose repository answers 404 or 503 while its tags are read now fails as `{source missing}` or `{network error}` instead of `{unreadable}`. The classifier module now exports only `classifyGitFailure` and its three wrappers, and the output catalog's prose describes what the phase shipped.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Classify a failed tag listing on the host ladder, then make the transport layer private | `46aaae7d` | dependency-tag-probe.ts and its test, git-failure-classifiers.ts and its test, features/plugin/git-source.feature |
| 2 | Catalog prose for the phase's reasons, frames, locks, and version rule | `710e8bf3` | docs/output-catalog.md |

Range: `46aaae7d..710e8bf3` (base `e706c30b`).

## What changed

- `dependency-tag-probe.ts`: imports `classifyGitFailure`. `DependencyTagListingFailureReason` is now `NonNullable<ReturnType<typeof classifyGitFailure>>["reason"] | undefined`, so it adds `source missing` and `network error`. `listCandidateTags` classifies its catch with `classifyGitFailure(err, { notFound: "source missing" })?.reason`, with a D-PL7-02 comment. The consumers (`install-cascade.messaging.ts`, `update-constraint-gate.ts`) compile with no edit.
- `git-failure-classifiers.ts`: `classifyGitTransportFailure` lost its `export`. It now takes an `Error` and no longer unwraps the cleanup leak, because its one caller does both first. The module header names the entry point and the three wrappers. The function's doc calls it the transport rung of the ladder.
- `git-failure-classifiers.test.ts`: the `describe("classifyGitTransportFailure")` block is gone. Nine of its cases became new rows in the `classifyGitFailure` table under the plugin-clone rule: a generic error, an empty-message error, a non-integer 401 status (now `network error`, never `authentication required`), matching cancellation code and name, a cancellation name before a network code, a cancellation name before a non-auth HTTP status, a network code on an error with a cause, a network code only on the cause (unclassified), and a transport failure behind a cleanup leak. The table already held the other cases with the same input and the same meaning (null, empty string, empty object, undefined, the 401/403/404/400/500 statuses, a status-less HttpError, cancellation code, cancellation name, both credential errors, the six errno codes, a filesystem error, and a ref the remote does not have).
- `dependency-tag-probe.test.ts`: a two-row loop "classifies a host HTTP <status> on the listing as <reason> (GLK-01)" for 404 -> `source missing` and 503 -> `network error`. It compares the whole arm, then checks `cause` by identity. The existing unclassifiable case ("ref advertisement refused") stays unclassified under the host ladder, so its input did not change.
- `features/plugin/git-source.feature`: a new Scenario Outline, "An install fails on a constrained dependency as <reason> when the git host <refusal> while its tags are read and installs nothing", right after the existing dependency outline. `app` depends on `ghp@^1.0.0`. The rows are `answers 404` / `source missing` / 404, `drops the connection` / `network unreachable` / dropped, and `answers 503` / `network error` / 503. Each row checks every result row, the cause chain `Dependency "ghp@gits" could not be checked against ^1.0.0 (<reason>).`, the one git host request, no installed plugins, and no git clones.
- `docs/output-catalog.md` (prose only, no state marker and no example block changed):
  - `update-host-failure`: the `{status} on {url}` frame on an HTTP status, 404 included. The plugin update's marketplace refresh reads a host HTTP answer as `{network error}` with the same frame. A new paragraph covers the shared ladder of the autoupdate cascade and `apply`'s catalog moves (GLK-02 / D-PL7-04 / D-PL7-12). `{not in manifest}` stays for a plugin the catalog does not list.
  - `fetch` intro: the row comes from `resolveListCandidate` and follows `list`'s version rule, skipped rows included. A new paragraph covers the locked fetch-and-read on an unpinned source, `{lock held}`, and the 404/410 -> `{source missing}` and other status -> `{network error}` reasons with the frame.
  - `bulk-mixed`: a failed row's reason comes from the same host ladder.
  - `info` remote state: a new paragraph on `--fetch` failures: the token only, no status or URL, plus the locked read and `{lock held}`.
  - `dependency-tag-listing-failed`: the full reason list, and the `tag listing failed` cause text for an unclassified failure.

## Verification

| Command | Exit / result | Tree |
|---|---|---|
| `node --test` over dependency-tag-probe, git-failure-classifiers, install-cascade.messaging, update-constraint-gate tests | 0, 144 tests, 144 pass | Task 1 |
| `npm run test:coverage:direct -- dependency-tag-probe.ts git-failure-classifiers.ts` | 0 (100% for both pairs) | Task 1 |
| `npx cucumber-js features/plugin/git-source.feature:202` (new outline) | 0, 3 scenarios, 42 steps pass | Task 1 |
| Same outline with the HEAD `dependency-tag-probe.ts` and `git-failure-classifiers.ts` restored locally | 1, 2 scenarios fail (404 and 503 read `unreadable`), 1 pass (dropped connection) | Task 1, then restored |
| `npx cucumber-js features/plugin/git-source.feature features/plugin/install-dependencies.feature` | 0, 61 scenarios, 785 steps pass | Task 1 |
| `npm run check:static` | 0 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) | Task 1 |
| commit hook `npm run check:commit` | Passed | `46aaae7d` |
| `node --test test/architecture/catalog-uat/catalog-contract.test.ts` | 0, 4 tests pass | Task 2 |
| `SKIP=npm-check pre-commit run --files docs/output-catalog.md` | every hook Passed (mdformat, markdownlint-cli2, texthooks) | Task 2 |
| commit hook | Passed | `710e8bf3` |
| `npm run fallow` (unpiped) | **0** | `710e8bf3` |
| `npm run typecheck` (unpiped) | **0** | `710e8bf3` |

Node v26. I did not run the full `npm run check`. The orchestrator runs it at the phase gate.

Acceptance greps:

- `^export function classifyGitTransportFailure`: 0 (baseline 1).
- `classifyGitTransportFailure` in `dependency-tag-probe.ts`: 0 (baseline 3).
- No file in `extensions` or `test` other than the classifier module names `classifyGitTransportFailure`. At HEAD only the probe and the classifier test did, because the waves had already moved the rest.
- The module's `export function` names are exactly `classifyGitFailure`, `classifyGitHostFailure`, `classifyGitSourceAccessFailure`, and `hostHttpFailureFrame`.
- `{status} on {url}` in the catalog: 4 (baseline 2).
- No commit since `features/plugin-lifecycle` touches `catalog-contract.test.ts`.

## Deviations

- **Catalog wording for `apply`.** The plan's prose item (1) says that the autoupdate cascade and `apply`'s catalog moves "carry its cause line". The autoupdate row does (D-PL7-12). `apply`'s converge row does not: `reconcile/notify.ts` still drops the cause, which CONTEXT defers. The catalog says that `apply` shows the same reason with no cause line. It does not claim a cause line that the code does not print.
- **Transport cases folded, not copied one by one.** The plan says to convert every transport case into a `classifyGitFailure` row. The table already held 22 of them with the same input and the same meaning, so only the nine that it lacked became new rows. Duplicate rows would repeat test titles and add no assertion.
- **Private rung signature.** `classifyGitTransportFailure(error: Error)` replaces `(thrown: unknown)`. The leak unwrap and the non-Error check moved out because `classifyGitFailure` does both first. 07-01 made the same change to `httpStatus`.

## Out-of-line edits

None in this plan. Every file edited is in `files_modified`. The phase-wide list is under "Phase handoff" below.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-07-20 holds: the tag-listing row's cause names only the dependency key, the rendered range, and the closed-set reason. The probe adds no URL and no credential to the arm (AUTH-09). T-07-21 is mitigated: the catalog prose was written from the wave SUMMARYs and the code, and the catalog contract test passes with the state count and example bytes unchanged.

______________________________________________________________________

# Phase handoff

## CHANGELOG line

A sub-bullet for the milestone entry under `## [Unreleased]` (40 words):

```markdown
  - `update`, `fetch`, `info --fetch`, and dependency range checks report a git host 404 or 5xx as `install` does. `fetch` and completion show `list`'s version, a warm tag reinstall makes no request, and clone cleanup and reads respect the state lock.
```

## Decision rows

Key Decisions rows for `.planning/PROJECT.md`, in its `| Decision | Rationale | Outcome |` shape:

```markdown
| D-PL7-01: One git failure classifier, `classifyGitFailure(error, rule, remoteUrl?)`, returns `{ reason, frame? }`. The ladder: cleanup leak unwrap, missing pin `source missing`, transport auth, network errno, HTTP 404/410 to `rule.notFound`, other HTTP status `network error`, remote `NotFoundError` to `rule.missingRef`. | One ladder maps one failure to one reason on every surface. Upstream prints raw git stderr, so the project's closed reason set (ADD-09/ADD-10, UPD-11) is the model. | ✓ Good |
| D-PL7-02: The not-found rule is chosen per remote operation: `marketplace add` uses source missing plus missingRef, a marketplace refresh (marketplace update, autoupdate, plugin update's refresh) uses network error, and every plugin clone access (install, import, apply, update preflight, fetch, info --fetch, the dependency tag probe) uses source missing. | What a missing repository means depends on the operation, not the verb. A fresh clone of a missing repository is a missing source. A refresh of a known marketplace that answers 404 is a host failure. | ✓ Good |
| D-PL7-03: The `{status} on {url}` frame goes only where a row has a cause slot and the URL is at hand (marketplace add and update, plugin update's refresh, fetch, update preflight). Info rows carry the token only, and install, import, and apply rows keep their cause chain. | Those rows' functions belong to other phases, and upstream shows raw stderr anyway. | ✓ Good |
| D-PL7-04: The autoupdate cascade, apply's converge path, and the direct update share one failure ladder: typed errors, then classifyGitFailure with the plugin-clone rule, then errno, then `unreadable manifest`. `{not in manifest}` stays for a plugin the catalog does not list. | GLK-02 asks for the direct path's answer. The cascade's `{not in manifest}` fallback misnamed every unclassified failure. | ✓ Good |
| D-PL7-05: Clone GC runs under a fresh lock of the operation's scope (`collectPluginClonesLocked`) at every post-lock site, never inside a withStateGuard closure. A held lock skips the GC, and the next operation retries. | Clones and records are per scope. GC inside the guard would read the old record and delete the new clone. | ✓ Good |
| D-PL7-06: Only the marketplace tag copy in update preflight runs under the plugin scope's lock. A held lock reports `lock held`. | Since D-MF-04 the plugin scope records its own marketplace, so this is the lock `marketplace update` takes on that `.git`. Wrapping the whole preflight would nest locks. | ✓ Good |
| D-PL7-07: `fetch` and `info --fetch` run the materialize and the row read in one withExistingScopeLock body, on the unpinned arm only. | Locking the pinned arm would add a new `lock held` refusal. A pinned copy never changes, and GC now takes the lock. | ✓ Good |
| D-PL7-08: The intent mark and the finalize write a strictly increasing stamp, `max(now, previous + 1 ms)`. | Under the scope lock the stamp always differs from the one a rival read, so ST-9's comparison catches the overlap. No schema field and no migration. | ✓ Good |
| D-PL7-09: `fetch` rows take status and version from `resolveListCandidate`, and completion decides `upgradable` with `list`'s shared rule. `browse` already uses `list`'s builders. | One version rule (VER-01/VER-02) on every surface that shows a version. | ✓ Good |
| D-PL7-10: A tag-ref reinstall resolves `refs/tags/<ref>` locally after the tracking-ref lookup misses, through a default-injected `resolveTagOid`. A miss still refreshes. | NFR-5 lets a warm read stay offline. Injection avoids a new GitOps member and its fakes. | ✓ Good |
| D-PL7-11: `classifyGitHostFailure`, `classifyGitSourceAccessFailure`, and `hostHttpFailureFrame` stay as one-line fixed-rule wrappers for callers that other phases own. `classifyGitTransportFailure` and `hostHttpStatus` become private. | No edit in five files that other phases change, and fallow sees no test-only export. | ✓ Good |
| D-PL7-12: The update cascade attaches the cause on every arm that has one (errno, git, fallback). | The autoupdate row then matches the direct row's cause line. Existing EACCES cascade rows gain a cause line. | ✓ Good |
| D-PL7-13: `planCloneSweep`'s "before" listing also runs under the lock. | The listing and the sweep then see the same records. | ✓ Good |
| D-PL7-14: Every classified HTTP status on a plugin row (fetch, update preflight, plugin update's refresh) gets the frame, 404 included, as `marketplace update` does. `marketplace add`'s own frame rule is unchanged. | The status and URL are the only trace of the host's answer on a cause line. | ✓ Good |
| D-PL7-15: Completion's not-installed version stays the entry version. | It is never displayed. | ✓ Good |
| D-PL7-16: `upgradeCandidate` is exported from `list-installed-row.ts` and called from `edge-deps.ts`, and `probeUpgradeCandidate` is deleted. | The smallest edit in a file another phase changes, with one shared rule. | ✓ Good |
| D-PL7-17: `fetch`'s list version rule covers the skipped rows too. | A skipped row shows a version from the same read. | ✓ Good |
| D-PL7-18: `docs/output-catalog.md` gets prose edits only, with no new states. | `catalog-contract.test.ts` pins the state count and the example bytes, and Phase 3 changes that count. | ✓ Good |
```

## Backlog dispositions

Closed:

- **GITERR-01**: closed by GLK-01. `classifyGitFailure` with a per-operation rule (07-01), adopted by marketplace update (07-01), plugin update's refresh (07-06), update preflight (07-07), fetch (07-08), info --fetch (07-09), and the dependency tag probe (07-10).
- **CASCREASON-01**: closed by GLK-02. The autoupdate cascade shares the direct update's ladder and cause line (07-06).
- **CLONEGC-01**: closed by GLK-03. `collectPluginClonesLocked` and `listUnreferencedPluginClonesLocked` at every post-lock GC site (07-02).
- **TAGCOPY-01**: closed by GLK-04. The marketplace tag copy runs under the plugin scope's lock (07-07).
- **FETCHROW-01**: closed by GLK-05. fetch (07-08) and info --fetch (07-09) read their row inside the lock on the unpinned arm.
- **INTENTMS-01**: closed by GLK-06. `nextUpdateStamp` makes the mark and the finalize strictly later (07-03).
- **ENTRYVER-01**: closed by GLK-07. Completion (07-05) and fetch (07-08) use `list`'s version rule. Browse was verified unchanged.
- **LCORCH-01 b5** (tag-ref reinstall refreshes over the network): closed by GLK-08. Offline `refs/tags/<ref>` resolve in `clone-cache.ts` (07-04). The other LCORCH-01 bullets stay open.

New backlog candidates (CONTEXT `<deferred>`, plus one from 07-06):

- **Candidate-clone window**: update, reinstall, and converge create the candidate clone in preflight and record it only at finalize, so a locked GC from another process in that window can delete it. Options: record the candidate key in the intent mark, or hold one lock from copy to finalize.
- **Unlocked install preview**: `previewInstall` (`install-outcome.ts:848`) reaches the tag copy and the mirror refresh with no lock (`install-flow.ts:3331/3596`). install-outcome belongs to Phases 1 and 4.
- **Unlocked `sources/<name>` deletes and seeding**: `marketplace/remove.ts:1234->1171` and `carried-marketplace-adds.ts:103` delete with no lock, and `seedSameRepoPluginMirrors` (`add.ts:780`) copies after the lock.
- **Mirror refresh fetches no tags**: a mirror first cloned for another plugin's branch ref holds no `refs/tags/<ref>`, so GLK-08's offline resolve misses there. `tags: true` would fix it.
- **Apply's converge row drops the cause**: `reconcile/notify.ts:458-471` drops `outcome.cause`, so `apply`'s catalog-move row has no cause line while the autoupdate row has one.
- **`network error` comment**: the `shared/notification-types.ts` comment that limits `network error` to marketplace refresh and add needs widening to plugin clone accesses (Phase 3 owns the file).
- **Raw skills-staging path in update causes** (07-06, `deferred-items.md`): `bridges/skills/stage.ts` passes the raw `cp` error up, whose Node 26 message names a random `skills-staging/<uuid>` path. A `BridgeStagingError` wrapper like the commands bridge's would make the cause actionable and let a scenario pin it.

## Uncertain choices (for user review)

From 07-CONTEXT:

1. **Frame on plugin rows (D-PL7-03).** The frame shows only where a cause slot and the URL exist (fetch, update preflight, plugin update's refresh). Install, import, and apply rows keep their raw cause chain. The alternative is to thread the URL through every clone seam.
2. **Plugin update's marketplace refresh 404 (D-PL7-02).** It reads `network error`, as `marketplace update` does. The alternative is `source missing`, as for the plugin's own clone.
3. **GLK-02 fallback (D-PL7-04).** The fallback is `unreadable manifest` with the cause line. The alternative is IMP-09's bare `(failed)` with the cause.
4. **Intent mark (D-PL7-08).** A strictly increasing stamp. The alternative is the backlog's random token field in the record.
5. **Pinned fetch arm stays unlocked (D-PL7-07).** The alternative is to lock it too, which adds a new `lock held` refusal.
6. **Tag resolve injection (D-PL7-10).** A default-injected `resolveTagOid`. The alternative is a new `GitOps` member.
7. **Wrappers kept (D-PL7-11).** Thin wrappers, so five files that other phases own need no edit. The alternative is one export and an edit at each foreign caller.
8. **Frame on plugin 404 rows (D-PL7-14).** A frame on every HTTP status. The alternative is `marketplace add`'s network-error-only frame.
9. **Upgrade rule export (D-PL7-16).** `upgradeCandidate` is exported from `list-installed-row.ts`. The alternative is a new shared module.

Execution-time choices:

10. **Dependency tag-listing scenario.** CONTEXT names no scenario for the tag probe. 07-10 added the git-source outline (404, dropped connection, 503) to meet the behavior policy. The 404 and 503 rows fail without the change, and the dropped-connection row passes both ways as the third variant.
11. **Direct-path side effects of the shared update ladder (07-06).** On the direct path a `BridgeStagingError` now reads its cause's errno reason (for example `permission denied`), a `PinnedCommitMissingError` reads `source missing`, a host 5xx outside the refresh reads `network error`, and a 404 reads `source missing`. Cascade rows now map typed errors that used to read `not in manifest`: `MarketplaceNotFoundError` to `not found`, `PluginUpdatePhase3Error` to `rollback partial`, `InvalidMarketplaceManifestError` to `invalid manifest`, and the two layer-only errors to their tokens.
12. **Installed-order autoupdate scenario (07-06).** `features/marketplace/update.feature` now fails `zeta` on an unreadable command file instead of a skill file, because the skill copy's cause names a random staging path no token can stand for. Its later pending rows gain `components now supported`.
13. **Stamp literals moved by 07-03 in other phases' tests.** `update-swap.test.ts` (`assertAgentsMigrated`, D-18-15 to `.001Z`), `materialize-latest.test.ts` (both to `.001Z`), `dependency-move.test.ts` (`.001Z`), `operations.test.ts` reinstall (`.002Z`), and `reinstall-flow.test.ts` AGENT-01 (`.002Z` and `.004Z`).
14. **fetch.feature version cells changed under list's rule (07-08).** Each cell was empty and is now the tree's `plugin.json` version. Each table gained a `version` column. The changed rows: "succeeds again once the git host serves its repository again" (ghp 1.0.0), "downloads its new revision" (ghp 2.0.0), "leaves the installed plugin running the revision it installed" (ghp 2.0.0, installed at 1.0.0), "fetches each git-source plugin and reports the one the git host refuses" (urlp 1.0.0), "a bare fetch fetches the git-source plugins of every marketplace" (ghp and urlp 1.0.0), and "a pinned plugin whose clone is present" (subp 1.0.0 skipped).
15. **Completion covered by unit cases only (07-05).** No cucumber step reads tab completions, so GLK-07's completion half has only the `edge-deps.test.ts` rows. The harness belongs to Phase 10 (TST-01 / TST-02).
16. **Reinstall rows framed too (07-07).** Reinstall runs the update preflight, so a refused reinstall clone now carries the `{status} on {url}` frame. No reinstall scenario pins it.
17. **Autoupdate classification of a raw `pluginUpdate` throw (07-01).** `marketplace/update.ts::transportReason` now classifies an HTTP status and a missing pin there. No production path reaches it today, because `runCascadeTarget` catches everything except GHB-03.
18. **Catalog says apply shows no cause line (07-10).** See this plan's Deviations.

## Out-of-line edits

Files this phase touched outside the ROADMAP Files line (`shared/git-failure-classifiers.ts`, `orchestrators/plugin/{fetch,clone-gc,clone-cache,update-preflight,update-flow,uninstall,dependency-bindings}.ts`, `orchestrators/edge-deps.ts`, `info.ts`, `dependency-tag-probe.ts`, `marketplace/{shared,update,remove}.ts`, `reconcile/apply.ts`, `update-swap.ts`, `reinstall-flow.ts`) and their paired tests:

Source:

- `orchestrators/plugin/list-installed-row.ts`: the `export` on `upgradeCandidate` (07-05, D-PL7-16).
- `orchestrators/plugin/operations.ts`: `NODE_FETCH_STATUS` binds `resolveListCandidate` (07-08).
- `orchestrators/plugin/git-source-probe.ts` and `test/orchestrators/plugin/git-source-probe.test.ts`: `probeUpgradeCandidate` and its describe deleted (07-05).
- `docs/output-catalog.md`: prose only (07-10).

Tests:

- `test/integration/marketplace-add-seed-mirrors.test.ts`: import switch to the locked clone GC (07-02).
- `test/orchestrators/plugin/materialize-latest.test.ts`, `dependency-move.test.ts`: stamp literals (07-03).
- `test/orchestrators/plugin/operations.test.ts`: stamp literal and the prune lock count of 2 (07-03, commit `6071a677`), and the fetch case (07-08).
- `test/orchestrators/plugin/reinstall-flow.test.ts`: stamp literals (07-03) and the framed 404 cause (07-07).
- `test/edge/register.test.ts`: the registered prune cases count two lock calls (orchestrator commit `28c8f8e7`).

Features:

- `features/plugin/fetch.feature` (07-08), `features/plugin/info.feature` (07-09), `features/plugin/update-rollback.feature` (07-06), `features/plugin/git-source.feature` (07-10), `features/plugin/git-source-update.feature` (07-04, 07-07), and the new `features/plugin/url-marketplace-update.feature` (07-06).
- `features/marketplace/update.feature`, `features/step_definitions/marketplace/update.steps.ts`, and `features/lib/published-marketplace.ts`: the installed-order autoupdate scenario's unreadable command file (07-06).

Planning: `.planning/phases/07-git-errors-and-lock-discipline/deferred-items.md` (07-03, 07-06).

## Handoff note

`classifyGitTransportFailure`, `hostHttpStatus` (now `httpStatus`), `garbageCollectPluginClones`, and `listUnreferencedPluginClones` are module-private. A sibling branch that imports any of them must switch at merge: to `classifyGitFailure` (or `classifyGitHostFailure`, `classifyGitSourceAccessFailure`, `hostHttpFailureFrame`) for the classifiers, and to `collectPluginClonesLocked` or `listUnreferencedPluginClonesLocked` for the clone functions. A sibling that reads `DependencyTagListingFailureReason` must handle `source missing` and `network error` too.

Phase-wide symbol inventory: `classifyGitFailure` (07-01); `collectPluginClonesLocked`, `listUnreferencedPluginClonesLocked` (07-02); `nextUpdateStamp` (07-03); the `resolveTagOid?` argument of `materializeOrRefreshPluginMirror` (07-04); exported `upgradeCandidate` (07-05); the shared update failure ladder `classifyUpdateFailure` and `refreshFramed` (07-06); `candidateFailure`'s `remoteUrl` and the locked tag copy (07-07); `FetchStatus.resolveListCandidate` (07-08); `runFetchLocked` (07-09); the widened `DependencyTagListingFailureReason` (07-10).

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
- FOUND: extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
- FOUND: features/plugin/git-source.feature (outline at line 202)
- FOUND: docs/output-catalog.md
- FOUND: 46aaae7d (ancestor of HEAD)
- FOUND: 710e8bf3 (ancestor of HEAD)

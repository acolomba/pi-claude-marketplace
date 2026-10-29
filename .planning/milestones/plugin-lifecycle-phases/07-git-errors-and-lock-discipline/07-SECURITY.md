---
phase: 07-git-errors-and-lock-discipline
asvs_level: 1
block_on: high
verdict: secured
threats_total: 31
threats_closed: 31
threats_open: 0
audited: 2026-10-29
diff_base: cc459a82
audited_commit: be0de0c3
---

# Phase 07 security audit

Verdict: SECURED. A final audit on the integrated Phase 1-10 tree confirmed that every
threat in the plans' `<threat_model>` registers remains closed. No threat is open at
any severity.

## Threat verification

| Threat                | Category                                                     | Severity | Disposition | Evidence                                                                                                                                                                                                                   | Status            |
| --------------------- | ------------------------------------------------------------ | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| T-07-01               | Information disclosure: a URL in a cause frame               | med      | mitigate    | `classifyGitFailure` builds the frame only when `remoteUrl` is passed; the frame always travels as an Error message in the cause chain; `errors.ts:182-193` redacts every serialized cause link                            | closed            |
| T-07-02               | Repudiation: the wrong reason                                | low      | mitigate    | each wrapper is one `classifyGitFailure` call; pinned by `test/shared/git-failure-classifiers.test.ts`                                                                                                                     | closed            |
| T-07-03               | Tampering or DoS: clone GC against a locked reader           | high     | mitigate    | `clone-gc.ts:160-177` wraps both exported operations in `withExistingScopeLock`; readers hold the same lock in fetch, info and tag-copy paths; held-lock tests in clone-gc, uninstall, remove and dependency-bindings pass | closed            |
| T-07-04               | Tampering: GC inside a guard closure                         | high     | mitigate    | every GC site runs after its operation's lock is released; a nested call would hit `ELOCKED` and become a swallowed `StateLockHeldError`, never a delete                                                                   | closed            |
| T-07-05               | DoS: a held lock starves GC                                  | low      | accept      | every site traces and swallows the held lock                                                                                                                                                                               | closed (accepted) |
| T-07-06               | Tampering: same-millisecond ST-9 overwrite                   | med      | mitigate    | `update-swap.ts` calls `nextUpdateStamp` inside both guarded mark and finalize writes (`:709`, `:1030`); four GLK-06 cases pass                                                                                            | closed            |
| T-07-07               | DoS: a future `updatedAt`                                    | low      | accept      | `updatedAt` is only compared for equality and never shown                                                                                                                                                                  | closed (accepted) |
| T-07-08               | Tampering: a stale local tag                                 | low      | accept      | the offline fallback reads only the mirror's own refs, the same trust as the tracking ref                                                                                                                                  | closed (accepted) |
| T-07-09               | Tampering: an annotated tag that points at a tree or blob    | low      | mitigate    | `platform/git.ts:834-866` returns only commit OIDs and rejects blob, tree and unresolved tag chains; a miss falls through to refresh                                                                                       | closed            |
| T-07-10               | DoS: a malformed plugin tree in completion                   | low      | mitigate    | `list-installed-row.ts:93-101` folds resolution failure to the degrade; `edge-deps.ts` imports no git module                                                                                                               | closed            |
| T-07-11               | Information disclosure: the refresh frame and cascade causes | med      | mitigate    | the frame is wrapped in `MarketplaceUpdateError`; all rows go through `serializeCauseChain`                                                                                                                                | closed            |
| T-07-12               | Repudiation: cascade misattribution                          | low      | mitigate    | direct and cascade paths both use `classifyUpdateFailure` at `update-flow.ts:870-932`; parity tests pass                                                                                                                   | closed            |
| T-07-13               | Tampering: tag copy against a refresh in progress            | high     | mitigate    | tag copy is inside `withExistingScopeLock` at `update-preflight.ts:484`; marketplace refresh uses `withLockedStateTransaction` at `marketplace/update.ts:684`                                                              | closed            |
| T-07-14               | Information disclosure: preflight frame                      | med      | mitigate    | preflight frames remain cause links at `update-preflight.ts:551-557`, then are credential-redacted centrally                                                                                                               | closed            |
| T-07-15               | Tampering: fetch row read after unlock                       | med      | mitigate    | unpinned fetch materialization and row read share one locked body at `fetch.ts:385-409`; GLK-05 cases pass                                                                                                                 | closed            |
| T-07-16               | Information disclosure: fetch frame                          | med      | mitigate    | fetch frames remain cause links at `fetch.ts:579-587`, then are credential-redacted centrally                                                                                                                              | closed            |
| T-07-17               | Elevation (policy): fetch reaching git directly              | low      | mitigate    | `fetch.ts` imports no git surface and stays outside `NETWORK_SEAMS`; ESLint exits 0                                                                                                                                        | closed            |
| T-07-18               | Tampering: `info --fetch` row read after unlock              | med      | mitigate    | unpinned probe and row construction share `runFetchLocked` at `info.ts:2141-2152`; GLK-05 cases pass                                                                                                                       | closed            |
| T-07-19               | Information disclosure: info rows                            | low      | accept      | no `remoteUrl` is passed, so no frame; reason token only                                                                                                                                                                   | closed (accepted) |
| T-07-20               | Information disclosure: tag-listing row                      | low      | accept      | no `remoteUrl` is passed; reason token only                                                                                                                                                                                | closed (accepted) |
| T-07-21               | Repudiation: docs drift                                      | low      | mitigate    | `docs/output-catalog.md` prose updated; catalog contract test passes                                                                                                                                                       | closed            |
| T-07-SC (plans 01-10) | Tampering: package installs                                  | low      | accept      | `package.json` and `package-lock.json` have no diff against the base                                                                                                                                                       | closed (accepted) |

The table counts T-07-SC once; the plans carry it ten times.

## Fresh re-verification evidence

The security auditor re-read all ten plan threat registers against the active tree and
ran 67 focused cases across classifier/redaction behavior, GC/read/copy locks, intent
stamps, offline tags, completion degradation and the output-catalog contract. All 67
passed. The count remains 31 closed plan rows: 21 distinct `T-07-01` through
`T-07-21` rows plus the `T-07-SC` row repeated by all ten plans.

## Focus checks

- **Credentials in frames:** every frame lands in a row's `cause`, never in `notes` or a reason token. The single serializer redacts URL userinfo, `x-access-token:`, `Bearer` and GitHub tokens in text and JSON modes.
- **NFR-5:** `eslint.config.js` BLOCK F, the rule packs, `.fallowrc.json` and the package files are unchanged. The changed files outside `NETWORK_SEAMS` name no git surface. The offline tag fallback adds local reads only.
- **NFR-10:** GC deletes still resolve through `locations.pluginCloneDir(key)`. The unlocked GC and listing are module-private. The phase adds no new write paths.
- **Lock nesting:** every new lock site runs where its caller holds no lock on the same scope, including the marketplace refresh that the review fix added.

## Accepted risks

T-07-05, T-07-07, T-07-08, T-07-19, T-07-20 and T-07-SC, as above.

## Unregistered flags and residuals (none blocking)

- **R1, low, information disclosure:** autoupdate cascade cause lines can show absolute local paths, for example `skills-staging/<uuid>`. They are the user's own scope paths, not secrets. The direct `plugin update` row already shows them. This is deferred in 07-CONTEXT (review WR-02).
- **R2, low:** some windows are still unlocked and deferred in 07-CONTEXT: between candidate creation and finalize, `previewInstall`'s tag copy and refresh, the `sources/<name>` deletes, and `seedSameRepoPluginMirrors`.
- **R3, low:** the pinned arm of `fetch` and `info --fetch` takes no lock (D-PL7-07). A locked GC can still delete an unreferenced pinned clone during the read. The worst case is a mislabeled status row.
- **R4, informational:** a lock lost mid-body in the preflight's locked steps and in `info --fetch`'s probe maps only `StateLockHeldError`.
- **R5, informational:** the new frame surfaces have no surface-level userinfo test. They rely on the serializer's tests.

## Final integrated audit trail

2026-10-29 — Final merged-tree ASVS L1 re-audit at `d183d481`: 31/31
Phase 7 threat rows closed; 16/16 mitigations verified, 15/15 accepted risks
logged, no transfers or unregistered flags, and `threats_open: 0`. The
exact-candidate collector is the formal safe supersession of Plan 07-02's
broad-listing literal: it locks, reloads live state, and deletes only
operation-owned still-unreferenced keys. A focused 11-module adversarial run
passed; the fresh full gate remains green with 1,143 scenarios, 11,742 steps,
and 309 LCOV records.

2026-10-29 — Final-head ASVS L1 re-audit at executable head `be0de0c3`:
31/31 plan rows closed; 16 mitigations and 15 accepted rows verified; no
unregistered flags; `threats_open: 0`. Exact-candidate collection remains the
formal safe supersession of Plan 07-02's broad-listing literal. Nyquist
GLK-01..08 is COMPLIANT, and the unchanged-input full gate remains green with
1,145 scenarios, 11,777 steps, and 309 LCOV records.

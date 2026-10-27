---
phase: 07-git-errors-and-lock-discipline
verified: 2026-10-27T00:00:00Z
status: passed
score: 4/4 roadmap success criteria verified (8/8 requirements satisfied)
covered_files:
  - ".planning/phases/07-git-errors-and-lock-discipline/07-01-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-01-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-02-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-02-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-03-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-03-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-04-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-04-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-05-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-05-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-06-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-06-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-07-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-07-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-08-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-08-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-09-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-09-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-10-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-10-SUMMARY.md"
  - "extensions/pi-claude-marketplace/orchestrators/edge-deps.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
covered_digest: "v4:sha256:7a145d6e945796b9808e064c840e495e4d4a52a6089e722b9d2e23e709522c0c"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: Git Errors and Lock Discipline Verification Report

**Phase Goal:** One classifier reports every git host failure, and no clone read, copy, or cleanup runs outside the state lock.
**Verified:** 2026-10-27
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Roadmap Success Criteria

| # | Success criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | A host 404 and 5xx on plugin install, update, fetch, and info report as marketplace add and update report them, through one entry point (GLK-01, GLK-02) | VERIFIED | `shared/git-failure-classifiers.ts` exports `classifyGitFailure(thrown, rule, remoteUrl?)`; transport, status, and ref helpers are module-private. Callers: `marketplace/update.ts:509,719`, `marketplace/shared.ts:411`, `plugin/fetch.ts:605`, `plugin/info.ts:2176`, `plugin/update-preflight.ts:546`, `plugin/update-flow.ts:188,860,913`, `plugin/dependency-tag-probe.ts:140`. The three fixed-rule wrappers (`classifyGitHostFailure`, `classifyGitSourceAccessFailure`, `hostHttpFailureFrame`) are each one `classifyGitFailure` call, used by add, import, install, install-cascade, and apply-outcomes. A grep of `HttpError`, `statusCode`, and `NotFoundError` outside the classifier finds no second HTTP-status ladder. The cascade and direct update paths share `classifyUpdateFailure` (`update-flow.ts:790-860`): typed errors, then `classifyGitFailure` with the plugin-clone rule, then errno, then `unreadable manifest`. |
| 2 | A unit test holds the lock in a second operation and shows each clone cleanup, the tag copy, and the fetch row read wait for it (GLK-03, GLK-04, GLK-05) | VERIFIED | See the lock table below. Targeted run: `node --test --test-name-pattern=GLK` over uninstall, dependency-bindings, update-preflight, fetch, info, clone-cache, remove, edge-deps, and apply tests: 33 pass, 0 fail. `clone-gc.test.ts`, `update-flow.test.ts`, and `update-swap.test.ts` (364 tests): all pass. |
| 3 | Two intent marks in one millisecond are distinguished (GLK-06) | VERIFIED | `update-swap.ts:616` `nextUpdateStamp` = `max(now, Date.parse(previous)+1)`, with a fallback to `now` for an unparseable or largest-date stamp. Used at the intent mark (`:687`) and the finalize (`:1008`). Tests: "GLK-06: a swap prepared in the millisecond of another swap's intent mark fails concurrently updated", the unparseable and largest-date cases, and the finalize-after-mark case, all passing. |
| 4 | A `fetch` scenario for a plugin whose `plugin.json` and entry disagree shows the `list` version; a warm tag reinstall makes no network call (GLK-07, GLK-08) | VERIFIED | `features/plugin/fetch.feature:252` (entry 1.0.0, plugin.json 2.0.0, row shows 2.0.0). `features/plugin/git-source-update.feature:156` ("Reinstalling a plugin at a release tag reads the tag from the fetched copy with no request", ends `the git host receives no request`). A cucumber run of fetch, git-source-update, update-rollback, info, and url-marketplace-update: 51 scenarios, 605 steps, all passed. `clone-cache.ts:540-575` `resolveFetchedRefOffline` falls back to a local `refs/tags/<ref>` read, peeled by `resolveTagOid`, only after the tracking-ref NotFound; a miss still refreshes. |

**Score:** 4/4 success criteria verified.

### Lock discipline (GLK-03, GLK-04, GLK-05)

| Site | Locked by | Proof |
|------|-----------|-------|
| uninstall and prune cleanup | `uninstall.ts:1158` `collectPluginClonesLocked` | `uninstall.test.ts:3399` held lock leaves the clone and the uninstall succeeds |
| marketplace remove cleanup | `remove.ts:1240` | `remove.test.ts:818` |
| apply cleanup | `apply.ts:1497` via `collectClones`; deferred collection at `:1458` | `apply.test.ts:8051` (cleanup failure does not end the apply); lock behavior comes from the shared locked function |
| update and converge cleanup | `update-flow.ts:325,727,753` bindings | `update-flow.test.ts` and `update-preflight.test.ts` cases; shared locked function |
| reinstall cleanup | `reinstall-flow.ts:414` | shared locked function (no dedicated held-lock test) |
| dependency sweep, listing and collect | `dependency-bindings.ts:166,174` | `dependency-bindings.test.ts:381,407` |
| marketplace tag copy | `update-preflight.ts:479` `withExistingScopeLock` around `materializeMarketplaceTagClone` only | `update-preflight.test.ts:1439,1470` (copy happens while the lock is held; held lock reports `lock held`, copies nothing) |
| `fetch` row read | `fetch.ts:405` `withExistingScopeLock(locations, fetchAndRead)` for the unpinned arm | `fetch.test.ts:2494,2560` |
| `info --fetch` row read | `info.ts:2143` `runFetchLocked` | `info.test.ts:10364-10446` (not-installed, installed, pinned unlocked, bare info unlocked) |
| plugin update's marketplace refresh (added by review fix WR-01) | `update-flow.ts:186` | `update-flow.test.ts:1694,1739` |

`garbageCollectPluginClones` and `listUnreferencedPluginClones` in `clone-gc.ts` are module-private; only `collectPluginClonesLocked` and `listUnreferencedPluginClonesLocked` are exported (`clone-gc.ts:160,174`). The typecheck therefore rejects an unlocked call. No GC call sits inside a `withStateGuard` closure. "Waits for the lock" is implemented as "refuses or skips while held" (`retries: 0`), as recorded in 07-CONTEXT.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/git-failure-classifiers.ts` | one entry point plus three wrappers | VERIFIED | Substantive and wired; `classifyGitTransportFailure` and the status helpers are private |
| `orchestrators/plugin/clone-gc.ts` | locked GC and listing | VERIFIED | Wired at all sites above |
| `orchestrators/plugin/update-swap.ts` | strictly increasing stamp | VERIFIED | Private `nextUpdateStamp` at mark and finalize |
| `orchestrators/plugin/clone-cache.ts` | offline tag fallback | VERIFIED | `resolveTagOid` default-injected, not a new `GitOps` member |
| `orchestrators/edge-deps.ts` | completion uses list's rule | VERIFIED | Imports and calls `upgradeCandidate` (`edge-deps.ts:46,130`); exported from `list-installed-row.ts:88` |
| `orchestrators/plugin/fetch.ts`, `info.ts`, `update-preflight.ts`, `dependency-tag-probe.ts` | classification and locked reads | VERIFIED | See criteria 1 and 2 |
| Cucumber scenarios (fetch, info, git-source, git-source-update, update-rollback, url-marketplace-update) | user-visible proof | VERIFIED | All pass in the run above |

### Requirements Coverage

Every GLK ID appears in at least one PLAN `requirements:` field, and all eight are marked Complete in `.planning/REQUIREMENTS.md` (lines 82-89, 175-182). No orphaned requirement.

| Requirement | Source plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| GLK-01 | 07-01, 07-06, 07-07, 07-08, 07-09, 07-10 | SATISFIED | One classifier, per-operation rules, frames; callers listed under criterion 1 |
| GLK-02 | 07-06 | SATISFIED | `cascadeFailureOutcome` uses `classifyUpdateFailure`; autoupdate twin scenario in `update-rollback.feature:40`; `update-flow.test.ts` GLK-02 cases pass |
| GLK-03 | 07-02 | SATISFIED | Locked GC at every site; unlocked GC private |
| GLK-04 | 07-07 | SATISFIED | Tag copy wrapped in `withExistingScopeLock` |
| GLK-05 | 07-08, 07-09 | SATISFIED | `fetchOne` and `info --fetch` read their row inside the lock |
| GLK-06 | 07-03 | SATISFIED | `nextUpdateStamp` |
| GLK-07 | 07-05, 07-08 | SATISFIED | `fetch` rows through `resolveListCandidate`; completion through `upgradeCandidate`; `browse` already used list's builders (verified, unchanged) |
| GLK-08 | 07-04 | SATISFIED | Offline local-tag resolve, cucumber scenario with no host request |

### Anti-Patterns

A scan of the added lines in `extensions/` and `features/` since the phase base (`cc459a82`) finds no `TBD`, `FIXME`, or `XXX` marker. No stub, placeholder, or hardcoded-empty data path in the touched modules; the data flows from real classifier and lock calls.

### Phase artifacts cross-check

- `07-REVIEW-DISPOSITION.md`: 2 iterations, 0 open. Fixed: WR-01 (refresh under lock), IN-01, IN-04a, IN-01 and IN-03 of iteration 2. Accepted or deferred findings carry a reason; the deferred cause-line path redaction is recorded in 07-CONTEXT.
- `07-SECURITY.md`: verdict secured, 31/31 threats closed.
- `07-VALIDATION.md`: validated, every task row green.
- Deferred items in 07-CONTEXT (apply's converge row dropping the cause, the skills-bridge `cp` error wrapper in `deferred-items.md`) are recorded carriers, not gaps. The 07-03 `register.test.ts` prune lock-count item in `deferred-items.md` is no longer failing: `npm run check` is green on HEAD.
- Full gate: `npm run check` exited 0 on HEAD `8d516871` (relied on, not rerun).

### Advisory observations (not gaps)

1. The apply and reinstall cleanup bindings have no dedicated held-lock test; they rely on the shared, directly tested `collectPluginClonesLocked` and the type-level privacy of the unlocked GC. This holds structurally.
2. The iteration-2 fixer noted that the preflight's locked mirror step and tag copy, and `info --fetch`'s locked probe, map only `StateLockHeldError`. A lock lost mid-body reads as a failed candidate or a fetch reason instead of `lock held`. This is a wording edge on an unusual path, with no unlocked read or write.
3. `marketplace/update.ts:631` keeps a comment that names `reasonsFromTypedError`, a function that no longer exists. The cascade catch there is unreachable in production per review item IN-04b.

### Human Verification Required

None. No truth depends on visual or external-service behavior, and every behavior-dependent truth (lock refusal, same-millisecond stamp) has a passing test that exercises it.

### Gaps Summary

No gaps. All four roadmap success criteria and all eight GLK requirements are met in the code, with passing unit tests and cucumber scenarios.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_

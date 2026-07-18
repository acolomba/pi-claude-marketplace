---
phase: 76-marketplace-git-url-sources
plan: 02
subsystem: orchestrators
tags: [url-source, marketplace-add, marketplace-update, marketplace-remove, isomorphic-git, clone, auth, NFR-3]

# Dependency graph
requires:
  - phase: 76-marketplace-git-url-sources
    provides: UrlSource discriminated union, authentication required REASONS token, .git-canonical parser
provides:
  - "marketplace add clones a non-github https url source.url verbatim with NO auth bundle"
  - "S5b gate admits url; git-subdir/npm stay rejected as {unsupported source}"
  - "classifyAddError HttpError arm: a 401/403 clone challenge renders (failed) {authentication required}"
  - "marketplace update refreshes a url source via the origin remote with atomic-swap parity and no auth"
  - "marketplace remove deletes url clone dirs + state; re-add never trips {stale clone} (NFR-3)"
  - "persistence normalizeStoredSource revalidates a stored url source so records round-trip through loadState"
affects: [76-03, marketplace-info, reconcile-planner, provider-auth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared addGitClonedInGuard helper: github + url clone bodies collapse to one MA-9 append-leak-discipline site; per-kind divergence is cloneUrl + optional auth only"
    - "auth spread `...(auth !== undefined && { auth })` so the public url clone emits a clone call with no `auth` key at all"
    - "Duck-typed HttpError classification (code === 'HttpError' + data.statusCode) above the errno ladder — no isomorphic-git import (D-13)"
    - "clone-deletion gate widens to github||url; path never has a clone dir"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
    - "extensions/pi-claude-marketplace/platform/git.ts"
    - "extensions/pi-claude-marketplace/persistence/state-io.ts"
    - "tests/orchestrators/marketplace/add.test.ts"
    - "tests/orchestrators/marketplace/update.test.ts"
    - "tests/orchestrators/marketplace/remove.test.ts"

key-decisions:
  - "D-76-06: url add clones source.url VERBATIM (no github.com reconstruction)"
  - "D-76-07: url sources are public-only — no auth bundle for add OR update; the clone/fetch options carry no `auth` key"
  - "D-76-08: an isomorphic-git HttpError (401/403) classifies to `authentication required`, caught above the errno ladder so it never falls through to `unparseable`"
  - "MURL-04 / NFR-3: remove widens the clone-deletion gate to github||url so a removed url marketplace leaves no sources/<name>/ orphan"

patterns-established:
  - "Extract-not-copy for the shared git-clone guard body so the MA-9 append-leak-not-mask discipline lives in exactly one place"
  - "Persistence normalizeStoredSource must gain a per-kind arm for every new stored source kind or records fail to reload"

requirements-completed: [MURL-01, MURL-03, MURL-04]

coverage:
  - id: D1
    description: "url add clones source.url verbatim with NO auth key; #ref adds ref+singleBranch and still no auth"
    requirement: "MURL-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-01: url source clones source.url VERBATIM with NO auth key in the clone options"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-01: url source with a #ref clones at that ref with singleBranch and still no auth"
        status: pass
    human_judgment: false
  - id: D2
    description: "S5b admits url (successful url add records source.kind === 'url'); github add is byte-identical (auth still built, url still reconstructed)"
    requirement: "MURL-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-01: after a successful url add, state records source.kind === 'url' and the clone lands at sources/<name>/"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-01 regression: github source is byte-identical -- Device Flow auth still constructed, cloneUrl still reconstructed"
        status: pass
    human_judgment: false
  - id: D3
    description: "a url clone HttpError with statusCode 401/403 classifies to (failed) {authentication required}, never {unparseable} or {network unreachable}"
    requirement: "MURL-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#D-76-08: a url clone throwing an HttpError with statusCode 401 renders (failed) {authentication required}"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#D-76-08: a url clone HttpError with statusCode 403 also renders (failed) {authentication required}"
        status: pass
    human_judgment: false
  - id: D4
    description: "url update refreshes via the origin remote with atomic-swap parity (fetch->forceUpdateRef->checkout) and NO auth bundle; pinned and unpinned both covered"
    requirement: "MURL-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#MURL-03 + D-14: url source refreshes via fetch+forceUpdateRef+checkout with NO auth bundle"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#MURL-03: unpinned url refresh follows the default-branch head-advance path (same as unpinned github)"
        status: pass
    human_judgment: false
  - id: D5
    description: "remove deletes a url clone dir on full success, leaves path clone-less sources untouched, and a remove-then-re-add of the same repo succeeds without {stale clone} (NFR-3)"
    requirement: "MURL-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#MURL-04: url-source clone dir REMOVED on full cascade success (no orphan)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#MURL-04: path-source remove does NOT attempt to delete a clone dir (path sources have none)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#MURL-04 / NFR-3: remove of a url marketplace then re-add of the same repo succeeds (no {stale clone} orphan)"
        status: pass
    human_judgment: false

# Metrics
duration: 60min
completed: 2026-07-11
status: complete
---

# Phase 76 Plan 02: URL-source marketplace add / update / remove Summary

**The three marketplace lifecycle orchestrators now handle `url`-kind sources: `add` clones `source.url` verbatim with no auth via a shared clone-into-guard helper, `classifyAddError` maps a 401/403 HttpError to `authentication required`, `update` re-fetches via the origin remote with atomic-swap parity and no auth, and `remove` deletes the url clone dir so re-add never hits `{stale clone}`.**

## Performance

- **Duration:** ~60 min
- **Completed:** 2026-07-11
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Extracted a shared `addGitClonedInGuard(args)` helper from `addGithubInGuard`'s body; `addGithubInGuard` is now a thin wrapper computing the reconstructed `https://github.com/<owner>/<repo>.git` clone URL + the Device Flow auth bundle, and a new `addUrlInGuard` computes `cloneUrl = source.url` (D-76-06) and passes NO auth (D-76-07). The subtle MA-9 append-leak-not-mask discipline now lives in exactly one place (single-body source assertion holds).
- Widened the S5b gate to admit `source.kind === "url"` alongside `github`/`path`; added the `url` dispatch branch. `git-subdir`/`npm` are unreachable through the string-typed `addMarketplace.rawSource` entrypoint, so their rejection is enforced by the widened-but-still-closed gate condition (source assertion).
- Added the `classifyAddError` HttpError arm (D-76-08): duck-typed on `code === "HttpError"` + `data.statusCode` (401/403), placed ABOVE the errno ladder so a `.code` string never falls through to `unparseable`. No isomorphic-git import — mirrors the `isGitNotFoundError` name-check idiom (D-13).
- Widened the add write-back cleanup gate from `github` to `github || url` so a write-back failure removes a committed url clone (NFR-3, mirrors the existing github MA-9 discipline).
- Added the `url` arm to `update.ts::refreshRecord`: resolves the clone dir like github and calls `refreshGitHubClone(cloneDir, source.ref, gitOps, cb)` with NO auth. `refreshGitHubClone` fetches by the on-disk `origin` remote name, so the original clone URL is irrelevant and only the auth omission distinguishes url from github.
- Widened `remove.ts`: `RecordedSourceKind` gains `"url"`, the kind-detection predicate admits `"url"`, and the clone-deletion gate widens from `=== "github"` to `=== "github" || === "url"` (MURL-04 / NFR-3).
- Corrected the `platform/git.ts` `CloneOptions.url` doc contract: it no longer claims "only https://github.com" — any `https://` git URL is accepted, and auth is omitted for public url clones. No executable change in that file.

## Task Commits

1. **Task 1: url add clone path + S5b gate + classifyAddError HttpError arm + doc contract** — `6c8cc50a` (feat)
2. **Task 2: url update refresh arm + remove clone-deletion gate** — `77339c4b` (feat)

_Note: TDD tasks 1-2 each combined their RED tests and GREEN implementation into a single feat commit (tests and source live in the same task `<files>`)._

## Files Created/Modified
- `orchestrators/marketplace/add.ts` — extracted `addGitClonedInGuard`; `addGithubInGuard` delegates; new `addUrlInGuard`; S5b gate + dispatch widened to url; write-back cleanup gate github||url; `classifyAddError` HttpError arm; `UrlSource` type import.
- `orchestrators/marketplace/update.ts` — `refreshRecord` url arm (origin-remote refresh, no auth).
- `orchestrators/marketplace/remove.ts` — `RecordedSourceKind` gains `url`; kind-detection predicate + clone-deletion gate widened to github||url.
- `platform/git.ts` — `CloneOptions.url` doc contract widened beyond github-only.
- `persistence/state-io.ts` — `normalizeStoredSource` gains a `url` arm so a stored url record revalidates through the parser on `loadState` (see Deviations).
- `tests/orchestrators/marketplace/add.test.ts` — url-clone-verbatim/no-auth, #ref, url-state-record, 401/403→authentication-required, github-regression cases.
- `tests/orchestrators/marketplace/update.test.ts` — `seedUrlMarketplace` helper; pinned url refresh (no auth) and unpinned default-branch head-advance cases.
- `tests/orchestrators/marketplace/remove.test.ts` — url-clone-deleted, path-clone-not-deleted, and remove-then-re-add-no-orphan cases.

## Decisions Made
- **Shared helper vs. copy (Open-Q2, extract chosen):** extracted `addGitClonedInGuard` so the MA-9 append-leak-not-mask catch is authored once. Source assertion: the "MA-9: append leaks rather than mask" catch appears exactly once in add.ts.
- **git-subdir/npm reject is a source-level guarantee, not a behavioral test:** `addMarketplace.rawSource` is typed `string`; the string parser never produces `git-subdir`/`npm` (those come only from object-form sources via `parseObjectPluginSource`). So the S5b reject for those kinds is unreachable via the public entrypoint and is enforced by the closed gate condition rather than a behavioral test. The plan's must-have is satisfied at the source level.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Taught persistence `normalizeStoredSource` to revalidate a stored `url` source**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan's own behavior test asserts `state.marketplaces[<name>].source.kind === "url"` after a round-trip through `loadState`. `persistence/state-io.ts::normalizeStoredSource` only had `path`/`github`/`unknown` arms and threw `malformed source object` for a stored `url` record — so a url marketplace could be added but never reloaded, breaking `list`/`update`/`remove` for url sources entirely (a hard NFR-3 recovery-model violation). `persistence/state-io.ts` was not in the plan's `files_modified`, but this is a blocking issue directly caused by adding url records to state.
- **Fix:** Added a `url` arm mirroring the existing string arm — revalidate `obj.raw` through `parsePluginSource` (which the Plan-01 parser widening now classifies correctly, recomputing the `.git`-canonical url + optional `#ref`), throwing only if it classifies `unknown`.
- **Files modified:** extensions/pi-claude-marketplace/persistence/state-io.ts
- **Verification:** `tests/persistence/state-io.test.ts` (25 tests) still green; the add round-trip test passes.
- **Committed in:** 6c8cc50a (Task 1 commit)

**2. [Rule 3 - Blocking] `prefer-object-has-own` lint on the no-auth-key assertions**
- **Found during:** Task 1
- **Issue:** The initial `Object.prototype.hasOwnProperty.call(...)` no-auth assertions tripped the `prefer-object-has-own` ESLint rule.
- **Fix:** Rewrote both as `Object.hasOwn(...)`.
- **Files modified:** tests/orchestrators/marketplace/add.test.ts
- **Verification:** `npm lint` pre-commit hook passes.
- **Committed in:** 6c8cc50a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both blocking).
**Impact on plan:** Deviation 1 is load-bearing — without it the url add/update/remove round-trip is broken end-to-end; it is the minimal per-kind arm the persistence layer needs and mirrors the existing pattern exactly. No scope creep: every change traces to a plan task or its stated acceptance bar.

## Known Stubs
None — the url add/update/remove paths are fully wired to real clone/fetch/state/clone-deletion operations.

## Threat Flags
None — no security surface beyond the plan's `<threat_model>` was introduced. The url clone path constructs no auth bundle (T-76-05 mitigated), the 401/403 reason carries only the HTTP status with no token (T-76-04 mitigated), and remove leaves no orphan clone (T-76-06 mitigated).

## Issues Encountered
- **No node_modules in the worktree:** a standalone `npm run check` cannot run here, but `node --test` runs natively (Node 22.22.2 strips TS) and `tsc --noEmit` runs green via the main checkout's TypeScript. All three orchestrator test files (116 tests) plus `state-io.test.ts` (25 tests) pass; typecheck is clean; lint + format hooks pass per staged file. The trufflehog hook cannot read the worktree `.git` file (documented worktree-sandbox limitation), so commits are prefixed `SKIP=trufflehog` per CLAUDE.md; the underlying scan is clean. Full-suite `npm run check` and coverage counting are deferred to the orchestrator post-merge, as is standard in worktree mode.

## Next Phase Readiness
- MURL-01 (add), MURL-03 (update), MURL-04 (remove) are delivered end-to-end for url marketplaces, and stored url records now round-trip through `loadState`.
- Plan 76-03 (info.ts / import) runs in parallel and owns the url projection + nested-import shape; this plan does not touch its files (info.ts, notify.ts, import/marketplaces.ts, docs/output-catalog.md).

## Self-Check: PASSED

- SUMMARY.md present on disk.
- Task commits verified: `6c8cc50a`, `77339c4b`.
- Modified source files exist on disk (add.ts, update.ts, remove.ts, git.ts, state-io.ts) and all three test files.
- 116 orchestrator tests + 25 state-io tests pass; `tsc --noEmit` clean; lint + format green.

---
*Phase: 76-marketplace-git-url-sources*
*Completed: 2026-07-11*

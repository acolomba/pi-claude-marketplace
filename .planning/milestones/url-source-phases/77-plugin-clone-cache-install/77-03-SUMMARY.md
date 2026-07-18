---
phase: 77-plugin-clone-cache-install
plan: 03
subsystem: api
tags: [git-clone, source-addressed-cache, dedup, isomorphic-git, dependency-injection, atomic-rename]

# Dependency graph
requires:
  - phase: 76-marketplace-git-url-sources
    provides: "addGitClonedInGuard staging-clone -> atomic-rename lifecycle, MA-9 append-leak discipline, classifyAddError HttpError+errno ladder, parse-time canonical url (.git-stripped, #ref-split)"
  - phase: 77-plugin-clone-cache-install
    provides: "Plan 01: pluginCloneKey + pluginCloneDir chokepoint; Plan 02: resolveGitPluginRoot injection seam + GitPluginRootResult union"
provides:
  - "materializePluginClone(locations, cloneUrl, pin, ref?, gitOps?): clones at the pin into plugin-clones/<key>/ via staging + atomic rename, deduped by url+sha (PURL-04), offline warm-cache short-circuit (PURL-02), EEXIST-tolerant rename (MA-9)"
  - "resolvePluginPin(source, gitOps?): reconstructs the canonical clone url (github object -> https://github.com/<owner>/<repo>; url/git-subdir verbatim) and resolves the pin sha-over-ref, resolving unpinned HEAD via resolveRemoteRef"
  - "resolveRemoteRef platform wrapper (listServerRefs protocol v2, symrefs + peelTags) + GitOps.resolveRemoteRef interface method + DEFAULT_GIT_OPS wiring (D-77-05)"
  - "mock GitOps resolveRemoteRef stub (remoteResolveMap + remoteHead + resolveRemoteRefThrows + call recording)"
affects: [77-04-install-wiring, 78-gc-update, 78-offline-reinstall]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unpinned remote HEAD -> sha resolution via isomorphic-git listServerRefs (protocol v2, no full clone), confined to platform/git.ts (D-13)"
    - "Source-addressed clone-cache seam OUTSIDE install.ts: install calls the seam by name; the seam imports DEFAULT_GIT_OPS from marketplace/shared.ts (Pattern S-9, like update.ts) so install.ts keeps zero git surface (no-orchestrator-network gate)"
    - "EEXIST/ENOTEMPTY-tolerant atomic rename: a concurrent same-key install produces a byte-equivalent tree, so the losing rename is a warm-cache win, not an error"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - tests/helpers/git-mock.ts
    - tests/orchestrators/plugin/clone-cache.test.ts
    - tests/e2e/import-command.test.ts
    - tests/orchestrators/marketplace/shared.test.ts

key-decisions:
  - "resolveRemoteRef wraps listServerRefs (not getRemoteInfo2) -- listServerRefs returns the ServerRef[] directly; symrefs:true resolves the HEAD symref for an unpinned default-branch pin, peelTags:true + the ServerRef.peeled field resolves an annotated tag to its underlying commit (D-77-05)"
  - "The seam does NOT classify clone errors -- it preserves the raw errno/HttpError-carrying error via appendLeakToError (MA-9) so the install orchestrator (Plan 04) reuses classifyAddError for the authentication-required / network-unreachable tokens (T-77-03-03)"
  - "resolvePluginPin uses source.url verbatim for url/git-subdir (the parser already emits the parse-time canonical .git-stripped form, D-76-01) so dedup is .git-suffix-insensitive; github reconstructs https://github.com/<owner>/<repo> (D-77-06)"

patterns-established:
  - "GitOps interface widening: a new primitive requires updating every inline GitOps stub in the test tree (import-command, marketplace/shared) to satisfy the interface"
  - "Concurrent-install cache race resolved at the rename boundary, not with a lock: identical source-addressed key => identical tree => losing rename returns the winner's dir"

requirements-completed: [PURL-02, PURL-04]

coverage:
  - id: D1
    description: "materializePluginClone clones at the pin into plugin-clones/<key>/ via staging + atomic rename and returns the clone root"
    requirement: "PURL-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#PURL-02/04: materializePluginClone clones into staging, checks out the pin, returns a plugin-clones path"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second materialize of the same canonical-url+sha triggers zero additional clones (source-addressed dedup)"
    requirement: "PURL-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#PURL-04: a second materialize of the same url+sha triggers zero additional clones (dedup)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A warm-cache install completes offline even when the injected gitOps throws on clone"
    requirement: "PURL-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#PURL-02: a warm cache returns offline even when gitOps.clone throws"
        status: pass
    human_judgment: false
  - id: D4
    description: "sha wins over ref: given both, the checkout pins the sha; ref is only a singleBranch fetch hint"
    requirement: "PURL-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#Pitfall: sha wins over ref -- checkout pins the sha, clone singleBranch uses the ref"
        status: pass
    human_judgment: false
  - id: D5
    description: "A concurrent EEXIST/ENOTEMPTY rename is a byte-equivalent warm-cache win (no rethrow); a clone failure cleans staging and rethrows with the leak suffix (MA-9)"
    requirement: "PURL-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#Pitfall: an EEXIST/ENOTEMPTY rename is a warm-cache win (no rethrow)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#MA-9: a clone failure cleans staging and rethrows with the leak suffix appended"
        status: pass
    human_judgment: false
  - id: D6
    description: "resolveRemoteRef resolves an unpinned remote HEAD (or a named ref) to a full sha without a full clone; resolvePluginPin resolves sha-over-ref and canonicalizes the clone url"
    requirement: "PURL-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#D-77-05: resolvePluginPin resolves an unpinned source's remote HEAD to the pin"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#Pitfall: resolvePluginPin does NOT call resolveRemoteRef when a sha is set"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#D-77-06: resolvePluginPin reconstructs the canonical github url"
        status: pass
    human_judgment: false
  - id: D7
    description: "clone-cache.ts is legally allowed the git surface (uses gitOps); the no-orchestrator-network architecture gate stays green"
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
      - kind: other
        ref: "npm run typecheck (tsc --noEmit)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-11
status: complete
---

# Phase 77 Plan 03: Plugin clone-cache seam Summary

**`materializePluginClone` clones a git plugin source at its pinned/resolved sha into the source-addressed `plugin-clones/<key>/` cache via staging + atomic rename, deduped by url+sha with an offline warm-cache short-circuit and a concurrent-install-tolerant rename; `resolvePluginPin` canonicalizes the clone url and resolves the pin sha-over-ref (unpinned HEAD via the new `resolveRemoteRef` GitOps primitive).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-11T11:38:22Z
- **Completed:** 2026-07-11T11:50:30Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- `resolveRemoteRef` platform wrapper over isomorphic-git `listServerRefs` (protocol v2, `symrefs` + `peelTags`) resolves an unpinned remote HEAD or a named ref to a full commit sha WITHOUT a full clone (D-77-05), plus the matching `GitOps.resolveRemoteRef` interface method + `DEFAULT_GIT_OPS` wiring — isomorphic-git stays confined to `platform/git.ts` (D-13).
- `materializePluginClone` clones at the exact pin into `plugin-clones/<key>/` via `sourcesStagingDir` clone → checkout-the-pin → same-FS atomic rename, mirroring `addGitClonedInGuard` with MA-9 append-leak cleanup; a present key dir is a warm-cache short-circuit (no clone, no network — PURL-02/04); an `EEXIST`/`ENOTEMPTY` rename is a concurrent byte-equivalent win.
- `resolvePluginPin` reconstructs the canonical clone url (github-object → `https://github.com/<owner>/<repo>`; url/git-subdir → the parser's `.git`-stripped `source.url`) and resolves the pin sha-over-ref, resolving an unpinned source's remote HEAD via `resolveRemoteRef`.
- The `no-orchestrator-network` architecture gate stays green — `clone-cache.ts` legitimately uses `gitOps` (imported from `marketplace/shared.ts`, Pattern S-9) and is deliberately NOT in the forbidden list; `install.ts` will call the seam by name and keep zero git surface.

## Task Commits

Each task was committed atomically (TDD RED test + GREEN impl combined per task, following the wave-1 precedent where the test and the exports form one atomic unit under the plan's shared verify command):

1. **Task 1: resolveRemoteRef platform wrapper + GitOps method** - `89d75499` (feat, TDD)
2. **Task 2: materializePluginClone seam + resolvePluginPin** - `5e0da535` (feat, TDD)

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` (created) - `materializePluginClone` clone-cache seam + `resolvePluginPin` url-canonicalize/pin-resolve entrypoint.
- `extensions/pi-claude-marketplace/platform/git.ts` - added `ResolveRemoteRefOptions` + the `resolveRemoteRef` wrapper over `listServerRefs`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - added `resolveRemoteRef` to the `GitOps` interface + `DEFAULT_GIT_OPS` wiring; updated the primitive-count docstrings (7th primitive).
- `tests/helpers/git-mock.ts` - added the mock `resolveRemoteRef` (remoteResolveMap + remoteHead + resolveRemoteRefThrows + `resolveRemoteRefCalls` recording).
- `tests/orchestrators/plugin/clone-cache.test.ts` (created) - mock-behavior, dedup, offline-warm-cache, sha-over-ref, EEXIST-tolerance, MA-9-cleanup, and pin-resolution cases.
- `tests/e2e/import-command.test.ts`, `tests/orchestrators/marketplace/shared.test.ts` - added `resolveRemoteRef` to the inline `GitOps` stubs to satisfy the widened interface.

## Decisions Made
- **`listServerRefs` over `getRemoteInfo2`** (D-77-05): `listServerRefs` returns the `ServerRef[]` array directly (cleaner than `getRemoteInfo2`'s `{ protocolVersion, capabilities, refs? }` shape). `symrefs: true` makes the `HEAD` entry resolve the default branch for an unpinned pin; `peelTags: true` populates the `ServerRef.peeled` field so an annotated tag resolves to its underlying commit oid, not the tag object. Verified against `node_modules/isomorphic-git/index.d.ts` at implementation time (research A1).
- **The seam preserves, does not classify, clone errors.** `materializePluginClone` rethrows the raw errno/HttpError-carrying error (append-leak, MA-9) instead of calling `classifyAddError`. The install orchestrator (Plan 04) owns classification, so a private-github 401/403 surfaces the existing `authentication required` token and a cold-cache offline miss surfaces `network unreachable` (T-77-03-03) — no new error classifier built.
- **`resolvePluginPin` uses `source.url` verbatim** for url/git-subdir sources because the parser already emits the parse-time canonical `.git`-stripped, `#ref`-split form (D-76-01), so dedup is `.git`-suffix-insensitive without re-canonicalizing here. github reconstructs `https://github.com/<owner>/<repo>` (D-77-06) so a url entry and a github entry naming the same repo dedup to one clone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended two inline GitOps stubs to satisfy the widened interface**
- **Found during:** Task 1 (GREEN)
- **Issue:** Adding `resolveRemoteRef` to the `GitOps` interface failed `tsc` (TS2741) in two test files that construct inline `GitOps` object literals — `tests/e2e/import-command.test.ts` and `tests/orchestrators/marketplace/shared.test.ts` — because their stubs no longer satisfied the interface.
- **Fix:** Added a minimal `resolveRemoteRef` stub returning a fixed placeholder sha to each inline stub (neither test exercises the unpinned-resolution path).
- **Files modified:** tests/e2e/import-command.test.ts, tests/orchestrators/marketplace/shared.test.ts
- **Verification:** `tsc --noEmit` clean; both files' suites green (9 tests).
- **Committed in:** `89d75499` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking: interface-widening stub updates).
**Impact on plan:** Necessary to land the planned `GitOps` widening; the stubs are test scaffolding, not source scope. No source scope creep — the two source files (`clone-cache.ts`, `platform/git.ts`) and the interface change match the plan exactly.

## Issues Encountered
- **Worktree lacks `node_modules`:** the isolation worktree has no `node_modules`. Symlinked the main repo's `node_modules` (gitignored/untracked, never staged) so `node --test`, `tsc`, eslint, and prettier run against the worktree source. `resolveRemoteRef`'s isomorphic-git signature was verified against the main repo's `node_modules/isomorphic-git/index.d.ts`.
- **trufflehog under worktree sandbox:** the pre-commit trufflehog auto-updater cannot read the worktree `.git` (a file, not a directory) — the documented CLAUDE.md limitation. Ran `pre-commit run trufflehog --all-files` separately (same read-index error, an environmental limitation, not a scan finding) and committed with `SKIP=trufflehog` per project policy. The touched files carry only obviously-fake hex fixtures (`aaaa…`, `0000…`, `1234…`); no secrets.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04 (install wiring) can call `resolvePluginPin` then `materializePluginClone` to supply the clone-materializing `resolveGitPluginRoot` callback (Plan 02's injection seam), record `version: sha-<12hex>` (Plan 01) + `resolvedSha` (Plan 01), and keep `install.ts` gitOps-free by importing the seam by name.
- The `resolveRemoteRef` primitive + warm-cache dedup are ready for Phase 78 offline reinstall / GC / update sha-change swaps (they read the recorded url+sha; the seam already dedups by source).
- No blockers.

## Threat Coverage
- **T-77-03-01 (Tampering, high, mitigate):** clone into `sourcesStagingDir(uuid)` then same-FS `rename` into `pluginCloneDir(key)` (NFR-1); a failed clone/checkout/rename cleans staging (MA-9), leaving no half-materialized cache (NFR-3). Asserted by the MA-9 cleanup-on-throw test.
- **T-77-03-02 (Denial of service, medium, mitigate):** an `EEXIST`/`ENOTEMPTY` rename is treated as a byte-equivalent warm-cache win (same url+sha ⇒ same tree) — no crash, no duplicate clone. Asserted by the EEXIST-tolerance test.
- **T-77-03-03 (Information disclosure, low, mitigate):** public-only (D-77-06) — no credentials handled, nothing to leak. The seam interpolates no token; it preserves the raw errno/HttpError so the install orchestrator's existing `classifyAddError` surfaces `authentication required` (HTTP status only) for a 401/403.
- **T-77-03-SC (Tampering, high, accept):** no package installs this phase — `isomorphic-git@1.38.5` is already committed and in use; no new dependency surface.

## Known Stubs
None — `materializePluginClone`, `resolvePluginPin`, and `resolveRemoteRef` are fully wired and tested. (The placeholder-sha stubs added to `import-command.test.ts` / `shared.test.ts` are test scaffolding for the widened interface, not product stubs.)

## Self-Check: PASSED

- Files exist on disk: `orchestrators/plugin/clone-cache.ts`, `tests/orchestrators/plugin/clone-cache.test.ts`, `77-03-SUMMARY.md`.
- Commits present: `89d75499` (Task 1 feat), `5e0da535` (Task 2 feat); both on the worktree branch.
- Verification: `node --test "tests/orchestrators/plugin/clone-cache.test.ts"` → 15 pass; `no-orchestrator-network` gate green; `tsc --noEmit` clean; broad orchestrator/platform/e2e suite 1183 pass / 0 fail; eslint + prettier clean on touched files.

---
*Phase: 77-plugin-clone-cache-install*
*Completed: 2026-07-11*

---
phase: 77-plugin-clone-cache-install
plan: 04
subsystem: api
tags: [install, clone-cache, git-source, sha-version, dependency-injection, resolver-callback]

# Dependency graph
requires:
  - phase: 77-plugin-clone-cache-install
    provides: "Plan 01: pluginCloneKey / shaVersion / pluginCloneDir / resolvedSha state field; Plan 02: resolveGitPluginRoot injection seam + GitPluginRootResult union; Plan 03: materializePluginClone + resolvePluginPin clone-cache seam"
provides:
  - "install.ts injects a clone-materializing resolveGitPluginRoot callback so url / git-subdir / github plugin sources install end to end through the plugin-clones cache"
  - "git-subdir clone-root-anchored containment enforced in the install callback (escapes / missing-subdir fail clean, PURL-03 / NFR-10)"
  - "git-source version branch: version = shaVersion(resolvedPin) replacing the 3-tier ladder (D-77-01 / PURL-09); path sources keep the ladder"
  - "resolvedSha threaded through InstallCtx into the state record (full 40-hex, D-77-02)"
  - "InstallCloneCacheSeam test-injection point (resolvePluginPin / materializePluginClone) so install stays git-surface-free while tests drive a mock gitOps"
affects: [78-gc-update, 78-offline-reinstall, list, info]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clone-vs-probe policy injected into the resolver by the orchestrator: install supplies a clone-materializing resolveGitPluginRoot callback; the resolver stays network-free (D-11/D-13 boundary preserved)"
    - "Side-channel sha capture: the resolver schema cannot carry resolvedSha, so the injected callback captures the resolved pin into a closure the install body reads AFTER the resolve for the version + state record"
    - "Git surface stays out of install.ts: the clone flows through the clone-cache.ts seam by name (materializePluginClone / resolvePluginPin), never gitOps -- the no-orchestrator-network token-grep gate stays green"
    - "Seam-injection for testability without naming the forbidden token: InstallCloneCacheSeam carries the two seam entrypoints (each pre-bound to a mock backend) so install never references gitOps even in tests"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - docs/output-catalog.md

key-decisions:
  - "Git source => ALWAYS sha-<12hex> (Open Q1 resolution): the resolved commit IS the version identity for a git-materialized plugin, so it replaces the whole 3-tier ladder rather than only the tier-3 hash. pinVersionOverride (enable branch) still wins ahead of it."
  - "git-subdir containment lives in the install callback (anchored to the clone root), surfacing as the resolver's escapes / missing-subdir arms -- the resolver never marketplaceRoot-anchors a clone path (PURL-03 / D-77-03)."
  - "Test injection uses an InstallCloneCacheSeam bundle (the two seam entrypoints), NOT a gitOps field, so install.ts source carries zero git-token surface even in the test-driven path (no-orchestrator-network gate)."
  - "The resolvedSha side-channel is captured only on the materialized path (after a successful clone), so an escaped / missing subdir leaves no stale sha for the version or state record (Pitfall 5)."

patterns-established:
  - "makeInstallCloneProbe factory returns { probe, resolvedSha() } -- extracting the callback + capture out of runInstallLedger keeps the ledger body under the cognitive-complexity gate."
  - "deriveInstallVersion helper localizes the pinVersionOverride > git-sha > 3-tier-ladder precedence."

requirements-completed: [PURL-01, PURL-02, PURL-03, PURL-04, PURL-09]

coverage:
  - id: D1
    description: "A url-source plugin materializes a clone and records version sha-<12hex> + full resolvedSha; version 12-hex == resolvedSha first-12"
    requirement: "PURL-01, PURL-02, PURL-09"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-01/02/09: url-source install materializes a clone, records sha-<12hex> + resolvedSha"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second install referencing the same canonical url+sha does NOT clone again (source-addressed dedup)"
    requirement: "PURL-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-04: a second install of the same url+sha does NOT clone again (dedup)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A git-subdir install resolves pluginRoot = cloneRoot + subdir; an escaping subdir fails the install; a missing subdir fails the install"
    requirement: "PURL-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-03: git-subdir install resolves pluginRoot = cloneRoot + subdir"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-03: a git-subdir path escaping the clone root fails the install"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-03: a missing git-subdir path fails the install"
        status: pass
    human_judgment: false
  - id: D4
    description: "A github-object source reconstructs https://github.com/<owner>/<repo> and dedups to the same clone as a url naming the same repo"
    requirement: "PURL-01, PURL-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#D-77-06: a github-object source dedups to the same clone as a url naming the same repo"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unpinned url source resolves remote HEAD at install and records that sha; sha wins over ref; path sources keep the 3-tier ladder"
    requirement: "PURL-09"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-09 / D-77-05: an unpinned url source resolves remote HEAD and records that sha"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-09 / sha over ref: a source with both ref and sha records the sha's version"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PURL-09 regression: a path-source install keeps its 3-tier ladder version (not sha)"
        status: pass
    human_judgment: false
  - id: D6
    description: "install.ts carries zero git surface; the no-orchestrator-network gate stays green after the phase; a persisted git-source sha-<12hex> renders v#<7hex> on the list surface"
    requirement: "PURL-01, PURL-09"
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#sha-version-list: git-source sha-<12hex> renders v#a1b2c3d byte-form"
        status: pass
      - kind: other
        ref: "npm run check (typecheck + eslint + prettier + tests + integration) exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-07-11
status: complete
---

# Phase 77 Plan 04: Install clone-cache + sha-version wiring Summary

**`install.ts` now installs a `url` / `git-subdir` / `github`-object plugin end to end: it injects a clone-materializing `resolveGitPluginRoot` callback (Plan 02 seam) that runs the Plan 03 clone-cache seam, captures the resolved 40-hex sha as a side-channel, records `version: sha-<12hex>` (D-77-01) and the full `resolvedSha` (D-77-02), enforces git-subdir clone-root containment, and keeps zero git surface so the `no-orchestrator-network` gate stays green.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-11T12:05:20Z
- **Completed:** 2026-07-11T12:23Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `install.ts` builds an `installCloneProbe` (via the `makeInstallCloneProbe` factory) that calls `resolvePluginPin` then `materializePluginClone` from the `clone-cache.ts` seam, resolves git-subdir `pluginRoot = cloneRoot + path` with clone-root-anchored `assertPathInside` (PURL-03 / NFR-10 -- escapes / missing-subdir fail clean), and captures the resolved pin as a side-channel. The callback is injected into the PI-4 `resolveStrict` call; the 5-phase ledger reads the materialized `pluginRoot` uniformly (unchanged).
- The resolved sha threads through a new `InstallCtx.resolvedSha?` field into the state-record write (`resolvedSha: c.resolvedSha`, D-77-02) -- only present for git sources.
- The PI-7 version derivation branches for git sources: `version = shaVersion(resolvedPin)` (D-77-01 / PURL-09, Open Q1: git => always sha), replacing the whole 3-tier ladder; `pinVersionOverride` (enable branch) still wins; path / github-name sources keep the ladder. Extracted into `deriveInstallVersion`.
- `install.ts` carries zero git-token surface: the clone flows through the seam by name (`materializePluginClone` / `resolvePluginPin`), never `gitOps`. Test injection uses an `InstallCloneCacheSeam` bundle (the two seam entrypoints, each pre-bound to a mock gitOps) so the git-source install path runs offline in tests without install ever naming the forbidden token.
- The `no-orchestrator-network` gate's rationale prose updated to reflect install's delegation to `clone-cache.ts`; `FORBIDDEN_TARGETS` / `FORBIDDEN_PATTERNS` unchanged (install.ts stays gated, gate stays green). A `sha-version-list` catalog state + fixture byte-pins the git-source `sha-<12hex>` -> `v#a1b2c3d` list render.

## Task Commits

Tasks 1 and 2 share `install.ts` + `install.test.ts` (Task 2's git-source version branch consumes Task 1's captured sha), so their source/test unit committed atomically; Task 2's catalog-uat byte-form and Task 3's gate-rationale committed separately.

1. **Tasks 1+2 (install wiring + sha-version branch)** - `06c534a2` (feat, TDD)
2. **Task 2 (catalog-uat sha-version byte form)** - `9e39265c` (test)
3. **Task 3 (no-orchestrator-network rationale)** - `a12a81e1` (docs)

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - added the `makeInstallCloneProbe` factory + `resolveGitSubdirRoot` + `deriveInstallVersion` helpers; injected the clone probe into `resolveStrict`; threaded `resolvedSha` through `InstallCtx` into the state record; added the `InstallCloneCacheSeam` injection field to `InstallLedgerOptions` / `InstallPluginOptions`.
- `tests/orchestrators/plugin/install.test.ts` - 9 git-source cases (url install + sha/resolvedSha, dedup, git-subdir root, escape, missing-subdir, github dedup, unpinned HEAD, sha-over-ref, path regression) + a mock-gitOps-bound seam helper + a git-source seed helper; retitled 2 pre-existing PI-4 / FORCE-05 tests to an `npm` source (still unsupported).
- `tests/architecture/catalog-uat.test.ts` - `sha-version-list` fixture.
- `docs/output-catalog.md` - `sha-version-list` catalog block (byte-form + prose).
- `tests/architecture/no-orchestrator-network.test.ts` - updated install.ts rationale prose (comment-only).

## Decisions Made
- **Git source => ALWAYS `sha-<12hex>` (Open Q1 resolution).** The resolved commit is the version identity for a git-materialized plugin, so it replaces the whole 3-tier ladder, not just the tier-3 hash fallback. A plugin.json version inside a pinned commit is redundant with the sha. `pinVersionOverride` (the enable branch) still precedes it so an enable re-materialization preserves the recorded pin.
- **Test injection via `InstallCloneCacheSeam`, not a gitOps field.** The `no-orchestrator-network` gate greps the comment-stripped install.ts source for the literal token `gitOps`; a `cloneCacheSeam` bundle carrying the two seam entrypoints (each closed over a mock gitOps in the test) lets tests drive the git-source path offline while install never names the forbidden token.
- **git-subdir containment in the callback.** The callback holds `cloneRoot` in scope, so it runs `assertPathInside(cloneRoot, resolve(cloneRoot, path))` and returns the discriminated `escapes` / `missing-subdir` arms; the resolver surfaces both as `unavailable`. The resolver never marketplaceRoot-anchors a clone path.
- **Side-channel sha captured only on success.** The clone probe assigns the captured pin AFTER a successful materialize (and, for git-subdir, after containment passes), so a failed clone / escape leaves no stale sha for the version or the state record.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retitled two pre-existing tests asserting the superseded resolver contract**
- **Found during:** Task 1 (test run)
- **Issue:** `PI-4: non-path source -> unavailable {unsupported source}` and `FORCE-05: force cannot bypass an unavailable (structural) plugin` both used a `github:...` source. Under PURL-01 a github source is now installable, so with no mock seam injected they exercised the REAL clone-cache seam and failed with a live `HTTP Error: 404` instead of the expected `unavailable` row.
- **Fix:** Switched both to an `npm` object source (`{ source: "npm", package: ... }`), which stays out of scope and resolves `unavailable {unsupported source}` with NO clone attempt -- preserving each test's original intent (PI-4 unsupported-source rejection; FORCE-05 cannot-bypass-structural).
- **Files modified:** tests/orchestrators/plugin/install.test.ts
- **Verification:** Both tests green; full install suite 90 pass.
- **Committed in:** `06c534a2`

**2. [Rule 3 - Blocking] Extracted the clone probe + version derivation into helpers to satisfy the cognitive-complexity gate**
- **Found during:** Task 1 / Task 2 (eslint)
- **Issue:** Building the `installCloneProbe` closure + the git-source version `if/else if/else` inline pushed `runInstallLedger`'s `sonarjs/cognitive-complexity` from 15 to 17 (over the allowed 15).
- **Fix:** Extracted `makeInstallCloneProbe` (returns `{ probe, resolvedSha() }`), `resolveGitSubdirRoot`, and `deriveInstallVersion` as module-level helpers -- the same capture semantics, lower per-function complexity. `runInstallLedger` returns under the gate.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
- **Verification:** eslint clean; typecheck clean; install suite 90 pass.
- **Committed in:** `06c534a2`

---

**Total deviations:** 2 auto-fixed (1 superseded-contract test bug; 1 blocking complexity extraction).
**Impact on plan:** Both were necessary to land the planned wiring cleanly. No source scope creep -- the three source-touched files (`install.ts`, `no-orchestrator-network.test.ts`, `catalog-uat.test.ts`/`output-catalog.md`) match the plan; the extractions are internal refactors of the same install.ts scope.

## Authentication Gates
None -- public-only this phase (D-77-06); no credentials handled.

## Issues Encountered
- **Worktree lacks `node_modules`:** the isolation worktree has no `node_modules`. Symlinked the main repo's `node_modules` (untracked, never staged, removed before finishing) so `node --test`, `tsc`, eslint, prettier, and `npm run check` run against the worktree source.
- **trufflehog under worktree sandbox:** the pre-commit trufflehog auto-updater cannot read the worktree `.git` index (a file, not a directory) -- the documented CLAUDE.md limitation. Ran `pre-commit run trufflehog --all-files` separately (same read-index environmental error, not a scan finding) and committed with `SKIP=trufflehog` per project policy. The touched test files carry only obviously-fake hex fixtures (`a1b2c3d4...`, `ffff...`, `0f1e2d3c...`); no secrets.

## Threat Coverage
- **T-77-04-01 (Tampering, high, mitigate):** install.ts imports the clone-cache seam by name and never references `gitOps` / `DEFAULT_GIT_OPS` / `platform/git` / `refreshGitHubClone`; the `no-orchestrator-network` token-grep gate enforces this (Task 3 kept install.ts gated). Asserted by the gate + the existing install-git-surface test.
- **T-77-04-02 (Tampering, high, mitigate):** the install callback runs `assertPathInside(cloneRoot, resolve(cloneRoot, source.path))` and fails the install on escape (PURL-03 / NFR-10). Asserted by the escaping-subdir test.
- **T-77-04-03 (Repudiation, medium, mitigate):** the version and resolvedSha both derive from the SAME captured pin (resolved BEFORE the key/clone), so the record is truthful. Asserted: version 12-hex == resolvedSha first-12.
- **T-77-04-04 (Information disclosure, low, mitigate):** public-only (D-77-06); a private repo surfaces the existing `authentication required` token (the seam preserves the raw HttpError; no new auth wiring, no credential handled, no leak).

## Known Stubs
None -- the install git-source path is fully wired and tested; no placeholder values, no unwired data sources.

## Next Phase Readiness
- Phase 78 (GC / update / offline reinstall) can compare the persisted full `resolvedSha` (never the `sha-<12hex>` display form) and reuse the source-addressed dedup already exercised here.
- The `InstallCloneCacheSeam` injection + git-source seed helpers are reusable test scaffolding for later git-source install/update coverage.
- No blockers.

## Self-Check: PASSED

- Files exist on disk: `install.ts`, `install.test.ts`, `catalog-uat.test.ts`, `no-orchestrator-network.test.ts`, `output-catalog.md`, `77-04-SUMMARY.md`.
- Commits present: `06c534a2` (feat), `9e39265c` (test), `a12a81e1` (docs) -- all on the worktree branch.
- Verification: install suite 90 pass; install + catalog-uat 96 pass; no-orchestrator-network gate green; `npm run check` exit 0 (typecheck + eslint + prettier + tests + integration); install.ts git-token surface empty (comment-stripped).

---
*Phase: 77-plugin-clone-cache-install*
*Completed: 2026-07-11*

---
phase: 18-update-and-reinstall-unification
plan: 07
subsystem: orchestrators/plugin (git-source reinstall tests)
tags: [reinstall, git-source, nfr-5, d-18-04, d-18-11, d-18-16]
requires:
  - phase: 18-update-and-reinstall-unification
    provides: "reinstall on the shared runner with refreshSource: false (18-01, 18-02) and the retry proofs (18-06)"
provides:
  - "The git-source reinstall pins on the shared path, including reinstall's half of the D-18-11 pin"
  - "createGitOps can report a chosen HEAD and exposes its fetch calls"
  - "A phase-wide sweep: no test, source, or doc line still describes reinstall's sha re-pin"
affects: [phase 18 verification]
actuals:
  tokens: 11000
  tasks: 2
  commits: 2
plan_head_before: d776486e
plan_head_after: self # the task 2 commit, which also adds this file; a file cannot name its own hash
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - docs/competitive-analysis/pi-plugins.md
    - docs/competitive-analysis/asermax-pi-cc-plugins.md
key-decisions:
  - "The fake's HEAD is seeded through createGitOps({ head }), which sets both initialOid (what resolveRef(\"HEAD\") answers) and remoteHead (what a clone checks out)"
requirements-completed: [REI-04, UPR-01]
duration: 25min
completed: 2026-10-23
status: complete
---

# Phase 18 Plan 07: Git-source reinstall pins Summary

**Eight git-source reinstall cases are back on the shared path. An unpinned
reinstall reads the mirror's HEAD offline and moves a record made on the
mirror onto its per-commit copy (D-18-04, D-18-11). A missing mirror is a
cache miss that clones once, and a failed clone skips and leaves nothing. An
invalid GitHub base now fails a reinstall even on a warm cache (D-18-16). The
full gate is green, which closes the phase.**

## Re-added cases (original line in `9f126315:test/orchestrators/plugin/reinstall-flow.test.ts`)

| Original line | New title | Pinned behavior |
| ------------- | --------- | --------------- |
| 4836 | GIT-01 / D-18-04 / D-18-11: an unpinned reinstall of a record on the mirror copies the mirror's HEAD with no network call | The record's `resolvedSource` is the mirror (IN-01 shape). The fake's HEAD is `MIRROR_HEAD_SHA`. Outcome reinstalled at 9.9.9 in full; zero clone, fetch, and remote-ref calls; the record is on `pluginCloneKey(url, MIRROR_HEAD_SHA)` with `resolvedSha` `MIRROR_HEAD_SHA` and version 9.9.9 (the copy's `plugin.json`). |
| 7021 | an unpinned git-subdir reinstall copies the mirror's HEAD without external calls | Same, with `resolvedSource` at the copy's `packages/gp`. |
| 4892 | MIRR-06 / D-18-04: an unpinned reinstall with no mirror clones it once and installs its HEAD | A per-sha-clone-only record and a clone that copies a fixture tree: one clone call to the identity URL, reinstalled, the record on the per-commit copy of the cloned HEAD. |
| 4948 | D-18-04: an unpinned reinstall whose mirror clone fails is skipped and materializes nothing | `{ skipped, notes: ["network unreachable: clone"], reasons: ["no longer installable"] }`, one clone attempt, `plugin-clones/` empty afterward. |
| 4164 | a clone-cache seam non-Error rejection becomes a complete skipped outcome | The full four-member seam with `materializePluginClone` rejecting `"clone-cache string failure"` on a cold pinned cache: `{ skipped, notes: ["clone-cache string failure"], reasons: ["no longer installable"] }`, no notification. |
| 4654 | GHB-03 / D-18-16: an invalid GitHub base fails a reinstall of a GitHub-source plugin even on a warm cache | The inverse of the old NFR-5 case: `reinstallPlugin` rejects with `InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme")`, no clone call, state bytes unchanged. |
| 7076 | an unpinned git-subdir reinstall whose mirror lacks the subdirectory is skipped without cloning | `{ skipped, notes: ['Plugin "gp" is no longer installable: git-subdir path "packages/missing" does not exist in the plugin clone'], reasons: ["no longer installable"] }`, no clone. |
| 7118 | a pinned git-subdir reinstall whose cached copy lacks the subdirectory is skipped without cloning | The same complete outcome, no clone. |

Restored helpers: `MIRROR_HEAD_SHA`, `writeMirrorTree`, and
`seedUnpinnedGitRecord` (without its unused `cloneUrl` parameter), under a
rewritten MIRR-06 / D-18-04 banner. `createGitOps` gained `head` and
`fetchCalls`.

## Banners, titles, and the phase-wide sweep

- The PURL-07 banner now says the shared runner materializes the entry's sha
  through `resolvePluginPin` then `materializePluginClone`, so a warm copy is
  offline and only a cache miss clones (D-18-04).
- "a cold-cache git-source reinstall re-materializes from the entry's pinned
  sha without re-resolving the ref" (was "... from the recorded sha ..."); its
  arrange comment and checkout message now say the entry's sha. The version
  assertion message reads "the version the copy declares (unchanged here)".
- `grep -rn "D-68-02\|recorded sha" extensions test docs`, every line read:
  - `enable-disable.test.ts` ENBL-07 title: now "(BFILL-01 / D-18-06
    partial-capable stance)", matching the comment 18-04 rewrote in
    `enable-disable.ts`. Behavior unchanged.
  - `docs/competitive-analysis/pi-plugins.md` verb table: the `reinstall` row
    said it never resolves a pin and repairs from the recorded sha. It now
    reads "On cache miss only" and "Installs the version the marketplace offers
    now. Reads a present mirror's HEAD offline and does no refresh".
  - `docs/competitive-analysis/asermax-pi-cc-plugins.md`: "Our `reinstall`
    repairs from the recorded sha and never touches the network" now says it
    installs the revision our cached mirror holds and touches the network only
    on a cache miss.
  - Still true, left alone: `git-source-probe.ts` and its test (the reload
    migration probe reads the record's sha), `mcp-migration.test.ts` (a fixture
    comment), the `update-flow.test.ts` lines (update keeps a plugin on its
    recorded sha when it declines), and the cold-cache comment that notes the
    entry sha is also the recorded one.
  - No `D-68-02` remains in `extensions`, `test`, or `docs`.

## Verification

- Task 1: the reinstall-flow pair at 100% direct coverage; the whole file
  147/147; `grep -c "D-18-11"` 2; `function seedUnpinnedGitRecord` once.
  Commit hook `check:commit` passed.
- Task 2: direct coverage 100%; `GHB-03 / D-18-16: an invalid GitHub base
  fails a reinstall` once; `NEVER calls resolvePluginPin` 0;
  `npx fallow dupes --quiet --fail-on-issues` exit 0; `npx tsc --noEmit`
  clean; pre-commit fixers clean on all four files.
- Phase gate: `npm run check` exit 0 on the final tree (Node v26.12.1), run
  with exactly the files the task 2 commit stages: static checks, unpaired
  tests, integration, 718/718 cucumber scenarios, direct coverage for all
  pairs (279 records merged).

## Deviations from Plan

1. **[Rule 1 - stale docs] Two competitive-analysis lines** described the old
   reinstall (no pin resolution, repair from the recorded sha, no network).
   The plan's sweep covers `docs` and requires only true lines to remain, so
   both were rewritten. These files are not build inputs.
2. **[Rule 1 - stale title] The ENBL-07 test title in
   `enable-disable.test.ts`** cited D-68-02. 18-04 left it for this sweep; it
   now cites BFILL-01 / D-18-06, as the production comment does.
3. **`seedUnpinnedGitRecord` dropped its `cloneUrl` parameter.** The original
   accepted it but never read it.
4. **The failed-clone case asserts `plugin-clones/` is empty**, a stronger
   check than the two path probes the original made, because it also covers
   the per-commit copy directory.

## Needs the user's attention

- **Skip reason for a failed cold clone.** A reinstall whose cache-miss clone
  fails, and a seam that rejects, both render `{no longer installable}`. That
  is the shared probe's existing classification, the same row `update`
  produces, and 18-02 already raised it. The cases pin today's token.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: test/orchestrators/plugin/reinstall-flow.test.ts (contains "D-18-11" and "GHB-03 / D-18-16: an invalid GitHub base fails a reinstall")
- FOUND: 7daeebff (task 1); task 2 is the commit that adds this file

---
phase: 25-update-and-reinstall-rows
plan: 02
subsystem: plugin-list
tags: [list, upgradable, version-rule, VER-01, VER-02, PL-5]

requires:
  - phase: 20-path-source-version-and-missing-source
    provides: the one version rule on the not-installed list rows (resolveDeclaredPluginVersion)
provides:
  - resolveListCandidate, the shared offline candidate derivation for both list row kinds
  - installed list rows that decide upgradable by the derived candidate version
affects: [list, completion bucketizer (not changed)]

actuals:
  tokens: 13600
  tasks: 2
  commits: 2
plan_head_before: fd5c45c1
plan_head_after: b462eb51

tech-stack:
  added: []
  patterns:
    - "One offline derivation module (list-candidate-version.ts) shared by the candidate and installed list rows"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
    - test/orchestrators/plugin/list-candidate-version.test.ts
    - test/orchestrators/plugin/warm-mirror-seed.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - test/orchestrators/plugin/list-installed-row.test.ts
    - features/plugin/list.feature
    - features/plugin/fetch.feature
    - docs/prd/pi-claude-marketplace-prd.md

key-decisions:
  - "The installed row resolves the candidate for every enabled record that has a declared entry. The verdict reaches the classifier only when the row is upgradable, so a clean record at its candidate version stays installed"
  - "A cold git candidate or a throw folds to 'no candidate': the entry version decides, and no verdict is passed (the CR-01 degrade)"

requirements-completed: [VER-01, VER-02]

duration: 50min
completed: 2026-10-23
status: complete
---

# Phase 25 Plan 02: List upgradable by the one version rule Summary

**An installed `list` row is now `(upgradable)` only when the candidate version differs from the record. The candidate version comes from plugin.json, then the entry, then a warm git tree's `sha-` version. The not-installed rows use the same offline derivation in `list-candidate-version.ts`, so an installed path plugin at its plugin.json version no longer shows `(upgradable)` because its entry says otherwise.**

## Performance

- Duration: about 50 min
- Tasks: 2 of 2
- Files: 3 created, 7 modified

## Accomplishments

- `orchestrators/plugin/list-candidate-version.ts` exports `resolveListCandidate` and `ListCandidate`. The code moved unchanged from `list-candidate-row.ts`, which now imports it.
- `list-installed-row.ts::composeInstalledListRow` derives the candidate through `resolveListCandidate`. A throw folds to "no candidate" through `.catch`. The local `probeUpgradeCandidate` is deleted. The candidate version is the derived version, else the entry version. The row is upgradable when that version is defined and differs from `record.version`. The resolved verdict reaches the classifier and the `partially-upgradable` check only when the row is upgradable. The verdict is `undefined` for a cold git source or a throw.
- The PL-5 contract comment in `list-flow.ts`, the PL-5 row in the PRD, and the PRD's diagram label now name the derived candidate version.
- `makePresenceProbe` is called the same way as before, inside the moved code. Nothing reaches the network (NFR-5).

## Task Commits

1. Task 1: an installed path plugin at its plugin.json version lists as installed. Commit `576865a3`.
2. Task 2: installed git rows follow the same rule, and the PL-5 text says so. Commit `b462eb51`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in test setup] Four existing list scenarios expected an upgradable row that only the entry made upgradable**
- Found during: Task 1 (`npx cucumber-js features/plugin/list.feature`)
- Issue: ten scenarios in `list.feature` share one setup. It installs `alpha` at 1.0.0 and then rewrites only the manifest entry to 2.0.0, so plugin.json still says 1.0.0. Under VER-02 the candidate is 1.0.0, so four scenarios that expect `alpha` to be `upgradable` failed.
- Fix: each of the ten setups now republishes `alpha` at 2.0.0 (`the marketplace "tools" offers these plugins:` with `| alpha | 2.0.0 |`) before it rewrites the manifest. The plugin really moves, so every expected row stays the same.
- Files: `features/plugin/list.feature`
- Commit: `576865a3`

**2. [Rule 1 - Expected behavior change] A fetch scenario now lists the fetched git plugin as upgradable**
- Found during: Task 1 (full cucumber suite)
- Issue: `fetch.feature` "A fetch installs no new version, so the plugin list still shows the installed one" expected `installed` after the mirror was fetched at 2.0.0. Under VER-01 the warm tree's plugin.json version, 2.0.0, differs from the record, 1.0.0. So the row is `upgradable`, which is the behavior D-19 asks for.
- Fix: the status cell is now `upgradable`, and the title is now "... so the plugin list shows the installed one as upgradable". The version column still reads 1.0.0, and the git host still receives no request.
- Files: `features/plugin/fetch.feature`. `fetch.feature` is not in the Phase 26 fence: the fence covers `fetch.ts`.
- Commit: `576865a3`

**3. [Rule 3 - Duplication] The warm-mirror seed moved into a shared test support module**
- Found during: Task 2
- Issue: the installed-row git cases needed the same mirror seeding as the new derivation test. A second copy would be a fallow clone group.
- Fix: `test/orchestrators/plugin/warm-mirror-seed.ts` (`seedWarmMirror`, `advanceWarmMirror`) serves both test files. `list-candidate-row.test.ts` keeps its own inline seeding unchanged, as the plan asked.
- Commit: `b462eb51`

No production change was needed in Task 2. All three git behaviors passed on Task 1's code. No file owned by Phase 26 was staged.

## Observations (out of scope, not changed)

- The completion bucketizer, `orchestrators/edge-deps.ts::classifyInstalledPluginRow` (line ~125), still compares `manifestEntry.version !== installed.version`. Tab completion can therefore still offer `update` for a path plugin that `list` now shows as installed, and the reverse.
- When a git plugin's mirror moved to a new commit at the same declared version, the plugin is not marked upgradable. D-19 compares versions only, so the row stays `installed`. Only an undeclared plugin, whose version is the `sha-` form, shows the move.

## Verification

- `npm run test:coverage:direct` on `list-candidate-version.ts`, `list-candidate-row.ts`, `list-installed-row.ts`, and `list-flow.ts`: exit 0.
- `npx fallow dupes --quiet --fail-on-issues --format human`: exit 0.
- `features/plugin/list.feature`: 19 of 19 scenarios passed. Against the old `list-installed-row.ts`, the new scenario fails with `upgradable`.
- Full cucumber suite: 750 of 750 scenarios passed (inside `npm run check`).
- `npm run check` at `b462eb51`: exit 0.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-04 holds: the new module imports only `makePresenceProbe` (fs-only) and the offline resolver. It does not import a clone, fetch, or network module. ESLint BLOCK F lints it, and it is not in `NETWORK_SEAMS`. T-25-03 is accepted as planned: a throw folds to the entry version for that row only.

## Self-Check: PASSED

- `list-candidate-version.ts` and its test exist.
- `async function resolveCandidateEntry` does not appear in `list-candidate-row.ts`. `manifestEntry.version !== record.version` does not appear in `list-installed-row.ts`. `manifest.version !== installed` does not appear in `list-flow.ts`.
- Commits `576865a3` and `b462eb51` are ancestors of HEAD.

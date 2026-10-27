---
phase: 02-apply-ordering-and-installed-declarations
plan: 04
subsystem: plugin
tags: [dependencies, installed-copy, containment, NFR-10, D-PL2-12, D-PL2-13]

requires:
  - phase: 02-02
    provides: "readInstalledRecordDeclarations (dependency-index.ts), the installed-first reader re-rooted here"
provides:
  - "installedCopyOwnerRoot(record, { marketplaceRoot, pluginClonesDir }) in plugin/dependency-declaration-read.ts"
  - "InstalledCopyDeclarationReadOptions.ownerRoot (replaces ownerRoots)"
  - "manifest-candidate containment in readInstalledCopyDeclaration (D-PL2-13)"
affects: [02-05 (apply.ts reaches convergence.ts through installedCopyReader and planConvergenceCascade, whose signatures are unchanged)]

actuals:
  tokens: 7037
  tasks: 2
  commits: 2
plan_head_before: 4e53daa8bc6fb646b5b77a0a5aa97b7baf9d7112
plan_head_after: d2733f71c2ce0c5e03c1a98276de6ab161f4bd17

tech-stack:
  added: []
  patterns:
    - "One owning clone root per record, computed by one shared helper keyed on resolvedSha"
    - "The candidate walk takes an injected per-candidate reader, so the installed-copy read checks each candidate without a second walk"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - test/orchestrators/plugin/dependency-declaration-read.test.ts
    - test/orchestrators/plugin/dependency-index.test.ts
    - test/orchestrators/reconcile/convergence.test.ts

key-decisions:
  - "D-PL2-12 (amended): the owning root of an installed copy is keyed on resolvedSha (plugin-clones/ with it, the marketplace clone without it); the other root fails closed"
  - "D-PL2-13: a manifest candidate inside an installed copy that is, or sits under, a symlink is refused and ends the read as absent"

patterns-established:
  - "Every readInstalledCopyDeclaration caller passes installedCopyOwnerRoot(record, roots)"

requirements-completed: [RCN-08]

coverage:
  - id: D1
    description: "A delisted record whose copy sits under the other clone root fails closed as not in manifest (both shapes)"
    requirement: RCN-08
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-index.test.ts#D-PL2-12 / NFR-10: a delisted record with no recorded commit whose copy sits under the plugin clones fails closed"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-index.test.ts#D-PL2-12 / NFR-10: a delisted record pinned to a commit whose copy sits under the marketplace clone fails closed"
        status: pass
    human_judgment: false
  - id: D2
    description: "A tag-pinned path-source dependency under plugin-clones/ is still read"
    requirement: RCN-08
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-index.test.ts#D-PL2-12: a delisted tag-pinned path-source dependency reads its copy under the plugin clones"
        status: pass
    human_judgment: false
  - id: D3
    description: "Convergence and installedCopyReader admit only the owning root"
    requirement: RCN-08
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts#D-PL2-12 / NFR-10: a held dependent whose copy sits outside the root its record owns keeps its catalog declarations"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts#D-PL2-12: the installed-copy reader ignores a copy under the plugin clones of a record with no recorded commit"
        status: pass
    human_judgment: false
  - id: D4
    description: "A symlinked manifest inside an installed copy is refused, and each consumer reacts as stated"
    requirement: RCN-08
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-declaration-read.test.ts#D-PL2-13 cases (4)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-index.test.ts#D-PL2-13 cases (2)"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-10-27
status: complete
---

# Phase 2 Plan 04: Installed-copy containment Summary

**The installed-copy dependency read now opens a record's copy only under the one clone root that owns the record (`plugin-clones/` when it has `resolvedSha`, the marketplace clone otherwise), and it refuses a manifest reached through a symlink inside the copy.**

## Performance

- **Duration:** about 27 min
- **Started:** about 2026-10-27T05:38Z
- **Completed:** 2026-10-27T06:05Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `installedCopyOwnerRoot(record, { marketplaceRoot, pluginClonesDir })` answers `pluginClonesDir` for a record with `resolvedSha` and `marketplaceRoot` otherwise (D-PL2-12 as amended).
- `InstalledCopyDeclarationReadOptions.ownerRoots` is now `ownerRoot: string`. The any-root loop (`isInsideAnyRoot`) is replaced by one `assertPathInside(ownerRoot, pluginRoot, "installed plugin copy")` check through a private `isAdmitted` helper. A refusal answers `absent`.
- All three callers compute the root through the helper: `readInstalledCopy` and `readInstalledRecordDeclarations` in dependency-index.ts, and `installedCopyDeclarations` in convergence.ts. `installedCopyReader` (used by `apply`'s judgement) reaches the same check, because it calls `installedCopyDeclarations`.
- D-PL2-13: the installed-copy read checks each manifest candidate with `assertPathInside(pluginRoot, candidate, "installed plugin manifest")` before it opens it. A refused candidate ends the walk as `absent` (D-01-07: the first candidate that exists decides). `readOwnManifest` takes an optional per-candidate reader, so there is no second copy of the walk. `readDependencyDeclaration` and `readCandidateDeclaration` are unchanged.

## Task Commits

1. **Task 1: A record's installed copy is read only under the clone root that owns it** - `3c6fe743` (fix)
2. **Task 2: A symlinked manifest inside an installed copy is refused** - `d2733f71` (fix)

Tracer gate (Task 1): automated-only `<verify>`. It was re-run after the commit: the three owner test files gave 161 passes and 0 failures, and direct coverage passed for all three sources. No checkpoint was needed.

## RED evidence

- Task 1. On the pre-plan code:
  - the two dependency-index cross-root cases failed;
  - the two convergence cases failed (the held dependent and the installed-copy reader);
  - dependency-declaration-read.test.ts failed to load, because `installedCopyOwnerRoot` was not exported.
- Task 2. On Task 1's code:
  - three of the four dependency-declaration-read symlink cases failed (the regular-file case passes on both);
  - both dependency-index consequence cases failed.

## Files Created/Modified

- `orchestrators/plugin/dependency-declaration-read.ts`:
  - `installedCopyOwnerRoot` and the `ownerRoot` option;
  - `isAdmitted` (replaces `isInsideAnyRoot`) and `readContainedCandidate`;
  - `readOwnManifest(reader, pluginRoot, readCandidate?)`;
  - JSDoc for D-PL2-12 and D-PL2-13.
- `orchestrators/plugin/dependency-index.ts`: `readInstalledCopy` and `readInstalledRecordDeclarations` pass `installedCopyOwnerRoot(...)`. The DLS-01 comment now says "the one clone root that owns the record".
- `orchestrators/reconcile/convergence.ts`: only `installedCopyDeclarations` and its import changed.
- Tests:
  - dependency-declaration-read.test.ts: 2 helper cases, 1 other-root case, 4 symlink cases. The helper now passes `ownerRoot`.
  - dependency-index.test.ts:
    - 3 cross-root and tag-pinned cases, and 2 symlink consequence cases;
    - the DLS-01 git-record case gained `resolvedSha` (RESEARCH Pitfall 6);
    - the `APP_CLONE` constants moved above that case so it can use them.
  - convergence.test.ts: 2 new cases. The APPLY1-01 installed-copy reader case's pinned record gained `resolvedSha`.

## Decisions Made

See `## Decision rows`.

## Deviations from Plan

None. The plan was executed as written. Two small test-side choices are noted here:

- **Test fixture: the convergence APPLY1-01 case.** "the installed-copy reader reads a pinned copy and leaves a path source to the catalog" built its pinned record without `resolvedSha`. Under D-PL2-12 such a record owns the marketplace clone, so the case gained `resolvedSha`. This is the same kind of fix as the DLS-01 fixture the plan names (Pitfall 6).
- **Test clones root in dependency-declaration-read.test.ts.** `locationsFor("project", MARKETPLACE_ROOT).pluginClonesDir` sits under `MARKETPLACE_ROOT`, so it cannot act as "the other root". The cases use a sibling `CLONES_ROOT` in the temp dir instead.

## Issues Encountered

None.

Checks run:
- owner tests: 167 passes, 0 failures;
- neighboring suites (marketplace remove, constraint-fold, enable-disable, all reconcile, update-constraint-gate, uninstall, prune, update-flow, install-flow): 1794 passes, 0 failures;
- `npm run test:coverage:direct` exits 0 for dependency-declaration-read.ts, dependency-index.ts and convergence.ts;
- `tsc --noEmit` passes;
- ESLint passes on the six files;
- `npm run fallow` exits 0;
- `SKIP=npm-check pre-commit run --files` is clean, and both commit hooks passed.

The full `npm run check` was not run; the wave gate runs it.

## Proof scope (unit only)

D-PL2-12 and D-PL2-13 are proven by unit cases only. No cucumber scenario was added, for this harness reason:
- The behavior changes only for a delisted or tampered copy whose recorded root points into the other clone tree, or whose manifest is a symlink.
- Such a copy is reachable only by hand-editing a scope's `state.json`, or by a delisted git plugin that ships a symlinked manifest.
- No cucumber stand-in publishes either.

This follows the TST-01 unit-only precedent.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-02-07 is mitigated: one owning root per record, from `installedCopyOwnerRoot`, checked with `assertPathInside`. A copy outside it is never opened.
- T-02-08 is mitigated: each candidate passes `assertPathInside(pluginRoot, candidate)` before `stat` and `readFile`.

## CHANGELOG line

- The dependency read of an installed plugin no longer opens a copy outside the folder that owns it, or a manifest reached through a link inside the copy.

## Decision rows

| ID | Decision | Rationale |
|----|----------|-----------|
| D-PL2-12 (amended) | An installed copy is read only inside the one clone root that owns its record. A record with `resolvedSha` (every git-source record since 0.9.0, and a tag-pinned path-source dependency) owns `plugin-clones/`. A record without it owns the marketplace clone. The other root fails closed. The key is `resolvedSha`, not a source kind, because records carry no source-kind field. The whole `plugin-clones/` is the narrowest root, because a delisted git record no longer has the catalog source its clone key hashes. | NFR-10 as re-anchored by url-source: plugin roots resolve inside their owning clone root. |
| D-PL2-13 | A manifest candidate inside an installed copy that is a symlink, or sits under one, is refused, and the read answers `absent`. This is stricter than Claude Code, which follows a manifest symlink whose real path stays inside the plugin directory (E5). Reversed 2026-10-27 by user decision: a manifest link (chained, absolute or relative text, on the manifest or a directory above it) whose resolved target stays inside the record's owning root (D-PL2-12) is followed, and the read opens that resolved target; an escaping link is refused as D-PL2-17. | Licensed by NFR-10. The project's containment check (`assertPathInside`, D-14) refuses every symlink segment. |
| D-PL2-17 | A manifest link whose resolved target leaves the record's owning root, or that cannot be resolved (a loop), answers `unusable`, the D-05-07 fixed-detail refusal, and ends the candidate walk. The installed-first reader fails closed with no catalog fallback; a delisted record's catalog-first read fails as `unreadable manifest`; convergence's fold is unchanged. A dangling link stays absence, and the copy-root refusal (D-PL2-12) still answers absent. | User decision 2026-10-27. D-05-07: a manifest that exists but cannot be used fails closed. Parity with Claude Code, whose load fails on an escaping manifest (E5 refined). |

## Backlog dispositions

- **LCORCH-01 b6:** fixed (D-PL2-12 as amended, D-PL2-13).

## Uncertain choices (for user review)

1. **A refused manifest answers `absent`, not a fail-closed refusal.** This keeps the module's NFR-10 read rule: a containment refusal in a read means "no root" (`derivePathPluginRoot`). The result depends on the caller:
   - the delisted walk fails closed (`not in manifest`);
   - the installed-first reader falls back to the catalog read;
   - convergence ignores the copy.

   The alternative was to answer `unusable` (the D-05-07 refusal). That would fail the installed-first reader closed instead of falling back to the catalog.

   Resolved 2026-10-27 by user decision (D-PL2-17): a refused manifest answers `unusable`, and the installed-first reader fails closed.
2. **D-PL2-12 and D-PL2-13 are proven by unit cases only.** See "Proof scope" for the harness reason. The manifest-link behavior is now covered by two `features/plugin/enable.feature` scenarios, "Enabling a git-source plugin follows a manifest that its installed copy links inside the copy" and "Enabling a git-source plugin whose installed manifest links outside its owning clone root fails as unreadable", whose fixture publishes the link in the plugin repository; D-PL2-12's cross-root refusal stays unit-only.
3. **D-PL2-13 refuses even a symlink that stays inside the plugin.** Claude Code accepts such a link (E5); this read is stricter, as decided. Resolved 2026-10-27 by user decision: D-PL2-13 is reversed; a link whose resolved target stays inside the owning root is followed.

## Next Phase Readiness

02-05 is unaffected: `installedCopyReader` and `planConvergenceCascade` keep their signatures. The wave gate runs `npm run check` on the combined tree.

## Self-Check: PASSED

- FOUND: all 6 modified files
- FOUND: `3c6fe743`, `d2733f71` (ancestors of HEAD)
- Commits measured: `git rev-list --count 4e53daa8..HEAD` = 2

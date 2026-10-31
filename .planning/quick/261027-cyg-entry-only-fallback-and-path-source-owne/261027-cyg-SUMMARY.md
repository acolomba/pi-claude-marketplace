---
quick_id: 261027-cyg
phase: quick-261027-cyg
plan: 01
status: complete
subsystem: plugin dependency declarations (installed-copy read)
tags: [dependencies, enable, update, containment, parity]
requirements: [RCN-05, RCN-08]
requires:
  - 261027-a3r (install-time manifest link containment, D-PL2-17 boundary, D-PL2-25)
provides:
  - D-PL2-22 entry-alone answer for a pinned record whose installed copy has no manifest or is gone
  - D-PL2-23 owning root chosen by resolvedSha plus where resolvedSource lies
affects:
  - enable closure (enableCascadeLookup)
  - update preflight holder walk (REAL_UPDATE_CONSTRAINT_SEAM)
  - delisted catalog-first read (DLS-01) and convergence installed-copy read
tech-stack:
  added: []
  patterns: [one owning root per record, lexical under-root test shared with clone GC]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
    - test/orchestrators/plugin/dependency-index.test.ts
    - test/orchestrators/plugin/dependency-declaration-read.test.ts
    - test/orchestrators/reconcile/convergence.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - features/lib/git-plugin.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - features/plugin/enable.feature
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-02-SUMMARY.md
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-04-SUMMARY.md
decisions:
  - "D-PL2-22: a pinned record whose installed copy holds no manifest, or is gone, declares its marketplace entry's dependencies alone; delisted keeps not in manifest (D-05-07); no resolvedSha keeps D-PL2-07"
  - "D-PL2-23 (amends D-PL2-12): plugin-clones/ owns a record only when it has resolvedSha and its resolvedSource lies under plugin-clones/; every other record owns its marketplace clone"
metrics:
  completed: 2026-10-27
  tasks: 3
  files: 12
actuals:
  tokens: 12800
  tasks: 3
  commits: 3
plan_head_before: fbb26593
plan_head_after: 61bbe422eb8f20c156b4e66c1bc30fbf84d2afe1
---

# Quick 261027-cyg: Entry-only fallback and path-source owning root Summary

A pinned record whose installed copy has no `plugin.json`, or is gone, now declares its marketplace entry's dependencies alone (D-PL2-22, E2 parity). A record's owning root now follows where its copy lies (D-PL2-23). Because of that, a legacy path record with a stale `resolvedSha` is read in its marketplace clone again and no longer blocks its whole scope.

## Commits

BASE named in the plan: `ee8911d5`. HEAD before execution: `fbb26593` (the plan commit, docs only).

| Task | Commit | Subject |
|------|--------|---------|
| 1 (tracer) | `ef62007f` | fix(plugin): answer a manifest-less installed copy from its entry |
| 2 | `9291f38c` | fix(plugin): read a path record's copy in its marketplace clone |
| 3 | `61bbe422` | docs(plugin): record the entry-only and owning-root decisions |

All three landed through the pre-commit hook. The hook ran `npm run check:commit` for the two code commits and passed.

## RED evidence

**Task 1, on BASE source** (the tests were written first, then run before the source edit):

- U1 "D-PL2-22: an installed copy that holds no manifest answers its marketplace entry alone, not the catalog copy's manifest": `not ok`. Output: `+ name: 'kit'` / `- name: 'lib'` (the catalog copy's manifest answered).
- U2 "D-PL2-22: an installed copy that is gone answers its marketplace entry alone on real disk": `not ok`, with the same `kit` vs `lib` diff.
- U3 (invalid entry declaration -> `invalid manifest`) and U4 (delisted, no manifest -> `not in manifest`) passed on BASE. They pin behavior that stays the same.
- S1 `features/plugin/enable.feature:238` on BASE: `Then the result lists these plugins` failed. The actual rows had `kit@tools ... 1.0.0` where the scenario expects `lib@tools ... 1.2.0`, because the closure read the fetched mirror's revision-2 manifest. Run: `1 scenario (1 failed)`, `22 steps (20 passed, 1 skipped, 1 failed)`.

**Task 2, on Task 1's tree** (`ef62007f`), before the source edit: 8 of 498 failed.

- R1 "D-PL2-23: a record pinned to a commit whose copy lies in its marketplace clone is read in place, owned by that clone": `not ok`. On this tree the copy is owned by `/clones`.
- L1 "D-PL2-23: a delisted record pinned to a commit whose copy sits under the marketplace clone reads that copy in place": `not ok` (unreadable manifest).
- L2 "D-PL2-23 / WR-01: the installed detail walk reads a path record left with a stale commit in its marketplace clone", and its D-PL2-22 variant "... answers a stale-commit path record with no manifest from its entry": both `not ok` (`APP_UNREADABLE_MANIFEST`).
- C2 "D-PL2-23: a dependent left pinned to a stale commit with its copy in the marketplace clone is judged by that copy": `not ok` (fails closed).
- W1 "WR-01: a successful path-source swap drops a stale resolvedSha ...": `not ok`. `DependencyDeclarationsUnreadableError: cannot read the dependencies of hello@mp: its own manifest is present but cannot be read`, thrown from `evaluateCatalogConstraint` by way of `preparePluginUpdate`.
- W2 UPR-02 and UPR-03: `not ok` with the same unreadable error once the three a3r lines were removed. Both pass after the source change, so their fixtures stay as they were.
- R2, R3, L3 and C1 passed on Task 1's tree, as planned.

## Upstream finding (claude-code-compat-research evidence record)

- **Question.** What does Claude Code read as an installed plugin's dependencies when its installed copy has no `plugin.json`, or when the copy is gone? And how does it admit a recorded install path?
- **Evidence.** Binary 2.1.310 (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`), grepped 2026-10-27.
  - `VJ` (read manifest) walks the candidates. When none exists, it returns `{manifest: {name, description: "Plugin from …"}, manifestPath: null, depConstraints: undefined}`, a stub with no `dependencies`.
  - `q9n` (load one plugin from its install path) calls `$le` → `VJ`. Then `if (!hasManifest) { … Qme(entry, "marketplace-entry", …); we.manifest = je.manifest … }`, so the marketplace entry becomes the whole manifest, `dependencies` included. With a manifest present, the entry adds display fields only.
  - The enable closure (`smn`) and update's dependents scan (`Y`/`r3s`) read `manifest.dependencies` of the loaded plugins (E2, unchanged).
  - `z9n` (load from an install record), git source: it uses the versioned cache dir when present, else the seed cache. Otherwise it downloads again, first at the installed commit, else from the source the marketplace lists. A failed download pushes `Failed to download/cache plugin …`, and the plugin does not load.
  - A delisted plugin is not loaded at all (E5, `plugin-not-found`). The install path is checked textually against the cache, seed and marketplace-source roots (E5).
- **Confidence.** High for the no-manifest arm (one explicit branch). High that a gone copy is downloaded again before it is read.
- **Consequences.** The no-manifest arm of D-PL2-22 matches upstream exactly. The gone-copy arm cannot: the read is offline (NFR-5), so the entry stands in for the download. A delisted record keeps `not in manifest`. Claude Code's textual root check supports a rule keyed on where the copy lies (D-PL2-23).

## Proof scope

D-PL2-23 is proven by unit cases only (R1-R3, L1-L3, C1, C2, W1), with no scenario. No supported command writes the legacy shape:

- every pinned path install materializes under `plugin-clones/` (`materializeMarketplaceTagClone`);
- update, reinstall and the disabled-record refresh clear a stale sha (WR-01);
- enable materializes again at the recorded pin.

Only a `state.json` that an older version wrote, or a hand edit, holds the shape. The harness drives the public surface and has no step that writes installation records (the 02-04 / TST-01 unit-only precedent). D-PL2-22 has both unit cases (U1-U4) and the scenario S1.

## Neighbor-suite cases changed under the executor rules

None outside the files the plan names. Inside the named files:

- `test/orchestrators/reconcile/convergence.test.ts`: C1 now uses a copy under neither clone root, and C2 is new.
- `test/orchestrators/plugin/update-swap.test.ts`: the three a3r lines are removed from WR-01, UPR-02 and UPR-03 (W1, W2). UPR-02 and UPR-03 pass with their original fixtures.

The Task 1 neighbor suites (enable-disable, update-constraint-gate, update-preflight, update-swap: 547 cases) and the fetch, git-source and update-dependencies features passed unchanged after Task 1.

## Deviations from Plan

### Auto-fixed Issues

None. The plan ran as written, with these small implementation choices:

1. **`liesUnder` tests the whole relative path, not its first segment.** `relative !== "" && !relative.startsWith("..")` is the same test as clone GC's `split(path.sep)[0]` check: the first segment is empty only when the relative path is empty, and it starts with `..` exactly when the relative path does. Written this way, there is no `?? ""` branch for the compiler to force, so direct coverage stays at 100%.
2. **`gitPluginEntry` builds its `source` in a new local helper `gitPluginSource`.** This keeps the optional `dependencies` spread in one return, not repeated in three switch arms.
3. **C1 also stages a readable manifest at the foreign copy.** If an implementation read that copy, it would get an answer, so the case proves the refusal itself and not just a missing file.
4. **L2's optional second variant was added.** A stale-sha path record whose in-place copy has no manifest answers `entry@mp` through D-PL2-22.

## Final check record

- Command: `npm run check > /var/tmp/261027-cyg-check.log 2>&1; echo "exit=$?"` (unpiped, foreground)
- Exit status: `exit=0`
- HEAD: `61bbe422eb8f20c156b4e66c1bc30fbf84d2afe1`
- `node --version`: `v26.12.1`
- Log tail:

```text
passed lint (10.9 s)
passed lint:workflows (0.9 s)
passed fallow (16.1 s)
passed format:check (17.4 s)
passed test:corresponding (10.8 s)
passed check:features (9.8 s)
917 scenarios (917 passed)
9255 steps (9255 passed)
Merged LCOV: coverage/direct.lcov (292 records)
```

The record gates in Task 3 printed `gates=ok`. `git diff --numstat ee8911d5` shows 61 added and 0 deleted lines for 02-CONTEXT.md.

## Decision rows

| ID | Decision | Rationale |
|----|----------|-----------|
| D-PL2-22 | `readInstalledRecordDeclarations`: a record with `resolvedSha` whose copy answers `absent` (no manifest, or gone) declares its marketplace entry's `dependencies` alone. A delisted record fails `not in manifest` (D-05-07). A record without `resolvedSha` keeps the catalog read (D-PL2-07). Amends the gone-copy clause of D-PL2-06 | E2 refined: Claude Code makes the entry the whole manifest of a copy with no `plugin.json`. A gone copy is downloaded again upstream, which this offline read cannot do (NFR-5), so the entry is the offline stand-in |
| D-PL2-23 | `installedCopyReadOptions`: `plugin-clones/` owns a record (plugin-directory boundary) only when it has `resolvedSha` and `resolvedSource` lies lexically under `plugin-clones/`. Every other record owns its marketplace clone (in-place boundary). Amends D-PL2-12 | Records carry no source kind. Where the copy lies is the evidence, as clone GC already uses it. Removes the regression in which one legacy stale-sha path record failed its whole scope `{unreadable}` (261027-a3r uncertain choice 1). Claude Code checks install paths textually against its roots (E5) |

## Uncertain choices (for user review)

1. **The step "the git repository … holds these plugins with no manifest:" still takes a `version` column.** It reuses `readRepositoryPlugins`. The version shows up only in the plugin's skill text, because no manifest is written. A narrower `| name | path |` table would need its own parser.
2. **S1 offers `app` as an unpinned `url` source.** The plan allowed `url` or `github`. `url` matches the neighbouring enable scenarios. The fetch step that moves the mirror to revision 2 works the same for both kinds.
3. **`notInManifest` is a module-private helper in `dependency-index.ts`.** The fixed phrase now lives in one place. The catalog read and the installed-first read both call it.

## Open points for the user

1. **The gone-copy arm of D-PL2-22 (orchestrator decision: keep the entry-alone answer).** Claude Code downloads a gone copy again and reads its `plugin.json`. This offline read answers the entry instead (NFR-5), and D-PL2-22 records the difference. The alternative is to keep the catalog read for a gone copy only. That would need `readInstalledCopyDeclaration` to tell a gone copy from one with no manifest.
2. **An edited git record (orchestrator decision: accepted).** A git record whose `resolvedSource` was edited to point into its own marketplace clone is now read there in place, still bounded by that clone (D-PL2-23's accepted consequence, recorded in 02-CONTEXT.md).
3. **Follow-up, observed but not changed: enabling the legacy stale-sha record itself.** It materializes the record again at its stale pin (GIT-01 `recordedSourcePin`), which fails for a marketplace that is not a git checkout. Running an update first repairs the record (WR-01). A fix would teach the enable ledger to drop a pin whose `resolvedSource` lies outside `plugin-clones/`, the same test D-PL2-23 uses.

## Suggested CHANGELOG line (not written to CHANGELOG.md)

- `enable` and `update` now read the dependencies of an installed git plugin that has no `plugin.json` from its marketplace entry, as Claude Code does. A path plugin installed by an older version no longer makes every update and enable in its scope fail as unreadable.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The mitigations are in place:

- T-cyg-01: the marketplace-clone read stays inside the record's own marketplace clone, under the D-PL2-17 in-place boundary. `copyRootAdmitted` is unchanged, and cases R3, L3 and C1 show that a copy under neither root still answers `unusable`.
- T-cyg-03: an `unusable` copy still fails closed, and a delisted absent copy stays `not in manifest` (U4).
- T-cyg-04: only the existing fixed phrases are used.

## Self-Check: PASSED

- Files: every key file listed above exists. `features/plugin/enable.feature` has 13 scenarios.
- Commits `ef62007f`, `9291f38c` and `61bbe422` are ancestors of HEAD.
- Greps: `D-PL2-22` in dependency-index.ts: 2. `falls back to the catalog read` in dependency-index.test.ts: 0. `slightly broader`: 0. `D-PL2-23` in dependency-declaration-read.ts: 2. The update-swap a3r comment: 0.

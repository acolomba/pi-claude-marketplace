---
phase: 111-workflows-bridge
plan: 01
subsystem: persistence
tags: [workflows, paths, containment, symlink-refusal, node-test, hermetic-home]

# Dependency graph
requires:
  - phase: 110-domain-and-platform-modules
    provides: "`platform/workflow-home.ts::workflowHomeDir` and `domain/workflow-project-key.ts::workflowProjectKey`, the two seams `locationsFor` now reads"
provides:
  - "`workflowsHomeDir`, `workflowsSavedDir` and `workflowsStagingDir` on `ScopedLocations`"
  - "`workflowArtifactPath(generatedName)` -- the sole sanctioned composer of a workflow artifact leaf, async"
  - "`WorkflowTargetOccupiedError`, the typed WR-06 occupancy refusal carrying a readonly `targetPath`"
  - "A hermetic `$HOME` relocation helper local to `tests/persistence/locations.test.ts`"
affects: [111-02, 111-03, workflows-bridge, install-lifecycle]

actuals:
  tokens: 7155
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Relocate `$HOME` before constructing a locations bundle, never after: the factory evaluates the workflow home eagerly and freezes it"
    - "A new writable root reaches `assertPathInside` as a boundary argument; the checker is never widened"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - tests/persistence/locations.test.ts
    - extensions/pi-claude-marketplace/shared/errors-bridges.ts
    - tests/shared/errors-bridges.test.ts
    - tests/orchestrators/marketplace/add.test.ts

key-decisions:
  - "WPTH-03 is read as split: the derivation half closed in the preceding phase with a literal parity table, and this plan owes only the composition half. No second parity table was written."
  - "The WPTH-02 writing-half case passes a distinct temp directory as the `cwd` ARGUMENT rather than relocating `process.cwd()`. Nothing in the call graph reads the process global, so mutating it would prove nothing about the input the code consumes."
  - "The two `path.basename` failure injectors in the marketplace-add owner test were scoped to the config path rather than moving `locationsFor` inside `addMarketplace`'s try block. The normalizer was never broken; only the test's injection point moved."
  - "`workflowArtifactPath` is async. Every call site awaits it."

patterns-established:
  - "Hermetic `$HOME`: save, register `t.after()`, then mutate; delete an absent variable rather than reassigning it; return the new home so the caller never re-reads the global"
  - "Cross-configuration invariant over restatement: two bundles under one `HOME` with differing `PI_CODING_AGENT_DIR` and differing project directories pin the staging location, where an adjacency assertion would only restate the composer"
  - "A process-global failure injector discriminates on its argument and delegates every other call to the captured original"

requirements-completed: [WPTH-01, WPTH-03, WPTH-04, WPTH-05]

coverage:
  - id: D1
    description: "`ScopedLocations` carries `workflowsHomeDir`, `workflowsSavedDir` and `workflowsStagingDir`, all `$HOME`-derived, with the saved directory the only member that branches on scope"
    requirement: "WPTH-01"
    verification:
      - kind: unit
        ref: "tests/persistence/locations.test.ts#derives every user-scope workflows path from the home directory"
        status: pass
      - kind: unit
        ref: "tests/persistence/locations.test.ts#WPTH-01 branches only the saved directory on scope"
        status: pass
    human_judgment: false
  - id: D2
    description: "`workflowArtifactPath` composes a contained `.json` leaf under the saved directory and refuses an empty, whitespace-only, dot, double-dot, separator-bearing or control-character name before any path is composed"
    requirement: "WPTH-04"
    verification:
      - kind: unit
        ref: "tests/persistence/locations.test.ts#composes a workflow artifact path from a safe generated name"
        status: pass
      - kind: unit
        ref: "tests/persistence/locations.test.ts#rejects {an empty|a whitespace-only|the current-directory|the parent-directory|a forward slash|a backslash|an ASCII control character} ... before composing any path"
        status: pass
      - kind: unit
        ref: "tests/persistence/locations.test.ts#refuses a symbolic link planted at the composed artifact path"
        status: pass
    human_judgment: false
  - id: D3
    description: "The staging directory is byte-identical across two bundles built under one `HOME` with differing `PI_CODING_AGENT_DIR` and differing project directories, and is inside neither bundle's scope root nor extension root"
    requirement: "WPTH-05"
    verification:
      - kind: unit
        ref: "tests/persistence/locations.test.ts#WPTH-05 keeps the staging directory outside every scope and extension root"
        status: pass
      - kind: unit
        ref: "tests/persistence/locations.test.ts#keeps the staging directory adjacent to the saved directory"
        status: pass
    human_judgment: false
  - id: D4
    description: "The saved directory is rooted under the home directory and is never the deprecated `<cwd>/.pi/workflows/saved`"
    requirement: "WPTH-03"
    verification:
      - kind: unit
        ref: "tests/persistence/locations.test.ts#WPTH-02 roots the saved directory under the home and never under the project"
        status: pass
    human_judgment: false
  - id: D5
    description: "`WorkflowTargetOccupiedError` exposes a readonly `targetPath` and its own `name`, on a two-rung prototype chain"
    verification:
      - kind: unit
        ref: "tests/shared/errors-bridges.test.ts#exposes the complete occupied-target refusal"
        status: pass
      - kind: unit
        ref: "tests/shared/errors-bridges.test.ts#keeps adjacent target paths distinct"
        status: pass
      - kind: unit
        ref: "tests/shared/errors-bridges.test.ts#exposes the target path as a field rather than as message text to parse"
        status: pass
    human_judgment: false

duration: 35 min
completed: 2026-09-05
status: complete
---

# Phase 111 Plan 01: Workflow path layer Summary

**`ScopedLocations` gained the three `$HOME`-derived workflows roots and the async `workflowArtifactPath` chokepoint, plus the typed `WorkflowTargetOccupiedError`, each pinned by its owner test at 100% direct coverage.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-05T09:21:46Z
- **Completed:** 2026-09-05T09:57:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- The first writable root outside every scope root: `~/.pi/workflows/`, reached through the platform seam and joined nowhere else.
- `workflowArtifactPath(generatedName)` runs `assertSafeName`, then `path.join`, then `assertPathInside` against the saved directory. The owner test asserts the happy composition, seven refusal classes and a planted leaf symlink, each by class and structured field rather than by message substring.
- The WPTH-05 staging invariant is proved by cross-configuration comparison, not by restating the composer: two bundles under one `HOME` with differing `PI_CODING_AGENT_DIR` values and differing project directories return one staging path that is inside neither bundle's scope root nor extension root.
- `WorkflowTargetOccupiedError` carries its path as data, so the staging commit's consumer narrows on the class instead of parsing the message.
- A latent coupling in the marketplace-add owner test was found and closed at the introducing commit.

## Task Commits

1. **Deviation fix (Task 1): scope the add basename throw to the config path** - `06e3c88d` (test)
2. **Task 1: the workflow storage paths and the artifact composer** - `de192221` (feat)
3. **Task 2: the typed occupancy refusal** - `c7939ad4` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/persistence/locations.ts` - three readonly workflows members plus the `workflowArtifactPath` method; ported verbatim, purely additive (0 lines removed)
- `tests/persistence/locations.test.ts` - `LOCATION_KEYS` extended to 31 entries, a local hermetic-`HOME` helper, a temp-directory helper, a containment predicate, and 14 new cases
- `extensions/pi-claude-marketplace/shared/errors-bridges.ts` - `WorkflowTargetOccupiedError` appended (18 lines, 0 removed)
- `tests/shared/errors-bridges.test.ts` - the three-case `WorkflowTargetOccupiedError` block
- `tests/orchestrators/marketplace/add.test.ts` - two failure injectors scoped to the config path (deviation, see below)

## The tracer's red, as observed

After the path-scoped checkout of `locations.ts` and **before** `LOCATION_KEYS` was edited:

```
ℹ tests 11
ℹ pass 9
ℹ fail 2
```

Both failures were `assert.deepStrictEqual(Object.keys(locations), LOCATION_KEYS)`, in
`returns the complete frozen user location bundle and restores the agent directory` and
`returns the complete frozen project location bundle`. The diff listed `workflowsHomeDir`,
`workflowsSavedDir`, `workflowsStagingDir` and `workflowArtifactPath` in `actual` and not in
`expected`. That matches the measured prediction exactly, and it is the proof that the exhaustive
key list is load-bearing rather than decorative.

After the extension: **25 tests, 25 pass, 0 fail.**

## The 31-entry `LOCATION_KEYS` order, as landed

```
scope, scopeRoot, extensionRoot, stateJsonPath, stateLockFile, agentsDir,
agentsStagingDir, agentsIndexPath, mcpJsonPath, configJsonPath,
configLocalJsonPath, skillsStagingDir, commandsStagingDir, skillsTargetDir,
promptsTargetDir, dataRoot, sourcesDir, pluginClonesDir, hooksDir, cacheDir,
marketplaceNamesCacheFile, workflowsHomeDir, workflowsSavedDir,
workflowsStagingDir, pluginDataDir, marketplaceDataDir, sourceCloneDir,
pluginCloneDir, sourcesStagingDir, pluginCacheFile, workflowArtifactPath
```

The three fields sit after `marketplaceNamesCacheFile` and the method is last, as measured.
`fixedLocationBundle()` was left untouched -- its diff against the previous commit is empty.

## Decisions Made

**The WPTH-03 reading.** The flagged planner assumption is confirmed as written. WPTH-03's
derivation half closed in the preceding phase, with a mutation-sensitive parity table of transcribed
literal keys in `tests/domain/workflow-project-key.test.ts`. This plan consumed that derivation
through `locationsFor`'s project arm and owes only the *composition* half: that the derived key lands
as the middle segment of `workflowsSavedDir` and nowhere else. The composition case obtains the key
by calling `workflowProjectKey(cwd)` and asserts where it lands; no second parity table was written,
because duplicating those literals would give the derivation two sources of truth. **WPTH-03 should
be read as split across the two phases, not re-proved here.**

**WPTH-02's carry-forward now closes on its writing half.** The preceding phase pinned that
`workflowHomeDir()` is home-derived. This plan closes the writing half: `workflowsSavedDir` is never
`<cwd>/.pi/workflows/saved`. The case makes that observable rather than incidentally true by using a
project directory distinct from the relocated home -- with one directory serving as both, the
assertion would pass just as happily for a project-derived implementation.

**Admitting a new writable root needed no change to `shared/path-safety.ts`.** `assertPathInside`
is parameterised on its boundary and holds no registry of roots, so `workflowsSavedDir` reaches it
as an argument and containment for every existing caller is untouched. Nothing was loosened.

**Note for the staging plan: `workflowArtifactPath` is async** (`Promise<string>`, because
`assertPathInside` lstats every segment). Every call site in `bridges/workflows/stage.ts` and its
siblings must `await` it. A forgotten `await` yields a `Promise` where a path string is expected,
which `path.join` would stringify into a leaf named `[object Promise]` rather than throwing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The port broke two cases in the marketplace-add owner test**

- **Found during:** Task 1, at the full-suite gate (`npm test` reported 5315/5317).
- **Issue:** `tests/orchestrators/marketplace/add.test.ts:1451` and `:1494` replaced `path.basename`
  process-wide with an unconditional throw, as a failure injector aimed at the
  `path.basename(targetConfigPath)` call inside `runAddInGuard`. The port makes `locationsFor` call
  `path.basename` too, via `workflowProjectKey`, and `addMarketplace` calls `locationsFor` on the
  line *before* its try block. The injected throw therefore escaped `addMarketplace` entirely and
  the unknown-throw normalizer under test never ran.
- **Fix:** Scoped both injectors to `locations.configJsonPath` and delegated every other call to the
  captured original, matching the discriminating `path.dirname` injector already present at
  `:682` in the same file. Moving `locationsFor` inside the try was rejected: the normalizer was
  never broken, only the test's injection point moved, and `locationsFor` cannot throw in production
  (pure path joins over a basename that never throws). Changing an orchestrator's error contract to
  accommodate a test would have been the wrong repair.
- **Files modified:** `tests/orchestrators/marketplace/add.test.ts`
- **Verification:** The file was run green at 57/57 both with the ported `locations.ts` and with
  `HEAD`'s, so the repair is independent of the port and the commit stands on its own.
- **Committed in:** `06e3c88d`, deliberately a **separate commit placed before** the Task 1 commit.
  That ordering is what lets the Task 1 commit contain exactly its two planned paths and still leave
  the suite green, satisfying both of the plan's verification clauses instead of trading one for the
  other.

### Test-design deviations

**2. The WPTH-02 case passes a distinct `cwd` argument instead of relocating `process.cwd()`**

- **Plan text:** "Point the process cwd at a temp directory DISTINCT from the temp home, saving and
  restoring the cwd inside the same `t.after()`."
- **What was done:** a temp directory distinct from the temp home is passed as the `cwd`
  **argument** to `locationsFor`; `process.cwd()` is not mutated.
- **Why:** nothing in `locationsFor`'s call graph reads `process.cwd()` -- `cwd` is a parameter, and
  `workflowProjectKey` receives it explicitly. Relocating the process global would mutate a value the
  production code never reads, so the case would pass for a `process.cwd()`-derived implementation
  too. The plan's stated intent (two distinct directories, so the home derivation is observable) is
  preserved and, on the input the code actually consumes, strengthened. One fewer process global is
  mutated as a side benefit.

---

**Total deviations:** 1 auto-fixed (1 bug) plus 1 test-design deviation.
**Impact on plan:** the bug fix was mandatory -- the port introduced the breakage and the plan
requires a green `npm test`. Both deviations are confined to test code; no production behavior
departs from the plan. No scope creep: the two ported production bodies landed whole and unedited.

## Issues Encountered

An early isolation check ran `node --test --test-name-pattern='opaque add failure'`, which reported
`pass 1` and appeared to clear the failure. The pattern is the *thrown string*, not the test title,
so it matched nothing and the single reported pass was the file itself. The failure is fully
deterministic. Recorded because the same false clear is easy to repeat: a `--test-name-pattern` run
that matches no case still reports a passing file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The path layer 111-02 and 111-03 build on is landed and green. `workflowArtifactPath` is the sole
  composer; the bridge must route through it and must not join a name onto the saved directory.
- `WorkflowTargetOccupiedError` is available for `commitPreparedWorkflows`'s `assertTargetsUnoccupied`.
- The `bridges-workflows` zone is **not** yet in `.fallowrc.json`, by design -- it lands with the
  bridge files in 111-02. `npm run fallow` will fail loudly with a `Boundary coverage` section until
  it does.
- Full gate chain green at `c7939ad4`: `typecheck` 0 errors, `lint`, `format:check`, `fallow`, both
  corresponding-test gates, the direct-coverage negative control, `npm test` 5320/5320 and
  `npm run test:integration` 32/32. Both extended pairs report `hit === found` on branches,
  functions and lines.
- The five kind-inversion files were checked clean at every commit boundary.

## Self-Check: PASSED

- All five modified files exist on disk.
- All three commit hashes (`06e3c88d`, `de192221`, `c7939ad4`) resolve in `git log --all`.
- Each of the two task commits contains exactly its two planned paths and nothing else.
- No stub, TODO, FIXME, placeholder, `test.skip`, `test.todo` or `test.only` in any changed file.
- No coverage exception, `fallow-ignore` marker or test-only production seam was added.

---
*Phase: 111-workflows-bridge*
*Completed: 2026-09-05*

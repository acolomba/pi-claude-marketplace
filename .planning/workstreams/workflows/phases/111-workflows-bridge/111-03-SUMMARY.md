---
phase: 111-workflows-bridge
plan: 03
subsystem: bridges
tags: [workflows, staging, rename, rollback, barrel, coverage]

requires:
  - phase: 111-01
    provides: "`locations.workflowsHomeDir` / `workflowsSavedDir` / `workflowsStagingDir` and the async `workflowArtifactPath` composer, plus `WorkflowTargetOccupiedError`"
  - phase: 111-02
    provides: "`bridges/workflows/{types,discover,unstage}.ts`, the `bridges-workflows` fallow zone, and the criterion-4 stem-fallback warning row"
  - phase: 110
    provides: "`domain/workflow-script.ts` (`assertNoWorkflowNameCollisions`, the verdict union) and `platform/workflow-home.ts`"
provides:
  - "`prepareStageWorkflows` -- discovery, collision assert, materialization gate, staging root, per-file envelope write"
  - "`commitPreparedWorkflows` -- displacement, occupancy refusal, the single rename crossing, and both rollback loops"
  - "`abortPreparedWorkflows` -- staging teardown for both prepared arms"
  - "`bridges/workflows/index.ts` -- five runtime re-exports and eleven type re-exports, withholding both prepared-union arms"
  - "Owner tests for both modules: 24 cases in `stage.test.ts`, 5 in `index.test.ts`"
affects: [112-install-lifecycle, 113-update-reconcile, 114-degradation-docs]

actuals:
  tokens: 16636
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Spreading a real `ScopedLocations` to override one composer -- the brand is an enumerable own symbol, so the spread carries it and needs no cast"
    - "Asserting a callback stayed empty on a refusal by comparing the whole array of calls (`[[]]`), which separates a missing call from an empty-argument call"
    - "A composer override that carries a side effect, used to mutate the filesystem between two iterations of a production loop"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
    - extensions/pi-claude-marketplace/bridges/workflows/index.ts
    - tests/bridges/workflows/stage.test.ts
    - tests/bridges/workflows/index.test.ts
  modified: []

key-decisions:
  - "The CR-01 restore-failure branch is driven by a composer override with a SIDE EFFECT, not by a composer that returns two different paths."
  - "The successful-reversal case asserts the ABSENCE of a leak suffix rather than its presence."
  - "Three cases beyond the plan's list were added to close measured branch gaps rather than lowering the coverage target."
  - "The staging-side first-wins dedup is reported as unreachable through the public API; no suppression directive was added for it."

patterns-established:
  - "Composer-side-effect injection: a `ScopedLocations` spread whose `workflowArtifactPath` mutates the filesystem, reaching a branch between two iterations of a production loop that has no other seam."
  - "Whole-call-array callback assertions: capture invocations into a local array and compare the array of arrays, so a call that never happened fails differently from a call with an empty argument."

requirements-completed: [WBRG-01, WBRG-04, WPTH-04, WPTH-05]

coverage:
  - id: D1
    description: "The envelope carries the script bytes verbatim, with the key order name/description/script, a two-space indent and a trailing newline"
    requirement: WBRG-01
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#stages one envelope carrying the script bytes verbatim"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#omits the description key rather than emitting an empty one"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#renames every envelope into the saved directory and reports both names"
        status: pass
    human_judgment: false
  - id: D2
    description: "The commit rename is the only operation touching a directory the engine scans; the saved directory holds exactly the expected entries and nothing else"
    requirement: WBRG-04
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#renames every envelope into the saved directory and reports both names"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#replaces previously recorded envelopes and discards the displaced copies"
        status: pass
    human_judgment: false
  - id: D3
    description: "A commit finding foreign content at a target refuses before its first rename, reports an empty placement, and leaves the listing and the foreign bytes intact"
    requirement: WBRG-04
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#refuses a target holding foreign content before its first rename"
        status: pass
    human_judgment: false
  - id: D4
    description: "The staging containment check is anchored one level above the staging directory and runs before the recursive mkdir"
    requirement: WPTH-04
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#refuses a staging directory that has been replaced by a symbolic link"
        status: pass
    human_judgment: false
  - id: D5
    description: "A plugin shipping no admissible workflow and holding no previous names leaves the engine storage root absent on disk"
    requirement: WPTH-05
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#short-circuits to a noop and leaves the engine storage root absent"
        status: pass
    human_judgment: false
  - id: D6
    description: "Staging sits on the same filesystem as its commit target at run time"
    requirement: WPTH-05
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#keeps the staging tree on the same device as the saved directory"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every rollback branch reports the correct removal payload through onPlaced, and a failed restore leaves the staging tree holding the only surviving copy"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#reverses every completed rename when a later one fails"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#reports the still-placed names in discovery order when the reversal fails"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#keeps the staging tree when a displaced envelope cannot be restored"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#restores the displaced envelopes when a re-stage fails mid-sequence"
        status: pass
    human_judgment: false
  - id: D8
    description: "The barrel re-exports five runtime bindings by reference identity and eleven types by mutual assignability, withholding both prepared-union arms"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/index.test.ts#re-exports the defining binding"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/workflows/index.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "The criterion-4 caveat row reaches the prepared result while the stem-fallback envelope is still staged"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts#stages the stem-fallback envelope and carries its caveat row through"
        status: pass
    human_judgment: false

duration: 35 min
completed: 2026-09-05
status: complete
---

# Phase 111 Plan 03: Workflows staging triplet and barrel Summary

**The workflows bridge's write half: prepare/commit/abort with an occupancy refusal that fires before the first rename, both rollback loops, the CR-01 restore-failure branch that keeps the staging tree, and a barrel pinned by reference identity — all five bridge pairs now at complete direct coverage.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-05T10:29:00Z
- **Completed:** 2026-09-05T11:03:14Z
- **Tasks:** 3
- **Files modified:** 4 (all created)

## Accomplishments

- Landed `bridges/workflows/stage.ts` and `bridges/workflows/index.ts` verbatim from `features/workflow-port-wip` by a path-scoped, two-file checkout; the blast-radius assertion over the five kind-inversion files printed `0` immediately after, and `git diff` against the checkout shows zero removed lines in either module.
- Wrote `tests/bridges/workflows/stage.test.ts` — 24 cases across three `describe()` blocks, one per exported entrypoint — pinning the envelope bytes as transcribed literals, the collision refusal, the noop short-circuit, the staging containment refusal, the WR-06 occupancy refusal, the displacement path, and all four rollback outcomes.
- Wrote `tests/bridges/workflows/index.test.ts` — five `describe()` blocks asserting reference identity per re-exported runtime binding, eleven mutual-assignability type pins, two discriminant pins recovered through `Extract<>`, and two `@ts-expect-error` privacy proofs for the withheld prepared-union arms.
- Took `stage.ts` from 53/57 to **61/61 branches** and `index.ts` to **25/25 lines** by adding cases, never a suppression directive.
- Ran the whole gate chain green: typecheck 0, ESLint 0, all three fallow sub-gates, Prettier, both corresponding-test gates, `npm test` at 5378/0, `npm run test:integration` at 32/0.

## Task Commits

This plan's `<commit_boundary>` deferred to a single commit at the end of task 3, carrying all four paths together. Tasks 1 and 2 left the tree knowingly red — the staging module has no owner test until task 3 finishes it, so the corresponding-test gate and `fallow dead-code` cannot pass at either intermediate point.

1. **Tasks 1–3: staging triplet, barrel, and both owner tests** — `6981b2b4` (feat)

Blast radius verified after the commit: `git show --pretty=format: --name-only HEAD` lists exactly the four paths in `files_modified`, sorted, and nothing else.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/workflows/stage.ts` — `prepareStageWorkflows`, `commitPreparedWorkflows`, `abortPreparedWorkflows`; ported unedited.
- `extensions/pi-claude-marketplace/bridges/workflows/index.ts` — the barrel: five runtime re-exports, eleven type re-exports; ported unedited.
- `tests/bridges/workflows/stage.test.ts` — 24 cases, the module's owner test.
- `tests/bridges/workflows/index.test.ts` — 5 cases plus the compile-time pins, the barrel's owner test.

## Direct coverage, all five bridge pairs

| Module | Branches | Functions | Lines | Verdict |
|---|---|---|---|---|
| `bridges/workflows/types.ts` | — | — | — | classified `type-only`; no coverage record owed |
| `bridges/workflows/discover.ts` | 56/56 | 14/14 | 348/348 | passed |
| `bridges/workflows/unstage.ts` | 8/8 | 1/1 | 59/59 | passed |
| `bridges/workflows/stage.ts` | 61/61 | 10/10 | 425/425 | passed |
| `bridges/workflows/index.ts` | 1/1 | 0/0 | 25/25 | passed |

**No branch proved unreachable.** The three gaps the first measurement reported were closed by adding public-behaviour cases; the LCOV lines and what each needed are recorded under *Deviations* below. No `fallow-ignore` marker exists in any of the four files.

## The envelope text the byte-comparison cases transcribe

Three complete serialized envelopes are pinned as string literals, each including the two-space indent, the key order `name` → `description` → `script`, and the trailing newline. Rendered:

```json
{
  "name": "acme:greet",
  "description": "says hi",
  "script": "export const meta = { name: \"greet\", description: \"says hi\" };\nexport async function run() {}\n"
}
```

```json
{
  "name": "acme:quiet",
  "script": "export const meta = { name: \"quiet\" };\n"
}
```

```json
{
  "name": "acme:greet",
  "description": "says hi again",
  "script": "export const meta = { name: \"greet\", description: \"says hi again\" };\n"
}
```

The second one is the omission proof: the case asserts the complete text AND that `Object.hasOwn(parsed, "description")` is `false`, which separates an omitted key from one present as `null` or as an empty string. The third is read back out of the saved directory after a re-stage, so it also proves the displacement installed the new bytes over the old.

## What the same-device case is worth

`keeps the staging tree on the same device as the saved directory` compares `stat(path.dirname(stagingRoot)).dev` with `stat(workflowsSavedDir).dev` for exact equality after a successful commit. It is a real filesystem observation, not a restatement of a constant — but it is a **weak discriminator**, and the case carries a comment saying so. A hermetic `HOME` built under the system temporary directory puts both paths on one filesystem, so the assertion would still pass if staging were rerouted under a root that also lived there.

**The actual guard is the cross-configuration invariant in `tests/persistence/locations.test.ts`** (landed by `111-01`): two bundles under one relocated `HOME` with differing `PI_CODING_AGENT_DIR` and differing project directories must produce a byte-identical `workflowsStagingDir` that lies inside neither bundle's `scopeRoot` nor `extensionRoot`. That is the property whose violation reintroduces EXDEV. The runtime case here is its corroboration, and no cross-device rename outcome is asserted anywhere — that result is machine-dependent, and a same-filesystem machine records success as an expected outcome.

## Note for the install-lifecycle phase

`.fallowrc.json` still does **not** list `"bridges-workflows"` in the `orchestrators` zone's `allow` array. Nothing wires the bridge into an orchestrator yet, so adding it here would have been unverifiable. **The first orchestrator that imports `bridges/workflows/` must add that entry in the same change**, or `fallow dead-code`'s boundary sub-gate will fail on the new import edge. The measured addition is a single string in the existing `{ "from": "orchestrators", "allow": [...] }` object.

## Decisions Made

- **The CR-01 restore-failure branch is driven by a composer override with a side effect, not by a composer returning two different paths.** The plan's mechanism ("resolve differently on the displacement read and on the restore read") cannot be built: `displacePreviousTargets` calls `workflowArtifactPath` exactly once per previous name and captures the result in `displaced[].from`, and the restore loop never calls the composer again. What IS reachable through the same seam is ordering: resolving the *second* previous name happens after the *first* has already been renamed aside, so the override turns the freed target into a non-empty directory at that moment and the later `rename(aside, target)` cannot succeed. Same seam, same branch, and the case still asserts the staging root survives with the displaced envelope's original bytes inside it.
- **The successful-reversal case asserts the absence of a leak suffix.** A reversal that fully succeeded has nothing to leak: `cleanupStaging` returns `undefined` and `appendLeaks` hands the original error straight back. Asserting a leak suffix there would have required an implementation that reports one falsely. The case asserts `assert.doesNotMatch(error.message, /\(additionally:/)` instead, which is what distinguishes it from the failed-reversal case immediately below it; the single sanctioned `assert.match` on the leak suffix lives in that failed-reversal case, as planned.
- **Three extra cases rather than a lowered coverage target.** See *Deviations*.
- **The staging-side first-wins dedup is unreachable through the public API, and that is reported rather than suppressed.** See *Findings*.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 – Bug] The plan's restore-failure mechanism could not be built as described**

- **Found during:** Task 3 (the CR-01 branch)
- **Issue:** The plan directed the composer seam to "make a previous target's path resolve differently on the displacement read and on the restore read". The restore performs no composer read — `displacePreviousTargets` resolves each previous name once, before its rename, and the restore loop replays the captured `{from, to}` pair.
- **Fix:** Used the same seam for its ordering instead of its return value. The override resolves `acme:one` to the real target (displaced successfully), then, when resolving `acme:two`, creates a non-empty directory at `acme:one`'s now-freed target path before returning. The commit's occupancy check then refuses on a foreign target, the rollback runs, and the restore fails because its destination is a non-empty directory.
- **Files modified:** `tests/bridges/workflows/stage.test.ts`
- **Verification:** The case asserts the staging root still exists, the error message names it, the displaced envelope's original bytes are readable at `<stagingRoot>/.previous/acme:one.json`, and `onPlaced` recorded `[[]]`. `stage.ts` branch coverage moved from incomplete to complete on that arm.
- **Committed in:** `6981b2b4`

**2. [Rule 1 – Bug] The successful-reversal case cannot carry a leak suffix**

- **Found during:** Task 3
- **Issue:** The plan asked the fully-successful-reversal case to assert both `notStrictEqual(name, "ManualRecoveryError")` and that "its message carries the leak suffix". Those two are mutually exclusive: a reversal with nothing left placed and a staging cleanup that succeeded produces no leak at all.
- **Fix:** Asserted `error instanceof ManualRecoveryError === false` (by class, not by `name`) plus `assert.doesNotMatch(error.message, /\(additionally:/)`, with a comment saying that the absence is what separates the case from the failed-reversal case.
- **Files modified:** `tests/bridges/workflows/stage.test.ts`
- **Verification:** Both cases pass; the failed-reversal case's `assert.match` on `/\(additionally: failed to roll back workflow rename/` is the file's only message-substring `assert.match`, satisfying the plan's "at most 2".
- **Committed in:** `6981b2b4`

**3. [Rule 2 – Missing Critical] Three branch gaps in `stage.ts` closed by adding cases**

- **Found during:** Task 3, at the first `test:coverage:direct` run (branches 53/57, lines 419/425)
- **Issue:** Three reachable branches had no case. LCOV reported uncovered lines `78-79`, `149-150` and `261-262`, and a later run reported the single uncovered branch `BRDA:384,49,0,0`.
  - `78-79` — `admittedVerdict`'s `return undefined` for a discovered-but-not-admitted verdict.
  - `149-150` — the write-loop's `continue` for that same case.
  - `261-262` — the non-`ENOENT` rethrow inside `displacePreviousTargets`.
  - line `384` — the *successful* arm of the restore loop (`await rename(move.to, move.from)`), which no case reached because the only displacement case committed cleanly.
- **Fix:** Three changes, no suppression directive and no lowered target.
  - The noop case now plants a `.js` script declaring no `meta` (a `skipped`/`no-meta` verdict, discovered but not admitted) instead of a non-script `README.md`, and asserts the exact skip warning. Covers `78-79` and `149-150`.
  - Added `propagates a displacement failure that is not a missing previous file`: the composer resolves the previous name to a path underneath a regular file, so the displacement rename fails `ENOTDIR`. Covers `261-262`.
  - Added `restores the displaced envelopes when a re-stage fails mid-sequence`: a re-stage displaces both previous envelopes, the second forward rename fails, the first is reversed, and both previous envelopes are restored — the case asserts the saved directory holds the *original* bytes, not the revised ones. Covers line `384`.
- **Files modified:** `tests/bridges/workflows/stage.test.ts`
- **Verification:** `npm run test:coverage:direct -- .../stage.ts` reports `branches 61/61, functions 10/10, lines 425/425`.
- **Committed in:** `6981b2b4`

---

**Total deviations:** 3 auto-fixed (2 bugs in the plan's stated mechanisms, 1 missing-critical coverage gap)
**Impact on plan:** No scope creep. The case count grew from the plan's 22 to 24, entirely to close measured branch gaps; no production line was edited, and both ported modules landed byte-identical to `features/workflow-port-wip`.

## Findings

**The staging-side first-wins dedup is unreachable through the public API.** `prepareStageWorkflows` runs `assertNoWorkflowNameCollisions` over the full verdict array, then dedups admitted verdicts on `seen.has(verdict.generatedName)`. Two records sharing a generated name always throw at the assert — `assertNoWorkflowNameCollisions` groups by generated name and rejects whenever more than one file name claims it, without deduping file names. Discovery's own dedup, meanwhile, is keyed on the absolute source path, so one script reached through two spellings of one directory yields exactly one record. There is therefore no input for which `seen.has(...)` returns `true`.

This is **not** a coverage gap: V8 block coverage records the expression as evaluated on every admitted record, and `stage.ts` reports 61/61 branches. It is reported here because the module's own comment calls the dedup a guard for "the residual case of one script reached twice", and that case is currently closed upstream. The planned case (`keeps the first record when one directory is declared under two spellings`) is retained — it proves a well-formed plugin declaring `workflows` and `./workflows` installs cleanly instead of colliding, which is the user-visible property — but it does not exercise the dedup itself. Reaching the dedup would require either a discovery change that emits two records for one script, or a collision-assert change that tolerates one file name claiming a name twice; neither is warranted, so the guard stands as defence in depth.

## Issues Encountered

- `trufflehog` fails structurally in this worktree (`.git` is a file, so the git-mode scan cannot read `.git/index`). Confirmed clean by a filesystem-mode scan over the four committed paths with `--results=verified,unknown --fail`: exit 0, `verified_secrets: 0`, `unverified_secrets: 0`. The commit then ran with `SKIP=trufflehog` and that hook only. Every other hook, including `npm lint`, `npm format check`, `npm typecheck` and `npm fallow`, passed on its own. No `--no-verify`, no `--amend`.
- `git status` after the commit shows no mid-run Prettier rewrite; the four committed paths are clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The bridge is complete.** All five files under `bridges/workflows/` exist, each has a mirrored owner test, both corresponding-test gates pass, and all five pairs report their expected direct coverage.
- **`111-04` is next**: the `EXTENSION_VERSION` bump across its six sites (`tests/shared/extension-version.test.ts` is the one the CLAUDE.md checklist misses) and the inversion of the D-109-06 `ENOENT` assertion in `tests/integration/workflow-kind-inversion.test.ts`. Nothing in this plan touched a version constant.
- **Nothing consumes the bridge yet.** No orchestrator imports it, and the `orchestrators` fallow allow-list still omits `"bridges-workflows"` — see the note above; that entry belongs to the change that first imports the bridge.
- **Two seams the next phases will want:** `commitPreparedWorkflows`'s `onPlaced` is the caller's removal payload on every path including each throw, and its return value is a leak string rather than a throw when only the staging cleanup failed. A caller that derives removal work from the thrown error's type instead will unlink either a foreign file or a previous envelope the rollback just restored.

---
*Phase: 111-workflows-bridge*
*Completed: 2026-09-05*

---
phase: 103-workflow-artifact-materialization
plan: 02
subsystem: tests
tags: [workflows, project-key, path-containment, parity, upstream-drift]
status: complete

requires:
  - domain/workflow-project-key.ts (workflowProjectKey)
  - platform/workflow-home.ts (workflowHomeDir, setWorkflowHomeDirForTesting)
  - persistence/locations.ts (workflowsHomeDir / workflowsSavedDir / workflowsStagingDir / workflowArtifactPath)
  - bridges/workflows/ (prepareStageWorkflows, commitPreparedWorkflows)
provides:
  - tests/domain/workflow-project-key.test.ts (the fourteen-case engine parity suite)
  - tests/platform/workflow-home.test.ts (the relocation seam's set and restore behavior)
  - tests/persistence/locations.test.ts (the workflow-member banner section)
  - tests/bridges/workflows/paths.test.ts (the project-scope end-to-end path proof)
affects: []

tech-stack:
  added: []
  patterns:
    - measured literals as an upstream-drift alarm, never a re-derivation
    - a split pin (shape plus equivalence) where an expectation is machine-dependent
    - relative-path containment in assertions, never a string prefix test

key-files:
  created:
    - tests/domain/workflow-project-key.test.ts
    - tests/platform/workflow-home.test.ts
    - tests/bridges/workflows/paths.test.ts
  modified:
    - tests/persistence/locations.test.ts

decisions:
  - The relative-path case is pinned by shape plus resolve-equivalence, with no literal key
  - Containment assertions use a relative-path predicate rather than startsWith, so an extended sibling cannot read as containment
  - The project-scope expectation recomputes the key from the shared exported derivation, so the bundle and the assertion cannot drift

requirements: [WPTH-01, WPTH-02, WPTH-03, WPTH-04, WPTH-05]

metrics:
  duration: ~35m
  completed: 2026-08-15

estimate:
  tokens: 62000
  tasks: 3
actuals:
  tokens: 5600
  tasks: 3
  commits: 4
---

# Phase 103 Plan 02: Workflow path parity Summary

The engine's private per-project key derivation is now held to byte parity by thirteen
measured literals and one split pin, and a project-scope install is proved to land under
that key with the deprecated location inside the project's own directory left absent.

## What Was Built

**The parity suite.** `tests/domain/workflow-project-key.test.ts` carries thirteen
measured keys in a `readonly` case table and the relative-path case separately. Every
expected value is transcribed from the engine's own source; none is produced by calling
the function under test. All thirteen passed on the first run, so the reimplementation
landed in wave 1 agrees with the engine byte-for-byte across lowercasing, disallowed-run
collapse, the all-Cyrillic and all-CJK fallbacks, the dash strip, the 48-character slice,
leading and interior dots, the root's empty basename, trailing-slash removal and `..`
normalization.

**The two truncation inputs are built, not pasted.** Both use `"a".repeat(N)` on the
input and on the expected slug. A pasted 48-character run is unreviewable, and a miscount
would fail as a hash mismatch that reads exactly like upstream drift.

**The relocation seam.** `tests/platform/workflow-home.test.ts` pins the default,
the verbatim override, and the restore. No case reads or writes an environment variable:
the engine honors no override, so a suite relying on one would depend on a mechanism the
engine ignores.

**The bundle section.** Eleven cases were added to `tests/persistence/locations.test.ts`
under one banner, taking the file from 45 tests to 56. They cover both scopes' saved
directories, the deliberate scope-independence of the home and staging members, the
staging directory's position, the six refusals, the adjacency pair and the disjointness of
the three admitted paths.

**The project-scope proof.** `tests/bridges/workflows/paths.test.ts` drives the bridge at
project scope against a temp working directory, so the derived key is the one that
directory produces rather than a pasted constant.

## Key Implementation Notes

**Why the relative case has teeth.** Its hashed input is `resolve(cwd, "relative/path")`,
so a literal would pass only on the machine that recorded it. The pin is split: a shape
assertion for the slug, and `workflowProjectKey(rel) === workflowProjectKey(resolve(rel))`
for the ordering. The second clause is the load-bearing one — `basename("relative/path")`
without resolving still yields the slug `path`, so the slug alone does not witness that
`resolve()` runs first. That reasoning is transcribed into the test, because it is exactly
what a later reader would otherwise "simplify" back into a tautology. The equivalence
assertion is the single deliberate exception to the measured-literal rule and is commented
as such: it compares two spellings rather than re-deriving one expected value.

**Containment is not a prefix test.** The new assertions use a local `isInside` helper
that asks `path.relative(parent, child)` for a first segment that is not `..`, mirroring
the predicate in `shared/path-safety.ts`. A `startsWith` test would report
`<savedDir>-evil` as contained by `<savedDir>`, which is the confusion the adjacency case
exists to refuse. The helper deliberately avoids `startsWith` in its own body as well
(splitting on the separator instead of testing a `".." + sep` prefix), so the file's
`startsWith` count is unchanged at 17 and every occurrence of that token still belongs to
a pre-existing assertion.

**The ordered-segment assertion.** The project-scope path is asserted as
`["projects", <key>, "saved"]` over `path.relative(...).split(sep)` rather than as three
substring tests, because the order is the contract and a substring test would pass on a
path carrying the three names in any arrangement.

## Acceptance Criteria Arithmetic

The plan asks for the direct-call arithmetic on the parity suite to be stated:

| Line | Occurrence | Counts as |
|---|---|---|
| 68 | inside the test title template | not a call |
| 69 | the table loop body | the table-driven call |
| 90 | the shape assertion | direct call 1 |
| 91 | the two sides of the resolve equivalence | direct calls 2 and 3 |

Four calls in total; subtract the single table-driven call site (which covers all thirteen
rows) and exactly three direct calls remain, as required. The criterion's phrasing assumes
one call per row; the repository's table-driven convention iterates one call site over the
table, so the subtrahend is 1 rather than 13.

Other gates, measured:

| Gate | Required | Actual |
|---|---|---|
| `grep -cE '\-[0-9a-f]{12}"'` in the parity suite | >= 13 | 13 |
| `grep -c 'process.chdir'` | 0 | 0 |
| `grep -c 'repeat('` | >= 2 | 3 |
| `grep -c 'WPTH-03'` | >= 2 | 3 |
| `locations.test.ts` test count | >= 56 | 56 |
| `grep -c 'WPTH-0'` in `locations.test.ts` | >= 11 | 12 |
| `grep -c 'workflowProjectKey'` in `locations.test.ts` | >= 1 | 3 |
| `grep -cE 'process\.env'` in the seam suite | 0 | 0 |
| `grep -c 'setWorkflowHomeDirForTesting'` in `locations.test.ts` | >= 2 | 3 |
| `grep -c 'startsWith'` in `locations.test.ts` | no increase | 17, unchanged |
| `grep -c 'WPTH-02'` in `paths.test.ts` | >= 1 | 2 |
| `grep -cE 'existsSync\|access\(\|stat\('` in `paths.test.ts` | >= 2 | 3 |

## Non-Vacuity Reasoning

The plan asks for confirmation that the two orderings are each pinned by exactly one
assertion.

**Slice before strip.** Inverting the two changes only one row: the input
`"a".repeat(47) + "-b"`. Its pre-slice value is 47 `a`s, a dash, a `b`; the strip removes
nothing (there is no leading or trailing dash yet), the slice cuts at 48 and reintroduces
a trailing dash, and the joining dash then doubles it. Slicing first and stripping second
would remove that reintroduced dash, yielding a single dash and a different string before
the hash. Every other row's basename is either shorter than 48 characters or is a
homogeneous run whose 48th character is not a dash, so no other row moves.

**Basename before resolve.** Dropping `resolve()` leaves the slug of every absolute row
unchanged, and leaves the relative row's slug unchanged too — `path` either way. What
changes is the hashed input, which becomes the raw spelling rather than the resolved one.
The shape assertion still passes; the equivalence assertion fails, because the left side
would hash `"relative/path"` and the right side the already-resolved spelling. The `..`
row would also fail, since its raw spelling differs from the collapsed one. So the
equivalence assertion is the clause with teeth, exactly as the plan requires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded a comment that named `process.chdir`**

- **Found during:** Task 1 acceptance measurement
- **Issue:** The plan requires the test to explain why the working directory is not
  mutated, and separately requires `grep -c 'process.chdir'` to be `0`. The explanatory
  sentence named the token while stating it was refused, so the gate measured prose rather
  than code — the same class of collision wave 1 recorded and resolved the same way.
- **Fix:** The sentence now says "moving the process into a fixed directory", carrying the
  same meaning without the literal token.
- **Files modified:** `tests/domain/workflow-project-key.test.ts`
- **Commit:** 18c0f389

No other deviation. No expectation was adjusted to match observed output; all thirteen
measured keys were green on their first run.

## Known Stubs

None. No stub patterns, no skipped tests, no unrun `<verify>` blocks. The one skipped test
in the suite total is pre-existing and unrelated.

## Threat Flags

None. Every surface asserted here is already in the plan's threat register: the refusal
set (T-103-07), the derived key as a directory name (T-103-08), the containment-versus-
prefix confusion (T-103-09), and the storage-root relocation through the seam rather than
the environment (T-103-10). This plan installs no package, so T-103-SC needs no
legitimacy checkpoint.

## Verification

`npm run check` exit 0: typecheck, lint, format:check, 3587 unit tests (3586 pass, 1
pre-existing skip, 0 fail), 18 integration tests, 0 failures.

Per-file: 14 cases in the parity suite, 3 in the seam suite, 56 in `locations.test.ts`
(45 before), 5 in `paths.test.ts`.

No test added by this plan mutates `process.env` or the process working directory. No
source or test comment cites a GSD process artifact — the exclusion grep returns nothing
for all four files.

## Forward Notes

- The cross-device rename stays a backstop. Reproducing it needs two filesystems, which is
  not portable here; the structural property that makes it safe — staging and target
  sharing the workflow home, and neither deriving from `extensionRoot` — is asserted
  explicitly by the WPTH-05 ancestry case.
- Removal of these artifacts on uninstall, update, reinstall and disable remains the next
  phase's work, and is load-bearing because they live outside every scope root.

## Self-Check: PASSED

All four files verified present on disk; all three commit hashes verified in `git log`.

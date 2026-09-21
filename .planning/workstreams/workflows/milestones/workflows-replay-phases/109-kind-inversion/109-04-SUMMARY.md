---
phase: 109-kind-inversion
plan: 04
subsystem: the compiler-invisible test payloads and the published byte contract
tags: [inversion, fixtures, catalog, classifier, green-slice]
status: complete

requires:
  - "109-02 (`componentPaths.workflows` as a required member, and the retired reason token)"
  - "109-03 (the 68 compile-forced widening sites, which took typecheck from 131 errors to 4)"
provides:
  - "the eight `assert.deepStrictEqual` whole-arm payloads `tsc` cannot see, each carrying the fourth `componentPaths` key"
  - "the three turned `catalog-uat` fixture payloads, paired byte-for-byte with the doc blocks `109-01` wrote"
  - "a GREEN `catalog-uat`, closing the exact three-state byte mismatch captured as red in `109-01-SUMMARY.md`"
  - "the turned classifier owner test asserting the `kindToReason` fall-through a legacy record hits"
  - "a whole-tree `npm run typecheck` at 0 errors and `npm test` at 5195 pass / 0 fail"
affects:
  - "109-05 (starts from a green baseline; any red it observes is its own)"

tech-stack:
  added: []
  patterns:
    - "a green typecheck is not a green suite -- `deepStrictEqual`'s second argument is `unknown`, so a missing key surfaces only under the runner"
    - "a published byte contract is fitted by the fixture, never the reverse"
    - "a retired mapping's owner test is turned to assert the fall-through, not deleted -- deletion is proof by absence"

key-files:
  created:
    - .planning/workstreams/workflows/phases/109-kind-inversion/109-04-SUMMARY.md
  modified:
    - tests/domain/resolver.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/git-source-probe.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/probe-classifiers.test.ts

key-decisions:
  - "The three fixture comment blocks were left byte-unchanged. `109-01` had already retagged them to `WINV-04` and reworded each to describe the post-inversion render, so rewriting them here would have been churn -- the plan's instruction to update them was already satisfied by the prior wave."
  - "State 2's payload was copied from the existing `success` fixture in the local key order that fixture uses (`status, name, version, dependencies, severity, needsReload`) rather than the plan's listing order, so the two byte-identical states are also literal-identical and a reader can see at a glance that they are the same payload."
  - "Every widened invisible payload took the empty array and matched its own file's key order -- skills/commands/agents in `resolver.test.ts` and `git-source-probe.test.ts`, alphabetical in `install.test.ts`. No fixture claims a workflows path it does not have."

requirements-completed: [WINV-01, WINV-03, WINV-04]

coverage:
  - deliverable: "All eight compiler-invisible `componentPaths` payloads carry the fourth key"
    verification:
      - kind: test
        ref: "node --test tests/domain/resolver.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/git-source-probe.test.ts -> tests 323 / pass 323 / fail 0"
        status: pass
      - kind: command
        ref: "grep -c 'componentPaths: {' -> resolver 5, install 1, git-source-probe 2; tree-wide 76 (unchanged)"
        status: pass
      - kind: command
        ref: "grep -c 'deepStrictEqual' tests/domain/resolver.test.ts == git show HEAD:... -> 43 == 43 (no assertion loosened)"
        status: pass
    human_judgment: false
  - deliverable: "The `catalog-uat` byte gate is green, closing the exact red `109-01` captured"
    verification:
      - kind: test
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() -> tests 6 / pass 6 / fail 0"
        status: pass
      - kind: command
        ref: "the run contains neither `catalog UAT failures` nor `catalog UAT inverse-walk failures` nor `Expected exactly 182 annotated catalog examples`"
        status: pass
      - kind: command
        ref: "git diff --stat tests/architecture/catalog-uat.test.ts -> 5 insertions / 7 deletions; grep of the diff for piWithBothLoaded / examples.length / marketplace wrapper lines -> 0 hits"
        status: pass
    human_judgment: false
  - deliverable: "The three turned states render a clean not-installed row, a clean installed row, and a rejection whose brace names the other component kind"
    verification:
      - kind: test
        ref: "tests/architecture/catalog-uat.test.ts -- the byte pairing IS the assertion; the three fixtures now render the bytes their doc blocks publish"
        status: pass
      - kind: test
        ref: "tests/architecture/partial-vocabulary-guard.test.ts -> tests 52 / pass 52 / fail 0"
        status: pass
    human_judgment: false
  - deliverable: "The classifier owner test is turned, not deleted, and keeps its compile-time clause"
    verification:
      - kind: test
        ref: "tests/shared/probe-classifiers.test.ts#WINV-03: a stray workflows kind in a legacy record falls through to unsupported component -> tests 41 / pass 41 / fail 0"
        status: pass
      - kind: command
        ref: "grep -c 'satisfies readonly UnsupportedReason\\[\\]' == git show HEAD:... -> 2 == 2; grep -c 'dedicated workflows reason' -> 0"
        status: pass
    human_judgment: false
  - deliverable: "`npm run typecheck` and `npm test` are both green across the whole tree"
    verification:
      - kind: command
        ref: "npm run typecheck -> exit 0, no `error TS` lines"
        status: pass
      - kind: command
        ref: "npm test -> tests 5195 / suites 297 / pass 5195 / fail 0"
        status: pass
    human_judgment: false

duration: 14 min
completed: 2026-09-04

actuals:
  tokens: 8100
  tasks: 3
  commits: 3
---

# Phase 109 Plan 04: Compiler-invisible payloads and the byte gate Summary

Closed the three failure classes `tsc` cannot see -- eight whole-arm equality payloads, the
three catalog fixture payloads, and the classifier owner test -- taking the whole tree to a
green typecheck and a green suite, and producing the GREEN half of `catalog-uat`'s
red-then-green pair.

**Duration:** 14 min (2026-09-04T23:48Z -> 2026-09-05T00:02Z)
**Tasks:** 3 of 3
**Files:** 5 modified, 0 under `extensions/`

## Accomplishments

- **The eight invisible payloads are widened.** `assert.deepStrictEqual` types its second
  argument as `unknown`, so these compiled clean through `109-02` and `109-03` and would have
  failed only under the runner. All eight now carry `workflows: []` in their own file's key
  order: `tests/domain/resolver.test.ts` x5 (four single-line literals plus the multi-line
  `skills`-populated one), `tests/orchestrators/plugin/install.test.ts` x1 (alphabetical
  order), `tests/orchestrators/plugin/git-source-probe.test.ts` x2. The tree-wide site count
  is unchanged at **76** -- nothing was merged, extracted or deleted to make a diff go away.
- **The `catalog-uat` byte gate is green.** The three fixture payloads were turned to the
  shapes `109-RESEARCH` measured, and the gate now reports `tests 6 / pass 6 / fail 0`. Its
  three byte mismatches are closed, and no fourth appeared: the `examples.length === 182`
  assertion, the inverse orphan walk, and every other state are all untouched.
- **The rejection state proves the inversion.** `workflow-plus-unsupported-rejection` now
  hands the renderer `reasons: ["unsupported component"]`, and the row renders
  `⊖ helper (partially-available) {unsupported component}` with the `--partial` trailer. The
  brace naming the OTHER component kind is what shows the workflows kind stopped contributing
  a token -- a plugin carrying both kinds resolves `partially-available` on the second kind
  alone.
- **The classifier owner test was turned, not deleted.** `narrowUnsupportedKinds(["workflows"])`
  keeps the workflows string as its input, because that is the legacy-record case under test:
  a record written before the inversion can still carry the kind in its
  `compatibility.unsupported` array. The expected array now holds the generic component
  marker, and the `satisfies readonly UnsupportedReason[]` clause survives -- that clause is
  the only thing in the tree that would have caught the classifier arm being left behind.
- **The whole tree is green.** `npm run typecheck` exits 0 with no `error TS` line, down from
  the 4 that `109-03` handed over and the 131 that `109-02` opened. `npm test` reports
  `tests 5195 / suites 297 / pass 5195 / fail 0`.

## Red-then-green pairs (Success Criterion 4)

One row per locking gate. Every red was captured in `109-01-SUMMARY.md` §*Red observations*,
against unmodified production code; every green is the run named here or in
`109-02-SUMMARY.md`. The `catalog-uat` row is the load-bearing one -- it is the gate whose red
required the documentation half to be turned first.

| Gate | Red (captured in `109-01-SUMMARY.md`) | Green (run + owner plan) |
|------|----------------------------------------|--------------------------|
| `tests/architecture/catalog-uat.test.ts` | `ℹ tests 6 / pass 5 / fail 1` -- `catalog UAT failures (3)`: byte mismatch on all three turned states, each rendering `{workflows}` where the doc block published the post-inversion bytes | `ℹ tests 6 / pass 6 / fail 0` -- **109-04**, this plan, after turning the three fixture payloads |
| `tests/architecture/compat-01-no-expansion.test.ts` | `ℹ tests 14 / pass 13 / fail 1` -- ordered `expected` diff is a single trailing `+ 'workflows'` | `ℹ tests 14 / pass 14 / fail 0` -- `109-02`, on retiring the `REASONS` tail member |
| `tests/architecture/notify-closed-set-locks.test.ts` | `ℹ tests 4 / pass 3 / fail 1` -- `OUT-08` length pin `44 !== 43` | `ℹ tests 4 / pass 4 / fail 0` -- `109-02` |
| `tests/shared/notify.test.ts` | `ℹ tests 253 / pass 252 / fail 1` -- the second, independent length pin `44 !== 43` | `ℹ tests 253 / pass 253 / fail 0` -- `109-02` |
| `tests/architecture/hooks-foundation.test.ts` | `ℹ tests 9 / pass 7 / fail 2` -- the 5-tuple pin missing `'workflows'`, and the negative mirror finding it still in `UNSUPPORTED_COMPONENT_KINDS` | `ℹ tests 9 / pass 9 / fail 0` -- `109-02`, in the single closed-set-move commit `f23d964d` |
| `tests/domain/resolver.test.ts` (`WINV-01` pattern) | `ℹ tests 2 / pass 0 / fail 2` -- both positive owner tests reporting `partially-available` where `installable` was asserted | `ℹ tests 157 / pass 157 / fail 0` -- `109-02` turned them green; **109-04** re-runs the whole file green after widening its five invisible payloads |

The classifier owner test has no red half by design and is not a row here. It was not turned
in `109-01`: the plan assigned it to this wave precisely because turning it early would have
made it a `tsc` error rather than an observable runtime red, and the requirement it serves
(`WINV-03`) is proved by the turned assertion itself, not by an observation sequence.

## What the three turned fixtures now hand the renderer

| State | Fixture payload | Rendered row |
|-------|-----------------|--------------|
| `workflow-available-inventory` | `{ status: "available", name: "helper", version: "1.0.0" }` -- no `reasons` key at all | `○ helper v1.0.0 (available)`, info severity, no trailer |
| `workflow-install-success` | the `success` state's entry verbatim: `installed` / `dependencies: []` / `severity: "info"` / `needsReload: true` | `● helper v1.0.0 (installed)` plus the reload trailer |
| `workflow-plus-unsupported-rejection` | `partially-available` / `reasons: ["unsupported component"]` / `partialHint: true` / `severity: "error"` | `⊖ helper (partially-available) {unsupported component}` plus the `--partial` trailer, under the failure summary line |

State 2 renders byte-identical to the existing `success` state. That is permitted and was
confirmed against the gate's own structure: `catalog-uat` walks annotations and checks each
against its own fixture keyed on `${section}::${state}`, with no cross-state uniqueness rule
anywhere. No distinguishing token was added to make the two differ.

## Deviations from Plan

### 1. [Rule 3 - Blocker] The plan's measured line numbers had shifted by ~60 lines

- **Found during:** Task 1
- **Issue:** `109-PATTERNS.md` §*Archetype B* lists the five `resolver.test.ts` sites at lines
  3346, 3372, 3421, 3617 and 3762. `109-01` added two positive owner tests to that file after
  the pattern map was measured, so the live sites sit at 3406, 3432, 3481, 3678 and 3823.
- **Fix:** located the sites by content rather than by line number
  (`grep -rn 'componentPaths: {' tests/domain tests/orchestrators`), which is the cross-check
  the plan itself prescribes. The identified set is exactly the eight the plan enumerates --
  same files, same counts per file, so the drift is positional only.
- **Files modified:** none beyond the task's own three
- **Verification:** `grep -rn 'componentPaths: {' tests/ --include=*.test.ts | wc -l` -> `76`,
  the unchanged phase-wide count
- **Commit:** `f1a65bba`

### 2. [Rule 3 - Blocker] The pre-commit hook is not installed in this worktree

- **Found during:** Task 1
- **Issue:** `git commit` produced no hook output at all. The shared git dir
  (`/home/acolomba/pi-claude-marketplace/.git`) carries no `hooks/pre-commit`, so the
  `.pre-commit-config.yaml` pipeline does not fire on commit from here. A commit that looks
  clean therefore proves nothing about lint, format, typecheck or fallow.
- **Fix:** ran `SKIP=trufflehog pre-commit run --files <changed paths>` explicitly before each
  commit, per `CLAUDE.md` §Git, plus the sanctioned filesystem-mode trufflehog scan over the
  same paths. Every hook passed on the final tree; the only failure observed was `npm-typecheck`
  reporting the 4 errors this plan's own Tasks 2 and 3 were about to close.
- **Files modified:** none
- **Verification:** the final `pre-commit run --files` over `catalog-uat.test.ts` and
  `probe-classifiers.test.ts` reports every hook `Passed`, including `npm typecheck` and
  `npm fallow`
- **Commit:** none (process, not content)

**Total deviations:** 2 auto-fixed (2 x Rule 3 blockers). **Impact:** none on the deliverable.
Neither changed what any gate asserts.

## Deliberate non-changes

- **The three fixture comment blocks were left alone.** The plan's Task 2 asks for them to be
  reworded and retagged to `WINV-04`. `109-01` had already done both in the same edit that
  renamed the ids, and each comment already describes the post-inversion render accurately.
  `grep -c 'WDET-04' tests/architecture/catalog-uat.test.ts` prints `0`.
- **`examples.length === 182` is untouched**, as are `piWithBothLoaded()` and every marketplace
  wrapper. `git diff` over the file shows 5 insertions and 7 deletions, all inside the three
  plugin entries.
- **Nothing under `extensions/` moved.** `git diff --name-only f1a65bba~1..HEAD -- extensions/`
  returns zero files.

## Known Stubs

None. Every payload widened here holds a real value, every assertion kept its strict form, and
the turned classifier test asserts a live behavior rather than a retired one.

## Issues Encountered

None beyond the two Rule 3 blockers documented above.

## Next Phase Readiness

Ready for `109-05`, the last plan of the phase, which adds
`tests/integration/workflow-kind-inversion.test.ts`. It starts from a green whole-tree
typecheck and a green suite, so any red it observes is its own.

The `D-109-06` window remains open and unchanged by this plan: a workflow-bearing plugin
resolves `installable`, renders `● (installed)` with no brace, and materializes zero workflow
commands until Phase 111 lands. Cut no release from this branch, and do not bump
`EXTENSION_VERSION`.

## Self-Check: PASSED

- `.planning/workstreams/workflows/phases/109-kind-inversion/109-04-SUMMARY.md` -- FOUND
- All five modified files present and committed: FOUND
- `f1a65bba` test(109-04): widen the compiler-invisible componentPaths payloads -- FOUND
- `59932311` test(109-04): turn the three workflow catalog fixture payloads -- FOUND
- `0b15f0ee` test(109-04): assert the workflows kind falls through to the generic reason -- FOUND
- `npm run typecheck` exit 0, zero `error TS` lines -- PASS
- `npm test` -> `ℹ tests 5195 / pass 5195 / fail 0` -- PASS
- `git diff --name-only f1a65bba~1..HEAD -- extensions/` returns 0 files -- PASS

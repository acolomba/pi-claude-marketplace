---
phase: 117-extension-entry-and-final-gate
plan: "10"
subsystem: testing
tags: [lcov, coverage-gate, negative-control, planting-control, node-test]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "The entry pair and its clean direct-coverage reading, which this control plants against without touching"
provides:
  - "A planting control for the direct-coverage shortfall verdict, the verdict every pinned unreachable-branch entry in the broken-windows ledger matches against"
  - "A planting control for the direct-coverage ambiguity verdict (two records claiming one source)"
  - "A complete-state control that proves the synthetic fixture is well-formed, so the two throwing states fire on the intended arm"
  - "Two command-driven mapping refusals: a path outside the project, and an in-tree path that is not a corresponding test"
  - "A measured, named list of the direct-coverage gate's remaining uncontrolled refusal arms"
affects: [117-11, 117-12, coverage-gate maintenance, D-116-01a pin regime]

actuals:
  tokens: 1173
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Synthetic LCOV text pointed at a REAL in-repo absolute path, called with no fixture root, to reach verdicts the injectable root cannot reach"
    - "A control state that must NOT throw, placed before the throwing states, so a malformed fixture cannot make both throws pass on the wrong arm"
    - "Gate-reachable-only refusals driven through the command as a subprocess rather than through the exported assertion"

key-files:
  created: []
  modified:
    - scripts/test-coverage-direct.negative.mjs

key-decisions:
  - "The synthetic record names extensions/pi-claude-marketplace/shared/atomic-json.ts, a real non-type-only module, and no fixture root is passed"
  - "The shortfall assertion pins the verdict SHAPE with an end-anchored regex, never an absolute branch pair"
  - "The two command-reachable mapping refusals are driven through a spawned subprocess, because the exported assertion cannot reach them"
  - "No path-level ambiguity check was added (D-117-21): it is unreachable under the current one-to-one mapping"
  - "The gate script was mutated in place for the RED runs and restored from a byte copy, verified by cmp and by git diff --quiet"

patterns-established:
  - "Complete-before-throwing: a control that asserts a non-throwing state first, so the throwing states are proven to fire on the arm under test"
  - "Mutation-must-not-be-a-no-op: the plant helper exits non-zero when its target text is absent, so a plant cannot silently change nothing and report RED-by-accident"

requirements-completed: [COV-02, COV-04]

coverage:
  - id: D1
    description: "The shortfall verdict has a planting control: a record whose hit count is below its found count on one counter makes the assertion throw a verdict naming the source and reporting only the deficient counter as hit over found"
    requirement: "COV-04"
    verification:
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — shortfall state; confirmed RED against a gate whose hit/found comparison was dropped"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ambiguity verdict has a planting control: two records claiming the same source are refused rather than resolved to the first match"
    requirement: "COV-02"
    verification:
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — ambiguity state; confirmed RED against a gate whose record-count check was relaxed to `records.length === 0`"
        status: pass
    human_judgment: false
  - id: D3
    description: "A complete record over the same synthetic fixture returns a summary instead of throwing, proving the fixture parses to exactly one record"
    requirement: "COV-04"
    verification:
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — complete state; confirmed RED against a gate whose summary format was altered"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two command-reachable mapping refusals fail closed: a path outside the project and an in-tree path that is not a corresponding test each exit non-zero with their own refusal text"
    requirement: "COV-02"
    verification:
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — two spawnSync invocations; confirmed RED against a gate that swallowed the mapping throw (both exited 0) and against a gate whose `.test.ts` suffix check was dropped"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gate script is unchanged by its own control run — the relaxation plants were reverted from a byte copy"
    verification:
      - kind: other
        ref: "cmp against the byte copy after each plant; `git diff --quiet -- extensions/ tests/ package.json scripts/test-coverage-direct.mjs`"
        status: pass
    human_judgment: false
  - id: D6
    description: "The direct-coverage gate's remaining uncontrolled refusal arms are named on the record with D-117-09 as the reason, rather than swept"
    verification: []
    human_judgment: true
    rationale: "A decision to report rather than sweep is an operator judgment about scope, not something a test can assert. The reachability of each named arm WAS measured (see the table below); only the decision to leave them uncontrolled is judgment."

duration: 12 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 10: Direct-Coverage Verdict Planting Controls Summary

**The direct-coverage assertion's shortfall and ambiguity verdicts now have planting controls, alongside a complete-state control that proves the synthetic fixture well-formed and two command-driven mapping refusals — four states where the control planted one, with no change to the gate it plants against.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-03T20:10:59Z
- **Completed:** 2026-09-03T20:22:39Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `scripts/test-coverage-direct.negative.mjs` grew from two plants to six. The two pre-existing plants (the type-only escape and the zero-record arm) are byte-identical and still run first against the same fixture tree.
- One helper, `lcovRecord(recordSourcePath, counts)`, builds a single synthetic LCOV record for a chosen source and chosen per-counter found/hit numbers. Concatenating two calls states the same source twice, which is the whole ambiguity fixture — no second parameter was added for it.
- The record's `SF` field is an **absolute in-repo path** and the assertion is called with **no fixture root**. That is the measured workaround for the asymmetry the plan named: `assertCompleteCoverage`'s `selectedProjectRoot` parameter threads only to `isTypeOnlyModule`, while `toProjectPath(record.get("SF"))` resolves against the module-level `projectRoot`. A record pointing into a fixture tree is therefore refused as outside the project before any verdict can be reached, which is why the pre-existing control could only ever reach the zero-record arm.
- The source named is `extensions/pi-claude-marketplace/shared/atomic-json.ts` — a real module that is not type-only, so no state can slip into the type-only escape and pass unconditionally.
- The two mapping refusals no exported function can reach are driven through the command itself, spawned as a subprocess: `../outside-the-project.ts` and `tests/edge/notification-boundary.ts` (a file that really exists and really cannot be mapped).
- **No gate script change.** `scripts/test-coverage-direct.mjs` is byte-identical to its state at `HEAD~1`.

## Task Commits

1. **Task 1: Plant the shortfall verdict, the ambiguity verdict, and two fail-closed mapping refusals** — `aa193f49` (test)

**Plan metadata:** see the `docs(117-10)` commit that carries this file.

## Files Created/Modified

- `scripts/test-coverage-direct.negative.mjs` — adds `lcovRecord`, the complete/shortfall/ambiguity states, and the two command-driven mapping refusals. 86 lines added, 0 removed.

## What the green gate run does and does not prove

**The green run of the control on the unmodified gate proves only that the gate currently agrees with the four states. It is not evidence that any of the four assertions can fail.** The repository has no coverage shortfall and no duplicated LCOV record today, so nothing in a normal run exercises these arms.

The evidence is the plants. Every state was confirmed RED against a **relaxed gate**, mutated in place from a byte copy and restored immediately, and the output recorded verbatim:

| # | State asserted | Relaxation planted into `scripts/test-coverage-direct.mjs` | Verbatim RED output |
| --- | --- | --- | --- |
| A | complete record returns a summary | final summary join changed from `${name} ${hit}/${found}` to `${name}: ${hit}/${found}` | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` / `+ 'branches: 4/4, functions: 3/3, lines: 12/12'` / `- 'branches 4/4, functions 3/3, lines 12/12'` |
| B | shortfall record throws | `([, count]) => count.found < 0 \|\| count.hit !== count.found,` → `([, count]) => count.found < 0,` | `AssertionError [ERR_ASSERTION]: Missing expected exception.` … `expected: /Incomplete direct coverage for extensions\/.+atomic-json\.ts: branches \d+\/\d+$/` |
| C | duplicated record is refused | `if (records.length !== 1) {` → `if (records.length === 0) {` (take the first match) | `AssertionError [ERR_ASSERTION]: Missing expected exception.` … `expected: /Expected one LCOV record for extensions\/.+atomic-json\.ts, found 2$/` |
| D | both command refusals exit non-zero | `pairs = [pairForPath(args[0])];` wrapped in `try { … } catch { pairs = []; }` | `AssertionError [ERR_ASSERTION]: Expected "actual" to be strictly unequal to: 0` … `actual: 0` |
| E | the in-tree refusal names its own reason | `if (!testPath.startsWith(prefix) \|\| !testPath.endsWith(suffix)) {` → `if (!testPath.startsWith(prefix)) {` | `AssertionError [ERR_ASSERTION]: The input did not match the regular expression …` / `Input: 'Missing source-test pair member: extensions/pi-claude-marketplace/edge/notification-bou.ts\n'` |

Plant D also demonstrated the fail-open directly at the command: under that mutation both
`node scripts/test-coverage-direct.mjs ../outside-the-project.ts` and
`node scripts/test-coverage-direct.mjs tests/edge/notification-boundary.ts` printed
`No changed source-test pairs.` and exited 0. The control reports the first of the two; the same
assertion covers both. Plant E is what proves the second refusal's own message assertion is live
independently, since it leaves the first refusal untouched and green.

Each mutation was applied by a helper that **exits 9 if its target text is not found or if the
replacement is a no-op**, so a plant cannot silently change nothing and be mistaken for evidence.
After every plant the gate was restored with `cp` from the byte copy and re-verified with `cmp`;
the last restore was followed by a fresh green run of the control.

## Uncontrolled refusal arms, named rather than swept

D-117-09 bars a repo-wide audit of pre-existing controls, so the arms below are **reported, not
controlled**. Each one's reachability was measured through the command, not assumed:

| Gate line | Refusal | Measured reachability | Why it is not controlled here |
| --- | --- | --- | --- |
| 29 | `Not a production TypeScript path: …` | reachable — `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/nope.json` prints it | Pre-existing arm; outside D-117-21's two named verdicts |
| 60 | `Path is not a source-test pair member: …` | reachable — `… package.json` prints it | Pre-existing arm; outside D-117-21 |
| 65 | `Missing source-test pair member: …` | reachable — `… extensions/pi-claude-marketplace/nope.ts` prints it | Pre-existing arm; outside D-117-21 |
| 278 | `Pass one source or test path, --all, or no arguments` | reachable — `… one two` prints it | Pre-existing arm; outside D-117-21 |
| 257 | `Focused test failed: …` | **not probed** — reaching it needs a deliberately failing focused test, which would mean planting a failing test into `tests/` | This plan may not touch `tests/`; the arm is named unmeasured rather than claimed measured |
| 222 | the `count.found < 0` half of the shortfall filter (a record missing a counter field, via the `?? "-1"` default in `coverageCounts`) | not probed | A distinct sub-arm of the verdict this plan controls; the `hit !== found` half is planted |

The prefix half of line 29's condition (`!sourcePath.startsWith(prefix)`) is additionally
**unreachable from `pairForPath`**, which only calls `sourceToTest` after testing that same prefix.
Only the `.ts` suffix half can fire, and that is the half the probe above reaches.

## Decisions Made

- **`atomic-json.ts` as the named source.** It is real, it is production, and it is not type-only. With a record present the type-only escape is unreachable anyway, but a type-only source would have made the fixture's correctness depend on that fact rather than on the record.
- **The shortfall regex is end-anchored (`… branches \d+\/\d+$`).** The anchor is doing real work: it proves the verdict reports *only* the deficient counter, not all three. The digits stay loose, so no absolute branch pair is pinned.
- **The complete state asserts an exact string.** Its numbers are fabricated by this control, not read from the repository, so an exact equality can never rot the way a real coverage number would — and Plant A shows it is the assertion that catches a summary-format change.
- **The ambiguity fixture is two concatenated calls to the one helper, not a `recordCount` parameter.** The plan asked for one small helper; a count parameter would have been a second knob for a single caller.
- **In-place mutation with a byte-copy restore, not a scratch copy.** The plan specifies this route, and it avoids the `node_modules` reachability problem 117-09 hit when running a scratch copy of a gate that imports `typescript`. `cmp` after each restore and `git diff --quiet` at the end are the proof.
- **The new plants live inside the existing `try`, before the success message.** Appending after the `finally` would have printed `Direct-coverage negative controls passed.` before the new states ran.

## Deviations from Plan

None - plan executed exactly as written.

## Measured corrections to plan statements

Per the phase's re-derive-every-count rule:

- **The plan states the injectable root "threads only to the type-only escape and not to path resolution".** Measured true by reading the gate: `assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot)` passes `selectedProjectRoot` to `isTypeOnlyModule` only; `toProjectPath` closes over the module-level `projectRoot`. The workaround the plan prescribes is therefore the right one, and it needed no script change.
- **The plan states `scripts/` is covered by neither ESLint, nor the prettier glob, nor the fallow file pattern.** Measured true again this run: `pre-commit run --files scripts/test-coverage-direct.negative.mjs` reported `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` and `prettier` all as `(no files to check)`. An explicit `npx prettier --check` on the file nonetheless reports `All matched files use Prettier code style!`, so the hand-matched style agrees with the formatter that does not run on it.
- **The plan's `estimate.tokens` is 30000; the realized `actuals.tokens` is 1173** (chars/4 over the one changed file). The gap is not a miss in the work — it is that the cost of this plan was reading the gate and running eleven verification passes, not writing bytes. Recorded unrounded so the calibration data stays honest.

## Issues Encountered

- **The `fix-unicode-dashes` pre-commit hook rewrote the file on the first hook run**, converting two em dashes in comments to `--` and failing with `files were modified by this hook`. Not a defect: it is the repository's own text normalizer doing its job on new prose. The rewrite was inspected (`rg '[—–]'` now returns nothing), the control was re-run green, `npx prettier --check` re-confirmed, and the second hook run exited 0. No line exceeds 100 characters.
- **The `trufflehog` pre-commit hook fails structurally in this linked worktree**, as CLAUDE.md documents. Discharged by the sanctioned filesystem route before committing: `trufflehog filesystem scripts/test-coverage-direct.negative.mjs --results=verified,unknown --fail` reported `chunks: 1, bytes: 4695, verified_secrets: 0, unverified_secrets: 0` at exit 0. Only `trufflehog` was skipped — `npm-format-check` did **not** need skipping, because a scoped `--files` run reports it as `(no files to check)`. `--no-verify` was never used.

## Verification Results

Every gate was run unpiped, or redirected to a file with `rc=$?` captured immediately, and its own exit code read — the zsh `$status`/`$?` trap named in the phase notes.

| Gate | Result |
| --- | --- |
| `node scripts/test-coverage-direct.negative.mjs` | exit 0 — `Direct-coverage negative controls passed.` |
| `npm run test:coverage:direct:negative` | exit 0 |
| `npm run test:corresponding:negative` | exit 0 — `Corresponding-test negative controls passed.` |
| `node scripts/check-corresponding-tests.mjs` | exit 0 — `Corresponding-test gate passed.` (zero violations, unchanged from baseline) |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/index.ts` | exit 0 — `Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 15/15, functions 3/3, lines 161/161)`; zero lines beginning `Incomplete direct coverage for` |
| `npm run typecheck` | exit 0 — zero `error TS` lines |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | exit 0 — 5142 tests, 295 suites, 5142 pass, 0 fail, 0 skipped (identical to the post-Wave-3 baseline) |
| `rg 'Phase [0-9]\|Plan [0-9]\|Wave [0-9]\|Pitfall [0-9]' scripts/test-coverage-direct.negative.mjs` | exit 1 — no match |
| `npx prettier --check scripts/test-coverage-direct.negative.mjs` | exit 0 |
| `SKIP=trufflehog pre-commit run --files scripts/test-coverage-direct.negative.mjs` | exit 0 (second run, after the dash fixer's rewrite) |
| `cmp scripts/test-coverage-direct.mjs <byte copy>` after each of the five plants | identical, five times |
| `git diff --quiet -- extensions/ tests/ package.json scripts/test-coverage-direct.mjs` | exit 0 |
| `git diff --quiet HEAD~1 HEAD -- extensions/ tests/ package.json scripts/test-coverage-direct.mjs` | exit 0 — the commit touched none of them |
| post-commit deletion check (`git diff --diff-filter=D HEAD~1 HEAD`) | empty — no file deleted |

`npm run check` was deliberately not run: its `format:check` link fails on the operator's pre-existing untracked files and would short-circuit before the tests. Those files were not touched and `.prettierignore` was not edited.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- COV-04 is satisfied for the two verdicts D-117-21 names, and the third state that makes them meaningful. Not marked complete in `REQUIREMENTS.md` — COV-02 and COV-04 are shared IDs and 117-12 owns the sweep.
- COV-02's remaining half — that the source-to-test mapping is injective over the whole inventory — is untouched here by design and belongs to 117-11.
- The six uncontrolled refusal arms above are the honest residue of D-117-09. They are named, four of them with a measured reproduction command, so 117-12 or a later phase can pick them up without re-deriving reachability.

## Self-Check: PASSED

- `scripts/test-coverage-direct.negative.mjs` exists on disk; the control re-runs green after all commits (`Direct-coverage negative controls passed.`, exit 0).
- All three commits are reachable: `aa193f49` (test), `63086689` (docs, this file), `e77452fd` (docs, STATE/ROADMAP).
- `git diff --quiet -- extensions/ tests/ package.json scripts/test-coverage-direct.mjs` exits 0 after the final commit.
- The only remaining working-tree changes are the operator's own pre-existing files (`.claude/settings.json`, `.codex/config.toml`, and the untracked scratch set). None was touched, formatted or staged.
- The `roadmap.update-plan-progress` off-by-one the phase notes record was observed again and left alone: the plan checklist now reads `[x] 117-10-PLAN.md` while the detail bullet below still reads `[ ] **117-10**` (the same run flipped `117-09`'s bullet). 117-12 owns reconciling both lists.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*

---
phase: 117-extension-entry-and-final-gate
plan: "11"
subsystem: testing
tags: [coverage, gates, negative-controls, node-runtime, lcov]

requires:
  - phase: 117-09
    provides: the corresponding-test gate and its planting control
  - phase: 117-10
    provides: the direct-coverage verdict control and the injectable project root
  - phase: 116-edge-surface
    provides: D-116-01a, the accepted single-branch shortfall regime for seven edge modules
provides:
  - An all-pair coverage run that asserts its own completeness and mapping injectivity on every invocation
  - A --report path that retains one newline-delimited record per pair, written incrementally
  - Six planted control states against the exported completeness assertion, one passing and five refusing
  - A measured, per-row verdict for all 204 inventory rows on both interpreters present on this machine
  - The measured composition of COV-05's 204 rows, which contradicts D-117-20
affects: [117-12, COV-05, SUITE-05, D-116-01a, D-117-20]

actuals:
  tokens: 8500
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "An all-pair gate asserts completeness over its own enumeration, not just per-item correctness"
    - "Injectivity is asserted as the invariant that makes ambiguity unreachable, rather than as a check that could never fire"

key-files:
  created: []
  modified:
    - scripts/test-coverage-direct.mjs
    - scripts/test-coverage-direct.negative.mjs
    - .planning/phases/117-extension-entry-and-final-gate/deferred-items.md
    - .planning/WINDOWS.md

key-decisions:
  - "The round-trip assertion answers COV-02's remaining half: path-level ambiguity is unreachable under the one-to-one name mapping, so the invariant that makes it unreachable is asserted instead of a check that could never fire."
  - "A fifth and sixth control state were added beyond the plan's four, so that all four checks of the completeness assertion are planted; without them the count check and the test-path half of the repeat check would have shipped unplanted."
  - "The all-pair artifacts were NOT written. The run cannot complete on this tree, and writing a result the run did not produce is the one thing the plan's prohibitions forbid outright."
  - "Concurrency stays undecided. D-117-11 forbids an unmeasured choice, and no complete all-pair duration exists to decide against."

patterns-established:
  - "Plant every check an assertion carries, not only the ones the plan enumerated. A check no control state reaches would stay green under its own plant, and the plan's own rule calls that a finding."
  - "When two runtimes disagree, sweep every row on both and tabulate, rather than reporting the first failure each produced."

requirements-completed: []

coverage:
  - id: D1
    description: "The all-pair run asserts completeness and mapping injectivity on every invocation, and retains one newline-delimited record per pair when a report path is given"
    requirement: "COV-03"
    verification:
      - kind: unit
        ref: "scripts/test-coverage-direct.negative.mjs#all-pair completeness states"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.negative.mjs (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The completeness assertion is planted rather than read back: each of its four checks was relaxed in turn and the control turned red on all four"
    requirement: "COV-04"
    verification:
      - kind: other
        ref: "four gate plants driven from a byte-exact pristine copy; verbatim output recorded in this summary"
        status: pass
    human_judgment: false
  - id: D3
    description: "A retained 204-row all-pair result for COV-05"
    requirement: "COV-05"
    verification: []
    human_judgment: true
    rationale: "NOT DELIVERED. The all-pair run cannot complete on this tree: it throws on the first of the seven accepted D-116-01a single-branch shortfalls. Resolving this needs an operator decision, because the obvious workaround is the coverage-exception allowlist D-116-01a bans outright."
  - id: D4
    description: "The five repository gates and three controls, run separately with their exit codes and runner-reported totals"
    requirement: "SUITE-05"
    verification:
      - kind: other
        ref: "typecheck, lint, fallow, npm test, npm run test:integration plus three controls; every exit code tabulated below"
        status: pass
    human_judgment: true
    rationale: "npm test is green on /usr/bin/node v22.22.2 (5142/0) and RED on the PATH interpreter v26.8.1 (5131 pass, 11 fail) after an unattended upgrade mid-plan. Which runtime SUITE-05 is discharged against is an operator call."

duration: 50 min
completed: 2026-09-03
status: halted
---

# Phase 117 Plan 11: All-Pair Coverage Run Summary

**The all-pair run is now a self-checking gate with a retained, line-oriented result and a six-state planting control — and running it measured that it cannot complete on this tree, because seven of the 204 rows are accepted single-branch shortfalls the gate has no vocabulary for.**

## Performance

- **Duration:** ~50 min (dispatch to close; the first task commit landed at 2026-09-03T20:38:04Z)
- **Completed:** 2026-09-03T21:20:00Z
- **Tasks:** 1 of 2 completed; Task 2 halted at its own gate
- **Files modified:** 4

## Accomplishments

- `scripts/test-coverage-direct.mjs` now answers with a record per pair and asserts its own completeness and mapping injectivity on **every** all-pair invocation, report or no report.
- `--all --report <path>` retains one newline-delimited JSON record per line, appended as each pair lands, so an interrupted run leaves a readable partial. This was confirmed accidentally: an interrupted run left a well-formed 83-row file.
- The control drives **six** states through the exported assertion and each of the assertion's four checks was planted in turn, all four turning it red.
- Every one of the 204 rows was given a verdict on **both** interpreters present on this machine — a measurement the plan asked for and that no earlier plan had taken.

## Task Commits

1. **Task 1: Make the all-pair run self-checking and able to retain its result** — `c47ad76f` (feat)

**Plan metadata:** this commit (docs)

Task 2 produced no commit. Its artifacts were deliberately not written; see "Why this plan halted".

## Files Created/Modified

- `scripts/test-coverage-direct.mjs` — per-pair records, `--all --report <path>`, the exported `assertReportComplete`, and a printed elapsed-wall-clock and interpreter-version line
- `scripts/test-coverage-direct.negative.mjs` — six states against the completeness assertion, all earlier plants untouched
- `.planning/phases/117-extension-entry-and-final-gate/deferred-items.md` — findings 4 and 5
- `.planning/WINDOWS.md` — ledger entries 27 and 28

## Why this plan halted

### The measurement

The all-pair run was executed three times and never completed. Sweeping **every** row on both interpreters, using the gate's own `assertCompleteCoverage`, gives the full picture:

| Runtime | ok | failing | breakdown |
| --- | --- | --- | --- |
| `/usr/bin/node` v22.22.2 | 197 | 7 | 7 coverage shortfalls, all under `edge/` |
| PATH node v26.8.1 | 187 | 17 | the same 7 shortfalls, plus 10 pairs whose tests fail |

The seven failing modules, each short by **exactly one branch**:

| Module | measured | ledger |
| --- | --- | --- |
| `edge/args.ts` | branches 28/29, lines 86/89 | 21 |
| `edge/completions/data.ts` | branches 109/110 | 16 |
| `edge/completions/provider.ts` | branches 79/80 | 17 |
| `edge/handlers/marketplace/update.ts` | branches 11/12 | 15 |
| `edge/handlers/plugin/import.ts` | branches 11/12 | 18 |
| `edge/handlers/plugin/pending.ts` | branches 9/10 | 19 |
| `edge/handlers/shared.ts` | branches 14/15, lines 83/85 | 22 |

Those are **precisely** the seven `open` D-116-01a claimants in `.planning/WINDOWS.md`, same files, same lines. Nothing regressed. The operator accepted each of these shortfalls in the previous phase, each is already pinned by its own pair's suite, and D-116-01a's standing rule is "no coverage-exception pragma, ever".

### What that does to COV-05

The true composition of the 204 rows is:

**190 complete numeric records + 7 accepted single-branch shortfalls + 7 type-only verdicts.**

D-117-20 reads COV-05 as "197 numeric records plus 7 named type-only rows". That reading does not account for the seven D-116-01a rows and **cannot be satisfied on this tree**. The plan's own `must_haves` inherited it verbatim ("a numeric coverage record for each of the 197 emitting modules"), so the plan's success criterion is unreachable as written.

The seven type-only rows, measured rather than assumed, are exactly the seven D-117-16 named:

- `extensions/pi-claude-marketplace/bridges/agents/types.ts`
- `extensions/pi-claude-marketplace/bridges/commands/types.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts`
- `extensions/pi-claude-marketplace/bridges/skills/types.ts`
- `extensions/pi-claude-marketplace/edge/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/types.ts`

### Why it was not fixed here

Every available route is closed to this plan:

- Teaching the gate about accepted shortfalls is an allowlist — the coverage exception D-116-01a bans and this plan's prohibitions repeat ("no coverage exception or ignore pragma").
- Task 2 forbids editing the gate script at all; its `<verify>` ends with `git diff --quiet -- ... scripts/ ...`.
- Closing the seven branches needs production edits. D-117-13 opens no production licence, and six of the seven are compiler-forced or structurally unreachable by measurement recorded in the ledger.
- Writing the artifacts anyway would report a coverage result the run did not produce, which the plan's first prohibition forbids outright.

The partial 83-row report the aborted run left behind was **removed**, not committed. A partial file named `117-ALL-PAIR-RESULT.ndjson` that stops mid-`edge/` is worse than no file.

## Second finding: the interpreter changed mid-plan

`/home/linuxbrew/.linuxbrew/bin/node` moved from **v26.7.0** — the version D-117-18 measured and this phase's `npm test` baseline was taken on — to **v26.8.1** while this plan was executing. The Cellar no longer holds 26.7.0, so the runtime the phase's numbers were measured on is gone from this machine.

On v26.8.1, an `EISDIR` error raised by `readFile` on a directory carries a `path` property. On v26.7.0 and v22.22.2 it does not. Eleven whole-value assertions across ten suites compare against `path: undefined` and now fail:

`bridges/agents/marker`, `bridges/agents/unstage`, `bridges/mcp/parse`, `bridges/mcp/stage` (two cases), `bridges/mcp/unstage`, `orchestrators/import/settings`, `orchestrators/plugin/install`, `orchestrators/plugin/reinstall`, `persistence/config-io`, `persistence/state-io`.

This is the same class D-117-18 warned about — a whole-value comparison that captures a value the runtime owns — generalised from parser text to an errno field. CI is unaffected: `.github/workflows/ci.yml` pins `node-version: "24"` at lines 70, 91, 111 and 132.

The first all-pair attempt also died with a silent, output-free child kill on an unrelated pair; the machine was at 5 GB available of 96 GB at the time and the interpreter's install tree was being replaced underneath the run. That attempt is reported for completeness and nothing is concluded from it.

## The three decisions the plan asked for

- **The COV-05 reading.** Not settled as D-117-20 states it. The measured composition is 190 + 7 + 7, not 197 + 7. Recorded, not resolved — resolving it is the operator decision below.
- **The runtime label.** No Node 24 exists on this machine, and now no Node 26.7 either. Nothing in this plan is labelled a Node 24 result. Success criterion 3's runtime half is satisfied by CI, which pins 24 in the four places cited above; its record half is **not** satisfied, because no complete all-pair record exists.
- **Concurrency: undecided, deliberately.** D-117-11 forbids an unmeasured choice, and no complete all-pair duration exists to decide against — every run aborted. The only bound measured is that a full 204-row sweep exceeds ten minutes on this machine. The default disposition (do not add concurrency) therefore stands unchanged and unconfirmed. Research's shared-state finding is recorded for whoever revisits it: per-pair temporary coverage directories, a process-scoped socket path, per-process working-directory and environment changes, no writes into the repository, and lockfiles guarding only temporary scope roots — so the cost of parallelism is interleaved output rather than correctness, and the report file removes that cost.

## The aggregate exclusion still holds

Measured on the entry pair rather than argued: run alone, `index-smoke.test.ts` emits `BRDA:118,6,0,0` — the `catch (notifyErr)` at line 118 is never entered. Merged with `index-handler.test.ts`, V8 emits **no branch range for line 118 at all** and lines 119-123 report a hit count of 1. The merged report shows that region as covered when neither suite executed it. The aggregate is not merely weaker than the per-pair run; it is wrong in the safe direction. Nothing in this summary comes from `coverage/unit.lcov`.

## Gate results (SUITE-05), each run separately and read unpiped

| Gate | Exit | Runner-reported total |
| --- | --- | --- |
| `npm run typecheck` | 0 | no `error TS` lines |
| `npm run lint` | 0 | no problem lines |
| `npm run fallow` | 0 | 825 lines (1.2%) duplicated across 36 files, under threshold |
| `npm test` (v22.22.2) | 0 | tests 5142, suites 295, pass 5142, fail 0 |
| `npm test` (v26.8.1) | **1** | tests 5142, suites 295, pass 5131, **fail 11** |
| `npm run test:integration` (v22.22.2) | 0 | tests 31, pass 31, fail 0 |
| `npm run test:integration` (v26.8.1) | 0 | tests 31, pass 31, fail 0 |
| `npm run test:corresponding` | 0 | `Corresponding-test gate passed.` |
| `npm run test:corresponding:negative` | 0 | `Corresponding-test negative controls passed.` |
| `npm run test:coverage:direct:negative` | 0 | `Direct-coverage negative controls passed.` |
| `node scripts/test-coverage-direct.mjs --all` | **1** | aborts on the first D-116-01a claimant, both runtimes |

`npm run check` was not used: its `format:check` link fails on the operator's pre-existing untracked files and short-circuits before the tests run. SUITE-05 names that aggregate command; it cannot speak in this checkout, which is why the gates are reported separately above.

Focused readings taken during Task 1, both exit 0:

- `extensions/pi-claude-marketplace/index.ts` — `branches 15/15, functions 3/3, lines 161/161`
- `extensions/pi-claude-marketplace/edge/types.ts` — `type-only`

## The four plants, verbatim

A byte-exact copy of the gate was taken first (`sha256 1eb2791b…`), each check relaxed in turn, the control run, and the gate restored from that copy. After the last restore the file hashed identically and `git diff` showed only the intended Task 1 change.

**Plant A — repeat check** (`return [...repeated].sort()` → `return []`), exit 1:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  Comparison {
+   message: 'Missing from the all-pair result: extensions/pi-claude-marketplace/shared/gamma.ts'
-   message: 'Repeated sourcePath in the all-pair result: extensions/pi-claude-marketplace/domain/beta.ts'
  }
```

**Plant B — round-trip check** (the condition replaced with `false`), exit 1:

```
AssertionError [ERR_ASSERTION]: Missing expected exception.
  expected: {
    message: 'Mapping does not round-trip in the all-pair result: extensions/pi-claude-marketplace/shared/gamma.ts <-> tests/shared/delta.test.ts'
  },
```

**Plant C — missing check** (`missing.length > 0` → `> 3`), exit 1:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  Comparison {
+   message: 'Expected 3 all-pair records, found 2'
-   message: 'Missing from the all-pair result: extensions/pi-claude-marketplace/domain/beta.ts'
  }
```

**Plant D — count check** (the condition replaced with `false`), exit 1:

```
AssertionError [ERR_ASSERTION]: Missing expected exception.
  expected: { message: 'Expected 3 all-pair records, found 4' },
```

Plants A and C fell through to a downstream check rather than passing silently. That is still a refusal and still red — each named a verdict other than the one its state claims, which a whole-value comparison rejects. No plant stayed green.

## Decisions Made

- **Six control states, not four.** The plan specified one passing state and three refusals. Those three reach only three of the assertion's four checks; the count check and the test-path half of the repeat check would have shipped unplanted, and a plant on an unreachable check stays green — which the plan itself calls a finding. Two states were added to close that.
- **The artifacts were not written.** See "Why this plan halted".
- **`requirements-completed` is empty.** COV-03 and COV-04 are discharged by Task 1, but this phase's requirement IDs are shared across plans and D-117-12 owns the sweep. COV-05 and SUITE-05 are explicitly **not** met, and marking them would be false.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Two extra control states so every check is planted**

- **Found during:** Task 1
- **Issue:** the plan's four states reach three of the assertion's four checks. A plant on the count check, or on the test-path half of the repeat check, would have stayed green — the condition the plan itself names a finding.
- **Fix:** added a shared-test-path state and an unenumerated-extra-row state.
- **Files modified:** `scripts/test-coverage-direct.negative.mjs`
- **Verification:** Plant D (count check) turns the control red; without the sixth state it would not.
- **Committed in:** `c47ad76f`

**2. [Rule 3 - Blocking] Ran the all-pair sweep on both interpreters**

- **Found during:** Task 2
- **Issue:** the gate aborts on its first failure, so a single run reports one row and hides the extent. Two runtimes disagreed, and neither first failure was the whole story.
- **Fix:** a scratch driver in the session scratchpad — never in the repository — reusing the gate's own exported `assertCompleteCoverage` and continuing past failures, so every row got a verdict on both runtimes.
- **Files modified:** none in the repository.
- **Verification:** the seven modules it names match the seven `open` D-116-01a ledger entries exactly, file for file.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** neither widened scope. The first strengthened a control the plan under-specified; the second turned an opaque abort into the measurement the halt rests on.

## Issues Encountered

Both are recorded in full above and filed for the sweep:

1. **The all-pair run cannot complete on this tree** — the seven accepted D-116-01a shortfalls. `deferred-items.md` item 4, ledger entry 27.
2. **The PATH interpreter was upgraded mid-plan** — v26.7.0 to v26.8.1, reddening 11 tests across 10 suites. `deferred-items.md` item 5, ledger entry 28.

Neither is repairable inside this plan's licence.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**This plan is halted and needs an operator decision before COV-05 can close.** The question is narrow:

> How should `test:coverage:direct:all` represent the seven accepted D-116-01a single-branch shortfalls, given that D-116-01a bans a coverage-exception pragma outright?

Sketched options, for the operator to choose among rather than for an executor to pick:

- **Read COV-05 as 190 + 7 + 7** and amend D-117-20 to say so, leaving the gate's behaviour alone and treating a non-zero `--all` exit as expected on this tree. Cheapest; leaves the phase without a green all-pair gate.
- **Let the run classify a ledgered shortfall as a distinct verdict** — neither pass nor silent — keyed to `.planning/WINDOWS.md` rather than to an inline allowlist, so the exception lives in the register the operator already maintains. Needs its own planting control and is arguably the pragma D-116-01a bans wearing different clothes.
- **Open a production licence** to close the seven branches. Six are compiler-forced or structurally unreachable by recorded measurement, so this is the largest option and probably the wrong one.

Separately, the operator should decide which interpreter this tree targets. `npm test` is green on v22.22.2 and red on the v26.8.1 now on PATH; CI pins 24, which is installed nowhere on this machine.

Task 1's work is complete, committed and green, and is independent of that decision.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*

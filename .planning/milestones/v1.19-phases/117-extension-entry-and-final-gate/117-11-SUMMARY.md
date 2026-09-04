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
  - A retained 204-row all-pair direct coverage result, with every row carrying a verdict
  - The amended reading of COV-05, measured: 190 complete + 7 accepted shortfalls + 7 type-only
  - Ten test suites hardened against a runtime-owned errno field, green on v22.22.2 and v26.8.1 alike
  - An all-pair coverage run that asserts its own completeness and mapping injectivity on every invocation
  - A --report path that retains one newline-delimited record per pair, written incrementally
  - Six planted control states against the exported completeness assertion, one passing and five refusing
  - A measured, per-row verdict for all 204 inventory rows on both interpreters present on this machine
  - The measured composition of COV-05's 204 rows, which contradicts D-117-20
affects: [117-12, COV-05, SUITE-05, D-116-01a, D-117-20]

actuals:
  tokens: 21000
  tasks: 2
  commits: 6

tech-stack:
  added: []
  patterns:
    - "An all-pair gate asserts completeness over its own enumeration, not just per-item correctness"
    - "Injectivity is asserted as the invariant that makes ambiguity unreachable, rather than as a check that could never fire"

key-files:
  created:
    - .planning/phases/117-extension-entry-and-final-gate/117-ALL-PAIR-RESULT.ndjson
    - .planning/phases/117-extension-entry-and-final-gate/117-ALL-PAIR-RESULT.md
  modified:
    - scripts/test-coverage-direct.mjs
    - scripts/test-coverage-direct.negative.mjs
    - tests/bridges/agents/marker.test.ts
    - tests/bridges/agents/unstage.test.ts
    - tests/bridges/mcp/parse.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/unstage.test.ts
    - tests/orchestrators/import/settings.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/persistence/config-io.test.ts
    - tests/persistence/state-io.test.ts
    - .planning/phases/117-extension-entry-and-final-gate/deferred-items.md
    - .planning/WINDOWS.md

key-decisions:
  - "The round-trip assertion answers COV-02's remaining half: path-level ambiguity is unreachable under the one-to-one name mapping, so the invariant that makes it unreachable is asserted instead of a check that could never fire."
  - "A fifth and sixth control state were added beyond the plan's four, so that all four checks of the completeness assertion are planted; without them the count check and the test-path half of the repeat check would have shipped unplanted."
  - "D-117-20 is amended to 190 + 7 + 7 (operator decision). The gate is deliberately unchanged, no ledger-keyed verdict is added and no production licence is opened."
  - "The errno path and the errno message text are runtime-owned, not contractual. Ten suites now pin name, code and syscall, and read the runtime's own wording back where production composes a sentence around it."
  - "Concurrency is NOT added, decided against a measured 533.2 s for all 204 rows."
  - "The retained result is produced by driving the shipped gate once per row, because the gate's own --all stops at the first accepted shortfall after 83 rows."

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
    description: "A retained 204-row all-pair result: 190 complete numeric records, 7 accepted D-116-01a shortfalls named with their branch AND line dimensions, 7 type-only verdicts named by path"
    requirement: "COV-05"
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs <source> driven once per row; 204 rows retained in 117-ALL-PAIR-RESULT.ndjson"
        status: pass
      - kind: other
        ref: "row count equals the enumerated module count; 204 distinct source paths and 204 distinct test paths"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ten suites hardened to stop asserting a runtime-owned errno field, so the tree behaves identically on v22.22.2 and v26.8.1"
    verification:
      - kind: unit
        ref: "the ten affected suites, 411/411 on both v22.22.2 and v26.8.1"
        status: pass
      - kind: unit
        ref: "npm test on v26.8.1: 5142 tests, 295 suites, 0 fail (was 5131 pass / 11 fail)"
        status: pass
      - kind: other
        ref: "five plants: wrong code, wrong syscall, wrong composed prefix, broken composition pin, and the old literal restored in place of the probe"
        status: pass
    human_judgment: false
  - id: D4
    description: "The five repository gates and three controls, run separately with their exit codes and runner-reported totals"
    requirement: "SUITE-05"
    verification:
      - kind: other
        ref: "typecheck, lint, fallow, npm test, npm run test:integration plus three controls; every exit code tabulated below"
        status: pass
    human_judgment: false

duration: 2h 20m
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 11: All-Pair Coverage Run Summary

**A self-checking all-pair gate, a retained 204-row result reading 190 complete records + 7 accepted D-116-01a shortfalls + 7 type-only verdicts, and ten suites hardened so a runtime-owned errno field stops being load-bearing.**

## Performance

- **Duration:** ~2h 20m, including a halt for an operator decision and its resumption
- **Completed:** 2026-09-03T22:15:00Z
- **Tasks:** 2 of 2, plus one authorized scope addition
- **Files modified:** 16

## Accomplishments

- **A retained 204-row all-pair result exists** — `117-ALL-PAIR-RESULT.ndjson` plus a human-readable `117-ALL-PAIR-RESULT.md` — reading 190 complete numeric records, 7 accepted D-116-01a shortfalls with both their branch and line dimensions, and 7 type-only verdicts named by path. COV-05's "result" finally has a referent.
- **Ten suites no longer assert a runtime-owned errno field**, so the tree behaves identically on v22.22.2 and v26.8.1. `npm test` on the upgraded interpreter went from 5131 pass / 11 fail to **5142 / 295 / 0**.
- `scripts/test-coverage-direct.mjs` now answers with a record per pair and asserts its own completeness and mapping injectivity on **every** all-pair invocation, report or no report.
- `--all --report <path>` retains one newline-delimited JSON record per line, appended as each pair lands, so an interrupted run leaves a readable partial. This was confirmed accidentally: an interrupted run left a well-formed 83-row file.
- The control drives **six** states through the exported assertion and each of the assertion's four checks was planted in turn, all four turning it red.
- Every one of the 204 rows was given a verdict on **both** interpreters present on this machine — a measurement the plan asked for and that no earlier plan had taken.

## Task Commits

1. **Task 1: Make the all-pair run self-checking and able to retain its result** — `c47ad76f` (feat)
2. **Halt record and findings** — `172a0ec5` (docs), `eb6264ed` (docs), `664771e8` (docs)
3. **Authorized scope addition: stop asserting a runtime-owned errno field** — `94b19f6a` (test)
4. **Task 2: the retained 204-row result and the three decisions** — this commit (docs)

## Files Created/Modified

- `.planning/phases/117-extension-entry-and-final-gate/117-ALL-PAIR-RESULT.ndjson` — 204 records, one per inventory row
- `.planning/phases/117-extension-entry-and-final-gate/117-ALL-PAIR-RESULT.md` — the totals, the seven type-only rows by path, the seven shortfalls with branch and line dimensions, the runtime, the elapsed wall clock, the concurrency decision and the aggregate exclusion
- `scripts/test-coverage-direct.mjs` — per-pair records, `--all --report <path>`, the exported `assertReportComplete`, and a printed elapsed-wall-clock and interpreter-version line
- `scripts/test-coverage-direct.negative.mjs` — six states against the completeness assertion, all earlier plants untouched
- ten `*.test.ts` files under `tests/bridges/`, `tests/orchestrators/` and `tests/persistence/` — the errno hardening
- `.planning/phases/117-extension-entry-and-final-gate/deferred-items.md` — findings 4 and 5
- `.planning/WINDOWS.md` — ledger entries 27 and 28

## The halt, and how it was resolved

### The measurement that caused it

The all-pair run was executed three times and never completed. Sweeping **every** row on both interpreters, using the gate's own `assertCompleteCoverage`, gives the full picture:

| Runtime | ok | failing | breakdown |
| --- | --- | --- | --- |
| `/usr/bin/node` v22.22.2 | 197 | 7 | 7 coverage shortfalls, all under `edge/` |
| PATH node v26.8.1, before hardening | 187 | 17 | the same 7 shortfalls, plus 10 pairs whose tests fail |
| PATH node v26.8.1, after hardening | 197 | 7 | identical to v22.22.2 |

The seven failing modules. Each is short by exactly one **branch**; two are also short on
**lines**, which is the guard body itself, and reporting them as "one branch each" would
have been silently wrong about those two:

| Module | Branches | Lines | ledger |
| --- | --- | --- | --- |
| `edge/args.ts` | 28/29 | **86/89** | 21 |
| `edge/completions/data.ts` | 109/110 | complete | 16 |
| `edge/completions/provider.ts` | 79/80 | complete | 17 |
| `edge/handlers/marketplace/update.ts` | 11/12 | complete | 15 |
| `edge/handlers/plugin/import.ts` | 11/12 | complete | 18 |
| `edge/handlers/plugin/pending.ts` | 9/10 | complete | 19 |
| `edge/handlers/shared.ts` | 14/15 | **83/85** | 22 |

Functions are complete for all seven.

Those are **precisely** the seven `open` D-116-01a claimants in `.planning/WINDOWS.md`, same files, same lines. Nothing regressed. The operator accepted each of these shortfalls in the previous phase, each is already pinned by its own pair's suite, and D-116-01a's standing rule is "no coverage-exception pragma, ever".

### What that does to COV-05

The true composition of the 204 rows is:

**190 complete numeric records + 7 accepted single-branch shortfalls + 7 type-only verdicts.**

D-117-20 read COV-05 as "197 numeric records plus 7 named type-only rows". That reading does not account for the seven D-116-01a rows and cannot be satisfied on this tree. The plan's own `must_haves` inherited it verbatim ("a numeric coverage record for each of the 197 emitting modules").

**Operator decision, 2026-09-03: D-117-20 is amended to 190 + 7 + 7.** The gate is deliberately NOT changed, no ledger-keyed verdict is added, and no production licence is opened — a ledger-keyed pass would be D-116-01a's banned pragma wearing a different hat, and the seven are already pinned by identity in their own pairs. The decision record moves to meet the measurement, not the other way round.

The seven type-only rows, measured rather than assumed, are exactly the seven D-117-16 named:

- `extensions/pi-claude-marketplace/bridges/agents/types.ts`
- `extensions/pi-claude-marketplace/bridges/commands/types.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts`
- `extensions/pi-claude-marketplace/bridges/skills/types.ts`
- `extensions/pi-claude-marketplace/edge/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/types.ts`

### How the result was produced under that decision

The gate stays as it is, so its own `--all` still refuses the first accepted shortfall and stops. Measured: `node scripts/test-coverage-direct.mjs --all --report <path>` exits 1 having retained **83 rows**, stopping at `edge/args.ts`.

So each row's verdict in the retained result comes from the **shipped gate command driven once per row** (`node scripts/test-coverage-direct.mjs <source>`), with its exit code recorded in the record. No gate logic was reimplemented and no gate file was edited — `git diff --quiet -- scripts/` exits 0 for the whole of Task 2.

The result is `117-ALL-PAIR-RESULT.ndjson` (204 lines, 204 distinct source paths, 204 distinct test paths) and `117-ALL-PAIR-RESULT.md`, which carries the totals, the seven type-only rows by path, the seven shortfalls with both their branch and line dimensions, the runtime, the elapsed wall clock and the concurrency decision.

## Second finding: the interpreter changed mid-plan — resolved by hardening

`/home/linuxbrew/.linuxbrew/bin/node` moved from **v26.7.0** — the version D-117-18 measured and this phase's `npm test` baseline was taken on — to **v26.8.1** while this plan was executing. The Cellar no longer holds 26.7.0, so the runtime the phase's numbers were measured on is gone from this machine.

On v26.8.1, an `EISDIR` error raised by `readFile` on a directory carries a `path` property. On v26.7.0 and v22.22.2 it does not. Eleven whole-value assertions across ten suites compare against `path: undefined` and now fail:

`bridges/agents/marker`, `bridges/agents/unstage`, `bridges/mcp/parse`, `bridges/mcp/stage` (two cases), `bridges/mcp/unstage`, `orchestrators/import/settings`, `orchestrators/plugin/install`, `orchestrators/plugin/reinstall`, `persistence/config-io`, `persistence/state-io`.

This is the same class D-117-18 warned about — a whole-value comparison that captures a value the runtime owns — generalised from parser text to an errno field. CI is unaffected: `.github/workflows/ci.yml` pins `node-version: "24"` at lines 70, 91, 111 and 132.

**Operator decision: harden the assertions in this plan, as an authorized scope addition.** Recorded as a deviation below.

**The real set, re-derived from the files rather than from the failure log: 12 sites across 10 files**, not the 16 across 7 suites the log suggested. Two projected the errno `path`; ten pinned the errno message text. `tests/bridges/commands/unstage.test.ts` also carries an EISDIR literal and was correctly left alone — its `unlink` message is path-based and has always carried the path, which is why that suite never failed.

The hardening keeps every comparison whole-value:

| Shape | Sites | Treatment |
| --- | --- | --- |
| Projection reading the errno `path` | `mcp/parse`, `agents/marker` | drop `path`; `name`, `code` and `syscall` stay pinned |
| Projection pinning the bare errno message, already carrying `code`/`syscall` | `mcp/stage` ×2, `mcp/unstage` | drop `message`; the code and syscall it derives from are the stricter claim |
| Production composes its own sentence around the failure | `config-io`, `import/settings`, `agents/unstage`, `plugin/install`, `plugin/reinstall` | read the runtime's own wording back from the same failing read, so the wrapper stays pinned as a whole value |
| Outer message wraps a cause the test already asserts | `state-io` | compose the expectation from `cause.message`, which additionally pins the relationship |

Measured after: the ten suites are **411/411 on both v22.22.2 and v26.8.1**, and `npm test` on v26.8.1 is **5142 tests, 295 suites, 0 fail** — it was 5131 pass / 11 fail before. The two interpreters now produce byte-identical all-pair verdicts, which is the evidence the change addressed a runtime artifact rather than masking a defect.

Five plants confirm the assertions still fire, each turning exactly its own suite red:

| Plant | Change | Result |
| --- | --- | --- |
| E | expected `code` `EISDIR` → `ENOTDIR` | exit 1, `propagates a non-missing scoped document read failure` |
| F | expected `syscall` `read` → `write` | exit 1, 11 pass / 1 fail |
| G | composed prefix `read failed: ` → `read broke: ` | exit 1, `returns the complete ordinary read failure` |
| H | probe replaced by the OLD hardcoded literal | exit 1 — proves the probe is load-bearing |
| I | outer message composed from `cause.name` instead of `cause.message` | exit 1, 39 pass / 1 fail |

Plant H is the one that matters most: putting the old literal back turns the test red on v26.8.1, so the hardening is not a no-op dressed up as one. All four planted files were restored byte-for-byte from copies taken beforehand and verified with `cmp`.

The first all-pair attempt also died with a silent, output-free child kill on an unrelated pair; the machine was at 5 GB available of 96 GB at the time and the interpreter's install tree was being replaced underneath the run. That attempt is reported for completeness and nothing is concluded from it.

## The three decisions the plan asked for

- **The COV-05 reading: 190 + 7 + 7.** D-117-20 is amended to the measured composition. Not resolved by a pragma, not by a ledger-keyed verdict, not by weakening the other 197, and not by a production licence. The gate is unchanged and each of the seven still exits 1.
- **The runtime label: Node v26.8.1, said plainly.** No Node 24 exists on this machine, and no Node 26.7 either — the Cellar holds only 26.8.1 and `/usr/bin/node` is v22.22.2. Nothing in this plan is labelled a Node 24 result, and the artifact is scanned to prove it. Success criterion 3 is satisfied in two halves: **by CI for the runtime**, which pins 24 at `.github/workflows/ci.yml` lines 70, 91, 111 and 132, and **by the retained artifact for the record**.
- **Concurrency: NOT added, decided against a measured number.** The run took **533.2 s** — under nine minutes — for all 204 rows, read from the runner's own printed line and not computed by subtracting timestamps. Per-row: minimum 962 ms, median 2925 ms, maximum 10249 ms, the tail being the plugin orchestrators (`reinstall.ts` 10249 ms, `install.ts` 8622 ms, `update.ts` 8208 ms). Nine minutes at a phase boundary does not justify D-117-11's obligation — a second planting control proving a deliberately failing pair is still detected when runs interleave. That figure includes 204 separate interpreter startups the gate's own `--all` would not pay, so it is an upper bound; it is quoted as what it is. Research's shared-state finding is recorded for whoever revisits it: per-pair temporary coverage directories, a process-scoped socket path, per-process working-directory and environment changes, no writes into the repository, and lockfiles guarding only temporary scope roots — so the cost of parallelism would be interleaved output rather than incorrectness, and the report file this plan added already removes that cost. The decision is about the obligation, not about safety.

## The aggregate exclusion still holds

Measured on the entry pair rather than argued: run alone, `index-smoke.test.ts` emits `BRDA:118,6,0,0` — the `catch (notifyErr)` at line 118 is never entered. Merged with `index-handler.test.ts`, V8 emits **no branch range for line 118 at all** and lines 119-123 report a hit count of 1. The merged report shows that region as covered when neither suite executed it. The aggregate is not merely weaker than the per-pair run; it is wrong in the safe direction. Nothing in this summary comes from `coverage/unit.lcov`.

## Gate results (SUITE-05), each run separately and read unpiped

| Gate | Exit | Runner-reported total |
| --- | --- | --- |
| `npm run typecheck` | 0 | no `error TS` lines |
| `npm run lint` | 0 | no problem lines |
| `npm run fallow` | 0 | 825 lines (1.2%) duplicated across 36 files, under threshold |
| `npm test` (v26.8.1, after hardening) | 0 | tests 5142, suites 295, pass 5142, fail 0 |
| `npm test` (v22.22.2, before hardening) | 0 | tests 5142, suites 295, pass 5142, fail 0 |
| `npm test` (v26.8.1, before hardening) | 1 | tests 5142, suites 295, pass 5131, fail 11 |
| `npm run format:check` | 1 | 8 files, all the operator's pre-existing untracked `.mcp.json` and `.planning/research/.cache/*.json`; none touched by this plan |
| `npm run test:integration` (v22.22.2) | 0 | tests 31, pass 31, fail 0 |
| `npm run test:integration` (v26.8.1) | 0 | tests 31, pass 31, fail 0 |
| `npm run test:corresponding` | 0 | `Corresponding-test gate passed.` |
| `npm run test:corresponding:negative` | 0 | `Corresponding-test negative controls passed.` |
| `npm run test:coverage:direct:negative` | 0 | `Direct-coverage negative controls passed.` |
| `node scripts/test-coverage-direct.mjs --all --report <path>` | 1 | retains 83 rows, then refuses `edge/args.ts` — the expected behaviour under the amended D-117-20 |
| the shipped gate driven once per row, 204 rows | — | 190 complete, 7 type-only, 7 accepted shortfalls, in 533.2 s on v26.8.1 |

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
- **The retained result is produced by driving the shipped gate once per row.** The gate's own `--all` stops after 83 rows by design under the amended D-117-20, and the operator directed that the gate not be changed. Driving it externally reimplements nothing.
- **The errno `path` and the errno message text are runtime-owned, not contractual.** What production owns is the composition around the failure, and that is what the hardened sites now pin.
- **`requirements-completed` is empty.** COV-03, COV-04, COV-05, OWN-03 and SUITE-05 are all discharged by this plan's work, but this phase's requirement IDs are shared across plans and D-117-12 owns the sweep. Marking them here would flip a shared ID before its last claimant lands.

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

**3. [Authorized scope addition] Hardened ten suites against a runtime-owned errno field**

- **Found during:** Task 2
- **Authorization:** operator decision, 2026-09-03, explicitly beyond this plan's `files_modified`.
- **Issue:** a package upgrade replaced the PATH interpreter mid-plan; eleven whole-value assertions pinned the older runtime's errno wording and went red while the behaviour under test was unchanged.
- **Fix:** stop asserting the runtime-owned field; keep `name`, `code` and `syscall` whole-value, and read the runtime's own wording back where production composes a sentence around the failure.
- **Files modified:** ten `*.test.ts` files under `tests/bridges/`, `tests/orchestrators/` and `tests/persistence/`. No production file.
- **Verification:** the ten suites 411/411 on both interpreters; `npm test` 5142/295/0 on v26.8.1; five plants each turning exactly its own suite red; `git diff --quiet -- extensions/` exit 0.
- **Committed in:** `94b19f6a`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking) + 1 authorized scope addition
**Impact on plan:** none widened scope unbidden. The first strengthened a control the plan under-specified; the second turned an opaque abort into the measurement the halt rested on; the third was directed by the operator after that halt.

## Issues Encountered

Both were escalated to the operator, both were answered, and **both are now closed**:

1. **The all-pair run cannot complete on this tree** — the seven accepted D-116-01a shortfalls. Resolved by amending D-117-20 to 190 + 7 + 7 and leaving the gate alone. `deferred-items.md` item 4 (RESOLVED), ledger entry 27 (fixed).
2. **The PATH interpreter was upgraded mid-plan** — v26.7.0 to v26.8.1, reddening 11 tests across 10 suites. Resolved by hardening the assertions under an authorized scope addition. `deferred-items.md` item 5 (RESOLVED), ledger entry 28 (fixed).

A third, transient issue is recorded and nothing is concluded from it: the first all-pair attempt died with a silent, output-free child kill on an unrelated pair, while the machine was at 5 GB available of 96 GB and the interpreter's install tree was being replaced underneath the run. It did not recur.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Both blocking questions are answered and closed. What 117-12 inherits:

- **D-117-20 must be amended in `117-CONTEXT.md`** to read 190 + 7 + 7. This summary and `117-ALL-PAIR-RESULT.md` both record the amendment; the decision record itself still carries the superseded 197 + 7 wording.
- **COV-05 and SUITE-05 are met** and can be marked in the sweep, together with COV-03, COV-04 and OWN-03. Nothing here marks a shared ID.
- **The seven D-116-01a claimants stay open** in `.planning/WINDOWS.md` (entries 15-19, 21, 22). They are accepted, not fixed, and each closes only by a production rewrite. Entries 27 and 28, opened by this plan, are closed.
- **`deferred-items.md` items 1-3 remain open** for the sweep. Items 4 and 5 are resolved.
- **The tree is green on both installed interpreters.** No Node 24 is installed here; CI pins it. If the operator wants a local Node 24 reading, that is an environment change, not a code one.

The phase's headline measurement now exists as a retained, checkable file rather than a terminal scrollback, which is what this plan was for.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*

## Self-Check: PASSED

Re-run after the halt was resolved:

- `scripts/test-coverage-direct.mjs`, `scripts/test-coverage-direct.negative.mjs` — present
- `117-ALL-PAIR-RESULT.ndjson` — present, 204 lines, 204 distinct source paths, 204 distinct
  test paths, verdicts 190 complete / 7 type-only / 7 accepted-shortfall
- `117-ALL-PAIR-RESULT.md` — present, names all seven type-only rows by path, names
  `edge/types.ts`, and carries no Node 24 label
- no artifact carries the plan-summary suffix; the phase directory holds 11 `*-SUMMARY.md`
  files for 11 plans
- `117-11-SUMMARY.md`, `deferred-items.md` — present
- commits `c47ad76f`, `172a0ec5`, `eb6264ed`, `664771e8`, `94b19f6a` — all in `git log`
- `git diff --quiet -- extensions/` — exit 0
- `git diff --quiet -- scripts/ package.json` — exit 0, unchanged since the Task 1 commit
- `node scripts/test-coverage-direct.negative.mjs` — exit 0, all six states pass
- `node scripts/check-corresponding-tests.mjs` — exit 0
- `node scripts/check-corresponding-tests.negative.mjs` — exit 0

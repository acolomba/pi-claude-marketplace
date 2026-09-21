---
phase: 06-unused-type-member-gate
plan: "07"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, gate, negative-control, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable gate, the compiler read overlay and the three-way exit contract
  - phase: 06-unused-type-member-gate
    provides: The audit that records and reconciles the live population
  - phase: 06-unused-type-member-gate
    provides: The closed triage and the honest 138-row baseline the controls measure against
provides:
  - "`scripts/check-unused-type-members.negative.mjs`: seven executable controls that drive the real gate over the real repository through a compiler read overlay"
  - "A plant derived from the real `EdgeDeps` declaration's own structure, with its declaration identity counted out of the overlay text rather than read back from the analyzer"
  - "`--gate`, which points the controls at any executable, so the runner is measured against defective gates rather than trusted"
  - "`tests/scripts/check-unused-type-members.negative.test.ts`: 21 controls, twelve of them scripting a gate answer the runner must refuse"
  - "`tests/architecture/unused-type-member-gate.test.ts`: the plant-validity, gate-reachability and claim-to-control guards the executable controls cannot see from inside"
  - "The `lint:type-members:negative` package alias, deliberately still outside `npm run check`"
affects: [06-08]

actuals:
  tokens: 149712
  tasks: 2
  commits: 5
plan_head_before: 06ec0723da2b6a1728d04f687dc8eb574bc74fd8

tech-stack:
  added: []
  patterns:
    - "A sensitivity control plants into the real declaration through a compiler read overlay, never into a fixture that resembles it"
    - "A stand-in gate answers by invocation index, which pins the control order and lets one mechanism script both a faithful gate and a defective one"
    - "Expected report facts are written out in the control, never taken from the tool under control"
    - "A stated capability is bound to a named control, so a renamed case fails the gate rather than quietly widening what the tool is believed to prove"

key-files:
  created:
    - scripts/check-unused-type-members.negative.mjs
    - tests/scripts/check-unused-type-members.negative.test.ts
    - tests/architecture/unused-type-member-gate.test.ts
  modified:
    - tests/architecture/gate-targets.ts
    - package.json
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "The offender is planted into the real `EdgeDeps` declaration through a read overlay; a synthetic lookalike proves the analyzer can see a fixture, not that it can see this tree"
  - "Every control compares against the honest 138-row baseline, because the live tree does not report zero and a control written against a clean run would not run at all"
  - "The exit status is checked against what the report itself says, so a gate whose status and findings disagree is caught without the control guessing which to believe"
  - "A run that produced no report never reached a verdict, and saying so is what keeps `could not analyse` from reading as `found nothing`"
  - "A refusal must also name what it could not read, so no refusal can stand in for another"
  - "The runner does not replay the analyzer's category fixtures; the architecture gate binds each stated claim to a named landed control instead"
  - "The containment check is scoped to the two files the overlays stand in for, because a run takes minutes and a wider scope accuses the wrong files"

coverage:
  - deliverable: "The real gate reports a planted unread optional member on the real `EdgeDeps` declaration, by exact declaration identity, over and above the honest baseline"
    verification:
      - kind: command
        ref: "node scripts/check-unused-type-members.negative.mjs (control: offender-plant)"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#derives the plant from the real EdgeDeps declaration"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that reports the plant as read"
        status: pass
      - kind: test
        ref: "tests/architecture/unused-type-member-gate.test.ts#the planted key is absent from the real declaration it is planted into"
        status: pass
    human_judgment: false
  - deliverable: "Removing the plant, or reading it from a real receiver, clears exactly that finding; an unrelated same-spelling read does not"
    verification:
      - kind: command
        ref: "node scripts/check-unused-type-members.negative.mjs (controls: benign-receiver-read, unrelated-same-spelling-read, plant-removed)"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that keeps the plant a finding after a real receiver read"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that clears the offender when an unrelated type is read"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate whose report does not return to the baseline"
        status: pass
    human_judgment: false
  - deliverable: "A run the gate cannot complete stays distinguishable from a member verdict"
    verification:
      - kind: command
        ref: "node scripts/check-unused-type-members.negative.mjs (controls: compiler-failure, option-failure)"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that answers a refusal where a member finding belongs"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that answers a member finding where a refusal belongs"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that refuses without naming what it could not read"
        status: pass
    human_judgment: false
  - deliverable: "The controls reject an always-passing gate, and five other defective gates besides"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that always reports a clean tree"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that always reports the same findings"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate that describes a different member at the planted coordinates"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate whose report cannot be parsed"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate executable that cannot be launched"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#rejects a gate whose diagnostics the contract census does not explain"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#names every control it ran when a faithful gate answers"
        status: pass
    human_judgment: false
  - deliverable: "The overlays never reach disk, and the temporary ones are disposed of after a failure too"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#leaves the analysed sources byte-identical after a control fails"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.negative.test.ts#removes its temporary overlays after a control fails"
        status: pass
      - kind: command
        ref: "git diff 06ec0723..HEAD -- extensions/"
        status: pass
    human_judgment: false
  - deliverable: "Every capability the gate's help text claims is bound to a control that discriminates it"
    verification:
      - kind: test
        ref: "tests/architecture/unused-type-member-gate.test.ts#every capability the gate claims has a discriminating control"
        status: pass
      - kind: test
        ref: "tests/architecture/unused-type-member-gate.test.ts#every gate script is reachable from a package.json script entry"
        status: pass
    human_judgment: true
    rationale: "The gate checks that each claim is still stated and each named control still exists under that exact title. Whether the eleven rows are the right partition of what the analyzer claims -- and whether each named control is a strong proof of its row -- is a reader's judgment, recorded in the claim table below rather than asserted by a test."

requirements-completed: []

duration: 3h 5m
completed: 2026-09-15
---

# Phase 06 Plan 07: Live EdgeDeps Sensitivity and Runner Discrimination Summary

**An executable runner that plants an unread optional member into the real `EdgeDeps` declaration through a compiler read overlay, proves the shipped gate reports it by exact declaration identity on top of the honest 138-row baseline, and is itself measured against six defective gates so a runner that cannot fail never certifies one.**

## Performance

- **Duration:** 3h 5m
- **Started:** 2026-09-15T20:20:00Z
- **Completed:** 2026-09-15T23:25:00Z
- **Tasks:** 2
- **Files:** 6 (3 created, 3 modified)

## The Crux: the Baseline Is Not Zero

The plan's task wording reads "clean live analysis passes". The live tree does
not pass: 06-06 deliberately left **138 honest unread findings**, each with a
recorded disposition and a named owner repair plan, and the gate exits 1 on
them. A control written as "the gate passes today and fails once I plant an
offender" would never have run.

Every control therefore discriminates on **what the gate reports**, not on
whether it exited non-zero:

| Control | What it requires |
| --- | --- |
| `baseline` | the report parses, its exit status agrees with its own finding count, its only diagnostic is the contract engine's census, and the plant's declaration identity is **not** already in it |
| `offender-plant` | exit 1, the finding set is exactly the baseline **plus** `extensions/pi-claude-marketplace/edge/types.ts:31:3`, and that record deep-equals the independently counted expectation |
| `benign-receiver-read` | the finding set returns to exactly the baseline, and the same declaration now reads `test-only-observed` with one witness at the probe's exact site |
| `unrelated-same-spelling-read` | the offender stays a finding, and the same-spelling member on `UnrelatedSameSpelling` comes back `runtime-observed` with its own production witness |
| `plant-removed` | the whole report, minus the run's own wall clock, deep-equals the baseline report |
| `compiler-failure` | exit **2**, no report at all, and a reason naming the file it could not parse |
| `option-failure` | exit **2**, no report at all, and a reason naming the option it refused |

The two refusal controls are the ones that make exit 1 mean something: a gate
that answered 2 where a finding belongs, or 1 where a refusal belongs, is
rejected by name.

## The Live Proof

Run in the foreground with its exit status captured, against the real
repository, with `/usr/bin/time -v`.

```
$ node scripts/check-unused-type-members.negative.mjs
baseline: ok
offender-plant: ok
benign-receiver-read: ok
unrelated-same-spelling-read: ok
plant-removed: ok
compiler-failure: ok
option-failure: ok
Unused type member negative controls passed (7 of 7).
```

| Measurement | Value |
| --- | --- |
| Exit status | 0 |
| Wall clock | 6 m 49 s |
| Peak resident size | 2.11 GiB |
| Full analyses run | 5 (baseline, offender, benign, unrelated, restored) |
| Partial runs | 2 (a parse failure and an option refusal, neither reaching a verdict) |

Five whole-program analyses is what the proof costs. The runner is deliberately
NOT in `npm run check`; it is reached through `npm run lint:type-members:negative`.

### The plant, and where its facts come from

The insertion point is taken from the interface's own structure -- the end of
its last member, resolved through `ts.createSourceFile` -- so it follows the
declaration rather than its formatting. The expected identity is then **counted
out of the overlay text** by string arithmetic. Nothing in the expectation comes
back from the analyzer, which is the difference between a control and an echo.

| Fact | Value | How it is derived |
| --- | --- | --- |
| Inserted line | `  readonly neverReadAnywhere?: string;` | a literal in the runner |
| Declaration identity | `extensions/pi-claude-marketplace/edge/types.ts:31:3` | newlines counted before the insertion offset; column from the offset of `readonly` in the inserted line |
| Benign witness | `tests/edge/types.test.ts:148:15`, `value-read`, `test`, `property-access` | the same arithmetic over the appended probe |
| Unrelated member | `extensions/pi-claude-marketplace/edge/types.ts:35:3`, owner `UnrelatedSameSpelling`, `runtime-observed` | the same arithmetic over the appended declaration |
| Unrelated witness | `extensions/pi-claude-marketplace/edge/types.ts:39:20`, `production` | the same arithmetic |

Three cases pin those numbers against hand-written expectations, and the
architecture gate refuses the plant if the real declaration ever starts spelling
the key itself -- a plant that collides with a real member stops being a plant
without any case going red.

The benign probe reads through an **optional chain**
(`deps.neverReadAnywhere?.length`), which is one of the access forms the help
text claims and which no landed control exercised before this plan.

### The baseline is unchanged by this plan

| Counter | 06-06 close | Here |
| --- | --- | --- |
| Candidates | 3,464 | 3,464 |
| Runtime-observed | 3,009 | 3,009 |
| Test-only-observed | 236 | 236 |
| Explicit-contract | 81 | 81 |
| **Unread** | **138** | **138** |
| Unsupported analysis | 0 | 0 |
| Transfer steps | 3,001,672 | 3,005,679 |

The transfer counters moved because `tests/**/*.ts` is analysed input and this
plan added two suites to it. No member count moved. `git diff 06ec0723..HEAD --
extensions/` is **empty**: no production source changed, so no production
coverage number could move either.

## Measuring the Runner Itself

`--gate <path>` points the controls at any executable. The suite writes a
stand-in gate that answers by invocation index from a counter file beside it,
which pins the control ORDER as well as the answers: a runner that dropped or
reordered a control gets the wrong answer and fails.

The expected report facts the stand-in answers with are **written out in the
suite**, not taken from `--print-plant`. A stand-in answering with the runner's
own computation would agree with the runner whatever the runner computed.

| Defective gate | Rejected at | The message |
| --- | --- | --- |
| always reports a clean tree | `offender-plant` | the overlay finding set is missing `…:31:3` |
| always reports the same findings | `baseline` | the tree already reports `…:31:3` |
| a different member at the planted coordinates | `offender-plant` | the record for `…:31:3` is `…SomethingElse…` rather than … |
| an unparsable report | `offender-plant` | the gate wrote no parsable report |
| an executable that cannot be launched | `baseline` | the gate produced no report (exit 1) |
| a refusal where a finding belongs | `offender-plant` | the gate produced no report (exit 2) |
| a finding where a refusal belongs | `compiler-failure` | the gate exited 1 rather than refusing |
| a refusal that names nothing | `option-failure` | the refusal does not name … |
| an unexplained diagnostic | `baseline` | the gate reported `internal: gave up on a file` |
| clears the offender on an unrelated read | `unrelated-same-spelling-read` | the overlay finding set is missing `…:31:3` |

Two further controls state what the runner must not do: the analysed sources are
byte-identical after a failing run, and no temporary overlay directory survives
one.

The faithful stand-in's restored answer carries a **different** `work.transferMs`
than its baseline answer. A runner that compared whole reports would be asserting
a wall clock and would go red at random; it must accept the restored report, and
it does.

## The Claim-to-Control Ledger

`tests/architecture/unused-type-member-gate.test.ts` requires every capability
the gate's printed help claims to be bound to a control that discriminates it,
and every named control to still exist under that exact title. A claim that is
dropped fails; a control that is renamed away fails. Neither is visible from
inside the executable controls.

| Claim in the help text | Discriminating controls |
| --- | --- |
| property and optional-chain access | `check-unused-type-members.test.ts#reports an unread optional member by its exact declaration identity`; the runner's own `neverReadAnywhere?.length` probe |
| element access under a literal or finite literal-union key | `model.test.ts#literal and finite-union element access read the exact members they can reach` |
| binding and assignment destructuring | `model.test.ts#binding destructuring reads the source member through renames, defaults and nesting`; `model.test.ts#assignment destructuring reads the source member` |
| compound and update expressions | `model.test.ts#compound assignment and update expressions keep the read of the old value` |
| exact `in` presence tests | `model.test.ts#an exact existence test is a presence observation, not a value read` |
| JSON serialization | `operations.test.ts#a record serialized through an unknown-typed wrapper is observed at its own declaration`; `operations.test.ts#a toJSON member means the declared members are not what is serialized` |
| object spread and rest | `operations.test.ts#a spread reads the source's own values and stops there`; `operations.test.ts#a rest binding copies every key the pattern did not name` |
| Object.assign | `operations.test.ts#Object.assign reads its sources and not the target it writes into` |
| Object.values and Object.entries | `operations.test.ts#Object.values and Object.entries read the values they enumerate`; `operations.test.ts#Object.keys enumerates names and reads no value at all` |
| Node's deep comparisons | `operations.test.ts#a deep comparison of a production result observes it as a test-only read`; `operations.test.ts#a typed expected literal written in a test proves no production consumption` |
| Declarations, type-only references and key enumeration are not reads | `model.test.ts#indexed-access types, keyof and type queries read nothing`; `model.test.ts#an object initializer writes its destination and reads nothing of it`; `model.test.ts#key enumeration alone observes no member`; `model.test.ts#a same-spelling member on an unrelated type earns no witness` |

Every named control is a **runtime** witness: each one runs the analyzer over a
fixture and asserts what it observed. No declaration enumeration serves as one.

## Task Commits

1. **Task 1 (tracer): plant an unread optional member in the actual EdgeDeps compiler input**
   - `fd57512c` (test) — controls plus a stand-in runner deriving its plant from a synthetic lookalike
   - `abbd3be8` (feat) — the plant, the overlay, the four live controls and the containment check
2. **Task 2: prove negative-runner discrimination and the full observation boundary**
   - `960dde22` (test) — twelve controls scripting gate answers the runner must refuse
   - `3f2150d2` (feat) — status-against-report checking, no-report and unparsable diagnosis, the unrelated-read control and the two refusal controls
3. **Record refresh**
   - `01d5319c` (docs) — the triage inventory re-recorded over the widened analysed input

## Files Created/Modified

- `scripts/check-unused-type-members.negative.mjs` — the runner. Derives the plant from the real declaration, builds four overlays, runs seven controls through `spawnSync` with an argv array and a bounded output buffer, disposes of its temporary directory, and reads the two overlay targets back after a pass and after a failure.
- `tests/scripts/check-unused-type-members.negative.test.ts` — 21 controls driving the runner as a child process; three pin the plant's facts, one drives a faithful stand-in gate, twelve drive defective ones, and the rest state what the runner must not do.
- `tests/architecture/unused-type-member-gate.test.ts` — 4 controls: the plant's validity, the benign probe's receiver type, gate-script reachability from `package.json`, and the claim-to-control ledger.
- `tests/architecture/gate-targets.ts` — a `UNUSED_TYPE_MEMBER_GATE_TARGETS` group plus four named members, so the registry's own stale-path scan covers the files these controls plant into.
- `package.json` — the `lint:type-members:negative` alias. Deliberately **not** added to `npm run check`; that activation is 06-08's, and nothing else in the manifest changed.
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` — re-recorded; only the digest, revision and counters moved.

## Verification Results

Each command run in the foreground with its exit status captured.

| Command | Result |
| --- | --- |
| `node --test tests/scripts/check-unused-type-members.negative.test.ts tests/architecture/unused-type-member-gate.test.ts` | 25 tests, 25 pass, 0 fail |
| `node scripts/check-unused-type-members.negative.mjs` | **exit 0**, 7 of 7 controls, 6 m 49 s, 2.11 GiB |
| `npm run check` | **exit 0** — typecheck, lint, both workflow gates, all four fallow links, format:check, both corresponding-test gates, the direct-coverage negative gate, 6,473 unit tests and 32 integration tests |
| `node scripts/check-unused-type-members.mjs --json` | exit 1, 138 findings, 3,464 candidates, 0 unsupported, `contracts: 81 validated` |
| `node scripts/check-unused-type-members.audit.mjs --check` | exit 1, exactly 138 problems, **all `unread`**; zero stale, missing, duplicate, incomplete or invalid |
| `SKIP=trufflehog pre-commit run --files …` on every commit's file set | passed before each of the five commits |

The unit total reads 6,473 against the 6,448 recorded at 06-06 close: the 21
runner controls plus the 4 architecture controls, and nothing removed.

### RED evidence

| Task | RED result | What failed |
| --- | --- | --- |
| 1 | 13 tests, 4 pass, 9 fail | Measured against a stand-in runner deriving its plant from a synthetic `fixture/edge/types.ts` lookalike and running no control at all. The plant's identity, the benign witness site, the control roll-call and every rejection case failed. The 4 passes are properties the stand-in genuinely had: it planted a key the real declaration does not spell, and it wrote nothing to disk. |
| 2 | 21 tests, 12 pass, 9 fail | Measured against Task 1's four-control runner. The failures are the unrelated-read control, both refusal controls, the unparsable-report and no-report diagnoses, the seven-control roll-call, the unrelated member's facts and the always-clean rejection. The 12 passes are Task 1's strengths, held unchanged through the extension. |

The always-clean mutant is the one this phase exists to catch, and it is
rejected on **report content** -- the finding set is missing the plant -- not on
an exit status. A runner that only compared exit statuses would accept it,
because an always-clean gate exits 0 and the live baseline exits 1, which is
already a difference.

## Assertion and Coverage Ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-07-T1 | 13 controls. Positive: the plant's full declaration record against a hand-written expectation, the inserted line, the benign witness's site recomputed from the owner test on disk, and a faithful stand-in's exact control roll-call. Negative: a baseline that already carries the plant, an offender run that does not, a benign run that still does, and a restored report that differs from the baseline. Absence: both overlay targets byte-identical after a failing run. Live: the real gate, over the real tree, reporting the plant by exact identity above the 138-row baseline and clearing it on a real read. | RED failed 9 of 13 against a lookalike-plant stand-in. `npm run check` exit 0 covers the aggregate production coverage gate, both direct-pin gates and both corresponding-test gates. No production source changed, so no production coverage number could move. |
| 06-07-T2 | 12 further controls, each scripting one gate answer the runner must refuse: always clean, always the same findings, a different member at the planted coordinates, an unparsable report, an executable that cannot be launched, a refusal where a finding belongs, a finding where a refusal belongs, a refusal naming nothing, an unexplained diagnostic, and an unrelated same-spelling read that clears the offender. Plus: the unrelated member's own facts, and no surviving temporary overlay after a failure. Absence: the faithful stand-in's differing `work.transferMs` must still be accepted. | RED failed 9 of 21 against the four-control runner; the 12 that passed are the inherited strengths, which is what shows the extension widened nothing. Every claimed supported-analysis category is bound to a named landed control by the architecture gate, and each named control is a runtime witness. |

No production coverage threshold, direct pin, suppression, census pin, threshold
override, coverage exclusion or assertion contract was weakened.

## Deviations from Plan

### 1. [Forced by 06-06] The plan's "clean live analysis passes" does not describe this tree

- **Found during:** Task 1, before any code
- **Issue:** The plan's Task 1 behaviour opens "Clean live analysis passes". 06-06 closed with an honest 138-row unread baseline and the gate exits 1 on it, deliberately and with a named owner per row. A control written against a clean run could not have been written.
- **Fix:** Kept the intent -- prove the real gate detects a real plant on the real declaration -- and changed the mechanism. Every control measures a **delta against the recorded baseline**: the offender run must carry exactly the baseline plus the plant, the benign run must return to exactly the baseline, and the restored run must reproduce the baseline report byte for byte apart from its own wall clock. The runner's own header states that the baseline is not zero and why.
- **Consequence:** The controls keep working when the six repair plans drain the baseline to zero. `baseline` checks the gate's status against its own finding count rather than against a literal 1, so a clean tree is accepted there without an edit.

### 2. [Rule 1 - Bug] The containment check fingerprinted the whole working tree

- **Found during:** Task 1's live verification
- **Issue:** The check that proves the overlays never reached disk compared `git status --porcelain -- extensions tests` before and after. A run takes minutes; an unrelated edit to a test file while it was in flight moved that fingerprint, and the run failed with `The controls changed the analysed sources; the overlay was not contained` -- an accusation about files the run never touched. It was reproduced exactly once, in a foreground run whose output is quoted in the commit that fixed it.
- **Fix:** Scoped the status query to the two paths the overlays stand in for, beside the byte comparison of those same two files. The claim is now exactly the claim the controls make.
- **Files modified:** `scripts/check-unused-type-members.negative.mjs`
- **Commit:** `abbd3be8`

### 3. [Rule 3 - Blocking] The baseline control refused the gate's own contract census

- **Found during:** Task 1's first live run
- **Issue:** The control required `report.diagnostics` to be empty. Every run over a tree carrying a contract file emits exactly one diagnostic, `contracts: 81 validated from …`, so the first live run failed at `baseline` in 83 seconds without reaching a single member assertion.
- **Fix:** The census line is the only diagnostic a healthy run may write -- a contract the engine refuses is an exit-2 refusal with no report at all -- so the control now requires every diagnostic to match that census shape, and requires each overlay run's diagnostics to equal the baseline's. A control proving this exists: `rejects a gate whose diagnostics the contract census does not explain`.
- **Files modified:** `scripts/check-unused-type-members.negative.mjs`
- **Commit:** `abbd3be8`

### 4. [Rule 3 - Blocking] The triage record went stale

- **Found during:** Plan-level verification
- **Issue:** `tests/**/*.ts` is analysed input, so the two new suites moved the source digest from `ba06bb95` to `671cb0ae` (603 hashed files to 605) and `--check` reported `stale-source` alongside its 138 findings.
- **Fix:** Re-ran `--inventory`. Only the digest, revision, timestamp and transfer counters moved; all 455 recorded dispositions carried forward and `--check` reconciles again at exactly 138 `unread` with zero stale, missing, duplicate, incomplete or invalid rows.
- **Files modified:** `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md`
- **Commit:** `01d5319c`

### 5. [Documented choice] The runner does not replay the analyzer's category fixtures

Task 2's action lists the whole supported-analysis vocabulary -- declaration,
initializer, write, delete, type-only, same-name, optional and literal access,
destructuring, aliases, structural transfers, callbacks, containers,
whole-object operations, serialization, shadowing and external-contract drift.
183 landed controls across five suites already discriminate every one of them,
and the plan itself says to "couple this runner to core fixture-suite cases
without replaying every expensive live scan".

Replaying them inside the runner would have been a clone `fallow dupes` would
report, and would have weakened nothing if deleted. The coupling is executable
instead: the architecture gate binds each claim the help text makes to named
controls in those suites and fails when a claim is dropped or a control is
renamed. The full table is above.

### 6. [Documented choice] The claim ledger reads the printed help, not the source

The help text is hard-wrapped and its backticks are escaped in the template
literal, so a claim of more than a few words matches neither form verbatim. The
gate spawns `--help` and folds runs of whitespace, which is the text a user
actually sees.

One core claim is deliberately absent from the ledger's claim column: "a
same-spelling member on an unrelated type is a different candidate" lives in the
module's doc comment rather than in the printed help. Its control
(`model.test.ts#a same-spelling member on an unrelated type earns no witness`)
is named under the declarations row instead, and the runner's
`unrelated-same-spelling-read` control proves the same property live. Adding the
sentence to the help text would have edited a paragraph another suite pins
exactly, for no gain.

### 7. [Documented choice] `tests/architecture/gate-targets.ts` is outside the plan's file list

D-07-05 requires every gate under `tests/architecture/` to name its targets
through a group exported from that registry, so the registry's own stale-path
scan can see them. The new architecture gate names four files it plants into or
reads; registering them is the house mechanism, and the registry's own gate
(`gate-targets.test.ts`, 4 clauses) covers the new group without an edit.

### 8. [Documented choice] Commit messages carry no plan scope

The GSD task-commit protocol asks for `{type}({phase}-{plan}):`. This project's
`CLAUDE.md` forbids milestone and phase identifiers in commit messages and takes
precedence, so the five commits are plain Conventional Commits, exactly as in
06-01 through 06-06.

### 9. [Documented choice] Task 2's RED landed before Task 1's GREEN

Task 1's implementation was written and verified before Task 2 began, but its
commit was made after Task 2's RED was measured against it. Every commit
describes work that was really done in the state it was committed in, and each
RED figure above was measured against the runner that was on disk at the time;
the ordering is a bookkeeping wart, not a claim about untested code.

---

**Total deviations:** 1 forced by the landed 06-06 result, 1 auto-fixed bug, 2
blocking fixes and 5 documented choices.
**Impact:** No gate was weakened. No suppression, census pin, threshold override,
coverage exclusion or assertion relaxation was added, and the gate is still
deliberately outside `npm run check`.

## Observed Limits

- **The runner costs five whole-program analyses.** 6 m 49 s and 2.11 GiB. That is why it is a separate alias rather than a member of `npm run check`, and why the twelve discrimination controls drive a stand-in gate instead of the real one.
- **The stand-in gate answers by invocation index.** That pins the control order, which is the point, but it also means a control inserted in the middle shifts every later answer. The suite names its positions through `controlOrder` so the shift is one edit, not twelve.
- **The plant's coordinates are pinned literally.** `…/edge/types.ts:31:3` is written out in the suite. Any edit to `EdgeDeps` above the last member moves it and fails three cases with an exact diff, which is the intended report: the plant follows the declaration's structure, and the expectation follows the declaration's position.
- **The claim ledger proves a control exists, not that it is strong.** It fails when a claim is dropped or a case renamed. Whether each named case discriminates its claim well is the reader's judgment, which is why that deliverable carries `human_judgment: true`.
- **`--print-plant` is an interface the suite uses.** It reports the facts the runner computed so a stand-in can answer with them; the suite pins those same facts against hand-written expectations separately, so the two can disagree.

## Known Stubs

None. No placeholder values, no unwired output, no committed `skip` or `todo`,
and no control that passes without running the thing it names.

The 138 unread members are not stubs and are not this plan's to repair: they are
06-06's measured findings, each with recorded evidence and a named owner plan,
and the gate fails every one of them.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at
a trust boundary.

T-06-07-01 (candidate provenance) is mitigated by the plant being derived from
the real declaration's own AST, by the expected identity being counted out of
the overlay text rather than read back from the analyzer, and by the
same-spelling control that must not clear the offender. T-06-07-02 (compiler
inputs and subprocess controls) by `spawnSync` with an argv array and no shell,
by overlays that are read overrides the compiler never writes back, by a
`mkdtemp` directory disposed of in a `finally`, and by reading both overlay
targets back after a pass and after a failure. T-06-07-03 (resource exhaustion)
by the bounded output buffer and by the two refusal controls, which require a
run the gate could not complete to exit 2 with no report. T-06-07-04 (gate
acceptance) by the exact member-level expectations, by the exit status being
checked against the report's own finding count, and by the ten defective gates
the runner is shown to reject.

## Issues Encountered

- **The gate still exits 1, and this plan does not change that.** Six repair plans (06-09 through 06-14) own the 138 findings. This plan proves the gate would catch a new one.
- **A live run and concurrent editing do not mix.** The containment failure in deviation 2 was caused by editing a test file while a five-minute run was in flight. The check is narrowed, but the underlying fact stands: the runner analyses the tree as it is on disk at the moment each child process starts.

## Next Phase Readiness

- **06-08 has its sensitivity proof.** The three things it needed from here are done: the shipped gate is shown to report a real plant on a real declaration by exact identity; a refusal is shown to stay distinguishable from a verdict; and the runner is shown to reject an always-passing gate. `lint:type-members:negative` is a real package entry and, like `lint:type-members` and `lint:type-members:audit`, is deliberately **not** in `npm run check` -- that activation, for all three, is 06-08's after the repair plans land.
- **06-08 must not forget the cost.** Adding the runner to the mandatory chain adds five whole-program analyses to every `npm run check`. The gate itself is one.
- **`requirements-completed` is deliberately empty.** MEMBER-01 and MEMBER-02 are declared by all eight plans in this phase, so neither may read `Complete` until the last declaring plan finishes.
- **Re-measure after any source change.** Any edit under `extensions/` or `tests/`, or to `tsconfig.json` or the contract file, moves the digest and `--check` reports `stale-source`; `--inventory` rebuilds the record and carries every note forward.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-15*

## Self-Check: PASSED

- `scripts/check-unused-type-members.negative.mjs` -- FOUND
- `tests/scripts/check-unused-type-members.negative.test.ts` -- FOUND
- `tests/architecture/unused-type-member-gate.test.ts` -- FOUND
- All five commits (`fd57512c`, `abbd3be8`, `960dde22`, `3f2150d2`, `01d5319c`) -- FOUND in `git log`
- `commits: 5` is measured: `git rev-list --count 06ec0723..HEAD` returned 5 before this documentation commit.
- `tokens: 149712` is `chars/4` over every file this plan changed. 128,222 of it is the
  generated triage document, which moved by 30 metadata lines; the authored runner,
  suites and registry come to 21,490. The plan estimated 26,000, which the authored
  share came in under.

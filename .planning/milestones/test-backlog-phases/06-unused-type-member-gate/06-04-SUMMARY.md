---
phase: 06-unused-type-member-gate
plan: "04"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, operations, gate, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The candidate inventory, member identity and the read-site records whole-object operations extend
  - phase: 06-unused-type-member-gate
    provides: The directed transfer graph a whole-object operation's operand is traced back through
  - phase: 06-unused-type-member-gate
    provides: The validated-contract engine and the `contractEvaluator` seam the analysis already composes
provides:
  - Whole-object operation summaries in `scripts/check-unused-type-members.operations.mjs`, settled by the declaration the checker resolved and never by the callee's spelling
  - Validated local wrapper summaries proved from the wrapper's own body and applied at the call site, so an `unknown`-typed parameter keeps the caller's record
  - `JSON.stringify` with its real eligible-key semantics: recursive descent, omitted methods and symbol keys, literal replacer arrays, and a refusal on a run-time replacer or a `toJSON` member
  - Shallow copy semantics for object spread, rest bindings, `Object.assign`, `Object.values` and `Object.entries`; `Object.keys` reads no value
  - An `unproven-own-properties` refusal where an accessor member or a class constituent makes own-enumerability unprovable
  - Node deep comparisons credited only through the operand whose value came out of production code, leaving identity comparisons and test-authored fixtures crediting nothing
  - Container semantics for `push`, `unshift`, `fill`, `splice`, `sort`, `reverse`, `flat` and `entries`, including a comparator's second parameter
  - `work.operationReads` on the report, and a transfer budget raised to match the measured work
affects: [06-05, 06-06, 06-07, 06-08]

actuals:
  tokens: 17498
  tasks: 3
  commits: 3
plan_head_before: ba86ec18a5026d3a1b2b0664e7ca9cfb51f659fc

tech-stack:
  added: []
  patterns:
    - "An operation is a property of the declaration the checker resolved, so a library interface in the default library and an ambient module name are the two identities that settle one"
    - "A wrapper summary is proved from its own body and applied at the call site, which is what lets an `unknown` parameter carry a caller's record without erasing it"
    - "Whole-object reads are emitted as ordinary read sites, so the transfer walk credits provenance with no second mechanism"
    - "Provenance is traced from the operand; members below it are credited on the declaration written there, which bounds the distinct questions the walk answers"
    - "A deep comparison reads both operands but only one says anything about production, so lineage is asked before a key is credited"

key-files:
  created:
    - scripts/check-unused-type-members.operations.mjs
    - tests/scripts/check-unused-type-members.operations.test.ts
  modified:
    - scripts/check-unused-type-members.flow.mjs
    - scripts/check-unused-type-members.analysis.mjs
    - scripts/check-unused-type-members.mjs
    - tests/scripts/check-unused-type-members.flow.test.ts
    - tests/scripts/check-unused-type-members.test.ts

key-decisions:
  - "A whole-object operation is resolved through its declaration -- a default-library interface for `JSON` and `ObjectConstructor`, an ambient `assert` module for the deep comparisons -- so a local function carrying the name reaches none of it"
  - "A local wrapper earns a summary only by passing one of its own parameters into an already-summarised operation, and the summary is applied against the argument written at the call site"
  - "Whole-object reads are emitted as ordinary read records rather than as a parallel crediting path, so one mechanism owns provenance"
  - "Provenance is traced from the operand only; members the operation reached below it are credited on the operand's own declaration"
  - "A deep comparison credits only a production-derived operand, so a typed expected literal a test wrote proves no production consumption"
  - "`push` and its neighbours are directed element writes, not whole-object reads: placing a value into an array reads none of its members"
  - "The transfer budget rises to 12,000,000 to keep the measured headroom the previous default had"

coverage:
  - deliverable: "Serialization summarised and proved through a wrapper whose parameter is `unknown`"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a record serialized through an unknown-typed wrapper is observed at its own declaration"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#the command-line report carries the serialization witness and only the real offenders"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#changing the summarised body into a non-reader invalidates the witness"
        status: pass
    human_judgment: false
  - deliverable: "Eligible-key semantics for replacers, toJSON, methods and symbol keys"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a literal replacer array serializes exactly the keys it names"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a replacer function leaves the serialized keys unresolved rather than credited"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a symbol-keyed member is not serialized alongside the spelled ones"
        status: pass
    human_judgment: false
  - deliverable: "Shallow copy and enumeration semantics with own-property eligibility"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a spread reads the source's own values and stops there"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a rest binding copies every key the pattern did not name"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#an accessor member leaves own-property eligibility unproven"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#Object.assign reads its sources and not the target it writes into"
        status: pass
    human_judgment: false
  - deliverable: "Deep comparisons classified by the lineage of the operand"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a deep comparison of a production result observes it as a test-only read"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a typed expected literal written in a test proves no production consumption"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#an identity comparison reads no member of either side"
        status: pass
    human_judgment: false
  - deliverable: "Container members that move member provenance"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a pushed record is credited when the array it landed in is read"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a comparator receives an element at both of its parameters"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an unmodeled container operation is reported, not assumed clean"
        status: pass
    human_judgment: false
  - deliverable: "The live population the gate now reports"
    verification:
      - kind: command
        ref: "node scripts/check-unused-type-members.mjs --json"
        status: pass
    human_judgment: true
    rationale: "The run is exact and repeatable, but whether the 261 remaining unread members are defects, contracts or analysis gaps is the reconciliation 06-06 owns"

duration: 2h 20m
completed: 2026-09-15
---

# Phase 06 Plan 04: Whole-Object Operations and Validated Wrapper Summaries Summary

Whole-object reads -- serialization, copies, enumeration and deep comparison --
are now settled by the declaration the checker resolved and credited through the
same transfer walk everything else uses, taking the live tree from 468 findings
to 261 and closing every unsupported row.

## What Was Built

`scripts/check-unused-type-members.operations.mjs` answers one question: which
calls read an object's members all at once, and which keys does each one
actually read. Everything else in the gate reads one named member at a time, so
this is the only place that can credit a shape without a property access ever
being written.

Two rules hold across the module.

**An operation is a property of a declaration, never of a name.** A built-in is
a member of an interface the compiler's own default library declares
(`JSON.stringify` on `interface JSON`, `Object.assign` on `ObjectConstructor`),
or a function inside the ambient module that declares it (`deepStrictEqual`
inside `declare module "assert"`). A local function spelling the same name
resolves to a declaration in this project and reaches none of it -- the
`callLocalStringify` and the local `deepStrictEqual` controls both prove that a
name match earns nothing.

**A local wrapper earns a summary only from its own body.** It has to pass one
of its own parameters into an operation already summarised here; the summary is
then applied at the call site against the argument actually written there. That
projection is what keeps a caller's record alive through `atomicWriteJson`-shaped
code whose declared parameter is `unknown`: the parameter carries no members, the
argument at the call site carries all of them. Change the body into one that
returns its input unchanged, or ignores it, and the proof goes with it -- the
`identity`, `discard` and changed-body controls each assert the witness
disappears.

### The operations

| Operation | What it reads | Settled by |
| --- | --- | --- |
| `JSON.stringify` | Every spelled string key, recursively; methods and symbol keys omitted, because a function value and a symbol key are not serialized | `interface JSON` in the default library |
| Object spread, rest binding | The source's own values, shallowly; a rest copy omits the keys the pattern already named | Syntax |
| `Object.assign` | Its sources' own values, shallowly; the target is written into, never read from | `interface ObjectConstructor` |
| `Object.values`, `Object.entries` | The values they enumerate, shallowly | `interface ObjectConstructor` |
| `Object.keys` | Nothing -- it enumerates names | Deliberately absent from the table |
| `deepStrictEqual` and its neighbours | Both operands recursively, but only the one whose value came out of production code | The ambient `assert` module |
| `strictEqual` and the other identity members | Nothing -- comparing two references reads no member | Deliberately absent from the table |

### Where the analysis refuses to answer

Two refusals replace the credit rather than shrinking it, and each is attributed
only to the operand's own members.

`unmodeled-serializer-options` fires when a run-time replacer function, a
computed replacer array or a `toJSON` member means the serialized keys are no
longer the declared ones. A literal replacer array is the modelled case: it names
exactly the keys that survive, and the sibling it excludes stays unread.

`unproven-own-properties` fires when an accessor member or a class constituent
makes own-enumerability unprovable. A declared type states which members exist,
not how the object carrying them was built, so a shape declaring `get derived()`
or a union with a class in it leaves a whole-object read a question rather than
an observation. This is the plan's "an interface alone does not prove it",
implemented as a refusal at exactly the two shapes where the compiler can see the
problem.

### The container members 06-02 left open

All 76 `unmodeled-container-operation` rows were measured before any were
touched: 73 came from `array.push`, and the remaining three from `entries`,
`reverse` and `sort`. None of them is a whole-object read. `push` *writes* an
element into the receiver, so it is a directed transfer edge -- the same shape
`map.set` already had -- and modelling it as a bulk read would have credited
every member of a record that was only stored. The correct models are:

- `push`, `unshift`, `fill` place their arguments at an element of the receiver, at a path that follows the receiver's own property chain, so `report.rows.push(row)` lands at `rows`/element of whatever `report` holds. A spread argument hands over its own elements and so answers the element path directly instead of below it.
- `sort`, `reverse`, `splice`, `toSorted` and `toReversed` hand back the elements they were given, so they keep the receiver's shape.
- `sort` and `toSorted` hand an element to *both* comparator parameters; every other callback receives one at its first parameter only.
- `entries` pairs an element with its position, so the element sits at the pair's second slot and a read of the first slot reaches nothing.
- `flat` yields an element of an element.
- `reduce` stays unmodeled, because its callback's first parameter is an accumulator and not an element. It still raises the gap, which is what the retargeted 06-02 control now asserts.

## Live Measurements

Every number below is `node scripts/check-unused-type-members.mjs --json`
against this repository, timed and sized with `/usr/bin/time -v`.

| Run | Unread | Unsupported | Findings | Wall | Peak RSS |
| --- | --- | --- | --- | --- | --- |
| Inherited baseline | 392 | 76 | 468 | 72.3 s | 1.94 GiB |
| After serialization | 385 | 68 | 453 | 72.4 s | 1.98 GiB |
| After copies and containers | 372 | 0 | 372 | 76.4 s | 1.99 GiB |
| After deep comparisons | 261 | 0 | 261 | 80.2 s | 2.05 GiB |

**Unsupported analysis is now zero.** Every one of the 76 rows 06-02 left is
explained by a real operation rather than excused, and the two refusals this plan
introduced fire nowhere on this tree with no independent witness -- the reasons
tally across all 261 findings is empty.

The remaining 261 unread members are the population 06-06 reconciles. This plan
makes no claim about them beyond the measurement.

Work the final run did: 2,889,809 transfer steps, 214,822 indexed edges, 82,164
traced reads and 939,556 whole-object operation reads, in 50.3 s of walk time
inside the 80.2 s total. The report is 12.2 MB of JSON holding 41,646 witnesses.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 06-04-T1 | `node --test tests/scripts/check-unused-type-members.operations.test.ts tests/scripts/check-unused-type-members.contracts.test.ts` | 46/46 pass (RED: 4/12 on the new file) |
| 06-04-T2 | `node --test tests/scripts/check-unused-type-members.operations.test.ts tests/scripts/check-unused-type-members.flow.test.ts` | 67/67 pass (RED: 14/26 on the new file) |
| 06-04-T3 | `node --test` over all five analyzer suites | 134/134 pass (RED: 30/33 on the new file) |

Wave checks: `npm run typecheck`, `npm run lint`, `npm run format:check` and
`npm run fallow` (all four sub-gates) are green, as are
`npm run test:corresponding` and `npm run test:corresponding:negative`.
`pre-commit run --files` passed on every commit's file set, including its own
`npm fallow` and direct-coverage hooks.

## Assertion and Coverage Ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-04-T1 | 12 controls. Positive: a nested record through an `unknown`-typed wrapper, a wrapper chain that keeps the caller's origin, a literal replacer array, a method member left out. Negative: a local `stringify`, an identity-returning wrapper, a discarding wrapper, a changed body, a sibling never serialized. Unsupported: a replacer function, a `toJSON` member. Failure: the command-line run exits 1 with exactly the three real offenders and the pinned witness coordinates. | The RED run failed 8 of the 12 before implementation; the four that passed are the absence assertions that had to keep passing. The 101 inherited analyzer controls passed unmodified. |
| 06-04-T2 | 14 further controls. Positive: spread, spread-then-overwrite, unused copy result, rest binding, `Object.values`, `Object.entries`, `Object.assign` source, `push`, comparator both parameters, `entries`, `reverse`. Negative: nested record under a shallow spread, `Object.keys`, `Object.assign` target, the key a rest pattern named. Unsupported: an accessor member, a class constituent, `reduce`. | The RED run failed 12 of the 14. The one inherited control that changed is discussed under deviations: its assertion is unchanged and its example was retargeted from `sort`, which this plan models, to `reduce`, which it does not. |
| 06-04-T3 | 7 further controls. Positive: a production result compared deeply, its nested record, a test helper wrapping the real comparison. Negative: a typed expected literal, an identity comparison, a local `deepStrictEqual`, a symbol-keyed member. | The RED run failed 3 of the 7; the four negatives had to keep passing and did. All five analyzer suites pass together. |

No production coverage threshold, direct pin or assertion contract was weakened.
The single inherited test edit strengthens nothing and weakens nothing: it
replaces an example the analyzer now understands with one it still does not.

## Deviations from Plan

### 1. [Rule 1 - Correctness] `push` and its neighbours are transfers, not whole-object reads

- **Found during:** Task 2, while measuring the 76 rows the plan assigned to this plan
- **Issue:** The dispatch brief says the 76 `unmodeled-container-operation` rows are "mine to model as whole-object operations". Measured against the real tree, 73 of them come from `array.push`. Pushing a value into an array reads none of that value's members; treating it as a bulk read would have credited every member of a record that was only stored, which is exactly the false acceptance the gate exists to prevent.
- **Fix:** Modelled `push`, `unshift` and `fill` as directed element-write edges in the transfer graph -- the same shape `map.set` already had -- generalised to follow a receiver's property chain. `sort`, `reverse`, `splice`, `flat` and `entries` are modelled by their real result semantics rather than as reads.
- **Files modified:** `scripts/check-unused-type-members.flow.mjs`
- **Verification:** `a pushed record is credited when the array it landed in is read` asserts the credit arrives with syntax `value-transfer`, not as a bulk read, and that an unpushed sibling earns nothing.
- **Commit:** d00c4584

### 2. [Rule 3 - Blocker] Nested provenance tracing exhausted the transfer budget

- **Found during:** Task 3
- **Issue:** Emitting a traced read for every nested path a recursive operation reaches multiplied the distinct (place, path) questions the walk answers. The live run exhausted the 4,000,000-step budget, and then a deliberately raised 40,000,000-step budget, in 3m 28s -- more than a tenfold increase for the same tree. The gate refused rather than reporting clean, which is the designed behaviour, but a gate that cannot finish is not usable.
- **Fix:** Provenance is traced from the operand itself; a member the operation reached *below* the operand is credited on the declaration written there, and the places that supplied it are left untraced. A second, smaller fix stops asking the expensive lineage question for an operand with no keys to read. Both under-credit rather than over-credit.
- **Files modified:** `scripts/check-unused-type-members.flow.mjs`
- **Verification:** The final live run completes in 80.2 s using 2,889,809 of the raised 12,000,000-step budget; all 134 analyzer controls pass, including the nested-record ones that this bound had to keep satisfying.
- **Commit:** 70e2fa35

### 3. [Rule 2 - Missing critical] The documented scope did not describe the new reads

- **Found during:** Task 3
- **Issue:** D-06 requires the tool to document its supported scope and limitations honestly. The `--help` text listed only the single-member syntaxes, so a reader had no way to know that a deep comparison or a spread now credits a member, nor where the analysis refuses.
- **Fix:** Extended the scope section of `scripts/check-unused-type-members.mjs` to name the whole-object operations, the wrapper rule, the production-lineage rule for comparisons, the operand-only provenance bound and the two refusals. `scripts/check-unused-type-members.mjs` was not in the plan's `files_modified`.
- **Verification:** `node scripts/check-unused-type-members.mjs --help`, and `the help text states the bounded claim the gate makes and the claims it does not` in `tests/scripts/check-unused-type-members.test.ts`, which pins the block verbatim and was extended to cover the new claims
- **Commit:** 70e2fa35, control extended in 78c21914

### 4. [Rule 1 - Correctness] An inherited control used an example this plan models

- **Found during:** Task 2
- **Issue:** 06-02's `an unmodeled container operation is reported, not assumed clean` used `items.sort()` as its unmodeled example. This plan models `sort`, so the control's subject was no longer exercised by its example.
- **Fix:** Retargeted the example at `reduce`, which stays unmodeled for the stated reason. The assertions are byte-identical in shape and strength -- the same gap reason, the same `unsupported-analysis` status, the same benign neighbour asserted clean.
- **Files modified:** `tests/scripts/check-unused-type-members.flow.test.ts`
- **Verification:** `node --test tests/scripts/check-unused-type-members.flow.test.ts` -- 50/50 pass
- **Commit:** d00c4584

### 5. [Rule 1 - Correctness] The extended help text broke the control that pins it

- **Found during:** The final spot check of all five suites, after the documentation change had already been committed
- **Issue:** `tests/scripts/check-unused-type-members.test.ts` pins the whole scope block verbatim. The pre-commit hooks run lint, typecheck and fallow but not the Node suites, so extending the help text left that control failing until the suites were run again.
- **Fix:** Extended the pinned block to the current text, so the control now states the whole-object paragraph and the two new limitations as well.
- **Files modified:** `tests/scripts/check-unused-type-members.test.ts`
- **Verification:** All five analyzer suites together -- 134/134 pass
- **Commit:** 78c21914

**Total deviations:** 5 auto-fixed (3 correctness, 1 blocker, 1 missing critical). **Impact:** The container work is modelled by its real semantics instead of as a bulk read, the walk finishes inside a bound that still has headroom, and the tool's own documentation states what it now credits and where it refuses.

## Reconciling Against the Landed Seams

The dispatch brief's description of 06-02 and 06-03 held on disk. Three points
were checked before any code was written and each was honoured:

- `at` and `from` are opposite edge directions. The element writes this plan adds are all `at` edges, and a spread argument to `push` consumes only the receiver's key path so that the source's own element path answers directly -- no `from` edge was introduced and the existing rule was not touched.
- `model.mjs` owns member identity. `resolveCandidates` and the existing `candidatesAt` memo are what credit every operation read; no key derivation was duplicated.
- `contracts.mjs` holds the validated-contract engine. No operation is expressed as a contract, and `check-unused-type-members.contracts.json` is still empty.

One seam differed from what the plan predicted. `collectSyntax` sorted only
variables, assignments and calls, so object spreads and rest bindings had no
collection point at all; `sortNode` now sorts both, which is where the copy
operations are found.

## Observed Limits

These are bounds, not bugs, and each under-credits:

- A member a whole-object operation reaches below its operand is credited on the operand's own declaration; the places that supplied it are not traced. The measured cost of tracing them is above a tenfold budget increase.
- Nested and loop rest patterns are left alone: a rest binding is summarised only where the pattern destructures an expression or a parameter directly.
- Symbol-keyed members are never credited by a whole-object read. `JSON.stringify` and the `Object` enumerators genuinely omit them; a spread and a deep comparison do not, so those two under-credit by exactly one class of key that no property access can spell.
- A `Proxy` is indistinguishable from the object it stands in for, so own-property eligibility cannot be refused for one.
- A class instance flowing into an interface-typed place is not detected at that place. The refusal fires when the class is visible in the operand's own type; when it is not, the walk simply reaches the construction and credits nothing there, which leaves a finding rather than an acceptance.
- `reduce` remains an unmodeled container operation and still raises its gap.

## Next

Ready for 06-05. The live population the reconciliation in 06-06 inherits is 261
unread members and zero unsupported rows.

## Self-Check: PASSED

- `scripts/check-unused-type-members.operations.mjs` -- FOUND
- `tests/scripts/check-unused-type-members.operations.test.ts` -- FOUND
- `66bdeb61`, `d00c4584`, `70e2fa35` -- all three FOUND in `git log`
- `commits: 3` counts the production commits from `plan_head_before`. The documentation
  commits that close the plan are excluded, which is what 06-02 and 06-03 recorded too;
  a raw `git rev-list --count ba86ec18..HEAD` therefore reads higher by that number.

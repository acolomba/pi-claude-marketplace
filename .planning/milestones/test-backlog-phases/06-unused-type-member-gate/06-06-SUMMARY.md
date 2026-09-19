---
phase: 06-unused-type-member-gate
plan: "06"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, contracts, triage, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The candidate inventory, member identity and the three-way exit contract
  - phase: 06-unused-type-member-gate
    provides: The directed transfer graph the two analyzer corrections extend
  - phase: 06-unused-type-member-gate
    provides: The validated-contract engine the two new proofs extend
  - phase: 06-unused-type-member-gate
    provides: Whole-object operations, which the single-arm union rule now reaches through a union
  - phase: 06-unused-type-member-gate
    provides: The fingerprint-bound triage ledger and the closure check this plan fills in
provides:
  - "Two directed-flow corrections: a relayed promise is no longer placed one await too deep, and a key exactly one union arm declares now resolves there"
  - "Two contract proofs: a selection over a bounded type parameter, and `type-refinement` for an intersection that narrows a slot the rest of it already declares"
  - "`scripts/check-unused-type-members.contracts.json`: 81 validated live entries -- 62 selections, 17 refinements, 2 brands"
  - "`tests/scripts/check-unused-type-members.live.test.ts`: production-shaped regression controls for both analyzer corrections"
  - "A closed `06-LIVE-TRIAGE.md`: 455 of 455 rows explained, reconciling exactly against a fresh digest and a fresh analysis"
  - "An honest remaining baseline of 138 unread members, each with a recorded disposition and a named owner repair plan"
  - The measured transfer cost recorded against the adopted budget it is four times under
affects: [06-07, 06-08]

actuals:
  tokens: 181357
  tasks: 2
  commits: 10
plan_head_before: 4fcbc9feffa7fe2c94fa5bbb0a27b0cc5413745f

tech-stack:
  added: []
  patterns:
    - "A directed-flow correction is proved by a reduced fixture of the real shape, never by the live enumeration it was found in"
    - "An exemption category earns its keep by naming what it refuses, so every new proof ships with the counterexample that fails it"
    - "An honest non-zero baseline with a recorded disposition per row beats a zero reached by widening a proof"

key-files:
  created:
    - tests/scripts/check-unused-type-members.live.test.ts
  modified:
    - scripts/check-unused-type-members.flow.mjs
    - scripts/check-unused-type-members.contracts.mjs
    - scripts/check-unused-type-members.contracts.json
    - scripts/check-unused-type-members.analysis.mjs
    - tests/scripts/check-unused-type-members.contracts.test.ts
    - tests/architecture/partial-vocabulary-guard.test.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "An async body that hands back another promise hands back what that promise fulfils, so its value sits where its own awaited value does rather than one await deeper"
  - "A key exactly one arm of a union declares can only have come from that arm; two arms spelling one key stay unsettled and resolve to nothing"
  - "`type-refinement` is a fifth category, separate from `type-selection`, because narrowing a slot an intersection already declares is different evidence from selecting a variant"
  - "A discriminant proof needs two spellings to differ, not every spelling to be unique: two variants sharing a value still sort the union into groups"
  - "Insisting on a slot the rest of an intersection lets a value omit is itself a narrowing"
  - "The closure is honest rather than complete: 138 members really are unread, and each one is recorded with its evidence and an owner rather than excused by a widened proof"
  - "Every remaining finding is grouped into one bounded repair plan per conceptual owner, which is the grouping the audit already produces"

coverage:
  - deliverable: "A relayed promise credits the annotation that produced the value"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#an async relay credits the member on the annotation that produced the value"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#every hop of a relay chain is credited for the member that flowed through it"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#an async relay credits no sibling of the member that was read"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#a same-spelling declaration outside the relay chain earns nothing"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#an async body handing back a plain object still sits at the awaited position"
        status: pass
    human_judgment: false
  - deliverable: "A key exactly one union arm declares resolves there, and an ambiguous one resolves nowhere"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#a read through a union relay credits the only arm that declares the key"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#two arms spelling one key leave both uncredited through the relay"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.live.test.ts#a union relay credits no sibling of the member that was read"
        status: pass
    human_judgment: false
  - deliverable: "A selection over a bounded type parameter is proved through its bound"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a selection over a bounded type parameter keeps its type-system role"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a type parameter bounded by a shape that discriminates nothing is refused"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a bounded selection leaves the variants' own discriminants alone"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a discriminant two variants share still tells the union apart"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a selection a coordinate shares with the access around it is still found"
        status: pass
    human_judgment: false
  - deliverable: "`type-refinement`: an intersection that narrows a slot the rest of it already declares"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an intersection that narrows an existing slot keeps its type-system role"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a refinement nested inside a refined slot is proved through its own path"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#requiring a slot the rest of the intersection leaves optional narrows it"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an intersection that adds a slot of its own is refused"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an intersection that restates a slot unchanged narrows nothing"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an intersection that leaves an optional slot optional narrows nothing"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a refines site that names no intersection is refused"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a member outside the named intersection is refused"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a refinement covers neither the slot it narrows nor its unrefined sibling"
        status: pass
    human_judgment: false
  - deliverable: "81 validated live contracts, accepted by the engine against this tree"
    verification:
      - kind: command
        ref: "node scripts/check-unused-type-members.mjs --json"
        status: pass
      - kind: command
        ref: "npm run check"
        status: pass
    human_judgment: false
  - deliverable: "A closed triage record: 455 of 455 rows explained, reconciling against a fresh digest"
    verification:
      - kind: command
        ref: "node scripts/check-unused-type-members.audit.mjs --check"
        status: pass
    human_judgment: true
    rationale: "`--check` exits 1 by design while any member is unread, and the reconciliation half of it is exact: zero stale, missing, duplicate, incomplete or invalid rows against a freshly recomputed digest. Whether each of the 138 remaining findings is a defect worth repairing is the owner judgment the six named repair plans carry, and this plan deliberately reaches no verdict on it."
  - deliverable: "The measured transfer cost recorded against the adopted budget"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a deliberately low transfer budget fails instead of reporting a clean tree"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.test.ts#an exhausted analysis budget fails instead of reporting a clean tree"
        status: pass
    human_judgment: true
    rationale: "The exhaustion controls prove a spent budget refuses rather than reading clean. Whether four times the measured cost is the right headroom for a tree that will keep growing is a judgment, recorded with its numbers in `analysis.mjs` and in the ledger's own `work` block rather than asserted by a test."

requirements-completed: []

duration: 3h 10m
completed: 2026-09-15
---

# Phase 06 Plan 06: Live Reconciliation and Contract Closure Summary

**Two directed-flow corrections and two new contract proofs take the live population from 261 unread to 138, and every one of the 455 rows that needs a reader to agree with it now carries recorded evidence -- including the 138 that remain, which are named findings with owners rather than an unexplained baseline.**

## Performance

- **Duration:** 3h 10m
- **Started:** 2026-09-15T17:00:00Z
- **Completed:** 2026-09-15T20:10:00Z
- **Tasks:** 2
- **Files:** 8 (1 created, 7 modified)

## Live Measurements

Every run below was measured on this repository with `/usr/bin/time -v`, in the
foreground, with its exit status captured.

| Run | Unread | Unsupported | Contract | Findings | Wall | Peak RSS |
| --- | --- | --- | --- | --- | --- | --- |
| Inherited baseline (06-05) | 261 | 0 | 0 | 261 | 80.2 s | 2.05 GiB |
| After the relayed-promise correction | 258 | 0 | 0 | 258 | 81.8 s | 2.11 GiB |
| After the single-arm union correction | 219 | 0 | 0 | 219 | 78.3 s | 2.09 GiB |
| After the 81 validated contracts | 138 | 0 | 81 | 138 | 82.1 s | 2.05 GiB |
| `--check` on the final committed tree | 138 | 0 | 81 | 138 problems | 79.4 s | 2.00 GiB |

**The full population, before and after:**

| | Baseline | Final | Change |
| --- | --- | --- | --- |
| Candidates | 3,464 | 3,464 | -- |
| Runtime-observed | 2,981 | 3,009 | +28 |
| Test-only-observed | 222 | 236 | +14 |
| Explicit-contract | 0 | 81 | +81 |
| **Unread** | **261** | **138** | **-123** |
| Unsupported analysis | 0 | 0 | -- |

123 rows left the unread set: 42 because the analyzer was wrong about them, and
81 because they earned a validated exemption. No row moved the other way.

### The performance and boundary acceptance record

Recorded against revision `77629eb2` and digest `ba06bb95`, over 603 hashed
source files.

| Counter | Measured | Adopted budget | Headroom |
| --- | --- | --- | --- |
| Transfer-walk steps | 3,001,672 | 12,000,000 | 4.0x |
| Syntax nodes walked | 969,975 | 20,000,000 | 20.6x |

The walk also indexed 216,490 edges, traced 82,772 reads and charged 985,894
operation reads, spending 49-52 s of each ~80 s run at about 2.05 GiB peak
resident size. The numbers and the four-times rationale are written into
`analysis.mjs` beside the constants they justify, and the ledger carries its own
`work` block, so the budget travels with both the code and the record.

Running out is a refusal, not a partial answer, and both budgets have a control
that proves it: `a deliberately low transfer budget fails instead of reporting a
clean tree` and `an exhausted analysis budget fails instead of reporting a clean
tree`. Both were re-run green here. A cut-off run cannot report clean.

**Where the run-to-run counters move.** The transfer counters shifted between
runs in this plan -- 2,894,478 at the baseline, 3,001,672 at the end. That is not
drift: `tests/**/*.ts` is an analysed root, so every fixture this plan added to
the contract and live suites is real analysed input. Counts of members never
moved without a named cause.

## Task 1: Two Directed-Flow Corrections

Both were found by reading live diagnostics against source, not by reading the
report, and both are corrections to the analysis rather than accommodations of
it. No production source was touched.

### A relayed promise was placed one await too deep

`orchestrators/plugin/reinstall-targets.ts` has `resolveMarketplaceScope`, an
async function whose body is `return resolvePluginMarketplaceScope(...)`.
`orchestrators/marketplace/remove.ts` has the same shape in
`resolveRemoveTargetOrSurface`. A caller awaits the outer call and reads one
member off the result; the value it reads was produced under the inner
annotation.

The walk placed every returned expression of an async body at the awaited
position of the result. For an ordinary expression that is right. For an
expression that is *already* a promise it consumes the reader's await a second
time, which left the trail empty at the inner call and dropped the rest of the
chain -- so the inner annotation earned nothing and neither did anything beyond
it.

An async body that hands back a promise hands back what that promise fulfils, so
its value sits exactly where its own awaited value does and no segment is added.
Three rows settled directly; the chain control proves the walk now carries
through every hop.

### A property on a union was answered only when every arm had it

`checker.getPropertyOfType` answers a union only when every constituent declares
the key. That leaves the commonest relay shape in this tree -- a success arm
beside a failure arm -- with no answer at all, which is why
`resolveScopeOrFailedOutcome`'s `scope` and `locations` read as unread while a
caller was destructuring them.

A key exactly one arm spells can only have come from that arm, so it now resolves
there. That is directed, not structural: the value really was that arm. Two arms
spelling one key leave it unsettled which supplied the value and resolve to
nothing, because under-crediting keeps a member a finding rather than excusing it
by its neighbour.

This one reached further than expected: 39 more rows moved, most of them because
06-04's whole-object operations can now reach members through a union place.
Ten `test-only-observed` rows were also upgraded to `runtime-observed`, which is
the same correction in the other direction.

| Correction | Rows moved | Direction |
| --- | --- | --- |
| Relayed promise | 3 | unread to runtime-observed |
| Single-arm union | 39 | 25 to runtime-observed, 14 to test-only-observed |
| Single-arm union | 10 | test-only-observed to runtime-observed |

Each newly credited row was spot-checked against source rather than against the
report: `ConfigLoadResult.filePath` is read at `install-flow.ts:697` and three
`reconcile` sites; `HookExecResult.suppressOutput` is reached by four
`json-serialization` operations in `dispatch.ts`; `NpmSource.registry` by the
`migrate-config.ts:135` serialization.

## Task 2: Two Contract Proofs and 81 Validated Entries

### What the engine learned

| Change | Why a live shape needed it |
| --- | --- |
| A selection's source resolves through a type parameter's bound | `Extract<Msg, { status: K }>` -- the bound is the set the filter selects within, so that is where the discriminant lives |
| `type-refinement`, a fifth category | `Options & { notifications: { mode: "orchestrated" } }` narrows a slot rather than selecting a variant, which is different evidence |
| A discriminant needs two spellings to differ, not every spelling to be unique | `PerEntryOutcome` has four arms sharing `"source-mismatch"` beside fifteen that differ; the key still sorts the union into groups |
| Requiring an optional slot is a narrowing | `ReinstallFailedOutcome & { failureClass: "manual-recovery" }` narrows by insisting, not by dropping constituents |
| A filter site descends through a node that shares its start | `Extract<DroppedHook, { kind: "group" }>["cond"]` -- the indexed access and the selection begin at the same character |

`type-refinement` is deliberately its own category rather than a widening of
`type-selection`. A member earns it by sitting in an operand of the named
intersection, naming a slot the rest of the intersection already declares, and
writing a type there that admits strictly less than the rest allowed. A shape
narrows when every slot it spells already exists and one of them is itself
narrower, which is what carries a refinement nested one level inside a refined
slot. An intersection that **adds** a slot is refused by name, and so is one that
restates a slot unchanged.

### The 81 entries

| Category | Entries |
| --- | --- |
| `type-selection` | 62 |
| `type-refinement` | 17 |
| `nominal-brand` | 2 |
| **Total** | **81** |

Every entry was drafted from the compiler's own view of the declaration and then
**accepted by the engine against this tree** before being written to the contract
file; none was asserted. Of 88 drafted candidates the engine refused 7, and all 7
stayed findings. That refusal rate is the point: the proof was not widened to
absorb them.

The two brands are `AbsolutePluginRoot.__absolutePluginRootBrand` and
`ScopedLocations[SCOPED_LOCATIONS_BRAND]`, each proved by an unexported `unique
symbol` plus a type no ordinary value satisfies.

### What the engine refused, and why that is the right answer

| Rows | Shape | Why no proof fits |
| --- | --- | --- |
| 3 | `Extract<Msg, { status: K }>` in `notify-context.ts` | `CommandContext<Status, Msg>` leaves `Msg` unconstrained, so at the declaration nothing says the filter discriminates |
| 1 | `Extract<PluginInfoCascadeMsg, { status: K }>` | the source is a single variant, so the filter refines nothing today |
| 1 | `Extract<PluginNotificationMessage, { description?: string }>` | selects by member presence, and `description` is not a unit type |
| 2 | `{ partition?: never }`, `{ partialable: true }` | both **add** a key the rest of the intersection does not declare |

Each of these is recorded in the ledger with that exact reason and an owner
decision, not with a contract.

## The Closed Record

`06-LIVE-TRIAGE.md` now carries a recorded disposition and a non-empty note for
**every one of its 455 rows**: 81 contract rows, 236 test-only rows and 138
unread rows.

| Status | Rows | How it is explained |
| --- | --- | --- |
| `explicit-contract` | 81 | the validated reason the engine produced, naming the evidence site |
| `test-only-observed` | 236 | the exact witness count, the first witness site and its syntax |
| `unread` | 138 | a named cluster disposition with its evidence and an owner repair plan |

`node scripts/check-unused-type-members.audit.mjs --check` exits 1 with exactly
138 problems, **all of them `unread`**. Zero `stale-source`, zero `stale-record`,
zero `missing`, zero `duplicate`, zero `incomplete`, zero `invalid`. The record
reconciles exactly against a freshly recomputed digest and a freshly run
analysis.

That is the honest state, and it is a better artifact than a zero would have
been: 138 members really are unread, the reasons are specific, and no proof was
stretched to hide one.

### The 138, by what they are

| Kind | Rows | The evidence |
| --- | --- | --- |
| Duplicate declaration | 15 | `AsyncRewakeEntry` is the structural twin of `HooksRuntimeChildEntry`; the one value built as one is handed to `registerChild`, whose parameter is the twin, so every read lands there |
| Dead field | 10 | `rollbackReplacement` reads `pair.to` only; nothing anywhere reads `renamed[].from` |
| Delegate parameter shape | 21 | the caller builds the value and the implementation reads it through its own declaration |
| Payload handed outside the tree | 9 | built into a tool result or a written file; nothing reads it back |
| Accumulator or patch literal | 13 | filled at the build site, then handed on whole |
| Locally asserted Pi mirror | 5 | `index.ts:56` casts `pi.on` with `as unknown as`, so no installed declaration checks the member |
| Absence marker | 5 | a `never` or fixed-value slot that adds a key, which no refinement proof reaches |
| Unprovable selection or compile-time proof | 11 | recorded above, each with its own refusal reason |
| Assignment target in a cast literal | 3 | the only syntax naming it writes to it, and a write is not a read |
| Error field or option bag | 5 | including two `ErrorOptions` mirrors handed whole to `super(...)` |
| Unread slot on a locally declared shape | 41 | the analyzer records no witness of any kind, in production or in tests |

### Required bounded repair plans

These are the owner-scoped plans 06-08 is blocked on. The grouping is the
audit's own conceptual-owner grouping, so each plan's scope is exactly one
owner's files plus their paired tests.

| Plan | Owner | Rows | The largest thing in it |
| --- | --- | --- | --- |
| 06-09 | `bridges/hooks` | 26 | the `AsyncRewakeEntry` duplicate (15) |
| 06-10 | `bridges/{agents,commands,skills}` + `shared/fs-utils.ts` | 13 | the `renamed[].from` dead field (10, four declaration sites, one repair) |
| 06-11 | `edge` | 17 | the tool payload and delegate shapes |
| 06-12 | `orchestrators` | 49 | return-annotation slots no caller reads |
| 06-13 | `domain`, `persistence`, `platform` | 23 | the locally asserted Pi mirrors (5) |
| 06-14 | `shared` | 10 | the two `ErrorOptions` mirrors, a behaviour-free repair already the house pattern |

06-10 is named on every row it covers even where the row's own owner would map
elsewhere, because it is one field across four declaration sites and the four
have to move together.

Two of these are behaviour-free and well understood: 06-09 makes a published type
an alias of the row it duplicates, and 06-14's `ErrorOptions` repair matches what
`PluginUpdatePhase3Error` already does. The rest carry owner decisions this plan
deliberately does not make.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 06-06-T1 | `node --test` over the live, model, flow and operations suites | 90/90 pass |
| 06-06-T2 | `node --test tests/scripts/check-unused-type-members.contracts.test.ts` | 48/48 pass |
| 06-06-T2 | `node scripts/check-unused-type-members.audit.mjs --check` | exit 1, 138 problems, all `unread` |

Plan-level, each run in the foreground with its exit status captured:

| Command | Result |
| --- | --- |
| `npm run check` | **exit 0** -- typecheck, lint, fallow (all four sub-gates), format:check, both corresponding-test gates, the direct-coverage negative gate, 6,448 unit tests and 32 integration tests |
| `node --test "tests/scripts/*.test.ts"` | 183/183 pass, up from the 166 inherited |
| `node --test tests/architecture/partial-vocabulary-guard.test.ts` | 58/58 pass |
| `node scripts/check-unused-type-members.mjs --json` | exit 1, 138 findings, `contracts: 81 validated` |
| `SKIP=trufflehog pre-commit run --files` on every commit's file set | passed before each of the ten commits |

**Production unit coverage and the direct pins are unchanged by construction.**
`git diff 4fcbc9fe..HEAD -- extensions/` is **empty**: this plan changed no
production source at all, so the 100 percent native aggregate baseline (1,834
functions, 9,050 branches, no module below 100 percent) and every direct pin
recorded at the stable wave boundary still stand. No coverage run was repeated
for a plan that changed nothing they measure. The direct-coverage hook ran on
every commit's file set regardless and passed.

### RED evidence

| Change | RED result | What failed |
| --- | --- | --- |
| Relayed promise | 6 tests, 4 pass, 2 fail | The relayed annotation earned no witness, and a two-hop chain left every inner hop unread. The four passes are the guards the fix had to leave alone: the outer annotation's own direct witness, sibling isolation, a same-spelling declaration outside the chain, and an ordinary async return. |
| Single-arm union | 10 tests, 9 pass, 1 fail | Only the positive case failed. Both negatives -- the sibling and the two-arm ambiguity -- already held, which is what proves the fix widened nothing. |
| Bounded selection and `type-refinement` | 44 tests, 35 pass, 9 fail | The 35 passes are the inherited engine, untouched. The 9 failures are the two acceptances, the nested-path acceptance, the coverage negative and five refusals that each name a distinct message. `a type parameter bounded by a shape that discriminates nothing is refused` already passed, which is the guard against the bound resolution becoming a blanket allowance. |
| Grouped discriminants and required-slot narrowing | 47 tests, 45 pass, 2 fail | One acceptance and one refusal. The refusal is the interesting one: it failed because the engine **accepted** an intersection that left an optional slot optional, comparing an annotation against a symbol type. The fix reads both sides through the property symbol. |
| Indexed-access filter site | 48 tests, 47 pass, 1 fail | The coordinate resolved to the access rather than to the selection it indexes. |

A contract engine that excuses everything fails every refusal case and one that
excuses nothing fails every acceptance case. Both directions are exercised, and
the refusal count went **up** with each change rather than down.

## Assertion and Coverage Ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-06-T1 | 10 controls in a new suite, every fixture reduced by hand from a real shape in `extensions/` and never pasted from the live enumeration. Positive: the relayed annotation's exact witness including its `via` site, every hop of a three-deep chain, the only arm of a union that declares a key. Negative: siblings on both sides of a relay, a same-spelling declaration outside the chain, two arms spelling one key. Absence: a synchronous relay and an ordinary async return, both of which must keep behaving exactly as before. | RED failed 2 of 6 and then 1 of 10; the negatives passed throughout, which is what shows neither fix widened anything. The 90 inherited analyzer controls pass unmodified. Every newly credited live row was read out of source, not out of the report. |
| 06-06-T2 | 14 further controls on the contract engine. Positive: a bounded selection, a shared discriminant, an indexed filter site, an intersection narrowing a slot, a refinement nested inside a refined slot, a required-slot narrowing. Negative: an unbounded parameter, an intersection that adds a slot, one that restates a slot unchanged, one that leaves an optional slot optional, a `refines` site naming no intersection, a member outside the named intersection. Absence: a refinement covers neither the slot it narrows nor its unrefined sibling. Plus the live run: 81 entries accepted and 7 refused out of 88 drafted. | RED failed 9 of 44 then 2 of 47 then 1 of 48. `npm run check` exit 0 covers the aggregate production coverage gate, both direct-pin gates and both corresponding-test gates. No production source changed, so no production coverage number could move. |

No production coverage threshold, direct pin, suppression, census pin, threshold
override or assertion contract was weakened. One inherited gate was **repaired**;
see deviation 3.

## Deviations from Plan

### 1. [Rule 1 - Bug] A control of mine asserted the wrong coordinate

- **Found during:** Task 1, the first green run
- **Issue:** `an async relay credits the member on the annotation that produced the value` pinned the transfer's `via` site at line 17 of the fixture. Line 17 is the closing brace; line 16 holds `return inner();`, which is the source expression that actually carried the value. The assertion was mis-transcribed by me, not wrong about the analyzer.
- **Fix:** Corrected the expected coordinate and the comment naming it. The assertion is unchanged in strength -- it still pins the exact site, kind, origin, syntax and `via` of the single witness.
- **Files modified:** `tests/scripts/check-unused-type-members.live.test.ts`
- **Commit:** `0489ad0e`

### 2. [Rule 1 - Bug] My first refinement proof compared an annotation against a symbol type

- **Found during:** Task 2, the second RED run
- **Issue:** `proveTypeRefinement` read the refined side from the declaration's type annotation and the wider side from the property symbol. Under `exactOptionalPropertyTypes` those two spell an optional slot differently -- the annotation omits `undefined`, the symbol type includes it -- so an intersection that left an optional slot **optional** looked like a narrowing and was accepted. That is the one direction a refinement proof must never fail in.
- **Fix:** Both sides are now read through the property symbol along the same path, and optionality is compared explicitly: insisting on a slot the rest of the intersection lets a value omit is the narrowing.
- **Verification:** `an intersection that leaves an optional slot optional narrows nothing` failed before the fix and passes after; `requiring a slot the rest of the intersection leaves optional narrows it` pins the accepted direction.
- **Files modified:** `scripts/check-unused-type-members.contracts.mjs`
- **Commit:** `256524a5`

### 3. [Rule 3 - Blocking] The retired-verdict guard had been red since 06-05

- **Found during:** The plan-level `npm run check`
- **Issue:** `tests/architecture/partial-vocabulary-guard.test.ts` forbids the status literal `"unsupported"` across code, docs and unit tests. `tests/scripts/check-unused-type-members.audit.test.ts`, added by 06-05's `3c30479b`, spells it twice -- as the name of one of the audit's own refusal categories. `npm run check` has therefore been failing since that commit; 06-05 ran the analyzer suites and the corresponding-test gates but not the full suite, which is exactly the failure mode this plan's brief warned about. It blocks this plan's own verification.
- **Fix:** A fourth `homonym` waiver row, which is the guard's designed mechanism for a token that names something other than this project's plugin verdict vocabulary. Three `"unsupported"` homonym waivers already exist for the same reason. The guard's `every token waiver is load-bearing` control keeps the new row honest.
- **Verification:** 58/58 in the guard suite; `npm run check` exit 0 afterwards, against exit 1 before.
- **Files modified:** `tests/architecture/partial-vocabulary-guard.test.ts`
- **Commit:** `4c7dd13c`

### 4. [Documented choice] Commit messages carry no plan scope

The GSD task-commit protocol asks for `{type}({phase}-{plan}):`. This project's
`CLAUDE.md` forbids milestone and phase identifiers in commit messages and takes
precedence, so the ten commits are plain Conventional Commits, exactly as in
06-01 through 06-05.

### 5. [Documented choice] Five RED/GREEN pairs for two tasks

Each correction and each proof was measured RED before its fix was written. One
RED was committed on its own (`a2b94912`); the remaining four were run and their
failures recorded before the matching GREEN, and the second of Task 1's two
corrections shares its GREEN commit with the first so no commit leaves the suite
red. Every RED result is in the table above.

### 6. [Documented choice] No production source was repaired here

The plan bounds Task 1 to five analyzer files and Task 2 to five contract and
record files, and instructs that a diagnostic needing files outside that
ownership is documented with its evidence and handed to a bounded owner-specific
plan. All 138 remaining findings sit in `extensions/`, which is outside both. Six
plans are named above with their exact scope and row counts. This is the plan's
own escape hatch, used as written, not a waiver.

### 7. [Documented choice] The contract entries were generated and then validated, not hand-typed

Each of the 88 drafts was derived from the compiler's own view of the
declaration, then run through the real engine one at a time against the real
program. Only the 81 the engine accepted were written to the contract file. Hand
typing 81 five-field entries with exact coordinates would have been less
accurate, not more, and the acceptance step is what makes each one evidence
rather than assertion.

---

**Total deviations:** 3 auto-fixed bugs (2 in this plan's own work, 1 inherited
and blocking) and 4 documented choices.
**Impact:** No gate was weakened. No suppression, census pin, threshold override,
coverage exclusion or assertion relaxation was added. One inherited gate was
repaired and has been failing for two commits; one of this plan's own proofs was
tightened after a control caught it accepting the wrong direction.

## Observed Limits

Stated rather than worked around.

- **A selection over an unconstrained type parameter cannot be proved at its declaration.** The compiler has nothing to say about a filter over `Msg` until `Msg` is instantiated. Constraining the parameter is a source change and belongs to its owner.
- **A filter in a conditional type's `extends` clause has no category.** Two live rows do exactly the type-system work a two-argument selection does, in a form the engine does not prove. Adding that form is its own bounded plan with its own drift controls, not a widening of this one.
- **A compile-time schema proof has no category either.** `DroppedHookSchema`'s members exist so an assertion can compare the schema's static type against a hand-written union. Nothing reads them and nothing can.
- **A narrowing is proved by constituents, not by assignability.** `checker.isTypeAssignableTo` exists at runtime but is internal to TypeScript; the refinement proof uses union-constituent containment and shape recursion instead, which is the technique `proveTypeSelection` already uses and is bounded at four levels.
- **`--check` still costs a full analysis.** Closure is 79 s and 2.00 GiB, deliberately: an audit that trusted a stored report would be checking the record against itself.
- **The recorded revision trails by one commit.** The digest is the authority and is current; the revision is there for a reader who wants to find the source again. This is the behaviour 06-05 recorded.
- **The triage document is 500 KB across 4,900 lines.** That is the cost of a recorded disposition for all 455 rows. It sits under `.planning/`, which both `mdformat` and `markdownlint-cli2` exclude.

## Known Stubs

None. No placeholder values, no unwired output, no committed `skip` or `todo`,
and no contract entry that was not accepted by the engine against this tree.

The 138 unread rows are not stubs: they are measured findings, each with recorded
evidence and a named owner, and `--check` fails every one of them rather than
treating any as settled.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at
a trust boundary. T-06-06-01 is mitigated by every contract naming one exact
declaration settled through the compiler's declaration map, by the sibling
controls on both analyzer corrections, and by the 7 drafts the engine refused.
T-06-06-02 by parsing without importing or executing, and by the contract
document being read as JSON with no wildcard, traversal or absolute path
accepted. T-06-06-03 by the two bounded budgets, both measured here and both with
an exhaustion control that refuses rather than answering partially. T-06-06-04 by
the deterministic member-level report, the exact positive and negative process
results above, and a ledger that reconciles against a digest recomputed from disk
rather than from the report it describes.

## Issues Encountered

- **`--check` fails today, and will keep failing until the six repair plans land.** 138 unread members, each recorded. That is the plan's stated must-have partially unmet: every candidate has an exact observation, a validated contract or a *named, evidence-backed* repair, but 138 repairs are not yet *resolved*. The alternative -- widening a proof until the number reached zero -- is the failure this phase exists to prevent, so the number stands.
- **06-05 left `npm run check` red.** Found here, fixed here, recorded as deviation 3. Worth carrying forward: the analyzer suites and the corresponding-test gates are not a substitute for the full suite.
- **Adding test fixtures changes the analysed input.** `tests/**/*.ts` is an analysed root, so a new fixture moves both the transfer counters and the source digest. Neither is a defect, but a reader comparing two runs needs to know it.

## Next Phase Readiness

- **06-07 is unblocked.** It plants the offender that must fail the gate; nothing in this plan's shapes depends on the live count being zero, and the gate's exit contract is unchanged.
- **06-08 is blocked, as the plan requires.** Activation needs the six repair plans (06-09 through 06-14) executed and verified, after which this closure task's `--check` has to be re-run and reach zero. The contract file's own drift controls mean any of those repairs that makes a contracted member readable will fail the gate with exit 2 by name, which is the intended coupling.
- **Re-measure after any source change.** Any edit under `extensions/` or `tests/`, or to `tsconfig.json` or the contract file, moves the digest and `--check` reports `stale-source`. Re-running `--inventory` rebuilds the record and carries forward every note whose row did not move.
- **`requirements-completed` is deliberately empty.** MEMBER-01 and MEMBER-02 are declared by all eight plans in this phase, so neither may read `Complete` until the last declaring plan finishes.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-15*

## Self-Check: PASSED

- `tests/scripts/check-unused-type-members.live.test.ts` -- FOUND
- `scripts/check-unused-type-members.flow.mjs`, `.contracts.mjs`, `.contracts.json`, `.analysis.mjs` -- all FOUND
- `tests/scripts/check-unused-type-members.contracts.test.ts`, `tests/architecture/partial-vocabulary-guard.test.ts` -- FOUND
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` -- FOUND
- All ten commits (`a2b94912`, `0489ad0e`, `69d8b47b`, `b4828c65`, `7b7fb900`, `256524a5`, `2b3bb89e`, `dfe51c0d`, `4c7dd13c`, `77629eb2`) -- FOUND in `git log`
- `commits: 10` is measured: `git rev-list --count 4fcbc9fe..HEAD` returned 10 before this documentation commit, the same instrument 06-02 through 06-05 recorded theirs with.
- `tokens: 181357` is `chars/4` over every file this plan changed. 128,222 of it is the generated triage document; the authored analyzer, contract and test changes are 53,135. The plan estimated 26,000, which the authored share came in over by roughly twice -- the contract engine needed two proofs rather than none, and the live reconciliation was 483 rows rather than a sample.

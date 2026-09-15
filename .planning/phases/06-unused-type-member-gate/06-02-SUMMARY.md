---
phase: 06-unused-type-member-gate
plan: "02"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, dataflow, gate, node-test]

requires:
  - phase: 06-unused-type-member-gate
    provides: The candidate inventory, syntax-first read classification and the deterministic report the transfer walk extends
provides:
  - A demand-driven backward transfer walk in `scripts/check-unused-type-members.flow.mjs` that credits a read to the source member that actually supplied it
  - Directed edges for arguments, initializers, assignments, object and array construction, returns, callbacks in both directions, and rest arguments
  - Container semantics for arrays and tuples, promise fulfillment, and Map/WeakMap values, with keys and unrelated slots excluded
  - Read-site records on `collectObservations`, so member identity and read classification keep exactly one definition
  - A populated `transfers` graph on the contract-evaluator context, replacing 06-01's empty placeholder
  - A `work` block on the report stating the steps, edges, reads and elapsed time of the transfer walk
  - Two bounded analysis gaps: `erased-call-consumer` and `unmodeled-container-operation`
affects: [06-03, 06-04, 06-05, 06-06, 06-07, 06-08]

actuals:
  tokens: 19768
  tasks: 3
  commits: 5
plan_head_before: 4fdc441b4293236d77ddf1d2feb82d678e527962

tech-stack:
  added: []
  patterns:
    - "Backward demand-driven provenance: one memoised question per read site rather than a forward product of assignable types"
    - "An edge states either `at` (where in the destination its value was placed) or `from` (where in the source the destination was taken), and those consume or prepend the path respectively"
    - "Synthetic NUL-prefixed path segments for positions a property name cannot spell: element, tuple index, awaited value, map value"
    - "Question-level caches shared across reads, because a place's members and its sources do not depend on which read asked"

key-files:
  created:
    - scripts/check-unused-type-members.flow.mjs
    - tests/scripts/check-unused-type-members.flow.test.ts
  modified:
    - scripts/check-unused-type-members.analysis.mjs
    - scripts/check-unused-type-members.model.mjs

key-decisions:
  - "A transfer is credited only where a value actually moved; two structurally identical declarations with no call between them stay unrelated"
  - "Edges are one-way, so a read on the destination never vouches for the source side of the same call"
  - "The nearest place that supplies a member names it, so one read leaves exactly one witness per source member and a transferred witness never restates a direct read"
  - "Placement paths and extraction paths are opposite directions and are modelled separately, which is what keeps a rest slot distinct from a loop element"
  - "A call whose target this program cannot see, and a container operation with no directed semantics, each report a gap bounded to the members they could have moved"
  - "The path bound is four segments, measured: six costs a fifth again in work and finds one more witness on this tree"

patterns-established:
  - "Every transfer control names both the member the edge must carry and the sibling or neighbour it must not"
  - "Each task's RED phase runs against the previous task's analyzer, so the suite is always measured against the exact model it is expanding"

requirements-completed: []

coverage:
  - id: D1
    description: "An argument credits the source member the resolved parameter actually read, and leaves its siblings and unrelated lookalikes unread"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an argument credits the source member the resolved parameter actually read"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a transfer credits no sibling of the member that was read"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a compatible declaration with no call earns nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a transfer is directed, so the destination never credits the source side"
        status: pass
      - kind: other
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#the command-line report carries the transferred witness and only the real offenders"
        status: pass
    human_judgment: false
  - id: D2
    description: "Aliases, conditionals, nested literals, returns, destructured results, cross-module aliases, overloads and refinement views preserve only the transferred path"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an alias and an annotated assignment keep the origin"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a conditional keeps every branch it could have taken"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a nested object literal keeps the path it was built at"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a returned value keeps the origin the body returned"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a destructured result binding keeps the origin"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an imported value alias keeps the origin across modules"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an overload resolves to the parameter its implementation actually reads"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an optional and a rest parameter keep the arguments they receive"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a satisfies view keeps the lineage of the value it annotates"
        status: pass
    human_judgment: false
  - id: D3
    description: "Callback input flows inward and callback results outward, while declaring a callback, passing an unread parameter and naming a type alias transfer nothing"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a callback parameter receives the value the caller supplied"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a callback result flows outward to the caller of the callback"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#declaring a callback and never invoking it reads nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a passed-but-unread parameter stays unread"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a type-only alias transfers nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Arrays, tuples, iteration, array callbacks, promise fulfillment and map values carry nested paths, while map keys and neighbouring slots receive no credit"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an array element keeps the origin it was built from"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a tuple credits the position it was read at and not its neighbour"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#iterating an array keeps the element origin"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an array callback receives the element the caller supplied"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an awaited promise keeps the fulfilled origin"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#then receives the fulfilled value the caller resolved"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a map value transfers to what get returns, and its key is not a value read"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a weak map carries a nested replacement record to the field that is read"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cycles terminate, an unmodeled container operation and an erased call are reported rather than assumed clean, and an exhausted transfer budget fails"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a cycle between two bodies terminates with an exact witness"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an unmodeled container operation is reported, not assumed clean"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#an erased call that could consume a candidate is reported, not assumed clean"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#a deliberately low transfer budget fails instead of reporting a clean tree"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.flow.test.ts#the report states the work the transfer walk actually did"
        status: pass
    human_judgment: false
  - id: D6
    description: "The transfer walk runs against the live repository and moves the population, pending the reconciliation owned by 06-06"
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json"
        status: pass
    human_judgment: true
    rationale: "The live counts are still an interim measurement: contracts and whole-object operations are not in the model yet. Whether each remaining row is a defect, a contract or an analyzer gap is 06-06's reconciliation, not a verdict this plan can reach."

duration: 2h 5m
completed: 2026-09-15
status: complete
---

# Phase 6 Plan 02: Directed Value Transfers Summary

**A backward, demand-driven provenance walk that credits a read to the member which actually supplied it — one memoised question per read site, edges that only exist where a value really moved, and paths that a tuple slot, a map key or an unread sibling can never borrow.**

## Performance

- **Duration:** 2h 5m
- **Started:** 2026-09-15T09:30:00Z
- **Completed:** 2026-09-15T11:35:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- A read is now credited back to whatever supplied its value. `consume(produced)` where `consume` reads `consumed.carried` credits `Produced.carried` with a witness naming both the read site and the argument that carried the value there.
- The relation is directed and site-specific. A structurally identical declaration that no call ever reaches stays unread, a sibling of the member that was read stays unread, and a value sent from `Sent` to `Received` never credits `Received` when `Sent` is the one being read.
- Edges exist for arguments to resolved parameters — including overload implementations, optional parameters and rest arguments — initializers, assignments, `for ... of` bindings, object and array construction with spreads, property and element paths, refinement views, conditionals and logical joins, returned values, and cross-module aliases.
- A function body handed to a parameter is bound to it, which is the single mechanism that carries a caller's value **inward** to a callback parameter and a callback's result **outward** to whoever called it. Those are opposite directions and the controls state both.
- Containers carry nested paths: array and tuple construction, indexing, iteration and the callback methods; promise fulfillment through `await`, `then` and `Promise.resolve`; and `Map`/`WeakMap` values through `set`, `get` and `values`. A map key is not a value read, and tuple slot 0 never inherits slot 1.
- Two bounded gaps keep an unknown from reading as clean: `erased-call-consumer` for a call whose target this program cannot see, and `unmodeled-container-operation` for a container member with no directed semantics. Each is attributed only to the members the operation could have moved.
- The report now carries `work`: the steps the walk spent, the edges it indexed, the reads it traced and how long it took. Nothing is compared against it; it exists so 06-06's budget record is evidence rather than a guess.

## Task Commits

1. **Task 1 (tracer): trace one real argument-to-parameter read end to end**
   - `c20b1b32` (test) — the transfer controls plus a deliberate no-flow stand-in
   - `f435df21` (feat) — read-site records on the model, and the backward walk over arguments and bindings
2. **Task 2: expand local, return and callback transfers**
   - `383bb018` (test) — fifteen failing controls, each paired with its negative
   - `6de2123d` (feat) — paths, refinements, branching, literals, returns, overloads, rest arguments, callback binding and the erased-call gap
3. **Task 3: carry nested provenance through containers**
   - `b983b23d` (feat + test) — container semantics, the placement/extraction edge split, the question-level caches and the `work` block

Task 3 landed as one commit because its RED phase could not be committed separately without a red tree: the fix it needed was a correction to the edge model introduced in Task 2 — `at` and `from` are opposite directions — and committing the controls alone would have left a suite that fails for a reason the previous commit's design caused rather than for a missing feature. The failing run was still executed first and is recorded below.

## Files Created/Modified

- `scripts/check-unused-type-members.flow.mjs` — the transfer index and the backward walk. Sorts every analysed file's syntax once, indexes the edges, then answers one memoised question per recorded read.
- `tests/scripts/check-unused-type-members.flow.test.ts` — 34 controls driving the composed analysis, plus one that runs the real command-line tool as a child process so the witness is proven to survive into the shipped report.
- `scripts/check-unused-type-members.analysis.mjs` — composes the flow module, merges its witnesses and gaps behind the model's own, supplies the real `transfers` graph to the contract evaluator, and publishes the `work` block.
- `scripts/check-unused-type-members.model.mjs` — records read sites, and exports `resolveCandidates` so the transfer walk resolves member identity through the same definition.

## Verification Results

Every command below was run in the foreground and its result read directly.

| Command | Result |
| --- | --- |
| `node --test tests/scripts/check-unused-type-members.flow.test.ts` | 34 tests, 34 pass, 0 fail |
| `node --test tests/scripts/check-unused-type-members.model.test.ts` | 16 tests, 16 pass, 0 fail |
| `node --test tests/scripts/check-unused-type-members.test.ts` | 17 tests, 17 pass, 0 fail |
| `npm test` | 6,332 tests, 6,332 pass, 0 fail — 06-01's 6,298 plus the 34 added here |
| `npm run typecheck` | exit 0 (pre-commit `npm typecheck`) |
| `npm run lint` | exit 0 (pre-commit `npm lint`) |
| `npm run format:check` | exit 0 (pre-commit `npm format check`) |
| `npm run fallow` | exit 0 across all four links (pre-commit `npm fallow`) |
| `npm run test:coverage:direct` on changed pairs | exit 0 (pre-commit `npm direct coverage (changed pairs)`) |
| `node scripts/check-unused-type-members.mjs --json` | exit 1, 468 findings, 68.8s wall, 2.0 GB peak RSS |

No production source under `extensions/` changed in this plan, so the native aggregate production unit coverage the orchestrator holds for this wave is unaffected. `git diff 4fdc441b..HEAD -- extensions/` is empty.

### RED evidence

Each task's failing phase was executed against the analyzer as it stood before that task, and every failure was an assertion about the planned behaviour rather than a crash.

| Task | RED result | What failed |
| --- | --- | --- |
| 1 | 7 tests, 4 pass, 3 fail | Against a deliberate no-flow stand-in that answers "no value ever transfers": the transferred witness, the shipped report's finding list, and the intermediate inferred object. The four passes are the negative controls, which is exactly what a no-flow analyzer gets right. |
| 2 | 22 tests, 14 pass, 8 fail | Against the argument-and-binding-only walk: nested literals, returns, destructured results, both callback directions, overloads, rest arguments and the erased-call gap. |
| 3 | 34 tests, 26 pass, 8 fail | Against the walk without container semantics: tuple positions, iteration, array callbacks, promise fulfillment through `then`, map values and keys, the unmodeled-operation gap, and the `work` block. |

A no-flow analyzer fails three of Task 1's seven cases and every case Tasks 2 and 3 added, so the suite discriminates the mutant this plan exists to catch.

### Live measurement

| Figure | 06-01 | 06-02 |
| --- | --- | --- |
| Production files | 236 | 236 |
| Candidate declarations | 3,464 | 3,464 |
| Runtime-observed | 2,739 | 2,891 |
| Test-only-observed | 111 | 105 |
| Unread | 614 | 392 |
| Unsupported-analysis | 0 | 76 |
| Findings (exit 1) | 614 | 468 |
| Wall time | 27s | 68.8s |

2,276 transferred witnesses were recorded, and 146 members are observed **only** through a transfer — they read as unread under 06-01's model and are now explained. The transfer walk itself indexed 212,173 edges and spent 1,769,472 of its 4,000,000-step budget over 67,202 recorded reads, in 40.1 seconds.

All 76 unsupported rows carry `unmodeled-container-operation`; `erased-call-consumer` fired nowhere, because this tree has no `any`-typed callee. 517 unmodeled-operation reasons were recorded in total, but a member with an independent witness is still settled, so only the 76 with no witness of their own end up unsupported.

## Decisions Made

- **A transfer is an event, not a relationship.** Edges are created at argument, initializer, assignment, construction, return and container sites. Two identical interfaces with no call between them share nothing, which is the whole point of the `Lookalike` and `Received` controls.
- **Backward and demand-driven, not forward and structural.** Each recorded read asks "which places could have supplied this?" and the answer is explored breadth first. A forward model would have to enumerate assignable pairs; the research measured that shape at 2,081,504 type-pair comparisons in its prototype. This one spends 1.77M steps for the whole repository and the fixture control pins the shape by asserting a small fixture stays under 5,000 steps.
- **`at` and `from` are different edges.** A rest argument is *placed at* a slot of its parameter, so tracing backwards consumes that slot. A loop binding is *taken from* an element of what it iterates, so tracing backwards prepends it. Collapsing them into one rule is what made the iteration, array-callback and `then` controls fail, and separating them is what fixed all three at once.
- **The nearest supplier names the member.** Combined with skipping whatever the read already proved directly, this gives one witness per source member per read, with the argument expression as the `via` — the site a reader would look at to understand the link.
- **Questions are answered once, not once per read.** A place's members under a path, and the places that feed it, do not depend on which read asked. Caching both cut the live walk from 78.6s to 40.1s and its peak from 2.95 GB to 2.0 GB.
- **The path bound is measured.** Four segments. Raising it to six costs a fifth again in work and 250 MB, and finds exactly one more witness on this tree. Stopping early under-credits, which produces a finding to investigate rather than a member wrongly accepted, so the bound is a documented limit and not a hidden one.
- **`join` and `toString` are neutral for transfer.** They do consume element values, but as serialisation, which 06-04 owns as an operation summary. Treating them as transfers here would invent a path; treating them as unmodeled would raise a gap that a real summary is about to answer.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] The transfer walk cannot see read sites without the model recording them**

- **Found during:** Task 1
- **Issue:** The plan's task files name only `flow.mjs`, `analysis.mjs` and the new test. But a backward walk starts from a read, and `collectObservations` classified reads without keeping them. Re-deriving read sites inside `flow.mjs` would have duplicated `readSyntaxOf` and its helpers — the classifier the whole model rests on — in a second module, which the duplication gate would have reported and which would have given member-read classification two definitions.
- **Fix:** `collectObservations` now also returns `reads`: the place that supplied the value, the property path selected on the way, the key, the kind, the origin, the site, and the candidates the read already proved on its own. `resolveCandidates` was exported for the same reason — member identity keeps one definition. Nothing in the classifier's behaviour changed; the 16 model controls and 17 command-line controls pass unmodified.
- **Files modified:** `scripts/check-unused-type-members.model.mjs`
- **Committed in:** `f435df21`

**2. [Rule 1 - Bug] The overload implementation was found through `valueDeclaration`**

- **Found during:** Task 2
- **Issue:** `symbol.valueDeclaration` on an overloaded function is an overload signature, not the implementation, so arguments were bound to parameters no body ever reads and the overload control failed.
- **Fix:** Scan the symbol's declarations for the one with a body.
- **Files modified:** `scripts/check-unused-type-members.flow.mjs`
- **Committed in:** `6de2123d`

**3. [Rule 1 - Bug] The whole-repository walk exhausted memory**

- **Found during:** Task 2
- **Issue:** The first live run aborted with a heap failure at 4 GB. Expansions were pushed onto the queue and only deduplicated when popped, so a place reachable by many routes was queued once per route and a widely-called helper produced a queue of millions of entries.
- **Fix:** A question is admitted to the queue at most once, and a path deeper than the measured bound is not admitted at all. The live walk then completed in 1,458,064 steps at 1.5 GB.
- **Files modified:** `scripts/check-unused-type-members.flow.mjs`
- **Committed in:** `6de2123d`

**4. [Rule 1 - Bug] Container semantics reintroduced the memory failure**

- **Found during:** Task 3
- **Issue:** Container paths raised the live peak back to 2.95 GB and the walk to 78.6 seconds, and the deeper path bound aborted again.
- **Fix:** Cache the member lookup and the expansion per question rather than per read, skip the container probe entirely for a call the checker already resolved into a body in this program, and memoise the receiver kind. 40.1 seconds at 2.0 GB.
- **Files modified:** `scripts/check-unused-type-members.flow.mjs`
- **Committed in:** `b983b23d`

### Documented scope and convention choices

**5. Commit messages carry no plan scope.** As in 06-01: the project's `CLAUDE.md` forbids milestone and phase identifiers in commit messages and takes precedence over the GSD `{type}({phase}-{plan}):` convention. The commits are plain Conventional Commits and are listed above by hash.

**6. `analysis.mjs` gained the `work` block and a `flowBudget` option.** Task 3's declared files are the flow module and its test, but its action requires measured work counters and a deliberately low budget that fails. Both have to surface through the composed analysis to be observable, and `analysis.mjs` is inside the plan's declared `files_modified`. The command-line tool — 06-03's file — was not touched, so the transfer budget currently has no flag; the default is the only value the shipped gate uses.

**7. The rest-parameter control reads an element rather than mapping it.** The first draft read `slots.map((slot) => slot.kept)`, which needs the array-callback semantics Task 3 owns rather than the rest-parameter edge Task 2 owns. It now reads `slots[0]`. The assertion is unchanged in strength: it still demands two distinct transfer witnesses, one through the optional parameter and one through the rest slot.

**8. `commit_docs` and pre-commit.** `trufflehog` fails in this checkout with `failed to read index file: ... .git/index: not a directory` — it cannot scan a linked worktree. Per the project's `CLAUDE.md` worktree rule, every commit here used `SKIP=trufflehog`. No other hook was skipped and none was bypassed with `--no-verify`.

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 bugs) and 4 documented scope or convention choices.
**Impact on plan:** No gate was weakened. No census pin, threshold override, suppression, coverage exclusion or assertion relaxation was added, and no production source under `extensions/` changed. Task ordering was unchanged.

## Known Stubs

None. No placeholder values, no unwired components and no committed `skip` or `todo`.

The following are documented bounds of the analysis rather than stubs, and each produces a finding to investigate rather than a member wrongly accepted:

| Bound | Where | Why it is safe |
| --- | --- | --- |
| Paths deeper than four segments are not followed | `deepestTrail` in `check-unused-type-members.flow.mjs` | Measured: six segments finds one more witness on this tree. Under-crediting produces a false finding, never a false accept. |
| `join` and `toString` move no provenance here | `neutralMembers` in `check-unused-type-members.flow.mjs` | They consume element values as serialisation, which 06-04 owns as an operation summary. |
| `Map`/`WeakMap` `entries`, array `sort`, `reverse`, `push` and every other unlisted container member | `reportUnmodeledMember` in `check-unused-type-members.flow.mjs` | Each raises `unmodeled-container-operation` against the values it could have moved, so it fails rather than reading as clean. |
| Array binding patterns in `for ... of` and in parameters | `bindingSourceOf` in `check-unused-type-members.model.mjs` | The read is classified as it always was; only the transfer origin is absent, so the member can still be settled by any other witness. |

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at a trust boundary. It reads the same compiled program 06-01 already parses and never imports or evaluates analysed source; the execution-safety control from 06-01 still passes unchanged.

The threat register's four entries are addressed rather than deferred. T-06-02-01 (tampering with provenance) is what the directed-edge and sibling controls exist to prove. T-06-02-02 (execution of compiler input) is unchanged from 06-01 and still controlled. T-06-02-03 (recursive graph, malformed input) is the memoised breadth-first queue, the path bound and the budget that fails rather than truncates — the two memory failures above were found and fixed by running the real tree. T-06-02-04 (gate acceptance) is the deterministic witness ordering plus the assertion and coverage ledger below.

## Assertion and Coverage Ledger

| Task | Expected behaviour stated before implementation | Counterexample exercised | Command and result | Coverage delta |
| --- | --- | --- | --- | --- |
| 06-02-T1 | A produced `A` passed to a `B` parameter credits `A.read` when `B.read` is read, with a witness naming the read site and the argument. | A compatible `A` with no call, and the unread `A` sibling, both stay unread; a reversed edge leaves the destination uncredited. | `node --test tests/scripts/check-unused-type-members.flow.test.ts` — 7/7 pass (RED: 4/7) | 7 new analyzer controls; no production `.ts` coverage surface changed. |
| 06-02-T2 | Aliases, conditionals, nested literals, returns, destructured results, cross-module aliases, overloads, optional and rest parameters and refinement views preserve only the transferred path; callback input flows inward and results outward. | Declaring a callback without invoking it, a passed-but-unread parameter, and a type-only alias all transfer nothing; an erased call reports a gap. | `node --test tests/scripts/check-unused-type-members.flow.test.ts` — 22/22 pass (RED: 14/22) | 15 further controls; no production `.ts` coverage surface changed. |
| 06-02-T3 | Readonly arrays, tuples, iteration, array callbacks, promise fulfillment and map values preserve nested paths. | A tuple neighbour, a map key and an unread sibling receive no credit; an unmodeled container operation and an exhausted budget both fail; a cycle terminates. | `node --test tests/scripts/check-unused-type-members.flow.test.ts tests/scripts/check-unused-type-members.model.test.ts` — 50/50 pass (RED: 26/34 on the flow suite) | 12 further controls; the 16 model controls pass unmodified, proving the read-site addition changed no classification. |

No existing assertion was removed or weakened. The 33 controls 06-01 shipped all pass unchanged.

## Issues Encountered

- **The whole-tree run costs 68.8 seconds and peaks at 2.0 GB.** That is 2.5 times 06-01's wall time for a walk that indexes 212,173 edges and traces 67,202 reads. It fits comfortably inside the default Node heap, but it is the figure 06-06 has to justify before the gate becomes mandatory, and it is why the walk's work is now published in the report.
- **76 members now read as `unsupported-analysis` instead of `unread`.** Every one is an unmodeled container operation. Several are the `sort`, `push` and `entries` shapes; 06-04's operation summaries are the natural owner of most of them, and 06-06 reconciles whatever is left.
- **The live population is still interim.** 468 findings against 06-01's 614. Contracts (06-03) and whole-object operations (06-04) are not in the model, so a member serialised into an output or copied by a shallow operation still reads as unread. `lint:type-members` remains deliberately outside `npm run check` until 06-08.
- **The `WeakMap` control is weaker than it looks.** Because the map is declared `WeakMap<Replacement, Internals>`, the checker already knows the value type, so `entry.from` is credited directly and the transfer is not what settles it. The control still earns its place: it pins that a map key contributes nothing, that unread sibling fields stay unread, and that the nested path resolves — but 06-06 should not read it as proof that a stored-then-retrieved record carries provenance across differing declared types.

## User Setup Required

None — no external service configuration is required.

## Next Phase Readiness

- **Ready for 06-04.** The `transfers` graph is populated and reaches the contract evaluator, and `flow.mjs` is stable for 06-04 to extend with whole-object operations. The shapes 06-04 needs are all in place: edges carry `at` or `from`, paths carry synthetic segments for element, index, awaited value and map value, and `recordGap` takes a reason so a new operation class can raise its own.
- **06-03 is unaffected.** It owns `check-unused-type-members.mjs` and the contract modules, neither of which this plan touched, and the `contractEvaluator` seam is unchanged apart from `transfers` no longer being empty.
- **`requirements-completed` is deliberately empty.** MEMBER-01 and MEMBER-02 are declared by all eight plans in this phase, so neither may read `Complete` until the last declaring plan finishes.
- **No blocker.** `npm test` is green, the gate is not in `npm run check`, and nothing downstream is gated on the live population being clean.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-15*

## Self-Check: PASSED

Both created files, both modified files and this summary exist on disk, and all
five task commits are present in `git log`. Every `<verify>` command in the plan
was run in the foreground and its result read directly; none was skipped.

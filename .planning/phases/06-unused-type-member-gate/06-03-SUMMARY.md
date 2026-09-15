---
phase: 06-unused-type-member-gate
plan: "03"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, contracts, gate, node-test]

requires:
  - phase: 06-unused-type-member-gate
    provides: The candidate inventory, declaration map and injected contractEvaluator seam the contract engine plugs into
  - phase: 06-unused-type-member-gate
    provides: The directed value-transfer graph an external-output contract follows from origin to boundary
provides:
  - A strict versioned contract loader and validator in `scripts/check-unused-type-members.contracts.mjs`, supplied to the analysis through 06-01's `contractEvaluator` seam by the real command-line tool
  - Four evidence categories - `external-output`, `external-input`, `nominal-brand`, `type-selection` - each with its own proof against compiler symbols
  - Contract identity settled through the inventory's declaration map, so a drifted coordinate is refused rather than proved against another member
  - External-output acceptance that follows 06-02's directed transfers from the member origin to a return an installed declaration checks
  - Integrity refusals for stale, contradictory, duplicate, wildcard, unknown-key, wrong-version and read-redundant entries
  - An empty `scripts/check-unused-type-members.contracts.json`, read by every run and reported in the diagnostics
  - Thirty-four executable controls stating both the accepted evidence and its neighbouring counterexample
affects: [06-04, 06-05, 06-06, 06-07, 06-08]

actuals:
  tokens: 13035
  tasks: 2
  commits: 4
plan_head_before: a1291aa4e487f015e91b10770127c27b324528cd

tech-stack:
  added: []
  patterns:
    - "A contract is refused as a setup failure, not downgraded to a member finding: an entry whose evidence no longer holds means the gate cannot answer, which is a different outcome from having found an unread member"
    - "Category-scoped schema keys, so an allowance borrowed from another category is an unknown key rather than a quiet extra"
    - "Evidence resolved from compiler symbols and the declaration map; coordinates only ever locate syntax, never establish identity"

key-files:
  created:
    - scripts/check-unused-type-members.contracts.mjs
    - scripts/check-unused-type-members.contracts.json
    - tests/scripts/check-unused-type-members.contracts.test.ts
  modified:
    - scripts/check-unused-type-members.mjs
    - scripts/check-unused-type-members.analysis.mjs

key-decisions:
  - "An invalid contract exits 2 as a setup failure rather than exiting 1 as a finding, which keeps `we cannot answer` distinct from `this member is unread`"
  - "Identity comes from the inventory's declaration map: the contract's coordinate locates a node, and the node has to be the one the inventory recorded for that candidate"
  - "External output needs both halves - the named origin must build that exact member, and its value must arrive at a return the compiler checked against an installed declaration"
  - "A type-selection contract covers the filter literal's own member, not the union discriminants it selects on; the discriminants are ordinary members and stay ordinary"
  - "A nominal brand is proven by a key no other module can spell plus a type no ordinary value satisfies; an exported key symbol is refused"
  - "An optional upstream slot compels no local mirror, and a handler reached through an assertion proves no external expectation"
  - "No `--contracts` option: the contract file is resolved under the analysed root, so a fixture brings its own and an absent file excuses nothing"

patterns-established:
  - "Every contract control names both the evidence that must be accepted and the neighbouring shape that must not be"
  - "Each task's RED phase runs against the analyzer as it stands, so the suite is measured against the exact engine it is expanding"

requirements-completed: []

coverage:
  - id: D1
    description: "An output member whose value really reaches a resolved external return is accepted, directly or along a recorded transfer"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an output member that reaches a resolved external return is accepted"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin that reaches the boundary through a transfer is accepted"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an accepted contract records the boundary it was proven against"
        status: pass
      - kind: other
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#the command-line tool applies the contract file and still reports the sibling"
        status: pass
    human_judgment: false
  - id: D2
    description: "Upstream existence without a local transfer, and an unread sibling, both still fail"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#the unread sibling of a contracted member still fails"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a return no external declaration ever sees is not a boundary"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin that never reaches the named boundary is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an unread input sibling is not covered by its neighbour's contract"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#the ordinary sibling of a branded member is not covered"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stale, contradictory, duplicate, wildcard, unknown-key, wrong-version and redundant entries all fail"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a contract naming no declaration in this program is stale"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a contract whose owner and key contradict the declaration fails"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#two contracts for one declaration fail as a duplicate"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a wildcard target fails instead of covering a family of members"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an unknown schema key fails"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a brand entry carrying another category's key is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a contract file written against another schema version fails"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a contract rendered redundant by a genuine read fails"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an input contract a genuine read has made redundant is refused"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real nominal brands keep their type-system role and superficial lookalikes do not"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an ambient unique-symbol brand keeps its type-system role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an object brand scoped by a module-private symbol keeps its role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an ordinary property that merely looks branded is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a brand whose key symbol any module can spell is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a symbol-keyed member carrying a real value type is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a brand whose recorded symbol site has drifted is refused"
        status: pass
    human_judgment: false
  - id: D5
    description: "A genuine selection literal keeps its role while filter-shaped syntax that narrows nothing does not"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a genuine selection literal keeps its type-system role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a discriminant the selection reads at run time is not covered by it"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a filter over a union that does not discriminate on the key is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a resolved filter that keeps the whole union refines nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a member outside the named filter is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a filter site that names no selection is refused"
        status: pass
    human_judgment: false
  - id: D6
    description: "An unused external input mirror needs proven local necessity, and upstream presence alone is not it"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an input mirror the installed signature compels is accepted"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an upstream slot the host declares as optional compels no mirror"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an upstream site that no longer declares the member is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a handler reached only through an assertion proves no external expectation"
        status: pass
    human_judgment: false
  - id: D7
    description: "The contract engine is wired into the live gate and changes nothing until a live entry exists"
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json"
        status: pass
    human_judgment: true
    rationale: "The repository contract file ships with no entries by design, so this run proves only that the engine is reachable, reports its provenance and excuses nobody. Which live rows deserve a contract is 06-06's reconciliation, not a verdict this plan can reach."

duration: 2h 0m
completed: 2026-09-15
status: complete
---

# Phase 6 Plan 03: Validated External and Type-System Contracts Summary

**A contract engine where an exemption has to be earned: one exact declaration settled through the compiler's own declaration map, four evidence categories each proved against symbols and directed transfers, and a refusal that stops the run rather than quietly widening it.**

## Performance

- **Duration:** 2h 0m
- **Started:** 2026-09-15T11:50:00Z
- **Completed:** 2026-09-15T13:51:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `scripts/check-unused-type-members.contracts.mjs` is supplied to `analyzeProject` through 06-01's `contractEvaluator` seam by the real command-line tool, so it is a production caller dependency from the moment it exists. The file is resolved at `scripts/check-unused-type-members.contracts.json` under the analysed root; an absent file yields no validator, which excuses nobody.
- Four categories, each with its own evidence: `external-output` (origin plus boundary), `external-input` (upstream plus necessity), `nominal-brand` (key symbol), `type-selection` (filter). Schema keys are scoped per category, so an allowance borrowed from another category reads as an unknown key.
- **External output** is accepted only when the named origin actually builds that member -- resolved through the object literal's contextual type, then through `resolveCandidates` to the declaration the inventory holds -- and the value arrives at a return whose enclosing function the compiler checked against an installed declaration. Arrival is proved directly by containment or indirectly by walking 06-02's directed transfers backwards from the returned identifier, bounded to eight hops.
- **External input** needs the installed declaration to insist: the named upstream site must be a required property in a declaration file outside the analysed roots, and the named necessity site must be a callback the compiler checks against an external signature that requires that key and whose own parameter carries the contracted declaration. An optional upstream slot and an asserted cast are both refused.
- **Nominal brand** needs a key spelled by a `unique symbol` whose declaration sits exactly where the contract says and is not exported, carrying a type from `never` or the unit types. An ordinary property named `__brand`, an exported key symbol, a symbol-keyed slot typed `string`, and a drifted symbol site each fail on their own message.
- **Type selection** covers the filter literal's own member. The member has to sit in the filter position of the named two-argument selection, the source has to be a union that discriminates on that key with pairwise distinct unit types, and a selection the checker already resolved has to come back with fewer constituents than it started with.
- Integrity refusals are all first-class: a stale target, an owner and key that contradict the resolved declaration, a duplicate id, a wildcard path, an unknown key, another schema version, and an entry a genuine read has already made redundant.
- Every refusal is an `AnalysisSetupError`, so the command-line tool exits 2. An unread sibling of a contracted member is untouched and still exits 1. Both directions are stated by controls.
- The live run reports `contracts: 0 validated from scripts/check-unused-type-members.contracts.json` in its diagnostics and leaves the population exactly where 06-02 left it: 2,891 runtime-observed, 105 test-only, 0 explicit-contract, 392 unread, 76 unsupported.

## Task Commits

1. **Task 1 (tracer): validate one exact external-output contract against a real transfer**
   - `ef66151e` (test) -- fourteen controls plus a deliberate stand-in that excuses and validates nothing, wired into the command-line tool
   - `8eb0c376` (feat) -- loader, schema and integrity validation, declaration identity, redundancy, external-output proof, empty repository contract file
2. **Task 2: preserve precise brands and type filters while requiring input purpose**
   - `df3caab8` (test) -- twenty controls for the brand, selection and external-input categories
   - `fc1b769f` (feat) -- the three categories, their drift controls, and the shared external-signature helper

## Files Created/Modified

- `scripts/check-unused-type-members.contracts.mjs` -- the contract engine. Reads and shape-checks the document when the validator is built; proves each entry against the compiled program when it runs.
- `scripts/check-unused-type-members.contracts.json` -- the repository contract file. Ships with no entries; live ones are added by 06-06 after the tree is reconciled.
- `tests/scripts/check-unused-type-members.contracts.test.ts` -- thirty-four controls driving the engine through the composed analysis, plus one that drives the real command-line tool as a child process.
- `scripts/check-unused-type-members.mjs` -- resolves the contract file under the analysed root and supplies the validator; help text states that the file is the only source of accepted exceptions and that an invalid entry is a setup failure.
- `scripts/check-unused-type-members.analysis.mjs` -- the contract-evaluator context now carries `byDeclaration` alongside `candidates`.

## Verification Results

Every command below was run in the foreground and its exit status captured directly.

| Command | Result |
| --- | --- |
| `node --test tests/scripts/check-unused-type-members.contracts.test.ts` | 34 tests, 34 pass, 0 fail |
| `node --test` over all four gate suites | 101 tests, 101 pass, 0 fail |
| `npm run check` | exit 0 |
| `npm test` | 6,366 tests, 6,366 pass, 0 fail -- baseline 6,332 plus the 34 added here |
| `npm run test:integration` (inside check) | 32 tests, 32 pass, 0 fail -- unchanged |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run fallow` | exit 0 across all four links |
| `SKIP=trufflehog pre-commit run --files ...` | exit 0 before each of the four commits |
| `node scripts/check-unused-type-members.mjs --json` | exit 1, 392 unread and 76 unsupported, 0 explicit-contract, contract provenance in diagnostics |

The aggregate production unit coverage gate, the direct-pair gates and the corresponding-test gates all run inside `npm run check`, which exited 0. No coverage threshold, exclusion, pin value or assertion contract was changed. No production `.ts` file was touched by this plan.

### RED evidence

Each task's failing phase was run against the analyzer as it stood, and every failure was an assertion on the planned behaviour rather than a crash.

| Task | RED result | What failed |
| --- | --- | --- |
| 1 | 14 tests, 0 pass, 14 fail | Against a stand-in that returns no decisions and validates nothing: both acceptance cases, the boundary-provenance reason, the sibling-findings list, and all ten refusals. The stand-in is exactly the mutant a contract file could otherwise hide behind -- a validator that reads the document and agrees with it. |
| 2 | 34 tests, 14 pass, 20 fail | Against the engine that knows only `external-output`. The fourteen passes are Task 1's controls, unchanged. The twenty failures are the three new categories: four acceptances, and sixteen refusals that each name a distinct message no other check produces. |

A validator that excuses nothing fails every acceptance case, and a validator that excuses everything fails every refusal case. The suite discriminates in both directions.

### Assertion and coverage ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-03-T1 | A fixture output member transferred to a resolved external callback return is accepted at `Emitted.payload`, directly and through a recorded `initializer` transfer; its sibling `Emitted.unsent` stays a finding; a return with no external contextual signature and an origin that never arrives are both refused. Ten integrity refusals each assert their exact message. | `node --test tests/scripts/check-unused-type-members.contracts.test.ts`: 14 pass. Covers the accepted path, the transfer-backed path, both boundary refusals, all seven integrity refusals, and the command-line path end to end. No existing assertion was weakened; the 67 controls from 06-01 and 06-02 still pass unchanged. |
| 06-03-T2 | An ambient `unique symbol` brand and a module-private object brand keep their role; an ordinary `__brand`, an exported key symbol, a `string`-typed symbol slot and a drifted symbol site are refused. A genuine deferred `Extract` selection keeps its role while a non-discriminating union, a fully-selecting resolved filter, a member outside the filter and a non-selection site are refused. An input mirror the installed signature compels is accepted; an optional upstream slot, a drifted upstream site, an asserted handler and a read-redundant entry are refused. | `node --test tests/scripts/check-unused-type-members.contracts.test.ts`: 34 pass. Adds the three category provers, the declaration-map identity check, the deferred and resolved selection branches, and the external-signature helper shared with the output boundary. Aggregate unit coverage and direct pins unchanged, verified by `npm run check` exit 0. |

## Decisions Made

- **An invalid contract is a setup failure, not a finding.** The research's fail-closed list names invalid contracts alongside a malformed tsconfig, and that is where they belong: a contract whose evidence no longer holds means the gate cannot say anything trustworthy, which is a different outcome from having found an unread member. Exit 2 keeps the two apart, and makes "the stale contract was quietly ignored" unrepresentable.
- **Identity is the declaration map, not the coordinate.** A contract's `path:line:column` only locates syntax. The node found there has to be the node `byDeclaration` recorded for that candidate, and the entry's `owner` and `key` have to match what the inventory says. A coordinate that drifts onto neighbouring syntax is refused rather than proved against the wrong member.
- **A type-selection contract covers the filter literal, not the discriminants.** Measuring the fixture inventory settled this: `Extract<Message, { status: K }>` contributes its own `status` member, owned by the enclosing declaration, which no run-time syntax can ever read. The variants' `status` members are ordinary discriminants that real code switches on, and they stay ordinary -- a control asserts they remain unread under the selection contract.
- **A brand is proven by unspeakability plus an impossible type.** The key symbol must not be exported, so no other module can spell it, and the member's type must be `never` or a unit type, so no ordinary value satisfies it. Either half alone is weak; together they are what makes the marker a compile-time proof rather than a field.
- **An optional upstream slot compels nothing.** This is the exact distinction the research draws for the resource-discovery input: upstream declaring a matching slot is not evidence that the local mirror is necessary. Requiring the upstream property to be non-optional, and requiring a callback the compiler really checks, is what turns "the host has this too" into "the host insists on this".
- **No `--contracts` option.** The file is resolved under the analysed root, so a fixture brings its own and the repository run finds the repository's. That avoided a new command-line surface with exactly one consumer, and it means an absent file produces no validator -- which can only ever narrow what the gate accepts.
- **The transfer walk is followed backwards, not re-derived.** External-output arrival uses 06-02's `transfers` records directly: a returned identifier's declaration name is looked up as a transfer destination, and the recorded source expression is checked for containment of the origin. The contract engine adds no flow analysis of its own.

## Deviations from Plan

### Forced by 06-02 having already landed

**1. [Rule 3 - Blocking] The `transfers` seam is real, not the empty placeholder the plan predicted**

- **Found during:** Task 1
- **Issue:** This plan was written for wave 2 alongside 06-02 and assumed only 06-01's shapes. Worktree isolation degraded, 06-02 ran first, and by the time this plan started `analysis.mjs` was already handing the evaluator a populated `transfers` graph of `{ kind, from, to }` site records, plus a `work` block on the report. The plan's action says to use "directed evidence supplied by the analyzer" without naming a shape.
- **Fix:** Built the external-output arrival proof on the real records rather than inventing a parallel notion of transfer. The engine indexes `transfers` by destination site and walks backwards from the returned expression; the `initializer` edge 06-02 records for every initialised variable is what carries the transfer-backed acceptance control. `resolveCandidates` is imported from `.model.mjs` rather than re-deriving member identity, which keeps 06-02's "one definition" decision intact.
- **Files modified:** `scripts/check-unused-type-members.contracts.mjs`
- **Committed in:** `8eb0c376`

**2. [Rule 3 - Blocking] The evaluator context had no declaration map**

- **Found during:** Task 1
- **Issue:** The contract engine has to settle a coordinate against the declaration the inventory recorded, and has to resolve a contextual-type property back to a candidate. Both need `byDeclaration`, which `collectCandidates` produces but `analyzeProject` was not passing to the evaluator. The alternatives were re-deriving member keys inside the contract module -- duplicating `memberKeyOf` and breaking the single-definition rule -- or identifying members by coordinate string, which is the failure mode this plan exists to prevent.
- **Fix:** Added `byDeclaration` to the contract-evaluator context and documented it in `.analysis.mjs`'s written-down analysis contract. `analysis.mjs` is not in this plan's declared `files_modified`; the change is three lines and adds a field, so no existing consumer is affected.
- **Files modified:** `scripts/check-unused-type-members.analysis.mjs`
- **Committed in:** `8eb0c376`

### Auto-fixed and scope-driven adjustments

**3. [Rule 3 - Blocking] A new script is dead code until a caller imports it**

- **Found during:** Task 1, RED phase
- **Issue:** `fallow dead-code` reported `check-unused-type-members.contracts.mjs` as an unreachable file, so the RED commit could not pass `pre-commit`.
- **Fix:** Wired the command-line tool to the stand-in in the RED commit rather than deferring the wiring to GREEN. This matches the plan's own instruction to make the module a production caller dependency immediately, and it means the RED phase measured the mutant through the same path the shipped engine uses.
- **Files modified:** `scripts/check-unused-type-members.mjs`
- **Committed in:** `ef66151e`

**4. The external-output origin and the external-input necessity each support one shape**

- **Found during:** Tasks 1 and 2
- **Issue:** An origin could in principle be a property assignment, a whole-object assignment, or a spread; a necessity could be a callback, a directly-annotated value, or an argument.
- **Fix:** Implemented the shape the researched cases actually use -- an object-literal property assignment for the origin, a callback checked against an installed signature for the necessity -- and refused everything else with a precise message. An unsupported shape is refused, never silently accepted, so the safe direction is preserved and 06-06 will surface any live case that needs a second shape rather than passing it through.
- **Files modified:** `scripts/check-unused-type-members.contracts.mjs`
- **Committed in:** `8eb0c376`, `fc1b769f`

### Documented scope and convention choices

**5. Commit messages carry no plan scope.** The GSD task-commit protocol asks for `{type}({phase}-{plan}):`. The project's `CLAUDE.md` forbids milestone and phase identifiers in commit messages and takes precedence, so commits are plain Conventional Commits, exactly as in 06-01 and 06-02. The four commits are listed above by hash.

**6. Four commits for two tasks.** Each task was executed RED then GREEN, and each RED phase was run and its failures recorded before the matching GREEN was written.

**7. Task 1's RED ships a stand-in rather than a missing module.** With no module present the test file's own import would fail and every case would error for the wrong reason. The stand-in returns no decisions and validates nothing, which is precisely the mutant a contract engine could otherwise hide behind.

**8. `pre-commit` was run with `SKIP=trufflehog`.** This checkout is a linked worktree, and trufflehog cannot read a worktree's git index (`failed to read index file: .git/index: not a directory`); it fails on every file set here, including unmodified ones. Every other hook was run and passed before each commit. No hook was bypassed with `--no-verify`.

**9. The repository contract file ships empty.** The plan requires it, and the live counts confirm it: the run reports `explicitContract: 0` and the same 392 unread and 76 unsupported rows 06-02 recorded. Nothing has been excused yet.

**10. The tracer feedback gate was cleared by re-running the tracer's verification.** The task carries no `gate` attribute, `workflow.human_verify_mode` is `end-of-phase`, and the tracer's `<verify>` is automated only, so the gate resolves to a re-run. It passed, and Task 2 followed.

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 scope) and 6 documented scope or convention choices.
**Impact on plan:** No gate was weakened. No census pin, threshold override, suppression, coverage exclusion or assertion relaxation was added. Both tasks ran in order with their declared verification. The only structural change beyond the plan's declared files is the three-line `byDeclaration` addition to the evaluator context.

## Known Stubs

None. The repository contract file is empty by the plan's explicit instruction, not as a placeholder: the loader reads it, validates it, reports it in the diagnostics, and would refuse a bad entry today. Live entries are 06-06's, after the tree is reconciled.

## Observed Limits

These are refusals, not silent acceptances. Each one produces a named message and exits 2.

- **Origin shape.** An external-output origin must be an object-literal property assignment or shorthand. A member written through an assignment statement or produced by a spread cannot be contracted yet.
- **Necessity shape.** An external-input necessity must be a callback the compiler checks against an installed signature. A value built to satisfy an external input shape directly is not yet a supported necessity.
- **Selection form.** A type selection must be a two-argument type reference whose second argument is the filter literal. A hand-written conditional type is not yet recognised.
- **Arrival depth.** Following a value backwards through named places is bounded at eight hops. A longer chain under-credits, which refuses a contract rather than accepting an unproven one.
- **What "external" means.** A declaration file outside `extensions/pi-claude-marketplace/` and `tests/`. That includes the standard library as well as installed packages; the `purpose` field and human review of the contract file are what keep intent in scope.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at a trust boundary. The one new input surface is the contract document, and it is contained: it is parsed as JSON and never executed, every site path must be project-relative with no wildcard and no traversal segment, every entry must name a declaration the inventory already holds, and an unknown key or category is refused rather than ignored. T-06-03-01 is mitigated by the declaration-map identity check and the sibling and drift controls; T-06-03-02 by parsing without importing and by the containment checks; T-06-03-03 by the eight-hop bound and by refusing rather than answering partially; T-06-03-04 by the deterministic per-member report and the exact process results recorded above.

## Issues Encountered

- **The live tree is unchanged at 392 unread and 76 unsupported.** That is the intended state: the contract file is empty, so the engine excuses nobody. The 76 `unmodeled-container-operation` rows belong to 06-04 and were deliberately left alone rather than absorbed into contracts.
- **The plan's wave-2 parallelism did not happen.** 06-02 landed first on this branch. Nothing was lost -- the seam 06-01 fixed held, and the real `transfers` graph turned out to be more useful than the empty placeholder the plan assumed -- but the "disjoint same-wave ownership" rationale no longer applies, and `analysis.mjs` was touched by both plans in sequence rather than by neither.
- **`trufflehog` cannot run in this worktree.** It is an environment limit, not a branch regression: the hook fails on any file set here. Recorded above so a later run does not read the skip as a bypass.

## User Setup Required

None -- no external service configuration is required.

## Next Phase Readiness

- **Ready for 06-04.** The contract engine is composed into the pipeline through the seam 06-01 fixed, and 06-04 adds whole-operation evidence to the same pipeline. Nothing in this plan's shapes changes when `unsupported` gaps shrink.
- **Ready for 06-06.** Every category a live row could need is implemented and controlled, and each refusal names exactly what is missing, so the reconciliation can act on the message rather than guess. If a live case needs an origin, necessity or selection shape outside the supported set, it will be refused with a named message rather than passing silently.
- **`requirements-completed` is deliberately empty.** MEMBER-01 and MEMBER-02 are declared by all eight plans in this phase, so neither may read `Complete` until the last declaring plan finishes.
- **No blocker.** `npm run check` is green and the gate is still absent from it, so nothing downstream is gated on the live population being clean.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-15*

## Self-Check: PASSED

All three created files and the two modified files exist on disk, and all four
task commits are present in `git log`. Every `<verify>` command in the plan was
run in the foreground and its exit status captured; none was skipped. The
measured commit count from the plan ledger is 4, matching the four commits
listed above.

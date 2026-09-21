---
phase: 06-unused-type-member-gate
plan: "01"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, gate, node-test]

requires:
  - phase: 05-production-export-ownership
    provides: Zero-census production dead-code gate and the four-link fallow chain the new scripts must stay inside
provides:
  - A runnable `scripts/check-unused-type-members.mjs` gate with a three-way exit contract (0 clean, 1 member findings, 2 setup or internal analysis failure)
  - Compiler identity, declaration inventory and AST read/write/presence classification in `scripts/check-unused-type-members.model.mjs`
  - Deterministic versioned report assembly plus the injected `contractEvaluator` seam in `scripts/check-unused-type-members.analysis.mjs`
  - A contained CompilerHost overlay so controls can analyse replacement text without editing the tree
  - Thirty-three executable controls stating both directions of every classification
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07, 06-08]

actuals:
  tokens: 17565
  tasks: 3
  commits: 7
plan_head_before: 57d927cbb17cc5b46e31424477cf41c37549e8b7

tech-stack:
  added: []
  patterns:
    - "Gate script triplet: `.mjs` entry point inert on import, `.analysis.mjs` composition, `.model.mjs` compiler identity"
    - "Test-facing interface for a `.mjs` module loaded through a runtime specifier, since the compiler cannot check that import"
    - "Explicit worklist with an explicit node budget; exhaustion refuses to answer rather than answering partially"

key-files:
  created:
    - scripts/check-unused-type-members.mjs
    - scripts/check-unused-type-members.analysis.mjs
    - scripts/check-unused-type-members.model.mjs
    - tests/scripts/check-unused-type-members.test.ts
    - tests/scripts/check-unused-type-members.model.test.ts
  modified:
    - package.json

key-decisions:
  - "Members are matched through checker symbols and declaration nodes, never property spelling, so a same-named member on an unrelated type is a different candidate"
  - "Syntax context decides whether an access reads, before any symbol is consulted"
  - "An analysis gap is attributed only to the candidates the opaque expression could reach, and an independent witness still settles a candidate"
  - "Budget exhaustion is an exit-2 analysis failure that names the file it stopped on; a cut-off walk can never read as clean"
  - "Model exports are limited to what `.analysis.mjs` actually composes, so the zero-census dead-code gate stays the arbiter of the public surface"
  - "`--overlay` is a compiler read override restricted to existing project TypeScript files; it can neither introduce sources nor reach outside the root"

patterns-established:
  - "Every classifier control states both directions: the construct that must produce a witness and the neighbouring construct that must not"
  - "Each task's RED phase runs against a deliberate always-clean or unexpanded analyzer, so the suite is measured against the mutant it exists to catch"

requirements-completed: []

coverage:
  - id: D1
    description: "The gate rejects an unread optional member by its exact declaration identity and accepts it once a real read exists"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#reports an unread optional member by its exact declaration identity"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#accepts the same declaration once a real read exists"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#a same-spelling member on an unrelated type earns no witness"
        status: pass
    human_judgment: false
  - id: D2
    description: "Production and test observations are reported separately and declaration-only syntax supplies no read"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#a member read only by a test is reported as test-only and does not fail the run"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#removing the only test read leaves the same member unread"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#an independent production read is reported as runtime-observed"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#indexed-access types, keyof and type queries read nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#a test source contributes observations and never candidates"
        status: pass
    human_judgment: false
  - id: D3
    description: "Setup failures and unsupported candidate operations cannot return a clean verdict"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#a missing tsconfig is a setup failure, not a member finding"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#an exhausted analysis budget fails instead of reporting a clean tree"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#an unbounded computed key is an analysis gap for its own type only"
        status: pass
    human_judgment: false
  - id: D4
    description: "Complete read, write, destructuring, element-access and presence classification with exact positive and negative outcomes"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#binding destructuring reads the source member through renames, defaults and nesting"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#a simple write and a delete are not reads"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#compound assignment and update expressions keep the read of the old value"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#writing a nested member still reads the receiver that holds it"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#literal and finite-union element access read the exact members they can reach"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.model.test.ts#an exact existence test is a presence observation, not a value read"
        status: pass
    human_judgment: false
  - id: D5
    description: "Analysed source is parsed and never executed, and the report order is deterministic"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#analysed source is parsed and never executed"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#importing the command-line module does not run the gate"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#members are reported in a deterministic order across files"
        status: pass
    human_judgment: false
  - id: D6
    description: "The gate runs against the live repository and produces a member-level population, pending the reconciliation owned by 06-06"
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json"
        status: pass
    human_judgment: true
    rationale: "The live counts are an interim measurement under a model that has no directed transfers, contracts or whole-object operations yet. Whether each row is a defect, a contract or an analyzer gap is 06-06's reconciliation, not a verdict this plan can reach."

duration: 3h 20m
completed: 2026-09-15
status: complete
---

# Phase 6 Plan 01: Compiler Inventory and Runtime Observation Classifier Summary

**A runnable TypeScript member-usage gate that resolves members by checker symbol rather than spelling, classifies reads by syntax context before consulting any symbol, and separates a clean tree from a tree it could not analyse.**

## Performance

- **Duration:** 3h 20m
- **Started:** 2026-09-15T05:55:00Z
- **Completed:** 2026-09-15T09:15:00Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- `node scripts/check-unused-type-members.mjs` runs end to end against this repository: 236 production files, 3,464 member declarations, 2,739 runtime-observed, 111 test-only-observed, 614 unread, 0 unsupported, in 27 seconds.
- Member identity comes from `getSymbolAtLocation` plus `getMergedSymbol` and `getRootSymbols`, mapped back to the declaration nodes the inventory holds. Two interfaces that both declare `shared` are two candidates, and a read of one credits only one.
- Syntax classifies the access before the symbol does. A simple assignment and a `delete` read nothing; compound and update expressions keep the read of the old value; writing `outer.inner.value` still reads `outer.inner`; binding and assignment destructuring read the source member through renames, defaults and nesting.
- Element access resolves a literal key or a finite union of literal string keys against the receiver type. A key the analysis cannot bound records `unbounded-computed-access` against that receiver's members only, so one dynamic expression cannot condemn the tree.
- An `in` test is recorded as a `presence` observation kept distinct from a `value-read`; key enumeration alone records nothing.
- The three failing outcomes are distinguishable: `unread` and `unsupported-analysis` exit 1; a missing or invalid tsconfig, an unresolved compiler input, a syntax error, an empty production inventory, an out-of-project overlay entry, a bad option and an exhausted budget all exit 2 with no report on stdout.
- The walk is an explicit worklist with an explicit node budget, children pushed in reverse so they pop in source order. The default of 20,000,000 nodes is measured: this repository's walk visits 969,975.

## Task Commits

1. **Task 1 (tracer): trace one optional member from compiler input to CLI verdict**
   - `3b5b57c3` (test) — controls plus a deliberate always-clean analysis stand-in
   - `50e83e85` (feat) — compiler setup, inventory, dot-read observation, report and exit contract
2. **Task 2: inventory exact symbols and classify complete read/write syntax**
   - `7869ef9d` (refactor) — split compiler identity and observation into `.model.mjs`
   - `846fe838` (test) — failing classifier controls
   - `628c0b97` (feat) — expanded inventory and full syntax classification
3. **Task 3: make reports deterministic, bounded and fail-closed**
   - `b93c47a9` (test) — provenance, execution-safety and failing-budget controls
   - `df4b2978` (feat) — budgeted worklist, symbol cache, written-down analysis contract, honest-scope help text

## Files Created/Modified

- `scripts/check-unused-type-members.mjs` — command-line entry point; option parsing, human and JSON output, exit status, help text stating the bounded claim. Inert on import.
- `scripts/check-unused-type-members.analysis.mjs` — composes the model into one deterministic versioned report, owns the status decision and the injected `contractEvaluator` seam.
- `scripts/check-unused-type-members.model.mjs` — compiler setup and overlay host, declaration inventory, symbol resolution and cache, AST read/write/presence classification, budgeted worklist.
- `tests/scripts/check-unused-type-members.test.ts` — 17 command-line controls driving the gate as a child process with an argv array.
- `tests/scripts/check-unused-type-members.model.test.ts` — 16 classifier and inventory controls against the model directly.
- `package.json` — added the `lint:type-members` alias. Deliberately **not** added to `npm run check`; that activation is 06-08's after live closure.

## Verification Results

Every command below was run in the foreground and its exit status captured directly.

| Command | Result |
| --- | --- |
| `node --test tests/scripts/check-unused-type-members.test.ts` | 17 tests, 17 pass, 0 fail |
| `node --test tests/scripts/check-unused-type-members.model.test.ts` | 16 tests, 16 pass, 0 fail |
| `npm run check` | exit 0 |
| `npm test` (inside check) | 6,298 tests, 6,298 pass, 0 fail — baseline 6,265 plus the 33 added here |
| `npm run test:integration` (inside check) | 32 tests, 32 pass, 0 fail — unchanged from baseline |
| `npm run test:coverage:unit` | exit 0; production aggregate 62,901/62,901 lines, 1,834/1,834 functions, 9,050/9,050 branches, **0 modules below 100%** |
| `npm run fallow` | exit 0 across all four links |
| `node scripts/check-unused-type-members.mjs --json` | exit 1, 614 findings, 27s wall |

The production aggregate line total reads 62,901 against the 62,889 recorded at Phase 5 close. `git diff 57d927cb..HEAD -- extensions/` is empty — no production source changed in this plan — so the twelve-line difference is drift in Node's lcov line accounting between runs, not a coverage change. Function and branch totals match the recorded figures exactly, and no module is below 100% on any dimension.

### RED evidence

Each task's failing phase was run against an analyzer that could not yet satisfy it, and the failures were assertions on the planned behaviour rather than crashes.

| Task | RED result | What failed |
| --- | --- | --- |
| 1 | 9 tests, 3 pass, 6 fail | Against a deliberate always-clean analysis module: the offender, the witness record, the overlay and all three setup-failure cases. The three passes are behaviour the stand-in genuinely had, which is why they were stated. |
| 2 | 15 tests, 6 pass, 9 fail | 8 assertion failures plus one explicit "no candidate was inventoried" guard. Destructuring, write and delete exclusion, compound and update reads, element access, computed-key gaps, presence tests and the expanded inventory. |
| 3 | 33 tests, 28 pass, 5 fail | Budget exhaustion at the model and command-line level, budget validation, and the help-text scope statement. |

An always-clean analyzer fails six of Task 1's nine cases, so the suite discriminates the mutant this phase exists to catch.

## Decisions Made

- **Identity through declarations, not strings.** The inventory keys a `Map` on the declaration node, and observations resolve a symbol to its merged and root symbols, then to declarations, then into that map. No property name is ever compared. This is what makes `Kept.shared` and `Other.shared` distinct without any extra rule.
- **Syntax first, symbol second.** `readSyntaxOf` decides whether an access reads before any symbol lookup. The same spelling is a read in one position and a destination in another, so a reference flag cannot answer this — the measured language-service counterexamples in 06-RESEARCH.md are exactly this failure.
- **Gaps are attributed, never global.** `receiverCandidates` narrows an unbounded computed access to the members of that receiver's own type. A dynamic expression over a type with no candidates records nothing at all.
- **Budget exhaustion is exit 2, not exit 1.** Naming it an analysis failure rather than a member finding keeps "we could not analyse this" distinct from "this member is unread", which is the same separation the setup failures already make. It also makes "the cutoff is clean" unrepresentable.
- **Model exports are limited to real composition.** The zero-census dead-code gate flags an export whose only consumers live in the same module, so `createProjectProgram`, `collectCandidates`, `collectObservations` and `productionFileCount` are exported precisely because `.analysis.mjs` composes them, and the model test reaches the same surface a consumer does.
- **An identifier is not a key.** The first implementation treated an identifier argument in an element access as a literal key, which made `keyed[key]` resolve to a member named `key`. Literal keys now come from a literal-only helper; identifiers go through the type.

## Deviations from Plan

### Auto-fixed and scope-driven adjustments

**1. [Rule 3 - Blocking] The convention file the plan names does not exist**

- **Found during:** Task 1
- **Issue:** The plan says to "follow the existing `tests/scripts/check-phase-06-hub-ledger.test.ts` convention for a documented `.mjs` import typing boundary". Neither that file nor the `tests/scripts/` directory existed; no test in the repository imports a `scripts/*.mjs` module.
- **Fix:** Established the convention instead. The command-line controls drive the gate as a child process and need no import at all. The model controls load the module through a runtime specifier and read it through an explicit test-facing interface written out in the test, with a comment saying why: the compiler cannot check a `.mjs` import, so the shape the cases rely on is stated rather than assumed. `tests/scripts` is already in the unit-test glob and already listed in `check-corresponding-tests.mjs`'s `nonCorrespondingRoots`, so no gate configuration changed.
- **Files modified:** `tests/scripts/check-unused-type-members.test.ts`, `tests/scripts/check-unused-type-members.model.test.ts`
- **Committed in:** `3b5b57c3`, `846fe838`

**2. [Rule 3 - Blocking] A new script is dead code until package.json names it**

- **Found during:** Task 1
- **Issue:** `fallow dead-code` reported both new scripts as unreachable files. The gate scripts are reachable only because `package.json` script entries are fallow entry points.
- **Fix:** Added the `lint:type-members` alias in the same commit as the scripts. The plan already required this alias in Task 1; it turned out to be load-bearing rather than cosmetic. It is deliberately not added to `npm run check` — that is 06-08's.
- **Files modified:** `package.json`
- **Committed in:** `3b5b57c3`

**3. [Rule 3 - Blocking] Exports with only in-module consumers fail the zero-census gate**

- **Found during:** Tasks 1 and 2
- **Issue:** `SCHEMA_VERSION`, `parseOptions`, and later `createProjectProgram`, `collectCandidates` and `collectObservations` were exported but consumed only inside their own module, which the production dead-code census reports.
- **Fix:** Un-exported the three that stayed module-local. The other three became genuine cross-module exports when the model split landed in Task 2, which is when `.analysis.mjs` started importing them. No census pin was added and no suppression was used.
- **Files modified:** `scripts/check-unused-type-members.mjs`, `scripts/check-unused-type-members.analysis.mjs`, `scripts/check-unused-type-members.model.mjs`
- **Committed in:** `3b5b57c3`, `50e83e85`, `7869ef9d`

**4. [Rule 3 - Blocking] `fallow health` rejected the first option parser**

- **Found during:** Task 1
- **Issue:** `parseOptions` exceeded the cognitive-complexity ceiling. `fallow health` runs whole-repo, so `scripts/**/*.mjs` is inside `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`.
- **Fix:** Split the parser into a switch handler, a value reader and a small dispatch. No `health.thresholdOverrides` entry was added; there are still zero.
- **Files modified:** `scripts/check-unused-type-members.mjs`
- **Committed in:** `3b5b57c3`

**5. [Rule 1 - Bug] An identifier was read as an element-access key**

- **Found during:** Task 2
- **Issue:** The key extractor accepted an identifier, so `keyed[key]` where `key: "first" | "second"` resolved to a member literally named `key`, found none, and credited nothing. The same defect silenced the unbounded-key gap.
- **Fix:** Added a literal-only helper for element-access keys, keeping the identifier-accepting helper for positions where an identifier genuinely is the name. Both controls now pass and both would fail if this regressed.
- **Files modified:** `scripts/check-unused-type-members.model.mjs`
- **Committed in:** `628c0b97`

**6. [Rule 1 - Bug] A mis-derived column in an authored expectation**

- **Found during:** Task 2
- **Issue:** The nested-binding witness column was authored as 61 and the run produced 62.
- **Fix:** Recounted the fixture line independently, in a separate process, against the literal source text. 62 is correct; the expectation was an arithmetic slip, corrected without weakening the assertion.
- **Files modified:** `tests/scripts/check-unused-type-members.model.test.ts`
- **Committed in:** `628c0b97`

### Documented scope and convention choices

**7. Commit messages carry no plan scope.** The GSD task-commit protocol asks for `{type}({phase}-{plan}):`. The project's `CLAUDE.md` forbids milestone and phase identifiers in commit messages and takes precedence, so commits are plain Conventional Commits. A TDD gate check that greps for `test(6-1):` will therefore find nothing; the RED and GREEN commits are listed above by hash.

**8. Seven commits for three tasks.** Each task was executed RED then GREEN, and Task 2's behaviour-preserving split into `.model.mjs` was committed separately from the classifier expansion so the move can be reviewed against a green command-line suite. Every RED commit was run and its failures recorded before the matching GREEN.

**9. The RED phases ship a working stand-in rather than a missing module.** With no module present, the command-line controls would fail on a module-not-found crash, and the offender case asserting a non-zero exit would have passed for the wrong reason. Task 1's RED instead ships an always-clean analysis module, which is the exact mutant the phase demands the suite catch.

**10. The command-line entry point was edited in Task 3.** Task 3's declared files are the analysis, model and both test modules, but its action requires the bounded claim to be documented "in CLI help" and the budget to be settable. Both live in `scripts/check-unused-type-members.mjs`.

**11. `keyKind` is model-only.** Candidates carry `keyKind` so 06-03 can validate a nominal brand, but the report record is built field by field and does not expose it. This kept the command-line schema that Task 1 pinned unchanged while the model grew.

**12. Own-property presence tests are left to 06-04.** The `in` operator is implemented and controlled. `Object.hasOwn` and `hasOwnProperty` need symbol-resolved built-in identification, which 06-VALIDATION.md's control matrix assigns to 06-04 ("Shallow operations ... own enumerable sources ... assign source roles"). Under-crediting a presence check produces a false finding, not a false accept, so the safe direction is preserved until 06-04 lands.

---

**Total deviations:** 6 auto-fixed (4 blocking, 2 bugs) and 6 documented scope or convention choices.
**Impact on plan:** No gate was weakened. No census pin, threshold override, suppression, coverage exclusion or assertion relaxation was added. Task ordering was unchanged; the only structural change is that Task 2's module split is its own commit.

## Known Stubs

None. No placeholder values, no unwired components and no committed `skip` or `todo`.

The `transfers` field in the contract-evaluator context is an empty array, which is the documented interim state of the analysis contract rather than a stub: directed value transfers are 06-02's deliverable and the field exists now so 06-02 and 06-03 can be built against a fixed seam without changing this flow.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at a trust boundary. The two surfaces it does add are contained by the controls above: the `--overlay` read override refuses any path that is not an existing TypeScript file inside the project root, and analysed source is parsed only — proven by a fixture whose top level writes a file and throws, after which the gate still returns a verdict and the file does not exist.

## Issues Encountered

- **The live tree reports 614 unread members under this slice.** This is expected interim state, not a defect list. The model has no directed value transfers, no validated contracts and no whole-object operation summaries yet, so a member supplied through an object literal and consumed after a transfer currently reads as unread. `EdgeDeps.importClaudeSettings` is exactly this shape: it read as test-only under Task 1's dot-read-only model and as unread once write sites stopped being miscounted as reads. 06-02 through 06-04 add the missing edges and 06-06 reconciles every remaining row. The gate is deliberately absent from `npm run check` until then.
- **The candidate count corroborates the research measurement.** 3,464 against the research prototype's 3,462 including its plant, measured independently by a different implementation on a tree that moved in between.
- **The full live run takes 27 seconds.** Most of it is the compiler program build and on-demand type resolution; the budgeted walk itself visits 969,975 nodes. 06-06 owns the justified whole-tree budget record.

## User Setup Required

None — no external service configuration is required.

## Next Phase Readiness

- **Ready for 06-02 and 06-03.** Both plans depend on this plan's shapes, and all of them are fixed and documented on `.analysis.mjs`: candidate records keyed by stable declaration identity, witnesses carrying their own site and production or test origin, attributed analysis gaps, and the `contractEvaluator` context carrying `program`, `checker`, `projectRoot`, `candidates`, `witnesses` and `transfers`. 06-02 fills `transfers`; 06-03 supplies the evaluator through the seam without changing this flow.
- **`requirements-completed` is deliberately empty.** MEMBER-01 and MEMBER-02 are declared by all eight plans in this phase, so neither may read `Complete` until the last declaring plan finishes.
- **No blocker.** `npm run check` is green and the gate is not yet in it, so nothing downstream is gated on the live population being clean.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-15*

## Self-Check: PASSED

All five created files and the SUMMARY exist on disk, and all seven task commits
are present in `git log`. Every `<verify>` command in the plan was run in the
foreground and its exit status captured; none was skipped.

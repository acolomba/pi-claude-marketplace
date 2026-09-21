---
phase: 06-unused-type-member-gate
plan: "11"
subsystem: testing
tags: [typescript, static-analysis, edge, contracts, dead-code, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable member gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The contract engine's five categories, including the `external-output` prover this plan exercises first
  - phase: 06-unused-type-member-gate
    provides: The closed triage, the validated contracts and the recorded dispositions
  - phase: 06-unused-type-member-gate
    provides: The seven executable negative controls the repairs must not disturb
  - phase: 06-unused-type-member-gate
    provides: The 90-row live baseline 06-10 left behind
provides:
  - "A completions seam whose declared minimal shape is minimal: the two slots no edge syntax reads are gone and the `edge/register.ts` structural hand-off still type-checks"
  - "`SingleNameMarketplaceRun` named as `GetMarketplaceInfoOptions`, the option bag its only implementation declares and reads, instead of a hand-kept inline mirror of it"
  - "`loadToolPluginPayload`'s parameter declaring only the two slots its body reads, with the filter buckets still carried by `ToolFilterBuckets`"
  - "A measured 90 -> 80 live population: 10 of the 17 edge rows cleared by source repair, zero findings gained"
  - "Six engine-refused `external-output` drafts recorded with the engine's exact message and two measured prover limits, and nothing written to the contract file"
  - "`ParsedCommandArgs.required` kept as an honest finding rather than cleared by rewriting a public generic to suit the analyzer"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `219319ca`, reconciling with 80 problems that are ALL `unread`, the seven surviving edge rows carrying this plan's verdict"
affects: [06-12, 06-13, 06-08]

actuals:
  tokens: 15657
  tasks: 3
  commits: 3
plan_head_before: 9e3520654a6d17aafef443ff02776d1da8a48595

tech-stack:
  added: []
  patterns:
    - "A delegate type names the option bag its implementation declares and reads, not a restatement of that bag's members"
    - "A parameter type declares the slots its body reads; a decision made one call up stays with the type that owns it"
    - "A contract draft is submitted to the real engine against the real program and kept only if accepted; a refusal is recorded with the engine's own message and the row stays a finding"

key-files:
  created:
    - .planning/phases/06-unused-type-member-gate/06-11-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/architecture/flag-catalog-drift.test.ts
    - tests/edge/completions/data.test.ts
    - tests/edge/completions/provider.test.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "The two completions-seam rows were deleted, not contracted: the triage filed them as delegate mirrors, which is factually wrong -- `marketplaceNamesCachePath` has no production reader anywhere and `manifestPath` is never read at the edge"
  - "The orchestrator-side twin in `orchestrators/edge-deps.ts` was left untouched and recorded as a hand-off to 06-12, because it is executable code with a paired test and a different owner"
  - "All six `external-output` drafts were refused by the engine and recorded as refusals; no prover was widened, no analyzer edited, no `execute` method converted to an arrow-function property to shorten the path"
  - "`ParsedCommandArgs.required` was left standing rather than restated as an `Extract`-based two-argument selection, per 06-CONTEXT: correct an incomplete analysis in preference to changing working product code to satisfy it"
  - "Contract-file drift was confirmed rather than assumed: zero of the 85 validated entries names any edge file or any test file this plan touched, so no coordinate needed re-anchoring"

patterns-established:
  - "An engine refusal is diagnosed to the exact prover predicate that failed, with a compiler probe, so the recorded limit is measured rather than inferred"
  - "A line-count movement in the coverage reading is reconciled against `git diff --numstat` before it is accepted"

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The two completions-seam slots no edge syntax reads are gone, and the `edge/register.ts` structural hand-off from `LocationsResolverLike` to `LocationsResolver` still type-checks"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: unit
        ref: "node --test tests/edge/completions/data.test.ts tests/edge/completions/provider.test.ts tests/architecture/flag-catalog-drift.test.ts -- 168/168"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json -- both rows removed, zero gained"
        status: pass
    human_judgment: false
  - id: D2
    description: "The eight delegate-mirror slots are gone: `SingleNameMarketplaceRun` names `GetMarketplaceInfoOptions` and `loadToolPluginPayload.params` declares only what it reads, with both paired suites unmodified"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint"
        status: pass
      - kind: unit
        ref: "node --test tests/edge/handlers/**/*.test.ts -- 396/396, no test file edited"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json -- all eight rows removed, zero gained"
        status: pass
    human_judgment: false
  - id: D3
    description: "Six `external-output` drafts and one `type-selection` draft were submitted to the real contract engine against this tree and every one was refused; the contract file is byte-identical to its pre-draft state"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json with each draft installed -- exit 2, seven recorded refusals"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts -- 48/48"
        status: pass
      - kind: other
        ref: "cmp against the pre-draft contract file -- byte-identical; gate diagnostics still report 85 validated"
        status: pass
    human_judgment: false
  - id: D4
    description: "The triage record is regenerated against the repaired tree, reconciles on a fresh digest with zero stale, missing, duplicate, incomplete or invalid rows, and the seven surviving edge rows carry this plan's verdict"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --inventory -- exit 0, digest 219319ca"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1, 80 problems, all `unread`"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole gate stays green and nothing was weakened: `npm run check` exit 0, negative controls 7/7, aggregate production unit coverage still 100 percent with no module below it"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "npm run check"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7"
        status: pass
      - kind: other
        ref: "npm run test:coverage:unit -- 227 modules, functions 1834/1834, branches 9050/9050, 0 below 100%"
        status: pass
    human_judgment: false

duration: 76 min
completed: 2026-09-16
---

# Phase 06 Plan 11: Edge Owner Group Summary

**Ten of the seventeen edge rows cleared by removing surface nothing reads and naming the declarations that are read; the other seven stay findings because the contract engine refused every draft written for them, and the refusals are recorded rather than accommodated.**

## Performance

- **Duration:** 76 min
- **Tasks:** 3 of 3
- **Files changed:** 7 (3 production, 3 test, 1 planning record)
- **Commits:** 3 task commits plus this metadata commit

## The measured split

The edge owner group started at 17 unread rows and ends at 7.

| Outcome | Count | Rows |
| --- | --- | --- |
| Repaired | 10 | 2 completions-seam slots, 5 `SingleNameMarketplaceRun.opts` slots, 3 `loadToolPluginPayload.params` slots |
| Contracted | 0 | none -- every draft was refused by the engine |
| Outstanding with a recorded reason | 7 | 4 `marketplaces` slots, 2 `PluginRow` slots, `ParsedCommandArgs.required` |

The plan projected 10 repaired, up to 6 contracted and at least 1 outstanding. The
repaired count landed exactly; the contracted count landed at the bottom of its
stated range, which the plan names as an acceptable and expected outcome, and each
refusal moved its row to outstanding with the engine's own message attached.

Live population, measured with `node scripts/check-unused-type-members.mjs --json`
and diffed by `(path, owner, key)` against a pre-edit baseline taken at revision
`9e352065`:

```
90 unread -> 88 (task 1) -> 80 (task 2) -> 80 (task 3, no source change)
removed 10   gained 0
```

Zero findings gained at every measurement point, matching the standard 06-09, 06-14
and 06-10 set.

## Per-row accounting

### Repaired (10)

| Declaration | Member | How it was cleared |
| --- | --- | --- |
| `edge/completions/data.ts:132:3` | `LocationsResolver.marketplaceNamesCachePath` | Removed. No calling syntax anywhere in the tree. |
| `edge/completions/data.ts:145:3` | `MarketplaceStateRecord.manifestPath` | Removed. The edge reads only `plugins` off this record. |
| `edge/handlers/marketplace/shared.ts:27:3` | `SingleNameMarketplaceRun.opts.ctx` | The delegate now names `GetMarketplaceInfoOptions`, whose `ctx` `getMarketplaceInfo` reads. |
| `edge/handlers/marketplace/shared.ts:28:3` | `SingleNameMarketplaceRun.opts.pi` | Same substitution. |
| `edge/handlers/marketplace/shared.ts:29:3` | `SingleNameMarketplaceRun.opts.name` | Same substitution. |
| `edge/handlers/marketplace/shared.ts:30:3` | `SingleNameMarketplaceRun.opts.cwd` | Same substitution. |
| `edge/handlers/marketplace/shared.ts:31:3` | `SingleNameMarketplaceRun.opts.scope` | Same substitution. |
| `edge/handlers/tools.ts:284:5` | `loadToolPluginPayload.params.installed` | Removed. The body reads `params.scope` and `params.marketplace` only; the filter decision belongs to `ToolFilterBuckets`. |
| `edge/handlers/tools.ts:285:5` | `loadToolPluginPayload.params.available` | Same. |
| `edge/handlers/tools.ts:286:5` | `loadToolPluginPayload.params.unavailable` | Same. |

### Outstanding with a recorded reason (7)

| Declaration | Member | Reason |
| --- | --- | --- |
| `edge/handlers/tools.ts:100:9` | `marketplaces.name` | `external-output` draft refused at the boundary half. |
| `edge/handlers/tools.ts:101:9` | `marketplaces.scope` | Same. |
| `edge/handlers/tools.ts:102:9` | `marketplaces.pluginCount` | Same. |
| `edge/handlers/tools.ts:103:9` | `marketplaces.source` | Same. |
| `edge/handlers/tools.ts:140:3` | `PluginRow.marketplace` | Same. |
| `edge/handlers/tools.ts:141:3` | `PluginRow.scope` | Same. |
| `edge/args-schema.ts:60:70` | `ParsedCommandArgs.required` | `type-selection` draft refused: a conditional-type `extends` clause is not a two-argument selection. |

## Accomplishments

### Task 1 -- the two completions-seam slots (commit `690d0478`)

The triage filed both rows under "delegate parameter shape -- the concrete
implementation reads it through its own declaration". That reading is wrong for
these two, and the plan departs from it on purpose. Both facts were re-established
against source before anything was deleted:

- `marketplaceNamesCachePath` has **no production reader anywhere**. The only calling
  syntax in the whole tree is `tests/orchestrators/edge-deps.test.ts:235:32` and
  `:256:32`, and those calls land on the orchestrator-side `LocationsResolverLike`,
  not on this declaration -- which is exactly why the gate already records the
  orchestrator member as `test-only-observed` rather than `runtime-observed`.
- `manifestPath` is never read at the edge. `edge/completions/data.ts` reads
  `loadStateForScope`, `loadManifestForMarketplace`, `pluginCachePath` and `plugins`.
  The `mp.manifestPath` reads in `orchestrators/edge-deps.ts` resolve against the
  persistence `ExtensionState` shape, and `MarketplaceStateRecordLike.manifestPath`
  is itself already an orchestrators-owned finding in the same baseline.

Both are type-only declarations, so nothing executable left the coverage graph. The
`MarketplaceStateRecord` comment claimed a minimal shape; after the edit that claim
is true, and the comment now says what the type declares.

Consumers were repaired rather than loosened. `tests/architecture/flag-catalog-drift.test.ts`
annotates its stub as `LocationsResolver`, so the dead member became an excess
property and its `loadStateForScope` stub -- which returned `{ manifestPath?: string }`
and would have shared no property with the narrowed target -- now imports and names
`MarketplaceStateRecord` itself instead of restating a shape. The two unannotated
stubs in `tests/edge/completions/` compile either way; their dead members were removed
anyway, because a stub member no interface asks for is the drift this gate exists
to catch.

The structural hand-off was verified deliberately: `edge/register.ts` passes
`makeLocationsResolver(process.cwd())`, typed `LocationsResolverLike`, into
`getArgumentCompletions`, which wants `LocationsResolver`. An implementation carrying
a member the consumer no longer declares stays assignable, and `npm run typecheck`
is the proof.

### Task 2 -- the two delegate mirrors (commit `0b00df9e`)

`SingleNameMarketplaceRun` restated `GetMarketplaceInfoOptions` inline, so the shim
only ever *wrote* those five slots at its `run({ ctx, pi, name, cwd, scope })` call
while every read landed on the orchestrator's own declaration. The type now names
`GetMarketplaceInfoOptions` and keeps its return unconstrained at `Promise<unknown>`.
Two facts were checked rather than assumed:

- `ExtensionCommandContext extends ExtensionContext` in
  `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:254`,
  so the shim's `ctx` satisfies the orchestrator's.
- A delegate whose own parameter adds an optional slot stays assignable under
  parameter contravariance, which keeps the paired suite's second (`remove`-shaped)
  delegate working. Both suites pass unmodified.

`loadToolPluginPayload` declared `installed`, `available` and `unavailable` and read
none of them: its body reads `params.scope` and `params.marketplace`, and every
filter decision comes from the `buckets` argument, whose `ToolFilterBuckets` type
owns that job and says so in its own comment. The three slots were a duplicate of a
decision made one call up in `applyFilter`. The tool's parameter schema is untouched,
so nothing was removed from what the calling agent may send.

### Task 3 -- the payload proof attempt and what it measured (commit `1ddfc8c0`)

This was the first live use of the `external-output` category; the contract file held
66 `type-selection`, 17 `type-refinement` and 2 `nominal-brand` entries and no
`external-output` of any kind. Six drafts were written -- one per payload row -- with
every coordinate derived from the compiler's own view of the syntax, and each was
submitted to the real engine against the real program, one at a time.

**All six were refused.** The message is identical in shape for every row:

```
Invalid contract: extensions/pi-claude-marketplace/edge/handlers/tools.ts:100:9
  boundary extensions/pi-claude-marketplace/edge/handlers/tools.ts:117:7
  is not a return to an external declaration
```

```
Invalid contract: extensions/pi-claude-marketplace/edge/handlers/tools.ts:140:3
  boundary extensions/pi-claude-marketplace/edge/handlers/tools.ts:524:7
  is not a return to an external declaration
```

The refusal is informative, not merely negative. `proveExternalOutput` checks
`originCandidates` **before** it checks the boundary, and no draft failed there --
so the engine agreed, for all six, that the named origin builds that exact member.
Only the boundary half is unproven, and the reason was measured with a compiler
probe rather than inferred:

1. **A method-shorthand handler has no contextual signature to find.** `execute` is
   written `async execute(_id, params, _signal, _onUpdate, ctx) { ... }`, so the
   prover's `externalCallSignatures` asks `checker.getContextualType` for a
   `MethodDeclaration` and gets `undefined`. The probe confirms the payload really
   does cross the boundary: the enclosing object literal contextually types to
   `ToolDefinition<...>` and its `execute` property is declared in
   `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.
   The engine simply cannot see through the shorthand.
2. **`reaches` cannot follow a value into a nested slot of the returned literal.** It
   returns true only when the returned expression *contains* the origin, and recurses
   only through an `Identifier`. Both returns here are `ObjectLiteralExpression`s
   carrying the rows nested under `details`, built in a loop elsewhere -- measured:
   `isIdentifier: false`, `contains(origin): false` for both.

Neither limit was worked around. The prover was not widened, the analyzer was not
edited, the hop bound was not relaxed, and `execute` was **not** converted to an
arrow-function property to give the prover a contextual type -- that rewrite would
change working product code purely to suit the analyzer, which is the failure mode
this phase exists to prevent. No slot was removed from either `details` payload:
removing one would silently change a shipped contract no compiler in this repository
checks.

`ParsedCommandArgs.required` was submitted once as a `type-selection` entry and
refused too:

```
Invalid contract: extensions/pi-claude-marketplace/edge/args-schema.ts:60:70
  filter extensions/pi-claude-marketplace/edge/args-schema.ts:60:54
  is not a two-argument type selection
```

`selectionOf` requires the filter literal's parent to be a `TypeReferenceNode` with
exactly two type arguments; the parent chain here is `TypeLiteral -> ConditionalType`.
The tempting rewrite -- restate `Entry extends { required: false }` as an
`Extract`-based two-argument selection the engine already proves -- was **not** taken.
`ParsedCommandArgs` is a public generic every command handler's argument parsing flows
through, and 06-CONTEXT's implementation discretion is explicit that an incomplete
analysis is corrected in preference to changing working product code to satisfy it.

The contract file was restored byte-for-byte after the drafts were measured, and the
gate still reports `contracts: 85 validated`.

## Owner hand-offs

### 1. The stranded resolver twin -- to plan 06-12 (orchestrators)

Removing `marketplaceNamesCachePath` from the edge-side `LocationsResolver` leaves the
orchestrator-side twin unreachable from any consumer. It was left alone on purpose:
it is executable code with a paired test, and it belongs to a different owner group.
Evidence, read out of the fresh report rather than transcribed:

| Artifact | Location | Status |
| --- | --- | --- |
| Declaration | `orchestrators/edge-deps.ts:63:3` (`LocationsResolverLike.marketplaceNamesCachePath`) | `test-only-observed` -- not a finding, so this plan gained nothing by deleting the edge side |
| Implementation | `orchestrators/edge-deps.ts:149` (`makeLocationsResolver`'s member, returning `locationsFor(scope, cwd).marketplaceNamesCacheFile`) | executable, covered |
| Witness 1 | `tests/orchestrators/edge-deps.test.ts:235:32` | `value-read`, `property-access` |
| Witness 2 | `tests/orchestrators/edge-deps.test.ts:256:32` | `value-read`, `property-access` |

06-12 owns the decision: keep the member and its two tests, or remove all three
together. Note that `MarketplaceStateRecordLike.manifestPath` and `.plugins`
(`orchestrators/edge-deps.ts:58:3` and `59:3`) were already unread findings in 06-12's
group before this plan ran, and are unaffected by it.

### 2. A conditional-clause proof -- shared with plan 06-13 (domain)

`ParsedCommandArgs.required` (`edge/args-schema.ts:60:70`) and `PiToolName.toolName`
(`domain/components/hook-tool-names.ts:52:21`) are the same shape: a filter literal
inside a conditional type's `extends` clause, doing the type-system work a
two-argument selection does, with no category that proves it. One bounded engine plan
adding a conditional-clause proof with its own drift controls clears both rows
together. Neither should be cleared by rewriting the product type.

### 3. An `external-output` proof that reaches these payloads

A bounded engine plan would need two extensions, both named above: read a
method-shorthand handler's contextual signature from its enclosing object literal, and
follow a value into a nested property of the returned literal. Both changes are in the
prover, not in `tools.ts`. Until then, the six payload rows stay findings.

## Verification

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | after task 1 and after task 2 |
| `npm run lint` | 0 | after task 2 |
| `node --test tests/edge/completions/*.test.ts tests/architecture/flag-catalog-drift.test.ts` | 0 | 168/168 |
| `node --test "tests/edge/handlers/**/*.test.ts"` | 0 | 396/396, no test file edited |
| `node --test tests/scripts/check-unused-type-members.contracts.test.ts` | 0 | 48/48 |
| `node scripts/check-unused-type-members.mjs --json` | 1 | 90 -> 88 -> 80; 1 is a member verdict, not a failure |
| `node scripts/check-unused-type-members.mjs` with each of 7 drafts | 2 | 7 recorded refusals, contract file restored byte-identical |
| `node scripts/check-unused-type-members.audit.mjs --inventory` | 0 | 3403 candidates, 80 unresolved, digest `219319ca` |
| `node scripts/check-unused-type-members.audit.mjs --check` | 1 | 80 problems, **all** `unread`; zero stale, missing, duplicate, incomplete or invalid |
| `npm run check` | 0 | typecheck, lint, workflow lint + negative, all four fallow sub-gates, format check, both corresponding-test gates, the direct-coverage negative gate, the unit suite and the integration suite |
| `npm run test:coverage:unit` | 0 | see below |
| `node scripts/check-unused-type-members.negative.mjs` | 0 | 7 of 7 ok |
| `SKIP=trufflehog pre-commit run --files <set>` | 0 | run before each of the three commits |

Test runs used a hermetic `HOME`, so no measurement was contaminated by the operator's
real `~/.pi/agent/` state.

### Coverage

Aggregate production unit coverage, read directly from `coverage/unit.lcov`:

```
227 modules under extensions/
functions 1834/1834   branches 9050/9050   lines 62904/62904
modules below 100%: 0
```

Functions and branches are **unchanged** from 06-10's 1834/9050 -- every edit in this
plan is a type-only declaration and took no control flow with it. Lines moved
62,910 -> 62,904, a drop of exactly six, and the movement was reconciled rather than
waved through: `git diff --numstat` over the three production files across both source
commits reads `4/4` for `data.ts`, `12/15` for `marketplace/shared.ts` and `0/3` for
`tools.ts` -- a net of exactly six physical lines removed, all of them type-only
declarations or their doc comments. No threshold was lowered, no exclusion added, and
neither entry in `scripts/test-coverage-direct.pin.json` was touched (neither pinned
file is in this plan's file set).

### Contract drift

The plan's first coupling check was confirmed, not assumed: none of the 85 validated
contract entries names any file under `extensions/pi-claude-marketplace/edge/`, and
none names `tests/architecture/flag-catalog-drift.test.ts` or anything under
`tests/edge/`. No coordinate sat below an edit point, so nothing needed re-anchoring,
and the gate exits 1 with a member verdict rather than 2 with a setup failure.

## Assertion and coverage ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-11-T1 | Before: the gate reports `LocationsResolver.marketplaceNamesCachePath` and `MarketplaceStateRecord.manifestPath` as unread. After: neither appears; the three sibling resolver members and `MarketplaceStateRecord.plugins` keep their verdicts; zero rows gained; `edge/register.ts` still type-checks. 168/168 across the three touched suites, with the flag-catalog stub corrected to the production type rather than loosened. | Type-only edit; no line, branch or function left the graph. Measured on the final tree: functions and branches unchanged, lines -4 physical (net 0 for this file). |
| 06-11-T2 | Before: five `SingleNameMarketplaceRun.opts` rows and three `loadToolPluginPayload.params` rows. After: none of the eight; `GetMarketplaceInfoOptions` keeps its verdict and gained no unread sibling (GAINED set empty); `ToolFilterBuckets` and the tool parameter schema untouched; 396/396 with **no paired-suite file edited**, so every expected notification, rendered line and `details` payload is unmodified by construction. | Type-only edit. Lines -3 and -3 physical across the two files; functions 1834 and branches 9050 unchanged. |
| 06-11-T3 | Seven drafts submitted to the real engine against this tree; seven refusals, each recorded with the engine's exact message; no draft rewritten to fit; the contract file byte-identical to its pre-draft state and still reporting 85 validated. `ParsedCommandArgs.required` stays a finding with a named hand-off. The record reconciles on digest `219319ca` with 80 problems, all `unread`. | No source change in this task. `npm run check` exit 0 and the aggregate unit coverage reading above, measured on the final tree; no direct pin moved. |

### `fails_when` counterexamples exercised

- **T1** -- "a member is deleted before confirming no production or test syntax reads it through this declaration": both members were greped tree-wide first, and the one call site found (`tests/orchestrators/edge-deps.test.ts`) was shown to land on the orchestrator declaration, which the gate independently classifies `test-only-observed`.
- **T1** -- "`orchestrators/edge-deps.ts` or its paired test is edited here": neither file appears in any commit of this plan.
- **T1** -- "a suite is made to pass by loosening a stub's type": the flag-catalog stub was *tightened*, from a hand-restated `{ manifestPath?: string }` to the production `MarketplaceStateRecord`.
- **T2** -- "an expected notification, rendered line or `details` payload in the paired suites is edited": no test file was modified in the task-2 commit at all.
- **T2** -- "a row is cleared by deleting a slot the tool schema still advertises": `LIST_PLUGINS_PARAMS` is untouched; only the internal loader parameter narrowed.
- **T3** -- "an entry is written to the contract file without an engine acceptance": the file is byte-identical to its pre-draft state; zero entries were added.
- **T3** -- "a refusal is answered by widening the prover, editing the analyzer, or moving production code to shorten a value's path": `scripts/check-unused-type-members.*.mjs` and `edge/handlers/tools.ts` are both untouched by the task-3 commit.
- **T3** -- "`ParsedCommandArgs` is rewritten to suit the engine": `edge/args-schema.ts` was never modified.
- **T3** -- "the summary reports one number instead of the repaired, contracted and outstanding split": the split table is the first section of this summary.

## Deviations from Plan

### 1. [Rule 2 -- missing critical] The flag-catalog stub names the production record type

- **Found during:** Task 1
- **Issue:** The plan offered two repairs for `tests/architecture/flag-catalog-drift.test.ts`'s `loadStateForScope` stub: "give it the `plugins` slot the interface still declares, or the empty shape the assertion needs". Both restate a shape the production module already exports, which is the same hand-kept-mirror pattern this plan spends task 2 removing.
- **Fix:** Imported `MarketplaceStateRecord` alongside `LocationsResolver` and annotated the stub with it, so the stub follows the declaration instead of a copy of it.
- **Files modified:** `tests/architecture/flag-catalog-drift.test.ts`
- **Verification:** `npm run typecheck` exit 0; 168/168 across the three suites; `npm run lint` exit 0 (import ordering respected).
- **Commit:** `690d0478`

### 2. [Recorded, not fixed] The contracted count is 0, not the projected "up to 6"

- **Found during:** Task 3
- **Issue:** Every `external-output` draft was refused. The plan anticipated this ("the engine may well refuse some or all of it") and names a contracted count below 6 as acceptable.
- **Action:** Recorded each refusal with the engine's message and the measured prover limit; moved all six rows to outstanding. No accommodation of any kind.
- **Commit:** `1ddfc8c0`

**Total deviations:** 1 auto-fixed (Rule 2), 1 recorded outcome within the plan's stated tolerance. **Impact:** none on production behaviour.

## Production behaviour

Unchanged. Every source edit in this plan is a type-only declaration: an interface
member, an interface method signature, a type alias body and a parameter type literal.
No notification, rendered line, tool payload or command outcome differs, no paired-suite
expectation was edited, and the two tool `details` shapes ship exactly the fields they
shipped before.

## Known Stubs

None.

## Issues Encountered

None.

## Next Phase Readiness

The phase's remaining repair plans are 06-13 (domain, platform) and 06-12
(orchestrators, persistence). Both hand-offs above are addressed to them. The live
population stands at 80 unread and 0 unsupported, with 85 validated contracts.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/edge/completions/data.ts` -- FOUND
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts` -- FOUND
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` -- FOUND
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` -- FOUND
- `scripts/check-unused-type-members.contracts.json` -- FOUND (unchanged)
- commit `690d0478` -- FOUND
- commit `0b00df9e` -- FOUND
- commit `1ddfc8c0` -- FOUND

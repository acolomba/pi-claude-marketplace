---
phase: 06-unused-type-member-gate
plan: "16"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, contracts, gate, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The contract engine's six categories, its category-scoped schema keys and its three-way exit contract
  - phase: 06-unused-type-member-gate
    provides: The arrival walk, its eight-hop bound, its assertion guard and its external-source filter
  - phase: 06-unused-type-member-gate
    provides: The seven executable negative controls a permissive change must not disturb
  - phase: 06-unused-type-member-gate
    provides: The 16-row live residual plan 06-15 left behind, with the mechanism named for each
provides:
  - "Three new evidence categories, each with category-scoped keys and named refusals: `satisfies-constraint`, `schema-pin` and `external-mirror`"
  - "A two-part arrival correction: a destructured step that carries the key the pattern selected, and a descent into the body the checker resolved for a call"
  - "Seven new validated contract entries, every one accepted by the real engine against this tree before it was written"
  - "A measured 16 -> 9 live population against a predicted 16 -> 9: every predicted row moved and no unpredicted row did"
  - "Thirty-four new contract controls, of which twenty-six state a refusal; four of them were derived only because a permissive mutant broke nothing"
  - "`hasBody`, `implementationOf` and the return collector moved to the shared model leaf rather than copied"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `d6f385e8`, reconciling with 9 problems that are ALL `unread`"
affects: [06-08, 06-17]

actuals:
  tokens: 28310
  tasks: 5
  commits: 9
plan_head_before: 1119eae95c09b030e1230ce64b15725d43d45706

tech-stack:
  added: []
  patterns:
    - "A new evidence category is kept only after the permissive variant of each of its own predicates is written and measured breaking a named control; a predicate no mutant can break gets a new counterexample derived until one does"
    - "An engine widening in the opt-in contract layer is measured clearing zero rows with no entry written, which is a free and exact permissiveness control"
    - "A transfer-step movement is isolated by re-running the changed engine against the pre-plan test file, because `tests/` is an analysed root and new controls are themselves analysed source"

key-files:
  created:
    - .planning/phases/06-unused-type-member-gate/06-16-SUMMARY.md
  modified:
    - scripts/check-unused-type-members.contracts.mjs
    - scripts/check-unused-type-members.model.mjs
    - scripts/check-unused-type-members.flow.mjs
    - scripts/check-unused-type-members.contracts.json
    - tests/scripts/check-unused-type-members.contracts.test.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "G-B is THREE categories, not one: `satisfies-constraint`, `schema-pin` and `external-mirror` name three different artifacts and make three different refusals, and one merged category would have to accept on the weakest of the three"
  - "`schema-pin` is NOT bolted onto `nominal-brand`: neither live row has a unique-symbol key or a marker type, and widening the brand proof would weaken what the accepted brand entries rest on"
  - "`external-mirror` claims only what was measured -- the compiler compels the member's SHAPE and not its presence -- and refuses a REQUIRED upstream slot by name, pointing at `external-input`, whose `upstreamRequires` is untouched"
  - "The arrival correction is TWO changes, measured: with the call descent removed the acceptance still fails, because the walk descends object and array literals and follows identifiers through recorded transfers, and a call expression is neither"
  - "Containment alone does not answer while a destructured key is being carried: the question is no longer whether the origin is somewhere in the expression but whether it is what arrived in that slot"
  - "`deepestSourceHop` was NOT raised: the live chain was measured to need exactly eight, and at seven the entry refuses"
  - "The arrival correction landed in the contract engine's own walk, not the flow walk's provenance maps, after reading every consumer of the recorded transfer list and confirming the contract engine is the only one"

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "A member an `as const satisfies` constraint compels carries a seventh category, with one category-scoped key and six named refusals"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a member the constraint of a satisfies expression compels keeps its role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a constraint reaching the owner one indexing step in compels its members"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a constraint no constrained entry writes the key for compels nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an optional member of a constraint is compelled by nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a constraint spelling the key on another declaration does not constrain it"
        status: pass
      - kind: other
        ref: "engine-alone delta with no entry written: 0 rows; after two accepted entries: exactly hook-if-targets.ts:55:3 and :56:3"
        status: pass
    human_judgment: false
  - id: D2
    description: "A schema key two declarations are pinned key-for-key equal on carries an eighth category, with two category-scoped keys and six named refusals"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a member a compiler-enforced pin holds equal to a counterpart keeps its role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a counterpart that does not declare the key is a stale pin"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a counterpart on the member's own declaration compares it with itself"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a pin instantiating an unconstrained generic checks nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a pin reaching only the member's own declaration states nothing about the other"
        status: pass
      - kind: other
        ref: "engine-alone delta 0 rows; after two accepted entries: exactly resolver-types.ts:19:7 and :32:7"
        status: pass
    human_judgment: false
  - id: D3
    description: "A mirror slot an installed declaration checks the shape of carries a ninth category that refuses a required upstream slot by name"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a mirror slot an installed declaration checks the shape of keeps its role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a required upstream slot belongs to the stronger external-input evidence"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a mirror slot corresponding in one direction only is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a checked site that hands back another declaration is refused"
        status: pass
      - kind: other
        ref: "the external-input draft for this member re-submitted and STILL refused, message recorded verbatim; both accepted external-input entries re-validated"
        status: pass
    human_judgment: false
  - id: D4
    description: "The arrival walk carries a destructured selection by key and descends a call into the body the checker resolved, with the hop bound, the assertion guard and the external-source filter unchanged"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin returned through a destructured selection reaches the boundary"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin building the other slot of the destructuring reaches nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a call whose implementation has no body descends nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin inside the surrounding literal is not what arrived in the selected slot"
        status: pass
      - kind: other
        ref: "deepestSourceHop measured: 8 accepts, 7 refuses, 6 refuses -- the bound was not raised"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole gate is green, the record reconciles against a fresh analysis and nothing else moved"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "npm run check -- exit 0, 6,535 unit tests and 32 integration, all four fallow sub-gates"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7; negative suite 21/21 with the always-clean mutant rejected on report content"
        status: pass
      - kind: other
        ref: "aggregate production unit coverage from the unmodified coverage/unit.lcov -- 1833/1833 functions, 9049/9049 branches, 62940/62940 lines, 0 modules below, byte-identical to the inherited figures"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1 with 9 problems, all unread, zero stale/missing/duplicate/incomplete/invalid"
        status: pass
    human_judgment: false

duration: 5h 5m
completed: 2026-09-17
---

# Phase 6 Plan 16: Three New Evidence Categories and a Two-Part Arrival Correction Summary

**Three new evidence categories and one two-part arrival correction that take the live residual from 16 unread members to exactly the 9 this plan does not own, with every predicted row moving, no unpredicted row moving, four engine-alone measurements each clearing zero rows, and thirteen permissive mutants run against the gate suites -- four of which broke nothing until a sharper counterexample was derived for them.**

## Performance

- **Duration:** 5h 5m
- **Tasks:** 5
- **Commits:** 9 (measured from `1119eae9`)
- **Files modified:** 6 (1 created, 5 modified)

## Predicted versus measured

This is the finding the plan exists to produce, so it is stated before anything else.

| Change | Predicted | Measured | The rows that left `unread` |
| --- | --- | --- | --- |
| G-B1 `satisfies-constraint` (T1) | 2 | **2** | `domain/components/hook-if-targets.ts:55:3` `IfPrefixTarget.piEvents`; `:56:3` `.extractTarget` |
| G-B2 `schema-pin` (T2) | 2 | **2** | `domain/resolver-types.ts:19:7` `DroppedHookSchema.matcher` (group arm); `:32:7` (handler arm) |
| G-B3 `external-mirror` (T3) | 1 | **1** | `platform/pi-api.ts:99:3` `ResourcesDiscoverResult.themePaths` |
| G-A arrival (T4) | 2 | **2** | `edge/handlers/tools.ts:140:3` `PluginRow.marketplace`; `:141:3` `.scope` |
| **Total** | **7** | **7** | 16 → **9** |

**Every measured row was predicted, and every predicted row was measured.** There is no shortfall and no overshoot. Nothing left `unread` that this plan did not name in advance, at any of the eight measurement points (four engine-alone, four after entries).

T3's written abort was evaluated and did **not** trip: the prover was made to refuse a stale mirror by resolving the named upstream coordinate, so the row was cleared rather than left outstanding.

### The nine standing rows, checked by name on the final snapshot

All nine are still `unread` with their disposition intact. The final residual is **exactly** this set -- no more and no less:

| Row | Owner | Still `unread` |
| --- | --- | --- |
| `domain/components/hooks.ts:77:3` `ResolveHookIfContext.homedir` | source plan 06-17 | ✅ |
| `domain/components/hooks.ts:79:3` `.projectRoot` | source plan 06-17 | ✅ |
| `orchestrators/edge-deps.ts:58:3` `MarketplaceStateRecordLike.plugins` | source plan 06-17 | ✅ |
| `orchestrators/edge-deps.ts:64:5` `LocationsResolverLike.loadStateForScope.marketplaces` | source plan 06-17 | ✅ |
| `orchestrators/plugin/shared.ts:129:5` `enableRowDependencies.signals.partition` | permanent (WR-01 refusal marker) | ✅ |
| `platform/git-auth-callbacks.ts:41:39` `AuthAttemptResult.authAttempted` | permanent (D-32-05) | ✅ |
| `platform/git-auth-callbacks.ts:42:34` `.authAttempted` | permanent (D-32-05) | ✅ |
| `orchestrators/types.ts:155:3` `UpdatePhaseFailure.msg` | permanent (rollback-populated surface) | ✅ |
| `orchestrators/plugin/info.messaging.ts:68:69` `PLUGIN_INFO_RENDER.status` | permanent (single-variant filter) | ✅ |

The check was run after every one of the four changes, not only at the end. It read `9 of 9` each time.

## The permissiveness controls, and what they measured

### Engine-alone zero-delta, taken four times

A contract entry is opt-in, so a widening in the contract layer cannot move a row until an entry is written. Each of the four tasks ran the analyzer with the engine changed and **no entry added**, and diffed by `(path, owner, key)` against the snapshot immediately before:

| Task | Engine-alone delta |
| --- | --- |
| T1 `satisfies-constraint` | **0 rows** |
| T2 `schema-pin` | **0 rows** |
| T3 `external-mirror` | **0 rows** |
| T4 arrival correction | **0 rows** |

T4's zero was earned rather than assumed. The plan's obligation was to confirm by reading that the recorded transfer list is consumed by the contract engine and nothing else, before relying on the control. That reading holds: `state.transfers` is appended to only by `recordTransfer` (`flow.mjs:304`), returned once (`flow.mjs:1874`), and passed by `analysis.mjs:255` into `evaluateContracts` and nowhere else. The observation model -- `creditRead`, `state.witnesses`, `state.bySymbol` and the provenance maps -- never reads it. Those maps were not touched.

### Permissive-mutant measurement, thirteen mutants

Every new predicate was mutated into the sloppy version it forbids and the whole repository's gate suites were run against the mutant. **Four of the thirteen broke nothing**, and in each case a sharper counterexample was derived until one did -- which is the single most useful thing this plan produced, because those four are exactly the places where the controls as first written could not tell a correct rule from a permissive one.

| Mutant | What broke |
| --- | --- |
| `satisfies-constraint`: skip the written-key check | `a constraint no constrained entry writes the key for compels nothing` -- **the only control in the repository that catches it**; 229 others stayed green |
| `satisfies-constraint`: skip the optional check | `an optional member of a constraint is compelled by nothing` |
| `satisfies-constraint`: settle identity by spelling, not through the declaration map | **nothing** → derived `a constraint spelling the key on another declaration does not constrain it`, which it breaks |
| `schema-pin`: reach need only cover the candidate's own side | **nothing** → derived `a pin reaching only the member's own declaration states nothing about the other`, which it breaks |
| `schema-pin`: skip the argument-satisfies-constraint check | `a pin whose argument does not satisfy its constraint does not hold` |
| `schema-pin`: allow the counterpart on the candidate's own declaration | `a counterpart on the member's own declaration compares it with itself` |
| `schema-pin`: counterpart need not declare the key | `a counterpart that does not declare the key is a stale pin` |
| `external-mirror`: upstream need not name the key in an installed declaration | `an upstream that does not declare the key is a stale mirror`, `an upstream coordinate outside an installed declaration is refused`, **and the pre-existing `an upstream site that no longer declares the member is refused`** -- the mutated shape is shared with `upstreamRequires`, so the `external-input` proof guards it too |
| `external-mirror`: drop the required-upstream refusal | `a required upstream slot belongs to the stronger external-input evidence` |
| `external-mirror`: check correspondence one way only | **nothing** → derived `a mirror slot corresponding in one direction only is refused`, which it breaks |
| `external-mirror`: drop the hands-back check | `a checked site that hands back another declaration is refused` |
| arrival: forget the key the destructuring selected | `an origin building the other slot of the destructuring reaches nothing` -- **the counterexample the whole change is judged by** |
| arrival: drop the key-selective literal descent | the ACCEPTANCE, `an origin returned through a destructured selection reaches the boundary` -- the two halves are coupled |
| arrival: leave containment unsuppressed while a key is carried | **nothing** → derived `an origin inside the surrounding literal is not what arrived in the selected slot`, which it breaks |

### Counterexamples that passed before the change

Recorded rather than treated as strength. All three arrival refusals passed RED, because the unchanged walk refuses **everything** that passes through a destructuring; they measure nothing until a permissive variant of the change is run against them, which is what the table above is for. The same is true of every refusal in the three new categories: a category that does not exist cannot refuse anything on its own terms, so all thirty-four new controls failed RED for the same reason (`names unknown category`) and only the mutants distinguish a correct predicate from a sloppy one.

## The four changes

### T1 (tracer) -- a category for a member an `as const satisfies` constraint compels

The mechanism was established from source before anything was designed, and the triage's deletion probe was re-run rather than inherited. Deleting `IfPrefixTarget.piEvents` fails `npm run typecheck` **five times**, once per table entry:

```
hook-if-targets.ts(87,5): error TS2353: Object literal may only specify known
  properties, and 'piEvents' does not exist in type 'IfPrefixTarget'.
```

and again at 91:5, 95:5, 99:5 and 103:5. The deletion was restored and the file is byte-identical to its backup.

Two engine facts were then confirmed by compiler probe, because both shape the design:

```
nodeAt(86:34)         = SatisfiesExpression   (expression kind: AsExpression)
constraint type       = Record<string, IfPrefixTarget>
  own properties      = []
  string index type   = IfPrefixTarget
    piEvents          -> hook-if-targets.ts:55:3   optional: false
    extractTarget     -> hook-if-targets.ts:56:3   optional: false
every entry of the constrained literal writes ["piEvents","extractTarget"]
```

The object literal, the `as const` and the `satisfies` all start at the same character, so a coordinate on the literal resolves to the outermost of them -- the `satisfies` expression, which is what the entry names.

The category carries one evidence key, `constraint`, and three checks that are worthless alone: the named node must be a `satisfies` expression; the member must be required; and the constrained literal must really write the key, because an index-signature constraint is satisfied vacuously by an empty literal. The owner is reached either directly from the constraint or one indexing step in, through an index-signature or property value type -- the `Record` shape, where the constraint checks every ENTRY rather than the literal itself.

**The `as const` / `insideAssertion` distinction is stated in the prover's header**, because the two rules look contradictory and are not: `insideAssertion` asks whether an assertion stands between a value and the position that would have typed it -- there the assertion replaces the check. Here the assertion is the thing being checked, and an assertion carrying no `satisfies` is refused by name.

### T2 -- a category for a member two declarations are pinned key-for-key equal on

The mechanism was measured before the prover was designed:

```
pin alias           DroppedHookArmKeysCheck @ resolver-types.ts:67:1
  declared type     AssertTrue<[true] extends [DroppedHookArmKeysDrift] ? true : false>
  AssertTrue params [ 'T extends true' ]
  argument          true   constraint true   assignable: true
reach depth 3       AssertTrue, DroppedHookArmKeysDrift, DroppedHookArmKeysMatch,
                    Extract, DroppedHook@partition.ts:14:1, Static,
                    DroppedHookSchema@resolver-types.ts:13:1
```

Depth 3 is the minimum that reaches both sides; the bound is stated at 4 in the header beside the constant. The deletion probe was re-run and is **stronger than the triage recorded**: deleting the group-arm `matcher` fails four times, not two --

```
plugin-resolver.ts(133,3): error TS2375 ...
resolver-types.ts(66,43): error TS2344: Type 'false' does not satisfy the constraint 'true'.
tests/domain/resolver-types.test.ts(42,12): error TS1360 ...
tests/domain/resolver-types.test.ts(43,3): error TS2344 ...
```

-- so the proof is not self-referential: a real consumer and an independent test-side drift control both break with it. The deletion was restored.

`nominal-brand` was deliberately not reached for. That category proves a member no module outside the branding one can supply, through a `unique symbol` key and a type no ordinary value satisfies; neither live row has either, and admitting a pinned schema key there would weaken the proof the accepted brand entries rest on. `schema-pin` is its own category with two keys, `pin` and `counterpart`, scoped to itself.

### T3 -- a category for a member that keeps a local mirror faithful

This is the weakest evidence in the plan and the task the plan expected might end in an honest refusal. Both probes were re-run and the measured asymmetry is exactly what the plan recorded:

| Probe | Result |
| --- | --- |
| widen `themePaths` to `number[]` | `index.ts(86,5): error TS2769: No overload matches this call.` plus `tests/index.test.ts(343,11)` and two test-side drift errors |
| **delete** `themePaths` | `tests/platform/pi-api.test.ts(103,3): error TS2353` -- **and nothing else in production** |

So the compiler compels the member's SHAPE and not its presence, and the category claims exactly that and no more. `getContextualType` at the checked site was read before the design:

```
checked index.ts:87:5   ArrowFunction, contextual type
  ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>
  signature from node_modules/@earendil-works/.../types.d.ts (isDeclarationFile: true)
own return Promise<ResourcesDiscoverResult> -> awaited ResourcesDiscoverResult
  themePaths -> platform/pi-api.ts:99:3
local string[]  upstream string[]   l->u: true  u->l: true
```

`proveExternalInput` was read before a line was written and **`upstreamRequires` was not relaxed**. The boundary between the two categories is enforced rather than described: a REQUIRED upstream slot is refused by name and pointed at `external-input`. The `checked` function's own return, resolved through its awaited type, must carry the candidate's owner -- the return-side counterpart of `suppliesCandidate`, settled through `resolveCandidates` so a same-spelled slot on a different declaration does not connect.

`externalCallSignatures` and `insideAssertion` are reused unchanged, and their shared blast radius was re-verified rather than assumed: both accepted `external-input` entries still validate and the assertion-reached refusal control still refuses.

### T4 -- carry a destructured selection and cross a call

**The plan's two-part prediction was measured, not assumed.** With the destructuring step implemented and the call descent removed, the acceptance still fails; with both, it passes. The chain is broken in two places, not one:

- `reaches` descends object and array literals and follows identifiers through recorded transfers. A call expression is neither, and there is no `return` transfer kind among the eight recorded ones.
- The flow walk records no transfer into a destructured binding at all, which 06-15 measured.

Both are named in the change, and both were needed.

The correction is exactly two steps and nothing more. First, a source place that resolves to a binding element continues from the expression the pattern destructures **while remembering the key that element named**, and an object literal reached while a key is carried is descended through that ONE property, after which the key is forgotten. Second, the walk descends a call into the body the checker resolved for it, following the implementation an overload was merged with and descending nothing when there is no body.

One thing the plan did not name was needed and is stated here: **containment alone does not answer while a key is being carried.** The question is no longer "is the origin somewhere in this expression" but "is the origin what arrived in that slot", and the surrounding syntax cannot settle that. Leaving it unsuppressed broke no control, so the `an origin inside the surrounding literal` counterexample was derived and it does break it.

**The hop bound was not raised, and the live chain needs exactly eight:**

| `deepestSourceHop` | Live entry |
| --- | --- |
| 8 (unchanged) | **accepted** |
| 7 | refused |
| 6 | refused |

Zero slack, exactly as the plan hand-counted.

**Helpers were MOVED, not copied.** `hasBody`, `implementationOf` (now taking a `checker` rather than the flow walk's `state`) and the return collector -- exposed as `returnExpressionsOf` -- live in the shared model leaf. `flow.mjs` imports them and its own copies are gone; `returnsOf` now reads a body through the shared helper. Every control that exercised them is unmodified and green: the flow, model and live suites are 151/151 together with contracts, and the whole-tree counts (3,352 candidates, 2,995 runtime-observed, 240 test-only) did not move at all.

`calleeReturns` does not carry its own `hasBody` guard: `returnExpressionsOf` already answers nothing for a bodyless declaration, so the guard would have been an unexercised branch. That is stated in its header rather than left implicit.

## Contract drafts: 7 submitted, 7 accepted, 3 recorded refusals still refuse

Every entry was submitted to the real engine against the real program, one at a time, with every coordinate derived from the compiler's view of the current syntax. Nothing the engine refused was written.

| Draft | Category | Outcome |
| --- | --- | --- |
| `hook-if-targets.ts:55:3` `piEvents` | satisfies-constraint | **ACCEPTED** |
| `hook-if-targets.ts:56:3` `extractTarget` | satisfies-constraint | **ACCEPTED** |
| `resolver-types.ts:19:7` `matcher` (group) | schema-pin | **ACCEPTED** |
| `resolver-types.ts:32:7` `matcher` (handler) | schema-pin | **ACCEPTED** |
| `pi-api.ts:99:3` `themePaths` | external-mirror | **ACCEPTED** |
| `tools.ts:140:3` `PluginRow.marketplace` | external-output | **ACCEPTED** |
| `tools.ts:141:3` `PluginRow.scope` | external-output | **ACCEPTED** |
| `pi-api.ts:99:3` `themePaths` | external-input | **STILL REFUSED**, re-submitted |
| `args-schema.ts:60:70` `required` | type-selection | **STILL REFUSED**, re-submitted |
| `info.messaging.ts:68:69` `status` | type-selection | **STILL REFUSED**, re-submitted |

The three refusals, verbatim, each exiting 2:

```
Invalid contract: extensions/pi-claude-marketplace/platform/pi-api.ts:99:3
  upstream node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:413:5
  declares themePaths as optional, so no local mirror is compelled
```

```
Invalid contract: extensions/pi-claude-marketplace/edge/args-schema.ts:60:70
  filter extensions/pi-claude-marketplace/edge/args-schema.ts:60:54
  is not a two-argument type selection
```

```
Invalid contract: extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts:68:69
  filter extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts:68:37
  selects over a type that does not discriminate on status
```

The `external-input` draft for `themePaths` is the disjointness regression: it must stay refused so the new, weaker category cannot become a soft substitute for the strict one. It is, for the same reason as before.

Contract count: **101 → 108**. Every one of the 101 pre-existing entries still validates -- the run exits 1 with member findings, not 2.

## Evidence spot-checks

Every member that changed status carries an evidence coordinate a human can open. One per change was opened and read:

| Member | Evidence coordinate | What is there |
| --- | --- | --- |
| `IfPrefixTarget.piEvents` | `hook-if-targets.ts:86:34` | `export const IF_PREFIX_TARGETS = {` … `} as const satisfies Record<string, IfPrefixTarget>;` at line 107, with all five entries writing both keys |
| `DroppedHookSchema.matcher` | pin `resolver-types.ts:67:1`, counterpart `hooks/partition.ts:19:7` | `type DroppedHookArmKeysCheck = AssertTrue<…>` and `matcher: string;` on the hand-written `DroppedHook` group arm |
| `ResourcesDiscoverResult.themePaths` | upstream `types.d.ts:413:5`, checked `index.ts:87:5` | `themePaths?: string[];` inside the installed `ResourcesDiscoverResult`, and the `async (event, ctx): Promise<ResourcesDiscoverResult>` handler passed to `pi.on("resources_discover", …)` |
| `PluginRow.marketplace` | origin `tools.ts:437:9`, boundary `tools.ts:524:7` | `marketplace: mpName,` inside `const row: PluginRow = {`, and the `return {` whose `details: { plugins: rows }` at 526:20 carries it |

## The measured series

```
16 unread -> 14 (T1) -> 12 (T2) -> 11 (T3) -> 9 (T4)
contracts 101 -> 108    candidates 3352 (unchanged)    unsupported 0
runtime-observed 2995 (unchanged)    test-only 240 (unchanged)
```

| Snapshot | Unread | Contracts | Wall | Peak RSS | Transfer steps |
| --- | --- | --- | --- | --- | --- |
| baseline | 16 | 101 | 75.8 s | 2.117 GiB | 3,030,520 |
| T1 | 14 | 103 | 77.5 s | 2.054 GiB | 3,032,134 |
| T2 | 12 | 105 | 81.7 s | 2.045 GiB | 3,033,156 |
| T3 | 11 | 106 | 82.3 s | 2.112 GiB | 3,034,478 |
| T4 | 9 | 108 | 83.8 s | 2.054 GiB | 3,035,308 |
| **final** | **9** | **108** | **81.3 s** | **2.095 GiB** | **3,035,308** |
| **Budget** | | | **100 s** | **2.40 GiB** | **6,000,000** |

Every run is inside the budget with room, and neither the 12,000,000-step adopted cap nor the eight-hop bound was touched.

### The transfer-step movement, isolated rather than rationalised

The plan predicted the step count unchanged at 3,030,520 and it measured 3,035,308, so the +4,788 was investigated before it was accepted. **The engine changes cost zero transfer steps.** With all four of them in place and the contracts test file restored to its pre-plan content, the run reports:

```
steps 3030520   edges 217734   reads 83327   operationReads 996082
```

-- byte-identical to the inherited figures on all four counters. The movement is entirely the analyzer walking this plan's own 34 new controls, because `tests/` is an analysed root and a control is itself analysed source. The same isolation was taken after T1 and gave the same answer. A wall-clock reading of 101.1 s was recorded once under load and re-measured at 77.5 s and 77.7 s with an identical step count; the outlier is contention, not cost.

## Verification

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | after every slice |
| `npm run lint` | 0 | after every slice |
| `npm run fallow` | 0 | all four sub-gates, inside `npm run check` |
| `npm run format:check` | 0 | |
| `node --test` contracts suite | 0 | **101/101** (67 inherited + 34 added) |
| `node --test` model + flow suites | 0 | 151/151 together with contracts, unchanged and untouched |
| `node --test "tests/edge/handlers/**"` | 0 | 307/307 |
| `node --test tests/platform/pi-api.test.ts` | 0 | included in the 99/99 T3 run |
| `node --test tests/architecture/unused-type-member-gate.test.ts` | 0 | included in the 90/90 T2 run |
| `node --test` negative-runner suite | 0 | **21/21** |
| `node scripts/check-unused-type-members.negative.mjs` | 0 | **7 of 7**, 7 m 22 s, 2.120 GiB |
| `npm run check` | 0 | 6,535 unit tests, 32 integration (30 pass, 2 environment skips), 0 fail |
| `npm run test:coverage:unit` | 0 | see below |
| `npm run test:coverage:direct:all` | 0 | 236 pairs in 483.3 s; **2 pinned shortfalls matched exactly** |
| `node scripts/check-unused-type-members.mjs --json` | 1 | 9 findings, 0 unsupported, 108 validated contracts |
| `node scripts/check-unused-type-members.audit.mjs --check` | 1 | 9 problems, all `unread` |
| `SKIP=trufflehog pre-commit run --files …` | 0 | clean before each of the 9 commits |

Every suite ran under a hermetic `HOME`; no `PI_CODING_AGENT_DIR` was shared.

### The always-clean mutant is still rejected on content

```
test("rejects a gate that always reports a clean tree", …)
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /offender-plant: the overlay finding set is missing .*:31:3/);
```

It discriminates on what the report **says**, not on the exit status, and it still fails the mutant on this snapshot.

### Coverage

Read from the unmodified native `coverage/unit.lcov`, aggregated over the 227 `extensions/pi-claude-marketplace/` modules:

```
functions 1833/1833   branches 9049/9049   lines 62940/62940
modules below 100%: 0
```

**Byte-identical to the inherited figures on all three axes**, as predicted: this plan edits nothing under `extensions/`. No threshold was lowered, no source excluded, no pin updated.

## Task commits

1. **T1 (tracer)** — `653415bc` (test), `380e7403` (feat)
2. **T2** — `093bda86` (test), `541a8974` (feat)
3. **T3** — `930f5794` (test), `b603a2a7` (feat)
4. **T4** — `8b5edd0a` (test), `b9f705d7` (feat)
5. **T5** — `871ec599` (docs)

## Assertion and coverage ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-16-T1 | A seventh category with one category-scoped key, one acceptance form in two reach shapes and six named refusals; three permissive mutants written, two breaking exactly one control each and the third breaking nothing until a declaration-identity counterexample was derived; engine-alone delta 0; exactly two rows moved on two accepted entries; both evidence coordinates opened and read; nine standing rows unchanged. | contracts 77/77, model suite green, analyzer exit 1 with 103 contracts; 77.5 s / 2.054 GiB / 3,032,134 steps. |
| 06-16-T2 | An eighth category with two category-scoped keys and six named refusals; the reach bound stated in the header beside the constant; four permissive mutants, the first breaking nothing until a one-sided pin was added; engine-alone delta 0; exactly two rows moved; the deletion probe re-run and measured stronger than recorded (four failures, not two); both evidence sites opened and read. | contracts 85/85 then 86/86, gate architecture test included in 90/90, analyzer exit 1 with 105 contracts; 81.7 s / 2.045 GiB / 3,033,156 steps. |
| 06-16-T3 | A ninth category with two category-scoped keys and seven named refusals; the required-upstream refusal naming `external-input`; the `external-input` draft for this member still refused with its message verbatim; both accepted `external-input` entries and the assertion-reached refusal re-verified; four permissive mutants, the correspondence one breaking nothing until a one-way slot was added; engine-alone delta 0; exactly one row moved. | contracts 96/96, pi-api suite included in 99/99; 82.3 s / 2.112 GiB / 3,034,478 steps. |
| 06-16-T4 | A key-carrying destructured step and a call descent, with the hop bound, the assertion guard and the external-source filter unchanged; the two-part prediction measured by removing the call descent and watching the acceptance fail; the key-blind mutant measured breaking the sibling-slot counterexample; helpers shared not copied with every pre-existing control unmodified and green; engine-alone delta 0; exactly two rows moved with origin and boundary opened and read; the abort condition evaluated against a real measurement and not tripped; `deepestSourceHop` measured at exactly 8. | contracts 101/101, model + flow 151/151 together, edge handlers 307/307; 83.8 s / 2.054 GiB / 3,035,308 steps. |
| 06-16-T5 | Predicted-versus-measured table with every moved row named and no unpredicted row; nine standing rows confirmed by name; evidence spot-checked across all four changes; 101 pre-existing entries still validate; all three recorded refusals still refuse; negative controls 7/7 and the runner suite 21/21 with the always-clean mutant rejected on report content. | `npm run check` exit 0; native aggregate production unit coverage 1833/1833 functions, 9049/9049 branches, 62940/62940 lines, 0 below, byte-identical; both direct pins matched exactly; final cost 81.3 s / 2.095 GiB / 3,035,308 steps against the budget. |

## Deviations from Plan

**1. [Rule 2 - Missing critical] Four permissive mutants broke nothing, so four counterexamples were derived that they do break**

- **Found during:** Tasks 1, 2, 3 and 4
- **Issue:** The plan's obligation is that a refusal no mutant can break is not yet a refusal. Four predicates had that property as first written: settling member identity by spelling rather than through the declaration map (T1); a pin reach that covers only the candidate's side (T2); a type correspondence checked in one direction only (T3); and containment answering while a destructured key is still being carried (T4). In each case the fixture as written could not distinguish the correct rule from the permissive one.
- **Fix:** Derived one counterexample per case -- a constraint spelling the key on another declaration, a pin reaching only the schema side, a slot corresponding one way only, and an origin built inline in the other slot of the literal the walk passes through -- and re-ran the mutant against each. All four now break exactly the derived control and nothing else.
- **Files modified:** `tests/scripts/check-unused-type-members.contracts.test.ts`
- **Committed in:** `380e7403`, `541a8974`, `b603a2a7`, `b9f705d7`

**2. [Rule 2 - Missing critical] `schema-pin` and `external-mirror` each needed one refusal beyond the five and six the plan listed**

- **Found during:** Tasks 2 and 3
- **Issue:** `schema-pin`'s "compiler-enforced" requirement has two distinct failure modes -- no constrained type parameter is instantiated at all, and one is but the argument written for it does not satisfy it. One message for both would have been lossy, and the second branch would have had no control. `external-mirror`'s "checked site" counterexample likewise covers two shapes (nothing installed checks it, and it is reached only through an assertion) that the existing `assertLocalNecessity` already separates.
- **Fix:** Split each into its own named refusal with its own control: `does not hold today` beside `instantiates no constrained type parameter`, and `is reached only through an assertion` beside `is not checked against an installed declaration`. Six named refusals for `schema-pin` and seven for `external-mirror`, not five and six.
- **Files modified:** `scripts/check-unused-type-members.contracts.mjs`, `tests/scripts/check-unused-type-members.contracts.test.ts`
- **Committed in:** `541a8974`, `b603a2a7`

**3. [Rule 3 - Blocking] The predicted transfer-step count was wrong in a way the plan could not have known, and the cause was isolated rather than accepted**

- **Found during:** Task 1
- **Issue:** The plan predicts the step count unchanged at 3,030,520 on the grounds that every change runs inside the per-entry contract evaluator. That reasoning is correct about the ENGINE and wrong about the run: `tests/` is an analysed root, so the plan's own new controls are analysed source and add transfer steps of their own.
- **Fix:** Isolated the cause rather than rationalising it. With all four engine changes in place and the contracts test file restored to its pre-plan content, the run reports exactly 3,030,520 steps, 217,734 edges, 83,327 reads and 996,082 operation reads -- byte-identical on every counter. The engine changes cost zero. The measurement was taken twice, after T1 and again on the final tree.
- **Files modified:** none
- **Committed in:** n/a (a measurement, recorded here)

### Documented scope choices

**4. Two commits per task where `tdd="true"`.** The plan asks for one commit per task; the TDD contract asks for a failing `test(...)` commit followed by `feat(...)`. 06-03 and 06-15 resolved the same conflict the same way in this phase, and the RED evidence is what the governing risk depends on.

**5. Commit messages carry no plan scope.** `CLAUDE.md` forbids milestone and phase identifiers in commit subjects and bodies and takes precedence over the GSD `{type}({phase}-{plan})` convention, exactly as in 06-03, 06-12 and 06-15.

**6. `pre-commit` was run with `SKIP=trufflehog`,** as `CLAUDE.md` prescribes for this checkout. Every other hook ran and passed before each of the nine commits; several rewrote formatting and were re-run until clean. `--no-verify` was never used.

**7. The "arrival chain longer than the hop bound" and "boundary reached only through an assertion" counterexamples were not duplicated.** Both already exist as controls on the shared walk (`an arrival chain longer than the hop bound is refused, not answered partially` and the assertion guard in `externalReturnExpression`), and both stayed green through the change. Writing second copies would have violated this plan's own one-definition obligation.

**8. `symbolOfName` stayed local to the flow walk.** It is a two-line convenience over `checker.getSymbolAtLocation` bound to the flow walk's `state`, used five more times there. The substantive rule that moved is `implementationOf`'s overload-merge behaviour, which now has exactly one definition; the model-side version asks the checker directly rather than importing a `state`-shaped helper.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical) and 5 documented scope or convention choices.
**Impact on plan:** No gate was weakened. No threshold, suppression, coverage exclusion, census pin, hop bound or adopted budget cap was changed. Every one of the seven predicted rows moved and nothing else did.

## Known Stubs

None. The nine rows this plan leaves outstanding each carry a written, source-checkable mechanism in `06-LIVE-TRIAGE.md`, and none is a placeholder for work this plan chose not to finish: four belong to source plan 06-17 and five are recorded decisions the operator owns.

## Observed Limits

Each is a refusal or an under-credit with a named reason, not a silent acceptance.

- **A destructured selection does not compose with another.** When the arrival walk is already carrying a key and meets a second destructuring, it stops rather than replacing the key. Two selections would need a stack, and replacing one with the other could credit a value that arrived in a different slot. Under-crediting, by design, and stated in the helper's header.
- **A key carried into an array literal or a spread is not consumed there.** Only an object literal spelling the key consumes it; a spread assignment has no name and descends nothing while a key is carried.
- **A `satisfies` constraint is reached at most one indexing step in.** A constraint whose owner sits two levels down -- a `Record` of a `Record` -- is refused rather than followed.
- **A pin is followed four alias steps.** The live pin needs three; a longer correspondence refuses rather than answering partially.
- **`external-mirror` proves shape, not presence.** Deleting the member compels nothing, and the category says so. It is strictly weaker than `external-input` and refuses every case that one covers.
- **`external-mirror`'s checked site must be a function an installed declaration checks.** A value built to satisfy an installed shape directly is not yet a supported checked site.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at a trust boundary. Every threat in the plan's own register was mitigated as written: T-06-16-01 by the three counterexample sets, the four engine-alone zero-delta measurements and eleven category mutants; T-06-16-02 by the key-carrying destructured step measured against its key-blind variant, an unchanged hop bound, assertion guard and external-source filter, untouched provenance maps and every `external-output` entry re-validated; T-06-16-03 by opening and reading an evidence coordinate per change and checking the nine standing rows by name after every task; T-06-16-04 by the required-upstream refusal naming `external-input`, the re-submitted and still-refused `external-input` draft, and per-category schema keys; T-06-16-05 by the per-task `/usr/bin/time -v` series and the isolated step-count cause; T-06-16-06 by editing nothing under `extensions/` and requiring exit 1 rather than 2; T-06-16-07 by re-submitting all three recorded refusals and confirming each still refuses; T-06-16-08 by parsing analysed modules without importing them.

## Issues Encountered

- **A third contract entry now names a coordinate inside `node_modules/`.** `external-mirror`'s `upstream` for `themePaths` pins `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:413:5`, joining the two `external-input` entries that already pin `:405:5` and `:407:5`. A peer upgrade that moves those lines refuses all three by name and the gate exits 2. That fails safe. It is carried forward, not worked around.
- **A wall-clock outlier of 101.1 s was recorded once** against a 100 s budget, under contention from a concurrently finishing test run. Re-measured twice at 77.5 s and 77.7 s with a byte-identical step count, so the work was identical and the reading was machine load. Recorded rather than dropped.
- **`git commit` fails under the hermetic `HOME`** used for test runs, because git reads the operator's identity from `~/.gitconfig`. Commits were made with the real `HOME` and test runs under the hermetic one; no measurement was contaminated by the operator's `~/.pi/agent/` state.

## Next Phase Readiness

**06-08's activation prerequisite, stated honestly: the residual is 9, not zero.** The mandatory gate cannot be activated while any member is unexplained, and this plan does not have the authority to accept the remaining nine. What has changed is that the engine has no further gap to close: every one of the nine is a source repair or a recorded decision, and none of them is waiting on the analyzer.

- **4 rows belong to source plan 06-17**, the next plan in this phase. Two are `ResolveHookIfContext.{homedir,projectRoot}`, whose repair aliases a `bridges/hooks/if-field/` declaration; two are the `orchestrators/edge-deps.ts` mirror halves, whose legal collapse lands in an `edge/`-owned file. Both are ordinary source work with a named target file.
- **5 rows are recorded decisions for the operator, not gaps for an engine plan.** `enableRowDependencies.signals.partition` (no left operand declares the slot, so every restatement adds a key -- the WR-01 refusal marker); `AuthAttemptResult.authAttempted` twice (D-32-05, which nobody below the operator may revoke); `UpdatePhaseFailure.msg` (a rollback-populated structured surface, which is behaviour); and `PLUGIN_INFO_RENDER.status` (the selected-over type is a single variant, so the refusal is correct, and the family-consistent filter guards a future second status).

Saying that plainly: after 06-17 lands its four rows, the population is five, and all five want a decision rather than a fix. 06-08 should be planned around that, not around a further engine plan.

The engine is measurably no more permissive than it was. Three new categories were each measured clearing zero rows on their own, thirteen permissive provers were run against the whole repository's gate suites and every one of them is now broken by a named control, and the seven negative controls still reject an always-passing gate on report content.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-17*

## Self-Check: PASSED

All six modified files and the created SUMMARY exist on disk, and all ten
commits are present in `git log` between `1119eae9` and `HEAD`. Every `<verify>`
command in the plan was run in the foreground with its exit status captured
directly, never through a pipe whose status belongs to another process. The
measured commit count from the plan ledger is `git rev-list --count
1119eae9..HEAD` = 10, one more than the nine recorded in the frontmatter, which
was measured before this SUMMARY's own commit.

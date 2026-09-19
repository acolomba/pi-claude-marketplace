---
phase: 06-unused-type-member-gate
plan: "15"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, contracts, gate, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable member gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The contract engine's five categories and the exact refusal each produces
  - phase: 06-unused-type-member-gate
    provides: The seven executable negative controls a permissive change must not disturb
  - phase: 06-unused-type-member-gate
    provides: The 33-row live residual the six repair plans left behind
provides:
  - "Five analyzer corrections, each shipping the counterexample that fails it: a single-arm contextual union in the origin half, `never` as the empty constituent set, a sixth `conditional-clause` category, a method-shorthand external boundary with nested arrival and a symbol-keyed transfer index, and discriminant-value attribution for a compared union arm"
  - "A sixth correction: production lineage carried through a factory-returned closure, measured to cost 0.8 percent more transfer steps"
  - "Eleven new validated contract entries, every one accepted by the real engine against this tree before it was written"
  - "A measured 33 -> 16 live population against a predicted 33 -> 14, with every moved row named and the two predicted rows that did not move recorded with the engine's verbatim refusal and the mechanism behind it"
  - "Twenty-seven new controls across the contracts and operations suites, of which nineteen state a refusal; three of them fail against a permissive prover no earlier control caught"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `3fec0ee2`, reconciling with 16 problems that are ALL `unread`"
affects: [06-08]

actuals:
  tokens: 39543
  tasks: 7
  commits: 13
plan_head_before: 68c287d330d0aeffb3e45d4d15d7ad6be13ea08a

tech-stack:
  added: []
  patterns:
    - "A widened proof is kept only after the permissive variant of it is written and measured to fail a control; a refusal that no mutant can break has not been shown to discriminate"
    - "An engine widening in the opt-in contract layer is measured clearing zero rows with no entry written, which is a free and exact permissiveness control"
    - "A restatement of product source is kept only after a self-checking compiler probe proves value-set equivalence and every refusal it enforces still fires; the probe is then deleted"

key-files:
  created:
    - .planning/phases/06-unused-type-member-gate/06-15-SUMMARY.md
  modified:
    - scripts/check-unused-type-members.model.mjs
    - scripts/check-unused-type-members.contracts.mjs
    - scripts/check-unused-type-members.flow.mjs
    - scripts/check-unused-type-members.contracts.json
    - tests/scripts/check-unused-type-members.contracts.test.ts
    - tests/scripts/check-unused-type-members.operations.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "`propertySymbolOf` MOVED to the shared model leaf rather than being copied into the contract engine, so which arm of a union a key belongs to keeps exactly one definition; the three flow-side controls that exercise it were not touched"
  - "`constituentsOf` answers the empty set for `never` and nothing else in the refinement prover moved, so the add-a-key refusal that keeps the `partition` marker out is untouched"
  - "`conditional-clause` is a SIXTH category with its own schema key, not a widening of `type-selection`; both live rows fail that prover's downstream checks and absorbing them would weaken the discriminant proof fifty-plus entries rest on"
  - "The symbol-keyed transfer index covers only the three kinds recorded at an expression -- 1,459 of 131,137 edges, 130 ms -- because a declaration-name destination is already answered; indexing all of them was measured at 4.3 seconds and rejected on cost"
  - "Discriminant attribution credits only keys the expected literal actually names, which is narrower than the place rule it falls back from and is what keeps a sibling of the settled arm uncredited"
  - "The two `PluginRow` payload rows were left outstanding rather than reached by a fourth engine change: the chain breaks at a destructured binding, which is a distinct limit this plan does not own"
  - "The contracts fixtures now compile with `exactOptionalPropertyTypes`, matching the analysed tree, because an optional slot pinned `never` otherwise collapses to `undefined` and the acceptance would have passed before the change"

patterns-established:
  - "A refusal control is proved discriminating by writing the permissive variant of the prover and measuring which controls it breaks"
  - "An `extensions/` restatement carries a self-checking `@ts-expect-error` and mutual-assignability probe, whose own drift control is measured before the probe is removed"

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The contract engine's origin half resolves a key through the one arm of a contextual union that declares it, and refuses two"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin under a union contextual type resolves to the one arm that declares the key"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin whose key two arms of the contextual union declare is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an origin building a slot no arm of the contextual union declares is refused"
        status: pass
      - kind: other
        ref: "engine-alone delta with no entry written: 0 rows; after two accepted entries: exactly pi-api.ts:97:3 and :98:3"
        status: pass
    human_judgment: false
  - id: D2
    description: "An absence marker narrows the slot the rest of an intersection declares, and narrows nothing when that slot is already closed or absent"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an absence marker narrows the slot the rest of the intersection declares"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an absence marker over a slot the rest already closes narrows nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an absence marker for a slot the rest never declares is still an addition"
        status: pass
      - kind: other
        ref: "self-checking compiler probe: mutual assignability against the prior form plus six @ts-expect-error refusals, with a drift control that fails"
        status: pass
    human_judgment: false
  - id: D3
    description: "A conditional type's extends-clause member earns its own category, in two named forms, with five named refusals"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a clause member that narrows what the check type allows keeps its role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a clause member that binds an inference the branch reads keeps its role"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a conditional whose branches are the same type decides nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a clause testing a key the check type does not declare is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a second clause member that restates the check type narrows nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a type literal in no clause position is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a clause inference no branch reads is refused"
        status: pass
    human_judgment: false
  - id: D4
    description: "An external-output boundary is reached through a method shorthand and a nested payload, without relaxing the assertion guard, the external-source filter or the hop bound"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a method shorthand an installed declaration checks is a boundary"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a method shorthand no installed declaration checks is not a boundary"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#a same-spelled place with a different symbol does not carry an origin"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.contracts.test.ts#an arrival chain longer than the hop bound is refused, not answered partially"
        status: pass
      - kind: other
        ref: "both external-input entries re-validated and the assertion-reached necessity refusal re-run, because the widened helper is shared with them"
        status: pass
    human_judgment: false
  - id: D5
    description: "A whole-object comparison settles an ambiguous key only through a discriminant value that selects exactly one arm"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a discriminant value in the expected literal settles which arm supplied a key"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#an expected literal carrying no discriminant settles nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a discriminant value two arms carry settles nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a comparison of two test-built values settles nothing, however it is typed"
        status: pass
      - kind: other
        ref: "whole-tree delta: exactly the five predicted rows, every witness coordinate opened and read"
        status: pass
    human_judgment: false
  - id: D6
    description: "Production lineage reaches a factory-returned closure and nothing else, inside the cost budget"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a result a factory-returned closure produced carries production lineage"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a factory whose return is a name rather than a body adds no lineage"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a closure a test's own factory returned reaches no production body"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.operations.test.ts#a cycle in the backward search terminates and credits nothing"
        status: pass
      - kind: other
        ref: "/usr/bin/time -v: 83.85 s, 2.049 GiB, 3,030,520 steps against 100 s, 2.40 GiB, 6,000,000 -- the abort condition was evaluated and did not trip"
        status: pass
    human_judgment: false
  - id: D7
    description: "The whole gate is green and the record reconciles against a fresh analysis"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "npm run check -- exit 0, 6,501 unit assertions and 32 integration, all four fallow sub-gates"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7; negative suite 21/21 with the always-clean mutant rejected on report content"
        status: pass
      - kind: other
        ref: "aggregate production unit coverage from the unmodified coverage/unit.lcov -- 1833/1833 functions, 9049/9049 branches, 62940/62940 lines, 0 modules below"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1 with 16 problems, all unread, zero stale/missing/duplicate/incomplete/invalid"
        status: pass
    human_judgment: false

duration: 4h 20m
completed: 2026-09-16
---

# Phase 6 Plan 15: Closing the Five Measured Analyzer Gaps Summary

**Six analyzer corrections that take the live residual from 33 unread members to 16 without the engine becoming permissive once: every widened proof ships the counterexample that fails it, the four contract-layer changes each measured clearing exactly zero rows before any entry was written, and the two observation-model changes moved exactly the rows they were predicted to move and nothing else.**

## Performance

- **Duration:** 4h 20m
- **Tasks:** 7
- **Commits:** 13 (measured from `68c287d3`)
- **Files modified:** 9 (1 created, 8 modified)

## Predicted versus measured

This is the finding the plan exists to produce, so it is stated before anything else.

| Gap | Predicted | Measured | The rows that left `unread` |
| --- | --- | --- | --- |
| G4 origin union | 2 | **2** | `platform/pi-api.ts:97:3` `ResourcesDiscoverResult.skillPaths`; `:98:3` `.promptPaths` |
| G1 `never` as the empty set | 3 | **3** | `plugin/update-swap.ts:195:3` `DirectRenderableFailedOutcome.cause`; `:198:3` `.toVersion`; `plugin/update-preflight.ts:327:63` `StaticPreflightRowOptions.fromVersion` |
| G3 conditional clause | 2 | **2** | `edge/args-schema.ts:60:70` `ParsedCommandArgs.required`; `domain/components/hook-tool-names.ts:52:21` `PiToolName.toolName` |
| G5 external-output boundary | 6 | **4** | `edge/handlers/tools.ts:100:9` `marketplaces.name`; `:101:9` `.scope`; `:102:9` `.pluginCount`; `:103:9` `.source` |
| G2a union attribution | 5 | **5** | `marketplace/remove.ts:114:35` and `:129:7` `RemoveMarketplaceOutcome.name`; `persistence/migrate-config.ts:71:7`, `:76:7`, `:82:7` `MigrateFirstRunResult.reason` |
| G2b factory lineage | 1 | **1** | `bridges/hooks/stage.ts:227:3` `WriteHookConfigResult.written` |
| **Total** | **19** | **17** | 33 → **16** |

**Every measured row was predicted.** No row left `unread` that this plan did not name in advance, at any of the six measurement points. The shortfall is two rows, both named below with the engine's verbatim refusal and the mechanism measured behind it.

The two coordinates that differ from the plan's table (`update-swap.ts:188:3`/`:191:3` → `:195:3`/`:198:3`, and `update-preflight.ts:315:37` → `:327:63`) are the same members: the plan's coordinates were recorded before T2's restatements shifted them, and the plan itself required re-deriving them from the edited source.

### The two predicted rows that did not move

`edge/handlers/tools.ts:140:3` `PluginRow.marketplace` and `:141:3` `PluginRow.scope`. The engine's message, verbatim:

```
Invalid contract: extensions/pi-claude-marketplace/edge/handlers/tools.ts:140:3
  origin extensions/pi-claude-marketplace/edge/handlers/tools.ts:437:9
  never reaches boundary extensions/pi-claude-marketplace/edge/handlers/tools.ts:524:7
```

This refusal is **one half further in** than the boundary refusal 06-11 recorded: T4 proved the boundary, and the four sibling `marketplaces` slots in the same file are contracted by exactly that proof. What still stops these two was measured with a probe over the recorded transfer graph rather than inferred: **the flow walk records no transfer into a destructured binding.** `indexVariable` resolves `symbolOfName(declaration.name)`, which answers nothing for an `ObjectBindingPattern`, so `const { lines, rows } = rendered;` at `tools.ts:512:7` has no recorded edge at all — confirmed by enumerating every transfer whose destination lies on lines 470–515 of that file and finding one `initializer` and two `assignment` edges, none of them into the destructuring. The chain from `renderPluginPayload`'s own `rows` to the returned one is therefore broken.

That is a **fourth limit**, distinct from the three T4 closed, and outside this plan's declared scope. Neither the handler nor the payload was restructured to suit the prover. Both rows carry the corrected note in the record.

### The 16 that remain, and the mechanism behind each

| Rows | Member | Mechanism |
| --- | --- | --- |
| 2 | `edge/handlers/tools.ts:140:3`, `:141:3` `PluginRow.{marketplace,scope}` | Arrival broken at a destructured binding, measured above. Wants an engine plan that records what a destructuring receives. |
| 2 | `orchestrators/edge-deps.ts:58:3` `.plugins`, `:64:5` `.marketplaces` | Cross-boundary mirror; the legal collapse lands in an `edge/`-owned file. A product decision. |
| 1 | `plugin/info.messaging.ts:68:69` `PLUGIN_INFO_RENDER.status` | The selected-over type is a single variant, so the filter discriminates nothing. Re-submitted and still refused; the refusal is correct. |
| 1 | `plugin/shared.ts:129:5` `enableRowDependencies.signals.partition` | No left operand declares the slot, so every restatement adds a key. Explicitly out of scope, and a standing control in T2. |
| 1 | `orchestrators/types.ts:155:3` `UpdatePhaseFailure.msg` | A rollback-populated slot is behaviour; a recorded verdict, not an analyzer gap. |
| 2 | `domain/resolver-types.ts:19:7`, `:32:7` `DroppedHookSchema.matcher` | A compile-time schema proof has no contract category. Wants a new category, not a widening. |
| 2 | `domain/components/hook-if-targets.ts:55:3`, `:56:3` | Members of an interface that exists only as a `satisfies` constraint. Wants a new category. |
| 2 | `domain/components/hooks.ts:77:3`, `:79:3` | Under-credited AND load-bearing; the repair aliases a `bridges/hooks/if-field/` declaration another plan owns. |
| 2 | `platform/git-auth-callbacks.ts:41:39`, `:42:34` | D-32-05 is a recorded decision, not this plan's authority. |
| 1 | `platform/pi-api.ts:99:3` `ResourcesDiscoverResult.themePaths` | Never built anywhere, so no origin exists at all. G4 does not reach it, and no entry was drafted for it. |

## The permissiveness controls, and what they measured

### Engine-alone zero-delta, taken four times

A contract entry is opt-in, so a widening in the contract layer cannot move a row until an entry is written. Each of the four contract-layer tasks ran the analyzer with the engine changed and **no entry added**, and diffed by `(path, owner, key)` against the snapshot immediately before:

| Task | Engine-alone delta |
| --- | --- |
| T1 single-arm origin | **0 rows** |
| T2 `never` as the empty set | **0 rows** |
| T3 conditional-clause category | **0 rows** |
| T4 boundary, arrival and transfer index | **0 rows** |

Nothing moved at any of the four. Nothing had to be investigated.

### Permissive-mutant measurement

Two of the new refusals were proved discriminating by writing the permissive variant of the prover and measuring which controls it breaks. This is the measurement the plan's "a refusal that passes before the change has not measured anything" clause is really asking for: a refusal that the unchanged engine already makes cannot fail RED, but it can fail against a sloppier version of the change.

| Mutant | What broke |
| --- | --- |
| `propertySymbolOf` returning `found[0]` when `found.length >= 1` | `an origin whose key two arms of the contextual union declare is refused` — **the only control in the repository that catches it.** The 34-case flow suite stayed 34/34 green. |
| `armSettledBy` returning `arms[0]` when `arms.length >= 1` | `an expected literal carrying no discriminant settles nothing` and `a discriminant value two arms carry settles nothing` |

The first result is the strongest evidence this plan produced that the new controls earn their keep: the shared helper had been exercised by three flow-side controls for the whole wave, and none of them could tell a correct single-arm rule from a first-arm-wins one.

### Counterexamples that passed before the change, and why that is the point

Recorded rather than treated as defects, exactly as the plan directs:

| Control | Before | Why it is kept |
| --- | --- | --- |
| two-or-more-arms origin refusal (T1) | passed | The unchanged engine refuses every union; the control proves the change did not widen that, and the mutant above proves it discriminates. |
| no-arm origin refusal (T1) | passed | Same shape, other direction. |
| add-a-key refusal (T2) | passed | The guard proving `constituentsOf` did not weaken `widerSlotFor`, which is what keeps the `partition` marker refused. |
| `never` over `never` (T2) | passed | Zero against zero was false before and is still false. |
| method shorthand the contextual type does not declare (T4) | passed | Proves the widening reads the declared property, not any method. |
| all five discriminant counterexamples (T5) | passed | Two were predicted to; the other three bound a settlement that did not exist before. |
| sibling regression and all four lineage counterexamples (T6) | passed | The sibling's witness count is unchanged at **3**, read from the report before and after — not merely non-zero. |

## The six corrections

### G4 — the origin half could not see through a union (T1, tracer)

`originCandidates` asked `checker.getPropertyOfType` for a property of the contextual type directly, and the checker answers a union only when **every** arm declares the key. An `async` body annotated with a promise of its result contextually types its returned literal as that result beside a thenable of it, so every slot it built resolved to nothing. Re-measured with a compiler probe before a line was changed:

```
161:11 -> PropertyAssignment "skillPaths: [...discovered.skillPaths]"
   contextual of parent: ResourcesDiscoverResult | PromiseLike<ResourcesDiscoverResult>
   getPropertyOfType(skillPaths): undefined
   arms declaring skillPaths: 1 of 2
```

The flow walk had solved this once already. Its `propertySymbolOf` **moved** to the shared model leaf both modules already import, and the origin half now asks through it — one definition, not a copy. The three flow-side union-relay controls were not touched and stayed green.

### G1 — `never` counted as one constituent (T2)

06-12 read the cause out of the prover; this plan reproduced it with a probe under the tree's real compiler options before editing:

```
PinnedCause.cause:     refined=never (never=true) wider=Error       chosen=1 allowed=1 -> narrows=false
PinnedVersion.toVersion: refined=never            wider=string      chosen=1 allowed=1 -> narrows=false
PinnedMode.mode:       refined=never              wider="a" | "b"   chosen=1 allowed=2 -> narrows=true
PinnedGone.gone:       refined=never              wider=never       chosen=1 allowed=1 -> narrows=false
```

The union case already worked, which is the only shape a `never` pin could be proved against before. `constituentsOf` now answers the empty set for `never`: strictly smaller than any non-empty set and vacuously drawn from it, while `never` over `never` compares zero against zero and is still refused. **Nothing else in the refinement prover moved.**

The fixtures were also moved onto `exactOptionalPropertyTypes`, which is what the analysed tree compiles under. Without it an optional slot pinned `never` reads as `undefined` and the acceptance would have passed before the change — a non-discriminating control. All 51 pre-existing contract controls stayed green under the aligned option.

### G3 — a sixth category, not a widening (T3)

The two live rows are the same shape syntactically and **different** at the proof level, which a probe settled before the prover was designed:

```
args-schema.ts:60:70   checkType Entry, baseConstraint PositionalSpec<string>, declares required: boolean (optional)
                       clause writes `false` (LiteralType)            -> narrowing form
hook-tool-names.ts:52:21 checkType Event, baseConstraint undefined, declares toolName: false
                       clause writes `infer Name` (InferType)         -> extracting form
```

The second measurement is why the plan's single stated rule ("the check type, resolved through its constraint, must declare the member's key") could not cover both: an `infer` check type has no constraint at all. The category therefore admits **two named forms** and refuses every other clause shape by name — including a second clause member that merely restates what the check type already says, which is the shape that would otherwise make this a standing hole.

Both withdrawn `type-selection` drafts were re-submitted as the refusal-regression obligation and both are **still refused**, with the messages 06-11 and 06-12 recorded, byte for byte.

### G5 — three limits at the external boundary (T4)

All three were measured against current source before any was written.

1. **A method shorthand has no contextual signature.** `getContextualType` on a `MethodDeclaration` answers nothing even when the literal around it is checked against an installed declaration. The prover now reads the call signatures off the property the enclosing literal's contextual type declares. Every existing guard stays: `insideAssertion` still runs on the container, and a local contextual type still yields no external signature.
2. **Arrival could not descend into the returned literal.** It now looks one level into a returned object or array literal at a time — property initialisers, shorthand names, array elements, spreads — charging a hop per level, so the eight-hop bound means the same distance it meant before. A ten-alias chain is still refused rather than answered partially.
3. **The backward walk keyed on a declaration coordinate.** Measured: `recordTransfer(state, "container-write", node, receiver)` records `marketplaces.push({...})` at the **receiver expression** site, while `sourcesOf` looked up the **declaration name** site. Those edges are now also keyed by the symbol their destination stands for.

The index's scope was a measured cost decision, not a guess:

| Index | Build time | Symbols | Edges resolved |
| --- | --- | --- | --- |
| Every recorded transfer | 4,302 ms | 29,372 | 129,257 of 131,137 |
| Only the expression-destination kinds | **136 ms** | 1,136 | 1,459 of 131,137 |

A declaration-name destination is already answered by the existing site lookup, so indexing it a second time buys nothing and costs four seconds. Resolving the destination also needed the **innermost** node at a coordinate rather than the outermost one `nodeAt` answers — `rows` in `rows.push(row)` shares its start with the property access, the call and the statement — and a shorthand property needed `getShorthandAssignmentValueSymbol`, because its own symbol is the property, not the variable. Both were measured; the first version of the index resolved zero of 1,459 edges without them.

**The shared blast radius was re-verified, not assumed.** `externalCallSignatures` is shared with `assertLocalNecessity`: both accepted `external-input` entries still validate and the assertion-reached refusal control still refuses.

### G2a — a discriminant value settles which arm (T5)

Both sub-cases the earlier plans reported separately are one mechanism, and the correction is one concept: when the place rule leaves a key unsettled **and** the expected literal pins a discriminant to a single value that leaves exactly one arm standing, the value came from that arm. Two arms standing settle nothing; a literal pinning no discriminant settles nothing; and a key the comparison never names is not settled by it, which is narrower than the place rule it falls back from.

The production-lineage requirement, the single-arm rule and which operand is eligible were all left alone.

**The whole-tree delta was exactly the five predicted rows.** `runtimeObserved` did not move at all (2995 → 2995); `testOnlyObserved` rose by exactly five. Every witness was opened and read:

| Member | Witness | What is there |
| --- | --- | --- |
| `remove.ts:114:35` (`removed` arm) | `remove.test.ts:563:26`, `:596:26` | `assert.deepStrictEqual(outcome, { status: "removed", name: …, unstaged: [] })` |
| `remove.ts:129:7` (`partial` arm) | `remove.test.ts:1439:26` | `assert.deepStrictEqual(outcome, { status: "partial", name: …, … })` |
| `migrate-config.ts:71:7` | `migrate-config.test.ts:230:26`, `:299:26` | `{ migrated: false, reason: "existing-valid", … }` |
| `migrate-config.ts:76:7` | `:250:26` | `{ migrated: false, reason: "existing-invalid", … }` |
| `migrate-config.ts:82:7` | `:269:26` | `{ migrated: false, reason: "empty-state", … }` |

Each arm is credited by the comparison that names it, and by no other. The `remove` rows land `test-only-observed` rather than `runtime-observed`, which is the honest classification: the reads are test assertions.

### G2b — lineage through a factory-returned closure (T6)

A closure a factory returns has no declaration of its own for a call to resolve to. The expansion now follows such a name to the factory call and on to the function that call returns, **and only that**. The depth bound, the memoisation and the budget line are untouched.

Exactly one row moved, and the sibling's witness count is unchanged at 3 — read from the report on both sides, not merely checked for being non-zero. `WriteHookConfigResult.written` now carries **nine** `deep-comparison` witnesses, which are precisely the nine sites 06-09 counted by hand: `stage.test.ts:121, 150, 183, 226, 724, 758, 759` and `index.test.ts:204, 205`. Three of them were opened and read.

**The abort condition was evaluated against a real measurement and did not trip:** 83.85 s, 2.049 GiB, 3,030,520 steps, a +0.78 percent step cost. The change was kept on that measurement.

## The two restatements: kept, and proved behaviour-neutral

This plan's only `extensions/` edit, permitted only because the engine correction landed first. 06-12 built both, measured them clearing zero rows, and reverted them; the engine can see them now.

`DirectRenderableFailedOutcome` became an intersection of the source outcome with the marker literal instead of an interface extending an `Omit` of the same five keys. `StaticPreflightRowOptions` distributed over its two arms with the version slot hoisted onto a named `StaticPreflightRowBase`.

Neither was kept on inspection. Each carried a **self-checking** compiler probe, written, run, and then deleted:

- A `Same<Prior, Current>` mutual-assignability assertion against the exact prior declaration. Both held.
- Six `@ts-expect-error` refusals on the swap type (a cause, a from-version, a to-version, phase failures, a wrong discriminant, and omitted reasons) and two on the preflight type (a version on a failed row, a wrong discriminant). `@ts-expect-error` on a line that does not error is itself an error, so `npm run typecheck` exiting 0 is the proof that **all eight still fire**.
- A drift control for each equivalence assertion: changing one slot of the prior form makes typecheck fail with `Type 'true' is not assignable to type 'false'`. Measured both times, so the assertions are not vacuous.

No producer gained an obligation: `npm run typecheck` is exit 0 and the plugin suites are 1,433/1,433 with no test edited.

The restatement relocated four members from `StaticPreflightRowOptions` to `StaticPreflightRowBase`. All four were `runtime-observed` before and after, the candidate total held at 3,352, and **zero findings were gained** — the accounting is in the T2 delta below.

## Contract drafts: 11 accepted, 2 refused, 2 re-submitted refusals held

Every entry was submitted to the real engine against the real program, one at a time, with every coordinate derived from the compiler's view of the current syntax. Nothing the engine refused was written.

| Draft | Category | Outcome |
| --- | --- | --- |
| `pi-api.ts:97:3` `skillPaths` | external-output | **ACCEPTED** |
| `pi-api.ts:98:3` `promptPaths` | external-output | **ACCEPTED** |
| `update-swap.ts:195:3` `cause` | type-refinement | **ACCEPTED** |
| `update-swap.ts:198:3` `toVersion` | type-refinement | **ACCEPTED** |
| `update-preflight.ts:327:63` `fromVersion` | type-refinement | **ACCEPTED** |
| `args-schema.ts:60:70` `required` | conditional-clause | **ACCEPTED** |
| `hook-tool-names.ts:52:21` `toolName` | conditional-clause | **ACCEPTED** |
| `tools.ts:100:9` `marketplaces.name` | external-output | **ACCEPTED** |
| `tools.ts:101:9` `.scope` | external-output | **ACCEPTED** |
| `tools.ts:102:9` `.pluginCount` | external-output | **ACCEPTED** |
| `tools.ts:103:9` `.source` | external-output | **ACCEPTED** |
| `tools.ts:140:3` `PluginRow.marketplace` | external-output | **REFUSED** (quoted above) |
| `tools.ts:141:3` `PluginRow.scope` | external-output | **REFUSED** (same limit) |
| `args-schema.ts:60:70` `required` | type-selection | **STILL REFUSED**, re-submitted |
| `info.messaging.ts:68:69` `status` | type-selection | **STILL REFUSED**, re-submitted |

No entry was drafted for `themePaths`: nothing builds it, it has no origin, and an entry for it would have been the first sign the proof had gone soft.

The two re-submitted refusals, verbatim:

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

Contract count: **90 → 101**. Every one of the 90 pre-existing entries still validates — the run exits 1 with member findings, not 2.

## The measured series

```
33 unread -> 31 (T1) -> 28 (T2) -> 26 (T3) -> 22 (T4) -> 17 (T5) -> 16 (T6)
contracts 90 -> 101    candidates 3352 (unchanged)    unsupported 0
runtime-observed 2995 (unchanged throughout)    test-only 234 -> 240
```

| Snapshot | Unread | Contracts | Wall | Peak RSS | Transfer steps |
| --- | --- | --- | --- | --- | --- |
| baseline | 33 | 90 | 81.4 s | 2.111 GiB | 3,002,713 |
| T1 | 31 | 92 | 79.4 s | 2.088 GiB | 3,003,473 |
| T2 | 28 | 95 | 82.0 s | 2.046 GiB | 3,004,151 |
| T3 | 26 | 97 | 81.4 s | 2.044 GiB | 3,005,517 |
| T4 | 22 | 101 | 81.3 s | 2.054 GiB | 3,006,540 |
| T5 | 17 | 101 | 82.8 s | 2.052 GiB | 3,007,193 |
| T6 | 16 | 101 | **83.9 s** | **2.049 GiB** | **3,030,520** |
| **Budget** | | | **100 s** | **2.40 GiB** | **6,000,000** |

Every run is inside the budget with room, and no adopted cap was raised. The whole plan cost **+2.5 s wall, −0.06 GiB peak, +0.9 percent transfer steps** against the inherited baseline; T6 alone accounts for 23,327 of the 27,807 added steps. The 12,000,000-step adopted cap was not touched and both budget-exhaustion controls still fail rather than reporting clean.

### The T2 restatement delta, in full

The only non-contract structural movement in the plan, named rather than absorbed:

| Key | Before | After |
| --- | --- | --- |
| `StaticPreflightRowBase.{plugin,notes,reason,fromVersion}` | absent | runtime-observed (×4) |
| `StaticPreflightRowOptions.{plugin,notes,reason}` | runtime-observed | absent |
| `StaticPreflightRowOptions.fromVersion` | runtime-observed, unread | explicit-contract |

Four declarations relocated, every one credited on both sides; the candidate total is unchanged and no finding was gained.

## Verification

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | after every slice |
| `npm run lint` | 0 | after every slice |
| `npm run fallow` | 0 | all four sub-gates |
| `npm run format:check` | 0 | |
| `node --test` contracts suite | 0 | **67/67** (48 inherited + 19 added) |
| `node --test` operations suite | 0 | **44/44** (33 inherited + 11 added) |
| `node --test` live + flow + model suites | 0 | 60/60, 34/34, unchanged and untouched |
| `node --test "tests/orchestrators/plugin/*.test.ts"` + NFR-5 | 0 | 1,433/1,433 |
| `node --test "tests/edge/handlers/**"` + pi-api | 0 | 420/420 |
| `node --test "tests/bridges/hooks/**"` | 0 | 557/557 |
| `node --test tests/architecture/unused-type-member-gate.test.ts` | 0 | 4/4 |
| `node --test` negative-runner suite | 0 | **21/21** |
| `node scripts/check-unused-type-members.negative.mjs` | 0 | **7 of 7** |
| `npm run check` | 0 | 6,501 unit assertions, 32 integration, 0 fail |
| `npm run test:coverage:unit` | 0 | see below |
| `npm run test:coverage:direct:all` | 0 | 236 pairs in 472.8 s; **2 pinned shortfalls matched exactly** |
| `node scripts/check-unused-type-members.mjs --json` | 1 | 16 findings, 0 unsupported, 101 validated contracts |
| `node scripts/check-unused-type-members.audit.mjs --check` | 1 | 16 problems, all `unread` |
| `SKIP=trufflehog pre-commit run --files …` | 0 | clean before each of the 13 commits |

Every suite ran under a hermetic `HOME`; no `PI_CODING_AGENT_DIR` was shared.

### The always-clean mutant is still rejected on content

The control that matters most to this plan, because a permissive engine is exactly what it guards against:

```
test("rejects a gate that always reports a clean tree", …)
  assert.match(run.stderr, /offender-plant: the overlay finding set is missing .*:31:3/);
```

It discriminates on what the report **says**, not on the exit status. It still fails the mutant.

### Coverage

Read from the unmodified native `coverage/unit.lcov`, aggregated over the 227 `extensions/pi-claude-marketplace/` modules:

```
functions 1833/1833   branches 9049/9049   lines 62940/62940
modules below 100%: 0
```

Functions and branches are byte-identical to the inherited figures. Lines moved 62,922 → 62,940, and the cause is named and reconciled rather than absorbed: `git diff --numstat` over `extensions/` reports 31 added and 13 deleted physical lines across the two restated declarations, **net +18** — exactly the coverage movement. No threshold was lowered, no source excluded, no pin updated.

## Task commits

1. **T1 (tracer)** — `bcd5c9aa` (test), `631d1e9e` (feat)
2. **T2** — `0832be44` (test), `9981913a` (feat)
3. **T3** — `15400410` (test), `8d9fec2e` (feat)
4. **T4** — `024707cd` (test), `d3ef56da` (feat)
5. **T5** — `80c4f071` (test), `990993d7` (feat)
6. **T6** — `79159e5d` (test), `18b9b3e5` (feat)
7. **T7** — `18756173` (docs)

## Assertion and coverage ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-15-T1 | Helper MOVED to the shared leaf, not copied; the three flow-side union controls unmodified and green; both counterexamples measured (they refuse before and after, and the two-arm one is the sole control that breaks the first-arm-wins mutant); engine-alone delta 0; exactly two rows moved on two accepted entries; `themePaths` gained nothing. | contracts 51/51, flow+model+live 60/60, analyzer exit 1 with 92 contracts; 79.4 s / 2.088 GiB / 3,003,473 steps. |
| 06-15-T2 | Only `constituentsOf` moved; the add-a-key counterexample passed before and still passes; `partition` still `unread`; both restatements probed behaviour-neutral by mutual assignability plus eight `@ts-expect-error` refusals, each with a measured drift control; every contract coordinate in both edited files re-derived and re-accepted; exactly three rows moved. | contracts 54/54, plugin suites + NFR-5 1,433/1,433, typecheck 0; 82.0 s / 2.046 GiB / 3,004,151 steps. |
| 06-15-T3 | Sixth category with a category-scoped `clause` key, two named clause forms measured by probe, and six named refusals — all eight controls failed before the change; both withdrawn `type-selection` drafts still refused with verbatim messages; engine-alone delta 0; exactly two rows moved. | contracts 62/62, gate architecture test 4/4, analyzer exit 1 with 97 contracts; 81.4 s / 2.044 GiB / 3,005,517 steps. |
| 06-15-T4 | Three sub-changes, five controls, three of which failed before; assertion guard, external-source filter and hop bound unchanged; a same-spelled place with a different symbol does not connect; both `external-input` entries and the assertion-reached refusal re-verified; index scope chosen on a measurement (136 ms vs 4,302 ms); four of six rows moved, both refusals recorded verbatim, every accepted origin and boundary opened and read. | contracts 67/67, edge handlers + pi-api 420/420; 81.3 s / 2.054 GiB / 3,006,540 steps. |
| 06-15-T5 | Settlement fires only on exactly one arm; the no-discriminant and non-lineage counterexamples passed before, and two of the five break the first-arm-wins mutant; single-arm rule and lineage requirement untouched; whole-tree delta exactly the five predicted rows with `runtimeObserved` unmoved; all five witness coordinates opened and read. | operations 39/39, live+flow 44/44; 82.8 s / 2.052 GiB / 3,007,193 steps. |
| 06-15-T6 | Lineage reaches production through a factory-returned closure and nothing else; four counterexamples and the sibling regression are controls, all passing before; the sibling's witness count unchanged at 3, read from the report both sides; exactly one row moved with nine witnesses matching 06-09's hand count; the abort condition evaluated against a real measurement and not tripped. | operations 44/44, live+flow 44/44, hooks bridge 557/557; 83.9 s / 2.049 GiB / 3,030,520 steps (+0.78 %). |
| 06-15-T7 | Predicted-versus-measured table with every moved row named; witnesses spot-checked across all six corrections; 101 entries validate including all 90 pre-existing; every recorded refusal still refuses; negative controls 7/7 and the runner suite 21/21 with the always-clean mutant rejected on report content. | `npm run check` exit 0; native aggregate production unit coverage 1833/1833 functions, 9049/9049 branches, 62940/62940 lines, 0 below; both direct pins matched exactly; final cost recorded against the budget. |

## Deviations from Plan

**1. [Rule 3 - Blocking] A refusal the unchanged engine already makes cannot fail RED, so it was proved discriminating by a mutant instead**

- **Found during:** Task 1
- **Issue:** The plan says a counterexample that passes before the change "is not discriminating and must be re-derived". For the two-or-more-arms origin refusal this is unachievable by construction: before the change the engine refuses **every** union origin, so any union-shaped refusal control passes. Re-deriving it cannot change that.
- **Fix:** Wrote the permissive variant of the change (`found.length >= 1`), ran the whole repository's gate suites against it, and measured which controls break. The new control is the only one anywhere that catches it — the 34-case flow suite stays green. The measurement is recorded above and the same method was applied to T5.
- **Files modified:** none beyond the task's own
- **Committed in:** `bcd5c9aa`, `631d1e9e`

**2. [Rule 3 - Blocking] The fixture compiler options did not match the analysed tree**

- **Found during:** Task 2
- **Issue:** The contracts fixtures compiled without `exactOptionalPropertyTypes`, which the analysed tree uses. Under the weaker option an optional slot pinned `never` reads as `undefined` and already "narrows" `Error | undefined`, so the T2 acceptance would have passed before the change and measured nothing.
- **Fix:** Added the option to `fixtureTsconfig` and re-ran the suite before adding a single new case: 51/51 unchanged. The fixtures now prove the engine under the same configuration the 101 live entries are validated under, which is strictly better than what was there.
- **Files modified:** `tests/scripts/check-unused-type-members.contracts.test.ts`
- **Committed in:** `0832be44`

**3. [Rule 2 - Missing critical] The conditional-clause category needed a second admitted form**

- **Found during:** Task 3
- **Issue:** The plan states one rule — the check type, resolved through its constraint, must declare the member's key. A compiler probe measured that `PiToolName`'s check type is an `infer` parameter whose base constraint is `undefined`, so that rule refuses the very row the task exists to clear.
- **Fix:** Admitted two named forms instead of one — narrowing (the check type or its constraint declares the key and the clause admits strictly less) and extracting (the clause binds an inference a branch reads) — and refused every other clause shape by name, including an inference no branch reads. Six refusals, not the five the plan listed.
- **Files modified:** `scripts/check-unused-type-members.contracts.mjs`
- **Committed in:** `8d9fec2e`

**4. [Rule 3 - Blocking] The symbol index was scoped on a cost measurement**

- **Found during:** Task 4
- **Issue:** The plan asks for "the recorded transfers" indexed by destination symbol, built in one pass. Measured over the real tree that is 4,302 ms — five percent of the run's entire wall budget — because resolving a coordinate to a symbol needs an AST descent per edge.
- **Fix:** Indexed only the three kinds recorded at an expression (`container-write`, `map-value`, `assignment`), which is the whole gap: a declaration-name destination is already answered by the existing site lookup. 1,459 of 131,137 edges, 136 ms, and every one of them resolved. Both numbers are recorded in the module header beside the index.
- **Files modified:** `scripts/check-unused-type-members.contracts.mjs`
- **Committed in:** `d3ef56da`

**5. [Rule 3 - Blocking] `factoryReturnedBodies` breached fallow's cognitive ceiling**

- **Found during:** Task 6
- **Issue:** The first version scored 16 against fallow's `maxCognitive: 15` while ESLint's independently-computed `sonarjs/cognitive-complexity: 15` passed it — the two-gate disagreement `CONVENTIONS.md` documents.
- **Fix:** Split the nested loops into `factoryCallOf` and `bodiesReturnedBy`. No `thresholdOverrides` entry was added; the file still has none. The whole-tree delta was re-measured after the split and is byte-identical.
- **Files modified:** `scripts/check-unused-type-members.flow.mjs`
- **Committed in:** `18b9b3e5`

### Documented scope choices

**6. The T5 and T6 controls were written in `operations.test.ts`, not `live.test.ts`.** Both are in the plan's declared file set for T5. A deep-comparison control needs a production file **and** a spec file that observes it, plus the ambient `node:assert/strict` declaration that makes a comparison recognisable; only `operations.test.ts` has that harness. Copying it into `live.test.ts` would have violated this plan's own "one definition, never a copy" obligation and would very likely have tripped `fallow dupes` at its three-line threshold. The controls sit beside the existing deep-comparison controls, which is where they belong.

**7. Two commits per task where `tdd="true"`.** The plan asks for one commit per task; the TDD contract asks for a failing `test(...)` commit followed by `feat(...)`. 06-03 resolved the same conflict the same way in this phase, and the RED evidence is what this plan's governing risk depends on, so the evidentiary shape won.

**8. Commit messages carry no plan scope.** `CLAUDE.md` forbids milestone and phase identifiers in commit subjects and bodies and takes precedence over the GSD `{type}({phase}-{plan})` convention, exactly as in 06-03 and 06-12.

**9. `pre-commit` was run with `SKIP=trufflehog`,** as `CLAUDE.md` prescribes for this checkout. Every other hook ran and passed before each of the 13 commits. `--no-verify` was never used.

---

**Total deviations:** 5 auto-fixed (4 blocking, 1 missing-critical) and 4 documented scope or convention choices.
**Impact on plan:** No gate was weakened. No threshold, suppression, coverage exclusion, census pin or adopted budget cap was changed. Two of the plan's nineteen predicted rows did not move, both recorded with the engine's verbatim message and the mechanism measured behind them. Nothing moved that was not predicted.

## Known Stubs

None. Every row this plan leaves outstanding carries a written, source-checkable mechanism in `06-LIVE-TRIAGE.md`, and none of them is a placeholder for work this plan chose not to finish: two are a distinct engine limit, six want new evidence categories, four are product or cross-owner decisions, three are recorded verdicts, and one has no origin to contract because nothing builds it.

## Observed Limits

Each is a refusal with a named message, not a silent acceptance.

- **A destructured binding receives no recorded transfer.** `indexVariable` bails on an `ObjectBindingPattern`, so a value that passes through `const { a, b } = c;` breaks a backward arrival walk. This is what still refuses the two `PluginRow` rows; it is the one limit this plan measured and deliberately did not close.
- **A `conditional-clause` extracting form does not check that the check type declares the key.** An `infer` check type has no constraint to ask, and the clause is itself what discovers whether the key is there. The form is bounded instead by requiring a branch to read the name the inference bound.
- **The symbol-keyed index covers expression destinations only.** A transfer recorded at a declaration name is answered by the existing site lookup; nothing else is indexed, on a measured cost basis.
- **Lineage follows a factory only to a function written in the factory's own body.** A factory that returns a name, or a const bound to anything but a call, reaches nothing. Under-crediting, by design.
- **Arrival descends one level per hop.** A payload nested deeper than the remaining hop budget refuses rather than answering partially.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at a trust boundary. Every threat in the plan's own register was mitigated as written: T-06-15-01 by the five counterexample sets, the four engine-alone zero-delta measurements and the two mutant measurements; T-06-15-02 by opening and reading every witness and evidence coordinate; T-06-15-03 by re-submitting all four withdrawn drafts and recording that each is still refused; T-06-15-04 by the per-task `/usr/bin/time -v` series above and by leaving both adopted caps untouched; T-06-15-05 by re-deriving every contract coordinate in both edited files from the edited source and requiring exit 1; T-06-15-06 by the self-checking equivalence and refusal probes, each with its own measured drift control.

## Issues Encountered

- **One recorded cost, carried forward not solved.** Two of the 101 entries name coordinates inside `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`. A peer upgrade that moves those lines refuses them by name and the gate exits 2. That fails safe, and it is noted here rather than worked around.
- **The deep-comparison model credits a key once per union arm that spells it.** `Outcome.name` gains two identical witnesses at the same site and `status` gains three — pre-existing behaviour, visible in the model before this plan and unchanged by it. Recorded in the new controls' comments rather than fixed, because dedupe belongs to whoever owns that model next.
- **The plan's row coordinates for `update-swap.ts` and `update-preflight.ts` were stale by design.** They were recorded before T2's own restatements shifted them. Every one was re-derived from the edited source; none was computed by arithmetic on an old value, and the drift control did not fire.

## Next Phase Readiness

**06-08's activation prerequisite, stated honestly: the residual is 16, not zero.** The mandatory gate cannot be activated without either closing those 16 or accepting them, and this plan does not have the authority to do the second. What has changed is that the remaining population is now smaller than the number of distinct causes behind it, and every cause is named:

- **2 rows want one more bounded engine change** — recording the transfer a destructuring binding receives. That change would clear both `PluginRow` rows through the proof T4 already landed.
- **6 rows want two new evidence categories** — a `satisfies`-constraint category (4 rows across `hook-if-targets.ts` and `hooks.ts`) and a schema-proof category (2 rows on `DroppedHookSchema`). Both are the same shape of work T3 did here, and T3's structure is the template.
- **5 rows are product or ownership decisions**, not analyzer gaps: the two `edge-deps.ts` mirror halves, the `partition` marker, the `UpdatePhaseFailure.msg` rollback slot and the `info.messaging.ts` filter whose refusal is correct.
- **2 rows are a recorded decision** (D-32-05) nobody below the operator may revoke.
- **1 row has no origin at all** — `themePaths` is never built, so no category can reach it and none should appear to.

The engine is measurably no more permissive than it was: four widenings were shown to clear zero rows on their own, two observation-model changes moved exactly their predicted rows, three new refusals break a permissive prover that no existing control could catch, and the seven negative controls still reject an always-passing gate on report content.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-16*

## Self-Check: PASSED

All nine files listed in `key-files` exist on disk, and all 13 commits are present
in `git log` between `68c287d3` and `HEAD`. Every `<verify>` command in the plan
was run in the foreground with its exit status captured directly, never through a
pipe whose status belongs to `tail`. The measured commit count from the plan
ledger is `git rev-list --count 68c287d3..HEAD` = 13, matching the list above.

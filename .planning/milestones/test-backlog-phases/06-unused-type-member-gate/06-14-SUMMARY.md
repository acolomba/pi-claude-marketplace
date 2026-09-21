---
phase: 06-unused-type-member-gate
plan: "14"
subsystem: testing
tags: [typescript, static-analysis, shared, contracts, dead-code, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable member gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The closed triage, the validated-contract engine and the recorded dispositions
  - phase: 06-unused-type-member-gate
    provides: The seven executable negative controls the repairs must not disturb
  - phase: 06-unused-type-member-gate
    provides: The 113-row live baseline 06-09 left behind
provides:
  - "`ErrorOptions` annotations on the two bridge error classes that hand-mirrored it"
  - "`PluginCoordinate`: one declaration for the (marketplace, plugin) pair that was spelled three times in `shared/errors-bridges.ts`"
  - "`Phase3Failure` without its surplus per-entry `cause` slot, removed on measured evidence that every production read resolves to `UpdatePhase3Failure.cause`"
  - "Bounded message parameters on `CommandContext`, `dispatchRow` and the reconcile emitter, making three `Extract` filters selections over the union they really choose within"
  - "A fallback severity write typed off the row's own declared slot through a mapped view"
  - "`isDescriptionBearingRow` narrowing by the status discriminant, with the status set read back off the runtime map"
  - "Four contract entries the real engine accepted, and one measured refusal recorded rather than accommodated"
  - "A measured 113 -> 103 live population: all 10 `shared`-owner rows cleared, zero findings gained"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `90d45a1f`, reconciling with 103 problems that are ALL `unread`"
affects: [06-10, 06-11, 06-12, 06-13, 06-08]

actuals:
  tokens: 155914
  tasks: 4
  commits: 4
plan_head_before: 8dde3b56d73b39dff20d2226c588c66ba0ab0fad

tech-stack:
  added: []
  patterns:
    - "A repeated inline shape collapses to one named exported interface so the surviving declaration is the one production already reads"
    - "A local mirror of an ambient options bag is replaced by the ambient type, not deleted"
    - "An open type parameter under an `Extract` filter is bounded by the union the filter selects within, which is what turns a nothing-proof into a selection the engine accepts"
    - "A write to a readonly slot goes through a mapped view over the target's own declared field; a mapped type declares no members, so the write mints no candidate"
    - "A presence-based type predicate is re-expressed over the discriminant its runtime map already keys on, and the status set is derived from that map so the two cannot drift"
    - "A contract draft is run against the real engine before it is kept; a refusal is recorded with its reason, never absorbed by widening the proof"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/errors-bridges.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - tests/shared/errors-bridges.test.ts
    - tests/shared/errors.test.ts
    - tests/shared/notify-context.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - scripts/check-unused-type-members.contracts.json
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "`AgentOwnershipConflictError.stagingFor` was NOT deleted. The triage offered dropping the frozen copy, but `tests/shared/errors-bridges.test.ts` asserts the copy AND its freeze against post-construction mutation, and `tests/bridges/agents/stage.test.ts:826` reads it. The real defect was duplication -- the same two members were declared three times in one file -- so all three now name `PluginCoordinate`."
  - "`Phase3Failure.cause` removed. Measured: its three siblings (`phase`, `msg`, `cleanupFailures`) each carry production `property-access` witnesses reaching them THROUGH `Omit<Phase3Failure, \"cause\">`, while `cause` -- the one member that `Omit` removes -- carries none. So the model reaches this declaration and the slot genuinely has no production reader; this is not an analyzer under-credit."
  - "R8's planned repair was REFUSED by the engine and was not accommodated. The `type-refinement` draft failed with `refines ... does not narrow status`: a type parameter is not one of the union's constituents, so the prover cannot see it narrow anything. The bound was re-expressed as `Extract<PluginNotificationMessage, { status: Status }>` -- a selection the engine accepts -- rather than taking the plan's second option of dropping the constraint."
  - "The `Omit<Phase3Failure, \"cause\">` at `orchestrators/plugin/update-swap.ts:177` is now vestigial. NOT edited here: that file is claimed this wave by 06-10 and its rows are owned by 06-12. Handed off below."
  - "No analyzer under-credit of the 06-09 kind was found in this owner group. Every row either had a genuinely empty reader set in production or became a proof the engine validated."

patterns-established:
  - "Contract-coordinate safety confirmed before editing: the only validated entry in any file this plan edits sits at `notification-grammar.ts:837:7`, and every edit in that file is at line 1503 or below."
  - "A type-equivalence claim ships with a both-directions assignability control that was exercised against two counterexamples, not with a green suite."
  - "A constraint swap ships with a control measured under the old bound (still fails), the new bound (still fails) and no bound (stops failing), so 'nothing was dropped' is measured rather than argued."

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The two locally mirrored options bags take the ambient ErrorOptions annotation, all seven construction and catch sites are unchanged, and rows R3 and R4 leave the unread set"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/shared/errors-bridges.test.ts tests/bridges/commands/stage.test.ts tests/bridges/commands/discover.test.ts (57/57)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- 113 -> 111, exactly errors-bridges.ts:65:44 and :85:68 lost, zero gained"
        status: pass
    human_judgment: false
  - id: D2
    description: "One named PluginCoordinate is declared once and read by production, the surplus Phase3Failure.cause slot is gone with its consequence proved, and rows R1, R2 and R5 leave the unread set"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/shared/errors-bridges.test.ts tests/shared/errors.test.ts tests/bridges/agents/stage.test.ts tests/orchestrators/plugin/update-flow.test.ts (291/291)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- 111 -> 108, exactly errors-bridges.ts:27:26, :27:56 and errors.ts:501:3 lost, zero gained"
        status: pass
      - kind: other
        ref: "check-unused-type-members.mjs --json -- Phase3Failure.{phase,msg,cleanupFailures} carry 4/2/2 production witnesses through the Omit; .cause carries 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The command-context filters carry a bound the engine proves, the severity write is checked against the real declaration, and rows R7 through R10 leave the unread set"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/shared/notify-context.test.ts tests/shared/notification-dispatch.test.ts tests/orchestrators/reconcile/reconcile.messaging.test.ts tests/orchestrators/plugin/shared.test.ts (303/303)"
        status: pass
      - kind: unit
        ref: "node --test tests/scripts/check-unused-type-members.contracts.test.ts (48/48)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- 108 -> 107 (R10, no entry) then 107 -> 104 with three accepted entries; zero gained at both points"
        status: pass
      - kind: other
        ref: "npm run typecheck -- all 21 CommandContext instantiations across 16 orchestrator files unchanged and green"
        status: pass
    human_judgment: false
  - id: D4
    description: "The description predicate narrows by its real discriminant with an exercised equivalence control, and row R6 leaves the unread set"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/shared/notification-grammar.test.ts tests/shared/notification-types.test.ts (102/102)"
        status: pass
      - kind: other
        ref: "npm run typecheck -- the MutuallyAssignable control errors TS1360 when a status is dropped from, or added to, the by-status spelling"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- 104 -> 103, exactly notification-grammar.ts:1534:46 lost, zero gained"
        status: pass
    human_judgment: false
  - id: D5
    description: "The shared owner group reports one unread row and it is the one attributed to 06-10, measured from a fresh analysis and a regenerated record"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "the plan's own assertion over --json: exactly one /shared/ finding, shared/fs-utils.ts:225:32 RollbackReplacementInput.renamed.from"
        status: pass
      - kind: other
        ref: "06-LIVE-TRIAGE.md population table -- shared row unread 1 (was 11), explicit-contract 8 (was 4)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1, 103 problems, 103 of 103 kind `unread`"
        status: pass
    human_judgment: false
  - id: D6
    description: "The quality chain, the coverage obligation and the negative controls are unchanged by the repairs"
    verification:
      - kind: other
        ref: "npm run check (exit 0)"
        status: pass
      - kind: other
        ref: "coverage/unit.lcov over extensions/ -- 227 modules, functions 1834/1834, branches 9050/9050, lines 62919/62919, zero modules below 100%"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -- exit 0, 236 pairs in 482.8s, 2 pinned shortfalls matched scripts/test-coverage-direct.pin.json exactly; the pin file is byte-identical"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7 ok, exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Two dispositions the triage recorded were judged unsafe to follow as written, and the evidence for each is recorded"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "See Judgment calls -- stagingFor kept and de-duplicated; the R8 refinement draft refused by the engine and replaced by a selection"
        status: pass
    human_judgment: true
    rationale: "Departing from a recorded disposition is an owner judgment. The measurements below are mechanical, but the decision to keep a tested field and to take a third repair shape for R8 wants a human to agree."

duration: 97 min
completed: 2026-09-15
---

# Phase 06 Plan 14: shared Member Repairs Summary

**All ten `shared`-owner unread members cleared -- two ambient-options mirrors swapped for `ErrorOptions`, one coordinate shape collapsed from three declarations to one, one surplus aggregate slot removed on measured evidence, three open type parameters bounded into real selections, one cast literal replaced by a mapped view and one presence filter re-expressed over its discriminant -- taking the live population from a measured 113 to 103 with zero findings gained, leaving exactly one `shared/` row standing and it is 06-10's.**

## Performance

- **Duration:** 97 min
- **Started:** 2026-09-15T22:03:00Z
- **Completed:** 2026-09-15T23:40:00Z
- **Tasks:** 4 of 4
- **Files modified:** 11 (4 production, 5 test, 1 contract file, 1 record)

## Accomplishments

- **The two options mirrors take the ambient type.** `BridgeStagingError` and `CommandNameError` each hand-wrote `{ cause?: unknown }`, which is structurally the `ErrorOptions` five classes in `shared/errors.ts` already annotate. The swap touched no construction site: the three `BridgeStagingError` sites behind `contextualStagingError` and the four `CommandNameError` sites in `bridges/commands/discover.ts` -- including the `instanceof` narrowing and `badNameWarning`'s read of the error's own typed fields -- are unchanged and green.
- **One coordinate, declared once.** `{ marketplace, plugin }` was spelled three times in `shared/errors-bridges.ts`. `PluginCoordinate` now names it, and the conflict's `owner` slot, the error's public `stagingFor` field and the constructor parameter all point at it. The frozen copy, its freeze assertion, the refusal-message bytes and every public field are untouched; the suite case that mutates its own object after handing it over still compiles against the now-`readonly` parameter.
- **The surplus phase-3 slot is gone, on evidence.** `Phase3Failure.cause` had no production reader: `update-swap.ts` restates the slot as a required `Error` in `UpdatePhase3Failure`, and `update-flow.ts`'s `rollbackPartialCauseSlot` -- the only production read of an originating error -- resolves there.
- **Three filters became real selections.** `CommandContext`, `dispatchRow` and the reconcile emitter each ran an `Extract` filter over an unbounded type parameter, which stands for everything and discriminates nothing. Bounding the parameter by `PluginNotificationMessage` made each one a selection over the union it really chooses within. All 21 instantiations across 16 orchestrator files type-check unchanged; no file outside this owner was edited.
- **The severity write has a declared home.** `(p as { severity?: "error" })` minted a one-member shape at the write site. The write now goes through `{ -readonly [K in "severity"]?: PluginNotificationMessage[K] }`, so the compiler checks it against the row's own declared slot. The guard, the frozen-row degradation and the fallback bytes are unchanged, and the mapped type declares no members of its own.
- **The description predicate narrows by its discriminant.** `Extract<PluginNotificationMessage, { description?: string }>` cannot tell the variants apart the way the proof requires. It now selects on `status`, and the status set is read back off `DESCRIPTION_BEARING_STATUS` so the narrowing and the runtime decision come from one place. The map stays total over the status union.

## Task Commits

1. **Task 1 (tracer): Conform the two mirrored options bags to the ambient house pattern** - `4daa84aa` (refactor)
2. **Task 2: Retire the two surplus declarations in the error modules** - `75feddd1` (refactor)
3. **Task 3: Bound the command-context filters and give the localized write a declared home** - `12d3292e` (refactor)
4. **Task 4: Re-express the presence filter over its real discriminant, then measure and record** - `8534203b` (refactor)

## The measured delta

Every count below is read out of `node scripts/check-unused-type-members.mjs`'s
stderr finding lines or its `--json` report, never out of the record.

### Per row, this plan's ten

| Row | Before | Member | Task | After |
| --- | --- | --- | --- | --- |
| R1 | `errors-bridges.ts:27:26` | `AgentOwnershipConflictError.stagingFor.marketplace` | T2 | gone -- declaration collapsed onto `PluginCoordinate`, which production reads |
| R2 | `errors-bridges.ts:27:56` | `AgentOwnershipConflictError.stagingFor.plugin` | T2 | gone -- same |
| R3 | `errors-bridges.ts:65:44` | `BridgeStagingError.options.cause` | T1 | gone -- mirror replaced by the ambient `ErrorOptions` |
| R4 | `errors-bridges.ts:85:68` | `CommandNameError.options.cause` | T1 | gone -- same |
| R5 | `errors.ts:501:3` | `Phase3Failure.cause` | T2 | gone -- slot removed, no production reader |
| R6 | `notification-grammar.ts:1534:46` | `isDescriptionBearingRow.description` | T4 | contracted at `1545:46` (`type-selection`, accepted) |
| R7 | `notify-context.ts:64:61` | `CommandContext.render.status` | T3 | contracted at `64:61` (`type-selection`, accepted) |
| R8 | `notify-context.ts:269:45` | `notifyReconcileAppliedWithContext.status` | T3 | contracted at `269:52` (`type-selection`, accepted; the refinement draft at `269:45` was refused) |
| R9 | `notify-context.ts:323:29` | `arm.status` | T3 | contracted at `332:29` (`type-selection`, accepted) |
| R10 | `notify-context.ts:332:15` | `dispatchRow.severity` | T3 | gone -- cast literal replaced by a mapped view |

Five rows cleared by removing a declaration, four by a proof the real engine
accepted, one (R6) by re-expressing the filter so a proof became available.

### Global, per measurement point

| Point | Findings | Candidates | Runtime-observed | Explicit-contract | Unsupported |
| --- | --- | --- | --- | --- | --- |
| inherited baseline | 113 | 3434 | 3004 | 81 | 0 |
| after T1 | 111 | 3432 | 3004 | 81 | 0 |
| after T2 | 108 | 3427 | 3002 | 81 | 0 |
| after T3 source, no entries | 107 | 3426 | 3002 | 81 | 0 |
| after T3 entries | 104 | 3426 | 3002 | 84 | 0 |
| after T4 | **103** | **3426** | **3002** | **85** | **0** |

The plan's `<precondition>` names 138 findings. That number predates 06-09, which
landed 113. The part of the precondition that matters was confirmed exactly: 11
unread rows under `shared/`, 10 of them this plan's and the eleventh 06-10's.

### Gained findings: zero, at every step

The delta was taken as a set difference on the finding lines, which carry
`(path, owner, key)` identity, not as a subtraction of totals:

```
comm -13 <(sort before.err) <(sort after.err)   # gained
comm -23 <(sort before.err) <(sort after.err)   # lost
```

`gained` was empty at all four measurement points. The only line that moved
without leaving the set was `arm.status`, which shifted `323:29 -> 332:29`
because T3 added a nine-line type declaration above `dispatchRow`; it is the
same row and it was then cleared by its entry.

### The candidate arithmetic closes

3434 -> 3426, and all 8 are accounted for:

| Where | Removed | Added | Net |
| --- | --- | --- | --- |
| `errors-bridges.ts` two options mirrors | 2 | 0 (`ErrorOptions` is ambient) | -2 |
| `errors-bridges.ts` three coordinate literals | 6 | 2 (`PluginCoordinate.{marketplace,plugin}`) | -4 |
| `errors.ts` `Phase3Failure.cause` | 1 | 0 | -1 |
| `notify-context.ts` severity cast literal | 1 | 0 (a mapped type declares none) | -1 |
| | | | **-8** |

Runtime-observed moved 3004 -> 3002: the four `owner.*` / `stagingFor.*`
declarations the reads used to land on collapse to two.

## Judgment calls

### `AgentOwnershipConflictError.stagingFor` (R1/R2) -- KEPT, de-duplicated instead

The triage offered "drop the frozen copy or name the consumer". Dropping it
would have deleted tested defensive behaviour:

- `tests/shared/errors-bridges.test.ts` asserts `error.stagingFor` and
  `Object.isFrozen(error.stagingFor)` in four cases, and one of them mutates the
  caller's object after construction and asserts the error's copy did not move.
- `tests/bridges/agents/stage.test.ts:826` reads `error.stagingFor` in the
  refusal assertion.

The real defect was that the same two members were declared three times in one
file -- on `AgentOwnershipConflict.owner`, on the error's public field, and again
on the constructor parameter -- and only the first copy was read (at the
message-composing `map`). Collapsing all three onto `PluginCoordinate` leaves one
declaration, and it is the one production already reads. The constructor
parameter becoming `readonly` breaks no caller: a mutable object is still
assignable to a `readonly`-membered parameter, and the local the suite mutates
stays mutable.

### `Phase3Failure.cause` (R5) -- REMOVED, absence of a reader measured first

The standing instruction is to remove a declaration only after proving its full
call-site consequence. The proof, from `--json`:

| Member | Status | Production witnesses |
| --- | --- | --- |
| `Phase3Failure.phase` | runtime-observed | 4 (`update-swap.ts:676,924,931`, ...) |
| `Phase3Failure.msg` | runtime-observed | 2 (`update-swap.ts:924,932`) |
| `Phase3Failure.cleanupFailures` | runtime-observed | 2 (`update-swap.ts:933`) |
| `Phase3Failure.cause` | unread | **0** |

The three siblings are reached THROUGH `Omit<Phase3Failure, "cause">` -- the
mapped type's properties resolve back to this declaration -- so the model
demonstrably reaches this interface. `cause` is the one member `Omit` removes,
and `UpdatePhase3Failure` restates it as a required `Error`; `update-flow.ts`'s
`rollbackPartialCauseSlot(p: UpdatePhase3Failure)` is the only production read of
an originating error and it resolves there. So this is **not** an analyzer
under-credit of the 06-09 kind: the model reaches the declaration and the slot
genuinely has no production reader.

Three tests deep-compared `error.failures` arrays whose elements carried a
`cause`. Those expectations were fixtures the tests wrote for themselves, and
what the aggregate error actually contracts -- that it stores the caller's array
by reference -- is pinned by `assert.strictEqual(error.failures, failures)`,
which is untouched. The compile-time proofs that pin the closed bridge-phase
vocabulary keep their full strength, and a new compile-time negative pins the
removal itself:

```ts
// @ts-expect-error the shared entry shape declares no per-entry cause; the
// update family restates one as a required Error in UpdatePhase3Failure
void ({ phase: "skills", msg: "skills failed", cause: new Error("x") } satisfies Phase3Failure);
```

### R8 -- the planned repair was REFUSED by the engine and was not accommodated

The plan preferred bounding the status parameter by the union's own status key so
that the intersection `PluginNotificationMessage & { status: Status }` would
"strictly narrow a slot the rest of it already declares". That was drafted as a
`type-refinement` entry and run against the real engine, which refused it and
exited 2:

```
Invalid contract: .../notify-context.ts:269:45 refines .../notify-context.ts:269:15
  does not narrow status
```

The mechanism is visible in `proveTypeRefinement`: `narrows()` decides a slot is
narrower when its constituents are a strict subset of the wider slot's
constituents. `Status` is a type parameter, not one of the union's constituents,
so the check can never pass for a bound of this shape however it is constrained.

The plan's second option was to drop the intersection. That was **not** taken --
it removes a compile-time constraint, and the plan says to prefer adding
evidence. Instead the bound was re-expressed as
`Msg extends Extract<PluginNotificationMessage, { status: Status }>`, a
two-argument selection the engine's `type-selection` prover can read, and which
implies the intersection it replaces (any subtype of the `Extract` is a subtype
of `PluginNotificationMessage` and carries a `status` in `Status`).

That "nothing was dropped" claim is measured, not argued. A control was added:

```ts
function undeclaredStatusMustRemainATypeError(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  context: CommandContext<"available", PluginDisabledMessage>,
  message: ReconcileAppliedCascadeMessage,
): void {
  // @ts-expect-error -- the reconcile emitter admits only rows whose status its render map declares.
  notifyReconcileAppliedWithContext(ctx, pi, context, message);
}
```

| Bound under test | Result |
| --- | --- |
| the old `PluginNotificationMessage & { status: Status }` | control still fails (constraint present) |
| the new `Extract<PluginNotificationMessage, { status: Status }>` | control still fails (constraint preserved) |
| no bound at all (`Msg extends PluginNotificationMessage`) | `TS2578: Unused '@ts-expect-error' directive` -- the control stops firing |

So the control genuinely guards the constraint, and the constraint survived the
change.

### R6 -- the equivalence claim carries a control, and the control was exercised

Before replacing the presence filter, the set it actually selects was measured
rather than assumed. A throwaway probe resolved
`Extract<PluginNotificationMessage, { description?: string }>["status"]` to
exactly nine literals -- `installed`, `available`, `unavailable`, `upgradable`,
`disabled`, `partially-installed`, `partially-upgradable`,
`partially-available`, `remote` -- which is exactly the nine `true` entries in
`DESCRIPTION_BEARING_STATUS`. The replacement is therefore equivalent, and the
claim ships with a both-directions control in the paired suite:

```ts
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
void (true satisfies MutuallyAssignable<DescriptionBearingByMember, DescriptionBearingByStatus>);
```

Exercised against two counterexamples, both of which failed the typecheck with
`TS1360` as required: dropping `"remote"` from the by-status spelling, and adding
`"updated"` to it.

The production side keeps the map total (`as const satisfies
Record<PluginNotificationMessage["status"], boolean>`), so a new variant still
fails the check, and the narrowed status union is now **derived from that map**
rather than restated beside it, so the two can no longer drift.

### No analyzer under-credit found in this owner group

06-09's `WriteHookConfigResult.written` row was an analyzer gap: nine
deep-comparison sites credited it nothing because `isProductionDerived` cannot
reach production through a factory-returned closure. Every row in this group was
checked for the same signature. None matched: R5 was the only candidate, and its
three siblings prove the model reaches that declaration (table above). The other
nine rows are type-level declarations with no runtime reader by construction.

## Contract drafts: 4 accepted, 1 refused

| Draft | Category | Verdict |
| --- | --- | --- |
| `notification-grammar.ts:1545:46` `isDescriptionBearingRow.status` | type-selection | accepted |
| `notify-context.ts:64:61` `CommandContext.render.status` | type-selection | accepted |
| `notify-context.ts:269:45` `notifyReconcileAppliedWithContext.status` | type-refinement | **REFUSED** -- "does not narrow status" |
| `notify-context.ts:269:52` `notifyReconcileAppliedWithContext.status` | type-selection | accepted |
| `notify-context.ts:332:29` `arm.status` | type-selection | accepted |

No proof was widened to absorb the refusal; the declaration was changed instead,
and the refusal is recorded above with its mechanism.

## Contract drift

`scripts/check-unused-type-members.contracts.json` moved 81 -> 85 entries. The
four added are the four accepted drafts; no existing entry was removed,
reordered, reformatted or altered (`git diff` on the file is 24 inserted lines
and zero deletions before the T4 append, and 8 more on T4).

The only validated entry in any file this plan edits is
`notification-grammar.ts:837:7` (`renderPendingRow.p.status`, filter at
`835:6`). Both coordinates were confirmed before editing and re-read after:
lines 835-838 are byte-identical, and every edit in that file is at line 1503 or
below. `notify-context.ts`, `errors.ts` and `errors-bridges.ts` carried no
entries. The engine loaded on every run except the one that refused the R8 draft
by name; there was no unexplained exit 2.

## Verification

| ID | Command | Result |
| --- | --- | --- |
| 06-14-T0 | `node scripts/check-unused-type-members.mjs` (baseline) | exit 1, 113 findings, 11 under `shared/`, 0 unsupported |
| 06-14-T1 | `npm run typecheck` | exit 0 |
| 06-14-T1 | `node --test` errors-bridges + commands/stage + commands/discover | 57/57 pass |
| 06-14-T1 | analyzer | 111 findings; exactly R3 and R4 lost; 0 gained; contracts still 81 |
| 06-14-T2 | `npm run typecheck` | exit 0 |
| 06-14-T2 | `node --test` errors-bridges + errors + agents/stage + update-flow | 291/291 pass |
| 06-14-T2 | analyzer | 108 findings; exactly R1, R2 and R5 lost; 0 gained; contracts still 81 |
| 06-14-T3 | `npm run typecheck` | exit 0 -- all 21 `CommandContext` instantiations unchanged |
| 06-14-T3 | `node --test` notify-context + notification-dispatch + reconcile.messaging + plugin/shared | 303/303 pass |
| 06-14-T3 | `node --test tests/scripts/check-unused-type-members.contracts.test.ts` | 48/48 pass |
| 06-14-T3 | analyzer (source only) | 107 findings; R10 lost; `arm.status` shifted 323 -> 332; 0 gained |
| 06-14-T3 | analyzer (refinement draft) | **exit 2**, entry refused by name |
| 06-14-T3 | analyzer (selection drafts) | 104 findings; R7, R8, R9 lost; 0 gained; contracts 81 -> 84 |
| 06-14-T4 | `node --test` notification-grammar + notification-types | 102/102 pass |
| 06-14-T4 | `npm run typecheck` on two equivalence counterexamples | TS1360 in both directions, as required |
| 06-14-T4 | analyzer | 103 findings; R6 lost; 0 gained; contracts 84 -> 85 |
| 06-14-T4 | the plan's own `--json` assertion | exactly one `/shared/` finding: `shared/fs-utils.ts:225:32` |
| 06-14-T4 | `node scripts/check-unused-type-members.audit.mjs --inventory` | exit 0, 3426 candidates, 103 unresolved |
| 06-14-T4 | `node scripts/check-unused-type-members.audit.mjs --check` | exit 1, **103 problems, 103 of 103 kind `unread`** -- zero stale-source, stale-record, missing, duplicate, incomplete or invalid |
| final | `npm run check` | exit 0 |
| final | `npm run test:coverage:unit` + `coverage/unit.lcov` | 227 production modules, functions 1834/1834, branches 9050/9050, lines 62919/62919, **0 modules below 100%** |
| final | `npm run test:coverage:direct:all` | exit 0, 236 pairs in 482.8s, "2 pinned shortfall(s) matched `scripts/test-coverage-direct.pin.json` exactly" |
| final | `node scripts/check-unused-type-members.negative.mjs` | exit 0, **7 of 7 ok** |

Line coverage moved 62887 -> 62919 because the repairs add executable lines; the
function and branch totals are unchanged at 1834 and 9050, and no pin was
lowered -- `scripts/test-coverage-direct.pin.json` is byte-identical to its state
before this plan.

### The regenerated record

| Measurement | Before | After |
| --- | --- | --- |
| Revision | `709e8f04` | `12d3292e` |
| Source digest | `c285cdee...` | `90d45a1f...` |
| Source files hashed | 605 | 605 |
| Production files analysed | 236 | 236 |
| Candidates | 3434 | 3426 |
| Runtime-observed | 3004 | 3002 |
| Test-only-observed | 236 | 236 |
| Explicit-contract | 81 | 85 |
| Unread | 113 | 103 |
| Unsupported analysis | 0 | 0 |
| `shared` owner row (cand / runtime / test-only / contract / unread / unsupported) | 346 / 326 / 5 / 4 / **11** / 0 | 338 / 324 / 5 / 8 / **1** / 0 |

`transferMs` is a wall clock and is deliberately not compared. The recorded
revision is the HEAD the `--inventory` run saw (`12d3292e`, the T3 commit); the
T4 source edits were in the working tree at that moment and are in the digest,
which is what `--check` reconciles, and `--check` reports zero `stale-source`.

The four new `explicit-contract` rows were `_pending_` in the first
regeneration, which `--check` correctly reported as four `incomplete` problems.
Their dispositions were recorded in the record's own JSON ledger -- the
generated prose table is rendered from that ledger, so the ledger is where a
disposition belongs -- and the record was then regenerated and re-checked. The
06-10 row's inherited note carried forward byte-for-byte.

### `fails_when` counterexamples exercised

| Task | Counterexample | Outcome |
| --- | --- | --- |
| T1 | the mirror deleted without an equivalent annotation | `ErrorOptions` annotates both constructors; a bag with an extra key is still a compile error, pinned by two new `@ts-expect-error` controls |
| T1 | a bridge file outside this owner edited | `git diff` touches no file under `bridges/` |
| T2 | the frozen copy or its freeze assertion deleted | both assertions are untouched and green; `Object.freeze({ ...stagingFor })` is unchanged |
| T2 | the surplus slot removed without proving no production reader resolves to it | witness table above, measured from `--json` before the edit |
| T2 | a file under `extensions/**/orchestrators/` edited | `git diff` touches none |
| T3 | an entry the engine refused written anyway | the refused refinement draft was removed, not kept; the refusal is recorded with its reason |
| T3 | a compile-time constraint dropped without a control | three-way control measurement above |
| T3 | an orchestrator file edited to make the bound hold | `npm run typecheck` green with zero edits outside this owner |
| T4 | type equivalence claimed without a control that would fail when it is false | two counterexamples run, both `TS1360` |
| T4 | the triage hand-edited instead of regenerated | the prose was produced by `--inventory` twice; only the ledger's four new disposition notes were authored |
| T4 | the closing counts asserted rather than measured | every number here comes from the CLI's stderr, its `--json`, the regenerated record or `lcov` |
| all | a coverage pin lowered | `scripts/test-coverage-direct.pin.json` is byte-identical |

## Handoff: a vestigial `Omit` in `orchestrators/plugin/update-swap.ts`

With `Phase3Failure.cause` gone, line 177 reads:

```ts
export interface UpdatePhase3Failure extends Omit<Phase3Failure, "cause"> {
  readonly cause: Error;
}
```

`Omit`-ing a key that no longer exists is a no-op, so the expression still
compiles and still means the right thing -- but the `"cause"` argument is now
redundant and the declaration would read more honestly as
`extends Phase3Failure`. This file is claimed in this wave by **06-10**, and the
two unread rows inside it (`DirectRenderableFailedOutcome.cause` at `188:3` and
`.toVersion` at `191:3`) are owned by **06-12**. It was deliberately NOT edited
here: a same-wave edit to another plan's file is a collision. Whichever of the
two lands in that file should simplify the expression.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/errors-bridges.ts` - adds `PluginCoordinate` and points the conflict owner, the public `stagingFor` field and the constructor parameter at it; both options bags take `ErrorOptions`.
- `extensions/pi-claude-marketplace/shared/errors.ts` - `Phase3Failure.cause` removed; the doc comment now states where the per-entry cause actually lives.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - `CommandContext` and `dispatchRow` bound their message parameter by `PluginNotificationMessage`; the reconcile emitter's bound becomes an `Extract` selection; the severity write goes through a mapped view over the row's own slot.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - the description map is `as const satisfies Record<...>`, the description-bearing status union is derived from it, and the predicate narrows by `status`.
- `tests/shared/errors-bridges.test.ts` - two compile-time negatives pinning that the options bag admits `cause` and nothing else.
- `tests/shared/errors.test.ts` - the six `Phase3Failure` compile proofs drop the removed key and keep the closed-vocabulary refusal; one new negative pins the removal; three runtime cases drop a fixture key the shape no longer declares.
- `tests/shared/notify-context.test.ts` - a bound control on `CommandContext` and the three-way-measured control on the reconcile emitter.
- `tests/shared/notification-grammar.test.ts` - the both-directions equivalence control for the description narrowing.
- `tests/orchestrators/plugin/update-flow.test.ts` - one fixture key this plan's own removal orphaned.
- `scripts/check-unused-type-members.contracts.json` - four accepted entries appended; nothing else touched.
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` - regenerated against the fresh digest, with dispositions recorded for the four new contract rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] One fixture key in `tests/orchestrators/plugin/update-flow.test.ts` orphaned by the `Phase3Failure.cause` removal**

- **Found during:** Task 2
- **Issue:** `tests/orchestrators/plugin/update-flow.test.ts:3249` builds a `PluginUpdatePhase3Error` fixture carrying `cause: new Error("disk failure")`. With the slot gone, `tsc` reports `TS2353`.
- **Fix:** Dropped exactly that key. The case asserts `reason: "rollback partial"`, which `narrowDirectFailReason` derives from `instanceof PluginUpdatePhase3Error` alone, so the assertion is unweakened. No production file under `orchestrators/` was touched.
- **Files modified:** `tests/orchestrators/plugin/update-flow.test.ts`
- **Verification:** `npm run typecheck` exit 0; `node --test tests/orchestrators/plugin/update-flow.test.ts` green
- **Committed in:** `75feddd1`

**2. [Rule 3 - Blocker] Prettier rewrapped a compile-time negative and detached its directive**

- **Found during:** Task 2
- **Issue:** The new `@ts-expect-error` control was written as a 101-character line. Prettier wrapped it across five lines, which moved the offending property two lines below the directive; `tsc` then reported both `TS2578` (unused directive) and `TS2353` (the real error).
- **Fix:** Rewrote the control as a 96-character single line so the directive stays adjacent to the error.
- **Files modified:** `tests/shared/errors.test.ts`
- **Verification:** `npm run typecheck` exit 0; `pre-commit` prettier hook passes without rewriting
- **Committed in:** `75feddd1`

### Plan-directed decisions that departed from a recorded disposition

**3. [Directed] `AgentOwnershipConflictError.stagingFor` kept rather than deleted** -- see Judgment calls. The plan itself refused the triage's "drop the frozen copy", and the evidence confirms it: two suites assert the copy and its freeze.

**4. [Rule 1 - Refused proof] R8 took a third repair shape, not the plan's second option**

- **Found during:** Task 3
- **Issue:** The plan's preferred repair (a `type-refinement` entry over the intersection bound) is not reachable by the engine for a bound of that shape, measured as an exit-2 refusal naming the entry.
- **Fix:** Re-expressed the bound as an `Extract` selection rather than dropping the intersection (the plan's fallback). This adds evidence instead of removing a constraint, which is what the plan says to prefer; the constraint's survival is measured by a control run under three different bounds.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify-context.ts`, `tests/shared/notify-context.test.ts`, `scripts/check-unused-type-members.contracts.json`
- **Verification:** engine accepted the selection entry; control fails under the old and new bounds and stops failing with no bound
- **Committed in:** `12d3292e`

**5. [Documented] The precondition's 138-finding baseline is stale**

- **Found during:** Task 1
- **Issue:** The plan's `<precondition>` names 138 findings. 06-09 landed 113 after this plan was written.
- **Fix:** Confirmed the part of the precondition that binds this plan -- 11 unread rows under `shared/`, the ten this plan owns plus 06-10's -- and measured every delta against the live 113 instead.
- **Verification:** baseline run recorded above

**Total deviations:** 2 auto-fixed blockers, 1 refused-proof repair change, 2 documented. **Impact:** no production behaviour changed; no proof widened; no file outside this owner's production scope edited.

## Issues Encountered

None that block. `pre-commit`'s TruffleHog hook cannot run in this linked
worktree -- it fails with `failed to read index file: open .../.git/index: not a
directory`, because `.git` here is a file -- so every hook run used the
`SKIP=trufflehog` form CLAUDE.md prescribes for worktree commits. Every other
hook ran and passed on every commit.

## Next Phase Readiness

This owner group is closed. `shared` reports 1 unread row and it is
`shared/fs-utils.ts:225:32`, which 06-10 must move together with its three
bridge declaration sites. Ready for **06-10**; 06-08 stays blocked on the
remaining 103 rows across the other five owners.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/{errors-bridges,errors,notify-context,notification-grammar}.ts` all present on disk.
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` present, regenerated, digest `90d45a1f`.
- `git log --oneline` shows `4daa84aa`, `75feddd1`, `12d3292e`, `8534203b` on `features/test-backlog`.
- Every plan-level `<success_criteria>` re-run and green; `npm run check` exit 0 on the final tree.

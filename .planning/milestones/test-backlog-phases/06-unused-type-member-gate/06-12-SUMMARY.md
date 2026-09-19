---
phase: 06-unused-type-member-gate
plan: "12"
subsystem: testing
tags: [typescript, static-analysis, orchestrators, contracts, dead-code, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable member gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The contract engine's five categories and the exact refusal each produces
  - phase: 06-unused-type-member-gate
    provides: The closed triage, the validated contracts and the recorded dispositions
  - phase: 06-unused-type-member-gate
    provides: The seven executable negative controls the repairs must not disturb
  - phase: 06-unused-type-member-gate
    provides: The 72-row live baseline 06-13 left behind
provides:
  - "The largest owner group repaired: 49 unread orchestrator members become 36 source repairs, 3 validated contracts and 10 rows outstanding with a written, measured reason each"
  - "A measured 72 -> 33 live population with zero findings gained, closing the six-plan repair wave"
  - "Three new validated contract entries and one retired by name, with the `PartialableUpdateShapeError` marker restated so the proof can reach it"
  - "A measured second prover limit: `narrows()` compares union-constituent counts, so a `never` pin over a non-union slot can never be proved"
  - "06-11's stranded resolver twin resolved: the names-cache accessor, its implementation and its two witnesses are gone together"
  - "06-10's stale-note hand-off closed: eight carried-forward witness coordinates corrected from a fresh report"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `feb875b4`, reconciling with 33 problems that are ALL `unread`"
affects: [06-08]

actuals:
  tokens: 75241
  tasks: 7
  commits: 7
plan_head_before: 53fbc28db92511dd437a1aeb6021c9fc5d119043

tech-stack:
  added: []
  patterns:
    - "One shape spelled at N sites is named once; the reader's credit then lands on the single surviving declaration without deleting a value"
    - "A seam's parameter declares the slots its body reads; a decision made one call up stays with the type that owns it"
    - "An absence marker is restated so each pin narrows a slot the left operand declares, then submitted to the real engine; a refused restatement is reverted rather than shipped"
    - "A whole-object `deepStrictEqual` that carries a test's claim is a reader the analyzer does not model, and the member stays"

key-files:
  created:
    - .planning/phases/06-unused-type-member-gate/06-12-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-targets.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - scripts/check-unused-type-members.contracts.json
    - scripts/test-coverage-direct.pin.json
    - tests/orchestrators/edge-deps.test.ts
    - tests/orchestrators/plugin/install-disable-cascade.test.ts
    - tests/orchestrators/plugin/plugin-state-classifier.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/reconcile/types.test.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "`RemoveMarketplaceOutcome.name` was KEPT, and the sibling-symmetry question was answered before deciding: the symmetry is not what keeps it. `AddMarketplaceOutcome.name` is read for a documented CR-01 reason remove has no analogue for, so production symmetry is not load-bearing; the slot stays because three test assertions observe it and one of them carries the case's whole claim"
  - "Two R4 restatements the engine refused were REVERTED rather than shipped. Reshaping production source to satisfy a refused proof is what the phase forbids, and neither restatement cleared its row"
  - "`enableRowDependencies`'s `{ partition?: never }` was not touched. There is no left operand declaring the slot, so no restatement can reach the prover, and weakening the refusal would reintroduce the WR-01 bug it exists to prevent"
  - "`PLUGIN_INFO_RENDER`'s filter was kept and the row recorded, not dropped. Every sibling render map carries the same shape with an accepted entry, and dropping it would widen each arm the moment info gains a second cascade status"
  - "`UpdatePhaseFailure.msg` was reclassified from the inherited disposition: the reader survey agrees it is unread, but the phase-3 rollback aggregation populates it and the standing obligation treats a rollback-populated slot as behaviour"
  - "The `install-outcome.ts` direct pin was re-measured, and both of its reason coordinates were corrected — the second was already stale by three lines before this plan ran"

patterns-established:
  - "An engine refusal is traced to the exact prover predicate and its arithmetic is reproduced, so the recorded limit is measured rather than inferred"
  - "A restatement that gets past one prover check and fails the next is reverted, and the distance it travelled is recorded so the next owner knows what is left"
  - "A hermetic-environment workaround is validated before its results are trusted: a shared `PI_CODING_AGENT_DIR` collapses every suite's user scope into one directory and manufactures a failure"

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The tracer proves the whole repair loop on one dead slot: `MarketplaceBlock.key` removed, both contract coordinates below the edit re-pinned and re-accepted, the analyzer exits 1 rather than 2"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/*.test.ts tests/architecture/no-orchestrator-network.test.ts -- 244/244"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json -- exit 1, 72 -> 71, contracts 87 validated"
        status: pass
    human_judgment: false
  - id: D2
    description: "Thirty-six orchestrator rows cleared by source repair with no behaviour change: four spellings of the cascade failure pair become one, five seams name the types their implementations own, and eleven slots no consumer reads are gone"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/**/*.test.ts + the three architecture gates -- 2,842 assertions across the five slices, 0 fail"
        status: pass
      - kind: other
        ref: "(path, owner, key) diff against the pre-edit baseline at 53fbc28d -- 39 findings removed, 0 gained"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three contract entries were accepted by the real engine against this tree and one was retired by name; three drafts were refused and withdrawn with the engine's message and mechanism recorded"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs --json -- contracts 87 -> 90 validated, exit 1 never 2"
        status: pass
      - kind: other
        ref: "each refused draft re-run individually -- exit 2 with the quoted diagnostic, then withdrawn"
        status: pass
      - kind: other
        ref: "compiler probes -- every refusal each restated marker enforced still fires"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every one of the 34 coordinate-pinned contract fields in an edited file was re-derived from the repaired source and re-accepted; the drift control fired twice on a stale pin and was the mechanism working"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- two runs exited 2 on a stale coordinate before re-pinning, then exit 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "The record reconciles exactly against a fresh analysis: 33 problems, all `unread`, with 52 re-keyed notes restored from the report and 9 pre-existing stale notes corrected"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --inventory -- exit 0, digest feb875b4"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1, 33 problems, 33 of them `unread`"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nothing was weakened: `npm run check` exit 0, negative controls 7/7, aggregate production unit coverage still 100 percent with no module below it, both direct pins matched exactly"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "npm run check -- exit 0, 6,471 unit assertions plus integration"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7"
        status: pass
      - kind: other
        ref: "coverage/unit.lcov -- 227 modules, functions 1833/1833, branches 9049/9049, lines 62922/62922, 0 below 100%"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -- 236 pairs, 2 pinned shortfalls matched exactly"
        status: pass
    human_judgment: false

duration: 174 min
completed: 2026-09-16
---

# Phase 06 Plan 12: Orchestrators Owner Group Summary

**The largest owner group goes 49 unread rows to 10: 36 cleared by naming the declaration a reader already credits or deleting surface nothing reads, 3 by contracts the engine accepted, and 10 left standing with a written reason — including three the engine refused for a prover limit this plan measured rather than worked around.**

## Performance

- **Duration:** 174 min
- **Tasks:** 7 of 7
- **Files changed:** 28 (20 production, 5 test, 3 record/config)
- **Commits:** 7 task commits plus this metadata commit

## The measured split

The orchestrators group started at 49 unread rows and ends at 10.

| Outcome | Count |
| --- | --- |
| Repaired at source | 36 |
| Resolved by a contract the engine accepted | 3 |
| Outstanding with a recorded reason | 10 |

Live population, measured with `node scripts/check-unused-type-members.mjs --json`
and diffed by `(path, owner, key)` against a pre-edit baseline at revision
`53fbc28d`:

```
72 unread -> 71 (T1) -> 61 (T2) -> 51 (T3) -> 40 (T4) -> 38 (T5) -> 33 (T6)
removed 39   gained 0
contracts 87 -> 90        candidates 3397 -> 3352        unsupported 0
```

Thirty-nine findings over thirty-eight `(path, owner, key)` keys: the two
`marketplaces.source` locals in `import/execute.ts` share one key.

**Zero findings gained at every one of the six measurement points**, holding the
standard 06-09, 06-14, 06-10, 06-11 and 06-13 all met.

## Per-row accounting

### Repaired at source (36)

| Declaration | Member(s) | Repair |
| --- | --- | --- |
| `reconcile/notify.ts:90:3` | `MarketplaceBlock.key` | R3. File-private type; `.key` appears nowhere in the reconcile tree or its suites; the value is the accumulator map's own key. |
| `marketplace/remove.ts` ×6 | `failedPlugins.{name,cause}` at three sites | R1. One `FailedPluginCascade` replaces four spellings; the composer's reads at `:254`, `:255` and `:282` now credit it. |
| `marketplace/remove.ts:505:3` | `ExtensionMarketplaceRow.plugins` | R1. The hand-written mirror becomes `ExtensionState["marketplaces"][string]`, the house form already used at seven other orchestrator sites. |
| `marketplace/autoupdate.ts` ×2 | `buildAutoupdatePatch.autoupdate`, `patch.autoupdate` | R2. Return type and local both annotated `Partial<MarketplaceConfigEntry>`, which `writeMarketplaceConfigEntry` and the batched writer already take. |
| `marketplace/autoupdate.ts:500:33` | `errors.cause` | R3. `missingEverywhere` sees only the array length; the surfaced arm reads `first.scope`. |
| `edge-deps.ts:58:3` | `MarketplaceStateRecordLike.manifestPath` | R3. Dead on both sides at once — 06-11 removed the edge twin; the projection was the only syntax naming it. |
| `edge-deps.ts:158:7` | `makeLocationsResolver.marketplaces` | R1. The implementation takes its return shape contextually from the seam instead of restating it. |
| `import/execute.ts` ×2 | `ImportDeps.loadSettings.opts.cwd`, `settingsLoader.opts.cwd` | R1. The delegate names `ClaudeSettingsReadOptions`, whose `cwd` `resolveClaudeSettingsPaths` reads at `settings.ts:45`. |
| `import/execute.ts` ×2 (one key) | `marketplaces.source` | R2. Both patch accumulators name `ImportConfigPatch["marketplaces"]`. |
| `plugin/install-disable-cascade.ts:26:3` | `FreshInstallDisableOptions.scope` | R3. The body reads `state`, `locations`, `marketplace`, `plugin`; `dropRoutesAfterSave` takes the scope positionally. |
| `plugin/plugin-state-classifier.ts:80:5` | `InstalledRecordLike.compatibility.installable` | R3. The type's own doc comment already said it never decides disabled-ness. |
| `plugin/reinstall-targets.ts` ×4 | `record` on four resolvers | R1 + R3. One `ResolvedTargetScope` replaces four inline return shapes, without the record the sole consumer never reads. |
| `plugin/install-outcome.ts:302:14` | `loadCachedMarketplaceManifest.name` | R2. The relay names `MarketplaceManifest`, the type its inner loader already returns. |
| `plugin/list-flow.ts:392:27` | `ScopedManifest.loadError` | R3. BOUND-03 / D-95-05 keeps the bare row and renders no message; the slot had a write and no reader. |
| `plugin/list-flow.ts:592:46`, `plugin/info.ts:2209:24` | `details.autoupdate` ×2 | R2. Both name `Pick<MarketplaceDetails, "autoupdate">`, which keeps refusing `lastUpdatedAt`. |
| `plugin/shared.ts:955:3` | `NameOwner.marketplace` | R3. `collectConflicts` reads the plugin name and the disabled qualifier only. |
| `plugin/uninstall.ts` ×2 | `commitPluginRemoval.ids.{scope,marketplace}` | R3. The body deletes by plugin key; uninstall carries no ledger and no undo arm reads them. |
| `plugin/enable-disable.ts:174:7` | `EnableDisablePluginOutcome.name` | R1. Three arms spelled it; one `EnableDisableSubject` is intersected into each non-failed arm. |
| `reconcile/types.ts` ×4 | `declaredSource` / `recordedSource` on two mismatch arms | R1. One `PlannedSourceDetail` shared with the planner's conflict shape, which reads both at `plan.ts:316`/`:317`. |
| `reconcile/types.ts:281:3` | `ScopeReadResult.scope` | R3. The apply loop and the backfill pass each take the scope as their own parameter. |

### Resolved by a contract the engine accepted (3)

| Declaration | Member | Category | How it became provable |
| --- | --- | --- | --- |
| `plugin/reinstall-replace.ts:64:26` | `RemoveDataDirFn.options.recursive` | type-refinement | R4. The options narrow Node's `RmOptions`, where both slots are optional booleans, so `true` narrows a slot the left operand declares. |
| `plugin/reinstall-replace.ts:64:43` | `RemoveDataDirFn.options.force` | type-refinement | Same restatement. |
| `plugin/update-preflight.ts:132:5` | `PartialableUpdateShapeError.shape.partialable` | type-refinement | R4. `Extract<..., { kind: "no-longer-installable" }>` selects the arm the marker targets; `true` then narrows that arm's `boolean`. |

One entry was **retired by name** as the intended coupling: the
`type-refinement` entry that explained the hand-written `kind` pin at
`update-preflight.ts:132:5` named a declaration the `Extract` replaced. A
`type-selection` entry for the selection took its place. Net `87 -> 90`.

### Outstanding with a recorded reason (10)

| Declaration | Member | Mechanism |
| --- | --- | --- |
| `edge-deps.ts:58:3` | `MarketplaceStateRecordLike.plugins` | Cross-boundary mirror. `orchestrators/` may not import `edge/`, and the edge reads through its own declaration. The legal collapse lands in an edge-owned file this plan is forbidden to edit. |
| `edge-deps.ts:64:5` | `LocationsResolverLike.loadStateForScope.marketplaces` | Same mirror. The duplicate half WAS repaired (the implementation stopped restating the shape); returning the state unprojected would resolve the rest but changes what the resolver returns, which its paired test pins exactly. |
| `marketplace/remove.ts:114:35` | `RemoveMarketplaceOutcome.name` | Analyzer under-credit. `remove.test.ts:563` and `:596` deep-compare the whole outcome, and at `:596` the compared name IS the case's claim. See the symmetry answer below. |
| `marketplace/remove.ts:129:7` | `RemoveMarketplaceOutcome.name` | Same, on the `partial` arm, observed at `remove.test.ts:1440`. |
| `plugin/info.messaging.ts:68:69` | `PLUGIN_INFO_RENDER.status` | Engine refusal, quoted below. `PluginInfoCascadeMsg` is a single variant, so the filter discriminates nothing. |
| `plugin/shared.ts:129:5` | `enableRowDependencies.signals.partition` | No left operand declares `partition`, so every restatement still adds a key. Weakening the refusal reintroduces the WR-01 empty-dependency bug. Source untouched. |
| `plugin/update-preflight.ts:315:37` | `StaticPreflightRowOptions.fromVersion` | Engine refusal at the `narrows` check, quoted below. Restatement built, measured, reverted. |
| `plugin/update-swap.ts:188:3` | `DirectRenderableFailedOutcome.cause` | Same `narrows` limit. Restatement built and probed, reverted. |
| `plugin/update-swap.ts:191:3` | `DirectRenderableFailedOutcome.toVersion` | Same. |
| `orchestrators/types.ts:155:3` | `UpdatePhaseFailure.msg` | Rollback payload. The phase-3 aggregation is its only writer and its header states the slot's contract; a rollback-populated slot is behaviour even with no reader today. |

## The sibling-symmetry question, answered in writing

The plan required this settled before `RemoveMarketplaceOutcome.name` could be
removed. It was settled, and the answer is that the symmetry is **not** what
keeps the slot.

`AddMarketplaceOutcome.name` is read in production at `reconcile/apply.ts:332`,
and its CR-01 comment states why: the add outcome's name is the
MANIFEST-derived name, which the declared config key does not have to match, so
the caller cannot reconstruct it. Remove has no such divergence —
`foldRemoveOutcome` takes `marketplace` as its own parameter and it always
equals `opts.name`. **The production symmetry is not load-bearing, and the two
`name` slots exist for different reasons.**

The slot stays anyway, for a stronger reason the plan's `fails_when` names
directly: three assertions observe it. At `remove.test.ts:596` the case is
titled "selects the user marketplace in orchestrated bare form when project is
absent", and `name: "user-only"` in its `deepStrictEqual` expectation is the
only field that distinguishes it from the project case. Removing the slot would
delete the discriminating field from the assertion that carries the claim. The
analyzer does not model a whole-object `deepStrictEqual` as a read of a member,
so this is an under-credit of the 06-09 / 06-13 class, not a dead slot.

## Contract drafts: 3 accepted, 3 refused

Six drafts, each submitted to the real engine against the real program, with
every coordinate derived from the compiler's view of the syntax.

| Draft | Category | Outcome |
| --- | --- | --- |
| `reinstall-replace.ts:64:26` `RemoveDataDirFn.options.recursive` | type-refinement | **ACCEPTED** |
| `reinstall-replace.ts:64:43` `RemoveDataDirFn.options.force` | type-refinement | **ACCEPTED** |
| `update-preflight.ts:131:56` `PartialableUpdateShapeError.shape.kind` | type-selection | **ACCEPTED** |
| `info.messaging.ts:68:69` `PLUGIN_INFO_RENDER.status` | type-selection | **REFUSED** |
| `update-preflight.ts:318:63` `StaticPreflightRowOptions.fromVersion` | type-refinement | **REFUSED** |
| `update-swap.ts:191:3` / `:194:3` `DirectRenderableFailedOutcome.{cause,toVersion}` | type-refinement | **REFUSED** (same limit) |

### Refusal 1 — a filter over a type with nothing to discriminate

```
Invalid contract: extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts:68:69
  filter extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts:68:37
  selects over a type that does not discriminate on status
```

`PluginInfoCascadeMsg` is `PluginSkippedMessage` — one variant — so the
prover's selected-over type is not a union. The draft was withdrawn, not
rewritten. The filter was **not** dropped from the product type: every sibling
render map in the family (`LIST_RENDER`, `INSTALL_RENDER`, `UPDATE_RENDER`,
`FETCH_RENDER`, `REINSTALL_RENDER`, `UNINSTALL_RENDER`, both enable/disable
maps) carries the identical `Extract<Msg, { status: K }>` shape with an accepted
entry, and `RenderFn` is contravariant in its message — dropping the filter
would hand each arm the whole union the moment info gains a second cascade
status, a widening the `as const satisfies` pin cannot catch.

### Refusal 2 — a second, distinct prover limit, measured

```
Invalid contract: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:318:63
  refines extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:318:6
  does not narrow fromVersion
```

This refusal is **past** the one 06-06 recorded. 06-06 measured that a marker
which *adds* a key the rest of the intersection does not declare is refused at
`widerSlotFor`. The R4 restatements the taxonomy prescribes fixed exactly that:
both drafts reached `narrowsSlot`, one check further in. They then failed there,
and the cause was read out of the prover rather than guessed:

```js
// scripts/check-unused-type-members.contracts.mjs:795
function constituentsOf(type) { return type.isUnion() ? type.types : [type]; }

// scripts/check-unused-type-members.contracts.mjs:825
return chosen.length < allowed.length && chosen.every((part) => allowed.includes(part));
```

`constituentsOf` returns a one-element array for a non-union, so `never` counts
as **one** constituent against `string`'s one, and `1 < 1` is false. Reproduced:

```
never  vs string:  chosen=1 allowed=1 -> narrows=false
true   vs boolean: chosen=1 allowed=2 -> narrows=true
```

That is why `partialable: true` over `boolean` was accepted while every `never`
pin over `string` / `Error` was refused. **A `never` pin can only be proved
today when the wider slot is itself a union, or when the wider shape lets the
value be omitted.** The prover was not widened, the analyzer was not edited, and
nothing was renamed to slip past it.

### What was reverted, and why

Two restatements were built, probed, measured — and then **reverted rather than
shipped**:

- `DirectRenderableFailedOutcome` as `PluginUpdateFailedOutcome & { ... }`
  instead of `extends Omit<..., five keys>`. Sound (all five omitted slots are
  optional on the source), and a compiler probe confirmed all five refusals
  survive it and no producer gains a new obligation. It cleared no row.
- `StaticPreflightRowOptions` distributed over its two arms with the version
  slot hoisted onto a named base. Also sound, also cleared no row.

`update-swap.ts` is byte-identical to its pre-plan state. The phase's own rule
is explicit — *never reshape production source to satisfy a refused proof* — and
a churned exported type declaration with no measured benefit is worse than
leaving working code alone. The distance each restatement travelled is recorded
above so the next owner knows a single `narrows` fix would clear three rows at
once.

## 06-11's stranded resolver twin: closed

06-11 handed over `LocationsResolverLike.marketplaceNamesCachePath`
(`edge-deps.ts:63:3`, classified `test-only-observed`, so never one of this
plan's 49) with its implementation at `:149` and two witnesses at
`tests/orchestrators/edge-deps.test.ts:235:32` and `:256:32`.

All four are gone together. The deciding evidence is that the accessor was
redundant, not that it was unreferenced: `marketplaceNamesCacheFile` is very
much alive — `marketplace/add.ts:600` and `marketplace/remove.ts:617` both reach
it directly through `locations.marketplaceNamesCacheFile`. The resolver method
wrapped the same `locationsFor(scope, cwd).marketplaceNamesCacheFile` expression
and, after 06-11 removed the edge-side declaration, had no production consumer
at all. Removing it removes an accessor, not a capability.

Its sibling `MarketplaceStateRecordLike.manifestPath` went the same way, for the
reason the plan predicted: dead on both sides at once.

## Re-anchored coordinate records

Thirty-four coordinate fields across seventeen contract entries were re-derived
from the repaired source — never by arithmetic on the old value — and one entry
was retired.

| File | Entries re-pinned | Movement |
| --- | --- | --- |
| `reconcile/notify.ts` | 2 (4 fields) | line −2 |
| `marketplace/remove.ts` | 2 (4 fields) | line +9 |
| `plugin/install-disable-cascade.ts` | 1 (2 fields) | line −1 |
| `plugin/info.ts` | 1 (2 fields) | line +1 |
| `plugin/install-outcome.ts` | 1 (2 fields) | line −1 |
| `plugin/list-flow.ts` | 2 (4 fields) | lines +3 / +4 |
| `plugin/reinstall-targets.ts` | 4 (8 fields) | line +3 |
| `plugin/enable-disable.ts` | 9 (20 fields, 10 in range) | line +5 |

The drift control fired twice, both times as designed:

```
Invalid contract: .../install-disable-cascade.ts:60:3 declares FailedUnstageOutcome.cause, not FailedUnstageOutcome.ok
Invalid contract: .../enable-disable.ts:1153:41 names no declaration in this program
```

Each is **exit 2 before any member verdict** — a setup failure, not a quiet
allowance. Both were re-anchored and the run returned to exit 1.

The `install-outcome.ts` direct-coverage pin was re-measured, not relaxed:

```
pinned:   branches 109/111, lines 1040/1046
measured: branches 109/111, lines 1039/1045
```

Only the `reading` string changed; `findingIds` is byte-identical and **the
uncovered branch count did not rise** — it held at 2 of 111. One covered line
disappeared with the relay's three-line signature becoming one.

Both `reasons` coordinates WERE corrected, against the hazard note's default,
and the correction is itself a measurement. `node scripts/test-coverage-direct.mjs`
reports the uncovered lines as `422-425 824-825`, with the guarding conditions
at 421 and 823. The pin's prose said `422-426 (branch 422)` and
`827-829 (branch 827)`: the first had drifted by one under this plan, and **the
second was already stale by three lines before this plan ran**. A justification
naming a coordinate the tree does not hold is the failure hazard 2 describes, so
both now read from the measurement. The `bridges/commands/discover.ts` row was
not touched; its module was not edited and it still matches.

## The record reconciles

`--inventory` was re-run on the final snapshot. The digest moved to
`feb875b4…` at revision `e4b68037`, and the rebuild re-keyed **54** disposition
rows, every one named `incomplete` by `--check` before restoration — the
mechanism working.

All 54 were resolved, and **none was transcribed**:

- **52** were re-derived from the fresh `--json` report. A contract row's note is
  `"Validated contract. " + <the engine's own evidence string>`; a
  test-only row's is composed from `witnesses[0]` and the witness count. The
  `witnesses[0]` convention was itself established empirically, not assumed —
  188 of the 196 surviving standard-form notes match it, and only 29 match a
  sort-by-coordinate reading.
- **2** were rows this plan leaves outstanding, and carry a written verdict.
- **1 row was genuinely new** (`EnableDisableSubject.name`, the hoisted
  declaration from T5) and was composed from the report like the rest.

A further **9 notes that survived re-keying were corrected**, because the same
derivation showed them stale — this closes 06-10's explicit hand-off
("six notes name a witness coordinate the report no longer holds; `--check`
does not catch them"):

| Row | Note said | Report says |
| --- | --- | --- |
| `bridges/hooks/routing-state.ts:138:3` ×3 | first at `hooks-lifecycle.test.ts:457:44` | `:453:44` |
| `orchestrators/plugin/shared.ts:1245:7` | 2 witnesses, first at `shared.test.ts:1632:26` | 6 witnesses, first at `:1634:23` |
| `orchestrators/plugin/shared.ts:1246:7` | first at `shared.test.ts:1633:26` | `:1637:26` |
| `orchestrators/types.ts:221:3` ×3 | first at `update-flow.test.ts:8879:66` | `:8877:66` |
| `update-preflight.ts:131:56` | a `type-refinement` evidence sentence | the `type-selection` sentence its new category produces |

Final state:

```
node scripts/check-unused-type-members.audit.mjs --inventory   exit 0
node scripts/check-unused-type-members.audit.mjs --check       exit 1, 33 problems, 33 of them `unread`
```

Zero stale, missing, duplicate, incomplete or invalid rows. Exit 1 is the
designed and correct behaviour while any member is honestly outstanding.

## Verification

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | after every slice |
| `npm run lint` | 0 | after every slice |
| `node --test tests/orchestrators/reconcile/*.test.ts` + NFR-5 | 0 | 244/244 (T1, T6) |
| `node --test tests/orchestrators/marketplace/*.test.ts` + reconcile | 0 | 533/533 (T2) |
| `node --test` seam suites + `import-boundaries` | 0 | 161/161 (T3) |
| `node --test install-flow, completions, flag-catalog, no-test-only-surface` | 0 | 311/311 (T3 downstream) |
| `node --test tests/orchestrators/plugin/*.test.ts` + NFR-5 | 0 | 1,433/1,433 (T4) |
| `node --test` update / enable / shared / types | 0 | 475/475 (T5) |
| `SKIP=trufflehog pre-commit run --files …` | 0 | clean before each of the seven commits |
| `npm run check` | 0 | 6,471 unit assertions, 0 fail, plus integration; all four fallow sub-gates |
| `npm run test:coverage:unit` | 0 | see below |
| `npm run test:coverage:direct:all` | 0 | 236 pairs in 489.7 s; 2 pinned shortfalls matched exactly |
| `node scripts/check-unused-type-members.negative.mjs` | 0 | 7 of 7 |
| `node scripts/check-unused-type-members.mjs --json` | 1 | 33 findings, 0 unsupported, 90 validated contracts |

### Coverage

Read from the unmodified native `coverage/unit.lcov`, aggregated over the 227
`extensions/pi-claude-marketplace/` modules:

```
functions 1833/1833   branches 9049/9049   lines 62922/62922
modules below 100%: 0
```

Two production metrics moved, and both were investigated to their cause rather
than absorbed:

- **functions 1834 → 1833.** Exactly one production callable disappeared in the
  whole plan: `marketplaceNamesCachePath`. Confirmed by scanning the production
  diff for removed function-shaped lines — the only other three hits are
  signature rewrites of functions that still exist.
- **branches 9050 → 9049.** The production diff contains **zero** removed or
  added lines carrying `if`, `??`, `&&`, `||`, `?.` or a ternary, so no
  conditional was retired; the branch record rides with the removed method's
  body.
- **lines 62908 → 62922.** Net growth from the named types and their doc
  comments.

Nothing was orphaned: every axis is still 100 percent and no module fell below
it. No threshold was lowered, no source excluded, no pin relaxed.

## Assertion and coverage ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-12-T1 | `MarketplaceBlock.key` removed with the full R3 triple recorded; both `type-selection` coordinates in the same file re-pinned and re-accepted; analyzer 72 → 71, exit 1, contracts 87 validated. | Reconcile suites 244/244 including the NFR-5 gate; no branch retired by the removal. |
| 06-12-T2 | The failure pair is one declaration at all four sites; the autoupdate patch carries `Partial<MarketplaceConfigEntry>`; both removals state their triple; `remove.ts` refinement coordinates re-accepted at +9. 10 of 12 rows cleared; 2 recorded with the symmetry answer. | Marketplace + reconcile suites 533/533 under a hermetic agent dir. |
| 06-12-T3 | Every seam still enforces its original refusal — a non-recursive and a non-forced removal each still fail to compile against `RemoveDataDirFn`; `edge/completions/data.ts` appears in no commit; the mirror decision and its 06-11 coupling are written down; only the two engine-accepted entries were written. 10 of 12 rows cleared. | Seam suites 161/161 plus the import-boundary gate; 311/311 on the downstream install-flow and completions suites. |
| 06-12-T4 | Four reinstall resolvers share one return shape; the consumer's second state load is untouched; `Pick<MarketplaceDetails, "autoupdate">` still refuses `lastUpdatedAt` (probed, TS2375); nine contract coordinates re-accepted. 11 of 12 rows cleared; the twelfth refused and recorded. | Full plugin suite 1,433/1,433 plus NFR-5; `install-outcome.ts` pin re-measured with the uncovered branch count unchanged at 2/111. |
| 06-12-T5 | Every restated marker still refuses what it refused (three compiler probes: `partialable: false`, a wrong `kind`, and a failed row carrying a version — all rejected); no previously optional slot became required at any producer; the retired `kind` entry is removed by name; the enable-row dependency marker is byte-identical since `53fbc28d`. 2 of 7 rows cleared, 5 recorded. | Update / enable / shared / types suites 475/475; fallow's `private-type-leak` caught the hoisted base and was resolved by exporting it, not suppressing it. |
| 06-12-T6 | The shared detail carries only the two members both sides genuinely declare — the planner's pending-claim shape keeps its own `declaredSource` because it has no recorded source; nothing deleted that a consumer reads; the `satisfies` pins were updated with the shape, and dropping the excess key RESTORED two `@ts-expect-error` proofs it had made inert. All 5 rows cleared. | Reconcile suites 244/244 plus NFR-5; `plan.ts` gained only a type-only import from a sibling that names no git surface. |
| 06-12-T7 | A fresh analysis on the final snapshot reconciles exactly with the regenerated record (33 problems, all `unread`); the delta is reported as a measured 36 / 3 / 10 split with a named mechanism per outstanding row. | `npm run check` exit 0; unmodified native `coverage/unit.lcov` at 100 percent on all three axes with 0 modules below; both direct pins matched exactly; negative controls 7 of 7. |

### `fails_when` counterexamples exercised

- **T1** — "either contract coordinate is left stale (the analyzer then exits 2)": not hypothetical. T3 and T5 each hit it for real (`install-disable-cascade.ts:60:3`, `enable-disable.ts:1153:41`), both times as an exit-2 setup failure before any member verdict.
- **T2** — "a removed member has any reader in production or tests": caught `RemoveMarketplaceOutcome.name` before removal. Three test assertions observe it; the row was reclassified instead.
- **T3** — "`edge/completions/data.ts` is edited here": that file appears in none of this plan's seven commits.
- **T3** — "a seam stops enforcing what it enforced": probed. `{ recursive: false, force: true }`, `{ recursive: true, force: false }` and `{ recursive: true }` are all still rejected by `RemoveDataDirFn`.
- **T4** — "the reinstall consumer's second state load is removed": `selectMarketplaceTargets` still calls `loadScopeState` and still guards `record === undefined`; only the unread return slot went.
- **T4** — "a rendered list or info row changes bytes": the `details` annotation still rejects `lastUpdatedAt` (TS2375 under `exactOptionalPropertyTypes`), so the `<last-updated …>` token still cannot reach this surface.
- **T5** — "a contract entry is written the engine refused": three drafts were refused; all three were withdrawn, and the contract file carries only what the engine accepted.
- **T5** — "the enable-row dependency marker is edited to reach zero": `git diff 53fbc28d..HEAD` matches zero lines containing `partition` in `plugin/shared.ts`.
- **T6** — "a `satisfies` pin is treated as a reader": the six `ScopeReadResult` pins were updated with the shape, per D-04, and the update restored two proofs rather than weakening any.
- **T7** — "the final count is asserted rather than measured": every count in this summary comes from a recorded `--json` run diffed by `(path, owner, key)`.

## Deviations from Plan

### 1. [Documented choice] Two R4 restatements were reverted rather than shipped

The plan's T5 prescribes restating the `update-swap` and `update-preflight`
absence markers so the refinement proof can reach them. Both restatements were
built exactly as specified, both got past the refusal 06-06 measured, and both
were then refused at `narrows`. Rather than keep a reshaped exported type that
cleared no row, both were reverted. `update-swap.ts` ends byte-identical to its
pre-plan state. The plan's own `<refusal_precedent>` forbids reshaping
production source to satisfy a refused proof; the measured distance each
restatement travelled is recorded above instead.

### 2. [Documented choice] `UpdatePhaseFailure.msg` was recorded, not removed

The plan's T5 allows either outcome and names the test: "if any rollback or
cascade renderer reads it, record it as R5 rather than removing a rollback
diagnostic." No renderer reads it — but the standing obligation is stricter and
decides the case: *a slot a rollback path populates is behaviour even when
nothing reads it back today*. `phaseFailures` is populated by exactly one path,
the phase-3 rollback aggregation, and its header states the slot's contract.
Recorded with that reason.

### 3. [Documented choice] `PLUGIN_INFO_RENDER`'s filter was kept

T4 offers two honest endings. The filter was kept and the row recorded, after
the engine refused a `type-selection` draft for it. Reason written above:
`RenderFn` is contravariant in its message, so dropping the filter silently
widens every arm the moment a second cascade status exists, and the
`as const satisfies` pin cannot catch that.

### 4. [Rule 1 - Bug] Nine stale ledger notes corrected, against the hazard's default

Hazard 3 says to keep `findingIds` and `reasons` byte-identical when
re-measuring a direct pin, and the record's re-keyed notes were to be derived
rather than transcribed. Deriving them surfaced nine notes that *survived*
re-keying while naming a coordinate, a witness count or a contract category the
report no longer holds — including both `reasons` coordinates on the
`install-outcome.ts` pin, one of which was already stale before this plan ran.
A justification naming a coordinate the tree does not hold is certified as
`explained` by `--check` without being checkable, which is the exact failure
hazard 2 describes. All nine were corrected from the same measurement; no
`findingIds` entry and no argument changed.

### 5. [Rule 3 - Blocker] The hermetic-environment workaround was itself a defect

`tests/orchestrators/marketplace/remove.test.ts` reads the operator's real
`~/.pi/agent/` (a pre-existing leak already recorded in `deferred-items.md`).
The first mitigation tried — a shared `PI_CODING_AGENT_DIR` — works for a single
suite but **collapses every suite's user scope into one directory**, so a
concurrent test's user-scope write contaminates its neighbours. That
manufactured a failure in `npm run check` at `remove.test.ts:526` that looked
like a regression and was not. Re-run under a hermetic `HOME`, the same suite is
24/24 and `npm run check` exits 0. Recorded because the wrong workaround
produces a convincing false positive.

### 6. [Documented choice] Commit messages carry no plan scope

Project `CLAUDE.md` forbids milestone and phase identifiers in commit subjects
and bodies, which overrides the `{type}({phase}-{plan})` convention. Subjects use
the affected subsystem instead.

### 7. [Documented choice] `pre-commit` was run with `SKIP=trufflehog`

Prescribed by project `CLAUDE.md`. Every other hook ran and passed before each
of the seven commits. `--no-verify` was never used.

**Total deviations:** 7 (1 bug fixed, 1 blocker diagnosed, 5 documented choices).
**Impact:** none on behaviour. Two reverts leave two exported types exactly as
they were; the nine note corrections make the record checkable rather than
merely present.

## Observed Limits

1. **`narrows()` cannot prove a `never` pin over a non-union slot.**
   `constituentsOf` (`contracts.mjs:795`) returns `[type]` for a non-union, and
   `narrows` (`:825`) requires `chosen.length < allowed.length`, so `never`
   against `string` or `Error` gives `1 < 1`. Three rows in this group and the
   whole `never`-marker class across the repo are blocked on it. A bounded engine
   plan treating `never` as the empty constituent set clears all three here at
   once, with the restatements this plan reverted as its evidence.
2. **A whole-object `deepStrictEqual` is not modelled as a read of a member.**
   The same under-credit 06-09 measured for `WriteHookConfigResult.written` and
   06-13 for `MigrateFirstRunResult.reason` keeps both
   `RemoveMarketplaceOutcome.name` rows standing here.
3. **The completions-seam mirror needs one plan that owns both files.** The
   collapse runs `edge/` → `orchestrators/`, which the boundary permits; it
   cannot be landed half at a time, and no single repair plan in this phase owned
   both sides.

## Issues Encountered

One, measured and recorded rather than worked around: the `remove.test.ts`
user-scope leak already in `deferred-items.md` still forces a hermetic `HOME` for
local full-gate runs, and the obvious alternative mitigation is worse than the
disease (see deviation 5). It blocks nothing in CI and nothing in this plan's
diff reaches it.

## Next Phase Readiness

**This was the last of the six bounded repair plans.** The wave is complete:

| Plan | Owner group | Baseline | Repaired | Contracted | Outstanding |
| --- | --- | --- | --- | --- | --- |
| 06-09 | `bridges/hooks` | 26 | 25 | 0 | 1 |
| 06-14 | `bridges` (agents/commands/skills/mcp) | — | — | 4 | 0 |
| 06-10 | `bridges` slot removals | — | 8 | 0 | 0 |
| 06-11 | `edge` | 17 | 10 | 0 | 7 |
| 06-13 | `domain` / `persistence` / `platform` | 23 | 6 | 2 | 15 |
| 06-12 | `orchestrators` | 49 | 36 | 3 | 10 |

**The final phase residual is 33 unread, 0 unsupported, 90 validated contracts,
3,352 candidates**, at digest `feb875b4…`, distributed as: `orchestrators` 10,
`domain` 7, `edge` 7, `platform` 5, `persistence` 3, `bridges/hooks` 1.

**06-08's activation prerequisite is NOT met, and this plan alone was never
going to meet it.** The mandatory gate requires zero unread and zero unsupported
findings; unsupported is at zero, unread is at 33. Every one of the 33 carries a
written, measured reason, and they sort into four bounded engine gaps and one
product decision:

1. **`never` pins over non-union slots** (3 rows here) — the `narrows` limit
   above.
2. **Whole-object `deepStrictEqual` under-credit** (2 rows here, 1 in
   `bridges/hooks`, 3 in `persistence`) — the analyzer does not credit a member
   through a deep comparison of its container.
3. **Conditional-clause filters** (1 row in `edge`, 1 in `domain`) — named
   identically by 06-11 and 06-13.
4. **`external-output` origin and boundary limits** (6 rows in `edge`, 2 in
   `platform`) — 06-11 measured the boundary half, 06-13 the origin half;
   `contracts.mjs:348` never received the `propertySymbolOf` fix
   `flow.mjs:782` already has.
5. **`enableRowDependencies`'s `{ partition?: never }`** (1 row) — not an
   analyzer gap. There is no left operand to narrow and no readable form, and
   the refusal it enforces is load-bearing. It needs an owner decision, not a
   repair.

The operator now has the full, measured picture 06-08's fate depends on.

## Self-Check: PASSED

- `.planning/phases/06-unused-type-member-gate/06-12-SUMMARY.md` exists on disk.
- All 28 modified files exist on disk.
- `git log` holds all seven commits: `66dc2958`, `8d69cd23`, `2702dbac`,
  `108ab8f7`, `24d49210`, `e4b68037`, `927dc64f`.
- Every task's `<verify>` command was run and its exit status recorded above.
- The plan-level `<verification>` was run on one stable snapshot:
  `npm run check` exit 0, `npm run test:coverage:unit` 100 percent aggregate,
  `npm run test:coverage:direct:all` both pins matched, negative controls 7 of 7.

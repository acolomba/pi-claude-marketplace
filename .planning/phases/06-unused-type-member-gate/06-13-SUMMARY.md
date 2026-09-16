---
phase: 06-unused-type-member-gate
plan: "13"
subsystem: testing
tags: [typescript, static-analysis, domain, persistence, platform, contracts, peer-dependency, node-test]
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
    provides: The 80-row live baseline 06-11 left behind
provides:
  - "The `resources_discover` handler registered through the peer's own `ExtensionAPI.on` overload instead of an `as unknown as` rebinding, so the compiler checks both Pi mirrors against the installed declarations"
  - "Two `Same<>`-class pins in the paired suite, each measured RED by drifting the mirror before it was kept"
  - "Two validated `external-input` contract entries for the event members the installed declaration requires"
  - "Three unread hook-handler slots removed, proved type-neutral by the interface's own index signature and behaviour-neutral by an unmodified suite"
  - "One redundant narrowing-assertion slot dropped and one ad-hoc projection local folded onto `MarketplaceConfigEntry`, with byte-identical migration output"
  - "A measured 80 -> 72 live population: 6 rows repaired, 2 contracted, zero findings gained"
  - "Two engine refusals recorded with the engine's exact message and the mechanism measured with a compiler probe, and nothing accommodated"
  - "`MigrateFirstRunResult.reason` x3 left standing as a measured analyzer under-credit, with the crediting mechanism named"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `f57d8238`, reconciling with 72 problems that are ALL `unread`"
affects: [06-12, 06-08]

actuals:
  tokens: 4155
  tasks: 3
  commits: 4
plan_head_before: 02fb4bda29b411ccd2ab07af73dce1707e76c1de

tech-stack:
  added: []
  patterns:
    - "A hand-written mirror of a peer shape is bound to the peer's own overload, so the compiler rather than an assertion holds it to the installed declaration"
    - "A pin is kept only after its failing direction is measured by drifting the thing it pins; a pin that cannot be made to fail is proving nothing"
    - "An upstream type the package's `exports` map does not publish is reached by a route from a root-exported type, never by deep-importing an unpublished path"
    - "A compile-time proof is proved load-bearing by deleting it, recording the exact typecheck failure, and restoring it"
    - "An engine refusal is diagnosed to the exact predicate that failed, with a compiler probe, and recorded rather than accommodated"

key-files:
  created:
    - .planning/phases/06-unused-type-member-gate/06-13-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/schema.ts
    - extensions/pi-claude-marketplace/persistence/agents-index-io.ts
    - extensions/pi-claude-marketplace/persistence/migrate-config.ts
    - tests/platform/pi-api.test.ts
    - scripts/check-unused-type-members.contracts.json
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "The five Pi mirrors were NOT deleted. The triage's alternative -- keep only the members the handler needs -- would have dropped `type` and `reason`, both non-optional upstream, narrowing a pin on a shape this project does not own."
  - "`ResourcesDiscoverResult.themePaths` was kept even though the handler never builds it and the peer declares it optional: widening it to `number[]` fails typecheck at the registration, which is positive evidence the peer's overload constrains it."
  - "`platform/pi-api.ts` was never edited. The registration in `index.ts` changed instead, so the mirrors ended more checked than they started without touching the declarations themselves."
  - "Both `external-output` drafts were refused and recorded; the handler was NOT restructured to give the prover a non-union contextual type, matching 06-11's refusal to convert a method shorthand for the same reason."
  - "`MigrateFirstRunResult.reason` x3 left standing: the same five deep comparisons credit every sibling on those arms and none of the three `reason` rows, which is 06-06's deliberate two-or-more-arms under-credit, not a surplus slot."
  - "`AuthAttemptResult.authAttempted` x2 left standing: D-32-05 is a recorded decision and this plan has no authority to revoke one."
  - "`ResolveHookIfContext.homedir` / `.projectRoot` left standing and `bridges/hooks/if-field/` was not touched: 06-09 owns those files and has already completed."

patterns-established:
  - "A witness coordinate in the record is derived from the fresh report, never transcribed -- two of the five carried over here were wrong and were corrected before the record was committed"
  - "A physical line-count movement in coverage is reconciled against `git diff --numstat` before it is accepted"

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The `resources_discover` handler is registered through the peer's own `ExtensionAPI.on` overload, with both parameter and return checked against the installed declarations, and the returned discovery paths are unchanged"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run typecheck -- exit 0 with the assertion removed"
        status: pass
      - kind: unit
        ref: "node --test tests/platform/pi-api.test.ts tests/index.test.ts -- 43/43, no discovery expectation edited"
        status: pass
      - kind: other
        ref: "drift probe: skillPaths widened to number[] fails at extensions/pi-claude-marketplace/index.ts(86,5) TS2769 -- the registration itself is what catches it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every surviving Pi mirror member is held to the installed declaration by a pin whose failing direction was measured before the pin was kept"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "six drift measurements, each applied then restored; five fail typecheck by name, the sixth records a stated limit"
        status: pass
      - kind: unit
        ref: "tests/platform/pi-api.test.ts -- Same<> against Extract<Peer.ExtensionEvent, { type: \"resources_discover\" }> plus the overload-acceptance pin"
        status: pass
      - kind: other
        ref: "cmp extensions/pi-claude-marketplace/platform/pi-api.ts against its pre-drift backup -- byte-identical; every drift restored before commit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two `external-input` contract entries were accepted by the real engine against this tree; two `external-output` drafts were refused and recorded with the engine's message and the measured mechanism"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "four drafts submitted one at a time -- 2 accepted (gate reports 87 validated), 2 refused at exit 2 and reverted"
        status: pass
      - kind: other
        ref: "compiler probe: getContextualType of the returned literal is the union `ResourcesDiscoverResult | PromiseLike<ResourcesDiscoverResult>`, so getPropertyOfType answers undefined"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three removed hook-handler slots changed no type and no verdict, and the two persistence repairs changed no bytes and no throw message"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test \"tests/domain/**/*.test.ts\" -- 701/701; tests/bridges/hooks -- 557/557; tests/persistence -- 165/165. No test file edited."
        status: pass
      - kind: unit
        ref: "tests/persistence/agents-index-io.test.ts -- 'rejects an adjacent agents-index schema version' and 'rejects a version-1 envelope without the agents array' both pass"
        status: pass
      - kind: unit
        ref: "tests/persistence/migrate-config.test.ts -- 'writes exact first-run bytes and replays as a byte-identical no-op' passes unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "The per-layer delta is measured by (path, owner, key) set difference against a pre-edit baseline, with zero findings gained"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "baseline at 02fb4bda: 80 unread / 85 contracts. Final: 72 unread / 87 contracts. GAINED 0, REMOVED 8."
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1, 72 problems, ALL `unread`; zero stale, missing, duplicate, incomplete or invalid"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nothing was weakened: the whole gate is green, aggregate production unit coverage is still 100 percent with no module below it, and the negative controls still pass"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "npm run check -- exit 0"
        status: pass
      - kind: other
        ref: "npm run test:coverage:unit -- 227 modules, functions 1834/1834, branches 9050/9050, 0 below 100%"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -- exit 0, 236 pairs, 2 pinned shortfalls matched exactly, pin file untouched"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7 ok"
        status: pass
    human_judgment: false

duration: 78 min
completed: 2026-09-16
---

# Phase 06 Plan 13: Domain, Persistence and Platform Owner Group Summary

**The five Pi mirrors were kept and made genuinely checked -- the registration now binds to the peer's own overload, so a drifted mirror fails `npm run typecheck` where before it failed nothing -- and eight of the twenty-three rows left the population by a removed declaration or an engine-accepted contract, with every one of the fifteen survivors carrying a measured reason.**

## Performance

- **Duration:** 78 min
- **Tasks:** 3 of 3
- **Files changed:** 7 (4 production, 1 test, 1 contract file, 1 planning record)
- **Commits:** 4 task/record commits plus this metadata commit

## The measured split

The three layers started at 23 unread rows and end at 15.

| Layer | Baseline | Repaired | Contracted | Outstanding | Final |
| --- | --- | --- | --- | --- | --- |
| `domain` | 10 | 3 | 0 | 7 | 7 |
| `persistence` | 6 | 3 | 0 | 3 | 3 |
| `platform` | 7 | 0 | 2 | 5 | 5 |
| **Total** | **23** | **6** | **2** | **15** | **15** |

Live population, measured with `node scripts/check-unused-type-members.mjs --json`
and diffed by `(path, owner, key)` against a pre-edit baseline taken at revision
`02fb4bda`:

```
80 unread -> 78 (task 1) -> 75 (task 2) -> 72 (task 3)
removed 8   gained 0
contracts 85 -> 87        candidates 3403 -> 3397        unsupported 0
```

Zero findings gained at every measurement point, matching the standard 06-09,
06-14, 06-10 and 06-11 set.

The plan projected roughly 12-13 outstanding. The landing is 15, and the two
extra rows are the two `external-output` drafts the engine refused. The plan
names a refusal as an acceptable outcome and forbids accommodating one, so the
shortfall is the honest result rather than a miss.

## The verdict on the five Pi mirrors

**Kept. All five. And they end more checked than they started.**

The plan's headline claim was verified against the installed peer
(`@earendil-works/pi-coding-agent@0.85.1`), not inferred:

- The peer's root `dist/index.d.ts` re-exports about a hundred extension types
  and **omits** `ResourcesDiscoverEvent` and `ResourcesDiscoverResult`. That
  omission is exactly why the mirrors were hand-written, and it is the same
  reason already recorded in `pi-api.ts` for `ToolResultEventResult` and
  `PiTextContentBlock`.
- `dist/core/extensions/types.d.ts:404-413` declares both, **field for field
  identical** to the local copies, including `themePaths?: string[]`.
- `dist/core/extensions/types.d.ts:908` carries the overload the registration
  needs: `on(event: "resources_discover", handler: ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>): void`.
  The task's precondition is therefore met, and it was checked before anything
  was changed.

The weakness was real: `index.ts:56` rebound `pi.on` through `as unknown as`,
and an asserted value is checked against nothing. The repair removed the
assertion and called the peer's overload directly, keeping the explicit
parameter annotations that name the local mirrors. The handler body, its
ordering commentary and both deferral points are untouched -- this changed what
the compiler checks, not what runs.

### Every pin was measured RED before it was kept

Six drifts, each applied to `platform/pi-api.ts`, measured, then restored. The
file is byte-identical to its pre-drift backup and to the commit.

| Drift | Result | Caught by |
| --- | --- | --- |
| `ResourcesDiscoverEvent.type` widened to `string` | FAILS | `tests/platform/pi-api.test.ts(93,12): error TS1360` -- the `Same<>` pin |
| `ResourcesDiscoverEvent.reason` deleted | FAILS | same pin at `(93,12)`, plus two `satisfies` literals |
| `ResourcesDiscoverResult.skillPaths` -> `number[]` | FAILS | `extensions/pi-claude-marketplace/index.ts(86,5): error TS2769: No overload matches this call.` -- **the registration itself** |
| `ResourcesDiscoverResult.promptPaths` -> `number[]` | FAILS | same, at `index.ts(86,5)` |
| `ResourcesDiscoverResult.themePaths` -> `number[]` | FAILS | same, at `index.ts(86,5)` |
| `ResourcesDiscoverResult.themePaths` deleted | fails, but only at the suite's `satisfies` literal | stated limit, below |

Two things fall out of that table that were worth measuring rather than
assuming:

1. **The registration alone does not pin the event.** Drifts 1 and 2 leave
   `index.ts` green, because the handler's parameter is checked
   contravariantly: an upstream event is still assignable to a *wider* local
   mirror. The `Same<>` pin is what closes that direction, and it is reachable
   exactly, through the root-exported `ExtensionEvent` union:
   `Extract<Peer.ExtensionEvent, { type: "resources_discover" }>`.
2. **`themePaths` is not surplus.** The handler never builds it and the peer
   declares it optional, so nothing *compels* it in the contract sense -- yet
   widening it still fails at the registration, because the peer's own overload
   constrains the type of a member it declares. That is positive evidence
   against deleting it, which is what the plan required before any mirror
   member could be removed.

### The one direction that is not pinned, stated rather than papered over

No root-exported name reaches `ResourcesDiscoverResult`. The package's
`exports` map publishes only `.`, and deep-importing `dist/core/extensions/`
would name a path the peer does not publish. Two type-level routes were
probed and both measured as unavailable:

```ts
// both resolve to the no-match branch
type A<T> = T extends { on(event: "resources_discover", handler: ExtensionHandler<infer E, infer R>): void } ? [E, R] : "NO-MATCH";
type B<T> = T extends { (event: "project_trust", ...): void; (event: "resources_discover", handler: ExtensionHandler<infer E, infer R>): void } ? [E, R] : "NO-MATCH";
```

TypeScript infers from the **last** signature of an overloaded source, so
`infer` through `ExtensionAPI["on"]` cannot select the second overload. Plain
assignability *does* resolve overloads, so the kept pin is the strongest
statement available:

```ts
type PeerChecksLocalResourcesDiscoverHandler = Peer.ExtensionAPI["on"] extends (
  event: "resources_discover",
  handler: (event: PiBoundary.ResourcesDiscoverEvent, ctx: PiBoundary.ExtensionContext)
    => Promise<PiBoundary.ResourcesDiscoverResult>,
) => void ? true : false;
```

It holds every member of both mirrors to the upstream member's **type**. It
does **not** catch a member dropped from the result mirror, because every
upstream result slot is optional and a handler returning fewer of them stays
assignable. That limit is recorded in the test's own comment and in the row's
triage note rather than hidden, and the drift table above measures it.

## Contract drafts: 2 accepted, 2 refused

Four drafts, each submitted to the real engine against the real program, one at
a time, with every coordinate derived from the compiler's view of the syntax.

| Draft | Category | Outcome |
| --- | --- | --- |
| `pi-api.ts:91:3` `ResourcesDiscoverEvent.type` | external-input | **ACCEPTED** |
| `pi-api.ts:93:3` `ResourcesDiscoverEvent.reason` | external-input | **ACCEPTED** |
| `pi-api.ts:97:3` `ResourcesDiscoverResult.skillPaths` | external-output | **REFUSED** |
| `pi-api.ts:98:3` `ResourcesDiscoverResult.promptPaths` | external-output | **REFUSED** |

The gate now reports `contracts: 87 validated`.

The two accepted entries are the first `external-input` entries in the file.
They are what the removed assertion made possible: `assertLocalNecessity`
refuses a necessity site reached through an assertion (`insideAssertion` is
true, and the contextual signature was a local const rather than an installed
declaration). With the registration bound to the peer's overload, the callback
at `index.ts:87:5` has a contextual signature declared in
`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`,
that signature requires both keys, and the callback's own annotated parameter
resolves to the contracted declaration. All three of `assertLocalNecessity`'s
checks pass for the first time.

### The two refusals, and the mechanism measured rather than guessed

```
Invalid contract: extensions/pi-claude-marketplace/platform/pi-api.ts:97:3
  origin extensions/pi-claude-marketplace/index.ts:161:11
  does not build ResourcesDiscoverResult.skillPaths
```

```
Invalid contract: extensions/pi-claude-marketplace/platform/pi-api.ts:98:3
  origin extensions/pi-claude-marketplace/index.ts:162:11
  does not build ResourcesDiscoverResult.promptPaths
```

The refusal is at the **origin** half, which is the opposite half from 06-11's
six refusals, so it is a distinct limit. A compiler probe settled the cause:

```
161:11 -> PropertyAssignment "skillPaths: [...discovered.skillPaths]"
   contextual of parent: ResourcesDiscoverResult | PromiseLike<ResourcesDiscoverResult>
   property symbol: undefined
```

The returned object literal sits inside an `async` handler annotated
`Promise<ResourcesDiscoverResult>`, so its contextual type is a **union**: an
async function may return the value or a thenable of it.
`originCandidates` (`scripts/check-unused-type-members.contracts.mjs:348`)
asks `checker.getPropertyOfType` directly, and the checker answers a union only
when **every** constituent declares the key. `PromiseLike<T>` does not declare
`skillPaths`, so the property resolves to `undefined` and the origin looks like
it builds nothing.

This is the same mechanism 06-06 already corrected **once**, in the flow walk:
`propertySymbolOf` (`scripts/check-unused-type-members.flow.mjs:782`) resolves a
key exactly one arm spells to that arm, and deliberately refuses two. The
contract engine's `originCandidates` never received that correction.

Nothing was worked around. The prover was not widened, the analyzer was not
edited, and the handler was **not** restructured into
`const result: ResourcesDiscoverResult = { ... }; return result;` -- a rewrite
that would make the contextual type exact and the draft pass, purely to suit
the analyzer. That is the failure mode 06-CONTEXT's implementation discretion
names and 06-11 already declined once. Both rows stay findings.

## Per-row accounting

### Repaired (6)

| Declaration | Member | How it was cleared |
| --- | --- | --- |
| `domain/components/hooks/schema.ts:8:3` | `HookHandlerEntry.statusMessage` | Removed. |
| `domain/components/hooks/schema.ts:9:3` | `HookHandlerEntry.once` | Removed. |
| `domain/components/hooks/schema.ts:10:3` | `HookHandlerEntry.async` | Removed. |
| `persistence/agents-index-io.ts:120:27` | `obj.schemaVersion` | Removed from the narrowing assertion. |
| `persistence/migrate-config.ts:140:20` | `entry.source` | The local now names `MarketplaceConfigEntry`. |
| `persistence/migrate-config.ts:140:36` | `entry.autoupdate` | Same substitution. |

**The three handler slots were proved type-neutral before removal, not after.**
`HookHandlerEntry` carries `[key: string]: unknown`, so a consumer reading any
of the three still sees `unknown`; none of the three appears in
`HOOK_HANDLER_SCHEMA`'s own property list; and the suite's
"a command handler with extra properties" case supplies all three inside a
handler object purely to prove the validator admits extras -- alongside
`futureHandlerField`, which was never declared at all. The sibling slots that
look identical were checked and left alone: the report credits
`HookHandlerEntry.shell` and `.args` with production witnesses at
`bridges/hooks/spawn-helpers.ts:45:40` and `:36:39`. 701/701 domain tests and
557/557 hooks-bridge tests pass with **no test file edited**.

**The agents-index disposition was corrected, not followed.** The audit's
clustered disposition filed `obj.schemaVersion` as a payload handed to a
consumer outside the tree. It is not: it is an assertion literal, nothing is
built or written at that site, and the runtime version check one line above has
already rejected everything but version one. The runtime check is untouched and
both throw paths still fire -- `rejects an adjacent agents-index schema version`
and `rejects a version-1 envelope without the agents array` both pass.

**The projection local was checked against its consumer before the swap.**
`MarketplaceConfigEntry` is `Type.Static<Type.Object({ source: Type.String(),
autoupdate: Type.Optional(Type.Boolean()) })>` -- the same two slots, the same
optionality, no `readonly` modifier -- so the conditional `entry.autoupdate =
true` still type-checks under `exactOptionalPropertyTypes`. The byte-exact
first-run and replay case passes unchanged.

### Outstanding with a recorded reason (15)

| Declaration | Member | Why it stands |
| --- | --- | --- |
| `domain/resolver-types.ts:19:7` | `DroppedHookSchema.matcher` (group arm) | Live compile-time proof. |
| `domain/resolver-types.ts:32:7` | `DroppedHookSchema.matcher` (handler arm) | Same. |
| `domain/components/hook-tool-names.ts:52:21` | `PiToolName.toolName` | Conditional-clause filter, no category. |
| `domain/components/hook-if-targets.ts:55:3` | `IfPrefixTarget.piEvents` | `satisfies` constraint, no category. |
| `domain/components/hook-if-targets.ts:56:3` | `IfPrefixTarget.extractTarget` | Same. |
| `domain/components/hooks.ts:77:3` | `ResolveHookIfContext.homedir` | Deliberate cross-layer duplicate; repair is 06-09's file. |
| `domain/components/hooks.ts:79:3` | `ResolveHookIfContext.projectRoot` | Same. |
| `persistence/migrate-config.ts:71:7` | `MigrateFirstRunResult.reason` | Analyzer under-credit, measured. |
| `persistence/migrate-config.ts:76:7` | `MigrateFirstRunResult.reason` | Same. |
| `persistence/migrate-config.ts:82:7` | `MigrateFirstRunResult.reason` | Same. |
| `platform/git-auth-callbacks.ts:41:39` | `AuthAttemptResult.authAttempted` | D-32-05, a recorded decision. |
| `platform/git-auth-callbacks.ts:42:34` | `AuthAttemptResult.authAttempted` | Same. |
| `platform/pi-api.ts:97:3` | `ResourcesDiscoverResult.skillPaths` | `external-output` refused at the origin. |
| `platform/pi-api.ts:98:3` | `ResourcesDiscoverResult.promptPaths` | Same. |
| `platform/pi-api.ts:99:3` | `ResourcesDiscoverResult.themePaths` | Never built; no origin exists at all. |

Every compile-time proof in that table was proved live by deleting it, running
`npm run typecheck`, recording the exact failure, and restoring it. All four
drifted files are byte-identical to their pre-drift backups.

| Proof deleted | Measured failure |
| --- | --- |
| `DroppedHookSchema` group-arm `matcher` | `resolver-types.ts(66,43): error TS2344: Type 'false' does not satisfy the constraint 'true'` -- the `DroppedHookArmKeysCheck` assertion -- **and** `plugin-resolver.ts(133,3): error TS2375`, where `droppedHooks` collapses to `never[]` |
| `DroppedHookSchema` handler-arm `matcher` | the same two errors |
| `PiToolName` filter key renamed | `PiToolName` collapses to `never`; `hook-if-targets.ts(88,19): error TS2769: No overload matches this call.` |
| `IfPrefixTarget.piEvents` | five errors, one per table entry: `hook-if-targets.ts(87,5): error TS2353 ... 'piEvents' does not exist in type 'IfPrefixTarget'` and at 91:5, 95:5, 99:5, 103:5 |
| `IfPrefixTarget.extractTarget` narrowed | five errors: `hook-if-targets.ts(89,5): error TS2322: Type '"command"' is not assignable to type '"nope"'` and at 93:5, 97:5, 101:5, 105:5 |
| `ResolveHookIfContext.homedir` | `event-router.ts(149,47): error TS2345 ... Property 'homedir' is missing in type 'ResolveHookIfContext' but required in type 'CompileIfPredicateContext'`, and again at 670:47 |
| `ResolveHookIfContext.projectRoot` | the same, naming `projectRoot` |

Two of those results are worth calling out because they are stronger than the
plan predicted. The `DroppedHookSchema` deletions fail **twice** -- at the
drift assertion *and* at a real consumer -- so the proof is not merely
self-referential. And the two `ResolveHookIfContext` slots are not only an
analyzer artifact: deleting either one breaks the bridge hand-off at
`event-router.ts`, so the compiler already enforces the duplicate. They are
under-credited **and** load-bearing, which is a stricter reason to keep them
than "the analyzer cannot see the read".

`IF_PREFIX_TARGETS`'s declared type was **not** widened to manufacture a read.
The key order is locked against an architecture test's introspection, and
widening would change what consumers see.

## `MigrateFirstRunResult.reason` x3: a measured analyzer under-credit

The triage filed all three rows as "unread slot... confirm surplus and remove
it". That is wrong about the tree, and the contradiction was measured with
06-09's method rather than argued.

The suite deep-compares the whole result on every path. Derived from the fresh
`--json` report, not transcribed:

- The operations model credits `deep-comparison` **22,950** times tree-wide, so
  the model is live.
- The suite carries **five** whole-object deep comparisons, at
  `tests/persistence/migrate-config.test.ts` 230:26, 250:26, 269:26, 293:26 and
  299:26.
- The report credits **all five** to every sibling member of those same arms:
  `migrated` 20 witnesses, `filePath` 20, `entryCount` 5, `error` 5.
- All three `reason` rows carry an **empty** witness list.

The difference is how many arms spell the key. `migrated` is on all four arms,
so `getPropertyOfType` answers the union directly. `entryCount` and `error` are
each on exactly one arm, which 06-06's single-arm-union rule resolves. `reason`
is on **three** arms, and 06-06 deliberately leaves a key two or more arms spell
unsettled -- under-crediting keeps a member a finding rather than excusing it by
its neighbour. This is the designed direction, so it is a finding about the
analyzer, never a defect in the product, and never a reason to edit
`extensions/`.

Deleting the discriminant would also delete a guarantee: cutting `error` along
`reason` is what makes `tests/persistence/migrate-config.test.ts:34`
(`@ts-expect-error \`error\` exists only on the existing-invalid arm`) hold.

Closing these rows wants a bounded analyzer plan that attributes a whole-object
comparison by the discriminant's **value** where the key alone is ambiguous,
with its own drift controls -- not a widening of the existing rule.

## Owner hand-offs

### 1. A conditional-clause proof -- shared with plan 06-11, confirmed

`PiToolName.toolName` (`domain/components/hook-tool-names.ts:52:21`) is exactly
the shape 06-11 recorded for `ParsedCommandArgs.required`
(`edge/args-schema.ts:60:70`): a filter literal inside a conditional type's
`extends` clause, doing the type-system work a two-argument selection does.
`selectionOf` requires the filter literal's parent to be a `TypeReferenceNode`
with exactly two type arguments; here the parent chain is
`TypeLiteral -> ConditionalType`. **Confirmed from this side: one bounded engine
plan adding a conditional-clause proof with its own drift controls clears both
rows together.** Neither may be cleared by rewriting the product type.

### 2. `ResolveHookIfContext` -- named, deliberately not taken

The repair is to make the bridge-side `CompileIfPredicateContext` an alias of
the domain declaration. `bridges -> domain` is the legal import direction and it
is the same shape 06-06 named for the async-rewake duplicate. It edits
`extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`, which **06-09
owned and has already completed**, so this plan did not reach into it. A
follow-up holding those files closes both rows.

### 3. An `external-output` origin that survives a union contextual type

New, and measured here for the first time. `originCandidates`
(`contracts.mjs:348`) needs the single-arm-union resolution `propertySymbolOf`
(`flow.mjs:782`) already performs, with its own two-arm-ambiguity control. This
is a bounded engine plan in the prover, not a change in `index.ts`. It clears
`skillPaths` and `promptPaths`; it does **not** reach `themePaths`, which is
never built at all and wants a different category -- one for a member that
exists to mirror an external declaration's complete shape.

### 4. A category for a `satisfies`-constrained interface

`IfPrefixTarget.piEvents` / `.extractTarget` are members of an unexported
interface that exists only as the right-hand side of an `as const satisfies`
constraint; every read goes through the const's own inferred type. A
`satisfies`-constraint category with the constrained const as its evidence would
settle both.

### 5. A schema-proof category

`DroppedHookSchema.matcher` x2 is 06-06's already-recorded observed limit: a
compile-time schema proof has no contract category, and nothing reads these
members or can.

### 6. D-32-05 -- a decision, not an analyzer gap

`AuthAttemptResult.authAttempted` x2 wants the decision revisited, not a source
repair. Its twin `DeviceFlowResult.authAttempted`
(`domain/github-auth.ts:145:39` / `:146:34`) is `test-only-observed` with 36
witnesses, first at `tests/domain/github-auth.test.ts:1016:28`; the platform copy
exists only because `platform/README.md` forbids a platform -> domain import, so
it has no witness of its own.

## Verification

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | after each task, and after each of thirteen drift measurements was restored |
| `npm run lint` | 0 | after task 1 |
| `node --test tests/platform/pi-api.test.ts tests/index.test.ts` | 0 | 43/43 |
| `node --test "tests/domain/**/*.test.ts"` | 0 | 701/701, no test file edited |
| `node --test "tests/bridges/hooks/**/*.test.ts"` | 0 | 557/557, no test file edited |
| `node --test "tests/persistence/**/*.test.ts"` | 0 | 165/165, no test file edited |
| `node --test tests/scripts/check-unused-type-members.contracts.test.ts` | 0 | included in the 91/91 task-1 run |
| `node scripts/check-unused-type-members.mjs --json` | 1 | 80 -> 78 -> 75 -> 72; 1 is a member verdict, not a failure |
| `node scripts/check-unused-type-members.mjs` with each of 4 drafts | 1 / 2 | 2 accepted, 2 refused and reverted |
| `node scripts/check-unused-type-members.audit.mjs --inventory` | 0 | 3397 candidates, 72 unresolved, digest `f57d8238` |
| `node scripts/check-unused-type-members.audit.mjs --check` | 1 | 72 problems, **all** `unread`; zero stale-source, stale-record, missing, duplicate, incomplete or invalid |
| `npm run check` | 0 | typecheck, lint, workflow lint + negative, all four fallow sub-gates, format check, both corresponding-test gates, the direct-coverage negative gate, the unit suite and the integration suite |
| `npm run test:coverage:unit` | 0 | see below |
| `npm run test:coverage:direct:all` | 0 | 236 pairs in 472.6s; 2 pinned shortfalls matched `scripts/test-coverage-direct.pin.json` exactly |
| `node scripts/check-unused-type-members.negative.mjs` | 0 | 7 of 7 ok |
| `SKIP=trufflehog pre-commit run --files <set>` | 0 | run before each of the four commits |

Test runs used a hermetic `HOME`, so no measurement was contaminated by the
operator's real `~/.pi/agent/` state.

### Coverage

Aggregate production unit coverage, read directly from `coverage/unit.lcov`:

```
227 modules under extensions/
functions 1834/1834   branches 9050/9050   lines 62908/62908
modules below 100%: 0
```

Functions and branches are **unchanged** from 06-11's 1834/9050. Lines moved
62,904 -> 62,908, and the movement was reconciled rather than waved through:
`git diff --numstat` over the four production files reads `0/3` for
`hooks/schema.ts`, `83/78` for `index.ts`, `1/1` for `agents-index-io.ts` and
`3/1` for `migrate-config.ts` -- a net of exactly four physical lines added, all
of them comment or call-wrapping. No threshold was lowered, no exclusion added,
and `scripts/test-coverage-direct.pin.json` is byte-identical.

### Contract drift

The plan's first hazard was checked, not assumed: of the 87 validated entries,
none names `hooks/schema.ts`, `agents-index-io.ts`, `migrate-config.ts`,
`hook-if-targets.ts`, `hook-tool-names.ts` or `components/hooks.ts`. The one
pre-existing `platform/pi-api.ts` entry is at `117:56`, and `pi-api.ts` was never
edited. `resolver-types.ts` holds seven entries and was only ever drifted and
restored. No coordinate sat below an edit point, so nothing needed re-anchoring,
and the gate exits 1 with a member verdict rather than 2 with a setup failure.

### One new cost, recorded

The two accepted `external-input` entries name coordinates **inside
`node_modules/`**. A peer upgrade that moves those lines will refuse the entries
by name (`upstream ... does not declare type in an installed declaration`) and
the gate will exit 2. That is the safe direction -- a peer bump surfaces as a
named setup failure rather than a silent pass -- but it is a real maintenance
edge and is recorded here so a future reader does not read the exit 2 as a
regression.

## Assertion and coverage ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-13-T1 | Before: five `pi-api.ts` rows unread, two `git-auth-callbacks.ts` rows unread. After: `type` and `reason` are `explicit-contract`, three result rows stay unread with a recorded refusal or limit, both auth rows stay unread with D-32-05 named. Six drift measurements, five failing by name; the registration binds to the peer's own overload; 43/43 across the two suites with no discovery expectation edited; four drafts submitted to the real engine, two accepted, two refused with the message recorded. | Type-only edits plus a call-shape change; functions 1834 and branches 9050 unchanged. `index.ts` +5 physical lines. |
| 06-13-T2 | Before: ten `domain` rows. After: seven; the three removed slots are proved type-neutral by the index signature and the validator's property list, and behaviour-neutral by 701/701 + 557/557 with **no test file edited**. Every surviving proof has a recorded deletion that fails typecheck, with the exact error. No production type widened, no test added to credit a declaration, no `bridges/` file touched. | Type-only edit. `hooks/schema.ts` -3 physical lines; functions and branches unchanged. |
| 06-13-T3 | Before: six `persistence` rows. After: three; both throw paths keep their exact messages, the first-run and replay bytes are unchanged, and the `reason` discriminant is untouched with its five witness sites and four credited siblings derived from the fresh report. The contract-drift check was run: no entry names any file this plan edited, so nothing was retired. | Final snapshot: `npm run check` exit 0, 1834/1834 functions, 9050/9050 branches, 0 modules below 100%, both direct pins matched exactly and untouched. |

### `fails_when` counterexamples exercised

- **T1** -- "a mirror member is deleted without positive evidence that the peer does not compel it": no mirror member was deleted. `platform/pi-api.ts` is byte-identical to its pre-plan state, verified with `cmp` and `git diff HEAD`.
- **T1** -- "a contract entry is written without the engine accepting it against this tree": the two refused drafts were reverted; the file holds only the two the engine accepted, and the gate reports 87 validated.
- **T1** -- "a pin is kept without a measured failing direction": six drifts measured, each applied and restored; the one direction that cannot be made to fail is recorded as a limit in the test's comment and the row's note rather than kept as a silent pin.
- **T1** -- "the handler's returned paths change": `tests/index.test.ts` was not modified and its discovery expectations pass unchanged.
- **T1** -- "the assertion at the registration site is left in place while contract entries claiming an external boundary are written anyway": the `as unknown as` rebinding is gone; the accepted entries depend on its removal, since `assertLocalNecessity` refuses an assertion-reached necessity by name.
- **T2** -- "a member whose deletion breaks typecheck is left deleted": all seven measured deletions were restored; the four files are byte-identical to their pre-drift backups.
- **T2** -- "a production type is widened to manufacture a read": `IF_PREFIX_TARGETS`'s declared type is untouched.
- **T2** -- "a test is added whose only effect is to make a declaration look used": no test file was modified in the task-2 commit at all.
- **T2** -- "a bridges-owned file is edited": no file under `bridges/` appears in any commit of this plan.
- **T2/T3** -- "a row is left `pending` in the ledger": `--inventory` reports 0 pending of 395, and `--check` reports zero `incomplete`.
- **T3** -- "the migration's written bytes move": the byte-exact first-run and replay case passes with the same expected string and no test edit.
- **T3** -- "either agents-index throw path changes its message or stops firing": both named tests pass; the runtime version check above the assertion was not touched.
- **T3** -- "the reason discriminant is deleted or a test is reshaped to credit it": `migrate-config.ts` lines 63-84 are unchanged and `tests/persistence/migrate-config.test.ts` was not modified.
- **T3** -- "the closing report asserts a count it did not measure": every number above comes from a `--json` set difference or an lcov read, and the split table is the first section of this summary.

## Deviations from Plan

### 1. [Recorded, not fixed] The `external-output` drafts were refused at the origin, not the boundary

- **Found during:** Task 1
- **Issue:** The plan expected the result members to be `external-output` candidates with the build site as origin and the checked return as boundary. The boundary half was never reached: the engine refused at the origin, because the returned literal's contextual type is a union an `async` return produces.
- **Action:** Recorded both refusals with the engine's exact message, measured the cause with a compiler probe, and named the bounded `originCandidates` repair. The handler was not restructured to give the prover an exact contextual type. Both rows moved to outstanding.
- **Commit:** `f1ba0619`

### 2. [Rule 2 - missing critical] `themePaths` was kept, against the plan's own ladder-4 test

- **Found during:** Task 1
- **Issue:** The plan says "a member the handler never builds and the peer never requires is ladder case 4" -- which describes `themePaths` exactly, since the peer declares it optional.
- **Fix:** Measured before acting, per the plan's overriding requirement that a mirror member needs *positive evidence the peer does not compel it*. Widening `themePaths` to `number[]` fails typecheck at the registration, so the peer's overload does constrain it. Removing it would make the mirror an incomplete statement of a shape this project does not own, and would weaken the suite's `satisfies` literal. Kept, with the evidence recorded on the row.
- **Verification:** drift measurement at `index.ts(86,5): error TS2769`; `git diff HEAD -- platform/pi-api.ts` empty.
- **Commit:** `f1ba0619`

### 3. [Rule 1 - Bug] Two transcribed witness coordinates in the record were wrong

- **Found during:** Task 3 record close-out
- **Issue:** Notes drafted from an earlier report slice cited `tests/persistence/migrate-config.test.ts:229` and `tests/domain/github-auth.test.ts:1205:28`. Re-derived from the fresh report, the real values are the five deep-comparison sites at 230/250/269/293/299 and a first witness at `github-auth.test.ts:1016:28`. The `1205` figure came from an unsorted three-element slice, not the first witness.
- **Fix:** Re-derived all five affected notes from the fresh `--json` report and re-applied them before the record was committed. This is exactly the 06-10 hazard the plan names.
- **Verification:** `--check` exit 1 with zero `stale-record` and zero `incomplete`.
- **Commit:** `e45d316d`

### 4. [Documented choice] The plan's `D-32-05` attribution was verified, and the source cites a different ID

- **Found during:** Task 1
- **Issue:** The plan attributes the `authAttempted` marker to D-32-05; the declaration's own comment cites `CP-9`.
- **Action:** Both were checked. D-32-05 is real -- it is recorded in `.planning/milestones/v1.6-phases/32-device-flow-state-machine-auth/32-CONTEXT.md` and referenced from two later milestones. `CP-9` is the local comment's own label for the same rule. The row's note names D-32-05, since that is the durable decision ID.
- **Commit:** `e45d316d`

### 5. [Documented choice] Commit messages carry no plan scope

The GSD task-commit protocol asks for `{type}({phase}-{plan}):`. The project's
`CLAUDE.md` forbids milestone and phase identifiers in commit messages and takes
precedence, matching every prior plan in this phase. The four commits are listed
below by hash.

### 6. [Documented choice] `pre-commit` was run with `SKIP=trufflehog`

This checkout is a linked worktree and trufflehog cannot read a worktree's git
index. Every other hook ran and passed before each commit. No hook was bypassed
with `--no-verify`.

---

**Total deviations:** 1 auto-fixed bug, 1 evidence-driven ladder correction, 1
recorded refusal, 3 documented choices. **Impact:** no production behaviour
changed; no proof widened; no analyzer edited; no file outside this plan's owner
scope touched.

## Known Stubs

None. Every row this plan leaves outstanding is a recorded finding with a
measurement behind it, not a placeholder.

## Observed Limits

- **Type-level overload selection is not available.** Two `infer` forms through `ExtensionAPI["on"]` were probed and both fall to the no-match branch; TypeScript infers from the last signature of an overloaded source. Plain assignability does resolve overloads, which is why the kept handler pin is a bare conditional rather than a `Same<>`.
- **An optional-only external shape cannot be pinned against member loss.** Every `ResourcesDiscoverResult` slot is optional upstream, so a handler returning fewer of them stays assignable and no upstream-checked pin can catch a dropped member.
- **A contract entry that names `node_modules/` is version-coupled.** It fails safe -- exit 2 by name -- but a peer upgrade will require re-anchoring.
- **`originCandidates` inherits the union-property limit 06-06 fixed in the flow walk.** Measured here for the first time; it is why an `async` handler's returned literal cannot currently carry an `external-output` origin.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at
a trust boundary. T-06-13-01 is mitigated by keeping every mirror member and
measuring a failing direction for each pin; T-06-13-02 by a derived, non-pending
disposition on all 395 rows with two transcription errors caught and corrected;
T-06-13-03 by submitting every draft to the real engine and reverting both
refusals; T-06-13-04 by the `(path, owner, key)` set difference showing zero
gained; T-06-13-05 by the byte-exact migration case and both named agents-index
throw tests.

## Issues Encountered

- **The three layers do not reach zero, and were never going to.** Fifteen rows remain, every one of them a real finding with a named next owner. Four bounded engine plans and one cross-owner follow-up would clear eleven of them; two are a recorded decision and two more want a category that does not exist yet.
- **06-08 stays blocked**, on these fifteen and on the 57 rows still owned by `orchestrators`, `edge` and `bridges/hooks`.
- **The previous executor turn ended on an API timeout mid-verification.** The tree was left with the task-3 production edits uncommitted and `npm run typecheck` green. Before resuming, every file drifted for a RED measurement was verified byte-identical to its pre-drift backup, since dying mid-measurement is the failure mode that protocol risks. All thirteen drifts were confirmed restored.

## Next Phase Readiness

- **Ready for 06-12.** The remaining 49 `orchestrators` rows are untouched by this plan, and the two hand-offs 06-11 addressed to 06-12 are unaffected.
- **`requirements-completed` lists MEMBER-01 and MEMBER-02**, but both are declared by every plan in this phase, so neither reads `Complete` until the last declaring plan finishes.
- **No blocker.** `npm run check` is exit 0 and the member gate is still absent from it, so nothing downstream is gated on the live population being clean.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-16*

## Self-Check: PASSED

The created file and all seven modified files exist on disk, and all four task
commits are present in `git log`. Every `<verify>` command in the plan was run
in the foreground and its exit status captured; none was skipped. The measured
commit count from the plan ledger is 4
(`git rev-list --count 02fb4bda..HEAD`), matching the four commits listed above.
One value asserted in a first draft of this summary -- the triage digest -- was
found to be unmeasured and was corrected to `f57d8238` from the record itself
before this file was committed.

---
phase: 06-unused-type-member-gate
plan: "09"
subsystem: testing
tags: [typescript, static-analysis, hooks-bridge, dead-code, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable member gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The closed triage, the 81 validated contracts and the honest 138-row baseline
  - phase: 06-unused-type-member-gate
    provides: The seven executable negative controls the repairs must not disturb
provides:
  - "`AsyncRewakeEntry` published as an alias of `HooksRuntimeChildEntry` rather than a second declaration of the same fifteen members"
  - "`RegisterHooksBridgeOptions`: one declaration for the four mirrored hooks-registration option bags, with the never-read `ctx` field gone from it and from ~37 call sites"
  - "A `tool_result` patch written through the event's own slots, with the CR-01 whitelist guards untouched"
  - "A measured 138 -> 113 live population, 25 of the 26 `bridges/hooks` rows cleared by source repair with zero findings gained"
  - "A recorded, source-checkable reason for the one row left standing, correcting the disposition it inherited"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `c285cdee`, reconciling with 113 problems that are ALL `unread`"
affects: [06-10, 06-11, 06-12, 06-13, 06-14, 06-08]

actuals:
  tokens: 67569
  tasks: 3
  commits: 3
plan_head_before: 3d069fa98bf38d5245e182a18e745add16b83290

tech-stack:
  added: []
  patterns:
    - "A published duplicate becomes an alias of the declaration its reads already resolve to, not a deleted name"
    - "A mirrored options bag collapses to one named exported declaration so each member has a single home the reads land on"
    - "A patch view is typed off the target's own slots with `Partial<Pick<T, K>>` -- a mapped type declares no members of its own, so the write stops minting cast literals"
    - "A repair is measured by a `(path, owner, key)` diff of the real CLI's findings against a pre-edit baseline, so a repair that pushes a new member into `unread` cannot pass on a flat total"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
    - extensions/pi-claude-marketplace/index.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/architecture/hooks-lifecycle.test.ts
    - tests/integration/hooks-additionalcontext-end-to-end.test.ts
    - tests/integration/hooks-cross-scope-reconcile.test.ts
    - tests/integration/hooks-dispatch-end-to-end.test.ts
    - tests/integration/hooks-spawn-end-to-end.test.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "`ChildLike.pid` removed: the ladder guards on exit state, the registry row carries its own top-level `pid` read off the real `ChildProcess`, and both `satisfies ChildLike` literals spell only `kill`. The `ChildProcess` correspondence survives because the doc calls the interface the subset the ladder needs, and the whitelist argument is that the module does not import `node:child_process` -- neither claim depends on `pid`."
  - "`WriteHookConfigResult.written` LEFT STANDING: the whole result is deep-compared at nine sites, so the inherited disposition's claim that no witness exists is wrong about the tree. Deleting the slot would delete an observed member and weaken nine assertions."
  - "The `tool_result` patch view is `Partial<Pick<ToolResultEvent, \"content\" | \"isError\">>` rather than an untyped view plus a bare union write: the untyped form type-checks but `Array.isArray` narrows `unknown` to `any[]`, which fails `@typescript-eslint/no-unsafe-assignment` (measured)."
  - "Three inherited dispositions were judged mis-assigned and the evidence followed instead (D-09)."

patterns-established:
  - "Contract-coordinate safety is confirmed before editing, not assumed: every edit in a contracted file lands strictly below the contracted line, and the line's text is re-read afterwards."
  - "A measured under-credit in the analysis is recorded as an analyzer finding with the mechanism named, not laundered into a clean row by deleting the member."

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "AsyncRewakeEntry is published as an alias of HooksRuntimeChildEntry, and the analyzer reports zero unread members for async-rewake/registry.ts without the runtime row's own count rising"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/bridges/hooks/async-rewake/registry.test.ts tests/bridges/hooks/runtime.test.ts tests/architecture/hooks-async-rewake.test.ts (43/43)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- async-rewake/registry.ts rows 15 -> 0, bridges/hooks/runtime.ts rows 0 -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "One named RegisterHooksBridgeOptions declaration serves all four registration sites, ctx and HydratedScope.state are gone from source and every call site, and the hooks dispatch path behaves identically"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/index.test.ts tests/architecture/hooks-lifecycle.test.ts tests/index.test.ts (60/60)"
        status: pass
      - kind: integration
        ref: "npm run test:integration (32/32)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- bridges/hooks/event-router.ts rows 7 -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The tool_result patch writes through the event's own slots with the CR-01 whitelist guards unchanged, and ChildLike.pid is gone"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/bridges/hooks/event-adapters.test.ts tests/bridges/hooks/exec-timer.test.ts tests/bridges/hooks/runtime.test.ts tests/bridges/hooks/dispatch.test.ts (116/116)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.mjs -- event-adapters.ts rows 2 -> 0, exec-timer.ts rows 1 -> 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The live population is a measured 138 -> 113 with zero findings gained, and the regenerated record reconciles against a fresh digest with no stale, missing, duplicate, incomplete or invalid rows"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "comm -13 over the pre-edit and post-edit finding sets -- 25 lost, 0 gained"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1, 113 problems, 113 of 113 kind `unread`"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gate, the quality chain and the negative controls are unchanged by the repairs"
    verification:
      - kind: other
        ref: "npm run check (exit 0)"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs (7 of 7 ok, exit 0)"
        status: pass
      - kind: other
        ref: "coverage/unit.lcov over extensions/ -- 227 modules, functions 1834/1834, branches 9050/9050, lines 62887/62887, zero modules below 100%"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -- 236 pairs, 2 pinned shortfalls matched scripts/test-coverage-direct.pin.json exactly, exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "WriteHookConfigResult.written is left standing with a recorded, source-checkable reason instead of being removed"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "check-unused-type-members.mjs --json -- WriteHookConfigResult.{written,path} carry no `deep-comparison` witness while the sibling RemoveHookConfigResult.removed carries two, from the same file"
        status: pass
    human_judgment: true
    rationale: "Leaving a row standing is an owner judgment about whether the analysis or the source is wrong. The measurement below is mechanical, but the decision to keep the member rather than delete it wants a human to agree."

duration: 71 min
completed: 2026-09-15
---

# Phase 06 Plan 09: bridges/hooks Member Repairs Summary

**25 of the 26 `bridges/hooks` unread members cleared by source repair alone -- one duplicate declaration became an alias, four mirrored options bags became one, three dead slots and two cast literals went away -- taking the live population from a measured 138 to 113 with zero findings gained, and the twenty-sixth row left standing with the analyzer under-credit behind it named and measured.**

## Performance

- **Duration:** 71 min
- **Started:** 2026-09-15T20:47:00Z
- **Completed:** 2026-09-15T21:58:00Z
- **Tasks:** 3 of 3
- **Files modified:** 12 (5 production, 6 test, 1 record)

## Accomplishments

- **`AsyncRewakeEntry` is an alias, not a duplicate.** It declared the same fifteen members as `HooksRuntimeChildEntry`, and the one value annotated with it goes straight to `runtime.registerChild`, whose parameter is the runtime row -- so every read already resolved there. Publishing the name as `export type AsyncRewakeEntry = HooksRuntimeChildEntry` drops fifteen candidate declarations without deleting the published name, and without the runtime row's own count moving.
- **One options declaration replaces four spellings.** `HooksHydration.registerHooksBridge`, `hydrateCacheFromDisk`, `registerHooksBridgeWith` and the object literal `createHooksHydration` returns now all name `RegisterHooksBridgeOptions`, so `cwd` and `executor` each have one home the reads land on.
- **The dead `ctx` field is gone** from the bag, from the extension factory's `{} as unknown as ExtensionContext` placeholder, from the paragraph of `index.ts`'s comment block that described the placeholder, and from every test call site.
- **The `tool_result` patch writes through the event.** The two single-member cast literals the old code minted per write are gone; the patch view is `Partial<Pick<ToolResultEvent, "content" | "isError">>`, a mapped type that declares no members of its own and pins the view to the peer's own slots. The two guarded `if` statements that whitelist `content` and `isError` (CR-01) are byte-for-byte unchanged.
- **Two more dead slots removed:** `HydratedScope.state`, whose only consumer destructures `{ loc }`, and `ChildLike.pid`, which no reader in the ladder or its callers names.
- **The remaining row is explained, not laundered.** `WriteHookConfigResult.written` stays, with a recorded reason a reader can check against source.

## Task Commits

1. **Task 1 (tracer): Publish AsyncRewakeEntry as an alias of the runtime row it duplicates** - `29d7037f` (refactor)
2. **Task 2: Collapse the mirrored hooks options bags and drop two dead slots** - `709e8f04` (refactor)
3. **Task 3: Clear the last four rows, reconcile the record and measure the delta** - `8c4eee76` (refactor)

## The measured delta

Every count below is read out of `node scripts/check-unused-type-members.mjs`'s
stderr finding lines, never out of the record.

### Per-file, `bridges/hooks` owner group

| File | Before | After | How |
| --- | --- | --- | --- |
| `async-rewake/registry.ts` | 15 | 0 | the interface body became an alias of `HooksRuntimeChildEntry` |
| `event-router.ts` | 7 | 0 | four option bags became one declaration; `ctx` and `HydratedScope.state` removed |
| `event-adapters.ts` | 2 | 0 | the two cast literals replaced by a mapped view over the event's own slots |
| `exec-timer.ts` | 1 | 0 | `ChildLike.pid` removed |
| `stage.ts` | 1 | **1** | left standing, see below |
| **owner group** | **26** | **1** | |

### Global, per task

| Point | Findings | Unsupported |
| --- | --- | --- |
| inherited baseline | 138 | 0 |
| after Task 1 | 123 | 0 |
| after Task 2 | 116 | 0 |
| after Task 3 | 113 | 0 |

### Gained findings: zero

The delta was taken as a set difference on the finding lines, which carry
`(path, owner, key)` identity, not as a subtraction of totals:

```
comm -13 <(sort baseline.err) <(sort final.err)   # gained: (empty)
comm -23 <(sort baseline.err) <(sort final.err)   # lost:   25 lines
```

A repair that had silently pushed some other member into `unread` would show
up here even with a flat total. Nothing did.

### The candidate arithmetic closes

The record's candidate count moved 3464 -> 3434, and all 30 are accounted for:

| Where | Declarations removed | Added | Net |
| --- | --- | --- | --- |
| `registry.ts` `AsyncRewakeEntry` body | 15 | 0 | -15 |
| `event-router.ts` four option bags + `HydratedScope.state` | 12 | 2 (`RegisterHooksBridgeOptions.{cwd,executor}`) | -10 |
| `event-adapters.ts` `patch` view + two cast literals | 4 | 0 (mapped type declares none) | -4 |
| `exec-timer.ts` `ChildLike.pid` | 1 | 0 | -1 |
| | | | **-30** |

Runtime-observed moved 3009 -> 3004, which is the same five reads landing on
two declarations instead of seven: three `cwd` sites and two `executor` sites
collapse to one each (-3), and `patch.content` / `patch.isError` become members
of a mapped type (-2).

## Judgment calls

### `ChildLike.pid` (`exec-timer.ts:50:3`) -- REMOVED, default honoured

The plan flagged this as the one row where removal is a real owner judgment,
because the slot documents the adapter's deliberate correspondence to
`ChildProcess`, which is what keeps `exec-timer.ts` outside the three-site
`node:child_process` whitelist. The correspondence survives removal:

- The doc comment calls `ChildLike` the "structural subset of `ChildProcess`
  **the ladder needs**". The ladder does not need `pid`: `hasExited` reads
  `exitCode` and `signalCode`, and the escalation calls `kill`.
- The whitelist argument is that this module does not import
  `node:child_process`. That is untouched -- the interface still exists and
  still stands in for `ChildProcess` structurally.
- The registry row's `pid` is its own top-level member, read off the real
  `ChildProcess` at `registry.ts:249`, and is unaffected.
- The paired spy's "kept and maintained because `ChildProcess` sets it"
  comment in `tests/bridges/hooks/exec-timer.test.ts` is about `killed`, not
  `pid`. Both `satisfies ChildLike` literals in `tests/bridges/hooks/runtime.test.ts`
  spell only `kill`.

Removing it makes the doc comment more accurate, not less.

### `WriteHookConfigResult.written` (`stage.ts:227:3`) -- LEFT STANDING

The plan said: before deleting, check the two named test files for a deep
comparison of the whole result; a deep-equal is a whole-object read and would
contradict the recorded `unread` status; if one exists, stop and record the
contradiction. One exists -- nine of them:

- `assert.deepStrictEqual(write, { written: true, path: expectedPath })` at
  `tests/bridges/hooks/stage.test.ts:121,150,183,226,724,758,759` and
  `tests/bridges/hooks/index.test.ts:204,205`.

So the row was left standing, and the contradiction was measured rather than
asserted. From `check-unused-type-members.mjs --json`:

- Tree-wide, the operations model credits `deep-comparison` **22,950** times,
  so the model is live.
- `WriteHookConfigResult.written` has an **empty** witness list.
  `WriteHookConfigResult.path` has exactly one witness, and it is the
  `property-access` on `write.path` at `stage.test.ts:721:71` -- not a
  deep-comparison. Neither member is credited through any of the nine sites.
- The sibling `RemoveHookConfigResult.removed`, deep-compared the same way in
  the same file, carries **two** `deep-comparison` witnesses
  (`stage.test.ts:786` and `:804`).

The difference between the two is the callee. `removeHookConfig` is a directly
declared exported async function; `writeHookConfig` is the closure
`createWriteHookConfig` returns, re-exported as a const from
`bridges/hooks/index.ts`. `assertionSummary` demands `lineage: "production"`
(`scripts/check-unused-type-members.operations.mjs:365`), which
`isProductionDerived`'s bounded backward search settles
(`scripts/check-unused-type-members.flow.mjs:1521`), and that search does not
reach production through a factory-returned closure.

So this row is an **analyzer under-credit**, not a dead member. The inherited
disposition's claim that "the analyzer records no witness of any kind, in
production or in tests" is wrong about the tree. Deleting `written: true` would
delete an observed member and would require weakening nine assertions, which
this plan is forbidden to do. The row's note in `06-LIVE-TRIAGE.md` now records
all of the above, and the honest outcome for this owner group is **26 -> 1**.

Closing it wants a bounded analyzer plan that carries lineage through a
factory-returned closure -- not a source repair. 06-08 stays blocked on it, as
it is blocked on the other 112.

### Three inherited dispositions judged mis-assigned (D-09)

The plan directed all three; recording them here as required.

| Row | Inherited disposition | Why it is wrong | What was done |
| --- | --- | --- | --- |
| `event-router.ts:411:3` `HydratedScope.state` | "Delegate parameter shape ... keep the mirror and accept the finding" | `HydratedScope` is a module-private **return** shape, not a delegate parameter. Its one consumer destructures `{ loc }` at the `for` loop and never touches `state`; the doc comment claiming registration needs both was stale. | Slot removed, doc comment corrected. |
| `event-router.ts:497:5` `hydrateCacheFromDisk.opts.ctx` | same cluster note | `hydrateCacheFromDisk` is a concrete local function, not a delegate. | Field removed with the rest of `ctx`. |
| the four `ctx` rows (`457:13`, `497:5`, `807:11`, `1002:15`) | "point the delegate at the implementation's own parameter type, **or** keep the mirror" | The first arm was available and correct, and `ctx` was read at no site in the tree -- `index.ts`'s own comment already said so. | One named declaration, `ctx` deleted everywhere. |

Both cluster notes were the file-level note applied to every row in the file.
Per D-09 a recorded disposition is evidence to check, not an instruction to
obey.

## Contract drift

The only validated contract entry in any file this plan touches is
`event-adapters.ts:87:37` (`applyMutationInPlace.result.kind`), with its filter
at `87:11`. Both coordinates were confirmed before the edit and re-read after:

- Line 87 still reads `  result: Extract<HookExecResult, { kind: "mutate" }>,`
  -- byte-identical, so both columns are unmoved.
- No import was added to `event-adapters.ts` (`ToolResultEvent` was already
  imported), and every edit in that file is at lines 126-140, strictly below 87.
- The regenerated record carries **81** `explicit-contract` rows, the same 81 as
  before, and the entry at `87:37` is among them. The engine still loads; there
  was no exit 2 at any point.

No entry was retired, widened or added.

## Verification

| ID | Command | Result |
| --- | --- | --- |
| 06-09-T0 | `npm run check` on the inherited tree (precondition) | exit 0 |
| 06-09-T0 | `node scripts/check-unused-type-members.mjs` (baseline) | exit 1, 138 findings, 26 in `bridges/hooks`, 0 unsupported |
| 06-09-T1 | `npm run typecheck` | exit 0 |
| 06-09-T1 | `node --test` registry + runtime + hooks-async-rewake | 43/43 pass |
| 06-09-T1 | analyzer | 123 findings; `async-rewake/registry.ts` 15 -> 0; `runtime.ts` 0 -> 0 |
| 06-09-T2 | `npm run typecheck && npm run lint` | exit 0 |
| 06-09-T2 | `node --test` event-router + hooks/index + hooks-lifecycle + index | 60/60 pass |
| 06-09-T2 | `npm run test:integration` | 32/32 pass |
| 06-09-T2 | analyzer | 116 findings; `event-router.ts` 7 -> 0 |
| 06-09-T3 | `node --test` event-adapters + exec-timer + runtime + dispatch | 116/116 pass |
| 06-09-T3 | analyzer | 113 findings; `event-adapters.ts` 2 -> 0, `exec-timer.ts` 1 -> 0 |
| 06-09-T3 | `node scripts/check-unused-type-members.audit.mjs --inventory` | exit 0, 3434 candidates, 113 unresolved |
| 06-09-T3 | `node scripts/check-unused-type-members.audit.mjs --check` | exit 1, 113 problems, **113 of 113 kind `unread`** -- zero stale-source, stale-record, missing, duplicate, incomplete or invalid |
| 06-09-T3 | `npm run test:coverage:unit` + `coverage/unit.lcov` | 227 production modules, functions 1834/1834, branches 9050/9050, lines 62887/62887, **0 modules below 100%** |
| 06-09-T3 | `npm run test:coverage:direct:all` | exit 0, 236 pairs in 499.1s, "2 pinned shortfall(s) matched `scripts/test-coverage-direct.pin.json` exactly" |
| final | `npm run check` on the committed tree | exit 0 |
| final | `node scripts/check-unused-type-members.negative.mjs` | exit 0, **7 of 7 ok** (`baseline`, `offender-plant`, `benign-receiver-read`, `unrelated-same-spelling-read`, `plant-removed`, `compiler-failure`, `option-failure`) |

### The regenerated record

| Measurement | Before | After |
| --- | --- | --- |
| Revision | `3f2150d2` | `709e8f04` |
| Source digest | `671cb0ae...` | `c285cdee...` |
| Source files hashed | 605 | 605 |
| Production files analysed | 236 | 236 |
| Candidates | 3464 | 3434 |
| Runtime-observed | 3009 | 3004 |
| Test-only-observed | 236 | 236 |
| Explicit-contract | 81 | 81 |
| Unread | 138 | 113 |
| Unsupported analysis | 0 | 0 |
| Transfer steps | 3,005,679 | 3,005,345 |
| Transfer edges | -- | 217,246 |
| Transfer reads | -- | 82,977 |
| Operation reads | -- | 986,023 |

`transferMs` is a wall clock and is deliberately not compared. The recorded
revision is the HEAD the `--inventory` run saw (`709e8f04`, the Task 2 commit);
the Task 3 source edits were in the working tree at that moment and are in the
digest, which is what `--check` reconciles, and `--check` reports zero
`stale-source`.

### `fails_when` counterexamples exercised

| Task | Counterexample | Outcome |
| --- | --- | --- |
| T1 | rows disappear while the runtime row's own count rises | `bridges/hooks/runtime.ts` measured 0 before and 0 after |
| T1 | the published name is deleted rather than aliased | `export type AsyncRewakeEntry` still exists and is still exported |
| T2 | `ctx` removed while the placeholder cast or the stale comment is left behind | both went in the same commit; `grep -rn placeholderCtx extensions` returns nothing |
| T2 | a test call site made to compile by widening the options type | every test site had the `ctx:` key deleted; the type was narrowed, not widened |
| T3 | the `87` contract coordinate moves without being retired by name | line 87 byte-identical, 81 entries still loaded |
| T3 | a row cleared by a contract entry or a new test | `contracts.json` is untouched (81 entries, `git diff` empty) and no test was added |
| T3 | the cleared-row count asserted rather than read out of the real CLI | every number in this SUMMARY comes from the CLI's stderr or its `--json` report |
| all | coverage evidence predating the last source edit | the aggregate and all-pairs runs were taken after the last source edit, on the final snapshot |

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - `AsyncRewakeEntry` is now a type alias; the `TimerLadder` and `BucketAEvent` type imports the removed body orphaned are gone.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - adds `RegisterHooksBridgeOptions` and points all four sites at it; drops `ctx` and `HydratedScope.state` and corrects the doc comment that described the latter.
- `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` - the `tool_result` patch is a mapped view over the event's own slots and the writes go through `event.content` / `event.isError`.
- `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` - `ChildLike.pid` removed.
- `extensions/pi-claude-marketplace/index.ts` - the placeholder `ExtensionContext` cast and the `ctx:` key are gone, and the comment step that justified them with them.
- `tests/bridges/hooks/event-router.test.ts` - 25 call sites lose `ctx:`; three bindings my edits orphaned removed.
- `tests/architecture/hooks-lifecycle.test.ts` - 2 call sites; the orphaned `registrationContext` binding and the now-unused `ExtensionContext` type import removed.
- `tests/integration/hooks-{additionalcontext,cross-scope-reconcile,dispatch,spawn}-*.test.ts` - 10 call sites lose `ctx:`; the `placeholderCtx` bindings that also feed a Pi handler or `applyReconcile` are kept, as the plan directed.
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` - regenerated against the fresh digest; the `stage.ts:227:3` note rewritten to record the measured contradiction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Four test bindings and one type import orphaned by the `ctx:` removal**

- **Found during:** Task 2
- **Issue:** Dropping the `ctx:` key left `registrationContext` (hooks-lifecycle) and three `context` bindings (event-router.test.ts) unused, failing `tsc`'s `noUnusedLocals` with TS6133, and then `ExtensionContext` unused in hooks-lifecycle with TS6196.
- **Fix:** Removed exactly the bindings and the import that this plan's own edits orphaned, per CLAUDE.md "clean up only your own mess". Every other `context` binding -- the ones also passed to a Pi handler -- was left alone.
- **Files modified:** `tests/bridges/hooks/event-router.test.ts`, `tests/architecture/hooks-lifecycle.test.ts`
- **Verification:** `npm run typecheck` and `npm run lint` exit 0
- **Committed in:** `709e8f04`

**2. [Rule 3 - Blocker] The bare union write fails the lint gate, so the plan's sanctioned fallback was used**

- **Found during:** Task 3
- **Issue:** The plan's first choice -- keep the untyped `patch` view and write through the event's own slots -- type-checks, but `Array.isArray` narrows `unknown` to `any[]`, so `event.content = patch.content` reports `@typescript-eslint/no-unsafe-assignment`: "Unsafe assignment of type `any[]` to a variable of type `(TextContent | ImageContent)[]`" at `event-adapters.ts:133:5`. Measured by applying that form and running `npx eslint` on the file.
- **Fix:** Took the plan's named fallback -- "one named writable view used by both statements; a mapped type declares no members of its own" -- as `Partial<Pick<ToolResultEvent, "content" | "isError">>`. Both writes now go through `event.content` / `event.isError` with no cast at all, and the view is pinned to the peer's own slot types, so peer drift is caught rather than asserted away.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`
- **Verification:** `npm run lint` exit 0; `node --test tests/bridges/hooks/event-adapters.test.ts` 116/116 including the CR-01 hostile-patch test that proves `type`, `toolCallId`, `toolName`, `input`, `details` and `usage` still cannot be rewritten
- **Committed in:** `8c4eee76`

### Scope deviations

**3. `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` was NOT modified**

The plan's `files_modified` frontmatter lists it, and Task 3's action names the
`written` removal. The plan's own stop instruction fired instead: a deep
comparison of the whole result exists, so the field was left in place and the
contradiction recorded. See the judgment call above. This is the plan's
explicitly licensed 26 -> 1 outcome, not an unhandled failure.

---

**Total deviations:** 2 auto-fixed (both Rule 3), 1 scope deviation taken under
the plan's own instruction.
**Impact on plan:** No scope creep. Both auto-fixes were forced by the gate
chain and stayed inside the files the plan already named. The scope deviation
leaves one honest row standing rather than a laundered clean.

## Issues Encountered

None. The precondition (`npm run check` exit 0 on the inherited tree) held, no
fix-attempt limit was approached, and no task needed a repair cycle.

## Threat mitigations

| Threat ID | Mitigation | Evidence |
| --- | --- | --- |
| T-06-09-01 | every cleared row cleared by removing or aliasing a declaration | `contracts.json` untouched, no test added, counts read from the CLI |
| T-06-09-02 | the CR-01 `tool_result` whitelist preserved | the two guarded `if` statements are unchanged; only the write target and the patch view's type moved. `tests/bridges/hooks/event-adapters.test.ts`'s hostile-patch test passes |
| T-06-09-03 | the `event-adapters.ts:87:37` contract coordinate confirmed after the edits | line 87 byte-identical; 81 entries still loaded; recorded as `explicit-contract` in the fresh record |
| T-06-09-04 | the hooks child lifecycle after the `ChildLike` narrowing | the SIGTERM-to-SIGKILL ladder guards on exit state, not `pid`; exec-timer, runtime and async-rewake suites pass |
| T-06-09-05 | gate acceptance after a source repair | deterministic before/after counts per task, a record regenerated against a fresh digest, the ledger table above |

## Known Stubs

None. No placeholder, no `TODO`, no skipped test and no unrun `<verify>` was
introduced. One recorded `unread` member remains in this owner group by
deliberate, documented decision (`WriteHookConfigResult.written`); it is
tracked in `06-LIVE-TRIAGE.md` and reported by `--check` as one of the 113
`unread` problems, which is the mechanism 06-08 is blocked on.

## Next Phase Readiness

- **Ready for 06-14**, the next plan in the pinned order (06-09 -> 06-14 ->
  06-10 -> 06-11 -> 06-13 -> 06-12). Its starting live baseline is **113
  unread, 0 unsupported, 81 validated contracts**, at digest `c285cdee...`.
- **`06-LIVE-TRIAGE.md` is regenerated and self-consistent.** The next repair
  plan should re-run `--inventory` after its own last source edit; the last
  plan to land is authoritative.
- **06-08 remains blocked**, as designed: 113 rows across five owner groups
  still need repair, one of them this group's `WriteHookConfigResult.written`.
- **One analyzer item surfaced for a future bounded plan:** carry
  production lineage through a factory-returned closure, so a deep comparison
  over the result of a `create*`-returned function is credited the way it is
  for a directly declared one. Closing that would clear
  `WriteHookConfigResult.written` honestly, and may clear sibling rows
  elsewhere in the tree.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-15*

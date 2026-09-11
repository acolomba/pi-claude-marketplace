---
phase: 08-direct-coverage
plan: 07
subsystem: testing
tags: [node-test, direct-coverage, dependency-injection, test-doubles, install-ledger]

requires:
  - phase: 08-direct-coverage
    provides: "08-05's `InstallLedgerOptions.removalOps` -- required, constructed nowhere in `install-outcome.ts` -- and `createRemovalOpsFake`"
  - phase: 08-direct-coverage
    provides: "08-01's measured enumeration, which named this module as the phase's largest shortfall"
provides:
  - "the three `commitPrepared*` staging-leak arms covered through the removal port, each asserted as the complete `bridgeWarnings` array by its exact bytes"
  - "owner cases for seventeen of the nineteen uncovered runs, driven through `runInstallLedger` rather than through `install-flow.ts`"
  - "`createRemovalOpsFake.rmParentErrors` -- parent-keyed fault injection for a target minted inside the call being faulted"
  - "a measured escalation packet: the two residual branches, why each resists, and the smallest named change that would reach it"
affects: [08-08, 08-09, direct-coverage, install-outcome-coverage]

actuals:
  tokens: 9831
  tasks: 3
  commits: 2
  plan_head_before: 117121e0b140e9fa36636bdb93f2f8ed2c921bdf

tech-stack:
  added: []
  patterns:
    - "Parent-keyed fault injection: where the target is minted inside the call being faulted, the key moves to the nearest thing the case knows, never to a predicate that could match a sibling"
    - "The injected seam reached BOTH ways: one case overrides `cloneProbe`, its sibling lets the real probe run and keeps it network-free through `cloneCacheSeam`, so the `??` fallback is covered without a network"
    - "A failing phase's own undo is inert: a prepare that refuses never reaches its `c.<kind>Prep` assignment, so the undo the ledger still invokes has nothing to discard"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/install-outcome.test.ts
    - tests/platform/removal-ops-fake.ts

key-decisions:
  - "`createRemovalOpsFake` gained `rmParentErrors` because a bridge staging root is `<stagingDir>/<randomUUID()>` minted inside the prepare the case faults -- the plan's per-target key cannot be named in advance, and `ScopedLocations` publishes one staging directory per bridge kind, which makes the parent key select exactly one bridge"
  - "Three leak cases share one mechanical arrange helper and keep their own titles and assertions, so `fallow dupes` sees no clone while each case still targets a different bridge, label and staging root"
  - "The two residual branches are escalated, not pinned and not reached by a trick: both are defense-in-depth re-checks of a value the same validator already accepted in the same pass"
  - "`RCOV-02` stays Pending -- 08-09 still carries it, and this phase's convention is that the last contributing plan flips it"

patterns-established:
  - "Measure the module, not the recorded number: research's `lines 956/1031` had already expired -- 08-05's port added nine lines before this plan started"
  - "Relocation is additive: the sibling suite is re-run and its own pair re-measured, so 'coverage moved' shows up as the sibling's reading falling"

requirements-completed: []

coverage:
  - id: D1
    description: "Each of the three `commitPrepared*` leak arms is reached through the required removal collaborator, and the resulting bridge warning is asserted by its exact bytes"
    requirement: RCOV-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#surfaces the skills staging cleanup leak and still lands the install"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#surfaces the commands staging cleanup leak and still lands the install"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#surfaces the agents staging cleanup leak and still lands the install"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every case added here drives `install-outcome.ts`'s own exported surface, so the coverage belongs to the owner pair"
    requirement: RCOV-02
    verification:
      - kind: automated_ui
        ref: "every new case calls `runInstallLedger`; no new case imports or asserts through `install-flow.ts`"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/install-outcome.test.ts (22 cases, fail 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No case was deleted from or weakened in `tests/orchestrators/plugin/install-flow.test.ts`; the sibling pair's own reading is unchanged"
    requirement: RCOV-02
    verification:
      - kind: automated_ui
        ref: "git diff $PLAN_BASE..HEAD --stat -- tests/orchestrators/plugin/install-flow.test.ts is empty, and git status --porcelain on it is empty"
        status: pass
      - kind: automated_ui
        ref: "node scripts/test-coverage-direct.mjs .../install-flow.ts -> Direct coverage passed (branches 89/89, functions 18/18, lines 1132/1132)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The module's residual reading, its remaining uncovered runs, and the smallest named change that would reach each are recorded rather than pinned"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "this SUMMARY's 'The escalation packet' section, read off a focused LCOV run of the owner test"
        status: pass
    human_judgment: true
    rationale: "The disposition of the residue is the developer's to choose at this plan's checkpoint. Whether `818-820` and `422-426` are worth a production change, a deferral, or nothing at all is a judgment about this codebase's testability budget, not a measurement."
  - id: D5
    description: "`orchestrators/plugin/install-outcome.ts` carries no pin row"
    requirement: RCOV-02
    verification:
      - kind: automated_ui
        ref: "no pin artifact exists on this branch (plan 08 generates it from the second sweep) and this plan created none"
        status: pass
    human_judgment: false

duration: 96min
completed: 2026-09-11
status: complete
---

# Phase 8 Plan 07: The Install Ledger's Own Coverage Summary

**`orchestrators/plugin/install-outcome.ts` reads `branches 109/111, functions 27/27, lines 1034/1040` against its own owner test, up from `branches 60/83, functions 22/27, lines 965/1040`; seventeen of its nineteen uncovered runs are closed by owner cases and the two that remain are defense-in-depth re-checks escalated with their reasons rather than pinned.**

## Performance

- **Duration:** 96 min
- **Started:** 2026-09-11T07:05:00Z
- **Completed:** 2026-09-11T08:41:00Z
- **Tasks:** 3 of 3, plus a blocking checkpoint
- **Files modified:** 2 (0 created, 2 modified)

## The measurement this plan started from

Research recorded `branches 60/83, functions 22/27, lines 956/1031`. That reading had already expired: 08-05's removal port added nine lines to the module. Measured fresh at `117121e0`, before any case was written:

```
Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:
branches 60/83, functions 22/27, lines 965/1040
```

Nineteen uncovered line runs, extracted from a focused LCOV run of the owner test alone:

```
341-342, 393-395, 404-408, 416-417, 423-426, 444-456, 464, 668-669,
677-678, 682-683, 712-713, 720-721, 725-726, 765-766, 775-776, 780-781,
810-832, 838-839, 866-867
```

Plus four branch-only lines the run list does not name — `633`, `916`, `920`, `948` — and five functions with `FNDA:0`: `resolveGitPluginRoot` and the four `recorded.map((r) => r.generatedName)` callbacks at 665, 709, 768 and 858.

## Accomplishments

- Closed the three `commitPrepared*` leak arms (677-678, 720-721, 765-766) through `InstallLedgerOptions.removalOps`, the seam 08-05 made required. Each case faults exactly one bridge's staging cleanup, leaves the other two alone, and asserts the whole `bridgeWarnings` array with one `assert.deepStrictEqual` against the message's exact bytes. Each also pins that the install still LANDED — a cleanup leak is a warning, not a failure — and that the faulted bridge's own staged name survived.
- Relocated the preflight's refusals and adoptions to the owner: the already-installed throw (404-408), the not-in-manifest throw (416-417), the CMP-3 user-scope adoption (393-395), and the `--partial` gate (464) asserted against the default gate refusing the same fixture.
- Covered the git-source family both ways. One case injects `cloneProbe` and asserts the `sha-<12hex>` version (341-342), the clone-anchored root, and the full 40-hex `resolvedSha` on the record (633, 916). Its sibling supplies **no** `cloneProbe`, so the `?? probeInstallClone` fallback runs for real (444) and is kept network-free by the `cloneCacheSeam`, `deviceFlowHttp` and `authMemo` the options already carry (447, 451, 452). `resolveGitPluginRoot`'s `FNDA:0` is gone.
- Covered every bridge phase's remaining body: the skills and commands degrade loops (668-669, 712-713), AS-7's preserved foreign agent row (775-776), the hooks phase writing its config and stamping the record's hooks slug (810-832, 920, 948), the mcp staged-name projection (the last `FNDA:0`), and the hooks undo's real removal when the mcp phase cannot even prepare (838-839, 866-867).
- Covered the inert failing-phase undo for skills, commands and agents (682-683, 725-726, 780-781) by refusing each bridge's prepare with a symlink at the generated target name. A prepare that refuses never reaches its `c.<kind>Prep` assignment, so the undo the ledger still invokes for the failing phase returns immediately and adds no rollback partial.
- Left `tests/orchestrators/plugin/install-flow.test.ts` byte-unchanged and re-measured its own pair: `Direct coverage passed (branches 89/89, functions 18/18, lines 1132/1132)`. No coverage was moved; it was added.

## Task Commits

1. **Task 1: Re-measure and close the three commitPrepared leak arms** — `a2e026a6` (test)
2. **Task 2: Relocate owner coverage for the remaining uncovered runs** — `75e39aec` (test)
3. **Task 3: Take the final reading and record the residue** — this document; its metadata commit follows. The measured `commits: 2` counts the two task commits present when this file was written.

## Files Created/Modified

**Modified — test support**

- `tests/platform/removal-ops-fake.ts` — `createRemovalOpsFake` gains `rmParentErrors`, keyed by the target's parent directory, plus the `parentOf` helper that reads it on the same `/` separator convention `descendantsOf` already uses. The header's fault-injection note now states when a key moves off the target and what it may never move to.

**Modified — owner test**

- `tests/orchestrators/plugin/install-outcome.test.ts` — 5 cases became 22. `seedEmptyPlugin` became `seedPlugin`, which now also writes skills, commands, agents, malformed sources, `hooks/hooks.json`, `.mcp.json`, extra `plugin.json` members, a git-backed manifest `source`, and a user-scope marketplace record.

## Per-run disposition

Every uncovered run from the task 1 measurement, with what closed it.

| run | what it is | disposition |
|---|---|---|
| 341-342 | `derivePluginVersion`'s git-source `shaVersion` arm | new owner case (git source via `cloneProbe`) |
| 393-395 | CMP-3 clone-and-adopt of a user-scope marketplace record | new owner case |
| 404-408 | PI-5 already-installed throw | relocated; asserted as the typed shape at the owner boundary |
| 416-417 | PI-3 not-in-manifest throw | relocated; asserted as the typed shape at the owner boundary |
| **423-426** | **entry re-validation throw** | **CARRIED to the checkpoint** |
| 444-456 | the `resolveGitPluginRoot` callback body | two new owner cases, one per arm of `opts.cloneProbe ?? probeInstallClone` |
| 464 | `--partial` widening the installability gate | new owner case, paired with the default gate refusing the same fixture |
| 633 | `resolvedSha` spread into the ledger context | git-source case |
| 668-669 | skills frontmatter-degrade collection | new owner case (malformed `SKILL.md`) |
| 677-678 | **skills `commitPrepared` leak arm** | closed through `removalOps` |
| 682-683 | skills failing-phase undo early return | new owner case (prepare refused by a symlinked target) |
| 712-713 | commands frontmatter-degrade collection | same case as 668-669 |
| 720-721 | **commands `commitPrepared` leak arm** | closed through `removalOps` |
| 725-726 | commands failing-phase undo early return | new owner case |
| 765-766 | **agents `commitPrepared` leak arm** | closed through `removalOps` |
| 775-776 | AS-7 foreign-row collection | new owner case (foreign file plus a seeded index row) |
| 780-781 | agents failing-phase undo early return | new owner case |
| 810-832 | `hooksPhase.do` body | new owner case (hooks-declaring plugin) |
| 838-839 | hooks undo's `removeHookConfig` | new owner case (mcp phase fails after hooks wrote) |
| 866-867 | mcp failing-phase undo early return | same case as 838-839 |
| 916 / 920 / 948 | `statePhase`'s `resolvedSha`, `hookEntries` and hooks-slug arms | git-source case and hooks case |
| 665 / 709 / 768 / 858 (`FNDA:0`) | the four `recorded.map` name projections | every bridge now has a component to stage |
| `resolveGitPluginRoot` (`FNDA:0`) | the resolver callback | git-source cases |
| **818-820** | **hooks re-parse guard** | **CARRIED to the checkpoint** |

## The final reading, verbatim

```
Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts: branches 109/111, lines 1034/1040
```

Functions no longer appear in the refusal string: the module reads `functions 27/27`.

## The escalation packet

Two regions remain. Both are defense-in-depth re-checks of a value an earlier validation in the **same pass** already accepted, which is why neither yields to a fixture.

### 1. Lines 423-426, branch 422 — the manifest entry re-validation throw

```ts
if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
  throw new Error(
    `Plugin entry for "${plugin}" in marketplace "${marketplace}" failed schema validation.`,
  );
}
```

**Why it resists.** `MARKETPLACE_SCHEMA` declares `plugins: Type.Array(PLUGIN_ENTRY_SCHEMA)` (`domain/manifest.ts:28`), and `PLUGIN_ENTRY_VALIDATOR` is `Compile(PLUGIN_ENTRY_SCHEMA)` (`domain/components/plugin.ts:89`). It is the *same schema*. `loadCachedMarketplaceManifest` refuses any manifest whose entries do not satisfy it, so an `entryRaw` that reaches line 422 has already been checked by that exact schema, in this process, from this parse. The arm cannot fail on a manifest the loader accepted.

**The smallest change that would reach it.** The only route is a cached manifest object mutated between the loader's validation and this read. `manifest-cache.ts` D-03 returns hits **by reference** and states "callers MUST treat the result as READ-ONLY", so the value is mutable in principle — but reaching it means a test writing into a domain-owned cached object across two installs, which is a test reaching inside a module's internals and is not a seam the module offers. There is no smaller change: covering it honestly would mean giving `preflightInstallResolve` an injectable manifest reader, and that reader has no other caller asking for it.

### 2. Lines 819-820, branch 818 — the hooks re-parse guard

```ts
const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);
if (!parsed.ok) {
  throw new Error(`hooks.json re-parse failed: ${parsed.reason}`);
}
```

**Why it resists.** The phase re-reads and re-parses the same `<pluginRoot>/hooks/hooks.json` the resolver already validated at install-entry under D-57-04. `parseHooksConfig` has exactly two `{ok:false}` arms — `JSON.parse` and `HOOKS_VALIDATOR.Check` — and the resolver ran both on the same bytes (`domain/hooks-resolution.ts`). The one difference between the two calls is `skipIfMap`, and it cannot produce a refusal: `domain/components/hooks.ts` records that per D-61-02 "every failure path inside `compileIfPredicate` collapses to MATCH_ALL_IF — the parser never fails on an `if`-field issue". So the guard fires only when the file changes between the resolve and the phase, which is the concurrent mutation it exists for.

**The smallest change that would reach it.** Give the hooks phase an injectable file reader on `InstallLedgerOptions`, beside the `cloneProbe` and `cloneCacheSeam` seams already there — the phase currently calls the directly-imported `readFile`. A test could then answer valid bytes to the resolver and corrupted bytes to the phase, which *is* the production scenario.

**One route was available and deliberately not taken.** The removal collaborator is called during the skills phase, which runs before the hooks phase, so a `RemovalOps` whose `rm` also corrupted the plugin's `hooks.json` would reach this arm today with no production change. That would dress a timing trick as a removal: the arrange would read "when the skills bridge cleans up its staging, corrupt an unrelated file", which is not a removal contract and not a fact about the system. The plan forbids reaching an arm by a test-only device, and this is one wearing a collaborator's clothes.

### Neither is a pin row

`D-08-A06` excludes this module from the pin, and `D-08-07` requires a recorded reason per uncovered site. Both residual sites now have one — but recording them here is the escalation the decision asks for, not a licence to open a row. No pin artifact exists on this branch (plan 08 generates it from the second sweep) and this plan created none.

## Decisions Made

1. **`createRemovalOpsFake` gained `rmParentErrors`.** The plan directs the three leak cases to fault "exactly ONE staging root" with a per-target key. No case can supply that key: the staging root is `path.join(locations.<kind>StagingDir, randomUUID())`, minted inside the prepare call being faulted. The parent is knowable — `ScopedLocations` publishes one staging directory per bridge kind — and keying on it selects exactly one bridge's cleanup while leaving its siblings' alone, which is the property the plan actually asks for. This follows the precedent 08-06 set with `renameDestinationErrors`, added for the same class of problem with the same reasoning recorded in the same place. Each case still reads the target the port was *given* out of the call log and asserts that exactly one removal under that directory was attempted, so the expected message cannot be built from another bridge's call.

2. **The three leak cases share a mechanical arrange helper.** The plan asks for three independent cases rather than rows in a loop, and they are: three `test()` calls, three titles, three bridges, three assertion blocks. What they share is `installWithFaultedStagingCleanup`, which does the hermetic setup, the fault, the act, and the "exactly one removal under this root" check. Three thirty-line near-identical blocks would have been a `fallow dupes` finding at the configured threshold of 3, and the tree's own convention (`assertRetryFailure` and friends in `install-flow.test.ts`) is to factor the mechanics and keep the claims inline.

3. **Preflight refusals are asserted as typed shapes, not as notification rows.** The sibling cases for PI-3 and PI-5 assert the rendered row, because `install-flow.ts` owns the rendering. At this owner's boundary the contract is the thrown `PluginShapeError` and its `shape` discriminant, so each relocated case asserts the whole shape object and the message text. This is not a weakening: it is the same contract observed where it is actually produced.

4. **`RCOV-02` stays Pending.** 08-09 still carries it and has not run. 08-02, 08-03, 08-05 and 08-06 all reverted the automatic flip; this plan does not flip it either, and `requirements-completed` is empty rather than asserting a completion this plan does not own.

## Deviations from Plan

### 1. [Rule 3 - Blocking] The per-target fault key the plan names cannot be supplied by a ledger-level case

- **Found during:** Task 1
- **Issue:** The plan's action text directs each leak case to build `createRemovalOpsFake({ boundary: "memory", rmErrors: [[stagingRoot, error]] })`. `rmErrors` is keyed by absolute target path, and a bridge's staging root is `<stagingDir>/<randomUUID()>` created inside `prepareStage*` — the call the case is faulting. The case cannot name it before the act, and the fake's fault map is captured at construction, so it cannot be amended after.
- **Fix:** Added `rmParentErrors` to `RemovalOpsFakeOptions`, keyed by the target's parent. The key still selects exactly one bridge (one staging directory per kind on `ScopedLocations`) and is still a path, not a predicate. The doc comment records why the key moved and what it may never move to; the module header's fault-injection note was widened to cover both displaced keys.
- **Files modified:** `tests/platform/removal-ops-fake.ts`
- **Verification:** `npm run check` exits 0; the three leak cases each observe exactly one removal under their bridge's staging directory and assert the leak message built from it.
- **Committed in:** `a2e026a6`

### 2. [Scope] One file outside `files_modified`

- **Found during:** Task 1
- **Issue:** The plan's `files_modified` lists only `tests/orchestrators/plugin/install-outcome.test.ts`. Deviation 1 changes `tests/platform/removal-ops-fake.ts`.
- **Fix:** Modified it anyway, additively. It is the concern owner the plan's own `## Artifacts this phase produces` section names as this plan's input, the change is a new optional member with no effect on any existing caller, and the plan's blast-radius criterion — that nothing under `extensions/` is touched — holds.
- **Files modified:** `tests/platform/removal-ops-fake.ts`
- **Verification:** `git diff $PLAN_BASE..HEAD --name-only` lists two files, both under `tests/`.
- **Committed in:** `a2e026a6`

### 3. [Rule 3 - Blocking] Task 3's pin verification names an artifact that does not exist yet

- **Found during:** Task 3
- **Issue:** The plan's verify runs `import("./scripts/test-coverage-direct.pin.mjs")` and calls `loadCoveragePin()`. Neither `scripts/test-coverage-direct.pin.mjs` nor `scripts/test-coverage-direct.pin.json` exists on this branch — per `D-08-08` the pin is generated by plan 08, from the second full sweep, after this plan's work lands. The command fails with `ERR_MODULE_NOT_FOUND`, which is not a coverage answer.
- **Fix:** Verified the underlying prohibition directly instead: `git ls-files | grep -i "pin\.json\|pin\.mjs"` returns nothing, so there is no pin to hold a row and this plan created none. The prohibition is satisfied; the acceptance criterion ("contains no row whose `sourcePath` is …") is vacuously true.
- **Files modified:** none
- **Verification:** `git ls-files` shows no pin artifact; `grep -rn "install-outcome" scripts/` returns one unrelated hit in `check-phase-06-hub-ledger.mjs`.
- **Committed in:** not a code change

### 4. [Measurement] Four predicted figures did not reproduce

- **Found during:** Tasks 1 and 2
- **Issue:** Research's `lines 956/1031` measured 965/1040 (08-05's port added nine lines); the plan's line citations for `InstallLedgerOptions` (149-166) and `runInstallLedger` (505-560) were likewise shifted; and every generated-name prediction in the first draft of the leak cases was wrong (`empty-alpha`, `empty:beta` and `pi-claude-marketplace-empty-gamma` are three different naming grammars, not one).
- **Fix:** Took every number from the instrument. The generated names were read off the failing assertions rather than derived from a rule.
- **Files modified:** none
- **Verification:** every reading in this document is quoted from `node scripts/test-coverage-direct.mjs` or from a focused LCOV run.
- **Committed in:** not a code change

---

**Total deviations:** 4 (2 Rule 3 blocking, 1 scope, 1 measurement)
**Impact on plan:** None on scope. No file under `extensions/` was touched; two files changed, both under `tests/`.

## Verification

| check | result |
|---|---|
| `node --test tests/orchestrators/plugin/install-outcome.test.ts` | 22 cases, `fail 0` (5 before) |
| `node --test tests/orchestrators/plugin/install-flow.test.ts` | 133 cases, `fail 0` |
| `node scripts/test-coverage-direct.mjs .../install-outcome.ts` | `Incomplete` — `branches 109/111, lines 1034/1040`, functions complete |
| `node scripts/test-coverage-direct.mjs .../install-flow.ts` | `Direct coverage passed` — branches 89/89, functions 18/18, lines 1132/1132 |
| `git diff $PLAN_BASE..HEAD --stat -- tests/orchestrators/plugin/install-flow.test.ts` | empty |
| `git status --porcelain -- tests/orchestrators/plugin/install-flow.test.ts` | empty |
| `git diff $PLAN_BASE..HEAD --name-only` | 2 files, neither under `extensions/` |
| pin artifact holds a row for this module | no pin artifact exists; none created |
| **`npm run check`** | **exit 0** — typecheck, lint, fallow, format, both corresponding gates, the direct-coverage negative control, 6,003 unit cases, 32 integration cases |

`SKIP=trufflehog pre-commit run --files` passed clean before each commit, including `npm fallow` — no new clone finding from the three leak cases, and no dead export from the new fake option.

## Issues Encountered

- **The plan's fault-key mechanism does not fit a ledger-level case.** Resolved as deviation 1. It is the same shape as the problem 08-06 hit and solved the same way, which suggests the class — "the target is minted inside the call you are faulting" — is now general enough to be worth naming once rather than rediscovering.
- **The agents index entry schema is strict.** A seeded index row needs `sourcePath`, `targetPath`, `sourceHash`, `droppedFields`, `droppedTools` and `warnings`, and the AG-5 foreign check reads `entry.targetPath` specifically. A row missing them is silently not a previous entry, and the case passes vacuously with an empty `agentForeignFailures`. Caught because the case asserted the expected name rather than a non-empty length.

## Next Phase Readiness

- **08-08's second sweep will see this module at `branches 109/111, lines 1034/1040`.** It is not complete, so the strict all-pair arm still refuses it. What plan 08 does about that is the decision this plan's checkpoint puts to the developer.
- **`RCOV-02` is still Pending** and belongs to 08-09, the last plan carrying it.
- **One open judgment for a reviewer:** deviation 1. If the intent was that the leak cases key on the exact staging root, that key is not obtainable from a `runInstallLedger` caller, and the alternative — letting the install run once, reading the staging root off disk, then running it again — would fault a different install than the one it measured.

---
*Phase: 08-direct-coverage*
*Completed: 2026-09-11*

## Self-Check: PASSED

Both modified files exist on disk; both task commits resolve in `git log`.

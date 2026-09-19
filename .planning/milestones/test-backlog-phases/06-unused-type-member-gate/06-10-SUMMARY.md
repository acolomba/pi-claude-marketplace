---
phase: 06-unused-type-member-gate
plan: "10"
subsystem: testing
tags: [typescript, static-analysis, bridges, contracts, dead-code, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable member gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The closed triage, the validated-contract engine and the recorded dispositions
  - phase: 06-unused-type-member-gate
    provides: The seven executable negative controls the repairs must not disturb
  - phase: 06-unused-type-member-gate
    provides: The 103-row live baseline 06-14 left behind
provides:
  - "One rollback rename-pair shape carrying only the destination, narrowed at all four declaration sites in a single change"
  - "`StageAgentsInput` without the resolved-plugin slot the agents bridge never reads"
  - "`StageCommandsInput` and `StageSkillsInput` without the marketplace-name slot neither bridge reads"
  - "`UpdatePhase3Failure` extending `Phase3Failure` directly, the `Omit` 06-14 left vestigial now gone"
  - "A measured 103 -> 90 live population: all 13 rows across the three artifact bridges and `shared/fs-utils.ts` cleared, zero findings gained"
  - "Four contract entries re-anchored to the coordinates the edits moved, with the mis-anchor failure mode exercised as a control"
  - "The `install-outcome.ts` direct pin re-measured to branches 109/111, lines 1040/1046 -- uncovered branch count unchanged"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `59f0fa76`, reconciling with 90 problems that are ALL `unread` and none in this plan's owner areas"
  - "Two measured, out-of-scope defects recorded in `deferred-items.md` rather than silently fixed"
affects: [06-11, 06-12, 06-13, 06-08]

actuals:
  tokens: 19487
  tasks: 3
  commits: 3
plan_head_before: fd4930eced7e75b635661bdb8b35f687ab351aad

tech-stack:
  added: []
  patterns:
    - "A shape spread across several declaration sites is narrowed at every site in one change, because structural assignability lets a partial narrowing compile while the parts disagree"
    - "A ledger push builds a fresh element matching the declared shape rather than forwarding a wider iterated element, so excess-property checking still guards the boundary"
    - "A slot's absence of readers is proved by sibling comparison -- every sibling on the same interface carrying a production witness is what shows the model reaches the declaration"
    - "The compiler enumerates the call sites of a removed slot; every named site is fixed by deletion, never by a cast or a widened parameter"
    - "A coordinate-addressed record is re-anchored in the same change as the edit that moved it, and the mis-anchor is exercised as a control rather than assumed to be loud"

key-files:
  created:
    - .planning/phases/06-unused-type-member-gate/deferred-items.md
  modified:
    - extensions/pi-claude-marketplace/shared/fs-utils.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/bridges/skills/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - tests/shared/fs-utils.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/bridges/agents/types.test.ts
    - tests/bridges/commands/stage.test.ts
    - tests/bridges/commands/types.test.ts
    - tests/bridges/skills/stage.test.ts
    - tests/bridges/skills/types.test.ts
    - scripts/check-unused-type-members.contracts.json
    - scripts/test-coverage-direct.pin.json
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md

key-decisions:
  - "The rename-pair narrowing landed at all four declaration sites in ONE commit. The shapes are structurally assignable, so a partial removal compiles: the three bridges would still have described a value `rollbackReplacementCommon` no longer declares, and nothing would have failed."
  - "Each rename loop now pushes `{ to: pair.to }` rather than forwarding the iterated staged-paths element whole. Forwarding would have carried an undeclared source path into the helper under a narrowed declaration; a fresh literal keeps excess-property checking live at the boundary, which was exercised as a control (TS2353)."
  - "No shared alias was introduced for the narrowed pair, and no shared shape was placed in a sibling bridge. CLAUDE.md's simplicity rule does not want a one-field abstraction, and `.fallowrc.json` gives each bridge zone an allow-list of `[\"domain\", \"persistence\", \"shared\", \"platform\"]` with sibling bridges absent from every one."
  - "The three Group B slots were removed on sibling-comparison evidence, not on an empty witness list alone. Every other member of all three input bundles carries a production witness at its destructure site, so the model demonstrably reaches these declarations -- this is not the 06-09 factory-closure under-credit pattern, and the check for it came back negative."
  - "`update-swap.ts:177`'s vestigial `Omit<Phase3Failure, \"cause\">` WAS simplified. 06-14 handed it off conditionally; the compiler-forced slot deletions put this plan in that file anyway, so the condition was met. It landed as its own commit because its rationale is independent of the slot removal."
  - "Two out-of-scope defects were measured and recorded in `deferred-items.md` rather than fixed: a hermeticity leak in `tests/orchestrators/marketplace/remove.test.ts`, and six ledger notes naming a witness coordinate the fresh report no longer holds. Neither sits in a file this plan owns."

patterns-established:
  - "Contract-coordinate safety was proved by counterexample, not assumed: re-introducing one pre-repair coordinate makes the engine exit 2 with `names no declaration in this program`, so a mis-anchored entry cannot become a quiet allowance."
  - "A restored ledger note is DERIVED from the fresh report, never transcribed. Eight of the sixteen restored notes carry a witness coordinate that genuinely moved; transcription would have written eight coordinates nothing is at."
  - "The note-restoration template was validated against the 276 rows that did not move before being used on the 16 that did, which is also what surfaced the six pre-existing stale notes."

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The dead rename-pair source slot is gone from all four declaration sites in one change, the rollback helper's behaviour is unchanged, and Group A's 10 rows leave the unread set"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/shared/fs-utils.test.ts tests/bridges/{agents,commands,skills}/*.test.ts (442/442)"
        status: pass
      - kind: other
        ref: "check-unused-type-members.mjs --json -- 103 -> 93, exactly the 10 Group A rows lost, zero gained"
        status: pass
      - kind: other
        ref: "status-transition diff over all 3,426 members -- runtimeObserved held at 3,002, zero members added, the 10 removed were all runtime-observed `.to` coordinates the narrowing shifted"
        status: pass
      - kind: other
        ref: "counterexample: pushing `{ from, to }` onto the narrowed ledger is refused TS2353 at skills/stage.ts:500:22"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three surplus staging-input slots are gone with per-slot no-reader evidence, every compiler-named build site was fixed by deletion, and Group B's 3 rows leave the unread set"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "node --test tests/bridges/{agents,commands,skills}/*.test.ts tests/orchestrators/plugin/*.test.ts (1826/1826)"
        status: pass
      - kind: other
        ref: "check-unused-type-members.mjs --json -- 93 -> 90, exactly the 3 Group B rows lost, zero gained; owned-area findings = 0"
        status: pass
      - kind: other
        ref: "sibling evidence -- all 9 other StageAgentsInput members, all 7 other StageCommandsInput members and all 7 other StageSkillsInput members carry a production witness; the three removed slots carried none"
        status: pass
      - kind: other
        ref: "git diff over all three commits -- no ` as `, `!`, `@ts-ignore`, `@ts-expect-error` or `: any` added anywhere"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every coordinate-addressed record the edits moved was re-anchored in the same change and the engine still reaches a member verdict"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "contracts stay at 85 with owner/key/category/purpose byte-identical for all 85; explicitContract count held at 85 across the whole run"
        status: pass
      - kind: other
        ref: "counterexample: skills/types.ts:117:55 (the pre-repair coordinate) makes check-unused-type-members.mjs exit 2 -- `Invalid contract: ... names no declaration in this program`"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -- exit 0, 236 pairs in 489.3s, `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly`"
        status: pass
    human_judgment: false
  - id: D4
    description: "The record reconciles with only other owners' unread rows outstanding, and every re-keyed note names a coordinate the fresh report holds"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "check-unused-type-members.audit.mjs --check -- exit 1, 90 problems, 90 of 90 kind `unread`; zero stale-source, stale-record, incomplete, duplicate, invalid"
        status: pass
      - kind: other
        ref: "zero problems name bridges/agents, bridges/commands, bridges/skills or shared/fs-utils.ts; population table reads 0 unread for all four"
        status: pass
      - kind: other
        ref: "all 16 restored notes derived from tmp/members-final.json; every cited witness coordinate asserted present in that member's own witness list"
        status: pass
    human_judgment: false
  - id: D5
    description: "The quality chain, the coverage obligation and the negative controls are unchanged by the repairs"
    verification:
      - kind: other
        ref: "npm run check (exit 0, all four fallow sub-gates including the architecture-boundary gate)"
        status: pass
      - kind: other
        ref: "coverage/unit.lcov over extensions/ -- 227 modules, functions 1834/1834, branches 9050/9050, lines 62910/62910, zero modules below 100%"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7 ok, exit 0"
        status: pass
      - kind: other
        ref: "suppression census -- fallow-ignore 10 (baseline 10), ignoredClones 2, contracts 85, pin rows 2; none added"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two defects outside this plan's ownership were measured and recorded rather than fixed or ignored"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: ".planning/phases/06-unused-type-member-gate/deferred-items.md -- both entries carry the measurement that establishes them"
        status: pass
    human_judgment: true
    rationale: "Leaving a measured defect standing is an owner judgment. The measurements are mechanical, but the decision not to fix the six stale notes -- honouring 'no row outside this plan's four files changed its note' over 'make the record internally honest' -- wants a human to agree."

duration: 106 min
completed: 2026-09-16
---

# Phase 06 Plan 10: bridges/agents, bridges/commands, bridges/skills and shared/fs-utils Member Repairs Summary

**All 13 unread members across the three artifact bridges and the rollback helper cleared -- one dead rename-pair source slot narrowed at four declaration sites in a single atomic change, and three surplus staging-input slots removed on sibling-comparison evidence -- taking the live population from a measured 103 to 90 with zero findings gained, and leaving all four owner areas at zero unread.**

## Performance

- **Duration:** 106 min
- **Started:** 2026-09-15T23:35:00Z
- **Completed:** 2026-09-16T01:21:00Z
- **Tasks:** 3 of 3
- **Files modified:** 20 (10 production, 7 test, 2 record/pin, 1 triage) + 1 created

## The measured delta

| Measurement | Before | After | Change |
| --- | --- | --- | --- |
| Unread, whole tree | 103 | 90 | **-13** |
| Unread, this plan's four owner areas | 13 | **0** | -13 |
| Findings gained | -- | **0** | -- |
| Candidates | 3,426 | 3,413 | -13 |
| Runtime-observed | 3,002 | 3,002 | 0 |
| Test-only-observed | 236 | 236 | 0 |
| Explicit-contract | 85 | 85 | 0 |
| Unsupported analysis | 0 | 0 | 0 |

The whole-tree drop is exactly 13 and every one of the 13 is an owned row. The
delta was taken as a `(path, owner, key)` set difference against
`tmp/members-before.json`, measured twice -- once after each source task -- not
inferred from the count.

Per-owner, from the regenerated population table:

| Owner | Unread before | Unread after |
| --- | --- | --- |
| bridges/agents | 4 | **0** |
| bridges/commands | 4 | **0** |
| bridges/skills | 4 | **0** |
| shared (the `fs-utils.ts` row) | 1 | **0** |

The nine `shared` rows above that single row were 06-14's and were already gone
when this plan started; the `shared` owner now reads 0 outright.

## Accomplishments

### The rename ledger carries only what its consumer reads (10 rows, 4 sites, 1 commit)

`rollbackReplacementCommon` iterates `input.renamed` and reads exactly one thing
from each entry: `pair.to`, the path it removes. The source path was inert data
carried through four declarations -- the shared helper's input interface in
`shared/fs-utils.ts`, and in each of the three bridges the `*ReplacementInternals`
handle type, the local mutable ledger array inside `replacePrepared*`, and the
`rollback*ReplacementInternal` parameter.

All four narrowed in one commit. This was not stylistic: `{ from, to }[]` is
assignable to `{ to }[]`, so narrowing the helper alone compiles while leaving
three bridges describing a value the helper no longer declares, and nothing
fails. The plan forbade doing it a bridge at a time and that instruction is the
reason the repair is sound.

At each rename loop the entry pushed was the iterated `_stagedFilePaths` /
`_renamePairs` element, which still carries its own source path because the
`rename` call one line above reads it. Forwarding that element whole into a
narrowed ledger would have carried an undeclared property across the boundary,
so each loop now pushes a fresh `{ to: pair.to }`. That the boundary is still
guarded was **exercised, not assumed**: reinstating `{ from: pair.from, to: pair.to }`
in the skills loop is refused `TS2353 ... 'from' does not exist in type '{ to: string; }'`
at `skills/stage.ts:500:22`.

The staged-paths declarations themselves were left alone -- their source path is
genuinely read by the rename.

The helper's loop body, its per-entry leak text, its `rmOptions` per mode and its
ordering against the backup restore and the cleanup step are unchanged. Six
rollback fixtures in `tests/shared/fs-utils.test.ts` dropped the key the shape no
longer declares; the fault-injection cases that assert one leak per failed
removal are otherwise untouched and pass.

### Three staging input bundles stopped declaring slots nothing reads (3 rows)

| Slot | Evidence it has no reader |
| --- | --- |
| `StageAgentsInput.resolved` (`agents/types.ts:72:3`) | `prepareStagePluginAgents` is the only function taking the type. Its destructure at `stage.ts:101-110` names every other slot; the only other `input.` access is `input.agentsDirs` at `:121`. The agents bridge never needs a resolved plugin -- `discoverPluginAgents` takes `{ pluginName, agentsDirs }`, so the caller has already resolved the directories. |
| `StageCommandsInput.marketplaceName` (`commands/types.ts:43:3`) | The destructure at `commands/stage.ts:171` names every slot except this one; `input.previousCommandNames` at `:172` is the only other access. `marketplaceName` appears nowhere else in `bridges/commands/` outside the declaration. |
| `StageSkillsInput.marketplaceName` (`skills/types.ts:29:3`) | The same shape at `skills/stage.ts:196-197`. `marketplaceName` appears nowhere else in `bridges/skills/` outside the declaration. |

For all three: no `...input` spread, no whole-object forward, no delegate. Each
type is the parameter type of exactly one function and is referenced nowhere in
`extensions/` outside its own bridge.

**These are the three rows the triage itself marked "needs the owner to confirm",
so the confirmation is the load-bearing part.** The decisive measurement is the
sibling comparison, which is what distinguishes a real absence from the
factory-closure under-credit 06-09 found:

```
StageAgentsInput   locations/marketplaceName/pluginName/pluginRoot/pluginDataDir/
                   agentsDirs/knownSkills/mapModel/cwd  -> 1 production witness each
                   resolved                             -> 0
StageCommandsInput locations/pluginName/pluginRoot/pluginDataDir/resolved/
                   previousCommandNames/cwd             -> 1 production witness each
                   marketplaceName                      -> 0
StageSkillsInput   locations/pluginName/pluginRoot/pluginDataDir/resolved/
                   previousSkillNames/cwd               -> 1 production witness each
                   marketplaceName                      -> 0
```

Every sibling is credited at the destructure site, so the model reaches all three
declarations and resolves reads through them. The empty witness list on the odd
slot out is an absence of readers, not an absence of reach. The asymmetry is
itself corroborating: `marketplaceName` is read in the agents bridge and is not
flagged there, while `resolved` is read in the commands and skills bridges and is
not flagged there.

Excess-property checking then enumerated the consequences: 120 compiler errors
across nine files, every one fixed by deleting the named property. Three
orchestrator prepare paths (`install-outcome.ts`, `update-swap.ts`,
`reinstall-replace.ts`) and six suites. The agents bundle's removal also orphaned
its `resolver-types` import and 38 locally built resolver fixtures in the agents
suite that existed only to feed the removed slot; `noUnusedLocals` named each one.
Nothing was silenced with a cast, an assertion, a spread of a wider object or a
widened parameter -- the diff over all three commits contains no ` as `, `!`,
`@ts-ignore`, `@ts-expect-error` or `: any`.

Three compile-proof files (`types.test.ts` in each bridge) needed the property
dropped from both the positive literal and the `@ts-expect-error` negative. The
negatives had gone inert: with an excess property present, TypeScript reports the
excess and stops, so the missing-`cwd` proof no longer fired and `TS2578 Unused
'@ts-expect-error' directive` appeared. Dropping the key restored all three
proofs.

### `UpdatePhase3Failure` extends `Phase3Failure` directly

06-14 removed `Phase3Failure.cause` and handed off the now-vestigial
`extends Omit<Phase3Failure, "cause">` at `update-swap.ts:177`, conditional on
whether this plan ended up in that file. **It did** -- the compiler-forced slot
deletions land at `:234`, `:245` and `:260` of the same file -- so the condition
was met and the expression was simplified. `Phase3Failure` declares `phase`,
`msg` and `cleanupFailures`; omitting `"cause"` removes nothing.

It landed as its own commit (`1e2402be`) because its rationale is independent of
the slot removal. The sibling `Omit<PluginUpdateFailedOutcome, ...>` directly
below it is untouched -- that one still removes the keys it names.

## Re-anchored coordinate records

Task 1 shifted no lines: every edit replaced a single line in place. Task 2's
deletions shifted five contract coordinates, all re-derived from the repaired
source rather than arithmetic:

| Entry | Was | Now |
| --- | --- | --- |
| `agents/types.ts` `AgentsReplacementNoop.prepared.kind` | `165:55` (filter `165:22`) | `163:55` (filter `163:22`) |
| `commands/types.ts` `CommandsReplacementNoop.prepared.kind` | `119:57` (filter `119:22`) | `118:57` (filter `118:22`) |
| `skills/types.ts` `SkillsReplacementNoop.prepared.kind` | `117:55` (filter `117:22`) | `116:55` (filter `116:22`) |
| `install-outcome.ts` `FailedRunPhasesResult.ok` | `1007:3` (refines `1006:30`) | `1004:3` (refines `1003:30`) |

Eight coordinate fields across four entries. The count stayed at 85 and
`owner`, `key`, `category` and `purpose` are byte-identical for all 85 -- the
same proofs at new addresses.

**The plan was written against 81 contracts; the live file holds 85**, because
06-14 appended four accepted entries after the plan was authored. The four
entries that needed re-anchoring were re-derived against the current 85, not
against the plan's list.

That a mis-anchor is loud rather than quiet was exercised as a control:
re-introducing `skills/types.ts:117:55` makes the gate exit **2** with
`Invalid contract: extensions/pi-claude-marketplace/bridges/skills/types.ts:117:55 names no declaration in this program`
-- a setup failure before any member verdict, exactly as the hazard predicted.

The `install-outcome.ts` direct-coverage pin was re-measured, not relaxed:

```
pinned:   branches 109/111, lines 1043/1049
measured: branches 109/111, lines 1040/1046
```

Only the `reading` string changed. `findingIds` and `reasons` are byte-identical,
and **the uncovered branch count did not rise** -- it held at 2 (109 of 111). The
three deleted lines were covered, so both line figures fall by exactly three. The
`bridges/commands/discover.ts` pin was not touched; its module was not edited and
it still matches. Final run: exit 0, 236 pairs in 489.3 s,
`2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly`.

## The record reconciles

`--inventory` was re-run after the last source edit; the digest moved to
`59f0fa76` and the rebuild re-keyed **16** disposition rows -- the 15 in the three
`types.ts` files below the removed slot, plus the `install-outcome.ts` contract
row. `--check` named every one of them as `incomplete` before they were restored,
which is the mechanism working.

The 16 notes were **derived from the fresh report, not transcribed**, and that was
the right call: eight of them carry a witness coordinate that genuinely moved
because the same edits shifted the suites the witnesses sit in.

| Row | Old witness | Fresh witness |
| --- | --- | --- |
| `agents/types.ts` `StagedAgentRecord.sourcePath` / `.targetPath` | `agents/stage.test.ts:1990:30` | `:1702:30` |
| `agents/types.ts` `StageAgentsCommitResult.stagedNames` | `agents/stage.test.ts:181:56` | `:154:56` |
| `commands/types.ts` `StagedCommandRecord.sourcePath` / `.targetPath` | `commands/stage.test.ts:358:26` | `:352:26` |
| `commands/types.ts` `StageCommandsCommitResult.stagedNames` | `commands/stage.test.ts:594:42` | `:582:42` |
| `skills/types.ts` `StagedSkillRecord.sourcePath` / `.targetPath` | `skills/stage.test.ts:580:28` | `:572:28` |
| `skills/types.ts` `StageSkillsCommitResult.stagedNames` | `skills/stage.test.ts:308:44` | `:304:44` |

Witness counts and syntax kinds were unchanged in every case; only the addresses
moved. Each restored note was checked programmatically against the member's own
witness list in `tmp/members-final.json` before being written, so no note names a
site the report does not hold.

The restoration template was validated against the 276 already-explained rows it
reproduces exactly before being used on the 16 -- which is also how the six
pre-existing stale notes below were found.

Closing state:

```
node scripts/check-unused-type-members.audit.mjs --check
  exit 1, 90 problems, 90 of 90 kind `unread`
  zero stale-source, stale-record, incomplete, duplicate, invalid
  zero problems naming bridges/agents, bridges/commands, bridges/skills or shared/fs-utils.ts
```

Exit 1 is the designed behaviour while 06-11, 06-12 and 06-13's rows stand.

## Commands and exit statuses

All measured in the foreground on the tree as it stands after the last source edit.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | clean |
| `npm run fallow` | 0 | all four sub-gates, boundary gate included |
| `npm run check` | 0 | 6,473 unit + 32 integration (2 skipped, pi-subagents peer absent) |
| `node --test tests/shared/fs-utils.test.ts tests/bridges/{agents,commands,skills}/*.test.ts` | 0 | 442/442 |
| `node --test tests/bridges/{agents,commands,skills}/*.test.ts tests/orchestrators/plugin/*.test.ts` | 0 | 1826/1826 |
| `node scripts/check-unused-type-members.mjs` | 1 | 103 -> 93 -> 90; 1 is a member verdict, not a failure |
| `node scripts/check-unused-type-members.audit.mjs --check` | 1 | 90 problems, all `unread`, none owned |
| `npm run test:coverage:unit` | 0 | see below |
| `npm run test:coverage:direct:all` | 0 | 236 pairs, 489.3 s, both pins matched |
| `node scripts/check-unused-type-members.negative.mjs` | 0 | 7 of 7 ok |

Aggregate production unit coverage, read directly from `coverage/unit.lcov`:

```
227 modules under extensions/
functions 1834/1834   branches 9050/9050   lines 62910/62910
modules below 100%: 0
```

Functions and branches are **unchanged** from 06-14's 1834/9050 -- these removals
took no control flow with them. Lines moved 62,919 -> 62,910, a drop of exactly
nine: three covered property lines each in `install-outcome.ts`,
`reinstall-replace.ts` and `update-swap.ts`. The type-only removals in the three
`types.ts` files and `fs-utils.ts` emit no executable lines and moved nothing. No
threshold was lowered and no exclusion added.

Suppression census, unchanged end to end: `fallow-ignore` 10 (baseline 10),
`ignoredClones` 2, contract entries 85, pin rows 2.

Narrowing three parallel bridge declarations did bring them closer together, but
neither `fallow dupes` nor `sonarjs/no-identical-functions` fired -- no
restructuring was needed and none was done.

## Task commits

1. **Task 1 (tracer): narrow the rollback rename ledger at all four declaration sites** - `7eceb225` (refactor)
2. **Task 2: drop the three surplus staging input slots and re-anchor every moved record** - `6606607c` (refactor)
3. **Task 2 (split out): extend `Phase3Failure` without a no-op `Omit`** - `1e2402be` (refactor)

Task 3 produced no source change; its output is the regenerated
`06-LIVE-TRIAGE.md`, this summary and `deferred-items.md`, committed together.

## Judgment calls

### The `update-swap.ts` `Omit`: simplified, because the condition was met

06-14's hand-off was conditional -- simplify it only if this plan's
compiler-forced edits landed in that file, otherwise hand it to 06-12. Three of
them did land there, so the edit is not gratuitous and the file is not being
opened for its sake. Split into its own commit so the two rationales stay
separable.

### Six ledger notes left stale rather than corrected

Deriving the restoration template exposed six rows whose stored witness
coordinate no longer resolves: three `bridges/hooks/routing-state.ts` rows citing
`tests/architecture/hooks-lifecycle.test.ts:457:44` where the report says
`:453:44`, and three `orchestrators/types.ts` rows citing
`tests/orchestrators/plugin/update-flow.test.ts:8879:66` where the report says
`:8877:66`. Counts and syntax kinds still match; only the line numbers drifted,
and the offsets line up with earlier repairs in this phase that shifted those
files without re-reading the notes keyed to them.

`--check` does not compare note text against the report -- it only requires that
a note exist -- so these rows read `explained` and the audit is silent about them.
None is in a file this plan touched, and this plan's contract says no row outside
its four owner areas may lose or change its note. They were measured and recorded
in `deferred-items.md` rather than edited. The durable fix is a `--check` rule
that compares a cited coordinate against the fresh report, so the drift cannot
stay silent.

### No analyzer under-credit found, and none claimed

06-09's `WriteHookConfigResult.written` row was a real under-credit: a member
with production readers that the model could not reach through a
factory-returned closure. The check for that pattern here came back **negative**
on all three Group B slots -- their siblings carry witnesses through the very
destructures the slots would be read at. Recorded so the absence is a measurement
rather than an omission.

## Observed limits

### `npm run check` needs a hermetic `HOME` on this machine

`tests/orchestrators/marketplace/remove.test.ts` makes a `scope: "user"` call
without a hermetic home, so `loadState` reads the operator's real
`~/.pi/agent/pi-claude-marketplace/state.json`. That file carries
`schemaVersion: 3`; `state-io.ts:400-407` admits only 1 or 2, so the case throws
`has an unsupported schema version`.

Measured both ways on the same tree: **23 pass / 1 fail** with the real `HOME`,
**24 pass / 0 fail** with `HOME` pointed at an empty directory. Every gate
reported above was run with a hermetic `HOME` for that reason, which is also what
CI has -- a runner with no `~/.pi/agent/` at all, which is why the suite is green
there and this stays latent.

Nothing in this plan's diff can reach that path. Logged in `deferred-items.md`;
the fix is to give the case a hermetic home, not to relax the schema gate.

### Two integration tests skip on the pi-subagents peer

`T-d8i-01` and the `SC-2 / AGSK-06` skill-resolution case report
`pi-subagents ... not reachable in this environment`. Pre-existing environment
condition, unrelated to this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Three `types.test.ts` compile proofs went inert and had to be repaired**

- **Found during:** Task 2
- **Issue:** Each bridge's `types.test.ts` carries a `@ts-expect-error` proof that
  the input bundle always requires `cwd`. With an excess property present in the
  same literal, TypeScript reports the excess and stops, so the missing-`cwd`
  error never fired and `tsc` reported `TS2578 Unused '@ts-expect-error' directive`.
- **Fix:** Dropped the removed key from both the positive literal and the negative
  one in all three files. The `cwd` proof fires again in all three.
- **Files modified:** `tests/bridges/{agents,commands,skills}/types.test.ts`
- **Verification:** `npm run typecheck` exit 0 with all three directives used

**2. [Rule 3 - Blocker] 38 orphaned resolver fixtures and two orphaned imports in the agents and commands suites**

- **Found during:** Task 2
- **Issue:** Deleting the `resolved` property orphaned the `const resolved = {...}
  satisfies ResolvedPluginInstallable` block that existed only to feed it, at 38
  sites; `noUnusedLocals` named each. The same deletion orphaned the
  `ResolvedPluginInstallable` import in the agents suite, and the commands suite's
  `MARKETPLACE_NAME` constant.
- **Fix:** Deleted exactly the declarations the compiler named, iterating until
  clean. A line-by-line census of the 496 deleted lines in the agents suite
  confirms every one belongs to a `const resolved` fixture block, the `resolved,`
  property or the import -- not one assertion line was removed. The commands and
  skills suites keep their `ResolvedPluginInstallable` imports, which are still used.
- **Files modified:** `tests/bridges/agents/stage.test.ts`, `tests/bridges/commands/stage.test.ts`
- **Verification:** `node --test` 1826/1826; `npm run typecheck` exit 0

**3. [Rule 1 - Record] The plan's contract count was 81; the live file holds 85**

- **Found during:** Task 2
- **Issue:** The plan's action text, its verify assertion and its artifact
  description all pin the contract file at 81 entries. 06-14 appended four
  accepted entries after the plan was authored.
- **Fix:** Re-derived which entries sit below the edit points against the current
  85 rather than against the plan's list, and asserted 85 instead of 81. The four
  that needed re-anchoring are the same four the plan named; the other 81 are
  unaffected.
- **Files modified:** none (assertion corrected in execution)
- **Verification:** `explicitContract` count held at 85 across every run

**Total deviations:** 3 auto-fixed (2 Rule 3 blockers, 1 Rule 1 stale record).
**Impact:** None on behaviour. Two were compiler-forced consequences the plan
anticipated in kind; the third corrects a count the plan inherited from a
pre-06-14 snapshot.

## Counterexamples exercised

| Task | `fails_when` clause | Control run |
| --- | --- | --- |
| T1 | a declaration site still carries the slot | grep over all four sites -- `renamed` is `{ to: string }` everywhere, and `grep -rn "renamed.*from: string" extensions/` returns nothing |
| T1 | the rename ledger is fed a value carrying an undeclared property | reinstated `{ from, to }` on the skills push -> `TS2353` at `skills/stage.ts:500:22` |
| T1 | the rollback helper's loop, leak text or removal options changed | `git diff` on `fs-utils.ts` is the one declaration line; the fault-injection suite passes unmodified |
| T1 | a member outside Group A changed status | status-transition diff over all 3,426 members -- the only changes are the 10 Group A rows |
| T2 | a slot removed without no-reader evidence | sibling witness table above, recorded per slot before the edit |
| T2 | an excess-property site silenced by a cast or widened type | `git diff` over all three commits -- no ` as `, `!`, `@ts-*` or `: any` added |
| T2 | a contract entry's proof fields changed while re-anchoring | field-by-field comparison over all 85 entries -- `owner`, `key`, `category`, `purpose` byte-identical |
| T2 | a mis-anchored entry becomes a quiet allowance | re-introduced the pre-repair coordinate -> exit **2**, `names no declaration in this program` |
| T2 | a pin's finding ids or reasons change, or its uncovered count rises | both asserted byte-identical; uncovered branches held at 2 |
| T2 | a suppression of any kind added | census: 10/10 fallow-ignore, 2 ignoredClones, 85 contracts, 2 pins |
| T3 | the ledger left reporting stale-source or incomplete | `--check` reports 0 of both |
| T3 | a restored note names a coordinate the fresh report does not hold | every cited coordinate asserted against the member's own witness list before writing |
| T3 | an unread problem still names one of the four owner areas | 0 of 90 |
| T3 | a production coverage metric below 100% | 1834/1834, 9050/9050, 62910/62910, 0 modules below |

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/fs-utils.ts` - `RollbackReplacementInput.renamed` carries only the destination.
- `extensions/pi-claude-marketplace/bridges/{agents,commands,skills}/stage.ts` - the same narrowing at the internals handle, the local ledger and the rollback parameter; each rename loop pushes a fresh destination-only entry.
- `extensions/pi-claude-marketplace/bridges/agents/types.ts` - `StageAgentsInput.resolved` and its now-orphaned resolver-types import removed.
- `extensions/pi-claude-marketplace/bridges/{commands,skills}/types.ts` - `marketplaceName` removed from each staging input bundle.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install-outcome,reinstall-replace}.ts` - the three build-site properties the removals orphaned.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` - the same three, plus `UpdatePhase3Failure` extending `Phase3Failure` without the no-op `Omit`.
- `tests/shared/fs-utils.test.ts` - six rollback fixtures build the narrowed pair.
- `tests/bridges/{agents,commands,skills}/stage.test.ts` - the passed property, the fixtures it fed and the locals those orphaned.
- `tests/bridges/{agents,commands,skills}/types.test.ts` - the removed key dropped from both the positive literal and the inert `@ts-expect-error` negative, restoring all three `cwd` proofs.
- `scripts/check-unused-type-members.contracts.json` - eight coordinate fields across four entries re-anchored; nothing else touched.
- `scripts/test-coverage-direct.pin.json` - one `reading` string re-measured; nothing else touched.
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` - regenerated against the repaired tree with all 16 re-keyed notes restored from the fresh report.
- `.planning/phases/06-unused-type-member-gate/deferred-items.md` - **created**; two measured, out-of-scope defects.

## Known Stubs

None. No slot was stubbed, no reader invented, no test weakened. Every removal is
a deletion whose consequence the compiler enumerated.

## Issues Encountered

One, both measured and recorded rather than worked around: the local `npm run check`
needs a hermetic `HOME` on this machine because
`tests/orchestrators/marketplace/remove.test.ts` reads the operator's real user
scope. See **Observed limits**. It blocks nothing in CI and nothing in this plan's
diff reaches it.

## Next Phase Readiness

Three repair plans remain: **06-11** (`edge`, 17 rows), **06-13** (`domain`,
`persistence`, `platform`, 23 rows) and **06-12** (`orchestrators`, 49 rows).
The live population stands at **90 unread, 0 unsupported, 85 contracts, 3,413
candidates**, at digest `59f0fa76`, with every one of the 90 owned by one of
those three. 06-08 activates the gate once they reach zero.

Hand-offs:

- **06-12**: `update-swap.ts:177`'s vestigial `Omit` is closed -- do not expect it.
  The file's two unread rows, `DirectRenderableFailedOutcome.cause` at `188:3` and
  `.toVersion` at `191:3`, are untouched and still at those exact coordinates;
  this plan's deletions were all below them.
- **All three**: the contract file holds **85** entries, not the 81 several plans
  were authored against. Re-derive coordinates against the live file.
- **All three**: run the gates with a hermetic `HOME` until the
  `remove.test.ts` leak in `deferred-items.md` is closed, or expect one spurious
  failure.
- **Whoever closes the ledger**: six notes name a witness coordinate the report no
  longer holds, recorded in `deferred-items.md`. `--check` does not catch them.

## Self-Check: PASSED

- `deferred-items.md` exists on disk.
- All 20 modified files exist on disk.
- `git log` holds all three task commits: `7eceb225`, `6606607c`, `1e2402be`.
- Every task's `<verify>` assertion was re-run on the final tree: T1's and T2's
  member-delta assertions both exit 0, T3's audit assertion exits 0 on
  non-`unread` problems and owned problems.
- `npm run check` exit 0, `test:coverage:direct:all` exit 0, negative controls
  7 of 7.

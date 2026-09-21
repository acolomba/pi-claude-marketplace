# Phase 112: Install and removal lifecycle - Research

**Researched:** 2026-09-05
**Domain:** Transactional ledger wiring, removal-cascade composition, and orphaned-staging garbage collection inside an existing TypeScript extension
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Criterion 6 — sweep, not report, and follow the existing GC**

> The ROADMAP says "swept **or** reported", leaving the choice open. Settle it as
> **swept**, modeled on the existing house machinery rather than a new design:
> `orchestrators/plugin/clone-gc.ts` already exports
> `garbageCollectPluginClones(locations): Promise<string[]>` for exactly this
> shape of problem — an accumulating cache directory the normal lifecycle does not
> reach. Mirror its structure, its return contract (the names it removed), and its
> call-site placement.
>
> Two constraints the ROADMAP states and the sweep must honor:
>
> - **Age-bounded.** A concurrent install's fresh staging root must never be
>   removed. The bridge has no view of which trees belong to a live transaction;
>   this phase owns the ledger and is where that view exists.
> - The tree holds **verbatim third-party executable JavaScript** under `$HOME`,
>   outside every scope root. That is why it matters, and also why the age bound
>   is load-bearing rather than a nicety.
>
> If research shows the `clone-gc.ts` precedent does not transfer — different
> liveness signal, different call site — say so with evidence and propose the
> nearest alternative. Do not invent a bespoke sweeper while an analogous one
> exists unexamined.

**Research verdict on that decision:** the precedent transfers in *structure, call-site
placement, containment discipline and failure policy*, but **its stated return contract is
misremembered and its liveness signal does not transfer at all**. Both are evidenced in
§"Criterion 6" below. The CONTEXT explicitly authorizes saying so.

### Claude's Discretion

> At Claude's discretion. Use the ROADMAP's seven success criteria, the Phase 111
> artifacts, and the codebase conventions.

### Deferred Ideas (OUT OF SCOPE)

> - Update, enable/disable, reconcile and the `info` / `list` read surfaces are
>   Phase 113 (WLIF-04..06, WFLW-04). Phase 113 criterion 5 already carries the
>   Phase 111 review's WR-09 (the warning channel is install-tense but documented
>   as the source for the read-only `info` surface).
> - The soft-dependency marker and `docs/workflows-compatibility.md` are Phase 114.
> - `IN-06` from the Phase 111 review — a throwing `onPlaced` callback destroys the
>   original error and every rollback leak. Adjudicated there as a non-blocking
>   Info carry-forward with no carrier owed. If this phase's ledger wiring makes
>   `onPlaced` throwable in practice, revisit it here rather than leaving it.
> - `NAMEFOLD-01` (`.planning/BACKLOG.md`) — repo-wide generated-name case-folding
>   exposure. Not this phase's.

**Note on IN-06:** this phase DOES install an `onPlaced` callback in the ledger
(§"Criterion 1"). The recommended body is a single assignment to a context field
(`c.stagedWorkflowNames = placedNames`) which cannot throw. IN-06 therefore stays
un-triggered, and the deferral holds. A plan that puts anything else in that callback
re-opens it.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WLIF-01 | "Install materializes workflows as a 6th phase of the transactional ledger, and a later phase failure unstages them. Append to the literal `Phase` array in `orchestrators/plugin/install.ts`." | §"Criterion 1" gives the exact `Phase<InstallCtx>` shape against the current file, the `InstallCtx` fields it needs, and the state-record field the phase writes. §"Criterion 3 (PI-14)" proves the undo/ledger interaction. |
| WLIF-02 | "Update re-stages workflows -- adding, removing, and replacing artifacts to match the new plugin version. `update.ts` is the only other `runPhases` consumer." | **Scoping correction — see §"WLIF numbering conflict".** The workstream REQUIREMENTS.md maps `WLIF-01..03 → Phase 112` while the archived milestone text defines WLIF-02 as *update*, which the ROADMAP assigns to Phase 113. Phase 112 delivers only the closed-set widening WLIF-02's consumer needs (criterion 2); the update behavior is Phase 113. |
| WLIF-03 | "Uninstall removes every workflow artifact it installed, leaving nothing behind outside the scope root." | §"Criterion 3" enumerates all four `cascadeUnstagePlugin` call sites and shows one edit to the primitive covers `uninstall`, `disable`, `marketplace remove --cascade` and install's own materialize-then-disable path. |

**Requirement-ID hygiene note.** The archived-milestone WLIF texts (`milestones/workflows-REQUIREMENTS.md:75-80`) and the live workstream mapping table (`REQUIREMENTS.md:105-106`) disagree about which behavior WLIF-02 names. The ROADMAP's *criteria* are unambiguous and are the operative contract: criterion 2 is the union widening; update is explicitly Phase 113. The planner should map tasks to ROADMAP criteria, not to the archived WLIF-02 prose, and may want to file the ID drift as a one-line REQUIREMENTS.md correction. `[VERIFIED: .planning/workstreams/workflows/REQUIREMENTS.md:105-106]` — verbatim: `| WLIF-01..03 | Phase 112 | Pending (re-land) |` and `| WLIF-04..06, WFLW-04 | Phase 113 | Pending (re-land) |`.

</phase_requirements>

## Summary

This phase has no research unknowns in the usual sense: everything it needs is on disk and was
read this session. What it has instead is a set of **measured surprises**, four of which change
the shape of the plan.

**First, the phase is bigger than its criteria say.** The criteria name a sixth ledger phase, a
union widening, four removal paths, a reinstall slot and a sweeper. They do not name the thing
that gates all of them: **`state.json` has no `resources.workflows` field.** The record schema
(`persistence/state-io.ts:116-122`) carries exactly five arrays. Every removal path removes *by
recorded name* — the envelopes sit outside every scope root and nothing on disk can be enumerated
to rediscover them — so without that field, criteria 3 and 4 have nothing to read. Adding it as a
REQUIRED member was measured to produce **68 TypeScript errors across 30 files (3 production, 27
test)**. That is the single largest mechanical item in the phase and it must land first.

**Second, three of the four hardest wiring points are compile-forced and one is not.** Widening
`Phase3Failure.phase` fails loudly in `update.ts` (3 errors). Adding `resources.workflows` fails
loudly at 3 production sites. Adding `workflows` to `UnstageOutcome.dropped` fails loudly at 2.
But the two *partial-cascade fold* sites that subtract dropped names from the record —
`orchestrators/plugin/shared.ts:1188` and the hand-rolled duplicate at
`orchestrators/marketplace/remove.ts:325-335` — read `dropped.*` structurally and **compile
clean with the new axis silently ignored**. That is the exact "member added to a closed set
compiles clean at every derivation site" failure this repository has shipped before. It is the
one place a plan must add coverage deliberately rather than follow the compiler.

**Third, the `clone-gc.ts` precedent transfers only halfway.** Its structure, ENOENT no-op,
containment-chokepoint-before-`rm`, leaks-never-throw policy and call-site placement all
transfer verbatim. Its **return contract does not** — `garbageCollectPluginClones` returns
per-directory *rm-failure leak strings* (`return leaks;`, `clone-gc.ts:109`), not the names it
removed, and every call site discards the value. And its **liveness signal does not transfer at
all**: it derives live keys from persisted `resolvedSha`/`resolvedSource`, and a staging root is
a `randomUUID()` that is never persisted anywhere. The age bound is therefore not a refinement of
the precedent — it is the entire liveness mechanism, and it is new.

**Fourth, the PI-14 interaction Phase 111 predicted is exactly right, and it has a consequence
nobody has written down.** A `PathContainmentError` raised from `workflowsPhase.undo` escapes
`runPhases` as a throw (`phase-ledger.ts:89-91,125-127`), which means it **bypasses
`install.ts:1263-1266` where `capture.rollbackPartials` and `capture.version` are assigned**.
The renderer's PI-14 branch (`install.ts:1858`) is built for exactly that and handles it
correctly — but the version is lost from the row, which is the documented and intended PI-14
trade, not a defect.

**Primary recommendation:** land the state-schema field and the closed-set widenings as
compile-forced groundwork commits first, then the ledger phase, then the cascade, then reinstall,
then the sweeper — each with its owner test, and with the fallow allow-list string riding in the
same commit as the first orchestrator import.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sixth ledger phase (`do`/`undo`) | `orchestrators/plugin/install.ts` | `bridges/workflows/` | The literal-array discipline (`D-01`) puts every phase body at the orchestrator; bridges expose only prepare/commit/unstage primitives. |
| Ledger `phase` closed-set widening | `shared/errors.ts` | `orchestrators/types.ts`, `orchestrators/plugin/update.ts` | Three mirrored closed sets; the type is the source and the runtime tuple and the outcome union are its mirrors. |
| Removal cascade (all four verbs) | `orchestrators/marketplace/shared.ts` | — | `cascadeUnstagePlugin` is the single removal primitive; the four verbs inherit. |
| Partial-cascade record fold | `orchestrators/plugin/shared.ts` | `orchestrators/marketplace/remove.ts` | Two independent implementations exist today; both must gain the axis. |
| Reinstall re-materialization | `orchestrators/plugin/reinstall.ts` | — | Reinstall carries no ledger; it has its own prepare/replace/rollback trio. |
| Recorded workflow inventory | `persistence/state-io.ts` | `persistence/migrate.ts` | The record schema is the only place a workflow name survives across processes. |
| Orphaned-staging sweep | `orchestrators/plugin/` (new module) | `persistence/locations.ts` | Liveness is a lifecycle fact; the path chokepoint is persistence's. |
| Path containment on the sweep target | `persistence/locations.ts` | — | `assertPathInside` is the NFR-10 chokepoint and the sole sanctioned composer discipline (WPTH-04). |

## WLIF numbering conflict

`[VERIFIED: .planning/workstreams/workflows/milestones/workflows-REQUIREMENTS.md:75-77]` —
verbatim:

```text
- [x] **WLIF-01**: Install materializes workflows as a 6th phase of the transactional ledger, and a later phase failure unstages them. Append to the literal `Phase` array in `orchestrators/plugin/install.ts`.
- [x] **WLIF-02**: Update re-stages workflows -- adding, removing, and replacing artifacts to match the new plugin version. `update.ts` is the only other `runPhases` consumer.
- [x] **WLIF-03**: Uninstall removes every workflow artifact it installed, leaving nothing behind outside the scope root. This is load-bearing: the artifacts land outside `<scopeRoot>`, so a lifecycle gap here leaks executable files into `~/.pi/workflows/` with nothing tracking them.
```

`[VERIFIED: .planning/workstreams/workflows/REQUIREMENTS.md:105-106]` maps `WLIF-01..03` to
Phase 112 and `WLIF-04..06` to Phase 113, while the ROADMAP's Phase 113 line reads
`**Phase 113: Update, enable/disable, reconcile** ... (WLIF-04..06, WFLW-04)`.

So WLIF-02 (update) is claimed by both phases. **Resolution: follow the ROADMAP criteria.**
Phase 112's criterion 2 is only the union widening — and that widening is precisely what WLIF-02's
consumer (`PluginUpdatePhase3Error`) needs before Phase 113 can populate it. Phase 112 delivers
the type; Phase 113 delivers the behavior. The planner should state this in the plan rather than
leave a requirement double-booked.

## Research Question 1 — the ledger, mapped precisely

### `Phase<C>` — what a phase must provide

`[VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:35-39]` — verbatim:

```ts
export interface Phase<C> {
  readonly name: string;
  readonly do: (ctx: C) => Promise<void>;
  readonly undo?: (ctx: C) => Promise<void>;
}
```

The contract on that interface `[VERIFIED: transaction/phase-ledger.ts:26-34]` states, verbatim,
that `undo` "is invoked in reverse order over successfully-completed phases AND on the throwing
phase itself (failing-phase own-undo runs first from the catch block, before the reverse walk --
TR-02)", and that it "MUST tolerate being called after a partial-do throw -- it cannot assume
`do` ran to completion; gate on context-set sentinels and keep bridge cleanup helpers
ENOENT-tolerant."

**That sentence dictates the gate.** The workflows undo must gate on a context sentinel assigned
*before* the commit (the prep handle), not on the staged-name array — because a `do` that threw
inside `commitPreparedWorkflows` may have placed envelopes while `stagedWorkflowNames` was still
empty. Every existing phase follows the same shape: `skillsPhase.undo` gates on
`c.skillsPrep === undefined` `[VERIFIED: install.ts:952-955]`, `mcpPhase.undo` on
`c.mcpPrep === undefined` `[VERIFIED: install.ts:1136-1139]`, `hooksPhase.undo` on the
`c.hooksFileWritten` boolean `[VERIFIED: install.ts:1106-1109]`.

### The current array and its runner

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1239-1252]` —
verbatim:

```ts
  // D-01 literal-array; order is part of the contract -- never refactor
  // to a dynamic builder. D-63-01: hooks slot lands between agents and mcp.
  // The PRD-fixed sequence is
  // [skills, commands, agents, hooks, mcp, state].
  const phases: readonly Phase<InstallCtx>[] = [
    skillsPhase,
    commandsPhase,
    agentsPhase,
    hooksPhase,
    mcpPhase,
    statePhase,
  ];

  const result = await runPhases(phases, ctxLocal);
```

Note the array is **six** elements today (five bridges plus `state`), not five. The CONTEXT's
`:1244-1248` range names the five bridge slots; `statePhase` is at `:1249`. The sixth *bridge*
phase becomes the seventh array element, and it lands **between `mcpPhase` and `statePhase`** —
`statePhase` must stay last because it is the phase that writes `resources.workflows` from the
names the workflows phase produced.

Phase definitions on the current file: `skillsPhase` at `:921`, `commandsPhase` at `:966`,
`agentsPhase` at `:1007`, `hooksPhase` at `:1076`, `mcpPhase` at `:1115`, `statePhase` at `:1149`.

### `InstallCtx` — module-private, and what it must gain

`[VERIFIED: install.ts:316-326]` states verbatim that the type is "Module-private on purpose: it
is the transaction's mutable scratchpad ... Callers outside this module get the fully-`readonly`
`InstallLedgerSummary` projection instead."

Current per-phase handle fields `[VERIFIED: install.ts:343-362]` — verbatim:

```ts
  skillsPrep?: PreparedSkillsStaging;
  commandsPrep?: PreparedCommandsStaging;
  agentsPrep?: PreparedAgentsStaging;
  mcpPrep?: PreparedMcpStaging;
  hooksFileWritten: boolean;
  hookEntries?: readonly HookSummaryEntry[];
  stagedSkillNames: readonly string[];
  stagedCommandNames: readonly string[];
  stagedAgentNames: readonly string[];
  stagedMcpServerNames: readonly string[];
```

The sixth phase needs two additions:

- `workflowsPrep?: PreparedWorkflowsStaging;` — the undo sentinel.
- `stagedWorkflowNames: readonly string[];` — a **required** field initialized `[]` at the
  context literal (`install.ts:908-911` is the block that initializes the four sibling arrays),
  so the `statePhase` record composition cannot forget it.

`InstallLedgerSummary` `[VERIFIED: install.ts:495-514]` carries `stagedAgentNames` and
`stagedMcpServerNames` and its comment says they are "read only for their emptiness (ENBL-07
soft-dep flags)". **The workflow analogue belongs to Phase 114** (the third soft-dependency
marker, WDEP), not here. Do not widen `InstallLedgerSummary` in this phase — it would add a
field no consumer reads, and `toInstallLedgerSummary` (`install.ts:817`) is its only producer.

### What a sixth `workflowsPhase` looks like against the current file

The bridge barrel `[VERIFIED: bridges/workflows/index.ts:9-11]` exports, verbatim:

```ts
export { discoverPluginWorkflows } from "./discover.ts";
export { abortPreparedWorkflows, commitPreparedWorkflows, prepareStageWorkflows } from "./stage.ts";
export { unstagePluginWorkflows } from "./unstage.ts";
```

Signatures `[VERIFIED: bridges/workflows/stage.ts:126-128, 341-344, 448-450]`:

```ts
export async function prepareStageWorkflows(input: StageWorkflowsInput): Promise<PreparedWorkflowsStaging>
export async function commitPreparedWorkflows(prepared: PreparedWorkflowsStaging, opts?: CommitWorkflowsOptions): Promise<string | undefined>
export async function abortPreparedWorkflows(prepared: PreparedWorkflowsStaging): Promise<string | undefined>
```

`StageWorkflowsInput` `[VERIFIED: bridges/workflows/types.ts:89-96]` — verbatim:

```ts
export interface StageWorkflowsInput {
  readonly locations: ScopedLocations;
  readonly pluginName: string;
  /** NFR-7: the materializable arm only -- a raw resolved union has no pluginRoot. */
  readonly resolved: MaterializablePlugin;
  /** Names previously staged for this plugin -- read from state.json on re-stage. */
  readonly previousWorkflowNames?: readonly string[];
}
```

`CommitWorkflowsOptions.onPlaced` `[VERIFIED: bridges/workflows/types.ts:131-147]` — its contract
comment says verbatim it is "Called exactly ONCE per commit -- on the success path AND before the
throw on every failure path -- with the names whose envelope is sitting at its target path as a
result of this commit", and that "A caller that unlinks a name this commit did not place deletes
either a foreign file or a previous envelope the rollback just restored."

**That is the load-bearing sentence for criterion 1's undo.** The removal payload must be what
`onPlaced` reported, never `prep.result.stagedNames` and never a verdict derived from the thrown
error's class.

Recommended shape, written against the current file (the spike's version at
`git show features/workflows-spike:extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
lines 1203-1280 reads the same way and is reference for intent only):

```ts
  const workflowsPhase: Phase<InstallCtx> = {
    name: "workflows",
    do: async (c) => {
      // The envelopes a PREVIOUS run of this ledger wrote. `resources.workflows`
      // off the pre-existing record is the only list that names them -- they sit
      // outside every scope root, so nothing on disk can be enumerated to
      // rediscover them. A fresh install has no record and the bridge's re-stage
      // branch stays inert; the enable path (`allowExistingRecord`) reaches the
      // deliberately-KEPT disabled record, which is what lets the commit displace
      // the plugin's own envelopes aside instead of hitting the WR-06 refusal.
      const previousWorkflows =
        c.stateSnapshot.marketplaces[c.marketplace]?.plugins[c.plugin]?.resources.workflows;
      const prep = await prepareStageWorkflows({
        locations: c.locations,
        pluginName: c.plugin,
        resolved: c.resolved,
        // Conditional spread: the field is optional and
        // `exactOptionalPropertyTypes` rejects an explicit `undefined`.
        ...(previousWorkflows !== undefined && { previousWorkflowNames: previousWorkflows }),
      });
      // Assigned BEFORE the commit -- this is the point after which envelopes can
      // exist on disk, and it is the sentinel `undo` gates on.
      c.workflowsPrep = prep;
      c.stagedWorkflowNames = [];

      // WR-01 / WR-02: the removal payload is what the commit REPORTS placing.
      // Three distinct throws leave zero completed renames, and in each of them
      // the targets hold either foreign content or a previous envelope the
      // rollback just restored.
      const leak = await commitPreparedWorkflows(prep, {
        onPlaced: (placedNames) => {
          c.stagedWorkflowNames = placedNames;
        },
      });

      c.bridgeWarnings.push(...prep.result.warnings);
      if (leak !== undefined) {
        c.bridgeWarnings.push(leak);
      }
    },
    undo: async (c) => {
      if (c.workflowsPrep === undefined) {
        return;
      }

      const result = await unstagePluginWorkflows({
        locations: c.locations,
        previousWorkflowNames: c.stagedWorkflowNames,
      });

      if (result.failed.length > 0) {
        // WLIF-03: the bridge reports rather than throws, so an undo that
        // ignored `failed` would report a clean rollback while leaving executable
        // envelopes at their targets. Throwing is what makes the ledger record a
        // RollbackPartial the failure notification carries.
        const reasons = result.failed.map((f) => `${f.name}: ${f.reason}`).join("; ");
        throw new WorkflowsUnstageFailureError(
          `Failed to remove ${result.failed.length} workflow(s): ${reasons}`,
          result.failed,
        );
      }
    },
  };
```

**Two decisions in that body the plan must ratify explicitly, because precedent points both
ways.**

1. **`prep.result.warnings` rides `bridgeWarnings`, not `discoveryWarnings`.** The skills and
   commands phases push `prep.result.warnings` onto `discoveryWarnings`
   `[VERIFIED: install.ts:945, install.ts:988]` with the comment "The skills bridge puts its
   discovery warnings, and nothing else, on this array (D-141-03)". The agents phase pushes onto
   `bridgeWarnings` `[VERIFIED: install.ts:1034]` with the comment "The agents bridge aggregates
   THREE kinds on one array ... the three are not separable here, so the whole array rides the
   hygiene channel (D-19-01)". The workflows bridge's warnings array carries per-file soft-fails
   (unreadable script, skipped verdict, refused verdict) plus discovery warnings mixed — it is the
   agents shape, not the skills shape. `bridgeWarnings` is therefore the truthful channel.
   `[ASSUMED]` on which channel the reviewer will prefer; the evidence above is what makes it
   defensible either way.

2. **The undo throws on `failed[]` rather than swallowing it.** The other five phases discard
   their unstage result entirely (`await unstagePluginSkills({...})` with no assignment,
   `[VERIFIED: install.ts:959, 1000, 1057, 1141]`). But `cascadeUnstagePlugin` *does* check the
   analogous `failed[]` and throws `AgentsUnstageFailureError`
   `[VERIFIED: orchestrators/marketplace/shared.ts:335-350]`. The ledger has a designed channel
   for exactly this: a throwing undo becomes a `RollbackPartial{phase:"workflows", msg, cause}`
   `[VERIFIED: transaction/phase-ledger.ts:98-102]`, which the renderer emits as a
   `[workflows] (rollback failed)` child under the `(failed) {rollback partial}` parent
   `[VERIFIED: docs/output-catalog.md:56]` — verbatim: "`rollbackPartial` child rows on `failed`
   variants at 4-space indent (each phase: `[<phase>] (rollback failed)`)". Because a leftover
   workflow envelope is executable code outside every scope root, a silent swallow here is
   criterion 1's exact failure mode. **Throwing is the recommendation.** The phase-label token is
   free-form (the catalog's own examples use `phase3a`/`phase3b`), so **no `REASONS` closed-set
   amendment is needed** — which keeps Phase 114's notify work out of this phase.

`WorkflowsUnstageFailureError` should live beside its sibling in
`orchestrators/marketplace/shared.ts` (where `AgentsUnstageFailureError` is declared,
`[VERIFIED: orchestrators/marketplace/shared.ts:58-65]`), because the cascade needs it too and
the D-11 import gate explicitly sanctions that route (see §"Import boundaries" below).

## Research Question 2 — every removal path, checked individually

**Headline finding: three of the four verbs criterion 3 names funnel through ONE function.**

`cascadeUnstagePlugin` `[VERIFIED: orchestrators/marketplace/shared.ts:301-388]` is the single
removal primitive. Its five bridge calls, in order, are `unstagePluginSkills` (`:316`),
`unstagePluginCommands` (`:322`), `unstagePluginAgents` (`:328`) with an
`agentsResult.failed.length > 0` throw at `:335-350`, `removeHookConfig` (`:355`), and
`unstageMcpServers` (`:358`). The sixth slot goes **after `unstageMcpServers` and before the
`return Object.freeze({ ok: true, ... })` at `:365`**, so every existing ordering stays
byte-unchanged.

### The four production call sites

| # | Verb | Exact site | Are the five bridges removed there today? |
|---|------|-----------|-------------------------------------------|
| 1 | `uninstall` | `orchestrators/plugin/uninstall.ts:522` (`const cascade = opts.cascade ?? cascadeUnstagePlugin;`), invoked at `:634` | Yes — all five, via the primitive. **Inherits the sixth automatically.** |
| 2 | `disable` | `orchestrators/plugin/enable-disable.ts:357` (`const cascade = await cascadeUnstagePlugin(opts.plugin, opts.marketplace, locations, installed);`) | Yes — all five. **Inherits automatically.** |
| 3 | `marketplace remove --cascade` | `orchestrators/marketplace/remove.ts:665` (`const cascade = opts.cascade ?? cascadeUnstagePlugin;`), invoked in the per-plugin loop at `:311` | Yes — all five. **Inherits automatically.** |
| 4 | install's materialize-then-disable | `orchestrators/plugin/install.ts:1384` inside `disableFreshlyInstalledPlugin` (DFEN-04 / D-102-01) | Yes — all five. **Inherits automatically.** Not named by any criterion, but it is a fourth caller and its tests will move. |

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1341-1348]` — the
DFEN-04 comment states verbatim that it "composes exactly the primitives the `disable` verb
composes -- `cascadeUnstagePlugin`, then `applyPartialCascadeFold` on a partial cascade, then
`toDisabledRecord` -- so the terminal state is byte-identical to an `install` followed by a
`disable` by construction rather than by careful re-implementation." That byte-identity claim
holds automatically once the primitive gains the sixth bridge.

### What is NOT inherited — the partial-cascade folds

Two independent implementations subtract `dropped.*` from the record so state.json never claims
artifacts already gone from disk (TR-03 / NFR-3):

- `applyPartialCascadeFold` `[VERIFIED: orchestrators/plugin/shared.ts:1188-1222]` — five axes,
  used by `uninstall` (via `foldPartialCascadeFailure`, `uninstall.ts:318-332`), by `disable`
  (`enable-disable.ts:365`), and by install's DFEN-04 path (`install.ts:1435`).
- A hand-rolled duplicate `[VERIFIED: orchestrators/marketplace/remove.ts:325-335]` — **four**
  axes; it does not fold `dropped.hooks` at all. Pre-existing divergence, out of scope to fix,
  but the workflows axis must be added to it too or `marketplace remove --cascade` will persist
  a record naming envelopes it already deleted.

**Measured: neither of these is compile-forced.** Adding `readonly workflows: readonly string[];`
to `UnstageOutcome.dropped` produced **12 TypeScript errors across 4 files — 2 production (both
inside `marketplace/shared.ts`'s own two `return` sites) and 10 test**. Neither fold site
appeared. `[VERIFIED: measured 2026-09-05 in a throwaway git worktree at HEAD c514ba7f,
`npx tsc --noEmit`]`. The reason is structural typing: both folds take `dropped` as a parameter
whose declared shape is a five-axis (or four-axis) literal, and a wider argument satisfies it.

### `reinstall` — criterion 4, a different shape entirely

`reinstall.ts` carries **no ledger**. It has a hand-rolled prepare/replace/rollback trio:

- `PreparedHandles` `[VERIFIED: orchestrators/plugin/reinstall.ts:263-268]` — verbatim:
  ```ts
  interface PreparedHandles {
    readonly skills: PreparedSkillsStaging;
    readonly commands: PreparedCommandsStaging;
    readonly agents: PreparedAgentsStaging;
    readonly mcp: PreparedMcpStaging;
  }
  ```
  and its partial twin `PartialPreparedHandles` at `:270-275`.
- `ReplacementEntry` `[VERIFIED: reinstall.ts:277-281]` — verbatim:
  ```ts
  type ReplacementEntry =
    | { readonly phase: "skills"; readonly handle: SkillsReplacement }
    | { readonly phase: "commands"; readonly handle: CommandsReplacement }
    | { readonly phase: "agents"; readonly handle: AgentsReplacement }
    | { readonly phase: "mcp"; readonly handle: McpReplacement };
  ```
- `prepareAllHandles` `[VERIFIED: reinstall.ts:1190-1252]` — four prepares inside one `try`,
  with `throw errorWithManualRecovery(err, await abortPartialHandles(handles));` on failure.
  Note the skills and commands prepares pass `previousSkillNames: input.oldRecord.resources.skills`
  (`:1210`) and `previousCommandNames: input.oldRecord.resources.prompts` (`:1221`) — the exact
  slot `previousWorkflowNames: input.oldRecord.resources.workflows` occupies.
- `replaceAll` `[VERIFIED: reinstall.ts:1259-1310]` — `replacePreparedSkills`,
  `replacePreparedCommands`, `replacePreparedAgents(..., { force: true })`, `commitHooks`,
  `replacePreparedMcp`, each pushed onto `replacements[]` except hooks.
- `resourcesFromHandles` `[VERIFIED: reinstall.ts:1412-1434]` composes the record's `resources`
  from the handles — this is where criterion 4's "records the names it actually wrote" lands.

**The workflows bridge has no `replacePrepared*` primitive — and does not need one.**
`prepareStageWorkflows` + `commitPreparedWorkflows` *is* the replace shape: the commit displaces
previous targets into `<stagingRoot>/.previous`, renames the new ones in, and restores on
failure `[VERIFIED: bridges/workflows/stage.ts:359-372, 206-236]`. So the reinstall slot is:

- `PreparedHandles`/`PartialPreparedHandles` gain `workflows: PreparedWorkflowsStaging`.
- `prepareAllHandles` gains a fifth prepare passing `previousWorkflowNames`.
- `replaceAll` gains a `commitPreparedWorkflows(handles.workflows, { onPlaced })` call.
- `resourcesFromHandles` gains `workflows: <the placed names>`.

**The `ReplacementEntry` union deliberately gains NO `workflows` arm.** The spike's own comment
says so `[CITED: git show features/workflows-spike:.../reinstall.ts:265-271]` — verbatim: "WLIF-04:
there is deliberately NO `workflows` arm here. A replacement entry ... `commitPreparedWorkflows`
cleans up its own staging on success". The consequence is that a LATER-step failure (an mcp
replace throwing after workflows committed) cannot be rolled back through `rollbackReplacements`.
The spike handled this with a separate `placedWorkflowNames` value threaded out of `replaceAll`
and an `unplaceWorkflows(locations, placedWorkflowNames)` helper called from the catch at
`reinstall.ts:1371-1376` of the spike. **The current `replaceAll` returns
`{ replacements, hookEntries }` `[VERIFIED: reinstall.ts:1262-1265]` — a third member and a
matching catch-site consumer is the shape this phase must add.** This is the single most
intricate piece of criterion 4 and the most likely place for a Phase-111-class rollback defect.

`resourcesFromHandles` also has a second caller, `successOutcome` (`reinstall.ts:1443-1447`),
which omits the `plugin`/`installable` arguments so `hooks` stays empty there. The workflows
member must follow the same discipline — the placed names, not the prepared names.

### `update` and `enable`

- `update.ts` deliberately bypasses `runPhases` `[VERIFIED: ARCHITECTURE.md, and
  `orchestrators/plugin/update.ts:1427-1433` documents the mirrored closed set]`. **Phase 113.**
  This phase touches it only for the closed-set widening (§criterion 2).
- `enable` reaches materialization through `runInstallLedger` `[VERIFIED: install.ts:802-813,
  enable-disable.ts:250-260 region]`, so it **inherits the sixth ledger phase automatically**,
  including the `previousWorkflowNames` read off the deliberately-kept disabled record via
  `allowExistingRecord`. That is a Phase-113 requirement (WLIF-05) that lands here for free; the
  planner should note it rather than let Phase 113 rediscover it.

## Research Question 3 — the `PathContainmentError` contract, confirmed

**Verdict: Phase 111's prediction is correct in every particular. A raised
`PathContainmentError` from a phase `undo` propagates as a throw; `runPhases` does NOT catch it
into a `RollbackPartial`.**

### The bridge side, as it stands at HEAD

`[VERIFIED: extensions/pi-claude-marketplace/bridges/workflows/unstage.ts:54-93]` — verbatim:

```ts
    } catch (err) {
      if (err instanceof PathContainmentError) {
        // PI-14: a containment refusal is NOT an ordinary per-name failure and
        // never becomes a soft row. ...
        refusal ??= err;
        continue;
      }

      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        failed.push({ name, reason: errorMessage(err) });
        continue;
      }
      // ENOENT: ... Idempotent -- skip without adding to `removed`.
    }
  }

  if (refusal !== undefined) {
    // Raised bare. ...
    throw refusal;
  }
```

The iteration-2 fix report records the reasoning `[CITED:
.planning/workstreams/workflows/phases/111-workflows-bridge/111-REVIEW-FIX.md, §WR-10]` — the
review *proposed* a `kind: "containment" | "io"` discriminant and the fixer rejected it because
"both ledger sites (`phase-ledger.ts:89,125`) bypass on `instanceof` applied to a **thrown**
error, so a tagged row still returns a clean undo and Phase 112 would have to invent a translation
from `failed[].kind` back into a throw for the bypass to fire."

`UnstageWorkflowsResult.failed`'s own doc `[VERIFIED: bridges/workflows/types.ts:172-182]`
states verbatim: "Neither does a containment refusal: PI-14 raises that class to the caller
instead of softening it into a row, so a result exists at all only when every recorded name was
composed inside the saved directory."

### The ledger side

`[VERIFIED: transaction/phase-ledger.ts:86-103]` — `rollbackExecuted`, verbatim:

```ts
    try {
      await done.undo(ctx);
    } catch (undoErr) {
      if (undoErr instanceof PathContainmentError) {
        throw undoErr;
      }
      ...
      partials.push({
        phase: done.name,
        msg: errorMessage(undoErr),
        ...(undoErr instanceof Error && { cause: undoErr }),
      });
    }
```

`[VERIFIED: transaction/phase-ledger.ts:121-134]` — `invokeFailingPhaseUndo` repeats it verbatim
at `:125-127`.

`[VERIFIED: transaction/phase-ledger.ts:149-151]` — the `runPhases` doc comment, verbatim:

> Exception: PI-14 PathContainmentError thrown from an undo step is
> re-thrown immediately (state corruption is loud). The caller observes
> a thrown PathContainmentError instead of a `{ok: false, ...}` result.

### The consequence nobody has written down

Because the error is **thrown out of `runPhases`** rather than returned, control never reaches
`install.ts:1253-1271`. That block is the *only* place `capture.rollbackPartials` and
`capture.version` are assigned `[VERIFIED: install.ts:1263-1266]`:

```ts
    if (capture !== undefined) {
      capture.rollbackPartials = result.rollbackPartials;
      capture.version = ctxLocal.version;
    }
```

So on the containment path both stay at their initial `{ rollbackPartials: [], version: undefined }`
`[VERIFIED: install.ts:1941]`. `handleInstallThrow` then reads
`const isPathContainment = err instanceof PathContainmentError;`
`[VERIFIED: install.ts:1858]`, sets `rolledBackPartial` false and `entityErrorRow` undefined,
and composes the bare failure row with `version: capture.version` — i.e. **undefined**.

That is the **documented and intended** PI-14 behavior, not a defect. `[VERIFIED:
install.ts:1907-1911]` — verbatim: "PathContainmentError originating in a bridge prepare or undo
path propagates VERBATIM: its message becomes `cause` on the `PluginFailedMessage` and never
surfaces as a rollback-partial (PI-14 bypass)." The row simply carries no version. A plan should
*not* try to "fix" this; it should have a test that pins it, and `tests/orchestrators/plugin/install.test.ts:2826`
(`"PI-14: PathContainmentError from a bridge prepare propagates verbatim with NO '(rollback partial:' marker"`)
is the model to mirror for the *undo* direction.

### The second consequence: `failed[]` rows are lost on the containment path

`unstagePluginWorkflows` raises the **first** refusal only after the loop completes, so ordinary
`failed[]` rows collected before it are discarded. The fix report states this trade explicitly
`[CITED: 111-REVIEW-FIX.md §WR-10]` — "The `failed[]` rows collected before a refusal are
therefore lost on that path; that is the correct trade, because the alternative loses the bypass."
The `workflowsPhase.undo` cannot recover them: the call throws, so nothing after it runs. **A plan
that writes `const result = await unstagePluginWorkflows(...)` and then inspects `result.failed`
is correct; a plan that expects to see both a containment throw and a `failed[]` report from one
call is not.**

### Existing model tests

`[VERIFIED: tests/transaction/phase-ledger.test.ts:437-463]` — `"rethrows a failing phase
own-undo containment error by identity"`, asserting `assert.strictEqual(thrown, containmentError)`
plus the exact operations trace. `[VERIFIED: tests/transaction/phase-ledger.test.ts:465]` —
`"rethrows a completed phase undo containment error before older compensation"`. Both are
identity assertions, which is the right strength.

**`tests/transaction/phase-ledger.test.ts:12` pins the fixture phase universe**
`[VERIFIED, verbatim]`:

```ts
const PRODUCTION_PHASE_NAMES = ["skills", "commands", "agents", "hooks", "mcp", "state"] as const;
```

It is a test-local constant, not a gate — nothing fails if it is not widened. **Widen it anyway**,
or the ledger's own suite silently stops mirroring production at six phases while production runs
seven.

## Research Question 4 — criterion 6, and whether the `clone-gc.ts` precedent transfers

### What `clone-gc.ts` actually is

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts:75-110]`. The
signature is verbatim:

```ts
export async function garbageCollectPluginClones(locations: ScopedLocations): Promise<string[]> {
```

and the final statement is verbatim `return leaks;` at `:109`. The doc comment at `:56-59` says,
verbatim: "delete every unreferenced `plugin-clones/<key>/` directory, **returning per-dir
rm-failure leak strings** (callers ignore them -- hygienic cleanup never becomes the primary path,
D-19-01)."

**Correction to the CONTEXT.** The CONTEXT instructs the plan to "Mirror its structure, its return
contract (the names it removed), and its call-site placement." Its return contract is **not** the
names it removed — it is the list of directories it *failed* to remove. Every production call site
discards the value entirely: `await garbageCollectPluginClones(locations);`
`[VERIFIED: uninstall.ts:435, marketplace/remove.ts:625, update.ts:1752, update.ts:2362]`.

The mirror to build is therefore `Promise<string[]>` of **leak strings**, not removed names.
Adopting "the names it removed" would be inventing a contract while claiming to follow a
precedent — the exact thing the CONTEXT warns against.

### The liveness signal does NOT transfer

`deriveLiveCloneKeys` `[VERIFIED: clone-gc.ts:38-54]` builds the live set from persisted state:

```ts
      if (record.resolvedSha === undefined) {
        continue;
      }
      const seg = path.relative(pluginClonesDir, record.resolvedSource).split(path.sep)[0];
```

There is **no equivalent for `<workflowsStagingDir>/<uuid>/`**:

- The staging root is `path.join(locations.workflowsStagingDir, randomUUID())`
  `[VERIFIED: bridges/workflows/stage.ts:155]`. Nothing persists that UUID.
- `PreparedWorkflowsStaged.stagingRoot` `[VERIFIED: bridges/workflows/types.ts:117-118]` is an
  in-memory field of a value that lives only for the duration of one ledger run.
- `workflowsStagingDir` is `path.join(workflowsHomeDir, ".pi-claude-marketplace-staging")`
  `[VERIFIED: persistence/locations.ts:248]`, and `workflowsHomeDir` is
  `path.join(os.homedir(), ".pi", "workflows")` `[VERIFIED: platform/workflow-home.ts:30-32]`.
  It is **scope-independent** — user scope and project scope share it — so the per-scope
  `proper-lockfile` state guard does not serialize access to it. Two Pi processes operating on
  different scopes can hold staging roots there simultaneously.

That is why the age bound is not a nicety: it is the *whole* liveness mechanism.

### What DOES transfer

| Property of `clone-gc.ts` | Transfers? | Evidence |
|---------------------------|-----------|----------|
| `(locations) => Promise<string[]>` leak-string signature | Yes | `clone-gc.ts:75, 109` |
| fs-only import discipline (no git, importable by NFR-5-gated orchestrators) | Yes | `clone-gc.ts:11-17` header, verbatim: "This helper is fs-only: it imports loadState + the locations chokepoint + node:fs/promises rm/readdir ONLY." The workflows sweeper needs no `loadState` at all. |
| `readdir` with ENOENT → `return []`, any other errno rethrows | Yes | `clone-gc.ts:80-89` |
| Containment chokepoint resolved BEFORE the `rm` | Yes | `clone-gc.ts:97-99`, verbatim: "SC-7 / NFR-10: every delete target routes through the chokepoint (assertSafeName + assertPathInside) BEFORE the rm." |
| per-entry `try`/`catch` pushing `` `${key}: ${errorMessage(err)}` `` and never throwing | Yes | `clone-gc.ts:100-106` |
| Call site: after the state mutation commits, inside a `try {} catch {}` that swallows (D-19-01) | Partly — see below | `uninstall.ts:433-437` |
| `deriveLive*` from persisted records | **No** | §above |

### The gap and the nearest alternative

**Recommendation: an `mtime`-based age bound, measured on the `<uuid>` directory itself.**

Rationale, from measurement of the write pattern:

- `prepareStageWorkflows` `mkdir`s the root then writes one file per admitted workflow into it
  `[VERIFIED: bridges/workflows/stage.ts:167, 186]` — each child write bumps the directory mtime.
- `displacePreviousTargets` `mkdir`s `.previous` inside it `[VERIFIED: stage.ts:244-245]` — bump.
- The commit renames children *out* of it `[VERIFIED: stage.ts:369-371]` — bump.

So directory `mtime` tracks last transaction activity, and a stalled or crashed transaction stops
touching it. A live transaction's root is by construction younger than the time it takes to write
its envelopes.

**There is no existing age or TTL constant anywhere in `extensions/`** — verified by grepping for
`mtime|Date.now()|STALE|maxAge|ageMs` across the tree; the only `mtime` uses are the manifest cache
keyed on `(mtimeMs, size)` and the RECON-05 config write-back stability notes. So the threshold is
a new number and the plan must state and justify it. `[ASSUMED]` — a conservative **24 hours**
matches the "invisible hygiene, next idempotent pass cleans up" posture of `clone-gc.ts` and is
orders of magnitude beyond any plausible prepare→commit window; anything from 1 hour upward is
defensible. This is the one value in the phase worth putting in front of the operator.

The nearest existing hint at a staleness design is in `update.ts`'s own header
`[VERIFIED: orchestrators/plugin/update.ts:1421-1426]` — verbatim: "A static string keeps the
cross-process contract simple to grep + assert; **a future GC sweeper can use `sRecord.updatedAt`
(already in the schema) for staleness.**" That is the same instinct (a timestamp, not a refcount)
reached independently for a different orphan class, which supports the choice.

### Where to call it

`clone-gc.ts` is called from the *removal* verbs (uninstall, marketplace remove, update ×2). A
staging orphan is created by *install/enable/reinstall/update*, so a machine that never uninstalls
would never sweep. Two placements, both D-19-01-swallowed:

1. **`collectPostCommitWarnings` in `install.ts`** `[VERIFIED: install.ts:1535-1599]` — the
   existing post-state-commit hygiene block already holds the eager `pluginDataDir` mkdir
   (`:1554-1561`) and the completion-cache drop (`:1567-1573`), each in a `try`/`catch` that
   `push`es a deferred-hygiene warning. This is the natural home: the *next* install sweeps the
   *previous* crash's orphan, which is exactly `clone-gc.ts`'s "a crash between state write and
   clone delete just leaves an orphan that the next idempotent pass removes (NFR-3 fail-clean)"
   `[VERIFIED: clone-gc.ts:9-10]`.
2. **`runPostUninstallCleanup` in `uninstall.ts`** `[VERIFIED: uninstall.ts:409-438]`, beside the
   existing `garbageCollectPluginClones` call at `:435`, for exact call-site parity.

Doing both is cheap and covers both directions. **A single new module,
`orchestrators/plugin/workflows-staging-gc.ts`, with a mirrored owner test
`tests/orchestrators/plugin/workflows-staging-gc.test.ts` in the same commit** — measured: without
the test, `node scripts/check-corresponding-tests.mjs` reports
`missing-test: tests/orchestrators/plugin/workflows-staging-gc.test.ts` and
`Corresponding-test gate failed with 1 violation(s).`
`[VERIFIED: measured 2026-09-05 in a throwaway worktree at HEAD c514ba7f]`.

### The containment chokepoint — do NOT copy `sourcesStagingDir`

`clone-gc.ts` routes every delete through `locations.pluginCloneDir(key)`. The workflows analogue
must exist. There are two candidate patterns in `locations.ts` and they differ in a way WR-12
already proved matters:

`[VERIFIED: persistence/locations.ts:344-350]` — `sourcesStagingDir`, verbatim:

```ts
    async sourcesStagingDir(uuid: string): Promise<string> {
      const sourcesStagingRoot = path.join(extensionRoot, "sources-staging");
      const candidate = path.join(sourcesStagingRoot, uuid);
      await assertPathInside(sourcesStagingRoot, candidate, `sourcesStagingDir(${uuid})`);
      return candidate;
    },
```

It anchors **at** the staging root, so the `sources-staging` segment itself is never `lstat`'d.
That is the exact shape Phase 111's WR-12 flagged as a symlink escape for the `.previous`
directory, and the shape `prepareStageWorkflows` deliberately rejects
`[VERIFIED: bridges/workflows/stage.ts:157-166]` — verbatim: "the boundary is the engine's storage
ROOT, not the staging directory. `assertPathInside` trusts its own boundary and starts the symlink
walk at it, so anchoring on `workflowsStagingDir` would skip an lstat of the one segment an
attacker could have replaced with a symlink, leaving a check that cannot fail. Anchoring one level
up lstats the staging directory itself."

**Therefore: anchor on `locations.workflowsHomeDir`, not on `workflowsStagingDir`.** Whether that
lives as a new `locations.workflowsStagingRoot(uuid)` accessor (compile-forced at the single
construction site, and reusable by `prepareStageWorkflows` so there is one composer) or as an
inline `assertPathInside(locations.workflowsHomeDir, candidate, "workflows staging root")` in the
sweeper is a plan-level choice. The accessor is cleaner and matches the `pluginCloneDir` precedent;
it costs one edit to `persistence/locations.ts` and its owner test, both Phase-111 files.

`assertSafeName` is **not** needed on the entry name: `readdir` never returns a name containing a
path separator, and the names are UUIDs by construction. `sourcesStagingDir` omits it for the same
reason.

## Research Question 5 — the fallow allow-list edge

`[VERIFIED: .fallowrc.json:82-96]` — the `orchestrators` rule, verbatim:

```json
      {
        "from": "orchestrators",
        "allow": [
          "bridges-agents",
          "bridges-commands",
          "bridges-mcp",
          "bridges-skills",
          "bridges-hooks",
          "domain",
          "transaction",
          "persistence",
          "platform",
          "shared"
        ]
      },
```

`"bridges-workflows"` is absent. The zone itself exists `[VERIFIED: .fallowrc.json:48-51]` and its
own outbound rule exists `[VERIFIED: .fallowrc.json:117-120]`.

**Measured, 2026-09-05, throwaway worktree at HEAD c514ba7f.** Adding
`import { unstagePluginWorkflows } from "../../bridges/workflows/index.ts";` plus a call inside
`cascadeUnstagePlugin`, then running `npx fallow dead-code --fail-on-issues --format human`:

```text
── Structure ─────────────────────────────────────

● Boundary violations (1)
  extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:35 → extensions/pi-claude-marketplace/bridges/workflows/index.ts (orchestrators → bridges-workflows)
  Imports that cross defined architecture zone boundaries — https://docs.fallow.tools/explanations/dead-code#boundary-violations

✗ 1 violation (0.63s)
```

True exit codes, measured separately (not through a pipe): `fallow dead-code exit=1`,
`npm run fallow exit=1`. After adding the single string `"bridges-workflows"` to the
`orchestrators` allow array: `after allow-list edit, dead-code exit=0`.

**Confirmed:** it fails loudly, at the `fallow dead-code` sub-gate, naming the exact file, line
and edge. It is the same class Phase 111 measured for an omitted zone. The one-string
`.fallowrc.json` edit **must ride in the same commit as the first orchestrator import**, or that
commit is red at `npm run check` step 3 of 9.

## Research Question 6 — test strategy for the undo path

### How the five existing undo paths are tested

`[VERIFIED: tests/orchestrators/plugin/install.test.ts]` — the three dedicated cases:

| Test | Line | Sabotage | Assertion |
|------|------|----------|-----------|
| `"Rollback-skills-undo: skills committed then commands phase fails -> skill target removed"` | 3335 | `writeFile(locations.commandsStagingDir, "not-a-dir")` → ENOTDIR on the commands phase's `mkdir` | `stat` on `<skillsTargetDir>/hello-tool` must throw; `assert.equal(exists, false, "skills undo must remove the committed skill dir")`; plus no state record |
| `"Rollback-commands-undo: commands committed then agents phase fails -> command target removed"` | 3393 | same pattern one slot later | same shape |
| `"Rollback-agents-undo: agents committed then mcp phase fails -> agent target removed"` | 3449 | same pattern one slot later | same shape |

Plus two whole-ledger unwinds driven from the state phase:
`"runInstallLedger unwinds the completed phases when a plugin appears at state commit"` (`:7385`)
and `"runInstallLedger unwinds when its marketplace disappears before state commit"` (`:7445`);
a hooks-specific one, `"PI-15: an mcp phase that cannot run unwinds the hooks bridge and leaves no
record"` (`:6602`); and the two retry proofs at `:8581` and `:9040`.

**These are the right model: they assert on disk state after the failure, not on the rejection.**

### What this phase's tests must assert

The workflows phase is the LAST bridge slot, so the "a later phase fails" vehicle is
**`statePhase`**, not another bridge. Two mechanisms, both already in the suite:

1. Seed an existing record for `(marketplace, plugin)` so `statePhase` throws
   `ConcurrentInstallError` `[VERIFIED: install.ts:1167-1169]` — the `:7385` test's vehicle.
2. Delete the marketplace from the state snapshot mid-flight so `statePhase` throws
   `Marketplace "<mp>" disappeared from state during install of "<plugin>".`
   `[VERIFIED: install.ts:1171-1178]` — the `:7445` test's vehicle.

Non-vacuous assertions, in order of importance:

- **`<workflowsSavedDir>/<plugin>:<name>.json` does not exist after the failed install.** This is
  criterion 1 stated as a filesystem fact. Do not settle for "the promise rejected".
- **The staging root is gone.** `abortPreparedWorkflows`/`commitPreparedWorkflows` clean it; a
  leftover `<workflowsStagingDir>/*` is the WR-08 orphan and criterion 6's own hazard.
- **A pre-existing user-owned envelope at a colliding name is untouched.** This is the CR-02 /
  WR-11 class of bug the Phase 111 review found twice, transposed into the ledger: the undo must
  unlink only names `onPlaced` reported.
- **On the `failed[]` path, the notification carries a `[workflows] (rollback failed)` child.**
  Not merely that install failed. Sabotage: make one recorded envelope path unlinkable (e.g. make
  `workflowsSavedDir` read-only, or replace the envelope with a directory so `unlink` gives
  EISDIR/EPERM).
- **On the containment path, the notification carries NO `rollback partial` marker and the
  `PathContainmentError` text reaches the cause trailer.** Model:
  `tests/orchestrators/plugin/install.test.ts:2826`.

**The existing test that comes closest — and should be the template — is
`tests/orchestrators/plugin/install.test.ts:3335`,
`"Rollback-skills-undo: skills committed then commands phase fails -> skill target removed"`.**
It is the only case in the repository that plants a specific mid-ledger failure and then asserts
the *earlier* phase's artifact is gone from disk. Its `withHermeticHome` wrapper
(`install.test.ts:306-321`) sets `process.env.HOME`, which is what `os.homedir()` in
`platform/workflow-home.ts:31` reads, so `locations.workflowsSavedDir` computed inside the closure
points into the temp home. **`locationsFor(...)` must be called inside `withHermeticHome`**, as
the model test does at `:3341`.

### Fixture discipline — the trap Phase 111 fell into

`[VERIFIED: .planning/workstreams/workflows/STATE.md]` — verbatim: "The fixture body changed from
a default export (which the admission rule classifies `skipped`/`no-meta`, so no envelope was ever
written) to a named `meta` export."

`[VERIFIED: extensions/pi-claude-marketplace/domain/workflow-script.ts:35-83]` — the verdict union,
verbatim member names: `"named"`, `"stem-fallback"`, `"skipped"`, `"refused"`, with
`SkippedCause = "no-meta" | "meta-not-object-literal" | "meta-spread" | "meta-computed-key"` and
`RefusedCause = "unparseable" | "determinism-code" | "determinism-comment" | "determinism-string" | "determinism-split" | "unsafe-name"`.
Only `"named"` and `"stem-fallback"` carry a `generatedName` and therefore stage.

**The canonical working fixture, verbatim from
`[VERIFIED: tests/integration/workflow-kind-inversion.test.ts:230-234]`:**

```ts
      assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
        name: "hello:greet",
        description: "greets",
        script: 'export const meta = { name: "greet", description: "greets" };\n',
      });
```

with `const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");`
`[VERIFIED: same file:228]`.

A fixture body that is a default export, or that contains `Date.now()` / `Math.random()`
(determinism refusal), produces **zero** envelopes and a test that passes for the wrong reason.
Every new workflows test must include a positive precondition asserting the envelope exists before
the sabotage, and a negative control (restore the bad body, watch the case go red) should be run
during authoring, as Phase 111 did.

### Seeding helpers must gain a workflows arm

`[VERIFIED: tests/orchestrators/plugin/install.test.ts:338-346]` — `writePluginComponents`'s
options, verbatim:

```ts
  opts: {
    skills?: { sourceName: string; frontmatterName?: string; body?: string }[];
    commands?: { sourceName: string; body?: string }[];
    agents?: { sourceName: string; frontmatterName?: string; tools?: string; body?: string }[];
    mcpServers?: Record<string, unknown>;
    hooksJson?: object;
  },
```

It has no `workflows` arm; `seedPathMarketplaceWithPlugin` (`:527`) passes through to it. Because
`tests/helpers/` was deleted by PR #167, **each test file owns its own seeder** and each must be
extended independently:

- `tests/orchestrators/plugin/install.test.ts` — `writePluginComponents:338`, `seedPathMarketplaceWithPlugin:527`
- `tests/orchestrators/plugin/uninstall.test.ts` — `seedFullPlugin:159`, `seedGitPlugin:2207`
- `tests/orchestrators/plugin/reinstall.test.ts` — `seedMarketplace:117`, `seedInstalledGitSourcePlugin:2891`, `seedDisabledInstall:4155`
- `tests/orchestrators/plugin/enable-disable.test.ts` — `seedRealDisabledMarketplace:241`
- `tests/orchestrators/marketplace/shared.test.ts` — `seedFullCascade:306`
- `tests/orchestrators/marketplace/remove.test.ts` — `seedMarketplace:139`

## Research Question 7 — coverage and gate mechanics

### The gate chain, verbatim and unchanged

`[VERIFIED: package.json:77]`:

```text
"check": "npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm test && npm run test:integration"
```

`[VERIFIED: package.json:78]`:

```text
"fallow": "fallow dead-code --fail-on-issues --format human && fallow health --fail-on-issues --format human && fallow dupes --fail-on-issues --format human"
```

**Confirmed: `test:corresponding` runs before `npm test`, and `fallow` runs before both.** The
CONTEXT's claim holds, with the refinement that `typecheck` and `lint` come before `fallow`, so a
compile error masks a boundary violation.

### Direct-coverage baseline — measured, all pairs at 100%

Measured 2026-09-05 in a throwaway worktree at HEAD `c514ba7f`, one
`node scripts/test-coverage-direct.mjs <path>` run per file:

| File this phase touches | Branches | Functions | Lines | Verdict |
|---|---|---|---|---|
| `orchestrators/plugin/install.ts` | 238/238 | 51/51 | 2460/2460 | passed |
| `orchestrators/marketplace/shared.ts` | 97/97 | 16/16 | 760/760 | passed |
| `orchestrators/plugin/uninstall.ts` | 79/79 | 11/11 | 773/773 | passed |
| `orchestrators/plugin/reinstall.ts` | 234/234 | 46/46 | 1613/1613 | passed |
| `orchestrators/plugin/enable-disable.ts` | 140/140 | 24/24 | 1349/1349 | passed |
| `orchestrators/plugin/shared.ts` | 165/165 | 41/41 | 1425/1425 | passed |
| `orchestrators/marketplace/remove.ts` | 95/95 | 21/21 | 794/794 | passed |
| `orchestrators/plugin/update.ts` | 384/384 | 81/81 | 3156/3156 | passed |
| `persistence/state-io.ts` | 56/56 | 9/9 | 495/495 | passed |
| `orchestrators/plugin/clone-gc.ts` | 20/20 | 2/2 | 110/110 | passed |

**`install.ts` is NOT on the accepted-shortfall list.** `[VERIFIED: .planning/ROADMAP.md:40-48]`
names all seven D-116-01a claimants verbatim: `edge/args.ts`, `edge/completions/data.ts`,
`edge/completions/provider.ts`, `edge/handlers/marketplace/update.ts`,
`edge/handlers/plugin/import.ts`, `edge/handlers/plugin/pending.ts`, `edge/handlers/shared.ts` —
every one under `edge/`. So **100% is reachable and required** for every file this phase touches,
and every new branch must be exercised by that file's own owner test, not by an integration test.

Branch-count implications:

- `workflowsPhase.do` adds the `previousWorkflows !== undefined` conditional spread and the
  `leak !== undefined` guard → both arms of each must be hit.
- `workflowsPhase.undo` adds the `workflowsPrep === undefined` gate and the
  `result.failed.length > 0` gate → both arms of each.
- The sweeper adds the ENOENT arm, the age-bound arm (young → skip, old → remove) and the per-entry
  rm-failure arm.
- `applyPartialCascadeFold` and the `remove.ts` filter add **statements, not branches** — they
  stay at 100% for free provided the enclosing function is already exercised (it is).
- `PHASE3_FAILURE_PHASES` is a tuple literal — no branch.

### Which files need new owner tests vs. extension

| File | Owner test | New or extend |
|---|---|---|
| `orchestrators/plugin/install.ts` | `tests/orchestrators/plugin/install.test.ts` | extend |
| `orchestrators/marketplace/shared.ts` | `tests/orchestrators/marketplace/shared.test.ts` | extend |
| `orchestrators/plugin/uninstall.ts` | `tests/orchestrators/plugin/uninstall.test.ts` | extend |
| `orchestrators/plugin/reinstall.ts` | `tests/orchestrators/plugin/reinstall.test.ts` | extend |
| `orchestrators/plugin/shared.ts` | `tests/orchestrators/plugin/shared.test.ts` | extend |
| `orchestrators/marketplace/remove.ts` | `tests/orchestrators/marketplace/remove.test.ts` | extend |
| `orchestrators/plugin/update.ts` | `tests/orchestrators/plugin/update.test.ts` | extend (tuple only) |
| `orchestrators/types.ts` | `tests/orchestrators/types.test.ts` | extend — **compile-forced**, see below |
| `shared/errors.ts` | `tests/shared/errors.test.ts` | extend |
| `persistence/state-io.ts` | `tests/persistence/state-io.test.ts` | extend |
| `persistence/migrate.ts` | `tests/persistence/migrate.test.ts` | extend |
| `persistence/locations.ts` | `tests/persistence/locations.test.ts` | extend (only if the staging accessor lands) |
| `transaction/phase-ledger.ts` | `tests/transaction/phase-ledger.test.ts` | extend (widen `PRODUCTION_PHASE_NAMES`) |
| **`orchestrators/plugin/workflows-staging-gc.ts`** | **`tests/orchestrators/plugin/workflows-staging-gc.test.ts`** | **NEW — same commit or `test:corresponding` fails** |

## Common Pitfalls

### Pitfall: `resources.workflows` is the hidden prerequisite for criteria 3 and 4

**What goes wrong:** a plan sequences the ledger phase first, then discovers the cascade has
nothing to read.
**Why it happens:** none of the seven criteria mentions the state schema.
**Evidence:** `[VERIFIED: persistence/state-io.ts:116-122]` — the `resources` object, verbatim:

```ts
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
    hooks: Type.Array(Type.String()),
  }),
```

**Measured blast radius** of adding `workflows: Type.Array(Type.String()),` as a REQUIRED member,
2026-09-05, throwaway worktree at HEAD `c514ba7f`, `npx tsc --noEmit`: **68 errors across 30
files**. The three production errors, verbatim:

```text
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts(1206,9): error TS2741: Property 'workflows' is missing ...
extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts(1418,3): error TS2741: Property 'workflows' is missing ...
extensions/pi-claude-marketplace/persistence/state-io.ts(168,5): error TS2741: Property 'workflows' is missing ...
```

Top test files by error count: `tests/persistence/state-io.test.ts` (11),
`tests/orchestrators/reconcile/backfill.test.ts` (7), `tests/bridges/hooks/event-router.test.ts`
(5), `tests/persistence/migrate-config.test.ts` (4), `tests/orchestrators/plugin/update.test.ts`
(4), `tests/orchestrators/plugin/list.test.ts` (4).

**How to avoid:** make it the first production commit of the phase, REQUIRED not optional (the
spike made it required too, `[CITED: git show features/workflows-spike:.../state-io.ts:132]` —
`workflows: Type.Array(Type.String()),`), and land the three sibling edits with it:
`clonePluginRecord` `[VERIFIED: state-io.ts:167-174]` (enumerates rather than spreads *precisely
so* an omission is a compile error — its own doc says so at `:138-141`), and the migration
default-fill `[VERIFIED: persistence/migrate.ts:137]` — verbatim:

```ts
  for (const field of ["agents", "mcpServers", "hooks"] as const) {
```

which must become a four-member list, with the doc at `:119-124` updated (it names the three
fields verbatim).

**Not affected:** the `COMPAT-01` key-set gate pins the record's **top-level** keys only
`[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:391-415]` — its `expected` array
lists `compatibility, enabled, hookEntries, installedAt, resolvedSha, resolvedSource, resources,
updatedAt, version` and reads `Object.keys(PLUGIN_INSTALL_RECORD_SCHEMA.properties)`. `resources`
is one key either way. No `schemaVersion` bump is needed — the `hooks` precedent
`[VERIFIED: state-io.ts:63-70]` added a REQUIRED resources member with a migrate fill and no bump.

### Pitfall: the partial-cascade folds are silent

**What goes wrong:** `dropped.workflows` is populated but never subtracted from
`record.resources.workflows`, so state.json keeps naming envelopes already deleted from disk. The
NEXT removal then tries to unlink them, gets ENOENT (idempotent skip), and the record is repaired
only by accident.
**Why it happens:** `applyPartialCascadeFold`'s `dropped` parameter is a five-axis structural
literal `[VERIFIED: orchestrators/plugin/shared.ts:1197-1203]`, so a six-axis argument satisfies it
with no error.
**Measured:** adding `workflows` to `UnstageOutcome.dropped` produced 12 errors, **none of them at
either fold site** `[VERIFIED: measured 2026-09-05]`.
**How to avoid:** treat both sites as explicit checklist items. `orchestrators/plugin/shared.ts:1188`
and `orchestrators/marketplace/remove.ts:325-335`. Note the latter is a hand-rolled four-axis
duplicate that already omits `hooks` — a pre-existing divergence; add `workflows` to it without
"fixing" `hooks` (out of scope, and `fallow dupes` has a `threshold: 3` that a fifth identical
filter line could trip).

### Pitfall: the closed-set widening is a three-file change, not one

**What goes wrong:** criterion 2 says "the ledger `phase` union in `shared/errors.ts`", and a plan
edits only that.
**Evidence:** `[VERIFIED: shared/errors.ts:359-363]` — verbatim:

```ts
export interface Phase3Failure {
  readonly phase: "skills" | "commands" | "agents" | "hooks" | "mcp";
  readonly msg: string;
  readonly cause: unknown;
}
```

**Measured:** widening only that member produced **3 errors, all in `update.ts`**, verbatim:

```text
extensions/pi-claude-marketplace/orchestrators/plugin/update.ts(1968,7): error TS2769: No overload matches this call.
extensions/pi-claude-marketplace/orchestrators/plugin/update.ts(1968,88): error TS2345: Argument of type '"hooks" | "skills" | "commands" | "agents" | "mcp" | "workflows"' is not assignable to parameter of type '"hooks" | "skills" | "commands" | "agents" | "mcp"'.
extensions/pi-claude-marketplace/orchestrators/plugin/update.ts(2193,5): error TS2322: Type '{ phase: "hooks" | "skills" | "commands" | "agents" | "mcp" | "workflows"; msg: string; }[]' is not assignable to type 'readonly UpdatePhaseFailure[]'.
```

That confirms `update.ts`'s own header claim `[VERIFIED: orchestrators/plugin/update.ts:1432]` —
verbatim: "A future fifth bridge surfaces here as a TS error." It does, for a sixth.

The two mirrors are `[VERIFIED: orchestrators/plugin/update.ts:1443]` — verbatim:

```ts
const PHASE3_FAILURE_PHASES = ["skills", "commands", "agents", "hooks", "mcp"] as const;
```

and `[VERIFIED: orchestrators/types.ts:145]` — verbatim:

```ts
export type UpdatePhaseBridge = "skills" | "commands" | "agents" | "hooks" | "mcp";
```

**Measured:** widening all three leaves **exactly one** error, in a test:

```text
tests/orchestrators/types.test.ts(94,3): error TS1360: Type '{ agents: true; commands: true; hooks: true; mcp: true; skills: true; }' does not satisfy the expected type 'Record<UpdatePhaseBridge, true>'.
```

`[VERIFIED: tests/orchestrators/types.test.ts:88-94]` — the exhaustiveness pin, verbatim:

```ts
const UPDATE_PHASE_BRIDGES = {
  agents: true,
  commands: true,
  hooks: true,
  mcp: true,
  skills: true,
} satisfies Record<UpdatePhaseBridge, true>;
```

Adding `workflows: true` closes it. So the criterion-2 commit is exactly four edits and touches
`update.ts` — a Phase 113 file — in the type dimension only. Widening `PHASE3_FAILURE_PHASES`
makes the runtime tuple accept a `"workflows"` failure that `update.ts` cannot yet produce, which
is harmless and is what lets Phase 113 populate it without a second type commit.

### Pitfall: `workflowArtifactPath` is `async`

**What goes wrong:** a forgotten `await` yields a path leaf literally named `[object Promise]`
rather than throwing.
**Evidence:** `[VERIFIED: persistence/locations.ts:179]` — verbatim
`workflowArtifactPath(generatedName: string): Promise<string>;`. Named by the CONTEXT as a
Phase-111-established hazard. This phase does not call it directly (the bridge does), but any
diagnostic or test helper composing an expected envelope path must `await` it — or, better, use
`path.join(locations.workflowsSavedDir, \`${name}.json\`)` in tests, as the integration test does
`[VERIFIED: tests/integration/workflow-kind-inversion.test.ts:228]`.

### Pitfall: stale count vocabulary in comments and docs

**What goes wrong:** comments that say "five" become false, and this repository treats comment
accuracy as reviewable.
**Sites measured by grep over `extensions/`:**

| Site | Verbatim text |
|---|---|
| `install.ts:20` | `//       runPhases(phases, ctx)                             // D-01 5-phase ledger` |
| `install.ts:317` | `* Local context type for the 5-phase ledger. Carries every value the` |
| `install.ts:780` | `* complete PI-15 / PI-3 / PI-2 / PI-4 / PI-6 / PI-7 + 5-phase ledger` |
| `install.ts:1240` | `// to a dynamic builder. D-63-01: hooks slot lands between agents and mcp.` (the adjacent `[skills, commands, agents, hooks, mcp, state]` sequence comment at `:1242` becomes wrong) |
| `enable-disable.ts:386-387` | `// ENBL-13 / D-100-04 / COMPONENT_KINDS 5-tuple: artifact removal stays` / `// symmetric across all five kinds -- the cascade above physically unstages` |
| `marketplace/shared.ts:270` | `/** True when all FIVE bridges' unstage* calls returned cleanly. */` |
| `marketplace/shared.ts:273` | `* Names actually removed across all five bridges. Empty when nothing was` |
| `state-io.ts:188` | `* still unstages every artifact of all five kinds (ENBL-13 / D-100-04), but the` |
| `docs/output-catalog.md:2514` | `... reuses the install ledger's 5-phase sequence with \`version: installed.version\` ...` |

**No gate pins any of these.** Grepping `tests/` and `scripts/` for `5-phase|five-phase` returns
only two comments inside `install.test.ts` (`:250`, `:2435`), which are themselves comments the
phase should update. So this is a discipline item, not a compile item — and exactly the kind of
thing a reviewer catches. The `docs/output-catalog.md` line is prose, not a rendered row, so
`catalog-uat.test.ts` does not pin it; whether it rides here or with Phase 114's doc work is a
plan choice, but leaving a published document stating a false count is the losing side.

### Pitfall: the `onPlaced` payload vs. the prepared names

**What goes wrong:** the undo unlinks `prep.result.stagedNames` and deletes a foreign file or a
restored previous envelope.
**Evidence:** `[VERIFIED: bridges/workflows/types.ts:139-145]` — verbatim: "A refusal places
nothing; so does an lstat failure inside the occupancy check; so does a mid-sequence rename failure
whose reversal loop fully succeeded. A caller that unlinks a name this commit did not place deletes
either a foreign file or a previous envelope the rollback just restored."
**How to avoid:** initialize `c.stagedWorkflowNames = []` immediately after assigning the prep
handle, and let `onPlaced` be the only writer.

### Pitfall: a workflows failure has no notify reason token — and needs none

**What goes wrong:** a plan invents a `REASONS` member, which is Phase 114's territory and a
closed-set amendment with byte-pinned catalog consequences.
**Evidence:** `[VERIFIED: orchestrators/plugin/uninstall.ts:168-192]` — `narrowCascadeFailure`
maps `AgentsUnstageFailureError` → `"source mismatch"`, `EACCES`/`EPERM` → `"permission denied"`,
`ENOENT` → `"source missing"`, and everything else → `"unreadable"` with the comment "the
unclassified cascade-failure default is genuinely 'we could not read/remove on-disk state'". A
`WorkflowsUnstageFailureError` falls through to `"unreadable"`, which is truthful.
**How to avoid:** rely on the existing fallback. The rollback-partial phase label is free-form
(`docs/output-catalog.md:675,677` show `[phase3a]`/`[phase3b]`), so `[workflows]` needs no
amendment either.

### Pitfall: import boundaries around the new error class

`[VERIFIED: tests/architecture/import-boundaries.test.ts:211-266]` — verbatim:

```ts
const PLUGIN_LEDGERS = ["install", "update", "uninstall", "reinstall", "enable-disable"] as const;
const MARKETPLACE_LEDGERS = ["add", "remove", "update", "autoupdate"] as const;
```

with the failure message "only orchestrators/marketplace/shared.ts is reachable from a plugin
ledger." `install.ts` already imports `cascadeUnstagePlugin, crossScopeFlag` from
`"../marketplace/shared.ts"` `[VERIFIED: install.ts:136]`, so importing
`WorkflowsUnstageFailureError` from the same module is legal and pre-established. Declaring the
class anywhere under `orchestrators/marketplace/{add,remove,update,autoupdate}.ts` would violate
the gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Removing workflow envelopes on any verb | A per-verb unstage call | The sixth slot inside `cascadeUnstagePlugin` | Four call sites inherit it; the DFEN-04 byte-identity claim (`install.ts:1341-1348`) depends on the primitive being the only composer. |
| Subtracting dropped names from the record | A new fold helper | `applyPartialCascadeFold` (`plugin/shared.ts:1188`) + the `remove.ts` duplicate | TR-03 already owns the asymmetric `dropped.commands → resources.prompts` mapping; a third implementation is a `fallow dupes` risk. |
| Composing a workflow envelope path | `path.join(savedDir, name + ".json")` | `locations.workflowArtifactPath(name)` (async) | WPTH-04 sole-composer rule; it runs `assertSafeName` + `assertPathInside` and refuses symlinked leaves. |
| Containment on the sweep target | An inline `path.join` + `rm` | `assertPathInside(locations.workflowsHomeDir, candidate, ...)` before the `rm`, ideally behind a `locations` accessor | `clone-gc.ts:97-99` sets the precedent; WR-12 proved anchoring at the wrong level yields a check that cannot fail. |
| Recursive staging-tree removal | Hand-rolled walk | `rm(dir, { recursive: true, force: true })` in a per-entry `try`/`catch` | `clone-gc.ts:101`; or `cleanupStaging` from `shared/fs-utils.ts:40` when a leak string is wanted. |
| Detecting a stale staging tree | A lock file, a PID file, a registry in state.json | `stat().mtimeMs` on the `<uuid>` directory + a constant | No liveness record exists or can exist for a `randomUUID()` root, and `update.ts:1425` already points at a timestamp for the analogous problem. |
| Deep-copying a plugin record | A spread | `clonePluginRecord` (`state-io.ts:147`) | Its own doc (`:138-141`) says the enumeration is deliberate so a new schema key is a compile error. |

**Key insight:** almost everything this phase needs already exists as a named seam. The failure
mode is not building the wrong thing — it is failing to notice that a seam does not compile-force
its own extension (`applyPartialCascadeFold`, the `remove.ts` filter) and that a precedent's stated
contract differs from its actual one (`garbageCollectPluginClones`).

## Research Question 8 — commit ordering

Every boundary below is green at `npm run check`. The chain is
`typecheck → lint → fallow → format:check → test:corresponding → test:corresponding:negative →
test:coverage:direct:negative → test → test:integration`
`[VERIFIED: package.json:77]`, so **no commit may leave a compile error, and any commit adding a
production module must add its owner test in the same commit.**

| # | Commit | Contents | Why this boundary is green |
|---|--------|----------|----------------------------|
| 1 | `feat: record the workflow inventory on the install record` | `state-io.ts` schema + `clonePluginRecord`; `migrate.ts` `["agents","mcpServers","hooks","workflows"]` + its doc; the 3 production construction sites (`install.ts:1206` region, `reinstall.ts:1418` region) filled with `[]`/derived-empty; all 27 test files' record literals; owner-test additions in `state-io.test.ts` and `migrate.test.ts` | 68 compile errors closed at once. `install.ts`/`reinstall.ts` write `workflows: []` until commits 3 and 6 — truthful, because nothing stages workflows yet. |
| 2 | `feat: widen the ledger phase closed set to carry workflows` | `shared/errors.ts:360`; `orchestrators/types.ts:145`; `update.ts:1443`; `tests/orchestrators/types.test.ts:88-94` | Measured: exactly these four close the 3+1 errors. No behavior change. |
| 3 | `feat: stage workflow envelopes as a ledger phase` | `.fallowrc.json` `"bridges-workflows"` in the `orchestrators` allow array; `install.ts` `InstallCtx` fields + `workflowsPhase` + array slot + `statePhase` `resources.workflows`; the `WorkflowsUnstageFailureError` class in `marketplace/shared.ts`; `install.test.ts` seeder arm + happy-path + undo cases; `phase-ledger.test.ts` `PRODUCTION_PHASE_NAMES` widening | **The fallow string MUST be here** — measured, `fallow dead-code` exits 1 on the first orchestrator import without it. `install.ts` must stay at 238+N/238+N branches. |
| 4 | `feat: remove workflow envelopes on every cascade` | `cascadeUnstagePlugin` sixth slot + `WorkflowsUnstageFailureError` throw; `UnstageOutcome.dropped.workflows`; `applyPartialCascadeFold`; the `remove.ts` filter; `marketplace/shared.test.ts`, `plugin/shared.test.ts`, `remove.test.ts` | 12 compile errors closed; the two silent fold sites added deliberately. Criterion 3 lands for all four verbs at once. |
| 5 | `test: pin uninstall, disable and cascade removal of workflow envelopes` | `uninstall.test.ts`, `enable-disable.test.ts`, `remove.test.ts` behavioral cases | Optional split from 4 if 4 is large; both orders are green. |
| 6 | `feat: re-materialize workflow envelopes on reinstall` | `reinstall.ts` `PreparedHandles`/`PartialPreparedHandles`/`prepareAllHandles`/`replaceAll` third return member/`unplaceWorkflows` catch consumer/`resourcesFromHandles`; `reinstall.test.ts` | Criterion 4. The `ReplacementEntry` union stays four-armed by design. |
| 7 | `feat: sweep orphaned workflow staging trees` | new `orchestrators/plugin/workflows-staging-gc.ts` **plus** `tests/orchestrators/plugin/workflows-staging-gc.test.ts`; optional `locations.workflowsStagingRoot(uuid)` + `locations.test.ts`; call sites in `install.ts::collectPostCommitWarnings` and `uninstall.ts::runPostUninstallCleanup` | Criterion 6. Measured: the module without its test fails `test:corresponding` with `missing-test: tests/orchestrators/plugin/workflows-staging-gc.test.ts`. |
| 8 | `docs: correct the ledger phase count` | the nine stale "five"/"5-phase" sites listed above, incl. `docs/output-catalog.md:2514` | No gate; pure accuracy. Could fold into 3. |

**Knowingly red boundaries: none.** Every commit compiles and every gate passes at each one.

**The one ordering constraint that is not optional:** commit 1 must precede commits 3, 4 and 6,
because all three read or write `record.resources.workflows`. Commits 2 and 7 are independent of
everything and can move anywhere.

**Commit ritual** `[CITED: 112-CONTEXT.md]`, unchanged: `.git` is a file in this worktree, so the
trufflehog hook aborts structurally. Run `pre-commit run --files <paths>`, confirm with a
**filesystem** trufflehog scan (`--results=verified,unknown --fail`), then commit with
`SKIP=trufflehog` — that hook only. Never `--no-verify`, never `--amend`. The `prettier` hook
rewrites files mid-run and the commit still succeeds; check `git status` after each commit.
`.planning/config.json` has `"use_worktrees": false` `[VERIFIED]`, so execution is sequential on
`features/workflow` directly.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node's built-in runner), Node >= 20.19.0; CI on Node 24 |
| Config file | none — driven by `package.json` scripts |
| Quick run command | `node --test tests/orchestrators/plugin/install.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WLIF-01 | Install writes envelopes as the sixth ledger phase | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ (extend) |
| WLIF-01 | A later (state) phase failure removes every placed envelope from disk | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ (extend) |
| WLIF-01 | An undo that cannot remove a name raises `[workflows] (rollback failed)` | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ (extend) |
| WLIF-01 | A containment refusal from the undo propagates verbatim, no rollback-partial marker | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ (extend) |
| criterion 2 | The three closed sets carry `workflows` and the exhaustiveness pin holds | unit (type) | `npm run typecheck && node --test tests/orchestrators/types.test.ts` | ✅ (extend) |
| WLIF-03 | `uninstall` leaves no envelope in `workflowsSavedDir` | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ (extend) |
| WLIF-03 | `disable` removes envelopes and retains `resources.workflows` | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ (extend) |
| WLIF-03 | `marketplace remove --cascade` removes envelopes for every plugin | unit | `node --test tests/orchestrators/marketplace/remove.test.ts` | ✅ (extend) |
| WLIF-03 | A partial removal reports per-name reasons through `WorkflowsUnstageFailureError` and folds the record | unit | `node --test tests/orchestrators/marketplace/shared.test.ts` | ✅ (extend) |
| criterion 4 | `reinstall` replaces envelopes and records the placed names | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ (extend) |
| criterion 6 | An aged orphan staging tree is removed; a fresh one is not | unit | `node --test tests/orchestrators/plugin/workflows-staging-gc.test.ts` | ❌ Wave 0 |
| criterion 7 | Whole chain green | gate | `npm run check` | ✅ |

### Sampling Rate

- **Per task commit:** `npm run typecheck && npx eslint <changed paths> && node --test <the owner test>`
- **Per wave merge:** `npm run typecheck && npm run lint && npm run fallow && npm run test:corresponding && npm test`
- **Phase gate:** `npm run check` green, plus
  `node scripts/test-coverage-direct.mjs <each touched production path>` reporting `hit === found`
  on branches, functions and lines for every one.

### Wave 0 Gaps

- [ ] `tests/orchestrators/plugin/workflows-staging-gc.test.ts` — covers criterion 6; must land in
      the same commit as the module.
- [ ] A `workflows?: { sourceName: string; body?: string }[]` arm on each of the six per-file
      seeding helpers listed in §"Seeding helpers must gain a workflows arm". No shared
      `tests/helpers/` exists (deleted by PR #167), so this is six independent edits.

*(No framework install needed; no `conftest`-equivalent exists in this repo by design.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase touches no credential or auth path. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-principal model; all operations are same-user. |
| V5 Input Validation | yes | `assertSafeName` + `assertPathInside` on every name-bearing path leaf (`persistence/locations.ts:362-378`); `typebox` `PLUGIN_INSTALL_RECORD_SCHEMA` validates the new `resources.workflows` array on every state read. |
| V6 Cryptography | no | None introduced. |
| V12 File and Resources | **yes** | The dominant category. Every new filesystem write/delete must route through the `assertPathInside` chokepoint before the operation, not after. |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A symlink planted at a staging-root segment redirects the sweep's `rm` outside `~/.pi/workflows/` | Tampering / DoS | Anchor `assertPathInside` on `locations.workflowsHomeDir`, one level **above** `workflowsStagingDir`, so the staging segment itself is `lstat`'d. This is the WR-12 lesson (`bridges/workflows/stage.ts:157-166`). Do **not** copy `sourcesStagingDir`'s at-the-root anchor. |
| The sweep removes a concurrent install's live staging root, destroying an in-flight transaction's only copy of the envelopes | Tampering | The age bound. `workflowsStagingDir` is scope-independent (`locations.ts:248`) so the per-scope `proper-lockfile` guard does **not** serialize access; the bound is the only protection. |
| A containment refusal during rollback is softened into a report and the failure is rendered as a clean rollback | Repudiation | `unstagePluginWorkflows` raises `PathContainmentError`; `phase-ledger.ts:89-91,125-127` re-throws by class; `install.ts:1858` renders the PI-14 bypass. Verified end-to-end this session. Do not re-fold. |
| The undo unlinks a name the commit did not place, deleting a user's own hand-saved workflow | Tampering | Remove only `onPlaced`-reported names (`bridges/workflows/types.ts:131-147`). The saved directory is shared with the user's own workflows and every other plugin. |
| A stale `resources.workflows` entry causes a later removal to unlink a name a different plugin now owns | Tampering | The partial-cascade folds must subtract `dropped.workflows`, and the `<plugin>:` prefix namespaces the name (`bridges/workflows/unstage.ts:8-10`). |
| Executable third-party JavaScript accumulates indefinitely under `$HOME` outside every scope root | Information disclosure / DoS | Criterion 6's sweep is the mitigation. This is why the criterion exists. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | 24 (CI-pinned; engines floor `>=20.19.0`) | — |
| `npm` + committed `package-lock.json` | `npm run check` | ✓ | — | — |
| `fallow` | the boundary gate | ✓ | `^3.17.0` (devDependency, `package.json:25`) | — |
| `typescript` | typecheck | ✓ | `^6.0.3` | — |
| `pre-commit` | commit ritual | ✓ | — | filesystem trufflehog scan + `SKIP=trufflehog`, per CLAUDE.md |
| `@quintinshaw/pi-dynamic-workflows` | **not needed this phase** | n/a | — | The bridge writes envelopes; nothing in this phase drives the engine. Engine-facing verification is Phase 117. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. Every module it touches is in-repo,
and the only dependency it exercises (`fallow`, `typescript`, `node:test`) is already a committed
devDependency. No `npm install` is expected at any point in the phase.

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md`, `.planning/codebase/CONVENTIONS.md` and
`.planning/codebase/ARCHITECTURE.md`, all binding on this plan:

- **Read before editing.** "Before editing any file, read it first. Before modifying a function,
  trace its callers."
- **Never commit to `main`.** Work stays on `features/workflow`.
- **Conventional Commits**, title 5–72 chars, body lines ≤ 80. **No GSD milestone/phase mentions**
  in commit messages or PR titles.
- **`pre-commit run --files <changed files>` BEFORE `git commit`.** Never `--no-verify`. Never
  `--amend` to recover from a hook failure. In this worktree prefix with `SKIP=trufflehog` only,
  after a clean filesystem trufflehog scan.
- **Never rebase, never rewrite history.**
- **Comment policy** (`.claude/rules/typescript-comments.md`): no `Phase NN`, `Plan NN`, `Wave N`,
  `Pitfall N`, `Pattern N`, `milestone vX.Y` in comments or test titles. Decision and requirement
  IDs (`D-01`, `WLIF-03`, `WR-10`, `NFR-1`, `PI-14`) are the sanctioned anchors. **No narration of
  code that no longer exists** — no "the former X", "used to", "byte-identical to the former".
- **`explicit-module-boundary-types: "error"`** — every exported function declares its return type.
- **Two independent complexity ceilings**: ESLint `sonarjs/cognitive-complexity: 15` and fallow
  `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`. They disagree; both must pass.
  `.fallowrc.json` has **zero** `thresholdOverrides`. `runPhases`' own comment
  (`phase-ledger.ts:109-112`) records that `invokeFailingPhaseUndo` was extracted for exactly this
  reason — a sixth phase body pushes `runInstallLedgerBody` further and may need extraction too.
- **`curly: ["error", "all"]`; blank line required after every block-like statement.**
- **All user-visible output through `shared/notify.ts`.** No `process.stdout`/`process.stderr` in
  `extensions/` — enforced by ESLint `no-restricted-syntax` and fallow `calls.forbidden`.
- **Typed error classes** extending `Error`, setting `this.name`, carrying readonly structured
  fields, discriminated by `instanceof` and never by message substring.
- **Import order** enforced by `import-x/order`: builtin → external → internal → parent → sibling →
  index → object → type, blank line between groups, alphabetized case-insensitively, type-only
  imports last, `.ts` extensions explicit.
- **Named exports only**; no default exports.
- **Dependency injection over test-only seams.** `scripts/check-corresponding-tests.mjs` fails a
  production module with no mirrored owner test; the spike's 38 `__test_*` exports have no place
  here.
- **Project skills to apply during review:** `.agents/skills/typescript-google-style-review/SKILL.md`
  and `.agents/skills/typescript-unit-testing-review/SKILL.md`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A 24-hour `mtime` age bound is the right threshold for the staging sweep | Criterion 6 | Too short → a very slow install's live staging root is destroyed mid-transaction (data loss of the in-flight envelopes; recoverable by re-running install). Too long → orphans persist longer than necessary (hygiene only). No existing constant in the codebase to anchor on; worth an operator decision. |
| A2 | `prep.result.warnings` should ride `bridgeWarnings` rather than `discoveryWarnings` | Criterion 1 | A D-141-03 channel misassignment: standalone-mode users see warnings they should not, or miss ones they should. Both precedents exist in the same file (skills → discovery, agents → bridge); the workflows array's mixed content is the argument for `bridgeWarnings`. |
| A3 | The undo should throw `WorkflowsUnstageFailureError` on a non-empty `failed[]` rather than swallow it | Criterion 1 | Swallowing leaves executable envelopes on disk while the ledger reports a clean rollback — criterion 1's exact failure. Throwing changes the rendered row shape (adds a `{rollback partial}` reason). The spike made the same call; the five sibling phases do the opposite. |
| A4 | No `REASONS` closed-set amendment is needed in this phase | Criterion 3 | If a reviewer wants a dedicated `{workflows}` reason, that is a Phase 114 closed-set amendment with byte-pinned catalog consequences and would have to be pulled forward. The `"unreadable"` fallback is truthful in the meantime. |
| A5 | `docs/output-catalog.md:2514`'s "5-phase" correction rides in this phase rather than Phase 114 | Pitfalls | A published document states a false count for one phase. Low risk either way; naming it is what matters. |
| A6 | Adding a `workflows` axis to `remove.ts`'s hand-rolled four-axis filter will not trip `fallow dupes` (`threshold: 3`) | Pitfalls | A `dupes` failure at `npm run check` step 3. The filter is already a near-duplicate of `applyPartialCascadeFold`; a fifth identical line could cross the clone threshold. Cheap to measure during execution; not measured this session because the fold body does not exist yet. |
| A7 | `InstallLedgerSummary` should NOT gain a `stagedWorkflowNames` member in this phase | Criterion 1 | If Phase 114's soft-dep marker needs it, that phase widens the projection then. Adding it now would put a field on a public projection that no consumer reads, which the type's own doc argues against. |

## Open Questions (RESOLVED)

All four were decided by the orchestrator before planning; the WLIF-02
double-booking was corrected in REQUIREMENTS.md. Resolutions inline below.

- **Q1 — the age bound: 24 hours.** No in-repo anchor exists, so this is a new
  number. 24h is chosen as conservative by orders of magnitude: an install that
  is still live after a day has failed in a way a sweeper should not adjudicate,
  and the cost of being wrong in the safe direction is one orphaned directory
  surviving an extra day. Name it as a single exported constant so a later phase
  can tune it without hunting.
- **Q2 — silent, matching `clone-gc.ts` exactly.** House machinery reuse beats a
  bespoke reporting surface, and a sweep the user did not ask for should not
  narrate itself. The rm-failure leak strings still travel the same way
  `clone-gc`'s do.
- **Q3 — add only `workflows` to `remove.ts`'s filter and FILE the `hooks` gap.**
  The omission is pre-existing and unrelated to this phase; CLAUDE.md's
  surgical-changes rule says notice it, do not fix it. File it in
  `.planning/BACKLOG.md` with the line reference so it is not lost.
- **Q4 — budget the extraction task.** Whether `runInstallLedgerBody` stays under
  both complexity ceilings with a sixth phase is not measurable before the
  change, so plan for the extraction rather than discovering it at the gate.


1. **What age bound does the operator want for the staging sweep?**
   - What we know: no age/TTL constant exists anywhere in `extensions/`; `update.ts:1425` points at
     a timestamp for the analogous orphan problem without naming a number; the prepare→commit
     window is milliseconds in practice; the directory `mtime` provably tracks last activity.
   - What's unclear: the number, and whether the operator wants it exported and pinned by a test.
   - Recommendation: 24 hours, declared as a module-level `SCREAMING_SNAKE_CASE` constant beside
     the sweeper so a test can import and reason about it without a test-only seam. Surface it as
     an explicit confirmation during planning.

2. **Should the sweep report anything to the user, or stay silent hygiene?**
   - What we know: `garbageCollectPluginClones`'s leaks are discarded at every call site, under
     D-19-01 ("hygienic cleanup never becomes the primary user-facing path").
   - What's unclear: whether a removed-tree count is worth a `postCommitWarnings` row in
     orchestrated mode.
   - Recommendation: silent, matching the precedent exactly. Return leak strings so the shape is
     available if a later phase wants them.

3. **Does the `remove.ts` four-axis filter's missing `hooks` axis get fixed here?**
   - What we know: it is a pre-existing divergence from `applyPartialCascadeFold`, unrelated to
     workflows, and `marketplace remove --cascade` currently persists a stale `resources.hooks`
     on a partial-cascade failure.
   - What's unclear: whether the phase reviewer will treat leaving it as an omission.
   - Recommendation: add only the `workflows` axis; note the `hooks` gap in the plan's own text so
     the reviewer sees it was observed, not missed, and file it rather than fix it.

4. **Does `runInstallLedgerBody` stay under both complexity ceilings with a seventh phase?**
   - What we know: `.fallowrc.json` has zero `thresholdOverrides`; `maxUnitSize: 60`;
     `phase-ledger.ts:109-112` records a prior extraction done for the same reason.
   - What's unclear: the function's current cognitive score. Not measurable without the change.
   - Recommendation: expect to extract `workflowsPhase`'s body into a named helper if
     `npm run fallow` complains at commit 3, and budget a task for it.

## Sources

### Primary (HIGH confidence — read from disk this session)

- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` (full, 174 lines)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (lines 300-520, 900-1300, 1330-1450, 1535-1600, 1826-1990)
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts` (full, 111 lines)
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (lines 263-282, 1150-1450)
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` (lines 155-200, 300-340, 395-445, 600-680)
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` (lines 235-290, 340-420)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (lines 1175-1230)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (lines 1420-1450)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (lines 27-65, 266-390)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (lines 305-345)
- `extensions/pi-claude-marketplace/orchestrators/types.ts` (lines 138-155)
- `extensions/pi-claude-marketplace/shared/errors.ts` (lines 330-410)
- `extensions/pi-claude-marketplace/bridges/workflows/{index,types,unstage}.ts` (full); `stage.ts` (lines 1-310, 341-456)
- `extensions/pi-claude-marketplace/persistence/{state-io,migrate,locations}.ts` (relevant ranges)
- `extensions/pi-claude-marketplace/platform/workflow-home.ts` (full, 33 lines)
- `extensions/pi-claude-marketplace/domain/workflow-script.ts` (lines 34-105)
- `.fallowrc.json` (lines 60-200); `package.json` (scripts block)
- `tests/transaction/phase-ledger.test.ts`; `tests/orchestrators/plugin/install.test.ts`;
  `tests/architecture/{compat-01-no-expansion,import-boundaries}.test.ts`;
  `tests/orchestrators/types.test.ts`; `tests/integration/workflow-kind-inversion.test.ts`
- `scripts/test-coverage-direct.mjs` (lines 1-200)
- `.planning/workstreams/workflows/phases/111-workflows-bridge/{111-REVIEW.md,111-REVIEW-FIX.md}`
- `.planning/workstreams/workflows/{ROADMAP,STATE,REQUIREMENTS}.md`; `.planning/ROADMAP.md:36-48`

### Primary (HIGH confidence — measured this session)

All in a throwaway `git worktree` at HEAD `c514ba7f` with `node_modules` symlinked, removed after:

- Required `resources.workflows`: 68 `tsc` errors across 30 files, 3 production. Per-file counts
  and the 3 production messages quoted verbatim above.
- `Phase3Failure.phase` widened alone: 3 errors, all `update.ts`, quoted verbatim.
- All three closed sets widened: 1 error, `tests/orchestrators/types.test.ts:94`, quoted verbatim.
- `UnstageOutcome.dropped.workflows`: 12 errors, 4 files, 2 production, neither fold site.
- `orchestrators → bridges-workflows` import without the allow-list edit: `fallow dead-code`
  output quoted verbatim; true exit code 1 (`npm run fallow` exit 1); exit 0 after the one-string
  edit.
- New module without owner test: `missing-test: tests/orchestrators/plugin/workflows-staging-gc.test.ts`.
- `node scripts/test-coverage-direct.mjs` on ten production paths: all `Direct coverage passed`
  with `hit === found`, numbers tabulated above.

### Secondary (MEDIUM confidence)

- `git show features/workflows-spike:extensions/pi-claude-marketplace/orchestrators/plugin/{install,reinstall}.ts`
  and `.../marketplace/shared.ts`, `.../persistence/{state-io,migrate}.ts` — read for **intent
  only**, per criterion 5. Every recommendation above was re-derived against the current files;
  the spike is cited where it independently reached the same conclusion, never as a source to copy.

### Tertiary (LOW confidence)

- None. No web search was performed; every claim in this document is grounded in a file read or a
  command run in this session.

## Metadata

**Confidence breakdown:**

- Ledger shape and `Phase<InstallCtx>` contract: **HIGH** — read verbatim; the sixth phase is a
  mechanical mirror of five siblings in the same file.
- PI-14 interaction: **HIGH** — traced end to end through `phase-ledger.ts` → `install.ts:1253` →
  `install.ts:1858`, with the existing identity-assertion tests as corroboration.
- Removal-path enumeration: **HIGH** — all four call sites located by symbol search and read.
- Compile blast radii and gate behavior: **HIGH** — measured, not inferred; outputs quoted.
- Criterion 6 sweep design: **MEDIUM** — the precedent analysis is HIGH (read in full), but the age
  bound is a new number with no in-repo anchor (A1).
- Warning-channel and undo-throw choices: **MEDIUM** — precedent points both ways and the evidence
  for each is given (A2, A3).

**Research date:** 2026-09-05
**Valid until:** 2026-10-05 — this is in-repo research against a moving branch. Re-measure the
compile blast radii if `features/workflow` advances past `c514ba7f` before planning.

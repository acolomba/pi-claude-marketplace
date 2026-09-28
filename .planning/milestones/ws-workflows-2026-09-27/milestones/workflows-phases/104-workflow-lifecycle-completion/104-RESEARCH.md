# Phase 104: Workflow lifecycle completion - Research

**Researched:** 2026-08-15
**Domain:** In-repo lifecycle wiring (TypeScript, no new external dependencies)
**Confidence:** HIGH — every claim below was read out of the worktree this session; the
few `[ASSUMED]` items are called out in the Assumptions Log.

## Summary

This phase is pure in-repo wiring. Nothing new is installed, no library is chosen, no
external API is consulted. The whole research problem is *reading the five verb
implementations precisely enough that the planner can name exact insertion points*, because
the four verbs compose in four **different** ways and only one of them is a `runPhases`
ledger.

The single most consequential finding contradicts the phase CONTEXT and the project skill.
Both state that `install.ts` and `update.ts` are "the only two `runPhases` consumers" and
that `update` therefore gets "the sixth materialize phase in the same ledger position
install uses". **That is false.** `install.ts` is the *only* `runPhases` consumer in the
extension. `update.ts` is a hand-rolled three-phase swap whose own header says so
verbatim, and its per-bridge failure model (continue-across-failures with an independent
per-bridge finalize gate) is structurally different from the ledger's all-or-nothing
reverse-order undo. The re-stage wiring in `update` lands in four separate places, not one
array slot, and it must join a closed `Phase3Failure["phase"]` union that lives in
`shared/errors.ts`.

The second consequential finding is that WLIF-06's reason token cannot simply be appended
to `REASONS`. The `(uninstalled)` row is one of nine deliberately reasons-**less** render
variants: `PluginUninstalledMessage` declares no `reasons` field and both of its render
sites hard-code `composeReasons(undefined, …)`. Carrying the lingering-command remedy on an
uninstall row means widening that message type, changing two render arms, correcting two
doc-comment counts, amending three architecture gates, and adding a *new* catalog state
(not editing the existing `success` one) — because a `warning`-severity row makes
`notify()` prepend `A plugin operation needs attention.`, which is a byte change the
existing `success` fixture would reject.

**Primary recommendation:** Sequence the phase as four independent wiring units — (1) the
cascade sixth unstage + WR-06 ownership check + WR-01 previous-names wiring at the install
ledger, which together fix `uninstall`/`disable`/`marketplace remove`/`enable`; (2) `update`'s
four-site re-stage; (3) `reinstall`'s handle-set extension; (4) WLIF-06's message plumbing
plus the WR-10 canary assertion. Unit 1 is load-bearing and must land first: units 2 and 3
both drive the previous-names path that unit 1 makes safe.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Remove workflow envelopes for a plugin | `orchestrators/marketplace/shared.ts` (`cascadeUnstagePlugin`) | `bridges/workflows/unstage.ts` | The cascade is the single removal primitive; `uninstall`, `disable` and `marketplace remove` all route through it, so one change serves three verbs [VERIFIED: `orchestrators/plugin/uninstall.ts:345`, `orchestrators/plugin/enable-disable.ts:336`, `orchestrators/marketplace/remove.ts:638`] |
| Re-stage on version change | `orchestrators/plugin/update.ts` (hand-rolled 3-phase swap) | `bridges/workflows/stage.ts` | `update` owns the prepare/commit/finalize split and the per-bridge failure gate; the bridge owns displacement and rollback |
| Re-stage on repair | `orchestrators/plugin/reinstall.ts` (`PreparedHandles` + `replaceAll`) | `bridges/workflows/stage.ts` | reinstall composes its own handle set and never routes staging through the cascade |
| Re-materialize on enable | `orchestrators/plugin/install.ts` (`runInstallLedger`) | `orchestrators/plugin/enable-disable.ts` | enable calls the guard-free ledger body; the ledger's workflows phase is the only place the previous-name list can reach it |
| Refuse an unowned pre-existing target (WR-06) | `bridges/workflows/stage.ts` (`commitPreparedWorkflows`) | — | The other bridges put the ownership pre-check inside their `replacePrepared*` rename loop; the workflows analog is the commit rename loop |
| Report the lingering command (WLIF-06) | orchestrators (stamp the fact + severity) | `shared/notify.ts` (render only) | notify.ts is a dumb renderer: commands determine state and stamp severity and reasons |
| Prove removal against the real engine | `tests/live-uat/workflow-storage-canary.mjs` | — | The only automated surface that exercises the engine's real storage layout |

## Project Constraints (from CLAUDE.md)

Directives that bind this phase's plan:

- **Containment (NFR-10, workflows amendment):** writes admitted only under
  `<workflowsHomeDir>/saved/`, `projects/<key>/saved/`, and
  `.pi-claude-marketplace-staging/`. Removal paths must keep routing through
  `locations.workflowArtifactPath(name)` — never join a name onto the saved dir.
- **NFR-3 retry safety:** every operation idempotent or fail-clean. Unstaging an absent
  envelope is a no-op, already implemented [VERIFIED: `bridges/workflows/unstage.ts:32-39`].
- **NFR-2 recovery model:** no fix may require a Pi restart; `/reload` must suffice. WLIF-06
  exists precisely because deregistration cannot satisfy this and must be *reported*.
- **NFR-1 atomicity:** all disk mutation via tmp + rename. The commit rename loop is the
  only mutation the new wiring adds.
- **IL-2 output channel:** all user-visible messages through `shared/notify.ts`; no direct
  `ctx.ui.notify` outside that file; no `process.stdout` writes in extension code.
- **NFR-6 quality bar:** `npm run check` (typecheck + ESLint + Prettier + tests) green.
- **Comment policy** (`.claude/rules/typescript-comments.md`): cite `WLIF-0N`, `WR-0N`,
  `CR-0N`, `D-NN`, `NFR-N` as anchors; **never** `Phase NN`, `Plan NN`, `Wave N`, bare
  `Pitfall N`.
- **Git:** never commit to `main`; `pre-commit run --all-files` before commit; from this
  worktree prefix `SKIP=trufflehog` only after a clean filesystem trufflehog scan; never
  `--no-verify`.
- **Lint shape:** `sonarjs/cognitive-complexity` = 15 (the update finalize already carries an
  `eslint-disable-next-line`; a sixth guard arm may need the same treatment),
  `@typescript-eslint/explicit-module-boundary-types` = error, blank line after every
  block-like statement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Removal wiring**

- The sixth unstage lands in **`cascadeUnstagePlugin`** (`orchestrators/marketplace/
  shared.ts`), not per-verb. It is the single removal primitive behind `uninstall`,
  `disable` and `marketplace remove`, so one change gives all three the fix and makes it
  impossible for a future verb to inherit five-of-six. Its doc comment and its
  `UnstageOutcome` doc ("all FIVE bridges") both become false on that change and must be
  corrected in the same commit — a stale count is how the next reader re-introduces the
  gap.

- **`reinstall` does NOT inherit and must be wired separately.** It composes its own
  `prepareStage*` handle set (`skills`/`commands`/`agents`/`mcp`) and never routes staging
  through the cascade. Phase 103 taught it to carry `oldRecord.resources.workflows` forward
  through `resourcesFromHandles`, which preserves the RECORD while the artifacts on disk
  are never refreshed — a record that is honest about a stale disk. WLIF-05's own wording
  ("must each be checked individually rather than assumed covered by the `runPhases`
  change") is the rule; apply it to reinstall specifically.

- A workflow unstage failure is **reported through a structured error, never swallowed** —
  mirror the `AgentsUnstageFailureError` precedent, which carries its failures as readonly
  typed fields. The leftover file here is executable code; a silent failure is the worst
  available outcome.

- Unstaging an already-absent envelope is a **no-op, not an error**. The cascade's own
  contract states bridges are idempotent, and `uninstall` must stay safe to retry (NFR-3).

**Re-stage wiring**

- The previous-name list is **`record.resources.workflows`** — the recorded inventory —
  for `update`, `reinstall` and `enable` alike. It is the only thing that names what the
  previous install actually wrote; deriving it from the new plugin version would miss
  exactly the removed and renamed cases criterion 1 exists to catch.

- **WR-01 and WR-06 land in the SAME change.** Wiring the recorded inventory (WR-01) and
  refusing a pre-existing unowned target (WR-06) are one unit: with `_previousNames` always
  empty, the refusal would reject every `enable` re-materialization of a plugin's own
  envelopes. Splitting them trades a silent overwrite for a broken `enable`. The commit
  path was already made safe for their arrival in Phase 103 — previous targets are
  displaced into staging and restored on failure rather than unlinked — so this is a wiring
  change, not a redesign.

- `update` gets the **sixth materialize phase in the same ledger position install uses**.
  `install.ts` and `update.ts` are the only two `runPhases` consumers; keeping the arrays
  symmetric is what stops the next kind from being added to one and not the other.

- A record predating Phase 103 carries `workflows: []` from the migration fill. That is
  literally correct — no previous artifacts — so re-staging behaves as a fresh install.
  **No special-case branch for the empty list.**

**The lingering-command remedy (WLIF-06)**

- The remedy is carried by a **new closed-set reason token**, not by the existing
  `/reload to pick up changes` trailer. The trailer is about picking up NEW things; the
  fact here is that a REMOVED command is still live and runnable for the rest of the
  session. Understating an executable-code fact to save a token is the wrong trade.

- Severity is **warning**: the operation WAS carried out, but the desired state is not
  reached until reload. That is the middle arm of the tri-state model (info =
  desired-reached, warning = carried-out-but-short, error = not-carried-out).

- It is stamped **only when the removed set actually contained workflows.** A plugin that
  ships none must not be told about a lingering command it never had.

- The new token needs its `docs/output-catalog.md` entry under the existing byte-equality
  gate. **Coordinate with Phase 105's WDEP-04 amendment** — that phase adds its own reason
  token to the same closed set and the same catalog. Two separate amendments are fine; two
  conflicting rewrites of the same catalog region are not.

- The message states the host limitation as a limitation, not as a defect: Pi has no
  `unregisterCommand`, so registration converges on `/reload` (NFR-2 satisfied) while
  deregistration cannot happen mid-session at all.

**Proving it**

- **The live canary asserts BETWEEN the uninstall and the teardown.** Today its
  `rm -rf` of the sandbox HOME runs immediately after `uninstall`, deleting any envelope
  the uninstall failed to remove — so it passes regardless (WR-10). It is the only
  automated surface that exercises the real engine's storage layout, and it is currently
  blind to precisely the half of the lifecycle this phase adds.

- **Criterion 2 is proven in BOTH scopes.** The project scope is where the derived key
  makes the path non-obvious, and it is the scope whose `extensionRoot` can sit on a
  different filesystem from the artifacts.

- The update triad — a version that **adds one workflow, removes another, and changes a
  third's `meta.name`** — is ONE test over one fixture pair, not three. The interaction is
  the risk: a rename is an add plus a remove that must not be mistaken for a replace.

### Claude's Discretion

- The new reason token's exact spelling, the structured unstage-failure error's class name
  and field shape, plan/task decomposition and wave assignment, and whether the update and
  reinstall re-stage paths share a helper or stay separate.

### Deferred Ideas (OUT OF SCOPE)

- The `workflow_control` soft-dependency probe, the third `DEPENDENCIES` member, its reason
  token, and write-anyway degradation → Phase 105 (WDEP-01..04).
- The executable-code contract and the admit-versus-run divergence table → Phase 105
  (WDOC-01, WDOC-02).
- Broadening `assertSafeName`'s engine-parity gate beyond workflows → out of milestone
  scope; the wrap is deliberate (Phase 102 decision).
</user_constraints>

### ⚠ One locked decision rests on a false premise — planner must adapt, not obey literally

CONTEXT states: *"`update` gets the sixth materialize phase in the same ledger position
install uses. `install.ts` and `update.ts` are the only two `runPhases` consumers; keeping
the arrays symmetric is what stops the next kind from being added to one and not the
other."*

`update.ts` has **no** `Phase` array and does not call `runPhases`. Its own header says
[VERIFIED: `orchestrators/plugin/update.ts:10-11`]:

> `Both share the per-plugin 3-phase swap implementation (D-03 HAND-ROLLED,`
> `NOT runPhases -- the heterogeneous-undo flow D-02 precedent):`

A repository-wide grep for `runPhases` returns exactly one production consumer
[VERIFIED: `orchestrators/plugin/install.ts:1311` is the sole `await runPhases(...)` call
site outside `transaction/` and `tests/`]. The same false claim is in the project skill
[CITED: `.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md`
§8 — *"Append a 6th `Phase` to the literal array at `orchestrators/plugin/install.ts` and its
`update.ts` counterpart. `runPhases` consumers are only those two"*], so the error is
inherited, not introduced by discuss-phase.

**The decision's INTENT survives intact and must be honored:** the workflows slot in
`update` goes in the position that mirrors install's (**after `mcp`**), and the symmetry
guard must be structural rather than aspirational. The mechanism differs: in `update` the
guard is the closed `Phase3Failure["phase"]` union plus the `PHASE3_FAILURE_PHASES` runtime
tuple, whose own comment already promises *"A future fifth bridge surfaces here as a TS
error"* [VERIFIED: `orchestrators/plugin/update.ts:1289-1290`]. Adding `"workflows"` to both
is the update-side equivalent of appending to the ledger array. Update that comment's
wording in the same change (it is about to be a *sixth*).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WLIF-02 | Update re-stages workflows — adding, removing, and replacing artifacts to match the new plugin version | §"update.ts: four insertion sites"; §"Pattern 2"; the four-site table names each line |
| WLIF-03 | Uninstall removes every workflow artifact it installed, leaving nothing behind outside the scope root | §"cascadeUnstagePlugin: the sixth unstage"; §"WR-10 canary"; the `dropped` shape and `applyPartialCascadeFold` blast radius are enumerated |
| WLIF-04 | Reinstall replaces workflow artifacts | §"reinstall.ts: the handle set"; the replace/rollback/finalize triple question is posed with a recommendation |
| WLIF-05 | Disable removes workflow artifacts and enable re-materializes them | §"disable inherits the cascade"; §"enable's path through runInstallLedger" — including why `resources` survives a successful disable |
| WLIF-06 | When a removed workflow's command lingers for the session, the user is told the reload remedy | §"WLIF-06 message plumbing" — the reasons-less `(uninstalled)` variant, the summary-line byte hazard, the catalog gate mechanics, and the Phase 105 coordination hazard |
</phase_requirements>

## Standard Stack

### Core

No new dependency. Every symbol this phase needs is already exported.

| Symbol | Module | Purpose | Why standard |
|--------|--------|---------|--------------|
| `unstagePluginWorkflows` | `bridges/workflows/index.ts` | Removes envelopes by recorded name, ENOENT-tolerant | The bridge's own removal half, already exported from the barrel [VERIFIED: `bridges/workflows/index.ts:11`] |
| `prepareStageWorkflows` / `commitPreparedWorkflows` / `abortPreparedWorkflows` | `bridges/workflows/index.ts` | Prepare / commit / abort triple | Already exported [VERIFIED: `bridges/workflows/index.ts:10`] |
| `PreparedWorkflowsStaging` | `bridges/workflows/index.ts` (type) | The discriminated `noop \| staged` handle | Already exported [VERIFIED: `bridges/workflows/index.ts:16`] |
| `cascadeUnstagePlugin` / `UnstageOutcome` | `orchestrators/marketplace/shared.ts` | The single removal primitive | Three verbs route through it |
| `AgentsUnstageFailureError` | `orchestrators/marketplace/shared.ts` | Structured non-swallowed bridge-unstage failure | The named precedent for the new workflows failure error |
| `applyPartialCascadeFold` | `orchestrators/plugin/shared.ts:855` | Shrinks the record by what the partial cascade actually dropped | Consumed by both `uninstall` and `disable` failure arms |
| `REASONS` / `ContentReason` | `shared/notify.ts:90-189` | The closed reason set | WLIF-06's token joins the tail |
| `pathExists` | `shared/fs-utils.ts:59` | lstat-based, symlink-non-following existence predicate | The exact predicate the other bridges' ownership pre-check uses |

**Installation:** none. No `npm install` step in this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Wiring the sixth unstage into `cascadeUnstagePlugin` | Per-verb `unstagePluginWorkflows` calls in `uninstall.ts`, `enable-disable.ts`, `remove.ts` | Rejected by locked decision, and correctly: three call sites means a future seventh verb inherits five-of-six again |
| A new `replacePreparedWorkflows`/`rollback`/`finalize` triple for reinstall | Commit in place like `hooks` does, with manual-recovery semantics on a later-step failure | See §"reinstall.ts: the one real design choice" — recommendation given |
| Widening `PluginUninstalledMessage` with `reasons` | Emitting a second standalone notification after the uninstall row | Rejected: two blocks for one operation contradicts the row grammar, and severity would have to be reasoned about twice |

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. `npm install` is not run;
`package.json` dependencies are unchanged. The only third-party name that appears anywhere
in the phase's surface is `@quintinshaw/pi-dynamic-workflows`, which the live canary
resolves from an *already-installed* location at runtime and which is deliberately **not** a
declared dependency [VERIFIED: `tests/live-uat/workflow-storage-canary.mjs:9-15` — *"Answering
it in the offline suite would mean adding the engine to a dependency block … So the proof
lives here, outside `npm run check`."*].

## Architecture Patterns

### System Architecture Diagram

```text
                       ┌───────────────── user command ─────────────────┐
                       │                                                 │
   /claude:plugin      │  uninstall    disable      update    reinstall  │  enable
        │              └────┬──────────────┬───────────┬─────────┬───────┘     │
        ▼                   │              │           │         │             │
   edge/handlers/plugin/*   │              │           │         │             │
        │                   ▼              ▼           │         │             ▼
        │            uninstall.ts   enable-disable.ts  │         │      enable-disable.ts
        │            (opts.cascade   (runDisableBranch)│         │      (runEnableBranch)
        │             seam)                │           │         │             │
        │                   └──────┬───────┘           │         │             │
        │                          ▼                   │         │             ▼
        │        orchestrators/marketplace/shared.ts   │         │      install.ts
        │        ┌─────────────────────────────────┐   │         │      runInstallLedger
        │        │  cascadeUnstagePlugin            │   │         │      (guard-FREE —
   marketplace ──►  skills → commands → agents      │   │         │       caller holds
   remove.ts        → hooks → mcp → [WORKFLOWS ◄NEW]│   │         │       the lock)
        │        └────────────┬────────────────────┘   │         │             │
        │                     │                        │         │             │
        │                     ▼                        ▼         ▼             ▼
        │        bridges/workflows/unstage.ts    update.ts  reinstall.ts  runPhases ledger
        │        unstagePluginWorkflows          3-phase     PreparedHandles  [skills,
        │        (unlink by recorded name,       hand-rolled + replaceAll      commands,
        │         ENOENT-tolerant)               swap                          agents,
        │                     │                        │         │             hooks, mcp,
        │                     │                        └────┬────┘             WORKFLOWS,
        │                     │                             ▼                  state]
        │                     │                  bridges/workflows/stage.ts        │
        │                     │                  prepareStageWorkflows ◄───────────┘
        │                     │                   (previousWorkflowNames ◄─ record.resources.workflows)
        │                     │                        │
        │                     │                        ▼
        │                     │                  commitPreparedWorkflows
        │                     │                   ├─ displacePreviousTargets  (rename aside into staging)
        │                     │                   ├─ [WR-06 ownership refusal ◄NEW]
        │                     │                   ├─ rename(staged → target) per file
        │                     │                   └─ on throw: reverse renames, restore displaced
        │                     ▼                        ▼
        │        ┌──────────────────────────────────────────────────────┐
        └───────►│  ~/.pi/workflows/saved/<plugin>:<name>.json           │
   record        │  ~/.pi/workflows/projects/<key>/saved/<plugin>:<name>.json │
   resources.    │  ~/.pi/workflows/.pi-claude-marketplace-staging/<uuid>/    │
   workflows ───►└──────────────────────────────────────────────────────┘
   (state.json — the ONLY inventory; these files sit outside every scope root)
                                     │
                                     ▼
                    host engine registerAllSavedWorkflows (load time)
                    pi.registerCommand(name) — NO unregisterCommand
                                     │
                                     ▼
                    WLIF-06: removed name still registered this session
                    → orchestrator stamps reason + warning severity
                    → shared/notify.ts renders it
```

### Recommended change surface

```text
extensions/pi-claude-marketplace/
├── bridges/workflows/
│   └── stage.ts             # WR-06 ownership refusal in the commit rename loop
├── orchestrators/
│   ├── marketplace/shared.ts  # 6th unstage + dropped.workflows + doc corrections
│   │                          # + new WorkflowsUnstageFailureError
│   └── plugin/
│       ├── install.ts       # WR-01: previousWorkflowNames from the state snapshot
│       ├── update.ts        # 4 sites: prepare, 2 aborts, phase-3a commit, finalize
│       ├── reinstall.ts     # handle set, replaceAll, resourcesFromHandles, warnings, abort
│       ├── uninstall.ts     # WLIF-06 stamp only (cascade fix is inherited)
│       ├── enable-disable.ts# WLIF-06 stamp only (both branches inherited)
│       ├── shared.ts        # applyPartialCascadeFold gains the workflows axis
│       ├── uninstall.messaging.ts # render arm passes p.reasons
│       └── update.messaging.ts / enable-disable.messaging.ts  # if those rows stamp too
├── shared/
│   ├── errors.ts            # Phase3Failure["phase"] union gains "workflows"
│   ├── notify.ts            # REASONS tail + PluginUninstalledMessage.reasons + 2 render arms
│   └── notify-reasons.ts    # the new token needs a home in one topic group
docs/output-catalog.md       # new catalog state(s) under the affected H2 sections
tests/live-uat/workflow-storage-canary.mjs  # WR-10 removal assertions
```

---

### Pattern 1 — `cascadeUnstagePlugin`: the sixth unstage (WLIF-03 / WLIF-05, CR-02)

**Current state (verbatim).** The `dropped` accumulator and the `UnstageOutcome` shape both
enumerate exactly five axes [VERIFIED: `orchestrators/marketplace/shared.ts:302-319`]:

```ts
export interface UnstageOutcome {
  /** True when all FIVE bridges' unstage* calls returned cleanly. */
  readonly ok: boolean;
  /**
   * Names actually removed across all five bridges. Empty when nothing was
   * staged. LIFE-01 / D-63-01: `hooks` lands between `agents` and
   * `mcpServers` (declaration order matches cascade order).
   */
  readonly dropped: {
    readonly skills: readonly string[];
    readonly commands: readonly string[];
    readonly agents: readonly string[];
    readonly hooks: readonly string[];
    readonly mcpServers: readonly string[];
  };
  /** Set on failure: the FIRST throw, wrapped to Error if needed (D-03 fail-fast). */
  readonly cause?: Error;
}
```

**What to change.** Add `workflows: readonly string[]` to `dropped` (append at the tail, so
declaration order still matches cascade order), add the axis to the local mutable `dropped`
literal at `shared.ts:340-346`, add the sixth call after the mcp call at `shared.ts:391-396`,
and add `workflows: Object.freeze([...dropped.workflows])` to **both** `Object.freeze`
returns (`shared.ts:398-407` success, `shared.ts:409-419` catch).

The sixth call reads the recorded inventory off the same param the other five use:

```ts
// WLIF-03: the 6th cascade slot. Workflow envelopes live OUTSIDE every scope
// root, so `installedPlugin.resources.workflows` is the only inventory that
// names them -- once `removePluginRecord` runs, nothing can find them again.
const workflowsResult = await unstagePluginWorkflows({
  locations,
  previousWorkflowNames: installedPlugin.resources.workflows,
});
dropped.workflows = [...workflowsResult.removedNames];
```

**Ordering.** Place it **after** `mcp`, mirroring `install.ts`'s ledger, whose own comment
states the reason [VERIFIED: `orchestrators/plugin/install.ts:1297-1300`]: *"workflows is
APPENDED after mcp rather than inserted, so the five proven materialize orderings ahead of
it stay byte-unchanged. The sequence is [skills, commands, agents, hooks, mcp, workflows,
state]."* Placing it earlier would reorder four existing cascade slots for no benefit.

**Doc comments that become false in this change** — the locked decision requires all of them
corrected in the same commit:

| File:line | Current text | Status |
|-----------|--------------|--------|
| `orchestrators/marketplace/shared.ts:295` | `result of one plugin's cascade through the 4 bridges` | Already stale (says 4, is 5) — fix to 6 |
| `orchestrators/marketplace/shared.ts:303` | `True when all FIVE bridges' unstage* calls returned cleanly.` | Becomes false |
| `orchestrators/marketplace/shared.ts:306` | `Names actually removed across all five bridges.` | Becomes false |
| `orchestrators/marketplace/shared.ts:322-323` | `PU-1 order (skills → commands → agents → MCP)` | Already stale (omits hooks) — fix to the 6-slot order |
| `orchestrators/plugin/enable-disable.ts:365-367` | `artifact removal stays symmetric across all five kinds -- the cascade above physically unstages hooks via removeHookConfig alongside skills, commands, agents and mcp` | Becomes false |
| `persistence/state-io.ts:149` | `the disable cascade still unstages every artifact of all five kinds (ENBL-13 / D-100-04)` | Becomes false |
| `orchestrators/plugin/reinstall.ts:1740-1745` | `previousWorkflows is carried forward VERBATIM … because this path re-materializes five kinds and leaves workflow envelopes untouched` | Becomes false once WLIF-04 lands — delete or rewrite, do not leave |
| `orchestrators/plugin/uninstall.ts:434-435` | `PU-1 ordering enforced INSIDE cascadeUnstagePlugin (D-03: skills -> commands -> agents -> mcp)` | Already stale — fix |
| `orchestrators/plugin/uninstall.ts:450-454` | the field-name mapping note (`dropped.commands` → `resources.prompts`) | Still true; extend to name the workflows axis (name-identical) |
| `tests/orchestrators/plugin/enable-disable.test.ts:501-502` | `artifact removal stays symmetric across all five kinds` | Test comment — becomes false |
| `tests/live-uat/README.md:32` | `reconstructs the component inventory across all five kinds` | Doc — becomes false |

`orchestrators/plugin/install.ts:246` (`intersecting all five`) is a **false positive**: it
refers to degradation signals on the outcome type, not to bridges. Leave it alone.

**Blast radius of the sixth `dropped` key.** `applyPartialCascadeFold`
(`orchestrators/plugin/shared.ts:855-890`) declares its `dropped` param as a five-key literal
and its `installed.resources` param as a five-key literal. Both need the workflows axis, and
the filter body needs the matching line. Three production consumers read `dropped`:
`uninstall.ts:467`, `enable-disable.ts:343`, `remove.ts:384`. Tests that `deepEqual` the
whole `dropped` object will fail until updated — `tests/orchestrators/marketplace/cascade.test.ts:76`
is a full five-key `deepEqual`; `uninstall.test.ts` and `remove.test.ts` construct
`typeof cascadeUnstagePlugin` stubs returning the object literal (24 + 33 + 14 `dropped`
occurrences across the three files). Expect roughly a dozen stub literals to need a
`workflows: []` line; each is a compile error, not a silent pass, because the stubs are
typed `typeof cascadeUnstagePlugin`.

### Pattern 2 — the structured unstage failure

`unstagePluginWorkflows` today **throws** on any non-ENOENT error and returns a frozen empty
`warnings` array [VERIFIED: `bridges/workflows/unstage.ts:29-45`]. The `AgentsUnstageFailureError`
precedent works differently: the agents bridge *returns* `result.failed[]` and the **cascade**
converts a non-empty `failed` into the typed throw [VERIFIED: `orchestrators/marketplace/shared.ts:368-383`;
the class is at `shared.ts:57-64`, carrying `readonly failedAgents: readonly UnstageAgentFailure[]`].

Two shapes satisfy the locked decision; the planner picks one:

- **(A) Follow the precedent literally.** Change `unstagePluginWorkflows` to accumulate
  `failed: { name, reason }[]` instead of throwing, and have the cascade construct a
  `WorkflowsUnstageFailureError(message, failed)` when `failed.length > 0`. Cost: the
  bridge's return type widens, and the *install ledger's undo* (`install.ts:1191-1194`) becomes
  a caller that must decide what to do with a non-empty `failed` (today a throw there is
  already handled by the ledger's `RollbackPartial` capture).
- **(B) Keep the throw, wrap at the cascade.** Catch around the sixth call and rethrow as
  `WorkflowsUnstageFailureError` carrying the offending name and the cause. Cost: less
  faithful to the precedent, but a smaller change and it preserves fail-fast per name.

**Recommendation: (A).** The decision names the precedent explicitly, and (A) is the only
shape that lets `dropped.workflows` report *partial* progress before the failure — which is
exactly what `applyPartialCascadeFold` exists to consume. Under (B) the outer catch already
returns `dropped` accumulated so far, so partial reporting survives either way, but (A) also
gives per-name reasons the way the agents arm does.

Either way the class belongs beside its precedent in `orchestrators/marketplace/shared.ts`,
follows the house error convention (`extends Error`, `this.name = "…"` in the constructor,
readonly typed public fields, doc comment citing `WLIF-03`), and must be exported from
`orchestrators/marketplace/index.ts` if any consumer narrows on it — note `uninstall.ts:459`
narrows on `AgentsUnstageFailureError` with a **carve-out that preserves the record**
(`throw cause` aborts the save). Decide deliberately whether a workflows unstage failure gets
that same carve-out or the partial-fold path; the leftover here is executable code, which
argues for the *partial-fold* path (persist the shrunken inventory so a retry knows what is
still out there) rather than the abort-save path.

### Pattern 3 — WR-06 ownership pre-check: the actual precedent

The review points at `shared/fs-utils.ts:82-99`, but that is a **doc comment** describing the
contract, not the check. The real check lives in each bridge's `replacePrepared*` rename
loop. Verbatim, the commands bridge [VERIFIED: `bridges/commands/stage.ts:405-424`]:

```ts
    // TR-06: 3-arm policy at the rename loop. ownedNames is the basename
    // membership set derived from state.json (via _previousNames). When a
    // pre-existing target shares an owned basename, it is treated as an
    // orphan from a prior partial install and pre-removed via the
    // kind-strict helper. Foreign content (basename NOT in ownedNames)
    // still triggers the existing PI-6 "non-previous content" rejection
    // verbatim. Command targets are .md files -> mode "file".
    const ownedNames = new Set<string>(prepared._previousNames);
    await mkdir(prepared.locations.promptsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      const targetName = path.basename(pair.to, ".md");
      if (ownedNames.has(targetName)) {
        await removeOrphanIfPresent(pair.to, "file");
      } else if (await pathExists(pair.to)) {
        throw new Error(`Cannot replace command target with non-previous content at ${pair.to}`);
      }

      await rename(pair.from, pair.to);
      renamed.push(pair);
    }
```

Identical three-arm shape in `bridges/skills/stage.ts:463-472` (`"tree"` mode, `Cannot replace
skill target with non-previous content`) and `bridges/agents/stage.ts:487-496` (`Cannot replace
agent target with non-previous content`). All three are pinned by tests asserting
`/non-previous content/` [VERIFIED: `tests/bridges/commands/stage.test.ts:394`,
`tests/bridges/skills/stage.test.ts:472`, `tests/bridges/agents/stage.test.ts:1097-1126`].

**The workflows analog is simpler than the precedent, and the planner should exploit that.**
`commitPreparedWorkflows` already renames every `_previousNames` target aside into
`<stagingRoot>/.previous/` **before** the rename loop runs
[VERIFIED: `bridges/workflows/stage.ts:300-311` — `displaced = await displacePreviousTargets(prepared);`
precedes `for (const pair of prepared._renamePairs)`]. After displacement, any file still
sitting at a target path is **by construction** not one this plugin owns. So the owned/orphan
arm collapses and the check reduces to:

```ts
    for (const pair of prepared._renamePairs) {
      // WR-06 / PI-6: displacePreviousTargets has already moved every owned
      // target aside, so anything still here belongs to the user's own saved
      // workflows or to another plugin. The saved directory is shared and the
      // `<plugin>:` prefix is the only namespacing there is.
      if (await pathExists(pair.to)) {
        throw new Error(`Cannot replace workflow target with non-previous content at ${pair.to}`);
      }

      await rename(pair.from, pair.to);
      completedRenames.push(pair);
    }
```

`pathExists` must be added to the existing `shared/fs-utils.ts` import in `stage.ts` (which
currently imports only `cleanupStaging` [VERIFIED: `bridges/workflows/stage.ts:53`]).

**Why the ordering constraint in REQUIREMENTS.md is real and why it is now satisfied.** With
`previousWorkflowNames` never supplied, `_previousNames` is always `[]`, `displacePreviousTargets`
short-circuits at `stage.ts:238-240`, and every `enable` re-materialization of a plugin's own
envelope would hit an existing target and be refused. Wiring WR-01 in the same change is what
makes the refusal correct. **Additional nuance worth pinning in a test:** after a *successful*
disable the envelopes are already gone (the cascade removed them), so at enable time the
displacement is a pure ENOENT no-op and the refusal never fires. After a *failed* disable the
partial fold has shrunk `resources.workflows` to only what was removed — meaning a surviving
envelope is no longer named in the record and the WR-06 refusal **would** fire on the next
enable. That is arguably correct (refuse rather than clobber) but it is a behavior the planner
should decide about consciously and cover with a test, not discover in production.

### Pattern 4 — WR-01: previous names at the install ledger (WLIF-05, enable)

The workflows phase currently calls `prepareStageWorkflows` with three fields and no previous
names [VERIFIED: `orchestrators/plugin/install.ts:1161-1165`]:

```ts
      const prep = await prepareStageWorkflows({
        locations: c.locations,
        pluginName: c.plugin,
        resolved: c.resolved,
      });
```

`InstallCtx` already carries `readonly stateSnapshot: ExtensionState`
[VERIFIED: `orchestrators/plugin/install.ts:431`, assigned at `install.ts:936`], and the state
phase reads the pre-existing record off it the same way
[VERIFIED: `install.ts:1214-1215` — `const mpInner = c.stateSnapshot.marketplaces[c.marketplace];`
`const existing = mpInner?.plugins[c.plugin];`]. So the wiring is:

```ts
      // WR-01 / WLIF-05: the recorded inventory is the previous-name list. A
      // fresh install has no record, so this is `undefined` and the re-stage
      // branch stays inert -- exactly the no-op the fresh path had before.
      // The `enable` path (allowExistingRecord) reaches the KEPT disabled
      // record here, which is the only thing that names what the disable
      // removed.
      const previous =
        c.stateSnapshot.marketplaces[c.marketplace]?.plugins[c.plugin]?.resources.workflows;
      const prep = await prepareStageWorkflows({
        locations: c.locations,
        pluginName: c.plugin,
        resolved: c.resolved,
        ...(previous !== undefined && { previousWorkflowNames: previous }),
      });
```

The conditional spread is required, not stylistic: `tsconfig` sets
`exactOptionalPropertyTypes`, so assigning `undefined` to the optional
`previousWorkflowNames?: readonly string[]` [VERIFIED: `bridges/workflows/types.ts:95`] is a
compile error.

**`allowExistingRecord` and the WR-06 ownership check — what the flag actually means.**
`allowExistingRecord` is a `runInstallLedger` option [VERIFIED: `install.ts:504`] whose sole
effect is to suppress the `ConcurrentInstallError` "already installed" throw at two guard
sites [VERIFIED: `install.ts:768-771` early sanity check, and `install.ts:1211-1218` inside the
state phase]. It does **not** gate any bridge behavior. The enable branch sets it because
"the disabled record is deliberately KEPT per ENBL-02"
[VERIFIED: `orchestrators/plugin/enable-disable.ts:200-212`, `:261`]. For WR-06 this matters in
one way only: `allowExistingRecord === true` is the signal that a record *exists*, and it is
exactly the case where `previous` is non-`undefined` and therefore the case where the WR-06
refusal is correctly suppressed for this plugin's own names. No new flag is needed; reading
the snapshot is sufficient and is what the review's own suggested fix does.

**`c.stagedWorkflowNames` stays the undo payload, not the previous list.** The undo removes
what *this* run staged [VERIFIED: `install.ts:1191-1194`], and Phase 103's CR-01 fix assigns it
*before* the commit [VERIFIED: `install.ts:1170-1172`]. Do not repoint the undo at `previous`:
after a successful commit the displaced previous envelopes are already discarded by staging
cleanup, so removing them again is a no-op at best, and removing them when the commit
succeeded but a later phase failed would be *wrong* — the ledger's job is to undo this run.

### Pattern 5 — `update.ts`: four insertion sites (WLIF-02, CR-03)

`update` is a hand-rolled swap. The insertion points, in execution order:

**(1) Prepare.** `prepareUpdateHandles` builds a `Partial<PrepHandles>` and assigns four
bridge handles in a single try [VERIFIED: `orchestrators/plugin/update.ts:1182-1245`]. The
previous-name source is already in scope: the function destructures
`const { installable, record } = preflight;` at `update.ts:1188` and the sibling bridges read
`previousSkillNames: record.resources.skills` (`:1200`) and
`previousCommandNames: record.resources.prompts` (`:1211`). Add after the `mcp` assignment at
`:1230-1239`:

```ts
    handles.workflows = await prepareStageWorkflows({
      locations,
      pluginName: plugin,
      resolved: installable,
      // CR-03 / WLIF-02: the recorded inventory names what version A wrote.
      // Deriving it from version B would leave a removed or renamed workflow
      // running under its old name with nothing tracking it.
      previousWorkflowNames: record.resources.workflows,
    });
```

`PrepHandles` is declared at `update.ts:722` and gains a `workflows: PreparedWorkflowsStaging`
member. Note the prepare order in this function is skills → commands → agents → **mcp** with
no hooks slot (hooks has no staging dir), so appending workflows after mcp keeps prepare order
aligned with commit order.

**(2) Both abort helpers.** `abortPartialHandles` (`update.ts:1247-1266`) and `abortHandles`
(`update.ts:1268-1274`) unwind in **reverse** order (mcp → agents → commands → skills). Workflows
must be aborted **first** in both, and `abortPreparedWorkflows` returns `string | undefined`
(a cleanup-leak message) so it belongs in the `leaks.push(...)` pattern the agents arm uses.

**(3) Phase 3a commit.** The commit sequence runs skills → commands → agents → hooks → mcp,
each in its own try, pushing a `Phase3Failure` on throw and **continuing**
[VERIFIED: `update.ts:1924-2011`]. The skills and agents arms additionally convert a non-`undefined`
staging-cleanup leak into a `Phase3Failure` — `commitPreparedWorkflows` returns exactly that
shape (`Promise<string | undefined>`, `undefined` on success) [VERIFIED: `bridges/workflows/stage.ts:290-292, 344`],
so the workflows arm should copy the **skills** arm's two-branch shape verbatim:

```ts
  try {
    const leak = await commitPreparedWorkflows(handles.workflows);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "workflows",
        msg: `workflows staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "workflows", msg: errorMessage(err), cause: err });
  }
```

Place it after the mcp arm at `update.ts:2007-2011`, mirroring install's append-after-mcp.

**(4) The closed phase union — the symmetry guard.** `"workflows"` must join **two** places or
the code will not compile:

- `shared/errors.ts:323-327` [VERIFIED, verbatim]:
  ```ts
  export interface Phase3Failure {
    readonly phase: "skills" | "commands" | "agents" | "hooks" | "mcp";
    readonly msg: string;
    readonly cause: unknown;
  }
  ```
- `orchestrators/plugin/update.ts:1301-1302` [VERIFIED, verbatim]:
  ```ts
  const PHASE3_FAILURE_PHASES = ["skills", "commands", "agents", "hooks", "mcp"] as const;
  type Phase3Phase = (typeof PHASE3_FAILURE_PHASES)[number];
  ```
  and its comment at `:1289-1290` says *"A future fifth bridge surfaces here as a TS error."* —
  reword to sixth.

**(5) Inventory reassignment — the exact site CR-03 names.** `finalizeUpdateRecord` writes each
inventory under an independent `failedPhases.has(...)` guard
[VERIFIED: `orchestrators/plugin/update.ts:1717-1761`]. The five existing reassignments are, verbatim:

```ts
    if (!failedPhases.has("skills")) {
      sRecord.resources.skills = handles.skills.result.recorded.map((r) => r.generatedName);
    }

    if (!failedPhases.has("commands")) {
      sRecord.resources.prompts = handles.commands.result.recorded.map((r) => r.generatedName);
    }

    if (!failedPhases.has("agents")) {
      sRecord.resources.agents = handles.agents.result.recorded.map((r) => r.generatedName);
    }

    if (!failedPhases.has("mcp")) {
      sRecord.resources.mcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
    }
```

`.workflows` is never touched — that is CR-03's finding, confirmed. The sixth guard goes after
the `hooks` block (`:1749-1761`), and note the **shape asymmetry**: the workflows handle exposes
`result.stagedNames` (already generated names), not `result.recorded[].generatedName`
[VERIFIED: `bridges/workflows/types.ts:99-102` — `readonly stagedNames: readonly string[]`]:

```ts
    if (!failedPhases.has("workflows")) {
      sRecord.resources.workflows = [...handles.workflows.result.stagedNames];
    }
```

**Cognitive-complexity note:** the enclosing closure already carries
`// eslint-disable-next-line sonarjs/cognitive-complexity` at `update.ts:1699` with a comment
explaining that the per-bridge orthogonality is deliberately flat. A sixth guard arm is
consistent with that; no restructuring needed.

**Warnings channel.** `collectDegradedKinds(handles)` is at `update.ts:2230`; check whether the
update path also aggregates `handles.*.result.warnings` and, if so, add the workflows arm —
`prepareStageWorkflows` puts the WBRG-03 soft-fail warnings on `result.warnings`
[VERIFIED: `bridges/workflows/types.ts:101`, populated at `stage.ts:204`]. Dropping them means an
unreadable script goes silent on `update` while it is reported on `install`.

### Pattern 6 — `reinstall.ts`: the one real design choice (WLIF-04)

Reinstall's handle set is a **four**-member interface with a parallel partial type and a
four-arm replacement union [VERIFIED: `orchestrators/plugin/reinstall.ts:238-256`, verbatim]:

```ts
interface PreparedHandles {
  readonly skills: PreparedSkillsStaging;
  readonly commands: PreparedCommandsStaging;
  readonly agents: PreparedAgentsStaging;
  readonly mcp: PreparedMcpStaging;
}

interface PartialPreparedHandles {
  skills?: PreparedSkillsStaging;
  commands?: PreparedCommandsStaging;
  agents?: PreparedAgentsStaging;
  mcp?: PreparedMcpStaging;
}

type ReplacementEntry =
  | { readonly phase: "skills"; readonly handle: SkillsReplacement }
  | { readonly phase: "commands"; readonly handle: CommandsReplacement }
  | { readonly phase: "agents"; readonly handle: AgentsReplacement }
  | { readonly phase: "mcp"; readonly handle: McpReplacement };
```

`replaceAll` pushes each replacement onto a ledger and, on throw, calls
`rollbackReplacements(replacements)` then `abortHandles(handles)`
[VERIFIED: `reinstall.ts:1593-1638`]; on success the caller calls `finalizeReplacements`
[VERIFIED: `reinstall.ts:1327`]. `rollbackReplacement` and `finalizeReplacement` are exhaustive
switches over the four arms [VERIFIED: `reinstall.ts:1883-1894`, `:1913-1924`].

**The design choice.** The workflows bridge has no `replacePreparedWorkflows` /
`rollbackWorkflowsReplacement` / `finalizeWorkflowsReplacement` triple. It has
prepare/commit/abort, and `commitPreparedWorkflows` performs its own displacement AND its own
staging cleanup on the success path [VERIFIED: `bridges/workflows/stage.ts:344` — the success
return is `cleanupStaging(prepared.stagingRoot, STAGING_LABEL)`], which **destroys the displaced
previous envelopes**. So once the workflows commit returns successfully there is nothing left to
roll back to.

Two options:

- **(A) Treat workflows like `hooks` — commit in place, do not push onto `replacements[]`.**
  There is an explicit in-file precedent with a written rationale
  [VERIFIED: `reinstall.ts:1607-1629` — *"NOT pushed onto `replacements[]` -- the hooks file STAYS
  IN PLACE on a later-step failure (recovery is via the reinstall hint, not in-process
  rollback, mirroring update.ts D-03 semantics)"*, and *"the … window is a known manual-recovery
  case"*]. Zero bridge change; `ReplacementEntry` stays a four-arm union; the cost is that a
  failure in a step *after* the workflows commit leaves version-B envelopes with a version-A
  record, recoverable only by re-running reinstall.
- **(B) Add the full replace/rollback/finalize triple to the bridge**, mirroring
  `replacePreparedCommands` — defer staging cleanup to `finalize`, keep the displaced envelopes
  until then, and reverse both lists in `rollback`. Cost: a fifth arm in three exhaustive
  switches, a new bridge surface, and a second commit path in `stage.ts` that must not diverge
  from the first.

**Recommendation: (A).** It matches the precedent the file already documents, and the residual
window is genuinely small — under option (A) the workflows commit is placed **last** in
`replaceAll` (after mcp, mirroring install), so the only step that can fail after it is the
state save, whose failure already routes through `errorWithManualRecovery`. Record the choice
as a decision with the same explicit comment shape the hooks slot uses, so the next reader does
not read the absence as an oversight.

**Whichever option is chosen, these five sites change:**

1. `PreparedHandles` + `PartialPreparedHandles` gain `workflows` (option A can still carry the
   handle here — it is a prepare handle, independent of the replacement ledger).
2. `prepareAllHandles` (`reinstall.ts:1518-1579`) gains the prepare call, passing
   `previousWorkflowNames: input.oldRecord.resources.workflows` — the `oldRecord` is already a
   parameter and is already read for `previousSkillNames` / `previousCommandNames`
   [VERIFIED: `reinstall.ts:1537`, `:1548`].
3. `abortPartialHandles` (`reinstall.ts:1841-1860`) gains the workflows abort **first** (reverse
   order), pushing its leak through `pushLeak`.
4. `collectStagingWarnings` (`reinstall.ts:1832-1839`) gains
   `...handles.workflows.result.warnings` — otherwise WBRG-03 soft-fails vanish on reinstall.
5. **`resourcesFromHandles` loses its `previousWorkflows` parameter.** Verbatim today
   [VERIFIED: `reinstall.ts:1739-1770`]:

   ```ts
   /**
    * WLIF-01: `previousWorkflows` is carried forward VERBATIM rather than derived
    * from the handles, because this path re-materializes five kinds and leaves
    * workflow envelopes untouched. Recording `[]` for a plugin whose envelopes are
    * still on disk would orphan them: they live in the host engine's storage root,
    * outside every scope root, so this array is the only thing that knows they
    * exist.
    */
   function resourcesFromHandles(
     handles: PreparedHandles,
     previousWorkflows: readonly string[],
     plugin?: string,
     installable?: MaterializablePlugin,
   ): PluginRecord["resources"] {
     …
     workflows: [...previousWorkflows],
   }
   ```

   Once reinstall actually re-stages, the carry-forward is wrong: it would record version A's
   names over version B's artifacts. Replace the body with
   `workflows: [...handles.workflows.result.stagedNames]` and **drop the parameter**, which
   forces both call sites to be revisited by the compiler:
   `reinstall.ts:1728` (`updateStateRecord`, 4 args) and `reinstall.ts:1779` (`successOutcome`,
   2 args). Delete the now-false doc comment rather than editing around it.

   `clonePluginRecord` (`reinstall.ts:2053-2089`) keeps its verbatim `workflows: [...record.resources.workflows]`
   clone — it snapshots the OLD record and is still correct.

### Pattern 7 — `disable` inherits, `enable` inherits (WLIF-05)

**disable** needs no new call: `runDisableBranch` calls `cascadeUnstagePlugin`
[VERIFIED: `orchestrators/plugin/enable-disable.ts:336`] and the sixth slot arrives with it. Two
things to verify in test rather than assume:

- On the **success** arm the record's `resources` is preserved wholesale — `toDisabledRecord`
  passes `resources: R` straight through [VERIFIED: `enable-disable.ts:374-379`, and the type-level
  guarantee at `persistence/state-io.ts:143-157`]. So `resources.workflows` survives a disable
  and is exactly what `enable` reads back. That is the mechanism that makes WR-01's snapshot read
  work for enable.
- On the **failure** arm `applyPartialCascadeFold(installed, cascade.dropped)` runs
  [VERIFIED: `enable-disable.ts:343`], so the fold must carry the workflows axis or a partially
  removed envelope stays named in the record while its file is gone (or vice versa).

**enable** needs no new call either: `runEnableBranch` invokes the guard-free
`runInstallLedger` [VERIFIED: `enable-disable.ts:251-265`], and Pattern 4's snapshot read is what
delivers the previous names. The lock re-entrancy constraint is why: `proper-lockfile` is
`retries: 0` and not re-entrant, so `installPlugin` must never be called here
[VERIFIED: `enable-disable.ts:207-211`].

### Pattern 8 — WLIF-06 message plumbing

**The obstacle: `(uninstalled)` is a reasons-LESS variant.** Verbatim
[VERIFIED: `shared/notify.ts:735-745`]:

```ts
/**
 * `(uninstalled)` -- single-shot uninstall or cascade uninstall row. NO
 * `dependencies` (MSG-SD-3 forbids the soft-dep marker on uninstalled
 * rows); no `reasons`.
 */
export interface PluginUninstalledMessage extends TransitionMessageBase {
  readonly status: "uninstalled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
}
```

Both render sites hard-code `undefined`:

- central switch [VERIFIED: `shared/notify.ts:2309-2317`]: `composeReasons(undefined, false, false, probe)`
- uninstall's own render map [VERIFIED: `orchestrators/plugin/uninstall.messaging.ts:54-62`]:
  same call.

And the module doc counts the split [VERIFIED: `shared/notify.ts:2094-2103`]: *"9 reasons-less
variants (updated, uninstalled, available, remote, disabled, will install, will uninstall, will
enable, will disable)"* vs *"10 reasons-bearing variants"*. Both numbers move, and the
`updated` / `disabled` entries in that list are already stale (`PluginUpdatedMessage.reasons` and
`PluginDisabledMessage.reasons` both exist and are optional) — worth correcting while there.

**Precedent for widening.** `PluginInstalledMessage`, `PluginUpdatedMessage`,
`PluginReinstalledMessage` and `PluginDisabledMessage` all carry `readonly reasons?: readonly
ContentReason[]` with the same stated rationale [VERIFIED: `notify.ts:705-713`, `:726-733`,
`:765-777`]: *"Absent `reasons` renders the legacy brace-less row byte-for-byte: `composeReasons`
returns `""` for an undefined list and `joinTokens` collapses the empty slot."* Adding the
optional field to `PluginUninstalledMessage` is therefore byte-neutral for every existing
fixture — the only bytes that move are on rows that actually stamp the token.

**The severity byte hazard — this is the non-obvious one.** The locked decision says severity
is `warning`. `notify()` reduces the max stamped row severity [VERIFIED: `notify.ts:2587-2608`
`cascadeSeverity`] and then *prepends a summary line* whose wording is derived from the
`warning`-severity **row count**, not from status tokens [VERIFIED: `notify.ts:2692-2704`
`countSkippedOperations`/`countSkippedRows` count `severity === "warning"` rows; `notify.ts:2778-2794`
`buildSummaryLineForCascade`; `notify.ts:2748-2766` `summaryPhrase` produces
`A plugin operation needs attention.` for one warning row]. So a warning-severity
`(uninstalled)` row emits:

```text
A plugin operation needs attention.

● official [user]
  ○ helper v1.0.0 (uninstalled) {<new token>}

/reload to pick up changes
```

That is a **new catalog state**, not an edit of the existing `success` block at
`docs/output-catalog.md:615-622`. Do not touch that block; add a sibling under the same H2.

**The catalog byte-equality gate, mechanically.** `tests/architecture/catalog-uat.test.ts` reads
`docs/output-catalog.md` at test time and pairs a `<!-- catalog-state: STATE -->` HTML comment
with the body of the **next fenced block**, scoped to the enclosing per-command H2
[VERIFIED: `catalog-uat.test.ts:77-154`]. The H2 must match
`/^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors|reconcile-applied-cascade)\s*$/` and the
state must match `/^<!-- catalog-state: ([a-z0-9-]+) -->\s*$/` — **lowercase, digits and hyphens
only**. Each `(section, state)` tuple needs a matching entry in the `FIXTURES` map
(`Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>`, `catalog-uat.test.ts:217`),
carrying `{ message, pi, expectedSeverity? }`; set `expectedSeverity: "warning"` for the new
state. The driver calls `notify(mockCtx, mockPi, message)` and asserts byte equality. So the
catalog row and the fixture land in the same commit or the suite goes red — that IS the gate.

**The closed-set amendments, in order:**

1. `shared/notify.ts` `REASONS` — append at the **tail**. The tuple's doc is explicit
   [VERIFIED: `notify.ts:79-81`]: *"this tuple is the byte-source of the closed set -- its
   37-entry membership AND order are catalog-stable and MUST NOT change (new tokens append at the
   tail; existing entries never reorder)"*. The tail today is `"malformed command"`
   [VERIFIED: `notify.ts:174`]. (The "37" in that comment is itself stale — the set is 38.)
2. `shared/notify-reasons.ts` — the new literal needs a home, or the compile-time proof breaks.
   `_ReasonsCoverageProof` resolves two `Exclude` expressions to `never` and a non-`never`
   result is a TS2344 error [VERIFIED: `notify-reasons.ts:216-228`]. The candidate homes are
   `IDEMPOTENT_REASONS`, `UNSUPPORTED_REASONS`, `FAILURE_REASONS`, or the
   `CommandPrivateReason` union (`notify-reasons.ts:207-214`). **Recommendation:** the token is
   not idempotent, not a failure, and not an unsupported-component marker — it is a
   command-private fact about a host limitation, shared by uninstall/disable/update. Either
   extend `CommandPrivateReason` or introduce a fourth topic group; extending the private union
   is the smaller change and matches `"orphan rewake"`, which is the closest analog (a
   `(installed)`-row advisory owned by one command). Also update the module header's stale
   "38-entry" sentences at `notify-reasons.ts:8` and `:13-20` — that header already carries a
   note about the last count bump, so follow its shape.
3. `tests/architecture/compat-01-no-expansion.test.ts:126-171` — the hand-written
   enumeration+order pin. Append the literal to the expected array's tail. Its message is
   explicit that a new token *"appends at the tail and arrives with its catalog row, renderer
   arm, and fixture in the same change"* [VERIFIED: `compat-01-no-expansion.test.ts:169`].
4. `tests/architecture/notify-closed-set-locks.test.ts:29,37` — `assert.equal(REASONS.length, 38)`
   becomes 39, and the test title *"OUT-08: REASONS is the closed 38-entry reason set"* moves
   with it.

**The Phase 105 coordination hazard, named concretely.** WDEP-04 will add its own token to the
same tail of the same tuple and its own row to the same catalog. Four artifacts are
append-ordered and will conflict textually if both phases edit them independently:

| Artifact | Conflict shape |
|----------|----------------|
| `shared/notify.ts` `REASONS` tail (currently ends `"malformed command"`) | Two appends at the same anchor → textual conflict; **order matters**, because `compat-01` pins order |
| `shared/notify-reasons.ts` topic group + header count sentence | Two edits to the same count sentence |
| `tests/architecture/compat-01-no-expansion.test.ts` expected array tail | Same anchor, order-sensitive |
| `tests/architecture/notify-closed-set-locks.test.ts` length pin (38 → 39 → 40) | Both phases bump the same integer |

**Mitigation:** Phase 104 lands first and lands *whole* (token, topic-group home, both gate
pins, catalog row, fixture) in one commit. Phase 105's plan then reads the post-104 tail as its
starting point. Record `39` as the count Phase 105 must start from. Do **not** try to
pre-reserve a slot for WDEP-04 in this phase — an unused `REASONS` member fails the
`_ReasonsCoverageProof` only if unhomed, but it *would* pass the gates while being unreachable,
which is exactly the kind of dead closed-set member that led to WR-01.

**Which surfaces stamp the token — the one genuinely open scoping question.** The requirement
text says "when a removed workflow's command lingers", which is true for four verbs. See
Open Questions #1 for the recommendation and its blast radius.

**Message wording.** The engine already emits its own degradation notice at invocation:
*"not available -- reload the session to drop the stale command"*
[CITED: `.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md`,
Constraints → "Registration and reload"]. Our token should state the remedy without
duplicating or contradicting that sentence, and must state the host limitation as a limitation
per the locked decision. The token is a closed-set brace token, so it is short by construction;
any longer prose belongs in the section's catalog paragraph, not in the row.

### Pattern 9 — WR-10: the live canary assertion window

`teardown` runs the two uninstalls and then `rm -rf`s every sandbox directory *including the
sandbox HOME* — which is where the engine's storage root lives [VERIFIED:
`tests/live-uat/workflow-storage-canary.mjs:472-485`, verbatim]:

```js
async function teardown(ext, dirs) {
  if (ext !== undefined) {
    await ext.quiet(`uninstall ${USER_PLUGIN}@${MARKETPLACE_NAME} --scope user`);
    await ext.quiet(`uninstall ${PROJECT_PLUGIN}@${MARKETPLACE_NAME} --scope project`);
    await ext.quiet(`marketplace remove ${MARKETPLACE_NAME} --scope user`);
    await ext.quiet(`marketplace remove ${MARKETPLACE_NAME} --scope project`);
  }

  for (const dir of dirs) {
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
```

`teardown` is invoked from `main`'s `finally` [VERIFIED: `canary.mjs:582-584`:
`} finally { await teardown(ext, [marketplaceRoot, workDir, otherDir, home]); }`].

**Do not put the assertion inside `teardown`.** `fail()` throws `UatExit`
[VERIFIED: `canary.mjs:85-92`], and throwing from a `finally` **replaces** any in-flight primary
error, so a genuine earlier failure would be masked by the teardown assertion and the operator
would debug the wrong thing.

**Recommended shape.** Add a third numbered section in `main`'s `try`, after the `X` project-key
assertion at `canary.mjs:581` and before the `finally`:

```js
    console.log(`\n[workflow-storage] === Removal ===`);
    await ext.run(`uninstall ${USER_PLUGIN}@${MARKETPLACE_NAME} --scope user`);
    await ext.run(`uninstall ${PROJECT_PLUGIN}@${MARKETPLACE_NAME} --scope project`);

    // WR-10 / WLIF-03: assert BEFORE the sandbox is removed. The teardown rm
    // deletes the engine's storage root, so an assertion after it can only
    // ever pass.
    for (const [id, plugin, cwd] of [
      ["R1", USER_PLUGIN, otherDir],
      ["R2", PROJECT_PLUGIN, workDir],
    ]) {
      const left = makeStorage(engine, cwd).list().filter((w) => w.name.startsWith(`${plugin}:`));
      if (left.length > 0) {
        fail(
          id,
          `uninstall left ${left.length} envelope(s) behind; nothing else can ever find them.`,
          left.map((w) => `${w.name} -> ${w.path}`).join("\n"),
        );
      }

      pass(`${id}: uninstall left no "${plugin}:" envelope in the engine's storage`);
    }
```

`teardown`'s own uninstall calls then become idempotent no-ops (`ext.quiet` already swallows the
`(failed) {not installed}` row), so `teardown` needs no change at all. `makeStorage`, `engine`,
`otherDir` and `workDir` are all in scope at that point [VERIFIED: `canary.mjs:497-563`].

**Both scopes, per the locked decision.** The user half is listed from `otherDir` and the
project half from `workDir`, exactly as `proveScope` does — the project key derivation is what
makes the project path non-obvious, and reading it from the wrong cwd would produce a
false pass.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Composing a workflow artifact path | `path.join(savedDir, name + ".json")` | `await locations.workflowArtifactPath(name)` | It is the sole composer and runs `assertSafeName` then `assertPathInside`; a second composer is an NFR-10 hole [VERIFIED: `persistence/locations.ts:169-179`, and `bridges/workflows/stage.ts:184-187` states the rule] |
| Existence check before a rename | `fs.existsSync` / bare `stat` | `pathExists` from `shared/fs-utils.ts:59` | lstat-based, does not follow symlinks (PS-1), ENOENT/ENOTDIR → false, every other code → throw |
| Removing an envelope | `unlink` in the orchestrator | `unstagePluginWorkflows` | ENOENT-tolerance and the "only by recorded name, never enumerate the shared directory" rule live in the bridge [VERIFIED: `bridges/workflows/unstage.ts:5-13`] |
| Restoring previous envelopes on a failed commit | A new backup mechanism | `displacePreviousTargets` + the existing rollback block | Already implemented and ordering-correct: displaced envelopes restore **after** the new renames are reversed, because a replaced name has the same target path in both lists [VERIFIED: `bridges/workflows/stage.ts:325-336`] |
| A per-verb removal call | Three call sites | `cascadeUnstagePlugin` | Locked decision; also the only way a future seventh verb inherits the fix |
| Shrinking a record after a partial cascade | Ad-hoc filters | `applyPartialCascadeFold` | One helper, three consumers, already the TR-03 path |
| Deciding a row's severity inside the renderer | Probing state in `notify.ts` | Stamp `severity` at the orchestrator | notify.ts is a dumb renderer; SEV-02 reduces stamped facts and does no content inference [VERIFIED: `notify.ts:2563-2564`, `:2578-2581`] |

**Key insight:** every mechanism this phase needs already exists and is already tested. The
failure mode for this phase is not "built the wrong thing" — it is "wired five of six places and
the sixth stayed silent." Prefer changes that produce **compile errors** on omission (widening a
closed union, dropping a function parameter) over changes that produce silent gaps.

## Common Pitfalls

### Pitfall — Treating `update` as a `runPhases` ledger
**What goes wrong:** The planner writes a task saying "append a sixth `Phase` to `update.ts`'s
array." There is no array; the task is unexecutable and the executor improvises.
**Why it happens:** Both CONTEXT.md and the project skill state it as fact.
**How to avoid:** The update wiring is four sites plus a closed-union amendment (Pattern 5).
**Warning sign:** any task text containing `Phase<UpdateCtx>` or `phases: readonly Phase`.

### Pitfall — Landing WR-06 without WR-01
**What goes wrong:** Every `enable` re-materialization is refused, because with
`_previousNames === []` nothing gets displaced and the plugin's own envelope looks foreign.
**How to avoid:** One task, one commit, both changes. REQUIREMENTS.md states the constraint and
the mechanism is verified above.
**Warning sign:** a plan with separate WR-01 and WR-06 tasks in different waves.

### Pitfall — Adding the sixth `dropped` key without the fold
**What goes wrong:** A partial cascade failure removes some envelopes but
`applyPartialCascadeFold` never subtracts them, so `state.json` keeps naming files that are gone
— and the next uninstall's ENOENT-tolerant unlink silently "succeeds" on all of them, hiding the
inconsistency permanently.
**How to avoid:** `applyPartialCascadeFold`'s two parameter literals and its body change in the
same task as `UnstageOutcome`.
**Warning sign:** `dropped.workflows` populated but `installed.resources.workflows` unfiltered.

### Pitfall — Reinstall records version A's names over version B's artifacts
**What goes wrong:** `resourcesFromHandles` keeps its `previousWorkflows` carry-forward after
reinstall starts re-staging. The record then names envelopes that no longer exist and fails to
name the ones that do — a worse state than the honest-about-stale-disk state Phase 103 chose.
**How to avoid:** Remove the parameter entirely so the compiler flags both call sites.
**Warning sign:** `oldRecord.resources.workflows` still appearing in `reinstall.ts` outside
`clonePluginRecord` and the prepare call.

### Pitfall — Editing the existing uninstall `success` catalog block
**What goes wrong:** The warning-severity summary prefix makes the bytes differ; either the
existing plain-success fixture or the new one goes red, and it is tempting to "fix" the catalog
by loosening a fixture.
**How to avoid:** New `<!-- catalog-state: … -->` sibling under the same H2; the plain-success
block is untouched.
**Warning sign:** a diff touching `docs/output-catalog.md:615-637`.

### Pitfall — Stamping WLIF-06 unconditionally
**What goes wrong:** A plugin that ships no workflows is told about a lingering command it never
had. The locked decision forbids this explicitly.
**How to avoid:** Gate on the actually-removed set: `dropped.workflows.length > 0` for the
cascade verbs; `previousNames \ stagedNames` non-empty for the re-stage verbs. The record's
inventory alone is not sufficient — a record can name workflows the cascade failed to remove.
**Warning sign:** the stamp deriving from `record.resources.workflows.length` rather than from
what removal actually reported.

### Pitfall — Asserting the canary removal inside `teardown`
**What goes wrong:** `fail()` throws from a `finally`, masking a real primary failure and
producing a misleading diagnosis. Also, on an early failure path the uninstalls never ran, so
the assertion fires spuriously.
**How to avoid:** Assert in `main`'s `try`; leave `teardown` idempotent.
**Warning sign:** any `fail(` call reachable from `teardown`.

### Pitfall — Losing the WBRG-03 warnings on update/reinstall
**What goes wrong:** An unreadable or refused script is reported on `install` but silent on
`update` and `reinstall`, because those paths aggregate warnings from a hard-coded list of four
handles.
**How to avoid:** `collectStagingWarnings` (reinstall) and update's warning aggregation both gain
the workflows arm.
**Warning sign:** `handles.workflows.result.warnings` never read.

### Pitfall — Restating the `.json` suffix or the colon rule
**What goes wrong:** A new call site invents `name + ".json"` or sanitizes the `:`. Colon-bearing
basenames are standing policy and the suffix belongs to the composer.
**How to avoid:** never build a workflow filename outside `locations.workflowArtifactPath` and
`stage.ts`'s staged-file join.

## Code Examples

### The frozen-return pattern the sixth axis must join

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:398-407
    return Object.freeze({
      ok: true,
      dropped: Object.freeze({
        skills: Object.freeze([...dropped.skills]),
        commands: Object.freeze([...dropped.commands]),
        agents: Object.freeze([...dropped.agents]),
        hooks: Object.freeze([...dropped.hooks]),
        mcpServers: Object.freeze([...dropped.mcpServers]),
      }),
    });
```

Both the `ok: true` return and the `catch` return (`shared.ts:409-419`) carry the identical
literal. Adding the axis to one and not the other is a compile error only because the interface
is explicit — which is the argument for typing `dropped` as its own named interface rather than
duplicating the literal a third time.

### The commit rename loop that gains the WR-06 refusal

```ts
// Source: extensions/pi-claude-marketplace/bridges/workflows/stage.ts:300-311
  try {
    // Lazy-create: for project scope this creates the `projects/<key>/saved`
    // levels too. The engine's own directory helper does the same, so we are
    // not racing it into an inconsistent state.
    await mkdir(prepared.locations.workflowsSavedDir, { recursive: true });

    displaced = await displacePreviousTargets(prepared);

    for (const pair of prepared._renamePairs) {
      await rename(pair.from, pair.to);
      completedRenames.push(pair);
    }
  } catch (err) {
```

The refusal goes at the top of the `for` body. Note that a throw here already routes into the
existing rollback block, which reverses completed renames and then restores the displaced
envelopes — so the refusal is automatically transactional with no further work.

### The idempotent removal the cascade will call

```ts
// Source: extensions/pi-claude-marketplace/bridges/workflows/unstage.ts:24-40
  for (const name of input.previousWorkflowNames) {
    // The bundle's composer runs assertSafeName + assertPathInside itself, so
    // there is no second containment check at this call site.
    const target = await input.locations.workflowArtifactPath(name);

    try {
      await unlink(target);
      removed.push(name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
      // ENOENT: the previously-staged file is already gone (e.g. a prior
      // failed install never finished commit). Idempotent -- skip without
      // adding to `removed`.
    }
  }
```

This satisfies the "unstaging an already-absent envelope is a no-op" decision as-is. Only the
non-ENOENT `throw err` changes if option (A) of Pattern 2 is chosen.

## Runtime State Inventory

This phase is lifecycle wiring, not a rename or migration — but it is squarely about runtime
state that lives outside the repo, so the categories are answered explicitly.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | `state.json` per scope: `marketplaces[mp].plugins[p].resources.workflows: string[]` — the ONLY inventory naming envelopes outside every scope root. Records predating Phase 103 carry `workflows: []` from the migration fill [VERIFIED: `persistence/migrate.ts` is in the Phase 103 files_reviewed list and `tests/persistence/migrate.test.ts` covers it]. | Code edit only. **No data migration.** A pre-103 record's empty array is literally correct (no artifacts were ever written), so re-staging behaves as a fresh install — the locked decision forbids a special-case branch. |
| **Live service config** | The host engine's in-memory command registry, populated at load time by `registerAllSavedWorkflows` calling `pi.registerCommand(wf.name, …)`. Not in git, not on our disk, not addressable by us. | None possible — Pi exposes no `unregisterCommand`. **This is precisely what WLIF-06 reports rather than fixes.** |
| **OS-registered state** | None. No task scheduler entries, no pm2 processes, no systemd units, no launchd plists touch workflow artifacts. | None. |
| **Secrets / env vars** | None. `PI_CODING_AGENT_DIR` is deliberately **ignored** by the workflow home derivation (the engine honors no override), and no env var relocates the storage root [VERIFIED: `persistence/locations.ts:231-235` derives `workflowsHomeDir` from `workflowHomeDir()`, and CLAUDE.md's containment clause states `PI_CODING_AGENT_DIR` does not relocate it]. `setWorkflowHomeDirForTesting` is a test-only seam (WR-07, still open). | None. |
| **Build artifacts** | None. No build step exists (`tsc --noEmit`); Node runs `.ts` sources natively. | None. |
| **On-disk artifacts this phase must remove** | `~/.pi/workflows/saved/<plugin>:<name>.json` (user) and `~/.pi/workflows/projects/<key>/saved/<plugin>:<name>.json` (project). Any envelope written by a Phase-103-era install of this branch is currently **orphaned**: `removePluginRecord` deleted the only inventory naming it. | Not this phase's job to sweep historically — no user has this on a released build (nothing is pushed and no PR exists). Developers testing this branch may have stale envelopes in their real `~/.pi/workflows/saved/`; **note this in the plan** so a manual `ls ~/.pi/workflows/saved/` cleanup is done before UAT, and so a leftover file from an earlier run cannot be mistaken for a live regression. |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node's built-in runner), Node `>=20.19.0` |
| Config file | none — suites are globbed by npm scripts in `package.json` |
| Quick run command | `node --test tests/orchestrators/plugin/<file>.test.ts` (single file; the runner runs each file in its own process) |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + all tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| WLIF-02 | update triad: add + remove + `meta.name` rename over one fixture pair leaves exactly version B's artifacts | integration | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ (fixture builder needs the workflows extension — see below) |
| WLIF-02 | `sRecord.resources.workflows` reassigned under its own `failedPhases` guard; a workflows-commit failure leaves the OLD inventory | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ |
| WLIF-03 | uninstall leaves no envelope, **user** scope | integration | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ (needs the hermetic-workflow-home helper) |
| WLIF-03 | uninstall leaves no envelope, **project** scope (derived key) | integration | same | ✅ |
| WLIF-03 | `cascadeUnstagePlugin` reports `dropped.workflows` and removes the file | unit | `node --test tests/orchestrators/marketplace/cascade.test.ts` | ✅ |
| WLIF-03 | `marketplace remove --cascade` inherits the sixth unstage | integration | `node --test tests/orchestrators/marketplace/remove.test.ts` | ✅ |
| WLIF-03 | live-engine removal proof, both scopes | manual/live | `node tests/live-uat/workflow-storage-canary.mjs` | ✅ (assertion added) |
| WLIF-04 | reinstall replaces envelopes; the record names the NEW staged names | integration | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ |
| WLIF-05 | disable removes envelopes; enable re-materializes them | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ |
| WLIF-05 | enable converges when re-materialization produces a DIFFERENT generated name (the WR-01 gap) | integration | same | ✅ |
| WR-06 | a foreign pre-existing target is refused, not clobbered; a plugin-owned one is replaced | unit | `node --test tests/bridges/workflows/stage.test.ts` | ✅ |
| WLIF-06 | the token renders only when workflows were actually removed | unit | `node --test tests/architecture/catalog-uat.test.ts` | ✅ |
| WLIF-06 | closed-set membership + order + length | unit | `node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ |

### Sampling rate

- **Per task commit:** the single affected suite file (`node --test tests/<path>.test.ts`) plus
  `npm run typecheck`. Every wiring site in this phase is a compile error on omission, so
  typecheck is a genuinely high-yield fast gate here.
- **Per wave merge:** `node --test "tests/orchestrators/plugin/*.test.ts" "tests/orchestrators/marketplace/*.test.ts" "tests/bridges/workflows/*.test.ts" tests/architecture/catalog-uat.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts`
- **Phase gate:** `npm run check` green, plus one hand-run of
  `node tests/live-uat/workflow-storage-canary.mjs` (it is outside `npm run check` by design).

### Wave 0 gaps

- [ ] **`tests/orchestrators/plugin/update.test.ts` fixture builder cannot express the triad.**
  `seedPathMarketplace`'s spec has a boolean `hasWorkflows?: boolean` that writes exactly one
  file with a fixed body [VERIFIED: `update.test.ts:194-195`, `:248-253`, verbatim:
  `await writeFile(path.join(workflowsDir, "release.js"), 'export const meta = {};\n');`
  with the comment *"The directory existing is the whole signal; nothing reads the body."*].
  The triad needs `workflows?: { fileName: string; source: string }[]`. **Recommended shape:**
  keep `hasWorkflows` for the existing callers and add the array option beside it, or migrate
  the boolean to `workflows: [{fileName:"release.js", source:"export const meta = {};\n"}]` and
  fix the handful of call sites. `tests/orchestrators/plugin/install-workflows.test.ts:87-92`
  already has exactly the array shape to copy [VERIFIED: `seedWorkflowPlugin`'s
  `workflows?: { fileName: string; source: string }[]`].
- [ ] **`makePluginRecord` hardcodes `workflows: []` and ignores the override.** Verbatim
  [VERIFIED: `update.test.ts:120-127`]: the four sibling fields read
  `resources.skills ?? [...]` while line 126 is a bare `workflows: []`. An update-removal test
  needs a seeded record naming version A's workflows, so this must become
  `workflows: resources.workflows ?? []`.
- [ ] **Hermetic workflow-home helper is only in `install-workflows.test.ts`.**
  `withHermeticHome` + `setWorkflowHomeDirForTesting` [VERIFIED: `install-workflows.test.ts:56-77`]
  is needed by the uninstall / enable-disable / reinstall / update workflow cases too. Extract to
  `tests/helpers/` (per the `*-mock.ts` / helpers convention) rather than copying it four times —
  `sonarjs/no-identical-functions` is an ESLint **error** in this repo and four copies will trip
  it.
- [ ] **~12 `typeof cascadeUnstagePlugin` stub literals** across `uninstall.test.ts`,
  `remove.test.ts` and `cascade.test.ts` need `workflows: []` in their `dropped` object. These
  are compile errors, so they surface immediately; budget for them rather than being surprised.
- [ ] **`tests/orchestrators/marketplace/cascade.test.ts:76`** is a whole-object `deepEqual` of
  `outcome.dropped` and needs the sixth key.
- [ ] **WR-11 item 1 (deferred from Phase 103):** `install-workflows.test.ts:218-228`'s hidden
  record literal omits `workflows` and escapes typecheck through an untyped
  `Object.defineProperty` getter. Not this phase's requirement, but it sits in the exact file the
  phase touches — cheap to fix in passing, and it will otherwise fail the moment a test routes
  that record through `STATE_VALIDATOR`.

## Security Domain

This phase removes and replaces **third-party executable code** that the host engine will run.
That framing, not a generic web-app threat model, is what makes the ASVS mapping non-trivial.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this codebase |
|---------------|---------|-----------------------------------|
| V2 Authentication | no | No auth surface in this phase (git credential paths are untouched) |
| V3 Session Management | no | No sessions |
| V4 Access Control | **yes** | WR-06's ownership pre-check is an access-control boundary in a **shared** directory: `~/.pi/workflows/saved/` holds the user's own hand-saved workflows and every other plugin's. The `<plugin>:` prefix is namespacing, not enforcement — the refusal is the enforcement. Precedent: the PI-6 `Cannot replace … with non-previous content` rejection in three sibling bridges. |
| V5 Input Validation | **yes** | Every name entering a path goes through `assertSafeName` + `assertPathInside` inside `locations.workflowArtifactPath` — the removal path must not bypass it (it does not: `unstage.ts` calls the composer). |
| V6 Cryptography | no | The project-key SHA-256 is an identifier derivation, not a security control, and is unchanged here |
| V12 File/Resource | **yes** | NFR-10 containment: the removal and re-stage paths must write/unlink only inside the three admitted paths under the workflow root |

### Known threat patterns for this change

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Uninstall deletes a workflow the user saved by hand under a colliding name | Denial of Service / Tampering (destructive) | WR-06's refusal at *install/re-stage* time is what prevents the record from ever naming a file it does not own; removal is strictly by recorded name and never enumerates the directory [VERIFIED: `bridges/workflows/unstage.ts:5-13`] |
| Silent overwrite of a foreign envelope on re-stage | Tampering / Spoofing (a plugin impersonating a user command) | The WR-06 pre-check; the error message names the path |
| Orphaned executable code after uninstall (today's live defect) | Persistence of untrusted code | The sixth cascade unstage; the WR-10 canary is the proof |
| A silently swallowed unstage failure leaving executable code behind | Repudiation | The structured `WorkflowsUnstageFailureError` + `dropped.workflows` partial reporting; the locked decision forbids swallowing |
| Path traversal via a crafted recorded name in a hand-edited `state.json` | Tampering | `assertSafeName` inside the sole composer rejects `/`, `\`, `.`, `..` and control characters before the join, then `assertPathInside` re-checks [VERIFIED: `bridges/workflows/unstage.ts:25-27` documents that this is why there is no second check at the call site] |
| A user-visible message leaking an absolute path | Information disclosure | `redactAbsolutePaths` at the notify boundary [VERIFIED: `shared/notify.ts:212-223`] — relevant if the WR-06 refusal message ever reaches a rendered row rather than only a cause trailer |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js `>=20.19.0` | everything | ✓ (assumed — the repo is already running its suite) | per `engines` | — |
| npm + `node_modules` | `npm run check` | ✓ in the worktree, via a **symlink** into the primary checkout | — | none; agent worktrees have no deps at all |
| `pre-commit` | commit hooks | ✓ | — | none (`--no-verify` forbidden) |
| `@quintinshaw/pi-dynamic-workflows` | `tests/live-uat/workflow-storage-canary.mjs` only | resolved at runtime from an existing install; **not** a declared dependency | 3.5.1 measured in Phase 103 | The canary exits non-zero with `LIVE RUNTIME REQUIRED` and routes `human_needed` rather than faking a pass [VERIFIED: `canary.mjs:26-31`, `:75-83`] |

**Missing dependencies with no fallback:** none.

**Operational constraints carried from STATE.md (these are execution constraints, not code):**

- **Executors must run SEQUENTIALLY, never in agent worktrees.** `node_modules` here is a
  symlink into the primary checkout, so an isolated agent worktree has no dependencies and
  cannot run `npm run check` at all. Force the dispatch sentinel
  (`query dispatch-isolation --raw --phase 104 --force-isolation none`) before **every**
  executor, reviewer and fixer dispatch — a bare call re-resolves and re-persists
  `harness-worktree` as a side effect.
- All work happens in `/home/acolomba/pi-claude-marketplace/.worktrees/workflows-spike` on
  `features/workflows-spike`. Never write into the primary checkout.
- Commit from this worktree with `SKIP=trufflehog`, only after a clean filesystem trufflehog
  scan of the paths being committed (the git-mode hook cannot work in a linked worktree).
- `pre-commit run --all-files` before pushing — CI runs `--all-files` and a scoped run hides
  pre-existing violations.
- `.planning/` markdown is formatted by **mdformat**, not prettier (`format:check` covers only
  js/json/ts).

## State of the Art

| Old approach (pre-104) | Current approach (post-104) | Impact |
|------------------------|------------------------------|--------|
| `cascadeUnstagePlugin` calls five bridges | six | `uninstall` / `disable` / `marketplace remove` all stop orphaning executable code |
| `previousWorkflowNames` accepted by nobody | supplied by install-ledger, update, reinstall | the re-stage and enable-convergence branches become reachable |
| `update` reassigns five inventories | six, under six independent per-bridge guards | a plugin author's workflow fix can reach the user |
| `reinstall` carries `resources.workflows` forward verbatim | re-stages and records the new names | the record stops describing a disk it did not write |
| `(uninstalled)` is a reasons-less row | optionally reasons-bearing | the lingering-command remedy has somewhere to live |
| Live canary asserts nothing after uninstall | asserts an empty saved directory per scope before teardown | the only real-engine surface stops being blind to half the lifecycle |

**Deprecated / outdated after this phase:** the "five bridges" / "five kinds" vocabulary in the
eleven locations tabulated in Pattern 1; the `resourcesFromHandles(previousWorkflows)` parameter
and its doc comment; the `PHASE3_FAILURE_PHASES` "future fifth bridge" wording; the
`REASONS` "37-entry" and `notify-reasons.ts` "38-entry" count sentences; the notify module's
"9 reasons-less / 10 reasons-bearing" split.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The new reason token belongs in `CommandPrivateReason` rather than a new topic group in `notify-reasons.ts` | Pattern 8 | Low — a wrong home is a compile error at `_ReasonsCoverageProof`, caught immediately; only the taxonomy reads oddly |
| A2 | Option (A) (hooks-style in-place commit) is the right reinstall shape, with workflows committed last | Pattern 6 | Medium — if a step after the workflows commit can fail in practice, the manual-recovery window is larger than assumed; mitigated by placing workflows last so only the state save follows |
| A3 | Option (A) of Pattern 2 (bridge returns `failed[]`, cascade throws the typed error) is preferred over wrapping the existing throw | Pattern 2 | Low — both satisfy the locked decision; (B) is a smaller change if (A) proves invasive at the install-ledger undo |
| A4 | A workflows unstage failure takes the **partial-fold** path rather than `AgentsUnstageFailureError`'s abort-save carve-out | Pattern 2 | Medium — the wrong choice leaves either a ghost record (fold when it should abort) or an untracked file (abort when it should fold). Recommend the fold: an untracked executable file is the worse outcome |
| A5 | WLIF-06's token is stamped on uninstall, disable, update and reinstall, but **not** on the reconcile-applied projection | Open Q1 | Medium — a reconcile-driven uninstall would then remove a workflow silently. See Open Questions |
| A6 | Node `>=20.19.0` and a populated `node_modules` are present in the worktree | Environment Availability | Low — Phase 103 ran the full suite green in this same worktree |
| A7 | No released build carries Phase 103's install, so no user has orphaned envelopes to sweep | Runtime State Inventory | Low — STATE.md states "Nothing is pushed and no PR exists"; developers on this branch may still have local strays |

## Open Questions (RESOLVED)

> All four were settled before planning. Each carries its `RESOLVED:` line naming
> the artifact that closed it. Kept here with the original reasoning intact, because
> the reasoning is what a future reader needs, not just the verdict.

1. **Which surfaces stamp the WLIF-06 token?**
   - What we know: the fact ("a registered command is now stale") is true after uninstall,
     disable, a workflow removed/renamed by update, and a reinstall that produces different
     names. It is also true after a **reconcile-driven** uninstall or disable at load time —
     `resources_discover` runs the same cascade through `applyReconcile`, and the reconcile
     projection emits `plugin-uninstalled` / `plugin-disabled` rows
     [VERIFIED: `tests/architecture/notify-stamp-coverage.test.ts:78-110` drives exactly those
     `PerEntryOutcome` kinds].
   - What's unclear: whether the phase should widen the reconcile projection too. Doing so means
     threading the removed-workflow fact through `PerEntryOutcome` and the reconcile notify
     builder — a materially larger surface, and a load-time cascade is already noted as
     invisible in the host TUI (backlog item UAT-02).
   - **Recommendation:** stamp the four user-typed verbs in this phase. Explicitly record the
     reconcile surface as a known non-stamp with the UAT-02 rationale, so the next reviewer sees
     a decision rather than a gap. Ask the user to confirm before planning, since criterion 4 is
     worded without a surface qualifier.
   - **RESOLVED:** recommendation adopted. `104-CONTEXT.md` "Settled after research" records
     the four user-typed verbs as the stamping surface and the reconcile non-stamp with the
     UAT-02 rationale. `104-06` Task 2 enforces it structurally.

2. **Does `update` also need a `{lingering}` stamp when a workflow is merely RENAMED?**
   - What we know: a rename is an add plus a remove; the old command stays registered. So the
     fact is true.
   - What's unclear: whether the update row's existing degradation vocabulary (`update-degraded-component`,
     `update-orphan-rewake` catalog states) makes a fifth token on the same row confusing.
   - **Recommendation:** yes, stamp it — the gate is `previousNames \ stagedNames` non-empty,
     which naturally covers rename and removal and naturally excludes a pure add.
   - **RESOLVED:** recommendation adopted, recorded in `104-CONTEXT.md` "Settled after
     research" and implemented by `104-06`.

3. **Should `unstagePluginWorkflows`'s ENOENT tolerance be surfaced at all?**
   - What we know: an ENOENT is normal (a prior failed install) and is deliberately silent.
   - What's unclear: after this phase, an ENOENT during *uninstall* means the record named an
     envelope that is no longer there — which for executable code is arguably worth a warning.
   - **Recommendation:** keep it silent (NFR-3 idempotence is the stronger requirement) but have
     the cascade's `dropped.workflows` report only what was *actually* unlinked, so the
     WLIF-06 gate does not fire for a plugin whose envelopes were already gone. This falls out of
     the existing implementation for free — `removed.push(name)` happens only after a successful
     `unlink`.

4. **Does `marketplace remove --cascade` need its own catalog state for the token?**
   - What we know: `remove.ts` consumes `outcome.dropped` and composes its own rows; the
     `partial-marketplace-remove` catalog state already exists.
   - **Recommendation:** treat it as in-scope for the *cascade fix* (it inherits automatically)
     and out-of-scope for the *token* unless the removal row already carries reasons. Verify
     against `remove.messaging.ts` during planning rather than assuming.
   - **RESOLVED:** verified during planning. `marketplace remove` inherits the cascade fix and
     does NOT stamp the token; `104-06` scopes the new catalog state to the uninstall surface
     and grep-gates the non-stamp on `marketplace/remove.ts`.

## Sources

### Primary (HIGH confidence — read this session in the worktree)

- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (lines 294-421, 57-64) — cascade primitive, `UnstageOutcome`, `AgentsUnstageFailureError`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (1140-1320, 401-431, 504, 729, 768-771, 932-936) — ledger, `InstallCtx`, `allowExistingRecord`, phases array
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (1-52, 722, 1160-1275, 1280-1302, 1687-1800, 1900-2030) — hand-rolled swap, `PrepHandles`, `PHASE3_FAILURE_PHASES`, finalize
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (228-256, 1500-1640, 1690-1830, 1832-1924, 2050-2098) — handle set, `replaceAll`, `resourcesFromHandles`, `clonePluginRecord`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` (195-390) — enable/disable branches
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` (345, 410-530) — cascade seam and TR-03 fold
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (855-890) — `applyPartialCascadeFold`
- `extensions/pi-claude-marketplace/bridges/workflows/{stage,unstage,types,index}.ts` — the full triplet
- `extensions/pi-claude-marketplace/bridges/{commands,skills,agents}/stage.ts` — the WR-06 ownership precedent
- `extensions/pi-claude-marketplace/shared/{notify,notify-reasons,errors,fs-utils}.ts` — closed sets, `Phase3Failure`, `pathExists`, severity + summary machinery
- `extensions/pi-claude-marketplace/persistence/{locations,state-io}.ts` — workflow path members, `toDisabledRecord`
- `docs/output-catalog.md` (605-680, catalog-state index) — uninstall section, gate annotations
- `tests/architecture/{catalog-uat,compat-01-no-expansion,notify-closed-set-locks,notify-stamp-coverage}.test.ts` — the gates
- `tests/orchestrators/plugin/{update,install-workflows}.test.ts`, `tests/orchestrators/marketplace/cascade.test.ts` — fixture conventions and blast radius
- `tests/live-uat/workflow-storage-canary.mjs` (1-120, 400-602) — the WR-10 window
- `.planning/workstreams/workflows/{REQUIREMENTS,STATE}.md`, `phases/103-*/103-{REVIEW,VERIFICATION}.md`

### Secondary (MEDIUM confidence — project documentation)

- `.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md` §8 "Ledger" and Constraints → "Registration and reload" — the measured `registerAllSavedWorkflows` /
  no-`unregisterCommand` asymmetry and the engine's own degradation notice. **Note: §8's
  `runPhases`-consumer claim is contradicted by the code and must not be relied on.**
- `CLAUDE.md`, `.planning/codebase/{ARCHITECTURE,CONVENTIONS,STACK}.md` — constraints and conventions
- `.claude/rules/typescript-comments.md` — comment policy

### Tertiary (LOW confidence)

None. No web search was performed: this phase has no external technology surface, so every
question was answerable against the working tree, which is the authoritative source.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no external dependency; every symbol read from its declaration
- Architecture / insertion points: HIGH — every site read and quoted verbatim with line ranges,
  including the one that contradicts the phase CONTEXT
- Message plumbing: HIGH for the mechanics (types, render arms, gates, catalog parser), MEDIUM
  for the surface set (Open Question 1)
- Reinstall composition: MEDIUM — the two viable shapes are both defensible; the recommendation
  rests on an in-file precedent rather than on a measured failure
- Pitfalls: HIGH — each derives from a specific verified code property, not from general caution

**Research date:** 2026-08-15
**Valid until:** stable while the working tree is unchanged; every line reference is anchored to
the current `features/workflows-spike` HEAD (`bb6af555` + the Phase 103 commits). If Phase 103's
review-fix commits are amended or the branch is merged and squashed, re-anchor the line numbers
before executing.

# Phase 113: Update, enable/disable, reconcile - Research

**Researched:** 2026-09-05
**Domain:** In-repo orchestrator wiring (TypeScript, no new external dependencies)
**Confidence:** HIGH for everything measured in-tree; MEDIUM on the two open questions below

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Criterion 5 — the discovery outcome-phrase tense (WR-09)**

- **Mechanism.** Add a `tense: "install" | "preview"` discriminant parameter to
  the discovery call. Both phrase tables stay module constants inside
  `discover.ts`. The ROADMAP's literal wording is "make the outcome phrase a
  parameter"; a tense discriminant is the minimal reading that satisfies the
  intent — each surface states its own tense — while keeping one owner for the
  wording, so the two tenses cannot drift and no caller can invent a phrase.
  Do NOT pass the four phrases in as an `outcomes` record, and do NOT add a
  second exported `previewPluginWorkflows` wrapper.

- **Preview wording.** Future tense, paired 1:1 with the install phrases so a
  reader who meets the same condition on both surfaces recognizes it:

  | verdict / site | `install` tense | `preview` tense |
  |---|---|---|
  | `skipped` | `was not installed` | `will not be installed` |
  | `refused` | `was refused` | `will be refused` |
  | `stem-fallback` | `was installed but will not run` | `would be installed but will not run` |
  | `readFile` failure | `could not be read and was skipped` | `could not be read` |
  | `lstat` failure | `could not be inspected and was skipped` | `could not be inspected` |

  Wording inside those cells is Claude's discretion within that meaning and the
  existing `softFailWarning` template — do not compose a second template, and
  keep the house subject-first row grammar (the file is the subject).

- **The `lstat` site.** Criterion 5 names `"could not be read and was skipped"`
  as inaccurate at the `lstat` call site, where nothing was read. Split the
  read-failure phrase by CALL SITE, in both tenses, per the table above.
  `isWorkflowScriptFile`'s failure arm gets the `inspected` phrase; only
  `readScriptSource`'s arm keeps `read`.

- **The install-tense phrases stay byte-identical** apart from the `lstat` split
  above. Phase 111 fixtures pin them; retuning the other three is churn outside
  this criterion.

**Criterion 7 — the retained staging tree read surface (WR-06)**

- **A separate read-only scan.** Add a sibling
  `scanRetainedWorkflowsStaging(locations)` in
  `orchestrators/plugin/workflows-staging-gc.ts`, sharing
  `holdsDisplacedEnvelopes` and the `assertPathInside` containment assertion
  with the sweep. `garbageCollectWorkflowsStaging` keeps its
  `Promise<string[]>` signature, so neither existing call site changes and
  neither gains a discarded member.

- **Rendered from `pending`.** It is the only read surface that is not
  plugin-scoped, and a retained tree is a recovery action the user must take,
  which is what `pending` reports. A UUID staging root is attributable to no
  plugin, so a per-plugin `info` row would have no key to hang it on.

- **An advisory body line per retained tree, not a row.** The subject is a
  path; the house row grammar's `name` slot expects a plugin or marketplace
  name, and forcing a UUID into it would abuse the grammar rather than use it.
  Carry the staging path and the envelope count, per the ROADMAP.

- **Same set the sweeper keeps forever.** Report exactly the trees the sweep
  declines to remove for the WR-02 reason: the same `holdsDisplacedEnvelopes`
  predicate AND the same `WORKFLOWS_STAGING_MAX_AGE_MS` age bound, so a live
  transaction mid-commit is never reported. Sort by directory name for
  `pending`'s byte-identical-on-repeat contract. Render nothing when the set is
  empty.

**Update, enable/disable, and the `info` surface**

- **`previousWorkflowNames` come from the recorded inventory**
  (`record.resources.workflows`) at both `update` and `enable`. This is WR-01's
  "wiring the recorded inventory at the ledger" and it is what makes the
  existing displace/restore commit path and the WR-06 ownership pre-check
  reachable. Do not re-discover the pre-update plugin tree to derive them.

- **The `info` `workflows:` line lists the two ADMITTED arms** (`named` and
  `stem-fallback`), rendered as their generated `<plugin>:<name>`. An envelope
  is written for both, so listing only `named` would make `info` disagree with
  what install puts on disk. The `stem-fallback` caveat is already carried by
  its own preview warning, so the line does not need to repeat it. Placement
  follows the existing alphabetical per-kind order in
  `appendResolvedComponentLines`, which puts `workflows` last.

- **"`list` counts the kind" is a regression guard, not new rendering.** `list`
  carries no per-kind count for any of the five existing kinds, and Phase 109
  already made `workflows` count on the resolve/classification axis. Cover the
  `list` half with a paired fixture that pins a workflow-bearing plugin's row;
  put the new user-visible rendering on `info` only. Adding a workflows count
  to the `list` row would introduce a per-kind surface no other kind has.

- **Criterion 6 wants one case per widened slot, driven through the `update`
  verb** — both `update.ts` failure-phase arrays, `orchestrators/types.ts`, and
  `shared/errors.ts`. The criterion's claim is that each widened slot is
  REACHABLE; a single end-to-end case proves only the arm it happens to hit and
  leaves the rest inferred, which is the state criterion 6 exists to end.

### Claude's Discretion

Everything else. In particular: the plan decomposition, the update Phase 3a
wiring details, how the staged workflow names ride the enable/disable
projection, what shape criterion 3's no-re-materialize guard takes, and all
test structure. Use the ROADMAP's eight success criteria, the Phase 111 and 112
artifacts, and the codebase conventions.

### Deferred Ideas (OUT OF SCOPE)

- Naming the retained tree from `info` as well as `pending`. Rejected here
  because the tree is attributable to no plugin; revisit only if a
  non-plugin-scoped `info` arm ever exists.
- Per-kind component counts on the `list` row. Out of scope: no existing kind
  has one, so adding it for `workflows` alone would be an inconsistency, not a
  feature.

### Phase-boundary exclusions (from CONTEXT `<domain>`)

Out of scope: the soft-dependency probe and the executable-code contract
document (Phase 114); install-time admission-gate warnings (Phase 115); the
supported-set-growth backfill (Phase 116, WCONV-01..03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WLIF-04 | "Reinstall replaces workflow artifacts." | **Already shipped in Phase 112.** `orchestrators/plugin/reinstall.ts` imports the workflows bridge at `reinstall.ts:94` and `reinstall.ts:151`, and `reinstall.ts:1634-1635` composes the outcome. `[VERIFIED: grep over extensions/, this session]` Phase 113's obligation is a **traceability correction**, not new code — see Open Question 3. |
| WLIF-05 | "Disable removes workflow artifacts and enable re-materializes them." | Disable is already wired: `cascadeUnstagePlugin` carries a `dropped.workflows` axis (`orchestrators/marketplace/shared.ts:407,429,441`). Enable already re-materializes: the install ledger's workflows phase reads `previousWorkflowNames` off the state snapshot (`install.ts:1177-1178`). What Phase 113 adds is the **projection** (criterion 2) — see §Architecture Patterns Pattern 2. |
| WLIF-06 | "When a removed workflow's command lingers for the session, the user is told the reload remedy." | **NOT implemented anywhere in the tree** and **named by no ROADMAP success criterion**. See Open Question 1 — this is the single highest-risk finding of this research. |
| WFLW-04 | "The resolver exposes a `componentPaths.workflows` member." | **Already satisfied.** `domain/resolver.ts:417` declares `componentPaths: { skills: string[]; commands: string[]; agents: string[]; workflows: string[] }`. Phase 113 CONSUMES it at the two `info` component builders (criterion 4). |
</phase_requirements>

## Summary

Phase 113 is pure in-repo wiring. Nothing here needs a new dependency, a new
runtime, or a new external service. Every seam it touches already exists on
`main`, and the whole `bridges/workflows/` triplet is complete and waiting for
callers. The work is (a) a sixth bridge arm at four points inside a 3168-line
`update.ts` whose structure diverges from the install ledger it mirrors, (b) one
new field on the install ledger's outward projection, (c) a widened `info`
component map with a threaded `pluginName`, (d) a `tense` discriminant on the
discovery call, (e) a read-only sibling scan beside the staging sweeper plus a
render channel that does not yet exist on either `pending` arm, and (f) a
sizeable test surface, including byte-equality catalog fixtures.

Two measured findings dominate the plan's shape. First, **the `COMPONENT_KINDS`
"adding a 6th key breaks the typecheck" comment is false** — verified by
compiling the exact construct with the exact strict flags, with a working
negative control. Widening `PluginInfoComponentsResolved["components"]` without
touching the tuple compiles clean and silently omits the new kind from every
rendered row. The tuple's length only guards the opposite direction. The plan
must land the interface, the tuple TYPE length, the array literal, AND a real
compile-forcing proof in one commit; two forcing constructs are verified below.
Second, **WLIF-06 is assigned to this phase, exists nowhere in the tree, and no
ROADMAP success criterion carries it.** The archived spike implemented it as a
new closed-set `Reason` member stamped by four verbs, three of which Phase 112
already shipped without it. That must be settled before planning, not during.

The good news the spike branch supplies: `features/workflows-spike` contains a
fully-reasoned solution to the hardest correctness question in criterion 1 — how
`resources.workflows` must be written across the intent-mark window and the
failure arm, when workflow envelopes are the only artifacts living outside every
scope root. That reasoning (recorded there as CR-02 / CR-03) ports directly even
though the surrounding code does not.

**Primary recommendation:** Settle WLIF-06 and the criterion-5 rendering
question (Open Questions 1 and 2) before decomposition. Then plan five slices in
this order: (1) the `COMPONENT_KINDS` widening plus its forcing proof and the
`info` `workflows:` line with paired catalog fixtures; (2) the discovery `tense`
discriminant; (3) the `update` sixth bridge with the CR-02 record-write policy
and the criterion-6 per-slot cases; (4) the enable/disable projection plus the
criterion-3 reconcile regression guard; (5) `scanRetainedWorkflowsStaging` plus
its `pending` render channel and fixtures. Slices 1 and 2 are independent of
3-5 and of each other, so they can run as one wave.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Update re-stage of workflows (crit. 1) | `orchestrators/plugin/update.ts` | `bridges/workflows/` | Orchestrators own transactional composition; the bridge owns the stage/commit/unstage triplet. `update.ts` deliberately hand-rolls its heterogeneous-undo flow instead of using `runPhases` (D-03). |
| `resources.workflows` record policy (crit. 1) | `orchestrators/plugin/update.ts` (intent-mark + finalize) | `persistence/state-io.ts` (schema) | The schema field exists since Phase 112; only the two write windows are new. |
| Enable/disable materialize + unstage (crit. 2) | `orchestrators/plugin/enable-disable.ts` | `orchestrators/plugin/install.ts` (`runInstallLedger`), `orchestrators/marketplace/shared.ts` (`cascadeUnstagePlugin`) | Both halves already run; only the outward projection is missing. |
| Load-time non-re-materialization (crit. 3) | `orchestrators/reconcile/plan.ts` + `backfill.ts` | — | A cleanly-installed enabled record lands in no plan bucket and fails the backfill's `!compatibility.installable` filter. Structural, not new code. |
| `info` `workflows:` line (crit. 4) | `orchestrators/plugin/info.ts` | `shared/notify.ts` (renderer) | `info.ts` composes the components map; `notify.ts` owns the rendered bytes (IL-2). |
| Discovery outcome tense (crit. 5) | `bridges/workflows/discover.ts` | `orchestrators/plugin/info.ts` (caller) | CONTEXT locks the phrase tables as module constants in the bridge. |
| Retained-staging read surface (crit. 7) | `orchestrators/plugin/workflows-staging-gc.ts` (scan) | `orchestrators/reconcile/pending.ts` (call) + `shared/notify.ts` (render) | Scan is a leaf; `pending` is the only non-plugin-scoped read surface; all bytes go through notify. |

## Standard Stack

### Core

No new libraries. Phase 113 adds **zero** dependencies.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none added) | — | — | Every seam this phase touches is first-party. |

Existing dependencies the phase's code paths run through, all already installed
and pinned in `package.json` `[VERIFIED: package.json:8-13, read this session]`:

```json
  "dependencies": {
    "acorn": "^8.16.0",
    "isomorphic-git": "^1.41.8",
    "proper-lockfile": "^4.1.2",
    "write-file-atomic": "^8.0.0"
  },
```

`acorn` is reached transitively through `domain/workflow-script.ts` (the
admission decision the discovery pass calls); `proper-lockfile` backs
`withStateGuard`, which the update's two write windows open. Neither is touched
directly by this phase's code.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tense: "install" \| "preview"` discriminant | An `outcomes` record parameter, or a `previewPluginWorkflows` wrapper | Both explicitly forbidden by CONTEXT. The discriminant keeps one owner for the wording. |
| A read-only `scanRetainedWorkflowsStaging` sibling | `{ leaks, retained }` off the sweep (the ROADMAP's original shape) | CONTEXT settled this: both sweep call sites wrap it in a bare `catch {}` under D-19-01 and would discard `retained`. |

**Installation:** none.

**Version verification:** not applicable — no package is added. The registry
verification step is vacuous for this phase.

## Package Legitimacy Audit

Phase 113 installs **no external packages**. The Package Legitimacy Gate is
therefore not run and this section is intentionally empty.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Project Constraints (from CLAUDE.md)

These are directives, not suggestions. The planner must not produce a plan that
contradicts any of them.

| Directive | Source | Consequence for this phase |
|-----------|--------|----------------------------|
| Read a file before editing it; trace callers before modifying a function | `CLAUDE.md` "General" | `update.ts` is 3168 lines with five interlocking write windows. Budget reading time in every task that touches it. |
| Never commit to `main`; feature branches are `features/*` | `CLAUDE.md` "Git" | Current branch is `features/workflow` `[VERIFIED: git status, this session]`. |
| Conventional Commits; title 5-72 chars; body lines ≤ 80; **no GSD milestone/phase mentions** | `CLAUDE.md` "Git" | Commit subjects must not name Phase 113. |
| Run `pre-commit run --all-files` BEFORE `git commit`; never `--no-verify`; never amend after a hook failure | `CLAUDE.md` "Git" | Memory note: CI runs `--all-files`, so a scoped `--files` run hides pre-existing violations. |
| Never rebase, never rewrite history | `CLAUDE.md` "Git" | — |
| `npm run check` must stay green (typecheck + ESLint + fallow + Prettier + corresponding-test gates + unit + integration) | `CLAUDE.md` "Constraints" (NFR-6) | Criterion 8. Exact chain quoted in §Validation Architecture. |
| All user-visible output through `ctx.ui.notify` via `shared/notify.ts` (IL-2); no `process.stdout`/`process.stderr` in extension code | `CLAUDE.md` (IL-2/IL-3) | The retained-tree advisory line MUST be a notify message field, never a direct write. |
| All disk mutations atomic (NFR-1) | `CLAUDE.md` "Constraints" | The new scan is read-only; nothing new is written. |
| No fix may require a Pi restart; `/reload` must suffice (NFR-2); all operations idempotent or fail-clean (NFR-3) | `CLAUDE.md` "Constraints" | The retained-tree scan must be idempotent and must not create the staging dir. |
| Containment (NFR-10): refuse writes outside the sanctioned roots; workflow paths resolve inside their owning root | `CLAUDE.md` "Constraints" | The new scan must run `assertPathInside` before any read through the candidate, exactly as the sweep does (WR-07). |
| Comments cite requirement/decision IDs, never GSD phase/plan/wave numbers | `.claude/rules/typescript-comments.md` | Cite `WLIF-0x`, `WR-0x`, `CR-0x`, `D-xx`; never "Phase 113". Also: do not narrate removed code. |
| Prefer `codegraph explore` over grep/find | `.claude/CLAUDE.md` | `.codegraph/` exists at repo root. |
| Version bump touches 6 sites (manifest, both lockfile records, `EXTENSION_VERSION`, `tests/shared/extension-version.test.ts`, Sonar `projectVersion`, CHANGELOG) | `CLAUDE.md` + STATE.md | Phase 113 needs **no** bump: `EXTENSION_VERSION` moved to `0.19.0` in Phase 111 and the backfill gate is already open. Do not bump again. |

## Architecture Patterns

### System Architecture Diagram

```text
                         ┌───────────────────────────────┐
 /claude:plugin update   │ edge/handlers/plugin/update.ts │
 /claude:plugin enable   │ edge/handlers/plugin/enable…   │
 /claude:plugin info     │ edge/handlers/plugin/info.ts   │
 /claude:plugin pending  │ edge/handlers/… pending        │
                         └───────────────┬───────────────┘
                                         │
      ┌──────────────────────────────────┼───────────────────────────┐
      ▼                                  ▼                           ▼
┌───────────────────┐        ┌────────────────────────┐   ┌─────────────────────┐
│ update.ts         │        │ enable-disable.ts      │   │ info.ts             │
│  1 prepare×6      │        │  enable → runInstall-  │   │  composeResolved-   │
│  2 intent-mark ─┐ │        │          Ledger        │   │    Components  ──┐  │
│  3a commit×6  ──┼─┼──┐     │  disable→ cascadeUn-   │   │  composeState-   │  │
│  3b finalize  ──┘ │  │     │          stagePlugin   │   │    OnlyComponents│  │
└─────────┬─────────┘  │     └───────────┬────────────┘   └──────────┬───────┘  │
          │            │                 │                           │          │
          ▼            │                 ▼                           │          │
  ┌───────────────┐    │      ┌──────────────────────┐               │          │
  │ withStateGuard│◄───┘      │ InstallLedgerSummary │               │          │
  │  state.json   │           │  + stagedWorkflow-   │               │          │
  │  .resources.  │           │    Names  (NEW)      │               │          │
  │   workflows   │           └──────────────────────┘               │          │
  └───────────────┘                                                  │          │
          ▲                                                          │          │
          │                    ┌─────────────────────────────────────┘          │
          │                    ▼                                                │
          │      ┌──────────────────────────────────────┐                       │
          └──────│ bridges/workflows/                   │◄──────────────────────┘
                 │  discoverPluginWorkflows(tense) NEW  │   tense:"preview"
                 │  prepareStageWorkflows               │
                 │  commitPreparedWorkflows(onPlaced)   │
                 │  abortPreparedWorkflows              │
                 │  unstagePluginWorkflows              │
                 └──────────────┬───────────────────────┘
                                │  rename()
                                ▼
        ┌───────────────────────────────────────────────────────┐
        │  ~/.pi/workflows/                 (OUTSIDE scopeRoot)  │
        │    saved/<plugin>:<name>.json          ← targets       │
        │    projects/<key>/saved/…              ← project arm   │
        │    .pi-claude-marketplace-staging/<uuid>/               │
        │        <name>.json                     ← staged        │
        │        .previous/<name>.json           ← displaced     │
        └──────────────────┬────────────────────────────────────┘
                           │ readdir (read-only)
                           ▼
        ┌──────────────────────────────────────────┐
        │ workflows-staging-gc.ts                   │
        │   garbageCollectWorkflowsStaging (sweep)  │  ← install.ts, uninstall.ts
        │   scanRetainedWorkflowsStaging   (NEW)    │  ← pending.ts
        └──────────────────┬───────────────────────┘
                           ▼
                 ┌─────────────────────┐
                 │ reconcile/pending.ts│ ── exactly ONE notify() ──▶ shared/notify.ts
                 └─────────────────────┘
```

Read the primary use case left-to-right along the `update` arm: the handler
calls `updatePlugins`, which prepares six bridges into staging, marks intent in
`state.json`, commits six bridges (continuing across failures), finalizes the
record per-bridge, and composes one notify. The workflows arm alone reaches
outside every scope root, which is why its record inventory and its staging
sweeper are load-bearing rather than hygienic.

### Component Responsibilities

| File | What it owns for this phase | Measured size |
|------|------------------------------|---------------|
| `orchestrators/plugin/update.ts` | prepare / abort / intent-mark / phase-3a commit / finalize — four new arms | 3168 lines |
| `orchestrators/plugin/enable-disable.ts` | the enable projection read and the disable cascade read | 1350 lines |
| `orchestrators/plugin/install.ts` | `InstallLedgerSummary` — the projection both enable verbs read | (workflows phase at 1166-1245) |
| `orchestrators/plugin/info.ts` | `composeResolvedComponents` + `composeStateOnlyComponents` + `deriveLenientComponentPaths` | 2378 lines |
| `shared/notify.ts` | `COMPONENT_KINDS`, `appendResolvedComponentLines`, `PluginInfoComponentsResolved`, the `pending` render arms | (sites at 1511, 3521-3562, 3774) |
| `bridges/workflows/discover.ts` | the two phrase tables and the `tense` parameter | 344 lines |
| `orchestrators/plugin/workflows-staging-gc.ts` | `scanRetainedWorkflowsStaging` + shared predicate | 214 lines |
| `orchestrators/reconcile/pending.ts` | the retained-tree call site, under its 3 contracts | 268 lines |

### Pattern 1: The four `update.ts` seams a sixth bridge slots into

`update.ts` does NOT use `runPhases` — its own header says so
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:10-11]`:

```text
// Both share the per-plugin 3-phase swap implementation (D-03 HAND-ROLLED,
// NOT runPhases -- the heterogeneous-undo flow D-02 precedent):
```

The four seams, measured:

**(a) Prepare** — `prepareUpdateHandles`, `update.ts:1306-1370`. The five (in
fact four staged + hooks-elsewhere) prepares run in `skills -> commands ->
agents -> mcp` order inside one `try`, whose `catch` calls `abortPartialHandles`.
`PrepHandles` is declared at `update.ts:757-762`
`[VERIFIED: update.ts:757-762]`:

```ts
interface PrepHandles {
  skills: PreparedSkillsStaging;
  commands: PreparedCommandsStaging;
  agents: PreparedAgentsStaging;
  mcp: PreparedMcpStaging;
}
```

The workflows prepare is appended after `mcp`, and its `previousWorkflowNames`
is the RECORDED inventory (CONTEXT-locked). `preflight.record` is in scope at
that point (destructured at `update.ts:1312` as `const { installable, record } =
preflight;`).

**(b) Abort** — two functions, `abortPartialHandles` (`update.ts:1393-1408`) and
`abortHandles` (`update.ts:1410-1416`). Both currently collect a leak string
only from `abortPreparedAgents`. `abortPreparedWorkflows` also returns
`Promise<string | undefined>` `[VERIFIED: bridges/workflows/stage.ts:448-450]`,
so it takes the agents arm's awaited-push shape, and unwinds FIRST (reverse of
prepare order).

**(c) Phase-3a commit** — `commitUpdatePhase3a`, `update.ts:2088-2144`. Order is
`skills -> commands -> agents -> hooks -> mcp`; each arm is its own `try` that
pushes an `UpdatePhase3Failure` and CONTINUES. Two arm shapes exist: the
skills/agents shape treats a non-`undefined` leak return as a failure entry too;
the commands/mcp shape only catches. `commitPreparedWorkflows` returns a leak
string, so it takes the skills shape. It also needs an `onPlaced` capture — see
Pattern 3.

**(d) Record finalize** — `finalizeUpdateRecord` (`update.ts:1951-2026`)
delegating per-bridge writes to `applyPerBridgeResources` (`update.ts:1827-1863`).
Every arm is independently gated on `!failedPhases.has(<bridge>)`
`[VERIFIED: update.ts:1839-1862, read via line-range this session]`:

```ts
  if (!failedPhases.has("skills")) {
    sRecord.resources.skills = handles.skills.result.recorded.map((r) => r.generatedName);
  }
```

The failure-phase tuple is at `update.ts:1448-1456`
`[VERIFIED: update.ts:1448-1456]`:

```ts
const PHASE3_FAILURE_PHASES = [
  "skills",
  "commands",
  "agents",
  "hooks",
  "mcp",
  "workflows",
] as const;
type Phase3Phase = (typeof PHASE3_FAILURE_PHASES)[number];
```

### Pattern 2: The projection both enable verbs read

`InstallLedgerSummary` is the outward view of the ledger
`[VERIFIED: orchestrators/plugin/install.ts:511-530]`:

```ts
export interface InstallLedgerSummary {
  readonly resolved: MaterializablePlugin;
  readonly frontmatterDegradations: readonly {
    readonly kind: DegradeKind;
    readonly generatedName: string;
    readonly parseError: string;
  }[];
  // Staged-name lists, read only for their emptiness (ENBL-07 soft-dep flags).
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
}
```

Its sole producer is `toInstallLedgerSummary` `[VERIFIED: install.ts:832-839]`:

```ts
function toInstallLedgerSummary(c: InstallCtx): InstallLedgerSummary {
  return {
    resolved: c.resolved,
    frontmatterDegradations: c.frontmatterDegradations,
    stagedAgentNames: c.stagedAgentNames,
    stagedMcpServerNames: c.stagedMcpServerNames,
  };
}
```

`InstallCtx` already carries `stagedWorkflowNames` as a REQUIRED field
`[VERIFIED: install.ts:375-378]`:

```ts
  // WLIF-01: the envelope names the workflows commit reported through its
  // `onPlaced` callback. Required rather than optional so the state phase's
  // record composition cannot forget the axis.
  stagedWorkflowNames: readonly string[];
```

So criterion 2's "ride on the projection" is a three-line change: add
`readonly stagedWorkflowNames: readonly string[];` to the interface, add the
member to `toInstallLedgerSummary`, and read it in `runEnableBranch`
(`enable-disable.ts:243-336`) beside the two existing reads
`[VERIFIED: enable-disable.ts:322-326]`:

```ts
      // SEV-01 / D-98-02: the LENGTH of the staged-name arrays only. The names
      // themselves must never reach a rendered row -- the row needs the
      // declaration verdict, nothing more.
      ...(summary.stagedAgentNames.length > 0 && { stagedAgents: true }),
      ...(summary.stagedMcpServerNames.length > 0 && { stagedMcpServers: true }),
```

**But what the enable row does with it is not settled.** `stagedAgents` /
`stagedMcpServers` exist to drive the `{requires pi-subagents}` /
`{requires pi-mcp}` soft-dep markers, and the workflows companion probe is
explicitly Phase 114. The only in-scope consumer is WLIF-06 (Open Question 1):
`retired = installed.resources.workflows \ summary.stagedWorkflowNames`. Note
`runEnableBranch` receives `installed: InstalledPluginRecord` as a parameter
(`enable-disable.ts:248`), captured before the ledger rewrites the record — so
the pre-enable inventory is available at the right moment.

### Pattern 3: The workflows record write is asymmetric with the other five

Every other bridge's record write reads
`handles.<bridge>.result.recorded[].generatedName` — the PREPARE's answer. The
workflows bridge's authoritative answer comes from the COMMIT, through
`onPlaced`, which fires on the success path AND before the throw on every
failure path `[VERIFIED: bridges/workflows/types.ts:131-147]`:

```ts
export interface CommitWorkflowsOptions {
  /**
   * Called exactly ONCE per commit -- on the success path AND before the
   * throw on every failure path -- with the names whose envelope is sitting at
   * its target path as a result of this commit.
   * …
   */
  readonly onPlaced?: (placedNames: readonly string[]) => void;
}
```

The install ledger already honours this (`install.ts:1209-1216`). `update.ts`
must too: `commitUpdatePhase3a` has to return the placed names alongside
`{ failures, hookEntries }`, and `applyPerBridgeResources` has to take them.

**The archived spike solved this correctly and its reasoning ports verbatim.**
`features/workflows-spike` records it as CR-02 / CR-03. Two windows, not one:

*Intent-mark widens the inventory to a union* — `markUpdateInProgress` gains
`handles` and writes
`sRecord.resources.workflows = [...new Set([...sRecord.resources.workflows, ...handles.workflows.result.stagedNames])]`
`[CITED: git show features/workflows-spike:extensions/pi-claude-marketplace/orchestrators/plugin/update.ts, read this session]`. Its
rationale, quoted from that branch:

> CR-02: `resources.workflows` is the ONE inventory this window widens, to the
> union of the recorded names and the names about to be committed. Every other
> inventory names artifacts under a scope root, where a sweep can still find
> one the record forgot; workflow envelopes live outside every scope root, so
> this array is the only thing that can name them at all. […] Over-naming is the
> safe direction: removal and re-staging are both ENOENT-tolerant (NFR-3), so
> a name that never landed costs a no-op, while a name that landed unrecorded
> costs the file.

*Finalize narrows it back* — the workflows arm is the ONE arm whose failure
branch is not a no-op:

```ts
    if (failedPhases.has("workflows")) {
      sRecord.resources.workflows = [
        ...new Set([...preflight.record.resources.workflows, ...placedWorkflowNames]),
      ];
    } else {
      sRecord.resources.workflows = [...handles.workflows.result.stagedNames];
    }
```

The reason the union cannot simply be left in place, quoted from that branch:

> leaving the union in place would keep naming envelopes the commit never wrote,
> and one of those names can be the foreign file a WR-06 refusal declined to
> replace.

**Do not treat this as a drop-in.** `update.ts` on `main` extracted both
`commitUpdatePhase3a` and `applyPerBridgeResources` into their own functions
after the spike branch was cut, so the code shape differs even though the policy
is identical. Re-derive the arms against the current structure and cite CR-02 /
CR-03 in the comments (both are permitted traceability anchors).

### Pattern 4: The compile-forcing proof for a closed set

The house idiom lives in `shared/notify-reasons.ts:257-270`
`[VERIFIED: shared/notify-reasons.ts:266-270]`:

```ts
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
// fallow-ignore-next-line private-type-leak -- OUT-08 completeness proof; a non-never result is a TS2344 build failure, and the export is what keeps `noUnusedLocals` quiet. `_AssertNever` / `_UncoveredReason` / `_ExtraReason` are the proof's own internals, meaningless to a caller.
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
```

Note the required `fallow-ignore-next-line private-type-leak` marker and the
`export` — the export is what keeps `noUnusedLocals` quiet. Repo-wide there are
exactly nine `fallow-ignore` markers, all scoped to
`unused-type`/`unused-export`/`private-type-leak`/`unused-file`, never to
complexity or duplication (per `.planning/codebase/CONVENTIONS.md`).

### Anti-Patterns to Avoid

- **Trusting an exact-length tuple as a widening guard.** Measured false — see
  Pitfall 1. The tuple length guards *elements added without widening the type*,
  the opposite direction.
- **Writing the workflows record from `handles.workflows.result.stagedNames` on
  the failure arm.** That names envelopes the commit never wrote, including
  possibly a foreign file a WR-06 refusal declined to replace.
- **Changing `garbageCollectWorkflowsStaging`'s signature.** CONTEXT and
  `<specifics>` forbid it; both call sites wrap it in a bare `catch {}` under
  D-19-01 and would discard any widened return.
- **Adding a second `notify()` to `pending`.** IL-2 pins exactly one per
  invocation `[VERIFIED: orchestrators/reconcile/pending.ts:20-22]`.
- **Making `pending` create the staging directory.** `pending` never writes a
  file. `readdir` on a missing dir must return `[]`, mirroring
  `garbageCollectWorkflowsStaging`'s ENOENT arm.
- **Naming GSD phases in comments or commit subjects.** `.claude/rules/typescript-comments.md`.
- **`git add -A` / `git add .`.** The operator edits files concurrently in this
  one checkout; stage explicit paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Which envelope names did this commit place?" | Derive from the thrown error's type, or from `prep.result.stagedNames` | `commitPreparedWorkflows(prep, { onPlaced })` | A refusal, an `lstat` failure in the occupancy check, and a fully-reversed rollback all place nothing; a caller unlinking a name it did not place deletes a foreign file or a just-restored previous envelope (`bridges/workflows/types.ts:131-147`). |
| "Does this staging root still hold displaced envelopes?" | A second `readdir` with its own errno policy | Share `holdsDisplacedEnvelopes` | Its errno policy is load-bearing: only ENOENT and ENOTDIR prove emptiness; every other errno answers "retain" (`workflows-staging-gc.ts:197-213`). Phase 112's review found the earlier version swallowed every errno. |
| Path containment for the new scan | An `includes`/`startsWith` prefix test | `assertPathInside(locations.workflowsHomeDir, candidate, …)` **before any read through the candidate** | WPTH-04 / WR-07: anchoring one level above walks the staging segment itself; anchoring at the staging root leaves a check that cannot fail. |
| The `<plugin>:<name>` generated workflow name | Join `plugin` and `meta.name` at the call site | `verdict.generatedName` off the admitted arms | `domain/workflow-script.ts` owns the six engine-parity clauses (WNAM-06); a second composer would drift. |
| Enumerating a plugin's installed workflows from disk | `readdir(workflowsSavedDir)` and filter by `<plugin>:` prefix | `record.resources.workflows` | The saved directory is shared with the user's own hand-saved workflows and with every other plugin; the `<plugin>:` prefix namespaces a name without granting ownership of it (`bridges/workflows/stage.ts:277-293`). |
| A `workflows:`-line name list on the resolved `info` arm | A private directory walk | `discoverPluginWorkflows` | The names live inside the scripts. A directory-walk fallback existed on the spike branch, was dead, and read declared directories with no `assertPathInside` — the exact check the discovery module cites this surface as its reason for carrying. |
| Rendered output bytes anywhere | Any string built outside `shared/notify.ts` | `notify()` / `notifyWithContext()` | IL-2, enforced by an ESLint rule, a fallow zone rule, and a grep gate. |

**Key insight:** every one of these has already been got wrong once in this
codebase and fixed with a recorded rationale. The cheapest correct move is to
re-read the rationale rather than re-derive the policy.

## Runtime State Inventory

Phase 113 is not a rename or migration, but it *does* change how runtime state
outside every scope root is written. This inventory is included because that
state is the phase's central hazard.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per scope: `marketplaces[mp].plugins[p].resources.workflows` (required array, landed Phase 112, `persistence/state-io.ts:127`). Phase 113 changes it in two NEW windows (intent-mark union, finalize narrow). | Code edit only. **No data migration and no `schemaVersion` bump** — the field already exists with a migrate default-fill (STATE.md, `112-01`). |
| Live service config | None. The workflows engine (`@quintinshaw/pi-dynamic-workflows`) reads `~/.pi/workflows/saved/` at load; it holds no separate config this phase touches. | None — verified: no engine config file is read or written by `bridges/workflows/` or `orchestrators/plugin/workflows-staging-gc.ts`. |
| OS-registered state | Registered *commands* in the running Pi session. The host exposes no `unregisterCommand`, so a removed or renamed workflow's command stays live until `/reload`. **This is exactly WLIF-06.** | See Open Question 1 — currently unaddressed. |
| Secrets / env vars | None — verified by grep: no phase-113 seam reads an env var. (`PI_CODING_AGENT_DIR` and `TEST_CONCURRENCY` exist repo-wide but are untouched here.) | None. |
| Build artifacts | None — the project has no build step (`tsc --noEmit`; Node runs `.ts` natively). | None. |
| **Filesystem, outside every scope root** | `~/.pi/workflows/saved/<plugin>:<name>.json` (user), `~/.pi/workflows/projects/<key>/saved/…` (project), `~/.pi/workflows/.pi-claude-marketplace-staging/<uuid>/` and its `.previous/`. Retained trees accumulate for the life of the machine. | Criterion 7 makes them discoverable. Uninstall and `/reload` cannot reach them; the record is the only inventory. |

## Common Pitfalls

### Pitfall 1: The `COMPONENT_KINDS` exact-length tuple does not guard the direction the comment claims

**What goes wrong:** you widen `PluginInfoComponentsResolved["components"]` with
a sixth `workflows?` key, trust the comment, and ship a renderer that silently
never emits a `workflows:` line. Typecheck stays green. Every existing test stays
green.

**The claim under test**, quoted verbatim
`[VERIFIED: shared/notify.ts:3514-3528]`:

```ts
// Derive the tuple's element type from the interface so the two
// declarations cannot drift. The tuple is sized exactly (5 entries):
// adding a 6th key to `PluginInfoComponentsResolved.components` without
// extending this tuple breaks the typecheck here -- TS rejects the
// literal because `ComponentKind` would no longer cover every keyof
// the interface. Without the explicit tuple length, the renderer
// would silently omit the new kind from output.
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS: readonly [
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
] = ["agents", "commands", "hooks", "mcp", "skills"];
```

**Measured result: the claim is FALSE.** I reproduced the construct exactly,
added the sixth key, and compiled with the project's strict flags:

```
$ npx tsc --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess \
    --target ES2022 --module NodeNext --moduleResolution NodeNext probe.ts
EXIT=0
```

`[VERIFIED: falsification probe run this session, scratchpad/tupleprobe/probe.ts]`

The reasoning error is that the tuple's element type is the *union*; five
elements each drawn from a six-member union is perfectly assignable. Negative
control, proving the harness fires on this construct at all (a sixth array
element against the five-slot tuple type):

```
probe-neg.ts(13,14): error TS2322: Type '["agents", "commands", "hooks", "mcp", "skills", string]'
  is not assignable to type 'readonly [...5 slots...]'.
  Source has 6 element(s) but target allows only 5.
EXIT=2
```

`[VERIFIED: negative control run this session]`

This is the recorded repeat failure mode "Optional-field silent-omission class"
— adding a member to a closed set compiles clean at every derivation site.

**How to avoid:** land the interface key, the tuple TYPE length, the array
literal, AND a real forcing proof in ONE commit; then delete or correct the false
comment (do not narrate the removal — state what the new construct does). Two
forcing constructs are verified to fire:

```ts
// Construct A -- a total Record keyed by the union:
const ORDER: Record<ComponentKind, number> = { agents: 0, commands: 1, hooks: 2, mcp: 3, skills: 4 };
//    error TS2741: Property 'workflows' is missing … but required in type 'Record<…>'.

// Construct B -- an Exclude-based coverage assertion over an `as const` array:
const KINDS = ["agents", "commands", "hooks", "mcp", "skills"] as const;
type Uncovered = Exclude<ComponentKind, (typeof KINDS)[number]>;
const _cover: Uncovered extends never ? true : ["uncovered kinds", Uncovered] = true;
//    error TS2322: Type 'boolean' is not assignable to type '["uncovered kinds", "workflows"]'.
```

`[VERIFIED: both errors observed this session, scratchpad/tupleprobe/probe-force.ts]`

**Recommendation:** Construct B, restyled as the house `_AssertNever` proof from
`notify-reasons.ts:266-270` (Pattern 4), because it names the missing kind in
the error text and matches an idiom already in the file's neighbourhood. Whatever
is chosen, **prove it non-vacuous by reverting the tuple entry and observing
red** — the project's own gate rule is that a gate wants a test that plants the
violation, not one that reads the config.

**Warning sign:** a `workflows:` line that appears in a unit test asserting on
`components` but never in a rendered-bytes assertion.

### Pitfall 2: The `update` failure arm can strand executable code outside every scope root

**What goes wrong:** you copy the five existing arms verbatim — `if
(!failedPhases.has("workflows")) { write }` — and the failure arm becomes a
no-op. A commit that placed some envelopes and then failed mid-sequence with a
partially-failed rollback leaves those names on disk with the record still
naming only the previous set. Nothing can ever remove them: they sit outside
every scope root, so uninstall and `/reload` cannot reach them, and the sweeper
only collects *staging* trees, never targets.

**Why it happens:** the five sibling inventories name artifacts under a scope
root, where a later sweep can still find one the record forgot. Workflow
envelopes have no such backstop.

**How to avoid:** implement the CR-02 two-window policy (Pattern 3): union at
intent-mark, narrow-with-placed-names at finalize. Over-naming is the safe
direction because both removal and re-staging are ENOENT-tolerant (NFR-3).

**Warning sign:** a test that asserts `resources.workflows` after a *successful*
update but has no case for a failed workflows commit.

### Pitfall 3: `pending`'s empty arm carries no fields, so the retained-tree line has two homes

**What goes wrong:** you thread the retained-tree advisory onto the cascade path
and it never renders for the user most likely to see it — someone whose config
is in steady state.

**Measured:** `pendingReconcile` returns early for the empty case
`[VERIFIED: orchestrators/reconcile/pending.ts:214-217]`:

```ts
  if (invalidBlocks.length === 0 && isReconcilePlanListEmpty(plans)) {
    notify(opts.ctx, opts.pi, { kind: "reconcile-pending-empty" });
    return;
  }
```

and that variant is declared to carry nothing
`[VERIFIED: shared/notify.ts:1585-1587]`:

```ts
export interface ReconcilePendingEmptyMessage {
  readonly kind: "reconcile-pending-empty";
}
```

with a hard-coded renderer body `[VERIFIED: shared/notify.ts:3774-3779]`:

```ts
    case "reconcile-pending-empty":
      // DIFF-01 SC #2: catalog-locked free-form advisory body line. Hard-coded
      // here so the byte form cannot drift from `docs/output-catalog.md`'s
      // `empty-steady-state` state.
      body = "Pending: next reload will apply 0 actions.";
      break;
```

The non-empty arm goes through `notifyWithContext(…, PENDING_CONTEXT,
marketplaces)`, i.e. a `CascadeNotificationMessage`, whose declared fields are
`marketplaces`, `label`, `cardinality`, `tally` — **no advisory/notes slot**
`[VERIFIED: shared/notify.ts:1357-1383]`.

**How to avoid:** add the same optional field to BOTH message shapes and render
it from the central dispatch after the body, so the byte form is identical on
both arms; pin both with paired catalog fixtures. Do not add a second `notify()`
(IL-2).

**Warning sign:** a plan task that names only `reconcile-pending-empty`.

### Pitfall 4: `pending` fans out over both scopes, but the staging directory is scope-independent

**What goes wrong:** the retained-tree line renders twice when no `--scope` is
given.

**Measured:** `pendingReconcile` iterates `["project", "user"]` when
`opts.scope` is undefined (`pending.ts:134`), while `workflowsStagingDir` and
`workflowsHomeDir` are documented as scope-independent
`[VERIFIED: persistence/locations.ts:128-140]`:

```
   * `<workflowsHomeDir>/.pi-claude-marketplace-staging/` -- pre-rename staging
   * (WPTH-05, NFR-1). Scope-independent, like `workflowsHomeDir`.
```

**How to avoid:** call the scan ONCE per invocation, outside the scope loop.
Sort by directory name for the byte-identical-on-repeat contract.

### Pitfall 5: `info` has no free-text warning channel, so the preview phrases may render nowhere

**What goes wrong:** the `tense: "preview"` phrases are implemented, tested at
the bridge, and never reach a user — because `PluginInfoRow` carries only a
closed-set `reasons?: readonly ContentReason[]`
`[VERIFIED: shared/notify.ts:1497]`:

```ts
  readonly reasons?: readonly ContentReason[];
```

and `info.ts` emits nothing else free-form (verified by grep: its only string
channels are `description`, `narrowResolverNotes`, and closed-set reasons).

See Open Question 2. This does not block the CONTEXT-locked mechanism, but it
changes what "the discovery warning phrases stop asserting an install outcome on
the `info` surface" can mean.

### Pitfall 6: `deriveLenientComponentPaths` and the inline `unavailable` literals will need the sixth key

**What goes wrong:** the resolved `info` arm renders workflows for
`installable`/`partially-available` plugins but silently omits them for the
`unavailable` arm, which re-derives its own component paths.

**Measured:** `deriveLenientComponentPaths` returns three kinds
`[VERIFIED: orchestrators/plugin/info.ts:1308-1327]`:

```ts
function deriveLenientComponentPaths(entry: MarketplaceManifest["plugins"][number]): {
  skills: string[];
  commands: string[];
  agents: string[];
} {
  const out = {
    skills: ["skills"],
    commands: ["commands"],
    agents: ["agents"],
  };
  for (const kind of ["skills", "commands", "agents"] as const) {
```

and a second inline literal does the same in `buildNonInstallableRowFields`'s
caller `[VERIFIED: orchestrators/plugin/info.ts:1899-1903]`:

```ts
        : {
          componentPaths: { skills: ["skills"], commands: ["commands"], agents: ["agents"] },
          mcpServers: {},
        };
```

**How to avoid:** make `componentPaths.workflows` REQUIRED on
`composeResolvedComponents`'s parameter type. Both literals then fail to compile
until they supply it, which is the compile-forcing behaviour Pitfall 1 shows the
tuple does not give.

### Pitfall 7: `composeResolvedComponents` has no `pluginName`, which the discovery needs

**Measured:** its signature is `(pluginRoot, resolved)` with five call sites
(`info.ts:1283, 1552, 1644, 1905, 2082`) plus two
`Parameters<typeof composeResolvedComponents>[1]` type references
(`info.ts:1259, 2075`) `[VERIFIED: grep over info.ts, this session]`. Threading
`pluginName` as a THIRD positional parameter (rather than a member of the
`resolved` bag) keeps both `Parameters<…>[1]` references valid untouched — the
approach the spike branch took and documented for that reason. `pluginName` is
in scope at every one of the five call sites (checked at 1905 via
`const { pluginName, … } = opts;` and at 2082 via `opts.pluginName`).

## Code Examples

### The `tense` discriminant threading (criterion 5)

The five call sites needing a tense-aware phrase, measured in
`bridges/workflows/discover.ts`:

| Site | Line | Current phrase |
|------|------|----------------|
| `isWorkflowScriptFile` failure → `readFailureWarning` | `discover.ts:308` | `could not be read and was skipped` (inaccurate: nothing was read) |
| `readScriptSource` failure → `readFailureWarning` | `discover.ts:328` | `could not be read and was skipped` |
| `skipped` verdict → `skippedWarning` | `discover.ts:205` | `was not installed` |
| `refused` verdict → `refusedWarning` | `discover.ts:209` | `was refused` |
| `stem-fallback` verdict → `unrunnableWarning` | `discover.ts:213` | `was installed but will not run` |

The one template all five share, which must not be duplicated
`[VERIFIED: bridges/workflows/discover.ts:96-103]`:

```ts
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  return `workflow script "${fileName}" in "${workflowsDir}" ${outcome}: ${reason}`;
}
```

Threading path: `discoverPluginWorkflows(input)` (`discover.ts:251`) →
`scanWorkflowsDirectory(input)` (`discover.ts:290`) → `verdictWarning(verdict,
workflowsDir)` (`discover.ts:203`) and the two `readFailureWarning` sites. The
one production caller today is `prepareStageWorkflows`
`[VERIFIED: bridges/workflows/stage.ts:132-135]`:

```ts
  const { discovered, warnings: discoverWarnings } = await discoverPluginWorkflows({
    pluginName,
    resolved,
  });
```

which passes `tense: "install"`. `info.ts` passes `tense: "preview"`. Whether
`tense` is required or defaults to `"install"` is a design choice: **required**
is the compile-forcing option and costs one edit at the single existing caller
plus the ~25 call sites in `tests/bridges/workflows/discover.test.ts`. Given
Pitfall 1's lesson, required is the recommendation.

`WorkflowVerdict`'s admitted arms carry `generatedName` (read by
`bridges/workflows/stage.ts:176, 182, 186-187`), which is the value the `info`
`workflows:` line renders per the CONTEXT decision.

### The retained-staging scan (criterion 7)

The predicate to share, with its errno policy intact
`[VERIFIED: orchestrators/plugin/workflows-staging-gc.ts:207-214]`:

```ts
async function holdsDisplacedEnvelopes(stagingRoot: string): Promise<boolean> {
  try {
    return (await readdir(path.join(stagingRoot, DISPLACED_DIR))).length > 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code !== "ENOENT" && code !== "ENOTDIR";
  }
}
```

**Design note the planner must resolve:** the scan needs the envelope COUNT, but
this predicate returns a boolean and its error arm returns `true` with no count.
Refactor to one shared reader returning a discriminated
`{ holds: false } | { holds: true; count: number } | { holds: true; count: undefined }`
(or equivalently `count?: number`), with `holdsDisplacedEnvelopes` becoming a
thin `.holds` projection so the sweep's behaviour is provably unchanged. Do NOT
duplicate the errno ladder.

The age bound and the containment anchor are the other two things to share
`[VERIFIED: workflows-staging-gc.ts:65-66]`:

```ts
export const WORKFLOWS_STAGING_MAX_AGE_MS =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
```

and `[VERIFIED: workflows-staging-gc.ts:155-164]`:

```ts
    try {
      await assertPathInside(
        locations.workflowsHomeDir,
        candidate,
        `workflows staging root ${name}`,
      );
    } catch (err) {
      leaks.push(`${name}: ${errorMessage(err)}`);
      continue;
    }
```

The scan's parameter type should mirror the sweep's
`Pick<ScopedLocations, "workflowsStagingDir" | "workflowsHomeDir">`
(`workflows-staging-gc.ts:103`) so the two cannot diverge on what they need.

**Read-surface obligations for the scan:** ENOENT `readdir` → `[]`; never
`mkdir`; per-entry failures must not abort the pass; a containment refusal on
one entry must not end the scan (`pending` has no leak channel, so a refused
entry is simply not reported — but it must not throw out of a read-only
command).

### Criterion 3 — measured: no new code, a regression guard only

Two independent structures already prevent load-time re-materialization:

**(a) The plan buckets.** `planReconcile` is a pure bidirectional diff between
`MergedConfig` and `ExtensionState` `[VERIFIED: orchestrators/reconcile/plan.ts:3-6]`:

```
// DIFF-01 pure bidirectional 7-bucket diff between MergedConfig and
// ExtensionState. NEVER touches the disk or network. The architecture
// purity gate at `tests/architecture/reconcile-planner-purity.test.ts`
// structurally enforces zero effectful imports…
```

A declared-and-enabled plugin that is already recorded lands in no bucket, so
`applyReconcile` drives no orchestrator for it. Grep confirms neither `apply.ts`
nor `plan.ts` mentions `workflows` at all.

**(b) The backfill's two gates.** `[VERIFIED: orchestrators/reconcile/backfill.ts:76-89]`:

```ts
  if (state.lastReconciledExtensionVersion === EXTENSION_VERSION) {
    // Gate closed: the extension version has not moved since the last
    // reconcile, so the supported-kind boundary cannot have moved either.
    // No scan, no write -- RECON-05 mtime invariant preserved.
    return;
  }
```

and `[VERIFIED: backfill.ts:343-345]`:

```ts
  if (!supportedSetGrew(record.compatibility.supported, resolved.supported)) {
    return false;
  }
```

plus the `hasForceInstalledPlugin` filter, which only reaches records at
`!compatibility.installable`. A cleanly-installed workflow-bearing plugin is
never scanned — which is simultaneously why criterion 3 holds today and why
WCONV-01 (Phase 116) exists.

**Recommended guard shape:** an integration case that installs a
workflow-bearing plugin, records the envelope's `mtime` and the `state.json`
`mtime`, runs `applyReconcile` twice, and asserts both are unchanged and that no
`notify` was emitted (the empty-and-clean reconcile is SILENT per NFR-2 / A4,
`apply.ts:33-36`). Prove it non-vacuous by a negative control that forces the
backfill gate open.

## State of the Art

| Old approach (on `features/workflows-spike`) | Current approach (on `features/workflow`) | Impact |
|---|---|---|
| `runThreePhaseSwap` held the phase-3a commit and the record write inline | `commitUpdatePhase3a` and `applyPerBridgeResources` are extracted functions | The spike's diffs do not apply; its POLICY does. Re-derive the arms. |
| `update-row.ts` carried `declaresWorkflows` + `stale workflow command` | `update-row.ts` is a leaf composer with `UpdatedRowSeverity`, three axes, no workflows | The spike's `update-row.ts` is **not** a drop-in: `declaresWorkflows` needs the Phase-114 soft-dep `Dependency` member. `[VERIFIED: git diff features/workflow…features/workflows-spike -- update-row.ts, this session]` |
| `workflows` was an UNSUPPORTED component kind (#154) | `workflows` is in `SUPPORTED_COMPONENT_KINDS` and `SUPPORTED_COMPONENT_PATH_KINDS` | Phase 109. `componentPaths.workflows` exists (`domain/resolver.ts:369,417`), satisfying WFLW-04. |
| The `REASONS` set had a dedicated `workflows` member (44 entries) | 43 entries; the workflows member was retired by WINV-03 | Adding `stale workflow command` walks the count back to 44 — a deliberate closed-set amendment with a documented blast radius (see Open Question 1). |
| `docs/output-catalog.md` described workflow-bearing plugins as degrading | Corrected in Phase 109 (WINV-05) | The catalog is the byte contract; every new rendered line needs a paired fixture. |

**Deprecated / outdated in the tree:**
- The `COMPONENT_KINDS` comment at `shared/notify.ts:3514-3520` — measured
  false (Pitfall 1). Correct it in the same commit that widens the tuple.
- `.planning/codebase/STACK.md`'s description of `npm run check` omits the three
  corresponding-test / direct-coverage gates that are in the real script. Use
  the `package.json` text quoted in §Validation Architecture as the source of
  truth. `[VERIFIED: package.json:77]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `applyPerBridgeResources` and `finalizeUpdateRecord` will stay under fallow's `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60` after a sixth arm with a two-branch failure policy is added. STATE.md records that the install ledger "absorbed the sixth phase without breaching either ceiling", but that was a different function. | Architecture Patterns 1, 3 | An extraction is needed mid-task. Budget one helper extraction; Phase 112 hit exactly this on two test helpers. |
| A2 | Adding one field to `CascadeNotificationMessage` and to `ReconcilePendingEmptyMessage` will not disturb the `notify-grammar-invariant` / `notify-producer-wire-coverage` / `notify-stamp-coverage` architecture gates. Not measured — those three files were not read in depth. | Pitfall 3 | Extra gate edits appear late. Read all three before planning the criterion-7 slice. |
| A3 | The `info` `workflows:` line renders on BOTH the resolved arm (via discovery) and the state-only arm (via `record.resources.workflows`). CONTEXT names only the admitted-arms rule; symmetry with the other five kinds implies both. | Pattern 6 / criterion 4 | A `(installed) {not in manifest}` row would omit workflows the record names. Low risk — the state-only arm is a one-line addition mirroring `agents`. |
| A4 | The five `composeResolvedComponents` call sites all have `pluginName` in scope. Verified at two of five (1905, 2082); the other three (1283, 1552, 1644) were not opened. | Pitfall 7 | One or two call sites need `pluginName` threaded a level higher. |
| A5 | `tests/orchestrators/plugin/update.test.ts` (8519 lines) has a reusable seeding helper for a workflow-bearing plugin. Not verified. | Validation Architecture | Wave-0 test-fixture work is larger than budgeted. STATE.md flags "expect the same pressure on any fixture that enumerates the record's resource axes by hand." |
| A6 | The `list` regression fixture (criterion 4's second half) can be added to the existing `list` catalog section without a new `catalog-state` block — i.e. an existing state already covers a workflow-bearing plugin's row. Not verified; the `list` section was not read. | criterion 4 | One extra paired fixture. |

## Open Questions (RESOLVED)

All four were settled before planning. Each carries its resolution
inline below; do not re-open them during execution.

### 1. WLIF-06 is assigned to this phase, implemented nowhere, and named by no success criterion. (HIGH — resolve before planning.)

**RESOLVED — route 1.** WLIF-06 lands in Phase 113 across all four retiring
verbs. Recorded as ROADMAP criterion 8 and in `113-CONTEXT.md` §"WLIF-06";
implemented by `113-04-PLAN.md` tasks 1-2. Planning added a fifth stamp site
(`enable`) on the module-private sentinel, because the staged workflow names
have no other consumer.

**What we know.** WLIF-06 reads: *"When a removed workflow's command lingers for
the session, the user is told the reload remedy. Pi has no `unregisterCommand`,
so uninstall is asymmetric by host limitation."*
`[VERIFIED: .planning/workstreams/workflows/milestones/workflows-REQUIREMENTS.md:80]`
It is booked to Phase 113 in the traceability table
`[VERIFIED: REQUIREMENTS.md:107 — "WLIF-04..06, WFLW-04 | Phase 113 | Pending (re-land)"]`.

`grep -rn "stale workflow" extensions/ tests/ docs/` returns **nothing**;
`grep -rn "staleWorkflowCommand"` likewise. `[VERIFIED: run this session, rc=1]`
Neither the ROADMAP's eight success criteria nor CONTEXT.md mentions WLIF-06 or
a reload-remedy signal anywhere.

**What the archived implementation looked like.** On
`features/workflows-spike`, WLIF-06 is a new closed-set `Reason` member
`"stale workflow command"` stamped by **four user-typed lifecycle verbs** —
`uninstall.ts:246,745`, `enable-disable.ts:383,424` (disable, both the clean and
partial-cascade arms), `reinstall.ts:1968`, `update.ts:2368` — and deliberately
kept OFF the exported enable/disable outcome union so the load-time reconcile
projection cannot stamp it. Its gate is *previous-names minus staged-names*, so
a RENAME retires a command exactly as a deletion does. The catalog prose from
that branch states the reason it needs a token of its own:

> The existing `/reload to pick up changes` trailer does not state this on its
> own -- that trailer is about picking up NEW things, while this is a REMOVED
> command that is still live.

`[CITED: features/workflows-spike:docs/output-catalog.md:682]`

**Why it matters now.** Three of those four verbs (uninstall, disable,
reinstall) shipped their workflow removal in Phase 112 **without** the stamp. So
WLIF-06 is not an update-only obligation, and satisfying it inside Phase 113's
stated criteria is not possible without either widening the phase or leaving
three verbs silent.

**Blast radius if it lands here** (all measured):
`shared/notify.ts` `REASONS` tuple (43 → 44) and the `Reason` union;
`shared/notify-reasons.ts` topic groups + `_ReasonsCoverageProof`;
`tests/architecture/notify-closed-set-locks.test.ts` (the exact-length pin, with
a comment line explaining the bump — the file's own convention);
`tests/architecture/compat-01-no-expansion.test.ts` (ENUMERATION equality, not a
count); `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts`
(paired fixture per stamping verb); plus the per-verb outcome shapes in
`orchestrators/types.ts` and the four stamp sites.

**Recommendation.** Escalate to the user before decomposition. Three defensible
routes, in preference order:

1. **Land WLIF-06 in Phase 113 across all four verbs**, as a ninth criterion.
   Honest to the requirement; it is one closed-set amendment plus four small
   stamps, and the archived design is complete. Cost: roughly one extra plan.
2. **Scope it to the two verbs this phase touches** (update, disable) and carry
   uninstall + reinstall forward to Phase 114 with an explicit ROADMAP criterion.
   Cheaper, but ships an inconsistent vocabulary — the same fact reported by two
   verbs and not by two others.
3. **Re-scope the requirement** (as WPTH-02 and WNAM-03 were re-scoped in
   Phases 110-111) and book it to Phase 114 with its own criterion. Cleanest
   bookkeeping; the risk is a requirement that keeps sliding, and Phase 114 is
   "degradation and documentation", not lifecycle.

Whichever route is chosen, the recorded lesson applies: *a verifier deferral
needs a carrier* — put it in the target phase's ROADMAP criteria, not in
CONTEXT's Deferred Ideas or STATE's Current Position, both of which evaporate.

### 2. Where do the `preview`-tense phrases actually render? (MEDIUM — resolve before the criterion-5 slice.)

**RESOLVED — `info` renders them.** A warnings channel is added to the `info`
surface rather than shipping strings with no reader. Recorded as an amendment to
ROADMAP criterion 5 and in `113-CONTEXT.md` §criterion 5; implemented by
`113-01-PLAN.md` task 3, routed through the existing `redactAbsolutePaths` so
the rendered bytes stay pinnable. The `pending` middle path was considered and
rejected: a plugin the user has not installed never appears there.

**What we know.** CONTEXT locks the mechanism (a `tense` discriminant) and the
exact wording. Criterion 5's stated harm is that on `info` for a not-installed
plugin, the install-tense rows "are a false statement".

**What's unclear.** `info` has no free-text warning channel — `PluginInfoRow`
carries only closed-set `reasons` (Pitfall 5). The archived spike's
`discoverWorkflowNames` destructures `{ discovered }` and **discards
`warnings`**. If Phase 113 does the same, the preview phrases are produced and
never shown, and criterion 5 becomes a correctness-of-an-unreachable-string.

**Recommendation.** Implement the CONTEXT-locked mechanism exactly as specified
and pass `tense: "preview"` from every `info` discovery call, but **state
explicitly in the plan whether `info` renders the warnings**, and put the
question to the user in one line. The mechanism is worth having regardless: it
removes the false statement at the source and stops the next surface from
inheriting it. The alternative — inventing a warnings channel on `info` — is a
new user-visible surface that CONTEXT did not authorize and that the byte-equality
catalog would have to absorb. Do not invent it silently.

A middle path worth naming to the user: `pending`'s `will install` rows are the
one *pre-install* surface that already renders per-plugin previews, and criterion
7 is already opening a channel there. That is a natural home for a preview-tense
row — but it is out of scope as written.

### 3. WLIF-04 (reinstall) appears already satisfied by Phase 112. (LOW — a traceability correction.)

**RESOLVED — verify, then correct.** `113-04-PLAN.md` task 3 writes the case
first and moves the traceability row in the same commit as the evidence; if the
verification finds a real gap, the executor implements the missing half instead
of editing the row.

`reinstall.ts` imports the workflows bridge and composes workflow names into its
outcome (`reinstall.ts:94, 151, 1634-1635`), and STATE.md records `112-03` as
landing "reinstall's bespoke re-materialization" in three commits. The
`REQUIREMENTS.md` traceability table still books WLIF-04 to Phase 113.

**Recommendation.** Verify with a case (reinstall replaces a workflow artifact —
old envelope gone, new envelope present, record rewritten) rather than assuming,
then correct the traceability row in the same commit. A verify-then-correct costs
one test; assuming costs a requirement marked complete on someone else's evidence.

### 4. What does the enable row DO with `stagedWorkflowNames`? (MEDIUM, subsumed by Q1.)

**RESOLVED — closed by Q1.** WLIF-06's enable stamp is the consumer, so the
field is not added and discarded. The token rides the module-private sentinel
only and stays off the exported enable/disable outcome union, which is what
keeps the load-time reconcile projection from stamping it.

Criterion 2 requires the names to ride the projection. The two sibling members
exist to drive soft-dep markers that are Phase 114's. If WLIF-06 lands here
(Q1 route 1 or 2), the enable/disable arm is its consumer and the question
closes. If not, the field is added with no consumer — which is precisely the
"member both call sites discard" shape Phase 112 refused to add. **The two
questions must be answered together.**

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | everything (native TS strip, `node:test`) | ✓ | v26.8.1 locally; CI pins Node 24; `engines` floor `>=20.19.0` | — |
| npm | dependency install, script runner | ✓ | 11.19.0 | — |
| TypeScript | `npm run typecheck` | ✓ | `^6.0.3` (devDependency, installed) | — |
| `node_modules` present in this checkout | the whole gate chain | ✓ | — | — |
| `tsc --noEmit` baseline | criterion 8 | ✓ green | exit 0, measured this session | — |
| `pre-commit` framework | commit-time gates | not probed | — | Run `pre-commit run --all-files` manually before each commit (there is no installed hook in this checkout per operator memory). |
| `fallow` | `npm run fallow` (3 sub-gates) | ✓ | `^3.17.0` (devDependency) | — |
| Network | nothing in this phase | n/a | — | Every seam here is offline by construction (NFR-5). |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `pre-commit` was not probed; treat the
manual `run --all-files` invocation as the contract, per CLAUDE.md.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in), Node 26.8.1 local / 24 in CI |
| Config file | none — glob-driven from `package.json` scripts |
| Quick run command | `node --test "tests/orchestrators/plugin/update.test.ts"` (single file; substitute the pair under work) |
| Full suite command | `npm run check` |

The full gate chain, verbatim `[VERIFIED: package.json:77]`:

```
"check": "npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm test && npm run test:integration",
```

Two gates in that chain are easy to forget and both bear on this phase:
`test:corresponding` requires every production file to have a paired test file,
and `test:coverage:direct:negative` guards the direct-coverage measurement
itself. No new production FILE is strictly required by this phase (the new scan
is a sibling export inside the existing `workflows-staging-gc.ts`, which already
has `tests/orchestrators/plugin/workflows-staging-gc.test.ts`), so the pairing
gate should stay satisfied without new files.

### Phase Requirements → Test Map

| Criterion / Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| Crit 1 / WLIF-02-behavior | `update` prepares/aborts/commits/records workflows | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ (8519 lines) |
| Crit 1 (record policy) | intent-mark union; finalize narrow-with-placed-names; failure arm | unit | same | ✅ |
| Crit 2 / WLIF-05 | `stagedWorkflowNames` on `InstallLedgerSummary`; enable re-materializes; disable unstages | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/install.test.ts` | ✅ |
| Crit 3 | two consecutive `applyReconcile` runs materialize nothing new | integration | `node --test tests/integration/workflow-kind-inversion.test.ts` (or a new sibling) | ✅ file exists; case ❌ Wave 0 |
| Crit 3 (unit half) | plan buckets exclude a clean recorded record; backfill gates hold | unit | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/backfill.test.ts` | ✅ |
| Crit 4 (`info` bytes) | `workflows:` line renders last, both arms | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` + paired `docs/output-catalog.md` states | ✅ runner; ❌ fixtures Wave 0 |
| Crit 4 (`info` composition) | admitted arms only; generated names; sorted | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ (6983 lines) |
| Crit 4 (`list` guard) | a workflow-bearing plugin's `list` row is byte-stable | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ✅ runner; ❌ fixture Wave 0 |
| Crit 4 (tuple guard) | widening `components` without the tuple fails typecheck | compile-time | `npm run typecheck` + a deliberate revert as negative control | ❌ Wave 0 (the forcing proof does not exist) |
| Crit 5 / WR-09 | both tense tables; per-call-site `read` vs `inspected` split; install phrases byte-identical | unit | `node --test tests/bridges/workflows/discover.test.ts` | ✅ (~25 discovery call sites to update) |
| Crit 6 / WR-03 | one case per widened slot, driven through `update` | unit | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/types.test.ts` | ✅ files; ❌ cases Wave 0 |
| Crit 7 / WR-06 | `scanRetainedWorkflowsStaging` reports exactly the retained set, sorted, count-bearing; sweep signature unchanged | unit | `node --test tests/orchestrators/plugin/workflows-staging-gc.test.ts` | ✅ (387 lines) |
| Crit 7 (render) | advisory line on BOTH `pending` arms, byte-identical | byte-equality | `node --test tests/architecture/catalog-uat.test.ts tests/orchestrators/reconcile/pending.test.ts` | ✅ runners; ❌ fixtures Wave 0 |
| WLIF-04 | reinstall replaces a workflow artifact | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ file; case existence unverified (Open Question 3) |
| WLIF-06 | the reload remedy is stated on a retiring row | unit + byte-equality | depends on Open Question 1 | ❌ nothing exists |
| Crit 8 | whole chain green | gate | `npm run check` | ✅ |

### Sampling Rate

- **Per task commit:** `npm run typecheck` + the single-file `node --test` for
  the pair(s) touched + `npm run test:coverage:direct` for those pairs.
- **Per wave merge:** `npm run lint && npm run fallow && npm test`.
- **Phase gate:** `npm run check` green end to end, plus
  `pre-commit run --all-files` leaving no file modified.

Recorded operator preference: do not re-run a suite an executor already reported
green — spot-check with grep / git log instead.

### Wave 0 Gaps

- [ ] The `COMPONENT_KINDS` compile-forcing proof — nothing guards the widening
      direction today (Pitfall 1). Land with a negative control.
- [ ] `docs/output-catalog.md` + `catalog-uat.test.ts` paired fixtures for: an
      `info` row with a `workflows:` line (resolved arm), an `info` row with a
      `workflows:` line (state-only arm), the `list` regression row, and the two
      `pending` arms carrying a retained-tree advisory.
- [ ] Criterion-6 cases: one per widened slot (`update.ts`'s
      `PHASE3_FAILURE_PHASES`, `orchestrators/types.ts::UpdatePhaseBridge`,
      `shared/errors.ts::Phase3Failure["phase"]`), each driving a **workflows**
      failure through the `update` verb.
- [ ] A workflows-failure vehicle for `update` — the analogue of the Phase 112
      finding that "the disk-state undo test does not exist". A `WorkflowTarget-
      OccupiedError` planted at a target path is the cheapest deterministic
      vehicle (it places nothing, so `onPlaced` reports `[]` and the finalize
      failure arm narrows to the recorded names alone).
- [ ] A criterion-3 double-reconcile idempotence case with a negative control.
- [ ] `tests/bridges/workflows/discover.test.ts` — every existing
      `discoverPluginWorkflows({ pluginName, resolved })` call needs a `tense`
      if the parameter is required (~25 sites).

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this
section is required.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | No credential path in this phase. `platform/git-credential.ts` is untouched; every seam here is offline. |
| V3 Session management | no | No session concept. |
| V4 Access control | **yes** | The workflows saved directory is shared with the user's own hand-saved workflows and with every other plugin. `assertTargetsUnoccupied` (`bridges/workflows/stage.ts:295-303`) is the ownership control: a target still occupied after the displacement is FOREIGN by construction and the commit REFUSES it. The update path must supply `previousWorkflowNames` from the record so this control is reachable. |
| V5 Input validation | **yes** | Plugin-declared component paths are attacker-controlled strings. `assertPathInside` runs on every declared workflows directory (`discover.ts:267-271`) and on every composed artifact path (`locations.workflowArtifactPath`). The new `info` threading must not introduce a path composer that bypasses either. |
| V6 Cryptography | no | None used. |
| V12 File handling | **yes** | This phase's central risk. Verbatim third-party executable JavaScript is written to a directory outside every scope root, and this phase adds a read surface that enumerates those directories. |

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation | Status in this phase |
|---|---|---|---|
| Symlinked staging segment redirects a recursive `rm` or a read | Tampering | `assertPathInside(workflowsHomeDir, candidate, …)` anchored ONE LEVEL ABOVE the staging directory, resolved BEFORE any read through the candidate (WPTH-04 / WR-07) | The new scan must repeat this. Anchoring at `workflowsStagingDir` leaves a check that cannot fail. |
| Symlinked `.previous/` segment | Tampering | Same anchor-one-level-up rule inside the commit (`stage.ts:254-262`) | Unchanged; the scan reads through `.previous/` only after the containment assertion above it. |
| Renaming over a file the plugin does not own | Tampering / Repudiation | `WorkflowTargetOccupiedError`, whole-set check before the first rename | Made reachable by criterion 1's `previousWorkflowNames` wiring. |
| Executable envelopes stranded with nothing naming them | Denial of service / Tampering | The CR-02 record policy (Pattern 3) | **New in this phase.** Pitfall 2. |
| Retained recovery copies invisible to the operator, forever | Repudiation | Criterion 7's read surface | **The point of criterion 7.** |
| Information disclosure via rendered absolute paths | Information disclosure | The `pending` invalid-config arm renders BASENAMES, never absolute paths (T-53-02-02, `pending.ts:79-89`); `apply.ts` imports `redactAbsolutePaths` | **Open design point:** the retained-tree advisory is specified by CONTEXT to carry "the staging path". Decide deliberately between the full path (needed for a by-hand recovery) and a redacted/relative form, and record the decision. `redactAbsolutePaths` already exists in `shared/notify.ts`. The path is under the user's own home directory, which argues for the full path; the precedent argues for redaction. |
| A per-file soft-fail phrase leaking file contents | Information disclosure | `softFailWarning` renders the file NAME, the DIRECTORY and the handed reason — never the body | Preserved by keeping the single template (criterion 5 forbids a second one). |
| Symlinked script bodies copied into an envelope | Information disclosure | Two independent symlink refusals in discovery (`dirent.isFile()` then `lstat`) | Unchanged; do not weaken while threading `tense`. |

## Sources

### Primary (HIGH confidence)

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — lines
  1-130, 740-810, 1240-1480, 1827-1890, 1925-2050, 2070-2200, 2280-2480
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — lines
  355-404, 500-560, 825-845, 1160-1350
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` —
  lines 200-380
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — lines
  628-748, 1180-1360, 1880-1915, 2060-2090
- `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts` — full
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` — full
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (header),
  `plan.ts` (header), `backfill.ts` (lines 55-104, 300-370)
- `extensions/pi-claude-marketplace/bridges/workflows/{discover,stage,types}.ts` — full
- `extensions/pi-claude-marketplace/shared/notify.ts` — lines 1357-1600,
  3495-3562, 3765-3790
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — lines 1-60, 240-271
- `extensions/pi-claude-marketplace/orchestrators/types.ts` — lines 135-230
- `package.json`, `.fallowrc.json`, `.planning/config.json`
- `tests/architecture/catalog-uat.test.ts` (header),
  `notify-closed-set-locks.test.ts` (header),
  `compat-01-no-expansion.test.ts` (header),
  `notify-stamp-coverage.test.ts` (header)
- `docs/output-catalog.md` — the `info` and `pending` sections and their
  `catalog-state` inventory
- Empirical probes run this session:
  `scratchpad/tupleprobe/{probe,probe-neg,probe-force}.ts` against
  `tsc --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess`;
  baseline `npx tsc --noEmit` (exit 0)
- `git diff features/workflow…features/workflows-spike` and `git show
  features/workflows-spike:…` for `update.ts`, `update-row.ts`,
  `enable-disable.ts`, `info.ts`, `types.ts`, `docs/output-catalog.md`

### Secondary (MEDIUM confidence)

- `.planning/workstreams/workflows/{ROADMAP,STATE,REQUIREMENTS}.md` and
  `milestones/workflows-REQUIREMENTS.md` — the requirement text and the
  Phase 111/112 carry-forwards
- `.planning/codebase/{ARCHITECTURE,CONVENTIONS,STACK}.md` — layer rules and
  gate descriptions (STACK.md's `npm run check` description is stale; the
  `package.json` text supersedes it)

### Tertiary (LOW confidence)

- None. No web search was performed and none was needed: every question this
  phase raises is answerable from the tree.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no packages are added; the "stack" is the existing
  first-party seams, all read this session.
- Architecture: HIGH — every seam was opened and quoted verbatim with line
  citations. The one structural claim I did not merely read but *tested*
  (the `COMPONENT_KINDS` tuple) is the one that turned out to be false.
- Pitfalls: HIGH for 1-6 (each measured), MEDIUM for the fallow-ceiling
  assumption A1.
- Requirement coverage: MEDIUM — WLIF-06 has no criterion and no
  implementation, and WLIF-04 appears already satisfied. Both need a decision
  before planning (Open Questions 1 and 3).

**Read method note:** file contents were opened directly this session via the
`Read` tool and via `sed -n` line-range reads under the working directory's
Bash-first policy. Every `[VERIFIED: path:lines]` claim quotes the source
verbatim beside the citation so the tag is checkable; no discrete value in this
document was taken from memory or from a search result.

**Research date:** 2026-09-05
**Valid until:** 2026-10-05 for the stack claims; **valid only against
`features/workflow` at `4195e77d`** for every line-number citation — the
operator edits this checkout concurrently, so re-anchor line numbers before
relying on them in a plan task.

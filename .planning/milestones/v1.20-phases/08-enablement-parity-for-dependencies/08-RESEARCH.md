# Phase 8: Enablement parity for dependencies - Research

**Researched:** 2026-09-19
**Domain:** In-repo TypeScript orchestrator work (no new external packages) — extends the existing `enable`/`disable` verb pair and the existing install cascade with dependency awareness, following patterns already shipped in Phases 3-7 of this milestone.
**Confidence:** HIGH — every claim below is grounded in this session's direct reads of the cited files/lines, not training-data recall. This is a closed, self-contained codebase with no third-party API surface to research; the "research" here is source-tracing the exact seams EDEP-01/02/03 must extend.

## Summary

Phase 8 has no new library to select — it is pure extension of code that already exists in this repository. `orchestrators/plugin/enable-disable.ts` today has zero dependency awareness (confirmed by reading the full file: no `dependency-index` import, no closure walk, no `buildScopeDeclarationIndex` call). The three requirements attach to three different, already-established seams:

- **EDEP-01** (enable cascades transitively) reuses `domain/dependency-closure.ts::resolveDependencyClosure` for ordering (exactly as the install cascade does) and the single-plugin `runEnableBranch`/`runInstallLedger` machinery already inside `enable-disable.ts` for materializing each dependency member. It needs a NEW multi-row rendering path — today `enable-disable.ts` only ever emits ONE row per command; a cascade emits one row per closure member, the pattern `install-cascade.messaging.ts::composeCascadeMemberRows` already established.
- **EDEP-02** (disable refusal) reuses `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationIndex` + `domain/dependency-orphans.ts::findDependents`, the exact shape `uninstall.ts::readDeclarers` already calls — but where `uninstall.ts` now (post Phase 6/D-06-06) *proceeds* and reports dependents on the success row, EDEP-02 must go back to *refusing*, which is the retired PRUNE-05/D-05-14..16 shape from Phase 5, not the current uninstall shape. This is a "resurrect a retired pattern on a different verb," not "copy the current uninstall behavior."
- **EDEP-03** (enable a disabled dependency through its record) touches TWO call sites, not one: the standalone `enable` command's cascade (EDEP-01's own new code) AND the **install cascade's `alreadyInstalled` skip arm** in `install-cascade.ts`/`install-cascade.messaging.ts`, which today only *reads* state (`checkInstalledMember`, `recordedDisabled`) and never writes it. The RESV-05 skip row `{already installed, dependency disabled}` (`install-cascade.messaging.ts:236-238`) must be replaced by an actual state write plus a new `{dependency enabled}` token, following the `dependency promoted` precedent (`install-flow.ts::promoteDependencyRecord`) byte-for-byte in spirit: an `installed` row carrying `["already installed", "dependency enabled"]`, not a `skipped` row.

**Primary recommendation:** Do not build a new mechanism for any of the three requirements. EDEP-01's per-dependency materialization is `runEnableBranch`'s existing `runInstallLedger(..., pinVersionOverride, allowExistingRecord: true, ...)` call, invoked once per closure member. EDEP-02's guard is `buildScopeDeclarationIndex` + `findDependents`, called before the disable branch runs, refusing exactly as PRUNE-05 used to. EDEP-03's "enable through the record" is the SAME `runInstallLedger` re-materialization pattern used by `runEnableBranch` (enable command) and `materializePromotedRecord` (D-04-07 install-by-name promotion) — apply it a third time, to the install cascade's already-installed-but-disabled members.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enable cascade closure walk (EDEP-01) | Orchestrator (`orchestrators/plugin/enable-disable.ts`) | Domain (`domain/dependency-closure.ts`) | The walk itself is pure domain logic (already exists, reused as-is); the orchestrator drives it against live state and issues the per-member materialization writes. |
| Disable refusal / dependents guard (EDEP-02) | Orchestrator (`orchestrators/plugin/enable-disable.ts`) | Orchestrator (`orchestrators/plugin/dependency-index.ts`) | The guard is a state read (offline, in-scope) gating a state write; both live at the orchestrator tier, same as `uninstall.ts`'s existing guard. |
| Enable-through-record for a disabled dependency (EDEP-03) | Orchestrator (`orchestrators/plugin/enable-disable.ts` + `orchestrators/plugin/install-cascade.ts`) | Persistence (`persistence/state-io.ts`) | Both the enable cascade's own write and the install cascade's already-installed arm mutate the SAME state record shape; the persistence layer owns the record's shape (`toDisabledRecord`/`isRecordedButDisabled`), never the write policy. |
| Closed-set reason token registration (`{dependency enabled}`) | Shared (`shared/notification-types.ts`, `shared/notify-reasons.ts`) | Docs (`docs/output-catalog.md`) | Byte-contract vocabulary lives centrally; every producer (enable-disable, install-cascade) reads the same closed set, never defines its own. |
| Docs divergence reversal | Docs (`docs/plugin-enablement.md`) | — | Pure documentation; no code tier owns it. |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-08-01 — Disable refusal, chained command form (EDEP-02).** Upstream's refusal text is a template — `X is still required by A, B. Disable those plugins first, or disable everything together: <chained command>` — but the `disable` command only ever takes one `<plugin>@<marketplace>` target; no multi-target syntax exists (`edge/handlers/plugin/enable-disable.ts::parseRequiredPluginMarketplaceRef`). The operator chose a **plain-English instruction** over inventing shell-chaining syntax that implies a CLI capability that doesn't exist: name the dependents and the order, e.g. "Disable A, B first, then X" — not `disable A@mp && disable B@mp && disable X@mp`. Reversibility: one-way — a published catalog row; wording is Claude's Discretion within this constraint.

**D-08-02 — EDEP-03 reporting, new closed-set token.** When install/enable turns on an already-installed, disabled dependency through its record, the row carries a **new closed-set reason token, `{dependency enabled}`** — parallel to the existing register (`dependency promoted`, `dependency disabled`, `dependency pruned`), not a plain `enabled` status with no reason. This retires the `{already installed, dependency disabled}` skip row (RESV-05) per ROADMAP success criterion 3. Needs the full closed-set amendment mechanism (fixture, both contract constants, length lock, both enumeration pins, `notify-reasons.ts` header count) exactly as D-04-07 and D-05-11 did. Reversibility: one-way — a published catalog row.

**D-08-03 — EDEP-01 cascade reporting, full closure not just state changes.** `enable <plugin>` reports **every** dependency in the transitive closure on its own row, including ones that were already enabled — not only the ones actually flipped from disabled to enabled. This matches the install cascade's established per-member reporting convention (every closure member gets a row, e.g. `{already installed}`) rather than a quieter changes-only report. The exact per-row token for an already-enabled member (e.g. an `{already enabled}` parallel, or reuse of an existing idempotent-state token) is Claude's Discretion, following the same register D-08-02 extends. Reversibility: one-way — a published catalog row; exact per-row wording is Claude's Discretion within this constraint.

### Claude's Discretion

- Exact prose for D-08-01's plain-English instruction (dependent ordering, punctuation) — follow `docs/messaging-style-guide.md`.
- Exact per-row token for an already-enabled dependency under D-08-03's full closure (new token vs. reuse of an existing idempotent-state token) — whichever is truthful and avoids inventing a redundant closed-set member. **Research finding: `"already enabled"` already exists in `REASONS` (`shared/notification-types.ts:33`) as the enable-command's own idempotent-skip token — reuse is directly available and needs no new token.**
- Disambiguating the `enable-disable.ts` naming collision: its existing in-code "dependencies" concept is the soft-dep companion extensions (pi-subagents, pi-mcp-adapter), unrelated to plugin dependencies — name the new code so the two don't read as the same thing (ROADMAP Notes flags this explicitly).
- Whether the async dependency-satisfaction read for EDEP-01/EDEP-03 reuses `buildScopeDeclarationIndex` directly or a purpose-built sibling — same discretion Phase 6 (D-06-04's note) left open for its own call site; this phase's cascade enable is a new caller, not a new offline-read mechanism.
- Whether a manual `enable <plugin>` on a record still carrying Phase 6's `dependencyDisabled` consequence-marker clears the marker as part of the same write, or leaves it for the next reconcile pass to self-correct — Phase 6's own Discretion note already established that either is behaviorally safe (reconcile re-derives the marker every pass); this phase should clear it at write time if convenient, but must not add defensive code beyond that.

### Deferred Ideas (OUT OF SCOPE)

- **`BACKLOG DEPS-STATUS-01`** (a plugin whose dependency is partially installed is itself partial) — explicitly named in ROADMAP success criterion 4 as staying open; not upstream parity, not pulled into this phase.
- **A `list`/`info` marker distinguishing a consequence-disabled plugin from a user-disabled one** — named as out of scope back in Phase 6's CONTEXT.md; still not requested here.
- Reload installing a MISSING declared dependency (Phase 9), constraint-aware update (Phase 10), cross-marketplace allowlist (Phase 11), standalone `prune` (Phase 12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDEP-01 | `enable <plugin>` also enables the plugin's declared dependencies, transitively, in the same scope, and lists them. | `domain/dependency-closure.ts::resolveDependencyClosure` supplies the post-order walk (verified read, full file). `enable-disable.ts::runEnableBranch` supplies the per-member materialization primitive (verified read, lines 275-379). `install-cascade.messaging.ts::composeCascadeMemberRows` (lines 196-249) is the multi-row rendering precedent to follow. See Architecture Patterns § "Enable cascade" below. |
| EDEP-02 | `disable <plugin>` is refused while an enabled installed plugin in the scope declares it; the refusal names the dependents and gives the one command that disables them together. | `dependency-index.ts::buildScopeDeclarationIndex` (verified read, full file) + `domain/dependency-orphans.ts::findDependents` (verified read, lines 1-51) supply the declarer read. `uninstall.ts::readDeclarers`/`UninstallRefusedError` (verified read, lines 220-285) is the refusal-shape precedent, now RETIRED from uninstall by D-06-06 but exactly what EDEP-02 needs to resurrect on `disable`. See Common Pitfalls § "Don't copy uninstall's current behavior." |
| EDEP-03 | Installing or enabling a plugin enables an already-installed, disabled dependency through its record -- the desired-state config never names a dependency (D-04-02) -- and reports it on the row; the `{already installed, dependency disabled}` skip is retired. | `install-cascade.ts::checkInstalledMember`/`recordedDisabled` (verified read, lines 670-718) is the current READ-ONLY skip that must become a WRITE. `install-flow.ts::promoteDependencyRecord`/`materializePromotedRecord` (verified read, lines 872-1030) is the direct precedent for "re-materialize a disabled record through its own record, not the config." `install-cascade.messaging.ts:228-246` is the exact row that must change from `skipped` to `installed` + new token. See Architecture Patterns § "Enable-through-record" and Common Pitfalls § "EDEP-03 is two call sites, not one." |
</phase_requirements>

## Standard Stack

Not applicable. This phase adds no new runtime dependency, dev dependency, or external service. All work is internal TypeScript composed from modules that already exist in `extensions/pi-claude-marketplace/`. `npm view` / registry checks are not applicable — there is nothing to install.

## Package Legitimacy Audit

Not applicable — no external packages are introduced or modified by this phase. Skip the legitimacy gate.

## Architecture Patterns

### System Architecture Diagram

```
                          /claude:plugin enable <plugin>@<mp> [--scope] [--local]
                                              |
                                              v
                          edge/handlers/plugin/enable-disable.ts
                          (thin shim: parse args, call orchestrator, catch-all notify)
                                              |
                                              v
              orchestrators/plugin/enable-disable.ts :: setPluginEnabledWithTransaction
                                              |
                     resolveCrossScopePluginTarget -> locked state transaction
                                              |
                    +-------------------------+--------------------------+
                    |                                                    |
         EDEP-01/EDEP-03 (enable=true)                        EDEP-02 (enable=false)
                    |                                                    |
      [NEW] resolve dependency closure                    [NEW] buildScopeDeclarationIndex
      domain/dependency-closure.ts                          orchestrators/plugin/dependency-index.ts
      resolveDependencyClosure(rootKey, lookup,                          |
        installedKeys, knownMarketplaces)                    domain/dependency-orphans.ts
                    |                                          findDependents(key, index)
      For each closure member (post-order):                              |
        - already enabled -> report, no write            dependents.length > 0 ?
        - disabled record  -> runEnableBranch's                          |
          runInstallLedger(pinVersionOverride,            YES -> REFUSE: compose plain-English
          allowExistingRecord: true) [existing               instruction naming dependents
          machinery, called per member]                      (D-08-01), no state write, no
                    |                                         cascade to runDisableBranch
      Root plugin's own enable proceeds exactly                          |
      as today (runEnableBranch unchanged)                   NO  -> proceed to existing
                    |                                          runDisableBranch (unchanged)
                    v
      composeCascadeMemberRows-style multi-row render
      (root row + one row per dependency, sorted)
                    |
                    v
           notifyWithContext(ENABLE_CONTEXT, [{ marketplace, scope,
             plugins: [rootRow, ...memberRows] }])


  SEPARATE call site -- EDEP-03's install-time arm:

           orchestrators/plugin/install-cascade.ts :: runInstallCascade
                              |
              resolveDependencyClosure -> closure.alreadyInstalled
                              |
              resolveMemberConstraints -> checkInstalledMember (READ-ONLY today)
                              |
        [CHANGED] for each alreadyInstalled member that is disabled:
          instead of leaving it alone, re-materialize through its record
          (same runInstallLedger pattern as runEnableBranch /
          materializePromotedRecord) -- config never touched (D-04-02)
                              |
              install-cascade.messaging.ts :: composeCascadeMemberRows
        [CHANGED] alreadyInstalled+disabled member renders an `installed`
          row with reasons ["already installed", "dependency enabled"],
          not a `skipped` row with ["already installed", "dependency disabled"]
```

### Recommended Project Structure

No new files are structurally required; every requirement is an edit inside an existing module. If cognitive-complexity pressure forces extraction (see Common Pitfalls § ceiling), new helper functions should live in the SAME file as their caller (matching this codebase's established pattern of "extend with helpers, not branches" cited directly in the phase Notes) rather than a new module:

```
extensions/pi-claude-marketplace/
├── orchestrators/plugin/
│   ├── enable-disable.ts            # EDEP-01 cascade walk + EDEP-02 guard added here
│   ├── enable-disable.messaging.ts  # multi-row EnableMsg/DisableMsg composition added here
│   ├── dependency-index.ts          # UNCHANGED — reused as-is (buildScopeDeclarationIndex)
│   ├── install-cascade.ts           # EDEP-03's install-time write added to alreadyInstalled handling
│   └── install-cascade.messaging.ts # EDEP-03's row token change (skipped -> installed)
├── domain/
│   ├── dependency-closure.ts        # UNCHANGED — reused as-is for EDEP-01 ordering
│   └── dependency-orphans.ts        # UNCHANGED — reused as-is (findDependents) for EDEP-02
├── shared/
│   ├── notification-types.ts        # REASONS tuple: +1 member `"dependency enabled"`
│   └── notify-reasons.ts            # topic-grouped register: +1 member, header count bump
└── docs/
    ├── plugin-enablement.md         # §"A plugin required..." REWRITTEN (lines 40-46)
    └── output-catalog.md            # new/changed rows, byte + state counts
```

### Pattern 1: Per-member re-materialization through the record (the D-04-07 / ENBL-02 precedent EDEP-03 must reuse a third time)

**What:** A disabled installed record is turned back on by calling the SAME guard-free `runInstallLedger` the enable command uses, pinned to the record's own recorded version, with `allowExistingRecord: true` so the "already installed" sanity check does not fire.

**When to use:** Any time code needs to re-materialize a plugin's artifacts from a disabled record WITHOUT touching the desired-state config (D-04-02: the config never names a dependency).

**Example (verified read, `orchestrators/plugin/enable-disable.ts:313-332`):**
```typescript
// Source: orchestrators/plugin/enable-disable.ts, runEnableBranch (verified read)
const result = await transaction.runInstallLedger(
  state,
  locations,
  {
    ctx: opts.ctx,
    scope,
    cwd: opts.cwd,
    marketplace: opts.marketplace,
    plugin: opts.plugin,
    pinVersionOverride: recordedVersion,
    allowExistingRecord: true,
    partial,
    removalOps: createRemovalOps(),
  },
  capture,
);
```

**Second precedent, same mechanism (verified read, `orchestrators/plugin/install-flow.ts:1007-1030`), used by the D-04-07 promotion arm:**
```typescript
// Source: orchestrators/plugin/install-flow.ts, materializePromotedRecord (verified read)
async function materializePromotedRecord(
  args: PromotionArgs,
  record: PluginInstallRecord,
): Promise<InstallLedgerSummary> {
  const { opts } = args;
  const result = await runInstallLedger(
    args.state,
    args.locations,
    {
      ctx: opts.ctx,
      scope: opts.scope,
      cwd: opts.cwd,
      marketplace: opts.marketplace,
      // ... pinVersionOverride + allowExistingRecord follow, mirroring runEnableBranch
```

EDEP-03's install-cascade arm and EDEP-01's cascade-member arm are both a THIRD invocation of this exact pattern — not a new one. The planner should treat "reuse `runInstallLedger` with `pinVersionOverride` + `allowExistingRecord: true`" as the settled answer to "how does a disabled dependency get materialized," and scope the plan's tasks around wiring the CALL, not inventing the mechanism.

### Pattern 2: Declarer index + dependents guard (the retired PRUNE-05 shape EDEP-02 must resurrect)

**What:** Before allowing a destructive/state-changing action against a plugin, read who else in the scope declares it as a dependency, and refuse if the set is non-empty.

**When to use:** EDEP-02's disable guard. NOT applicable to `uninstall` any more (Phase 6/D-06-06 deliberately retired the uninstall refusal in favor of allow-and-report — see Common Pitfalls below for why this is the OPPOSITE of what EDEP-02 needs).

**Example (verified read, `orchestrators/plugin/uninstall.ts:265-285`, now superseded on `uninstall` but the shape EDEP-02 needs):**
```typescript
// Source: orchestrators/plugin/uninstall.ts, readDeclarers (verified read; superseded on
// THIS verb by D-06-06, but its buildScopeDeclarationIndex + findDependents composition
// is exactly what EDEP-02's disable guard needs to resurrect)
async function readDeclarers(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly key: string;
}): Promise<DeclarerReading> {
  const result = await buildScopeDeclarationIndex({
    state: args.state,
    locations: args.locations,
    exclude: args.key,
  });
  if (!result.ok) {
    throw new UninstallRefusedError("unreadable", result.cause.message);
  }
  return { snapshot: result, dependents: findDependents(args.key, result.index) };
}
```

**The dependents-rendering helper (verified read, `domain/dependency-orphans.ts:42-51`):**
```typescript
// Source: domain/dependency-orphans.ts, findDependents (verified read, full file)
export function findDependents(target: string, index: DeclarationIndex): readonly string[] {
  const dependents: string[] = [];
  for (const [holder, declared] of index) {
    if (declared.has(target)) {
      dependents.push(holder);
    }
  }
  return dependents.sort((a, b) => a.localeCompare(b));
}
```

D-08-01 locks the refusal's WORDING to plain English ("Disable A, B first, then X"), not the upstream `disable A@mp && disable B@mp` chained-command form, because `parseRequiredPluginMarketplaceRef` (`edge/handlers/plugin/shared.ts`) accepts exactly one `<plugin>@<marketplace>` target and no multi-target syntax exists.

### Pattern 3: Sorted dependent-name rendering with an untrusted-name defense (T-06-02 precedent)

**What:** When a cause line interpolates dependent plugin names straight from state records, an adversarial plugin name (permitted characters include `"`, `,`, spaces, bidi controls per `domain/name.ts::assertSafeName`) could forge the rest of the sentence.

**When to use:** EDEP-02's refusal text names the dependents. This is the EXACT same threat `uninstall.messaging.ts::renderDependents` (verified read, lines ~160-172) already defends against for the now-retired-on-uninstall dependents list, and EDEP-02's refusal text needs the same defense.

**Example (verified read, `orchestrators/plugin/uninstall.messaging.ts`):**
```typescript
// Source: orchestrators/plugin/uninstall.messaging.ts, renderDependents (verified read)
function renderDependents(dependents: readonly string[]): string {
  if (dependents.every(isRenderablePluginKey)) {
    return dependents.join(", ");
  }
  return dependents.length === 1 ? "1 other plugin" : `${dependents.length} other plugins`;
}
```
EDEP-02 should reuse (or closely mirror) this exact guard rather than interpolating `findDependents`'s output directly.

### Anti-Patterns to Avoid

- **Conflating `enable-disable.ts`'s existing `dependencies` field with plugin dependencies.** `EnableMsg`/`PluginInstalledMessage.dependencies` is typed `readonly Dependency[]` where `Dependency = "agents" | "mcp"` (verified read, `shared/concerns/soft-dep.ts:31`) — the soft-dep companion markers (`{requires pi-subagents}`, `{requires pi-mcp}}`), produced by `enableRowDependencies` (verified read, `orchestrators/plugin/shared.ts:129-144`). EDEP-01's cascade rows are a DIFFERENT concept (one row per dependency PLUGIN) and must not be named or typed using this existing `Dependency`/`dependencies` vocabulary. This is the exact naming collision the phase Notes and CONTEXT.md's Claude's Discretion flag; name the new code something distinguishing (e.g. a `ClosureMemberRow`/`DependencyCascadeRow` shape, not a reuse of `EnableMsg.dependencies`).
- **Copying `uninstall.ts`'s CURRENT dependents behavior for EDEP-02.** As of Phase 6 (D-06-06, superseding D-05-14..16), `uninstall` no longer refuses — it proceeds and reports dependents on the success row (LOAD-03). EDEP-02 needs the OPPOSITE: a refusal. The correct precedent is the git history of Phase 5's now-retired `UninstallRefusedError`/PRUNE-05 shape, not `uninstall.ts` as it reads today.
- **Treating EDEP-03 as scoped to `enable-disable.ts` alone.** The requirement text says "Installing OR enabling" — the install cascade's `alreadyInstalled` skip in `install-cascade.ts` is an independent call site that also needs the write. Scoping a plan to `enable-disable.ts` only will under-deliver EDEP-03's install-path arm and leave RESV-05's stale `{already installed, dependency disabled}` row live on install, contradicting ROADMAP success criterion 3's explicit instruction to remove it "from the catalog (fixture, both contract constants, length lock, both enumeration pins)."
- **Flipping the `enabled` boolean without re-materializing.** A disabled record's artifacts are off disk (ENBL-18/19, `enable-disable.ts:439-449` comment block, verified read). "Enables that dependency through its record" (CONTEXT.md ROADMAP language) must restore artifacts to be truthful — a bare `record.enabled = true` write with no `runInstallLedger` call would leave state.json claiming an enabled plugin with nothing on disk, the same NFR-3 fail-clean violation the codebase's comments repeatedly warn against (e.g. `install-cascade.ts:829-832`, `enable-disable.ts` I3 comments).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transitive dependency ordering for the enable cascade | A new closure/graph walk inside `enable-disable.ts` | `domain/dependency-closure.ts::resolveDependencyClosure` | Already handles cycles (`path` stack), diamonds (`visited` memo), post-order accumulation, and the exact `ClosureLookup` seam the install cascade already threads through `dependency-declaration-read.ts`. Reimplementing risks the exact diamond/cycle confusion bug D-03-11's comment block documents as a real defect class. |
| "Who declares this plugin" read for the disable guard | A new declaration-index builder | `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationIndex` | Already fail-closed (D-05-07), already same-scope-only (D-05-05), already includes disabled declarers (D-05-04), already offline (NFR-5-gated). |
| Re-materializing a disabled record's artifacts | A bespoke "just touch the files back" routine | `runInstallLedger` with `pinVersionOverride` + `allowExistingRecord: true` | This is the SAME machinery `runEnableBranch` and `materializePromotedRecord` already use; it handles the partial-installable gate (ENBL-07), hook-cache invalidation, and rollback-on-failure semantics that a hand-rolled write would have to re-derive from scratch. |
| Closed-set reason token registration | An ad hoc string literal in one file | The full closed-set amendment (fixture + both contract constants + length lock + both enumeration pins + `notify-reasons.ts` header count) | `tests/architecture/notify-closed-set-locks.test.ts` and the catalog contract tests fail the build otherwise; D-04-07 and D-05-11 both required touching all ten surfaces `04-06-SUMMARY.md` enumerates (per the phase Notes). |

**Key insight:** Every mechanism EDEP-01/02/03 need already shipped in Phases 3-7 of this same milestone, for a sibling verb. The work in this phase is wiring, not invention — which raises the bar for "don't hand-roll" to include "don't even re-derive a slightly different version of an existing internal seam."

## Common Pitfalls

### Pitfall 1: EDEP-03 is two call sites, not one

**What goes wrong:** A plan that only touches `enable-disable.ts` ships EDEP-01 and the "enable" half of EDEP-03, but leaves `install-cascade.ts`'s `checkInstalledMember`/`resolveMemberConstraints` READ-ONLY, so a fresh `install <plugin>` whose dependency is already-installed-and-disabled still renders the old `{already installed, dependency disabled}` skip row and never writes the record.

**Why it happens:** The CONTEXT.md's code_context section leads with `enable-disable.ts`, and it is easy to read EDEP-03 as "the enable branch's" concern given D-04-07's promotion precedent also lives in `install-flow.ts` (a different file from `install-cascade.ts`).

**How to avoid:** Explicitly scope one plan task (or a dedicated plan) to `install-cascade.ts` lines ~670-750 (`checkInstalledMember`, `recordedDisabled`, `resolveMemberConstraints`) and `install-cascade.messaging.ts` lines 228-246 (`composeCascadeMemberRows`'s `alreadyInstalled` loop), verifying with a real install fixture whose dependency is disabled that the record's `enabled` flips AND the row reads `(installed) {already installed, dependency enabled}`.

**Warning signs:** A plan whose file list omits `install-cascade.ts` / `install-cascade.messaging.ts` entirely; a plan that reuses `docs/dependency-resolution.md:112`'s RESV-05 wording as still-accurate documentation instead of flagging it for the same rewrite `docs/plugin-enablement.md` needs.

### Pitfall 2: Reusing `uninstall.ts`'s CURRENT dependents pattern instead of its RETIRED one

**What goes wrong:** `uninstall.ts` today (post Phase 6) proceeds through a still-declared dependency and reports it on the success row — the opposite of a refusal. A planner skimming `uninstall.ts` for "how do we check dependents" without reading the D-06-06 supersession comment (`uninstall.ts:220-223`, "D-06-06 narrowed this class to that ONE outcome... no longer refused -- it is removed") could copy the ALLOW behavior onto `disable`, which is not what EDEP-02 asks for.

**Why it happens:** `uninstall.ts` is the freshest, most-recently-touched sibling file and its comments are dense with both the CURRENT rule and the RETIRED rule side by side.

**How to avoid:** Read `REQUIREMENTS.md`'s PRUNE-05 entry (lines 84-93) which documents the exact supersession history, and treat `uninstall.ts`'s `UninstallRefusedError` CLASS and `readDeclarers` FUNCTION as the reusable shape while treating its CALLER'S current behavior (proceed) as explicitly not what EDEP-02 wants.

**Warning signs:** A disable refusal test that asserts the disable "proceeds and reports" instead of "refuses and changes nothing."

### Pitfall 3: Cognitive-complexity ceiling on already-near-ceiling files

**What goes wrong:** `enable-disable.ts` and `dependency-index.ts` both already sit near the ESLint sonarjs / fallow cognitive-complexity ceiling of 15 (per the phase Notes: "`enable-disable.ts` and `dependency-index.ts` both already have several near-ceiling extracted helpers"). Adding the EDEP-01 cascade walk or the EDEP-02 guard as inline branches inside `setPluginEnabledWithTransaction` will trip `npm run check`'s lint gate.

**Why it happens:** The existing function is already long and heavily commented; a "just add an `if` for the new case" edit is the path of least resistance.

**How to avoid:** Extract new helper functions (mirroring the existing `runEnableBranch`/`runDisableBranch`/`emitUnresolvedTarget` extraction pattern already used throughout this file) rather than adding branches to the existing entrypoint.

**Warning signs:** `npm run check`'s `fallow health` or ESLint sonarjs step failing on `enable-disable.ts` after the edit.

### Pitfall 4: The closed-set amendment is ten surfaces, not one

**What goes wrong:** Adding `"dependency enabled"` to only `shared/notification-types.ts::REASONS` (the runtime array) passes typecheck but fails `tests/architecture/notify-closed-set-locks.test.ts` (length lock) and the catalog contract tests (`docs/output-catalog.md` byte/state counts), because those are independent pinned assertions, not derived from the array.

**Why it happens:** The array itself looks like "the" source of truth; the parallel pins (both enumeration constants, the fixture, the two catalog counts, `notify-reasons.ts`'s own header count) are easy to miss on a first pass.

**How to avoid:** Follow the exact ten-surface list `04-06-SUMMARY.md` enumerates for D-04-07 (cited directly in this phase's CONTEXT.md code_context section) as the closing checklist for the `{dependency enabled}` token; grep the codebase for every existing occurrence of `"dependency promoted"` (a token added the same way, one milestone ago) as the literal file list to touch.

**Warning signs:** `npm run check` green on typecheck/lint but red on `test:coverage:direct` or the catalog parser test; a docs/output-catalog.md diff that adds a row but doesn't touch its header state-count sentence.

## Code Examples

### The current RESV-05 skip that EDEP-03 must retire (verified read, `install-cascade.messaging.ts:228-246`)

```typescript
// Source: orchestrators/plugin/install-cascade.messaging.ts (verified read) --
// THIS is the exact block EDEP-03 changes. Today it is READ-ONLY reporting;
// EDEP-03 needs the underlying member to actually be re-materialized (see
// Pattern 1) BEFORE this row is composed, and the row's status/reasons change
// from `skipped`/["already installed", "dependency disabled"] to
// `installed`/["already installed", "dependency enabled"].
for (const member of args.alreadyInstalled) {
  const reasons: ContentReason[] = member.disabled
    ? ["already installed", "dependency disabled"]
    : ["already installed"];
  rows.push({
    status: "skipped",
    name: member.key,
    ...(member.version !== undefined && { version: member.version }),
    reasons,
    severity: skipSeverity(reasons),
  });
}
```

### The current install-cascade read-only check that must become a write (verified read, `install-cascade.ts:670-718`)

```typescript
// Source: orchestrators/plugin/install-cascade.ts (verified read) -- this
// function only CHECKS; RESV-05's own comment above it ("an already-installed
// dependency is CHECKED and never touched... no code path below can reinstall
// it, re-pin it or re-declare it") states the invariant EDEP-03 must revise
// for the disabled-and-already-installed subcase specifically -- NOT for the
// general already-installed case, which stays untouched.
function checkInstalledMember(
  state: ExtensionState,
  member: ClosureMember,
): CascadeConstraintFailure | undefined {
  const intersected = intersectDependencyRanges(member.ranges);
  if (!intersected.ok) {
    return toIntersectionFailure(member, intersected);
  }
  const recorded = recordedVersionOf(state, member);
  if (isUnconstrainedRange(intersected.range) || recorded === undefined) {
    return undefined;
  }
  return recordedVersionSatisfies(recorded, intersected.range)
    ? undefined
    : { kind: "range-conflict", why: "installed-unsatisfied", key: member.key,
        range: renderConstraintRange(intersected.range), recordedVersion: recorded };
}
```

### The `dependencyDisabled` LIFT precedent (verified read, `orchestrators/reconcile/plan.ts:424-426, 640-641`)

```typescript
// Source: orchestrators/reconcile/plan.ts (verified read) -- shows the LIVE
// verdict pattern, never the persisted marker, decides whether a hold
// continues. EDEP-01's manual `enable` write is a DIFFERENT call site from
// this reconcile path, but if it clears `dependencyDisabled` at write time
// (Claude's Discretion allows either), it should mirror this same "the marker
// only says a previous pass held it down" framing rather than re-deriving a
// verdict.
function isHeldByUnsatisfiedDependency(key: string, verdict: ScopeSatisfactionVerdict): boolean {
  return verdict.ok && verdict.unsatisfied.some((entry) => entry.dependent === key);
}
// ...
function isAlreadyDependencyDisabled(record: PluginInstallRecord): boolean {
  return record.dependencyDisabled === true && isRecordedButDisabled(record);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `enable`/`disable` know nothing about plugin dependencies | This phase teaches them | Phase 8 (in progress) | Closes the last of the three enablement-related upstream divergences (#5, #6 in HANDOFF-upstream-dependency-parity.md); #7/#8 (uninstall allow-and-report, load-time check) already shipped in Phase 6. |
| `uninstall` refused a still-needed dependency (PRUNE-05) | `uninstall` proceeds, reports dependents, next load disables the dependent (LOAD-03) | Phase 6 (D-06-06, 2026-09-18) | The REFUSAL SHAPE this superseded is exactly what EDEP-02 needs to bring back — on `disable`, not `uninstall`. Do not read `uninstall.ts`'s current behavior as the model for EDEP-02. |
| RESV-05: already-installed disabled dependency left inert, warned | EDEP-03 enables it through the record | Phase 8 (this phase) | Closes BACKLOG `ENBL-DEP-01`; retires the `{already installed, dependency disabled}` skip row from the catalog entirely (not just superseded — REMOVED per ROADMAP success criterion 3). |

**Deprecated/outdated:**
- `docs/dependency-resolution.md:112`'s sentence describing the RESV-05 skip ("this extension does not install it again, and it does not enable it for you either... the row says `{already installed, dependency disabled}`") becomes inaccurate once EDEP-03 ships. It is not named in CONTEXT.md's "Docs to update" list (only `docs/plugin-enablement.md` and `docs/output-catalog.md` are), but the planner should verify whether this sentence also needs a follow-up edit or whether it is out of this phase's stated doc scope — flagged as an Open Question below.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EDEP-03's install-cascade write should reuse `runInstallLedger` (full re-materialization) rather than a bare `record.enabled = true` flip, because a disabled record's artifacts are off disk. | Architecture Patterns § Pattern 1, Anti-Patterns | If wrong (e.g. the operator intends a lighter-weight flag-only flip with materialization deferred to the next reload), the plan would over-build; but the NFR-3 fail-clean framing throughout this codebase (comments in `enable-disable.ts`, `install-cascade.ts`) strongly supports this reading, and it exactly parallels EDEP-01's own enable branch, so confidence is HIGH not merely assumed. Flagged here because CONTEXT.md itself does not spell out "and re-materialize the artifacts" in so many words — it says "enables that dependency through its record," which this research interprets using the established `runEnableBranch`/`materializePromotedRecord` precedent. |
| A2 | The install-cascade's already-installed-and-disabled write should NOT flip `provenance` (stays `"dependency"`, unlike D-04-07's promotion which flips to `"explicit"`), because EDEP-03 is not a promotion — the user did not name this plugin. | Architecture Patterns § Pattern 1 | If wrong, a `--prune` sweep could misclassify the record. This follows directly from D-04-02 ("config never names a dependency") plus the fact that only `install-flow.ts::promoteDependencyRecord` (a BY-NAME install) flips provenance — the closure's own dependency members never do. Confidence HIGH given the direct code read of `promoteDependencyRecord`'s guard (`record?.provenance !== "dependency"`), which only fires for the by-name case. |
| A3 | EDEP-01's per-member row rendering should follow `install-cascade.messaging.ts::composeCascadeMemberRows`'s general SHAPE (root row + sorted member rows in one notify call) without literally importing that function, since `EnableMsg`/`DisableMsg` are a structurally different union from `CascadeMsg`. | Architecture Patterns § System Diagram | If wrong and the codebase actually wants literal code sharing, a plan that writes a parallel composer duplicates logic; but the codebase's own established pattern ("`install-cascade.messaging.ts` SPREADS install's render map instead of restating it" per STATE.md's Phase 3 history) suggests spread-and-extend is the house style, which the planner should apply to `enable-disable.messaging.ts` similarly. |

## Open Questions

1. **Does `docs/dependency-resolution.md:112` also need the RESV-05-skip sentence rewritten?**
   - What we know: CONTEXT.md's "Docs to update" canonical-refs section names only `docs/plugin-enablement.md` §40-46 and `docs/output-catalog.md`.
   - What's unclear: `docs/dependency-resolution.md:112` states the exact same divergence in different words, and it is not byte-gated (per `docs/plugin-enablement.md`'s own note that only `output-catalog.md` is byte-gated), so it would silently go stale.
   - Recommendation: the planner should decide explicitly whether this line is in scope for the phase (a small doc-consistency task) or explicitly deferred; either is defensible, but leaving it unaddressed without a decision risks an inconsistent doc pair.

2. **Does EDEP-01's cascade enable a dependency that is DISABLED-AS-A-CONSEQUENCE of Phase 6's load-time check the same way it enables a plain user-disabled one?**
   - What we know: Phase 6's `dependencyDisabled` marker distinguishes a consequence-disable from a user disable, but D-06-02 states the marker is set "ONLY at the instant [the load-time check] performs the enabled→disabled transition itself" — it says nothing about whether a later MANUAL `enable` on the DEPENDENT should re-enable a consequence-disabled TRANSITIVE dependency the same way it would a plain disabled one.
   - What's unclear: Is there a scenario where `enable <plugin>` walks into a dependency that itself is a DEPENDENT of something else, consequence-disabled by Phase 6's own check? The CONTEXT.md's Claude's Discretion note addresses whether the ENABLED plugin's OWN `dependencyDisabled` marker is cleared, but not this second-order case for a closure MEMBER.
   - Recommendation: treat this as an edge case worth a plan-time decision or an explicit test fixture; it does not block the phase's primary path (a dependency that is simply disabled, full stop) but the planner should note it rather than silently assume it away.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (TypeScript run via `--experimental-strip-types` or equivalent, per `package.json`'s `test` script) |
| Config file | none — test file glob is inline in `package.json`'s `"test"` script |
| Quick run command | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` (and the sibling `.messaging.test.ts`, `install-cascade.test.ts` files) |
| Full suite command | `npm test` (covers `tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDEP-01 | `enable <plugin>` enables its declared dependencies transitively, one row each | unit/orchestrator | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ✅ file exists, extend with cascade cases |
| EDEP-01 | Row rendering for the cascade (root + member rows) | unit/messaging | `node --test "tests/orchestrators/plugin/enable-disable.messaging.test.ts"` | ✅ file exists, extend |
| EDEP-02 | `disable <plugin>` refused while a dependent declares it, names dependents + chained instruction | unit/orchestrator | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ✅ file exists, extend |
| EDEP-02 | Edge-level argument parsing unaffected (still single-target) | unit/edge | `node --test "tests/edge/handlers/plugin/enable-disable.test.ts"` | ✅ file exists, spot-check only |
| EDEP-03 | Install cascade enables an already-installed disabled dependency through its record | unit/orchestrator | `node --test "tests/orchestrators/plugin/install-cascade.test.ts"` | ✅ file exists (per earlier phases), extend |
| EDEP-03 | New `{dependency enabled}` row rendering, retirement of `{already installed, dependency disabled}` | unit/messaging + architecture | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` and the catalog-parser/catalog-contract tests | ✅ files exist (referenced throughout the codebase's established closed-set amendment history), extend |

### Sampling Rate
- **Per task commit:** the quick run command for the file(s) touched by that task.
- **Per wave merge:** `npm test` plus `npm run test:coverage:direct:commit` (the CI direct-coverage gate this repo enforces on every changed production module).
- **Phase gate:** `npm run check` full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
None — existing test infrastructure (`tests/orchestrators/plugin/enable-disable.test.ts`, `enable-disable.messaging.test.ts`, `edge/handlers/plugin/enable-disable.test.ts`, `orchestrators/plugin/dependency-index.test.ts`, `domain/dependency-closure.test.ts`, and the install-cascade test siblings) covers every module this phase touches. No new test file or fixture framework is required; every requirement is an extension of an existing corresponding-test pair, which this repo's `test:corresponding` CI gate already enforces.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local CLI tool operating on the user's own filesystem; no auth surface. |
| V3 Session Management | no | N/A — no session concept in this extension. |
| V4 Access Control | no | N/A — single-user local tool; scope (user/project) is a data-partitioning concept, not an access-control boundary. |
| V5 Input Validation | yes | `domain/name.ts::assertSafeName` (existing) gates plugin/marketplace name tokens before they reach a rendered row or a filesystem path; EDEP-02's refusal text interpolating dependent names must route through the SAME `isRenderablePluginKey`/`renderDependents`-style guard `uninstall.messaging.ts` already established (see Architecture Patterns § Pattern 3), not raw string interpolation. |
| V6 Cryptography | no | N/A — no cryptographic operation in this phase's scope. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted plugin/marketplace name (permitted characters include `"`, `,`, bidi controls per `assertSafeName`) forges part of a rendered refusal/cause sentence | Tampering (of the rendered message, not of code) | Route every interpolated dependent-name list through a `isRenderablePluginKey`-gated helper (falling back to a count, e.g. "3 other plugins") exactly as `uninstall.messaging.ts::renderDependents` already does — reuse, do not reimplement. This is a REAL, previously-identified threat class in this exact codebase (T-06-02 comment, verified read), not a speculative addition. |
| A disabled record's re-materialization (EDEP-03) partially fails mid-write, leaving state.json claiming artifacts that are not on disk | Tampering / Denial of Service (of subsequent commands reading a corrupted record) | Reuse `runInstallLedger`'s existing rollback-on-failure and `InstallFailureCapture` machinery (already fail-clean per NFR-3) rather than a bespoke partial write; this is the same reasoning `enable-disable.ts`'s own extensive I3/I4 comments already document for the existing enable branch. |

## Sources

### Primary (HIGH confidence — all verified by direct Read this session)
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — full file read (1533 lines), confirmed no dependency awareness today.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` — full file read, confirms single-target argument parsing.
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` — full file read, `buildScopeDeclarationIndex`/`buildScopeDeclarationDetail`.
- `extensions/pi-claude-marketplace/domain/dependency-closure.ts` — full file read, `resolveDependencyClosure`/`ClosureMember`/`DependencyClosureResult`.
- `extensions/pi-claude-marketplace/domain/dependency-orphans.ts` — lines 1-60 read, `findDependents`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — lines 220-340 read, `readDeclarers`/`UninstallRefusedError`/`narrowCascadeFailure`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` — lines 120-200 read, `renderDependents`/`composeUninstalledRow`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` — lines 340-440, 600-942 read, `CascadeSkippedMember`/`checkInstalledMember`/`resolveMemberConstraints`/`runInstallCascade`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` — lines 180-320 read, `composeCascadeMemberRows`/`closureFailureFacts`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` — lines 840-1030 read, `promoteDependencyRecord`/`materializePromotedRecord`/`refusesPromotion`/`declarePromotedPlugin`.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` — lines 380-660 read, `classifyDeclaredPlugin`/`isHeldByUnsatisfiedDependency`/`isAlreadyDependencyDisabled`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` — full file read, `EnableMsg`/`DisableMsg`/render maps.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — lines 95-160 read, `enableRowDependencies`.
- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` — grep-located `Dependency = "agents" | "mcp"` (line 31).
- `extensions/pi-claude-marketplace/shared/notification-types.ts` — lines 80-180 read plus REASONS-count script, `REASONS`/`Reason`/`ContentReason`.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — lines 1-60, 300-345 read, topic-grouped register and closed-set history commentary.
- `docs/plugin-enablement.md` — full file read, including the exact §40-46 divergence prose EDEP-03 reverses.
- `.planning/HANDOFF-upstream-dependency-parity.md` — full file read, upstream error text and phase-grouping rationale.
- `.planning/phases/08-enablement-parity-for-dependencies/08-CONTEXT.md` — full file read (user decisions).
- `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-CONTEXT.md` — lines 40-90 read, D-06-01..04.
- `.planning/REQUIREMENTS.md` — full file read, EDEP/PRUNE-05/traceability sections.
- `.planning/STATE.md` — lines 1-526 read, phase history and precedent narrative.
- `package.json` — scripts section read, confirming `node --test` test runner and file glob.
- Direct filesystem checks: `find` for existing `enable-disable`/`dependency-index`/`dependency-closure` test files (all present).

### Secondary (MEDIUM confidence)
- None used — every claim in this document traces to a direct Read/grep this session against this repository's own source, not an external or web-sourced claim.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no external dependency in scope.
- Architecture: HIGH — every seam (closure walk, declaration index, ledger re-materialization, closed-set amendment mechanism) is a direct code read of the exact file/lines this phase will edit, cross-referenced against the CONTEXT.md's own canonical-refs list.
- Pitfalls: HIGH — each pitfall traces to an explicit supersession comment or an explicit ROADMAP/CONTEXT instruction already in the repository (D-06-06's supersession note, ROADMAP success criterion 3's "removed... fixture, both contract constants, length lock, both enumeration pins" language).

**Research date:** 2026-09-19
**Valid until:** Stable until this phase's own plan lands (this research is scoped to one phase of an active milestone on a single feature branch; it should not be reused past Phase 8's completion without re-verification against whatever Phase 8 actually ships, since EDEP-01/02/03 will change the exact line numbers cited throughout).

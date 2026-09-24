# Phase 6: Load-time dependency check and allowed uninstall - Research

**Researched:** 2026-09-18
**Domain:** In-repo reconcile planner / apply orchestrator, persisted install-record schema, closed-set notification vocabulary
**Confidence:** HIGH (every claim below was read from the working tree this session; line numbers re-verified, not taken from CONTEXT.md)

## Summary

This is a zero-new-dependency phase. Every mechanism LOAD-01..03 needs already
exists in the tree: the offline declaration walk (`dependency-index.ts`), the
range evaluator (`dependency-range.ts::recordedVersionSatisfies`), the
disable transform (`state-io.ts::toDisabledRecord`), the enable/disable apply
seam (`apply.ts::applyPluginToggles`), and the closed-set amendment mechanism
(`REASONS` + six pins). The work is wiring, a schema field, and a vocabulary
amendment — not new machinery.

CONTEXT.md's D-06-01..07 all survive re-verification: every line number,
signature and gate it cites still matches the tree. Three things it did NOT
settle are load-bearing and are raised as Open Questions below. In order of
planning risk: (1) **the upstream remedy sentence cannot be a reason token** —
`docs/output-catalog.md:63` caps a reason at "1-3 words lowercase", and the
only interpolating output channel is the `cause:` trailer, which today renders
on `failed`/`manual recovery` rows *only* (`notification-grammar.ts:1625`), not
on the `(disabled)` row LOAD-01 produces; (2) **nothing in the reconcile apply
path can write `dependencyDisabled: true`** — `applyPluginToggles` delegates
the whole record write to `setPluginEnabled`, and `enable-disable.ts` is out of
scope per the phase boundary; (3) **`buildScopeDeclarationIndex` discards the
version constraint** (it maps declarations to bare `name@marketplace` keys), so
it cannot answer LOAD-01's out-of-range half as-is — a sibling is required, not
optional.

**Primary recommendation:** Land the check as a new `orchestrators/reconcile/`
module computing a per-scope satisfaction verdict inside `readPassForScope`
(between step (3) and step (4), `apply.ts:192-197`) and pass it to
`planReconcile` as a fourth argument; add a new `pluginsToDependencyDisable`
bucket to `ReconcilePlan` rather than overloading `pluginsToDisable`, and give
it its own apply step that owns both the record write and the marker, so
`enable-disable.ts` stays untouched. Render the row as `(disabled)` with a
2-word reason token mirroring upstream's error code and the remedy sentence on
a cause line — which requires widening `PluginDisabledMessage` with
`cause?: Error` and the trailer gate at `notification-grammar.ts:1625`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-06-01: Add `dependencyDisabled?: boolean` to `PLUGIN_INSTALL_RECORD_SCHEMA`
  — optional, additive, no schemaVersion bump.** Follows the `resolvedSha` /
  `hookEntries` precedent (D-100-01): a legacy record without it loads
  unchanged, absence needs no migrate fill, and it is orthogonal to the
  required `enabled` boolean it modifies the meaning of, not replaces. A
  literal-union "reason" field was considered and rejected: LOAD-01's remedy
  sentence is re-derived LIVE from a fresh check every time reconcile runs
  (dependency state can change between passes — that is the whole point of
  LOAD-02), so the marker only needs to answer "is this record CURRENTLY held
  down by the check", never "why", and a boolean says exactly that with
  nothing to keep in sync.
  — **Reversibility:** reversible — an additive optional field with no
  migrate fill costs nothing to drop or rename later; no persisted value
  depends on the field surviving.

- **D-06-02: The check sets `dependencyDisabled: true` ONLY at the instant it
  performs the enabled→disabled transition itself.** If a record is already
  disabled for any other reason (the user's own `disable` command, or a
  config-declared `enabled: false`), the check leaves it disabled and does
  NOT stamp the marker. This is what keeps a user's own choice distinguishable
  from the check's consequence, per the HANDOFF's own framing ("the disable is
  recorded as a consequence, not a user choice") — without it, LOAD-02's
  "lifts the disable once satisfied" would silently overturn a disable the
  user asked for.
  — **Reversibility:** reversible — a planning-time predicate, not a stored
  shape.

- **D-06-03: The check's OWN plan.ts branch reads `dependencyDisabled` and
  refuses to bucket the record as `enable`, even when config still declares
  it enabled.** Traced in `classifyDeclaredPlugin`
  (`orchestrators/reconcile/plan.ts:414-504`): today, a recorded-but-disabled
  plugin with a config that still declares it enabled is unconditionally
  pushed to `acc.enable` (line 499, `isRecordedButDisabled(record)` alone
  gates it). Left unchanged, this is the exact oscillation LOAD-02 forbids —
  a consequence-disable would never survive a second `/reload`, because
  nothing about it looks different from an ordinary "declared enabled but
  disabled" divergence. D-06-03 adds `!record.dependencyDisabled` (or the
  satisfied-dependency check re-run inline) to that branch's gate. The LIFT
  path — when the dependency situation has since resolved — is the SAME
  branch: once satisfied, the ordinary enable-bucket logic already fires
  (config says enabled, record is recorded-but-disabled), and whoever applies
  the enable bucket clears `dependencyDisabled` as part of performing it.
  — **Reversibility:** reversible — a local branch condition; no persisted
  contract depends on its exact shape.

- **D-06-04: The dependency-satisfaction check CANNOT run inside `planReconcile`
  itself, and must be precomputed and passed in as data.** Verified directly
  against `tests/architecture/reconcile-planner-purity.test.ts`: `plan.ts` is
  grepped for forbidden patterns including `node:fs` / `node:fs/promises`
  imports, and `buildScopeDeclarationIndex`
  (`orchestrators/plugin/dependency-index.ts`, Phase 5's declaration index) is
  `async` and does exactly those fs reads — it is called today only from
  `uninstall.ts`, never from `plan.ts`. The planner must design this as an
  async pre-step (in the `resources_discover` → `applyReconcile` caller, or a
  new async wrapper ahead of `planReconcile`) that builds a per-scope
  satisfaction verdict for every recorded, declared dependency and hands it to
  `planReconcile` as an added, already-computed input — the same shape
  `MarketplaceDiff` and `DeclaredPluginInputs` already take precomputed
  values rather than deriving them inline. This is a structural fact for the
  planner to design around, not a design choice with alternatives: violating
  it fails `reconcile-planner-purity.test.ts` outright.
  — **Reversibility:** one-way in the sense that the purity gate is a fixed
  constraint, not a decision this phase can trade off; the planner's actual
  wiring choice (which async function computes the verdict, where it lives)
  is ordinary implementation discretion within that constraint.

- **D-06-05: The check runs to a FIXPOINT within one apply pass, mirroring
  Phase 5's prune sweep (D-05-02).** LOAD-01 counts "dependency ... disabled"
  as itself an unsatisfied condition, so disabling B (because C is gone) can
  make A (which declares B) newly unsatisfied in the same reconcile run. A
  single non-repeating pass would take N reloads to fully propagate a broken
  dependency down a chain of depth N — user-visibly wrong ("why is A still
  loading, its dependency B is disabled"). Repeat the check-and-disable step
  until no new record is disabled in a pass, the same repeat-until-stable
  shape D-05-02 already established for the orphan sweep.
  — **Reversibility:** reversible — an iteration-count implementation detail
  with no persisted shape.

- **D-06-06: `uninstall.ts` keeps computing the dependent set via
  `buildScopeDeclarationIndex` (already wired for D-05-14..16's guard) but
  reports it on the SUCCESS row instead of refusing.** The guard call site
  moves from a refusal (`assertNoDependents` throwing / blocking removal) to
  an informational reason attached to the ordinary uninstalled row, naming
  the dependents that will be reported unsatisfied at the next load — the
  same declaration-read machinery (D-05-06's offline manifest read, D-05-07's
  fail-closed-on-unreadable posture) still applies; only the OUTCOME on a
  found dependent set changes from "refuse" to "proceed and report". This
  keeps D-05-05 (same-scope only) and D-05-04 (a disabled declarer still
  holds its dependencies) unchanged — they were never about whether to
  refuse, only about who counts as a declarer.
  — **Reversibility:** one-way — a published catalog row; exact wording is
  Claude's Discretion below, following the closed-set-amendment mechanism
  D-04-07 and D-05-11 already established.

- **D-06-07: PRUNE-05's refusal and its `dependents remain` row are RETIRED,
  not left dead in place.** `orchestrators/plugin/uninstall.ts`'s current
  refusal branch (D-05-14..16) and the `docs/dependency-resolution.md` §138
  "documents this for `disable`; this extension applies it to `uninstall`"
  sentence are removed as part of this phase, per REQUIREMENTS LOAD-03's own
  text ("Supersedes PRUNE-05 and the reload-path refusal"). A decision record
  superseding D-05-14 belongs in this phase's own artifacts (REVIEW or
  SUMMARY), not left implicit.

### Claude's Discretion

- Exact reason-token wording for the three upstream remedy shapes (`Install
  "X" or uninstall "Y"`, `Enable "X" or uninstall "Y"`, `Update "X" to
  satisfy R, or uninstall "Y"`) and for LOAD-03's "will be unsatisfied" row —
  follow `docs/messaging-style-guide.md` and the closed-set `REASONS`
  amendment mechanism (D-04-07, D-05-11) rather than inventing prose ad hoc.
  The upstream WORDING itself is pinned verbatim in HANDOFF-upstream-
  dependency-parity.md and REQUIREMENTS LOAD-01 — only the token
  name/placement in `notify-reasons.ts` and the catalog is open.
- Whether `dependencyDisabled` is cleared by `apply.ts`'s enable-application
  step or by a small helper it calls — as long as plan.ts stays a pure
  consumer of a precomputed verdict (D-06-04) and the clear happens exactly
  when the enable is actually applied, not speculatively.
- Whether the async pre-step (D-06-04) computes the dependency-satisfaction
  verdict via `buildScopeDeclarationIndex` directly or via a new sibling
  function in `dependency-index.ts` purpose-built for "is every recorded
  dependent's declaration currently satisfied" (name/shape open) — either is
  acceptable so long as it stays offline (fs + warm clone cache only, NFR-5)
  and lands outside `plan.ts`.
- Whether `enabled X` reported by a manual `enable` command clearing a stale
  `dependencyDisabled` flag needs any change in THIS phase. Traced: since
  `enable-disable.ts` is untouched here and already sets `enabled: true`
  unconditionally, a manual enable on a still-unsatisfied record leaves
  `dependencyDisabled: true` stale alongside `enabled: true` — but the next
  reconcile pass self-corrects either way (clears the flag if now satisfied,
  or re-disables and re-stamps it if not), so no defensive code is needed in
  Phase 6. Phase 8 (Enablement parity) is where `enable-disable.ts` itself
  learns about dependencies; this note is a boundary marker, not a deferred
  bug.
- Interaction between the new async dependency-satisfaction pre-step and
  `resources_discover`'s existing error-wrapping discipline (ARCHITECTURE.md:
  a throw must never propagate past `resources_discover`/`session_start`) —
  ordinary defensive wiring, no new decision needed.

### Deferred Ideas (OUT OF SCOPE)

- **`enable-disable.ts` learning about `dependencyDisabled`** (clearing it on
  a manual enable, or refusing a manual disable differently when the record
  is already consequence-disabled) — belongs to Phase 8 (Enablement parity),
  not this phase; see the Claude's Discretion note above for why no defensive
  code is needed here in the meantime.
- **A `list`/`info` marker distinguishing a consequence-disabled plugin from
  a user-disabled one** — not requested by LOAD-01..03; would be a new
  closed-set token and inventory concept, out of scope here.

Not in this phase (from CONTEXT.md `<domain>`): tag resolution for path-source
dependencies (Phase 7), enable/disable command changes (Phase 8;
`enable-disable.ts` is untouched here), reload installing a MISSING declared
dependency (Phase 9), constraint-aware update (Phase 10), cross-marketplace
allowlist (Phase 11), standalone `prune` (Phase 12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from `.planning/REQUIREMENTS.md:124-136`) | Research Support |
|----|-------------|------------------|
| LOAD-01 | "At load, an installed plugin whose declared dependency is missing, disabled, or outside the declared range is disabled and reported with a remedy that names the dependency and the dependent (`Install "X" or uninstall "Y"`, `Enable "X" or uninstall "Y"`, `Update "X" to satisfy R, or uninstall "Y"`)." | §Architecture Patterns Pattern 1 (verdict pre-step) + Pattern 2 (new plan bucket); §Open Question 1 settles where the interpolated remedy can legally render; `recordedVersionSatisfies` answers the range half (§Reusable Assets) |
| LOAD-02 | "The load-time disable is a consequence the config does not express: reconcile keeps the dependent disabled while the dependency stays unsatisfied, does not oscillate, and lifts the disable once the dependency is installed, enabled and in range." | §Architecture Patterns Pattern 3 (the `classifyDeclaredPlugin:493-500` gate) + Pattern 4 (clear-on-lift is nearly free — `install-outcome.ts:940-1000` rebuilds the record literal and would drop the field); §Pitfall 2 (oscillation) |
| LOAD-03 | "`uninstall <plugin>` proceeds while other installed plugins in the scope still declare it; the row names the dependents, and each becomes unsatisfied at the next load. Supersedes PRUNE-05 and the reload-path refusal." | §Code Example 3 (exact `assertNoDependents` diff shape); §Don't Hand-Roll (reuse the index, not a new walk); §Pitfall 5 (the retirement touches 13 test/doc sites) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read what every installed record declares, offline | `orchestrators/plugin/dependency-index.ts` (orchestrator leaf) | `orchestrators/plugin/dependency-declaration-read.ts` (fs seam) | Already the sole owner of the offline declaration walk (D-05-06/07); gated network-free by name at `tests/architecture/gate-targets.ts:120-121` |
| Decide whether one declaration is satisfied (present / enabled / in range) | `domain/dependency-range.ts` + the new verdict builder | — | The range algebra is pure domain (`recordedVersionSatisfies`); "present and enabled" is a state read, so composition belongs in an orchestrator |
| Compute the per-scope verdict as data | NEW module under `orchestrators/reconcile/` | `orchestrators/plugin/dependency-index.ts` | D-06-04: the planner is grep-gated pure, so the fs work must land outside it and arrive precomputed |
| Turn the verdict into buckets | `orchestrators/reconcile/plan.ts` (pure) | — | Existing 7-bucket owner; a new bucket is the established extension point |
| Perform the disable + stamp the marker | `orchestrators/reconcile/apply.ts` (new step) | `persistence/state-io.ts::toDisabledRecord` | `applyPluginToggles` delegates the record write to `enable-disable.ts`, which is out of scope — see Open Question 2 |
| Persist the marker | `persistence/state-io.ts::PLUGIN_INSTALL_RECORD_SCHEMA` | `migrate.ts` (NOT touched — optional/additive needs no fill) | D-06-01 precedent is `resolvedSha`/`hookEntries` |
| Name the dependents on a successful uninstall | `orchestrators/plugin/uninstall.ts` + `uninstall.messaging.ts` | `domain/dependency-orphans.ts::findDependents` | D-06-06 keeps the same computation and changes only the outcome |
| Render | `shared/notification-grammar.ts` + `shared/notification-types.ts` | `orchestrators/reconcile/notify.ts` | "notify.ts is a dumb renderer" — the orchestrator stamps token/severity |

## Standard Stack

### Core

**No new packages.** Every capability this phase needs already exists in the
tree. The table below is the *in-repo* stack the plans will compose.

| Module | Symbol | Purpose | Why it is the standard |
|--------|--------|---------|------------------------|
| `orchestrators/plugin/dependency-index.ts` | `buildScopeDeclarationIndex` | Offline walk of every record's declarations in one state doc | Sole owner since Phase 5; fail-closed (D-05-07); network-gated by name [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:177-200] |
| `domain/dependency-range.ts` | `recordedVersionSatisfies(recorded: string, range: string): boolean` | The out-of-range half of LOAD-01 | Sole semver evaluator; pure, no I/O [VERIFIED: extensions/pi-claude-marketplace/domain/dependency-range.ts:265-268] |
| `domain/dependency-range.ts` | `intersectDependencyRanges`, `isUnconstrainedRange`, `renderConstraintRange` | N ranges → one; wildcard test; bounded render for a user-visible reason | Already used by the install cascade for the same question [VERIFIED: extensions/pi-claude-marketplace/domain/dependency-range.ts:203, 247, 276] |
| `domain/dependency-orphans.ts` | `findDependents(key, index)` | Who declares this key | Already the uninstall guard's second half [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:62, 261] |
| `persistence/state-io.ts` | `isRecordedButDisabled`, `toDisabledRecord` | The sole disabled predicate + the sole disabled-record producer | Whole-tree twin gate forbids re-deriving either [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:229-238, 266-268; tests/architecture/disabled-state-classification.test.ts:92-210] |
| `persistence/config-io.ts` | `isDeclaredEnabled` | The config-side enablement default | One of the two predicates `classifyDeclaredPlugin` composes [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:49, 462] |
| `transaction/with-state-guard.ts` | `withLockedStateTransaction` | The per-scope lock | NOT re-entrant, `retries: 0` — see Pitfall 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new sibling in `dependency-index.ts` keeping version constraints | Reusing `buildScopeDeclarationIndex` as-is | **Not viable.** The index flattens each declaration to `` `${dep.name}@${dep.marketplace ?? marketplace.name}` `` and discards `dep.version`, so it cannot answer "outside the declared range". See §Open Question 3 |
| A new `pluginsToDependencyDisable` bucket | Reusing `pluginsToDisable` | Reusing it is cheaper in type surface but wrong in apply semantics: the existing disable step delegates the record write to `setPluginEnabled`, which cannot stamp the marker, and the rendered row must differ (reason token + cause line). A separate bucket also keeps `buildUninstallBucket`'s and `applyPlan`'s ordering contract readable |
| Widening `PluginDisabledMessage` with `cause?: Error` | Rendering the LOAD-01 row as `(failed)` | `(failed)` claims the operation did not happen; the disable DID happen. The tri-state severity model (info = desired reached, warning = carried out but short, error = not carried out) puts this at `warning` on a `(disabled)` row |

**Installation:** none — `npm install` is not part of this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. `semver`,
`typebox`, `proper-lockfile` and `write-file-atomic` are pre-existing declared
dependencies of the package and are reused unchanged; no new entry is added to
`package.json`. [VERIFIED: no `npm install` step appears in any decision in
`.planning/phases/06-.../06-CONTEXT.md`, and every symbol named in §Standard
Stack resolves inside `extensions/pi-claude-marketplace/`]

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Pi fires resources_discover  (index.ts:76)
        │
        ▼
  applyReconcile(opts)  (apply.ts:962 → applyReconcileWithReader:849)
        │
        │  for each scope in [project, user]     (apply.ts:860)
        ▼
  ┌── readPassForScope ─────────────────────────────────────────┐
  │   pristine-scope gate (no state.json AND no config → skip)  │  apply.ts:125-132
  │   withLockedStateTransaction(loc, …)   NO tx.save() (WR-05) │  apply.ts:134
  │     (1) migrateFirstRunConfig                               │  apply.ts:154
  │     (2) loadMergedScopeConfig                               │  apply.ts:160
  │     (3) CFG-03 invalid-arm check → early return             │  apply.ts:166-194
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ ★ NEW (D-06-04): buildScopeSatisfactionVerdict(state,│   │  ← fs reads legal here
  │  │   locations)  — async, offline, per-record verdict   │   │     (the closure is
  │  └──────────────────────────────────────────────────────┘   │      already async+fs)
  │     (4) planReconcile(merged, state, scope, ★verdict)       │  apply.ts:197
  │     return { scope, plan, invalidOutcomes, state, … }       │  apply.ts:201
  └─────────────────────────────────────────────────────────────┘
        │  plan (pure data)
        ▼
  applyPlan(opts, plan, outcomes)                                  apply.ts:804-837
        │   1. applyPluginUninstalls                               apply.ts:809
        │   2. applyMarketplaceRemoves                              :810
        │   3. applyMarketplaceAdds                                 :811
        │   4. applyPluginInstalls                                  :812
        │   5. applyPluginToggles(plan.pluginsToEnable,  enable:true)  :813
        │   6. applyPluginToggles(plan.pluginsToDisable, enable:false) :824
        │  ┌──────────────────────────────────────────────────┐
        │  │ ★ NEW step 6b: applyDependencyDisables            │  ← owns its own
        │  │   withLockedStateTransaction → toDisabledRecord   │     locked write,
        │  │   + dependencyDisabled: true  → tx.save()         │     because step 5/6
        │  └──────────────────────────────────────────────────┘     cannot stamp it
        │   7. applySourceMismatches (report-only)                   :836
        ▼
  outcomes[] → buildReconcileAppliedCascade → ONE notify()       apply.ts:939-940
```

The apply pass holds **no outer lock** (CR-01), so the new step may take the
scope lock itself — that is exactly what steps 1–6 do through their child
orchestrators.

### Recommended Module Placement

```text
extensions/pi-claude-marketplace/
├── orchestrators/
│   ├── plugin/
│   │   ├── dependency-index.ts          # + NEW sibling: constraint-preserving walk
│   │   └── uninstall.ts                 # assertNoDependents → reportDependents
│   └── reconcile/
│       ├── dependency-verdict.ts        # NEW — the async pre-step (D-06-04)
│       ├── plan.ts                      # + verdict param, + new bucket, + :498 gate
│       ├── apply.ts                     # + verdict call, + applyDependencyDisables
│       ├── apply-outcomes.ts            # + the new PerEntryOutcome arm
│       ├── notify.ts                    # + the arm → row mapping
│       └── types.ts                     # + PlannedDependencyDisable, + plan field
├── persistence/state-io.ts              # + dependencyDisabled in schema AND clone
└── shared/
    ├── notification-types.ts            # + REASONS members, + PluginDisabledMessage.cause?
    ├── notify-reasons.ts                # + group homes, + header count prose
    └── notification-grammar.ts          # widen the :1625 trailer gate
```

Every new production `.ts` file needs a paired `tests/<same-relative-path>.test.ts`
(`npm run test:corresponding`) at 100% direct branch+line coverage — see
§Validation Architecture.

### Pattern 1: Precomputed verdict as a planner input

`planReconcile` already takes two precomputed structures rather than deriving
them inline: `MarketplaceDiff` (built by `diffMarketplaces`, threaded into
`DeclaredPluginInputs`) and the `DeclaredPluginInputs` bundle itself.

**What:** build the per-record satisfaction verdict *before* `planReconcile`
and hand it in as a fourth argument.
**When to use:** always here — D-06-04 is not optional.
**Where:** inside the `readPassForScope` closure, between the CFG-03 early
return (`apply.ts:192-194`) and the `planReconcile` call (`apply.ts:197`). The
closure is already `async` and already performs fs work (`migrateFirstRunConfig`,
`loadMergedScopeConfig`), so nothing new is introduced at that seam.

Why *not* in `index.ts`: the state snapshot and `ScopedLocations` the verdict
needs are both produced inside the locked closure. Computing it in `index.ts`
would mean a second, unlocked state read that could disagree with the snapshot
`planReconcile` sees — the exact race `readPassForScope`'s lock exists to close.

**Signature sketch (production shape, seams omitted as in `dependency-index.ts`):**

```ts
// orchestrators/reconcile/dependency-verdict.ts
// Source pattern: ScopeDeclarationIndexOptions / ScopeDeclarationIndexResult
//   (orchestrators/plugin/dependency-index.ts:80-114)
export interface ScopeSatisfactionOptions {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly reader?: DependencyDeclarationReader;
  readonly loadManifest?: typeof loadMarketplaceManifest;
}

/** One unsatisfied declaration, as the row needs it. */
export interface UnsatisfiedDeclaration {
  readonly dependent: string;      // `name@marketplace` of the declarer
  readonly dependency: string;     // `name@marketplace` of the declared
  readonly kind: "missing" | "disabled" | "out-of-range";
  readonly range?: string;         // present only on "out-of-range"
}

export type ScopeSatisfactionVerdict =
  | { readonly ok: true; readonly unsatisfied: readonly UnsatisfiedDeclaration[] }
  | { readonly ok: false; readonly declarer: string; readonly cause: Error };
```

`kind` maps 1:1 onto LOAD-01's three remedy shapes, which keeps the row
composer a total switch rather than a string-sniffing branch.

### Pattern 2: A new plan bucket, not an overloaded one

`ReconcilePlan` is a flat record of seven readonly bucket arrays
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:214-223]:

```ts
export interface ReconcilePlan {
  readonly scope: Scope;
  readonly marketplacesToAdd: readonly PlannedMarketplaceAdd[];
  readonly marketplacesToRemove: readonly PlannedMarketplaceRemove[];
  readonly pluginsToInstall: readonly PlannedPluginInstall[];
  readonly pluginsToUninstall: readonly PlannedPluginUninstall[];
  readonly pluginsToEnable: readonly PlannedPluginEnable[];
  readonly pluginsToDisable: readonly PlannedPluginDisable[];
  readonly sourceMismatches: readonly PlannedSourceMismatch[];
}
```

Adding a bucket means touching exactly four places: the interface, the
`emptyReconcilePlan` factory (`types.ts:229-240`), the seven-way
empty-plan fast-path conjunction in `planReconcile` (`plan.ts:616-634`), and
the returned literal (`plan.ts:636-645`). `tests/orchestrators/reconcile/types.test.ts`
(523 lines) pins the empty-plan shape by `deepEqual`, so the factory change
lands there deliberately.

**Anti-pattern warning (from the project's own memory of this class of bug):
"Optional-field silent-omission."** A new bucket added to the interface and to
`emptyReconcilePlan` but forgotten in `planReconcile`'s return literal compiles
clean — `readonly x: readonly T[]` on an object literal that omits it is a
TS2741 error, so that one is caught, but the *fast-path* conjunction at
`plan.ts:624-632` is a hand-maintained list of `total* === 0` terms and
omitting the new term there silently returns `emptyReconcilePlan` while the
bucket is non-empty. Add the term in the same edit.

### Pattern 3: The `classifyDeclaredPlugin` enable-branch gate (D-06-03)

CONTEXT.md's line citations are **still exact**. Verbatim, `plan.ts:493-504`:

```ts
  // Recorded + declared-enabled: split on the explicit `enabled: false`
  // marker (ENBL-05 / isRecordedButDisabled). The install branch above already
  // returned for `!recorded`, so a plugin CAN'T land in both `install` and
  // `enable` in the same pass.
  const record = state.marketplaces[marketplace]?.plugins[plugin];
  if (record !== undefined && isRecordedButDisabled(record)) {
    acc.enable.push({ scope, plugin, marketplace });
  }
  // Declared-enabled, recorded, not disabled: steady state, no action. The
  // record's inventory is not consulted -- ENBL-18 keeps it populated across a
  // disable, so it distinguishes nothing here.
```

`classifyDeclaredPlugin` opens at line 414 and closes at line 504; the
`acc.enable.push` is at line 499 and its gate at line 498. `buildUninstallBucket`
opens at line 515. All four numbers match CONTEXT.md.

**Smallest correct edit shape:** the gate becomes a three-term conjunction, and
the *third* term must be the live verdict, not the stored marker alone:

```ts
  if (
    record !== undefined &&
    isRecordedButDisabled(record) &&
    !isHeldByUnsatisfiedDependency(record, key, inputs.verdict)
  ) {
    acc.enable.push({ scope, plugin, marketplace });
  }
```

Reading `record.dependencyDisabled` *alone* would be wrong for the LIFT half of
LOAD-02: a record marked `dependencyDisabled: true` whose dependency has since
been installed and enabled must be re-enabled, and the marker says nothing
about that. The verdict is the live fact; the marker's job is narrower (see
Pattern 4). `isHeldByUnsatisfiedDependency` should be a small extracted
predicate, not an inline expression — `classifyDeclaredPlugin` sits under a
dual cognitive-complexity ceiling of 15 (ESLint `sonarjs/cognitive-complexity`
and fallow `health.maxCognitive`, computed by different algorithms), and
`plan.ts`'s own header records that this function was extracted for that reason.

### Pattern 4: Clear-on-lift is nearly free

CONTEXT.md left open "whether `dependencyDisabled` is cleared by `apply.ts`'s
enable-application step or by a small helper it calls". The tree already
answers most of it.

The reconcile enable bucket flows: `applyPluginToggles` (`apply.ts:667-727`) →
`setPluginEnabled` → the enable branch → `runInstallLedger` → `statePhase`,
which **rebuilds the record as a fresh object literal** rather than spreading
the existing one [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:940-1000].
The literal carries `enabled: true`, `provenance: existing?.provenance ?? …`,
`installedAt: existing?.installedAt ?? nowIso` — it names every field it wants
to preserve. A `dependencyDisabled` field the literal never names is therefore
**dropped automatically on every enable, install and re-materialization**.

So the correct implementation of the clear is *deliberate omission*: do NOT add
`dependencyDisabled` to `install-outcome.ts`'s literal, and record in a comment
why the omission is load-bearing. The same is true of
`reinstall-record.ts:128-151`, which also rebuilds the literal.

The mirror hazard is `toDisabledRecord`, which **spreads**:

```ts
export function toDisabledRecord<R extends PluginInstallRecord["resources"]>(
  record: PluginInstallRecord & { resources: R },
  updatedAt: string,
): DisabledPluginRecord<R> {
  return {
    ...record,
    enabled: false,
    updatedAt,
  };
}
```

[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:229-238]

A spread preserves any existing marker, which is what you want for an ordinary
user `disable` over an already-marked record — but it is also why the marker
cannot be *set* through this function without a third argument.

### Anti-Patterns to Avoid

- **Re-deriving the disabled predicate.** Any new module that writes
  `!record.enabled`, `.enabled === false`, `.enabled !== true`,
  `record["enabled"]`, `Boolean(record.enabled)` or destructures `{ enabled }`
  fails `tests/architecture/disabled-state-classification.test.ts`, which walks
  **every** `.ts` file under `extensions/pi-claude-marketplace/` (not an
  allowlist) [VERIFIED: tests/architecture/disabled-state-classification.test.ts:40-52, 92-111, 178-210].
  Import `isRecordedButDisabled`. A new module that legitimately classifies on
  it must also join `DISABLED_STATE_TARGETS` **and** the parallel
  `DECLARED_MODULE_ORDER` basename list, which is pinned by `deepEqual`
  [VERIFIED: tests/architecture/disabled-state-classification.test.ts:31-38, 184-189; tests/architecture/gate-targets.ts:368-374].
  Note `dependencyDisabled` is a *different* property name and trips none of
  those patterns.
- **Importing fs into `plan.ts`.** The purity gate greps the comment-stripped
  source for `from "node:fs"`, `from "node:fs/promises"`, `platform/git`, and
  the bare identifiers `gitOps`, `notify`, `saveState`, `saveConfig`,
  `atomicWriteJson`, `withStateGuard`, `withLockedStateTransaction`
  [VERIFIED: tests/architecture/reconcile-planner-purity.test.ts:31-45].
  CONTEXT.md's description of this list is accurate and complete. Note
  `\bnotify\b` matches *any* identifier containing the word as a whole word —
  a helper named `notifyReason` in plan.ts would fail the gate.
- **Growing `applyPlan`'s body inline.** Each step is its own extracted
  `async function`; add `applyDependencyDisables` as a sibling, not a branch
  inside `applyPluginToggles`.
- **Putting an interpolated remedy in a frozen trailer.** All three existing
  trailers (`PARTIAL_INSTALL_HINT_TRAILER`, `PARTIAL_UPDATE_HINT_TRAILER`,
  `STALE_GATE_UPDATE_HINT_TRAILER`, `ENABLE_HINT_TRAILER`) are byte-frozen
  literals that deliberately interpolate no identifier (T-69-01 / T-73-01)
  [VERIFIED: extensions/pi-claude-marketplace/shared/notification-grammar.ts:1040-1055].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Does this recorded version satisfy this range?" | A comparator | `recordedVersionSatisfies` | D-03-04 already documents and accepts the `hash-`/`sha-` coercion risk; a second evaluator would diverge |
| "What does record X declare?" | A manifest read in the reconcile layer | `dependency-index.ts`'s read path (or a sibling sharing `readDependencyDeclaration`) | D-05-06's read order (own manifest outranks marketplace entry) and D-05-07's fail-closed posture are non-obvious and already proven |
| "Is this record disabled?" | `!record.enabled` | `isRecordedButDisabled` | Whole-tree twin gate; also the availability axis is deliberately excluded |
| "Write the disabled form" | Field mutation in place | `toDisabledRecord` | `DisabledPluginRecord<R>`'s `resources: R` passthrough makes an inventory change a compile error at the producer |
| "Who declares this key?" | A reverse-index walk | `findDependents(key, index)` | Already the uninstall guard's second half |
| "Intersect N declared ranges" | A fold | `intersectDependencyRanges` | Carries both project-owned caps (4096 input chars, 1024 conjuncts) and the disjointness detection that `validRange` alone gets wrong |
| "Bound a range for display" | `slice(0, n)` | `renderConstraintRange` | Emits the `... (+N chars)` marker the catalog expects |
| "Repeat until stable" | A `while(true)` with an ad-hoc break | Copy D-05-02's sweep shape from the Phase 5 orphan sweep | Precedented and already reviewed; D-06-05 says mirror it |

**Key insight:** every one of these was built in Phases 3–5 *for this exact
question asked from a different direction*. The phase's risk is not building
the wrong thing — it is re-building a thing that exists.

## Runtime State Inventory

This is not a rename/refactor phase, but it **does** add a persisted field, so
the equivalent question — "what already-written state does this change reach?"
— is answered here.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per scope: a new optional `dependencyDisabled?: boolean` on each plugin record. Legacy records lack it; absence means "not consequence-disabled" | Code edit only. **No migration, no `schemaVersion` bump** — the `resolvedSha`/`hookEntries` precedent [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:93-118] |
| Field-enumeration sites that would silently drop the new key | 3 found: `state-io.ts::clonePluginRecord` (enumerates, 160-193, with an explicit warning comment); `reinstall-record.ts::recordReinstalledOutcome` (rebuilds the literal, 128-151); `install-outcome.ts::statePhase` (rebuilds the literal, 940-1000). `toDisabledRecord` spreads and is safe | `clonePluginRecord`: **add** the conditional spread (a snapshot that loses the marker makes a failed-reinstall restore lie). The other two: **deliberately omit**, and comment why — the omission IS the clear-on-lift (Pattern 4) |
| Schema key-set pin | `tests/architecture/compat-01-no-expansion.test.ts:454-480` pins the record's key set to exactly 10 sorted names: `compatibility, enabled, hookEntries, installedAt, provenance, resolvedSha, resolvedSource, resources, updatedAt, version` | Add `dependencyDisabled` to that expected array (it sorts second, after `compatibility`). The assertion message already documents the "optional additive, no bump" route as sanctioned |
| Live service config | None — this extension holds no external service config | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None (no build step; Node strips TS natively) | None |
| Config files (`claude-plugins.json`) | **Unchanged.** D-04-02 / LOAD-02: the consequence-disable is deliberately NOT written back to the config — the config carries only what the user asked for | None — and a plan that writes it back violates LOAD-02 |

## Common Pitfalls

### Pitfall 1: Nesting the scope lock

**What goes wrong:** the new `applyDependencyDisables` step takes
`withLockedStateTransaction` while an enclosing lock is already held →
`ELOCKED` → `StateLockHeldError`.
**Why it happens:** `proper-lockfile` is configured `retries: 0` and is not
re-entrant; the codebase's own guard-free "ledger body" functions
(`runInstallLedgerBody`, `runInstallLedger`) exist purely to let already-locked
callers in.
**How to avoid:** the apply pass holds **no** outer lock — `applyPlan`'s header
says so explicitly ("NO outer lock -- each orchestrator owns its per-scope
critical section (CR-01)", `apply.ts:782-786`). A new step called from
`applyPlan` may take the lock. A helper called from inside `readPassForScope`
may **not** (that closure is already inside one).
**Warning signs:** the new step produces `{lock held}` rows in the reconcile
cascade on a clean single-process run.

### Pitfall 2: The oscillation LOAD-02 forbids

**What goes wrong:** pass N disables B; pass N+1's `classifyDeclaredPlugin`
sees "config says enabled, record is disabled" and buckets B for enable; pass
N+2 disables it again. The user sees the plugin flip on every reload and the
cascade is never silent.
**Why it happens:** `plan.ts:498` gates only on `isRecordedButDisabled(record)`
today — a consequence-disable is structurally indistinguishable from an
ordinary declared-enabled/recorded-disabled divergence.
**How to avoid:** Pattern 3's three-term gate. Test it as a *convergence*
proof, not a single-pass assertion: run the plan+apply cycle twice against the
same fixture and assert the second pass produces `emptyReconcilePlan` (the
codebase already has this shape — `plan.test.ts:457` "returns identical
complete nonempty plans for repeated calls", and
`tests/architecture/cross-op-convergence.test.ts` exists for exactly this
class).
**Warning signs:** a reload that is not silent on an unchanged tree. RECON-05 /
NFR-2 / A4 make "empty-and-clean reconcile is SILENT" a hard contract
(`apply.ts:923-928`).

### Pitfall 3: The fixpoint that does not terminate

**What goes wrong:** D-06-05's repeat-until-stable loop runs forever on a
dependency cycle (A declares B, B declares A, both enabled, C missing).
**Why it happens:** the loop's termination argument is "each pass disables at
least one new record, and the record set is finite" — which holds only if the
loop's exit condition is *"no record changed"*, not *"no record is unsatisfied"*.
**How to avoid:** copy D-05-02's shape literally: accumulate newly-disabled
keys into a set, exit when a pass adds nothing. Bound the iteration count by
the record count as a belt-and-braces assertion.
**Warning signs:** a test that hangs rather than fails.

### Pitfall 4: `buildScopeDeclarationIndex`'s `exclude` is required

**What goes wrong:** calling the existing index for the load-time check with a
made-up `exclude` value silently omits a record from the walk — or worse,
passing `""` excludes nothing but reads as intentional.
**Why it happens:** `ScopeDeclarationIndexOptions.exclude` is documented as
"The `name@marketplace` key under decision; it is never indexed"
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:84-85]
— it is modelled for the uninstall question ("who else declares the thing I am
removing"), where there *is* a key under decision. The load-time check has no
such key: every record is both a potential declarer and a potential dependency.
**How to avoid:** this is one of two reasons a sibling function is cleaner than
reuse (the other is the dropped version constraint — §Open Question 3).
**Warning signs:** an `exclude: ""` or `exclude: "<none>"` literal in the diff.

### Pitfall 5: The `dependents remain` retirement is a 13-site sweep

**What goes wrong:** the token is removed from `REASONS` and typecheck goes
red across half the test tree; or worse, the token is left in place and the
gates stay green while the behavior is gone.
**Why it happens:** a closed-set member has homes in production, in six gates,
in the catalog, and in five behavioral suites.
**Sites found this session** (`grep "dependents remain"` over `extensions/ tests/ docs/`):

| Site | What it is |
|------|------------|
| `extensions/…/orchestrators/plugin/uninstall.messaging.ts:27, 39` | The `UninstallPrivateReason` compile-time pin |
| `extensions/…/orchestrators/plugin/uninstall.ts:214, 263` | The doc comment and the `throw` |
| `extensions/…/shared/notification-types.ts:111-120` | The tuple member + its rationale comment |
| `extensions/…/shared/notify-reasons.ts:296-303` | The command-private group member + its comment |
| `tests/architecture/notify-closed-set-locks.test.ts:68, 76` | Length pin (56) + running rationale comment |
| `tests/architecture/compat-01-no-expansion.test.ts:222-225` | Enumeration pin |
| `tests/architecture/catalog-uat/catalog-contract.test.ts:55, 59` | Fixture rationale |
| `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts:182` | Standalone fixture |
| `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts:300, 319` | Reconcile fixture |
| `tests/orchestrators/plugin/uninstall.messaging.test.ts:15` | `satisfies` proof |
| `tests/orchestrators/plugin/uninstall.test.ts:4839, 4952, 4962, 4968, 5103-5104, 5577` | 6 behavioral cases |
| `tests/orchestrators/reconcile/apply-outcomes.test.ts:119-120` | Outcome classification |
| `tests/orchestrators/reconcile/notify.test.ts:1194, 1201, 1220` | Row rendering |
| `tests/orchestrators/reconcile/apply.test.ts:1218, 1394` | Cascade byte assertions |
| `tests/shared/notification-types.test.ts:76` | Second enumeration pin |
| `docs/dependency-resolution.md:130-138` | The §"Removing a plugin other plugins need" prose |
| `docs/output-catalog.md:63, 1102-1116, 2723-2740` | Grammar paragraph + 2 catalog states |

**How to avoid:** decide up front (§Open Question 4) whether the token is
*retired* or *repurposed*. Repurposing keeps 15 of these 17 sites as
comment-only edits.

### Pitfall 6: Green runs that checked nothing

**What goes wrong:** a gate is amended in a way that stops it gating. The
codebase has hit this repeatedly and the tests now carry explicit
counter-measures: `assert.ok(TARGETS.length > 0, "D-07-03: an empty target
group leaves this gate reading nothing")` appears in the purity gate, the
COMPAT-01 gate and the disabled-state gate.
**How to avoid:** when amending `REASONS`, never derive the expected list from
the constant under test — `compat-01-no-expansion.test.ts:60-72` forbids this
in prose ("A derived list makes the assertion a tautology that can never fail,
which is worse than no gate"). Also: run `npm run fallow` and check `$?`, never
the glyph — `fallow dupes` prints a red ✗ summary on a tree that exits 0.

### Pitfall 7: `resources_discover` must never throw

**What goes wrong:** the new async pre-step throws (an fs EACCES on a
marketplace manifest) and aborts the whole reconcile for both scopes.
**How to avoid:** the verdict builder must return a discriminated failure arm
(the `{ ok: false; declarer; cause }` shape `ScopeDeclarationIndexResult`
already uses) rather than throwing. `readPassForScope`'s throws are already
caught per-scope and coerced to an `invalid-block` row (`apply.ts:869-894`), so
a throw is survivable — but it would attribute the failure to `state.json`,
which would be a false claim. Prefer the typed arm.

## Code Examples

### Example 1: The schema field (D-06-01)

```ts
// extensions/pi-claude-marketplace/persistence/state-io.ts
// Insert immediately after `hookEntries` (line 118) and before `compatibility`
// (line 119). Follows the resolvedSha / hookEntries precedent quoted at :93-99.
export const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  resolvedSha: Type.Optional(Type.String()),
  hookEntries: Type.Optional(Type.Array(PERSISTED_HOOK_ENTRY_SCHEMA)),
  // LOAD-02 / D-06-01: the record is disabled as a CONSEQUENCE of an
  // unsatisfied declaration, not by a user choice. OPTIONAL and additive --
  // NO schemaVersion bump (the resolvedSha / hookEntries precedent), so a
  // legacy record without it loads unchanged and absence needs no migrate
  // fill. Absence means "not held down by the check"; it is never a claim
  // that the check ran and found nothing.
  dependencyDisabled: Type.Optional(Type.Boolean()),
  compatibility: Type.Object({ /* … */ }),
  // …
});
```

And the matching clone (the comment at `state-io.ts:144-158` names this hazard
explicitly — "the copy ENUMERATES fields instead of spreading, so a key added
to `PLUGIN_INSTALL_RECORD_SCHEMA` and not added here is dropped from every
snapshot with no compile error"):

```ts
// extensions/pi-claude-marketplace/persistence/state-io.ts::clonePluginRecord
    ...(record.hookEntries !== undefined && {
      hookEntries: record.hookEntries.map((entry) => ({ ...entry })),
    }),
    // LOAD-02 / D-06-01: preserve the consequence-disable marker across the
    // snapshot. Dropping it here would let a failed reinstall restore a record
    // that reads as a user's own disable.
    ...(record.dependencyDisabled !== undefined && {
      dependencyDisabled: record.dependencyDisabled,
    }),
```

### Example 2: The closed-set amendment (the two precedents)

The command-private-token declaration pattern, verbatim from
`uninstall.messaging.ts:33-39`:

```ts
// `_ReasonInSet<R extends Reason> = R` pins the private reasons to the closed
// `Reason` set as it derives `UninstallPrivateReason`: an out-of-set literal
// violates the `extends Reason` constraint -- a TS2344 compile error here, with
// no runtime footprint.
type _ReasonInSet<R extends Reason> = R;
// fallow-ignore-next-line private-type-leak -- `_ReasonInSet` is the compile-time membership guard; exporting that helper would widen the command's public reason vocabulary.
export type UninstallPrivateReason = _ReasonInSet<"dependency pruned" | "dependents remain">;
```

`remove.messaging.ts:36-38` is byte-identical in shape with
`RemovePrivateReason = _ReasonInSet<"plugins remain">`.

The row-brace-constant pattern, verbatim from `install.messaging.ts:328-331`:

```ts
/**
 * D-04-07: the promotion brace, in reason order. The standalone row
 * (`composePromotedRow`) and import's promoted row both carry it from here, so
 * a promotion reads as one thing whichever command performed it.
 */
export const PROMOTED_ROW_REASONS = [
  "already installed",
  "dependency promoted",
] as const satisfies readonly ContentReason[];
```

`uninstall.messaging.ts:77-86` shows the two-variant form
(`PRUNED_ROW_REASONS` / `PRUNED_ROW_REASONS_DATA_KEPT`) with the ordering
contract stated in the comment ("why the plugin went, then what was kept").

**The full amendment checklist, verified this session.** For each token added
or removed:

| # | Surface | Location | What changes |
|---|---------|----------|--------------|
| 1 | The tuple | `extensions/…/shared/notification-types.ts:6-127` (`REASONS`) | Append at the tail, with a rationale comment matching the neighbours' register |
| 2 | Topic group home | `extensions/…/shared/notify-reasons.ts` (command-private union at :295-314; `_ReasonsCoverageProof` at the file tail) | A literal with no home is a compile error |
| 3 | Header count prose | `extensions/…/shared/notify-reasons.ts:8, 15` and the running narrative at :19-47 | The file says "56-entry" twice and narrates every past bump; extend the narrative |
| 4 | Length pin | `tests/architecture/notify-closed-set-locks.test.ts:29, 76` | Title string **and** `assert.equal(REASONS.length, 56)`; add the `(56 -> N)` rationale comment |
| 5 | Enumeration pin (1 of 2) | `tests/architecture/compat-01-no-expansion.test.ts:146-241` | The hand-written `expected` array, in tuple order |
| 6 | Enumeration pin (2 of 2) | `tests/shared/notification-types.test.ts:76` region | Second enumeration of the same tuple |
| 7 | Catalog grammar paragraph | `docs/output-catalog.md:63` | Says "The 56-member … `REASONS` tuple" and enumerates the dependency-cascade tail block by name |
| 8 | Catalog row + byte lock | `docs/output-catalog.md` — uninstall section at :1003, reconcile-applied section ending :2755 | A `### ` heading, prose, a `<!-- catalog-state: <kebab-name> -->` marker, and a fenced ```text block |
| 9 | Catalog-UAT fixture | `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` (348 lines) and/or `…/reconcile-applied.ts` (360 lines) | One typed payload per catalog-state, byte-compared by `catalog-contract.test.ts` |
| 10 | Catalog parser counts | `tests/architecture/catalog-uat/catalog-parser.test.ts:74-75` | `assert.equal(examples.length, 215)` and `assert.equal(new Set(sections).size, 20)` — bump 215 by the number of new fenced states; the section count moves only if a new `## ` heading appears (it should not) |

Arithmetic for the likely shape (2 remedy tokens + 1 LOAD-03 token, retiring
`dependents remain`): `REASONS.length` goes **56 → 58**.

### Example 3: The uninstall change (D-06-06 / D-06-07)

Current code, verbatim, `uninstall.ts:238-267`:

```ts
/**
 * D-05-14 / PRUNE-05: refuse to remove `key` while any other record in this
 * scope's state declares it, and refuse (D-05-07) while any other record's
 * declarations cannot be established. Runs INSIDE the locked transaction over
 * `tx.state`, so the declarer set and the removal decision share one snapshot
 * under one cross-process lock (T-05-03). Returns the walk on the way
 * through, because the orphan sweep that follows the removal consumes both
 * its index and its candidate records.
 */
async function assertNoDependents(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly key: string;
}): Promise<DeclarationSnapshot> {
  const result = await buildScopeDeclarationIndex({
    state: args.state,
    locations: args.locations,
    exclude: args.key,
  });
  if (!result.ok) {
    throw new UninstallRefusedError("unreadable", result.cause.message);
  }

  const dependents = findDependents(args.key, result.index);
  if (dependents.length > 0) {
    throw new UninstallRefusedError("dependents remain", `required by ${dependents.join(", ")}`);
  }

  return result;
}
```

**Wiring, verified:** the sole call site is `uninstall.ts:1043`, inside the
`withLockedStateTransaction` closure, positioned after the two converge arms
(`mp === undefined` at :1012, `installed === undefined` at :1027) and before
`cascadeUnstagePlugin` at :1047. Its thrown error escapes the closure, is caught
by the `catch` at :1109, and routes to `emitCascadeFailure` via
`narrowCascadeFailure` (`:289-292`), which classifies `UninstallRefusedError`
**first** so the errno fallthrough cannot re-read it as `unreadable`.

**Scoped diff shape:**

1. `assertNoDependents` → rename to something like `readDependentsSnapshot`;
   **keep** the `!result.ok` throw (D-05-07's fail-closed posture is explicitly
   preserved by D-06-06 — an unreadable declarer still refuses), **delete** the
   `dependents.length > 0` throw, and return `{ ...result, dependents }`.
2. Hoist `dependents` out of the closure the way `removedVersion` (:1035) and
   `prunedMembers` are hoisted, so the success emission at :1218-1230 can read it.
3. `buildUninstalledRow` (`uninstall.ts:873-887`) gains the new reason. It
   currently reads:
   ```ts
   function buildUninstalledRow(
     plugin: string,
     removedVersion: string | undefined,
     keepData: boolean,
   ): PluginUninstalledMessage {
     return {
       status: "uninstalled",
       name: plugin,
       ...(removedVersion !== undefined && { version: removedVersion }),
       ...(keepData && { reasons: ["data kept"] as const }),
       severity: "info",
       needsReload: true,
     };
   }
   ```
   Note the reason list is currently a **replace**, not an append — adding a
   second axis means composing the array the way `PRUNED_ROW_REASONS` /
   `PRUNED_ROW_REASONS_DATA_KEPT` do, with a stated order contract.
4. `UninstallRefusedError`'s doc comment (:211-225) and `narrowCascadeFailure`'s
   (:278-288) both name the refusal; update or delete the `dependents remain`
   half while keeping the `unreadable` half.
5. The orchestrated outcome (`:1207-1213`) carries no reasons today. If the
   reconcile-driven uninstall should also name dependents, `UninstallPluginOutcome`'s
   `uninstalled` arm (`:136`) needs the field and `apply-outcomes.ts`'s
   `plugin-uninstalled` arm and `notify.ts:805-812` need to carry it. **Decide
   this explicitly** — LOAD-03's text says "the row names the dependents" without
   distinguishing the two surfaces.

**Severity note.** The row stays `severity: "info"` / `needsReload: true`: the
uninstall was carried out in full, which is the `info` arm of the project's
tri-state model. The *consequence* for the dependents is reported at the next
load by LOAD-01, at `warning`.

### Example 4: The reconcile disable row (LOAD-01 rendering)

Today's `(disabled)` row from a reconcile outcome, verbatim,
`orchestrators/reconcile/notify.ts:842-858`:

```ts
    case "plugin-disabled":
      block.plugins.push({
        status: "disabled",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
        // DFEN-04 / OUT-01 / OUT-04: forwarded when the producer supplied them,
        // which is the install-disabled cascade and nothing else. The toggle
        // path omits both and renders the byte-frozen bare row. Conditional
        // spreads because `exactOptionalPropertyTypes` rejects an explicit
        // `undefined`.
        ...(outcome.reasons !== undefined && { reasons: outcome.reasons }),
        ...(outcome.enableHint === true && { enableHint: true }),
        // D-03/D-06: a realized disable transition -> info, reloads.
        severity: "info",
        needsReload: true,
      });
      return block;
```

`PluginDisabledMessage` already carries optional `reasons` and `enableHint`
[VERIFIED: extensions/pi-claude-marketplace/shared/notification-types.ts:287-295]:

```ts
export interface PluginDisabledMessage extends TransitionMessageBase {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
  readonly enableHint?: boolean;
}
```

It carries **no `cause`**, and the trailer gate is status-conditional
[VERIFIED: extensions/pi-claude-marketplace/shared/notification-grammar.ts:1625-1634]:

```ts
  if (p.status === "failed" || p.status === "manual recovery") {
    const trailer = renderIndentedCauseChain(p.cause, "    ");
    if (trailer !== "") {
      lines.push(trailer);
    }

    for (const leak of manualRecoveryLeaks(p.cause)) {
      lines.push(`    leaked: ${leak}`);
    }
  }
```

**Target row shape** (under the recommended resolution of Open Question 1):

```text
A plugin operation completed with warnings.

● mp [project]
  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}
    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"

Reconcile: 1 warning
```

The `cause:` line is the *only* channel in this grammar that legally
interpolates a plugin identifier, which is exactly how `dependents remain`
carries its dependent list today (`docs/output-catalog.md:1112-1116`).

## State of the Art

| Old approach (pre-Phase 6) | Current approach (this phase) | Impact |
|--------------|------------------|--------|
| `uninstall` refuses while a dependent remains (PRUNE-05 / D-05-14..16) | `uninstall` proceeds and names the dependents | Removes the two-stale-records deadlock `docs/dependency-resolution.md:138` documents, and makes `PRUNE-GUARD-MR-01` (BACKLOG:3011-3022) moot as a *guard* — the dangling dependents a `marketplace remove` leaves are now reported by the load-time check instead |
| Reconcile's only enablement inputs are the config value and the record's `enabled` flag (`docs/plugin-enablement.md:24`) | A third input joins: the live satisfaction verdict, with `dependencyDisabled` as its persisted shadow | `docs/plugin-enablement.md:24` ("The planner itself never sees the manifest side; its only enablement inputs are the configuration value and the record's own flag") and `:32` ("no persisted field was added on either side") both become false and need rewriting |
| An installed plugin's declarations are never re-checked after install | Every reload re-checks them | This is the whole of LOAD-01 |

**Deprecated by this phase:**
- `assertNoDependents`'s `dependents remain` throw (`uninstall.ts:262-264`)
- The `refused-dependents-remain` and `reconcile-uninstall-refused-dependents`
  catalog states (`docs/output-catalog.md:1102-1116, 2723-2740`)
- `docs/dependency-resolution.md:130-138` — the whole "Removing a plugin other
  plugins need" section, including the sentence D-06-07 names: *"Claude Code
  documents this refusal for `disable`; this extension applies it to
  `uninstall`."* (**Note:** the section is at lines 130-138, not "§138" as a
  heading number — §138 in CONTEXT.md refers to the line, and the sentence is at
  the end of line 134's paragraph.)
- D-05-14, D-05-15, D-05-16 as active decisions (superseded; the superseding
  record belongs in this phase's REVIEW or SUMMARY per D-06-07)

## Which prose lands here vs. Phase 7

CONTEXT.md flagged this as needing resolution at planning time. Verified:

| Doc | Section | Lands in Phase 6? |
|-----|---------|-------------------|
| `docs/dependency-resolution.md` | "Removing a plugin other plugins need" (:130-138) | **Yes** — D-06-07 names it directly and LOAD-03 retires its subject |
| `docs/dependency-resolution.md` | The D-05-07 fail-closed paragraph (:134) | **Partly** — the unreadable-declarer refusal SURVIVES (D-06-06 preserves it), so the paragraph is edited, not deleted |
| `docs/dependency-resolution.md` | "Pruning dependencies nothing needs" (:140-150) | **No** — `--prune` semantics are unchanged (success criterion 3) |
| `docs/dependency-resolution.md` | A **new** section for the load-time check | **Yes** — LOAD-01/02 have no home today |
| `docs/plugin-enablement.md` | Reconcile row (:24) and "Where the state lives" (:30-32) | **Yes** — both make claims this phase falsifies |
| `docs/plugin-enablement.md` | "A plugin required by another active plugin is not enabled on its behalf" (:38-44) | **No** — that divergence is about `enable` writing `true` on an author's behalf, which is EDEP-01/03, Phase 8 |
| `docs/output-catalog.md` | uninstall + reconcile-applied rows | **Yes** |
| DIVG-01 (the HANDOFF's "Docs" grouping item 8) | — | **Phase 7.** Confirmed: the HANDOFF groups it with tag resolution, and `.planning/REQUIREMENTS.md`'s TAGS block is Phase 7's scope |

`docs/plugin-enablement.md:60` records that the doc is deliberately **not**
byte-gated ("This contract is prose, checked by reading; nothing fails if a
claim here drifts") — so its edits will not be caught by CI. Put them in the
plan explicitly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The upstream remedy strings are exactly `Install "X" or uninstall "Y"`, `Enable "X" or uninstall "Y"`, `Update "X" to satisfy R, or uninstall "Y"`, and the error codes are `dependency-unsatisfied` / `dependency-version-unsatisfied`. Transcribed from `.planning/HANDOFF-upstream-dependency-parity.md:107-109`, which attributes them to a grep of the Claude Code binary 2.1.267 by a prior session. **Not re-verified against a binary or upstream doc this session.** | Code Example 4, Open Question 1 | A wrong sentence ships as a frozen catalog byte-contract. The project's own practice (memory: "Grep Claude Code binary for parity data") is to confirm against `~/.local/share/claude/versions/<v>` before freezing |
| A2 | `dependency unsatisfied` / `dependency version unsatisfied` are acceptable 2-3-word reason tokens under `docs/output-catalog.md:63`'s "1-3 words lowercase" rule | Open Question 1 | "dependency version unsatisfied" is 3 words and fits; a longer coinage would not. Low risk |
| A3 | Widening `PluginDisabledMessage` with `cause?: Error` and the `:1625` trailer gate is a *grammar* change, not a closed-set expansion, so it trips no COMPAT-01 clause | Open Question 1 | COMPAT-01 pins tuples, glyph count and the record key set — none covers message-interface fields. But `notify-grammar-invariant.test.ts`, `notify-producer-wire-coverage.test.ts` and `notify-stamp-coverage.test.ts` were not read this session and may enumerate per-variant fields |
| A4 | `REASONS.length` arithmetic of 56 → 58 assumes 3 added and 1 retired | Example 2 | Depends entirely on Open Questions 1 and 4; recompute after they are settled |
| A5 | Adding a fourth parameter to `planReconcile` is preferable to bundling it into a new options object | Pattern 1 | `planReconcile(merged, state, scope)` has exactly one production call site (`apply.ts:197`) plus `plan.test.ts`'s cases, so either is cheap. If the signature would exceed 4 params, `CONVENTIONS.md` says switch to an opts object (and Sonar S107 is already a tracked concern per `.planning/HANDOFF-sonar-s107-s7737.md`) |
| A6 | The new verdict module belongs in `orchestrators/reconcile/` rather than `orchestrators/plugin/` | Module placement | Either satisfies fallow's zone allow-list (both are the `orchestrators` zone). `reconcile/` is chosen because the consumer is reconcile-only and `no-orchestrator-network.test.ts` already names the reconcile family |

## Open Questions

### 1. The remedy sentence has no legal home on a `(disabled)` row — resolve before planning tasks

**What we know.**
- The remedy interpolates two plugin identifiers and, for the third shape, a
  version range.
- A reason token cannot carry it: `docs/output-catalog.md:63` — *"Each reason
  is 1-3 words lowercase, hyphenated where natural"* — and the whole closed-set
  machinery (`REASONS` is a literal tuple, `ContentReason` is a literal union)
  makes a parameterized token impossible by construction.
- A frozen trailer cannot carry it: all four existing trailers interpolate
  nothing by explicit contract (T-69-01 / T-73-01,
  `notification-grammar.ts:1040-1055`).
- The `cause:` chain is the only interpolating channel, and it renders on
  `failed | manual recovery` only (`notification-grammar.ts:1625`).
- `PluginDisabledMessage` has no `cause` field
  (`notification-types.ts:287-295`).
- The precedent is explicit: for `dependents remain`, *"the names ride the
  cause line and never the token"* (`docs/output-catalog.md:1110`) — but that
  row is `(failed)`, so the channel was already open.

**Options.**

| Option | Shape | Cost | Verdict |
|--------|-------|------|---------|
| **A (recommended)** | `(disabled)` row, 2-word token, remedy on a cause line. Add `cause?: Error` to `PluginDisabledMessage`; widen the `:1625` gate to `\|\| p.status === "disabled"` | One message field, one renderer condition, plus fixture/byte-lock work. No new status, no new glyph | Truthful on every axis: the disable happened (`disabled`), the desired state was not reached (`warning`), and the remedy names the parties |
| B | Render the row as `(failed)` | Zero grammar change | Rejected: `(failed)` means the operation did not happen; the disable did. Also `PluginFailedMessage.severity` is `"error" \| "warning"` and the reload hint would be wrong |
| C | Two rows — a `(disabled)` transition row plus a `(failed)` advisory row | Zero grammar change | Rejected: two rows for one fact; the tally would double-count |
| D | A second `notifyDiagnostic` after the cascade, like `surfacePostCommitWarnings` (`apply.ts:1019-1058`) | Zero grammar change | Rejected: that channel is documented as *"the only sanctioned exception to RECON-04's single-emit discipline"*, reserved for post-commit hygiene, and the remedy is not hygiene |

**Recommendation:** Option A, with the token mirroring upstream's error code
(`dependency unsatisfied` for missing-or-disabled, `dependency version
unsatisfied` for out-of-range) so the closed set names the *condition* and the
cause line names the *remedy* — exactly the split `dependents remain` already
established. Verify A1 before freezing the cause-line bytes.

### 2. Nothing in the reconcile apply path can write `dependencyDisabled: true`

**What we know.** `applyPluginToggles` (`apply.ts:667-727`) does not touch the
record at all — it calls `setPluginEnabled(…)` and maps the returned outcome.
`setPluginEnabled`'s disable branch writes through `toDisabledRecord(installed,
new Date().toISOString())` (`enable-disable.ts:450`), a two-argument function
with no extension point. `enable-disable.ts` is explicitly out of scope for
this phase.

Answering the orchestrator's question directly: **`applyPluginToggles` has no
access to a per-record satisfaction verdict, and no access to the record at
all.** Its inputs are `opts`, the bucket array, the outcomes accumulator, and
the `PluginToggleAxes` callbacks; its only record-facing act is delegation.

**Options.**

| Option | Cost | Notes |
|--------|------|-------|
| **A (recommended)** New `applyDependencyDisables` step in `apply.ts`, called from `applyPlan` after step 6. It takes the scope lock itself, walks the new bucket, replaces each record with `{ ...toDisabledRecord(record, nowIso), dependencyDisabled: true }`, saves once, and pushes its own outcome arm | One new function + one new outcome arm + one new plan bucket | Keeps `enable-disable.ts` untouched; owns the transition and the marker atomically; fixpoint (D-06-05) has a natural home inside the one locked transaction |
| B | Add an optional third argument to `toDisabledRecord` | Smallest diff | Touches the sole sanctioned disabled-record producer and its `DisabledPluginRecord<R>` type proof; gated by `disabled-state-classification.test.ts`. Still needs a caller that is not `enable-disable.ts` |
| C | Extend `setPluginEnabled` with an opt-in flag | — | Rejected by the phase boundary ("`enable-disable.ts` is untouched here") |
| D | `applyPluginToggles` re-opens the lock after `setPluginEnabled` returns to stamp the marker | Smallest structural change | Rejected: two writes for one transition; a crash between them leaves a disabled record with no marker, which pass N+1 reads as a user disable and never lifts |

**Recommendation:** Option A. It also gives D-06-05's fixpoint a correct home:
the sweep must observe its own disables, which means it must run inside the
transaction that performs them — something a bucket-driven `setPluginEnabled`
loop cannot do (each call takes and releases its own lock).

**Consequence for Pattern 2:** the new bucket is not optional under Option A —
`plan.ts` must emit `PlannedDependencyDisable` entries carrying enough data for
the row (dependent key, dependency key, `kind`, optional `range`).

### 3. `buildScopeDeclarationIndex` cannot answer the range half as-is

**Answering the orchestrator's question #3 directly.**

Full signature and types, verbatim
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:79-114, 177-179]:

```ts
/** Inputs of one scope-wide index build. */
export interface ScopeDeclarationIndexOptions {
  /** The locked snapshot of the target scope's state document. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** The `name@marketplace` key under decision; it is never indexed. */
  readonly exclude: string;
  /** Filesystem seam of the declaration read; production omits it. */
  readonly reader?: DependencyDeclarationReader;
  /** Manifest-load seam; production omits it and reads the memoized cache. */
  readonly loadManifest?: typeof loadMarketplaceManifest;
}

export type ScopeDeclarationIndexResult =
  | {
      readonly ok: true;
      readonly index: DeclarationIndex;
      readonly candidates: readonly IndexedRecord[];
    }
  | {
      readonly ok: false;
      readonly declarer: string;
      readonly cause: Error;
    };

export async function buildScopeDeclarationIndex(
  options: ScopeDeclarationIndexOptions,
): Promise<ScopeDeclarationIndexResult>
```

**Can it be reused as-is? No.** Two blockers, in order of severity:

1. **The version constraint is discarded.** `readRecordDeclarations` maps each
   declaration to a bare key [VERIFIED: dependency-index.ts:165-170]:
   ```ts
   return {
     ok: true,
     declared: new Set(
       read.dependencies.map((dep) => `${dep.name}@${dep.marketplace ?? marketplace.name}`),
     ),
   };
   ```
   `DeclaredDependency` carries `version?` and `sha?`
   [VERIFIED: extensions/pi-claude-marketplace/domain/dependencies.ts:35-40], and the
   module header states the design intent explicitly: *"A declaration HOLDS its
   key whatever `version` or `sha` constraint it carries"* (:44-46). That is
   correct for the dependents question and useless for LOAD-01's third clause.
2. **`exclude` is required and has no meaning here** — see Pitfall 4.

**Recommendation:** add a sibling in the same file that shares
`readRecordDeclarations`' read path but returns
`ReadonlyMap<string, readonly DeclaredDependency[]>` instead of
`ReadonlyMap<string, ReadonlySet<string>>`, with `exclude` optional. Keeping it
in `dependency-index.ts` inherits the file's network-free gate entry
(`gate-targets.ts:120-121`) for free; a new file would have to be added to
`NETWORK_FREE_TARGETS` deliberately.

**Current call site, exactly as invoked** (answering "what scope/state is it
given") — `uninstall.ts:252-256`, inside the locked closure, given `tx.state`
(the locked snapshot, hoisted to `const state = tx.state` at :1001), the
command's own `locations`, and `exclude: primaryKey` where
``primaryKey = `${plugin}@${marketplace}` `` (:1042). Production omits both
seams. There is exactly one call site.

### 4. Retire `dependents remain`, or repurpose it?

**What we know.** D-06-07 says "retired, not left dead in place". But LOAD-03
needs a token for the new success-row fact, and `dependents remain` is
literally accurate for it: the dependents *do* remain installed, and they will
be unsatisfied.

| Option | `REASONS.length` | Sweep size |
|--------|------------------|-----------|
| Retire + add a new LOAD-03 token | 56 − 1 + 1 + 2 = **58** | All 17 sites in Pitfall 5, most as real edits |
| Repurpose `dependents remain` for the success row | 56 + 2 = **58** | Same 17 sites, but ~15 are comment/fixture edits rather than deletions; both enumeration pins and the length pin stay green |

The arithmetic is identical; the diff size is not. Repurposing does change the
token's severity class — `notify-reasons.ts:296-303` currently files it under
the command-private reasons with the note *"it is NOT idempotent: the operation
was refused, not already done"*, which becomes false. D-06-07's letter favours
retirement; its spirit (no dead vocabulary) is satisfied either way.

**Recommendation:** present both to the operator at plan review. Lean retire —
D-06-07 is a locked decision and the token's current comment block asserts a
refusal that no longer happens, so a reader who greps the token would be misled
by the cheaper option.

### 5. Does the reconcile-driven uninstall also name dependents?

LOAD-03's text says "the row names the dependents" without distinguishing the
standalone command from the reconcile-driven path. The orchestrated outcome
arm (`UninstallPluginOutcome`'s `uninstalled`, `uninstall.ts:136`) carries only
`name` and `version?` today, and `notify.ts:805-812` builds a bare
`(uninstalled)` row from it. Carrying the dependents to the reconcile surface
means threading a field through `UninstallPluginOutcome` →
`apply-outcomes.ts::PluginUninstalledOutcome` → `notify.ts`. Cheap, but it is a
scope decision, and the answer changes the catalog-state count in Example 2's
row 10.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | ≥ 20.19.0 declared; CI pins 24 | — |
| npm | `npm run check` | ✓ | — | — |
| `pre-commit` | commit gate | ✓ (config present) | — | Repo has **no** installed pre-commit hook (hooks dir has only `post-*`/`pre-push`), so run `pre-commit run --all-files` manually before pushing; CI runs `--all-files` |
| Network | — | not needed | — | Every path this phase touches is offline by contract (NFR-5) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), TypeScript run natively by Node (no build step) |
| Config file | none — glob-driven from `package.json` scripts |
| Quick run | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` |
| Full gate | `npm run check` = `typecheck && lint && lint:workflows && lint:workflows:negative && fallow && format:check && test:corresponding && test:corresponding:negative && test:coverage:direct:negative && test && test:integration` |

**Two gates the planner must budget for that are easy to miss:**

1. **`npm run test:corresponding`** — every production `.ts` under
   `extensions/pi-claude-marketplace/` must have a paired
   `tests/<same-relative-path>.test.ts`. A new module without one fails
   `npm run check`.
2. **Direct coverage.** `scripts/test-coverage-direct.mjs` requires each
   production module to reach **100% branch and line** coverage *from its own
   paired test file* (not from the suite as a whole). The exception pin
   `scripts/test-coverage-direct.pin.json` currently holds exactly **3 rows**
   (`bridges/agents/convert.ts`, `bridges/commands/discover.ts`, and one more),
   each with a named finding id and a written justification. This runs as its
   own CI job (`ci.yml:213`, `npm run test:coverage:direct:all`), *not* inside
   `npm run check` — so a local green `check` does not prove this gate passes.

### Phase requirements → test map

| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| LOAD-01 | A recorded dependency that is absent / disabled / out-of-range yields the right `kind` verdict | unit | `node --test tests/orchestrators/reconcile/dependency-verdict.test.ts` | ❌ Wave 0 |
| LOAD-01 | The verdict becomes the new plan bucket | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ (901 lines) |
| LOAD-01 | The row renders with the token + cause line | unit (byte) | `node --test tests/orchestrators/reconcile/notify.test.ts` | ✅ (2106 lines) |
| LOAD-01 | The catalog byte-contract holds | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ |
| LOAD-02 | Second pass over an unchanged unsatisfied tree produces `emptyReconcilePlan` | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ |
| LOAD-02 | Apply → re-plan → apply does not oscillate | integration | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ |
| LOAD-02 | The lift: satisfying the dependency re-enables the dependent and clears the marker | unit + integration | `plan.test.ts` + `apply.test.ts` | ✅ |
| LOAD-02 | D-06-05 fixpoint propagates down a 3-deep chain in one pass | unit | `apply.test.ts` (or the verdict module's own suite) | ✅ / ❌ |
| LOAD-03 | `uninstall` proceeds and the row names the dependents | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ (5888 lines; 6 existing refusal cases must be rewritten or deleted) |
| LOAD-03 | The unreadable-declarer refusal still refuses (D-05-07 survives) | unit | `uninstall.test.ts` | ✅ |
| LOAD-03 | `--prune` semantics unchanged | unit | `uninstall.test.ts` | ✅ |
| D-06-01 | The schema accepts the field; a legacy record without it loads | unit | `node --test tests/persistence/state-io.test.ts` | ✅ |
| D-06-01 | The record key-set pin includes the field | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ |
| Closed set | Length + both enumerations agree | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts` | ✅ |
| Purity | `plan.ts` still imports nothing effectful | architecture | `node --test tests/architecture/reconcile-planner-purity.test.ts` | ✅ |
| NFR-5 | The verdict module names no git surface | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ (add the new file to `NETWORK_FREE_TARGETS` if it lands outside `dependency-index.ts`) |

### Sampling rate

- **Per task commit:** `node --test "tests/orchestrators/reconcile/**/*.test.ts" "tests/orchestrators/plugin/uninstall*.test.ts" "tests/architecture/**/*.test.ts"`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green **plus** `npm run test:coverage:direct:all`
  (the CI-only gate), plus `pre-commit run --all-files`

### Wave 0 gaps

- [ ] `tests/orchestrators/reconcile/dependency-verdict.test.ts` — pairs the new
      module; required by `test:corresponding` before the module can land green
- [ ] Any additional new production module needs its pair in the same commit
- [ ] Fixture additions in `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts`
      and `…/plugin-uninstall.ts` for each new catalog-state
- [ ] No framework install needed

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated
as enabled.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this tree |
|---------------|---------|-------------------------------|
| V2 Authentication | no | This phase touches no credential path (`platform/git-credential.ts` is untouched) |
| V3 Session management | no | — |
| V4 Access control | yes (filesystem) | `shared/path-safety.ts::assertPathInside` + the branded `ScopedLocations` bundle; every path this phase reads comes from a `ScopedLocations` getter or from an already-validated `marketplaceRoot` |
| V5 Input validation | yes | `typebox` `PLUGIN_INSTALL_RECORD_SCHEMA` validates the new field on both load and save (`saveState` re-checks before writing, `state-io.ts:502-507`); `domain/dependencies.ts`'s `TOKEN_PATTERN` and the 64-char version bound already validate every declaration element |
| V6 Cryptography | no | — |
| V7 Error handling & logging | yes | `redactAbsolutePaths` / `redactCauseChain` — see the threat table |

### Known threat patterns for this change

| Pattern | STRIDE | Standard mitigation in this tree |
|---------|--------|----------------------------------|
| Absolute path leaked through the new cause line | Information disclosure (NFR-9 / T-55-02-02) | `dependency-index.ts`'s failure arm already builds its message with `redactAbsolutePaths(errorMessage(err))` and deliberately chains no `{ cause }` so the renderer's chain-walk cannot print the raw message (:38-42, :122-128). The new verdict's cause line must follow the same construction |
| A hostile plugin name in the remedy sentence injecting newlines or ANSI | Tampering (output spoofing) | `domain/dependencies.ts::TOKEN_PATTERN` = `/^[A-Za-z0-9][-A-Za-z0-9._]{0,255}$/` — "admits no control, bidi, ANSI, whitespace or quote character, and no `@`" (:43-47). The keys the remedy interpolates are built from names that passed it |
| An unbounded range flooding a notification row | Denial of service (rendering) | `renderConstraintRange` caps at 200 chars with an explicit `... (+N chars)` marker (`dependency-range.ts:276-283`) |
| A pathological set of declared ranges | Denial of service (CPU) | `intersectDependencyRanges`' two project-owned caps, both checked *before* the work they bound (`dependency-range.ts:28, 37, 82-97, 147-165`) |
| A damaged manifest read as "declares nothing", silently un-disabling a dependent | Tampering (fail-open) | D-05-07's fail-closed posture. The verdict builder must inherit it: an unreadable declarer is a typed failure arm, never an empty declaration set. `refuseUnusableOwnManifest: true` is the flag that selects it (`dependency-index.ts:154-163`) |
| The marker used as a durable claim about *why* | (design) | D-06-01 forecloses this: the field is a boolean meaning "currently held down", re-derived live each pass. A plan that grows it into a reason enum re-opens a trust-the-cache hazard |
| Writing the consequence-disable back to `claude-plugins.json` | Integrity (user intent) | D-04-02 / LOAD-02 — the config carries only what the user asked for. Explicitly do not write back |

No new network path, no new subprocess, no new secret handling, no new
filesystem write location. The one new persisted field is a boolean validated
by the existing schema on both read and write.

## Sources

### Primary (HIGH confidence — read from the working tree this session)

- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (646 lines, read in full)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (1059 lines; :1-370, :560-1059)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` (:115-312)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` (:782-911)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` (:244-270)
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` (200 lines, read in full)
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts` (:64-133, :273-287)
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` (:1-320, :873-914, :1000-1268)
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` (139 lines, read in full)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` (:316-390)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` (:940-1010)
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts` (:110-160)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts` (:20-50)
- `extensions/pi-claude-marketplace/domain/dependency-range.ts` (283 lines, read in full)
- `extensions/pi-claude-marketplace/domain/dependencies.ts` (:35-55)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (511 lines, read in full)
- `extensions/pi-claude-marketplace/shared/notification-types.ts` (:1-135, :287-420)
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` (:780-840, :1040-1140, :1560-1638)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (:1-80, :295-320)
- `extensions/pi-claude-marketplace/index.ts` (184 lines, read in full)
- `tests/architecture/reconcile-planner-purity.test.ts` (75 lines, read in full)
- `tests/architecture/compat-01-no-expansion.test.ts` (605 lines, read in full)
- `tests/architecture/notify-closed-set-locks.test.ts` (read in full)
- `tests/architecture/disabled-state-classification.test.ts` (:1-210)
- `tests/architecture/gate-targets.ts` (:38-145, :368-382, :460-475)
- `tests/architecture/catalog-uat/catalog-parser.test.ts` (:70-80)
- `docs/output-catalog.md` (:40-110, :1003-1180, :2715-2760)
- `docs/dependency-resolution.md` (:125-165)
- `docs/plugin-enablement.md` (68 lines, read in full)
- `docs/messaging-style-guide.md` (:7-10, :83-92, :145, :168)
- `scripts/test-coverage-direct.mjs` + `scripts/test-coverage-direct.pin.json`
- `package.json` scripts, `.github/workflows/ci.yml`
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/BACKLOG.md:3011-3022`,
  `.planning/config.json`, `.planning/phases/06-…/06-CONTEXT.md`

### Secondary (MEDIUM confidence)

- `.planning/HANDOFF-upstream-dependency-parity.md:54-55, 107-109` — the upstream
  parity table and the transcribed error codes/messages. A repo document
  reporting a prior session's binary grep, not the binary itself. See A1.

### Tertiary (LOW confidence)

- `https://code.claude.com/docs/en/plugin-dependencies` — cited by CONTEXT.md as
  the upstream contract; **not fetched this session**. The remedy strings in A1
  come from the HANDOFF's binary transcription, not from this page.

## Metadata

**Confidence breakdown:**

- In-repo code shape (signatures, line numbers, gate contents): **HIGH** —
  every citation was opened with `Read` or a line-numbered `grep` in this
  session; CONTEXT.md's line numbers for `classifyDeclaredPlugin` (414-504),
  its enable push (499), `buildUninstallBucket` (515), `applyPluginToggles`
  (667), and `buildScopeDeclarationIndex`'s call site (252/1043) all still
  match.
- Amendment checklist completeness: **HIGH** — derived by grepping the two
  tokens Phase 5 added (`dependents remain`, `dependency pruned`) across
  `extensions/ tests/ docs/` and reading each gate that matched.
- Architecture recommendations (Pattern 1/2, Open Question 2's Option A):
  **MEDIUM** — sound against the constraints found, but they are proposals; the
  planner may reach a different split.
- Upstream remedy wording: **LOW** — see A1; confirm before freezing catalog
  bytes.

**Research date:** 2026-09-18
**Valid until:** ~7 days — this is a fast-moving tree; re-verify line numbers if
planning slips past a merge from `main`.

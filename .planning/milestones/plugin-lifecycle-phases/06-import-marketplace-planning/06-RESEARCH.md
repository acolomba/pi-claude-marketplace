# Phase 6: Import Marketplace Planning - Research

**Researched:** 2026-10-26
**Domain:** `/claude:plugin import` marketplace planning, plus partial-rollback reporting on `import` and `apply` (TypeScript orchestrators and cucumber scenarios)
**Confidence:** HIGH for the code paths, which were read this session. MEDIUM for the exact scenario cell text, which no scenario has run yet.

## Summary

This phase is all in-repo work. Nothing new is installed, and no network or upstream lookup is needed: CONTEXT.md already holds the Claude Code 2.1.310 evidence. Every change sits in code read this session. Four findings shape the plan more than the rest:

1. **MIM-01 needs the planner's claim map. `ReconcilePlan` does not expose it.** `buildMarketplaceClaims` builds `recordedByDeclared` (settings name to recorded name), but it is module-private in `orchestrators/reconcile/plan.ts`, and `planReconcile` returns only the buckets. Import cannot get the recorded name of a unique claim from the plan. Export a thin pure wrapper from `plan.ts`, and call it in `readPassForImport` beside `planReconcile`. Do not copy the rule into import. **Today a conflict on a settings name the scope does not record is never reached.** `ensurePlannedMarketplaces` checks "not recorded under this name" first and adds, so the conflict mismatch is ignored. Move the mismatch check first.
2. **MIM-03 for the enable path needs `enable-disable.ts` (a Phase 1 file).** CONTEXT.md assumes the orchestrated enable outcome carries `rollbackPartials`. It does not. The internal `SetEnabledOutcome` "enable-failed" arm has them, but `outcomeToTypedResult` drops them, and the exported `EnableDisablePluginOutcome` failed arm does not declare the field. A small additive edit to that type and one arm of `outcomeToTypedResult` is required.
3. **MIM-03 for `apply` touches `apply-outcomes.ts` (a Phase 1 file), and a test pins the narrow `cause` type.** `test/orchestrators/reconcile/apply-outcomes.test.ts:363` has `// @ts-expect-error install failure causes are DependencyCascadeError, not a bare Error`. When `cause` widens to `Error`, that directive becomes unused and `npm run typecheck` fails. The plan must change the test in the same task.
4. **The cucumber harness cannot yet compare a non-empty `rollback partial` cell across Node majors.** `features/lib/field-rows.ts` JSON-stringifies arrays of objects and does not project run tokens into them. Import and apply redact causes to the last path segment. Node 26 (local) puts the path into `EISDIR`/`EACCES` messages, and Node 24 (CI) does not. So `{mcp-adapter.json read error}` does not match a redacted row on Node 26. Both fixes go in `features/lib/` (see Pitfalls 1 and 2). They are foundation files.

**Primary recommendation:** Wave 1 has three plans with no shared files: (a) the cucumber fixture and token-projection foundation, (b) the producer changes (`install-flow.ts::handleCascadeThrow` and `enable-disable.ts::outcomeToTypedResult`), (c) the pure planning functions (`import/marketplaces.ts` and a new `plan.ts` claim export). Wave 2 holds the consumers: `import/execute.ts` (MIM-01, -02, -03, -04), then the apply side (`apply-outcomes.ts`, `apply.ts`, `reconcile/notify.ts`), each with its feature scenarios. The work in `execute.ts` is sequential because all of it lands in one file.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Marketplace planning

- **D-PL6-01 (MIM-02):** Import plans every `extraKnownMarketplaces` entry of a scope's merged settings, whether an enabled plugin names it or not, as Claude Code's reconciler does (E1). The enabled plugins' marketplaces come first, in settings order, then the remaining entries in settings order. An unreferenced entry with no supported source gets the same `unmappable-marketplace-source` diagnostic a referenced one gets. The official marketplace is still planned only when an enabled plugin names it (E1: `sourceIsFallback`). An added unreferenced marketplace is declared in `claude-plugins.json` by the post-pass, as any added marketplace is. An unreferenced entry is now enough for a scope to take its lock.
- **D-PL6-02 (MIM-01), supersedes lifecycle-coverage D-07 (phase 19):** When the scope records a settings marketplace's source under exactly one other name, and the settings do not declare that name themselves, import follows the reconcile planner's one-to-one source claim (Key Decision "Reconcile aliases through one-to-one source claims while preserving the manifest-derived canonical state name"). It adds nothing, reports the recorded marketplace `(skipped) {already added}` under its recorded name, and installs or enables each `p@<settings name>` as `p@<recorded name>`. The post-pass declares the recorded name, with the settings source, when the config lacks it, and declares the plugins under the recorded name. Claude Code's add also finds the source recorded under the other name and reuses it without error (E2). D-07 refused to follow the claim because the old post-pass declared `p@<recorded>` while the config declared only the settings name, so the next load uninstalled the plugin. Declaring both under the recorded name is the config the planner reads as steady state. A conflicted claim (two recorded candidates, or two declarations for one record) is the planner's source mismatch and blocks its plugins as `{source mismatch}`, as before. The same source recorded under the settings' own name is unchanged (`(skipped) {already added}`).

#### Rollback reporting

- **D-PL6-03 (MIM-03):** Import's failed row for a plugin whose own install or enable rolled back partially carries install's per-phase child rows (`[<phase>] (rollback failed)` and the phase's cause line), built from the outcome's `rollbackPartials`, not from a boolean. The row's brace stays `{rollback partial}`.
- **D-PL6-04 (MIM-03):** A dependency's partial rollback is reported as `install` reports it: the failing dependency's `(failed) {rollback partial}` row, named by its `plugin@marketplace` key, with the cause and the per-phase rows, beside the requested plugin's bare `(failed) {dependency failed}` row. To make that possible, the orchestrated install outcome of a cascade member failure carries that member's rollback partials (`orchestrators/plugin/install-flow.ts::handleCascadeThrow`), as the single-plugin failure outcome already does (REC-06). Import puts both rows under the requested plugin's marketplace block, as `install` does. A dependency failure with no partial keeps today's rows.
- **D-PL6-05 (MIM-03):** `apply`'s failed-install row (`applyPluginInstalls` only) reads `(failed) {rollback partial}` with the per-phase rows and the redacted install error as its cause when the failed install left rollback partials. For a dependency's partial, `apply` adds the dependency's own failed-install row, under the dependency's own marketplace and by its bare name (apply's convention for dependency rows), with `{rollback partial}`, the per-phase rows, and the redacted cause, and the requested plugin's row keeps `{dependency failed}` without the cause, as `install`'s does. `PluginInstallFailedOutcome` gains an optional `rollbackPartials`, its `cause` widens to `Error`, and the reconcile row projection threads `rollbackPartial` onto the failed row.

#### Outcome shape

- **D-PL6-06 (MIM-04):** The import enable outcome keeps the staged-kind facts only in the required `declaresAgents`, `declaresMcp`, and `declaresWorkflows`. `enableSignals` narrows to the degradation facts (`unsupported`, `orphanRewake`, `degradedKinds`), and `installedRow` rebuilds the enable row's `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows` inputs from the `declares*` fields. The rendered rows do not change.

#### Behavioral tests

- **D-PL6-07:** The partial-rollback scenarios use a real undo failure. A plugin ships a skill with a read-only directory inside it, and a directory blocks the scope's `mcp-adapter.json`. The mcp phase fails, and the skills undo cannot delete the copied read-only directory (`fs.cp` keeps the 0555 mode, and `rm` then fails with EACCES for a non-root user; verified with Node on 2026-10-26). The fixture step makes the scenario's release step restore write permission before cleanup. The scenarios cannot run as root, and CI runs as a non-root user.

### Claude's Discretion

- Helper and type names, and how the alias is threaded through the scope plan in `execute.ts`.
- Unit test layout inside the existing owner test files.

### Deferred Ideas (OUT OF SCOPE)

- The MISS-01 missing-dependency failed row in `apply` (`applyDependencyInstalls`) does not show rollback partials: `InstallMissingDependencyOutcome`'s failed arm does not declare the field (LCCODE-01, Phase 11).
- `apply`'s enable rows and the update and reinstall rows in `apply` do not show rollback partials either; not part of MIM-03's failed-install row.

Also out of scope (CONTEXT.md phase boundary): the other LCORCH-01 items, `apply`'s enable rows, CLOSUREROW-01 (Phase 3), and anything in `apply.ts` other than the failed-install row of `applyPluginInstalls` (Phases 2 and 7).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIM-01 | `import` handles a settings marketplace whose source the scope records under another name as Claude Code does (IMPNAME-01) | Export the claim map from `plan.ts` (Pattern 1). Alias the scope plan after the read pass (Pattern 2). Reorder `ensurePlannedMarketplaces` (Pattern 3). Replace the D-07 test `execute.test.ts:4840`. Scenario 2. |
| MIM-02 | `import` adds the `extraKnownMarketplaces` entries Claude Code adds, referenced or not (IMPEXTRA-01) | A second pass in `planMarketplaceSourcesForRefs` (Pattern 4). New cases in `marketplaces.test.ts` and `execute.test.ts`. Scenario 1. |
| MIM-03 | `import` and `apply` report a partial rollback with the detail `install` shows (LCORCH-01 b2) | `handleCascadeThrow` carries partials (Pattern 5). `outcomeToTypedResult` carries enable partials (Pattern 6). Import row builder (Pattern 7). Apply failure arm and projection (Pattern 8). Fixture (Pattern 9). Scenarios 3, 4, 5. |
| MIM-04 | The import enable outcome carries the companion facts once (LCCODE-01 b7) | Narrow `enableSignals` and rebuild the staged inputs in `installedRow` (Pattern 10). Update `execute.test.ts:4737`. |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

CLAUDE.md is absent. AGENTS.md is the project file. The directives that matter here:

- Never commit to `main`. Merge, never rebase. Commit as `.agents/skills/committing/SKILL.md` describes, and never use `--no-verify`. [VERIFIED: AGENTS.md]
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario under `features/` that fails without the change. Unit tests and direct coverage do not replace it. [VERIFIED: AGENTS.md "Behavioral tests"]
- GSD gates run `npm run check` on the combined tree. A passing pre-commit hook (`check:commit`) is not a gate verdict, and `check:commit` does not run cucumber. [VERIFIED: AGENTS.md "Build verification"; `.agents/skills/local-verification/rules/commands.md`]
- Every plan `SUMMARY.md` includes `## Threat Flags`. Prefix `gsd-tools windows append --description` with `[plugin-lifecycle]`. [VERIFIED: AGENTS.md "GSD records"]
- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap. [VERIFIED: AGENTS.md "Constraints"]
- Output goes only through `shared/notification-dispatch.ts` (`notify`, `notifyWithContext`). No direct `ctx.ui.notify`, `console.*`, or stdio in the extension. [VERIFIED: AGENTS.md; `.planning/codebase/CONVENTIONS.md`]
- `npm run check` must stay green, including 100% direct coverage per source-test pair. A new branch in `X.ts` must be covered by `test/.../X.test.ts` alone. [VERIFIED: STACK.md; local-verification commands.md]
- There are two independent cognitive-complexity ceilings: ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15` / `maxCyclomatic: 20`. Extract helpers rather than grow `applyPluginInstalls` or `dispatchFailedOutcome`. [VERIFIED: CONVENTIONS.md]
- Comments cite durable IDs (`MIM-03`, `D-PL6-04`), not phase or plan numbers. Default to no comment on trivial code. [VERIFIED: CONVENTIONS.md; MEMORY "Source comment cleanup policy", "No comments on trivial code"]
- TypeScript strict: `exactOptionalPropertyTypes` (use conditional spreads), `noUncheckedIndexedAccess`, explicit return types on exports, and no `!` or `as` in `extensions/`. [VERIFIED: STACK.md; MEMORY "Compiler-forced unreachable branches"]
- Cucumber rules: steps are lower case and use only Given/When/Then; a table lists every row; steps never name temp paths or modules; a Given that sets up asserts it succeeded; every resource has an `onRelease`; library code goes under `features/lib/`; step modules are named by vertical function. [VERIFIED: `.agents/skills/cucumber/rules/{features,steps,layout}.md`]
- Unit-test subagents must use a hermetic home. [VERIFIED: MEMORY "Subagent tests must use hermetic home"]

## Architectural Responsibility Map

This is a Pi extension, so the "tiers" are the extension's layers (ARCHITECTURE.md).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Which settings marketplaces to plan (MIM-02) | `orchestrators/import/marketplaces.ts` (pure planning) | — | Already owns `planMarketplaceSourcesForRefs`. It is pure, with no I/O. |
| Settings-name to recorded-name claim (MIM-01) | `orchestrators/reconcile/plan.ts` (pure planner) | `orchestrators/import/execute.ts` (consumer) | The claim rule must be the planner's own (D-PL6-02), so it is exported, not copied. |
| Running adds, installs, and enables per alias | `orchestrators/import/execute.ts` | — | Owns the read pass, the buckets, and the post-pass config write. |
| Carrying a dependency member's partials | `orchestrators/plugin/install-flow.ts::handleCascadeThrow` | — | The orchestrated outcome producer (D-PL6-04). |
| Carrying an enable's partials | `orchestrators/plugin/enable-disable.ts::outcomeToTypedResult` | — | The orchestrated enable outcome producer. The field is not carried today. |
| Import failed rows with per-phase children | `orchestrators/import/execute.ts` (row builder) | `shared/notification-grammar.ts` (renders, unchanged) | Import owns its rows. The grammar already renders `rollbackPartial`. |
| Apply failed-install rows | `orchestrators/reconcile/apply.ts` (outcomes) | `apply-outcomes.ts` (type), `reconcile/notify.ts` (projection) | Apply pushes outcomes, and notify projects them to rows. |
| Redaction of causes and phase causes | Consumer (`execute.ts`, `apply.ts`) via `shared/redact-absolute-paths.ts` | — | T-55-02-02: reconcile and import rows never leak absolute paths. |
| Behavioral proof | `features/plugin/{import,apply}.feature` | `features/lib/*`, `features/step_definitions/*` | AGENTS.md requires a failing-first scenario. |

## Standard Stack

No new libraries. Everything uses what the repo already has. [VERIFIED: package.json scripts read this session]

### Core (existing, used as-is)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` + `node:assert/strict` | Node built-in | Owner unit tests | Project rule: no other runner or assertion library (typescript-unit-tests SKILL) |
| `strong-mock` | repo devDep | Strict mocks where a case needs them | Project rule |
| `@cucumber/cucumber` | repo devDep | Behavioral scenarios (`npm run test:cucumber` = `cucumber-js`) | AGENTS.md behavioral-test rule |
| `typebox` | `^1.1.38` | (unchanged) | — |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed in this phase. The audit does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Claude settings (base + local, per scope)
        │  loadMergedClaudeSettingsForScope (settings.ts)
        ▼
buildClaudeImportPlan (marketplaces.ts)
  ├─ refs → referenced marketplaces (settings order)        [today]
  └─ remaining extraKnownMarketplaces keys (settings order)  [MIM-02 new]
        │  ScopedClaudeImportPlan { marketplacesToEnsure, pluginsToInstall, skippedPlugins, diagnostics }
        ▼
executeScopedPlan (execute.ts)
  │  readPassForImport ── lock ── planReconcile(desiredConfigFor(plan), state, scope, verdict)
  │                              + claims = marketplaceSourceClaims(desired.marketplaces, state.marketplaces) [MIM-01 new]
  ▼
alias the scope plan: settings name → recorded name for unique claims [MIM-01 new]
  ▼
ensurePlannedMarketplaces: mismatch? → block │ recorded? → skip │ else → addMarketplace  [order fixed]
  ▼
applyPlannedPlugins: not recorded/dependency → installPlugin │ in plan.pluginsToEnable → setPluginEnabled │ else skip
  │                       │                                       │
  │       InstallPluginOutcome (failed: error, cause, rollbackPartials?)   EnableDisablePluginOutcome (failed: +rollbackPartials? [new])
  │            ▲ handleCascadeThrow now carries member partials [new]
  ▼
dispatchFailedOutcome → UnexpectedPluginFailureOutcome (+ redacted rollbackPartial, + failed dependency) [MIM-03 new]
  ▼
writeBatchedConfigForScope (post-pass, recorded names) → claude-plugins.json
  ▼
buildImportNotificationMarketplaces → rows (installedRow: enableSignals narrowed [MIM-04]) → notifyWithContext → grammar (unchanged)

apply: applyPluginInstalls → InstallPluginOutcome failed
   → PluginInstallFailedOutcome {reason, cause: Error, rollbackPartials?} (root, and the dependency's own row) [new]
   → reconcile/notify.ts applyPluginOutcomeToBlock failed arm → PluginFailedMessage.rollbackPartial [new]
```

### Component Responsibilities (files each change touches)

| File (under `extensions/pi-claude-marketplace/` unless noted) | Change | Requirement |
|---|---|---|
| `orchestrators/import/marketplaces.ts` | Second pass over the unreferenced `extraKnownMarketplaces` keys | MIM-02 |
| `orchestrators/reconcile/plan.ts` | New pure export that returns the claim map (`recordedByDeclared`) | MIM-01 |
| `orchestrators/import/execute.ts` | Claims in the read pass, the aliased plan, the `ensurePlannedMarketplaces` order, partials in the failure dispatch and row builder, narrowed `enableSignals` | MIM-01, -02 (lock comment only), -03, -04 |
| `orchestrators/plugin/install-flow.ts` | `handleCascadeThrow` orchestrated return gets `rollbackPartials` | MIM-03 |
| `orchestrators/plugin/enable-disable.ts` | `EnableDisablePluginOutcome` failed arm declares `rollbackPartials?`, and the `outcomeToTypedResult` "enable-failed" arm carries it | MIM-03 |
| `orchestrators/reconcile/apply-outcomes.ts` | `PluginInstallFailedOutcome.cause: Error`, plus `rollbackPartials?` | MIM-03 |
| `orchestrators/reconcile/apply.ts` | The `applyPluginInstalls` failure arm only (extract a helper) | MIM-03 |
| `orchestrators/reconcile/notify.ts` | Failed-row projection threads `rollbackPartial` | MIM-03 |
| `shared/notification-grammar.ts` | **No change**: `composeFailureLines` already renders the per-phase rows | — |
| `features/lib/published-marketplace.ts`, a step module, `features/lib/run-tokens.ts` and/or `field-rows.ts` | Read-only skill directory fixture, release, and token projection | MIM-03 (D-PL6-07) |
| `features/plugin/import.feature`, `features/plugin/apply.feature` | Scenarios 1 to 5 | all |

### Pattern 1: Export the planner's claim map (MIM-01)

**What:** `buildMarketplaceClaims` is the single source of the claim rule. It is private today. [VERIFIED: `orchestrators/reconcile/plan.ts:134-151, 153-186, 201-220, 223-248`]

The rule, quoted:

```ts
// plan.ts:134-151 recordedSourceCandidates
for (const [name, record] of Object.entries(recorded)) {
  if (ownValue(declared, name) !== undefined) {
    continue;
  }

  if (samePlannedSource(record.source, declaredSource) === "same") {
    candidates.push(name);
  }
}
// plan.ts:160-163 collectMarketplaceClaim: a declaration recorded under its own name claims itself
if (ownValue(recorded, declaredMarketplace) !== undefined) {
  acc.recordedByDeclared.set(declaredMarketplace, declaredMarketplace);
  return;
}
// plan.ts:166-170: more than one candidate → conflict "ambiguous recorded marketplaces: a, b"
// plan.ts:211-217: two declarations for one candidate → conflict "recorded marketplace claimed by multiple declarations: X"
```

Conflicts become `PlannedSourceMismatch { cause: "source-mismatch", marketplace: <declared name>, ... }` (`plan.ts:345-353`). A unique claim plans no add (`plan.ts:304-306`). Plugin buckets are already keyed by the recorded name: `const marketplace = marketplaceDiff.recordedByDeclared.get(declaredMarketplace) ?? declaredMarketplace;` (`plan.ts:484-486`). [VERIFIED: plan.ts read this session]

**Recommendation:** Add one pure export to `plan.ts`. The name is at the executor's discretion, for example:

```ts
/** D-PL6-02: the recorded marketplace each declared marketplace claims by name or by a one-to-one source match. */
export function marketplaceSourceClaims(
  declared: MergedConfig["marketplaces"],
  recorded: ExtensionState["marketplaces"],
): ReadonlyMap<string, string> {
  return buildMarketplaceClaims(declared, recorded).recordedByDeclared;
}
```

Cover the new export in `test/orchestrators/reconcile/plan.test.ts`, which already has claim cases at lines 217, 247, and 282, for direct coverage. Do not add the map to `ReconcilePlan`: `emptyReconcilePlan` and many `deepStrictEqual` plan assertions would change. `plan.ts` is outside every other wave-1 phase's file list (ROADMAP Phases 1-5 and 7). [VERIFIED: ROADMAP.md read this session]

### Pattern 2: Alias the scope plan after the read pass (MIM-01)

**Today** [VERIFIED: `execute.ts:1340-1382`] `readPassForImport` returns `{ kind: "planned", state, plan }`. Extend the planned arm with `claims` (only the entries where the declared name differs from the recorded name), computed inside the same lock from `desiredConfigFor(scopePlan).marketplaces` and `tx.state.marketplaces`.

Then, in `executeScopedPlan` after the `lock-held` branch (`execute.ts:1522-1541`), build an aliased `ScopedImportPlan` and pass it to `ensurePlannedMarketplaces`, `applyPlannedPlugins`, and `writeBatchedConfigForScope`:

- `marketplacesToEnsure`: rename `marketplace` to the recorded name. Keep `source`, the settings source. `buildBatchedPatchForScope`'s `rawSourceByName` (`execute.ts:1709-1712`) then maps recorded name to settings source, so the repair patch (`execute.ts:1755-1773`) declares `<recorded>: { source: <settings source> }` when the config lacks it. That is D-PL6-02's post-pass.
- `pluginsToInstall[].ref.marketplace`: rename to the recorded name. All outcomes (`plugin.ref.marketplace`), rows (`pushMarketplaceRow` keyed `scope:marketplace`), `pluginsForMarketplace`, the `usable` set, the `read.state` record lookup (`execute.ts:1476-1479`), the `enableKeys` match (`execute.ts:1468-1470`, which is already built from `plan.pluginsToEnable`, keyed by the recorded name), `buildBatchedPatchForScope` plugin keys, and `stampReenabledWhereLocalDeclares` keys then see the recorded name with no further change.
- `ref.raw` (what `refLabel` returns, and what outcomes' `ref` field and diagnostics carry) is a discretion point. Keeping the settings text (`demo@other`) tells the user what they wrote. Rewriting it to `demo@fixtures` keeps the `ref`/`marketplace` pair consistent and matches the existing test helpers (`installed()` builds `ref: \`${plugin}@${marketplace}\``, `execute.test.ts:397-420`). Recommendation: rewrite `raw` too, so every outcome names one plugin key. [ASSUMED: design preference]

Why aliasing is safe: only uniquely claimed names are renamed. A uniquely claimed name never has a planner mismatch, and conflicted names are not in `recordedByDeclared`. The recorded target is never itself a settings name, because declared names are excluded from the candidates, so a renamed entry cannot collide with another entry.

### Pattern 3: Fix the `ensurePlannedMarketplaces` order (MIM-01)

**Today** [VERIFIED: `execute.ts:1417-1446`]:

```ts
const mismatch = plannedMismatchFor(read.plan, marketplace.marketplace);
if (ownValue(read.state.marketplaces, marketplace.marketplace) === undefined) {
  await addOnePlannedMarketplace(...);           // reached first for an unrecorded settings name
} else if (mismatch !== undefined) {
  recordPlannedMismatch(...);
} else {
  result.skippedExistingMarketplaces.push({ ... reason: "already-present" });
}
```

A conflict mismatch is keyed by an *unrecorded* settings name, so the add branch runs first and the conflict is **never reached today**. A dir or github add of an already-recorded source then fails orchestrated as a duplicate name. That is today's D-07 test, `execute.test.ts:4840-4884`, which expects `addCalls: ["project ./mp"]` and an `addFailed` result. [VERIFIED: read this session]

**New order:** (1) a planner mismatch blocks (`recordPlannedMismatch`), (2) recorded under the (aliased) name, which is a skip, (3) otherwise add. For recorded names this order behaves the same as today: a name recorded under itself claims itself, so it can only carry a samePlannedSource `different` or `unknown-stored` mismatch, and that is still checked before the skip.

Rewrite the D-07 test: no `addMarketplace` call (the `collaborators()` bundle rejects unpromised calls, `execute.test.ts:349-362`), `skippedExistingMarketplaces: [skipped("recorded-mp", "project")]`, and an install of `plugin@recorded-mp`. Add a conflicted-claim test with two recorded marketplaces of the same source. It expects `sourceMismatches` and no add call, and it fails today.

### Pattern 4: Plan unreferenced `extraKnownMarketplaces` entries (MIM-02)

**Today** [VERIFIED: `marketplaces.ts:98-130`]:

```ts
for (const ref of refs) {
  if (seen.has(ref.marketplace)) { continue; }
  seen.add(ref.marketplace);
  const source =
    ref.marketplace === OFFICIAL_CLAUDE_MARKETPLACE
      ? OFFICIAL_CLAUDE_MARKETPLACE_SOURCE
      : marketplaceSourceFromExtra(extraKnownMarketplaces[ref.marketplace]);
  if (source === undefined) { unmappableMarketplaces.push(...); diagnostics.push(unmappableMarketplaceDiagnostic(scope, ref.marketplace)); continue; }
  marketplacesToEnsure.push({ scope, marketplace: ref.marketplace, source });
}
```

**Add:** after the loop, walk `Object.keys(extraKnownMarketplaces)` in order and skip the names in `seen`. For each remaining name, use `marketplaceSourceFromExtra`. An unmappable name gets the same diagnostic and an entry in `unmappableMarketplaces` (it has no plugins to skip). A mappable name is pushed. Settings order is the `mergeClaudeSettings` spread order: base keys, then local-only keys (`settings.ts:283-297`). Keep each function under the complexity ceilings: a second small helper, or a shared `planOne(name, source)` closure.

Effects downstream, all automatic:
- `desiredConfigFor` (`execute.ts:1320-1338`) declares the unreferenced marketplace, so the planner adds, skips, or mismatches it.
- `executeScopedPlan`'s early return (`execute.ts:1504-1507`) now sees a non-empty `marketplacesToEnsure`, so the scope takes its lock (D-PL6-01).
- The lock-held arm (`execute.ts:1522-1539`) fails every planned marketplace, unreferenced ones included.
- The post-pass declares an added unreferenced marketplace through `addedMarketplaces`.
- An unmappable unreferenced entry now produces a diagnostic, so `surfaceImportDiagnostics` emits a second notification (`execute.ts:1987-2002`).

Update the `MarketplaceBlock` WR-04 comment (`execute.ts:464-473`). It says `scopedPlan` derives `pluginsToInstall` and `marketplacesToEnsure` "from the same `refs` set", which is no longer true. The invariant that matters, plugin rows ⊆ headers, still holds.

Existing tests: every `extraKnownMarketplaces` key in `marketplaces.test.ts`, `execute.test.ts`, `test/integration/reserved-record-keys.test.ts`, and `features/plugin/import.feature` is referenced by an enabled plugin (spot-checked all `features/` cases and the multi-marketplace unit cases). Few or no expectations should change. Run the owner tests to confirm. [VERIFIED: grep this session; partial manual check]

### Pattern 5: Carry a dependency member's partials (MIM-03, D-PL6-04)

[VERIFIED: `install-flow.ts:1088-1128` `unwrapCascade`, `1742-1769` `handleCaughtInstallFailure`, `1781-1821` `handleCascadeThrow`]

```ts
// unwrapCascade, member-failed arm (1112-1125)
capture.rollbackPartials = [...capture.rollbackPartials, ...cascade.rollbackPartials];
if (cascade.key !== rootKey) {
  sink.subject = { kind: "member", key: cascade.key, error: cascade.error, rollbackPartials: capture.rollbackPartials };
}
// handleCascadeThrow (1797-1801) — orchestrated return drops the partials
const error = cascadeFailureCause(subject, rootKey);
const cause = formatOrchestratedCause(error);
if (orchestrated) {
  return { status: "failed", error, cause, ...movedMember(args.moved) };
}
```

**Change:** add `...(subject.kind === "member" && subject.rollbackPartials.length > 0 && { rollbackPartials: subject.rollbackPartials })` to the orchestrated return. Mirror it on the standalone return at line 1820 if that is wanted, though the standalone outcome is discarded. Only `handleCascadeThrow` changes. Phase 4 owns the "planning and missing-dependency functions" of `install-flow.ts`, which is a different function.

Readers of the orchestrated `InstallPluginOutcome` failed arm: only `import/execute.ts` (`installOnePlannedPlugin`) and `reconcile/apply.ts` (`applyPluginInstalls`) call `createInstallOperation` [VERIFIED: grep]. `installMissingDependencyWithTransaction` spreads the failed outcome (`install-flow.ts:3162-3168`), so its outcome carries the field at runtime without declaring it. That is already true for root partials via `classifyInstallFailure`, it is the LCCODE-01 item deferred to Phase 11, and `apply` does not read it.

Install's rows for comparison [VERIFIED: `install-cascade.messaging.ts:454-573`]:
- Member arm facts: `key: subject.key`, `reasons: ["rollback partial"]` when partials exist (`memberReasons`, 473-491), `cause: new DependencyCascadeError(subject.error.message, subject.key, { cause: subject.error.cause })` (`memberCause`, 454-467), plus `rollbackPartials`.
- `composeCascadeFailureMessage` (538-573): the dependency row is `{ status: "failed", name: facts.key, reasons, rollbackPartial: [{phase, cause?}], cause: facts.cause, severity: "error", needsReload: false }`. The root row is `{ status: "failed", name: rootName, reasons: ["dependency failed"], severity: "error", needsReload: false }`, with **no cause**. Both are sorted with `compareByNameThenScope`.

Install's root partial row [VERIFIED: `install.messaging.ts:203-222`]: `reasons: ["rollback partial"]`, `version`, `scope`, `cause` (the raw, unredacted error), `rollbackPartial: rollbackPartials.map(p => ({ phase: p.phase, ...(p.cause && { cause: p.cause }) }))`.

The error behind a partial: `formatRollbackError` returns `new Error(originalError.message, { cause: originalError })` when partials exist (`transaction/rollback.ts:59-75`), so a rendered cause chain shows the message twice: `cause: X -> X`. The standalone enable test already pins this ("mcp staging denied -> mcp staging denied", `enable-disable.test.ts:5694`). [VERIFIED]

### Pattern 6: Carry an enable's partials (MIM-03, D-PL6-03)

[VERIFIED: `enable-disable.ts:194-209` exported type, `331-336` internal arm, `2914-2932` mapping]

```ts
// exported failed arm — no rollbackPartials
| ({ readonly status: "failed"; readonly reason: Reason; readonly error: Error; readonly cause: string } & McpConfigNoticesCarrier);
// outcomeToTypedResult enable-failed arm
const partials = outcome.rollbackPartials ?? [];
const reason: ContentReason = partials.length > 0 ? "rollback partial" : (narrowEnableFailure(outcome.cause)[0] ?? "unreadable");
return { status: "failed", reason, error: outcome.cause, cause: errorMessage(outcome.cause), ...notices };
```

**Change:** declare `readonly rollbackPartials?: readonly RollbackPartial[]` on the exported failed arm, and add `...(partials.length > 0 && { rollbackPartials: partials })` in the enable-failed arm. Update the I4 comment, which says orchestrated callers "cannot consume" the rows. `test/orchestrators/plugin/enable-disable.test.ts:3597-3602` (GHB-03) asserts `typedFailure` with `deepStrictEqual`, so it must gain `rollbackPartials: [{ msg: "skill rollback denied", phase: "skills" }]`. That case also covers the new branch. `enable-disable.ts` belongs to Phase 1 (and to Phase 2 for the enable warning surface), so list it as a shared file.

### Pattern 7: Import rows with partials (MIM-03)

**Today** [VERIFIED: `execute.ts:1068-1076`, `1193-1198`, `1861-1896`, `1916-1976`, `725-737`]: both failure paths reduce the partials to a boolean (`rolledBackPartial`), which only selects `runtimeReason: "rollback partial"`. A `DependencyCascadeError` goes to `pushUnexpectedFailure(result, plugin, "dependency-failed", error)`, whose row carries the cause (`execute.ts:731`).

**Change:**
- Pass the partials, not a boolean: `dispatchFailedOutcome(result, plugin, error, cause, { rollbackPartials })`, from `outcome.rollbackPartials ?? []` on both the install and the enable failed arm (the enable arm needs Pattern 6).
- Redact each partial's cause with `redactCauseChain(p.cause)` (`shared/redact-absolute-paths.ts:65-81`). Store the result on `UnexpectedPluginFailureOutcome` as an optional `rollbackPartial?: readonly { phase: string; cause?: Error }[]`. This is the public result type, so tests assert it. Head and chain redaction follows `pushUnexpectedFailure` (T-55-02-02). [ASSUMED: redacting the phase causes in import and apply is the consistent reading of T-55-02-02; CONTEXT says "redacted" only for apply's main cause]
- Fallthrough arm: `runtimeReason` stays `"rollback partial"`, and the row gets `...(o.rollbackPartial !== undefined && { rollbackPartial: o.rollbackPartial })`.
- `DependencyCascadeError` with partials (D-PL6-04): the root row is bare `{dependency failed}` with no cause. Beside it goes a dependency row `{ status: "failed", name: error.key, reasons: ["rollback partial"], cause: failureCause(...), rollbackPartial, severity: "error", needsReload: false }` in the requested plugin's block. Two shapes work: (a) an optional `failedDependency` sub-object on the root outcome, which the row builder expands into the second row (recommended: it stays in the public result, so unit tests see it), or (b) push a `PluginFailedMessage` onto `result.dependencyChanges`. `UpdateDependencyRow` includes `PluginFailedMessage` (`orchestrators/types.ts:330-334`), and those rows render after the plugin rows (`execute.ts:739-743`). They are stripped from the returned result (`execute.ts:2049`).
- `DependencyCascadeError` without partials: no change, per D-PL6-04.
- Tally: the dependency row is a second failure (`Import: 2 failures, …`).
- Row order: import does not sort plugin rows (`execute.ts:693-743`). Install sorts the pair by name. Choose one order and pin it in the unit test and the scenario.

### Pattern 8: Apply failed-install rows (MIM-03, D-PL6-05)

[VERIFIED: `apply.ts:608-630`, `455-461`; `apply-outcomes.ts:202-232`, `742-807`; `notify.ts:1148-1169`, `1290-1305`]

Today's failure arm:

```ts
outcomes.push({
  kind: "plugin-install-failed", scope: op.scope, marketplace: op.marketplace, plugin: op.plugin,
  ...installFailureReasonFields(result.error),
  ...(result.error instanceof DependencyCascadeError && { cause: redactedDependencyCascadeError(result.error) }),
  ...carriedMcpConfigNotices(result),
});
```

Today a root partial reads `{<classified reason>}` with no cause. The EISDIR wrapper classifies through `classifyOrchestratorThrow`, and `update-rollback.feature:29` shows the same EISDIR as `unreadable`. **Change:** extract a helper, for example `installFailedOutcomes(op, result): PluginInstallFailedOutcome[]`, so `applyPluginInstalls` stays under the ceilings. It returns:
- partials and no DCE: one outcome with `reason: "rollback partial"`, `cause:` a redacted rebuild of `result.error` (`new Error(redactAbsolutePaths(msg), { cause: redactCauseChain(error.cause) })`), and `rollbackPartials:` the redacted phases.
- DCE and partials: a root outcome `{ reason: "dependency failed" }` with no cause, plus a dependency outcome keyed by `error.key` split at `lastIndexOf("@")` (marketplace and bare plugin; no shared helper exists, inline split as at `execute.ts:1803` and `plan.ts:88`), with `reason: "rollback partial"`, `cause: redactedDependencyCascadeError(result.error)`, and `rollbackPartials`.
- otherwise: today's single outcome.

`apply-outcomes.ts`: widen `cause?: DependencyCascadeError | DirectoryPinUnsatisfiedError` to `cause?: Error`, add `rollbackPartials?: readonly { readonly phase: string; readonly cause?: Error }[]` (or reuse `RollbackPartial` from `transaction/phase-ledger.ts`), and update the doc comment. Readers of `.cause`: only `notify.ts::failedRowCause` (`notify.ts:1153`), which returns `Error`. `delisted-plugins.ts:33` lists the kind only. `applyDependencyInstalls` (`apply.ts:722-733`) still assigns the narrower types, and the wider field accepts them. [VERIFIED: grep]

**Typecheck trap:** `test/orchestrators/reconcile/apply-outcomes.test.ts:356-365` pins the narrow type with `@ts-expect-error`. Change that case to a positive `satisfies` (and add one for `rollbackPartials`) in the same task.

`notify.ts`: in `applyPluginOutcomeToBlock`'s failed arm, add a `failedRowRollback(outcome)` beside `failedRowCause` that returns `{ rollbackPartial }` for `plugin-install-failed` with partials, else `{}`. Cover it in `test/orchestrators/reconcile/notify.test.ts` (pure projection; the existing install-failed cases are near lines 313 and 1621-1690).

`apply-outcomes.ts` belongs to Phase 1. Phases 2 and 7 edit other parts of `apply.ts`. Put the new helper next to `redactedDependencyCascadeError` (`apply.ts:447-461`) to limit merge friction.

### Pattern 9: Cucumber fixture for a read-only skill directory (D-PL6-07)

Facts verified this session on Node v26.12.1, uid 1000:

```
fs.cp(src/skill → dst/skill, {recursive, dereference:false, verbatimSymlinks:true, errorOnExist:true, force:false})
  → dst/skill/assets mode 555 (preserved)
fs.rm(dst/skill, {recursive:true, force:true})
  → "EACCES: permission denied, unlink '<abs>/dst/skill/assets/data.txt'"  code EACCES  syscall unlink
```

[VERIFIED: scratch run; same options as `bridges/skills/stage.ts:297-303` and remover `bridges/skills/index.ts:22-26`]

Fixture requirements:
- The read-only directory must **hold a file**. Removing an empty 0555 directory needs write permission on its parent, not on itself, so `rm` succeeds. Use a non-`.md` file (for example `data.txt`): `rewriteSupportingMarkdown` (`stage.ts:158-184`) rewrites `.md` files in staged copies, and a write inside the read-only directory would fail the *stage*, not the undo. The read-only directory must be a **subdirectory** of the skill. Staging writes `SKILL.md` at the skill root (`stage.ts:365`).
- Skill source path: `plugins/<plugin>/skills/<plugin>-skill/` under the published root (see `unreadableSkillFile`, `features/lib/published-marketplace.ts:436-448`). Local kinds only, since git stores no directory modes. Refuse `url`/`github` as `publishUnreadableSkillFile` does.
- Phase order [VERIFIED: `install-outcome.ts:1528-1536`]: skills, commands, agents, hooks, mcp, workflows, state. The mcp phase fails on the blocking directory before it writes anything (`mcpReplacement` is undefined, so its undo is a no-op, `install-outcome.ts:1303-1312`). The reverse undo walk reaches skills, whose `unstagePluginSkills` rethrows non-ENOENT errors (`bridges/skills/unstage.ts:55-67`). The rollback partials are exactly `[{ phase: "skills", cause: EACCES unlink error }]`. `leaks` stays empty: the cause chain carries no `CleanupContextError`.
- The step reproduces the failure like the "unreadable skill file" step (`features/step_definitions/marketplace/update.steps.ts:94-106`): copy the skill with the same `fs.cp` options into a scratch directory under `{home}`, `rm` it, assert `[code, syscall]` is `["EACCES", "unlink"]` (this fails loudly as root), cut quoted paths to their basename (`unreadableSkillCopyError`, `published-marketplace.ts:412-433`), and record a token, for example `{read-only skill directory removal error}`, with `this.recordErrorMessage`.
- Release (`world.onRelease`, `features/support/world.ts:376-397`): restore write permission on **every copy**. That means the published directory, the scratch copy, and the copy the failed undo left in the scope's skills target (`<scopeRoot>/skills/<generated-name>/<dir>`). Otherwise the next scenario's `Before` (`rm -rf` of every sandbox directory, `features/support/pi-process.ts:128-135`) and the run cleanup fail with EACCES. A recursive "chmod u+w on every directory" walk over the sandbox roots (`home`, `projectDir`, `agentDir`) is the most robust choice: it does not care where a copy landed. Put the walker in `features/lib/`.
- Step placement: a publishing fact used by two verbs (import, apply) belongs in the topic module `features/step_definitions/plugin/publishing.steps.ts` (layout.md "Vertical functions"). The library function goes in `features/lib/published-marketplace.ts`.

### Pattern 10: Narrow the import enable outcome (MIM-04)

[VERIFIED: `execute.ts:108-151` type, `601-628` `installedRow`, `1173-1192` enable arm; `plugin/shared.ts:94-139, 152-163` (`LedgerDegradationSignals`, `degradationFromEnable`); `reconcile/notify.ts:930-963` (`enabledRowFromOutcome`, `dependencies` from `enableRowDependencies`)]

Today the enable arm sets `declaresAgents: outcome.stagedAgents === true` (and the same for Mcp and Workflows) **and** `enableSignals: degradationFromEnable(outcome)`, which also copies `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows`. Each staged fact is carried twice.

Change:
- Type: `readonly enableSignals?: Pick<EnableDegradationSignals, "unsupported" | "orphanRewake" | "degradedKinds">` (name at discretion).
- Enable arm: build only those three. Destructure the staged keys off `degradationFromEnable(outcome)` (the `^_` unused-var pattern is allowed), or write a local pick. Keep `degradationFromEnable` unchanged: `apply.ts:887` uses it too.
- `installedRow`: `enabledRowFromOutcome({ ..., ...o.enableSignals, ...(o.declaresAgents && { stagedAgents: true }), ...(o.declaresMcp && { stagedMcpServers: true }), ...(o.declaresWorkflows && { stagedWorkflows: true }) })`.
- Readers of `enableSignals`: only `execute.ts` and `test/orchestrators/import/execute.test.ts:4737, 4739, 4946, 5061`. Line 4737 changes to `enableSignals: {}`, and its rendered text (`… {requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}`) must stay byte-identical, which proves "rows do not change". `test/e2e/import-command.test.ts:129` reads `declaresAgents` on an unrelated update-run stub and needs no change. [VERIFIED: grep]

### Anti-Patterns to Avoid
- **Copying the claim rule into import.** A second `samePlannedSource` walk in `execute.ts` can drift from the planner (declared-name exclusion, sorting, conflict detection). Export from `plan.ts`.
- **Adding the claim map to `ReconcilePlan`.** This churns `emptyReconcilePlan` and every plan deep-equal in other suites.
- **Keeping the boolean `rolledBackPartial`.** D-PL6-03 says the rows come "from the outcome's `rollbackPartials`, not from a boolean".
- **Rendering unredacted phase causes in import or apply.** The EACCES message carries the absolute scope path.
- **Changing `shared/notification-grammar.ts`.** `composeFailureLines` (`notification-grammar.ts:1127-1141`) already emits `    [<phase>] (rollback failed)` and the `      cause: …` line. Wire and JSON already carry `rollbackPartial` (`notification-json.ts:721-731`, `notification-wire.ts:305`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Source-identity claim | A new samePlannedSource walk in import | `plan.ts` claim export (Pattern 1) | One rule, the planner's |
| Path redaction of causes | Regex in execute.ts or apply.ts | `redactAbsolutePaths`, `redactCauseChain` (`shared/redact-absolute-paths.ts:18-24, 65-81`) | Depth bound, truncation marker, and cycle guard already handled |
| Dependency cascade error redaction | A new rebuild | `apply.ts::redactedDependencyCascadeError` (455-461) | It keeps `key` |
| Per-phase row rendering | New grammar lines | `PluginFailedMessage.rollbackPartial` + `composeFailureLines` | Already in text, JSON, and wire |
| Node-major error wording in scenarios | Literal messages in feature tables | Error tokens via `recordErrorMessage` (`world.ts:142-149`) | Node 24 and 26 word errno errors differently |

## Common Pitfalls

### Pitfall 1: Redacted error text vs. raw error tokens on Node 26
**What goes wrong:** Import and apply redact the main cause, so a Node 26 message `EISDIR: illegal operation on a directory, read '/tmp/…/mcp-adapter.json'` becomes `… read 'mcp-adapter.json'`. The existing `{mcp-adapter.json read error}` token stores the raw message (`features/step_definitions/mcp-configuration.steps.ts:42-57`), so it does not project, and the scenario fails locally while passing in CI on Node 24.
**Verified:** `node -e 'fs.promises.readFile("/tmp")'` on v26.12.1 prints `EISDIR: illegal operation on a directory, read '/tmp'`. [VERIFIED: run this session] CI runs Node 24, and `npm run check` runs cucumber locally. [VERIFIED: package.json `check` script]
**How to avoid:** Make each error token also project its basename-cut form. For example, in `features/lib/run-tokens.ts::projectTokens`, replace both the stored message and its quoted-paths-cut-to-basename variant with the token. The two forms are equal on Node 24 and differ on Node 26, and both map to one token. Recording a *second* token instead breaks Node 24: two tokens with an identical value, and the first one in the map wins. Do not do that.
**Warning signs:** A scenario passes in CI but fails locally with `read 'mcp-adapter.json'` in a `cause chain` cell.

### Pitfall 2: A `rollback partial` cell is unprojected JSON
**What goes wrong:** `features/lib/field-rows.ts::cell` (`34-40`) projects tokens only for strings and string arrays. `rollbackPartial` is an array of objects (`[{"phase":"skills","cause":{"causeChain":[…],"truncated":false}}]`), so it is `JSON.stringify`'d raw. Messages and sandbox paths inside it are not tokenized.
**How to avoid:** Run `projectTokens` over the stringified JSON for non-string values. The token values contain only `'` quotes, which JSON does not escape. The existing JSON cells (autoapply `files`, MCP notices) hold no sandbox paths, so they are unaffected. The expected cell is then, for example, `[{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}]`. No existing scenario has a non-empty `rollback partial` cell (every current one is empty). [VERIFIED: grep of features/]
**Warning signs:** The cell shows `/tmp/pi-cm-features-…` or a Node-specific message.

### Pitfall 3: Read-only directory teardown
**What goes wrong:** The failed undo leaves `<scopeRoot>/skills/<name>/<ro-dir>/<file>`. The `Before` hook's `rm -rf` of the sandbox fails with EACCES on the next scenario.
**How to avoid:** One release restores `u+w` on every directory under the sandbox roots (Pattern 9). Register it in the Given that creates the read-only directory, before anything can copy it.

### Pitfall 4: Empty read-only directory, or a `.md` file inside it
**What goes wrong:** An empty 0555 directory is still removable, so no partial appears. A `.md` file with references is rewritten during staging, so the *stage* fails instead.
**How to avoid:** Put a non-markdown file in the read-only subdirectory, and assert the EACCES `unlink` in the Given.

### Pitfall 5: The `@ts-expect-error` that becomes unused
`apply-outcomes.test.ts:363` breaks `npm run typecheck` as soon as `cause` widens. [VERIFIED]

### Pitfall 6: Exact-equality tests that pin today's shapes
- `execute.test.ts:1555-1600` (REC-06) expects no `[skills] (rollback failed)` child and an outcome without `rollbackPartial`. Its partial has no `cause`, so after the change the row gains exactly `    [skills] (rollback failed)`.
- `execute.test.ts:4737` (`enableSignals` with staged keys) and `4840-4884` (D-07) are covered above.
- `enable-disable.test.ts:3597-3602` deep-equals the typed failure.
- Apply tests that deep-equal `plugin-install-failed` outcomes or rendered text for DCE failures (`apply.test.ts:2210-2380`) do not change: no partials, today's rows (D-PL6-04/05).

### Pitfall 7: An unreferenced entry with a source mismatch renders nothing
**What goes wrong:** `recordPlannedMismatch`'s `source-mismatch` arm (`execute.ts:953-971`) pushes one row per *plugin*, and the block status is set only from `result.sourceMismatches` rows (`execute.ts:689-691`). An unreferenced settings marketplace recorded under the same name with a different source, or a conflicted claim with no plugins, therefore produces **no row at all**. The `unknown-stored` arm does not have this problem: it goes through `recordMarketplaceAddFailure`.
**How to avoid:** Decide explicitly (see Open Question 2). Recommended: give a plugin-less mismatch a `(failed)` block, for example a `MarketplaceFailureOutcome` with the mismatch text as cause, as the `unknown-stored` arm does.

### Pitfall 8: Cognitive complexity
`dispatchFailedOutcome`, `installOnePlannedPlugin`, `buildImportNotificationMarketplaces`, and `applyPluginInstalls` are already long. ESLint and fallow score cognitive complexity independently. Extract helpers (the partials redaction, the dependency-row expansion, `installFailedOutcomes`).

### Pitfall 9: Parallel phases on shared files
`enable-disable.ts` and `apply-outcomes.ts` belong to Phase 1. `install-flow.ts` belongs to Phase 4 (other functions). `apply.ts` belongs to Phases 2 and 7 (other parts). `features/lib/*` and shared step modules may also be touched by Phase 1 (WRN-04 uses an mcp-phase failure) and Phase 10. Keep Phase 6 edits additive and local, and name the shared files in the plan frontmatter.

## Code Examples

### Rendered text an import row should produce (root partial, after the change)
```
A plugin operation has failed.

● fixtures [user] (added)
  ⊘ demo (failed) {rollback partial}
    cause: <E'> -> <E'>
    [skills] (rollback failed)
      cause: EACCES: permission denied, unlink 'data.txt'

Import: 1 failure, 1 success
```
`<E'>` is the redacted EISDIR message. The doubled link comes from `formatRollbackError`. [VERIFIED: from code paths above. MEDIUM: run it to confirm `needs reload` and the tally]

### Import dependency partial (D-PL6-04)
```
● fixtures [user] (added)
  ⊘ app (failed) {dependency failed}
  ⊘ lib@fixtures (failed) {rollback partial}
    cause: <E'> -> <E'>
    [skills] (rollback failed)
      cause: EACCES: permission denied, unlink 'data.txt'
```
The member cause is a `DependencyCascadeError(wrapper.message, "lib@fixtures", { cause: E })`, redacted by import. Row order is a discretion point (Pattern 7).

### Apply root partial (D-PL6-05)
```
● fixtures [project]
  ⊘ demo (failed) {rollback partial}
    cause: <E'> -> <E'>
    [skills] (rollback failed)
      cause: EACCES: permission denied, unlink 'data.txt'
```
Today this row reads `⊘ demo (failed) {unreadable}`, or whatever `classifyOrchestratorThrow` gives the EISDIR wrapper, so the scenario fails before the change.

### Scenario sketches (titles and data; the step text belongs to the writer)
1. **import.feature (MIM-02):** "Importing adds an extra known marketplace that no enabled plugin names". Publish `tools` as well. The settings enable `demo@fixtures` and declare `fixtures` and `tools`. The rows are a `fixtures` added block with `demo` installed, and a `tools` added block with no plugin rows: a block with no plugin rows yields one record with blank plugin columns (`features/lib/result-rows.ts:63-75`). `claude-plugins.json` declares both marketplaces. It fails today: `tools` is never planned.
2. **import.feature (MIM-01):** "Importing settings that name a known marketplace under another name installs the plugin under the recorded marketplace". `fixtures` is added to the user scope, so it is recorded as `fixtures`, the manifest name. The settings declare `"other": {source: directory, path: "{home}/marketplaces/fixtures"}` and enable `demo@other`. The rows are `fixtures | skipped | already added | demo@fixtures | demo | installed`. The record holds `demo@fixtures`, and the config declares the `fixtures` marketplace and `demo@fixtures`. Then `When the user runs "/claude:plugin pending --scope user"` gives `kind reconcile-pending-empty` (`apply.feature:250-254`). It fails today: the orchestrated add of `{home}/marketplaces/fixtures` derives the manifest name `fixtures`, which is already recorded, so the add fails as a duplicate name. `samePlannedSource` matches the two spellings: both are the same expanded absolute path, and the existing scenario `import.feature:332-368` already skips on it.
   Optional, stronger: first hand-edit the config so it lacks `fixtures` (`a config in scope user and layer base, with this text:`), to prove the post-pass repair declares the recorded name with the settings source.
3. **import.feature (MIM-03 own):** `demo` has a read-only skill directory. A directory blocks the user scope's `mcp-adapter.json`. The settings enable `demo@fixtures`. The row has `rollback partial` reasons, a cause chain of two tokens, and the `skills` partial JSON.
4. **import.feature (MIM-03 dependency):** offers with dependencies `app → lib`. `lib` has the read-only directory, and `mcp-adapter.json` is blocked. Rows: `app failed dependency failed` (empty cause cells) and `lib@fixtures failed rollback partial` with cause and partial. Tally: 2 failures.
5. **apply.feature (MIM-03):** the background offers `demo`. `fixtures` is added to the project scope. A config declares `demo`. `demo` has the read-only directory, and the project `mcp-adapter.json` is blocked. When the user runs apply, the row is `demo failed rollback partial` with cause and partial.
6. *(Recommended, not in CONTEXT's list)* **apply.feature (MIM-03 dependency):** proves D-PL6-05's dependency row (`lib` under its own marketplace by its bare name, `{rollback partial}`; `app {dependency failed}` without cause). AGENTS.md requires a failing-first scenario for every user-visible change, and this row is user-visible.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D-07 (lifecycle-coverage phase 19): import adds the settings name and refuses to follow a source claim | D-PL6-02: follow the planner's one-to-one claim | This phase | Replace the test at `execute.test.ts:4840` |
| Import plans only referenced marketplaces | Every `extraKnownMarketplaces` entry (D-PL6-01) | This phase | New diagnostics for unmappable unreferenced entries; a scope may now lock with no plugins |
| `rolledBackPartial` boolean | `rollbackPartials` threaded to rows | This phase | Per-phase rows on import and apply |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Redact each rollback phase's cause in import and apply (not only the main cause) | Pattern 7, 8 | Low: unredacted text would leak absolute paths, which conflicts with T-55-02-02. CONTEXT says "redacted" for apply's cause only |
| A2 | Rewrite `ref.raw` to the recorded key when aliasing | Pattern 2 | Low: affects only the `ref` field and diagnostic text, not rows |
| A3 | An explicit unreferenced `extraKnownMarketplaces["claude-plugins-official"]` entry is planned like any other entry; only the *fallback* depends on a reference | Open Q1 | Medium: D-PL6-01's wording can be read either way |
| A4 | A plugin-less source mismatch should get a `(failed)` block | Pitfall 7 / Open Q2 | Medium: user-visible vocabulary choice |
| A5 | The exact `needs reload` and tally fields of scenarios 3-6 | Code Examples | Low: the executor reads them from the first run |

## Open Questions (RESOLVED)

The planner recorded a decision for each question. Each one is marked RESOLVED below.

1. **An unreferenced settings entry named `claude-plugins-official`.**
   - Known: today a referenced official name always uses the hard-coded source and ignores the extra entry's source (`marketplaces.ts:115-118`). E1's `zF` adds the official *fallback* only when an enabled plugin names it, but spreads the settings' `extraKnownMarketplaces` over it, so an explicit entry is in Claude Code's declared set.
   - Unclear: D-PL6-01's sentence "The official marketplace is still planned only when an enabled plugin names it" may mean the fallback only, or any entry under that name.
   - Recommendation: skip the official name in the unreferenced pass. This is D-PL6-01's literal text and has the smallest blast radius, because Phase 5 is adding reserved-name refusals for `marketplace add`. Pin it with a unit test, and flag it in the SUMMARY for confirmation.
   - RESOLVED: skip the official name in the unreferenced pass, as D-PL6-01 says. Plan 06-03 Task 1 pins it with a unit test.
2. **An unreferenced (or plugin-less) source mismatch.** No row renders (Pitfall 7). E1 says Claude Code *updates* a `sourceChanged` marketplace. Import blocks mismatches by design (IMP-05 and the existing source-mismatch rule). Recommendation: render a `(failed)` block with the mismatch cause row, through the same `recordMarketplaceAddFailure` bookkeeping the `unknown-stored` arm uses, and record the parity gap as known.
   - RESOLVED: route a plugin-less mismatch through `recordMarketplaceAddFailure`, so it renders a `(failed)` block with a cause row. Plan 06-04 Task 1 implements and tests it, and Plan 06-07 records the decision in its SUMMARY.
3. **Apply dependency-row scenario (number 6).** It is not in CONTEXT's specifics. AGENTS.md's behavioral-test rule suggests adding it. Recommendation: add it.
   - RESOLVED: add the scenario. Plan 06-07 Task 2 writes it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.12.1 locally; CI pins 24 | — |
| Non-root user | D-PL6-07 read-only undo failure | ✓ | uid 1000 | none: the scenarios must fail loudly as root (assert EACCES in the Given) |
| `cucumber-js` (devDep) | scenarios | ✓ (repo) | — | — |

**Missing dependencies with no fallback:** none. Note that the scenario wording must hold on Node 24 and Node 26 (Pitfall 1).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration), `@cucumber/cucumber` (behavioral) |
| Config file | `package.json` scripts; `cucumber.json` |
| Quick run command | `node --test <owner test path>`; `node --test --test-name-pattern '<title>' <path>`; `npx cucumber-js --name '<scenario title>'` |
| Full suite command | `npm run check` (static + unpaired + integration + cucumber + direct coverage) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MIM-02 | Unreferenced extras are planned after referenced ones, in settings order; an unmappable one gets a diagnostic; the official name is not planned unreferenced | unit | `node --test test/orchestrators/import/marketplaces.test.ts` | ✅ (add cases) |
| MIM-02 | An unreferenced extra is added, declared by the post-pass, and alone takes the lock | unit | `node --test --test-name-pattern 'MIM-02' test/orchestrators/import/execute.test.ts` | ✅ (add cases) |
| MIM-02 | Scenario 1 | behavioral | `npx cucumber-js --name 'Importing adds an extra known marketplace'` | ❌ new scenario |
| MIM-01 | Claim map export | unit | `node --test test/orchestrators/reconcile/plan.test.ts` | ✅ (add case) |
| MIM-01 | Alias: no add, skip under the recorded name, install `p@recorded`, post-pass declares the recorded name; conflict gives source mismatch and no add | unit | `node --test --test-name-pattern 'MIM-01' test/orchestrators/import/execute.test.ts` | ✅ (replace D-07 case at 4840, add conflict case) |
| MIM-01 | Scenario 2, plus `pending` empty | behavioral | `npx cucumber-js --name '<scenario 2 title>'` | ❌ new |
| MIM-03 | `handleCascadeThrow` orchestrated outcome carries member partials | unit | `node --test --test-name-pattern 'MIM-03' test/orchestrators/plugin/install-flow.test.ts` | ✅ (add case; drive with `transactionControl.runPhases` like `12652-12709`) |
| MIM-03 | The orchestrated enable failure carries partials | unit | `node --test test/orchestrators/plugin/enable-disable.test.ts` | ✅ (update 3597-3602) |
| MIM-03 | Import rows: root partial children (redacted), enable partial, dependency partial (bare root plus dependency row), DCE without partial unchanged | unit | `node --test --test-name-pattern 'MIM-03\|REC-06' test/orchestrators/import/execute.test.ts` | ✅ (update 1555; add cases) |
| MIM-03 | Apply outcomes: root partial `{rollback partial}` with cause and phases; dependency partial gives two outcomes | unit (real on-disk install, root-skip guard as at `apply.test.ts:2322-2325`) | `node --test --test-name-pattern 'MIM-03' test/orchestrators/reconcile/apply.test.ts` | ✅ (add cases) |
| MIM-03 | Projection threads `rollbackPartial`; `cause: Error` type | unit/type | `node --test test/orchestrators/reconcile/notify.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts` | ✅ (update 356-365; add case) |
| MIM-03 | Scenarios 3, 4, 5 (and 6) | behavioral | `npx cucumber-js --name '<title>'` | ❌ new, plus a new fixture step |
| MIM-04 | `enableSignals` narrowed; rendered rows byte-identical | unit | `node --test --test-name-pattern 'IMP-05: enables a plugin the scope records disabled\|IMP-10' test/orchestrators/import/execute.test.ts` | ✅ (update 4737) |
| all | Direct coverage 100% per touched pair | coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (repeat for `marketplaces.ts`, `reconcile/plan.ts`, `reconcile/apply.ts`, `reconcile/notify.ts`, `reconcile/apply-outcomes.ts`, `plugin/install-flow.ts`, `plugin/enable-disable.ts`) | ✅ |
| all | Feature-file rules, step usage | static | `npm run check:features` | ✅ |

### Sampling Rate
- **Per task commit:** the owner `node --test` file(s) plus `npm run test:coverage:direct -- <source>` for each touched pair. The pre-commit hook runs `check:commit`, which does not run cucumber, so run `npx cucumber-js --name …` for each scenario the task adds.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `features/lib/published-marketplace.ts`: read-only skill directory publisher, the error reproduction, and a writable-again walker.
- [ ] `features/step_definitions/plugin/publishing.steps.ts`: the Given that creates the directory, asserts EACCES `unlink`, records the token, and registers the release.
- [ ] `features/lib/run-tokens.ts` (basename-cut variant projection) and `features/lib/field-rows.ts` (project tokens in JSON cells). Pitfalls 1 and 2.
- No framework install needed.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no (local files only; the containment rule NFR-10 is unchanged) | `assertPathInside` |
| V5 Input Validation | yes: Claude settings JSON (`extraKnownMarketplaces` keys and values) | `marketplaceSourceFromExtra` shape checks; `setOwn`/`ownValue` for prototype-safe keys (`execute.ts:1323, 1331`) |
| V6 Cryptography | no | — |
| V7 Error Handling and Logging | yes: rollback causes carry absolute paths | `redactAbsolutePaths` / `redactCauseChain`; `redactCredentials` in `serializeCauseChain` (`shared/errors.ts:182-195`) |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path disclosure through rollback phase causes on import or apply rows | Information disclosure | Redact every phase cause (A1) as T-55-02-02 does for head and chain |
| Prototype keys in `extraKnownMarketplaces` (`__proto__`, `constructor`) now iterated unreferenced | Tampering | `Object.keys` plus `setOwn`/`ownValue` (already used), and planner `ownValue`. The integration test `reserved-record-keys.test.ts` covers this area |
| An unreferenced settings entry adds a marketplace the user did not enable a plugin from | Elevation (unexpected network clone) | Matches Claude Code (E1). NFR-5 allows network for git-source adds. It is reported as an `(added)` row |

## Sources

### Primary (HIGH confidence; read this session)
- `extensions/pi-claude-marketplace/orchestrators/import/{marketplaces,execute,types,settings,refs}.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/{plan,types,apply,apply-outcomes,notify,mcp-migration}.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install-flow,install.messaging,install-cascade.messaging,enable-disable,shared,install-outcome}.ts`
- `extensions/pi-claude-marketplace/{transaction/phase-ledger.ts,transaction/rollback.ts,bridges/skills/{stage,unstage,index}.ts,shared/{errors,redact-absolute-paths,notification-grammar,notification-resolve,notification-json,notification-wire,notification-types}.ts,domain/source.ts}`
- `features/lib/{result-rows,field-rows,run-tokens,published-marketplace}.ts`, `features/support/world.ts`, `features/step_definitions/{mcp-configuration,claude-code-settings}.steps.ts`, `features/step_definitions/marketplace/{update,publishing}.steps.ts`, `features/plugin/{import,apply,install-rollback,install-dependencies}.feature`
- `test/orchestrators/import/{execute,marketplaces}.test.ts`, `test/orchestrators/reconcile/{apply,apply-outcomes,plan,notify}.test.ts`, `test/orchestrators/plugin/{install-flow,enable-disable}.test.ts`
- `.planning/{ROADMAP,REQUIREMENTS,STATE}.md`, `06-CONTEXT.md`, `AGENTS.md`, `.agents/skills/{cucumber,typescript-unit-tests,local-verification}/**`
- Scratch runs on Node v26.12.1 (cp mode, rm EACCES message, EISDIR message)

### Secondary / Tertiary
- None. No web sources were needed; the upstream evidence is in CONTEXT.md (E1, E2).

## Metadata

**Confidence breakdown:**
- Code paths and file:line facts: HIGH. Each was read this session.
- Planned shapes (helper names, outcome fields): MEDIUM. They are design recommendations within Claude's discretion.
- Scenario cell text (tally, needs reload, exact JSON): MEDIUM. Derived from code and not yet run.
- Pitfalls 1 and 2 (Node 26 wording, JSON cell projection): HIGH. Verified by running Node and reading the harness.

**Research date:** 2026-10-26
**Valid until:** 2026-11-25, or until a wave-1 sibling phase merges changes into `install-flow.ts`, `enable-disable.ts`, `apply*.ts`, or `features/lib/`.

---
phase: 29-load-converges-on-the-catalog
reviewed: 2026-10-24T23:38:05Z
depth: standard
files_reviewed: 139
files_reviewed_list:
  - CHANGELOG.md
  - .claude/commands/analyze-upstream-releases.md
  - docs/dependency-resolution.md
  - docs/json-output.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/apply.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/update.feature
  - features/plugin/apply.feature
  - features/plugin/configuration.feature
  - features/plugin/fetch.feature
  - features/plugin/git-source.feature
  - features/plugin/git-source-update.feature
  - features/plugin/help.feature
  - features/plugin/pending.feature
  - features/plugin/reconcile.feature
  - features/plugin/update.feature
  - features/plugin/update-rollback.feature
  - features/plugin/usage-errors.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - README.es.md
  - README.md
  - schema/claude-plugin.schema.json
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/catalog-parser.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/catalog-uat/fixture-maps.ts
  - test/architecture/catalog-uat/fixtures/plugin-apply.ts
  - test/architecture/catalog-uat/fixtures/plugin-pending.ts
  - test/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - test/architecture/compat-01-no-expansion.test.ts
  - test/architecture/cross-op-convergence.test.ts
  - test/architecture/flag-catalog-drift.test.ts
  - test/architecture/gate-targets.ts
  - test/architecture/json-output-docs.test.ts
  - test/architecture/manifest-lookup-drift.test.ts
  - test/architecture/notify-closed-set-locks.test.ts
  - test/architecture/notify-grammar-invariant.test.ts
  - test/architecture/notify-will-reload-agreement.test.ts
  - test/architecture/soft-dep-marker-policy.test.ts
  - test/e2e/import-command.test.ts
  - test/edge/browser/plugin-browser.test.ts
  - test/edge/completions/provider.test.ts
  - test/edge/flag-catalog.test.ts
  - test/edge/handlers/plugin/apply.test.ts
  - test/edge/handlers/plugin/pending.test.ts
  - test/edge/handlers/plugin/reinstall.test.ts
  - test/edge/handlers/plugin/shared.test.ts
  - test/edge/register.test.ts
  - test/edge/router.test.ts
  - test/edge/types.test.ts
  - test/index.test.ts
  - test/integration/mcp-migration.test.ts
  - test/integration/plugin-layer-consistency.test.ts
  - test/integration/plugin-layer-verbs.test.ts
  - test/integration/reserved-record-keys.test.ts
  - test/integration/standalone-prune.test.ts
  - test/integration/workflow-kind-inversion.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/plugin/constraint-fold.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/list-candidate-version.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/shared.test.ts
  - test/orchestrators/plugin/update-cascade.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/plugin/update-row.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - test/orchestrators/reconcile/delisted-plugins.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/pending.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - test/orchestrators/reconcile/reconcile.messaging.test.ts
  - test/orchestrators/reconcile/types.test.ts
  - test/orchestrators/types.test.ts
  - test/shared/notification-dispatch.test.ts
  - test/shared/notification-grammar.test.ts
  - test/shared/notification-json.test.ts
  - test/shared/notification-present.test.ts
  - test/shared/notification-resolve.test.ts
  - test/shared/notification-summary.test.ts
  - test/shared/notification-types.test.ts
  - test/shared/notification-wire.test.ts
  - test/shared/notify-context.test.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-10-24T23:38:05Z
**Depth:** standard
**Files Reviewed:** 139
**Status:** issues_found

## Structural Findings (fallow)

`fallow audit --changed-since fe1ed900`: verdict `pass`. 0 dead-code findings, 0 complexity findings, 0 clone groups.

## Narrative Findings (AI reviewer)

## Summary

I reviewed `git diff fe1ed900..HEAD` at standard depth. The production files got the most attention, then tests and features, then docs (checked only for claims that contradict the code). The focus areas were: a read-only load, `apply` convergence followed by an empty `pending`, NFR-5, NFR-1, NFR-3, swallowed errors, and whether the `pending` preview matches what `apply` reports.

These parts hold up:

- **Read-only load.** `load.ts` runs no install, uninstall, toggle or backfill. Its only writes are the D-04 format migrations (MIG-01 and the AMIG-01 MCP move) and the lock files of the routing rebuild. It never emits the `/reload` trailer.
- **NFR-5.** `convergence.ts`, `constraint-fold.ts`, `pending.ts` and `load.ts` name no git surface. The convergence policy (`CONVERGE_MATERIALIZATION`) sets `searchReleaseTags: false` and `refreshSource: false`.
- **NFR-1.** The new writes go through the existing guarded paths (`withStateGuard`, the update runner). No new raw write was added.
- **Output.** Trailer and severity wiring (`needsApply`, the `reconcile-applied-cascade` reload decision, `catalogHint`) agree between the text and JSON strategies.

The main defect is in the shared catalog-convergence planner. The planner and the runner that `apply` drives judge dependents' ranges from different declarations. So `pending` can list a `(will update)` move that `apply` refuses on every run, and `pending` never empties (CR-01). I reproduced this with a hermetic scratch test against the real modules. The fixed-point algorithm is also order-dependent (WR-01). There are two more ways `pending` disagrees with `apply`, or one `apply` does not converge (WR-02, WR-03). Also, `convergeScope` hides its own failures (WR-04).

## Critical Issues

### CR-01: The planner and the runner judge ranges from different declarations, so `apply` never makes a move `pending` keeps listing

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:431-480` and `extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts:368-386` (selected by `update-preflight.ts:917-923`)

**Issue:** D-12 says a dependent that stays put is judged by its installed copy's declarations. `settleCandidates` follows that rule. When a candidate is blocked, `blockRound` swaps that dependent's declarations for `candidate.installed`. The runner does not. `apply` drives each move through `materializeLatestVersion` with `CONVERGE_MATERIALIZATION`. `selectConstraintGate` then picks `evaluateCatalogConstraint`. That gate walks `buildScopeDeclarationDetail`, which reads the catalog declaration of every listed record (`readRecordDeclarations` reads the installed copy only for delisted plugins). It never applies the installed-copy substitution.

So the gate can hold a move the planner let through. Suppose a held dependent's catalog copy is stricter than its installed copy. The planner reports `(will update)`. The runner returns `skipped {dependents constrain}`, and `convergedMoveOutcomes` renders a `(skipped)` warning. State does not change, so the next `pending`, the next load, and every later `apply` repeat the same `(will update)` and `(skipped)` pair. This breaks APL-01 and D-08 ("Afterwards `pending` lists nothing except blocked moves"), because the move is listed as a change, not as a blocked row. It also breaks D-06 and D-23 ("`apply` applies exactly what `pending` previewed").

Reproduced with a hermetic scratch test (createHermeticEnvironment, real `planConvergence` and `evaluateCatalogConstraint`):

- `widget` is recorded at 1.0.0, and its installed copy declares `zcore` with no range.
- `widget`'s catalog copy, 1.1.0, declares `zcore@^1.0.0`.
- `zzhost` pins `widget@~1.0.0`, which holds `widget`.
- `zcore` is offered at 2.0.0.

Results:

```
planner: moves [ 'zcore' ]  holds [ 'widget' ]
runner gate for zcore 2.0.0: {"kind":"held","cause":"version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by \"widget@tools\""}
```

**Fix:** Give the runner the planner's view of the declarations. One option: `apply` computes the planner's settled declarations map once per scope and passes it to the converge runner, so the gate folds over that map instead of re-walking the catalog. Another: pass a `constraintGate` that wraps `foldDeclaredConstraint` with the planner's map:

```ts
// convergence.ts: return the settled declarations alongside the plan
return { ...settleCandidates(candidates, walk.declarations, view), declarations };

// apply.ts convergeScope: judge each move with the planner's declarations
const result = await convergePlugin({
  ...target,
  constraintGate: async (o) => foldDeclaredConstraint(convergence.declarations, o.state, o.plugin, o.marketplace),
});
```

Add a test where a held dependent's catalog copy is stricter than its installed copy. Assert that `pending` shows the move, `apply` applies it, and a second `pending` is empty.

## Warnings

### WR-01: The convergence fixed point depends on plugin names, and the "any input order" test is vacuous

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:431-480`; `test/orchestrators/reconcile/convergence.test.ts:827-851`

**Issue:** Blocks only grow (`blocked.has(key) ? undefined : ...`). But swapping a blocked dependent onto its installed-copy declarations can loosen a range, not only tighten it. A candidate blocked in an early round under the dependent's catalog range is never re-judged, even when the dependent turns out to stay put on a copy that admits the move. So the result depends on alphabetical order. In the CR-01 fixture with names `core` and `zhost`, `core` sorts before `widget`. Then `core` is held: `holds [ 'core', 'widget' ]`, with a cause line that names `widget@tools`'s catalog range of `^1.0.0`, a range that will not be in force after `apply`. With names `zcore` and `zzhost`, the same move goes through. The comment at line 459 ("the answer does not depend on input order") is false. The test "the blocked moves are the same for any input order" only reverses the staging order. `planConvergence` sorts before it settles, so that test cannot detect order dependence.

**Fix:** Re-derive blocks from scratch on each round until the declaration map stops changing:

```ts
let declarations = new Map(walked);
for (;;) {
  const blocked = new Map(candidates.flatMap((c) => { const b = blockOf(c, declarations, view); return b ? [[c.key, b]] : []; }));
  const next = new Map(walked);
  for (const c of candidates) if (blocked.has(c.key) && c.installed) next.set(c.key, c.installed);
  if (sameDeclarations(next, declarations)) return toPlan(candidates, blocked);
  declarations = next;
}
```

If the loop can oscillate, bound it and fail closed by holding every candidate in the cycle. Replace the vacuous test with two fixtures that differ only in plugin names.

### WR-02: The preview ignores dependents the plan installs, so `pending` shows `(will update)` where `apply` holds the move

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:136-159` (`stateAsPlanLeavesIt`); `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:515`

**Issue:** `stateAsPlanLeavesIt` removes uninstalled records and applies toggles. It does not add the records the plan will install (`pluginsToInstall`, `pluginsToDependencyInstall`). `apply` runs `convergeScope` on a fresh read after those installs land, so a newly installed dependent's catalog range takes part in the fold there. Example: the config adds `D`, which declares `P@^1`. `P` is recorded at 1.0.0 and its catalog offers 2.0.0. `pending` and the load list `P (will update) v1.0.0 → v2.0.0`. `apply` instead reports `P (skipped) {dependents constrain}`. D-12 says ranges are judged "against the scope as it will stand after `apply`", and D-06 requires the load block to match `pending`.

**Fix:** In the `pending` path, add the planned installs to the planning view and the declaration map (the walk can read their manifest entries offline through the recorded marketplace, as `locateCandidate` already does). Otherwise, skip the convergence preview for a scope whose plan installs anything, and say so in the block. Add a `pending` test for this case.

### WR-03: One `apply` does not converge when the config disables a dependency of an enabled dependent

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1040-1054`; `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:497-509`

**Issue:** The LOAD-01 verdict is computed from the read-pass state, before the plan runs. A hand edit `"B@mp": { "enabled": false }`, where enabled `A` declares `B`, produces a plan that disables `B` only. Orchestrated disables skip the EDEP-02 dependents guard, so `apply` disables `B`. `refreshTogglePlan` runs only when `applyDependencyInstalls` satisfied something, so `A` stays enabled. After `apply`, `pending` lists `A (will disable) {dependency unsatisfied}`, and a second `apply` is needed. D-08 and D-19 ("apply makes every pending change, after which pending is empty") are not met. The first `pending` also never previewed the disable of `A`.

**Fix:** Re-run the read pass, as D-09-07 already does, whenever the round-1 plan disabled, uninstalled or dependency-disabled something, not only after dependency installs:

```ts
const changedToggles = plan.pluginsToDisable.length > 0 || plan.pluginsToUninstall.length > 0;
const toggles = satisfied || changedToggles ? await refreshTogglePlan(reader, opts, plan, outcomes) : plan;
```

Mirror this in `pending.ts`'s `withPlannedInstallsLanded` by treating planned disables as `disabled` in the verdict. Add a scenario: disable a dependency by hand, run `apply`, and assert that `pending` is empty.

### WR-04: `convergeScope` hides its own failures, so `apply` can say "nothing to change" while moves stay pending

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1077-1085`

**Issue:** If `loadState` or `planConvergence` throws, the error is only debug-logged, and the scope's moves are dropped. When the scope has no other outcomes, `notifyScopePasses` returns false and `apply` prints `Apply: nothing to change.` Meanwhile `pending` (which does not catch the same throw) either lists the moves or fails. The comment says the next `apply`'s read pass will report it. But the user was just told that nothing is pending, which is the error-hiding pattern this project rejects (fail closed on corrupt data).

**Fix:** Route the throw through the existing isolation helper, so it becomes a `state.json` row:

```ts
let convergence: ConvergencePlan | undefined;
await runScopeIsolated(scope, outcomes, async () => {
  const state = await reader.loadState(locations.extensionRoot);
  convergence = await planConvergence({ scope, state, locations });
});
if (convergence === undefined) return;
```

## Info

### IN-01: A cold git target compares the entry version against a record version that took the `plugin.json` version first

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:225-243`

**Issue:** `record.version` follows VER-01 order: the `plugin.json` version, then the entry version, then the commit. `coldGitOffer` compares `entry.version` with `record.version`. When the two version sources disagree (for example, `plugin.json` says 1.2.0 and the entry says 1.0.0) and the mirror or per-commit copy is missing, `pending` and every load show a `(will update) v1.2.0 → v1.0.0` row that looks like a downgrade. `apply` clones, finds the same revision (`unchanged` → no row), and may print `Apply: nothing to change.` right after `pending` listed a change. The case is rare, because clone-gc keeps live mirrors. **Fix:** For a cold target with an unchanged sha pin, or no pin, do not preview a move from `entry.version` alone, or compare against the entry version recorded at install time.

### IN-02: Stale comments and docs still describe load-time behavior

**Files:**

- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:838-840`: "The reconcile-applied cascade suppresses the /reload trailer at the kind level (RECON-04)". Since D-08, `shouldEmitReloadHint` reads the rows.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:43-47`: "keeps its legacy entries with no row for one reload, and the next reload moves or reports it". The plan does not change until `apply` runs, so the entries are skipped on every load until then.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:37`: "disables it on the next reload".
- `docs/dependency-resolution.md:281`: "The dependent is then disabled at load time". `apply` disables it now.

**Fix:** Change these to describe `apply`.

### IN-03: The "nothing to change" scenario does not prove that `apply` writes nothing

**File:** `features/plugin/apply.feature:272-282`

**Issue:** D-08 says that with nothing to do, `apply` "writes nothing". The scenario checks the message kind and the record's plugins only. A rewrite of state.json or the config with the same records would still pass. **Fix:** Assert that the state and config file bytes (or mtimes) are unchanged, as the RECON-05 load tests do.

### IN-04: The load builds the pending report before it sends the migration notice and warnings

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:96-103`

**Issue:** `composePendingReport` runs before `notifyMcpMigration` and `notifyScopeOutcomes`. If it ever throws (it is close to total today), `index.ts` reports only `reconcile-aborted`. The notice for an MCP move that already rewrote files is lost, and so are the per-session `{not in manifest}` warnings. **Fix:** Send the migration notice first, or wrap the composer in a try/catch that falls back to an abort row after the other notices are sent.

### IN-05: `apply` can still list tags through its install cascades, which `pending` cannot preview

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:451-670` (through `install-cascade.ts` → `probeDependencyTags`)

**Issue:** D-23 turns off tag search for catalog moves only. Config-driven installs and MISS-01 dependency installs inside `apply` still list a dependency's release tags for a range (D-11 and D-03-03 allow this). So `apply` can install a dependency at a tag version that `pending` never showed, and the same `apply` can then report a `(skipped) {dependents constrain}` hold for it. This is within policy, but the focus area's "no tag search in apply" holds only for moves. **Fix:** Say this in `docs/output-catalog.md` or the `apply` docs, or show `(will install)` with the range so the preview names the constraint.

---

_Reviewed: 2026-10-24T23:38:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

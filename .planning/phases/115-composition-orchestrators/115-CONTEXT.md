# Phase 115: Composition Orchestrators - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver compliant mirrored owner tests for the eight composition-orchestrator modules
listed in the roadmap. These modules compose the lifecycle workflows that Phase 114
already proved directly: import cascade, bootstrap onboarding, edge dependency wiring,
and load-time reconcile (apply, backfill, notify, pending). Each pair must reach 100
percent direct function, line, and branch coverage while preserving public outcomes,
scope, dependency, state, and notification effects.

Seven of the eight owner test files already exist; only `tests/orchestrators/import/index.test.ts`
is absent. This phase normalizes and re-proves all eight, and it closes the four
`check-corresponding-tests` violations that fall inside `orchestrators/import/` and
`orchestrators/reconcile/`.

This phase does not re-prove Phase 114 lifecycle internals, redesign composition
semantics, widen production APIs for tests, or absorb Phase 116 edge ownership.

</domain>

<decisions>
## Implementation Decisions

### Milestone test contract carried forward

Phase 114's D-01 through D-05 and D-13 through D-22 apply unchanged and are not
restated here. The load-bearing ones for this phase:

- Every runtime case uses separate lowercase `// arrange`, `// act`, and `// assert`
  phases. Lowercase `// act & assert` is limited to one `assert.throws()` or
  `assert.rejects()` expression.
- Every case constructs complete, case-local inputs and independently authored
  complete expectations. Never derive an expected value from the code under test.
- Shipped public contracts outrank stale test expectations.
- Production changes are limited to a demonstrated defect or a proven unreachable-code
  removal. A change may not add a test seam, export, pragma, or coverage exception.
- Install fail-fast external fakes in every offline case; prove zero unexpected network,
  git, credential, or subprocess calls.

### Import barrel contract

- **D-115-01:** Make `orchestrators/import/index.ts` reachable from production instead of
  suppressing it. Repoint `edge/handlers/plugin/import.ts` to import `importClaudeSettings`
  from `./index.ts` rather than `./execute.ts`, and prune the barrel to exactly what
  production consumes, including the two types the handler needs
  (`ClaudeImportExecutionResult`, `ImportClaudeSettingsOptions`). Delete all eight
  `fallow-ignore` WR-01 markers with nothing put in their place.
  — **Reversibility:** costly — the barrel currently re-exports seven functions and one
  type from `marketplaces.ts`, `refs.ts`, `settings.ts`, and `types.ts`; restoring a
  pruned binding later means re-adding the export and re-justifying its suppression.

  Evidence behind this: the barrel today has zero production importers. Production
  reaches `importClaudeSettings` directly from `execute.ts`, and the only file in the
  repository importing `index.ts` is `tests/orchestrators/import/execute.test.ts`. A
  probe run of `fallow dead-code --production` reports `index.ts` as an unused FILE and
  simultaneously reports all eight suppressions as STALE, because once the file is
  unreachable fallow stops evaluating its individual exports. Pruning alone does not fix
  this — a one-line barrel is still unreachable. Only a real production import clears it,
  and it clears under both `production: false` and the eventual `production: true`.

- **D-115-02:** Repoint the `import/execute.ts` owner test to import its paired source
  directly rather than through the barrel. `tests/orchestrators/import/execute.test.ts:17`
  currently imports through `index.ts`, which is the recorded `wrong-import` violation.
  An owner test imports its own source; the barrel is proved by its own owner.

### Composition depth and the coverage pragma

- **D-115-03:** Choose the double strategy per module by what that module's contract
  actually is. Do not force symmetry between the two composition orchestrators.
  - Where the contract is aggregating collaborator outcomes, inject the collaborators.
    `import/execute.ts` already exposes `ImportDeps` (`loadSettings`, `loadState`,
    `addMarketplace`, `installPlugin`) as explicit parameter-level dependency injection,
    which is the convention this repository endorses.
  - Where the contract is the resulting on-disk state, drive the real composition.
    `bootstrap.ts` composes real `addMarketplace` and `setMarketplaceAutoupdate`;
    `reconcile/apply.ts` composes real install, uninstall, enable, and disable. Both
    already do this against a case-owned temporary tree with only `createGitOpsFake` at
    the network boundary, and each of the seven existing suites runs in under four
    seconds, so real composition carries no meaningful cost.
  - Add no production seam to `bootstrap.ts`, `apply.ts`, `backfill.ts`, or `pending.ts`
    for test convenience.

- **D-115-04:** Delete the `c8 ignore` pragma at `import/execute.ts:214` by proving the
  production default path, not by keeping the exception. `stateLoader` currently carries
  `/* c8 ignore next -- production path; unit tests always inject deps.loadState */`.
  Add owner cases that call `importClaudeSettings` with no `deps` so each default
  resolver (`stateLoader`, `settingsLoader`, `addMarketplaceFn`, `installPluginFn`)
  executes for real. This is the only `c8 ignore` or `istanbul ignore` pragma in the
  entire `extensions/` tree, and the milestone contract forbids coverage exceptions.

### Supplemental ownership

- **D-115-05:** Absorb `tests/orchestrators/reconcile/notify-projection-edge.test.ts`
  into the `reconcile/notify.ts` owner and delete the file. It imports only
  `buildReconcileAppliedCascade` from a single module, so it is single-owner evidence.
  Its two cases (the `mp-remove-partial` bare failed header, and the `reasonAsContent`
  `"not added"` defensive fallback) are branches of `notify.ts` that the owner needs for
  complete direct coverage.

- **D-115-06:** Move `tests/orchestrators/reconcile/plan-convergence.test.ts` intact to
  `tests/integration/`. It composes `planReconcile`, `mergeScopeConfigs`,
  `buildConfigFromState`, and `domain/source.ts` into a cross-layer fixed-point identity
  that no single owner honestly owns. Keep its end-to-end identity; do not flatten it
  into an owner and do not add a correspondence-gate exception.

### Failure isolation

- **D-115-07:** Prove continue-after-failure with an exhaustive entry-kind by
  failure-mode matrix for both `import/execute.ts` and `reconcile/apply.ts`, rather than
  a representative sample. Every one of the 23 distinct public outcome kinds must be
  produced, and every cell asserts the COMPLETE aggregated result, not only its own row.
  - `reconcile/apply.ts` emits 15 outcome kinds: `invalid-block`, `mp-added`,
    `mp-add-failed`, `mp-removed`, `mp-remove-failed`, `mp-remove-partial`,
    `plugin-disabled`, `plugin-disable-failed`, `plugin-enabled`, `plugin-enable-failed`,
    `plugin-installed`, `plugin-install-failed`, `plugin-uninstalled`,
    `plugin-uninstall-failed`, `source-mismatch`.
  - `import/execute.ts` emits eight outcome types: `MarketplaceAddedOutcome`,
    `MarketplaceSkipOutcome`, `PluginInstalledOutcome`, `PluginSkipOutcome`,
    `ImportWarningOutcome`, `MarketplaceFailureOutcome`, `SourceMismatchOutcome`,
    `UnexpectedPluginFailureOutcome`.

- **D-115-08:** The matrix varies the COMPOSITION's inputs — which fault each entry hits
  and which outcome each collaborator returns — and asserts the composition's aggregated
  public reporting. It does not re-derive why a lifecycle workflow failed internally.
  Phase 114 owns those failure modes directly, and D-20 and D-22 forbid duplicating a
  single-module oracle. Each matrix cell provokes or injects one cause per outcome kind
  and then proves the composition's continuation, ordering, tally, and notification
  effect.

- **D-115-09:** Continuation must hold regardless of where the failing entry sits.
  Include a failing FIRST entry (proving the batch is not aborted) and a failing MIDDLE
  entry (proving the remainder is still processed and earlier commits stay intact) for
  each orchestrator.

### Producer contract for the reconcile cascade

- **D-115-10:** Give `addMarketplace`, `removeMarketplace`, and `uninstallPlugin` the
  mode-discriminated overload that `setPluginEnabled` already carries
  (`orchestrators/plugin/enable-disable.ts:570-575`), then delete the three now-impossible
  `if (result === undefined)` guards at `orchestrators/reconcile/apply.ts:204`, `:312`,
  and `:369`. That is what lets P115-05 reach 100 percent branch coverage.
  — **Reversibility:** costly — the overload is added to three production modules whose
  pairs are already complete; reverting means restoring both the signatures and the
  guards.

  Why the overload rather than deleting the guards alone: `result.status` is read
  immediately after each guard, so removing a guard without narrowing the producer's
  return type requires a non-null assertion, which silences the type system exactly where
  the producer contract needs enforcing. `enable-disable.ts:565` records the same
  reasoning for the same problem — the overload "makes that branch a compile error so the
  cascade always materialises a row."

  Scope note: this is a deliberate, operator-approved exception to DEL-03 ("supporting
  edits stay within the owning concern and do not change a second production pair").
  Overloads are type-level only, so runtime behavior does not change and the completed
  Phase 114 owner tests for `add.ts`, `remove.ts`, and `uninstall.ts` are expected to pass
  unmodified. Confirm that expectation rather than assuming it; if any of those three
  owner suites needs a change, stop and report instead of editing it silently.

### Claude's Discretion

- Case names, concern-local factories, and the exact fixture shapes.
- Whether the barrel keeps a named re-export or a combined export statement, provided
  production imports through it and no suppression remains.
- Plan waves and dependencies among the eight pairs, provided D-115-01 and D-115-02
  settle before the `import/index.ts` and `import/execute.ts` owners are finalized.
- The final integration filename for the relocated `plan-convergence` flow, provided it
  lives under `tests/integration/` and keeps its cross-module identity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/ROADMAP.md` — Phase 115 boundary, all eight source-test pairs, dependencies,
  success criteria, and plan inventory.
- `.planning/REQUIREMENTS.md` — `MOD-08`, `PRES-01`, and the case structure, assertion,
  double, direct coverage, pair-atomic delivery, and suite-quality rules.
- `.planning/PROJECT.md` — v1.19 intent and locked decisions for lowercase phases,
  alphabetical presentation, public-surface compatibility, passive typed data, and exact
  interaction verification.
- `.planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md` — D-01 through
  D-22, carried forward here rather than restated.

### Unit-testing contract

- `.claude/rules/typescript-unit-testing.md` — executable lowercase AAA, independent
  expectation, role-correct double, direct coverage, and hermetic filesystem rules.
- `docs/guidelines/typescript-unit-testing-guidelines.md` — normative rationale and full
  TypeScript examples for the same contract.
- `.claude/rules/typescript-comments.md` — comments cite decision and requirement IDs;
  planning-process references are forbidden.

### Gates this phase must satisfy

- `scripts/check-corresponding-tests.mjs` — the correspondence gate. Phase 115 owns four
  of its 18 current violations: `wrong-import` on `import/execute.test.ts`,
  `missing-test` on `import/index.test.ts`, and `unexpected-test` on both
  `reconcile/notify-projection-edge.test.ts` and `reconcile/plan-convergence.test.ts`.
- `.fallowrc.json` — `production: false` today, `includeEntryExports: true`, entry
  `extensions/pi-claude-marketplace/index.ts`, and the 13-zone boundary allow-list.
- `scripts/test-coverage-direct.mjs` — the direct per-pair coverage gate.

### Product and output contracts

- `.planning/inputs/unit-test-refactor-handoff/BEHAVIOR-CONTRACTS.yaml` — atomic write,
  retry, network, containment, and scope behavior authority.
- `.planning/inputs/unit-test-refactor-handoff/PUBLIC-SURFACE.yaml` — command, error,
  notification, reason, and typed-port authority.
- `docs/messaging-style-guide.md` — exact notification grammar, reason taxonomy,
  severity, scope, tally, trailer, and ordering rules.
- `docs/output-catalog.md` — accepted user-visible output and reload behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- All eight owner test files exist except `tests/orchestrators/import/index.test.ts`.
  Current sizes: `edge-deps` 837, `import/execute` 1487, `plugin/bootstrap` 404,
  `reconcile/apply` 2540, `reconcile/backfill` 1025, `reconcile/notify` 1247,
  `reconcile/pending` 769. None import shared fixtures from `tests/helpers/`.
- `createGitOpsFake` (`tests/platform/git-ops-fake.ts`) is the established network-edge
  double for composition suites that drive real orchestrators.
- Phase 114 directly proved `addMarketplace`, `setMarketplaceAutoupdate`,
  `installPlugin`, `uninstallPlugin`, `reinstallPlugin`, and `setPluginEnabled`. Those
  outcomes are inputs here, not subjects.
- Phase 113 directly proved `reconcile/plan.ts`, `reconcile/apply-outcomes.ts`,
  `reconcile/reconcile.messaging.ts`, `reconcile/types.ts`, and the five `import/`
  support modules. Their exported helpers are collaborators for this phase.

### Established Patterns

- `bootstrap.test.ts` and `apply.test.ts` already drive the real composed orchestrators
  against an `mkdtemp` root with only git faked, and assert committed bytes through
  `loadState`, `loadConfig`, and `locationsFor`.
- `import/execute.ts` resolves each injected collaborator through a small named resolver
  (`stateLoader`, `settingsLoader`, `addMarketplaceFn`, `installPluginFn`) that falls
  back to the production default when `deps` omits it.
- `reconcile/apply.ts` takes no injectable collaborator and reaches the lifecycle
  orchestrators directly.

### Integration Points

- `edge/handlers/plugin/import.ts` is the single production caller of
  `importClaudeSettings` and the file D-115-01 repoints. It also carries its own
  `ImportHandlerDeps` seam, which is separate from `ImportDeps` and is not in scope here.
- `index.ts` calls `applyReconcile` on `resources_discover`; reconcile behavior is
  observed there rather than through a command.
- `bootstrap.ts` is reached from `edge/handlers/plugin/bootstrap.ts`, whose own pair is
  Phase 116 work (P116-14).

</code_context>

<specifics>
## Specific Ideas

- The operator intends to set fallow `production` to `true` eventually. D-115-01 was
  chosen specifically because it is the only barrel outcome that is clean under both
  settings. Do not add suppressions that only hold under `production: false`.
- A probe of `fallow dead-code --production` currently reports 100 issues: two unused
  files (`orchestrators/import/index.ts`, `transaction/rollback.ts`), 81 unused exports
  across roughly 37 files, four unused type exports, one unused class member, four
  duplicate export pairs, and eight stale suppressions. The 81 unused exports are
  symbols whose only cross-file consumer is their owner test. That tension is structural
  to this milestone and is NOT Phase 115 work — do not try to solve it here.

</specifics>

<deferred>
## Deferred Ideas

- Flipping `.fallowrc.json` `production` to `true` and resolving the resulting 81
  unused-export findings — its own effort, owned by the operator, out of scope here.
- `transaction/rollback.ts` is the second file reported unreachable under a production
  probe. Not a Phase 115 pair; leave it alone.
- The five remaining `unexpected-test` violations that Phase 114 left in
  `tests/orchestrators/` (`marketplace/cascade.test.ts`,
  `plugin/cross-surface-reason-parity.test.ts`) and elsewhere
  (`bridges/integration-materialization-gate.test.ts`, `helpers/source-scan.test.ts`,
  `shared/device-flow-prompt.test.ts`, `shared/index-smoke.test.ts`,
  `edge/handlers/import.test.ts`, `edge/index-handler.test.ts`) belong to Phases 116 and
  117, which close the repository-wide gates.
- How `edge-deps.ts` proves its contract as a pure wiring module was raised but not
  discussed; left to research and planning.

</deferred>

---

*Phase: 115-Composition Orchestrators*
*Context gathered: 2026-09-01*

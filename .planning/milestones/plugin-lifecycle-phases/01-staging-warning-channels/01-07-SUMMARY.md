---
phase: 01-staging-warning-channels
plan: 07
subsystem: staging-warnings
status: complete
tags: [warnings, marketplace-update, autoupdate, apply, cascade, diagnostics, cucumber]
requires:
  - "01-01: features/plugin/staging-warnings.feature and its colliding-skill Given step"
  - "01-02: StagingDiagnostic and surfaceStagingDiagnostics in orchestrators/plugin/shared.ts; PluginUpdateOutcome `updated` arm stagingWarnings"
  - "01-05: the orchestrated `enabled` outcome's stagingWarnings"
  - "01-06: PluginUpdateFailedOutcome.stagingWarnings"
provides:
  - "surfaceCascadeStagingWarnings(ctx, run, outcomes, scope) in marketplace/update.messaging.ts, called once in refreshOneMarketplace between the cascade rows and the MCP notices (D-PL1-07, D-PL1-09)"
  - "PluginEnabledOutcome / PluginBackfilledOutcome / PluginConvergedOutcome: optional `stagingWarnings` (both halves, NREG-01)"
  - "carriedStagingWarnings(carrier) and stagingDiagnosticsOf(outcomes) in reconcile/apply-outcomes.ts (D-PL1-20)"
  - "convergedMoveOutcomes carries the runner's tagged warnings on its `updated` and `failed` arms (D-PL1-23)"
  - "apply renders the projected diagnostics between the install post-commit block and the MCP notices (D-PL1-09)"
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
tech-stack:
  added: []
  patterns:
    - "A carrier helper beside the outcome types lifts an optional member only when it is set (the carriedMcpConfigNotices precedent)"
    - "A cascade maps its outcomes to StagingDiagnostic entries and calls the one list renderer once"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - test/orchestrators/marketplace/update.messaging.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/reconcile/apply-outcomes.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - features/plugin/staging-warnings.feature
key-decisions:
  - "The marketplace helper picks the verb with one ternary (`updated` or `update failed`) after a partition guard. It does not copy update-flow's private switch, so fallow finds no new clone group."
  - "applyPluginToggles spreads `carriedStagingWarnings(result)` only on the enable arm (`result.status === \"enabled\" && ...`). The `disabled` arm of the enable-disable outcome has no `stagingWarnings` member, so passing the whole union fails TypeScript's weak-type check."
  - "stagingDiagnosticsOf uses an if-chain, not a switch with `default`. The project's switch-exhaustiveness rule (considerDefaultExhaustiveForUnions: false) rejects a partial switch over PerEntryOutcome."
  - "The three optional members are declared on each interface, not through a shared base interface, so no new exported type is needed."
requirements-completed: [WRN-02]
metrics:
  duration: "~1h"
  completed: "2026-10-27"
estimate:
  tokens: 115000
  tasks: 2
actuals:
  tokens: 6400
  tasks: 2
  commits: 2
commits: 2
plan_head_before: b68c68472803dcb61fb8680d356b6dd448bed089
plan_head_after: d915c14794cc8b302eaa4cfdcd1d150f2220862f
---

# Phase 1 Plan 07: Cascade staging warnings Summary

`marketplace update`, the autoupdate cascade, and `apply` now show a moved or
enabled plugin's skip lines. Each plugin gets one diagnostic after the
command's rows and before its MCP config notices, under
`Plugin "<name>" [<scope>] updated; ...` (`update failed` for a failed move,
`enabled` for an apply enable). This is the same placement rule the
standalone verbs use. Only the discovery half renders. The hygiene half stays
on the outcomes.

## Tasks

| Task | Name | Commit | Hook |
| ---- | ---- | ------ | ---- |
| 1 | Show each moved plugin's warnings after a marketplace update cascade | d8d46674 | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed (first attempt) |
| 2 | Show the warnings of apply's catalog moves and enables | d915c147 | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed (first attempt) |

`git show --stat d8d46674 -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
shows 2 insertions (one import member, one call), under the 4-line limit.

### Task 1 (D-PL1-07, D-PL1-08, D-PL1-09)

- `update.messaging.ts`: new exported `surfaceCascadeStagingWarnings(ctx, run, outcomes, scope)`
  and its private `cascadeStagingDiagnostic`. An `updated` outcome maps to
  verb `updated` and a `failed` one to `update failed`, with
  `stagingWarnings ?? []`. Every other partition maps to nothing. It calls
  `surfaceStagingDiagnostics` once, so only the discovery half renders.
- `update.ts::refreshOneMarketplace`: one call right after the cascade's
  `notifyWithContext` and before `notifyMcpConfigNotices`.
- Unit cases (literal bytes, whole notify sequences):
  - messaging: `failed`, `unchanged`, `skipped`, `updated` outcomes give
    the `update failed` and `updated` diagnostics in outcome order. The
    `updated` diagnostic has its two discovery lines and no hygiene line.
  - messaging: a hygiene-only `updated` outcome and a warning-free `failed`
    outcome give no notification.
  - update.test.ts (hermetic home): an autoupdate cascade gives the cascade
    row, then the `updated` diagnostic, then the MCP comments-removed notice.
- Scenario: "A marketplace update with autoupdate on reports a moved plugin's
  skip under its header".

### Task 2 (D-PL1-09, D-PL1-20, D-PL1-21, D-PL1-23)

- `apply-outcomes.ts`:
  - `PluginBackfilledOutcome`, `PluginEnabledOutcome` and
    `PluginConvergedOutcome` each get an optional
    `readonly stagingWarnings?: readonly StagingWarning[]`.
  - `carriedStagingWarnings(carrier)` sits beside
    `carriedMcpConfigNotices` and has the same NREG-01 shape.
  - `stagingDiagnosticsOf(outcomes)` projects:
    - converged: `updated`, or `update failed` when `row.status` is `failed`;
    - backfilled: `updated`;
    - enabled: `enabled`.

    Each entry keeps the outcome's own plugin and scope, in outcome order.
- `notify.ts::convergedMoveOutcomes`: spreads `carriedStagingWarnings(outcome)`
  on the `updated` and `failed` arms. `enabledMoveOutcome` is unchanged.
- `apply.ts`:
  - `applyPluginToggles` spreads the carrier on the enable arm.
  - `grownMoveOutcomes` spreads it on the `plugin-backfilled` outcome.
  - `reportScopePasses` calls
    `surfaceStagingDiagnostics(opts.ctx, opts.run, stagingDiagnosticsOf(outcomes))`
    between `surfacePostCommitWarnings` and `surfaceMcpConfigNotices`.
  - `runStep` is unchanged.
- Unit cases:
  - apply-outcomes: the carrier lifts both halves, and returns `{}` for an
    absent member. The projection maps an enabled, an updated converged, a
    failed converged and a backfilled outcome, and skips an `mp-added` and a
    `plugin-disabled` outcome.
  - notify: an `updated` move and a `failed` move each carry the runner's
    `[discovery, hygiene]` warnings.
  - apply (hermetic scopes, whole notify sequence):
    - a catalog move with a colliding skill gives the cascade, then the
      `updated` diagnostic;
    - one apply that installs `duo` (one agent post-install warning) and
      enables `hello` (colliding skill, MCP server over a commented adapter)
      gives the cascade, then the post-install block, then the `enabled`
      diagnostic, then the comments-removed notice.
- Scenarios: "Apply that moves a plugin to its catalog version reports the
  moved plugin's skip under its header", and "Apply that enables a plugin
  whose skills collide reports the skip under its header".

## Scenario failures before each change

All three scenarios are in `features/plugin/staging-warnings.feature`.

- **Marketplace update cascade:** on the unchanged code it failed at
  `the command reports these results:`. Only the `cascade` result came out,
  with no `diagnostic` row after it. It passes after Task 1.
- **Apply catalog move** and **apply enable:** on the code after Task 1
  (before Task 2) both failed at `the command reports these results:`. The
  `reconcile-applied-cascade` row matched, and the `diagnostic` row was
  missing. Both pass after Task 2. For a correct table I added the tally
  columns, and I changed the last step to
  `the results list these marketplaces and plugins:`, because the command
  now emits two results. Neither change touched the failing step's
  diagnostic expectation.

## Verification

Every check ran unpiped, and I read each exit code.

- `npm run typecheck`: exit 0 after each task.
- Owner tests:
  - Task 1: `update.messaging.test.ts` and `update.test.ts`, 152 pass,
    0 fail.
  - Task 2: `apply-outcomes.test.ts`, `notify.test.ts` and `apply.test.ts`,
    327 pass, 0 fail.
- `npm run test:coverage:direct`: exit 0 (100%) for `update.messaging.ts`
  and `update.ts`, and for `apply-outcomes.ts`, `notify.ts` and `apply.ts`.
- ESLint on every touched source and test file: exit 0. Task 1 had one
  `import-x/order` finding in the messaging test, fixed with `--fix`.
- `npm run fallow`: exit 0 after each task (dead code, cycles, health,
  dupes).
- `npx cucumber-js` over `staging-warnings.feature` (10 scenarios),
  `apply.feature`, `reconcile.feature`, `autoapply.feature`,
  `enable.feature` and `features/marketplace/update.feature`: 189 scenarios,
  2315 steps, all passed.
- `npm run check:features`: exit 0.
- `SKIP=npm-check pre-commit run --files <task files>`: exit 0 before each
  commit.
- Acceptance greps:
  - `surfaceStagingDiagnostics(` in update.messaging.ts: 1.
  - `export function carriedStagingWarnings` in apply-outcomes.ts: 1.
  - `carriedStagingWarnings(` in notify.ts: 2.
  - `stagingWarnings|StagingDiagnostic` inside `runStep`: 0.
  - `stagingWarnings` inside `enabledMoveOutcome`: 0.
- The full `npm run check` gate was not run here; the orchestrator owns it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The enable carrier spread needs a status guard**

- **Found during:** Task 2
- **Issue:** `carriedStagingWarnings(result)` on the whole
  `EnableDisablePluginOutcome` union failed `tsc` (TS2345, weak-type check).
  The `disabled` arm shares no property with `{ stagingWarnings? }`.
- **Fix:** `...(result.status === "enabled" && carriedStagingWarnings(result))`,
  with a one-line D-PL1-09 comment. It is still one spread in
  `applyPluginToggles`. It adds one boolean operator, and fallow health and
  ESLint stay green. The plan's context said every addition is "a plain call
  or a spread of a helper's result". This one is a guarded spread.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
- **Commit:** d915c147

### Plan notes

- The skill-collision bytes in the apply unit tests depend on the order of
  the directory names. `hello-tool` sorts before `tool`, so `tool` is the
  skipped source. `widget-tool` sorts after `tool`, so `widget-tool` is the
  skipped source. The two cases assert those runtime bytes.
- `apply.test.ts` gained a small `collidingSkill(marketplaceRoot, plugin)`
  helper, which writes the second skill. I did not add a `PluginTree` flag,
  so `writePluginTree` is unchanged.

## Backlog dispositions

- **UPCASC-01:** closed. Plan 01-01 settled the header half (the bracketed
  scope on every verb). This plan settled the cascade half: the
  `marketplace update` cascade, the autoupdate cascade (the same code path),
  and `apply`'s catalog moves and enables now render each plugin's discovery
  warnings with the D-PL1-07 placement rule. The reconcile backfill that
  UPCASC-01 names no longer exists. A growth move now goes through the
  update runner, and `grownMoveOutcomes` carries its warnings (D-PL1-09).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-15 holds: both cascades render only through `surfaceStagingDiagnostics`,
which sends only the discovery half to `surfaceDiscoveryWarnings`, and that
function redacts absolute paths (NFR-9). The hygiene-only unit cases assert
that no diagnostic is sent. The scenarios assert the redacted `in "skills"`
bytes. T-01-16 is accepted as planned: there is one diagnostic per moved or
enabled plugin with discovery warnings.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
- FOUND: features/plugin/staging-warnings.feature
- FOUND: d8d46674 (ancestor of HEAD)
- FOUND: d915c147 (ancestor of HEAD)

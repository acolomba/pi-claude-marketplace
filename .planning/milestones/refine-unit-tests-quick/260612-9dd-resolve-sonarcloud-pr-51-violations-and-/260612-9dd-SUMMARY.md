---
phase: quick-260612-9dd
plan: 01
status: complete
subsystem: code-quality
tags: [sonar, cpd, refactor, byte-neutral]
requires: []
provides:
  - "Shared `openMarketplaceCommand` helper for marketplace add/remove handlers"
  - "Shared `applyPluginToggles` helper for reconcile enable/disable"
  - "Shared `cascadeSeverity` helper for the 4-arm notify ladder"
  - "File-local `RecordedSourceKind` alias in marketplace/remove.ts"
affects:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
tech-stack:
  added: []
  patterns:
    - "Builder-closure parameterization for variant construction across a discriminated outcome union"
    - "Structural-subset parameter typing for byte-neutral notify-shape folds"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/persistence/config-write-back.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
decisions:
  - "Use builder closures (`buildSuccess` / `buildFailed`) for the fold-1 helper rather than literal-string kind axes -- TS could not narrow the discriminated `PerEntryOutcome` union from a union-typed `kind` parameter, and the plan explicitly preferred a factory-function shape over `as` casts."
  - "Widen the `cascadeSeverity` structural-subset param so `status?: string | undefined` -- required under tsconfig's `exactOptionalPropertyTypes: true` to accept `MpList` (the list-status variant) without a cast."
metrics:
  duration: ~35m
  completed_date: 2026-06-12
---

# Quick Task 260612-9dd: Resolve SonarCloud PR #51 violations and CPD folds Summary

Resolved the 13 SonarCloud violations and 3 CPD duplication sets reported on
PR #51 across three atomic commits, leaving every catalog-uat byte-equality
gate and the notify-v2 byte-form suite GREEN.

## What changed

Three commits, each `npm run check` GREEN at the tip:

| Commit    | Title                                                                  | Files | Net lines |
| --------- | ---------------------------------------------------------------------- | ----- | --------- |
| `f11de48` | refactor(sonar): resolve 13 PR #51 violations                          | 5     | +15 / -15 |
| `17a0e97` | refactor(cpd): fold reconcile apply toggles + cascade severity ladder  | 2     | +96 / -124 |
| `7fa0a2c` | refactor(cpd): fold marketplace edge handler opening parse             | 3     | +78 / -58 |

### Task 1 (`f11de48`) -- 13 SonarCloud violations

Four mechanical rewrites at the locked sites:

- **S7744 x9** "useless empty-object spread": dropped `?? {}` from 9
  `{ ...(x ?? {}) }` spread sites in `orchestrators/import/execute.ts`
  (lines 917, 924) and `persistence/config-write-back.ts` (lines 62, 78,
  118, 135, 174, 180, 182). The `Object.entries(x ?? {})` calls elsewhere
  in the same files were left untouched -- there the `?? {}` is load-bearing
  because `Object.entries(undefined)` throws.
- **S3863 x1** "imported multiple times": merged the two adjacent
  `notify.ts` type imports in `orchestrators/reconcile/apply-outcomes.ts`
  into one alphabetical-member import.
- **S4323 x2** "repeated union type": introduced a file-local
  `type RecordedSourceKind = "github" | "path" | "unknown"` near the top
  of `orchestrators/marketplace/remove.ts` and substituted at the three
  flagged sites (return type at line ~433, const annotation at line ~463,
  let declaration at line ~603).
- **S3626 x1** "redundant jump": deleted the redundant `return;` at the
  tail of the enable arm in `orchestrators/reconcile/plan.ts`. The trailing
  `// Declared-enabled, recorded, populated: steady state, no action.`
  comment is preserved.

### Task 2 (`17a0e97`) -- Folds 1 + 2

**Fold 1 -- `apply.ts` plugin enable/disable.** Replaced the parallel
`applyPluginEnables` / `applyPluginDisables` loops with one shared
`applyPluginToggles` helper parameterized on five axes: the input ops list,
the `enable` boolean passed to `setPluginEnabled`, the `successStatus`
literal expected back, and two builder closures (`buildSuccess` /
`buildFailed`) that return the correctly-narrowed `PerEntryOutcome`
discriminated-union variant. The try/catch + `classifyOrchestratorThrow`
failure path appears once in the helper.

The builder-closure shape was chosen over union-typed string axes after a
typecheck deviation (Rule 3): a parameter typed
`successKind: "plugin-enabled" | "plugin-disabled"` cannot narrow the
constructed object back to a single discriminated-union member, so
`outcomes.push({ kind: axes.successKind, ... })` failed to type-check
against `PerEntryOutcome`. The plan explicitly sanctioned a factory-function
fallback over `as` casts.

**Fold 2 -- `notify.ts` cascade severity ladder.** Extracted the 4-arm
first-match ladder (D-28-08 / D-28-09) into a file-private `cascadeSeverity`
helper typed over a structural-subset shape -- the parameter accepts any
message whose `marketplaces[]` carries `status?`, `reasons?`, and a
`plugins[]` with the same shape, so both `reconcileAppliedSeverity`
(`ReconcileAppliedCascadeMessage`) and `computeSeverity`'s cascade arm
(`CascadeNotificationMessage`) can delegate to it. The per-arm
D-28-08 / D-28-09 explanatory comments are colocated at the helper, not
duplicated at the call sites. `reconcileAppliedSeverity` survives as a
1-line forwarder because its JSDoc carries load-bearing
empty-and-clean-cascade short-circuit context (NFR-2 / A4).

The structural-subset param uses `status?: string | undefined` and
`reasons?: readonly Reason[] | undefined` because `tsconfig.json` has
`exactOptionalPropertyTypes: true`, so an optional-without-undefined
shape would reject `MpList` (the list-status variant where `status`
is absent).

### Task 3 (`7fa0a2c`) -- Fold 3

Extracted the byte-identical opening prologue of `makeAddHandler`
(add.ts) and `makeRemoveHandler` (remove.ts) into a shared
`openMarketplaceCommand<N extends string>` helper in
`edge/handlers/marketplace/shared.ts`. The helper runs:

1. **WB-01** -- `extractLocalFlag` BEFORE positional parsing (matches the
   enable-disable handler shape).
2. **`parseCommandArgs`** with the single positional name supplied by the
   caller (`"source"` for add, `"name"` for remove).
3. **MSG-NC-2** -- the duplicate-usage substitution
   (`message === USAGE ? "Missing required argument." : message`) routed
   through `notifyUsageError`.

The literal `N` parameter lets each call site read the positional value
without a cast (`opened.source` in add, `opened.name` in remove). The
WB-01 and MSG-NC-2 rationale comments now live once at the helper.

## Verification

- `npm run check` GREEN at every commit tip:
  **typecheck + eslint + prettier + 1810 unit + 10 integration**.
- Catalog-uat byte-equality gate GREEN at every tip -- no rendered
  output bytes shifted across any of the three commits.
- Notify-v2 byte-form suite GREEN at every tip.
- 9 `{ ...(x ?? {}) }` spread sites verified gone from the 5 listed line
  ranges (manual grep + typecheck).
- `apply-outcomes.ts` now has one merged `import type { ContentReason,
  Dependency, Reason }` instead of two adjacent imports.
- `remove.ts` `RecordedSourceKind` alias defined once and used at the 3
  call sites.
- `plan.ts` redundant `return;` deleted; explanatory comment retained.
- `apply.ts` has one shared `applyPluginToggles` helper; the inner
  try/catch + outcome-push body appears ONCE.
- `notify.ts` has one shared `cascadeSeverity` helper; the 4-arm ladder
  body appears ONCE.
- `add.ts` and `remove.ts` no longer each contain a
  `parseCommandArgs(localFlag.residualArgs, ...)` call -- both call
  `openMarketplaceCommand` instead.

Pre-commit hooks ran clean on every commit (no `--no-verify`, no
`SKIP=` -- working tree mode, not worktree).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Builder closures instead of union-typed kind axes (Task 2 / Fold 1)**

- **Found during:** Task 2 typecheck.
- **Issue:** First implementation parameterized the helper on
  `successKind: "plugin-enabled" | "plugin-disabled"` and `failedKind:
  "plugin-enable-failed" | "plugin-disable-failed"` literal-union strings.
  TS strict + `exactOptionalPropertyTypes` would not narrow
  `outcomes.push({ kind: axes.successKind, ... })` to a single
  `PerEntryOutcome` discriminated-union variant -- the constructed object
  type was the cross product, not the discriminated narrowing.
- **Fix:** Replaced the union-string axes with `buildSuccess(info) =>
  PerEntryOutcome` / `buildFailed(info) => PerEntryOutcome` closures. Each
  call site supplies a single-literal-kind factory
  (`(info) => ({ kind: "plugin-enabled", ...info })`) so TS narrows at
  the construction site, not inside the helper. The plan explicitly
  sanctioned this fallback over `as` casts.
- **Files modified:** `orchestrators/reconcile/apply.ts`.
- **Commit:** `17a0e97`.

**2. [Rule 3 - Blocking issue] `status?: string | undefined` for the cascade-severity structural-subset param (Task 2 / Fold 2)**

- **Found during:** Task 2 typecheck.
- **Issue:** First implementation typed the structural-subset param as
  `status: string` (required). `MarketplaceNotificationMessage` includes
  the `MpList` variant where `status` is absent, so passing
  `ReconcileAppliedCascadeMessage` / `CascadeNotificationMessage` to the
  helper failed under `exactOptionalPropertyTypes: true` with
  `Type 'undefined' is not assignable to type 'string'`.
- **Fix:** Widened the param to `status?: string | undefined` and
  `reasons?: readonly Reason[] | undefined`. The behavior is unchanged:
  the existing arms test `mp.status === "failed"` and
  `mp.status === "skipped"`, both of which return false for undefined
  (the correct semantic for the list variant -- a list message has no
  status to fail on).
- **Files modified:** `shared/notify.ts`.
- **Commit:** `17a0e97`.

Both deviations were Rule 3 (blocking TS strict). No architectural change;
no behavior change; catalog-uat + notify byte-form gates remained GREEN
through both adjustments.

## Self-Check: PASSED

Verified each commit hash exists in `git log --oneline`:

- `f11de48`: FOUND -- refactor(sonar): resolve 13 PR #51 violations
- `17a0e97`: FOUND -- refactor(cpd): fold reconcile apply toggles + cascade severity ladder
- `7fa0a2c`: FOUND -- refactor(cpd): fold marketplace edge handler opening parse

Verified all 10 modified files still exist on disk:

- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`: FOUND
- `extensions/pi-claude-marketplace/persistence/config-write-back.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`: FOUND
- `extensions/pi-claude-marketplace/shared/notify.ts`: FOUND
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts`: FOUND
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts`: FOUND
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts`: FOUND

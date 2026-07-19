---
quick_task: 260612-bcs-fix-pr-51-five-agent-review-findings
sub_plan: 04
commit: cfc414c
status: complete
byte_contract: byte-neutral (no docs/output-catalog.md edit)
requirements_closed:
  - Y1
  - Y2
  - Y4
  - Y5
  - Y6
---

# Sub-plan 04 closure: reconcile + persistence type-design cuts

One atomic Conventional Commit (`cfc414c`) on `features/v1.12-config-files`,
byte-neutral on existing catalog fixtures, `npm run check` GREEN,
catalog-uat byte gate GREEN with NO `docs/output-catalog.md` edit.

## Findings closed

- **Y1 — `samePlannedSource` tri-state union.**
  `domain/source.ts::samePlannedSource` now returns the literal union
  `"same" | "different" | "unknown-stored"` (exported as
  `SamePlannedSourceResult`) instead of the prior
  `boolean | "unknown-stored"` shape. Truthy coercion of the discriminant
  (a corrupt record silently misreading as a source match) is now a
  compile-time type error.

  Updated call sites:
  - `orchestrators/reconcile/plan.ts::findRecordedBySource` —
    `=== true` becomes `=== "same"`.
  - `orchestrators/reconcile/plan.ts::diffMarketplaces` — `if (match === true)`
    /`if (match === "unknown-stored")`/fallthrough cascade replaced with an
    exhaustive `switch (match)` over the three discriminants.
  - `orchestrators/import/execute.ts::ensureMarketplacesPresent` — the prior
    `if (sourceMatch === "unknown-stored") ... else if (sourceMatch) ... else`
    truthy ladder (the original Y1 footgun: `"unknown-stored"` IS truthy)
    replaced with an exhaustive `switch` over `"same" | "different" |
    "unknown-stored"`.

  New tests in `tests/domain/source.test.ts` exercise: same / different /
  unknown-stored returns, exhaustive `switch` with `assertNever`-style
  default arm, and a sanity assertion that the result is one of the three
  literal members.

- **Y2 — `PlannedSourceMismatch` widened to four per-cause variants.**
  `orchestrators/reconcile/types.ts::PlannedSourceMismatch` is now a
  four-variant discriminated union:

  | Cause | Required fields | Renderable subject |
  | ----- | --------------- | ------------------ |
  | `source-mismatch` | `marketplace`, `declaredSource`, `recordedSource` | `marketplace` |
  | `unknown-stored` | `marketplace`, `declaredSource`, `recordedSource` | `marketplace` |
  | `dangling-reference` | `marketplace`, `plugin` (REQUIRED) | `marketplace` |
  | `malformed-plugin-key` | `rawKey` (NOT a punned `marketplace`) | `rawKey` |

  The fused 2-discriminant shape was overloading sentinel strings
  (`"<marketplace not declared>"`, `"<malformed plugin key>"`) onto
  `recordedSource` and punning `marketplace` as a raw config-key carrier
  for malformed keys. The per-cause variants close those misreads at the
  type level. A new helper `plannedSourceMismatchSubject(mm)` centralises
  the renderable-subject derivation.

  Propagated to `apply-outcomes.ts::SourceMismatchOutcome`, which now
  carries the same four-variant discriminated union (no longer extending
  `OutcomeBase` since the malformed variant has no `marketplace` field).
  A parallel `sourceMismatchOutcomeSubject(outcome)` helper covers the
  apply-cascade renderer.

  Renderer updates:
  - `notify.ts::applySourceMismatch` — checks `cause === "dangling-reference"`
    explicitly to push the plugin child row (the other three causes leave
    children empty).
  - `notify.ts::buildReconcilePreviewNotification` — keys the
    `(scope, name)` block via `plannedSourceMismatchSubject(o)`.
  - `notify.ts::applyOutcomeToBlock` — checks
    `outcome.cause === "dangling-reference"` for the plugin-child arm.
  - `notify.ts::outcomeSubject` (new) — derives the keying subject for
    every per-entry outcome variant, including `invalid-block` (Y4) and
    `source-mismatch` of cause `"malformed-plugin-key"`.
  - `apply.ts::applySourceMismatches` — per-cause `switch` lifts the
    planner variant onto the corresponding outcome variant.

  New byte-equality tests in `tests/orchestrators/reconcile/notify.test.ts`:
  parameterized tables over all four causes for both the preview and the
  applied cascade projections, asserting `status="failed"` + `reasons=
  ["source mismatch"]` + correct subject + correct plugin children for
  each variant. The catalog-uat byte gate is the end-to-end byte-equality
  proof.

  Existing tests in `tests/orchestrators/reconcile/plan.test.ts` updated
  to the new variant shapes (narrow on `cause` first, then read the
  variant-specific fields).

- **Y4 — `InvalidBlockOutcome.marketplace` renamed to `basename`.**
  `apply-outcomes.ts::InvalidBlockOutcome` no longer extends `OutcomeBase`
  (which would force a `marketplace` field). The basename-carrying field
  is now `basename`, making the "this is a file name, not a marketplace
  name" contract explicit at the type level.

  Updated push sites:
  - `apply.ts::readPassForScope` — base + local CFG-03 invalid arms
    push `basename: path.basename(outcome.{base,local}.filePath)`.
  - `apply.ts::applyReconcile` per-scope catch — read-pass throw arm
    pushes `basename: isMigrateSave ? path.basename(err.configFilePath)
    : "state.json"`.

  Renderer update:
  - `notify.ts::applyOutcomeToBlock` invalid-block arm — synthetic
    cause-chain child row now derives its name from `outcome.basename`.
  - `notify.ts::outcomeSubject` (new) — invalid-block branch returns
    `outcome.basename` so the block-keying uses the renamed field.

  Catalog UAT byte-equality preserved; new
  `tests/orchestrators/reconcile/notify.test.ts` test pins the rename
  byte form by asserting the rendered block's `name === basename` plus
  the synthetic plugin-row's `name === basename`.

- **Y5 — `MigrateFirstRunResult` cut along the `reason` discriminant.**
  `persistence/migrate-config.ts::MigrateFirstRunResult` is now a
  four-variant union with `error` declared ONLY on the
  `existing-invalid` arm:

  ```ts
  | { migrated: true;  entryCount: number; filePath: string }
  | { migrated: false; reason: "existing-valid";   filePath: string }
  | { migrated: false; reason: "existing-invalid"; error: string; filePath: string }
  | { migrated: false; reason: "empty-state";      filePath: string }
  ```

  The prior shape had `error?: string` on every `migrated: false` arm,
  inviting callers to read `error` without first narrowing on `reason`.
  The cut forces every consumer to narrow.

  Updated existing tests in `tests/persistence/migrate-config.test.ts`
  to narrow on `reason === "existing-invalid"` before reading
  `result.error`. Added a new Y5 test that uses `@ts-expect-error`
  comments to assert at the type level that reading `.error` on the
  three non-`existing-invalid` arms is a compile error.

- **Y6 — `PluginToggleAxes.successStatus` derived from `enable`.**
  `apply.ts::PluginToggleAxes` dropped the `successStatus` field;
  `applyPluginToggles` now derives `successStatus = axes.enable ?
  "enabled" : "disabled"` from `enable` inside the function. The two
  call sites for `pluginsToEnable` / `pluginsToDisable` no longer pass
  a `successStatus` axis. The (enable, successStatus) inconsistency
  footgun (e.g. `enable: true` + `successStatus: "disabled"`) is closed
  by construction.

  No new test required (axis derivation is a refactor that the existing
  toggle tests cover end-to-end).

## Out of scope (deferred to later sub-plans)

- Y3 (`setPluginEnabled` mode-blind `| undefined` return; overload pair
  + remove dead `continue` in apply.ts:625-627) — **Plan 05**.
- All other findings (C1, I1-I5, T1-T6, Y7, S1-S10, comments/docs) —
  deferred to Plans 02 (already landed), 05, 06, 07 per the INDEX.

## Verification

- `npm run check` — GREEN (typecheck + ESLint + Prettier + 1837 unit
  tests + 10 integration tests).
- `tests/architecture/catalog-uat.test.ts` — 4/4 PASS (byte-neutral
  contract upheld; no `docs/output-catalog.md` edit).
- `pre-commit run --files <changed files>` — GREEN
  (trufflehog scan included; not in a worktree).

## Commit

```
cfc414c refactor(reconcile): cut samePlannedSource + PlannedSourceMismatch types
```

## Files changed (all in this commit)

- `extensions/pi-claude-marketplace/domain/source.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`
- `extensions/pi-claude-marketplace/persistence/migrate-config.ts`
- `tests/domain/source.test.ts`
- `tests/orchestrators/reconcile/notify.test.ts`
- `tests/orchestrators/reconcile/plan.test.ts`
- `tests/persistence/migrate-config.test.ts`

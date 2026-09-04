# Orchestrators — reconcile notify, backfill, pending, types

**Scope:** `tests/orchestrators/reconcile/{notify,backfill,pending,types,reconcile.messaging}.test.ts`
and their paired production modules under
`extensions/pi-claude-marketplace/orchestrators/reconcile/{notify,backfill,pending,types,reconcile.messaging}.ts`
**Test files reviewed:** 5 (5,272 lines)
**Production modules reviewed:** 5 (2,234 lines)

## Summary

This area is in good shape. Every case in all five files uses `// arrange` /
`// act` / `// assert`, compares whole values with `assert.deepStrictEqual`
against hand-written literals (never a value the production code itself
produced), and the two filesystem-heavy suites (`backfill.test.ts`,
`pending.test.ts`) drive real `mkdtemp` trees with per-case cleanup and prove
the NFR-5 offline/silent-boundary contracts with `strong-mock` mocks that
carry no expectations (a legitimate "this port is never touched" proof). The
"dumb renderer" rule holds throughout: `reconcile/notify.ts` and
`reconcile.messaging.ts` never call `ctx.ui.notify` or `pi.*`, and every
render function takes its soft-dependency probe as a parameter instead of
computing it. Severity is asserted as a tri-state everywhere a status is
asserted, and the output-row grammar (`<glyph> <name> [scope] (status)
{reason}`) is honored in every rendered-string test.

The three things a fixing pass should attack first: (1) two static-analysis-identified
branches with no exercising test case — one in `notify.ts`'s defensive
`reasonAsContent` fallback, two in `backfill.ts`'s offline-resolve path — that
should be confirmed against the real coverage tool and closed; (2) a
byte-for-byte duplicated "hermetic HOME/PI_CODING_AGENT_DIR scope" helper
between `backfill.test.ts` and `pending.test.ts` that is exactly the class of
duplication the codebase already extracted once (`tests/edge/notification-boundary.ts`,
per its own WR-08 rationale) and should be extracted the same way; (3) a
couple of minor naming/import-form nits in `notify.ts` and `backfill.ts`.

## Unit test findings

### `tests/orchestrators/reconcile/notify.test.ts`

- **[BLOCKER] `reasonAsContent`'s defensive sentinel-mapping branch is never exercised** — production `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:916-935`.
  `reasonAsContent` takes the broad `Reason` type (not `ContentReason`) specifically
  because `PerEntryOutcome`'s failure variants (`MpAddFailedOutcome.reason`,
  `MpRemoveFailedOutcome.reason`, `PluginInstallFailedOutcome.reason`, etc., all
  typed `Reason` in `apply-outcomes.ts`) can legally carry the structural
  sentinels (`"marketplace not added"` and its two scope-qualified siblings),
  and the function maps all three to `["not found"]`. No row in
  `appliedOutcomeRows()` (`notify.test.ts:59-419`) or any other case in the
  `buildReconcileAppliedCascade` describe block constructs an outcome whose
  `.reason` is one of these three sentinels, so this branch has no test
  driving it — a plausible wrong implementation (e.g. one that dropped the
  `if` and always returned `[reason]`, silently rendering the raw structural
  sentinel as a content reason) would still pass every existing case.
  Add a case, e.g. `{ kind: "mp-add-failed", scope: "project", marketplace:
  "mp", reason: "marketplace not added" }` -> expect the block's `reasons` to
  be `["not found"]`; the type system already permits constructing this
  outcome literal, so no cast is needed. Cover all three sentinel members or
  state explicitly why one case suffices (they all take the same `if` arm).

- **[WARNING] `subject` variable name** — `tests/orchestrators/reconcile/types.test.ts:357,372` (shared file, cross-referenced from notify.test.ts's sibling coverage discussion; the actual instances are in types.test.ts, see that file's findings below). No action needed here; listed once, under `types.test.ts`.

### `tests/orchestrators/reconcile/backfill.test.ts`

- **[BLOCKER] Two offline-resolve branches in `backfill.ts` have no case driving them** — production `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:332` and `:440`.
  1. `maybeBackfillPlugin`'s guard `if (resolved === undefined || resolved.state
     === "unavailable")` (`backfill.ts:332`) is only ever driven down the
     `undefined` arm in this suite (`writeMarketplaceSource` always emits a
     manifest that either declares the plugin or omits it entirely — see
     `SF-02: skips a recorded plugin the cached manifest no longer declares`).
     No case constructs a plugin root that resolves structurally
     `"unavailable"` (e.g. a `plugin.json` whose declared `name` does not match
     the manifest entry, or a plugin root missing `.claude-plugin/plugin.json`
     while still being *found* by name in the manifest).
  2. `resolveRecordedPluginOffline`'s `!PLUGIN_ENTRY_VALIDATOR.Check(entry)` arm
     (`backfill.ts:440`) is never driven either — every manifest entry written
     by `writeMarketplaceSource` is schema-valid; no case writes a manifest
     entry that is *found by name* but fails the plugin-entry validator (e.g.
     a `version` of the wrong type, or a missing required field).
  Add one case per branch: a manifest entry that resolves `"unavailable"`
  (distinct from the already-covered "entry absent" case), and a manifest
  entry present-but-schema-invalid. Both should assert `outcomes` stays
  `[]` and `anyFailure` is `false` (matching `maybeBackfillPlugin`'s comment
  that both are "benign skip", not failures) — that is itself the
  discriminating claim a wrong implementation (e.g. one that let a malformed
  entry propagate as a `plugin-install-failed` row) would fail. I did not run
  `npm run test:coverage:direct` to confirm these are genuinely uncovered
  (the diagnostic-review rules for this sweep forbid running test/build
  commands) — this is from static tracing of every case's fixture shape
  against the two `if` conditions; confirm with the coverage tool before
  treating this as closed.

- **[WARNING] Byte-for-byte duplicated hermetic-scope helper** — `tests/orchestrators/reconcile/backfill.test.ts:96-127` (`createHermeticProjectScope`) vs `tests/orchestrators/reconcile/pending.test.ts:42-70` (`createHermeticScopes`).
  Both functions do the identical thing (mkdtemp a cwd + a HOME, save/restore
  `HOME` and `PI_CODING_AGENT_DIR` around the case via `t.after`, same SC-1
  comment verbatim, same delete-if-absent/restore-if-present logic) and differ
  only in the tmp-dir prefix string and whether the return value carries one
  scope's `ScopedLocations` or both. This is exactly the class of duplication
  `tests/edge/notification-boundary.ts` was already extracted to fix (its own
  header: "four suites carried byte-identical copies of this factory... one
  shared definition breaks once instead of four suites drifting apart").
  Extract one shared function (e.g. a project-scope variant plus a
  project+user variant, or a single function returning both `ScopedLocations`
  that `backfill.test.ts` narrows) into a module co-located with the
  `reconcile` test concern (not a generic `tests/helpers/`), mirroring how
  `tests/orchestrators/plugin/scope-tree-inventory.ts` and
  `tests/edge/notification-boundary.ts` are scoped to their concern.

### `tests/orchestrators/reconcile/pending.test.ts`

- **[WARNING] Duplicated hermetic-scope helper** — see the `backfill.test.ts`
  finding above (`createHermeticScopes` at `pending.test.ts:42-70` is the
  other half of the duplicate). Fix once, in the shared location.

Otherwise clean: every case sizes the `ctx`/`pi`/`ui` boundary with exact
`times()` via `createNotificationBoundary`, every rendered message is compared
whole against a hand-written literal, the CFG-03 / MIG-01 / FSTAT-06 branch
matrices are each covered on both sides of every `if` I traced (invalid
base vs. invalid local; absent-base-with-local-valid vs.
absent-base-with-local-absent; candidate found-and-degrades vs.
found-and-clean vs. not-recorded vs. manifest-unparseable vs.
entry-not-in-manifest), and no test asserts anything resembling a deep diff
against on-disk artifacts — every plan is built from declared config vs.
recorded state, never from a scan of materialized files.

### `tests/orchestrators/reconcile/types.test.ts`

- **[WARNING] `subject` as a variable name** — `types.test.ts:357,372`.
  `const subject = plannedSourceMismatchSubject(mismatch);` uses a name the
  skill's naming rule lists as a generic placeholder finding. It is
  borderline here because it echoes the production function's own
  vocabulary (`types.ts`'s doc comment for `plannedSourceMismatchSubject`
  calls its return value "the renderable subject"), but a reader skimming
  just the test still benefits more from a name tied to the concrete case
  (`mismatchSubject` or `renderedSubject`). Rename both occurrences.

This file is correctly a hybrid, not a pure type-only module: `types.ts`
exports two runtime functions (`plannedSourceMismatchSubject`,
`emptyReconcilePlan`) alongside its type surface, so `types.test.ts`
appropriately carries both the `satisfies`/`@ts-expect-error` compile-time
matrix (thorough — every interface's required fields, forbidden fields, and
the `PlannedSourceMismatch` closed cause vocabulary are each negatively
tested, plus a mapped-type `IsMutableArray` check proving every bucket is
`readonly`) and real runtime tests for the two functions (including a
`Set`-of-14-references check proving `emptyReconcilePlan` shares no bucket
array across two calls). This is not the "filler runtime assertions on a
type-only module" anti-pattern the brief warns about — it is complete,
targeted coverage of the module's actual runtime surface.

The module-scope `mock<ExtensionContext>`/`mock<ExtensionApi>`/`mock<GitOps>`
values (`types.test.ts:32-40`) are never invoked, given `when()`, or
`verify()`d — they exist purely as compile-time-checked placeholder values for
the `satisfies ApplyReconcileOptions` assertions below them, which is a
reasonable way to get a fully-typed dummy value without an unsafe cast. Not a
finding.

### Clean files

- `tests/orchestrators/reconcile/reconcile.messaging.test.ts` — every render
  arm of `PENDING_CONTEXT` and `RECONCILE_APPLIED_CONTEXT` is exercised at
  least once, expected strings are hand-written literals (never built by
  calling `joinTokens`/`renderVersion`/etc.), the immutability of the input
  message is explicitly asserted after render calls, and the three
  `@ts-expect-error` negatives correctly close the pending-vs-applied status
  cross-contamination gap.

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`

- **[WARNING] Single-letter loop/parameter naming** — `notify.ts:225` (the
  `o` parameter of `pushMarketplaceRemoveCascade`) and the per-bucket loops in
  `buildReconcilePendingNotification` at `notify.ts:370,374,381,399,407,415`.
  Every one of these binds a `PlannedX` variant to `o` where the sibling
  function `applySourceMismatch` (`notify.ts:189`) names the same kind of
  value `mismatch`. Rename each to what it is: `removal`, `mismatch`
  (`pushMarketplaceRemoveCascade`'s call site already has one available),
  `install`, `uninstall`, `disable`, `enable`. This is style-only —
  `pushMarketplaceRemoveCascade`'s body is ~10 lines so it is not a
  correctness risk, but the inconsistency with its neighboring function's
  naming makes the file harder to skim.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`

- **[WARNING] Inline `import()` type instead of a top-level `import type`** —
  `backfill.ts:437`: `Promise<import("../../domain/resolver.ts").ResolvedPlugin
  | undefined>`. The file already has a value import from that exact module
  (`import { resolveStrict } from "../../domain/resolver.ts";` at line 16), so
  there is no circular-import or ordering reason to inline the type. Add
  `ResolvedPlugin` to a top-level `import type { ... } from
  "../../domain/resolver.ts";` and drop the inline form.

- **[WARNING] `scanForceInstalledBackfills` is exported with no production
  consumer outside its own module** — `backfill.ts:207`. Its only caller is
  the private `applyBackfillForScope` in the same file
  (`backfill.ts:93`); every other reference is a comment or the test file.
  Unlike `applyBackfillForScopeIsolated` and `runScopeIsolated` (both
  genuinely consumed by `apply.ts`), this export exists to give the test
  suite a version-gate-free entry point into the scan/promote logic. That is
  a defensible "guard-free body" shape (the codebase's own established
  pattern for `runInstallLedgerBody`-style seams), but here there is no
  second production caller motivating it, which is what the pattern is
  normally justified by. Either confirm there is a forthcoming or existing
  architectural reason for the export (and say so in the file's header
  alongside the FLOW-09 extraction rationale it already carries), or fold the
  version-gate-free tests into the `applyBackfillForScopeIsolated` describe
  block by seeding a scope whose stamp is already current-but-forced (if that
  is possible) and make the function module-private.

### Clean files

- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`

None of the five production modules read `process.env`, call `new
Date()`/`Date.now()`/`randomUUID()`, hold module-level mutable state, use
`as`/`!` assertions, or contain any of the quick-scan style tokens (`var`,
`export default`, `export let`, `public`, private `#` fields, `parseInt`,
`.bind(`, `<Type>value`, etc.). Every `catch` clause matches the pervasive
codebase-wide `catch (err)` convention (100+ instances elsewhere), so it is
not flagged as a deviation. All object types are `interface`, all arrays are
`readonly T[]`, and the tri-state severity model and dumb-renderer contract
are honored everywhere I traced them.

## Not covered

- I did not run `npm run check`, `npm test`, or `npm run
  test:coverage:direct` — the diagnostic-review rules for this sweep forbid
  it while other reviewers work concurrently. The two BLOCKER coverage
  findings above are from manually tracing every case's fixture against the
  named `if` conditions in the production source, not from an empirical
  coverage report; confirm them against the real tool before acting.
- I did not review `apply.ts`, `apply-outcomes.ts`, or `plan.ts` and their
  test files (owned by another reviewer), except to read `apply-outcomes.ts`
  far enough to confirm the `Reason`-vs-`ContentReason` typing that
  substantiates the `reasonAsContent` finding above.
- I did not independently re-derive whether `tests/platform/git-ops-fake.ts`,
  `tests/edge/notification-boundary.ts`, or
  `tests/orchestrators/plugin/scope-tree-inventory.ts` are themselves
  free of findings — I only confirmed my five assigned suites use them
  correctly (exact `times()` counts, fresh fakes per case, no shared mutable
  state leaking across cases). Those files may be in another reviewer's scope.

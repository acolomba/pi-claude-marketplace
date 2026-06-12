---
quick_task: 260612-bcs-fix-pr-51-five-agent-review-findings
sub_plan: 02
commit: 0ef0cc9
status: complete
byte_contract: byte-neutral (no docs/output-catalog.md edit)
requirements_closed:
  - C1
  - I3
  - I4
  - S5
  - D-UPD
  - D-NCF
  - T2 (behavior side)
---

# Sub-plan 02 closure: enable-disable cascade + update-disabled gaps

One atomic Conventional Commit (`0ef0cc9`) on `features/v1.12-config-files`,
byte-neutral on existing catalog fixtures, `npm run check` GREEN,
catalog-uat byte gate GREEN with NO `docs/output-catalog.md` edit.

## Findings closed

- **C1** -- `setPluginEnabled` honours its never-rethrows contract even when
  state.json is corrupt in either scope. `resolveCrossScopePluginTarget` is
  now wrapped in a try/catch that routes through the existing
  `classifyTransactionThrow` taxonomy + a basename-only path sanitizer
  (T-53-02-02). The edge handler adds a defense-in-depth catch so any
  future leak still surfaces through `notify()` per IL-2. New tests
  (orchestrated + edge handler) pin the contract.
- **I3** -- Disable cascade partial failure folds `cascade.dropped` into the
  record AND saves the shrunken state before surfacing the `(failed)` row.
  Mirrors `uninstall.ts::applyPartialCascadeFold` (TR-03). New test pins
  that skills + prompts drop while agents + mcp retain when the agents
  bridge throws mid-cascade.
- **I4** -- Enable branch threads an `InstallFailureCapture` into
  `runInstallLedger` (4th arg). On rollback-partial enable failure the
  failed row renders the catalog `(failed) {rollback partial}` byte form
  with per-phase child rows, matching the install/uninstall path. Empty
  capture preserves the existing pre-commit failure shape (regression-pin
  test in place).
- **S5** -- `reinstall.ts:maybeWritePluginConfigBack` and
  `update.ts:maybeWritePluginConfigBackUpdate` now return
  `{invalidConfig}` instead of silently dropping the abort. The direct
  path emits a separate `(failed) {invalid manifest}` warning row
  alongside the success row so the user knows the on-disk artefacts
  landed but the config entry was not written. Cascade path unchanged
  (it never calls the write-back; gated by `!args.cascade`).
- **D-UPD (LOCKED)** -- `runThreePhaseUpdate` short-circuits on
  `isRecordedButDisabled(record)` (the canonical empty-resources +
  installable=true marker, mirrored locally to avoid the reconcile import
  edge). It refreshes `record.version` + `record.resolvedSource` +
  `record.compatibility` via a `withStateGuard` write but leaves
  `resources.*` empty (still disabled). Renders the existing
  `(skipped) {up-to-date}` byte form -- no new catalog token. Test
  helper `makePluginRecord` updated to default to a populated skill so
  the standard update tests exercise the enabled-update path, not the
  D-UPD short-circuit; affected assertions were re-pinned. New
  `makeDisabledPluginRecord` helper feeds the new D-UPD test.
- **D-NCF (LOCKED)** -- `orchestrators/marketplace/remove.ts::narrowCascadeFailure`
  maps `AgentsUnstageFailureError` to `"source mismatch"`, aligning with
  uninstall.ts's ATTR-09 mapping so the two narrowers do not drift.
  Existing narrowCascadeFailure regression test updated to assert the
  new mapping.
- **T2 (behavior side)** -- New `D-UPD` test in
  `tests/orchestrators/plugin/update.test.ts` pins the disabled-record
  refresh-but-keep-disabled semantics. Companion regression-pin in
  `tests/orchestrators/marketplace/autoupdate.test.ts` confirms the
  flag-flip never disturbs a disabled plugin record's resources (the
  flag-flip is config-only -- no plugin update path).

## Byte / catalog discipline

- `tests/architecture/catalog-uat.test.ts` GREEN.
- No `docs/output-catalog.md` edits in this commit.
- All rendered byte forms preserved on the existing fixtures; the new
  D-UPD path reuses the existing `(skipped) {up-to-date}` token, the new
  C1 / I3 / I4 surfaces reuse existing `(failed) {…}` tokens, the new
  S5 warning reuses `(failed) {invalid manifest}`.

## Deviations

- **Test helper default change** -- `makePluginRecord` in
  `tests/orchestrators/plugin/update.test.ts` now defaults
  `resources.skills` to `["seeded-skill"]` instead of `[]`. Pre-D-UPD the
  default empty-resources shape accidentally satisfied the new
  disabled-record predicate, so the existing update tests would
  short-circuit through the D-UPD fast path. The new
  `makeDisabledPluginRecord` helper feeds the genuine D-UPD test.
  Affected pre-state assertions in TR-04 / phase-3a failure tests were
  re-pinned to the new pre-update value.
- **`autoupdate.ts` source unchanged** -- plan artifacts mention
  `src/orchestrators/marketplace/autoupdate.ts`, but the autoupdate
  orchestrator only flips a config flag; it does not run plugin updates
  (the autoupdate-driven update cascade lives in
  `marketplace/update.ts → runThreePhaseUpdate`, which the D-UPD guard
  in `plugin/update.ts` already covers). The
  `tests/orchestrators/marketplace/autoupdate.test.ts` D-UPD regression
  test pins that the flag-flip never disturbs a disabled record.
- **S5 chose warning-row over throw** -- throwing from
  `maybeWritePluginConfigBack` would abort the `withStateGuard` save and
  lose the version bump while the on-disk artefacts already swapped --
  a worse correctness outcome. Threading `{invalidConfig: boolean}` up
  to the direct-path notify site so a second warning row surfaces
  alongside the success row was the smallest defensible fix.
- **Cognitive-complexity disables** -- three `sonarjs/cognitive-complexity`
  disables added (the `setPluginEnabled` body, its
  `withLockedStateTransaction` closure, and `runThreePhaseUpdate`).
  Splitting them would obscure the per-arm save-vs-throw discipline and
  require additional state-snapshot threading. Matches the existing
  carve-out style on `uninstall.ts`.

## Verification

- `npm run check` GREEN (typecheck + lint + format + 1823 tests +
  integration GREEN).
- `pre-commit run --files <changed>` GREEN (no `SKIP=trufflehog` needed
  since this commit runs on the main working tree, not a worktree).

## Out of scope (left for other plans)

- I6 / Y7 / S4 / S6 (Plan 03)
- Y1 / Y2 / Y4 / Y5 / Y6 type cuts (Plans 04 / 05)
- Y3 `setPluginEnabled` overload (Plan 05 -- builds on the C1 try/catch
  structure this plan introduced)
- D1..D11 comment/docs cleanup (Plan 07)

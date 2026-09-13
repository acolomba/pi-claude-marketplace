# Quick Task 260612-bcs Sub-Plan 06 Summary

**Plan:** 260612-bcs-06 (test-only closure of PR #51 review test-gap findings)
**Commit:** 852fc7e -- `test(reconcile): pin load-time enable + cascade arms + predicate drift`
**Branch:** `features/v1.12-config-files`
**Byte contract:** byte-neutral (test-only; zero source edits, zero
`docs/output-catalog.md` edits)

## One-liner

Pinned the remaining PR #51 review test-gap findings (T1, T3, T4, T5, T6)
with seven new tests that were GREEN on first run because the behaviour
itself had already landed in sub-plans 01-05.

## Findings closed

| Finding | Closed by                                                                                     | File                                                       |
| ------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| T1      | Load-time ENABLE through applyReconcile + orchestrated enable-success outcome                 | `tests/orchestrators/reconcile/apply.test.ts` (lines 1432-1556) and `tests/orchestrators/plugin/enable-disable.test.ts` (lines 1151-1190) |
| T3      | Direct `pluginsToUninstall` bucket through applyReconcile + WR-06 convergence at apply layer  | `tests/orchestrators/reconcile/apply.test.ts` (lines 1558-1668) |
| T4      | `applySourceMismatches` + applied-cascade source-mismatch arm via applyReconcile (dangling-reference) | `tests/orchestrators/reconcile/apply.test.ts` (lines 1670-1717) |
| T5      | Predicate-drift truth-table + source-shape pin between `isRecordedButDisabled` and `isCurrentlyDisabled` | `tests/orchestrators/reconcile/plan.test.ts` (lines 614-760)  |
| T6      | `classifyReadPassThrow` lock-held arm + `loadConfig` EISDIR arm + `writeMarketplaceConfigEntry` partial-patch loud refusal | `tests/orchestrators/reconcile/apply.test.ts` (lines 1719-1779), `tests/persistence/config-io.test.ts` (lines 308-348), `tests/persistence/config-write-back.test.ts` (lines 388-425) |

T2 was previously closed by sub-plan 02 (D-UPD behavior tests in
`update.test.ts` + `autoupdate.test.ts`); no new tests added here.

## What landed in detail

### T1 -- apply.test.ts

A new test mirrors the WR-09 disable-axis fixture inverted: a recorded-
but-disabled plugin (empty resources + `installable: true`, the ENBL-02
marker) plus a config that declares the plugin enabled. Seeds a REAL on-
disk path-source marketplace clone outside the scope dir (helper
`seedRealPathMarketplace`) so the enable branch's cached-clone read
succeeds (NFR-5: no network). Assertions:

- exactly one notify with the `(installed)` child row and no `/reload`
  trailer (cascade owns the reload, not the user)
- state re-populated (`resources.skills` non-empty, version pin
  preserved -- ENBL-02)
- base config unchanged (config is the reconcile's INPUT, never the
  write target -- WR-09 contract mirrored)
- second reconcile is silent (steady-state convergence)

### T1 -- enable-disable.test.ts

Adds an orchestrated enable-success test alongside the existing
disable / idempotent-enable / not-added orchestrated tests. Reuses the
existing `seedRealDisabledMarketplace` fixture. Asserts the typed
`EnableDisablePluginOutcome` arm (`status: "enabled", name, version`)
and zero notifications fired (apply-cascade is the sole projection seam
in orchestrated mode).

### T3 -- apply.test.ts

Seeds a populated plugin state record under a still-declared marketplace
with the plugin entry deleted from config. `applyPluginUninstalls`
fires, renders the `(uninstalled)` row, and the marketplace stays
declared (no `(removed)` row). Second reconcile is silent -- WR-06
convergence at the apply layer (the planner finds nothing to uninstall
after the row landed). Uses the same `seedRealPathMarketplace` helper.

### T4 -- apply.test.ts

End-to-end test for the dangling-reference variant of the Y2 widened
`PlannedSourceMismatch` / `SourceMismatchOutcome` discriminant. Seeds a
config with `cr@phantom-mp` where `phantom-mp` is undeclared, runs
`applyReconcile`, asserts the marketplace-level `(failed) {source
mismatch}` row plus the attributed `cr` plugin child row. Pairs with
sub-plan 04's byte-equality tables in `notify.test.ts` (which cover all
four Y2 causes at the projection seam); this test pins the end-to-end
seam through `applySourceMismatches`.

### T5 -- plan.test.ts

Two parts:

1. A truth-table assertion on `isRecordedButDisabled` over the four
   cells `installable ∈ {true, false}` × `resources ∈ {populated,
   empty}`. Only the `(installable: true, populated: false)` cell is
   "disabled" -- the documented ENBL-02 marker plus the SPLIT-01
   convergence proof guard against the soft-degraded (`installable:
   false`) plugin.
2. A source-shape pin on the module-private
   `isCurrentlyDisabled` (`enable-disable.ts:179`). The two predicates
   are deliberately duplicated -- the enable-disable orchestrator keeps
   the marker out of the reconcile import graph by design. The pin
   extracts `isCurrentlyDisabled`'s function body via regex and asserts
   that every axis `isRecordedButDisabled` tests
   (`compatibility.installable`, `resources.skills.length === 0`,
   `prompts.length === 0`, `agents.length === 0`, `mcpServers.length ===
   0`) appears in the body, and that the body contains no `||`
   disjunctions. A hand-edit that flips one predicate without the other
   trips this test before it reaches the convergence proof.

### T6 -- apply.test.ts (lock-held arm)

Pre-holds the project-scope `.state-lock` via `proper-lockfile` so
`applyReconcile`'s `withStateGuard` fast-fails with
`StateLockHeldError`. The read-pass catch routes it through
`classifyReadPassThrow` and renders the closed-set `{lock held}` reason
on the `state.json` subject (basename selected by the non-
MigrateConfigSaveError arm at `apply.ts:797`). Assertions explicitly
exclude `{unparseable}` and `{unreadable}` to ensure the lock-held arm
does not flatten back to the generic probe.

### T6 -- config-io.test.ts (EISDIR arm)

The `loadConfig` non-ENOENT read-failure arm at `config-io.ts:128-133`.
Drives EISDIR portably by creating a DIRECTORY at the target path
(`mkdir claude-plugins.json`); Node's `readFile` against a directory
throws `err.code === "EISDIR"`, non-ENOENT, routing through the read-
failure arm rather than the `absent` arm. Asserts the `read failed:`
prefix and that the cause text mentions `EISDIR`.

### T6 -- config-write-back.test.ts (partial-patch refusal)

`writeMarketplaceConfigEntry` invoked on an ABSENT marketplace with a
`Partial<MarketplaceConfigEntry>` lacking the required `source` field.
The merge cast at `config-write-back.ts:58-67` (the S10 cast comment's
documented backstop) lets the half-formed entry reach `saveConfig`,
which refuses loudly via `CONFIG_VALIDATOR.Check(config)` before any
bytes hit disk. The test asserts:

- `assert.rejects(.., /saveConfig refused/)` -- the loud refusal
- `readFile(...)` throws `ENOENT` afterwards -- no partial file on disk

## Verification

- `npm run check` GREEN: 1853 unit tests + 10 integration tests, zero
  failures.
- catalog-uat byte gate GREEN with no `docs/output-catalog.md` edits.
- `pre-commit run --files <changed>` GREEN for all hooks (prettier,
  trufflehog, lint-equivalent).
- Zero source-file edits in the commit diff -- only the five test files
  listed in the plan frontmatter.
- One atomic Conventional Commit on `features/v1.12-config-files`:
  `852fc7e test(reconcile): pin load-time enable + cascade arms +
  predicate drift`.

## Deviations from the plan

None of structural significance. Two minor lint fixes were applied
mid-flight before the commit landed:

1. Replaced a `!` non-null assertion with `?.` chaining in the T3
   assertion (`persisted.marketplaces.mp?.plugins.foo`) to satisfy
   `@typescript-eslint/no-unnecessary-type-assertion`.
2. Replaced a regex `.test()` call with `String#includes("||")` in the
   T5 source-shape pin to satisfy `@typescript-eslint/prefer-includes`.

Both are lint-pass-only changes; neither affects test semantics.

## Self-Check: PASSED

- All seven new tests exist and were GREEN on first run:
  - `T1 / PR #51: load-time ENABLE through applyReconcile ...`
  - `T1 / PR #51: orchestrated mode enable-success ...`
  - `T3 / PR #51: direct pluginsToUninstall bucket ...`
  - `T4 / PR #51: applySourceMismatches + applied-cascade ...`
  - `T5 / PR #51: isRecordedButDisabled truth table ...`
  - `T5 / PR #51: isCurrentlyDisabled (enable-disable.ts) source-shape pin ...`
  - `T6 / PR #51 / CFG-03: loadConfig non-ENOENT read-failure arm (EISDIR) ...`
  - `T6 / PR #51 / S10: writeMarketplaceConfigEntry partial patch ...`
  - `T6 / PR #51: classifyReadPassThrow lock-held arm ...`
- Commit hash `852fc7e` is reachable: `git log --oneline | grep 852fc7e`
  returns the commit.
- Zero files outside the plan's `files_modified` list were touched.

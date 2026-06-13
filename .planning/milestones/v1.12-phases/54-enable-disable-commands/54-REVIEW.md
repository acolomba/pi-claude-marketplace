---
phase: 54-enable-disable-commands
reviewed: 2026-06-10T19:51:21Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/router.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-06-10T19:51:21Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 54 adds `/claude:plugin enable|disable`. The disable path, the
idempotency arms, the `{not added}` routing, the CFG-03 abort, the
`--local` write isolation, the `(disabled)` renderer arm, the REASONS
29→31 / token closed-set bumps, and the reconcile `pluginsToEnable`
gating are implemented and mostly tested. Two critical defects remain:
the **fresh-enable path can never succeed in production** (nested
`withStateGuard` self-deadlock — empirically reproduced; two further
latent defects sit behind it), and the **ENBL-04 `(disabled)` inventory
token has no producer** — `/claude:plugin list` and `info` render a
disabled plugin as `(installed)`, while the catalog and the catalog-UAT
fixtures document a `(disabled)` row that no orchestrator emits. The
test suite is green only because no test exercises the fresh-enable
success path and the catalog UAT drives handcrafted payloads through
the renderer rather than through the orchestrators.

## Critical Issues

### CR-01: Fresh enable always fails — nested `withStateGuard` self-deadlock (plus two latent defects layered behind it)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:272-298` (with `orchestrators/plugin/install.ts:352`, `transaction/with-state-guard.ts:155-163`)
**Issue:** `setPluginEnabled` wraps its whole flow in
`withStateGuard(locations, ...)`. Inside that closure, the enable branch
(`runEnableBranch`, line 126) calls `installPlugin`, which itself opens
`withStateGuard(locationsFor(scope, cwd), ...)` on the **same**
`stateLockFile`. `proper-lockfile` is not re-entrant (`retries: 0`; same
path → `ELOCKED` even in the same process), so the inner acquisition
throws `StateLockHeldError`, `installPlugin`'s catch converts it to a
`failed` outcome, and every fresh enable reports an error.

Empirical reproduction (valid path-source marketplace on disk, disabled
state record, `enable: true`):

```text
1 plugin operation failed.

● mp [user]
  ⊘ foo v1.2.3 (failed)
    cause: Another pi-claude-marketplace operation is in progress for user scope (...) -> Lock file is already being held
```

The catalog `enable-fresh` state is therefore unreachable; ENBL-01 /
ENBL-03 are unmet in production. Two further defects are layered behind
the lock and will surface one at a time if only the lock is fixed:

1. **PI-15 early-sanity rejects the enable.** `installPlugin` throws
   `PluginShapeError({ kind: "already-installed" })` whenever
   `targetMp.plugins[plugin] !== undefined` (`install.ts:386-391`). A
   disabled plugin's state record is deliberately KEPT (ENBL-02), so the
   re-materialization is always "already installed" from install's
   point of view. `installPlugin` has no flag to accept an existing
   record for re-materialization.
2. **Outer stale-state save clobbers the inner state write.** Even if
   1-2 were bypassed, `installPlugin` saves its own freshly-loaded state
   (with re-populated `resources.*`), after which the OUTER
   `withStateGuard` saves the snapshot it loaded **before** the install
   — re-emptying the resources arrays and leaving state.json marked
   disabled while artefacts exist on disk (state/disk drift, violating
   the ST-7/D-06 single-writer model).

**Fix:** Restructure the enable branch so exactly one guard owns the
critical section. Concretely: extract install's ledger body into an
`installPluginInGuard(state, ...)` helper that (a) takes the
already-loaded state snapshot, (b) accepts a
`allowExistingRecord: true` mode that skips the PI-15 early-sanity
throw and overwrites the existing record's `resources`/`updatedAt`
in place, and (c) performs no guard/lock/save of its own. Call it from
both `installPlugin` (inside its own guard, current behavior unchanged)
and `setPluginEnabled`'s guard closure. Add a test that drives a fresh
enable end-to-end against a real on-disk marketplace and asserts the
`enable-fresh` catalog byte form (`(added)` header, `(installed)` row,
`/reload` trailer) AND that state.json's `resources.skills` is
non-empty afterwards.

### CR-02: ENBL-04 unimplemented — no producer of the `(disabled)` token; list/info render disabled plugins as `(installed)`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:219-265` (also `orchestrators/plugin/info.ts`)
**Issue:** The `(disabled)` closed-set token exists in the type model
(`PluginDisabledMessage`, `notify.ts:474`), the renderer
(`notify.ts:1698-1711`), the LLM-tool projections (`tools.ts`), and the
catalog (`docs/output-catalog.md:304-313`, `:1133`), but **nothing
constructs it**. A repo-wide search for `status: "disabled"` finds only
test fixtures. `list.ts::installedRowMessage` never consults the
empty-resources + `installable: true` marker, so after a successful
`/claude:plugin disable foo@mp`, `list` renders
`● foo-plugin v1.2.3 (installed)` — byte-identical to an enabled
plugin — and `info` renders the standard installed info block. The
catalog's `disabled-inventory` state and its info-surface paragraph
document behavior that does not exist; `tests/architecture/catalog-uat.test.ts`
passes only because its fixtures are handcrafted `NotificationMessage`
payloads fed straight to `notify()`, never produced by the list/info
orchestrators. The phase success criterion "(disabled) renders distinct
from (unavailable) on list/info (D-54-01)" is unmet.
**Fix:** In `installedRowMessage` (list.ts), branch on the disabled
marker before the upgradable check:

```ts
if (isRecordedButDisabled(record)) {
  return { status: "disabled", name: pluginName, version: record.version, ...scopeField };
}
```

(or a locally-mirrored predicate if the reconcile import is off-limits;
see IN-04). Apply the equivalent branch in `orchestrators/plugin/info.ts`
per the catalog's info-surface paragraph (list-arm header +
`PluginDisabledMessage` row). Decide how `shouldShow`'s PL-1 filters
bucket `disabled` (it is neither `installed` nor `unavailable` today —
the catalog implies the installed bucket) and add orchestrator-level
tests that drive a disabled state record through `loadPluginListPayload`
and assert the `(disabled)` row.

## Warnings

### WR-01: Catalog claims "state.json mtime is UNCHANGED" on CFG-03 abort, but the guard re-saves state on every clean-return arm

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:272-314`; `docs/output-catalog.md:1518`, `:1573`
**Issue:** `withStateGuard` unconditionally calls `saveState` when the
closure returns without throwing (`with-state-guard.ts:73`). The
`invalid-config`, `idempotent`, and `not-recorded` arms all return
cleanly, so state.json is rewritten (new mtime, plus load-time source
normalization) on every abort/no-op. The catalog states for
`enable-invalid-config` / `disable-invalid-config` assert "state.json
mtime is UNCHANGED", which is false. The orchestrator test even works
around it ("state-io's load-time source normalization is allowed to
rewrite the source field, so we can't byte-compare",
`tests/orchestrators/plugin/enable-disable.test.ts:369-371`).
**Fix:** Use `withLockedStateTransaction` and call `tx.save()` only on
the `fresh` disable arm (the enable arm's save belongs to the install
helper per CR-01), or amend the catalog wording to "the plugin record's
load-bearing fields are unchanged". Doc and implementation must agree —
the mtime claim is an attractive but currently false invariant for
downstream tooling.

### WR-02: `--local` placed before the ref breaks parsing with a misleading usage error

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts:87`; `edge/args.ts:26-61`
**Issue:** `extractLocalFlag` only scans for `--local`; the unmodified
`args` string (still containing `--local`) is then handed to
`parseRequiredPluginMarketplaceRef`. `parseArgs` treats every
non-`--scope` token as a positional, so
`/claude:plugin enable --local foo@mp` yields `positional[0] ===
"--local"` and fails with `Invalid <plugin>@<marketplace> ref:
"--local".` while `enable foo@mp --local` works (the extra positional
is silently dropped by `parseCommandArgs`). Flag position should not
change the outcome.
**Fix:** Have `extractLocalFlag` return the residual args with the
`--local` token removed and pass that residue to
`parseRequiredPluginMarketplaceRef` (mirrors how `--scope` is consumed
by the parser itself):

```ts
return { local, residualArgs: tokens.filter((t) => t !== "--local").join(" ") };
```

Add handler tests for both orderings.

### WR-03: `not-recorded` outcome misuses `{not in manifest}` and has no catalog state

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:401-408`
**Issue:** When the marketplace container exists but the plugin row is
absent from state.json (never installed, or concurrently uninstalled),
the orchestrator emits `(failed) {not in manifest}`. The plugin may
well be present in the manifest — it is simply *not installed*. The
established taxonomy (ATTR-08, reinstall precedent) reserves
`{not in manifest}` for "plugin absent from a PRESENT manifest" and
uses `{not installed}` for "marketplace present, plugin not installed".
The catalog's enable/disable sections also define no state for this
outcome, so the byte form is unlocked by the catalog UAT.
**Fix:** Emit `reasons: ["not installed"]` (closed-set member), and add
a catalog state + UAT fixture for the not-recorded arm (e.g.
`enable-not-installed`). Consider `(skipped) {not installed}` for
parity with reinstall's "legitimate marketplace-present, plugin-absent"
classification if a warning rather than an error is intended.

### WR-04: `as never` double-casts on the state-mutating `cascadeUnstagePlugin` call defeat type checking

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:162-167`
**Issue:** `cascadeUnstagePlugin(opts.plugin, opts.marketplace,
locations as never, installed as never)` silences ALL type errors —
argument-order swaps, field renames in `ScopedLocations` or the plugin
record schema, or a future signature change would compile cleanly and
fail (or corrupt) at runtime. The casts exist only because
`runDisableBranch` narrows its parameters to local structural types
(`ScopedLocationsLike`, `InstalledPluginRecord`) that are then
incompatible with the real branded/full types the callee requires.
**Fix:** Type `runDisableBranch`'s parameters with the real types
(`ScopedLocations`, `ExtensionState["marketplaces"][string]["plugins"][string]`)
— both are already imported/importable in this module — and delete the
casts. If the narrow local types must stay, cast through the precise
target type (`locations as ScopedLocations`) so structural mismatches
still surface, never `as never`.

### WR-05: Reconcile plan never converges after a successful disable — `(will disable)` rendered forever

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:291-299`
**Issue:** `classifyDeclaredPlugin` pushes a `PlannedPluginDisable`
whenever `enabled === false && recorded`, without checking
`isRecordedButDisabled`. The terminal state of a successful disable is
exactly "recorded with empty resources + config `enabled: false`"
(ENBL-02 keeps the record), so every subsequent `planReconcile` emits a
disable action and `/claude:plugin preview` shows
`⊘ <plugin> (will disable)` permanently; the plan can never reach
`emptyReconcilePlan` for a disabled plugin, and the Phase 55 apply path
will re-run a no-op disable on every reload.
`tests/orchestrators/reconcile/plan.test.ts` ENBL-02(c) ratifies this
("Phase 55's apply path makes this a no-op at the artefact level"), but
a converged disabled state is not a config↔state divergence — the
symmetric enable case correctly treats "recorded + populated +
enabled" as steady state.
**Fix:** Gate the disable push on the record NOT already being
disabled:

```ts
if (enabledExplicitFalse) {
  const record = state.marketplaces[marketplace]?.plugins[plugin];
  if (recorded && record !== undefined && !isRecordedButDisabled(record)) {
    acc.disable.push({ scope, plugin, marketplace });
  }
  return;
}
```

Update ENBL-02(c) to assert the steady-state no-op and add a
convergence test: disable → re-plan → `deepEqual emptyReconcilePlan`.

### WR-06: ENBL-03 test assertion is so weak it passes for the wrong failure, masking CR-01; no test covers fresh-enable success

**File:** `tests/orchestrators/plugin/enable-disable.test.ts:252-277`
**Issue:** The "missing cached clone aborts with (failed) {source
missing}" test asserts only `/\(failed\)/` and `severity === "error"`.
The actual emission today carries NO `{source missing}` brace — the
failure is the nested-lock `StateLockHeldError` (CR-01), which
`narrowEnableFailure` maps to `reasons: []`. The test name promises a
classification it never verifies, and the suite contains zero coverage
of the fresh-enable success path (catalog `enable-fresh`), which is why
a never-working enable shipped green.
**Fix:** Assert the brace byte form
(`/\(failed\) \{source missing\}/`) so the test pins the ENBL-03
classification, and add the end-to-end fresh-enable success test
described in CR-01.

## Info

### IN-01: Stale closed-set drift-guard comment in notify-types test

**File:** `tests/architecture/notify-types.test.ts:1337-1342`
**Issue:** The trailing comment block documents
`PLUGIN_STATUSES.length === 11`, `MARKETPLACE_STATUSES.length === 7`,
`REASONS.length === 29` while the live locks above are 16 / 9 / 31.
**Fix:** Update or delete the stale comment block.

### IN-02: Command description not updated for the new surface

**File:** `extensions/pi-claude-marketplace/edge/register.ts:64-66`
**Issue:** `COMMAND_DESCRIPTION` still lists "Bootstrap, install,
uninstall, list, import, update, and reinstall" — `enable`, `disable`
(and earlier `info`/`preview`) are missing from the user-visible
command description.
**Fix:** Append the new verbs.

### IN-03: Enable on a soft-degraded record reports `{already enabled}`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:291`
**Issue:** `isCurrentlyDisabled` requires `installable === true`, so a
soft-degraded record (`installable: false`, legally empty resources) is
classified "not disabled"; `enable` then short-circuits to
`(skipped) {already enabled}` even though nothing is materialized.
Misleading benign no-op for an edge case the planner's own comment
(plan.ts:212-224) explicitly distinguishes.
**Fix:** Branch the non-installable case to a distinct failed/skipped
reason (e.g. `{no longer installable}`).

### IN-04: Duplicated disabled-marker predicate has no drift gate

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:98-114`
**Issue:** `isCurrentlyDisabled` deliberately mirrors
`reconcile/plan.ts::isRecordedButDisabled` to avoid the import, but no
test pins the two predicates to each other; they can silently diverge
(the marker is load-bearing for idempotency AND the enable bucket).
**Fix:** Either import the canonical predicate (it is pure; the purity
gate on plan.ts is about plan.ts's own imports, not its importers) or
add a small equivalence test feeding both predicates the same record
matrix.

### IN-05: No TC-6 completion test for the enable/disable modes

**File:** `tests/edge/completions/provider.test.ts:97-112`
**Issue:** Only the TC-1 keyword list covers the new verbs; no test
exercises `getPluginRefCompletions` under `mode: "enable" | "disable"`
(installed-only path). The path is shared with `uninstall`, so risk is
low, but the modes are unpinned.
**Fix:** Add one TC-6 case each for `enable ` / `disable ` prefixes.

---

_Reviewed: 2026-06-10T19:51:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

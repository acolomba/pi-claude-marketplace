# Backward-Compat Removal (state.json + claude-plugins.json)

## Requirements

Non-negotiable constraints that emerged from spiking, in force for the
real implementation:

- Any replacement for `migrate-config.ts` MUST NOT let "config file
  absent" collapse to "empty desired state" for a scope with a populated
  `state.json` -- `loadMergedScopeConfig` currently treats an absent
  config as `{}`, and `reconcile/plan.ts`'s `buildUninstallBucket` reads
  "not in desired config" as "uninstall it." An unguarded removal turns a
  missing file into a silent mass-uninstall.
- Staleness detection for `state.json` reuses `STATE_VALIDATOR.Check()` on
  the RAW, un-migrated parsed JSON -- do not add a new per-record version
  stamp. `Check()` already fails on every REQUIRED-field addition
  (`enabled`, `resources.hooks`, `manifestPath`/`marketplaceRoot`, etc.)
  and covers plugin-level and marketplace-level staleness in one call,
  because both record types nest under the same `STATE_SCHEMA` tree.
- The combination "stale `state.json` AND absent `claude-plugins.json`"
  MUST fail loud: a `notify()` pointing at an explicit recovery step.
  Never silently wipe (orphans installed-but-untracked plugins) and never
  silently auto-migrate (reintroduces the thing being removed).
- Do not spend effort actively scrubbing the D-13 `autoupdate` legacy
  field. It's provably inert and a `Check()`-based gate structurally
  cannot see it anyway (TypeBox tolerates extra properties by default --
  no `additionalProperties: false` in `STATE_SCHEMA`). Leave it in state
  records forever rather than keeping the 3-file scrub threading alive.

## How to Build It

**1. Delete `persistence/migrate.ts` and its test file wholesale.**
Confirmed zero overlap with the live write path (`install.ts`,
`marketplace/add.ts` build records independently and always emit the
full current shape). Its only caller is `state-io.ts::loadState`.

**2. Replace the migrate-and-heal load path with a single validity gate.**
In `loadState` (`persistence/state-io.ts`), where `migrateLegacyMarketplaceRecords`
+ `persistMigratedState` currently run, replace with:

```ts
const parsed: unknown = JSON.parse(raw);
if (!STATE_VALIDATOR.Check(parsed)) {
  // Stale shape -- do not attempt field-by-field repair. Let the
  // caller's reconcile pass treat this scope as if state.json were
  // absent, so it rebuilds from claude-plugins.json via the existing
  // install ledger.
  return DEFAULT_STATE;
}
return parsed as ExtensionState;
```

Validated against the real (unmodified) `STATE_VALIDATOR` in
`sources/003-force-reinstall-on-version-mismatch/prototype.ts`: a
current-shape record passes; pre-ENBL-02 (missing `enabled`), pre-HOOK-02
(missing `resources.hooks`), and pre-ST-4 (missing marketplace-level
`manifestPath`) shapes all correctly fail.

**3. Simplify `STATE_SCHEMA.schemaVersion` to a single literal.**
`Type.Union([Type.Literal(1), Type.Literal(2)])` becomes `Type.Literal(2)`
(or whatever the current value is at implementation time) -- nothing
writes the old literal anymore, so the union was read-only back-compat.

**4. Delete `persistence/migrate-config.ts` and its test file --
but replace the call site, don't just remove it.** In
`reconcile/apply.ts`, where `migrateFirstRunConfig(loc, state)` runs
before `loadMergedScopeConfig(loc)`: after step 2 makes `state ===
DEFAULT_STATE` mean "either genuinely fresh OR stale-and-being-treated-as-fresh,"
the read pass needs to distinguish those two for the loud-failure
requirement above. Concretely:

```ts
const configResult = await loadConfig(loc.configJsonPath);
if (configResult.status === "absent" && stateWasFlaggedStale) {
  // Do NOT silently proceed as if nothing were installed.
  notifyDiagnostic(/* explicit message: this scope predates a required
    format change and claude-plugins.json is missing; installed plugins
    are on disk but untracked until the config is restored or each
    plugin is reinstalled */);
  // Skip this scope's apply pass entirely rather than reconciling
  // against an empty desired state.
  return;
}
```

The exact notify wording and the recovery command it should point users
at (re-run install per plugin? a new `--rebuild-config-from-disk` escape
hatch?) is unresolved -- flagged as an open design question for planning,
not answered by the spike.

**5. Leave `bridges/agents/marker.ts` alone.** `GENERATED_AGENT_MARKER_LEGACY`
is a safety predicate (AG-5), not a migration -- removing it doesn't save
meaningful code and converts a currently-silent upgrade path into a
visible one-time "foreign content" failure notification for any
pre-0.10-generated agent file. Not part of this removal.

**6. Leave the D-13 `autoupdate` scrub threading alone**
(`marketplace/shared.ts`, `marketplace/autoupdate.ts`, `reconcile/apply.ts`).
Small, inert, and orthogonal to the `Check()`-based mechanism above.

## What to Avoid

- **Don't add a new per-record or per-scope version stamp field.** The
  instinct (mirroring `lastReconciledExtensionVersion` /
  `EXTENSION_VERSION` from BFILL-01/02) is reasonable but unnecessary --
  `STATE_VALIDATOR.Check()` on raw JSON already does this job with zero
  new schema surface. Adding a stamp anyway duplicates the signal and
  gives it a second place to drift out of sync.
- **Don't delete `migrate-config.ts` without adding the loud-failure
  guard.** Confirmed by direct trace of `config-merge.ts` +
  `reconcile/plan.ts`: an absent config collapses to `{}`, and the
  uninstall bucket walks every recorded plugin not in that empty set.
  Deleting the file with no replacement is a silent mass-uninstall bug,
  not a code-shrink.
- **Don't try to make `Check()` catch the `autoupdate` scrub too.**
  TypeBox's extra-property leniency (D-09-style, deliberate elsewhere in
  the codebase) means a stray field is invisible to a shape-validity gate
  by construction. Trying to force this into the same mechanism (e.g. via
  `additionalProperties: false`) would be a much bigger, unrelated change
  with its own blast radius (hand-edited files with harmless unknown keys
  would start failing to load) -- out of scope for this removal.
- **Don't reuse the plugin-level `reinstall` ledger as the trigger
  mechanism.** `STATE_VALIDATOR.Check()` fails for the WHOLE `state.json`
  document at once (one schema, one document), not per-plugin -- there is
  no "which plugin is stale" to target individually without
  re-implementing the field-inspection logic this removal deletes. The
  correct trigger is scope-wide: treat the whole scope as fresh and let
  the existing config-driven reconcile apply pass rebuild it, not a
  targeted per-plugin reinstall call.

## Constraints

- Config file (`claude-plugins.json`) was introduced in v0.5.0
  (2026-06-12, PR #51). As of the spike (v0.14.0, 2026-08-13), any scope
  that has reconciled even once since then already has a config file and
  takes the cheap `existing-valid` short-circuit in `loadConfig` -- so the
  loud-failure edge case (stale state + absent config) is expected to be
  narrow in practice. It is not zero, though, and was not measured against
  real user data -- hence the loud-failure requirement rather than "just
  don't handle it."
- `STATE_SCHEMA` has no `additionalProperties: false` anywhere, by
  design (mirrors `CONFIG_SCHEMA`'s D-09 leniency) -- do not add it as a
  side effect of this work; that's an unrelated, much larger compat
  tightening.
- Net LOC impact if implemented as designed: `migrate.ts` (283 prod / 529
  test) deleted outright. `migrate-config.ts` (197 prod / 570 test)
  deleted, replaced by a guard clause estimated at 10-20 LOC (unwritten;
  exact shape depends on the notify-message design chosen at
  implementation time). `state-io.ts`'s schemaVersion union simplified by
  a few lines. `marker.ts` (87 LOC) and the D-13 scrub threading (~15
  scattered LOC) are explicitly NOT touched.

## Origin

Synthesized from spikes: 001 (VALIDATED), 002 (PARTIAL), 003 (PARTIAL).
Source files available in:
`sources/001-installed-record-backcompat-audit/`,
`sources/002-config-file-backcompat-audit/`,
`sources/003-force-reinstall-on-version-mismatch/`.

---
spike: 003
name: force-reinstall-on-version-mismatch
type: standard
validates: "Given a plugin/marketplace record predating a shape change, when a single STATE_VALIDATOR.Check() call gates loading instead of field-by-field migration, then stale records are detected without new version-stamp plumbing -- and this design covers marketplace-level fields too, with one known gap (the D-13 autoupdate scrub) and one hard precondition (the config file must already exist, per Spike 002)"
verdict: PARTIAL
related: [001, 002]
tags: [backward-compat, migration, force-reinstall, design, prototype]
---

# Spike 003: Force-Reinstall-on-Version-Mismatch

## What This Validates

The user's core idea: "since we have reinstall, detect a previous version
of anything and force reinstall it instead of migrating it field by
field." This spike designs the actual mechanism, proves the detection half
against the real (unmodified) schema validator, and traces the "then what"
half through the existing reconcile pipeline to find where the idea does
and doesn't hold up.

## Research

Prior art already exists in this codebase for "stamp a version, compare,
act on mismatch": `lastReconciledExtensionVersion` vs `EXTENSION_VERSION`
in `reconcile/apply.ts` (BFILL-01/02). That mechanism is per-SCOPE (one
stamp for the whole `state.json`) and triggers a narrow backfill scan, not
a reinstall. It's the right shape to model, not the right trigger action.
Also drew on Spike 001 (which functions are pure legacy-catchup) and
Spike 002 (config-absence is not a safe default state).

## How to Run

```bash
node prototype.ts
```

## What to Expect

```
PASS (looks current)  current-shape record
FAIL (flagged stale)  pre-ENBL-02 record (missing `enabled`)
FAIL (flagged stale)  pre-HOOK-02 record (missing `resources.hooks`)
FAIL (flagged stale)  pre-ST-4 record (missing marketplace `manifestPath`)
PASS (looks current)  stale-autoupdate record (extra legacy field)
```

## Investigation Trail

**Starting question: do we even need a NEW version stamp?** The obvious
design (mirroring BFILL) is: add a schema-version field to every plugin
record, bump it whenever a required field is added, compare on load. But
`state-io.ts` already has exactly that at the file level
(`STATE_SCHEMA.schemaVersion: Type.Union([Literal(1), Literal(2)])`), AND
`PLUGIN_INSTALL_RECORD_SCHEMA` already declares `enabled` and
`resources.hooks` as REQUIRED. That means `STATE_VALIDATOR.Check(rawParsedJson)`
-- called on the UN-migrated JSON, before `migrate.ts` runs -- should
already return `false` for any record missing a field the current schema
requires. If true, no new stamp is needed: the existing strict validator
IS the staleness detector, and `migrate.ts` exists only to turn a `false`
into a `true` by filling in the gaps rather than rejecting.

**Built `prototype.ts` to test this against the real, unmodified
`STATE_VALIDATOR`** (imported from `persistence/state-io.ts`, not
reimplemented). Four fixtures: a current-shape record, a pre-ENBL-02
record (missing `enabled`), a pre-HOOK-02 record (missing
`resources.hooks`), and a pre-ST-4 record (missing the MARKETPLACE-level
`manifestPath` -- deliberately not a plugin field, to test whether one
top-level check also catches marketplace-level staleness, which was the
open question Spike 001 left for this spike).

Result: confirmed. All three legacy shapes fail `Check()`; the current
shape passes. **One call, one boolean, no new stamp field, and it covers
both plugin-level and marketplace-level required-field staleness in the
same check** -- because `STATE_SCHEMA` nests both record types under one
tree, `Check()` walks the whole thing.

**The gap: D-13's `autoupdate` scrub.** Added a fifth fixture --
current-shape record PLUS the stray legacy `autoupdate` field. It still
PASSES `Check()`. Confirmed why: TypeBox has no `additionalProperties:
false` anywhere in `STATE_SCHEMA` (deliberate, D-09-style leniency), so
an extra field is invisible to the validator by design. This is the one
category of legacy cleanup ("a field used to exist here and doesn't
anymore") that "does raw JSON fail Check()" cannot catch -- only
"a field is now required and doesn't exist yet" is caught. Confirmed this
field is otherwise inert: it's read in exactly one place
(`marketplace/shared.ts::classifyAutoupdateFlip`, for `marketplace
autoupdate` command messaging), and that read is explicitly documented as
"CLASSIFY ONLY," reconciled against config truth before anything is
written. Worst case if left forever: a marginally wrong "already
unchanged" message on `marketplace autoupdate` for a marketplace enabled
under the pre-config-file mechanism. Given the project's stated risk
tolerance, this is a reasonable one to just... leave. It costs nothing to
ignore and the current D-13 threading (scattered across 3 files) is not
worth keeping alive to prevent a cosmetic message.

**Then-what: what does "force reinstall" actually mean here?** This is
where the idea needs sharpening. A naive per-plugin "uninstall then
reinstall the stale one" doesn't fit: `Check()` fails for the WHOLE
`state.json` in one shot (it's a single JSON document with one schema),
not per-record, so there's no "which plugin is stale" to target
individually without re-implementing exactly the field-inspection logic
we're trying to delete. The design that actually fits: on `Check()`
failure, don't try to salvage `state.json` at all -- treat the scope as if
`state.json` were absent (same as a brand-new scope) and let the EXISTING
reconcile apply-pass rebuild everything from `claude-plugins.json`, which
already has full "install what's declared, remove what's recorded but not
declared" logic in `reconcile/plan.ts` / `apply.ts`. This reuses the
already-tested install ledger instead of adding new "force reinstall"
plumbing, and it is a genuine simplification: `migrate.ts` (283+529 LOC)
disappears entirely, replaced by roughly:

```ts
if (!STATE_VALIDATOR.Check(parsed)) {
  return DEFAULT_STATE; // scope reconciles from claude-plugins.json as if fresh
}
```

**The hard precondition this surfaces (ties directly to Spike 002):** this
only works when `claude-plugins.json` already exists and is valid. If
`Check()` fails AND the config file is ALSO absent, treating state as
`DEFAULT_STATE` means "nothing installed, nothing declared" -- reconcile
sees an empty world and does nothing destructive, but the user's actual
installed plugins are now orphaned: still on disk, unrecorded, invisible
to `list`/`info`, and not materialized by any future reconcile until the
user manually re-installs each one. That's not as bad as Spike 002's
"silent mass uninstall" finding (nothing gets deleted), but it's a silent
loss of tracking that looks like data loss to the user. The honest
recommendation: keep this narrow case loud, not silent -- when `Check()`
fails AND `loadConfig` returns `absent`, emit a `notify()` telling the
user their installation predates a required format change and pointing at
an explicit recovery command (e.g. re-run install for each plugin, or a
future `--rebuild-config-from-disk` escape hatch), rather than silently
picking either "wipe" or "auto-migrate." This is a few lines of guard
code, not a migration module.

## Results

**Verdict: PARTIAL.** The core idea is validated and simpler than
expected: `STATE_VALIDATOR.Check()` on the raw un-migrated JSON is
already a complete, zero-new-code staleness detector for every
REQUIRED-field change (which is everything `migrate.ts`'s
`ensurePluginResources`/`ensurePluginEnabled`/`ensureMarketplacePaths`
handle), and it covers plugin- and marketplace-level staleness in one
check. Replacing per-field healing with "treat a failing scope as fresh
and let reconcile rebuild from the config file" deletes `migrate.ts`
outright and reuses already-tested machinery instead of adding new
"reinstall" code.

It's PARTIAL rather than VALIDATED because two things don't fold cleanly
into "force reinstall on version mismatch" and need explicit handling
rather than being waved away by the idea's framing:

1. The D-13 `autoupdate` scrub is a stray-field problem, not a
   missing-field problem, and the proposed detector structurally cannot
   see it. Recommendation: stop threading the scrub machinery through 3
   files and just leave the field inert -- it's provably harmless and the
   cost of removal exceeds the cost of leaving it.
2. Removing `migrate-config.ts` (Spike 002) and adding this state-staleness
   gate compose into a real edge case -- stale state AND absent config --
   that must fail loud (a `notify()` + manual recovery step), not silent.
   This is new code, but small: a guard clause, not a migration module.

Net effect if this design is adopted: `migrate.ts` (283+529 LOC) deleted
outright, `state-io.ts`'s schemaVersion union simplified to a single
literal, `migrate-config.ts` (197+570 LOC) deleted and replaced by a
~10-20 LOC loud-failure guard, and the D-13 scrub threading (~15 scattered
LOC across 3 files) left in place as accepted permanent inertness rather
than actively removed. `marker.ts`'s `GENERATED_AGENT_MARKER_LEGACY` (4
lines) is unrelated to this mechanism -- Spike 001 already found it's a
safety predicate, not a migration, and recommended leaving it.

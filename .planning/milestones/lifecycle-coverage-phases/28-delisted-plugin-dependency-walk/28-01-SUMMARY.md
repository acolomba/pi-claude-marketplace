---
phase: 28-delisted-plugin-dependency-walk
plan: 01
subsystem: dependency walk, reconcile load-time warning, enable cascade
tags: [dependencies, reconcile, enable, update, reinstall, uninstall]
requires: [DLS-01]
decisions: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10]
requirements-completed: [DLS-01]
---

# Plan 28-01 Summary: Delisted plugin dependency walk

## What changed

- **DLS-01 / DLS-D1:** `dependency-declaration-read.ts::readInstalledCopyDeclaration`
  reads a delisted record's own manifest from its installed copy
  (`resolvedSource`), admitted only inside the marketplace clone root or the
  scope's `plugin-clones/` (NFR-10), through the shared candidate walk and
  refusal literal. `dependency-index.ts::readRecordDeclarations` uses it for an
  entry-absent record and marks the result `delisted: true`. A missing copy, a
  copy with no manifest, or a name with no record fails closed as
  `not in manifest` with the cause `not declared by its marketplace, and its
  installed copy cannot be read`; an unusable copy manifest is
  `unreadable manifest`.
- **REC-05 kept (D-06..D-09):** `reconcile/delisted-plugins.ts` derives the
  per-session warning from the read-pass records and their loaded manifests,
  after the walk's own row: every enabled delisted record gets
  `(failed) {not in manifest}` at `warning` with upstream's words
  (`Plugin "<p>" not found in marketplace "<m>"`), through the existing
  `plugin-declarer-unreadable` outcome. A plugin this pass failed, uninstalled,
  disabled, or reported through the walk gets none. `apply.ts` shares the
  suppression check.
- **D-10:** the enable cascade tells a delisted root by the walk's typed result
  (`delisted` or `reason === "not in manifest"`) instead of matching the cause
  text, and treats it as declaring nothing, so ENBL-07's not-found refusal
  renders. No other walk-cause text match exists in `extensions/`.
- Output catalog: the REC-05 prose and a new `reconcile-plugin-not-in-manifest`
  state; `dependency-resolution.md`; CHANGELOG.

## Tests

- Cucumber: `update.feature` (within and past a delisted plugin's range; a
  delisted plugin whose files are gone fails `{unreadable}`), `reinstall.feature`
  (range named on the row), `uninstall.feature` and `disable.feature` (refused
  by a delisted dependent), `enable.feature` (the cascade reads a delisted
  member's own dependencies), `reconcile.feature` (the warning carries
  upstream's words; a delisted plugin whose files are gone reads one row per
  session with the walk's cause), `marketplace/update.feature`. New step: the
  marketplace no longer holds the files of a plugin.
- Unit: dependency-declaration-read, dependency-index (copy read, git-source
  copy, unusable copy, no record), delisted-plugins (new pair), enable-disable
  (EDEP tests delete the copy; delisted root with copy gone or declaring a
  missing dependency), reinstall-flow (fail-closed with the copy gone; a
  readable copy blocks no other reinstall), catalog fixtures and byte pins.
- Criterion 3 (backfill): `backfill.test.ts` pins it at the backfill seam: a
  delisted sibling with a readable copy leaves `plugin-backfilled`, and with its
  copy deleted the backfill fails closed `{unreadable}`. No scenario drives a
  backfill: it needs an extension-version change and a newly supported
  component kind, which no step can set up.

## Deviations

- The delisted row reuses `plugin-declarer-unreadable` instead of a new outcome
  kind (CONTEXT D-07, revised): a new kind took the reconcile router past
  fallow's cyclomatic ceiling, and `switch-exhaustiveness-check` keeps every
  case listed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

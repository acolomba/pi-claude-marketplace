---
phase: 28-delisted-plugin-dependency-walk
reviewed: 2026-10-24T00:00:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - CHANGELOG.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/update.feature
  - features/plugin/disable.feature
  - features/plugin/enable.feature
  - features/plugin/reconcile.feature
  - features/plugin/reinstall.feature
  - features/plugin/uninstall.feature
  - features/plugin/update.feature
  - features/step_definitions/marketplace/publishing.steps.ts
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/catalog-parser.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/catalog-uat/fixtures/plugin-prune.ts
  - test/architecture/catalog-uat/fixtures/plugin-reinstall.ts
  - test/architecture/catalog-uat/fixtures/plugin-uninstall.ts
  - test/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - test/architecture/notify-stamp-coverage.test.ts
  - test/orchestrators/marketplace/remove.test.ts
  - test/orchestrators/plugin/dependency-declaration-read.test.ts
  - test/orchestrators/plugin/dependency-index.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/reinstall-record.test.ts
  - test/orchestrators/plugin/shared.test.ts
  - test/orchestrators/plugin/uninstall.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/delisted-plugins.test.ts
  - test/orchestrators/reconcile/notify.test.ts
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-10-24
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

I reviewed `git diff 45aa895c -- . ':!.planning'` for DLS-01 / DLS-D1. These
checks ran:

- `node --test` on `dependency-index.test.ts`, `dependency-declaration-read.test.ts`,
  and `delisted-plugins.test.ts`: 68 passed, 0 failed.
- A scratch copy of `apply.test.ts`, kept in the session scratchpad, with two
  probe cases: a delisted plugin with a readable copy that the config disables
  on this pass, and one whose copy declares a dependency that is not installed.
- A scratch copy of `enable-disable.test.ts` with a probe that enables a
  delisted root whose readable copy declares a missing dependency.

These parts are sound:

- **The installed-copy read.** `readInstalledCopyDeclaration` checks
  containment before any open, and it reads the same `MANIFEST_CANDIDATES` walk
  and refusal literal as the own-manifest read. A missing copy, a copy with no
  manifest, and a root outside both owner roots all return `absent`, and the
  caller fails closed with `not in manifest`.
- **Where `not in manifest` comes from.** `readDependencyDeclaration` returns
  `DeclarationLookupResult | OwnManifestRefusal`. `DeclarationLookupResult`
  excludes `absent` (`domain/dependency-closure.ts:74`), and `narrowProbeError`
  never yields `not in manifest`. So `readRecordDeclarations` produces that
  reason only for an entry-absent record whose copy cannot answer. The typed
  check in `enable-disable.ts` therefore cannot match a non-delisted root.
- **Scope locations.** Every walk caller passes the locations of the scope
  whose state it walks, so the `pluginClonesDir` owner root is the right one.

The main defect: the new reconcile row reads the read-pass snapshot. A delisted
plugin that this pass disables, by config or by the load-time dependency hold
that this phase makes possible for delisted plugins, still gets the "enabled
and delisted" row. The probes reproduce both cases.

## Critical Issues

### CR-01: The delisted row reads the pre-apply snapshot, so a plugin this pass disabled still gets it

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1465`, `extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts:85-107`
**Issue:** `reportDelistedPlugins(scope, readResult.state, outcomes)` gets
`readResult.state`. That is the read-pass snapshot (`types.ts:436-443`), taken
before `applyPlan` and the backfill. The `record.enabled` check therefore sees
the state before this pass. `plugin-disabled` and `plugin-dependency-disabled`
are not in `SUPPRESSING_KINDS`. So a plugin that this pass disabled gets a row
that D-08 and the new catalog section both rule out ("A disabled plugin gets no
row"). The row is also a second row for the same plugin, which breaks RECON-04
single-emit.

The second case is new with this phase. Before, the walk failed closed on a
delisted record, so the scope had no holds. Now a delisted plugin whose copy
declares an unsatisfied dependency is held down on the same pass that warns
about it as enabled. Both cases were reproduced against the real apply path:

```text
# config declares gone@mp enabled: false; gone's copy is readable
● mp [project]
  ◍ gone v1.0.0 (disabled)
  ⊘ gone (failed) {not in manifest}
    cause: Plugin "gone" not found in marketplace "mp"
Reconcile: 1 warning, 1 success

# gone's copy declares absent-dep, which is not installed
● mp [project]
  ◍ gone v1.0.0 (disabled) {dependency unsatisfied}
    cause: Install "absent-dep@mp" or uninstall "gone@mp"
  ⊘ gone (failed) {not in manifest}
    cause: Plugin "gone" not found in marketplace "mp"
Reconcile: 2 warnings
```

In both runs the record ends the pass with `enabled: false`. The unit tests
cannot catch this, because `delisted-plugins.test.ts` gives the function a
hand-built state, and no `apply.test.ts` case has a delisted plugin with a
readable copy that the pass disables.

**Fix:** Decide "enabled" by the state after the pass. One way is to also
suppress on the transitions that leave the plugin disabled:

```ts
const SUPPRESSING_KINDS: ReadonlySet<PerEntryOutcome["kind"]> = new Set([
  "plugin-install-failed",
  "plugin-uninstall-failed",
  "plugin-enable-failed",
  "plugin-disable-failed",
  "plugin-uninstalled",
  "plugin-declarer-unreadable",
  "plugin-disabled",            // D-08: ends the pass disabled
  "plugin-dependency-disabled", // D-08: held down this pass
]);
```

`reportUnreadableDeclarer` must keep its own set without the two disable kinds.
REC-05 documents that a success row does not replace the walk's warning. The
other way is to reload the scope's state before the scan. Add an `apply.test.ts`
case for each of the two probes above.

## Warnings

### WR-01: Enabling a delisted root now refuses on the dependency axis before the not-in-manifest refusal

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:633-643`
**Issue:** ATTR-08 treated a root that its marketplace does not list as
declaring nothing. That way the ledger's PI-3 lookup renders the true refusal,
`Plugin "x" not found in marketplace "m"`. The comment at lines 612-618 still
says so. Now `readRecordDeclarations` reads a delisted root's copy, so the
special case applies only when the copy is also unreadable. A delisted root
whose copy declares a missing dependency now refuses with a remedy that cannot
work. The probe output:

```text
⊘ a (failed) {dependency unsatisfied}
  cause: Install missing@official first, then enable a@official.
```

After the user installs `missing`, the enable still fails with "not found in
marketplace". A delisted root whose copy manifest is corrupt now refuses
`{unreadable}` instead. Neither result is on the real failure axis, which is
that the marketplace does not list the plugin. The DLS-01 plan asks the cascade
to read *members* from their copies. The root cannot be enabled at all.

**Fix:** For the root, check whether the manifest lists it before the copy read.
A root the manifest does not list declares nothing, whatever its copy says:

```ts
if (subject.key === rootKey && (await rootIsDelisted(marketplace, subject.name))) {
  return { kind: "found", dependencies: [] };
}
```

`rootIsDelisted` would load the memoized manifest and call `lookupDeclaredPlugin`.
Another way is to have `readRecordDeclarations` return an `entryAbsent` flag on
both arms. Add an `enable-disable.test.ts` case with a delisted root whose
readable copy declares a missing dependency, and assert that the "not found in
marketplace" refusal is returned.

### WR-02: No test covers a git-source delisted record, so the plugin-clones owner root is unproven

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:302-303`, `test/orchestrators/plugin/dependency-index.test.ts:799-891`
**Issue:** `readInstalledCopy` passes
`ownerRoots: [marketplace.marketplaceRoot, options.locations.pluginClonesDir]`.
Every new test of the delisted path puts the copy under the marketplace root:
`copyRoot()` is `SCOPE_ROOT/mp/plugins/<p>`, and all seven new cucumber
scenarios use `dir` sources. The one `readInstalledCopyDeclaration` unit test
that names a second root uses a fake clones directory and reads from the
marketplace root. If `pluginClonesDir` were dropped from the list, or the wrong
scope's locations were passed, every test would still pass. Every git-source
delisted plugin would then fail closed with `not in manifest`, which is the
D-03 case this phase exists to fix.
**Fix:** Add a `dependency-index.test.ts` case whose record's `resolvedSource`
is `path.join(LOCATIONS.pluginClonesDir, "<key>", "plugin")`, whose manifest
does not list the record, and whose copy manifest declares a dependency. Assert
the full detail map. Also consider a git-plugin-source row in one of the new
scenarios, such as `update.feature`'s within-range case.

### WR-03: The DLS-01 reinstall test asserts with a standalone negative substring check

**File:** `test/orchestrators/plugin/reinstall-flow.test.ts:2264`
**Issue:** `assert.ok(!notifications[0]!.message.includes("unreadable"))`
passes for any notification that lacks that word. That includes a wrong cascade,
a missing `bad` row, or the wrong reason on `good`. `typescript-unit-tests`
`rules/cases.md` forbids standalone negative assertions and requires whole-value
comparisons. The partition check above it does not check the row content either.
**Fix:** Compare the whole notification with `assert.deepStrictEqual`, as the
D-18-17 sibling case below it does for its walk cause:
`[{ message: "<the full cascade body>", severity: "<severity>" }]`.

## Info

### IN-01: The enable cascade's doc comment describes the old root rule

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:612-618`
**Issue:** The comment says the exception is for a root "when its manifest is
readable and its own entry is simply absent". The new inline comment at line
635 and the code now require that the installed copy also cannot be read.
**Fix:** Change the comment to match the new condition, or to match whatever
rule WR-01 settles on.

### IN-02: The new module comment cites a milestone version and tells the history

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts:6-9`, `docs/output-catalog.md:3896`
**Issue:** "Pi keeps the plugin running (v1.18), and the dependency walk now
reads ... so the warning can no longer come from the walk failing" uses a
milestone marker (`v1.18`) and change narrative ("now", "no longer"). The
comment policy keeps only decision and requirement IDs. Readers of the output
catalog also cannot tell what `v1.18` means, because the package version is
0.19.x.
**Fix:** "Pi keeps the plugin running (DLS-D1) and the walk reads its
declarations from its installed copy, so this row is derived from the records
and their loaded manifests, not from a walk failure." In the catalog, drop
"(v1.18)".

### IN-03: The installed-copy containment admits any root under either owner root

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts:328-343`, `:244-261`
**Issue:** The check does not depend on source kind or key. It admits a
git-source record's root inside the marketplace clone, and a root inside another
record's `plugin-clones/<key>/`. NFR-10 asks for the *owning* clone root. The
check also stops at `pluginRoot`. `isRegularFile` uses `stat`, which follows
links, so a symlinked `.claude-plugin/` or `plugin.json` under the root is read
even when it points outside both roots. This matches D-03 and the entry-path
read's existing behavior. The read is read-only and keeps only `dependencies`.
**Fix:** No change is required for this phase. If NFR-10 should be strict here,
derive the single owner root from the record's source kind. Use `lstat`, or
`assertPathInside(ownerRoot, candidatePath)`, on the candidate.

### IN-04: The docs promise that every copy-unreadable delisted plugin gets the walk's row

**File:** `docs/output-catalog.md:3896`
**Issue:** "A plugin whose installed copy cannot be read gets the
dependency-check row above instead" holds only for the first record that ends
the walk. The walk stops there (`dependency-index.ts:354-357`). A second
delisted plugin whose copy is also gone gets the upstream-cause row instead.
**Fix:** Write "The first plugin the dependency check cannot read gets the
dependency-check row above instead", or say that only one such plugin per scope
carries the fuller cause.

### IN-05: The `?? ""` fallback would resolve against the process cwd

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:302`
**Issue:** `marketplace.plugins[name]?.resolvedSource ?? ""` sends `""` to
`assertPathInside`, which runs `path.resolve("")`, the process cwd. No
production caller reaches this today. The walks iterate recorded plugins, and
`enable-disable.ts` and `shared.ts` check the record first. But if Pi runs from
inside a dir-source marketplace checkout, a later caller would read the
checkout's `.claude-plugin/plugin.json` as the declarations of a name that has
no record.
**Fix:** If no record exists, return `{ kind: "absent" }` without reading:

```ts
const record = ownValue(marketplace.plugins, name);
if (record === undefined) {
  return Promise.resolve({ kind: "absent" });
}
```

---

_Reviewed: 2026-10-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

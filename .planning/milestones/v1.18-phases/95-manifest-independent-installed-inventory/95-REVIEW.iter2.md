---
phase: 95-manifest-independent-installed-inventory
reviewed: 2026-08-08T19:11:13Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - tests/edge/handlers/tools.test.ts
  - tests/orchestrators/plugin/list-manifest-absent.test.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 95: Code Review Report

**Reviewed:** 2026-08-08T19:11:13Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the diff `60123d33^..HEAD` for INV-01..05 and BOUND-03: the
`{not in manifest}` inventory brace, the absence-reason prepend on degraded
rows, the `ScopedManifest` threading that gates the absence claim on a
successful manifest read, and the widened LLM-tool reason projection.

Gate status is green: `tsc --noEmit` clean, ESLint clean, Prettier clean, and
`tests/orchestrators/plugin/list-manifest-absent.test.ts`,
`tests/edge/handlers/tools.test.ts`, `tests/orchestrators/plugin/list.test.ts`,
`tests/architecture/catalog-uat.test.ts`,
`tests/architecture/no-orchestrator-network.test.ts`,
`tests/architecture/notify-closed-set-locks.test.ts`,
`tests/integration/fold-adoption.test.ts`, `tests/orchestrators/edge-deps.test.ts`
and `tests/orchestrators/plugin/info.test.ts` all pass. Green gates are not
evidence of correctness, and two behavioral defects survive them.

The load-bearing concerns:

1. The LLM-tool reason projection was widened by exactly two arms and left a
   third arm — `partially-upgradable` — still discarding its REQUIRED `reasons`,
   while the function's new doc comment claims the set is complete. This is
   reproduced below: the slash command prints `{lsp}` and the tool payload
   prints nothing.
2. On the cross-scope orphan fold, the absence claim is judged against the
   PROJECT record's `manifestPath`, which is not necessarily the manifest the
   rendered block header names. BOUND-03 closed the "read vs. not read" axis but
   left the "which manifest" axis open, and the new brace makes a previously
   inert ambiguity produce a false user-facing claim. Also reproduced below.

Beyond those, the change silently invalidated a contract comment in
`shared/notify.ts` (the "SOLE site for plugin-row grammar"), shipped two new
user-visible row forms with no `docs/output-catalog.md` state and therefore no
byte-equality gate, and added two never-exercised fixture options to the new
test file.

## Critical Issues

### CR-01: `partially-upgradable` rows silently drop their reasons on the LLM tool payload

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:365-392`

**Issue:** The diff widened `pluginReasons` from
`{unavailable, partially-available, upgradable}` to add `installed` and
`partially-installed`, and replaced the doc comment with the claim:

> INV-05 / D-95-06: **every** list-surface variant that carries typed reasons
> forwards them here

That claim is false. `PluginPartiallyUpgradableMessage` declares
`readonly reasons: readonly ContentReason[]` as a REQUIRED field
(`shared/notify.ts:891-902`), `orchestrators/plugin/list.ts:486-501` populates it
with `narrowUnsupportedKinds(candidateResolved.unsupported)`, and
`projectRowStatus` flattens `partially-upgradable` onto the coarse `installed`
tool bucket (`tools.ts:168-172`). `pluginReasons` has no
`partially-upgradable` arm, so it falls through to `return undefined` at
`tools.ts:391` and the degradation detail is discarded.

This is precisely the loss INV-05 was written to close. The requirement's own
rationale enumerates the flattening as the problem:

> `projectRowStatus` already flattens `installed`, `upgradable`,
> `partially-installed`, and **`partially-upgradable`** into a single `installed`
> tool status, so a degraded install is today indistinguishable from a clean one
> and its unsupported-kind reasons are discarded.

Four statuses named, three fixed. An agent reading `details.plugins` cannot tell
a clean install from one whose upgrade candidate would drop its LSP servers,
which is exactly the fact it needs to decide whether to propose `update`.

Reproduced against a `partially-upgradable` fixture (installed `fup@1.0.0`,
manifest candidate `1.0.1` declaring `lspServers`, the same shape as
`tests/orchestrators/plugin/list.test.ts:774-797`):

```text
SLASH SURFACE (listPlugins):
● mp1 [user]
  ● fup v1.0.0 (partially-upgradable) {lsp}

TOOL SURFACE (pi_claude_marketplace_plugin_list):
Marketplace mp1 (user)
  [installed] fup  1.0.0

TOOL DETAILS:
{ "plugins": [ { "marketplace": "mp1", "scope": "user", "name": "fup",
                 "status": "installed", "version": "1.0.0" } ] }
```

**Fix:** Add the missing arm so the widened set actually matches the comment.
`partially-upgradable` carries REQUIRED `reasons`, so it belongs in the same
block as the other required-`reasons` arms:

```ts
  if (
    p.status === "unavailable" ||
    p.status === "partially-available" ||
    p.status === "upgradable" ||
    p.status === "partially-installed" ||
    p.status === "partially-upgradable"
  ) {
    return p.reasons.length > 0 ? p.reasons : undefined;
  }
```

Add a regression test mirroring the existing
`"force-installed plugin projects [installed] with version through execute"`
case, asserting `details.plugins[0].reasons` deep-equals `["lsp"]` for the
`partially-upgradable` fixture. If forwarding this arm is deliberately out of
scope, then the doc comment at `tools.ts:366-370` must be corrected to name the
exception rather than claiming completeness, and the gap logged in
`deferred-items.md`.

## Warnings

### WR-01: the fold path judges absence against a manifest the block header does not name

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:1031-1057`, `:795`

**Issue:** BOUND-03 threads `ScopedManifest` so a folded row cannot claim an
absence about a manifest that never loaded. It does not address which manifest
the claim is about. The folded rows are enumerated with `projectScopedManifest`
— loaded from `projectMp.manifestPath` — but they are rendered under the
USER-scope block header, whose own rows are judged against `userMp.manifestPath`.

`isCloneOfUserMarketplace` (`list.ts:881-893`) decides the fold on
`marketplaceRoot` equality ALONE and never compares `manifestPath`. Divergence is
reachable, not hypothetical: `marketplace add` derives
`marketplaceRoot = dirname(dirname(manifestPath))` when the source path names a
manifest FILE rather than a directory
(`orchestrators/marketplace/add.ts:816-835`), so a marketplace added by directory
in one scope and by an explicit `<root>/.claude-plugin/<other>.json` file in the
other yields two records with the same `marketplaceRoot` and different
`manifestPath`. The fold fires and the two blocks disagree about the manifest.

Because `foldedNames` suppresses the user-side `(available)` enumeration
(`list.ts:1086`, `:823-831`), the plugin appears exactly once, carrying a false
claim:

```text
OUT:
● mp1 [user]                                     <- this manifest DECLARES alpha
  ● alpha [project] v1.0.0 (installed) {not in manifest}
```

Before this diff the divergence was inert (no brace was rendered at all). The
new brace turns it into a user-visible false statement about the marketplace
named in the header.

**Fix:** Either tighten the clone predicate so the fold only fires when both
records agree on the manifest, or judge the folded rows against the manifest that
owns the block. The predicate tightening is the smaller change and keeps the
claim honest by construction:

```ts
function isCloneOfUserMarketplace(projectMp, userMp): boolean {
  if (projectMp === undefined || userMp === undefined) {
    return false;
  }

  // The fold renders project rows under the USER block header, so an absence
  // claim is only meaningful when both records name the same manifest.
  return (
    projectMp.marketplaceRoot === userMp.marketplaceRoot &&
    projectMp.manifestPath === userMp.manifestPath
  );
}
```

If the predicate must stay root-only for fold-adoption compatibility
(`tests/integration/fold-adoption.test.ts`), pass the USER block's
`scopedManifest` into the fold enumeration instead of the project one, and add a
characterization test for the divergent-`manifestPath` shape either way.

### WR-02: `shared/notify.ts` now documents behavior the change removed

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2171-2179`

**Issue:** `renderPluginRow` is annotated as the "SOLE site for plugin-row
grammar (SNM-17)". Its `installed` arm comment still reads:

> The list inventory row OMITS `reasons` (the orphan-rewake warning is an
> install-cascade surface, not a steady-state inventory surface), so it renders
> byte-identically to a bare `(installed)` row.

`list.messaging.ts:111` now passes `p.reasons` and `list.ts:525-527` stamps
`["not in manifest"]`, so both halves of that sentence are false. The file was
not touched by the diff, but the diff is what invalidated it — a reader auditing
the grammar contract from the sole-authority site will now be misled about the
list surface.

**Fix:** Update the `installed` arm comment in `shared/notify.ts` to state that
the list inventory row forwards DURABLE reasons (the INV-01 absence brace) while
TRANSIENT cascade reasons such as `orphan rewake` remain an install-surface
concern (D-95-02). Keep the citation set intact.

### WR-03: two new user-visible row forms ship with no catalog state and no byte-equality gate

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:103-113`, `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:475-484`

**Issue:** The diff introduces two new rendered forms on the
`/claude:plugin list` surface:

```text
  ● alpha v1.0.0 (installed) {not in manifest}
  ◉ plug v1.0.0 (partially-installed) {not in manifest, lsp}
```

`docs/output-catalog.md` carries a `<!-- catalog-state: ... -->` entry for every
other list-inventory variant — `disabled-inventory`, `remote-inventory`,
`partially-installed-inventory`, `partially-installed-inventory-hooks`,
`partially-upgradable-inventory` — and `tests/architecture/catalog-uat.test.ts`
describes itself as the "BINDING USER-CONTRACT GATE" enforcing byte equality
between `notify()` and the catalog. Neither new form has a catalog state, so
neither is covered by that gate; the only protection is the orchestrator-level
assertions in the new test file.

A concrete consequence: severity is unasserted. The new tests capture severity
(`list-manifest-absent.test.ts:64-66`) but no test asserts it. `severity: "info"`
is stamped at `list.ts:540` and reduced by `cascadeSeverity`
(`notify.ts:2494-2506`), so a future producer that stamps `warning` alongside the
brace would flip `/claude:plugin list` from info to warning with no failing test.

**Fix:** Add two catalog states under the `/claude:plugin list` section —
e.g. `manifest-absent-inventory` and `manifest-absent-partially-installed-inventory`
— with their fenced expected blocks, and register matching `CatalogFixture`
entries (with `expectedSeverity` omitted, i.e. info) in
`tests/architecture/catalog-uat.test.ts`. That restores parity with every sibling
inventory row and puts the new forms under the binding gate.

### WR-04: speculative, never-exercised fixture options in the new test file

**File:** `tests/orchestrators/plugin/list-manifest-absent.test.ts:105-108`, `:137`, `:164-166`

**Issue:** `SeedMarketplaceOpts` declares and implements two options that no test
in the file ever passes:

- `manifestPathOverride?: string` (declared `:105-108`, applied `:164-166`) —
  the BOUND-03 cases it was evidently built for use the separate
  `seedFoldedProjectClone` helper instead (`:533-575`).
- `mcp?: boolean` (declared `:137`, applied `:200`) — only `agents` is exercised
  (`:283`).

`CLAUDE.md` §2 is explicit: "No features beyond what was asked. No
'flexibility' or 'configurability' that wasn't requested." Unused fixture
surface in a file whose stated purpose is byte-exact characterization invites a
future author to reach for the untested path.

**Fix:** Delete `manifestPathOverride` (declaration, doc comment, and the
`:164-166` application) and `mcp` (declaration and the `:200` application). If
`manifestPathOverride` is intended for the ENBL-06 widening noted in the file
header, add it in the phase that uses it.

## Info

### IN-01: a structural guarantee was traded for convention with no compensating gate

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:90-101`

**Issue:** The old `installed` arm passed a literal `undefined`, which made
"no transient cascade reason can reach the steady-state inventory row" a
property of the code. The new comment is candid that this is now convention:
"this map holds no allowlist and renders whatever the orchestrator stamped."
`listPlugins` is currently the only producer of plugin rows for `LIST_CONTEXT`
(`marketplace/list.ts:104` pushes `plugins: []`), so nothing leaks today — but
`PluginInstalledMessage.reasons` also carries `orphan rewake` on the install
cascade, and nothing fails if a future edit routes such a row here.

**Fix:** Add a cheap guard test asserting that no `/claude:plugin list` row ever
renders a transient reason (`orphan rewake` at minimum), or narrow the list
surface's installed row type to the durable reason subset.

### IN-02: line-number cross-references drifted further

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:1203`

**Issue:** The comment cites `assertNever(resolved)` "at list.ts:572". The actual
line was 664 before this diff and is 707 after it. Sibling references to
`docs/output-catalog.md:215-226` (`list.ts:264-265`, `:917`) have the same
brittleness.

**Fix:** Cite the symbol (`availableRowMessage`'s `switch (resolved.state)`
default arm) and the catalog STATE name (`unparseable-mp`) instead of line
numbers. Pre-existing; the diff only widened the drift.

### IN-03: `partiallyInstalledReasons` takes a whole record to read one field

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:320-326`

**Issue:** The helper accepts
`ExtensionState["marketplaces"][string]["plugins"][string]` and reads only
`record.compatibility.unsupported`. The wide parameter obscures the dependency
and forces the deep indexed-access type at the signature.

**Fix:** `function partiallyInstalledReasons(unsupported: readonly string[], notInManifest: boolean)`
and pass `record.compatibility.unsupported` at the single call site (`:479`).

### IN-04: test vocabulary drift — `force-*` where production says `partially-*`

**File:** `tests/edge/handlers/tools.test.ts:536-546`, `:548-557`, `:612-613`

**Issue:** The diff edited these comments but kept "force-installed" /
"force-upgradable" / "Force-installed flattens" while the production tokens,
glyphs, and catalog states are `partially-installed` / `partially-upgradable`.
The test titles read "force-installed row projects to installed tool bucket" for
`projectRowStatus("partially-installed")`.

**Fix:** Rename the touched comments and titles to the current vocabulary while
these lines are already being modified. Untouched `force-*` occurrences
elsewhere in the file are pre-existing and out of scope.

### IN-05: folded rows vanish entirely when the OWNING manifest fails to load (pre-existing, adjacent to BOUND-03)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:923-935`

**Issue:** When the user-scope manifest fails to load, `buildMarketplaceMessage`
returns the bare `(failed)` header with `plugins: []` and DISCARDS `extraPlugins`
— the orphan-folded project-scope installed rows. Plugins materialized on disk
disappear from the listing because a manifest in a different scope could not be
parsed. This is the same failure class BOUND-03 addressed ("the row is preserved
and only the unverified claim is suppressed"), applied one level up.

Pre-existing and untouched by this diff, so out of scope for this phase, but it
sits directly on the boundary Phase 95 was chartered to make honest.

**Fix:** Consider carrying `extraPlugins` onto the failed header, or log it for
the Phase 96 BOUND-01 work, which owns the manifest-read-failure output.

---

_Reviewed: 2026-08-08T19:11:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

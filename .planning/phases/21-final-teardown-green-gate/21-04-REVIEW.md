---
phase: 21-04-gap-closure
reviewed: 2026-05-27T23:50:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 21-04: Code Review Report (Gap Closure Delta)

**Reviewed:** 2026-05-27T23:50:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Scoped review of the G-21-01 gap-closure delta in commit `5a82471` introducing
the list-only `PluginPresentMessage` (`status: "present"`) discriminator. The
inventory-vs-transition split is sound in its motivation -- SNM-15's
"every-status-either-always-or-never-triggers" invariant is correctly
restored. The renderer arm for `"present"` is byte-identical to `"installed"`,
the four exhaustive switches in `tools.ts` were extended in lockstep, and the
two new `notify-v2.test.ts` regression tests cover the inventory-vs-transition
discriminator end-to-end.

However, the delta missed a load-bearing call site inside the same orchestrator
that motivates the change: the orphan-fold filter at
`orchestrators/plugin/list.ts:690` still discriminates on `"installed"`, which
no longer reaches that branch after `installedRowMessage` was rewired to emit
`"present"`. This silently drops every orphan-folded inventory row at runtime
and is reproducible by running `tests/integration/fold-adoption.test.ts` phase
2 (which the commit's `npm run check` apparently does not run, since the test
fails cleanly on the delta but passes on the diff base 7c3145f). The catalog
UAT did not catch this because its `project-orphan-folded` fixture hand-crafts
the post-fold block instead of exercising the orphan-fold pipeline.

Other findings: `notify-types.test.ts` was not extended with `_VPresent` /
negative-presence guards mirroring the discipline applied to the other 10
variants; `sortPluginsInBlock` moves the now-unreachable `"installed"` arm
into the "renderer-as-spec guard" bucket with a `marketplaceScope` fallback
that silently drops `p.scope` if a future regression routes an `"installed"`
row through the list orchestrator; the status-token reference table in the
catalog (lines 111-122) does not list the new `"present"` discriminator
alongside the rendered `(installed)` token it shares; and the catalog status
reference for `(installed)` does not mention the `list` surface even though
`list` now is the dominant emission site for that rendered token.

## Critical Issues

### CR-01: Orphan-fold filter drops every `"present"` row, breaking the project-orphan-folded list surface

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:690`
**Issue:** The fold-carryover filter is unchanged from the pre-delta source:

```typescript
folded = projectSideRows.filter((r) => r.status === "installed" || r.status === "upgradable");
```

But `projectSideRows` is produced by `enumerateMarketplacePlugins`, which
calls `installedRowMessage` for installed records, which now returns either
`PluginPresentMessage` (`status: "present"`) or `PluginUpgradableMessage`
(`status: "upgradable"`) -- **never `"installed"`** (the change at lines
255 and 225-261 hard-routes the list surface to the new token). The
`r.status === "installed"` half of the OR is now structurally unreachable
from this code path. As a result, every `"present"` row gets silently
dropped from the orphan-fold carry-over set, `foldedNames` ends up empty,
and the user-scope enumeration then re-emits the orphan plugin as
`(available)` (because it is in the manifest and absent from the user's
installed set and absent from `foldedNames`).

This is reproducible against `tests/integration/fold-adoption.test.ts`
phase 2, which passes on the diff base `7c3145f` and fails on the delta
with:

```
Expected: ● alpha [project] v1.0.0 (installed)
Actual:   ○ alpha v1.0.0 (available)
```

The catalog `project-orphan-folded` fixture in `catalog-uat.test.ts`
(lines 275-308) does NOT catch the regression because it hand-crafts a
single-block payload with two `"present"` plugin rows inline, bypassing
the orchestrator's two-scope walk and orphan-fold pipeline.

The orchestrator-level `tests/orchestrators/plugin/list.test.ts` corpus
also misses this: there is no test that seeds a user-scope marketplace +
project-scope CLONE record and asserts the rendered output (the
`same-mp-both-scopes` test at lines 385-439 uses independent records with
different marketplaceRoot paths, which by design skips the orphan-fold
branch).

**Fix:** Update the filter to match the new discriminator:

```typescript
folded = projectSideRows.filter((r) => r.status === "present" || r.status === "upgradable");
```

Add a regression test under `tests/orchestrators/plugin/list.test.ts`
that seeds the orphan-fold pre-condition (user-scope marketplace +
project-scope clone with the same `marketplaceRoot`) and asserts the
rendered output contains the expected `● <name> [project] v<ver>
(installed)` orphan-fold row. Without that test the next refactor of
the discriminator (e.g., a future "inventory" / "transition" rename)
will repeat the same silent breakage.

## Warnings

### WR-01: `notify-types.test.ts` missing per-variant invariants for the new `PluginPresentMessage`

**File:** `tests/architecture/notify-types.test.ts:84`
**Issue:** The file's discipline (documented in its header) is to extract
a `_V<Variant>` alias for every member of the `PluginNotificationMessage`
union, then assert per-variant required/forbidden field invariants via
`@ts-expect-error` blocks. The 21-04 delta added a new variant
`PluginPresentMessage` but did NOT add the corresponding `_VPresent`
alias or any of the per-variant guards. Concretely missing:

- `type _VPresent = Extract<PluginNotificationMessage, { status: "present" }>;`
- `// @ts-expect-error -- SNM-10: present has NO cause field`
  `export type _NoCauseOnPresent = _VPresent["cause"];`
- `// @ts-expect-error -- SNM-09: present has NO rollbackPartial field`
  `export type _NoRollbackOnPresent = _VPresent["rollbackPartial"];`
- `// @ts-expect-error -- D-15-01: present has NO reasons field`
  `export type _NoReasonsOnPresent = _VPresent["reasons"];`
- `// @ts-expect-error -- D-15-04: present has NO from field`
  `export type _NoFromOnPresent = _VPresent["from"];`
- `// @ts-expect-error -- D-15-04: present has NO to field`
  `export type _NoToOnPresent = _VPresent["to"];`
- A positive `dependencies REQUIRED` assertion mirroring
  `_Assert_DepsRequiredInstalled` (the `PluginPresentMessage` interface
  at notify.ts:462-468 makes `dependencies` required, so this is the
  load-bearing invariant the present row inherits from `installed`).
- A positive `scope OPTIONAL` assertion mirroring
  `_Assert_ScopeOnInstalled`.
- A positive `version OPTIONAL` assertion mirroring
  `_Assert_VersionOnInstalled`.

Without these guards, a future regression that (e.g.) makes
`PluginPresentMessage.dependencies` optional or adds a `reasons` field
will compile without surfacing the drift -- exactly the failure mode the
other 10 variants are protected against. The file's own header comment
documents this drift-detection contract; the new variant is the only one
not covered.

**Fix:** Add the missing `_VPresent` alias adjacent to the 10 existing
ones (around line 84) and the matching positive + negative-presence
assertion blocks in each of the field sections (`cause`, `rollbackPartial`,
`dependencies`, `reasons`, `from`/`to`, `version`, `scope`). The pattern
to copy is verbatim from the `_VInstalled` blocks (lines 74, 266, 296,
320, 339, 420-end of section, 439, 491, 510, 535).

### WR-02: `sortPluginsInBlock` silently strips `p.scope` from a stray `"installed"` row on the list surface

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:783-792`
**Issue:** The delta reorganises the `scopeOf` arms inside
`sortPluginsInBlock` to move `"installed"` into the
"renderer-as-spec guard" bucket alongside the cascade-only tokens:

```typescript
case "installed":
case "updated":
case "reinstalled":
case "uninstalled":
case "failed":
case "skipped":
case "manual recovery":
  // Unreachable on the list surface; renderer-as-spec guard.
  return marketplaceScope;
```

But `PluginInstalledMessage` carries `scope?: Scope` (SNM-11 / D-13-18),
so an `installed` row CAN legitimately carry a cross-scope orphan-fold
scope value. The previous version of this switch (pre-delta) put
`"installed"` in the scope-bearing arm with `p.scope ?? marketplaceScope`
-- which is the correct treatment for the orphan-fold case. If a future
refactor or partial revert re-routes an `installed` row onto the list
surface (e.g., a different orchestrator that emits cascade-context
`installed` and accidentally feeds `sortPluginsInBlock`), the orphan
scope will be silently overwritten with `marketplaceScope`, breaking the
MSG-GR-3 secondary sort key for cross-scope rows.

The comment label "renderer-as-spec guard" frames this as a defense-in-
depth measure, but the runtime behavior is silent data loss rather than
a loud failure. An `assertNever`-style throw on an unreachable arm
would catch the regression at the call site; folding `"installed"` back
into the scope-bearing arm would preserve correct behavior if the
unreachable assumption is ever violated.

**Fix:** Either (a) move `"installed"` back into the scope-bearing
case-fall-through with `"present"` / `"upgradable"` -- the arm body
`return p.scope ?? marketplaceScope` is correct for both list-surface
and cascade-context installed rows -- or (b) replace the silent
`return marketplaceScope` in the unreachable bucket with a runtime
`throw new Error(...)` that names the violating discriminator so a
future regression surfaces as a loud test failure instead of a silent
sort miscompare. Option (a) is simpler and matches the pre-delta
behavior.

### WR-03: Status-token reference table omits the `"present"` discriminator

**File:** `docs/output-catalog.md:111-122`
**Issue:** The "Status token reference" table enumerates the 10
plugin-status tokens that appear in rendered output. After the delta,
the closed `PluginStatus` set has 11 members (per the new tuple at
`notify.ts:232-244` and the type-level assertion at
`notify-types.test.ts:110`), but the table is unchanged.

The defensible position is that the table documents emitted
`(<token>)` byte-strings rather than discriminators, and `"present"`
emits the same `(installed)` byte-string as `"installed"` -- so the
table is consistent under that reading. But the reload-hint trailer
prose at lines 71-72 introduces `"present"` as a distinct
discriminator name visible to anyone reading the catalog, and the
catalog body for the `unparseable-mp` state at line 218 references
"the other marketplace's `present` plugin row" without the table
having defined the term. This is an inconsistency between two
sections of the same authoritative spec file.

Either add a one-row entry for `"present"` to the table (with a
cross-reference to `"installed"` for the rendered token) or move the
two `"present"` mentions in the prose to use the same vocabulary as
the table (e.g., "the steady-state inventory row that renders as
`(installed)`"). The first option is friendlier to readers who land
on the table first.

**Fix:** Insert a row at the appropriate alphabetical position:
```
| `(installed)` (via `present` discriminator) | ●    | Plugin row -- list surface (steady-state inventory). Byte-identical render to the transition `(installed)` token but does not trigger the reload-hint per SNM-15 / G-21-01. |
```
Or refer the prose at lines 71-72 and 218 to the "Reload-hint trailer"
section by name without using the bare token `present` as if the
reader has seen it in the table.

### WR-04: `(installed)` status reference does not mention the `list` surface

**File:** `docs/output-catalog.md:113`
**Issue:** The status-token reference row for `(installed)` reads:

```
| `(installed)`       | ●    | Plugin row -- install, import cascade, reinstall (rare), update (rare). |
```

After the delta, the `(installed)` byte-string is also (and primarily)
emitted by the `/claude:plugin list` surface via the `present`
discriminator. The 7+ `(installed)` byte occurrences in the catalog's
`## /claude:plugin list` section (lines 155, 174, 177, 188, 189, 200,
201, 202, 213, 228, 239, 242, 246) all flow from `PluginPresentMessage`,
not `PluginInstalledMessage`. The "Where it appears" column should
list `list` alongside `install`, `import cascade`, etc.

**Fix:** Update the row to include `list` in the "Where it appears"
column, e.g.:

```
| `(installed)`       | ●    | Plugin row -- list (steady-state inventory via `present` discriminator), install, import cascade, reinstall (rare), update (rare). |
```

## Info

### IN-01: Comment on `installedRowMessage` says "previous behavior is preserved" but the discriminator changed

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:209-217`
**Issue:** The added doc comment reads:

> "The renderer arm for `"present"` is byte-identical to the `"installed"`
> arm so the human-visible row text `● <name> [<scope>] v<ver>
> (installed)` is preserved."

This is true for the RENDERED output but misleading for downstream
consumers who pattern-match on the `status` field (the LLM tool surface
projection in `tools.ts` is one such consumer; the orphan-fold filter
at line 690 is another -- see CR-01). A small clarifying sentence
noting "downstream `status === 'installed'` checks must be reviewed
when the list orchestrator is the producer" would prevent the same
class of bug from recurring.

**Fix:** Append to the doc comment: "Downstream consumers that switch
on `status` MUST treat the list surface as producing `present`
(steady-state inventory) and the cascade orchestrators as producing
`installed` (transition). See `tools.ts::projectRowStatus` and
`list.ts::loadPluginListPayload` orphan-fold filter for the in-tree
call sites that participate in the discrimination."

### IN-02: Two-argument `compareReasons` mp-skipped invocation passes `mp.reasons` as `readonly string[] | undefined`, suggesting `Reason[]` reverse-narrowing could be tightened

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:675`
**Issue:** Out of scope for the 21-04 delta (the line was unchanged by
this commit), but visible while reviewing the renderer for the
`"present"` arm I'm flagging only as info because the type signature
of `composeReasons` accepts `readonly string[] | undefined` rather
than `readonly Reason[] | undefined`. The header comment at lines
817-822 acknowledges this is intentional ("cross-variant ergonomics"),
but a tighter type would prevent the case where a buggy caller passes
a `readonly string[]` whose members are NOT in the closed `Reason`
set. The renderer would happily emit non-closed-set strings into the
`{<reason>, ...}` brace block, breaking the reasons-rendering invariant
documented at output-catalog.md:56-60.

**Fix:** Out of scope for 21-04; flag for a future hardening pass.
Alternatively, narrow the param type to `readonly Reason[] | undefined`
and verify every call site already passes a closed-set array.

---

_Reviewed: 2026-05-27T23:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

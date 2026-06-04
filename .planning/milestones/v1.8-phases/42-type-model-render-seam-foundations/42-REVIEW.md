---
phase: 42-type-model-render-seam-foundations
reviewed: 2026-06-03T22:30:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/notify-types.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/architecture/catalog-uat.test.ts
  - docs/output-catalog.md
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: fixes_applied
fix_status:
  CR-01: fixed
  WR-01: fixed
  WR-02: fixed
  WR-03: fixed
  WR-04: fixed
  WR-05: fixed
  WR-06: fixed
  IN-01: deferred
  IN-02: deferred
fix_commits:
  - cd0bc40
  - 3704efd
---

# Phase 42: Code Review Report

**Reviewed:** 2026-06-03T22:30:00Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found
**Atomic commit:** `4ee23e6` (verified: 5 files, no out-of-scope additions, npm run check GREEN at HEAD)

## Summary

The atomic-supersession commit delivers the contract artefacts (3-arm
discriminated `NotificationMessage`, new `"not added"` REASON, file-private
`wrapDescription` / `renderMarketplaceInfo` / `renderPluginInfo`, first
catalog state + UAT fixture, type-level proofs + per-status tests). Byte
equality for the 60+ pre-existing cascade fixtures is preserved -- no
mutation to `composeMarketplaceBlock`, `renderMpHeader`, `renderPluginRow`,
`composePluginLines`, `joinTokens`, `composeReasons`, `renderVersion`, or
`renderScopeBracket` (verified by reading the diff and confirming all
helper bodies remain byte-identical). Typecheck + the targeted Phase 42
test files (catalog-uat + notify-types + notify-v2 -- 94 tests) all pass at
commit HEAD.

The execution context note worth scrutinizing -- "Verify the exhaustiveness
argument holds: a 4th variant would actually trigger a TS error" -- does
NOT hold as documented. The `notify()` dispatcher's if/else-if ladder is
missing the canonical `assertNever(message)` call at the function tail,
and the inline comment that promises this gate exists is factually
incorrect. This is the load-bearing NFR-7 finding (CR-01). A second tier
of warnings covers test-discipline gaps, parallel-set-membership risks in
`COMPONENT_KINDS` and the inline `PluginInfoRowBase.status` literal,
duplication between `MarketplaceDetails.lastUpdatedAt?` and
`MarketplaceInfoMessage.lastUpdated?`, an over-permissive INFO-04 carve-
out predicate, and several JSDoc / function-shape quality issues.

## Critical Issues

### CR-01: `notify()` dispatcher lacks `assertNever(message)` exhaustiveness gate; inline comment is factually wrong

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1959-2033`
**Issue:** The dispatcher uses an if/else-if ladder for `message.kind`
narrowing, with comments claiming "the `assertNever` exhaustiveness check
lives on a hypothetical fourth arm via control-flow narrowing" (lines
1955-1958) and "the `assertNever` exhaustiveness gate sits below the
cascade body so a future variant addition (a 4th `kind` literal) compile-
errors" (lines 1998-2002). NEITHER claim is true: there is NO
`assertNever(message)` call anywhere inside `notify()` (verified by
`grep -n "assertNever" notify.ts` -- the relevant hits at 1957/1998/2001
are all inside comments, not code). I confirmed with an isolated TS 5.9.3
strict-mode probe:
- If a 4th variant is added WITHOUT a `marketplaces` field, the cascade
  body's `message.marketplaces.map(...)` errors (TS2339) -- but this only
  catches the leak by side effect; it is NOT an exhaustiveness guarantee.
- If a 4th variant IS added WITH a `marketplaces` field, the cascade body
  type-checks cleanly and the new variant silently routes through the
  cascade renderer at runtime. No compile error, no runtime throw.

This violates NFR-7 (discriminated-union exhaustiveness discipline) and
the canonical pattern established by `renderPluginRow` (line 1296),
`renderMpHeader` (line 974), and `renderPluginInfo` (line 1909) -- all of
which end their switches with `default: { assertNever(p); ... }`.
RESEARCH Pitfall 3 explicitly calls for this pattern.

**Fix:**
```ts
// After the two info-kind arms and BEFORE the cascade body, narrow
// the cascade arm explicitly and assertNever on any unexpected kind:
if (message.kind !== undefined && message.kind !== "cascade") {
  // Exhaustiveness gate -- a future 4th variant compile-errors here
  // because `message` no longer narrows to `never`.
  assertNever(message);
  return;
}

// Cascade arm: message is now narrowed to CascadeNotificationMessage.
const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
// ... rest unchanged
```
Alternatively, rewrite as a switch on `message.kind ?? "cascade"` and
follow the same `assertNever(message); return "";` shape as the renderer
arms below. Either way, the inline comments must match the code that
ships -- the current state is a documentation lie that future engineers
will rely on.

## Warnings

### WR-01: INFO-04 carve-out predicate matches over-broadly; `reasons.includes("not added")` triggers even when other reasons are co-present

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1863`
**Issue:** The carve-out condition is
`plugin.status === "failed" && plugin.reasons?.includes("not added")`. If
a future caller bug constructs `reasons: ["not added", "permission denied"]`,
the renderer silently suppresses the marketplace header and emits the bare
column-0 row -- masking the additional failure reason and the marketplace
context. The carve-out is the only renderer behavior that conditionally
suppresses the marketplace header; the breach signal is silent.

**Fix:** Tighten the predicate to demand "not added" be the SOLE reason,
matching the catalog-state semantics:
```ts
if (
  plugin.status === "failed" &&
  plugin.reasons?.length === 1 &&
  plugin.reasons[0] === "not added"
) {
  return joinTokens([...]);
}
```
Or, better, route the carve-out via a distinct discriminator field on
`PluginInfoMessage` (e.g. `kind: "plugin-info-not-added"`) so the
construction contract is enforced at compile time rather than via reason-
array introspection.

### WR-02: `pluginInfoStatusGlyph` uses if/if/return instead of exhaustive switch; future status addition silently falls through

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1814-1826`
**Issue:** The helper handles `"installed"` and `"available"` via `if`
returns, then falls through to `return ICON_UNINSTALLABLE` for "everything
else" with only a comment ("unavailable | failed -- both use the
prohibited-symbol glyph") to document the intent. If the inline literal
union in `PluginInfoRowBase.status` grows a 5th member (e.g. `"unknown"`),
the new status silently renders with the uninstallable glyph -- no
compile error, no runtime throw. The cascade `renderPluginRow` (line
1176) uses an exhaustive switch + `assertNever` for exactly this reason.

**Fix:**
```ts
function pluginInfoStatusGlyph(status: PluginInfoRow["status"]): string {
  switch (status) {
    case "installed":
      return ICON_INSTALLED;
    case "available":
      return ICON_AVAILABLE;
    case "unavailable":
    case "failed":
      return ICON_UNINSTALLABLE;
    default:
      assertNever(status);
      return "";
  }
}
```

### WR-03: `COMPONENT_KINDS` array duplicates the keys of `PluginInfoComponentsResolved["components"]`; parallel-set-membership drift risk

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1836-1841`
**Issue:** `COMPONENT_KINDS` is a hand-maintained `readonly` array typed
with the literal union of the four component kinds. If a 5th component
kind is added to the `PluginInfoComponentsResolved["components"]` interface
(e.g. `prompts?: readonly string[]`), the type extends correctly but
`COMPONENT_KINDS` will not iterate over it, so the new kind silently
disappears from the render output. There is no compile-time link between
the two declarations.

**Fix:** Either derive the array from the interface keys, or constrain
the array's type so adding a key forces an array update:
```ts
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
// Tuple typed as the exhaustive list -- adding a 5th key to the interface
// causes a type error here unless the tuple is also updated.
const COMPONENT_KINDS: readonly [
  ComponentKind, ComponentKind, ComponentKind, ComponentKind
] = ["agents", "commands", "mcp", "skills"];
```
Better still, iterate `Object.keys(components)` after sorting, so the
renderer is structurally agnostic to the interface shape.

### WR-04: `MarketplaceInfoMessage.lastUpdated?` duplicates `MarketplaceDetails.lastUpdatedAt?`; two sources of truth for the same datum

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:646` (and 661 indirectly via `marketplaceDetails`)
**Issue:** `MarketplaceDetails.lastUpdatedAt?` already exists (line 326)
and is persisted on the marketplace's state record. The new
`MarketplaceInfoMessage.lastUpdated?` field adds a SECOND independent
source of the same ISO8601 timestamp. The renderer
(`renderMarketplaceInfo`, line 1751) reads only the top-level
`message.lastUpdated`, ignoring `message.details.lastUpdatedAt`. The test
fixture at `tests/shared/notify-v2.test.ts:2495-2497` passes BOTH fields,
which obscures the contract: callers will copy-paste this fixture and
populate both, but only one is actually read. Phase 43 will need to
reconcile this when it builds the orchestrator that constructs these
messages.

**Fix:** Drop `MarketplaceInfoMessage.lastUpdated?` and read from
`message.details.lastUpdatedAt` inside the renderer. The conditional
`source.sourceKind === "github"` gate stays on the renderer side.

### WR-05: `wrapDescription` empty-input branch is not exercised by the Phase 42 tests

**File:** `tests/shared/notify-v2.test.ts:2586-2592`
**Issue:** The test "empty description omits the wrap block entirely"
passes `description: ""` to `pluginInfoDescriptionBlock`, but
`renderPluginInfo` short-circuits at line 1894 with
`plugin.description !== undefined && plugin.description.length > 0` --
`wrapDescription("", 4, 66)` is NEVER called. The test verifies that the
renderer skips empty descriptions; it does NOT verify that
`wrapDescription`'s `words.length === 0 -> return []` branch behaves
correctly. The whitespace-only case (e.g. `"   "`) is also unverified --
it would currently bypass `wrapDescription` only if `.length === 0` (it
won't; `"   ".length === 3`), so `wrapDescription` WOULD be called and
WOULD return `[]`. The test naming claims coverage that the test doesn't
provide.

**Fix:** Either (a) export `wrapDescription` behind an `/* @internal */`
JSDoc tag and add direct unit tests covering the 6 edge cases, or (b)
add a test that passes a whitespace-only string (e.g. `"   "`) which
DOES reach `wrapDescription` and exercises the empty-token-filter +
empty-return path. The "exact-fit 66 chars on a word boundary" test
also misses the two-words-summing-to-66 case it claims to cover (it
tests a single 66-char token, which is the over-length case for the
greedy accumulator). Add an explicit two-word case where
`current.length + 1 + word.length === wrapCol`.

### WR-06: Orphaned JSDoc above `pluginInfoStatusGlyph` / misattributed JSDoc on `COMPONENT_KINDS`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1773-1813, 1828-1841`
**Issue:** The JSDoc block at lines 1773-1807 documents
`renderPluginInfo`, but is immediately followed by ANOTHER JSDoc block
(1808-1813) for `pluginInfoStatusGlyph` -- the first block is orphaned
from any declaration. Editors and IDE doc-on-hover will attach the
`renderPluginInfo` documentation to `pluginInfoStatusGlyph` (because
JSDoc binds to the next declaration). Similarly, the JSDoc at lines
1828-1835 documents `appendResolvedComponentLines` but is attached to
the `COMPONENT_KINDS` constant declaration that immediately follows it.
The actual `renderPluginInfo` declaration at line 1859 has NO JSDoc on
it.

**Fix:** Move the `renderPluginInfo` JSDoc (1773-1807) to immediately
precede the `renderPluginInfo` declaration at 1859. Move the
`appendResolvedComponentLines` JSDoc (1828-1835) to immediately precede
the function declaration at 1842, and let `COMPONENT_KINDS` either be
undocumented or carry a short one-line comment.

## Info

### IN-01: `composeMpInfoHeader` duplicates the "details-defined list-surface" sub-branch of `renderMpHeader` instead of sharing primitives

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1723-1726`
**Issue:** The carve-out comment (lines 1709-1718) explains WHY the info
surface emits both `<autoupdate>` and `<no autoupdate>` markers while
the list surface suppresses `<no autoupdate>`. Reasonable. But the
header composition (`${ICON_INSTALLED} ${name} [${scope}] ${marker}`) is
copy-pasted from `renderMpHeader` sub-branch B (lines 956-970) rather
than sharing a `composeMpHeaderPrefix(name, scope)` primitive. A future
naming-convention change to the header prefix has to be replicated in
two places. The duplication is small enough that this is INFO-level,
not a bug.

**Fix:** Extract `composeMpHeaderPrefix(name, scope): string` returning
`${ICON_INSTALLED} ${name} [${scope}]` and have both `composeMpInfoHeader`
and `renderMpHeader` sub-branch B compose against it.

### IN-02: `_probe` parameter on `renderMarketplaceInfo` is unused; consider dropping rather than aliasing

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1743`
**Issue:** `renderMarketplaceInfo(message, _probe)` accepts a
`SoftDepStatus` argument it never uses, aliased to `_probe` to silence
the unused-variable lint. The JSDoc explains this is "for signature
parity with `composeMarketplaceBlock`" -- but `composeMarketplaceBlock`
is not called from the same dispatcher arm, and there is no polymorphic
boundary that requires the signatures to match. `renderPluginInfo`
similarly accepts `probe` but only uses it via `composeReasons`. The
parity argument doesn't pay rent. INFO-level because removing the
parameter is a 1-line change and not a correctness issue.

**Fix:** Drop the `_probe` parameter from `renderMarketplaceInfo`. Keep
the `probe` parameter on `renderPluginInfo` because the carve-out arm
threads it through `composeReasons`.

---

_Reviewed: 2026-06-03T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

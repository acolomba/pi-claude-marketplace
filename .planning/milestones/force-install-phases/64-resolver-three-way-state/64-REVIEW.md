---
phase: 64-resolver-three-way-state
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/index.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - tests/domain/resolver.types.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/domain/resolver-loose.test.ts
  - tests/domain/resolver-comp01.test.ts
  - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
  - tests/architecture/hooks-foundation.test.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The three-way `state: "installable" | "unsupported" | "unavailable"` refactor
is structurally sound. NFR-7 is preserved by construction (the `unavailable`
schema omits `pluginRoot`, `requireForceInstallable` narrows to
`installable | unsupported` only, and the type-level `@ts-expect-error`
guards in `resolver.types.test.ts` / `hooks-foundation.test.ts` lock it). The
`switch (r.state)` / discriminant migrations in `list.ts`, `info.ts`,
`edge-deps.ts`, `install.ts` are each correct three-way handlers, and the two
out-of-scope resolver consumers (`update.ts`, `reinstall.ts`) were already
migrated to `requireInstallable` narrowing, so the union change leaves no
broken callers.

The headline defect is in the *byte-parity of user-facing reason strings*
that the phase explicitly set out to guarantee (D-64-02 / SURF-01). The
"single shared helper" claim holds for `list` and `info` (both route through
`narrowUnsupportedKinds`), but the `install` error surface still classifies
per-kind markers through a *separate* path (`narrowResolverReasons` →
`manifestFieldTokenFromNote`) that does NOT funnel non-`lspServers` kinds
through the shared helper. On a multi-kind `unsupported` plugin the two
surfaces diverge. The parity test misses it because it only exercises
single-element inputs.

## Critical Issues

### CR-01: `install` surface diverges from `list`/`info` on multi-kind unsupported plugins (D-64-02 / SURF-01 parity violation)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1653-1669` (`manifestFieldTokenFromNote`), `:1689-1754` (`narrowResolverReasons`), `:1634` (`MANIFEST_FIELD_REASONS`)
**Also:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:146-160` (`narrowUnsupportedKinds`)

**Issue:** The phase's stated invariant is byte-parity of per-kind unsupported
markers across `list`, `info`, and the `install` error surface, derived from a
single shared helper. `list`/`info` derive markers from the resolver's typed
`unsupported[]` via `narrowUnsupportedKinds`. `install` instead derives them
from the thrown `PluginShapeError.reasons` (the resolver `notes`, i.e.
`"contains <kind>"`) via `narrowResolverReasons` → `manifestFieldTokenFromNote`.
That install path only forwards `lspServers` into the shared helper
(`MANIFEST_FIELD_REASONS` contains only `lspServers`); every other
`"contains <kind>"` note returns `undefined` from `manifestFieldTokenFromNote`,
fails the `reason.includes("source")` check (`"contains themes"` has no
`source` substring), and is **silently dropped** — but only when at least one
*other* note already populated `out`, so the empty-array fallback to
`unsupported source` does not fire.

Reproduced for an `unsupported`-arm plugin declaring both `lspServers` and
`themes` (`unsupported = ["lspServers","themes"]`, `notes = ["contains lspServers","contains themes"]`):

```
list/info (narrowUnsupportedKinds): ["lsp","unsupported source"]
install   (narrowResolverReasons):  ["lsp"]            <-- "unsupported source" dropped
```

So the same plugin renders `(unavailable) {lsp, unsupported source}` under
`/claude:plugin list` and `/claude:plugin info`, but
`(unavailable) {lsp}` under `/claude:plugin install`. This is precisely the
cross-surface inconsistency D-64-02 / SURF-01 claims to eliminate "by
construction rather than by three drift-prone copies." Single-kind cases
match only by coincidence (the `unsupported source` fallback happens to
agree), not structurally.

**Fix:** Route the install error surface's per-kind markers through the same
shared helper instead of the bespoke `narrowResolverReasons` note path. Strip
the resolver's `"contains "` prefix from each non-hooks note and hand the bare
kind tokens to `narrowUnsupportedKinds`, e.g.:

```ts
// In classifyEntityShapeError's not-installable arm, prefer the typed
// shared helper over note re-classification:
const kindTokens = err.shape.reasons
  .filter((n) => n.startsWith("contains "))
  .map((n) => n.slice("contains ".length));
const perKind = narrowUnsupportedKinds(kindTokens); // ["lsp","unsupported source"]
// then merge with the hooks/structural note classification for the rest
```

Or widen `MANIFEST_FIELD_REASONS` / `manifestFieldTokenFromNote` so every
`UNSUPPORTED_COMPONENT_KINDS` member maps through `narrowUnsupportedKinds`
(not just `lspServers`). Either way, the three surfaces must share one
mapping for the per-kind family.

## Warnings

### WR-01: Cross-surface parity test only covers single-element inputs, so it cannot catch CR-01

**File:** `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts:65-98` (`PER_KIND_PARITY_CASES`)
**Issue:** Every `PER_KIND_PARITY_CASES` row passes exactly one kind/note, and
the structural-regression guard at `:106-120` also uses single or
non-overlapping kinds. The single-kind cases agree only because the
`unsupported source` fallback in `narrowResolverReasons` masks the missing
mapping. The suite therefore gives false confidence that the "single shared
helper" invariant holds, while the multi-kind path (CR-01) silently diverges.
**Fix:** Add a multi-kind parity case that pairs the typed list
`["lspServers","themes"]` against the note list
`["contains lspServers","contains themes"]` and asserts both surfaces emit
`["lsp","unsupported source"]`. This case red-fails today and pins the CR-01
fix.

### WR-02: `buildNotInstalledRow` does not catch `derivePluginRootForInfo`'s `PathContainmentError`, unlike `buildInstalledRow`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:865-938` (`buildNotInstalledRow`), `:657-695` (`buildNotInstallablePathRowFields`), `:137-150` (`derivePluginRootForInfo`)
**Issue:** For a path-source plugin whose `source` escapes the marketplace
root, `resolveStrict` returns the `unavailable` arm (note
`"source path escapes marketplace root"`), and `parsePluginSource` still
classifies the source as `kind: "path"`, so `isLocallyResolvable` is `true`.
`buildNotInstalledRow` then calls `buildNonInstallableRowFields` →
`buildNotInstallablePathRowFields` → `derivePluginRootForInfo`, whose
`assertPathInside` throws `PathContainmentError`. That throw is raised
*before* the inner `try` (which wraps only `composeResolvedComponents`), and
`buildNotInstalledRow` does NOT wrap the `buildNonInstallableRowFields` call in
any catch (only the `resolveStrict` call at `:875-892` is guarded). The error
propagates uncaught through `buildBlock` → `getPluginInfo`, surfacing as an
unhandled rejection / command crash rather than the `(unavailable) {unreadable}`
row the `derivePluginRootForInfo` doc comment claims. `buildInstalledRow`
(`:808-856`) wraps the same call in a `try/catch` that classifies via
`narrowProbeError`, so the two callers are asymmetric.
**Fix:** Wrap the `buildNonInstallableRowFields` call in `buildNotInstalledRow`
in the same `try/catch` that `buildInstalledRow` uses, returning an
`(unavailable)` row with `reasons: [narrowProbeError(err)]` and
`componentsResolved: false`. The `derivePluginRootForInfo` comment asserting
the error "surfaces via narrowProbeError's generic-Error arm" is only true for
the installed caller and should be corrected.

### WR-03: Resolver-state branching uses `if`/ternary without `assertNever`, weakening the exhaustiveness the phase emphasizes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:354-369` (`availableRowMessage`), `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:753-777` (`buildNonInstallableRowFields`)
**Issue:** Both sites discriminate the three-way union with
`if (state === "installable") ... else (ternary on "unsupported")`. A future
fourth `ResolvedPlugin` arm would silently fall through the `else`/ternary into
the `unavailable`/`notes` path with no compile-time error, contradicting the
"compile-enforced exhaustiveness" rationale this phase relies on elsewhere
(`isLocallyResolvable` correctly uses `assertNever`). This is defensive only —
no current bug — but the migration left two discriminant reads without the
exhaustiveness guard the codebase otherwise applies.
**Fix:** Convert these to a `switch (resolved.state)` with an `assertNever`
default, or add an explicit `assertNever` on the residual arm so a new state
becomes a typecheck failure here.

## Info

### IN-01: `installable()` and `unsupported()` constructors are near-identical duplicates

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:273-311`
**Issue:** `installable(...)` and `unsupported(...)` differ only in the `state`
literal; the remaining ~12-line payload spread is duplicated. This is
intentional per D-64-06 (the literal tag is the discriminant and a shared
builder would obscure it), so no change is required. Noted only so a future
reviewer does not "deduplicate" them into a parameterized builder that would
weaken the discriminated-union ergonomics. If touched, keep the `state`
literal inline at each call site.

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

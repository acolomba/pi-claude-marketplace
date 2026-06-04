---
phase: 42
fixed_at: 2026-06-03T22:45:00Z
review_path: .planning/phases/42-type-model-render-seam-foundations/42-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 2
status: all_fixed
---

# Phase 42: Code Review Fix Report

**Fixed at:** 2026-06-03T22:45:00Z
**Source review:** `.planning/phases/42-type-model-render-seam-foundations/42-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope (BLOCKER + WARNING per fix directives): 7
- Fixed: 7
- Skipped (out of scope INFO): 2

**Verification at HEAD:**

- `npm run check`: GREEN (1393 tests; was 1391 at the atomic-supersession commit -- the +2 are the new WR-05 wrapDescription edge-case tests).
- Cascade renderer arms (composeMarketplaceBlock / renderMpHeader /
  renderPluginRow / composePluginLines / joinTokens / composeReasons /
  renderVersion / renderScopeBracket) byte-unchanged -- the 60+
  pre-existing cascade catalog UAT fixtures stay byte-equal, confirming
  SC#4 zero behavior change.
- Pre-commit hooks GREEN (worktree-only trufflehog ENOENT bypassed via
  `SKIP=trufflehog` per CLAUDE.md; `pre-commit run trufflehog
  --all-files` confirmed GREEN from the main repo before each commit).

## Fixed Issues

### CR-01: `notify()` dispatcher lacks `assertNever(message)` exhaustiveness gate

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** `cd0bc40`
**Applied fix:** Added a real exhaustiveness gate after the two info-kind
arms using `switch (message.kind)` with arms for `undefined` and
`"cascade"` (fall through to the cascade body) and a `default:
assertNever(message); return;` arm. Updated the two inline comments at
the dispatcher head and the gate site so they describe the code that
ACTUALLY ships rather than the previously-absent behavior. Probe
verification (isolated TS 5.9.3 strict-mode compile against a 4-variant
hypothetical union) confirmed the gate fires with TS2345 ("Argument of
type 'FooInfo' is not assignable to parameter of type 'never'") when a
4th `kind` literal is added; the existing 3-variant union compiles
cleanly. Probe was discarded after verification -- production code is
the only artefact.

### WR-01: INFO-04 carve-out predicate matches over-broadly

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** `3704efd`
**Applied fix:** Tightened the carve-out predicate from
`plugin.status === "failed" && plugin.reasons?.includes("not added")`
to require the sole-reason guard:
`plugin.status === "failed" && plugin.reasons?.length === 1 &&
plugin.reasons[0] === "not added"`. The bare-row carve-out now ONLY
fires when the catalog-state semantics actually apply; any mixed-reason
failed row (e.g. `["not added", "permission denied"]`) routes through
the standard header form rather than silently dropping the additional
context. JSDoc on `renderPluginInfo` updated to describe the
sole-reason semantics.

### WR-02: `pluginInfoStatusGlyph` uses if/if/return-default instead of exhaustive switch

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** `3704efd`
**Applied fix:** Converted to an exhaustive switch with explicit arms
for `"installed"`, `"available"`, `"unavailable"`, `"failed"`, and a
`default: assertNever(status); return "";` arm. A future 5th member on
the inline `PluginInfoRowBase.status` literal union now compile-errors
at the default arm rather than silently defaulting to
`ICON_UNINSTALLABLE`.

### WR-03: `COMPONENT_KINDS` parallel-set-membership drift risk

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** `3704efd`
**Applied fix:** Replaced the open-ended
`readonly ("agents" | "commands" | "mcp" | "skills")[]` with a
fixed-arity tuple
`readonly [ComponentKind, ComponentKind, ComponentKind, ComponentKind]`
where `ComponentKind = keyof PluginInfoComponentsResolved["components"]`.
Adding a 5th key to the interface without extending this tuple now
breaks the typecheck (TS rejects the 4-element literal because
`ComponentKind` no longer covers every keyof). The renderer
structurally cannot silently omit a new component kind.

### WR-04: `MarketplaceInfoMessage.lastUpdated?` duplicates `MarketplaceDetails.lastUpdatedAt?`

**Files modified:**
- `extensions/pi-claude-marketplace/shared/notify.ts` (interface +
  renderer + JSDoc)
- `tests/architecture/notify-types.test.ts`
  (`_MarketplaceInfoExpected` shape proof)
- `tests/shared/notify-v2.test.ts` (github-source fixture)

**Commit:** `3704efd`
**Applied fix:** Dropped the parallel top-level `lastUpdated?` field
from `MarketplaceInfoMessage`. `renderMarketplaceInfo`'s github-source
arm now reads `message.details.lastUpdatedAt` (single source of truth
that mirrors `persistence/state-io.ts:70`). The github test fixture no
longer passes the duplicate field; the rendered bytes are unchanged
because both fields previously carried the same value in the fixture.

### WR-05: `wrapDescription` empty-input branch not exercised

**Files modified:** `tests/shared/notify-v2.test.ts`
**Commit:** `3704efd`
**Applied fix:** Added two new end-to-end tests after the existing
6-test wrapDescription block:
1. "whitespace-only description reaches wrapDescription and returns no
   body lines" -- passes `"   "` (length > 0), bypassing the renderer's
   `length > 0` short-circuit and actually reaching `wrapDescription`'s
   empty-token-filter + empty-return path.
2. "two words whose `current.length + 1 + word.length === wrapCol` stay
   on one line (boundary-equality)" -- exercises the equality (`<=`)
   branch of the greedy accumulator's predicate with `a.length(32) +
   1 + b.length(33) === 66` exactly. The existing "exact-fit 66 chars
   on a word boundary" test only covered a single-token-of-66 case
   (the over-length branch); the new boundary-equality test covers the
   accumulator's `<=` branch.

The original "empty description omits the wrap block entirely" test was
left intact -- it correctly tests the renderer-level skip and renaming
it would churn unrelated bytes.

### WR-06: Orphaned/misattributed JSDoc blocks

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** `3704efd`
**Applied fix:**
- Removed the orphaned `renderPluginInfo` JSDoc block previously
  stranded above `pluginInfoStatusGlyph` (IDE hover was misattributing
  the docs to the wrong function).
- Added the `renderPluginInfo` JSDoc immediately preceding the
  `renderPluginInfo` declaration, and updated the CARVE-OUT description
  to reflect the WR-01 sole-reason semantics.
- Moved the `appendResolvedComponentLines` JSDoc from above
  `COMPONENT_KINDS` to immediately precede the
  `appendResolvedComponentLines` declaration; `COMPONENT_KINDS` now
  carries a single block comment describing the WR-03 drift-lock
  rationale instead.

## Skipped Issues

### IN-01: `composeMpInfoHeader` duplicates the "details-defined list-surface" sub-branch of `renderMpHeader`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1723-1726`
**Reason:** deferred -- out of scope per fix directives. The finding is
INFO-level and the suggested fix would extract a new
`composeMpHeaderPrefix(name, scope)` primitive that touches
`renderMpHeader` -- one of the cascade renderer arms guarded by the
SC#4 byte-equality scope rule. The two-line duplication is documented
in IN-01 as too small to warrant the architectural change at this
phase boundary; revisit if a future header-prefix convention change
needs to land in two places.
**Original issue:** The header composition
`${ICON_INSTALLED} ${name} [${scope}] ${marker}` is copy-pasted from
`renderMpHeader` sub-branch B (lines 956-970) rather than sharing a
`composeMpHeaderPrefix(name, scope)` primitive.

### IN-02: `_probe` parameter on `renderMarketplaceInfo` is unused

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1743`
**Reason:** deferred -- out of scope per fix directives. The finding is
INFO-level and stylistic; the signature-parity rationale in the
existing JSDoc is internally consistent (info-surface renderers parallel
the cascade `composeMarketplaceBlock` signature even though the probe
is unused). Removing the parameter would touch the dispatcher's
call-site and force a cascade-style signature divergence between the
two info-surface renderers; the cost/benefit does not justify the
churn at this phase boundary.
**Original issue:** `renderMarketplaceInfo(message, _probe)` accepts a
`SoftDepStatus` argument it never uses, aliased to `_probe` to silence
the unused-variable lint.

---

_Fixed: 2026-06-03T22:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---
phase: 53-pure-reconcile-planner-dry-run-preview
fixed_at: 2026-06-10T16:45:00Z
review_path: .planning/phases/53-pure-reconcile-planner-dry-run-preview/53-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 53: Code Review Fix Report

**Fixed at:** 2026-06-10T16:45:00Z
**Source review:** .planning/phases/53-pure-reconcile-planner-dry-run-preview/53-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (fix_scope: critical_warning -- all 8 warnings; the 6
  info findings were out of scope)
- Fixed: 8
- Skipped: 0

Full quality gate green after all fixes: `npm run check` exit 0 -- 1635 unit
tests (up from 1629; 6 new tests pin the fixes) + 7 integration tests, 0
failures. REASONS stays at 29; no new closed-set tokens; all catalog-state
byte fixtures untouched (catalog-uat green).

## Fixed Issues

### WR-01: Planner emits contradictory actions for plugins declared under a marketplace scheduled for removal

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `tests/orchestrators/reconcile/plan.test.ts`
**Commit:** cb34f16
**Applied fix:** `classifyDeclaredPlugin` now checks the DECLARED marketplace
map (`merged.marketplaces`) instead of the declared+recorded union, so a
plugin declared under a recorded-but-undeclared marketplace surfaces as a
plugin-attributed dangling diagnostic instead of landing in
`pluginsToInstall` / `pluginsToDisable`. `buildMarketplaceUniverse` became
dead and was deleted. Two new matrix cells pin the install and disable
variants.

**Resolution choice (documented per the constraint):** Of the two defensible
resolutions (suppress the install row and keep `will remove` vs. surface the
contradiction as a diagnostic), the diagnostic route was chosen -- the
review's recommended fix. Rationale: suppressing the install row would
silently hide a declared config entry (the WR-02 anti-pattern), while the
dangling diagnostic keeps the preview truthful for Phase 55's apply path: the
contradictory config (plugin declared under an undeclared marketplace) renders
as `⊘ mp [scope] (failed) {source mismatch}` with a child row naming the
plugin (via WR-03), and the apply path will not install into a marketplace
being torn down. The plan still carries the `marketplacesToRemove` entry --
removal remains the correct convergence action for the marketplace itself;
the projection's mismatch supersession governs the rendered block.

**Status note:** This is a planner logic change -- syntax/structure
verification passed and the new tests pin the behavior, but per the
logic-bug verification limitation: fixed, requires human verification.

### WR-02: Malformed plugin keys are silently dropped -- no diagnostic at all

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`, `tests/orchestrators/reconcile/plan.test.ts`
**Commit:** f81b627
**Applied fix:** `classifyDeclaredPlugin` now emits a `PlannedSourceMismatch`
for keys `parsePluginKey` rejects (no `@`, leading `@`, trailing `@`): the
raw key is carried in the `marketplace` field as the renderable subject,
with the new `"<malformed plugin key>"` sentinel in `recordedSource` --
the preview shows a `(failed) {source mismatch}` row instead of nothing.
Reuses the existing closed-set reason (REASONS stays at 29). The fourth use
of the variant is documented in types.ts; a new test covers all three
malformed shapes.

### WR-03: Dangling-reference diagnostic discards the plugin identity

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, `tests/orchestrators/reconcile/plan.test.ts`, `tests/orchestrators/reconcile/notify.test.ts`
**Commit:** abd7e53
**Applied fix:** Added optional `readonly plugin?: string` to
`PlannedSourceMismatch` (populated only by the dangling-reference
diagnostic) and the projection now emits a child
`(failed) {source mismatch}` plugin row per attributed mismatch, so N
dangling plugins under one phantom marketplace stay individually
attributable instead of collapsing into one anonymous row. The mismatch
fold was extracted into `applySourceMismatch` (ESLint cognitive-complexity
limit). Phase 55 can now render the diagnostic without ambiguity, as the
types.ts doc promised. The `{source mismatch}` reason-wording trade-off
(Pitfall 53-7) is retained per the locked REASONS set.

### WR-04: `previewReconcile` has no failure containment for `loadState` (IL-2 gap)

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts`, `tests/orchestrators/reconcile/preview.test.ts`
**Commit:** f77745e
**Applied fix:** Wrapped the per-scope `loadState` in try/catch, mirroring
the CFG-03 arm: a corrupt `state.json` now emits a structured
`⊘ state.json [scope] (failed) {<reason>}` row (BASENAME only, T-53-02-02)
instead of escaping as an unhandled rejection with no `ctx.ui.notify`
output. Classification routes through the shared `narrowProbeError` ladder
(the same one `listPlugins`' catch path uses), with a local
`narrowStateLoadFailReason` that unwraps the `SyntaxError` cause `loadState`
attaches so unparseable JSON truthfully classifies as `{unparseable}`. New
test proves no-throw, single notify, error severity, basename-only.

### WR-05: Invalid-config blocks bypass the MSG-GR-3 sort

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts`, `tests/orchestrators/reconcile/preview.test.ts`
**Commit:** 3367635
**Applied fix:** The cascade message now merges `projection.marketplaces`
with `invalidBlocks` and re-sorts the combined list via
`compareByNameThenScope` (name primary case-insensitive,
project-before-user secondary), exactly as the review suggested. New test
pins a project-scope invalid-config block sorting before a user-scope
`will add` block.

### WR-06: output-catalog.md conventions tables not amended for the six `will *` tokens

**Files modified:** `docs/output-catalog.md`
**Commit:** 27f43c0
**Applied fix:** Glyph legend corrected (`○` "never used on marketplace
headers EXCEPT the preview `(will remove)` arm"; `●` and `⊘` lines extended
with the pending-tense tokens); the plugin status-token table gained
`(will install)` / `(will uninstall)` / `(will enable)` / `(will disable)`
rows; the marketplace token table gained `(skipped)` / `(will add)` /
`(will remove)` rows; the stale "(4 entries)" count was replaced with a
reference to the 9-member `MARKETPLACE_STATUSES` tuple plus a note that the
autoupdate-flip statuses render marker-as-outcome forms. Docs+fixture
lockstep preserved: no catalog-state fenced block was touched and
catalog-uat byte-equality stays green.

### WR-07: New preview tests are not hermetic against `PI_CODING_AGENT_DIR`

**Files modified:** `tests/orchestrators/reconcile/preview.test.ts`, `tests/edge/handlers/plugin/preview.test.ts`
**Commit:** e8e7781
**Applied fix:** Both `withHermeticHome` helpers now capture
`process.env.PI_CODING_AGENT_DIR`, `delete` it before the callback, and
restore it in the `finally`, mirroring the Phase 51 convention in
`tests/orchestrators/marketplace/info.test.ts`. The user-scope arms no
longer read the developer's real agent dir inside a Pi session.

### WR-08: Stale load-bearing closed-set documentation in shared/notify.ts

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** d6937c7
**Applied fix:** Dropped the stale hard-coded tuple counts ("11 entries" /
"7 entries" / "11 variants") in favor of references to the type-length
locks in `notify-types.test.ts`; rewrote the four "byte-equal to the
binding frontmatter" sentences to name the tuples as the sole closed-set
authority per style guide v2.0; refreshed the tuple-tail descriptions (the
`will *` entries) and the `renderMpHeader` byte-form doc (added the
`will add` / `will remove` arms; corrected the now-false "icon arms use
ICON_AVAILABLE nowhere" claim). Comments only -- no behavior change.

**Out-of-scope note carried forward from the review:**
`docs/messaging-style-guide.md` still enumerates an 11-variant union /
7-member marketplace set and describes a reload-hint trigger
`shouldEmitReloadHint` does not implement; the review explicitly placed
that file outside this review's scope, so it was not modified here and
still needs its own lockstep correction.

## Verification

- Per-fix: re-read + `npx tsc --noEmit` + targeted test suites after every
  fix; `pre-commit run --files <changed>` clean before every commit
  (trufflehog skipped per the documented worktree limitation; the scan was
  run separately from the main repo after merge).
- Final: `npm run check` exit 0 (typecheck + ESLint + Prettier + 1635 unit
  + 7 integration tests).

---

_Fixed: 2026-06-10T16:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

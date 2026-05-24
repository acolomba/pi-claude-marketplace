// shared/constants/marketplace-label-probe.ts
//
// D-14-05 (LOCKED MARKETPLACE_LABEL_PROBE dedup): canonical home of the
// `MARKETPLACE_LABEL_PROBE` sentinel object. Plan 14-03 Task 5 collapses
// the three byte-equal historical definitions into this single module:
//   - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:81
//   - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:60
//   - extensions/pi-claude-marketplace/presentation/marketplace-list.ts:74
// All three sites now import `MARKETPLACE_LABEL_PROBE` from here instead
// of defining a local literal.
//
// Location decision (RESEARCH.md Pitfall 7): the constant is NOT a
// closed-set token (those live in `shared/grammar/`); it is a sentinel
// `SoftDepProbe` value. Co-locating with `shared/grammar/` would force a
// parallel `as const` literal-union design on what is a single object
// value -- awkward. A new `shared/constants/` directory keeps
// `shared/grammar/` strictly scoped to closed-set tokens.
//
// D-11 layering: `shared/` may only import from `platform/` (BLOCK C zone
// in eslint.config.js). The `SoftDepProbe` interface lives in
// `presentation/compact-line.ts`, which `shared/` cannot import from.
// The probe SHAPE -- `{ piSubagentsLoaded: boolean; piMcpAdapterLoaded:
// boolean }` -- is structurally re-declared inline here as the
// `MarketplaceLabelProbeShape` interface, so the constant's type is
// expressed without an upward import. Both `presentation/compact-line.ts
// ::SoftDepProbe` and `MarketplaceLabelProbeShape` are structural
// supersets of one another (TypeScript structural typing), so callers
// can pass `MARKETPLACE_LABEL_PROBE` wherever a `SoftDepProbe` is
// expected without casts.
//
// Semantic rationale (carried forward from the most-commented of the
// three historical definitions at presentation/marketplace-list.ts:65-73):
// `MarketplaceRow` has no `declaresAgents` / `declaresMcp` fields, so the
// renderer's per-row soft-dep marker injection branch in
// `composeReasons` (inside `renderRow`) never fires for marketplace
// rows. The probe is read only when those predicate fields are true on
// the row -- never the case here. The "loaded both" sentinel below is
// the intentional no-op shape: if a caller were to mis-route a row with
// the predicate fields through here, the markers would be suppressed.

interface MarketplaceLabelProbeShape {
  readonly piSubagentsLoaded: boolean;
  readonly piMcpAdapterLoaded: boolean;
}

export const MARKETPLACE_LABEL_PROBE: MarketplaceLabelProbeShape = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

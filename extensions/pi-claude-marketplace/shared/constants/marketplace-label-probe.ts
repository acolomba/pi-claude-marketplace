// shared/constants/marketplace-label-probe.ts
//
// Canonical home of the `MARKETPLACE_LABEL_PROBE` sentinel object, imported
// by the marketplace orchestrators (add.ts, autoupdate.ts) so the constant
// is defined once rather than re-declared per call site.
//
// D-11 layering: `shared/` may only import from `platform/`. The soft-dep
// probe shape is `platform/pi-api.ts::SoftDepStatus`
// (`{ piSubagentsLoaded; piMcpAdapterLoaded }`); it is structurally
// re-declared inline here as `MarketplaceLabelProbeShape` so the constant's
// type is expressed without an upward import. The two interfaces are
// structural supersets, so callers can pass `MARKETPLACE_LABEL_PROBE`
// wherever a `SoftDepStatus` is expected without casts.
//
// Semantic rationale: a marketplace header has no `declaresAgents` /
// `declaresMcp` predicate, so the renderer's per-row soft-dep marker branch
// in `shared/notify.ts::composeReasons` never fires for marketplace rows.
// The "loaded both" sentinel below is the intentional no-op shape: even if a
// row carrying the predicate were mis-routed through here, the
// `requires pi-subagents` / `requires pi-mcp` markers would be suppressed.

interface MarketplaceLabelProbeShape {
  readonly piSubagentsLoaded: boolean;
  readonly piMcpAdapterLoaded: boolean;
}

export const MARKETPLACE_LABEL_PROBE: MarketplaceLabelProbeShape = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

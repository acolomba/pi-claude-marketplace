// presentation/soft-dep.ts -- thin probe-only surface (D-13-07).
//
// The per-row soft-dep markers in compact-line.ts have replaced the
// aggregated-trailer helpers per CMC-12 / CMC-13 / D-13-07. Wave 2
// sub-waves 2a-2c migrate the orchestrator callers to the per-row
// markers; sub-wave 2c finalization may then delete the retired trailer
// helpers from `platform/pi-api.ts`.
//
// Until then, this re-export shim publishes ONLY the 3 probe helpers
// (`hasLoadedPiMcpAdapter`, `hasLoadedPiSubagents`, `softDepStatus`) --
// the renderer (`presentation/compact-line.ts`) consumes `softDepStatus`
// via the injected `SoftDepProbe`. Direct orchestrator callers of the
// retired trailer helpers source them from `platform/pi-api.ts` until
// they migrate to the per-row markers.
export { hasLoadedPiMcpAdapter, hasLoadedPiSubagents, softDepStatus } from "../platform/pi-api.ts";

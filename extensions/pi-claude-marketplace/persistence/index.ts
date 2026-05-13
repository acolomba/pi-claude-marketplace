// persistence/index.ts -- public API surface for the persistence/ tier.
//
// Phase 2 lands locations.ts, state-io.ts, migrate.ts. This barrel re-exports
// the consumer-visible names so callers can import from `../persistence`
// without coupling to internal file layout.

export type { ScopedLocations } from "./locations.ts";
export { locationsFor } from "./locations.ts";

export type { ExtensionState } from "./state-io.ts";
export { DEFAULT_STATE, STATE_SCHEMA, STATE_VALIDATOR, loadState, saveState } from "./state-io.ts";

export { migrateLegacyMarketplaceRecords, persistMigratedState } from "./migrate.ts";

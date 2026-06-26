// orchestrators/marketplace/info.messaging.ts
//
// The `marketplace info` command's co-located notification vocabulary.
//
// D-01 / MOD-01: `marketplace info` emits ONLY standalone info-kind messages
// (`marketplace-info`, `marketplace-info-cascade`, `marketplace-not-added`),
// never a cascade marketplace block. Those standalone kinds route through the
// central `dispatchInfoMessage` standalone path (`isInfoKind`) this phase --
// the same boundary the plugin-info surface keeps -- because the cascade spine
// (`notifyWithContext` -> `emitContextCascade`) handles only marketplace
// cascades, not the standalone info surfaces. INFO_CONTEXT is therefore a
// vocabulary holder (label only) whose plugin render map is over the empty
// plugin-status set; `marketplace info` emits no per-plugin cascade child rows.

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * D-04 / D-05 / MOD-01: the `marketplace info` command context. The standalone
 * info-kind surfaces stay routed through the central `dispatchInfoMessage` path
 * this phase; INFO_CONTEXT owns the localized label and an empty plugin render
 * map (no cascade child rows are emitted by this command).
 */
export const INFO_CONTEXT = {
  Messaging: { label: "Marketplace info" },
  render: {},
} as const satisfies CommandContext<never, never>;

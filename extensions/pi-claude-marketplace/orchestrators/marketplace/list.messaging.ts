// orchestrators/marketplace/list.messaging.ts
//
// The `marketplace list` command's co-located notification vocabulary.
//
// D-01 / MOD-01: `marketplace list` is a status-omitted inventory surface. Each
// record renders one list-arm marketplace header (`● <name> [<scope>]`, plus the
// `<autoupdate>` marker when `details.autoupdate === true`); the marketplace
// block always carries `plugins: []`, so list emits no plugin child rows. The
// list-arm header renders via the central `renderMpHeader` seam the spine reuses
// (the `case undefined:` sub-branches), so LIST_CONTEXT's plugin render map is
// over the empty plugin-status set. The inventory is a bulk surface
// (zero-or-more records) -> Plural cardinality at the call site (OUT-07 / D-12).

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * D-04 / D-05 / MOD-01: the `marketplace list` command context. The status-
 * omitted inventory carries no plugin child rows, so the render map is over the
 * empty plugin-status set; the list-arm header bytes render via the central
 * `renderMpHeader` seam the spine reuses, byte-identical to the legacy path.
 */
export const LIST_CONTEXT = {
  Messaging: { label: "Marketplace list" },
  render: {},
} as const satisfies CommandContext<never, never>;

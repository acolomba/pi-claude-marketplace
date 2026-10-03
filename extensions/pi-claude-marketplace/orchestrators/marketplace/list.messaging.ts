// orchestrators/marketplace/list.messaging.ts
//
// The `marketplace list` command's co-located notification vocabulary.
//
// D-01 / MOD-01: `marketplace list` is a status-omitted inventory surface. Each
// record renders one list-arm marketplace header (`● <name> [<scope>]`, plus the
// `<autoupdate>` marker when `details.autoupdate === true`); the marketplace
// block always carries `plugins: []`, so list emits no plugin child rows. The
// list-arm header renders via the central `renderMpHeader` seam the spine reuses
// (the `case undefined:` sub-branches), so MARKETPLACE_LIST_CONTEXT's plugin policy map is
// over the empty plugin-status set. The inventory is a bulk surface
// (zero-or-more records) -> Plural cardinality at the call site (OUT-07 / D-12).

import type { CommandContext } from "../../shared/notify-context.ts";

/** The command label and complete per-status reason policy. */
export const MARKETPLACE_LIST_CONTEXT = {
  Messaging: { label: "Marketplace list" },
  rowPolicies: {},
} as const satisfies CommandContext<never>;

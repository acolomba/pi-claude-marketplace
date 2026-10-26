// orchestrators/marketplace/add.messaging.ts
//
// The `marketplace add` command's co-located notification vocabulary: its
// `CommandContext` (carrying `Messaging.label` and a policy map over the
// plugin-child-row statuses it emits) for its marketplace notifications.
//
// D-01 / MOD-01: each command owns the statuses, reasons, and policy map of its
// own notifications. The shared spine in `shared/notify-context.ts` dispatches
// them. The marketplace HEADER line (`(added)` / `(failed) {<reason>}`) is
// rendered centrally by the `renderMpHeader` seam that `notifyWithContext` ->
// `emitContextCascade` reuses, so its forms carry no local status declaration.
// The one child row `marketplace add` emits is the `failed` row that carries the
// fetched-URL cause under the GitHub base override (GHB-01), so `failed` is the
// only plugin status in the policy map.

import type { CommandContext } from "../../shared/notify-context.ts";

/** The command label and complete per-status reason policy. */
export const ADD_CONTEXT = {
  Messaging: { label: "Marketplace add" },
  rowPolicies: {
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<"failed">;

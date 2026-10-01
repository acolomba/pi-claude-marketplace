// orchestrators/marketplace/add.messaging.ts
//
// The `marketplace add` command's co-located notification vocabulary: its
// `CommandContext` (carrying `Messaging.label` and a policy map over the
// plugin-child-row statuses it emits) for its marketplace notifications.
//
// D-01 / MOD-01: each command owns the statuses, reasons, and policy map of its
// own notifications. The shared spine in `shared/notify-context.ts` dispatches
// HEADER line (`(added)` / `(failed) {<reason>}`) is rendered centrally by the
// `renderMpHeader` seam that `notifyWithContext` -> `emitContextCascade` reuses,
// so the header bytes stay byte-identical to the legacy path. `marketplace add`
// always emits `plugins: []` (the marketplace block carries no child rows), so
// this command's policy map is over the empty plugin-status set; its `(added)`
// and `(failed) {<reason>}` header forms carry no local status declaration and
// route through the central header seam.

import type { CommandContext } from "../../shared/notify-context.ts";

/** The command label and complete per-status reason policy. */
export const ADD_CONTEXT = {
  Messaging: { label: "Marketplace add" },
  rowPolicies: {},
} as const satisfies CommandContext<never>;

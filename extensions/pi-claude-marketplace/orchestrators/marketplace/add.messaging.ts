// orchestrators/marketplace/add.messaging.ts
//
// The `marketplace add` command's co-located notification vocabulary: its
// `CommandContext` (carrying `Messaging.label` and a render map over the
// plugin-child-row statuses it emits) for its marketplace notifications.
//
// D-01 / MOD-01: each command owns the statuses, reasons, and render map of its
// own notifications. The shared spine in `shared/notify-context.ts` dispatches
// each per-plugin child row through `context.render[status]`; the marketplace
// HEADER line (`(added)` / `(failed) {<reason>}`) is rendered centrally by the
// `renderMpHeader` seam that `notifyWithContext` -> `emitContextCascade` reuses,
// so the header bytes stay byte-identical to the legacy path. `marketplace add`
// always emits `plugins: []` (the marketplace block carries no child rows), so
// this command's render map is over the empty plugin-status set; its `(added)`
// and `(failed) {<reason>}` header forms carry no local status declaration and
// route through the central header seam.

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * D-04 / D-05 / MOD-01: the `marketplace add` command context. `marketplace add`
 * emits no plugin child rows (the marketplace block is always `plugins: []`), so
 * its render map is over the empty plugin-status set (`Record<never, ...>`); the
 * `(added)` / `(failed)` header bytes render via the central `renderMpHeader`
 * seam the spine reuses, byte-identical to the legacy path.
 *
 * D-10: were `marketplace add` to gain a plugin child-row status, the missing
 * render arm would be a TS2741 compile error at this `satisfies` site.
 */
export const ADD_CONTEXT = {
  Messaging: { label: "Marketplace add" },
  render: {},
} as const satisfies CommandContext<never, never>;

// orchestrators/marketplace/autoupdate.messaging.ts
//
// The notification vocabulary for the two commands that share the autoupdate
// orchestrator: `marketplace autoupdate` and `marketplace noautoupdate`. They
// run one boolean-flag orchestrator (`opts.enable`) the way enable/disable do,
// so this single module hosts TWO distinct command contexts.
//
// D-01 / D-10 / MOD-01 / MOD-03: each command owns its OWN mp-status set and its
// OWN render map total over its OWN statuses. `marketplace autoupdate` records
// `autoupdate enabled` (fresh flip) / `skipped {already autoupdate}` (idempotent)
// / `failed`; `marketplace noautoupdate` records `autoupdate disabled` /
// `skipped {already no autoupdate}` / `failed`. All marketplace headers render
// via the central `renderMpHeader` seam the spine reuses; the only per-plugin
// child row either command emits is a synthetic `(failed)` row carrying the
// flip cause, which dispatches through the command render map below (lifted
// verbatim from the central `renderPluginRow` `failed` arm).

import { ICON_UNINSTALLABLE, pluginRow } from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";
import type { PluginFailedMessage } from "../../shared/notify.ts";

/**
 * D-01 / MOD-01: the marketplace-statuses `marketplace autoupdate` owns. The
 * idempotent reason `already autoupdate` comes from the shared idempotent group
 * in `shared/notify-reasons.ts`.
 */
export const AUTOUPDATE_MP_STATUSES = ["autoupdate enabled", "skipped", "failed"] as const;
export type AutoupdateMpStatus = (typeof AUTOUPDATE_MP_STATUSES)[number];

/**
 * D-01 / MOD-01: the marketplace-statuses `marketplace noautoupdate` owns. The
 * idempotent reason `already no autoupdate` comes from the shared idempotent
 * group in `shared/notify-reasons.ts`.
 */
export const NOAUTOUPDATE_MP_STATUSES = ["autoupdate disabled", "skipped", "failed"] as const;
export type NoautoupdateMpStatus = (typeof NOAUTOUPDATE_MP_STATUSES)[number];

/**
 * The single plugin-child-row status either flip command emits: a synthetic
 * `(failed)` row carrying the flip cause. This is the Status set both render
 * maps below are total over (D-10: a missing arm is a TS2741 compile error).
 */
type AutoupdateRowStatus = "failed";

/**
 * The shared `failed` child-row renderer, lifted verbatim from the central
 * `renderPluginRow` `failed` arm. Both contexts reference it so the two render
 * maps stay byte-identical to each other and to the legacy path.
 */
const renderFailedRow: RenderFn<PluginFailedMessage> = (p, probe, mpScope) =>
  pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe);

/**
 * D-04 / D-05 / D-10 / MOD-01 / MOD-03: the `marketplace autoupdate` command
 * context (fresh-flip ON). Its render map is total over the command's plugin-
 * child-row statuses; the `(failed)` arm reproduces the EXACT bytes of the
 * central `renderPluginRow` `failed` arm.
 */
export const AUTOUPDATE_CONTEXT = {
  Messaging: { label: "Marketplace autoupdate" },
  render: {
    failed: renderFailedRow,
  },
} as const satisfies CommandContext<AutoupdateRowStatus, PluginFailedMessage>;

/**
 * D-04 / D-05 / D-10 / MOD-01 / MOD-03: the `marketplace noautoupdate` command
 * context (fresh-flip OFF). A distinct context (distinct `Messaging.label`) with
 * its own render map total over its own statuses (D-10), mirroring the
 * enable/disable split.
 */
export const NOAUTOUPDATE_CONTEXT = {
  Messaging: { label: "Marketplace noautoupdate" },
  render: {
    failed: renderFailedRow,
  },
} as const satisfies CommandContext<AutoupdateRowStatus, PluginFailedMessage>;

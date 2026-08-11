import { ICON_UNINSTALLABLE, pluginRow, type PluginSkippedMessage } from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * info.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin info` (MOD-01).
 *
 * Surface boundary (research Open Question 3): info has TWO rendering surfaces.
 *
 *  1. The STANDALONE `plugin-info` / `plugin-info-cascade` envelopes
 *     (`PluginInfoMessage`, carrying a `PluginInfoRow`) are a SIBLING concept to
 *     cascades -- a different multi-line component-listing surface rendered by
 *     the central `dispatchInfoMessage` path (`isInfoKind`). That standalone
 *     envelope routing STAYS central this phase; it is not a
 *     `PluginNotificationMessage` cascade and cannot route through
 *     `notifyWithContext`. The `marketplace-not-added` standalone likewise stays
 *     central.
 *
 *  2. The cascade `MarketplaceNotificationMessage` block info emits BESIDE the
 *     standalone envelope, carrying a `PluginNotificationMessage` row
 *     byte-identical to the list surface's. There is exactly one: the D-96-04
 *     fetch-skip note a `--fetch` run produces per scope that had nothing to
 *     fetch (`skipped`) -- a state-only block (`not in manifest`) or a
 *     recorded-but-disabled record (`already disabled`), whichever the block
 *     reports through `InfoBlock.skipReason`.
 *
 *     `PLUGIN_INFO_CONTEXT` is total over that one status (D-10). The
 *     standalone `PluginInfoRow` shape cannot express it: its status set admits
 *     no `skipped`.
 *
 *     D-100-08 / ENBL-17: a recorded-but-disabled scope no longer emits a
 *     cascade row here. It goes through the same block builder every other
 *     installed record does and renders as a standalone `(disabled)` info row,
 *     so the second render arm that used to recompose that row is gone rather
 *     than left as a divergent copy of a surface nothing reaches.
 *
 * The shared presentation vocabulary stays central in `shared/notify.ts` (D-11)
 * and is CALLED here, never duplicated.
 */

/**
 * info's cascade-dispatched status set: the D-96-04 fetch-skip note. The
 * standalone info-surface row statuses (`installed` / `available` /
 * `unavailable` / `disabled` / `failed`) live on the SIBLING `PluginInfoRow`
 * shape rendered by the central standalone path, NOT here.
 *
 * This set is COMMAND-LOCAL: widening it amends no closed set in
 * `shared/notify.ts` (`skipped` is already a central `PluginStatus`). What it
 * does amend is the `as const satisfies CommandContext<...>` pin below, which
 * makes a missing render arm a compile error rather than a runtime gap.
 */
export const PLUGIN_INFO_STATUSES = ["skipped"] as const;
export type PluginInfoStatus = (typeof PLUGIN_INFO_STATUSES)[number];

/** info's cascade row message union (the fetch-skip note). */
export type PluginInfoCascadeMsg = PluginSkippedMessage;

/**
 * Render map total over info's cascade-dispatched statuses (D-10). The arm is
 * byte-identical to the list surface's because it DELEGATES to the exported
 * `pluginRow` composer rather than re-joining the tokens, so the fetch-skip
 * note cannot drift from the central renderer's `skipped` arm or from
 * `update`'s precedent.
 */
const PLUGIN_INFO_RENDER: {
  [K in PluginInfoStatus]: RenderFn<Extract<PluginInfoCascadeMsg, { status: K }>>;
} = {
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
};

/**
 * D-04 / D-05: info's `CommandContext` for its cascade-dispatched rows. The
 * `as const satisfies` pin enforces that info supplies both `Messaging.label`
 * and a total render map.
 */
export const PLUGIN_INFO_CONTEXT = {
  Messaging: { label: "Plugin info" },
  render: PLUGIN_INFO_RENDER,
} as const satisfies CommandContext<PluginInfoStatus, PluginInfoCascadeMsg>;

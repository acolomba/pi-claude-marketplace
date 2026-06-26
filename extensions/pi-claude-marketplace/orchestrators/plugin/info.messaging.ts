import {
  ICON_DISABLED,
  composeReasons,
  joinTokens,
  renderScopeBracket,
  renderVersion,
  type PluginDisabledMessage,
} from "../../shared/notify.ts";

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
 *  2. The recorded-but-disabled inventory blocks info emits when a scope holds
 *     the disabled marker ARE cascade `MarketplaceNotificationMessage` blocks
 *     carrying a `disabled` `PluginNotificationMessage` row -- byte-identical to
 *     the list surface's `disabled` row. THIS is the only cascade row info
 *     dispatches, so `PLUGIN_INFO_CONTEXT` is total over exactly the `disabled`
 *     status (D-10).
 *
 * The shared presentation vocabulary stays central in `shared/notify.ts` (D-11)
 * and is CALLED here, never duplicated.
 */

/**
 * info's cascade-dispatched status set: just the recorded-but-disabled
 * inventory row. The standalone info-surface row statuses
 * (`installed` / `available` / `unavailable` / `failed`) live on the SIBLING
 * `PluginInfoRow` shape rendered by the central standalone path, NOT here.
 */
export const PLUGIN_INFO_STATUSES = ["disabled"] as const;
export type PluginInfoStatus = (typeof PLUGIN_INFO_STATUSES)[number];

/** info's cascade row message union (the disabled inventory row only). */
export type PluginInfoCascadeMsg = PluginDisabledMessage;

/**
 * Render map total over info's cascade-dispatched status (D-10). The `disabled`
 * arm is byte-identical to the list surface's `disabled` arm.
 */
const PLUGIN_INFO_RENDER: {
  [K in PluginInfoStatus]: RenderFn<Extract<PluginInfoCascadeMsg, { status: K }>>;
} = {
  disabled: (p, probe, mpScope) =>
    joinTokens([
      ICON_DISABLED,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(disabled)",
      composeReasons(undefined, false, false, probe),
    ]),
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

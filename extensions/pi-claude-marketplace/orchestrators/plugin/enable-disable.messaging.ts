import {
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeReasons,
  installedLikeRow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginSkippedMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * enable-disable.messaging.ts -- the command-local notification vocabulary for
 * BOTH `/claude:plugin enable` and `/claude:plugin disable` (MOD-01). The two
 * verbs share one orchestrator file, so this module declares TWO command
 * contexts -- `ENABLE_CONTEXT` and `DISABLE_CONTEXT` -- each with its OWN render
 * map total over its OWN statuses (D-10). The render-arm bodies are lifted
 * VERBATIM from the central `renderPluginRow` switch; the shared presentation
 * vocabulary stays central in `shared/notify.ts` (D-11) and is CALLED here,
 * never duplicated.
 *
 * UAT-03: the fresh-disable `(disabled)` row's `/reload to pick up changes`
 * trailer is NOT a render concern -- it is gated by the `"disable-cascade"`
 * cascade kind threaded by the disable verb through `notifyWithContext`. The
 * row bytes are byte-identical to the inventory `disabled` row.
 */

/**
 * enable's private status set: a fresh `installed` row, a `skipped` row
 * (already-enabled / not-installed), or a `failed` row.
 */
export const ENABLE_STATUSES = ["installed", "skipped", "failed"] as const;
export type EnableStatus = (typeof ENABLE_STATUSES)[number];

/** enable's row message union. */
export type EnableMsg = PluginInstalledMessage | PluginSkippedMessage | PluginFailedMessage;

/**
 * disable's private status set: a fresh `disabled` row, a `skipped` row
 * (already-disabled / not-installed), or a `failed` row.
 */
export const DISABLE_STATUSES = ["disabled", "skipped", "failed"] as const;
export type DisableStatus = (typeof DISABLE_STATUSES)[number];

/** disable's row message union. */
export type DisableMsg = PluginDisabledMessage | PluginSkippedMessage | PluginFailedMessage;

/**
 * Render map total over enable's OWN statuses (D-10). The fresh `installed` arm
 * is byte-identical to install's installed arm -- the enable verb constructs the
 * row with `dependencies: []`, so the soft-dep markers never append, but the
 * `dependencies.includes(...)` gating is preserved verbatim for byte parity.
 */
const ENABLE_RENDER: { [K in EnableStatus]: RenderFn<Extract<EnableMsg, { status: K }>> } = {
  installed: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      renderVersion(p.version),
      "(installed)",
      p.reasons,
      probe,
    ),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * Render map total over disable's OWN statuses (D-10). The `disabled` arm uses
 * the dedicated `ICON_DISABLED` glyph and carries no reasons (a disabled plugin
 * is in the requested state, not a failure state).
 */
const DISABLE_RENDER: { [K in DisableStatus]: RenderFn<Extract<DisableMsg, { status: K }>> } = {
  disabled: (p, probe, mpScope) =>
    joinTokens([
      ICON_DISABLED,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(disabled)",
      composeReasons(undefined, false, false, probe),
    ]),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * D-04 / D-05: enable's `CommandContext`. The `as const satisfies` pin enforces
 * that enable supplies both `Messaging.label` and a total render map.
 */
export const ENABLE_CONTEXT = {
  Messaging: { label: "Plugin enable" },
  render: ENABLE_RENDER,
} as const satisfies CommandContext<EnableStatus, EnableMsg>;

/**
 * D-04 / D-05: disable's `CommandContext`. Distinct label and render map from
 * `ENABLE_CONTEXT`.
 */
export const DISABLE_CONTEXT = {
  Messaging: { label: "Plugin disable" },
  render: DISABLE_RENDER,
} as const satisfies CommandContext<DisableStatus, DisableMsg>;

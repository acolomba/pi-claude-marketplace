// orchestrators/marketplace/update.messaging.ts
//
// The `marketplace update` command's co-located notification vocabulary.
//
// D-01 / MOD-01: `marketplace update` records a marketplace header of
// `(updated)` (manifest changed and/or cascade ran) or `(skipped) {up-to-date}`
// (no-op), rendered via the central `renderMpHeader` seam the spine reuses. On
// the autoupdate-ON cascade path the marketplace block carries per-plugin child
// rows whose statuses are `updated` / `skipped` / `failed` (produced by
// `outcomeToCascadePluginMessage`); those rows dispatch through this command's
// render map below. The render-map arms are lifted verbatim from the central
// `renderPluginRow` `updated` / `skipped` / `failed` arms, so dispatch is
// byte-identical.

import {
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeReasons,
  composeVersionArrow,
  partiallyInstalledRow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
} from "../../shared/notify.ts";

import type { CommandContext } from "../../shared/notify-context.ts";
import type {
  PluginFailedMessage,
  PluginPartiallyInstalledMessage,
  PluginSkippedMessage,
  PluginUpdatedMessage,
} from "../../shared/notify.ts";

/**
 * The plugin-child-row statuses `marketplace update`'s autoupdate-ON cascade
 * emits: `updated`, `partially-installed`, `skipped`, `failed`. This is the Status
 * set the render map below is total over (D-10: a missing arm is a TS2741
 * compile error). SEV-03 / D-69-01: `partially-installed` joins the set because the
 * autoupdate cascade now TAKES the partial path, so a degrading candidate renders
 * `(partially-installed) {dropped kinds}` instead of `(skipped) {no longer installable}`.
 */
type UpdateRowStatus = "updated" | "partially-installed" | "skipped" | "failed";
export type UpdateRowMsg =
  | PluginUpdatedMessage
  | PluginPartiallyInstalledMessage
  | PluginSkippedMessage
  | PluginFailedMessage;

/**
 * D-04 / D-05 / D-10 / MOD-01 / MOD-03: the `marketplace update` command
 * context. The render map is total over the command's plugin-child-row statuses;
 * each arm reproduces the EXACT bytes of the central `renderPluginRow` arm it
 * lifts, so cascade dispatch through `notifyWithContext` is byte-identical.
 */
export const UPDATE_CONTEXT = {
  Messaging: { label: "Marketplace update" },
  render: {
    // WR-12: thread the optional `reasons` brace, as the central
    // `renderPluginRow` arm and the manual update cascade's map both do. This
    // map is the THIRD render surface reached by an `(updated)` row and the one
    // the autoupdate cascade actually dispatches through, so leaving it unthreaded
    // raises the severity while still dropping the brace.
    updated: (p, probe, mpScope) =>
      joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        composeVersionArrow(p.from, p.to),
        "(updated)",
        composeReasons(
          p.reasons,
          p.dependencies.includes("agents"),
          p.dependencies.includes("mcp"),
          probe,
        ),
      ]),
    // SEV-03 / D-69-01: an autoupdate cascade candidate that re-resolved
    // `partially-available` degraded via the partial path. Reuse `partiallyInstalledRow` --
    // the SOLE composition site (D-11 "call, never duplicate") -- so the
    // `◉ <name> v<version> (partially-installed) {dropped kinds[, requires pi-...]}`
    // bytes stay identical to the install / update success surfaces.
    "partially-installed": (p, probe, mpScope) => partiallyInstalledRow(p, mpScope, probe),
    skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
    failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  },
} as const satisfies CommandContext<UpdateRowStatus, UpdateRowMsg>;

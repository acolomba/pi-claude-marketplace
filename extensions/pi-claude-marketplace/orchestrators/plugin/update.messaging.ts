import {
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeVersionArrow,
  forceInstalledRow,
  installedLikeRow,
  pluginRow,
  type PluginFailedMessage,
  type PluginForceInstalledMessage,
  type PluginForceUpgradableMessage,
  type PluginSkippedMessage,
  type PluginUpdatedMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * update.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin update` (MOD-01). Co-locates update's private status set, its
 * cascade row message shapes, and a render map total over update's OWN statuses
 * (D-10) lifting the matching `renderPluginRow` arm bodies VERBATIM. The shared
 * presentation vocabulary stays central in `shared/notify.ts` (D-11) and is
 * CALLED here, never duplicated.
 */

/**
 * update's private status set. The update cascade emits `updated` rows
 * (carrying the `v<from> → v<to>` arrow), `skipped` rows (up-to-date / benign
 * no-ops), `failed` rows, and -- per XSURF-03 -- a `force-upgradable` row for a
 * manual no-`--force` decline of a force-upgradable plugin.
 */
export const UPDATE_STATUSES = [
  "updated",
  "force-installed",
  "skipped",
  "force-upgradable",
  "failed",
] as const;
export type UpdateStatus = (typeof UPDATE_STATUSES)[number];

/**
 * update's row message union -- the subset of central plugin shapes whose
 * status update emits. `dependencies` stays REQUIRED on the `updated` arm so
 * the soft-dep marker injection fires for exactly that arm (D-06 / TYPE-04).
 */
export type UpdateMsg =
  | PluginUpdatedMessage
  | PluginForceInstalledMessage
  | PluginForceUpgradableMessage
  | PluginSkippedMessage
  | PluginFailedMessage;

/**
 * Render map total over update's OWN statuses (D-10): a missing arm is a TS2741
 * compile error at the `satisfies` site. Arm bodies are byte-identical to the
 * central `renderPluginRow` switch. The `updated` arm threads
 * `dependencies.includes(...)` into `composeReasons` so a companion-extension
 * soft-dep marker can append; `skipped` / `failed` route through `pluginRow`
 * (both declares-flags hard-`false`).
 */
const UPDATE_RENDER: { [K in UpdateStatus]: RenderFn<Extract<UpdateMsg, { status: K }>> } = {
  updated: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      composeVersionArrow(p.from, p.to),
      "(updated)",
      undefined,
      probe,
    ),
  // FSTAT-07 / D-66-04: a force update whose candidate re-resolved `unsupported`
  // reports (force-installed) with the dropped-component detail. WR-03: the
  // shared `forceInstalledRow` threads `dependencies` so the soft-dep markers
  // fire on a degraded update exactly as on a clean `(updated)` row.
  "force-installed": (p, probe, mpScope) => forceInstalledRow(p, mpScope, probe),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  // XSURF-03: the force-upgradable manual update-decline row. Byte-identical to
  // the central `renderPluginRow` arm -- reuses `ICON_INSTALLED` (`●`) because
  // the installed plugin is currently clean. The `--force` trailer is composed
  // centrally by the renderer, not here.
  "force-upgradable": (p, probe, mpScope) =>
    pluginRow(ICON_INSTALLED, p, mpScope, "(force-upgradable)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * D-04 / D-05: update's `CommandContext`. The `as const satisfies` pin enforces
 * that update supplies both `Messaging.label` and a total render map.
 */
export const UPDATE_CONTEXT = {
  Messaging: { label: "Plugin update" },
  render: UPDATE_RENDER,
} as const satisfies CommandContext<UpdateStatus, UpdateMsg>;

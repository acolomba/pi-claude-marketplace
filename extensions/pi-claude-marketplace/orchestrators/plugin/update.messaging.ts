import {
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeVersionArrow,
  partiallyInstalledRow,
  installedLikeRow,
  pluginRow,
  type PluginFailedMessage,
  type PluginPartiallyInstalledMessage,
  type PluginPartiallyUpgradableMessage,
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
 * no-ops), `failed` rows, and -- per XSURF-03 -- a `partially-upgradable` row for a
 * manual no-`--partial` decline of a partially-upgradable plugin.
 */
type UpdateStatus =
  "updated" | "partially-installed" | "skipped" | "partially-upgradable" | "failed";

/**
 * update's row message union -- the subset of central plugin shapes whose
 * status update emits. `dependencies` stays REQUIRED on the `updated` arm so
 * the soft-dep marker injection fires for exactly that arm (D-06 / TYPE-04).
 */
export type UpdateMsg =
  | PluginUpdatedMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage
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
  // WR-12: thread the optional `reasons` brace. This map -- not the central
  // `renderPluginRow` arm -- is what actually renders this verb's rows, so a fix
  // applied only centrally would raise the severity while still dropping the
  // brace.
  updated: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      composeVersionArrow(p.from, p.to),
      "(updated)",
      p.reasons,
      probe,
    ),
  // FSTAT-07 / D-66-04: a partial update whose candidate re-resolved `partially-available`
  // reports (partially-installed) with the dropped-component detail. WR-03: the
  // shared `partiallyInstalledRow` threads `dependencies` so the soft-dep markers
  // fire on a degraded update exactly as on a clean `(updated)` row.
  "partially-installed": (p, probe, mpScope) => partiallyInstalledRow(p, mpScope, probe),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  // XSURF-03: the partially-upgradable manual update-decline row. Byte-identical to
  // the central `renderPluginRow` arm -- reuses `ICON_INSTALLED` (`●`) because
  // the installed plugin is currently clean. The `--partial` trailer is composed
  // centrally by the renderer, not here.
  "partially-upgradable": (p, probe, mpScope) =>
    pluginRow(ICON_INSTALLED, p, mpScope, "(partially-upgradable)", probe),
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

import {
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeReasons,
  composeVersionArrow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  type PluginFailedMessage,
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
 * no-ops), and `failed` rows.
 */
export const UPDATE_STATUSES = ["updated", "skipped", "failed"] as const;
export type UpdateStatus = (typeof UPDATE_STATUSES)[number];

/**
 * update's row message union -- the subset of central plugin shapes whose
 * status update emits. `dependencies` stays REQUIRED on the `updated` arm so
 * the soft-dep marker injection fires for exactly that arm (D-06 / TYPE-04).
 */
export type UpdateMsg = PluginUpdatedMessage | PluginSkippedMessage | PluginFailedMessage;

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
    joinTokens([
      ICON_INSTALLED,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      composeVersionArrow(p.from, p.to),
      "(updated)",
      composeReasons(
        undefined,
        p.dependencies.includes("agents"),
        p.dependencies.includes("mcp"),
        probe,
      ),
    ]),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
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

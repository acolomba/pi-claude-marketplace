import {
  ICON_UNINSTALLABLE,
  pluginRow,
  renderUninstalledRow,
  type PluginFailedMessage,
  type PluginUninstalledMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * uninstall.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin uninstall` (MOD-01). Co-locates uninstall's private status
 * set, its row message shapes, its command-private reason, and a render map
 * total over uninstall's OWN statuses (D-10) lifting the matching
 * `renderPluginRow` arm bodies VERBATIM. Shared presentation vocabulary stays
 * central in `shared/notify.ts` (D-11) and is CALLED here, never duplicated.
 */

/**
 * uninstall's private status set: a success `uninstalled` row or a `failed`
 * row. NO soft-dep marker ever appears on either row (MSG-SD-3) -- neither arm
 * declares `dependencies`, so `composeReasons` receives both flags `false`.
 */
type UninstallStatus = "uninstalled" | "failed";

/**
 * uninstall's row message union -- the subset of central plugin shapes whose
 * status uninstall emits.
 */
type UninstallMsg = PluginUninstalledMessage | PluginFailedMessage;

/**
 * Render map total over uninstall's OWN statuses (D-10): a missing arm is a
 * TS2741 compile error at the `satisfies` site. Arm bodies are byte-identical
 * to the central `renderPluginRow` switch.
 */
const UNINSTALL_RENDER: {
  [K in UninstallStatus]: RenderFn<Extract<UninstallMsg, { status: K }>>;
} = {
  uninstalled: (p, probe, mpScope) => renderUninstalledRow(p, probe, mpScope),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * D-04 / D-05: uninstall's `CommandContext`. The `as const satisfies` pin
 * enforces that uninstall supplies both `Messaging.label` and a total render
 * map.
 */
export const UNINSTALL_CONTEXT = {
  Messaging: { label: "Plugin uninstall" },
  render: UNINSTALL_RENDER,
} as const satisfies CommandContext<UninstallStatus, UninstallMsg>;

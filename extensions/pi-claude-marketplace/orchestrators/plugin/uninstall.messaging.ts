import {
  ICON_AVAILABLE,
  ICON_UNINSTALLABLE,
  composeReasons,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
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
export const UNINSTALL_STATUSES = ["uninstalled", "failed"] as const;
export type UninstallStatus = (typeof UNINSTALL_STATUSES)[number];

/**
 * uninstall's row message union -- the subset of central plugin shapes whose
 * status uninstall emits.
 */
export type UninstallMsg = PluginUninstalledMessage | PluginFailedMessage;

/**
 * uninstall's command-private reason. `not installed` is surfaced when the
 * target plugin is not present in the resolved scope. The failure-class reasons
 * uninstall also narrows to (`invalid manifest`, `concurrently uninstalled`,
 * ...) are shared topic reasons owned by `shared/notify-reasons.ts`.
 */
export type UninstallPrivateReason = "not installed";

/**
 * Render map total over uninstall's OWN statuses (D-10): a missing arm is a
 * TS2741 compile error at the `satisfies` site. Arm bodies are byte-identical
 * to the central `renderPluginRow` switch.
 */
const UNINSTALL_RENDER: {
  [K in UninstallStatus]: RenderFn<Extract<UninstallMsg, { status: K }>>;
} = {
  uninstalled: (p, probe, mpScope) =>
    joinTokens([
      ICON_AVAILABLE,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(uninstalled)",
      composeReasons(undefined, false, false, probe),
    ]),
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

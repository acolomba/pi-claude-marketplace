// orchestrators/marketplace/remove.messaging.ts
//
// The `marketplace remove` command's co-located notification vocabulary: its
// `CommandContext` (carrying `Messaging.label` and a render map over the
// plugin-child-row statuses it emits), the mp-status set it owns, and its
// command-private reason.
//
// D-01 / MOD-01: `marketplace remove` emits a marketplace block whose header is
// `(removed)` (clean) or `(failed)` (partial), with child plugin rows: one
// `(uninstalled)` (○) per successfully unstaged plugin and, on the partial arm,
// one `(failed)` (⊘) per plugin whose cascade failed. The header line renders
// via the central `renderMpHeader` seam the spine reuses; the per-plugin child
// rows render through this command's render map below. The render-map arms are
// lifted verbatim from the central `renderPluginRow` `uninstalled` / `failed`
// arms, so dispatch is byte-identical.

import {
  ICON_AVAILABLE,
  ICON_UNINSTALLABLE,
  composeReasons,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
} from "../../shared/notify.ts";

import type { CommandContext } from "../../shared/notify-context.ts";
import type { PluginFailedMessage, PluginUninstalledMessage, Reason } from "../../shared/notify.ts";

/**
 * D-01 / MOD-01: the marketplace-statuses `marketplace remove` owns. A clean
 * removal records `(removed)`; a partial cascade failure records `(failed)`.
 * Both header forms render via the central `renderMpHeader` seam the spine
 * reuses.
 */
export const REMOVE_MP_STATUSES = ["removed", "failed"] as const;
export type RemoveMpStatus = (typeof REMOVE_MP_STATUSES)[number];

/**
 * D-09 / MOD-01: the command-private reason owned by `marketplace remove`.
 * `plugins remain` is meaningful only to the remove flow (a marketplace that
 * cannot be removed because plugins are still recorded under it). It is a member
 * of the closed `Reason` set; the pin below rejects a typo at compile time.
 */
export const REMOVE_PRIVATE_REASONS = ["plugins remain"] as const;
// `_ReasonInSet<R extends Reason> = R` pins the private reason to the closed
// `Reason` set as it derives `RemovePrivateReason`: an out-of-set literal
// violates the `extends Reason` constraint -- a TS2344 compile error here, with
// no runtime footprint.
type _ReasonInSet<R extends Reason> = R;
export type RemovePrivateReason = _ReasonInSet<(typeof REMOVE_PRIVATE_REASONS)[number]>;

/**
 * The plugin-child-row statuses `marketplace remove` emits inside its cascade:
 * `uninstalled` (one per unstaged plugin) and `failed` (one per cascade
 * failure, partial arm). This is the Status set the render map below is total
 * over (D-10: a missing arm is a TS2741 compile error).
 */
type RemoveRowStatus = "uninstalled" | "failed";
export type RemoveRowMsg = PluginUninstalledMessage | PluginFailedMessage;

/**
 * D-04 / D-05 / D-10 / MOD-01 / MOD-03: the `marketplace remove` command
 * context. The render map is total over the command's plugin-child-row statuses;
 * each arm reproduces the EXACT bytes of the central `renderPluginRow` arm it
 * lifts, so cascade dispatch through `notifyWithContext` is byte-identical.
 */
export const REMOVE_CONTEXT = {
  Messaging: { label: "Marketplace remove" },
  render: {
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
  },
} as const satisfies CommandContext<RemoveRowStatus, RemoveRowMsg>;

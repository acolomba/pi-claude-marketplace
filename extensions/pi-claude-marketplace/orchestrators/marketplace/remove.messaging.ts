import { renderDependentKeys } from "../../domain/dependencies.ts";
import { type PluginFailedMessage } from "../../shared/notification-types.ts";
import { type PluginUninstalledMessage } from "../../shared/notification-types.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

type RemoveRowStatus = "uninstalled" | "failed";
export type RemoveRowMsg = PluginUninstalledMessage | PluginFailedMessage;

/** The command label and complete per-status reason policy. */
export const REMOVE_CONTEXT = {
  Messaging: { label: "Marketplace remove" },
  rowPolicies: {
    uninstalled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<RemoveRowStatus>;

/**
 * LAYER-03: the cause line of a remove refused because plugins that stay still
 * declare a plugin the remove would uninstall. It names those plugins and the
 * order that unblocks the remove. T-08-06: `renderDependentKeys` falls back to
 * a count when a key could forge the sentence.
 */
export function composeHeldRemovalCause(
  marketplace: string,
  dependents: readonly string[],
): string {
  return `Uninstall ${renderDependentKeys(dependents)} first, then remove the marketplace ${marketplace} again.`;
}

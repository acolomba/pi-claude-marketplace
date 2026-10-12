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

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * uninstall's private status set: a success `uninstalled` row or a `failed`
 * row. NO soft-dep marker ever appears on either row (MSG-SD-3) -- neither row
 * declares `dependencies`, and the marker policy is off for both.
 */
type UninstallStatus = "uninstalled" | "failed";

/** The command label and complete per-status reason policy. */
export const UNINSTALL_CONTEXT = {
  Messaging: { label: "Plugin uninstall" },
  rowPolicies: {
    uninstalled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<UninstallStatus>;

import type { CommandContext } from "../../shared/notify-context.ts";

type AutoupdateRowStatus = "failed";

/** The command label and complete per-status reason policy. */
export const AUTOUPDATE_CONTEXT = {
  Messaging: { label: "Marketplace autoupdate" },
  rowPolicies: { failed: { markers: false, contentReasons: true } },
} as const satisfies CommandContext<AutoupdateRowStatus>;

/** The command label and complete per-status reason policy. */
export const NOAUTOUPDATE_CONTEXT = {
  Messaging: { label: "Marketplace noautoupdate" },
  rowPolicies: { failed: { markers: false, contentReasons: true } },
} as const satisfies CommandContext<AutoupdateRowStatus>;

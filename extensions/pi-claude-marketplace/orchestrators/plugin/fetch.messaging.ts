import {
  type PluginAvailableMessage,
  type PluginFailedMessage,
  type PluginPartiallyAvailableMessage,
  type PluginRemoteMessage,
  type PluginSkippedMessage,
  type PluginUnavailableMessage,
} from "../../shared/notification-types.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * fetch's private status set. D-81-02: a fetch success renders the plugin's
 * POST-FETCH derived status row -- exactly what `list` / `info` show
 * (`available` / `partially-available` / `unavailable`, plus `remote` for a
 * source that stayed unmaterialized). A no-op (pinned-warm clone or a path
 * source with nothing to fetch) renders `skipped`; a per-plugin fetch failure
 * inside the failure-tolerant sweep renders `failed`.
 */
type FetchStatus =
  "available" | "partially-available" | "unavailable" | "remote" | "skipped" | "failed";

/** fetch's row message union -- the subset of central plugin shapes fetch emits. */
export type FetchMsg =
  | PluginAvailableMessage
  | PluginPartiallyAvailableMessage
  | PluginUnavailableMessage
  | PluginRemoteMessage
  | PluginSkippedMessage
  | PluginFailedMessage;

/** The command label and complete per-status reason policy. */
export const FETCH_CONTEXT = {
  Messaging: { label: "Plugin fetch" },
  rowPolicies: {
    available: { markers: false, contentReasons: false },
    "partially-available": { markers: false, contentReasons: true },
    unavailable: { markers: false, contentReasons: true },
    remote: { markers: false, contentReasons: false },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<FetchStatus>;

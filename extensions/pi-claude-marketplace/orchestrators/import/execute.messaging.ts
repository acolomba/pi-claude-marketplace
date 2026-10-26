import {
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyInstalledMessage,
  type PluginSkippedMessage,
  type PluginUnavailableMessage,
  type PluginUpdatedMessage,
} from "../../shared/notification-types.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * The plugin-row statuses the import cascade emits. Marketplace-level
 * `added` / `updated` / `failed` statuses are rendered by the central
 * `renderMpHeader` seam, not this per-row map; the rows this map dispatches are
 * the per-plugin children: a successful install (`installed`), a re-enabled
 * partial record (`partially-installed`, IMP-10), an already-present skip
 * (`skipped`), a per-plugin failure (`failed`, e.g. source-mismatch or lock
 * held), a plugin that is absent or cannot be installed (`unavailable`), and
 * a dependency an install moved into range first (`updated`, UPD-DEP-D1).
 */
type ImportStatus =
  "installed" | "partially-installed" | "skipped" | "failed" | "unavailable" | "updated";

export type ImportMsg =
  | PluginInstalledMessage
  | PluginPartiallyInstalledMessage
  | PluginSkippedMessage
  | PluginFailedMessage
  | PluginUnavailableMessage
  | PluginUpdatedMessage;

/**
 * D-04 / D-05: import's `CommandContext`. `Messaging.label` is the human
 * operation name `"Import"`. The `rowPolicies` map is total over `ImportStatus`
 * (D-10). import declares no command-private reasons -- it reuses the shared
 * closed reason set (`notify-reasons.ts`).
 */
export const IMPORT_CONTEXT = {
  Messaging: { label: "Import" },
  rowPolicies: {
    installed: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    unavailable: { markers: false, contentReasons: true },
    updated: { markers: true, contentReasons: true },
  },
} as const satisfies CommandContext<ImportStatus>;

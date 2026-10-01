import {
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginSkippedMessage,
  type PluginUnavailableMessage,
} from "../../shared/notification-types.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * The plugin-row statuses the import cascade emits. Marketplace-level
 * `added` / `updated` / `failed` statuses are rendered by the central
 * `renderMpHeader` seam, not this per-row map; the rows this map dispatches are
 * the per-plugin children: a successful install (`installed`), an
 * already-present skip (`skipped`), a per-plugin failure (`failed`, e.g.
 * source-mismatch / not-in-manifest), and a soft-unavailable plugin
 * (`unavailable`).
 */
type ImportStatus = "installed" | "skipped" | "failed" | "unavailable";

export type ImportMsg =
  PluginInstalledMessage | PluginSkippedMessage | PluginFailedMessage | PluginUnavailableMessage;

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
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    unavailable: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<ImportStatus>;

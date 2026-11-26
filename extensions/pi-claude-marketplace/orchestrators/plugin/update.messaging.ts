import {
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyInstalledMessage,
  type PluginPartiallyUpgradableMessage,
  type PluginUpdateSkippedMessage,
  type PluginUpdatedMessage,
} from "../../shared/notification-types.ts";

import { withCloneNote } from "./install.messaging.ts";

import type { CommandContext } from "../../shared/notify-context.ts";
import type { GitHubCloneNotes } from "../github-transport.ts";

/**
 * update's private status set. The update cascade emits `updated` rows
 * (carrying the `v<from> → v<to>` arrow), `skipped` rows (up-to-date / benign
 * no-ops), `failed` rows, and -- per XSURF-03 -- a `partially-upgradable` row for a
 * manual no-`--partial` decline of a partially-upgradable plugin.
 */
type UpdateStatus =
  "updated" | "partially-installed" | "skipped" | "partially-upgradable" | "failed" | "installed";

/**
 * update's row message union -- the subset of central plugin shapes whose
 * status update emits. `dependencies` stays REQUIRED on the `updated` arm so
 * `resolveRows` can compose its soft-dep markers (D-06 / TYPE-04 / D-12).
 */
export type UpdateMsg =
  | PluginInstalledMessage
  | PluginUpdatedMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage
  | PluginUpdateSkippedMessage
  | PluginFailedMessage;

/** The command label and complete per-status reason policy. */
export const UPDATE_CONTEXT = {
  Messaging: { label: "Plugin update" },
  rowPolicies: {
    updated: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    "partially-upgradable": { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    // UPD-DEP-D1: a dependency the update installed or enabled for the new version.
    installed: { markers: true, contentReasons: true },
  },
} as const satisfies CommandContext<UpdateStatus>;

/**
 * D-SG-22: `row` with the clone note `notes` keeps for `subject`,
 * `<plugin>@<marketplace>`, so every update row names the transport of the
 * GitHub clone its plugin ran, whatever its status: an up-to-date or held
 * `skipped` row and a `partially-upgradable` row too. A row whose subject
 * cloned nothing over GitHub is returned unchanged.
 */
export function withUpdateCloneNote(
  row: UpdateMsg,
  notes: GitHubCloneNotes | undefined,
  subject: string,
): UpdateMsg {
  return withCloneNote(row, notes, subject);
}

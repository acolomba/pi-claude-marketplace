import { softDepStatus } from "../platform/pi-api.ts";

import type { SoftDepStatus, ToolInventory } from "../platform/pi-api.ts";

/**
 * D-06: the per-invocation notification run. One command invocation or one
 * load pass opens exactly one run, and every notification it emits reads the
 * run's members. The run carries only the soft-dependency snapshot today; each
 * later member lands with its first reader.
 */
export interface NotificationRun {
  /** D-05: the one soft-dependency snapshot every emission of the run reads. */
  readonly softDeps: SoftDepStatus;
}

/**
 * Opens a notification run over `pi`'s tool inventory. D-05: this is the one
 * soft-dependency probe per run; the snapshot does not follow later changes
 * to the inventory.
 */
export function openNotificationRun(pi: ToolInventory): NotificationRun {
  return { softDeps: softDepStatus(pi) };
}

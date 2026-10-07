import { softDepStatus } from "../platform/pi-api.ts";

import { UnsupportedModeError } from "./errors.ts";

import type { ExtensionMode, SoftDepStatus, ToolInventory } from "../platform/pi-api.ts";

/** The host entry capability used by the notification dispatcher. */
export interface NotificationEntrySink {
  appendEntry(customType: string, payload: unknown): void;
}

/** Narrows an exact runtime mode without normalizing unsupported strings. */
export function requireNotificationMode(mode: string): ExtensionMode {
  if (mode === "tui" || mode === "print" || mode === "json" || mode === "rpc") {
    return mode;
  }

  throw new UnsupportedModeError(mode);
}

/**
 * D-06: the per-invocation notification run. One command invocation or one
 * load pass opens exactly one run, and every notification it emits reads the
 * run's snapshot and original host entry sink. Mode stays on the live context.
 */
export interface NotificationRun {
  /** D-05: the one soft-dependency snapshot every emission of the run reads. */
  readonly softDeps: SoftDepStatus;
  readonly entrySink: NotificationEntrySink;
}

/**
 * Opens a notification run over `pi`'s tool inventory. D-05: this is the one
 * soft-dependency probe per run; the snapshot does not follow later changes
 * to the inventory.
 */
export function openNotificationRun(pi: ToolInventory & NotificationEntrySink): NotificationRun {
  return { softDeps: softDepStatus(pi), entrySink: pi };
}

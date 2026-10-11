import { softDepStatus } from "../platform/pi-api.ts";

import { UnsupportedModeError } from "./errors.ts";

import type { ExtensionMode, PiInventory, SoftDepStatus } from "../platform/pi-api.ts";

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
 * D-05: the per-invocation presentation snapshot, shared by every emission
 * or tool projection in that invocation. Mode stays on the live context.
 */
export interface NotificationSnapshot {
  /** D-05: the one soft-dependency snapshot every emission of the run reads. */
  readonly softDeps: SoftDepStatus;
}

/** Identifies the independent root that owns an emission. */
export type NotificationOrigin =
  | {
      readonly kind: "command";
      readonly commandId: string;
      readonly invocationId: string;
    }
  | { readonly kind: "load" }
  | { readonly kind: "hook" };

/** Carries a root's immutable identity, snapshot, and original host sink. */
export interface NotificationRun extends NotificationSnapshot {
  readonly origin: NotificationOrigin;
  readonly entrySink: NotificationEntrySink;
  readonly commandState?: CommandRunState;
}

/** States of the command's original output transport. */
export const COMMAND_DELIVERY = {
  open: "open",
  recovering: "recovering",
  closed: "closed",
} as const;

/** Completion and delivery facts owned by one command invocation. */
export interface CommandRunState {
  hasOutcome: boolean;
  needsReload: boolean;
  settled: boolean;
  delivery: "open" | "recovering" | "closed";
}

/** Allocates command state before identity or inventory work can fail. */
export function createCommandRunState(): CommandRunState {
  return { hasOutcome: false, needsReload: false, settled: false, delivery: "open" };
}

/** Takes the presentation snapshot used by commands and read-only tools. */
export function openNotificationSnapshot(pi: PiInventory): NotificationSnapshot {
  return { softDeps: softDepStatus(pi) };
}

/**
 * Opens a notification run over `pi`'s tool and command inventory. D-05: this
 * is the one soft-dependency probe per run; the snapshot does not follow later
 * changes to the inventory.
 */
export function openNotificationRun(
  pi: PiInventory & NotificationEntrySink,
  origin: NotificationOrigin,
  commandState?: CommandRunState,
): NotificationRun {
  const state = origin.kind === "command" ? (commandState ?? createCommandRunState()) : undefined;
  return {
    ...openNotificationSnapshot(pi),
    origin: { ...origin },
    entrySink: pi,
    ...(state === undefined ? {} : { commandState: state }),
  };
}

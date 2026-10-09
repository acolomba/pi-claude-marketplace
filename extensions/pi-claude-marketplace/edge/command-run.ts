import { notifyCommandError } from "../shared/notification-dispatch.ts";
import { requireNotificationMode } from "../shared/notification-run.ts";

import type { NotificationContext, ToolInventory } from "../platform/pi-api.ts";
import type {
  NotificationEntrySink,
  NotificationOrigin,
  NotificationRun,
} from "../shared/notification-run.ts";
import type { openNotificationRun } from "../shared/notification-run.ts";

/** Runs selected command work, preserving synchronous text setup exceptions. */
export function runCommand(
  pi: ToolInventory & NotificationEntrySink,
  ctx: NotificationContext,
  commandId: string,
  execute: (run: NotificationRun) => Promise<void>,
  ports: {
    readonly createInvocationId: () => string;
    readonly createRecoveryId: () => string;
    readonly openRun: typeof openNotificationRun;
  },
): Promise<void> {
  let invocationId: string;
  try {
    invocationId = ports.createInvocationId();
  } catch (cause: unknown) {
    const mode = requireNotificationMode(ctx.mode);
    if (mode === "tui" || mode === "print") {
      throw cause;
    }

    // The recovery allocator is a trusted total port; its own failure escapes.
    const origin = { kind: "command", commandId, invocationId: ports.createRecoveryId() } as const;
    notifyCommandError(ctx, pi, origin, false, cause);
    return Promise.resolve();
  }

  const origin = { kind: "command", commandId, invocationId } as const;
  let run: NotificationRun;
  try {
    run = ports.openRun(pi, origin);
  } catch (cause: unknown) {
    notifyCommandError(ctx, pi, origin, false, cause);
    return Promise.resolve();
  }

  return executeCommand(ctx, run, origin, execute);
}

async function executeCommand(
  ctx: NotificationContext,
  run: NotificationRun,
  origin: Extract<NotificationOrigin, { kind: "command" }>,
  execute: (run: NotificationRun) => Promise<void>,
): Promise<void> {
  try {
    await execute(run);
  } catch (cause: unknown) {
    notifyCommandError(ctx, run.entrySink, origin, false, cause);
  }
}

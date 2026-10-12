import { notifyCommandError } from "../shared/notification-dispatch.ts";
import { createCommandRunState, requireNotificationMode } from "../shared/notification-run.ts";

import type { NotificationContext, PiInventory } from "../platform/pi-api.ts";
import type {
  NotificationEntrySink,
  NotificationOrigin,
  NotificationRun,
  CommandRunState,
} from "../shared/notification-run.ts";
import type { openNotificationRun } from "../shared/notification-run.ts";

/** Runs selected command work, preserving synchronous text setup exceptions. */
export function runCommand(
  pi: PiInventory & NotificationEntrySink,
  ctx: NotificationContext,
  commandId: string,
  execute: (run: NotificationRun) => Promise<void>,
  ports: {
    readonly createInvocationId: () => string;
    readonly createRecoveryId: () => string;
    readonly openRun: typeof openNotificationRun;
  },
): Promise<void> {
  const state = createCommandRunState();
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
    finishSetupFailure(ctx, pi, origin, state, cause);
    return Promise.resolve();
  }

  const origin = { kind: "command", commandId, invocationId } as const;
  let run: NotificationRun;
  try {
    run = ports.openRun(pi, origin, state);
  } catch (cause: unknown) {
    finishSetupFailure(ctx, pi, origin, state, cause);
    return Promise.resolve();
  }

  return executeCommand(ctx, run, origin, state, execute);
}

function finishSetupFailure(
  ctx: NotificationContext,
  sink: NotificationEntrySink,
  origin: Extract<NotificationOrigin, { kind: "command" }>,
  state: CommandRunState,
  cause: unknown,
): void {
  try {
    notifyCommandError(ctx, sink, origin, state, cause);
  } finally {
    state.settled = true;
  }
}

async function executeCommand(
  ctx: NotificationContext,
  run: NotificationRun,
  origin: Extract<NotificationOrigin, { kind: "command" }>,
  state: CommandRunState,
  execute: (run: NotificationRun) => Promise<void>,
): Promise<void> {
  try {
    try {
      await execute(run);
    } catch (cause: unknown) {
      notifyCommandError(ctx, run.entrySink, origin, state, cause);
      return;
    }

    if (state.delivery === "open") {
      const mode = requireNotificationMode(ctx.mode);
      if ((mode === "json" || mode === "rpc") && !state.hasOutcome) {
        notifyCommandError(
          ctx,
          run.entrySink,
          origin,
          state,
          new Error("Command returned without an outcome."),
        );
      }
    }
  } finally {
    state.settled = true;
  }
}

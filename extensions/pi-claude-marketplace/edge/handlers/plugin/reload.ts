// edge/handlers/plugin/reload.ts
//
// `/claude:plugin reload` runs Pi's reload where the host takes later commands
// (RELOADCMD-D1). In Pi's terminal it does what Pi's own `/reload` does; RPC
// has no `/reload`, so there it is how a client reloads. A one-shot run
// refuses it, because its next run loads the changes.
//
// Pi cannot reload while a run streams or Pi compacts, and the context is not
// idle then, so the command refuses with Claude Code's busy words. This is a
// Pi gap: Claude Code serves the reload in the turn.
//
// Pi makes the command's context stale once it reloads, so the handler reports
// `reload-started` first and asks the registration, through `requestReload`,
// to reload after the command settled.

import { notifyReloadStarted, notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { acceptsLaterCommands } from "../../../shared/session-host.ts";

import { rejectArguments } from "./shared.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin reload";

const ONE_SHOT_REFUSAL =
  "Reload is unavailable: this Pi run does not accept later commands, so the next run loads the changes.";

const BUSY_REFUSAL =
  "The session is busy, so plugins were not reloaded. Ask again once it is idle.";

/**
 * RELOADCMD-D1: the `reload` handler. `requestReload` receives the context of
 * a command that passed every check, after its `reload-started` outcome.
 */
export function makeReloadHandler(
  requestReload: (ctx: ExtensionCommandContext) => void,
): SubcommandHandler {
  return (args, ctx, run): Promise<void> => {
    if (!acceptsLaterCommands(ctx)) {
      notifyUsageError(ctx, run, { message: ONE_SHOT_REFUSAL, usage: "" });
      return Promise.resolve();
    }

    if (rejectArguments(args, { ctx, run, usage: USAGE, surplus: "reload takes no arguments." })) {
      return Promise.resolve();
    }

    if (!ctx.isIdle()) {
      notifyUsageError(ctx, run, { message: BUSY_REFUSAL, usage: "" });
      return Promise.resolve();
    }

    notifyReloadStarted(ctx, run);
    requestReload(ctx);
    return Promise.resolve();
  };
}

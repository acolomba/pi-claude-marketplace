import { randomUUID } from "node:crypto";

import { invokeStagedCommand } from "../orchestrators/command-invocation.ts";
import { errorMessage } from "../shared/errors.ts";
import { notifyUsageError } from "../shared/notification-dispatch.ts";
import { openNotificationRun } from "../shared/notification-run.ts";

import type {
  CommandInvocationOutcome,
  CommandInvocationRequest,
} from "../orchestrators/command-invocation.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
} from "../platform/pi-api.ts";

const PASS_THROUGH: InputEventResult = { action: "continue" };

/** A typed slash command: its name and the rest of the line, untrimmed. */
interface SlashLine {
  readonly name: string;
  readonly rest: string;
}

/**
 * Splits `/<name> <rest>` at the first whitespace, as Pi's own template
 * expansion does, or returns `undefined` for text that names no command.
 */
function splitSlashLine(text: string): SlashLine | undefined {
  if (!text.startsWith("/")) {
    return undefined;
  }

  const end = text.search(/\s/);
  const name = end === -1 ? text.slice(1) : text.slice(1, end);
  if (name === "") {
    return undefined;
  }

  return { name, rest: end === -1 ? "" : text.slice(end) };
}

/** The request for the typed command `name`, read from Pi and the session. */
function commandRequest(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  commands: ReturnType<ExtensionAPI["getCommands"]>,
  name: string,
  rest: string,
): CommandInvocationRequest {
  return {
    name,
    typed: `/${name}`,
    args: rest.trim(),
    commands,
    sessionId: ctx.sessionManager.getSessionId(),
    thinkingLevel: pi.getThinkingLevel(),
    cwd: ctx.cwd,
    projectTrusted: ctx.isProjectTrusted(),
  };
}

/**
 * Registers the input handler for bridged slash commands (D-CF3-06). A typed
 * command that Pi lists as a prompt template staged by this extension goes
 * through the invocation, which fills its body as Claude Code does
 * (D-CF1-01). Everything else keeps Pi's own path: `extension` input, text
 * that does not start with `/` (such as the `<skill name=` block a skill
 * invocation sends on), and any other command or template (D-CF1-03).
 *
 * The extension factory registers it after the skill-alias rewrite, so the
 * handler sees the text that Pi will expand.
 */
export function registerCommandInvocation(
  pi: ExtensionAPI,
  invoke: (
    request: CommandInvocationRequest,
  ) => Promise<CommandInvocationOutcome> = invokeStagedCommand,
  createInvocationId: () => string = randomUUID,
): void {
  // T-01-24: a refused command is a `usage-error` whose origin names the
  // command, so RPC and JSON clients receive it as a `claude-plugin` entry.
  const refuse = (ctx: ExtensionContext, commandId: string, message: string): InputEventResult => {
    const invocationId = createInvocationId();
    notifyUsageError(ctx, openNotificationRun(pi, { kind: "command", commandId, invocationId }), {
      message,
      usage: "",
    });
    return { action: "handled" };
  };

  // An unexpected failure is refused too: Pi would otherwise send its own
  // expansion of the command to the model.
  const send = async (
    event: InputEvent,
    ctx: ExtensionContext,
    request: CommandInvocationRequest,
  ): Promise<InputEventResult> => {
    let outcome: CommandInvocationOutcome;
    try {
      outcome = await invoke(request);
    } catch (error) {
      outcome = { kind: "refuse", message: errorMessage(error) };
    }

    if (outcome.kind === "refuse") {
      return refuse(ctx, request.name, outcome.message);
    }

    if (outcome.kind === "not-staged") {
      return PASS_THROUGH;
    }

    return event.images === undefined
      ? { action: "transform", text: outcome.text }
      : { action: "transform", text: outcome.text, images: event.images };
  };

  pi.on("input", (event, ctx) => {
    if (event.source === "extension") {
      return PASS_THROUGH;
    }

    const line = splitSlashLine(event.text);
    if (line === undefined) {
      return PASS_THROUGH;
    }

    const commands = pi.getCommands();
    if (!commands.some((command) => command.source === "prompt" && command.name === line.name)) {
      return PASS_THROUGH;
    }

    return send(event, ctx, commandRequest(pi, ctx, commands, line.name, line.rest));
  });
}

// edge/command-tool.ts
//
// Closes the D-CF3-01 gap (the 2026-11-02 user decision on the Pi gap report,
// item 4): Claude Code's model runs a plugin command through its Skill tool,
// and Pi gives the model no way to run a prompt template. This module
// registers `run_plugin_command`, the Pi tool that stands for that path.
//
// Its description lists the staged commands Pi loaded that Claude Code lists
// for the model (`listModelCommands`), under the names Pi shows. Pi loads the
// staged prompts after `session_start`, so the list is built at the first
// `before_agent_start` of a session, once, and registered only when it holds a
// command: a session with none offers the model no extra tool. Install,
// uninstall, enable, and disable change the staged prompts, which Pi loads
// again at `/reload`, and `/reload` starts a new session, so the next prompt
// lists them.
//
// A call returns the command's body filled as a typed invocation fills it,
// with its `!` commands literal (`expandStagedCommand`). A refusal is the
// tool's error result. The tool notifies nothing (IL-2): the model reads the
// result, and Pi shows the call and its result to the user itself.

import Type from "typebox";

import { expandStagedCommand, listModelCommands } from "../orchestrators/command-invocation.ts";
import { errorMessage } from "../shared/errors.ts";

import type {
  CommandInvocationOutcome,
  CommandInvocationRequest,
  ModelCommand,
  ModelCommandListRequest,
} from "../orchestrators/command-invocation.ts";
import type { ExtensionAPI, ExtensionContext, PiTextContentBlock } from "../platform/pi-api.ts";

/** The tool's name, close to Claude Code's Skill tool for commands. */
const RUN_PLUGIN_COMMAND_TOOL = "run_plugin_command";

const PARAMETERS = Type.Object({
  command: Type.String({
    description: "The command to run, as listed, such as demo:deploy. A leading / is ignored.",
  }),
  args: Type.Optional(
    Type.String({ description: "The arguments, as the user would type them after the command." }),
  ),
});

/** The result of one call. */
interface CommandToolResult {
  content: PiTextContentBlock[];
  details: { command: string };
  isError?: true;
}

/** The ports the tool reads its list and its expansions through. */
export interface CommandToolPorts {
  readonly list: (request: ModelCommandListRequest) => Promise<readonly ModelCommand[]>;
  readonly expand: (
    request: CommandInvocationRequest,
    toolName: string,
  ) => Promise<CommandInvocationOutcome>;
}

const DEFAULT_PORTS: CommandToolPorts = { list: listModelCommands, expand: expandStagedCommand };

/** The tool description: what the tool does, then one line per listed command. */
function toolDescription(listed: readonly ModelCommand[]): string {
  return [
    "Run a slash command of an installed Claude Code plugin when the user's request matches it. " +
      "The result is the command's instructions with the arguments filled in. Follow them as if " +
      "the user had typed the command. Its !`command` lines are not run.",
    "",
    "The following commands are available:",
    ...listed.map(({ name, text }) => `- ${name}: ${text}`),
  ].join("\n");
}

/** The result of a call for `command`: the expanded text, or the error the model reads. */
function callResult(command: string, outcome: CommandInvocationOutcome): CommandToolResult {
  switch (outcome.kind) {
    case "send":
      return { content: [{ type: "text", text: outcome.text }], details: { command } };
    case "refuse":
      return {
        content: [{ type: "text", text: outcome.message }],
        details: { command },
        isError: true,
      };
    case "not-staged":
      return {
        content: [{ type: "text", text: `Unknown plugin command: ${command}` }],
        details: { command },
        isError: true,
      };
  }
}

/**
 * Registers the model's command tool (see the module header). `ports`
 * lists and expands the staged commands.
 */
export function registerCommandTool(
  pi: ExtensionAPI,
  ports: CommandToolPorts = DEFAULT_PORTS,
): void {
  const run = async (
    params: { command: string; args?: string },
    ctx: ExtensionContext,
  ): Promise<CommandToolResult> => {
    const command = params.command.trim().replace(/^\//, "");
    const request: CommandInvocationRequest = {
      commands: pi.getCommands(),
      name: command,
      typed: `/${command}`,
      args: (params.args ?? "").trim(),
      cwd: ctx.cwd,
      projectTrusted: ctx.isProjectTrusted(),
      sessionId: ctx.sessionManager.getSessionId(),
      thinkingLevel: pi.getThinkingLevel(),
    };
    try {
      return callResult(command, await ports.expand(request, RUN_PLUGIN_COMMAND_TOOL));
    } catch (error) {
      return callResult(command, { kind: "refuse", message: errorMessage(error) });
    }
  };

  let listed: Promise<void> | undefined;
  const register = async (ctx: ExtensionContext): Promise<void> => {
    const commands = await ports.list({
      commands: pi.getCommands(),
      cwd: ctx.cwd,
      projectTrusted: ctx.isProjectTrusted(),
    });
    if (commands.length === 0) {
      return;
    }

    pi.registerTool({
      name: RUN_PLUGIN_COMMAND_TOOL,
      label: "Run Plugin Command",
      description: toolDescription(commands),
      parameters: PARAMETERS,
      execute: async (_id, params, _signal, _onUpdate, toolCtx) => run(params, toolCtx),
    });
  };

  pi.on("session_start", () => {
    listed = undefined;
  });

  // A list that cannot be built registers no tool for the session.
  pi.on("before_agent_start", async (_event, ctx) => {
    listed ??= register(ctx).catch(() => undefined);
    await listed;
  });
}

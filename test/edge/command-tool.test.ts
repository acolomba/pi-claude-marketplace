import assert from "node:assert/strict";
import { test } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import { registerCommandTool } from "../../extensions/pi-claude-marketplace/edge/command-tool.ts";

import type { CommandToolPorts } from "../../extensions/pi-claude-marketplace/edge/command-tool.ts";
import type {
  CommandInvocationOutcome,
  CommandInvocationRequest,
  ModelCommand,
  ModelCommandListRequest,
} from "../../extensions/pi-claude-marketplace/orchestrators/command-invocation.ts";
import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type PiCommand = ReturnType<ExtensionAPI["getCommands"]>[number];
type ToolDefinition = Parameters<ExtensionAPI["registerTool"]>[0];
type StartListener = (event: BeforeAgentStartEvent, ctx: ExtensionContext) => Promise<void>;
type SessionListener = (event: SessionStartEvent, ctx: ExtensionContext) => void;

const DEPLOY: PiCommand = {
  name: "demo:deploy",
  source: "prompt",
  sourceInfo: {
    path: "/workspace/.pi/pi-claude-marketplace/resources/prompts/demo:deploy.md",
    source: "extension",
    scope: "temporary",
    origin: "top-level",
  },
};

const LISTED: readonly ModelCommand[] = [
  { name: "demo:deploy", text: "Deploys the branch." },
  { name: "demo:advise", text: "Gives advice. - Use when asked." },
];

const DESCRIPTION = [
  "Run a slash command of an installed Claude Code plugin when the user's request matches it. " +
    "The result is the command's instructions with the arguments filled in. Follow them as if " +
    "the user had typed the command. Its !`command` lines are not run.",
  "",
  "The following commands are available:",
  "- demo:deploy: Deploys the branch.",
  "- demo:advise: Gives advice. - Use when asked.",
].join("\n");

const START_EVENT = {
  type: "before_agent_start",
  messageType: "user",
  prompt: "hello",
  systemPrompt: "",
  systemPromptOptions: {},
} as BeforeAgentStartEvent;

interface Registration {
  readonly pi: ExtensionAPI;
  readonly start: (ctx: ExtensionContext) => Promise<void>;
  readonly newSession: () => void;
}

/** Registers the tool on a strict Pi mock and captures its two listeners. */
function register(ports: CommandToolPorts): Registration {
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const session = It.willCapture<SessionListener>("session");
  const start = It.willCapture<StartListener>("before agent start");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("before_agent_start", start);
  })
    .thenReturn()
    .times(1);
  registerCommandTool(pi, ports);
  return {
    pi,
    start: (ctx) => {
      if (start.value === undefined) {
        throw new Error("the tool registered no before_agent_start listener");
      }

      return start.value(START_EVENT, ctx);
    },
    newSession: () => {
      session.value?.({ type: "session_start", reason: "reload" }, listContext(0));
    },
  };
}

/** A context that a listing reads its directory and trust from `times` times. */
function listContext(times: number): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "list context" });
  if (times > 0) {
    when(() => ctx.cwd)
      .thenReturn("/workspace")
      .times(times);
    when(() => ctx.isProjectTrusted())
      .thenReturn(true)
      .times(times);
  }

  return ctx;
}

/** A context a call reads its directory, trust, and session id from once. */
function callContext(): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "call context" });
  const sessionManager = mock<ExtensionContext["sessionManager"]>({
    exactParams: true,
    name: "session manager",
  });
  when(() => ctx.cwd)
    .thenReturn("/workspace")
    .times(1);
  when(() => ctx.isProjectTrusted())
    .thenReturn(false)
    .times(1);
  when(() => ctx.sessionManager)
    .thenReturn(sessionManager)
    .times(1);
  when(() => sessionManager.getSessionId())
    .thenReturn("session-1")
    .times(1);
  return ctx;
}

const LIST_REQUEST: ModelCommandListRequest = {
  commands: [DEPLOY],
  cwd: "/workspace",
  projectTrusted: true,
};

/** Registers, lists `listed` at the first start, and captures the registered tool. */
async function registeredTool(
  expand: CommandToolPorts["expand"],
): Promise<{ pi: ExtensionAPI; tool: ToolDefinition }> {
  const definition = It.willCapture<ToolDefinition>("tool");
  const { pi, start } = register({ list: () => Promise.resolve(LISTED), expand });
  when(() => pi.getCommands())
    .thenReturn([DEPLOY])
    .times(1);
  when(() => {
    pi.registerTool(definition);
  })
    .thenReturn()
    .times(1);
  await start(listContext(1));
  if (definition.value === undefined) {
    throw new Error("no tool was registered");
  }

  return { pi, tool: definition.value };
}

/** Arms `pi` for the command list and thinking level one call reads. */
function armCall(pi: ExtensionAPI): void {
  when(() => pi.getCommands())
    .thenReturn([DEPLOY])
    .times(1);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);
}

function callRequest(overrides: Partial<CommandInvocationRequest>): CommandInvocationRequest {
  return {
    commands: [DEPLOY],
    name: "demo:deploy",
    typed: "/demo:deploy",
    args: "",
    cwd: "/workspace",
    projectTrusted: false,
    sessionId: "session-1",
    thinkingLevel: "low",
    ...overrides,
  };
}

test("D-CF3-01: registers the tool with the listed commands at the first start of a session, once", async () => {
  // arrange
  const list = mock<CommandToolPorts["list"]>({ exactParams: true, name: "list" });
  when(() => list(LIST_REQUEST))
    .thenResolve(LISTED)
    .times(1);
  const expand = mock<CommandToolPorts["expand"]>({ exactParams: true, name: "expand" });
  const definition = It.willCapture<ToolDefinition>("tool");
  const { pi, start } = register({ list, expand });
  when(() => pi.getCommands())
    .thenReturn([DEPLOY])
    .times(1);
  when(() => {
    pi.registerTool(definition);
  })
    .thenReturn()
    .times(1);

  // act
  await start(listContext(1));
  await start(listContext(0));

  // assert
  assert.deepStrictEqual(
    {
      name: definition.value?.name,
      label: definition.value?.label,
      description: definition.value?.description,
      parameters: definition.value?.parameters,
    },
    {
      name: "run_plugin_command",
      label: "Run Plugin Command",
      description: DESCRIPTION,
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The command to run, as listed, such as demo:deploy. A leading / is ignored.",
          },
          args: {
            type: "string",
            description: "The arguments, as the user would type them after the command.",
          },
        },
        required: ["command"],
      },
    },
  );
  verify(pi);
  verify(list);
  verify(expand);
});

test("D-CF3-01: lists the commands again in a new session", async () => {
  // arrange
  const lists: ModelCommandListRequest[] = [];
  const { pi, start, newSession } = register({
    list: (request) => {
      lists.push(request);
      return Promise.resolve([]);
    },
    expand: () => Promise.reject(new Error("no call")),
  });
  when(() => pi.getCommands())
    .thenReturn([DEPLOY])
    .times(2);

  // act
  await start(listContext(1));
  newSession();
  await start(listContext(1));

  // assert
  assert.deepStrictEqual(lists, [LIST_REQUEST, LIST_REQUEST]);
  verify(pi);
});

for (const { title, list } of [
  { title: "no command is listed", list: () => Promise.resolve([]) },
  { title: "the list cannot be built", list: () => Promise.reject(new Error("EACCES")) },
]) {
  test(`D-CF3-01: registers no tool when ${title}`, async () => {
    // arrange
    const { pi, start } = register({ list, expand: () => Promise.reject(new Error("no call")) });
    when(() => pi.getCommands())
      .thenReturn([DEPLOY])
      .times(1);

    // act & assert
    await assert.doesNotReject(start(listContext(1)));
    verify(pi);
  });
}

for (const { params, name, expandedArgs } of [
  {
    params: { command: "demo:deploy", args: " production " },
    name: "demo:deploy",
    expandedArgs: "production",
  },
  { params: { command: " /demo:deploy" }, name: "demo:deploy", expandedArgs: "" },
]) {
  test(`D-CF3-01: returns the expanded body for the call ${JSON.stringify(params)}`, async () => {
    // arrange
    const expand = mock<CommandToolPorts["expand"]>({ exactParams: true, name: "expand" });
    when(() =>
      expand(callRequest({ name, typed: `/${name}`, args: expandedArgs }), "run_plugin_command"),
    )
      .thenResolve({ kind: "send", text: "Deploy now." })
      .times(1);
    const { pi, tool } = await registeredTool(expand);
    armCall(pi);
    const ctx = callContext();

    // act
    const outcome = await tool.execute(
      "call-1",
      params,
      undefined,
      undefined,
      ctx as Parameters<ToolDefinition["execute"]>[4],
    );

    // assert
    assert.deepStrictEqual(outcome, {
      content: [{ type: "text", text: "Deploy now." }],
      details: { command: "demo:deploy" },
    });
    verify(pi);
    verify(ctx);
    verify(expand);
  });
}

for (const { title, expand, text } of [
  {
    title: "a refused command",
    expand: (): Promise<CommandInvocationOutcome> =>
      Promise.resolve({ kind: "refuse", message: "Command demo:deploy cannot be used." }),
    text: "Command demo:deploy cannot be used.",
  },
  {
    title: "a command this extension did not stage",
    expand: (): Promise<CommandInvocationOutcome> => Promise.resolve({ kind: "not-staged" }),
    text: "Unknown plugin command: demo:deploy",
  },
  {
    title: "a failed expansion",
    expand: (): Promise<CommandInvocationOutcome> => Promise.reject(new Error("EACCES")),
    text: "EACCES",
  },
]) {
  test(`D-CF3-01: returns an error result for ${title}`, async () => {
    // arrange
    const { pi, tool } = await registeredTool(expand);
    armCall(pi);
    const ctx = callContext();

    // act
    const outcome = await tool.execute(
      "call-1",
      { command: "demo:deploy" },
      undefined,
      undefined,
      ctx as Parameters<ToolDefinition["execute"]>[4],
    );

    // assert
    assert.deepStrictEqual(outcome, {
      content: [{ type: "text", text }],
      details: { command: "demo:deploy" },
      isError: true,
    });
    verify(pi);
    verify(ctx);
  });
}

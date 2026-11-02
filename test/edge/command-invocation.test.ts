import assert from "node:assert/strict";
import { test } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import { registerCommandInvocation } from "../../extensions/pi-claude-marketplace/edge/command-invocation.ts";

import type {
  CommandInvocationOutcome,
  CommandInvocationRequest,
} from "../../extensions/pi-claude-marketplace/orchestrators/command-invocation.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type InputListener = (
  event: InputEvent,
  ctx: ExtensionContext,
) => InputEventResult | Promise<InputEventResult>;
type CommandInvoker = (request: CommandInvocationRequest) => Promise<CommandInvocationOutcome>;
type PiCommand = ReturnType<ExtensionAPI["getCommands"]>[number];

function piCommand(name: string, source: PiCommand["source"], file: string): PiCommand {
  return {
    name,
    source,
    sourceInfo: { path: file, source: "extension", scope: "temporary", origin: "top-level" },
  };
}

const GREET_PROMPT = piCommand(
  "demo:greet",
  "prompt",
  "/workspace/.pi/pi-claude-marketplace/resources/prompts/demo:greet.md",
);

/** Registers the handler on a strict Pi mock and captures its input listener. */
function register(
  invoke: CommandInvoker,
  createInvocationId: () => string = () => {
    throw new Error("an invocation that is not refused must not open a notification run");
  },
): { pi: ExtensionAPI; input: (event: InputEvent, ctx: ExtensionContext) => unknown } {
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const input = It.willCapture<InputListener>("input");
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  registerCommandInvocation(pi, invoke, createInvocationId);
  return {
    pi,
    input: (event, ctx) => {
      if (input.value === undefined) {
        throw new Error("the handler registered no input listener");
      }

      return input.value(event, ctx);
    },
  };
}

/** A context that an invocation reads its directory, trust, and session id from once. */
function invocationContext(): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const sessionManager = mock<ExtensionContext["sessionManager"]>({
    exactParams: true,
    name: "session manager",
  });
  when(() => ctx.cwd)
    .thenReturn("/workspace")
    .times(1);
  when(() => ctx.isProjectTrusted())
    .thenReturn(true)
    .times(1);
  when(() => ctx.sessionManager)
    .thenReturn(sessionManager)
    .times(1);
  when(() => sessionManager.getSessionId())
    .thenReturn("session-1")
    .times(1);
  return ctx;
}

/** Arranges the Pi reads of one invocation: the command list `listReads` times and the thinking level once. */
function expectInvocationReads(pi: ExtensionAPI, listReads = 1): void {
  when(() => pi.getCommands())
    .thenReturn([GREET_PROMPT])
    .times(listReads);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);
}

function greetRequest(args: string): CommandInvocationRequest {
  return {
    commands: [GREET_PROMPT],
    name: "demo:greet",
    typed: "/demo:greet",
    args,
    cwd: "/workspace",
    projectTrusted: true,
    sessionId: "session-1",
    thinkingLevel: "low",
  };
}

/** Arranges the inventory reads that opening a notification run makes besides the command list. */
function expectNotificationRun(pi: ExtensionAPI): void {
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(3);
}

test("T-03-06: passes extension input through without reading pi or the context", () => {
  // arrange
  const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const { pi, input } = register(invoke);

  // act
  const outcome = input({ type: "input", text: "/demo:greet Ada", source: "extension" }, ctx);

  // assert
  assert.deepStrictEqual(outcome, { action: "continue" });
  verify(pi);
  verify(ctx);
  verify(invoke);
});

for (const text of ['<skill name="demo-greet">\nGreet Ada.\n</skill>', "greet Ada", "/"]) {
  test(`D-CF3-06: passes ${JSON.stringify(text)} through without reading pi or the context`, () => {
    // arrange
    const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
    const { pi, input } = register(invoke);

    // act
    const outcome = input({ type: "input", text, source: "interactive" }, ctx);

    // assert
    assert.deepStrictEqual(outcome, { action: "continue" });
    verify(pi);
    verify(ctx);
    verify(invoke);
  });
}

test("D-CF1-03: passes a token that pi lists only as another kind of command through", () => {
  // arrange
  const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const { pi, input } = register(invoke);
  when(() => pi.getCommands())
    .thenReturn([
      piCommand("demo:greet", "skill", "/workspace/skills/demo-greet/SKILL.md"),
      piCommand("demo:greet", "extension", "/workspace/extensions/demo.ts"),
      piCommand("demo:other", "prompt", "/workspace/.pi/prompts/demo:other.md"),
    ])
    .times(1);

  // act
  const outcome = input({ type: "input", text: "/demo:greet Ada", source: "interactive" }, ctx);

  // assert
  assert.deepStrictEqual(outcome, { action: "continue" });
  verify(pi);
  verify(ctx);
  verify(invoke);
});

test("D-CF1-03: passes a prompt command the invocation finds not staged through", async () => {
  // arrange
  const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
  when(() => invoke(greetRequest("Ada")))
    .thenResolve({ kind: "not-staged" })
    .times(1);
  const ctx = invocationContext();
  const { pi, input } = register(invoke);
  expectInvocationReads(pi);

  // act
  const outcome = await input(
    { type: "input", text: "/demo:greet Ada", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(outcome, { action: "continue" });
  verify(pi);
  verify(ctx);
  verify(invoke);
});

for (const source of ["interactive", "rpc"] as const) {
  test(`D-CF3-06: sends a staged command from ${source} input through the invocation`, async () => {
    // arrange
    const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
    when(() => invoke(greetRequest("Ada  'New York'")))
      .thenResolve({ kind: "send", text: "Greet Ada." })
      .times(1);
    const ctx = invocationContext();
    const { pi, input } = register(invoke);
    expectInvocationReads(pi);

    // act
    const outcome = await input(
      { type: "input", text: "/demo:greet   Ada  'New York'  ", source },
      ctx,
    );

    // assert
    assert.deepStrictEqual(outcome, { action: "transform", text: "Greet Ada." });
    verify(pi);
    verify(ctx);
    verify(invoke);
  });
}

test("D-CF3-06: sends an empty argument string when nothing follows the command", async () => {
  // arrange
  const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
  when(() => invoke(greetRequest("")))
    .thenResolve({ kind: "send", text: "Greet someone." })
    .times(1);
  const ctx = invocationContext();
  const { pi, input } = register(invoke);
  expectInvocationReads(pi);

  // act
  const outcome = await input({ type: "input", text: "/demo:greet", source: "interactive" }, ctx);

  // assert
  assert.deepStrictEqual(outcome, { action: "transform", text: "Greet someone." });
  verify(pi);
  verify(ctx);
  verify(invoke);
});

test("D-CF3-06: keeps the images of the typed prompt in the transformed input", async () => {
  // arrange
  const image = { type: "image", data: "aW1hZ2U=", mimeType: "image/png" } as const;
  const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
  when(() => invoke(greetRequest("Ada")))
    .thenResolve({ kind: "send", text: "Greet Ada." })
    .times(1);
  const ctx = invocationContext();
  const { pi, input } = register(invoke);
  expectInvocationReads(pi);

  // act
  const outcome = await input(
    { type: "input", text: "/demo:greet Ada", source: "interactive", images: [image] },
    ctx,
  );

  // assert
  assert.deepStrictEqual(outcome, { action: "transform", text: "Greet Ada.", images: [image] });
  verify(pi);
  verify(ctx);
  verify(invoke);
});

test("E8: prefixes a sent body that starts with another command with a zero-width space, so pi does not expand it again", async () => {
  // arrange
  const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
  when(() => invoke(greetRequest("Ada")))
    .thenResolve({ kind: "send", text: "/demo:other Ada" })
    .times(1);
  const ctx = invocationContext();
  const { pi, input } = register(invoke);
  expectInvocationReads(pi);

  // act
  const outcome = await input(
    { type: "input", text: "/demo:greet Ada", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(outcome, { action: "transform", text: "\u200B/demo:other Ada" });
  verify(pi);
  verify(ctx);
  verify(invoke);
});

test("T-01-24: reports a refused command as a usage error entry over RPC and handles the prompt", async () => {
  // arrange
  const message = 'Shell command failed for pattern "!`exit 3`": partial';
  const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
  when(() => invoke(greetRequest("Ada")))
    .thenResolve({ kind: "refuse", message })
    .times(1);
  const ctx = invocationContext();
  when(() => ctx.mode)
    .thenReturn("rpc")
    .times(1);
  const { pi, input } = register(invoke, () => "invocation-1");
  expectInvocationReads(pi, 2);
  expectNotificationRun(pi);
  when(() => {
    pi.appendEntry("claude-plugin", {
      schemaVersion: 1,
      kind: "usage-error",
      origin: { kind: "command", commandId: "demo:greet", invocationId: "invocation-1" },
      severity: "error",
      needsReload: false,
      message,
      usage: "",
    });
  })
    .thenReturn()
    .times(1);

  // act
  const outcome = await input({ type: "input", text: "/demo:greet Ada", source: "rpc" }, ctx);

  // assert
  assert.deepStrictEqual(outcome, { action: "handled" });
  verify(pi);
  verify(ctx);
  verify(invoke);
});

for (const { title, arrange, message } of [
  {
    title: "shows a refused command's message alone in the terminal UI",
    arrange: (invoke: CommandInvoker) => {
      when(() => invoke(greetRequest("Ada")))
        .thenResolve({ kind: "refuse", message: "Cannot read the command /demo:greet." })
        .times(1);
    },
    message: "Cannot read the command /demo:greet.",
  },
  {
    title: "reports an invocation that fails unexpectedly as a usage error",
    arrange: (invoke: CommandInvoker) => {
      when(() => invoke(greetRequest("Ada")))
        .thenReject(new Error("spawn failed"))
        .times(1);
    },
    message: "spawn failed",
  },
]) {
  test(`T-01-24: ${title} and handles the prompt`, async () => {
    // arrange
    const invoke = mock<CommandInvoker>({ exactParams: true, name: "command invocation" });
    arrange(invoke);
    const ctx = invocationContext();
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(1);
    when(() => ctx.ui)
      .thenReturn(ui)
      .times(1);
    when(() => {
      ui.notify(message, "error");
    })
      .thenReturn()
      .times(1);
    const { pi, input } = register(invoke, () => "invocation-1");
    expectInvocationReads(pi, 2);
    expectNotificationRun(pi);

    // act
    const outcome = await input(
      { type: "input", text: "/demo:greet Ada", source: "interactive" },
      ctx,
    );

    // assert
    assert.deepStrictEqual(outcome, { action: "handled" });
    verify(pi);
    verify(ctx);
    verify(ui);
    verify(invoke);
  });
}

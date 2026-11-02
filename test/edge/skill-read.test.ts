import assert from "node:assert/strict";
import { test } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import { registerSkillReadFill } from "../../extensions/pi-claude-marketplace/edge/skill-read.ts";

import type { SkillReadRequest } from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
  ToolResultEventResult,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type ToolResultListener = (
  event: ToolResultEvent,
  ctx: ExtensionContext,
) => ToolResultEventResult | undefined | Promise<ToolResultEventResult | undefined>;
type ReadFill = (request: SkillReadRequest) => Promise<string | undefined>;
type PiCommand = ReturnType<ExtensionAPI["getCommands"]>[number];

const SKILL = "/workspace/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md";

const GREET_SKILL: PiCommand = {
  name: "skill:demo-greet",
  source: "skill",
  sourceInfo: { path: SKILL, source: "extension", scope: "temporary", origin: "top-level" },
};

/** Registers the handler on a strict Pi mock and captures its listener. */
function register(fill: ReadFill): {
  pi: ExtensionAPI;
  listener: (event: ToolResultEvent, ctx: ExtensionContext) => unknown;
} {
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const listener = It.willCapture<ToolResultListener>("tool result");
  when(() => {
    pi.on("tool_result", listener);
  })
    .thenReturn()
    .times(1);
  registerSkillReadFill(pi, fill, () => "/home/ada");
  return {
    pi,
    listener: (event, ctx) => {
      if (listener.value === undefined) {
        throw new Error("the handler registered no tool result listener");
      }

      return listener.value(event, ctx);
    },
  };
}

/** A read result whose input is `input` and whose one content block is `text`. */
function readResult(input: Record<string, unknown>, text: string): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "call-1",
    toolName: "read",
    input,
    content: [{ type: "text", text }],
    isError: false,
    details: undefined,
  };
}

/** A context whose directory a fill reads twice and whose trust and session it reads once. */
function fillContext(): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const sessionManager = mock<ExtensionContext["sessionManager"]>({
    exactParams: true,
    name: "session manager",
  });
  when(() => ctx.cwd)
    .thenReturn("/workspace")
    .times(2);
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

/** Arms `pi` for the one command list and thinking level a fill reads. */
function armFill(pi: ExtensionAPI): void {
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(1);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);
}

function fillRequest(overrides: Partial<SkillReadRequest>): SkillReadRequest {
  return {
    commands: [GREET_SKILL],
    file: SKILL,
    text: "Greet $ARGUMENTS.",
    startLine: 0,
    cwd: "/workspace",
    projectTrusted: true,
    sessionId: "session-1",
    thinkingLevel: "low",
    ...overrides,
  };
}

for (const { requested, file } of [
  { requested: SKILL, file: SKILL },
  { requested: `@${SKILL}`, file: SKILL },
  { requested: ".pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md", file: SKILL },
  { requested: "~/skills/SKILL.md", file: "/home/ada/skills/SKILL.md" },
  { requested: "~", file: "/home/ada" },
]) {
  test(`D-CF1-03: replaces the read text of ${requested} with the filled text`, async () => {
    // arrange
    const fill = mock<ReadFill>({ exactParams: true, name: "read fill" });
    when(() => fill(fillRequest({ file })))
      .thenResolve("Greet .")
      .times(1);
    const ctx = fillContext();
    const { pi, listener } = register(fill);
    armFill(pi);

    // act
    const replaced = await listener(readResult({ path: requested }, "Greet $ARGUMENTS."), ctx);

    // assert
    assert.deepStrictEqual(replaced, { content: [{ type: "text", text: "Greet ." }] });
    verify(pi);
    verify(ctx);
    verify(fill);
  });
}

for (const { offset, startLine } of [
  { offset: 3, startLine: 2 },
  { offset: 1, startLine: 0 },
  { offset: 0, startLine: 0 },
  { offset: "3", startLine: 0 },
]) {
  test(`D-CF1-03: reads the offset ${JSON.stringify(offset)} as the file line index ${startLine}`, async () => {
    // arrange
    const fill = mock<ReadFill>({ exactParams: true, name: "read fill" });
    when(() => fill(fillRequest({ startLine })))
      .thenResolve("Greet .")
      .times(1);
    const ctx = fillContext();
    const { pi, listener } = register(fill);
    armFill(pi);

    // act
    const replaced = await listener(
      readResult({ path: SKILL, offset, limit: 2 }, "Greet $ARGUMENTS."),
      ctx,
    );

    // assert
    assert.deepStrictEqual(replaced, { content: [{ type: "text", text: "Greet ." }] });
    verify(pi);
    verify(ctx);
    verify(fill);
  });
}

for (const { title, fill } of [
  {
    title: "the fill keeps the text",
    fill: (): Promise<string | undefined> => Promise.resolve(undefined),
  },
  {
    title: "the fill returns the same text",
    fill: (): Promise<string | undefined> => Promise.resolve("Greet $ARGUMENTS."),
  },
  {
    title: "the fill fails",
    fill: (): Promise<string | undefined> => Promise.reject(new Error("EACCES")),
  },
]) {
  test(`D-CF1-03: leaves the read result unchanged when ${title}`, async () => {
    // arrange
    const ctx = fillContext();
    const { pi, listener } = register(fill);
    armFill(pi);

    // act
    const replaced = await listener(readResult({ path: SKILL }, "Greet $ARGUMENTS."), ctx);

    // assert
    assert.strictEqual(replaced, undefined);
    verify(pi);
    verify(ctx);
  });
}

for (const { title, event } of [
  {
    title: "another tool's result",
    event: { ...readResult({ path: SKILL }, "Greet $ARGUMENTS."), toolName: "grep" },
  },
  {
    title: "a failed read",
    event: { ...readResult({ path: SKILL }, "ENOENT"), isError: true },
  },
  {
    title: "a read of an image",
    event: {
      ...readResult({ path: SKILL }, "Read image file [image/png]"),
      content: [
        { type: "text", text: "Read image file [image/png]" },
        { type: "image", data: "aGk=", mimeType: "image/png" },
      ],
    },
  },
  {
    title: "a read whose content is an image alone",
    event: {
      ...readResult({ path: SKILL }, ""),
      content: [{ type: "image", data: "aGk=", mimeType: "image/png" }],
    },
  },
  {
    title: "a read with no content",
    event: { ...readResult({ path: SKILL }, ""), content: [] },
  },
  {
    title: "a read whose path is not a string",
    event: readResult({ path: 7 }, "Greet $ARGUMENTS."),
  },
] satisfies { title: string; event: ToolResultEvent }[]) {
  test(`D-CF1-03: passes ${title} through without a fill`, () => {
    // arrange
    const fill = mock<ReadFill>({ exactParams: true, name: "read fill" });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
    const { pi, listener } = register(fill);

    // act
    const replaced = listener(event, ctx);

    // assert
    assert.strictEqual(replaced, undefined);
    verify(pi);
    verify(ctx);
    verify(fill);
  });
}

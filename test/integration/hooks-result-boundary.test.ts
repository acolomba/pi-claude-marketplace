// test/integration/hooks-result-boundary.test.ts
//
// Peer conformance (ITSCOPE-01) against Pi's own `ExtensionRunner` from the
// installed `@earendil-works/pi-coding-agent`. Each case puts the patch that
// `adaptToolResultResult` returns for a PostToolUse hook into Pi's real
// `emitToolResult` and reads what Pi returns and what a later handler gets
// (D-PG2-06). A replacement clears the stale `details`,
// `structuredContent`, and image blocks; block feedback keeps
// `structuredContent` and `isError`; an echoed file result changes nothing.
// The scenarios of `features/hook/tool-use.feature` see only what the model
// gets, not what a later Pi handler reads.

import assert from "node:assert/strict";
import test from "node:test";

import { adaptToolResultResult } from "../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import { createHooksRuntime } from "../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { ExtensionRunner } from "../../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js";

import type { HookAdapterContext } from "../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import type { HookExecResult } from "../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type {
  ExtensionContext,
  ToolResultEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type ResultHandler = (event: ToolResultEvent) => unknown;

function runnerWith(handlers: readonly ResultHandler[]): ExtensionRunner {
  // emitToolResult reads only each extension's path and handlers. The other
  // constructor collaborators stay unused by this result-handler boundary.
  const extensions = handlers.map((handler, index) => ({
    path: `handler-${index}`,
    handlers: new Map([["tool_result", [handler]]]),
  })) as unknown as ConstructorParameters<typeof ExtensionRunner>[0];
  return new ExtensionRunner(
    extensions,
    {} as ConstructorParameters<typeof ExtensionRunner>[1],
    "/work",
    {} as ConstructorParameters<typeof ExtensionRunner>[3],
    {} as ConstructorParameters<typeof ExtensionRunner>[4],
  );
}

function event(toolName: string, text: string, isError = false): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "result-boundary",
    toolName,
    input: { path: "secret.txt" },
    content: [{ type: "text", text }],
    details: { diff: "OLD_DIFF_SECRET", fullOutputPath: "OLD_PATH_SECRET" },
    structuredContent: { content: "OLD_STRUCTURED_SECRET" },
    isError,
  };
}

function adapter(result: HookExecResult, incoming: ToolResultEvent): unknown {
  const context: HookAdapterContext = {
    runtime: createHooksRuntime(),
    ctx: { cwd: "/work", mode: "print" } as ExtensionContext,
    pi: undefined,
    attributedTo: undefined,
  };
  return adaptToolResultResult(result, incoming, context);
}

test("the installed Pi runner clears every stale carrier before a later handler", async () => {
  const observed: ToolResultEvent[] = [];
  const runner = runnerWith([
    (incoming) =>
      adapter(
        {
          kind: "mutate",
          updatedToolOutput: {
            type: "text",
            file: { content: "safe" },
          },
        },
        incoming,
      ),
    (incoming) => {
      observed.push(structuredClone(incoming));
    },
  ]);
  const result = await runner.emitToolResult(event("read", "OLD_TEXT_SECRET"));
  assert.deepStrictEqual(result, {
    content: [{ type: "text", text: "safe" }],
    details: null,
    structuredContent: undefined,
    isError: false,
    usage: undefined,
  });
  assert.deepStrictEqual(
    observed.map(({ content, details, structuredContent, isError }) => ({
      content,
      details,
      structuredContent,
      isError,
    })),
    [
      {
        content: [{ type: "text", text: "safe" }],
        details: null,
        structuredContent: undefined,
        isError: false,
      },
    ],
  );
  assert.strictEqual(JSON.stringify({ result, observed }).includes("OLD_"), false);
});

test("a generic content-only patch clears structured output and explicit-null details", async () => {
  const observed: ToolResultEvent[] = [];
  const runner = runnerWith([
    (incoming) =>
      adapter(
        {
          kind: "mutate",
          updatedToolOutput: {
            content: [{ type: "text", text: "safe" }],
          },
        },
        incoming,
      ),
    (incoming) => {
      observed.push(structuredClone(incoming));
    },
  ]);
  const result = await runner.emitToolResult(event("owner-tool", "OLD_TEXT_SECRET"));
  assert.deepStrictEqual(result?.content, [{ type: "text", text: "safe" }]);
  assert.strictEqual(result?.details, null);
  assert.strictEqual(result?.structuredContent, undefined);
  assert.deepStrictEqual(observed[0]?.content, [{ type: "text", text: "safe" }]);
  assert.strictEqual(observed[0]?.details, null);
  assert.strictEqual(observed[0]?.structuredContent, undefined);
  assert.strictEqual(JSON.stringify({ result, observed }).includes("OLD_"), false);
});

test("an MCP content-only patch clears structured output when public text is unchanged", async () => {
  const observed: ToolResultEvent[] = [];
  const runner = runnerWith([
    (incoming) =>
      adapter(
        {
          kind: "mutate",
          updatedToolOutput: { content: [{ type: "text", text: "public" }] },
        },
        incoming,
      ),
    (incoming) => {
      observed.push(structuredClone(incoming));
    },
  ]);
  const result = await runner.emitToolResult(event("mcp__catalog__lookup", "public"));
  assert.deepStrictEqual(result?.content, [{ type: "text", text: "public" }]);
  assert.strictEqual(result?.details, null);
  assert.strictEqual(result?.structuredContent, undefined);
  assert.deepStrictEqual(observed[0]?.content, result?.content);
  assert.strictEqual(observed[0]?.details, null);
  assert.strictEqual(observed[0]?.structuredContent, undefined);
  assert.strictEqual(JSON.stringify({ result, observed }).includes("OLD_"), false);
});

test("an image replacement removes the earlier image and its note", async () => {
  const observed: ToolResultEvent[] = [];
  const runner = runnerWith([
    (incoming) =>
      adapter(
        {
          kind: "mutate",
          updatedToolOutput: {
            type: "image",
            file: { base64: "bmV3", type: "image/png" },
          },
        },
        incoming,
      ),
    (incoming) => {
      observed.push(structuredClone(incoming));
    },
  ]);
  const original: ToolResultEvent = {
    ...event("read", "OLD_IMAGE_NOTE_SECRET"),
    content: [
      { type: "text", text: "OLD_IMAGE_NOTE_SECRET" },
      { type: "image", data: "b2xk", mimeType: "image/png" },
    ],
  };
  const result = await runner.emitToolResult(original);
  assert.deepStrictEqual(result?.content, [{ type: "image", data: "bmV3", mimeType: "image/png" }]);
  assert.deepStrictEqual(observed[0]?.content, result?.content);
  assert.strictEqual(JSON.stringify({ result, observed }).includes("OLD_"), false);
  assert.strictEqual(JSON.stringify({ result, observed }).includes("b2xk"), false);
});

test("the installed Pi runner preserves structured content on feedback", async () => {
  const observed: ToolResultEvent[] = [];
  const runner = runnerWith([
    (incoming) => adapter({ kind: "block", reason: "review" }, incoming),
    (incoming) => {
      observed.push(structuredClone(incoming));
    },
  ]);
  const original = event("owner-tool", "original", true);
  const result = await runner.emitToolResult(original);
  assert.deepStrictEqual(result?.structuredContent, original.structuredContent);
  assert.strictEqual(result?.isError, true);
  assert.deepStrictEqual(observed[0]?.structuredContent, original.structuredContent);
  assert.strictEqual(observed[0]?.isError, true);
  assert.strictEqual(observed[0]?.content.length, 2);
});

test("a file-result echo leaves every original Pi carrier untouched", async () => {
  const observed: ToolResultEvent[] = [];
  const runner = runnerWith([
    (incoming) =>
      adapter(
        {
          kind: "mutate",
          updatedToolOutput: {
            type: "text",
            file: {
              content: "original",
              filePath: "/work/secret.txt",
              startLine: 1,
              numLines: 1,
              totalLines: 1,
            },
          },
        },
        incoming,
      ),
    (incoming) => {
      observed.push(structuredClone(incoming));
    },
  ]);
  const original = event("read", "original");
  assert.strictEqual(await runner.emitToolResult(original), undefined);
  assert.deepStrictEqual(observed, [original]);
});

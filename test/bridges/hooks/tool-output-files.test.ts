import assert from "node:assert/strict";
import test from "node:test";

import { renderFileToolOutput } from "../../../extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts";

import type { ToolResultEvent } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function result(
  toolName: string,
  content: ToolResultEvent["content"],
  input: Record<string, unknown> = { path: "file" },
): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "output",
    toolName,
    input,
    content,
    isError: false,
    details: { secret: "OLD_SECRET" },
  };
}

test("text replacement clears details and makes empty text visible", () => {
  const event = result("Read", [{ type: "text", text: "OLD_SECRET" }]);
  assert.deepStrictEqual(
    renderFileToolOutput(event, { type: "text", file: { content: "" } }, "/work"),
    {
      content: [{ type: "text", text: "" }],
      details: null,
    },
  );
  assert.deepStrictEqual(event.content, [{ type: "text", text: "OLD_SECRET" }]);
});

test("a projected read echo and a byte-identical replacement make no patch", () => {
  const event = result("read", [{ type: "text", text: "same" }]);
  assert.strictEqual(
    renderFileToolOutput(
      event,
      {
        type: "text",
        file: { filePath: "/work/file", content: "same", startLine: 1, numLines: 1, totalLines: 1 },
      },
      "/work",
    ),
    undefined,
  );
  assert.strictEqual(
    renderFileToolOutput(event, { type: "text", file: { content: "same" } }, "/work"),
    undefined,
  );
});

test("image replacement contains only its new image block", () => {
  const event = result("read", [
    { type: "text", text: "OLD_SECRET image note" },
    { type: "image", data: "b2xk", mimeType: "image/png" },
  ]);
  assert.deepStrictEqual(
    renderFileToolOutput(
      event,
      {
        type: "image",
        file: {
          base64: "bmV3",
          type: "image/png",
        },
      },
      "/work",
    ),
    {
      content: [{ type: "image", data: "bmV3", mimeType: "image/png" }],
      details: null,
    },
  );
  assert.strictEqual(
    renderFileToolOutput(
      event,
      {
        type: "image",
        file: {
          base64: "b2xk",
          type: "image/png",
        },
      },
      "/work",
    ),
    undefined,
  );
});

test("edit renders supplied replacement and validated hunk lines", () => {
  const event = result("edit", [{ type: "text", text: "OLD_SECRET" }]);
  assert.deepStrictEqual(
    renderFileToolOutput(
      event,
      {
        filePath: "/work/file",
        newString: "safe",
        oldString: "old",
        replaceAll: false,
        structuredPatch: [
          { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-old", "+safe"] },
        ],
      },
      "/work",
    ),
    {
      content: [{ type: "text", text: "/work/file: safe\n@@ -1,1 +1,1 @@\n-old\n+safe" }],
      details: null,
    },
  );
});

test("projected edit and write echoes do not replace the original result", () => {
  const edit = {
    ...result("edit", [{ type: "text", text: "original edit result" }], {
      path: "file",
      edits: [{ oldText: "old", newText: "new" }],
    }),
    details: { patch: "--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n" },
  };
  assert.strictEqual(
    renderFileToolOutput(
      edit,
      {
        filePath: "/work/file",
        oldString: "old",
        newString: "new",
        replaceAll: false,
        structuredPatch: [
          { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-old", "+new"] },
        ],
      },
      "/work",
    ),
    undefined,
  );

  const write = result("write", [{ type: "text", text: "original write result" }], {
    path: "file",
    content: "original content",
  });
  assert.strictEqual(
    renderFileToolOutput(write, { filePath: "/work/file", content: "original content" }, "/work"),
    undefined,
  );

  const pair = { ...edit, input: { path: "file", oldText: "old", newText: "new" } };
  assert.strictEqual(
    renderFileToolOutput(
      pair,
      {
        filePath: "/work/file",
        oldString: "old",
        newString: "new",
        replaceAll: false,
        structuredPatch: [
          { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-old", "+new"] },
        ],
      },
      "/work",
    ),
    undefined,
  );
});

test("edit accepts a complete no-newline hunk and a replacement without patch", () => {
  const event = result("edit", [{ type: "text", text: "original" }]);
  assert.deepStrictEqual(
    renderFileToolOutput(event, { filePath: "/work/file", newString: "safe" }, "/work"),
    { content: [{ type: "text", text: "/work/file: safe" }], details: null },
  );
  assert.deepStrictEqual(
    renderFileToolOutput(
      event,
      {
        filePath: "/work/file",
        newString: "safe",
        structuredPatch: [
          {
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: ["-old", "\\ No newline at end of file", "+safe"],
          },
        ],
      },
      "/work",
    ),
    {
      content: [
        {
          type: "text",
          text: "/work/file: safe\n@@ -1,1 +1,1 @@\n-old\n\\ No newline at end of file\n+safe",
        },
      ],
      details: null,
    },
  );
});

test("write renders content and only supplied create wording", () => {
  const event = result("write", [{ type: "text", text: "OLD_SECRET" }], {
    path: "file",
    content: "old",
  });
  assert.deepStrictEqual(
    renderFileToolOutput(event, { filePath: "/work/file", content: "safe" }, "/work"),
    {
      content: [{ type: "text", text: "/work/file\nsafe" }],
      details: null,
    },
  );
  assert.deepStrictEqual(
    renderFileToolOutput(event, { filePath: "/work/file", content: "", type: "create" }, "/work"),
    {
      content: [{ type: "text", text: "create /work/file\n" }],
      details: null,
    },
  );
});

test("invalid file replacements preserve the original result", () => {
  const read = result("read", [{ type: "text", text: "OLD_SECRET" }]);
  for (const candidate of [
    null,
    [],
    {},
    { type: "text" },
    { type: "text", file: {} },
    { type: "text", file: { content: 5 } },
    { type: "text", file: { content: "x", extra: true } },
    { type: "text", file: { content: "x", numLines: -1 } },
    { type: "text", file: { content: "x", filePath: 8 } },
    { type: "text", file: { content: "x", truncatedByTokenCap: "yes" } },
    { type: "image", file: { base64: "**", type: "image/png" } },
    { type: "image", file: { base64: "", type: "image/png" } },
    { type: "image", file: { base64: "bmV3", type: "text/plain" } },
    { type: "image", file: { base64: "bmV3", type: 2 } },
  ]) {
    assert.strictEqual(renderFileToolOutput(read, candidate, "/work"), undefined);
  }

  const edit = result("edit", [{ type: "text", text: "OLD_SECRET" }]);
  for (const candidate of [
    { filePath: 2, newString: "safe" },
    { filePath: "file", newString: 2 },
    { filePath: "file", newString: "safe", oldString: 2 },
    { filePath: "file", newString: "safe", replaceAll: true },
    { filePath: "file", newString: "safe", structuredPatch: [{}] },
    {
      filePath: "file",
      newString: "safe",
      structuredPatch: [
        { oldStart: 1, oldLines: 2, newStart: 1, newLines: 1, lines: ["-old", "+safe"] },
      ],
    },
    {
      filePath: "file",
      newString: "safe",
      structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["unknown"] }],
    },
    {
      filePath: "file",
      newString: "safe",
      structuredPatch: [
        { oldStart: -1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-old", "+safe"] },
      ],
    },
    {
      filePath: "file",
      newString: "safe",
      structuredPatch: [
        { oldStart: 0, oldLines: 1, newStart: 1, newLines: 1, lines: ["-old", "+safe"] },
      ],
    },
    {
      filePath: "file",
      newString: "safe",
      structuredPatch: [
        { oldStart: 1, oldLines: 1, newStart: 0, newLines: 1, lines: ["-old", "+safe"] },
      ],
    },
    {
      filePath: "file",
      newString: "safe",
      structuredPatch: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: ["\\ No newline at end of file", "-old", "+safe"],
        },
      ],
    },
    { filePath: "file", newString: "safe", structuredPatch: "bad" },
    { filePath: "file", newString: "safe", extra: true },
  ]) {
    assert.strictEqual(renderFileToolOutput(edit, candidate, "/work"), undefined);
  }

  const write = result("write", [{ type: "text", text: "OLD_SECRET" }]);
  for (const candidate of [
    { filePath: 2, content: "safe" },
    { filePath: "file", content: 2 },
    { filePath: "file", content: "safe", type: "erase" },
    { filePath: "file", content: "safe", extra: true },
  ]) {
    assert.strictEqual(renderFileToolOutput(write, candidate, "/work"), undefined);
  }

  assert.strictEqual(renderFileToolOutput(result("bash", []), {}, "/work"), undefined);
});

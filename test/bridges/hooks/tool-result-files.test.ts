import assert from "node:assert/strict";
import test from "node:test";

import { fileToolResponse } from "../../../extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts";

import type { ToolResultEvent } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function result(
  toolName: string,
  input: Record<string, unknown>,
  content: ToolResultEvent["content"],
  details?: unknown,
): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "file",
    toolName,
    input,
    content,
    isError: false,
    details,
  };
}

test("read exposes an unambiguous complete text slice", () => {
  assert.deepStrictEqual(
    fileToolResponse(
      result("Read", { path: "file.txt" }, [{ type: "text", text: "first\nsecond\n" }]),
      "/work",
    ),
    {
      type: "text",
      file: {
        filePath: "/work/file.txt",
        content: "first\nsecond\n",
        startLine: 1,
        numLines: 3,
        totalLines: 3,
      },
    },
  );
});

test("empty read text has zero observed lines", () => {
  assert.deepStrictEqual(
    fileToolResponse(result("read", { path: "empty" }, [{ type: "text", text: "" }]), "/work"),
    {
      type: "text",
      file: { filePath: "/work/empty", content: "", startLine: 1, numLines: 0, totalLines: 0 },
    },
  );
});

test("read keeps a displayed notice-like suffix and omits uncertain counts", () => {
  const content = "first\n\n[1 more lines in file. Use offset=2 to continue.]";
  assert.deepStrictEqual(
    fileToolResponse(
      result("read", { path: "file.txt", offset: 2, limit: 1 }, [{ type: "text", text: content }]),
      "/work",
    ),
    {
      type: "text",
      file: { filePath: "/work/file.txt", content, startLine: 2 },
    },
  );
});

test("read prefers actual truncation content without inventing a whole-file count", () => {
  const response = fileToolResponse(
    result(
      "read",
      { path: "file.txt", offset: 4 },
      [{ type: "text", text: "selected\n\n[Showing lines 4-4 of 8. Use offset=5 to continue.]" }],
      { truncation: { truncated: true, content: "selected", outputLines: 1 } },
    ),
    "/work",
  );
  assert.deepStrictEqual(response, {
    type: "text",
    file: { filePath: "/work/file.txt", content: "selected", startLine: 4, numLines: 1 },
  });
});

test("read exposes the actual image without guessing dimensions or size", () => {
  assert.deepStrictEqual(
    fileToolResponse(
      result("read", { path: "image.png" }, [
        { type: "text", text: "resized" },
        { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
      ]),
      "/work",
    ),
    {
      type: "image",
      file: { base64: "aGVsbG8=", type: "image/png" },
    },
  );
});

test("write uses executed content, including an empty string", () => {
  assert.deepStrictEqual(
    fileToolResponse(
      result("write", { path: "empty.txt", content: "" }, [
        { type: "text", text: "Successfully wrote to empty.txt" },
      ]),
      "/work",
    ),
    { filePath: "/work/empty.txt", content: "" },
  );
});

test("edit gives each pair the actual shared patch as validated hunks", () => {
  const patch =
    "--- file.txt\n+++ file.txt\n@@ -1,1 +1,1 @@\n-old\n+new\n@@ -4,0 +5,1 @@\n+added\n\\ No newline at end of file\n";
  assert.deepStrictEqual(
    fileToolResponse(
      result(
        "Edit",
        {
          file_path: "/work/file.txt",
          old_string: "old",
          new_string: "new",
        },
        [{ type: "text", text: "done" }],
        { patch },
      ),
      "/work",
    ),
    {
      filePath: "/work/file.txt",
      oldString: "old",
      newString: "new",
      replaceAll: false,
      structuredPatch: [
        { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-old", "+new"] },
        {
          oldStart: 4,
          oldLines: 0,
          newStart: 5,
          newLines: 1,
          lines: ["+added", "\\ No newline at end of file"],
        },
      ],
    },
  );
});

test("malformed patch counts omit structured hunks", () => {
  assert.deepStrictEqual(
    fileToolResponse(
      result(
        "edit",
        {
          path: "file.txt",
          oldText: "old",
          newText: "new",
        },
        [{ type: "text", text: "done" }],
        { patch: "--- file.txt\n+++ file.txt\n@@ -1,2 +1,1 @@\n-old\n+new\n" },
      ),
      "/work",
    ),
    {
      filePath: "/work/file.txt",
      oldString: "old",
      newString: "new",
      replaceAll: false,
    },
  );
});

test("unified patch validation rejects incomplete headers and body syntax", () => {
  const input = { path: "file", oldText: "a", newText: "b" };
  for (const patch of [
    "--- file",
    "--- file\n+++ file\n",
    "no header\n+++ file\n@@ -1 +1 @@\n-a\n+b",
    "--- file\nno header\n@@ -1 +1 @@\n-a\n+b",
    "--- file\n+++ file\nnot a hunk",
    "--- file\n+++ file\n@@ -0,1 +1 @@\n-a\n+b",
    "--- file\n+++ file\n@@ -1 +0,1 @@\n-a\n+b",
    "--- file\n+++ file\n@@ -1 +1 @@\n?bad",
    "--- file\n+++ file\n@@ -1 +1 @@\n\\ No newline at end of file\n-a\n+b",
    "--- file\n+++ file",
  ]) {
    assert.deepStrictEqual(fileToolResponse(result("edit", input, [], { patch }), "/work"), {
      filePath: "/work/file",
      oldString: "a",
      newString: "b",
      replaceAll: false,
    });
  }
});

test("single-count unified hunk accepts context and a patch without final newline", () => {
  const patch = "--- file\n+++ file\n@@ -2 +2 @@\n a";
  assert.deepStrictEqual(
    fileToolResponse(
      result(
        "edit",
        {
          path: "file",
          oldText: "a",
          newText: "a",
        },
        [],
        { patch },
      ),
      "/work",
    ),
    {
      filePath: "/work/file",
      oldString: "a",
      newString: "a",
      replaceAll: false,
      structuredPatch: [{ oldStart: 2, oldLines: 1, newStart: 2, newLines: 1, lines: [" a"] }],
    },
  );
});

test("a first-line truncation does not assert line counts", () => {
  assert.deepStrictEqual(
    fileToolResponse(
      result("read", { path: "large" }, [{ type: "text", text: "fallback" }], {
        truncation: { truncated: true, content: "", firstLineExceedsLimit: true },
      }),
      "/work",
    ),
    {
      type: "text",
      file: { filePath: "/work/large", content: "", startLine: 1 },
    },
  );
});

test("a complete native truncation record allows a whole-file count", () => {
  assert.deepStrictEqual(
    fileToolResponse(
      result("read", { path: "short" }, [{ type: "text", text: "one" }], {
        truncation: { truncated: false, content: "one" },
      }),
      "/work",
    ),
    {
      type: "text",
      file: { filePath: "/work/short", content: "one", startLine: 1, numLines: 1, totalLines: 1 },
    },
  );
});

test("unsupported or incomplete file observations stay unprojected", () => {
  assert.strictEqual(fileToolResponse(result("bash", {}, []), "/work"), undefined);
  assert.strictEqual(fileToolResponse(result("read", {}, []), "/work"), undefined);
  assert.strictEqual(
    fileToolResponse(
      { ...result("read", {}, []), input: null } as unknown as ToolResultEvent,
      "/work",
    ),
    undefined,
  );
  assert.strictEqual(fileToolResponse(result("read", { path: "file" }, []), "/work"), undefined);
  assert.strictEqual(fileToolResponse(result("write", { path: "file" }, []), "/work"), undefined);
  assert.strictEqual(fileToolResponse(result("edit", { path: "file" }, []), "/work"), undefined);
});

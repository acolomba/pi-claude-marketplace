import assert from "node:assert/strict";
import test from "node:test";

import { searchShellToolResponse } from "../../../extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts";

import type { ToolResultEvent } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function result(
  toolName: string,
  content: ToolResultEvent["content"],
  details?: unknown,
  input: Record<string, unknown> = {},
): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "call",
    toolName,
    input,
    content,
    details,
    isError: false,
  };
}

test("glob projects complete emitted filenames and actual truncation", () => {
  assert.deepStrictEqual(
    searchShellToolResponse(
      result(
        "find",
        [{ type: "text", text: "a.ts\nb.ts\n\n[2 results limit reached]" }],
        { resultLimitReached: 2 },
        { pattern: "*.ts" },
      ),
      "/work",
    ),
    { filenames: ["/work/a.ts", "/work/b.ts"], numFiles: 2, truncated: true },
  );
});

test("bash projects combined blocks without inventing separate streams", () => {
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("bash", [{ type: "text", text: "out\n" }], { fullOutputPath: "/tmp/actual" }),
      "/work",
    ),
    {
      interrupted: false,
      persistedOutputPath: "/tmp/actual",
      structuredContent: [{ type: "text", text: "out\n" }],
    },
  );
});

test("powershell omits Bash-only content and unknown streams", () => {
  assert.deepStrictEqual(
    searchShellToolResponse(result("powershell", [{ type: "text", text: "combined" }]), "/work"),
    { interrupted: false },
  );
});

test("search retains literal notice-like source text without a native notice fact", () => {
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("grep", [{ type: "text", text: "file:1: [2 matches limit reached]" }]),
      "/work",
    ),
    { mode: "content", content: "file:1: [2 matches limit reached]", numLines: 1 },
  );
});

test("grep uses native truncation content and avoids ambiguous displayed counts", () => {
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("grep", [{ type: "text", text: "file:1: a\n\n[2 matches limit reached]" }], {
        matchLimitReached: 2,
      }),
      "/work",
    ),
    { mode: "content", content: "file:1: a", numLines: 1 },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("grep", [{ type: "text", text: "file:1: a\nfile-2- context" }], {
        truncation: { truncated: true, content: "file:1: a" },
      }),
      "/work",
    ),
    { mode: "content", content: "file:1: a", numLines: 1 },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("grep", [{ type: "text", text: "odd:colon:name:1: text\nfree text" }]),
      "/work",
    ),
    { mode: "content", content: "odd:colon:name:1: text\nfree text" },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(result("grep", [{ type: "text", text: "No matches found" }]), "/work"),
    { mode: "content", content: "", numLines: 0 },
  );
});

test("glob excludes byte-cut partial records and preserves known empty results", () => {
  assert.deepStrictEqual(
    searchShellToolResponse(
      result(
        "find",
        [{ type: "text", text: "good.ts\npar" }],
        { truncation: { truncated: true, content: "good.ts\npar" } },
        { path: "src" },
      ),
      "/work",
    ),
    { truncated: true, filenames: ["/work/src/good.ts"], numFiles: 1 },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("find", [{ type: "text", text: "No files found matching pattern" }]),
      "/work",
    ),
    { filenames: [], numFiles: 0 },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("find", [{ type: "text", text: "name\n" }], {
        truncation: { truncated: true, content: "name\n" },
      }),
      "/work",
    ),
    { truncated: true, filenames: ["/work/name"], numFiles: 1 },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(result("find", [{ type: "text", text: "a\n\nb" }]), "/work"),
    {},
  );
});

test("unsupported or contentless results fall through unchanged", () => {
  assert.strictEqual(
    searchShellToolResponse(result("ls", [{ type: "text", text: "native" }]), "/work"),
    undefined,
  );
  assert.strictEqual(searchShellToolResponse(result("grep", []), "/work"), undefined);
  assert.strictEqual(
    searchShellToolResponse(
      { ...result("bash", []), toolName: undefined as unknown as string },
      "/work",
    ),
    undefined,
  );
  assert.deepStrictEqual(
    searchShellToolResponse(result("powershell", [], { fullOutputPath: "/tmp/saved" }), "/work"),
    { interrupted: false, persistedOutputPath: "/tmp/saved" },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result(
        "grep",
        [
          {
            type: "text",
            text: "line\n\n[Some lines truncated to 4 chars. Use read tool to see full lines]",
          },
        ],
        { linesTruncated: true },
      ),
      "/work",
    ),
    { mode: "content", content: "line" },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(result("find", [], { truncation: { truncated: false } }), "/work"),
    undefined,
  );
  assert.deepStrictEqual(
    searchShellToolResponse(result("grep", [{ type: "text", text: "plain" }], {}), "/work"),
    { mode: "content", content: "plain" },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("grep", [{ type: "text", text: "literal notice" }], { matchLimitReached: 2 }),
      "/work",
    ),
    { mode: "content", content: "literal notice" },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("find", [{ type: "text", text: "name" }], { truncation: {} }),
      "/work",
    ),
    { filenames: ["/work/name"], numFiles: 1 },
  );
});

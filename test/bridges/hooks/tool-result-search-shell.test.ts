import assert from "node:assert/strict";
import { homedir } from "node:os";
import path from "node:path";
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

test("glob reports truncation without splitting ambiguous newline display", () => {
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
    { truncated: true },
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

test("glob excludes byte-cut partial records and ambiguous names", () => {
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
    { truncated: true },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("find", [{ type: "text", text: "name\n" }], {
        truncation: { truncated: true, content: "name\n" },
      }),
      "/work",
    ),
    { truncated: true },
  );
  assert.deepStrictEqual(
    searchShellToolResponse(result("find", [{ type: "text", text: "a\n\nb" }]), "/work"),
    {},
  );
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("find", [{ type: "text", text: "single.ts" }], undefined, { path: "src" }),
      "/work",
    ),
    { filenames: ["/work/src/single.ts"], numFiles: 1 },
  );
});

test("glob resolves native search roots before reporting a filename", () => {
  for (const { root, expected } of [
    { root: "~/docs", expected: path.join(homedir(), "docs", "a.txt") },
    { root: "@~/docs", expected: path.join(homedir(), "docs", "a.txt") },
    { root: "@src", expected: "/work/src/a.txt" },
    { root: "file:///work/my%20docs", expected: "/work/my docs/a.txt" },
    { root: "src\u00a0files", expected: "/work/src files/a.txt" },
  ]) {
    assert.deepStrictEqual(
      searchShellToolResponse(
        result("find", [{ type: "text", text: "a.txt" }], undefined, { path: root }),
        "/work",
      ),
      { filenames: [expected], numFiles: 1 },
      root,
    );
  }
});

test("unsupported or contentless results fall through unchanged", () => {
  assert.strictEqual(
    searchShellToolResponse(result("Bash", [{ type: "text", text: "custom" }]), "/work"),
    undefined,
  );
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

test("newline-bearing glob display does not invent two filenames", () => {
  assert.deepStrictEqual(
    searchShellToolResponse(
      result("find", [{ type: "text", text: "one\ntwo" }], undefined, { pattern: "*" }),
      "/work",
    ),
    {},
  );
});

test("glob omits filenames when an empty notice can be a real filename", () => {
  // arrange
  const toolEvent = result(
    "find",
    [{ type: "text", text: "No files found matching pattern" }],
    undefined,
    { pattern: "*" },
  );

  // act
  const hookResponse = searchShellToolResponse(toolEvent, "/work");

  // assert
  assert.deepStrictEqual(hookResponse, {});
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { renderSearchShellToolOutput } from "../../../extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts";

import type { ToolResultEvent } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function result(toolName: string): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "search-shell",
    toolName,
    input: {},
    content: [{ type: "text", text: "OLD_SECRET" }],
    details: { fullOutputPath: "OLD_SECRET" },
    structuredContent: "OLD_SECRET",
    isError: false,
  };
}

test("glob empty replacement erases original output and details", () => {
  assert.deepStrictEqual(renderSearchShellToolOutput(result("find"), { filenames: [] }, "/work"), {
    content: [{ type: "text", text: "" }],
    details: null,
  });
});

test("bash supplied image replaces original output without a path read", () => {
  assert.deepStrictEqual(
    renderSearchShellToolOutput(
      result("bash"),
      {
        structuredContent: [{ type: "image", data: "bmV3", mimeType: "image/png" }],
        persistedOutputPath: "/tmp/OLD_SECRET",
      },
      "/work",
    ),
    {
      content: [{ type: "image", data: "bmV3", mimeType: "image/png" }],
      details: null,
    },
  );
});

test("grep renders content, filenames, and supplied count without native input support", () => {
  for (const [candidate, text] of [
    [{ mode: "content", content: "safe\n" }, "safe\n"],
    [{ mode: "files_with_matches", filenames: ["a:b", "c\nd"] }, "a:b\nc\nd"],
    [{ mode: "count", numMatches: 2 }, "2"],
    [{ mode: "count", content: "a:2" }, "a:2"],
  ] as const) {
    assert.deepStrictEqual(renderSearchShellToolOutput(result("grep"), candidate, "/work"), {
      content: [{ type: "text", text }],
      details: null,
    });
  }
});

test("shell stream replacements keep separate order and explicit empties", () => {
  assert.deepStrictEqual(
    renderSearchShellToolOutput(result("bash"), { stdout: "", stderr: "err" }, "/work"),
    {
      content: [
        { type: "text", text: "" },
        { type: "text", text: "err" },
      ],
      details: null,
    },
  );
  assert.deepStrictEqual(
    renderSearchShellToolOutput(result("powershell"), { stderr: "" }, "/work"),
    {
      content: [{ type: "text", text: "" }],
      details: null,
    },
  );
  assert.deepStrictEqual(
    renderSearchShellToolOutput(
      result("bash"),
      { stdout: "duplicate", structuredContent: [{ type: "text", text: "safe" }] },
      "/work",
    ),
    {
      content: [{ type: "text", text: "safe" }],
      details: null,
    },
  );
  assert.deepStrictEqual(
    renderSearchShellToolOutput(result("bash"), { structuredContent: [] }, "/work"),
    {
      content: [],
      details: null,
    },
  );
});

test("valid projected echoes and metadata-only changes preserve the event", () => {
  const bash = result("bash");
  assert.strictEqual(
    renderSearchShellToolOutput(
      bash,
      { interrupted: false, persistedOutputPath: "OLD_SECRET", structuredContent: bash.content },
      "/work",
    ),
    undefined,
  );
  assert.strictEqual(
    renderSearchShellToolOutput(
      bash,
      { persistedOutputPath: "/tmp/new", interrupted: false },
      "/work",
    ),
    undefined,
  );
  assert.strictEqual(
    renderSearchShellToolOutput(
      result("powershell"),
      { interrupted: false, persistedOutputPath: "OLD_SECRET" },
      "/work",
    ),
    undefined,
  );
  assert.strictEqual(
    renderSearchShellToolOutput(result("find"), { filenames: ["/work/a"], numFiles: 1 }, "/work")
      ?.details,
    null,
  );
});

test("malformed and unknown search replacements keep the complete event", () => {
  for (const [tool, candidate] of [
    ["find", null],
    ["ls", { filenames: [] }],
    ["find", { filenames: "a" }],
    ["find", { filenames: [1] }],
    ["find", { filenames: ["a"], numFiles: -1 }],
    ["find", { filenames: ["a"], truncated: "true" }],
    ["find", { filenames: ["a"], unknown: "old" }],
    ["find", { durationMs: 1 }],
    ["grep", { mode: "bad", content: "safe" }],
    ["grep", { mode: "files_with_matches" }],
    ["grep", { mode: "count" }],
    ["grep", { mode: "content", content: 7 }],
    ["grep", { mode: "content", content: "safe", numLines: -1 }],
    ["grep", { mode: "content", content: "safe", timedOut: "no" }],
    ["bash", { structuredContent: "text" }],
    ["bash", { structuredContent: [{ type: "text", text: 1 }] }],
    ["bash", { structuredContent: [{ type: "image", data: "?", mimeType: "image/png" }] }],
    ["bash", { stdout: 1 }],
    ["powershell", { structuredContent: [] }],
    ["powershell", { rawOutputPath: "/tmp/x", stdout: "safe" }],
    ["bash", { stdout: "safe", persistedOutputSize: -1 }],
  ] as const) {
    const event = result(tool);
    const original = structuredClone(event);
    assert.strictEqual(
      renderSearchShellToolOutput(event, candidate, "/work"),
      undefined,
      `${tool}: ${JSON.stringify(candidate)}`,
    );
    assert.deepStrictEqual(event, original);
  }

  assert.strictEqual(
    renderSearchShellToolOutput(
      { ...result("bash"), toolName: undefined as unknown as string },
      { stdout: "safe" },
      "/work",
    ),
    undefined,
  );
});

test("a supplied output path remains metadata and never supplies replacement bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "hook-output-path-"));
  const secretPath = path.join(directory, "private.txt");
  const secret = "SECRET_NOT_TO_READ_206";
  try {
    await writeFile(secretPath, secret);
    const event = result("bash");
    const patch = renderSearchShellToolOutput(
      event,
      {
        stdout: "",
        persistedOutputPath: secretPath,
        rawOutputPath: "https://invalid.example/secret",
      },
      "/work",
    );
    assert.deepStrictEqual(patch, { content: [{ type: "text", text: "" }], details: null });
    assert.ok(!JSON.stringify(patch).includes(secret));
    assert.strictEqual(await readFile(secretPath, "utf8"), secret);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

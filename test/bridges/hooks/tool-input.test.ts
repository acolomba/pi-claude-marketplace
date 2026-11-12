import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  decodeHookToolInput,
  toHookToolInput,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts";

const CWD = "/workspace/project";
const HOME = "/workspace/home";

describe("toHookToolInput", () => {
  for (const { name, tool, input, expected } of [
    {
      name: "read path and line options",
      tool: "read",
      input: { path: "notes.txt", offset: 2, limit: 3 },
      expected: { file_path: `${CWD}/notes.txt`, offset: 2, limit: 3 },
    },
    {
      name: "read without optional lines",
      tool: "read",
      input: { path: "notes.txt" },
      expected: { file_path: `${CWD}/notes.txt` },
    },
    {
      name: "write content including empty text",
      tool: "write",
      input: { path: "~/notes.txt", content: "" },
      expected: { file_path: `${HOME}/notes.txt`, content: "" },
    },
    {
      name: "bash seconds as milliseconds",
      tool: "bash",
      input: { command: "echo ok", timeout: 0.25 },
      expected: { command: "echo ok", timeout: 250 },
    },
    {
      name: "powershell without timeout",
      tool: "powershell",
      input: { command: "Write-Output ok" },
      expected: { command: "Write-Output ok" },
    },
    {
      name: "custom input unchanged",
      tool: "Read",
      input: { path: "notes.txt" },
      expected: { path: "notes.txt" },
    },
  ]) {
    test(`forwards ${name}`, () => {
      // arrange
      const original = structuredClone(input);

      // act
      const hookInput = toHookToolInput(tool, input, CWD, HOME);

      // assert
      assert.deepStrictEqual(hookInput, expected);
      assert.deepStrictEqual(input, original);
      if (tool === "Read") {
        assert.strictEqual(hookInput, input);
      }
    });
  }

  test("normalizes an at-prefixed path and Unicode spaces", () => {
    // arrange
    const input = { path: "@~/wide\u00a0name.txt" };

    // act
    const hookInput = toHookToolInput("read", input, CWD, HOME);

    // assert
    assert.deepStrictEqual(hookInput, { file_path: `${HOME}/wide name.txt` });
  });

  test("expands a bare home path", () => {
    // arrange
    const input = { path: "~" };

    // act
    const hookInput = toHookToolInput("read", input, CWD, HOME);

    // assert
    assert.deepStrictEqual(hookInput, { file_path: HOME });
  });

  test("resolves a file URL", () => {
    // arrange
    const input = { path: "file:///workspace/project/note%20one.txt" };

    // act
    const hookInput = toHookToolInput("write", input, CWD, HOME);

    // assert
    assert.deepStrictEqual(hookInput, { file_path: `${CWD}/note one.txt`, content: undefined });
  });

  test("preserves a malformed native path for the hook", () => {
    // arrange
    const input = { path: null, extra: "kept" };

    // act
    const hookInput = toHookToolInput("read", input, CWD, HOME);

    // assert
    assert.strictEqual(hookInput, input);
  });
});

describe("decodeHookToolInput", () => {
  test("preserves every native field of an unchanged translated echo", () => {
    // arrange
    const original = { path: "notes.txt", offset: 1, hidden: "native" };
    const hookInput = { file_path: `${CWD}/notes.txt`, offset: 1 };

    // act
    const decoded = decodeHookToolInput("read", original, hookInput, CWD, HOME);

    // assert
    assert.deepStrictEqual(decoded, { kind: "accepted", input: original });
    if (decoded.kind === "accepted") {
      assert.strictEqual(decoded.input, original);
    }
  });

  for (const { name, tool, original, candidate, expected } of [
    {
      name: "read replacement removes omitted options",
      tool: "read",
      original: { path: "before.txt", offset: 3, limit: 4 },
      candidate: { file_path: "after.txt", offset: 2 },
      expected: { path: `${CWD}/after.txt`, offset: 2 },
    },
    {
      name: "read replacement keeps a supplied limit",
      tool: "read",
      original: { path: "before.txt", offset: 3 },
      candidate: { file_path: "after.txt", limit: 2 },
      expected: { path: `${CWD}/after.txt`, limit: 2 },
    },
    {
      name: "write replacement keeps empty bytes",
      tool: "write",
      original: { path: "before.txt", content: "old" },
      candidate: { file_path: "after.txt", content: "" },
      expected: { path: `${CWD}/after.txt`, content: "" },
    },
    {
      name: "bash fractional seconds",
      tool: "bash",
      original: { command: "old", timeout: 5 },
      candidate: {
        command: "new",
        timeout: 1250,
        description: "display",
        run_in_background: false,
      },
      expected: { command: "new", timeout: 1.25 },
    },
    {
      name: "powershell replacement",
      tool: "powershell",
      original: { command: "old", timeout: 5 },
      candidate: { command: "new", dangerouslyDisableSandbox: false },
      expected: { command: "new" },
    },
    {
      name: "custom schema",
      tool: "custom",
      original: { file_path: "before" },
      candidate: { file_path: "after" },
      expected: { file_path: "after" },
    },
  ]) {
    test(`accepts ${name}`, () => {
      // arrange
      const unchanged = structuredClone(original);

      // act
      const decoded = decodeHookToolInput(tool, original, candidate, CWD, HOME);

      // assert
      assert.deepStrictEqual(decoded, { kind: "accepted", input: expected });
      assert.deepStrictEqual(original, unchanged);
    });
  }

  for (const { name, tool, candidate, category } of [
    { name: "null candidate", tool: "read", candidate: null, category: "shape" },
    { name: "array candidate", tool: "read", candidate: [], category: "shape" },
    {
      name: "prototype key",
      tool: "read",
      candidate: JSON.parse('{"__proto__":{},"file_path":"x"}') as unknown,
      category: "field",
    },
    {
      name: "constructor key",
      tool: "bash",
      candidate: { constructor: "x", command: "true" },
      category: "field",
    },
    {
      name: "unknown read field",
      tool: "read",
      candidate: { file_path: "x", max_bytes: "secret" },
      category: "field",
    },
    {
      name: "nonempty pages",
      tool: "read",
      candidate: { file_path: "x", pages: "1" },
      category: "field",
    },
    { name: "missing read path", tool: "read", candidate: { offset: 1 }, category: "value" },
    { name: "empty read path", tool: "read", candidate: { file_path: "" }, category: "value" },
    {
      name: "fractional offset",
      tool: "read",
      candidate: { file_path: "x", offset: 1.5 },
      category: "value",
    },
    {
      name: "negative limit",
      tool: "read",
      candidate: { file_path: "x", limit: -1 },
      category: "value",
    },
    {
      name: "missing write content",
      tool: "write",
      candidate: { file_path: "x" },
      category: "value",
    },
    {
      name: "unknown write field",
      tool: "write",
      candidate: { file_path: "x", content: "", encoding: "binary" },
      category: "field",
    },
    {
      name: "unknown shell field",
      tool: "bash",
      candidate: { command: "true", env: { secret: "x" } },
      category: "field",
    },
    { name: "missing shell command", tool: "bash", candidate: {}, category: "value" },
    {
      name: "non-string description",
      tool: "bash",
      candidate: { command: "true", description: 1 },
      category: "value",
    },
    {
      name: "background shell",
      tool: "bash",
      candidate: { command: "true", run_in_background: true },
      category: "value",
    },
    {
      name: "sandbox override",
      tool: "bash",
      candidate: { command: "true", dangerouslyDisableSandbox: true },
      category: "value",
    },
    {
      name: "zero timeout",
      tool: "bash",
      candidate: { command: "true", timeout: 0 },
      category: "value",
    },
    {
      name: "timeout below native resolution",
      tool: "bash",
      candidate: { command: "true", timeout: Number.MIN_VALUE },
      category: "value",
    },
    {
      name: "infinite timeout",
      tool: "powershell",
      candidate: { command: "true", timeout: Infinity },
      category: "value",
    },
    {
      name: "oversized timeout",
      tool: "powershell",
      candidate: { command: "true", timeout: 2_147_483_648_000 },
      category: "value",
    },
  ]) {
    test(`rejects ${name} without changing the original`, () => {
      // arrange
      const original = { path: "original.txt", command: "original", timeout: 2, content: "old" };
      const unchanged = structuredClone(original);

      // act
      const decoded = decodeHookToolInput(tool, original, candidate, CWD, HOME);

      // assert
      assert.deepStrictEqual(decoded, { kind: "ignored", category });
      assert.deepStrictEqual(original, unchanged);
    });
  }
});

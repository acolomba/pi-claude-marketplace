import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  decodeSearchInput,
  toHookSearchInput,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/tool-input-search.ts";

describe("toHookSearchInput", () => {
  test("maps a glob without exposing Pi's result cap", () => {
    const original = { pattern: "*.ts", path: "src", limit: 2 };
    assert.deepStrictEqual(toHookSearchInput("find", original), {
      pattern: "*.ts",
      path: "src",
    });
    assert.deepStrictEqual(original, { pattern: "*.ts", path: "src", limit: 2 });
  });

  test("passes through a malformed native search for diagnostics", () => {
    const original = { pattern: null };
    assert.strictEqual(toHookSearchInput("find", original), original);
  });

  test("projects a literal content search with its effective match limit", () => {
    assert.deepStrictEqual(
      toHookSearchInput("grep", {
        pattern: "a.b[0]",
        path: "src",
        glob: "*.ts",
        ignoreCase: false,
        literal: true,
        context: 0,
        limit: 2,
      }),
      {
        pattern: "a\\.b\\[0\\]",
        path: "src",
        glob: "*.ts",
        output_mode: "content",
        "-n": true,
        "-i": false,
        context: 0,
        head_limit: 2,
      },
    );
  });

  test("uses the native default cap only without context", () => {
    assert.deepStrictEqual(toHookSearchInput("grep", { pattern: "needle" }), {
      pattern: "needle",
      output_mode: "content",
      "-n": true,
      head_limit: 100,
    });
    assert.deepStrictEqual(toHookSearchInput("grep", { pattern: "needle", context: 2, limit: 3 }), {
      pattern: "needle",
      output_mode: "content",
      "-n": true,
      context: 2,
    });
  });
});

describe("decodeSearchInput", () => {
  test("rebuilds a changed glob and retains only its native result cap", () => {
    assert.deepStrictEqual(
      decodeSearchInput("find", { pattern: "*.ts", path: "src", limit: 2 }, { pattern: "*.md" }),
      { kind: "accepted", input: { pattern: "*.md", limit: 2 } },
    );
    assert.deepStrictEqual(
      decodeSearchInput("find", { pattern: "*.ts" }, { pattern: "*.md", path: "docs" }),
      {
        kind: "accepted",
        input: { pattern: "*.md", path: "docs" },
      },
    );
  });

  test("keeps native literal matching when only another field changes", () => {
    assert.deepStrictEqual(
      decodeSearchInput(
        "grep",
        { pattern: "a.b", literal: true, limit: 4 },
        { pattern: "a\\.b", output_mode: "content", "-n": true, "-i": true, head_limit: 2 },
      ),
      { kind: "accepted", input: { pattern: "a.b", literal: true, ignoreCase: true, limit: 2 } },
    );
  });

  test("uses regex mode when a hook changes a native literal pattern", () => {
    assert.deepStrictEqual(
      decodeSearchInput(
        "grep",
        { pattern: "a.b", literal: true },
        { pattern: "b.+", output_mode: "content", "-n": true, glob: "*.txt" },
      ),
      { kind: "accepted", input: { pattern: "b.+", glob: "*.txt" } },
    );
  });

  test("accepts equal context aliases while retaining the native match cap", () => {
    assert.deepStrictEqual(
      decodeSearchInput(
        "grep",
        { pattern: "old", limit: 4 },
        {
          pattern: "new",
          output_mode: "content",
          "-n": true,
          context: 2,
          "-C": 2,
          "-A": 2,
          "-B": 2,
          "-i": false,
          "-o": false,
          offset: 0,
          multiline: false,
        },
      ),
      { kind: "accepted", input: { pattern: "new", ignoreCase: false, context: 2, limit: 4 } },
    );
    assert.deepStrictEqual(
      decodeSearchInput(
        "grep",
        { pattern: "old" },
        {
          pattern: "new",
          output_mode: "content",
          "-n": true,
          "-A": 1,
          "-B": 1,
        },
      ),
      { kind: "accepted", input: { pattern: "new", context: 1 } },
    );
  });

  for (const { name, tool, candidate, category } of [
    {
      name: "unknown glob option",
      tool: "find",
      candidate: { pattern: "*.md", sort: "time" },
      category: "field",
    },
    { name: "missing glob pattern", tool: "find", candidate: { path: "src" }, category: "value" },
    {
      name: "non-string glob path",
      tool: "find",
      candidate: { pattern: "*.md", path: 2 },
      category: "value",
    },
    {
      name: "unknown grep field",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, line: 1 },
      category: "field",
    },
    {
      name: "missing grep pattern",
      tool: "grep",
      candidate: { output_mode: "content", "-n": true },
      category: "value",
    },
    {
      name: "files mode",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "files_with_matches", "-n": true },
      category: "value",
    },
    {
      name: "count mode",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "count", "-n": true },
      category: "value",
    },
    {
      name: "omitted mode",
      tool: "grep",
      candidate: { pattern: "x", "-n": true },
      category: "value",
    },
    {
      name: "disabled line numbers",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": false },
      category: "value",
    },
    {
      name: "non-string file glob",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, glob: 4 },
      category: "value",
    },
    {
      name: "nonboolean case option",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, "-i": 1 },
      category: "value",
    },
    {
      name: "only matching",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, "-o": true },
      category: "value",
    },
    {
      name: "positive offset",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, offset: 1 },
      category: "value",
    },
    {
      name: "multiline",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, multiline: true },
      category: "value",
    },
    {
      name: "language type",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, type: "ts" },
      category: "value",
    },
    {
      name: "fractional context",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, context: 1.5 },
      category: "value",
    },
    {
      name: "negative before context",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, "-B": -1 },
      category: "value",
    },
    {
      name: "conflicting symmetric aliases",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, context: 1, "-C": 2 },
      category: "value",
    },
    {
      name: "asymmetric context",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, "-A": 1, "-B": 2 },
      category: "value",
    },
    {
      name: "before alias conflicts with context",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, context: 1, "-B": 2, "-A": 2 },
      category: "value",
    },
    {
      name: "after alias conflicts with context",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, context: 1, "-A": 2, "-B": 2 },
      category: "value",
    },
    {
      name: "context with output cap",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, context: 1, head_limit: 2 },
      category: "value",
    },
    {
      name: "zero output cap",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, head_limit: 0 },
      category: "value",
    },
    {
      name: "fractional output cap",
      tool: "grep",
      candidate: { pattern: "x", output_mode: "content", "-n": true, head_limit: 1.5 },
      category: "value",
    },
  ] as const) {
    test(`rejects ${name} without applying a partial search`, () => {
      const original = { pattern: "original", limit: 3 };
      const before = structuredClone(original);
      const decoded = decodeSearchInput(tool, original, candidate);
      assert.deepStrictEqual(decoded, { kind: "ignored", category });
      assert.deepStrictEqual(original, before);
    });
  }
});

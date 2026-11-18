import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decideEditBatch,
  editPairToolUseId,
  editPairViews,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts";

const cwd = "/workspace/project";
const home = "/home/tester";
const native = {
  path: "document.txt",
  edits: [
    { oldText: "first", newText: "one" },
    { oldText: "second", newText: "two" },
  ],
};

function batch() {
  const result = editPairViews(native, cwd, home);
  assert.ok(result);
  return result;
}

const rewrite = (old_string: string, new_string: string, file_path = "document.txt") => ({
  file_path,
  old_string,
  new_string,
});

test("preserves every valid pair in native order, including equal values", () => {
  const result = editPairViews(
    {
      path: "document.txt",
      edits: [
        { oldText: "same", newText: "same" },
        { oldText: "same", newText: "same" },
      ],
    },
    cwd,
    home,
  );
  assert.deepStrictEqual(result?.pairs, [
    {
      index: 0,
      input: { file_path: `${cwd}/document.txt`, old_string: "same", new_string: "same" },
    },
    {
      index: 1,
      input: { file_path: `${cwd}/document.txt`, old_string: "same", new_string: "same" },
    },
  ]);
  assert.ok(Object.isFrozen(result.pairs[0]));
  assert.ok(Object.isFrozen(result.pairs[0]?.input));
});

test("passes zero, malformed and null pairs back to Pi without manufacturing views", () => {
  for (const input of [
    null,
    [],
    {},
    { path: 1, edits: [] },
    { path: "x", edits: [] },
    { path: "x", edits: [null] },
    { path: "x", edits: [[]] },
    { path: "x", edits: [{ oldText: 1, newText: "y" }] },
    { path: "x", edits: [{ oldText: "x", newText: 1 }] },
    { path: "file://%not-a-uri", edits: [{ oldText: "x", newText: "y" }] },
  ]) {
    assert.strictEqual(editPairViews(input, cwd, home), undefined);
  }
});

test("keeps the original native batch with no rewrite", () => {
  assert.deepStrictEqual(decideEditBatch(batch(), [[], []], cwd, home), { kind: "unchanged" });
  assert.deepStrictEqual(decideEditBatch(batch(), [], cwd, home), { kind: "unchanged" });
  assert.deepStrictEqual(decideEditBatch(batch(), [[undefined], []], cwd, home), {
    kind: "unchanged",
  });
});

test("accepts the last supported pair rewrite and preserves the other pair", () => {
  assert.deepStrictEqual(
    decideEditBatch(
      batch(),
      [[rewrite("first", "FIRST"), { ...rewrite("first", "LAST"), replace_all: false }], []],
      cwd,
      home,
    ),
    {
      kind: "accepted",
      input: {
        path: `${cwd}/document.txt`,
        edits: [
          { oldText: "first", newText: "LAST" },
          { oldText: "second", newText: "two" },
        ],
      },
    },
  );
  assert.deepStrictEqual(native.edits[0], { oldText: "first", newText: "one" });
});

test("blocks conflicting final accepted targets, including an unchanged pair", () => {
  assert.deepStrictEqual(
    decideEditBatch(batch(), [[rewrite("first", "one", "other.txt")], []], cwd, home),
    { kind: "block" },
  );
  assert.deepStrictEqual(
    decideEditBatch(
      batch(),
      [
        [rewrite("first", "one", "first.txt"), rewrite("first", "one", "document.txt")],
        [rewrite("second", "two", "document.txt")],
      ],
      cwd,
      home,
    ),
    { kind: "accepted", input: nativeWithAbsolutePath() },
  );
});

function nativeWithAbsolutePath() {
  return { ...native, path: `${cwd}/document.txt` };
}

test("a supported target conflict outranks an unsupported proposal", () => {
  assert.deepStrictEqual(
    decideEditBatch(batch(), [[rewrite("first", "one", "other.txt"), { extra: 1 }], []], cwd, home),
    { kind: "block" },
  );
});

test("any unsupported proposal discards every accepted rewrite", () => {
  for (const [proposal, category] of [
    [null, "shape"],
    [[], "shape"],
    [7, "shape"],
    [{ ...rewrite("second", "TWO"), extra: true }, "field"],
    [{ ...rewrite("second", "TWO"), replace_all: true }, "value"],
    [{ ...rewrite("second", "TWO"), replace_all: 1 }, "value"],
    [{ ...rewrite("second", "TWO"), old_string: 1 }, "value"],
    [{ ...rewrite("second", "TWO"), new_string: 1 }, "value"],
    [{ ...rewrite("second", "TWO"), file_path: 1 }, "value"],
    [rewrite("second", "TWO", "file://%not-a-uri"), "value"],
  ] as const) {
    assert.deepStrictEqual(
      decideEditBatch(batch(), [[rewrite("first", "ONE")], [proposal]], cwd, home),
      { kind: "original", category },
    );
  }
});

for (const { toolCallId, pairIndex, pairCount, expectedId } of [
  { toolCallId: "call-1", pairIndex: 0, pairCount: 1, expectedId: "call-1" },
  { toolCallId: "call-1", pairIndex: 0, pairCount: 2, expectedId: "call-1#1" },
  { toolCallId: "call-1", pairIndex: 1, pairCount: 2, expectedId: "call-1#2" },
  { toolCallId: "call-1/3", pairIndex: 1, pairCount: 3, expectedId: "call-1/3#2" },
]) {
  test(`gives pair ${pairIndex} of ${pairCount} of ${toolCallId} the id ${expectedId} (D-PG6-05)`, () => {
    // act
    const pairId = editPairToolUseId(toolCallId, pairIndex, pairCount);

    // assert
    assert.strictEqual(pairId, expectedId);
  });
}

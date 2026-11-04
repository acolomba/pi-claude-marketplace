import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { BUILTIN_FIELD_ENCODER } from "../../../extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts";

import type {
  ClaudeEnv,
  Segment,
} from "../../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";

interface ExpandedRow {
  readonly title: string;
  readonly segments: readonly Segment[];
  readonly secret: boolean;
  readonly env: ClaudeEnv;
  readonly written: string;
}

function text(value: string): Segment {
  return { kind: "text", text: value };
}

function ref(name: string, fallback?: string): Segment {
  return fallback === undefined ? { kind: "ref", name } : { kind: "ref", name, fallback };
}

const EXPANDED_ROWS: readonly ExpandedRow[] = [
  {
    title: "AVAR-02: a set variable gives its value",
    segments: [text("a-"), ref("K"), text("-b")],
    secret: false,
    env: { K: "v" },
    written: "a-v-b",
  },
  {
    title: "AVAR-02: a variable set to the empty string gives the empty string, not its default",
    segments: [ref("K", "d")],
    secret: false,
    env: { K: "" },
    written: "",
  },
  {
    title: "AVAR-02: an unset variable gives its default",
    segments: [ref("K", "d")],
    secret: false,
    env: {},
    written: "d",
  },
  {
    title: "AVAR-02: an unset variable without a default keeps its literal reference",
    segments: [ref("K")],
    secret: false,
    env: {},
    written: "${K}",
  },
  {
    title: "AVAR-02: a variable listed as undefined reads as unset",
    segments: [ref("K", "d")],
    secret: false,
    env: { K: undefined },
    written: "d",
  },
  {
    title: "AVAR-02: an inherited property is not a set variable",
    segments: [ref("toString")],
    secret: false,
    env: {},
    written: "${toString}",
  },
  {
    title: "BLT-02: a secret field doubles every $",
    segments: [text("cost $5 and "), ref("K")],
    secret: true,
    env: { K: "$HOME" },
    written: "cost $$5 and $$HOME",
  },
  {
    title: "BLT-02: a secret field puts a $ before a leading !",
    segments: [ref("K")],
    secret: true,
    env: { K: "!cmd" },
    written: "$!cmd",
  },
  {
    title: "BLT-02: a secret field doubles the $ of a leading $!",
    segments: [text("$!x")],
    secret: true,
    env: {},
    written: "$$!x",
  },
  {
    title: "BLT-02: a secret field writes a kept reference as $${NAME}",
    segments: [ref("K")],
    secret: true,
    env: {},
    written: "$${K}",
  },
  {
    title: "BLT-02: a plain field is never escaped",
    segments: [text("!cost $5 "), ref("K")],
    secret: false,
    env: { K: "$!x" },
    written: "!cost $5 $!x",
  },
];

describe("BUILTIN_FIELD_ENCODER.expanded", () => {
  for (const { title, segments, secret, env, written } of EXPANDED_ROWS) {
    test(title, () => {
      // arrange
      const expectedWritten = written;

      // act
      const writtenValue = BUILTIN_FIELD_ENCODER.expanded(segments, secret, env);

      // assert
      assert.strictEqual(writtenValue, expectedWritten);
    });
  }
});

describe("BUILTIN_FIELD_ENCODER.literal", () => {
  test("BLT-02: a secret literal is escaped for Pi", () => {
    // arrange
    const expectedWritten = "$!run $$HOME";

    // act
    const writtenValue = BUILTIN_FIELD_ENCODER.literal("!run $HOME", true);

    // assert
    assert.strictEqual(writtenValue, expectedWritten);
  });

  test("BLT-02: a plain literal is written as it is", () => {
    // arrange
    const expectedWritten = "!run $HOME";

    // act
    const writtenValue = BUILTIN_FIELD_ENCODER.literal("!run $HOME", false);

    // assert
    assert.strictEqual(writtenValue, expectedWritten);
  });
});

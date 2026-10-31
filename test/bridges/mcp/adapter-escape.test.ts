import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  serializeLiteral,
  serializeSegments,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts";

import type { Segment } from "../../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";

interface SerializeRow {
  readonly title: string;
  readonly segments: readonly Segment[];
  readonly secret: boolean;
  readonly written: string;
}

const SPLIT = "{env:PI_CLAUDE_MARKETPLACE_EMPTY}";

function text(value: string): Segment {
  return { kind: "text", text: value };
}

function ref(name: string): Segment {
  return { kind: "ref", name };
}

const ROWS: readonly SerializeRow[] = [
  {
    title: "AVAR-03: splits literal {env:K}",
    segments: [text("{env:K}")],
    secret: false,
    written: `{env:${SPLIT}K}`,
  },
  {
    title: "AVAR-03: splits literal $env:K",
    segments: [text("$env:K")],
    secret: false,
    written: `$env${SPLIT}:K`,
  },
  {
    title: "AVAR-03: splits a literal ${K}",
    segments: [text("${K}")],
    secret: false,
    written: `$${SPLIT}{K}`,
  },
  {
    title: "AVAR-03: splits the adapter-only literal ${1X}",
    segments: [text("${1X}")],
    secret: false,
    written: `$${SPLIT}{1X}`,
  },
  {
    title: "AVAR-03: splits each trigger of a nested {env:{env:K}} once",
    segments: [text("{env:{env:K}}")],
    secret: false,
    written: `{env:${SPLIT}{env:${SPLIT}K}}`,
  },
  {
    title: "AVAR-03: leaves a $ before a non-word brace body unsplit",
    segments: [text("${env:K}")],
    secret: false,
    written: `\${env:${SPLIT}K}`,
  },
  ...["$", "$e", "$en", "$env", "{", "{e", "{en", "{env"].map((tail): SerializeRow => ({
    title: `AVAR-03: guards a reference after the partial trigger ${tail}`,
    segments: [text(tail), ref("PI_CM_R")],
    secret: false,
    written: `${tail}${SPLIT}\${PI_CM_R}`,
  })),
  {
    title: "AVAR-03: does not guard a reference after plain text",
    segments: [text("x"), ref("PI_CM_R")],
    secret: false,
    written: "x${PI_CM_R}",
  },
  {
    title: "AVAR-03: does not guard a reference after a reference",
    segments: [text("{"), ref("PI_CM_A"), ref("PI_CM_B")],
    secret: false,
    written: `{${SPLIT}\${PI_CM_A}\${PI_CM_B}`,
  },
  ...["env:K", "nv:K", "v:K", ":K", ":0", "K", "_x", "0", "}"].map((completion): SerializeRow => ({
    title: `AVAR-03: guards ${completion} after a reference`,
    segments: [ref("PI_CM_R"), text(completion)],
    secret: false,
    written: `\${PI_CM_R}${SPLIT}${completion}`,
  })),
  ...[":", ":/", "/x", "-x", ".x", "@x", " x", "{x"].map((following): SerializeRow => ({
    title: `AVAR-03: does not guard ${following} after a reference`,
    segments: [ref("PI_CM_R"), text(following)],
    secret: false,
    written: `\${PI_CM_R}${following}`,
  })),
  {
    title: "AVAR-03: does not guard a : between two references",
    segments: [ref("PI_CM_A"), text(":"), ref("PI_CM_B")],
    secret: false,
    written: "${PI_CM_A}:${PI_CM_B}",
  },
  {
    title: "AVAR-03: guards the start of a merged run after a reference",
    segments: [ref("PI_CM_R"), text("e"), text("nv:K")],
    secret: false,
    written: `\${PI_CM_R}${SPLIT}env:K`,
  },
  {
    title: "AVAR-03: guards both sides of a reference between a partial trigger and its completion",
    segments: [text("$en"), ref("PI_CM_R"), text("v:K")],
    secret: false,
    written: `$en${SPLIT}\${PI_CM_R}${SPLIT}v:K`,
  },
  {
    title: "AVAR-03: does not guard a field that starts with a name character",
    segments: [text("K"), ref("PI_CM_R")],
    secret: false,
    written: "K${PI_CM_R}",
  },
  {
    title: "AVAR-03: escapes adjacent text segments as one merged run",
    segments: [text("{"), text("env:K}")],
    secret: false,
    written: `{env:${SPLIT}K}`,
  },
  {
    title: "AVAR-03: guards a reference after a merged partial trigger",
    segments: [text("{"), text("e"), ref("PI_CM_R")],
    secret: false,
    written: `{e${SPLIT}\${PI_CM_R}`,
  },
  {
    title: "AVAR-03: doubles a leading ! in a secret field",
    segments: [text("!x")],
    secret: true,
    written: "!!x",
  },
  {
    title: "AVAR-03: adds one ! to a leading !! in a secret field",
    segments: [text("!!x")],
    secret: true,
    written: "!!!x",
  },
  {
    title: "AVAR-03: doubles the ! before a reference in a secret field",
    segments: [text("!"), ref("PI_CM_X")],
    secret: true,
    written: "!!${PI_CM_X}",
  },
  {
    title: "AVAR-03: leaves a leading ! in a plain field",
    segments: [text("!x")],
    secret: false,
    written: "!x",
  },
  {
    title: "AVAR-03: writes no segments as the empty string",
    segments: [],
    secret: true,
    written: "",
  },
];

describe("serializeSegments", () => {
  for (const { title, segments, secret, written } of ROWS) {
    test(title, () => {
      // arrange
      const expectedWritten = written;

      // act
      const writtenValue = serializeSegments(segments, secret);

      // assert
      assert.strictEqual(writtenValue, expectedWritten);
    });
  }
});

describe("serializeLiteral", () => {
  test("AVAR-03: splits a whole literal value", () => {
    // arrange
    const expectedWritten = `https://m/$env${SPLIT}:K`;

    // act
    const writtenValue = serializeLiteral("https://m/$env:K", false);

    // assert
    assert.strictEqual(writtenValue, expectedWritten);
  });

  test("AVAR-03: doubles a leading ! in a secret literal", () => {
    // arrange
    const expectedWritten = `!!$${SPLIT}{K}`;

    // act
    const writtenValue = serializeLiteral("!${K}", true);

    // assert
    assert.strictEqual(writtenValue, expectedWritten);
  });
});

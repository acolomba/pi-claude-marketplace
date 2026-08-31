import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { compilePathGlob } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts";

describe("compilePathGlob", () => {
  test("compiles a normalized contained path glob into complete metadata", () => {
    // arrange
    const expectedMetadata = {
      raw: "./src/**/report-*.ts",
      anchor: { kind: "cwd" },
      absoluteBase: "/workspace/project",
      tokens: [
        { kind: "literal", text: "src" },
        { kind: "slash" },
        { kind: "globstar" },
        { kind: "slash" },
        { kind: "literal", text: "report-" },
        { kind: "star" },
        { kind: "literal", text: ".ts" },
      ],
    };
    const expectedMatches = {
      contained: true,
      outsideBase: false,
    };

    // act
    const pathGlob = compilePathGlob("./src/**/report-*.ts", {
      homedir: "/home/reader",
      cwd: "/workspace/./project",
      projectRoot: "/workspace/root",
    });
    const metadata = {
      raw: pathGlob.raw,
      anchor: pathGlob.anchor,
      absoluteBase: pathGlob.absoluteBase,
      tokens: pathGlob.tokens,
    };
    const matches = {
      contained: pathGlob.testAbsolute("/workspace/project/src/deep/report-one.ts"),
      outsideBase: pathGlob.testAbsolute("/workspace/other/src/deep/report-one.ts"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });
});

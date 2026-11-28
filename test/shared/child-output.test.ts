import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  boundedNote,
  compactOutput,
} from "../../extensions/pi-claude-marketplace/shared/child-output.ts";

describe("compactOutput", () => {
  for (const { situation, output, compacted } of [
    {
      situation: "npm's error lines without its warnings, prefixes, or control characters",
      output: [
        "npm warn config production Use `--omit=dev` instead.",
        "\u001b[31mnpm error\u001b[39m code E404",
        "npm ERR! 404 Not Found\t- GET http://127.0.0.1/pkd-dep\u0007",
        "",
        "npm error A complete log of this run can be found in: /home/user/.npm/_logs/debug.log",
        "",
      ].join("\r\n"),
      compacted:
        "code E404; 404 Not Found - GET http://127.0.0.1/pkd-dep; A complete log of this run can be found in: /home/user/.npm/_logs/debug.log",
    },
    {
      situation: "npm's warnings when it printed nothing else",
      output: "npm warn old lockfile\nnpm warn tarball corrupt\n",
      compacted: "npm warn old lockfile; npm warn tarball corrupt",
    },
    {
      situation: "another tool's lines as they are, one per part",
      output: "Cloning into 'tools'...\nfatal: repository 'https://host/x.git/' not found\n",
      compacted: "Cloning into 'tools'...; fatal: repository 'https://host/x.git/' not found",
    },
    {
      situation: "nothing for output with only blank lines",
      output: " \r\n\t\n",
      compacted: "",
    },
  ]) {
    test(`D-PL9-10, D-SG-32: keeps ${situation}`, () => {
      // arrange
      const printed = output;

      // act
      const line = compactOutput(printed);

      // assert
      assert.strictEqual(line, compacted);
    });
  }
});

describe("boundedNote", () => {
  for (const { rule, keep, note, bounded } of [
    {
      rule: "keeps a 500-unit note whole",
      keep: "head",
      note: "e".repeat(500),
      bounded: "e".repeat(500),
    },
    {
      rule: "keeps the first 500 units of a longer note",
      keep: "head",
      note: `${"h".repeat(500)}t`,
      bounded: "h".repeat(500),
    },
    {
      rule: "drops the high surrogate the cut would split",
      keep: "head",
      note: `${"e".repeat(499)}😀`,
      bounded: "e".repeat(499),
    },
    {
      rule: "keeps a surrogate pair that ends at the bound",
      keep: "head",
      note: `${"e".repeat(498)}😀tail`,
      bounded: `${"e".repeat(498)}😀`,
    },
    {
      rule: "keeps a 500-unit note whole",
      keep: "tail",
      note: "e".repeat(500),
      bounded: "e".repeat(500),
    },
    {
      rule: "keeps the last 500 units of a longer note",
      keep: "tail",
      note: `h${"t".repeat(500)}`,
      bounded: "t".repeat(500),
    },
    {
      rule: "drops the low surrogate the cut would split",
      keep: "tail",
      note: `😀${"e".repeat(499)}`,
      bounded: "e".repeat(499),
    },
    {
      rule: "keeps a surrogate pair that starts at the bound",
      keep: "tail",
      note: `head😀${"e".repeat(498)}`,
      bounded: `😀${"e".repeat(498)}`,
    },
    { rule: "keeps an empty note empty", keep: "tail", note: "", bounded: "" },
  ] as const) {
    test(`D-PL9-10, D-SG-32: the ${keep} cut ${rule}`, () => {
      // arrange
      const text = note;

      // act
      const cut = boundedNote(text, keep);

      // assert
      assert.strictEqual(cut, bounded);
    });
  }
});

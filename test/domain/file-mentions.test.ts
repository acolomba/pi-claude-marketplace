import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  appendFileBlocks,
  findFileMentions,
  renderMentionBlock,
} from "../../extensions/pi-claude-marketplace/domain/file-mentions.ts";

import type { FileMention } from "../../extensions/pi-claude-marketplace/domain/file-mentions.ts";

function whole(text: string): FileMention {
  return { text, path: text, lines: undefined };
}

describe("findFileMentions", () => {
  for (const { title, body, expected } of [
    {
      title: "D-PG11-04: reads an unquoted mention that starts a token",
      body: "Review @docs/a.md now",
      expected: [whole("docs/a.md")],
    },
    {
      title: "D-PG11-04: reads no mention from an @ that follows other text",
      body: "see@docs/a.md",
      expected: [],
    },
    {
      title: "D-PG11-04: reads no mention from an address",
      body: "mail a@b.md",
      expected: [],
    },
    {
      title: "D-PG11-04: reads a mention after an ideographic full stop",
      body: "see\u3002@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a mention after an ideographic comma",
      body: "see\u3001@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a mention after a fullwidth question mark",
      body: "see\uFF1F@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a mention after a fullwidth exclamation mark",
      body: "see\uFF01@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a quoted mention with its space",
      body: 'Read @"my notes.md" now',
      expected: [whole("my notes.md")],
    },
    {
      title: "D-PG11-04: reads a quoted mention after a mark",
      body: 'see\u3002@"my notes.md"',
      expected: [whole("my notes.md")],
    },
    {
      title: "D-PG11-04: reads no mention from a quoted form with no closing quote",
      body: 'Read @"my notes.md',
      expected: [],
    },
    { title: "D-PG11-04: cuts a trailing comma", body: "@a.md,", expected: [whole("a.md")] },
    { title: "D-PG11-04: cuts a trailing slash", body: "@dir/", expected: [whole("dir")] },
    { title: "D-PG11-04: cuts trailing plus signs", body: "@x.c++", expected: [whole("x.c")] },
    { title: "D-PG11-04: cuts a closing parenthesis", body: "@a.md)", expected: [whole("a.md")] },
    { title: "D-PG11-04: cuts a final full stop", body: "@a.md.", expected: [whole("a.md")] },
    { title: "D-PG11-04: reads no mention from an @ alone", body: "@ here", expected: [] },
    {
      title: "D-PG11-04: reads no mention when the cut leaves nothing",
      body: "@...",
      expected: [],
    },
    {
      title: "D-PG11-04: ends a path at its last ASCII word character",
      body: "@caf\u00E9",
      expected: [whole("caf")],
    },
    {
      title: "D-PG11-04: reads a one-line range",
      body: "@a.md#L10",
      expected: [{ text: "a.md#L10", path: "a.md", lines: { start: 10, end: 10 } }],
    },
    {
      title: "D-PG11-04: reads a range of lines",
      body: "@a.md#L10-20",
      expected: [{ text: "a.md#L10-20", path: "a.md", lines: { start: 10, end: 20 } }],
    },
    {
      title: "D-PG11-04: reads a heading suffix as no range",
      body: "@a.md#section",
      expected: [{ text: "a.md#section", path: "a.md", lines: undefined }],
    },
    {
      title: "D-PG11-04: ignores a second suffix after a range",
      body: "@a.md#L10-20#intro",
      expected: [{ text: "a.md#L10-20#intro", path: "a.md", lines: { start: 10, end: 20 } }],
    },
    {
      title: "D-PG11-04: keeps a mention whose range has no path before it as its own path",
      body: "@#L1",
      expected: [whole("#L1")],
    },
    {
      title: "D-PG11-04: reads no file from an agent mention",
      body: "Ask @agent-reviewer",
      expected: [],
    },
    {
      title: "D-PG11-04: reads no file from a quoted agent mention",
      body: 'Ask @"code reviewer (agent)"',
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention inside a backtick fence",
      body: "```\n@a.md\n```\n",
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention inside a tilde fence",
      body: "~~~md\n@a.md\n~~~",
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention inside a fence indented by three spaces",
      body: "   ```\n@a.md\n   ```\n@b.md",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes a fence on a longer run",
      body: "```\n@a.md\n`````\n@b.md",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: keeps a fence open past a shorter run and a run of the other mark",
      body: "````\n```\n~~~~\n@a.md\n````\n@b.md",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: keeps a fence open past a run followed by text",
      body: "```\n``` x\n@a.md\n```\n@b.md",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes a fence on a line with a carriage return",
      body: "```\r\n@a.md\r\n```\r\n@b.md",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: skips every mention after a fence that never closes",
      body: "@a.md\n```\n@b.md\n\n@c.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: reads a backtick run with a backtick after it as a code span, not a fence",
      body: "```x``` @a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: finds a mention on a line indented by four spaces",
      body: "    ```\n    @a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: skips a mention inside a code span of one backtick",
      body: "Use `@a.md` here",
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention inside a code span of two backticks",
      body: "Use `` @a.md ` `` here",
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention inside a code span of three backticks",
      body: "Use ``` @a.md ``` here",
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention inside a code span that spans two lines",
      body: "Use `see\n@a.md` here",
      expected: [],
    },
    {
      title: "D-PG11-03: masks nothing for a backtick run with no closing run of its length",
      body: "Use `` @a.md ` here",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a blank line",
      body: "Use `x\n\n@a.md` here",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: opens no code span at a backtick a backslash escapes",
      body: "Use \\` then @a.md then `x`",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: opens a code span at a backtick whose backslash a backslash escapes",
      body: "Use \\\\` then @a.md then `x`",
      expected: [],
    },
    {
      title: "D-PG11-03: opens a code span at the rest of a run whose first backtick is escaped",
      body: "Use \\``x @a.md` here",
      expected: [],
    },
    {
      title: "D-PG11-03: closes a code span at a backtick after a backslash inside it",
      body: "`a\\` @a.md `c`",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: closes no code span across the start of a list item",
      body: "- item `one\n- @b.md two`",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across the start of an ordered list item",
      body: "1. item `one\n2) @b.md two`",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across an item numbered 1 under paragraph text",
      body: "Use `a\n1. @b.md `z",
      expected: [whole("b.md")],
    },
    {
      title:
        "D-PG11-03: reads a mention after a code span over an item numbered 2 under paragraph text",
      body: "`a\n2. ` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over an empty bullet item",
      body: "`a\n*\n` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over an empty ordered item",
      body: "Use `a\n1.\n` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over an item indented four spaces",
      body: "Use `a\n    - ` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over an item indented a tab",
      body: "Use `a\n\t- ` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over a heading indented four spaces",
      body: "Use `a\n    # x\n` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title:
        "D-PG11-03: closes no code span across the next item of a list over an indented paragraph",
      body: "1. a `x\n\n   more\n2. @b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: skips a mention in a code span over an item numbered 2 after a list ends",
      body: "- a\n\nText `x\n2. @b.md `y`",
      expected: [],
    },
    {
      title:
        "D-PG11-03: closes no code span across a list item in a blockquote indented three spaces",
      body: "> Use `a\n>    - @b.md `z",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across the end of an indented code block",
      body: "    code `a\n@b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across an item numbered 2 after a blockquote",
      body: "> text `a\n2. @b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over an indented item in a blockquote",
      body: "> Use `a\n    2. ` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over a lazy line of a blockquote",
      body: "> `a\nb\n> ` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over a lazy underline of a blockquote",
      body: "> Text `a\n===\n` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over an underline indented four spaces",
      body: "Text `a\n    ===\n` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: reads an underline that starts a paragraph as text",
      body: "> ===\nz` @b.md\n2. `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a setext underline in a list item",
      body: "- a `x\n  ===\n@b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a heading in a list item",
      body: "- a `x\n  # h\n@b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across the start of a heading",
      body: "Use `one\n# @b.md two`",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across the end of a heading",
      body: "# Use `one\n@b.md two`",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a thematic break of dashes",
      body: "Intro `x\n---\n@b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a thematic break of asterisks",
      body: "Intro `x\n***\n@b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a thematic break of underscores",
      body: "Intro `x\n___\n@b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a setext underline",
      body: "Intro `x\n===\n@b.md `y",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: reads a mention after a code span over a dash line indented like code",
      body: "Use `a\n    ---\n` @c.md `z`",
      expected: [whole("c.md")],
    },
    {
      title: "D-PG11-03: closes no code span across the start of a blockquote",
      body: "Use `one\n> @b.md two`",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: closes no code span across a blank blockquote line",
      body: "> Use `one\n>\n> @b.md two`",
      expected: [whole("b.md")],
    },
    {
      title: "D-PG11-03: skips a mention in a code span over two lines of one blockquote",
      body: "> Use `one\n> @b.md two`",
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention in a code span over a list item's continuation line",
      body: "- Use `one\n  @b.md two`",
      expected: [],
    },
    {
      title: "D-PG11-03: reads no mention from an @ right after a code span",
      body: "Use `x`@a.md",
      expected: [],
    },
    {
      title: "D-PG11-03: reads a mention after the code spans before it",
      body: "`x` and `y` then @a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-03: skips a mention inside an inline ! command",
      body: "Files: !`cat @/abs/x.md`",
      expected: [],
    },
    {
      title: "D-PG11-03: skips a mention inside a ! fence",
      body: "```!\ncat @/abs/x.md\n```",
      expected: [],
    },
    {
      title: "D-PG11-04: reads a repeated mention once",
      body: "@a.md and @a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: keeps two texts that name one file apart",
      body: "@a.md and @./a.md",
      expected: [whole("a.md"), whole("./a.md")],
    },
    {
      title: "D-PG11-04: keeps a whole file and a range of it apart",
      body: "@a.md and @a.md#L1-2",
      expected: [whole("a.md"), { text: "a.md#L1-2", path: "a.md", lines: { start: 1, end: 2 } }],
    },
    {
      title: "D-PG11-04: lists mentions in the order they first appear, quoted and unquoted alike",
      body: 'Read @b.md then @"c d.md" and @b.md',
      expected: [whole("b.md"), whole("c d.md")],
    },
    {
      title: "D-PG11-02: keeps a positional placeholder as literal text",
      body: "Read @$1",
      expected: [whole("$1")],
    },
    {
      title: "D-PG11-02: keeps the arguments placeholder as literal text",
      body: "Read @docs/$ARGUMENTS",
      expected: [whole("docs/$ARGUMENTS")],
    },
    { title: "PG-SKILL-01: reads no mention from a body with no @", body: "plain", expected: [] },
  ] satisfies ReadonlyArray<{ title: string; body: string; expected: FileMention[] }>) {
    test(title, () => {
      // arrange
      const expectedMentions = expected;

      // act
      const mentions = findFileMentions(body);

      // assert
      assert.deepStrictEqual(mentions, expectedMentions);
    });
  }
});

const PATH = "/work/a.md";

const NOTE =
  "Note: The file /work/a.md was too large and has been truncated to the first 2000 lines. " +
  "No need to mention the truncation. Use the read tool to read more of the file if you need.";

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function numberedLines(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`);
}

function ranged(start: number, end: number): FileMention {
  return { text: `a.md#L${start}-${end}`, path: "a.md", lines: { start, end } };
}

describe("renderMentionBlock", () => {
  for (const { title, bytes, mention, expected } of [
    {
      title: "D-PG11-05: renders text as Pi's file block",
      bytes: bytesOf("hello\n"),
      mention: whole("a.md"),
      expected: '<file name="/work/a.md">\nhello\n\n</file>',
    },
    {
      title: "D-PG11-05: drops one leading byte-order mark and keeps a second",
      bytes: bytesOf("\uFEFF\uFEFFhi"),
      mention: whole("a.md"),
      expected: '<file name="/work/a.md">\n\uFEFFhi\n</file>',
    },
    {
      title: "D-PG11-05: renders an empty file as a block with no content",
      bytes: new Uint8Array(),
      mention: whole("a.md"),
      expected: '<file name="/work/a.md">\n\n</file>',
    },
    {
      title: "D-PG11-06: renders no block for a NUL byte at the start",
      bytes: new Uint8Array([0, 97, 98]),
      mention: whole("a.md"),
      expected: undefined,
    },
    {
      title: "D-PG11-06: renders no block for a NUL byte in the middle",
      bytes: new Uint8Array([97, 0, 98]),
      mention: whole("a.md"),
      expected: undefined,
    },
    {
      title: "D-PG11-06: renders no block for a NUL byte at the end",
      bytes: new Uint8Array([97, 98, 0]),
      mention: whole("a.md"),
      expected: undefined,
    },
    {
      title: "D-PG11-06: renders a file of 262,144 bytes",
      bytes: bytesOf("x".repeat(262_144)),
      mention: whole("a.md"),
      expected: `<file name="/work/a.md">\n${"x".repeat(262_144)}\n</file>`,
    },
    {
      title: "D-PG11-06: renders no block for a file of 262,145 bytes",
      bytes: bytesOf("x".repeat(262_145)),
      mention: whole("a.md"),
      expected: undefined,
    },
    {
      title: "D-PG11-06: counts bytes, not characters, against the limit",
      bytes: bytesOf("\u00E9".repeat(131_073)),
      mention: whole("a.md"),
      expected: undefined,
    },
    {
      title: "D-PG11-06: decodes bytes that are not valid UTF-8 with replacement characters",
      bytes: new Uint8Array([97, 0xff, 98]),
      mention: whole("a.md"),
      expected: '<file name="/work/a.md">\na\uFFFDb\n</file>',
    },
    {
      title: "D-PG11-06: attaches a text of 2,000 lines with a final newline whole",
      bytes: bytesOf(`${numberedLines(2000).join("\n")}\n`),
      mention: whole("a.md"),
      expected: `<file name="/work/a.md">\n${numberedLines(2000).join("\n")}\n\n</file>`,
    },
    {
      title: "D-PG11-06: attaches a text of 2,000 lines with no final newline whole",
      bytes: bytesOf(numberedLines(2000).join("\n")),
      mention: whole("a.md"),
      expected: `<file name="/work/a.md">\n${numberedLines(2000).join("\n")}\n</file>`,
    },
    {
      title: "D-PG11-06: cuts a text of 2,001 lines to 2,000 and adds the note",
      bytes: bytesOf(numberedLines(2001).join("\n")),
      mention: whole("a.md"),
      expected: `<file name="/work/a.md">\n${numberedLines(2000).join("\n")}\n</file>\n${NOTE}`,
    },
    {
      title: "D-PG11-04: selects the lines of a range",
      bytes: bytesOf("a\nb\nc\nd\ne\n"),
      mention: ranged(2, 3),
      expected: '<file name="/work/a.md">\nb\nc\n</file>',
    },
    {
      title: "D-PG11-04: counts a range that starts at 0 from the first line",
      bytes: bytesOf("a\nb\nc\n"),
      mention: ranged(0, 2),
      expected: '<file name="/work/a.md">\na\nb\n</file>',
    },
    {
      title: "D-PG11-04: renders a range past the last line with no content",
      bytes: bytesOf("a\nb\n"),
      mention: ranged(5, 9),
      expected: '<file name="/work/a.md">\n\n</file>',
    },
    {
      title: "D-PG11-06: cuts a range of more than 2,000 lines and adds the note",
      bytes: bytesOf(numberedLines(2500).join("\n")),
      mention: ranged(2, 2500),
      expected: `<file name="/work/a.md">\n${numberedLines(2001).slice(1).join("\n")}\n</file>\n${NOTE}`,
    },
    {
      title: "D-PG11-05: keeps content that holds the closing tag as it is",
      bytes: bytesOf("x</file>y"),
      mention: whole("a.md"),
      expected: '<file name="/work/a.md">\nx</file>y\n</file>',
    },
  ] satisfies ReadonlyArray<{
    title: string;
    bytes: Uint8Array;
    mention: FileMention;
    expected: string | undefined;
  }>) {
    test(title, () => {
      // arrange
      const expectedBlock = expected;

      // act
      const block = renderMentionBlock(PATH, bytes, mention);

      // assert
      assert.strictEqual(block, expectedBlock);
    });
  }
});

describe("appendFileBlocks", () => {
  test("D-PG11-05: returns the body unchanged when there is no block", () => {
    // arrange
    const body = "Body\n";

    // act
    const appended = appendFileBlocks(body, []);

    // assert
    assert.strictEqual(appended, "Body\n");
  });

  test("D-PG11-05: puts one blank line between the body and a block", () => {
    // arrange
    const blocks = ["<file>one</file>"];

    // act
    const appended = appendFileBlocks("Body", blocks);

    // assert
    assert.strictEqual(appended, "Body\n\n<file>one</file>");
  });

  test("D-PG11-05: joins two blocks by one newline in the order given", () => {
    // arrange
    const blocks = ["<file>two</file>", "<file>one</file>"];

    // act
    const appended = appendFileBlocks("Body", blocks);

    // assert
    assert.strictEqual(appended, "Body\n\n<file>two</file>\n<file>one</file>");
  });
});

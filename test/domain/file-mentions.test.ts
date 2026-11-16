import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { findFileMentions } from "../../extensions/pi-claude-marketplace/domain/file-mentions.ts";

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
      body: "see。@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a mention after an ideographic comma",
      body: "see、@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a mention after a fullwidth question mark",
      body: "see？@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a mention after a fullwidth exclamation mark",
      body: "see！@a.md",
      expected: [whole("a.md")],
    },
    {
      title: "D-PG11-04: reads a quoted mention with its space",
      body: 'Read @"my notes.md" now',
      expected: [whole("my notes.md")],
    },
    {
      title: "D-PG11-04: reads a quoted mention after a mark",
      body: 'see。@"my notes.md"',
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
      body: "@café",
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

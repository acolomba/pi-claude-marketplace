// domain/file-mentions.ts
//
// PG-SKILL-01: the file mentions of a skill or command body, and the text an
// attached file becomes (D-PG11-02 to D-PG11-06). This module reads no file:
// the invocation orchestrator holds the reader and passes the bytes in
// (D-PG11-08).
//
// The mention syntax follows Claude Code 2.1.323 (`z_s`, `R3n`, `DNt`, `sls`).
// These rules differ from Claude Code:
// - D-PG11-02: the caller passes the body before arguments are substituted and
//   before `!` commands run, so a placeholder such as `$1` stays literal text
//   and no argument or command output names a file. Claude Code scans the
//   rendered text.
// - D-PG11-03: a mention inside fenced code or a code span is not a mention.
//   Claude Code reads every whitespace-delimited token.
// - Mentions come in the order they first appear in the body. Claude Code
//   lists quoted mentions before unquoted ones.
// - D-PG11-05: an attached file is Pi's own file block appended to the body.
//   Claude Code sends a Read call and its result as separate messages.
// - D-PG11-06: only a file of text qualifies. Claude Code attaches a directory
//   as a listing.

import { stripBom } from "../shared/bom.ts";

/** PG-SKILL-01: one file mention of a body. */
export interface FileMention {
  /** The mention as written, without `@` and quotes, after the tail cut. */
  readonly text: string;
  /** `text` without its line-range suffix. */
  readonly path: string;
  /** The lines that a `#L<start>` or `#L<start>-<end>` suffix selects, counted from 1. */
  readonly lines: { readonly start: number; readonly end: number } | undefined;
}

// The marks after which an `@` starts a mention: U+3002 ideographic full stop,
// U+3001 ideographic comma, U+FF1F fullwidth question mark, and U+FF01
// fullwidth exclamation mark.
const MENTION_MARKS = "\u3002\u3001\uFF1F\uFF01";

// Claude Code's quoted form: `@"..."` at the start of the text or after
// whitespace or a mark. Group 1 is the character before the `@`; group 2 is
// the value.
const QUOTED_MENTION = /(^|[\s\u3002\u3001\uFF1F\uFF01])@"([^"]+)"/g;

const TOKEN = /\S+/g;

// `DNt`: only these characters end an unquoted path.
const PATH_END = /\w/;

// Claude Code's line range, verbatim from `sls`.
const LINE_RANGE = /^([^#]+)(?:#L(\d+)(?:-(\d+))?)?(?:#[^#]*)?$/;

// D-PG11-06: Claude Code 2.1.323's `maxSizeBytes`, the largest file a mention
// attaches.
export const MENTION_FILE_BYTE_LIMIT = 262_144;

// D-PG11-06: Claude Code's Read limit; a longer text is cut with a note.
const MENTION_LINE_LIMIT = 2000;

// Keeps a leading byte-order mark, so that stripBom drops exactly one, as Pi's
// own file form does.
const UTF8 = new TextDecoder("utf-8", { ignoreBOM: true });

const AGENT_PREFIX = "agent-";

const AGENT_SUFFIX = " (agent)";

// At most three spaces, then a run of three or more backticks or tildes.
const FENCE_RUN = /^ {0,3}(`{3,}|~{3,})/;

// The blockquote markers that open a line, each with the one space after it
// that belongs to the marker.
const QUOTE_MARKERS = /^(?:[^\S\n]*> ?)*/;

// A list item or an ATX heading, after the indentation. Group 1 is an ordered
// item's number, group 2 a heading's marks, and group 3 the rest of the line.
const BLOCK_START = /^(?:[-*+]|(\d{1,9})[.)]|(#{1,6}))(?:\s(.*)|$)/;

// A thematic break: three or more of one of `-`, `*`, or `_`, with spaces or
// tabs between them.
const THEMATIC_BREAK = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

// A setext underline, which ends the paragraph above it.
const SETEXT_UNDERLINE = /^(?:=+|-+)[ \t]*$/;

// CommonMark: a line indented this far or more continues a paragraph.
const CODE_INDENT = 4;

const BACKTICK_RUN = /`+/g;

const NOT_NEWLINE = /[^\n]/g;

/** A line split after its blockquote markers. */
interface QuotedLine {
  readonly depth: number;
  readonly content: string;
}

interface FenceLine {
  readonly run: string;
  readonly rest: string;
}

interface BacktickRun {
  readonly index: number;
  readonly start: number;
  readonly end: number;
}

/** The runs that can close a code span opened at one run. */
interface SpanClosers {
  /** The next run of the opening run's length. */
  readonly whole: BacktickRun | undefined;
  /** The next run one backtick shorter, for a run whose first backtick is escaped. */
  readonly escaped: BacktickRun | undefined;
}

/** The list item that a line starts. */
interface ListItem {
  /** The number of an ordered item; undefined for a bullet item. */
  readonly number: number | undefined;
  /** The item has text after its marker. */
  readonly text: boolean;
}

/** How one line bounds the code spans around it. */
interface LineShape {
  /** The line holds only whitespace after its blockquote markers. */
  readonly blank: boolean;
  readonly quoteDepth: number;
  /** The columns before the content, after the blockquote markers; a tab counts as four. */
  readonly indent: number;
  readonly item: ListItem | undefined;
  /** The line is an ATX heading or a thematic break. */
  readonly heading: boolean;
  /** The line is a setext underline that is not also a thematic break. */
  readonly underline: boolean;
}

/** The first line of a paragraph, and what it means for the lines after it. */
interface ParagraphStart {
  readonly quoteDepth: number;
  readonly inList: boolean;
  /** The paragraph is an indented code block, which a line indented less ends. */
  readonly code: boolean;
}

interface LocatedMention {
  readonly at: number;
  readonly text: string;
}

function unquote(line: string): QuotedLine {
  const content = line.replace(QUOTE_MARKERS, "");
  const quote = line.slice(0, line.length - content.length);
  return { depth: quote.length - quote.replaceAll(">", "").length, content };
}

function fenceLineOf(line: string): FenceLine | undefined {
  const match = FENCE_RUN.exec(line);
  return match === null ? undefined : { run: String(match[1]), rest: line.slice(match[0].length) };
}

// The run of a line that opens a fence. A backtick fence takes no backtick
// after its run, as in CommonMark.
function openingRun(fence: FenceLine | undefined): string | undefined {
  return fence === undefined || (fence.run.startsWith("`") && fence.rest.includes("`"))
    ? undefined
    : fence.run;
}

function closesFence(fence: FenceLine | undefined, open: string): boolean {
  return (
    fence !== undefined &&
    fence.run.startsWith(open.charAt(0)) &&
    fence.run.length >= open.length &&
    fence.rest.trim() === ""
  );
}

// D-PG11-03: blanks every line of a fence, its marker lines included. As in
// CommonMark, a fence can follow blockquote markers, only a line of its own
// blockquote closes it, and a line of a shallower one ends it. A fence that
// never closes runs to the end of the text.
function maskFences(text: string): string {
  const masked: string[] = [];
  let open: string | undefined;
  let openDepth = 0;
  for (const line of text.split("\n")) {
    const { depth, content } = unquote(line);
    const fence = fenceLineOf(content);
    if (depth < openDepth) {
      open = undefined;
    }

    if (open === undefined) {
      open = openingRun(fence);
      openDepth = depth;
      masked.push(open === undefined ? line : " ".repeat(line.length));
      continue;
    }

    if (depth === openDepth && closesFence(fence, open)) {
      open = undefined;
    }

    masked.push(" ".repeat(line.length));
  }

  return masked.join("\n");
}

// Maps each run to the later runs that can close a span it opens.
function closingRuns(runs: readonly BacktickRun[]): Map<number, SpanClosers> {
  const closers = new Map<number, SpanClosers>();
  const nextOfLength = new Map<number, BacktickRun>();
  for (const run of [...runs].reverse()) {
    const length = run.end - run.start;
    closers.set(run.index, {
      whole: nextOfLength.get(length),
      escaped: nextOfLength.get(length - 1),
    });
    nextOfLength.set(length, run);
  }

  return closers;
}

// An odd count of backslashes right before `at` escapes the character there.
function isEscaped(text: string, at: number): boolean {
  let backslashes = 0;
  while (text.charAt(at - backslashes - 1) === "\\") {
    backslashes += 1;
  }

  return backslashes % 2 === 1;
}

// As in CommonMark, an escaped backtick opens no span, and the rest of its run
// can; inside a span a backslash is text, so any run of the length closes it.
function spanCloser(
  paragraph: string,
  run: BacktickRun,
  closers: ReadonlyMap<number, SpanClosers>,
): BacktickRun | undefined {
  const candidates = closers.get(run.index);
  return isEscaped(paragraph, run.start) ? candidates?.escaped : candidates?.whole;
}

// D-PG11-03: blanks the content of each code span of one paragraph. A run of
// N backticks closes at the next run of exactly N; a run with no such run
// masks nothing. The backticks stay, so text right after a span stays in the
// span's token.
function maskParagraphSpans(paragraph: string): string {
  const runs = [...paragraph.matchAll(BACKTICK_RUN)].map((match, index) => ({
    index,
    start: match.index,
    end: match.index + match[0].length,
  }));
  const closers = closingRuns(runs);
  let masked = "";
  let copied = 0;
  let lastClosed = -1;
  for (const run of runs) {
    const closer = run.index > lastClosed ? spanCloser(paragraph, run, closers) : undefined;
    if (closer !== undefined) {
      const content = paragraph.slice(run.end, closer.start);
      masked += paragraph.slice(copied, run.end) + content.replace(NOT_NEWLINE, " ");
      copied = closer.start;
      lastClosed = closer.index;
    }
  }

  return masked + paragraph.slice(copied);
}

function listItem(block: RegExpExecArray | null): ListItem | undefined {
  return block === null || block[2] !== undefined
    ? undefined
    : {
        number: block[1] === undefined ? undefined : Number(block[1]),
        text: (block[3] ?? "").trim() !== "",
      };
}

function lineShape(line: string): LineShape {
  const { depth, content } = unquote(line);
  const rest = content.trimStart();
  const block = BLOCK_START.exec(rest);
  const thematic = THEMATIC_BREAK.test(rest);
  return {
    blank: rest === "",
    quoteDepth: depth,
    indent: content.slice(0, content.length - rest.length).replaceAll("\t", "    ").length,
    item: thematic ? undefined : listItem(block),
    heading: block?.[2] !== undefined || thematic,
    underline: !thematic && SETEXT_UNDERLINE.test(rest),
  };
}

// The text starts as a blank line does, outside any blockquote or list.
const TEXT_START: ParagraphStart = { quoteDepth: 0, inList: false, code: false };

// A paragraph is in a list when it starts at an item, or when it is indented
// and the paragraph before it was in a list. A blank line keeps the state.
function paragraphStart(line: LineShape, before: ParagraphStart): ParagraphStart {
  const inList = line.blank
    ? before.inList
    : line.item !== undefined || (before.inList && line.indent > 0);
  return { quoteDepth: line.quoteDepth, inList, code: !inList && line.indent >= CODE_INDENT };
}

// CommonMark: an item interrupts a paragraph only when it has text and, if
// ordered, the number 1.
function interruptsParagraph(item: ListItem | undefined): boolean {
  return item?.text === true && (item.number === undefined || item.number === 1);
}

// Inside a list, every item and heading starts a block, at any indentation.
// Elsewhere, as in CommonMark, only a heading or an item does, and only when it
// is indented less than code. An item on a line of the paragraph's own
// blockquote must interrupt the paragraph.
function startsBlock(line: LineShape, paragraph: ParagraphStart): boolean {
  if (paragraph.inList) {
    return line.heading || line.item !== undefined;
  }

  const item =
    line.quoteDepth < paragraph.quoteDepth
      ? line.item !== undefined
      : interruptsParagraph(line.item);
  return line.indent < CODE_INDENT && (line.heading || item);
}

// A blank line, a deeper blockquote, the end of an indented code block, and a
// block start each start a paragraph.
function startsParagraph(line: LineShape, paragraph: ParagraphStart): boolean {
  return (
    line.blank ||
    line.quoteDepth > paragraph.quoteDepth ||
    (paragraph.code && line.indent < CODE_INDENT) ||
    startsBlock(line, paragraph)
  );
}

// A setext underline ends the paragraph whose text it follows in the same
// blockquote. A line that starts a paragraph and is one is text.
function underlines(line: LineShape, paragraph: ParagraphStart): boolean {
  return (
    line.underline &&
    line.quoteDepth === paragraph.quoteDepth &&
    (paragraph.inList || line.indent < CODE_INDENT)
  );
}

// D-PG11-03: the text split into the runs of lines one paragraph can hold, so
// that no code span crosses a block boundary. A heading or a thematic break
// that starts a paragraph ends it, as a setext underline does after the text.
// This follows CommonMark for text, blockquotes, and one level of list, but
// not its whole container model. A masked fence is blank lines.
function paragraphs(text: string): string[] {
  const groups: string[][] = [];
  let current: string[] = [];
  let paragraph = TEXT_START;
  let afterBlank = true;
  let closed = false;
  for (const line of text.split("\n")) {
    const shape = lineShape(line);
    const starts: boolean = afterBlank || closed || startsParagraph(shape, paragraph);
    if (starts) {
      groups.push(current);
      current = [];
      paragraph = paragraphStart(shape, paragraph);
    }

    closed = starts ? shape.heading : underlines(shape, paragraph);
    current.push(line);
    afterBlank = shape.blank;
  }

  groups.push(current);
  return groups.slice(1).map((group) => group.join("\n"));
}

// The masked text has the length and the lines of the body; it is only scanned,
// never sent to the model.
function maskCode(body: string): string {
  return paragraphs(maskFences(body)).map(maskParagraphSpans).join("\n");
}

function quotedMentions(text: string): LocatedMention[] {
  return [...text.matchAll(QUOTED_MENTION)]
    .map((match) => ({ at: match.index + String(match[1]).length, text: String(match[2]) }))
    .filter((mention) => !mention.text.endsWith(AGENT_SUFFIX));
}

// `R3n`: the `@` starts the token or follows one of the marks.
function mentionStart(token: string): number {
  let at = token.indexOf("@");
  while (at > 0 && !MENTION_MARKS.includes(token.charAt(at - 1))) {
    at = token.indexOf("@", at + 1);
  }

  return at;
}

// `DNt`: cuts the characters after the last ASCII letter, digit, or `_`.
function cutTail(token: string, start: number): string {
  let end = token.length;
  while (end > start && !PATH_END.test(token.charAt(end - 1))) {
    end -= 1;
  }

  return token.slice(start, end);
}

// A text that starts with a double quote belongs to the quoted form.
function unquotedMentions(text: string): LocatedMention[] {
  const found: LocatedMention[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const at = mentionStart(match[0]);
    const mention = at === -1 ? "" : cutTail(match[0], at + 1);
    if (mention !== "" && !mention.startsWith('"')) {
      found.push({ at: match.index + at, text: mention });
    }
  }

  return found;
}

function toFileMention(text: string): FileMention {
  const range = LINE_RANGE.exec(text);
  if (range === null) {
    return { text, path: text, lines: undefined };
  }

  const start = range[2];
  return {
    text,
    path: String(range[1]),
    lines:
      start === undefined
        ? undefined
        : { start: Number.parseInt(start, 10), end: Number.parseInt(range[3] ?? start, 10) },
  };
}

/**
 * PG-SKILL-01: the file mentions of `body`, with fenced code and code spans
 * masked, each mention text once, in the order of first appearance. An
 * `@agent-` mention and a quoted value that ends ` (agent)` name agents, not
 * files (D-PG11-04).
 */
export function findFileMentions(body: string): readonly FileMention[] {
  const masked = maskCode(body);
  const byText = new Map<string, FileMention>();
  const located = [...quotedMentions(masked), ...unquotedMentions(masked)].sort(
    (left, right) => left.at - right.at,
  );
  for (const { text } of located) {
    if (!text.startsWith(AGENT_PREFIX) && !byText.has(text)) {
      byText.set(text, toFileMention(text));
    }
  }

  return [...byText.values()];
}

// The lines of a text; a final newline ends the last line and starts no new one.
function linesOf(content: string): string[] {
  const lines = content.split("\n");
  if (content.endsWith("\n")) {
    lines.pop();
  }

  return lines;
}

function fileBlock(absolutePath: string, content: string): string {
  return `<file name="${absolutePath}">\n${content}\n</file>`;
}

// D-PG11-06: Claude Code 2.1.323's truncation note, with Pi's read tool.
function truncationNote(absolutePath: string): string {
  return (
    `Note: The file ${absolutePath} was too large and has been truncated to the first ` +
    `${MENTION_LINE_LIMIT} lines. No need to mention the truncation. Use the read tool to ` +
    "read more of the file if you need."
  );
}

/**
 * D-PG11-05, D-PG11-06: the file block for the bytes of a mentioned file, or
 * `undefined` for bytes over `MENTION_FILE_BYTE_LIMIT` or with a NUL byte. A
 * line range selects its lines first (D-PG11-04); a text of more than 2,000
 * lines is cut to its first 2,000, with a note after the block.
 */
export function renderMentionBlock(
  absolutePath: string,
  bytes: Uint8Array,
  mention: FileMention,
): string | undefined {
  if (bytes.length > MENTION_FILE_BYTE_LIMIT || bytes.includes(0)) {
    return undefined;
  }

  const content = stripBom(UTF8.decode(bytes));
  const range = mention.lines;
  const lines =
    range === undefined
      ? linesOf(content)
      : linesOf(content).slice(Math.max(range.start, 1) - 1, range.end);
  if (lines.length > MENTION_LINE_LIMIT) {
    const cut = lines.slice(0, MENTION_LINE_LIMIT).join("\n");
    return `${fileBlock(absolutePath, cut)}\n${truncationNote(absolutePath)}`;
  }

  return fileBlock(absolutePath, range === undefined ? content : lines.join("\n"));
}

/**
 * D-PG11-05: the rendered body with the file blocks after one blank line, or
 * the body itself when there is no block.
 */
export function appendFileBlocks(rendered: string, blocks: readonly string[]): string {
  return blocks.length === 0 ? rendered : `${rendered}\n\n${blocks.join("\n")}`;
}

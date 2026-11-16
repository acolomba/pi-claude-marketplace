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
//
// D-PG11-03 finds code as CommonMark 0.31 does. One pass reads each line's
// containers: its blockquotes and list items, with an item's content column,
// a tab counted to the next multiple of four, and lazy continuation lines.
// The fence mask and the code span mask both read the roles that pass gives.
// An indented code block is not masked, so a mention in it is a mention. Two
// rules differ from CommonMark: an HTML block is read as a paragraph, so a code
// span in it is masked, and a line opens at most 100 containers, so a deeper
// marker is text.

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

// CommonMark's tab stop; block structure reads a tab as spaces to the next stop.
const TAB_STOP = 4;

// CommonMark: a line indented this far or more past its containers is
// indented code, or the continuation of an open paragraph.
const CODE_INDENT = 4;

// The run of a fence opener or closer, after its indentation.
const FENCE_RUN = /^(?:`{3,}|~{3,})/;

// A list item marker, followed by a space or the end of the line. Group 1 is
// an ordered item's number.
const ITEM_MARKER = /^(?:[-*+]|(\d{1,9})[.)])(?= |$)/;

const ATX_HEADING = /^#{1,6}(?: |$)/;

// A thematic break: three or more of one of `-`, `*`, or `_`, with spaces
// between them.
const THEMATIC_BREAK = /^([-*_])(?: *\1){2,} *$/;

// A setext underline, which ends the paragraph above it.
const SETEXT_UNDERLINE = /^(?:=+|-+) *$/;

const BLANK_REST = /^ *$/;

// The most containers a line can be in. A blank line continues every list item
// without reading a character, so this bound keeps the scan linear; a deeper
// marker is text.
const MAX_CONTAINERS = 100;

const BACKTICK_RUN = /`+/g;

const NOT_NEWLINE = /[^\n]/g;

// The role of a line that is not paragraph text: fenced code, which is
// masked, or a line with no code span, which is kept. Paragraph text takes the
// number of its paragraph, from 1.
const FENCED_LINE = -1;
const PLAIN_LINE = 0;

/** An open blockquote or list item. */
interface Container {
  /** A list item's content column, from the start of its own container; absent for a blockquote. */
  readonly width?: number;
  /** The container holds a block. A list item that holds none ends at a blank line. */
  holdsBlock: boolean;
}

/** The open blocks before a line, as CommonMark's block parser keeps them. */
interface BlockState {
  readonly containers: Container[];
  /** The run of the open fence. */
  fence: string | undefined;
  /** A paragraph is open in the innermost open container. */
  paragraph: boolean;
  /** The number of the latest paragraph. */
  paragraphs: number;
}

/** A position in a line, and the number of containers before it. */
interface Cursor {
  readonly at: number;
  readonly depth: number;
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

interface LocatedMention {
  readonly at: number;
  readonly text: string;
}

// The line that block structure reads: its tabs expanded from column 0 and a
// final carriage return dropped. Only roles come from it, so the masked text
// keeps the body's own characters.
function blockLine(line: string): string {
  const text = line.endsWith("\r") ? line.slice(0, -1) : line;
  let expanded = "";
  for (const char of text) {
    expanded += char === "\t" ? " ".repeat(TAB_STOP - (expanded.length % TAB_STOP)) : char;
  }

  return expanded;
}

function spacesAt(line: string, at: number): number {
  let end = at;
  while (line.charAt(end) === " ") {
    end += 1;
  }

  return end - at;
}

// A blockquote marker takes the one space after it.
function afterQuoteMarker(line: string, at: number): number {
  return line.charAt(at) === " " ? at + 1 : at;
}

// Where `line` continues `container` from `at`, or undefined when it does not.
// A blockquote needs its marker at most three columns in; a list item needs a
// blank line or its content column.
function continuation(container: Container, line: string, at: number): number | undefined {
  const indent = spacesAt(line, at);
  if (container.width === undefined) {
    return indent < CODE_INDENT && line.charAt(at + indent) === ">"
      ? afterQuoteMarker(line, at + indent + 1)
      : undefined;
  }

  if (at + indent === line.length) {
    return container.holdsBlock ? at : undefined;
  }

  return indent >= container.width ? at + container.width : undefined;
}

function matchContainers(line: string, containers: readonly Container[]): Cursor {
  let at = 0;
  let depth = 0;
  for (const container of containers) {
    const next = continuation(container, line, at);
    if (next === undefined) {
      break;
    }

    at = next;
    depth += 1;
  }

  return { at, depth };
}

// The list item that `rest` starts, `indent` columns into its container. An
// item that interrupts a paragraph has text and, if ordered, the number 1.
function itemStart(
  rest: string,
  indent: number,
  interrupts: boolean,
): { readonly container: Container; readonly length: number } | undefined {
  const marker = ITEM_MARKER.exec(rest);
  if (marker === null || THEMATIC_BREAK.test(rest)) {
    return undefined;
  }

  const spaces = spacesAt(rest, marker[0].length);
  const empty = marker[0].length + spaces === rest.length;
  const first = marker[1] === undefined || Number(marker[1]) === 1;
  if (interrupts && (empty || !first)) {
    return undefined;
  }

  // Five spaces or more after the marker start indented code in the item.
  const padding = empty || spaces > CODE_INDENT ? 1 : spaces;
  return {
    container: { width: indent + marker[0].length + padding, holdsBlock: false },
    length: marker[0].length + (empty ? spaces : padding),
  };
}

// The blockquote or list item that starts at `at`, and where its content
// starts.
function containerStart(
  line: string,
  at: number,
  interrupts: boolean,
): { readonly container: Container; readonly at: number } | undefined {
  const indent = spacesAt(line, at);
  const marker = at + indent;
  if (indent >= CODE_INDENT) {
    return undefined;
  }

  if (line.charAt(marker) === ">") {
    return { container: { holdsBlock: false }, at: afterQuoteMarker(line, marker + 1) };
  }

  const item = itemStart(line.slice(marker), indent, interrupts);
  return item === undefined ? undefined : { container: item.container, at: marker + item.length };
}

// Closes the containers past `depth`, and the block open in them.
function closeUnmatched(state: BlockState, depth: number): void {
  if (depth < state.containers.length) {
    state.containers.splice(depth);
    state.fence = undefined;
    state.paragraph = false;
  }
}

// Opens the containers that start the line after its matched ones. A new
// container closes the unmatched ones and the block open in them.
function openContainers(state: BlockState, line: string, matched: Cursor): Cursor {
  let { at, depth } = matched;
  for (;;) {
    const interrupts = state.paragraph && depth === state.containers.length;
    const opened = depth < MAX_CONTAINERS ? containerStart(line, at, interrupts) : undefined;
    if (opened === undefined) {
      return { at, depth };
    }

    closeUnmatched(state, depth);
    const parent = state.containers.at(-1);
    if (parent !== undefined) {
      parent.holdsBlock = true;
    }

    state.containers.push(opened.container);
    state.fence = undefined;
    state.paragraph = false;
    at = opened.at;
    depth += 1;
  }
}

// A backtick fence takes no backtick after its run.
function openingFence(text: string): string | undefined {
  const run = FENCE_RUN.exec(text)?.[0];
  return run?.startsWith("`") === true && text.includes("`", run.length) ? undefined : run;
}

// A line inside an open fence, whose containers all continue. A run of the
// fence's mark, at least as long, with nothing after it closes the fence.
function fencedLine(state: BlockState, rest: string, open: string): number {
  const indent = spacesAt(rest, 0);
  const text = rest.slice(indent);
  const run = FENCE_RUN.exec(text)?.[0] ?? "";
  if (
    indent < CODE_INDENT &&
    run.startsWith(open.charAt(0)) &&
    run.length >= open.length &&
    BLANK_REST.test(text.slice(run.length))
  ) {
    state.fence = undefined;
  }

  return FENCED_LINE;
}

function startParagraph(state: BlockState): number {
  state.paragraph = true;
  state.paragraphs += 1;
  return state.paragraphs;
}

// A line that leaves an open container can still continue the paragraph open
// in it, as CommonMark's lazy continuation line, unless it starts a block.
function continuesLazily(text: string, indent: number): boolean {
  return (
    text !== "" &&
    (indent >= CODE_INDENT ||
      (openingFence(text) === undefined && !ATX_HEADING.test(text) && !THEMATIC_BREAK.test(text)))
  );
}

// The role of the line's leaf block, in its innermost container.
function leafRole(state: BlockState, text: string, indent: number): number {
  if (text === "") {
    state.paragraph = false;
    return PLAIN_LINE;
  }

  const container = state.containers.at(-1);
  if (container !== undefined) {
    container.holdsBlock = true;
  }

  if (indent >= CODE_INDENT) {
    return state.paragraph ? state.paragraphs : PLAIN_LINE;
  }

  state.fence = openingFence(text);
  if (state.fence !== undefined || (state.paragraph && SETEXT_UNDERLINE.test(text))) {
    state.paragraph = false;
    return state.fence === undefined ? PLAIN_LINE : FENCED_LINE;
  }

  if (THEMATIC_BREAK.test(text)) {
    state.paragraph = false;
    return PLAIN_LINE;
  }

  const heading = ATX_HEADING.test(text);
  const role = state.paragraph && !heading ? state.paragraphs : startParagraph(state);
  state.paragraph = !heading;
  return role;
}

// D-PG11-03: the role of one line, from one model of its containers that both
// the fence and the code span masks read: the line's blockquotes and list
// items, matched as CommonMark matches them.
function lineRole(state: BlockState, rawLine: string): number {
  const line = blockLine(rawLine);
  const matched = matchContainers(line, state.containers);
  if (state.fence !== undefined && matched.depth === state.containers.length) {
    return fencedLine(state, line.slice(matched.at), state.fence);
  }

  const cursor = openContainers(state, line, matched);
  const indent = spacesAt(line, cursor.at);
  const text = line.slice(cursor.at + indent);
  if (state.paragraph && cursor.depth < state.containers.length && continuesLazily(text, indent)) {
    return state.paragraphs;
  }

  closeUnmatched(state, cursor.depth);
  return leafRole(state, text, indent);
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

function maskRun(lines: readonly string[], role: number): string {
  const text = lines.join("\n");
  if (role === FENCED_LINE) {
    return text.replace(NOT_NEWLINE, " ");
  }

  return role === PLAIN_LINE ? text : maskParagraphSpans(text);
}

// D-PG11-03: blanks fenced code, its marker lines included, and the content of
// each code span of a paragraph or heading. The masked text has the length and
// the lines of the body; it is only scanned, never sent to the model.
function maskCode(body: string): string {
  const state: BlockState = { containers: [], fence: undefined, paragraph: false, paragraphs: 0 };
  const runs: Array<{ readonly role: number; readonly lines: string[] }> = [];
  for (const line of body.split("\n")) {
    const role = lineRole(state, line);
    const last = runs.at(-1);
    if (last?.role === role) {
      last.lines.push(line);
    } else {
      runs.push({ role, lines: [line] });
    }
  }

  return runs.map((run) => maskRun(run.lines, run.role)).join("\n");
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

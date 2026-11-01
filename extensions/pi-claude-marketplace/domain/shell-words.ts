// domain/shell-words.ts
//
// Port of Claude Code 2.1.316's argument tokenizer `c$o` and its shell-parser
// step `Ck` (D-CF1-01). Upstream parses the typed arguments with
// tree-sitter-bash, takes the first command node (`Twe`), and turns its words
// into tokens (`Vst`). This module scans the same grammar by hand.
//
// Residual policy (D-CF1-01): well-formed quoting and backslash escapes must
// match upstream exactly. Other tree-sitter-bash behavior (compound
// statements, error recovery after an unclosed quote, and some `$` lexing) is
// best effort; the residual table of the paired test module lists examples of
// the known differences.

// `Ck` returns no words above this length, so `c$o` takes the whitespace split.
const MAX_PARSED_LENGTH = 10_000;

const BLANKS = new Set([" ", "\t", "\r"]);
// A backslash before one of these reads as a blank anywhere (a line
// continuation, an escaped tab, or a trailing backslash).
const ESCAPED_BREAKS = new Set(["\n", "\t", ""]);
const WORD_ENDS = new Set(["", "\n", ";", "&", "|", "<", ">", "(", ")"]);
const COMMAND_ENDS = new Set(["", "\n", ";", "&", "|", "(", ")", "#"]);
const STATEMENT_SEPARATORS = new Set(["\n", ";", "&", "|", ")"]);
const UNQUOTED_STOPS = new Set([...WORD_ENDS, ...BLANKS, "'", '"', "`", "$"]);
const GLUING_ESCAPES = new Set(["\\", '"', "'"]);
const BARE_DOLLAR_ENDS = new Set([...BLANKS, "\n", '"', ""]);
// A keyword glued to one of these still reads as the keyword.
const GLUED_STARTS = new Set(["'", '"', "$"]);

// Words that open a compound statement whose first command `Twe` still finds.
const PREFIX_KEYWORDS = new Set(["{", "!", "if", "while", "until"]);
// Openers whose content holds no command; scanning resumes after the closer.
const SKIPPED_STATEMENTS = new Map([
  ["[", "]"],
  ["[[", "]]"],
  ["for", "do"],
  ["select", "do"],
]);
const GLUED_KEYWORDS = new Set([...PREFIX_KEYWORDS, "for", "select"]);
// `Vst` gives a declaration command as its keyword alone.
const DECLARATION_KEYWORDS = new Set(["declare", "typeset", "export", "readonly", "local"]);
// tree-sitter-bash reads these as `unset_command`, which is not a command node.
const UNSET_KEYWORDS = new Set(["unset", "unsetenv"]);

// tree-sitter-bash accepts any run of word characters as a variable name, and
// reads a leading `--` with it as part of the name.
const ASSIGNMENT = /^(?:--)?\w+(?:\[[^\]]*\])?\+?=/;
const PARAMETER = /\w+|[@*#?$!-]/y;
const BARE_WORD = /[^\s;&|<>()'"`$\\]+/y;
const REDIRECT = /\d*(?:<<<|<<-|<<|<>|<&|>>|>&|>\||&>>|&>|<|>)/y;

interface Cursor {
  readonly text: string;
  pos: number;
  // Set when a quote or bracket never closes. tree-sitter-bash then keeps the
  // words before it and drops the rest.
  broken: boolean;
  // Open subshells; a `)` outside one is skipped, as tree-sitter-bash recovers.
  subshells: number;
}

// tree-sitter-bash node kinds, merged where `Vst` treats them alike: `word`
// (unquoted text), `string` ("..."), `raw` ('...'), `translated` ($"..."),
// `expansion` ($X, ${X}, $'...', $((...))), `substitution` ($(...), `...`, <(...)),
// and `verbatim` (the text after a double quote that never closes).
type PieceKind =
  "word" | "string" | "raw" | "translated" | "expansion" | "substitution" | "verbatim";

interface Piece {
  readonly kind: PieceKind;
  readonly text: string;
}

interface Word {
  readonly pieces: readonly Piece[];
  readonly raw: string;
  // The text of a word made of one unquoted piece, for keyword checks.
  readonly bare: string | undefined;
}

interface Command {
  readonly words: string[];
  named: boolean;
  ignored: boolean;
  done: boolean;
}

function charAt(cursor: Cursor, offset = 0): string {
  return cursor.text.charAt(cursor.pos + offset);
}

function isEscapedBreak(cursor: Cursor): boolean {
  return charAt(cursor) === "\\" && ESCAPED_BREAKS.has(charAt(cursor, 1));
}

// Where a word or a piece begins, an escaped space also reads as a blank;
// inside an unquoted run it is an escaped character.
function isBlankAtBoundary(cursor: Cursor): boolean {
  return isEscapedBreak(cursor) || (charAt(cursor) === "\\" && charAt(cursor, 1) === " ");
}

function skipBlanks(cursor: Cursor): void {
  for (;;) {
    if (BLANKS.has(charAt(cursor))) {
      cursor.pos += 1;
    } else if (isBlankAtBoundary(cursor)) {
      cursor.pos = Math.min(cursor.pos + 2, cursor.text.length);
    } else {
      return;
    }
  }
}

function skipSeparators(cursor: Cursor): void {
  skipBlanks(cursor);
  while (STATEMENT_SEPARATORS.has(charAt(cursor))) {
    cursor.pos += 1;
    skipBlanks(cursor);
  }
}

function atWordEnd(cursor: Cursor): boolean {
  return WORD_ENDS.has(charAt(cursor)) || BLANKS.has(charAt(cursor)) || isBlankAtBoundary(cursor);
}

// The index after the quote that closes the one at `from`, honoring backslash
// escapes, or -1 when it never closes.
function escapedQuoteEnd(text: string, from: number, quote: string): number {
  let pos = from + 1;
  while (pos < text.length) {
    const char = text.charAt(pos);
    if (char === quote) {
      return pos + 1;
    }

    pos += char === "\\" ? 2 : 1;
  }

  return -1;
}

function singleQuotedEnd(text: string, from: number): number {
  const close = text.indexOf("'", from + 1);
  return close === -1 ? -1 : close + 1;
}

// An open double quote, `(`, or `{` whose closer the scan still needs.
type Enclosure = '"' | "(" | "{";

const CLOSERS = { "(": ")", "{": "}" } as const;

function stepInDoubleQuotes(text: string, pos: number, open: Enclosure[]): number {
  const char = text.charAt(pos);
  if (char === "\\") {
    return pos + 2;
  }

  if (char === '"') {
    open.pop();
  } else if (char === "$" && text.charAt(pos + 1) === "(") {
    open.push("(");
    return pos + 2;
  }

  return pos + 1;
}

function stepInBrackets(text: string, pos: number, open: Enclosure[], bracket: "(" | "{"): number {
  const char = text.charAt(pos);
  if (char === "\\") {
    return pos + 2;
  }

  if (char === "'") {
    const close = text.indexOf("'", pos + 1);
    return close === -1 ? text.length : close + 1;
  }

  if (char === '"' || char === bracket) {
    open.push(char);
  } else if (char === CLOSERS[bracket]) {
    open.pop();
  }

  return pos + 1;
}

// The index after the closer of `opener`, which opens just before `from`,
// or -1 when it never closes. Quotes and `$(...)` inside nest; the scan keeps
// its own stack, so deep nesting cannot overflow the call stack.
function enclosureEnd(text: string, from: number, opener: Enclosure): number {
  const open: Enclosure[] = [opener];
  let pos = from;
  for (let top = open.at(-1); top !== undefined && pos < text.length; top = open.at(-1)) {
    pos = top === '"' ? stepInDoubleQuotes(text, pos, open) : stepInBrackets(text, pos, open, top);
  }

  return open.length === 0 ? pos : -1;
}

function doubleQuotedEnd(text: string, from: number): number {
  return enclosureEnd(text, from + 1, '"');
}

function takePiece(cursor: Cursor, end: number, kind: PieceKind): Piece {
  const stop = end === -1 ? cursor.text.length : end;
  cursor.broken ||= end === -1;
  const piece = { kind, text: cursor.text.slice(cursor.pos, stop) };
  cursor.pos = stop;
  return piece;
}

function readDollar(cursor: Cursor): Piece {
  const { text, pos } = cursor;
  const next = text.charAt(pos + 1);
  if (next === "'") {
    return takePiece(cursor, escapedQuoteEnd(text, pos + 1, "'"), "expansion");
  }

  if (next === '"') {
    return takePiece(cursor, doubleQuotedEnd(text, pos + 1), "translated");
  }

  if (next === "(") {
    const kind = text.startsWith("$((", pos) ? "expansion" : "substitution";
    return takePiece(cursor, enclosureEnd(text, pos + 2, "("), kind);
  }

  if (next === "{") {
    return takePiece(cursor, enclosureEnd(text, pos + 2, "{"), "expansion");
  }

  PARAMETER.lastIndex = pos + 1;
  const name = PARAMETER.exec(text)?.[0] ?? "";
  return takePiece(cursor, pos + 1 + name.length, "expansion");
}

function readUnquoted(cursor: Cursor): Piece {
  const start = cursor.pos;
  while (!UNQUOTED_STOPS.has(charAt(cursor)) && !isEscapedBreak(cursor)) {
    cursor.pos += charAt(cursor) === "\\" ? 2 : 1;
  }

  return { kind: "word", text: cursor.text.slice(start, cursor.pos) };
}

function readPiece(cursor: Cursor): Piece {
  const { text, pos } = cursor;
  switch (text.charAt(pos)) {
    case "'":
      return takePiece(cursor, singleQuotedEnd(text, pos), "raw");
    case '"':
      return takePiece(cursor, doubleQuotedEnd(text, pos), "string");
    case "`":
      return takePiece(cursor, escapedQuoteEnd(text, pos, "`"), "substitution");
    case "$":
      return readDollar(cursor);
    default:
      return readUnquoted(cursor);
  }
}

// tree-sitter-bash keeps an unclosed double-quoted string as raw text, minus
// one final newline, unless the text holds a command substitution or ends in a
// dangling backslash. A lone quote is dropped too when it is the second piece.
function verbatimRest(text: string, second: boolean): Piece | undefined {
  const kept = text.replace(/\n$/, "");
  const lone = second && /^\$?"$/.test(kept);
  const dropped = lone || /\$\(|`/.test(kept) || /(?<!\\)(?:\\\\)*\\$/.test(kept);
  return dropped ? undefined : { kind: "verbatim", text: kept };
}

// What tree-sitter-bash keeps of a piece that never closes, given the count of
// pieces before it: a double-quoted string after another piece, or a `$"`
// string (without its `$` when it starts the word), stays as raw text; any
// other piece is dropped.
function unterminatedRest(before: number, piece: Piece): Piece | undefined {
  if (piece.kind === "translated") {
    return verbatimRest(before === 0 ? piece.text.slice(1) : piece.text, before <= 1);
  }

  return piece.kind === "string" && before > 0 ? verbatimRest(piece.text, before === 1) : undefined;
}

function addPiece(cursor: Cursor, pieces: Piece[], piece: Piece): void {
  const kept = cursor.broken ? unterminatedRest(pieces.length, piece) : piece;
  if (kept !== undefined) {
    pieces.push(kept);
  }
}

// After a quoted piece or an expansion, tree-sitter-bash starts a new word at
// a backslash, unless the backslash escapes a backslash or a quote.
function escapeStartsWord(cursor: Cursor, previous: PieceKind): boolean {
  return previous !== "word" && charAt(cursor) === "\\" && !GLUING_ESCAPES.has(charAt(cursor, 1));
}

function readWord(cursor: Cursor): Word {
  const pieces: Piece[] = [];
  let previous: PieceKind = "word";
  if (/^[<>]\(/.test(cursor.text.slice(cursor.pos, cursor.pos + 2))) {
    const end = enclosureEnd(cursor.text, cursor.pos + 2, "(");
    previous = "substitution";
    addPiece(cursor, pieces, takePiece(cursor, end, previous));
  }

  while (!atWordEnd(cursor) && !cursor.broken && !escapeStartsWord(cursor, previous)) {
    const piece = readPiece(cursor);
    previous = piece.kind;
    addPiece(cursor, pieces, piece);
  }

  const raw = pieces.map((piece) => piece.text).join("");
  const bare =
    pieces.length === 1 && pieces.every((piece) => piece.kind === "word") ? raw : undefined;
  return { pieces, raw, bare };
}

// In a command's words, where the next word after a quoted piece or an
// expansion would start with `\$` before a blank, a double quote, a newline, or
// the end of the text, tree-sitter-bash reads the `\$` as a bare `$` token,
// which `Vst` drops; a quoted piece after it is a word of its own. A lone `$`
// before it reads as word text, so the `\$` stays a word there.
function skipBareDollar(cursor: Cursor, word: Word): void {
  const last = word.pieces.at(-1);
  if (
    last !== undefined &&
    last.kind !== "word" &&
    last.text !== "$" &&
    cursor.text.startsWith("\\$", cursor.pos) &&
    BARE_DOLLAR_ENDS.has(charAt(cursor, 2))
  ) {
    cursor.pos += 2;
  }
}

// `pe`: an unquoted word drops each escaping backslash, a quoted string drops
// its quotes, and an expansion or substitution stays verbatim.
function pieceValue(piece: Piece): string {
  switch (piece.kind) {
    case "word":
      return piece.text.replaceAll(/\\(.)/g, "$1");
    case "string":
    case "raw":
      return piece.text.slice(1, -1);
    case "translated":
      return piece.text.slice(2, -1);
    case "expansion":
    case "substitution":
    case "verbatim":
      return piece.text;
  }
}

function joinValues(word: Word): string {
  return word.pieces.map(pieceValue).join("");
}

function hasSubstitution(word: Word): boolean {
  return word.pieces.some((piece) => piece.kind === "substitution");
}

function commandNameValue(word: Word): string {
  const verbatim = hasSubstitution(word) || (word.pieces.length === 1 && word.raw.startsWith('$"'));
  return verbatim ? word.raw : joinValues(word);
}

function addCommandName(command: Command, word: Word): void {
  command.named = true;
  if (word.bare !== undefined && DECLARATION_KEYWORDS.has(word.bare)) {
    command.words.push(word.bare);
    command.done = true;
    return;
  }

  command.ignored = word.bare !== undefined && UNSET_KEYWORDS.has(word.bare);
  command.words.push(commandNameValue(word));
}

function addArgument(command: Command, word: Word): void {
  if (hasSubstitution(word)) {
    command.done = true;
    return;
  }

  const lone = word.pieces.length === 1;
  if (!(lone && word.pieces.every((piece) => piece.kind === "expansion"))) {
    command.words.push(joinValues(word));
  }
}

function skipArrayValue(cursor: Cursor, word: Word): void {
  if (word.raw.endsWith("=") && charAt(cursor) === "(") {
    takePiece(cursor, enclosureEnd(cursor.text, cursor.pos + 1, "("), "expansion");
  }
}

function addWord(cursor: Cursor, command: Command, word: Word): void {
  if (command.named) {
    addArgument(command, word);
  } else if (ASSIGNMENT.test(word.raw)) {
    skipArrayValue(cursor, word);
  } else {
    addCommandName(command, word);
  }
}

// A redirection before the command name takes one word; after it, only a
// here-string does, and any other ends the words (tree-sitter-bash gives
// such a redirection every word that follows).
function readRedirect(cursor: Cursor, command: Command): boolean {
  REDIRECT.lastIndex = cursor.pos;
  const match = REDIRECT.exec(cursor.text);
  if (match === null || (/^[<>]$/.test(match[0]) && charAt(cursor, match[0].length) === "(")) {
    return false;
  }

  if (command.named && !match[0].endsWith("<<<")) {
    command.done = true;
    return true;
  }

  cursor.pos += match[0].length;
  skipBlanks(cursor);
  const target = readWord(cursor);
  if (command.named) {
    skipBareDollar(cursor, target);
  }

  return true;
}

function readCommandItem(cursor: Cursor, command: Command): void {
  skipBlanks(cursor);
  if (readRedirect(cursor, command)) {
    return;
  }

  if (charAt(cursor) === ")" && cursor.subshells === 0) {
    cursor.pos += 1;
    return;
  }

  if (COMMAND_ENDS.has(charAt(cursor))) {
    command.done = true;
    return;
  }

  const word = readWord(cursor);
  // Before the command name, a `\$` after an assignment word stays a word:
  // tree-sitter-bash reads it as the command name `$`.
  if (command.named || !ASSIGNMENT.test(word.raw)) {
    skipBareDollar(cursor, word);
  }

  if (word.pieces.length > 0) {
    addWord(cursor, command, word);
  }

  command.done ||= cursor.broken;
}

function readSimpleCommand(cursor: Cursor): readonly string[] | undefined {
  const command: Command = { words: [], named: false, ignored: false, done: false };
  while (!command.done) {
    readCommandItem(cursor, command);
  }

  return command.named && !command.ignored ? command.words : undefined;
}

function bareRun(cursor: Cursor): string {
  BARE_WORD.lastIndex = cursor.pos;
  return BARE_WORD.exec(cursor.text)?.[0] ?? "";
}

function peekBareWord(cursor: Cursor): string {
  const bare = bareRun(cursor);
  return atWordEnd({ ...cursor, pos: cursor.pos + bare.length }) ? bare : "";
}

function skipPast(cursor: Cursor, closer: string): void {
  while (cursor.pos < cursor.text.length) {
    skipSeparators(cursor);
    const bare = peekBareWord(cursor);
    const start = cursor.pos;
    readWord(cursor);
    if (bare === closer) {
      return;
    }

    cursor.pos += cursor.pos === start ? 1 : 0;
  }
}

function skipCommandPrefix(cursor: Cursor): boolean {
  if (charAt(cursor) === "#") {
    const newline = cursor.text.indexOf("\n", cursor.pos);
    cursor.pos = newline === -1 ? cursor.text.length : newline;
    return true;
  }

  if (cursor.text.startsWith("((", cursor.pos)) {
    takePiece(cursor, enclosureEnd(cursor.text, cursor.pos + 1, "("), "expansion");
    return true;
  }

  if (charAt(cursor) === "(") {
    cursor.pos += 1;
    cursor.subshells += 1;
    return true;
  }

  return skipKeyword(cursor);
}

function skipKeyword(cursor: Cursor): boolean {
  const bare = bareRun(cursor);
  const after = { ...cursor, pos: cursor.pos + bare.length };
  if (GLUED_KEYWORDS.has(bare) && GLUED_STARTS.has(charAt(after))) {
    cursor.pos = after.pos;
    return true;
  }

  if (!atWordEnd(after)) {
    return false;
  }

  const closer = SKIPPED_STATEMENTS.get(bare);
  if (closer !== undefined) {
    cursor.pos += bare.length;
    skipPast(cursor, closer);
    return true;
  }

  const prefix = PREFIX_KEYWORDS.has(bare);
  cursor.pos += prefix ? bare.length : 0;
  return prefix;
}

function readStatement(cursor: Cursor): readonly string[] | undefined {
  skipSeparators(cursor);
  while (skipCommandPrefix(cursor)) {
    skipSeparators(cursor);
  }

  return readSimpleCommand(cursor);
}

function firstCommandWords(text: string): readonly string[] {
  const cursor: Cursor = { text, pos: 0, broken: false, subshells: 0 };
  let words: readonly string[] | undefined;
  while (words === undefined && cursor.pos < text.length) {
    words = readStatement(cursor);
  }

  return words ?? [];
}

/**
 * Split the argument text a user typed after a skill or command into the
 * words that `$0`, `$1`, and `$ARGUMENTS[N]` read, as Claude Code 2.1.316's
 * `c$o` does (D-CF1-01). Only the first simple command counts. Empty or
 * whitespace-only text gives no words. Text over 10,000 characters, or text
 * with no command word, is split on whitespace.
 */
export function splitArguments(text: string): readonly string[] {
  if (text.trim() === "") {
    return [];
  }

  const words = text.length > MAX_PARSED_LENGTH ? [] : firstCommandWords(text);
  return words.length > 0 ? words : text.split(/\s+/).filter((word) => word !== "");
}

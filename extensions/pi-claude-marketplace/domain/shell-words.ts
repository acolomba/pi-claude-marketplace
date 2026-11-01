// domain/shell-words.ts
//
// Port of Claude Code 2.1.316's argument tokenizer `c$o` and its shell-parser
// step `Ck` (D-CF1-01). Upstream parses the typed arguments with
// tree-sitter-bash and keeps the words of the first simple command; this
// module scans the same grammar by hand.
//
// Residual policy (D-CF1-01): quoting and backslash escapes must match
// upstream exactly. Other tree-sitter-bash behavior is best effort, and every
// known difference is listed in the residual table of the paired test module.

// `Ck` returns no words above this length, so `c$o` takes the whitespace split.
const MAX_PARSED_LENGTH = 10_000;

const BLANKS = new Set([" ", "\t", "\r"]);

interface Cursor {
  readonly text: string;
  pos: number;
  // Set when a quote never closes; tree-sitter-bash then finds no command.
  broken: boolean;
}

function skipBlanks(cursor: Cursor): void {
  while (BLANKS.has(cursor.text.charAt(cursor.pos))) {
    cursor.pos += 1;
  }
}

function atWordEnd(cursor: Cursor): boolean {
  const char = cursor.text.charAt(cursor.pos);
  return char === "" || char === "\n" || BLANKS.has(char);
}

function readSingleQuoted(cursor: Cursor): string {
  const close = cursor.text.indexOf("'", cursor.pos + 1);
  if (close === -1) {
    cursor.broken = true;
    cursor.pos = cursor.text.length;
    return "";
  }

  const content = cursor.text.slice(cursor.pos + 1, close);
  cursor.pos = close + 1;
  return content;
}

function readWord(cursor: Cursor): string {
  let word = "";
  while (!atWordEnd(cursor)) {
    const char = cursor.text.charAt(cursor.pos);
    if (char === "'") {
      word += readSingleQuoted(cursor);
    } else {
      word += char;
      cursor.pos += 1;
    }
  }

  return word;
}

function firstCommandWords(text: string): readonly string[] {
  const cursor: Cursor = { text, pos: 0, broken: false };
  const words: string[] = [];
  skipBlanks(cursor);
  if (cursor.text.charAt(cursor.pos) === "#") {
    return [];
  }

  while (!atWordEnd(cursor)) {
    words.push(readWord(cursor));
    skipBlanks(cursor);
  }

  return cursor.broken ? [] : words;
}

/**
 * Split the argument text a user typed after a skill or command into the
 * words that `$0`, `$1`, and `$ARGUMENTS[N]` read, as Claude Code 2.1.316's
 * `c$o` does (D-CF1-01). Empty or whitespace-only text gives no words. Text
 * over 10,000 characters, or text with no command word, is split on
 * whitespace.
 */
export function splitArguments(text: string): readonly string[] {
  if (text.trim() === "") {
    return [];
  }

  const words = text.length > MAX_PARSED_LENGTH ? [] : firstCommandWords(text);
  return words.length > 0 ? words : text.split(/\s+/).filter((word) => word !== "");
}

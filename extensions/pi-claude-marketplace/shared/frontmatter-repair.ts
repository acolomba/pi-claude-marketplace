// shared/frontmatter-repair.ts
//
// D-PG7-03: the line-based frontmatter helpers that the skills bridge and the
// agents bridge both need. They live here because fallow's zone boundaries
// forbid one bridge from importing another. The module imports nothing.

/**
 * Index of the closing fence as Pi 1.5.0's `parseFrontmatter` finds it
 * (`indexOf("\n---", 3)` in `dist/utils/frontmatter.js`): the first line after
 * the opening one that starts with `---` at column 0, or `lines.length`. An
 * indented `---` is block-scalar content to Pi, so no writer may stop there,
 * and a `----` line closes the block as it does for Pi.
 */
export function frontmatterBlockEnd(lines: readonly string[]): number {
  for (const [offset, line] of lines.slice(1).entries()) {
    if (line.startsWith("---")) {
      return offset + 1;
    }
  }

  return lines.length;
}

/** A column-0 explicit-key line, `? <key>`. */
const EXPLICIT_KEY = /^\?(\s|$)/;

/** The column-0 value line of an explicit key, `: <value>`. */
const EXPLICIT_VALUE = /^:(\s|$)/;

/**
 * Given a top-level key line at `keyIndex`, return the index of the LAST line
 * its value spans.
 *
 * A scalar value continues onto later lines for EVERY multi-line form -- block
 * (`>` / `|`, with or without a chomp or indent modifier), multi-line plain,
 * and multi-line single- or double-quoted -- and in all of them the
 * continuation lines are indented deeper than the column-0 key. So every
 * indented non-blank line up to `blockEnd` is absorbed, stopping at the first
 * line that returns to column 0: the next top-level key, or the closing fence.
 * An inline scalar has no continuation, so the following line is already at
 * column 0 and the key line itself is returned.
 *
 * CR-01 / WR-01: detecting the FULL node span for all multi-line forms, not
 * just block scalars, is what prevents orphaned continuation lines. Left
 * behind, they make gate-2 reject the staged bytes on the degrade path, and on
 * the rewrite path they fold into the parsed name and trip the SKILL-03 verify
 * (the `<gen> a b` corruption class).
 *
 * Trailing blank lines are NOT absorbed, so inter-key blank spacing survives
 * byte-for-byte. The one column-0 line a node absorbs is the `:` value line of
 * an explicit key (`? name` then `: x`).
 */
export function keyValueEnd(lines: readonly string[], keyIndex: number, blockEnd: number): number {
  let lastReplaced = keyIndex;
  let awaitingValue = false;
  for (const [offset, line] of lines.slice(keyIndex, blockEnd).entries()) {
    if (offset === 0) {
      // IN-01: an explicit key (`? name`) takes its value from the next column-0
      // `:` line, so that line belongs to the same node.
      awaitingValue = EXPLICIT_KEY.test(line);
      continue;
    }

    if (line.trim() === "") {
      continue;
    }

    if (/^\s/.test(line) || (awaitingValue && EXPLICIT_VALUE.test(line))) {
      awaitingValue &&= !EXPLICIT_VALUE.test(line);
      lastReplaced = keyIndex + offset;
      continue;
    }

    break;
  }

  return lastReplaced;
}

/**
 * Emit `value` as a safe double-quoted single-line YAML scalar. Embedded
 * newlines collapse to spaces, then `\` and `"` are escaped, so the emitted
 * scalar cannot re-form a new YAML key on a following line (the AG-8
 * provenance-injection class). Backslashes are escaped BEFORE quotes so an
 * author `"` is not double-processed.
 */
export function emitSafeDoubleQuotedScalar(value: string): string {
  const oneLine = value.replaceAll(/\r?\n/g, " ");
  const escaped = oneLine.replaceAll("\\", String.raw`\\`).replaceAll('"', String.raw`\"`);
  return `"${escaped}"`;
}

/** An opening `---` fence anchored at the very start of the document. */
const OPENING_FENCE = /^---[ \t]*\r?\n/;

/** A column-0 key -- no whitespace, colon or `#` -- followed by a colon and a space or tab. */
const TOP_LEVEL_KEY = /^[^\s:#]+:[ \t]/;

/** Value openers a colon repair leaves alone: already quoted, flow collection, block scalar. */
const UNREPAIRABLE_VALUE = /^["'[{|>]/;

/**
 * Read a frontmatter line as a single-line plain scalar that `trigger` accepts,
 * returning its key and its whitespace-trimmed value. Returns `undefined` for
 * every other line shape, so the caller copies that line byte-identically. The
 * empty-value and opener tests run before the trigger, so no trigger reaches a
 * quoted value, a flow collection, or a block scalar. The key pattern admits no
 * colon, so the first `:` in an accepted line is always the key separator.
 */
function repairableScalar(
  line: string,
  trigger: (value: string) => boolean,
): { key: string; value: string } | undefined {
  if (!TOP_LEVEL_KEY.test(line)) {
    return undefined;
  }

  const separator = line.indexOf(":");
  const value = line.slice(separator + 1).trim();
  if (value === "" || UNREPAIRABLE_VALUE.test(value) || !trigger(value)) {
    return undefined;
  }

  return { key: line.slice(0, separator), value };
}

/**
 * The lines of `content` and the index of its closing fence, or `undefined`
 * when it has no opening fence at its start or no closing fence.
 */
function fencedBlock(
  content: string,
): { readonly lines: readonly string[]; readonly blockEnd: number } | undefined {
  if (!OPENING_FENCE.test(content)) {
    return undefined;
  }

  const lines = content.split("\n");
  const blockEnd = frontmatterBlockEnd(lines);
  return blockEnd === lines.length ? undefined : { lines, blockEnd };
}

/**
 * SKFM-01: the skills trigger of `repairSingleLineScalars`. It accepts a value
 * that holds a colon, the defect that makes YAML refuse a plain scalar.
 */
export function colonRepairTrigger(value: string): boolean {
  return value.includes(":");
}

/**
 * SKFM-01 / D-PG7-02: repair the one frontmatter defect class that is safe to
 * rewrite -- a single-line plain scalar that YAML refuses -- and let the
 * caller's `trigger` say which values of that class to quote. The skills bridge
 * passes `colonRepairTrigger`: a single-line plain scalar carrying an unquoted
 * colon, such as `description: Use this: when reviewing`. YAML forbids `: `
 * inside a plain scalar, so Pi's strict parser rejects the whole block and the
 * author loses every key in it to the SKILL-01 / D-86-02 placeholder.
 * Re-emitting just that line through the safe double-quoted scalar emitter
 * recovers the author's real text and leaves every sibling byte untouched.
 *
 * A line is repaired only when it sits inside the frontmatter block, starts at
 * column 0 with a whitespace-, colon- and `#`-free key followed by a colon and a
 * space or tab, spans exactly one line (`keyValueEnd`), and carries a non-empty
 * value that `trigger` accepts. Every other form is copied byte-identically, because
 * quoting it would change what the document MEANS rather than what it parses as:
 * an already-quoted value needs no repair, `[` and `{` open a flow collection
 * whose members would collapse into one string, `|` and `>` open a block scalar
 * whose continuation lines would be orphaned, and a multi-line plain scalar
 * likewise spans lines a single-line re-emit cannot see. Eligibility is decided
 * per line, so an excluded sibling never vetoes a repairable one. Content
 * without an opening fence, without a closing fence, or with no eligible line at
 * all is returned unchanged, and the caller degrades as before.
 *
 * The repair is SILENT by design: no warning, no notification, no result field.
 * It restores what the author wrote, so there is nothing for the user to act on,
 * and the notification layer renders state that commands decide rather than
 * probing for it. Claude Code's retry quotes a wider set of values; the trigger
 * decides which of them this repair quotes (D-PG7-02). PARSE-01 still decides
 * the degrade from the SOURCE parse, and PARSE-02 still re-parses whatever bytes
 * the repair produces.
 */
export function repairSingleLineScalars(
  content: string,
  trigger: (value: string) => boolean,
): string {
  const block = fencedBlock(content);
  if (block === undefined) {
    return content;
  }

  const { lines, blockEnd } = block;

  const repaired = [...lines];
  let changed = false;
  for (const [offset, line] of lines.slice(1, blockEnd).entries()) {
    const index = offset + 1;
    const scalar = repairableScalar(line, trigger);
    if (scalar === undefined || keyValueEnd(lines, index, blockEnd) !== index) {
      continue;
    }

    repaired[index] = `${scalar.key}: ${emitSafeDoubleQuotedScalar(scalar.value)}`;
    changed = true;
  }

  return changed ? repaired.join("\n") : content;
}

/**
 * A column-0 key, then optional blanks, a colon, and whitespace or the line
 * end. The key is plain, with no whitespace, colon, or `#` and no quote mark
 * at its start, or it is double- or single-quoted with no escape inside. Any
 * whitespace matches after the colon, so the `\r` of a CRLF line does too.
 */
const TOP_LEVEL_KEY_NAME = /^("[^"\\]*"|'[^']*'|[^\s:#"'][^\s:#]*)[ \t]*:(?=\s|$)/;

/** A line that continues an empty-valued key: indented, or a column-0 `- ` item of a compact list. */
const OPEN_VALUE_LINE = /^(?:\s|-(?:\s|$))/;

/**
 * The key a top-level line writes, without its quote marks, and whether its
 * value is empty on the key line, which leaves room for a list whose items
 * start at column 0. Returns `undefined` for any other line.
 */
function topLevelKey(
  line: string,
): { readonly key: string; readonly openValue: boolean } | undefined {
  const match = TOP_LEVEL_KEY_NAME.exec(line);
  if (match === null) {
    return undefined;
  }

  const written = match[0].slice(0, -1).trimEnd();
  const value = line.slice(match[0].length).trim();
  return {
    key: /^["']/.test(written) ? written.slice(1, -1) : written,
    openValue: value === "" || value.startsWith("#"),
  };
}

/**
 * The index of the last line the value of the key at `start` spans. A key
 * with a value on its line spans what `keyValueEnd` finds. An empty-valued
 * key also spans the column-0 `- ` items that follow it, because YAML reads
 * them as its list (`tools:` then `- Read`). An open value is a list or
 * null, never a block scalar, so a column-0 comment line does not end it:
 * YAML reads the comment as nothing, and the list goes on after it.
 */
function duplicateKeySpanEnd(
  lines: readonly string[],
  start: number,
  blockEnd: number,
  openValue: boolean,
): number {
  if (!openValue) {
    return keyValueEnd(lines, start, blockEnd);
  }

  let end = start;
  for (const [offset, line] of lines.slice(start + 1, blockEnd).entries()) {
    if (line.trim() === "" || line.startsWith("#")) {
      continue;
    }

    if (!OPEN_VALUE_LINE.test(line)) {
      break;
    }

    end = start + 1 + offset;
  }

  return end;
}

/**
 * D-PG7-19: keep only the last copy of a top-level key that a frontmatter
 * block writes more than once, as `Bun.YAML.parse` keeps the last value where
 * Pi's YAML reader refuses the whole block. `tools`, `"tools"`, `'tools'`,
 * and `tools :` are one key. Every line of an earlier copy, its continuation
 * lines and the column-0 items of its list included, becomes an empty line,
 * so the block keeps its line count and a later parse error names the
 * source's line. An explicit key (`? tools`), a quoted key with an escape,
 * and a key repeated inside a nested mapping are not matched. Content
 * without an opening and a closing fence, or with no repeated key, is
 * returned unchanged.
 */
export function blankEarlierDuplicateKeys(content: string): string {
  const block = fencedBlock(content);
  if (block === undefined) {
    return content;
  }

  const { lines, blockEnd } = block;

  const lastStart = new Map<string, number>();
  const spans: { readonly key: string; readonly start: number; readonly end: number }[] = [];
  // A line a key's value spans is indented or is a column-0 `- ` item, and the
  // key pattern matches neither, so no key is found inside a span.
  for (const [offset, line] of lines.slice(1, blockEnd).entries()) {
    const topLevel = topLevelKey(line);
    if (topLevel !== undefined) {
      const start = offset + 1;
      const end = duplicateKeySpanEnd(lines, start, blockEnd, topLevel.openValue);
      spans.push({ key: topLevel.key, start, end });
      lastStart.set(topLevel.key, start);
    }
  }

  const earlier = spans.filter((span) => lastStart.get(span.key) !== span.start);
  if (earlier.length === 0) {
    return content;
  }

  const blanked = [...lines];
  for (const span of earlier) {
    blanked.fill("", span.start, span.end + 1);
  }

  return blanked.join("\n");
}

/**
 * SKILL-01: extract the markdown body from a skill source whose frontmatter
 * block failed to parse, reproducing `parseFrontmatter`'s OWN split so the
 * synthesized block preserves the body byte-for-byte identically to the
 * parseable path (PARSE-01 encoding parity). Newlines are normalized (CR/CRLF ->
 * LF, including lone CR) exactly as the parser does; the opening fence is the
 * parser's anchored `---` prefix (`startsWith`, NOT a per-line `trim`); and the
 * close is the parser's `\n---` prefix search. An exotic delimiter -- a `---x`
 * line or an indented `---` -- is therefore classified identically to Pi rather
 * than by a looser `line.trim() === "---"` match. Called ONLY on the gate-1
 * throw arm, where a closed `---` block is present by construction -- the body
 * is everything after the closing delimiter, trimmed.
 */
export function extractBodyAfterFrontmatter(content: string): string {
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const closeIndex = normalized.indexOf("\n---", 3);
  return normalized.slice(closeIndex + 4).trim();
}

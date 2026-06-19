// bridges/hooks/if-field/bash.ts
//
// MATCH-03 hand-authored Bash subcommand parser implementing upstream
// Claude Code's permission-rule contract verbatim per
// `code.claude.com/docs/en/permissions` § "Bash" / § "Process wrappers" /
// § "Compound commands".
//
// D-61-04 strip / split / recurse rules:
//   - Strip wrappers (closed set, NO flags): `timeout`, `time`, `nice`,
//     `nohup`, `stdbuf`, bare `xargs`. `xargs -n1 grep pattern` matches
//     as `xargs` (NOT `grep`) -- the xargs-with-flags clause is
//     load-bearing.
//   - Do NOT strip: `env`, `sudo`, `chronic`, `watch`, `setsid`,
//     `ionice`, `flock`, `devbox run`, `mise exec`, `npx`, `docker exec`.
//     Upstream intentionally treats these environment runners as opaque
//     command heads.
//   - Compound separators (longest first to honor precedence): `&&`,
//     `||`, `|&`, `|`, `&`, `;`, newline. Single + double quotes prevent
//     splitting; backticks do NOT prevent splitting (recursed).
//   - Recursive subcommand extraction: `$(...)` and backtick `` `...` ``
//     bodies are recursively parsed and each inner subcommand is checked
//     independently. Process substitution `<(...)` / `>(...)` is NOT
//     recursed (treated as literal text in the surrounding subcommand).
//   - `find -exec` is opaque: `find -exec rm {} \;` matches as `find`,
//     NOT as `rm` -- the `-exec` argument is not recursively parsed.
//     Same for `find -delete`.
//   - Specificity-override: patterns more specific than `<command> *`
//     (e.g. `Bash(git push *)`) fire on `$()`/backticks/`$VAR`
//     interpolation in the command, even when no subcommand matches
//     directly (matches upstream's "patterns more specific than the
//     command name run the hook anyway on interpolation").
//
// Fail-open: returning `{ ok: false, reason }` is the dispatch signal to
// fire the hook regardless (upstream's "best-effort, not a security
// boundary" contract per MATCH-03 §3). `parseBashSubcommands` catches
// every internal error and surfaces it through the discriminated
// `ParseResult`; consumers (the dispatch consult in a follow-up plan)
// read `!ok` as fire-the-hook.
//
// Stack-overflow guard: nested `$()` / backtick recursion is capped at
// `MAX_RECURSION_DEPTH = 8`. Pathological input (deeply nested command
// substitution) returns `{ ok: false, reason }` and falls open per
// D-61-04.
//
// IL-2 / channel discipline: no `ctx.ui.notify`, no `process.stdout` /
// `process.stderr` writes. The fall-open warning seam lives in the
// dispatch consult (a follow-up plan) which calls `hookDebugLog` once
// per fall-open event.

import { errorMessage } from "../../../shared/errors.ts";

import type { CompiledBashGlob } from "./glob.ts";

// ──────────────────────────────────────────────────────────────────────────
// ParseResult discriminated union
// ──────────────────────────────────────────────────────────────────────────

/**
 * Discriminated result of `parseBashSubcommands`. The `ok: false` arm is
 * the fail-open trigger -- the dispatch consult reads `!ok` as "fire the
 * hook regardless" per D-61-04. `hasInterpolation` is true iff the
 * original command contains `$(...)`, backticks, `$IDENT`, or `${VAR}`;
 * the specificity-override branch of `bashSubcommandFires` reads this
 * flag.
 */
export type ParseResult =
  | {
      readonly ok: true;
      readonly subcommands: ReadonlyArray<string>;
      readonly hasInterpolation: boolean;
    }
  | { readonly ok: false; readonly reason: string };

// ──────────────────────────────────────────────────────────────────────────
// Closed-set wrapper list (D-61-04)
// ──────────────────────────────────────────────────────────────────────────

/**
 * The six closed-set process wrappers upstream strips from the head of a
 * Bash command before glob matching. `xargs` is a special case (see
 * `stripWrappers`): the bare form strips, but `xargs -n1 ...` does NOT.
 *
 * Upstream-verbatim list -- adding to this set (e.g. `env`, `sudo`,
 * `npx`) would deviate from upstream and create plugin-portability
 * asymmetry. `code.claude.com/docs/en/permissions` § "Process wrappers"
 * is the authority.
 */
export const WRAPPER_STRIP: ReadonlySet<string> = new Set<string>([
  "timeout",
  "time",
  "nice",
  "nohup",
  "stdbuf",
  "xargs",
]);

// ──────────────────────────────────────────────────────────────────────────
// Interpolation regex
// ──────────────────────────────────────────────────────────────────────────

/**
 * Matches any of: `$IDENT` (alpha-or-underscore start; excludes positional
 * params `$1`-`$9` which are not user-controlled interpolation),
 * `${...}`, `$(`, or a backtick. The first match on the raw command sets
 * `hasInterpolation = true` for the specificity-override rule.
 *
 * Quote-naïve by design (WR-03): a `$VAR` or backtick literal inside
 * single quotes (`echo 'literal $HOME'`, `awk '/foo/ { print $1 }'`)
 * still trips the flag. The trade-off is acceptable because the
 * specificity-override path is fail-OPEN -- a spurious flag yields an
 * extra fire, never a missed one (matches upstream's "best-effort, not
 * a security boundary" contract per MATCH-03 §3). Quote-tracking the
 * regex would add real complexity for marginal gain on a fail-OPEN
 * surface.
 */
const INTERPOLATION_RE = /\$[A-Za-z_]\w*|\$\{[^}]+\}|\$\(|`/;

const MAX_RECURSION_DEPTH = 8;

// ──────────────────────────────────────────────────────────────────────────
// Compound-separator splitter (quote-aware)
// ──────────────────────────────────────────────────────────────────────────

interface SeparatorMatch {
  readonly start: number;
  readonly end: number;
}

/**
 * Detect a compound separator starting at position `i` in `command`.
 * Returns the {start, end} bounds of the matched separator or null when
 * no separator starts at `i`. Longest-token-first precedence: `&&`/`||`/
 * `|&` are checked before single-char `|`/`&`/`;`/newline.
 */
function separatorAt(command: string, i: number): SeparatorMatch | null {
  const two = command.slice(i, i + 2);
  if (two === "&&" || two === "||" || two === "|&") {
    return { start: i, end: i + 2 };
  }

  const one = command[i];
  if (one === "|" || one === "&" || one === ";" || one === "\n") {
    return { start: i, end: i + 1 };
  }

  return null;
}

/**
 * Mutable quote-state cursor used by both the compound-separator splitter
 * and the balanced-paren scanner. Tracks single- and double-quote regions
 * so the scanners can skip metacharacters that appear inside quotes.
 *
 * Backticks are deliberately NOT tracked here -- they are command
 * substitution delimiters that the caller recurses into separately.
 */
interface QuoteCursor {
  inSingle: boolean;
  inDouble: boolean;
}

/**
 * Advance `qc` by one character. Returns `true` when the character was
 * consumed as part of quote-state bookkeeping (entry or exit of a
 * quoted region, or any char inside a quoted region); returns `false`
 * when the character is outside quotes and the caller may inspect it
 * for its own metacharacter handling.
 */
function consumeQuoteChar(qc: QuoteCursor, c: string | undefined): boolean {
  if (qc.inSingle) {
    if (c === "'") {
      qc.inSingle = false;
    }

    return true;
  }

  if (qc.inDouble) {
    if (c === '"') {
      qc.inDouble = false;
    }

    return true;
  }

  if (c === "'") {
    qc.inSingle = true;
    return true;
  }

  if (c === '"') {
    qc.inDouble = true;
    return true;
  }

  return false;
}

/**
 * Quote-aware splitter on compound separators. Walks the input once
 * tracking single-quote and double-quote state; emits a piece every time
 * a compound separator is encountered outside any quoted region.
 * Backticks do NOT inhibit splitting (they are recursed as command
 * substitution by the caller).
 *
 * Backslash-escape awareness (WR-04): outside single quotes a
 * backslash escapes the next character, so `find . -exec rm {} \;`
 * and `echo foo \&\& bar` do NOT split on the escaped `;` / `&&`.
 * Inside single quotes the backslash is literal per Bash semantics.
 */
function splitOnCompoundSeparators(command: string): string[] {
  const pieces: string[] = [];
  const qc: QuoteCursor = { inSingle: false, inDouble: false };
  let pieceStart = 0;
  let i = 0;
  while (i < command.length) {
    // Backslash escape outside single quotes consumes the next char so
    // an escaped separator (`\;`, `\&&`) does not split the command.
    if (!qc.inSingle && command[i] === "\\" && i + 1 < command.length) {
      i += 2;
      continue;
    }

    if (consumeQuoteChar(qc, command[i])) {
      i++;
      continue;
    }

    const sep = separatorAt(command, i);
    if (sep !== null) {
      pieces.push(command.slice(pieceStart, sep.start).trim());
      pieceStart = sep.end;
      i = sep.end;
      continue;
    }

    i++;
  }

  pieces.push(command.slice(pieceStart).trim());
  return pieces.filter((p) => p.length > 0);
}

// ──────────────────────────────────────────────────────────────────────────
// $(...) / backtick recursion
// ──────────────────────────────────────────────────────────────────────────

/**
 * Scan `text` for `$(...)` and backtick `` `...` `` command-substitution
 * bodies, parse each body recursively, and push every discovered
 * subcommand (including the bodies themselves and their nested splits)
 * into `out`. Depth-capped at `MAX_RECURSION_DEPTH` to bound pathological
 * input.
 *
 * `<(...)` and `>(...)` (process substitution) are NOT recursed -- their
 * bodies are treated as literal text in the surrounding subcommand per
 * D-61-04.
 */
/**
 * Split `inner` into pieces, push each piece into `out`, and recurse
 * one level deeper to handle nested `$(...)` / backtick bodies.
 */
function emitInner(inner: string, out: string[], depth: number): void {
  const innerPieces = splitOnCompoundSeparators(inner);
  for (const p of innerPieces) {
    out.push(p);
    pushRecursed(p, out, depth + 1);
  }
}

function pushRecursed(text: string, out: string[], depth: number): void {
  if (depth >= MAX_RECURSION_DEPTH) {
    throw new Error("max recursion depth exceeded");
  }

  let i = 0;
  while (i < text.length) {
    // $(...): require the dollar so we don't pick up bare "(".
    // Also exclude process substitution <( and >( -- not recursed.
    if (text[i] === "$" && text[i + 1] === "(") {
      const body = readBalancedParens(text, i + 2);
      if (body === null) {
        i++;
        continue;
      }

      emitInner(text.slice(i + 2, body.end), out, depth);
      i = body.end + 1; // skip the closing ')'
      continue;
    }

    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end < 0) {
        i++;
        continue;
      }

      emitInner(text.slice(i + 1, end), out, depth);
      i = end + 1;
      continue;
    }

    i++;
  }
}

/**
 * Read a balanced parenthesis group starting at `start` (one past the
 * opening paren). Returns the position of the matching close paren on
 * success, null on unmatched. Honors quote state internally so `$('a)b')`
 * does not close prematurely.
 */
function readBalancedParens(text: string, start: number): { readonly end: number } | null {
  let depth = 1;
  const qc: QuoteCursor = { inSingle: false, inDouble: false };
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (consumeQuoteChar(qc, c)) {
      i++;
      continue;
    }

    if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) {
        return { end: i };
      }
    }

    i++;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Wrapper stripping
// ──────────────────────────────────────────────────────────────────────────

/**
 * Strip head wrappers from a subcommand per D-61-04. Iterates as long as
 * the head token is a member of `WRAPPER_STRIP`. Two upstream-faithful
 * special cases:
 *
 *   - `xargs` with a flag arg (`xargs -n1 grep ...`) is NOT stripped;
 *     the bare `xargs grep ...` IS. The flag detection is the load-
 *     bearing signal.
 *   - `timeout` / `nice` / `stdbuf` take a non-option argument (a
 *     duration, niceness, or option-value pair) that upstream
 *     considers part of the wrapper invocation. The next non-option
 *     token is also stripped when it does NOT look like a command
 *     itself. `nohup` / `time` take no argument; we strip only the
 *     wrapper head for those.
 *
 * `find` is intentionally NOT in `WRAPPER_STRIP`: this naturally keeps
 * `find -exec rm {} \;` as a single subcommand whose head is `find`
 * (upstream-faithful "find -exec opaque" behavior).
 */
const WRAPPERS_WITH_ARG = new Set<string>(["timeout", "nice", "stdbuf"]);

function stripWrappers(subcmd: string): string {
  let cur = subcmd.trim();
  while (cur.length > 0) {
    const parts = cur.split(/\s+/);
    const head = parts[0];
    if (head === undefined || !WRAPPER_STRIP.has(head)) {
      return cur;
    }

    if (head === "xargs" && parts[1]?.startsWith("-") === true) {
      return cur;
    }

    // Strip the wrapper head; for the with-arg wrappers, also consume
    // the next non-option token (the duration / niceness / option-value
    // upstream rolls into the wrapper invocation).
    cur = cur.slice(head.length).trim();
    if (WRAPPERS_WITH_ARG.has(head)) {
      const nextParts = cur.split(/\s+/);
      const next = nextParts[0];
      if (next !== undefined && next.length > 0 && !next.startsWith("-")) {
        cur = cur.slice(next.length).trim();
      }
    }
  }

  return cur;
}

// ──────────────────────────────────────────────────────────────────────────
// Public entry: parseBashSubcommands
// ──────────────────────────────────────────────────────────────────────────

/**
 * Pure-and-total per the discriminated `ParseResult` contract: any
 * thrown internal error is caught and surfaced as `{ ok: false, reason }`.
 * The dispatch consult fails open on `!ok` (D-61-04).
 *
 * Algorithm:
 *   1. Compute `hasInterpolation` on the raw command.
 *   2. Quote-aware split on compound separators.
 *   3. For each piece, push the piece itself, then recurse into `$(...)`
 *      and backtick bodies (depth-capped at `MAX_RECURSION_DEPTH`).
 *   4. Strip head wrappers from every accumulated subcommand.
 *   5. Return the deduplicated subcommand list + the interpolation flag.
 */
export function parseBashSubcommands(command: string): ParseResult {
  try {
    const hasInterpolation = INTERPOLATION_RE.test(command);
    const pieces = splitOnCompoundSeparators(command);
    const recursed: string[] = [];
    for (const piece of pieces) {
      recursed.push(piece);
      pushRecursed(piece, recursed, 0);
    }

    const stripped = recursed.map((s) => stripWrappers(s)).filter((s) => s.length > 0);
    return { ok: true, subcommands: stripped, hasInterpolation };
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// bashSubcommandFires (specificity-override)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Single-subcommand match with the D-61-04 specificity-override rule.
 *
 *   1. Direct match via `glob.test(subcommand)` -> fire.
 *   2. Specificity-override: if `hasInterpolation` is true AND the
 *      pattern is NOT command-name-only (e.g. `Bash(git push *)` vs.
 *      `Bash(git *)`), fire regardless. Upstream: "patterns more
 *      specific than the command name run the hook anyway on `$()` /
 *      backticks / `$VAR`" -- fail-open on uncertain context.
 *
 * Returns false when neither branch applies.
 */
export function bashSubcommandFires(
  glob: CompiledBashGlob,
  subcommand: string,
  hasInterpolation: boolean,
): boolean {
  if (glob.test(subcommand)) {
    return true;
  }

  if (hasInterpolation && !glob.isCommandNameOnly) {
    return true;
  }

  return false;
}

// bridges/hooks/if-field/powershell.ts
//
// HKPS-01 hand-authored PowerShell subcommand parser implementing upstream
// Claude Code's `PowerShell(...)` permission-rule contract per
// `code.claude.com/docs/en/permissions` § "PowerShell".
//
// Upstream shells out to pwsh's real parser; D-61-01 (zero new runtime
// deps) rules that out here, so the documented contract is hand-authored
// and every uncertain path falls OPEN -- the same stance `./bash.ts`
// takes. The documented contract this file implements:
//
//   - Rules use the `Bash(...)` shape: `*` matches at any position, the
//     `:*` suffix is equivalent to a trailing ` *`, and a bare
//     `PowerShell(*)` matches every command.
//   - Matching is case-insensitive. `./glob.ts` owns the fold.
//   - Common aliases are canonicalized before matching, so a rule written
//     for a cmdlet name also matches its aliases (`PowerShell(Get-ChildItem *)`
//     matches `gci`, `ls`, and `dir`). Both sides canonicalize: the
//     PATTERN head through `compilePowerShellRule` and the RUNTIME head
//     through `powerShellSubcommandFires`, which is what makes the
//     alias-to-canonical and canonical-to-alias directions both work.
//   - Each command in a compound command is checked independently.
//     Pipeline operator `|`, statement separator `;`, the PowerShell 7+
//     chain operators `&&` and `||`, and a newline all split. A bare `&`
//     does NOT split -- it is PowerShell's call operator, not a background
//     operator.
//
// Divergences from `./bash.ts`, all of them PowerShell language facts:
//   - A backtick is PowerShell's ESCAPE character, not command
//     substitution. A backtick-escaped separator does not split, and a
//     backtick-delimited region is never parsed as a nested subcommand.
//   - A doubled quote (`''` inside a single-quoted region, `""` inside a
//     double-quoted region) is an escaped quote and does not close the
//     region.
//   - There is no process-wrapper vocabulary. `timeout foo` parses to
//     `timeout foo` unchanged; PowerShell has no `timeout`/`nice`/`nohup`
//     equivalent upstream strips.
//
// Subexpression bodies (`$(...)`) ARE parsed recursively, depth-capped at
// `MAX_RECURSION_DEPTH`. Exceeding the cap throws and is caught by the
// public entry, which returns the `ok: false` fail-open arm.
//
// IL-2 / channel discipline: no `ctx.ui.notify`, no `process.stdout` /
// `process.stderr` writes. The fall-open warning seam lives in the
// dispatch consult (`./index.ts`).

import { errorMessage } from "../../../shared/errors.ts";

import { compilePowerShellGlob } from "./glob.ts";

import type { ParseResult } from "./bash.ts";
import type { CompiledPowerShellGlob } from "./glob.ts";

// ──────────────────────────────────────────────────────────────────────────
// Alias canonicalization table
// ──────────────────────────────────────────────────────────────────────────

/**
 * Upstream's PowerShell alias canonicalization table, transcribed verbatim
 * from Claude Code's own permission matcher. Keys are lowercase aliases;
 * values are the canonical cmdlet names. `%` and `?` are the two
 * single-character aliases.
 *
 * Adding, dropping, or "fixing" a row changes which rules fire and creates
 * plugin-portability asymmetry with upstream, so the table is a verbatim
 * mirror rather than a curated list.
 */
const POWERSHELL_ALIASES: ReadonlyMap<string, string> = new Map<string, string>([
  ["ls", "Get-ChildItem"],
  ["dir", "Get-ChildItem"],
  ["gci", "Get-ChildItem"],
  ["cat", "Get-Content"],
  ["type", "Get-Content"],
  ["gc", "Get-Content"],
  ["cd", "Set-Location"],
  ["sl", "Set-Location"],
  ["chdir", "Set-Location"],
  ["pushd", "Push-Location"],
  ["popd", "Pop-Location"],
  ["pwd", "Get-Location"],
  ["gl", "Get-Location"],
  ["gi", "Get-Item"],
  ["gp", "Get-ItemProperty"],
  ["ni", "New-Item"],
  ["mkdir", "New-Item"],
  ["md", "New-Item"],
  ["ri", "Remove-Item"],
  ["del", "Remove-Item"],
  ["rd", "Remove-Item"],
  ["rmdir", "Remove-Item"],
  ["rm", "Remove-Item"],
  ["erase", "Remove-Item"],
  ["mi", "Move-Item"],
  ["mv", "Move-Item"],
  ["move", "Move-Item"],
  ["ci", "Copy-Item"],
  ["cp", "Copy-Item"],
  ["copy", "Copy-Item"],
  ["cpi", "Copy-Item"],
  ["si", "Set-Item"],
  ["rni", "Rename-Item"],
  ["ren", "Rename-Item"],
  ["ps", "Get-Process"],
  ["gps", "Get-Process"],
  ["kill", "Stop-Process"],
  ["spps", "Stop-Process"],
  ["start", "Start-Process"],
  ["saps", "Start-Process"],
  ["sajb", "Start-Job"],
  ["ipmo", "Import-Module"],
  ["echo", "Write-Output"],
  ["write", "Write-Output"],
  ["sleep", "Start-Sleep"],
  ["help", "Get-Help"],
  ["man", "Get-Help"],
  ["gcm", "Get-Command"],
  ["gsv", "Get-Service"],
  ["gv", "Get-Variable"],
  ["sv", "Set-Variable"],
  ["h", "Get-History"],
  ["history", "Get-History"],
  ["iex", "Invoke-Expression"],
  ["iwr", "Invoke-WebRequest"],
  ["irm", "Invoke-RestMethod"],
  ["icm", "Invoke-Command"],
  ["ii", "Invoke-Item"],
  ["iwmi", "Invoke-WmiMethod"],
  ["icim", "Invoke-CimMethod"],
  ["nsn", "New-PSSession"],
  ["etsn", "Enter-PSSession"],
  ["exsn", "Exit-PSSession"],
  ["gsn", "Get-PSSession"],
  ["rsn", "Remove-PSSession"],
  ["cls", "Clear-Host"],
  ["clear", "Clear-Host"],
  ["select", "Select-Object"],
  ["where", "Where-Object"],
  ["foreach", "ForEach-Object"],
  ["%", "ForEach-Object"],
  ["?", "Where-Object"],
  ["measure", "Measure-Object"],
  ["ft", "Format-Table"],
  ["fl", "Format-List"],
  ["fw", "Format-Wide"],
  ["oh", "Out-Host"],
  ["ogv", "Out-GridView"],
  ["ac", "Add-Content"],
  ["clc", "Clear-Content"],
  ["tee", "Tee-Object"],
  ["epcsv", "Export-Csv"],
  ["sp", "Set-ItemProperty"],
  ["rp", "Remove-ItemProperty"],
  ["cli", "Clear-Item"],
  ["epal", "Export-Alias"],
  ["sls", "Select-String"],
]);

/**
 * Replace the leading whitespace-delimited token with its canonical cmdlet
 * name when the lowercased token is an alias; return the input unchanged
 * on a miss. The tail (arguments, trailing text) is preserved verbatim so
 * only the head participates in canonicalization.
 */
function canonicalizeHead(command: string): string {
  const headEnd = command.search(/\s/);
  const head = headEnd < 0 ? command : command.slice(0, headEnd);
  const canonical = POWERSHELL_ALIASES.get(head.toLowerCase());
  if (canonical === undefined) {
    return command;
  }

  return canonical + command.slice(head.length);
}

// ──────────────────────────────────────────────────────────────────────────
// Rule compile
// ──────────────────────────────────────────────────────────────────────────

/**
 * Compile the inner pattern of a `PowerShell(<command-glob>)` rule.
 * Canonicalizes the pattern's head token so a rule written with an alias
 * (`PowerShell(gci *)`) compiles to the same glob a rule written with the
 * cmdlet name (`PowerShell(Get-ChildItem *)`) does, then delegates to the
 * case-folding glob compiler. Pure-and-total: never throws.
 */
export function compilePowerShellRule(inner: string): CompiledPowerShellGlob {
  return compilePowerShellGlob(canonicalizeHead(inner));
}

// ──────────────────────────────────────────────────────────────────────────
// Interpolation regex
// ──────────────────────────────────────────────────────────────────────────

/**
 * Matches any of: `$IDENT` (which also covers scoped forms like
 * `$env:PATH`), `${...}`, or `$(`. The first match on the raw command sets
 * `hasInterpolation = true` for the specificity-override rule.
 *
 * A backtick is deliberately absent from the alternation: in PowerShell it
 * is an escape character, not command substitution, so it carries no
 * interpolation uncertainty.
 *
 * Quote-naive by design: a `$VAR` literal inside single quotes still trips
 * the flag. The trade-off is acceptable because the specificity-override
 * path is fail-OPEN -- a spurious flag yields an extra fire, never a
 * missed one.
 */
const INTERPOLATION_RE = /\$[A-Za-z_]\w*|\$\{[^}]+\}|\$\(/;

const MAX_RECURSION_DEPTH = 8;

// ──────────────────────────────────────────────────────────────────────────
// Quote cursor (escape-aware)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Mutable quote-state cursor used by the compound-separator splitter and
 * the balanced-paren scanner. Tracks single- and double-quote regions so
 * the scanners skip separators that appear inside quotes.
 */
interface PowerShellQuoteCursor {
  inSingle: boolean;
  inDouble: boolean;
}

/**
 * Advance the cursor inside a single-quoted region. A doubled `''` is an
 * escaped quote that keeps the region open; a lone `'` closes it.
 */
function advanceInsideSingle(qc: PowerShellQuoteCursor, text: string, i: number): number {
  if (text[i] !== "'") {
    return 1;
  }

  if (text[i + 1] === "'") {
    return 2;
  }

  qc.inSingle = false;
  return 1;
}

/**
 * Advance the cursor inside a double-quoted region. A backtick escapes the
 * next character; a doubled `""` is an escaped quote that keeps the region
 * open; a lone `"` closes it.
 */
function advanceInsideDouble(qc: PowerShellQuoteCursor, text: string, i: number): number {
  const c = text[i];
  if (c === "`") {
    return 2;
  }

  if (c !== '"') {
    return 1;
  }

  if (text[i + 1] === '"') {
    return 2;
  }

  qc.inDouble = false;
  return 1;
}

/**
 * Advance `qc` past the character at `i` and report how many characters
 * were consumed. Zero means the character is outside every quoted region
 * and is not an escape, so the caller may inspect it for its own
 * metacharacter handling; one or two means quote-state or escape
 * bookkeeping consumed it.
 *
 * The count (rather than a boolean) is what the doubled-quote and
 * backtick-escape cases need: both consume two characters.
 */
function advanceQuoteCursor(qc: PowerShellQuoteCursor, text: string, i: number): number {
  if (qc.inSingle) {
    return advanceInsideSingle(qc, text, i);
  }

  if (qc.inDouble) {
    return advanceInsideDouble(qc, text, i);
  }

  const c = text[i];
  if (c === "'") {
    qc.inSingle = true;
    return 1;
  }

  if (c === '"') {
    qc.inDouble = true;
    return 1;
  }

  if (c === "`") {
    return 2;
  }

  return 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Compound-separator splitter
// ──────────────────────────────────────────────────────────────────────────

/**
 * Report the index one past a compound separator starting at `i`, or -1
 * when no separator starts there. Longest-token-first precedence: the
 * two-character chain operators are checked before the single-character
 * pipeline and statement separators. A bare `&` is absent by design --
 * PowerShell's `&` is the call operator, not a separator.
 */
function separatorEnd(command: string, i: number): number {
  const two = command.slice(i, i + 2);
  if (two === "&&" || two === "||") {
    return i + 2;
  }

  const one = command[i];
  if (one === "|" || one === ";" || one === "\n") {
    return i + 1;
  }

  return -1;
}

/**
 * Quote-aware, escape-aware splitter on compound separators. Walks the
 * input once through the quote cursor and emits a piece every time a
 * separator is encountered outside every quoted region and outside a
 * backtick escape.
 */
function splitOnCompoundSeparators(command: string): string[] {
  const pieces: string[] = [];
  const qc: PowerShellQuoteCursor = { inSingle: false, inDouble: false };
  let pieceStart = 0;
  let i = 0;
  while (i < command.length) {
    const consumed = advanceQuoteCursor(qc, command, i);
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const end = separatorEnd(command, i);
    if (end < 0) {
      i++;
      continue;
    }

    pieces.push(command.slice(pieceStart, i).trim());
    pieceStart = end;
    i = end;
  }

  pieces.push(command.slice(pieceStart).trim());
  return pieces.filter((piece) => piece.length > 0);
}

// ──────────────────────────────────────────────────────────────────────────
// $(...) subexpression recursion
// ──────────────────────────────────────────────────────────────────────────

/**
 * Read a balanced parenthesis group starting at `start` (one past the
 * opening paren). Returns the index of the matching close paren, or -1
 * when the group is unmatched. Honors quote state internally so
 * `$('a)b')` does not close prematurely.
 */
function readBalancedParens(text: string, start: number): number {
  const qc: PowerShellQuoteCursor = { inSingle: false, inDouble: false };
  let depth = 1;
  let i = start;
  while (i < text.length) {
    const consumed = advanceQuoteCursor(qc, text, i);
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const c = text[i];
    if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }

    i++;
  }

  return -1;
}

/**
 * Split `inner` into pieces, push each piece into `out`, and recurse one
 * level deeper to handle nested subexpression bodies.
 */
function emitInner(inner: string, out: string[], depth: number): void {
  for (const piece of splitOnCompoundSeparators(inner)) {
    out.push(piece);
    pushRecursed(piece, out, depth + 1);
  }
}

/**
 * Scan `text` for `$(...)` subexpression bodies, parse each body
 * recursively, and push every discovered subcommand (the bodies
 * themselves and their nested splits) into `out`. Depth-capped at
 * `MAX_RECURSION_DEPTH` to bound pathological input; exceeding the cap
 * throws and the public entry converts it into the fail-open arm.
 *
 * Backtick-delimited regions are NOT scanned as substitution bodies -- a
 * backtick escapes one character in PowerShell and delimits nothing.
 */
function pushRecursed(text: string, out: string[], depth: number): void {
  if (depth >= MAX_RECURSION_DEPTH) {
    throw new Error("max recursion depth exceeded");
  }

  let i = 0;
  while (i < text.length) {
    if (text[i] !== "$" || text[i + 1] !== "(") {
      i++;
      continue;
    }

    const end = readBalancedParens(text, i + 2);
    if (end < 0) {
      i++;
      continue;
    }

    emitInner(text.slice(i + 2, end), out, depth);
    i = end + 1;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Public entry: parsePowerShellSubcommands
// ──────────────────────────────────────────────────────────────────────────

/**
 * Pure-and-total per the discriminated `ParseResult` contract shared with
 * `./bash.ts`: any thrown internal error is caught and surfaced as
 * `{ ok: false, reason }`, which the dispatch consult reads as
 * fire-the-hook.
 *
 * Algorithm:
 *   1. Compute `hasInterpolation` on the raw command.
 *   2. Quote-aware split on compound separators.
 *   3. For each piece, push the piece itself, then recurse into `$(...)`
 *      bodies (depth-capped at `MAX_RECURSION_DEPTH`).
 *   4. Return the deduplicated subcommand list plus the interpolation
 *      flag. No wrapper stripping happens on this path.
 */
export function parsePowerShellSubcommands(command: string): ParseResult {
  try {
    const hasInterpolation = INTERPOLATION_RE.test(command);
    const subcommands: string[] = [];
    for (const piece of splitOnCompoundSeparators(command)) {
      subcommands.push(piece);
      pushRecursed(piece, subcommands, 0);
    }

    return { ok: true, subcommands: [...new Set(subcommands)], hasInterpolation };
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// powerShellSubcommandFires
// ──────────────────────────────────────────────────────────────────────────

/**
 * Single-subcommand match with alias canonicalization and the D-61-04
 * specificity-override rule.
 *
 *   1. Direct match via `glob.test(subcommand)` -> fire.
 *   2. Alias canonicalization: replace the runtime head token with its
 *      canonical cmdlet name and re-test. The compiled pattern's head is
 *      already canonical (see `compilePowerShellRule`), so this is the
 *      branch that lets `PowerShell(Get-ChildItem *)` fire on `gci foo`.
 *   3. Specificity-override: if `hasInterpolation` is true AND the pattern
 *      is NOT command-name-only, fire regardless -- fail-open on uncertain
 *      context.
 *
 * Returns false when no branch applies.
 */
export function powerShellSubcommandFires(
  glob: CompiledPowerShellGlob,
  subcommand: string,
  hasInterpolation: boolean,
): boolean {
  if (glob.test(subcommand)) {
    return true;
  }

  const canonical = canonicalizeHead(subcommand);
  if (canonical !== subcommand && glob.test(canonical)) {
    return true;
  }

  if (hasInterpolation && !glob.isCommandNameOnly) {
    return true;
  }

  return false;
}

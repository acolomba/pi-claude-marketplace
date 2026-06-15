// bridges/hooks/if-field/glob.ts
//
// MATCH-03 hand-authored glob engine for the `if` field permission-rule
// matcher. Pure data, no I/O. Compiles upstream Claude permission-rule
// glob patterns into a discriminated `CompiledBashGlob` / `CompiledPathGlob`
// shape; the runtime `test()` / `testAbsolute()` methods perform a linear
// recursive-descent match with no regex compilation of user input.
//
// D-61-01: zero new runtime deps. The surface required by Claude's
// permission-rule grammar is small -- three metacharacters (`*` segment-
// local, `**` cross-segment, literal everything else), four anchor prefixes
// resolved once at parse time (`//abs`, `~/home`, `/project-root`, `./cwd`),
// plus a fifth implicit `gitignore-bare` anchor for bare-filename rules
// (`Read(.env)` matches at any depth). Hand-authoring keeps the
// architecture test pinning every truth-table row directly against the
// implementation; pulling in `picomatch` / `minimatch` would compile to
// `RegExp` internally and bring in a surface materially larger than the
// grammar requires.
//
// NFR-7: the `GlobToken` union and `PathAnchor` union are both
// discriminated by `kind`; the `matchTokens` switch and the `resolveAnchor`
// switch both terminate with `assertNever`. Adding a new arm without
// updating the switch red-fails `npm run typecheck`.
//
// Pure-and-total contract: `compileBashGlob` and `compilePathGlob` MUST
// never throw. Malformed input compiles to a literal token run (which
// simply never matches anything else). The `if`-layer is best-effort per
// upstream's "use the permission system rather than a hook to enforce a
// hard allow or deny" caveat (D-61-02); throwing here would create a
// portability regression because plugins that install in upstream Claude
// Code would not install in Pi-Claude.
//
// DoS mitigation: zero alternation and zero quantifier-nesting. `**` is
// segment-bounded (consumes whole path segments, not arbitrary characters);
// `*` is segment-local in path mode (cannot consume `/`), but consumes
// across `/` in Bash mode (CR-01) because Bash subcommands carry path
// arguments (`rm /tmp/foo`, `cat /etc/passwd`). Single-globstar patterns
// match in linear `O(pattern.length * text.length)` time; multi-globstar
// patterns are `O(text.length ** N)` in the worst case where N is the
// number of `**` tokens in the pattern (each globstar independently
// scans the whole remainder). Realistic plugin-authored patterns use at
// most 1-2 globstars and bounded path depths; the architecture test
// pins the truth-table rows and is the regression gate. Recursion depth
// is bounded by `text.length`.
//
// Anchor resolution context: callers pass `{ homedir, cwd, projectRoot }`.
// On Pi the `ExtensionContext` from `@earendil-works/pi-coding-agent` does
// not currently expose a `projectRoot`; the consumer (parse-time compile
// in a future plan) passes `ctx.cwd` as the `projectRoot` fallback.

import path from "node:path";

import { assertNever } from "../exec-result.ts";

// ──────────────────────────────────────────────────────────────────────────
// Token + anchor discriminated unions
// ──────────────────────────────────────────────────────────────────────────

/**
 * One glyph in a compiled glob pattern. `literal` is a verbatim run; `star`
 * matches within a single path segment (cannot cross `/`); `globstar`
 * matches zero or more full path segments; `slash` is the segment separator
 * preserved as its own token so the matcher can reason about segment
 * boundaries without re-tokenizing on every recursion.
 */
export type GlobToken =
  | { readonly kind: "literal"; readonly text: string }
  | { readonly kind: "star" }
  | { readonly kind: "globstar" }
  | { readonly kind: "slash" };

/**
 * Resolved anchor classification for `CompiledPathGlob`. Decided at parse
 * time from the leading characters of the raw pattern; the `absoluteBase`
 * on the compiled glob is normalized against the corresponding
 * `homedir` / `projectRoot` / `cwd`.
 */
export type PathAnchor =
  | { readonly kind: "filesystem-root" }
  | { readonly kind: "home" }
  | { readonly kind: "project-root" }
  | { readonly kind: "cwd" }
  | { readonly kind: "gitignore-bare" };

/**
 * Context object consumed by `compilePathGlob`. Pure data; the engine
 * never reads the filesystem. The consumer (the parse-time compile path
 * for `if` predicates) supplies the resolved values once per
 * `parseHooksConfig` invocation.
 */
export interface PathAnchorContext {
  readonly homedir: string;
  readonly cwd: string;
  readonly projectRoot: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Compiled-glob interfaces
// ──────────────────────────────────────────────────────────────────────────

/**
 * Bash-command glob: linear token list, no anchor resolution. The two
 * flags drive Bash-specific behavior at dispatch time:
 *
 *   - `trailingWordBoundary` -- `Bash(ls *)` requires a space after `ls`
 *     (excludes `lsof`); `Bash(ls*)` matches both.
 *   - `isCommandNameOnly`    -- `Bash(git *)` is more permissive than
 *     `Bash(git push *)`; the specificity-override rule on
 *     `bashSubcommandFires` reads this flag (D-61-04).
 */
export interface CompiledBashGlob {
  readonly raw: string;
  readonly tokens: ReadonlyArray<GlobToken>;
  readonly trailingWordBoundary: boolean;
  readonly isCommandNameOnly: boolean;
  test(subcommand: string): boolean;
}

/**
 * Path-tool glob: anchored to a normalized absolute base resolved at
 * parse time. `testAbsolute` checks an absolute event path against the
 * resolved anchor + the token list.
 *
 * `gitignore-bare` anchor: a pattern with no `/` and no leading
 * `./` / `/` / `~/` / `//` (e.g. `.env`) matches at any directory depth
 * relative to `cwd` (encoded as an implicit any-depth-prefix shape).
 * Mirrors upstream's documented gitignore-style bare-filename semantics.
 */
export interface CompiledPathGlob {
  readonly raw: string;
  readonly anchor: PathAnchor;
  readonly absoluteBase: string;
  readonly tokens: ReadonlyArray<GlobToken>;
  testAbsolute(absPath: string): boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Tokenizer
// ──────────────────────────────────────────────────────────────────────────

/**
 * Linear-scan tokenizer. Emits exactly one `GlobToken` per metacharacter
 * occurrence and one `literal` per maximal non-metacharacter run. No
 * lookahead beyond the next char (for the `**` two-char metacharacter).
 *
 * Pure-and-total: every input string produces a finite token list. Empty
 * input yields an empty list.
 */
function tokenize(pattern: string): GlobToken[] {
  const out: GlobToken[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "/") {
      out.push({ kind: "slash" });
      i++;
      continue;
    }

    if (c === "*" && pattern[i + 1] === "*") {
      out.push({ kind: "globstar" });
      i += 2;
      continue;
    }

    if (c === "*") {
      out.push({ kind: "star" });
      i++;
      continue;
    }

    let j = i;
    while (j < pattern.length && pattern[j] !== "*" && pattern[j] !== "/") {
      j++;
    }

    out.push({ kind: "literal", text: pattern.slice(i, j) });
    i = j;
  }

  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Matcher (shared by Bash and path globs)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Recursive-descent glob match. `literal` consumes its text verbatim;
 * `star` consumes within a single segment in path mode (cannot cross
 * `/`) or across `/` in Bash mode (D-61-04); `globstar` consumes zero or
 * more full segments; `slash` consumes exactly `/`.
 *
 * `crossSegment` is the path/Bash mode flag (CR-01). Path-tool callers
 * pass `false` so `*` stops at `/` (`Read(*.ts)` must not match
 * `src/foo.ts`); Bash callers pass `true` so `*` can consume path
 * arguments (`Bash(rm *)` must match `rm -rf /tmp/foo`).
 *
 * Returns true iff the entire token list matches a prefix of `text` AND
 * the consumed prefix equals `text` (i.e. no unmatched trailing
 * characters). Caller-controlled trailing-anchor semantics live on the
 * caller (see `matchBashGlob` / `matchPathGlob` for the Bash word-boundary
 * and path-tail-globstar conventions).
 */
function matchStar(
  tokens: ReadonlyArray<GlobToken>,
  text: string,
  ti: number,
  xi: number,
  crossSegment: boolean,
): boolean {
  // Consume zero or more chars. Path mode stops at "/"; Bash mode (per
  // CR-01) keeps going so `Bash(rm *)` matches `rm /tmp/foo`.
  for (let k = xi; k <= text.length; k++) {
    if (matchTokens(tokens, text, ti + 1, k, crossSegment)) {
      return true;
    }

    if (!crossSegment && text[k] === "/") {
      return false;
    }
  }

  return false;
}

function matchGlobstar(
  tokens: ReadonlyArray<GlobToken>,
  text: string,
  ti: number,
  xi: number,
  crossSegment: boolean,
): boolean {
  // Consume zero or more whole segments. Try every position in remainder.
  for (let k = xi; k <= text.length; k++) {
    if (matchTokens(tokens, text, ti + 1, k, crossSegment)) {
      return true;
    }
  }

  return false;
}

function matchTokens(
  tokens: ReadonlyArray<GlobToken>,
  text: string,
  ti: number,
  xi: number,
  crossSegment: boolean,
): boolean {
  if (ti === tokens.length) {
    return xi === text.length;
  }

  const tok = tokens[ti];
  if (tok === undefined) {
    return false;
  }

  switch (tok.kind) {
    case "literal":
      return (
        text.startsWith(tok.text, xi) &&
        matchTokens(tokens, text, ti + 1, xi + tok.text.length, crossSegment)
      );
    case "slash":
      return text[xi] === "/" && matchTokens(tokens, text, ti + 1, xi + 1, crossSegment);
    case "star":
      return matchStar(tokens, text, ti, xi, crossSegment);
    case "globstar":
      return matchGlobstar(tokens, text, ti, xi, crossSegment);
    default:
      return assertNever(tok);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Bash glob compile + match
// ──────────────────────────────────────────────────────────────────────────

const BASH_COMMAND_NAME_ONLY = /^[A-Za-z0-9_./-]+(\s+\*)?$/;

function matchBashGlob(
  tokens: ReadonlyArray<GlobToken>,
  subcommand: string,
  trailingWordBoundary: boolean,
): boolean {
  // The Bash glob anchors at the start of the subcommand. The subcommand
  // is treated as a single "segment" (no `/` boundary semantics) so the
  // `star` token can consume the entire tail -- CR-01: pass
  // `crossSegment=true` so path-bearing arguments like `rm /tmp/foo` are
  // consumed by `Bash(rm *)`.
  if (matchTokens(tokens, subcommand, 0, 0, true)) {
    return true;
  }

  // Trailing-space word-boundary semantic (D-61-04): `Bash(<cmd> *)`
  // matches both `<cmd>` standalone AND `<cmd> <args>`. The literal-space
  // token would otherwise force a trailing space in the subcommand; we
  // recover the no-arg case by matching `subcommand + " "` against the
  // tokens. This preserves the upstream invariant that `Bash(ls *)`
  // excludes `lsof` (because `lsof` does not start with `ls ` and never
  // gets a trailing-space appended that would change that) while
  // admitting bare `ls` and `timeout`-stripped `npm test`.
  if (trailingWordBoundary && matchTokens(tokens, subcommand + " ", 0, 0, true)) {
    return true;
  }

  return false;
}

/**
 * Compile a Bash-rule glob pattern. Pure-and-total: never throws. Applies
 * the `:*` colon-sugar normalization rule ONLY when the pattern trails
 * with `:*` (mid-pattern `:` is a literal per D-61-04), detects the
 * trailing-space word-boundary and command-name-only flags, then
 * tokenizes via the standard linear-scan algorithm.
 */
export function compileBashGlob(raw: string): CompiledBashGlob {
  const normalized = raw.endsWith(":*") ? raw.slice(0, -2) + " *" : raw;
  const trailingWordBoundary = normalized.endsWith(" *");
  const isCommandNameOnly = BASH_COMMAND_NAME_ONLY.test(normalized);
  const tokens = tokenize(normalized);
  return {
    raw,
    tokens,
    trailingWordBoundary,
    isCommandNameOnly,
    test(subcommand: string): boolean {
      return matchBashGlob(tokens, subcommand, trailingWordBoundary);
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Path glob compile + match
// ──────────────────────────────────────────────────────────────────────────

/**
 * Decide the anchor classification + absolute-base + remaining-pattern
 * for a path-tool glob. Pure-and-total. Anchor precedence (upstream-
 * verbatim from `code.claude.com/docs/en/permissions` § "Read and Edit"):
 *
 *   1. `//<rest>`      -> filesystem-root (matches anywhere; absoluteBase = "")
 *   2. `~/<rest>`      -> home            (absoluteBase = homedir + <rest>-dir)
 *   3. `./<rest>`      -> cwd             (absoluteBase = cwd + <rest>-dir)
 *   4. `/<rest>`       -> project-root    (absoluteBase = projectRoot + <rest>)
 *   5. bare with `/`   -> cwd             (absoluteBase = cwd)
 *   6. bare no `/`     -> gitignore-bare  (absoluteBase = cwd; implicit any-depth prefix)
 */
function resolveAnchor(
  raw: string,
  ctx: PathAnchorContext,
): { readonly anchor: PathAnchor; readonly absoluteBase: string; readonly remaining: string } {
  if (raw.startsWith("//")) {
    // Keep one leading "/" in `remaining` so tokens start with the
    // filesystem-root slash and match against an absolute path verbatim
    // (e.g. `//abs/**` -> tokens `[slash, literal("abs"), slash, globstar]`
    // matched against `/abs/x.ts`).
    return { anchor: { kind: "filesystem-root" }, absoluteBase: "", remaining: raw.slice(1) };
  }

  if (raw.startsWith("~/")) {
    return {
      anchor: { kind: "home" },
      absoluteBase: ctx.homedir,
      remaining: raw.slice(2),
    };
  }

  if (raw.startsWith("./")) {
    return {
      anchor: { kind: "cwd" },
      absoluteBase: ctx.cwd,
      remaining: raw.slice(2),
    };
  }

  if (raw.startsWith("/")) {
    return {
      anchor: { kind: "project-root" },
      absoluteBase: ctx.projectRoot,
      remaining: raw.slice(1),
    };
  }

  if (raw.includes("/")) {
    return {
      anchor: { kind: "cwd" },
      absoluteBase: ctx.cwd,
      remaining: raw,
    };
  }

  return {
    anchor: { kind: "gitignore-bare" },
    absoluteBase: ctx.cwd,
    remaining: raw,
  };
}

/**
 * Strip the `absoluteBase` prefix from `absPath` and return the tail
 * (with one leading separator consumed). Returns `null` when the base
 * is not a containment-prefix of the absolute path.
 */
function stripBase(absoluteBase: string, absPath: string): string | null {
  if (!absPath.startsWith(absoluteBase)) {
    return null;
  }

  const tail = absPath.slice(absoluteBase.length);
  if (tail.startsWith("/")) {
    return tail.slice(1);
  }

  if (tail.length === 0) {
    return "";
  }

  return null;
}

function matchPathGlob(
  anchor: PathAnchor,
  absoluteBase: string,
  tokens: ReadonlyArray<GlobToken>,
  absPath: string,
): boolean {
  if (anchor.kind === "filesystem-root") {
    return matchTokens(tokens, absPath, 0, 0, false);
  }

  const tail = stripBase(absoluteBase, absPath);
  if (tail === null) {
    return false;
  }

  switch (anchor.kind) {
    case "home":
    case "project-root":
    case "cwd":
      return matchTokens(tokens, tail, 0, 0, false);
    case "gitignore-bare": {
      // Bare filename matches at any depth -- try every segment boundary.
      let scan = 0;
      while (scan <= tail.length) {
        if (matchTokens(tokens, tail, 0, scan, false)) {
          return true;
        }

        const nextSlash = tail.indexOf("/", scan);
        if (nextSlash < 0) {
          break;
        }

        scan = nextSlash + 1;
      }

      return false;
    }

    default:
      return assertNever(anchor);
  }
}

/**
 * Compile a path-tool glob pattern. Pure-and-total: never throws.
 *
 * Resolves the anchor at parse time (`//abs` / `~/` / `./` / `/` /
 * gitignore-bare) against the supplied `PathAnchorContext` so the
 * dispatch hot path performs only string-prefix + token matching.
 */
export function compilePathGlob(raw: string, ctx: PathAnchorContext): CompiledPathGlob {
  const { anchor, absoluteBase, remaining } = resolveAnchor(raw, ctx);
  const normalizedBase = absoluteBase === "" ? "" : path.normalize(absoluteBase);
  const tokens = tokenize(remaining);
  return {
    raw,
    anchor,
    absoluteBase: normalizedBase,
    tokens,
    testAbsolute(absPath: string): boolean {
      return matchPathGlob(anchor, normalizedBase, tokens, absPath);
    },
  };
}

---
phase: 61-if-field-permission-rule-matcher
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/architecture/hooks-dispatch.test.ts
  - tests/architecture/hooks-exec.test.ts
  - tests/architecture/hooks-if-field.test.ts
  - tests/architecture/hooks-reducer.test.ts
  - tests/bridges/hooks/dispatch-exec.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/domain/components/hooks.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 61: Code Review Report

**Reviewed:** 2026-06-15T00:00:00Z
**Depth:** standard
**Status:** issues_found

## Summary

Phase 61 lands the MATCH-03 `if`-field permission-rule matcher with the
expected discriminated `IfPredicate` union, the closed-set `IF_PREFIX_TARGETS`
table, the hand-authored glob + Bash parser pair, and the `parseHooksConfig`
side-Map. The architecture-test coverage is broad and covers every documented
truth-table row from the upstream `code.claude.com/docs/en/permissions` page.

One correctness bug surfaces: the Bash-glob matcher reuses the path-glob's
`matchStar` helper without disabling its `/`-segment boundary check, so
`Bash(<cmd> *)` patterns silently FAIL to fire on any subcommand whose
arguments contain a `/` (the most common shape: `rm -rf /tmp/foo`,
`cat /etc/passwd`, `find /var -name x`, `npm test -- src/path`). The unit
fixtures all avoid `/` in Bash arguments, so the bug is not pinned by any
existing test. Documented intent in the `matchBashGlob` block comment says
the star "can consume the entire tail" -- the implementation does not match
the intent.

The remaining findings are quality concerns: one comment-policy violation
introduced this phase (`Plan 01 placement` in `domain/components/hooks.ts`),
test-coverage gaps for Bash commands containing path arguments, and minor
defensive-code observations.

D-61-01..04 are implemented as documented. The atomic-supersession requirement
(REQUIREMENTS.md MATCH-03 + source landing in one commit) is honored by
`3b1de5d` (the squash-merge of the Phase 61 work). The `parseHooksConfig`
widening is complete -- all four production call sites (resolver, event-router
hydrate, install, reinstall, update) thread the `(ctx, compileIf)` triple
correctly.

## Critical Issues

### CR-01: Bash glob `matchStar` enforces `/`-segment boundary, breaking Bash matching for commands with path arguments

**File:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts:191-209`
(`matchStar`), `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts:264-289`
(`matchBashGlob`).

**Issue:** The shared `matchStar` helper short-circuits to `false` when it
encounters a `/` in the text, because that is correct path-glob semantics
(`*` must not cross a segment boundary). `matchBashGlob` reuses the same
helper to match Bash subcommands -- but Bash subcommands are not paths, and
their `/`-bearing arguments are extremely common.

The `matchBashGlob` block comment (line 270-273) explicitly documents the
intended contract:

> The subcommand is treated as a single "segment" (no `/` boundary
> semantics) so the `star` token can consume the entire tail.

The implementation does not match the contract. `matchStar` (line 198-204)
checks `text[k] === "/"` and returns `false` regardless of which caller
invoked it.

**Demonstrating cases** (none of which are covered by the existing truth
tables; each would red-fail with the fix in place):

| `if` pattern | Bash command | Expected | Actual |
| --- | --- | --- | --- |
| `Bash(rm *)` | `rm -rf /tmp/foo` | fires | does NOT fire |
| `Bash(cat *)` | `cat /etc/passwd` | fires | does NOT fire |
| `Bash(ls *)` | `ls -la /home/u` | fires | does NOT fire |
| `Bash(find *)` | `find ./src -name x` | fires | does NOT fire |
| `Bash(npm test *)` | `npm test -- src/a.ts` | fires | does NOT fire |

Severity: Critical. The `if`-field surface exists specifically to let plugin
authors discriminate Bash commands by their arguments (`Bash(rm *)`,
`Bash(git push *)`, etc.). Silently failing to fire on the most common
argument shape -- file paths -- means a plugin like a pre-commit guard or
audit-logger would skip exactly the dangerous calls it was authored to catch.
Fail-OPEN semantics elsewhere in MATCH-03 turn parse/structural failures into
"fire the hook"; this is a fail-CLOSED bug that silently drops legitimate
matches.

**Fix:** Either pass a per-call `allowSlash` flag through `matchStar` /
`matchTokens` and toggle it on from `matchBashGlob`, or split the helper into
two implementations. Inline sketch (flag form):

```typescript
function matchStar(
  tokens: ReadonlyArray<GlobToken>,
  text: string,
  ti: number,
  xi: number,
  allowSlash: boolean,
): boolean {
  for (let k = xi; k <= text.length; k++) {
    if (matchTokens(tokens, text, ti + 1, k, allowSlash)) {
      return true;
    }

    if (!allowSlash && text[k] === "/") {
      return false;
    }
  }

  return false;
}

// matchBashGlob -> matchTokens(tokens, subcommand, 0, 0, true)
// matchPathGlob -> matchTokens(tokens, text, 0, 0, false)
```

Add at least one truth-table row per fixture block exercising a `/`-bearing
argument so the regression is pinned:

```typescript
{ ifPattern: "Bash(rm *)", bashCommand: "rm -rf /tmp/foo", fires: true,
  reason: "star must consume `/` in Bash arguments (CR-01)" },
{ ifPattern: "Bash(cat *)", bashCommand: "cat /etc/passwd", fires: true,
  reason: "star must consume `/` in Bash arguments (CR-01)" },
```

## Warnings

### WR-01: Comment-policy violation introduced this phase -- `Plan 01 placement`

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:46`
**Issue:** The comment block introduced in commit `3b1de5d` says:

```typescript
// MATCH-03: the `if`-field permission-rule primitives live in
// `bridges/hooks/if-field/` (Plan 01 placement) -- domain MUST NOT
// import upward (D-11 import direction). ...
```

`Plan 01 placement` is an explicit forbidden token per
`.claude/rules/typescript-comments.md` ("`Plan NN`, `Plan NN-NN` ... references
to GSD planning steps"). The decision/requirement IDs (`MATCH-03`, `D-11`) are
the correct anchors; `Plan 01 placement` adds no traceability value and is
exactly the case the policy targets.

**Fix:** Drop the parenthetical:

```typescript
// MATCH-03: the `if`-field permission-rule primitives live in
// `bridges/hooks/if-field/` -- domain MUST NOT import upward
// (D-11 import direction). ...
```

### WR-02: ReDoS-shape exponential blow-up on multi-globstar patterns

**File:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts:211-225`
(`matchGlobstar`), `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts:227-256`
(`matchTokens`).

**Issue:** `matchGlobstar` tries every position in the remainder via plain
recursion. A pattern with K globstars matched against a path of length N can
in the worst case explore O(N^K) states (each globstar independently scans
the whole remainder). The block comment ("DoS mitigation: zero alternation and
zero quantifier-nesting. ... Linear-time match against `pattern.length *
text.length`.") overclaims -- linear-time holds only when at most one globstar
appears in the pattern.

Pattern authors are plugin authors (semi-trusted), and `testAbsolute` runs on
every dispatch event whose toolName is in the predicate's `piEvents` set, so a
pathological pattern like `Read(**/**/**/**/.env)` paired with a long absolute
path would burn O(N^4) work per event. In practice this is bounded by realistic
path depths (8-12 segments), but the comment's "linear" claim is false.

Severity: Warning (DoS surface, not correctness, and plugin authors already
have shell exec). Worth either correcting the comment or adding a memoization
pass in `matchTokens` so each `(ti, xi)` pair is visited once.

**Fix (minimal):** Correct the block comment to describe the real complexity:

```typescript
// DoS mitigation: zero alternation and zero quantifier-nesting. `**` is
// segment-bounded ... . Single-globstar patterns match in linear
// O(pattern.length * text.length) time; multi-globstar patterns are
// O(text.length ** N) in the worst case (N = number of globstars).
// Realistic plugin-authored patterns use at most 1-2 globstars; the
// architecture test pins the truth-table rows and is the regression gate.
```

**Fix (memoized):** Add a `Map<number, Set<number>>` keyed on `ti` of visited
`xi` values inside `matchTokens` so each state is visited once, dropping the
worst case to `O(pattern.length * text.length)`. Adds ~10 lines.

### WR-03: `interpolation` flag spuriously triggers on backticks inside single-quoted strings

**File:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts:101-107`
(`INTERPOLATION_RE`), `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts:390-405`
(`parseBashSubcommands`).

**Issue:** `INTERPOLATION_RE` is matched against the raw command without quote
awareness:

```typescript
const INTERPOLATION_RE = /\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\}|\$\(|`/;
// ...
const hasInterpolation = INTERPOLATION_RE.test(command);
```

A command like `echo 'literal $HOME'` or `awk '/foo/ { print $1 }'` would
flip `hasInterpolation` to `true` even though the `$HOME` / backtick is a
literal inside single quotes. Because the specificity-override branch
(`bashSubcommandFires` line 432-434) fires the hook whenever
`hasInterpolation && !isCommandNameOnly`, a `Bash(awk *)` rule on a benign
`awk '/foo/ { print $1 }'` command will fire as if the command contained
real interpolation.

Severity: Warning -- this is fail-OPEN (extra firings, not missed firings),
which matches the upstream "best-effort, not a security boundary" contract.
Documenting the false-positive in the comment is sufficient; gating the regex
on quote state would add real complexity for marginal gain.

**Fix:** Acknowledge the false-positive explicitly:

```typescript
/**
 * Matches any of: `$IDENT` ... or a backtick. The first match on the raw
 * command sets `hasInterpolation = true` for the specificity-override rule.
 *
 * Quote-naïve by design: a `$VAR` or backtick literal inside single quotes
 * (`echo 'literal $HOME'`) still trips the flag. The trade-off is acceptable
 * because the specificity-override path is fail-OPEN -- a spurious flag
 * yields an extra fire, never a missed one (matches upstream's "best-effort,
 * not a security boundary" contract per MATCH-03 §3).
 */
const INTERPOLATION_RE = /\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\}|\$\(|`/;
```

### WR-04: `\\` backslash-escape of compound separators is not honored by the splitter

**File:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts:197-221`
(`splitOnCompoundSeparators`).

**Issue:** The splitter tracks single-quote and double-quote state but does
not honor backslash escapes. A command like `find . -exec rm {} \;` contains
a backslash-escaped semicolon that Bash treats as a literal `;` argument to
`find`. The splitter sees the bare `;` and splits the subcommand into:

- `find . -exec rm {} \\`
- `""` (filtered out as empty)

The first piece happens to wrapper-strip to nothing matching `Bash(rm *)`
and so the existing `WRAPPER_TABLE` row passes -- but `Bash(find *)` matching
`find . -exec rm {} \;` succeeds only by accident (the `find . -exec rm {} \\`
piece still starts with `find ` and matches the literal). The same accident
also triggers CR-01: a path-bearing `find /var -exec rm {} \;` would split,
then fail the `/` boundary in star, then NOT fire `Bash(find *)`.

The wider implication is for `&&`/`||`/`|&`: `echo 'foo \&\& bar'` works
because of quote handling, but `echo foo \&\& bar` (no quotes) would falsely
split.

Severity: Warning (correctness-leaning, but fail-OPEN per the parse-failure
contract -- worst case is over-firing). Adding backslash-escape awareness to
`consumeQuoteChar` is a 5-line change.

**Fix:** Honor a backslash-escape state in `splitOnCompoundSeparators`:

```typescript
function splitOnCompoundSeparators(command: string): string[] {
  const pieces: string[] = [];
  const qc: QuoteCursor = { inSingle: false, inDouble: false };
  let pieceStart = 0;
  let i = 0;
  while (i < command.length) {
    // Backslash escape outside single quotes consumes the next char.
    if (!qc.inSingle && command[i] === "\\" && i + 1 < command.length) {
      i += 2;
      continue;
    }

    if (consumeQuoteChar(qc, command[i])) {
      i++;
      continue;
    }
    // ... rest unchanged
  }
}
```

## Info

### IN-01: Resolver's `noopCompileIf` still walks every handler producing a discarded `Map<string, null>`

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:675-677`

**Issue:** The resolver uses `parseHooksConfig` only for the installable
verdict; it discards the `ifPredicates` side-Map. The current shape still
invokes `buildIfPredicateMap` which iterates every `if`-bearing handler in
the config and stores a `null` per handler. The wasted work is bounded by the
config size (typically <10 handlers) and runs once per `list`/`info` probe,
but the helper exists.

**Fix:** Add an opt-out parameter to `parseHooksConfig` (e.g.
`{ skipIfMap?: boolean }`) and pass `true` from the resolver. Optional;
performance impact is negligible today.

### IN-02: `Plan 01 placement` is the only forbidden token introduced this phase but `install.ts` still carries pre-existing `Phase 57 SUPPORTED_COMPONENT_KINDS extension`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1564`

**Issue:** Out of Phase 61 scope (pre-existing, see `git blame`), but
flagging as informational because the comment-policy audit naturally surfaces
it. Phase 57-era comment should be cleaned up in a separate housekeeping
pass.

**Fix:** Strip `Phase 57` qualifier; the `SUPPORTED_COMPONENT_KINDS extension`
phrase alone carries the same context.

### IN-03: `extractToolName` silently coerces non-string `toolName` to `""` -- correctness fine but worth a comment

**File:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts:301-304`

**Issue:** Returning `""` for a missing/non-string `toolName` is the right
behavior for fail-CLOSED dispatch on the path-tool / mcp-literal /
mcp-server-prefix arms (the empty string is never in `piEvents`, never equals
a literal `mcp__server__tool`, never `startsWith` a `mcp__server__` prefix).
The shape is correct; a one-line block comment would record the design
intent.

**Fix:** Add inline documentation:

```typescript
function extractToolName(event: unknown): string {
  // Missing/non-string toolName returns "" which is rejected by every
  // downstream check (piEvents membership / literal equality / startsWith
  // probe) -- fail-CLOSED on a malformed event payload.
  const name = (event as { toolName?: unknown }).toolName;
  return typeof name === "string" ? name : "";
}
```

---

_Reviewed: 2026-06-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
